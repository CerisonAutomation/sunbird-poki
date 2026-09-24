import { Bird } from "./Bird";
import { PHYS_DT } from "./constants";
import type { TerrainSystem } from "./TerrainSystem";

/**
 * Attract-mode pilot — the demo bird that flies behind the main menu.
 *
 * Ported from the standalone prototype's `autopilot(sim)`: on the ground,
 * carve downhill (hold) and release uphill; airborne, speculatively fly both
 * options forward and keep whichever lands cleaner. The speculation runs on
 * the real `Bird.step` with scalar state saved/restored around it, so the
 * demo obeys the exact same physics as the player — no scripted paths.
 *
 * Pure math, no renderer: safe to unit-test headless (see pilot.test.ts).
 * Side-effect free by construction — it never touches audio, HUD, saves,
 * or telemetry. Game.ts calls it from menuTick only.
 */

/** Longest speculative flight per option (2.5 s at 120 Hz). */
const LOOKAHEAD_STEPS = 300;
/**
 * Progress weight: landing quality alone lands the bird on the nearest
 * soft bench — including the dead-end bench before a wall. Valuing each
 * travelled unit at 1/400 of a quality point keeps normal play (land soft,
 * stay fast) while letting a far soar outrank a nearby touchdown, which is
 * what carries the demo over oceans and island-boundary walls.
 */
const DISTANCE_WEIGHT = 1 / 400;

export function decideHold(bird: Bird, terrain: TerrainSystem): boolean {
  if (bird.grounded) {
    // Carve the descent, release the climb — and tuck whenever slow: the
    // dive sticks through crests (measured farther on every test seed),
    // which is what turns rolling into the next launch.
    const slope = terrain.slopeAt(bird.x);
    return slope < 0.15 || bird.speed() < 16;
  }
  // Airborne, decided fresh every physics step: speculatively fly both
  // options forward and keep whichever scores higher. Ranking: clean
  // landing (0..1) > still soaring at the horizon (-1) > splash (-2), each
  // plus travelled distance — so the pilot skims over water it can't clear
  // instead of diving into it. When both options splash inside the horizon,
  // soar anyway: staying up longer travels farther toward the far shore
  // (and looks better doing it). Replanning every step (not cached)
  // measured ~3x farther — a stale hold dives into hills.
  const dive = predictLanding(bird, terrain, true);
  const soar = predictLanding(bird, terrain, false);
  if (dive.q === -2 && soar.q === -2) return false;
  const travelled = (p: { q: number; endX: number }): number => p.q + (p.endX - bird.x) * DISTANCE_WEIGHT;
  return travelled(dive) >= travelled(soar);
}

type BirdSnap = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  wasGrounded: boolean;
  impact: number;
  rotation: number;
  launchSlope: number;
  launchSpeed: number;
  airTime: number;
  apexY: number;
  altitude: number;
  landingQuality: number;
  landingKeep: number;
  justLanded: boolean;
  justLaunched: boolean;
  bounced: boolean;
  bounceCd: number;
  inWater: boolean;
};

function snapshot(b: Bird): BirdSnap {
  return {
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    grounded: b.grounded,
    wasGrounded: b.wasGrounded,
    impact: b.impact,
    rotation: b.rotation,
    launchSlope: b.launchSlope,
    launchSpeed: b.launchSpeed,
    airTime: b.airTime,
    apexY: b.apexY,
    altitude: b.altitude,
    landingQuality: b.landingQuality,
    landingKeep: b.landingKeep,
    justLanded: b.justLanded,
    justLaunched: b.justLaunched,
    bounced: b.bounced,
    bounceCd: b.bounceCd,
    inWater: b.inWater,
  };
}

function restore(b: Bird, s: BirdSnap): void {
  b.x = s.x;
  b.y = s.y;
  b.vx = s.vx;
  b.vy = s.vy;
  b.grounded = s.grounded;
  b.wasGrounded = s.wasGrounded;
  b.impact = s.impact;
  b.rotation = s.rotation;
  b.launchSlope = s.launchSlope;
  b.launchSpeed = s.launchSpeed;
  b.airTime = s.airTime;
  b.apexY = s.apexY;
  b.altitude = s.altitude;
  b.landingQuality = s.landingQuality;
  b.landingKeep = s.landingKeep;
  b.justLanded = s.justLanded;
  b.justLaunched = s.justLaunched;
  b.bounced = s.bounced;
  b.bounceCd = s.bounceCd;
  b.inWater = s.inWater;
}

function predictLanding(bird: Bird, terrain: TerrainSystem, diving: boolean): { q: number; endX: number } {
  const s = snapshot(bird);
  let q = -1;
  for (let i = 0; i < LOOKAHEAD_STEPS; i++) {
    bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
    if (bird.inWater) {
      q = -2;
      break;
    }
    if (bird.grounded) {
      q = bird.landingQuality;
      break;
    }
  }
  const endX = bird.x;
  restore(bird, s);
  return { q, endX };
}

/** Expensive airborne planning is cached for at most 1/15 s while high up.
 * Close to the surface (or after a reset) replan immediately so landing timing
 * retains the exact policy. This is menu-only; player physics stays at 120 Hz. */
export class AttractPilot {
  private remaining = 0;
  private hold = false;
  private lastX = -Infinity;
  constructor(private readonly decide = decideHold) {}

  reset(): void { this.remaining = 0; this.lastX = -Infinity; }

  update(dt: number, bird: Bird, terrain: TerrainSystem): boolean {
    this.remaining -= dt;
    const nearGround = bird.y - terrain.heightAt(bird.x + Math.max(0, bird.vx) * 0.12) < 14;
    if (bird.grounded || nearGround || this.remaining <= 0 || Math.abs(bird.x - this.lastX) > 20) {
      this.hold = this.decide(bird, terrain);
      this.remaining = 1 / 15;
      this.lastX = bird.x;
    }
    return this.hold;
  }
}
