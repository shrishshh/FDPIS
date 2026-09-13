"use client";

import { Calendar, Database } from "lucide-react";
import { useScope } from "@/components/DataScope";
import { formatCount } from "@/lib/format";

/** Date + carrier selectors, and the live connection indicator. */
export function ScopeBar() {
  const { dates, carriers, date, setDate, carrier, setCarrier, connected, health } =
    useScope();

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-ink-400" aria-hidden />
        <span className="sr-only">Operating date</span>
        <select
          className="field h-9 w-[9.5rem] text-xs"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={dates.length === 0}
        >
          {dates.length === 0 ? <option value="">No dates</option> : null}
          {dates.map((d) => (
            <option key={d.date} value={d.date}>
              {d.date} ({formatCount(d.flights)})
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Carrier</span>
        <select
          className="field h-9 w-[8.5rem] text-xs"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          disabled={carriers.length === 0}
        >
          <option value="">All carriers</option>
          {carriers.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({formatCount(c.flights)})
            </option>
          ))}
        </select>
      </label>

      <ConnectionBadge connected={connected} health={health} />
    </div>
  );
}

function ConnectionBadge({
  connected,
  health,
}: {
  connected: boolean;
  health: ReturnType<typeof useScope>["health"];
}) {
  const period = health ? `${health.dateMin} to ${health.dateMax}` : "unknown period";
  const title = connected
    ? `Connected to the FDPIS API. Serving real model predictions over historical ` +
      `flights from ${period} — ${formatCount(health?.parquetRows ?? 0)} records. ` +
      `This is not a live operational feed.`
    : "The FDPIS API is not reachable. Start the backend with: uvicorn api.main:app --reload";

  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold ${
        connected
          ? "border-[#bfe3bf] bg-[#eaf7ea] text-[#0a7c0a]"
          : "border-[#f0c2c2] bg-[#fbeaea] text-[#a52020]"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-risk-good" : "bg-risk-critical"}`}
      />
      {connected ? (
        <>
          <Database className="h-3 w-3" aria-hidden />
          <span className="hidden lg:inline">Historical data</span>
          <span className="lg:hidden">Live API</span>
        </>
      ) : (
        "API offline"
      )}
    </span>
  );
}
