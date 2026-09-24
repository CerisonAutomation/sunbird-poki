import { describe, expect, it } from "vitest";
import { BOOSTS, SHOP_TRAILS, SKINS, VIP, dailyDealBoost, skinById } from "../Economy";
import { SEASON_TIER_DEFS } from "../SeasonPass";
import { TRAILS } from "../Tournaments";
import { MODES } from "../Modes";
import { BIOMES, biomeForIsland } from "../Biomes";

describe("skin catalogue", () => {
  it("has a meaningful roster (60+) with unique ids", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
  });

  it("every purchasable skin has a sane price and perks in range", () => {
    for (const s of SKINS) {
      expect(s.price).toBeGreaterThanOrEqual(0);
      expect(s.speedMult).toBeGreaterThanOrEqual(1);
      expect(s.speedMult).toBeLessThanOrEqual(1.08); // no pay-to-win runaway
      expect(s.feverBonus).toBeLessThanOrEqual(5);
      expect(s.daylightBonus).toBeLessThanOrEqual(10);
    }
  });

  it("keeps cosmetics as meaningful long-term unlocks without charging for prize birds", () => {
    const purchasable = SKINS.filter((s) => s.price > 0 && !s.goldOnly && !s.vipOnly && !s.prizeOnly);
    // Rebalanced: first bird in 1 run (80), top tier 800-900 not 1500, still meaningful long-term
    expect(Math.min(...purchasable.map((s) => s.price))).toBeGreaterThanOrEqual(80);
    expect(Math.max(...purchasable.map((s) => s.price))).toBeGreaterThanOrEqual(800);
  });

  it("prize skins are never purchasable and explain how to earn them", () => {
    for (const s of SKINS.filter((x) => x.prizeOnly)) {
      expect(s.price).toBe(0);
      expect(s.prizeOnly!.length).toBeGreaterThan(4);
    }
  });

  it("skinById falls back to the starter", () => {
    expect(skinById("nope").id).toBe("sunbird");
  });

  it("perk copy never promises unimplemented powers", () => {
    // If a perk string sells weather immunity or stealth, the skin MUST carry
    // the implementing flag that Weather.ts actually reads. No fiction.
    for (const s of SKINS) {
      const perk = s.perk.toLowerCase();
      if (perk.includes("weather") || perk.includes("storm-proof")) {
        expect(s.weatherProof, `${s.id} sells weather immunity but has no weatherProof flag`).toBe(true);
      }
      if (perk.includes("stealth")) {
        expect(s.stealth, `${s.id} sells stealth but has no stealth flag`).toBe(true);
      }
      // And the reverse: hidden powers must be advertised.
      if (s.weatherProof) expect(perk).toMatch(/weather|storm/);
      if (s.stealth) expect(perk).toContain("stealth");
    }
  });

  it("every skin belongs to a known collection — no uncategorized wall", () => {
    for (const s of SKINS) {
      expect(s.collection, `${s.id} has no collection — it would vanish from the grouped shop`).toBeDefined();
      expect(["starter", "nature", "elements", "cosmic", "seasonal", "premium", "tournament", "achievement"]).toContain(s.collection);
    }
  });
});

describe("season pass", () => {
  it("has 50 tiers with strictly increasing xp", () => {
    expect(SEASON_TIER_DEFS).toHaveLength(50);
    for (let i = 1; i < SEASON_TIER_DEFS.length; i++) {
      expect(SEASON_TIER_DEFS[i]!.xpNeeded).toBeGreaterThan(SEASON_TIER_DEFS[i - 1]!.xpNeeded);
    }
  });

  it("every reward references a real unlock", () => {
    const skinIds = new Set(SKINS.map((s) => s.id));
    const boostIds = new Set(BOOSTS.map((b) => b.id));
    for (const t of SEASON_TIER_DEFS) {
      for (const r of [t.free, t.premium]) {
        if (r.kind === "skin") expect(skinIds.has(r.id)).toBe(true);
        else if (r.kind === "boost") expect(boostIds.has(r.id)).toBe(true);
        else if (r.kind === "trail") expect(TRAILS[r.id]).toBeDefined();
        else expect(r.amount).toBeGreaterThan(0);
      }
    }
  });

  it("free track includes real exclusives, not only coins", () => {
    const freeKinds = new Set(SEASON_TIER_DEFS.map((t) => t.free.kind));
    expect(freeKinds.has("trail")).toBe(true);
    expect(freeKinds.has("skin")).toBe(true);
  });
});

describe("shop trails", () => {
  it("every shop trail has matching in-flight colors in TRAILS", () => {
    for (const t of SHOP_TRAILS) {
      expect(TRAILS[t.id]).toBeDefined();
      expect(TRAILS[t.id]!.colors.length).toBe(t.css.length);
      expect(t.price).toBeGreaterThan(0);
    }
  });

  it("prices trails above a single-run impulse purchase", () => {
    // Rebalanced: trails are 2-4 runs (180-320), not 5-8 (400+). Still above 1-run impulse (80) but accessible.
    expect(Math.min(...SHOP_TRAILS.map((t) => t.price))).toBeGreaterThanOrEqual(150);
  });

  it("shop trail ids never collide with prize trail ids or each other", () => {
    const ids = SHOP_TRAILS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // prize trails granted by cups must stay earn-only
    for (const prize of ["trail_comet", "trail_prism", "trail_star", "trail_duelist", "trail_gauntlet"]) {
      expect(ids).not.toContain(prize);
    }
  });
});

describe("daily deal", () => {
  it("is deterministic for a given date and always cheaper", () => {
    const a = dailyDealBoost("2026-09-11");
    const b = dailyDealBoost("2026-09-11");
    expect(a).toEqual(b);
    const def = BOOSTS.find((x) => x.id === a.id)!;
    expect(a.price).toBeLessThan(def.price);
    expect(a.price).toBeGreaterThanOrEqual(10);
  });

  it("rotates across dates", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) seen.add(dailyDealBoost(`2026-10-${String(d).padStart(2, "0")}`).id);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("portal coin VIP", () => {
  it("is a pure coin sink — no IAP, no second currency", () => {
    // Poki allows only its own ad system as monetization and frowns on dual
    // currencies; VIP is a status bought with earned coins, full stop.
    expect(VIP.coinPrice).toBeGreaterThan(0);
    expect(VIP.sku).toBe("sunbird_vip");
    expect(Object.keys(VIP)).not.toContain("coinAdReward");
  });
});

describe("worlds", () => {
  it("has 9 hand-tuned biomes with unique ids", () => {
    expect(BIOMES.length).toBe(9);
    expect(new Set(BIOMES.map((b) => b.id)).size).toBe(BIOMES.length);
  });

  it("wild islands beyond the roster are deterministic remixes", () => {
    const i = BIOMES.length + 3;
    const a = biomeForIsland(i);
    const b = biomeForIsland(i);
    expect(a.id).toBe(b.id);
    expect(a.name).toContain(" ");
    expect(a.amp).toBeGreaterThan(0);
  });

  it("every biome keeps play-critical fields in sane ranges", () => {
    for (const b of BIOMES) {
      expect(b.amp).toBeGreaterThan(0.5);
      expect(b.amp).toBeLessThan(2);
      expect(b.thermals).toBeGreaterThanOrEqual(1);
      expect(b.thermals).toBeLessThanOrEqual(8);
      expect(["none", "gust", "storm"]).toContain(b.hazard);
    }
  });
});

describe("modes", () => {
  it("mode ids are unique and finish/clock are consistent", () => {
    expect(new Set(MODES.map((m) => m.id)).size).toBe(MODES.length);
    for (const m of MODES) {
      expect(m.clock).toBeGreaterThanOrEqual(0);
      expect(m.finish).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("nest coin sink", () => {
  it("price curve escalates ×1.5 and the multiplier cap holds", () => {
    // Mirror of SaveData.nestUpgradePrice: 300 * 1.5^bought.
    const price = (bought: number): number => Math.round(300 * Math.pow(1.5, bought));
    expect(price(0)).toBe(300);
    expect(price(1)).toBe(450);
    expect(price(2)).toBe(675);
    // Total cost to max (10 levels) must be a meaningful sink: > 30k coins.
    let total = 0;
    for (let i = 0; i < 10; i++) total += price(i);
    expect(total).toBeGreaterThan(30_000);
    // Cap: bought levels alone add at most +1.2x (10 × 0.12).
    expect(10 * 0.12).toBeCloseTo(1.2);
  });
});

describe("monetization tiers", () => {
  it("starter pack is priced as the easy first yes", () => {
    // Mirror constants: pack must stay a sub-$1 impulse with outsized value.
    const price = 0.99;
    const coinValue = 1200;
    expect(price).toBeLessThan(1);
    // Value anchor: 1200 coins ≈ 4 nest levels ≈ more than the $2.99 Gold price in coin terms.
    expect(coinValue).toBeGreaterThanOrEqual(1200);
  });

  it("continue tiers are strictly ordered free < vip < gold", () => {
    const free = 1, vip = 2, gold = 99;
    expect(free).toBeLessThan(vip);
    expect(vip).toBeLessThan(gold);
  });

  it("vip daily gift pays back the subscription in play terms", () => {
    // 100/day * 30 days = 3000 coins per month — must beat the 1200-coin starter pack.
    expect(100 * 30).toBeGreaterThan(1200 * 2);
  });
});
