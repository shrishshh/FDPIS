import type { PresetScenario, Rotation, RotationSummary } from "@/lib/types";
import { apiGet, qs } from "@/lib/api/client";

interface RawRotationSummary {
  tail: string;
  carrier: string;
  legs: number;
  first_origin: string;
  last_dest: string;
}

interface RawLeg {
  leg_num: number;
  flight_number: string;
  origin: string;
  dest: string;
  scheduled_dep: string | null;
  scheduled_arr: string | null;
  available_slack: number | null;
  continuous_rotation: boolean;
  actual_dep_delay: number | null;
  actual_arr_delay: number | null;
}

interface RawRotation {
  tail: string;
  date: string;
  carrier: string;
  total_legs: number;
  legs: RawLeg[];
}

/** GET /api/rotations?date=&carrier=&min_legs= */
export async function listRotations(
  date: string,
  carrier?: string,
  minLegs = 3,
): Promise<RotationSummary[]> {
  const raw = await apiGet<RawRotationSummary[]>(
    `/api/rotations${qs({ date, carrier, min_legs: minLegs })}`,
  );
  return raw.map((r) => ({
    tail: r.tail,
    carrier: r.carrier,
    legCount: r.legs,
    firstOrigin: r.first_origin,
    lastDestination: r.last_dest,
    routeLabel: `${r.first_origin} → ${r.last_dest}`,
  }));
}

/** GET /api/rotation/{tail}/{date} */
export async function getRotation(tail: string, date: string): Promise<Rotation> {
  const r = await apiGet<RawRotation>(
    `/api/rotation/${encodeURIComponent(tail)}/${encodeURIComponent(date)}`,
  );
  return {
    tail: r.tail,
    date: r.date,
    carrier: r.carrier,
    legCount: r.total_legs,
    legs: r.legs.map((l) => ({
      legIndex: l.leg_num,
      flightNumber: l.flight_number,
      origin: l.origin,
      destination: l.dest,
      scheduledDeparture: l.scheduled_dep,
      scheduledArrival: l.scheduled_arr,
      turnaroundSlackMin: l.available_slack,
      continuousRotation: l.continuous_rotation,
      actualDepDelay: l.actual_dep_delay,
      actualArrDelay: l.actual_arr_delay,
    })),
  };
}

/**
 * Demo scenarios for the live entry screen.
 *
 * The backend has no scenarios endpoint, so these are resolved against real
 * rotations for the selected date: pick a long rotation departing the named
 * station, so a preset can never point at a leg that does not exist.
 */
export async function getPresetScenarios(date: string): Promise<PresetScenario[]> {
  const wanted = [
    { id: "mech", station: "ORD", delayMinutes: 45,
      label: "45 min mechanical at ORD",
      description: "Hydraulic write-up found on the walkaround; engineering at the gate." },
    { id: "wx", station: "DFW", delayMinutes: 90,
      label: "90 min weather hold at DFW",
      description: "Convective cell over the field; ground stop issued by traffic management." },
    { id: "atc", station: "EWR", delayMinutes: 30,
      label: "30 min ATC flow at EWR",
      description: "Departure metering in effect; wheels-up time reissued 30 minutes late." },
  ];

  const rotations = await listRotations(date, undefined, 5);
  const out: PresetScenario[] = [];

  for (const spec of wanted) {
    // Prefer a rotation starting at the named station so leg 2 departs from it.
    const hit =
      rotations.find((r) => r.firstOrigin === spec.station && r.legCount >= 5) ??
      rotations.find((r) => r.legCount >= 5);
    if (!hit) continue;
    out.push({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      tail: hit.tail,
      date,
      legIndex: 2,
      delayMinutes: spec.delayMinutes,
    });
  }
  return out;
}
