import { describe, expect, it } from "vitest";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT } from "../constants";

/**
 * Physics performance + long-run determinism regression guard.
 *
 * Why this file exists:
 *  • The 120 Hz fixed step is the backbone of ghosts, replays and the
 *    40-bird field — it must stay CHEAP (frame budget is 8.3 ms) and
 *    BIT-DETERMINISTIC (two runs of the same seed must agree exactly, or
 *    ghost races and server-refereed results drift apart).
 *  • Budgets below are measured (not guessed): ~3.5 µs/step on a CI-class
 *    Node. The 20 µs cap fails ~6x before a real regression becomes
 *    player-visible, so it catches drift without flaking.
 */

const SEED = "2026-09-11";
const policy = (b: Bird, tr: TerrainSystem): boolean => tr.distanceToCrest(b.x) > 70;

function makeFlight(): { terrain: TerrainSystem; bird: Bird } {
  const terrain = new TerrainSystem(SEED);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  return { terrain, bird };
}

function step(terrain: TerrainSystem, bird: Bird): void {
  bird.step(PHYS_DT, { diving: policy(bird, terrain), fever: false, speedMult: 1, boost: false }, terrain);
}

describe("physics performance guard", () => {
  it("stays far under the per-frame budget at 120 Hz", () => {
    const { terrain, bird } = makeFlight();
    // Warm the JIT so cold-start cost doesn't skew the measurement.
    for (let i = 0; i < 1200; i++) step(terrain, bird);
    const N = 12_000; // 100 s of game time
    // Three batches, keep the fastest. Contention on a shared CI runner can
    // only make a batch SLOWER, never faster, so the minimum is the honest
    // estimate of the per-step cost — and a real regression slows every batch,
    // so the guard is exactly as strict (20 µs/step, measured ~3.5). A single
    // batch has no such protection: one noisy neighbour and the gate fails on
    // timing it never measured (seen on CI at 21.7 µs).
    let usPerStep = Infinity;
    for (let batch = 0; batch < 3; batch += 1) {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) step(terrain, bird);
      usPerStep = Math.min(usPerStep, ((performance.now() - t0) / N) * 1000);
    }
    terrain.dispose();
    expect(usPerStep).toBeLessThan(20); // budget: 20 µs/step (measured ~3.5)
  });

  it("two identical 120-second flights are bit-for-bit identical", () => {
    const a = makeFlight();
    const b = makeFlight();
    const steps = 14_400; // 120 s of game time at 120 Hz
    for (let i = 0; i < steps; i++) {
      step(a.terrain, a.bird);
      step(b.terrain, b.bird);
    }
    a.terrain.dispose();
    b.terrain.dispose();
    expect(a.bird.x).toBe(b.bird.x);
    expect(a.bird.y).toBe(b.bird.y);
    expect(a.bird.vx).toBe(b.bird.vx);
    expect(a.bird.vy).toBe(b.bird.vy);
    // A 120 s flight must also still make forward progress (no silent
    // spiral-into-a-wall from a terrain/step change).
    expect(a.bird.x).toBeGreaterThan(500);
  });
});
