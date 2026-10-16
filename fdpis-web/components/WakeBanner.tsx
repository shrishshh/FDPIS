"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { getServerState, getWakeStartedAt, subscribeServerState } from "@/lib/api";

/**
 * Shown while the hosted model server is starting from sleep. The API client
 * sets the state (see lib/api/client.ts); this only renders it.
 */
export function WakeBanner() {
  const state = useSyncExternalStore(subscribeServerState, getServerState, () => "unknown");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state !== "waking") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  if (state !== "waking") return null;
  const started = getWakeStartedAt();
  const elapsed = started ? Math.max(0, Math.round((now - started) / 1000)) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-[#f2ddab] bg-[#fdf4e0] px-5 py-2.5 text-[#8a5d00] lg:px-8"
    >
      <div className="mx-auto flex max-w-[1600px] items-center gap-2.5 text-sm">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <p>
          <span className="font-semibold">
            Waking up the model server — this takes about a minute on first visit.
          </span>{" "}
          <span className="tnum text-[#8a5d00]/80">{elapsed}s</span>
        </p>
      </div>
    </div>
  );
}
