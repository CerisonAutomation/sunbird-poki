import { chromium } from "@playwright/test";
const URL = "http://localhost:4174/";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

const INSTRUMENT = `
window.__t = { start: performance.now() };
addEventListener('load', () => { window.__t.load = performance.now(); });
addEventListener('DOMContentLoaded', () => { window.__t.dcl = performance.now(); });
window.__slow = [];
const _fetch = window.fetch;
window.fetch = function(...a) { const s = performance.now(); const u = String(a[0]);
  return _fetch.apply(this, a).then(r => { window.__slow.push({u, ms: performance.now()-s, ok: r.status}); return r; },
    e => { window.__slow.push({u, ms: performance.now()-s, err: String(e)}); throw e; }); };
new PerformanceObserver(list => { for (const e of list.getEntries()) window.__slow.push({u: 'RES:'+e.name, ms: Math.round(e.startTime+e.duration), dur: Math.round(e.duration)}); })
  .observe({ type: 'resource', buffered: true });
`;

async function run(label, blockSdk) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  if (blockSdk) await page.route("**game-cdn.poki.com**", r => r.abort());

  const t0 = Date.now();
  let loadMs = null;
  const navP = page.goto(URL, { waitUntil: "commit" }).catch(e => e);
  // Poll for the load event precisely.
  for (let i = 0; i < 120; i++) {
    const t = await page.evaluate(() => window.__t?.load ?? null).catch(() => null);
    if (t !== null && t !== undefined) { loadMs = { perf: Math.round(t), wall: Date.now() - t0 }; break; }
    await page.waitForTimeout(250);
  }
  await navP;
  // Wait for interactive surface
  const confirm = page.locator('[data-action="confirm-pilot-name"], button:has-text("Play free flight now")');
  let interactiveMs = null;
  try {
    await confirm.first().waitFor({ state: "visible", timeout: 60000 });
    interactiveMs = Date.now() - t0;
  } catch {}
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => ({ t: window.__t, slow: window.__slow, nav: (() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { domInteractive: Math.round(n.domInteractive), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), responseEnd: Math.round(n.responseEnd) } : null; })() }));
  console.log(`\n### ${label}`);
  console.log("perf-load-ms:", loadMs ? loadMs.perf : "NOT FIRED within 30s poll", " wall-visible-interactive-ms:", interactiveMs);
  console.log("nav timings:", JSON.stringify(data.nav));
  console.log("slower resources/fetches (>300ms or non-2xx):");
  for (const s of (data.slow || []).filter(x => (x.dur ?? x.ms) > 300 || (x.ok && x.ok >= 400)).sort((a, b) => (b.dur ?? b.ms) - (a.dur ?? a.ms)).slice(0, 20)) console.log("  ", JSON.stringify(s));
  await ctx.close();
}
await run("SDK live", false);
await run("SDK blocked", true);
await browser.close();
