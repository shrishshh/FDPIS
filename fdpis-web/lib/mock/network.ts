import type { Flight, Rotation } from "@/lib/types";
import {
  AIRPORTS,
  AIRPORT_BY_CODE,
  CARRIERS,
  CONGESTION,
  blockMinutes,
  distanceMiles,
  type CarrierProfile,
} from "@/lib/mock/reference";
import { clamp, makeRng, pickWeighted, randInt, unitFromKey } from "@/lib/mock/rng";

/** The single operating day the whole demo is built around. */
export const OPERATING_DATE = "2026-09-09";

/** Change this and every number in the demo changes — but stays reproducible. */
export const NETWORK_SEED = 0x0fd915;

/** Fleet size per carrier — sums to 28 aircraft, ~124 legs. */
const FLEET_PLAN: Record<string, number> = {
  AA: 4, DL: 4, UA: 4, WN: 3, AS: 2, B6: 2,
  NK: 2, F9: 2, OO: 2, YX: 1, MQ: 1, OH: 1,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Minutes after local midnight -> "2026-09-09T07:45:00". */
function toIso(minutes: number): string {
  const dayMinutes = ((minutes % 1440) + 1440) % 1440;
  return `${OPERATING_DATE}T${pad(Math.floor(dayMinutes / 60))}:${pad(dayMinutes % 60)}:00`;
}

const LAST_DEPARTURE_MIN = 22 * 60 + 45;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Mock stand-in for the primary risk model. Uses the same feature families the
 * real model ranks on: turnaround slack, rotation depth, origin congestion,
 * time of day, and carrier baseline.
 */
function scoreFlight(args: {
  id: string;
  slackMin: number;
  legIndex: number;
  legCount: number;
  origin: string;
  departureMin: number;
  carrier: CarrierProfile;
  blockMin: number;
}): { riskScore: number; delayProbability: number } {
  const { id, slackMin, legIndex, legCount, origin, departureMin, carrier, blockMin } = args;
  const rotationDepth = legCount > 1 ? (legIndex - 1) / (legCount - 1) : 0;
  const timeOfDay = clamp((departureMin - 330) / (LAST_DEPARTURE_MIN - 330), 0, 1);

  // Calibrated so the fleet-wide delay rate lands near the 15.6% base rate the
  // real model was measured against.
  const z =
    -5.2 +
    2.8 * (1 - clamp(slackMin, 5, 90) / 90) +
    1.5 * (CONGESTION[origin] ?? 0.5) +
    0.5 * rotationDepth +
    0.8 * timeOfDay +
    3.2 * (carrier.baseDelayRate - 0.19) +
    (blockMin > 210 ? 0.3 : 0) +
    (unitFromKey(`risk:${id}`) * 2.2 - 1.1);

  const delayProbability = sigmoid(z);
  // The score the ops team ranks on: the probability, stretched so the top of
  // the list separates cleanly on screen.
  const riskScore = clamp(Math.round(100 * Math.pow(delayProbability, 0.5)), 2, 99);
  return { riskScore, delayProbability };
}

function buildTail(carrier: CarrierProfile, rng: () => number, used: Set<string>): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const tail = `N${randInt(rng, 101, 989)}${carrier.tailSuffix}`;
    if (!used.has(tail)) {
      used.add(tail);
      return tail;
    }
  }
  const fallback = `N${used.size + 100}${carrier.tailSuffix}`;
  used.add(fallback);
  return fallback;
}

/** Next station: hubs return to the network, spokes turn back to a hub. */
function nextStation(rng: () => number, carrier: CarrierProfile, current: string): string {
  const here = AIRPORT_BY_CODE[current];
  const atHub = carrier.hubs.includes(current);
  // Regionals fly short sectors; they never turn up on a transcon.
  const rangeLimit = carrier.regional ? 1400 : 3000;

  const candidates = (atHub ? AIRPORTS : AIRPORTS.filter((a) => carrier.hubs.includes(a.code)))
    .filter((a) => a.code !== current)
    .filter((a) => {
      const miles = distanceMiles(here, a);
      return miles > 180 && miles < rangeLimit;
    });

  const pool = candidates.length > 0 ? candidates : AIRPORTS.filter((a) => a.code !== current);

  return pickWeighted(rng, pool, (a) => {
    const miles = distanceMiles(here, a);
    // Prefer shorter hops; give the carrier's own hubs a nudge.
    const proximity = 1 / (1 + miles / 400);
    const hubBonus = carrier.hubs.includes(a.code) ? 1.5 : 1;
    return proximity * hubBonus;
  }).code;
}

function buildRotation(
  carrier: CarrierProfile,
  tail: string,
  rng: () => number,
): Rotation {
  const aircraftType = carrier.fleet[randInt(rng, 0, carrier.fleet.length - 1)];
  const targetLegs = carrier.regional ? randInt(rng, 5, 8) : randInt(rng, 4, 7);

  let station = carrier.hubs[randInt(rng, 0, carrier.hubs.length - 1)];
  let departureMin = randInt(rng, 5 * 60 + 15, 7 * 60 + 30);
  let flightNumber = carrier.flightNumberBase + randInt(rng, 10, 899);

  // turnaroundSlackMin belongs to the turn BEFORE a leg departs. The first leg
  // of the day inherits the overnight stand, so it starts with plenty.
  let inboundSlack = randInt(rng, 55, 90);

  const draft: Array<Omit<Flight, "legCount" | "riskScore" | "delayProbability" | "id">> = [];

  for (let leg = 1; leg <= targetLegs; leg += 1) {
    if (departureMin > LAST_DEPARTURE_MIN) break;
    const destination = nextStation(rng, carrier, station);
    const block = blockMinutes(station, destination);
    const arrivalMin = departureMin + block;
    if (arrivalMin > 23 * 60 + 55) break;

    // Slack compresses as the day runs on — the operational reality that makes
    // late legs the dangerous ones.
    const slack = inboundSlack;
    const rawSlack = 5 + Math.round(85 * Math.pow(rng(), 2.0));
    const nextSlack = clamp(rawSlack - (leg - 1) * 2, 5, 90);

    draft.push({
      flightNumber: `${carrier.code}${flightNumber}`,
      carrier: carrier.code,
      carrierName: carrier.name,
      origin: station,
      destination,
      scheduledDeparture: toIso(departureMin),
      scheduledArrival: toIso(arrivalMin),
      blockMinutes: block,
      tail,
      aircraftType,
      legIndex: leg,
      turnaroundSlackMin: slack,
    });

    station = destination;
    departureMin = arrivalMin + carrier.minTurnMin + nextSlack;
    inboundSlack = nextSlack;
    flightNumber += randInt(rng, 3, 180);
  }

  const legCount = draft.length;
  const legs: Flight[] = draft.map((leg) => {
    const id = `${leg.flightNumber}-${tail}-${leg.legIndex}`;
    const departureMinutes =
      Number(leg.scheduledDeparture.slice(11, 13)) * 60 +
      Number(leg.scheduledDeparture.slice(14, 16));
    const { riskScore, delayProbability } = scoreFlight({
      id,
      slackMin: leg.turnaroundSlackMin,
      legIndex: leg.legIndex,
      legCount,
      origin: leg.origin,
      departureMin: departureMinutes,
      carrier,
      blockMin: leg.blockMinutes,
    });
    return { ...leg, id, legCount, riskScore, delayProbability };
  });

  return {
    tail,
    carrier: carrier.code,
    carrierName: carrier.name,
    aircraftType,
    legs,
  };
}

let cachedRotations: Rotation[] | null = null;

/** All rotations for the operating day. Deterministic, memoised. */
export function getAllRotations(): Rotation[] {
  if (cachedRotations) return cachedRotations;

  const rng = makeRng(NETWORK_SEED);
  const usedTails = new Set<string>();
  const rotations: Rotation[] = [];

  for (const carrier of CARRIERS) {
    const fleetSize = FLEET_PLAN[carrier.code] ?? 1;
    for (let i = 0; i < fleetSize; i += 1) {
      const tail = buildTail(carrier, rng, usedTails);
      const rotation = buildRotation(carrier, tail, rng);
      if (rotation.legs.length >= 3) rotations.push(rotation);
    }
  }

  // Stable ordering by first departure, so the timeline reads chronologically.
  rotations.sort((a, b) =>
    a.legs[0].scheduledDeparture.localeCompare(b.legs[0].scheduledDeparture),
  );

  cachedRotations = rotations;
  return rotations;
}

let cachedFlights: Flight[] | null = null;

/** Every leg flown on the operating day, in schedule order. */
export function getAllFlights(): Flight[] {
  if (cachedFlights) return cachedFlights;
  cachedFlights = getAllRotations()
    .flatMap((r) => r.legs)
    .sort((a, b) => a.scheduledDeparture.localeCompare(b.scheduledDeparture));
  return cachedFlights;
}

export function findRotation(tail: string): Rotation | undefined {
  return getAllRotations().find((r) => r.tail === tail);
}

export function findFlight(flightId: string): Flight | undefined {
  return getAllFlights().find((f) => f.id === flightId);
}
