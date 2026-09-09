import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  Network,
  Share2,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { HeroDiagram } from "@/components/HeroDiagram";
import { getModelPerformance } from "@/lib/api";

const LAYERS = [
  {
    n: "01",
    title: "Data Ingestion",
    icon: Database,
    body: "Schedule, actual times and tail assignments normalised into a single leg-level record.",
  },
  {
    n: "02",
    title: "Graph Construction",
    icon: Network,
    body: "Legs linked into rotations by aircraft, so every flight knows what flew it in.",
  },
  {
    n: "03",
    title: "Primary Risk",
    icon: GitBranch,
    body: "Each leg scored for delay risk. Rotation features carry most of the signal.",
  },
  {
    n: "04",
    title: "Propagation",
    icon: Share2,
    body: "Observed delay pushed downstream, absorbed by turnaround slack at each stop.",
  },
  {
    n: "05",
    title: "Recommendations",
    icon: ListChecks,
    body: "Threshold crossings become dated actions: crew, ground handling, aircraft, slots.",
  },
];

export default async function LandingPage() {
  const performance = await getModelPerformance();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-200">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_28rem_at_75%_-8%,rgba(13,148,136,0.10),transparent)]"
        />
        <div className="relative mx-auto grid max-w-[1600px] items-center gap-12 px-5 py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow mb-5">Flight Delay Propagation Intelligence System</p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-5xl lg:text-6xl">
              Predict the cascade.
              <br />
              Act before the chaos.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 lg:text-xl">
              One late aircraft is never one late flight. The same airframe flies five
              more legs that day, and every minute it cannot recover on the ground is a
              minute handed to the next departure. FDPIS scores that risk before the
              day begins, then traces the delay through the rotation network as it
              happens.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/briefing" className="btn-primary px-5 py-3 text-[0.9375rem]">
                Open the morning briefing
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/live" className="btn-secondary px-5 py-3 text-[0.9375rem]">
                Try a live delay
              </Link>
            </div>
          </div>

          <div className="hidden justify-self-end lg:block">
            <HeroDiagram />
          </div>
        </div>
      </section>

      {/* Validated metrics */}
      <section id="results" className="scroll-mt-20 border-b border-ink-200 bg-ink-50/60">
        <div className="mx-auto max-w-[1600px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="mb-8 flex flex-col gap-2">
            <p className="eyebrow">Validated results</p>
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">
              Measured on held-out US domestic operations
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {performance.headline.map((metric) => (
              <MetricCard
                key={metric.id}
                value={metric.value}
                label={metric.label}
                detail={metric.detail}
              />
            ))}
          </div>

          <p className="mt-6 text-sm text-ink-500">
            Full ablation, model comparison and propagation accuracy on the{" "}
            <Link
              href="/performance"
              className="font-semibold text-accent-700 underline underline-offset-4 hover:text-accent-800"
            >
              model performance page
            </Link>
            , including the limitations we have not solved.
          </p>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="scroll-mt-20 border-b border-ink-200">
        <div className="mx-auto max-w-[1600px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow mb-2">Architecture</p>
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">
              Five layers, from raw schedule to a dated action
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-600">
              Each layer consumes the one before it. The rotation graph is what makes
              the difference: without it the model is barely better than the schedule
              itself.
            </p>
          </div>

          <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
            {LAYERS.map((layer, i) => (
              <li key={layer.n} className="flex flex-1 items-stretch">
                <div className="card card-pad flex flex-1 flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                      <layer.icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="tnum text-xs font-semibold tracking-[0.1em] text-ink-400">
                      {layer.n}
                    </span>
                  </div>
                  <h3 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
                    {layer.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-500">{layer.body}</p>
                </div>

                {i < LAYERS.length - 1 ? (
                  <div
                    aria-hidden
                    className="hidden shrink-0 items-center px-2 text-ink-300 lg:flex"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-[1600px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="card flex flex-col items-start gap-6 border-accent-200 bg-accent-50/50 p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">
              See what one delay costs you by lunchtime
            </h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
              Enter a delay on any aircraft in the fleet and watch it move through the
              rest of that airframe&apos;s day, with the actions it triggers and the
              deadlines they carry.
            </p>
          </div>
          <Link href="/live" className="btn-primary shrink-0 px-5 py-3 text-[0.9375rem]">
            Open live delay entry
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
