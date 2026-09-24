// POST /api/score
//
// Implements the `POST /score` half of LEADERBOARD_API.md: accepts a finished
// run, keeps the best row per pilot (best by distance), and enforces the
// documented plausibility gates + optional HMAC signing (v1.1).
import { getRow, putRow, storageHealth } from "./_lib/store.js";
import { boundedNum, handleOptions, json, sanitize, todayStr } from "./_lib/http.js";

export const config = { runtime: "edge" };

const SALT = process.env.LEADERBOARD_SALT ?? "";
const WINDOW_MS = 60_000;
const MAX_WRITES_PER_KEY = 30;
const writes = new Map<string, { started: number; count: number }>();

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || "unknown";
}

function allowed(key: string): boolean {
  const now = Date.now();
  const prior = writes.get(key);
  if (!prior || now - prior.started >= WINDOW_MS) {
    writes.set(key, { started: now, count: 1 });
    return true;
  }
  if (prior.count >= MAX_WRITES_PER_KEY) return false;
  prior.count += 1;
  return true;
}

async function sign(deviceId: string, distance: number, score: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SALT), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${deviceId}|${distance}|${score}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A score belongs on the *player's* local day, not the server's UTC day — the
 * client sends its `dateSeed()` (local midnight) and the "daily" board must
 * reset on that same midnight, or a player near the UTC boundary sees their
 * run land on the wrong day. Accept the client day only when it's a real
 * calendar date within ±2 days of the server's UTC day, so a tampered payload
 * can't plant a score on an arbitrary historical board.
 */
function resolveDay(clientDate: unknown): string {
  const today = todayStr();
  const raw = sanitize(clientDate, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return today;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(t)) return today;
  const d = new Date(t);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return today; // rolled over — an impossible date like 2026-02-31
  }
  const nowT = parseDayMs(today);
  const delta = nowT === null ? 0 : Math.abs(t - nowT);
  return delta <= 2 * 86_400_000 ? raw : today;
}

function parseDayMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return json({ error: "payload too large" }, 413);
  if (process.env.VERCEL_ENV === "production") {
    const storage = await storageHealth();
    if (!storage.persistent || !storage.ok) return json({ error: "leaderboard storage unavailable" }, 503);
    // Production is fail-closed: LEADERBOARD_SALT is part of the deployment.
    // An unset salt would make every submission unsigned, so a live board
    // must refuse to run open rather than accept unsigned scores.
    if (!SALT) return json({ error: "leaderboard signing not configured" }, 503);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return json({ error: "payload too large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const p = (body ?? {}) as Record<string, unknown>;

  const row = {
    deviceId: sanitize(p.deviceId, 64),
    name: sanitize(p.name, 14) || "Pilot",
    skin: sanitize(p.skin, 24),
    distance: Math.round(boundedNum(p.distance, 500_000)),
    altitude: Math.round(boundedNum(p.altitude, 10_000)),
    perfects: Math.round(boundedNum(p.perfects, 5_000)),
    coins: Math.round(boundedNum(p.coins, 100_000)),
    score: Math.round(boundedNum(p.score, 5_000_000)),
    date: resolveDay(p.date),
  };

  if (!row.deviceId) return json({ error: "missing deviceId" }, 400);
  if (!allowed(`${clientAddress(request)}:${row.deviceId}`)) {
    return json({ error: "rate limit exceeded" }, 429);
  }

  // Plausibility gates (documented in LEADERBOARD_API.md), enforced whether
  // or not signing is configured.
  if (row.distance > 60_000) return json({ error: "implausible distance" }, 422);
  if (row.score > row.distance * 40 + 50_000) return json({ error: "implausible score" }, 422);

  // Signing (v1.1): REQUIRED in production (fail-closed check above); in
  // every environment where a salt is configured, an unsigned/badly-signed
  // post is rejected. Previews without a salt stay lenient by design —
  // their boards are memory-only and never rank globally.
  if (SALT) {
    const provided = sanitize(p.sig, 128);
    const expected = await sign(row.deviceId, row.distance, row.score);
    const same = provided.length === expected.length && [...provided].every((char, index) => char === expected[index]);
    if (!same) return json({ error: "invalid signature" }, 403);
  }

  // Keep the best row per pilot (best by distance), matching the reference.
  const prev = await getRow(row.deviceId);
  if (!prev || row.distance > prev.distance) await putRow(row);

  return json({ ok: true });
}
