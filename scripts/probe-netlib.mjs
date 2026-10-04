/**
 * Probe: boot the shipped artifact, open the Race Lobby, and find out exactly
 * where the Netlib transport chain dies. Not a test — a diagnostic.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = 4191;
const ROOT = path.join(import.meta.dirname, "..", "poki-upload");
const ORIGIN = `http://127.0.0.1:${PORT}`;

const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon" };

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", ORIGIN).pathname);
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("404");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  s.listen(PORT, "127.0.0.1", () => resolve(s));
});

const SDK_STUB = `
window.__pokiCalls = [];
window.PokiSDK = (function () {
  function record(name) { return function () { window.__pokiCalls.push(name); }; }
  return {
    init: function (o) { if (o && typeof o.submitScore === "function") { o.submitScore(function(){}); } return Promise.resolve(); },
    setDebug: record("setDebug"), gameLoadingStart: record("gameLoadingStart"), gameLoadingFinished: record("gameLoadingFinished"),
    gameplayStart: record("gameplayStart"), gameplayStop: record("gameplayStop"), signalGameReady: record("signalGameReady"),
    movePill: record("movePill"), showLeaderboard: record("showLeaderboard"), captureError: record("captureError"),
    getDeviceInfo: function () { return { category: "desktop" }; },
    openExternalLink: record("openExternalLink"),
    playtestSetCanvas: record("playtestSetCanvas"),
    hasAdBlock: function () { return false; }, getURLParam: function () { return null; },
    getUser: function () { return Promise.resolve({ username: "QA", isSignedIn: false }); },
    getToken: function () { return Promise.resolve("stub"); },
    shareableURL: function () { return Promise.resolve("/"); },
    commercialBreak: function (cb) { if (cb) cb(); return Promise.resolve(); },
    rewardedBreak: function (cb) { if (cb) cb(); return Promise.resolve(true); }
  };
})();
`;

const browser = await chromium.launch({
  executablePath: "/tmp/spart/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();

const sockets = [];
const consoleMsgs = [];
const failedReqs = [];
page.on("websocket", (ws) => sockets.push(`${ws.url()} [closed=${ws.isClosed()}]`));
page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 160)}`));
page.on("requestfailed", (r) => failedReqs.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });

await page.addInitScript(SDK_STUB);
await page.addInitScript(() => {
  const OrigWS = window.WebSocket;
  window.__wsCreated = [];
  window.WebSocket = function (url, protocols) {
    window.__wsCreated.push(String(url));
    return protocols === undefined ? new OrigWS(url) : new OrigWS(url, protocols);
  };
  window.WebSocket.prototype = OrigWS.prototype;
  window.WebSocket.OPEN = OrigWS.OPEN; window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.CLOSING = OrigWS.CLOSING; window.WebSocket.CLOSED = OrigWS.CLOSED;
  const OrigRTC = window.RTCPeerConnection;
  window.__rtcCreated = 0;
  window.RTCPeerConnection = function (...args) { window.__rtcCreated += 1; return new OrigRTC(...args); };
  window.RTCPeerConnection.prototype = OrigRTC.prototype;
});
await page.route(/game-cdn\.poki\.com/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }));
await page.route(/auds\.poki\.io/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 0, items: [] }) }));

await page.goto(`${ORIGIN}/`, { waitUntil: "commit" });
await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
const play = page.getByRole("button", { name: "Fly now", exact: true });
const confirmName = page.locator('[data-action="confirm-pilot-name"]');
if (await confirmName.isVisible()) {
  await page.getByRole("button", { name: "Random name", exact: true }).click();
  await confirmName.click();
}
await play.waitFor({ timeout: 30_000 });

// Environment probes BEFORE opening the lobby.
const env = await page.evaluate(() => ({
  rtc: typeof RTCPeerConnection,
  cryptoOK: typeof crypto !== "undefined" && typeof crypto.getRandomValues,
  pokiSdk: typeof window.PokiSDK,
}));
console.log("ENV:", JSON.stringify(env));

// Open the Race Lobby via the real menu path.
await page.locator('[data-ref="menuCard"] [data-action="open-live"]:not(.onboarding-route-step)').first().click();
await page.locator(".screen-head h2").filter({ hasText: "Race Lobby" }).waitFor({ timeout: 20_000 });
// The lobby screen itself does not connect; hosting a private room does
// (host-room -> preseatLobby -> ensureNet -> PokiNetlibClient.connect).
await page.getByRole("button", { name: "Create Private Room", exact: true }).click();
await page.waitForTimeout(8_000);

console.log("SOCKETS:", sockets.length ? sockets.join("\n  ") : "(none)");
console.log("FAILED REQS:", failedReqs.length ? failedReqs.slice(0, 10).join("\n  ") : "(none)");
console.log("CONSOLE (last 15):", consoleMsgs.slice(-15).join("\n  ") || "(none)");

// Was the transport even created? Look for the game's debug handles.
const state = await page.evaluate(() => {
  const w = window;
  const keys = Object.keys(w).filter((k) => /sunbird|game|__/.test(k.toLowerCase()));
  return { interesting: keys.slice(0, 40) };
});
console.log("WINDOW KEYS:", JSON.stringify(state));
const built = await page.evaluate(() => ({ ws: window.__wsCreated ?? ["(init script lost)"], rtc: window.__rtcCreated ?? -1 }));
console.log("WS CONSTRUCTED IN-PAGE:", JSON.stringify(built.ws));
console.log("RTC CONSTRUCTED IN-PAGE:", built.rtc);
const roomStatus = await page.locator('[data-ref="menuCard"]').innerText().catch(() => "(no card)");
console.log("LOBBY TEXT (first 600):", roomStatus.slice(0, 600).replace(/\n+/g, " | "));

await browser.close();
await new Promise((resolve) => server.close(() => resolve()));
