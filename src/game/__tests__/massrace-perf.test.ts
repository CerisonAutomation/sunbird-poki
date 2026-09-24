import { describe, expect, it } from "vitest";
import { MassRace } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";

/**
 * PVP frame-budget guard: the 40-bird rival field must stay far under the
 * 8.3 ms frame budget so the player's own 120 Hz step + render keep their
 * share. Measured on a CI-class Node; the cap has ~10x slack to CI numbers
 * so it catches drift without flaking (same method as physics-perf.test.ts).
 *
 * This is the benchmark that proves the PVP performance pass: every
 * optimization lands here with before/after numbers in the commit message.
 */

const SEED = "2026-09-16";

function makeField(rivals = 40): { terrain: TerrainSystem; mr: MassRace } {
  const terrain = new TerrainSystem(SEED);
  const mr = new MassRace();
  mr.spawn(rivals, `${SEED}:pvp_sprint:${rivals}`, terrain, 0);
  return { terrain, mr };
}

function bench(rivals: number, seconds: number): number {
  const { terrain, mr } = makeField(rivals);
  const N = Math.floor(seconds * 60);
  // Warm the JIT (same policy as physics-perf).
  for (let i = 0; i < N / 4; i++) mr.step(1 / 60, terrain, 1500, i / 60, 300 + i * 0.8, 20);
  const t0 = performance.now();
  for (let i = 0; i < N; i++) mr.step(1 / 60, terrain, 1500, (N / 4 + i) / 60, 300 + i * 0.8, 20);
  const msPerFrame = (performance.now() - t0) / N;
  terrain.dispose();
  return msPerFrame;
}

describe("PVP rival-field frame budget", () => {
  it("40 rivals stay far under the 8.3 ms frame budget", () => {
    const msPerFrame = bench(40, 5);
    // Hard cap with ~10x slack to the measured CI number below.
    expect(msPerFrame).toBeLessThan(4);
    // Loud enough to notice in the log: prints the measured cost.
    console.log(`[bench] 40 rivals: ${msPerFrame.toFixed(3)} ms/frame`);
  }, 30_000);

  it("the field is cheap even when the pack is dense around the player", () => {
    // Dense pack: every rival within draft range of the player (worst case
    // for the per-frame draft + proximity work).
    const { terrain, mr } = makeField(40);
    for (const r of mr.rivals) r.bird.x = 100;
    for (const r of mr.rivals) r.bird.y = 18;
    const N = 300;
    for (let i = 0; i < N / 4; i++) mr.step(1 / 60, terrain, 1500, i / 60, 105, 18);
    const t0 = performance.now();
    for (let i = 0; i < N; i++) mr.step(1 / 60, terrain, 1500, (N / 4 + i) / 60, 105, 18);
    const msPerFrame = (performance.now() - t0) / N;
    terrain.dispose();
    expect(msPerFrame).toBeLessThan(4);
    console.log(`[bench] 40 rivals dense pack: ${msPerFrame.toFixed(3)} ms/frame`);
  }, 30_000);

  it("standings/roster/name-tags stay cheap per call", () => {
    const { terrain, mr } = makeField(40);
    for (let i = 0; i < 60; i++) mr.step(1 / 60, terrain, 1500, i / 60, 100, 20);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) {
      mr.standings(100 + (i % 37), 0, "You", 40);
      mr.roster(100 + (i % 37), 0, 1500, "You");
      mr.getVisibleNameTags(100 + (i % 37), 100 + (i % 37), 18, 0);
    }
    const msPerTriple = (performance.now() - t0) / 2000;
    terrain.dispose();
    expect(msPerTriple).toBeLessThan(0.5);
    console.log(`[bench] standings+roster+nametags: ${(msPerTriple * 1000).toFixed(2)} µs/triple`);
  }, 30_000);
});
