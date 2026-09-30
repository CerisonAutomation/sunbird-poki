import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { FinishGate } from "../FinishGate";

/**
 * FinishGate is the visible finish line for race modes — the thing a player
 * aims at over the last crest. It had no tests. What matters is that it is
 * hidden when there is no race, appears at the right height, counts down
 * honestly, and latches once it is crossed.
 */

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
    strokeText() {}, fillText() {}, save() {}, restore() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

const terrainAt = (h: number) => ({ heightAt: () => h }) as never;

describe("FinishGate — placement", () => {
  it("starts hidden — a gate in an endless run is a lie about where the race ends", () => {
    const g = new FinishGate();
    expect(g.group.visible).toBe(false);
    g.dispose();
  });

  it("reports -1 while hidden, so no HUD countdown can appear", () => {
    const g = new FinishGate();
    expect(g.update(1 / 60, 0)).toBe(-1);
    expect(g.update(1 / 60, 9999)).toBe(-1);
    g.dispose();
  });

  it("sits on the terrain height at the finish x", () => {
    const g = new FinishGate();
    g.place(500, terrainAt(37));
    expect(g.group.visible).toBe(true);
    expect(g.group.position.x).toBe(500);
    expect(g.group.position.y).toBe(37);
    g.dispose();
  });

  it("stays hidden for a non-positive finish distance (endless modes)", () => {
    const g = new FinishGate();
    for (const x of [0, -1, -5000]) {
      g.place(x, terrainAt(10));
      expect(g.group.visible, `x=${x}`).toBe(false);
      expect(g.update(1 / 60, 0), `x=${x}`).toBe(-1);
    }
    g.dispose();
  });

  it("re-placing hides then re-shows without leaking the old position", () => {
    const g = new FinishGate();
    g.place(500, terrainAt(20));
    g.place(0, terrainAt(20));
    expect(g.group.visible).toBe(false);
    g.place(900, terrainAt(20));
    expect(g.group.visible).toBe(true);
    expect(g.update(1 / 60, 0)).toBe(900);
    g.dispose();
  });
});

describe("FinishGate — the countdown", () => {
  it("counts down the metres still to fly", () => {
    const g = new FinishGate();
    g.place(1000, terrainAt(0));
    expect(g.update(1 / 60, 400)).toBe(600);
    expect(g.update(1 / 60, 900)).toBe(100);
    g.dispose();
  });

  it("goes negative once crossed, which is what the HUD guards on", () => {
    // The HUD renders the readout only for `finishRemaining > 0`, so a
    // negative value here is what hides the counter after the line — pinned
    // because `update`'s docstring says it returns -1 when passed and it does
    // not. The docstring is the thing that is wrong; the caller is right.
    const g = new FinishGate();
    g.place(1000, terrainAt(0));
    expect(g.update(1 / 60, 1001)).toBe(-1);
    expect(g.update(1 / 60, 1500)).toBe(-500);
    g.dispose();
  });

  it("latches the pass exactly once and keeps it across re-placement", () => {
    const g = new FinishGate();
    g.place(1000, terrainAt(0));
    g.update(1 / 60, 1500); // crossed
    // Re-placed for a new race: the latch must be cleared, or the second race
    // would start with the gate already "passed".
    g.place(2000, terrainAt(0));
    expect(g.update(1 / 60, 100)).toBe(1900);
    g.dispose();
  });
});

describe("FinishGate — pulse and resources", () => {
  it("adds itself to a scene and can be added twice without error", () => {
    const g = new FinishGate();
    const scene = new THREE.Scene();
    expect(() => {
      g.addTo(scene);
      g.addTo(scene);
    }).not.toThrow();
    g.dispose();
  });

  it("survives a zero and a negative dt without producing NaN geometry", () => {
    const g = new FinishGate();
    g.place(1000, terrainAt(0));
    g.update(0, 500);
    g.update(-1, 500);
    expect(Number.isFinite(g.group.position.x)).toBe(true);
    expect(Number.isFinite(g.group.position.y)).toBe(true);
    g.dispose();
  });

  it("disposes without throwing, and is safe to dispose twice", () => {
    const g = new FinishGate();
    g.place(1000, terrainAt(0));
    expect(() => {
      g.dispose();
      g.dispose();
    }).not.toThrow();
  });
});
