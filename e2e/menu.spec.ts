import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("menu routes start at the top, remain in bounds, and keep Back reachable", async ({ page }) => {
  test.setTimeout(120000);
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  const screens = [
    ["settings", "Settings"], ["shop", "Shop"], ["scores", "High glides"], ["account", "Account"],
    ["live", "Race Lobby"], ["progress", "Your progress"], ["challenges", "Challenges"], ["cups", "Tournaments"],
    ["trophies", "Trophy Case"], ["pass", "Nest Pass"], ["atlas", "Island Atlas"],
    ["campaign", "The Long Migration"], ["rank", "Rival Rank"], ["board", "Leaderboard"], ["squad", "Squad"],
  ];
  const card = page.locator('[data-ref="menuCard"]');
  for (const [action, title] of screens) {
    await app.openMenu(`open-${action}`, title!);
    expect(await card.evaluate(el => el.scrollTop), title).toBe(0);
    await app.expectMenuFits();
    await card.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const back = card.getByRole("button", { name: "Back", exact: true });
    await expect(back).toBeInViewport();
    await app.backHome();
  }
  expect(app.errors).toEqual([]);
});

test("settings work by keyboard, stay focused, persist, and use honest mute state", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  const settings = page.locator('[data-action="open-settings"]');
  await settings.focus(); await page.keyboard.press("Enter");
  const card = page.locator('[data-ref="menuCard"]');
  await expect(card.locator("h2")).toHaveText("Settings");
  const mute = card.getByRole("button", { name: "Mute all sound", exact: true });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.focus(); await page.keyboard.press("Space");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toBeFocused();
  await page.keyboard.press("Space");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  const volume = card.getByLabel("Effects volume", { exact: true });
  await volume.fill("65"); await volume.dispatchEvent("change");
  await expect(volume).toHaveValue("65");
  await card.getByLabel("Music track", { exact: true }).selectOption("2");
  await card.getByLabel("Render quality", { exact: true }).selectOption("low");
  await app.backHome();
  await page.reload(); await app.ready();
  await app.openMenu("open-settings", "Settings");
  await expect(volume).toHaveValue("65");
  await expect(card.getByLabel("Music track", { exact: true })).toHaveValue("2");
  await expect(card.getByLabel("Render quality", { exact: true })).toHaveValue("low");
  // Disclosure summary is the last visible focusable control (destructive action closed).
  const danger = card.locator(".danger-zone > summary");
  await danger.focus(); await page.keyboard.press("Tab");
  await expect(card.getByRole("button", { name: "Back", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(danger).toBeFocused();
  expect(app.errors).toEqual([]);
});

test("room code is editable; shop collections stay open across visits", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-live", "Race Lobby");
  const card = page.locator('[data-ref="menuCard"]');
  const code = card.getByLabel("Room code", { exact: true });
  await code.fill("ABCDE");
  await card.getByRole("button", { name: "Change loadout", exact: true }).click();
  await card.getByRole("button", { name: "Back", exact: true }).click();
  // Drafts survive updates within a screen, not navigation into another screen.
  await code.fill("ABCDE");
  await expect(code).toHaveValue("ABCDE");
  await app.backHome();
  await app.openMenu("open-shop", "Shop");
  expect(await card.evaluate(el => el.scrollHeight)).toBeLessThan(1800);
  const collection = card.locator('details[data-ref="collection-nature"]');
  await collection.locator("summary").click();
  await expect(collection.locator(".skin-card").first()).toBeVisible();
  const locked = collection.locator('[data-action="buy-skin"]').first();
  await expect(locked).toBeDisabled();
  await app.backHome();
  await app.openMenu("open-shop", "Shop");
  await expect(collection).toHaveAttribute("open", "");
  expect(app.errors).toEqual([]);
});

test("save import requires explicit replacement consent and rejects an invalid code", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();
  await app.openMenu("open-account", "Account");
  const card = page.locator('[data-ref="menuCard"]');
  const before = await card.getByLabel("Your exportable save code").inputValue();
  await card.getByLabel("Save code to import").fill("not-a-save");
  await card.getByRole("button", { name: "Import save", exact: true }).click();
  await expect(card.getByRole("status")).toContainText("Confirm that you want to replace");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Import save", exact: true }).click();
  await expect(card.getByRole("status")).toContainText("couldn't be read");
  await expect(card.getByLabel("Your exportable save code")).toHaveValue(before);
  await expect(card.getByLabel("Save code to import")).toHaveValue("not-a-save");
  expect(app.errors).toEqual([]);
});

test("the main-menu backdrop is the live 3D gameplay world (no painted sky)", async ({ page }) => {
  test.setTimeout(120000);
  const app = new SunbirdPage(page);
  await app.open(); await app.ready();

  // The menu backdrop is the live 3D attract flight (Game.menuTick). The
  // painted 2D sky canvas must NOT be mounted — an opaque canvas covering the
  // gameplay world is exactly the regression this test guards against.
  await expect(page.locator(".menu-sky")).toHaveCount(0);

  // The hero-bird overlay stays mounted but permanently hidden.
  const heroHost = page.locator(".menu-hero-layer");
  await expect(heroHost).toHaveCount(1);
  await expect(heroHost).toHaveClass(/hidden/);

  // The 3D gameplay canvas is the backdrop: it fills the viewport under the
  // translucent card.
  const canvas = page.locator(".game-canvas");
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(0);
  expect(box!.y).toBeLessThanOrEqual(0);
  expect(box!.width).toBeGreaterThanOrEqual(vp.width);
  expect(box!.height).toBeGreaterThanOrEqual(vp.height);

  expect(app.errors).toEqual([]);
});
