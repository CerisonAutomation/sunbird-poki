import { GRAVITY_GLIDE } from "./constants";
import { DROP_START, GAP_START, RAMP_START } from "./constants";
import { t } from "../i18n";

/** Read the same terrain boundaries as physics; no hard-coded second ramp. */
export function terrainCue(s: { grounded: boolean; localX: number; altitude: number; vy: number; landingSlope: number }): string {
  if (s.grounded) {
    if (s.localX >= RAMP_START && s.localX < GAP_START) return t("onboarding.rideRamp", undefined, "RELEASE · ride the ramp to launch");
    if (s.localX >= DROP_START && s.localX < RAMP_START) return t("onboarding.buildSpeed", undefined, "HOLD · build speed down the big drop");
  } else if (s.altitude > 4 && s.altitude < 55 && s.vy < -8) {
    return s.landingSlope < -0.08 ? t("onboarding.catchDownslope", undefined, "HOLD · catch the downslope") : t("onboarding.softenLanding", undefined, "RELEASE · soften the landing");
  } else if (s.altitude >= 55 && s.vy < -8) {
    return t("onboarding.holdToDescend", undefined, "HOLD to descend · look for a downhill landing");
  }
  return "";
}

/** A single practical takeaway, not a second wall of stats or invented praise. */
export function flightTakeaway(s: { distance: number; bestDistance: number; perfects: number; island: number }): { title: string; tip: string } {
  if (s.perfects === 0) return { title: "Find your rhythm", tip: "Hold down the valley. Release as the hill turns upward to earn a perfect launch." };
  if (s.island === 0) return { title: "Your next island is waiting", tip: "Build momentum down the big drop. Release on the final ramp to cross the water." };
  const best = Math.max(0, Number.isFinite(s.bestDistance) ? s.bestDistance : 0, Number.isFinite(s.distance) ? s.distance : 0);
  const step = best < 2000 ? 250 : 500;
  const target = (Math.floor(best / step) + 1) * step;
  return { title: `Next landmark: ${target.toLocaleString("en-US")} m`, tip: "Catch the downslopes and link clean launches. Smooth timing beats holding all the way." };
}

/** Short ballistic look-ahead for the landing cue, not a physics correction.
 * Near-ground hints must sample the imminent touchdown, not a fixed 0.3 s away. */
export function landingLookAhead(altitude: number, vx: number, vy: number): number {
  if (![altitude, vx, vy].every(Number.isFinite) || altitude <= 0 || vy >= 0) return 0;
  const seconds = 2 * altitude / (Math.sqrt(vy * vy + 2 * GRAVITY_GLIDE * altitude) - vy);
  return Math.min(48, Math.max(0, vx) * Math.min(0.6, seconds));
}
