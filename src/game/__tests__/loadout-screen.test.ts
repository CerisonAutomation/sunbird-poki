import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOADOUT_MAX_BOOSTS, freeSlots, renderLoadout, stagedSlots } from "../hud/loadout";
import { BOOSTS, type BoostView, type ShopTrailView, type SkinView } from "../Economy";
import type { HudSnapshot } from "../hud/types";

/**
 * The pre-flight loadout screen.
 *
 * This screen exists to make three numbers true at once and visible: what the
 * player OWNS, what is STAGED, and what they can still STAGE. The failure mode
 * it was built to kill is a control that lies — a `+` that does nothing, a
 * `−` on nothing, an upgrade with a "stage" button that cannot be staged. A
 * lying button is worse than a missing one: the player taps, nothing happens,
 * and they conclude the booster is broken.
 *
 * So most of what follows asserts about the DISABLED state of a control, not
 * merely its presence. Every assertion here has been mutation-checked; see the
 * comments on the ones where a plausible-looking edit would still pass a
 * presence-only test.
 */

const SHIELD = BOOSTS.find((b) => b.id === "shield")!;
const MAGNET = BOOSTS.find((b) => b.id === "magnet")!;
const TRIGGER = BOOSTS.find((b) => b.id === "doubletap")!;

function boostView(over: Partial<BoostView> & { def: BoostView["def"] }): BoostView {
  return {
    armed: false,
    affordable: true,
    stocked: 0,
    armedCount: 0,
    spare: 0,
    permanent: false,
    ...over,
  };
}

function snapshot(over: Partial<HudSnapshot> = {}): HudSnapshot {
  return {
    boosts: [boostView({ def: SHIELD }), boostView({ def: MAGNET }), boostView({ def: TRIGGER })],
    loadout: { bird: "Sunbird", trail: "Dawn" },
    shopTrails: [] as ShopTrailView[],
    skins: [] as SkinView[],
    wallet: 0,
    ...over,
  } as unknown as HudSnapshot;
}

const html = (over: Partial<HudSnapshot> = {}): string => renderLoadout(snapshot(over));

/**
 * The `+` / `−` buttons for ONE booster row.
 *
 * Scoped by `data-id` on purpose. An unscoped match returns the first button on
 * the screen, which is frequently disabled for a reason that has nothing to do
 * with the property under test — that is how a cap assertion ends up passing
 * against a build with no cap in it at all.
 */
function steps(html: string, id = "shield"): { add?: string; drop?: string } {
  const row = html.split(`data-ref="pf-stock-${id}"`)[1] ?? "";
  return {
    add: row.match(/data-action="loadout-boost-add"[^>]*>/)?.[0],
    drop: row.match(/data-action="loadout-boost-drop"[^>]*>/)?.[0],
  };
}

/** The "Need N coins" tag, scoped so a stray `-` elsewhere cannot pass. */
function needTag(html: string): string {
  return html.match(/<span class="tag need">[^<]*<\/span>/)?.[0] ?? "";
}

/**
 * The body of one method, up to the next member declaration.
 *
 * Slicing to end-of-file instead makes these source checks read the whole
 * class: a `def.permanent` in `buyBoost` satisfies an assertion about
 * `stageBoost`, and the check passes on a build that removed the very guard it
 * was written to pin. That survivor was real, not hypothetical.
 */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`no method matching ${signature}`);
  const rest = source.slice(start + signature.length);
  const end = rest.search(/\n  (?:private|public|protected|async|static|get |set )/);
  const body = end < 0 ? rest : rest.slice(0, end);
  // Comments go. A doc line saying "the SAME freeSlots() the loadout screen
  // uses" contains the substring `freeSlots(`, so a plain toContain was
  // satisfied by the prose explaining the very call it was checking for.
  return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("slot arithmetic", () => {
  // This is the single definition of "full", shared by the screen and by the
  // mutation site in Game. It is tested on its own because the two consumers
  // cannot both be booted here (a Game needs a real 2D context), and a shared
  // helper that drifts is worse than two private copies — it silently
  // validates both.
  it("sums the staged copies", () => {
    expect(stagedSlots([2, 0, 4])).toBe(6);
    expect(stagedSlots([])).toBe(0);
  });

  it("reports free slots, never negative", () => {
    expect(freeSlots([0])).toBe(LOADOUT_MAX_BOOSTS);
    expect(freeSlots([LOADOUT_MAX_BOOSTS])).toBe(0);
    // Over-full is reachable transiently — an old save, a migration — and the
    // allowance a caller uses it for must not come back negative.
    expect(freeSlots([LOADOUT_MAX_BOOSTS + 4])).toBe(0);
  });

  it("is the cap the mutation site enforces, not a second copy of it", () => {
    // Game cannot be booted under jsdom (no 2D context), so the guard that
    // actually refuses an over-cap stage is checked at the source instead.
    // The failure this prevents is specific: someone re-inlining `MAX - used`
    // inside Game, at which point the button and the guard are separate
    // expressions again and the tests above stop covering the real one.
    const stageBoost = methodBody(readFileSync("src/game/Game.ts", "utf8"), "private stageBoost");
    expect(stageBoost).toContain("freeSlots(");
    // And it must still clamp: a room of 3 asked for 5 stages 3.
    expect(stageBoost).toContain("Math.min(n, room)");
    // A permanently-unlocked upgrade is not stockable, so it is not staged.
    expect(stageBoost).toContain("def.permanent");
    // …and the lookup is by the id that was asked for. A `find(() => true)`
    // here still passes every other assertion on this page while letting an
    // unknown id fall through to `armBoost`.
    expect(stageBoost).toContain("b.id === id");
    // `<=` not `<`. freeSlots clamps at zero, so a strict `<` makes the branch
    // unreachable: an over-cap stage then falls through to `armBoost(id, 0)`
    // and tells the player they have none left, when what they actually have
    // is no free slots. Same cap, wrong explanation, on every attempt.
    expect(stageBoost).toContain("room <= 0");
  });

  it("agrees with the meter the screen prints", () => {
    for (const counts of [[0], [1], [3, 2], [LOADOUT_MAX_BOOSTS], [LOADOUT_MAX_BOOSTS + 2]]) {
      const out = html({
        boosts: [
          boostView({ def: SHIELD, stocked: 9, armedCount: counts[0] ?? 0, spare: 9 }),
          boostView({ def: MAGNET, stocked: 9, armedCount: counts[1] ?? 0, spare: 9 }),
        ],
      });
      const used = stagedSlots(counts);
      expect(out).toContain(`${used} / ${LOADOUT_MAX_BOOSTS}`);
      // The button and the meter are two readings of one number; if they ever
      // diverge, the player is told "full" by a label and "room" by a button.
      const room = freeSlots(counts);
      expect(steps(out, "shield").add?.includes("disabled")).toBe(room <= 0);
    }
  });
});

describe("loadout screen", () => {
  it("stages six boosters", () => {
    // Every other assertion here reads LOADOUT_MAX_BOOSTS symbolically, so
    // without this one the constant could change and the whole file would
    // still be green. Six is the shipped number and it is player-facing: it is
    // what the meter promises and what the store has to sell against.
    expect(LOADOUT_MAX_BOOSTS).toBe(6);
  });

  describe("ownership is stated, not implied", () => {
    it("shows owned and staged counts for every stockable booster", () => {
      const out = html({
        boosts: [boostView({ def: SHIELD, stocked: 3, armedCount: 1, spare: 2 })],
      });
      expect(out).toContain(">Owned: <b>3</b></span>");
      expect(out).toContain(">Staged: <b>1</b></span>");
    });

    it("counts what is spare only when there is a spare", () => {
      const withSpare = html({ boosts: [boostView({ def: SHIELD, stocked: 3, armedCount: 1, spare: 2 })] });
      expect(withSpare).toContain("+2");

      const allStaged = html({ boosts: [boostView({ def: SHIELD, stocked: 3, armedCount: 3, spare: 0 })] });
      expect(allStaged).not.toContain("+0");
      expect(allStaged).not.toContain("in store");
    });

    it("shows a zero-owned booster rather than hiding it", () => {
      // The store is the point of the screen. A booster the player has never
      // bought still needs a row, or the shelf has a hole in it and the screen
      // reads as a bug instead of an invitation.
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 0, armedCount: 0 })] });
      expect(out).toContain(">Owned: <b>0</b></span>");
      expect(out).toContain('data-action="buy-boost"');
    });
  });

  describe("the steppers tell the truth about what they will do", () => {
    it("disables `+` when there is no spare copy, even though the row exists", () => {
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 1, armedCount: 1, spare: 0 })] });
      expect(steps(out).add).toBeDefined();
      expect(steps(out).add).toContain("disabled");
    });

    it("disables `+` at the cap even though a spare is in hand", () => {
      // The exact case a presence-only test misses, and the one a
      // "check the first row" test misses too: ONE booster, six staged, three
      // spare. Every reason to enable `+` is true except the cap. Drop the cap
      // check from the source and this is the assertion that fails.
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 9, armedCount: LOADOUT_MAX_BOOSTS, spare: 3 })] });
      expect(steps(out).add).toContain("disabled");
      // The meter has to agree, or the player is left guessing which is wrong.
      expect(out).toContain("pf-warn");
    });

    it("enables `+` for a spare booster one slot short of the cap", () => {
      // The control side of the test above. Without it, `+` could be disabled
      // unconditionally and both assertions would pass.
      const out = html({
        boosts: [boostView({ def: SHIELD, stocked: 4, armedCount: LOADOUT_MAX_BOOSTS - 1, spare: 1 })],
      });
      expect(steps(out).add).not.toContain("disabled");
      expect(out).not.toContain("pf-warn");
    });

    it("counts the cap across every booster, not per row", () => {
      // Two rows that are each well under the cap still fill it together. This
      // is the other half of the cap invariant: the meter is global, so the
      // check has to be too.
      const full: BoostView[] = [
        boostView({ def: SHIELD, stocked: 2, armedCount: 2, spare: 0 }),
        boostView({ def: MAGNET, stocked: 9, armedCount: 4, spare: 5 }),
      ];
      expect(html({ boosts: full })).toContain(`6 / ${LOADOUT_MAX_BOOSTS}`);

      const sameButOneSlotShort: BoostView[] = [
        boostView({ def: SHIELD, stocked: 2, armedCount: 2, spare: 0 }),
        boostView({ def: MAGNET, stocked: 9, armedCount: 3, spare: 6 }),
      ];
      const out = html({ boosts: sameButOneSlotShort });
      expect(out).toContain(`5 / ${LOADOUT_MAX_BOOSTS}`);
      expect(steps(out, "magnet").add).not.toContain("disabled");
    });

    it("disables `−` when nothing is staged", () => {
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 2, armedCount: 0, spare: 2 })] });
      expect(steps(out).drop).toContain("disabled");
    });

    it("enables both when there is a spare and something staged", () => {
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 3, armedCount: 1, spare: 2 })] });
      expect(steps(out).add).not.toContain("disabled");
      expect(steps(out).drop).not.toContain("disabled");
    });

    it("keeps both steppers in the DOM when disabled", () => {
      // A control that vanishes mid-adjustment is how a player ends up unsure
      // whether the tap registered. Present-but-disabled is the whole design.
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 0, armedCount: 0 })] });
      expect(out).toContain('data-action="loadout-boost-add"');
      expect(out).toContain('data-action="loadout-boost-drop"');
    });
  });

  describe("permanent upgrades are not inventory", () => {
    it("gives them no steppers at all", () => {
      const out = html({ boosts: [boostView({ def: TRIGGER, permanent: true, armed: true })] });
      expect(out).not.toContain('data-action="loadout-boost-add"');
      expect(out).not.toContain('data-action="loadout-boost-drop"');
    });

    it("never counts them toward the slot meter", () => {
      // Three real slots sit empty while the meter reads full — the exact
      // confusion the cap exists to prevent. The permanent deliberately
      // carries a NONZERO armedCount: with zero the assertion would hold
      // whether or not the exclusion exists.
      const out = html({
        boosts: [boostView({ def: TRIGGER, permanent: true, armed: true, armedCount: 99, stocked: 99, spare: 99 })],
      });
      expect(out).toContain(`0 / ${LOADOUT_MAX_BOOSTS}`);
      expect(out).not.toContain("pf-warn");
    });

    it("keeps them out of the stockable booster list", () => {
      const out = html({
        boosts: [boostView({ def: SHIELD }), boostView({ def: TRIGGER, permanent: true, armed: true })],
      });
      const triggerRow = out.split("Sunburst Trigger")[1] ?? "";
      expect(triggerRow).not.toContain("loadout-boost-add");
    });
  });

  describe("the store is buyable from an empty shelf", () => {
    it("offers the empty-store help and a live buy button when nothing is owned", () => {
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 0 })] });
      expect(out).toContain("pf-empty");
      expect(out).toMatch(/data-action="buy-boost"[^>]*data-id="shield"[^>]*>/);
    });

    it("drops the empty help once something is stocked", () => {
      const out = html({ boosts: [boostView({ def: SHIELD, stocked: 1 })] });
      expect(out).not.toContain("pf-empty");
    });

    it("disables the buy button when the player cannot afford it", () => {
      const out = html({ boosts: [boostView({ def: SHIELD, affordable: false })] });
      const buy = out.match(/data-action="buy-boost"[^>]*>/)?.[0] ?? "";
      expect(buy).toContain("disabled");
    });

    it("always keeps a way into the full shop from the loadout", () => {
      // The loadout cannot carry every cosmetic. Without this the screen is a
      // dead end for anyone who wants the next bird, which is the stranded-CTA
      // bug the home screen already had once.
      const out = html({});
      expect(out).toContain('data-action="open-shop"');
    });
  });

  describe("the shortfall is the shortfall, not the sticker price", () => {
    it("says how many coins are missing, not how much the booster costs", () => {
      // Regression: this rendered `price - 0`, so a player 30 coins short of a
      // 40-coin Magnet was told they needed 40. The gap is the useful number.
      // The trigger's shelf price, not its base price: BOOSTS rounds every price up
      // before the store ever shows it, and the shortfall has to be measured
      // against the number the player is actually looking at. It has to be the
      // TRIGGER, not MAGNET: the permanent branch gates on the DEFINITION, so a
      // non-permanent def forced permanent renders the stockable row instead.
      const price = TRIGGER.price;
      const out = html({
        wallet: 10,
        boosts: [boostView({ def: TRIGGER, permanent: true, affordable: false })],
      });
      expect(needTag(out)).toContain(`Need ${price - 10}●`);
      expect(needTag(out)).not.toContain(`Need ${price}●`);

      // The price the shortfall is measured against is the price the buy
      // button quotes. If those two ever came from different sources the
      // "Need" figure would be measuring against a number the player never
      // sees, which is the bug this assertion exists to catch.
      const buyable = html({ wallet: price, boosts: [boostView({ def: TRIGGER, permanent: true })] });
      expect(buyable).toContain(`● ${price}</button>`);
      expect(buyable).not.toContain("tag need");
    });

    it("never shows a negative shortfall", () => {
      const out = html({
        wallet: 9999,
        boosts: [boostView({ def: TRIGGER, permanent: true, affordable: false })],
      });
      expect(needTag(out)).not.toContain("-");
    });
  });

  describe("bird and trail", () => {
    it("marks the equipped bird and trail instead of offering a redundant pick", () => {
      const out = html({
        skins: [
          { def: { id: "swift", name: "Swift", price: 0, perk: "fast" }, owned: true, equipped: true, dealPrice: undefined } as unknown as SkinView,
        ],
        shopTrails: [
          { def: { id: "dawn", label: "Dawn", desc: "warm", price: 0, css: ["#fff", "#000"] }, owned: true, equipped: true } as unknown as ShopTrailView,
        ],
      });
      expect(out).toMatch(/<span class="tag on">In use ✓<\/span>/);
      expect(out).not.toContain('data-action="loadout-bird"');
      expect(out).not.toContain('data-action="loadout-trail"');
    });

    it("links an unowned bird to the shop rather than stranding it", () => {
      const out = html({
        skins: [
          { def: { id: "swift", name: "Swift", price: 300, perk: "fast" }, owned: false, equipped: false } as unknown as SkinView,
        ],
      });
      expect(out).toContain('data-action="open-shop"');
      expect(out).not.toContain('data-action="loadout-bird"');
    });

    it("buys an unowned trail inline", () => {
      const out = html({
        shopTrails: [
          { def: { id: "aurora", label: "Aurora", desc: "cold", price: 200, css: ["#0ff", "#00f"] }, owned: false, equipped: false } as unknown as ShopTrailView,
        ],
      });
      expect(out).toContain('data-action="loadout-buy-trail"');
    });
  });

  describe("escaping", () => {
    it("escapes booster and cosmetic copy rather than trusting it", () => {
      const out = html({
        boosts: [
          boostView({
            def: { ...SHIELD, name: '<img src=x onerror="boom()">', desc: "<script>x</script>" },
            stocked: 1,
          }),
        ],
      });
      expect(out).not.toContain("<script>");
      // The escaped `onerror=&quot;` is inert; the live form is `onerror="`.
      expect(out).not.toContain('onerror="');
      expect(out).toContain("&lt;script&gt;");
    });
  });
});

/**
 * A row in this screen used to carry the bare class `deal`. `.deal` is an
 * UNSCOPED global in menu-polish.css (`!important`) that paints a saturated
 * red badge intended for a small "SALE" pill. On a full row it produced a
 * hot-orange block with badge padding/radius and unreadable dark-on-red copy —
 * visually confirmed in the browser on the discounted "Feather" booster.
 *
 * This is the THIRD instance of the same defect class in this repo (after
 * `.loadout-row` and `.boost-row`), so these assert the rule rather than the
 * one row: no element this screen emits may carry a bare, unscoped class that
 * another component also styles.
 */
describe("class-name isolation from other components", () => {
  const discount = html({
    boosts: [boostView({ def: SHIELD, dealPrice: 10 })],
  });

  it("marks a discounted row with the namespaced pf-deal, never the bare global", () => {
    expect(discount).toContain("pf-deal");
    // The bare class, standing alone as a token, is the bug. `\bdeal\b` also
    // matches inside "pf-deal", so the lookbehind is what makes this specific.
    expect(discount).not.toMatch(/(?<!pf-)\bdeal\b/);
  });

  it("every class a row carries is pf-namespaced", () => {
    // The precise invariant, checked on the RENDERED markup rather than the
    // template source (which is full of `${...}` interpolations a regex cannot
    // read). A `.pf-row` may only carry `pf-`-prefixed classes.
    //
    // An earlier attempt at this asserted "no class that some stylesheet rule
    // matches without an ancestor", derived by scanning the CSS. It was wrong in
    // both directions: it flagged `on`/`row`/`gold`, which only exist as
    // `.pf-row.on` / `.score-table .row` / `.pc-price .gold` and are harmless,
    // and it missed the real intent, which is namespace discipline rather than
    // "is this string a global". The prefix rule is both simpler and stricter.
    const markup = html({
      boosts: [
        boostView({ def: SHIELD, dealPrice: 10, armedCount: 2, stocked: 5, spare: 3 }),
        boostView({ def: MAGNET, armedCount: 1 }),
        boostView({ def: TRIGGER }),
      ],
    });
    const rowClasses = [...markup.matchAll(/class="(pf-row[^"]*)"/g)].map((m) => m[1]);
    expect(rowClasses.length, "no rows rendered — the fixture is vacuous").toBeGreaterThan(0);
    for (const attr of rowClasses) {
      for (const token of attr.split(/\s+/).filter(Boolean)) {
        expect(token, `un-namespaced "${token}" on a .pf-row`).toMatch(/^pf-/);
      }
    }
  });

  it("pf-deal is actually styled, so the fix is not just a rename into nothing", () => {
    const css = readFileSync("src/game/ui.css", "utf8");
    // A rename with no rule would leave the row plain — technically fixing the
    // collision while silently dropping the "on sale" signal.
    expect(css).toMatch(/\.pf-row\.pf-deal\s*\{[^}]*\}/);
  });
});
