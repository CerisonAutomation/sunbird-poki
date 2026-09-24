// GET /api/health — deployment/readiness probe for the leaderboard backend.
import { storageHealth } from "./_lib/store.js";
import { handleOptions, json } from "./_lib/http.js";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
  const storage = await storageHealth();
  const production = process.env.VERCEL_ENV === "production";
  const signingConfigured = Boolean(process.env.LEADERBOARD_SALT);
  // Production boards are fail-closed on the salt: an unset salt means the
  // score endpoint 503s, so readiness reflects that.
  const ready = storage.ok && (!production || (storage.persistent && signingConfigured));
  return json({
    ok: ready,
    service: "sunbird-leaderboard",
    storage: storage.persistent ? "upstash-redis" : "memory-preview",
    signing: signingConfigured ? "enabled" : "absent",
    environment: process.env.VERCEL_ENV || "local",
  }, ready ? 200 : 503);
}
