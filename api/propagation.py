"""Multi-hop cascade traversal, ported from fdpis_5_integration.ipynb.

Every behaviour the notebook relies on is preserved deliberately:

  * absorption      propagated = magnitude if gate fires else 0
  * gate threshold  read from config.json (0.30), never hardcoded here
  * asymmetric CI   lower bound only at gate_prob >= 0.60, upper at >= 0.10
  * primary delay   cascade-context empirical expectation, added per hop
  * SHRINK          applied to the REPORTED total only; the FULL expectation is
                    what propagates forward. These are different on purpose.
  * RECOVERY_RATE   departure delay -> next hop's arrival delay
  * continuity      only propagate where CONTINUOUS_ROTATION holds
  * breadth-first   one depth fully resolved before descending
  * max depth 5

Confidence boundary: depth 1-2 carry numbers, depth 3+ do not. Correlation with
observed delay is 0.674 / 0.428 / 0.327 / 0.233 / 0.226 by depth, so past depth 2
the API returns total_delay = None rather than a figure it cannot stand behind.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config, features


def rotation_id(tail: str, date: pd.Timestamp) -> str:
    return f"{tail}_{pd.Timestamp(date).strftime('%Y%m%d')}"


def predict_hop(bundle, rows: pd.DataFrame, inbound_delay):
    """Port of notebook 5's predict_hop(). Returns (mid, lo, hi, gate_prob)."""
    X = features.build_layer4_matrix(
        rows, inbound_delay, bundle.prop_features, bundle.cat_cols,
        bundle.layer4_cat_types, bundle.arr_counts,
    )
    p = bundle.gate.predict_proba(X)[:, 1]
    lo = np.clip(bundle.hurdle["lower"].predict(X), 0, None)
    mid = np.clip(bundle.hurdle["median"].predict(X), 0, None)
    hi = np.clip(bundle.hurdle["upper"].predict(X), 0, None)

    # Quantile crossing correction, exactly as the notebook does it.
    st = np.vstack([lo, mid, hi])
    st.sort(axis=0)
    lo, mid, hi = st[0], st[1], st[2]

    fired = p >= bundle.gate_threshold
    return (
        np.where(fired, mid, 0.0),
        np.where(p >= config.LOWER_BOUND_GATE, lo, 0.0),
        np.where(p >= config.UPPER_BOUND_GATE, hi, 0.0),
        p,
    )


def traverse(bundle, tail: str, date, leg_num: int, observed_delay: float) -> dict:
    """Breadth-first multi-hop propagation from one disrupted leg.

    `observed_delay` is the ARRIVAL delay of the origin leg, in minutes - the
    same quantity notebook 5 seeds its frontier with.
    """
    date = pd.Timestamp(date)
    day = bundle.df[(bundle.df["TAIL_NUM"] == tail) & (bundle.df["FL_DATE"] == date)]
    if day.empty:
        raise KeyError(f"no rotation for tail {tail} on {date.date()}")
    day = day.sort_values("LEG_NUM").reset_index(drop=True)
    if leg_num not in set(day["LEG_NUM"]):
        raise KeyError(f"tail {tail} has no leg {leg_num} on {date.date()}")

    day = day.copy()
    day["ROT_ID"] = rotation_id(tail, date)
    idx = day.set_index(["ROT_ID", "LEG_NUM"]).sort_index()

    rot = rotation_id(tail, date)
    frontier = pd.DataFrame({
        "ROT_ID": [rot],
        "ORIGIN_LEG": [leg_num],
        "cur_leg": [leg_num],
        "inbound_delay": [float(observed_delay)],
    })

    hops: list[dict] = []
    for depth in range(1, config.MAX_DEPTH + 1):
        frontier = frontier.copy()
        frontier["next_leg"] = frontier["cur_leg"] + 1

        keys = list(zip(frontier["ROT_ID"], frontier["next_leg"]))
        lookup = idx[idx.index.isin(keys)].reset_index()
        if lookup.empty:
            break
        merged = frontier.merge(
            lookup, left_on=["ROT_ID", "next_leg"], right_on=["ROT_ID", "LEG_NUM"],
            how="inner", suffixes=("", "_f"),
        )
        if merged.empty:
            break

        # Continuity: only a genuine aircraft link can carry delay forward.
        merged = merged[merged["CONTINUOUS_ROTATION"].fillna(False)]
        if merged.empty:
            break

        mid, lo, hi, p = predict_hop(bundle, merged, merged["inbound_delay"].values)
        prim = bundle.expected_primary(merged)

        # REPORTED total is shrunk; CHAINED total is the full expectation.
        pred_total = mid + prim * bundle.shrink
        chain_total = mid + prim
        pred_high = hi + prim

        for i in range(len(merged)):
            r = merged.iloc[i]
            quantitative = depth <= config.CONFIDENCE_DEPTH
            inherited = float(mid[i])
            hops.append({
                "depth": depth,
                "leg_num": int(r["LEG_NUM"]),
                "origin": str(r["ORIGIN"]),
                "dest": str(r["DEST"]),
                "scheduled_dep": _hhmm(r["CRS_DEP_MIN"]),
                "scheduled_arr": _hhmm(r["CRS_ARR_MIN"]),
                "available_slack": _f(r["AVAILABLE_SLACK"]),
                "inbound_delay": round(float(r["inbound_delay"]), 2),
                "inherited_delay": round(inherited, 2) if quantitative else None,
                "fresh_delay": round(float(prim[i] * bundle.shrink), 2) if quantitative else None,
                "total_delay": round(float(pred_total[i]), 2) if quantitative else None,
                "interval_low": round(float(lo[i]), 2) if quantitative else None,
                "interval_high": round(float(pred_high[i]), 2) if quantitative else None,
                "gate_probability": round(float(p[i]), 4),
                "absorbed": bool(inherited == 0.0),
                "confidence": "high" if quantitative else "low",
                "correlation_at_depth": config.DEPTH_CORRELATION.get(depth),
                "flight_number": _flight_no(r),
            })

        alive = merged[chain_total > 0]
        if alive.empty:
            break
        alive_chain = chain_total[chain_total > 0]
        frontier = pd.DataFrame({
            "ROT_ID": alive["ROT_ID"].values,
            "ORIGIN_LEG": alive["ORIGIN_LEG"].values,
            "cur_leg": alive["LEG_NUM"].values,
            "inbound_delay": alive_chain * bundle.recovery_rate,
        })

    quantified = [h for h in hops if h["total_delay"] is not None]
    return {
        "hops": hops,
        "summary": {
            "legs_affected": len(hops),
            "deepest_hop": max((h["depth"] for h in hops), default=0),
            "quantified_hops": len(quantified),
            "low_confidence_hops": len(hops) - len(quantified),
            "total_delay_minutes_added": round(
                sum(h["total_delay"] for h in quantified), 2),
            "confidence_depth": config.CONFIDENCE_DEPTH,
        },
    }


def _f(v):
    return None if pd.isna(v) else round(float(v), 1)


def _hhmm(minutes) -> str | None:
    if pd.isna(minutes):
        return None
    m = int(minutes) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def _flight_no(r) -> str:
    return f"{r['OP_UNIQUE_CARRIER']}{int(r['OP_CARRIER_FL_NUM'])}"
