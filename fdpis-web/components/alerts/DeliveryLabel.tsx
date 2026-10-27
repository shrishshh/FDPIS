import type { CrewNotification } from "@/lib/types";
import { channelName } from "@/components/NotifyStatus";

/** "2026-10-28T09:41:07+00:00" -> "09:41 UTC" */
function utcTime(iso: string | null): string {
  const m = iso?.match(/T(\d{2}:\d{2})/);
  return m ? `${m[1]} UTC` : "";
}

/**
 * How a notification left the system, in the words the operator should see.
 * Green only when the live channel actually accepted the message.
 */
export function deliveryLabel(n: CrewNotification): { text: string; tone: "sent" | "failed" | "simulated" } {
  const d = n.delivery;
  if ((d?.channel === "telegram" || d?.channel === "whatsapp") && d.status === "sent") {
    const t = utcTime(d.sentAt);
    return { text: `Delivered via ${channelName(d.channel)}${t ? ` · ${t}` : ""}`, tone: "sent" };
  }
  if (d?.status === "already_sent") return { text: "Already delivered", tone: "sent" };
  if (d?.status === "failed") return { text: "Delivery failed - recorded as simulated", tone: "failed" };
  return { text: "SIMULATED - not sent", tone: "simulated" };
}

const TONE = {
  sent: "bg-[#eaf7ea] text-[#0a7c0a] ring-[#bfe3bf]",
  failed: "bg-[#fdf4e0] text-[#8a5d00] ring-[#f2ddab]",
  simulated: "bg-ink-900 text-white ring-ink-900",
} as const;

export function DeliveryBadge({ notification }: { notification: CrewNotification }) {
  const { text, tone } = deliveryLabel(notification);
  return (
    <span
      title={notification.delivery?.error ?? undefined}
      className={`inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] ring-1 ring-inset ${TONE[tone]}`}
    >
      {text}
    </span>
  );
}
