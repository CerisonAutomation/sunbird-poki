/**
 * Animated game icon generator for portal submission (Poki-style animated tile).
 *
 * Poki.com game cards show a subtle looped animation on each tile. This script
 * renders a 512×512 GIF showing the sunbird banking around the sun in a slow
 * orbit with flapping wings and a comet trail — matching the visual identity
 * of the static icon from gen-icons.mjs.
 *
 * Approach: render each frame as PNG using the proven png.mjs encoder
 * (adaptive filtering, same pipeline as the thumbnail gate), then assemble the
 * animated GIF with ImageMagick `convert`. This reuses the exact same rendering
 * geometry as the static icon generator.
 *
 * Output:
 *   promo/animated/sunbird-animated.gif   (512×512, 24 frames, ~12 FPS, looping)
 *   promo/animated/sunbird-animated.webp  (if ffmpeg is available)
 *   promo/animated/sunbird-animated-256.gif, -128.gif  (smaller variants)
 *
 * Usage: node scripts/gen-animated-icon.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, unlinkSync, readdirSync, rmdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { encodePng } from "./png.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "promo", "animated");
const framesDir = join(outDir, "_frames");
mkdirSync(framesDir, { recursive: true });

const SIZE = 512;

/* ── Sunbird shape constants (mirrors src/game/Sunbird.ts) ── */

const P = {
  body:    [255, 122, 69],
  belly:   [255, 230, 196],
  wingNear:[255, 154, 98],
  wingFar: [200, 82, 40],
  tail:    [224, 106, 53],
  tailTip: [190, 72, 36],
  brow:    [216, 74, 46],
  beak:    [255, 176, 32],
  eye:     [42, 28, 40],
  eyeWhite:[255, 255, 255],
};

const FLAP_NEUTRAL = 0.45;
const HERO_UNITS = 64;
const BODY_CX = 30, BODY_CY = 36;

// Sky gradient stops
const SKY_TOP  = [58, 96, 168];
const SKY_MID  = [214, 116, 106];
const SKY_LOW  = [255, 176, 84];
const SUN_CORE = [255, 243, 196];
const SUN_MID  = [255, 209, 102];
const SUN_EDGE = [255, 122, 48];

// Hills
const HILLS = [
  { baseY: 0.78, amp: 0.045, freq: 5.1, phase: 1.1, col: [122, 84, 112], rim: [255, 196, 130] },
  { baseY: 0.86, amp: 0.05,  freq: 3.7, phase: 3.9, col: [66, 116, 92],  rim: [255, 214, 140] },
  { baseY: 0.94, amp: 0.04,  freq: 4.6, phase: 0.4, col: [38, 84, 74],   rim: [225, 176, 120] },
];

/* ── Pixel buffer helpers ── */

function blank() {
  return Buffer.alloc(SIZE * SIZE * 4, 0);
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function lerpColor(a, b, t) {
  return lerp(a, b, t).map(Math.round);
}

/** Transform hero-unit point to screen pixels: scale, rotate, translate */
function tp(u, v, scale, angle, tx, ty) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [u * scale * c - v * scale * s + tx, u * scale * s + v * scale * c + ty];
}

/** Draw the sky gradient */
function drawSky(px) {
  const sunX = SIZE * 0.30;
  const sunY = SIZE * 0.72;
  for (let y = 0; y < SIZE; y++) {
    const t = y / SIZE;
    const base = t < 0.45 ? lerp(SKY_TOP, SKY_MID, t / 0.45) : lerp(SKY_MID, SKY_LOW, (t - 0.45) / 0.55);
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - sunX, y - sunY) / SIZE;
      const glow = Math.max(0, 1 - d * 1.5);
      const c = lerp(base, [255, 226, 150], glow * glow * 0.75);
      const i = (y * SIZE + x) * 4;
      px[i] = Math.round(c[0]);
      px[i + 1] = Math.round(c[1]);
      px[i + 2] = Math.round(c[2]);
      px[i + 3] = 255;
    }
  }
}

/** Draw a filled ellipse */
function fillEllipse(px, cx, cy, rx, ry, color) {
  const r2x = rx * rx, r2y = ry * ry;
  const [r, g, b] = color;
  for (let y = Math.max(0, cy - ry - 1); y <= Math.min(SIZE - 1, cy + ry + 1); y++) {
    for (let x = Math.max(0, cx - rx - 1); x <= Math.min(SIZE - 1, cx + rx + 1); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx / r2x + dy * dy / r2y <= 1) {
        const i = (y * SIZE + x) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }
  }
}

/** Draw a filled circle */
function fillCircle(px, cx, cy, rad, color) {
  fillEllipse(px, cx, cy, rad, rad, color);
}

/** Fill a polygon via scanline */
function fillPoly(px, color, pts) {
  const [r, g, b] = color;
  const ys = pts.map(p => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if (ay === by) continue;
      if (y >= Math.min(ay, by) && y < Math.max(ay, by))
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.floor(xs[k]));
      const x1 = Math.min(SIZE - 1, Math.ceil(xs[k + 1]));
      for (let x = x0; x <= x1; x++) {
        const i = (y * SIZE + x) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }
  }
}

/** Draw the sun with radial gradient */
function drawSun(px, cx, cy, radius) {
  const stops = [[0, SUN_CORE], [0.45, SUN_MID], [0.78, [255, 154, 58]], [1, SUN_EDGE]];
  for (let r = radius; r >= 0; r--) {
    const t = r / radius;
    const color = getColorAt(stops, t);
    for (let y = Math.max(0, cy - r - 1); y <= Math.min(SIZE - 1, cy + r + 1); y++) {
      for (let x = Math.max(0, cx - r - 1); x <= Math.min(SIZE - 1, cx + r + 1); x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= r && dist < r + 1) {
          const i = (y * SIZE + x) * 4;
          px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2]; px[i + 3] = 255;
        }
      }
    }
  }
}

function getColorAt(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      const lt = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return lerpColor(stops[i][1], stops[i + 1][1], lt);
    }
  }
  return stops[stops.length - 1][1];
}

/** Draw layered hills */
function drawHills(px) {
  for (const h of HILLS) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const height = SIZE * (h.baseY + Math.sin(u * h.freq + h.phase) * h.amp -
        Math.cos(u * h.freq * 0.53 + h.phase * 1.7) * h.amp * 0.6);
      for (let y = Math.max(0, Math.floor(height)); y < SIZE; y++) {
        const i = (y * SIZE + x) * 4;
        px[i] = h.col[0]; px[i + 1] = h.col[1]; px[i + 2] = h.col[2]; px[i + 3] = 255;
      }
      for (let y = Math.max(0, Math.floor(height)); y < Math.min(SIZE, height + SIZE * 0.008); y++) {
        const i = (y * SIZE + x) * 4;
        px[i] = Math.round(px[i] * 0.15 + h.rim[0] * 0.85);
        px[i + 1] = Math.round(px[i + 1] * 0.15 + h.rim[1] * 0.85);
        px[i + 2] = Math.round(px[i + 2] * 0.15 + h.rim[2] * 0.85);
      }
    }
  }
}

/** Draw the comet trail */
function drawTrail(px, points, scale) {
  for (let i = 0; i < points.length; i++) {
    const t = i / points.length;
    const width = scale * 0.065 * (1 - t) + scale * 0.006;
    const col = lerpColor([255, 244, 196], [255, 150, 80], t);
    fillCircle(px, points[i][0], points[i][1], width, col);
    fillCircle(px, points[i][0], points[i][1] + 1, width * 0.7, col);
  }
}

/** Sample a quadratic Bezier at t */
function quad(p0, c, p1, t) {
  const mt = 1 - t;
  return [mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0],
          mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1]];
}

/**
 * Draw the sunbird at (tx, ty) facing `angle`, with wing flap `flap`.
 * Geometry is identical to src/game/Sunbird.ts — the wings rotate about their
 * shoulder pivots by (flap - FLAP_NEUTRAL) * flapK.
 */
function drawSunbird(px, flap, scale, angle, tx, ty) {
  const flapFar  = (flap - FLAP_NEUTRAL) * (-0.85);
  const flapNear = (flap - FLAP_NEUTRAL) * (-1.05);

  // Transform hero units → screen: body center (BODY_CX, BODY_CY) maps to (tx, ty)
  const Tpt = (u, v) => tp(u, v, scale, angle, tx - BODY_CX * scale, ty - BODY_CY * scale);

  // Tail (behind body)
  fillPoly(px, P.tail, [Tpt(8, 42), Tpt(2, 34), Tpt(5, 44), Tpt(3, 50), Tpt(12, 45)]);

  // Tail tip
  fillPoly(px, P.tailTip, [Tpt(8, 44), Tpt(3, 50), Tpt(6, 54), Tpt(13, 48)]);

  // Body ellipse (centered at body center in hero space = (30, 36))
  fillEllipse(px, tx, ty, 17 * scale, 11 * scale, P.body);

  // Belly (offset (3, 4) in hero space)
  // Actually belly is relative to body center, so:
  const bx2 = tx + (3 * scale * Math.cos(angle) - 4 * scale * Math.sin(angle));
  const by2 = ty + (3 * scale * Math.sin(angle) + 4 * scale * Math.cos(angle));
  fillEllipse(px, bx2, by2, 11 * scale, 6 * scale, P.belly);

  // Far wing: pivot at (24, 28) in hero space
  const pivotFarScr = Tpt(24, 28);
  const wingFarAngle = angle + flapFar;
  // Wing path: M 24,26 → Q 14,12 6,16 → Q 14,22 24,30
  // Build polygon by sampling the Bezier curves relative to pivot
  const farWing = [];
  farWing.push([24, 26]); // start point
  for (let t = 0; t <= 1; t += 0.125) {
    farWing.push(quad([24, 26], [14, 12], [6, 16], t));
  }
  for (let t = 0.125; t <= 1; t += 0.125) {
    farWing.push(quad([6, 16], [14, 22], [24, 30], t));
  }
  // Transform each point: rotate about pivot, then translate
  const farWingScr = farWing.map(([u, v]) => {
    const dx = (u - 24) * scale;
    const dy = (v - 28) * scale;
    const c = Math.cos(wingFarAngle), s = Math.sin(wingFarAngle);
    return [pivotFarScr[0] + dx * c - dy * s, pivotFarScr[1] + dx * s + dy * c];
  });
  fillPoly(px, P.wingFar, farWingScr);

  // Near wing: pivot at (26, 32) in hero space
  const pivotNearScr = Tpt(26, 32);
  const wingNearAngle = angle + flapNear;
  // Wing path: M 26,30 → Q 14,14 6,20 → Q 15,24 27,34
  const nearWing = [];
  nearWing.push([26, 30]);
  for (let t = 0; t <= 1; t += 0.125) {
    nearWing.push(quad([26, 30], [14, 14], [6, 20], t));
  }
  for (let t = 0.125; t <= 1; t += 0.125) {
    nearWing.push(quad([6, 20], [15, 24], [27, 34], t));
  }
  const nearWingScr = nearWing.map(([u, v]) => {
    const dx = (u - 26) * scale;
    const dy = (v - 32) * scale;
    const c = Math.cos(wingNearAngle), s = Math.sin(wingNearAngle);
    return [pivotNearScr[0] + dx * c - dy * s, pivotNearScr[1] + dx * s + dy * c];
  });
  fillPoly(px, P.wingNear, nearWingScr);

  // Beak: M 46,34 L 58,37 L 46,40
  fillPoly(px, P.beak, [Tpt(46, 34), Tpt(58, 37), Tpt(46, 40)]);

  // Eye (only if bird is large enough)
  if (scale > 0.3) {
    const ew = Tpt(41, 32);
    fillCircle(px, ew[0], ew[1], 3.4 * scale, P.eyeWhite);
    const ep = Tpt(42.4, 31.4);
    fillCircle(px, ep[0], ep[1], 1.7 * scale, P.eye);
    const eg = Tpt(43, 30.8);
    fillCircle(px, eg[0], eg[1], 0.7 * scale, P.eyeWhite);
  }

  // Brow: M 36,27 Q 42,27.5 44,30 Q 40,29.6 37,29.4
  const brow = [Tpt(36, 27)];
  for (let t = 0; t <= 1; t += 0.25) {
    brow.push(quad([36, 27], [42, 27.5], [44, 30], t));
  }
  const browEnd = [];
  for (let t = 0.25; t <= 1; t += 0.25) {
    browEnd.push(quad([44, 30], [40, 29.6], [37, 29.4], t));
  }
  brow.push(...browEnd.slice(0, -1));
  const browScr = brow.map(([u, v]) => Tpt(u, v));
  fillPoly(px, P.brow, browScr);
}

/* ── Animation ── */

const NUM_FRAMES = 24;
const ORBIT_R = SIZE * 0.28;
const ORBIT_CX = SIZE * 0.5;
const ORBIT_CY = SIZE * 0.52;
const BIRD_SCALE = SIZE / HERO_UNITS * 1.1;

console.log("Animating sunbird icon...");

for (let f = 0; f < NUM_FRAMES; f++) {
  const px = blank();
  drawSky(px);
  drawHills(px);

  const sunX = SIZE * 0.30;
  const sunY = SIZE * 0.72;
  drawSun(px, sunX, sunY, SIZE * 0.18);

  const t = f / NUM_FRAMES;
  const orbitAngle = t * Math.PI * 2 - Math.PI / 2;
  const bx = ORBIT_CX + Math.cos(orbitAngle) * ORBIT_R;
  const by = ORBIT_CY + Math.sin(orbitAngle) * ORBIT_R;
  const birdAngle = orbitAngle + Math.PI / 2; // face tangentially (forward motion)

  // Wing flap: 2 full beats per orbit
  const flap = FLAP_NEUTRAL + Math.sin(t * Math.PI * 4) * 0.3;

  // Trail points (4 points trailing behind the bird)
  const trailPts = [];
  for (let i = 1; i <= 4; i++) {
    const tt = ((t - i * 0.05) % 1 + 1) % 1;
    const ta = tt * Math.PI * 2 - Math.PI / 2;
    trailPts.push([ORBIT_CX + Math.cos(ta) * ORBIT_R, ORBIT_CY + Math.sin(ta) * ORBIT_R]);
  }
  drawTrail(px, trailPts, BIRD_SCALE);

  // Draw the sunbird — body center at (bx, by)
  drawSunbird(px, flap, BIRD_SCALE, birdAngle, bx, by);

  // Encode frame as PNG
  const png = encodePng({ width: SIZE, height: SIZE, channels: 4, data: px });
  writeFileSync(join(framesDir, `frame_${String(f).padStart(2, "0")}.png`), png);
  if ((f + 1) % 6 === 0) console.log(`  frame ${f + 1}/${NUM_FRAMES}`);
}

console.log("Frames rendered. Assembling animated GIF...");

// Assemble GIF with ImageMagick
const frameFiles = [];
for (let f = 0; f < NUM_FRAMES; f++) {
  frameFiles.push(join(framesDir, `frame_${String(f).padStart(2, "0")}.png`));
}

const gifPath = join(outDir, "sunbird-animated.gif");
execSync(`convert -delay 8 -loop 0 ${frameFiles.map(f => `"${f}"`).join(" ")} "${gifPath}"`, { stdio: "pipe" });
const gifStat = readFileSync(gifPath);
console.log(`✅ sunbird-animated.gif: ${SIZE}×${SIZE}, ${NUM_FRAMES} frames, ${(gifStat.length / 1024).toFixed(1)} KB`);

// Try WebP with ffmpeg
const webpPath = join(outDir, "sunbird-animated.webp");
try {
  execSync(`ffmpeg -y -framerate 12 -i "${framesDir}/frame_%02d.png" -c:v libwebp -loop 0 -preset picture -q 85 "${webpPath}" 2>/dev/null`, { stdio: "pipe" });
  const wstat = readFileSync(webpPath);
  console.log(`✅ sunbird-animated.webp: ${SIZE}×${SIZE}, ${NUM_FRAMES} frames, ${(wstat.length / 1024).toFixed(1)} KB`);
} catch {
  console.log("⚠️  WebP skipped (ffmpeg/libwebp unavailable)");
}

// Generate smaller variants
for (const sz of [256, 128]) {
  const smallGif = join(outDir, `sunbird-animated-${sz}.gif`);
  execSync(`convert -resize ${sz}x${sz} "${gifPath}" "${smallGif}"`, { stdio: "pipe" });
  const s = readFileSync(smallGif);
  console.log(`✅ sunbird-animated-${sz}.gif: ${sz}×${sz}, ${(s.length / 1024).toFixed(1)} KB`);
}

// Clean up frame files
for (const f of readdirSync(framesDir)) {
  unlinkSync(join(framesDir, f));
}
rmdirSync(framesDir);

console.log("Done. Animated icons in promo/animated/");
