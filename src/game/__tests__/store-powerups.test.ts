import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOSTS, SHOP_TRAILS, SKINS, WHEEL_SECTORS } from "../Economy";
import { PICKUP_STYLE } from "../Collectibles";

/**
 * The store has to be a place a player can actually spend.
 *
 * Three failures here are silent: a boost with no flight effect, a section the
 * jump row cannot open, and a reward that is not the thing it announced. None
 * of them throws, none of them fails a request, and the unit suite was green
 * through all of them — the shop simply did less than it said it did.
 */
describe("store: every powerup is a real, purchasable flight effect", () => {
  it("arms the world's own powerups, so a bought one equals a caught one", () => {
    // Each store powerup's id is also a `PickupKind`, so buying it and catching
    // it run the same code at the same duration. A separate, weaker shop-only
    // version of a powerup is how a store ends up selling something the world
    // does not have.
    // `PickupKind` is a type, so the runnable list of kinds is the style table
    // every one of them must appear in.
    const inWorld = new Set<string>(Object.keys(PICKUP_STYLE));
    for (const id of ["longglide", "wingboost", "feather", "rocket", "cloudboost", "goldenwings"]) {
      expect(inWorld, `${id} is sold but is not a thing you can collect`).toContain(id);
    }
  });

  it("keeps the takeoff boosts and the in-flight powerups on separate ids", () => {
    // `shield` and `magnet` are both a takeoff boost and a world pickup, with
    // genuinely different mechanics. One id for both means one of them silently
    // does the other's job.
    const ids = BOOSTS.map((b) => b.id);
    expect(new Set(ids).size, "two store rows share an id").toBe(ids.length);
    expect(ids).toContain("shield");
    expect(ids).toContain("magnet");
  });

  it("prices every boost above zero, and the permanent ones highest", () => {
    for (const boost of BOOSTS) {
      expect(boost.price, `${boost.name} is free`).toBeGreaterThan(0);
      expect(Number.isInteger(boost.price), `${boost.name} has a fractional price`).toBe(true);
    }
    const permanent = BOOSTS.filter((b) => b.permanent);
    expect(permanent.length, "no permanent upgrades to buy").toBeGreaterThan(0);
    for (const boost of permanent) {
      const cheapest = Math.min(...BOOSTS.filter((b) => !b.permanent).map((b) => b.price));
      expect(boost.price, `${boost.name} is forever but costs less than a one-flight boost`).toBeGreaterThan(cheapest);
    }
  });

  it("describes what it does, not what it is called", () => {
    for (const boost of BOOSTS) {
      expect(boost.desc.length, `${boost.name} has no description`).toBeGreaterThan(8);
      expect(boost.name).not.toBe(boost.desc);
    }
  });

  it("wires a flight effect for every boost it sells", () => {
    // The seam that fails silently: a row in the catalog that `applyBoost`
    // never learned, so the coins leave the wallet and nothing happens. Read as
    // source because the switch is a private method on a class that needs a
    // live AudioContext to construct.
    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    const applyBoost = /private applyBoost\(id: string\): void \{([\s\S]*?)\n  \}/.exec(game)?.[1];
    expect(applyBoost, "applyBoost moved — this test needs to follow it").toBeTruthy();
    for (const boost of BOOSTS.filter((b) => !b.permanent)) {
      expect(applyBoost!, `${boost.id} is sold but applyBoost does nothing with it`).toContain(`case "${boost.id}"`);
    }
  });
});

describe("store: the section jump row opens the sections", () => {
  it("anchors every section the jump row points at", () => {
    // The "Birds · Boosts · Trails" row was three buttons that did nothing: the
    // handler resolved its target from a `data-ref` that no element carried, so
    // every click was a no-op that looked like a scroll. Anchors and targets
    // have to agree, which is only checkable together.
    const hud = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
    // The row is built from a table, so the ids live in the table rather than
    // in the markup — read them from where they are actually written.
    const row = /\[\[\s*"(shopBirds)"[\s\S]*?\]\]\.map/.exec(hud);
    expect(row, "the shop jump row is gone").toBeTruthy();
    const ids = [...row![0].matchAll(/"(shop[A-Za-z]+)"/g)].map((m) => m[1]!);
    expect(ids.sort(), "the jump row lost a section").toEqual(["shopBirds", "shopBoosts", "shopTrails"]);
    for (const id of ids) {
      expect(hud, `the jump row points at ${id} and nothing carries it`).toContain(`data-ref="${id}"`);
    }
  });
});

describe("store: rewards are the thing they announce", () => {
  it("checks the wheel's boost sectors against the boost catalog", () => {
    // The wheel paid a Sun Flask whatever landed, then toasted the sector's
    // own name. A reward that is a different item from its label is the one
    // thing a reward must never be.
    for (const sector of WHEEL_SECTORS) {
      if (sector.kind !== "boost") continue;
      const boost = BOOSTS.find((b) => b.id === sector.value);
      expect(boost, `the wheel promises "${sector.label}" and ${sector.value} is not a boost`).toBeTruthy();
      expect(boost!.name).toBe(sector.label);
    }
  });

  it("reads trail ownership from the field trails are actually owned in", () => {
    // `SaveData.ownTrail` writes `tournaments.trails`; the vault filtered on
    // `ownedUpgrades`, which only ever holds two permanent upgrades. So the
    // filter was always true and the vault re-awarded trails already bought.
    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    // `hatchMysteryVault` holds the payout; `buyMysteryVault` is only the
    // 150-coin wrapper around it. Following the wrapper would test nothing.
    const vault = /private hatchMysteryVault\(\): void \{([\s\S]*?)\n  \}/.exec(game)?.[1];
    expect(vault, "hatchMysteryVault moved — this test needs to follow it").toBeTruthy();
    expect(vault!).toContain("tournaments.trails.includes(id)");
    expect(
      vault!,
      "the vault still filters trails by the permanent-upgrade list",
    ).not.toMatch(/unownedTrails[\s\S]{0,200}ownedUpgrades/);
  });

  it("keeps every shop trail equippable and priced", () => {
    expect(SHOP_TRAILS.length, "the shop has no trails").toBeGreaterThan(0);
    for (const trail of SHOP_TRAILS) {
      expect(trail.price, `${trail.label} is free`).toBeGreaterThan(0);
      expect(trail.css.length, `${trail.label} has no swatch`).toBeGreaterThanOrEqual(2);
      expect(trail.desc.length).toBeGreaterThan(4);
    }
  });
});

describe("store: every bird is viewable as itself", () => {
  it("gives every skin a collection the shop groups by", () => {
    for (const skin of SKINS) {
      expect(skin.collection, `${skin.name} is in no collection, so no filter finds it`).toBeTruthy();
      expect(skin.perk.length, `${skin.name} sells an unstated perk`).toBeGreaterThan(0);
    }
  });
});
