// Direct unit tests for GET /api/board (api/board.ts): sort/scope/metric
// selection, requester rank, the 50-row page cap, the per-IP read limiter,
// and the production storage-health gate.
//
// Every test imports a fresh module graph (`vi.resetModules()` + dynamic
// `import()`, same pattern as `src/rejection-guard.test.ts` and
// `api/__tests__/score.test.ts`) so the in-memory board (`api/_lib/store.ts`)
// and the read-limiter map (module state in `board.ts`) never leak between
// tests. Rows are seeded directly through `_lib/store`'s `putRow`, which
// shares the same module instance as `board.ts` within one reset cycle —
// this exercises the board's own read/sort/filter logic without also
// depending on `score.ts`'s submission gates.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardRow } from "../_lib/store";

type BoardHandler = (request: Request) => Promise<Response>;

async function loadBoard(): Promise<{ handler: BoardHandler; putRow: (row: BoardRow) => Promise<void>; todayStr: () => string }> {
  vi.resetModules();
  const [board, store, http] = await Promise.all([
    import("../board"),
    import("../_lib/store"),
    import("../_lib/http"),
  ]);
  return { handler: board.default, putRow: store.putRow, todayStr: http.todayStr };
}

function getBoard(query = ""): Request {
  return new Request(`http://localhost/api/board${query}`, { method: "GET" });
}

function row(overrides: Partial<BoardRow> & { deviceId: string }): BoardRow {
  return {
    name: "Pilot",
    skin: "bluejay",
    distance: 0,
    altitude: 0,
    perfects: 0,
    coins: 0,
    score: 0,
    date: "2026-01-01",
    ...overrides,
  };
}

function daysAgo(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const ENV_KEYS = ["VERCEL_ENV", "KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.unstubAllGlobals();
});

describe("GET /api/board", () => {
  it("answers OPTIONS with 204 and permissive CORS headers", async () => {
    const { handler } = await loadBoard();
    const res = await handler(new Request("http://localhost/api/board", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects non-GET methods with 405", async () => {
    const { handler } = await loadBoard();
    const res = await handler(new Request("http://localhost/api/board", { method: "POST" }));
    expect(res.status).toBe(405);
  });

  it("returns an empty board with rank 0 when nothing has been submitted", async () => {
    const { handler } = await loadBoard();
    const res = await handler(getBoard());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], rank: 0, total: 0 });
  });

  it("sorts by the requested metric, best first", async () => {
    const { handler, putRow } = await loadBoard();
    await putRow(row({ deviceId: "a", distance: 100, score: 900 }));
    await putRow(row({ deviceId: "b", distance: 300, score: 100 }));
    await putRow(row({ deviceId: "c", distance: 200, score: 500 }));

    const byDistance = await handler(getBoard("?metric=distance"));
    expect((await byDistance.json()).entries.map((r: BoardRow) => r.deviceId)).toEqual(["b", "c", "a"]);

    const byScore = await handler(getBoard("?metric=score"));
    expect((await byScore.json()).entries.map((r: BoardRow) => r.deviceId)).toEqual(["a", "c", "b"]);
  });

  it("falls back to distance for an unrecognised metric", async () => {
    const { handler, putRow } = await loadBoard();
    await putRow(row({ deviceId: "a", distance: 50 }));
    await putRow(row({ deviceId: "b", distance: 150 }));
    const res = await handler(getBoard("?metric=not-a-real-metric"));
    expect((await res.json()).entries.map((r: BoardRow) => r.deviceId)).toEqual(["b", "a"]);
  });

  it("reports the requesting device's 1-based rank", async () => {
    const { handler, putRow } = await loadBoard();
    await putRow(row({ deviceId: "a", distance: 300 }));
    await putRow(row({ deviceId: "b", distance: 200 }));
    await putRow(row({ deviceId: "c", distance: 100 }));
    const res = await handler(getBoard("?metric=distance&device=b"));
    const body = await res.json();
    expect(body.rank).toBe(2);
    expect(body.total).toBe(3);
  });

  it("filters scope=daily to today's rows only", async () => {
    const { handler, putRow, todayStr } = await loadBoard();
    const today = todayStr();
    await putRow(row({ deviceId: "today-pilot", date: today, distance: 100 }));
    await putRow(row({ deviceId: "yesterday-pilot", date: daysAgo(today, 1), distance: 999 }));
    const res = await handler(getBoard("?scope=daily"));
    const body = await res.json();
    expect(body.entries.map((r: BoardRow) => r.deviceId)).toEqual(["today-pilot"]);
    expect(body.total).toBe(1);
  });

  it("filters scope=week to a rolling 7-day window (today inclusive, day -6 inclusive, day -7 excluded)", async () => {
    const { handler, putRow, todayStr } = await loadBoard();
    const today = todayStr();
    await putRow(row({ deviceId: "in-window", date: daysAgo(today, 6), distance: 100 }));
    await putRow(row({ deviceId: "out-of-window", date: daysAgo(today, 7), distance: 100 }));
    const res = await handler(getBoard("?scope=week"));
    const body = await res.json();
    expect(body.entries.map((r: BoardRow) => r.deviceId)).toEqual(["in-window"]);
  });

  it("caps entries at 50 even when more pilots are ranked", async () => {
    const { handler, putRow } = await loadBoard();
    for (let i = 0; i < 55; i++) {
      await putRow(row({ deviceId: `pilot-${i}`, distance: i }));
    }
    const res = await handler(getBoard());
    const body = await res.json();
    expect(body.entries.length).toBe(50);
    expect(body.total).toBe(55);
    // Best-first: the top 50 by distance, so pilot-54 down to pilot-5.
    expect(body.entries[0].deviceId).toBe("pilot-54");
  });

  it("rate-limits reads per IP: 120 allowed, the 121st is rejected with retryAfterMs", async () => {
    const { handler } = await loadBoard();
    let last: Response | null = null;
    for (let i = 0; i < 121; i++) {
      last = await handler(getBoard());
    }
    expect(last!.status).toBe(429);
    const body = await last!.json();
    expect(body.error).toMatch(/rate limit/i);
    expect(typeof body.retryAfterMs).toBe("number");
  });

  it("503s in production when storage is not persistent (no Upstash configured)", async () => {
    process.env.VERCEL_ENV = "production";
    const { handler } = await loadBoard();
    const res = await handler(getBoard());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/storage unavailable/i);
  });

  it("serves normally in production once storage is up", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.KV_REST_API_URL = "https://example-upstash.test";
    process.env.KV_REST_API_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/ping")) return new Response(JSON.stringify({ result: "PONG" }), { status: 200 });
        if (url.includes("/keys/")) return new Response(JSON.stringify({ result: [] }), { status: 200 });
        return new Response(JSON.stringify({ result: null }), { status: 200 });
      }),
    );
    const { handler } = await loadBoard();
    const res = await handler(getBoard());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], rank: 0, total: 0 });
  });
});
