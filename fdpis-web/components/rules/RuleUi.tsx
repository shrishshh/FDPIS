"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { AlertSeverity, RuleProfileId, Unverified, WatchReason } from "@/lib/types";
import { DEFAULT_PROFILE, PROFILE_OPTIONS } from "@/lib/api";

const STORAGE_KEY = "fdpis.ruleProfile";

/**
 * The active rule profile, remembered per browser. Storage can be unavailable
 * (private window, blocked site data), so every access is guarded and the
 * default always works.
 */
export function useRuleProfile(): [RuleProfileId, (p: RuleProfileId) => void] {
  const [profile, setProfileState] = useState<RuleProfileId>(DEFAULT_PROFILE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && PROFILE_OPTIONS.some((o) => o.id === saved)) {
        setProfileState(saved as RuleProfileId);
      }
    } catch {
      /* storage unavailable - keep the default */
    }
  }, []);

  const setProfile = useCallback((p: RuleProfileId) => {
    setProfileState(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* not persisted; the in-memory choice still applies */
    }
  }, []);

  return [profile, setProfile];
}

export function ProfileSwitcher({
  value,
  onChange,
  size = "md",
}: {
  value: RuleProfileId;
  onChange: (p: RuleProfileId) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Regulatory rule profile"
      className="inline-flex rounded-lg bg-ink-100 p-0.5"
    >
      {PROFILE_OPTIONS.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={`rounded-md font-semibold transition-colors duration-150 ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  LIKELY: "bg-[#fbeaea] text-[#a52020] ring-[#f0c2c2]",
  WATCH: "bg-[#fdf4e0] text-[#8a5d00] ring-[#f2ddab]",
};

const WATCH_HINT: Record<WatchReason, string> = {
  upper_bound_only:
    "WATCH: the median prediction stays under the limit; only the upper bound of the prediction interval crosses it.",
  beyond_depth_2:
    "WATCH: past the depth-2 confidence boundary there is no number to compare. Shown because the rule already triggered upstream in the chain.",
};

const WATCH_LABEL: Record<WatchReason, string> = {
  upper_bound_only: "upper bound",
  beyond_depth_2: "no number",
};

export function SeverityChip({
  severity,
  watchReason = null,
}: {
  severity: AlertSeverity;
  watchReason?: WatchReason | null;
}) {
  const hint =
    severity === "LIKELY"
      ? "LIKELY: the median prediction crosses the limit - the strongest signal the engine gives."
      : watchReason
        ? WATCH_HINT[watchReason]
        : "WATCH: worth watching, not a firm prediction.";
  return (
    <span className="inline-flex items-center gap-1.5" title={hint}>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${SEVERITY_STYLE[severity]}`}
      >
        {severity}
      </span>
      {severity === "WATCH" && watchReason ? (
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-ink-400">
          {WATCH_LABEL[watchReason]}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The disclosure that must accompany every crew alert. Wording is fixed by the
 * product requirement: it names the rule source and says crew duty is
 * estimated, never known.
 */
export function RulesDisclosure({
  profileName,
  unverified,
  compact = false,
}: {
  profileName: string;
  unverified: Unverified | null;
  compact?: boolean;
}) {
  const hasUnverifiedRules = (unverified?.rules.length ?? 0) > 0;
  return (
    <div className={`flex items-start gap-2 bg-[#fdf4e0] ${compact ? "px-5 py-2.5" : "rounded-xl px-4 py-3"}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8a5d00]" aria-hidden />
      <div className={`${compact ? "text-[0.6875rem]" : "text-xs"} leading-relaxed text-[#8a5d00]`}>
        <p>
          Rules sourced from {profileName}. Crew duty is estimated from aircraft rotation
          because airline crew rosters are not public &mdash; alerts indicate risk, not
          confirmed crew assignments.
        </p>
        {hasUnverifiedRules ? (
          <p className="mt-1 font-semibold">
            Unverified rules in this profile: {unverified!.rules.join(", ")}
          </p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Every rule in this profile was checked against its primary regulatory text.
          </p>
        )}
        {unverified && unverified.assumptions.length > 0 ? (
          <p className="mt-1">
            Assumptions with no regulatory source:{" "}
            {unverified.assumptions.map((a) => a.replace(/_/g, " ")).join(", ")}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** "117.13(a) and Table B ... https://..." -> text plus a link, if there is one. */
export function SourceCitation({ source, className = "" }: { source: string; className?: string }) {
  const m = source.match(/https?:\/\/\S+/);
  const text = m ? source.replace(m[0], "").replace(/[\s.]+$/, "") : source;
  return (
    <span className={className}>
      {text}
      {m ? (
        <>
          {" "}
          <a
            href={m[0]}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800"
          >
            primary text
          </a>
        </>
      ) : null}
    </span>
  );
}
