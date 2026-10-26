// POST /api/score
//
// Implements the `POST /score` half of LEADERBOARD_API.md: accepts a finished
// run, keeps the best row per pilot (best by distance), and enforces the
// documented plausibility gates + optional HMAC signing (v1.1).
import { bumpWriteQuota, getRow, isPersistent, putRow, storageHealth } from "./_lib/store.js";
import { boundedNum, handleOptions, json, sanitize, todayStr } from "./_lib/http.js";

export const config = { runtime: "edge" };

const SALT = process.env.LEADERBOARD_SALT ?? "";
const WINDOW_MS = 60_000;
const MAX_WRITES_PER_KEY = 30;
/**
 * How far past the cap a shared counter may climb before we assume its TTL was
 * lost and re-arm the window. Nothing legitimate gets near it — a pilot
 * posting at the full cap for an entire minute would reach 30, and the store
 * only ever reports a count within the current window.
 */
const REARM_ABOVE = MAX_WRITES_PER_KEY * 10;
const writes = new Map<string, { started: number; count: number }>();

/**
 * `writes` is a plain module-level Map, so — like every in-memory limiter in
 * this directory — it is scoped to a single warm edge instance. Vercel can
 * (and does) route concurrent requests to several isolates across regions,
 * each with its own independent map, so this map can only bound abuse *per
 * instance*.
 *
 * It is therefore no longer the primary limit. `allowed()` below consults the
 * shared Upstash counter first, which is global across the whole fleet, and
 * falls back to this map only when there is no shared store (local / preview)
 * or Redis could not be reached. The old comment here described this as the
 * limit and called the aggregate overshoot "good enough"; for a board that
 * pays out a season prize, per-isolate is not a bound, so the shared counter
 * is.
 *
 * Left unswept, `writes` would grow by one entry per distinct
 * IP+deviceId pair ever seen, for as long as the instance stays warm — a slow
 * memory leak. Sweep it every 5 minutes, dropping any entry whose rate-limit
 * window has already elapsed.
 *
 * `unrefTimer` lets a Node test host (which imports this module fresh per
 * test via `vi.resetModules()`) exit cleanly instead of accumulating live
 * intervals; on the actual edge runtime `unref` doesn't exist and the
 * optional call is simply a no-op.
 */
const SWEEP_INTERVAL_MS = 5 * 60_000;

function unrefTimer(timer: unknown): void {
  (timer as { unref?: () => void }).unref?.();
}

unrefTimer(
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of writes) {
      if (now - entry.started >= WINDOW_MS) writes.delete(key);
    }
  }, SWEEP_INTERVAL_MS),
);

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || "unknown";
}

function allowedLocally(key: string): boolean {
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

/**
 * The write quota, fleet-wide.
 *
 * The counter is keyed by IP + deviceId, so it caps one caller spreading its
 * writes across the edge fleet, while still letting a shared-IP lobby (a
 * school, a café wifi, a carrier NAT) submit as several pilots — the deviceId
 * half of the key is what keeps those apart.
 *
 * `bumpWriteQuota` returning `null` means "no shared store" rather than "zero
 * uses", so we fall back to the per-isolate window instead of rejecting a
 * legitimate first-ever score because Redis blinked. Production already
 * fails closed above when storage is unhealthy, so this path is the local and
 * preview case plus transient Redis errors, not a way to bypass the limit in
 * a healthy deployment.
 */
async function allowed(key: string): Promise<boolean> {
  if (isPersistent()) {
    const count = await bumpWriteQuota(key, WINDOW_MS, REARM_ABOVE);
    if (count !== null) return count <= MAX_WRITES_PER_KEY;
  }
  return allowedLocally(key);
}

async function sign(deviceId: string, distance: number, score: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SALT), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${deviceId}|${distance}|${score}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string comparison for HMAC signatures.
 *
 * `.every()` with `&&`-style short-circuiting (or a plain `===`) returns as
 * soon as it finds a mismatching character, so the time the comparison takes
 * leaks how many leading characters of `provided` are correct. Over enough
 * requests that timing side-channel lets an attacker forge a valid signature
 * one character at a time without ever knowing LEADERBOARD_SALT. This walks
 * every position unconditionally (XOR-and-OR into an accumulator, never a
 * branch on equality) so the running time depends only on the compared
 * length, not on where — or whether — the strings diverge.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
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
  if (!(await allowed(`${clientAddress(request)}:${row.deviceId}`))) {
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
  //
  // What this does and does not buy you, stated plainly because the
  // constant-time comparison below invites the opposite reading: the salt is a
  // Vite env var, so it is inlined into the shipped client bundle and is
  // readable in the portal zip. A motivated cheater can therefore produce a
  // valid signature for an invented score, and this check will accept it.
  // Treat a signature as tamper-evidence against accidental or casually
  // edited clients, not as proof a run happened. Real enforcement is the
  // server re-deriving the score from a replay it re-simulates; the sim is
  // deterministic by construction, but that validator is not built yet (see
  // ROADMAP.md). Until it is, the documented envelope above and the
  // fleet-wide write quota are the actual defences.
  if (SALT) {
    const provided = sanitize(p.sig, 128);
    const expected = await sign(row.deviceId, row.distance, row.score);
    if (!timingSafeEqual(provided, expected)) return json({ error: "invalid signature" }, 403);
  }

  // Keep the best row per pilot (best by distance), matching the reference.
  const prev = await getRow(row.deviceId);
  if (!prev || row.distance > prev.distance) await putRow(row);

  return json({ ok: true });
}
