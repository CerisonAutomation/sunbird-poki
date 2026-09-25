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
