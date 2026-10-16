/**
 * Typed fetch wrapper for the FDPIS backend.
 *
 * Every function in /lib/api goes through here, so base URL, JSON parsing and
 * error translation live in exactly one place.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Distinguishes "backend said no" from "backend isn't there". */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 404 - the thing genuinely does not exist. */
  get isNotFound() {
    return this.status === 404;
  }

  /** 422 - the request was well-formed but the data cannot support it. */
  get isUnprocessable() {
    return this.status === 422;
  }

  /** status 0 means the fetch never completed: wrong port, backend down. */
  get isUnreachable() {
    return this.status === 0;
  }
}

function describe(status: number, detail?: string): string {
  if (status === 0) {
    return `Cannot reach the FDPIS model server at ${API_BASE_URL}. Please try again in a minute.`;
  }
  if (detail) return detail;
  if (status === 404) return "Not found.";
  if (status === 422) return "The request could not be processed.";
  if (status >= 500) return "The API failed while handling this request.";
  return `Request failed with status ${status}.`;
}

/* ------------------------------------------------------------ cold start
 * The hosted backend sleeps when idle; the first request after that waits while
 * the container starts and loads the models (about a minute). Until the server
 * has answered once, a request that fails at the network level, gets a gateway
 * error (502/503/504) or takes longer than WAKE_NOTICE_MS puts the app in the
 * "waking" state, and failed requests are retried with backoff for up to
 * WAKE_BUDGET_MS. <WakeBanner> renders the state.
 */

export type ServerState = "unknown" | "waking" | "up" | "unavailable";

const WAKE_NOTICE_MS = 5_000;
const WAKE_BUDGET_MS = 180_000;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

let serverState: ServerState = "unknown";
let wakeStartedAt: number | null = null;
const listeners = new Set<() => void>();

function setServerState(s: ServerState) {
  if (s === serverState) return;
  serverState = s;
  if (s === "waking" && wakeStartedAt === null) wakeStartedAt = Date.now();
  listeners.forEach((l) => l());
}

export function getServerState(): ServerState {
  return serverState;
}

export function getWakeStartedAt(): number | null {
  return wakeStartedAt;
}

export function subscribeServerState(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One attempt. Resolves to a Response, or null when the network failed. */
async function attempt(path: string, init?: RequestInit): Promise<Response | null> {
  const notice =
    serverState === "up" ? null : setTimeout(() => setServerState("waking"), WAKE_NOTICE_MS);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    // Network-level failure: DNS, refused connection, CORS preflight blocked.
    return null;
  } finally {
    if (notice) clearTimeout(notice);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // A simulated notification is the one write; never send it twice.
  const retryable = !path.endsWith("/notify");
  const started = Date.now();
  let delay = 2_000;
  let res: Response;
  for (;;) {
    const r = await attempt(path, init);
    if (r !== null && !RETRYABLE_STATUS.has(r.status)) {
      res = r;
      break;
    }
    if (!retryable || serverState === "up" || Date.now() - started + delay > WAKE_BUDGET_MS) {
      if (serverState !== "up") setServerState("unavailable");
      throw new ApiError(describe(r ? r.status : 0), r ? r.status : 0);
    }
    setServerState("waking");
    await sleep(delay);
    delay = Math.min(delay * 1.5, 15_000);
  }
  setServerState("up");

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      // FastAPI puts the message in `detail`, which may be a string or a list
      // of validation errors.
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((e: { msg?: string }) => e?.msg)
          .filter(Boolean)
          .join("; ");
      }
    } catch {
      /* body was not JSON; fall back to the generic message */
    }
    throw new ApiError(describe(res.status, detail), res.status, detail);
  }

  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/** Build a query string, dropping null/undefined/empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
