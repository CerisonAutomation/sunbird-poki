/** One screenshot of the PORTAL break card (the one that ships to Poki). */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = 4196;
const ROOT = path.join(import.meta.dirname, "poki-upload");
mkdirSync("/tmp/adskip", { recursive: true });
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const SDK = `
window.PokiSDK = (function () {
  const noop = function () {};
  const rec = function () { return noop; };
  return {
    init: function (o) { if (o && typeof o.submitScore === "function") o.submitScore(noop); return Promise.resolve(); },
    gameLoadingStart: noop, gameLoadingFinished: noop, gameplayStart: noop, gameplayStop: noop,
    enableEventTracking: noop, setDebug: noop, movePill: noop, playtestSetCanvas: noop,
    captureError: noop, openExternalLink: noop, isAdBlocked: function () { return false; },
    getURLParam: function () { return null; }, getUser: function () { return Promise.resolve(null); },
    getToken: function () { return Promise.resolve(null); }, shareableURL: function () { return Promise.resolve(""); },
    getDeviceInfo: function () { return { category: "desktop" }; },
    // A break that lasts, so the card is on screen long enough to capture.
    commercialBreak: function (onStart) { if (typeof onStart === "function") onStart(); return new Promise(function (r) { setTimeout(r, 9000); }); },
    rewardedBreak: function (onStart) { if (typeof onStart === "function") onStart(); return new Promise(function (r) { setTimeout(function () { r(true); }, 9000); }); }
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
const page = await browser.newPage({ viewport: { width: 1031, height: 580 } });
page.setDefaultTimeout(90000);
await page.addInitScript(SDK);
await page.route(/game-cdn\.poki\.com/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: SDK }));

await page.goto(ORIGIN + "/", { waitUntil: "commit" });
await page.waitForTimeout(7000);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "Random name", exact: true }).click().catch(() => {});
  await confirm.click().catch(() => {});
  await page.waitForTimeout(900);
}
await page.getByRole("button", { name: "Play free flight now", exact: true }).click().catch(() => {});
await page.waitForTimeout(4000);
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
const shape = await page.evaluate(() => {
  const card = document.querySelector('[data-ref="adCard"]');
  const btn = (sel) => { const b = document.querySelector(sel); return b ? b.textContent.trim() : null; };
  return {
    card: Boolean(card),
    label: card?.querySelector(".ad-label")?.textContent ?? null,
    header: card?.querySelector(".portal-ad-wait h3")?.textContent ?? null,
    sub: card?.querySelector(".portal-ad-wait p")?.textContent ?? null,
    skip: btn('[data-action="ad-skip"]'),
    upsell: btn('[data-action="ad-gold"]'),
  };
});
console.log("PORTAL BREAK CARD:", JSON.stringify(shape, null, 1));
await page.screenshot({ path: "/tmp/adskip/portal-break.png", timeout: 60000 });
console.log("shot: /tmp/adskip/portal-break.png");
await browser.close();
await new Promise((r) => server.close(r));
