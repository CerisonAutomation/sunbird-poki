import { chromium } from "@playwright/test";

const URL = "http://localhost:4174/";

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
const requests = [];
const responses = [];
page.on("console", m => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 400) }));
page.on("pageerror", e => pageErrors.push(String(e && e.message ? e.message : e).slice(0, 400)));
page.on("request", r => requests.push(r.url()));
page.on("response", r => responses.push({ url: r.url(), status: r.status(), len: r.headers()["content-length"] }));

const t0 = Date.now();
await page.goto(URL, { waitUntil: "commit" });

// Wait for boot shell to disappear
let bootGone = -1;
for (let i = 0; i < 300; i++) {
  const n = await page.locator("#boot-shell").count();
  if (n === 0) { bootGone = Date.now() - t0; break; }
  await page.waitForTimeout(100);
}

await page.waitForTimeout(2500);

const sdk = await page.evaluate(() => {
  const w = window;
  return {
    pokiSDK: typeof w.PokiSDK,
    pokiKeys: w.PokiSDK ? Object.keys(w.PokiSDK).sort() : null,
    gameBreak: typeof w.PokiSDK?.gameLoadingFinished,
    initOptions: w.__pokiInitOptions ? Object.keys(w.__pokiInitOptions) : null,
  };
});

console.log("=== BOOT ===");
console.log("boot-shell-gone-ms:", bootGone);
console.log("SDK:", JSON.stringify(sdk));

// What is on screen now?
const dom = await page.evaluate(() => {
  const all = document.querySelectorAll("*");
  const actions = [...document.querySelectorAll("[data-action]")].map(e => ({
    action: e.getAttribute("data-action"),
    ref: e.getAttribute("data-ref"),
    id: e.getAttribute("data-id"),
    text: (e.textContent || "").trim().slice(0, 60),
    visible: !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length),
    disabled: e.hasAttribute("disabled") || e.getAttribute("aria-disabled") === "true",
    tag: e.tagName,
  }));
  const screens = [...document.querySelectorAll("[data-screen], .screen-head h2")].map(e => (e.textContent || "").trim().slice(0, 60));
  return {
    title: document.title,
    bodyChildren: document.body.children.length,
    actionCount: all.length,
    actions,
    screens,
    bootShellPresent: !!document.getElementById("boot-shell"),
    visibleText: (document.body.innerText || "").slice(0, 1500),
  };
});
console.log("=== DOM SNAPSHOT ===");
console.log("title:", dom.title);
console.log("bootShellPresent:", dom.bootShellPresent);
console.log("screenHeads:", JSON.stringify(dom.screens));
console.log("actions:", JSON.stringify(dom.actions, null, 1));
console.log("=== VISIBLE TEXT ===");
console.log(dom.visibleText);

console.log("=== PAGE ERRORS ===");
console.log(JSON.stringify(pageErrors, null, 1));
console.log("=== CONSOLE ERRORS/WARN ===");
console.log(JSON.stringify(consoleMsgs.filter(m => m.type === "error" || m.type === "warning"), null, 1));

console.log("=== EXTERNAL REQUESTS (non-localhost) ===");
console.log(JSON.stringify([...new Set(requests.filter(u => !u.startsWith(URL) && !u.startsWith("http://localhost:4174")))], null, 1));

console.log("=== RESPONSES (localhost) ===");
const localRes = responses.filter(r => r.url.startsWith("http://localhost:4174"));
let total = 0;
for (const r of localRes) {
  const n = Number(r.len || 0);
  total += n;
  console.log(r.status, String(n).padStart(9), r.url.replace("http://localhost:4174", ""));
}
console.log("TOTAL content-length bytes:", total);

await browser.close();
