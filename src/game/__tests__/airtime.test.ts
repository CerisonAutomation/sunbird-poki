import { afterEach, describe, expect, it, vi } from "vitest";
import * as FlightPhysics from "../FlightPhysics";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { PHYS_DT } from "../constants";
import { paginate } from "../Pagination";
afterEach(() => vi.restoreAllMocks());

describe("flight pacing without breaking the launch arc", () => {
  it("preserves early lift, then smoothly reduces long passive glides", () => {
    // TUNED 2026-09-24: earlier decay (2.5s vs 3s) and deeper (0.32 vs 0.4) for lower ceiling
    expect(FlightPhysics.glideLiftScale(0)).toBe(1);
    expect(FlightPhysics.glideLiftScale(2.5)).toBe(1);
    expect(FlightPhysics.glideLiftScale(3)).toBeCloseTo(0.915, 2);
    expect(FlightPhysics.glideLiftScale(5)).toBeCloseTo(0.575, 2);
    expect(FlightPhysics.glideLiftScale(100)).toBeCloseTo(0.32, 2);
  });
  it("lands a powered, high launch sooner than the previous sustained-lift model", () => {
    const terrain = new TerrainSystem("airtime-check");
    const fly = () => {
      const bird = new Bird();
      bird.reset(64, terrain.heightAt(64) + 80);
      bird.grounded = false; bird.vx = 70; bird.vy = 60;
      let time = 0;
      while (!bird.grounded && time < 60) {
        bird.step(PHYS_DT, { diving: false, fever: false, speedMult: 1, boost: false, liftMult: 1.8 }, terrain);
        time += PHYS_DT;
      }
      bird.dispose(); return time;
    };
    const paced = fly();
    vi.spyOn(FlightPhysics, "glideLiftScale").mockReturnValue(1);
    const sustained = fly();
    expect(paced).toBeLessThan(sustained * .85);
    expect(paced).toBeGreaterThan(3); // not a forced instant descent
    terrain.dispose();
  });
});

describe("collection pagination", () => {
  it("keeps all entries reachable without empty trailing pages", () => {
    const data = Array.from({ length: 14 }, (_, i) => i);
    expect(paginate(data, 0).items).toEqual([0, 1, 2, 3, 4, 5]);
    expect(paginate(data, 1).items).toEqual([6, 7, 8, 9, 10, 11]);
    expect(paginate(data, 99)).toMatchObject({ items: [12, 13], page: 2, pages: 3 });
    expect(paginate([], -1)).toMatchObject({ items: [], page: 0, pages: 1 });
  });
});
