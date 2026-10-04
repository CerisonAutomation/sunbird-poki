import { describe, expect, it } from "vitest";

import {
  INTERP_DELAY,
  SEND_DT,
  STALE_AFTER,
  newTrack,
  sampleTrack,
  type Keyframe,
} from "../RoomSync";

/**
 * The multiplayer domain core, pinned directly.
 *
 * This logic used to exist as two byte-identical copies inside the WebSocket
 * and WebRTC transports, so every test for it was a test of a transport. Now
 * that both call `sampleTrack`, a regression here changes how remote pilots
 * look on *both* backends at once — which is exactly the failure the old
 * duplication made invisible: fix one copy, silently break the other.
 *
 * These pins are about the algorithm's contract, not about either adapter.
 */

const kf = (t: number, x: number, y: number, rot = 0, vx?: number, vy?: number): Keyframe => ({
  t, x, y, rot, vx, vy,
});

describe("RoomSync cadence", () => {
  it("sends at 15 Hz, well under the 60 Hz render rate", () => {
    expect(SEND_DT).toBeCloseTo(1 / 15, 10);
    expect(SEND_DT * 60).toBeLessThan(1.2);
  });

  it("renders behind the newest packet", () => {
      expect(INTERP_DELAY).toBeGreaterThan(0);
      // INTERP_DELAY is deliberately LARGER than one send interval, so at steady
      // state the render instant sits past the newest received sample and peers
      // advance by dead reckoning. That is why every keyframe carries a derived
      // velocity: the dead-reckoning branch is the common path, not the fallback.
      // Pinning the sign keeps a well-meant "shrink the delay" edit from
      // silently changing which branch renders most frames.
      expect(INTERP_DELAY).toBeGreaterThan(SEND_DT);
    });

  it("keeps the stale window well above the send interval", () => {
    expect(STALE_AFTER).toBeGreaterThan(SEND_DT * 2);
  });
});

describe("sampleTrack — empty and single-sample buffers", () => {
  it("returns null for a pilot who has sent nothing", () => {
    expect(sampleTrack([], 5)).toBeNull();
  });

  it("dead-reckons from the lone sample when there is no pair to lerp", () => {
    const pose = sampleTrack([kf(1, 10, 20, 0.5, 2, -3)], 1.1);
    expect(pose).not.toBeNull();
    // 0.1s past the only sample at (2, -3) units/s.
    expect(pose!.x).toBeCloseTo(10 + 2 * 0.1, 10);
    expect(pose!.y).toBeCloseTo(20 - 3 * 0.1, 10);
    expect(pose!.rotation).toBe(0.5);
  });

  it("treats a missing velocity as stationary, never NaN", () => {
    const pose = sampleTrack([kf(1, 4, 4)], 1.5);
    expect(pose!.x).toBe(4);
    expect(pose!.y).toBe(4);
  });
});

describe("sampleTrack — interpolation inside the buffer", () => {
  it("lerps position and rotation halfway between two samples", () => {
    const pose = sampleTrack([kf(0, 0, 0, 0), kf(1, 10, 20, 2)], 0.5);
    expect(pose!.x).toBeCloseTo(5, 10);
    expect(pose!.y).toBeCloseTo(10, 10);
    expect(pose!.rotation).toBeCloseTo(1, 10);
  });

  it("pins to the first sample before the buffer begins", () => {
    const pose = sampleTrack([kf(10, 3, 4, 1), kf(11, 13, 14, 3)], 2);
    expect(pose!.x).toBeCloseTo(3, 10);
    expect(pose!.y).toBeCloseTo(4, 10);
    expect(pose!.rotation).toBeCloseTo(1, 10);
  });

  it("holds the newest sample at exactly its timestamp", () => {
    const pose = sampleTrack([kf(10, 0, 0, 0), kf(20, 100, 200, 1.5)], 20);
    expect(pose!.x).toBeCloseTo(100, 10);
    expect(pose!.y).toBeCloseTo(200, 10);
    expect(pose!.rotation).toBeCloseTo(1.5, 10);
  });

  it("finds the bracketing pair rather than always using the extremes", () => {
    // Three samples: the middle pair must win for a render time inside it.
    const buffer = [kf(0, 0, 0, 0), kf(10, 100, 0, 1), kf(20, 200, 0, 2)];
    const pose = sampleTrack(buffer, 15);
    expect(pose!.x).toBeCloseTo(150, 10);
    expect(pose!.rotation).toBeCloseTo(1.5, 10);
  });

  it("does not divide by zero on a degenerate duplicate timestamp", () => {
    const pose = sampleTrack([kf(5, 1, 1, 0), kf(5, 2, 2, 0)], 5);
    expect(Number.isFinite(pose!.x)).toBe(true);
    expect(Number.isFinite(pose!.y)).toBe(true);
  });
});

describe("sampleTrack — dead reckoning past the newest sample", () => {
  it("extrapolates along stored velocity", () => {
    const pose = sampleTrack([kf(0, 0, 0, 0, 10, 0)], 0.05);
    expect(pose!.x).toBeCloseTo(0.5, 10);
    expect(pose!.y).toBeCloseTo(0, 10);
  });

  it("caps the extrapolation at 200ms so a stalled bird cannot fly off", () => {
    // A peer that stops sending must not sail away at its last known velocity
    // while its packets are still in flight.
    const pose = sampleTrack([kf(0, 0, 0, 0, 10, 0)], 10);
    expect(pose!.x).toBeCloseTo(2, 10);
  });

  it("holds rotation at the last known value while extrapolating", () => {
    const pose = sampleTrack([kf(0, 0, 0, 1.25, 5, 5)], 1);
    expect(pose!.rotation).toBe(1.25);
  });
});

describe("newTrack", () => {
  it("seeds every field the renderer and roster read", () => {
    const t = newTrack("p1", 12.5);
    expect(t.id).toBe("p1");
    expect(t.name).toBe("Pilot");
    expect(t.skin).toBe("sunbird");
    expect(t.buffer).toEqual([]);
    expect(t.distance).toBe(0);
    expect(t.finished).toBe(false);
    expect(t.finishTime).toBe(0);
    expect(t.place).toBe(0);
    expect(t.emote).toBe("");
    expect(t.ready).toBe(false);
    expect(t.lastSeen).toBe(12.5);
  });

  it("gives each peer its own hue", () => {
    expect(newTrack("a", 0).hue).not.toBe(newTrack("b", 0).hue);
  });

  it("defaults emoteAt to the past so a new peer never pops an emote", () => {
    expect(newTrack("p1", 0).emoteAt).toBeLessThan(0);
  });
});