"""Tests for the live WhatsApp demo channel (api/notifier.py) through the real
endpoints. The Twilio HTTP call is mocked: no network, no real credentials.

    python -m unittest api.test_notifier
"""
from __future__ import annotations

import json
import os
import unittest
from unittest import mock

import httpx
from fastapi.testclient import TestClient

from api import main, notifier
from api.layer5 import engine, notify

# Fake values: the tests check none of them ever appears in a response or message.
SID = "AC_TEST_FAKE_ACCOUNT_SID"          # deliberately not a real SID format
TOKEN = "TEST_FAKE_AUTH_TOKEN_VALUE"
PHONE = "+15550100123"           # reserved fictional range
LIVE_ENV = {"NOTIFY_MODE": "whatsapp", "TWILIO_ACCOUNT_SID": SID,
            "TWILIO_AUTH_TOKEN": TOKEN, "NOTIFY_TO": f"whatsapp:{PHONE}"}
CLEAR = {k: "" for k in ("NOTIFY_MODE", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
                         "NOTIFY_TO", "TWILIO_WHATSAPP_FROM", "NOTIFY_MAX_LIVE")}
_seq = [0]


def make_alert(**over) -> dict:
    """A crew alert shaped like the engine's, registered so the endpoint finds it."""
    _seq[0] += 1
    a = {
        "rule_id": "crew_fdp_limit", "category": "crew", "severity": "LIKELY",
        "watch_reason": None, "profile": "faa_part117", "profile_name": "FAA Part 117",
        "tail": "N822UA", "date": "2025-07-19",
        "flight": {"flight_number": "UA573", "leg_num": 3, "origin": "BOI", "dest": "ORD",
                   "depth": 1, "scheduled_dep_local": "12:39"},
        "predicted_value_minutes": 727.0, "predicted_basis": "median prediction",
        "threshold_minutes": 720.0, "comparator": "gt", "margin_minutes": 7.0,
        "action": "Call out a standby crew at BOI to take over UA573",
        "deadline_local": "11:26", "deadline_station": "BOI", "usable_lead_minutes": 199.9,
        "status": "actionable",
    }
    a.update(over)
    return engine.REGISTRY.register(f"test-notifier-{_seq[0]}", a)


def twilio_ok(sid="SM_TEST_FAKE_MESSAGE_SID"):
    return httpx.Response(201, json={"sid": sid, "status": "queued"},
                          request=httpx.Request("POST", "https://api.twilio.com"))


def twilio_error(status=500):
    # Twilio error bodies can echo the recipient number: it must never reach a response.
    return httpx.Response(status, json={"code": 63016, "message": f"Failed to send to {PHONE}",
                                        "more_info": f"{SID} {TOKEN}"},
                          request=httpx.Request("POST", "https://api.twilio.com"))


class NotifierTests(unittest.TestCase):
    def setUp(self):
        notifier._reset_for_tests()
        self.client = TestClient(main.app)      # no lifespan: the notify path needs no models

    def notify(self, alert):
        return self.client.post(f"/api/alerts/{alert['id']}/notify")

    def assertNoSecrets(self, text: str):
        for s in (SID, TOKEN, PHONE, PHONE.lstrip("+"), "5550100123"):
            self.assertNotIn(s, text)

    # ------------------------------------------------------------ not live ---
    def test_not_live_is_exactly_simulated(self):
        with mock.patch.dict(os.environ, CLEAR), mock.patch("httpx.post") as post:
            r = self.notify(make_alert())
        self.assertEqual(r.status_code, 200)
        post.assert_not_called()
        d = r.json()
        self.assertEqual(d["status"], notify.STATUS)
        self.assertIs(d["simulated"], True)
        self.assertEqual(d["notice"], notify.NOTICE)
        self.assertEqual(d["delivery"]["channel"], "simulated")
        self.assertEqual(d["delivery"]["status"], "simulated")

    def test_partially_configured_is_simulated(self):
        for missing in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "NOTIFY_TO"):
            env = {**CLEAR, **LIVE_ENV, missing: ""}
            with mock.patch.dict(os.environ, env), mock.patch("httpx.post") as post:
                r = self.notify(make_alert())
            post.assert_not_called()
            self.assertEqual(r.json()["delivery"]["channel"], "simulated", missing)

    def test_mode_must_be_whatsapp(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV, "NOTIFY_MODE": "simulated"}), \
                mock.patch("httpx.post") as post:
            r = self.notify(make_alert())
        post.assert_not_called()
        self.assertEqual(r.json()["delivery"]["status"], "simulated")

    # -------------------------------------------------------- live success ---
    def test_live_success(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", return_value=twilio_ok()) as post:
            r = self.notify(make_alert())
        self.assertEqual(r.status_code, 200)
        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertEqual(args[0], f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json")
        self.assertEqual(kwargs["auth"], (SID, TOKEN))
        self.assertEqual(kwargs["timeout"], 8.0)
        self.assertEqual(kwargs["data"]["From"], "whatsapp:+17372508034")
        self.assertEqual(kwargs["data"]["To"], f"whatsapp:{PHONE}")
        d = r.json()
        self.assertEqual(d["delivery"]["channel"], "whatsapp")
        self.assertEqual(d["delivery"]["status"], "sent")
        self.assertEqual(d["delivery"]["provider_id"], "SM_TEST_FAKE_MESSAGE_SID")
        self.assertTrue(d["delivery"]["sent_at"].endswith("+00:00"))
        self.assertIs(d["simulated"], False)
        self.assertEqual(d["status"], notifier.LIVE_STATUS)
        self.assertEqual(d["message"], kwargs["data"]["Body"])   # outbox shows what was sent
        self.assertNoSecrets(r.text)

    def test_from_override(self):
        env = {**CLEAR, **LIVE_ENV, "TWILIO_WHATSAPP_FROM": "whatsapp:+15550001111"}
        with mock.patch.dict(os.environ, env), \
                mock.patch("httpx.post", return_value=twilio_ok()) as post:
            self.notify(make_alert())
        self.assertEqual(post.call_args.kwargs["data"]["From"], "whatsapp:+15550001111")

    # -------------------------------------------------------- live failure ---
    def test_live_http_500_falls_back_to_simulated(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", return_value=twilio_error(500)):
            r = self.notify(make_alert())
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d["delivery"]["channel"], "whatsapp")
        self.assertEqual(d["delivery"]["status"], "failed")
        self.assertIn("HTTP 500", d["delivery"]["error"])
        self.assertIn("63016", d["delivery"]["error"])
        self.assertEqual(d["status"], notify.STATUS)       # recorded exactly as simulated
        self.assertIs(d["simulated"], True)
        self.assertNoSecrets(r.text)

    def test_live_timeout_falls_back_to_simulated(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", side_effect=httpx.ReadTimeout("timed out")):
            r = self.notify(make_alert())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["delivery"]["status"], "failed")
        self.assertEqual(r.json()["delivery"]["error"], "provider timeout")

    def test_live_any_exception_never_crashes(self):
        boom = RuntimeError(f"connection to {PHONE} with {TOKEN} failed")
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", side_effect=boom):
            r = self.notify(make_alert())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["delivery"]["error"], "provider error (RuntimeError)")
        self.assertNoSecrets(r.text)

    def test_failed_send_can_be_retried(self):
        a = make_alert()
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", side_effect=[twilio_error(500), twilio_ok()]) as post:
            first, second = self.notify(a), self.notify(a)
        self.assertEqual(post.call_count, 2)
        self.assertEqual(first.json()["delivery"]["status"], "failed")
        self.assertEqual(second.json()["delivery"]["status"], "sent")

    # --------------------------------------------------------- idempotency ---
    def test_second_click_does_not_send_again(self):
        a = make_alert()
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", return_value=twilio_ok()) as post:
            before = len(notify.outbox())
            first, second = self.notify(a), self.notify(a)
            after = len(notify.outbox())
        post.assert_called_once()
        self.assertEqual(after - before, 1)                 # no second outbox record
        self.assertEqual(second.json()["delivery"]["status"], "already_sent")
        self.assertEqual(second.json()["notification_id"], first.json()["notification_id"])
        self.assertEqual(second.json()["delivery"]["provider_id"],
                         first.json()["delivery"]["provider_id"])

    def test_live_send_cap(self):
        env = {**CLEAR, **LIVE_ENV, "NOTIFY_MAX_LIVE": "2"}
        with mock.patch.dict(os.environ, env), \
                mock.patch("httpx.post", return_value=twilio_ok()) as post:
            rs = [self.notify(make_alert()) for _ in range(3)]
        self.assertEqual(post.call_count, 2)
        self.assertEqual([r.json()["delivery"]["status"] for r in rs], ["sent", "sent", "failed"])
        self.assertEqual(rs[2].json()["delivery"]["channel"], "simulated")
        self.assertEqual(rs[2].json()["delivery"]["error"], "live send limit reached")

    def test_default_cap_is_20(self):
        with mock.patch.dict(os.environ, CLEAR):
            self.assertEqual(notifier.max_live(), 20)

    # ------------------------------------------------- refusals still hold ---
    def test_deadline_passed_still_refused_and_nothing_sent(self):
        a = make_alert(status="deadline_passed", usable_lead_minutes=-140.0)
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", return_value=twilio_ok()) as post:
            r = self.notify(a)
        self.assertEqual(r.status_code, 422)
        post.assert_not_called()

    def test_non_crew_alert_refused_and_nothing_sent(self):
        a = make_alert(category="passenger")
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", return_value=twilio_ok()) as post:
            r = self.notify(a)
        self.assertEqual(r.status_code, 422)
        post.assert_not_called()

    def test_unknown_alert_404(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), mock.patch("httpx.post") as post:
            r = self.client.post("/api/alerts/99999999/notify")
        self.assertEqual(r.status_code, 404)
        post.assert_not_called()

    # ------------------------------------------------------------- message ---
    def test_message_content_and_no_secrets(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}):
            role, ch, _ = notify.compose(make_alert())
            body = notifier.build_message(make_alert(), role, ch)
        self.assertLessEqual(len(body), notifier.MAX_MESSAGE_CHARS)
        self.assertTrue(body.startswith("FDPIS CREW ALERT [LIKELY] - FAA Part 117"))
        self.assertIn("Aircraft N822UA, 19 Jul 2025", body)
        self.assertIn("Projected FDP 12h07m vs limit 12h00m (leg 3 UA573, BOI-ORD)", body)
        self.assertIn("ACTION: Call out a standby crew at BOI to take over UA573 by 11:26 BOI "
                      "local (lead 3h20m)", body)
        self.assertIn("Recipient: Standby crew, base BOI (SMS)", body)
        self.assertNoSecrets(body)

    def test_message_omits_missing_fields(self):
        a = make_alert(predicted_value_minutes=None, flight=None, usable_lead_minutes=None,
                       predicted_basis="no number: the last leg is past the depth-2 confidence "
                                       "boundary", rule_id="crew_min_rest", comparator="lt",
                       action="Protect the next-day first departure from DTW: plan a rested crew")
        role, ch, _ = notify.compose(a)
        body = notifier.build_message(a, role, ch)
        self.assertIn("Rest minimum 12h00m: no number: the last leg is past the depth-2", body)
        self.assertNotIn("lead", body)
        self.assertNotIn("(leg ", body)          # no flight -> no leg segment
        self.assertIn("Recipient: Operating crew, tail N822UA (crew app push)", body)

    def test_message_capped_at_600(self):
        a = make_alert(action="x" * 2000)
        role, ch, _ = notify.compose(a)
        self.assertLessEqual(len(notifier.build_message(a, role, ch)), 600)

    # -------------------------------------------------------------- status ---
    def test_status_endpoint(self):
        with mock.patch.dict(os.environ, CLEAR):
            r = self.client.get("/api/notify/status")
        self.assertEqual(r.json(), {"live": False, "channel": "simulated"})
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}):
            r = self.client.get("/api/notify/status")
        self.assertEqual(r.json(), {"live": True, "channel": "whatsapp"})
        self.assertNoSecrets(r.text)

    def test_outbox_never_leaks(self):
        with mock.patch.dict(os.environ, {**CLEAR, **LIVE_ENV}), \
                mock.patch("httpx.post", side_effect=[twilio_ok(), twilio_error(400)]):
            self.notify(make_alert())
            self.notify(make_alert())
            r = self.client.get("/api/notifications")
        self.assertIs(r.json()["simulated"], False)
        self.assertNoSecrets(r.text)
        self.assertNoSecrets(json.dumps(notify.outbox()))


if __name__ == "__main__":
    unittest.main()
