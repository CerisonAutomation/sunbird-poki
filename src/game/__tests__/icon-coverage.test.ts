/**
 * An icon name must never become a word.
 *
 * The results card shipped with every celebration row reading "egg Nest
 * upgraded!", "trophy Trophy: Cloud Nine", "badge Nest Pass Lv.2 unlocked".
 * The word in front was supposed to be a picture. Three renderers each turned a
 * name they could not draw into something a player could read:
 *
 *   - `iconGlyph`     → returned the name, so a miss printed "trophy".
 *   - `menuIconSm`    → returned "", so a miss made the icon vanish.
 *   - `menuIcon`      → interpolated `undefined`, printing "undefined".
 *
 * The first is the bug the player saw and the second is the one they would see
 * next, and they are the same defect: a lookup failure escaping into the DOM as
 * prose. So this file is not a list of names that must exist — a list like that
 * rots the day someone adds an icon and forgets to update it. It asserts the
 * two properties that make the whole class impossible:
 *
 *   1. **No renderer can turn a miss into text.** For ANY input, `iconGlyph`
 *      returns something the map defines, `menuIconSm` returns `<svg …>` or
 *      nothing, and `menuIcon` never contains the string "undefined".
 *   2. **Every name in the codebase is in the map.** Enumerated from the SOURCE
 *      at test time, so a new call site with a new name is covered the moment it
 *      is written — there is no list here to forget to extend.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  iconGlyph,
  isSmIconName,
  MENU_ICON_NAMES,
  menuIcon,
  menuIconSm,
  SM_ICON_NAMES,
  smIconNameOr,
  type MenuIconName,
  type SmIconName,
} from "../MenuIcons";
import { beatIcon, celebrationView, planCelebration, type ProgressEvent } from "../ProgressBeats";
import { growthLedger } from "../GrowthLedger";
import { renderCelebration } from "../hud/run";
import { BIOMES } from "../Biomes";
import { MODES, PVP_MODES } from "../Modes";
import { WINGS } from "../Career";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir = SRC): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "__tests__") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const SOURCES = sourceFiles().map((f) => ({
  file: f.slice(process.cwd().length + 1),
  text: readFileSync(f, "utf8"),
}));

/** Names a call site can name: `menuIconSm("…")`, `iconGlyph("…")`, … */
function literalArgs(fn: string): { name: string; file: string }[] {
  const out: { name: string; file: string }[] = [];
  for (const { file, text } of SOURCES) {
    for (const m of text.matchAll(new RegExp(`\\b${fn}\\(\\s*"([^"]+)"`, "g"))) {
      out.push({ name: m[1]!, file });
    }
  }
  return out;
}

/** Names a DATA TABLE can carry: `icon: "…"` / `emoji: "…"`. */
function dataNames(): { name: string; file: string }[] {
  const out: { name: string; file: string }[] = [];
  for (const { file, text } of SOURCES) {
    for (const m of text.matchAll(/\b(?:icon|emoji|modifierIcon|modeIcon)\s*:\s*"([^"]+)"/g)) {
      out.push({ name: m[1]!, file });
    }
  }
  return out;
}

/**
 * Emoji are not icon names. `Moments.ts` documents its `icon` field as "Emoji
 * used in popups, chips and share text", and those never reach a renderer — they
 * are shown as themselves. Matches both a literal emoji in source and the
 * `\uXXXX` / `\u{XXXX}` escapes the tables are written with.
 */
const isEmojiName = (n: string): boolean => /^\\u|^(?:\u{1F300}-\u{1FAFF})/u.test(n);

describe("an unknown icon name is never rendered as a word", () => {
  /** The original defect, restated as an invariant over inputs we do not ship. */
  const HOSTILE = [
    "",
    " ",
    "trophy",       // a real name — proves the hostile cases are not just typos
    "TROPHY",       // case
    "trophyy",
    "trophy ",
    "paper_wing",
    "🪽",
    "🥇",
    "undefined",
    "null",
    "constructor",
    "__proto__",
    "toString",
    "<script>alert(1)</script>",
  ];

  it("iconGlyph returns a glyph the map defines, never the name it was given", () => {
    for (const name of HOSTILE) {
      const out = iconGlyph(name);
      // Never the input back — that is the "egg"/"trophy" word on the card.
      // This holds even for the hostile entries that ARE real names. "" is
      // exempt only because `"" in → "" out` is the whole answer for "no icon".
      if (name !== "") expect(out, `iconGlyph("${name}") leaked its name`).not.toBe(name);
      if (SM_ICON_NAMES.has(name)) {
        // A real name must still draw, or a hostile-input list would hide the
        // regression in the other direction: a map emptied of its own entries.
        expect([...out].length, `iconGlyph("${name}")`).toBeLessThanOrEqual(2);
      } else {
        // Anything else is "" — and "" is what makes a caller's own
        // `|| "🪶"` fallback reachable, which it was not when the miss leaked.
        expect(out, `iconGlyph("${name}") is not drawable`).toBe("");
      }
    }
  });

  it("iconGlyph answers every name the icon map actually has", () => {
    for (const name of SM_ICON_NAMES) {
      const glyph = iconGlyph(name);
      expect(glyph, `iconGlyph("${name}")`).not.toBe("");
      expect(glyph, `iconGlyph("${name}") leaked its name`).not.toBe(name);
      // A glyph is a single character, never a multi-word phrase.
      expect([...glyph].length, `iconGlyph("${name}") = ${JSON.stringify(glyph)}`).toBeLessThanOrEqual(2);
    }
  });

  it("menuIconSm draws an <svg> or nothing, and never echoes the name", () => {
    for (const name of [...HOSTILE, ...SM_ICON_NAMES]) {
      const out = menuIconSm(name);
      if (SM_ICON_NAMES.has(name)) {
        expect(out, `menuIconSm("${name}") did not draw`).toMatch(/^<svg\b/);
      } else {
        expect(out, `menuIconSm("${name}") drew something for a name it does not have`).toBe("");
      }
      if (name.trim() !== "") expect(out).not.toContain(name);
    }
  });

  it("menuIcon never interpolates the word 'undefined' into the markup", () => {
    for (const name of [...HOSTILE, ...MENU_ICON_NAMES]) {
      const out = menuIcon(name as MenuIconName);
      expect(out, `menuIcon("${name}")`).not.toContain("undefined");
      expect(out, `menuIcon("${name}")`).not.toContain("null");
      if (MENU_ICON_NAMES.has(name)) {
        expect(out, `menuIcon("${name}") did not draw`).toMatch(/^<svg\b/);
      } else {
        expect(out, `menuIcon("${name}") drew for a name it does not have`).toBe("");
      }
    }
  });

  it("the exported name sets agree with the two type unions", () => {
    // If these drift, `isSmIconName`/`smIconNameOr` narrow to a name TypeScript
    // believes exists and `menuIconSm` cannot draw.
    for (const name of SM_ICON_NAMES) expect(isSmIconName(name)).toBe(true);
    for (const name of ["trophyy", "🥇", "", "toString"]) expect(isSmIconName(name)).toBe(false);
    for (const name of MENU_ICON_NAMES) expect(typeof name).toBe("string");
    expect(SM_ICON_NAMES.size).toBeGreaterThan(80);
    expect(MENU_ICON_NAMES.size).toBeGreaterThan(20);
  });
});

describe("every icon name the codebase can emit exists in the map", () => {
  it("covers every literal passed to a renderer", () => {
    const bad = [
      ...literalArgs("menuIconSm").map((x) => ({ ...x, map: "smArtwork" })),
      ...dataNames().map((x) => ({ ...x, map: "smArtwork" })),
      ...literalArgs("iconGlyph").map((x) => ({ ...x, map: "smGlyph" })),
      ...literalArgs("menuIcon").map((x) => ({ ...x, map: "artwork" })),
    ]
      .filter((x) => !isEmojiName(x.name))
      .filter((x) => (x.map === "artwork" ? MENU_ICON_NAMES : SM_ICON_NAMES).has(x.name) === false);

    expect(bad, bad.map((b) => `${b.file}: "${b.name}" missing from ${b.map}`).join("\n")).toEqual([]);
  });

  it("covers every name the data tables actually ship at runtime", () => {
    // The literal sweep above only sees names written as literals. These tables
    // are the ones whose `icon` flows into a renderer as DATA, so the values are
    // read out of the running modules rather than the source text.
    const names = [
      ...BIOMES.map((b) => b.emoji),
      ...MODES.map((m) => m.icon),
      ...PVP_MODES.map((m) => m.icon),
      ...WINGS.map((w) => w.icon),
    ];
    expect(names.length).toBeGreaterThan(10);
    const bad = [...new Set(names)].filter((n) => !SM_ICON_NAMES.has(n));
    expect(bad, `runtime data carries names no renderer can draw: ${bad.join(", ")}`).toEqual([]);
  });
});

describe("the results card draws its beats instead of naming them", () => {
  /** Exactly the rows from the player's screenshot. */
  const SCREENSHOT_EVENTS: ProgressEvent[] = [
    { kind: "nest", level: 3, mult: 1.2 },
    { kind: "pass", tier: 2 },
    { kind: "quest", count: 1, coins: 200 },
    { kind: "trophy", id: "cloud_nine", title: "Cloud Nine", rarity: "gold" },
    { kind: "trophy", id: "first_horizon", title: "First Horizon", rarity: "bronze" },
    { kind: "trophy", id: "piggy", title: "Piggy Bank", rarity: "bronze" },
  ];

  const html = renderCelebration({
    celebration: celebrationView(planCelebration(SCREENSHOT_EVENTS)),
    mastery: [],
    modeId: "solo",
    wings: null,
  } as never);

  it("puts a real <svg> in every beat row", () => {
    const rows = html.match(/<div class="beat[^"]*"[^>]*>[\s\S]*?<\/div>/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      expect(row, `beat row has no SVG: ${row}`).toContain('<svg class="icon-sm"');
      expect(row, `beat row has no text span: ${row}`).toContain('<span class="beat-text">');
    }
  });

  it("never prints the icon name as text — the exact reported symptom", () => {
    for (const name of ["egg", "badge", "trophy", "star", "crown"]) {
      // The name may only ever appear inside the SVG's own geometry, never as a
      // text node. The reported card showed "egg" as a word in front of the row.
      const textNodes = html.replace(/<svg[\s\S]*?<\/svg>/g, "").match(/>([^<>]*)</g) ?? [];
      for (const node of textNodes) {
        expect(node.trim(), `"${name}" leaked as visible text`).not.toBe(`>${name}<`);
      }
    }
    // And spelled out: no `<i>` whose content is a bare word.
    for (const m of html.matchAll(/<i[^>]*>([^<]*)<\/i>/g)) {
      expect(m[1]!.trim(), `a bare word is standing in for an icon: "${m[1]}"`).not.toMatch(/^[a-z_]+$/);
    }
  });

  it("keeps every beat icon drawable, whatever the event says", () => {
    const hostile: ProgressEvent[] = [
      { kind: "wings", tierId: "gold", icon: "🥇", name: "Gold Wings" },
      { kind: "wings", tierId: "aurora", icon: "", name: "Aurora Wings" },
      { kind: "mastery", icon: "🏔", mode: "Tempest", level: 2, maxed: false, skill: "", coins: 10 },
      { kind: "mastery", icon: "no_such_icon", mode: "Tempest", level: 2, maxed: false, skill: "", coins: 10 },
      { kind: "cosmetic", icon: "✨", label: "Stormline" },
      { kind: "challenge", variant: "daily", icon: "🌩", label: "Daily", coins: 5 },
    ];
    for (const event of hostile) {
      const name = beatIcon(planCelebration([event]).staged[0]!);
      expect(SM_ICON_NAMES.has(name), `${event.kind} normalised to "${name}", which has no art`).toBe(true);
      expect(menuIconSm(name), `${event.kind} produced no SVG`).toMatch(/^<svg\b/);
    }
  });

  it("normalises through smIconNameOr, and keeps the fallback when the name is fine", () => {
    expect(smIconNameOr("trophy", "star")).toBe("trophy");
    expect(smIconNameOr("🥇", "star")).toBe("star");
    expect(smIconNameOr(undefined, "star")).toBe("star");
    expect(smIconNameOr(null, "star")).toBe("star");
    expect(smIconNameOr("", "star")).toBe("star");
  });
});

describe("the growth ledger resolves its icon instead of echoing the key", () => {
  it("renders a glyph for a real key and the documented fallback for a junk one", () => {
    const good = growthLedger({ icon: "paper_wing", name: "Swift", progress: 0.4, nextName: "Gale", nextNeeded: 10, lifetime: 100 }, null);
    expect(good[0]!.icon).toBe("△");

    // The old `iconGlyph(name) ?? name` made this caller's own `|| "🪶"`
    // unreachable, so the raw key reached the card verbatim.
    const junk = growthLedger({ icon: "paper_wingg", name: "Swift", progress: 0.4, nextName: "Gale", nextNeeded: 10, lifetime: 100 }, null);
    expect(junk[0]!.icon).toBe("🪶");
    expect(junk[0]!.icon).not.toBe("paper_wingg");

    const emoji = growthLedger({ icon: "🪽", name: "Swift", progress: 0.4, nextName: "Gale", nextNeeded: 10, lifetime: 100 }, null);
    expect(emoji[0]!.icon).toBe("🪶");
  });

  it("wraps the ladder label so a long wings name can wrap instead of pushing out the card", () => {
    const out = renderCelebration({
      celebration: { staged: [], ledger: [], folded: 0, peak: 0 },
      mastery: [],
      modeId: "solo",
      wings: { icon: "paper_wing", name: "An Extremely Long Career Rank Name For Testing", progress: 0.4, nextName: "Gale", nextNeeded: 10, lifetime: 100 },
    } as never);
    expect(out).toContain('<span class="gl-label">');
  });
});

describe("the type unions and the runtime maps describe the same icons", () => {
  it("SmIconName / MenuIconName are usable as the maps' key types", () => {
    // A compile-time-only guard would not run in CI's typecheck-only path; these
    // two assignments make the drift a type error at build time as well.
    const sm: SmIconName = "trophy";
    const menu: MenuIconName = "shop";
    expect(menuIconSm(sm)).toMatch(/^<svg\b/);
    expect(menuIcon(menu)).toMatch(/^<svg\b/);
  });
});