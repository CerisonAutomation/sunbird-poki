// Leaderboard storage for the Vercel Functions in this directory.
//
// Persistent when Upstash Redis is configured (KV_REST_API_URL +
// KV_REST_API_TOKEN, also accepted by prior Vercel KV integrations); otherwise an in-memory Map so the
// functions still run locally / in preview without any setup. The in-memory
// path is deliberately non-persistent and resets on cold start — it exists so
// `vercel dev` and plain previews work, not as a production store.
//
// Upstash is talked to over its REST endpoint with plain `fetch` rather than
// through the `@upstash/redis` package. That package was dropped from
// `package.json` in the Poki-only pass while this file still imported it, which
// broke `pnpm typecheck` for the whole repo; the REST protocol is all this
// store needs (five commands), so a dependency is not worth reinstating for it.
// Serverless functions already have a global `fetch`, and dropping the client
// keeps this edge bundle smaller.

export type BoardRow = {
  deviceId: string;
  name: string;
  skin: string;
  distance: number;
  altitude: number;
  perfects: number;
  coins: number;
  score: number;
  date: string;
};

const KEY_PREFIX = "sunbird:board:v1:";

const KV_URL = process.env.KV_REST_API_URL?.replace(/\/$/, "") ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? "";

/** Upstash is usable only with both halves of the credential. */
const kvConfigured = KV_URL !== "" && KV_TOKEN !== "";

type UpstashResponse<T> = { result?: T; error?: string };

/**
 * Run one Upstash REST command.
 *
 * `path` is the Redis command and its arguments joined with `/` (Upstash's
 * REST encoding); `body`, when present, is sent verbatim as the value. Every
 * failure resolves to `null` instead of throwing: this is an optional backing
 * store, and a Redis outage must degrade to the in-memory path rather than turn
 * a leaderboard read into a 500.
 */
async function kvCommand<T>(path: string, body?: string): Promise<T | null> {
  try {
    const response = await fetch(`${KV_URL}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as UpstashResponse<T>;
    return payload.error ? null : (payload.result ?? null);
  } catch {
    return null;
  }
}

/** True when scores are backed by Redis (survive redeploys). */
export function isPersistent(): boolean {
  return kvConfigured;
}

/** Lightweight readiness probe used by deployment smoke checks. */
export async function storageHealth(): Promise<{ persistent: boolean; ok: boolean }> {
  if (!kvConfigured) return { persistent: false, ok: true };
  try {
    const result = await Promise.race([
      kvCommand<string>("ping"),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
    ]);
    return { persistent: true, ok: result !== null };
  } catch {
    return { persistent: true, ok: false };
  }
}

const mem = new Map<string, BoardRow>();

function keyOf(deviceId: string): string {
  return `${KEY_PREFIX}${deviceId}`;
}

/** Upstash returns JSON strings; the SDK used to parse them for us. */
function parseRow(value: unknown): BoardRow | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as BoardRow;
    } catch {
      return null;
    }
  }
  return (value as BoardRow | null) ?? null;
}

export async function allRows(): Promise<BoardRow[]> {
  if (kvConfigured) {
    const keys = await kvCommand<string[]>(`keys/${encodeURIComponent(`${KEY_PREFIX}*`)}`);
    if (!keys || keys.length === 0) return [];
    // `mget` takes the keys as further path segments. Long key lists are split
    // so a large board cannot produce a path the endpoint rejects.
    const rows: BoardRow[] = [];
    for (let i = 0; i < keys.length; i += 50) {
      const batch = keys.slice(i, i + 50).map((k) => encodeURIComponent(k));
      const values = await kvCommand<unknown[]>(`mget/${batch.join("/")}`);
      for (const value of values ?? []) {
        const row = parseRow(value);
        if (row) rows.push(row);
      }
    }
    return rows;
  }
  return [...mem.values()];
}

export async function getRow(deviceId: string): Promise<BoardRow | null> {
  if (kvConfigured) {
    return parseRow(await kvCommand<unknown>(`get/${encodeURIComponent(keyOf(deviceId))}`));
  }
  return mem.get(deviceId) ?? null;
}

export async function putRow(row: BoardRow): Promise<void> {
  if (kvConfigured) {
    await kvCommand<string>(`set/${encodeURIComponent(keyOf(row.deviceId))}`, JSON.stringify(row));
    return;
  }
  mem.set(row.deviceId, row);
}

const QUOTA_PREFIX = "sunbird:quota:v1:";

/**
 * Global fixed-window write counter, shared by every edge isolate.
 *
 * The in-memory limiter this replaced could only ever cap abuse *per warm
 * instance*: Vercel routes concurrent requests across isolates and regions,
 * each with its own Map, so a client that got load-balanced could exceed the
 * cap in aggregate by simply spreading its writes. This is the fix, and it is
 * available because the board is already backed by Upstash — the same store
 * `getRow`/`putRow` use, so a submission now costs two round trips for the
 * row and one more for the counter, not a new dependency.
 *
 * `INCR` is the whole trick: Redis applies it atomically, so N concurrent
 * writers to one key get N distinct, gap-free counts and exactly one of them
 * observes `1`. That `1` is the only moment a TTL is attached, which makes the
 * window self-healing — it cannot be extended by continued writes, so a
 * single abusive client cannot pin a key into permanent existence.
 *
 * Returns the window's count, or `null` when there is no shared store (local
 * / preview) or Redis hiccuped. `null` is deliberately distinct from `0`: the
 * caller must be able to tell "you have used nothing" from "I could not
 * check", and a store outage should degrade to the caller's own limiter rather
 * than reject every legitimate write.
 *
 * @param rearmAbove A count this far beyond any legitimate usage is treated as
 *   a poisoned, TTL-less key and the window is re-armed. See the reset below —
 *   it is the difference between a self-healing limiter and one that can ban a
 *   real pilot forever after a single failed round trip.
 */
export async function bumpWriteQuota(key: string, windowMs: number, rearmAbove: number): Promise<number | null> {
  if (!kvConfigured) return null;
  const counterKey = `${QUOTA_PREFIX}${key}`;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const raw = await kvCommand<unknown>(`incr/${encodeURIComponent(counterKey)}`);
  // `INCR` answers with an integer, but this is a network response from a
  // store we do not control, so its shape is not guaranteed: a proxy error
  // page, a protocol change, or an `{"error":...}` that surfaced as a string
  // all land here. Coercing that to a count is how a limiter silently starts
  // rejecting every player (NaN fails the cap comparison) or, worse, silently
  // admits everything.
  //
  // Note that a missing result must NOT be read as 0: `Number(null)` is `0`,
  // which would mean "used none of the quota" and wave a write through
  // uncounted exactly when the store is broken. Only a real non-negative
  // integer counts as a count; anything else is "could not check", which the
  // caller already knows how to handle without punishing a legitimate write.
  if (raw === null || raw === undefined) return null;
  const count = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 0) return null;

  if (count > rearmAbove) {
    // No legitimate caller is this far past the cap, so this is a counter that
    // lost its TTL: the INCR landed but the EXPIRE below did not, so the key
    // will never again report 1 and this pilot would stay throttled for the
    // lifetime of the store. Re-arm it with one atomic `SET 1 EX ttl`.
    await kvCommand<number>(`set/${encodeURIComponent(counterKey)}/1/ex/${ttlSeconds}`);
    return 1;
  }
  if (count === 1) {
    // First write in this window — give the key a lifetime so it expires on
    // its own instead of accumulating one entry per distinct caller forever.
    await kvCommand<number>(`expire/${encodeURIComponent(counterKey)}/${ttlSeconds}`);
  }
  return count;
}
