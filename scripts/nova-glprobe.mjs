/**
 * nova-glprobe.mjs — per-frame WebGL call-volume probe.
 *
 * WHAT IT MEASURES. Real GL entry points on `WebGL2RenderingContext.prototype`,
 * wrapped from `page.addInitScript` so the wrapper is installed *before any app
 * code runs*, and bucketed between consecutive `requestAnimationFrame`
 * callbacks. One bucket = one frame. These are driver calls, not estimates and
 * not `renderer.info` — the app does not expose a renderer reference, and this
 * does not need one.
 *
 * Three readouts:
 *   FLIGHT / MENU  per-frame distribution of draw calls, program binds, buffer
 *                  uploads and uniforms, over frames that actually painted.
 *   FLIGHT GL per frame  the same, as means. More stable than a percentile
 *                  when comparing two runs of different length.
 *   SESSION GL totals    whole-page-lifetime counts, which is where anything
 *                  that happens once at load shows up: `bufferData` and
 *                  `createBuffer` count geometry/attribute buffers built,
 *                  `compileShader`/`linkProgram` count programs, `texImage2D`
 *                  counts texture uploads. A change in how much GPU memory the
 *                  scene allocates is a change in SESSION, not in FLIGHT.
 *
 * WHAT IT IS NOT. It does not measure milliseconds of GPU or CPU time. Frame
 * times it prints come from a software rasteriser (ANGLE/SwiftShader) and are
 * NOT phone numbers — do not quote them as such. Call volume is the honest
 * signal on a machine with no GPU.
 *
 * DEVICE PROFILES. Defaults to a Pixel 7 profile (412x839 CSS, touch, mobile
 * UA) at deviceScaleFactor 1 and 2, plus two desktop profiles. The phone
 * profile is the target: a mid-range Android in a browser on the Poki portal.
 * Set `PROFILES=phone-dsf1` to run a subset when iterating.
 *
 * WHY IT IS IN THE TREE. It is the measuring tool for the rendering claims in
 * `hive/research/render.md` §7, and for every before/after number behind those
 * changes. A perf claim you can re-run beats one you can only re-read, so this
 * is committed deliberately rather than left as scratch.
 *
 * USAGE
 *   pnpm dev                                   # in another shell
 *   CHROME_BIN=<chromium> BASE=http://localhost:5173 \
 *     node scripts/nova-glprobe.mjs
 *   PROFILES=phone-dsf1 node scripts/nova-glprobe.mjs   # subset
 *   ROUNDS=8 node scripts/nova-glprobe.mjs              # more flight samples
 *   WINDOW_MS=8000 WINDOWS=2 node scripts/nova-glprobe.mjs
 *
 * `CHROME_BIN` is needed when the installed playwright package expects a
 * browser build that is not present. Frame samples are dropped whenever the
 * run has ended (pause screen up), and a software rasteriser only paints a few
 * frames per second, so `ROUNDS`/`WINDOWS`/`WINDOW_MS` trade wall clock for
 * sample count. A delta of a few draw calls is only readable with a few
 * hundred frames: raise them when the box is too loaded to give a
 * trustworthy p50. Stats report `dropped` (frames that painted nothing) and
 * `frames` (frames that did) so a thin sample is visible, not implied.
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:4173";

const PROBE = () => {
  const C = window.WebGL2RenderingContext || window.WebGLRenderingContext;
  if (!C) { window.__probe = { dead: true }; return; }
  const keys = ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "useProgram", "texImage2D", "texSubImage2D", "createBuffer", "bufferData", "bufferSubData", "compileShader", "linkProgram", "bindTexture", "uniformMatrix4fv", "uniform4fv", "uniform3fv", "uniform1f", "clear", "depthMask", "colorMask", "blendFuncSeparate", "scissor"];
  const frame = {};
  const keys2 = keys;
  // Session-wide running totals, never cleared by reset(). Per-frame buckets
  // are the wrong instrument for anything that happens once at load: buffer
  // allocation, program compilation, texture upload. These count the whole page
  // lifetime, so a change in how many geometry buffers the game builds is
  // directly visible as a change in bufferData.
  const session = Object.fromEntries(keys2.map((k) => [k, 0]));
  for (const k of keys2) {
    frame[k] = 0;
    const orig = C.prototype[k];
    if (typeof orig !== "function") continue;
    C.prototype[k] = function (...a) { frame[k]++; session[k]++; return orig.apply(this, a); };
  }
  const samples = [];
  let last = null;
  const tick = (now) => {
    if (last) {
      last.draws = frame.drawElements + frame.drawArrays + frame.drawElementsInstanced + frame.drawArraysInstanced;
      last.inst = frame.drawElementsInstanced + frame.drawArraysInstanced;
      last.plain = last.draws - last.inst;
      last.prog = frame.useProgram;
      last.bufUp = frame.bufferSubData;
      last.uni = frame.uniformMatrix4fv + frame.uniform4fv + frame.uniform3fv + frame.uniform1f;
      last.g = keys2.map((k) => frame[k]);
      last.ms = now - last.t;
      samples.push(last);
      if (samples.length > 6000) samples.shift();
    }
    for (const k of keys2) frame[k] = 0;
    last = { t: now, g: [] };
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__probe = { samples, session, reset: () => { samples.length = 0; } };
};

const KEYS = ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "useProgram", "texImage2D", "texSubImage2D", "createBuffer", "bufferData", "bufferSubData", "compileShader", "linkProgram", "bindTexture", "uniformMatrix4fv", "uniform4fv", "uniform3fv", "uniform1f", "clear", "depthMask", "colorMask", "blendFuncSeparate", "scissor"];

const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0; };

// `painting` drops frames that issued no draw calls at all. Those are frames
// where nothing was on screen (boot, a screen with no 3D behind it, a tab that
// lost focus) — they are not "cheap frames", and leaving them in drags every
// percentile toward 0. `dropped` reports how many were removed, so a stat that
// quietly lost most of its sample is visible rather than believable.
function stats(list, warm = 15) {
  const painting = list.slice(warm).filter((x) => x.draws > 0);
  const dropped = list.slice(warm).length - painting.length;
  if (painting.length < 5) return { frames: list.length, painting: painting.length, dropped, note: "too few painting frames" };
  const s = painting;
  const ms = s.map((x) => x.ms), draws = s.map((x) => x.draws);
  const over30 = ms.filter((m) => m > 30).length;
  return {
    frames: s.length, dropped,
    draw_p50: q(draws, 0.5), draw_p95: q(draws, 0.95), draw_max: q(draws, 0.999),
    draw_mean: +(draws.reduce((a, b) => a + b, 0) / s.length).toFixed(1),
    instanced_p50: q(s.map((x) => x.inst), 0.5),
    nonInstanced_p50: q(s.map((x) => x.plain), 0.5),
    progBind_p50: q(s.map((x) => x.prog), 0.5),
    bufSubData_p50: q(s.map((x) => x.bufUp), 0.5),
    uniformsPerDraw: +(q(s.map((x) => x.uni), 0.5) / Math.max(1, q(draws, 0.5))).toFixed(1),
    ms_p50: +q(ms, 0.5).toFixed(1), ms_p95: +q(ms, 0.95).toFixed(1), ms_max: +q(ms, 0.999).toFixed(1),
    over30: over30, pctOver30: +((over30 / s.length) * 100).toFixed(1),
  };
}

function totals(list) {
  const t = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const painting = list.filter((x) => x.draws > 0);
  for (const s of painting) s.g.forEach((v, i) => { t[KEYS[i]] += v; });
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, +(v / Math.max(1, painting.length)).toFixed(1)]));
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const ALL_RUNS = [
  { id: "phone-dsf1", name: "phone 412x839 dsf1", dev: { ...devices["Pixel 7"], deviceScaleFactor: 1 } },
  { id: "phone-dsf2", name: "phone 412x839 dsf2", dev: { ...devices["Pixel 7"], deviceScaleFactor: 2 } },
  { id: "desktop-dsf1", name: "desktop 1280x800 dsf1", dev: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  { id: "desktop-dsf2", name: "desktop 1280x800 dsf2", dev: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
];

// PROFILES=phone-dsf1,phone-dsf2 runs a subset. Absent => every profile.
const WANTED = (process.env.PROFILES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RUNS = WANTED.length ? ALL_RUNS.filter((r) => WANTED.includes(r.id)) : ALL_RUNS;
if (!RUNS.length) {
  console.error(`PROFILES=${process.env.PROFILES} matched no profile. Known: ${ALL_RUNS.map((r) => r.id).join(", ")}`);
  process.exit(2);
}

for (const run of RUNS) {
  const ctx = await browser.newContext(run.dev);
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  await page.goto(BASE, { waitUntil: "commit" });
  // pilot welcome -> random name -> confirm
  const confirm = page.locator('[data-action="confirm-pilot-name"]');
  await confirm.waitFor({ timeout: 120_000 }).catch(() => {});
  if (await confirm.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Random name", exact: true }).click().catch(() => {});
    await confirm.click().catch(() => {});
  }
  const play = page.getByRole("button", { name: "Play free flight now", exact: true });
  await play.waitFor({ timeout: 60_000 }).catch(() => console.log(`[${run.name}] no play button`));
  await page.waitForTimeout(4000);

  const gl = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c && (c.getContext("webgl2") || c.getContext("webgl"));
    if (!g) return null;
    const d = g.getExtension("WEBGL_debug_renderer_info");
    return { buf: [g.drawingBufferWidth, g.drawingBufferHeight], px: g.drawingBufferWidth * g.drawingBufferHeight, r: d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)).slice(0, 40) : "" };
  });

  await page.evaluate(() => window.__probe.reset());
  await page.waitForTimeout(Number(process.env.MENU_MS || 5000));
  const menu = await page.evaluate(() => window.__probe.samples.slice());

  // Collect real flight frames: relaunch whenever the run ends.
  // A run ends on its own (crash into a slope ends the flight), so each round
  // re-enters from the pause screen rather than assuming a continuous flight.
  // The probe is reset ONCE, not per round, and each window contributes only
  // the frames it added while the pause button was hidden. Resetting per round
  // threw away every frame of any round that ended early, which on a software
  // rasteriser is most of them.
  const ROUNDS = Number(process.env.ROUNDS || 4);
  const WINDOWS = Number(process.env.WINDOWS || 3);
  const WINDOW_MS = Number(process.env.WINDOW_MS || 2000);
  const flight = [];
  const pause = page.locator('[data-action="pause"]');
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.evaluate(() => window.__probe.reset());
  for (let round = 0; round < ROUNDS; round++) {
    await play.click().catch(() => {});
    await pause.waitFor({ timeout: 30_000 }).catch(() => {});
    await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
    await page.mouse.down();
    for (let w = 0; w < WINDOWS; w++) {
      // NB: the in-page sample buffer is capped (6000) and shifts, so `from` is
      // only a valid index while the buffer has not wrapped. A wrapped run
      // reports fewer frames than it collected; it does not misreport counts.
      const from = await page.evaluate(() => window.__probe.samples.length);
      await page.waitForTimeout(WINDOW_MS);
      const inFlight = await pause.isVisible().catch(() => false);
      const s = await page.evaluate(() => window.__probe.samples.slice());
      if (inFlight && from < s.length) flight.push(...s.slice(from));
    }
    await page.mouse.up().catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log(`\n===== ${run.name} =====  buffer=${gl ? gl.buf.join("x") : "?"} = ${gl ? (gl.px / 1000).toFixed(0) : "?"}k px  (${gl ? gl.r : "?"})`);
  console.log("MENU  ", JSON.stringify(stats(menu)));
  console.log("FLIGHT", JSON.stringify(stats(flight)));
  console.log("FLIGHT GL per frame:", JSON.stringify(totals(flight)));
  // Whole page lifetime, so load-time allocation is included. The only keys
  // that mean anything here are the once-per-load ones.
  const sess = await page.evaluate(() => ({ ...window.__probe.session }));
  console.log("SESSION GL totals  :", JSON.stringify(Object.fromEntries(["createBuffer", "bufferData", "texImage2D", "compileShader", "linkProgram", "drawElements"].map((k) => [k, sess[k]]))));
  await ctx.close();
}
await browser.close();
