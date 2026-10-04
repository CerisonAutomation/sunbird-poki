/**
 * First-session audit: play the game like a brand-new player and screenshot
 * every step, with timestamps, to find where the 1m20s average is lost.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "audit-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/tmp/spart/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 412, height: 839 } }); // phone-sized
const page = await context.newPage();

const t0 = Date.now();
const mark = (name) => ({ name, at: ((Date.now() - t0) / 1000).toFixed(1) + "s" });
const marks = [];
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140)); });

const shot = async (name) => {
  marks.push(mark(name));
  await page.screenshot({ path: `${OUT}/${String(marks.length).padStart(2, "0")}-${name}.png` });
};

await page.goto("http://localhost:5173/", { waitUntil: "commit" });
await page.waitForTimeout(3500);
await shot("boot");

// Wait for the menu CTA (fresh player may see the pilot welcome first).
await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
await page.waitForTimeout(1200);
await shot("first-screen");

const confirmName = page.locator('[data-action="confirm-pilot-name"]');
if (await confirmName.isVisible().catch(() => false)) {
  await shot("name-gate");
  await confirmName.click();
  await page.waitForTimeout(800);
}
await shot("menu");

const play = page.getByRole("button", { name: "Fly now", exact: true });
await play.click();
marks.push(mark("tapped-fly-now"));
await page.waitForTimeout(2500);
await shot("first-flight-start");

// Hold to dive/release to soar like a real player for ~20s.
const start = Date.now();
let holding = false;
while (Date.now() - start < 20_000) {
  const shouldHold = ((Date.now() - start) / 1000) % 2 < 1;
  if (shouldHold && !holding) { await page.mouse.down(); holding = true; }
  if (!shouldHold && holding) { await page.mouse.up(); holding = false; }
  await page.waitForTimeout(150);
}
if (holding) await page.mouse.up();
await shot("mid-run");

// Let the sun run out (or crash) — wait for gameover/continue state.
await page.waitForTimeout(45_000);
await shot("after-sunset");
await page.waitForTimeout(3000);
await shot("after-sunset-2");

// Dump the HUD state text.
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("=== BODY TEXT ===");
console.log(bodyText);

// Try to find and click retry if present.
const retry = page.locator('[data-action="retry"]');
if (await retry.isVisible().catch(() => false)) {
  await shot("gameover-screen");
  await retry.click();
  await page.waitForTimeout(2000);
  await shot("after-retry");
} else {
  await shot("no-retry-visible");
}

console.log("=== TIMELINE ===");
for (const m of marks) console.log(`${m.at.padStart(7)}  ${m.name}`);
console.log("=== CONSOLE ERRORS ===");
console.log(consoleErrors.length ? consoleErrors.join("\n") : "(none)");

await browser.close();
