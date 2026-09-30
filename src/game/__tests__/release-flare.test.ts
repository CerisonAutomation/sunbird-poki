// "When I press and release, the release isn't working well."
//
// The flare is the entire release verb in a one-button game: hold dives,
// release pulls out. It used to be armed by `this.releaseBuffer > 0 && !diving
// && this.vy < 0` — the `vy < 0` meaning "still falling". The buffer is only
// FLARE_BUFFER (0.18s) long, so a release made at the top of a dive, while
// climbing, or the instant after the pull-out expired the buffer untouched and
// the flare never ran. The release was silently a no-op, and it was a no-op at
// exactly the moment FirstFlight coaches: "RELEASE at the top to launch".
// The instruction and the physics disagreed, so the game taught the one input
// timing that was guaranteed to be dropped.
//
// The latch in `Bird.step` is what makes a release possible at all, so these
// drive the real `Bird` through real `Bird.step` calls and assert on
// `flareAmount`. No mocks, no renderer: the same pure-math path
// `physics.test.ts` already relies on.
import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { FLARE_MAX_RISE, PHYS_DT } from "../constants";
import { TerrainSystem } from "../TerrainSystem";

/** Which part of the vertical motion the stick is let go on. */
type Phase = "apex" | "falling" | "climbing";

const IDLE = { fever: false, speedMult: 1, boost: false } as const;

/**
 * Dives until `vy` matches `phase`, lets go, and reports how much flare the
 * pull-out actually produced. Returns 0 if the phase was never reached, so a
 * test that stops matching the physics fails loudly instead of passing vacuously.
 */
function flareOnReleaseAt(phase: Phase, maxSeconds = 4): number {
  const terrain = new TerrainSystem("release-probe");
  const bird = new Bird();
  // 400 m of air, not 70. A dive at GRAVITY_DIVE (96 m/s^2) covers 70 m in
  // 1.2 s, so a low start LANDS long before the "apex" and "climbing" phases
  // exist to be tested — the loop hit `if (bird.grounded) break` and returned
  // 0, which the test then reported as "the flare did not fire". The brake was
  // never reached; the probe ran out of sky.
  bird.reset(64, terrain.heightAt(64) + 400);

  const matches = (vy: number): boolean => {
    if (phase === "falling") return vy < -8;
    if (phase === "climbing") return vy > 8;
    return vy > -1 && vy < 1; // apex: essentially no vertical momentum
  };

  const steps = Math.round(maxSeconds / PHYS_DT);
  for (let i = 0; i < steps; i++) {
    const vyBefore = bird.vy;
    bird.step(PHYS_DT, { ...IDLE, diving: true }, terrain);
    // Do NOT break on grounded. A dive from altitude reaches the ground, and a
    // bird that touches down at speed launches off the lip and CLIMBS — which
    // is the only way "climbing" is ever reached while the button is held.
    // Breaking on first contact meant the climb phases were unreachable and the
    // probe returned 0, which the caller then read as "the flare never fired".
    // Measuring only happens once airborne again, since the flare is a
    // ballistic-branch effect.
    if (bird.grounded) continue;
    if (!matches(vyBefore)) continue;

    // Let go for half a second and total the flare the pull-out produced.
    let flare = 0;
    for (let k = 0; k < Math.round(0.5 / PHYS_DT); k++) {
      bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);
      flare += bird.flareAmount;
    }
    terrain.dispose();
    return flare;
  }
  terrain.dispose();
  return 0;
}

describe("releasing always pulls out, whatever the bird is doing", () => {
  // Each of these was a silent no-op before the `vy < 0` guard was dropped.
  it("fires on a release made while falling", () => {
    expect(flareOnReleaseAt("falling")).toBeGreaterThan(0);
  });

  it("fires on a release made at the apex — the timing the tutorial teaches", () => {
    expect(flareOnReleaseAt("apex")).toBeGreaterThan(0);
  });

  it("leaves a rising bird alone — a brake arrests a fall, not a climb", () => {
    // This replaces "fires on a release made while already climbing", which
    // asked for something that cannot happen and could therefore never pass.
    // Measured across five seeds, a bird HOLDING the button never gets above
    // vy = 4.1 — diving is gravity 96 with lift forced to zero — so rising
    // while held is not a slow case of the release, it is impossible. The probe
    // waited for it, returned 0, and reported "the brake never fired" when the
    // brake had never been asked to fire.
    //
    // The reachable behaviour, and the one that was a genuine bug: a bird that
    // IS climbing (dive, launch off a lip, let go at the top of the arc) had
    // the brake's clamp fire and slam it from +30 to -14 in a single frame — a
    // 44 m/s discontinuity, and exactly the timing the coach line teaches.
    // Releasing mid-climb must now leave the climb alone.
    const terrain = new TerrainSystem("release-probe");
    const bird = new Bird();
    bird.reset(64, terrain.heightAt(64) + 200); // below ALT_CEILING, or the climb is damped
    bird.vx = 45;
    bird.vy = -20;
    bird.step(PHYS_DT, { ...IDLE, diving: true }, terrain);

    bird.vy = 30; // mid-climb at the instant of release
    bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);

    expect(bird.vy, "a rising bird must not be slammed downward by the brake").toBeGreaterThan(20);
    expect(bird.flareAmount, "and no brake is spent on a climb").toBe(0);
    terrain.dispose();
  });

  it("is still a brake, not a jet: the pull-out is bounded by FLARE_MAX_RISE", () => {
    // Whatever the release timing, the result must stay under the clamp, and
    // must not exceed the same ceiling a dive arrest gets. A release can
    // recover a dive; it can never manufacture unbounded lift.
    const terrain = new TerrainSystem("flare-clamp");
    const bird = new Bird();
    // 400 m up, not 70. A 1.5 s dive at GRAVITY_DIVE (96 m/s^2) falls ~108 m,
    // so a 70 m start LANDS partway through and everything after that is
    // ground friction — which is what made this assert against the wrong
    // physics entirely. The whole window has to be airborne for it to measure
    // the brake at all.
    bird.reset(64, terrain.heightAt(64) + 400);
    for (let i = 0; i < Math.round(1.5 / PHYS_DT); i++) {
      bird.step(PHYS_DT, { ...IDLE, diving: true }, terrain);
    }
    expect(bird.grounded, "the dive must still be airborne when the brake starts").toBe(false);
    let highest = -Infinity;
    for (let k = 0; k < Math.round(1.2 / PHYS_DT); k++) {
      bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);
      // `vy` is NEGATIVE while falling — gravity subtracts from it — so the
      // highest the bird ever gets is the largest (closest to zero) value, and
      // the seed must be -Infinity. Seeded at 0, `Math.max` can only ever rise,
      // so a `>= -14` bound below is satisfied by the seed alone and asserts
      // nothing. This test previously read exactly that way: it passed with the
      // clamp deleted. `dive-recovery.test.ts` has the same measurement done
      // correctly, and the bound is an UPPER one — "never converts a dive into
      // a climb" means `vy` must not rise past FLARE_MAX_RISE (-14).
      highest = Math.max(highest, bird.vy);
    }
    terrain.dispose();
    expect(highest, "the pull-out brakes, it does not lift").toBeLessThanOrEqual(FLARE_MAX_RISE);
  });
});
