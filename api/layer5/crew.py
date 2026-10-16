"""Crew duty projection - the explicit, documented proxy.

Airlines do not publish crew rosters, so nobody outside the airline knows which
crew flies which leg. This module therefore projects the duty of a HYPOTHETICAL
crew that stays with one aircraft for its whole operating day:

  report time      = first leg's scheduled departure - report buffer
  FDP end          = last leg's PREDICTED block-in (Layer 4 output)
  duty end         = FDP end + post-flight buffer

Both buffers are carrier-defined in reality (14 CFR 117.3 'Report time'; DGCA
CAR 7-J-III paras 3.14, 4.1.1, 4.1.2) and are read from the rule profile, where
they are labelled as assumptions.

Every result carries PROXY_DISCLOSURE. Nothing here may be presented as
knowledge of an actual crew assignment.

Confidence boundary: a leg the propagation model cannot quantify (depth 3+,
total_delay null) never produces a LIKELY crew alert. If the last leg of the day
is unquantified, the crew rules can only return WATCH (reason beyond_depth_2), and
that alert carries no predicted value.

Two severity tiers (LAYER 5 WATCH TIER):
  LIKELY  the median prediction crosses the limit
  WATCH   upper_bound_only  - only the interval upper bound crosses
          beyond_depth_2    - the last leg is past the confidence boundary; the
                              quantified upstream delay would cross it
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

from . import tz as tzu

PROXY_DISCLOSURE = (
    "Crew duty is estimated from aircraft rotation because airline crew rosters "
    "are not public - alerts indicate risk, not confirmed crew assignments."
)

LIKELY, WATCH = "LIKELY", "WATCH"
UPPER_BOUND_ONLY, BEYOND_DEPTH_2 = "upper_bound_only", "beyond_depth_2"
SEVERITY_RANK = {LIKELY: 0, WATCH: 1}


# ------------------------------------------------------------------ types --
@dataclass
class Leg:
    """One scheduled leg, with times resolved to UTC."""
    leg_num: int
    flight_number: str
    origin: str
    dest: str
    dep_utc: pd.Timestamp          # scheduled departure
    arr_utc: pd.Timestamp          # scheduled block-in = dep + scheduled block
    block_min: float               # scheduled block time (BTS CRS_ELAPSED_TIME)


@dataclass
class LegDelay:
    """Predicted delay for one leg, in minutes.

    `quantified` is False for legs past the Layer 4 confidence boundary; their
    numbers are None and must never be compared against a threshold.
    """
    depth: Optional[int]           # hops downstream of the seed; 0 = the seed itself
    quantified: bool
    dep_med: Optional[float] = None
    dep_up: Optional[float] = None
    arr_med: Optional[float] = None
    arr_up: Optional[float] = None
    observed: bool = False         # the seed: arrival delay is a historical/user value
    dep_low: Optional[float] = None    # interval lower bound (inherited delay only)
    arr_low: Optional[float] = None


@dataclass
class CrewAlertDraft:
    rule_id: str
    severity: str
    value: Optional[float]         # predicted minutes compared to threshold; None beyond depth 2
    basis: str                     # "median" / "interval upper bound" / why there is no number
    threshold: float
    comparator: str
    breach_leg: Optional[Leg]
    deadline_utc: Optional[pd.Timestamp]
    deadline_station: Optional[str]
    detail: str
    # Minutes between the moment the information exists (seed leg's actual
    # arrival) and the action deadline. <= 0 means the alert fired too late.
    usable_lead_min: Optional[float] = None
    deadline_passed: bool = False
    watch_reason: Optional[str] = None     # set iff severity == WATCH


@dataclass
class CrewProjection:
    status: str                    # ok / at_risk / proxy_not_applicable / no_rotation
    status_reason: str
    report_utc: Optional[pd.Timestamp] = None
    report_station: Optional[str] = None
    segments: int = 0
    scheduled_block_min: float = 0.0
    fdp_limit_scheduled: Optional[float] = None
    fdp_scheduled: Optional[float] = None
    fdp_projected_median: Optional[float] = None
    fdp_projected_upper: Optional[float] = None
    fdp_limit_projected: Optional[float] = None
    duty_end_median_utc: Optional[pd.Timestamp] = None
    duty_end_upper_utc: Optional[pd.Timestamp] = None
    last_leg_quantified: bool = True
    next_report_utc: Optional[pd.Timestamp] = None
    seed_arrival_utc: Optional[pd.Timestamp] = None
    # When the information that started the chain first existed: the seed's actual
    # arrival (arrival seeding) or actual departure (departure seeding). Lead time
    # is measured from here.
    info_time_utc: Optional[pd.Timestamp] = None
    rest_evaluated: bool = False
    alerts: list[CrewAlertDraft] = field(default_factory=list)
    disclosure: str = PROXY_DISCLOSURE


# --------------------------------------------------------------- helpers --
def crosses(value: float, threshold: float, comparator: str) -> bool:
    if comparator == "gt":
        return value > threshold
    if comparator == "gte":
        return value >= threshold
    if comparator == "lt":
        return value < threshold
    raise ValueError(f"unknown comparator {comparator!r}")


def _hhmm(ts_local: pd.Timestamp) -> int:
    return ts_local.hour * 100 + ts_local.minute


def _in_range(hhmm: int, start: str, end: str) -> bool:
    return int(start) <= hhmm <= int(end)


def _minutes(a: pd.Timestamp, b: pd.Timestamp) -> float:
    return (b - a).total_seconds() / 60.0


def encroaches_window(start_utc, end_utc, tzname, window_start="0000", window_end="0600") -> bool:
    """Does [start, end] overlap the local clock window on any calendar day?"""
    s = start_utc.tz_convert(tzname)
    e = end_utc.tz_convert(tzname)
    ws, we = int(window_start), int(window_end)
    day = s.normalize() - pd.Timedelta(days=1)
    while day <= e.normalize():
        w0 = day + pd.Timedelta(hours=ws // 100, minutes=ws % 100)
        w1 = day + pd.Timedelta(hours=we // 100, minutes=we % 100)
        if s < w1 and e > w0:
            return True
        day += pd.Timedelta(days=1)
    return False


# ------------------------------------------------------------ the limits --
def fdp_limit(rule: dict, report_utc, duty_end_utc, segments: int, tzname: str):
    """Maximum FDP for this duty, in minutes, plus the landing cap.

    Returns (limit_minutes or None if no row permits it, max_landings or None, basis text).
    """
    t = rule["threshold"]
    report_local = report_utc.tz_convert(tzname)
    if t["type"] == "faa_table_b":
        hhmm = _hhmm(report_local)
        col = min(max(segments, 1), 7) - 1
        for row in t["rows"]:
            if _in_range(hhmm, row["start"], row["end"]):
                return (row["hours"][col] * 60.0, None,
                        f"Table B: report {report_local:%H:%M} local, {segments} segment(s)")
        raise ValueError(f"no Table B row for {hhmm}")
    if t["type"] == "dgca_6_1":
        night = t["night_duty"]
        if encroaches_window(report_utc, duty_end_utc, tzname, *night["window_local"]):
            return (float(night["fdp_minutes"]), night["max_landings"],
                    "para 6.1.4: duty encroaches night duty 00:00-06:00")
        m = t["day_fdp_minutes_by_landings"].get(str(segments))
        if m is None:
            return (None, t["max_landings_day"],
                    f"para 6.1: {segments} landings exceeds the 6-landing maximum")
        return float(m), t["max_landings_day"], f"para 6.1: {segments} landing(s)"
    raise ValueError(f"unknown FDP table type {t['type']!r}")


def flight_time_limit(rule: dict, report_utc, duty_end_utc, segments: int, tzname: str):
    t = rule["threshold"]
    if t["type"] == "by_report_time":
        hhmm = _hhmm(report_utc.tz_convert(tzname))
        for row in t["rows"]:
            if _in_range(hhmm, row["start"], row["end"]):
                return row["hours"] * 60.0
    if t["type"] == "dgca_6_1_flight_time":
        if encroaches_window(report_utc, duty_end_utc, tzname, "0000", "0600"):
            return float(t["night_minutes"])
        m = t["by_landings_minutes"].get(str(segments))
        return float(m) if m is not None else None
    raise ValueError(f"unknown flight-time table type {t['type']!r}")


def rest_threshold(rule: dict, preceding_duty_min: float) -> float:
    t = rule["threshold"]
    if isinstance(t, (int, float)):
        return float(t)
    if t.get("type") == "max_of":
        return max(float(t["minutes"]), preceding_duty_min if t.get("or_preceding_duty") else 0.0)
    raise ValueError(f"unknown rest threshold {t!r}")


# ---------------------------------------------------------- projection --
def _rules_by_kind(profile: dict) -> dict:
    out: dict[str, dict] = {}
    for r in profile["rules"]:
        out.setdefault(r["kind"], r)
    return out


def _arr_delay(leg: Leg, delays: dict, scenario: str, carried: Optional[float]):
    """Predicted arrival delay of `leg` under a scenario, or None if unknowable.

    Scenarios: "median", "upper", "lower" (interval bounds) and "carried" (the
    WATCH trigger past the confidence boundary).
    """
    d = delays.get(leg.leg_num)
    if d is None:
        return 0.0                      # chain absorbed / ended before this leg
    if d.observed:
        return d.arr_med
    if d.quantified:
        return {"median": d.arr_med, "upper": d.arr_up,
                "lower": d.arr_low if d.arr_low is not None else d.arr_med}.get(scenario, d.arr_med)
    return carried if scenario == "carried" else None


def _dep_delay(leg: Leg, delays: dict, scenario: str) -> float:
    d = delays.get(leg.leg_num)
    if d is None or d.observed or not d.quantified:
        return 0.0                      # unknown -> scheduled time (earliest, conservative)
    return (d.dep_med if scenario == "median" else d.dep_up) or 0.0


def project_duty(profile: dict, legs: list[Leg], delays: dict[int, LegDelay],
                 seed_leg: Optional[int], next_report_utc=None,
                 next_report_station: Optional[str] = None,
                 seed_arrival_utc=None, info_time_utc=None) -> CrewProjection:
    """Project the proxy crew's duty and evaluate every crew rule in the profile.

    `delays` maps leg_num -> LegDelay for the seed (observed) and every hop the
    propagation produced. Legs after the seed with no entry were absorbed.
    """
    if not legs:
        return CrewProjection(status="no_rotation", status_reason="No legs.")
    legs = sorted(legs, key=lambda l: l.leg_num)
    px = profile["proxy"]
    report_buf = float(px["report_buffer_minutes"]["value"])
    post_buf = float(px["post_flight_buffer_minutes"]["value"])
    callout = float(px["standby_callout_minutes"]["value"])
    kinds = _rules_by_kind(profile)
    fdp_rule = kinds["crew_fdp"]

    first, last = legs[0], legs[-1]
    tzname = tzu.tz_for(first.origin)
    report = first.dep_utc - pd.Timedelta(minutes=report_buf)
    segments = len(legs)
    sched_block = float(sum(l.block_min for l in legs))
    sched_fdp = _minutes(report, last.arr_utc)

    proj = CrewProjection(status="ok", status_reason="", report_utc=report,
                          report_station=first.origin, segments=segments,
                          scheduled_block_min=sched_block, fdp_scheduled=sched_fdp,
                          next_report_utc=next_report_utc)
    seed_d = delays.get(seed_leg) if seed_leg is not None else None
    seed_l = next((l for l in legs if l.leg_num == seed_leg), None)
    if seed_d is not None and seed_d.observed and seed_l is not None:
        proj.seed_arrival_utc = seed_l.arr_utc + pd.Timedelta(minutes=float(seed_d.arr_med))
    elif seed_arrival_utc is not None:
        # Seed lies outside these legs (an inferred block that starts after it).
        proj.seed_arrival_utc = seed_arrival_utc
    proj.info_time_utc = info_time_utc if info_time_utc is not None else proj.seed_arrival_utc

    # ---- is a single crew for the whole day even plausible? ---------------
    sched_duty_end = last.arr_utc + pd.Timedelta(minutes=post_buf)
    reasons, lim_s = schedule_violations(profile, legs)
    proj.fdp_limit_scheduled = lim_s
    if reasons:
        proj.status = "proxy_not_applicable"
        proj.status_reason = ("The aircraft's SCHEDULED day already breaks the single-crew limits ("
                              + "; ".join(reasons) + "), so the operator must change crews during the "
                              "day and the proxy cannot see where. No crew alert is raised.")
        return proj

    # ---- predicted end of the day ------------------------------------------
    last_d = delays.get(last.leg_num)
    last_quantified = last_d is None or last_d.observed or last_d.quantified
    proj.last_leg_quantified = last_quantified

    # The deepest quantified delay in the chain - used ONLY as a WATCH trigger
    # when the last leg itself has no number. Never reported as a prediction.
    carried = None
    for ln in sorted(delays):
        d = delays[ln]
        if d.observed:
            carried = d.arr_med
        elif d.quantified and d.arr_up is not None:
            carried = d.arr_up

    scen = {}
    for s in ("median", "upper"):
        a = _arr_delay(last, delays, s, None)
        if a is None:
            continue
        fdp = sched_fdp + a
        end = last.arr_utc + pd.Timedelta(minutes=a)
        scen[s] = {"fdp": fdp, "fdp_end": end, "duty_end": end + pd.Timedelta(minutes=post_buf)}
    if "median" in scen:
        proj.fdp_projected_median = scen["median"]["fdp"]
        proj.duty_end_median_utc = scen["median"]["duty_end"]
    if "upper" in scen:
        proj.fdp_projected_upper = scen["upper"]["fdp"]
        proj.duty_end_upper_utc = scen["upper"]["duty_end"]

    alerts: list[CrewAlertDraft] = []

    def first_breach_leg(threshold, comparator, scenario, offset):
        """Earliest leg whose projected block-in (+offset) crosses the threshold."""
        for leg in legs:
            if seed_leg is not None and leg.leg_num < seed_leg:
                continue
            a = _arr_delay(leg, delays, scenario, carried)
            if a is None:
                a = 0.0
            if crosses(_minutes(report, leg.arr_utc) + a + offset, threshold, comparator):
                return leg
        return last

    def deadline_for(leg: Leg, scenario: str):
        if seed_leg is not None and leg.leg_num == seed_leg:
            # Breach falls on the leg already in the air - nothing to call out for it.
            return leg.dep_utc, leg.origin
        dep = leg.dep_utc + pd.Timedelta(minutes=_dep_delay(leg, delays, scenario))
        return dep - pd.Timedelta(minutes=callout), leg.origin

    # ---- FDP, extended FDP and duty-period rules ---------------------------
    # A breach that falls on the seed leg is not a prediction: the seed's delay
    # is the observation that started the chain and that leg is already flown.
    breached_at_seed = []
    for r in profile["rules"]:
        if r["kind"] not in ("crew_fdp", "crew_fdp_extended", "crew_duty"):
            continue
        plus = 0.0 if r["kind"] == "crew_fdp" else float(r["threshold"]["plus_minutes"])
        offset = post_buf if r["kind"] == "crew_duty" else 0.0
        label = {"crew_fdp": "flight duty period", "crew_fdp_extended": "flight duty period",
                 "crew_duty": "duty period"}[r["kind"]]

        hit = None
        for s, sev in (("median", LIKELY), ("upper", WATCH)):
            if s not in scen:
                continue
            lim, max_land, basis = fdp_limit(fdp_rule, report, scen[s]["duty_end"], segments, tzname)
            if s == "median":
                proj.fdp_limit_projected = lim
            thr = lim + plus
            value = scen[s]["fdp"] + offset
            landing_breach = (r["kind"] == "crew_fdp" and max_land is not None
                              and segments > max_land)
            if crosses(value, thr, r["comparator"]) or landing_breach:
                leg = first_breach_leg(thr, r["comparator"], s, offset)
                dl, st = deadline_for(leg, s)
                why = (f"{segments} landings exceeds the night-duty cap of {max_land} ({basis})"
                       if landing_breach and not crosses(value, thr, r["comparator"]) else
                       f"projected {label} {value:.0f} min vs limit {thr:.0f} min ({basis})")
                hit = CrewAlertDraft(r["id"], sev, round(value, 1),
                                     "median prediction" if s == "median" else "interval upper bound",
                                     thr, r["comparator"], leg, dl, st, why,
                                     watch_reason=None if sev == LIKELY else UPPER_BOUND_ONLY)
                break
        if hit is None and not last_quantified and carried is not None:
            # No number for the last leg. Test the upstream quantified delay as a
            # trigger only - the result is WATCH (beyond_depth_2) with no predicted value.
            end = last.arr_utc + pd.Timedelta(minutes=carried)
            lim, _, basis = fdp_limit(fdp_rule, report, end + pd.Timedelta(minutes=post_buf),
                                      segments, tzname)
            thr = lim + plus
            if crosses(sched_fdp + carried + offset, thr, r["comparator"]):
                leg = first_breach_leg(thr, r["comparator"], "carried", offset)
                dl, st = deadline_for(leg, "median")
                hit = CrewAlertDraft(
                    r["id"], WATCH, None,
                    "no number: the last leg is past the depth-2 confidence boundary",
                    thr, r["comparator"], leg, dl, st,
                    f"a delay of the size still in the chain upstream would take the {label} past "
                    f"{thr:.0f} min ({basis}); the model cannot quantify the last leg",
                    watch_reason=BEYOND_DEPTH_2)
        if hit and seed_leg is not None and hit.breach_leg is not None \
                and hit.breach_leg.leg_num <= seed_leg:
            breached_at_seed.append(r["id"])
            hit = None
        if hit:
            alerts.append(hit)

    # ---- rest before the same aircraft's next day --------------------------
    rest_rule = kinds.get("crew_rest")
    rest_note = ""
    if rest_rule is not None and next_report_utc is not None:
        sched_rest = _minutes(sched_duty_end, next_report_utc)
        if crosses(sched_rest, rest_threshold(rest_rule, _minutes(report, sched_duty_end)),
                   rest_rule["comparator"]):
            # Even on time the overnight is below minimum rest, so the next
            # morning must be a different crew - the proxy does not hold there.
            rest_note = (f" Next-day rest rule skipped: the scheduled overnight ({sched_rest:.0f} min) "
                         "is already below minimum rest, so a different crew must operate the "
                         "next morning.")
            rest_rule = None
    if rest_rule is not None and next_report_utc is not None:
        proj.rest_evaluated = True
        hit = None
        for s, sev in (("median", LIKELY), ("upper", WATCH)):
            if s not in scen:
                continue
            rest = _minutes(scen[s]["duty_end"], next_report_utc)
            duty = _minutes(report, scen[s]["duty_end"])
            thr = rest_threshold(rest_rule, duty)
            if crosses(rest, thr, rest_rule["comparator"]):
                hit = CrewAlertDraft(
                    rest_rule["id"], sev, round(rest, 1),
                    "median prediction" if s == "median" else "interval upper bound",
                    thr, rest_rule["comparator"], None,
                    next_report_utc - pd.Timedelta(minutes=callout), next_report_station,
                    f"projected rest {rest:.0f} min before the next day's report vs minimum {thr:.0f} min",
                    watch_reason=None if sev == LIKELY else UPPER_BOUND_ONLY)
                break
        if hit is None and not last_quantified and carried is not None:
            end = last.arr_utc + pd.Timedelta(minutes=carried + post_buf)
            rest = _minutes(end, next_report_utc)
            thr = rest_threshold(rest_rule, _minutes(report, end))
            if crosses(rest, thr, rest_rule["comparator"]):
                hit = CrewAlertDraft(
                    rest_rule["id"], WATCH, None,
                    "no number: the last leg is past the depth-2 confidence boundary",
                    thr, rest_rule["comparator"], None,
                    next_report_utc - pd.Timedelta(minutes=callout), next_report_station,
                    "upstream delay in the chain would compress rest below the minimum; "
                    "the model cannot quantify the last leg",
                    watch_reason=BEYOND_DEPTH_2)
        if hit:
            alerts.append(hit)

    for a in alerts:
        if proj.info_time_utc is not None and a.deadline_utc is not None:
            a.usable_lead_min = _minutes(proj.info_time_utc, a.deadline_utc)
            a.deadline_passed = a.usable_lead_min <= 0
    proj.alerts = alerts
    if breached_at_seed and not alerts:
        proj.status = "breached_at_seed"
        proj.status_reason = (
            f"The limit ({', '.join(breached_at_seed)}) is already crossed on the seed leg, whose "
            "delay is the observation that started the chain, not a prediction. Nothing remains "
            "to act on; no alert raised. (Real operators can also delay crew report time, which "
            "the proxy does not model.)" + rest_note)
        return proj
    if alerts:
        worst = min(alerts, key=lambda a: SEVERITY_RANK[a.severity]).severity
        proj.status = "at_risk"
        proj.status_reason = f"{len(alerts)} crew rule(s) at risk; worst severity {worst}."
    else:
        proj.status_reason = ("Projected duty is within every encoded limit."
                              if last_quantified else
                              "Last leg is past the confidence boundary; no upstream delay "
                              "large enough to warrant monitoring.")
    proj.status_reason += rest_note
    return proj


# ------------------------------------------------- schedule legality / blocks --
def schedule_violations(profile: dict, legs: list[Leg]) -> tuple[list[str], Optional[float]]:
    """Why one crew could NOT legally fly these legs on schedule ([] if it could).

    Returns (reasons, scheduled FDP limit). Shared by the single-crew proxy and
    the inferred-block splitter so both apply exactly the same test.
    """
    legs = sorted(legs, key=lambda l: l.leg_num)
    px = profile["proxy"]
    report_buf = float(px["report_buffer_minutes"]["value"])
    post_buf = float(px["post_flight_buffer_minutes"]["value"])
    kinds = _rules_by_kind(profile)
    tzname = tzu.tz_for(legs[0].origin)
    report = legs[0].dep_utc - pd.Timedelta(minutes=report_buf)
    segments = len(legs)
    sched_fdp = _minutes(report, legs[-1].arr_utc)
    sched_block = float(sum(l.block_min for l in legs))
    duty_end = legs[-1].arr_utc + pd.Timedelta(minutes=post_buf)

    lim, max_land, basis = fdp_limit(kinds["crew_fdp"], report, duty_end, segments, tzname)
    reasons = []
    if lim is None:
        reasons.append(basis)
    elif sched_fdp > lim:
        reasons.append(f"scheduled FDP {sched_fdp:.0f} min already exceeds the "
                       f"{lim:.0f} min limit ({basis})")
    if max_land is not None and segments > max_land:
        reasons.append(f"{segments} landings exceeds the {max_land}-landing cap ({basis})")
    ft_rule = kinds.get("crew_flight_time")
    if ft_rule is not None:
        ft = flight_time_limit(ft_rule, report, duty_end, segments, tzname)
        if ft is None or sched_block > ft:
            reasons.append(f"scheduled block time {sched_block:.0f} min exceeds the flight-time "
                           f"limit {ft if ft is not None else 'n/a'}")
    return reasons, lim


INFERRED_LABEL = "inferred duty block — hypothetical, not a roster"
MIN_SPLIT_GROUND_MIN = 30


def infer_blocks(profile: dict, legs: list[Leg], bases: set) -> Optional[list[list[Leg]]]:
    """EXPERIMENTAL. Split an aircraft-day into the fewest scheduled-legal duty blocks.

    The split points are INVENTED: nothing in public data says where crews
    actually change. Constraints:
      * a split falls between leg i and i+1 only if the aircraft is on the ground
        for >= 30 min there and the airport is one of the carrier's top-10 origins
        in the training dates (a stand-in for crew bases);
      * every block must be legal on schedule under the active profile.
    Tie-break among minimum-block solutions: smallest spread (max - min) of the
    blocks' scheduled FDPs, i.e. the most equal blocks; then the earliest splits.
    Returns None when no legal split exists.
    """
    from itertools import combinations

    legs = sorted(legs, key=lambda l: l.leg_num)
    if not schedule_violations(profile, legs)[0]:
        return [legs]
    report_buf = float(profile["proxy"]["report_buffer_minutes"]["value"])
    cands = [i for i in range(len(legs) - 1)
             if _minutes(legs[i].arr_utc, legs[i + 1].dep_utc) >= MIN_SPLIT_GROUND_MIN
             and legs[i].dest == legs[i + 1].origin and legs[i].dest in bases]

    def fdp(block):
        return _minutes(block[0].dep_utc - pd.Timedelta(minutes=report_buf), block[-1].arr_utc)

    for k in range(1, len(cands) + 1):
        best = None
        for combo in combinations(cands, k):
            cuts = [0, *[c + 1 for c in combo], len(legs)]
            blocks = [legs[a:b] for a, b in zip(cuts, cuts[1:])]
            if any(schedule_violations(profile, b)[0] for b in blocks):
                continue
            lens = [fdp(b) for b in blocks]
            key = (max(lens) - min(lens), combo)
            if best is None or key < best[0]:
                best = (key, blocks)
        if best is not None:
            return best[1]
    return None
