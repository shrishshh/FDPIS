/**
 * A miniature, static rendering of the cascade explorer — the whole product
 * idea in one glance. Deliberately non-interactive and non-animated.
 */
const LEGS = [
  {
    route: "DFW → EWR",
    time: "09:31",
    label: "34 min late",
    tone: "origin" as const,
  },
  {
    route: "EWR → ORD",
    time: "13:51",
    label: "+42 min",
    tone: "elevated" as const,
  },
  {
    route: "ORD → DFW",
    time: "17:46",
    label: "+13 min",
    tone: "clear" as const,
  },
  {
    route: "DFW → MCO",
    time: "21:05",
    label: "cascade continues",
    tone: "beyond" as const,
  },
];

const TONE: Record<string, string> = {
  origin: "border-ink-900 bg-ink-900 text-white",
  elevated: "border-[#f6cbb7] bg-white text-ink-900",
  clear: "border-[#bfe3bf] bg-white text-ink-900",
  beyond: "border-dashed border-ink-300 bg-ink-50/80 text-ink-500",
};

const VALUE_TONE: Record<string, string> = {
  origin: "text-white",
  elevated: "text-[#a4441c]",
  clear: "text-[#0a7c0a]",
  beyond: "text-ink-400",
};

export function HeroDiagram() {
  return (
    <figure className="card m-0 w-full max-w-md p-5">
      <figcaption className="mb-4">
        <p className="eyebrow">One aircraft, one morning</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          A 34 minute delay at Dallas, traced through the rest of N974AA&apos;s day.
        </p>
      </figcaption>

      <ol className="space-y-1.5">
        {LEGS.map((leg, i) => (
          <li key={leg.route}>
            {i === 3 ? (
              <div className="flex items-center gap-2 py-1.5">
                <span className="h-px flex-1 border-t border-dashed border-ink-300" />
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-400">
                  Confidence boundary
                </span>
                <span className="h-px flex-1 border-t border-dashed border-ink-300" />
              </div>
            ) : i > 0 ? (
              <div className="ml-5 h-3 w-px bg-ink-200" aria-hidden />
            ) : null}

            <div
              className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 ${TONE[leg.tone]}`}
            >
              <span className="tnum text-sm font-semibold">{leg.route}</span>
              <span className="flex items-baseline gap-2.5">
                <span
                  className={`tnum text-[0.6875rem] ${
                    leg.tone === "origin" ? "text-white/50" : "text-ink-400"
                  }`}
                >
                  {leg.time}
                </span>
                <span className={`tnum text-sm font-bold ${VALUE_TONE[leg.tone]}`}>
                  {leg.label}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-ink-200 pt-3 text-xs leading-relaxed text-ink-500">
        Past depth 2 the model reports that the cascade continues, without a figure.
        That boundary is measured, not chosen.
      </p>
    </figure>
  );
}
