/**
 * The palette has a core now, and the sprawl has a ceiling.
 *
 * Measured before this file existed: **1,938 hex colour declarations across 939
 * unique colours** in three stylesheets, against 8 custom properties — i.e. no
 * palette, one accident per rule, and no way to ask "what is the ink supposed to
 * be?" That is the mechanism that shipped the flight HUD's distance readout at
 * 0.8:1 against the dusk sky (see `hud-contrast.test.ts`), and it is why
 * `menu-polish.css` needed 1,491 `!important` declarations to win its own
 * cascade.
 *
 * This file is the first cut at fixing it, and it is deliberately limited to
 * what can be proved without a browser:
 *
 *  1. **No dangling `var()`.** Found while tokenising: `.vs-swatch` painted
 *     `background: var(--body)` — colliding with the *font-family* token of that
 *     name — plus `var(--wing)` and `var(--belly)`, defined nowhere and with no
 *     fallback, so all three were invalid at computed-value time. Those rules
 *     were dead as well as broken and have been deleted; this case stops the
 *     class of bug, which is invisible without a renderer.
 *  2. **The palette core stays tokenised.** 17 tokens now cover the colours that
 *     were repeated most (21 % of every declaration). Each is defined as exactly
 *     the hex it replaced, so adopting them changed no pixel — and a raw copy
 *     creeping back is a failure here.
 *  3. **Ratchets.** Unique colours, total declarations, raw `color:` literals and
 *     `!important` counts may go down, never up. `menu-polish.css`'s 1,491
 *     `!important`s are the debt being recorded, not a target being celebrated:
 *     the ratchet's only claim is that it cannot grow.
 *
 * What this file cannot prove: that any of it *looks* right. There is no browser
 * in this environment, so contrast on sky is policed by `hud-contrast.test.ts`
 * against the sky zeniths in `Sky.ts`, and everything else is arithmetic.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SHEETS = ["index.css", "game/ui.css", "game/menu-polish.css"] as const;

const read = (file: string): string =>
  readFileSync(join(process.cwd(), "src", ...file.split("/")), "utf8");

/** Comments out — a `--token:` or a hex inside prose is not a declaration. */
const code = (file: string): string => read(file).replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Every custom-property definition in a sheet.
 *
 * Not anchored to line start: index.css carries compact single-line rules
 * (`.pc{--pc-bg1:#fff;…}`), and a line-anchored parse reports those tokens as
 * undefined — which is how the first version of this test accused three healthy
 * `--pc-*` references of dangling. A definition is `--name:` anywhere a
 * declaration can be; `var(--name, …)` never matches, because there is no colon.
 */
function definitions(file: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of code(file).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) out.set(m[1], m[2].trim());
  return out;
}

function allDefinitions(): Map<string, { value: string; file: string; count: number }> {
  const out = new Map<string, { value: string; file: string; count: number }>();
  for (const file of SHEETS) {
    for (const [name, value] of definitions(file)) {
      const prev = out.get(name);
      out.set(name, prev ? { ...prev, count: prev.count + 1 } : { value, file, count: 1 });
    }
  }
  return out;
}

/**
 * Declarations only: token definitions, comments and `var(...)` fallbacks are
 * removed, so what is left is colour the stylesheets actually paint with.
 */
function painted(file: string): string {
  return (
    code(file)
      // definitions out, wherever they sit — including inside a single-line rule
      // that also paints something, where filtering the whole line would hide it
      .replace(/(--[\w-]+)\s*:\s*[^;}]+;?/g, "")
      // var() references and their fallbacks out: a fallback hex is a safety net,
      // not a colour the sheet commits to
      .replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "")
  );
}

const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function hexCensus(): { total: number; unique: Set<string> } {
  const unique = new Set<string>();
  let total = 0;
  for (const file of SHEETS) {
    for (const m of painted(file).matchAll(HEX)) {
      total += 1;
      unique.add(m[0].toLowerCase());
    }
  }
  return { total, unique };
}

/**
 * Custom properties that are legitimately set from JavaScript at runtime, so a
 * stylesheet reference without a definition is correct. Each entry is checked
 * against the code that sets it — an allowlist that can rot is not a guard.
 */
const RUNTIME_SET: Record<string, { setter: string; file: string }> = {
  "--h": { setter: "--h", file: "game/HUD.ts" },
  "--c": { setter: "--c", file: "game/HUD.ts" },
  "--hud-header-height": { setter: "--hud-${name}-height", file: "game/HUD.ts" },
  "--hud-footer-height": { setter: "--hud-${name}-height", file: "game/HUD.ts" },
};

describe("no custom property is referenced into the void", () => {
  it("every var() is defined somewhere, or carries a fallback, or is set at runtime", () => {
    const defined = allDefinitions();
    const dangling: string[] = [];

    for (const file of SHEETS) {
      for (const m of code(file).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
        const [, name, hasFallback] = m;
        if (defined.has(name) || hasFallback || name in RUNTIME_SET) continue;
        dangling.push(`${file}: var(${name})`);
      }
    }

    expect(dangling, dangling.join("\n")).toEqual([]);
  });

  it("keeps the runtime allowlist honest — the setter still exists", () => {
    for (const [name, { setter, file }] of Object.entries(RUNTIME_SET)) {
      expect(read(file), `${name} is allowlisted but nothing sets it`).toContain(setter);
    }
  });

  it("defines each token once, so there is one place to change a colour", () => {
    const doubled = [...allDefinitions()].filter(([, d]) => d.count > 1).map(([n, d]) => `${n} ×${d.count}`);
    expect(doubled, doubled.join(", ")).toEqual([]);
  });

  it("has a global palette core at all, and knows which tokens are scoped", () => {
    // 17 palette tokens + the flight-HUD pair, all on :root. If this shrinks,
    // the core is being re-scoped and the substitution guarantee above goes with it.
    expect(globalTokens().size).toBeGreaterThanOrEqual(25);
  });

  it("keeps the palette core in index.css :root, where every sheet can see it", () => {
    const defs = definitions("index.css");
    for (const token of ["--pure-white", "--bark", "--coin-gold", "--text-on-sky", "--halo-on-sky"]) {
      expect(defs.get(token), `${token} must be defined in index.css`).toBeTruthy();
    }
  });
});

/**
 * Token names declared on `:root` — the only ones that can be substituted
 * anywhere safely. A token scoped to one selector (`.pause-card { --pc-bg1: … }`)
 * resolves to nothing outside that scope, so "replace the raw hex with the var"
 * would be a behaviour change, not a refactor: 10 such raw duplicates exist and
 * are recorded as debt in the audit rather than migrated blind.
 */
function globalTokens(): Set<string> {
  const out = new Set<string>();
  for (const file of SHEETS) {
    for (const block of code(file).matchAll(/:root\s*\{([^}]*)\}/g)) {
      for (const m of block[1].matchAll(/(--[\w-]+)\s*:/g)) out.add(m[1]);
    }
  }
  return out;
}

describe("the palette core stays tokenised", () => {
  it("paints with the token, not a raw copy of its value", () => {
    const defined = allDefinitions();
    const globals = globalTokens();
    const offenders: string[] = [];

    for (const [token, { value }] of defined) {
      if (!globals.has(token)) continue;
      if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) continue;
      const hex = value.toLowerCase();
      for (const file of SHEETS) {
        const hits = [...painted(file).matchAll(HEX)].filter((m) => m[0].toLowerCase() === hex);
        if (hits.length) offenders.push(`${hex} (${token}) × ${hits.length} in ${file}`);
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("resolves --text-on-sky to the white the flight HUD is guarded on", () => {
    expect(definitions("index.css").get("--text-on-sky")?.toLowerCase()).toBe("#fff");
  });

  it("routes the guarded stat readouts through the token", () => {
    const polish = code("game/menu-polish.css");
    for (const sel of [".stat-value", ".stat-label"]) {
      const block = new RegExp(`\\${sel}\\s*\\{[^}]*\\}`, "s").exec(polish)?.[0] ?? "";
      expect(block, `${sel} must still declare its ink`).toMatch(/color:\s*var\(--text-on-sky\)/);
    }
  });
});

describe("colour sprawl is ratcheted, not just measured", () => {
  // Baselines captured 2026-09-24, after the palette-core migration
  // (1,938 → 1,481 declarations, 939 → 906 unique). Lower is better; a rise
  // means someone painted with a new one-off colour instead of a token.
  const BASELINE_TOTAL = 1500;
  const BASELINE_UNIQUE = 915;

  it("ships no more unique colours than the baseline", () => {
    const { total, unique } = hexCensus();
    expect(unique.size, `${unique.size} unique hex colours painted`).toBeLessThanOrEqual(BASELINE_UNIQUE);
    expect(total, `${total} hex colour declarations`).toBeLessThanOrEqual(BASELINE_TOTAL);
  });

  it("keeps raw text colours from growing, per sheet", () => {
    const BASELINE: Record<string, number> = {
      "index.css": 54,
      "game/ui.css": 210,
      "game/menu-polish.css": 168,
    };
    for (const [file, max] of Object.entries(BASELINE)) {
      const n = (painted(file).match(/(?:^|[^-\w])color:\s*#/gm) ?? []).length;
      expect(n, `${file} raw colour: literals`).toBeLessThanOrEqual(max);
    }
  });

  it("caps !important — the debt is recorded, and may only shrink", () => {
    // 1,491 of these are in menu-polish.css, which main.tsx imports last, so it
    // wins every cascade by default. That is the mechanism behind the invisible
    // distance readout. Nobody is claiming this number is good; the claim is
    // that it cannot get worse without a deliberate edit here.
    const BASELINE: Record<string, number> = {
      "index.css": 11,
      "game/ui.css": 13,
      "game/menu-polish.css": 1491,
    };
    for (const [file, max] of Object.entries(BASELINE)) {
      const n = (code(file).match(/!important/g) ?? []).length;
      expect(n, `${file} !important count`).toBeLessThanOrEqual(max);
    }
  });
});
