import type { Severity } from "@/lib/types";

/* Formatting helpers. Everything here is deterministic and locale-free so the
   server and client render identical markup. */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** "2026-09-09T07:45:00" -> "07:45" */
export function formatClock(iso: string): string {
  return iso.slice(11, 16);
}

/** "2026-09-09" -> "Wednesday 9 September 2026" */
export function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** 95 -> "1h 35m"; 45 -> "45 min" */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 22310 -> "22,310" */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** 0.781 -> "78.1%" */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** 0.6777 -> "0.678" */
export function formatDecimal(value: number, digits = 3): string {
  return value.toFixed(digits);
}

/* ------------------------------------------------------------------ */
/* Severity presentation                                              */
/* ------------------------------------------------------------------ */

export function riskSeverity(riskScore: number): Severity {
  if (riskScore >= 70) return "critical";
  if (riskScore >= 55) return "elevated";
  if (riskScore >= 35) return "watch";
  return "clear";
}

export interface SeverityStyle {
  label: string;
  /** Solid colour for bars and dots. */
  bar: string;
  text: string;
  chip: string;
  border: string;
  /** Raw hex, for SVG strokes. */
  hex: string;
}

export const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  clear: {
    label: "Clear",
    bar: "bg-risk-good",
    text: "text-[#0a7c0a]",
    chip: "bg-[#eaf7ea] text-[#0a7c0a] ring-1 ring-inset ring-[#bfe3bf]",
    border: "border-[#bfe3bf]",
    hex: "#0ca30c",
  },
  watch: {
    label: "Watch",
    bar: "bg-risk-warn",
    text: "text-[#8a5d00]",
    chip: "bg-[#fdf4e0] text-[#8a5d00] ring-1 ring-inset ring-[#f2ddab]",
    border: "border-[#f2ddab]",
    hex: "#fab219",
  },
  elevated: {
    label: "Elevated",
    bar: "bg-risk-serious",
    text: "text-[#a4441c]",
    chip: "bg-[#fdeee7] text-[#a4441c] ring-1 ring-inset ring-[#f6cbb7]",
    border: "border-[#f6cbb7]",
    hex: "#ec835a",
  },
  critical: {
    label: "Critical",
    bar: "bg-risk-critical",
    text: "text-[#a52020]",
    chip: "bg-[#fbeaea] text-[#a52020] ring-1 ring-inset ring-[#f0c2c2]",
    border: "border-[#f0c2c2]",
    hex: "#d03b3b",
  },
};
