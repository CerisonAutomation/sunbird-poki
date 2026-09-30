// The coin glyph is the one piece of art that appears next to every single
// number the player earns, so a defect in it is not cosmetic — it is the most
// repeated element in the entire game.
//
// The report was "the HUD coin has two circles next to it". There was only
// ever one coin in the markup: `<div class="stat-value coin">${COIN_SVG}<span
// data-ref="coins">0</span></div>`, a single `●` substitution, no stray
// bullet anywhere in the play HUD, and `.pill.coin` paints no ::before dot.
// The duplication was inside the artwork itself. COIN_SVG was built from a
// body circle (r=8.7) *plus* a lens-shaped path *plus* a second filled circle
// (r=1.8) sitting on top of the lens. At the 0.9em the HUD actually renders
// it, that inner blob stopped reading as a highlight on a coin and started
// reading as a second circle parked next to the first.
//
// So the rule this file pins is not "the coin is drawn once" — it is that the
// coin art contains exactly one *filled* disc. Every other shape must be a
// ring (`fill="none"`) or a path, because a second filled circle is precisely
// what the eye splits off as a separate object at small sizes.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const HUD = join(process.cwd(), "src/game/HUD.ts");
const hud = readFileSync(HUD, "utf8");

/** The COIN_SVG literal, which is module-private by design. */
function coinArt(): string {
  const at = hud.indexOf("const COIN_SVG =");
  expect(at, "COIN_SVG should still exist").toBeGreaterThan(-1);
  const end = hud.indexOf('"</svg>";', at);
  expect(end, "COIN_SVG should still be a terminated literal").toBeGreaterThan(at);
  return hud.slice(at, end);
}

describe("the coin glyph is one disc, not two", () => {
  it("has exactly one filled circle — the coin body", () => {
    const circles = coinArt().match(/<circle\b[^>]*>/g) ?? [];
    const filled = circles.filter((c) => {
      const fill = /fill="([^"]*)"/.exec(c)?.[1] ?? "black"; // SVG default fill
      return fill !== "none";
    });
    expect(
      filled.map((c) => c.replace(/"/g, "'")),
      "a second filled circle reads as a second coin at 0.9em — use fill=\"none\" for a rim",
    ).toHaveLength(1);
  });

  it("gives the one filled circle the current text colour, so it themes with the HUD", () => {
    // The body must inherit `color` (the sheets set .coin-glyph to --amber /
    // --coin-gold). A hard-coded fill here would silently ignore every token.
    expect(coinArt()).toMatch(/<circle\b[^>]*fill="currentColor"/);
  });

  it("keeps its highlight as a path, not a dot", () => {
    // The old art's r=1.8 filled circle was the actual offender; a regression
    // back to "add a small dot in the middle" is the same bug wearing a hat.
    expect(coinArt()).not.toMatch(/r="1\.8"/);
    expect(coinArt()).toMatch(/<path\b/);
  });

  it("is hidden from assistive tech — the number beside it carries the meaning", () => {
    // A decorative glyph announced next to "250" would be read as a stray
    // character, so the SVG is aria-hidden and the visible number is the
    // accessible content.
    expect(coinArt()).toMatch(/aria-hidden="true"/);
  });
});

describe("coin substitution leaves no raw bullet behind", () => {
  it("replaces every bullet with the glyph, so no stray ● survives", () => {
    // renderCoins is the only thing standing between the old "● 250" blob and
    // the SVG, and it only runs on the paths that call it. If a render path
    // ever stops calling it, a raw bullet reappears next to a real coin —
    // which is literally the "two circles" report.
    const calls = hud.match(/renderCoins\(/g) ?? [];
    // The definition itself, plus one per render path.
    expect(calls.length, "every render path should run through renderCoins").toBeGreaterThan(4);
    expect(hud).toMatch(/return html\.replace\(\/●/);
  });
});
