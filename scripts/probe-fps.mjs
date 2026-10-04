/**
 * Performance probe (2026-10-04 "max performance / max FPS" directive).
 *
 * Measures the real frame cadence of the running game in three regimes:
 *   1. menu attract mode (the 3D world behind the menu card),
 *   2. active flight over the first world (dive pulses, like a player),
 *   3. the same flight's WORST windows — spikes are what read as jank.
 *
 * Samples requestAnimationFrame deltas in-page (the same clock the game
 * renders on) and reports avg / p50 / p95 / p99 / max frame time plus the
 * count of frames over 1x and 2x the 16.7 ms budget.
 *
 * HONEST CAVEAT, printed with the report: this sandbox renders through
 * SwiftShader (software GL, no GPU), so the ABSOLUTE fps is not the fps a
 * player sees. What transfers is the SHAPE of the distribution: whether the
 * cadence is steady or has spikes, and whether flight is dramatically worse
 * than the menu (a sign the game, not the rasterizer, is the bottleneck).
 *
 * Leaves audit-shots/19-perf-flight.png behind.
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
await page.waitForTimeout(1500);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) await confirm.click();
await page.waitForTimeout(1000);

/** Install the rAF sampler; returns a function that collects the stats. */
await page.evaluate(() => {
  window.__frames = [];
  window.__sampling = true;
  const tick = (t) => {
    if (window.__last != null) window.__frames.push(t - window.__last);
    window.__last = t;
    if (window.__sampling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const collect = () => page.evaluate(() => {
  const f = window.__frames.splice(0);
  f.sort((a, b) => a - b);
  const at = (p) => f.length ? f[Math.min(f.length - 1, Math.floor(f.length * p))] : 0;
  return {
    n: f.length,
    avg: f.length ? +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) : 0,
    p50: at(0.5), p95: at(0.95), p99: at(0.99),
    max: f.length ? f[f.length - 1] : 0,
    over17: f.filter((x) => x > 17).length,
    over33: f.filter((x) => x > 33).length,
  };
});
const pct = (s) => s.n ? `n=${s.n} avg=${s.avg}ms p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max} >17ms:${s.over17} >33ms:${s.over33}` : "no frames";

// 1 — menu attract mode.
await page.waitForTimeout(4000); // settle: boot burst, first paints
await collect();
await page.waitForTimeout(8000);
const menu = await collect();
console.log(`menu attract:   ${pct(menu)}`);

// 2 — active flight.
await page.getByRole("button", { name: "Fly now", exact: true }).first().click();
await page.waitForFunction(() => document.querySelector(".hud-root")?.dataset.uiState === "playing", null, { timeout: 60_000 });
await page.waitForTimeout(2000); // countdown + opening settle
await collect();
for (let i = 0; i < 12; i++) {
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(550);
}
const flight = await collect();
console.log(`active flight:  ${pct(flight)}`);
await page.screenshot({ path: "audit-shots/19-perf-flight.png" });

// 3 — the worst one-second window inside a second flight sample (jank clusters).
const windows = await page.evaluate(() => {
  return new Promise((resolve) => {
    const frames = [];
    const t0 = performance.now();
    const tick = (t) => {
      if (window.__last2 != null) frames.push({ dt: t - window.__last2, t });
      window.__last2 = t;
      if (t - t0 < 6000 && window.__sampling) requestAnimationFrame(tick);
      else {
        // Worst 1s window = the fewest frames drawn (throughput), not the most.
        let worst = { n: Number.POSITIVE_INFINITY, sum: 0 };
        for (let i = 0; i < frames.length; i++) {
          const w = { sum: 0, n: 0 };
          for (let j = i; j < frames.length && frames[j].t - frames[i].t < 1000; j++) { w.sum += frames[j].dt; w.n++; }
          if (w.n > 0 && w.n < worst.n) worst = w;
        }
        // t and t0 share the performance.now() base; dt is ms — print SECONDS.
        const spikes = frames.filter((f) => f.dt > 50).map((f) => `${Math.round(f.dt)}ms@+${((f.t - t0) / 1000).toFixed(1)}s`);
        resolve({
          fullSeconds: +(frames.reduce((a, f) => a + f.dt, 0) / 1000).toFixed(1),
          worstN: Number.isFinite(worst.n) ? worst.n : 0,
          spikes: spikes.slice(0, 8),
        });
      }
    };
    requestAnimationFrame(tick);
  });
});
console.log(`flight second pass: ${windows.fullSeconds}s of frames; worst 1s window drew ${windows.worstN} frames; >50ms spikes: ${windows.spikes.length ? windows.spikes.join(", ") : "(none)"}`);

// The sample-size floor is renderer-aware: a software rasterizer (SwiftShader,
// ~7x slower than any player GPU) cannot produce 200 frames in a 10s flight,
// so requiring it there would fail every honest run. 40 frames at ~117ms each
// is still a real distribution. A real GPU keeps the 200-frame bar.
const renderer = await page.evaluate(() => {
  const c = document.createElement("canvas");
  const gl = c.getContext("webgl2") ?? c.getContext("webgl");
  const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
});
const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
const floor = software ? 40 : 200;
console.log(`renderer: ${renderer.slice(0, 80)}`);
const flightOk = flight.n > floor;
console.log(flightOk
  ? `PASS: frame cadence measured (n=${flight.n} > floor ${floor}${software ? " — software renderer floor" : ""})`
  : `FAIL: too few frames sampled (n=${flight.n} <= floor ${floor})`);
await browser.close();
console.log("console errors:", errors.length ? [...new Set(errors)].slice(0, 3).join(" | ") : "(none)");
console.log(software
  ? "NOTE: software rendering — absolute fps is not representative; distribution shape is."
  : "NOTE: hardware renderer — absolute fps is meaningful; p95 under 17ms is the bar.");
process.exit(flightOk ? 0 : 1);
