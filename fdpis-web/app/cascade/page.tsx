import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RiskScore } from "@/components/Risk";
import { getRiskList } from "@/lib/api";
import { formatClock, formatPercent } from "@/lib/format";

export const metadata = {
  title: "Cascade explorer — FDPIS",
};

export default async function CascadeIndexPage() {
  const flights = await getRiskList();
  // Only legs with somewhere to propagate to are worth opening.
  const candidates = flights
    .filter((f) => f.legCount - f.legIndex >= 2)
    .slice(0, 12);

  return (
    <>
      <PageHeader
        eyebrow="Cascade explorer"
        title="Pick a flight to trace"
        description="Choose any leg and see what its delay does to the rest of that aircraft's day. These are today's highest-risk departures that still have legs to fly."
        actions={
          <Link href="/briefing" className="btn-secondary">
            Browse the full briefing
          </Link>
        }
      />

      <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {candidates.map((f) => (
            <Link
              key={f.id}
              href={`/cascade/${encodeURIComponent(f.id)}`}
              className="card card-pad group transition-colors duration-150 hover:border-accent-300 hover:bg-accent-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="tnum text-lg font-bold tracking-tight text-ink-900">
                    {f.origin}
                    <span className="px-1.5 text-ink-300">&rarr;</span>
                    {f.destination}
                  </p>
                  <p className="tnum mt-0.5 text-sm text-ink-500">
                    {f.flightNumber} &middot; {f.carrier} &middot; dep{" "}
                    {formatClock(f.scheduledDeparture)}
                  </p>
                </div>
                <ArrowRight
                  className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-accent-600"
                  aria-hidden
                />
              </div>

              <div className="mt-4 border-t border-ink-200 pt-3">
                <RiskScore score={f.riskScore} width={110} />
              </div>

              <dl className="tnum mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-ink-400">Tail</dt>
                  <dd className="font-medium text-ink-700">{f.tail}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Rotation</dt>
                  <dd className="font-medium text-ink-700">
                    leg {f.legIndex}/{f.legCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Delay prob.</dt>
                  <dd className="font-medium text-ink-700">
                    {formatPercent(f.delayProbability, 0)}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
