/**
 * Reproduce: does a click or Space end a live break early?
 * Runs against the DEV server (direct build → the game's own timed break, which
 * is deterministic), reaches the break through the continue offer, then attacks
 * it. Screenshots each step so the behaviour can be looked at, not inferred.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ORIGIN = "http://localhost:5173";
mkdirSync("/tmp/adskip", { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

const state = () => page.evaluate(() => ({
  adCard: Boolean(document.querySelector('[data-ref="adCard"]')),
  adLabel: document.querySelector(".ad-label")?.textContent ?? null,
  skipBtn: (() => {
    const b = document.querySelector('[data-action="ad-skip"]');
    return b ? { disabled: b.hasAttribute("disabled"), text: b.textContent?.trim() } : null;
  })(),
  continue: Boolean(document.querySelector('[data-action="continue-sleep"]')),
  flying: Boolean(document.querySelector('[data-action="pause"]')),
}));

await page.goto(ORIGIN + "/", { waitUntil: "commit" });
await page.waitForTimeout(6000);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "Random name", exact: true }).click().catch(() => {});
  await confirm.click().catch(() => {});
  await page.waitForTimeout(800);
}
await page.getByRole("button", { name: "Play free flight now", exact: true }).click().catch(() => {});
console.log("flying; waiting for the run to end…");

let reached = null;
for (let i = 0; i < 60; i += 1) {
  await page.waitForTimeout(1500);
  const s = await state();
  if (s.continue) { reached = "continue"; break; }
  if (!s.flying && !s.continue) { reached = "other"; break; }
}
console.log("screen:", reached, JSON.stringify(await state()));

// Take the ad option to enter a real break.
await page.locator('[data-action="continue-ad"]').click().catch(() => {});
await page.waitForTimeout(400);
const atBreak = await state();
console.log("break entered:", JSON.stringify(atBreak));
await page.screenshot({ path: "/tmp/adskip/1-break-start.png" });

// A) a click in the middle of the screen
await page.mouse.click(320, 500);
await page.waitForTimeout(500);
const afterClick = await state();
console.log("after a click:  ", JSON.stringify(afterClick));
await page.screenshot({ path: "/tmp/adskip/2-after-click.png" });

// B) Space
await page.keyboard.press("Space");
await page.waitForTimeout(500);
const afterSpace = await state();
console.log("after Space:    ", JSON.stringify(afterSpace));
await page.screenshot({ path: "/tmp/adskip/3-after-space.png" });

// C) is the break still counting down, and does it end on its own?
await page.waitForTimeout(3500);
const later = await state();
console.log("3.5s later:     ", JSON.stringify(later));
await page.screenshot({ path: "/tmp/adskip/4-later.png" });

console.log(afterClick.adCard && afterSpace.adCard
  ? "RESULT: the break survived click and Space"
  : "RESULT: the break was ended by a click or Space");

await browser.close();
