/**
 * Full visual sweep of the SHIPPING build at Poki's sizes.
 * Writes PNGs to /tmp/shots/ for looking at (not for measuring).
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = 4193;
const ROOT = path.join(import.meta.dirname, "poki-upload");
const OUT = "/tmp/shots";
mkdirSync(OUT, { recursive: true });
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon" };

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

async function boot(page) {
  await page.goto(ORIGIN + "/", { waitUntil: "commit" });
  await page.waitForTimeout(6500);
  const confirm = page.locator('[data-action="confirm-pilot-name"]');
  if (await confirm.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Random name", exact: true }).click().catch(() => {});
    await confirm.click().catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("shot:", name);
}

// ---- small landscape (Poki's tightest) + mobile portrait + mid ----
for (const [w, h, tag] of [[640, 360, "sm"], [1031, 580, "md"], [390, 844, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await boot(page);
  await shot(page, `${tag}-menu`);
  if (tag !== "mobile") {
    for (const [label, name] of [["Shop", "shop"], ["Settings", "settings"], ["Solo modes", "modes"]]) {
      await page.getByRole("button", { name: new RegExp(label) }).first().click().catch(() => {});
      await shot(page, `${tag}-${name}`);
      await page.locator('[data-ref="menuCard"] [data-action="back"]').click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  // flight + pause
  await page.getByRole("button", { name: "Play free flight now", exact: true }).click().catch(() => {});
  await page.waitForTimeout(3500);
  await shot(page, `${tag}-flight`);
  await page.keyboard.press("Escape").catch(() => {});
  await shot(page, `${tag}-pause`);
  await page.keyboard.press("Escape").catch(() => {});
  await page.close();
}

// ---- one death for the continue + results screens (small landscape) ----
{
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await boot(page);
  await page.getByRole("button", { name: "Play free flight now", exact: true }).click().catch(() => {});
  let reached = null;
  for (let i = 0; i < 50; i += 1) {
    await page.waitForTimeout(1600);
    const seen = await page.evaluate(() => ({
      cont: Boolean(document.querySelector('[data-action="continue-coins"], [data-action="continue-sleep"]')),
      over: Boolean(document.querySelector('[data-action="share-run"]')),
    }));
    if (seen.cont) { reached = "continue"; break; }
    if (seen.over) { reached = "over"; break; }
  }
  if (reached === "continue") {
    await shot(page, "sm-continue");
    await page.locator('[data-action="continue-sleep"]').click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "sm-results");
  } else if (reached === "over") {
    await shot(page, "sm-results");
  } else {
    console.log("NOTE: never reached a results/continue screen in 80s");
  }
  await page.close();
}

await browser.close();
await new Promise((r) => server.close(r));
