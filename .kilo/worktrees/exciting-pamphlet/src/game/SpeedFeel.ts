/**
 * Speed feel — the one place that turns velocity into sensation.
 *
 * Sunbird already moved fast on paper: the bird accelerates down a slope, the
 * camera pulls back, the FOV widens, speed lines fade in. What it lacked was a
 * shared *curve*. Each effect invented its own threshold, so they arrived at
 * unrelated moments and the flight read as "busy" rather than "accelerating".
 *
 * This module defines the bands once and exports pure functions the camera,
 * the HUD, the particle system and the audio layer all consume:
 *
 *   cruise (0.45) → the flight is comfortable, effects stay out of the way
 *   rush   (0.72) → streaks, vignette and whoosh start to lean in
 *   warp   (0.90) → the tunnel effect: max streaks, vignette, dive FOV kick
 *
 * Every export is a pure function of scalars (normalised speed, vertical
 * velocity, frame-time EMA) with no DOM, no three.js and no game state, so the
 * whole feel of the game can be unit-tested and re-tuned in one file.
 *
 * Contract for callers:
 *   - effects must ramp, never pop (use `warpT` for continuous intensity)
 *   - one-off celebrations must be hysteresis-gated (`weeCheck`)
 *   - weak devices lose particles, never frames (`fxScale`)
 */

/** Normalised-speed bands. `speedNorm` is `bird.speed() / MAX_SPEED`, 0..1.2.
 * TUNED 2026-09-24: lowered so 118 max still feels fast early — cruise 0.40 (was 0.45),
 * rush 0.65 (was 0.72), warp 0.82 (was 0.90). More time in rush/warp = more fun. */
export const SPEED_BANDS = {
  /** Below this the flight reads as a glide: no speed FX. */
  cruise: 0.4,
  /** Above this the player is committed: streaks + vignette lean in. */
  rush: 0.65,
  /** Above this the world tunnels: everything is at or near maximum. */
  warp: 0.82,
} as const;

/** Discrete band index, for callers that need a state (e.g. HUD classes). */
export type WarpLevel = 0 | 1 | 2 | 3;

/** Extra FOV degrees at full dive power. */
const DIVE_KICK_MAX = 6;
/** Vertical speed (units/s) that counts as a full-power dive. */
const DIVE_KICK_REF = 26;
/** Downward speed required before a WEE celebration is allowed. */
export const WEE_MIN_DIVE = 10;
/** Normalised speed that fires a WEE (above the warp band, so it is rare). */
export const WEE_FIRE_ABOVE = 0.95;
/** Normalised speed the trigger must fall below before it can fire again. */
export const WEE_ARM_BELOW = 0.78;

// `<= 0` (not `< 0`) so a negative-zero input normalises to +0: these values
// are handed straight to CSS and three.js, where -0 is legal but noisy.
const clamp01 = (v: number) => (v <= 0 ? 0 : v > 1 ? 1 : v);

/**
 * Continuous 0..1 progress from the cruise band to the warp band. This is the
 * single ramp every speed effect multiplies into, which is what makes them
 * arrive together instead of fighting each other.
 */
export function warpT(speedNorm: number): number {
  if (!Number.isFinite(speedNorm)) return 0;
  return clamp01((speedNorm - SPEED_BANDS.cruise) / (SPEED_BANDS.warp - SPEED_BANDS.cruise));
}

/** Discrete band: 0 glide, 1 cruise, 2 rush, 3 warp. */
export function warpLevel(speedNorm: number): WarpLevel {
  if (!Number.isFinite(speedNorm)) return 0;
  if (speedNorm >= SPEED_BANDS.warp) return 3;
  if (speedNorm >= SPEED_BANDS.rush) return 2;
  if (speedNorm >= SPEED_BANDS.cruise) return 1;
  return 0;
}

/**
 * Extra FOV degrees from diving while fast. Falling is where players *feel*
 * acceleration, but a plain speed ramp cannot show it — the lens can. Zero when
 * climbing or slow, up to `DIVE_KICK_MAX` at a full-power dive above the rush
 * band, and always scaled by `warpT` so a dive from a standstill stays calm.
 */
export function diveKick(verticalSpeed: number, speedNorm: number): number {
  if (!Number.isFinite(verticalSpeed) || !Number.isFinite(speedNorm)) return 0;
  const dive = clamp01(-verticalSpeed / DIVE_KICK_REF);
  return dive * warpT(speedNorm) * DIVE_KICK_MAX;
}

/**
 * HUD speed-line opacity. Starts a little below the cruise band (so lines
 * arrive as the flight commits, not after) and saturates at 0.85 rather than 1:
 * a fully opaque streak layer hides the terrain the player is aiming at.
 */
export function streakOpacity(speedNorm: number): number {
  const t = clamp01((speedNorm - 0.42) / 0.52);
  return 0.85 * Math.pow(t, 1.3);
}

/**
 * Warp vignette intensity (0..1, consumed as a CSS opacity). Darkening the
 * frame edges is the cheapest tunnel-vision cue there is, and it reads as speed
 * rather than as damage — so it is gated to the rush band and above.
 */
export function vignetteIntensity(speedNorm: number): number {
  const t = clamp01((speedNorm - SPEED_BANDS.rush + 0.06) / (1.05 - SPEED_BANDS.rush));
  return 0.55 * Math.pow(t, 1.2);
}

/**
 * Afterimage / trail alpha for the bird mesh. Only meaningful in the top band:
 * below it a ghost trail reads as a rendering bug rather than as speed.
 */
export function afterimageAlpha(speedNorm: number): number {
  return 0.3 * clamp01((speedNorm - 0.8) / 0.3);
}

/** Whoosh cadence + pitch multiplier for the speed layer (1..2.2). */
export function whooshRate(speedNorm: number): number {
  return 1 + 1.2 * warpT(speedNorm);
}

/**
 * Particle-budget multiplier from the frame-time EMA. The rule: a slow device
 * loses *particles*, never frames and never gameplay. The steps match the DPR
 * ladder in `quality.ts` (38/48/58 fps) so the two budgets degrade together.
 */
export function fxScale(frameEmaSeconds: number): number {
  if (!Number.isFinite(frameEmaSeconds) || frameEmaSeconds <= 0) return 1;
  if (frameEmaSeconds > 1 / 38) return 0.45;
  if (frameEmaSeconds > 1 / 48) return 0.7;
  if (frameEmaSeconds > 1 / 58) return 0.88;
  return 1;
}

/** Hysteresis state for one-off speed celebrations. */
export type WeeState = { armed: boolean };

export const WEE_IDLE: WeeState = { armed: true };

/**
 * WEE trigger: fires once when the player hits warp speed *while diving*, then
 * disarms until speed falls back below the rush band. Hysteresis matters — the
 * celebration is a punctuation mark, and a machine gun of them teaches the
 * player to ignore every popup in the game.
 */
export function weeCheck(state: WeeState, speedNorm: number, verticalSpeed: number): { fire: boolean; state: WeeState } {
  if (!Number.isFinite(speedNorm) || !Number.isFinite(verticalSpeed)) return { fire: false, state };
  if (!state.armed) {
    // Re-arm only once the flight has genuinely slowed down again.
    return speedNorm < WEE_ARM_BELOW ? { fire: false, state: { armed: true } } : { fire: false, state };
  }
  const fire = speedNorm >= WEE_FIRE_ABOVE && -verticalSpeed >= WEE_MIN_DIVE;
  return fire ? { fire: true, state: { armed: false } } : { fire: false, state };
}
