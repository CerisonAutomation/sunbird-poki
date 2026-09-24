import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";
import { SKINS } from "../src/game/Economy";

const save = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("sunbird.save.v2")!));

test("shop search, preview and filters never spend or equip; sections remain reachable", async ({ page }, info) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-shop", "Shop");
  const before = await save(page);
  const card = page.locator('[data-ref="menuCard"]');
  const search = page.getByRole("searchbox", { name: "Find a bird" });
  await search.pressSequentially("Bluejay", { delay: 20 });
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Bluejay");
  await expect(card.locator(".skin-card")).toHaveCount(1);
  await card.getByRole("button", { name: "Preview Bluejay", exact: true }).click();
  await expect(card.locator(".shop-hero-name")).toHaveText("Bluejay");
  await expect(card.locator(".shop-preview-label")).toContainText("NOT EQUIPPED");
  expect((await save(page)).wallet).toBe(before.wallet);
  expect((await save(page)).activeSkin).toBe(before.activeSkin);
  await app.expectMenuFits();
  await page.screenshot({ path: info.outputPath("shop-preview.png") });
  await search.fill("");
  await card.getByRole("button", { name: "Owned", exact: true }).click();
  await expect(card.locator(".skin-card")).toHaveCount(1);
  await expect(card.locator(".sk-name")).toHaveText("Sunbird");
  await search.fill("<script>unlikely & bird");
  await expect(card.locator(".shop-empty")).toBeVisible();
  await card.getByRole("button", { name: "Show all birds", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(card.locator('.shop-filters [data-id="all"]')).toHaveAttribute("aria-pressed", "true");
  for (const id of ["shopBoosts", "shopTrails"]) {
    await card.locator(`[data-action="shop-section"][data-id="${id}"]`).click();
    await expect(card.locator(`details[data-ref="${id}"]`)).toHaveAttribute("open", "");
    await app.expectMenuFits();
  }
  expect(app.errors).toEqual([]);
});

test("a coin purchase equips once and survives reload without resetting shop search", async ({ page }) => {
  // An established player's wallet fixture, not a product-side test/debug API.
  await page.addInitScript(() => {
    if (!localStorage.getItem("sunbird.save.v2")) localStorage.setItem("sunbird.save.v2", JSON.stringify({ wallet: 2000 }));
  });
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-shop", "Shop");
  const before = await save(page);
  const search = page.getByRole("searchbox", { name: "Find a bird" });
  await search.fill("Bluejay");
  await page.getByRole("button", { name: "Preview Bluejay", exact: true }).click();
  await page.locator('.shop-preview-action [data-action="buy-skin"]').dblclick();
  await expect(page.locator(".shop-preview-action")).toHaveText("✓ In use");
  const bought = await save(page);
  expect(bought.wallet).toBe(before.wallet - SKINS.find(s => s.id === "bluejay")!.price);
  expect(bought.activeSkin).toBe("bluejay");
  expect(bought.ownedSkins.filter((id: string) => id === "bluejay")).toHaveLength(1);
  await expect(search).toHaveValue("Bluejay");
  await page.reload(); await app.ready(); await app.openMenu("open-shop", "Shop");
  await expect(page.locator(".shop-hero-name")).toHaveText("Bluejay");
  await expect(page.locator(".shop-preview-label")).toHaveText("YOUR EQUIPPED BIRD");
  expect((await save(page)).wallet).toBe(bought.wallet);
  expect(app.errors).toEqual([]);
});
