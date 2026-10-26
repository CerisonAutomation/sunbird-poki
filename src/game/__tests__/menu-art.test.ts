import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { PLAY_DESTINATIONS, PROGRESS_DESTINATIONS, QUICK_ACTIONS } from "../MenuCatalog";
import { menuIcon, menuHorizon } from "../MenuIcons";

const destinations = [...QUICK_ACTIONS, ...PLAY_DESTINATIONS, ...PROGRESS_DESTINATIONS];
describe("canonical illustrated menu", () => {
  it("gives every destination a distinct, local, decorative illustration", () => {
    expect(new Set(destinations.map(d => d.action)).size).toBe(destinations.length);
    expect(new Set(destinations.map(d => d.icon)).size).toBe(destinations.length);
    for (const item of destinations) {
      const root = document.createElement("div");
      root.innerHTML = menuIcon(item.icon);
      const svg = root.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 64 64");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(root.querySelector("path, circle, rect")).not.toBeNull();
      expect(root.querySelector("image, use, foreignObject, script, [id] ")).toBeNull();
    }
  });
  it("keeps the hero horizon decorative and free of particle/animation work", () => {
    const horizon = menuHorizon();
    expect(horizon).toContain('aria-hidden="true"');
    expect(horizon).not.toMatch(/<animate|<image|<filter|<circle/);
  });
});

/** Every `name: '<svg body>'` pair in the 20×20 sheet, read from source. */
function smArtworkSource(): [string, string][] {
  const src = readFileSync(join(process.cwd(), "src/game/MenuIcons.ts"), "utf8");
  const block = /const smArtwork = \{([\s\S]*?)\n\} as const;/.exec(src);
  expect(block, "smArtwork should still exist").not.toBeNull();
  return [...(block![1]!.matchAll(/^\s*(\w+):\s*'([\s\S]*?)',?\s*$/gm) ?? [])].map(
    (m) => [m[1]!, m[2]!] as [string, string],
  );
}

describe("every small icon is legible at 20px", () => {
  // The coin glyph shipped with a stroked ring drawn inside its own filled
  // disc — two concentric circles at 20px, which is the "two coins" report —
  // and the HUD coin had a CSS ::before disc painted beside the SVG. Each was
  // fixed in the artwork that happened to be reported while the other glyph
  // stayed broken, because nothing asserted anything about this set as a
  // whole. So the rules live here now, applied to every icon in the sheet.
  const art = smArtworkSource();

  it("parses the whole sheet, so the rules below cannot pass vacuously", () => {
    expect(art.length, "no icons parsed — every rule below would pass on nothing").toBeGreaterThan(80);
    expect(art.filter(([n]) => n === "coin").length, "the coin glyph must be covered by these rules").toBe(1);
  });

  it("the sheet's coin is ONE closed curve, like the HUD's", () => {
    // Scoped to the coin on purpose. A first attempt banned concentric
    // circles across the whole sheet, which flagged `target` (concentric rings
    // ARE the bullseye), `p1`/`p2` (a solid pip in a disc is the player
    // marker) and `photo` (the lens is the camera). Those are correct art.
    //
    // The defect is specific and real: the coin's own second closed curve,
    // stroked and unfilled, which renders as a second coin at 20px. That is
    // the same rule the HUD glyph carries, and it now covers both coins — the
    // pair that drifted apart is how a "fixed" coin stayed visibly broken.
    const coin = art.find(([n]) => n === "coin")![1];
    const circles = coin.match(/<circle\b[^>]*>/g) ?? [];
    expect(circles, "the sheet coin must be a single disc, not a disc plus a rim").toHaveLength(1);
    expect(coin, "the sheet coin regressed to a rim ring inside the disc").not.toMatch(/<circle[^>]*fill="none"/);
    expect(coin, "the coin lost its highlight").toMatch(/<path\b[^>]*stroke="#fff/);
  });

  it("no icon is drawn from negative coordinates", () => {
    // Negative coordinates place geometry off the left/top edge of the
    // viewBox, where the SVG clips it and the glyph silently loses a limb —
    // which is how `eagle` came to be drawn as a star, with wings that ran
    // past the canvas and vanished.
    //
    // Scoped to negatives deliberately. An upper bound on path data is not
    // reliably checkable from source: path numbers mix absolute coordinates,
    // relative deltas and arc flags, and a naive scan flags 42 of the 94
    // glyphs that are perfectly correct. Negative start coordinates, by
    // contrast, are unambiguous — nothing here is a gradient or a bleed.
    const escaping = art
      .map(([name, body]) => {
        const attr = [...body.matchAll(/\b(?:cx|cy|x|y|x1|x2|y1|y2)="(-[\d.]+)"/g)];
        if (attr.length) return name;
        // `M-1 4` / `m-1 4` — a leading minus on the first path coordinate.
        if (/ d="[^"]*[Mm]-/.test(body)) return name;
        return null;
      })
      .filter((x): x is string => x !== null);
    expect(escaping, "artwork starts off-canvas and gets clipped").toEqual([]);
  });
});
