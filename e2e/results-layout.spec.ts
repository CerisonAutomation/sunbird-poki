import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

test("a real completed flight puts replay first and preserves results when browsing the shop", async ({ page }, info) => {
  // 180s was not enough for this test's own work, let alone the game: the
  // daylight clock is deliberately left to run out, and that wait is allowed
  // 140s of it. What was left could not cover rendering and encoding a
  // 1000x620 share card on CPU-rasterised SwiftShader, so `waitForEvent
  // ("download")` was the assertion that timed out — the budget was the thing
  // under test, not the share button. The assertions are unchanged; only the
  // clock the flight genuinely needs has been given to it.
  test.setTimeout(420000);
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
  // The card names WHY the run ended, it does not say "Flight completed" for
  // every death — three different reasons used to produce one line that no
  // player could act on. This flight deliberately runs the daylight clock out,
  // so the title is pinned to that reason: a weaker `toBeVisible()` here would
  // pass no matter which reason the game reported, including none at all.
  await expect(result.getByRole("heading", { name: "The sun beat you", exact: true })).toBeVisible();
  await expect(result.locator(".end-reason")).toContainText("daylight ran out");
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
