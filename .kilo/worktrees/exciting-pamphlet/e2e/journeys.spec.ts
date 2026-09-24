import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("Back and Escape retrace nested loadout navigation instead of jumping home", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  await card.getByRole("button", { name: "Change loadout", exact: true }).click();
  await expect(card.locator("h2").first()).toHaveText("Shop");
  await card.getByRole("button", { name: "Back", exact: true }).click();
  await expect(card.locator(".screen-head h2")).toHaveText("Race Lobby");
  await expect(card.getByRole("button", { name: "Change loadout", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await app.ready();
  expect(app.errors).toEqual([]);
});

test("clipboard denial offers selectable text without claiming success or breaking the menu", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) } });
  });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-account", "Account");
  const card = page.locator('[data-ref="menuCard"]');
  const code = await card.getByLabel("Your exportable save code").inputValue();
  await card.getByRole("button", { name: "Copy code", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Copy manually", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Text to copy")).toHaveValue(code);
  await expect(dialog.getByLabel("Text to copy")).toBeFocused();
  await expect(page.getByText("Save code copied", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.locator(".screen-head h2")).toHaveText("Account");
  await card.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect(dialog.getByLabel("Text to copy")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card.locator(".screen-head h2")).toHaveText("Account");
  expect(app.errors).toEqual([]);
});

test("offline private-room actions explain their limitation, while solo modes remain accessible", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  await expect(card.locator('[data-action="host-room"]')).toBeDisabled();
  await expect(card.locator('[data-action="join-room"]')).toBeDisabled();
  await expect(card.getByText("Live rooms are not available in this edition.", { exact: false })).toBeVisible();
  await app.backHome();
  await app.openMenu("mode-select", "Game modes");
  await card.locator('[data-action="pick-mode"][data-id="endless"]').click();
  await app.pause(); await app.resume();
  expect(app.errors).toEqual([]);
});
