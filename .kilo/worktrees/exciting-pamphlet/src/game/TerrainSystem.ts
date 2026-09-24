import * as THREE from "three";
import { flightProgression, terrainDifficulty } from "./FlightProgression";
import { biomeForIsland, gapEndFor, rampPeakFor, type BiomeDef, type DecoKind, type LandmarkKind } from "./Biomes";
import {
  CHUNK_RES,
  CHUNK_SIZE,
  DROP_START,
  DROP_BLEND_START,
  GAP_START,
  ISLAND_PERIOD,
  OCEAN_FLOOR,
  RAMP_START,
  TERRAIN_FACE_DEPTH,
  TERRAIN_HALF_Z,
  VISIBLE_CHUNKS_BACK,
  VISIBLE_CHUNKS_FWD,
  WATER_Y,
} from "./constants";
import { clamp, fbm, hash01, lerp, SeededRandom, smoothstep, valueNoise } from "./math";

const HEIGHT_CACHE_SIZE = 4096;
const HEIGHT_CACHE_MASK = HEIGHT_CACHE_SIZE - 1;

/** Crest index resolution + how far ahead we scan per refill. */
const CREST_STEP = 2;
const CREST_BLOCK = 900;
/** Prominence gates so terrain noise is not mistaken for a launch lip. */
const CREST_MIN_UP = 0.12;
const CREST_MIN_DOWN = 0.06;
const CREST_CONFIRM = 14;

/** One smooth cosine arch of terrain with an authored intent. */
type Segment = { start: number; len: number; height: number; base: number; baseNext: number };

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
};

type Placement = { x: number; y: number; z: number; s: number; rot: number };
type PropGroup = { props: Placement[]; parts: { inst: THREE.InstancedMesh; part: DecoPart }[]; faded: Set<number> };

export type TerrainPalette = {
  farA: THREE.Color;
  farB: THREE.Color;
  farC: THREE.Color;
};

type DecoPart = { geo: THREE.BufferGeometry; mat: THREE.MeshLambertMaterial; y: number; s: number };

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

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
    const gapEnd = gapEndFor(island);
    const hills = this.hills(x, island);

    const lip = rampPeakFor(island) + 14;
    // One authored transfer per island: high shoulder -> huge clean descent
    // -> wide bowl -> launch lip. No noise bumps to steal downhill momentum.
    // Deeper valley = more vertical drop = more speed arriving at the launch ramp.
    // Shoulder raised slightly so the initial descent cliff feels dramatic.
    const shoulder = lip + 38 + hash01(island, this.seedN) * 8;
    const valley = 1.2; // skim just above water — the bird nearly touches the ocean
    if (lx >= GAP_START && lx < gapEnd) {
      // Start at the actual ramp height, NOT the unrelated procedural hills.
      // The old branch had a vertical discontinuity precisely at take-off.
      const departure = lerp(lip, OCEAN_FLOOR, smoothstep(GAP_START, GAP_START + 26, lx));
      return lerp(departure, 16, smoothstep(gapEnd - 26, gapEnd, lx));
    }
    if (lx >= gapEnd) return 16;

    let h = hills;
    if (lx >= DROP_START && lx < RAMP_START) {
      h = lerp(shoulder, valley, smoothstep(DROP_START, RAMP_START, lx));
    } else if (lx >= RAMP_START && lx < GAP_START) {
      h = lerp(valley, lip, smoothstep(RAMP_START, GAP_START, lx));
    } else if (lx >= DROP_BLEND_START) {
      h = lerp(hills, shoulder, smoothstep(DROP_BLEND_START, DROP_START, lx));
    }

    // Flat, continuous shore across the wrap, then ease into the next hills.
    if (lx < 55) h = lerp(16, h, smoothstep(0, 55, lx));

    if (x < 270) {
      const w = 1 - smoothstep(160, 270, x);
      const tutorial = 16 + 15 * Math.cos((x - 48) * 0.027);
      h = lerp(h, Math.max(4.5, tutorial), w);
    }
    return h;
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

  isOcean(x: number): boolean {
    const lx = this.localX(x);
    return lx >= GAP_START && lx < gapEndFor(this.islandIndex(x));
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
    return Math.max(0, Math.floor(x / ISLAND_PERIOD));
  }

  localX(x: number): number {
    const p = ISLAND_PERIOD;
    return ((x % p) + p) % p;
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
      for (let id = lo; id <= hi; id++) if (!this.chunks.has(id)) this.spawnChunk(id);
      for (const [id, chunk] of this.chunks) {
        if (id < lo || id > hi) {
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
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
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

    const local = this.localX(x);
    const seg = this.segmentAt(local, island);
    const t = (local - seg.start) / seg.len; // 0..1 across this arch
    // cosine arch: 0 at the ends, 1 at the middle — C1-continuous when chained
    const arch = 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);

    // Base terrain line drifts slowly so the world isn't a flat conveyor.
    const base = seg.base + (seg.baseNext - seg.base) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    let h = base + seg.height * amp * arch;

    // A whisper of noise for character — far too small to break the curves.
    h += 0.85 * (fbm(x * 0.02 / wave, this.seedN, 3) - 0.5) * 2;
    h += 0.35 * (valueNoise(x * 0.08, this.seedN + 9) - 0.5) * 2;
    if (b.id === "ember") h += 0.7 * Math.sin(x * 0.16 + this.seedN) * 0.5;
    return Math.max(3.4, h);
  }

  /**
   * Deterministic segment layout for one island. Cached per island so
   * heightAt() stays cheap (it is called thousands of times per frame).
   */
  private segmentAt(local: number, island: number): Segment {
    let segs = this.segCache.get(island);
    if (!segs) {
      segs = this.buildSegments(island);
      this.segCache.set(island, segs);
      if (this.segCache.size > 6) {
        const oldest = this.segCache.keys().next().value;
        if (oldest !== undefined && oldest !== island) this.segCache.delete(oldest);
      }
    }
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
    let pads = this.padCache.get(island);
    if (!pads) {
      pads = this.buildPads(island);
      this.padCache.set(island, pads);
      if (this.padCache.size > 6) {
        const oldest = this.padCache.keys().next().value;
        if (oldest !== undefined && oldest !== island) this.padCache.delete(oldest);
      }
    }
    return pads;
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
    const base = island * ISLAND_PERIOD;
    const landLimit = DROP_BLEND_START - 34; // keep clear of the launch ramp
    let lx = 120 + rng.range(0, 60);
    while (lx < landLimit) {
      const wx = base + lx;
      if (wx >= 260 && !this.isOcean(wx) && Math.abs(this.slopeAt(wx)) < 0.42) {
        out.push({ x: wx, y: this.heightAt(wx) });
      }
      lx += PAD_SPACING * (0.82 + rng.next() * 0.45);
    }
    return out;
  }

  private buildSegments(island: number): Segment[] {
    const b = biomeForIsland(island);
    const progression = flightProgression(island);
    const rng = new SeededRandom(`${this.seedStr}:isle:${island}`);
    const out: Segment[] = [];
    let cursor = 0;
    let base = 11;

    // Wavelength scales with the speed the player should be carrying here, so
    // ramps arrive at a rhythm the bird can actually match.
    const speedScale = (progression.rhythmScale * b.wave) / this.difficulty;

    const push = (len: number, height: number, nextBase: number): void => {
      out.push({ start: cursor, len, height, base, baseNext: nextBase });
      cursor += len;
      base = nextBase;
    };

    // Island 0 opens gently: three teaching rollers with a clean rhythm.
    if (island === 0) {
      push(96, 15, 11);
      push(80, 19, 12);
      push(84, 23, 12);
    }

    const budget = RAMP_START - cursor - 40;
    let used = 0;
    let sincePerfect = 0;
    while (used < budget) {
      const remaining = budget - used;
      const roll = rng.next();
      let len: number;
      let height: number;

      // Every 2 segments, lay a "perfect ramp sequence": deep valley -> kicker -> landing -> launch.
      // V2: more frequent (was 3, now 2) and tighter, so you chain launches instead of gliding.
      if (sincePerfect >= 2 && remaining > 320 && roll > 0.35) {
        sincePerfect = 0;
        const s = speedScale;
        push(72 * s, 22, base - 2); // deep carving valley — hold to carve
        push(52 * s, 24, base + 1); // kicker with crisp lip — release!
        push(62 * s, 17, base); // landing roller — quick touch
        push(84 * s, 28, base); // big launch ramp — again!
        used += (72 + 52 + 62 + 84) * s;
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
      const drift = rng.range(-2.5, 2.5);
      push(len, height, clamp(base + drift, 7, 20));
      used += len;
      sincePerfect += 1;
    }

    // Run the final arch out past the ramp zone so lookups never fall off the end.
    push(ISLAND_PERIOD - cursor + 200, 16, base);
    return out;
  }

  /* ------------------------------------------------------------ chunks */

  private spawnChunk(id: number): void {
    const group = new THREE.Group();
    const disposables: { dispose(): void }[] = [];
    const geo = this.buildChunkGeo(id);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const propGroups = this.placeDecor(id, group, disposables);
    this.placeSunflowers(id, group, disposables);
    this.group.add(group);
    this.chunks.set(id, { id, group, disposables, propGroups: propGroups.length ? propGroups : undefined });
  }

  private buildChunkGeo(id: number): THREE.BufferGeometry {
    const x0 = id * CHUNK_SIZE;
    const n = Math.ceil(CHUNK_SIZE / this.chunkRes);
    const dx = CHUNK_SIZE / n;
    const hz = TERRAIN_HALF_Z;
    const depth = TERRAIN_FACE_DEPTH;

    const stride = 4;
    const vertCount = (n + 1) * stride;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
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
      const blend = smoothstep(ISLAND_PERIOD - 90, ISLAND_PERIOD, lx);
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

      // subtle per-vertex variation for a hand-painted feel
      const v = (hash01(Math.floor(x * 0.5), this.seedN + 77) - 0.5) * 0.05;
      cTop.offsetHSL(0, 0, v);

      const base = i * stride;
      set3(positions, base + 0, x, y, -hz);
      set3(positions, base + 1, x, y, hz);
      set3(positions, base + 2, x, y - depth * 0.42, hz);
      set3(positions, base + 3, x, y - depth, hz);

      set3(normals, base + 0, nrm.nx, nrm.ny, 0.15);
      set3(normals, base + 1, nrm.nx * 0.3, nrm.ny * 0.3, 0.9);
      set3(normals, base + 2, 0, 0.15, 1);
      set3(normals, base + 3, 0, 0, 1);

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
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
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
      if (lx > RAMP_START - 10 && lx < GAP_START) continue;
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
          tmpObj.position.set(p.x, p.y + part.y * p.s, p.z);
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
      if (
        lmParts &&
        !this.isOcean(lx0) &&
        lx0 >= 30 &&
        Math.abs(this.slopeAt(lx0)) <= 0.5 &&
        !(llx > RAMP_START - 10 && llx < GAP_START)
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
      if (lx > RAMP_START - 10 && lx < GAP_START) continue;
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
              tmpObj.position.set(p.x, p.y + part.y * p.s * f - occ * 2.6, p.z);
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
      tmpObj.position.set(p.x, p.y + part.y * p.s, p.z);
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
        tmpObj.position.set(p.x, p.y + part.y * part.s, 0);
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
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 3] = x;
        positions[offset + 4] = y - 90;
      }
      // Unlit far silhouettes need no normals. Keep the GPU buffers alive.
      attr.needsUpdate = true;
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
