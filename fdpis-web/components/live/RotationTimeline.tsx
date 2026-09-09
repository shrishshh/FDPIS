"use client";

import type { Cascade, Rotation } from "@/lib/types";
import { SEVERITY_STYLES, formatClock } from "@/lib/format";

function toMinutes(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

/**
 * The aircraft's day as a proportional timeline. Click a leg to nominate it as
 * the disrupted departure; once a cascade is computed each downstream leg grows
 * a coloured tail showing the predicted delay.
 */
export function RotationTimeline({
  rotation,
  selectedLegIndex,
  onSelect,
  cascade,
  revealedHops,
}: {
  rotation: Rotation;
  selectedLegIndex: number | null;
  onSelect: (legIndex: number) => void;
  cascade: Cascade | null;
  revealedHops: number;
}) {
  const start = toMinutes(rotation.legs[0].scheduledDeparture) - 25;
  const end = toMinutes(rotation.legs[rotation.legs.length - 1].scheduledArrival) + 95;
  const span = Math.max(60, end - start);

  const pct = (minutes: number) => ((minutes - start) / span) * 100;

  const firstHour = Math.floor(start / 60) + 1;
  const lastHour = Math.floor(end / 60);
  const hours: number[] = [];
  for (let h = firstHour; h <= lastHour; h += 1) hours.push(h);

  const nodeByLeg = new Map(
    (cascade?.nodes ?? []).map((n) => [n.flight.legIndex, n] as const),
  );

  return (
    <div className="relative">
      {/* Hour grid */}
      <div className="relative h-5" aria-hidden>
        {hours.map((h) => (
          <span
            key={h}
            className="tnum absolute -translate-x-1/2 text-[0.6875rem] font-medium text-ink-400"
            style={{ left: `${pct(h * 60)}%` }}
          >
            {h % 2 === 0 ? `${String(h).padStart(2, "0")}:00` : ""}
          </span>
        ))}
      </div>

      <div className="relative rounded-lg border border-ink-200 bg-ink-50/50 px-0 py-3">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {hours.map((h) => (
            <span
              key={h}
              className="absolute inset-y-0 w-px bg-ink-200"
              style={{ left: `${pct(h * 60)}%` }}
            />
          ))}
        </div>

        <ul className="relative space-y-1.5">
          {rotation.legs.map((leg, i) => {
            const depMin = toMinutes(leg.scheduledDeparture);
            const arrMin = toMinutes(leg.scheduledArrival);
            const previous = i > 0 ? rotation.legs[i - 1] : null;
            const node = nodeByLeg.get(leg.legIndex);
            const revealed = node != null && node.hop <= revealedHops;
            const selected = selectedLegIndex === leg.legIndex;
            const upstream =
              selectedLegIndex != null && leg.legIndex < selectedLegIndex;

            const style = node ? SEVERITY_STYLES[node.severity] : null;
            const delayWidth =
              revealed && node
                ? ((node.quantitative ? node.totalDelayMin : 26) / span) * 100
                : 0;

            return (
              <li key={leg.id} className="relative h-10">
                {/* Ground turn feeding this departure */}
                {previous ? (
                  <span
                    aria-hidden
                    className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-ink-300 bg-white/70"
                    style={{
                      left: `${pct(toMinutes(previous.scheduledArrival))}%`,
                      width: `${Math.max(0.6, pct(depMin) - pct(toMinutes(previous.scheduledArrival)))}%`,
                    }}
                  >
                    <span className="tnum truncate px-1 text-[0.625rem] font-medium text-ink-400">
                      {leg.turnaroundSlackMin} min
                    </span>
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => onSelect(leg.legIndex)}
                  aria-pressed={selected}
                  title={`${leg.flightNumber} ${leg.origin} to ${leg.destination}, ${leg.turnaroundSlackMin} min slack on the inbound turn`}
                  className={`absolute top-0 flex h-10 items-center overflow-hidden rounded-md border px-2.5 text-left transition-colors duration-150 ${
                    selected
                      ? "z-20 border-ink-900 bg-ink-900 text-white shadow-lift"
                      : upstream
                        ? "z-10 border-ink-200 bg-white text-ink-400 hover:border-ink-300"
                        : "z-10 border-accent-200 bg-white text-ink-800 hover:border-accent-400 hover:bg-accent-50/60"
                  }`}
                  style={{
                    left: `${pct(depMin)}%`,
                    width: `${Math.max(6, pct(arrMin) - pct(depMin))}%`,
                  }}
                >
                  <span className="tnum truncate text-xs font-semibold">
                    {leg.origin}
                    <span className={selected ? "px-1 text-white/50" : "px-1 text-ink-300"}>
                      &rarr;
                    </span>
                    {leg.destination}
                  </span>
                  <span
                    className={`tnum ml-2 hidden shrink-0 text-[0.6875rem] sm:inline ${
                      selected ? "text-white/70" : "text-ink-400"
                    }`}
                  >
                    {formatClock(leg.scheduledDeparture)}
                  </span>
                </button>

                {/* Predicted delay handed to the next departure */}
                {revealed && node ? (
                  <span
                    className="animate-grow-x absolute top-0 z-20 flex h-10 origin-left items-center justify-center rounded-r-md pl-1 pr-1.5"
                    style={{
                      left: `${pct(arrMin)}%`,
                      width: `${Math.max(3.2, delayWidth)}%`,
                      background: node.quantitative
                        ? style?.hex
                        : "repeating-linear-gradient(135deg,#cdd2d6 0 5px,#e4e7e9 5px 10px)",
                    }}
                  >
                    <span
                      className={`tnum truncate text-[0.6875rem] font-bold ${
                        node.quantitative ? "text-white" : "text-ink-600"
                      }`}
                    >
                      {node.quantitative ? `+${node.totalDelayMin}` : "?"}
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
