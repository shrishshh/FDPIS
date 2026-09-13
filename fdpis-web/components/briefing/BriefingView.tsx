"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter, RotateCcw } from "lucide-react";
import type { BriefingSummary, Flight } from "@/lib/types";
import { StatTile } from "@/components/MetricCard";
import { FlightRow } from "@/components/briefing/FlightRow";
import { useScope } from "@/components/DataScope";
import {
  ApiUnreachable, EmptyState, ErrorState, LoadingState, Skeleton,
} from "@/components/States";
import { formatCount } from "@/lib/format";
import {
  BRIEFING_PAGE_SIZE, REVIEW_QUEUE_SIZE, getBriefingSummary, getRiskList,
} from "@/lib/api";

function HeadRow() {
  return (
    <tr className="table-head">
      <th scope="col" className="py-2.5 pl-5 pr-3 text-left font-semibold lg:pl-6">Risk</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Flight</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Carrier</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Route</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Sched dep</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Tail</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Rotation</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Turn slack</th>
      <th scope="col" className="px-3 py-2.5 text-left font-semibold" title="Historical ground truth, not a prediction">
        Actual delay
      </th>
      <th scope="col" className="py-2.5 pl-3 pr-5 lg:pr-6"><span className="sr-only">Open</span></th>
    </tr>
  );
}

export function BriefingView() {
  const scope = useScope();
  const { date, carrier } = scope;

  const [flights, setFlights] = useState<Flight[]>([]);
  const [summary, setSummary] = useState<BriefingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  // Origin and minimum-risk are applied client-side: the backend briefing
  // endpoint filters by carrier only.
  const [origin, setOrigin] = useState("");
  const [minRisk, setMinRisk] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getRiskList(date, { carrier: carrier || undefined }, BRIEFING_PAGE_SIZE),
      getBriefingSummary(date, carrier || undefined),
    ])
      .then(([rows, s]) => {
        if (!live) return;
        setFlights(rows);
        setSummary(s);
      })
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [date, carrier, nonce]);

  const origins = useMemo(
    () => Array.from(new Set(flights.map((f) => f.origin))).sort(),
    [flights],
  );

  const filtered = useMemo(
    () =>
      flights
        .filter((f) => (origin ? f.origin === origin : true))
        .filter((f) => (minRisk ? f.riskScore >= minRisk : true)),
    [flights, origin, minRisk],
  );

  const reviewQueue = filtered.slice(0, REVIEW_QUEUE_SIZE);
  const remainder = filtered.slice(REVIEW_QUEUE_SIZE);
  const filtersActive = origin !== "" || minRisk > 0;

  if (!scope.ready) {
    return <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8"><LoadingState label="Connecting to the API" /></div>;
  }
  if (scope.error) {
    return <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8"><ApiUnreachable onRetry={scope.retry} /></div>;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
      {error ? (
        <ErrorState error={error} onRetry={retry} context="Could not load the briefing" />
      ) : null}

      <div className="card mt-0 grid grid-cols-2 divide-ink-200 lg:grid-cols-4 lg:divide-x">
        {loading && !summary ? (
          <div className="col-span-2 lg:col-span-4 p-5"><Skeleton className="h-14 w-full" /></div>
        ) : (
          <>
            <StatTile value={summary ? formatCount(summary.flightsScheduled) : "--"} label="Flights scheduled" />
            <StatTile value={summary ? formatCount(summary.highRiskCount) : "--"} label="High risk (top decile)" tone="critical" />
            <StatTile value={summary ? formatCount(summary.aircraftAffected) : "--"} label="Aircraft affected" />
            <StatTile value={summary?.meanAvailableSlack != null ? `${summary.meanAvailableSlack} min` : "--"} label="Mean turn slack" />
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 pb-2.5 text-ink-500">
            <Filter className="h-4 w-4" aria-hidden />
            <span className="eyebrow">Refine</span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">Origin</span>
            <select className="field w-36" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">All airports</option>
              {origins.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">
              Minimum risk score <span className="tnum font-semibold text-ink-900">{minRisk}</span>
            </span>
            <input type="range" min={0} max={95} step={5} value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="h-10 w-56" aria-label="Minimum risk score" />
          </label>

          {filtersActive ? (
            <button type="button" onClick={() => { setOrigin(""); setMinRisk(0); }} className="btn-secondary h-10">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
          ) : null}
        </div>

        <p className="tnum pb-2.5 text-sm text-ink-500">
          {loading ? "Scoring the day…"
            : `${formatCount(filtered.length)} of top ${formatCount(flights.length)} shown`}
        </p>
      </div>

      <section className="mt-5">
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-1.5 border-b-2 border-accent-600 bg-accent-50/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-[18px] w-[18px] text-accent-700" aria-hidden />
              <h2 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
                Review queue - top {REVIEW_QUEUE_SIZE} by risk
              </h2>
            </div>
            <p className="max-w-xl text-sm text-ink-600 lg:text-right">
              At top-1% review depth the model runs 78.1% precision. These are the
              flights worth a human decision before the bank departs.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={flights.length === 0 ? "No flights for this date" : "No flights match these filters"}
                detail={flights.length === 0
                  ? "The dataset has no records for the selected date and carrier."
                  : "Loosen the origin or minimum-risk filter."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead><HeadRow /></thead>
                <tbody>
                  {reviewQueue.map((flight, i) => (
                    <FlightRow key={flight.id} flight={flight} rank={i + 1} date={date} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {remainder.length > 0 ? (
        <section className="mt-6">
          <div className="card overflow-hidden">
            <div className="border-b border-ink-200 px-5 py-3.5 lg:px-6">
              <h2 className="text-sm font-semibold text-ink-700">
                Remaining ranked flights{" "}
                <span className="tnum font-normal text-ink-400">({formatCount(remainder.length)})</span>
              </h2>
            </div>
            <div className="max-h-[70vh] overflow-auto scrollbar-slim">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e4e7e9]"><HeadRow /></thead>
                <tbody>
                  {remainder.map((flight, i) => (
                    <FlightRow key={flight.id} flight={flight} rank={i + 1 + REVIEW_QUEUE_SIZE} date={date} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-ink-400">
        Operating day {date || "--"}. Real model predictions over historical flights;
        the actual-delay column is recorded ground truth, not a forecast.
      </p>
    </div>
  );
}
