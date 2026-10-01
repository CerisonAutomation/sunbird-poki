/**
 * How the world escalates as you get further from the start line.
 *
 * Two complaints, one system: the worlds all feel the same distance apart,
 * and the run stops getting harder. Both were true, and both were arithmetic
 * rather than art direction.
 *
 * THE GAP. The ocean between islands was `GAP_BASE + index * GAP_PER_ISLAND`
 * with GAP_BASE 218 and GAP_PER_ISLAND 4. Island 10 is therefore 258 units
 * across — eighteen percent wider than island 0, after ten worlds. A linear
 * ramp that shallow is indistinguishable from a constant, so the crossing
 * never became the thing you brace for, and the islands never read as
 * separate places.
 *
 * A gap is also the only moment in the game where the player cannot touch the
 * ground, so it is the purest test of the one input there is: everything you
 * did on the approach — how late you released, how much speed you carried
 * over the lip — is settled over open water with nothing to correct it. It is
 * the best difficulty dial the game has and it was turned almost off.
 *
 * So the curve is saturating rather than linear: steep early, where the
 * player is learning that the crossing matters, and flattening to a ceiling
 * the flight model can always clear. Linear growth eventually produces a gap
 * nothing can cross; exponential approach to a fixed ceiling never does, and
 * the ceiling is a number the old formula already reached on its own (at
 * island 53), so no crossing is being asked for that the game has not already
 * shipped.
 *
 * THE HILLS. `flightProgression` ramped arch height by 32% and rhythm by 24%
 * over roughly twelve islands, then stopped. Widened, on the same saturating
 * shape, so late islands are genuinely steeper and busier rather than merely
 * further along.
 *
 * Pure and dependency-free so the curve can be asserted — including the
 * property that matters most, that it is bounded.
 */

/** The first crossing. Gentle on purpose: it is a tutorial for the gap. */
export const GAP_MIN = 218;

/**
 * The widest the ocean ever gets.
 *
 * Not invented: the previous linear formula produced exactly this at island
 * 53, so it is a distance the shipped flight model already had to clear. The
 * change is that a player meets it around island 20 instead of never.
 */
export const GAP_MAX = 430;

/** Islands over which the gap covers ~63% of its range. Lower = steeper. */
export const GAP_RAMP_ISLANDS = 9;

/**
 * Width of the ocean before island `index`, in world units.
 *
 * Monotonic, bounded by GAP_MAX, and finite for every input including junk.
 */
export function islandGap(index: number): number {
  if (!Number.isFinite(index)) return GAP_MIN;
  const i = Math.max(0, index);
  const t = 1 - Math.exp(-i / GAP_RAMP_ISLANDS);
  return GAP_MIN + (GAP_MAX - GAP_MIN) * t;
}

/**
 * Terrain escalation for an island: how much taller the arches get and how
 * much tighter their rhythm.
 *
 * Was hillScale 1..1.32 and rhythmScale 1..1.24 over ~12 islands. A third
 * more amplitude is not much of a career, so both ranges are widened on the
 * same shape. Still saturating: the twentieth island should be harder than
 * the tenth, but the hundredth must not be unplayable.
 */
export function flightProgressionAt(island: number): { hillScale: number; rhythmScale: number } {
  const i = Number.isFinite(island) ? Math.max(0, island) : 0;
  // The time constant is 22, not the original 12, and that is load-bearing.
  // climb-and-chain.test.ts and performance.test.ts both cap the difficulty
  // STEP between consecutive islands at 0.03 — a bigger jump than that is a
  // wall rather than a ramp, which is exactly the failure mode a career
  // curve is supposed to avoid. For an exponential approach the steepest
  // step is range/T at island 0, so widening the range from 0.32 to 0.55
  // requires stretching T in proportion: 0.55/22 = 0.025, inside the cap,
  // where 0.55/12 = 0.046 is not. The destination gets further away; the
  // road to it does not get steeper. Both guards caught this and both were
  // right.
  const progress = 1 - Math.exp(-i / 22);
  return {
    hillScale: 1 + progress * 0.55,
    rhythmScale: 1 + progress * 0.4,
  };
}

/** Asymptotic ceilings, exported so guards assert the intent and not a
 *  number someone has to remember to keep in sync. */
export const HILL_SCALE_MAX = 1.55;
export const RHYTHM_SCALE_MAX = 1.4;
