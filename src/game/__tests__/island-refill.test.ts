/**
 * "Each new island refills it" is printed on the results card, so the game has
 * to mean it. Two separate defects meant it did not, and both were invisible
 * from the source and obvious from the meter:
 *
 *  · The payout was a flat 15 seconds while the cap it is measured against is
 *    not 15-shaped. `daylightMax()` grows on every island (Climb Breaker) and
 *    every sun flask, and starts higher for gold and perks. Measured on a live
 *    flight that had taken boosts, the cap had reached ~141 and the island's
 *    share of the meter had fallen to 10.6% — the bar twitched while the copy
 *    promised a refill.
 *
 *  · The island was marked spent on the frame it was ENTERED, before the
 *    airborne gate ran. Splash across a boundary, or cross it above the refill
 *    ceiling, and the island was consumed and paid nothing — permanently, since
 *    returning westbound makes `idx > lastIsland` false.
 *
 * The decision is a pure function (`hud/islandRefill.ts`) precisely so these
 * can be asserted without flying 1,900 m in a real browser.
 */
import { describe, expect, it } from "vitest";

import { DAYLIGHT_ISLAND_REFILL_FRACTION, DAYLIGHT_MAX } from "../constants";
import { islandEntry } from "../hud/islandRefill";

/** A fresh run on the base day, halfway through. */
const base = { idx: 1, lastIsland: 0, airborne: true, daylight: DAYLIGHT_MAX / 2, daylightMax: DAYLIGHT_MAX, climbRelief: 0 };

describe("an island fills the sun back up", () => {
  it("gives back a share of the day you actually have", () => {
    const entry = islandEntry(base);
    expect(entry.consumed).toBe(true);
    expect(entry.daylight).toBe(Math.min(base.daylightMax, base.daylight + Math.round(DAYLIGHT_MAX * DAYLIGHT_ISLAND_REFILL_FRACTION)));
  });

  it("moves the same fraction of the METER whatever the cap has grown to", () => {
    // The defect, stated as a property: the share of the bar that jumps is
    // what the player sees, and it must not shrink as the day gets longer.
    const share = (max: number) => {
      const before = islandEntry({ ...base, daylightMax: max, daylight: max * 0.5 }).daylight;
      return (before - max * 0.5) / max;
    };
    const boosted = share(141); // what a run with Climb Breaker and flasks reaches
    expect(
      Math.abs(boosted - DAYLIGHT_ISLAND_REFILL_FRACTION),
      `a 141-second cap paid out only ${(boosted * 100).toFixed(1)}% of the meter, against ${(DAYLIGHT_ISLAND_REFILL_FRACTION * 100).toFixed(1)}% at base`,
    ).toBeLessThan(0.01);
  });

  it("is unchanged at base stats, so an unupgraded run plays exactly as before", () => {
    // The fraction was chosen so the new payout rounds to the old flat one.
    expect(Math.round(DAYLIGHT_MAX * DAYLIGHT_ISLAND_REFILL_FRACTION)).toBe(15);
  });

  it("never hands back more than a full day", () => {
    const full = islandEntry({ ...base, daylight: base.daylightMax });
    expect(full.daylight).toBe(base.daylightMax);
  });

  it("pays more for a wall than for a slope", () => {
    const slope = islandEntry({ ...base, climbRelief: 0 }).daylight!;
    const wall = islandEntry({ ...base, climbRelief: 1 }).daylight!;
    expect(wall).toBeGreaterThan(slope);
  });

  it("ignores an island already paid out", () => {
    const entry = islandEntry({ ...base, lastIsland: 1 });
    expect(entry).toEqual({ entered: false, consumed: false, daylight: base.daylight });
  });
});

describe("an island you did not fly still pays, later", () => {
  it("does not consume the island when the bird crossed it in the water", () => {
    const splashed = islandEntry({ ...base, airborne: false });
    expect(splashed.entered).toBe(true);
    expect(splashed.consumed, "the island is spent before it was earned, and can never be re-claimed").toBe(false);
    expect(splashed.daylight, "a splash costs daylight elsewhere; the island does not pay for itself").toBe(base.daylight);
  });

  it("does not consume the island when it was crossed above the refill ceiling", () => {
    // `airborne` is the combined gate — under the ceiling AND out of the water —
    // so the same rule covers the stratosphere shortcut this gate exists to close.
    expect(islandEntry({ ...base, airborne: false }).consumed).toBe(false);
  });

  it("still pays once the bird is flying the island it had splashed into", () => {
    // The recovery the old ordering made impossible. This is the regression:
    // westbound, `idx > lastIsland` is false, so under the old code the island
    // was gone for the rest of the run no matter how well it was later flown.
    const splashed = islandEntry({ ...base, airborne: false });
    expect(splashed.consumed).toBe(false);
    const flown = islandEntry({ ...base, lastIsland: splashed.consumed ? base.idx : 0, airborne: true });
    expect(flown.consumed).toBe(true);
    expect(flown.daylight!).toBeGreaterThan(base.daylight);
  });

  it("pays exactly once for an island that is flown repeatedly", () => {
    const first = islandEntry(base);
    const second = islandEntry({ ...base, lastIsland: first.consumed ? base.idx : 0, daylight: first.daylight });
    expect(second.consumed, "re-crossing must not farm the sun").toBe(false);
    expect(second.daylight).toBe(first.daylight);
  });
});