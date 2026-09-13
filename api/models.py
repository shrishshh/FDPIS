"""Model loading and the derived constants the API needs at startup.

Everything expensive happens once, in ModelBundle.load(). Requests never touch
disk. The bundle fails loudly if the parquet is missing a feature the models
expect - a silent column mismatch is exactly the kind of training/serving skew
this design is meant to prevent.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb

from . import config, features


class StartupError(RuntimeError):
    """Raised when the API cannot be trusted to serve predictions."""


@dataclass
class ModelBundle:
    df: pd.DataFrame
    layer3: xgb.XGBClassifier
    gate: xgb.XGBClassifier
    hurdle: dict
    layer4_cfg: dict

    prop_features: list
    cat_cols: list
    gate_threshold: float

    layer3_cat_types: dict
    layer4_cat_types: dict
    arr_counts: pd.Series

    lk_origin_hour: pd.Series
    lk_carrier_hour: pd.Series
    lk_route: pd.Series
    global_primary_ctx: float
    primary_mean: float
    primary_median: float
    shrink: float
    recovery_rate: float

    oov_counts: dict = field(default_factory=dict)
    train_end: Any = None
    val_end: Any = None

    def expected_primary(self, rows: pd.DataFrame) -> np.ndarray:
        """Notebook 5's expected_primary(), using the recalibrated lookups."""
        a = pd.MultiIndex.from_arrays(
            [rows["ORIGIN"], rows["DEP_HOUR"]]).map(self.lk_origin_hour)
        b = pd.MultiIndex.from_arrays(
            [rows["OP_UNIQUE_CARRIER"], rows["DEP_HOUR"]]).map(self.lk_carrier_hour)
        c = pd.MultiIndex.from_arrays(
            [rows["ORIGIN"], rows["DEST"]]).map(self.lk_route)
        est = pd.DataFrame({"a": a, "b": b, "c": c}).astype(float).mean(axis=1)
        return est.fillna(self.global_primary_ctx).values

    def score_layer3(self, rows: pd.DataFrame) -> np.ndarray:
        X = features.build_layer3_matrix(rows, self.layer3_cat_types)
        return self.layer3.predict_proba(X)[:, 1]


def load_bundle() -> ModelBundle:
    """Load every artifact once. Raises StartupError if anything is untrustworthy."""
    for p in [config.DATA_PARQUET, config.LAYER3_MODEL, config.LAYER4_CONFIG,
              config.GATE_MODEL, *config.HURDLE_MODELS.values()]:
        if not p.exists():
            raise StartupError(f"required artifact missing: {p}")

    layer4_cfg = json.loads(config.LAYER4_CONFIG.read_text())
    prop_features = layer4_cfg["features"]
    cat_cols = layer4_cfg["cat_cols"]
    gate_threshold = float(layer4_cfg["gate_threshold"])

    df = pd.read_parquet(config.DATA_PARQUET)

    # --- fail loudly on any missing feature ------------------------------
    needed_l3 = [f for f in config.LAYER3_FEATURES if f not in config.CYCLICAL_FEATURES]
    missing_l3 = [f for f in needed_l3 if f not in df.columns]
    # These four Layer 4 features depend on the observed inbound delay and are
    # therefore built per request, not read from the parquet.
    derived = {"PREV_ARR_DELAY", "SLACK_DEFICIT", "DELAY_TO_SLACK_RATIO",
               "PROJECTED_HOUR_ARRIVALS", "ARRIVAL_CONGESTION_DELTA"}
    missing_l4 = [f for f in prop_features
                  if f not in df.columns and f not in derived]
    if missing_l3 or missing_l4:
        raise StartupError(
            f"parquet is missing required features - layer3={missing_l3} "
            f"layer4={missing_l4}. Rerun notebook 1.")

    # --- models ----------------------------------------------------------
    layer3 = xgb.XGBClassifier()
    layer3.load_model(str(config.LAYER3_MODEL))
    gate = xgb.XGBClassifier()
    gate.load_model(str(config.GATE_MODEL))
    hurdle = {}
    for name, path in config.HURDLE_MODELS.items():
        m = xgb.XGBRegressor()
        m.load_model(str(path))
        hurdle[name] = m

    # --- chronological split, identical to notebooks 2 and 5 -------------
    dates = np.sort(df["FL_DATE"].unique())
    train_end = dates[int(len(dates) * config.TRAIN_FRACTION)]
    val_end = dates[int(len(dates) * config.VAL_FRACTION)]
    train = df[df["FL_DATE"] <= train_end]

    # --- Layer 3 categorical dtypes --------------------------------------
    # Notebook 2 builds these from ITS train split, which is `primary` (flights
    # with no late-aircraft attribution), not the full frame. Reproduced exactly
    # so out-of-vocabulary values become NaN in the same places.
    primary = train[train["LATE_AIRCRAFT_DELAY"].fillna(0) == 0]
    primary = primary.dropna(subset=[config.LAYER3_TARGET])
    layer3_cat_types = {
        c: pd.CategoricalDtype(categories=sorted(primary[c].dropna().unique()))
        for c in config.LAYER3_CAT_COLS
    }

    # --- Layer 4 categorical dtypes, from persisted training levels -------
    levels = layer4_cfg.get("category_levels")
    if not levels:
        raise StartupError(
            "config.json has no 'category_levels'. Rerun notebook 3 - serving "
            "without the training-time levels risks a silent encoding mismatch.")
    layer4_cat_types = {c: pd.CategoricalDtype(categories=levels[c]) for c in cat_cols}

    oov = {}
    for c in cat_cols:
        known = set(levels[c])
        present = df[c].notna()
        n_oov = int((~df[c].astype(str).isin(known) & present).sum())
        oov[c] = {"levels": len(levels[c]),
                  "out_of_vocabulary_rows": n_oov,
                  "rows_with_value": int(present.sum())}

    arr_counts = df.groupby(["DEST", "FL_DATE", "ARR_HOUR"]).size()

    # --- recovery rate (notebook 5 cell 8) -------------------------------
    d_ = df[(df["DEP_DELAY"] > 15) & df["ARR_DELAY"].notna()]
    recovery_rate = float((d_["ARR_DELAY"] / d_["DEP_DELAY"].clip(lower=1)).median())

    # --- cascade-context primary expectation (notebook 5 cells 5 and 6) ---
    tr2 = train.sort_values(["TAIL_NUM", "FL_DATE", "LEG_NUM"]).copy()
    tr2["ROT_ID"] = (tr2["TAIL_NUM"].astype(str) + "_"
                     + tr2["FL_DATE"].dt.strftime("%Y%m%d"))
    tr2["PREV_LATE"] = tr2.groupby(["ROT_ID"])["ARR_DELAY"].shift(1) >= 15

    ctx = tr2[tr2["PREV_LATE"].fillna(False)
              & tr2["CONTINUOUS_ROTATION"].fillna(False)].copy()
    ctx["PRIMARY_DELAY"] = (ctx["DEP_DELAY_NEW"].fillna(0)
                            - ctx["LATE_AIRCRAFT_DELAY"].fillna(0)).clip(lower=0)

    global_primary_ctx = float(ctx["PRIMARY_DELAY"].mean())
    M = config.SMOOTHING_M

    def make_lookup_ctx(keys):
        st = ctx.groupby(keys)["PRIMARY_DELAY"].agg(["mean", "count"])
        return (st["count"] * st["mean"] + M * global_primary_ctx) / (st["count"] + M)

    primary_mean = float(ctx["PRIMARY_DELAY"].mean())
    primary_median = float(ctx["PRIMARY_DELAY"].median())
    shrink = primary_median / max(primary_mean, 1e-9)

    return ModelBundle(
        df=df, layer3=layer3, gate=gate, hurdle=hurdle, layer4_cfg=layer4_cfg,
        prop_features=prop_features, cat_cols=cat_cols, gate_threshold=gate_threshold,
        layer3_cat_types=layer3_cat_types, layer4_cat_types=layer4_cat_types,
        arr_counts=arr_counts,
        lk_origin_hour=make_lookup_ctx(["ORIGIN", "DEP_HOUR"]),
        lk_carrier_hour=make_lookup_ctx(["OP_UNIQUE_CARRIER", "DEP_HOUR"]),
        lk_route=make_lookup_ctx(["ORIGIN", "DEST"]),
        global_primary_ctx=global_primary_ctx,
        primary_mean=primary_mean, primary_median=primary_median, shrink=shrink,
        recovery_rate=recovery_rate, oov_counts=oov,
        train_end=train_end, val_end=val_end,
    )
