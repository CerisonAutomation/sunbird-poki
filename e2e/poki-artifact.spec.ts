import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { SunbirdPage } from "./SunbirdPage";

/**
 * The artifact contract test: it loads the SHIPPING folder (`poki-upload/`) in
 * a real browser, from a plain static server, with the Poki SDK stubbed exactly
 * the way the Inspector injects it — and asserts what the Inspector's Event Log
 * and Warnings tabs look at:
 *
 *   • the game boots and becomes playable (no page errors, no failed requests)
 *   • it asks for NOTHING outside its own folder (Poki's external-resources rule)
 *   • the SDK sequence is the documented one:
 *       init → gameLoadingStart → gameLoadingFinished → gameplayStart/Stop
 *     with `gameLoadingFinished` exactly once and no consecutive duplicate
 *     gameplay phase (the Inspector flags those as "Unexpected Behavior")
 *   • it boots and plays INSIDE a cross-origin iframe, which is where a Poki
 *     game actually runs
 *
 * This is deliberately not a dev-server test: nothing here builds the app, and
 * `dist/` is never involved. If this passes, the folder handed to the Inspector
 * is the thing that passed.
 *
 * Run with: pnpm test:artifact   (after `pnpm build:poki`)
 */
const PORT = 4176;
// ESM (package.json type: module): resolve relative to this file.
const ROOT = path.join(import.meta.dirname, "..", "poki-upload");
const ORIGIN = `http://127.0.0.1:${PORT}`;
const POKI_CDN = /game-cdn\.poki\.com/;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

type Call = { name: string; at: number; canvas?: boolean; id?: string; leaderboard?: string; score?: number };

/** Serves the artifact exactly like a static host would — no rewriting, no
 *  build step, no SPA fallback: a missing file must be a real 404. */
function serveArtifact(): Promise<Server> {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", ORIGIN).pathname);
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`404 ${pathname}`);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": statSync(file).size,
      "Access-Control-Allow-Origin": "*",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

/**
 * A faithful stand-in for `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`.
 * The Inspector injects the real one before the bundle runs; `addInitScript`
 * does the same here, and every call lands in `window.__pokiCalls` in order.
 */
const SDK_STUB = `
window.__pokiCalls = [];
window.PokiSDK = (function () {
  function record(name) {
    return function () {
      window.__pokiCalls.push({ name: name, at: Date.now() });
    };
  }
  return {
    init: function (options) {
      record("init")();
      window.__pokiInitCalls = (window.__pokiInitCalls || []);
      window.__pokiInitCalls.push(options && typeof options.submitScore === "function" ? "submitScore" : "none");
      if (options && !window.__pokiInitOptions) window.__pokiInitOptions = options;
      if (options && typeof options.submitScore === "function") {
        options.submitScore(function (leaderboard, score) {
          window.__pokiCalls.push({ name: "submitScore", at: Date.now(), leaderboard: leaderboard, score: score });
        });
      }
      return Promise.resolve();
    },
    setDebug: record("setDebug"),
    gameLoadingStart: record("gameLoadingStart"),
    gameLoadingFinished: record("gameLoadingFinished"),
    gameplayStart: record("gameplayStart"),
    gameplayStop: record("gameplayStop"),
    signalGameReady: record("signalGameReady"),
    movePill: record("movePill"),
    showLeaderboard: function (id) { window.__pokiCalls.push({ name: "showLeaderboard", at: Date.now(), id: id === undefined ? "undefined" : String(id) }); },
    captureError: record("captureError"),
    getDeviceInfo: function () { record("getDeviceInfo")(); return { category: "desktop" }; },
    openExternalLink: record("openExternalLink"),
    playtestSetCanvas: function (canvas) {
      window.__pokiCalls.push({ name: "playtestSetCanvas", at: Date.now(), canvas: Boolean(canvas && canvas.getContext) });
    },
    hasAdBlock: function () { record("hasAdBlock")(); return false; },
    getURLParam: function () { record("getURLParam")(); return null; },
    getUser: function () { record("getUser")(); return Promise.resolve({ username: "Inspector QA", isSignedIn: false }); },
    getToken: function () { record("getToken")(); return Promise.resolve("stub-token"); },
    shareableURL: function () { record("shareableURL")(); return Promise.resolve("${ORIGIN}/"); },
    commercialBreak: function (onStart) { record("commercialBreak")(); if (typeof onStart === "function") onStart(); return Promise.resolve(); },
    rewardedBreak: function (onStart) { record("rewardedBreak")(); if (typeof onStart === "function") onStart(); return Promise.resolve(true); }
  };
})();
`;

const callsOf = (page: Page): Promise<Call[]> =>
  page.evaluate(() => (window as unknown as { __pokiCalls?: Call[] }).__pokiCalls ?? []);

let server: Server;

test.beforeAll(async () => {
  server = await serveArtifact();
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(async ({ page }) => {
  // The Inspector injects the SDK before the bundle; serve it (and any CDN
  // fallback fetch) from the stub, so no real network is involved.
  await page.addInitScript(SDK_STUB);
  await page.route(POKI_CDN, (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }),
  );
});

test("the shipping folder boots, plays, and emits the Poki event contract", async ({ page }) => {
  const external: string[] = [];
  const failed: string[] = [];
  const local: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:") return;
    if (url.origin === ORIGIN) local.push(url.pathname);
    else if (!POKI_CDN.test(request.url())) external.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();

  // Let the log settle past the loading-screen failsafe window (window load +
  // 1.5 s). Without this wait the assertions race it — and that race is how the
  // duplicate `gameLoadingFinished` this test now guards against was found.
  await page.waitForTimeout(2500);

  // What the Inspector's "External Resources" warning looks for.
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  expect(app.errors).toEqual([]);

  // Self-contained: every request stayed inside the folder (the `external`
  // assertion above is the real claim), and the assets the html references are
  // really there — fetched from the page, exactly as a host would serve them.
  expect(local).toContain("/");
  const icon = await page.evaluate(async () => (await fetch("./icons/favicon-32.png")).status);
  expect(icon, "the folder serves its own icons").toBe(200);

  // A real WebGL canvas, sized — not a placeholder.
  const canvas = await page.locator("canvas").first().evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    return { width: c.width, height: c.height, gl: Boolean(gl) };
  });
  expect(canvas.gl).toBe(true);
  expect(canvas.width).toBeGreaterThan(0);
  expect(canvas.height).toBeGreaterThan(0);

  /* ---------------------------------------------------- SDK event contract */
  const boot = (await callsOf(page)).map((c) => c.name);
  console.log("Poki SDK boot sequence:", boot.join(" → "));

  /* ------------------------------- surfaces the portal expects us to wire */
  // Both of these fail SILENTLY if unwired — no console error, no failed
  // request — so the artifact test is the only place they can be caught:
  //   • playtestSetCanvas: Level-2 playtest recordings capture this canvas.
  //   • init({ submitScore }): Poki's leaderboard handshake.
  expect(boot).toContain("playtestSetCanvas");
  const canvasCall = (await callsOf(page)).find((c) => c.name === "playtestSetCanvas");
  expect(canvasCall?.canvas, "playtestSetCanvas must be handed the game canvas").toBe(true);
  const initCalls = await page.evaluate(
    () => (window as unknown as { __pokiInitCalls?: string[] }).__pokiInitCalls ?? [],
  );
  expect(
    initCalls,
    "PokiSDK.init() must be handed the submitScore handshake (Poki leaderboards stay unwired without it)",
  ).toContain("submitScore");


  expect(boot).toContain("init");
  expect(boot).toContain("gameLoadingStart");
  expect(boot).toContain("gameLoadingFinished");
  // Exactly once — the Inspector flags a repeated loading phase.
  expect(boot.filter((n) => n === "gameLoadingFinished").length).toBe(1);
  expect(boot.indexOf("init")).toBeLessThan(boot.indexOf("gameLoadingStart"));
  expect(boot.indexOf("gameLoadingStart")).toBeLessThan(boot.indexOf("gameLoadingFinished"));

  // Flying starts the gameplay phase…
  await app.fly();
  await expect.poll(async () => (await callsOf(page)).map((c) => c.name).includes("gameplayStart")).toBe(true);

  // …and pausing stops it (the state machine is edge-triggered through the
  // GameplayEventSink, so a duplicate phase here would fail).
  await app.pause();
  await expect
    .poll(async () => (await callsOf(page)).filter((c) => c.name === "gameplayStop").length)
    .toBeGreaterThan(0);

  const run = (await callsOf(page)).map((c) => c.name).filter((n) => n === "gameplayStart" || n === "gameplayStop");
  expect(run[0], "the first gameplay event must be a start").toBe("gameplayStart");
  for (let i = 1; i < run.length; i += 1) {
    expect(run[i], "a consecutive duplicate gameplay phase is flagged by the Inspector").not.toBe(run[i - 1]);
  }
});

test("boots and plays inside the cross-origin iframe the Inspector uses", async ({ page }) => {
  await page.setContent(
    `<!doctype html><title>Inspector frame</title><iframe id="game" src="${ORIGIN}/" style="border:0;width:1024px;height:576px"></iframe>`,
    { waitUntil: "load" },
  );
  const game = page.frameLocator("#game");

  // The boot overlay removing itself is the app's own "first playable frame".
  await expect(game.locator("#boot-shell")).toHaveCount(0, { timeout: 60_000 });
  // A fresh profile lands on the first-run welcome screen before the menu CTA,
  // so dismiss it the way SunbirdPage.ready() does. This test used to pass only
  // because it ran against a poki-upload/ snapshot that predated that screen;
  // once the artifact is built from current source the CTA is not there yet.
  const welcome = game.locator('[data-action="confirm-pilot-name"]');
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.click();
    await expect(welcome).toHaveCount(0, { timeout: 20_000 });
  }
  await expect(game.getByRole("button", { name: "Play free flight now", exact: true })).toBeVisible();

  await game.getByRole("button", { name: "Play free flight now", exact: true }).click();
  await expect(game.locator('[data-action="pause"]')).toBeVisible();

  // The stub is injected into the game frame too, and it saw the lifecycle.
  const frame = page.frames().find((f) => f.url().startsWith(ORIGIN));
  expect(frame, "the game frame loaded from the artifact origin").toBeTruthy();
  const played = (await frame!.evaluate(() => (window as unknown as { __pokiCalls?: Call[] }).__pokiCalls ?? [])).map(
    (c) => c.name,
  );
  expect(played).toContain("gameLoadingFinished");
  expect(played).toContain("gameplayStart");
});

test("the Poki leaderboard overlay is offered once the SDK reports it", async ({ page }) => {
  const app = new SunbirdPage(page);
  await app.open();
  await app.ready();

  await page.locator('[data-ref="menuCard"] [data-action="open-board"]').first().click();
  const button = page.locator('[data-action="open-portal-leaderboard"]');
  await expect(button, "the stub SDK exposes showLeaderboard, so the button must render").toBeVisible({
    timeout: 20_000,
  });

  await button.click();
  await expect
    .poll(async () => (await callsOf(page)).some((c) => c.name === "showLeaderboard"), { timeout: 15_000 })
    .toBe(true);
  expect(app.errors).toEqual([]);
});
