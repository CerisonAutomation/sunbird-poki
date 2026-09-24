/**
 * The same attack on the SHIPPING (Poki) build, with a break that lasts as long
 * as a real ad. The real SDK cannot serve a fill on localhost, so the only way
 * to observe "does our input layer cut a break short" is a promise that resolves
 * after 8s — a timing double for the ad's duration, not a fake SDK: every method
 * the game calls is present and the call ORDER is the real one.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = 4194;
const ROOT = path.join(import.meta.dirname, "poki-upload");
const OUT = "/tmp/adskip";
mkdirSync(OUT, { recursive: true });
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon" };

// 8 seconds of "ad", then resolve — the real commercialBreak contract.
const SDK = `
window.__calls = [];
window.PokiSDK = (function () {
  function rec(n) { return function () { window.__calls.push(n); }; }
  return {
    init: function (o) { rec("init")(); if (o && typeof o.submitScore === "function") o.submitScore(function(){}); return Promise.resolve(); },
    setDebug: rec("setDebug"), gameLoadingStart: rec("gameLoadingStart"),
    gameLoadingFinished: rec("gameLoadingFinished"), gameplayStart: rec("gameplayStart"),
    gameplayStop: rec("gameplayStop"), enableEventTracking: rec("enableEventTracking"),
    movePill: rec("movePill"), showLeaderboard: rec("showLeaderboard"), captureError: rec("captureError"),
    getDeviceInfo: function () { rec("getDeviceInfo")(); return { category: "desktop" }; },
    openExternalLink: rec("openExternalLink"), playtestSetCanvas: rec("playtestSetCanvas"),
    isAdBlocked: function () { window.__calls.push("isAdBlocked:false"); return false; },
    getURLParam: function () { rec("getURLParam")(); return null; },
    getUser: function () { rec("getUser")(); return Promise.resolve({ username: "Ad QA", isSignedIn: false }); },
    getToken: function () { rec("getToken")(); return Promise.resolve("t"); },
    shareableURL: function () { rec("shareableURL")(); return Promise.resolve("${ORIGIN}/"); },
    commercialBreak: function (onStart) {
      rec("commercialBreak");
      if (typeof onStart === "function") onStart();
      return new Promise(function (res) { setTimeout(res, 8000); });
    },
    rewardedBreak: function (onStart) {
      rec("rewardedBreak");
      if (typeof onStart === "function") onStart();
      return new Promise(function (res) { setTimeout(function () { res(true); }, 8000); });
    }
  };
})();
`;

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? "/", ORIGIN).pathname);
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" }); res.end("404"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream", "Content-Length": statSync(file).size });
  if (req.method === "HEAD") res.end(); else createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(60000);
await page.addInitScript(SDK);
await page.route(/game-cdn\.poki\.com/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: SDK }));

const state = () => page.evaluate(() => ({
  adCard: Boolean(document.querySelector('[data-ref="adCard"]')),
  adLabel: document.querySelector(".ad-label")?.textContent ?? null,
  flying: Boolean(document.querySelector('[data-action="pause"]')),
  paused: Boolean(document.querySelector('[data-action="resume"]')),
  calls: (window.__calls ?? []).slice(-6),
}));

await page.goto(ORIGIN + "/", { waitUntil: "commit" });
await page.waitForTimeout(6000);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "Random name", exact: true }).click().catch(() => {});
  await confirm.click().catch(() => {});
  await page.waitForTimeout(800);
}
await page.getByRole("button", { name: "Play free flight now", exact: true }).click().catch(() => {});
await page.waitForTimeout(3500);

// Pause → resume is the documented break moment on a portal build.
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
const atBreak = await state();
console.log("break entered:  ", JSON.stringify(atBreak));
await page.screenshot({ path: path.join(OUT, "poki-1-break.png"), timeout: 30000 }).catch(() => console.log("(screenshot 1 skipped: renderer busy)"));

// The attack: click, then Space, then a held Space — while the ad is "playing".
await page.mouse.click(320, 500);
await page.keyboard.press("Space");
await page.keyboard.down("Space");
await page.waitForTimeout(1200);
await page.keyboard.up("Space");
await page.waitForTimeout(600);
const attacked = await state();
console.log("after click+space:", JSON.stringify(attacked));
await page.screenshot({ path: path.join(OUT, "poki-2-attacked.png"), timeout: 30000 }).catch(() => console.log("(screenshot 2 skipped: renderer busy)"));

// Still in the break at 3s? 8s?
await page.waitForTimeout(2500);
const at3s = await state();
console.log("at ~5s:          ", JSON.stringify(at3s));
await page.waitForTimeout(4500);
const at9s = await state();
console.log("at ~9s (past ad):", JSON.stringify(at9s));
await page.screenshot({ path: path.join(OUT, "poki-3-after-ad.png"), timeout: 30000 }).catch(() => console.log("(screenshot 3 skipped: renderer busy)"));

console.log(atBreak.adCard && attacked.adCard && at3s.adCard
  ? "RESULT: the portal break survived click, tap, held Space and 5s of mashing"
  : "RESULT: the break was cut short by player input");

await browser.close();
await new Promise((r) => server.close(r));
