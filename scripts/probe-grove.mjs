/**
 * Gilded Grove probe (2026-10-04 "more worlds" directive): boot the real dev
 * build as a brand-new player and walk the actual player path to the eleventh
 * world — PvP lobby → Customize → Gilded Mile pill → AI flock race — then
 * prove the world is really there by flying it.
 *
 * Proof is differential: the same probe flies the Emerald Circuit (island 0,
 * green) and the Gilded Mile (island 10, the grove) back to back and compares
 * the rendered frame's palette. The grove reads gold (#e8c86a terrain,
 * #ffd88a horizon); Green Hills reads green. A golden-heavy frame on the
 * gilded course that the emerald course does not produce is the world live.
 *
 * The biome *hint* cannot be used: it only fires when a run CROSSES into a
 * biome, and a race starts inside its course biome. The frame is the truth.
 *
 * Leaves audit-shots/15-gilded-grove.png (the world's first photo) and
 * audit-shots/15-emerald-baseline.png behind.
 */
import { chromium } from "@playwright/test";
import { decodePng } from "./png.mjs";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({
  executablePath: "/tmp/spart/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await (await browser.newContext({ viewport: { width: 412, height: 839 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 100)); });

await page.goto("http://localhost:5173/", { waitUntil: "commit" });
await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
await page.waitForTimeout(1200);
const confirm = page.locator('[data-action="confirm-pilot-name"]');
if (await confirm.isVisible().catch(() => false)) await confirm.click();
await page.waitForTimeout(800);

/** Palette of one PNG frame, sampled over the world (below the sky, above the HUD). */
const paletteOf = (buf) => {
  const img = decodePng(buf);
  let golden = 0, green = 0, total = 0;
  const y0 = Math.floor(img.height * 0.3), y1 = Math.floor(img.height * 0.92);
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * img.channels;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      // Grove terrain/horizon family: e8c86a, c8a03c, d8b060, a88040, ffd88a.
      if (r > 160 && g > 110 && b < 150 && r > b + 45 && g > b + 10) golden++;
      // Green Hills family: leafy terrain, no red lean.
      if (g > r + 25 && g > b + 25) green++;
      total++;
    }
  }
  return { goldenPct: Math.round((golden / total) * 100), greenPct: Math.round((green / total) * 100) };
};

/** Fly one AI-flock race on the given course; return the best-of frames' palette. */
async function flyCourse(courseId, shotPath) {
  await page.locator('[data-action="open-live"]').first().click();
  await page.waitForTimeout(900);
  await page.locator("details.customize-race > summary").click();
  await page.waitForTimeout(400);
  const pill = page.locator(`.world-pill[data-id="${courseId}"]`);
  const label = (await pill.textContent().catch(() => null))?.replace(/\s+/g, " ").trim();
  if (!label) throw new Error(`${courseId} pill missing`);
  await pill.scrollIntoViewIfNeeded();
  await pill.click();
  await page.waitForTimeout(500);
  const go = page.locator('[data-action="quick-match-instant"]');
  const goText = (await go.textContent())?.replace(/\s+/g, " ").trim();
  // Offline path: AI practice race launches instantly (netlib is unreachable
  // in this sandbox — a sandbox limit, not a game bug).
  await page.locator('[data-action="open-practice"]').first().click();
  await page.waitForTimeout(700);
  const race = page.locator('[data-action="ai-pvp"]').first();
  await race.scrollIntoViewIfNeeded();
  await race.click();

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await page.evaluate(() => document.querySelector(".hud-root")?.dataset.uiState === "playing")) break;
    await page.waitForTimeout(400);
  }
  // No input: the launch ramp flies the bird over the course under its own
  // glide. Frames at 2s / 3.5s / 5s; keep the most golden one.
  let best = { goldenPct: 0, greenPct: 0 };
  for (const wait of [2000, 1500, 1500]) {
    await page.waitForTimeout(wait);
    const frame = await page.screenshot();
    const pal = paletteOf(frame);
    writeFileSync(shotPath, frame);
    if (pal.goldenPct > best.goldenPct) best = pal;
  }
  console.log(`${courseId}: pill=${JSON.stringify(label)} button=${JSON.stringify(goText)} palette=${JSON.stringify(best)}`);
  // Back to the menu for the next course.
  for (let i = 0; i < 30; i++) {
    const quit = page.locator('[data-action="quit-run"], [data-action="give-up"], [data-action="exit-run"]').first();
    if (await quit.isVisible().catch(() => false)) { await quit.click(); break; }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => document.querySelector(".hud-root")?.dataset.uiState ?? "");
    if (state !== "playing") break;
  }
  await page.waitForTimeout(1200);
  const home = page.locator('[data-action="open-live"]').first();
  if (!(await home.isVisible().catch(() => false))) {
    await page.locator('[data-action="retry"], [data-action="home"]').first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  return { label, goText, best };
}

const emerald = await flyCourse("emerald", "audit-shots/15-emerald-baseline.png");
const gilded = await flyCourse("gilded", "audit-shots/15-gilded-grove.png");

const pass = gilded.goText.includes("Gilded Mile")
  && gilded.best.goldenPct >= 10
  && gilded.best.goldenPct > emerald.best.goldenPct * 2;
console.log(pass
  ? `PASS: Gilded Grove is live (golden ${gilded.best.goldenPct}% on gilded vs ${emerald.best.goldenPct}% on emerald)`
  : `FAIL: gilded golden=${gilded.best.goldenPct}% vs emerald golden=${emerald.best.goldenPct}%`);
await browser.close();
console.log("console errors:", errors.length ? [...new Set(errors)].slice(0, 2).join(" | ") : "(none)");
process.exit(pass ? 0 : 1);
