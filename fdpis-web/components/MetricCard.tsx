export function MetricCard({
  value,
  label,
  detail,
  emphasis = false,
}: {
  value: string;
  label: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`card card-pad flex flex-col gap-1 ${
        emphasis ? "border-accent-200 bg-accent-50/40" : ""
      }`}
    >
      <span className="tnum text-metric-lg font-semibold text-ink-900">{value}</span>
      <span className="text-sm font-semibold text-ink-700">{label}</span>
      {detail ? (
        <span className="mt-1 text-sm leading-relaxed text-ink-500">{detail}</span>
      ) : null}
    </div>
  );
}

export function StatTile({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: "neutral" | "accent" | "critical";
}) {
  const valueTone =
    tone === "critical"
      ? "text-risk-critical"
      : tone === "accent"
        ? "text-accent-700"
        : "text-ink-900";

  return (
    <div className="flex flex-col gap-0.5 px-5 py-4 lg:px-6">
      <span className={`tnum text-3xl font-semibold tracking-tight ${valueTone}`}>
        {value}
      </span>
      <span className="text-xs font-medium uppercase tracking-[0.09em] text-ink-500">
        {label}
      </span>
    </div>
  );
}
