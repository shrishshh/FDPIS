"""Parity harness: does the API reproduce the notebooks exactly?

Run from the project root:
    conda run -n fdpis python -m api.test_parity

Three checks. If any fails the API has training/serving skew and must NOT be
connected to the frontend.

  1. Layer 3 - score 1,000 test-split flights through the API path and compare
     against a direct notebook-style scoring of the same rows. Tolerance 1e-6.
  2. Layer 4 - replay 100 cascade origins from notebook 5's saved
     cascade_chains_integrated.parquet and compare depth 1 and 2 totals against
     the saved values. Tolerance 0.01 minutes.
  3. Constants - PRIMARY_MEAN 21.55, PRIMARY_MEDIAN 11.00, SHRINK 0.510.
"""
from __future__ import annotations

import sys

import numpy as np
import pandas as pd
import xgboost as xgb

from . import config, features, propagation
from .models import load_bundle

TOL_L3 = 1e-6
TOL_L4 = 0.01
SEED = 42


def _hdr(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)


def check_layer3(b) -> tuple[bool, str]:
    _hdr("CHECK 1 - Layer 3 scoring parity (tolerance 1e-6)")

    # Notebook 2's test split: primary flights after val_end.
    primary = b.df[b.df["LATE_AIRCRAFT_DELAY"].fillna(0) == 0]
    primary = primary.dropna(subset=[config.LAYER3_TARGET])
    test = primary[primary["FL_DATE"] > b.val_end]
    print(f"test split rows: {len(test):,}")

    sample = test.sample(n=min(1000, len(test)), random_state=SEED)
    print(f"sampled        : {len(sample):,}")

    # Path A: through the API's own scoring function.
    api_prob = b.score_layer3(sample)

    # Path B: rebuild the matrix the way notebook 2 does, load the model fresh.
    ref_model = xgb.XGBClassifier()
    ref_model.load_model(str(config.LAYER3_MODEL))
    d = features.add_cyclical(sample)
    X = d[config.LAYER3_FEATURES].copy()
    for c in config.LAYER3_CAT_COLS:
        X[c] = X[c].astype(b.layer3_cat_types[c])
    ref_prob = ref_model.predict_proba(X)[:, 1]

    diff = np.abs(api_prob - ref_prob)
    mx = float(diff.max())
    print(f"max abs difference : {mx:.3e}")
    print(f"mean abs difference: {float(diff.mean()):.3e}")
    print(f"probability range  : {api_prob.min():.4f} .. {api_prob.max():.4f}")
    ok = mx < TOL_L3
    return ok, f"max abs diff {mx:.3e} vs tolerance {TOL_L3:.0e}"


def check_layer4(b) -> tuple[bool, str]:
    _hdr("CHECK 2 - Layer 4 propagation parity (tolerance 0.01 min)")

    path = config.CASCADE_CHAINS_PARQUET
    if not path.exists():
        return False, f"missing {path} - rerun notebook 5"
    chains = pd.read_parquet(path)
    print(f"saved chain rows: {len(chains):,}")

    # A cascade origin is identified by (rotation, origin leg). Replay the ones
    # that have a depth-1 row, since that is where the observed delay enters.
    d1 = chains[chains["depth"] == 1]
    origins = d1[["ROT_ID", "ORIGIN_LEG", "inbound_delay"]].drop_duplicates()
    origins = origins.sample(n=min(100, len(origins)), random_state=SEED)
    print(f"replaying origins: {len(origins):,}")

    rows, skipped = [], 0
    for o in origins.itertuples():
        tail, datestr = str(o.ROT_ID).rsplit("_", 1)
        date = pd.Timestamp(datestr)
        try:
            res = propagation.traverse(b, tail, date, int(o.ORIGIN_LEG),
                                       float(o.inbound_delay))
        except KeyError:
            skipped += 1
            continue
        saved = chains[(chains["ROT_ID"] == o.ROT_ID)
                       & (chains["ORIGIN_LEG"] == o.ORIGIN_LEG)]
        for hop in res["hops"]:
            if hop["depth"] > config.CONFIDENCE_DEPTH:
                continue  # API returns no number past depth 2, by design
            s = saved[saved["depth"] == hop["depth"]]
            if s.empty:
                continue
            rows.append({
                "rot": o.ROT_ID, "depth": hop["depth"],
                "api": hop["total_delay"],
                "notebook": float(s.iloc[0]["pred_total"]),
            })

    if not rows:
        return False, "no comparable hops found"
    cmp = pd.DataFrame(rows)
    cmp["diff"] = (cmp["api"] - cmp["notebook"]).abs()
    print(f"hops compared   : {len(cmp):,}  (origins skipped: {skipped})")
    for depth, g in cmp.groupby("depth"):
        print(f"  depth {depth}: n={len(g):>4}  max diff {g['diff'].max():.6f} min"
              f"  mean {g['diff'].mean():.6f}")
    mx = float(cmp["diff"].max())
    print(f"max abs difference overall: {mx:.6f} min")
    ok = mx < TOL_L4
    return ok, f"max abs diff {mx:.6f} min vs tolerance {TOL_L4}"


def check_constants(b) -> tuple[bool, str]:
    _hdr("CHECK 3 - recomputed primary-delay constants")
    expect = {"PRIMARY_MEAN": (b.primary_mean, 21.55, 0.01),
              "PRIMARY_MEDIAN": (b.primary_median, 11.00, 0.01),
              "SHRINK": (b.shrink, 0.510, 0.001)}
    print(f"{'constant':<16}{'expected':>10}{'actual':>12}{'delta':>12}   status")
    print("-" * 62)
    ok = True
    for name, (actual, exp, tol) in expect.items():
        d = actual - exp
        good = abs(d) <= tol
        ok &= good
        print(f"{name:<16}{exp:>10.3f}{actual:>12.4f}{d:>+12.4f}   "
              f"{'OK' if good else 'MISMATCH'}")
    print("-" * 62)
    print(f"{'RECOVERY_RATE':<16}{0.895:>10.3f}{b.recovery_rate:>12.4f}"
          f"{b.recovery_rate - 0.895:>+12.4f}   "
          f"{'OK' if abs(b.recovery_rate - 0.895) <= 0.001 else 'MISMATCH'}")
    ok &= abs(b.recovery_rate - 0.895) <= 0.001
    print(f"{'GATE_THRESHOLD':<16}{0.30:>10.3f}{b.gate_threshold:>12.4f}")
    return ok, "constants match notebook 5"


def main() -> int:
    print("FDPIS API parity harness")
    print("loading bundle ...")
    b = load_bundle()
    print(f"loaded {len(b.df):,} flights")

    results = []
    for fn in (check_layer3, check_layer4, check_constants):
        try:
            results.append((fn.__name__, *fn(b)))
        except Exception as e:  # noqa: BLE001
            results.append((fn.__name__, False, f"raised {type(e).__name__}: {e}"))

    _hdr("PARITY REPORT")
    width = max(len(n) for n, _, _ in results)
    for name, ok, detail in results:
        print(f"{name:<{width}}  {'PASS' if ok else 'FAIL'}  {detail}")

    all_ok = all(ok for _, ok, _ in results)
    print()
    if all_ok:
        print("ALL CHECKS PASSED - the API reproduces the notebooks. Safe to connect.")
        return 0
    print("PARITY FAILED - training/serving skew present.")
    print("DO NOT connect this API to the frontend until resolved.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
