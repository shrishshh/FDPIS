"""Slim serving artifacts for small-memory hosting (Render free tier, 512 MB).

The full API loads data/processed.parquet (1.7M rows, ~1 GB in memory) and
derives its startup constants from the training split. The deployed UI only
offers the test split, so the slim build:

  * keeps only test-split days (FL_DATE > val_end) and only the columns the API
    reads, with dtypes unchanged;
  * precomputes every startup constant that load_bundle() derives from data
    outside those days (Layer 3 category levels, expected-primary lookups,
    recovery rate, out-of-vocabulary counts, dataset-wide health and carrier
    counts) by running the real load_bundle() once, so the values are the
    full-data values, not re-derivations;
  * stores int64 columns as int32 (values and arithmetic unchanged);
  * stores the five production models as binary UBJ and serves them through
    raw xgboost Boosters, so scikit-learn is never imported at runtime.

No model logic changes: the same ModelBundle is returned and every caller
(propagation, layer5, main) is untouched. Parity with the full API is checked
by deploy/compare_apis.py, api/test_parity.py and api/layer5/test_rules.py.

    python -m api.slim build deploy/hf-space/slim     # offline, needs full artifacts
    FDPIS_SLIM_DIR=<dir> uvicorn api.main:app            # serve from the slim dir
"""
from __future__ import annotations

import ctypes
import gc
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import xgboost as xgb

from . import config

# Every parquet column the serving code reads (grep of api/ plus the Layer 3 and
# Layer 4 feature lists), checked by running every endpoint on the slim frame.
COLUMNS = [
    "ARR_DELAY", "ARR_HOUR", "AVAILABLE_SLACK", "CARRIER_ORIGIN_FLIGHTS",
    "CARRIER_ORIGIN_SHARE", "CONTINUOUS_ROTATION", "CRS_ARR_MIN", "CRS_ARR_TIME",
    "CRS_DEP_MIN", "CRS_DEP_TIME", "CRS_ELAPSED_TIME", "DAY_OF_WEEK", "DEP_DEL15",
    "DEP_DELAY", "DEP_DELAY_NEW", "DEP_HOUR", "DEST", "DEST_HOUR_ARRIVALS", "DISTANCE",
    "FL_DATE", "IS_LAST_LEG", "IS_TIGHT_TURNAROUND", "IS_WEEKEND", "LATE_AIRCRAFT_DELAY",
    "LEG_FRACTION", "LEG_NUM", "LONG_GROUND_TIME", "MINUTES_INTO_TAIL_DAY",
    "MIN_TURNAROUND", "OP_CARRIER_FL_NUM", "OP_UNIQUE_CARRIER", "ORIGIN",
    "ORIGIN_DAY_DEPARTURES", "ORIGIN_HOUR_DEPARTURES", "PREV_ARR_DELAY",
    "SCHEDULED_BUFFER_MIN", "SPEED_PROXY", "TAIL_LEGS_TODAY", "TAIL_NUM",
]
MODELS = {"layer3": config.LAYER3_MODEL, "gate": config.GATE_MODEL,
          **{f"hurdle_{k}": v for k, v in config.HURDLE_MODELS.items()}}
LOOKUPS = {"lk_origin_hour": ["ORIGIN", "DEP_HOUR"],
           "lk_carrier_hour": ["OP_UNIQUE_CARRIER", "DEP_HOUR"],
           "lk_route": ["ORIGIN", "DEST"]}
SCALARS = ["gate_threshold", "global_primary_ctx", "primary_mean", "primary_median",
           "shrink", "recovery_rate"]


# ----------------------------------------------------------------- models ---
class BoosterModel:
    """The slice of the xgboost sklearn wrapper the API calls, on a raw Booster.

    Reproduces XGBModel.predict exactly: inplace_predict over the DataFrame,
    missing=NaN, and the best_iteration range when one was saved. For a binary
    classifier predict_proba()[:, 1] is that same vector.
    """

    def __init__(self, booster: xgb.Booster):
        self._b = booster
        best = booster.attr("best_iteration")
        self._range = (0, int(best) + 1) if best is not None else (0, 0)

    def get_booster(self) -> xgb.Booster:
        return self._b

    def predict(self, X) -> np.ndarray:
        return self._b.inplace_predict(X, iteration_range=self._range,
                                       predict_type="value", missing=np.nan,
                                       validate_features=True)

    def predict_proba(self, X) -> np.ndarray:
        p = self.predict(X)
        return np.vstack((1 - p, p)).T


try:
    _malloc_trim = ctypes.CDLL("libc.so.6").malloc_trim
except OSError:                                  # not glibc (Windows/macOS dev)
    _malloc_trim = None


def release_heap(collect: bool = True):
    """Return freed heap to the OS. Parsing the models leaves ~150 MB of freed but
    still-mapped glibc arenas behind; without this RSS never comes back down.
    collect=False skips the (slow) full GC for the per-request call."""
    if collect:
        gc.collect()
    if _malloc_trim is not None:
        _malloc_trim(0)


# ------------------------------------------------------------------ build ---
def build(out: Path) -> None:
    from .models import load_bundle

    b = load_bundle()
    out.mkdir(parents=True, exist_ok=True)
    df = b.df

    served = df[df["FL_DATE"] > b.val_end][COLUMNS]
    # Compact dtypes where values and arithmetic stay identical: int64 -> int32
    # (every column is far inside int32 range, so no sum or product can
    # overflow). Floats stay float64: float32 would change computed values.
    served = served.astype({c: "int32" for c in served.columns
                            if served[c].dtype == "int64"})
    served.to_parquet(out / "flights.parquet", index=False, compression="zstd")

    for name, path in MODELS.items():
        m = xgb.Booster()
        m.load_model(str(path))
        m.save_model(str(out / f"{name}.ubj"))

    for name, keys in LOOKUPS.items():
        getattr(b, name).rename("value").reset_index().to_parquet(out / f"{name}.parquet",
                                                                  index=False)

    all_dates = np.sort(df["FL_DATE"].unique())
    meta = {
        "scalars": {k: getattr(b, k) for k in SCALARS},
        "train_end": str(pd.Timestamp(b.train_end).date()),
        "val_end": str(pd.Timestamp(b.val_end).date()),
        "layer3_cat_levels": {c: list(t.categories) for c, t in b.layer3_cat_types.items()},
        "oov_counts": b.oov_counts,
        # Dataset-wide answers for /api/health and /api/carriers, which describe
        # the whole dataset the models were built on, not just the served days.
        "dataset": {
            "parquet_rows": int(len(df)),
            "date_min": str(pd.Timestamp(all_dates[0]).date()),
            "date_max": str(pd.Timestamp(all_dates[-1]).date()),
            "date_count": int(len(all_dates)),
            "carriers": [[str(c), int(n)] for c, n in
                         df.groupby("OP_UNIQUE_CARRIER").size()
                         .sort_values(ascending=False).items()],
        },
        "served_days": [str(pd.Timestamp(d).date()) for d in
                        np.sort(served["FL_DATE"].unique())],
        "served_rows": int(len(served)),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    print(f"slim build: {len(served):,} rows x {served.shape[1]} cols, "
          f"{len(meta['served_days'])} days ({meta['served_days'][0]}..{meta['served_days'][-1]})")


# ------------------------------------------------------------------- load ---
def load(slim_dir: Path):
    from .models import ModelBundle, StartupError

    slim_dir = Path(slim_dir)
    required = ["flights.parquet", "meta.json", *(f"{n}.ubj" for n in MODELS),
                *(f"{n}.parquet" for n in LOOKUPS)]
    for f in required:
        if not (slim_dir / f).exists():
            raise StartupError(f"required slim artifact missing: {slim_dir / f}")

    meta = json.loads((slim_dir / "meta.json").read_text())
    layer4_cfg = json.loads(config.LAYER4_CONFIG.read_text())
    cat_cols = layer4_cfg["cat_cols"]
    levels = layer4_cfg["category_levels"]

    # Same frame as pd.read_parquet (checked), but the Arrow buffers are freed
    # column by column during conversion, so startup never holds two copies.
    df = pq.read_table(slim_dir / "flights.parquet").to_pandas(self_destruct=True,
                                                               split_blocks=True)

    models = {}
    for name in MODELS:
        booster = xgb.Booster()
        booster.load_model(str(slim_dir / f"{name}.ubj"))
        models[name] = BoosterModel(booster)

    lookups = {}
    for name, keys in LOOKUPS.items():
        t = pd.read_parquet(slim_dir / f"{name}.parquet")
        lookups[name] = t.set_index(keys)["value"].rename(None)

    s = meta["scalars"]
    bundle = ModelBundle(
        df=df, layer3=models["layer3"], gate=models["gate"],
        hurdle={k: models[f"hurdle_{k}"] for k in ("lower", "median", "upper")},
        layer4_cfg=layer4_cfg, prop_features=layer4_cfg["features"], cat_cols=cat_cols,
        gate_threshold=float(layer4_cfg["gate_threshold"]),
        layer3_cat_types={c: pd.CategoricalDtype(categories=v)
                          for c, v in meta["layer3_cat_levels"].items()},
        layer4_cat_types={c: pd.CategoricalDtype(categories=levels[c]) for c in cat_cols},
        arr_counts=df.groupby(["DEST", "FL_DATE", "ARR_HOUR"]).size(),
        **lookups,
        global_primary_ctx=s["global_primary_ctx"],
        primary_mean=s["primary_mean"], primary_median=s["primary_median"],
        shrink=s["shrink"], recovery_rate=s["recovery_rate"],
        oov_counts=meta["oov_counts"],
        train_end=np.datetime64(meta["train_end"], "ns"),
        val_end=np.datetime64(meta["val_end"], "ns"),
    )
    bundle.dataset_meta = meta["dataset"]
    release_heap()
    return bundle


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "build":
        sys.exit("usage: python -m api.slim build <out_dir>")
    build(Path(sys.argv[2]))
