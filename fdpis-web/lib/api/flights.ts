import type { BriefingSummary, Flight, RiskFilters } from "@/lib/types";
import { ApiError, apiGet, qs } from "@/lib/api/client";
import { BRIEFING_PAGE_SIZE, REVIEW_QUEUE_SIZE } from "@/lib/api/config";

interface RawFlight {
  flight_id: string;
  carrier: string;
  flight_number: string;
  tail: string | null;
  origin: string;
  dest: string;
  scheduled_dep: string | null;
  scheduled_arr: string | null;
  leg_num: number | null;
  total_legs: number | null;
  available_slack: number | null;
  risk_score: number;
  risk_band: "low" | "medium" | "high";
  actual_delay_minutes: number | null;
  actually_delayed_15: boolean | null;
}

interface RawBriefing {
  date: string;
  carrier: string | null;
  total_matching: number;
  returned: number;
  flights: RawFlight[];
}

function toFlight(r: RawFlight): Flight {
  return {
    id: r.flight_id,
    flightNumber: r.flight_number,
    carrier: r.carrier,
    origin: r.origin,
    destination: r.dest,
    scheduledDeparture: r.scheduled_dep,
    scheduledArrival: r.scheduled_arr,
    tail: r.tail,
    legIndex: r.leg_num,
    legCount: r.total_legs,
    turnaroundSlackMin: r.available_slack,
    riskScore: r.risk_score,
    riskBand: r.risk_band,
    actualDelayMinutes: r.actual_delay_minutes,
    actuallyDelayed15: r.actually_delayed_15,
  };
}

/**
 * The day's flights ranked by the Layer 3 classifier, highest risk first.
 *
 * GET /api/briefing?date=&carrier=&limit=
 *
 * The backend filters by carrier only. `origin` and `minRisk` are applied here
 * over the returned page - a deliberate limitation, not an oversight.
 */
export async function getRiskList(
  date: string,
  filters: RiskFilters = {},
  limit: number = BRIEFING_PAGE_SIZE,
): Promise<Flight[]> {
  const raw = await apiGet<RawBriefing>(
    `/api/briefing${qs({ date, carrier: filters.carrier, limit })}`,
  );
  return raw.flights
    .map(toFlight)
    .filter((f) => (filters.origin ? f.origin === filters.origin : true))
    .filter((f) => (filters.minRisk != null ? f.riskScore >= filters.minRisk : true));
}

/**
 * A single flight leg, by tail/date/leg.
 *
 * GET /api/flights/{tail}/{date}/{leg_num} - added specifically so this does
 * not have to fetch a 5,000-row briefing page to resolve one flight. Returns
 * null on a 404 (unknown tail/date/leg combination) rather than throwing,
 * matching the optional-result shape callers expect.
 */
export async function getFlight(
  tail: string,
  date: string,
  legIndex: number,
): Promise<Flight | null> {
  try {
    const raw = await apiGet<RawFlight>(
      `/api/flights/${encodeURIComponent(tail)}/${encodeURIComponent(date)}/${legIndex}`,
    );
    return toFlight(raw);
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null;
    throw e;
  }
}

interface RawSummary {
  date: string;
  carrier: string | null;
  total_flights: number;
  high_risk_count: number;
  aircraft_affected: number;
  mean_available_slack: number | null;
}

/** GET /api/briefing/summary?date=&carrier= */
export async function getBriefingSummary(
  date: string,
  carrier?: string,
): Promise<BriefingSummary> {
  const r = await apiGet<RawSummary>(`/api/briefing/summary${qs({ date, carrier })}`);
  return {
    date: r.date,
    carrier: r.carrier,
    flightsScheduled: r.total_flights,
    highRiskCount: r.high_risk_count,
    aircraftAffected: r.aircraft_affected,
    meanAvailableSlack: r.mean_available_slack,
    reviewQueueSize: REVIEW_QUEUE_SIZE,
  };
}
