import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * Poki engagement rule EN-02: "ensure games are accessible by … standardizing
 * controls: use WASD or arrow keys for movement and the space bar or return key
 * for primary menu actions."
 *
 * The unit tests pin the key mapping; this spec pins what a player actually
 * feels in a browser — a run started and flown entirely from the keyboard, arrow
 * keys that never scroll the host page, and an overlay whose primary action is
 * reachable with Space alone.
 */
test("a run is startable and flyable from the keyboard alone", async ({ page }) => {
  test.setTimeout(120000);
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();

  // Primary menu action via Return, without touching the mouse.
  const launch = page.getByRole("button", { name: "Play free flight now", exact: true });
  await launch.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-action="pause"]')).toBeVisible();

  // Arrow keys are a dive alias (EN-02). They must be consumed by the game,
  // not scrolled into the host page the game is embedded in.
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(400);

  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Still flying (the pause control only exists during a live run).
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  expect(app.errors).toEqual([]);
});

test("Space activates an overlay's primary action from the dialog heading", async ({ page }) => {
  test.setTimeout(120000);
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();

  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  const heading = card.locator(".screen-head h2");
  await expect(heading).toBeVisible();

  // The overlay deliberately focuses its heading for screen readers, so a bare
  // Space has no focused button to activate — OverlayNavigation must route it
  // to the primary action instead of dropping the key on the heading.
  await heading.focus();
  await expect(heading).toBeFocused();
  await page.keyboard.press(" ");
  await expect(card.locator(".primary-btn").first()).toBeFocused();
  expect(app.errors).toEqual([]);
});
