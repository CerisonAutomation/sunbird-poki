import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Menu → flight actionability measurement.
 *
 * The first-session probe measured 3.9 s between "menu is on screen" and
 * "flight started" on desktop, against 0.9 s on phone. This isolates that leg:
 * when does the primary CTA exist, become visible, stop moving, and how long
 * does a raw (non-actionability-waiting) click take to reach flight?
 * Three trials per viewport so a single slow frame is not mistaken for a fact.
 */
test("menu CTA actionability", async ({ page }, info) => {
  const trials: unknown[] = [];
  for (let trial = 0; trial < 3; trial++) {
    await page.goto("/", { waitUntil: "commit" });
    const t0 = Date.now();
    const at = () => Date.now() - t0;
    await expect(page.locator("#boot-shell")).toHaveCount(0);
    // First run shows the welcome screen; accept the pre-filled name exactly
    // like SunbirdPage.ready so the measured leg is menu → flight.
    const welcome = page.locator('[data-action="confirm-pilot-name"]');
    if (await welcome.isVisible().catch(() => false)) await welcome.click();
    const bootDone = at();
    const cta = page.getByRole("button", { name: "Play free flight now", exact: true });
    await cta.waitFor({ state: "visible" });
    const visible = at();

    // When does the button stop moving? Sample the box every animation frame.
    const stableAt = await page.evaluate(() => new Promise<number>(resolve => {
      const btn = document.querySelector<HTMLElement>('.home-launch')!;
      let last = btn.getBoundingClientRect().toJSON();
      let same = 0;
      const start = performance.now();
      const tick = () => {
        const now = btn.getBoundingClientRect().toJSON();
        const moved = Math.abs(now.top - last.top) > 0.01 || Math.abs(now.left - last.left) > 0.01
          || Math.abs(now.width - last.width) > 0.01 || Math.abs(now.height - last.height) > 0.01;
        last = now;
        same = moved ? 0 : same + 1;
        if (same >= 3) resolve(Math.round(performance.now() - start));
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));

    // Raw click: no actionability wait, no retry. This is what a finger does.
    const clickAt = at();
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.home-launch')!.click());
    await expect(page.locator('[data-action="pause"]')).toBeVisible();
    const flightAt = at();

    trials.push({
      trial,
      bootDoneMs: bootDone,
      ctaVisibleMs: visible,
      ctaStableMsAfterVisible: stableAt,
      rawClickDispatchedMs: clickAt,
      flightStartedMs: flightAt,
      rawClickToFlightMs: flightAt - clickAt,
      ctaBox: await page.locator('.home-launch').boundingBox(),
    });
  }
  const out = join(here, "..", "test-artifacts", `cta-actionability-${info.project.name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ project: info.project.name, viewport: page.viewportSize(), trials }, null, 2));
  expect(trials).toHaveLength(3);
});
