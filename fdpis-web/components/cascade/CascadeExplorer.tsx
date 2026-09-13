"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowLeft, Info } from "lucide-react";
import type { Cascade } from "@/lib/types";
import { CascadeChain } from "@/components/cascade/CascadeChain";
import { RecommendationPanel } from "@/components/cascade/RecommendationPanel";
import { ErrorState, LoadingState } from "@/components/States";
import { ApiError, getCascadeForFlight } from "@/lib/api";
import { formatClock, formatDuration } from "@/lib/format";

function BackLink() {
  return (
    <Link
      href="/briefing"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-accent-700"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to briefing
    </Link>
  );
}

function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: "critical" }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-5 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-0.5 text-2xl font-semibold ${tone === "critical" ? "text-risk-critical" : "text-ink-900"}`}>
        {value}
        {sub ? <span className="ml-1.5 text-sm font-medium text-ink-500">({sub})</span> : null}
      </p>
    </div>
  );
}

function NoRecordedArrival({
  tail, date, legIndex,
}: { tail: string; date: string; legIndex: number }) {
  return (
    <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
      <BackLink />
      <div className="card card-pad mt-4 max-w-3xl border-[#f2ddab] bg-[#fdf4e0]">
        <div className="flex items-center gap-2.5">
          <Info className="h-[18px] w-[18px] text-[#8a5d00]" aria-hidden />
          <h1 className="text-base font-bold text-[#8a5d00]">
            No recorded arrival for this leg
          </h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#8a5d00]/90">
          {tail} leg {legIndex} on {date} has no arrival delay on record, which
          normally means it was cancelled or diverted. There is no historical
          cascade to replay.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#8a5d00]/90">
          You can still model one: enter a hypothetical delay on this rotation in
          Live Delay Entry.
        </p>
        <Link
          href={`/live?tail=${encodeURIComponent(tail)}&date=${encodeURIComponent(date)}&leg=${legIndex}`}
          className="btn-primary mt-4"
        >
          <Activity className="h-4 w-4" aria-hidden />
          Open in Live Delay Entry
        </Link>
      </div>
    </div>
  );
}

export function CascadeExplorer({
  tail, date, legIndex,
}: { tail: string; date: string; legIndex: number }) {
  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getCascadeForFlight(tail, date, legIndex)
      .then((c) => { if (live) setCascade(c); })
      .catch((e) => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tail, date, legIndex, nonce]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
        <LoadingState label="Tracing the cascade" />
      </div>
    );
  }

  // 422 = the leg has no recorded arrival (cancelled or diverted). A fact about
  // the flight, not a failure, so send the user somewhere useful.
  if (error instanceof ApiError && error.isUnprocessable) {
    return <NoRecordedArrival tail={tail} date={date} legIndex={legIndex} />;
  }

  if (error || !cascade) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
        <BackLink />
        <div className="mt-4">
          <ErrorState error={error} onRetry={retry} context="Could not load this cascade" />
        </div>
      </div>
    );
  }

  const f = cascade.originFlight;
  const quantified = cascade.summary.quantifiedHops;
  const beyond = cascade.summary.lowConfidenceHops;

  return (
    <div className="pb-12">
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8 lg:py-7">
          <BackLink />
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow mb-2">Cascade explorer</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="tnum text-3xl font-bold tracking-tight text-ink-900 lg:text-4xl">
                  {f ? f.flightNumber : `${cascade.tail} leg ${cascade.originLeg}`}
                </h1>
                {f ? (
                  <span className="tnum text-2xl font-semibold text-ink-500 lg:text-3xl">
                    {f.origin}<span className="px-2 text-ink-300">&rarr;</span>{f.destination}
                  </span>
                ) : null}
              </div>
              <p className="tnum mt-2 text-[0.9375rem] text-ink-600">
                {cascade.tail} &middot; {cascade.date}
                {f ? ` · scheduled ${formatClock(f.scheduledDeparture)} · leg ${f.legIndex} of ${f.legCount}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <Stat
                label={cascade.observedDelaySource === "historical_actual"
                  ? "Observed delay (recorded)" : "Observed delay"}
                value={`${Math.round(cascade.observedDelayMin)} min`}
                tone="critical"
              />
              <Stat label="Downstream, depth 1-2"
                value={formatDuration(cascade.summary.totalDelayMinutesAdded)} />
              <Stat label="Legs in the chain"
                value={String(cascade.summary.legsAffected)}
                sub={`${quantified} quantified${beyond > 0 ? `, ${beyond} beyond` : ""}`} />
              <Link
                href={`/live?tail=${encodeURIComponent(cascade.tail)}&date=${encodeURIComponent(cascade.date)}&leg=${cascade.originLeg}&delay=${Math.round(cascade.observedDelayMin)}`}
                className="btn-secondary self-stretch"
              >
                <Activity className="h-4 w-4" aria-hidden />
                Try another delay
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_352px]">
          <section className="min-w-0">
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-1 border-b border-ink-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <h2 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
                  Downstream rotation for {cascade.tail}
                </h2>
                <p className="text-sm text-ink-500">
                  Connector thickness is the delay handed to the next departure.
                </p>
              </div>
              <div className="px-5 py-6 lg:px-6">
                <CascadeChain cascade={cascade} />
              </div>
            </div>

            <div className="card card-pad mt-6">
              <h3 className="text-sm font-bold tracking-tight text-ink-900">How to read this</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                Each turn subtracts its available slack from the inbound delay; whatever
                survives is inherited by the next departure, on top of the fresh delay that
                leg generates on its own. Hops 1 and 2 carry a numeric prediction with an
                interval. Past that the model reports only that the cascade continues
                &mdash; at depth 3 its correlation with observed delay is 0.327 and still
                falling, which is not enough to spend money on.
              </p>
            </div>
          </section>

          <RecommendationPanel
            recommendations={cascade.recommendations}
            className="self-start xl:sticky xl:top-20"
          />
        </div>
      </div>
    </div>
  );
}
