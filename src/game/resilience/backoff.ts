/**
 * Retry scheduling for the client resilience kernel.
 *
 * Two layers, deliberately split so the *policy* is unit-testable without
 * clocks or networks:
 *
 *   backoffDelay()  — pure math. Exponential growth with FULL jitter
 *                     (AWS architecture-blog style): the wait is a uniform
 *                     sample of [0, min(cap, base·2^attempt)). Full jitter is
 *                     the measured best anti-thundering-herd shape when a
 *                     fleet of game clients retries a leaderboard together.
 *   retryWithBackoff() — the executor. Per-attempt timeout via
 *                     AbortController, a caller-supplied shouldRetry gate,
 *                     Retry-After honoring, and an onRetry probe so callers
 *                     can emit telemetry without this module importing any.
 *
 * No module state, no window access, no imports — every dependency is
 * injected (fetch, timers, randomness), which is what makes it testable.
 */

/** Full-jitter backoff for attempt N (0-based). Never below 1 ms when > 0. */
export function backoffDelay(attempt: number, baseMs: number, capMs: number, rand: () => number = Math.random): number {
  const a = Math.max(0, Math.floor(attempt));
  const ceiling = Math.min(capMs, baseMs * 2 ** a);
  return Math.max(1, Math.floor(rand() * ceiling));
}

/** Milliseconds to honor from a Retry-After header (number or HTTP-date). */
export function retryAfterMs(value: string | null | undefined, now: number = Date.now()): number {
  if (!value) return 0;
  const asSeconds = Number(value);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(asSeconds * 1000, 60_000);
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) return Math.max(0, Math.min(asDate - now, 60_000));
  return 0;
}

export class NonRetryableError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/** Statuses where the same request is worth re-sending after a pause. */
export function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

export interface RetryOptions {
  /** Total attempts INCLUDING the first (default 3 → 1 try + 2 retries). */
  attempts?: number;
  baseMs?: number;
  capMs?: number;
  /** Per-attempt timeout in ms. 0 disables. Applied via injected abort signal
   * when the task accepts one, else via Promise.race. */
  timeoutMs?: number;
  /** Return false to permanently abandon retrying for this error. When
   * provided, this is the ONLY retry gate — the caller owns the policy
   * (this is how fetchJson re-enables retries for 429/5xx statuses that
   * NonRetryableError would otherwise forbid). */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Observe each scheduled retry (attempt that failed, delay chosen). */
  onRetry?: (failedAttempt: number, delayMs: number, err: unknown) => void;
  /** Honor a server-provided Retry-After over computed jitter when larger. */
  retryAfterHeader?: string | null;
  /** Extract a Retry-After hint from the error itself (per-attempt). */
  retryAfterFrom?: (err: unknown) => string | null;
  rand?: () => number;
  delay?: (ms: number) => Promise<void>;
  /** Optional external cancellation — checked between attempts. */
  signal?: { aborted: boolean };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Run `task` until it succeeds, the retry budget is spent, or shouldRetry
 * rejects further attempts. The last error is always the one thrown.
 */
export async function retryWithBackoff<T>(task: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = opts.baseMs ?? 300;
  const capMs = opts.capMs ?? 8_000;
  const rand = opts.rand ?? Math.random;
  const delay = opts.delay ?? sleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (opts.signal?.aborted) throw lastError ?? new Error("aborted before first attempt");
    try {
      return await withTimeout(task(), opts.timeoutMs ?? 0);
    } catch (err) {
      lastError = err;
      if (attempt >= attempts) break;
      // Policy gate: an explicit shouldRetry overrides the built-in guard;
      // without one, NonRetryableError (4xx-class) is never retried.
      if (opts.shouldRetry ? !opts.shouldRetry(err, attempt) : err instanceof NonRetryableError) break;
      const computed = backoffDelay(attempt - 1, baseMs, capMs, rand);
      const hint =
        opts.retryAfterFrom?.(err) ?? (err as { retryAfterHeader?: string | null }).retryAfterHeader ?? null;
      const wait = Math.max(computed, retryAfterMs(hint ?? opts.retryAfterHeader));
      opts.onRetry?.(attempt, wait, err);
      await delay(wait);
    }
  }
  throw lastError;
}

/** Applies opts.timeoutMs to a promise via race; the underlying task should
 * accept an AbortSignal for real cancellation — this is the safety net for
 * tasks that don't. */
async function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  if (!timeoutMs) return p;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
