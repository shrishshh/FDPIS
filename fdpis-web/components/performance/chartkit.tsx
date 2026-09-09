"use client";

import type { TooltipProps } from "recharts";

/** Chart ink. Kept in one place so every panel reads as one system. */
export const VIZ = {
  accent: "#0d9488",
  accentMuted: "#a9e8df",
  neutral: "#cdd2d6",
  grid: "#eef0f1",
  axis: "#9aa3aa",
  label: "#4c545b",
  boundary: "#d03b3b",
};

export const AXIS_PROPS = {
  stroke: VIZ.axis,
  tickLine: false,
  axisLine: { stroke: VIZ.grid },
  tick: { fill: VIZ.label, fontSize: 12 },
} as const;

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  suffix = "",
}: TooltipProps<number, string> & {
  format?: (value: number) => string;
  suffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-lift">
      <p className="text-xs font-semibold text-ink-900">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="tnum mt-0.5 text-xs text-ink-600">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: entry.color ?? VIZ.accent }}
            aria-hidden
          />
          {entry.name}:{" "}
          <span className="font-semibold text-ink-900">
            {format ? format(Number(entry.value)) : String(entry.value)}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  children,
  footnote,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footnote?: string;
}) {
  return (
    <figure className="card card-pad m-0">
      <figcaption className="mb-4">
        <h3 className="text-sm font-bold tracking-tight text-ink-900">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs leading-relaxed text-ink-500">{subtitle}</p>
        ) : null}
      </figcaption>
      {children}
      {footnote ? (
        <p className="mt-3 border-t border-ink-200 pt-3 text-xs leading-relaxed text-ink-500">
          {footnote}
        </p>
      ) : null}
    </figure>
  );
}
