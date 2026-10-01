/**
 * First-flight coach: a ~15-second interactive tutorial that teaches THE
 * mechanic — dive on the downslope, release on the upslope, soar.
 *
 * Not a video, not a modal wall: three steps verified by real play signals
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

const STEPS = 3;

export class FirstFlight {
  private step = 0;
  private diveHeld = 0;
  private airTime = 0;
  private celebration = 0;
  private completed = false;
  private active: boolean;

  constructor(alreadyDone: boolean) {
    this.active = !alreadyDone;
  }

  get done(): boolean {
    return this.completed;
  }

  /** Feed play signals each frame while the run is live. */
  update(dt: number, sig: { diving: boolean; grounded: boolean; slope: number; justLaunched: boolean; airborne: boolean }): void {
    if (!this.active) {
      if (this.celebration > 0) this.celebration -= dt;
      return;
    }
    switch (this.step) {
      case 0:
        // Teach the dive: hold on a meaningful downslope for a cumulative beat.
        if (sig.diving && (sig.slope < -0.05 || !sig.grounded)) this.diveHeld += dt;
        // `sig.grounded` is load-bearing. The player's thumb is already down
        // when they tap "Fly now", and that press carries through the frozen
        // countdown, so without this the step-0 bar began filling at menu
        // time and the coach could announce "RELEASE at the top to launch"
        // before the bird had ever left the ground — teaching a gesture for
        // an event the player has not seen.
        if (this.diveHeld >= 0.55 && sig.grounded) this.step = 1;
        break;
      case 1:
        // Teach the launch: an actual ramp launch, not a timer.
        if (sig.justLaunched) this.step = 2;
        break;
      case 2:
        // Teach the soar: stay airborne long enough to feel the glide.
        if (sig.airborne) this.airTime += dt;
        else this.airTime = 0;
        if (this.airTime >= 1.4) {
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
      return { text: "", step: STEPS, steps: STEPS, justCompleted: true };
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
    ][this.step]!;
    return { text, step: this.step, steps: STEPS, justCompleted: false };
  }
}
