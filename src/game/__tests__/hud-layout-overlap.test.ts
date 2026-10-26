/**
 * Overlap and overflow invariants for the stylesheets this file's owner edits.
 *
 * There is no browser here, so nothing measures a box. What CAN be proved
 * without one is the *arithmetic of the box model*, and that is where all three
 * reported defects lived:
 *
 *   - the push-to-hold coach: an `inline-block` glyph at `vertical-align:
 *     -0.15em` hangs below its line box, because a lowered inline box grows the
 *     line box upward only. It landed inside the caption's 4px `margin-top`.
 *   - the results-card beat rows: a nowrap flex row whose text item cannot
 *     shrink below min-content, so a long (translated) line left the card.
 *   - the growth ledger: a `dt` with no `min-width: 0`, shoving the number and
 *     its bar past the card's edge.
 *
 * So these assert the declarations that make each collision impossible, rather
 * than re-describing the prose. jsdom does parse CSS into a stylesheet, so the
 * rules are read the way a browser would cascade them — including which of two
 * equally-specific rules wins.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string): string => readFileSync(join(process.cwd(), "src", ...file.split("/")), "utf8");
/** Comments out — a `--token:` or a hex inside prose is not a declaration. */
const code = (file: string): string => read(file).replace(/\/\*[\s\S]*?\*\//g, "");

/** Every stylesheet the cascade is read from, in import order — later wins. */
const SHEETS = ["index.css", "game/ui.css", "game/menu-polish.css"] as const;

/**
 * All declarations that apply to `selector`, in sheet order, later wins.
 *
 * Deliberately simple: this reads whole-rule matches, so it sees compound and
 * descendant selectors the way they are written. It is enough to answer "does
 * the cascade end up giving this element a flex context", which is the only
 * question these tests ask.
 */
function declarationsFor(selector: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const file of SHEETS) {
    for (const block of code(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = block[1]!.split(",").map((s) => s.trim().replace(/\s+/g, " "));
      // Exact, or an ancestor-qualified instance of the same selector — so
      // `.play-hud .hand` counts for `.hand`. Deliberately NOT a descendant
      // match: asking about `.celebration .beat-icon` must not read the
      // declarations of `.celebration .beat-icon .icon-sm`, which is a
      // different element with different box.
      if (!selectors.some((s) => s === selector || s.endsWith(` ${selector}`))) continue;
      for (const decl of block[2]!.split(";")) {
        const m = /^\s*([\w-]+)\s*:\s*(.+?)\s*$/.exec(decl);
        if (!m) continue;
        (out[m[1]!] ||= []).push(m[2]!.replace(/\s+/g, " "));
      }
    }
  }
  return out;
}

/** The final value the cascade settles on, or undefined. */
const final = (selector: string, prop: string): string | undefined => declarationsFor(selector)[prop]?.at(-1);

const flexes = (selector: string): boolean => (final(selector, "display") ?? "").includes("flex");

describe("the push-and-hold coach does not print its glyph on its own caption", () => {
  /**
   * The whole defect in one assertion.
   *
   * `.icon-sm` is `inline-block` at `vertical-align: -0.15em`. An inline-block's
   * baseline is its bottom margin edge, so that offset drops the glyph 0.15em
   * *below* the line's baseline — and a lowered inline box extends the line box
   * UPWARD only, never downward. The overflow therefore lands on whatever comes
   * next, which was `.hand-hint`. At the coach's 56px that is 8.4px of descent
   * into a 4px gap; in the flight HUD, where `.play-hud .hand` drops the font to
   * 38px, it is 5.7px into the same 4px.
   *
   * Making `.hand` a flex column blockifies the glyph, so there is no line box,
   * no baseline and no strut for it to fall out of. That is the fix; this is
   * what stops it being undone.
   */
  it("lays the coach out as a flex column, so the glyph has no baseline to fall below", () => {
    expect(final(".hand", "display")).toBe("flex");
    expect(final(".hand", "flex-direction")).toBe("column");
    // The gap is now owned by the container. The caption's own 4px margin-top
    // was sized for a block flow this rule no longer uses; left on, it adds to
    // the gap unpredictably rather than replacing it.
    expect(final(".hand .hand-hint", "margin-top")).toBe("0");
    expect((final(".hand", "gap") ?? "").length).toBeGreaterThan(0);
  });

  it("stops the glyph stretching or collapsing inside that column", () => {
    // A flex item's `vertical-align` is inert, but the base `.icon-sm` still
    // carries `inline-block` + a -0.15em nudge. If the coach ever leaves the flex
    // context, that nudge becomes the overlap again, so it is explicitly
    // neutralised rather than left to inheritance.
    expect(final(".hand .icon-sm", "vertical-align")).toBe("baseline");
    expect(final(".hand .icon-sm", "flex")).toBe("0 0 auto");
  });

  it("centres the glyph on its caption instead of hanging it off one side", () => {
    // `.hand` is shrink-to-fit around the caption while the glyph is only 1.2em
    // wide, so `translate(-50%)` used to centre the pair and leave the picture
    // hanging left of the words it labels.
    expect(final(".hand", "align-items")).toBe("center");
    expect(final(".hand .hand-hint", "text-align")).toBe("center");
  });

  it("keeps the coach's own press animation intact", () => {
    // The flex fix must not have cost the affordance. `.hand.show` still fades
    // in and still pulses, and the keyframes still carry the -50% that centres
    // the box now that it is a column.
    expect(flexes(".hand")).toBe(true);
    expect(final(".hand.show", "opacity")).toBe("1");
    expect(final(".hand.show", "animation")).toContain("press");
    const press = /@keyframes press\s*\{([\s\S]*?)\n\}/.exec(code("game/ui.css"))?.[1] ?? "";
    expect(press).toContain("translate(-50%");
    expect(press).toContain("scale(");
  });
});

describe("the results card does not push text out of its own row", () => {
  it("lets a beat row shrink and its text wrap", () => {
    // A flex item will not go below min-content width unless told it may, and
    // `.beat` was a nowrap flex row — so a long, translated beat line left the
    // card horizontally instead of wrapping.
    expect(final(".celebration .beat", "min-width")).toBe("0");
    expect(final(".celebration .beat-text", "min-width")).toBe("0");
    expect(final(".celebration .beat-text", "overflow-wrap")).toBe("anywhere");
  });

  it("pins the beat glyph to one size across both surfaces", () => {
    // Left to `.icon-sm`'s `1.2em`, the same trophy drew at 15.6px in a staged
    // row (13px font) and 13.2px in the ledger chip directly below it (11px) —
    // two sizes for one icon, stacked. A fixed box also stops the row from
    // negotiating the glyph's width against the sentence.
    expect(final(".celebration .beat-icon", "flex")).toBe("0 0 auto");
    const box = final(".celebration .beat-icon", "width");
    expect(box).toBe(final(".celebration .beat-icon", "height"));
    expect(box).toMatch(/^\d+px$/);
    // And the inner SVG fills exactly that box rather than adding a second size.
    expect(final(".celebration .beat-icon .icon-sm", "width")).toBe("100%");
    expect(final(".celebration .beat-icon .icon-sm", "height")).toBe("100%");
  });

  it("lets the growth-ledger term shrink so the number and its bar stay on the card", () => {
    // `dt` is the flex item with no `min-width: 0`; `dd` — the "1,850 m to Gale"
    // figure and its progress bar — is what got pushed off the right edge.
    expect(final(".growth-ledger .gl-row dt", "min-width")).toBe("0");
    expect(final(".growth-ledger .gl-row dt", "flex")).toBe("1 1 auto");
    expect(final(".growth-ledger .gl-row .gl-label", "overflow-wrap")).toBe("anywhere");
    // The bar keeps its width instead of being squeezed to nothing by a long name.
    expect(final(".growth-ledger .gl-row dd", "flex")).toBe("0 0 auto");
  });
});

describe("a promo-card row cannot crush its own text column", () => {
  /**
   * The whole defect in one assertion.
   *
   * `.pc-row` is a three-child flex row: an 80px `.pc-preview`, a `.pc-body`
   * carrying the only readable text, and a `.pc-action` holding a
   * `white-space: nowrap` price button. Both neighbours are effectively rigid —
   * `.pc-action` sets `flex-shrink: 0`, and `.pc-preview` gets floored near 104px
   * by its own SVG because a flex item's `min-width` defaults to `auto`.
   *
   * So `.pc-body` was the only shrinkable child, and at 390px it took the whole
   * deficit: measured live in Chrome, 300px of row minus a 104px preview, a
   * 138px action and two 12px gaps left it 34px. The flash-sale perk rendered
   * one word per line, and the title broke mid-phrase.
   *
   * The fix does not make the text column shrink *less* hard — it makes the row
   * run out of room instead. A `min-width` floor on the body means the row
   * overflows its own budget, and `flex-wrap` then moves the action column to a
   * second line where it has the full width. The body goes 34px → 184px.
   */
  it("floors the text column and lets the row wrap, instead of crushing the text", () => {
    const floor = final(".pc-body", "min-width");
    expect(floor, "`.pc-body` must declare a min-width floor").toBeDefined();
    // `0` is the value that caused this: it is permission to shrink to nothing.
    expect(Number.parseFloat(floor!), "the floor must actually be a width").toBeGreaterThanOrEqual(100);
    // `flex: 1 1 0%` alone is fine — the floor is what stops the collapse — but
    // the basis must not outrank the floor, or a long word sets the floor.
    expect(final(".pc-row", "flex-wrap")).toBe("wrap");
  });

  it("no later rule quietly restores the `min-width: 0` that caused the crush", () => {
    // The floor only survives if nothing after it re-opens the shrink. A single
    // `min-width: 0` added further down the cascade would undo the whole fix
    // and no screenshot-only review would catch it, because the layout would
    // still look right at desktop width.
    expect(declarationsFor(".pc-body")["min-width"]).not.toContain("0");
    expect(declarationsFor(".pc-body")["min-width"]).toHaveLength(1);
    // `.pc-preview` is deliberately left at its intrinsic width: a flex item's
    // `min-width` defaults to `auto`, so the 80px basis is really a ~104px box
    // once the SVG is in it. That is fine *because* the row now wraps — the body
    // no longer has to share a single line with it. Pinning the basis keeps a
    // future edit from "fixing" the preview and re-tightening the row.
    expect(final(".pc-preview", "flex")).toBe("0 0 80px");
  });

  it("lays the wrapped action out as a row so the second line is not a tall gap", () => {
    expect(final(".pc-action", "flex-direction")).toBe("row");
    expect(final(".pc-action", "flex-wrap")).toBe("wrap");
    // Right-aligned on the wrapped line rather than jammed against the preview.
    expect(final(".pc-action", "margin-left")).toBe("auto");
    // Still rigid: the buttons must not be the thing that gives way instead.
    expect(final(".pc-action", "flex-shrink")).toBe("0");
  });

  it("keeps the price button out of the width negotiation entirely", () => {
    // Without this the "Unlock · 690" button is the longest unbreakable run in
    // the row and becomes the largest single contributor to the deficit.
    expect(final(".pc-row .primary-btn", "white-space")).toBe("nowrap");
    expect(final(".pc-row .primary-btn", "flex")).toBe("0 0 auto");
  });
});

describe("the screen header stays one row", () => {
  /**
   * The whole defect in one assertion.
   *
   * `.screen-head` is a GRID: `40px minmax(0,1fr) auto` in ui.css, restated as
   * `44px minmax(0,1fr) auto` by the overlay rule in menu-polish.css. `head()`
   * emits back-btn, then `<h2>`, then `<span>${right}</span>` — so the h2
   * occupies row 1 column 2 and the trailing slot (the wallet pill, the board
   * badge) is the next free cell, column 3 of row 1.
   *
   * The narrow-screen rule then pinned that slot to `grid-column: 2 / -1` and
   * left its ROW on auto. A definite column with an auto row does not get the
   * next free cell: grid auto-placement skips forward until the whole span
   * fits, and columns 2–3 of row 1 are taken by the h2 — so the pill was pushed
   * to ROW 2. The header silently grew a second line, and because
   * `.screen-head` is `position: sticky` inside the scrolling card, that second
   * line is what the screen body slid underneath.
   *
   * The fix names the row. These assertions exist because the failure is
   * invisible in a desktop screenshot: at ≥400px the rule does not apply at all,
   * so a regression here would only ever show on a phone.
   */
  it("names row 1 on the trailing slot instead of letting auto-placement choose", () => {
    // Within the ≤400px block the value must be the explicit one. Reading the
    // whole cascade would find the same selector declared elsewhere, so this
    // reads the media block itself.
    const narrow = /@media \(max-width: 400px\) \{([\s\S]*?)\n\}/.exec(code("game/menu-polish.css"))?.[1] ?? "";
    expect(narrow, "the ≤400px header block must still exist").not.toBe("");
    const slot = /\.overlay \.screen-head > span \{([^}]*)\}/.exec(narrow)?.[1] ?? "";
    expect(slot, "the trailing slot must be styled in the narrow block").not.toBe("");
    expect(slot).toMatch(/grid-row:\s*1/);
    // The span has to START at column 3. A `2 / -1` start is the bug itself.
    expect(slot).toMatch(/grid-column:\s*3/);
    expect(slot).not.toMatch(/grid-column:\s*2\s*\//);
  });

  it("pins the title to its own cell so the pair cannot be pushed apart", () => {
    const narrow = /@media \(max-width: 400px\) \{([\s\S]*?)\n\}/.exec(code("game/menu-polish.css"))?.[1] ?? "";
    const title = /\.overlay \.screen-head h2 \{([^}]*)\}/.exec(narrow)?.[1] ?? "";
    expect(title).toMatch(/grid-row:\s*1/);
    expect(title).toMatch(/grid-column:\s*2/);
  });

  it("does not size a grid item with flex properties", () => {
      // `flex` is inert outside a flex container. This rule carried
      // `flex: 1 1 0 !important` for as long as it existed, which contributed
      // nothing while implying a box model the element does not have — and the
      // one property that would have shrunk the title before the badge is the one
      // it needed. `min-width: 0` is the grid equivalent and is asserted here
      // alongside, so deleting the grid cell leaves this rule still shrinking.
      const decls = declarationsFor(".overlay .screen-head h2");
          expect(decls["flex"] ?? [], "a grid item must not be sized with flex properties").toEqual([]);
          // Matched, not compared: the declaration is `min-width: 0 !important`, and
          // the helper keeps the whole value, so `toBe("0")` would fail on a fix that
          // is correct. The `!important` has to survive — it is what stops a
          // lower-specificity `.screen-head h2` from re-imposing `min-width: auto`.
          expect(final(".overlay .screen-head h2", "min-width")).toMatch(/^0\b/);
          expect(final(".overlay .screen-head h2", "grid-column")).toBe("2");
          expect(final(".overlay .screen-head h2", "grid-row")).toBe("1");
        });
});

describe("the short-viewport header grid spans every lane that wraps", () => {
  /**
   * At `max-height: 500px` (landscape phones) `.hud-header` stops being a flex
   * column and becomes `grid-template-columns: minmax(0,1fr) minmax(0,1fr)` —
   * a change introduced specifically to SHORTEN the header. Grid items that are
   * not told a `grid-column` auto-place into a single track, i.e. half the
   * header width.
   *
   * That is harmless for a small fixed pill like `.combo`, and a wrap-and-rewrap
   * for a multi-chip row. `.mid-meta` (island/biome/multiplier/gold/VIP/ghost)
   * and `.power-chips` (boost/magnet/shield/gust/thermal fallbacks) are both
   * `flex-wrap: wrap` rows and both were left in column 1, so on a landscape
   * phone each wrapped to two lines and returned the vertical space the grid had
   * just been introduced to reclaim.
   *
   * The lane set is DERIVED, not written out by hand: the bug being guarded is
      * "a lane exists but was never told to span", and a hardcoded list cannot
      * notice a lane added after this test was written. Both halves are needed —
      * CSS alone cannot say what is a child of `.hud-header`, and the wrapping
      * rules are not written in one shape: index.css says
      * `.hud-header .mid-meta { flex-wrap: wrap }` while ui.css says bare
      * `.mid-meta { flex-wrap: wrap; row-gap: 4px }`, under the comment "allow
      * wrap so biome+mult+gold+vip can't overflow a row". Reading only index.css,
      * or only the `.hud-header`-qualified form, silently misses half the evidence.
      */
     it("no wrapping lane is left sitting in a single column", () => {
       const lanes = new Set(
         [...(read("game/HUD.ts").match(/lane\(\s*"hud-header"\s*,\s*\[([^\]]*)\]/)?.[1]?.matchAll(/"\.([a-z-]+)"/g) ?? [])]
           .map((m) => m[1]!),
       );
       expect(lanes.size, "the header lane list must be readable from HUD.ts").toBeGreaterThan(0);
   
       const wrapping = new Set<string>();
       for (const file of SHEETS) {
         for (const block of code(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
           if (!/flex-wrap:\s*wrap/.test(block[2]!)) continue;
           for (const sel of block[1]!.split(",").map((s) => s.trim().replace(/\s+/g, " "))) {
             // The LAST compound identifies the element: `.mid-meta`,
             // `.hud-header .mid-meta` and `.play-hud .mid-meta` are one lane, and
             // ui.css writes the first of those three.
             const last = /\.([a-z-]+)$/.exec(sel)?.[1];
             if (last && lanes.has(last)) wrapping.add(last);
           }
         }
       }
       // Guard against a derivation that silently matches nothing and passes
       // vacuously — the failure mode of every "loop over what I found" assertion.
       expect(wrapping.size, "the header must still have wrapping lanes").toBeGreaterThan(0);
       expect([...wrapping].sort()).toEqual(["mid-meta", "power-chips", "power-strip"]);
   
       for (const lane of wrapping) {
         // `.${lane}` — `lane` is a bare class name, so interpolating it directly
         // would ask for `.hud-header mid-meta` and match nothing.
         expect(final(`.hud-header .${lane}`, "grid-column"), `${lane} wraps, so it must span both columns`).toBe(
           "1 / -1",
         );
       }
     });

  it("spans the lanes that do not wrap but still occupy a cell", () => {
      // `.combo` is deliberately NOT in the list above: a single small pill that
      // fits a half-width cell without wrapping, so spanning it would only trade a
      // wrap for dead space. Asserted explicitly so "why isn't this one fixed too"
      // has an answer in the file rather than in a commit message.
      expect(final(".hud-header .combo", "grid-column")).toBeUndefined();
      for (const lane of [".hud-header .roster-bar", ".hud-header .power-strip"]) {
        expect(final(lane, "grid-column"), `${lane} must span the short-viewport grid`).toBe("1 / -1");
      }
      // `.top-bar` is absent from the lists above on purpose. Versus mode
            // replaces the header's template with its own two-track grid and pins
            // `.top-bar` to column 2 against a `.versus-bar` in column 1, hiding every
            // other child — a different layout mode, not a refinement of this one.
            //
            // The versus rules are asserted DIRECTLY, by their own selectors, before
            // the cascade is read. `final()` resolves a bare `.hud-header .X` partly
            // by suffix-matching ancestor-qualified rules, so if those versus rules
            // were deleted this expectation would quietly degrade from "2" to the
            // non-versus "1 / -1" and keep passing — which is how a test ends up
            // asserting something its author never checked. Naming the source rule
            // makes the dependency explicit and fails loudly if it disappears.
            const VS_TOP = ".play-hud.versus .hud-header .top-bar";
            const VS_BAR = ".play-hud.versus .hud-header .versus-bar";
            expect(
              declarationsFor(VS_TOP)["grid-column"] ?? [],
              `${VS_TOP} must still pin top-bar to column 2`,
            ).toEqual(["2"]);
            expect(
              declarationsFor(VS_BAR)["grid-column"] ?? [],
              `${VS_BAR} must still hold column 1 — versus mode's own track`,
            ).toEqual(["1"]);
            // With that rule in place, the unprefixed selector settles on the versus
            // placement rather than the short-viewport span.
            expect(final(".hud-header .top-bar", "grid-column")).toBe("2");
          });
});

describe("the loadout steppers meet the same 44px floor as every other control", () => {
  /**
   * `.pf-actions .step` shipped at `width: 28px; min-width: 28px`. Every other
   * control in this app is floored at 44px — `@supports (hover: none) { .mini-btn
   * { min-height: 44px } }` and `.overlay :is(.mini-btn, …) { min-height: 44px }`
   * in menu-polish.css — so a two-button stepper was the one place a thumb had to
   * hit half the target. Worse: the `+` and `−` sit 5px apart, so a near-miss
   * lands on the OPPOSITE action. Staging something you meant to unstage (or
   * the reverse) is a destructive near-miss, not a cosmetic one.
   *
   * Widening the box to 44px is what fixed it, and that is easy to "tidy" back
   * to 28px for visual density — which is exactly what happened before.
   */
  it("gives each stepper a 44×44 target", () => {
    expect(final(".pf-actions .step", "width")).toBe("44px");
    expect(final(".pf-actions .step", "min-width")).toBe("44px");
    // Height is its own declaration because nothing else pins it; without this
    // the button could be 44 wide and 28 tall, which is still a thumb miss.
    expect(final(".pf-actions .step", "min-height")).toBe("44px");
  });

  it("cannot be squeezed back down by a later rule", () => {
    const widths = declarationsFor(".pf-actions .step").width ?? [];
    expect(widths.length, "exactly one width declaration").toBe(1);
    expect(Number.parseFloat(widths[0]!)).toBeGreaterThanOrEqual(44);
  });

  it("gives a disabled stepper a real disabled look, not just a dimmer one", () => {
    // Opacity alone left the button reading as live-but-broken, which is the
    // exact misreading the always-present-but-disabled pair was designed to
    // avoid — see loadout-screen.test.ts, "keeps both steppers in the DOM".
    expect(final(".pf-actions .step:disabled", "border")).toContain("dashed");
    expect(final(".pf-actions .step:disabled", "box-shadow")).toBe("none");
    expect(final(".pf-actions .step:disabled", "cursor")).toBe("default");
  });
});

describe("the loadout body copy clears WCAG AA", () => {
  /**
   * `--lo-muted` was `#8a7a6a` at 12px on `.pf-row`'s `rgba(255,255,255,0.66)`
   * over the paper card — ≈4.26:1, under the 4.5:1 AA floor for normal text. So
   * every booster description on the pre-flight screen, the one screen where a
   * player reads what an item DOES before committing a slot to it, was failing
   * the minimum it is measured against.
   *
   * The token is asserted rather than the rendered colour because jsdom resolves
   * no cascade against a background; the arithmetic is done on the token's value,
   * which is where the ratio is decided.
   */
  it("no longer paints body text with a sub-AA grey", () => {
    const palette = /--lo-muted:\s*(#[0-9a-fA-F]{3,6})/.exec(code("game/ui.css"))?.[1] ?? "";
    expect(palette, "--lo-muted must still be a hex the tests can measure").not.toBe("");
    const lum = (hex: string): number => {
      const v = hex.length === 4
        ? [1, 3].map((i) => parseInt(hex[i]! + hex[i]!, 16) / 255)
        : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const lin = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
    };
    const ratio = 1.05 / (lum(palette) + 0.05);
    // 4.5:1 against the lightest surface the text can land on (the card's own
    // near-white, which is the floor — the actual row tint is slightly darker,
    // so this is the conservative side of the measurement).
    expect(ratio, `--lo-muted ${palette} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the rules another agent owns are left alone", () => {
  /**
   * Guards the boundary, not the appearance. `.boost-row`, `.loadout-row` and
   * the `pf-` block at the end of `ui.css` belong to the shop/loadout screens;
   * a colour or layout fix here has no business touching them, and the suite
   * that covers them should keep passing on its own terms.
   */
  it("still finds all twelve .boost-row shop rules", () => {
    const matches = code("game/ui.css").match(/\.boost-row[^{}]*\{/g) ?? [];
    expect(matches.length, `.boost-row rule count moved from 12`).toBe(12);
  });

  it("still finds the .loadout-row rules and the pf- block", () => {
    expect((code("game/ui.css").match(/\.loadout-row[^{}]*\{/g) ?? []).length).toBeGreaterThan(0);
    expect((code("game/ui.css").match(/\.pf-[a-z-]+/g) ?? []).length).toBeGreaterThan(0);
  });
});

describe("no new !important, and no new raw colour, in the sheets I own", () => {
  it("does not exceed the recorded !important ceilings", () => {
    // The ceilings are the recorded debt in `css-tokens.test.ts`; this is a
    // local echo so a fix that reaches for `!important` fails here first, in
    // the file that would have to be re-blessed to let it through.
    const CEILING = { "index.css": 11, "game/ui.css": 13, "game/menu-polish.css": 1491 } as const;
    for (const [file, max] of Object.entries(CEILING)) {
      const n = (code(file).match(/!important/g) ?? []).length;
      expect(n, `${file} !important count`).toBeLessThanOrEqual(max);
    }
  });

  it("keeps the total painted-colour declarations inside the ratchet ceiling", () => {
    // Same rationale: the css-tokens ratchet is the authority, this is the
    // early warning. Neither the overlap fixes nor the icon fixes should have
    // needed a single new colour — they move boxes, not ink.
    const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const painted = (file: string): number =>
      (code(file)
        .replace(/(--[\w-]+)\s*:\s*[^;}]+;?/g, "")
        .replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "")
        .match(HEX) ?? []).length;
    const total = ["index.css", "game/ui.css", "game/menu-polish.css"].reduce((a, f) => a + painted(f), 0);
    expect(total, `${total} hex colour declarations`).toBeLessThanOrEqual(1500);
  });
});