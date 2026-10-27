"""Pydantic request/response models for every endpoint."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


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


# ------------------------------------------------- layer 5 (rule engine) ---
class RecommendationRequest(BaseModel):
    """Exactly one of arrival_delay / departure_delay.

    arrival_delay    the disrupted leg's arrival delay (minutes)
    departure_delay  its departure delay; converted to an arrival delay with the
                     Layer 4 recovery rate (x 0.895), exactly as the departure-seeded
                     /api/alerts feed does. Lead times are then measured from the
                     leg's actual departure.
    """
    tail: str = Field(..., min_length=2, max_length=10)
    date: str = Field(..., description="YYYY-MM-DD")
    leg_num: int = Field(..., ge=1, le=20)
    arrival_delay: Optional[float] = Field(None, ge=0, le=1500)
    departure_delay: Optional[float] = Field(None, ge=0, le=1500)
    profile: str = Field("faa_part117", description="Rule profile: faa_part117 or dgca_fdtl")

    @model_validator(mode="after")
    def exactly_one_delay(self):
        if (self.arrival_delay is None) == (self.departure_delay is None):
            raise ValueError("give exactly one of arrival_delay or departure_delay")
        return self


class RecommendationSeed(BaseModel):
    kind: Literal["arrival", "departure"]
    input_minutes: float
    arrival_delay_used: float = Field(..., description="arrival delay fed to Layer 4; for a "
                                      "departure seed = departure_delay x recovery rate")
    recovery_rate: Optional[float]
    information_time_utc: Optional[str] = Field(
        None, description="when the seed delay is first known; lead times are measured from here")


class AlertFlight(BaseModel):
    flight_number: str
    leg_num: int
    origin: str
    dest: str
    depth: Optional[int] = Field(None, description="hops downstream of the seed; 0 = the seed leg")
    scheduled_dep_local: Optional[str]


class AlertDuty(BaseModel):
    report_time_local: Optional[str]
    report_station: Optional[str]
    segments: int
    fdp_limit_minutes: Optional[float]
    projected_duty_end_local: Optional[str]
    projected_duty_end_station: Optional[str]
    fdp_projected_median_minutes: Optional[float]
    fdp_projected_upper_minutes: Optional[float]
    seed_leg: Optional[int]
    seed_arrival_delay_minutes: Optional[float]


class DutyBlock(BaseModel):
    index: int
    count: int
    first_leg: int
    last_leg: int
    label: str = Field(..., description="inferred duty block - hypothetical, not a roster")


class Alert(BaseModel):
    id: int
    rule_id: str
    category: Literal["crew", "passenger"]
    severity: Literal["LIKELY", "WATCH"]
    watch_reason: Optional[Literal["upper_bound_only", "beyond_depth_2"]] = Field(
        None, description="WATCH only: upper_bound_only (only the interval upper bound "
                          "crosses) or beyond_depth_2 (no number past the confidence boundary)")
    profile: str
    profile_name: str
    tail: str
    date: str
    flight: Optional[AlertFlight]
    predicted_value_minutes: Optional[float] = Field(
        None, description="null for WATCH beyond_depth_2: past the depth-2 boundary there is no number")
    predicted_basis: str
    threshold_minutes: float
    comparator: Literal["gt", "gte", "lt"]
    margin_minutes: Optional[float]
    description: str
    detail: str
    action: str
    source: str
    verified: bool
    deadline_utc: Optional[str]
    deadline_local: Optional[str]
    deadline_station: Optional[str]
    crew_proxy: bool = Field(..., description="True when based on the rotation crew proxy, "
                                              "not real crew assignments")
    proxy_disclosure: Optional[str]
    duty: Optional[AlertDuty] = None
    status: Literal["actionable", "deadline_passed"] = "actionable"
    usable_lead_minutes: Optional[float] = Field(
        None, description="action deadline minus the seed leg's actual arrival (when the "
                          "information first existed); <= 0 means deadline_passed")
    crew_model: Optional[Literal["single", "inferred_blocks"]] = None
    duty_block: Optional[DutyBlock] = None


class CrewProjection(BaseModel):
    status: Literal["ok", "at_risk", "proxy_not_applicable", "breached_at_seed", "no_rotation"]
    status_reason: str
    report_time_utc: Optional[str]
    report_time_local: Optional[str]
    report_station: Optional[str]
    segments: int
    scheduled_block_minutes: float
    fdp_limit_minutes: Optional[float]
    fdp_scheduled_minutes: Optional[float]
    fdp_projected_median_minutes: Optional[float]
    fdp_projected_upper_minutes: Optional[float]
    duty_end_median_utc: Optional[str]
    duty_end_median_local: Optional[str]
    duty_end_station: Optional[str]
    last_leg_quantified: bool
    next_report_utc: Optional[str]
    disclosure: str


class Unverified(BaseModel):
    rules: list[str]
    assumptions: list[str]


class RecommendationResponse(BaseModel):
    chain: PropagateResponse
    seed: RecommendationSeed
    profile: str
    profile_name: str
    disclosure: str
    unverified: Unverified
    crew_projection: CrewProjection
    alerts: list[Alert]


class FeedSummary(BaseModel):
    aircraft: int
    aircraft_with_delay_seed: int
    rotations_by_status: dict[str, int]
    aircraft_days_covered: int
    coverage_share: float
    alerts_deadline_passed: int
    crews_flagged: int
    alerts_by_severity: dict[str, int]
    watch_by_reason: dict[str, int]
    next_day_in_dataset: bool
    seed_rule: str


class AlertFeed(BaseModel):
    date: str
    carrier: Optional[str]
    profile: str
    profile_name: str
    crew_model: Literal["single", "inferred_blocks"]
    crew_model_label: str
    seed_on: Literal["arrival", "departure"]
    disclosure: str
    unverified: Unverified
    summary: FeedSummary
    alerts: list[Alert]


class Delivery(BaseModel):
    """How a notification left (or did not leave) the system."""
    channel: Literal["telegram", "whatsapp", "simulated"]
    status: Literal["sent", "already_sent", "failed", "simulated"]
    provider_id: Optional[str] = None
    sent_at: Optional[str] = None
    error: Optional[str] = None


class Notification(BaseModel):
    notification_id: int
    alert_id: int
    recipient_role: str
    channel: Literal["SMS", "crew app push"]
    message: str
    created_utc: str
    status: Literal["SIMULATED — not sent", "DELIVERED via Telegram (demo recipient)",
                    "DELIVERED via WhatsApp (demo recipient)"]
    simulated: bool
    notice: str
    alert: dict
    delivery: Optional[Delivery] = None


class NotificationOutbox(BaseModel):
    simulated: bool = True
    notice: str
    notifications: list[Notification]


class NotifyStatus(BaseModel):
    live: bool
    channel: Literal["telegram", "whatsapp", "simulated"]
