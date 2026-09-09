import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { CascadeChain } from "@/components/cascade/CascadeChain";
import { RecommendationPanel } from "@/components/cascade/RecommendationPanel";
import { SeverityChip } from "@/components/Risk";
import { getCascadeForFlight } from "@/lib/api";
import { formatClock, formatDuration, riskSeverity } from "@/lib/format";

export const metadata = {
  title: "Cascade explorer — FDPIS",
};

export default async function CascadePage({
  params,
}: {
  params: { flightId: string };
}) {
  const cascade = await getCascadeForFlight(decodeURIComponent(params.flightId));
  if (!cascade) notFound();

  const f = cascade.originFlight;
  const quantified = cascade.nodes.filter((n) => n.quantitative).length;
  const beyond = cascade.nodes.length - quantified;

  return (
    <div className="pb-12">
      {/* Origin header */}
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8 lg:py-7">
          <Link
            href="/briefing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-accent-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to briefing
          </Link>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow mb-2">Cascade explorer</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="tnum text-3xl font-bold tracking-tight text-ink-900 lg:text-4xl">
                  {f.flightNumber}
                </h1>
                <span className="tnum text-2xl font-semibold text-ink-500 lg:text-3xl">
                  {f.origin}
                  <span className="px-2 text-ink-300">&rarr;</span>
                  {f.destination}
                </span>
                <SeverityChip severity={riskSeverity(f.riskScore)}>
                  Risk {f.riskScore}
                </SeverityChip>
              </div>
              <p className="tnum mt-2 text-[0.9375rem] text-ink-600">
                {f.carrierName} &middot; {f.tail} ({f.aircraftType}) &middot; scheduled{" "}
                {formatClock(f.scheduledDeparture)} &middot; leg {f.legIndex} of{" "}
                {f.legCount}
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-5 py-3">
                <p className="eyebrow">Observed delay</p>
                <p className="tnum mt-0.5 text-2xl font-semibold text-risk-critical">
                  {cascade.observedDelayMin} min
                </p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-5 py-3">
                <p className="eyebrow">Downstream delay, depth 1&ndash;2</p>
                <p className="tnum mt-0.5 text-2xl font-semibold text-ink-900">
                  {formatDuration(cascade.totalDownstreamDelayMin)}
                </p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 px-5 py-3">
                <p className="eyebrow">Legs in the chain</p>
                <p className="tnum mt-0.5 text-2xl font-semibold text-ink-900">
                  {cascade.nodes.length}
                  <span className="ml-1.5 text-sm font-medium text-ink-500">
                    ({quantified} quantified{beyond > 0 ? `, ${beyond} beyond` : ""})
                  </span>
                </p>
              </div>
              <Link
                href={`/live?tail=${encodeURIComponent(f.tail)}&leg=${f.legIndex}&delay=${cascade.observedDelayMin}`}
                className="btn-secondary self-stretch"
              >
                <Activity className="h-4 w-4" aria-hidden />
                Try another delay
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Chain + actions */}
      <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_352px]">
          <section className="min-w-0">
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-1 border-b border-ink-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <h2 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
                  Downstream rotation for {f.tail}
                </h2>
                <p className="text-sm text-ink-500">
                  Connector thickness is the delay handed to the next departure.
                </p>
              </div>
              <div className="px-5 py-6 lg:px-6">
                <CascadeChain cascade={cascade} />
              </div>
            </div>

            <div className="card card-pad mt-6">
              <h3 className="text-sm font-bold tracking-tight text-ink-900">
                How to read this
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                Each turn subtracts its available slack from the inbound delay; whatever
                survives is inherited by the next departure, on top of the fresh delay
                that leg generates on its own. Hops 1 and 2 carry a numeric prediction
                with an interval. Past that, the model reports only that the cascade
                continues &mdash; at depth 3 its correlation with observed delay is 0.327
                and still falling, which is not enough to spend money on.
              </p>
            </div>
          </section>

          <RecommendationPanel
            recommendations={cascade.recommendations}
            className="self-start xl:sticky xl:top-20"
          />
        </div>
      </div>
    </div>
  );
}
