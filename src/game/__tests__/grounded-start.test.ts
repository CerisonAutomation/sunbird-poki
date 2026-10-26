import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AD_DURATION, CONTINUE_TIMEOUT, START_ALTITUDE } from "../constants";

/**
 * The run starts on the ground (2026-10-04 directive: "improve the start so
 * the bird doesn't start in the air").
 *
 * The old 14 m drop-in (START_ALTITUDE) opened every run with a fall the
 * player never chose, while MassRace spawned the rival flock ON the surface —
 * so the player was also the only bird in the sky at the starting line. The
 * grounded start matches the flock, matches the tutorial's first cue ("hold
 * to build speed"), and stops donating 14 m to the climb goal that the run
 * peak scores.
 *
 * The phantom-landing trap that motivated the drop-in in the first place is
 * closed differently now: `grounded` + `wasGrounded` are set AFTER
 * `bird.reset()` (which always parks airborne=false), so the first physics
 * step reads ground→ground and no landing beat fires. That is the detail this
 * suite pins — without it, reverting the spawn alone would bring back the
 * 0.3 s "landed" beat and the sunk-into-the-grass opening frame.
 */
const GAME = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");

describe("the run starts grounded, not in the air", () => {
  it("START_ALTITUDE defaults to perched (0 m above the surface)", () => {
    expect(START_ALTITUDE).toBe(0);
  });

  it("spawns the bird ON the surface at the start line", () => {
    // heightAt + BIRD_RADIUS (+ the 0.5 the ground clamp rests at) — the same
    // resting height the physics uses everywhere else, not a hover.
    expect(GAME).toMatch(/heightAt\(this\.startX\) \+ BIRD_RADIUS \+ 0\.5 \+ START_ALTITUDE/);
  });

  it("marks the bird grounded AFTER reset, so step one is a roll, not a landing", () => {
    const spawn = GAME.match(/this\.bird\.reset\(this\.startX, y\);[\s\S]{0,220}/);
    expect(spawn, "the spawn block must exist").not.toBeNull();
    expect(spawn![0]).toMatch(/this\.bird\.grounded = true/);
    expect(spawn![0]).toMatch(/this\.bird\.wasGrounded = true/);
  });

  it("keeps the second-wind card readable under pressure", () => {
    // The card carries three options plus a reason line; 10 s was tight for a
    // decision this loaded. 14 s is the floor, not the exact value — retuning
    // upward stays free.
    expect(CONTINUE_TIMEOUT).toBeGreaterThanOrEqual(14);
  });

  it("makes the placeholder break long enough to be a real break", () => {
    // 4 s ended before the panel could be read, which made "unskippable"
    // untestable by feel: nothing that short can be skipped. 10 s is the
    // floor for the same reason.
    expect(AD_DURATION).toBeGreaterThanOrEqual(10);
  });
});
