import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Escaping contract for user-controlled text.
 *
 * Why a source-shape test instead of a sanitizer dependency: this game never
 * inserts untrusted HTML. Player-supplied data reaches the DOM only through
 * `${...}` interpolation inside template strings, so the correct control is
 * escaping at the point of interpolation, which `escapeHtml` does for
 * `& < > " '`. DOMPurify sanitizes HTML *strings*, and there are none here, so
 * it would add ~45 kB to a single inlined file that a portal loads in an iframe
 * for no security gain. This test is the durable guarantee instead.
 *
 * Scope is deliberate: only fields that can carry another player's input are
 * checked. `m.name`, `c.name`, `activeMode.name` etc. come from the static
 * MODES / SKINS / collection tables, so asserting about them would be noise —
 * a blanket "no interpolated name" rule cannot tell static data from player
 * data and would fail on correct code.
 *
 * Each check is non-vacuous: it confirms the escaped form exists as well as
 * bounding the bare form, so it cannot pass by the field being deleted.
 */
const HUD = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");

describe("HUD escaping contract", () => {
  it("escapeHtml covers the full attribute-and-text character set", () => {
    const src = HUD.slice(HUD.indexOf("function escapeHtml"));
    // Narrowing this set is the regression that matters most: a missing `"`
    // escape would break out of a value="..." attribute.
    for (const entity of ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]) {
      expect(src).toContain(entity);
    }
  });

  it("escapes the pilot name everywhere and never interpolates it bare", () => {
    expect(HUD).toMatch(/escapeHtml\(s\.pilotName\)/);
    expect(HUD).not.toMatch(/\$\{s\.pilotName\}/);
  });

  it("escapes every rendered room code", () => {
    expect(HUD).toMatch(/escapeHtml\(s\.roomCode\)/);
    expect(HUD).toMatch(/escapeHtml\(m\.roomCode\)/);
  });

  it("keeps the single bare room code in a logic key, not markup", () => {
    // `${s.roomCode}` occurs exactly once: the network-presence cache key, which
    // is compared, never inserted. Pinning the count means a SECOND bare
    // occurrence — a new markup sink — fails here.
    expect(HUD.match(/\$\{s\.roomCode\}/g) ?? []).toHaveLength(1);
    expect(HUD).toContain("${s.netState}|${s.netError}|${s.roomCode}");
  });

  it("escapes remote player names in name tags and on the board", () => {
    // Both carry a name another player's client chose.
    expect(HUD).toMatch(/escapeHtml\(tag\.name\)/);
    expect(HUD).toMatch(/escapeHtml\(e\.name\)/);
    // No bare board-name interpolation at all.
    expect(HUD).not.toMatch(/\$\{e\.name\}/);
  });

  it("keeps the single bare name-tag name in its dedupe key, not markup", () => {
    expect(HUD.match(/\$\{tag\.name\}/g) ?? []).toHaveLength(1);
    expect(HUD).toContain("${tag.place}|${tag.name}|");
  });

  it("escapes friend names and their room codes in the friends list", () => {
    expect(HUD).toMatch(/escapeHtml\(m\.roomCode\)/);
    expect(HUD).toMatch(/escapeHtml\(seenAgo\(/);
  });
});
