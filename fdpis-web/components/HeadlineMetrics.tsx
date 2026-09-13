"use client";

import { useCallback, useEffect, useState } from "react";
import type { HeadlineMetric } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { ErrorState, Skeleton } from "@/components/States";
import { getModelPerformance } from "@/lib/api";

/** Validated headline figures, read from /api/performance. */
export function HeadlineMetrics() {
  const [metrics, setMetrics] = useState<HeadlineMetric[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setError(null);
    getModelPerformance()
      .then((p) => { if (live) setMetrics(p.headline); })
      .catch((e) => { if (live) setError(e); });
    return () => { live = false; };
  }, [nonce]);

  if (error) {
    return <ErrorState error={error} onRetry={retry} context="Could not load validated metrics" />;
  }
  if (!metrics) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.id} value={m.value} label={m.label} detail={m.detail} />
      ))}
    </div>
  );
}
