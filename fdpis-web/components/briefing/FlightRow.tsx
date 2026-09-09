"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { Flight } from "@/lib/types";
import { RiskScore } from "@/components/Risk";
import { formatClock, formatPercent } from "@/lib/format";

/** Slack under 20 minutes is where cascades start — call it out in place. */
function SlackCell({ minutes }: { minutes: number }) {
  const tight = minutes <= 20;
  return (
    <span
      className={`tnum inline-flex items-baseline gap-1 text-sm ${
        tight ? "font-semibold text-risk-critical" : "text-ink-700"
      }`}
    >
      {minutes}
      <span className="text-xs font-normal text-ink-400">min</span>
    </span>
  );
}

export function FlightRow({ flight, rank }: { flight: Flight; rank?: number }) {
  const router = useRouter();
  const href = `/cascade/${encodeURIComponent(flight.id)}`;

  return (
    <tr
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open cascade explorer for ${flight.flightNumber}`}
      className="group cursor-pointer border-t border-ink-200 transition-colors duration-100 hover:bg-accent-50/50 focus:bg-accent-50/50"
    >
      <td className="py-3 pl-5 pr-3 lg:pl-6">
        <div className="flex items-center gap-3">
          {rank != null ? (
            <span className="tnum w-5 text-right text-xs font-medium text-ink-400">
              {rank}
            </span>
          ) : null}
          <RiskScore score={flight.riskScore} />
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="tnum text-sm font-semibold text-ink-900">
          {flight.flightNumber}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm text-ink-600" title={flight.carrierName}>
          {flight.carrier}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="tnum text-sm font-medium text-ink-800">
          {flight.origin}
          <span className="px-1.5 text-ink-300">&rarr;</span>
          {flight.destination}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="tnum text-sm text-ink-700">
          {formatClock(flight.scheduledDeparture)}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="tnum text-sm text-ink-600">{flight.tail}</span>
      </td>
      <td className="px-3 py-3">
        <span className="tnum whitespace-nowrap text-sm text-ink-600">
          leg {flight.legIndex} of {flight.legCount}
        </span>
      </td>
      <td className="px-3 py-3">
        <SlackCell minutes={flight.turnaroundSlackMin} />
      </td>
      <td className="px-3 py-3">
        <span className="tnum text-sm font-medium text-ink-800">
          {formatPercent(flight.delayProbability, 0)}
        </span>
      </td>
      <td className="py-3 pl-3 pr-5 lg:pr-6">
        <ChevronRight
          className="h-4 w-4 text-ink-300 transition-colors duration-100 group-hover:text-accent-600"
          aria-hidden
        />
      </td>
    </tr>
  );
}
