import {
  COMBO_GRACE,
  LAUNCH_BOOST_GOOD,
  LAUNCH_BOOST_GREAT,
  LAUNCH_BOOST_PERFECT,
  LAUNCH_COMBO_MAX,
  LAUNCH_COMBO_STEP,
  LAUNCH_MIN_SPEED,
  LAUNCH_RELEASE_WINDOW,
  MAX_SPEED,
  RATING_GOOD,
  RATING_GREAT,
  RATING_PERFECT,
} from "./constants";
import { clamp, smoothstep } from "./math";
import type { Bird } from "./Bird";
import type { TerrainSystem } from "./TerrainSystem";

export type LaunchRating = "none" | "good" | "great" | "perfect";

export type LaunchResult = {
  rating: LaunchRating;
  score: number; // 0..1 raw quality
  boost: number; // velocity multiplier applied
  combo: number;
  speed: number;
  slope: number; // steepest ramp climbed on the run-up
};

/**
 * Rates a take-off the instant the bird leaves the ground.
 *
 * Quality blends four things the player can actually feel:
 *   speed    — did you carve the valley hard enough to be worth launching?
 *   ramp     — did you climb a real ramp, or just drift off a bump?
 *   release  — did you let go just before the lip, or ride it flat?
 *   arc      — is the outgoing angle converting speed into height?
 *
 * Nothing is random: the same approach always earns the same rating.
 */
export class LaunchSystem {
  combo = 0;
  best = 0;
  perfects = 0;
  greats = 0;
  goods = 0;
  last: LaunchResult | null = null;
  private comboTimer = 0;
  private releaseAt = -1;
  private wasDiving = false;

  reset(): void {
    this.combo = 0;
    this.best = 0;
    this.perfects = 0;
    this.greats = 0;
    this.goods = 0;
    this.last = null;
    this.comboTimer = 0;
    this.releaseAt = -1;
    this.wasDiving = false;
  }

  /** Call every physics step, before the bird integrates. */
  observeInput(diving: boolean, time: number): void {
    if (this.wasDiving && !diving) this.releaseAt = time;
    this.wasDiving = diving;
  }

  tick(dt: number): void {
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  /** A sloppy landing or a swim breaks the chain. */
  breakCombo(): void {
    this.combo = 0;
    this.comboTimer = 0;
  }

  /** Extra launch power earned by the current chain. */
  comboBoost(): number {
    return Math.min(LAUNCH_COMBO_MAX, this.combo * LAUNCH_COMBO_STEP);
  }

  evaluate(bird: Bird, terrain: TerrainSystem, time: number): LaunchResult {
    const speed = bird.launchSpeed || bird.speed();

    // The bird always leaves the ground where the crest turns convex, so the
    // slope *at* take-off is near flat. What matters is the ramp it just
    // climbed and the arc it is now on.
    let ramp = 0;
    for (let d = 4; d <= 36; d += 4) ramp = Math.max(ramp, terrain.slopeAt(bird.x - d));
    const angleOut = Math.atan2(bird.vy, Math.max(1, bird.vx));
    const since = this.releaseAt >= 0 ? time - this.releaseAt : Number.POSITIVE_INFINITY;

    // A launch rating is never awarded for merely blasting over a crest while
    // holding. The player must have released within the readable lip window.
    // This makes GOOD/GREAT/PERFECT learnable and completely deterministic.
    if (speed < LAUNCH_MIN_SPEED || angleOut <= 0.04 || since > LAUNCH_RELEASE_WINDOW) {
      const miss: LaunchResult = { rating: "none", score: 0, boost: 1, combo: this.combo, speed, slope: ramp };
      this.last = miss;
      this.releaseAt = -1;
      return miss;
    }

    const fSpeed = smoothstep(LAUNCH_MIN_SPEED, MAX_SPEED * 0.62, speed);
    const fRamp = clamp(ramp / 0.72, 0, 1);
    // Immediate release is strongest. The taper is gentle enough to reward
    // intent but narrow enough that releasing a valley early is not a trick.
    const fRelease = 1 - Math.pow(clamp(since / LAUNCH_RELEASE_WINDOW, 0, 1), 0.82) * 0.9;
    const fAngle = 1 - clamp(Math.abs(angleOut - 0.62) / 0.58, 0, 1);

    const score = clamp(fSpeed * 0.28 + fRamp * 0.24 + fRelease * 0.3 + fAngle * 0.18, 0, 1);

    let rating: LaunchRating = "none";
    let boost = 1;
    if (score >= RATING_PERFECT) {
      rating = "perfect";
      boost = LAUNCH_BOOST_PERFECT + this.comboBoost();
    } else if (score >= RATING_GREAT) {
      rating = "great";
      boost = LAUNCH_BOOST_GREAT + this.comboBoost() * 0.5;
    } else if (score >= RATING_GOOD) {
      rating = "good";
      boost = LAUNCH_BOOST_GOOD;
    }

    if (rating === "perfect" || rating === "great") {
      this.combo += 1;
      this.comboTimer = COMBO_GRACE;
      this.best = Math.max(this.best, this.combo);
    } else if (rating === "none") {
      this.breakCombo();
    }
    if (rating === "perfect") this.perfects += 1;
    else if (rating === "great") this.greats += 1;
    else if (rating === "good") this.goods += 1;

    if (boost > 1) {
      bird.vx *= boost;
      bird.vy *= boost;
      // A clean lip also converts a slice of speed straight into height —
      // this is what puts the cloud layers within reach of a good chain.
      if (rating === "perfect") bird.vy += 7 + this.combo * 1.4;
      else if (rating === "great") bird.vy += 3;
    }

    this.releaseAt = -1;
    const res: LaunchResult = { rating, score, boost, combo: this.combo, speed, slope: ramp };
    this.last = res;
    return res;
  }
}

export function ratingLabel(r: LaunchRating, combo: number): string {
  if (r === "perfect") return combo >= 2 ? `PERFECT ×${combo}` : "PERFECT!";
  if (r === "great") return combo >= 2 ? `GREAT ×${combo}` : "GREAT!";
  if (r === "good") return "GOOD";
  return "";
}
