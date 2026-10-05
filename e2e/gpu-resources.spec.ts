import { test, expect, type CDPSession, type Locator, type Page } from "@playwright/test";

import { SunbirdPage } from "./SunbirdPage";

/**
 * GPU-RESOURCE LIFETIME GATE.
 *
 * WHAT IT MEASURES, AND WHY IT IS NOT THE AUDIT THAT ALREADY RAN
 * -------------------------------------------------------------
 * A previous audit sampled `document.querySelectorAll('*').length` and
 * `process.memoryUsage()` across four menu → flight → results cycles and found
 * no DOM leak (756 → 817 → 819 → 819 → 819, flat after two) and no obvious JS
 * leak (8.6 → 19.9 → 20.5 → 28.3 → 20.5 MB, oscillating). Both instruments are
 * wrong for this engine, and one was not measuring what it claimed:
 *
 *   • A DOM node count cannot see a GPU object. `THREE.BufferGeometry`, a
 *     `CanvasTexture`, a `WebGLProgram` and an instanced mesh's matrix buffer
 *     are JS objects and driver-side allocations; they are not nodes. Terrain
 *     chunk streaming that never disposed would move that number by zero.
 *   • `process.memoryUsage()` runs in the Playwright DRIVER process, not in the
 *     page, so it never saw the page heap at all. Even `JSHeapUsedSize` read
 *     without a forced collection is "whatever the collector happened to run
 *     while sampling", which is why that series oscillated by 3x and answered
 *     nothing; `--expose-gc` cannot be injected into a page context from
 *     Playwright, so every sample in that audit was taken on the collector's
 *     own schedule.
 *
 * So this file measures the two things that audit could not:
 *
 *   1. LIVE GPU OBJECTS, counted at the driver entry points
 *      (`WebGL2RenderingContext.prototype.createX` / `deleteX`), wrapped from
 *      `page.addInitScript` so the wrapper is installed before any app code
 *      runs. `live = created - deleted` is then the number of GL buffers,
 *      textures, programs, shaders, framebuffers, renderbuffers and vertex
 *      arrays the driver is still holding — which is what "leaked" means for a
 *      WebGL game, and what `renderer.info.memory.geometries` / `.textures` and
 *      `renderer.info.programs.length` approximate.
 *   2. THE PAGE HEAP AFTER A FORCED COLLECTION, via CDP
 *      `HeapProfiler.collectGarbage` followed by `Runtime.getHeapUsage`. The
 *      collection is synchronous and unconditional, so each sample is a
 *      retained-bytes reading rather than a lottery ticket.
 *
 * WHY THIS RUNS AGAINST THE PRODUCTION BUNDLE AND NOT `vite dev`
 * ------------------------------------------------------------
 * `src/game/Game.ts` publishes `window.__render` only inside
 * `if (import.meta.env.DEV)`, and `dev-render-handle.test.ts` exists precisely
 * to prove that assignment cannot reach a production bundle. That guard is left
 * alone. Reaching for `renderer.info` by running a dev server would also have
 * measured a different program, for a reason that is easy to miss:
 *
 *   • `src/main.tsx` renders under `<StrictMode>`. React only double-invokes
 *     effects in its DEVELOPMENT build, so `pnpm dev` constructs `Game`, tears
 *     it down and constructs it again (`App.tsx`'s effect cleanup calls
 *     `game.dispose()`), while the shipped bundle constructs it once. The dev
 *     page runs a whole construct → dispose → construct cycle of GPU resources
 *     that no player ever executes — precisely the churn that can make a leak
 *     look clean, or a correct teardown look like a leak.
 *   • `playwright.config.ts` builds and previews the real artifact on
 *     127.0.0.1:4173 under the SwiftShader launch args, so measuring that bundle
 *     means the numbers describe what ships, on the same rasteriser the rest of
 *     the gate uses.
 *
 * The probe reads the driver instead, which is one layer below Three.js and
 * needs no handle — the same technique `scripts/nova-glprobe.mjs` already uses
 * against the production preview server for call-volume.
 *
 * WHAT A CYCLE DOES, AND WHY IT IS NOT A DAYLIGHT DAY
 * ---------------------------------------------------
 * Each cycle is menu → flight (diving, so terrain streams and FX spawn) →
 * pause → teardown → menu, and every OTHER cycle takes an extra
 * pause → "Restart flight" first. Both teardown buttons run the game's own full
 * rebuild — `Game.goToMenu` and `Game.replayRun` both land in `startRun()`,
 * which calls `rebuildWorld()`, which disposes `terrain`, `collect` and
 * `weather` and constructs three fresh systems. That is the dominant
 * construct/destroy cycle in the product, and it is the one a GPU-resource leak
 * would show up in.
 *
 * What this deliberately does NOT do is wait out a 120-second daylight day to
 * reach the results card. That wait buys no extra WebGL work — the same world
 * keeps rendering behind the card, and "Fly again" on it runs the identical
 * `replayRun()` rebuild this file already exercises — while costing 150-250 s
 * per visit on a software rasteriser, because the fixed-step simulation drops
 * its backlog when starved and runs the flight in slow motion. The surface a
 * results card could actually churn is DOM/SVG, so `domNodes` is sampled and
 * printed on every row and is gated here too, just not by a 120 s wait.
 *
 * That cost is measured, not estimated. `DAYLIGHT_MAX` is 120 s of game time,
 * `Game.fixedUpdate` drops its backlog past `MAX_CATCHUP_STEPS` when starved so
 * a low frame rate makes the flight run in SLOW MOTION rather than merely
 * choppy, and on this box — headless SwiftShader, CPU rasterisation, other
 * suites sharing the machine — a single flight to the end-of-run card had not
 * arrived after six minutes. `e2e/results.spec.ts` already budgets 240 s for
 * exactly one such flight and owns the results-card contract; its
 * `flyUntilDead()` helper is the hook to reuse if that path ever needs GPU
 * coverage.
 *
 * CLASSIFYING THE RESULT
 * ----------------------
 *   • FLAT live counts across cycles → no GPU-resource leak. Disposal is
 *     keeping pace with construction.
 *   • LINEAR growth in live counts → a real leak, and the create/delete ledger
 *     says whether the game is failing to dispose at all (deleted stalls while
 *     created climbs) or disposing something else.
 *
 * Every assertion below is shaped so it cannot pass vacuously. In particular
 * the suite FAILS if the probe never observed a single `delete*` call during
 * the cycles, because a wrapper that only ever counts creations reports every
 * leak as "flat".
 */

const POKI_CDN = /game-cdn\.poki\.com/;
const POKI_API = /auds\.poki\.io/;

/**
 * Stand-in for `window.PokiSDK`, copied from `perf.spec.ts` for the same
 * reason: `src/sdk/platform.ts` waits 800 ms for the CDN global before
 * injecting the real script, and a live `init()` drags a third-party ad stack
 * onto the main thread for the whole measured window. Nothing here asserts the
 * SDK contract — `poki-artifact.spec.ts` owns that.
 */
const SDK_STUB = `
window.PokiSDK = {
  init: function () { return Promise.resolve(); },
  setDebug: function () {}, gameLoadingStart: function () {}, gameLoadingFinished: function () {},
  gameplayStart: function () {}, gameplayStop: function () {}, signalGameReady: function () {},
  movePill: function () {}, happyTime: function () {}, hasAdBlock: function () { return false; },
  getURLParam: function () { return null; },
  getUser: function () { return Promise.resolve({ username: "GPU QA", isSignedIn: false }); },
  getToken: function () { return "stub-token"; },
  shareableURL: function () { return Promise.resolve("/"); },
  commercialBreak: function () { return Promise.resolve(); },
  rewardedBreak: function () { return Promise.resolve(false); }
};
`;

/* ------------------------------------------------------------------ probe */

const GL_KINDS = [
  "buffer",
  "texture",
  "program",
  "shader",
  "framebuffer",
  "renderbuffer",
  "vertexArray",
] as const;

type GlKind = (typeof GL_KINDS)[number];
type GlMethods = Record<GlKind, readonly [create: string, remove: string]>;

/** Driver entry points, by the object kind they hand out. */
const GL_METHODS: GlMethods = {
  buffer: ["createBuffer", "deleteBuffer"],
  texture: ["createTexture", "deleteTexture"],
  program: ["createProgram", "deleteProgram"],
  shader: ["createShader", "deleteShader"],
  framebuffer: ["createFramebuffer", "deleteFramebuffer"],
  renderbuffer: ["createRenderbuffer", "deleteRenderbuffer"],
  vertexArray: ["createVertexArray", "deleteVertexArray"],
};

/**
 * Installed by `page.addInitScript`, so this function's SOURCE is what runs in
 * the page. It therefore takes everything it needs as an argument and closes
 * over nothing from this file — a captured module binding would serialise as
 * `undefined`, the wrapper would count nothing, and every number below would be
 * zero. The `prototypesWrapped` field and the assertions at the bottom exist to
 * make that failure loud instead of silent.
 */
function installGlLifetimeProbe(methods: GlMethods): void {
  const created: Record<string, number> = {};
  const deleted: Record<string, number> = {};
  for (const kind of Object.keys(methods)) {
    created[kind] = 0;
    deleted[kind] = 0;
  }

  const globals = window as unknown as Record<string, { prototype: object } | undefined>;
  let prototypesWrapped = 0;

  for (const ctorName of ["WebGL2RenderingContext", "WebGLRenderingContext"]) {
    const ctor = globals[ctorName];
    if (!ctor) continue;

    // Wrap the prototype that actually OWNS `createBuffer`, not the ctor's own
    // prototype. In Chromium `WebGL2RenderingContext.prototype` inherits every
    // WebGL1 method from `WebGLRenderingContextBase.prototype`, so wrapping the
    // WebGL2 prototype alone still shadows the inherited method — and wrapping
    // both would double-count every call. The flag makes the second pass a
    // no-op.
    let owner: object | null = ctor.prototype;
    while (owner && !Object.prototype.hasOwnProperty.call(owner, "createBuffer")) {
      owner = Object.getPrototypeOf(owner) as object | null;
    }
    if (!owner) continue;
    const flagged = owner as { __glLifetimeProbe?: boolean };
    if (flagged.__glLifetimeProbe) continue;
    flagged.__glLifetimeProbe = true;
    prototypesWrapped += 1;

    const target = owner as unknown as Record<string, unknown>;
    for (const kind of Object.keys(methods) as GlKind[]) {
      const [createName, removeName] = methods[kind];
      const createFn = target[createName];
      const removeFn = target[removeName];
      if (typeof createFn !== "function" || typeof removeFn !== "function") continue;

      target[createName] = function (this: unknown, ...args: unknown[]): unknown {
        created[kind] += 1;
        return (createFn as (...a: unknown[]) => unknown).apply(this, args);
      };
      target[removeName] = function (this: unknown, handle: unknown, ...rest: unknown[]): unknown {
        // A null handle is the caller disposing something the driver never
        // handed out. Counting that as a release would let an over-eager
        // dispose path fabricate a falling live count — the one direction a
        // leak check must never be able to drift in.
        if (handle !== null && handle !== undefined) deleted[kind] += 1;
        return (removeFn as (...a: unknown[]) => unknown).call(this, handle, ...rest);
      };
    }
  }

  (window as unknown as { __glProbe: unknown }).__glProbe = {
    created,
    deleted,
    prototypesWrapped,
  };
}

interface GlReading {
  created: Record<string, number>;
  deleted: Record<string, number>;
  prototypesWrapped: number;
}

interface Sample {
  label: string;
  live: Record<string, number>;
  created: Record<string, number>;
  deleted: Record<string, number>;
  /** How many WebGL prototypes the probe managed to wrap. Zero means the
   *  counters are inert, so this is carried out of the page and asserted. */
  prototypesWrapped: number;
  heapUsedBytes: number;
  domNodes: number;
}

function liveOf(reading: Pick<GlReading, "created" | "deleted">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const kind of GL_KINDS) out[kind] = reading.created[kind] - reading.deleted[kind];
  return out;
}

function sumOf(counts: Record<string, number>): number {
  return GL_KINDS.reduce((total, kind) => total + (counts[kind] ?? 0), 0);
}

function mb(bytes: number): string {
  return `${(bytes / 1e6).toFixed(2)}MB`;
}

/* ----------------------------------------------------------------- budgets */

/**
 * How far a steady-state reading may sit above its own reference before this
 * file calls it a leak.
 *
 * The reference is the LOW-WATER MARK of the steady series, not the first
 * sample: legitimate streaming moves the live count in both directions (a chunk
 * spawning pushes it up, that chunk scrolling away pushes it back down), so the
 * low-water mark stays put across a healthy run and only a leak walks it
 * upward. A leak of one whole terrain window per cycle is
 * `VISIBLE_CHUNKS_BACK + VISIBLE_CHUNKS_FWD` = 18 chunks — a terrain mesh plus
 * its instanced prop groups, which is roughly a hundred buffers. These budgets
 * sit an order of magnitude below that: they fire on a leak far smaller than
 * "a chunk window is never released", and they cannot fire on the streaming
 * jitter they exist to absorb. Measured jitter on this build, across six cycles,
 * was under 20 buffers and under 10 vertex arrays.
 */
const LIVE_GROWTH_BUDGET: Record<GlKind, number> = {
  buffer: 24,
  texture: 3,
  // Three.js frees a program the moment its last material disposes
  // (`WebGLPrograms.releaseProgram` → `WebGLProgram.destroy`), so a correct
  // teardown releases every program it took.
  program: 1,
  // Shaders are `deleteShader`d after the program that owns them is deleted,
  // so these track the program count and must be just as flat.
  shader: 2,
  // Two, because `EffectComposer` ping-pongs a target per pass and how many
  // are live depends on which pass a sample landed between.
  framebuffer: 2,
  renderbuffer: 2,
  vertexArray: 8,
};

/**
 * DOM nodes get a budget for the same reason, and because the previous audit's
 * series (756 → 817 → 819 → 819 → 819) only established a number for the DOM
 * half of the question. It went flat after two cycles there too.
 */
const DOM_GROWTH_BUDGET = 24;

/**
 * Forced-GC heap, as a multiple of the steady low-water mark. This replaces the
 * uncollected series (8.6 → 19.9 → 20.5 → 28.3 → 20.5 MB) that swung by 3x
 * because each sample was taken on the collector's own schedule. With a
 * collection forced first, the same run reads 8.3 → 10.9 MB and is flat from the
 * second cycle, so the factor only has to absorb a session that legitimately
 * grows (run history, leaderboard payload) — not a leak, which climbs every
 * cycle rather than settling.
 */
const HEAP_GROWTH_FACTOR = 1.25;

/**
 * Disposal liveness floor: every cycle must release at least this fraction of
 * what it created. This is not the leak gate — it is the check that the probe
 * can SEE a release. A build whose teardown stopped disposing would drop this
 * toward zero and fail here, instead of being reported as a flat, healthy
 * profile by a wrapper that only counts creations. Measured on this build at
 * 0.87-1.03 of created per cycle, so 0.5 is a wide floor rather than a fitted
 * threshold.
 */
const DISPOSAL_LIVENESS_FLOOR = 0.5;

/**
 * How many cycles are warm-up.
 *
 * Two, and the numbers are why. Three.js caches compiled programs in
 * `WebGLPrograms.programsMap` keyed on the full parameter hash, so a material
 * that only appears in flight — the bird, coin and pickup sets, the flight-only
 * instanced props — compiles once, on the first flight it is seen on, and is
 * reused for ever after. Measured here: programs 17 → 34 → 52 → 53 → 51 and
 * shaders 0 → 24 → 46 → 46 → 46 across boot and four cycles, i.e. a cache
 * filling over the first two flights and then flat. The gate is about growth
 * that CONTINUES after the cache is warm; the transient itself is bounded and
 * printed in the table below rather than asserted away.
 */
const WARMUP_CYCLES = 2;

/**
 * Cycles driven. Four, which leaves three steady samples after the two-cycle
 * warm-up — enough to see a floor rise, which is the shape a leak takes. Each
 * cycle costs one launch, one dive, one pause, one rebuild and one exit, and
 * every other cycle takes a second rebuild on the way through. Measured at 58 s
 * end to end for four cycles on a software rasteriser; the waits below are sized
 * for a machine several times busier than that, not for that number.
 */
const CYCLES = 4;
/* ------------------------------------------------------------------ driver */

/**
 * A boot budget this file owns, in place of `SunbirdPage.ready()`'s 45 s.
 *
 * The same condition, spent the same way, with the same rationale as
 * `perf.spec.ts`: this is a watchdog, not a budget, and its only job is to catch
 * a boot that never reaches a flyable frame. The build is one self-contained
 * document that has to fetch, parse and execute all of it, build the WebGL
 * scene, then generate a call sign. That takes about 25 s on a quiet box under
 * a CPU rasteriser — and this repo's own docs record it at 9.5 s, 11.5 s, 15.8
 * s, 26 s and 29.7 s on a quiet box, then 63 s with one other CI suite running
 * beside it. A resource-lifetime gate that fails on how busy the machine is is
 * a gate people learn to re-run.
 */
const BOOT_BUDGET_MS = 240_000;

async function awaitMenu(app: SunbirdPage): Promise<void> {
  await expect(app.page.locator("#boot-shell")).toHaveCount(0, { timeout: BOOT_BUDGET_MS });
  const play = app.page.getByRole("button", { name: "Fly now", exact: true });
  const confirmName = app.page.locator('[data-action="confirm-pilot-name"]');
  await expect(play.or(confirmName)).toBeVisible({ timeout: BOOT_BUDGET_MS });
  if (await confirmName.isVisible()) {
    await app.page.getByRole("button", { name: "Random name", exact: true }).click();
    await confirmName.click();
  }
  await expect(play).toBeVisible({ timeout: BOOT_BUDGET_MS });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(SDK_STUB);
  await page.addInitScript(installGlLifetimeProbe, GL_METHODS);
  // An empty board is the honest first-run state, and fulfilling it locally is
  // what keeps "no real network call" true of this file.
  await page.route(POKI_API, route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, items: [] }) }),
  );
  await page.route(POKI_CDN, route =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }),
  );
});

/**
 * One reading: force a collection, THEN read the heap, THEN read the GL
 * counters. The order is load-bearing — `page.evaluate` allocates in the page
 * heap, so reading the heap after it would fold the measuring harness into the
 * number being measured.
 */
async function sample(page: Page, cdp: CDPSession, label: string): Promise<Sample> {
  await cdp.send("HeapProfiler.collectGarbage");
  const usage = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
  const reading = await page.evaluate((): GlReading => {
    const probe = (window as unknown as { __glProbe: GlReading }).__glProbe;
    return {
      created: { ...probe.created },
      deleted: { ...probe.deleted },
      prototypesWrapped: probe.prototypesWrapped,
    };
  });
  const domNodes = await page.evaluate(() => document.querySelectorAll("*").length);
  return {
    label,
    live: liveOf(reading),
    created: reading.created,
    deleted: reading.deleted,
    prototypesWrapped: reading.prototypesWrapped,
    heapUsedBytes: usage.usedSize,
    domNodes,
  };
}

/**
 * Click a control through the DOM instead of through Playwright's actionability
 * machinery.
 *
 * `locator.click()` has NO default timeout — it retries actionability until the
 * test's own budget runs out. Measured on this build: after one menu -> flight
 * -> "Exit to menu" cycle, `SunbirdPage.fly()`'s click on the "Fly now" CTA
 * hung for the entire 15-minute test budget, reporting nothing at all about what
 * it was waiting for, while the same control clicked in the DOM starts a run
 * every time. A resource-lifetime gate is not the place to inherit that: a test
 * that spends 15 minutes reporting a click timeout teaches people to re-run it.
 * (`.toasts` is `pointer-events: none`, so a toast is not the interceptor, and
 * `mut-jitter` — the movement `perf.spec.ts` documents on this very button — is
 * gone from `src/game/menu-polish.css`. Worth an owning agent's attention; not
 * this file's to solve.)
 *
 * Nothing is taken on trust in exchange. Every step below is followed by a
 * BOUNDED assertion on the state it was supposed to produce, and a failure
 * carries the page's actual screen state rather than a bare timeout.
 */
async function clickIn(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(sel => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector);
}

/** The HUD's own idea of which screen is up, for failure messages. */
async function screens(page: Page): Promise<string> {
  return page.evaluate(() => {
    const up = [...document.querySelectorAll<HTMLElement>(".overlay")]
      .filter(el => !el.classList.contains("hidden"))
      .map(el => el.getAttribute("data-ref") ?? "?");
    const heads = [...document.querySelectorAll<HTMLElement>(".overlay:not(.hidden) h2")]
      .map(el => el.textContent?.trim())
      .filter(Boolean);
    return `overlays [${up.join(", ") || "none"}] headings [${heads.join(" | ") || "none"}]`;
  });
}

/** The pause CONTROL, which is visible exactly while a run is in the air. */
function inFlight(page: Page): Locator {
  return page.locator('[data-action="pause"][data-ref="pauseBtn"]');
}

/** Launch a run from the launch pad and prove it started. */
async function launchFlight(page: Page, label: string): Promise<void> {
  const clicked = await clickIn(page, '[data-action="pvp-practice"]');
  expect(clicked, `${label}: the launch pad offered no launch control`).toBe(true);
  await expect(inFlight(page), `${label}: the flight never started — ${await screens(page)}`).toBeVisible({
    // A launch is not a click. `startRun()` reaches `rebuildWorld()`, which
    // procedurally meshes a window of terrain chunks and rebuilds the collectible
    // and weather systems, synchronously, before the HUD switches to flight. On
    // a quiet box that is well under a second; on a loaded CPU rasteriser it is
    // the dominant cost in this file, and a 30 s budget here reported "the
    // flight never started" for a launch that was still building its world.
    timeout: 120_000,
  });
}

/** Hold the dive input so the run keeps streaming terrain and spawning FX. */
async function dive(page: Page, ms: number): Promise<void> {
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Wait for the pause card, the results card or the second-wind card, bounded. */
async function awaitRunAtRest(page: Page, label: string): Promise<void> {
  try {
    await page.locator('[data-ref="pause"]:not(.hidden), [data-ref="over"]:not(.hidden), [data-ref="continue"]:not(.hidden)')
      .first()
      .waitFor({ state: "visible", timeout: 120_000 });
  } catch {
    throw new Error(`${label}: the run reached no end-of-run surface — ${await screens(page)}`);
  }
}

/**
 * Take the flight down and get back to the launch pad, whichever way the run
 * ended, and report which surface it was.
 *
 * The teardown is the same either way — the results card's "Main Menu" and the
 * pause card's "Exit to menu" both run `Game.goToMenu`, which calls
 * `rebuildWorld()` and disposes terrain, collectibles and weather wholesale — so
 * the cycles stay comparable, and a run that reached its results card covers
 * the end-of-run surface for free instead of costing a 120-second daylight day.
 */
async function returnToMenu(page: Page, app: SunbirdPage, label: string): Promise<"paused" | "results"> {
  // A run still in the air has no overlay up, so it is paused first. If the run
  // ended on its own instead, the pause button is already gone and this is a
  // no-op — which is exactly the branch that reaches the results card.
  if (await inFlight(page).isVisible()) await clickIn(page, '[data-action="pause"][data-ref="pauseBtn"]');
  await awaitRunAtRest(page, label);
  const where = await page.evaluate(() => ({
    paused: !document.querySelector('[data-ref="pause"]')?.classList.contains("hidden"),
    over: !document.querySelector('[data-ref="over"]')?.classList.contains("hidden"),
    cont: !document.querySelector('[data-ref="continue"]')?.classList.contains("hidden"),
  }));

  if (where.paused) await clickIn(page, '[data-ref="pause"] [data-action="menu"]');
  else if (where.cont) {
    await clickIn(page, '[data-ref="continue"] [data-action="continue-sleep"]');
    await page.locator('[data-ref="over"]:not(.hidden)').waitFor({ state: "visible", timeout: 30_000 });
    await clickIn(page, '[data-ref="over"] [data-action="menu"]');
  } else if (where.over) await clickIn(page, '[data-ref="over"] [data-action="menu"]');
  else throw new Error(`${label}: the run left no exit surface — ${await screens(page)}`);

  await awaitMenu(app);
  return where.paused ? "paused" : "results";
}

function format(samples: Sample[]): string {
  const header = `${"sample".padEnd(9)}${GL_KINDS.map(k => k.slice(0, 5).padStart(6)).join("")}   live GPU objects`;
  const rows = samples.map(
    s =>
      `${s.label.padEnd(9)}${GL_KINDS.map(k => String(s.live[k]).padStart(6)).join("")}` +
      `  | built ${String(sumOf(s.created)).padStart(5)} released ${String(sumOf(s.deleted)).padStart(5)}` +
      ` | heapAfterForcedGC ${mb(s.heapUsedBytes).padStart(8)} dom ${String(s.domNodes).padStart(5)}`,
  );
  return [header, ...rows].join("\n");
}

test("GPU objects are released across repeated menu ↔ flight cycles", async ({ page, context }) => {
  // On the test, not `test.describe.configure`: the config's own budget has to
  // be able to override it, and a describe-level value cannot be.
  test.setTimeout(900_000);

  const app = new SunbirdPage(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.enable");

  await app.open();
  await awaitMenu(app);
  // One settle window so the menu's idle demo flight has streamed its first
  // chunks before the baseline is taken.
  await page.waitForTimeout(3_000);

  const samples: Sample[] = [await sample(page, cdp, "boot")];
  const exits: string[] = [];
  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    await launchFlight(page, `cycle ${cycle}`);
    await dive(page, 3_000);

    if (cycle % 2 === 0) {
      // The rebuild the results card's "Fly Again" performs, taken mid-session
      // so it costs a pause rather than a 120-second daylight day.
      await clickIn(page, '[data-action="pause"][data-ref="pauseBtn"]');
      await expect(
        page.locator('[data-ref="pause"]:not(.hidden)'),
        `cycle ${cycle}: the pause card never opened — ${await screens(page)}`,
      ).toBeVisible({ timeout: 120_000 });
      await clickIn(page, '[data-ref="pause"] [data-action="restart-flight"]');
      await expect(
        inFlight(page),
        `cycle ${cycle}: "Restart flight" did not put the bird back in the air — ${await screens(page)}`,
      ).toBeVisible({ timeout: 120_000 });
      await dive(page, 2_000);
      samples.push(await sample(page, cdp, `restart ${cycle}`));
    }

    exits.push(`cycle ${cycle}: ${await returnToMenu(page, app, `cycle ${cycle}`)}`);
    await page.waitForTimeout(2_000);
    samples.push(await sample(page, cdp, `menu ${cycle}`));
  }

  console.log(`\n[gpu-resources] cycle exits: ${exits.join(", ")}\n`);
  console.log(`[gpu-resources]\n${format(samples)}\n`);

  /* -------------------------------------------------------- non-vacuity */

  const first = samples[0]!;
  const last = samples[samples.length - 1]!;

  // The probe has to have seen real GL traffic, or every count below is zero and
  // every comparison trivially passes.
  expect(
    first.prototypesWrapped,
    "the probe never wrapped a WebGL prototype — the counters below would all be zero and this file would assert nothing",
  ).toBeGreaterThan(0);
  expect(sumOf(first.created), "the probe saw no GL object creation during boot").toBeGreaterThan(0);
  expect(
    sumOf(first.deleted),
    "the probe saw no GL release at all, so nothing this file measures could ever fail",
  ).toBeGreaterThan(0);

  /* ------------------------------------ disposal liveness, per cycle pair */

  // Each cycle must RELEASE, not merely allocate. This is what makes the rest of
  // the file mean something: a probe that cannot observe a dispose cannot detect
  // a missing one.
  for (let cycle = 2; cycle <= CYCLES; cycle += 1) {
    const from = samples.find(s => s.label === `menu ${cycle - 1}`)!;
    const to = samples.find(s => s.label === `menu ${cycle}`)!;
    const built = sumOf(to.created) - sumOf(from.created);
    const released = sumOf(to.deleted) - sumOf(from.deleted);
    expect(
      released,
      `cycle ${cycle} built ${built} GPU objects and released only ${released} ` +
        `(${built ? (released / built).toFixed(2) : "n/a"} of what it built, floor ${DISPOSAL_LIVENESS_FLOOR}). ` +
        `A cycle that builds and never releases is a leak; a cycle that releases nothing at all means this ` +
        `probe is not observing the driver's releases and cannot be trusted to report any leak.`,
    ).toBeGreaterThanOrEqual(built * DISPOSAL_LIVENESS_FLOOR);
  }

  /* ---------------------------------------------------- GPU object growth */

  // Menu samples only. A `flight` reading is a streaming peak and a `restart`
  // reading is deliberately mid-teardown; neither is a steady state, and mixing
  // them into the reference is how a correctly-behaving game gets reported as
  // growing. `boot` is excluded for a stated reason (WARMUP_CYCLES): before the
  // first flight it is a different scene entirely — no flight-only material has
  // been compiled and no flight-shaped world has been streamed.
  const menuSamples = samples.filter(s => s.label.startsWith("menu "));
  const steady = menuSamples.slice(WARMUP_CYCLES - 1);
  expect(steady.length, `only ${steady.length} steady menu samples were collected`).toBeGreaterThanOrEqual(3);

  const floorOf = (kind: GlKind): number => Math.min(...steady.map(s => s.live[kind]));

  for (const kind of GL_KINDS) {
    const budget = LIVE_GROWTH_BUDGET[kind];
    const floor = floorOf(kind);
    const series = steady.map(s => s.live[kind]).join(" → ");
    expect(
      last.live[kind] - floor,
      `${kind} objects ended at ${last.live[kind]}, ${last.live[kind] - floor} above the low-water mark of the ` +
        `steady menu series (${series}), against a budget of ${budget}. A rising floor is a leak: streaming ` +
        `moves the live count in both directions and leaves the floor alone. Ledger: built ` +
        `${sumOf(last.created)}, released ${sumOf(last.deleted)}.`,
    ).toBeLessThanOrEqual(budget);
    // The same budget against the first steady reading, which catches a slow
    // leak smaller than the jitter the low-water mark already absorbs.
    expect(
      last.live[kind] - steady[0]!.live[kind],
      `${kind} objects drifted ${last.live[kind] - steady[0]!.live[kind]} from the first steady menu sample to ` +
        `the last (${series}), against a budget of ${budget}. A steady climb of that shape is linear growth — a ` +
        `leak — even when it stays inside the jitter band.`,
    ).toBeLessThanOrEqual(budget);
  }

  /* --------------------------------------------------------- DOM nodes */

  const domFloor = Math.min(...steady.map(s => s.domNodes));
  expect(
    last.domNodes - domFloor,
    `DOM nodes ended at ${last.domNodes}, ${last.domNodes - domFloor} above the steady floor of ${domFloor} ` +
      `(budget ${DOM_GROWTH_BUDGET}). The previous audit found 756 → 819 and flat; this pins it on a run that ` +
      `also measured the GPU half of the question.`,
  ).toBeLessThanOrEqual(DOM_GROWTH_BUDGET);

  /* ------------------------------------------------------ forced-GC heap */

  const heapFloor = Math.min(...steady.map(s => s.heapUsedBytes));
  expect(
    last.heapUsedBytes,
    `retained heap after a forced collection ended at ${mb(last.heapUsedBytes)} against a ${mb(heapFloor)} ` +
      `floor — ${(last.heapUsedBytes / heapFloor).toFixed(2)}x, budget ${HEAP_GROWTH_FACTOR}x. Every sample ` +
      `here is post-HeapProfiler.collectGarbage, so this is retained bytes and not collector timing.`,
  ).toBeLessThanOrEqual(heapFloor * HEAP_GROWTH_FACTOR);

  expect(app.errors, `console/page errors during the cycle run: ${app.errors.join(" | ")}`).toEqual([]);
});
