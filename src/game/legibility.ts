/**
 * Legibility floors — the rule that the world must stay readable at every hour.
 *
 * Sunbird's day cycle is its best art, and it was also its worst playability
 * bug: by late run the grade collapsed to maroon sky over teal/near-black
 * terrain, and the hill silhouette the player has to read in order to survive
 * sat within a couple of percent luminance of the sky behind it. A one-button
 * game where you cannot see the ground you are about to hit is not difficulty,
 * it is a fairness failure — and it punishes precisely the players who are
 * doing well, because it only appears deep into a good run.
 *
 * The fix is not "make dusk brighter". It is a *floor*: the grade is free to
 * do whatever it likes as long as the silhouette separation never drops below
 * a fixed contrast ratio. Above the floor these functions are the identity
 * function and the art is untouched; they only bite in the small part of the
 * cycle where the art was illegible.
 *
 * Pure, dependency-free and unit-tested on purpose: colour maths that is only
 * exercised through a WebGL renderer is colour maths nobody can verify.
 */

/** sRGB channel (0..1) to linear light, per IEC 61966-2-1. */
export function channelToLinear(c: number): number {
  const v = clamp01(c);
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Linear light back to an sRGB channel (0..1). */
export function channelFromLinear(c: number): number {
  const v = clamp01(c);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** WCAG relative luminance of an sRGB triple in 0..1. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/**
 * WCAG contrast ratio between two relative luminances. 1 = identical,
 * 21 = black on white. Silhouette legibility needs far less than text does —
 * a shape read at speed against a large flat field is a much easier task than
 * reading 12 px type — which is why the floors below are well under 4.5.
 */
export function contrastRatio(lumA: number, lumB: number): number {
  const hi = Math.max(lumA, lumB);
  const lo = Math.min(lumA, lumB);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The luminance a foreground must reach to clear `ratio` against `bgLum`,
 * pushing *away* from the background: darker when the background is light,
 * lighter when the background is dark. Returns null when the requirement is
 * unreachable inside 0..1 in that direction, so callers can fall back to the
 * other direction rather than silently clamping to pure black or white.
 */
export function luminanceForContrast(bgLum: number, ratio: number, darker: boolean): number | null {
  if (darker) {
    const target = (bgLum + 0.05) / ratio - 0.05;
    return target >= 0 ? target : null;
  }
  const target = ratio * (bgLum + 0.05) - 0.05;
  return target <= 1 ? target : null;
}

/**
 * Scale a colour's linear luminance to `targetLum` while preserving its hue
 * and as much of its saturation as the headroom allows. Hue preservation is
 * the whole point: the dusk palette's identity is its colour, so the floor
 * lifts a teal hill into a *lighter teal*, never into grey and never into a
 * different hill.
 */
export function withLuminance(rgb: Rgb, targetLum: number): Rgb {
  const cur = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const target = clamp01(targetLum);
  // A pure-black input has no hue to preserve; go straight to neutral grey.
  if (cur <= 1e-6) {
    const v = channelFromLinear(target);
    return { r: v, g: v, b: v };
  }
  const lin = {
    r: channelToLinear(rgb.r),
    g: channelToLinear(rgb.g),
    b: channelToLinear(rgb.b),
  };
  const scale = target / cur;
  // Scaling alone overflows for bright hues; the overflow is folded back as an
  // even white lift, which desaturates only as much as the headroom demands.
  let r = lin.r * scale;
  let g = lin.g * scale;
  let b = lin.b * scale;
  const peak = Math.max(r, g, b);
  if (peak > 1) {
    const room = 1 - Math.min(r, g, b) / peak;
    const k = room > 1e-6 ? 1 / peak : 1;
    r *= k;
    g *= k;
    b *= k;
    const after = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const lift = after < target ? (target - after) / (1 - after || 1) : 0;
    r += (1 - r) * lift;
    g += (1 - g) * lift;
    b += (1 - b) * lift;
  }
  return {
    r: channelFromLinear(r),
    g: channelFromLinear(g),
    b: channelFromLinear(b),
  };
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Push `fg` away from `bg` until it clears `minRatio`, and return it unchanged
 * when it already does. Direction is chosen by which side has headroom, so a
 * hill against a bright noon sky darkens and the same hill against a midnight
 * sky lightens — the silhouette survives both ends of the cycle without the
 * art having to be authored twice.
 */
export function enforceMinContrast(fg: Rgb, bg: Rgb, minRatio: number): Rgb {
  const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
  const fgLum = relativeLuminance(fg.r, fg.g, fg.b);
  if (contrastRatio(fgLum, bgLum) >= minRatio) return fg;
  // Keep going the way the art was already heading; only cross over when that
  // direction cannot reach the floor at all.
  const preferDarker = fgLum <= bgLum;
  const first = luminanceForContrast(bgLum, minRatio, preferDarker);
  if (first !== null) return withLuminance(fg, first);
  const second = luminanceForContrast(bgLum, minRatio, !preferDarker);
  if (second !== null) return withLuminance(fg, second);
  // Unreachable in both directions (only for mid-greys at absurd ratios):
  // take whichever extreme is further away rather than giving up entirely.
  return withLuminance(fg, bgLum > 0.5 ? 0 : 1);
}

/**
 * Silhouette floor for distant terrain bands against the sky behind them.
 * 1.9 was picked by eye against the captured dusk frames: it is the point at
 * which the hill line reappears without the dusk grade losing its mood. Noon
 * frames sit far above it and are therefore untouched.
 */
export const TERRAIN_SKY_MIN_CONTRAST = 1.9;

/**
 * Floor for the player's own bird against whatever it is flying over. The
 * player avatar is the one thing that must never be lost, so it gets a higher
 * bar than scenery does.
 */
export const AVATAR_MIN_CONTRAST = 2.6;

/**
 * Extra ambient fill to add at night so near terrain keeps volume instead of
 * crushing to a flat black mass. Zero in full daylight — this never touches
 * the daytime look — ramping to `maxFill` at true midnight.
 *
 * Deliberately a smoothstep rather than a linear ramp: a linear fill is
 * visible as a "the lights are coming up" pump during the dusk transition,
 * which is exactly the artefact the floor is supposed to avoid drawing
 * attention to.
 */
export function nightFillIntensity(daylight: number, maxFill = 0.34): number {
  const t = clamp01(daylight);
  const night = clamp01((0.55 - t) / 0.55);
  return maxFill * night * night * (3 - 2 * night);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0;
}
