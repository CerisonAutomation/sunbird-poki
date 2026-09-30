/**
 * Booster stock: boosters are an INVENTORY with counts, not a yes/no flag.
 *
 * What the player asked for: buy boosters into a store, keep them, and load
 * however many they like onto the next flight — with the ability to buy on
 * that same screen when it runs dry.
 *
 * What the code used to be: `armedBoosts: string[]` as a SET. Buying a
 * second Shield was refused with "Already armed for next flight", so a
 * player could hold at most one of anything and could never bank one for
 * later. The migration below is the part that quietly loses data if it is
 * wrong, so it gets its own tests.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_KEY } from "../constants";
import { openPayload } from "../resilience/crc";
import { SaveData } from "../SaveData";

/** A pre-stock save, written the way one really lands on disk: bare JSON,
 *  which `openPayload` passes through as a legacy payload. */
const writeLegacy = (fields: Record<string, unknown>) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ deviceId: "dev-legacy", ...fields }));
};

/** Read the live state object out of whatever the save layer wrote. */
const onDisk = (): Record<string, unknown> => {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? (JSON.parse(openPayload(raw).data) as Record<string, unknown>) : {};
};

describe("booster stock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty, with nothing owned and nothing armed", () => {
    const save = new SaveData();
    expect(save.state.boostStock).toEqual({});
    expect(save.state.armedBoosts).toEqual([]);
    expect(save.boostStocked("shield")).toBe(0);
    expect(save.boostArmed("shield")).toBe(0);
  });

  it("lets a player own several copies of the same booster", () => {
    const save = new SaveData();
    save.stockBoost("shield");
    save.stockBoost("shield");
    save.stockBoost("shield");
    expect(save.boostStocked("shield")).toBe(3);
  });

  it("stages from stock without destroying what is not staged", () => {
    const save = new SaveData();
    for (let i = 0; i < 3; i++) save.stockBoost("magnet");
    expect(save.armBoost("magnet", 2)).toBe(2);
    expect(save.boostArmed("magnet")).toBe(2);
    expect(save.boostStocked("magnet")).toBe(3);
    // The two staged are still owned — they are just committed to this flight.
    expect(save.boostStaged("magnet")).toBe(1);
  });

  it("never arms more copies than the player owns", () => {
    const save = new SaveData();
    save.stockBoost("shield");
    // Ask for five, own one.
    expect(save.armBoost("shield", 5)).toBe(1);
    expect(save.boostArmed("shield")).toBe(1);
    save.armBoost("shield", 3);
    expect(save.boostArmed("shield")).toBe(1);
  });

  it("refuses to arm a booster that was never bought", () => {
    const save = new SaveData();
    expect(save.armBoost("shield")).toBe(0);
    expect(save.state.armedBoosts).toEqual([]);
  });

  it("returns a staged copy to storage", () => {
    const save = new SaveData();
    save.stockBoost("sunflask");
    save.stockBoost("sunflask");
    save.armBoost("sunflask", 2);
    expect(save.unarmBoost("sunflask", 1)).toBe(1);
    expect(save.boostArmed("sunflask")).toBe(1);
    expect(save.boostStocked("sunflask")).toBe(2);
    expect(save.boostStaged("sunflask")).toBe(1);
  });

  it("unarm never removes more than is staged", () => {
    const save = new SaveData();
    save.stockBoost("shield");
    save.armBoost("shield");
    expect(save.unarmBoost("shield", 10)).toBe(1);
    expect(save.state.armedBoosts).toEqual([]);
  });

  it("spends exactly the staged copies at takeoff, keeping the rest", () => {
    const save = new SaveData();
    for (let i = 0; i < 4; i++) save.stockBoost("shield");
    save.armBoost("shield", 3);
    const used = save.consumeArmedBoosts();
    expect(used, "three Shields were staged, so three are applied").toEqual(["shield", "shield", "shield"]);
    expect(save.boostStocked("shield"), "one un-staged copy must survive the flight").toBe(1);
    expect(save.state.armedBoosts).toEqual([]);
  });

  it("spends each booster it is owed independently", () => {
    const save = new SaveData();
    save.stockBoost("shield");
    save.stockBoost("magnet");
    save.stockBoost("magnet");
    save.armBoost("shield", 1);
    save.armBoost("magnet", 1);
    const used = save.consumeArmedBoosts();
    expect(used.sort()).toEqual(["magnet", "shield"]);
    expect(save.boostStocked("shield"), "Shield was fully staged and fully spent").toBe(0);
    expect(save.state.boostStock.shield, "a spent-to-zero entry is removed, not left at 0").toBeUndefined();
    expect(save.boostStocked("magnet"), "one Magnet was kept back").toBe(1);
  });

  it("a grant is owned AND staged, because a prize is not something you own twice", () => {
    // This is the wheel, the starter pack and the tournament prize path. If
    // grantBoost only armed, it would award nothing at all — armBoost
    // deliberately refuses to arm more than is stocked.
    const save = new SaveData();
    save.grantBoost("sunflask");
    expect(save.boostStocked("sunflask")).toBe(1);
    expect(save.boostArmed("sunflask")).toBe(1);
  });

  it("grants several copies at once", () => {
    const save = new SaveData();
    save.grantBoost("shield", 2);
    expect(save.boostStocked("shield")).toBe(2);
    expect(save.boostArmed("shield")).toBe(2);
  });

  it("persists stock across a reload", () => {
    const save = new SaveData();
    save.stockBoost("magnet");
    save.stockBoost("magnet");
    save.armBoost("magnet", 1);
    const reloaded = new SaveData();
    expect(reloaded.boostStocked("magnet")).toBe(2);
    expect(reloaded.boostArmed("magnet")).toBe(1);
  });
});

describe("booster stock migration from the old set-shaped save", () => {
  it("seeds stock for boosters an old save had armed", () => {
    // An old save recorded no stock — the armed list WAS the whole record.
    // Dropping it would silently delete boosters a paid player already had.
    writeLegacy({ armedBoosts: ["shield", "magnet"] });
    const save = new SaveData();
    expect(save.boostStocked("shield")).toBe(1);
    expect(save.boostStocked("magnet")).toBe(1);
    expect(save.boostArmed("shield")).toBe(1);
  });

  it("seeds enough stock for repeats in an old armed list", () => {
    writeLegacy({ armedBoosts: ["shield", "shield", "shield"] });
    const save = new SaveData();
    expect(save.boostStocked("shield"), "three armed copies means three owned").toBe(3);
  });

  it("never lowers stock that the save already recorded", () => {
    writeLegacy({ boostStock: { shield: 4 }, armedBoosts: ["shield"] });
    const save = new SaveData();
    expect(save.boostStocked("shield"), "a richer recorded stock must win over the armed count").toBe(4);
  });

  it("leaves a save with no boosts alone", () => {
    writeLegacy({ armedBoosts: [] });
    const save = new SaveData();
    expect(save.state.boostStock).toEqual({});
  });

  it("sanitizes a hostile stock payload", () => {
    // Built by parsing raw JSON, not an object literal: `{__proto__: x}` in a
    // literal sets the prototype instead of creating an own key, so a literal
    // here would test nothing. JSON.parse does create a real own "__proto__".
    const hostile = JSON.parse('{"shield":3,"magnet":-5,"junk":"lots","sunflask":2.9,"__proto__":{"polluted":1}}') as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(hostile, "__proto__"), "the fixture must really carry an own __proto__ key").toBe(true);
    writeLegacy({ boostStock: hostile });
    const save = new SaveData();
    expect(save.state.boostStock.shield).toBe(3);
    expect(save.state.boostStock.sunflask, "2.9 floors to 2").toBe(2);
    expect(save.state.boostStock.magnet, "a negative count is dropped, never stored").toBeUndefined();
    expect(save.state.boostStock.junk, "a non-numeric count is dropped").toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(save.state.boostStock, "__proto__"), "a __proto__ key must not be smuggled through").toBe(false);
    expect(({} as Record<string, unknown>).polluted, "the parsed fixture polluted nothing, so this proves nothing either").toBeUndefined();
  });

  it("refuses a non-object stock payload instead of iterating it", () => {
    for (const bad of [["shield"], 42, "nope", null]) {
      writeLegacy({ boostStock: bad });
      const save = new SaveData();
      expect(save.state.boostStock, `stock ${JSON.stringify(bad)} must load empty`).toEqual({});
    }
  });

  it("keeps the migrated stock through a fresh persist", () => {
    writeLegacy({ armedBoosts: ["shield"] });
    const save = new SaveData();
    save.persist();
    expect((onDisk().boostStock as Record<string, number>).shield).toBe(1);
  });
});
