#!/usr/bin/env node
/**
 * Animated thumbnail capture (Poki THB-09).
 *
 * Records a real 4-second gameplay loop from the SHIPPING artifact
 * (`poki-upload/`) — the same folder the Inspector receives — with the
 * Poki SDK stubbed exactly like poki-artifact.spec.ts does, then encodes:
 *
 *   assets/submission/sunbird-thumbnail-animated.gif   (628×628, ~12 fps)
 *
 * Usage: pnpm build:poki && node scripts/capture-animated-thumbnail.mjs
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const PORT = 4181;
const ROOT = path.join(import.meta.dirname, "..", "poki-upload");
const OUT = path.join(import.meta.dirname, "..", "assets", "submission");
const VIEW = { width: 1280, height: 720 };
const TILE = 628;
const CLIP = { x: (VIEW.width - TILE) / 2, y: (VIEW.height - TILE) / 2, width: TILE, height: TILE };
const CAPTURE_MS = 34000;
const FRAME_MS = 120;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function serveArtifact() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`).pathname);
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`404 ${pathname}`);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": statSync(file).size,
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const SDK_STUB = `
window.__pokiCalls = [];
window.PokiSDK = (function () {
  const record = (name) => (...args) => { window.__pokiCalls.push({ name, at: Date.now() }); };
  return {
    init: record("init"),
    gameLoadingStart: record("gameLoadingStart"),
    gameLoadingFinished: record("gameLoadingFinished"),
    gameplayStart: record("gameplayStart"),
    gameplayStop: record("gameplayStop"),
    commercialBreak: () => Promise.resolve(),
    rewardedBreak: () => Promise.resolve(false),
    getURLParam: () => "",
    getUser: () => ({}),
    happytime: record("happytime"),
    setPlayerAge: record("setPlayerAge"),
    setPlayerGender: record("setPlayerGender"),
  };
})();
`;

async function main() {
  if (!existsSync(path.join(ROOT, "index.html"))) {
    console.error("poki-upload/index.html missing — run pnpm build:poki first");
    process.exit(1);
  }
  const server = await serveArtifact();
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: VIEW,
  });
  await context.addInitScript(SDK_STUB);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/", { waitUntil: "commit" });
  await page.waitForSelector("#boot-shell", { state: "detached", timeout: 30000 });
  // Boot is async on swiftshader: wait up to a minute for the menu, handling
  // the name plate whenever it appears.
  const play = page.locator('button[aria-label="Play free flight now"]');
  for (let waited = 0; !(await play.isVisible().catch(() => false)); waited += 1000) {
    if (waited > 60000) throw new Error("menu never appeared");
    const plate = page.locator('[data-action="confirm-pilot-name"]');
    if (await plate.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Random name", exact: true }).click().catch(() => {});
      await plate.click().catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  await play.click();
  await page.locator('[data-action="pause"]').waitFor({ timeout: 20000 });

  // Scripted flight: dive → glide → dive, so the loop shows real movement.
  const surface = page.locator("canvas").first();
  const box = await surface.boundingBox();
  const px = box.x + box.width * 0.6;
  const py = box.y + box.height * 0.55;
  const flap = async (hold) => {
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.waitForTimeout(hold);
    await page.mouse.up();
  };
  const frames = [];
  const stopAt = Date.now() + CAPTURE_MS;
  const started = Date.now();
  let i = 0;
  while (Date.now() < stopAt) {
    // One flight gesture between frames keeps the bird arcing naturally.
    await flap(i % 2 === 0 ? 420 : 200);
    const buf = await page.screenshot({ type: "png", clip: CLIP, animations: "disabled" });
    frames.push(buf);
    i++;
    if (i <= 3) console.log(`frame ${i} at ${Date.now() - started} ms`);
  }

  await context.close();
  await browser.close();
  server.close();

  if (errors.length) {
    console.error("page errors during capture:", errors.slice(0, 3));
    process.exit(1);
  }

  // Encode the frames into a quantized 256-colour animated GIF.
  const gif = GIFEncoder();
  for (const png of frames) {
    const { width, height, data } = decodePng(png);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay: FRAME_MS });
  }
  gif.finish();
  mkdirSync(OUT, { recursive: true });
  const gifPath = path.join(OUT, "sunbird-thumbnail-animated.gif");
  await writeFile(gifPath, Buffer.from(gif.bytes()));
  console.log(`✓ ${frames.length} frames → ${path.relative(process.cwd(), gifPath)} (${(statSync(gifPath).size / 1024).toFixed(0)} KB)`);
}

/** Minimal PNG decode via the canvas-free route: reuse Playwright's own chromium
 * through an offscreen data URL would be heavier than a tiny decoder — so we
 * shell out to the pure-JS decoder bundled with the browser tooling instead. */
import { execFileSync } from "node:child_process";
function decodePng(buf) {
  // Use ImageMagick if present; otherwise fall back to the pngjs-free decoder
  // below (raw RGBA via node's zlib on the IDAT stream).
  try {
    execFileSync("magick", ["-version"], { stdio: "ignore" });
    const raw = execFileSync("magick", ["png:-", "-depth", "8", "rgba:-"], { input: buf, maxBuffer: 64 * 1024 * 1024 });
    const info = execFileSync("magick", ["identify", "-format", "%w %h", "png:-"], { input: buf }).toString().trim().split(" ");
    return { width: Number(info[0]), height: Number(info[1]), data: new Uint8Array(raw) };
  } catch {
    return decodePngPure(buf);
  }
}

import { inflateSync } from "node:zlib";
function decodePngPure(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error("unsupported png format");
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    line.set(raw.subarray(p, p + stride)); p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 1: v = (v + a) & 255; break;
        case 2: v = (v + b) & 255; break;
        case 3: v = (v + ((a + b) >> 1)) & 255; break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
          break;
        }
        default: break;
      }
      line[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = line[x * channels];
      out[o + 1] = line[x * channels + 1];
      out[o + 2] = line[x * channels + 2];
      out[o + 3] = channels === 4 ? line[x * channels + 3] : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out };
}

main().catch((err) => { console.error(err); process.exit(1); });
