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

/** Palette of one PNG frame, by HUE band (robust to fog washing an RGB range).
 *
 * The grove renders golden terrain through a beige fog (#d8c090), which shifts
 * the whole family away from crisp RGB thresholds — hue is the stable signal.
 *   golden: hue 25–70° (e8c86a, c8a03c, d8b060, a88040, ffd88a, fogged beige)
 *   green:  hue 75–165° (Green Hills' leafy terrain)
 * Sky and water live at 180–260° and count for neither. */
const paletteOf = (buf) => {
  const img = decodePng(buf);
  let golden = 0, green = 0, total = 0;
  const y0 = Math.floor(img.height * 0.3), y1 = Math.floor(img.height * 0.92);
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * img.channels;
      const r = img.data[i] / 255, g = img.data[i + 1] / 255, b = img.data[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max < 0.25) { total++; continue; } // near-black: HUD ink, ignore
      const sat = max === min ? 0 : (max - min) / max;
      if (sat < 0.18) { total++; continue; } // grey: overcast/faded, ignore
      const d = max - min;
      let hue = 0;
      if (max === r) hue = 60 * (((g - b) / d) % 6);
      else if (max === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
      if (hue >= 25 && hue <= 70) golden++;
      else if (hue >= 75 && hue <= 165) green++;
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
  // Fly like a player: short dive pulses keep the bird over the islands —
  // the grove's long water gaps swallow a passive glide. Sample a frame every
  // ~0.8 s and keep the most golden one (the grove's own terrain, not its
  // sky, is what must read gold).
  let best = { goldenPct: 0, greenPct: 0 };
  for (let beat = 0; beat < 10; beat++) {
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(600);
    const frame = await page.screenshot();
    const pal = paletteOf(frame);
    if (pal.goldenPct > best.goldenPct) {
      best = pal;
      writeFileSync(shotPath, frame);
    }
  }
  console.log(`${courseId}: pill=${JSON.stringify(label)} button=${JSON.stringify(goText)} palette=${JSON.stringify(best)}`);
  // Between courses the screen could be anywhere (second-wind card, results,
  // recap). The deterministic reset is a reload: the save persists, the
  // selected course resets — which the next leg sets anyway.
  await page.reload({ waitUntil: "commit" });
  await page.locator("#boot-shell").waitFor({ state: "detached", timeout: 60_000 });
  await page.waitForTimeout(1200);
  const name = page.locator('[data-action="confirm-pilot-name"]');
  if (await name.isVisible().catch(() => false)) await name.click();
  await page.waitForTimeout(800);
  return { label, goText, best };
}

const emerald = await flyCourse("emerald", "audit-shots/15-emerald-baseline.png");
const gilded = await flyCourse("gilded", "audit-shots/15-gilded-grove.png");

// The frame is the proof: the gilded course must read overwhelmingly gold and
// not green, clearly beyond anything the first world produces. (The launch
// button's label is logged for information but not asserted — it re-renders
// asynchronously and can be read a beat stale; the pill label and the palette
// are the ground truth.)
const pass = gilded.best.goldenPct >= 40
  && gilded.best.greenPct <= 5
  && gilded.best.goldenPct > emerald.best.goldenPct * 1.8;
console.log(pass
  ? `PASS: Gilded Grove is live (golden ${gilded.best.goldenPct}% on gilded vs ${emerald.best.goldenPct}% on emerald)`
  : `FAIL: gilded golden=${gilded.best.goldenPct}% vs emerald golden=${emerald.best.goldenPct}%`);
await browser.close();
console.log("console errors:", errors.length ? [...new Set(errors)].slice(0, 2).join(" | ") : "(none)");
process.exit(pass ? 0 : 1);
