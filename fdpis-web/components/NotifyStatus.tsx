"use client";

import { useEffect, useState } from "react";
import type { LiveChannel, NotifyStatus } from "@/lib/types";
import { getNotifyStatus } from "@/lib/api";

// One request per page load, shared by every component that asks.
let pending: Promise<NotifyStatus> | null = null;

/** "telegram" -> "Telegram", "whatsapp" -> "WhatsApp". */
export function channelName(ch: LiveChannel): string {
  return ch === "telegram" ? "Telegram" : "WhatsApp";
}

/** The live channel's display name, or null when notifications are simulated. */
export function liveChannelName(status: NotifyStatus | null): string | null {
  return status?.live && status.channel !== "simulated" ? channelName(status.channel) : null;
}

/**
 * Whether the API sends notifications over a live demo channel, and which.
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
  const name = liveChannelName(useNotifyStatus());
  return <>{name ? `Live ${name} channel enabled (demo recipient).` : "notifications are simulated."}</>;
}
