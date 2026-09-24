import { test, expect, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * Performance + reliability gate.
 *
 * CI renders with SwiftShader (software GL), so absolute FPS is meaningless
 * here — the gate asserts what actually protects players and portal ranking:
 *
 *   1. Boot: the page reaches "ready" within a catastrophic-regression
 *      ceiling, and the measured time is logged so CI trends are visible.
 *   2. Jank-freedom: in steady-state menu and during live flight, NO frame
 *      exceeds the long-frame ceiling. A GC storm, a chunk rebuild or a
 *      shader recompile shows up as a multi-hundred-ms frame and fails here
 *      — the same signal `perf_frame` telemetry measures in the field.
 *   3. Zero console/page errors across the whole session (the same standard
 *      the Poki Inspector applies during QA).
 */

/** Sample N animation-frame durations in-page (no per-frame round-trips). */
async function frameDurations(page: Page, frames: number): Promise<number[]> {
  return page.evaluate(
    (n) =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = performance.now();
        const tick = (now: number) => {
          out.push(now - last);
          last = now;
          if (out.length < n) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

/** Warm-up frames are excluded (shader compile, font load, first chunk). */
function assertJankFree(name: string, samples: number[], warmup: number, ceilingMs: number): void {
  const steady = samples.slice(warmup).sort((a, b) => a - b);
  const p50 = quantile(steady, 0.5);
  const p95 = quantile(steady, 0.95);
  const max = steady[steady.length - 1] ?? 0;
  console.log(`[perf] ${name}: p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms max=${max.toFixed(0)}ms over ${steady.length} frames`);
  expect(max, `${name}: a ${max.toFixed(0)}ms frame exceeds the ${ceilingMs}ms ceiling (jank regression)`).toBeLessThan(ceilingMs);
}

test("boot reaches ready inside the catastrophic ceiling", async ({ page }) => {
  const app = new SunbirdPage(page);
  const t0 = Date.now();
  await app.open();
  await app.ready();
  const bootMs = Date.now() - t0;
  console.log(`[perf] boot → ready: ${bootMs}ms (swiftshader + CI; trends over absolute value)`);
  expect(bootMs).toBeLessThan(30_000);
});

test("steady-state menu has no long frames", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await expect(page.getByRole("button", { name: "Play free flight now", exact: true })).toBeVisible();
  const samples = await frameDurations(page, 360); // ~6 s at 60 Hz
  assertJankFree("menu", samples, 60, 250);
  expect(app.errors, `console/page errors in menu: ${app.errors.join(" | ")}`).toEqual([]);
});

test("live flight (terrain streaming + FX) has no long frames and no errors", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();
  await app.fly();
  // Hold the dive input so the run keeps streaming terrain, spawning FX and
  // (eventually) hitting the run-end flow — all the jank-prone paths.
  // Viewport centre: the phone project is 412 px wide.
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
  await page.mouse.down();
  const samples = await frameDurations(page, 300); // ~5 s
  await page.mouse.up();
  assertJankFree("flight", samples, 60, 400);
  expect(app.errors, `console/page errors in flight: ${app.errors.join(" | ")}`).toEqual([]);
});
