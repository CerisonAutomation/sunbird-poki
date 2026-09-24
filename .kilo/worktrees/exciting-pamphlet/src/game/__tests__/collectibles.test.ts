import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstancedMesh, Matrix4 } from "three";
import { Collectibles, type CollectEvents } from "../Collectibles";
import { TerrainSystem } from "../TerrainSystem";
import { Bird } from "../Bird";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());
const events: CollectEvents = { onCoin() {}, onCloud() {}, onPickup() {}, onRing() {}, onBalloon() {} };

function fixture() {
  const terrain = new TerrainSystem("collectible-cells");
  const collect = new Collectibles(terrain.seedN, terrain.seedStr);
  const bird = new Bird();
  bird.reset(64, 500); // keep collision/magnet out of this spawn determinism check
  const update = () => collect.update(0, bird, terrain, false, 0, 1, events);
  const meshes = () => collect.group.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
  const counts = () => meshes().map(mesh => mesh.count);
  const dispose = () => { collect.dispose(); bird.dispose(); terrain.dispose(); };
  return { terrain, collect, bird, update, meshes, counts, dispose };
}

describe("collectible spawn/render budgets", () => {
  it("draws zero reserved instances before spawn and after reset", () => {
    const f = fixture();
    expect(f.counts()).toEqual([0, 0, 0]);
    f.update();
    expect(f.counts()[0]).toBeGreaterThan(0);
    expect(f.counts()[0]).toBeLessThan(100);
    expect(f.counts()[2]).toBeLessThan(10);
    f.collect.reset();
    expect(f.counts()).toEqual([0, 0, 0]);
    f.dispose();
  });

  it("uploads only the live dense prefix instead of full reserved matrices", () => {
    const f = fixture();
    f.update();
    let capacityBytes = 0;
    let uploadBytes = 0;
    for (const mesh of f.meshes()) {
      capacityBytes += mesh.instanceMatrix.array.byteLength;
      const ranges = mesh.instanceMatrix.updateRanges;
      expect(ranges).toEqual(mesh.count ? [{ start: 0, count: mesh.count * 16 }] : []);
      uploadBytes += mesh.count * 16 * 4;
    }
    expect(uploadBytes).toBeLessThan(capacityBytes / 4);
    f.dispose();
  });

  it("does not re-spawn the same cell on fractional physics steps", () => {
    const f = fixture();
    f.update();
    const counts = f.counts();
    const children = f.collect.group.children.length;
    for (let i = 0; i < 120; i++) {
      f.bird.x += 0.001;
      f.update();
    }
    expect(f.counts()).toEqual(counts);
    expect(f.collect.group.children).toHaveLength(children);
    f.dispose();
  });

  it("gets identical instances when the same cells are reached in smaller steps", () => {
    const a = fixture();
    const b = fixture();
    a.update(); b.update();
    a.bird.x = 90; a.update();
    for (let x = 64.25; x <= 90; x += 0.25) { b.bird.x = x; b.update(); }
    expect(a.counts()).toEqual(b.counts());
    const positions = (f: ReturnType<typeof fixture>) => f.meshes().map(mesh => {
      const matrix = new Matrix4();
      const out: string[] = [];
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        out.push(`${matrix.elements[12]},${matrix.elements[13]}`);
      }
      return out.sort();
    });
    expect(positions(a)).toEqual(positions(b));
    a.dispose(); b.dispose();
  });
});
