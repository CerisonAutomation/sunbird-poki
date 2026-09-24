import { describe, expect, it } from "vitest";
import { browseSkins, newShopBrowse, nextBird } from "../ShopBrowse";
import { equalizedRace } from "../RaceRules";
import { flightTakeaway, terrainCue } from "../FlightGuidance";
import { SKINS, type SkinView } from "../Economy";
import { DROP_START, RAMP_START, GAP_START } from "../constants";
const skins: SkinView[] = SKINS.map(def => ({ def, owned: def.id === "sunbird", equipped: def.id === "sunbird", locked: !!(def.goldOnly || def.vipOnly), lockReason: null, affordable: def.price <= 400 }));

describe("shop discovery without changing the wallet", () => {
  it("keeps default catalogue order and never mutates inventory", () => {
    expect(browseSkins(skins, newShopBrowse())).toEqual(skins);
    expect(skins.filter(v => v.owned)).toHaveLength(1);
  });
  it("searches words, case-insensitively, across name / perk / collection", () => {
    expect(browseSkins(skins, { ...newShopBrowse(), query: "  NATURE bluejay  " }).map(v => v.def.id)).toEqual(["bluejay"]);
    expect(browseSkins(skins, { ...newShopBrowse(), query: "[.*<script>" })).toEqual([]);
  });
  it("owned and affordable views have different, literal meanings", () => {
    expect(browseSkins(skins, { ...newShopBrowse(), filter: "owned" }).map(v => v.def.id)).toEqual(["sunbird"]);
    const affordable = browseSkins(skins, { ...newShopBrowse(), filter: "affordable" });
    expect(affordable.length).toBeGreaterThan(0);
    expect(affordable.every(v => v.affordable && !v.owned && !v.locked && !v.def.prizeOnly)).toBe(true);
  });
  it("only recommends genuinely earnable unowned birds", () => {
    const next = nextBird(skins)!;
    expect(next.owned || next.locked || !!next.def.prizeOnly).toBe(false);
    expect(next.def.price).toBe(Math.min(...skins.filter(v => !v.owned && !v.locked && !v.def.prizeOnly).map(v => v.def.price)));
    expect(nextBird(skins.map(v => ({ ...v, owned: true })))).toBeUndefined();
  });
});

describe("actionable timing and flight goals", () => {
  const ground = { grounded: true, localX: DROP_START, altitude: 0, vy: 0, landingSlope: 0 };
  it("uses the actual drop/ramp boundaries with no hint dead zone", () => {
    expect(terrainCue(ground)).toMatch(/^HOLD/);
    expect(terrainCue({ ...ground, localX: RAMP_START - 0.01 })).toMatch(/^HOLD/);
    expect(terrainCue({ ...ground, localX: RAMP_START })).toMatch(/^RELEASE/);
    expect(terrainCue({ ...ground, localX: GAP_START })).toBe("");
  });
  it("distinguishes downhill catches from uphill impacts, not just airtime", () => {
    const landing = { ...ground, grounded: false, altitude: 25, vy: -15 };
    expect(terrainCue({ ...landing, landingSlope: -0.3 })).toContain("catch the downslope");
    expect(terrainCue({ ...landing, landingSlope: 0.3 })).toContain("soften the landing");
    expect(terrainCue({ ...landing, vy: 10 })).toBe("");
    expect(terrainCue({ ...landing, altitude: 2 })).toBe("");
  });
  it("offers a skill lesson before a distance target", () => {
    expect(flightTakeaway({ distance: 300, bestDistance: 500, perfects: 0, island: 0 }).title).toBe("Find your rhythm");
    expect(flightTakeaway({ distance: 900, bestDistance: 900, perfects: 2, island: 0 }).title).toContain("island");
    expect(flightTakeaway({ distance: 1600, bestDistance: 1700, perfects: 3, island: 1 }).title).toBe("Next landmark: 1,750 m");
    expect(flightTakeaway({ distance: 2200, bestDistance: 2600, perfects: 3, island: 2 }).title).toBe("Next landmark: 3,000 m");
  });
});

describe("equal live-race equipment", () => {
  it.each([[false, false], [true, false], [true, true]])("equalizes ranked=%s local=%s race equipment", (ranked, local) => {
    expect(equalizedRace("massrace", ranked, local, false)).toBe(true);
  });
  it("does not remove solo, casual AI or duel equipment", () => {
    expect(equalizedRace("classic", true, false, false)).toBe(false);
    expect(equalizedRace("massrace", false, true, false)).toBe(false);
    expect(equalizedRace("massrace", false, false, true)).toBe(false);
  });
});

it("predicts a nearby touchdown without looking past it or unboundedly ahead", async () => {
  const { landingLookAhead } = await import("../FlightGuidance");
  expect(landingLookAhead(5, 60, -50)).toBeLessThan(6);
  expect(landingLookAhead(50, 60, -10)).toBe(36);
  expect(landingLookAhead(1000, 1000, -10)).toBe(48);
  expect(landingLookAhead(10, 60, 10)).toBe(0);
  expect(landingLookAhead(NaN, 60, -10)).toBe(0);
});
