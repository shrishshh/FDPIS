"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Inbox, Send } from "lucide-react";
import type { AlertFeed, CrewModel, CrewNotification, RuleAlert } from "@/lib/types";
import { getAlertFeed, getNotifications, notifyCrew } from "@/lib/api";
import { useScope } from "@/components/DataScope";
import { useNotifyStatus } from "@/components/NotifyStatus";
import { DeliveryBadge } from "@/components/alerts/DeliveryLabel";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import {
  ProfileSwitcher, RulesDisclosure, SeverityChip, useRuleProfile,
} from "@/components/rules/RuleUi";
import { formatClock, formatCount, formatDuration } from "@/lib/format";

const RULE_LABEL: Record<string, string> = {
  crew_fdp_limit: "FDP limit",
  crew_fdp_extension_limit: "FDP + max extension",
  crew_duty_period_limit: "Duty period limit",
  crew_min_rest: "Minimum rest",
};

/** "14 CFR 117.13(a) and Table B ..." -> "14 CFR 117.13(a)"; DGCA -> "CAR 7-J-III para 6.1". */
function shortSource(source: string): string {
  const cfr = source.match(/14 CFR \d+\.\d+(\([a-z0-9]+\))*/);
  if (cfr) return cfr[0];
  const para = source.match(/para \d+(\.\d+)*(\([a-z0-9]+\))*/);
  if (source.includes("Section 7") && para) return `CAR 7-J-III ${para[0]}`;
  if (source.includes("Section 3") && para) return `CAR 3-M-IV ${para[0]}`;
  return source.slice(0, 32);
}

function margin(a: RuleAlert): string {
  if (a.marginMin === null) return "no number";
  const upper = a.watchReason === "upper_bound_only" ? " (upper bound)" : "";
  if (a.comparator === "lt") return `${formatDuration(-a.marginMin)} short${upper}`;
  return `${formatDuration(a.marginMin)} over${upper}`;
}

type Tab = "alerts" | "outbox";

export function AlertsConsole() {
  const { date, carrier, ready } = useScope();
  const [profile, setProfile] = useRuleProfile();
  const [tab, setTab] = useState<Tab>("alerts");
  const [feed, setFeed] = useState<AlertFeed | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
  const [notified, setNotified] = useState<Map<number, CrewNotification>>(new Map());
  const [outbox, setOutbox] = useState<{ notice: string; notifications: CrewNotification[] } | null>(null);
  const [sending, setSending] = useState<Set<number>>(new Set());
  const notifyStatus = useNotifyStatus();
  const liveChannel = notifyStatus?.live === true;
  const [nonce, setNonce] = useState(0);
  const [crewModel, setCrewModel] = useState<CrewModel>("single");

  useEffect(() => {
    if (!ready || !date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getAlertFeed(date, carrier || null, profile, crewModel)
      .then((f) => live && setFeed(f))
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [ready, date, carrier, profile, crewModel, nonce]);

  const loadOutbox = useCallback(() => {
    getNotifications().then(setOutbox).catch(() => setOutbox(null));
  }, []);

  useEffect(() => {
    if (tab === "outbox") loadOutbox();
  }, [tab, loadOutbox]);

  async function notify(a: RuleAlert) {
    if (sending.has(a.id)) return;           // a double-click never sends twice
    setSending((s) => new Set(s).add(a.id));
    try {
      const n = await notifyCrew(a.id);
      setNotified((m) => new Map(m).set(a.id, n));
      loadOutbox();
    } catch (e) {
      setError(e);
    } finally {
      setSending((s) => {
        const next = new Set(s);
        next.delete(a.id);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-5 py-7 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-lg bg-ink-100 p-0.5">
          {(["alerts", "outbox"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${
                tab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {t === "alerts" ? <BellRing className="h-3.5 w-3.5" aria-hidden /> : <Inbox className="h-3.5 w-3.5" aria-hidden />}
              {t === "alerts" ? "Crew alerts" : `Outbox${notified.size ? ` (${notified.size})` : ""}`}
            </button>
          ))}
        </div>
        {notifyStatus ? (
          <span
            title={liveChannel
              ? "Notify crew sends one WhatsApp message to the single demo recipient configured on the server."
              : "Notify crew writes a SIMULATED record to the outbox. Nothing is sent."}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ring-1 ring-inset ${
              liveChannel ? "bg-[#eaf7ea] text-[#0a7c0a] ring-[#bfe3bf]" : "bg-ink-100 text-ink-600 ring-ink-200"
            }`}
          >
            {liveChannel ? "Live channel: WhatsApp" : "Simulated"}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-ink-500" htmlFor="crew-model">Crew model</label>
          <select
            id="crew-model"
            value={crewModel}
            onChange={(e) => setCrewModel(e.target.value as CrewModel)}
            className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm text-ink-800"
            title="Inferred duty blocks are EXPERIMENTAL: the split points are invented, not a roster."
          >
            <option value="single">One crew per aircraft</option>
            <option value="inferred_blocks">Inferred duty blocks (experimental)</option>
          </select>
          <span className="text-xs font-semibold text-ink-500">Rules</span>
          <ProfileSwitcher value={profile} onChange={setProfile} />
        </div>
      </div>

      <RulesDisclosure
        profileName={feed?.profileName ?? (profile === "faa_part117" ? "FAA Part 117" : "DGCA FDTL")}
        unverified={feed?.unverified ?? null}
      />
      {crewModel === "inferred_blocks" ? (
        <div className="rounded-xl border border-ink-300 bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-700">
          <strong>Experimental crew model.</strong> Each aircraft-day is split into the fewest
          duty blocks that are legal on schedule, at ground stops of 30+ min at one of the
          carrier&apos;s ten busiest airports. These split points are invented &mdash; every row is
          an <em>inferred duty block, hypothetical, not a roster</em>, and cannot be validated
          against real crew assignments. Minimum-rest rules are not evaluated for blocks.
        </div>
      ) : null}

      {tab === "outbox" ? (
        <Outbox outbox={outbox} live={liveChannel} />
      ) : error ? (
        <ErrorState error={error} context="Could not load the crew alert feed" onRetry={() => setNonce((n) => n + 1)} />
      ) : loading || !feed ? (
        <LoadingState label="Projecting crew duty for every aircraft" />
      ) : (
        <>
          <Summary feed={feed} />
          {feed.alerts.length === 0 ? (
            <EmptyState title="No crew at risk" detail="No projected duty crosses a limit in this profile for this day." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="tnum w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-ink-200 bg-ink-50 text-[0.6875rem] uppercase tracking-[0.06em] text-ink-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold" title="Rows are sorted by absolute (UTC) deadline; each time is shown in the station’s local time">Act by · local</th>
                    <th className="px-3 py-2.5 font-semibold">Severity</th>
                    <th className="px-3 py-2.5 font-semibold">Tail</th>
                    <th className="px-3 py-2.5 font-semibold">Flight</th>
                    <th className="px-3 py-2.5 font-semibold">Rule</th>
                    <th className="px-3 py-2.5 font-semibold">Projected duty end (median)</th>
                    <th className="px-3 py-2.5 font-semibold">Limit</th>
                    <th className="px-3 py-2.5 font-semibold">Over / under</th>
                    <th className="px-3 py-2.5 font-semibold">Source</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {feed.alerts.map((a) => {
                    const acked = acknowledged.has(a.id);
                    const sent = notified.get(a.id);
                    return (
                      <tr key={a.id} className={acked ? "bg-ink-50/60" : undefined}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">
                          {formatClock(a.deadlineLocal)}{" "}
                          <span className="font-normal text-ink-500">{a.deadlineStation}</span>
                        </td>
                        <td className="px-3 py-3">
                          <SeverityChip severity={a.severity} watchReason={a.watchReason} />
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-800">
                          {a.tail}
                          {a.dutyBlock ? (
                            <span
                              className="mt-0.5 block font-sans text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-ink-500"
                              title={a.dutyBlock.label}
                            >
                              block {a.dutyBlock.index}/{a.dutyBlock.count} · inferred
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-ink-700">
                          {a.flight ? (
                            <>
                              {a.flight.flightNumber}{" "}
                              <span className="text-ink-400">
                                leg {a.flight.legIndex} · {a.flight.origin}–{a.flight.destination}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-400">next-day report</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-ink-700" title={a.detail}>
                          {RULE_LABEL[a.ruleId] ?? a.ruleId}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-ink-700">
                          {a.duty?.projectedDutyEndLocal ? (
                            <>
                              {a.duty.projectedDutyEndLocal}{" "}
                              <span className="text-ink-400">{a.duty.projectedDutyEndStation}</span>
                            </>
                          ) : (
                            <span className="text-ink-400" title="Last leg is past the depth-2 confidence boundary">
                              no number
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-ink-700">{formatDuration(a.thresholdMin)}</td>
                        <td className={`whitespace-nowrap px-3 py-3 font-semibold ${a.marginMin === null ? "text-ink-400" : "text-[#a52020]"}`}>
                          {margin(a)}
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-500" title={a.source}>
                          {shortSource(a.source)}
                          {!a.verified ? <span className="ml-1 font-bold text-[#a52020]">(unverified)</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {a.status === "deadline_passed" ? (
                            <span
                              className="inline-block max-w-[180px] whitespace-normal text-left text-[0.6875rem] leading-snug text-ink-500"
                              title="Notify crew is disabled: there was nothing left to act on."
                            >
                              Deadline had passed when this fired
                              {a.usableLeadMin !== null ? ` (${formatDuration(-a.usableLeadMin)} late)` : ""}
                            </span>
                          ) : !acked ? (
                            <button
                              type="button"
                              className="btn-secondary h-8 px-2.5 text-xs"
                              onClick={() => setAcknowledged((s) => new Set(s).add(a.id))}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              Acknowledge
                            </button>
                          ) : sent && sent.delivery?.status !== "failed" ? (
                            <span title={sent.message}>
                              <DeliveryBadge notification={sent} />
                            </span>
                          ) : (
                            <span className="inline-flex flex-col items-end gap-1">
                              {sent ? <DeliveryBadge notification={sent} /> : null}
                              <button
                                type="button"
                                className="btn-secondary h-8 px-2.5 text-xs"
                                onClick={() => notify(a)}
                                disabled={sending.has(a.id)}
                                title={liveChannel
                                  ? "Sends one WhatsApp message to the demo recipient and records it in the outbox."
                                  : "Writes a SIMULATED notification to the outbox. Nothing is sent."}
                              >
                                <Send className="h-3.5 w-3.5" aria-hidden />
                                {sending.has(a.id) ? "Sending…" : sent ? "Retry" : "Notify crew"}
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Summary({ feed }: { feed: AlertFeed }) {
  const s = feed.summary;
  const notApplicable = s.rotationsByStatus.proxy_not_applicable ?? 0;
  const atSeed = s.rotationsByStatus.breached_at_seed ?? 0;
  const tiles = [
    { label: "Aircraft operating", value: formatCount(s.aircraft) },
    { label: "Aircraft-days covered", value: `${(s.coverageShare * 100).toFixed(0)}%` },
    { label: "Crews flagged", value: formatCount(s.crewsFlagged) },
    { label: "Likely", value: formatCount(s.alertsBySeverity.LIKELY ?? 0) },
    { label: "Watch", value: formatCount(s.alertsBySeverity.WATCH ?? 0) },
  ];
  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="card card-pad">
            <p className="eyebrow">{t.label}</p>
            <p className="tnum mt-1 text-2xl font-bold text-ink-900">{t.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-500">
        Each aircraft is seeded at its {s.seedRule}, and Layer 4 projects the rest of its
        day. On {formatCount(notApplicable)} of {formatCount(s.aircraft)} aircraft the{" "}
        <em>scheduled</em> day already exceeds single-crew limits, so the operator must
        change crews mid-day and the proxy cannot see where: no alert is raised for them.
        {atSeed ? ` ${formatCount(atSeed)} more crossed a limit on the seed leg itself, which is observed history, not a prediction.` : ""}
        {s.nextDayInDataset ? "" : " The next day is not in the dataset, so minimum-rest rules cannot be evaluated."}
        {s.alertsDeadlinePassed
          ? ` ${formatCount(s.alertsDeadlinePassed)} alert(s) fired after their action deadline had already passed; they are shown but cannot be sent to a crew.`
          : ""}
      </p>
    </section>
  );
}

function Outbox({
  outbox,
  live,
}: {
  outbox: { notice: string; notifications: CrewNotification[] } | null;
  live: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-ink-300 bg-ink-50 px-4 py-3 text-xs font-semibold leading-relaxed text-ink-700">
        {live ? "OUTBOX - LIVE WHATSAPP DEMO CHANNEL." : "SIMULATED OUTBOX."}{" "}
        {outbox?.notice ??
          "No SMS, email or push service is connected. Recipients are roles, not people."}
      </div>
      {!outbox || outbox.notifications.length === 0 ? (
        <EmptyState
          title="Outbox is empty"
          detail={live
            ? "Acknowledge an alert, then choose Notify crew to send one WhatsApp message to the demo recipient."
            : "Acknowledge an alert, then choose Notify crew to write a simulated notification here."}
        />
      ) : (
        <ul className="space-y-3">
          {outbox.notifications.map((n) => (
            <li key={n.notificationId} className="card card-pad">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <DeliveryBadge notification={n} />
                <span className="font-semibold text-ink-800">{n.recipientRole}</span>
                <span className="text-ink-400">via {n.channel}</span>
                <span className="ml-auto text-ink-400">
                  alert #{n.alertId} · {n.createdUtc.replace("T", " ").replace("+00:00", " UTC")}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm leading-relaxed text-ink-800">{n.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
