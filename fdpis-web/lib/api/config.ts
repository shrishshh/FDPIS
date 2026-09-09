/**
 * API configuration.
 *
 * Today every function in this directory reads from /lib/mock. When the
 * FastAPI service is connected, set NEXT_PUBLIC_API_BASE_URL and replace the
 * function bodies in this directory with fetch() calls — see README.md.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** True while the app is serving generated fixtures. Drives the nav badge. */
export const USING_MOCK_DATA = true;

/** The single operating day the demo fixtures describe. */
export const DEMO_DATE = "2026-09-09";

/** Number of flights the morning briefing puts in the review queue. */
export const REVIEW_QUEUE_SIZE = 20;

/** Risk score at or above which a flight counts as high risk. */
export const HIGH_RISK_THRESHOLD = 60;

/**
 * Small artificial latency so loading states are exercised in the demo.
 * Delete this when real network calls take its place.
 */
export function simulateLatency(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
