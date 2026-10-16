"""GET /api/alerts - the crew alert feed for one operating day.

For every aircraft flying that day:
  1. Seed = its first leg whose recorded arrival delay is at least
     ORIGIN_MIN_DELAY (15 min, notebook 5's cascade-origin rule). This is the
     moment an OCC would first see the day going wrong.
  2. Propagate that observed delay down the rest of the rotation (Layer 4).
  3. Project the proxy crew's duty (crew.py) and evaluate every crew rule.

Aircraft with no delayed leg are projected on schedule.

Performance: propagation.traverse() filters the full 1.7M-row frame on every
call (~200 ms), which is ~8 minutes for a 2,000-aircraft day. traverse_many()
runs the SAME per-hop computation for all seeds of a day at once, reusing
propagation.predict_hop and bundle.expected_primary unchanged. test_rules.py
checks it reproduces traverse() hop for hop.
"""
from __future__ import annotations

import pandas as pd

from .. import config, propagation
from . import crew, engine, tz as tzu
from .crew import Leg


def traverse_many(bundle, day: pd.DataFrame, seeds: pd.DataFrame) -> dict[str, list[dict]]:
    """Batch form of propagation.traverse for one date.

    `day`   all legs flown that date (any number of aircraft)
    `seeds` one row per aircraft: TAIL_NUM, LEG_NUM, inbound_delay
    Returns TAIL_NUM -> list of hop dicts with the same values traverse() returns.
    """
    day = day.copy()
    day["ROT_ID"] = day["TAIL_NUM"].astype(str)
    idx = day.set_index(["ROT_ID", "LEG_NUM"]).sort_index()

    frontier = pd.DataFrame({
        "ROT_ID": seeds["TAIL_NUM"].astype(str).values,
        "ORIGIN_LEG": seeds["LEG_NUM"].astype(int).values,
        "cur_leg": seeds["LEG_NUM"].astype(int).values,
        "inbound_delay": seeds["inbound_delay"].astype(float).values,
    })
    out: dict[str, list[dict]] = {}
    for depth in range(1, config.MAX_DEPTH + 1):
        if frontier.empty:
            break
        frontier = frontier.copy()
        frontier["next_leg"] = frontier["cur_leg"] + 1
        keys = list(zip(frontier["ROT_ID"], frontier["next_leg"]))
        lookup = idx[idx.index.isin(keys)].reset_index()
        if lookup.empty:
            break
        merged = frontier.merge(lookup, left_on=["ROT_ID", "next_leg"],
                                right_on=["ROT_ID", "LEG_NUM"], how="inner", suffixes=("", "_f"))
        merged = merged[merged["CONTINUOUS_ROTATION"].fillna(False)].reset_index(drop=True)
        if merged.empty:
            break

        mid, lo, hi, p = propagation.predict_hop(bundle, merged, merged["inbound_delay"].values)
        prim = bundle.expected_primary(merged)
        pred_total = mid + prim * bundle.shrink
        chain_total = mid + prim
        pred_high = hi + prim
        quantitative = depth <= config.CONFIDENCE_DEPTH

        for i in range(len(merged)):
            r = merged.iloc[i]
            out.setdefault(r["ROT_ID"], []).append({
                "depth": depth,
                "leg_num": int(r["LEG_NUM"]),
                "inbound_delay": round(float(r["inbound_delay"]), 2),
                "inherited_delay": round(float(mid[i]), 2) if quantitative else None,
                "total_delay": round(float(pred_total[i]), 2) if quantitative else None,
                "interval_low": round(float(lo[i]), 2) if quantitative else None,
                "interval_high": round(float(pred_high[i]), 2) if quantitative else None,
                "gate_probability": round(float(p[i]), 4),
            })

        alive = chain_total > 0
        frontier = pd.DataFrame({
            "ROT_ID": merged.loc[alive, "ROT_ID"].values,
            "ORIGIN_LEG": merged.loc[alive, "ORIGIN_LEG"].values,
            "cur_leg": merged.loc[alive, "LEG_NUM"].values,
            "inbound_delay": chain_total[alive] * bundle.recovery_rate,
        })
    return out


def _legs_by_tail(day: pd.DataFrame) -> dict[str, list[Leg]]:
    dep, arr = tzu.scheduled_utc(day)
    out: dict[str, list[Leg]] = {}
    for i, r in zip(day.index, day.itertuples()):
        out.setdefault(str(r.TAIL_NUM), []).append(Leg(
            int(r.LEG_NUM), f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}",
            str(r.ORIGIN), str(r.DEST), dep.loc[i], arr.loc[i], float(r.CRS_ELAPSED_TIME or 0)))
    for legs in out.values():
        legs.sort(key=lambda l: l.leg_num)
    return out


_CACHE: dict[tuple, dict] = {}
_CACHE_MAX = 32


SEED_MODES = ("arrival", "departure")
# Departure seeding is the default since the LAYER 5 EARLY SEEDING backtest: on the
# test split it roughly doubles actionable FDP recall (FAA 0.17 -> 0.38, DGCA
# 0.19 -> 0.41) with LIKELY precision >= 0.84 on every crew rule.
DEFAULT_SEED_ON = "departure"


def day_feed(bundle, profile_name: str, date: str, carrier: str | None = None,
             crew_model: str = "single", seed_on: str | None = None) -> dict:
    """Cached per (profile, date, carrier, crew model, seed mode). The bundle is fixed."""
    seed_on = seed_on or DEFAULT_SEED_ON
    key = (profile_name, date, carrier, crew_model, seed_on)
    if key not in _CACHE:
        if len(_CACHE) >= _CACHE_MAX:
            _CACHE.pop(next(iter(_CACHE)))
        _CACHE[key] = _build_feed(bundle, profile_name, date, carrier, crew_model, seed_on)
    return _CACHE[key]


def seed_rule_text(seed_on: str) -> str:
    if seed_on == "departure":
        return (f"first leg with recorded departure delay >= {config.ORIGIN_MIN_DELAY} min; "
                f"known at its actual departure; its arrival delay is estimated as departure "
                f"delay x the Layer 4 recovery rate")
    return f"first leg with recorded arrival delay >= {config.ORIGIN_MIN_DELAY} min; known at its actual arrival"


def select_seeds(bundle, day: pd.DataFrame, seed_on: str) -> pd.DataFrame:
    """One seed per aircraft: TAIL_NUM, LEG_NUM, inbound_delay, info_time_utc.

    arrival    first leg with ARR_DELAY >= 15. inbound = ARR_DELAY. Known at the
               leg's actual arrival (scheduled block-in + ARR_DELAY).
    departure  first leg with DEP_DELAY >= 15. inbound = DEP_DELAY x recovery rate,
               the same departure->arrival step propagation.traverse applies between
               hops. Known at the leg's actual departure (scheduled dep + DEP_DELAY).
               The seed leg's recorded ARR_DELAY is never read.
    """
    if seed_on not in SEED_MODES:
        raise ValueError(f"seed_on must be one of {SEED_MODES}")
    col = "ARR_DELAY" if seed_on == "arrival" else "DEP_DELAY"
    seeds = day[day[col] >= config.ORIGIN_MIN_DELAY].groupby("TAIL_NUM", sort=False).head(1)
    dep_utc, arr_utc = tzu.scheduled_utc(seeds)
    if seed_on == "arrival":
        inbound = seeds["ARR_DELAY"].astype(float)
        info = arr_utc + pd.to_timedelta(inbound, unit="m")
    else:
        dep = seeds["DEP_DELAY"].astype(float)
        inbound = dep * bundle.recovery_rate
        info = dep_utc + pd.to_timedelta(dep, unit="m")
    return pd.DataFrame({"TAIL_NUM": seeds["TAIL_NUM"].values, "LEG_NUM": seeds["LEG_NUM"].values,
                         "inbound_delay": inbound.values, "info_time_utc": info.values})


def evaluate_day(bundle, profile_name: str, date: str, carrier: str | None = None,
                 crew_model: str = "single", seed_on: str | None = None) -> dict:
    """Evaluate every aircraft operating `date`. Shared by the feed and the backtest,
    so the backtest scores exactly what the API serves.

    Returns {"profile", "next_day_in_dataset", "seed_map", "rotations": [...]}, where
    each rotation is {"tail", "legs", "seed", "delays", "crews": [(proj, block, legs, alerts)]}.
    """
    profile = engine.load_profile(profile_name)
    d = pd.Timestamp(date)
    df = bundle.df
    day = df[df["FL_DATE"] == d]
    if carrier:
        day = day[day["OP_UNIQUE_CARRIER"] == carrier]
    if day.empty:
        raise KeyError(f"no flights on {date}" + (f" for carrier {carrier}" if carrier else ""))
    day = day.sort_values(["TAIL_NUM", "LEG_NUM"])
    tails = day["TAIL_NUM"].unique()

    # ---- seeds: one per aircraft (see select_seeds) ----------------------------
    seed_on = seed_on or DEFAULT_SEED_ON
    seeds = select_seeds(bundle, day, seed_on)
    hops = traverse_many(bundle, day, seeds[["TAIL_NUM", "LEG_NUM", "inbound_delay"]])
    seed_map = {str(r.TAIL_NUM): (int(r.LEG_NUM), float(r.inbound_delay)) for r in seeds.itertuples()}
    info_map = {str(r.TAIL_NUM): pd.Timestamp(r.info_time_utc).tz_localize("UTC")
                if pd.Timestamp(r.info_time_utc).tzinfo is None else pd.Timestamp(r.info_time_utc)
                for r in seeds.itertuples()}

    # ---- next-day first report per aircraft (rest rule) ---------------------
    nd = df[(df["FL_DATE"] == d + pd.Timedelta(days=1)) & df["TAIL_NUM"].isin(tails)]
    nxt: dict[str, Leg] = {}
    if not nd.empty:
        first = nd.sort_values("LEG_NUM").groupby("TAIL_NUM", sort=False).head(1)
        for t, legs in _legs_by_tail(first).items():
            nxt[t] = legs[0]
    report_buf = float(profile["proxy"]["report_buffer_minutes"]["value"])
    carrier_of = day.groupby("TAIL_NUM", sort=False)["OP_UNIQUE_CARRIER"].first().to_dict()
    bases = engine.carrier_bases(bundle) if crew_model == "inferred_blocks" else {}

    rotations = []
    for tail, legs in _legs_by_tail(day).items():
        seed = seed_map.get(tail)
        delays = (engine.delays_from_hops(hops.get(tail, []), seed[0], seed[1], bundle.recovery_rate)
                  if seed else {})
        n = nxt.get(tail)
        crews = []
        for proj, block, blegs in engine.evaluate_crews(
                profile, legs, delays, seed[0] if seed else None,
                n.dep_utc - pd.Timedelta(minutes=report_buf) if n else None,
                n.origin if n else None, crew_model, bases.get(carrier_of.get(tail), set()),
                info_time_utc=info_map.get(tail)):
            new_alerts = engine.crew_alerts(profile, proj, blegs, delays, tail, date, "feed",
                                            crew_model=crew_model, duty_block=block)
            p = engine.projection_dict(proj, blegs) if new_alerts else None
            for a in new_alerts:
                a["duty"] = {
                    "report_time_local": p["report_time_local"], "report_station": p["report_station"],
                    "segments": p["segments"], "fdp_limit_minutes": p["fdp_limit_minutes"],
                    "projected_duty_end_local": p["duty_end_median_local"],
                    "projected_duty_end_station": p["duty_end_station"],
                    "fdp_projected_median_minutes": p["fdp_projected_median_minutes"],
                    "fdp_projected_upper_minutes": p["fdp_projected_upper_minutes"],
                    "seed_leg": seed[0] if seed else None,
                    "seed_arrival_delay_minutes": round(seed[1], 1) if seed else None,
                }
            crews.append((proj, block, blegs, new_alerts))
        rotations.append({"tail": tail, "carrier": carrier_of.get(tail), "legs": legs,
                          "seed": seed, "delays": delays, "crews": crews,
                          "next_first_leg": n, "info_time_utc": info_map.get(tail)})
    return {"profile": profile, "next_day_in_dataset": not nd.empty, "seed_map": seed_map,
            "rotations": rotations, "seed_on": seed_on}


def _build_feed(bundle, profile_name: str, date: str, carrier: str | None,
                crew_model: str, seed_on: str) -> dict:
    ev = evaluate_day(bundle, profile_name, date, carrier, crew_model, seed_on)
    profile = ev["profile"]
    alerts, statuses = [], {}
    days_covered = 0
    for rot in ev["rotations"]:
        covered = False
        for proj, _block, _legs, new_alerts in rot["crews"]:
            statuses[proj.status] = statuses.get(proj.status, 0) + 1
            covered |= proj.status != "proxy_not_applicable"
            alerts.extend(new_alerts)
        days_covered += covered

    alerts = engine.sort_alerts(alerts)
    by_sev = {s: sum(a["severity"] == s for a in alerts) for s in (crew.LIKELY, crew.WATCH)}
    by_reason = {r: sum(a.get("watch_reason") == r for a in alerts)
                 for r in (crew.UPPER_BOUND_ONLY, crew.BEYOND_DEPTH_2)}
    n = len(ev["rotations"])
    return {
        "date": date,
        "carrier": carrier,
        "profile": profile["profile"],
        "profile_name": profile["name"],
        "crew_model": crew_model,
        "seed_on": seed_on,
        "crew_model_label": (crew.INFERRED_LABEL if crew_model == "inferred_blocks"
                             else "one hypothetical crew per aircraft-day"),
        "disclosure": engine.disclosure(profile),
        "unverified": engine.unverified(profile),
        "summary": {
            "aircraft": n,
            "aircraft_with_delay_seed": len(ev["seed_map"]),
            "rotations_by_status": statuses,
            "aircraft_days_covered": days_covered,
            "coverage_share": round(days_covered / n, 4) if n else 0.0,
            "crews_flagged": len({(a["tail"], (a.get("duty_block") or {}).get("index")) for a in alerts}),
            "alerts_by_severity": by_sev,
            "watch_by_reason": by_reason,
            "alerts_deadline_passed": sum(a["status"] == "deadline_passed" for a in alerts),
            "next_day_in_dataset": ev["next_day_in_dataset"],
            "seed_rule": seed_rule_text(seed_on),
        },
        "alerts": alerts,
    }
