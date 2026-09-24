import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * Settings: every control applies immediately, is visible in the DOM
 * (aria-pressed / select value / a11y classes), and survives a reload —
 * the save pipeline is Poki requirement S9, so this is a first-class
 * regression suite, not a click-through.
 */

async function openSettings(app: SunbirdPage) {
  await app.openMenu("open-settings", "Settings");
}

test("reduce-motion toggle applies, is announced by aria-pressed, and persists across reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await openSettings(app);
  const card = page.locator('[data-ref="menuCard"]');
  const toggle = card.locator('button[data-action="set-motion"]');
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await openSettings(app);
  await expect(page.locator('[data-ref="menuCard"] button[data-action="set-motion"]')).toHaveAttribute("aria-pressed", "true");
  expect(app.errors).toEqual([]);
});

test("render quality selection persists across reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await openSettings(app);
  const select = page.locator("#render-quality");
  await expect(select).toHaveValue("auto");
  await select.selectOption("low");
  await expect(select).toHaveValue("low");
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await openSettings(app);
  await expect(page.locator("#render-quality")).toHaveValue("low");
  expect(app.errors).toEqual([]);
});

test("music track selection persists across reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await openSettings(app);
  const select = page.locator("#music-track");
  await select.selectOption("0");
  await expect(select).toHaveValue("0");
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await openSettings(app);
  await expect(page.locator("#music-track")).toHaveValue("0");
  expect(app.errors).toEqual([]);
});

test("large-text and colorblind assists toggle document classes live", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await openSettings(app);
  const card = page.locator('[data-ref="menuCard"]');
  expect(await page.evaluate(() => document.documentElement.classList.contains("a11y-bigtext"))).toBe(false);
  await card.locator('button[data-action="set-bigtext"]').click();
  await expect(card.locator('button[data-action="set-bigtext"]')).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("a11y-bigtext")))
    .toBe(true);
  await card.locator('button[data-action="set-colorassist"]').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("a11y-color")))
    .toBe(true);
  // Toggle back off — the classes must not linger.
  await card.locator('button[data-action="set-bigtext"]').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("a11y-bigtext")))
    .toBe(false);
  expect(app.errors).toEqual([]);
});

test("menu mute button flips its accessible label", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  const mute = page.locator(".icon-btn.menu-mute");
  await expect(mute).toHaveAttribute("aria-label", "Mute sound");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-label", "Unmute sound");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-label", "Mute sound");
  expect(app.errors).toEqual([]);
});

test("reset progress is a two-step arm/confirm that disarms after its 3-second window", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await openSettings(app);
  const card = page.locator('[data-ref="menuCard"]');
  const zone = card.locator("details.danger-zone");
  await zone.locator("summary").click();
  const reset = card.locator('button[data-action="reset-progress"]');
  await expect(reset).toHaveText("Reset progress");
  // First click arms the confirm; the label must change.
  await reset.click();
  await expect(reset).toHaveText("Confirm: erase saved progress");
  // Leave it for longer than the 3 s arm window: it must disarm itself so a
  // stale tap a minute later cannot wipe a save.
  await page.waitForTimeout(3600);
  await expect(reset).toHaveText("Reset progress");
  // Two quick clicks within the window reset for real.
  await reset.click();
  await reset.click();
  await expect(page.getByText("Progress reset", { exact: true })).toBeVisible();
  await expect(reset).toHaveText("Reset progress");
  expect(app.errors).toEqual([]);
});

test("every settings toggle exposes a machine-readable on/off state", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await openSettings(app);
  const toggles = page.locator('[data-ref="menuCard"] button.toggle');
  const count = await toggles.count();
  expect(count).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < count; i++) {
    const pressed = await toggles.nth(i).getAttribute("aria-pressed");
    expect(["true", "false"]).toContain(pressed);
    expect((await toggles.nth(i).getAttribute("aria-label"))?.length).toBeGreaterThan(0);
  }
  expect(app.errors).toEqual([]);
});
