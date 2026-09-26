import { describe, expect, it } from "vitest";
import { TerrainSystem } from "../TerrainSystem";
import { BIOMES, biomeForIsland, type BiomeDef } from "../Biomes";
import { Bird } from "../Bird";
import { ISLAND_PERIOD, PHYS_DT, RAMP_START } from "../constants";

/**
 * Per-biome TERRAIN GRAMMAR.
 *
 * Before this, all nine worlds shared one hardcoded hill vocabulary in
 * `buildSegments` — the same length buckets, the same height buckets, one ramp
 * chain every 2 arches, one skew for every arch on the island, one trampoline
 * spacing for the whole world. These tests exist so that flatness cannot creep
 * back in, and so "a world is flyable" stays a number rather than a hope.
 *
 * Every threshold below is measured, not chosen. Three real defects were found
 * by measuring against `HEAD` and are pinned here:
 *
 *  1. `relief/lenScale` IS the slope. A ratio above ~1.2 took volcano and
 *     aurora from ~1050 to ~480 units of survivable flight.
 *  2. `relief` was applied to ordinary arches but NOT to the authored ramp
 *     chain, so a `relief > 1` + `lenScale < 1` world got *shorter* ramps at
 *     unchanged height. `relief changes the built arch height` now covers it.
 *  3. `chicane` warps WHERE an arch peaks, so mirroring neighbours turns the
 *     profile into a sawtooth. Authored too large it pushed per-unit slope
 *     change to 1.76 (aurora) against a 1.077 worst that had ever shipped —
 *     rougher than anything in the game, which is a readability defect rather
 *     than difficulty. The smoothness ceiling below is that envelope.
 */

const SEED = "2026-09-11";
/** Deliberately unrelated to SEED: a grammar that only works for one world
 *  string would otherwise pass everything above. */
const SEEDS = [SEED, "cinder"];
/** Seconds of flight for the survivability probe. 30s was too short — the
 *  per-biome spread at 30s sat inside the seed-to-seed noise — but 60s across
 *  three seeds starved the DOM suites vitest runs this file alongside, so this
 *  is the cheapest window that still separates the worlds. The floor below is
 *  calibrated to it. */
const PROBE_SECONDS = 40;

type Segment = { start: number; len: number; height: number; base: number; baseNext: number; skew: number };
type BouncePad = { x: number; y: number };

/**
 * The segment and pad layouts are per-island caches behind `private`. The
 * grammar IS the layout, and the public surface only exposes the resulting
 * heights, from which a layout cannot be recovered without reverse-engineering
 * it into a far more brittle test. Reading them here is deliberate; TypeScript
 * `private` is compile-time only and this file is in-repo.
 */
function layoutOf(terrain: TerrainSystem, island: number): { segs: Segment[]; pads: BouncePad[] } {
  const internals = terrain as unknown as {
    segCache: Map<number, Segment[]>;
    padCache: Map<number, BouncePad[]>;
  };
  // Touch the public surface first so the caches are actually populated. Both
  // caches hold at most 6 islands, so read back immediately after filling.
  for (let x = island * ISLAND_PERIOD + 100; x < (island + 1) * ISLAND_PERIOD; x += 40) {
    terrain.heightAt(x);
  }
  for (let x = island * ISLAND_PERIOD; x < (island + 1) * ISLAND_PERIOD; x += 20) {
    terrain.bouncePadAt(x);
  }
  return {
    segs: internals.segCache.get(island) ?? [],
    pads: internals.padCache.get(island) ?? [],
  };
}

const biomeIndex = (id: string): number => BIOMES.findIndex((b) => b.id === id);

/**
 * Fingerprint of an authored ramp chain. `buildSegments` lays four arches at a
 * fixed 72/52/62/84 length ratio, so a chain is recognisable by its length
 * ratios alone — which is what lets this count chains per world without
 * exposing the builder.
 */
const CHAIN_RATIOS = [52 / 72, 62 / 52, 84 / 62] as const;

/** Index of the first arch of the first authored ramp chain, or -1. */
function firstChainAt(segs: Segment[]): number {
  for (let i = 0; i + 3 < segs.length; i++) {
    if (
      Math.abs(segs[i + 1]!.len / segs[i]!.len - CHAIN_RATIOS[0]) < 0.02 &&
      Math.abs(segs[i + 2]!.len / segs[i + 1]!.len - CHAIN_RATIOS[1]) < 0.02 &&
      Math.abs(segs[i + 3]!.len / segs[i + 2]!.len - CHAIN_RATIOS[2]) < 0.02
    ) {
      return i;
    }
  }
  return -1;
}

function countRampChains(segs: Segment[]): number {
  let chains = 0;
  for (let i = 0; i + 3 < segs.length; i++) {
    if (
      Math.abs(segs[i + 1]!.len / segs[i]!.len - CHAIN_RATIOS[0]) < 0.02 &&
      Math.abs(segs[i + 2]!.len / segs[i + 1]!.len - CHAIN_RATIOS[1]) < 0.02 &&
      Math.abs(segs[i + 3]!.len / segs[i + 2]!.len - CHAIN_RATIOS[2]) < 0.02
    ) {
      chains++;
      i += 3;
    }
  }
  return chains;
}

const landSegs = (segs: Segment[]): Segment[] => segs.filter((s) => s.start > 60 && s.start + s.len <= RAMP_START);
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** A crest-timed pilot: the same shape of policy physics.test.ts uses. */
function fly(terrain: TerrainSystem, startX: number, seconds: number): number {
  const bird = new Bird();
  bird.reset(startX, terrain.heightAt(startX) + 1.2);
  const steps = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    const diving = terrain.distanceToCrest(bird.x) > 70;
    bird.step(PHYS_DT, { diving, fever: false, speedMult: 1, boost: false }, terrain);
  }
  return bird.x - startX;
}

describe("biome grammar: the data is complete and in range", () => {
  it("every hand-tuned world declares a finite, bounded grammar", () => {
    for (const b of BIOMES) {
      const g = b.terrain;
      expect(Number.isFinite(g.relief), b.id).toBe(true);
      expect(g.relief, b.id).toBeGreaterThan(0.3);
      expect(g.relief, b.id).toBeLessThan(2);
      expect(g.lenScale, b.id).toBeGreaterThan(0.5);
      expect(g.lenScale, b.id).toBeLessThan(2);
      // The skew clamp in buildSegments is +/-0.7; a larger authored swing would
      // silently saturate and every high value would behave identically.
      expect(g.chicane, b.id).toBeGreaterThanOrEqual(0);
      expect(g.chicane, b.id).toBeLessThanOrEqual(0.7);
      expect(g.rampEvery, b.id).toBeGreaterThanOrEqual(1);
      expect(g.rampEvery, b.id).toBeLessThanOrEqual(6);
      expect(g.rampChance, b.id).toBeGreaterThan(0);
      expect(g.rampChance, b.id).toBeLessThanOrEqual(1);
      expect(g.padSpacing, b.id).toBeGreaterThan(0.3);
      expect(g.padSpacing, b.id).toBeLessThan(2.5);
      expect(g.troughEvery, b.id).toBeGreaterThanOrEqual(0);
      expect(g.troughDepth, b.id).toBeGreaterThanOrEqual(0);
      expect(g.troughDepth, b.id).toBeLessThanOrEqual(0.6);
    }
  });

  it("relief/lenScale never steepen a world past its own baseline", () => {
    // Measured cause of the first unfair build: slope scales with
    // relief/lenScale, and a ratio much above 1 took volcano and aurora from
    // ~1050 to ~480 units. reef is the tightest authored world at 1.19; a
    // ratio of 1 is neutral, so 1.25 is the ceiling with headroom.
    for (const b of BIOMES) {
      expect(b.terrain.relief / b.terrain.lenScale, `${b.id} relief/lenScale`).toBeLessThanOrEqual(1.25);
    }
  });

  it("troughDepth is authored wherever troughs are actually laid", () => {
    // Otherwise the field is decoration: nothing reads troughDepth unless
    // troughEvery gates the archetype in.
    for (const b of BIOMES) {
      if (b.terrain.troughEvery === 0) continue;
      expect(b.terrain.troughEvery, b.id).toBeGreaterThanOrEqual(2);
      expect(b.terrain.troughDepth, `${b.id} needs a depth`).toBeGreaterThan(0);
    }
    const withTroughs = BIOMES.filter((b) => b.terrain.troughEvery > 0);
    const without = BIOMES.filter((b) => b.terrain.troughEvery === 0);
    expect(withTroughs.length).toBeGreaterThanOrEqual(4);
    expect(without.length).toBeGreaterThanOrEqual(3);
  });

  it("no two hand-tuned worlds share a grammar", () => {
    // The anti-bore guard. A tenth world must not be able to arrive as a copy.
    const seen = new Map<string, string>();
    for (const b of BIOMES) {
      const sig = (g: BiomeDef["terrain"]): string => Object.values(g).join(",");
      const s = sig(b.terrain);
      expect(seen.has(s), `${b.id} duplicates ${seen.get(s)}`).toBe(false);
      seen.set(s, b.id);
    }
  });

  it("chicane, pad spacing and ramp cadence each vary across the nine", () => {
    // If any single one of these collapses to a constant, that mechanic stops
    // being a per-biome mechanic and the world goes flat again on that axis.
    expect(new Set(BIOMES.map((b) => b.terrain.chicane)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(BIOMES.map((b) => b.terrain.padSpacing)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(BIOMES.map((b) => b.terrain.rampChance)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(BIOMES.map((b) => b.terrain.rampEvery)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(BIOMES.map((b) => b.terrain.lenScale)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(BIOMES.map((b) => b.terrain.relief)).size).toBeGreaterThanOrEqual(6);
  });

  it("the endless remix keeps every grammar field in range", () => {
    // biomeForIsland drifts the grammar past the hand-tuned nine; a missing
    // clamp there means an unreachable island is an unwinnable one.
    for (let i = BIOMES.length; i < BIOMES.length * 5; i++) {
      const b = biomeForIsland(i);
      const g = b.terrain;
      expect(g.relief, b.id).toBeGreaterThan(0.3);
      expect(g.lenScale, b.id).toBeGreaterThan(0.5);
      expect(g.relief / g.lenScale, `${b.id} ratio`).toBeLessThanOrEqual(1.25);
      expect(g.chicane, b.id).toBeGreaterThanOrEqual(0);
      expect(g.chicane, b.id).toBeLessThanOrEqual(0.7);
      expect(g.padSpacing, b.id).toBeGreaterThan(0.3);
      expect(g.rampChance, b.id).toBeGreaterThan(0);
      expect(g.rampEvery, b.id).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(g.troughDepth), b.id).toBe(true);
    }
  });

  it("the remix is deterministic for the same island", () => {
    for (const i of [BIOMES.length, BIOMES.length + 7, BIOMES.length * 3]) {
      expect(biomeForIsland(i).terrain).toEqual(biomeForIsland(i).terrain);
    }
  });
});

describe("biome grammar: the terrain builder actually consumes it", () => {
  it("ramp chains are laid at a genuinely different cadence per world", () => {
    // desert is authored rampEvery 4 / rampChance 0.5; volcano 2 / 0.65.
    const desert = countRampChains(layoutOf(new TerrainSystem(SEED), biomeIndex("desert")).segs);
    const volcano = countRampChains(layoutOf(new TerrainSystem(SEED), biomeIndex("volcano")).segs);
    // desert is a deliberately sparse, long-gliding world and can lay none at
    // all; volcano must lay more, and by more than a rounding difference or the
    // cadence is noise rather than a mechanic.
    expect(volcano).toBeGreaterThan(desert);
    expect(volcano).toBeGreaterThanOrEqual(desert + 1);
    expect(volcano).toBeGreaterThanOrEqual(2);
  });

  it("relief changes the built arch height, chain arches included", () => {
    // desert relief 1.05 against green 0.92. The regression this pins:
    // `relief` once skipped the authored ramp chain, so a relief>1 world got
    // shorter ramps at unchanged height.
    const t2 = new TerrainSystem(SEED);
    const green = mean(landSegs(layoutOf(t2, biomeIndex("green")).segs).map((s) => s.height));
    const desert = mean(landSegs(layoutOf(t2, biomeIndex("desert")).segs).map((s) => s.height));
    expect(green).toBeGreaterThan(0);
    expect(desert).not.toBeCloseTo(green, 0);

    // The chain arches specifically. Stated as the invariant rather than as
    // a comparison between two worlds: the sparse dune world legitimately lays
    // no chain at all, so a green-vs-desert comparison silently asserts nothing.
    // The first chain arch is 22 * relief.
    for (const b of BIOMES) {
      const segs = layoutOf(t2, biomeIndex(b.id)).segs;
      const at = firstChainAt(segs);
      if (at < 0) continue;
      expect(segs[at]!.height, `${b.id} chain arch vs relief`).toBeCloseTo(22 * b.terrain.relief, 4);
    }
    t2.dispose();
  });

  it("chicane mirrors consecutive arch skews, and 0 leaves them identical", () => {
    // aurora is authored chicane 0.15 off skew -0.50, so consecutive arches
    // must swing to the other side of the world mean. green is chicane 0, so
    // every arch must wear exactly the same skew — the pre-chicane behaviour.
    const t = new TerrainSystem(SEED);
    const aurora = landSegs(layoutOf(t, biomeIndex("aurora")).segs).map((s) => s.skew);
    expect(new Set(aurora).size).toBeGreaterThanOrEqual(2);
    for (const s of aurora) expect(Math.abs(s)).toBeLessThanOrEqual(0.7001);
    expect(new Set(layoutOf(t, biomeIndex("green")).segs.map((s) => s.skew)).size).toBe(1);
    t.dispose();
  });

  it("pad spacing moves the trampolines rather than leaving them alone", () => {
    // padSpacing is a gameplay input: every pad is a free launch the pilot did
    // not have to read out of the terrain. Counts per island are small (0-3) in
    // every world, before and after this change, because buildPads also rejects
    // anything steeper than 0.42 — so this pins that the builder honours the
    // authored spacing, and that no world is flooded or starved.
    const t = new TerrainSystem(SEED);
    const padsOf = (id: string): BouncePad[] => layoutOf(t, biomeIndex(id)).pads;
    const green = padsOf("green");
    const desert = padsOf("desert");
    expect(green.map((p) => p.x)).not.toEqual(desert.map((p) => p.x));
    for (const b of BIOMES) {
      const n = padsOf(b.id).length;
      expect(n, `${b.id} pad count`).toBeGreaterThanOrEqual(0);
      expect(n, `${b.id} pad count`).toBeLessThanOrEqual(12);
    }
    t.dispose();
  });

  it("lenScale changes the built arch length", () => {
    const t = new TerrainSystem(SEED);
    const meanLen = (id: string): number => mean(landSegs(layoutOf(t, biomeIndex(id)).segs).map((s) => s.len));
    // desert 1.45 against aurora 1.0 — desert is the long-gliding world.
    expect(meanLen("desert")).toBeGreaterThan(meanLen("aurora") * 1.3);
    t.dispose();
  });

  it("is deterministic: same seed, same layout", () => {
    const a = new TerrainSystem(SEED);
    const b = new TerrainSystem(SEED);
    for (const id of ["green", "aurora", "volcano", "canyon"]) {
      const i = biomeIndex(id);
      expect(layoutOf(a, i).segs, id).toEqual(layoutOf(b, i).segs);
      expect(layoutOf(a, i).pads, id).toEqual(layoutOf(b, i).pads);
    }
    a.dispose();
    b.dispose();
  });

  it("chicane invents no slope discontinuity beyond the shipped envelope", () => {
    // The safety argument for per-arch skew: arch'(t) = 0 at both ends for every
    // skew, so mirroring an arch can only change its shape. If that were false,
    // a chicane would manufacture a launch lip nobody authored.
    //
    // Threshold from measurement: the worst per-unit slope change that had ever
    // shipped was 1.077 (canyon, pre-grammar). 1.3 leaves ~20% for the fact
    // that the tight worlds are legitimately sharper, and still fails if a
    // chicane is authored large again — that build measured 1.76 here.
    const t = new TerrainSystem(SEED);
    for (let i = 0; i < BIOMES.length; i++) {
      const base = i * ISLAND_PERIOD;
      let prev = t.slopeAt(base + 300);
      for (let x = base + 301; x < base + RAMP_START - 40; x++) {
        const s = t.slopeAt(x);
        expect(Math.abs(s - prev), `${BIOMES[i]!.id} @${x}`).toBeLessThan(1.3);
        prev = s;
      }
    }
    t.dispose();
  });
});

describe("biome grammar: every world stays flyable", () => {
  it("no hand-tuned world is unwinnable under a crest-timed pilot", () => {
    // The terrain equivalent of `botsim`, and the guard for the defect this work
    // actually hit: an over-strong chicane took volcano from ~1050 to ~480
    // units. The floor sits well under the measured worst (volcano ~316 at 40s)
    // so ordinary grammar edits do not trip it, but a world that stops being
    // flyable does. The slope ceiling is the readability envelope.
    const results: { id: string; min: number; peakSlope: number }[] = [];
    for (let i = 0; i < BIOMES.length; i++) {
      const b = BIOMES[i]!;
      const startX = i * ISLAND_PERIOD + 200;
      let min = Infinity;
      let peakSlope = 0;
      for (const seed of SEEDS) {
        const terrain = new TerrainSystem(seed);
        min = Math.min(min, fly(terrain, startX, PROBE_SECONDS));
        for (let x = startX; x < startX + 900; x += 3) {
          peakSlope = Math.max(peakSlope, Math.abs(terrain.slopeAt(x)));
        }
        terrain.dispose();
      }
      results.push({ id: b.id, min, peakSlope });
    }
    for (const r of results) {
      expect(r.min, `${r.id} min distance`).toBeGreaterThan(250);
      expect(r.peakSlope, `${r.id} peak slope`).toBeLessThan(5.5);
    }
    // The point of the work: the worlds should no longer be one rhythm.
    expect(new Set(results.map((r) => Math.round(r.min / 25))).size).toBeGreaterThanOrEqual(7);
  });
});
