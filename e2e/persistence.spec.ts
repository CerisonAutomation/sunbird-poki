import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The save pipeline end-to-end (Poki requirement S9): a real flight
 * records a personal best that survives reload, the account's export
 * code is deterministic across reloads, the pilot name persists, and
 * progress reset wipes what the UI says it will wipe.
 */

/**
 * A whole solo day, in WALL clock — and the number has to be generous.
 *
 * A run ends in `Game.onDaylightOut`, the solo day is `DAYLIGHT_MAX` = 52 s,
 * and nothing ends it sooner: the settle rule (`stepSettleAndGoals`) needs
 * `bird.speed() < 4`, while `Bird` holds a `MIN_KEEP_SPEED` = 12 floor along
 * the ground and in the water, so the `settled` and `water` reasons never fire
 * and the daylight clock always decides. `Game.fixedUpdate` runs physics on a
 * fixed step and DROPS the backlog past `MAX_CATCHUP_STEPS`, so a starved
 * frame rate does not shorten the flight, it runs it in slow motion.
 *
 * This helper used to budget 30 s for that flight, and then waited out the
 * budget on a still-flying bird — its own failure snapshot shows a live
 * daylight bar, the Pause control, a coach hint and 307 m on the clock.
 * e2e/results.spec.ts documents the same wall-clock budget and why 240 s is
 * the number that survives a box running three suites at once.
 */
const RUN_END_TIMEOUT = 240_000;

/** Two tests here fly that flight and then do their own work after it. */
test.describe.configure({ timeout: 420_000 });

/** Fly a real flight to its real end and leave the results card open. */
async function flyUntilDead(page: Page, app: SunbirdPage): Promise<void> {
  await app.fly();
  // A few flaps so the recorded distance is strictly positive, then cut
  // input and let the physics finish the run.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(550);
  }
  // Two destinations, and only two: the second wind counts itself down to the
  // results card, and an unentitled run goes there directly. Waiting for
  // `continue` alone means an unentitled run reports "still flying" for the
  // whole budget when it has in fact been on the results card for seconds.
  await expect(page.locator('[data-ref="continue"]:not(.hidden), [data-ref="over"]:not(.hidden)')).toBeVisible({
    timeout: RUN_END_TIMEOUT,
  });
  // The free, always-present exit out of the second wind.
  if (await page.locator('[data-ref="continue"]:not(.hidden)').isVisible()) {
    await page.locator('[data-ref="continue"] [data-action="continue-sleep"]').click();
  }
  await expect(page.locator('[data-ref="over"]:not(.hidden)')).toBeVisible({ timeout: 30_000 });
}

test("a flown distance becomes the personal best and survives a reload", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await flyUntilDead(page, app);
  await page.locator('[data-ref="over"] [data-action="menu"]').click();
  await app.ready();
  const bestText = await page.locator(".home-record b").first().textContent();
  expect(bestText).not.toBeNull();
  expect(bestText).not.toBe("0 m");
  // A real solo day covers hundreds of metres; "0 m" would mean the run was
  // never recorded at all rather than merely short.
  expect(Number((bestText ?? "").replace(/[^\d]/g, "")), `personal best read "${bestText}"`).toBeGreaterThan(100);
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