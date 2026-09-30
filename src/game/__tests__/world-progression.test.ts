import { describe, expect, it } from "vitest";
import {
  GAP_MAX,
  GAP_MIN,
  flightProgressionAt,
  islandGap,
} from "../worldProgression";
import { islandTemplate } from "../Biomes";

describe("the ocean between worlds actually widens", () => {
  /**
   * Was `218 + index * 4`: island 10 came out 258 units across, eighteen
   * percent wider than island 0 after ten worlds. A ramp that shallow is
   * indistinguishable from a constant, which is why the crossings never
   * became the thing you brace for.
   */
  it("starts gentle — the first crossing is a tutorial for the gap", () => {
    expect(islandGap(0)).toBe(GAP_MIN);
  });

  it("is meaningfully wider by island 10, where it used to be +18%", () => {
    const early = islandGap(0);
    const ten = islandGap(10);
    expect(ten / early).toBeGreaterThan(1.5);
    // The old curve at island 10:
    expect(ten).toBeGreaterThan(218 + 10 * 4);
  });

  it("never exceeds a width the shipped flight model has already had to clear", () => {
    // GAP_MAX is what the old linear formula produced at island 53, so this
    // asks for nothing new of the physics — it just arrives sooner.
    for (const i of [0, 1, 5, 20, 100, 5000, 1e9]) {
      expect(islandGap(i), `island ${i}`).toBeLessThanOrEqual(GAP_MAX);
      expect(islandGap(i)).toBeGreaterThanOrEqual(GAP_MIN);
    }
  });

  it("is monotonic — a later world is never easier to reach", () => {
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const g = islandGap(i);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });

  it("is finite and safe for junk input", () => {
    expect(islandGap(Number.NaN)).toBe(GAP_MIN);
    expect(islandGap(-50)).toBe(GAP_MIN);
    expect(Number.isFinite(islandGap(Number.POSITIVE_INFINITY))).toBe(true);
  });

  it("reaches the real island layout, not just the helper", () => {
    const first = islandTemplate(0);
    const later = islandTemplate(14);
    const w = (t: { gapStart: number; gapEnd: number }) => t.gapEnd - t.gapStart;
    expect(w(later)).toBeGreaterThan(w(first));
    // And the gap still ends inside its island, never past the shelf.
    for (const i of [0, 3, 14, 40]) {
      const t = islandTemplate(i);
      expect(t.gapEnd, `island ${i}`).toBeLessThan(t.period);
      expect(t.gapEnd).toBeGreaterThan(t.gapStart);
    }
  });
});

describe("the hills keep escalating", () => {
  it("leaves island 0 exactly as authored", () => {
    const p = flightProgressionAt(0);
    expect(p.hillScale).toBe(1);
    expect(p.rhythmScale).toBe(1);
  });

  it("climbs further than the old third-more ceiling", () => {
    // Was 1.32 / 1.24 asymptotic.
    expect(flightProgressionAt(40).hillScale).toBeGreaterThan(1.4);
    expect(flightProgressionAt(40).rhythmScale).toBeGreaterThan(1.3);
  });

  it("saturates, so the hundredth island is hard and not impossible", () => {
    expect(flightProgressionAt(1e6).hillScale).toBeLessThanOrEqual(1.55);
    expect(flightProgressionAt(1e6).rhythmScale).toBeLessThanOrEqual(1.4);
  });

  it("is monotonic and junk-safe", () => {
    let prev = 0;
    for (let i = 0; i <= 120; i++) {
      const h = flightProgressionAt(i).hillScale;
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
    expect(flightProgressionAt(Number.NaN).hillScale).toBe(1);
    expect(flightProgressionAt(-9).hillScale).toBe(1);
  });
});
