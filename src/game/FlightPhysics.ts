import { clamp, lerp } from "./math";
import { ALT_CEILING, ALT_CEILING_FADE } from "./constants";

/** Anti-bore lift decay: a good launch feels great for ~1.2s, then lift
 * falls off FAST so you can't hang for 10s doing nothing. After 3.5s you're
 * sinking hard and must dive or find a thermal. Shared by all pilots.
 * TUNED 2026-09-24: starts 1.2s, hits 0.15 by 3.7s, 0.08 by 6s — no more
 * endless glides, constant hill-to-hill decisions. */
export function glideLiftScale(airSeconds: number): number {
  // Plateau for 2.5s — a good launch stays exciting; then decay to 0.32 over 4s
  // so long passive glides become boring and the player must dive and re-launch.
  // Floor of 0.32 (not near-zero) keeps the bird controllable even on a lazy glide.
  if (airSeconds < 2.5) return 1;
  return lerp(1, 0.32, clamp((airSeconds - 2.5) / 4.0, 0, 1));
}

/**
 * Damp an upward speed as the bird approaches the altitude ceiling.
 *
 * Returns the vertical speed after damping: unchanged below the fade band and
 * scaled toward zero across it. It only ever reduces a CLIMB — descent and
 * level flight pass through untouched, so dives, glides and landings are exactly
 * as they were. Applied inside Bird.step so every lift source is covered by one
 * rule (thermals, the Zenith ascent super-lift, sunflowers, anything added
 * later) instead of each site needing its own clamp it might forget.
 */
export function dampClimbAtCeiling(vy: number, altitude: number): number {
  if (vy <= 0) return vy;
  const fade = clamp((altitude - (ALT_CEILING - ALT_CEILING_FADE)) / ALT_CEILING_FADE, 0, 1);
  return vy * (1 - fade);
}
