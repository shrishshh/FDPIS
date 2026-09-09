import type { PresetScenario, Rotation, RotationSummary } from "@/lib/types";
import { findRotation, getAllRotations } from "@/lib/mock/network";
import { simulateLatency } from "@/lib/api/config";

function toSummary(rotation: Rotation): RotationSummary {
  const stations = [
    rotation.legs[0].origin,
    ...rotation.legs.map((l) => l.destination),
  ];
  return {
    tail: rotation.tail,
    carrier: rotation.carrier,
    carrierName: rotation.carrierName,
    aircraftType: rotation.aircraftType,
    legCount: rotation.legs.length,
    firstOrigin: stations[0],
    lastDestination: stations[stations.length - 1],
    routeLabel: stations.join(" → "),
  };
}

/**
 * Every aircraft operating today, for the tail-number picker.
 *
 * Backend: GET /api/v1/rotations?date=...
 */
export async function listRotations(): Promise<RotationSummary[]> {
  await simulateLatency(60);
  return getAllRotations()
    .map(toSummary)
    .sort((a, b) => a.tail.localeCompare(b.tail));
}

/**
 * One aircraft's full day of flying, in operating order.
 *
 * Backend: GET /api/v1/rotations/{tail}?date=...
 */
export async function getRotation(tail: string): Promise<Rotation | null> {
  await simulateLatency(60);
  return findRotation(tail) ?? null;
}

/**
 * Demo scenarios for the live entry screen. Resolved against real rotations so
 * a preset can never point at a leg that does not exist.
 *
 * Backend: GET /api/v1/scenarios  (or drop this endpoint in production)
 */
export async function getPresetScenarios(): Promise<PresetScenario[]> {
  await simulateLatency(40);

  const wanted = [
    {
      id: "ord-mechanical",
      label: "45 min mechanical at ORD",
      description:
        "Hydraulic write-up found on the walkaround; engineering called to the gate.",
      station: "ORD",
      delayMinutes: 45,
    },
    {
      id: "dfw-weather",
      label: "90 min weather hold at DFW",
      description:
        "Convective cell over the field; ground stop issued by traffic management.",
      station: "DFW",
      delayMinutes: 90,
    },
    {
      id: "ewr-atc",
      label: "30 min ATC flow at EWR",
      description:
        "Departure metering in effect; wheels-up time reissued 30 minutes late.",
      station: "EWR",
      delayMinutes: 30,
    },
  ];

  const rotations = getAllRotations();
  const scenarios: PresetScenario[] = [];

  for (const spec of wanted) {
    // Prefer a mid-rotation leg with plenty left to break: the aircraft is
    // already airborne in the day, which is how disruption actually arrives.
    let best: { rotation: Rotation; legIndex: number; rank: number } | null = null;

    for (const rotation of rotations) {
      for (const leg of rotation.legs) {
        if (leg.origin !== spec.station) continue;
        const downstream = rotation.legs.length - leg.legIndex;
        if (downstream < 2) continue;
        const rank = downstream + (leg.legIndex >= 2 ? 1.5 : 0);
        if (!best || rank > best.rank) {
          best = { rotation, legIndex: leg.legIndex, rank };
        }
      }
    }

    if (best) {
      scenarios.push({
        id: spec.id,
        label: spec.label,
        description: spec.description,
        tail: best.rotation.tail,
        legIndex: best.legIndex,
        delayMinutes: spec.delayMinutes,
      });
    }
  }

  return scenarios;
}
