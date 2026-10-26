import { describe, expect, it } from "vitest";
import type * as THREE from "three";
import { TerrainSystem } from "../TerrainSystem";
import { CHUNK_SIZE, CHUNK_RES, TERRAIN_FACE_DEPTH } from "../constants";

/**
 * How the terrain LOOKS, as distinct from its shape.
 *
 * `terrain.test.ts` covers the height field, the ramps and the gaps — the
 * things the bird collides with. This file covers the three things that made
 * the world read as cheap while still being geometrically correct: vertex
 * density that never caught up with the camera, shading data the shader threw
 * away, and a cliff face painted in a single colour.
 *
 * Chunk streaming is private, so these reach through a named shape rather than
 * `any` — the same pattern `terrain.test.ts` uses for `localX`. Naming the
 * fields means a rename in `TerrainSystem` breaks the build here instead of
 * silently turning an assertion into `undefined > 0.5`, which is false and
 * would pass.
 */
interface LiveChunk {
  id: number;
  builtFar?: boolean;
  pending?: boolean;
  rebuilding?: boolean;
  mesh?: THREE.Mesh;
  disposables: { dispose(): void }[];
}
interface Streamer {
  update(camX: number): void;
  chunks: Map<number, LiveChunk>;
  chunkRes: number;
  buildChunkGeo(id: number, camX: number, forcedFar?: boolean): THREE.BufferGeometry;
  mat: THREE.Material;
  rebuildChunkGeo(chunk: LiveChunk, far: boolean): void;
  dispose(): void;
  group: THREE.Object3D;
  chunkCenter: number;
}
const stream = (t: TerrainSystem): Streamer => t as unknown as Streamer;

/** The game calls `update()` once per frame; each call is one re-detail budget. */
const frames = async (t: Streamer, camX: number, n = 40): Promise<void> => {
  for (let i = 0; i < n; i++) {
    t.update(camX);
    await new Promise<void>((r) => setTimeout(r, 8));
  }
};

const settle = async (t: Streamer, camX: number): Promise<void> => {
  t.update(camX);
  await new Promise<void>((r) => setTimeout(r, 60));
};

/** A terrain with its chunk group stubbed out — no scene, no renderer. */
const streaming = async (): Promise<Streamer> => {
  const t = stream(new TerrainSystem("2026-09-12"));
  t.group = { add() {}, remove() {} } as unknown as THREE.Object3D;
  t.chunkCenter = -999; // force the spawn pass on the first update()
  await settle(t, 0);
  return t;
};

const vertCount = (chunk: LiveChunk): number =>
  (chunk.mesh as THREE.Mesh).geometry.getAttribute("position").count;

/** The vertex count a chunk has when it is detailed, and when it is coarse. */
const expected = (t: Streamer, far: boolean): number => {
  const n = Math.ceil(CHUNK_SIZE / (far ? t.chunkRes * 2 : t.chunkRes));
  return (n + 1) * 4;
};

/** The first chunk on a given LOD side, or undefined if the world has none. */
const findChunk = (t: Streamer, builtFar: boolean, minId = 0): [number, LiveChunk] | undefined => {
  for (const [id, c] of t.chunks) if (c.builtFar === builtFar && id > minId) return [id, c];
  return undefined;
};

describe("terrain look: vertex density follows the camera", () => {
  it("re-details a coarse chunk once the camera reaches it", async () => {
    const t = await streaming();
    const far = findChunk(t, true);
    expect(far, "no chunk was built coarse, so this proves nothing — is the forward cull range still ahead of LOD_DISTANCE?").toBeTruthy();
    const [id, chunk] = far!;
    expect(vertCount(chunk), "a far chunk should be built at half density").toBe(expected(t, true));

    await frames(t, id * CHUNK_SIZE + CHUNK_SIZE / 2, 60);

    expect(chunk.builtFar, "the chunk is now under the camera but still claims to be coarse").toBe(false);
    expect(vertCount(chunk), "the chunk the player is standing on is still low-detail").toBe(expected(t, false));
  });

  it("coarsens a detailed chunk the camera leaves behind", async () => {
    const t = await streaming();
    const near = findChunk(t, false, 1);
    expect(near, "no detailed chunk to retreat from — fixture is vacuous").toBeTruthy();
    const [id, chunk] = near!;
    const centre = id * CHUNK_SIZE + CHUNK_SIZE / 2;
    expect(vertCount(chunk)).toBe(expected(t, false));

    // Retreat far enough to clear the LOD band but not so far the chunk is culled
    // (the cull range is 14 chunks AHEAD, so retreating keeps it in view).
    await frames(t, centre - 552, 60);

    expect(t.chunks.has(id), "the chunk was culled, so this test cannot observe coarsening").toBe(true);
    expect(chunk.builtFar, "a chunk left 552 units ahead is still detailed").toBe(true);
    expect(vertCount(chunk)).toBe(expected(t, true));
  });

  it("does not thrash when the camera hovers on the LOD boundary", async () => {
    // The failure this guards against is silent and expensive: with one
    // threshold for both directions, a chunk at 401 is simultaneously due to
    // coarsen and due to re-detail, so it rebuilds a full geometry EVERY frame
    // the camera sits near the boundary. Nothing about that looks broken; it
    // is just a permanently stuttering frame rate.
    const t = await streaming();
    // Start ON a coarse chunk, so the only re-detail this can legitimately
    // trigger is the one when the camera first comes decisively close.
    // Jumping the camera onto a distant part of the map correctly re-details
    // every coarse chunk it lands on, and counting those would make this
    // assert something untrue.
    const [id, subject] = findChunk(t, true)!;
    const centre = id * CHUNK_SIZE + CHUNK_SIZE / 2;
    // Park the camera far away first, so every chunk between here and the
    // subject has already settled on the far side before the sweep starts.
    await frames(t, centre + 3000, 40);
    expect(subject.builtFar, "the subject chunk was not still coarse after parking the camera").toBe(true);

    const rebuilds: string[] = [];
    const orig = t.rebuildChunkGeo.bind(t);
    let camX = centre + 3000;
    t.rebuildChunkGeo = (chunk: LiveChunk, isFar: boolean) => {
      rebuilds.push(`id=${chunk.id} ${chunk.builtFar}->${isFar} at d=${Math.abs(chunk.id * CHUNK_SIZE + CHUNK_SIZE / 2 - camX).toFixed(0)}`);
      return orig(chunk, isFar);
    };

    // Sweep back and forth across the boundary many times.
    for (const d of [380, 420, 390, 410, 400, 395, 405, 385, 415, 398, 402, 400]) {
      camX = centre + d;
      await frames(t, camX, 2);
    }

    // Each pass may legitimately move a chunk at most once, and only if the
    // camera left the dead band. What must not happen is a rebuild per pass.
    expect(rebuilds.length, `rebuilt on the boundary: ${rebuilds.join(" | ")}`).toBeLessThanOrEqual(1);
  });

  it("leaves the live geometry tracked so a re-detail cannot leak it", async () => {
    // A re-detail disposes the old geometry. If the disposables list kept the
    // stale entry, the chunk would be walked at cull time and the count would
    // drift from the resources actually alive.
    const t = await streaming();
    const [id, chunk] = findChunk(t, true)!;
    const before = chunk.disposables.length;
    await frames(t, id * CHUNK_SIZE + CHUNK_SIZE / 2, 60);
    expect(chunk.disposables.length, "the re-detail appended instead of replacing").toBe(before);
    expect(chunk.disposables, "the disposables list no longer holds the geometry the mesh is using").toContain((chunk.mesh as THREE.Mesh).geometry);
    expect(chunk.rebuilding, "a rebuild is still marked in flight").toBe(false);
  });
});

describe("terrain look: shading data the shader can actually use", () => {
  it("writes no normal attribute, because flatShading ignores one", async () => {
    // `mat.flatShading` is true, and three.js's `normal_fragment_begin` takes
    // its `#ifdef FLAT_SHADED` branch: the normal comes from dFdx/dFdy of the
    // view position and `vNormal` is never read. An authored normal attribute
    // is therefore uploaded every frame and thrown away by the shader — dead
    // data that reads like a control the renderer does not honour.
    const t = new TerrainSystem("2026-09-12");
    const s = stream(t);
    expect((s.mat as THREE.MeshLambertMaterial).flatShading, "the premise of this test is that the material is flat-shaded").toBe(true);
    const geo = s.buildChunkGeo(0, 0);
    expect(geo.getAttribute("normal"), "a normal attribute is being built for a flat-shaded material, where the shader discards it").toBeUndefined();
    geo.dispose();
    t.dispose();
  });

  it("still varies the cliff face instead of painting it one colour", () => {
    // The regression: `cDeep` was read from the biome and written to the bottom
    // of the face with nothing in between, so the lower wall was one flat
    // colour per biome. Because the map's low, flat stretches are long, half of
    // every wall sample shared that one value — a 50-unit slab of paint that
    // read as a coloured rectangle rather than a cliff.
    //
    // This asserts the thing directly — ADJACENT columns of the same face
    // differ — rather than counting distinct colours over a wide span. A
    // histogram is a global aggregate: it stayed green when the per-column
    // jitter was deleted and only a much weaker slope term was removed,
    // because the surviving term still cleared the threshold. Neighbour
    // difference cannot be satisfied by a term that only varies slowly in x.
    const t = stream(new TerrainSystem("2026-09-12"));
    let differing = 0;
    let pairs = 0;
    for (let cx = 0; cx < Math.ceil(500 / CHUNK_SIZE); cx++) {
      const geo = t.buildChunkGeo(cx, cx * CHUNK_SIZE);
      const col = geo.getAttribute("color");
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count - 4; i += 4) {
        pairs++;
        // Vertex 3 is the base of the face — the one that used to be flat.
        const a = [col.getX(i + 3), col.getY(i + 3), col.getZ(i + 3)];
        const b = [col.getX(i + 7), col.getY(i + 7), col.getZ(i + 7)];
        if (a.some((v, j) => Math.abs(v - b[j]) > 1e-4)) differing++;
      }
      geo.dispose();
    }
    const share = differing / pairs;
    t.dispose();
    expect(pairs, "no adjacent column pairs were compared — fixture is vacuous").toBeGreaterThan(100);
    expect(share, `only ${(share * 100).toFixed(1)}% of adjacent face columns differ; the wall is banded`).toBeGreaterThan(0.5);
  });

  it("varies the face where the biome colour is constant, not just where terrain moves", () => {
    // The neighbour test above can be satisfied by any term that varies along
    // x — including ones driven by terrain shape, which already vary plenty.
    // The specific thing that was broken is subtler: a long, LOW, FLAT stretch
    // has almost no slope and almost no height change, so every shape-driven
    // term goes quiet at once and the face falls back to the single biome
    // colour. This isolates that case by comparing only pairs of adjacent
    // columns whose terrain is nearly level, where shape-driven variation
    // cannot be doing the work.
    const inner = new TerrainSystem("2026-09-12");
    const t = stream(inner);
    let differing = 0;
    let pairs = 0;
    for (let cx = 0; cx < Math.ceil(500 / CHUNK_SIZE); cx++) {
      const geo = t.buildChunkGeo(cx, cx * CHUNK_SIZE);
      const col = geo.getAttribute("color");
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count - 4; i += 4) {
        // Only near-level pairs: the two column tops differ by < 0.15 units.
        if (Math.abs(pos.getY(i) - pos.getY(i + 4)) > 0.15) continue;
        pairs++;
        const a = [col.getX(i + 3), col.getY(i + 3), col.getZ(i + 3)];
        const b = [col.getX(i + 7), col.getY(i + 7), col.getZ(i + 7)];
        if (a.some((v, j) => Math.abs(v - b[j]) > 1e-4)) differing++;
      }
      geo.dispose();
    }
    const share = pairs ? differing / pairs : 0;
    t.dispose();
    expect(pairs, "no near-level column pairs exist in this terrain — fixture is vacuous").toBeGreaterThan(20);
    expect(share, `only ${(share * 100).toFixed(1)}% of FLAT face columns differ; flat ground paints the wall one colour`).toBeGreaterThan(0.8);
  });

  it("does not collapse the face to a single colour across 500 units", () => {
    // Kept alongside the neighbour test as a coarse guard: a much larger
    // uniform region (a whole biome-sized stretch painted one colour) should
    // also fail, and the neighbour test alone would not notice it.
    const t = stream(new TerrainSystem("2026-09-12"));
    const seen = new Map<string, number>();
    let samples = 0;
    for (let cx = 0; cx < Math.ceil(500 / CHUNK_SIZE); cx++) {
      const geo = t.buildChunkGeo(cx, cx * CHUNK_SIZE);
      const col = geo.getAttribute("color");
      const pos = geo.getAttribute("position");
      for (let i = 0; i < pos.count; i += 4) {
        for (const k of [2, 3]) {
          const key = [col.getX(i + k), col.getY(i + k), col.getZ(i + k)].map((v) => v.toFixed(3)).join(",");
          seen.set(key, (seen.get(key) ?? 0) + 1);
          samples++;
        }
      }
      geo.dispose();
    }
    const dominant = Math.max(...seen.values()) / samples;
    t.dispose();
    expect(seen.size, "the face is a single flat colour across 500 units").toBeGreaterThan(20);
    expect(dominant, `one colour covers ${(dominant * 100).toFixed(1)}% of the face`).toBeLessThan(0.1);
  });

  it("keeps the wall tall enough for the shading to be visible at all", () => {
    // Guards the fix against being made invisible instead: a face with no
    // height has nothing for a depth ramp to shade.
    const t = stream(new TerrainSystem("2026-09-12"));
    expect(TERRAIN_FACE_DEPTH).toBeGreaterThan(20);
    const geo = t.buildChunkGeo(0, 0);
    const pos = geo.getAttribute("position");
    let span = 0;
    for (let i = 0; i < pos.count; i += 4) span = Math.max(span, pos.getY(i + 2) - pos.getY(i + 3));
    geo.dispose();
    t.dispose();
    expect(span, "the two wall vertices are at the same height, so there is no face to shade").toBeGreaterThan(1);
  });
});

describe("terrain look: density is worth paying for", () => {
  it("a coarse grid is a real mismatch against the surface the bird stands on", () => {
    // Why live LOD is not an optimisation but a correctness issue: physics
    // uses `heightAt`, the mesh samples it on the LOD grid, and `heightAt` is
    // not smooth enough for a 2x coarser grid to be free. This is the size of
    // the visual gap the player sees when a coarse chunk is flown up to.
    const t = new TerrainSystem("2026-09-12");
    const coarsePitch = CHUNK_RES * 2;
    let worst = 0;
    for (let x = 0; x < 500; x += 0.1) {
      const sampled = t.heightAt(Math.round(x / coarsePitch) * coarsePitch);
      worst = Math.max(worst, Math.abs(t.heightAt(x) - sampled));
    }
    t.dispose();
    expect(worst, "a coarse grid happens to match exactly — re-measure before trusting this").toBeGreaterThan(0.5);
  });
});
