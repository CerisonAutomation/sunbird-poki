/**
 * GhostNet — async PvP on the daily seed.
 *
 * Publish: after a daily-seed run, your best flight (the same samples the
 * local GhostRecorder keeps) is posted to the backend, best-per-pilot-per-seed.
 *
 * Chase: at run start we ask for a REAL player's ghost near (just above) your
 * personal best — a target you can realistically hunt. The server never
 * returns your own flight back. Honest scope: with no backend configured
 * (portal builds, offline) every call is a silent no-op and the local
 * personal ghost carries the experience, exactly as before.
 */

import { backendBase } from "./apiBase";
import { breakerKeyFor, fetchJson } from "./resilience/fetchJson";

/** Ghosts live under `/mp` — see `apiBase.ts` for the prefix contract. */
function apiBase(): string {
  return backendBase("/mp");
}

type Sample = [number, number, number, number];

export type RivalGhost = { name: string; distance: number; samples: Sample[] };

/** Publish this run's replay. Fire-and-forget; never throws. */
export async function publishGhost(opts: {
  seed: string;
  deviceId: string;
  name: string;
  distance: number;
  samples: readonly Sample[];
}): Promise<void> {
  const base = apiBase();
  if (!base || opts.samples.length < 5 || opts.distance <= 0) return;
  try {
    // Same ghost is re-published with newer data — idempotent server-side.
    await fetchJson(`${base}/ghost`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: opts.seed,
        deviceId: opts.deviceId,
        name: opts.name,
        distance: Math.round(opts.distance),
        // Thin to ≤1500 samples to respect the server cap (~7 min of flight).
        samples: thin(opts.samples, 1500),
      }),
      keepalive: true,
      breaker: breakerKeyFor(base),
      idempotent: true,
      attempts: 2,
    });
  } catch {
    // Async PvP is a bonus layer — publishing must never surface an error.
  }
}

/** Fetch a rival ghost worth chasing on this seed, or null. */
export async function fetchRivalGhost(seed: string, deviceId: string, nearDistance: number): Promise<RivalGhost | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const { data } = await fetchJson<{ ghost?: { name?: unknown; distance?: unknown; samples?: unknown } | null }>(
      `${base}/ghost?seed=${encodeURIComponent(seed)}&device=${encodeURIComponent(deviceId)}&near=${Math.round(nearDistance)}`,
      { breaker: breakerKeyFor(base), timeoutMs: 4000, attempts: 2 },
    );
    const g = data.ghost;
    if (!g || !Array.isArray(g.samples) || g.samples.length < 5) return null;
    const samples = (g.samples as unknown[]).filter(
      (s): s is Sample => Array.isArray(s) && s.length === 4 && s.every((n) => typeof n === "number" && Number.isFinite(n)),
    );
    if (samples.length < 5) return null;
    return {
      name: typeof g.name === "string" && g.name ? g.name.slice(0, 24) : "Rival",
      distance: Number(g.distance) || 0,
      samples,
    };
  } catch {
    return null;
  }
}

/** Even-stride downsample preserving first and last samples. */
export function thin(samples: readonly Sample[], max: number): Sample[] {
  if (samples.length <= max) return [...samples];
  const out: Sample[] = [];
  const step = (samples.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(samples[Math.round(i * step)]!);
  return out;
}
