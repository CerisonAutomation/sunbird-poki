import { test, expect } from "@playwright/test";
import type { Server } from "node:http";
import { SUPPORTED_LOCALES, type SupportedLocale } from "../src/i18n/locales";
import {
  FREEZE, boot, goHome, openScreen,
  startArtifactServer, stopArtifactServer, visualDefects,
} from "./visual-helpers";

/**
 * Per-language visual invariants.
 *
 * A DOM spec can confirm `#language-select` has 37 options; it cannot see that
 * the Thai menu overflows its button or that Hebrew lost its direction. Each
 * test here covers one phase of the rollout, switching language in-page (the
 * same path a player uses) instead of rebooting per locale.
 *
 * Phases follow Poki's localization order (`LOC-04`) and then the rest of the
 * platform's 34-language list, grouped by *script* — because what breaks a
 * layout is the writing system, not the language: a new Latin locale inherits
 * every fix its group already has, while a new script needs its own pass.
 */
const PHASES: { label: string; codes: SupportedLocale[] }[] = [
  { label: "phase 1 — EFIGS + Turkish", codes: ["en", "es", "de", "fr", "it", "tr"] },
  { label: "phase 2 — CJK", codes: ["zh", "ja", "ko"] },
  { label: "phase 3 — Portuguese + Russian", codes: ["pt", "ru"] },
  { label: "phase 4 — RTL (Arabic, Hebrew)", codes: ["ar", "he"] },
  { label: "phase 5 — Indic + Thai scripts", codes: ["hi", "bn", "th"] },
  { label: "phase 6 — Greek + Cyrillic", codes: ["el", "bg", "uk", "sr"] },
  { label: "phase 7 — Latin long tail", codes: ["nl", "pl", "sv", "cs", "sk", "da", "fi", "no", "hu", "ro"] },
  { label: "phase 8 — Southeast Asian + bonus", codes: ["id", "ms", "tl", "uz", "vi", "mt"] },
];

test("every shipped locale is selectable", () => {
  const covered = PHASES.flatMap((p) => p.codes).sort();
  expect(covered).toEqual([...SUPPORTED_LOCALES.map((l) => l.code)].sort());
});

let server: Server;
let baseUrl = "";

test.beforeAll(async () => { ({ server, baseUrl } = await startArtifactServer()); });
test.afterAll(async () => { await stopArtifactServer(server); });

for (const phase of PHASES) {
  test(`${phase.label} fit their screens and keep their direction`, async ({ page }) => {
    await boot(page, baseUrl);
    await page.addStyleTag({ content: FREEZE });

    const problems: string[] = [];
    for (const code of phase.codes) {
      const meta = SUPPORTED_LOCALES.find((l) => l.code === code)!;

      // The selector lives on the Settings screen, so that is where a player
      // changes language — switch it there, then check both screens.
      await openScreen(page, "open-settings");
      await page.selectOption("#language-select", code);

      // The switch must actually land: lang attribute, direction, selector.
      expect(await page.evaluate(() => document.documentElement.lang), `${code} lang`).toBe(code);
      expect(await page.evaluate(() => document.documentElement.dir), `${code} dir`).toBe(meta.rtl ? "rtl" : "ltr");
      await expect(page.locator("#language-select")).toHaveValue(code);
      // +1: the "Browser language" (auto-detect) option sits above the locales.
      await expect(page.locator("#language-select option")).toHaveCount(SUPPORTED_LOCALES.length + 1);

      const settings = await visualDefects(page);
      if (settings.length) problems.push(`${code} settings: ${settings.join(" | ")}`);

      await goHome(page);
      expect(await page.evaluate(() => document.documentElement.lang), `${code} lang after back`).toBe(code);
      const menu = await visualDefects(page);
      if (menu.length) problems.push(`${code} menu: ${menu.join(" | ")}`);
    }

    expect(problems, "locales with visual defects").toEqual([]);
  });
}
