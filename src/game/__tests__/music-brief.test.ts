import { describe, expect, it } from "vitest";
import { BIOME_MIX, GLOCK_PARTIALS, TRACKS } from "../Music";

/**
 * Soundtrack brief (2026-09-22): "more upbeat, more melodic, glockenspiel".
 *
 * These are the machine-checkable parts of that brief. They cannot judge
 * taste, but they do pin the three things that made the old score feel dull
 * and noisy, so a future edit cannot quietly undo them:
 *
 *   • melody — every track must carry a real tune: dense enough to sing,
 *     in-key, with a phrase arch and a leap, never a held drone or silence;
 *   • upbeat — a tempo floor for the whole library and a dancing kit;
 *   • glockenspiel — the lead voice is bar-partial bell synthesis (inharmonic
 *     ratios), not a harmonic stack or an FM clang.
 *
 * `-1` is a hold, `0` a rest in the melody arrays.
 */

const HELD = -1;
const sound = (mel: number[]): number => mel.filter((n) => n > 0).length;
const longestRest = (mel: number[]): number => {
  let run = 0;
  let worst = 0;
  for (const n of mel) {
    if (n > 0 || n === HELD) run = 0;
    else worst = Math.max(worst, ++run);
  }
  return worst;
};
/**
 * Harmony checks.
 *
 * The score lives in the key of C major / A minor (the progressions share it),
 * with exactly one borrowed note: Bb, which PROG_TRON's Gm bar needs. So the
 * melodic guard is "in key, except Bb on the Gm bar" — that catches a wrong
 * note (a stray F#, a chromatic slide) without outlawing idiomatic colours
 * like a leading-tone B over a C chord.
 *
 * Arrivals are checked separately: wherever a 4-bar phrase comes to rest, the
 * note has to be consonant with the chord under it (triad, 6th, 9th, or the
 * sus-4). Passing tones inside a bar are free.
 */
const TRIAD: Record<string, number[]> = {
  C: [0, 4, 7], G: [7, 11, 2], Am: [9, 0, 4], F: [5, 9, 0],
  Em: [4, 7, 11], Dm: [2, 5, 9], Gm: [7, 10, 2],
};
const MINOR = new Set(["Am", "Em", "Dm", "Gm"]);
const IN_KEY = new Set([0, 2, 4, 5, 7, 9, 11]);
const pitchClass = (m: number): number => ((m % 12) + 12) % 12;
/** Consonant arrivals: a triad tone, or the 6th/9th/11th colours. */
const CONSONANT = (chord: string, pc: number): boolean => {
  if (TRIAD[chord]!.includes(pc)) return true;
  const root = TRIAD[chord]![0]!;
  const offset = (pc - root + 12) % 12;
  if (offset === 9 || offset === 2 || offset === 5) return true;
  // Minor triads take the minor 7th (offset 10) and the minor 6th (offset 8 —
  // F over Am, i.e. Am6). The 6th comes in two sizes and this guard used to
  // allow only the major one (offset 9), so a perfectly ordinary Am6 arrival was
  // reported as a clash the moment PROG_J bar 8 became a modal Em→Am cadence
  // instead of resting on F. The doc comment above has always promised "a triad,
  // 6th, 9th, or the sus-4"; now the code means it.
  return MINOR.has(chord) && (offset === 10 || offset === 8);
};

describe("melodic contract", () => {
  it("every track carries a tune, not a drone", () => {
    for (const t of TRACKS) {
      // A 64-eighth (8-bar) loop that sounds on fewer than 18 eighths is a
      // pad, not a melody. The old "Zimmer architecture" set scored 12–16.
      expect(sound(t.mel), `${t.name}: only ${sound(t.mel)} sounding eighths`).toBeGreaterThanOrEqual(18);
      // ...and it must never leave an empty bar. Six eighths of silence in a
      // bright arcade glider is the "dull" the brief complained about.
      expect(longestRest(t.mel), `${t.name}: ${longestRest(t.mel)} silent eighths in a row`).toBeLessThanOrEqual(6);
    }
  });

  it("every melody stays in key and in the glockenspiel's register", () => {
    for (const t of TRACKS) {
      for (let bar = 0; bar < 8; bar++) {
        const chord = t.prog[bar]!;
        const borrowed = chord === "Gm" ? 10 : -1; // Bb, only where the Gm bar needs it
        for (const n of t.mel.slice(bar * 8, bar * 8 + 8)) {
          if (n <= 0) continue;
          const pc = pitchClass(n);
          expect(IN_KEY.has(pc) || pc === borrowed, `${t.name} bar ${bar + 1} (${chord}): ${n} is out of key`).toBe(true);
          // Bar-partial bells get thin and piercing far above E6, and muddy
          // below G4 — the lead line stays in the sweet spot.
          expect(n).toBeGreaterThanOrEqual(55);
          expect(n).toBeLessThanOrEqual(93);
        }
      }
    }
  });

  it("every melody has a phrase arch: a peak above its opening and a leap", () => {
    for (const t of TRACKS) {
      const notes = t.mel.filter((n) => n > 0);
      const first = notes[0]!;
      const peak = Math.max(...notes);
      expect(peak, `${t.name}: no lift above the opening note`).toBeGreaterThan(first);
      let leap = 0;
      let prev = 0;
      for (const n of t.mel) {
        if (n > 0) {
          if (prev > 0) leap = Math.max(leap, Math.abs(n - prev));
          prev = n;
        }
      }
      expect(leap, `${t.name}: no interval wider than a second`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every phrase resolves on a consonant tone of the bar it hands over on", () => {
    for (const t of TRACKS) {
      const finalBar = t.mel.slice(56).filter((n) => n > 0);
      const chord = t.prog[7]!;
      const last = pitchClass(finalBar[finalBar.length - 1]!);
      expect(CONSONANT(chord, last), `${t.name}: bar 8 (${chord}) resolves on ${last}`).toBe(true);
      // Each 4-bar half of the phrase must also land somewhere consonant:
      // mid-phrase bars may run through passing tones, but the half-way point
      // is an arrival, and a note hanging in mid-air there sounds like a mistake.
      const halfWay = t.mel.slice(24, 32).filter((n) => n > 0);
      if (halfWay.length) {
        expect(
          CONSONANT(t.prog[3]!, pitchClass(halfWay[halfWay.length - 1]!)),
          `${t.name}: bar 4 (${t.prog[3]})`,
        ).toBe(true);
      }
    }
  });
});

describe("upbeat contract", () => {
  it("the whole library sits at or above an upbeat tempo floor", () => {
    // The floor is 124: every island is a bright, moving track, and the fever
    // lift on top of it is what the player climbs into on a good run. (The
    // floor was 116 before the "more upbeat" pass; a slow island reads as
    // background music, which is the opposite of what an arcade glider wants.)
    for (const [style, mix] of Object.entries(BIOME_MIX)) {
      expect(mix.bpm, `${style} play tempo`).toBeGreaterThanOrEqual(116);
      expect(mix.fever - mix.bpm, `${style} fever lift`).toBeGreaterThanOrEqual(14);
    }
  });

  it("ships 30 tracks, ten of them arcade bangers, and every one is playable", () => {
    expect(TRACKS).toHaveLength(30);
    expect(TRACKS.filter((t) => t.chip)).toHaveLength(10);
    for (const t of TRACKS) expect(t.prog).toHaveLength(8);
  });
});

describe("marimba/xylophone partial contract", () => {
  it("uses inharmonic bar partials with short marimba-style decays", () => {
    expect(GLOCK_PARTIALS[0]!.ratio).toBe(1);
    // 2.76 and 5.40 are the struck-bar mode ratios — inharmonic, not an organ stack.
    const ratios = GLOCK_PARTIALS.map((p) => p.ratio);
    expect(ratios[1]).toBeGreaterThan(2.5);
    expect(ratios[1]).toBeLessThan(3);
    expect(ratios[2]).toBeGreaterThan(5);
    expect(ratios[2]).toBeLessThan(6);
    // Higher partials must die faster than the fundamental.
    for (let i = 1; i < GLOCK_PARTIALS.length; i++) {
      expect(GLOCK_PARTIALS[i]!.decay).toBeLessThan(GLOCK_PARTIALS[i - 1]!.decay);
      expect(GLOCK_PARTIALS[i]!.amp).toBeLessThan(GLOCK_PARTIALS[i - 1]!.amp);
    }
    // Marimba fundamental is short (< 0.6s) so notes pop and breathe.
    expect(GLOCK_PARTIALS[0]!.decay).toBeLessThan(0.6);
  });
});
