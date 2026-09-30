import { biomeForIsland } from "./Biomes";
import { clamp } from "./math";

/** Monotonic, bounded challenge envelope. Biomes vary the feel inside it;
 * neither speed nor slope can grow without limit during a long flight. */
export function flightProgression(island: number): { hillScale: number; rhythmScale: number } {
  const progress = 1 - Math.exp(-Math.max(0, island) / 12);
  return { hillScale: 1 + progress * 0.32, rhythmScale: 1 + progress * 0.24 };
}

/**
 * The asymptote of `endlessSpeedScale`. Exported because the anti-cheat speed
 * ceiling has to be able to name the largest scale this function can ever
 * return; it used to inline its own `0.55` and drift from the real curve.
 */
export const ENDLESS_SPEED_SCALE_MAX = 1.55;

export function endlessSpeedScale(island: number, runSeconds: number): number {
  const pressure = Math.max(0, island) * 0.055 + Math.max(0, runSeconds) / 600;
  return 1 + (ENDLESS_SPEED_SCALE_MAX - 1) * (1 - Math.exp(-pressure));
}

export function terrainDifficulty(requested: number): number {
  // Mirrors FlowTuner.difficulty()'s band (Engagement.ts) — widened from
  // [0.86, 1.16] so beginners actually get gentler terrain and experts get
  // real challenge. Clamping tighter than that band would silently discard
  // the wider range FlowTuner now hands in.
  return Number.isFinite(requested) ? clamp(requested, 0.7, 1.35) : 1;
}

/* ------------------------------------------------ the climb, and the wall */

/**
 * How hard a biome is, on one comparable scale.
 *
 * Every term is a field the flight actually uses, so this cannot drift away
 * from what the player flies: `amp` sets arch height, `roughness` sets surface
 * noise, `lenScale` sets arch length (so its inverse is the difficulty),
 * `hazard` is the storm class, `thermals` and `padSpacing` are the help
 * available, and `chicane` is the wall-face swap.
 */
const HAZARD_WEIGHT: Record<string, number> = { none: 0, gust: 0.5, storm: 1 };

export function biomeDifficulty(island: number): number {
  const b = biomeForIsland(Math.max(0, Math.floor(island)));
  const g = b.terrain;
  return (
    b.amp * 0.9 +
    (b.roughness ?? 0.1) * 1.6 +
    Math.max(0, 1 / g.lenScale - 0.8) * 0.9 +
    (HAZARD_WEIGHT[b.hazard] ?? 0) * 0.85 +
    (1.6 / Math.max(1, b.thermals)) * 0.35 +
    g.padSpacing * 0.12 +
    g.chicane * 0.5
  );
}

/**
 * A step at least this big is a wall, not a slope, and earns a Climb Breaker.
 *
 * Calibrated against the shipped nine: the steps are +0.21, +0.40, +0.13,
 * +0.32, **+0.79**, -0.08, **+0.92**, -0.74. So this catches the two real
 * walls — Dune Sea into Midnight Coast, and Aurora Peaks into Cinder Forge —
 * and leaves the ordinary rising steps alone. It is measured rather than
 * hard-coded per biome, so re-tuning a biome moves the wall with it.
 */
export const CLIMB_STEP_THRESHOLD = 0.45;

/** How much of a Climb Breaker's relief a step earns: 0 at the threshold, 1 at
 *  0.6 past it. A bigger wall buys a bigger hand. */
export const CLIMB_RELIEF_SPAN = 0.6;

export type Climb = {
  /** Difficulty added by entering this island. Negative is a relief island. */
  step: number;
  /** True when the step is a wall the game should help over. */
  large: boolean;
  /** 0..1 — how strong the compensation is. 0 when the step is not a wall. */
  relief: number;
};

/** The step into `island`, and whether the game owes the player a hand for it. */
export function biomeClimb(island: number): Climb {
  const i = Math.max(0, Math.floor(island));
  if (i === 0) return { step: 0, large: false, relief: 0 };
  const step = biomeDifficulty(i) - biomeDifficulty(i - 1);
  const large = step >= CLIMB_STEP_THRESHOLD;
  return {
    step,
    large,
    relief: large ? clamp((step - CLIMB_STEP_THRESHOLD) / CLIMB_RELIEF_SPAN, 0, 1) : 0,
  };
}
