"""Airport time zones.

BTS schedule times are LOCAL to each airport. Duty periods are elapsed time and
routinely cross zones (an ATL-DEN-LAX day spans three), so every leg is resolved
to UTC before any duration is computed. Zones come from `airportsdata` (IATA ->
IANA), the same mapping notebook 7 verified against METAR timestamps.
"""
from __future__ import annotations

from functools import lru_cache

import airportsdata
import pandas as pd


@lru_cache(maxsize=1)
def _airports() -> dict:
    return airportsdata.load("IATA")


def tz_for(iata: str) -> str:
    a = _airports().get(iata)
    if a is None or not a.get("tz"):
        raise KeyError(f"no time zone for airport {iata!r}")
    return a["tz"]


def local_to_utc(local_naive: pd.Series, airports: pd.Series) -> pd.Series:
    """Vectorised: naive local timestamps at each row's airport -> UTC."""
    out = pd.Series(pd.NaT, index=local_naive.index, dtype="datetime64[ns, UTC]")
    zones = airports.map(tz_for)
    for zone, idx in zones.groupby(zones).groups.items():
        out.loc[idx] = (local_naive.loc[idx].astype("datetime64[ns]")
                        .dt.tz_localize(zone, nonexistent="shift_forward", ambiguous="NaT")
                        .dt.tz_convert("UTC"))
    return out


def scheduled_utc(rows: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Scheduled departure and block-in in UTC for BTS rows.

    Departure: FL_DATE + CRS_DEP_TIME at the origin (2400 -> next day 00:00).
    Block-in: departure + scheduled block (CRS_ELAPSED_TIME). Using elapsed time
    rather than CRS_ARR_TIME avoids the day-rollover and time-zone artifacts the
    audit found in 1.76% of scheduled arrivals.
    """
    hhmm = rows["CRS_DEP_TIME"].astype(int)
    minutes = (hhmm // 100) * 60 + hhmm % 100
    dep_local = rows["FL_DATE"] + pd.to_timedelta(minutes, unit="m")
    dep_utc = local_to_utc(dep_local, rows["ORIGIN"])
    block = rows["CRS_ELAPSED_TIME"].astype(float).fillna(0)
    arr_utc = dep_utc + pd.to_timedelta(block, unit="m")
    return dep_utc, arr_utc


def fmt_local(ts_utc, iata: str) -> str | None:
    if ts_utc is None or pd.isna(ts_utc):
        return None
    return pd.Timestamp(ts_utc).tz_convert(tz_for(iata)).strftime("%H:%M")


def local_hhmm(ts_utc, iata: str) -> int:
    t = pd.Timestamp(ts_utc).tz_convert(tz_for(iata))
    return t.hour * 100 + t.minute

