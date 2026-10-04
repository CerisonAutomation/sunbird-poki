/**
 * Grounded-start probe (2026-10-04 directive: "improve the start so the bird
 * doesn't start in the air"): boot the real dev build as a brand-new player,
 * tap "Fly now", and read the live altitude gauge the instant the run begins.
 *
 * The old spawn dropped the bird in 14 m above the hill (START_ALTITUDE), so
 * the first readable frame showed ~13-14 m of altitude the player never
 * earned and the opening looked like a fall. The grounded start must read
 * 0 m — the bird is perched on the opening hill, matching the flock and the
 * tutorial's first instruction. The altitude gauge is the HUD's own live
 * readout of `bird.altitude`, so this is the game reporting itself.
 *
 * Leaves audit-shots/16-grounded-start.png behind.
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: "/tmp/spart/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await (await browser.newContext({ viewport: { width: 412, height: 839 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 100)); });

await page.goto("http://localhost:5173/", { waitUntil: "commit" });
await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
await page.waitForTimeout(1200);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) await confirm.click();
await page.waitForTimeout(800);

await page.getByRole("button", { name: "Fly now", exact: true }).first().click();
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  if (await page.evaluate(() => document.querySelector(".hud-root")?.dataset.uiState === "playing")) break;
  await page.waitForTimeout(250);
}

// The first readable altitude frames. Grounded = 0 m; the old airborne start
// read ~13-14 m here (14 m spawn minus a couple of frames of GRAVITY_DIVE).
const readAlt = () => page.evaluate(() => document.querySelector(".alt-read span")?.textContent ?? "?");
const first = await readAlt();
await page.waitForTimeout(350);
const second = await readAlt();

// The tutorial's first instruction should match the bird's actual situation.
const coach = await page.evaluate(() => document.querySelector(".coach-steps")?.textContent?.replace(/\s+/g, " ").trim() ?? "");

// Let the run breathe for the screenshot: hold the dive a moment, like the
// coach just asked, then release.
await page.mouse.down();
await page.waitForTimeout(900);
await page.mouse.up();
await page.waitForTimeout(400);
await page.screenshot({ path: "audit-shots/16-grounded-start.png" });

const alive = await page.evaluate(() => document.querySelector(".hud-root")?.dataset.uiState === "playing");
const firstM = Number.parseFloat(first);
const pass = Number.isFinite(firstM) && firstM <= 1 && alive;
console.log(`altitude at GO: ${first} then ${second}`);
console.log(`coach step 0: ${JSON.stringify(coach.slice(0, 60))}`);
console.log(`run alive after 1.3 s: ${alive}`);
console.log(pass
  ? "PASS: the run starts grounded (0 m at the first frame)"
  : "FAIL: the bird still starts in the air");
await browser.close();
console.log("console errors:", errors.length ? [...new Set(errors)].slice(0, 2).join(" | ") : "(none)");
process.exit(pass ? 0 : 1);
