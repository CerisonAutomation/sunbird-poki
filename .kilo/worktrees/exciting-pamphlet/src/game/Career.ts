/**
 * Career wings — the long game, made visible.
 *
 * Every flight adds to a lifetime odometer the save has always kept
 * (`lifetime.distance`) but the UI barely surfaced. Wings ranks turn that
 * number into identity: every pilot is somewhere on the ladder, and the next
 * rung is always visible. Thresholds are tuned so a casual player reaches
 * Bronze in a session or two, while Aurora is a months-long badge of honor.
 *
 * Pure module: no storage, no DOM — trivially testable.
 */

export type WingsTier = {
  id: string;
  name: string;
  icon: string;
  /** Lifetime metres required. */
  min: number;
};

export const WINGS: WingsTier[] = [
  { id: "paper", name: "Paper Wings", icon: "🪁", min: 0 },
  { id: "bronze", name: "Bronze Wings", icon: "🥉", min: 25_000 },
  { id: "silver", name: "Silver Wings", icon: "🥈", min: 100_000 },
  { id: "gold", name: "Gold Wings", icon: "🥇", min: 400_000 },
  { id: "platinum", name: "Platinum Wings", icon: "💠", min: 1_000_000 },
  { id: "aurora", name: "Aurora Wings", icon: "🌈", min: 2_500_000 },
];

/**
 * Pure: is this flight crossing into the next rung *right now*?
 *
 * Lifetime distance only commits when the run lands (`recordRun`), so mid-flight
 * the rung is earned the instant this flight's metres cover the gap to it. This
 * is deliberately separate from `wingsProximity()`: that one reports how close the
 * stretch is and turns itself off at the crossing (`visible: remaining > 0`), so
 * it cannot be the thing that notices the crossing happened.
 *
 * `alreadyCued` makes the moment fire once per flight — a banner that re-fires
 * every frame for the rest of the run is not a moment, it is a stuck overlay.
 */
export function wingsCrossing(opts: {
  flownMetres: number;
  nextNeeded: number;
  alreadyCued: boolean;
}): boolean {
  const flown = Number.isFinite(opts.flownMetres) ? Math.max(0, opts.flownMetres) : 0;
  const needed = Number.isFinite(opts.nextNeeded) ? opts.nextNeeded : 0;
  if (opts.alreadyCued || needed <= 0) return false;
  return flown >= needed;
}

/** The tier a lifetime distance has earned. */
export function wingsFor(lifetimeDistance: number): WingsTier {
  const d = Math.max(0, lifetimeDistance);
  let cur = WINGS[0]!;
  for (const t of WINGS) if (d >= t.min) cur = t;
  return cur;
}

/** The next rung, or null at the top of the ladder. */
export function nextWings(lifetimeDistance: number): { tier: WingsTier; needed: number } | null {
  const d = Math.max(0, lifetimeDistance);
  for (const t of WINGS) if (d < t.min) return { tier: t, needed: t.min - d };
  return null;
}

/** Progress (0..1) through the current tier toward the next. */
export function wingsProgress(lifetimeDistance: number): number {
  const d = Math.max(0, lifetimeDistance);
  const cur = wingsFor(d);
  const next = nextWings(d);
  if (!next) return 1;
  const span = next.tier.min - cur.min;
  return span > 0 ? Math.min(1, (d - cur.min) / span) : 1;
}

/** The tier a flight just promoted the pilot into, or null. */
export function wingsPromotion(lifetimeBefore: number, lifetimeAfter: number): WingsTier | null {
  const before = wingsFor(lifetimeBefore);
  const after = wingsFor(lifetimeAfter);
  return after.min > before.min ? after : null;
}
