"use client";

import { useEffect, useState } from "react";
import { Clock, ListChecks, Loader2, Users, UserRound } from "lucide-react";
import type { CascadeRequest, RecommendationResult, RuleAlert } from "@/lib/types";
import { getRecommendations } from "@/lib/api";
import { formatClock, formatDuration } from "@/lib/format";
import {
  ProfileSwitcher, RulesDisclosure, SeverityChip, SourceCitation, useRuleProfile,
} from "@/components/rules/RuleUi";

/**
 * Layer 5 output for one disrupted leg.
 *
 * Every alert comes from POST /api/recommendations, which runs the propagation
 * model and then the backend rule engine. Nothing here decides a threshold.
 */
export function RecommendationPanel({
  request,
  revealedHop,
  className = "",
}: {
  /** The disrupted leg and its observed delay; null until one is chosen. */
  request: CascadeRequest | null;
  /** Live console reveals hops one by one; alerts beyond it stay hidden. */
  revealedHop?: number;
  className?: string;
}) {
  const [profile, setProfile] = useRuleProfile();
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const key = request
    ? `${request.tail}|${request.date}|${request.legIndex}|${request.observedDelayMin}|${profile}`
    : "";

  useEffect(() => {
    if (!request) {
      setResult(null);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    getRecommendations(request, profile)
      .then((r) => live && setResult(r))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // `key` captures every field of `request` that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const visible = (result?.alerts ?? []).filter(
    (a) => revealedHop === undefined || (a.flight?.depth ?? 0) <= revealedHop,
  );

  return (
    <aside className={`card overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-200 px-5 py-4">
        <ListChecks className="h-[18px] w-[18px] text-accent-700" aria-hidden />
        <h2 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
          Triggered actions
        </h2>
        <span className="tnum rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
          {visible.length}
        </span>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" aria-label="Loading" /> : null}
        <div className="ml-auto">
          <ProfileSwitcher value={profile} onChange={setProfile} size="sm" />
        </div>
      </div>

      <RulesDisclosure
        profileName={result?.profileName ?? (profile === "faa_part117" ? "FAA Part 117" : "DGCA FDTL")}
        unverified={result?.unverified ?? null}
        compact
      />

      {error ? (
        <p className="px-5 py-6 text-sm text-[#a52020]">{error}</p>
      ) : !request ? (
        <p className="px-5 py-8 text-sm leading-relaxed text-ink-500">
          Choose a leg and a delay to evaluate the rules.
        </p>
      ) : result ? (
        <>
          <CrewSummary result={result} />
          {visible.length === 0 ? (
            <p className="px-5 py-6 text-sm leading-relaxed text-ink-500">
              No rule in this profile is crossed by the predicted chain.
            </p>
          ) : (
            <ul className="divide-y divide-ink-200">
              {visible.map((a) => (
                <AlertItem key={a.id} alert={a} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="px-5 py-8 text-sm text-ink-500">Evaluating rules…</p>
      )}

      <p className="border-t border-ink-200 bg-ink-50/60 px-5 py-3 text-xs leading-relaxed text-ink-500">
        LIKELY: the median prediction crosses the threshold. WATCH: only the interval
        upper bound does, or the leg is past the depth-2 confidence boundary, where the
        model has no number and never raises LIKELY.
      </p>
    </aside>
  );
}

const STATUS_LABEL: Record<RecommendationResult["crewProjection"]["status"], string> = {
  ok: "Within limits",
  at_risk: "At risk",
  proxy_not_applicable: "Proxy not applicable",
  breached_at_seed: "Already exceeded on the seed leg",
  no_rotation: "No rotation",
};

function CrewSummary({ result }: { result: RecommendationResult }) {
  const p = result.crewProjection;
  return (
    <div className="border-b border-ink-200 px-5 py-3.5">
      <div className="flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-ink-400" aria-hidden />
        <span className="eyebrow">Estimated crew duty</span>
        <span className="ml-auto text-xs font-semibold text-ink-700">{STATUS_LABEL[p.status]}</span>
      </div>
      {p.status === "proxy_not_applicable" ? null : (
        <dl className="tnum mt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-ink-400">Report</dt>
            <dd className="font-semibold text-ink-800">
              {formatClock(p.reportTimeLocal)} {p.reportStation}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400">FDP limit</dt>
            <dd className="font-semibold text-ink-800">
              {p.fdpLimitMin != null ? formatDuration(p.fdpLimitMin) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400">Projected FDP</dt>
            <dd className="font-semibold text-ink-800">
              {p.fdpProjectedMedianMin != null ? formatDuration(p.fdpProjectedMedianMin) : "no number"}
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-500">{p.statusReason}</p>
    </div>
  );
}

function AlertItem({ alert: a }: { alert: RuleAlert }) {
  const Icon = a.category === "crew" ? Users : UserRound;
  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{a.category === "crew" ? "Crew (estimated)" : "Passenger"}</span>
            <SeverityChip severity={a.severity} watchReason={a.watchReason} />
            {!a.verified ? (
              <span className="rounded-full bg-[#fbeaea] px-2 py-0.5 text-[0.625rem] font-bold uppercase text-[#a52020]">
                unverified rule
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-ink-900">{a.action}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">{a.detail}</p>
          <p className="tnum mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-xs font-semibold text-ink-700">
            <Clock className="h-3.5 w-3.5 text-ink-400" aria-hidden />
            Act by {formatClock(a.deadlineLocal)} {a.deadlineStation} local
            {a.flight ? (
              <span className="font-normal text-ink-400">
                &middot; {a.flight.flightNumber} leg {a.flight.legIndex} ({a.flight.origin}–
                {a.flight.destination})
              </span>
            ) : null}
          </p>
          {a.status === "deadline_passed" ? (
            <p className="mt-2 text-xs font-semibold text-[#a52020]">
              The action deadline had already passed when the seed delay was known
              {a.usableLeadMin !== null ? ` (${formatDuration(-a.usableLeadMin)} too late)` : ""}.
              Nothing can be done in time.
            </p>
          ) : null}
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-400">
            <SourceCitation source={a.source} />
          </p>
        </div>
      </div>
    </li>
  );
}
