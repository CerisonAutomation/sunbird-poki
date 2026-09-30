// The shipping shell (index.html) is the one file a player loads before any
// of the game's own code runs, and it is outside every other guard in this
// repo: `audit:ui` scans `src/`, the CSS ratchet scans three stylesheets, and
// the i18n audits scan `src/` for `t()` calls. Nothing was reading this file's
// accessibility attributes, so the two WCAG criteria it can be judged against
// were simply not being enforced.
//
// 1. **WCAG 1.4.4 Resize Text (AA).** The shell shipped
//    `maximum-scale=1.0, user-scalable=no`, which disables pinch-zoom
//    outright. The in-game Large Text setting is not a substitute: it scales
//    HUD type, but it cannot restore the browser zoom a low-vision player
//    needs for everything else, and on iOS it is the viewport meta alone that
//    decides whether a fullscreen web app may be pinched at all. Fixed to
//    `maximum-scale=5.0`; this pins it.
//
// 2. **WCAG 3.1.1 Language of Page (A).** `lang` must be present and a real
//    tag. It ships as a static `en` and is then overwritten per locale by
//    `updateDocumentDirection()` in `src/i18n/index.ts`, so the value that
//    matters at first paint is the one hardcoded here. A missing `lang` makes
//    screen readers guess at pronunciation for every string in the game.
//
// Both are cheap to break: they are one line of HTML, in a file no linter
// reads, with no test until now.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../i18n/locales";

const SHELLS = ["index.html", "portal.html"];

function readShell(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const name of SHELLS) {
    const p = join(process.cwd(), name);
    if (!existsSync(p)) continue; // not shipped in this checkout
    out.push({ name, text: readFileSync(p, "utf8") });
  }
  return out;
}

const shells = readShell();

/** Pulls the content of a `<meta name="viewport" …>` out of a shell. */
function viewportContent(text: string): string {
  const tag = /<meta\s+[^>]*name=["']viewport["'][^>]*>/i.exec(text)?.[0];
  expect(tag, "the shell must declare a viewport").toBeTruthy();
  return /content=["']([^"']*)["']/i.exec(tag!)?.[1] ?? "";
}

function htmlLang(text: string): string | null {
  return /\blang=["']([^"']*)["']/i.exec(text)?.[1] ?? null;
}

describe("the shipping shell lets a player resize and is announced in its own language", () => {
  // Skipped rather than failed when no shell exists, so a checkout that builds
  // no HTML (a library consumer) is not reported as an accessibility failure.
  it.skipIf(shells.length === 0)("does not block pinch-zoom (WCAG 1.4.4, AA)", () => {
    for (const { name, text } of shells) {
      const content = viewportContent(text);
      expect(content, `${name} must not disable user scaling`).not.toMatch(/user-scalable\s*=\s*no/i);
      expect(content, `${name} must not allow interactive-widget / no`).not.toMatch(/interactive-widget/i);
      const max = /maximum-scale\s*=\s*([0-9.]+)/i.exec(content);
      // A maximum of 1 (or an absent maximum) is the failing case: it is what
      // stops iOS from granting pinch-zoom inside a fullscreen web app. 1.4.4
      // asks for 200%, so anything at or above 2 satisfies it.
      expect(max, `${name} should pin an explicit maximum-scale`).toBeTruthy();
      expect(Number(max![1]), `${name} maximum-scale blocks resize`).toBeGreaterThanOrEqual(2);
      // Opening layout must be unchanged for players who never pinch.
      const initial = /initial-scale\s*=\s*([0-9.]+)/i.exec(content);
      expect(initial, `${name} should pin an explicit initial-scale`).toBeTruthy();
      expect(Number(initial![1])).toBe(1);
    }
  });

  it.skipIf(shells.length === 0)("declares a real page language (WCAG 3.1.1, A)", () => {
    const supported = new Set<string>(SUPPORTED_LOCALES.map((l) => l.code as string));
    for (const { name, text } of shells) {
      const lang = htmlLang(text);
      expect(lang, `${name} needs a lang attribute on <html>`).toBeTruthy();
      // The static value is the first-paint value; `updateDocumentDirection()`
      // overwrites it per locale at runtime. So it must be one of ours, or a
      // screen reader starts every session in a language the game cannot speak.
      expect(supported.has(lang as string), `${name} lang="${lang}" is not a locale this game ships`).toBe(true);
    }
  });
});
