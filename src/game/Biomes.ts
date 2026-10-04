import { DROP_BLEND_START, DROP_START, GAP_START, ISLAND_PERIOD, RAMP_START } from "./constants";
import { islandGap } from "./worldProgression";
import type { BiomeMusicStyle } from "./Music";

export type DecoKind = "tree" | "palm" | "pine" | "spire" | "crystal" | "cactus";
/** Rare monument props placed ~1 chunk in 8 (see TerrainSystem.placeDecor). */
export type LandmarkKind = "ancient" | "stones" | "arch";
export type HazardKind = "none" | "gust" | "storm";

/**
 * Per-biome TERRAIN GRAMMAR — the rhythm of the hill sequence itself, as data.
 *
 * Why this is separate from `amp`/`wave`/`skew`/`roughness`: those four shape an
 * arch, but every biome used to draw its arches from one shared, hardcoded
 * vocabulary in `TerrainSystem.buildSegments` (length buckets 42/60/85/110,
 * height buckets 10/16/22/32, one authored ramp chain every 2 arches). So the
 * worlds differed in how a hill was *shaped* and how big, never in how the
 * hills were *laid out* — which is the part a pilot actually flies.
 *
 * All eight fields are multipliers or counts applied by `buildSegments()` /
 * `buildPads()`. None of them is decorative: each one is read.
 */
export type TerrainProfile = {
  /** Height multiplier on the ordinary arches. 1 = the shared default. */
  relief: number;
  /** Length multiplier on ordinary arches, on top of `wave`. <1 chatter, >1 glide. */
  lenScale: number;
  /** Ordinary arches between authored ramp chains. Lower = chains arrive sooner. */
  rampEvery: number;
  /** Chance an eligible slot becomes a ramp chain instead of an ordinary arch. */
  rampChance: number;
  /**
   * Chicane: how far each arch swings its skew to the *opposite* sign, as a
   * fraction of |skew|. 0 = every arch on the island faces the same way;
   * 1 = consecutive arches are fully mirrored, so you alternate dive/release
   * down a corridor. Safe to vary per arch — `arch'(t)` is 0 at both ends for
   * every skew, so the junction stays C1-continuous and no lip is invented.
   */
  chicane: number;
  /** Sunflower trampoline spacing as a multiple of TerrainSystem.PAD_SPACING. */
  padSpacing: number;
  /** Ordinary arches between solo troughs. 0 = this biome has no troughs. */
  troughEvery: number;
  /** Trough depth as a fraction of the height of a neighbouring ordinary arch. */
  troughDepth: number;
  /**
   * How long this biome's islands are, as a multiple of the base pitch.
   *
   * A world where every island is the same length reads as a stamp: the player
   * learns one rhythm and the whole map is that rhythm. This is the knob that
   * makes Dune Sea a long open run and Skyreach Canyon a tight one, so the
   * island is shaped by where it is rather than only by what it is.
   *
   * It scales the whole template — landmarks AND period — because
   * `buildSegments` spends a `rampStart` budget, so a longer island that did
   * not also move the landmarks would just be a longer empty shoulder.
   */
  islandScale: number;
};

/** The grammar every hand-tuned world overrides; used as the remix base. */
const GRAMMAR: TerrainProfile = {
  relief: 1,
  lenScale: 1,
  rampEvery: 2,
  rampChance: 0.65,
  chicane: 0,
  padSpacing: 1,
  troughEvery: 0,
  troughDepth: 0,
  islandScale: 1,
};

/**
 * Build a per-biome grammar without repeating eight numbers against every
 * entry. Keys are the ones that differ from GRAMMAR, so a reader can see at a
 * glance what makes a world tick differently instead of diffing eight digits.
 */
function grammar(over: Partial<TerrainProfile>): TerrainProfile {
  return { ...GRAMMAR, ...over };
}

export type BiomeDef = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  /** hill amplitude / wavelength multipliers — the feel of the world */
  amp: number;
  wave: number;
  /**
   * Hill shape skew: 0 = symmetric cosine, positive = fast-rise slow-drop
   * (steep front face like a dune), negative = slow-rise fast-drop (cliff
   * overhang / canyon wall). Range roughly -0.7..0.7.
   */
  skew: number;
  /** Noise layering on top of the base cosine: 0 = smooth, 1 = very jagged. */
  roughness: number;
  /** How much lift this biome's air gives you, as a multiple.
   *
   *  This is the per-world character of the FLIGHT, and the fork lost it: the
   *  parent monorepo has these values (0.90-1.12) and this checkout had none, so
   *  every island glided identically. That is why the worlds felt same-y — the
   *  visual biome changed the hills and the sky but not a single thing about how
   *  the bird moved through it.
   *
   *  Values are a feel, not physics: 1.0 is neutral, above floats, below sinks.
   *  Coral Reach at 1.12 is a sky-is-the-level island you chain updrafts over;
   *  Dune Sea at 0.90 is heavy air that punishes a lazy glide. */
  liftMult: number;
  /** The rhythm the arches are laid out in — see TerrainProfile. */
  terrain: TerrainProfile;
  /** terrain vertex colours */
  top: number;
  ridge: number;
  mid: number;
  deep: number;
  sand: number;
  /** far parallax silhouettes */
  farA: number;
  farB: number;
  farC: number;
  /** sky tint blended over the time-of-day gradient */
  skyTop: number;
  skyHorizon: number;
  skyMix: number;
  /** cloud tint + how busy the sky is */
  cloudTint: number;
  cloudDensity: number;
  snowLine: number;
  deco: DecoKind;
  decoDensity: number;
  hazard: HazardKind;
  thermals: number;
  fogTint: number;
  /** night worlds glow their collectibles */
  glow: boolean;
  /** musical colour for this world */
  musicMode: BiomeMusicStyle;
};

/**
 * Ten hand-tuned worlds — each one changes HOW the hills PLAY, not just look.
 * V2 anti-bore: tighter rhythm, distinct thermals, unique hazards, no long flat.
 */
/**
 * First-visit coin reward for charting a world (2026-10-04 "worlds & rewards"
 * directive). Exploration is the whole point of the endless chain, but the
 * only thing a new biome ever paid was a toast. Now the first arrival in each
 * of the nine worlds pays a charting bonus that scales with depth, so the
 * pull toward "one more island" is economic as well as scenic.
 *
 * Pure so the scale is pinned by a unit test next to the grammar tests.
 */
export function chartingBonus(biomeId: string): number {
  const idx = BIOMES.findIndex((b) => b.id === biomeId);
  // Unknown ids (a future biome, a remixed lap variant) still pay a fair
  // minimum — a new world that pays nothing is a regression nobody notices
  // until a player asks why the chart stopped mattering.
  return idx < 0 ? 25 : 25 + 15 * idx;
}

export const BIOMES: BiomeDef[] = [
  {
    id: "green",
    liftMult: 1.0,
    name: "Green Hills",
    tagline: "Quick rollers — learn dive → release, sunflower trampolines",
    emoji: "leaf",
    amp: 0.52,
    wave: 0.50,
    skew: 0.0,       // symmetric — pure teaching rhythm
    roughness: 0.02, // almost no noise — read-ahead is easy
    // Teaching world: frequent gentle chains, busy trampolines, no surprises.
    terrain: grammar({ relief: 0.92, rampEvery: 2, rampChance: 0.75, padSpacing: 0.88, islandScale: 1.0,}),
    top: 0x86dc7e,
    ridge: 0x4aa85c,
    mid: 0x2f7d5b,
    deep: 0x1d4d4a,
    sand: 0xd8b681,
    farA: 0x6bb87a,
    farB: 0x4d8aaa,
    farC: 0x4a68a0,
    skyTop: 0x2a9af0,
    skyHorizon: 0xb4dff0,
    skyMix: 0.1,
    cloudTint: 0xffffff,
    cloudDensity: 0.12,
    snowLine: 0,
    deco: "tree",
    decoDensity: 1.2,
    hazard: "none",
    thermals: 2, // few, gentle — focus on ground rhythm
    fogTint: 0xb9dce8,
    glow: false,
    musicMode: "bright",
  },
  {
    id: "tropical",
    liftMult: 1.06,
    name: "Tropical Atoll",
    tagline: "Turquoise thermals — chain the updrafts, never touch ground",
    emoji: "island",
    amp: 0.78,
    wave: 0.72,
    skew: 0.15,      // gentle forward lean — downslopes feel a touch steeper
    roughness: 0.1,
    // Low, springy ground so the six thermals carry you — the sky is the level.
    terrain: grammar({ relief: 0.9, lenScale: 0.95, rampEvery: 3, rampChance: 0.6, padSpacing: 0.75, islandScale: 1.08,}),
    top: 0x7ff0b0,
    ridge: 0x35c48a,
    mid: 0x1f8f80,
    deep: 0x14555e,
    sand: 0xfff0c0,
    farA: 0x54d6b0,
    farB: 0x2f9ec0,
    farC: 0x2a6ea8,
    skyTop: 0x30d0e8,
    skyHorizon: 0xd8fbff,
    skyMix: 0.4,
    cloudTint: 0xe8ffff,
    cloudDensity: 0.42,
    snowLine: 0,
    deco: "palm",
    decoDensity: 1.3,
    hazard: "none",
    thermals: 6, // MANY — sky chain gameplay
    fogTint: 0xc8fff0,
    glow: false,
    musicMode: "airy",
  },
  {
    id: "reef",
    liftMult: 1.12,
    name: "Coral Reach",
    tagline: "Pastel lagoons, tall thermals — surf, don't glide",
    emoji: "shell",
    amp: 0.98,
    wave: 0.88,
    skew: -0.18,     // slow climb, fast drop — launches feel punchy
    roughness: 0.15,
    // Lagoon bowls: drop in, surf out, punch back up on the far lip.
    terrain: grammar({ relief: 1.05, lenScale: 0.88, rampEvery: 3, rampChance: 0.55, chicane: 0.08, padSpacing: 1.05, troughEvery: 5, troughDepth: 0.35, islandScale: 0.93,}),
    top: 0xffc9d8,
    ridge: 0xf09ab8,
    mid: 0x2fb4a8,
    deep: 0x14707a,
    sand: 0xffe8d0,
    farA: 0x62c8c0,
    farB: 0x4a9ec8,
    farC: 0x4a68a0,
    skyTop: 0x3ab8e8,
    skyHorizon: 0xffd8e8,
    skyMix: 0.4,
    cloudTint: 0xfff0f6,
    cloudDensity: 0.36,
    snowLine: 0,
    deco: "palm",
    decoDensity: 1.2,
    hazard: "none",
    thermals: 7, // tallest, most rewarding
    fogTint: 0xcfeef0,
    glow: false,
    musicMode: "reef",
  },
  {
    id: "sunset",
    liftMult: 0.94,
    name: "Sunset Ridge",
    tagline: "Violet speed valleys — dive hard, release late for 2× distance",
    emoji: "buildings",
    amp: 1.18,
    wave: 1.05,
    skew: -0.30,     // deep valley then sharp launch lip — rewards late release
    roughness: 0.18,
    // Deep carved valleys under big ramps — the late-release speed run.
    terrain: grammar({ relief: 1.12, lenScale: 1.15, rampEvery: 2, rampChance: 0.7, chicane: 0.12, padSpacing: 1.14, troughEvery: 4, troughDepth: 0.3, islandScale: 1.14,}),
    top: 0xd98ac0,
    ridge: 0x9a5a9e,
    mid: 0x5f3a7a,
    deep: 0x33224e,
    sand: 0xe8a877,
    farA: 0xc46a8a,
    farB: 0x8a4a80,
    farC: 0x4a3060,
    skyTop: 0xf0784a,
    skyHorizon: 0xffc79a,
    skyMix: 0.55,
    cloudTint: 0xffc8a0,
    cloudDensity: 0.34,
    snowLine: 0,
    deco: "pine",
    decoDensity: 0.9,
    hazard: "none",
    thermals: 3,
    fogTint: 0xffb890,
    glow: false,
    musicMode: "warm",
  },
  {
    id: "desert",
    liftMult: 0.9,
    name: "Dune Sea",
    tagline: "Colossal dunes, sand thermals — massive air, thermals catch you",
    emoji: "dunes",
    amp: 1.42,
    wave: 1.28,
    skew: 0.45,      // classic dune: very gradual windward slope, sharp leeward drop
    roughness: 0.08, // smooth — wind polishes the sand
    // Colossal: very long arches, rare but huge launches, few trampolines.
    terrain: grammar({ relief: 1.05, lenScale: 1.45, rampEvery: 4, rampChance: 0.5, chicane: 0.06, padSpacing: 1.43, islandScale: 1.2,}),
    hazard: "gust",
    top: 0xf2cf7a,
    ridge: 0xdc9a4a,
    mid: 0xb0603a,
    deep: 0x6a3524,
    sand: 0xf7e6b8,
    farA: 0xd8a86a,
    farB: 0xb46a4a,
    farC: 0x8a4a52,
    skyTop: 0xf0a850,
    skyHorizon: 0xffe6b0,
    skyMix: 0.42,
    cloudTint: 0xffe8c8,
    cloudDensity: 0.42,
    snowLine: 0,
    deco: "cactus",
    decoDensity: 0.6,
    thermals: 7, // many, so long air has something to do
    fogTint: 0xffdca0,
    glow: false,
    musicMode: "wide",
  },
  {
    id: "night",
    liftMult: 1.0,
    name: "Midnight Coast",
    tagline: "Glowing rings under moon — storm clouds chase you",
    emoji: "moon",
    amp: 1.08,
    wave: 0.95,
    skew: 0.20,      // choppy storm sea feel — waves are steep-fronted
    roughness: 0.35, // storm roughness — unpredictable micro-bumps
    // Alternating chop, with the odd hole to lose a wing in.
    terrain: grammar({ relief: 1.0, lenScale: 1.0, rampEvery: 3, rampChance: 0.6, chicane: 0.08, padSpacing: 0.95, troughEvery: 4, troughDepth: 0.3, islandScale: 0.97,}),
    top: 0x3f5a8a,
    ridge: 0x2c3f68,
    mid: 0x1d2848,
    deep: 0x10162c,
    sand: 0x54648a,
    farA: 0x2a3c66,
    farB: 0x1e2a4c,
    farC: 0x141c34,
    skyTop: 0x0d1030,
    skyHorizon: 0x2a2f60,
    skyMix: 0.75,
    cloudTint: 0x8090c8,
    cloudDensity: 0.32,
    snowLine: 0,
    deco: "pine",
    decoDensity: 1,
    hazard: "storm",
    thermals: 3,
    fogTint: 0x2a3054,
    glow: true,
    musicMode: "night",
  },
  {
    id: "aurora",
    liftMult: 1.02,
    name: "Aurora Peaks",
    tagline: "Ice lips + gust walls — tuck to punch, release to soar",
    emoji: "aurora",
    amp: 1.55,
    wave: 0.88,
    skew: -0.50,     // ice shards: near-vertical front face, gentle backslide
    roughness: 0.28, // crystalline fracture texture
    // Ice shards: tight, tall, and mirrored arch to arch — a hard chicane.
    terrain: grammar({ relief: 0.9, lenScale: 1.0, rampEvery: 2, rampChance: 0.65, chicane: 0.15, padSpacing: 1.57, islandScale: 0.91,}),
    top: 0xe6f7ff,
    ridge: 0x9fd0ee,
    mid: 0x5a7fc0,
    deep: 0x2c3a72,
    sand: 0xdcebff,
    farA: 0x7a9ed8,
    farB: 0x5a68b8,
    farC: 0x3a3f80,
    skyTop: 0x1b2a68,
    skyHorizon: 0x62e8c8,
    skyMix: 0.6,
    cloudTint: 0xd8fff4,
    cloudDensity: 0.34,
    snowLine: 24,
    deco: "crystal",
    decoDensity: 1.05,
    hazard: "gust",
    thermals: 5,
    fogTint: 0xbfe8ff,
    glow: true,
    musicMode: "crystal",
  },
  {
    id: "volcano",
    liftMult: 0.92,
    name: "Cinder Forge",
    tagline: "Black glass + ash storms — low, fast, dodge or dive",
    emoji: "volcano",
    amp: 1.75,
    wave: 0.72,
    skew: 0.0,       // symmetric spikes — equally brutal both directions
    roughness: 0.55, // volcanic rubble — chaotic, jagged surface noise
    // Rubble chatter with pits, and a launch chain almost every other arch.
    terrain: grammar({ relief: 0.92, lenScale: 0.95, rampEvery: 2, rampChance: 0.65, chicane: 0.08, padSpacing: 0.84, troughEvery: 6, troughDepth: 0.3, islandScale: 1.06,}),
    top: 0x5a4448,
    ridge: 0x3c2a30,
    mid: 0x281a20,
    deep: 0x140c10,
    sand: 0x6a5248,
    farA: 0x4a3038,
    farB: 0x38222c,
    farC: 0x241418,
    skyTop: 0x2a1418,
    skyHorizon: 0xff7a3a,
    skyMix: 0.7,
    cloudTint: 0x9a6858,
    cloudDensity: 0.28,
    snowLine: 0,
    deco: "spire",
    decoDensity: 0.9,
    hazard: "storm",
    thermals: 8, // most violent
    fogTint: 0x54303a,
    glow: true,
    musicMode: "ember",
  },
  {
    id: "canyon",
    liftMult: 0.98,
    name: "Skyreach Canyon",
    tagline: "Red walls, monster lips — biggest launches, gust crosswinds",
    emoji: "mountain",
    amp: 1.95,
    wave: 1.08,
    skew: -0.60,     // canyon walls: long plateau then sheer cliff drop
    roughness: 0.22, // wind-carved — some texture but readable
    // A corridor: the walls swap sides as you go, and the floor drops away.
    terrain: grammar({ relief: 1.15, lenScale: 1.3, rampEvery: 3, rampChance: 0.7, chicane: 0.45, padSpacing: 1.24, troughEvery: 5, troughDepth: 0.4, islandScale: 0.86,}),
    top: 0xe08a5a,
    ridge: 0xb85c3c,
    mid: 0x8a3c2c,
    deep: 0x501f18,
    sand: 0xf0c090,
    farA: 0xc07850,
    farB: 0x94503c,
    farC: 0x63302a,
    skyTop: 0x3a78c8,
    skyHorizon: 0xffd8a8,
    skyMix: 0.35,
    cloudTint: 0xffeedd,
    cloudDensity: 0.38,
    snowLine: 0,
    deco: "cactus",
    decoDensity: 0.8,
    hazard: "gust",
    thermals: 6,
    fogTint: 0xe8c8a8,
    glow: false,
    musicMode: "canyon",
  },
  {
    // The tenth world (2026-10-04 "more worlds" directive): a violet glass
    // rift where the air itself floats you. Long crystalline faces reward the
    // glide the first nine worlds taught, chicane walls make the corridors
    // read like a cathedral, and everything glows — it is the reward world,
    // the one the atlas says exists before the laps begin.
    id: "amethyst",
    liftMult: 1.06,
    name: "Amethyst Hollow",
    tagline: "Violet glass, floaty air — chain the spires into one long glide",
    emoji: "crystal",
    amp: 1.35,
    wave: 1.15,
    skew: 0.25,      // crystal faces: fast rise, slow glassy drop
    roughness: 0.30, // faceted — textured but periodic, so it stays readable
    terrain: grammar({ relief: 1.05, lenScale: 1.18, rampEvery: 2, rampChance: 0.7, chicane: 0.3, padSpacing: 1.05, troughEvery: 4, troughDepth: 0.3, islandScale: 1.05 }),
    top: 0xb98ae8,
    ridge: 0x8a5cc8,
    mid: 0x5c3a94,
    deep: 0x32205e,
    sand: 0xe0d0ff,
    farA: 0x9a78d8,
    farB: 0x6a4aa8,
    farC: 0x3e2a6e,
    skyTop: 0x2a1a4a,
    skyHorizon: 0xc8a8ff,
    skyMix: 0.55,
    cloudTint: 0xd8c8f8,
    cloudDensity: 0.3,
    snowLine: 0,
    deco: "crystal",
    decoDensity: 1.0,
    hazard: "gust",
    thermals: 7,
    fogTint: 0x4a3878,
    glow: true,
    musicMode: "amethyst",
  },
];

function shade(hex: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (hex & 255) + amt));
  return (r << 16) | (g << 8) | b;
}

const WILD_SUFFIX = ["Wilds", "Reaches", "Expanse", "Frontier", "Verge", "Beyond"];
const _wildCache = new Map<number, BiomeDef>();

const clampF = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function biomeForIsland(island: number): BiomeDef {
  const i = Math.max(0, Math.floor(island));
  if (i < BIOMES.length) return BIOMES[i]!;
  // UNLIMITED LEVELS: deterministic remix past the hand-tuned ten.
  // Same seed => same island forever, new hue shift + amp/wave drift per lap.
  const cached = _wildCache.get(i);
  if (cached) return cached;
  const base = BIOMES[i % BIOMES.length]!;
  const lap = Math.floor(i / BIOMES.length); // 1,2,3...
  // deterministic pseudo-random from island index
  let h = (i * 2654435761) >>> 0;
  const rnd = (): number => {
    h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
    return (h >>> 0) / 4294967296;
  };
  const shift = Math.floor((rnd() - 0.5) * 36) + lap * 12;
  const amp = base.amp * (1 + lap * 0.07 + rnd() * 0.08);
  const wave = base.wave * (1 + (rnd() - 0.5) * 0.14);
  // Lift drifts per lap too, so a remixed island is not just a recolour — it
  // is slightly easier or harder to hold height in. Same ±3% band the parent
  // uses, and it is applied AFTER the rnd() calls above are fixed in count so
  // the sequence for existing seeds does not shift under it.
  const liftMult = base.liftMult * (0.98 + rnd() * 0.06);
  // Slope scales with relief/lenScale, so cap the RATIO rather than each field:
  // jittering the two independently can otherwise push a remixed island past a
  // gradient no hand-tuned world has ever had. rng order is unchanged.
  const reliefRaw = base.terrain.relief * (1 + lap * 0.03 + (rnd() - 0.5) * 0.12);
  const lenScale = clampF(base.terrain.lenScale * (1 + (rnd() - 0.5) * 0.16), 0.55, 1.6);
  const relief = clampF(reliefRaw, 0.3, lenScale * 1.2);
  const suffix = WILD_SUFFIX[i % WILD_SUFFIX.length]!;
  const decoPool: DecoKind[] = ["tree", "palm", "pine", "spire", "crystal", "cactus"];
  const gen: BiomeDef = {
    ...base,
    id: `wild-${i}`,
    name: `${base.name} ${suffix} ${lap + 1}`,
    tagline: `Uncharted lap ${lap + 1} — remixed ${base.name.toLowerCase()}`,
    emoji: base.emoji,
    amp, wave, liftMult,
    top: shade(base.top, shift), ridge: shade(base.ridge, shift),
    mid: shade(base.mid, shift), deep: shade(base.deep, shift),
    sand: shade(base.sand, Math.floor(shift / 2)),
    farA: shade(base.farA, shift), farB: shade(base.farB, shift), farC: shade(base.farC, shift),
    skyTop: shade(base.skyTop, shift), skyHorizon: shade(base.skyHorizon, Math.floor(shift / 2)),
    cloudTint: shade(base.cloudTint, Math.floor(shift / 3)),
    fogTint: shade(base.fogTint, Math.floor(shift / 2)),
    snowLine: base.snowLine > 0 ? base.snowLine + lap * 2 : rnd() < 0.25 ? 24 + lap * 2 : 0,
    deco: decoPool[Math.floor(rnd() * decoPool.length)]!,
    decoDensity: base.decoDensity * (0.9 + rnd() * 0.5),
    hazard: lap >= 2 && rnd() < 0.3 ? (rnd() < 0.5 ? "gust" : "storm") : base.hazard,
    thermals: Math.max(1, Math.min(7, base.thermals + Math.floor((rnd() - 0.4) * 2))),
    // The remix drifts the GRAMMAR too, or every lap past the hand-tuned nine
    // would fly the same rhythm in a new colour. Same drift shape as amp/wave:
    // small per-world jitter plus a lap term, so later laps genuinely bite.
    terrain: {
      relief,
      lenScale,
      rampEvery: Math.max(1, Math.min(5, base.terrain.rampEvery + Math.floor((rnd() - 0.5) * 2))),
      rampChance: clampF(base.terrain.rampChance + (rnd() - 0.5) * 0.12 + lap * 0.02, 0.4, 0.85),
      chicane: clampF(base.terrain.chicane + (rnd() - 0.5) * 0.24, 0, 1),
      padSpacing: clampF(base.terrain.padSpacing * (1 + (rnd() - 0.5) * 0.3), 0.6, 1.8),
      // Island length drifts with the rest of the grammar, so a remixed world
      // is a different SHAPE as well as a different rhythm.
      islandScale: clampF(base.terrain.islandScale * (1 + (rnd() - 0.5) * 0.12), 0.8, 1.3),
      troughEvery: base.terrain.troughEvery > 0 ? Math.max(2, base.terrain.troughEvery + Math.floor((rnd() - 0.5) * 2)) : 0,
      troughDepth: clampF(base.terrain.troughDepth + (rnd() - 0.5) * 0.1, 0.15, 0.6),
    },
  };
  _wildCache.set(i, gen);
  if (_wildCache.size > 64) {
    const first = _wildCache.keys().next().value;
    if (first !== undefined) _wildCache.delete(first);
  }
  return gen;
}

/**
 * Ocean gaps widen gradually, but always leave a landing shelf before the
 * island wraps. Later difficulty comes from the biomes, not impossible gaps.
 *
 * The `island * 4` term used to be dead: the `min` cap bound at island 0, so
 * every gap from the second island onward was the same 201 m. The shelf
 * reservation is now scaled to the new pitch and the widening term is large
 * enough to actually reach it, which makes the doc comment true.
 */
export function gapEndFor(island: number): number {
  // Reserve a real landing shelf: a local-x gap must never wrap past the island.
  return islandTemplate(island).gapEnd;
}

/**
 * Ramp height — which is to say, LAUNCH HEIGHT for the gap behind it.
 *
 * It scales with the island for the same reason every other landmark does: a
 * 2,294 m dune sea presents a wider water gap than a 1,644 m canyon, and a
 * launch that clears one does not clear the other. Without the scale factor
 * the bird stopped clearing the long islands altogether: it launched, ran out
 * of height halfway across, and swam.
 */
export function rampPeakFor(island: number): number {
  return (34 + Math.min(22, Math.max(0, island) * 2)) * islandScaleFor(island);
}

/* ------------------------------------------------------- the island layout */

/**
 * One island's geometry, all of it derived from its biome's `islandScale`.
 *
 * Every landmark moves with the period, so a long island is a genuinely longer
 * island — more arches, a longer run-in, a longer drop — rather than the same
 * island with a longer flat shoulder at the end. That is the whole difference
 * between "islands are a different length" and "islands are stamped".
 */
export type IslandTemplate = {
  index: number;
  /** Total length of this island in world units. */
  period: number;
  /** The multiplier every landmark below was scaled by. */
  scale: number;
  /** World-x where this island begins. */
  start: number;
  dropBlendStart: number;
  dropStart: number;
  rampStart: number;
  gapStart: number;
  /** Local-x where the ocean ends and the landing shelf begins. */
  gapEnd: number;
};

/** How much of an island is kept as a landing shelf, scaled with the island. */
const SHELF = 32;

/** How many islands the exact layout table covers before extrapolating. */
const LAYOUT_LIMIT = 2048;

/** Prefix sums of island periods: `starts[i]` is where island `i` begins. */
let layoutStarts: number[] | null = null;

function ensureLayout(): number[] {
  if (layoutStarts) return layoutStarts;
  const starts = new Array<number>(LAYOUT_LIMIT + 1);
  starts[0] = 0;
  for (let i = 0; i < LAYOUT_LIMIT; i += 1) {
    starts[i + 1] = starts[i]! + islandScaleFor(i) * ISLAND_PERIOD;
  }
  layoutStarts = starts;
  return starts;
}

function islandScaleFor(island: number): number {
  const scale = biomeForIsland(Math.max(0, Math.floor(island))).terrain.islandScale;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Drop the cached prefix table so the next `islandTemplate` call re-derives it.
 *
 * Only the dev tuning panel has a reason to call this: `ISLAND_PERIOD` is a
 * live binding, but every island boundary below `LAYOUT_LIMIT` was baked out of
 * it once and never re-read, so a retuned period would otherwise change the
 * start line in Game.ts and nothing else — the world would silently stop
 * matching itself. The one-entry island cache in `islandIndexFor` has to go
 * with it, or a stale `lastStart` survives the rebuild.
 */
export function resetIslandLayout(): void {
  layoutStarts = null;
  lastIndex = -1;
  lastStart = 0;
}

/** The mean island length, used past the end of the exact table. */
function averagePeriod(): number {
  const starts = ensureLayout();
  return starts[LAYOUT_LIMIT]! / LAYOUT_LIMIT;
}

/**
 * Which island a world-x falls in.
 *
 * Binary search over the prefix table, with a one-entry cache in front of it:
 * this is called several times per frame and the bird moves forward, so the
 * overwhelmingly common answer is the last one or the next one.
 *
 * Past the table the world keeps going at the mean island length. The world is
 * infinite, so this has to answer for any x — it cannot throw "out of range",
 * because a run that reaches island 2100 must still have ground under it.
 */
let lastIndex = -1;
let lastStart = 0;
export function islandIndexFor(x: number): number {
  const starts = ensureLayout();
  if (x <= 0) return 0;
  if (x >= starts[LAYOUT_LIMIT]!) {
    return LAYOUT_LIMIT + Math.floor((x - starts[LAYOUT_LIMIT]!) / averagePeriod());
  }
  // Forward fast path: the bird rarely skips an island, let alone goes back.
  if (x >= lastStart && lastIndex >= 0 && lastIndex < LAYOUT_LIMIT) {
    if (x < starts[lastIndex + 1]!) return lastIndex;
    if (lastIndex + 2 <= LAYOUT_LIMIT && x < starts[lastIndex + 2]!) {
      lastIndex += 1;
      lastStart = starts[lastIndex]!;
      return lastIndex;
    }
  }
  // Binary search for the largest i with starts[i] <= x.
  let lo = 0;
  let hi = LAYOUT_LIMIT;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid]! <= x) lo = mid;
    else hi = mid;
  }
  lastIndex = lo;
  lastStart = starts[lo]!;
  return lo;
}

/** The full layout of an island. */
export function islandTemplate(island: number): IslandTemplate {
  const index = Math.max(0, Math.floor(island));
  const starts = ensureLayout();
  const scale = index < LAYOUT_LIMIT ? islandScaleFor(index) : 1;
  const period = index < LAYOUT_LIMIT ? starts[index + 1]! - starts[index]! : ISLAND_PERIOD;
  const start = index < LAYOUT_LIMIT ? starts[index]! : starts[LAYOUT_LIMIT]! + (index - LAYOUT_LIMIT) * averagePeriod();
  const gapStart = GAP_START * scale;
  return {
    index,
    period,
    scale,
    start,
    dropBlendStart: DROP_BLEND_START * scale,
    dropStart: DROP_START * scale,
    rampStart: RAMP_START * scale,
    gapStart,
    // Saturating gap, not a 4-units-per-island linear crawl that left island
    // 10 only 18% wider than island 0. See worldProgression.islandGap.
    gapEnd: Math.min(period - SHELF * scale, gapStart + islandGap(index) * scale),
  };
}

/** Local-x within an island, for a world-x. */
export function localXFor(x: number): number {
  // Negative x wraps to the far end of the first island, exactly as the old
  // modulo did. The menu's attract camera and the floating origin both sit
  // behind the start line at times, and a negative local-x reads as "off the
  // end of the world" to every caller downstream.
  if (x < 0) {
    const p = islandTemplate(0).period;
    return ((x % p) + p) % p;
  }
  return x - islandTemplate(islandIndexFor(x)).start;
}

/** World-x where an island starts — the start line for a course, not `i * 1450`. */
export function islandStartFor(island: number): number {
  return islandTemplate(island).start;
}
