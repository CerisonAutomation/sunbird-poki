// Leaderboard storage for the Vercel Functions in this directory.
//
// Persistent when Upstash Redis is configured (KV_REST_API_URL +
// KV_REST_API_TOKEN, also accepted by prior Vercel KV integrations); otherwise an in-memory Map so the
// functions still run locally / in preview without any setup. The in-memory
// path is deliberately non-persistent and resets on cold start — it exists so
// `vercel dev` and plain previews work, not as a production store.
import { Redis } from "@upstash/redis";

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

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const kv =
  KV_URL && KV_TOKEN ? new Redis({ url: KV_URL, token: KV_TOKEN }) : null;

/** True when scores are backed by Redis (survive redeploys). */
export function isPersistent(): boolean {
  return kv !== null;
}

/** Lightweight readiness probe used by deployment smoke checks. */
export async function storageHealth(): Promise<{ persistent: boolean; ok: boolean }> {
  if (!kv) return { persistent: false, ok: true };
  try {
    await Promise.race([
      kv.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("storage probe timeout")), 2_000),
      ),
    ]);
    return { persistent: true, ok: true };
  } catch {
    return { persistent: true, ok: false };
  }
}

const mem = new Map<string, BoardRow>();

function keyOf(deviceId: string): string {
  return `${KEY_PREFIX}${deviceId}`;
}

export async function allRows(): Promise<BoardRow[]> {
  if (kv) {
    const keys = await kv.keys(`${KEY_PREFIX}*`);
    if (keys.length === 0) return [];
    const values = (await kv.mget(...keys)) as (BoardRow | null)[];
    return values.filter((v): v is BoardRow => v !== null);
  }
  return [...mem.values()];
}

export async function getRow(deviceId: string): Promise<BoardRow | null> {
  if (kv) {
    return (await kv.get<BoardRow>(keyOf(deviceId))) ?? null;
  }
  return mem.get(deviceId) ?? null;
}

export async function putRow(row: BoardRow): Promise<void> {
  if (kv) {
    await kv.set(keyOf(row.deviceId), row);
  } else {
    mem.set(row.deviceId, row);
  }
}
