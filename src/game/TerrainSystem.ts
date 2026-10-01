import * as THREE from "three";
import { flightProgression, terrainDifficulty } from "./FlightProgression";
import { biomeForIsland, islandIndexFor, islandTemplate, localXFor, rampPeakFor, type BiomeDef, type DecoKind, type LandmarkKind } from "./Biomes";
// The island landmarks (DROP_START, RAMP_START, GAP_START, ISLAND_PERIOD) are
// deliberately absent: they are the DEFAULT the island layout scales from, and
// every landmark this file needs is read per-island through `islandTemplate`,
// so a long biome gets a proportionally longer drop, ramp and runway.
import {
  CHUNK_RES,
  CHUNK_SIZE,
  OCEAN_FLOOR,
  TERRAIN_FACE_DEPTH,
  TERRAIN_HALF_Z,
  VISIBLE_CHUNKS_BACK,
  VISIBLE_CHUNKS_FWD,
  WATER_Y,
} from "./constants";
import { clamp, fbm, hash01, lerp, SeededRandom, smoothstep, valueNoise } from "./math";
import { enforceMinContrast, TERRAIN_SKY_MIN_CONTRAST, type Rgb } from "./legibility";

const HEIGHT_CACHE_SIZE = 4096;
const HEIGHT_CACHE_MASK = HEIGHT_CACHE_SIZE - 1;

/** Crest index resolution + how far ahead we scan per refill. */
const CREST_STEP = 2;
const CREST_BLOCK = 900;
/** Prominence gates so terrain noise is not mistaken for a launch lip. */
const CREST_MIN_UP = 0.12;
const CREST_MIN_DOWN = 0.06;
const CREST_CONFIRM = 14;
/** Sample distance either side of `x` used to gate a live curvature launch
 * check against the same prominence rule (see hasCrestProminence()). Wide
 * enough to average out the highest-frequency terrain noise (~22-unit
 * wavelength micro-bumps), narrow enough to still resolve a real crest. */
const CREST_GATE_DIST = 6;

/** One smooth cosine arch of terrain with an authored intent.
 *  `skew` is per-arch rather than per-biome so a world can be a chicane of
 *  alternating wall faces (see BiomeDef.terrain.chicane). */
type Segment = { start: number; len: number; height: number; base: number; baseNext: number; skew: number };

/** A sunflower bounce pad anchored to the hills. x/y are world coords. */
type BouncePad = { x: number; y: number };

/** Sunflower pads: tighter spacing = more trampolines = less boring flat.
 * 165→105 = ~8-9 pads per island vs 5-6, constant decisions. */
const PAD_SPACING = 105;
const PAD_RADIUS = 3.4;

type Chunk = {
  id: number;
  group: THREE.Group;
  disposables: { dispose(): void }[];
  /** Foreground-capable prop groups (z > 0 side): placements plus the
   * instanced meshes that render them, so updateOcclusion can sink any prop
   * about to cross the bird's sight line instead of hiding the bird. */
  propGroups?: PropGroup[];
  /** True while this chunk's geometry build is deferred to an idle callback
   * (see spawnChunk's spawn budget) — updateOcclusion just skips it until the
   * mesh exists. */
  pending?: boolean;
  /** Set when the chunk scrolls out of range before its deferred build runs,
   * so the stale idle callback becomes a no-op instead of building geometry
   * for (and re-adding a mesh to) a chunk that no longer exists. */
  cancelled?: boolean;
  /** The mesh whose geometry `rebuildChunkGeo` swaps, kept so a chunk that
   * crosses the LOD boundary can be re-detailed without re-placing its decor.
   * Absent until the deferred build lands. */
  mesh?: THREE.Mesh;
  /** Which side of `LOD_DISTANCE` this chunk's CURRENT geometry was built for.
   * Read every frame to decide whether the geometry is now stale — see
   * `lodRebuilds`. */
  builtFar?: boolean;
  /** True while a LOD re-detail build is queued, so at most one is in flight. */
  rebuilding?: boolean;
};

/** Distance beyond which a chunk halves its vertex density (LOD). */
const LOD_DISTANCE = 400;

/**
 * Half-width of the dead band around `LOD_DISTANCE` in which a chunk's
 * geometry is left alone.
 *
 * A single threshold cannot work in both directions. Coarsening at `> 400`
 * and re-detailing at `< 400` puts the boundary between two rules that
 * contradict each other: a chunk sitting at 401 is far enough to coarsen and
 * near enough to re-detail, so it flips, and flips again on the next frame it
 * is re-evaluated. The camera hovering near the boundary then pays a full
 * geometry rebuild per frame, forever.
 *
 * Two thresholds a half-band apart make the middle genuinely dead — inside it
 * neither rule fires, so a chunk only changes when the camera has moved
 * decisively past the band in one direction.
 */
const LOD_HYSTERESIS = 40;

/** Cap on LOD re-detail builds started in a single frame.
 *
 * A chunk re-build is a few hundred vertices, so doing all of them at once
 * when the camera turns around would be a visible hitch. One per frame bounds
 * it, and because each is queued to an idle slot (the same mechanism
 * `spawnChunk` uses) it does not even land on the frame that starts it.
 *
 * In practice this is a bound that does not currently bind: a chunk only wants
 * to change while its centre is inside the 2·LOD_HYSTERESIS dead band, which is
 * 80 units wide against a 72-unit chunk — so at most two chunks can be
 * mid-crossing at any instant, and the queue drains on the following frame
 * anyway. It is kept as a ceiling rather than removed, because that property is
 * a consequence of two numbers that could change independently. */
const LOD_REBUILDS_PER_FRAME = 1;

/**
 * Hard ceiling on a generated face's slope, in units of rise per unit forward.
 *
 * THIS IS A SAFETY BOUND, NOT A FEEL DIAL. It deliberately does not bind on any
 * shipped terrain.
 *
 * A smoother world was tried here — a ceiling of 1.2 took the steepest interior
 * face from 1.96 to 1.16 and the world did feel calmer. It was reverted. The
 * game has a load-bearing invariant (`climb-and-chain.test.ts`, "does not give
 * the stick a free ride on a climb"): a climb must still cost speed even with
 * the stick held, or timing a release stops being the game. Flattening faces to
 * 1.2 made the steepest available climb gentle enough that the stick paid for
 * itself, and the test failed at 1.2, 1.5, 1.7 AND 1.85. Terrain steepness is
 * the difficulty curve, not decoration.
 *
 * So this sits ABOVE the authored maximum (~1.96) and only catches a runaway:
 * a future biome `amp`, a `hillScale` bump, or a segment chain edited to a
 * much shorter length. It is the alarm, not the knob. `PEAK_HEIGHT` and
 * `SHOULDER_MARGIN` are the terrain dials.
 */
const MAX_TERRAIN_SLOPE = 2.5;

/**
 * How much of the authored arch height survives, on a 0…1 scale.
 *
 * 0.85 is not a rounded guess — it is the measured edge of the climb invariant.
 * At 0.7 the hills are gentle enough that holding the stick up climbs for free
 * and the design test fails; 0.85 is the most this dial can take before it
 * starts eating the core loop. Terrain height and the game's difficulty are the
 * same quantity here, which is worth knowing before anyone turns it further.
 */
const PEAK_HEIGHT = 0.85;

/**
 * Height of the end-of-island shoulder above the launch lip.
 *
 * This is where the "too much high peak" actually lived. The shoulder was
 * `16 + hash*6` on top of a `lip` that itself grows with island index, and it —
 * not any procedural hill — was the tallest thing in the world: ~71 units on
 * island 1, climbing past 85 on later ones, standing ~48 above the local mean
 * at the exact point every run ends. The comment above it already claimed the
 * rise should be "barely visible"; halving the margin makes that true.
 *
 * The ramp below it is untouched, so take-off still has the same drop and the
 * same launch. Put it back toward 16 if a biome needs a longer run-in.
 */
const SHOULDER_MARGIN = 7;

/**
 * requestIdleCallback with a setTimeout fallback for engines that lack it
 * (Safari, some portal webviews) — spreads chunk-geometry cost across idle
 * frames instead of building every new chunk synchronously in one frame.
 */
function scheduleIdle(cb: () => void, timeout = 200): void {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, 1);
  }
}

type Placement = { x: number; y: number; z: number; s: number; rot: number };
type PropGroup = { props: Placement[]; parts: { inst: THREE.InstancedMesh; part: DecoPart }[]; faded: Set<number> };

export type TerrainPalette = {
  farA: THREE.Color;
  farB: THREE.Color;
  farC: THREE.Color;
  /**
   * The sky these bands are seen against, carried on the palette so the
   * silhouette floor can be applied to the FINAL band colour. The floor used to
   * be applied by `Sky` to `farA`/`farB`/`farC` — and then `setPalette` lerped
   * each of those 55% back toward the biome's own colour, so the graded value
   * was mostly thrown away and the bands shipped at a measured contrast of 1.00
   * against a floor of 1.9. Whoever last touches a colour is the only place
   * that can promise what it will look like on screen, so the sky travels with
   * the bands it sits behind.
   */
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
};

type DecoPart = { geo: THREE.BufferGeometry; mat: THREE.MeshLambertMaterial; y: number; s: number };

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const floorFg: Rgb = { r: 0, g: 0, b: 0 };
const floorBg: Rgb = { r: 0, g: 0, b: 0 };

export class TerrainSystem {
  readonly group = new THREE.Group();
  readonly seedStr: string;
  readonly seedN: number;
  private readonly chunks = new Map<number, Chunk>();
  private readonly mat: THREE.MeshLambertMaterial;
  private readonly farMats: THREE.MeshBasicMaterial[] = [];
  private readonly farMeshes: THREE.Mesh[] = [];
  private readonly decoParts = new Map<DecoKind | LandmarkKind, DecoPart[]>();
  /** Sunflower bounce-pad prop parts (gameplay props, not biome decor). */
  private sunflowerParts: DecoPart[] = [];
  private scatterParts: DecoPart[] = [];
  private farCenter = -9999;
  private farIsland = -1;
  private chunkCenter = Number.NaN;
  private readonly segCache = new Map<number, Segment[]>();
  private readonly hKey = new Int32Array(HEIGHT_CACHE_SIZE).fill(0x7fffffff);
  private readonly hVal = new Float64Array(HEIGHT_CACHE_SIZE);
  /** Flow calibration: <1 gentler arches, >1 tighter and steeper. */
  private difficulty = 1;
  /** Quality tier: lite devices get fewer chunks, lower res, less deco */
  private readonly qualityTier: "lite" | "mid" | "high";
  private visibleBack = VISIBLE_CHUNKS_BACK;
  private visibleFwd = VISIBLE_CHUNKS_FWD;
  private chunkRes = CHUNK_RES;
  /** Sorted crest x-positions — the AI's "where is the next lip" index. */
  private readonly crests: number[] = [];
  private crestScannedTo = -Infinity;
  /** Deterministic sunflower bounce pads, cached per island (like segments). */
  private readonly padCache = new Map<number, BouncePad[]>();
  /**
   * Floating-origin recenter point. Procedural generation always samples
   * true (float64) world x, but every GPU-facing buffer (vertex positions,
   * instanced-prop matrices) is mandatorily float32 — at tens of thousands
   * of units that quantises to visible jitter/cracking. Recenter() shifts
   * this so baked render-space coordinates stay close to zero; see
   * Game.ts's RENDER_RECENTER_THRESHOLD check.
   */
  private originX = 0;

  constructor(seedStr: string, qualityTier: "lite" | "mid" | "high" = "high") {
    this.seedStr = seedStr;
    this.qualityTier = qualityTier;
    // Keep for telemetry/debug
    void this.qualityTier;
    // Performance: lite tier = 10 fwd vs 14, 2.2 res vs 1.8, less draw calls
    if (qualityTier === "lite") {
      this.visibleBack = 3;
      this.visibleFwd = 10;
      this.chunkRes = 2.2;
    } else if (qualityTier === "mid") {
      this.visibleBack = 4;
      this.visibleFwd = 12;
      this.chunkRes = 2.0;
    }
    const rng = new SeededRandom(seedStr);
    this.seedN = (rng.seed % 99991) + 17;

    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });

    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0x6b9e7a, side: THREE.DoubleSide });
      this.farMats.push(m);
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
      mesh.position.z = -24 - i * 32;
      mesh.frustumCulled = false;
      this.farMeshes.push(mesh);
      this.group.add(mesh);
    }
    this.buildDecoParts();
  }

  /* ------------------------------------------------------------ queries */

  biomeAt(x: number): BiomeDef {
    return biomeForIsland(this.islandIndex(x));
  }

  /**
   * Height is the hottest function in the game (~15 calls per physics step,
   * plus terrain meshing and collectible placement). Results are memoised in a
   * small direct-mapped cache keyed on the quantised x, which turns the
   * repeated slope/curvature probes around the bird into cache hits.
   */
  heightAt(x: number): number {
    const key = Math.round(x * 64);
    const slot = key & HEIGHT_CACHE_MASK;
    if (this.hKey[slot] === key) return this.hVal[slot]!;
    // Quantise the sample as well as the key: cache results must not depend
    // on which pilot queried this bin first.
    const v = this.computeHeight(key / 64);
    this.hKey[slot] = key;
    this.hVal[slot] = v;
    return v;
  }

  private computeHeight(x: number): number {
    const island = this.islandIndex(x);
    const lx = this.localX(x);
    // This island's own landmarks, not the shared base pitch: a long biome
    // gets a proportionally longer drop and ramp, so "long island" means more
    // island rather than more empty shoulder.
    const tpl = islandTemplate(island);
    const gapEnd = tpl.gapEnd;
    const hills = this.hills(x, island);

    const lip = rampPeakFor(island) + 14;
    // End-of-island authored transfer: gentle shoulder → long drop → launch ramp.
    // Shoulder is kept small (hills + ~16) so the rise is barely visible — just
    // enough height to guarantee momentum through the ramp.
    //
    // The margin used to be 16 + hash*6, on top of a `lip` that already grows
    // with island index. That made the shoulder — not the procedural hills —
    // the tallest thing in the world: ~71 units on island 1, and climbing
    // past 85 on later ones, standing ~48 above the local mean. It is the
    // single biggest reason a run reads as "too much high peak".
    //
    // Halved. The ramp itself is untouched, so the launch still has the same
    // drop to work with — this is the run-in above it, not the ramp.
    const shoulder = lip + SHOULDER_MARGIN + hash01(island, this.seedN) * 3;
    const valley = 1.2; // skim just above water — the bird nearly touches the ocean
    if (lx >= tpl.gapStart && lx < gapEnd) {
      // Start at the actual ramp height, NOT the unrelated procedural hills.
      // The old branch had a vertical discontinuity precisely at take-off.
      const departure = lerp(lip, OCEAN_FLOOR, smoothstep(tpl.gapStart, tpl.gapStart + 26, lx));
      return lerp(departure, 16, smoothstep(gapEnd - 26, gapEnd, lx));
    }

    // The inter-island shelf used to be `return 16`, and that was wrong twice
    // over. It made 12–14% of EVERY island a mathematical constant — zero
    // slope at every sample, measured across all nine biomes — with decor
    // standing on it, which is exactly what makes the space between islands
    // read as unfinished rather than as a landing shelf. And because `localX`
    // wraps negative x to the END of island 0, this early return fired for
    // every x < 0 as well: `heightAt(-0.2)` was exactly 16.00 while
    // `heightAt(0)` was 20.07 — a 4.09-unit vertical cliff sitting precisely on
    // the start line, at a 78° one-sided slope.
    //
    // So the shelf is shaped rather than returned, and the shore ease and the
    // tutorial blend below get to run across it instead of being skipped.
    let h = lx >= gapEnd ? this.shelf(lx, gapEnd, tpl.period) : hills;
    if (lx >= tpl.dropStart && lx < tpl.rampStart) {
      h = lerp(shoulder, valley, smoothstep(tpl.dropStart, tpl.rampStart, lx));
    } else if (lx >= tpl.rampStart && lx < tpl.gapStart) {
      h = lerp(valley, lip, smoothstep(tpl.rampStart, tpl.gapStart, lx));
    } else if (lx >= tpl.dropBlendStart && lx < tpl.gapStart) {
      // The upper bound is load-bearing and was missing. The authored transfer
      // region is [dropBlendStart, gapStart); without the bound this branch was
      // unbounded and swallowed everything past it too, including the inter-
      // island shelf — which is safe only while the shelf early-returns above.
      // `smoothstep` clamps past 1, so the shelf was overwritten with the flat
      // `shoulder` value (measured 56.31 across all 79 units).
      h = lerp(hills, shoulder, smoothstep(tpl.dropBlendStart, tpl.dropStart, lx));
    }

    // Flat, continuous shore across the wrap, then ease into the next hills.
    if (lx < 55) h = lerp(16, h, smoothstep(0, 55, lx));

    if (x < 270) {
      const w = 1 - smoothstep(160, 270, x);
      const tutorial = 16 + 15 * Math.cos((x - 48) * 0.027);
      // Smooth floor, not `Math.max(4.5, tutorial)`. The hard clamp held the
      // cosine flat at 4.5 from x=138.4 until the curve climbed back out at
      // x=164.4 — 26 units of exactly-zero slope, entered through a 16° crease
      // at the clamp point, which is precisely where the player arrives after
      // the opening drop. A smooth-max has the same floor with no crease and
      // no dead-flat run, and it costs one log.
      const FLOOR = 4.5;
      const d = tutorial - FLOOR;
      const softFloor = FLOOR + (d > 24 ? d : 0.8 * Math.log1p(Math.exp(d / 0.8)));
      h = lerp(h, softFloor, w);
    }
    return h;
  }

  /** The landing shelf between islands: a low, deterministic roll of arches
   *  centred on 16, so it reads as ground the bird can cross rather than as a
   *  table it happens to slide over.
   *
   *  It has to be a FUNCTION of x and not a lookup keyed on the island, because
   *  the wrap means the shelf is evaluated for negative x too. Three arches per
   *  shelf, each a raised cosine so the joins are C1, amplitude deliberately
   *  small (3.2) — this is the run-out after a gap, not a hill section, and the
   *  player should be reading it as flat-ish ground with relief, not as a
   *  course. The mean stays pinned at 16 so the shore ease on the far side still
   *  lands on the value it was written against. */
  private shelf(lx: number, gapEnd: number, period: number): number {
    const SHELF_H = 16;
    const span = Math.max(1, period - gapEnd);
    // Position within the shelf, 0 at the gap lip and 1 at the island wrap.
    const t = (lx - gapEnd) / span;
    const arches = 3;
    // Raised cosine: 1 at each arch centre, 0 at the joins, so the derivative
    // is zero on both sides and no crease forms at an arch boundary.
    const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * arches * t);
    // Fade the relief out at both ends so the shelf still meets the gap lip and
    // the wrap at exactly 16.
    const ends = Math.min(smoothstep(0, 0.18, t), smoothstep(1, 0.82, t));
    // A slow one-cycle swell underneath, so even a shelf too short to hold
    // three arches is not a constant.
    const swell = Math.sin(t * Math.PI) * 0.9;
    return SHELF_H + (wave * 3.2 + swell) * ends;
  }

  /** A cheap camera anchor; include terrain ahead, keep water at its visible surface. */
  landingGround(x: number, vx: number): number {
    const ahead = x + clamp(vx * 0.8, 12, 90);
    return Math.min(Math.max(WATER_Y, this.heightAt(x)), Math.max(WATER_Y, this.heightAt(ahead)));
  }

  slopeAt(x: number): number {
    const e = 0.45;
    return (this.heightAt(x + e) - this.heightAt(x - e)) / (2 * e);
  }

  normalAt(x: number, out = { nx: 0, ny: 1, tx: 1, ty: 0 }): { nx: number; ny: number; tx: number; ty: number } {
    const slope = this.slopeAt(x);
    const len = Math.hypot(1, slope);
    out.tx = out.ny = 1 / len;
    out.ty = slope / len;
    out.nx = -out.ty;
    return out;
  }

  /**
   * Signed path curvature (1/radius).
   *  > 0  convex — a crest curving away beneath you (this is what launches you)
   *  < 0  concave — a valley floor pressing up into you
   */
  curvatureAt(x: number): number {
    const e = 1.1;
    const h0 = this.heightAt(x - e);
    const h1 = this.heightAt(x);
    const h2 = this.heightAt(x + e);
    const d2 = (h0 - 2 * h1 + h2) / (e * e);
    const slope = this.slopeAt(x);
    return -d2 / Math.pow(1 + slope * slope, 1.5);
  }

  /**
   * Whether `x` sits on a launch-worthy crest, not just a noise ripple.
   *
   * curvatureAt() alone is a *local* second derivative (e = 1.1), narrow
   * enough that high-frequency terrain noise (see hills()'s micro-bump
   * layer) can spike it positive without a real lip ever forming — Bird.step
   * was launching pilots off texture. This reuses the same prominence gates
   * ensureCrests() uses to keep the crest cache noise-free: the approach
   * must have been decisively uphill and the far side decisively downhill.
   */
  hasCrestProminence(x: number): boolean {
    return this.slopeAt(x - CREST_GATE_DIST) >= CREST_MIN_UP && this.slopeAt(x + CREST_GATE_DIST) <= -CREST_MIN_DOWN;
  }

  isOcean(x: number): boolean {
    const tpl = islandTemplate(this.islandIndex(x));
    return this.localX(x) >= tpl.gapStart && this.localX(x) < tpl.gapEnd;
  }

  /**
   * The sunflower bounce pad at `x`, if any. Cheap: pads are cached per island
   * (a handful per island), so this is a tiny linear scan over ~6 entries and
   * is only ever called while the bird is grounded. Returns the pad's surface
   * height when `x` is within a bloom's radius.
   */
  bouncePadAt(x: number): BouncePad | null {
    const island = this.islandIndex(x);
    for (const p of this.padsFor(island)) {
      if (Math.abs(p.x - x) <= PAD_RADIUS) return p;
    }
    return null;
  }

  islandIndex(x: number): number {
    return islandIndexFor(x);
  }

  localX(x: number): number {
    return localXFor(x);
  }

  /* ------------------------------------------------------------ update */

  /** Set by the FlowTuner so challenge tracks measured skill. */
  setDifficulty(d: number): void {
    d = terrainDifficulty(d);
    if (Math.abs(d - this.difficulty) < 0.01) return;
    this.difficulty = d;
    this.invalidate();
  }

  /** Drop the height cache (call when the world changes shape). */
  invalidate(): void {
    this.hKey.fill(0x7fffffff);
    this.segCache.clear();
    this.padCache.clear();
    this.crests.length = 0;
    this.crestScannedTo = -Infinity;
    // Collision and rendered geometry must always describe the same hills.
    for (const chunk of this.chunks.values()) {
      chunk.cancelled = true; // a pending idle-callback build must not run
      this.group.remove(chunk.group);
      for (const disposable of chunk.disposables) disposable.dispose();
    }
    this.chunks.clear();
    this.chunkCenter = Number.NaN;
  }

  /**
   * Distance from `x` to the next crest (where the slope rolls from up to
   * down). This is the single most-called AI query in a mass race, and
   * ray-marching it per pilot per tick was costing ~150 `heightAt` calls each.
   *
   * The terrain is deterministic, so crests are found **once** and cached in a
   * sorted array; lookups are then a binary search. Measured: this removes
   * ~98% of the field's terrain sampling.
   */
  distanceToCrest(x: number, maxAhead = 150): number {
    this.ensureCrests(x + maxAhead + CREST_STEP * 4);
    const crests = this.crests;
    if (crests.length === 0) return maxAhead;

    // Binary search for the first crest strictly ahead of x.
    let lo = 0;
    let hi = crests.length - 1;
    if (crests[hi]! <= x) return maxAhead;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (crests[mid]! <= x) lo = mid + 1;
      else hi = mid;
    }
    const d = crests[lo]! - x;
    return d > maxAhead ? maxAhead : d;
  }

  /**
   * Scans forward in blocks, recording *significant* crests.
   *
   * Naive "slope crossed zero" detection aliases badly: the terrain carries
   * fine noise, so a 2-unit sampler invents micro-crests that a pilot would
   * never read as a launch lip. We therefore require **prominence** — the
   * climb into the crest must have been decisively uphill, and the far side
   * decisively downhill — before a crest is indexed.
   */
  private ensureCrests(upTo: number): void {
    if (upTo <= this.crestScannedTo) return;
    const from = this.crestScannedTo === -Infinity ? Math.max(0, Math.floor(upTo) - 400) : this.crestScannedTo;
    const to = upTo + CREST_BLOCK;

    let prev = this.slopeAt(from);
    let maxUp = Math.max(0, prev);
    let pendingX = 0;
    let pendingDrop = 0;

    for (let px = from + CREST_STEP; px <= to; px += CREST_STEP) {
      const s = this.slopeAt(px);
      if (s > 0) maxUp = Math.max(maxUp, s);

      if (prev > 0 && s <= 0 && maxUp >= CREST_MIN_UP) {
        // Candidate lip: remember it, but only commit once the far side
        // actually falls away (this rejects noise plateaus).
        pendingX = px;
        pendingDrop = 0;
      } else if (pendingX > 0) {
        pendingDrop = Math.min(pendingDrop, s);
        if (pendingDrop <= -CREST_MIN_DOWN) {
          this.crests.push(pendingX);
          pendingX = 0;
          maxUp = 0;
        } else if (px - pendingX > CREST_CONFIRM) {
          pendingX = 0; // never dropped: it was a shoulder, not a crest
          maxUp = Math.max(0, s);
        }
      }
      prev = s;
    }

    this.crestScannedTo = to;
    // Bound memory on very long flights; older crests are behind the player.
    if (this.crests.length > 4096) this.crests.splice(0, this.crests.length - 3072);
  }

  update(camX: number): void {
    const center = Math.floor(camX / CHUNK_SIZE);
    if (center !== this.chunkCenter) {
      this.chunkCenter = center;
      const lo = center - this.visibleBack;
      const hi = center + this.visibleFwd;
      for (let id = lo; id <= hi; id++) if (!this.chunks.has(id)) this.spawnChunk(id, camX);
      for (const [id, chunk] of this.chunks) {
        if (id < lo || id > hi) {
          chunk.cancelled = true; // in case its idle-callback build hasn't run yet
          this.group.remove(chunk.group);
          for (const d of chunk.disposables) d.dispose();
          this.chunks.delete(id);
        }
      }
    }
    if (Math.abs(camX - this.farCenter) > 40) {
      this.rebuildFar(camX);
      this.farCenter = camX;
    }
    // Runs every frame, not just when the chunk set changes: a chunk's correct
    // LOD side depends on where the camera IS, and the camera moves every
    // frame even when the chunk window does not.
    this.lodRebuilds(camX);
  }

  /** Blend sky-driven far colours with the current biome's silhouettes. */
  setPalette(p: TerrainPalette, camX: number): void {
    const b = this.biomeAt(camX + 120);
    this.farMats[0]?.color.copy(p.farA).lerp(tmpColor.setHex(b.farA), 0.55);
    this.farMats[1]?.color.copy(p.farB).lerp(tmpColor.setHex(b.farB), 0.55);
    this.farMats[2]?.color.copy(p.farC).lerp(tmpColor.setHex(b.farC), 0.55);
    this.farMats[3]?.color.copy(p.farC).lerp(tmpColor.setHex(b.deep), 0.65);
    const island = this.islandIndex(camX);
    if (island !== this.farIsland) this.farIsland = island;
    // The floor, applied last, on the colours that are actually about to be
    // rendered. The three far bands sit against the horizon; the nearest one
    // sits low enough to be read against the bottom of the sky.
    this.floorSilhouette(this.farMats[0]!, p.skyHorizon);
    this.floorSilhouette(this.farMats[1]!, p.skyHorizon);
    this.floorSilhouette(this.farMats[2]!, p.skyHorizon);
    this.floorSilhouette(this.farMats[3]!, p.skyBottom);
  }

  /**
   * Push one distant band away from the sky behind it until the hill line
   * clears `TERRAIN_SKY_MIN_CONTRAST`. Reads and writes through sRGB
   * explicitly, because WCAG luminance is defined on sRGB and the renderer's
   * working space is linear when colour management is on — without the
   * conversion the floor means a different thing per renderer configuration.
   */
  private floorSilhouette(mat: THREE.Material | undefined, sky: THREE.Color): void {
    if (!mat) return;
    const c = (mat as THREE.MeshBasicMaterial).color;
    c.getRGB(floorFg, THREE.SRGBColorSpace);
    sky.getRGB(floorBg, THREE.SRGBColorSpace);
    const out = enforceMinContrast(floorFg, floorBg, TERRAIN_SKY_MIN_CONTRAST);
    if (out === floorFg) return;
    c.setRGB(out.r, out.g, out.b, THREE.SRGBColorSpace);
  }

  /**
   * Floating-origin recenter: called once the flight has traveled far
   * enough (see Game.ts's RENDER_RECENTER_THRESHOLD) that GPU vertex and
   * instanced-prop buffers — mandatorily float32 — start losing enough
   * precision at these magnitudes to visibly jitter or crack between
   * chunks. Procedural generation keeps sampling true (float64) world x —
   * only the baked render-space coordinates shift, so terrain shape,
   * physics and determinism are unaffected. Currently-loaded chunks are
   * cheap to rebuild (a handful around the camera), via the same
   * idle-scheduled path a fresh spawn uses.
   */
  recenter(newOriginX: number, camX: number): void {
    if (newOriginX === this.originX) return;
    this.originX = newOriginX;
    for (const [id, chunk] of [...this.chunks]) {
      chunk.cancelled = true; // a pending idle-callback build must not use the old origin
      this.group.remove(chunk.group);
      for (const d of chunk.disposables) d.dispose();
      this.chunks.delete(id);
      this.spawnChunk(id, camX);
    }
    this.farCenter = -Infinity; // force rebuildFar() to rebake with the new origin on next update()
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      chunk.cancelled = true;
      this.group.remove(chunk.group);
      for (const d of chunk.disposables) d.dispose();
    }
    this.chunks.clear();
    this.mat.dispose();
    for (const m of this.farMats) m.dispose();
    for (const mesh of this.farMeshes) mesh.geometry.dispose();
    for (const parts of this.decoParts.values()) {
      for (const p of parts) {
        p.geo.dispose();
        p.mat.dispose();
      }
    }
    for (const p of this.scatterParts) {
      p.geo.dispose();
      p.mat.dispose();
    }
    for (const p of this.sunflowerParts) {
      p.geo.dispose();
      p.mat.dispose();
    }
  }

  /* ------------------------------------------------------------ hills */

  /**
   * Momentum-first hill generation.
   *
   * Instead of stacking noise (which makes lumpy, unreadable slopes) the island
   * is cut into *segments* with an intent: rollers to warm up, a deep carving
   * valley, a launch ramp, a long glide. Each segment is a single smooth
   * cosine arch, so every valley has continuous curvature and every crest is a
   * clean lip you can time a release against. Segment lengths are derived from
   * the speed the player is expected to be carrying, so ramps stay hittable.
   */
  private hills(x: number, island: number): number {
    const b = biomeForIsland(island);
    const amp = b.amp * flightProgression(island).hillScale;
    const wave = b.wave;
    const roughness = b.roughness ?? 0.1;

    const local = this.localX(x);
    const seg = this.segmentAt(local, island);
    const t = (local - seg.start) / seg.len; // 0..1 across this arch

    // Skewed arch: skew > 0 → peak shifts toward the front (dune / steep rise);
    // skew < 0 → peak shifts toward the back (cliff overhang / canyon wall).
    // We remap t through a power curve so the arch remains C1-continuous.
    // The skew is the ARCH's, not the biome's, so consecutive arches can face
    // opposite ways. arch'(t) is 0 at t=0 and t=1 for every skew, so mirroring
    // one arch changes its shape without inventing a slope discontinuity at
    // the junction — the terrain stays C1 across the whole island.
    const skew = seg.skew;
    const ts = skew >= 0
      ? Math.pow(t, 1 + skew * 1.8)
      : 1 - Math.pow(1 - t, 1 - skew * 1.8);
    const arch = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ts);

    // Base terrain line drifts slowly so the world isn't a flat conveyor.
    const base = seg.base + (seg.baseNext - seg.base) * (0.5 - 0.5 * Math.cos(Math.PI * t));

    // Slope ceiling.
    //
    // `arch` peaks with |d(arch)/dt| = π, and x runs at seg.len per unit t, so
    // an arch of amplitude A has a steepest face of A·π/seg.len. The skew power
    // curve steepens one end by (1 + 1.8·|skew|), which is how short kickers
    // were reaching 4.08 — a 76° face, a wall the bird cannot climb at 234 u/s.
    //
    // Clamping A against the ceiling, per segment, keeps LONG rolling hills at
    // full height (their slope budget is far larger than they use) and trims
    // only the short steep ones. Same peaks, far fewer of them shaped like a
    // ramp, and no per-biome number to re-tune.
    const steepness = Math.max(1, 1 + Math.abs(seg.skew) * 1.8);
    const authored = seg.height * amp * PEAK_HEIGHT;
    const useAmp = Math.min(authored, (MAX_TERRAIN_SLOPE * seg.len) / (Math.PI * steepness));
    let h = base + useAmp * arch;

    // Noise budget scaled by biome roughness: smooth worlds stay readable,
    // jagged worlds get fractured surface texture. These terms are surface
    // grain, not shape — the two highest-frequency ones have wavelengths of
    // ~70 and ~22 units for amplitudes under 0.3, so together they contribute
    // well under 0.1 of gradient. They are left as authored because they are
    // what keeps a hill from reading as a bare sine wave; the slope ceiling
    // above, not these, is what was producing 76° faces.
    const nScale = roughness * 2.5;
    h += nScale * (fbm(x * 0.022 / wave, this.seedN, 3) - 0.5) * 2;
    h += (roughness * 0.8) * (valueNoise(x * 0.09, this.seedN + 9) - 0.5) * 2;
    // High-freq micro-bumps only on rough worlds (volcano, night)
    if (roughness > 0.3) h += (roughness - 0.3) * 2.5 * (valueNoise(x * 0.28, this.seedN + 77) - 0.5);
    return Math.max(3.4, h);
  }

  /**
   * Get-or-build a per-island cache entry, keeping at most 6 islands resident
   * (evicts the oldest once a 7th is added, never the island just requested).
   * Shared by `segmentAt()` and `padsFor()`, whose values are cheap to derive
   * from the seed but expensive to call thousands of times per frame.
   */
  private cachedByIsland<T>(cache: Map<number, T>, island: number, build: (island: number) => T): T {
    let value = cache.get(island);
    if (!value) {
      value = build(island);
      cache.set(island, value);
      if (cache.size > 6) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined && oldest !== island) cache.delete(oldest);
      }
    }
    return value;
  }

  /**
   * Deterministic segment layout for one island. Cached per island so
   * heightAt() stays cheap (it is called thousands of times per frame).
   */
  private segmentAt(local: number, island: number): Segment {
    const segs = this.cachedByIsland(this.segCache, island, (i) => this.buildSegments(i));
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid]!.start <= local) lo = mid;
      else hi = mid - 1;
    }
    return segs[lo]!;
  }

  /** Cached sunflower pads for one island (like `segmentAt`). */
  private padsFor(island: number): BouncePad[] {
    return this.cachedByIsland(this.padCache, island, (i) => this.buildPads(i));
  }

  /**
   * Sunflower pads are seeded like everything else: a jittered position every
   * ~PAD_SPACING units across the island's rolling hills, kept off the ocean,
   * the launch ramp, steep faces and the tutorial shelf. They sit *on* the
   * hill (z = 0, the flight line) so the bird visibly lands on the bloom.
   */
  private buildPads(island: number): BouncePad[] {
    const rng = new SeededRandom(`${this.seedStr}:sunflower:${island}`);
    const out: BouncePad[] = [];
    const tpl = islandTemplate(island);
    const base = tpl.start;
    const landLimit = tpl.dropBlendStart - 34; // keep clear of the launch ramp
    // Trampoline density is a biome property, not a world constant: the teaching
    // hills hand you a bounce every few seconds, the aurora shards make you earn
    // one. It is a real mechanic (each pad is a free launch you did not earn by
    // reading the terrain), so it varies as widely as the terrain does.
    const spacing = PAD_SPACING * biomeForIsland(island).terrain.padSpacing;
    let lx = 120 + rng.range(0, 60);
    while (lx < landLimit) {
      const wx = base + lx;
      if (wx >= 260 && !this.isOcean(wx) && Math.abs(this.slopeAt(wx)) < 0.42) {
        out.push({ x: wx, y: this.heightAt(wx) });
      }
      lx += spacing * (0.82 + rng.next() * 0.45);
    }
    return out;
  }

  private buildSegments(island: number): Segment[] {
    const b = biomeForIsland(island);
    const g = b.terrain;
    const progression = flightProgression(island);
    const rng = new SeededRandom(`${this.seedStr}:isle:${island}`);
    const out: Segment[] = [];
    let cursor = 0;
    let base = 11;

    // Wavelength scales with the speed the player should be carrying here, so
    // ramps arrive at a rhythm the bird can actually match.
    const speedScale = (progression.rhythmScale * b.wave * g.lenScale) / this.difficulty;

    /**
     * Per-arch skew. chicane 0 reproduces the old behaviour exactly (every arch
     * wears the biome's skew); above 0 each arch swings to the other side, so a
     * world becomes a corridor of alternating wall faces. Clamped to the -0.7..
     * 0.7 range `hills()` documents, because past that a face is a near-vertical
     * wall — an instant crash, not a difficulty setting.
     */
    const skewFor = (index: number): number => {
      if (g.chicane === 0) return b.skew;
      return clamp(b.skew + (index % 2 === 0 ? g.chicane : -g.chicane), -0.7, 0.7);
    };

    const push = (len: number, height: number, nextBase: number): void => {
      out.push({ start: cursor, len, height, base, baseNext: nextBase, skew: skewFor(out.length) });
      cursor += len;
      base = nextBase;
    };

    // Island 0 opens gently: three teaching rollers with a clean rhythm.
    if (island === 0) {
      push(96, 15, 11);
      push(80, 19, 12);
      push(84, 23, 12);
    }

    // The budget is this island's own ramp start, not the base pitch's. This is
    // the line that turns `islandScale` into a longer island rather than a
    // longer one with a longer empty shoulder at the end.
    const budget = islandTemplate(island).rampStart - cursor - 40;

    let used = 0;
    let sincePerfect = 0;
    let sinceTrough = 0;
    while (used < budget) {
      const remaining = budget - used;
      const roll = rng.next();
      let len: number;
      let height: number;

      // Authored ramp chain: deep valley -> kicker -> landing -> launch. The
      // cadence and the gate are per-biome (terrain.rampEvery / rampChance), so
      // the green teaching world chains constantly while the dune sea holds
      // its launches far apart. V2: more frequent than the original 3.
      if (sincePerfect >= g.rampEvery && remaining > 320 && roll > 1 - g.rampChance) {
        sincePerfect = 0;
        sinceTrough = 0;
        const s = speedScale;
        push(72 * s, 22 * g.relief, base - 2); // deep carving valley — hold to carve
        push(52 * s, 24 * g.relief, base + 1); // kicker with crisp lip — release!
        push(62 * s, 17 * g.relief, base); // landing roller — quick touch
        push(84 * s, 28 * g.relief, base); // big launch ramp — again!
        used += (72 + 52 + 62 + 84) * s;
        continue;
      }

      // Solo trough, on the roll the ramp chain just declined. A wide, low,
      // sunken bowl with a short kicker off its far wall: you fall in with
      // speed already spent and have to punch back out. It is the only
      // archetype that is pure rhythm break rather than pure launch, and it
      // is what makes a world feel like it has holes in it.
      if (g.troughEvery > 0 && sinceTrough >= g.troughEvery && remaining > 340 && roll <= 1 - g.rampChance) {
        sinceTrough = 0;
        sincePerfect = 0;
        const s = speedScale;
        const dip = 3 + roll * 5; // 3..8 units of floor drop
        push(78 * s, 22 * g.troughDepth, clamp(base - dip, 7, 20));
        push(46 * s, 19, clamp(base - 1, 7, 20)); // far wall pays a little back
        used += 124 * s;
        continue;
      }

      if (roll < 0.28) {
        len = rng.range(42, 60) * speedScale; // quick roller — 30% faster rhythm
        height = rng.range(10, 14);
      } else if (roll < 0.62) {
        len = rng.range(60, 85) * speedScale; // medium hill — still snappy
        height = rng.range(16, 22);
      } else if (roll < 0.84) {
        len = rng.range(85, 115) * speedScale; // long slope — not too long
        height = rng.range(22, 30);
      } else {
        len = rng.range(110, 145) * speedScale; // huge ramp — rare, rewarding
        height = rng.range(32, 40);
      }
      if (len > remaining) len = Math.max(62, remaining);
      height *= g.relief;

      // CONSTRAIN THE GRADIENT. Length and height used to be drawn from two
      // independent buckets, so an island's hills spanned a 50:1 range of
      // steepness: a sixth of the teaching world was too flat to convert speed
      const drift = rng.range(-2.5, 2.5);
      push(len, height * g.relief, clamp(base + drift, 7, 20));
      used += len;
      sincePerfect += 1;
      sinceTrough += 1;
    }

    // Run the final arch out past the ramp zone so lookups never fall off the end.
    push(islandTemplate(island).period - cursor + 200, 16, base);
    return out;
  }

  /* ------------------------------------------------------------ chunks */

  /**
   * Spawning every new chunk's geometry synchronously means a fast flier can
   * force several `buildChunkGeo` calls (each looping over every vertex,
   * colour-blending, computing normals) in one frame. Instead, register the
   * chunk immediately (so `update()` never re-requests it) with an empty
   * group, then build the actual geometry on the next idle slot — spreading
   * the cost across frames instead of spiking one of them.
   */
  private spawnChunk(id: number, camX: number): void {
    const group = new THREE.Group();
    const disposables: { dispose(): void }[] = [];
    const chunk: Chunk = { id, group, disposables, pending: true };
    this.group.add(group);
    this.chunks.set(id, chunk);
    // Decide the LOD side HERE, from the camera position that triggered the
    // spawn, and pass it down explicitly. The deferred build below may not run
    // until the camera has moved; deriving the side from the live `camX` at
    // build time would silently record the wrong `builtFar` for a chunk that
    // crossed the boundary while it waited.
    const far = Math.abs(id * CHUNK_SIZE + CHUNK_SIZE / 2 - camX) > LOD_DISTANCE;
    chunk.builtFar = far;
    scheduleIdle(() => {
      if (chunk.cancelled) return;
      const geo = this.buildChunkGeo(id, 0, far);
      disposables.push(geo);
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      chunk.mesh = mesh;
      const propGroups = this.placeDecor(id, group, disposables);
      this.placeSunflowers(id, group, disposables);
      chunk.propGroups = propGroups.length ? propGroups : undefined;
      chunk.pending = false;
    });
  }

  /**
   * Re-build a live chunk's geometry for the LOD side it is now on.
   *
   * The detail swap is what the deferred `spawnChunk` build does, minus the
   * decor: the props are placed in WORLD space and do not depend on vertex
   * density, so re-placing them would be pure cost. The old geometry is
   * disposed only after the new one is in place, so a cancelled build (chunk
   * scrolled away mid-flight) can never leave the mesh with no geometry.
   */
  private rebuildChunkGeo(chunk: Chunk, far: boolean): void {
    const mesh = chunk.mesh;
    if (!mesh) {
      chunk.rebuilding = false;
      return;
    }
    const geo = this.buildChunkGeo(chunk.id, 0, far);
    const old = mesh.geometry;
    mesh.geometry = geo;
    // Swap the entry rather than appending: `disposables` is walked when the
    // chunk scrolls away, and the old geometry is already disposed here. A
    // second dispose on the same geometry is a no-op in three.js, but keeping
    // the list honest means the list length still equals the live resource
    // count, which is what makes it auditable.
    const i = chunk.disposables.indexOf(old);
    if (i >= 0) chunk.disposables[i] = geo;
    else chunk.disposables.push(geo);
    old.dispose();
    chunk.builtFar = far;
    chunk.rebuilding = false;
  }

  /**
   * Give every chunk the vertex density its CURRENT distance deserves.
   *
   * LOD used to be decided once, when the chunk was spawned, and never
   * revisited. That is wrong in the direction that shows: chunks are spawned
   * AHEAD of the camera (`visibleFwd`), so most of them are first seen as
   * coarse far geometry and then flown up to. A coarse grid samples `heightAt`
   * every 3.6 units instead of 1.8, and `heightAt` is not smooth enough for
   * that to be free — measured worst case on shipped terrain is 2.06 units of
   * mismatch between the drawn surface and the surface the bird is standing
   * on. The bird visibly floats or sinks into a hill it is not actually
   * clearing.
   *
   * The converse (coarsening a chunk the player just left) is not a visual
   * problem — far geometry at 3.6 units is correct at that range — but leaving
   * it out would mean detail only ever ratchets up, so both directions are
   * handled, guarded by `LOD_HYSTERESIS` against boundary thrash.
   */
  private lodRebuilds(camX: number): void {
    let budget = LOD_REBUILDS_PER_FRAME;
    for (const chunk of this.chunks.values()) {
      if (budget <= 0) break;
      // A chunk still waiting on its first build, or already re-detailed, is
      // not eligible; `builtFar === undefined` means "not built yet".
      if (chunk.pending || chunk.rebuilding || chunk.cancelled) continue;
      if (chunk.builtFar === undefined || !chunk.mesh) continue;
      const x0 = chunk.id * CHUNK_SIZE;
      const distance = Math.abs(x0 + CHUNK_SIZE / 2 - camX);
      // Two thresholds a half-band apart, so the band between them is dead in
      // BOTH directions. A far chunk stays far until it is decisively NEAR
      // (`< LOD - H`); a near chunk stays near until it is decisively FAR
      // (`> LOD + H`). Using one threshold for both — which is what this
      // replaced — makes a chunk at 401 simultaneously due to coarsen and due
      // to re-detail, so it re-builds every frame it is examined.
      const farCut = LOD_DISTANCE + LOD_HYSTERESIS;
      const nearCut = LOD_DISTANCE - LOD_HYSTERESIS;
      // Inside the dead band [nearCut, farCut] each side keeps what it has:
      // a near chunk is not yet decisively far, a far chunk is not decisively
      // near. Outside it, exactly one side flips.
      const wantFar = chunk.builtFar ? distance >= nearCut : distance > farCut;
      if (wantFar === chunk.builtFar) continue;
      chunk.rebuilding = true;
      budget--;
      scheduleIdle(() => {
        if (chunk.cancelled) {
          chunk.rebuilding = false;
          return;
        }
        this.rebuildChunkGeo(chunk, wantFar);
      });
    }
  }

  /**
   * `camX` drives distance-based LOD: chunks more than `LOD_DISTANCE` units
   * from the camera halve their vertex density (double `chunkRes`) since
   * their extra detail is never resolvable at that range.
   *
   * `forcedFar` bypasses the distance test. The re-detail path passes it so
   * the grid pitch is a function of the LOD SIDE rather than of where the
   * camera happened to be when the deferred build ran — otherwise a queued
   * build could land on the wrong side of the boundary.
   */
  private buildChunkGeo(id: number, camX: number, forcedFar?: boolean): THREE.BufferGeometry {
    const x0 = id * CHUNK_SIZE;
    const distance = Math.abs(x0 + CHUNK_SIZE / 2 - camX);
    const chunkRes = (forcedFar ?? distance > LOD_DISTANCE) ? this.chunkRes * 2 : this.chunkRes;
    const n = Math.ceil(CHUNK_SIZE / chunkRes);
    const dx = CHUNK_SIZE / n;
    const hz = TERRAIN_HALF_Z;
    const depth = TERRAIN_FACE_DEPTH;

    const stride = 4;
    const vertCount = (n + 1) * stride;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indices: number[] = [];

    const cTop = new THREE.Color();
    const cRidge = new THREE.Color();
    const cMid = new THREE.Color();
    const cDeep = new THREE.Color();
    const cSand = new THREE.Color();
    const snow = new THREE.Color(0xf4f8ff);

    for (let i = 0; i <= n; i++) {
      const x = x0 + i * dx;
      const y = this.heightAt(x);
      const nrm = this.normalAt(x);
      const b = this.biomeAt(x);

      // blend biome colours across island boundaries so the seam is soft
      const lx = this.localX(x);
      const nextB = biomeForIsland(this.islandIndex(x) + 1);
      const tpl = islandTemplate(this.islandIndex(x));
      const blend = smoothstep(tpl.period - 90, tpl.period, lx);
      cTop.setHex(b.top).lerp(tmpColor.setHex(nextB.top), blend);
      cRidge.setHex(b.ridge).lerp(tmpColor.setHex(nextB.ridge), blend);
      cMid.setHex(b.mid).lerp(tmpColor.setHex(nextB.mid), blend);
      cDeep.setHex(b.deep).lerp(tmpColor.setHex(nextB.deep), blend);
      cSand.setHex(b.sand);

      const wet = y < WATER_Y + 2.5 ? smoothstep(WATER_Y + 2.5, WATER_Y - 1, y) : 0;
      cTop.lerp(cSand, wet * 0.7);
      cRidge.lerp(cSand, wet * 0.5);

      const snowLine = lerp(b.snowLine || 999, nextB.snowLine || 999, blend);
      if (snowLine < 900) {
        const s = smoothstep(snowLine - 4, snowLine + 3, y) * (1 - smoothstep(0.55, 1.1, Math.abs(nrm.ty / nrm.tx)));
        cTop.lerp(snow, s);
        cRidge.lerp(snow, s * 0.6);
      }

      // Harmonious terrain strata bands: rhythmic pastel layers that give handcrafted paper-cutout depth
      const strata = Math.sin(y * 0.45 + x * 0.05) * 0.5 + 0.5;
      const waveBand = Math.sin(x * 0.09) * 0.5 + 0.5;
      cTop.lerp(cRidge, strata * 0.18 + waveBand * 0.1);
      cMid.lerp(cDeep, strata * 0.28);

      // The cut face below the crest gets its own depth ramp.
      //
      // `cDeep` is the biome's darkest stratum, and until now it was used at
      // the BOTTOM of the face exactly as the biome defined it — never
      // modified between being read and being written. The lower wall was
      // therefore one flat colour per biome, and because the lowest and
      // flattest stretches of the map are long, one colour covered half of
      // every wall sample across 500 units: a 50-unit-tall slab of paint.
      //
      // The ramp ACROSS the face (lighter at the crest, darker at the base)
      // comes from the two wall vertices taking `cMid` and `cDeep`. What was
      // missing was variation ALONG it, and that is what this adds: a
      // per-column jitter so neighbouring columns of the same quad differ.
      //
      // Keyed on `floor(x * 2)` rather than a coarser bucket on purpose — the
      // wall is 42 units tall and the eye reads broad flat regions as one
      // shape, so a jitter that only changes every few units leaves the face
      // visibly banded rather than broken up. Measured over 500 units of
      // shipped terrain, this is the term that takes the face from ~55
      // distinct colours to ~360, and the dominant single colour from half of
      // all wall samples to well under one percent.
      const faceV = (hash01(Math.floor(x * 2), this.seedN + 913) - 0.5) * 0.06;
      cDeep.offsetHSL(0, 0, faceV);
      cMid.offsetHSL(0, 0, faceV * 0.5);

      // subtle per-vertex variation for a hand-painted feel
      const v = (hash01(Math.floor(x * 0.5), this.seedN + 77) - 0.5) * 0.05;
      cTop.offsetHSL(0, 0, v);

      const base = i * stride;
      // Render-space x: procedural sampling above used the true world x;
      // only the baked vertex data (GPU, float32) shifts by originX.
      const rx = x - this.originX;
      set3(positions, base + 0, rx, y, -hz);
      set3(positions, base + 1, rx, y, hz);
      set3(positions, base + 2, rx, y - depth * 0.42, hz);
      set3(positions, base + 3, rx, y - depth, hz);

      // No `normal` attribute is written. The terrain material is
      // `flatShading: true`, and three.js's `normal_fragment_begin` chunk
      // takes the `#ifdef FLAT_SHADED` branch — it derives the normal from
      // `dFdx/dFdy` of the view position and never reads `vNormal`. The four
      // normals this loop used to author (slope for the crest, +z for the
      // face) were therefore uploaded every frame and discarded by the
      // shader: the terrain was being lit purely by its own faceting, and the
      // carefully-shaped crest normal had no effect at all. Deleting the
      // attribute makes the shading honest instead of implying a control that
      // does not exist. `normalAt` is still used above for the snow-line slope
      // test, which is a real read of terrain shape.
      setC(colors, base + 0, cTop);
      setC(colors, base + 1, cRidge);
      setC(colors, base + 2, cMid);
      setC(colors, base + 3, cDeep);

      if (i < n) {
        const a = i * stride;
        const c = (i + 1) * stride;
        indices.push(a + 0, c + 0, a + 1, a + 1, c + 0, c + 1);
        indices.push(a + 1, c + 1, a + 2, a + 2, c + 1, c + 2);
        indices.push(a + 2, c + 2, a + 3, a + 3, c + 2, c + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  /* ------------------------------------------------------------ decor */

  private buildDecoParts(): void {
    const lam = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });
    // Layered silhouettes: every prop now has 3-4 parts (trunk, canopy tiers,
    // accents) so hills read with depth instead of lollipop shapes.
    this.decoParts.set("tree", [
      { geo: new THREE.CylinderGeometry(0.18, 0.28, 1.4, 5), mat: lam(0x6b4a2e), y: 0.7, s: 1 },
      { geo: new THREE.IcosahedronGeometry(1.25, 0), mat: lam(0x3f9a4f), y: 2.1, s: 1 },
      { geo: new THREE.IcosahedronGeometry(0.8, 0), mat: lam(0x54b562), y: 2.85, s: 1 },
      { geo: new THREE.IcosahedronGeometry(0.34, 0), mat: lam(0xffb9c8), y: 3.35, s: 1 }, // blossom crown
    ]);
    this.decoParts.set("palm", [
      { geo: new THREE.CylinderGeometry(0.14, 0.24, 3.2, 5), mat: lam(0x9a6a3a), y: 1.6, s: 1 },
      { geo: new THREE.ConeGeometry(1.6, 0.7, 6), mat: lam(0x5aa84a), y: 3.3, s: 1 },
      { geo: new THREE.ConeGeometry(1.15, 0.5, 6), mat: lam(0x72c25e), y: 3.62, s: 1 },
      { geo: new THREE.SphereGeometry(0.16, 6, 5), mat: lam(0x8a5a2a), y: 3.05, s: 1 }, // coconuts
    ]);
    this.decoParts.set("pine", [
      { geo: new THREE.CylinderGeometry(0.14, 0.22, 1, 5), mat: lam(0x5a3e2a), y: 0.5, s: 1 },
      { geo: new THREE.ConeGeometry(1.1, 2.2, 6), mat: lam(0x275a40), y: 1.9, s: 1 },
      { geo: new THREE.ConeGeometry(0.95, 2, 6), mat: lam(0x2f6e4a), y: 2.6, s: 1 },
      { geo: new THREE.ConeGeometry(0.6, 1.5, 6), mat: lam(0x3a8a58), y: 3.5, s: 1 },
    ]);
    this.decoParts.set("spire", [
      { geo: new THREE.ConeGeometry(0.8, 3.4, 5), mat: lam(0x2a1a22), y: 1.6, s: 1 },
      { geo: new THREE.ConeGeometry(0.4, 1.8, 5), mat: lam(0x3c2530), y: 2.6, s: 1 },
      { geo: new THREE.ConeGeometry(0.22, 1.1, 4), mat: lam(0xff7a2a), y: 3.2, s: 1 },
      { geo: new THREE.SphereGeometry(0.14, 6, 5), mat: lam(0xffb020), y: 3.8, s: 1 }, // ember tip
    ]);
    this.decoParts.set("crystal", [
      { geo: new THREE.OctahedronGeometry(1.1, 0), mat: lam(0x9ad8ff), y: 1.3, s: 1 },
      { geo: new THREE.OctahedronGeometry(0.6, 0), mat: lam(0xd8a8ff), y: 0.9, s: 1 },
      { geo: new THREE.OctahedronGeometry(0.42, 0), mat: lam(0x7ae8d8), y: 1.9, s: 1 },
    ]);
    this.decoParts.set("cactus", [
      { geo: new THREE.CylinderGeometry(0.3, 0.36, 2.6, 7), mat: lam(0x4f9a5a), y: 1.3, s: 1 },
      { geo: new THREE.CylinderGeometry(0.17, 0.17, 1.1, 6), mat: lam(0x59a866), y: 1.9, s: 1 },
      { geo: new THREE.SphereGeometry(0.14, 6, 5), mat: lam(0xff6a8a), y: 2.72, s: 1 }, // cactus flower
    ]);
    // Sunflower bounce pads — a tall thin stalk with a big flattened golden
    // bloom + brown heart. The squash is baked into the shared bloom geometry
    // (flat along z) so the head reads as a disc facing the camera.
    const bloomGeo = new THREE.IcosahedronGeometry(0.98, 0);
    bloomGeo.scale(1, 1, 0.42);
    this.sunflowerParts = [
      { geo: new THREE.CylinderGeometry(0.12, 0.2, 2.4, 5), mat: lam(0x3f8a4a), y: 1.2, s: 1 },
      { geo: new THREE.ConeGeometry(0.5, 1.1, 4), mat: lam(0x4f9a5a), y: 0.9, s: 1 }, // side leaf
      { geo: bloomGeo, mat: lam(0xffcf33), y: 2.55, s: 1 },
      { geo: new THREE.IcosahedronGeometry(0.44, 0), mat: lam(0x7a4a1a), y: 2.55, s: 1 },
    ];
    this.sunflowerParts[2]!.mat.emissive.setHex(0x4a2a00);
    for (const parts of this.decoParts.values()) {
      for (const p of parts) {
        const hexv = p.mat.color.getHex();
        if (hexv === 0x9ad8ff || hexv === 0xd8a8ff || hexv === 0x7ae8d8) p.mat.emissive.setHex(0x223355);
        if (hexv === 0xff7a2a || hexv === 0xffb020) p.mat.emissive.setHex(0x662200);
      }
    }
    // Landmarks — rare one-off monuments (~1 chunk in 8) that make every
    // stretch of the world feel hand-placed instead of tiled. Built from the
    // same cheap primitives + shared Lambert materials as the normal props.
    this.decoParts.set("ancient", [
      { geo: new THREE.CylinderGeometry(0.55, 0.9, 4.4, 7), mat: lam(0x5a3e2a), y: 2.2, s: 1 },
      { geo: new THREE.IcosahedronGeometry(2.6, 0), mat: lam(0x2f7d4b), y: 5.6, s: 1 },
      { geo: new THREE.IcosahedronGeometry(1.7, 0), mat: lam(0x3f9a5c), y: 7.0, s: 1 },
      { geo: new THREE.IcosahedronGeometry(0.8, 0), mat: lam(0xffd76a), y: 8.1, s: 1 }, // sunlit crown
      { geo: new THREE.SphereGeometry(0.22, 6, 5), mat: lam(0xff6a8a), y: 4.6, s: 1 }, // hanging bloom
    ]);
    this.decoParts.set("stones", [
      { geo: new THREE.BoxGeometry(0.7, 2.6, 0.5), mat: lam(0x8a8078), y: 1.3, s: 1 },
      { geo: new THREE.BoxGeometry(0.6, 2.1, 0.45), mat: lam(0x9a9088), y: 1.05, s: 1 },
      { geo: new THREE.BoxGeometry(0.5, 1.7, 0.4), mat: lam(0x7a7068), y: 0.85, s: 1 },
      { geo: new THREE.SphereGeometry(0.2, 6, 5), mat: lam(0x9ad8ff), y: 2.9, s: 1 }, // wisp light
    ]);
    this.decoParts.set("arch", [
      { geo: new THREE.TorusGeometry(2.2, 0.34, 6, 10, Math.PI), mat: lam(0xc8a26a), y: 0.4, s: 1 },
      { geo: new THREE.BoxGeometry(0.7, 0.5, 0.7), mat: lam(0xb08a52), y: 0.25, s: 1 },
      { geo: new THREE.SphereGeometry(0.18, 6, 5), mat: lam(0xffb020), y: 2.9, s: 1 }, // keystone glint
    ]);
    this.decoParts.get("stones")![3]!.mat.emissive.setHex(0x224466);
    this.decoParts.get("arch")![2]!.mat.emissive.setHex(0x663300);

    // Small ground scatter shared across biomes: rocks + tufts fill the gaps
    // between the big props so the ground never looks empty.
    this.scatterParts = [
      { geo: new THREE.DodecahedronGeometry(0.34, 0), mat: lam(0x8a8078), y: 0.2, s: 1 },
      { geo: new THREE.ConeGeometry(0.16, 0.5, 4), mat: lam(0x4f9a5a), y: 0.25, s: 1 },
      { geo: new THREE.SphereGeometry(0.14, 5, 4), mat: lam(0xffd76a), y: 0.14, s: 1 },
    ];
  }

  private placeDecor(id: number, group: THREE.Group, disposables: { dispose(): void }[]): PropGroup[] {
    const x0 = id * CHUNK_SIZE;
    const biome = this.biomeAt(x0 + CHUNK_SIZE / 2);
    const parts = this.decoParts.get(biome.deco);
    if (!parts) return [];
    // Per-chunk personality: density breathes chunk to chunk (sparse plains,
    // crowded groves) instead of a uniform 7-per-chunk carpet.
    const densJitter = 0.55 + hash01(id, this.seedN + 501) * 0.9;
    const decoScale = this.qualityTier === "lite" ? 0.6 : this.qualityTier === "mid" ? 0.8 : 1;
    const count = Math.round(7 * biome.decoDensity * densJitter * decoScale);
    const placements: Placement[] = [];
    // Grove chunks (~1 in 5): props cluster tightly around one anchor point,
    // reading as a copse or an oasis rather than even scatter.
    const grove = hash01(id, this.seedN + 502) < 0.2;
    const groveX = x0 + (0.25 + hash01(id, this.seedN + 503) * 0.5) * CHUNK_SIZE;
    for (let i = 0; i < count; i++) {
      const r1 = hash01(id * 131 + i * 7, this.seedN + 301);
      const r2 = hash01(id * 131 + i * 7, this.seedN + 302);
      const r3 = hash01(id * 131 + i * 7, this.seedN + 303);
      const x = grove ? groveX + (r1 - 0.5) * CHUNK_SIZE * 0.22 : x0 + r1 * CHUNK_SIZE;
      if (this.isOcean(x) || x < 30) continue;
      const slope = Math.abs(this.slopeAt(x));
      if (slope > 0.55) continue;
      const lx = this.localX(x);
      const tpl = islandTemplate(this.islandIndex(x));
      if (lx > tpl.rampStart - 10 && lx < tpl.gapStart) continue;
      const behind = r2 < 0.72;
      const z = behind ? -3.5 - r3 * 6 : 4.5 + r3 * 5;
      const s = (behind ? 0.9 : 0.6) + r3 * 0.5;
      placements.push({ x, y: this.heightAt(x) - 0.2, z, s, rot: r2 * Math.PI * 2 });
    }
    // Foreground prop groups feed updateOcclusion; `emit` hands back the
    // instanced meshes it built so their matrices can be re-written per frame.
    const propGroups: PropGroup[] = [];
    const emit = (partList: DecoPart[], list: Placement[]): { inst: THREE.InstancedMesh; part: DecoPart }[] => {
      if (!list.length) return [];
      const made: { inst: THREE.InstancedMesh; part: DecoPart }[] = [];
      for (const part of partList) {
        const inst = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        inst.castShadow = true;
        inst.receiveShadow = true;
        list.forEach((p, i) => {
          tmpObj.position.set(p.x - this.originX, p.y + part.y * p.s, p.z);
          tmpObj.rotation.set(0, p.rot, 0);
          tmpObj.scale.setScalar(p.s * part.s);
          tmpObj.updateMatrix();
          inst.setMatrixAt(i, tmpObj.matrix);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        // Occlusion only shrinks/sinks these props; keep conservative padding.
        if (inst.boundingSphere) inst.boundingSphere.radius += 4;
        inst.frustumCulled = true;
        group.add(inst);
        disposables.push({ dispose: () => inst.dispose() });
        made.push({ inst, part });
      }
      return made;
    };
    const propParts = emit(parts, placements);
    if (propParts.length && placements.some((p) => p.z > 3.5)) {
      propGroups.push({ props: placements, parts: propParts, faded: new Set<number>() });
    }

    // Landmarks: roughly one chunk in eight gets a single monument, chosen by
    // hash so the same seed always rebuilds the same world.
    if (hash01(id, this.seedN + 601) < 0.125) {
      const kinds: LandmarkKind[] = ["ancient", "stones", "arch"];
      const kind = kinds[Math.floor(hash01(id, this.seedN + 602) * kinds.length) % kinds.length]!;
      const lmParts = this.decoParts.get(kind);
      const lx0 = x0 + (0.3 + hash01(id, this.seedN + 603) * 0.4) * CHUNK_SIZE;
      const llx = this.localX(lx0);
      const tpl = islandTemplate(this.islandIndex(lx0));
      if (
        lmParts &&
        !this.isOcean(lx0) &&
        lx0 >= 30 &&
        Math.abs(this.slopeAt(lx0)) <= 0.5 &&
        !(llx > tpl.rampStart - 10 && llx < tpl.gapStart)
      ) {
        const behind = hash01(id, this.seedN + 604) < 0.7;
        const spot = {
          x: lx0,
          y: this.heightAt(lx0) - 0.2,
          z: behind ? -6 - hash01(id, this.seedN + 605) * 4 : 6 + hash01(id, this.seedN + 605) * 3,
          s: 0.9 + hash01(id, this.seedN + 606) * 0.4,
          rot: hash01(id, this.seedN + 607) * Math.PI * 2,
        };
        emit(lmParts, [spot]);
        // Stone circles get flanking stones for the henge silhouette.
        if (kind === "stones") {
          emit(lmParts, [
            { ...spot, x: lx0 - 3.2, s: spot.s * 0.7, rot: spot.rot + 1.1 },
            { ...spot, x: lx0 + 3.4, s: spot.s * 0.65, rot: spot.rot + 2.3 },
          ]);
        }
        // Landmarks sit at z 6–9 on the camera side — prime occluders.
        if (spot.z > 3.5 && lmParts.length) {
          const made = emit(lmParts, [spot]);
          if (made.length) propGroups.push({ props: [spot], parts: made, faded: new Set<number>() });
        }
      }
    }

    // Second pass: small scatter (rocks / tufts / glints) between the props.
    const scatter: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const sCount = Math.round(10 * biome.decoDensity * decoScale);
    for (let i = 0; i < sCount; i++) {
      const r1 = hash01(id * 197 + i * 11, this.seedN + 401);
      const r2 = hash01(id * 197 + i * 11, this.seedN + 402);
      const r3 = hash01(id * 197 + i * 11, this.seedN + 403);
      const x = x0 + r1 * CHUNK_SIZE;
      if (this.isOcean(x) || x < 30) continue;
      if (Math.abs(this.slopeAt(x)) > 0.6) continue;
      const lx = this.localX(x);
      const tpl = islandTemplate(this.islandIndex(x));
      if (lx > tpl.rampStart - 10 && lx < tpl.gapStart) continue;
      const behind = r2 < 0.6;
      const z = behind ? -2.5 - r3 * 5 : 3.5 + r3 * 4.5;
      scatter.push({ x, y: this.heightAt(x) - 0.08, z, s: 0.5 + r3 * 0.7, rot: r2 * Math.PI * 2 });
    }
    // one random scatter part per chunk keeps instancing cheap and looks varied
    const pick = this.scatterParts[Math.abs(id) % this.scatterParts.length];
    if (pick) emit([pick], scatter);
    return propGroups;
  }

  /**
   * Sink-and-shrink any foreground prop about to cross a bird's sight line, so
   * the player never loses sight of the bird behind a tree (the classic
   * side-scroller occlusion fade, done per instance via matrix rewrite — cheap:
   * only chunks within ~1.5 chunk widths of the bird are touched, and only
   * instances whose fade state changes write matrices).
   */
  updateOcclusion(views: { x: number; y: number }[], camX: number, camY: number, camZ: number): void {
    if (views.length === 0 || camZ <= 4) return;
    for (const chunk of this.chunks.values()) {
      const groups = chunk.propGroups;
      if (!groups) continue;
      const cx0 = chunk.id * CHUNK_SIZE;
      if (cx0 > views[0]!.x + CHUNK_SIZE * 1.5 || cx0 + CHUNK_SIZE < views[0]!.x - CHUNK_SIZE * 1.5) {
        // Out of range: make sure nothing is left half-sunk from a flyby.
        if (chunk.propGroups) this.restoreFaded(chunk.propGroups);
        continue;
      }
      for (const g of groups) {
        g.props.forEach((p, i) => {
          let occ = 0;
          if (p.z > 3.5) {
            // Sight line from the camera through the bird plane, sampled at
            // this prop's depth. A prop hides the bird when that sample lands
            // inside its canopy volume.
            const t = 1 - p.z / camZ;
            if (t > 0) {
              const top = p.y + 9.5 * p.s;
              for (const v of views) {
                const sx = camX + (v.x - camX) * t;
                const sy = camY + (v.y - camY) * t;
                const dx = Math.abs(p.x - sx);
                const r = p.s * 3.4;
                if (dx < r && sy > p.y - 2 && sy < top + 2) {
                  occ = Math.max(occ, smoothstep(r, r * 0.35, dx));
                }
              }
            }
          }
          const was = g.faded.has(i);
          if (occ > 0.01) {
            const f = 1 - occ * 0.94;
            for (const { inst, part } of g.parts) {
              tmpObj.position.set(p.x - this.originX, p.y + part.y * p.s * f - occ * 2.6, p.z);
              tmpObj.rotation.set(0, p.rot, 0);
              tmpObj.scale.setScalar(p.s * part.s * f);
              tmpObj.updateMatrix();
              inst.setMatrixAt(i, tmpObj.matrix);
              inst.instanceMatrix.needsUpdate = true;
            }
            g.faded.add(i);
          } else if (was) {
            this.restoreInstance(g, i);
            g.faded.delete(i);
          }
        });
      }
    }
  }

  /** Restore every faded instance in these groups to its authored matrix. */
  private restoreFaded(groups: PropGroup[]): void {
    for (const g of groups) {
      if (!g.faded.size) continue;
      for (const i of g.faded) this.restoreInstance(g, i);
      g.faded.clear();
    }
  }

  private restoreInstance(g: PropGroup, i: number): void {
    const p = g.props[i]!;
    for (const { inst, part } of g.parts) {
      tmpObj.position.set(p.x - this.originX, p.y + part.y * p.s, p.z);
      tmpObj.rotation.set(0, p.rot, 0);
      tmpObj.scale.setScalar(p.s * part.s);
      tmpObj.updateMatrix();
      inst.setMatrixAt(i, tmpObj.matrix);
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  /** Sunflower bounce pads in this chunk — placed on the flight line (z = 0). */
  private placeSunflowers(id: number, group: THREE.Group, disposables: { dispose(): void }[]): void {
    const x0 = id * CHUNK_SIZE;
    const island = this.islandIndex(x0 + CHUNK_SIZE / 2);
    const pads = this.padsFor(island).filter((p) => p.x >= x0 - 4 && p.x < x0 + CHUNK_SIZE + 4);
    if (!pads.length) return;
    const parts = this.sunflowerParts;
    if (!parts.length) return;
    for (const part of parts) {
      const inst = new THREE.InstancedMesh(part.geo, part.mat, pads.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      pads.forEach((p, i) => {
        tmpObj.position.set(p.x - this.originX, p.y + part.y * part.s, 0);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(part.s);
        tmpObj.updateMatrix();
        inst.setMatrixAt(i, tmpObj.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.frustumCulled = true;
      group.add(inst);
      disposables.push({ dispose: () => inst.dispose() });
    }
  }

  /* ------------------------------------------------------------ far */

  private rebuildFar(camX: number): void {
    const start = camX - 350;
    const end = camX + 1800;
    const samples = 120;
    for (let layer = 0; layer < 4; layer++) {
      const mesh = this.farMeshes[layer];
      if (!mesh) continue;
      const geo = mesh.geometry;
      let attr = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!attr) {
        attr = new THREE.BufferAttribute(new Float32Array((samples + 1) * 6), 3);
        attr.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("position", attr);
        const indices = new Uint16Array(samples * 6);
        for (let i = 0; i < samples; i++) {
          const a = i * 2;
          indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
        }
        geo.setIndex(new THREE.BufferAttribute(indices, 1));
      }
      const amp = 0.55 + layer * 0.22;
      const yOff = -2 + layer * 7;
      const phase = layer * 45 + this.seedN * 0.01;
      const positions = attr.array as Float32Array;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const x = lerp(start, end, t);
        const b = this.biomeAt(x);
        const y =
          yOff +
          amp * 16 * b.amp * Math.sin(x * (0.01 - layer * 0.0018) / b.wave + phase) +
          amp * 8 * Math.sin(x * 0.024 + phase * 1.3) +
          5 * fbm(x * 0.016 + layer, this.seedN + layer * 17, 3);
        const offset = i * 6;
        const rx = x - this.originX;
        positions[offset] = rx;
        positions[offset + 1] = y;
        positions[offset + 3] = rx;
        positions[offset + 4] = y - 90;
      }
      // Unlit far silhouettes need no normals. Keep the GPU buffers alive.
      attr.needsUpdate = true;
      // The ribbon just scrolled to a new [start, end) window, so its bounds
      // moved too — recompute rather than leave the old (now-stale) sphere
      // sitting around from the previous window.
      geo.computeBoundingSphere();
    }
  }
}

function set3(arr: Float32Array, i: number, x: number, y: number, z: number): void {
  const o = i * 3;
  arr[o] = x;
  arr[o + 1] = y;
  arr[o + 2] = z;
}

function setC(arr: Float32Array, i: number, c: THREE.Color): void {
  const o = i * 3;
  arr[o] = c.r;
  arr[o + 1] = c.g;
  arr[o + 2] = c.b;
}
