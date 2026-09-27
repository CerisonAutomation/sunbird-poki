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

/* ---------------------------------------------------------------- species */

/**
 * The species shapes a bird can be built in.
 *
 * Sixty-nine birds all drawn as the same oval with the same two wing paths is
 * why the shop read as a colour swatch list: a "Harpy Eagle" and a "Dusk Owl"
 * were the same animal in different paint, so the only way to tell them apart
 * was to read the name. A shape is what makes a species a species at a glance.
 *
 * The SVG/canvas table here and the Three.js `Bird` both read this enum (see
 * `Bird.setShape`), so a bird in the hangar is the bird that flies — the two
 * used to be the same outline too, which is a different way of saying nothing.
 *
 * `songbird` is the title-screen mark and the default for anything without a
 * species, and it is deliberately the ORIGINAL table, unchanged: at
 * `FLAP_NEUTRAL` the hero bird must stay path-for-path what the designer drew.
 */
export type BirdShape = "songbird" | "raptor" | "owl" | "wader" | "ember" | "comet";

const SHAPE_EYE = (
  head: readonly [number, number, number],
): readonly Part[] => [
  { kind: "circle", cx: head[0], cy: head[1], r: head[2], color: "eyeWhite" },
  { kind: "circle", cx: head[0] + 1.4, cy: head[1] - 0.6, r: head[2] * 0.5, color: "eye" },
  { kind: "circle", cx: head[0] + 1.6, cy: head[1] - 1.2, r: head[2] * 0.2, color: "eyeWhite" },
];

/** A hooked beak, for the birds that kill things. */
const BEAK_HOOKED: Part = {
  kind: "path",
  color: "beak",
  d: [["M", 45, 32], ["L", 58, 35], ["L", 50, 41], ["Q", 46, 38, 45, 32], ["Z"]],
};

/** A dagger beak, for the birds that stab. */
const BEAK_DAGGER: Part = {
  kind: "path",
  color: "beak",
  d: [["M", 46, 30], ["L", 64, 26], ["L", 46, 33], ["Z"]],
};

/** A short hooked stub, for the birds that sit still and listen. */
const BEAK_STUB: Part = {
  kind: "path",
  color: "beak",
  d: [["M", 44, 35], ["L", 53, 37], ["L", 45, 41], ["Z"]],
};

/** The head, eyes and brow for a species, in one call. */
function head2(
  x: number,
  y: number,
  r: number,
  beak: Part,
  brow = true,
): readonly Part[] {
  return [
    ...SHAPE_EYE([x, y, r]),
    beak,
    ...(brow
      ? [
          {
            kind: "path",
            color: "brow",
            d: [["M", x - 5, y - r - 3], ["Q", x + 1, y - r - 2.5, x + 3, y], ["Q", x - 1, y - r - 0.6, x - 4, y - r - 0.8], ["Z"]],
          } satisfies Path,
        ]
      : []),
  ];
}

const RAPTOR_SHAPE: readonly Part[] = [
  // Long, raked tail — the silhouette that reads "raptor" before colour does.
  { kind: "path", color: "tail", d: [["M", 14, 40], ["L", -6, 34], ["L", -2, 44], ["L", -4, 52], ["L", 16, 47], ["Z"]] },
  { kind: "path", color: "tailTip", d: [["M", -4, 48], ["L", -4, 56], ["L", 2, 52], ["L", 4, 47], ["Z"]] },
  { kind: "ellipse", cx: 30, cy: 36, rx: 16, ry: 9.5, color: "body" },
  { kind: "ellipse", cx: 33, cy: 39, rx: 10, ry: 5, color: "belly" },
  {
    kind: "path", color: "wingFar", pivot: FAR_WING_PIVOT, flapK: -0.7,
    d: [["M", 24, 26], ["Q", 12, 8, 2, 8], ["Q", 12, 20, 24, 30], ["Z"]],
  },
  {
    kind: "path", color: "wingNear", pivot: NEAR_WING_PIVOT, flapK: -0.9,
    d: [["M", 26, 30], ["Q", 10, 6, -2, 8], ["Q", 13, 22, 27, 34], ["Z"]],
  },
  // Swept crest, the tell on a falcon.
  { kind: "path", color: "brow", d: [["M", 36, 25], ["L", 41, 19], ["L", 40, 26], ["Z"]] },
  ...head2(40, 30, 3.2, BEAK_HOOKED),
];

const OWL_SHAPE: readonly Part[] = [
  { kind: "path", color: "tail", d: [["M", 16, 42], ["L", 4, 40], ["L", 5, 48], ["L", 4, 54], ["L", 17, 48], ["Z"]] },
  { kind: "path", color: "tailTip", d: [["M", 5, 50], ["L", 4, 56], ["L", 10, 52], ["L", 11, 49], ["Z"]] },
  { kind: "ellipse", cx: 30, cy: 38, rx: 15, ry: 13, color: "body" },
  { kind: "ellipse", cx: 31, cy: 42, rx: 10, ry: 7, color: "belly" },
  // Broad, short, rounded wings — a glider's planform, not a hunter's.
  {
    kind: "path", color: "wingFar", pivot: FAR_WING_PIVOT, flapK: -0.55,
    d: [["M", 24, 28], ["Q", 14, 18, 8, 22], ["Q", 14, 28, 24, 33], ["Z"]],
  },
  {
    kind: "path", color: "wingNear", pivot: NEAR_WING_PIVOT, flapK: -0.65,
    d: [["M", 26, 32], ["Q", 13, 20, 4, 24], ["Q", 14, 30, 27, 37], ["Z"]],
  },
  // Tufted ear discs: an owl needs ears, or it is a round bird.
  { kind: "path", color: "wingFar", d: [["M", 34, 24], ["L", 33, 15], ["L", 39, 22], ["Z"]] },
  { kind: "path", color: "wingNear", d: [["M", 30, 23], ["L", 27, 15], ["L", 35, 21], ["Z"]] },
  ...head2(38, 31, 4.2, BEAK_STUB),
];

const WADER_SHAPE: readonly Part[] = [
  { kind: "path", color: "tail", d: [["M", 18, 42], ["L", 8, 46], ["L", 12, 50], ["L", 20, 47], ["Z"]] },
  { kind: "ellipse", cx: 27, cy: 41, rx: 11, ry: 7, color: "body" },
  { kind: "ellipse", cx: 28, cy: 43, rx: 7, ry: 4, color: "belly" },
  // Legs first, so the body sits on them.
  { kind: "path", color: "beak", d: [["M", 24, 46], ["L", 23, 62], ["L", 25.5, 62], ["L", 27, 47], ["Z"]] },
  { kind: "path", color: "beak", d: [["M", 30, 46], ["L", 32, 62], ["L", 34.5, 62], ["L", 32, 47], ["Z"]] },
  // The S-neck: a herpy is a leg and a neck.
  { kind: "path", color: "body", d: [["M", 33, 40], ["Q", 42, 34, 41, 26], ["L", 45, 26], ["Q", 46, 36, 35, 43], ["Z"]] },
  {
    kind: "path", color: "wingFar", pivot: FAR_WING_PIVOT, flapK: -0.6,
    d: [["M", 22, 34], ["Q", 12, 26, 8, 30], ["Q", 14, 36, 23, 40], ["Z"]],
  },
  {
    kind: "path", color: "wingNear", pivot: NEAR_WING_PIVOT, flapK: -0.75,
    d: [["M", 24, 38], ["Q", 11, 28, 3, 32], ["Q", 13, 39, 25, 44], ["Z"]],
  },
  ...head2(44, 24, 2.6, BEAK_DAGGER, false),
];

const EMBER_SHAPE: readonly Part[] = [
  // A forked, flame-shaped tail.
  { kind: "path", color: "tail", d: [["M", 14, 40], ["L", 2, 28], ["L", 10, 40], ["L", 2, 50], ["L", 16, 46], ["Z"]] },
  { kind: "path", color: "tailTip", d: [["M", 3, 30], ["L", -1, 22], ["L", 5, 33], ["L", 4, 42], ["L", 1, 50], ["L", 0, 40], ["Z"]] },
  { kind: "ellipse", cx: 30, cy: 36, rx: 15, ry: 10, color: "body" },
  { kind: "ellipse", cx: 32, cy: 40, rx: 10, ry: 5, color: "belly" },
  {
    kind: "path", color: "wingFar", pivot: FAR_WING_PIVOT, flapK: -0.8,
    d: [["M", 24, 26], ["Q", 13, 10, 4, 12], ["Q", 13, 22, 24, 30], ["Z"]],
  },
  {
    kind: "path", color: "wingNear", pivot: NEAR_WING_PIVOT, flapK: -1.0,
    d: [["M", 26, 30], ["Q", 12, 8, 0, 10], ["Q", 14, 23, 27, 34], ["Z"]],
  },
  // Three flame tongues for a crest.
  { kind: "path", color: "brow", d: [["M", 34, 24], ["L", 33, 13], ["L", 38, 21], ["Z"]] },
  { kind: "path", color: "brow", d: [["M", 38, 24], ["L", 40, 14], ["L", 42, 22], ["Z"]] },
  { kind: "path", color: "brow", d: [["M", 41, 26], ["L", 46, 19], ["L", 45, 27], ["Z"]] },
  ...head2(40, 31, 3, BEAK_STUB),
];

const COMET_SHAPE: readonly Part[] = [
  // The streak is the whole point: a tapering trail rather than a tail fan.
  { kind: "path", color: "tail", d: [["M", 16, 38], ["L", -14, 26], ["L", -16, 36], ["L", -13, 46], ["L", 16, 44], ["Z"]] },
  { kind: "path", color: "tailTip", d: [["M", -16, 32], ["L", -28, 30], ["L", -16, 40], ["Z"]] },
  { kind: "ellipse", cx: 30, cy: 36, rx: 14, ry: 9, color: "body" },
  { kind: "ellipse", cx: 32, cy: 39, rx: 9, ry: 4.5, color: "belly" },
  {
    kind: "path", color: "wingFar", pivot: FAR_WING_PIVOT, flapK: -0.75,
    d: [["M", 24, 27], ["Q", 15, 14, 8, 16], ["Q", 15, 24, 24, 31], ["Z"]],
  },
  {
    kind: "path", color: "wingNear", pivot: NEAR_WING_PIVOT, flapK: -0.95,
    d: [["M", 26, 31], ["Q", 14, 13, 4, 15], ["Q", 15, 25, 27, 35], ["Z"]],
  },
  ...head2(41, 32, 2.8, BEAK_HOOKED, false),
];

/**
 * Every shape, by name. The songbird is the original hand-authored table.
 *
 * Exported so the species rule can be checked over the whole bird catalogue
 * rather than eyeballed on one card — a rule that quietly collapsed to a single
 * shape would look fine in any single screenshot.
 */
export const SHAPES: readonly BirdShape[] = (["songbird", "raptor", "owl", "wader", "ember", "comet"] as const);
const SHAPE_TABLES: Readonly<Record<BirdShape, readonly Part[]>> = {
  songbird: SUNBIRD_SHAPE,
  raptor: RAPTOR_SHAPE,
  owl: OWL_SHAPE,
  wader: WADER_SHAPE,
  ember: EMBER_SHAPE,
  comet: COMET_SHAPE,
};

export function shapeTable(shape: BirdShape): readonly Part[] {
  return SHAPE_TABLES[shape] ?? SUNBIRD_SHAPE;
}

/**
 * The species a skin is drawn in.
 *
 * Derived, not authored per bird: 69 hand-assigned species would be 69 chances
 * to get one wrong and no way to see the error, whereas a rule reads the skin's
 * own identity and lands in the same place every time. The family comes from the
 * collection (which is already the game's own grouping) and the exact member of
 * that family from a stable hash of the id, so a bird keeps its species forever
 * and a new bird added tomorrow gets a sensible one without anyone deciding.
 */
export function skinShape(skin: { id: string; collection?: string }): BirdShape {
  const FAMILIES: Readonly<Record<string, readonly BirdShape[]>> = {
    nature: ["songbird", "raptor", "wader"],
    elements: ["ember", "raptor", "comet"],
    seasonal: ["songbird", "wader", "raptor"],
    cosmic: ["comet", "ember", "raptor"],
    tournament: ["raptor", "owl"],
    achievement: ["owl", "raptor", "comet"],
    premium: ["ember", "comet"],
    starter: ["songbird"],
  };
  const family = FAMILIES[skin.collection ?? ""] ?? (["songbird", "raptor"] as const);
  // FNV-1a: a short, stable, well-spread hash. `charCodeAt` is deliberate —
  // stable across engines, unlike anything locale- or float-sensitive.
  let hash = 0x811c9dc5;
  for (let i = 0; i < skin.id.length; i += 1) {
    hash ^= skin.id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return family[hash % family.length]!;
}


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
  // The tail, crest and wings all read from `skin.wing` in flight, because
  // Bird.applySkin paints them from one material. Deriving the tail from the
  // body here made the hangar preview a visibly different animal from the one
  // the player then flies — the one place a preview must not lie.
  const wing = skin.wing;
  return {
    body: toHex(body),
    belly: toHex(skin.belly),
    wingNear: toHex(wing),
    wingFar: toHex(darken(wing, 0.72)),
    tail: toHex(wing),
    tailTip: toHex(darken(wing, 0.7)),
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
  shape: BirdShape = "songbird",
): void {
  const s = size / UNITS;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-CX, -CY);

  for (const part of shapeTable(shape)) {
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
  /** CSS wingbeat — see `wingFlapKeyframes` in ui.css for the animation. */
  animateWings?: boolean;
  /** Which species to draw. Defaults to the title-screen songbird. */
  shape?: BirdShape;
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
  const shape = opts.shape ?? "songbird";

  const parts = shapeTable(shape).map((part) => {
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
      // The far wing gets its own class so the keyframes can lead it slightly —
      // both wings beating in perfect unison reads as a single flapping card.
      const wing = opts.animateWings && part.pivot
        ? ` class="bird-wing bird-wing--${shape}${part.pivot === FAR_WING_PIVOT ? " wing-far" : ""}" style="transform-origin:${part.pivot[0]}px ${part.pivot[1]}px"`
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
