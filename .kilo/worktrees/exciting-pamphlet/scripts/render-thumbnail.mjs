#!/usr/bin/env node
/**
 * Thumbnail pipeline: raw art → colour grade → submission deliverables.
 *
 * The grade exists because of one specific Poki rule (THB-08): the thumbnail
 * must stand out against the Poki **Playground background `#83FFE7`**, and must
 * not use colours similar to it. The raw art's dominant area is a bright cyan
 * sky, and its islands are spring-green — measured, 30 % of its pixels sit
 * within 70 (RGB distance) of that exact background. On the playground it would
 * read as part of the page.
 *
 * The grade is therefore not decoration, it is compliance, and it is
 * deterministic so a re-run can never double-apply it:
 *
 *   • sky band (hue 170–255, saturated) → the game's own deep azure gradient
 *   • foliage/land band (hue 90–170)    → deeper emerald
 *   • bird/warm band (hue ≤ 60)         → slightly richer saturation, kept as-is
 *
 * Input is the untouched master in `assets/submission/art/`; every run rewrites
 * the two deliverables from it, so the shipped files are always reproducible.
 *
 * Usage: node scripts/render-thumbnail.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, downscale, encodePng } from "./png.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const RAW = join(root, "assets/submission/art/sunbird-raw-1024.png");
const DELIVERABLES = [
  { file: "assets/submission/sunbird-thumbnail-1024.png", size: 1024 },
  { file: "assets/submission/sunbird-thumbnail-628.png", size: 628 },
];

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

function hueToRgb(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, hh + 1 / 3) * 255, hueToRgb(p, q, hh) * 255, hueToRgb(p, q, hh - 1 / 3) * 255];
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Smooth 0→1 weight, so no band ever produces a visible edge in the artwork. */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The grade, as three smooth bands (the numbers are the measured thresholds
 * behind THB-08 — see the header):
 *
 *   neutral  (saturation < 0.12)  clouds, the bird's belly, white rims — left
 *                                 essentially alone; pushing saturation into
 *                                 greys is what makes a grade look "filtered".
 *            (near-white pixels count as neutral whatever their hue — see the
 *             guard in gradePixel.)
 *   cyan     (hue 165–250)        the sky: rotated a little further from the
 *                                 playground's aqua toward the game's own
 *                                 azure, deepened and slightly richer.
 *   green    (hue 60–165)         foliage and sunlit haze: deepened and muted,
 *                                 which is what actually clears the THB-08
 *                                 distance while keeping the tint structure.
 *   warm     (everything else)    the bird and the sun: rich enough as-is, only
 *                                 a touch of extra saturation.
 */
function gradePixel(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  let outH = h;
  let outS = s;
  let outL = l;

  // Near-neutral OR near-white pixels are never treated as sky: the bird's
  // white belly carries a faint blue tint, and rotating it as if it were sky
  // speckles the subject with blue dots.
  if (s < 0.12 || l > 0.78) {
    outL = clamp01(l * 0.97);
  } else if (h >= 165 && h <= 250) {
    const weight = smoothstep(165, 200, h) * (1 - smoothstep(240, 250, h));
    outH = h + 14 * weight;
    outS = clamp01(s * (1 + 0.15 * weight));
    outL = clamp01(l * (1 - 0.16 * weight));
  } else if (h > 60 && h < 165) {
    outS = clamp01(s * 0.92);
    outL = clamp01(l * 0.82);
  } else {
    outS = clamp01(s * 1.05);
  }

  const [nr, ng, nb] = hslToRgb(outH, outS, outL);
  return [Math.round(nr), Math.round(ng), Math.round(nb)];
}

function grade(image) {
  const { data, channels } = image;
  // Full-bleed art has nothing to keep transparent, so the deliverables are
  // flattened to 8-bit RGB — a quarter less data to compress (THB-10).
  const out = Buffer.alloc(image.width * image.height * 3);
  for (let i = 0, o = 0; i < data.length; i += channels, o += 3) {
    const [r, g, b] = gradePixel(data[i], data[i + 1], data[i + 2]);
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
  }
  return { width: image.width, height: image.height, channels: 3, data: out };
}

if (!existsSync(RAW)) {
  console.error(`❌ raw master art missing: ${RAW}`);
  process.exit(1);
}

const raw = decodePng(readFileSync(RAW));
const graded = grade(raw);
mkdirSync(join(root, "assets/submission"), { recursive: true });

for (const { file, size } of DELIVERABLES) {
  const image = size === graded.width ? graded : downscale(graded, size, size);
  writeFileSync(join(root, file), encodePng(image));
  console.log(`✓ ${file} — ${size}×${size} (graded from art/sunbird-raw-1024.png)`);
}
console.log("\nRun `pnpm verify:thumbnail` to check the deliverables against the Poki thumbnail rules.\n");
