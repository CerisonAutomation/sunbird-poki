/**
 * Resolution-stepping policy for the adaptive quality loop.
 *
 * Kept pure and dependency-free so it can be unit-tested without a WebGL
 * context: Game.ts imports Three.js and the whole game, which is far too heavy
 * to pull into a test just to exercise an arithmetic decision.
 */

/** Frame time above this means the 60 fps budget is blown: step down.
 *  Tightened from 1/40 to 1/50 (2026-10-04 "max fps" directive): at 1/40 a
 *  device could sit at 41-45 fps forever without ever shedding resolution —
 *  technically stable, visibly not the 60 the game is tuned for. 1/50 means
 *  the ladder reacts to any frame rate the player can actually perceive as
 *  below target, and trades a quarter step of resolution for it. */
export const STEP_DOWN_FRAME_SECONDS = 1 / 50;
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

export type EffectBudget = {
  /** Whether soft shadows are drawn. */
  shadows: boolean;
  /** Particle density, 0.3..1. */
  particles: number;
  /** Healthy windows observed in a row — the earn-it-back counter. */
  goodWindows: number;
};

/** Lowest particle density we will drop to; below this the game stops
 * communicating (no impact dust, no perfect-launch burst). */
export const PARTICLE_FLOOR = 0.3;
/** How much particle density one window of overload sheds, or one window of
 * headroom restores. */
export const PARTICLE_STEP = 0.2;
/** Healthy windows required before an effect is re-armed. At
 * QUALITY_WINDOW_SECONDS = 2.5 s that is 7.5 s of consistently good frames,
 * so a lull between two hard moments cannot flip effects back on. */
export const EFFECT_RECOVERY_WINDOWS = 3;

/**
 * Decide the next soft-shadow and particle budget.
 *
 * This is the half of `adaptQuality()` that was still a one-way ratchet.
 * `nextDpr` above was written specifically to stop "a single bad moment
 * permanently degrading the rest of the session" — and then, twenty lines
 * below it in `Game.ts`, shadows and particles did exactly that, because the
 * branch that restores them was gated on `!isMobile && tier !== "lite"`:
 *
 *     } else if (frameEma < EFFECT_UP && !this.isMobile && tier !== "lite"
 *                && this.renderer.shadowMap.enabled === false) {
 *
 * Shadows start ON for every device except `lite` and software rendering —
 * including mid-range phones. So on a phone, one slow 2.5-second window (an
 * ad tearing down, a thermal blip, a tab regaining focus) shed the shadows and
 * dropped particles by 20 %, permanently, for the rest of the session. Hit
 * four such windows and the player finished at the particle floor with no
 * shadows on hardware that could have run both. Mobile is the majority of
 * Poki's traffic, so the platform that most needed adaptation was the only one
 * that could never recover from it.
 *
 * Restoration is now available to every device, and is deliberately harder to
 * earn than it is to lose: one bad window sheds immediately,
 * `EFFECT_RECOVERY_WINDOWS` consecutive good ones restore one step. Particles
 * and shadows are also decoupled — particles are the game's feedback language
 * and cost far less than a shadow pass, so they come back first.
 */
export function nextEffectBudget(
  state: EffectBudget,
  frameSeconds: number,
  opts: { shadowsAllowed: boolean; particleCeiling: number },
): EffectBudget {
  // Recovery restores what the device was *configured* for, not an absolute 1.
  // Mobile deliberately runs a lighter decorative stream (0.5) by default and
  // "low" quality pins 0.3; a ladder that climbed to 1 regardless would undo
  // the setting the moment the frame looked healthy, which is a slower and
  // more confusing version of the bug this function exists to fix.
  const ceiling = Math.max(PARTICLE_FLOOR, Math.min(1, opts.particleCeiling));
  // A device that may never draw shadows (software renderer, `lite` tier) is
  // not "degraded" for not having them; it just never had them.
  const shadows = opts.shadowsAllowed && state.shadows;

  if (frameSeconds > STEP_DOWN_FRAME_SECONDS) {
    return {
      // Shed the cheaper thing first is tempting, but a blown budget needs
      // the expensive thing gone now: the shadow pass is a whole extra draw.
      shadows: false,
      particles: shadows ? state.particles : Math.max(PARTICLE_FLOOR, state.particles - PARTICLE_STEP),
      goodWindows: 0,
    };
  }

  if (frameSeconds >= EFFECT_UP_FRAME_SECONDS) {
    // Inside budget but not comfortably: hold, and do not accumulate credit.
    return { shadows, particles: state.particles, goodWindows: 0 };
  }

  const goodWindows = state.goodWindows + 1;
  if (goodWindows < EFFECT_RECOVERY_WINDOWS) {
    return { shadows, particles: state.particles, goodWindows };
  }
  // Earned a step back. Particles first — they are what the player reads.
  if (state.particles < ceiling) {
    return { shadows, particles: Math.min(ceiling, state.particles + PARTICLE_STEP), goodWindows: 0 };
  }
  if (opts.shadowsAllowed && !shadows) {
    return { shadows: true, particles: state.particles, goodWindows: 0 };
  }
  return { shadows, particles: state.particles, goodWindows };
}
