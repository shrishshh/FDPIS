"""FDPIS API - serves the trained Layer 3 classifier and Layer 4 propagation models.

Run from the project root:
    uvicorn api.main:app --reload

Scope note: this API serves flights from data/processed.parquet - the same
historical dataset the models were trained and tested on. That is deliberate
(see README). Endpoints that return ground truth label it explicitly.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from functools import lru_cache

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import config, propagation, schemas
from .models import StartupError, load_bundle
from .performance_data import PERFORMANCE

log = logging.getLogger("fdpis.api")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

STATE: dict = {"bundle": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("loading models and flight data ...")
    STATE["bundle"] = load_bundle()
    b = STATE["bundle"]
    log.info("loaded %s flights | layer3 %d features | layer4 %d features | gate %.2f",
             f"{len(b.df):,}", len(config.LAYER3_FEATURES), len(b.prop_features),
             b.gate_threshold)
    log.info("primary_mean=%.2f primary_median=%.2f shrink=%.3f recovery=%.3f",
             b.primary_mean, b.primary_median, b.shrink, b.recovery_rate)
    yield
    STATE["bundle"] = None


app = FastAPI(
    title="FDPIS API",
    description="Flight Delay Propagation Intelligence System - model serving API.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def bundle():
    b = STATE.get("bundle")
    if b is None:
        raise HTTPException(503, "models not loaded")
    return b


def _parse_date(date: str) -> pd.Timestamp:
    try:
        return pd.Timestamp(date)
    except Exception:
        raise HTTPException(422, f"invalid date '{date}', expected YYYY-MM-DD")


def _hhmm(minutes):
    if pd.isna(minutes):
        return None
    m = int(minutes) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def _opt(v):
    return None if pd.isna(v) else float(v)


# --------------------------------------------------------------- health ---
@app.get("/api/health", response_model=schemas.Health)
def health():
    b = bundle()
    dates = np.sort(b.df["FL_DATE"].unique())
    return schemas.Health(
        status="ok",
        models_loaded=["layer3_classifier", "layer4_gate",
                       "layer4_hurdle_lower", "layer4_hurdle_median",
                       "layer4_hurdle_upper"],
        parquet_rows=int(len(b.df)),
        date_min=str(pd.Timestamp(dates[0]).date()),
        date_max=str(pd.Timestamp(dates[-1]).date()),
        date_count=len(dates),
        layer3_feature_count=len(config.LAYER3_FEATURES),
        layer4_feature_count=len(b.prop_features),
        gate_threshold=b.gate_threshold,
        confidence_depth=config.CONFIDENCE_DEPTH,
        out_of_vocabulary={k: schemas.CategoryHealth(**v) for k, v in b.oov_counts.items()},
        primary_mean=round(b.primary_mean, 2),
        primary_median=round(b.primary_median, 2),
        shrink=round(b.shrink, 3),
        recovery_rate=round(b.recovery_rate, 3),
    )


@app.get("/api/dates", response_model=list[schemas.DateCount])
def dates():
    b = bundle()
    g = b.df.groupby("FL_DATE").size().sort_index()
    return [schemas.DateCount(date=str(pd.Timestamp(d).date()), flights=int(n))
            for d, n in g.items()]


@app.get("/api/carriers", response_model=list[schemas.CarrierCount])
def carriers():
    b = bundle()
    g = b.df.groupby("OP_UNIQUE_CARRIER").size().sort_values(ascending=False)
    return [schemas.CarrierCount(carrier=str(c), flights=int(n)) for c, n in g.items()]


@app.get("/api/performance")
def performance():
    return PERFORMANCE


# ------------------------------------------------------------- briefing ---
@lru_cache(maxsize=config.BRIEFING_CACHE_SIZE)
def _scored_day(date_str: str, carrier: str | None) -> pd.DataFrame:
    """Score one day once, then cache. Keyed by (date, carrier) per design."""
    b = bundle()
    day = b.df[b.df["FL_DATE"] == pd.Timestamp(date_str)]
    if carrier:
        day = day[day["OP_UNIQUE_CARRIER"] == carrier]
    if day.empty:
        return day
    day = day.copy()
    day["risk_prob"] = b.score_layer3(day)
    # Bands are percentiles WITHIN the day, as specified.
    q = day["risk_prob"].rank(pct=True)
    day["risk_band"] = np.where(q >= 0.90, "high", np.where(q >= 0.60, "medium", "low"))
    return day.sort_values("risk_prob", ascending=False)


def _require_day(date_str: str, carrier: str | None) -> pd.DataFrame:
    b = bundle()
    if not (b.df["FL_DATE"] == pd.Timestamp(date_str)).any():
        raise HTTPException(404, f"no flights for date {date_str}")
    day = _scored_day(date_str, carrier)
    if day.empty:
        raise HTTPException(404, f"no flights for date {date_str} carrier {carrier}")
    return day


@app.get("/api/briefing", response_model=schemas.BriefingResponse)
def briefing(date: str = Query(..., description="YYYY-MM-DD"),
             carrier: str | None = Query(None, min_length=2, max_length=3),
             limit: int = Query(100, ge=1, le=5000)):
    _parse_date(date)
    day = _require_day(date, carrier)
    top = day.head(limit)

    flights = [
        schemas.BriefingFlight(
            flight_id=f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}"
                      f"-{r.TAIL_NUM}-{int(r.LEG_NUM)}",
            carrier=str(r.OP_UNIQUE_CARRIER),
            flight_number=f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}",
            tail=None if pd.isna(r.TAIL_NUM) else str(r.TAIL_NUM),
            origin=str(r.ORIGIN), dest=str(r.DEST),
            scheduled_dep=_hhmm(r.CRS_DEP_MIN), scheduled_arr=_hhmm(r.CRS_ARR_MIN),
            leg_num=None if pd.isna(r.LEG_NUM) else int(r.LEG_NUM),
            total_legs=None if pd.isna(r.TAIL_LEGS_TODAY) else int(r.TAIL_LEGS_TODAY),
            available_slack=_opt(r.AVAILABLE_SLACK),
            risk_score=int(round(float(r.risk_prob) * 100)),
            risk_band=str(r.risk_band),
            actual_delay_minutes=_opt(r.DEP_DELAY),
            actually_delayed_15=None if pd.isna(r.DEP_DEL15) else bool(r.DEP_DEL15),
        )
        for r in top.itertuples()
    ]
    return schemas.BriefingResponse(date=date, carrier=carrier,
                                    total_matching=int(len(day)),
                                    returned=len(flights), flights=flights)


@app.get("/api/flights/{tail}/{date}/{leg_num}", response_model=schemas.BriefingFlight)
def flight(tail: str, date: str, leg_num: int):
    """One flight leg, by tail/date/leg. Reuses the cached day-wide scoring
    that /api/briefing already computes, so this stays O(1) after the first
    lookup for that date rather than rescoring the whole day per flight."""
    _parse_date(date)
    day = _scored_day(date, None)
    if day.empty:
        raise HTTPException(404, f"no flights for date {date}")
    match = day[(day["TAIL_NUM"] == tail) & (day["LEG_NUM"] == leg_num)]
    if match.empty:
        raise HTTPException(404, f"no flight for tail {tail} on {date} leg {leg_num}")
    r = next(match.itertuples())
    return schemas.BriefingFlight(
        flight_id=f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}"
                  f"-{r.TAIL_NUM}-{int(r.LEG_NUM)}",
        carrier=str(r.OP_UNIQUE_CARRIER),
        flight_number=f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}",
        tail=None if pd.isna(r.TAIL_NUM) else str(r.TAIL_NUM),
        origin=str(r.ORIGIN), dest=str(r.DEST),
        scheduled_dep=_hhmm(r.CRS_DEP_MIN), scheduled_arr=_hhmm(r.CRS_ARR_MIN),
        leg_num=int(r.LEG_NUM),
        total_legs=None if pd.isna(r.TAIL_LEGS_TODAY) else int(r.TAIL_LEGS_TODAY),
        available_slack=_opt(r.AVAILABLE_SLACK),
        risk_score=int(round(float(r.risk_prob) * 100)),
        risk_band=str(r.risk_band),
        actual_delay_minutes=_opt(r.DEP_DELAY),
        actually_delayed_15=None if pd.isna(r.DEP_DEL15) else bool(r.DEP_DEL15),
    )


@app.get("/api/briefing/summary", response_model=schemas.BriefingSummary)
def briefing_summary(date: str = Query(...),
                     carrier: str | None = Query(None, min_length=2, max_length=3)):
    _parse_date(date)
    day = _require_day(date, carrier)
    high = day[day["risk_band"] == "high"]
    return schemas.BriefingSummary(
        date=date, carrier=carrier,
        total_flights=int(len(day)),
        high_risk_count=int(len(high)),
        aircraft_affected=int(high["TAIL_NUM"].nunique()),
        mean_available_slack=None if day["AVAILABLE_SLACK"].isna().all()
        else round(float(day["AVAILABLE_SLACK"].mean()), 1),
    )


# ------------------------------------------------------------- rotation ---
@app.get("/api/rotation/{tail}/{date}", response_model=schemas.Rotation)
def rotation(tail: str, date: str):
    b = bundle()
    d = _parse_date(date)
    day = b.df[(b.df["TAIL_NUM"] == tail) & (b.df["FL_DATE"] == d)]
    if day.empty:
        raise HTTPException(404, f"no rotation for tail {tail} on {date}")
    day = day.sort_values("LEG_NUM")
    legs = [
        schemas.RotationLeg(
            leg_num=int(r.LEG_NUM),
            flight_number=f"{r.OP_UNIQUE_CARRIER}{int(r.OP_CARRIER_FL_NUM)}",
            origin=str(r.ORIGIN), dest=str(r.DEST),
            scheduled_dep=_hhmm(r.CRS_DEP_MIN), scheduled_arr=_hhmm(r.CRS_ARR_MIN),
            available_slack=_opt(r.AVAILABLE_SLACK),
            continuous_rotation=bool(r.CONTINUOUS_ROTATION)
            if not pd.isna(r.CONTINUOUS_ROTATION) else False,
            actual_dep_delay=_opt(r.DEP_DELAY), actual_arr_delay=_opt(r.ARR_DELAY),
        )
        for r in day.itertuples()
    ]
    return schemas.Rotation(tail=tail, date=date,
                            carrier=str(day.iloc[0]["OP_UNIQUE_CARRIER"]),
                            total_legs=len(legs), legs=legs)


@app.get("/api/rotations", response_model=list[schemas.RotationSummary])
def rotations(date: str = Query(...),
              carrier: str | None = Query(None, min_length=2, max_length=3),
              min_legs: int = Query(3, ge=1, le=20)):
    b = bundle()
    d = _parse_date(date)
    day = b.df[b.df["FL_DATE"] == d]
    if carrier:
        day = day[day["OP_UNIQUE_CARRIER"] == carrier]
    if day.empty:
        raise HTTPException(404, f"no flights for date {date}")
    day = day[day["TAIL_NUM"].notna()].sort_values(["TAIL_NUM", "LEG_NUM"])

    # Vectorised: a per-tail Python loop took ~2.3s on a full day, which is too
    # slow for a dropdown. groupby().agg() does the same work in milliseconds.
    agg = day.groupby("TAIL_NUM", sort=False).agg(
        carrier=("OP_UNIQUE_CARRIER", "first"),
        legs=("LEG_NUM", "size"),
        first_origin=("ORIGIN", "first"),
        last_dest=("DEST", "last"),
    )
    agg = agg[agg["legs"] >= min_legs]
    agg = agg.sort_values("legs", ascending=False, kind="stable")

    return [
        schemas.RotationSummary(
            tail=str(t.Index), carrier=str(t.carrier), legs=int(t.legs),
            first_origin=str(t.first_origin), last_dest=str(t.last_dest))
        for t in agg.itertuples()
    ]


# ---------------------------------------------------------- propagation ---
def _run_propagation(tail: str, date: str, leg_num: int, observed: float,
                     source: str) -> schemas.PropagateResponse:
    b = bundle()
    try:
        result = propagation.traverse(b, tail, pd.Timestamp(date), leg_num, observed)
    except KeyError as e:
        raise HTTPException(404, str(e))
    return schemas.PropagateResponse(
        tail=tail, date=date, origin_leg=leg_num,
        observed_delay_minutes=round(float(observed), 2),
        observed_delay_source=source,
        hops=[schemas.Hop(**h) for h in result["hops"]],
        summary=schemas.ChainSummary(**result["summary"]),
    )


@app.post("/api/propagate", response_model=schemas.PropagateResponse)
def propagate(req: schemas.PropagateRequest):
    _parse_date(req.date)
    return _run_propagation(req.tail, req.date, req.leg_num,
                            req.observed_delay_minutes, "user_input")


@app.get("/api/cascade/{tail}/{date}/{leg_num}",
         response_model=schemas.PropagateResponse)
def cascade(tail: str, date: str, leg_num: int):
    """Propagate using the flight's ACTUAL historical arrival delay as input."""
    b = bundle()
    d = _parse_date(date)
    if leg_num < 1:
        raise HTTPException(422, "leg_num must be >= 1")
    row = b.df[(b.df["TAIL_NUM"] == tail) & (b.df["FL_DATE"] == d)
               & (b.df["LEG_NUM"] == leg_num)]
    if row.empty:
        raise HTTPException(404, f"no leg {leg_num} for tail {tail} on {date}")

    actual = row.iloc[0]["ARR_DELAY"]
    if pd.isna(actual):
        raise HTTPException(
            422, f"leg {leg_num} for {tail} on {date} has no recorded arrival delay "
                 f"(likely cancelled or diverted); use POST /api/propagate instead")

    return _run_propagation(tail, date, leg_num, max(float(actual), 0.0),
                            "historical_actual")
