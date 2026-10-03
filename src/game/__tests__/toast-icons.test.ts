/**
 * The HUD draws its message icons from `menuIconSm(icon)` — the project's own
 * SVG artwork — and an unknown name renders NOTHING, silently.
 *
 * That is the trap this pins. `iconGlyph()` and `menuIconSm()` draw from two
 * different tables: the first is a map of typographic glyphs (`☀︎ ★ ◉ ✕ ⚄`),
 * the second of SVG paths. A name that is valid in one is not necessarily
 * valid in the other, so every `hud.toast(..., icon)` argument has to be
 * checked against the artwork table specifically — not against the glyph
 * table, and not by eye, because a missing icon leaves a pill with a hole in
 * it rather than an error.
 *
 * It is a source-level check on purpose. The alternative — asserting that each
 * of the 80+ call sites renders an `<svg>` — needs a browser per message and
 * would go stale the same way, just slower.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SM_ICON_NAMES } from "../MenuIcons";

const src = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");

describe("every toast icon resolves to real artwork", () => {
  it("the artwork table is the one the HUD renders from", () => {
    // If these ever converge, the check below stops proving anything.
    expect(SM_ICON_NAMES.size).toBeGreaterThan(50);
  });

  it("every literal icon argument is a name the artwork table has", () => {
    // `hud.toast(`<copy>`, "<kind>", "<icon>")`
    const args = [...src.matchAll(/hud\.toast\(`[^`]*`,\s*"[a-z]+",\s*"([a-z_]+)"\)/g)].map(m => m[1]!);
    expect(args.length, "the regex stopped matching — every toast would go unchecked").toBeGreaterThan(20);
    const missing = [...new Set(args)].filter(n => !SM_ICON_NAMES.has(n));
    expect(missing, `these names render as a hole in the pill: ${missing.join(", ")}`).toEqual([]);
  });

  it("no toast copy still carries a raw emoji", () => {
    // The complaint that started this: a pill with "🔥 12-day streak" in it.
    // `iconGlyph` returns typographic glyphs — some of which are emoji-
    // presentation characters that render in colour, at emoji size, and wrong
    // under RTL — so the emoji cannot simply move into the icon argument
    // either. The artwork has to carry it.
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2700}-\u{27BF}]/u;
    const withEmoji = src.split("\n").filter(l => l.includes("hud.toast(") && EMOJI.test(l));
    expect(withEmoji.map(l => l.trim().slice(0, 70)), "toast copy still contains an emoji").toEqual([]);
  });

  it("no toast interpolates an icon glyph into its copy", () => {
    // The other half: `iconGlyph` in a template literal renders as text, not
    // as artwork. It must reach the renderer through the icon argument.
    const offenders = src.split("\n").filter(l => /hud\.toast\([^\n]*iconGlyph\(/.test(l));
    expect(offenders.map(l => l.trim().slice(0, 70))).toEqual([]);
  });
});