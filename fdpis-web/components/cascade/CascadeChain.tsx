"use client";

import { ArrowRight, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Cascade, CascadeNode } from "@/lib/types";
import { Tooltip } from "@/components/Tooltip";
import { SEVERITY_STYLES, formatClock } from "@/lib/format";

const CONFIDENCE_NOTE =
  "Beyond depth 2 the propagation model's correlation with observed delay falls to 0.33 and below. The cascade still continues, but we will not put a number on it.";

/** Connector thickness carries the amount of delay handed forward. */
function Connector({ node }: { node: CascadeNode }) {
  const transmitted = node.inheritedDelayMin;
  const thickness = Math.min(12, Math.max(2, 2 + transmitted / 7));
  const color = node.quantitative
    ? transmitted === 0
      ? "#cdd2d6"
      : SEVERITY_STYLES[node.severity].hex
    : "#cdd2d6";

  return (
    <div
      className="flex w-12 shrink-0 flex-col items-center justify-center gap-1.5 self-center lg:w-14"
      aria-hidden
    >
      <span className="tnum whitespace-nowrap text-[0.6875rem] font-semibold text-ink-500">
        {node.quantitative
          ? transmitted === 0
            ? "absorbed"
            : `+${transmitted} min`
          : ""}
      </span>
      <span className="flex w-full items-center">
        <span
          className="flex-1 rounded-full"
          style={{
            height: thickness,
            background: color,
            opacity: node.quantitative ? 1 : 0.6,
            backgroundImage: node.quantitative
              ? undefined
              : "repeating-linear-gradient(90deg,#cdd2d6 0 6px,transparent 6px 12px)",
          }}
        />
        <ArrowRight
          className="h-4 w-4 shrink-0"
          style={{ color }}
          strokeWidth={2.5}
        />
      </span>
      <span className="h-4" />
    </div>
  );
}

function OriginCard({ cascade }: { cascade: Cascade }) {
  const f = cascade.originFlight;
  return (
    <div className="w-[212px] shrink-0 rounded-xl border-2 border-ink-900 bg-ink-900 p-4 text-white lg:w-[228px]">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/60">
        Disrupted leg
      </p>
      <p className="tnum mt-2 text-lg font-bold tracking-tight">
        {f.origin}
        <span className="px-1.5 text-white/40">&rarr;</span>
        {f.destination}
      </p>
      <p className="tnum mt-0.5 text-sm text-white/70">
        {f.flightNumber} &middot; dep {formatClock(f.scheduledDeparture)} &middot; leg{" "}
        {f.legIndex} of {f.legCount}
      </p>

      <div className="mt-4 border-t border-white/15 pt-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/60">
          Observed delay
        </p>
        <p className="tnum mt-1 text-3xl font-semibold tracking-tight">
          {cascade.observedDelayMin}
          <span className="ml-1 text-base font-medium text-white/60">min</span>
        </p>
      </div>
    </div>
  );
}

function QuantitativeCard({ node }: { node: CascadeNode }) {
  const style = SEVERITY_STYLES[node.severity];
  const f = node.flight;

  return (
    <div
      className={`w-[212px] shrink-0 rounded-xl border bg-white p-4 shadow-card lg:w-[228px] ${style.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">Hop {node.hop}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${style.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.bar}`} aria-hidden />
          {style.label}
        </span>
      </div>

      <p className="tnum mt-2.5 text-lg font-bold tracking-tight text-ink-900">
        {f.origin}
        <span className="px-1.5 text-ink-300">&rarr;</span>
        {f.destination}
      </p>
      <p className="tnum mt-0.5 text-sm text-ink-500">
        {f.flightNumber} &middot; sched dep {formatClock(f.scheduledDeparture)}
      </p>

      <dl className="tnum mt-4 space-y-1.5 border-t border-ink-200 pt-3 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-ink-500">Inherited</dt>
          <dd className="font-medium text-ink-800">{node.inheritedDelayMin} min</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-ink-500">Fresh</dt>
          <dd className="font-medium text-ink-800">+{node.freshDelayMin} min</dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-ink-200 pt-3">
        <p className="eyebrow">Predicted departure delay</p>
        <p className={`tnum mt-1 text-3xl font-semibold tracking-tight ${style.text}`}>
          {node.totalDelayMin}
          <span className="ml-1 text-base font-medium text-ink-400">min</span>
        </p>
        <p className="tnum mt-1 text-sm text-ink-500">
          Interval {node.intervalLowMin}&ndash;{node.intervalHighMin} min
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-3">
        <span className="tnum text-xs text-ink-500">
          Slack {node.slackMin} min
        </span>
        {node.absorbed ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0a7c0a]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Absorbed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-risk-critical">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            Not absorbed
          </span>
        )}
      </div>
    </div>
  );
}

function BeyondHorizonCard({ node }: { node: CascadeNode }) {
  const f = node.flight;
  return (
    <div className="w-[212px] shrink-0 rounded-xl border border-dashed border-ink-300 bg-ink-50/70 p-4 lg:w-[228px]">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Hop {node.hop}</span>
        <Tooltip content={CONFIDENCE_NOTE}>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-500 ring-1 ring-inset ring-ink-200">
            <Info className="h-3 w-3" aria-hidden />
            Beyond depth 2
          </span>
        </Tooltip>
      </div>

      <p className="tnum mt-2.5 text-lg font-bold tracking-tight text-ink-600">
        {f.origin}
        <span className="px-1.5 text-ink-300">&rarr;</span>
        {f.destination}
      </p>
      <p className="tnum mt-0.5 text-sm text-ink-400">
        {f.flightNumber} &middot; sched dep {formatClock(f.scheduledDeparture)}
      </p>

      <div className="mt-4 border-t border-dashed border-ink-300 pt-3">
        <p className="text-[0.9375rem] font-semibold leading-snug text-ink-700">
          Cascade likely continues
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          No delay estimate published at this depth.
        </p>
      </div>

      <div className="mt-3 border-t border-dashed border-ink-300 pt-3">
        <span className="tnum text-xs text-ink-400">Slack {node.slackMin} min</span>
      </div>
    </div>
  );
}

function ConfidenceBoundary() {
  return (
    <div className="relative flex w-10 shrink-0 items-stretch justify-center self-stretch lg:w-12">
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l-2 border-dashed border-ink-400"
      />
      <Tooltip content={CONFIDENCE_NOTE} className="items-center">
        <span className="relative z-10 my-auto inline-flex -rotate-90 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-300 bg-white px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-600">
          <Info className="h-3 w-3 rotate-90" aria-hidden />
          Confidence boundary
        </span>
      </Tooltip>
    </div>
  );
}

export function CascadeChain({
  cascade,
  animateFrom,
}: {
  cascade: Cascade;
  /** When set, nodes fade in one after another from this key. Used on /live. */
  animateFrom?: string;
}) {
  if (cascade.nodes.length === 0) {
    return (
      <div className="card card-pad text-sm text-ink-600">
        <p className="font-semibold text-ink-800">Nothing downstream.</p>
        <p className="mt-1">
          This is the final leg of {cascade.originFlight.tail}&apos;s day. The delay ends
          here rather than propagating into another departure.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-slim pb-3">
      <div className="flex min-w-max items-stretch py-1">
        <OriginCard cascade={cascade} />

        {cascade.nodes.map((node, i) => {
          const previous = cascade.nodes[i - 1];
          const crossesBoundary =
            node.quantitative === false && (i === 0 || previous.quantitative);

          return (
            <div key={node.flight.id} className="flex items-stretch">
              <Connector node={node} />
              {crossesBoundary ? <ConfidenceBoundary /> : null}
              <div
                key={animateFrom ? `${animateFrom}-${node.flight.id}` : node.flight.id}
                className={animateFrom ? "animate-fade-up" : undefined}
                style={animateFrom ? { animationDelay: `${i * 140}ms` } : undefined}
              >
                {node.quantitative ? (
                  <QuantitativeCard node={node} />
                ) : (
                  <BeyondHorizonCard node={node} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
