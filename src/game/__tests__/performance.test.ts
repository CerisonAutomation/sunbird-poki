import { describe, expect, it, vi } from "vitest";
import { InstancedMesh, Mesh } from "three";
import { TerrainSystem } from "../TerrainSystem";
import { AttractPilot } from "../pilot";
import { Bird } from "../Bird";
import { endlessSpeedScale, flightProgression, terrainDifficulty } from "../FlightProgression";
import { FlightCues } from "../FlightCues";
import { PHYS_DT } from "../constants";
import { nextBloomBudget } from "../quality";

describe("render and allocation budgets", () => {
  it("reuses distant geometry and culls static instanced decoration", () => {
    const terrain = new TerrainSystem("performance");
    terrain.update(64);
    const far = terrain.group.children.slice(0, 4) as Mesh[];
    const buffers = far.map(mesh => mesh.geometry.getAttribute("position"));
    for (const x of [110, 180, 270, 360]) {
      terrain.update(x);
      far.forEach((mesh, i) => expect(mesh.geometry.getAttribute("position")).toBe(buffers[i]));
    }
    let instances = 0;
    terrain.group.traverse(object => {
      if (object instanceof InstancedMesh) {
        instances++;
        expect(object.frustumCulled).toBe(true);
        expect(object.boundingSphere).not.toBeNull();
      }
    });
    expect(instances).toBeGreaterThan(0);
    terrain.dispose();
  });

  it("invalidates rendered chunks as well as physics when calibration changes", () => {
    const terrain = new TerrainSystem("difficulty");
    terrain.update(64);
    const oldChunks = terrain.group.children.slice(4);
    terrain.setDifficulty(1.1);
    expect(terrain.group.children).toHaveLength(4);
    terrain.update(64);
    expect(terrain.group.children.length).toBeGreaterThan(4);
    for (const chunk of oldChunks) expect(terrain.group.children).not.toContain(chunk);
    terrain.dispose();
  });

  it("bounds expensive attract predictions but replans immediately near a landing", () => {
    const terrain = new TerrainSystem("pilot-cache");
    const bird = new Bird();
    bird.reset(400, 300);
    bird.vx = 60;
    const decide = vi.fn(() => false);
    const pilot = new AttractPilot(decide);
    for (let i = 0; i < 120; i++) pilot.update(PHYS_DT, bird, terrain);
    expect(decide.mock.calls.length).toBeLessThanOrEqual(16);
    expect(decide.mock.calls.length).toBeGreaterThanOrEqual(13);
    const calls = decide.mock.calls.length;
    bird.y = terrain.heightAt(bird.x + bird.vx * 0.12) + 3;
    pilot.update(PHYS_DT, bird, terrain);
    expect(decide).toHaveBeenCalledTimes(calls + 1);
    bird.dispose(); terrain.dispose();
  });

  it("requires headroom before enabling bloom and avoids rapid retries", () => {
    let state = { enabled: false, goodWindows: 0, cooldown: 0 };
    for (let i = 0; i < 2; i++) {
      state = nextBloomBudget(state, 1 / 60, true);
      expect(state.enabled).toBe(false);
    }
    state = nextBloomBudget(state, 1 / 60, true);
    expect(state.enabled).toBe(true);
    state = nextBloomBudget(state, 1 / 25, true);
    expect(state.enabled).toBe(false);
    expect(state.cooldown).toBe(10);
    for (let i = 0; i < 3; i++) {
      state = nextBloomBudget(state, 1 / 60, true);
      expect(state.enabled).toBe(false);
    }
    state = nextBloomBudget(state, 1 / 60, true);
    expect(state.enabled).toBe(true);
    expect(nextBloomBudget(state, 1 / 60, false).enabled).toBe(false);
  });
});

describe("progressive, bounded difficulty", () => {
  it("starts gently and never has a tier jump or runaway slope/speed", () => {
    let previous = flightProgression(0);
    expect(previous).toEqual({ hillScale: 1, rhythmScale: 1 });
    for (let island = 1; island <= 1000; island++) {
      const next = flightProgression(island);
      expect(next.hillScale).toBeGreaterThanOrEqual(previous.hillScale);
      expect(next.hillScale - previous.hillScale).toBeLessThan(0.03);
      expect(next.hillScale).toBeLessThanOrEqual(1.32);
      expect(next.rhythmScale).toBeLessThanOrEqual(1.24);
      expect(endlessSpeedScale(island, island * 60)).toBeLessThanOrEqual(1.55);
      previous = next;
    }
    expect(endlessSpeedScale(0, 0)).toBe(1);
    expect(terrainDifficulty(NaN)).toBe(1);
    expect(terrainDifficulty(100)).toBe(1.16);
    expect(terrainDifficulty(-5)).toBe(0.86);
  });
});

describe("readable sound landmarks", () => {
  it("plays the momentum scoop once per island, not 120 times per second", () => {
    const cues = new FlightCues();
    const bird = { grounded: true, altitude: 0, vy: -30, speed: () => 70 };
    expect(cues.update(PHYS_DT, bird, 0, 760)).toBe("runup");
    for (let i = 0; i < 200; i++) expect(cues.update(PHYS_DT, bird, 0, 760)).toBeNull();
    expect(cues.update(PHYS_DT, bird, 1, 760)).toBe("runup");
    cues.reset();
    expect(cues.update(PHYS_DT, bird, 0, 760)).toBe("runup");
  });
  it("marks only a high apex, with a cooldown against repeated chatter", () => {
    const cues = new FlightCues();
    const bird = { grounded: false, altitude: 100, vy: 10, speed: () => 70 };
    cues.update(PHYS_DT, bird, 0, 600);
    bird.vy = -1;
    expect(cues.update(PHYS_DT, bird, 0, 600)).toBe("apex");
    bird.vy = 1; cues.update(PHYS_DT, bird, 0, 600);
    bird.vy = -1;
    expect(cues.update(PHYS_DT, bird, 0, 600)).toBeNull();
  });
});
