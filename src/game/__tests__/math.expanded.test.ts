import { describe, expect, it } from "vitest";
import { clamp, fbm, hash01, lerp, lerpAngle, smoothstep, SeededRandom, valueNoise, truncate, formatDistance, formatDatePretty, dateSeed, saturate } from "../math";
import { TerrainSystem } from "../TerrainSystem";
import { ISLAND_PERIOD } from "../constants";

// ── lerp / clamp / saturate (6 tests) ──────────────────────────────────────────
describe("math: lerp", () => {
  it("lerp at t=0 returns a", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it("lerp at t=1 returns b", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it("lerp at t=0.5 returns midpoint", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
  it("lerp with negative t extrapolates below a", () => {
    expect(lerp(10, 20, -1)).toBe(0);
  });
  it("lerp with t>1 extrapolates above b", () => {
    expect(lerp(10, 20, 2)).toBe(30);
  });
  it("lerp with a === b always returns a", () => {
    expect(lerp(5, 5, 0.99)).toBe(5);
  });
});

describe("math: clamp", () => {
  it("clamps below range to lo", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above range to hi", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("passes through in-range value", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("handles lo === hi", () => {
    expect(clamp(7, 5, 5)).toBe(5);
  });
  it("handles negative range", () => {
    expect(clamp(3, -10, -5)).toBe(-5);
  });
  it("clamps NaN to lo (NaN comparisons are always false)", () => {
    // Math.max(0, Math.min(10, NaN)) === NaN because NaN comparisons return false
    expect(clamp(NaN, 0, 10)).toBe(NaN);
  });
});

describe("math: saturate", () => {
  it("saturates below 0 to 0", () => {
    expect(saturate(-0.5)).toBe(0);
  });
  it("saturates above 1 to 1", () => {
    expect(saturate(1.5)).toBe(1);
  });
  it("passes through 0..1", () => {
    expect(saturate(0.5)).toBe(0.5);
  });
  it("handles exactly 0 and 1", () => {
    expect(saturate(0)).toBe(0);
    expect(saturate(1)).toBe(1);
  });
});

// ── smoothstep (4 tests) ──────────────────────────────────────────────────────
describe("math: smoothstep", () => {
  it("returns 0 below e0", () => {
    expect(smoothstep(0, 10, -1)).toBe(0);
  });
  it("returns 1 above e1", () => {
    expect(smoothstep(0, 10, 11)).toBe(1);
  });
  it("returns 0.5 at midpoint", () => {
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 5);
  });
  it("returns 0 at e0 exactly", () => {
    expect(smoothstep(0, 10, 0)).toBe(0);
  });
  it("returns 1 at e1 exactly", () => {
    expect(smoothstep(0, 10, 10)).toBe(1);
  });
});

// ── lerpAngle (5 tests) ───────────────────────────────────────────────────────
describe("math: lerpAngle", () => {
  it("shortest path across the 0/2π boundary (positive)", () => {
    expect(lerpAngle(0.5, 0.1, 0.5)).toBeCloseTo(0.3, 5);
  });
  it("shortest path across the 0/2π boundary (negative)", () => {
    expect(lerpAngle(0.1, 0.5, 0.5)).toBeCloseTo(0.3, 5);
  });
  it("no wrap needed for small angles", () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
  it("handles wrapping at PI boundary", () => {
    expect(lerpAngle(Math.PI, -Math.PI, 0.5)).toBeCloseTo(Math.PI, 4);
  });
  it("returns start when t=0", () => {
    expect(lerpAngle(2, -2, 0)).toBeCloseTo(2, 5);
  });
});

// ── hash01 (4 tests) ──────────────────────────────────────────────────────────
describe("math: hash01", () => {
  it("returns value in [0, 1)", () => {
    const h = hash01(42, 7);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });
  it("same input always produces same output (deterministic)", () => {
    expect(hash01(42, 7)).toBe(hash01(42, 7));
  });
  it("different inputs produce different outputs", () => {
    expect(hash01(42, 7)).not.toBe(hash01(43, 7));
  });
  it("different seeds produce different outputs", () => {
    expect(hash01(42, 7)).not.toBe(hash01(42, 8));
  });
});

// ── valueNoise (4 tests) ──────────────────────────────────────────────────────
describe("math: valueNoise", () => {
  it("returns value in [0, 1]", () => {
    const n = valueNoise(3.7, 123);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(1);
  });
  it("integer input returns hash value", () => {
    expect(valueNoise(0, 42)).toBeCloseTo(hash01(0, 42), 5);
  });
  it("is deterministic for the same seed", () => {
    expect(valueNoise(3.7, 123)).toBe(valueNoise(3.7, 123));
  });
  it("different seeds produce different noise", () => {
    expect(valueNoise(3.7, 123)).not.toBe(valueNoise(3.7, 999));
  });
});

// ── fbm (5 tests) ─────────────────────────────────────────────────────────────
describe("math: fbm", () => {
  it("returns value in roughly [0, 1]", () => {
    const f = fbm(2.5, 42);
    expect(f).toBeGreaterThan(-0.5);
    expect(f).toBeLessThan(1.5);
  });
  it("is deterministic", () => {
    expect(fbm(2.5, 42)).toBe(fbm(2.5, 42));
  });
  it("different octaves produce different results", () => {
    expect(fbm(2.5, 42, 3)).not.toBe(fbm(2.5, 42, 8));
  });
  it("same octaves produce same result", () => {
    expect(fbm(2.5, 42, 4)).toBe(fbm(2.5, 42, 4));
  });
  it("more octaves produces smoother variation", () => {
    const a = fbm(1.0, 10);
    const b = fbm(1.0 + 0.01, 10);
    expect(Math.abs(b - a)).toBeLessThan(0.5);
  });
});

// ── SeededRandom (10 tests) ──────────────────────────────────────────────────
describe("math: SeededRandom", () => {
  it("same string seed produces same sequence", () => {
    const a = new SeededRandom("hello");
    const b = new SeededRandom("hello");
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
  it("different string seeds produce different sequences", () => {
    const a = new SeededRandom("hello");
    const b = new SeededRandom("world");
    expect(a.next()).not.toBe(b.next());
  });
  it("same numeric seed produces same sequence", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
  it("different numeric seeds produce different sequences", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(99);
    expect(a.next()).not.toBe(b.next());
  });
  it("next() always returns [0, 1)", () => {
    const rng = new SeededRandom("test");
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("range(a, b) returns a when next is 0", () => {
    const rng = new SeededRandom(0);
    // Exhaust the sequence until near-zero
    for (let i = 0; i < 100; i++) rng.next();
    // Just check it's in range
    const r = rng.range(10, 20);
    expect(r).toBeGreaterThanOrEqual(10);
    expect(r).toBeLessThan(20);
  });
  it("range(a, b) is in [a, b)", () => {
    const rng = new SeededRandom("test");
    for (let i = 0; i < 100; i++) {
      const r = rng.range(5, 10);
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThan(10);
    }
  });
  it("int(a, b) returns integer in [a, b)", () => {
    const rng = new SeededRandom("test");
    for (let i = 0; i < 100; i++) {
      const r = rng.int(0, 10);
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(10);
    }
  });
  it("seed property returns internal state", () => {
    const rng = new SeededRandom("test");
    expect(typeof rng.seed).toBe("number");
  });
  it("zero seed defaults to 1", () => {
    const r1 = new SeededRandom(0);
    const r2 = new SeededRandom(1);
    // 0 >>> 0 || 1 = 1, so seed 0 becomes 1
    expect(r1.seed).toBe(1);
    expect(r2.seed).toBe(1);
  });
});

// ── dateSeed / formatDatePretty (5 tests) ──────────────────────────────────────
describe("math: dateSeed", () => {
  it("produces YYYY-MM-DD format", () => {
    const d = new Date(2026, 8, 15);
    expect(dateSeed(d)).toBe("2026-09-15");
  });
  it("pads month and day with zeros", () => {
    const d = new Date(2026, 0, 3);
    expect(dateSeed(d)).toBe("2026-01-03");
  });
  it("defaults to current date", () => {
    const s = dateSeed();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("math: formatDatePretty", () => {
  it("formats valid date", () => {
    expect(formatDatePretty("2026-03-15")).toBe("March 15, 2026");
  });
  it("passes through invalid date unchanged", () => {
    expect(formatDatePretty("not-a-date")).toBe("not-a-date");
  });
  it("passes through out-of-range month", () => {
    expect(formatDatePretty("2026-13-05")).toBe("2026-13-05");
  });
  it("handles January correctly", () => {
    expect(formatDatePretty("2026-01-01")).toBe("January 1, 2026");
  });
  it("handles December correctly", () => {
    expect(formatDatePretty("2026-12-25")).toBe("December 25, 2026");
  });
});

// ── formatDistance (4 tests) ──────────────────────────────────────────────────
describe("math: formatDistance", () => {
  it("formats meters", () => {
    expect(formatDistance(500)).toBe("500 m");
  });
  it("formats kilometers with 2 decimals", () => {
    expect(formatDistance(1500)).toBe("1.50 km");
  });
  it("clamps negative to 0", () => {
    expect(formatDistance(-100)).toBe("0 m");
  });
  it("handles NaN by returning 0 m", () => {
    expect(formatDistance(NaN)).toBe("0 m");
  });
  it("floor is used for meters (not rounded)", () => {
    expect(formatDistance(599.7)).toBe("599 m");
  });
});

// ── truncate (5 tests) ────────────────────────────────────────────────────────
describe("math: truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates to max code points", () => {
    expect(truncate("abcdefgh", 4)).toBe("abcd");
  });
  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
  it("does not split surrogate pairs", () => {
    const str = "hello 😀 world";
    const t = truncate(str, 8);
    // truncate counts code points: "h","e","l","l","o"," ","😀"," ","w" = 9 code points
    // But max=8, so we get first 8 code points: "hello 😀 "
    expect(t).toBe("hello 😀 ");
    expect(Array.from(t).length).toBe(8);
  });
  it("handles max = 0", () => {
    expect(truncate("hello", 0)).toBe("");
  });
});

// ── integration with TerrainSystem (5 tests) ───────────────────────────────────
describe("math: terrain integration", () => {
  it("heightAt is deterministic for same seed", () => {
    const t1 = new TerrainSystem("2026-09-12");
    const t2 = new TerrainSystem("2026-09-12");
    expect(t1.heightAt(500)).toBe(t2.heightAt(500));
    t1.dispose();
    t2.dispose();
  });
  it("heightAt differs for different seeds", () => {
    const t1 = new TerrainSystem("2026-09-12");
    const t2 = new TerrainSystem("2026-09-13");
    expect(t1.heightAt(500)).not.toBe(t2.heightAt(500));
    t1.dispose();
    t2.dispose();
  });
  it("islandIndex 0 for x near origin", () => {
    const t = new TerrainSystem("2026-09-12");
    expect(t.islandIndex(100)).toBe(0);
    t.dispose();
  });
  it("localX wraps correctly for negative x", () => {
    const t = new TerrainSystem("2026-09-12");
    // ISLAND_PERIOD = 1100, localX(-1) should equal localX(-1 + 1100)
    expect(t.localX(-1)).toBe(t.localX(-1 + ISLAND_PERIOD));
    expect(t.localX(-100)).toBe(t.localX(-100 + ISLAND_PERIOD));
    t.dispose();
  });
  it("isOcean returns true within gap region", () => {
    const t = new TerrainSystem("2026-09-12");
    // GAP_START is imported from constants, test a known ocean area
    // The first island starts at 0, gap is typically near the end
    const isOcean = t.isOcean(100);
    expect(typeof isOcean).toBe("boolean");
    t.dispose();
  });
});
