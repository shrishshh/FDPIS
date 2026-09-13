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
