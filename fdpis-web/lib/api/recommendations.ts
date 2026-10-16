import type {
  AlertFeed, CascadeRequest, CrewModel, CrewNotification, CrewProjection, RecommendationResult,
  RuleAlert, RuleProfile, RuleProfileId, Unverified,
} from "@/lib/types";
import { apiGet, apiPost, qs } from "@/lib/api/client";

/**
 * Layer 5 - the recommendation engine - lives in the BACKEND (api/layer5).
 *
 * This module only fetches and reshapes. It contains no thresholds and no rule
 * logic: every rule is a JSON entry on the server with its regulatory source
 * and a `verified` flag (GET /api/rules), and every alert is evaluated there.
 *
 * Crew alerts rest on a documented proxy - a crew is assumed to stay with its
 * aircraft all day - because airline crew rosters are not public. The UI must
 * say so wherever crew alerts appear.
 */

export const DEFAULT_PROFILE: RuleProfileId = "faa_part117";

export const PROFILE_OPTIONS: { id: RuleProfileId; label: string; hint: string }[] = [
  { id: "faa_part117", label: "FAA Part 117", hint: "US rules - matches the US demo data" },
  { id: "dgca_fdtl", label: "DGCA FDTL", hint: "Indian rules - the target market" },
];

/* ------------------------------------------------------------ raw shapes */

interface RawAlert {
  id: number;
  rule_id: string;
  category: "crew" | "passenger";
  severity: RuleAlert["severity"];
  watch_reason?: RuleAlert["watchReason"];
  profile: RuleProfileId;
  profile_name: string;
  tail: string;
  date: string;
  flight: {
    flight_number: string; leg_num: number; origin: string; dest: string;
    depth: number | null; scheduled_dep_local: string | null;
  } | null;
  predicted_value_minutes: number | null;
  predicted_basis: string;
  threshold_minutes: number;
  comparator: RuleAlert["comparator"];
  margin_minutes: number | null;
  description: string;
  detail: string;
  action: string;
  source: string;
  verified: boolean;
  deadline_utc: string | null;
  deadline_local: string | null;
  deadline_station: string | null;
  crew_proxy: boolean;
  proxy_disclosure: string | null;
  duty?: {
    report_time_local: string | null; report_station: string | null; segments: number;
    fdp_limit_minutes: number | null; projected_duty_end_local: string | null;
    projected_duty_end_station: string | null; fdp_projected_median_minutes: number | null;
    fdp_projected_upper_minutes: number | null; seed_leg: number | null;
    seed_arrival_delay_minutes: number | null;
  } | null;
  status?: RuleAlert["status"];
  usable_lead_minutes?: number | null;
  crew_model?: CrewModel | null;
  duty_block?: { index: number; count: number; first_leg: number; last_leg: number; label: string } | null;
}

interface RawProjection {
  status: CrewProjection["status"];
  status_reason: string;
  report_time_local: string | null;
  report_station: string | null;
  segments: number;
  fdp_limit_minutes: number | null;
  fdp_scheduled_minutes: number | null;
  fdp_projected_median_minutes: number | null;
  fdp_projected_upper_minutes: number | null;
  duty_end_median_local: string | null;
  duty_end_station: string | null;
  last_leg_quantified: boolean;
  disclosure: string;
}

interface RawRecommendation {
  profile: RuleProfileId;
  profile_name: string;
  disclosure: string;
  unverified: Unverified;
  crew_projection: RawProjection;
  alerts: RawAlert[];
}

interface RawFeed {
  date: string;
  carrier: string | null;
  profile: RuleProfileId;
  profile_name: string;
  crew_model: CrewModel;
  crew_model_label: string;
  disclosure: string;
  unverified: Unverified;
  summary: {
    aircraft: number; aircraft_with_delay_seed: number;
    aircraft_days_covered: number; coverage_share: number; alerts_deadline_passed: number;
    rotations_by_status: Record<string, number>; crews_flagged: number;
    alerts_by_severity: Record<RuleAlert["severity"], number>;
    watch_by_reason?: Record<NonNullable<RuleAlert["watchReason"]>, number>;
    next_day_in_dataset: boolean; seed_rule: string;
  };
  alerts: RawAlert[];
}

interface RawNotification {
  notification_id: number;
  alert_id: number;
  recipient_role: string;
  channel: CrewNotification["channel"];
  message: string;
  created_utc: string;
  status: string;
  simulated: true;
  notice: string;
}

/* --------------------------------------------------------------- mappers */

function toAlert(a: RawAlert): RuleAlert {
  return {
    id: a.id,
    ruleId: a.rule_id,
    category: a.category,
    severity: a.severity,
    watchReason: a.watch_reason ?? null,
    profile: a.profile,
    profileName: a.profile_name,
    tail: a.tail,
    date: a.date,
    flight: a.flight
      ? {
          flightNumber: a.flight.flight_number,
          legIndex: a.flight.leg_num,
          origin: a.flight.origin,
          destination: a.flight.dest,
          depth: a.flight.depth,
          scheduledDepartureLocal: a.flight.scheduled_dep_local,
        }
      : null,
    predictedValueMin: a.predicted_value_minutes,
    predictedBasis: a.predicted_basis,
    thresholdMin: a.threshold_minutes,
    comparator: a.comparator,
    marginMin: a.margin_minutes,
    description: a.description,
    detail: a.detail,
    action: a.action,
    source: a.source,
    verified: a.verified,
    deadlineUtc: a.deadline_utc,
    deadlineLocal: a.deadline_local,
    deadlineStation: a.deadline_station,
    crewProxy: a.crew_proxy,
    proxyDisclosure: a.proxy_disclosure,
    duty: a.duty
      ? {
          reportTimeLocal: a.duty.report_time_local,
          reportStation: a.duty.report_station,
          segments: a.duty.segments,
          fdpLimitMin: a.duty.fdp_limit_minutes,
          projectedDutyEndLocal: a.duty.projected_duty_end_local,
          projectedDutyEndStation: a.duty.projected_duty_end_station,
          fdpProjectedMedianMin: a.duty.fdp_projected_median_minutes,
          fdpProjectedUpperMin: a.duty.fdp_projected_upper_minutes,
          seedLeg: a.duty.seed_leg,
          seedArrivalDelayMin: a.duty.seed_arrival_delay_minutes,
        }
      : null,
    status: a.status ?? "actionable",
    usableLeadMin: a.usable_lead_minutes ?? null,
    crewModel: a.crew_model ?? null,
    dutyBlock: a.duty_block
      ? {
          index: a.duty_block.index, count: a.duty_block.count,
          firstLeg: a.duty_block.first_leg, lastLeg: a.duty_block.last_leg,
          label: a.duty_block.label,
        }
      : null,
  };
}

function toProjection(p: RawProjection): CrewProjection {
  return {
    status: p.status,
    statusReason: p.status_reason,
    reportTimeLocal: p.report_time_local,
    reportStation: p.report_station,
    segments: p.segments,
    fdpLimitMin: p.fdp_limit_minutes,
    fdpScheduledMin: p.fdp_scheduled_minutes,
    fdpProjectedMedianMin: p.fdp_projected_median_minutes,
    fdpProjectedUpperMin: p.fdp_projected_upper_minutes,
    dutyEndMedianLocal: p.duty_end_median_local,
    dutyEndStation: p.duty_end_station,
    lastLegQuantified: p.last_leg_quantified,
    disclosure: p.disclosure,
  };
}

/* ------------------------------------------------------------- endpoints */

/** POST /api/recommendations - propagation + rule engine for one disrupted leg. */
export async function getRecommendations(
  request: CascadeRequest,
  profile: RuleProfileId = DEFAULT_PROFILE,
): Promise<RecommendationResult> {
  const r = await apiPost<RawRecommendation>("/api/recommendations", {
    tail: request.tail,
    date: request.date,
    leg_num: request.legIndex,
    // The panel's delay is the disrupted leg's ARRIVAL delay. The endpoint also
    // accepts departure_delay (exactly one of the two).
    arrival_delay: request.observedDelayMin,
    profile,
  });
  return {
    profile: r.profile,
    profileName: r.profile_name,
    disclosure: r.disclosure,
    unverified: r.unverified,
    crewProjection: toProjection(r.crew_projection),
    alerts: r.alerts.map(toAlert),
  };
}

/** GET /api/alerts - the crew duty alert feed for a whole day. */
export async function getAlertFeed(
  date: string,
  carrier: string | null,
  profile: RuleProfileId = DEFAULT_PROFILE,
  crewModel: CrewModel = "single",
): Promise<AlertFeed> {
  const r = await apiGet<RawFeed>(
    `/api/alerts${qs({ date, carrier, profile, crew_model: crewModel })}`,
  );
  return {
    date: r.date,
    carrier: r.carrier,
    profile: r.profile,
    profileName: r.profile_name,
    crewModel: r.crew_model,
    crewModelLabel: r.crew_model_label,
    disclosure: r.disclosure,
    unverified: r.unverified,
    summary: {
      aircraft: r.summary.aircraft,
      aircraftDaysCovered: r.summary.aircraft_days_covered,
      coverageShare: r.summary.coverage_share,
      alertsDeadlinePassed: r.summary.alerts_deadline_passed,
      aircraftWithDelaySeed: r.summary.aircraft_with_delay_seed,
      rotationsByStatus: r.summary.rotations_by_status,
      crewsFlagged: r.summary.crews_flagged,
      alertsBySeverity: r.summary.alerts_by_severity,
      watchByReason: r.summary.watch_by_reason ?? { upper_bound_only: 0, beyond_depth_2: 0 },
      nextDayInDataset: r.summary.next_day_in_dataset,
      seedRule: r.summary.seed_rule,
    },
    alerts: r.alerts.map(toAlert),
  };
}

/** GET /api/rules - the rule set with sources and verified flags. */
export async function getRuleProfile(profile: RuleProfileId): Promise<RuleProfile> {
  const r = await apiGet<{
    profiles: {
      profile: RuleProfileId; name: string; short_name: string; jurisdiction: string;
      applies_to: string; unverified: Unverified; disclosure: string;
      rules: { id: string; category: string; description: string; source: string;
               verified: boolean; notes: string }[];
    }[];
  }>(`/api/rules${qs({ profile })}`);
  const p = r.profiles[0];
  return {
    profile: p.profile,
    name: p.name,
    shortName: p.short_name,
    jurisdiction: p.jurisdiction,
    appliesTo: p.applies_to,
    unverified: p.unverified,
    disclosure: p.disclosure,
    rules: p.rules.map((x) => ({
      id: x.id, category: x.category, description: x.description,
      source: x.source, verified: x.verified, notes: x.notes,
    })),
  };
}

function toNotification(n: RawNotification): CrewNotification {
  return {
    notificationId: n.notification_id,
    alertId: n.alert_id,
    recipientRole: n.recipient_role,
    channel: n.channel,
    message: n.message,
    createdUtc: n.created_utc,
    status: n.status,
    simulated: n.simulated,
    notice: n.notice,
  };
}

/** POST /api/alerts/{id}/notify - write a SIMULATED notification. Nothing is sent. */
export async function notifyCrew(alertId: number): Promise<CrewNotification> {
  return toNotification(await apiPost<RawNotification>(`/api/alerts/${alertId}/notify`, {}));
}

/** GET /api/notifications - the SIMULATED outbox, newest first. */
export async function getNotifications(): Promise<{ notice: string; notifications: CrewNotification[] }> {
  const r = await apiGet<{ notice: string; notifications: RawNotification[] }>("/api/notifications");
  return { notice: r.notice, notifications: r.notifications.map(toNotification) };
}
