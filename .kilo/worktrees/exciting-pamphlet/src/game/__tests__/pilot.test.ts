import { describe, expect, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT } from "../constants";
import { decideHold } from "../pilot";

/**
 * Attract-mode pilot invariants: the menu backdrop flies the real sim, so
 * the pilot must make progress, obey physics, and stay deterministic.
 * Pure math like physics.test.ts — no renderer needed.
 */

function slopeAt(terrain: TerrainSystem, wantDown: boolean): number {
  for (let x = 64; x < 4000; x += 0.5) {
    const s = terrain.slopeAt(x);
    if (wantDown ? s < -0.2 : s > 0.2) return x;
  }
  throw new Error("no slope found");
}

function flyDemo(seed: string, seconds: number): Bird {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    bird.step(PHYS_DT, { diving: decideHold(bird, terrain), fever: false, speedMult: 1, boost: false }, terrain);
  }
  terrain.dispose();
  return bird;
}

describe("attract pilot decisions", () => {
  it("dives on downslopes and releases on steep climbs while grounded", () => {
    const terrain = new TerrainSystem("2026-09-14");
    const bird = new Bird();
    const downX = slopeAt(terrain, true);
    bird.reset(downX, terrain.heightAt(downX) + 0.9);
    bird.grounded = true;
    bird.vx = 30;
    expect(decideHold(bird, terrain)).toBe(true);
    const upX = slopeAt(terrain, false);
    bird.reset(upX, terrain.heightAt(upX) + 0.9);
    bird.grounded = true;
    bird.vx = 30;
    bird.vy = 0;
    expect(decideHold(bird, terrain)).toBe(false);
    terrain.dispose();
  });
});

describe("attract pilot over water", () => {
  it("soars instead of diving into a drink it cannot clear", () => {
    const terrain = new TerrainSystem("2026-09-14");
    // Mid-ocean, low and slow: diving splashes inside the horizon while
    // soaring stays dry past it — ranked clean > dry miss > splash.
    for (const p of [
      { x: 1000, y: 6, vx: 25, vy: -4 },
      { x: 995, y: 8, vx: 30, vy: -5 },
      { x: 1010, y: 5, vx: 22, vy: -3 },
    ]) {
      const bird = new Bird();
      bird.reset(p.x, p.y);
      bird.vx = p.vx;
      bird.vy = p.vy;
      bird.grounded = false;
      expect(decideHold(bird, terrain)).toBe(false);
    }
    terrain.dispose();
  });
});

describe("attract pilot flights", () => {
  it("makes forward progress without NaN", () => {
    const bird = flyDemo("2026-09-14", 15);
    expect(bird.x).toBeGreaterThan(900);
    for (const v of [bird.x, bird.y, bird.vx, bird.vy]) expect(Number.isFinite(v)).toBe(true);
  });

  it("is deterministic on the same seed", () => {
    const a = flyDemo("2026-09-14", 8);
    const b = flyDemo("2026-09-14", 8);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });
});
