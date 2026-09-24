import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";

/**
 * Localization (Poki requirement: multiple languages, layouts adapt to
 * longer translations, RTL support). The locale is chosen in Settings,
 * persisted to storage, and re-applied at boot — each test verifies the
 * full round trip, plus that translated/RTL layouts still fit.
 */

function homeSub(page: import("@playwright/test").Page) {
  return page.locator(".home-launch .launch-copy span:last-child");
}

test("switching to German re-renders the UI and survives a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await expect(homeSub(page)).toHaveText("Hold to dive · release to glide");
  await app.openMenu("open-settings", "Settings");
  await page.locator("#language-select").selectOption("de");
  await expect(page.getByText("Language updated", { exact: true })).toBeVisible();
  // The settings screen itself re-renders in German: the language select
  // keeps its selection.
  await expect(page.locator("#language-select")).toHaveValue("de");
  await app.backHome();
  await expect(homeSub(page)).toHaveText("Halten zum Tauchen · Loslassen zum Gleiten");
  // Boot path: the locale is restored from storage before first paint of
  // the menu.
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await expect(homeSub(page)).toHaveText("Halten zum Tauchen · Loslassen zum Gleiten");
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
  await app.ready();
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
  await app.backHome();
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
