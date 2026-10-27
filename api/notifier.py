"""Optional live delivery of crew notifications to ONE demo recipient over the
Twilio WhatsApp API (sandbox). Off unless every variable below is set.

    NOTIFY_MODE            "simulated" (default) | "whatsapp"
    TWILIO_ACCOUNT_SID     required for live
    TWILIO_AUTH_TOKEN      required for live
    NOTIFY_TO              required for live, e.g. whatsapp:+91XXXXXXXXXX
    TWILIO_WHATSAPP_FROM   default whatsapp:+17372508034 (the sandbox sender)
    NOTIFY_MAX_LIVE        live send attempts per process, default 20

Anything missing or invalid -> behaviour is exactly the simulated outbox of
api/layer5/notify.py. The provider can never break the endpoint: every error is
caught and reduced to a short message that never contains the account SID,
the token or the recipient number (scrubbed as a second line of defence).

Values are read from the environment on every call and never logged.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

DEFAULT_FROM = "whatsapp:+17372508034"
DEFAULT_MAX_LIVE = 20
TIMEOUT_S = 8.0
TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
MAX_MESSAGE_CHARS = 600

LIVE_STATUS = "DELIVERED via WhatsApp (demo recipient)"
LIVE_NOTICE = ("Delivered by WhatsApp to the single demo recipient configured on the server. "
               "Recipients named in the message are roles, not people: airline crew rosters "
               "are not public.")

LIVE_OUTBOX_NOTICE = ("A live WhatsApp demo channel is enabled: entries marked as delivered "
                      "were sent to the single demo recipient configured on the server. All "
                      "other entries are simulated. Recipients named in messages are roles, not "
                      "people, because airline crew rosters are not public.")

_LOCK = Lock()                 # serialises live sends: check, send and record are atomic
_SENT: dict[int, dict] = {}    # alert id -> the outbox record of its successful live send
_ATTEMPTS = 0                  # live send attempts made by this process


# ---------------------------------------------------------------- config ---
def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _secrets() -> list[str]:
    vals = [_env("TWILIO_ACCOUNT_SID"), _env("TWILIO_AUTH_TOKEN"), _env("NOTIFY_TO")]
    to = _env("NOTIFY_TO")
    if to:
        bare = to.split(":", 1)[-1]
        vals += [bare, bare.lstrip("+")]
    return [v for v in vals if len(v) >= 4]


def is_live() -> bool:
    return (_env("NOTIFY_MODE").lower() == "whatsapp"
            and all(_env(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "NOTIFY_TO")))


def channel() -> str:
    return "whatsapp" if is_live() else "simulated"


def max_live() -> int:
    try:
        return max(0, int(_env("NOTIFY_MAX_LIVE") or DEFAULT_MAX_LIVE))
    except ValueError:
        return DEFAULT_MAX_LIVE


def scrub(text: str) -> str:
    """Remove every configured secret and the recipient number from `text`, and
    any phone-number-like digit run, so nothing sensitive reaches a response."""
    for s in _secrets():
        text = text.replace(s, "[redacted]")
    return re.sub(r"\+?\d[\d\s-]{7,}\d", "[redacted]", text)[:200]


# ------------------------------------------------------------------ send ---
def send_whatsapp(body: str) -> dict:
    """POST one message to Twilio. Never raises."""
    sid, token, to = _env("TWILIO_ACCOUNT_SID"), _env("TWILIO_AUTH_TOKEN"), _env("NOTIFY_TO")
    try:
        import httpx

        r = httpx.post(TWILIO_URL.format(sid=sid),
                       data={"From": _env("TWILIO_WHATSAPP_FROM") or DEFAULT_FROM,
                             "To": to, "Body": body},
                       auth=(sid, token), timeout=TIMEOUT_S)
        if 200 <= r.status_code < 300:
            try:
                provider_id = r.json().get("sid")
            except ValueError:
                provider_id = None
            return {"channel": "whatsapp", "status": "sent", "provider_id": provider_id}
        code = None
        try:
            code = r.json().get("code")         # Twilio's numeric error code only
        except ValueError:
            pass
        err = f"provider returned HTTP {r.status_code}" + (f" (Twilio error {code})" if code else "")
        return {"channel": "whatsapp", "status": "failed", "error": scrub(err)}
    except Exception as e:                      # timeouts, DNS, TLS, bad config ...
        name = type(e).__name__
        err = "provider timeout" if "Timeout" in name else f"provider error ({name})"
        return {"channel": "whatsapp", "status": "failed", "error": scrub(err)}


# --------------------------------------------------------------- message ---
_QUANTITY = {"crew_fdp_limit": "FDP", "crew_fdp_extension_limit": "FDP",
             "crew_duty_period_limit": "Duty period", "crew_min_rest": "Rest"}


def _hm(minutes) -> Optional[str]:
    if minutes is None:
        return None
    m = int(round(float(minutes)))
    return f"{m // 60}h{m % 60:02d}m"


def _day(date: Optional[str]) -> Optional[str]:
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%d %b %Y").lstrip("0")
    except (TypeError, ValueError):
        return None


def build_message(alert: dict, role: str, role_channel: str) -> str:
    """One plain-text message from fields that exist on the alert. A line whose
    fields are missing is left out; nothing is invented."""
    lines = []
    sev, prof = alert.get("severity"), alert.get("profile_name")
    if sev and prof:
        lines.append(f"FDPIS CREW ALERT [{sev}] - {prof}")
    tail, day = alert.get("tail"), _day(alert.get("date"))
    if tail:
        lines.append(f"Aircraft {tail}" + (f", {day}" if day else ""))

    qty = _QUANTITY.get(alert.get("rule_id"), "Duty")
    bound = "minimum" if alert.get("comparator") in ("lt", "lte") else "limit"
    pred, thr = _hm(alert.get("predicted_value_minutes")), _hm(alert.get("threshold_minutes"))
    f = alert.get("flight") or {}
    where = ""
    if f.get("leg_num") and f.get("origin") and f.get("dest"):
        fl = f" {f['flight_number']}" if f.get("flight_number") else ""
        where = f" (leg {f['leg_num']}{fl}, {f['origin']}-{f['dest']})"
    if pred and thr:
        basis = alert.get("predicted_basis")
        note = f", {basis}" if basis and basis != "median prediction" else ""
        lines.append(f"Projected {qty} {pred} vs {bound} {thr}{where}{note}")
    elif thr and alert.get("predicted_basis"):
        lines.append(f"{qty} {bound} {thr}{where}: {alert['predicted_basis']}")

    action, when, st = alert.get("action"), alert.get("deadline_local"), alert.get("deadline_station")
    if action:
        by = f" by {when} {st} local" if when and st else ""
        lead = alert.get("usable_lead_minutes")
        lead_txt = f" (lead {_hm(lead)})" if lead is not None and lead > 0 else ""
        lines.append(f"ACTION: {action}{by}{lead_txt}")
    if role:
        lines.append(f"Recipient: {role} ({role_channel})")
    ref = f"Ref alert #{alert['id']}. " if alert.get("id") is not None else ""
    lines.append(f"{ref}Sent by FDPIS decision-support demo")
    text = "\n".join(lines)
    return text if len(text) <= MAX_MESSAGE_CHARS else text[:MAX_MESSAGE_CHARS - 3] + "..."


# --------------------------------------------------------------- deliver ---
def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def deliver(alert: dict, make_record) -> dict:
    """Notify one alert that has already passed notify.validate().

    `make_record(delivery, live=False, message=None)` appends an outbox record
    (api/layer5/notify.create) and returns it. Not live: exactly today's
    simulated record plus `delivery`. Live: at most one successful send per
    alert id, at most max_live() attempts per process; a sent record carries
    the message actually delivered and status fields that say so."""
    global _ATTEMPTS
    if not is_live():
        return make_record({"channel": "simulated", "status": "simulated",
                            "provider_id": None, "sent_at": None, "error": None})
    with _LOCK:
        aid = alert.get("id")
        if aid in _SENT:                        # double-click: never send twice
            prev = _SENT[aid]
            return {**prev, "delivery": {**prev["delivery"], "status": "already_sent"}}
        if _ATTEMPTS >= max_live():
            return make_record({"channel": "simulated", "status": "failed", "provider_id": None,
                                "sent_at": None, "error": "live send limit reached"})
        _ATTEMPTS += 1
        from .layer5.notify import compose
        role, role_channel, _ = compose(alert)
        body = build_message(alert, role, role_channel)
        result = send_whatsapp(body)
        if result["status"] == "sent":
            rec = make_record({"channel": "whatsapp", "status": "sent",
                               "provider_id": result.get("provider_id"), "sent_at": _now(),
                               "error": None},
                              live=True, message=body)
            _SENT[aid] = rec
            return rec
        return make_record({"channel": "whatsapp", "status": "failed", "provider_id": None,
                            "sent_at": None, "error": result.get("error")})


def status() -> dict:
    live = is_live()
    return {"live": live, "channel": "whatsapp" if live else "simulated"}


def _reset_for_tests() -> None:
    global _ATTEMPTS
    with _LOCK:
        _SENT.clear()
        _ATTEMPTS = 0
