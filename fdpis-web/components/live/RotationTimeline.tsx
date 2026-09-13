"use client";

import type { Cascade, Rotation } from "@/lib/types";
import { SEVERITY_STYLES, formatClock } from "@/lib/format";

/** "HH:MM" -> minutes after midnight. Null (cancelled leg) sorts to 0. */
function toMinutes(time: string | null): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// A pure time-proportional layout squeezes short legs into unreadable slivers
// on a dense rotation - a 12-leg inter-island day (20-40 minute hops) can give
// a leg box under 15px wide in a fixed-width container. Two fixes, both driven
// by pixels rather than percentages so a MIN_LEG_PX floor is meaningful: the
// container gets a computed total width (scrolled, not squeezed) and every
// leg box gets a minimum width regardless of how short its scheduled block
// time is. Positions stay time-accurate; only the WIDTH of very short legs is
// floored, which can make adjacent short legs sit closer than their true gap
// - an intentional, disclosed trade-off for legibility over pixel-perfect
// proportionality.
const MIN_LEG_PX = 92;
const MIN_TOTAL_PX = 720;

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

  // Pixels, not percent: lets every leg claim a real minimum width and still
  // sit at its true chronological position, with the whole thing scrolling
  // instead of collapsing.
  const totalWidth = Math.max(MIN_TOTAL_PX, rotation.legs.length * 150);
  const pxPerMin = totalWidth / span;
  const px = (minutes: number) => (minutes - start) * pxPerMin;

  const firstHour = Math.floor(start / 60) + 1;
  const lastHour = Math.floor(end / 60);
  const hours: number[] = [];
  for (let h = firstHour; h <= lastHour; h += 1) hours.push(h);

  const nodeByLeg = new Map(
    (cascade?.nodes ?? []).map((n) => [n.flight.legIndex, n] as const),
  );

  return (
    <div className="overflow-x-auto scrollbar-slim">
      <div className="relative" style={{ width: totalWidth, minWidth: "100%" }}>
        {/* Hour grid */}
        <div className="relative h-5" aria-hidden>
          {hours.map((h) => (
            <span
              key={h}
              className="tnum absolute -translate-x-1/2 text-[0.6875rem] font-medium text-ink-400"
              style={{ left: px(h * 60) }}
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
                style={{ left: px(h * 60) }}
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

              const style = node && node.severity ? SEVERITY_STYLES[node.severity] : null;
              const legLeftPx = px(depMin);
              const legWidthPx = Math.max(MIN_LEG_PX, px(arrMin) - px(depMin));
              const delayWidthPx =
                revealed && node
                  ? Math.max(
                      30,
                      ((node.quantitative && node.totalDelayMin !== null
                        ? node.totalDelayMin
                        : 26) /
                        span) *
                        totalWidth,
                    )
                  : 0;

              return (
                <li key={leg.legIndex} className="relative h-10">
                  {previous ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-full border border-dashed border-ink-300 bg-white/70 px-1"
                      style={{
                        left: px(toMinutes(previous.scheduledArrival)),
                        width: Math.max(
                          34,
                          legLeftPx - px(toMinutes(previous.scheduledArrival)),
                        ),
                      }}
                    >
                      <span className="tnum truncate text-[0.625rem] font-medium text-ink-400">
                        {leg.turnaroundSlackMin ?? 0} min
                      </span>
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onSelect(leg.legIndex)}
                    aria-pressed={selected}
                    title={`${leg.flightNumber} ${leg.origin} to ${leg.destination}, ${leg.turnaroundSlackMin ?? 0} min slack on the inbound turn`}
                    className={`absolute top-0 flex h-10 items-center overflow-hidden whitespace-nowrap rounded-md border px-2.5 text-left transition-colors duration-150 ${
                      selected
                        ? "z-20 border-ink-900 bg-ink-900 text-white shadow-lift"
                        : upstream
                          ? "z-10 border-ink-200 bg-white text-ink-400 hover:border-ink-300"
                          : "z-10 border-accent-200 bg-white text-ink-800 hover:border-accent-400 hover:bg-accent-50/60"
                    }`}
                    style={{ left: legLeftPx, width: legWidthPx, zIndex: 10 + i }}
                  >
                    <span className="tnum text-xs font-semibold">
                      {leg.origin}
                      <span className={selected ? "px-1 text-white/50" : "px-1 text-ink-300"}>
                        &rarr;
                      </span>
                      {leg.destination}
                    </span>
                    <span
                      className={`tnum ml-2 shrink-0 text-[0.6875rem] ${
                        selected ? "text-white/70" : "text-ink-400"
                      }`}
                    >
                      {formatClock(leg.scheduledDeparture)}
                    </span>
                  </button>

                  {revealed && node ? (
                    <span
                      className="animate-grow-x absolute top-0 z-30 flex h-10 origin-left items-center justify-center whitespace-nowrap rounded-r-md pl-1 pr-1.5"
                      style={{
                        left: px(arrMin),
                        width: delayWidthPx,
                        background: node.quantitative
                          ? style?.hex
                          : "repeating-linear-gradient(135deg,#cdd2d6 0 5px,#e4e7e9 5px 10px)",
                      }}
                    >
                      <span
                        className={`tnum text-[0.6875rem] font-bold ${
                          node.quantitative ? "text-white" : "text-ink-600"
                        }`}
                      >
                        {node.quantitative && node.totalDelayMin !== null
                          ? `+${Math.round(node.totalDelayMin)}`
                          : "?"}
                      </span>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
