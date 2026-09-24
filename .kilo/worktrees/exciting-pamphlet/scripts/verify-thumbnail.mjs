#!/usr/bin/env node
/**
 * Thumbnail gate — Poki thumbnail rules THB-05…THB-08 and THB-10.
 *
 * The guide's requirements are visual, but every one of them reduces to a
 * measurement that a machine can take, so they are checked here rather than
 * trusted:
 *
 *   THB-05  square, ≥ 628 × 628, actually full-bleed (no letterboxing, no
 *           transparent margin).
 *   THB-06  no baked rounded corners: the corner regions must be painted with
 *           opaque artwork, because the platform applies its own mask.
 *   THB-07  the subject survives being scaled down — the composition is
 *           re-measured at 128 px (the smallest tile size) and must keep a real
 *           luminance spread there.
 *   THB-08  high contrast, and no dominant colour sitting close to the Poki
 *           Playground background (#83FFE7) — a green-on-green thumbnail
 *           disappears into the page.
 *   THB-10  sane delivered weight (the Inspector warns about heavy images).
 *
 * Usage: node scripts/verify-thumbnail.mjs [--json]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, downscale } from "./png.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");

/** Deliverables: the master art plus the spec-minimum derivative. */
const THUMBNAILS = [
  "assets/submission/sunbird-thumbnail-1024.png",
  "assets/submission/sunbird-thumbnail-628.png",
];

const PLAYGROUND = { r: 0x83, g: 0xff, b: 0xe7 };
const MAX_BYTES = 2_600_000;
const MIN_EDGE = 628;

const failures = [];
const notes = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);
const note = (msg) => notes.push(msg);

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function stats(image) {
  const { width, height, channels, data } = image;
  const hist = new Array(256).fill(0);
  const buckets = new Map();
  let sum = 0;
  let count = 0;
  let transparent = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = channels === 4 ? data[idx + 3] : 255;
      if (a < 8) transparent += 1;
      const l = luminance(r, g, b);
      hist[Math.max(0, Math.min(255, Math.round(l)))] += 1;
      sum += l;
      count += 1;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const percentile = (p) => {
    const target = count * p;
    let seen = 0;
    for (let i = 0; i < 256; i += 1) {
      seen += hist[i];
      if (seen >= target) return i;
    }
    return 255;
  };
  let dominant = { n: 0, r: 0, g: 0, b: 0 };
  for (const bucket of buckets.values()) if (bucket.n > dominant.n) dominant = bucket;
  const variance =
    [...hist.entries()].reduce((acc, [l, n]) => acc + n * (l - sum / count) ** 2, 0) / count;
  return {
    mean: sum / count,
    std: Math.sqrt(variance),
    p05: percentile(0.05),
    p95: percentile(0.95),
    transparent,
    dominant: { r: dominant.r / dominant.n, g: dominant.g / dominant.n, b: dominant.b / dominant.n },
  };
}

function cornerContent(image) {
  const { width, height, channels, data } = image;
  const size = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const corners = [
    [0, 0],
    [width - size, 0],
    [0, height - size],
    [width - size, height - size],
  ];
  let minAlpha = 255;
  let variance = 0;
  for (const [cx, cy] of corners) {
    const lum = [];
    for (let y = cy; y < cy + size; y += 1) {
      for (let x = cx; x < cx + size; x += 1) {
        const idx = (y * width + x) * channels;
        if (channels === 4) minAlpha = Math.min(minAlpha, data[idx + 3]);
        lum.push(luminance(data[idx], data[idx + 1], data[idx + 2]));
      }
    }
    const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
    variance += lum.reduce((acc, l) => acc + (l - mean) ** 2, 0) / lum.length;
  }
  return { minAlpha, variance: variance / corners.length };
}

for (const file of THUMBNAILS) {
  const path = join(root, file);
  if (!existsSync(path)) {
    fail(file, "missing — the submission needs a static thumbnail (THB-05).");
    continue;
  }
  const bytes = statSync(path).size;
  if (bytes > MAX_BYTES) fail(file, `is ${(bytes / 1e6).toFixed(2)} MB — heavy images trigger the Inspector warning (THB-10).`);

  let image;
  try {
    image = decodePng(readFileSync(path));
  } catch (error) {
    fail(file, `could not be decoded: ${error.message}`);
    continue;
  }

  if (image.width !== image.height) fail(file, `is ${image.width}×${image.height} — the platform requires a square image (THB-05).`);
  if (image.width < MIN_EDGE) fail(file, `is ${image.width}px — below the ${MIN_EDGE}px minimum (THB-05).`);

  const s = stats(image);
  const fractionTransparent = s.transparent / (image.width * image.height);
  if (fractionTransparent > 0.001) {
    fail(file, `${(fractionTransparent * 100).toFixed(1)} % of pixels are transparent — thumbnails must be full-bleed (THB-05).`);
  }

  // THB-08: contrast + distance from the playground background.
  const spread = s.p95 - s.p05;
  if (spread < 60) fail(file, `luminance spread is ${spread} (needs ≥ 60) — low-contrast thumbnails do not stand out (THB-08).`);
  const distance = Math.hypot(s.dominant.r - PLAYGROUND.r, s.dominant.g - PLAYGROUND.g, s.dominant.b - PLAYGROUND.b);
  if (distance < 90) {
    fail(
      file,
      `dominant colour rgb(${s.dominant.r.toFixed(0)}, ${s.dominant.g.toFixed(0)}, ${s.dominant.b.toFixed(0)}) is within ${distance.toFixed(0)} of the Poki playground #83FFE7 — it would blend into the page (THB-08).`,
    );
  }

  // THB-06: corners painted, so the platform's rounded mask has artwork to cut.
  const corner = cornerContent(image);
  if (corner.minAlpha < 255) fail(file, "corner pixels are not fully opaque — corners must be full-bleed for the platform mask (THB-06).");
  if (corner.variance < 1) fail(file, "corner regions are perfectly flat — check for letterboxing or a baked border (THB-06).");

  // THB-07: the composition must still read at the smallest tile size.
  const small = downscale(image, 128, 128);
  const smallStats = stats(small);
  if (smallStats.p95 - smallStats.p05 < 55) {
    fail(file, `contrast collapses at 128px (spread ${smallStats.p95 - smallStats.p05}) — the subject is not legible at tile size (THB-07).`);
  }

  note(
    `${file} — ${image.width}×${image.height}, ${(bytes / 1024).toFixed(0)} KB, luminance spread ${spread}, 128px spread ${smallStats.p95 - smallStats.p05}, dominant-distance ${distance.toFixed(0)}`,
  );
}

if (failures.length) {
  console.error(`\n❌ THUMBNAIL GATE FAILED\n${failures.map((f) => `  • ${f}`).join("\n")}\n`);
  process.exit(1);
}

console.log("✓ THB gate passed");
for (const n of notes) console.log(`  • ${n}`);
console.log("\nThumbnail spec (Poki 06-thumbnail.md): square, ≥628px, full-bleed, no baked corners,");
console.log("high contrast, not close to #83FFE7, legible at tile size, sane weight.\n");
