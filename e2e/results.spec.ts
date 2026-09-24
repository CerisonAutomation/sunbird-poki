import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The end-of-run surface: the continue screen, the results card, and its
 * three loops (fly again, share card, challenge link). Death here is real —
 * the flight actually runs and the physics ends the run — which makes this
 * the closest e2e proxy for the Poki Inspector's event-log walkthrough.
 */

async function flyUntilDead(page: Page, app: SunbirdPage): Promise<void> {
  await app.fly();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(550);
  }
  await expect(page.locator('[data-ref="continue"]')).toBeVisible({ timeout: 30_000 });
}

async function cardFits(page: Page, selector: string): Promise<void> {
  const r = await page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, overflow: el.scrollWidth - el.clientWidth };
  });
  const viewport = page.viewportSize()!;
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(r.bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(r.overflow).toBeLessThanOrEqual(1);
}

test("the continue screen always shows standard alternatives beside the ad option", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  const cont = page.locator('[data-ref="continue"]');
  // Standard (free) path is always present.
  await expect(cont.locator('[data-action="continue-sleep"]')).toBeVisible();
  // The coin option is present but honestly disabled at an empty wallet.
  const coins = cont.locator('[data-action="continue-coins"]');
  await expect(coins).toBeVisible();
  await expect(coins).toBeDisabled();
  // The rewarded option carries the required video icon and is shown
  // simultaneously with the standard ones.
  await expect(cont.locator('[data-action="continue-ad"]')).toContainText("🎬");
  await cardFits(page, '[data-ref="continue"] .paper-card');
  expect(app.errors).toEqual([]);
});

test("\"Let it sleep\" completes the run to the full results card", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  const over = page.locator('[data-ref="over"]');
  await expect(over).toBeVisible({ timeout: 15_000 });
  await expect(over.locator("h2")).toHaveText("Flight completed");
  await expect(over.getByRole("button", { name: "Fly Again" })).toBeVisible();
  await expect(over.getByRole("button", { name: "Main Menu" })).toBeVisible();
  await expect(over.locator('[data-action="share"]')).toBeVisible();
  await expect(over.locator('[data-action="throw-challenge"]')).toBeVisible();
  await cardFits(page, '[data-ref="over"] .paper-card');
  expect(app.errors).toEqual([]);
});

test("the challenge link embeds the shared seed and offers a manual-copy fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  await expect(page.locator('[data-ref="over"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-ref="over"] [data-action="throw-challenge"]').click();
  const dialog = page.getByRole("dialog", { name: "Copy manually", exact: true });
  await expect(dialog).toBeVisible();
  const text = await dialog.getByLabel("Text to copy").inputValue();
  expect(text).toContain("Beat my");
  // The URL must carry the seed payload hash (#key=seed.distance.name) so a
  // rival loads the exact same hills.
  expect(text).toMatch(/#\w+=\S+\.\d+\.\S+/);
  // The "copied" success claim must NOT appear while the clipboard refused.
  await expect(page.getByText("Challenge link copied", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

test("sharing a flight produces a real downloadable PNG card", async ({ page }) => {
  test.setTimeout(60_000);
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  await expect(page.locator('[data-ref="over"]')).toBeVisible({ timeout: 15_000 });
  const share = page.locator('[data-ref="over"] [data-action="share"]');
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45_000 }),
    share.click(),
  ]);
  expect(download.suggestedFilename()).toBe("sunbird-flight.png");
  await expect(page.getByText("Image download requested", { exact: true })).toBeVisible();
  expect(app.errors).toEqual([]);
});

test("Fly Again restarts a live run, and exit-flight from pause returns home", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  await expect(page.locator('[data-ref="over"]')).toBeVisible({ timeout: 15_000 });
  // Fly again → fresh run is live (the in-flight pause control exists).
  await page.getByRole("button", { name: "Fly Again", exact: true }).click();
  await expect(page.locator('[data-action="pause"]')).toBeVisible({ timeout: 15_000 });
  // ESC pauses (the documented stop/start pair fires through the state
  // machine); Exit flight then returns to the home screen.
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-action="resume"]')).toBeVisible();
  await page.locator('[data-ref="pause"] [data-action="menu"]').click();
  await app.ready();
  expect(app.errors).toEqual([]);
});
