"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter, RotateCcw } from "lucide-react";
import type { BriefingSummary, FilterOptions, Flight } from "@/lib/types";
import { StatTile } from "@/components/MetricCard";
import { FlightRow } from "@/components/briefing/FlightRow";
import { formatCount, formatDateLong } from "@/lib/format";
import {
  DEMO_DATE,
  REVIEW_QUEUE_SIZE,
  getBriefingSummary,
  getFilterOptions,
  getRiskList,
} from "@/lib/api";

/** Column headers, shared by both tables so they stay in step. */
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
      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Delay prob.</th>
      <th scope="col" className="py-2.5 pl-3 pr-5 lg:pr-6"><span className="sr-only">Open</span></th>
    </tr>
  );
}

export function BriefingView() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [summary, setSummary] = useState<BriefingSummary | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);

  const [carrier, setCarrier] = useState("");
  const [origin, setOrigin] = useState("");
  const [minRisk, setMinRisk] = useState(0);

  // Summary and filter options are day-level: they do not move with filters.
  useEffect(() => {
    let live = true;
    Promise.all([getBriefingSummary(DEMO_DATE), getFilterOptions()]).then(([s, o]) => {
      if (!live) return;
      setSummary(s);
      setOptions(o);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getRiskList(DEMO_DATE, {
      carrier: carrier || undefined,
      origin: origin || undefined,
      minRisk: minRisk || undefined,
    }).then((rows) => {
      if (!live) return;
      setFlights(rows);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [carrier, origin, minRisk]);

  const reviewQueue = useMemo(() => flights.slice(0, REVIEW_QUEUE_SIZE), [flights]);
  const remainder = useMemo(() => flights.slice(REVIEW_QUEUE_SIZE), [flights]);

  const filtersActive = carrier !== "" || origin !== "" || minRisk > 0;

  function resetFilters() {
    setCarrier("");
    setOrigin("");
    setMinRisk(0);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
      <div className="card grid grid-cols-2 divide-ink-200 lg:grid-cols-4 lg:divide-x">
        <StatTile
          value={summary ? formatCount(summary.flightsScheduled) : "--"}
          label="Flights scheduled"
        />
        <StatTile
          value={summary ? formatCount(summary.highRiskCount) : "--"}
          label="High risk (score 60+)"
          tone="critical"
        />
        <StatTile
          value={summary ? formatCount(summary.predictedCascades) : "--"}
          label="Predicted cascades"
        />
        <StatTile
          value={summary ? formatCount(summary.aircraftAffected) : "--"}
          label="Aircraft affected"
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 pb-2.5 text-ink-500">
            <Filter className="h-4 w-4" aria-hidden />
            <span className="eyebrow">Filters</span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">Carrier</span>
            <select
              className="field w-48"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            >
              <option value="">All carriers</option>
              {options?.carriers.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">Origin</span>
            <select
              className="field w-36"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              <option value="">All airports</option>
              {options?.origins.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">
              Minimum risk score{" "}
              <span className="tnum font-semibold text-ink-900">{minRisk}</span>
            </span>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="h-10 w-56"
              aria-label="Minimum risk score"
            />
          </label>

          {filtersActive ? (
            <button type="button" onClick={resetFilters} className="btn-secondary h-10">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
          ) : null}
        </div>

        <p className="tnum pb-2.5 text-sm text-ink-500">
          {loading ? "Ranking..." : formatCount(flights.length) + " flights match"}
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

          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <HeadRow />
              </thead>
              <tbody>
                {reviewQueue.map((flight, i) => (
                  <FlightRow key={flight.id} flight={flight} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>

          {!loading && reviewQueue.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-ink-500">
              No flights match these filters.
            </p>
          ) : null}
        </div>
      </section>

      {remainder.length > 0 ? (
        <section className="mt-6">
          <div className="card overflow-hidden">
            <div className="border-b border-ink-200 px-5 py-3.5 lg:px-6">
              <h2 className="text-sm font-semibold text-ink-700">
                Remaining schedule{" "}
                <span className="tnum font-normal text-ink-400">
                  ({formatCount(remainder.length)} flights)
                </span>
              </h2>
            </div>
            <div className="max-h-[70vh] overflow-auto scrollbar-slim">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e4e7e9]">
                  <HeadRow />
                </thead>
                <tbody>
                  {remainder.map((flight, i) => (
                    <FlightRow
                      key={flight.id}
                      flight={flight}
                      rank={i + 1 + REVIEW_QUEUE_SIZE}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-ink-400">
        Operating day {formatDateLong(DEMO_DATE)}. Generated demo fixtures, not a live
        operational feed.
      </p>
    </div>
  );
}
