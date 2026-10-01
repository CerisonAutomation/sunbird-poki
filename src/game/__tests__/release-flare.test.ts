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
// drive the real `Bird` through real `Bird.step` calls. No mocks, no
// renderer: the same pure-math path `physics.test.ts` already relies on.
//
// The release has two halves and these tests hold both to their contract: the
// sustained dive BRAKE (`flareAmount`) and the one-shot upward KICK. The brake
// is dive-specific and bounded — it arrests a fall and can never become a
// climb. The kick is everything else, and it is what makes a release off a
// ramp do the thing the tutorial promises.
import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { FLARE_MAX_RISE, PHYS_DT } from "../constants";
import { TerrainSystem } from "../TerrainSystem";

/** Which part of the vertical motion the stick is let go on. */
type Phase = "apex" | "falling" | "climbing";

const IDLE = { fever: false, speedMult: 1, boost: false } as const;

/** What the player actually got out of a single release. */
interface Pullout {
  /** `vy` at the instant the button was let go. */
  readonly vyAtRelease: number;
  /** Largest `vy` reached in the half second after the release. */
  readonly peakVy: number;
  /** Brake actually applied (m/s^2 summed). 0 when the one-shot kick owns it. */
  readonly brake: number;
}

/**
 * Dives until `vy` matches `phase`, lets go, and reports what the pull-out
 * actually did. Returns `null` if the phase was never reached, so a test that
 * stops matching the physics fails loudly instead of passing vacuously.
 *
 * This used to return the summed `flareAmount` and nothing else, which made
 * "the release fired" mean "the BRAKE engaged". That was the right question
 * when the brake was the entire release verb. It stopped being the right
 * question the moment the release grew a second half: at an apex the kick
 * lifts the bird clean out of the brake's engagement band on the same tick, so
 * `flareAmount` reads 0 for a release that visibly threw the bird 22 m/s
 * upward. Asserting only on the brake silently swapped the bug for its mirror
 * — a test that now fails when the feature WORKS. The visible outcome is
 * `peakVy`; the brake is reported alongside it as the dive-specific signal.
 */
function pulloutOnReleaseAt(phase: Phase, maxSeconds = 4): Pullout | null {
  const terrain = new TerrainSystem("release-probe");
  const bird = new Bird();
  // 150 m of air, and BELOW ALT_CEILING (230) on purpose.
  //
  // A dive at GRAVITY_DIVE (96 m/s^2) passes -20 m/s after 0.2 s and about 2 m
  // of fall, so none of the three phases needs the 400 m this probe used to
  // start from. What 400 m cost is that "apex" was matched on the very first
  // step — a held dive passes through vy = 0 only at its start — and it matched
  // it 400 m up, where `dampClimbAtCeiling` is designed to scale any climb to
  // nothing. The probe was measuring a correct ceiling against a release. The
  // bug this file exists to pin lives at ramp height, not at the ceiling.
  bird.reset(64, terrain.heightAt(64) + 150);

  const matches = (vy: number): boolean => {
    // "falling" means a DIVE, not a drift: -20 m/s is comfortably past the
    // brake's engagement band (FLARE_MAX_RISE = -14), so this case exercises
    // the brake itself rather than the shallow-release kick. The drift band
    // between 0 and -14 is covered in flight-release.test.ts.
    if (phase === "falling") return vy < -20;
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

    // Let go for half a second and record both what the release did to the
    // bird and how much brake it spent doing it.
    let peakVy = -Infinity;
    let brake = 0;
    for (let k = 0; k < Math.round(0.5 / PHYS_DT); k++) {
      bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);
      peakVy = Math.max(peakVy, bird.vy);
      brake += bird.flareAmount;
    }
    terrain.dispose();
    return { vyAtRelease: vyBefore, peakVy, brake };
  }
  terrain.dispose();
  return null;
}

describe("releasing always pulls out, whatever the bird is doing", () => {
  // Each of these was a silent no-op before the `vy < 0` guard was dropped.
  it("fires on a release made while falling", () => {
    const p = pulloutOnReleaseAt("falling");
    expect(p, "the probe never reached a committed dive").not.toBeNull();
    expect(p!.brake, "a dive release is met by the brake").toBeGreaterThan(0);
    expect(p!.peakVy, "and it visibly arrests the fall").toBeGreaterThan(p!.vyAtRelease);
  });

  it("fires on a release made at the apex — the timing the tutorial teaches", () => {
    // This is the reported bug. `release` at the apex used to do nothing at
    // all, because commit cbf6950 reduced the whole release to the dive brake
    // and then made the dive brake refuse to engage unless `vy < FLARE_MAX_RISE`
    // — and an apex is by definition not that. So the one timing the tutorial
    // coaches ("RELEASE at the top to launch") was a guaranteed no-op.
    //
    // The bar is deliberately a LAUNCH, not "something happened": an apex
    // release must hand the player real upward speed, or the game is still
    // teaching a lie.
    const p = pulloutOnReleaseAt("apex");
    expect(p, "the probe never reached an apex").not.toBeNull();
    expect(p!.vyAtRelease, "sanity: the release really was made near the apex").toBeLessThan(1);
    expect(p!.vyAtRelease).toBeGreaterThan(-1);
    expect(p!.peakVy, "an apex release must launch the bird, not merely nudge it").toBeGreaterThan(15);
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
