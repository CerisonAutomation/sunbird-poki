import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { Bird } from "../Bird";
import { CameraRig } from "../CameraRig";
import { TerrainSystem } from "../TerrainSystem";
import { gapEndFor } from "../Biomes";
import { DROP_BLEND_START, DROP_START, RAMP_START, GAP_START, ISLAND_PERIOD, PHYS_DT } from "../constants";

const seeds = ["2026-09-15", "wild-drop", "tiny-wings"];

describe("island transfer", () => {
  it.each(seeds)("has a long, monotonic drop and a clean ramp (%s)", (seed) => {
    const terrain = new TerrainSystem(seed);
    for (const island of [0, 1, 8, 20, 100]) {
      const base = island * ISLAND_PERIOD;
      expect(terrain.heightAt(base + DROP_START) - terrain.heightAt(base + RAMP_START)).toBeGreaterThan(60);
      for (let x = DROP_START + 1; x < RAMP_START - 1; x += 2) expect(terrain.slopeAt(base + x)).toBeLessThan(0);
      for (let x = RAMP_START + 1; x < GAP_START - 1; x += 2) expect(terrain.slopeAt(base + x)).toBeGreaterThan(0);
      expect(gapEndFor(island)).toBeLessThan(ISLAND_PERIOD);
      for (const edge of [DROP_BLEND_START, DROP_START, RAMP_START, GAP_START, gapEndFor(island), ISLAND_PERIOD]) {
        // Subtract the expected rise across the sample: a steep continuous
        // slope is fine; a position jump or broken tangent is not.
        const rise = terrain.heightAt(base + edge + 0.125) - terrain.heightAt(base + edge - 0.125);
        expect(Math.abs(rise - terrain.slopeAt(base + edge) * 0.25)).toBeLessThan(0.04);
        expect(Math.abs(terrain.slopeAt(base + edge + 0.125) - terrain.slopeAt(base + edge - 0.125))).toBeLessThan(0.18);
      }
    }
    // The tutorial used to stop blending ten units before its weight reached zero.
    expect(Math.abs(terrain.heightAt(260.125) - terrain.heightAt(259.875))).toBeLessThan(0.5);
    terrain.dispose();
  });

  it.each(seeds)("rewards a downhill hold with enough momentum to cross (%s)", (seed) => {
    const terrain = new TerrainSystem(seed);
    for (const island of [0, 1, 8, 20]) {
      const base = island * ISLAND_PERIOD;
      const bird = new Bird();
      bird.reset(base + DROP_START + 2, terrain.heightAt(base + DROP_START + 2) + 0.9);
      bird.grounded = true;
      bird.vx = 24;
      let fastest = 0;
      let launched = false;
      let splashed = false;
      for (let tick = 0; tick < 15 / PHYS_DT && bird.x < base + ISLAND_PERIOD; tick++) {
        const previousX = bird.x;
        bird.step(PHYS_DT, { diving: terrain.localX(bird.x) < RAMP_START, fever: false, speedMult: 1, boost: false }, terrain);
        expect(bird.x).toBeGreaterThanOrEqual(previousX);
        fastest = Math.max(fastest, bird.speed());
        launched ||= bird.justLaunched;
        splashed ||= bird.inWater;
      }
      expect(fastest).toBeGreaterThan(95);
      expect(launched).toBe(true);
      expect(splashed).toBe(false);
      expect(bird.x).toBeGreaterThanOrEqual(base + ISLAND_PERIOD);
      bird.dispose();
    }
    terrain.dispose();
  });

  it("height-cache bins are independent of query order across pilots", () => {
    const a = new TerrainSystem("cache");
    const b = new TerrainSystem("cache");
    a.heightAt(745.001);
    b.heightAt(745.006);
    expect(a.heightAt(745)).toBe(b.heightAt(745));
    a.dispose(); b.dispose();
  });
});

describe("high-flight framing", () => {
  it.each([16 / 9, 390 / 844, 844 / 390, 0.75])("keeps both bird and landing ground inside the view at aspect %s", (aspect) => {
    const rig = new CameraRig(aspect);
    const bird = new Bird();
    bird.reset(400, 20);
    rig.snapTo(bird);
    for (const reduceMotion of [false, true]) {
      rig.setReduceMotion(reduceMotion);
      for (const altitude of [60, 135, 230, 400]) {
        bird.y = 16 + altitude;
        bird.altitude = altitude;
        bird.vx = 80;
        bird.vy = -45;
        for (let i = 0; i < 180; i++) rig.update(1 / 60, bird, true, 16);
        for (const point of [new Vector3(bird.x, bird.y, 0), new Vector3(bird.x + 55, 16, 0)]) {
          point.project(rig.camera);
          expect(Math.abs(point.y)).toBeLessThan(0.85);
          expect(Math.abs(point.x)).toBeLessThan(0.95);
        }
      }
    }
    bird.dispose();
  });

  it("keeps the ground visible during a continuous climb and descent", () => {
    const rig = new CameraRig(390 / 844);
    const bird = new Bird();
    bird.reset(400, 20);
    bird.vx = 65;
    rig.snapTo(bird);
    for (let i = 0; i < 600; i++) {
      const t = i / 60;
      bird.x += bird.vx / 60;
      bird.altitude = Math.max(0, 90 * t - 9 * t * t);
      bird.y = 16 + bird.altitude;
      bird.vy = 90 - 18 * t;
      rig.update(1 / 60, bird, true, 16);
      if (bird.altitude > 55) {
        const ground = new Vector3(bird.x + 35, 16, 0).project(rig.camera);
        const subject = new Vector3(bird.x, bird.y, 0).project(rig.camera);
        expect(Math.abs(ground.y)).toBeLessThan(0.95);
        expect(Math.abs(subject.y)).toBeLessThan(0.95);
      }
    }
    bird.dispose();
  });
});
