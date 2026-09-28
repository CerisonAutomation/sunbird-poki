import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CameraRig, CHASE_POSE, CLIP_SHOTS, clipPose, clipShotFor, mixClipPose } from "../CameraRig";
import { CLIP_KINDS } from "../Moments";
import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";

/**
 * Camera feel invariants (prototype parity: FOV+8 in fever, shake on
 * demand, gameplay framing untouched by attract mode). Pure three.js
 * scene-graph math — no renderer needed.
 */

function rigAt(speedTarget = 60): { rig: CameraRig; bird: Bird; terrain: TerrainSystem } {
  const terrain = new TerrainSystem("2026-09-14");
  const bird = new Bird();
  bird.reset(200, terrain.heightAt(200) + 20);
  bird.vx = speedTarget;
  bird.vy = 0;
  bird.grounded = false;
  const rig = new CameraRig(16 / 9);
  rig.snapTo(bird);
  return { rig, bird, terrain };
}

function settle(rig: CameraRig, bird: Bird, frames: number, fever: boolean, attract = false): void {
  for (let i = 0; i < frames; i++) rig.update(1 / 60, bird, true, 0, attract, fever);
}

describe("clip overlay", () => {
  it("does not change the chase cam until pulseClip is called", () => {
    const { rig, bird, terrain } = rigAt();
    settle(rig, bird, 60, false);
    const x = rig.camera.position.x;
    settle(rig, bird, 60, false);
    expect(Math.abs(rig.camera.position.x - x)).toBeLessThan(8);
    terrain.dispose();
  });

  it("pulses a finite overlay and decays back toward chase", () => {
    const { rig, bird, terrain } = rigAt();
    settle(rig, bird, 60, false);
    const before = rig.camera.position.clone();
    rig.pulseClip("finish", 1, 40);
    rig.update(1 / 60, bird, true, 0, false, false);
    expect(Number.isFinite(rig.camera.position.x)).toBe(true);
    expect(rig.camera.position.distanceTo(before)).toBeGreaterThan(0.2);
    settle(rig, bird, 240, false);
    expect(rig.camera.fov).toBeGreaterThan(40);
    terrain.dispose();
  });
});

describe("fever FOV kick", () => {
  it("widens the lens ~8° in fever and relaxes after", () => {
    const { rig, bird, terrain } = rigAt();
    settle(rig, bird, 240, false);
    const calm = rig.camera.fov;
    settle(rig, bird, 240, true);
    expect(rig.camera.fov - calm).toBeGreaterThan(6);
    expect(rig.camera.fov - calm).toBeLessThan(10);
    settle(rig, bird, 240, false);
    expect(Math.abs(rig.camera.fov - calm)).toBeLessThan(0.5);
    terrain.dispose();
  });

  it("stays calm under reduce-motion", () => {
    const { rig, bird, terrain } = rigAt();
    rig.setReduceMotion(true);
    settle(rig, bird, 240, false);
    const calm = rig.camera.fov;
    settle(rig, bird, 240, true);
    expect(Math.abs(rig.camera.fov - calm)).toBeLessThan(0.5);
    terrain.dispose();
  });
});

describe("attract bird visibility", () => {
  // The menu card covers roughly the middle third of a wide screen
  // (ndc.x in [-0.3, +0.3] at 16:9). The demo bird must settle left of it
  // yet stay on screen, at cruise, dive-bomb and high altitude.
  const v = new THREE.Vector3();
  function settledNdc(speed: number, altitude: number): { x: number; y: number } {
    const terrain = new TerrainSystem("2026-09-14");
    const bird = new Bird();
    bird.reset(400, terrain.heightAt(400) + Math.max(0.9, altitude));
    bird.vx = speed;
    bird.vy = 0;
    bird.grounded = false;
    const rig = new CameraRig(16 / 9);
    rig.snapTo(bird);
    for (let i = 0; i < 400; i++) rig.update(1 / 60, bird, false, terrain.heightAt(bird.x), true);
    v.set(bird.x, bird.y, 0).project(rig.camera);
    const out = { x: v.x, y: v.y };
    terrain.dispose();
    return out;
  }

  it.each([
    ["cruise", 45, 12],
    ["fast dive", 95, 25],
    ["high soar", 70, 120],
    ["low skim", 55, 2],
  ])("keeps the bird in the open left margin (%s)", (_label, speed, alt) => {
    const ndc = settledNdc(speed, alt);
    expect(ndc.x).toBeLessThan(-0.35);
    expect(ndc.x).toBeGreaterThan(-0.95);
    expect(Math.abs(ndc.y)).toBeLessThan(0.85);
  });
});

describe("mobile gameplay framing", () => {
  it("pulls back on portrait screens", () => {
    const wide = rigAt();
    settle(wide.rig, wide.bird, 240, false);
    const wideZ = wide.rig.camera.position.z;
    const narrow = new CameraRig(390 / 844);
    narrow.snapTo(wide.bird);
    settle(narrow, wide.bird, 240, false);
    expect(narrow.camera.position.z).toBeGreaterThan(wideZ + 4);
    wide.terrain.dispose();
  });
});

describe("attract framing", () => {
  it("pulls back and leads farther than gameplay framing", () => {
    const a = rigAt();
    settle(a.rig, a.bird, 240, false, true);
    const attractZ = a.rig.camera.position.z;
    const b = rigAt();
    settle(b.rig, b.bird, 240, false, false);
    expect(attractZ).toBeGreaterThan(b.rig.camera.position.z + 8);
    a.terrain.dispose();
    b.terrain.dispose();
  });
});

describe("clip camera poses", () => {
  it("maps every clip kind onto a known shot", () => {
    for (const kind of CLIP_KINDS) {
      expect(CLIP_SHOTS).toContain(clipShotFor(kind));
    }
    expect(clipShotFor("last_second")).toBe("finish");
    expect(clipShotFor("crash")).toBe("crash");
    expect(clipShotFor("overtake")).toBe("overtake");
  });

  it("keeps FOV and roll inside the compose-with-SpeedFeel budget", () => {
    for (const shot of CLIP_SHOTS) {
      const pose = clipPose(shot, 1.2, 200);
      expect(pose.fovDelta).toBeGreaterThanOrEqual(-8);
      expect(pose.fovDelta).toBeLessThanOrEqual(8);
      expect(pose.roll).toBeGreaterThanOrEqual(-0.12);
      expect(pose.roll).toBeLessThanOrEqual(0.12);
    }
  });

  it("chase is the identity pose", () => {
    expect(clipPose("chase", 0, 0)).toEqual(CHASE_POSE);
  });

  it("mixes toward the overlay and back", () => {
    const hero = clipPose("hero", 0.5, 20);
    expect(mixClipPose(CHASE_POSE, hero, 0)).toEqual(CHASE_POSE);
    expect(mixClipPose(CHASE_POSE, hero, 1)).toEqual(hero);
  });
});

/**
 * The camera framed the simulation, not the sprite.
 *
 * The mesh is drawn at `lerp(prev, now, acc/PHYS_DT)` while `bird.x/y` sit on
 * the 120 Hz staircase. Passing the raw bird to `update()` put the camera up to
 * a full physics step behind the thing it was framing — 1.07 units at the fever
 * speed cap, ~19 px at 720p — sawtoothing every frame of every run. The
 * camera's own lag filter could not hide it, because the offset lives on the
 * MESH, not the camera.
 *
 * Asserted as a DELTA rather than an absolute position, because the camera
 * intentionally leads the bird (the `-1.5` and the look-ahead) and the
 * invariant is only that the override moves the frame with the sprite.
 */
describe("camera: the drawn position is the framed position", () => {
  const LEAD = 1.07; // one PHYS_DT of travel at the fever speed cap

  function settle(viewX?: number): number {
    const terrain = new TerrainSystem("cam-interp");
    const bird = new Bird();
    bird.reset(500, terrain.heightAt(500) + 30);
    bird.vx = 90;
    bird.grounded = false;
    const rig = new CameraRig(16 / 9);
    for (let i = 0; i < 180; i++) {
      rig.update(1 / 60, bird, true, terrain.heightAt(bird.x), false, false, viewX, bird.y);
    }
    return rig.camera.position.x;
  }

  it("moves the frame with the sprite when given a drawn position", () => {
    const onSim = settle();
    const onDrawn = settle(500 + LEAD);
    expect(onDrawn - onSim).toBeCloseTo(LEAD, 1);
  });

  it("does not saturate the dolly on a long frame", () => {
    // `Math.min(1, kSlow * 2.8)` reached 1 at dt >= 113 ms — inside the 250 ms
    // the frame-time clamp allows — and snapped camZ to target in one frame
    // while X and Y were still damping. A retention root cannot saturate.
    const terrain = new TerrainSystem("cam-dolly");
    const bird = new Bird();
    bird.reset(800, terrain.heightAt(800) + 40);
    bird.vx = 120;
    bird.grounded = false;

    const rig = new CameraRig(16 / 9);
    for (let i = 0; i < 60; i++) rig.update(1 / 60, bird, true, terrain.heightAt(bird.x));
    const before = rig.camera.position.z;
    // One sanctioned long frame: the dolly must move, but not all the way.
    rig.update(0.2, bird, true, terrain.heightAt(bird.x));
    const moved = Math.abs(rig.camera.position.z - before);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(12);
  });
});

/**
 * Run start snapped the camera; run end only softened it, and the softening
 * arrived as a step.
 *
 * The damping retention went from 0.006 (playing) straight to 0.05 (anything
 * else) the instant a run ended — a 63% change in stiffness, on the exact
 * frame the player watches the bird coast to a stop. It now eases across half
 * a second. Attract mode is unaffected: it wants the loose value immediately.
 */
describe("camera: end-of-run stiffness is eased, not stepped", () => {
  it("loosens progressively and reaches the loose value", () => {
    const terrain = new TerrainSystem("cam-coast");
    const bird = new Bird();
    bird.reset(1200, terrain.heightAt(1200) + 30);
    bird.vx = 80;
    bird.grounded = false;

    const rig = new CameraRig(16 / 9);
    for (let i = 0; i < 60; i++) rig.update(1 / 60, bird, true, terrain.heightAt(bird.x));

    // Release the run. Sample how far the camera has travelled from its
    // playing-frame target over successive frames of coast.
    const target = 1200;
    const travelled: number[] = [];
    for (let i = 0; i < 60; i++) {
      rig.update(1 / 60, bird, false, terrain.heightAt(bird.x));
      travelled.push(rig.camera.position.x - target);
    }
    const early = travelled[2]!;
    const late = travelled[50]!;
    // Monotone approach, and the first frames have not yet fully arrived.
    expect(late).toBeGreaterThan(early);
    expect(Math.abs(early)).toBeLessThan(Math.abs(late));
  });

  it("returns to gameplay stiffness immediately on a fresh run", () => {
    const terrain = new TerrainSystem("cam-restart");
    const bird = new Bird();
    bird.reset(300, terrain.heightAt(300) + 30);
    bird.vx = 80;
    bird.grounded = false;
    const rig = new CameraRig(16 / 9);
    for (let i = 0; i < 30; i++) rig.update(1 / 60, bird, false, terrain.heightAt(bird.x));
    // snapTo is the fresh-run path; it must clear the coast clock, or a new run
    // would inherit half a second of already-loosened damping.
    rig.snapTo(bird);
    for (let i = 0; i < 30; i++) rig.update(1 / 60, bird, true, terrain.heightAt(bird.x));
    // -1.5 is the deliberate lead that keeps the bird off dead centre.
    expect(rig.camera.position.x).toBeCloseTo(bird.x - 1.5, 0);
  });
});
