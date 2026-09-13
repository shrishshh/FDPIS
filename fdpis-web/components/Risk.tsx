import type { Severity } from "@/lib/types";
import { SEVERITY_STYLES, riskSeverity } from "@/lib/format";

/** Score + bar. The number always carries the meaning; colour reinforces it. */
export function RiskScore({
  score, width = 72, severity,
}: { score: number; width?: number; severity?: Severity }) {
  const style = SEVERITY_STYLES[severity ?? riskSeverity(score)];
  return (
    <div className="flex items-center gap-3">
      <span className="tnum w-7 text-right text-sm font-semibold text-ink-900">
        {score}
      </span>
      <span
        className="relative h-1.5 overflow-hidden rounded-full bg-ink-200"
        style={{ width }}
        role="img"
        aria-label={`Risk score ${score} of 100, ${style.label}`}
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${style.bar}`}
          style={{ width: `${score}%` }}
        />
      </span>
    </div>
  );
}

export function SeverityChip({
  severity,
  children,
}: {
  severity: Severity;
  children?: React.ReactNode;
}) {
  const style = SEVERITY_STYLES[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${style.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.bar}`} aria-hidden />
      {children ?? style.label}
    </span>
  );
}
