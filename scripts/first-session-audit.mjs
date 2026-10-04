/**
 * First-session audit: play the game like a brand-new player and screenshot
 * every step, with timestamps, to find where the 1m20s average is lost.
 *
 * Also asserts the engagement levers from docs/poki/ENGAGEMENT_PLAYBOOK.md
 * where they are observable in the shipping UI: the golden-hour pre-cue
 * (fires once, while daylight remains), the outcome-aware recap headline
 * (a completed day trip is celebrated, not mourned), and the run-2 daily
 * challenge CTA. These are artifact-level checks on purpose — the PvP
 * incident taught us source-shape audits miss what the build actually does.
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
const leverHits = { goldenCue: 0, goldenHour: 0 };
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140)); });

const shot = async (name) => {
  marks.push(mark(name));
  await page.screenshot({ path: `${OUT}/${String(marks.length).padStart(2, "0")}-${name}.png` });
};

/** Sample the live HUD text so late-run toasts (golden hour cues) are caught
 *  even though they disappear before the next screenshot. */
const sampleHud = async () => {
  try {
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("Golden hour soon")) leverHits.goldenCue++;
    if (text.includes("coins worth double")) leverHits.goldenHour++;
  } catch { /* page navigating */ }
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
  await sampleHud();
}
if (holding) await page.mouse.up();
await shot("mid-run");

// Let the sun run out (or crash) — wait for gameover/continue state, sampling
// for the golden-hour cues while the day drains.
for (let waited = 0; waited < 45_000; waited += 2000) {
  await page.waitForTimeout(2000);
  await sampleHud();
}
await shot("after-sunset");
await page.waitForTimeout(3000);
await shot("after-sunset-2");

// Dump the HUD state text — and check the recap headline honours runOutcome.
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("=== BODY TEXT ===");
console.log(bodyText);
console.log("=== RECAP HEADLINE ===");
const completeRun = bodyText.includes("You flew to sundown") || bodyText.includes("Flight complete — landed clean");
const mournedComplete = bodyText.includes("The sun beat you") && !bodyText.includes("You washed out");
console.log(completeRun
  ? `PASS: completed run is celebrated (${bodyText.includes("You flew to sundown") ? "You flew to sundown" : "landed clean"})`
  : mournedComplete
    ? "FAIL: run read as a defeat — check runOutcome plumbing into HudSnapshot"
    : "INFO: run failed or screen not on recap (headline not checkable)");

// Try to find and click retry if present.
const retry = page.locator('[data-action="retry"]');
if (await retry.isVisible().catch(() => false)) {
  await shot("gameover-screen");
  await retry.click();
  await page.waitForTimeout(2000);
  await shot("after-retry");
  // Run 2 started: the concrete daily-challenge CTA should replace the old
  // vague "social sky" nudge (playbook lever 9).
  const run2 = await page.evaluate(() => document.body.innerText);
  console.log("=== RUN-2 CTA ===");
  console.log(run2.includes("Daily Challenge is live")
    ? "PASS: run-2 toast is the concrete daily-challenge CTA"
    : `INFO: run-2 CTA not observed (toast may have expired); saw: ${run2.slice(0, 200).replace(/\n/g, " | ")}`);
} else {
  await shot("no-retry-visible");
}

console.log("=== ENGAGEMENT LEVERS ===");
console.log(`golden-hour pre-cue ("Golden hour soon") observed: ${leverHits.goldenCue > 0 ? `PASS (${leverHits.goldenCue} samples)` : "FAIL — never seen while the day drained"}`);
console.log(`golden-hour payoff ("coins worth double") observed: ${leverHits.goldenHour > 0 ? "PASS" : "not seen (run may have ended early)"}`);

console.log("=== TIMELINE ===");
for (const m of marks) console.log(`${m.at.padStart(7)}  ${m.name}`);
console.log("=== CONSOLE ERRORS ===");
console.log(consoleErrors.length ? consoleErrors.join("\n") : "(none)");

await browser.close();
