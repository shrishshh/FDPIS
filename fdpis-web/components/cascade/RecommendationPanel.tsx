import {
  AlertTriangle,
  Clock,
  ListChecks,
  Plane,
  Truck,
  Users,
  Radio,
  type LucideIcon,
} from "lucide-react";
import type { Recommendation, RecommendationCategory } from "@/lib/types";
import { formatClock } from "@/lib/format";

const CATEGORY: Record<
  RecommendationCategory,
  { icon: LucideIcon; label: string }
> = {
  crew: { icon: Users, label: "Crew" },
  catering: { icon: Truck, label: "Ground handling" },
  aircraft: { icon: Plane, label: "Fleet" },
  slot: { icon: Radio, label: "Slot" },
  passenger: { icon: Users, label: "Passenger" },
};

const PRIORITY_CHIP: Record<Recommendation["priority"], string> = {
  high: "bg-[#fbeaea] text-[#a52020] ring-1 ring-inset ring-[#f0c2c2]",
  medium: "bg-[#fdf4e0] text-[#8a5d00] ring-1 ring-inset ring-[#f2ddab]",
  low: "bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200",
};

export function RecommendationPanel({
  recommendations,
  className = "",
}: {
  recommendations: Recommendation[];
  className?: string;
}) {
  return (
    <aside className={`card overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-ink-200 px-5 py-4">
        <ListChecks className="h-[18px] w-[18px] text-accent-700" aria-hidden />
        <h2 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
          Triggered actions
        </h2>
        <span className="tnum ml-auto rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
          {recommendations.length}
        </span>
      </div>

      {/*
        Always visible, never behind a hover: this panel is a client-side
        threshold demo, not a verified Layer 5 rule engine, and the thresholds
        themselves are unverified against the actual regulatory source. See
        lib/api/recommendations.ts for the full disclosure.
      */}
      <div className="flex items-start gap-2 border-b border-ink-200 bg-[#fdf4e0] px-5 py-2.5">
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8a5d00]"
          aria-hidden
        />
        <p className="text-[0.6875rem] leading-relaxed text-[#8a5d00]">
          Indicative actions derived from published operational thresholds.
          Layer 5 rule engine is not yet implemented; thresholds pending
          regulatory verification against DGCA FDTL requirements.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <p className="px-5 py-8 text-sm leading-relaxed text-ink-500">
          No thresholds crossed. The rotation absorbs this delay without operational
          intervention.
        </p>
      ) : (
        <ul className="divide-y divide-ink-200">
          {recommendations.map((rec) => {
            const meta = CATEGORY[rec.category];
            return (
              <li key={rec.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                    <meta.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="eyebrow">{meta.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] ${PRIORITY_CHIP[rec.priority]}`}
                      >
                        {rec.priority}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold leading-snug text-ink-900">
                      {rec.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">
                      {rec.reason}
                    </p>

                    <p className="tnum mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-xs font-semibold text-ink-700">
                      <Clock className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                      Act by {formatClock(rec.deadline)}
                      <span className="font-normal text-ink-400">
                        &middot; {rec.flightNumber} at {rec.station}
                      </span>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-ink-200 bg-ink-50/60 px-5 py-3 text-xs leading-relaxed text-ink-500">
        Actions are raised only from hops the model can quantify. Nothing is triggered
        past the depth-2 confidence boundary.
      </p>
    </aside>
  );
}
