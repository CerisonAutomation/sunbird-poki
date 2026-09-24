import { describe, expect, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT } from "../constants";

/**
 * Physics invariants: the same fixed-step contract the player, the 40-bird
 * field and both split-screen racers all rely on. These runs are pure math —
 * no renderer needed (three.js objects tolerate jsdom fine).
 */

function fly(seed: string, policy: (bird: Bird, terrain: TerrainSystem, t: number) => boolean, seconds = 30): Bird {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  let t = 0;
  const steps = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    t += PHYS_DT;
    bird.step(PHYS_DT, { diving: policy(bird, terrain, t), fever: false, speedMult: 1, boost: false }, terrain);
  }
  terrain.dispose();
  return bird;
}

describe("Bird.step determinism", () => {
  it("identical inputs on identical terrain produce identical states", () => {
    const policy = (b: Bird, tr: TerrainSystem): boolean => tr.distanceToCrest(b.x) > 70;
    const a = fly("2026-09-11", policy);
    const b = fly("2026-09-11", policy);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.vx).toBe(b.vx);
    expect(a.vy).toBe(b.vy);
  });

  it("different seeds produce different flights", () => {
    const policy = (b: Bird, tr: TerrainSystem): boolean => tr.distanceToCrest(b.x) > 70;
    const a = fly("2026-09-11", policy);
    const b = fly("2026-09-12", policy);
    expect(a.x).not.toBe(b.x);
  });
});

describe("Bird.step sanity", () => {
  it("a crest-timed pilot makes forward progress", () => {
    const bird = fly("2026-09-11", (b, tr) => tr.distanceToCrest(b.x) > 70, 30);
    expect(bird.x).toBeGreaterThan(200);
  });

  it("crest-timed release beats never diving", () => {
    const skilled = fly("2026-09-11", (b, tr) => tr.distanceToCrest(b.x) > 70, 30);
    const neverDive = fly("2026-09-11", () => false, 30);
    expect(skilled.x).toBeGreaterThan(neverDive.x);
  });

  it("state never goes non-finite", () => {
    const bird = fly("wild-xyz", (b, tr) => tr.distanceToCrest(b.x) > 40, 60);
    for (const v of [bird.x, bird.y, bird.vx, bird.vy, bird.rotation]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("terrain determinism", () => {
  it("heightAt is identical across instances of the same seed", () => {
    const a = new TerrainSystem("2026-09-11");
    const b = new TerrainSystem("2026-09-11");
    for (let x = 0; x < 4000; x += 97) {
      expect(a.heightAt(x)).toBe(b.heightAt(x));
    }
    a.dispose();
    b.dispose();
  });
});
