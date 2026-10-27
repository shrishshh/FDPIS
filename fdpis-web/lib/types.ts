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

/* ------------------------------------------------------------------ */
/* Layer 5 - rule engine (backend)                                    */
/* ------------------------------------------------------------------ */

/** A regulatory rule profile served by GET /api/rules. */
export type RuleProfileId = "faa_part117" | "dgca_fdtl";

/**
 * Two tiers. LIKELY: the median prediction crosses the limit. WATCH: worth watching -
 * either only the interval's upper bound crosses, or the leg is past the depth-2
 * confidence boundary (no number). POSSIBLE and MONITOR were merged into WATCH after
 * the backtest showed their breach rates could not be told apart.
 */
export type AlertSeverity = "LIKELY" | "WATCH";

export type WatchReason = "upper_bound_only" | "beyond_depth_2";

export interface AlertFlight {
  flightNumber: string;
  legIndex: number;
  origin: string;
  destination: string;
  /** Hops downstream of the seed; 0 is the seed leg itself. */
  depth: number | null;
  scheduledDepartureLocal: string | null;
}

export interface AlertDuty {
  reportTimeLocal: string | null;
  reportStation: string | null;
  segments: number;
  fdpLimitMin: number | null;
  projectedDutyEndLocal: string | null;
  projectedDutyEndStation: string | null;
  fdpProjectedMedianMin: number | null;
  fdpProjectedUpperMin: number | null;
  seedLeg: number | null;
  seedArrivalDelayMin: number | null;
}

/** One rule crossing, evaluated by the backend. Never computed in the browser. */
export interface RuleAlert {
  id: number;
  ruleId: string;
  category: "crew" | "passenger";
  severity: AlertSeverity;
  /** Set only on WATCH alerts. */
  watchReason: WatchReason | null;
  profile: RuleProfileId;
  profileName: string;
  tail: string;
  date: string;
  flight: AlertFlight | null;
  /** NULL for WATCH beyond_depth_2: past depth 2 there is no number to compare. */
  predictedValueMin: number | null;
  predictedBasis: string;
  thresholdMin: number;
  comparator: "gt" | "gte" | "lt";
  marginMin: number | null;
  description: string;
  detail: string;
  action: string;
  source: string;
  verified: boolean;
  deadlineUtc: string | null;
  deadlineLocal: string | null;
  deadlineStation: string | null;
  /** True when the alert rests on the rotation crew proxy, not real rosters. */
  crewProxy: boolean;
  proxyDisclosure: string | null;
  duty: AlertDuty | null;
  /**
   * "deadline_passed": the action deadline was already behind us when the
   * information (the seed leg's actual arrival) existed. Shown, never actionable.
   */
  status: "actionable" | "deadline_passed";
  /** Action deadline minus the seed leg's actual arrival, in minutes. */
  usableLeadMin: number | null;
  crewModel: CrewModel | null;
  /** Set only under the experimental inferred-block crew model. */
  dutyBlock: DutyBlock | null;
}

export type CrewModel = "single" | "inferred_blocks";

export interface DutyBlock {
  index: number;
  count: number;
  firstLeg: number;
  lastLeg: number;
  /** "inferred duty block - hypothetical, not a roster" */
  label: string;
}

export interface CrewProjection {
  status: "ok" | "at_risk" | "proxy_not_applicable" | "breached_at_seed" | "no_rotation";
  statusReason: string;
  reportTimeLocal: string | null;
  reportStation: string | null;
  segments: number;
  fdpLimitMin: number | null;
  fdpScheduledMin: number | null;
  fdpProjectedMedianMin: number | null;
  fdpProjectedUpperMin: number | null;
  dutyEndMedianLocal: string | null;
  dutyEndStation: string | null;
  lastLegQuantified: boolean;
  disclosure: string;
}

export interface Unverified {
  rules: string[];
  assumptions: string[];
}

export interface RecommendationResult {
  profile: RuleProfileId;
  profileName: string;
  disclosure: string;
  unverified: Unverified;
  crewProjection: CrewProjection;
  alerts: RuleAlert[];
}

export interface AlertFeed {
  date: string;
  carrier: string | null;
  profile: RuleProfileId;
  profileName: string;
  crewModel: CrewModel;
  crewModelLabel: string;
  disclosure: string;
  unverified: Unverified;
  summary: {
    aircraft: number;
    aircraftDaysCovered: number;
    coverageShare: number;
    alertsDeadlinePassed: number;
    aircraftWithDelaySeed: number;
    rotationsByStatus: Record<string, number>;
    crewsFlagged: number;
    alertsBySeverity: Record<AlertSeverity, number>;
    watchByReason: Record<WatchReason, number>;
    nextDayInDataset: boolean;
    seedRule: string;
  };
  alerts: RuleAlert[];
}

export interface RuleSummary {
  id: string;
  category: string;
  description: string;
  source: string;
  verified: boolean;
  notes: string;
}

export interface RuleProfile {
  profile: RuleProfileId;
  name: string;
  shortName: string;
  jurisdiction: string;
  appliesTo: string;
  rules: RuleSummary[];
  unverified: Unverified;
  disclosure: string;
}

/** How a notification left the system: simulated, or the live WhatsApp demo channel. */
export interface NotificationDelivery {
  channel: "whatsapp" | "simulated";
  status: "sent" | "already_sent" | "failed" | "simulated";
  providerId: string | null;
  sentAt: string | null;
  error: string | null;
}

/**
 * A crew notification. SIMULATED unless `delivery` says it was sent over the
 * live WhatsApp demo channel to the single demo recipient.
 */
export interface CrewNotification {
  notificationId: number;
  alertId: number;
  recipientRole: string;
  /** The channel the role would be reached on in operation (not the demo channel). */
  channel: "SMS" | "crew app push";
  message: string;
  createdUtc: string;
  status: string;
  simulated: boolean;
  notice: string;
  delivery: NotificationDelivery | null;
}

export interface NotifyStatus {
  live: boolean;
  channel: "whatsapp" | "simulated";
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

export interface Layer5BacktestRow {
  /** How chains are seeded: recorded arrival delay, or (earlier) departure delay. */
  seedOn: "arrival" | "departure";
  /** True for the seed mode the deployed engine uses. */
  isDefault: boolean;
  profile: RuleProfileId;
  ruleId: string;
  rule: string;
  actualBreaches: number;
  precisionLikely: number | null;
  recallAnyAlert: number | null;
  /** Recall counting only alerts whose deadline was still ahead when they fired. */
  recallActionable: number | null;
  engineLpPrecision: number | null;
  engineLpRecall: number | null;
  naivePrecisionAtEngineRecall: number | null;
  naiveRecall: number | null;
  naivePrecision: number | null;
  enginePrecisionAtNaiveRecall: number | null;
  medianLeadMin: number | null;
  shareDeadlinePassed: number | null;
}

export interface Layer5Backtest {
  source: string;
  testDates: string;
  defaultSeedOn: "arrival" | "departure";
  /**
   * Actionable FDP-limit recall and precision for three nested alert sets (test split,
   * default seed mode): a = LIKELY only, b = + WATCH upper_bound_only, c = all alerts.
   */
  recallSets: {
    profile: RuleProfileId;
    alertSet: "a_likely_only" | "b_likely_plus_watch_upper" | "c_all_alerts";
    label: string;
    actualBreaches: number;
    alerts: number;
    actionableRecall: number | null;
    precision: number | null;
  }[];
  /** Observed breach rate per alert tier, default seed mode, validation and test. */
  threeBand: {
    split: "validation" | "test";
    profile: RuleProfileId;
    likelyRate: number | null;
    watchRate: number | null;
    noAlertRate: number | null;
  }[];
  note: string;
  rows: Layer5BacktestRow[];
}

export interface WeatherVariantRow {
  variant: "baseline" | "upper_bound" | "honest";
  label: string;
  deployable: boolean;
  note: string;
  auc: number;
  prAuc: number;
  f1: number;
  precisionAt1: number;
  precisionAt5: number;
  precisionAt10: number;
  carrierWeightedPrecisionAt1: number;
}

export interface WeatherComparison {
  source: string;
  promoted: boolean;
  verdict: string;
  rows: WeatherVariantRow[];
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
  /** Notebook 7 weather experiment; null when the candidate results are absent. */
  weather: WeatherComparison | null;
  /** Layer 5 crew-alert backtest on the test split; null when not yet run. */
  layer5: Layer5Backtest | null;
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
