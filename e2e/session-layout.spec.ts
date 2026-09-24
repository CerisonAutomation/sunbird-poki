import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 1280, height: 800 }]) {
  test(`real split-screen scores, countdown and controls fit at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const app = new SunbirdPage(page);
    await app.open(); await app.ready(); await page.locator('[data-action="versus"]').click();
    await expect(page.locator('[data-action="pause"]')).toBeVisible();
    await expect(page.locator(".versus-bar")).toBeVisible();
    await expect(page.locator(".versus-guide")).toContainText(viewport.width / viewport.height >= 1.25 ? "left" : "top");
    await expect(page.locator(".versus-guide")).toContainText("A / Space");
    await app.awaitSettledLanes();
    await app.expectNoOverlaps([".versus-bar", ".hud-controls"], ".hud-root");
    await app.expectNoOverlaps([".hud-header", ".flight-messages", ".flight-footer"], ".hud-root");
    await page.screenshot({ path: info.outputPath(`split-${viewport.width}.png`) });
    await app.pause(); await app.resume();
    expect(app.errors).toEqual([]);
  });
}

test("AI race social controls are optional, keyboard-dismissible and never steal dive input", async ({ page }, info) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  await card.locator('[data-action="open-practice"]').click();
  await card.locator('[data-action="room-size"][data-id="5"]').click();
  await expect(card.locator('[data-action="room-size"][data-id="5"]')).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /Race the AI flock ·/ }).click();
  const toggle = page.getByRole("button", { name: /Emotes$/ });
  await expect(toggle).toBeVisible();
  await expect(page.locator(".emote-options")).toBeHidden();
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await app.awaitSettledLanes();
  await app.expectNoOverlaps([".hud-header", ".flight-messages", ".flight-footer", ".alt-gauge"], ".hud-root");
  await page.getByRole("button", { name: "Send Wave", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  await toggle.click(); await page.getByRole("button", { name: "Send Wave", exact: true }).click();
  await expect(page.locator(".emote-options")).toBeHidden();
  await page.screenshot({ path: info.outputPath("practice-clean-hud.png") });
  await app.pause(); await app.resume();
  expect(app.errors).toEqual([]);
});
