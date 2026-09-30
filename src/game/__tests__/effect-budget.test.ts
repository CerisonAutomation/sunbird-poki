import { describe, expect, it } from "vitest";
import {
  EFFECT_RECOVERY_WINDOWS,
  PARTICLE_FLOOR,
  QUALITY_WINDOW_SECONDS,
  nextEffectBudget,
  type EffectBudget,
} from "../quality";

const GOOD = 1 / 120; // comfortably inside budget
const OK = 1 / 50; // inside the 40 fps floor, outside the effect-up bar
const BAD = 1 / 20; // budget blown

const fresh = (over: Partial<EffectBudget> = {}): EffectBudget => ({
  shadows: true,
  particles: 1,
  goodWindows: 0,
  ...over,
});

const run = (start: EffectBudget, frames: number[], shadowsAllowed = true): EffectBudget =>
  frames.reduce((state, f) => nextEffectBudget(state, f, { shadowsAllowed }), start);

/**
 * `nextDpr` exists because "a single bad moment permanently degrading the rest
 * of the session" is a real defect, stated in its own doc comment. Twenty
 * lines below it, shadows and particles did exactly that: the branch that
 * restored them was gated on `!this.isMobile`, and shadows start ON for every
 * device except the `lite` tier — including mid-range phones.
 *
 * So on a phone, one slow 2.5-second window (an ad tearing down, a thermal
 * blip, a tab regaining focus) shed the shadows and 20% of the particles
 * permanently. Four such windows and the player finished at the particle
 * floor, on hardware that could have run everything. Mobile is the majority of
 * Poki's traffic; the platform that most needed adaptation was the only one
 * that could never recover from it.
 */
describe("effect budget recovers, on every device", () => {
  it("sheds shadows the moment the budget is blown", () => {
    const after = nextEffectBudget(fresh(), BAD, { shadowsAllowed: true });
    expect(after.shadows).toBe(false);
    // The expensive thing goes first; particles are not also cut in the same
    // window, because losing the shadow pass may well be enough.
    expect(after.particles).toBe(1);
  });

  it("keeps cutting particles while the budget stays blown", () => {
    const after = run(fresh(), [BAD, BAD, BAD, BAD, BAD, BAD]);
    expect(after.shadows).toBe(false);
    expect(after.particles).toBe(PARTICLE_FLOOR);
  });

  it("never cuts particles below the floor — the game must keep communicating", () => {
    const after = run(fresh(), Array.from({ length: 50 }, () => BAD));
    expect(after.particles).toBe(PARTICLE_FLOOR);
  });

  it("gives particles back before shadows, once headroom returns", () => {
    const degraded = run(fresh(), [BAD, BAD, BAD]);
    expect(degraded.particles).toBeLessThan(1);
    const recovering = run(degraded, Array.from({ length: EFFECT_RECOVERY_WINDOWS }, () => GOOD));
    expect(recovering.particles).toBeGreaterThan(degraded.particles);
    // Shadows are the pricier pass and stay off until particles are whole.
    expect(recovering.shadows).toBe(false);
  });

  it("fully recovers a session that had one bad patch", () => {
    // THE REGRESSION, as a property. Before the fix this ended at
    // { shadows: false, particles: 0.6 } forever on any mobile device.
    const degraded = run(fresh(), [BAD, BAD, BAD]);
    const recovered = run(degraded, Array.from({ length: 40 }, () => GOOD));
    expect(recovered.shadows).toBe(true);
    expect(recovered.particles).toBe(1);
  });

  it("is harder to earn back than it is to lose", () => {
    const degraded = nextEffectBudget(fresh(), BAD, { shadowsAllowed: true });
    // One good window is not enough — that is what would oscillate.
    const oneGood = nextEffectBudget(degraded, GOOD, { shadowsAllowed: true });
    expect(oneGood.shadows).toBe(false);
    expect(oneGood.particles).toBe(degraded.particles);
    expect(EFFECT_RECOVERY_WINDOWS * QUALITY_WINDOW_SECONDS).toBeGreaterThanOrEqual(7.5);
  });

  it("does not accumulate recovery credit on merely adequate frames", () => {
    // 50 fps is inside the step-down floor but is not headroom. Banking
    // credit here is how a device that is only just coping talks itself into
    // switching the shadow pass back on.
    const degraded = run(fresh(), [BAD]);
    const holding = run(degraded, [OK, OK, OK, OK, OK]);
    expect(holding.shadows).toBe(false);
    expect(holding.goodWindows).toBe(0);
  });

  it("never switches shadows on where they were never allowed", () => {
    // Software rasteriser, or the measured `lite` tier. Not having shadows is
    // that device's baseline, not a degradation to recover from.
    const lite = run({ shadows: false, particles: 1, goodWindows: 0 }, Array.from({ length: 40 }, () => GOOD), false);
    expect(lite.shadows).toBe(false);
    expect(lite.particles).toBe(1);
  });
});
