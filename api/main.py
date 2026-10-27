"""FDPIS API - serves the trained Layer 3 classifier and Layer 4 propagation models.

Run from the project root:
    uvicorn api.main:app --reload

Scope note: this API serves flights from data/processed.parquet - the same
historical dataset the models were trained and tested on. That is deliberate
(see README). Endpoints that return ground truth label it explicitly.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import config, notifier, propagation, schemas
from .models import StartupError, load_bundle
from .layer5 import engine as layer5, feed as layer5_feed, notify as layer5_notify
from .performance_data import PERFORMANCE

log = logging.getLogger("fdpis.api")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

STATE: dict = {"bundle": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("loading models and flight data ...")
    STATE["bundle"] = load_bundle()
    b = STATE["bundle"]
    # Slim deployment: default day feeds precomputed at build time (api/slim.py).
    STATE["feeds"] = {}
    if os.environ.get("FDPIS_SLIM_DIR"):
        from .slim import load_feeds
        STATE["feeds"] = load_feeds(os.environ["FDPIS_SLIM_DIR"])
        log.info("precomputed alert feeds: %d", len(STATE["feeds"]))
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
def _allowed_origins() -> list[str]:
    """Deployment: ALLOWED_ORIGINS is a comma-separated list (the Vercel domain and
    http://localhost:3000). Unset, the local-dev defaults in config apply."""
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return origins or config.CORS_ORIGINS


# Largest JSON body any endpoint accepts. The biggest real request (a propagate or
# recommendation payload) is well under 1 KB.
MAX_BODY_BYTES = 16 * 1024


class BodySizeLimit:
    """Reject request bodies over MAX_BODY_BYTES with 413, whether or not the client
    sends Content-Length (chunked bodies are counted as they stream in)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        for k, v in scope.get("headers", []):
            if k == b"content-length" and v.isdigit() and int(v) > MAX_BODY_BYTES:
                return await _too_large(send)
        seen = 0

        async def limited_receive():
            nonlocal seen
            msg = await receive()
            if msg["type"] == "http.request":
                seen += len(msg.get("body", b""))
                if seen > MAX_BODY_BYTES:
                    raise _BodyTooLarge()
            return msg

        try:
            await self.app(scope, limited_receive, send)
        except _BodyTooLarge:
            await _too_large(send)


class _BodyTooLarge(HTTPException):
    # An HTTPException so FastAPI's body parser re-raises it as a 413 instead of
    # wrapping it in a generic 400.
    def __init__(self):
        super().__init__(413, "request body too large")


async def _too_large(send):
    body = b'{"detail":"request body too large"}'
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"),
                            (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.add_middleware(BodySizeLimit)


class TrimHeapAfterRequest:
    """Deployment on a 512 MB host (MALLOC_TRIM_AFTER_REQUEST=1): hand memory
    freed by a request back to the OS once the response is sent. Without it glibc
    keeps the alert feed's ~70 MB working set resident after every computation."""

    def __init__(self, app):
        self.app = app
        from .slim import release_heap
        self.release = release_heap

    async def __call__(self, scope, receive, send):
        try:
            await self.app(scope, receive, send)
        finally:
            if scope["type"] == "http":
                self.release(collect=False)


if os.environ.get("MALLOC_TRIM_AFTER_REQUEST") == "1":
    app.add_middleware(TrimHeapAfterRequest)


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
    meta = getattr(b, "dataset_meta", None)
    if meta:    # slim deployment: describe the whole dataset, as the full API does
        rows, dmin, dmax, dcount = (meta["parquet_rows"], meta["date_min"],
                                    meta["date_max"], meta["date_count"])
    else:
        dates = np.sort(b.df["FL_DATE"].unique())
        rows, dmin, dmax, dcount = (int(len(b.df)), str(pd.Timestamp(dates[0]).date()),
                                    str(pd.Timestamp(dates[-1]).date()), len(dates))
    return schemas.Health(
        status="ok",
        models_loaded=["layer3_classifier", "layer4_gate",
                       "layer4_hurdle_lower", "layer4_hurdle_median",
                       "layer4_hurdle_upper"],
        parquet_rows=rows,
        date_min=dmin,
        date_max=dmax,
        date_count=dcount,
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
    meta = getattr(b, "dataset_meta", None)
    if meta:
        return [schemas.CarrierCount(carrier=c, flights=n) for c, n in meta["carriers"]]
    g = b.df.groupby("OP_UNIQUE_CARRIER").size().sort_values(ascending=False)
    return [schemas.CarrierCount(carrier=str(c), flights=int(n)) for c, n in g.items()]


@app.get("/api/performance")
def performance():
    return PERFORMANCE


# ------------------------------------------------------------- briefing ---
# Deployment on a 512 MB host lowers this (each cached full day is ~6.5 MB).
@lru_cache(maxsize=int(os.environ.get("BRIEFING_CACHE_SIZE", config.BRIEFING_CACHE_SIZE)))
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


# ------------------------------------------------------ layer 5: rules ---
def _profile(name: str) -> dict:
    try:
        return layer5.load_profile(name)
    except KeyError as e:
        raise HTTPException(404, str(e))


@app.get("/api/rules")
def rules(profile: Optional[str] = Query(None, description="faa_part117 or dgca_fdtl; omit for all")):
    """The loaded rule sets, with source citations and verified flags."""
    names = [profile] if profile else layer5.list_profiles()
    return {
        "default_profile": layer5.DEFAULT_PROFILE,
        "profiles": [{**_profile(n), "unverified": layer5.unverified(_profile(n)),
                      "disclosure": layer5.disclosure(_profile(n))} for n in names],
    }


@app.post("/api/recommendations", response_model=schemas.RecommendationResponse)
def recommendations(req: schemas.RecommendationRequest):
    """Run Layer 4 propagation, then evaluate the rule profile against it.

    The seed is either the leg's arrival delay, or its departure delay converted
    with the recovery rate - the same conversion the departure-seeded feed uses.
    """
    _parse_date(req.date)
    _profile(req.profile)
    b = bundle()
    if req.departure_delay is not None:
        arrival = float(req.departure_delay) * b.recovery_rate
    else:
        arrival = float(req.arrival_delay)
    chain = _run_propagation(req.tail, req.date, req.leg_num, arrival, "user_input")
    result = layer5.recommend(b, req.profile, req.tail, req.date, req.leg_num, arrival,
                              {"hops": [h.model_dump() for h in chain.hops]},
                              departure_delay=req.departure_delay)
    return {"chain": chain, **result}


@app.get("/api/alerts", response_model=schemas.AlertFeed)
def alerts(date: str = Query(..., description="YYYY-MM-DD"),
           carrier: Optional[str] = Query(None),
           profile: str = Query(layer5.DEFAULT_PROFILE),
           crew_model: str = Query("single", description="single (default) or "
                                   "inferred_blocks (EXPERIMENTAL, hypothetical split points)"),
           seed_on: Optional[str] = Query(None, description="arrival or departure; omit for "
                                          "the default")):
    """Crew duty alert feed for a whole day, sorted by action deadline."""
    _parse_date(date)
    _profile(profile)
    if crew_model not in layer5.CREW_MODELS:
        raise HTTPException(422, f"crew_model must be one of {layer5.CREW_MODELS}")
    if seed_on is not None and seed_on not in layer5_feed.SEED_MODES:
        raise HTTPException(422, f"seed_on must be one of {layer5_feed.SEED_MODES}")
    pinned = STATE.get("feeds", {}).get(
        (profile, date, carrier, crew_model, seed_on or layer5_feed.DEFAULT_SEED_ON))
    if pinned is not None:
        return pinned
    try:
        return layer5_feed.day_feed(bundle(), profile, date, carrier, crew_model, seed_on)
    except KeyError as e:
        raise HTTPException(404, str(e))


@app.post("/api/alerts/{alert_id}/notify", response_model=schemas.Notification)
def notify_alert(alert_id: int):
    """Create a crew notification from an alert. SIMULATED unless the server has
    a live WhatsApp demo channel configured (api/notifier.py); then it is sent
    once to the single demo recipient. The provider can never fail this call."""
    alert = layer5.REGISTRY.get(alert_id)
    if alert is None:
        raise HTTPException(404, f"no alert #{alert_id} (alerts are registered when a feed or "
                                 f"recommendation is generated)")
    try:
        layer5_notify.validate(alert)            # refuse before anything is sent
        return notifier.deliver(
            alert, lambda delivery, live=False, message=None:
            layer5_notify.create(alert, delivery=delivery, live=live, message=message))
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/api/notify/status", response_model=schemas.NotifyStatus)
def notify_status():
    """Whether notifications go to a live WhatsApp demo channel. No secrets, no number."""
    return notifier.status()


@app.get("/api/notifications", response_model=schemas.NotificationOutbox)
def notifications():
    """The notification outbox, newest first. Simulated unless a record's
    delivery says it was sent."""
    live = notifier.is_live()
    return {"simulated": not live,
            "notice": notifier.LIVE_OUTBOX_NOTICE if live else layer5_notify.NOTICE,
            "notifications": layer5_notify.outbox()}
