"""Layer 5 rule engine: regulatory rules (as data) over Layer 4 predictions.

Rules live in rules/*.json with their source citation and a `verified` flag.
This module loads a profile, evaluates its rules against a propagation result,
and returns alerts. It contains no thresholds of its own.

Severity follows the Layer 4 confidence boundary. Two tiers (LAYER 5 WATCH TIER):
  depth 1-2   LIKELY  if the median prediction crosses the threshold
              WATCH   (watch_reason "upper_bound_only") if only the interval upper
                      bound crosses it
  depth 3+    WATCH   (watch_reason "beyond_depth_2") only - total_delay is null,
                      there is no number to compare and none is reported. Raised for
                      a rule only when it already triggered at a quantified hop
                      upstream in the same chain.
POSSIBLE and MONITOR were merged into WATCH after the backtest showed their
observed breach rates could not be told apart (AUDIT_REPORT.md, LAYER 5 WATCH TIER).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Optional

import pandas as pd

from .. import config
from . import crew, tz as tzu
from .crew import BEYOND_DEPTH_2, LIKELY, SEVERITY_RANK, UPPER_BOUND_ONLY, WATCH, Leg, LegDelay

RULES_DIR = Path(__file__).resolve().parent / "rules"
DEFAULT_PROFILE = "faa_part117"

ACTIONS = {
    "crew_fdp_limit": "Call out a standby crew at {station} to take over {flight}",
    "crew_fdp_extension_limit": "Crew change required before {flight}: projected duty exceeds the limit even with the maximum extension",
    "crew_duty_period_limit": "Call out a standby crew at {station}: projected duty period exceeds the limit",
    "crew_min_rest": "Protect the next-day first departure from {station}: plan a rested crew",
    "pax_dot_significant_delay": "Proactively offer refund or rebooking on {flight} (significant delay)",
    "pax_meals_refreshments": "Arrange meals and refreshments for {flight} passengers",
    "pax_alternate_or_refund": "Offer an alternate flight within 6 h or a full refund on {flight}",
    "pax_hotel_accommodation": "Arrange hotel accommodation and transfers for {flight} passengers",
}


# ---------------------------------------------------------------- profiles --
@lru_cache(maxsize=None)
def load_profile(name: str) -> dict:
    path = RULES_DIR / f"{name}.json"
    if not path.is_file() or path.parent != RULES_DIR:
        raise KeyError(f"unknown rule profile {name!r}; available: {list_profiles()}")
    p = json.loads(path.read_text(encoding="utf-8"))
    ids = [r["id"] for r in p["rules"]]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{name}: duplicate rule ids")
    for r in p["rules"]:
        for k in ("id", "description", "threshold", "unit", "source", "verified", "notes",
                  "comparator", "kind", "category"):
            if k not in r:
                raise ValueError(f"{name}: rule {r.get('id')} missing {k!r}")
    return p


def list_profiles() -> list[str]:
    return sorted(p.stem for p in RULES_DIR.glob("*.json"))


def unverified(profile: dict) -> dict:
    return {
        "rules": [r["id"] for r in profile["rules"] if not r["verified"]],
        "assumptions": [k for k, v in profile["proxy"].items() if not v.get("verified", False)],
    }


def disclosure(profile: dict) -> str:
    return (f"Rules sourced from {profile['name']}. {crew.PROXY_DISCLOSURE}")


# ------------------------------------------------------------ data inputs --
def legs_from_rows(rows: pd.DataFrame) -> list[Leg]:
    rows = rows.sort_values("LEG_NUM")
    dep, arr = tzu.scheduled_utc(rows)
    return [
        Leg(int(r.LEG_NUM), f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}",
            str(r.ORIGIN), str(r.DEST), dep.loc[i], arr.loc[i], float(r.CRS_ELAPSED_TIME or 0))
        for i, r in zip(rows.index, rows.itertuples())
    ]


def delays_from_hops(hops: list[dict], seed_leg: int, observed_arrival_delay: float,
                     recovery_rate: float) -> dict[int, LegDelay]:
    """Layer 4 hops -> per-leg predicted delays.

    total_delay is the predicted DEPARTURE delay of a hop's leg. Its arrival delay
    is total x recovery_rate - the same departure->arrival step Layer 4 uses to
    seed the next hop (propagation.traverse).
    """
    out = {seed_leg: LegDelay(depth=0, quantified=True, arr_med=float(observed_arrival_delay),
                              arr_up=float(observed_arrival_delay), observed=True)}
    for h in hops:
        q = h["total_delay"] is not None
        hi = h["interval_high"] if h["interval_high"] is not None else h["total_delay"]
        lo = h.get("interval_low")
        lo = lo if lo is not None else h["total_delay"]
        out[int(h["leg_num"])] = LegDelay(
            depth=int(h["depth"]), quantified=q,
            dep_med=h["total_delay"] if q else None,
            dep_up=hi if q else None,
            arr_med=h["total_delay"] * recovery_rate if q else None,
            arr_up=hi * recovery_rate if q else None,
            dep_low=lo if q else None,
            arr_low=lo * recovery_rate if q else None,
        )
    return out


def next_day_first_leg(df: pd.DataFrame, tail: str, date: pd.Timestamp) -> Optional[Leg]:
    nd = df[(df["TAIL_NUM"] == tail) & (df["FL_DATE"] == date + pd.Timedelta(days=1))]
    if nd.empty:
        return None
    return legs_from_rows(nd.nsmallest(1, "LEG_NUM"))[0]


# --------------------------------------------------- passenger thresholds --
def pax_threshold(rule: dict, leg: Leg) -> float:
    t = rule["threshold"]
    if isinstance(t, (int, float)):
        return float(t)
    if t["type"] == "by_block_time":
        for row in t["rows"]:
            if row["max_block_minutes"] is None or leg.block_min <= row["max_block_minutes"]:
                return float(row["delay_minutes"])
    if t["type"] == "by_departure_window":
        hhmm = tzu.local_hhmm(leg.dep_utc, leg.origin)
        start, end = (int(x) for x in t["window_local"])
        in_window = hhmm >= start or hhmm < end      # 20:00 .. 02:59 wraps midnight
        return float(t["window_minutes"] if in_window else t["default_minutes"])
    raise ValueError(f"{rule['id']}: unknown threshold {t!r}")


def evaluate_passenger(profile: dict, hops: list[dict], legs: dict[int, Leg],
                       recovery_rate: float) -> list[dict]:
    """Passenger-facilitation rules, one draft per (rule, hop) that triggers."""
    rules = [r for r in profile["rules"] if r["category"] == "passenger"]
    drafts, triggered = [], set()
    for h in sorted(hops, key=lambda h: h["depth"]):
        leg = legs.get(int(h["leg_num"]))
        if leg is None:
            continue
        quantified = h["total_delay"] is not None and h["depth"] <= config.CONFIDENCE_DEPTH
        for r in rules:
            thr = pax_threshold(r, leg)
            factor = recovery_rate if r["kind"] == "pax_arrival_delay" else 1.0
            if quantified:
                med = h["total_delay"] * factor
                hi = (h["interval_high"] if h["interval_high"] is not None else h["total_delay"]) * factor
                if crew.crosses(med, thr, r["comparator"]):
                    sev, val, basis, why = LIKELY, med, "median prediction", None
                elif crew.crosses(hi, thr, r["comparator"]):
                    sev, val, basis, why = WATCH, hi, "interval upper bound", UPPER_BOUND_ONLY
                else:
                    continue
                triggered.add(r["id"])
            else:
                # Past the confidence boundary: no number exists. WATCH only,
                # and only for a rule the quantified part of the chain already hit.
                if r["id"] not in triggered:
                    continue
                sev, val, basis, why = (WATCH, None, "no number: past the depth-2 confidence boundary",
                                        BEYOND_DEPTH_2)
            drafts.append({
                "rule": r, "severity": sev, "watch_reason": why, "value": val, "basis": basis,
                "threshold": thr,
                "leg": leg, "depth": int(h["depth"]),
                "deadline_utc": leg.dep_utc, "deadline_station": leg.origin,
                "detail": (f"predicted {'arrival' if factor != 1.0 else 'departure'} delay "
                           f"{val:.0f} min vs {thr:.0f} min" if val is not None else
                           f"this rule triggered upstream; the model cannot quantify depth {h['depth']}"),
            })
    return drafts


# ------------------------------------------------------------- the alerts --
class AlertRegistry:
    """Stable integer ids for alerts so an operator can act on one by number.

    In-memory, process-local. The same alert (same profile, day, aircraft, rule,
    leg, context) keeps its id across repeated requests.
    """

    def __init__(self):
        self._lock = Lock()
        self._ids: dict[str, int] = {}
        self._alerts: dict[int, dict] = {}

    def register(self, key: str, alert: dict) -> dict:
        with self._lock:
            aid = self._ids.setdefault(key, len(self._ids) + 1)
            alert["id"] = aid
            self._alerts[aid] = alert
        return alert

    def get(self, aid: int) -> Optional[dict]:
        return self._alerts.get(aid)


REGISTRY = AlertRegistry()


def _iso(ts) -> Optional[str]:
    return None if ts is None or pd.isna(ts) else pd.Timestamp(ts).isoformat()


def make_alert(profile: dict, rule: dict, *, severity: str, value, basis: str, threshold: float,
               tail: str, date: str, leg: Optional[Leg], depth: Optional[int],
               deadline_utc, deadline_station: Optional[str], detail: str, context: str,
               usable_lead_min: Optional[float] = None, deadline_passed: bool = False,
               crew_model: str = "single", duty_block: Optional[dict] = None,
               watch_reason: Optional[str] = None) -> dict:
    flight = None
    if leg is not None:
        flight = {"flight_number": leg.flight_number, "leg_num": leg.leg_num,
                  "origin": leg.origin, "dest": leg.dest, "depth": depth,
                  "scheduled_dep_local": tzu.fmt_local(leg.dep_utc, leg.origin)}
    station = deadline_station or (leg.origin if leg else None)
    is_crew = rule["category"] == "crew"
    fl = leg.flight_number if leg else tail
    alert = {
        "rule_id": rule["id"],
        "category": rule["category"],
        "severity": severity,
        # WATCH only: "upper_bound_only" (a number, from the interval's upper bound) or
        # "beyond_depth_2" (no number - past the Layer 4 confidence boundary).
        "watch_reason": watch_reason if severity == WATCH else None,
        "profile": profile["profile"],
        "profile_name": profile["short_name"],
        "tail": tail,
        "date": date,
        "flight": flight,
        "predicted_value_minutes": None if value is None else round(float(value), 1),
        "predicted_basis": basis,
        "threshold_minutes": round(float(threshold), 1),
        "comparator": rule["comparator"],
        "margin_minutes": None if value is None else round(float(value) - float(threshold), 1),
        "description": rule["description"],
        "detail": detail,
        "action": ACTIONS.get(rule["id"], rule["description"]).format(station=station, flight=fl),
        "source": rule["source"],
        "verified": bool(rule["verified"]),
        "deadline_utc": _iso(deadline_utc),
        "deadline_local": tzu.fmt_local(deadline_utc, station) if station else None,
        "deadline_station": station,
        "crew_proxy": is_crew,
        "proxy_disclosure": crew.PROXY_DISCLOSURE if is_crew else None,
        # "deadline_passed": the deadline was already behind us when the information
        # (the seed leg's actual arrival) existed. Shown, but nobody can act on it.
        "status": "deadline_passed" if deadline_passed else "actionable",
        "usable_lead_minutes": None if usable_lead_min is None else round(float(usable_lead_min), 1),
        "crew_model": crew_model if is_crew else None,
        "duty_block": duty_block,
    }
    block_key = duty_block["index"] if duty_block else "-"
    key = "|".join(str(x) for x in (profile["profile"], date, tail, rule["id"],
                                     leg.leg_num if leg else "-", context, crew_model, block_key))
    return REGISTRY.register(key, alert)


def crew_alerts(profile: dict, proj: crew.CrewProjection, legs: list[Leg], delays: dict,
                tail: str, date: str, context: str, crew_model: str = "single",
                duty_block: Optional[dict] = None) -> list[dict]:
    rules = {r["id"]: r for r in profile["rules"]}
    out = []
    for a in proj.alerts:
        d = delays.get(a.breach_leg.leg_num) if a.breach_leg else None
        out.append(make_alert(
            profile, rules[a.rule_id], severity=a.severity, value=a.value, basis=a.basis,
            threshold=a.threshold, tail=tail, date=date, leg=a.breach_leg,
            depth=d.depth if d else None, deadline_utc=a.deadline_utc,
            deadline_station=a.deadline_station, detail=a.detail, context=context,
            usable_lead_min=a.usable_lead_min, deadline_passed=a.deadline_passed,
            crew_model=crew_model, duty_block=duty_block, watch_reason=a.watch_reason))
    return out


def block_info(index: int, count: int, block: list[Leg]) -> dict:
    return {"index": index, "count": count, "first_leg": block[0].leg_num,
            "last_leg": block[-1].leg_num, "label": crew.INFERRED_LABEL}


def projection_dict(proj: crew.CrewProjection, legs: list[Leg]) -> dict:
    st = proj.report_station
    def loc(ts, where):
        return tzu.fmt_local(ts, where) if ts is not None and where else None
    last = legs[-1] if legs else None
    return {
        "status": proj.status,
        "status_reason": proj.status_reason,
        "report_time_utc": _iso(proj.report_utc),
        "report_time_local": loc(proj.report_utc, st),
        "report_station": st,
        "segments": proj.segments,
        "scheduled_block_minutes": round(proj.scheduled_block_min, 1),
        "fdp_limit_minutes": proj.fdp_limit_projected or proj.fdp_limit_scheduled,
        "fdp_scheduled_minutes": None if proj.fdp_scheduled is None else round(proj.fdp_scheduled, 1),
        "fdp_projected_median_minutes": None if proj.fdp_projected_median is None else round(proj.fdp_projected_median, 1),
        "fdp_projected_upper_minutes": None if proj.fdp_projected_upper is None else round(proj.fdp_projected_upper, 1),
        "duty_end_median_utc": _iso(proj.duty_end_median_utc),
        "duty_end_median_local": loc(proj.duty_end_median_utc, last.dest if last else None),
        "duty_end_station": last.dest if last else None,
        "last_leg_quantified": proj.last_leg_quantified,
        "next_report_utc": _iso(proj.next_report_utc),
        "disclosure": proj.disclosure,
    }


def sort_alerts(alerts: list[dict]) -> list[dict]:
    return sorted(alerts, key=lambda a: (a["deadline_utc"] or "9999", SEVERITY_RANK[a["severity"]]))


# ------------------------------------------------------------ crew models --
CREW_MODELS = ("single", "inferred_blocks")
_BASES: dict[int, dict] = {}


def carrier_bases(bundle) -> dict[str, set]:
    """Each carrier's top-10 origins by departures in the TRAINING dates.

    A stand-in for crew bases, used only by the experimental inferred-block model.
    Training dates only, so nothing about the test period leaks into the split.
    """
    if id(bundle) not in _BASES:
        tr = bundle.df[bundle.df["FL_DATE"] <= bundle.train_end]
        top = (tr.groupby("OP_UNIQUE_CARRIER")["ORIGIN"].value_counts()
               .groupby(level=0, group_keys=False).head(10))
        _BASES[id(bundle)] = {c: set(g.index.get_level_values(1))
                              for c, g in top.groupby(level=0)}
    return _BASES[id(bundle)]


def evaluate_crews(profile: dict, legs: list[Leg], delays: dict, seed_leg: Optional[int],
                   next_report_utc, next_station: Optional[str], crew_model: str,
                   bases: set, info_time_utc=None) -> list[tuple]:
    """Project crew duty under a crew model. Returns [(projection, duty_block|None, legs)].

    single           one hypothetical crew per aircraft-day (default)
    inferred_blocks  EXPERIMENTAL: fewest scheduled-legal blocks at invented split
                     points (crew.infer_blocks). The rest rule is not evaluated for
                     blocks - there is no basis for pairing a block with tomorrow.
    """
    if crew_model == "single":
        return [(crew.project_duty(profile, legs, delays, seed_leg, next_report_utc,
                                   next_station, info_time_utc=info_time_utc), None, legs)]
    if crew_model != "inferred_blocks":
        raise ValueError(f"unknown crew model {crew_model!r}")
    blocks = crew.infer_blocks(profile, legs, bases)
    if blocks is None:
        proj = crew.project_duty(profile, legs, delays, seed_leg)
        proj.status_reason = ("No legal split into inferred duty blocks exists (ground time >= 30 "
                              "min at one of the carrier's top-10 origins). " + proj.status_reason)
        return [(proj, None, legs)]
    seed_arrival = None
    if seed_leg is not None and seed_leg in delays and delays[seed_leg].observed:
        sl = next(l for l in legs if l.leg_num == seed_leg)
        seed_arrival = sl.arr_utc + pd.Timedelta(minutes=float(delays[seed_leg].arr_med))
    out = []
    for i, block in enumerate(blocks):
        nums = {l.leg_num for l in block}
        before_seed = seed_leg is not None and block[-1].leg_num < seed_leg
        bdel = {} if before_seed else {k: v for k, v in delays.items() if k in nums}
        bseed = seed_leg if seed_leg in nums else None
        proj = crew.project_duty(profile, block, bdel, bseed, None, None,
                                 seed_arrival_utc=None if before_seed else seed_arrival,
                                 info_time_utc=None if before_seed else info_time_utc)
        out.append((proj, block_info(i + 1, len(blocks), block), block))
    return out


# --------------------------------------------- POST /api/recommendations --
def recommend(bundle, profile_name: str, tail: str, date: str, leg_num: int,
              observed: float, chain: dict, departure_delay: Optional[float] = None) -> dict:
    """Evaluate a profile against one propagation result (propagation.traverse output).

    `observed` is the seed leg's arrival delay fed to Layer 4. When the seed was a
    departure delay, `observed` = departure_delay x recovery rate and lead times are
    measured from the leg's actual departure - identical to the departure-seeded feed.
    """
    profile = load_profile(profile_name)
    d = pd.Timestamp(date)
    rows = bundle.df[(bundle.df["TAIL_NUM"] == tail) & (bundle.df["FL_DATE"] == d)]
    legs = legs_from_rows(rows)
    by_num = {l.leg_num: l for l in legs}
    delays = delays_from_hops(chain["hops"], leg_num, observed, bundle.recovery_rate)

    nxt = next_day_first_leg(bundle.df, tail, d)
    report_buf = float(profile["proxy"]["report_buffer_minutes"]["value"])
    nxt_report = nxt.dep_utc - pd.Timedelta(minutes=report_buf) if nxt else None
    seed_leg = by_num.get(leg_num)
    info_time = None
    if departure_delay is not None and seed_leg is not None:
        info_time = seed_leg.dep_utc + pd.Timedelta(minutes=float(departure_delay))
    proj = crew.project_duty(profile, legs, delays, leg_num, nxt_report,
                             nxt.origin if nxt else None, info_time_utc=info_time)

    kind = "departure" if departure_delay is not None else "arrival"
    context = f"chain:{kind}:{leg_num}:{round(float(observed), 1)}"
    alerts = crew_alerts(profile, proj, legs, delays, tail, date, context)
    for p in evaluate_passenger(profile, chain["hops"], by_num, bundle.recovery_rate):
        alerts.append(make_alert(
            profile, p["rule"], severity=p["severity"], value=p["value"], basis=p["basis"],
            threshold=p["threshold"], tail=tail, date=date, leg=p["leg"], depth=p["depth"],
            deadline_utc=p["deadline_utc"], deadline_station=p["deadline_station"],
            detail=p["detail"], context=context, watch_reason=p["watch_reason"]))

    return {
        "seed": {
            "kind": kind,
            "input_minutes": float(departure_delay if departure_delay is not None else observed),
            "arrival_delay_used": round(float(observed), 2),
            "recovery_rate": round(float(bundle.recovery_rate), 4) if departure_delay is not None else None,
            "information_time_utc": _iso(proj.info_time_utc),
        },
        "profile": profile["profile"],
        "profile_name": profile["name"],
        "disclosure": disclosure(profile),
        "unverified": unverified(profile),
        "crew_projection": projection_dict(proj, legs),
        "alerts": sort_alerts(alerts),
    }
