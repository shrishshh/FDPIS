import type { Airport, Carrier } from "@/lib/types";

/** Airport reference, with coordinates used to derive plausible block times. */
export interface AirportGeo extends Airport {
  lat: number;
  lon: number;
}

export const AIRPORTS: AirportGeo[] = [
  { code: "ATL", city: "Atlanta", name: "Hartsfield–Jackson", hubTier: 1, lat: 33.64, lon: -84.43 },
  { code: "DFW", city: "Dallas–Fort Worth", name: "DFW International", hubTier: 1, lat: 32.9, lon: -97.04 },
  { code: "ORD", city: "Chicago", name: "O'Hare International", hubTier: 1, lat: 41.98, lon: -87.9 },
  { code: "DEN", city: "Denver", name: "Denver International", hubTier: 1, lat: 39.86, lon: -104.67 },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International", hubTier: 1, lat: 33.94, lon: -118.41 },
  { code: "CLT", city: "Charlotte", name: "Charlotte Douglas", hubTier: 2, lat: 35.21, lon: -80.94 },
  { code: "PHX", city: "Phoenix", name: "Sky Harbor", hubTier: 2, lat: 33.43, lon: -112.01 },
  { code: "SEA", city: "Seattle", name: "Seattle–Tacoma", hubTier: 2, lat: 47.45, lon: -122.31 },
  { code: "SFO", city: "San Francisco", name: "San Francisco International", hubTier: 2, lat: 37.62, lon: -122.38 },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid International", hubTier: 2, lat: 36.08, lon: -115.15 },
  { code: "MCO", city: "Orlando", name: "Orlando International", hubTier: 2, lat: 28.43, lon: -81.31 },
  { code: "EWR", city: "Newark", name: "Newark Liberty", hubTier: 2, lat: 40.69, lon: -74.17 },
  { code: "BOS", city: "Boston", name: "Logan International", hubTier: 2, lat: 42.36, lon: -71.01 },
  { code: "JFK", city: "New York", name: "John F. Kennedy", hubTier: 2, lat: 40.64, lon: -73.78 },
  { code: "MIA", city: "Miami", name: "Miami International", hubTier: 2, lat: 25.79, lon: -80.29 },
];

export const AIRPORT_BY_CODE: Record<string, AirportGeo> = Object.fromEntries(
  AIRPORTS.map((a) => [a.code, a]),
);

/**
 * Departure congestion index, 0–1. Drives both the risk model and the amount of
 * fresh delay a leg generates in the propagation mock.
 */
export const CONGESTION: Record<string, number> = {
  ORD: 0.92, EWR: 0.9, JFK: 0.84, SFO: 0.82, LAX: 0.78, ATL: 0.76,
  DFW: 0.7, BOS: 0.68, DEN: 0.62, MIA: 0.6, CLT: 0.58, LAS: 0.52,
  MCO: 0.5, PHX: 0.44, SEA: 0.42,
};

export interface CarrierProfile extends Carrier {
  /** Regional carriers fly smaller gauge and turn faster. */
  regional: boolean;
  fleet: string[];
  /** Tail suffix, e.g. "AA" -> N481AA. */
  tailSuffix: string;
  flightNumberBase: number;
  /** Carrier-level baseline delay propensity, 0–1. */
  baseDelayRate: number;
  /** Minimum ground time in minutes before slack is added. */
  minTurnMin: number;
}

export const CARRIERS: CarrierProfile[] = [
  { code: "AA", name: "American Airlines", hubs: ["DFW", "CLT", "ORD", "MIA", "PHX"], regional: false, fleet: ["B738", "A321", "A319", "B737 MAX 8"], tailSuffix: "AA", flightNumberBase: 1000, baseDelayRate: 0.19, minTurnMin: 45 },
  { code: "DL", name: "Delta Air Lines", hubs: ["ATL", "LAX", "SEA", "BOS", "JFK"], regional: false, fleet: ["A320", "B739", "A321", "B738"], tailSuffix: "DL", flightNumberBase: 300, baseDelayRate: 0.14, minTurnMin: 45 },
  { code: "UA", name: "United Airlines", hubs: ["ORD", "DEN", "EWR", "SFO", "LAX"], regional: false, fleet: ["B738", "A320", "B739", "B737 MAX 9"], tailSuffix: "UA", flightNumberBase: 400, baseDelayRate: 0.2, minTurnMin: 45 },
  { code: "WN", name: "Southwest Airlines", hubs: ["LAS", "DEN", "PHX", "MCO", "LAX"], regional: false, fleet: ["B737-700", "B738", "B737 MAX 8"], tailSuffix: "WN", flightNumberBase: 1200, baseDelayRate: 0.21, minTurnMin: 35 },
  { code: "AS", name: "Alaska Airlines", hubs: ["SEA", "SFO", "LAX"], regional: false, fleet: ["B738", "B739", "A320"], tailSuffix: "AS", flightNumberBase: 200, baseDelayRate: 0.13, minTurnMin: 40 },
  { code: "B6", name: "JetBlue Airways", hubs: ["JFK", "BOS", "MCO", "EWR"], regional: false, fleet: ["A320", "A321", "E190"], tailSuffix: "JB", flightNumberBase: 500, baseDelayRate: 0.26, minTurnMin: 45 },
  { code: "NK", name: "Spirit Airlines", hubs: ["MCO", "LAS", "DFW"], regional: false, fleet: ["A320", "A321", "A319"], tailSuffix: "NK", flightNumberBase: 600, baseDelayRate: 0.24, minTurnMin: 35 },
  { code: "F9", name: "Frontier Airlines", hubs: ["DEN", "LAS", "MCO"], regional: false, fleet: ["A320neo", "A321neo"], tailSuffix: "FR", flightNumberBase: 1600, baseDelayRate: 0.23, minTurnMin: 35 },
  { code: "OO", name: "SkyWest Airlines", hubs: ["DEN", "LAX", "SFO", "ORD"], regional: true, fleet: ["CRJ-900", "E175", "CRJ-700"], tailSuffix: "SY", flightNumberBase: 3200, baseDelayRate: 0.18, minTurnMin: 30 },
  { code: "YX", name: "Republic Airways", hubs: ["ORD", "EWR", "BOS"], regional: true, fleet: ["E175"], tailSuffix: "RW", flightNumberBase: 3400, baseDelayRate: 0.2, minTurnMin: 30 },
  { code: "MQ", name: "Envoy Air", hubs: ["DFW", "ORD", "MIA"], regional: true, fleet: ["E175", "CRJ-700"], tailSuffix: "MQ", flightNumberBase: 3600, baseDelayRate: 0.22, minTurnMin: 30 },
  { code: "OH", name: "PSA Airlines", hubs: ["CLT", "ORD", "MIA"], regional: true, fleet: ["CRJ-900"], tailSuffix: "PS", flightNumberBase: 5000, baseDelayRate: 0.21, minTurnMin: 30 },
];

export const CARRIER_BY_CODE: Record<string, CarrierProfile> = Object.fromEntries(
  CARRIERS.map((c) => [c.code, c]),
);

/** Great-circle distance in statute miles. */
export function distanceMiles(a: AirportGeo, b: AirportGeo): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** Scheduled block time: taxi + cruise at roughly 450 kt ground speed. */
export function blockMinutes(from: string, to: string): number {
  const miles = distanceMiles(AIRPORT_BY_CODE[from], AIRPORT_BY_CODE[to]);
  return Math.round((28 + miles / 7.6) / 5) * 5;
}
