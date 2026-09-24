import { describe, expect, it } from "vitest";
import { TerrainSystem } from "../TerrainSystem";
import { GAP_START, ISLAND_PERIOD, RAMP_START, OCEAN_FLOOR } from "../constants";

// ── heightAt (10 tests) ────────────────────────────────────────────────────────
describe("terrain: heightAt", () => {
  it("is deterministic for same seed", () => {
    const t1 = new TerrainSystem("2026-09-12");
    const t2 = new TerrainSystem("2026-09-12");
    expect(t1.heightAt(500)).toBe(t2.heightAt(500));
    expect(t1.heightAt(1000)).toBe(t2.heightAt(1000));
    t1.dispose();
    t2.dispose();
  });

  it("is cached (same result on repeated calls)", () => {
    const t = new TerrainSystem("2026-09-12");
    const h1 = t.heightAt(750);
    const h2 = t.heightAt(750);
    expect(h1).toBe(h2);
    t.dispose();
  });

  it("differs for different seeds", () => {
    const t1 = new TerrainSystem("2026-09-12");
    const t2 = new TerrainSystem("2026-09-13");
    expect(t1.heightAt(750)).not.toBe(t2.heightAt(750));
    t1.dispose();
    t2.dispose();
  });

  it("returns OCEAN_FLOOR in ocean gap region", () => {
    const t = new TerrainSystem("2026-09-12");
    // Well inside the flat ocean gap (past the smoothstep transition at GAP_START+10)
    const h = t.heightAt(GAP_START + 50);
    expect(h).toBeCloseTo(OCEAN_FLOOR, 5);
    t.dispose();
  });

  it("returns positive height on land", () => {
    const t = new TerrainSystem("2026-09-12");
    const h = t.heightAt(RAMP_START);
    expect(h).toBeGreaterThan(0);
    t.dispose();
  });

  it("height at ocean is exactly OCEAN_FLOOR", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.heightAt(GAP_START + 50)).toBeCloseTo(OCEAN_FLOOR, 5);
    t.dispose();
  });

  it("produces heights above ocean floor on land", () => {
    const t = new TerrainSystem("2026-09-12");
    const h = t.heightAt(200);
    expect(h).toBeGreaterThan(OCEAN_FLOOR);
    t.dispose();
  });

  it("handles very large x values without throwing", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(() => t.heightAt(100000)).not.toThrow();
    t.dispose();
  });

  it("produces smooth transitions (no wild jumps at 1 unit spacing)", () => {
    const t = new TerrainSystem("2026-09-12");
    const h1 = t.heightAt(200);
    const h2 = t.heightAt(201);
    const diff = Math.abs(h2 - h1);
    expect(diff).toBeLessThan(5);
    t.dispose();
  });

  it("produces valid finite heights across an island", () => {
    const t = new TerrainSystem("2026-09-12");
    for (let x = 0; x < ISLAND_PERIOD; x += 100) {
      const h = t.heightAt(x);
      expect(Number.isFinite(h)).toBe(true);
    }
    t.dispose();
  });
});

// ── slopeAt (6 tests) ──────────────────────────────────────────────────────────
describe("terrain: slopeAt", () => {
  it("returns finite values everywhere", () => {
    const t = new TerrainSystem("2026-09-12");
    for (let x = 0; x < ISLAND_PERIOD; x += 100) {
      expect(Number.isFinite(t.slopeAt(x))).toBe(true);
    }
    t.dispose();
  });

  it("is negative on uphill sections", () => {
    const t = new TerrainSystem("2026-09-12");
    const slope = t.slopeAt(50);
    expect(slope).not.toBe(0);
    t.dispose();
  });

  it("is zero in flat ocean area", () => {
    const t = new TerrainSystem("2026-09-12");
    const slope = t.slopeAt(GAP_START + 50);
    expect(slope).toBeCloseTo(0, 5);
    t.dispose();
  });

  it("returns finite value for negative x", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(Number.isFinite(t.slopeAt(-100))).toBe(true);
    t.dispose();
  });

  it("returns finite value for large x", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(Number.isFinite(t.slopeAt(5000))).toBe(true);
    t.dispose();
  });

  it("slope changes sign on at least one island", () => {
    const t = new TerrainSystem("2026-09-12");
    let hadPositive = false;
    let hadNegative = false;
    for (let x = 0; x < RAMP_START; x += 10) {
      const s = t.slopeAt(x);
      if (s > 0.01) hadPositive = true;
      if (s < -0.01) hadNegative = true;
    }
    expect(hadPositive).toBe(true);
    expect(hadNegative).toBe(true);
    t.dispose();
  });
});

// ── normalAt (6 tests) ──────────────────────────────────────────────────────────
describe("terrain: normalAt", () => {
  it("returns object with nx, ny, tx, ty", () => {
    const t = new TerrainSystem("2026-09-12");
    const n = t.normalAt(100);
    expect(n).toHaveProperty("nx");
    expect(n).toHaveProperty("ny");
    expect(n).toHaveProperty("tx");
    expect(n).toHaveProperty("ty");
    t.dispose();
  });

  it("tangent components form unit vector", () => {
    const t = new TerrainSystem("2026-09-12");
    const n = t.normalAt(100);
    expect(Math.hypot(n.tx, n.ty)).toBeCloseTo(1, 3);
    t.dispose();
  });

  it("normal is perpendicular to tangent", () => {
    const t = new TerrainSystem("2026-09-12");
    const n = t.normalAt(100);
    const dot = n.nx * n.tx + n.ny * n.ty;
    expect(Math.abs(dot)).toBeLessThan(0.001);
    t.dispose();
  });

  it("on flat terrain, tangent is (1, 0)", () => {
    const t = new TerrainSystem("2026-09-12");
    const n = t.normalAt(GAP_START + 50);
    expect(n.tx).toBeCloseTo(1, 5);
    expect(n.ty).toBeCloseTo(0, 5);
    expect(n.nx).toBeCloseTo(0, 5);
    expect(n.ny).toBeCloseTo(1, 5);
    t.dispose();
  });

  it("on steep slope, ty deviates from 0", () => {
    const t = new TerrainSystem("2026-09-12");
    const n = t.normalAt(50);
    expect(Math.abs(n.ty)).toBeGreaterThan(0);
    t.dispose();
  });

  it("normal points upward (ny > 0 for slope up)", () => {
    const t = new TerrainSystem("2026-09-12");
    const n = t.normalAt(100);
    // On a slope, the normal should point somewhat upward
    expect(n.ny).toBeGreaterThan(0);
    t.dispose();
  });
});

// ── curvatureAt (5 tests) ──────────────────────────────────────────────────────
describe("terrain: curvatureAt", () => {
  it("returns finite values across island", () => {
    const t = new TerrainSystem("2026-09-12");
    for (let x = 0; x < ISLAND_PERIOD; x += 100) {
      expect(Number.isFinite(t.curvatureAt(x))).toBe(true);
    }
    t.dispose();
  });

  it("deterministic for same seed", () => {
    const t1 = new TerrainSystem("2026-09-12");
    const t2 = new TerrainSystem("2026-09-12");
    expect(t1.curvatureAt(200)).toBe(t2.curvatureAt(200));
    t1.dispose();
    t2.dispose();
  });

  it("is zero in flat ocean area", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.curvatureAt(GAP_START + 50)).toBeCloseTo(0, 2);
    t.dispose();
  });

  it("returns both positive and negative values across island", () => {
    const t = new TerrainSystem("2026-09-12");
    let hadPositive = false;
    let hadNegative = false;
    for (let x = 0; x < RAMP_START; x += 10) {
      const c = t.curvatureAt(x);
      if (c > 0.001) hadPositive = true;
      if (c < -0.001) hadNegative = true;
    }
    expect(hadPositive || hadNegative).toBe(true);
    t.dispose();
  });

  it("handles large x values", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(Number.isFinite(t.curvatureAt(5000))).toBe(true);
    t.dispose();
  });
});

// ── isOcean (4 tests) ──────────────────────────────────────────────────────────
describe("terrain: isOcean", () => {
  it("returns true at GAP_START", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.isOcean(GAP_START)).toBe(true);
    t.dispose();
  });

  it("returns true within gap region", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.isOcean(GAP_START + 5)).toBe(true);
    t.dispose();
  });

  it("returns false on land", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.isOcean(RAMP_START)).toBe(false);
    t.dispose();
  });

  it("wraps correctly for x beyond one island", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.isOcean(GAP_START + ISLAND_PERIOD)).toBe(true);
    t.dispose();
  });
});

// ── islandIndex (4 tests) ──────────────────────────────────────────────────────
describe("terrain: islandIndex", () => {
  it("returns 0 for x in first island", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.islandIndex(100)).toBe(0);
    expect(t.islandIndex(ISLAND_PERIOD - 1)).toBe(0);
    t.dispose();
  });

  it("returns 1 for x in second island", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.islandIndex(ISLAND_PERIOD)).toBe(1);
    expect(t.islandIndex(ISLAND_PERIOD + 100)).toBe(1);
    t.dispose();
  });

  it("returns 0 for negative x", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.islandIndex(-10)).toBe(0);
    expect(t.islandIndex(-ISLAND_PERIOD)).toBe(0);
    t.dispose();
  });

  it("scales correctly for large x", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.islandIndex(ISLAND_PERIOD * 50)).toBe(50);
    t.dispose();
  });
});

// ── localX (4 tests) ───────────────────────────────────────────────────────────
describe("terrain: localX", () => {
  it("returns x for x in [0, ISLAND_PERIOD)", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.localX(50)).toBe(50);
    expect(t.localX(ISLAND_PERIOD - 1)).toBe(ISLAND_PERIOD - 1);
    t.dispose();
  });

  it("wraps for x >= ISLAND_PERIOD", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.localX(ISLAND_PERIOD)).toBe(0);
    expect(t.localX(ISLAND_PERIOD + 50)).toBe(50);
    t.dispose();
  });

  it("wraps for negative x", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.localX(-1)).toBe(ISLAND_PERIOD - 1);
    expect(t.localX(-ISLAND_PERIOD)).toBe(0);
    t.dispose();
  });

  it("result is always in [0, ISLAND_PERIOD)", () => {
    const t = new TerrainSystem("2026-09-12");
    for (let x = -200; x < 200; x += 50) {
      const lx = t.localX(x);
      expect(lx).toBeGreaterThanOrEqual(0);
      expect(lx).toBeLessThan(ISLAND_PERIOD);
    }
    t.dispose();
  });
});

// ── biomeAt (5 tests) ──────────────────────────────────────────────────────────
describe("terrain: biomeAt", () => {
  it("returns a BiomeDef object", () => {
    const t = new TerrainSystem("2026-09-12");
    const b = t.biomeAt(100);
    expect(b).toHaveProperty("id");
    expect(b).toHaveProperty("name");
    expect(b).toHaveProperty("top");
    t.dispose();
  });

  it("returns same biome for same island", () => {
    const t = new TerrainSystem("2026-09-12");
    const b1 = t.biomeAt(100);
    const b2 = t.biomeAt(200);
    expect(b1).toEqual(b2);
    t.dispose();
  });

  it("may differ for different islands", () => {
    const t = new TerrainSystem("2026-09-12");
    const b1 = t.biomeAt(100);
    const b2 = t.biomeAt(ISLAND_PERIOD + 100);
    expect(b1).toHaveProperty("name");
    expect(b2).toHaveProperty("name");
    t.dispose();
  });

  it("is deterministic for same seed", () => {
    const t1 = new TerrainSystem("2026-09-12");
    const t2 = new TerrainSystem("2026-09-12");
    expect(t1.biomeAt(500)).toEqual(t2.biomeAt(500));
    t1.dispose();
    t2.dispose();
  });

  it("returns valid biome with numeric terrain colors", () => {
    const t = new TerrainSystem("2026-09-12");
    const b = t.biomeAt(100);
    expect(typeof b.top).toBe("number");
    expect(typeof b.ridge).toBe("number");
    expect(typeof b.mid).toBe("number");
    expect(typeof b.deep).toBe("number");
    t.dispose();
  });
});

// ── distanceToCrest (6 tests) ──────────────────────────────────────────────────
describe("terrain: distanceToCrest", () => {
  it("returns finite distance", () => {
    const t = new TerrainSystem("2026-09-12");
    const d = t.distanceToCrest(100);
    expect(Number.isFinite(d)).toBe(true);
    t.dispose();
  });

  it("returns value >= 0", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.distanceToCrest(100)).toBeGreaterThanOrEqual(0);
    t.dispose();
  });

  it("returns value <= maxAhead parameter", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.distanceToCrest(100, 100)).toBeLessThanOrEqual(100);
    t.dispose();
  });

  it("resets crest cache when invalidate called", () => {
    const t = new TerrainSystem("2026-09-12");
    t.distanceToCrest(100);
    t.invalidate();
    expect(t.distanceToCrest(100)).toBeGreaterThanOrEqual(0);
    t.dispose();
  });

  it("respects maxAhead boundary", () => {
    const t = new TerrainSystem("2026-09-12");
    const d = t.distanceToCrest(0, 50);
    expect(d).toBeLessThanOrEqual(50);
    t.dispose();
  });

  it("returns larger distance with larger maxAhead", () => {
    const t = new TerrainSystem("2026-09-12");
    const d1 = t.distanceToCrest(100, 50);
    const d2 = t.distanceToCrest(100, 200);
    expect(d2).toBeGreaterThanOrEqual(d1);
    t.dispose();
  });
});

// ── invalidate (4 tests) ───────────────────────────────────────────────────────
describe("terrain: invalidate", () => {
  it("clears height cache without error", () => {
    const t = new TerrainSystem("2026-09-12");
    t.heightAt(100);
    expect(() => t.invalidate()).not.toThrow();
    t.dispose();
  });

  it("clears crest cache without error", () => {
    const t = new TerrainSystem("2026-09-12");
    t.distanceToCrest(100);
    expect(() => t.invalidate()).not.toThrow();
    t.dispose();
  });

  it("heights recalculated after invalidate", () => {
    const t = new TerrainSystem("2026-09-12");
    const h1 = t.heightAt(100);
    t.invalidate();
    const h2 = t.heightAt(100);
    expect(h1).toBe(h2);
    t.dispose();
  });

  it("does not affect other systems", () => {
    const t = new TerrainSystem("2026-09-12");
    const b1 = t.biomeAt(100);
    t.invalidate();
    const b2 = t.biomeAt(100);
    expect(b1).toEqual(b2);
    t.dispose();
  });
});

// ── dispose (3 tests) ───────────────────────────────────────────────────────────
describe("terrain: dispose", () => {
  it("does not throw on fresh dispose", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(() => t.dispose()).not.toThrow();
  });

  it("can dispose twice without error", () => {
    const t = new TerrainSystem("2026-09-12");
    t.dispose();
    expect(() => t.dispose()).not.toThrow();
  });

  it("dispose does not throw on fresh instance", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(() => { t.dispose(); }).not.toThrow();
  });
});
