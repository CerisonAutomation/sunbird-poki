/**
 * Procedurally renders the app icons (no external assets, no AI images):
 *   public/icons/icon-192.png, icon-512.png, apple-touch-icon.png,
 *   favicon-32.png, favicon-64.png
 *   promo/animated/sunbird-animated.gif — Poki-style animated tile icon
 * Run: node scripts/gen-icons.mjs
 *
 * Design: golden-hour sky, huge low sun half-set behind layered hills,
 * and the sunbird mid-DIVE (the game's core verb) with a comet trail —
 * big silhouette, high contrast, readable at 32px. The animated icon
 * shows the bird banking around the sun in a 24-frame loop with flapping
 * wings, matching the static icon's palette and pose.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const SS = 4; // supersample factor for antialiasing

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Paints one square icon at `size` px and returns RGBA. */
function paint(size, { rounded = true } = {}) {
  const S = size * SS;
  const small = size <= 64; // favicons: zoom on the bird, drop fine detail
  const px = new Uint8ClampedArray(S * S * 4);

  const set = (x, y, r, g, b, a = 1) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    px[i] = px[i] * (1 - a) + r * a;
    px[i + 1] = px[i + 1] * (1 - a) + g * a;
    px[i + 2] = px[i + 2] * (1 - a) + b * a;
    px[i + 3] = 255;
  };

  /** Filled rotated ellipse. */
  const disc = (cx, cy, rx, ry, col, rot = 0, alpha = 1) => {
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    const R = Math.hypot(rx, ry) + 2;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) {
      for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const u = dx * c - dy * s;
        const v = dx * s + dy * c;
        if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) set(x, y, col[0], col[1], col[2], alpha);
      }
    }
  };

  /** Filled convex polygon via scanline. */
  const poly = (pts, col, alpha = 1) => {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(S - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay === by) continue;
        if (y >= Math.min(ay, by) && y < Math.max(ay, by)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.floor(xs[k])); x <= Math.min(S - 1, Math.ceil(xs[k + 1])); x++) {
          set(x, y, col[0], col[1], col[2], alpha);
        }
      }
    }
  };

  /* ---------- sky: golden-hour gradient with warm glow around the sun ---------- */
  const sunX = small ? S * 0.74 : S * 0.68;
  const sunY = small ? S * 0.80 : S * 0.72;
  const top = [58, 96, 168]; // deep dusk blue
  const mid = [214, 116, 106]; // rose
  const low = [255, 176, 84]; // amber horizon
  for (let y = 0; y < S; y++) {
    const t = y / S;
    const base = t < 0.45 ? mix(top, mid, t / 0.45) : mix(mid, low, (t - 0.45) / 0.55);
    for (let x = 0; x < S; x++) {
      // warm radial glow toward the sun
      const d = Math.hypot(x - sunX, y - sunY) / S;
      const glow = Math.max(0, 1 - d * 1.5);
      const c = mix(base, [255, 226, 150], glow * glow * 0.75);
      set(x, y, c[0], c[1], c[2]);
    }
  }

  /* ---------- sun: huge disc, half-sunk behind the hills ---------- */
  disc(sunX, sunY, S * 0.30, S * 0.30, [255, 244, 196]);
  disc(sunX, sunY, S * 0.255, S * 0.255, [255, 250, 224]);

  /* ---------- hills: three layers, back-lit rims ---------- */
  const hill = (baseY, amp, freq, phase, col, rim) => {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const h = S * (baseY + Math.sin(u * freq + phase) * amp - Math.cos(u * freq * 0.53 + phase * 1.7) * amp * 0.6);
      for (let y = Math.max(0, Math.floor(h)); y < S; y++) set(x, y, col[0], col[1], col[2]);
      // sunlit rim on the crest
      for (let y = Math.max(0, Math.floor(h)); y < Math.min(S, h + S * 0.008); y++) set(x, y, rim[0], rim[1], rim[2], 0.85);
    }
  };
  if (!small) {
    hill(0.78, 0.045, 5.1, 1.1, [122, 84, 112], [255, 196, 130]); // far ridge, dusk purple
    hill(0.86, 0.05, 3.7, 3.9, [66, 116, 92], [255, 214, 140]); // mid green
    hill(0.94, 0.04, 4.6, 0.4, [38, 84, 74], [225, 176, 120]); // near dark green
  } else {
    hill(0.88, 0.05, 3.7, 3.9, [52, 104, 84], [255, 214, 140]); // one green ridge
  }

  /* ---------- comet trail behind the diving bird ---------- */
  const bx = small ? S * 0.46 : S * 0.38;
  const by = small ? S * 0.46 : S * 0.42;
  const DIVE = 0.62; // radians, nose-down to the right
  const BSC = small ? 1.65 : 1; // favicon: bird fills the frame
  const back = [-Math.cos(DIVE), -Math.sin(DIVE)];
  for (let i = 0; i < (small ? 0 : 30); i++) {
    const t = i / 30;
    const d = S * (0.10 + t * 0.42);
    const r = S * 0.065 * (1 - t) + S * 0.006;
    const col = mix([255, 244, 196], [255, 150, 80], t);
    disc(bx + back[0] * d, by + back[1] * d - S * 0.016 * t, r, r * 0.8, col, DIVE, 0.8 * (1 - t) + 0.1);
  }

  /* ---------- the sunbird, diving ---------- */
  const rot = DIVE;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const P = (u, v) => [bx + (u * cs - v * sn) * BSC, by + (u * sn + v * cs) * BSC]; // local -> screen

  // tail feathers (behind body)
  poly([P(-S * 0.20, -S * 0.012), P(-S * 0.335, -S * 0.062), P(-S * 0.315, S * 0.012), P(-S * 0.19, S * 0.03)], [216, 88, 44]);
  poly([P(-S * 0.20, 0), P(-S * 0.345, S * 0.012), P(-S * 0.30, S * 0.062), P(-S * 0.18, S * 0.042)], [190, 72, 36]);

  // body: streamlined teardrop
  disc(...P(0, 0), S * 0.185 * BSC, S * 0.115 * BSC, [255, 122, 69], rot);
  disc(...P(S * 0.03, S * 0.012), S * 0.16 * BSC, S * 0.096 * BSC, [255, 138, 84], rot);
  // belly crescent
  disc(...P(S * 0.028, S * 0.052), S * 0.125 * BSC, S * 0.052 * BSC, [255, 232, 196], rot);

  // far wing (tucked, dark)
  poly([P(-S * 0.03, -S * 0.05), P(-S * 0.20, -S * 0.155), P(-S * 0.055, -S * 0.115), P(S * 0.03, -S * 0.06)], [198, 82, 40]);
  // near wing: swept back hard for the dive
  poly([P(0.0, -S * 0.035), P(-S * 0.235, -S * 0.20), P(-S * 0.10, -S * 0.075), P(S * 0.06, -S * 0.038)], [255, 168, 110]);
  poly([P(-S * 0.02, -S * 0.045), P(-S * 0.185, -S * 0.165), P(-S * 0.085, -S * 0.07)], [255, 196, 150]);

  // head + beak (open, determined)
  disc(...P(S * 0.155, -S * 0.028), S * 0.075 * BSC, S * 0.068 * BSC, [255, 138, 84], rot);
  poly([P(S * 0.21, -S * 0.045), P(S * 0.30, -S * 0.014), P(S * 0.205, 0.0)], [255, 200, 76]);
  poly([P(S * 0.205, S * 0.006), P(S * 0.283, S * 0.02), P(S * 0.2, S * 0.028)], [235, 168, 52]);

  // eye: big white + pupil + glint
  disc(...P(S * 0.158, -S * 0.043), S * 0.036 * BSC, S * 0.036 * BSC, [255, 252, 248], rot);
  disc(...P(S * 0.168, -S * 0.04), S * 0.018 * BSC, S * 0.018 * BSC, [40, 26, 40], rot);
  disc(...P(S * 0.174, -S * 0.048), S * 0.007 * BSC, S * 0.007 * BSC, [255, 255, 255], rot);

  // brow ridge for attitude
  poly([P(S * 0.105, -S * 0.085), P(S * 0.20, -S * 0.075), P(S * 0.195, -S * 0.062), P(S * 0.11, -S * 0.068)], [216, 88, 44]);

  /* ---------- wind speed ticks (top-left, suggesting velocity) ---------- */
  for (const [u0, v0, len] of small ? [] : [
    [0.10, 0.16, 0.10],
    [0.06, 0.24, 0.14],
    [0.13, 0.30, 0.08],
  ]) {
    const x0 = S * u0;
    const y0 = S * v0;
    for (let i = 0; i < S * len; i++) {
      const x = x0 + i * Math.cos(DIVE);
      const y = y0 + i * Math.sin(DIVE);
      const a = 0.5 * (1 - i / (S * len));
      set(x, y, 255, 246, 220, a);
      set(x, y + 1, 255, 246, 220, a * 0.7);
    }
  }

  /* ---------- rounded-corner mask + soft vignette ---------- */
  const out = new Uint8ClampedArray(size * size * 4);
  const rad = rounded ? size * 0.20 : 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const k = ((y * SS + j) * S + (x * SS + i)) * 4;
          r += px[k];
          g += px[k + 1];
          b += px[k + 2];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      let R = r / n;
      let G = g / n;
      let B = b / n;
      // vignette: gently darken corners so the icon reads as one object
      const dx = x / size - 0.5;
      const dy = y / size - 0.5;
      const vig = 1 - Math.max(0, Math.hypot(dx, dy) - 0.42) * 0.9;
      R *= vig;
      G *= vig;
      B *= vig;
      // rounded corners (alpha)
      let alpha = 255;
      if (rad > 0) {
        const cx = Math.min(x, size - 1 - x);
        const cy = Math.min(y, size - 1 - y);
        if (cx < rad && cy < rad) {
          const d = Math.hypot(rad - cx, rad - cy);
          if (d > rad) alpha = Math.max(0, 255 - (d - rad) * 255);
        }
      }
      out[o] = Math.round(R);
      out[o + 1] = Math.round(G);
      out[o + 2] = Math.round(B);
      out[o + 3] = alpha;
    }
  }
  return out;
}

/* ---------- PNG encoding ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4 * rgba.BYTES_PER_ELEMENT, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, size, opts] of [
  ["icon-192.png", 192, { rounded: true }],
  ["icon-512.png", 512, { rounded: true }],
  ["apple-touch-icon.png", 180, { rounded: false }], // iOS masks its own corners
  ["favicon-32.png", 32, { rounded: true }],
  ["favicon-64.png", 64, { rounded: true }],
]) {
  const buf = encodePng(size, paint(size, opts));
  writeFileSync(join(outDir, name), buf);
  console.log(`${name}: ${size}x${size} · ${(buf.length / 1024).toFixed(1)} KB`);
}

console.log("---");

// Generate the animated icon (Poki-style animated tile).
// Prefers real gameplay footage if it exists; falls back to the procedural
// placeholder (gen-animated-icon.mjs) otherwise.
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
const animatedDir = join(__dirname, "..", "promo", "animated");
const webpPath = join(animatedDir, "sunbird-animated.webp");
const hasGameCapture = existsSync(webpPath) && statSync(webpPath).size > 100000;

if (!hasGameCapture) {
  try {
    execSync("node scripts/gen-animated-icon.mjs", { stdio: "inherit", cwd: join(__dirname, "..") });
  } catch {
    console.warn("Animated icon generation skipped (ImageMagick convert required).");
  }
} else {
  console.log("Animated icons: real gameplay footage already present — skipping placeholder generation");
}
