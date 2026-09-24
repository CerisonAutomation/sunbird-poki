/**
 * A/B experiment bucketing — deterministic, stateless, offline-safe.
 *
 * Assignment is `fnv1a(deviceId + experimentId) % 100` (the industry-standard
 * sticky-bucketing scheme: same player always sees the same variant, across
 * sessions and devices, with the experiment id salted in so two experiments
 * never correlate). No server round-trip, no DB, <1µs per call.
 *
 * The measurement contract is *exposure*: a variant only counts when the
 * treated surface is actually shown, so `variant()` fires `onExpose` exactly
 * once per experiment per session — the join key for any metric comparison.
 */
export type Variant = "control" | "treatment";

/**
 * Named experiments the client actually runs. Ids are the salt `variant()`
 * uses, so renaming one re-buckets every device — treat them as append-only.
 * `results_cta_order` is already live in Game.ts; the rest are ready for a
 * flag flip or a one-line call site.
 */
export const EXPERIMENTS = {
  results_cta_order: {
    id: "results_cta_order",
    split: 50,
    metric: "share_rate",
    hypothesis: "Leading the recap with Share lifts challenge throws without hurting retry.",
  },
  adaptive_difficulty: {
    id: "adaptive_difficulty",
    split: 50,
    metric: "d1_retry",
    hypothesis: "Casual ease on the first sessions lifts D1 without moving ranked outcomes.",
  },
  clip_share_prompt: {
    id: "clip_share_prompt",
    split: 50,
    metric: "challenge_share",
    hypothesis: "A clip-worthy recap that leads with Challenge beats a coin-flip CTA order.",
  },
  short_onboarding: {
    id: "short_onboarding",
    split: 50,
    metric: "first_flight_complete",
    hypothesis: "A 15-second coach (vs the longer hold) raises first-flight completion.",
  },
  reward_rate: {
    id: "reward_rate",
    split: 50,
    metric: "session_length",
    hypothesis: "A slightly fatter first-session coin drip lengthens session 1 without sinking economy.",
  },
} as const;

export type ExperimentId = (typeof EXPERIMENTS)[keyof typeof EXPERIMENTS]["id"];

const BUCKETS = 100;

/** FNV-1a (32-bit) — fast, deterministic, and stable across JS runtimes. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable bucket 0..99 for a (device, experiment) pair. */
export function bucket(deviceId: string, experimentId: string): number {
  return fnv1a(`${deviceId}:${experimentId}`) % BUCKETS;
}

/** Experiments already exposed this session, so a player never logs the same
 *  exposure twice (duplicate exposure logs poison the analysis). */
const exposed = new Set<string>();

/**
 * Resolves the variant for an experiment and logs exposure once per session.
 * `split` is the control/treatment boundary (0..100); 50 = even split.
 */
export function variant(
  deviceId: string,
  experimentId: string,
  split = 50,
  onExpose?: (v: Variant) => void,
): Variant {
  const v: Variant = bucket(deviceId, experimentId) < split ? "control" : "treatment";
  const key = `${experimentId}:${v}`;
  if (!exposed.has(key)) {
    exposed.add(key);
    onExpose?.(v);
  }
  return v;
}
