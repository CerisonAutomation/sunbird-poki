/**
 * Screen titles: every screen heading is translated, and the translation is the
 * one in the barrel.
 *
 * Titles were the largest single block of untranslated copy in the game — all
 * seventeen of them were English on all 36 locales, and a title is the most-read
 * line on a screen. `head()` now translates by screen id, which keeps the icon
 * lookup in `MenuCatalog.ts` working (it matches on stable English strings) while
 * the player reads their own language.
 *
 * These cases also close a gap the i18n suite had: nothing compared a `t()`
 * call's `defaultText` with the barrel's `sourceText`, so a fallback could drift
 * from the translation it was supposed to match and only the English string
 * would show it. For screen titles — where the fallback is the whole copy — that
 * comparison is pinned here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import barrel from "../../i18n/translations.barrel.json";
import { SCREEN, SCREEN_TITLES } from "../HUD";

type Entry = { sourceText: string; placeholders: string[]; translations: Record<string, string> };
const ENTRIES = (barrel as { barrel: Record<string, Entry> }).barrel;
const LOCALES = Object.keys(ENTRIES["hud.settings.title"]!.translations);
const ids = Object.values(SCREEN);

describe("screen titles", () => {
  it("has a translated label for every screen id — no screen renders its raw id", () => {
    for (const id of ids) {
      const entry = SCREEN_TITLES[id];
      expect(entry, `head(${JSON.stringify(id)}) has no SCREEN_TITLES entry`).toBeTruthy();
      expect(entry!.en, `${id} fallback is empty`).not.toBe("");
      expect(ENTRIES[entry!.key], `${id} points at a key that is not in the barrel`).toBeTruthy();
    }
  });

  it("keeps every fallback word-for-word identical to the barrel's sourceText", () => {
    for (const id of ids) {
      const entry = SCREEN_TITLES[id]!;
      expect(entry.en, `${id}: defaultText !== sourceText`).toBe(ENTRIES[entry.key]!.sourceText);
      expect(ENTRIES[entry.key]!.translations.en, `${id}: en translation !== sourceText`).toBe(entry.en);
    }
  });

  it("ships all 36 locales for every title, with no placeholder to render raw", () => {
    for (const id of ids) {
      const entry = ENTRIES[SCREEN_TITLES[id]!.key]!;
      expect(Object.keys(entry.translations).sort(), id).toEqual([...LOCALES].sort());
      for (const [code, text] of Object.entries(entry.translations)) {
        expect(text.trim().length, `${id}/${code} is empty`).toBeGreaterThan(0);
        expect(text, `${id}/${code} carries a placeholder`).not.toMatch(/\{\{?/);
      }
      expect(entry.placeholders, `${id} declares placeholders`).toEqual([]);
    }
  });

  it("gives every screen its own key", () => {
    // Two screens sharing one key is how a translation for one of them gets
    // changed by an edit meant for the other. "Account" reuses the *menu's*
    // key, which is the same word on the same screen, not a second screen.
    const keys = ids.map((id) => SCREEN_TITLES[id]!.key);
    expect(new Set(keys).size, `shared keys: ${keys.join(", ")}`).toBe(keys.length);
  });

  it("is written by id in the render layer, never as a literal", () => {
    // The ratchet in `scripts/audit-i18n.mjs` counts `head("…")` as debt; this
    // is the same rule as a test, so a regression fails before the audit runs.
    const hud = readFileSync(join(process.cwd(), "src/game/HUD.ts"), "utf8");
    expect(hud, "head() called with a literal title").not.toMatch(/\bhead\(\s*"/);
  });
});
