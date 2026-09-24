import { afterEach, describe, expect, it, vi } from "vitest";
import { BreakerOpenError, breakerKeyFor, breakers, fetchJson, HttpError, OfflineError } from "../resilience/fetchJson";

function jsonRes(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

afterEach(() => {
  breakers.reset();
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("returns parsed JSON + status + round-trip ms", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, { entries: [1, 2] }));
    const r = await fetchJson<{ entries: number[] }>("https://api.test/board", { fetchImpl, now: () => 100 });
    expect(r.data.entries).toEqual([1, 2]);
    expect(r.status).toBe(200);
    expect(r.ms).toBe(1);
  });

  it("sends method/body/headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, {}));
    await fetchJson("https://api.test/score", {
      fetchImpl,
      method: "POST",
      body: "{\"a\":1}",
      headers: { "content-type": "application/json" },
    });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: "{\"a\":1}" });
  });

  it("fails fast offline without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const on = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(Navigator.prototype, "onLine", { value: false, configurable: true });
    try {
      await expect(fetchJson("https://api.test/board", { fetchImpl })).rejects.toBeInstanceOf(OfflineError);
    } finally {
      if (on) Object.defineProperty(Navigator.prototype, "onLine", on);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries 5xx for GET and honors Retry-After", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(503, {}, { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    const onRetry = vi.fn();
    const r = await fetchJson<{ ok: boolean }>("https://api.test/board", { fetchImpl, onRetry });
    expect(r.data.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retries network TypeErrors", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonRes(200, {}));
    await expect(fetchJson("https://api.test/board", { fetchImpl })).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("NEVER retries 404/403/400-class responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(404, {}));
    await expect(fetchJson("https://api.test/board", { fetchImpl })).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a POST unless declared idempotent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(503, {}));
    await expect(fetchJson("https://api.test/score", { fetchImpl, method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const fetchImpl2 = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(503, {}))
      .mockResolvedValueOnce(jsonRes(200, {}));
    await fetchJson("https://api.test/score", { fetchImpl: fetchImpl2, method: "POST", body: "{}", idempotent: true });
    expect(fetchImpl2).toHaveBeenCalledTimes(2);
  });

  it("one retry for a 200-with-garbage-body, then a typed failure", async () => {
    const bad = { ok: true, status: 200, json: () => Promise.reject(new SyntaxError("Unexpected token")) } as unknown as Response;
    const fetchImpl = vi.fn().mockResolvedValue(bad);
    await expect(fetchJson("https://api.test/board", { fetchImpl })).rejects.toThrow("invalid json response");
    expect(fetchImpl).toHaveBeenCalledTimes(3); // default GET budget
  });

  it("aborts a hung request at the timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      );
      const p = fetchJson("https://api.test/board", { fetchImpl, timeoutMs: 50, attempts: 1 });
      // Attach the rejection handler before advancing timers.
      const assertion = expect(p).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(60);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("trips the breaker after repeated 5xx storms and short-circuits", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(503, {}));
    const url = "https://storm.test/board";
    // 4 breakable failures (threshold) — each call burns the whole retry
    // budget, so the breaker records one failure per fetchJson call.
    for (let i = 0; i < 4; i++) {
      await expect(fetchJson(url, { fetchImpl, breaker: "storm", attempts: 1 })).rejects.toMatchObject({ status: 503 });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    // 5th call short-circuits without touching the network.
    await expect(fetchJson(url, { fetchImpl, breaker: "storm" })).rejects.toBeInstanceOf(BreakerOpenError);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("a success heals the breaker", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(503, {}))
      .mockResolvedValueOnce(jsonRes(503, {}))
      .mockResolvedValueOnce(jsonRes(503, {}))
      .mockResolvedValueOnce(jsonRes(503, {}))
      .mockResolvedValue(jsonRes(200, { healed: true }));
    const url = "https://heal.test/board";
    for (let i = 0; i < 4; i++) await expect(fetchJson(url, { fetchImpl, breaker: "heal", attempts: 1 })).rejects.toMatchObject({ status: 503 });
    // Breaker open → force the cooldown to elapse on the probe call.
    const future = Date.now() + 16_000;
    const r = await fetchJson<{ healed: boolean }>(url, { fetchImpl, breaker: "heal", attempts: 1, now: () => future });
    expect(r.data.healed).toBe(true);
    // Fully healed: subsequent calls pass immediately.
    await expect(fetchJson(url, { fetchImpl, breaker: "heal", now: () => future + 1 })).resolves.toMatchObject({ status: 200 });
  });

  it("breakerKeyFor returns the origin", () => {
    expect(breakerKeyFor("https://api.example.com/a/b?c=1")).toBe("https://api.example.com");
  });

  it("HttpError is exported for typed callers (constructible)", () => {
    expect(new HttpError(500, "u").status).toBe(500);
  });
});
