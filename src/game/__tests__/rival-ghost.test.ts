import { describe, expect, it } from "vitest";
import { GHOST_MAX_SAMPLES, GHOST_SAMPLE_DT } from "../constants";
import { paceSkillFor } from "../Engagement";
import { paceName, paceTargetDistance, synthesizePaceGhost, type PaceTerrain } from "../RivalGhost";

/** Rolling hills, analytically differentiated so slope is exact. */
const hills: PaceTerrain = {
  heightAt: (x) => 12 + 7 * Math.sin(x / 90) + 3 * Math.sin(x / 23),
  slopeAt: (x) => (7 / 90) * Math.cos(x / 90) + (3 / 23) * Math.cos(x / 23),
};

/** Flat desert: the degenerate case a generator must not fall over on. */
const flat: PaceTerrain = { heightAt: () => 4, slopeAt: () => 0 };

function make(seed = "today-2026-09-23", distance = 1200, skill = 0.55, terrain: PaceTerrain = hills) {
  return synthesizePaceGhost({ seed, startX: 100, distance, terrain, skill });
}

describe("pace ghost", () => {
  it("is deterministic for a seed — two players chase the identical line", () => {
    const a = make();
    const b = make();
    expect(a.record.samples).toEqual(b.record.samples);
    expect(a.distance).toBe(b.distance);
    expect(a.seconds).toBe(b.seconds);
  });

  it("changes with the seed", () => {
    expect(make("seed-a").record.samples).not.toEqual(make("seed-b").record.samples);
  });

  it("flies close to the requested distance", () => {
    const g = make(undefined, 1500);
    expect(g.distance).toBeGreaterThanOrEqual(1500 * 0.9);
    expect(g.distance).toBeLessThan(1500 * 1.35);
  });

  it("produces a valid, playable record", () => {
    const g = make();
    expect(g.record.samples.length).toBeGreaterThan(4);
    expect(g.record.samples.length).toBeLessThanOrEqual(GHOST_MAX_SAMPLES);
    expect(g.isSynthetic).toBe(true);
    let prevT = -1;
    let prevX = -Infinity;
    for (const [t, x, y, rot] of g.record.samples) {
      for (const n of [t, x, y, rot]) expect(Number.isFinite(n)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(prevT);
      expect(x).toBeGreaterThanOrEqual(prevX);
      expect(Math.abs(rot)).toBeLessThanOrEqual(0.7);
      prevT = t;
      prevX = x;
    }
    // Sampled on the same cadence the recorder uses, so playback is correct.
    expect(g.record.samples[1]![0] - g.record.samples[0]![0]).toBeCloseTo(GHOST_SAMPLE_DT, 2);
  });

  it("stays above the terrain on hills and on flats", () => {
    for (const terrain of [hills, flat]) {
      const g = make("airborne", 900, 0.5, terrain);
      for (const [, x, y] of g.record.samples) expect(y).toBeGreaterThan(terrain.heightAt(x));
    }
  });

  it("dives and soars instead of flying a flat line", () => {
    const g = make("varied", 1400);
    const altitudes = g.record.samples.map(([, x, y]) => y - hills.heightAt(x));
    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    expect(max - min).toBeGreaterThan(3);
    expect(min).toBeGreaterThan(1);
  });

  it("never exceeds the sample budget even for an absurd target", () => {
    const g = make("marathon", 500_000);
    expect(g.record.samples.length).toBeLessThanOrEqual(GHOST_MAX_SAMPLES);
    expect(g.seconds).toBeGreaterThan(0);
  });

  it("flies faster with more skill", () => {
    const slow = make("skill", 1200, 0.05);
    const fast = make("skill", 1200, 0.95);
    expect(fast.seconds).toBeLessThan(slow.seconds);
  });

  it("is paced for the pilot, not cloned from them — the never-a-humiliation cap", () => {
    // The strongest pilot must not get the strongest possible ghost.
    // `paceSkillFor` saturates at 0.88, so every pilot from 0.92 skill up has
    // to get the *identical* ghost. Before the wire each of these got its own,
    // faster-and-faster line and a top pilot chased one nobody can catch; a
    // max-cruise, max-dive ghost is exactly the humiliation a *pace* ghost
    // exists to avoid.
    const capped = make("cap", 1200, 0.92);
    for (const s of [0.95, 1]) {
      const g = make("cap", 1200, s);
      expect(g.record.samples).toEqual(capped.record.samples);
      expect(g.seconds).toBe(capped.seconds);
    }
    // The cap is a real one, not a coincidence for those inputs: these three
    // all pace to 0.88 while a merely-strong pilot paces below it.
    expect([0.92, 0.95, 1].map(paceSkillFor)).toEqual([0.88, 0.88, 0.88]);
    expect(paceSkillFor(0.8)).toBeLessThan(0.88);
  });

  it("paces a middling pilot above a struggling one — the ghost is a target", () => {
    const struggling = make("spread", 1200, 0.2);
    const middling = make("spread", 1200, 0.55);
    expect(middling.seconds).toBeLessThan(struggling.seconds);
  });

  it("survives a non-numeric skill instead of emitting an empty ghost", () => {
    // `math.clamp` propagates NaN, so a NaN skill used to poison `cruise`, the
    // loop guard went false on the first tick, and the pilot got a ghost with
    // zero samples and zero seconds — a "rival" that never moves. Assert the
    // shape too, so this cannot pass by having nothing to look at.
    const g = synthesizePaceGhost({ seed: "nan", startX: 100, distance: 900, terrain: hills, skill: Number.NaN });
    expect(g.record.samples.length).toBeGreaterThan(4);
    expect(g.seconds).toBeGreaterThan(0);
    for (const [, x, y] of g.record.samples) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("labels itself as a pace target, never as a person", () => {
    const g = make("honest", 800);
    expect(g.name).toContain("Pace");
    // The record and the label must agree, or the toast promises a distance
    // the ghost does not actually fly.
    expect(g.name).toContain(g.record.distance.toLocaleString("en-US"));
    expect(paceName(1234)).toContain("1,234");
  });
});

describe("pace target distance", () => {
  it("gives a brand-new player a short, winnable first race", () => {
    let n = 0;
    const seeds = [() => 0, () => 0.5, () => 1];
    for (const rng of seeds) {
      const d = paceTargetDistance(0, rng);
      expect(d).toBeGreaterThanOrEqual(180);
      expect(d).toBeLessThanOrEqual(260);
      n += 1;
    }
    expect(n).toBe(3);
  });

  it("stretches a personal best just far enough to matter", () => {
    for (const rng of [() => 0, () => 0.5, () => 0.999]) {
      const d = paceTargetDistance(1000, rng);
      expect(d).toBeGreaterThanOrEqual(1020);
      expect(d).toBeLessThanOrEqual(1120);
    }
  });

  it("defaults to Math.random without exploding", () => {
    const d = paceTargetDistance(500);
    expect(d).toBeGreaterThanOrEqual(510);
    expect(d).toBeLessThanOrEqual(560);
  });
});
