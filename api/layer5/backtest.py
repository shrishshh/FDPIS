"""Layer 5 backtest: are the crew alerts RIGHT, not just consistent?

Run from the project root:
    conda run -n fdpis python -m api.layer5.backtest

Scores every crew alert the engine raises on the TEST split (2025-07-19 ..
2025-07-31) against what BTS recorded actually happened. Layer 4 was trained on
earlier dates; scoring on training dates would be leakage.

For each crew (aircraft-day, or inferred duty block) it computes the ACTUAL
outcome of every crew rule with the engine's own definitions:

  actual block-in   last leg's scheduled departure (UTC) + CRS_ELAPSED_TIME + ARR_DELAY
                    (never ARR_TIME clock values)
  report            first scheduled departure - report buffer (same as the proxy)
  limits            re-selected from the ACTUAL duty window (Table B row; DGCA
                    night duty / landings), exactly as the engine does for the
                    projected window

A crew whose aircraft had a leg CANCELLED after the seed goes to the
CANCELLED_DOWNSTREAM bucket: its actual FDP is unknown, and a crew going illegal
is a real cause of late-day cancellations, so these are counted, not dropped.

Three alerting methods are scored on identical crews:
  engine    the deployed severities (LIKELY / WATCH; WATCH carries watch_reason
            upper_bound_only | beyond_depth_2)
  naive     "scheduled FDP + seed arrival delay > limit": delay carried forward
            with no absorption, no model
  proposed  recalibration (NOT applied): LIKELY only if the interval LOWER bound
            crosses; median- or upper-only -> WATCH. It has no
            tunable threshold, so nothing is fitted on the test dates.

Writes results/layer5/*.csv and records parquet files.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from .. import config
from ..models import load_bundle
from . import crew, engine, feed, tz as tzu
from .crew import BEYOND_DEPTH_2, LIKELY, UPPER_BOUND_ONLY, WATCH

# The pre-merge labels, reconstructed from watch_reason so the LAYER 5 EARLY SEEDING
# ordering scan stays reproducible: POSSIBLE = WATCH upper_bound_only, MONITOR = WATCH
# beyond_depth_2.
POSSIBLE, MONITOR = "POSSIBLE", "MONITOR"

OUT = Path(__file__).resolve().parent.parent.parent / "results" / "layer5"
PROFILES = ("faa_part117", "dgca_fdtl")
SHORT = {"faa_part117": "faa", "dgca_fdtl": "dgca"}
CREW_RULE_KINDS = ("crew_fdp", "crew_fdp_extended", "crew_duty", "crew_rest")
APPLICABLE = ("ok", "at_risk")
INFERRED_DATES = ("2025-07-21", "2025-07-25", "2025-07-30")


# ----------------------------------------------------------------- inputs --
def cancelled_index(bundle) -> dict:
    """(tail, date) -> sorted scheduled departure times (UTC) of cancelled legs
    (validation and test dates)."""
    c = pd.read_parquet(Path(config.DATA_PARQUET).parent / "cancelled.parquet",
                        columns=["FL_DATE", "TAIL_NUM", "ORIGIN", "CRS_DEP_TIME"])
    c = c.dropna(subset=["TAIL_NUM"])
    c = c[c["FL_DATE"] > bundle.train_end]
    hhmm = c["CRS_DEP_TIME"].astype(int)
    local = c["FL_DATE"] + pd.to_timedelta((hhmm // 100) * 60 + hhmm % 100, unit="m")
    c = c.assign(dep_utc=tzu.local_to_utc(local, c["ORIGIN"]))
    return {k: sorted(g["dep_utc"]) for k, g in c.groupby(["TAIL_NUM", "FL_DATE"])}


def cancelled_stats(bundle) -> dict:
    c = pd.read_parquet(Path(config.DATA_PARQUET).parent / "cancelled.parquet",
                        columns=["FL_DATE", "TAIL_NUM"])
    c = c[c["FL_DATE"] > bundle.val_end]
    return {"cancelled_legs_test": int(len(c)),
            "cancelled_legs_without_tail": int(c["TAIL_NUM"].isna().sum())}


# --------------------------------------------------------- scenario logic --
def _scenario(profile, kinds, legs, delays, proj, scenario, arr_override=None):
    """rule_id -> crossed? under one scenario of the LAST leg's arrival delay.
    Mirrors crew.project_duty; validated against it (see main)."""
    m = _margins(profile, kinds, legs, delays, proj, scenario, arr_override)
    return None if m is None else {k: v > 0 for k, v in m.items()}


def _margins(profile, kinds, legs, delays, proj, scenario, arr_override=None):
    """rule_id -> excess minutes beyond the limit (positive = breach) for one scenario.
    gt rules: value - threshold; lt (rest): threshold - value. A landing-cap breach is +inf."""
    post = float(profile["proxy"]["post_flight_buffer_minutes"]["value"])
    last = legs[-1]
    tzname = tzu.tz_for(legs[0].origin)
    a = arr_override if arr_override is not None else crew._arr_delay(last, delays, scenario, None)
    if a is None:
        return None
    fdp = proj.fdp_scheduled + a
    block_in = last.arr_utc + pd.Timedelta(minutes=a)
    duty_end = block_in + pd.Timedelta(minutes=post)
    lim, cap, _ = crew.fdp_limit(kinds["crew_fdp"], proj.report_utc, duty_end, len(legs), tzname)
    out = {}
    for r in profile["rules"]:
        k = r["kind"]
        if k == "crew_fdp":
            out[r["id"]] = np.inf if (cap is not None and len(legs) > cap) else fdp - lim
        elif k == "crew_fdp_extended":
            out[r["id"]] = fdp - (lim + r["threshold"]["plus_minutes"])
        elif k == "crew_duty":
            out[r["id"]] = fdp + post - (lim + r["threshold"]["plus_minutes"])
        elif k == "crew_rest" and proj.rest_evaluated:
            rest = (proj.next_report_utc - duty_end).total_seconds() / 60
            duty = (duty_end - proj.report_utc).total_seconds() / 60
            out[r["id"]] = crew.rest_threshold(r, duty) - rest
    return out


def _seed_crossed(profile, kinds, legs, proj, seed_leg, seed_delay, arr_last):
    """Rules whose limit is ALREADY crossed when the seed leg arrives (observed, not
    predicted). The engine suppresses these (breached_at_seed); every method's table
    excludes them so no method is scored on hindsight."""
    post = float(profile["proxy"]["post_flight_buffer_minutes"]["value"])
    last = legs[-1]
    end = last.arr_utc + pd.Timedelta(minutes=(arr_last or 0) + post)
    lim, _, _ = crew.fdp_limit(kinds["crew_fdp"], proj.report_utc, end, len(legs),
                               tzu.tz_for(legs[0].origin))
    seed_fdp = (seed_leg.arr_utc + pd.Timedelta(minutes=seed_delay) - proj.report_utc).total_seconds() / 60
    out = set()
    for r in profile["rules"]:
        if r["kind"] == "crew_fdp" and seed_fdp > lim:
            out.add(r["id"])
        elif r["kind"] == "crew_fdp_extended" and seed_fdp > lim + r["threshold"]["plus_minutes"]:
            out.add(r["id"])
        elif r["kind"] == "crew_duty" and seed_fdp + post > lim + r["threshold"]["plus_minutes"]:
            out.add(r["id"])
    return out


def _seed_carry(seed, legs):
    """Naive rule: the seed's arrival delay, carried unchanged to the crew's last leg."""
    if seed is None:
        return None
    if seed[0] > legs[-1].leg_num:
        return None                 # the whole block was flown before the disruption
    return seed[1]


# ------------------------------------------------------------- one day --
def _carried(delays):
    """crew.project_duty's beyond-depth-2 WATCH trigger: the deepest quantified upper arrival delay."""
    carried = None
    for ln in sorted(delays):
        d = delays[ln]
        if d.observed:
            carried = d.arr_med
        elif d.quantified and d.arr_up is not None:
            carried = d.arr_up
    return carried


def score_day(bundle, profile_name, date, crew_model, arr_delay, elapsed, canc, seed_on="arrival"):
    ev = feed.evaluate_day(bundle, profile_name, date, None, crew_model, seed_on)
    profile = ev["profile"]
    kinds = {}
    for r in profile["rules"]:
        kinds.setdefault(r["kind"], r)
    crew_rules = [r for r in profile["rules"] if r["kind"] in CREW_RULE_KINDS]
    post = float(profile["proxy"]["post_flight_buffer_minutes"]["value"])
    rows, leads, mism = [], [], 0
    d = pd.Timestamp(date)

    for rot in ev["rotations"]:
        tail, seed = rot["tail"], rot["seed"]
        seed_leg_obj = next((l for l in rot["legs"] if seed and l.leg_num == seed[0]), None)
        cancelled = canc.get((tail, d), [])
        crews = rot["crews"]
        for ci, (proj, block, blegs, alerts) in enumerate(crews):
            last = blegs[-1]
            # ---- cancellation after the seed, inside this crew's span ------
            start = max(blegs[0].dep_utc, seed_leg_obj.dep_utc) if seed_leg_obj else blegs[0].dep_utc
            end = crews[ci + 1][2][0].dep_utc if ci + 1 < len(crews) else pd.Timestamp.max.tz_localize("UTC")
            canc_down = any(start < t < end for t in cancelled)
            # ---- actual outcome --------------------------------------------
            ad = arr_delay.get((tail, last.leg_num))
            actual = None
            ft_actual = sum(elapsed.get((tail, l.leg_num), np.nan) for l in blegs)
            if proj.status in APPLICABLE and ad is not None and not np.isnan(ad):
                actual = _scenario(profile, kinds, blegs, {}, proj, "actual", arr_override=float(ad))
            outcome_unknown = proj.status in APPLICABLE and actual is None

            sev = {a["rule_id"]: a["severity"] for a in alerts}
            reason = {a["rule_id"]: a.get("watch_reason") for a in alerts}
            # ---- naive and proposed -----------------------------------------
            naive = None
            carry = _seed_carry(seed, blegs)
            if proj.status in APPLICABLE and carry is not None:
                naive = _scenario(profile, kinds, blegs, {}, proj, "naive", arr_override=carry)
            # Mirror the engine: it tests the seed-leg crossing against the limit of
            # whichever scenario fires (median first, else upper). DGCA night duty can
            # make that limit differ between scenarios.
            at_seed = set()
            if proj.status in APPLICABLE and seed_leg_obj is not None and                     any(l.leg_num == seed[0] for l in blegs):
                fire = {s: _scenario(profile, kinds, blegs, rot["delays"], proj, s)
                        for s in ("median", "upper")}
                cross = {s: _seed_crossed(profile, kinds, blegs, proj, seed_leg_obj, seed[1],
                                          crew._arr_delay(last, rot["delays"], s, None))
                         for s in ("median", "upper")}
                for rid in (fire["median"] or {}):
                    if fire["median"][rid]:
                        if rid in cross["median"]:
                            at_seed.add(rid)
                    elif fire["upper"] and fire["upper"].get(rid) and rid in cross["upper"]:
                        at_seed.add(rid)
            mg = {}
            if proj.status in APPLICABLE:
                mg = {s: _margins(profile, kinds, blegs, rot["delays"], proj, s)
                      for s in ("median", "upper")}
                if carry is not None:
                    mg["naive"] = _margins(profile, kinds, blegs, {}, proj, "naive", arr_override=carry)
                cv = _carried(rot["delays"])
                if cv is not None:
                    mg["carried"] = _margins(profile, kinds, blegs, {}, proj, "carried", arr_override=cv)
            proposed = {}
            if proj.status in APPLICABLE:
                sc = {s: _scenario(profile, kinds, blegs, rot["delays"], proj, s)
                      for s in ("lower", "median", "upper")}
                if sc["median"] is not None:
                    # validate the mirror: median/upper must reproduce the engine
                    for r in crew_rules:
                        rid = r["id"]
                        if rid not in sc["median"] or rid in at_seed:
                            continue
                        eng = sev.get(rid)
                        mine = (LIKELY if sc["median"][rid] else WATCH if sc["upper"][rid] else None)
                        if eng != mine and reason.get(rid) != BEYOND_DEPTH_2:
                            mism += 1
                        proposed[rid] = (LIKELY if sc["lower"][rid] else WATCH
                                         if (sc["median"][rid] or sc["upper"][rid]) else None)
                else:
                    proposed = {r["id"]: sev.get(r["id"]) for r in crew_rules}   # beyond depth 2 stays

            for r in crew_rules:
                rid = r["id"]
                evaluated = (r["kind"] != "crew_rest" or proj.rest_evaluated) and rid not in at_seed
                rows.append({
                    "date": date, "profile": profile_name, "crew_model": crew_model,
                    "seed_on": seed_on, "tail": tail, "carrier": rot["carrier"],
                    "last_leg_depth": (rot["delays"][last.leg_num].depth
                                       if last.leg_num in rot["delays"] else np.nan),
                    "block": block["index"] if block else 0,
                    "status": proj.status, "rule_id": rid, "rule_evaluated": evaluated,
                    "rule_breached_at_seed": rid in at_seed,
                    "seed_delay": seed[1] if seed else np.nan,
                    "seed_leg": seed[0] if seed else np.nan,
                    "engine": sev.get(rid),
                    "engine_watch_reason": reason.get(rid),
                    "naive": (bool(naive.get(rid)) if naive is not None and rid in naive else
                              (False if evaluated and proj.status in APPLICABLE else None)),
                    "proposed": proposed.get(rid),
                    "actual_breach": (bool(actual[rid]) if actual is not None and rid in actual else None),
                    "cancelled_downstream": canc_down,
                    "outcome_unknown": outcome_unknown,
                    "actual_flight_time": ft_actual,
                    "margin_median": (mg.get("median") or {}).get(rid, np.nan),
                    "margin_upper": (mg.get("upper") or {}).get(rid, np.nan),
                    "margin_naive": (mg.get("naive") or {}).get(rid, np.nan),
                    "margin_carried": (mg.get("carried") or {}).get(rid, np.nan),
                })
            for a in alerts:
                leads.append({"date": date, "profile": profile_name, "crew_model": crew_model,
                              "seed_on": seed_on,
                              "tail": tail, "rule_id": a["rule_id"], "severity": a["severity"],
                              "watch_reason": a.get("watch_reason"),
                              "usable_lead_min": a["usable_lead_minutes"], "status": a["status"]})
    return rows, leads, mism


# -------------------------------------------------------------- tables --
ROW_ORDER = [LIKELY, WATCH, "NO_ALERT"]


def confusion(df: pd.DataFrame, method: str) -> pd.DataFrame:
    """Severity row x outcome column, for applicable crews where the rule was evaluated."""
    d = df[df["status"].isin(APPLICABLE) & df["rule_evaluated"]].copy()
    if method == "naive":
        d = d[d["naive"].notna()]
        d["row"] = np.where(d["naive"].astype(bool), "ALERT", "NO_ALERT")
    else:
        d["row"] = d[method].fillna("NO_ALERT")
    d["col"] = np.select(
        [d["cancelled_downstream"], d["outcome_unknown"] | d["actual_breach"].isna(),
         d["actual_breach"].fillna(False).astype(bool)],
        ["cancelled_downstream", "outcome_unknown", "actual_breach"], default="actual_no_breach")
    t = d.groupby(["rule_id", "row", "col"]).size().unstack("col", fill_value=0)
    for c in ("actual_breach", "actual_no_breach", "cancelled_downstream", "outcome_unknown"):
        if c not in t.columns:
            t[c] = 0
    return t[["actual_breach", "actual_no_breach", "cancelled_downstream", "outcome_unknown"]].reset_index()


def metrics(t: pd.DataFrame, method: str) -> pd.DataFrame:
    out = []
    for rid, g in t.groupby("rule_id"):
        g = g.set_index("row")
        def get(row, col):
            return int(g.loc[row, col]) if row in g.index else 0
        breaches = int(g["actual_breach"].sum())
        if method == "naive":
            tp, fp = get("ALERT", "actual_breach"), get("ALERT", "actual_no_breach")
            out.append({"rule_id": rid, "method": method, "alerts_scored": tp + fp,
                        "precision_likely": tp / (tp + fp) if tp + fp else np.nan,
                        "precision_likely_possible": tp / (tp + fp) if tp + fp else np.nan,
                        "recall_any_alert": tp / breaches if breaches else np.nan,
                        "recall_likely": tp / breaches if breaches else np.nan,
                        "actual_breaches": breaches,
                        "base_rate": breaches / (breaches + int(g["actual_no_breach"].sum()))
                        if breaches + int(g["actual_no_breach"].sum()) else np.nan})
            continue
        l_tp, l_fp = get(LIKELY, "actual_breach"), get(LIKELY, "actual_no_breach")
        p_tp, p_fp = get(WATCH, "actual_breach"), get(WATCH, "actual_no_breach")
        m_tp = 0                                      # MONITOR merged into WATCH
        nb = int(g["actual_no_breach"].sum())
        out.append({"rule_id": rid, "method": method, "alerts_scored": l_tp + l_fp + p_tp + p_fp,
                    "precision_likely": l_tp / (l_tp + l_fp) if l_tp + l_fp else np.nan,
                    "precision_likely_possible": (l_tp + p_tp) / (l_tp + l_fp + p_tp + p_fp)
                    if l_tp + l_fp + p_tp + p_fp else np.nan,
                    "recall_any_alert": (l_tp + p_tp + m_tp) / breaches if breaches else np.nan,
                    "recall_likely": l_tp / breaches if breaches else np.nan,
                    "actual_breaches": breaches,
                    "base_rate": breaches / (breaches + nb) if breaches + nb else np.nan})
    return pd.DataFrame(out)


def naive_comparison(df: pd.DataFrame) -> pd.DataFrame:
    """Engine vs naive rule at MATCHED recall, on identical rows.

    Rows: applicable, seeded, rule evaluated, outcome known, not cancelled, and the
    engine has a number for the last leg (rows that can only be WATCH beyond_depth_2 are
    excluded for both methods). The naive rule's recall R is measured; the engine's
    median margin is then thresholded at the strictest cut that still reaches recall
    >= R, and its precision there is reported. Also reported: the engine's deployed
    alert operating point (LIKELY + WATCH upper_bound_only) on the same rows.
    """
    d = df[df["status"].isin(APPLICABLE) & df["rule_evaluated"] & df["seed_delay"].notna()
           & ~df["cancelled_downstream"] & df["actual_breach"].notna()
           & df["margin_median"].notna() & df["margin_naive"].notna()]
    out = []
    for (prof, rid), g in d.groupby(["profile", "rule_id"]):
        y = g["actual_breach"].astype(bool).values
        if y.sum() == 0:
            continue
        naive_alert = g["margin_naive"].values > 0
        r_n = (naive_alert & y).sum() / y.sum()
        p_n = (naive_alert & y).sum() / naive_alert.sum() if naive_alert.sum() else np.nan
        score = g["margin_median"].values
        order = np.argsort(-score)
        tp = np.cumsum(y[order])
        k = int(np.searchsorted(tp / y.sum(), r_n - 1e-12)) + 1     # fewest alerts reaching r_n
        k = min(k, len(order))
        p_e = tp[k - 1] / k
        eng_alert = (g["engine"].isin([LIKELY, WATCH])).values
        r_e = (eng_alert & y).sum() / y.sum()
        # the other direction: naive margin thresholded to reach the ENGINE's recall
        on = np.argsort(-g["margin_naive"].values)
        tpn = np.cumsum(y[on])
        kn = min(int(np.searchsorted(tpn / y.sum(), r_e - 1e-12)) + 1, len(on))

        def avg_precision(score):
            o = np.argsort(-score)
            t = np.cumsum(y[o])
            return float(((t / np.arange(1, len(y) + 1)) * y[o]).sum() / y.sum())

        out.append({"profile": prof, "rule_id": rid, "rows": len(g), "actual_breaches": int(y.sum()),
                    "naive_alerts": int(naive_alert.sum()), "naive_recall": r_n, "naive_precision": p_n,
                    "engine_alerts_at_matched_recall": k,
                    "engine_recall_at_match": tp[k - 1] / y.sum(),
                    "engine_precision_at_matched_recall": p_e,
                    "engine_LP_alerts": int(eng_alert.sum()),
                    "engine_LP_recall": (eng_alert & y).sum() / y.sum(),
                    "engine_LP_precision": (eng_alert & y).sum() / eng_alert.sum() if eng_alert.sum() else np.nan,
                    "engine_beats_naive_at_naive_recall": bool(p_e > p_n),
                    "naive_precision_at_engine_LP_recall": tpn[kn - 1] / kn,
                    "engine_LP_beats_naive_at_engine_recall": bool(
                        ((eng_alert & y).sum() / eng_alert.sum() if eng_alert.sum() else 0) > tpn[kn - 1] / kn),
                    "avg_precision_engine_median": avg_precision(g["margin_median"].values),
                    "avg_precision_naive": avg_precision(g["margin_naive"].values)})
    return pd.DataFrame(out)


def cancellation_test(df: pd.DataFrame) -> pd.DataFrame:
    """Downstream-cancellation rate, flagged vs unflagged applicable seeded days, by seed bucket."""
    d = df[df["status"].isin(APPLICABLE) & df["seed_delay"].notna()]
    day = d.groupby(["profile", "date", "tail"]).agg(
        flagged=("engine", lambda s: s.notna().any()),
        cancelled=("cancelled_downstream", "max"),
        seed_delay=("seed_delay", "first")).reset_index()
    day["seed_bucket"] = pd.cut(day["seed_delay"], [15, 60, 120, np.inf], right=False,
                                labels=["15-60", "60-120", "120+"])
    t = (day.groupby(["profile", "seed_bucket", "flagged"], observed=True)
         .agg(days=("cancelled", "size"), cancelled_downstream=("cancelled", "sum")).reset_index())
    t["cancel_rate"] = t["cancelled_downstream"] / t["days"]
    return t


# ---------------------------------------------------------------- main --
def severity_calibration(rec: pd.DataFrame) -> pd.DataFrame:
    """Observed breach rate inside each severity bucket: deployed vs proposed labels."""
    out = []
    sub = rec[rec["crew_model"] == "single"]
    for prof in PROFILES:
        for method in ("engine", "proposed"):
            t = confusion(sub[sub["profile"] == prof], method)
            for _, r in t.iterrows():
                scored = r["actual_breach"] + r["actual_no_breach"]
                out.append({"profile": prof, "labels": "deployed" if method == "engine" else "proposed",
                            "rule_id": r["rule_id"], "severity": r["row"],
                            "actual_breach": int(r["actual_breach"]),
                            "actual_no_breach": int(r["actual_no_breach"]),
                            "cancelled_downstream": int(r["cancelled_downstream"]),
                            "outcome_unknown": int(r["outcome_unknown"]),
                            "observed_breach_rate": r["actual_breach"] / scored if scored else np.nan})
    return pd.DataFrame(out)


def lead_summary(leads: pd.DataFrame) -> pd.DataFrame:
    out = []
    s = leads[leads["crew_model"] == "single"]
    for (prof, rid), g in list(s.groupby(["profile", "rule_id"])) +             [((p, "ALL_CREW_RULES"), g) for p, g in s.groupby("profile")]:
        v = g["usable_lead_min"].dropna()
        out.append({"profile": prof, "rule_id": rid, "alerts": int(len(g)), "with_lead": int(len(v)),
                    "min": v.min(), "p10": v.quantile(0.1), "median": v.median(), "p90": v.quantile(0.9),
                    "share_lead_le_0": float((v <= 0).mean()) if len(v) else np.nan,
                    "deadline_passed": int((g["status"] == "deadline_passed").sum())})
    return pd.DataFrame(out)


def actionable_metrics(rec: pd.DataFrame, leads: pd.DataFrame) -> pd.DataFrame:
    """What a crew scheduler actually gets: only alerts that were still actionable
    (deadline after the seed's actual arrival) count as caught."""
    r = rec[(rec["crew_model"] == "single") & rec["status"].isin(APPLICABLE) & rec["rule_evaluated"]
            & ~rec["cancelled_downstream"] & rec["actual_breach"].notna()]
    lt = (leads[leads["crew_model"] == "single"]
          .groupby(["profile", "date", "tail", "rule_id"])
          .agg(lead=("usable_lead_min", "first"), alert_status=("status", "first")).reset_index())
    d = r.merge(lt, on=["profile", "date", "tail", "rule_id"], how="left")
    out = []
    groups = list(d.groupby(["profile", "rule_id"])) + [((p, "ALL_CREW_RULES"), g) for p, g in d.groupby("profile")]
    for (prof, rid), g in groups:
        y = g["actual_breach"].astype(bool)
        act = g["alert_status"].eq("actionable")
        lik, lp = g["engine"].eq(LIKELY), g["engine"].isin([LIKELY, WATCH])
        out.append({"profile": prof, "rule_id": rid, "actual_breaches": int(y.sum()),
                    "likely_alerts": int(lik.sum()), "likely_actionable": int((lik & act).sum()),
                    "precision_likely": (lik & y).sum() / lik.sum() if lik.sum() else np.nan,
                    "precision_likely_actionable": (lik & act & y).sum() / (lik & act).sum()
                    if (lik & act).sum() else np.nan,
                    "recall_any_alert": (g["engine"].notna() & y).sum() / y.sum() if y.sum() else np.nan,
                    # any alert (LIKELY or WATCH) whose deadline was still ahead
                    "recall_actionable": (lp & act & y).sum() / y.sum() if y.sum() else np.nan,
                    "recall_likely_actionable": (lik & act & y).sum() / y.sum() if y.sum() else np.nan,
                    "recall_any_actionable": (g["engine"].notna() & act & y).sum() / y.sum()
                    if y.sum() else np.nan})
    return pd.DataFrame(out)


SEED_MODES = ("arrival", "departure")


def build_tables(rec: pd.DataFrame, leads: pd.DataFrame, dates: list) -> None:
    """Every output table, per seed mode (column `seed_on`)."""
    summary, tabs = [], {p: [] for p in PROFILES}
    naive_t, act_t, lead_t, cal_t, canc_t = [], [], [], [], []
    for seed_on in SEED_MODES:
        rs, ls = rec[rec["seed_on"] == seed_on], leads[leads["seed_on"] == seed_on]
        if rs.empty:
            continue
        for prof in PROFILES:
            for model in ("single", "inferred_blocks"):
                sub = rs[(rs["profile"] == prof) & (rs["crew_model"] == model)]
                if sub.empty:
                    continue
                scope = "all_test_dates" if model == "single" else "3_dates"
                for method in ("engine", "naive", "proposed"):
                    t = confusion(sub, method)
                    for col, v in (("method", method), ("crew_model", model), ("scope", scope),
                                   ("seed_on", seed_on)):
                        t.insert(0, col, v)
                    tabs[prof].append(t)
                    m = metrics(confusion(sub, method), method)
                    for col, v in (("crew_model", model), ("profile", prof), ("scope", scope),
                                   ("seed_on", seed_on)):
                        m.insert(0, col, v)
                    summary.append(m)
                if model == "single":
                    s3 = sub[sub["date"].isin(INFERRED_DATES)]
                    m = metrics(confusion(s3, "engine"), "engine")
                    for col, v in (("crew_model", model), ("profile", prof), ("scope", "3_dates"),
                                   ("seed_on", seed_on)):
                        m.insert(0, col, v)
                    summary.append(m)
        single = rs[rs["crew_model"] == "single"]
        for lst, t in ((naive_t, naive_comparison(single)), (act_t, actionable_metrics(rs, ls)),
                       (lead_t, lead_summary(ls)), (cal_t, severity_calibration(rs)),
                       (canc_t, cancellation_test(single))):
            t.insert(0, "seed_on", seed_on)
            lst.append(t)
    for prof in PROFILES:
        pd.concat(tabs[prof]).to_csv(OUT / f"backtest_{SHORT[prof]}.csv", index=False)
    pd.concat(summary, ignore_index=True).to_csv(OUT / "backtest_summary.csv", index=False)
    pd.concat(naive_t).to_csv(OUT / "naive_comparison.csv", index=False)
    pd.concat(act_t).to_csv(OUT / "actionable_metrics.csv", index=False)
    pd.concat(lead_t).to_csv(OUT / "lead_time_summary.csv", index=False)
    pd.concat(cal_t).to_csv(OUT / "severity_calibration.csv", index=False)
    pd.concat(canc_t).to_csv(OUT / "cancellation_test.csv", index=False)
    leads.to_csv(OUT / "lead_time.csv", index=False)

    # inferred-block coverage (arrival seeding, 3 dates)
    cov = []
    ra, la = rec[rec["seed_on"] == "arrival"], leads[leads["seed_on"] == "arrival"]
    for prof in PROFILES:
        for date in INFERRED_DATES:
            for model in ("single", "inferred_blocks"):
                s_ = ra[(ra["profile"] == prof) & (ra["date"] == date) & (ra["crew_model"] == model)]
                if s_.empty:
                    continue
                crews = s_.drop_duplicates(["tail", "block"])
                days = crews.groupby("tail")["status"].apply(lambda x: (x != "proxy_not_applicable").any())
                ld = la[(la["profile"] == prof) & (la["date"] == date) & (la["crew_model"] == model)]
                cov.append({"profile": prof, "date": date, "crew_model": model,
                            "aircraft_days": int(len(days)), "covered": int(days.sum()),
                            "coverage_share": round(float(days.mean()), 4),
                            "crews_evaluated": int((crews["status"] != "proxy_not_applicable").sum()),
                            "alerts": int(len(ld)),
                            "likely": int((ld["severity"] == LIKELY).sum()),
                            "watch": int((ld["severity"] == WATCH).sum())})
    if cov:
        pd.DataFrame(cov).to_csv(OUT / "inferred_blocks_coverage.csv", index=False)


def _ordering_rows(d: pd.DataFrame, kind: str, t: float) -> dict:
    """Observed breach rate per severity after demoting weak POSSIBLE alerts to MONITOR.
    kind 'U': demote when the upper bound crosses by < t min.
    kind 'T': demote when the median sits more than t min below the limit."""
    lab = d["engine"].copy()
    lab[lab.eq(WATCH) & d["engine_watch_reason"].eq(UPPER_BOUND_ONLY)] = POSSIBLE
    lab[lab.eq(WATCH) & d["engine_watch_reason"].eq(BEYOND_DEPTH_2)] = MONITOR
    weak = d["margin_upper"] < t if kind == "U" else d["margin_median"] < -t
    lab[lab.eq(POSSIBLE) & weak] = MONITOR
    r = {"kind": kind, "threshold_min": t}
    for prof, g in d.assign(lab=lab).groupby("profile"):
        for sev in (LIKELY, POSSIBLE, MONITOR):
            m = g["lab"].eq(sev)
            r[f"{prof}_{sev}_n"] = int(m.sum())
            r[f"{prof}_{sev}_rate"] = float(g["y"][m].mean()) if m.sum() else np.nan
        r[f"{prof}_gap_P_minus_M"] = r[f"{prof}_{POSSIBLE}_rate"] - r[f"{prof}_{MONITOR}_rate"]
        r[f"{prof}_monotone"] = bool(r[f"{prof}_{LIKELY}_rate"] > r[f"{prof}_{POSSIBLE}_rate"]
                                     > r[f"{prof}_{MONITOR}_rate"])
    return r


def severity_ordering(seed_on: str) -> int:
    """Part 2 of the early-seeding brief. Threshold CHOSEN on validation records only,
    then checked once on test. Selection rule: maximise the smaller of the two
    profiles' (POSSIBLE - MONITOR) breach-rate gap on validation."""
    def prep(path):
        r = pd.read_parquet(path)
        r = r[(r["crew_model"] == "single") & (r["seed_on"] == seed_on) & r["status"].isin(APPLICABLE)
              & r["rule_evaluated"] & ~r["cancelled_downstream"] & r["actual_breach"].notna()
              & r["engine"].notna()].copy()
        r["y"] = r["actual_breach"].astype(bool)
        return r
    val, test = prep(OUT / "backtest_records_validation.parquet"), prep(OUT / "backtest_records.parquet")
    grid = [("U", t) for t in (0, 5, 10, 15, 20, 25, 30, 40, 50, 60)] +            [("T", t) for t in (0, 10, 20, 30, 45, 60, 90, 120)]
    scan = pd.DataFrame([_ordering_rows(val, k, t) for k, t in grid])
    gaps = scan[[c for c in scan.columns if c.endswith("_gap_P_minus_M")]].min(axis=1)
    best = scan.loc[gaps.idxmax()]
    scan.insert(0, "split", "validation")
    scan.to_csv(OUT / "severity_ordering_validation.csv", index=False)
    chk = pd.DataFrame([{**_ordering_rows(test, "U", 0), "labels": "deployed"},
                        {**_ordering_rows(test, best["kind"], best["threshold_min"]),
                         "labels": f"proposed {best['kind']}={best['threshold_min']}"}])
    chk.insert(0, "split", "test")
    chk.to_csv(OUT / "severity_ordering_test.csv", index=False)
    prop = chk.iloc[1]
    apply = all(prop[f"{p}_monotone"] and prop[f"{p}_{LIKELY}_rate"] >= 0.80 for p in PROFILES)
    print(f"chosen on validation: {best['kind']}={best['threshold_min']} min "
          f"(min gap {gaps.max():+.3f}); on test monotone for both profiles with LIKELY>=0.80: {apply}")
    return 0


def three_band() -> pd.DataFrame:
    """LIKELY / WATCH / no alert: observed breach rate on validation AND test, both
    profiles, both seed modes. WATCH is also split by watch_reason for information."""
    out = []
    for split, path in (("validation", OUT / "backtest_records_validation.parquet"),
                        ("test", OUT / "backtest_records.parquet")):
        r = pd.read_parquet(path)
        r = r[(r["crew_model"] == "single") & r["status"].isin(APPLICABLE) & r["rule_evaluated"]
              & ~r["cancelled_downstream"] & r["actual_breach"].notna()]
        for (seed_on, prof), g in r.groupby(["seed_on", "profile"]):
            y = g["actual_breach"].astype(bool)
            row = {"split": split, "seed_on": seed_on, "profile": prof}
            bands = {"LIKELY": g["engine"].eq(LIKELY), "WATCH": g["engine"].eq(WATCH),
                     "NO_ALERT": g["engine"].isna(),
                     "WATCH_upper_bound_only": g["engine_watch_reason"].eq(UPPER_BOUND_ONLY),
                     "WATCH_beyond_depth_2": g["engine_watch_reason"].eq(BEYOND_DEPTH_2)}
            for k, m in bands.items():
                row[f"{k}_n"] = int(m.sum())
                row[f"{k}_breaches"] = int((m & y).sum())
                row[f"{k}_rate"] = float(y[m].mean()) if m.sum() else np.nan
            row["monotone_L_gt_W_gt_none"] = bool(row["LIKELY_rate"] > row["WATCH_rate"] > row["NO_ALERT_rate"])
            out.append(row)
    t = pd.DataFrame(out)
    t.to_csv(OUT / "three_band.csv", index=False)
    return t


ALERT_SETS = {
    "a_likely_only": "LIKELY only",
    "b_likely_plus_watch_upper": "LIKELY + WATCH upper_bound_only",
    "c_all_alerts": "all alerts (incl. WATCH beyond_depth_2)",
}


def recall_precision_sets(seed_on: str = "departure", rule_id: str = "crew_fdp_limit") -> pd.DataFrame:
    """Actionable FDP recall and precision for three nested alert sets, both profiles,
    validation and test. Every set is scored on the SAME rows (applicable, rule
    evaluated, outcome known, not cancelled downstream), so precision is matched.

    actionable_recall      breaches that got an alert in the set whose deadline was still
                           ahead when it fired / all breaches
    precision              breaches / alerts in the set (whether or not still actionable)
    actionable_precision   breaches / actionable alerts in the set
    """
    out = []
    for split, rec_path, lead_path in (
            ("validation", OUT / "backtest_records_validation.parquet", OUT / "lead_time_validation.csv"),
            ("test", OUT / "backtest_records.parquet", OUT / "lead_time.csv")):
        r = pd.read_parquet(rec_path)
        r = r[(r["crew_model"] == "single") & (r["seed_on"] == seed_on) & (r["rule_id"] == rule_id)
              & r["status"].isin(APPLICABLE) & r["rule_evaluated"] & ~r["cancelled_downstream"]
              & r["actual_breach"].notna()]
        lt = pd.read_csv(lead_path)
        lt = (lt[(lt["crew_model"] == "single") & (lt["seed_on"] == seed_on) & (lt["rule_id"] == rule_id)]
              .groupby(["profile", "date", "tail"]).agg(alert_status=("status", "first")).reset_index())
        d = r.merge(lt, on=["profile", "date", "tail"], how="left")
        for prof, g in d.groupby("profile"):
            y = g["actual_breach"].astype(bool)
            act = g["alert_status"].eq("actionable")
            likely = g["engine"].eq(LIKELY)
            upper = g["engine"].eq(WATCH) & g["engine_watch_reason"].eq(UPPER_BOUND_ONLY)
            sets = {"a_likely_only": likely,
                    "b_likely_plus_watch_upper": likely | upper,
                    "c_all_alerts": g["engine"].notna()}
            for key, m in sets.items():
                n, na = int(m.sum()), int((m & act).sum())
                out.append({
                    "split": split, "seed_on": seed_on, "profile": prof, "rule_id": rule_id,
                    "alert_set": key, "alert_set_label": ALERT_SETS[key],
                    "actual_breaches": int(y.sum()), "alerts": n, "actionable_alerts": na,
                    "actionable_recall": float((m & act & y).sum() / y.sum()) if y.sum() else np.nan,
                    "precision": float((m & y).sum() / n) if n else np.nan,
                    "actionable_precision": float((m & act & y).sum() / na) if na else np.nan,
                })
    t = pd.DataFrame(out)
    t.to_csv(OUT / "recall_precision_sets.csv", index=False)
    return t


def tables_only() -> int:
    """Rebuild every table from the saved test-split records."""
    rec = pd.read_parquet(OUT / "backtest_records.parquet")
    leads = pd.read_csv(OUT / "lead_time.csv")
    if "seed_on" not in rec.columns:
        rec["seed_on"] = "arrival"
        leads["seed_on"] = "arrival"
    build_tables(rec, leads, sorted(rec["date"].unique()))
    if (OUT / "backtest_records_validation.parquet").exists():
        three_band()
        recall_precision_sets()
    return 0


def main() -> int:
    """--split test (default) | validation    --tables-only

    test        13 test dates, both seed modes, inferred blocks on 3 dates (arrival).
                Writes every table.
    validation  14 validation dates, both seed modes, single crew. Writes only
                backtest_records_validation.parquet - used to CHOOSE thresholds,
                never reported as a result.
    """
    if "--tables-only" in sys.argv:
        return tables_only()
    if "--severity-ordering" in sys.argv:
        return severity_ordering(feed.DEFAULT_SEED_ON)
    if "--recall-sets" in sys.argv:
        print(recall_precision_sets().to_string())
        return 0
    if "--three-band" in sys.argv:
        print(three_band().to_string())
        return 0
    split = "validation" if "validation" in sys.argv else "test"
    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    b = load_bundle()
    all_dates = pd.to_datetime(b.df["FL_DATE"].unique())
    if split == "test":
        dates = sorted(str(x.date()) for x in all_dates if x > pd.Timestamp(b.val_end))
    else:
        dates = sorted(str(x.date()) for x in all_dates
                       if pd.Timestamp(b.train_end) < x <= pd.Timestamp(b.val_end))
    print(f"{split.upper()} split: {dates[0]} .. {dates[-1]} ({len(dates)} dates). "
          f"Layer 4 trained on dates <= {pd.Timestamp(b.train_end).date()}.")
    canc = cancelled_index(b)
    sub = b.df[b.df["FL_DATE"].isin(pd.to_datetime(dates))]
    by_date = {d: g for d, g in sub.groupby("FL_DATE")}     # outcome lookups keyed (tail, leg)

    all_rows, all_leads, mismatches = [], [], 0
    for seed_on in SEED_MODES:
        for prof in PROFILES:
            for date in dates:
                g = by_date[pd.Timestamp(date)]
                ad = {(t, int(l)): v for t, l, v in zip(g["TAIL_NUM"], g["LEG_NUM"], g["ARR_DELAY"])}
                el = {(t, int(l)): v for t, l, v in zip(g["TAIL_NUM"], g["LEG_NUM"], g["ACTUAL_ELAPSED_TIME"])}
                models = ["single"] + (["inferred_blocks"] if split == "test" and seed_on == "arrival"
                                       and date in INFERRED_DATES else [])
                for m in models:
                    r, l, mm = score_day(b, prof, date, m, ad, el, canc, seed_on)
                    all_rows += r
                    all_leads += l
                    mismatches += mm
            print(f"  {seed_on} {prof} done ({time.time() - t0:.0f}s)", flush=True)

    rec = pd.DataFrame(all_rows)
    leads = pd.DataFrame(all_leads)
    print(f"mirror check: {mismatches} engine/mirror severity mismatches (must be 0)")
    if split == "validation":
        rec.to_parquet(OUT / "backtest_records_validation.parquet", index=False)
        leads.to_csv(OUT / "lead_time_validation.csv", index=False)
    else:
        rec.to_parquet(OUT / "backtest_records.parquet", index=False)
        build_tables(rec, leads, dates)
        if (OUT / "backtest_records_validation.parquet").exists():
            three_band()
            recall_precision_sets()
        st = cancelled_stats(b)
        pd.DataFrame([{"test_dates": f"{dates[0]}..{dates[-1]}", "n_dates": len(dates),
                       "mirror_mismatches": mismatches, **st,
                       "default_seed_on": feed.DEFAULT_SEED_ON,
                       "runtime_s": round(time.time() - t0)}]).to_csv(OUT / "backtest_meta.csv", index=False)
    print(f"done in {time.time() - t0:.0f}s -> {OUT}")
    return 0 if mismatches == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
