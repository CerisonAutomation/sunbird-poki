import { describe, expect, it } from "vitest";
import { renderLoadout } from "../hud/loadout";
import { renderShop } from "../hud/shop";
import { newShopBrowse } from "../ShopBrowse";
import { SHOP_TRAILS, skinById, type ShopTrailView, type SkinView } from "../Economy";
import type { HudSnapshot } from "../hud/types";

/**
 * Trail swatches: does the colour the data describes survive into the browser?
 *
 * `ShopTrailDef.css` is a list of colour STOPS. Written straight into a
 * `background` shorthand they produce `background:#a, #b, #c`, which is not a
 * declaration any CSS parser accepts, so the browser drops the whole thing and
 * the swatch renders with whatever the stylesheet gave it — which for the
 * loadout screen's `.pf-swatch` is nothing at all, because it sets no
 * background to fall back on. The trail then shows as a blank pill: a cosmetic
 * that is paid for, owned, equipped, and invisible.
 *
 * The oracle here is the CSSOM, not a string. Setting the rendered value on a
 * real element and reading it back is exactly what the browser does with it, so
 * an invalid declaration fails this test the way it fails on screen. A
 * `toContain("linear-gradient")` check would not: it can only be satisfied by
 * the characters being present, never falsified by a parser rejecting them.
 */

function doc(inner: string): Document {
  return new DOMParser().parseFromString(`<body>${inner}</body>`, "text/html");
}

/** What the browser actually kept of an element's inline `background`. */
function keptBackground(style: string): string {
  const el = document.createElement("i");
  el.setAttribute("style", style);
  return (el as HTMLElement).style.background;
}

function loadout(shopTrails: ShopTrailView[]): string {
  return renderLoadout({
    boosts: [],
    loadout: { bird: "Sunbird", trail: "—" },
    shopTrails,
    skins: [] as SkinView[],
    wallet: 0,
  } as unknown as HudSnapshot);
}

function shop(shopTrails: ShopTrailView[]): string {
  return renderShop({
    adAvailable: false,
    boosts: [],
    dailyFlash: null,
    gold: 0,
    nestLevel: 1,
    nestMaxed: false,
    nestMult: 1,
    nestPrice: 500,
    portalName: "itch",
    shopTrails,
    skins: [{ def: skinById("sunbird"), owned: true, equipped: true, locked: false, lockReason: null, affordable: true }],
    stipendClaimed: false,
    vip: false,
    wallet: 0,
    wingmanBundle: null,
  } as unknown as Parameters<typeof renderShop>[0], { ...newShopBrowse(), preview: "" });
}

const everyTrail: ShopTrailView[] = SHOP_TRAILS.map((def) => ({ def, owned: true, equipped: false, affordable: true }));

/** The inline `style` of every swatch on the page, in DOM order. */
function swatchStyles(html: string, selector: string): string[] {
  return [...doc(html).querySelectorAll<HTMLElement>(selector)].map((el) => el.getAttribute("style") ?? "");
}

describe("trail swatches survive the CSS parser", () => {
  it("keeps the loadout swatch's colour instead of dropping the declaration", () => {
    // The screen that showed blank pills. `.pf-swatch` declares no background,
    // so a dropped declaration is a swatch with no colour at all.
    const styles = swatchStyles(loadout(everyTrail), ".pf-swatch");
    expect(styles.length).toBe(SHOP_TRAILS.length);
    for (const style of styles) {
      expect(keptBackground(style), style).not.toBe("");
    }
  });

  it("keeps the shop swatch's colour too", () => {
    const styles = swatchStyles(shop(everyTrail), ".trail-swatch");
    expect(styles.length).toBe(SHOP_TRAILS.length);
    for (const style of styles) {
      expect(keptBackground(style), style).not.toBe("");
    }
  });

  it("paints every stop the trail defines, not a single flat colour", () => {
    // A declaration that parses but drops stops would render a solid pill and
    // still pass the check above. The gradient has to carry one stop per entry
    // in `def.css`.
    for (const def of SHOP_TRAILS) {
      expect(def.css.length, def.id).toBeGreaterThan(1);
      const style = swatchStyles(loadout([{ def, owned: true, equipped: false, affordable: true }]), ".pf-swatch")[0]!;
      const kept = keptBackground(style);
      expect(kept, def.id).toContain("gradient");
      // rgb() per stop, so the count is the parser's, not the source's.
      expect(kept.match(/rgb\(/g)?.length ?? 0, `${def.id}: ${style}`).toBe(def.css.length);
    }
  });

  it("agrees with the shop: the same trail is the same colour on both screens", () => {
    // Two screens, two builders, one set of stops. If they drift, a player
    // picks a trail by its colour in one place and finds a different ribbon in
    // the air.
    const onLoadout = swatchStyles(loadout(everyTrail), ".pf-swatch");
    const inShop = swatchStyles(shop(everyTrail), ".trail-swatch");
    expect(onLoadout.map(keptBackground)).toEqual(inShop.map(keptBackground));
  });

  it("still drops an unwrapped stop list, so the test can tell a real fix from a no-op", () => {
    // A canary. Without it, a mutation that replaced the wrapper with something
    // the parser happens to accept (or a test that stopped setting the style at
    // all) would pass the assertions above for the wrong reason.
    expect(keptBackground("background:#ff8a3a, #ff4a2a, #ffd27a")).toBe("");
    // Two stops, because a one-stop gradient is rejected by the same parser —
    // which is why every trail defines at least two, and why the stop-count
    // assertion above is not decoration.
    expect(keptBackground("background:linear-gradient(90deg, #ff8a3a, #ff4a2a)")).not.toBe("");
  });
});
