import { describe, expect, it } from "vitest";
import { renderShop } from "../hud/shop";
import { newShopBrowse } from "../ShopBrowse";
import { shopAction, type ShopActionContext } from "../actions/shop";
import { SHOP_TRAILS, SKINS, skinById, type ShopTrailView, type SkinView } from "../Economy";
import { SaveData } from "../SaveData";
import type { GameAudio } from "../Audio";
import type { Bird } from "../Bird";
import type { HUD } from "../HUD";
import type { ParticleFX } from "../ParticleFX";
import type { Telemetry } from "../Telemetry";

/**
 * Selecting a bird and selecting a trail from the shop.
 *
 * Both bugs here are the same shape, and the shape is why string assertions
 * were not enough: the MARKUP was fine and the handler was fine, and the
 * player still could not select the thing. A control that looks live, reports
 * no error, and changes nothing is the failure this file exists to catch — so
 * the assertions below are about what a press RESOLVES TO, not about which
 * action string happens to be in the HTML.
 *
 * Nothing here boots a Game (it cannot under jsdom — `clearRect` on a null
 * context). The shop is a pure `(snapshot) => html` builder and the action
 * table is a pure `shopAction(ctx, action, id)`, and the seam between them is
 * exactly the thing under test: the id the markup emits, fed verbatim into the
 * handler, has to select that cosmetic and nothing else.
 */

type ShopSnapshot = Parameters<typeof renderShop>[0];

const STARTER = skinById("sunbird");
const BLUEJAY = skinById("bluejay");
const EMBER = skinById("ember");

function skinView(over: Partial<SkinView> & { def: SkinView["def"] }): SkinView {
  return { owned: true, equipped: false, locked: false, lockReason: null, affordable: true, ...over };
}

function trailView(over: Partial<ShopTrailView> & { def: ShopTrailView["def"] }): ShopTrailView {
  return { owned: true, equipped: false, affordable: true, ...over };
}

/**
 * A save pinned to a known inventory.
 *
 * `new SaveData()` is not isolated from a sibling instance in the same file —
 * two instances constructed one after another see each other's cosmetics — so
 * every test states its own starting inventory instead of assuming one. A
 * negative assertion ("this id is refused") is only worth anything if the id
 * really is absent when the handler runs, and a leaked `ownTrail` from an
 * earlier test would quietly make it present.
 */
function saveWith(over: { skins?: string[]; trails?: string[]; activeSkin?: string; activeTrail?: string } = {}): SaveData {
  const save = new SaveData();
  save.state.ownedSkins = over.skins ?? ["sunbird"];
  save.state.activeSkin = over.activeSkin ?? "sunbird";
  save.state.tournaments.trails = over.trails ?? [];
  save.state.activeTrail = over.activeTrail ?? "";
  return save;
}

function snapshot(over: Partial<ShopSnapshot> = {}): ShopSnapshot {
  return {
    adAvailable: false,
    boosts: [],
    dailyFlash: null,
    gold: 0,
    nestLevel: 1,
    nestMaxed: false,
    nestMult: 1,
    nestPrice: 500,
    portalName: "itch",
    shopTrails: [],
    skins: [],
    stipendClaimed: false,
    vip: false,
    wallet: 0,
    wingmanBundle: null,
    ...over,
  } as unknown as ShopSnapshot;
}

const html = (over: Partial<ShopSnapshot> = {}): string =>
  renderShop(snapshot({ skins: [skinView({ def: STARTER, equipped: true })], ...over }), newShopBrowse());

/**
 * The DOM node a press on `target` actually reaches.
 *
 * This is HUD.ts's dispatch, copied rather than imported because the HUD needs
 * a live root: `closest("[data-action]")`, innermost-first, and `null` when
 * nothing on the way up declares one. A press that lands on the inert middle of
 * a card and gets `null` back is precisely the bug — the tap was swallowed with
 * no error and no visible change.
 */
function pressTarget(out: string, id: string, selector: string): [string, string] | null {
  const card = [...dom(out).querySelectorAll<HTMLElement>(".skin-card")].find((el) => el.dataset.skin === id);
  const target = card?.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`no ${selector} inside the ${id} card`);
  const hit = target.closest<HTMLElement>("[data-action]");
  return hit ? [hit.dataset.action!, hit.dataset.id ?? ""] : null;
}

/** The card element for one bird. */
function card(out: string, id: string): HTMLElement {
  const el = [...dom(out).querySelectorAll<HTMLElement>(".skin-card")].find((c) => c.dataset.skin === id);
  expect(el, `no skin card for ${id}`).toBeTruthy();
  return el!;
}

/** Every (action, id) pair a press inside one card can reach, in DOM order. */
function cardTargets(el: HTMLElement): [string, string][] {
  const nodes = [el, ...el.querySelectorAll<HTMLElement>("[data-action]")];
  return nodes
    .filter((n) => n.dataset.action)
    .map((n) => [n.dataset.action!, n.dataset.id ?? ""]);
}

/**
 * The rendered shop, as a document.
 *
 * Slicing the markup with `split` to "find the card for X" is how a test ends
 * up asserting about the page header: the string before the first card contains
 * the shop's own prose, so a `find` on a name that also appears there returns
 * the wrong slice and the assertion passes for the wrong reason. The DOM has no
 * such ambiguity.
 */
function dom(out: string): Document {
  return new DOMParser().parseFromString(`<body>${out}</body>`, "text/html");
}

/** The trail card whose title is this trail's label, as HTML. */
function trailCard(out: string, id: string, label: string): string {
  const card = [...dom(out).querySelectorAll<HTMLElement>(".trail-card")]
    .find((el) => el.querySelector("b")?.textContent === label);
  expect(card, `no trail card titled ${label} (${id})`).toBeTruthy();
  return card!.outerHTML;
}

function context(save: SaveData, calls: string[], over: Partial<ShopActionContext> = {}): ShopActionContext {
  return {
    save,
    hud: { toast: () => {} } as unknown as HUD,
    audio: { chapterFanfare() {}, fanfare() {}, ding() {} } as unknown as GameAudio,
    particles: { emitConfetti() {} } as unknown as ParticleFX,
    bird: { x: 0, y: 0 } as unknown as Bird,
    telemetry: { track: () => {} } as unknown as Telemetry,
    platform: null,
    shopAdClaimed: 0,
    checkoutBusy: false,
    adsLive: () => true,
    multiplyCoinsFromShopAd: async () => {},
    setScreen: () => {},
    backScreen: () => {},
    bump: () => calls.push("bump"),
    buySkin: () => calls.push("buySkin"),
    buyBoost: () => {},
    buyTrail: (id) => calls.push("buyTrail:" + id),
    armBoost: () => 0,
    unarmBoost: () => 0,
    buyCoinStarter: () => {},
    buyCoinGold: () => {},
    buyPortalVip: () => {},
    buyMysteryVault: () => {},
    applySkin: () => calls.push("applySkin"),
    restore: () => {},
    redeem: () => {},
    redeemReferral: () => {},
    importCloud: () => {},
    copyWithFeedback: async () => {},
    ...over,
  };
}

/* ------------------------------------------------------------- birds ---- */

describe("shop: selecting a bird", () => {
  const two = { skins: [skinView({ def: STARTER, equipped: true }), skinView({ def: BLUEJAY })] };

  it("resolves a press anywhere on an owned card to selecting that bird", () => {
    // The card is drawn as a control — pointer cursor, hover lift, press shadow
    // — and it declared no action, so every press that was not exactly on the
    // 104px Preview art or the small button at the foot resolved to `null`:
    // the tap was swallowed with no error and nothing changed. The name and the
    // perk line are the biggest inert targets on the card, so they are the ones
    // checked here.
    const out = html(two);
    for (const selector of [".sk-name", ".sk-perk", ".rarity"]) {
      expect(pressTarget(out, BLUEJAY.id, selector), selector).toEqual(["select-skin", BLUEJAY.id]);
    }
  });

  it("leaves the card art inert and the button as the only way to equip", () => {
    // The preview control is gone: it scrolled the page back up to a hero
    // above the catalog, so a tap on a bird moved the view away from the grid
    // and the only feedback was off-screen. What this still has to protect is
    // that the whole-card wrapper does not swallow the one real control
    // nested inside it, so Equip stays reachable.
    const out = html(two);
    // The art carries no action of its own, so a press on it resolves to the
    // card's own select — which is the point of dressing an owned card as a
    // control. What must NOT come back is the old preview action, from either
    // the art or anywhere else on the card.
    expect(out, "the preview control is still in the shop").not.toContain("preview-skin");
    expect(pressTarget(out, BLUEJAY.id, ".skin-art")).toEqual(["select-skin", BLUEJAY.id]);
    expect(pressTarget(out, BLUEJAY.id, ".mini-btn")).toEqual(["equip-skin", BLUEJAY.id]);
  });

  it("leaves the in-use card inert so a press cannot toggle the bird off", () => {
    // The Preview art stays — looking at the bird you are flying is not a
    // change to it — but the card itself offers no selection, because the one
    // thing the in-use bird cannot be is a different bird.
    const out = html({ skins: [skinView({ def: STARTER, equipped: true })] });
    const el = card(out, STARTER.id);
    expect(el.dataset.action).toBeUndefined();
    expect(pressTarget(out, STARTER.id, ".sk-name")).toBeNull();
    expect(cardTargets(el).map(([a]) => a)).not.toContain("select-skin");
  });

  it("never puts a spending action on a card the player does not own", () => {
    // The wrapper fires on a press ANYWHERE on the card, including the corners
    // a mis-aimed thumb lands on, so it may only ever select something the
    // player already has. A purchase stays on the button that shows the price.
    const out = html({
      wallet: 9999,
      skins: [skinView({ def: STARTER, equipped: true }), skinView({ def: EMBER, owned: false })],
    });
    expect(card(out, EMBER.id).dataset.action).toBeUndefined();
    expect(cardTargets(card(out, EMBER.id)).map(([a]) => a)).not.toContain("select-skin");
    expect(pressTarget(out, EMBER.id, ".sk-name")).toBeNull();
    // …and the price button it does have is still there and still buys.
    expect(pressTarget(out, EMBER.id, ".mini-btn")).toEqual(["buy-skin", EMBER.id]);
  });

  it("cannot resolve a card press ambiguously", () => {
    // `MenuContinuity` restores focus after a repaint by matching
    // (action, id) against every element carrying that pair, and takes the
    // FIRST match. A wrapper repeating its button's pair would match first, and
    // the button is what a keyboard user had focused.
    const targets = cardTargets(card(html(two), BLUEJAY.id));
    const keys = targets.map((t) => t.join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("selects the bird the card names — the id survives the trip to the handler", () => {
    // The end-to-end shape of "I can't select the bird": press the card, take
    // the action and id the press resolved to, hand them to the action table
    // exactly as HUD.ts does, and require the save to end up on that bird. A
    // slug the lookup does not know, or a guard that refuses a valid id, fails
    // here and nowhere else would.
    const save = saveWith({ skins: ["sunbird", BLUEJAY.id] });
    const out = html(two);
    const press = pressTarget(out, BLUEJAY.id, ".sk-perk")!;
    const calls: string[] = [];
    expect(shopAction(context(save, calls), press[0], press[1])).toBe(true);
    expect(save.state.activeSkin).toBe(BLUEJAY.id);
    // The bird you actually fly changes, and the screen repaints, or the
    // selection would be invisible even though it stuck.
    expect(calls).toContain("applySkin");
    expect(calls).toContain("bump");
  });

  it("refuses a bird the player does not own without dinging or repainting", () => {
    // The table is not the guard — `SaveData.equipSkin` is — but it must not
    // then announce a success the state did not have. Same rule as
    // `loadout-trail` and `select-trail`.
    const save = saveWith();
    const calls: string[] = [];
    expect(shopAction(context(save, calls), "select-skin", EMBER.id)).toBe(true);
    expect(save.state.activeSkin).not.toBe(EMBER.id);
    expect(calls).not.toContain("applySkin");
    expect(calls).not.toContain("bump");
  });
});

/* ------------------------------------------------------------ trails ---- */

describe("shop: selecting a trail", () => {
  const owned = trailView({ def: SHOP_TRAILS[1]! });
  const forSale = trailView({ def: SHOP_TRAILS[2]!, owned: false, affordable: true });

  it("equips a trail the player already owns instead of re-buying it", () => {
    // `Game.buyTrail` TOGGLES a trail that is already owned, so the button
    // labelled "Equip" switched the ribbon OFF on the second press. The card
    // says Equip; it has to equip.
    const out = html({ shopTrails: [owned] });
    expect(trailCard(out, owned.def.id, owned.def.label)).toContain('data-action="select-trail"');
    expect(trailCard(out, owned.def.id, owned.def.label)).not.toContain('data-action="buy-trail"');
  });

  it("still sells an unowned trail through the purchase path", () => {
    const out = html({ shopTrails: [forSale] });
    expect(trailCard(out, forSale.def.id, forSale.def.label)).toContain('data-action="buy-trail"');
    expect(trailCard(out, forSale.def.id, forSale.def.label)).not.toContain('data-action="select-trail"');
  });

  it("shows the in-use trail as a state, not a button", () => {
    // Scoped by the LABEL here, not the id: the in-use card is the one trail
    // that emits no button, so it is the one card that carries no `data-id` to
    // find it by — which is exactly the shape of the bug being ruled out.
    const out = html({ shopTrails: [{ ...owned, equipped: true }, forSale] });
    const card = trailCard(out, owned.def.id, owned.def.label);
    expect(card).toContain("✓ In use");
    expect(card).not.toContain("data-action=");
  });

  it("equips the trail the card names, and never spends to do it", () => {
    const save = saveWith({ trails: [owned.def.id] });
    const out = html({ shopTrails: [owned] });
    const id = trailCard(out, owned.def.id, owned.def.label).match(/data-action="select-trail" data-id="([^"]+)"/)?.[1] ?? "";
    expect(id).toBe(owned.def.id);
    const calls: string[] = [];
    expect(shopAction(context(save, calls), "select-trail", id)).toBe(true);
    expect(save.state.activeTrail).toBe(owned.def.id);
    expect(calls.some((c) => c.startsWith("buyTrail"))).toBe(false);
  });

  it("refuses a trail the player does not own, and does not buy it for them", () => {
    const save = saveWith();
    const calls: string[] = [];
    expect(shopAction(context(save, calls), "select-trail", owned.def.id)).toBe(true);
    expect(save.state.activeTrail).not.toBe(owned.def.id);
    expect(calls.some((c) => c.startsWith("buyTrail"))).toBe(false);
    expect(calls).not.toContain("bump");
  });

  it("leaves the prize-screen toggle alone", () => {
    // `equip-trail` is Game.ts's TOGGLE for the trophy screen, and it is still
    // reachable there. The shop's equip is a different string precisely so it
    // cannot swallow that one.
    const save = saveWith({ trails: [owned.def.id] });
    const calls: string[] = [];
    expect(shopAction(context(save, calls), "equip-trail", owned.def.id)).toBe(false);
  });

  it("gives every shop trail a card that names it, with a real price", () => {
    // A trail whose id, label or price is missing renders as `undefined` and
    // is unreachable, so the inventory is walked rather than spot-checked.
    const out = html({ wallet: 100_000, shopTrails: SHOP_TRAILS.map((d) => trailView({ def: d, owned: false, affordable: true })) });
    for (const def of SHOP_TRAILS) {
      expect(out, def.id).toContain(`data-action="buy-trail" data-id="${def.id}"`);
      expect(out, def.id).toContain(`● ${def.price}</button>`);
      expect(out, def.id).not.toContain("undefined");
      expect(out, def.id).not.toContain("NaN");
    }
  });

  it("shows a shortfall, never a negative one, and never a zero price", () => {
    const poor = trailView({ def: SHOP_TRAILS[0]!, owned: false, affordable: false });
    const out = html({ wallet: 0, shopTrails: [poor] });
    expect(out).toContain(`Need ${poor.def.price}●`);
    expect(out).not.toContain("Need -");
    expect(out).not.toContain("● 0</button>");
  });
});

/* ----------------------------------------------------------- loadout ---- */

describe("loadout: selecting a bird", () => {
  it("equips an owned bird", () => {
    const save = saveWith({ skins: ["sunbird", EMBER.id] });
    const calls: string[] = [];
    expect(shopAction(context(save, calls), "loadout-bird", EMBER.id)).toBe(true);
    expect(save.state.activeSkin).toBe(EMBER.id);
    expect(calls).toContain("applySkin");
  });

  it("refuses a bird the player does not own", () => {
    // Same rule the shop and the trail rows follow. Without it the table dings
    // and repaints for a pick that `SaveData.equipSkin` threw away, so the
    // screen looks like it accepted a bird it did not.
    const save = saveWith();
    const calls: string[] = [];
    expect(shopAction(context(save, calls), "loadout-bird", EMBER.id)).toBe(true);
    expect(save.state.activeSkin).not.toBe(EMBER.id);
    expect(calls).not.toContain("applySkin");
    expect(calls).not.toContain("bump");
  });
});

/* -------------------------------------------------------------- shop ---- */

describe("shop: the grid renders every bird it is given", () => {
  it("emits one card per skin, each addressable by its own id", () => {
    const out = html({ skins: SKINS.slice(0, 12).map((def, i) => skinView({ def, equipped: i === 0 })) });
    for (const def of SKINS.slice(0, 12)) {
      expect(out, def.id).toContain(`data-skin="${def.id}"`);
    }
  });
});
