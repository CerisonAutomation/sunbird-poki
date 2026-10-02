import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

const save = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("sunbird.save.v2")!));

test("shop search and filters never spend or equip; sections remain reachable", async ({ page }, info) => {
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-shop", "Shop");
  const before = await save(page);
  const card = page.locator('[data-ref="menuCard"]');
  const search = page.getByRole("searchbox", { name: "Find a bird" });
  await search.pressSequentially("Bluejay", { delay: 20 });
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Bluejay");
  await expect(card.locator(".skin-card")).toHaveCount(1);
  // Browsing is browsing. The hero panel names the bird you are FLYING, so a
  // search that cannot spend or equip must not move it either — and a search
  // box that silently equipped what it matched would be the worst possible
  // answer for a player still deciding.
  const hero = card.locator(".shop-hero-name");
  await expect(hero).toHaveText("Sunbird");
  await expect(card.locator(".shop-preview-label")).toHaveText("YOUR EQUIPPED BIRD");
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
  // Still nothing spent and nothing equipped after the whole browsing pass.
  expect((await save(page)).wallet).toBe(before.wallet);
  expect((await save(page)).activeSkin).toBe(before.activeSkin);
  for (const id of ["shopBoosts", "shopTrails"]) {
    await card.locator(`[data-action="shop-section"][data-id="${id}"]`).click();
    await expect(card.locator(`details[data-ref="${id}"]`)).toHaveAttribute("open", "");
    await app.expectMenuFits();
  }
  expect(app.errors).toEqual([]);
});

test("the hero panel names the equipped bird and offers no way to fake one", async ({ page }) => {
  // Commit ca6d15c removed the per-card "Preview" control: it moved the hero art
  // without spending a coin or equipping anything, so the shop could show a bird
  // under a "BIRD PREVIEW · NOT EQUIPPED" label that the player was not flying
  // and could not fly. The promise the game makes now is narrower and honest —
  // the hero panel IS the equipped bird — so both halves are pinned: the panel
  // says so, and a bird the player does not own cannot get up there.
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.openMenu("open-shop", "Shop");
  const card = page.locator('[data-ref="menuCard"]');
  await expect(card.locator(".shop-preview-label")).toHaveText("YOUR EQUIPPED BIRD");
  await expect(card.locator(".shop-preview-label")).not.toContainText("PREVIEW ·");
  await expect(card.locator(".shop-hero-name")).toHaveText("Sunbird");
  // The removed control is gone, not renamed: no button may claim to preview.
  await expect(card.getByRole("button", { name: /^Preview / })).toHaveCount(0);
  // A collection card for a bird that is neither owned nor affordable offers a
  // price (or a reason it is locked) — never a "see it up top" shortcut.
  const nature = card.locator('details[data-ref="collection-nature"]');
  await nature.locator("summary").click();
  const unowned = nature.locator(".skin-card:not(.owned)").first();
  await expect(unowned).toBeVisible();
  await expect(unowned.locator(".shop-preview-action")).toHaveCount(0);
  await expect(card.locator(".shop-hero-name")).toHaveText("Sunbird");
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
  const card = page.locator('[data-ref="menuCard"]');
  const search = page.getByRole("searchbox", { name: "Find a bird" });
  await search.fill("Bluejay");
  await expect(card.locator(".skin-card")).toHaveCount(1);
  // Read the price the shop is actually asking for instead of importing the
  // economy module: this spec asserts what the player is shown, and Economy.ts
  // reads import.meta.env at module scope so plain Node cannot load it (same
  // reason e2e/i18n.spec.ts and e2e/visual-locale.spec.ts import
  // ../src/i18n/locales rather than ../src/i18n).
  //
  // Scoped to the collection card on purpose. The daily flash sale renders a
  // second `buy-skin` for whichever bird it has picked, and on the days that
  // bird is this one an unscoped locator would match both.
  const buy = card.locator('[data-ref^="collection-"] [data-action="buy-skin"][data-id="bluejay"]');
  const priceLabel = await buy.getAttribute("aria-label");
  const price = Number(/for (\d+) coins/.exec(priceLabel ?? "")?.[1]);
  expect(Number.isFinite(price), `buy button exposes no price: ${priceLabel}`).toBe(true);
  // The card is the product shot and a press on a price button spends, so the
  // button is the target — twice, because a double purchase must still cost
  // once (`buySkin` re-equips an already-owned bird rather than charging it
  // again).
  await buy.dblclick();
  await expect(page.locator(".shop-preview-action")).toHaveText("✓ In use");
  const bought = await save(page);
  expect(bought.wallet).toBe(before.wallet - price);
  expect(bought.activeSkin).toBe("bluejay");
  expect(bought.ownedSkins.filter((id: string) => id === "bluejay")).toHaveLength(1);
  await expect(search).toHaveValue("Bluejay");
  await page.reload(); await app.ready(); await app.openMenu("open-shop", "Shop");
  // The hero is the equipped bird, so the one the player just bought is the
  // one the shop now shows — labelled as theirs, not as a preview.
  await expect(page.locator(".shop-hero-name")).toHaveText("Bluejay");
  await expect(page.locator(".shop-preview-label")).toHaveText("YOUR EQUIPPED BIRD");
  expect((await save(page)).wallet).toBe(bought.wallet);
  expect(app.errors).toEqual([]);
});