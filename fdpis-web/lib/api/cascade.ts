import type { Cascade, CascadeRequest } from "@/lib/types";
import { findFlight, findRotation } from "@/lib/mock/network";
import { computeCascade, observedDelayForFlight } from "@/lib/mock/cascade";
import { simulateLatency } from "@/lib/api/config";

/**
 * The predicted cascade for a flight opened from the morning briefing. The
 * observed delay is the primary model's expectation for that leg.
 *
 * Backend: GET /api/v1/cascade/{flight_id}
 */
export async function getCascadeForFlight(flightId: string): Promise<Cascade | null> {
  await simulateLatency(140);

  const flight = findFlight(flightId);
  if (!flight) return null;

  const rotation = findRotation(flight.tail);
  if (!rotation) return null;

  return computeCascade(rotation, flight.legIndex, observedDelayForFlight(flight));
}

/**
 * Recompute a cascade from an operator-entered delay. Deliberately has no
 * artificial latency: this screen has to feel instant when demonstrated.
 *
 * Backend: POST /api/v1/cascade/simulate
 *          body { tail, leg_index, observed_delay_min }
 */
export async function simulateCascade(request: CascadeRequest): Promise<Cascade | null> {
  const rotation = findRotation(request.tail);
  if (!rotation) return null;
  return computeCascade(rotation, request.legIndex, request.observedDelayMin);
}
