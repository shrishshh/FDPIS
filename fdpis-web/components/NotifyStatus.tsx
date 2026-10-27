"use client";

import { useEffect, useState } from "react";
import type { NotifyStatus } from "@/lib/types";
import { getNotifyStatus } from "@/lib/api";

// One request per page load, shared by every component that asks.
let pending: Promise<NotifyStatus> | null = null;

/**
 * Whether the API sends notifications over the live WhatsApp demo channel.
 * null until known; any failure reads as simulated, which is the safe claim.
 */
export function useNotifyStatus(): NotifyStatus | null {
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  useEffect(() => {
    let live = true;
    pending ??= getNotifyStatus().catch(() => {
      pending = null;
      return { live: false, channel: "simulated" } as NotifyStatus;
    });
    pending.then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  return status;
}

/** The footer's notification clause, true to the server's current mode. */
export function NotificationsClause() {
  const status = useNotifyStatus();
  return <>{status?.live ? "Live WhatsApp channel enabled (demo recipient)." : "notifications are simulated."}</>;
}
