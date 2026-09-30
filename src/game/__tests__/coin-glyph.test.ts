// The coin glyph is the one piece of art that appears next to every single
// number the player earns, so a defect in it is not cosmetic — it is the most
// repeated element in the entire game.
//
// The report was "the HUD coin has two circles next to it". There was only
// ever one coin in the markup: a single `●` substitution, no stray bullet
// anywhere in the play HUD, and `.pill.coin` paints no ::before dot. The
// duplication was inside the artwork itself.
//
// This glyph has now been "fixed" twice, and both fixes were wrong:
//
//   v1  body circle + lens path + a second FILLED circle (r=1.8)
//   v2  removed the pupil, added a stroked RING at r=6.3 instead, reasoning
//       that `fill="none" can never be mistaken for a second disc`
//   v3  (here) one disc + one open highlight arc. No second closed curve.
//
// v2 shipped *because of the test below*, which asserted "exactly one filled
// circle" — so a `fill="none"` ring satisfied it by construction while players
// kept reporting two circles. The lesson is encoded in the rule itself now: the
// defect was never about how a shape is FILLED, it is about how many CLOSED
// CURVES the eye can separate. A stroked ring inside a disc is two concentric
// circles at 18px, and reads worse than the pupil did because it is
// high-contrast and complete.
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
  expect(end, "COIN_SVG should be a terminated literal").toBeGreaterThan(at);
  return hud.slice(at, end);
}

describe("the coin glyph is one disc, not two", () => {
  it("contains exactly ONE closed curve — the coin body", () => {
    // THE RULE, and the reason it changed. A second closed curve inside the
    // disc is what the eye splits off as a separate object. Fill is
    // irrelevant, so this counts every <circle> — stroked or filled. A
    // fill-based version of this assertion is exactly what let v2 ship.
    const circles = coinArt().match(/<circle\b[^>]*>/g) ?? [];
    expect(
      circles.map((c) => c.replace(/"/g, "'")),
      "one closed curve only — a rim ring reads as a second coin at 0.9em",
    ).toHaveLength(1);
  });

  it("gives that one circle the current text colour, so it themes with the HUD", () => {
    // The body must inherit `color` (the sheets set .coin-glyph to --amber /
    // --coin-gold). A hard-coded fill here would silently ignore every token.
    expect(coinArt()).toMatch(/<circle\b[^>]*fill="currentColor"/);
  });

  it("uses an OPEN highlight arc, not a dot or a closed lens", () => {
    // Open means no `Z`. A closed path is a second closed curve by another
    // name and would reintroduce the same defect through the back door — the
    // parent build's art was exactly that, a lens path plus a pupil dot.
    const paths = coinArt().match(/<path\b[^>]*>/g) ?? [];
    expect(paths.length, "the highlight is a path").toBeGreaterThan(0);
    for (const p of paths) {
      expect(p, "an open arc must not close into a second disc").not.toMatch(/\sd="[^"]*Z/);
    }
    expect(coinArt(), "no small pupil dot — that was v1's defect").not.toMatch(/r="1\.8"/);
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

describe("no stylesheet draws a SECOND coin beside the injected one", () => {
  // Why this suite exists, and why every test above it was insufficient.
  //
  // The glyph above was "fixed" twice — a filled pupil, then a stroked rim
  // ring — and both times the fix was verified by reading COIN_SVG in
  // isolation. Meanwhile `.stat-value.coin::before` in index.css was still
  // painting its own radial-gradient disc. Every assertion in this file
  // passed, and the shipped build drew a gradient disc from the pseudo-element
  // PLUS the SVG disc: two coins, which is precisely the complaint that
  // survived all three "fixes".
  //
  // The defect was never inside COIN_SVG. It was that COIN_SVG was judged
  // alone. So this suite now also reads the sheets the coin is painted into,
  // and asserts the SVG is the only thing drawing one.
  const SHEETS = ["src/index.css", "src/game/ui.css", "src/game/menu-polish.css"];

  it("no sheet paints a ::before/::after coin glyph", () => {
    // A pseudo-element with a painted background or a border-radius disc next
    // to the inline SVG is a second coin by construction, no matter what the
    // SVG looks like.
    for (const sheet of SHEETS) {
      const css = readFileSync(join(process.cwd(), sheet), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const offenders = [...css.matchAll(/([^{}]*coin[^{}]*)::(before|after)\s*\{([^}]*)\}/g)].filter((m) =>
        /(background|border-radius|content\s*:)/.test(m[3]!),
      );
      expect(
        offenders.map((m) => `${sheet}: ${m[0]!.trim().slice(0, 90)}`),
        "a stylesheet paints a second coin next to the inline SVG glyph",
      ).toEqual([]);
    }
  });

  it("the coin counter still keeps its nowrap, so the pair never breaks", () => {
    // The rule that shared the block with the deleted ::before is the one
    // thing in it worth keeping: without it a narrow HUD can wrap between the
    // glyph and the amount. Its removal is a near-miss worth pinning.
    const index = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    expect(index).toMatch(/\.stat-value\.coin\s*\{[^}]*white-space:\s*nowrap/);
  });
});
