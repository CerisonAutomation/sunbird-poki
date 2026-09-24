import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The save pipeline end-to-end (Poki requirement S9): a real flight
 * records a personal best that survives reload, the account's export
 * code is deterministic across reloads, the pilot name persists, and
 * progress reset wipes what the UI says it will wipe.
 */

/** Fly a short run and wait for the run to end (continue screen first). */
async function flyUntilDead(page: Page, app: SunbirdPage): Promise<void> {
  await app.fly();
  // A few flaps so the recorded distance is strictly positive, then cut
  // input and let the physics finish the run.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(550);
  }
  await expect(page.locator('[data-ref="continue"]')).toBeVisible({ timeout: 30_000 });
}

test("a flown distance becomes the personal best and survives a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  // Let the run finish to the results card, then back to the menu.
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  await expect(page.locator('[data-ref="over"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-ref="over"] [data-action="menu"]').click();
  await app.ready();
  const bestText = await page.locator(".home-record b").first().textContent();
  expect(bestText).not.toBeNull();
  expect(bestText).not.toBe("0 m");
  // Reload: the menu must restore the same (or a later) best from storage.
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  const reloadedBest = await page.locator(".home-record b").first().textContent();
  expect(reloadedBest).toBe(bestText);
  expect(app.errors).toEqual([]);
});

test("the account export code is deterministic across a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.openMenu("open-account", "Account");
  const code = await page.getByLabel("Your exportable save code").inputValue();
  expect(code.length).toBeGreaterThan(20);
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await app.openMenu("open-account", "Account");
  await expect(page.getByLabel("Your exportable save code")).toHaveValue(code);
  expect(app.errors).toEqual([]);
});

test("pilot name change persists across a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.openMenu("open-board", "Leaderboard");
  const card = page.locator('[data-ref="menuCard"]');
  const nameInput = card.getByLabel("Pilot name");
  await nameInput.fill("Zephyr");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Flying as Zephyr", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  await app.openMenu("open-board", "Leaderboard");
  await expect(page.locator('[data-ref="menuCard"]').getByLabel("Pilot name")).toHaveValue("Zephyr");
  expect(app.errors).toEqual([]);
});

test("coins earned in a run survive a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  await expect(page.locator('[data-ref="over"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-ref="over"] [data-action="menu"]').click();
  await app.ready();
  const walletText = await page.locator(".home-record .record-wallet").textContent();
  const wallet = Number((walletText ?? "").replace(/[^\d]/g, ""));
  expect(wallet).toBeGreaterThan(0);
  await page.reload({ waitUntil: "commit" });
  await app.ready();
  const reloadedWallet = Number((await page.locator(".home-record .record-wallet").textContent() ?? "").replace(/[^\d]/g, ""));
  expect(reloadedWallet).toBe(wallet);
  expect(app.errors).toEqual([]);
});
