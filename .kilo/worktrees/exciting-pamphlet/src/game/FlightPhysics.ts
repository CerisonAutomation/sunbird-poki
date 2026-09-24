import { clamp, lerp } from "./math";

/** Anti-bore lift decay: a good launch feels great for ~1.2s, then lift
 * falls off FAST so you can't hang for 10s doing nothing. After 3.5s you're
 * sinking hard and must dive or find a thermal. Shared by all pilots.
 * TUNED 2026-09-24: starts 1.2s, hits 0.15 by 3.7s, 0.08 by 6s — no more
 * endless glides, constant hill-to-hill decisions. */
export function glideLiftScale(airSeconds: number): number {
  if (airSeconds < 1.2) return 1;
  if (airSeconds < 3.7) return lerp(1, 0.15, clamp((airSeconds - 1.2) / 2.5, 0, 1));
  // After 3.7s, sink hard: 0.15 → 0.06 over next 2.3s
  return lerp(0.15, 0.06, clamp((airSeconds - 3.7) / 2.3, 0, 1));
}
