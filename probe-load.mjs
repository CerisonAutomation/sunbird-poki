import { chromium } from "@playwright/test";
const URL = "http://localhost:4174/";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function run(label, blockSdk) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const pending = new Map();
  const failed = [];
  page.on("request", r => pending.set(r.url(), r.resourceType()));
  page.on("requestfinished", r => pending.delete(r.url()));
  page.on("requestfailed", r => { failed.push({ url: r.url(), err: r.failure()?.errorText }); pending.delete(r.url()); });
  if (blockSdk) await page.route("**game-cdn.poki.com**", r => r.abort());

  const t0 = Date.now();
  await page.evaluate(() => {}).catch(() => {});
  const nav = page.goto(URL, { waitUntil: "commit" }).catch(e => e);
  await page.waitForTimeout(300);
  const loadState = [];
  for (let i = 0; i < 20; i++) {
    const rs = await page.evaluate(() => ({ readyState: document.readyState, t: performance.now(), nav: performance.getEntriesByType("navigation")[0] ? { dcl: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd, load: performance.getEntriesByType("navigation")[0].loadEventEnd, domInteractive: performance.getEntriesByType("navigation")[0].domInteractive, responseEnd: performance.getEntriesByType("navigation")[0].responseEnd } : null })).catch(() => null);
    loadState.push({ ms: Date.now() - t0, ...rs });
    if (rs?.readyState === "complete") break;
    await page.waitForTimeout(1000);
  }
  await nav;
  console.log(`\n### ${label} (blockSdk=${blockSdk})`);
  console.log("readyState progression:", JSON.stringify(loadState.map(s => [s.ms, s.readyState]), null, 0));
  console.log("last nav timings:", JSON.stringify(loadState[loadState.length - 1]?.nav));
  console.log("STILL PENDING after wait:", JSON.stringify([...pending.entries()].slice(0, 30), null, 1));
  console.log("FAILED requests:", JSON.stringify(failed.slice(0, 20), null, 1));
  await ctx.close();
}
await run("SDK live", false);
await run("SDK blocked", true);
await browser.close();
