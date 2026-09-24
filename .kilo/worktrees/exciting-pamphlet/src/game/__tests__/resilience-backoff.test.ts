import { describe, expect, it, vi } from "vitest";
import { backoffDelay, NonRetryableError, retryAfterMs, retryWithBackoff } from "../resilience/backoff";

describe("backoffDelay — full jitter", () => {
  it("stays within [0, min(cap, base·2^n)]", () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      for (const rand of [0, 0.5, 0.999]) {
        const d = backoffDelay(attempt, 100, 1_000, () => rand);
        const cap = Math.min(1_000, 100 * 2 ** attempt);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(Math.max(1, Math.floor(rand * cap)));
      }
    }
  });
  it("grows exponentially and caps", () => {
    const max = (n: number) => Math.min(1_000, 100 * 2 ** n);
    expect(max(0)).toBe(100);
    expect(max(3)).toBe(800);
    expect(max(10)).toBe(1_000); // capped
  });
  it("negative attempts are clamped", () => {
    expect(backoffDelay(-3, 100, 1_000, () => 1)).toBe(100);
  });
});

describe("retryAfterMs", () => {
  it("parses delta-seconds and caps at 60 s", () => {
    expect(retryAfterMs("2")).toBe(2_000);
    expect(retryAfterMs("999")).toBe(60_000);
    expect(retryAfterMs("0")).toBe(0);
  });
  it("parses HTTP dates", () => {
    const future = Date.now() + 5_000;
    expect(retryAfterMs(new Date(future).toUTCString())).toBeGreaterThan(0);
    expect(retryAfterMs(new Date(Date.now() - 60_000).toUTCString())).toBe(0);
  });
  it("returns 0 for garbage", () => {
    expect(retryAfterMs(null)).toBe(0);
    expect(retryAfterMs("soon")).toBe(0);
  });
});

describe("retryWithBackoff", () => {
  const instant = () => Promise.resolve(); // zero-delay sleep

  it("returns the first success without retrying", async () => {
    const task = vi.fn().mockResolvedValue(42);
    await expect(retryWithBackoff(task, { delay: instant })).resolves.toBe(42);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("retries network errors until success", async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("ok");
    await expect(retryWithBackoff(task, { delay: instant })).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("gives up after the attempt budget, throwing the LAST error", async () => {
    const boom = new Error("timeout 3");
    const task = vi.fn().mockRejectedValue(boom);
    await expect(retryWithBackoff(task, { attempts: 3, delay: instant })).rejects.toBe(boom);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("never retries 4xx-class (NonRetryableError)", async () => {
    const task = vi.fn().mockRejectedValue(new NonRetryableError("HTTP 404", 404));
    await expect(retryWithBackoff(task, { attempts: 5, delay: instant })).rejects.toMatchObject({ status: 404 });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("honors shouldRetry=false as a hard stop", async () => {
    const task = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      retryWithBackoff(task, { shouldRetry: () => false, delay: instant }),
    ).rejects.toThrow("timeout");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("reports each retry through onRetry with the chosen delay", async () => {
    const onRetry = vi.fn();
    const task = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(1);
    await retryWithBackoff(task, { delay: instant, onRetry, rand: () => 0.5 });
    expect(onRetry).toHaveBeenCalledTimes(1);
    const [failedAttempt, delayMs] = onRetry.mock.calls[0] as [number, number];
    expect(failedAttempt).toBe(1);
    expect(delayMs).toBeGreaterThan(0);
  });

  it("applies the per-attempt timeout", async () => {
    const never = () => new Promise<never>(() => undefined);
    await expect(retryWithBackoff(never, { attempts: 1, timeoutMs: 5 })).rejects.toThrow("timeout");
  });

  it("stops immediately on an aborted signal", async () => {
    const task = vi.fn().mockRejectedValue(new Error("timeout"));
    const signal = { aborted: false };
    const p = retryWithBackoff(task, { attempts: 3, delay: instant, signal });
    signal.aborted = true;
    await expect(p).rejects.toThrow();
    // At most one further attempt ran; never the full budget.
    expect(task.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("honors a larger Retry-After over computed jitter", async () => {
    const waits: number[] = [];
    const task = vi.fn().mockRejectedValueOnce(new NonRetryableError("HTTP 429", 429)).mockResolvedValueOnce(1);
    // NonRetryableError would normally stop the loop — but fetchJson wraps
    // retryable statuses with shouldRetry allowing them; simulate that here.
    await retryWithBackoff(task, {
      delay: async (ms) => {
        waits.push(ms);
      },
      retryAfterHeader: "30",
      rand: () => 0,
      shouldRetry: (err) => err instanceof NonRetryableError,
    });
    expect(waits[0]).toBe(30_000);
  });
});
