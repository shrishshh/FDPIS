"""Optional live delivery of crew notifications to ONE demo recipient, over
Telegram (Bot API) or WhatsApp (Twilio). Off unless every variable for the
chosen channel is set.

    NOTIFY_MODE            "simulated" (default) | "telegram" | "whatsapp"
    NOTIFY_MAX_LIVE        live send attempts per process, default 20

  telegram (both required):
    TELEGRAM_BOT_TOKEN     bot token from @BotFather
    TELEGRAM_CHAT_ID       the demo recipient's chat id

  whatsapp (Twilio; free-form text needs a sender that may send it - a trial
  number only sends pre-approved templates, error 21654):
    TWILIO_ACCOUNT_SID     required
    TWILIO_AUTH_TOKEN      required
    NOTIFY_TO              required, e.g. whatsapp:+91XXXXXXXXXX
    TWILIO_WHATSAPP_FROM   default whatsapp:+17372508034

Anything missing or invalid -> behaviour is exactly the simulated outbox of
api/layer5/notify.py. The provider can never break the endpoint: every error is
caught and reduced to a short message that never contains a token, SID, chat
id or recipient number (scrubbed as a second line of defence).

Values are read from the environment on every call and never logged. httpx's
own request logging is raised to WARNING here because it logs the request URL
at INFO, and both providers put a credential in the URL (the Twilio account
SID; the whole Telegram bot token).
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

for _name in ("httpx", "httpcore"):
    logging.getLogger(_name).setLevel(logging.WARNING)

DEFAULT_FROM = "whatsapp:+17372508034"
DEFAULT_MAX_LIVE = 20
TIMEOUT_S = 8.0
TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
TELEGRAM_URL = "https://api.telegram.org/bot{token}/sendMessage"
MAX_MESSAGE_CHARS = 600

CHANNELS = ("telegram", "whatsapp")
_REQUIRED = {"telegram": ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"),
             "whatsapp": ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "NOTIFY_TO")}
_NAME = {"telegram": "Telegram", "whatsapp": "WhatsApp"}


def live_status(ch: str) -> str:
    return f"DELIVERED via {_NAME[ch]} (demo recipient)"


def live_notice(ch: str) -> str:
    return (f"Delivered by {_NAME[ch]} to the single demo recipient configured on the server. "
            "Recipients named in the message are roles, not people: airline crew rosters "
            "are not public.")


def live_outbox_notice(ch: str) -> str:
    return (f"A live {_NAME[ch]} demo channel is enabled: entries marked as delivered "
            "were sent to the single demo recipient configured on the server. All "
            "other entries are simulated. Recipients named in messages are roles, not "
            "people, because airline crew rosters are not public.")


# WhatsApp wording, kept as constants for existing callers.
LIVE_STATUS = live_status("whatsapp")
LIVE_NOTICE = live_notice("whatsapp")
LIVE_OUTBOX_NOTICE = live_outbox_notice("whatsapp")

_LOCK = Lock()                 # serialises live sends: check, send and record are atomic
_SENT: dict[int, dict] = {}    # alert id -> the outbox record of its successful live send
_ATTEMPTS = 0                  # live send attempts made by this process


# ---------------------------------------------------------------- config ---
def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _secrets() -> list[str]:
    vals = [_env("TWILIO_ACCOUNT_SID"), _env("TWILIO_AUTH_TOKEN"), _env("NOTIFY_TO"),
            _env("TELEGRAM_BOT_TOKEN"), _env("TELEGRAM_CHAT_ID")]
    to = _env("NOTIFY_TO")
    if to:
        bare = to.split(":", 1)[-1]
        vals += [bare, bare.lstrip("+")]
    token = _env("TELEGRAM_BOT_TOKEN")
    if ":" in token:                            # "<bot id>:<secret>": the secret part alone too
        vals.append(token.split(":", 1)[1])
    chat = _env("TELEGRAM_CHAT_ID")
    if chat.startswith("-"):                    # group ids are negative
        vals.append(chat.lstrip("-"))
    # Longest first, so a whole token is replaced before any part of it.
    return sorted({v for v in vals if len(v) >= 4}, key=len, reverse=True)


def channel() -> str:
    """The live channel the server is configured for, or "simulated"."""
    mode = _env("NOTIFY_MODE").lower()
    if mode in CHANNELS and all(_env(k) for k in _REQUIRED[mode]):
        return mode
    return "simulated"


def is_live() -> bool:
    return channel() != "simulated"


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


def send_telegram(body: str) -> dict:
    """POST one message through the Telegram Bot API. Never raises."""
    token, chat = _env("TELEGRAM_BOT_TOKEN"), _env("TELEGRAM_CHAT_ID")
    try:
        import httpx

        r = httpx.post(TELEGRAM_URL.format(token=token),
                       data={"chat_id": chat, "text": body}, timeout=TIMEOUT_S)
        try:
            j = r.json()
        except ValueError:
            j = {}
        if r.status_code == 200 and j.get("ok") is True:
            mid = (j.get("result") or {}).get("message_id")
            return {"channel": "telegram", "status": "sent",
                    "provider_id": None if mid is None else str(mid)}
        desc = j.get("description")
        head = (f"provider returned HTTP {r.status_code}" if r.status_code != 200
                else "provider returned ok=false")
        err = head + (f" (Telegram: {desc})" if desc else "")
        return {"channel": "telegram", "status": "failed", "error": scrub(err)}
    except Exception as e:                      # timeouts, DNS, TLS, bad config ...
        name = type(e).__name__
        err = "provider timeout" if "Timeout" in name else f"provider error ({name})"
        return {"channel": "telegram", "status": "failed", "error": scrub(err)}


_SENDERS = {"telegram": send_telegram, "whatsapp": send_whatsapp}


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
    ch = channel()
    if ch == "simulated":
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
        result = _SENDERS[ch](body)
        if result["status"] == "sent":
            rec = make_record({"channel": ch, "status": "sent",
                               "provider_id": result.get("provider_id"), "sent_at": _now(),
                               "error": None},
                              live=True, message=body)
            _SENT[aid] = rec
            return rec
        return make_record({"channel": ch, "status": "failed", "provider_id": None,
                            "sent_at": None, "error": result.get("error")})


def status() -> dict:
    ch = channel()
    return {"live": ch != "simulated", "channel": ch}


def _reset_for_tests() -> None:
    global _ATTEMPTS
    with _LOCK:
        _SENT.clear()
        _ATTEMPTS = 0
