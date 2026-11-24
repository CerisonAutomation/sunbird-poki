import { test, expect, type Locator, type Page } from "@playwright/test";
import type { Server } from "node:http";
import { SUPPORTED_LOCALES, type SupportedLocale } from "../src/i18n/locales";
import {
  FREEZE, startArtifactServer, stopArtifactServer, visualDefects,
} from "./visual-helpers";

/**
 * `toPass()` takes its budget from the expect timeout, and the global one is
 * 20s — shorter than a single click on a CPU-rasterised page needs when the
 * card re-renders underneath it. Configured here so the retry loop is bounded
 * by the same number as every other wait in this spec.
 */
function patientExpect() {
  return expect.configure({ timeout: SCREEN_TIMEOUT });
}

/**
 * Per-language visual invariants.
 *
 * A DOM spec can confirm `#language-select` has `SUPPORTED_LOCALES.length + 1`
 * options; it cannot see that the Thai menu overflows its button or that Hebrew
 * lost its direction. Each test here covers one phase of the rollout, switching
 * language in-page (the same path a player uses) instead of rebooting per
 * locale.
 *
 * Phases follow Poki's localization order (`LOC-04`) and then the rest of the
 * shipped language list, grouped by *script* — because what breaks a layout is
 * the writing system, not the language: a new Latin locale inherits every fix
 * its group already has, while a new script needs its own pass.
 *
 * The union of every phase must equal `SUPPORTED_LOCALES` exactly; the test
 * below enforces it, so a locale added to the app without a phase (or a phase
 * naming a locale that was removed) fails the run.
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

/* ------------------------------------------------------------------ nav ----
 *
 * The same menu lookups as visual-screens.spec.ts, spelled out again rather
 * than shared: they are each spec's own contract with the menu, and the two
 * failure modes they exist to prevent (a strict-mode violation on a duplicated
 * `data-action`, and a hang until the timeout) are the reason a helper module
 * cannot quietly drift underneath a suite. See that file for the full
 * reasoning; what matters here is that the home menu is not a flat list of
 * unique actions:
 *
 *   - the first-run flight plan reuses `pvp-practice`, `open-practice`,
 *     `open-loadout`, `open-live` and `open-settings`,
 *   - the daily-ritual banner adds a second `open-challenges`.
 */
const HOME_CONTROLS = [
  "nav.home-quick-rail",
  "nav.destination-grid",
  "button.home-board",
  "div.home-record",
  "button.event-strip",
  "button.primary-btn",
].join(", ");

const CARD = '[data-ref="menuCard"]';
const HOME_RAIL = `${CARD} nav.home-quick-rail`;

/** Boot is the real WebGL build under headless SwiftShader — CPU-rasterised, so
 *  it tracks machine load. A bound, not a target. */
const BOOT_TIMEOUT = 120_000;
const SCREEN_TIMEOUT = 45_000;

/**
 * A home destination: the menu's own control for `action`, never a copy.
 *
 * Two shapes: "Fly now", the leaderboard strip and the tournament countdown
 * carry the action on the button that *is* the container, while the quick rail,
 * the destination grids and the record bar hold one inside them. Matching only
 * the descendant form finds nothing for those three.
 */
function homeControl(page: Page, action: string): Locator {
  return page.locator(
    `${CARD} :is(${HOME_CONTROLS}):is([data-action="${action}"]), `
    + `${CARD} :is(${HOME_CONTROLS}) [data-action="${action}"]`,
  );
}

/** A control on the screen the player is already inside (home-only panels are
 *  not rendered away from home, so a bare action is unique again). */
function screenControl(page: Page, action: string): Locator {
  return page.locator(`${CARD} [data-action="${action}"]`);
}

/** The heading of the screen the card is showing: "" on the home menu. */
function screenTitle(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector('[data-ref="menuCard"] .screen-head h2')?.textContent?.trim() ?? "",
  );
}

/**
 * Click a control and wait for the card to actually go somewhere.
 *
 * The click is retried inside one bounded budget because the card is re-rendered
 * in place, and under the CPU rasteriser the re-render can land after Playwright
 * has resolved the control, so a click can time out without anything being
 * wrong with the app. Each retry first checks whether the previous click landed,
 * so the control is never clicked twice, and the heading change at the end is
 * what decides the test.
 */
async function navigate(page: Page, control: Locator, label: string): Promise<void> {
  const before = await screenTitle(page);
  await patientExpect()(async () => {
    if ((await screenTitle(page)) !== before) return;
    await control.click({ timeout: 5_000 });
  }, { message: `${label}: the control could not be clicked` }).toPass();
  await expect
    .poll(() => screenTitle(page), { timeout: SCREEN_TIMEOUT, message: `${label} never opened a screen` })
    .not.toBe(before);
}

async function bootToMenu(page: Page, baseUrl: string): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "commit" });
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: BOOT_TIMEOUT });
  // There is no pilot-name screen in this build: loader, then menu.
  await expect(page.locator(HOME_RAIL)).toBeVisible({ timeout: BOOT_TIMEOUT });
}

async function backToMenu(page: Page): Promise<void> {
  await patientExpect()(async () => {
    if (await page.locator(HOME_RAIL).isVisible().catch(() => false)) return;
    await screenControl(page, "back").first().click({ timeout: 5_000 });
    await expect(page.locator(HOME_RAIL)).toBeVisible({ timeout: 5_000 });
  }, { message: "the back button never returned to the home menu" }).toPass();
}

/** Everything the card is currently showing, as one string. */
function cardText(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('[data-ref="menuCard"]')?.textContent ?? "");
}

/**
 * Wait until the card stops changing.
 *
 * Two identical samples with a gap between them — the same "it has stopped
 * moving" test a player makes by eye. Without it the defect walk below reads a
 * card that has not caught up with the language it is supposed to be checking.
 */
async function cardSettled(page: Page): Promise<void> {
  let previous = await cardText(page);
  await expect.configure({ timeout: 30_000 })(async () => {
    await page.waitForTimeout(250);
    const current = await cardText(page);
    if (current !== previous) {
      previous = current;
      throw new Error("the card is still re-rendering");
    }
  }, { message: "the card never stopped re-rendering after the language change" }).toPass();
}

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
    await bootToMenu(page, baseUrl);
    await page.addStyleTag({ content: FREEZE });

    const problems: string[] = [];
    for (const code of phase.codes) {
      const meta = SUPPORTED_LOCALES.find((l) => l.code === code)!;

      // The selector lives on the Settings screen, so that is where a player
      // changes language — switch it there, then check both screens.
      await navigate(page, homeControl(page, "open-settings"), code);

      // The switch must actually land: lang attribute, direction, selector.
      // Polled, not sampled once. `selectOption` sets the control's value and
      // fires `change` synchronously, but the game applies the locale on its
      // own tick — a single `evaluate` right after it read "en" for every
      // locale, and phases failed on `pt lang: expected "pt", received "en"`
      // before a single layout was measured.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: SCREEN_TIMEOUT, message: `${code}: the language never applied` })
        .toBe(code);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dir), { timeout: SCREEN_TIMEOUT, message: `${code}: direction never flipped` })
        .toBe(meta.rtl ? "rtl" : "ltr");
      await expect(page.locator("#language-select")).toHaveValue(code);
      // The picker must offer exactly the shipped locales — every one of them,
      // and nothing else. This asserted `SUPPORTED_LOCALES.length + 1`, counting
      // a "Browser language" (auto-detect) option above the locales. There has
      // never been one: `#language-select` has rendered `SUPPORTED_LOCALES.map`
      // unchanged since the initial commit, so the count asked a 36-locale list
      // for 37 options and failed on the first locale of every phase before a
      // single layout was measured. Set equality says what the count stood in
      // for — that a locale added without a picker entry is caught — which a
      // count alone could not tell apart from a stale extra option.
      const offered = await page
        .locator("#language-select option")
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value).sort());
      expect(offered, `${code}: the picker must offer exactly the shipped locales`)
        .toEqual([...SUPPORTED_LOCALES.map((l) => l.code)].sort());

      // lang flips before the HUD repaints: of eight sampled switches, five
      // were still showing the previous language's heading half a second later.
      // Measure the card once it has stopped moving, or every defect check here
      // reads a screen that has not caught up yet.
      await cardSettled(page);
      const settings = await visualDefects(page);
      if (settings.length) problems.push(`${code} settings: ${settings.join(" | ")}`);

      await backToMenu(page);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: SCREEN_TIMEOUT, message: `${code}: language lost on the way back` })
        .toBe(code);
      await cardSettled(page);
      const menu = await visualDefects(page);
      if (menu.length) problems.push(`${code} menu: ${menu.join(" | ")}`);
    }

    expect(problems, "locales with visual defects").toEqual([]);
  });
}

/**
 * The menu lookup every phase above depends on, asserted once on its own.
 *
 * Settings is reached from the home menu, and the home menu renders a
 * first-run flight plan that reuses `open-settings` verbatim. A bare
 * `[data-action="open-settings"]` therefore matches two elements, throws a
 * strict-mode violation, and every phase in this file pays the full timeout
 * before reporting it. Asserting the single-match property here makes that a
 * fast, named failure, and the second half keeps the allowlist honest by
 * pinning the duplicate it exists to isolate.
 */
test("the settings control this suite clicks is the menu's own, not a copy", async ({ page }) => {
  await bootToMenu(page, baseUrl);

  const problems: string[] = [];
  const rails = await page.locator(HOME_RAIL).count();
  if (rails !== 1) problems.push(`home rail matched ${rails} elements, expected 1`);

  const copies = await page.locator(`${CARD} [data-action="open-settings"]`).count();
  if (copies < 2) {
    problems.push(`"open-settings" is no longer duplicated by the flight plan (${copies} match) — the allowlist needs re-checking`);
  }
  const owned = await homeControl(page, "open-settings").count();
  if (owned !== 1) {
    problems.push(`"open-settings": the menu's own control matched ${owned} elements, expected 1`);
  }

  expect(problems, "settings lookups that are not single-match").toEqual([]);
});
