"use client";

import { Info } from "lucide-react";
import type { Cascade, CascadeNode } from "@/lib/types";
import { Tooltip } from "@/components/Tooltip";
import { SEVERITY_STYLES, formatClock } from "@/lib/format";

/**
 * Edge-centric cascade chain.
 *
 * The prior version put the story in the NODES (each downstream leg as a card
 * of numbers). This version puts it on the EDGES - the turnaround between two
 * legs - because the operationally interesting fact is not just "how late is
 * this flight" but "where did the delay stop." An edge that absorbed the
 * inbound delay and an edge that passed most of it through look identical if
 * you only read node totals; they must not look identical here.
 *
 * A note on honesty: the visual spec for this component asks for an
 * "absorption equation" of the form
 *     62 min inbound  -  45 min slack  =  17 min passed on
 * That equation is the ARITHMETIC BASELINE from notebook 3 (max(0, inbound -
 * slack)) - a formula the deployed model was built to beat, and does beat
 * (MAE 7.67 vs 8.47). The number this app actually reports as "passed on"
 * (inheritedDelayMin) is the LEARNED model's prediction, which routinely
 * differs from that raw subtraction - sometimes by a lot (checked against
 * live API responses while building this: 45 min inbound with 19 min slack
 * produced 42.33 min passed on, not 45-19=26). Printing "45 - 19 = 42.33"
 * would be a false equation sitting in the UI in tabular numerals, which is
 * exactly the kind of invented/inconsistent figure this project has spent
 * several review passes eliminating elsewhere (see AUDIT_REPORT.md).
 *
 * So the edge shows the three real numbers - inbound, slack, passed-on - but
 * connects the last one with an arrow ("->"), not an equals sign, and the
 * tooltip says plainly that it is a model prediction, not a subtraction.
 */

type EdgeState = "absorbed" | "propagating" | "low-confidence";

/** Mirrors config.DEPTH_CORRELATION on the backend and the Performance page. */
const DEPTH_CORRELATION: Record<number, number> = {
  1: 0.674,
  2: 0.428,
  3: 0.327,
  4: 0.233,
  5: 0.226,
};

const BOUNDARY_NOTE =
  "Model correlation with observed delay, by depth: " +
  Object.entries(DEPTH_CORRELATION)
    .map(([d, c]) => `depth ${d} = ${c.toFixed(3)}`)
    .join(", ") +
  ". Beyond depth 2 it falls below 0.33, which is not enough to publish a " +
  "number. Quantitative predictions stop here by design, not because the " +
  "data ran out.";

function confidenceNote(depth: number, correlation: number | null): string {
  const c = correlation === null ? "below 0.33" : correlation.toFixed(3);
  return (
    `The propagation model's correlation with observed delay at depth ${depth} is ` +
    `${c}. Past depth 2 it falls below 0.33, which is not enough to publish a ` +
    `figure, so no delay estimate is reported for this leg. The cascade is still ` +
    `expected to continue.`
  );
}

function edgeStateFor(node: CascadeNode): EdgeState {
  if (!node.quantitative) return "low-confidence";
  if (node.absorbed) return "absorbed";
  return "propagating";
}

function edgeTooltip(node: CascadeNode): string {
  if (!node.quantitative) return confidenceNote(node.hop, node.correlationAtDepth);

  const inbound = Math.round(node.inboundDelayMin);
  const slackText =
    node.slackMin != null
      ? `${Math.round(node.slackMin)} min of scheduled ground time`
      : "no recorded turnaround slack";

  if (node.absorbed) {
    return (
      `${inbound} min of delay arrived at this turnaround, with ${slackText}. ` +
      `The propagation model predicts none of it survives to the next departure.`
    );
  }

  const passed = node.inheritedDelayMin != null ? Math.round(node.inheritedDelayMin) : null;
  return (
    `${inbound} min of delay arrived at this turnaround, with ${slackText}. ` +
    `The propagation model predicts ${passed} min carries through to the next ` +
    `departure - a learned estimate informed by slack, congestion and rotation ` +
    `position, not a literal subtraction of the two figures shown.`
  );
}

const NODE_W = 188;
const EDGE_W = 164;

/** The turnaround between two legs. This is where the story lives. */
function Edge({
  node,
  animate,
  delayMs,
}: {
  node: CascadeNode;
  animate?: boolean;
  delayMs?: number;
}) {
  const state = edgeStateFor(node);
  const inherited = node.inheritedDelayMin;

  const stroke =
    state === "absorbed"
      ? "#0f766e"
      : state === "low-confidence"
        ? "#9aa3aa"
        : node.severity
          ? SEVERITY_STYLES[node.severity].hex
          : "#9aa3aa";

  // Thickness carries transmitted minutes - but only where there is a real
  // transmitted figure. Absorbed and low-confidence edges get a fixed, thin
  // weight; nothing here is scaled from a number we don't have.
  const strokeWidth =
    state === "propagating"
      ? Math.min(16, Math.max(2.5, 2.5 + (inherited ?? 0) / 6))
      : state === "absorbed"
        ? 2.5
        : 2;

  const dash =
    state === "absorbed" ? "7 5" : state === "low-confidence" ? "1.5 4.5" : undefined;

  const stateLabel =
    state === "absorbed" ? "Absorbed" : state === "low-confidence" ? "Low confidence" : "Propagating";

  const stateLabelColor =
    state === "absorbed" ? "text-accent-700" : state === "low-confidence" ? "text-ink-400" : "text-ink-500";

  const svgW = EDGE_W - 24;

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-2 self-stretch py-4"
      style={{ width: EDGE_W }}
    >
      <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.06em] ${stateLabelColor}`}>
        {stateLabel}
      </span>

      <svg
        width={svgW}
        height={12}
        viewBox={`0 0 ${svgW} 12`}
        aria-hidden
        className={animate ? "animate-grow-x" : undefined}
        style={
          animate
            ? { transformOrigin: "left center", animationDelay: `${delayMs ?? 0}ms` }
            : undefined
        }
      >
        <line
          x1={1}
          y1={6}
          x2={svgW - 1}
          y2={6}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </svg>

      <Tooltip content={edgeTooltip(node)} className="w-full justify-center">
        <div className="flex w-full cursor-help flex-col items-center gap-0.5 px-1.5 text-center">
          {state === "low-confidence" ? (
            // Explicitly no numbers past the confidence boundary - see the
            // module doc comment for why.
            <span className="text-[0.6875rem] font-semibold italic text-ink-400">
              cascade likely continues
            </span>
          ) : (
            <>
              <span className="tnum text-[0.6875rem] leading-snug text-ink-500">
                {Math.round(node.inboundDelayMin)} min inbound{" "}
                &minus; {node.slackMin != null ? Math.round(node.slackMin) : 0} min slack
              </span>
              <span
                className={`tnum text-xs font-bold ${
                  state === "absorbed" ? "text-accent-700" : SEVERITY_STYLES[node.severity ?? "clear"].text
                }`}
              >
                {state === "absorbed"
                  ? "→ absorbed"
                  : `→ ${Math.round(inherited ?? 0)} min passed on`}
              </span>
            </>
          )}
        </div>
      </Tooltip>
    </div>
  );
}

function OriginNode({ cascade }: { cascade: Cascade }) {
  const f = cascade.originFlight;
  const sourceLabel =
    cascade.observedDelaySource === "historical_actual"
      ? "Observed delay (historical)"
      : "Observed delay (entered by you)";

  return (
    <div
      className="shrink-0 rounded-xl border-2 border-ink-900 bg-ink-900 p-4 text-white"
      style={{ width: NODE_W }}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/60">
        Disrupted leg
      </p>
      {f ? (
        <>
          <p className="tnum mt-2 text-lg font-bold tracking-tight">
            {f.origin}
            <span className="px-1.5 text-white/40">&rarr;</span>
            {f.destination}
          </p>
          <p className="tnum mt-0.5 text-xs text-white/70">
            {f.flightNumber} &middot; dep {formatClock(f.scheduledDeparture)} &middot; leg{" "}
            {f.legIndex} of {f.legCount}
          </p>
        </>
      ) : (
        <p className="tnum mt-2 text-lg font-bold tracking-tight">
          {cascade.tail} &middot; leg {cascade.originLeg}
        </p>
      )}

      <div className="mt-4 border-t border-white/15 pt-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/60">
          {sourceLabel}
        </p>
        <p className="tnum mt-1 text-3xl font-semibold tracking-tight">
          {Math.round(cascade.observedDelayMin)}
          <span className="ml-1 text-base font-medium text-white/60">min</span>
        </p>
      </div>
    </div>
  );
}

/** Simplified per the edge-centric spec: route, time, outcome. No breakdown -
 * the edge leading into this node already explained how the number got here. */
function QuantitativeNode({ node }: { node: CascadeNode }) {
  const style = SEVERITY_STYLES[node.severity ?? "clear"];
  const f = node.flight;

  return (
    <div
      className={`shrink-0 rounded-xl border bg-white p-4 shadow-card ${style.border}`}
      style={{ width: NODE_W }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Hop {node.hop}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${style.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.bar}`} aria-hidden />
          {style.label}
        </span>
      </div>

      <p className="tnum mt-2.5 text-base font-bold tracking-tight text-ink-900">
        {f.origin}
        <span className="px-1.5 text-ink-300">&rarr;</span>
        {f.destination}
      </p>
      <p className="tnum mt-0.5 text-xs text-ink-500">
        {f.flightNumber} &middot; sched dep {formatClock(f.scheduledDeparture)}
      </p>

      <div className="mt-3 border-t border-ink-200 pt-3">
        <p className="eyebrow">Predicted departure delay</p>
        <p className={`tnum mt-1 text-2xl font-semibold tracking-tight ${style.text}`}>
          {node.totalDelayMin != null ? Math.round(node.totalDelayMin) : "--"}
          <span className="ml-1 text-sm font-medium text-ink-400">min</span>
        </p>
        <p className="tnum mt-1 text-xs text-ink-500">
          Interval{" "}
          {node.intervalLowMin != null ? Math.round(node.intervalLowMin) : "--"}
          &ndash;
          {node.intervalHighMin != null ? Math.round(node.intervalHighMin) : "--"} min
        </p>
      </div>
    </div>
  );
}

function LowConfidenceNode({ node }: { node: CascadeNode }) {
  const f = node.flight;
  return (
    <div
      className="shrink-0 rounded-xl border border-dashed border-ink-300 bg-ink-50/70 p-4"
      style={{ width: NODE_W }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Hop {node.hop}</span>
        <Tooltip content={confidenceNote(node.hop, node.correlationAtDepth)}>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-500 ring-1 ring-inset ring-ink-200">
            <Info className="h-3 w-3" aria-hidden />
            Beyond depth 2
          </span>
        </Tooltip>
      </div>

      <p className="tnum mt-2.5 text-base font-bold tracking-tight text-ink-600">
        {f.origin}
        <span className="px-1.5 text-ink-300">&rarr;</span>
        {f.destination}
      </p>
      <p className="tnum mt-0.5 text-xs text-ink-400">
        {f.flightNumber} &middot; sched dep {formatClock(f.scheduledDeparture)}
      </p>

      <div className="mt-3 border-t border-dashed border-ink-300 pt-3">
        <p className="text-sm font-semibold leading-snug text-ink-700">
          Cascade likely continues
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          No delay estimate published at this depth.
        </p>
      </div>
    </div>
  );
}

/**
 * The single most defensible line in the whole system, drawn so it cannot be
 * scrolled past unnoticed: a full-height, tinted, dashed-edged column with the
 * claim spelled out in words, plus the exact per-depth correlation figures on
 * hover/focus.
 */
function ConfidenceBoundary() {
  return (
    <div className="relative flex w-20 shrink-0 items-stretch self-stretch" aria-hidden={false}>
      <div
        className="absolute inset-0 border-x border-dashed border-[#e8c674] bg-[#fdf4e0]/70"
        aria-hidden
      />
      <Tooltip content={BOUNDARY_NOTE} className="relative z-10 w-full items-stretch" side="top">
        <div className="flex h-full w-full cursor-help flex-col items-center justify-center gap-1.5 px-1.5 py-4 text-center">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#8a5d00]" aria-hidden />
          <p className="text-[0.625rem] font-bold uppercase leading-tight tracking-[0.04em] text-[#8a5d00]">
            Quantitative predictions end here
          </p>
        </div>
      </Tooltip>
    </div>
  );
}

export function CascadeChain({
  cascade,
  animateFrom,
}: {
  cascade: Cascade;
  /** When set, edges and nodes fill in sequentially from this key. Used on /live. */
  animateFrom?: string;
}) {
  if (cascade.nodes.length === 0) {
    return (
      <div className="card card-pad text-sm text-ink-600">
        <p className="font-semibold text-ink-800">Nothing downstream.</p>
        <p className="mt-1">
          This is the final leg of {cascade.tail}&apos;s day. The delay ends here
          rather than propagating into another departure.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-slim pb-3">
      <div className="flex min-w-max items-stretch py-1">
        <OriginNode cascade={cascade} />

        {cascade.nodes.map((node, i) => {
          const previous = cascade.nodes[i - 1];
          const crossesBoundary =
            node.quantitative === false && (i === 0 || previous.quantitative);

          // Edges draw in slightly ahead of the node they feed, so the chain
          // reads as "the turn resolves, then the flight lands" - 150ms per
          // hop total, matching the spec (quick, not a slow reveal).
          const edgeDelay = animateFrom ? i * 150 : undefined;
          const nodeDelay = animateFrom ? i * 150 + 70 : undefined;

          return (
            <div key={node.flight.id} className="flex items-stretch">
              <Edge node={node} animate={Boolean(animateFrom)} delayMs={edgeDelay} />
              {crossesBoundary ? <ConfidenceBoundary /> : null}
              <div
                key={animateFrom ? `${animateFrom}-${node.flight.id}` : node.flight.id}
                className={animateFrom ? "animate-fade-up" : undefined}
                style={animateFrom ? { animationDelay: `${nodeDelay}ms` } : undefined}
              >
                {node.quantitative ? (
                  <QuantitativeNode node={node} />
                ) : (
                  <LowConfidenceNode node={node} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
