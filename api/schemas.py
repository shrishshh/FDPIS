"""Pydantic request/response models for every endpoint."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ------------------------------------------------------------------ meta ---
class CategoryHealth(BaseModel):
    levels: int
    out_of_vocabulary_rows: int
    rows_with_value: int


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    models_loaded: list[str]
    parquet_rows: int
    date_min: str
    date_max: str
    date_count: int
    layer3_feature_count: int
    layer4_feature_count: int
    gate_threshold: float
    confidence_depth: int
    out_of_vocabulary: dict[str, CategoryHealth]
    primary_mean: float
    primary_median: float
    shrink: float
    recovery_rate: float
    using_historical_data: bool = Field(
        True, description="The API serves flights from the training dataset, "
                          "not a live feed. Labelled so the UI can say so.")


class DateCount(BaseModel):
    date: str
    flights: int


class CarrierCount(BaseModel):
    carrier: str
    flights: int


# -------------------------------------------------------------- briefing ---
class BriefingFlight(BaseModel):
    flight_id: str
    carrier: str
    flight_number: str
    tail: Optional[str]
    origin: str
    dest: str
    scheduled_dep: Optional[str]
    scheduled_arr: Optional[str]
    leg_num: Optional[int]
    total_legs: Optional[int]
    available_slack: Optional[float]
    risk_score: int = Field(..., description="predicted probability * 100, rounded")
    risk_band: Literal["low", "medium", "high"]
    actual_delay_minutes: Optional[float] = Field(
        None, description="HISTORICAL GROUND TRUTH from the dataset, not a "
                          "prediction. Present because this API serves past flights.")
    actually_delayed_15: Optional[bool] = Field(
        None, description="Historical ground truth: did this flight depart 15+ late.")


class BriefingResponse(BaseModel):
    date: str
    carrier: Optional[str]
    total_matching: int
    returned: int
    flights: list[BriefingFlight]


class BriefingSummary(BaseModel):
    date: str
    carrier: Optional[str]
    total_flights: int
    high_risk_count: int
    aircraft_affected: int
    mean_available_slack: Optional[float]


# -------------------------------------------------------------- rotation ---
class RotationLeg(BaseModel):
    leg_num: int
    flight_number: str
    origin: str
    dest: str
    scheduled_dep: Optional[str]
    scheduled_arr: Optional[str]
    available_slack: Optional[float]
    continuous_rotation: bool
    actual_dep_delay: Optional[float]
    actual_arr_delay: Optional[float]


class Rotation(BaseModel):
    tail: str
    date: str
    carrier: str
    total_legs: int
    legs: list[RotationLeg]


class RotationSummary(BaseModel):
    tail: str
    carrier: str
    legs: int
    first_origin: str
    last_dest: str


# ----------------------------------------------------------- propagation ---
class PropagateRequest(BaseModel):
    tail: str = Field(..., min_length=2, max_length=10)
    date: str = Field(..., description="YYYY-MM-DD")
    leg_num: int = Field(..., ge=1, le=20)
    observed_delay_minutes: float = Field(..., ge=0, le=1500)


class Hop(BaseModel):
    depth: int
    leg_num: int
    flight_number: str
    origin: str
    dest: str
    scheduled_dep: Optional[str]
    scheduled_arr: Optional[str]
    available_slack: Optional[float]
    inbound_delay: float
    inherited_delay: Optional[float]
    fresh_delay: Optional[float]
    total_delay: Optional[float] = Field(
        None, description="null beyond depth 2 - correlation falls under 0.33")
    interval_low: Optional[float]
    interval_high: Optional[float]
    gate_probability: float
    absorbed: bool
    confidence: Literal["high", "low"]
    correlation_at_depth: Optional[float]


class ChainSummary(BaseModel):
    legs_affected: int
    deepest_hop: int
    quantified_hops: int
    low_confidence_hops: int
    total_delay_minutes_added: float
    confidence_depth: int


class PropagateResponse(BaseModel):
    tail: str
    date: str
    origin_leg: int
    observed_delay_minutes: float
    observed_delay_source: Literal["user_input", "historical_actual"]
    hops: list[Hop]
    summary: ChainSummary
