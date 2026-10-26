import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Budget for waiting on the loader to hand over to the menu. The same figure,
 * for the same reason, is `BOOT_TIMEOUT` in `SunbirdPage.ts:5-7`: the shipping
 * folder is one self-contained document the browser must fetch, parse and
 * execute, then build a WebGL scene in, before this screen exists — seconds
 * when quiet, tens of seconds when the box is busy. This spec used Playwright's
 * default 20 s `expect` timeout instead, and that is the whole of the desktop
 * failure it reported:
 *
 *   expect(locator('#boot-shell')).toHaveCount(0)   Expected: 0  Received: 1
 *   Timeout: 20000ms
 *
 * That is a measurement of how loaded the machine was, not of the CTA. The
 * budget below does not flatter the numbers this spec reports: `bootDoneMs` is
 * measured from `goto`, so a longer wait shows up as a longer boot leg rather
 * than as a shorter menu → flight leg.
 */
const BOOT_TIMEOUT = 45_000;

/**
 * Ceiling on how long the CTA may keep moving, in frames AND in wall time. The
 * stability probe samples a frame at a time, and a frame budget alone is not a
 * time budget: under SwiftShader on a busy box a frame can cost tens of
 * milliseconds, so 600 frames can burn the whole 300 s test budget and report
 * "Test timeout exceeded" instead of naming the defect. The wall-clock half
 * bounds the probe, so a CTA that never settles fails on the assertion that
 * describes it.
 */
const STABILITY_FRAME_CAP = 600;
const STABILITY_MS_CAP = 10_000;

type Trial = {
  trial: number;
  bootDoneMs: number;
  ctaVisibleMs: number;
  ctaVisibleAfterBootMs: number;
  ctaStableMsAfterVisible: number;
  ctaStable: boolean;
  rawClickDispatchedMs: number;
  flightStartedMs: number;
  rawClickToFlightMs: number;
  ctaBox: { x: number; y: number; width: number; height: number } | null;
};

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
  const trials: Trial[] = [];
  for (let trial = 0; trial < 3; trial++) {
    await page.goto("/", { waitUntil: "commit" });
    const t0 = Date.now();
    const at = () => Date.now() - t0;
    await expect(page.locator("#boot-shell")).toHaveCount(0, { timeout: BOOT_TIMEOUT });
    // No welcome step to accept here, and there has not been one since the
    // pilot-name screen was taken out of boot. This used to do
    //
    //   const welcome = page.locator('[data-action="confirm-pilot-name"]');
    //   if (await welcome.isVisible().catch(() => false)) await welcome.click();
    //
    // and a probe of the real build confirmed the element is never in the DOM:
    // `document.querySelectorAll('[data-action="confirm-pilot-name"]').length`
    // is 0 after boot, and `Game.ts:1284-1303` says why — "First use: never put
    // a screen between the visitor and the first `gameplayStart()` … The
    // generated call sign is accepted silently instead", ending with
    // `pilotNameCustomized = true` in the same breath. The generated name is
    // still there (`src/game/pilotNameGenerator.ts`), and the board's rename
    // row still owns naming. So the branch could only ever be false, and the
    // only thing it bought was one round trip per trial.
    const bootDone = at();
    const cta = page.getByRole("button", { name: "Fly now", exact: true });
    await cta.waitFor({ state: "visible" });
    const visible = at();

    // The box has to be read at a moment when the button is actually painted,
    // and the node has to be re-queried every frame rather than captured once.
    //
    // Both mistakes were made and caught here. Read after the click, the box
    // was `null` on every trial because the menu had already closed. Read from
    // a captured node, it was 0x0: the HUD replaces the card's markup when its
    // snapshot changes (the leaderboard strip and the onboarding rail both land
    // after the screen is up), the captured element is detached, and a detached
    // element measures 0x0 forever — so the probe "settled" instantly on a node
    // that no longer exists and reported a zero-width CTA as a real measurement.
    //
    // So: re-query per frame, and treat a missing or zero-area box as NOT
    // settled. A run of three identical non-degenerate frames is what "stopped
    // moving" means for a control a finger has to hit.
    const stableAt = await page.evaluate(([cap, msCap]) => new Promise<{ ms: number; settled: boolean; box: { x: number; y: number; width: number; height: number } | null }>(resolve => {
      type Box = { x: number; y: number; top: number; left: number; width: number; height: number };
      const read = (): Box | null => {
        const el = document.querySelector<HTMLElement>('.home-launch');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0) || !(r.height > 0)) return null;
        return { x: r.x, y: r.y, top: r.top, left: r.left, width: r.width, height: r.height };
      };
      const same = (a: Box, b: Box) => Math.abs(a.top - b.top) <= 0.01 && Math.abs(a.left - b.left) <= 0.01
        && Math.abs(a.width - b.width) <= 0.01 && Math.abs(a.height - b.height) <= 0.01;
      let last = read();
      let box: Box | null = last;
      let stable = 0;
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        const now = read();
        frames += 1;
        if (now) {
          box = now;
          stable = last && same(now, last) ? stable + 1 : 0;
          last = now;
        } else {
          // Mid-swap, or not laid out yet. Neither is "stopped moving".
          stable = 0;
          last = null;
        }
        if (stable >= 3) {
          const { x, y, width, height } = box!;
          resolve({ ms: Math.round(performance.now() - start), settled: true, box: { x, y, width, height } });
        } else if (frames >= cap || performance.now() - start >= msCap) {
          const out = box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
          resolve({ ms: Math.round(performance.now() - start), settled: false, box: out });
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), [STABILITY_FRAME_CAP, STABILITY_MS_CAP] as const);

    // Raw click: no actionability wait, no retry. This is what a finger does.
    const clickAt = at();
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.home-launch')!.click());
    await expect(page.locator('[data-action="pause"]')).toBeVisible();
    const flightAt = at();

    trials.push({
      trial,
      bootDoneMs: bootDone,
      ctaVisibleMs: visible,
      ctaVisibleAfterBootMs: visible - bootDone,
      ctaStableMsAfterVisible: stableAt.ms,
      ctaStable: stableAt.settled,
      rawClickDispatchedMs: clickAt,
      flightStartedMs: flightAt,
      rawClickToFlightMs: flightAt - clickAt,
      ctaBox: stableAt.box,
    });
  }
  const out = join(here, "..", "test-artifacts", `cta-actionability-${info.project.name}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ project: info.project.name, viewport: page.viewportSize(), trials }, null, 2));
  expect(trials).toHaveLength(3);

  // What the spec was written to find out, asserted so it cannot silently stop
  // finding it out. Every bound below is a product claim about the one control
  // that starts a game, on the leg the player actually spends time on.
  for (const t of trials) {
    const where = `trial ${t.trial} at ${info.project.name}`;

    // The loader coming down is not the menu being up. `App.tsx:127-131`
    // removes `#boot-shell` one animation frame after `new Game()`, and the
    // menu's own first render lands on the HUD's next push — so this gap is the
    // window in which the player is looking at nothing at all. It is bounded
    // here, not pinned: on a saturated box it measured 13.7 s on desktop, and a
    // bound that only holds when the machine is quiet measures the machine.
    expect(t.ctaVisibleAfterBootMs, `${where}: blank screen for ${t.ctaVisibleAfterBootMs}ms between the loader and the CTA`).toBeLessThan(20_000);

    // It is a real, hit-testable box — the geometry the report carries, which
    // used to be `null` on every trial because it was read after the menu
    // closed.
    expect(t.ctaBox, `${where}: CTA has no box`).not.toBeNull();
    expect(t.ctaBox!.width, `${where}: CTA box is degenerate`).toBeGreaterThan(0);
    expect(t.ctaBox!.height, `${where}: CTA box is degenerate`).toBeGreaterThan(0);

    // It stops moving. An action that is still sliding under the pointer is an
    // action a finger can miss, which is the defect this whole spec exists to
    // measure — and the phone's `#poki-debug-pill` incident is the extreme
    // version of it.
    expect(t.ctaStable, `${where}: CTA never stopped moving within ${STABILITY_FRAME_CAP} frames`).toBe(true);
    expect(t.ctaStableMsAfterVisible, `${where}: CTA took ${t.ctaStableMsAfterVisible}ms to settle`).toBeLessThan(10_000);

    // A raw click — no actionability wait, no retry, the same call a finger
    // makes — reaches a live run. Generous because SwiftShader rasterises on
    // the CPU, but it is a ceiling, not a target: the complaint that started
    // this spec was 3.9 s on desktop against 0.9 s on a phone.
    expect(t.rawClickToFlightMs, `${where}: raw click took ${t.rawClickToFlightMs}ms to reach flight`).toBeLessThan(15_000);
  }
});