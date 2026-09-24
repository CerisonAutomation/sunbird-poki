import { chromium } from "@playwright/test";
const URL = "http://localhost:4174/";

const INSTRUMENT = `
window.__m = { navStart: performance.timeOrigin };
window.__mark = (k) => { if (!(k in window.__m)) window.__m[k] = performance.now(); };
addEventListener('load', () => window.__mark('load'));
addEventListener('DOMContentLoaded', () => window.__mark('dcl'));
window.__pending = new Set();
const _fetch = window.fetch;
window.fetch = function(...a) { const u = String(a[0]); window.__pending.add(u);
  return _fetch.apply(this, a).then(r => { window.__pending.delete(u); return r; }, e => { window.__pending.delete(u); throw e; }); };
`;

async function run(blockSdk, label, runs = 3) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const browser = await chromium.launch({ args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, bypassCSP: true });
    const page = await ctx.newPage();
    await page.addInitScript(INSTRUMENT);
    const errs = [];
    page.on("pageerror", e => errs.push(String(e.message).slice(0, 200)));
    page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
    if (blockSdk) await page.route("**game-cdn.poki.com/**", r => r.abort());
    if (blockSdk) await page.route("https://game-cdn.poki.com/**", r => r.abort());

    const t0 = Date.now();
    const nav = page.goto(URL, { waitUntil: "commit" });
    // Poll independently of the load event: the "interactive" moment is when the
    // pilot-name / play control is actually mounted, visible and clickable.
    let paneMs = null, playVisible = false;
    const deadline = t0 + 90000;
    while (Date.now() < deadline) {
      const st = await page.evaluate(() => {
        const c = document.querySelector('[data-action="confirm-pilot-name"]');
        const p = [...document.querySelectorAll('button')].find(b => /Play free flight now/i.test(b.textContent || ""));
        const el = c || p;
        const vis = el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
        return { has: !!el, vis: !!vis, t: performance.now(), load: (window.__m||{}).load ?? null, poki: typeof window.PokiSDK };
      }).catch(() => null);
      if (st?.vis) { paneMs = Date.now() - t0; playVisible = true; break; }
      await page.waitForTimeout(50);
    }
    await nav;
    // dismiss the welcome/name screen
    const confirm = page.locator('[data-action="confirm-pilot-name"]');
    if (await confirm.count()) await confirm.click({ timeout: 20000 }).catch(() => {});
    const playBtn = page.getByRole("button", { name: /Play free flight now/i }).first();
    let menuMs = null;
    try { await playBtn.waitFor({ state: "visible", timeout: 60000 }); menuMs = Date.now() - t0; } catch {}

    // tap-to-flight
    let flightMs = null;
    try {
      const t1 = Date.now();
      await playBtn.click();
      await page.locator('[data-action="pause"]').waitFor({ state: "visible", timeout: 45000 });
      flightMs = Date.now() - t1;
    } catch {}

    const m = await page.evaluate(() => ({ m: window.__m, nav: (() => { const n = performance.getEntriesByType("navigation")[0]; return { domInteractive: Math.round(n.domInteractive), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; })(), pending: [...window.__pending], poki: typeof window.PokiSDK }));
    out.push({ run: i + 1, loadEvent: m.nav.load, interactiveMs: paneMs, menuMs, flightMs, dcl: m.nav.dcl, domInteractive: m.nav.domInteractive, pokiType: m.poki, pending: m.pending, errs: errs.slice(0, 4) });
    await browser.close();
  }
  const med = k => { const v = out.map(o => o[k]).filter(x => typeof x === "number").sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  console.log(`\n### ${label}`);
  console.log(JSON.stringify(out, null, 1));
  console.log(`MEDIAN  load=${med("loadEvent")}  interactive=${med("interactiveMs")}  menu=${med("menuMs")}  tapToFlight=${med("flightMs")}  dcl=${med("dcl")}  domInteractive=${med("domInteractive")}`);
  return out;
}

const live = await run(false, "SDK LIVE (3 runs)");
const blocked = await run(true, "SDK BLOCKED (3 runs)");
console.log("\n==== SUMMARY ====");
console.log(JSON.stringify({ live, blocked }, null, 1));
