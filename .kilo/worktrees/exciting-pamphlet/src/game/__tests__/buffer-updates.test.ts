import { describe, expect, it, vi } from "vitest";
import { BufferAttribute } from "three";
import { uploadDensePrefix } from "../bufferUpdates";
import { CameraRig } from "../CameraRig";
import { TerrainSystem } from "../TerrainSystem";

describe("dense GPU update budgets", () => {
  it("uploads components only for active instances", () => {
    const attribute = new BufferAttribute(new Float32Array(512 * 16), 16);
    uploadDensePrefix(attribute, 32);
    expect(attribute.updateRanges).toEqual([{ start: 0, count: 32 * 16 }]);
    expect(attribute.version).toBe(1);
  });
  it("keeps one pending range while an object is culled, including shrinking / empty prefixes", () => {
    const attribute = new BufferAttribute(new Float32Array(512 * 16), 16);
    for (let i = 0; i < 1000; i++) uploadDensePrefix(attribute, 1 + i % 50);
    expect(attribute.updateRanges).toHaveLength(1);
    uploadDensePrefix(attribute, 2);
    expect(attribute.updateRanges[0]!.count).toBe(32);
    const version = attribute.version;
    uploadDensePrefix(attribute, 0);
    expect(attribute.version).toBe(version);
    expect(attribute.updateRanges).toHaveLength(0);
    uploadDensePrefix(attribute, 9);
    expect(attribute.updateRanges[0]!.count).toBe(144);
    uploadDensePrefix(attribute, 999);
    expect(attribute.updateRanges[0]!.count).toBe(attribute.array.length);
  });
  it("does not rebuild an unchanged split-screen aspect matrix", () => {
    const rig = new CameraRig(1.5);
    const update = vi.spyOn(rig.camera, "updateProjectionMatrix");
    for (let i = 0; i < 120; i++) rig.resize(1.5);
    expect(update).not.toHaveBeenCalled();
    rig.resize(0.75);
    expect(update).toHaveBeenCalledOnce();
  });
  it("reuses caller-owned surface normals without sharing state between birds", () => {
    const terrain = new TerrainSystem("normals");
    const out = { nx: 0, ny: 0, tx: 0, ty: 0 };
    for (const x of [0, 60, 180, 750, 860, 1000, 1200]) {
      expect(terrain.normalAt(x, out)).toBe(out);
      expect(out).toEqual(terrain.normalAt(x));
      expect(Math.hypot(out.nx, out.ny)).toBeCloseTo(1);
    }
    const copy = terrain.normalAt(700);
    terrain.normalAt(900, out);
    expect(copy).toEqual(terrain.normalAt(700));
    terrain.dispose();
  });
});
