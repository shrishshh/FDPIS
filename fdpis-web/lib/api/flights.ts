import type {
  BriefingSummary,
  FilterOptions,
  Flight,
  RiskFilters,
} from "@/lib/types";
import { CARRIERS } from "@/lib/mock/reference";
import { getAllFlights } from "@/lib/mock/network";
import {
  DEMO_DATE,
  HIGH_RISK_THRESHOLD,
  REVIEW_QUEUE_SIZE,
  simulateLatency,
} from "@/lib/api/config";

/**
 * The day's flights, ranked by primary risk score, highest first.
 *
 * Backend: GET /api/v1/risk?date=...&carrier=...&origin=...&min_risk=...
 */
export async function getRiskList(
  date: string = DEMO_DATE,
  filters: RiskFilters = {},
): Promise<Flight[]> {
  await simulateLatency();
  void date;

  return getAllFlights()
    .filter((f) => (filters.carrier ? f.carrier === filters.carrier : true))
    .filter((f) => (filters.origin ? f.origin === filters.origin : true))
    .filter((f) => (filters.minRisk != null ? f.riskScore >= filters.minRisk : true))
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * A single flight leg.
 *
 * Backend: GET /api/v1/flights/{flight_id}
 */
export async function getFlight(flightId: string): Promise<Flight | null> {
  await simulateLatency(60);
  return getAllFlights().find((f) => f.id === flightId) ?? null;
}

/**
 * Headline counts for the top of the morning briefing.
 *
 * Backend: GET /api/v1/briefing/summary?date=...
 */
export async function getBriefingSummary(
  date: string = DEMO_DATE,
): Promise<BriefingSummary> {
  await simulateLatency(90);

  const flights = getAllFlights();
  const highRisk = flights.filter((f) => f.riskScore >= HIGH_RISK_THRESHOLD);

  // A cascade is predicted where a high-risk leg still has downstream legs to
  // hand its delay on to. A high-risk final leg of the day breaks nothing.
  const cascadeSources = highRisk.filter((f) => f.legIndex < f.legCount);

  return {
    date,
    flightsScheduled: flights.length,
    highRiskCount: highRisk.length,
    predictedCascades: cascadeSources.length,
    aircraftAffected: new Set(cascadeSources.map((f) => f.tail)).size,
    reviewQueueSize: REVIEW_QUEUE_SIZE,
  };
}

/**
 * Filter dropdown contents.
 *
 * Backend: GET /api/v1/reference/filters
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  await simulateLatency(40);

  const flights = getAllFlights();
  const activeCarriers = new Set(flights.map((f) => f.carrier));

  return {
    carriers: CARRIERS.filter((c) => activeCarriers.has(c.code)).map((c) => ({
      code: c.code,
      name: c.name,
      hubs: c.hubs,
    })),
    origins: Array.from(new Set(flights.map((f) => f.origin))).sort(),
  };
}
