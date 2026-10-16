"""Layer 5 unit tests.

Run from the project root (stdlib unittest - no extra dependency):
    conda run -n fdpis python -m unittest api.layer5.test_rules -v

Pure rule tests use synthetic legs and hops, so they need no data. The final
class (BatchTraverseParity) loads the real models and checks that the day
feed's batched propagation reproduces propagation.traverse() exactly.
"""
from __future__ import annotations

import unittest

import pandas as pd

from api import config
from api.layer5 import crew, engine
from api.layer5.crew import BEYOND_DEPTH_2, LIKELY, UPPER_BOUND_ONLY, WATCH, Leg, LegDelay

FAA = engine.load_profile("faa_part117")
DGCA = engine.load_profile("dgca_fdtl")
PROFILES = (FAA, DGCA)
EPS = 0.01


def utc(s: str) -> pd.Timestamp:
    return pd.Timestamp(s, tz="UTC")


def leg(n, o, d, dep_utc, block, fn=None) -> Leg:
    dep = utc(dep_utc) if isinstance(dep_utc, str) else dep_utc
    return Leg(n, fn or f"XX{100 + n}", o, d, dep, dep + pd.Timedelta(minutes=block), float(block))


def hop(depth, leg_num, total, high=None):
    q = depth <= config.CONFIDENCE_DEPTH and total is not None
    return {"depth": depth, "leg_num": leg_num,
            "total_delay": total if q else None,
            "interval_high": (high if high is not None else total) if q else None}


def rule(profile, rid):
    return next(r for r in profile["rules"] if r["id"] == rid)


def reasons(drafts):
    return [d["watch_reason"] for d in drafts]


def severities(drafts, rid=None):
    return [d["severity"] for d in drafts if rid is None or d["rule"]["id"] == rid]


# ===================================================================== data ==
class ProfileIntegrity(unittest.TestCase):
    def test_every_rule_cites_a_source_and_says_whether_it_is_verified(self):
        for p in PROFILES:
            for r in p["rules"]:
                with self.subTest(profile=p["profile"], rule=r["id"]):
                    self.assertIn("http", r["source"])
                    self.assertIsInstance(r["verified"], bool)
                    self.assertIn(r["comparator"], ("gt", "gte", "lt"))
                    self.assertTrue(r["notes"])

    def test_both_profiles_load_and_are_listed(self):
        self.assertEqual(engine.list_profiles(), ["dgca_fdtl", "faa_part117"])
        with self.assertRaises(KeyError):
            engine.load_profile("../config")

    def test_table_b_covers_every_minute_of_the_day_once(self):
        rows = rule(FAA, "crew_fdp_limit")["threshold"]["rows"]
        covered = []
        for r in rows:
            self.assertEqual(len(r["hours"]), 7)
            covered += [h * 100 + m for h in range(24) for m in range(60)
                        if int(r["start"]) <= h * 100 + m <= int(r["end"])]
        self.assertEqual(sorted(covered), [h * 100 + m for h in range(24) for m in range(60)])

    def test_table_b_spot_values_match_the_cfr(self):
        # 14 CFR Part 117 Table B: 0700-1159 -> 14,14,13,13,12.5,12,11.5
        t = rule(FAA, "crew_fdp_limit")
        tz = "America/New_York"
        report = pd.Timestamp("2025-07-25 07:00", tz=tz).tz_convert("UTC")
        for segs, hours in zip(range(1, 8), [14, 14, 13, 13, 12.5, 12, 11.5]):
            lim, _, _ = crew.fdp_limit(t, report, report + pd.Timedelta(hours=8), segs, tz)
            self.assertEqual(lim, hours * 60)
        report = pd.Timestamp("2025-07-25 00:30", tz=tz).tz_convert("UTC")
        lim, _, _ = crew.fdp_limit(t, report, report + pd.Timedelta(hours=8), 1, tz)
        self.assertEqual(lim, 9 * 60)

    def test_dgca_fdp_by_landings_and_night_duty(self):
        t = rule(DGCA, "crew_fdp_limit")
        tz = "America/New_York"
        report = pd.Timestamp("2025-07-25 07:00", tz=tz).tz_convert("UTC")
        end = report + pd.Timedelta(hours=10)                      # 17:00, no night
        for landings, mins in {1: 780, 2: 780, 3: 750, 4: 720, 5: 690, 6: 660}.items():
            self.assertEqual(crew.fdp_limit(t, report, end, landings, tz)[0], mins)
        self.assertIsNone(crew.fdp_limit(t, report, end, 7, tz)[0])
        late = report + pd.Timedelta(hours=17, minutes=30)         # 00:30 next day
        lim, cap, basis = crew.fdp_limit(t, report, late, 2, tz)
        self.assertEqual((lim, cap), (600, 2))
        self.assertIn("6.1.4", basis)


# ================================================ passenger rule boundaries ==
def _pax_leg(block=120, dep_local="2025-07-25 10:00"):
    dep = pd.Timestamp(dep_local, tz="America/New_York").tz_convert("UTC")
    return leg(2, "ATL", "CLT", dep, block)


def _pax_rules():
    for p in PROFILES:
        for r in p["rules"]:
            if r["category"] == "passenger":
                yield p, r


class PassengerRuleBoundaries(unittest.TestCase):
    """For each passenger rule: below, at, WATCH (upper bound only), depth 3+."""

    REC = 0.895     # recovery rate, only used by the arrival-delay rule

    def _eval(self, profile, r, total, high=None, depth=1, l=None, upstream=None):
        l = l or _pax_leg()
        hops = list(upstream or []) + [hop(depth, l.leg_num, total, high)]
        legs = {l.leg_num: l}
        if upstream:
            for h in upstream:
                legs[h["leg_num"]] = leg(h["leg_num"], "ATL", "CLT", l.dep_utc, l.block_min)
        out = engine.evaluate_passenger(profile, hops, legs, self.REC)
        return [d for d in out if d["rule"]["id"] == r["id"] and d["leg"].leg_num == l.leg_num]

    def _total_for(self, r, minutes):
        """The departure-delay total that produces `minutes` for this rule's measure."""
        return minutes / self.REC if r["kind"] == "pax_arrival_delay" else minutes

    def test_just_below_threshold_no_alert(self):
        for p, r in _pax_rules():
            with self.subTest(profile=p["profile"], rule=r["id"]):
                thr = engine.pax_threshold(r, _pax_leg())
                below = self._total_for(r, thr) - EPS
                self.assertEqual(self._eval(p, r, below, below), [])

    def test_exactly_at_threshold(self):
        """'X or more' (gte) alerts AT the threshold; 'more than X' (gt) needs X + epsilon.

        The comparator is read from the regulation's wording, so 'exactly at'
        alerts only where the regulation says 'or more'.
        """
        for p, r in _pax_rules():
            with self.subTest(profile=p["profile"], rule=r["id"]):
                thr = engine.pax_threshold(r, _pax_leg())
                at = self._total_for(r, thr)
                if r["comparator"] == "gte":
                    self.assertEqual(severities(self._eval(p, r, at, at)), [LIKELY])
                else:
                    self.assertEqual(self._eval(p, r, at, at), [])
                    over = self._total_for(r, thr + EPS)
                    self.assertEqual(severities(self._eval(p, r, over, over)), [LIKELY])

    def test_median_below_upper_above_is_watch_not_likely(self):
        for p, r in _pax_rules():
            with self.subTest(profile=p["profile"], rule=r["id"]):
                thr = engine.pax_threshold(r, _pax_leg())
                med, hi = self._total_for(r, thr) - 30, self._total_for(r, thr) + 30
                got = self._eval(p, r, med, hi)
                self.assertEqual(severities(got), [WATCH])
                self.assertEqual(reasons(got), [UPPER_BOUND_ONLY])
                self.assertIsNotNone(got[0]["value"])        # upper-bound WATCH carries a number

    def test_depth_3_plus_is_watch_beyond_depth_2_never_likely(self):
        for p, r in _pax_rules():
            for depth in (3, 4, 5):
                with self.subTest(profile=p["profile"], rule=r["id"], depth=depth):
                    big = self._total_for(r, 5000)
                    # No upstream trigger -> nothing at all.
                    self.assertEqual(self._eval(p, r, big, big, depth=depth), [])
                    # Upstream quantified hop crossed -> WATCH beyond_depth_2, with no number.
                    up = [hop(1, 1, big, big), hop(2, 3, big, big)]
                    got = self._eval(p, r, big, big, depth=depth, upstream=up)
                    self.assertEqual(severities(got), [WATCH])
                    self.assertEqual(reasons(got), [BEYOND_DEPTH_2])
                    self.assertIsNone(got[0]["value"])

    def test_dgca_meal_threshold_follows_block_time(self):
        r = rule(DGCA, "pax_meals_refreshments")
        self.assertEqual(engine.pax_threshold(r, _pax_leg(block=150)), 120)
        self.assertEqual(engine.pax_threshold(r, _pax_leg(block=151)), 180)
        self.assertEqual(engine.pax_threshold(r, _pax_leg(block=300)), 180)
        self.assertEqual(engine.pax_threshold(r, _pax_leg(block=301)), 240)

    def test_dgca_hotel_threshold_follows_departure_window(self):
        r = rule(DGCA, "pax_hotel_accommodation")
        self.assertEqual(engine.pax_threshold(r, _pax_leg(dep_local="2025-07-25 10:00")), 1440)
        self.assertEqual(engine.pax_threshold(r, _pax_leg(dep_local="2025-07-25 20:00")), 360)
        self.assertEqual(engine.pax_threshold(r, _pax_leg(dep_local="2025-07-25 02:59")), 360)
        self.assertEqual(engine.pax_threshold(r, _pax_leg(dep_local="2025-07-25 03:00")), 1440)


# ============================================================= crew proxy ==
def rotation(fdp_target_min: float, segments: int = 4, report_local="2025-07-25 07:00",
             o="ATL", tz="America/New_York"):
    """Synthetic same-zone rotation whose scheduled FDP is exactly fdp_target_min."""
    report = pd.Timestamp(report_local, tz=tz).tz_convert("UTC")
    first_dep = report + pd.Timedelta(minutes=60)               # profile report buffer
    span = fdp_target_min - 60                                  # first dep -> last block-in
    block = 60.0
    gap = (span - segments * block) / (segments - 1) if segments > 1 else 0
    legs, t = [], first_dep
    for n in range(1, segments + 1):
        legs.append(leg(n, o, o, t, block))
        t = t + pd.Timedelta(minutes=block + gap)
    return legs


def chain(seed_leg, observed, hops, rec=1.0):
    return engine.delays_from_hops(hops, seed_leg, observed, rec)


class CrewProxy(unittest.TestCase):
    def ids(self, proj, sev=None):
        return [a.rule_id for a in proj.alerts if sev is None or a.severity == sev]

    def test_duty_clearly_fine(self):
        for p in PROFILES:
            with self.subTest(profile=p["profile"]):
                legs = rotation(480)                              # 8 h day, limit >= 11 h
                proj = crew.project_duty(p, legs, chain(2, 20, [hop(1, 3, 10, 15), hop(2, 4, 8, 12)]), 2)
                self.assertEqual(proj.status, "ok")
                self.assertEqual(proj.alerts, [])

    def test_90_min_delay_on_leg_2_pushes_last_leg_over_fdp(self):
        """FAA Table B, report 07:00, 4 segments -> 13 h (780). DGCA 4 landings -> 12 h (720).

        The schedule sits 60 min under the limit; a 90-minute delay on leg 2
        carried to the last leg pushes the FDP 30 min over.
        """
        for p, limit in ((FAA, 780), (DGCA, 720)):
            with self.subTest(profile=p["profile"]):
                legs = rotation(limit - 60)
                d = chain(2, 90, [hop(1, 3, 90, 100), hop(2, 4, 90, 100)])
                proj = crew.project_duty(p, legs, d, 2)
                self.assertEqual(proj.status, "at_risk")
                fdp = next(a for a in proj.alerts if a.rule_id == "crew_fdp_limit")
                self.assertEqual(fdp.severity, LIKELY)
                self.assertAlmostEqual(fdp.value, limit + 30, places=1)
                self.assertEqual(fdp.threshold, limit)
                self.assertEqual(fdp.breach_leg.leg_num, 4)
                # Deadline: leg 4's predicted departure minus the 90-min call-out.
                expected = legs[3].dep_utc + pd.Timedelta(minutes=90 - 90)
                self.assertEqual(fdp.deadline_utc, expected)
                # 30 min over is inside the 2 h extension: no extension alert.
                self.assertNotIn("crew_fdp_extension_limit", self.ids(proj))

    def test_fdp_exactly_at_limit_is_legal(self):
        """Part 117 / CAR: the FDP must not 'exceed' the limit -> at the limit, no alert."""
        for p, limit in ((FAA, 780), (DGCA, 720)):
            with self.subTest(profile=p["profile"]):
                legs = rotation(limit - 60)
                at = crew.project_duty(p, legs, chain(2, 60, [hop(1, 3, 60), hop(2, 4, 60)]), 2)
                self.assertNotIn("crew_fdp_limit", self.ids(at))
                over = crew.project_duty(p, legs, chain(2, 60 + EPS, [hop(1, 3, 60 + EPS), hop(2, 4, 60 + EPS)]), 2)
                self.assertIn("crew_fdp_limit", self.ids(over, LIKELY))

    def test_median_below_upper_above_is_watch_upper_bound_only(self):
        for p, limit in ((FAA, 780), (DGCA, 720)):
            with self.subTest(profile=p["profile"]):
                legs = rotation(limit - 60)
                proj = crew.project_duty(p, legs, chain(2, 40, [hop(1, 3, 40, 100), hop(2, 4, 40, 100)]), 2)
                fdp = next(a for a in proj.alerts if a.rule_id == "crew_fdp_limit")
                self.assertEqual(fdp.severity, WATCH)
                self.assertEqual(fdp.watch_reason, UPPER_BOUND_ONLY)
                self.assertIsNotNone(fdp.value)
                self.assertEqual(fdp.basis, "interval upper bound")

    def test_last_leg_past_depth_2_is_watch_beyond_depth_2_only(self):
        for p, limit in ((FAA, 780), (DGCA, 690)):
            with self.subTest(profile=p["profile"]):
                legs = rotation(limit - 60, segments=5)
                hops = [hop(1, 2, 200, 220), hop(2, 3, 200, 220), hop(3, 4, None), hop(4, 5, None)]
                proj = crew.project_duty(p, legs, chain(1, 200, hops), 1)
                self.assertFalse(proj.last_leg_quantified)
                sevs = {a.severity for a in proj.alerts}
                self.assertTrue(sevs, "a 200-min upstream delay should at least be watched")
                self.assertEqual(sevs, {WATCH})
                self.assertEqual({a.watch_reason for a in proj.alerts}, {BEYOND_DEPTH_2})
                self.assertTrue(all(a.value is None for a in proj.alerts))

    def test_schedule_already_over_limit_means_proxy_not_applicable(self):
        for p in PROFILES:
            with self.subTest(profile=p["profile"]):
                proj = crew.project_duty(p, rotation(16 * 60, segments=4), {}, None)
                self.assertEqual(proj.status, "proxy_not_applicable")
                self.assertEqual(proj.alerts, [])

    def test_breach_on_the_seed_leg_is_not_a_prediction(self):
        legs = rotation(600, segments=2)
        proj = crew.project_duty(FAA, legs, chain(2, 600, []), 2)
        self.assertEqual(proj.status, "breached_at_seed")
        self.assertEqual(proj.alerts, [])

    def test_dgca_delay_into_night_lowers_limit_to_10h(self):
        """Report 13:00, 2 landings: day limit 13:00 (780). A delay past midnight
        makes it night duty (para 6.1.4): limit 10:00 (600)."""
        legs = rotation(540, segments=2, report_local="2025-07-25 13:00")   # ends 22:00
        ok = crew.project_duty(DGCA, legs, chain(1, 30, [hop(1, 2, 30)]), 1)
        self.assertEqual(ok.alerts, [])
        late = crew.project_duty(DGCA, legs, chain(1, 150, [hop(1, 2, 150)]), 1)  # ends 00:30
        fdp = next(a for a in late.alerts if a.rule_id == "crew_fdp_limit")
        self.assertEqual(fdp.threshold, 600)
        self.assertEqual(fdp.severity, LIKELY)

    def test_rest_before_next_day(self):
        legs = rotation(600, segments=4)                           # report 07:00, ends 17:00 local
        end = legs[-1].arr_utc
        # FAA 117.25(e): 10 h from release (block-in + 15 min post-flight buffer).
        nxt = end + pd.Timedelta(minutes=15 + 600)
        on_time = crew.project_duty(FAA, legs, chain(2, 0, [hop(1, 3, 0), hop(2, 4, 0)]), 2, nxt, "ATL")
        self.assertNotIn("crew_min_rest", self.ids(on_time))
        nxt = end + pd.Timedelta(minutes=15 + 650)
        late = crew.project_duty(FAA, legs, chain(2, 60, [hop(1, 3, 60), hop(2, 4, 60)]), 2, nxt, "ATL")
        rest = next(a for a in late.alerts if a.rule_id == "crew_min_rest")
        self.assertEqual((rest.severity, rest.threshold), (LIKELY, 600))
        # DGCA 10.1: max(12 h, preceding duty).
        nxt = end + pd.Timedelta(minutes=15 + 760)
        d = crew.project_duty(DGCA, legs, chain(2, 60, [hop(1, 3, 60), hop(2, 4, 60)]), 2, nxt, "ATL")
        rest = next(a for a in d.alerts if a.rule_id == "crew_min_rest")
        self.assertEqual(rest.threshold, 720)

    def test_scheduled_short_overnight_skips_rest_rule(self):
        legs = rotation(600, segments=4)
        nxt = legs[-1].arr_utc + pd.Timedelta(minutes=300)       # 5 h: proxy cannot hold
        proj = crew.project_duty(FAA, legs, chain(2, 60, [hop(1, 3, 60), hop(2, 4, 60)]), 2, nxt, "ATL")
        self.assertNotIn("crew_min_rest", self.ids(proj))
        self.assertIn("Next-day rest rule skipped", proj.status_reason)

    def test_duty_spanning_time_zones_is_measured_in_utc(self):
        """ATL (UTC-4) -> DEN (UTC-6) -> LAX (UTC-7): local clocks would understate duty by 3 h."""
        rep = pd.Timestamp("2025-07-25 07:00", tz="America/New_York").tz_convert("UTC")
        l1 = leg(1, "ATL", "DEN", rep + pd.Timedelta(minutes=60), 240)
        l2 = leg(2, "DEN", "LAX", l1.arr_utc + pd.Timedelta(minutes=60), 150)
        proj = crew.project_duty(FAA, [l1, l2], {}, None)
        self.assertEqual(proj.fdp_scheduled, 60 + 240 + 60 + 150)


class DeadlinePassed(unittest.TestCase):
    """An alert whose action deadline is before the seed leg's actual arrival - the
    moment its information first exists - is useless to a crew scheduler."""

    def _run(self, seed_obs):
        # FAA, report 07:00, 4 legs, 60-min blocks, 140-min turns; scheduled FDP 720 (limit 780).
        legs = rotation(720, segments=4)
        d = chain(2, seed_obs, [hop(1, 3, 30), hop(2, 4, 70)])
        proj = crew.project_duty(FAA, legs, d, 2)
        return legs, next(a for a in proj.alerts if a.rule_id == "crew_fdp_limit")

    def test_lead_time_is_deadline_minus_seed_actual_arrival(self):
        legs, a = self._run(200)
        seed_arrival = legs[1].arr_utc + pd.Timedelta(minutes=200)
        # leg 4 predicted departure (sched + 70) minus the 90-min call-out
        deadline = legs[3].dep_utc + pd.Timedelta(minutes=70 - 90)
        self.assertEqual(a.deadline_utc, deadline)
        self.assertAlmostEqual(a.usable_lead_min, (deadline - seed_arrival).total_seconds() / 60)
        self.assertFalse(a.deadline_passed)

    def test_deadline_before_information_exists_is_flagged(self):
        legs, a = self._run(400)                     # seed lands after the call-out deadline
        self.assertLessEqual(a.usable_lead_min, 0)
        self.assertTrue(a.deadline_passed)

    def test_notify_refuses_a_passed_deadline(self):
        from api.layer5 import notify
        alert = {"id": 1, "category": "crew", "status": "deadline_passed", "rule_id": "crew_fdp_limit",
                 "usable_lead_minutes": -140.0, "tail": "N1", "profile_name": "FAA Part 117",
                 "severity": "LIKELY", "flight": None, "deadline_station": "ATL", "deadline_local": "12:00"}
        with self.assertRaises(ValueError):
            notify.create(alert)


class DepartureSeeding(unittest.TestCase):
    """seed_on='departure': seed = first leg with DEP_DELAY >= 15, its arrival delay is
    DEP_DELAY x recovery rate, information time = actual departure. ARR_DELAY unused."""

    def _day(self):
        return pd.DataFrame({
            "TAIL_NUM": ["N1", "N1", "N1"], "LEG_NUM": [1, 2, 3],
            "FL_DATE": pd.to_datetime(["2025-07-25"] * 3),
            "ORIGIN": ["ATL", "CLT", "MIA"], "DEST": ["CLT", "MIA", "ATL"],
            "CRS_DEP_TIME": [800, 1100, 1400], "CRS_ELAPSED_TIME": [90.0, 120.0, 120.0],
            "DEP_DELAY": [5.0, 40.0, 10.0],
            # Poisoned: if departure seeding read ARR_DELAY the assertions below would fail.
            "ARR_DELAY": [999.0, 999.0, 999.0],
        })

    def test_seed_is_first_departure_delay_and_ignores_arrival_delay(self):
        from api.layer5 import feed

        class B:
            recovery_rate = 0.895
        s = feed.select_seeds(B(), self._day(), "departure")
        self.assertEqual(len(s), 1)
        self.assertEqual(int(s["LEG_NUM"].iloc[0]), 2)
        self.assertAlmostEqual(float(s["inbound_delay"].iloc[0]), 40 * 0.895)
        info = pd.Timestamp(s["info_time_utc"].iloc[0])
        info = info.tz_localize("UTC") if info.tzinfo is None else info
        # CLT 11:00 EDT = 15:00 UTC, plus the 40-min departure delay
        self.assertEqual(info, utc("2025-07-25 15:40"))

    def test_arrival_seeding_unchanged(self):
        from api.layer5 import feed

        class B:
            recovery_rate = 0.895
        s = feed.select_seeds(B(), self._day(), "arrival")
        self.assertEqual(int(s["LEG_NUM"].iloc[0]), 1)
        self.assertEqual(float(s["inbound_delay"].iloc[0]), 999.0)

    def test_lead_time_measured_from_information_time(self):
        legs = rotation(720, segments=4)
        d = chain(2, 100, [hop(1, 3, 30), hop(2, 4, 70)])
        info = legs[1].dep_utc + pd.Timedelta(minutes=10)
        a = next(x for x in crew.project_duty(FAA, legs, d, 2, info_time_utc=info).alerts
                 if x.rule_id == "crew_fdp_limit")
        self.assertAlmostEqual(a.usable_lead_min, (a.deadline_utc - info).total_seconds() / 60)


class InferredBlocks(unittest.TestCase):
    def test_long_day_splits_at_a_base_into_legal_blocks(self):
        # 8 one-hour legs, 60-min turns, report 05:00: 16 h scheduled - illegal for one crew.
        legs = rotation(16 * 60, segments=8, report_local="2025-07-25 05:00")
        self.assertEqual(crew.project_duty(FAA, legs, {}, None).status, "proxy_not_applicable")
        blocks = crew.infer_blocks(FAA, legs, {"ATL"})
        self.assertIsNotNone(blocks)
        self.assertEqual(len(blocks), 2)
        for b in blocks:
            self.assertEqual(crew.schedule_violations(FAA, b)[0], [])

    def test_no_base_means_no_split(self):
        legs = rotation(16 * 60, segments=8, report_local="2025-07-25 05:00")
        self.assertIsNone(crew.infer_blocks(FAA, legs, {"ZZZ"}))


class WatchTier(unittest.TestCase):
    def test_only_two_severities_and_reason_iff_watch(self):
        legs = rotation(720, segments=5)
        for hops in ([hop(1, 2, 60, 200), hop(2, 3, 60, 200)],                  # upper only
                     [hop(1, 2, 200, 220), hop(2, 3, 200, 220), hop(3, 4, None), hop(4, 5, None)],
                     [hop(1, 2, 120, 130), hop(2, 3, 120, 130)]):               # median
            for p in PROFILES:
                proj = crew.project_duty(p, legs, chain(1, 120, hops), 1)
                for a in proj.alerts:
                    self.assertIn(a.severity, (LIKELY, WATCH))
                    self.assertEqual(a.watch_reason is not None, a.severity == WATCH)
                    if a.watch_reason == BEYOND_DEPTH_2:
                        self.assertIsNone(a.value)

    def test_alert_dict_and_schema_carry_watch_reason(self):
        from api import schemas
        r = rule(FAA, "pax_dot_significant_delay")
        a = engine.make_alert(FAA, r, severity=WATCH, value=None, basis="x", threshold=180,
                              tail="N1", date="2025-07-25", leg=None, depth=3, deadline_utc=None,
                              deadline_station="ATL", detail="d", context="t",
                              watch_reason=BEYOND_DEPTH_2)
        self.assertEqual(a["watch_reason"], BEYOND_DEPTH_2)
        self.assertEqual(schemas.Alert(**a).watch_reason, BEYOND_DEPTH_2)
        b = engine.make_alert(FAA, r, severity=LIKELY, value=200, basis="x", threshold=180,
                              tail="N1", date="2025-07-25", leg=None, depth=1, deadline_utc=None,
                              deadline_station="ATL", detail="d", context="t2",
                              watch_reason=UPPER_BOUND_ONLY)
        self.assertIsNone(b["watch_reason"])            # never set on LIKELY
        with self.assertRaises(Exception):
            schemas.Alert(**{**a, "severity": "POSSIBLE"})   # old tiers are gone


class RecommendationRequestValidation(unittest.TestCase):
    def test_exactly_one_delay(self):
        from pydantic import ValidationError
        from api.schemas import RecommendationRequest
        base = {"tail": "N1X", "date": "2025-07-25", "leg_num": 2}
        self.assertEqual(RecommendationRequest(**base, arrival_delay=30).arrival_delay, 30)
        self.assertEqual(RecommendationRequest(**base, departure_delay=30).departure_delay, 30)
        with self.assertRaises(ValidationError):
            RecommendationRequest(**base)
        with self.assertRaises(ValidationError):
            RecommendationRequest(**base, arrival_delay=30, departure_delay=30)


class NeverHardAlertPastDepth2(unittest.TestCase):
    def test_no_combination_of_unquantified_hops_yields_likely_or_possible(self):
        for p in PROFILES:
            for delay in (30, 120, 300, 900):
                with self.subTest(profile=p["profile"], delay=delay):
                    legs = rotation(500, segments=6)
                    hops = [hop(1, 2, delay, delay + 60), hop(2, 3, delay, delay + 60),
                            hop(3, 4, None), hop(4, 5, None), hop(5, 6, None)]
                    proj = crew.project_duty(p, legs, chain(1, delay, hops), 1)
                    self.assertTrue(all(a.severity == WATCH and a.watch_reason == BEYOND_DEPTH_2
                                        and a.value is None for a in proj.alerts))
                    l = {x.leg_num: x for x in legs}
                    pax = engine.evaluate_passenger(p, hops, l, 0.895)
                    for d in pax:
                        if d["depth"] >= 3:
                            self.assertEqual((d["severity"], d["watch_reason"]), (WATCH, BEYOND_DEPTH_2))
                            self.assertIsNone(d["value"])


# ================================================== real-model integration ==
class BatchTraverseParity(unittest.TestCase):
    """feed.traverse_many must reproduce propagation.traverse hop for hop."""

    @classmethod
    def setUpClass(cls):
        from api.models import load_bundle
        cls.b = load_bundle()

    def test_batch_equals_single(self):
        from api import propagation
        from api.layer5 import feed
        d = pd.Timestamp("2025-07-25")
        day = self.b.df[self.b.df["FL_DATE"] == d].sort_values(["TAIL_NUM", "LEG_NUM"])
        seeds = (day[day["ARR_DELAY"] >= 15].groupby("TAIL_NUM").head(1)
                 .sample(40, random_state=7))
        seeds = seeds.assign(inbound_delay=seeds["ARR_DELAY"].astype(float))
        batch = feed.traverse_many(self.b, day, seeds[["TAIL_NUM", "LEG_NUM", "inbound_delay"]])
        compared = 0
        for r in seeds.itertuples():
            single = propagation.traverse(self.b, r.TAIL_NUM, d, int(r.LEG_NUM), float(r.ARR_DELAY))["hops"]
            got = batch.get(r.TAIL_NUM, [])
            self.assertEqual(len(single), len(got), r.TAIL_NUM)
            for s, g in zip(single, got):
                for k in ("depth", "leg_num", "total_delay", "interval_high", "interval_low",
                          "inherited_delay", "gate_probability", "inbound_delay"):
                    self.assertEqual(s[k], g[k], f"{r.TAIL_NUM} depth {s['depth']} {k}")
                compared += 1
        self.assertGreater(compared, 40)


class EndpointMatchesFeed(unittest.TestCase):
    """POST /api/recommendations with a departure_delay must give the same crew alerts
    as the departure-seeded /api/alerts feed for the same seed."""

    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from api import main
        from api.models import load_bundle
        main.STATE["bundle"] = load_bundle()
        cls.b = main.STATE["bundle"]
        cls.client = TestClient(main.app)       # no lifespan: bundle already loaded

    KEYS = ("rule_id", "severity", "watch_reason", "predicted_value_minutes", "threshold_minutes",
            "deadline_utc", "deadline_station", "usable_lead_minutes", "status", "flight")

    def _crew(self, alerts):
        return sorted((tuple(str(a[k]) for k in self.KEYS) for a in alerts
                       if a["category"] == "crew"))

    def test_departure_seed_identical_alerts(self):
        date = "2025-07-25"
        compared = 0
        for profile in ("faa_part117", "dgca_fdtl"):
            feed = self.client.get("/api/alerts", params={"date": date, "profile": profile,
                                                          "seed_on": "departure"}).json()
            by_tail = {}
            for a in feed["alerts"]:
                by_tail.setdefault(a["tail"], []).append(a)
            day = self.b.df[self.b.df["FL_DATE"] == pd.Timestamp(date)]
            for tail in sorted(by_tail)[:12]:
                rows = day[(day["TAIL_NUM"] == tail) & (day["DEP_DELAY"] >= 15)].nsmallest(1, "LEG_NUM")
                seed = rows.iloc[0]
                r = self.client.post("/api/recommendations", json={
                    "tail": tail, "date": date, "leg_num": int(seed["LEG_NUM"]),
                    "departure_delay": float(seed["DEP_DELAY"]), "profile": profile})
                self.assertEqual(r.status_code, 200, r.text)
                body = r.json()
                self.assertEqual(body["seed"]["kind"], "departure")
                self.assertEqual(self._crew(body["alerts"]), self._crew(by_tail[tail]), tail)
                compared += 1
        self.assertGreaterEqual(compared, 20)

    def test_departure_delay_converted_with_recovery_rate(self):
        day = self.b.df[self.b.df["FL_DATE"] == pd.Timestamp("2025-07-25")]
        seed = day[day["DEP_DELAY"] >= 30].iloc[0]
        r = self.client.post("/api/recommendations", json={
            "tail": seed["TAIL_NUM"], "date": "2025-07-25", "leg_num": int(seed["LEG_NUM"]),
            "departure_delay": 100}).json()
        self.assertAlmostEqual(r["seed"]["arrival_delay_used"], round(100 * self.b.recovery_rate, 2))
        self.assertAlmostEqual(r["chain"]["observed_delay_minutes"], round(100 * self.b.recovery_rate, 2))

    def test_endpoint_rejects_both_or_neither(self):
        base = {"tail": "N8714Q", "date": "2025-07-25", "leg_num": 1}
        self.assertEqual(self.client.post("/api/recommendations", json=base).status_code, 422)
        self.assertEqual(self.client.post("/api/recommendations",
                                          json={**base, "arrival_delay": 30,
                                                "departure_delay": 30}).status_code, 422)
        self.assertEqual(self.client.post("/api/recommendations",
                                          json={**base, "arrival_delay": 30}).status_code, 200)


if __name__ == "__main__":
    unittest.main()
