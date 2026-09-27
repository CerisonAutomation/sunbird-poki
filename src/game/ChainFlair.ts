/**
 * The chain, and how loudly it celebrates itself.
 *
 * Sunbird's ancestor (Tiny Wings, Sergey Tikhonov's 2011 remake) had exactly
 * one flourish in the whole game, and it was this: consecutive clean take-offs
 * chained, and at four it announced FRENZY. Everything else in that game was
 * grey hills and a blue sky. The lesson is not "add a frenzy mode" — Sunbird
 * already has Fever — it is that **a chain has to be visible and it has to
 * escalate.** A reward that reads the same at ×1 and ×9 is a reward nobody
 * feels.
 *
 * So this is the flourish ladder: pure functions, one per tier, so the whole
 * escalation can be enumerated in a test instead of eyeballed in a screenshot.
 */

export type FlairTier = "none" | "warm" | "hot" | "blazing" | "frenzy";

/** The chain length at which the game stops scaling and starts celebrating. */
export const FRENZY_AT = 4;

/** The largest chain the flair ladder distinguishes. Beyond this it holds. */
export const FLAIR_MAX = 9;

/** Which rung of the ladder a chain is on. */
export function chainTier(combo: number): FlairTier {
  const c = Math.max(0, Math.floor(combo));
  if (c <= 0) return "none";
  if (c < 2) return "warm";
  if (c < 3) return "hot";
  if (c < FRENZY_AT) return "blazing";
  return "frenzy";
}

/** The word on the readout. Empty at zero, so the element can hide itself. */
export function chainLabel(combo: number): string {
  const c = Math.max(0, Math.floor(combo));
  if (c <= 0) return "";
  return chainTier(c) === "frenzy" ? `FRENZY ×${c}` : `CHAIN ×${c}`;
}

/**
 * How large the readout should be drawn.
 *
 * Grows with the chain but compresses hard: an unbroken ×9 must not be nine
 * times the size of ×1, or the first few steps are invisible and the last one
 * covers the screen. The curve is sqrt-ish on purpose.
 */
export function chainScale(combo: number): number {
  const c = Math.max(0, Math.min(FLAIR_MAX, Math.floor(combo)));
  if (c <= 0) return 0;
  return 0.72 + 0.34 * Math.sqrt(c);
}

/**
 * How fast the readout should pulse, in beats per second. Escalating, so a long
 * chain is felt in peripheral vision as much as read.
 */
export function chainPulse(combo: number): number {
  const tier = chainTier(combo);
  return tier === "none" ? 0 : tier === "warm" ? 0.8 : tier === "hot" ? 1.2 : tier === "blazing" ? 1.7 : 2.4;
}

/** The coin bonus a chain step is worth, on top of the flat perfect award. */
export function chainBonus(combo: number): number {
  return Math.min(40, Math.max(0, combo - 1) * 6);
}

/** True the first time a run reaches FRENZY, false on every visit after. */
export function isFrenzyMoment(chain: number, alreadyFrenzied: boolean): boolean {
  return !alreadyFrenzied && Math.floor(chain) >= FRENZY_AT;
}
