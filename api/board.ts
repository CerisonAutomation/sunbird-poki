// GET /api/board?scope=global|daily|week&metric=distance|altitude|perfects|coins|score&device=<id>
//
// Implements the `GET /board` half of LEADERBOARD_API.md: returns the top 50
// pilots sorted by the requested metric, plus the requesting device's rank.
import type { BoardRow } from "./_lib/store.js";
import { allRows, storageHealth } from "./_lib/store.js";
import { handleOptions, json, todayStr } from "./_lib/http.js";

export const config = { runtime: "edge" };

const METRICS = ["distance", "altitude", "perfects", "coins", "score"] as const;
type Metric = (typeof METRICS)[number];

const metricOf = (row: BoardRow, metric: Metric): number => row[metric];

/*
 * Per-IP read limiter (windowed counter, same shape as the write limiter in
 * score.ts). A board read scans every key in KV, so it is the priciest edge
 * route in this directory — sustained flooders must not be able to burn
 * read units against the storage backend.
 */
const READ_WINDOW_MS = 60_000;
const MAX_READS_PER_KEY = 120;
const reads = new Map<string, { started: number; count: number }>();

function clientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function readAllowed(key: string): boolean {
  const now = Date.now();
  const prior = reads.get(key);
  if (!prior || now - prior.started >= READ_WINDOW_MS) {
    reads.set(key, { started: now, count: 1 });
    return true;
  }
  if (prior.count >= MAX_READS_PER_KEY) return false;
  prior.count += 1;
  return true;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
  if (!readAllowed(clientAddress(request))) {
    return json({ error: "rate limited", retryAfterMs: READ_WINDOW_MS }, 429);
  }
  if (process.env.VERCEL_ENV === "production") {
    const storage = await storageHealth();
    if (!storage.persistent || !storage.ok) return json({ error: "leaderboard storage unavailable" }, 503);
  }

  const url = new URL(request.url);
  const metric: Metric = METRICS.includes(url.searchParams.get("metric") as Metric)
    ? (url.searchParams.get("metric") as Metric)
    : "distance";
  const scope = url.searchParams.get("scope") || "global";
  const device = url.searchParams.get("device") || "";

  const rows = await allRows();
  const today = todayStr();
  const list =
    scope === "daily"
      ? rows.filter((r) => r.date === today)
      : scope === "week"
        ? rows.filter((r) => {
            // Rolling 7-day window (today inclusive), shared with the client's
            // on-device fallback so both backends agree on membership.
            const from = new Date(`${today}T00:00:00Z`);
            from.setUTCDate(from.getUTCDate() - 6);
            return r.date >= from.toISOString().slice(0, 10) && r.date <= today;
          })
        : rows;
  list.sort((a, b) => metricOf(b, metric) - metricOf(a, metric));

  const rank = list.findIndex((r) => r.deviceId === device) + 1;

  return json({
    entries: list.slice(0, 50),
    rank,
    total: list.length,
  });
}
