import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("a real completed flight puts replay first and preserves results when browsing the shop", async ({ page }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  const app = new SunbirdPage(page);
  await app.open(); await app.ready(); await app.fly();
  // Let the actual daylight clock end a no-input flight; no shipped test hooks,
  // accelerated physics or manufactured results DOM.
  await expect(page.locator('[data-ref="continue"]:not(.hidden), [data-ref="over"]:not(.hidden)')).toBeVisible({ timeout: 140000 });
  const sleep = page.locator('[data-action="continue-sleep"]');
  if (await sleep.isVisible()) await sleep.click();
  const result = page.locator('[data-ref="over"]');
  await expect(result).toBeVisible();
  await expect(result.getByRole("heading", { name: "Flight completed", exact: true })).toBeVisible();
  await expect(result.locator(".result-actions .play-again-btn")).toBeInViewport({ ratio: 1 });
  await expect(result.locator(".play-again-btn")).toHaveCount(1);
  const bounds = await result.locator(".paper-card").boundingBox();
  const toasts = await page.locator('[data-ref="toasts"]').boundingBox();
  if (toasts && toasts.height && bounds) expect(bounds.y + bounds.height).toBeLessThanOrEqual(toasts.y);
  await page.screenshot({ path: info.outputPath("results-320.png") });
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(result.locator(".result-actions .play-again-btn")).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath("results-568.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(result.locator(".next-flight")).toContainText("NEXT FLIGHT");
  const downloadPromise = page.waitForEvent("download");
  await result.locator('[data-action="share"]').click();
  const download = await downloadPromise;
  const cardPath = info.outputPath("flight-postcard.png");
  await download.saveAs(cardPath);
  const png = await readFile(cardPath);
  expect(png.readUInt32BE(16)).toBe(1000);
  expect(png.readUInt32BE(20)).toBe(620);
  await result.locator('[data-action="open-shop"]').click();
  const card = page.locator('[data-ref="menuCard"]');
  await expect(card.locator(".screen-head h2")).toHaveText("Shop");
  await card.getByRole("button", { name: "Back", exact: true }).click();
  await expect(result).toBeVisible();
  await result.locator(".result-actions .play-again-btn").click();
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  expect(app.errors).toEqual([]);
});
