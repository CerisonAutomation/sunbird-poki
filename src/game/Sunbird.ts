/**
 * Sunbird — the one canonical bird, and the one canonical sun.
 *
 * WHY THIS FILE EXISTS
 * The title screen shows a hand-authored `.hero-bird` SVG perched on a sun
 * disc. That is the bird players recognise. Meanwhile the menu *background*
 * drew a different, simpler bird (six ellipses) for the distant flock, and the
 * race lobby drew a third thing entirely — three CSS ellipses called
 * `.vs-swatch`. Three birds, one game.
 *
 * So the title-screen bird became the single source of truth. Its exact path
 * data lives in `SUNBIRD_SHAPE` below, in the hero's own 64-unit space, and
 * two renderers walk that one table:
 *
 *   - `sunbirdSVG()`  — inline SVG, for DOM UI (title, lobby, duel, roster).
 *   - `drawSunbird()` — Canvas2D, for the animated menu flock.
 *
 * Both apply the same wing rotation about the same shoulder pivots, so a
 * flapping flock bird and a static lobby bird are the same animal at a
 * different moment in its wingbeat. At `FLAP_NEUTRAL` the rotation is exactly
 * zero and the output is the original hand-authored mark, path for path —
 * `sunbird.test.ts` pins that.
 */

/** Hero-bird colourway, read off the title screen. */
export type SunbirdPalette = {
  body: string;
  belly: string;
  wingNear: string;
  wingFar: string;
  tail: string;
  tailTip: string;
  brow: string;
  beak: string;
  eye: string;
  eyeWhite: string;
};

/** The title-screen sunbird. This is the reference every other bird derives from. */
export const SUNBIRD_PALETTE: SunbirdPalette = {
  body: "#ff7a45",
  belly: "#ffe6c4",
  wingNear: "#ff9a62",
  wingFar: "#c85228",
  tail: "#e06a35",
  tailTip: "#be4824",
  brow: "#d84a2e",
  beak: "#ffb020",
  eye: "#2a1c28",
  eyeWhite: "#ffffff",
};

/** Shift a whole palette toward a rival hue without touching the silhouette. */
function rival(body: string, belly: string, wingNear: string, wingFar: string, tail: string, tailTip: string, brow: string, beak: string, eye: string): SunbirdPalette {
  return { body, belly, wingNear, wingFar, tail, tailTip, brow, beak, eye, eyeWhite: "#ffffff" };
}

/**
 * Rival plumage. Same silhouette, different bird — so a full lobby reads as a
 * flock of sunbirds rather than a wall of one colour, and you can still find
 * yourself instantly.
 */
export const RIVAL_PALETTES: readonly SunbirdPalette[] = [
  rival("#5eb7ea", "#eaf6ff", "#83cbf2", "#31719e", "#3d8fc4", "#2b6791", "#2f7fb0", "#ffc24d", "#1d2b38"),
  rival("#7ad6a8", "#e8fff4", "#9fe6c4", "#3d8a67", "#4fae82", "#3a8763", "#459c75", "#ffd166", "#1c3227"),
  rival("#c39bf0", "#f4ecff", "#d8bcf7", "#7a52ab", "#9a72cc", "#7a55a8", "#8a63bd", "#ffbe5c", "#2a1f3d"),
  rival("#f0a0b8", "#fff0f4", "#f7bccd", "#ab5f79", "#cc7894", "#a85f78", "#bb6c86", "#ffc76b", "#3a1f2a"),
  rival("#ffd166", "#fff8e0", "#ffe09a", "#b3862f", "#d9a93f", "#b08a30", "#c4972f", "#ff9f45", "#3a2c10"),
  rival("#8a9bb0", "#e8eef4", "#a8b8c8", "#5b6a7d", "#68788c", "#53616f", "#5f6e80", "#c8b48a", "#232a33"),
];

/** Seeded (non-live) rivals: deliberately muted so real players pop. */
export const GREY_PALETTE: SunbirdPalette = RIVAL_PALETTES[5]!;

export function rivalPalette(index: number): SunbirdPalette {
  const list = RIVAL_PALETTES;
  return list[((index % list.length) + list.length) % list.length]!;
}

/* ------------------------------------------------------------------ shape */

/** Path commands in the hero's 64-unit space, shared by both renderers. */
type Cmd =
  | readonly ["M", number, number]
  | readonly ["L", number, number]
  | readonly ["Q", number, number, number, number]
  | readonly ["Z"];

type Ellipse = {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: keyof SunbirdPalette;
};

type Circle = { kind: "circle"; cx: number; cy: number; r: number; color: keyof SunbirdPalette };

type Path = {
  kind: "path";
  d: readonly Cmd[];
  color: keyof SunbirdPalette;
  /** Set on wings: rotate about this shoulder pivot as the flap phase moves. */
  pivot?: readonly [number, number];
  /** Radians of rotation per unit of (flap - FLAP_NEUTRAL). */
  flapK?: number;
};

type Part = Ellipse | Circle | Path;

/** The wingbeat phase at which the bird sits exactly as hand-drawn. */
export const FLAP_NEUTRAL = 0.45;

/** Below this rendered size the eye is dropped — it cannot be seen anyway. */
export const EYE_MIN_SIZE = 14;

/** Shoulder pivots and sweep, in hero units. */
const FAR_WING_PIVOT = [24, 28] as const;
const NEAR_WING_PIVOT = [26, 32] as const;

/**
 * Part order is the title screen's paint order, preserved exactly: tail and
 * tail-tip behind the body, far wing behind, near wing in front, brow on top.
 */
const SUNBIRD_SHAPE: readonly Part[] = [
  {
    kind: "path",
    color: "tail",
    d: [["M", 8, 42], ["L", 2, 34], ["L", 5, 44], ["L", 3, 50], ["L", 12, 45], ["Z"]],
  },
  {
    kind: "path",
    color: "tailTip",
    d: [["M", 8, 44], ["L", 3, 50], ["L", 6, 54], ["L", 13, 48], ["Z"]],
  },
  { kind: "ellipse", cx: 30, cy: 36, rx: 17, ry: 11, color: "body" },
  { kind: "ellipse", cx: 33, cy: 40, rx: 11, ry: 6, color: "belly" },
  {
    kind: "path",
    color: "wingFar",
    pivot: FAR_WING_PIVOT,
    flapK: -0.85,
    d: [["M", 24, 26], ["Q", 14, 12, 6, 16], ["Q", 14, 22, 24, 30], ["Z"]],
  },
  {
    kind: "path",
    color: "wingNear",
    pivot: NEAR_WING_PIVOT,
    flapK: -1.05,
    d: [["M", 26, 30], ["Q", 14, 14, 4, 20], ["Q", 15, 24, 27, 34], ["Z"]],
  },
  { kind: "path", color: "beak", d: [["M", 46, 34], ["L", 58, 37], ["L", 46, 40], ["Z"]] },
  { kind: "circle", cx: 41, cy: 32, r: 3.4, color: "eyeWhite" },
  { kind: "circle", cx: 42.4, cy: 31.4, r: 1.7, color: "eye" },
  { kind: "circle", cx: 43, cy: 30.8, r: 0.7, color: "eyeWhite" },
  {
    kind: "path",
    color: "brow",
    d: [["M", 36, 27], ["Q", 42, 27.5, 44, 30], ["Q", 40, 29.6, 37, 29.4], ["Z"]],
  },
];

/** Body centre, so canvas drawing can be centred on the origin. */
const CX = 30;
const CY = 36;
const UNITS = 64;

/** Tight viewBox with a little room for the wing sweep. */
export const SUNBIRD_VIEWBOX = "-6 -2 76 68";

const DEG = 180 / Math.PI;

function wingAngle(part: Part, flap: number): number {
  if (part.kind !== "path" || part.flapK === undefined) return 0;
  return (flap - FLAP_NEUTRAL) * part.flapK;
}

/**
 * Build a full SunbirdPalette from the four skin colours stored in SkinDef.
 * The missing slots (wings, tail, brow, eye) are derived deterministically so
 * the shop bird matches the in-game bird exactly.
 */
export function skinPalette(skin: { body: number; wing: number; belly: number; beak: number }): SunbirdPalette {
  const toHex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;
  const darken = (n: number, f: number) => {
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return ((r << 16) | (g << 8) | b) >>> 0;
  };
  const body = skin.body;
  return {
    body: toHex(body),
    belly: toHex(skin.belly),
    wingNear: toHex(skin.wing),
    wingFar: toHex(darken(body, 0.72)),
    tail: toHex(darken(body, 0.88)),
    tailTip: toHex(darken(body, 0.7)),
    brow: toHex(darken(body, 0.8)),
    beak: toHex(skin.beak),
    eye: "#2a1c28",
    eyeWhite: "#ffffff",
  };
}

/** Depth fade for distant birds — floors at 0.35 so they never vanish. */
export function dimColor(hex: string, dim: number): string {
  if (hex === "#ffffff") return "#ffffff";
  const f = Math.max(0.35, Math.min(1, dim));
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

/* ----------------------------------------------------------------- canvas */

/**
 * Draw the sunbird on a Canvas2D context, centred on the origin, facing +x.
 * `flap` is the wingbeat phase (FLAP_NEUTRAL reproduces the title-screen pose);
 * `dim` fades 1 (near) toward a deep silhouette for distant birds.
 */
export function drawSunbird(
  ctx: CanvasRenderingContext2D,
  size: number,
  flap: number,
  dim = 1,
  palette: SunbirdPalette = SUNBIRD_PALETTE,
): void {
  const s = size / UNITS;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-CX, -CY);

  for (const part of SUNBIRD_SHAPE) {
    // The three-part eye is only worth its pixels once the bird is big enough
    // to read; on a 9px flocker it is sub-pixel noise and three extra fills.
    if (part.kind === "circle" && size < EYE_MIN_SIZE) continue;
    ctx.fillStyle = dimColor(palette[part.color], dim);
    ctx.beginPath();

    const rotated = wingAngle(part, flap) !== 0 && part.kind === "path" && part.pivot;
    if (rotated) {
      const [px, py] = part.pivot!;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(wingAngle(part, flap));
      ctx.translate(-px, -py);
    }

    if (part.kind === "ellipse") {
      ctx.ellipse(part.cx, part.cy, part.rx, part.ry, 0, 0, Math.PI * 2);
    } else if (part.kind === "circle") {
      ctx.arc(part.cx, part.cy, part.r, 0, Math.PI * 2);
    } else {
      for (const cmd of part.d) {
        if (cmd[0] === "M") ctx.moveTo(cmd[1], cmd[2]);
        else if (cmd[0] === "L") ctx.lineTo(cmd[1], cmd[2]);
        else if (cmd[0] === "Q") ctx.quadraticCurveTo(cmd[1], cmd[2], cmd[3], cmd[4]);
        else ctx.closePath();
      }
    }
    ctx.fill();
    if (rotated) ctx.restore();
  }

  ctx.restore();
}

/* -------------------------------------------------------------------- svg */

export type SunbirdSvgOptions = {
  palette?: SunbirdPalette;
  /** Wingbeat phase. FLAP_NEUTRAL (default) is the title-screen pose. */
  flap?: number;
  width?: number;
  title?: string;
  className?: string;
  /** CSS wingbeat for the lightweight boot loader only. */
  animateWings?: boolean;
};

function cmdToSvg(cmd: Cmd): string {
  if (cmd[0] === "M") return `M${cmd[1]} ${cmd[2]}`;
  if (cmd[0] === "L") return `L${cmd[1]} ${cmd[2]}`;
  if (cmd[0] === "Q") return `Q${cmd[1]} ${cmd[2]} ${cmd[3]} ${cmd[4]}`;
  return "Z";
}

/**
 * The title-screen bird as inline SVG. Geometry comes from the same table the
 * canvas renderer walks, so the lobby bird and the flock bird cannot drift.
 * Safe to interpolate: colours come only from the palette tables and the one
 * piece of free text goes through `escapeText`.
 */
export function sunbirdSVG(opts: SunbirdSvgOptions = {}): string {
  const palette = opts.palette ?? SUNBIRD_PALETTE;
  const flap = opts.flap ?? FLAP_NEUTRAL;
  const width = opts.width ?? 72;
  const dim = 1;

  const parts = SUNBIRD_SHAPE.map((part) => {
    const fill = dimColor(palette[part.color], dim);
    let body: string;
    if (part.kind === "ellipse") {
      body = `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}" fill="${fill}"/>`;
    } else if (part.kind === "circle") {
      body = `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}" fill="${fill}"/>`;
    } else {
      const d = part.d.map(cmdToSvg).join(" ");
      const a = wingAngle(part, flap);
      const transform =
        a !== 0 && part.pivot
          ? ` transform="rotate(${round(a * DEG)} ${part.pivot[0]} ${part.pivot[1]})"`
          : "";
      const wing = opts.animateWings && part.pivot
        ? ` class="boot-wing" style="transform-origin:${part.pivot[0]}px ${part.pivot[1]}px"`
        : "";
      body = `<path d="${d}" fill="${fill}"${transform}${wing}/>`;
    }
    return body;
  }).join("");

  const title = opts.title ? `<title>${escapeText(opts.title)}</title>` : "";
  const role = opts.title ? 'role="img"' : 'aria-hidden="true"';
  const cls = opts.className ? ` class="${escapeText(opts.className)}"` : "";
  const height = Math.round((width * 68) / 76);

  return (
    `<svg${cls} ${role} viewBox="${SUNBIRD_VIEWBOX}" width="${width}" height="${height}" ` +
    `xmlns="http://www.w3.org/2000/svg" focusable="false">${title}${parts}</svg>`
  );
}

/* -------------------------------------------------------------------- sun */

/**
 * The title screen's sun: warm core, amber mid, deep orange rim. These stops
 * are the one definition of "the Sunbird sun" — the CSS `.hero-sun` disc, the
 * lobby sun and the in-game sun sprite all read from here.
 */
export const SUN_STOPS: readonly (readonly [number, string])[] = [
  [0, "#fff3c4"],
  [0.45, "#ffd166"],
  [0.78, "#ff9a3a"],
  [1, "#ff7a30"],
];

/** Paint the sun disc into a 2D context, centred, radius `r`. */
export function drawSunDisc(ctx: CanvasRenderingContext2D, r: number, cx = 0, cy = 0): void {
  const grd = ctx.createRadialGradient(cx - r * 0.24, cy - r * 0.32, r * 0.05, cx, cy, r);
  for (const [offset, color] of SUN_STOPS) grd.addColorStop(offset, color);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Gradient ids must be unique per document — two `<radialGradient id="sbSun">`
 * on one page makes the second sun paint with the first one's definition.
 */
let sunIdSeq = 0;

/** The sun as inline SVG, matching `.hero-sun` including its corona rings. */
export function sunSVG(opts: { size?: number; className?: string; corona?: boolean } = {}): string {
  const size = opts.size ?? 64;
  const cls = opts.className ? ` class="${escapeText(opts.className)}"` : "";
  const r = size / 2;
  const gid = `sbSun${sunIdSeq++}`;
  const stops = SUN_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
  const corona =
    opts.corona === false
      ? ""
      : `<circle cx="${r}" cy="${r}" r="${round(r * 0.82)}" fill="none" stroke="rgba(255,200,90,0.26)" stroke-width="${round(size * 0.078)}"/>` +
        `<circle cx="${r}" cy="${r}" r="${round(r * 0.98)}" fill="none" stroke="rgba(255,170,70,0.12)" stroke-width="${round(size * 0.094)}"/>`;
  return (
    `<svg${cls} aria-hidden="true" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
    `xmlns="http://www.w3.org/2000/svg" focusable="false">` +
    `<defs><radialGradient id="${gid}" cx="38%" cy="34%" r="72%">${stops}</radialGradient></defs>` +
    `${corona}<circle cx="${r}" cy="${r}" r="${round(r * 0.72)}" fill="url(#${gid})"/></svg>`
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeText(value: string): string {
  return value.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&#39;",
  );
}
