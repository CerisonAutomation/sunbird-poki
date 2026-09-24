import { describe, expect, it } from "vitest";
import { growthLedger, type MasteryGrowth, type WingsGrowth } from "../GrowthLedger";

const wings = (over: Partial<WingsGrowth> = {}): WingsGrowth => ({
  icon: "🪽",
  name: "Swift",
  progress: 0.42,
  nextName: "Gale",
  nextNeeded: 1850,
  lifetime: 12400,
  ...over,
});

const mastery = (over: Partial<MasteryGrowth> = {}): MasteryGrowth => ({
  name: "Day Trip",
  icon: "🌅",
  runs: 7,
  level: 2,
  nextAt: 10,
  progress: 0.7,
  perk: "+4% coins",
  maxed: false,
  ...over,
});

/**
 * The results card sold the next flight but never said what the flight the
 * player just finished *grew*. These lock the two lines that do: wings first
 * (every flight feeds it), mastery only when the flown mode has a row, and a
 * line that cannot be filled in is dropped rather than rendered half-empty.
 */
describe("growthLedger", () => {
  it("shows both ladders, wings first", () => {
    const rows = growthLedger(wings(), mastery());
    expect(rows.map((r) => r.kind)).toEqual(["wings", "mastery"]);
  });

  it("says what is left on the career ladder, in metres", () => {
    const [row] = growthLedger(wings(), null);
    expect(row.label).toBe("Swift");
    expect(row.detail).toBe("1,850 m to Gale");
    expect(row.progress).toBeCloseTo(0.42, 5);
    expect(row.icon).toBe("🪽");
  });

  it("reads as finished at max rank instead of promising a next tier", () => {
    const [row] = growthLedger(wings({ nextName: "", nextNeeded: 0, lifetime: 90210 }), null);
    expect(row.detail).toBe("Max rank · 90,210 m flown");
    expect(row.progress).toBe(1);
  });

  it("shows mastery as runs to the next level", () => {
    const [, row] = growthLedger(wings(), mastery());
    expect(row.label).toBe("Day Trip · Lv.2");
    expect(row.detail).toBe("7/10 runs");
    expect(row.progress).toBeCloseTo(0.7, 5);
  });

  it("shows the perk once a mode is maxed", () => {
    const [, row] = growthLedger(wings(), mastery({ maxed: true, nextAt: null, level: 5, runs: 120 }));
    expect(row.label).toBe("Day Trip · Lv.5");
    expect(row.detail).toBe("+4% coins");
    expect(row.progress).toBe(1);
  });

  it("drops a ladder it cannot fill in", () => {
    expect(growthLedger(null, mastery()).map((r) => r.kind)).toEqual(["mastery"]);
    expect(growthLedger(wings(), null).map((r) => r.kind)).toEqual(["wings"]);
    expect(growthLedger(null, null)).toEqual([]);
    expect(growthLedger(wings({ name: "" }), mastery({ name: "" }))).toEqual([]);
  });

  it("never returns more than the two lines the card has room for", () => {
    expect(growthLedger(wings(), mastery()).length).toBeLessThanOrEqual(2);
  });

  it("clamps progress so a bar can never overflow or invert", () => {
    for (const bad of [Number.NaN, -3, 5, Number.POSITIVE_INFINITY]) {
      const [row] = growthLedger(wings({ progress: bad }), null);
      expect(row.progress).toBeGreaterThanOrEqual(0);
      expect(row.progress).toBeLessThanOrEqual(1);
    }
    expect(growthLedger(wings({ progress: Number.NaN }), null)[0].progress).toBe(0);
    expect(growthLedger(wings({ progress: 5 }), null)[0].progress).toBe(1);
  });

  it("cannot print a negative or fractional distance", () => {
    const [row] = growthLedger(wings({ nextNeeded: -400.7 }), null);
    expect(row.detail).toBe("0 m to Gale");
  });

  it("falls back to an icon when the snapshot has none", () => {
    expect(growthLedger(wings({ icon: "" }), mastery({ icon: "" }))[0].icon).toBeTruthy();
    expect(growthLedger(wings({ icon: "" }), mastery({ icon: "" }))[1].icon).toBeTruthy();
  });
});
