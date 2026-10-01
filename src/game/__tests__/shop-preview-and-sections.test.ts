import { describe, expect, it } from "vitest";

import { renderShop } from "../hud/shop";
import { newShopBrowse } from "../ShopBrowse";
import { skinById, type SkinView } from "../Economy";


/**
 * Two asks about the shop, verbatim: "the preview is poinless in the shop it
 * doesnt do anythign remove it and remove the + or keep them open as default".
 *
 * The preview was a button on every bird card whose entire effect was to change
 * a hero that sits ABOVE the catalog and scroll the page up to it — so a tap on
 * a bird moved the view off the grid and left the only feedback off-screen. The
 * `+` rows were `<details>` disclosures over Boosts and Trails, which put
 * everything a player can buy to spend on a flight behind a collapsed triangle.
 */

type ShopSnapshot = Parameters<typeof renderShop>[0];

const skinView = (over: Partial<SkinView> & { def: SkinView["def"] }): SkinView => ({
  owned: true,
  equipped: false,
  locked: false,
  lockReason: null,
  affordable: true,
  ...over,
});

/**
 * A snapshot with something in it.
 *
 * The first version of this file asserted the preview was gone while rendering
 * `{ skins: [] }` — and the preview button lives ON a skin card, so an empty
 * catalog proves nothing: the assertion passed with the button restored, the
 * same way a lock on an open door passes. A negative claim about markup can
 * only be made against markup that was actually produced, so the default here
 * carries a real owned bird, a real unowned one, and a live daily flash — the
 * two sites the button occupied.
 */
const BLUEJAY = skinById("bluejay");
const EMBER = skinById("ember");

const snapshot = (over: Partial<ShopSnapshot> = {}): ShopSnapshot =>
  ({
    adAvailable: false,
    boosts: [],
    dailyFlash: { id: EMBER.id, price: 600, originalPrice: 1000, discountPct: 40 },
    gold: 0,
    nestLevel: 1,
    nestMaxed: false,
    nestMult: 1,
    nestPrice: 100,
    portalName: "none",
    shopTrails: [],
    skins: [
      skinView({ def: BLUEJAY, owned: true, equipped: true }),
      skinView({ def: EMBER, owned: false, affordable: false }),
    ],
    stipendClaimed: true,
    vip: false,
    wallet: 500,
    wingmanBundle: false,
    ...over,
  }) as ShopSnapshot;

const html = (over: Partial<ShopSnapshot> = {}): string => renderShop(snapshot(over), newShopBrowse());

describe("the shop has no preview control", () => {
  it("emits no preview action anywhere", () => {
    // Both places it used to live: the per-card button and the flash sale.
    // The fixture renders a card per skin and a flash-sale row, so if either
    // site came back this would see the string it emits.
    const out = html();
    expect(out, "the fixture rendered no cards, so this proves nothing").toContain("skin-card");
    expect(out, "the fixture rendered no catalog entry").toContain(BLUEJAY.id);
    expect(out).not.toContain("preview-skin");
  });

  it("offers no control labelled Preview", () => {
    expect(html()).not.toMatch(/>Preview</);
  });

  it("has no leftover state for a previewed bird to live in", () => {
    // A browse object that still carried a `preview` id would be a slot
    // nothing writes and nothing reads, which is where dead UI hides.
    expect(Object.keys(newShopBrowse()).sort()).toEqual(["filter", "query"]);
  });
});

describe("what you can buy is not behind a disclosure", () => {
  it("opens the boosts section by default", () => {
    // `<details open>` and not a CSS trick: a section collapsed by CSS is still
    // collapsed to assistive tech and to the keyboard, so it would only LOOK
    // open. The attribute is what makes it open.
    const out = html();
    const i = out.indexOf('data-ref="shopBoosts"');
    expect(i, "the boosts section is missing").toBeGreaterThan(-1);
    const tag = out.slice(out.lastIndexOf("<details", i), out.indexOf(">", i));
    expect(tag, "the boosts section is collapsed by default").toMatch(/\bopen\b/);
  });

  it("opens the trails section by default", () => {
    const out = html();
    const i = out.indexOf('data-ref="shopTrails"');
    expect(i, "the trails section is missing").toBeGreaterThan(-1);
    const tag = out.slice(out.lastIndexOf("<details", i), out.indexOf(">", i));
    expect(tag, "the trails section is collapsed by default").toMatch(/\bopen\b/);
  });

  it("still lets a player collapse them", () => {
    // Open by default is not the same as not-a-disclosure. A player who wants
    // the shop short still gets to close the sections.
    const out = html();
    const i = out.indexOf('data-ref="shopBoosts"');
    const tag = out.slice(out.lastIndexOf("<details", i), out.indexOf(">", i));
    expect(tag, "the boosts section is not a disclosure any more").toContain("shop-section");
  });
});
