import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Coins are stored as the unicode bullet U+25CF in the DATA (Economy prices,
 * challenge rewards, the Gold upsell) and normalised to an inline SVG at
 * render time, because neither display font draws the bullet consistently.
 *
 * That is a fragile shape — a regex over finished HTML — so the properties that
 * keep it correct are pinned here rather than left to inspection.
 */
const hud = readFileSync("src/game/HUD.ts", "utf8");
const COIN_SVG = hud.match(/const COIN_SVG =([\s\S]*?);\n/)?.[1] ?? "";

describe("coin glyph rendering", () => {
  it("has exactly one COIN_SVG definition", () => {
    // A second copy is how a screen ends up drawing two coins for one price.
    expect(hud.match(/const COIN_SVG\s*=/g)?.length ?? 0).toBe(1);
  });

  it("renderCoins is idempotent — it never re-processes an already-converted string", () => {
    // The SVG body must contain no bullet, or a second pass would nest a coin
    // inside a coin. This is the whole reason it is safe to call on a string
    // that some other layer already touched.
    expect(COIN_SVG).not.toContain("●");
  });

  it("the replacement consumes at most one space, so a price does not gain a gap", () => {
    // `/●\s?/` not `/●\s*/` — "● 500" must become glyph+"500" with the existing
    // single space intact, not glyph+" 500".
    expect(hud).toContain("/●\\s?/g");
  });

  it("data carries the bullet, never a pre-baked SVG", () => {
    // If a price string started carrying raw SVG, renderCoins would leave it
    // alone and a caller that also emitted COIN_SVG would double it.
    for (const f of ["src/game/Economy.ts", "src/game/Challenges.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toContain("coin-glyph");
      expect(src, f).not.toContain("<svg");
    }
  });
});
