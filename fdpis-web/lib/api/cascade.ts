import type {
  Cascade, CascadeLeg, CascadeNode, CascadeRequest, Severity,
} from "@/lib/types";
import { apiGet, apiPost } from "@/lib/api/client";
import { getRotation } from "@/lib/api/rotations";
import { buildRecommendations } from "@/lib/api/recommendations";

interface RawHop {
  depth: number;
  leg_num: number;
  flight_number: string;
  origin: string;
  dest: string;
  scheduled_dep: string | null;
  scheduled_arr: string | null;
  available_slack: number | null;
  inbound_delay: number;
  inherited_delay: number | null;
  fresh_delay: number | null;
  total_delay: number | null;
  interval_low: number | null;
  interval_high: number | null;
  gate_probability: number;
  absorbed: boolean;
  confidence: "high" | "low";
  correlation_at_depth: number | null;
}

interface RawPropagate {
  tail: string;
  date: string;
  origin_leg: number;
  observed_delay_minutes: number;
  observed_delay_source: "user_input" | "historical_actual";
  hops: RawHop[];
  summary: {
    legs_affected: number;
    deepest_hop: number;
    quantified_hops: number;
    low_confidence_hops: number;
    total_delay_minutes_added: number;
    confidence_depth: number;
  };
}

/** Severity is a display band over the predicted total; null when there is none. */
function severityFor(total: number | null): Severity | null {
  if (total === null) return null;
  if (total < 15) return "clear";
  if (total < 30) return "watch";
  if (total < 60) return "elevated";
  return "critical";
}

async function assemble(raw: RawPropagate): Promise<Cascade> {
  // The hop payload carries no leg count, so pull the rotation for context.
  // One extra call, and it also gives us the origin leg for the header.
  let legCount = 0;
  let originFlight: CascadeLeg | null = null;
  try {
    const rot = await getRotation(raw.tail, raw.date);
    legCount = rot.legCount;
    const o = rot.legs.find((l) => l.legIndex === raw.origin_leg);
    if (o) {
      originFlight = {
        id: `${o.flightNumber}-${raw.tail}-${o.legIndex}`,
        flightNumber: o.flightNumber,
        origin: o.origin,
        destination: o.destination,
        scheduledDeparture: o.scheduledDeparture,
        legIndex: o.legIndex,
        legCount: rot.legCount,
      };
    }
  } catch {
    // Rotation lookup is decorative; a cascade without it still renders.
  }

  const nodes: CascadeNode[] = raw.hops.map((h) => ({
    hop: h.depth,
    flight: {
      id: `${h.flight_number}-${raw.tail}-${h.leg_num}`,
      flightNumber: h.flight_number,
      origin: h.origin,
      destination: h.dest,
      scheduledDeparture: h.scheduled_dep,
      legIndex: h.leg_num,
      legCount,
    },
    inboundDelayMin: h.inbound_delay,
    slackMin: h.available_slack,
    inheritedDelayMin: h.inherited_delay,
    freshDelayMin: h.fresh_delay,
    totalDelayMin: h.total_delay,
    intervalLowMin: h.interval_low,
    intervalHighMin: h.interval_high,
    gateProbability: h.gate_probability,
    absorbed: h.absorbed,
    confidence: h.confidence,
    correlationAtDepth: h.correlation_at_depth,
    quantitative: h.confidence === "high",
    severity: severityFor(h.total_delay),
  }));

  return {
    tail: raw.tail,
    date: raw.date,
    originLeg: raw.origin_leg,
    originFlight,
    observedDelayMin: raw.observed_delay_minutes,
    observedDelaySource: raw.observed_delay_source,
    nodes,
    summary: {
      legsAffected: raw.summary.legs_affected,
      deepestHop: raw.summary.deepest_hop,
      quantifiedHops: raw.summary.quantified_hops,
      lowConfidenceHops: raw.summary.low_confidence_hops,
      totalDelayMinutesAdded: raw.summary.total_delay_minutes_added,
      confidenceDepth: raw.summary.confidence_depth,
    },
    confidenceDepth: raw.summary.confidence_depth,
    recommendations: buildRecommendations(nodes),
  };
}

/**
 * The cascade that actually followed a historical flight.
 *
 * GET /api/cascade/{tail}/{date}/{leg_num} - seeds the chain with the leg's
 * recorded arrival delay. Throws ApiError 422 when the flight has no recorded
 * arrival (cancelled or diverted); callers should direct the user to the live
 * entry screen, which is what the backend's message says.
 */
export async function getCascadeForFlight(
  tail: string,
  date: string,
  legIndex: number,
): Promise<Cascade> {
  const raw = await apiGet<RawPropagate>(
    `/api/cascade/${encodeURIComponent(tail)}/${encodeURIComponent(date)}/${legIndex}`,
  );
  return assemble(raw);
}

/** POST /api/propagate - recompute from an operator-entered delay. */
export async function simulateCascade(request: CascadeRequest): Promise<Cascade> {
  const raw = await apiPost<RawPropagate>("/api/propagate", {
    tail: request.tail,
    date: request.date,
    leg_num: request.legIndex,
    observed_delay_minutes: request.observedDelayMin,
  });
  return assemble(raw);
}
