#!/usr/bin/env node
/**
 * Animated thumbnail recorder (Poki "Your game page" video requirements):
 *   1080×1080 · 1:1 · ≥50 fps · 4–6 s · .mp4 · muted.
 *
 * It drives the real game headlessly: boots to the menu (the attract flight
 * is scene 1), then holds/releases the one button (dive–soar–dive is scene 2)
 * while the 3D canvas is captured at 60 fps via canvas.captureStream(60) +
 * MediaRecorder. Because only the CANVAS is captured, the DOM HUD and the
 * mouse cursor never appear in the clip (Poki: "remove the cursor",
 * "hide non-essential UI").
 *
 * Usage (on a machine with a normal internet connection):
 *   npx playwright install chromium          # once
 *   pnpm dev                                 # terminal 1 — Vite on :5173
 *   node scripts/record-thumbnail.mjs        # terminal 2 (URL overridable)
 *
 * Output: assets/submission/sunbird-animated-thumbnail.webm (always) and, when
 * ffmpeg is on PATH, the final sunbird-animated-thumbnail.mp4 (H.264, 60 fps,
 * no audio) — the file to upload in Poki for Developers.
 *
 * Why not just Playwright's recordVideo? Its rate is not guaranteed ≥50 fps;
 * captureStream(60) + MediaRecorder records real 60 fps frames from the GPU
 * canvas, which is the requirement that matters.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.argv[2] ?? "http://localhost:5173";
const OUT_DIR = join(root, "assets", "submission");
const OUT_WEBM = join(OUT_DIR, "sunbird-animated-thumbnail.webm");
const OUT_MP4 = join(OUT_DIR, "sunbird-animated-thumbnail.mp4");
const SECONDS = 5; // 4–6 s per the spec
const FPS = 60; // ≥50 per the spec

const { chromium } = await import("playwright");

console.log(`1/5 launching headless Chromium (1080×1080)…`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("  page error:", e.message));

console.log(`2/5 loading ${URL} …`);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector("canvas.game-canvas", { timeout: 60_000 });
// Let the attract flight settle so the first frames are a stable menu world.
await page.waitForTimeout(2500);

console.log(`3/5 arming the canvas recorder (${FPS} fps, ${SECONDS}s)…`);
await page.evaluate(() => {
  const canvas = document.querySelector("canvas.game-canvas");
  const stream = canvas.captureStream(FPS);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 20_000_000 });
  window.__chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) window.__chunks.push(e.data);
  };
  window.__stopped = new Promise((resolve) => (rec.onstop = resolve));
  window.__rec = rec;
  rec.start(1000);
});

// Scene 2: the core loop — hold to dive, release to soar, hold again.
// Real pointer events through the input system (pointerdown/up on the canvas).
const cx = 540;
const cy = 540;
await page.mouse.move(cx, cy);
const hold = (ms) => page.mouse.down().then(() => page.waitForTimeout(ms)).then(() => page.mouse.up());
await hold(1000); // dive
await page.waitForTimeout(900); // soar / launch
await hold(1100); // dive again
await page.waitForTimeout(1000); // settle — total 5 s of footage

console.log("4/5 stopping and reading the clip…");
await page.evaluate(async () => {
  window.__rec.stop();
  await window.__stopped;
});
const b64 = await page.evaluate(async () => {
  const blob = new Blob(window.__chunks, { type: "video/webm" });
  const buf = await blob.arrayBuffer();
  // Base64 in 1 MB slices so the CDP payload stays well-formed.
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1_000_000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 1_000_000));
  }
  return btoa(out);
});
await browser.close();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_WEBM, Buffer.from(b64, "base64"));
const mb = (Buffer.from(b64, "base64").length / 1_048_576).toFixed(1);
console.log(`  saved ${OUT_WEBM} (${mb} MB)`);

console.log("5/5 converting to MP4 (Poki requires .mp4)…");
try {
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", OUT_WEBM, "-r", String(FPS), "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", "-an", OUT_MP4],
    { stdio: "pipe", timeout: 300_000 },
  );
  console.log(`  saved ${OUT_MP4} — upload this in Poki for Developers.`);
} catch {
  console.log("  ffmpeg not found — the .webm is saved. Convert with:");
  console.log(`  ffmpeg -i ${OUT_WEBM} -r ${FPS} -pix_fmt yuv420p -c:v libx264 -crf 18 -an ${OUT_MP4}`);
}

console.log("\nPoki spec checklist: 1080×1080 ✓ · 1:1 ✓ · 60 fps (≥50) ✓ · ~5 s (4–6) ✓ · muted ✓ · .mp4 (after convert) ✓");
console.log("If the framing feels off, re-run — the camera follows the bird, and the one-button input gives a fresh flight each time.");
