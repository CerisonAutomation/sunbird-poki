/**
 * Resolution-stepping policy for the adaptive quality loop.
 *
 * Kept pure and dependency-free so it can be unit-tested without a WebGL
 * context: Game.ts imports Three.js and the whole game, which is far too heavy
 * to pull into a test just to exercise an arithmetic decision.
 */

/** Frame time above this means the 60 fps budget is blown: step down. */
export const STEP_DOWN_FRAME_SECONDS = 1 / 40;
/** Frame time below this means there is real headroom: step up. */
export const STEP_UP_FRAME_SECONDS = 1 / 57;
/**
 * Stricter headroom bar for the optional expensive effects — bloom and soft
 * shadows. Deliberately tighter than STEP_UP_FRAME_SECONDS, and not a typo of
 * it: nudging the resolution up costs a fraction of a millisecond, while
 * re-arming bloom or shadow maps costs several, so those are only worth
 * switching on when the frame sits comfortably inside budget.
 */
export const EFFECT_UP_FRAME_SECONDS = 1 / 58;
/** Size of one resolution step, in devicePixelRatio units. */
export const DPR_STEP = 0.25;
/** Lowest resolution we will ever drop to — below 1 is blurry and pointless. */
export const DPR_FLOOR = 1;
/** Seconds between adaptive-quality decisions. */
export const QUALITY_WINDOW_SECONDS = 2.5;
/** Resolution changes are locked out for this long after any change. */
export const DPR_COOLDOWN_SECONDS = 5;

/**
 * Decide the next devicePixelRatio for the adaptive quality loop.
 *
 * `target` is the ceiling reported by `preferredDpr()`. The result is always
 * clamped to [DPR_FLOOR, target], and never changes while `cooldown > 0`.
 *
 * Two failure modes this deliberately avoids:
 *  - A single bad moment (a GC pause, a background sync) permanently degrading
 *    the rest of the session — the old loop only ever stepped down.
 *  - A single good frame bouncing the resolution straight back up into another
 *    bad frame — hence the dead band and the caller-side cooldown.
 */
export function nextDpr(current: number, target: number, frameEma: number, cooldown: number): number {
  const ceiling = Math.max(DPR_FLOOR, target);
  const clamped = Math.min(Math.max(current, DPR_FLOOR), ceiling);
  if (cooldown > 0) return clamped;
  if (frameEma > STEP_DOWN_FRAME_SECONDS) return Math.max(DPR_FLOOR, clamped - DPR_STEP);
  if (frameEma < STEP_UP_FRAME_SECONDS && clamped < ceiling) {
    return Math.min(ceiling, clamped + DPR_STEP);
  }
  return clamped;
}

export type BloomBudget = { enabled: boolean; goodWindows: number; cooldown: number };

/** Bloom is optional. Earn it with 3 healthy windows; shed it immediately on
 * sustained overload, and wait 10 seconds before attempting it again. */
export function nextBloomBudget(state: BloomBudget, frameSeconds: number, eligible: boolean): BloomBudget {
  if (!eligible) return { enabled: false, goodWindows: 0, cooldown: 0 };
  const cooldown = Math.max(0, state.cooldown - QUALITY_WINDOW_SECONDS);
  if (frameSeconds > STEP_DOWN_FRAME_SECONDS) return { enabled: false, goodWindows: 0, cooldown: state.enabled ? 10 : cooldown };
  const goodWindows = frameSeconds < EFFECT_UP_FRAME_SECONDS ? Math.min(3, state.goodWindows + 1) : 0;
  return { enabled: state.enabled || (goodWindows >= 3 && cooldown === 0), goodWindows, cooldown };
}
