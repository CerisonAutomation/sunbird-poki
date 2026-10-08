/**
 * First-flight coach: a ~15-second interactive tutorial that teaches THE
 * mechanic — dive on the downslope, release on the upslope, soar.
 *
 * Not a video, not a modal wall: four steps verified by real play signals
 * (Poki: hook understood in 10 seconds, no text wall). Runs once ever
 * (per save), pays 50 coins on completion, and gets out of the way the
 * moment the player demonstrates each skill.
 */

import { t } from "../i18n";

export type CoachState = {
  /** Big instruction line, empty when the coach is idle/done. */
  text: string;
  /** 0-based step for the progress pips; -1 when inactive. */
  step: number;
  steps: number;
  /** Set for one snapshot when the whole tutorial completes. */
  justCompleted: boolean;
};

const STEPS = 4;

export class FirstFlight {
  private step = 0;
  private diveHeld = 0;
  private airTime = 0;
  private totalTime = 0;
  private celebration = 0;
  private completed = false;
  private active: boolean;
  /** Ignore input for the first 0.1 s so the "Fly now" button-press cannot
   *  carry through and fill diveHeld before the bird is in play. */
  private startupDelay = 0.1;
  /** Island the player was on when the sun step began: the step completes on
   *  crossing to the NEXT island, which is real progression, not a timer. */
  private sunStepIsland: number | null = null;

  constructor(alreadyDone: boolean) {
    this.active = !alreadyDone;
  }

  get done(): boolean {
    return this.completed;
  }

  /** Feed play signals each frame while the run is live. */
  update(dt: number, sig: { diving: boolean; grounded: boolean; slope: number; justLaunched: boolean; airborne: boolean; islandIndex: number }): void {
    this.totalTime += dt;
    if (!this.active) {
      if (this.celebration > 0) this.celebration -= dt;
      return;
    }
    // Eat the startup grace period before accepting any input. This prevents
    // the "Fly now" button-press from carrying through and filling diveHeld
    // before the bird has had a chance to reach the first downslope.
    if (this.startupDelay > 0) {
      this.startupDelay -= dt;
      return;
    }
    switch (this.step) {
      case 0:
        // Teach the dive: hold on a meaningful downslope for a cumulative beat.
        // Cap per-frame increment so a single slow frame (large dt) cannot
        // complete the step in one tick on low-end devices.
        if (sig.diving && (sig.slope < -0.05 || !sig.grounded)) {
          this.diveHeld += Math.min(dt, 0.1);
        }
        // Advance once the player has held long enough — grounded OR airborne,
        // since after the startup delay both require deliberate input.
        if (this.diveHeld >= 0.55) this.step = 1;
        break;
      case 1:
        // Teach the launch: an actual ramp launch, not a timer.
        if (sig.justLaunched) this.step = 2;
        break;
      case 2:
        // Teach the soar: stay airborne long enough to feel the glide.
        if (sig.airborne) this.airTime += dt;
        else this.airTime = 0;
        if (this.airTime >= 1.4) this.step = 3;
        break;
      case 3:
        // Teach the CLOCK. Daytrip's run ends when daylight runs out, and the
        // 2026-10-04 fit test showed players losing the run at the sun without
        // ever learning that islands refill it. The step completes when the
        // pilot crosses onto the NEXT island — the exact move the line teaches.
        // Time-based fallback: if the player has been airborne for 60+ seconds
        // and still hasn't reached the next island, complete anyway so the
        // tutorial doesn't loop indefinitely on subsequent runs.
        if (this.sunStepIsland === null) this.sunStepIsland = sig.islandIndex;
        if (sig.islandIndex > this.sunStepIsland || this.totalTime >= 60) {
          this.active = false;
          this.completed = true;
          this.celebration = 3;
        }
        break;
    }
  }

  /**
   * `tapMode` mirrors the tap-to-toggle-dive accessibility setting: players
   * using it never hold anything down, so the coach must say "TAP" rather
   * than "HOLD"/"RELEASE" or the very first thing the game teaches would be
   * wrong for their control scheme.
   */
  view(tapMode = false): CoachState {
    if (this.completed && this.celebration > 0) {
      return {
        text: t("onboarding.complete", undefined, "First flight done — the sky is yours! ☀"),
        step: STEPS,
        steps: STEPS,
        justCompleted: true,
      };
    }
    if (!this.active) return { text: "", step: -1, steps: STEPS, justCompleted: false };
    const text = [
      tapMode
        ? `↓ ${t("onboarding.tapToDive", undefined, "TAP to dive — pick up speed")}`
        : `↓ ${t("onboarding.holdToDive", undefined, "HOLD to dive — pick up speed")}`,
      tapMode
        ? `↑ ${t("onboarding.tapToLaunch", undefined, "TAP again at the top to launch")}`
        : `↑ ${t("onboarding.releaseToLaunch", undefined, "RELEASE at the top to launch")}`,
            // Step 3 fires the moment the bird is already airborne, so "RELEASE" is
      // over before it can be done - and it had no tapMode branch, so a
      // player who enabled tap-to-toggle was told to RELEASE a game with
      // nothing to release.
      // No leading glyph: `iconGlyph("bird")` is U+2B28, a Dingbats-block
      // addition from Unicode 8 with patchy coverage on the Android and
      // desktop font stacks this ships to — a tofu box on the exact platform
      // Poki targets. Every other icon in the flight HUD is an SVG; the
      // sentence carries the meaning on its own.
      `${
        tapMode
          ? t("onboarding.tapSoar", undefined, "Soar — stay airborne!")
          : t("onboarding.soarInAir", undefined, "Soar — stay airborne!")
      }`,
      t("onboarding.chaseTheSun", undefined, "The sun is your clock — reach the next island to refill daylight ☀"),
    ][this.step]!;
    return { text, step: this.step, steps: STEPS, justCompleted: false };
  }
}
