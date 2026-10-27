"""Simulated crew notification outbox.

NOTHING IS SENT. No SMS gateway, email service or push provider is integrated.
A notification here is a record of what WOULD be sent, written to an in-memory
list that dies with the process. Recipients are ROLES ("Standby crew, base ORD"),
never people: crew rosters are not public, so there is nobody to address.
"""
from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock

STATUS = "SIMULATED — not sent"
NOTICE = ("Simulated notification. No SMS, email or push service is connected and no "
          "message has left this system. Recipients are roles, not people, because airline "
          "crew rosters are not public.")

_OUTBOX: list[dict] = []
_LOCK = Lock()
# The API is public: the outbox keeps at most this many records, oldest dropped
# first. It is never written to disk.
OUTBOX_MAX = 200
_NEXT_ID = 1

_WHAT = {
    "crew_fdp_limit": "Projected FDP exceedance",
    "crew_fdp_extension_limit": "Projected FDP beyond the maximum extension - crew change required",
    "crew_duty_period_limit": "Projected duty-period exceedance",
}


def compose(alert: dict) -> tuple[str, str, str]:
    """(recipient_role, channel, message) for a crew alert."""
    f = alert.get("flight") or {}
    st = alert.get("deadline_station") or f.get("origin") or "?"
    when = alert.get("deadline_local") or "--:--"
    if alert["rule_id"] == "crew_min_rest":
        role = f"Operating crew, tail {alert['tail']}"
        msg = (f"Operating crew {alert['tail']}: projected rest before your next report at {st} "
               f"is below the minimum under {alert['profile_name']}. Expect reassignment; "
               f"confirm availability by {when} local. Ref alert #{alert['id']}.")
        return role, "crew app push", msg
    role = f"Standby crew, base {st}"
    leg = f"leg {f.get('leg_num')} ({f.get('origin')}-{f.get('dest')})" if f else "the rotation"
    what = _WHAT.get(alert["rule_id"], alert["rule_id"])
    if alert["severity"] == "WATCH":
        tail_note = ("watch - not quantified" if alert.get("watch_reason") == "beyond_depth_2"
                     else "watch - upper bound only")
        what = f"Possible {what[0].lower()}{what[1:]} ({tail_note})"
    msg = (f"Standby crew {st}: report by {when} local. {what} on {alert['tail']} {leg} "
           f"under {alert['profile_name']}. Ref alert #{alert['id']}.")
    return role, "SMS", msg


def validate(alert: dict) -> None:
    """Raise ValueError if this alert must not produce a notification."""
    if alert.get("category") != "crew":
        raise ValueError("only crew alerts can generate a crew notification")
    if alert.get("status") == "deadline_passed":
        raise ValueError("the action deadline had already passed when this alert fired "
                         f"(usable lead {alert.get('usable_lead_minutes')} min); notifying a "
                         "crew now would be useless")


def create(alert: dict, delivery: dict | None = None, live: bool = False,
           message: str | None = None) -> dict:
    """Append an outbox record. By default exactly the simulated record. With
    live=True (api/notifier.py, after a successful WhatsApp send) the status
    fields say it was delivered and `message` is the text actually sent."""
    validate(alert)
    global _NEXT_ID
    role, channel, msg = compose(alert)
    if live:
        from ..notifier import LIVE_NOTICE, LIVE_STATUS
    with _LOCK:
        rec = {
            "notification_id": _NEXT_ID,
            "alert_id": alert["id"],
            "recipient_role": role,
            "channel": channel,
            "message": message if (live and message) else msg,
            "created_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "status": LIVE_STATUS if live else STATUS,
            "simulated": not live,
            "notice": LIVE_NOTICE if live else NOTICE,
            "alert": {k: alert.get(k) for k in ("rule_id", "severity", "tail", "date",
                                                "profile", "deadline_local", "deadline_station")},
        }
        if delivery is not None:
            rec["delivery"] = delivery
        _NEXT_ID += 1
        _OUTBOX.append(rec)
        del _OUTBOX[:-OUTBOX_MAX]
    return rec


def outbox() -> list[dict]:
    with _LOCK:
        return list(reversed(_OUTBOX))
