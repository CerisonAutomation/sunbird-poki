export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function saturate(v: number): number {
  return clamp(v, 0, 1);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function hash01(i: number, seed: number): number {
  let n = Math.imul(i ^ seed, 1597334677);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  return (n >>> 0) / 4294967296;
}

export function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash01(i, seed), hash01(i + 1, seed), u);
}

export function fbm(x: number, seed: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export class SeededRandom {
  private s: number;

  constructor(seed: string | number) {
    if (typeof seed === "number") {
      this.s = seed >>> 0 || 1;
    } else {
      let h = 2166136261;
      for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      this.s = h >>> 0 || 1;
    }
  }

  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b));
  }

  get seed(): number {
    return this.s;
  }
}

export function dateSeed(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDatePretty(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  // A malformed date must round-trip untouched rather than render a month
  // that is `undefined` (e.g. "2026-13-05" → "undefined 5, 2026").
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  if (m < 1 || m > 12 || d < 1 || d > 31) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}

export function formatDistance(m: number): string {
  // A corrupted/negative distance must never render as "-123 m" or "NaN m"
  // in the HUD — clamp to a non-negative, finite value first.
  const d = Number.isFinite(m) ? Math.max(0, m) : 0;
  if (d >= 1000) return `${(d / 1000).toFixed(2)} km`;
  return `${Math.floor(d)} m`;
}

/**
 * Truncate `str` to at most `max` Unicode code points without splitting a
 * surrogate pair. `String.prototype.slice` counts UTF-16 code units, so a
 * name containing an emoji (or any astral-plane character) sliced at the
 * wrong boundary emits a lone surrogate — a corrupt string that renders as
 * the replacement glyph �. Iterating code points avoids that entirely.
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  let out = "";
  let n = 0;
  for (const ch of str) {
    if (n >= max) break;
    out += ch;
    n++;
  }
  return out;
}
