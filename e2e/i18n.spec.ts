import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";

/**
 * Localization (Poki requirement: multiple languages, layouts adapt to
 * longer translations, RTL support). The locale is chosen in Settings,
 * persisted to storage, and re-applied at boot — each test verifies the
 * full round trip, plus that translated/RTL layouts still fit.
 */

function homeSub(page: Page) {
  return page.locator(".home-launch .launch-copy span:last-child");
}

/**
 * "The home menu is up", without naming anything in English.
 *
 * `SunbirdPage.ready()` waits for a button whose ACCESSIBLE NAME is the
 * English string "Fly now", which is exactly right for the English boot it
 * was written for and exactly wrong the moment this spec changes the locale:
 * the home CTA's aria-label comes from `t("onboarding.flyNow")`, so in German
 * it reads "Jetzt fliegen" and in Arabic "طِر الآن". Waiting for "Fly now"
 * then waits out its whole 45 s budget and reports a timeout for what is
 * really a correctly-translated button. Two of this file's failures were
 * exactly that, and the failure snapshot showed a fully translated home menu.
 *
 * So: wait on `data-action`, which is the attribute the game itself dispatches
 * on and which is identical in every locale. The screen that must exist is
 * still asserted — only the English copy is dropped.
 */
async function readyInAnyLocale(page: Page): Promise<void> {
  // Same budget `SunbirdPage.ready()` uses: one self-contained 2.4 MB document
  // has to download, parse, execute and build its WebGL scene first.
  await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('[data-action="pvp-practice"]')).toBeVisible({ timeout: 45_000 });
}

/**
 * Leave a sub-screen and wait for the home menu, in whatever locale it is in.
 *
 * `dispatchEvent("click")` rather than `click()`, and the difference is not
 * the game's. `vite.config.ts` pins `const PORTAL = "poki"`, so the build this
 * harness serves standalone loads Poki's own SDK (src/sdk/platform.ts), and
 * that SDK mounts a mobile-nav drag pill into the document:
 * `<div aria-hidden="true" id="poki-debug-pill">`. It is not Sunbird UI, is
 * not in any bundle in this repo, and does not exist in the packaged portal
 * artifact — it exists only because the harness serves the portal build on its
 * own. Where it lands it covers a menu card's Back button, and Playwright's
 * hit test then reports "poki-debug-pill intercepts pointer events" and
 * retries for the whole 300 s budget. Dispatching still runs the game's real
 * delegated handler on the real control, so the navigation and every assertion
 * after it are unchanged and still load-bearing. e2e/journeys.spec.ts
 * documents the same measurement.
 */
async function backToHomeInAnyLocale(page: Page): Promise<void> {
  await page.locator('[data-ref="menuCard"] [data-action="back"]').dispatchEvent("click");
  await readyInAnyLocale(page);
}

test("switching to German re-renders the UI and survives a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await expect(homeSub(page)).toHaveText("Hold to dive · release to glide");
  await app.openMenu("open-settings", "Settings");
  await page.locator("#language-select").selectOption("de");
  // The confirmation is raised AFTER the German pack resolves
  // (`Game.set-language` awaits `setLocale` and only then toasts), so the
  // player it is addressed to reads it in German. This used to assert the
  // English default and passed only while `hud.settings.languageUpdated` was
  // still untranslated; commit f2ab205 ("translate the last 164 keys") made it
  // "Sprache aktualisiert" and the assertion quietly became the wrong one.
  // Asserting the translated string is the STRICTER check: it fails if the
  // toast stops being localised, which is the thing this test is about.
  await expect(page.getByText("Sprache aktualisiert", { exact: true })).toBeVisible();
  // The settings screen itself re-renders in German: the language select
  // keeps its selection.
  await expect(page.locator("#language-select")).toHaveValue("de");
  await backToHomeInAnyLocale(page);
  await expect(homeSub(page)).toHaveText("Halten zum Tauchen · Loslassen zum Gleiten");
  // Boot path: the locale is restored from storage before first paint of
  // the menu.
  await page.reload({ waitUntil: "commit" });
  await readyInAnyLocale(page);
  await expect(homeSub(page)).toHaveText("Halten zum Tauchen · Loslassen zum Gleiten");
  expect(app.errors).toEqual([]);
});

test("a reloaded non-English session is operable by its own translated labels", async ({ page }) => {
  // The regression behind the two helpers above. Every assertion in this file
  // used to pass against a home menu the harness could not actually reach,
  // because `ready()` names the CTA in English: after a reload into German the
  // real, translated control is on screen and "Fly now" is nowhere. Both
  // halves matter — the `data-action` is what the game dispatches on, and the
  // accessible name is what a screen reader announces — so both are pinned.
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.openMenu("open-settings", "Settings");
  await page.locator("#language-select").selectOption("de");
  await page.reload({ waitUntil: "commit" });
  await readyInAnyLocale(page);
  const cta = page.locator('[data-action="pvp-practice"]');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("aria-label", "Jetzt fliegen");
  await expect(homeSub(page)).toHaveText("Halten zum Tauchen · Loslassen zum Gleiten");
  // And it still works: a localised session is not a read-only one.
  await cta.click();
  await expect(page.locator('[data-action="pause"]')).toBeVisible({ timeout: 45_000 });
  expect(app.errors).toEqual([]);
});

test("Arabic flips the document to RTL and back, persisting across reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dir))
    .toBe("ltr");
  await app.openMenu("open-settings", "Settings");
  await page.locator("#language-select").selectOption("ar");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dir))
    .toBe("rtl");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang))
    .toBe("ar");
  await page.reload({ waitUntil: "commit" });
  // Not `app.ready()`: the Arabic home CTA is named "طِر الآن", so the English
  // wait fails on a screen that is up, correctly translated, and RTL.
  await readyInAnyLocale(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dir))
    .toBe("rtl");
  expect(app.errors).toEqual([]);
});

test("long-translation locale: the home menu still fits its card", async ({ page }) => {
  // German is one of the longer supported UIs; if any translated label
  // overflows, this fails (Poki: layouts must adapt to longer text).
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.openMenu("open-settings", "Settings");
  await page.locator("#language-select").selectOption("de");
  await backToHomeInAnyLocale(page);
  await app.expectMenuFits();
  expect(app.errors).toEqual([]);
});

test("every supported locale is selectable and round-trips its selection", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.openMenu("open-settings", "Settings");
  const select = page.locator("#language-select");
  const options = await select.locator("option").evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value));
  // Asserted against the source of truth, not a hardcoded count: locales have
  // been added twice since this test was written (ja, mt) and a stale number
  // here reads as a product bug.
  expect(options).toEqual(SUPPORTED_LOCALES.map((l) => l.code));
  for (const code of options) {
    await select.selectOption(code);
    await expect(select).toHaveValue(code);
  }
  expect(app.errors).toEqual([]);
});

test("every shipped locale renders the home CTA in its own words", async ({ page }) => {
  // Round trip over the whole set, driven by the same source of truth the
  // select is built from. `data-action` is locale-independent, and every
  // shipped pack carries its own string for `onboarding.flyNow` — a null pack
  // cell falls back to the English default, which is what this catches: a
  // locale that silently ships an English home menu to a player who picked
  // their language. English is the one locale allowed to say "Fly now".
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.openMenu("open-settings", "Settings");
  const select = page.locator("#language-select");
  for (const locale of SUPPORTED_LOCALES) {
    await select.selectOption(locale.code);
    await expect(select).toHaveValue(locale.code);
    await backToHomeInAnyLocale(page);
    const cta = page.locator('[data-action="pvp-practice"]');
    await expect(cta).toBeVisible();
    const label = (await cta.getAttribute("aria-label"))?.trim();
    expect(label, `locale ${locale.code} rendered no accessible name for the home CTA`).toBeTruthy();
    if (locale.code !== "en") {
      expect(label, `locale ${locale.code} fell back to the English home CTA`).not.toBe("Fly now");
    }
    // Back to Settings from every locale — the round trip a player performs.
    // Locale-neutral on purpose: the screen heading is translated too.
    await app.menuAction("open-settings").click();
    await expect(page.locator("#language-select")).toBeVisible();
    expect(await page.locator("#language-select").inputValue()).toBe(locale.code);
  }
  expect(app.errors).toEqual([]);
});