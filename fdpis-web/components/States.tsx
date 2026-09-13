"use client";

import { AlertTriangle, Inbox, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { API_BASE_URL, ApiError } from "@/lib/api";

/** Skeleton block for a region whose shape is known. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-100 ${className}`} />;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-ink-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-6 py-14 text-center">
      <Inbox className="h-5 w-5 text-ink-400" aria-hidden />
      <p className="text-sm font-semibold text-ink-700">{title}</p>
      {detail ? <p className="max-w-md text-sm text-ink-500">{detail}</p> : null}
    </div>
  );
}

/**
 * Error surface. An unreachable backend gets its own treatment because it is
 * the failure a developer hits constantly, and a generic message wastes time.
 */
export function ErrorState({
  error,
  onRetry,
  context,
}: {
  error: unknown;
  onRetry?: () => void;
  context?: string;
}) {
  const api = error instanceof ApiError ? error : null;

  if (api?.isUnreachable) return <ApiUnreachable onRetry={onRetry} />;

  const message =
    api?.message ?? (error instanceof Error ? error.message : "Something went wrong.");

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-[#f0c2c2] bg-[#fbeaea] px-5 py-4">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-[18px] w-[18px] text-risk-critical" aria-hidden />
        <p className="text-sm font-semibold text-[#a52020]">
          {context ?? "Could not load this view"}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-[#a52020]/90">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary h-9">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function ApiUnreachable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-[#f2ddab] bg-[#fdf4e0] px-5 py-4">
      <div className="flex items-center gap-2.5">
        <PlugZap className="h-[18px] w-[18px] text-[#8a5d00]" aria-hidden />
        <p className="text-sm font-semibold text-[#8a5d00]">
          The FDPIS API is not reachable
        </p>
      </div>
      <p className="text-sm leading-relaxed text-[#8a5d00]/90">
        Nothing is listening at <code className="font-mono">{API_BASE_URL}</code>.
        Start the backend from the project root:
      </p>
      <pre className="w-full overflow-x-auto rounded-md bg-ink-900 px-3 py-2 text-xs text-white">
uvicorn api.main:app --reload
      </pre>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary h-9">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  );
}
