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
    return `Cannot reach the FDPIS API at ${API_BASE_URL}. Is the backend running?`;
  }
  if (detail) return detail;
  if (status === 404) return "Not found.";
  if (status === 422) return "The request could not be processed.";
  if (status >= 500) return "The API failed while handling this request.";
  return `Request failed with status ${status}.`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    // Network-level failure: DNS, refused connection, CORS preflight blocked.
    throw new ApiError(describe(0), 0);
  }

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
