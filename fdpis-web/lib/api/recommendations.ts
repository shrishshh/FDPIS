import type { CascadeNode, Recommendation } from "@/lib/types";

/**
 * Operational actions triggered by a cascade.
 *
 * IMPORTANT - READ BEFORE CHANGING THRESHOLDS OR TRUSTING THEM IN A DEMO:
 *
 * 1. UNVERIFIED THRESHOLDS. The minute thresholds below (25 min for a crew
 *    standby call, 40 for catering, 60 for a reserve-aircraft check, 70 for a
 *    slot renegotiation) originate from the project's v0.3 planning
 *    documentation. They have NOT been checked against any primary regulatory
 *    source. They may be directionally reasonable or they may be wrong; nobody
 *    has confirmed it. Before this logic informs a real operational decision,
 *    verify the crew-duty figures specifically against the DGCA Civil Aviation
 *    Requirements, Flight Duty Time Limitations (FDTL) circular - that is the
 *    actual source of truth for crew legality windows, and this file does not
 *    consult it.
 *
 * 2. THIS IS NOT LAYER 5. The project architecture documents a Layer 5
 *    "Recommendation Engine" as NOT IMPLEMENTED. This file is a client-side
 *    stand-in: plain threshold rules over the Layer 3/4 model output, run in
 *    the browser, with no backend service behind them. It exists to
 *    demonstrate what a recommendation surface could look like, not to claim
 *    the rule engine has been built. The UI must disclose this - see the
 *    banner in RecommendationPanel.tsx - rather than let the panel imply a
 *    verified operational system.
 *
 * The backend itself emits no recommendations at all; everything in this file
 * is presentation logic layered on top of predictions the backend does return,
 * and is raised only from hops the model can quantify (depth 1-2).
 */

interface Trigger {
  category: Recommendation["category"];
  thresholdMin: number;
  /** How far ahead of departure the action must be taken. */
  leadTimeMin: number;
  priority: Recommendation["priority"];
  title: (n: CascadeNode) => string;
  reason: (n: CascadeNode) => string;
}

const TRIGGERS: Trigger[] = [
  {
    category: "crew", thresholdMin: 25, leadTimeMin: 90, priority: "high",
    title: (n) => `Place reserve crew on standby at ${n.flight.origin}`,
    reason: (n) =>
      `A ${Math.round(n.totalDelayMin ?? 0)} min departure pushes the duty period toward the legality limit; a standby crew costs far less than a cancellation.`,
  },
  {
    category: "catering", thresholdMin: 40, leadTimeMin: 55, priority: "medium",
    title: (n) => `Re-slot catering and fuelling for ${n.flight.flightNumber}`,
    reason: () =>
      "Ground handling booked against the original time will no-show and re-queue behind other turns, adding delay on top of delay.",
  },
  {
    category: "passenger", thresholdMin: 45, leadTimeMin: 75, priority: "medium",
    title: (n) => `Protect connections inbound to ${n.flight.destination}`,
    reason: (n) =>
      `Arrival slips past the ${n.flight.destination} connection bank; proactive rebooking now avoids overnight accommodation costs.`,
  },
  {
    category: "aircraft", thresholdMin: 60, leadTimeMin: 120, priority: "high",
    title: (n) => `Check reserve aircraft availability at ${n.flight.origin}`,
    reason: () =>
      "Above an hour the rotation is unlikely to recover unaided; a spare airframe breaks the chain instead of passing it on.",
  },
  {
    category: "slot", thresholdMin: 70, leadTimeMin: 45, priority: "high",
    title: (n) => `Renegotiate the departure slot at ${n.flight.origin}`,
    reason: () =>
      "Missing the assigned slot means going to the back of the queue; requesting a revised slot early is the cheapest minute you can buy.",
  },
];

/** "09:45" minus N minutes, wrapping within the day. */
function minusMinutes(hhmm: string | null, minutes: number): string {
  if (!hhmm) return "--:--";
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m - minutes) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function buildRecommendations(nodes: CascadeNode[]): Recommendation[] {
  const out: Recommendation[] = [];

  for (const trigger of TRIGGERS) {
    // Only quantified hops can justify spending money.
    const node = nodes.find(
      (n) => n.quantitative && (n.totalDelayMin ?? 0) >= trigger.thresholdMin,
    );
    if (!node) continue;

    out.push({
      id: `${trigger.category}-${node.flight.id}`,
      category: trigger.category,
      title: trigger.title(node),
      reason: trigger.reason(node),
      deadline: minusMinutes(node.flight.scheduledDeparture, trigger.leadTimeMin),
      priority: trigger.priority,
      triggeredAtHop: node.hop,
      flightNumber: node.flight.flightNumber,
      station: node.flight.origin,
    });
  }

  return out.sort((a, b) => a.deadline.localeCompare(b.deadline));
}
