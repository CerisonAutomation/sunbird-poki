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
        if (this.airTime >= 1.4) {
          this.active = false;
          this.completed = true;
          this.celebration = 3;
        }
        break;
    }
  }

  view(): CoachState {
    if (this.completed && this.celebration > 0) {
      return { text: "", step: STEPS, steps: STEPS, justCompleted: true };
    }
    if (!this.active) return { text: "", step: -1, steps: STEPS, justCompleted: false };
    const text = [
      `⬇ ${t("onboarding.holdToDive", undefined, "HOLD to dive down the hill")}`,
      `⬆ ${t("onboarding.releaseToLaunch", undefined, "RELEASE at the top to launch")}`,
      `🕊 ${t("onboarding.soarInAir", undefined, "RELEASE & SOAR — stay airborne!")}`,
    ][this.step]!;
    return { text, step: this.step, steps: STEPS, justCompleted: false };
  }
}
