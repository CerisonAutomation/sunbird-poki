/**
 * Run-2 CTA probe (artifact level): boot the real dev build as a brand-new
 * player, end two short runs, and assert the run-2 toast is the concrete
 * daily-challenge CTA from the engagement playbook (lever 9).
 *
 * The first-session audit could never observe this toast: it fires in
 * finishRun() at the END of the second run, and that audit stops two seconds
 * after the retry tap. This probe deliberately ends runs the fastest honest
 * way — dive into the sea — and skips the second-wind card with its plain
 * "let it sleep" decline, exactly the path a leaving player takes.
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: "/tmp/spart/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await (await browser.newContext({ viewport: { width: 412, height: 839 } })).newPage();

const t0 = Date.now();
const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`.padStart(6), m);

await page.goto("http://localhost:5173/", { waitUntil: "commit" });
await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
await page.waitForTimeout(1200);
const confirmName = page.locator('[data-action="confirm-pilot-name"]');
if (await confirmName.isVisible().catch(() => false)) await confirmName.click();
await page.waitForTimeout(800);

/** One short run: launch, dive until the run ends, decline any second wind. */
async function shortRun(n) {
  const fly = n === 1
    ? page.getByRole("button", { name: "Fly now", exact: true })
    : page.locator('[data-action="retry"]');
  await fly.first().click();
  log(`run ${n}: launched`);
  // Hold to dive constantly — a dive into the sea is the fastest honest end.
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await page.mouse.down();
    await page.waitForTimeout(400);
    const done = await page.evaluate(() => {
      const el = document.querySelector(".hud-root");
      return el?.dataset.uiState !== "playing";
    });
    if (done) break;
  }
  await page.mouse.up();
  log(`run ${n}: flight over`);
  // The second-wind card (if offered) declines with its plain button.
  for (let i = 0; i < 20; i++) {
    const sleep = page.locator('[data-action="continue-sleep"]');
    if (await sleep.isVisible().catch(() => false)) {
      await sleep.click();
      log(`run ${n}: second wind declined`);
      break;
    }
    const retry = page.locator('[data-action="retry"]');
    if (await retry.isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
}

await shortRun(1);
await page.screenshot({ path: "audit-shots/11-after-run-1.png" });
await shortRun(2);

// The run-2 toast fires in finishRun(); poll for it while it is readable.
let sawCta = false;
for (let i = 0; i < 12 && !sawCta; i++) {
  sawCta = await page.evaluate(() => document.body.innerText.includes("Daily Challenge is live"));
  if (!sawCta) await page.waitForTimeout(500);
}
await page.screenshot({ path: "audit-shots/12-run-2-cta.png" });
console.log(sawCta
  ? "PASS: run-2 CTA is the concrete daily-challenge toast (playbook lever 9)"
  : "FAIL: run-2 CTA never appeared on the results path");
await browser.close();
