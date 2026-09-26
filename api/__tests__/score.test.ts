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
});
