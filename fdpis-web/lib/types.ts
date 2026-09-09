/**
 * FDPIS — shared domain types.
 *
 * Every function in /lib/api returns one of these shapes. When the FastAPI
 * backend is connected, these types become the response contract; nothing in
 * /components or /app should need to change.
 */

/* ------------------------------------------------------------------ */
/* Reference data                                                     */
/* ------------------------------------------------------------------ */

export interface Airport {
  /** IATA code, e.g. "ORD" */
  code: string;
  city: string;
  name: string;
  /** Rough scale of operation — used for congestion weighting in the mock. */
  hubTier: 1 | 2 | 3;
}

export interface Carrier {
  /** IATA carrier code, e.g. "AA" */
  code: string;
  name: string;
  /** Primary hubs, used to seed plausible rotations. */
  hubs: string[];
}

/* ------------------------------------------------------------------ */
/* Flights                                                            */
/* ------------------------------------------------------------------ */

export interface Flight {
  /** Stable id, e.g. "AA1482-N481AA-3" */
  id: string;
  flightNumber: string;
  carrier: string;
  carrierName: string;
  origin: string;
  destination: string;
  /** ISO 8601 local operating time. */
  scheduledDeparture: string;
  scheduledArrival: string;
  /** Block time in minutes. */
  blockMinutes: number;
  tail: string;
  aircraftType: string;
  /** 1-based position of this leg in the aircraft's day. */
  legIndex: number;
  /** Total legs the aircraft operates that day. */
  legCount: number;
  /**
   * Ground time beyond the minimum turn — the buffer available to absorb an
   * inbound delay before it propagates. Minutes.
   */
  turnaroundSlackMin: number;
  /** Primary risk model output, 0–100. */
  riskScore: number;
  /** Calibrated probability of a >15 min departure delay, 0–1. */
  delayProbability: number;
}

export type Severity = "clear" | "watch" | "elevated" | "critical";

export interface RiskFilters {
  carrier?: string;
  origin?: string;
  /** Only return flights with riskScore >= this value. */
  minRisk?: number;
}

export interface BriefingSummary {
  /** ISO date, e.g. "2026-09-09" */
  date: string;
  flightsScheduled: number;
  highRiskCount: number;
  predictedCascades: number;
  aircraftAffected: number;
  /** Number of flights in the review queue (top-N by risk). */
  reviewQueueSize: number;
}

export interface FilterOptions {
  carriers: Carrier[];
  origins: string[];
}

/* ------------------------------------------------------------------ */
/* Rotations                                                          */
/* ------------------------------------------------------------------ */

export interface Rotation {
  tail: string;
  carrier: string;
  carrierName: string;
  aircraftType: string;
  /** Ordered legs; legs[i].destination === legs[i+1].origin, always. */
  legs: Flight[];
}

export interface RotationSummary {
  tail: string;
  carrier: string;
  carrierName: string;
  aircraftType: string;
  legCount: number;
  firstOrigin: string;
  lastDestination: string;
  /** e.g. "ORD → DFW → PHX → LAX" */
  routeLabel: string;
}

/* ------------------------------------------------------------------ */
/* Cascade                                                            */
/* ------------------------------------------------------------------ */

export interface CascadeNode {
  /** 1-based hop count downstream of the disrupted leg. */
  hop: number;
  flight: Flight;
  /** Delay handed over from the inbound aircraft, before absorption. */
  inboundDelayMin: number;
  /** Slack available on this turn. */
  slackMin: number;
  /** Delay that survived the turn: max(0, inbound − slack). */
  inheritedDelayMin: number;
  /** New delay generated on this leg (congestion, crew, ATC). */
  freshDelayMin: number;
  /** inherited + fresh. */
  totalDelayMin: number;
  intervalLowMin: number;
  intervalHighMin: number;
  /** True when the turn's slack fully absorbed the inbound delay. */
  absorbed: boolean;
  severity: Severity;
  /**
   * False beyond the model's validated depth. When false, the UI must show a
   * qualitative statement instead of a number — see MODEL_CONFIDENCE_DEPTH.
   */
  quantitative: boolean;
}

export type RecommendationCategory =
  | "crew"
  | "catering"
  | "aircraft"
  | "slot"
  | "passenger";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  /** One line of business justification. */
  reason: string;
  /** ISO time by which the action must be taken. */
  deadline: string;
  priority: "high" | "medium" | "low";
  /** Which hop crossed the threshold that triggered this action. */
  triggeredAtHop: number;
  /** The flight the action applies to. */
  flightNumber: string;
  station: string;
}

export interface Cascade {
  /** The disrupted flight and what happened to it. */
  originFlight: Flight;
  observedDelayMin: number;
  /** Downstream legs in operating order. */
  nodes: CascadeNode[];
  /** Sum of totalDelayMin across quantitative hops. */
  totalDownstreamDelayMin: number;
  /** Legs touched by the cascade. */
  legsAffected: number;
  /** Hops beyond which predictions are qualitative only. */
  confidenceDepth: number;
  recommendations: Recommendation[];
}

export interface CascadeRequest {
  tail: string;
  /** legIndex of the leg where the delay was observed. */
  legIndex: number;
  observedDelayMin: number;
}

/* ------------------------------------------------------------------ */
/* Model performance                                                  */
/* ------------------------------------------------------------------ */

export interface AblationRow {
  /** "A", "B", … */
  group: string;
  label: string;
  featureCount: number;
  auc: number;
  precisionAt1: number;
}

export interface ModelRow {
  model: string;
  auc: number;
  f1: number;
  precisionAt1: number;
  isBaseline?: boolean;
  isBest?: boolean;
}

export interface RankingRow {
  /** "Top 1%" */
  depthLabel: string;
  /** 0.01 for "Top 1%" — used as the x value. */
  depthFraction: number;
  flightsReviewed: number;
  precision: number;
  lift: number;
}

export interface PropagationDepthRow {
  depth: number;
  maeMinutes: number;
  correlation: number;
}

export interface CascadeValidation {
  precision: number;
  recall: number;
  f1: number;
  recordsValidated: number;
  source: string;
}

export interface HeadlineMetric {
  id: string;
  value: string;
  label: string;
  detail: string;
}

export interface ModelPerformance {
  ablation: AblationRow[];
  ablationCallout: string;
  models: ModelRow[];
  ranking: RankingRow[];
  baseDelayRate: number;
  propagationByDepth: PropagationDepthRow[];
  confidenceDepth: number;
  cascadeValidation: CascadeValidation;
  limitations: string[];
  headline: HeadlineMetric[];
}

/* ------------------------------------------------------------------ */
/* Live entry                                                         */
/* ------------------------------------------------------------------ */

export interface PresetScenario {
  id: string;
  label: string;
  description: string;
  tail: string;
  legIndex: number;
  delayMinutes: number;
}
