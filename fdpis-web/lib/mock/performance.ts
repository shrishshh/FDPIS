import type { ModelPerformance } from "@/lib/types";

/**
 * Validated results from the FDPIS modelling notebooks. These are measured
 * numbers, not fixtures — when the backend is connected they will be served
 * from the evaluation store rather than regenerated.
 */
export const MODEL_PERFORMANCE: ModelPerformance = {
  ablation: [
    { group: "A", label: "Schedule basics", featureCount: 9, auc: 0.6357, precisionAt1: 0.28 },
    { group: "B", label: "+ Cyclical time", featureCount: 15, auc: 0.6385, precisionAt1: 0.316 },
    { group: "C", label: "+ Categorical", featureCount: 18, auc: 0.6519, precisionAt1: 0.374 },
    { group: "D", label: "+ Historical rates", featureCount: 26, auc: 0.6388, precisionAt1: 0.355 },
    { group: "E", label: "+ Congestion", featureCount: 31, auc: 0.641, precisionAt1: 0.366 },
    { group: "F", label: "+ Rotation", featureCount: 40, auc: 0.6777, precisionAt1: 0.779 },
  ],
  ablationCallout:
    "Rotation features add +0.0367 AUC — more than every other feature group combined. Knowing where the aircraft has been matters more than knowing anything about the flight itself.",
  models: [
    { model: "Ensemble blend", auc: 0.6819, f1: 0.351, precisionAt1: 0.781, isBest: true },
    { model: "Random Forest", auc: 0.6812, f1: 0.35, precisionAt1: 0.763 },
    { model: "LightGBM", auc: 0.6801, f1: 0.349, precisionAt1: 0.768 },
    { model: "HistGradientBoosting", auc: 0.6791, f1: 0.349, precisionAt1: 0.76 },
    { model: "XGBoost", auc: 0.6777, f1: 0.348, precisionAt1: 0.779 },
    { model: "Logistic Regression", auc: 0.6534, f1: 0.328, precisionAt1: 0.38 },
    { model: "Majority baseline", auc: 0.5, f1: 0.27, precisionAt1: 0.156, isBaseline: true },
  ],
  ranking: [
    { depthLabel: "Top 0.5%", depthFraction: 0.005, flightsReviewed: 1115, precision: 0.885, lift: 5.67 },
    { depthLabel: "Top 1%", depthFraction: 0.01, flightsReviewed: 2231, precision: 0.781, lift: 5.0 },
    { depthLabel: "Top 2%", depthFraction: 0.02, flightsReviewed: 4462, precision: 0.611, lift: 3.92 },
    { depthLabel: "Top 5%", depthFraction: 0.05, flightsReviewed: 11155, precision: 0.459, lift: 2.94 },
    { depthLabel: "Top 10%", depthFraction: 0.1, flightsReviewed: 22310, precision: 0.374, lift: 2.39 },
  ],
  baseDelayRate: 0.156,
  propagationByDepth: [
    { depth: 1, maeMinutes: 20.87, correlation: 0.674 },
    { depth: 2, maeMinutes: 31.88, correlation: 0.428 },
    { depth: 3, maeMinutes: 35.15, correlation: 0.327 },
    { depth: 4, maeMinutes: 38.66, correlation: 0.233 },
    { depth: 5, maeMinutes: 39.91, correlation: 0.226 },
  ],
  confidenceDepth: 2,
  cascadeValidation: {
    precision: 0.894,
    recall: 0.668,
    f1: 0.765,
    recordsValidated: 388746,
    source: "US DOT reported delay-cause attribution",
  },
  limitations: [
    "No weather features integrated yet. Convective and low-visibility events are the largest unmodelled source of variance.",
    "Trained on US domestic data. Indian network adaptation is pending a carrier data partnership.",
    "Predictions are quantitative to depth 2 only. Beyond that the system reports that a cascade continues, without a number.",
    "Delay magnitude is not predictable from schedule alone — demonstrated three separate ways in the modelling notebooks. The system ranks risk and propagates observed delay; it does not forecast how long a delay will be before it happens.",
  ],
  headline: [
    {
      id: "lift",
      value: "5.0x",
      label: "better than random",
      detail: "Lift over base rate when identifying at-risk flights in the top 1% of the ranked list.",
    },
    {
      id: "precision",
      value: "78.1%",
      label: "precision at top 1%",
      detail: "Of the 2,231 flights flagged for review, 4 in 5 went on to be delayed.",
    },
    {
      id: "mae",
      value: "8.7 min",
      label: "mean error, single hop",
      detail: "Mean absolute error on next-leg cascade prediction where the inbound delay is known.",
    },
    {
      id: "scale",
      value: "1.7M",
      label: "flights trained and validated",
      detail: "US domestic operations, with a held-out temporal split for validation.",
    },
  ],
};
