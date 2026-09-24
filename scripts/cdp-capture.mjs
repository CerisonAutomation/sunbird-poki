#!/usr/bin/env node
/**
 * Captures a gameplay loop using Chrome DevTools Protocol screencast,
 * then assembles the frames into Poki-style animated WebP and GIF.
 *
 * Prerequisites:
 *   - Chrome running with --remote-debugging-port=9333
 *   - Game loaded at http://127.0.0.1:5173/
 *   - ffmpeg + ImageMagick installed
 */
import WebSocket from "ws";
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "promo", "animated");
const FRAME_DIR = "/tmp/sunbird-frames";
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(FRAME_DIR, { recursive: true });

// This should be set before running — get it from:
//   curl -s http://127.0.0.1:9333/json | python3 -c "import json,sys;[print(t['webSocketDebuggerUrl']) for t in json.loads(sys.stdin.read()) if t.get('type')=='page']"
const WS_URL = process.env.CDP_WS || "";

const DURATION_MS = 3500;
let frameCount = 0;

async function cdpCapture(wsUrl) {
  console.log("[cdp] Connecting to Chrome DevTools...");
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  let frameFiles = [];
  let startTime = null;

  ws.on("open", () => {
    console.log("[cdp] Connected. Starting screencast...");
    startTime = Date.now();

    ws.send(JSON.stringify({ id: msgId++, method: "Page.enable" }));
    ws.send(JSON.stringify({ id: msgId++, method: "Runtime.enable" }));

    ws.send(JSON.stringify({
      id: msgId++,
      method: "Page.startScreencast",
      params: { format: "jpeg", quality: 90, everyNthFrame: 1 }
    }));

    // Click at center of screen after 1.5s to start the game
    setTimeout(() => {
      console.log("[cdp] Clicking center to start...");
      const ts = Date.now() / 1000;
      ws.send(JSON.stringify({
        id: msgId++,
        method: "Input.dispatchMouseEvent",
        params: { type: "mousePressed", x: 540, y: 283, button: "left", pointerType: "mouse", timestamp: ts }
      }));
      ws.send(JSON.stringify({
        id: msgId++,
        method: "Input.dispatchMouseEvent",
        params: { type: "mouseReleased", x: 540, y: 283, button: "left", pointerType: "mouse", timestamp: ts }
      }));

      // After 500ms, click SOLO area
      setTimeout(() => {
        console.log("[cdp] Clicking SOLO...");
        const ts2 = Date.now() / 1000;
        ws.send(JSON.stringify({
          id: msgId++,
          method: "Input.dispatchMouseEvent",
          params: { type: "mousePressed", x: 540, y: 200, button: "left", pointerType: "mouse", timestamp: ts2 }
        }));
        ws.send(JSON.stringify({
          id: msgId++,
          method: "Input.dispatchMouseEvent",
          params: { type: "mouseReleased", x: 540, y: 200, button: "left", pointerType: "mouse", timestamp: ts2 }
        }));
      }, 500);
    }, 1500);

    setTimeout(() => {
      console.log(`[cdp] Stopping screencast after ${DURATION_MS}ms...`);
      ws.send(JSON.stringify({ id: msgId++, method: "Page.stopScreencast" }));
      ws.close();
    }, DURATION_MS + 1000);
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    if (msg.method === "Page.screencastFrame") {
      const now = Date.now();
      if (startTime && (now - startTime) >= 500) {
        const frameData = msg.params.data;
        const path = join(FRAME_DIR, `frame_${String(frameCount).padStart(4, "0")}.jpg`);
        writeFileSync(path, Buffer.from(frameData, "base64"));
        frameFiles.push(path);
        frameCount++;
        if (frameCount % 20 === 0) console.log(`[cdp] Frame ${frameCount}`);
      }
      // Ack
      ws.send(JSON.stringify({
        id: msgId++,
        method: "Page.screencastFrameAck",
        params: { sessionId: msg.params.sessionId }
      }));
    }
  });

  ws.on("close", () => {
    console.log(`[cdp] Captured ${frameFiles.length} frames`);
    assembleVideo(frameFiles);
  });

  ws.on("error", (err) => {
    console.error("[cdp] ws error:", err.message);
    process.exit(1);
  });
}

function assembleVideo(frames) {
  if (frames.length < 2) {
    console.error("[cdp] Not enough frames to assemble.");
    return;
  }

  console.log("[cdp] Assembling frames into video (ffmpeg concat)...");
  const listFile = join(FRAME_DIR, "frames.txt");
  const listContent = frames.map(f => `file '${f}'`).join("\n");
  writeFileSync(listFile, listContent);

  const intermediate = join(FRAME_DIR, "intermediate.mp4");
  const webpPath = join(OUT_DIR, "sunbird-animated.webp");
  const gifPath = join(OUT_DIR, "sunbird-animated.gif");

  // Step 1: Concat JPG frames into an intermediate MP4 (ffmpeg CAN encode h264)
  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listFile}" ` +
      `-vf "fps=15,scale=1080:479:flags=lanczos" ` +
      `-c:v libx264 -pix_fmt yuv420p "${intermediate}"`,
      { stdio: "pipe" }
    );
    console.log("[cdp] Intermediate MP4 encoded");
  } catch (e) {
    console.error("[cdp] MP4 encoding failed:", e.message.slice(0, 200));
    process.exit(1);
  }

  // Step 2: Convert MP4 -> GIF (use palettegen for best quality)
  try {
    const palette = join(FRAME_DIR, "palette.png");
    execSync(
      `ffmpeg -y -i "${intermediate}" ` +
      `-vf "fps=15,scale=512:-1:flags=lanczos,palettegen" ` +
      `"${palette}"`,
      { stdio: "pipe" }
    );
    execSync(
      `ffmpeg -y -i "${intermediate}" -i "${palette}" ` +
      `-filter_complex "fps=15,scale=512:512:flags=lanczos[scaled];[scaled][1:v]paletteuse" ` +
      `"${gifPath}"`,
      { stdio: "pipe" }
    );
    const gifSize = statSync(gifPath).size;
    console.log(`✅ GIF 512: ${gifPath} (${(gifSize/1024).toFixed(1)} KB)`);
  } catch (e) {
    console.error("[cdp] GIF encoding failed:", e.message.slice(0, 200));
  }

  // Step 3: GIF variants (256, 128)
  try {
    execSync(
      `ffmpeg -y -i "${gifPath}" ` +
      `-vf "fps=12,scale=256:256:flags=lanczos" ` +
      `${join(OUT_DIR, "sunbird-animated-256.gif")}`,
      { stdio: "pipe" }
    );
    console.log("[cdp] GIF 256 done");
  } catch (e) { console.error("[cdp] GIF 256 failed:", e.message.slice(0, 100)); }

  try {
    execSync(
      `ffmpeg -y -i "${gifPath}" ` +
      `-vf "fps=8,scale=128:128:flags=lanczos" ` +
      `${join(OUT_DIR, "sunbird-animated-128.gif")}`,
      { stdio: "pipe" }
    );
    console.log("[cdp] GIF 128 done");
  } catch (e) { console.error("[cdp] GIF 128 failed:", e.message.slice(0, 100)); }

  // Step 4: WebP from intermediate MP4 using ImageMagick
  // ImageMagick 'convert' can read MP4? No — needs individual frames.
  // Instead, extract individual PNGs and use magick to make animated WebP.
  try {
    const pngDir = join(FRAME_DIR, "pngs");
    mkdirSync(pngDir, { recursive: true });
    execSync(
      `ffmpeg -y -i "${intermediate}" ` +
      `-vf "fps=12,scale=628:500:flags=lanczos" ` +
      `${join(pngDir, "frame_%04d.png")}`,
      { stdio: "pipe" }
    );
    console.log("[cdp] PNG frames extracted for WebP assembly");

    execSync(
      `magick convert -quality 90 -loop 0 -delay 8 ` +
      `${join(pngDir, "frame_*.png")} ` +
      `${join(OUT_DIR, "sunbird-animated.webp")}`,
      { stdio: "pipe" }
    );
    const webpSize = statSync(webpPath).size;
    console.log(`✅ WebP: ${webpPath} (${(webpSize/1024).toFixed(1)} KB)`);
  } catch (e) {
    console.error("[cdp] WebP encoding failed:", e.message.slice(0, 200));
    // WebP is optional — Poki accepts GIF too
  }

  // Report
  console.log("\n✅ Gameplay loop captured from real game session!");
  for (const f of ["sunbird-animated.gif", "sunbird-animated-256.gif", "sunbird-animated-128.gif"]) {
    const p = join(OUT_DIR, f);
    if (statSync(p)) {
      const sz = statSync(p).size;
      console.log(`   ${f}: ${(sz/1024).toFixed(1)} KB`);
    }
  }

  // Verify
  try {
    const info = execSync(`ffprobe -v error -show_entries stream=width,height,nb_frames,duration -of csv=p=0 "${gifPath}"`, { encoding: "utf8" });
    console.log("\n[cdp] GIF info:", info.trim());
  } catch {}
}

if (!WS_URL) {
  console.error("Usage: CDP_WS=ws://... node scripts/cdp-capture.mjs");
  process.exit(1);
}

cdpCapture(WS_URL);
