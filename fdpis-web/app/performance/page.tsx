"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Sigma } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AblationCharts } from "@/components/performance/AblationCharts";
import { RankingChart } from "@/components/performance/RankingChart";
import { DepthCharts } from "@/components/performance/DepthCharts";
import { getModelPerformance } from "@/lib/api";
import type { ModelPerformance } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/States";
import { formatCount, formatDecimal, formatPercent } from "@/lib/format";

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 border-t border-ink-200 py-10 first:border-t-0 lg:py-12"
    >
      <div className="mb-6 max-w-3xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="text-xl font-bold tracking-tight text-ink-900 lg:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function PerformancePage() {
  const [perf, setPerf] = useState<ModelPerformance | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getModelPerformance()
      .then((p) => { if (live) setPerf(p); })
      .catch((e) => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [nonce]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-10 lg:px-8">
        <LoadingState label="Loading model metrics" />
      </div>
    );
  }
  if (error || !perf) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-10 lg:px-8">
        <ErrorState error={error} onRetry={retry} context="Could not load model performance" />
      </div>
    );
  }

  const validation = perf.cascadeValidation;

  return (
    <>
      <PageHeader
        eyebrow="Academic review"
        title="Model performance"
        description="Every figure below is measured on held-out data. Where the model is weak, that is stated rather than smoothed over."
      />

      <div className="mx-auto max-w-[1600px] px-5 lg:px-8">
        {/* Feature ablation */}
        <Section
          id="ablation"
          eyebrow="Feature ablation"
          title="What each feature group is actually worth"
          description="Groups are cumulative: each row adds features to the one above it, retrained end to end."
        >
          <AblationCharts rows={perf.ablation} />

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="card overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="table-head">
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Group</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Features added</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Count</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">AUC</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Precision@1%</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.ablation.map((row) => {
                    const best = row.group === "F";
                    return (
                      <tr
                        key={row.group}
                        className={`border-t border-ink-200 ${best ? "bg-accent-50/60" : ""}`}
                      >
                        <td className="px-5 py-3 font-semibold text-ink-900">{row.group}</td>
                        <td className={`px-5 py-3 ${best ? "font-semibold text-ink-900" : "text-ink-700"}`}>
                          {row.group}
                        </td>
                        <td className="tnum px-5 py-3 text-right text-ink-700">{row.featureCount}</td>
                        <td className={`tnum px-5 py-3 text-right ${best ? "font-bold text-accent-700" : "text-ink-800"}`}>
                          {formatDecimal(row.auc, 4)}
                        </td>
                        <td className={`tnum px-5 py-3 text-right ${best ? "font-bold text-accent-700" : "text-ink-800"}`}>
                          {formatPercent(row.precisionAt1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <aside className="card card-pad border-accent-200 bg-accent-50/50">
              <div className="flex items-center gap-2.5">
                <Sigma className="h-4 w-4 text-accent-700" aria-hidden />
                <p className="eyebrow">The finding</p>
              </div>
              <p className="tnum mt-3 text-metric-lg font-semibold tracking-tight text-accent-700">
                +0.0367
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-800">
                AUC from rotation features alone
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                {perf.ablationNote}
              </p>
            </aside>
          </div>
        </Section>

        {/* Model comparison */}
        <Section
          id="models"
          eyebrow="Model comparison"
          title="Seven candidates, one selected"
          description="Ranked by AUC. The ensemble blend wins narrowly on AUC and clearly on precision at review depth, which is the metric operations actually feels."
        >
          <div className="card overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="px-5 py-3 text-left font-semibold">Model</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">AUC</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">F1</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Precision@1%</th>
                </tr>
              </thead>
              <tbody>
                {perf.models.map((row) => (
                  <tr
                    key={row.model}
                    className={`border-t border-ink-200 ${
                      row.isBest ? "bg-accent-50/60" : row.isBaseline ? "bg-ink-50" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span
                        className={
                          row.isBest
                            ? "font-bold text-ink-900"
                            : row.isBaseline
                              ? "text-ink-500"
                              : "text-ink-800"
                        }
                      >
                        {row.model}
                      </span>
                      {row.isBest ? (
                        <span className="ml-2 rounded-full bg-accent-600 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-white">
                          Selected
                        </span>
                      ) : null}
                      {row.isBaseline ? (
                        <span className="ml-2 rounded-full bg-ink-200 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-ink-600">
                          Baseline
                        </span>
                      ) : null}
                    </td>
                    <td className={`tnum px-5 py-3 text-right ${row.isBest ? "font-bold text-accent-700" : "text-ink-800"}`}>
                      {formatDecimal(row.auc, 4)}
                    </td>
                    <td className="tnum px-5 py-3 text-right text-ink-800">
                      {formatDecimal(row.f1, 3)}
                    </td>
                    <td className={`tnum px-5 py-3 text-right ${row.isBest ? "font-bold text-accent-700" : "text-ink-800"}`}>
                      {formatPercent(row.precisionAt1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Ranking performance */}
        <Section
          id="ranking"
          eyebrow="Ranking performance"
          title="Precision and lift at each review depth"
          description="The system is a ranker, not an oracle. What matters is how many genuinely delayed flights sit at the top of the list an operations team has time to read."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
            <RankingChart rows={perf.ranking} baseRate={perf.classifier.baseDelayRate} />

            <div className="card overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="table-head">
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Depth</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Flights</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Precision</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Lift</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.ranking.map((row) => (
                    <tr
                      key={`Top ${row.depthPct}%`}
                      className={`border-t border-ink-200 ${
                        row.depthPct === 1 ? "bg-accent-50/60" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-semibold text-ink-900">
                        {`Top ${row.depthPct}%`}
                      </td>
                      <td className="tnum px-5 py-3 text-right text-ink-700">
                        {formatCount(row.flightsReviewed)}
                      </td>
                      <td className="tnum px-5 py-3 text-right font-medium text-ink-900">
                        {formatPercent(row.precision)}
                      </td>
                      <td className="tnum px-5 py-3 text-right font-semibold text-accent-700">
                        {row.lift.toFixed(2)}x
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-ink-200 bg-ink-50">
                    <td className="px-5 py-3 text-ink-500">Base delay rate</td>
                    <td className="px-5 py-3" />
                    <td className="tnum px-5 py-3 text-right text-ink-600">
                      {formatPercent(perf.classifier.baseDelayRate)}
                    </td>
                    <td className="tnum px-5 py-3 text-right text-ink-500">1.00x</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Propagation accuracy */}
        <Section
          id="propagation"
          eyebrow="Propagation accuracy"
          title="How far downstream the model can honestly see"
          description="Accuracy is measured per hop away from the disrupted flight. The depth-2 boundary is where FDPIS stops publishing numbers."
        >
          <DepthCharts rows={perf.propagationByDepth} confidenceDepth={perf.confidenceDepth} />

          <div className="card mt-5 overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="px-5 py-3 text-left font-semibold">Depth</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">MAE (min)</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Correlation</th>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">Reported as</th>
                </tr>
              </thead>
              <tbody>
                {perf.propagationByDepth.map((row) => {
                  const quantitative = row.depth <= perf.confidenceDepth;
                  return (
                    <tr
                      key={row.depth}
                      className={`border-t border-ink-200 ${quantitative ? "" : "bg-ink-50/70"}`}
                    >
                      <td className="tnum px-5 py-3 font-semibold text-ink-900">
                        Depth {row.depth}
                      </td>
                      <td className="tnum px-5 py-3 text-right text-ink-800">
                        {row.maeMinutes.toFixed(2)}
                      </td>
                      <td
                        className={`tnum px-5 py-3 text-right font-medium ${
                          quantitative ? "text-ink-900" : "text-ink-500"
                        }`}
                      >
                        {row.correlation.toFixed(3)}
                      </td>
                      <td className="px-5 py-3">
                        {quantitative ? (
                          <span className="text-accent-700">
                            Minutes, with a prediction interval
                          </span>
                        ) : (
                          <span className="text-ink-500">
                            &ldquo;Cascade likely continues&rdquo;, no figure
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Cascade detection validation */}
        {/* Layer 4 gate */}
        <Section
          id="gate"
          eyebrow="Propagation engine"
          title="How well the gate decides whether a delay travels"
          description="Stage 1 of the hurdle model: does anything propagate at all. The threshold is selected on validation, never on test."
        >
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card card-pad">
              <p className="eyebrow">Gate AUC</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-accent-700">
                {formatDecimal(perf.propagation.gateAuc, 4)}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Discrimination between legs that propagate delay and those that absorb it.
              </p>
            </div>
            <div className="card card-pad">
              <p className="eyebrow">Gate precision / recall</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {formatDecimal(perf.propagation.gatePrecision, 3)}
                <span className="mx-1 text-lg text-ink-300">/</span>
                {formatDecimal(perf.propagation.gateRecall, 3)}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                At threshold {perf.propagation.gateThreshold}, selected on{" "}
                {perf.propagation.thresholdSelectedOn}.
              </p>
            </div>
            <div className="card card-pad">
              <p className="eyebrow">MAE, all / cascades</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {perf.propagation.maeAllCandidates}
                <span className="mx-1 text-lg text-ink-300">/</span>
                {perf.propagation.maeActualCascades}
              </p>
              <p className="mt-2 text-sm text-ink-500">Minutes of single-hop error.</p>
            </div>
            <div className="card card-pad">
              <p className="eyebrow">Interval coverage</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {formatPercent(perf.propagation.intervalCoverage)}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Against a nominal 80% band &mdash; a documented miss, not a rounding.
              </p>
            </div>
          </div>
        </Section>

        {/* Per-carrier */}
        <Section
          id="per-carrier"
          eyebrow="Deployment reality"
          title="Precision per carrier, not pooled"
          description="A single airline sees only its own flights. Pooling across carriers flatters the headline; this is what one operator would actually get."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div className="card overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[460px] border-collapse text-sm">
                <thead>
                  <tr className="table-head">
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Carrier</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Test flights</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Precision@1%</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Base rate</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Lift</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.perCarrier.rows.map((row) => (
                    <tr key={row.carrier} className="border-t border-ink-200">
                      <td className="px-5 py-3 font-semibold text-ink-900">{row.carrier}</td>
                      <td className="tnum px-5 py-3 text-right text-ink-700">{formatCount(row.testFlights)}</td>
                      <td className="tnum px-5 py-3 text-right font-medium text-ink-900">{formatPercent(row.precision)}</td>
                      <td className="tnum px-5 py-3 text-right text-ink-600">{formatPercent(row.baseRate)}</td>
                      <td className="tnum px-5 py-3 text-right font-semibold text-accent-700">{row.lift.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className="card card-pad border-accent-200 bg-accent-50/50">
              <p className="eyebrow">Weighted by volume</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-accent-700">
                {formatPercent(perf.perCarrier.weightedPrecisionAt1)}
              </p>
              <dl className="tnum mt-4 space-y-1.5 border-t border-accent-200 pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Global (pooled)</dt>
                  <dd className="font-semibold text-ink-900">{formatPercent(perf.perCarrier.globalPrecisionAt1)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Mean per-carrier</dt>
                  <dd className="font-semibold text-ink-900">{formatPercent(perf.perCarrier.meanPrecisionAt1)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{perf.perCarrier.note}</p>
            </aside>
          </div>
        </Section>

        <Section
          id="validation"
          eyebrow="External validation"
          title="Cascade detection against DOT delay-cause attribution"
          description="Detected cascades were checked against the delay causes carriers report to the US Department of Transportation."
        >
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card card-pad">
              <p className="eyebrow">Precision</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {formatDecimal(validation.precision, 3)}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                When FDPIS calls a cascade, DOT attribution agrees 89% of the time.
              </p>
            </div>
            <div className="card card-pad">
              <p className="eyebrow">Recall</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {formatDecimal(validation.recall, 3)}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                A third of real cascades are still missed &mdash; mostly ones with no
                rotational signal.
              </p>
            </div>
            <div className="card card-pad">
              <p className="eyebrow">F1</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {formatDecimal(validation.f1, 3)}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Balanced score across precision and recall.
              </p>
            </div>
            <div className="card card-pad">
              <p className="eyebrow">Records validated</p>
              <p className="tnum mt-2 text-metric-lg font-semibold text-ink-900">
                {formatCount(validation.records)}
              </p>
              <p className="mt-2 text-sm text-ink-500">Against {validation.source}.</p>
            </div>
          </div>
        </Section>

        {/* Layer 5 crew-alert backtest */}
        {perf.layer5 ? (
          <Section
            id="layer5"
            eyebrow="Layer 5 · backtest"
            title="Were the crew alerts right, and early enough?"
            description={`Every crew alert on the test split (${perf.layer5.testDates}) scored against what BTS recorded actually happened, under the same one-crew-per-aircraft proxy. ${perf.layer5.note}`}
          >
            <div className="card max-w-6xl overflow-x-auto">
              <table className="tnum w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-ink-200 bg-ink-50 text-[0.6875rem] uppercase tracking-[0.06em] text-ink-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Rule</th>
                    <th className="px-3 py-2.5 font-semibold" title="Share of LIKELY alerts where the limit was actually crossed">LIKELY precision</th>
                    <th className="px-3 py-2.5 font-semibold" title="Share of actual breaches that got any alert">Recall</th>
                    <th className="px-3 py-2.5 font-semibold" title="Share of actual breaches that got any alert (LIKELY or WATCH) while there was still time to act">Actionable recall</th>
                    <th className="px-3 py-2.5 font-semibold" title="Precision of the engine's alerts vs the naive rule (scheduled FDP + seed delay > limit) tuned to the same recall">vs naive rule</th>
                    <th className="px-3 py-2.5 font-semibold">Median usable lead</th>
                    <th className="px-3 py-2.5 font-semibold">Deadline already passed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {perf.layer5.rows
                    .filter((r) => r.isDefault)
                    .filter((r) => r.ruleId === "crew_fdp_limit" || r.ruleId === "crew_min_rest")
                    .sort((a, b) => a.profile.localeCompare(b.profile) || a.ruleId.localeCompare(b.ruleId))
                    .map((r) => {
                      const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);
                      return (
                        <tr key={`${r.profile}-${r.ruleId}`}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-ink-900">{r.rule}</p>
                            <p className="text-xs text-ink-500">
                              {r.profile === "faa_part117" ? "FAA Part 117" : "DGCA FDTL"} ·{" "}
                              {formatCount(r.actualBreaches)} actual breaches
                            </p>
                          </td>
                          <td className="px-3 py-3 font-semibold text-ink-900">{pct(r.precisionLikely)}</td>
                          <td className="px-3 py-3 text-ink-800">{pct(r.recallAnyAlert)}</td>
                          <td className="px-3 py-3 font-semibold text-[#a52020]">{pct(r.recallActionable)}</td>
                          <td className="px-3 py-3 text-xs text-ink-700">
                            {pct(r.engineLpPrecision)} vs {pct(r.naivePrecisionAtEngineRecall)}
                            <span className="block text-ink-400">at {pct(r.engineLpRecall)} recall</span>
                          </td>
                          <td className="px-3 py-3 text-ink-800">
                            {r.medianLeadMin === null ? "—" : `${Math.round(r.medianLeadMin)} min`}
                          </td>
                          <td className="px-3 py-3 text-ink-800">{pct(r.shareDeadlinePassed)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {(() => {
              const l5 = perf.layer5!;
              const fdp = (seed: "arrival" | "departure", prof: string) =>
                l5.rows.find((r) => r.seedOn === seed && r.profile === prof && r.ruleId === "crew_fdp_limit");
              const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);
              return (
                <div className="mt-4 max-w-4xl space-y-3 text-sm leading-relaxed text-ink-600">
                  <p>
                    <strong className="text-ink-900">
                      Chains are seeded at the first {l5.defaultSeedOn} delay of 15+ min.
                    </strong>{" "}
                    Seeding on the recorded <em>arrival</em> delay came too late: the leg that breaks
                    the duty limit is usually the next one. Seeding on the <em>departure</em> delay of
                    the same disruption, known one flight-time earlier, raised actionable FDP recall
                    from {pct(fdp("arrival", "faa_part117")?.recallActionable)} to{" "}
                    {pct(fdp("departure", "faa_part117")?.recallActionable)} (FAA) and from{" "}
                    {pct(fdp("arrival", "dgca_fdtl")?.recallActionable)} to{" "}
                    {pct(fdp("departure", "dgca_fdtl")?.recallActionable)} (DGCA), and cut late
                    alerts from {pct(fdp("arrival", "faa_part117")?.shareDeadlinePassed)} to{" "}
                    {pct(fdp("departure", "faa_part117")?.shareDeadlinePassed)}, with LIKELY
                    precision unchanged.
                  </p>
                  <p>
                    Still, most real duty breaches get no usable warning, and minimum-rest alerts rest
                    on the least checkable assumption &mdash; that the same crew flies the same aircraft
                    tomorrow. Source:{" "}
                    <span className="font-mono text-xs">{l5.source}</span>.
                  </p>
                  {l5.recallSets.length ? (
                    <div>
                      <p className="mb-2 font-semibold text-ink-900">
                        Flight-duty breaches warned in time (test split)
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["faa_part117", "dgca_fdtl"] as const).map((prof) => {
                          const get = (k: string) =>
                            l5.recallSets.find((x) => x.profile === prof && x.alertSet === k);
                          const a = get("a_likely_only");
                          const b = get("b_likely_plus_watch_upper");
                          const c = get("c_all_alerts");
                          if (!a) return null;
                          return (
                            <div key={prof} className="card card-pad">
                              <p className="eyebrow">
                                {prof === "faa_part117" ? "FAA Part 117" : "DGCA FDTL"} · LIKELY only
                              </p>
                              <p className="tnum mt-1 text-2xl font-bold text-ink-900">
                                {pct(a.actionableRecall)}{" "}
                                <span className="text-sm font-semibold text-ink-500">
                                  of {formatCount(a.actualBreaches)} breaches, at {pct(a.precision)} precision
                                </span>
                              </p>
                              <p className="tnum mt-2 text-xs text-ink-500">
                                Trade-off:{" "}
                                {b ? `+ WATCH upper bound → ${pct(b.actionableRecall)} at ${pct(b.precision)}` : ""}
                                {c ? ` · all alerts → ${pct(c.actionableRecall)} at ${pct(c.precision)}` : ""}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {l5.threeBand.length ? (
                    <div>
                      <p className="mb-2 font-semibold text-ink-900">
                        Two alert tiers: how often each actually breached
                      </p>
                      <table className="tnum w-full max-w-2xl text-left text-xs">
                        <thead className="text-ink-500">
                          <tr>
                            <th className="py-1 pr-3 font-semibold">Split</th>
                            <th className="py-1 pr-3 font-semibold">Profile</th>
                            <th className="py-1 pr-3 font-semibold">LIKELY</th>
                            <th className="py-1 pr-3 font-semibold">WATCH</th>
                            <th className="py-1 font-semibold">No alert</th>
                          </tr>
                        </thead>
                        <tbody className="text-ink-800">
                          {l5.threeBand.map((b) => (
                            <tr key={`${b.split}-${b.profile}`}>
                              <td className="py-1 pr-3">{b.split}</td>
                              <td className="py-1 pr-3">{b.profile === "faa_part117" ? "FAA" : "DGCA"}</td>
                              <td className="py-1 pr-3 font-semibold">{pct(b.likelyRate)}</td>
                              <td className="py-1 pr-3">{pct(b.watchRate)}</td>
                              <td className="py-1">{pct(b.noAlertRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-2 text-xs text-ink-500">
                        POSSIBLE and MONITOR were merged into WATCH after their breach rates proved
                        indistinguishable on test; the merge adds no threshold, and the three bands are
                        ordered on both the validation and test dates.
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </Section>
        ) : null}

        {/* Weather experiment (notebook 7) */}
        {perf.weather ? (
          <Section
            id="weather"
            eyebrow="Experiment · not promoted"
            title="Does weather improve the risk ranking?"
            description="Notebook 7 added origin and destination METAR weather to the production model in two forms. Training on the actual weather at departure is perfect hindsight, so that row is an upper bound. The honest row uses only observations available 3 hours before departure."
          >
            <div className="card max-w-4xl overflow-x-auto">
              <table className="tnum w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-ink-200 bg-ink-50 text-[0.6875rem] uppercase tracking-[0.06em] text-ink-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Model</th>
                    <th className="px-3 py-2.5 font-semibold">AUC</th>
                    <th className="px-3 py-2.5 font-semibold">Precision@1%</th>
                    <th className="px-3 py-2.5 font-semibold">Precision@5%</th>
                    <th className="px-3 py-2.5 font-semibold">Carrier-weighted p@1%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {perf.weather.rows.map((w) => {
                    const base = perf.weather!.rows.find((r) => r.variant === "baseline");
                    const d = (v: number, b: number | undefined, digits: number) =>
                      w.variant === "baseline" || b === undefined
                        ? null
                        : `${v - b >= 0 ? "+" : "−"}${Math.abs(v - b).toFixed(digits)}`;
                    return (
                      <tr key={w.variant} className={w.deployable ? undefined : "bg-ink-50/70"}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink-900">
                            {w.label}
                            {w.variant === "upper_bound" ? (
                              <span className="ml-2 rounded-full bg-ink-200 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.06em] text-ink-700">
                                upper bound — not deployable
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500">{w.note}</p>
                        </td>
                        {([
                          [w.auc, base?.auc, 4],
                          [w.precisionAt1, base?.precisionAt1, 3],
                          [w.precisionAt5, base?.precisionAt5, 3],
                          [w.carrierWeightedPrecisionAt1, base?.carrierWeightedPrecisionAt1, 3],
                        ] as [number, number | undefined, number][]).map(([v, b, digits], i) => (
                          <td key={i} className="px-3 py-3 text-ink-800">
                            {v.toFixed(digits)}
                            {d(v, b, digits) ? (
                              <span className="ml-1.5 text-xs text-ink-500">{d(v, b, digits)}</span>
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-ink-600">
              {perf.weather.verdict} The gap between the two weather rows is the value of a
              perfect forecast; archived forecast data (TAF) is the open lever. Source:{" "}
              <span className="font-mono text-xs">{perf.weather.source}</span>.
            </p>
          </Section>
        ) : null}

        {/* Limitations */}
        <Section
          id="limitations"
          eyebrow="Honesty"
          title="Known limitations"
          description="These are the things the system cannot currently do. None of them are hidden in the product."
        >
          <div className="card card-pad max-w-4xl border-ink-300">
            <ul className="space-y-4">
              {perf.limitations.map((limitation) => (
                <li key={limitation} className="flex gap-3">
                  <CircleAlert
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-400"
                    aria-hidden
                  />
                  <p className="text-[0.9375rem] leading-relaxed text-ink-700">
                    {limitation}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <div className="h-8" />
      </div>
    </>
  );
}
