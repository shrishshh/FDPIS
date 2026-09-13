"""Published model metrics, served as static JSON by GET /api/performance.

These are the current PRODUCTION figures (32-feature model). Sources are named
so each number can be traced back to the notebook that produced it.
"""

PERFORMANCE = {
    "model_version": "32-feature production (encodings removed 2026-09-13)",
    "classifier": {
        "auc": 0.6924, "f1": 0.360, "precision_at_1pct": 0.781,
        "precision_at_5pct": 0.458, "precision_at_10pct": 0.380,
        "features": 32, "training_rows": 1067167, "test_rows": 223101,
        "base_delay_rate": 0.156, "lift_at_1pct": 5.0,
        "source": "fdpis_2_modelling.ipynb, blend (soft vote)",
    },
    "ablation": {
        "note": "Cumulative feature groups. D_encodings is retained in the study "
                "but excluded from the production model.",
        "rows": [
            {"group": "A_schedule",    "n_feat": 9,  "auc": 0.6357, "auc_gain": None,     "pr_auc": 0.2275, "f1": 0.322, "p1": 0.280, "p5": 0.277, "p10": 0.265},
            {"group": "B_cyclical",    "n_feat": 15, "auc": 0.6385, "auc_gain": 0.0028,  "pr_auc": 0.2345, "f1": 0.321, "p1": 0.316, "p5": 0.303, "p10": 0.279},
            {"group": "C_categorical", "n_feat": 18, "auc": 0.6519, "auc_gain": 0.0134,  "pr_auc": 0.2476, "f1": 0.330, "p1": 0.374, "p5": 0.314, "p10": 0.293},
            {"group": "D_encodings",   "n_feat": 26, "auc": 0.6388, "auc_gain": -0.0131, "pr_auc": 0.2400, "f1": 0.319, "p1": 0.355, "p5": 0.309, "p10": 0.290},
            {"group": "E_congestion",  "n_feat": 31, "auc": 0.6410, "auc_gain": 0.0022,  "pr_auc": 0.2420, "f1": 0.322, "p1": 0.366, "p5": 0.313, "p10": 0.293},
            {"group": "F_rotation",    "n_feat": 40, "auc": 0.6777, "auc_gain": 0.0367,  "pr_auc": 0.3239, "f1": 0.348, "p1": 0.779, "p5": 0.456, "p10": 0.371},
        ],
    },
    # Seven-way model comparison from notebook 2, 32-feature production run.
    # Added so the frontend has a single source of truth rather than a hardcoded
    # copy of this table.
    "models": [
        {"model": "Blend (soft vote)",    "auc": 0.6924, "pr_auc": 0.3339, "precision": 0.260, "recall": 0.585, "f1": 0.360, "p1": 0.781, "p5": 0.458, "p10": 0.380, "is_best": True},
        {"model": "RandomForest",         "auc": 0.6894, "pr_auc": 0.3305, "precision": 0.267, "recall": 0.542, "f1": 0.358, "p1": 0.775, "p5": 0.456, "p10": 0.374},
        {"model": "HistGradientBoosting", "auc": 0.6880, "pr_auc": 0.3276, "precision": 0.254, "recall": 0.591, "f1": 0.356, "p1": 0.775, "p5": 0.452, "p10": 0.372},
        {"model": "XGBoost",              "auc": 0.6879, "pr_auc": 0.3295, "precision": 0.260, "recall": 0.570, "f1": 0.357, "p1": 0.772, "p5": 0.455, "p10": 0.374},
        {"model": "LightGBM",             "auc": 0.6855, "pr_auc": 0.3248, "precision": 0.254, "recall": 0.585, "f1": 0.355, "p1": 0.768, "p5": 0.443, "p10": 0.372},
        {"model": "LogisticRegression",   "auc": 0.6551, "pr_auc": 0.2543, "precision": 0.237, "recall": 0.551, "f1": 0.331, "p1": 0.382, "p5": 0.342, "p10": 0.312},
        {"model": "Majority baseline",    "auc": 0.5000, "pr_auc": 0.1561, "precision": 0.156, "recall": 1.000, "f1": 0.270, "p1": 0.156, "p5": 0.156, "p10": 0.156, "is_baseline": True},
    ],
    "ranking": [
        {"depth_pct": 0.5,  "flights": 1115,  "precision": 0.885, "lift": 5.67},
        {"depth_pct": 1.0,  "flights": 2231,  "precision": 0.781, "lift": 5.00},
        {"depth_pct": 2.0,  "flights": 4462,  "precision": 0.611, "lift": 3.92},
        {"depth_pct": 5.0,  "flights": 11155, "precision": 0.459, "lift": 2.94},
        {"depth_pct": 10.0, "flights": 22310, "precision": 0.374, "lift": 2.39},
        {"depth_pct": 20.0, "flights": 44620, "precision": 0.305, "lift": 1.95},
    ],
    "propagation": {
        "gate_auc": 0.9272, "gate_precision": 0.785, "gate_recall": 0.842,
        "mae_all_candidates": 7.67, "mae_actual_cascades": 8.35,
        "interval_coverage": 0.702, "gate_threshold": 0.30,
        "threshold_selected_on": "validation",
        "source": "fdpis_3_propagation.ipynb",
    },
    "depth": [
        {"depth": 1, "mae": 20.87, "correlation": 0.674, "quantitative": True},
        {"depth": 2, "mae": 31.88, "correlation": 0.428, "quantitative": True},
        {"depth": 3, "mae": 35.15, "correlation": 0.327, "quantitative": False},
        {"depth": 4, "mae": 38.66, "correlation": 0.233, "quantitative": False},
        {"depth": 5, "mae": 39.91, "correlation": 0.226, "quantitative": False},
    ],
    "cascade_validation": {
        "precision": 0.894, "recall": 0.668, "f1": 0.765, "records": 388746,
        "source": "US DOT reported delay-cause attribution, fdpis_1_data_prep.ipynb",
    },
    "per_carrier": {
        "weighted_precision_at_1pct": 0.696,
        "mean_precision_at_1pct": 0.622,
        "global_precision_at_1pct": 0.781,
        "note": "Global pooling lets the top 1% draw across all carriers. Deployed "
                "to a single airline the figure is lower - this is the honest number.",
        "rows": [
            {"carrier": "DL", "test_flights": 35041, "precision": 0.951, "base_rate": 0.154, "lift": 6.18},
            {"carrier": "OO", "test_flights": 30044, "precision": 0.880, "base_rate": 0.186, "lift": 4.73},
            {"carrier": "G4", "test_flights": 4702,  "precision": 0.809, "base_rate": 0.122, "lift": 6.62},
            {"carrier": "WN", "test_flights": 42169, "precision": 0.800, "base_rate": 0.159, "lift": 5.04},
            {"carrier": "NK", "test_flights": 6842,  "precision": 0.794, "base_rate": 0.176, "lift": 4.52},
            {"carrier": "AS", "test_flights": 7814,  "precision": 0.782, "base_rate": 0.190, "lift": 4.12},
            {"carrier": "HA", "test_flights": 2603,  "precision": 0.577, "base_rate": 0.102, "lift": 5.67},
            {"carrier": "UA", "test_flights": 25103, "precision": 0.534, "base_rate": 0.150, "lift": 3.57},
            {"carrier": "AA", "test_flights": 28920, "precision": 0.533, "base_rate": 0.159, "lift": 3.36},
            {"carrier": "B6", "test_flights": 6982,  "precision": 0.493, "base_rate": 0.161, "lift": 3.07},
            {"carrier": "YX", "test_flights": 10715, "precision": 0.458, "base_rate": 0.122, "lift": 3.75},
            {"carrier": "F9", "test_flights": 5440,  "precision": 0.426, "base_rate": 0.188, "lift": 2.26},
            {"carrier": "OH", "test_flights": 6912,  "precision": 0.391, "base_rate": 0.137, "lift": 2.86},
            {"carrier": "MQ", "test_flights": 9814,  "precision": 0.276, "base_rate": 0.090, "lift": 3.07},
        ],
    },
    "limitations": [
        "No weather features are integrated. Convective and low-visibility events are "
        "the largest unmodelled source of variance.",
        "Trained on US domestic data only. Indian network adaptation is pending a "
        "carrier data partnership.",
        "Propagation is quantitative to depth 2 only. Beyond that the system reports "
        "that a cascade continues, without a number.",
        "Delay magnitude is not predictable from schedule alone. The system ranks risk "
        "and propagates an observed delay; it does not forecast how long a delay will be.",
        "The gate threshold sits at the edge of its search grid. mae_cascades is "
        "monotone in the threshold by construction, so it has no interior optimum; "
        "0.30 is a precision/recall judgement, not an optimum.",
        "Interval coverage is 70.2% against a nominal 80% band.",
        "Depth cohorts differ between the multi-hop and integrated notebooks, so their "
        "depth tables are not directly comparable.",
        "The API serves historical flights from the training dataset, not a live feed.",
    ],
}
