import { describe, expect, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { dampClimbAtCeiling } from "../FlightPhysics";
import { ALT_CEILING, ALT_CEILING_FADE, ALT_HIGH, BIRD_RADIUS, PHYS_DT, ZENITH_THERMAL_VY } from "../constants";

const START_ALT = ALT_HIGH - 20;

/** Fly with a sustained updraft of `accel` m/s² for `seconds`, and report the
 *  highest altitude reached. This models a thermal column: Weather.ts adds
 *  `bird.vy += 24 * dt` on every frame the bird is inside one.
 *
 *  Horizontal speed is pinned to zero on purpose. Altitude is measured against
 *  the terrain directly beneath the bird, and this world is islands and ocean
 *  drops — a bird gliding level over a cliff gains altitude without climbing at
 *  all. Holding x still keeps the ground under it fixed, so the number read here
 *  is a real climb and nothing else. */
function rideUpdraft(accel: number, seconds: number, startVy = 0) {
  const terrain = new TerrainSystem("ceiling-seed");
  const bird = new Bird();
  const x = 400;
  const ground = terrain.heightAt(x);
  bird.reset(x, ground + START_ALT + BIRD_RADIUS);
  bird.grounded = false;
  bird.vx = 0;
  bird.vy = startVy;
  let peak = bird.altitude;
  for (let t = 0; t < seconds; t += PHYS_DT) {
    bird.vy += accel * PHYS_DT;
    bird.step(PHYS_DT, { diving: false, fever: false, speedMult: 1, boost: false }, terrain);
    peak = Math.max(peak, bird.y - ground - BIRD_RADIUS);
  }
  bird.dispose();
  terrain.dispose();
  return peak;
}

describe("altitude ceiling", () => {
  it("leaves a climb below the fade band completely alone", () => {
    const fadeStart = ALT_CEILING - ALT_CEILING_FADE;
    for (const alt of [0, 30, ALT_HIGH, fadeStart]) {
      expect(dampClimbAtCeiling(90, alt), `alt ${alt}`).toBe(90);
    }
  });

  it("bleeds a climb away across the fade band and stops it at the ceiling", () => {
    const fadeStart = ALT_CEILING - ALT_CEILING_FADE;
    const mid = dampClimbAtCeiling(90, fadeStart + ALT_CEILING_FADE / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(90);
    expect(dampClimbAtCeiling(90, ALT_CEILING)).toBe(0);
    expect(dampClimbAtCeiling(90, ALT_CEILING + 500)).toBe(0);
  });

  it("never touches descent or level flight", () => {
    for (const alt of [0, ALT_HIGH, ALT_CEILING, ALT_CEILING * 3]) {
      expect(dampClimbAtCeiling(-40, alt), `alt ${alt}`).toBe(-40);
      expect(dampClimbAtCeiling(0, alt), `alt ${alt}`).toBe(0);
    }
  });

  it("starts damping ABOVE the whole Star Wish band, so stars stay collectable", () => {
    // Stars are placed at ALT_HIGH + 18..72 (Collectibles.ts). If the fade band
    // ever starts inside that range, the climb needed to reach a star is damped
    // and the reward becomes unreachable while looking perfectly fine in code.
    const highestStar = ALT_HIGH + 72;
    expect(ALT_CEILING - ALT_CEILING_FADE).toBeGreaterThan(highestStar);
  });

  it("holds a sustained updraft inside the ceiling", () => {
    // The reported bug: a thermal column plus reduced gravity sent the bird
    // thousands of units up, past the cloud deck and out of the camera's range.
    // A column this strong is far beyond any shipping thermal.
    expect(rideUpdraft(24, 30)).toBeLessThanOrEqual(ALT_CEILING + 1);
  });

  it("holds even the Zenith super-lift at its cap inside the ceiling", () => {
    // pvp_zenith drives vy toward ZENITH_THERMAL_VY every frame inside a
    // thermal. It used to be 180 m/s — 1.5x the bird's own top speed.
    expect(rideUpdraft(25, 30, ZENITH_THERMAL_VY)).toBeLessThanOrEqual(ALT_CEILING + 1);
  });

  it("lets a strong launch comfortably reach the Star Wish band", () => {
    // The ceiling must not have made stars unreachable. A launch off a ramp at
    // the bird's own top speed, gliding, should carry past the band's top.
    const peak = rideUpdraft(0, 20, 105);
    expect(peak).toBeGreaterThan(ALT_HIGH + 72);
  });
});
