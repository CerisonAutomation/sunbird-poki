// Direct unit tests for POST /api/score (api/score.ts), matching the
// contract documented in LEADERBOARD_API.md: plausibility gates, optional
// HMAC signing (v1.1), rate limiting, production fail-closed behaviour, and
// "keep the best row per pilot" semantics.
//
// `writes` (score.ts), `mem` (api/_lib/store.ts) and the module-level env
// reads (`SALT`, `kvConfigured`) are all module state captured at import
// time, so every test imports a FRESH module graph via `vi.resetModules()`
// (same pattern as `src/rejection-guard.test.ts`) rather than sharing one
// import across tests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ScoreHandler = (request: Request) => Promise<Response>;

async function loadScore(): Promise<ScoreHandler> {
  vi.resetModules();
  const mod = await import("../score");
  return mod.default;
}

function postScore(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/score", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function validRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    deviceId: "device-1",
    name: "Kestrel",
    skin: "bluejay",
    distance: 1000,
    altitude: 100,
    perfects: 5,
    coins: 50,
    score: 5000,
    date: "2026-02-14",
    ...overrides,
  };
}

async function computeSig(salt: string, deviceId: string, distance: number, score: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${deviceId}|${distance}|${score}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ENV_KEYS = ["LEADERBOARD_SALT", "VERCEL_ENV", "KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.unstubAllGlobals();
});

describe("POST /api/score", () => {
  it("answers OPTIONS with 204 and permissive CORS headers", async () => {
    const handler = await loadScore();
    const res = await handler(new Request("http://localhost/api/score", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects non-POST methods with 405", async () => {
    const handler = await loadScore();
    const res = await handler(new Request("http://localhost/api/score", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("rejects an oversized declared content-length before reading the body", async () => {
    const handler = await loadScore();
    const res = await handler(postScore(validRow(), { "content-length": "20000" }));
    expect(res.status).toBe(413);
  });

  it("rejects an oversized actual body even without a content-length header", async () => {
    const handler = await loadScore();
    const res = await handler(postScore(validRow({ junk: "x".repeat(20_000) })));
    expect(res.status).toBe(413);
  });

  it("rejects malformed JSON with 400", async () => {
    const handler = await loadScore();
    const res = await handler(
      new Request("http://localhost/api/score", { method: "POST", body: "{not json" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bad json/i);
  });

  it("rejects a missing deviceId with 400", async () => {
    const handler = await loadScore();
    const res = await handler(postScore(validRow({ deviceId: "" })));
    expect(res.status).toBe(400);
  });

  it("accepts a plausible submission and reports ok", async () => {
    const handler = await loadScore();
    const res = await handler(postScore(validRow()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects an implausible distance (> 60,000 m) with 422", async () => {
    const handler = await loadScore();
    const res = await handler(postScore(validRow({ distance: 61_000, score: 100 })));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/implausible distance/i);
  });

  it("rejects an implausible score (> distance * 40 + 50,000) with 422", async () => {
    const handler = await loadScore();
    // distance 1000 allows up to 1000*40+50000 = 90,000.
    const res = await handler(postScore(validRow({ distance: 1000, score: 90_001 })));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/implausible score/i);
  });

  it("keeps the best row per pilot by distance, not the most recent submission", async () => {
    const handler = await loadScore();
    const store = await import("../_lib/store");

    await handler(postScore(validRow({ deviceId: "pilot-best", distance: 1000, score: 100 })));
    // A worse run must not overwrite the personal best.
    await handler(postScore(validRow({ deviceId: "pilot-best", distance: 500, score: 100 })));
    expect((await store.getRow("pilot-best"))?.distance).toBe(1000);

    // A better run must replace it.
    await handler(postScore(validRow({ deviceId: "pilot-best", distance: 2000, score: 100 })));
    expect((await store.getRow("pilot-best"))?.distance).toBe(2000);
  });

  it("rate-limits writes per IP+deviceId key: 30 allowed, the 31st is rejected", async () => {
    const handler = await loadScore();
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await handler(postScore(validRow({ deviceId: "rate-limited-pilot" })));
    }
    expect(last!.status).toBe(429);
    const body = await last!.json();
    expect(body.error).toMatch(/rate limit/i);
  });

  it("rate-limits independently per deviceId — a different pilot from the same IP is unaffected", async () => {
    const handler = await loadScore();
    for (let i = 0; i < 30; i++) {
      await handler(postScore(validRow({ deviceId: "hog" })));
    }
    const res = await handler(postScore(validRow({ deviceId: "someone-else" })));
    expect(res.status).toBe(200);
  });

  describe("signing (v1.1)", () => {
    it("is lenient when no salt is configured: an unsigned submission is accepted", async () => {
      const handler = await loadScore();
      const res = await handler(postScore(validRow({ sig: "not-a-real-signature" })));
      expect(res.status).toBe(200);
    });

    it("rejects a missing signature with 403 once a salt is configured", async () => {
      process.env.LEADERBOARD_SALT = "test-salt";
      const handler = await loadScore();
      const res = await handler(postScore(validRow({ deviceId: "signed-pilot" })));
      expect(res.status).toBe(403);
    });

    it("rejects an incorrect signature with 403", async () => {
      process.env.LEADERBOARD_SALT = "test-salt";
      const handler = await loadScore();
      const res = await handler(postScore(validRow({ deviceId: "signed-pilot", sig: "0".repeat(64) })));
      expect(res.status).toBe(403);
    });

    it("accepts a correctly-signed submission", async () => {
      process.env.LEADERBOARD_SALT = "test-salt";
      const handler = await loadScore();
      const row = validRow({ deviceId: "signed-pilot", distance: 1000, score: 5000 });
      const sig = await computeSig("test-salt", row.deviceId as string, row.distance as number, row.score as number);
      const res = await handler(postScore({ ...row, sig }));
      expect(res.status).toBe(200);
    });
  });

  describe("production fail-closed behaviour", () => {
    it("503s when storage is not persistent (no Upstash configured)", async () => {
      process.env.VERCEL_ENV = "production";
      const handler = await loadScore();
      const res = await handler(postScore(validRow()));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/storage unavailable/i);
    });

    it("503s when storage is up but no signing salt is configured", async () => {
      process.env.VERCEL_ENV = "production";
      process.env.KV_REST_API_URL = "https://example-upstash.test";
      process.env.KV_REST_API_TOKEN = "token";
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ result: "PONG" }), { status: 200 })),
      );
      const handler = await loadScore();
      const res = await handler(postScore(validRow()));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/signing not configured/i);
    });

    it("accepts a properly signed submission once storage and salt are both configured", async () => {
      process.env.VERCEL_ENV = "production";
      process.env.KV_REST_API_URL = "https://example-upstash.test";
      process.env.KV_REST_API_TOKEN = "token";
      process.env.LEADERBOARD_SALT = "prod-salt";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes("/ping")) return new Response(JSON.stringify({ result: "PONG" }), { status: 200 });
          if (url.includes("/get/")) return new Response(JSON.stringify({ result: null }), { status: 200 });
          if (url.includes("/incr/")) return new Response(JSON.stringify({ result: 1 }), { status: 200 });
          return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
        }),
      );
      const handler = await loadScore();
      const row = validRow({ deviceId: "prod-pilot", distance: 1000, score: 5000 });
      const sig = await computeSig("prod-salt", row.deviceId as string, row.distance as number, row.score as number);
      const res = await handler(postScore({ ...row, sig }));
      expect(res.status).toBe(200);
    });
  });

  // The in-memory limiter could only ever bound abuse per warm edge instance.
  // With Upstash configured the quota is a shared INCR counter, so these tests
  // pin the property that was previously impossible to state: the cap holds
  // across the whole fleet, because it no longer lives in one isolate's heap.
  describe("fleet-wide write quota", () => {
    function stubKv(handler: (url: string) => Response) {
      process.env.KV_REST_API_URL = "https://example-upstash.test";
      process.env.KV_REST_API_TOKEN = "token";
      const seen: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          seen.push(url);
          return handler(url);
        }),
      );
      return seen;
    }

    it("counts writes in the shared store and rejects the 31st", async () => {
      // A counter that behaves like Redis: atomic increment, shared by every
      // caller no matter which isolate they landed on.
      const counters = new Map<string, number>();
      stubKv((url) => {
        if (url.includes("/incr/")) {
          const key = decodeURIComponent(url.split("/incr/")[1].split("/")[0]);
          const next = (counters.get(key) ?? 0) + 1;
          counters.set(key, next);
          return new Response(JSON.stringify({ result: next }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      });
      const handler = await loadScore();
      let last: Response | null = null;
      for (let i = 0; i < 31; i++) {
        last = await handler(postScore(validRow({ deviceId: "fleet-pilot" })));
      }
      expect(last!.status).toBe(429);
      expect((await last!.json()).error).toMatch(/rate limit/i);
    });

    it("gives the counter a TTL on first write so the key cannot live forever", async () => {
      const seen = stubKv((url) => {
        if (url.includes("/incr/")) return new Response(JSON.stringify({ result: 1 }), { status: 200 });
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      });
      const handler = await loadScore();
      await handler(postScore(validRow({ deviceId: "ttl-pilot" })));
      const expiry = seen.find((u) => u.includes("/expire/"));
      expect(expiry, "first write must attach a lifetime to the counter").toBeTruthy();
      expect(expiry).toMatch(/\/expire\/.+\/60$/); // WINDOW_MS of 60_000 → 60s
    });

    it("does not extend the window on later writes", async () => {
      // A fixed window that re-issued its TTL on every write could be pinned
      // open indefinitely by a client that keeps posting, so `EXPIRE` is
      // attached only on the transition to 1.
      const counters = new Map<string, number>();
      const seen = stubKv((url) => {
        if (url.includes("/incr/")) {
          const key = decodeURIComponent(url.split("/incr/")[1].split("/")[0]);
          const next = (counters.get(key) ?? 0) + 1;
          counters.set(key, next);
          return new Response(JSON.stringify({ result: next }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      });
      const handler = await loadScore();
      for (let i = 0; i < 5; i++) {
        await handler(postScore(validRow({ deviceId: "ttl-pilot-2" })));
      }
      expect(seen.filter((u) => u.includes("/expire/")).length).toBe(1);
      expect(seen.filter((u) => u.includes("/incr/")).length).toBe(5);
    });

    it("falls back to the per-isolate limiter when the store is unreachable", async () => {
      stubKv(() => new Response("upstream is down", { status: 500 }));
      const handler = await loadScore();
      const res = await handler(postScore(validRow({ deviceId: "redis-down-pilot" })));
      // Redis being broken must not reject a legitimate first score: the
      // per-isolate window still answers, which is why `allowed()` falls back
      // rather than failing closed here.
      expect(res.status).toBe(200);
    });

    it("does not read a missing counter as an unused quota", async () => {
      // `{result: null}` is what a store failure looks like after `kvCommand`
      // has already filtered errors. `Number(null)` is 0 — a limiter that
      // treated that as "count zero" would admit writes uncounted forever.
      const seen = stubKv((url) => {
        if (url.includes("/incr/")) return new Response(JSON.stringify({ result: null }), { status: 200 });
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      });
      const handler = await loadScore();
      let last: Response | null = null;
      for (let i = 0; i < 31; i++) {
        last = await handler(postScore(validRow({ deviceId: "null-counter-pilot" })));
      }
      // Falls back to the local window, which still enforces 30.
      expect(last!.status).toBe(429);
      expect(seen.filter((u) => u.includes("/incr/")).length).toBe(31);
    });

    it("re-arms a counter that lost its TTL instead of throttling that pilot forever", async () => {
      // The dangerous state: INCR succeeded but EXPIRE did not, so the key has
      // no lifetime and will never again report 1. Without a re-arm that one
      // pilot is capped at 30 writes/minute for as long as the store exists.
      let stuck = 9_999;
      const seen = stubKv((url) => {
        if (url.includes("/incr/")) {
          stuck += 1;
          return new Response(JSON.stringify({ result: stuck }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      });
      const handler = await loadScore();
      const res = await handler(postScore(validRow({ deviceId: "ttl-less-pilot" })));
      expect(seen.some((u) => u.includes("/set/") && u.includes("/1/ex/")), "window must be re-armed with a fresh TTL").toBe(true);
      // Re-armed to a fresh window, so this honest pilot is not locked out.
      expect(res.status).toBe(200);
    });
  });
});
