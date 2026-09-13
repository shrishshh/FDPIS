"""Paths, constants and settings for the FDPIS API.

Nothing here is a modelling choice. Every value is either a filesystem path or a
constant lifted verbatim from the notebooks; the ones that came from a notebook
carry a comment naming their source so they can be traced.
"""
from pathlib import Path

# ---------------------------------------------------------------- paths ----
PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_PARQUET = PROJECT_ROOT / "data" / "processed.parquet"
LAYER3_MODEL = PROJECT_ROOT / "results" / "xgb_primary_classifier.json"
LAYER4_DIR = PROJECT_ROOT / "results" / "layer4"
LAYER4_CONFIG = LAYER4_DIR / "config.json"
GATE_MODEL = LAYER4_DIR / "xgb_gate.json"
HURDLE_MODELS = {
    "lower": LAYER4_DIR / "xgb_hurdle_lower.json",
    "median": LAYER4_DIR / "xgb_hurdle_median.json",
    "upper": LAYER4_DIR / "xgb_hurdle_upper.json",
}
CASCADE_CHAINS_PARQUET = LAYER4_DIR / "cascade_chains_integrated.parquet"

# ------------------------------------------------------------- layer 3 ----
# Feature groups exactly as notebook 2 defines them, minus D_encodings which was
# removed from production (see AUDIT_REPORT.md "PRODUCTION: ENCODINGS REMOVED").
# Order matters: XGBoost matched the training column order.
LAYER3_GROUPS = {
    "A_schedule": ["CRS_DEP_TIME", "CRS_ARR_TIME", "DEP_HOUR", "ARR_HOUR",
                   "CRS_ELAPSED_TIME", "DISTANCE", "SPEED_PROXY", "DAY_OF_WEEK",
                   "IS_WEEKEND"],
    "B_cyclical": ["DEP_HOUR_SIN", "DEP_HOUR_COS", "ARR_HOUR_SIN", "ARR_HOUR_COS",
                   "DOW_SIN", "DOW_COS"],
    "C_categorical": ["OP_UNIQUE_CARRIER", "ORIGIN", "DEST"],
    "E_congestion": ["ORIGIN_HOUR_DEPARTURES", "DEST_HOUR_ARRIVALS",
                     "ORIGIN_DAY_DEPARTURES", "CARRIER_ORIGIN_FLIGHTS",
                     "CARRIER_ORIGIN_SHARE"],
    "F_rotation": ["LEG_NUM", "TAIL_LEGS_TODAY", "LEG_FRACTION", "IS_LAST_LEG",
                   "MINUTES_INTO_TAIL_DAY", "SCHEDULED_BUFFER_MIN",
                   "AVAILABLE_SLACK", "IS_TIGHT_TURNAROUND", "LONG_GROUND_TIME"],
}
LAYER3_FEATURES = [f for g in LAYER3_GROUPS.values() for f in g]
LAYER3_CAT_COLS = ["OP_UNIQUE_CARRIER", "ORIGIN", "DEST"]
LAYER3_TARGET = "DEP_DEL15"

# The six cyclical features are the only engineered columns absent from the
# parquet - notebook 2 computes them, not notebook 1. See features.add_cyclical.
CYCLICAL_FEATURES = LAYER3_GROUPS["B_cyclical"]

# Chronological split, identical to notebook 2 (fractions of unique dates).
TRAIN_FRACTION = 0.70
VAL_FRACTION = 0.85

# ------------------------------------------------------------- layer 4 ----
# From notebook 5. Names kept identical so the provenance is obvious.
MAX_DEPTH = 5                 # nb5: MAX_DEPTH
ORIGIN_MIN_DELAY = 15         # nb5: ORIGIN_MIN_DELAY
SMOOTHING_M = 100             # nb5: M, Bayesian smoothing strength
LOWER_BOUND_GATE = 0.60       # nb5 predict_hop: lower bound only when confident
UPPER_BOUND_GATE = 0.10       # nb5 predict_hop: upper bound whenever plausible

# Depth beyond which the model publishes no number. Correlation falls under 0.33.
CONFIDENCE_DEPTH = 2
DEPTH_CORRELATION = {1: 0.674, 2: 0.428, 3: 0.327, 4: 0.233, 5: 0.226}

# --------------------------------------------------------------- server ----
CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
BRIEFING_CACHE_SIZE = 64
