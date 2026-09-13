/**
 * API configuration.
 *
 * The app is connected to the FastAPI backend. Data is real model output over a
 * fixed historical dataset - not a live operational feed, and not fixtures.
 */
export { API_BASE_URL, ApiError } from "@/lib/api/client";

/** Kept false so the nav renders the live-connection indicator, not a mock badge. */
export const USING_MOCK_DATA = false;

/** Number of flights the morning briefing puts in the review queue. */
export const REVIEW_QUEUE_SIZE = 20;

/** Risk score at or above which the UI calls a flight high risk. */
export const HIGH_RISK_THRESHOLD = 60;

/** How many flights to pull for the briefing table. */
export const BRIEFING_PAGE_SIZE = 300;
