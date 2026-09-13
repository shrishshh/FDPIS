"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Flight } from "@/lib/types";
import { RiskScore } from "@/components/Risk";
import { useScope } from "@/components/DataScope";
import {
  ApiUnreachable, EmptyState, ErrorState, LoadingState,
} from "@/components/States";
import { getRiskList } from "@/lib/api";
import { bandSeverity, formatClock } from "@/lib/format";

export function CascadePicker() {
  const scope = useScope();
  const { date, carrier } = scope;
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getRiskList(date, { carrier: carrier || undefined }, 200)
      .then((rows) => { if (live) setFlights(rows); })
      .catch((e) => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [date, carrier, nonce]);

  // Only legs with somewhere to propagate to are worth opening.
  const candidates = flights
    .filter((f) => f.legIndex != null && f.legCount != null && f.tail
      && f.legCount - f.legIndex >= 2)
    .slice(0, 12);

  if (!scope.ready) return <Wrap><LoadingState label="Connecting to the API" /></Wrap>;
  if (scope.error) return <Wrap><ApiUnreachable onRetry={scope.retry} /></Wrap>;
  if (loading) return <Wrap><LoadingState label="Ranking the day" /></Wrap>;
  if (error) {
    return <Wrap><ErrorState error={error} onRetry={retry} context="Could not load flights" /></Wrap>;
  }
  if (candidates.length === 0) {
    return (
      <Wrap>
        <EmptyState
          title="No traceable flights for this selection"
          detail="Every high-risk flight on this date is the last leg of its rotation, so there is nothing downstream to break. Try another date or carrier."
        />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {candidates.map((f) => (
          <Link
            key={f.id}
            href={`/cascade/${encodeURIComponent(f.tail as string)}/${encodeURIComponent(date)}/${f.legIndex}`}
            className="card card-pad group transition-colors duration-150 hover:border-accent-300 hover:bg-accent-50/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tnum text-lg font-bold tracking-tight text-ink-900">
                  {f.origin}<span className="px-1.5 text-ink-300">&rarr;</span>{f.destination}
                </p>
                <p className="tnum mt-0.5 text-sm text-ink-500">
                  {f.flightNumber} &middot; {f.carrier} &middot; dep {formatClock(f.scheduledDeparture)}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-accent-600" aria-hidden />
            </div>

            <div className="mt-4 border-t border-ink-200 pt-3">
              <RiskScore score={f.riskScore} width={110} severity={bandSeverity(f.riskBand)} />
            </div>

            <dl className="tnum mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-ink-400">Tail</dt>
                <dd className="font-medium text-ink-700">{f.tail}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Rotation</dt>
                <dd className="font-medium text-ink-700">leg {f.legIndex}/{f.legCount}</dd>
              </div>
              <div>
                <dt className="text-ink-400" title="Historical ground truth, not a prediction">
                  Actual
                </dt>
                <dd className="font-medium text-ink-700">
                  {f.actualDelayMinutes === null ? "--" : `${Math.round(f.actualDelayMinutes)}m`}
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">{children}</div>;
}
