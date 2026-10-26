import { describe, expect, it } from "vitest";
import { normalizePerks, rankedPerkPreview, skinById, SKINS } from "../Economy";

describe("ranked cosmetic perk normalization", () => {
  it("leaves solo/casual modes with full perks (isRanked=false is a no-op)", () => {
    for (const bird of [skinById("jet"), skinById("eclipse_origin"), skinById("solstice")]) {
      expect(normalizePerks(bird, false)).toBe(bird);
    }
  });

  it("caps every bird's ranked speed at +3%, regardless of catalogue value", () => {
    const jet = skinById("jet"); // +8% top speed uncapped
    expect(jet.speedMult).toBeCloseTo(1.08);
    expect(normalizePerks(jet, true).speedMult).toBeCloseTo(1.03);

    const eclipse = skinById("eclipse_origin"); // +8% speed · +5s fever · +10s daylight
    const capped = normalizePerks(eclipse, true);
    expect(capped.speedMult).toBeCloseTo(1.03);
    expect(capped.feverBonus).toBe(3);
    expect(capped.daylightBonus).toBe(3);
  });

  it("caps fever and daylight buffs at +3s", () => {
    const raven = skinById("raven"); // Fever +5s, no speed/daylight
    expect(normalizePerks(raven, true).feverBonus).toBe(3);

    const ibis = skinById("ibis"); // +8s of daylight, no speed/fever
    expect(normalizePerks(ibis, true).daylightBonus).toBe(3);
  });

  it("never raises a stat above its own catalogue value", () => {
    for (const bird of SKINS) {
      const capped = normalizePerks(bird, true);
      expect(capped.speedMult).toBeLessThanOrEqual(bird.speedMult);
      expect(capped.feverBonus).toBeLessThanOrEqual(bird.feverBonus);
      expect(capped.daylightBonus).toBeLessThanOrEqual(bird.daylightBonus);
      // And never below the ranked floor either.
      expect(capped.speedMult).toBeGreaterThanOrEqual(Math.min(bird.speedMult, 1.03));
    }
  });

  it("leaves birds already within the cap untouched", () => {
    const sunbird = skinById("sunbird"); // 1x speed, no buffs
    const capped = normalizePerks(sunbird, true);
    expect(capped.speedMult).toBe(sunbird.speedMult);
    expect(capped.feverBonus).toBe(sunbird.feverBonus);
    expect(capped.daylightBonus).toBe(sunbird.daylightBonus);
  });

  it("applies the same cap to earned-only birds — fairness wins over grind (Solstice, Legendary, Mythic)", () => {
    for (const id of ["solstice", "legendary", "mythic"]) {
      const bird = skinById(id);
      expect(bird.prizeOnly).toBeTruthy();
      const capped = normalizePerks(bird, true);
      expect(capped.speedMult).toBeLessThanOrEqual(1.03);
      expect(capped.feverBonus).toBeLessThanOrEqual(3);
      expect(capped.daylightBonus).toBeLessThanOrEqual(3);
    }
  });

  it("preserves non-perk fields (identity, artwork, traits) untouched", () => {
    const stormRider = skinById("storm_rider"); // weatherProof: true
    const capped = normalizePerks(stormRider, true);
    expect(capped.id).toBe(stormRider.id);
    expect(capped.name).toBe(stormRider.name);
    expect(capped.body).toBe(stormRider.body);
    expect(capped.weatherProof).toBe(true);
  });
});

describe("ranked perk preview copy", () => {
  it("describes the cap for a bird that gets capped", () => {
    const preview = rankedPerkPreview(skinById("eclipse_origin"));
    expect(preview).toContain("Ranked cap");
    expect(preview).toContain("speed");
  });

  it("says nothing changes for a bird already inside the cap", () => {
    expect(rankedPerkPreview(skinById("sunbird"))).toBe("Already within the ranked fair-play cap — no change.");
  });
});
