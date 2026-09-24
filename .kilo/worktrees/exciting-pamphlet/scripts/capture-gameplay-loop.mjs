#!/usr/bin/env node
/**
 * Records a 3.5-second gameplay loop from the running Vite dev server
 * and converts it to Poki's expected WebP animated thumbnail format.
 *
 * Prerequisites:
 *   - Vite dev server running on http://127.0.0.1:5173
 *   - ffmpeg installed
 *   - Playwright Chromium installed
 *
 * Output:
 *   promo/animated/sunbird-animated.webp  (628x500, 15fps, looped)
 *   promo/animated/sunbird-animated.gif   (512x512, 10fps)
 *   promo/animated/sunbird-animated-256.gif (256x256, 12fps)
 *   promo/animated/sunbird-animated-128.gif (128x128, 8fps)
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "promo", "animated");
mkdirSync(OUT_DIR, { recursive: true });

const GAME_URL = "http://127.0.0.1:5173/";
const RECORD_MS = 3500;
const TEMP_DIR = "/tmp/sunbird-capture";
mkdirSync(TEMP_DIR, { recursive: true });

async function main() {
  console.log("[capture] Launching headless Chromium with video recording...");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-features=AutomationControlled",
      "--use-fake-ui-for-media-stream", // no mic/camera prompts
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: TEMP_DIR,
      size: { width: 1280, height: 720 },
      fps: 30,
    },
  });

  const page = await context.newPage();
  console.log("[capture] Navigating to game...");

  await page.goto(GAME_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800); // let the game render

  // Click SOLO to start a race
  try {
    const soloBtn = await page.$("//text()[contains(.,'SOLO')]/ancestor::*[@role='button']");
    if (soloBtn) {
      await soloBtn.click({ timeout: 2000 });
      console.log("[capture] SOLO button clicked — race starting");
    } else {
      console.log("[capture] SOLO button not found — will capture ambient menu");
    }
  } catch (e) {
    console.log("[capture] SOLO click failed (non-fatal):", e.message.slice(0, 80));
  }

  console.log(`[capture] Recording ${RECORD_MS}ms of gameplay...`);
  await page.waitForTimeout(RECORD_MS);

  console.log("[capture] Stopping browser...");
  await context.close();
  await browser.close();

  // Find recorded video (Playwright uses .webm)
  const files = readdirSync(TEMP_DIR).filter(f => f.endsWith(".webm"));
  if (files.length === 0) throw new Error("No video file recorded");
  const rawVideo = join(TEMP_DIR, files[files.length - 1]);

  const webpPath = join(OUT_DIR, "sunbird-animated.webp");
  const gifPath = join(OUT_DIR, "sunbird-animated.gif");

  // Convert to Poki-standard WebP: 628x500, 15fps, infinite loop
  console.log("[capture] Encoding WebP 628x500 @15fps...");
  execSync(
    `ffmpeg -y -i "${rawVideo}" ` +
    `-vf "fps=15,scale=628:500:flags=lanczos" ` +
    `-loop 0 -preset picture -quality 85 ` +
    `"${webpPath}"`,
    { stdio: "pipe" }
  );

  // Also regenerate GIFs from the new footage
  console.log("[capture] Generating GIF variants...");
  execSync(
    `ffmpeg -y -i "${webpPath}" ` +
    `-vf "fps=10,scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=black@0" ` +
    `"${gifPath}"`,
    { stdio: "pipe" }
  );

  execSync(
    `ffmpeg -y -i "${webpPath}" ` +
    `-vf "fps=12,scale=256:256:flags=lanczos:force_original_aspect_ratio=decrease,pad=256:256:-1:-1:color=black@0" ` +
    `${join(OUT_DIR, "sunbird-animated-256.gif")}`,
    { stdio: "pipe" }
  );

  execSync(
    `ffmpeg -y -i "${webpPath}" ` +
    `-vf "fps=8,scale=128:128:flags=lanczos:force_original_aspect_ratio=decrease,pad=128:128:-1:-1:color=black@0" ` +
    `${join(OUT_DIR, "sunbird-animated-128.gif")}`,
    { stdio: "pipe" }
  );

  const webpSize = statSync(webpPath).size;
  const gifSize = statSync(gifPath).size;
  console.log(`✅ Gameplay loop captured as WebP: ${webpPath} (${(webpSize / 1024).toFixed(1)} KB)`);
  console.log(`✅ GIF variants regenerated: ${gifPath} (${(gifSize / 1024).toFixed(1)} KB)`);

  // Verify WebP
  execSync(`ffprobe -v error -show_entries stream=width,height,nb_frames -of csv=p=0 "${webpPath}"`, {
    stdio: "inherit",
  });

  console.log("\nDone. Real gameplay footage is now in promo/animated/.");
}

main().catch(e => {
  console.error("[capture] FAILED:", e.message);
  console.error(e.stack);
  process.exit(1);
});
