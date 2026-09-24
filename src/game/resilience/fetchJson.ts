/**
 * Hardened JSON fetch — the ONE way client feature code talks HTTP.
 *
 * What a bare `fetch()` leaves out, and what this adds:
 *
 *   timeout          — every request is bounded (default 8 s). A hanging
 *                      socket can no longer freeze a board open forever.
 *   circuit breaker  — per-endpoint; a dying backend is short-circuited
 *                      locally (fast failure, zero battery, no request storm)
 *                      and probed back to health automatically.
 *   bounded retries  — network errors, 408/425/429 and 5xx, full-jitter
 *                      backoff, Retry-After honored. GETs only, unless the
 *                      caller declares the POST idempotent (the score endpoint
 *                      keeps the best row, so a replayed POST cannot regress).
 *   offline gate     — `navigator.onLine === false` fails fast with
 *                      OfflineError so callers can queue instead of hammering.
 *   JSON guard       — a proxy error page pretending to be 200 becomes a
 *                      typed error, not a silent `undefined` in game code.
 *
 * Errors thrown (OfflineError, BreakerOpenError, HttpError, NonRetryableError)
 * are typed so callers can branch on *why* without string matching.
 */
import { Breakers, type Breakers as BreakersT } from "./CircuitBreaker";
import { NonRetryableError, retryAfterMs, retryableStatus, retryWithBackoff } from "./backoff";

export class OfflineError extends Error {
  constructor() {
    super("offline");
    this.name = "OfflineError";
  }
}
export class BreakerOpenError extends Error {
  constructor(readonly endpoint: string) {
    super(`circuit open: ${endpoint}`);
    this.name = "BreakerOpenError";
  }
}
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}
/** 408/425/429/5xx — the endpoint spoke, and said "try again later". */
export class RetryableHttpError extends HttpError {
  constructor(status: number, url: string, readonly retryAfterHeader: string | null = null) {
    super(status, url);
    this.name = "RetryableHttpError";
  }
}
/** 200 with a body that is not JSON (proxy error page, truncation). */
export class BadResponseError extends Error {
  constructor(url: string) {
    super(`invalid json response`);
    this.name = "BadResponseError";
    (this as unknown as { url?: string }).url = url;
  }
}

/** Process-wide breaker registry — one shared fuse box for the whole game. */
export const breakers: BreakersT = new Breakers();

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface FetchJsonOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
  /** Abort the attempt after this long (default 8000 ms). */
  timeoutMs?: number;
  /** Breaker name — usually the URL origin. Omit to bypass the breaker. */
  breaker?: string;
  /** Allow retry of non-GET methods (only for idempotent endpoints). */
  idempotent?: boolean;
  /** Pass-through to fetch keepalive (send during page unload). */
  keepalive?: boolean;
  attempts?: number;
  onRetry?: (failedAttempt: number, delayMs: number, err: unknown) => void;
  /** Test seam: fetch implementation. Defaults to global fetch. */
  fetchImpl?: FetchImpl;
  /** Test seam: clock. */
  now?: () => number;
}

export interface FetchJsonResult<T> {
  data: T;
  status: number;
  /** Round-trip time of the SUCCESSFUL attempt (ms) — useful for RUM. */
  ms: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;

function isNetworkError(err: unknown): boolean {
  // Real fetch failures are TypeErrors ("Failed to fetch", "NetworkError when
  // attempting to fetch resource"); our own timeout wrapper uses "timeout".
  return err instanceof Error && (err.name === "TypeError" || /timeout|network/i.test(err.message));
}

/**
 * Fetch JSON with timeout + breaker + bounded retries. Throws the typed
 * errors above; never returns a non-JSON body masquerading as data.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<FetchJsonResult<T>> {
  const doFetch = opts.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) throw new Error("fetch unavailable");
  const now = opts.now ?? Date.now;
  const method = opts.method ?? "GET";
  const retryable = method === "GET" || opts.idempotent === true;
  const breakerName = opts.breaker;

  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new OfflineError();
  if (breakerName && !breakers.allow(breakerName, now())) throw new BreakerOpenError(breakerName);

  const started = now();
  try {
    const result = await retryWithBackoff(
      async () => {
        const ctrl = typeof AbortController === "function" ? new AbortController() : null;
        const timer =
          ctrl && typeof setTimeout === "function"
            ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
            : undefined;
        try {
          const res = await doFetch(url, {
            method,
            body: opts.body,
            headers: opts.headers,
            keepalive: opts.keepalive,
            signal: ctrl?.signal as AbortSignal | undefined,
          } as RequestInit);
          if (!res.ok) {
            const retryAfter = typeof res.headers?.get === "function" ? res.headers.get("retry-after") : null;
            if (retryableStatus(res.status)) throw new RetryableHttpError(res.status, url, retryAfter);
            // Client errors (400/401/403/404/409…) are final — retrying the
            // same bytes can only produce the same answer.
            throw new HttpError(res.status, url);
          }
          let data: unknown;
          try {
            data = await res.json();
          } catch {
            // 200 with an HTML error page / truncated body: one clean retry,
            // then a typed failure — never silently-corrupt game state.
            throw new BadResponseError(url);
          }
          return { data: data as T, status: res.status, ms: Math.max(1, now() - started) };
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      },
      {
        attempts: opts.attempts ?? (retryable ? 3 : 1),
        // A hung endpoint must fail a board open in ≈ one timeout, not three.
        baseMs: 250,
        capMs: 2_000,
        timeoutMs: 0, // per-attempt abort above already bounds each try
        onRetry: opts.onRetry,
        shouldRetry: (err) =>
          retryable && (isNetworkError(err) || err instanceof RetryableHttpError || err instanceof BadResponseError),
        retryAfterFrom: (err) => (err instanceof RetryableHttpError ? err.retryAfterHeader : null),
      },
    );
    if (breakerName) breakers.record(breakerName, "success", now());
    return result;
  } catch (err) {
    if (breakerName && shouldCountAsFailure(err)) breakers.record(breakerName, "failure", now());
    throw err;
  }
}

function shouldCountAsFailure(err: unknown): boolean {
  // Offline and breaker-open failures are OUR state, not the endpoint's —
  // they must not poison the breaker's evidence. A 5xx or a network error is.
  if (err instanceof OfflineError || err instanceof BreakerOpenError) return false;
  if (err instanceof HttpError) return true;
  if (err instanceof NonRetryableError) return retryableStatus(err.status);
  return isNetworkError(err) || err instanceof BadResponseError || err instanceof Error;
}

/** Convenience: build the breaker key from a URL (its origin). The base for
 * relative URLs is `about:blank` — non-requestable by design (portal zip
 * audits ban requestable loopback literals in shipped bundles) and still
 * correct: relative URLs only occur for same-origin dev proxies, where every
 * call legitimately shares one breaker. */
export function breakerKeyFor(url: string): string {
  try {
    return new URL(url, typeof location !== "undefined" ? location.href : "about:blank").origin;
  } catch {
    return url.slice(0, 64);
  }
}

/** Re-export so callers don't need to import retryAfterMs separately when
 * composing custom loops. */
export { retryAfterMs };
