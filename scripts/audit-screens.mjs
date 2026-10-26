/**
 * Screen audit (2026-10-04 directive: "what problems do you see"): boot the
 * real dev build with a fresh save and dump the home + shop screens as
 * structured DOM reports — vertical order, what each section is, and what
 * the shop actually sells — so the "move text to top" and "missing from
 * shop" reports can be answered against the artifact, not from memory.
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: "/tmp/spart/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await (await browser.newContext({ viewport: { width: 412, height: 839 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
page.on("requestfailed", (r) => errors.push(`REQ ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

await page.goto("http://localhost:5173/", { waitUntil: "commit" });
await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
await page.waitForTimeout(1200);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) await confirm.click();
await page.waitForTimeout(1000);

/** Vertical report of the current screen's direct sections. */
const layoutOf = (sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const rows = [...root.children].map((el) => {
    const r = el.getBoundingClientRect();
    const label = (el.getAttribute("class") || el.tagName).toString().split(" ").slice(0, 2).join(".");
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    return { label, top: Math.round(r.top), h: Math.round(r.height), text };
  }).sort((a, b) => a.top - b.top);
  const vh = window.innerHeight;
  return { vh, rows, belowFold: rows.filter((r) => r.top + r.h > vh).map((r) => r.label) };
}, sel);

console.log("=== HOME (paper card) — vertical order ===");
console.log(JSON.stringify(await layoutOf(".paper-card"), null, 1));

// Open the shop.
await page.locator('[data-action="open-shop"]').first().click();
await page.waitForTimeout(1200);
console.log("\n=== SHOP — vertical order ===");
console.log(JSON.stringify(await layoutOf(".paper-card"), null, 1));

const shopText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
console.log("\n=== SHOP — full text ===");
console.log(shopText);

await page.screenshot({ path: "audit-shots/13-shop-audit.png", fullPage: false });

// Back home, then into the AI PvP lobby — the world pills are where the
// eleven race courses live. The audit checks the newest two render.
await page.locator('[data-action="close"], [data-action="back"], [data-action="dismiss"]').first().click().catch(() => {});
await page.waitForTimeout(600);
await page.evaluate(() => { window.scrollTo(0, 0); });
const aiBtn = page.locator('[data-action="open-live"]').first();
if (await aiBtn.isVisible().catch(() => false)) {
  await aiBtn.click();
  await page.waitForTimeout(1200);
  const pills = await page.evaluate(() =>
    [...document.querySelectorAll(".world-pill")].map((el) => el.textContent.replace(/\s+/g, " ").trim()));
  console.log("\n=== AI PVP — world pills ===");
  console.log(JSON.stringify(pills, null, 1));
  await page.screenshot({ path: "audit-shots/14-race-audit.png", fullPage: false });
} else {
  console.log("\n=== AI PVP — button not visible, skipping ===");
}
await browser.close();
console.log("\n=== CONSOLE ERRORS ===");
console.log(errors.length ? errors.join("\n") : "(none)");
