import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { TerrainSystem } from "../TerrainSystem";
import { LIVE_TUNE_DEFAULTS, PHYS_DT, applyLiveTune, type LiveTunable } from "../constants";
import {
  RELEASE_KICK_COOLDOWN,
  RELEASE_SURGE,
  RELEASE_SURGE_COMMIT,
  RELEASE_SURGE_SPEED,
  RELEASE_TUNE_DEFAULTS,
  applyReleaseTune,
  releaseSurge,
  type ReleaseTunable,
} from "../FlightPhysics";

/**
 * THE RELEASE SURGE — a committed release pays forward as well as up.
 *
 * The skill gap in this game is a SPEED gap, not a height gap: two policies
 * that both carve the ground move at the same speed there (27.6 against
 * 28.7 m/s measured), and the entire 1.35x the suite reports is the taught
 * rule spending 47% of the run in the air at 50.7 m/s while the masher spends
 * 15% of it at 21.9 m/s. `RELEASE_SURGE` is the lever that pays on that axis.
 *
 * Everything about it is about NOT handing the reward to the wrong pilot, and
 * that is what this file pins. A per-release payout is only safe if a pilot who
 * either never releases or merely twitches the button cannot reach it, so each
 * gate gets its own case below:
 *
 *   1. a non-releasing policy is bit-for-bit untouched;
 *   2. a twitch — a dive shorter than the commit — buys nothing;
 *   3. a committed release buys real forward speed, and it is earned by speed;
 *   4. it cannot be chained, and a dive worth braking still gets only the brake.
 *
 * The end-to-end case flies the SHIPPED Bird over the SHIPPED terrain, because
 * every one of the pure-function cases above would pass just as happily if
 * `Bird.step` forgot to call `releaseSurge` at all.
 */

function resetAll(): void {
  for (const key of Object.keys(LIVE_TUNE_DEFAULTS) as LiveTunable[]) applyLiveTune(key, LIVE_TUNE_DEFAULTS[key]);
  for (const key of Object.keys(RELEASE_TUNE_DEFAULTS) as ReleaseTunable[]) applyReleaseTune(key, RELEASE_TUNE_DEFAULTS[key]);
}

/**
 * The shipped value, captured at import.
 *
 * `RELEASE_SURGE` is an ES module *binding*, and these cases deliberately write
 * to it through `applyReleaseTune` — so reading it back after a write returns
 * the value just written, not the default. Capturing it here, once, is what
 * keeps "restore the shipped number" from silently restoring zero.
 */
const SHIPPED_SURGE = RELEASE_SURGE;

type Policy = (bird: Bird, terrain: TerrainSystem, t: number) => boolean;

const HOLD: Policy = () => true;
const COAST: Policy = () => false;
const MASHER_8HZ: Policy = (_bird, _terrain, time) => Math.floor(time * 8) % 2 === 0;
/** The rule the tutorial teaches. */
const TUTORIAL: Policy = (bird, terrain) => terrain.slopeAt(bird.x) < 0;

const SEEDS = ["surge-a", "surge-b", "surge-c", "surge-d", "surge-e", "surge-f"];

function distance(policy: Policy, seed: string, seconds = 60): number {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 0.9);
  const steps = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    bird.step(PHYS_DT, {
      diving: policy(bird, terrain, (i + 1) * PHYS_DT),
      fever: false,
      speedMult: 1,
      boost: false,
    }, terrain);
  }
  const x = bird.x;
  terrain.dispose();
  return x;
}

const everySeed = (policy: Policy): number[] => SEEDS.map((s) => distance(policy, s));

describe("the release surge", () => {
  it("is zero by construction when the commit gate is unreachable", () => {
    // The floor of the whole idea. Every gate below is a `return 0` in
    // `releaseSurge`, and this is the assertion that those returns exist.
    resetAll();
    expect(releaseSurge(0, 0, 200, 0), "a dive that never happened bought a surge").toBe(0);
    expect(releaseSurge(0, RELEASE_KICK_COOLDOWN, 200, 5), "the cooldown did not stop a surge").toBe(0);
  });

  it("cannot be bought by a twitch, only by a dive that was held", () => {
    // The masher half of the argument. An 8 Hz masher's dive is its own
    // half-cycle, 0.125 s, with no variance at all — so if the commit gate is
    // above that width the payout is structurally out of its reach.
    expect(RELEASE_SURGE_COMMIT).toBeGreaterThan(0.125);

    resetAll();
    const fast = 200;
    const twitch = releaseSurge(0, 0, fast, RELEASE_SURGE_COMMIT - 0.001);
    expect(twitch, "a dive shorter than the commit still surged").toBe(0);
    const committed = releaseSurge(0, 0, fast, RELEASE_SURGE_COMMIT);
    expect(committed, "a dive exactly at the commit was refused").toBe(RELEASE_SURGE);
  });

  it("is earned by speed, and is nothing at a standstill", () => {
    // The momentum story. A bird crawling along the ground conveyor must not
    // buy the same reward as one that arrived at lift speed, and the reward
    // must be monotonic in speed between them.
    resetAll();
    const at = (speed: number): number => releaseSurge(0, 0, speed, 1);
    expect(at(0), "a standing bird surged").toBe(0);
    expect(at(RELEASE_SURGE_SPEED), "full lift speed did not buy the full surge").toBeCloseTo(RELEASE_SURGE, 6);
    expect(at(RELEASE_SURGE_SPEED * 4), "the surge must not exceed its constant at any speed")
      .toBeCloseTo(RELEASE_SURGE, 6);
    for (const speed of [10, 25, 40, 55]) {
      expect(at(speed), `the surge must be monotonic in speed at ${speed} m/s`)
        .toBeGreaterThan(at(speed - 5));
    }
  });

  it("leaves a dive worth braking to the brake", () => {
    // A committed plunge out of a fast dive is a RECOVERY, and the game's
    // language for that is already fixed: the pull-out brake, bounded by
    // FLARE_MAX_RISE. The surge must not turn recovery into a launch.
    resetAll();
    expect(releaseSurge(-80, 0, 120, 5), "a committed dive surged instead of braking").toBe(0);
    // ...and above the rise ceiling there is nothing to surge against either.
    expect(releaseSurge(1000, 0, 120, 5), "a bird already rocketing still surged").toBe(0);
  });

  it("leaves a pilot who never releases bit-for-bit identical", () => {
    // EXACT equality, not "about the same" — the same argument
    // pop-drive-integration.test.ts makes for the crest pop, and for the same
    // reason. The masher and the coast are the floor of the game; a tolerance
    // here would let a slow leak back in without anything going red.
    resetAll();
    applyReleaseTune("RELEASE_SURGE", 0);
    const holdBaseline = everySeed(HOLD);
    const coastBaseline = everySeed(COAST);
    for (const surge of [8, 28, 60]) {
      applyReleaseTune("RELEASE_SURGE", surge);
      expect(everySeed(HOLD), `holding the button moved at RELEASE_SURGE = ${surge}`).toEqual(holdBaseline);
      expect(everySeed(COAST), `coasting moved at RELEASE_SURGE = ${surge}`).toEqual(coastBaseline);
    }
  });

  it("is unreachable by an 8 Hz masher — its dives are shorter than the commit", () => {
    // The whole reason `RELEASE_SURGE_COMMIT` exists, measured through the real
    // Bird rather than asserted about the constant. A square wave at 8 Hz has a
    // 0.125 s half-cycle, so a policy built from one cannot commit to a dive at
    // any surge magnitude. This is the gate that keeps a mashing player from
    // farming the reward twelve times a minute.
    resetAll();
    applyReleaseTune("RELEASE_SURGE", 0);
    const baseline = everySeed(MASHER_8HZ);
    applyReleaseTune("RELEASE_SURGE", SHIPPED_SURGE);
    expect(everySeed(MASHER_8HZ), "an 8 Hz masher moved with the surge enabled").toEqual(baseline);
  });

  it("does move the pilot who reads the terrain — otherwise the lever is inert", () => {
    // The other direction. Without it, every "cannot reach" case above would
    // keep passing while the feature quietly died.
    resetAll();
    applyReleaseTune("RELEASE_SURGE", 0);
    const baseline = everySeed(TUTORIAL);
    applyReleaseTune("RELEASE_SURGE", SHIPPED_SURGE);
    expect(everySeed(TUTORIAL), "releasing the surge did not move the releasing pilot").not.toEqual(baseline);
  });

  it("reaches Bird.step at all — the forward speed is really applied", () => {
    // Every pure-function case above passes just as happily if `Bird.step`
    // forgets to call `releaseSurge` at all, so this one flies the shipped Bird
    // over the shipped terrain and watches the release frames happen.
    //
    // The signal is the horizontal jump ON a kick frame. Nothing else in the
    // airborne branch can raise `vx`: gravity is vertical, drag only decays it,
    // and the speed cap only scales it down. So a kick step on which the bird
    // gains real forward speed is a step on which the surge was applied — no
    // reference to `releaseSurge` itself is needed to read that.
    resetAll();
    let best = Number.NEGATIVE_INFINITY;
    let kickFrames = 0;
    for (const seed of SEEDS) {
      const terrain = new TerrainSystem(seed);
      const bird = new Bird();
      bird.reset(64, terrain.heightAt(64) + 0.9);
      const steps = Math.round(60 / PHYS_DT);
      for (let i = 0; i < steps; i++) {
        const before = bird.vx;
        bird.step(PHYS_DT, {
          diving: TUTORIAL(bird, terrain, (i + 1) * PHYS_DT),
          fever: false,
          speedMult: 1,
          boost: false,
        }, terrain);
        if (bird.releaseKickAmount > 0) {
          kickFrames += 1;
          best = Math.max(best, bird.vx - before);
        }
      }
      terrain.dispose();
    }
    expect(kickFrames, "no airborne release fired in 360 s of real flight — the probe is measuring nothing")
      .toBeGreaterThan(0);
    expect(best, "the best release frame gained no forward speed, so Bird.step never applied the surge")
      .toBeGreaterThan(RELEASE_SURGE * 0.3);
    resetAll();
  });
});
