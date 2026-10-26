import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BufferGeometry, Group, Mesh } from "three";
import { Collectibles, type CollectEvents } from "../Collectibles";
import { TerrainSystem } from "../TerrainSystem";
import { Bird } from "../Bird";

/**
 * render.md 7 row 5. `allocBalloon` used to mint a private SphereGeometry,
 * ConeGeometry and CylinderGeometry for every pooled balloon, so a full pool of
 * 24 owned 72 identical buffers. The geometries are hoisted to fields, shared
 * across the pool, which is what every other collectible geometry in the file
 * already did (`coinGeo`, `gemGeo`, `pickupGeo`, `ringGeo`).
 *
 * The point of these is that the sharing is *asserted*: geometry identity, not
 * a count of draw calls. Sharing a geometry across meshes is only safe because
 * nothing transforms or mutates it per instance — the meshes carry the
 * transforms — so a test that only counted buffers would miss a regression
 * where someone starts mutating the shared geometry in place.
 */
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());
const events: CollectEvents = { onCoin() {}, onCloud() {}, onPickup() {}, onRing() {}, onBalloon() {} };

function fixture() {
  const terrain = new TerrainSystem("balloon-geometry-sharing");
  const collect = new Collectibles(terrain.seedN, terrain.seedStr);
  const bird = new Bird();
  // Park the bird high and inert: this test is about pooling, not collision.
  bird.reset(64, 5000);
  const update = () => collect.update(0, bird, terrain, false, 0, 1, events);
  // A balloon is a Group of three meshes (body, knot, string) added directly to
  // `group`. Pickups are bare Meshes and coins/gems/rings are InstancedMeshes,
  // so grouping on "Group child" picks out balloons and nothing else. Note the
  // coin geometry is a CylinderGeometry, so a naive "all meshes" scan would
  // count the coin mesh as a fourth cylinder and read a pool of 1 as a pool
  // of 2.
  const balloonRoots = (): Group[] => collect.group.children.filter((c): c is Group => c instanceof Group);
  const balloonParts = (): Mesh[] => balloonRoots().flatMap((root) => root.children.filter((c): c is Mesh => c instanceof Mesh));
  const dispose = () => { collect.dispose(); bird.dispose(); terrain.dispose(); };
  return { terrain, collect, bird, update, balloonRoots, balloonParts, dispose };
}

describe("balloon pool geometry sharing", () => {
  it("grows the pool past one balloon and still shares one geometry per part", () => {
    const f = fixture();
    // Walk far enough ahead that the spawner lays several balloon courses, so
    // this is a genuine multi-instance pool and not a single-coin path.
    for (let i = 0; i < 60; i++) {
      f.bird.x += 40;
      f.bird.vx = 40;
      f.update();
    }
    const roots = f.balloonRoots();
    expect(roots.length).toBeGreaterThan(2);
    for (const root of roots) expect(root.children.length).toBe(3);
    const meshes = f.balloonParts();
    expect(meshes.length).toBe(roots.length * 3);
    expect(meshes.length % 3).toBe(0); // body + knot + string per balloon

    // Every balloon body is the same geometry object, likewise knot and string.
    // Grouped by geometry type so a part swap would be caught, not averaged out.
    const byType = new Map<string, Set<BufferGeometry>>();
    for (const m of meshes) {
      if (!byType.has(m.geometry.type)) byType.set(m.geometry.type, new Set());
      byType.get(m.geometry.type)!.add(m.geometry);
    }
    for (const [type, set] of byType) {
      expect(`${type}:${set.size}`).toBe(`${type}:1`);
    }
    expect([...byType.keys()].sort()).toEqual(["ConeGeometry", "CylinderGeometry", "SphereGeometry"]);
    f.dispose();
  });

  it("keeps the per-balloon transforms on the meshes, not baked into the geometry", () => {
    const f = fixture();
    for (let i = 0; i < 60; i++) {
      f.bird.x += 40;
      f.bird.vx = 40;
      f.update();
    }
    const meshes = f.balloonParts();
    // body sits at +2.1, knot rotated PI and at +0.4, string at -2.3: the shape
    // still comes entirely from mesh transforms, so one geometry can serve all.
    const bodies = meshes.filter((m) => m.geometry.type === "SphereGeometry");
    const knots = meshes.filter((m) => m.geometry.type === "ConeGeometry");
    const strings = meshes.filter((m) => m.geometry.type === "CylinderGeometry");
    for (const m of bodies) {
      expect(m.position.y).toBeCloseTo(2.1, 5);
      expect(m.castShadow).toBe(true);
    }
    for (const m of knots) {
      expect(m.position.y).toBeCloseTo(0.4, 5);
      expect(m.rotation.x).toBeCloseTo(Math.PI, 5);
    }
    for (const m of strings) expect(m.position.y).toBeCloseTo(-2.3, 5);
    // The scatter lives on the balloon root, so the roots differ in x while the
    // parts keep their fixed local offsets: genuinely distinct objects sharing
    // one geometry.
    const roots = f.balloonRoots();
    expect(new Set(roots.map((r) => r.position.x)).size).toBeGreaterThan(1);
    f.dispose();
  });
});
