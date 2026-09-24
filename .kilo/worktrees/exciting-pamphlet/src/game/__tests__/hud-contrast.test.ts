/**
 * The flight HUD's numbers are white, and stay white.
 *
 * `.stat-value` / `.stat-label` are the distance and coin readouts at the top of
 * the flight HUD (HUD.ts:610,622 — they exist nowhere else). Nothing behind them
 * is opaque: `.hud-header`, `.top-bar` and `.stat-block` are all transparent in
 * index.css, so the text floats directly on the sky, and the sky is not one
 * colour — `src/game/Sky.ts` paints night `#12102c`, dusk `#3a2460`, ember
 * `#e07038`, day `#2e90e0`, golden `#58b8f0`, plus the shader's own `#4aa0e8`.
 *
 * A parchment restyle in menu-polish.css (which main.tsx loads *after*
 * index.css, with `!important`) once painted those numbers `#2c1f14` — 1.2:1
 * against the night sky and 0.8:1 against dusk, i.e. darker than the sky it sat
 * on. The distance readout, the single most-read number in the game, was
 * effectively invisible for a full night flight. White is the only colour that
 * survives every sky; a dark text-shadow carries the bright-day case.
 *
 * These guards fail on: any dark value, a missing shadow, a label below 10px, or
 * someone putting an opaque panel behind the stats (which would make dark text
 * legitimate — and this file the wrong place to look).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ colour */

/** sRGB hex → WCAG 2.x relative luminance (0 = black, 1 = white). */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? [...n].map((c) => c + c).join("") : n;
  const chan = (i: number): number => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

/** WCAG contrast ratio, 1…21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The zenith colours the HUD stat block actually floats against, taken from
 * `src/game/Sky.ts` (palette tops) and the sky shader's default.
 */
const SKIES = {
  night: "#12102c",
  dusk: "#3a2460",
  ember: "#e07038",
  day: "#2e90e0",
  golden: "#58b8f0",
  shaderDay: "#4aa0e8",
} as const;

/* -------------------------------------------------------------------- css */

type Rule = { selector: string; body: string; file: string; at: number };

/**
 * The `:root` custom-property table, so a value can be read the way the browser
 * resolves it. The flight HUD's ink moved onto tokens (`--text-on-sky`,
 * `--halo-on-sky`, `--coin-gold`) in the palette-core work; without resolving
 * them this file would assert against the literal string "var(--text-on-sky)"
 * and quietly stop testing any colour at all.
 */
function tokenTable(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of ["index.css", "game/ui.css", "game/menu-polish.css"]) {
    const text = readFileSync(join(process.cwd(), "src", ...file.split("/")), "utf8");
    for (const m of text.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
      if (!out.has(m[1])) out.set(m[1], m[2].trim());
    }
  }
  return out;
}

/** `var(--x)` → the token's value (or the fallback, if the token is absent). */
function resolveValue(value: string): string {
  const tokens = tokenTable();
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_all, name: string, fb?: string) => {
    const hit = tokens.get(name);
    return hit ? resolveValue(hit) : (fb ?? "").trim();
  });
}

/** Every top-level rule in a stylesheet, in source order.
 *
 * Comments are stripped first: otherwise a rule that follows a block comment has
 * the comment glued onto its selector (the comment's closer, then whitespace,
 * then `.stat-value`), which silently fails an exact selector match — and this
 * file would then "pass" while reading the wrong stylesheet's colour. That is
 * not a hypothetical: it is what the first version of this test did.
 */
function rules(file: string): Rule[] {
  const text = readFileSync(join(process.cwd(), "src", ...file.split("/")), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2], file, at: m.index });
  }
  return out;
}

/** Rules whose selector list contains `sel` exactly (no substring accidents). */
function forSelector(sel: string): Rule[] {
  return [...rules("index.css"), ...rules("game/menu-polish.css")].filter((r) =>
    r.selector
      .split(",")
      .map((s) => s.trim())
      .includes(sel),
  );
}

/** The last declared value of `prop` for `sel` — what the cascade ships. */
function effective(sel: string, prop: string): string | null {
  const hits = forSelector(sel).flatMap((r) =>
    [...r.body.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;!]+)(!important)?`, "g"))].map(
      (m) => ({ value: resolveValue(m[1].trim()), important: Boolean(m[2]), file: r.file, at: r.at }),
    ),
  );
  if (!hits.length) return null;
  // !important beats plain; among equals, later file/position wins (main.tsx
  // imports index.css first, then menu-polish.css).
  hits.sort((a, b) => Number(a.important) - Number(b.important) || a.at - b.at);
  return hits[hits.length - 1].value;
}

/** Every hex colour declared for `sel`, in any property. */
function declaredColours(sel: string): string[] {
  return forSelector(sel)
    .flatMap((r) => [...resolveValue(r.body).matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)])
    .map((m) => m[0].toLowerCase());
}

describe("flight HUD stat colours survive every sky", () => {
  const cases = [
    [".stat-value", "distance"],
    [".stat-label", "the label above it"],
  ] as const;

  it.each(cases)("paints %s white, not parchment (%s)", (sel) => {
    const colour = effective(sel, "color");

    expect(colour, `${sel} must declare a colour`).toBeTruthy();
    expect(colour!.toLowerCase()).toBe("#fff");
    expect(luminance(colour!)).toBeGreaterThan(0.9);
    // main.tsx imports index.css then menu-polish.css, so the polish sheet wins
    // the cascade: if it ever re-declares a dark colour with !important, that is
    // what ships. Assert the winning declaration is the one this file polices.
    const winner = forSelector(sel)
      .filter((r) => /(^|;)\s*color\s*:[^;!]+!important/.test(r.body))
      .pop();
    expect(winner?.file, `${sel} !important colour`).toBe("game/menu-polish.css");
  });

  it.each(cases)("keeps a shadow behind %s for the bright-day sky (%s)", (sel) => {
    // White on the brightest day blue is only ~2.8:1 — the shadow is what makes
    // it read, so it is part of the contract, not decoration.
    const shadow = effective(sel, "text-shadow");

    expect(shadow, `${sel} needs a text-shadow`).toBeTruthy();
    expect(shadow).toMatch(/rgba?\(/);
  });

  it("never ships a dark value for the stats, in either stylesheet", () => {
    for (const sel of [".stat-value", ".stat-value.coin", ".stat-label"]) {
      for (const colour of declaredColours(sel)) {
        // The coin counter may be gold; nothing may be parchment-dark.
        expect(luminance(colour), `${sel} declared ${colour}`).toBeGreaterThan(0.5);
      }
    }
  });

  it("clears 7:1 on the dark skies, and 2.2:1 on the brightest where the shadow works", () => {
    const value = effective(".stat-value", "color")!;
    const coin = effective(".stat-value.coin", "color")!;

    // Every sky a player can fly under must leave the numbers readable. On the
    // dark half that is a real WCAG number (white on night is 18.9:1). On the
    // bright half no foreground colour wins — measured: white 2.2:1 on golden
    // #58b8f0, 2.84:1 on day #2e90e0, and any darker ink loses to the *night*
    // sky instead — so the dark halo is load-bearing there, which is why the
    // next case pins its opacity too. Reaching AA (4.5:1) on the bright skies
    // needs a scrim behind the stat block; that is a deliberate design change,
    // recorded in docs/audits/MUSIC_AND_HUD_CRITIQUE_2026-09-24.md, not
    // something to smuggle in through a colour tweak.
    for (const sky of [SKIES.night, SKIES.dusk]) {
      expect(contrast(value, sky), `value on ${sky}`).toBeGreaterThanOrEqual(7);
      expect(contrast(coin, sky), `coin on ${sky}`).toBeGreaterThanOrEqual(7);
    }
    for (const sky of [SKIES.day, SKIES.golden, SKIES.shaderDay, SKIES.ember]) {
      expect(contrast(value, sky), `value on ${sky}`).toBeGreaterThanOrEqual(2.2);
      expect(contrast(coin, sky), `coin on ${sky}`).toBeGreaterThanOrEqual(2.2);
    }
    // Both are white now: gold ink measured 1.6:1 on the golden-hour sky, worse
    // than the white it replaced. The coin's *glyph* still carries the colour.
    expect(coin.toLowerCase()).toBe("#fff");
  });

  it("keeps the coin glyph gold so the counter still reads as coins", () => {
    const glyph = resolveValue(forSelector(".stat-value.coin::before").map((r) => r.body).join("\n"));

    expect(glyph).toMatch(/#ffd76a/);
    expect(glyph).toMatch(/radial-gradient/);
  });

  it("keeps the halo dark enough to carry the bright-sky case", () => {
    const shadow = effective(".stat-value", "text-shadow")!;
    const alphas = [...shadow.matchAll(/rgba?\([^)]*?,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));

    expect(alphas.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...alphas)).toBeGreaterThanOrEqual(0.7);
  });

  it("keeps the label at a size a phone can read", () => {
    const font = effective(".stat-label", "font");

    expect(font).toBeTruthy();
    expect(Number(/(\d+)px/.exec(font!)?.[1]), font!).toBeGreaterThanOrEqual(10);
  });

  it("keeps nothing opaque behind the stats (the premise this file guards)", () => {
    // If a panel ever goes behind the readouts, dark text becomes legitimate and
    // this guard has to be rewritten on purpose — not silently bypassed.
    for (const sel of [".hud-header", ".top-bar", ".stat-block", ".hud-header .stat-block"]) {
      const bg = effective(sel, "background") ?? effective(sel, "background-color");
      if (!bg) continue;
      expect(bg, `${sel} gained a background`).toMatch(/transparent|none/);
    }
  });
});
