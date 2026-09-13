/**
 * FDPIS domain types.
 *
 * These mirror the FastAPI backend's responses, converted to camelCase inside
 * /lib/api. Where the backend does not provide something the mock used to
 * invent (aircraft type, carrier long name, calibrated delay probability), the
 * field is absent rather than faked.
 */

/* ------------------------------------------------------------------ */
/* Reference                                                          */
/* ------------------------------------------------------------------ */

export interface CarrierOption {
  code: string;
  flights: number;
}

export interface DateOption {
  date: string; // YYYY-MM-DD
  flights: number;
}

export interface FilterOptions {
  carriers: CarrierOption[];
  dates: DateOption[];
}

/* ------------------------------------------------------------------ */
/* Flights                                                            */
/* ------------------------------------------------------------------ */

/** Risk band is a percentile within the requested day, assigned by the API. */
export type RiskBand = "low" | "medium" | "high";

export interface Flight {
  /** e.g. "AA1543-N981UY-3" */
  id: string;
  flightNumber: string;
  carrier: string;
  origin: string;
  destination: string;
  /** "HH:MM" local. The API serves clock times, not ISO timestamps. */
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  tail: string | null;
  legIndex: number | null;
  legCount: number | null;
  /** Ground time beyond the minimum turn, in minutes. */
  turnaroundSlackMin: number | null;
  /** Model probability * 100, rounded. */
  riskScore: number;
  riskBand: RiskBand;
  /** HISTORICAL GROUND TRUTH, not a prediction. The API serves past flights. */
  actualDelayMinutes: number | null;
  actuallyDelayed15: boolean | null;
}

export type Severity = "clear" | "watch" | "elevated" | "critical";

export interface RiskFilters {
  carrier?: string;
  /** Applied client-side: the backend briefing endpoint filters by carrier only. */
  origin?: string;
  /** Applied client-side, as above. */
  minRisk?: number;
}

export interface BriefingSummary {
  date: string;
  carrier: string | null;
  flightsScheduled: number;
  highRiskCount: number;
  aircraftAffected: number;
  meanAvailableSlack: number | null;
  reviewQueueSize: number;
}

/* ------------------------------------------------------------------ */
/* Rotations                                                          */
/* ------------------------------------------------------------------ */

export interface RotationLeg {
  legIndex: number;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  turnaroundSlackMin: number | null;
  /** False where the previous destination is not this origin. */
  continuousRotation: boolean;
  actualDepDelay: number | null;
  actualArrDelay: number | null;
}

export interface Rotation {
  tail: string;
  date: string;
  carrier: string;
  legCount: number;
  legs: RotationLeg[];
}

export interface RotationSummary {
  tail: string;
  carrier: string;
  legCount: number;
  firstOrigin: string;
  lastDestination: string;
  routeLabel: string;
}

/* ------------------------------------------------------------------ */
/* Cascade                                                            */
/* ------------------------------------------------------------------ */

/** The leg a hop lands on. Enough to render it; not a full Flight. */
export interface CascadeLeg {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDeparture: string | null;
  legIndex: number;
  legCount: number;
}

export interface CascadeNode {
  /** 1-based hops downstream of the disrupted leg. */
  hop: number;
  flight: CascadeLeg;
  inboundDelayMin: number;
  slackMin: number | null;
  /**
   * NULL beyond the confidence depth. The backend does not publish a figure
   * past depth 2 and the UI must render the absence, never a substitute.
   */
  inheritedDelayMin: number | null;
  freshDelayMin: number | null;
  totalDelayMin: number | null;
  intervalLowMin: number | null;
  intervalHighMin: number | null;
  gateProbability: number;
  absorbed: boolean;
  confidence: "high" | "low";
  /** Model correlation with observed delay at this depth. */
  correlationAtDepth: number | null;
  /** Convenience: confidence === "high". */
  quantitative: boolean;
  /** Derived from totalDelayMin; undefined when there is no number. */
  severity: Severity | null;
}

export interface CascadeChainSummary {
  legsAffected: number;
  deepestHop: number;
  quantifiedHops: number;
  lowConfidenceHops: number;
  totalDelayMinutesAdded: number;
  confidenceDepth: number;
}

export type RecommendationCategory =
  | "crew" | "catering" | "aircraft" | "slot" | "passenger";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  reason: string;
  /** "HH:MM" */
  deadline: string;
  priority: "high" | "medium" | "low";
  triggeredAtHop: number;
  flightNumber: string;
  station: string;
}

export interface Cascade {
  tail: string;
  date: string;
  originLeg: number;
  originFlight: CascadeLeg | null;
  observedDelayMin: number;
  /** Whether the seed delay came from the user or from historical record. */
  observedDelaySource: "user_input" | "historical_actual";
  nodes: CascadeNode[];
  summary: CascadeChainSummary;
  confidenceDepth: number;
  /**
   * Derived in the frontend from the returned hop totals. The backend does not
   * emit recommendations; these are threshold rules over its predictions.
   */
  recommendations: Recommendation[];
}

export interface CascadeRequest {
  tail: string;
  date: string;
  legIndex: number;
  observedDelayMin: number;
}

export interface PresetScenario {
  id: string;
  label: string;
  description: string;
  tail: string;
  date: string;
  legIndex: number;
  delayMinutes: number;
}

/* ------------------------------------------------------------------ */
/* Model performance (GET /api/performance)                           */
/* ------------------------------------------------------------------ */

export interface ClassifierMetrics {
  auc: number;
  f1: number;
  precisionAt1: number;
  precisionAt5: number;
  precisionAt10: number;
  features: number;
  trainingRows: number;
  testRows: number;
  baseDelayRate: number;
  liftAt1: number;
  source: string;
}

export interface AblationRow {
  group: string;
  featureCount: number;
  auc: number;
  aucGain: number | null;
  prAuc: number;
  f1: number;
  precisionAt1: number;
  precisionAt5: number;
  precisionAt10: number;
}

export interface ModelRow {
  model: string;
  auc: number;
  prAuc: number;
  precision: number;
  recall: number;
  f1: number;
  precisionAt1: number;
  precisionAt5: number;
  precisionAt10: number;
  isBest?: boolean;
  isBaseline?: boolean;
}

export interface RankingRow {
  depthPct: number;
  flightsReviewed: number;
  precision: number;
  lift: number;
}

export interface PropagationMetrics {
  gateAuc: number;
  gatePrecision: number;
  gateRecall: number;
  maeAllCandidates: number;
  maeActualCascades: number;
  intervalCoverage: number;
  gateThreshold: number;
  thresholdSelectedOn: string;
}

export interface PropagationDepthRow {
  depth: number;
  maeMinutes: number;
  correlation: number;
  quantitative: boolean;
}

export interface CascadeValidation {
  precision: number;
  recall: number;
  f1: number;
  records: number;
  source: string;
}

export interface PerCarrierRow {
  carrier: string;
  testFlights: number;
  precision: number;
  baseRate: number;
  lift: number;
}

export interface PerCarrier {
  weightedPrecisionAt1: number;
  meanPrecisionAt1: number;
  globalPrecisionAt1: number;
  note: string;
  rows: PerCarrierRow[];
}

export interface HeadlineMetric {
  id: string;
  value: string;
  label: string;
  detail: string;
}

export interface ModelPerformance {
  modelVersion: string;
  classifier: ClassifierMetrics;
  ablation: AblationRow[];
  ablationNote: string;
  models: ModelRow[];
  ranking: RankingRow[];
  propagation: PropagationMetrics;
  propagationByDepth: PropagationDepthRow[];
  confidenceDepth: number;
  cascadeValidation: CascadeValidation;
  perCarrier: PerCarrier;
  limitations: string[];
  /** Derived from `classifier` for the landing page hero. */
  headline: HeadlineMetric[];
}

/* ------------------------------------------------------------------ */
/* API health                                                         */
/* ------------------------------------------------------------------ */

export interface ApiHealth {
  status: string;
  parquetRows: number;
  dateMin: string;
  dateMax: string;
  dateCount: number;
  layer3FeatureCount: number;
  layer4FeatureCount: number;
  gateThreshold: number;
  confidenceDepth: number;
  usingHistoricalData: boolean;
}
