import { test, expect } from "@playwright/test";
import type { Server } from "node:http";
import {
  FREEZE, boot, openScreen,
  startArtifactServer, stopArtifactServer,
} from "./visual-helpers";

/**
 * Pixel baselines for the surfaces that must not drift silently. CSS animations
 * are frozen first so a run is repeatable.
 *
 * Baselines live in e2e/visual-baselines.spec.ts-snapshots/ and are committed.
 * They are font-sensitive: regenerate deliberately after an intended design
 * change with `pnpm exec playwright test -c playwright.visual.config.ts
 * --update-snapshots` and review the diff before committing.
 */
let server: Server;
let baseUrl = "";

test.beforeAll(async () => { ({ server, baseUrl } = await startArtifactServer()); });
test.afterAll(async () => { await stopArtifactServer(server); });

const CARD = '[data-ref="menuCard"]';

test("menu card", async ({ page }) => {
  await boot(page, baseUrl);
  await page.addStyleTag({ content: FREEZE });
  await expect(page.locator(CARD)).toHaveScreenshot("menu-card.png", { maxDiffPixelRatio: 0.01 });
});

test("settings screen", async ({ page }) => {
  await boot(page, baseUrl);
  await openScreen(page, "open-settings");
  await page.addStyleTag({ content: FREEZE });
  await expect(page.locator(CARD)).toHaveScreenshot("settings-card.png", { maxDiffPixelRatio: 0.01 });
});

test("leaderboard screen", async ({ page }) => {
  await boot(page, baseUrl);
  await openScreen(page, "open-board");
  await page.addStyleTag({ content: FREEZE });
  await expect(page.locator(CARD)).toHaveScreenshot("board-card.png", { maxDiffPixelRatio: 0.01 });
});

test("Arabic mirrors the menu", async ({ page }) => {
  await boot(page, baseUrl, "ar");
  await page.addStyleTag({ content: FREEZE });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe("rtl");
  await expect(page.locator(CARD)).toHaveScreenshot("menu-card-rtl.png", { maxDiffPixelRatio: 0.01 });
});
