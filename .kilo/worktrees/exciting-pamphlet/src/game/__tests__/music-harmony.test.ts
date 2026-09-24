/**
 * Harmonic contract — the progressions have to be progressions.
 *
 * Until 2026-09-24 eleven of the score's twelve progressions were a four-bar
 * loop stated twice, `PROG_B` and `PROG_K` were byte-identical under two names,
 * and most sets ended on a chord that never resolved. Nothing in the suite
 * noticed, because every existing music test checks *texture* (which families
 * play, how loud, when they leave) or *melody* (does a tune exist, is it in
 * key, do phrase arrivals land on chord tones). Harmony — the part that makes
 * eight minutes of flight feel like it goes somewhere — was untested, so it had
 * quietly become a loop.
 *
 * These rules are the theory the rewrite is held to:
 *
 *   1. **A cadence exists.** Somewhere in the eight bars, or across the loop
 *      seam, a dominant/plagal/modal cadence actually happens.
 *   2. **The loop comes home.** The last bar is a tonic, or it cadences into
 *      bar 1 — and the tonic is reached more than once, so "home" is a place the
 *      music visits rather than a note it starts on.
 *   3. **The consequent departs.** For the score tracks, bars 5–8 are not a copy
 *      of bars 1–4. (The arcade chip family is exempt and says so below: a
 *      four-bar loop stated twice *is* the chiptune idiom, and those tracks are
 *      40 seconds of Flappy-Bird-shaped adrenaline, not a score.)
 *
 * It also pins the vocabulary, which is the part that bites: `UKE[chord]` and
 * `BASS_ROOT[chord]` are non-null assertions, so a progression naming a chord
 * that is not in those tables is a runtime crash on the first bar — and the same
 * set is repeated in `arcade-music.test.ts` (chord names) and
 * `music-brief.test.ts` (triad pitch classes). Four places, one vocabulary; the
 * cross-check below is what keeps them from drifting.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TRACKS } from "../Music";

/** Every chord the voicing tables can play (see the vocabulary test below). */
const VOCABULARY = ["C", "G", "Am", "F", "Em", "Dm", "Gm"] as const;

const TONICS = new Set(["C", "Am"]);

/**
 * The cadences this vocabulary can produce. There is no E major in the tables,
 * so the minor tracks have no true harmonic-minor V–i (G# leading tone) and
 * cadence modally instead: v–i and ♭VII–i. That is a deliberate colour, pinned
 * by the last test in this file so nobody adds E without also opening the
 * melodic contract in `music-brief.test.ts` to G#.
 */
const CADENCES: ReadonlyArray<readonly [string, string]> = [
  ["G", "C"], // authentic V→I
  ["F", "C"], // plagal IV→I
  ["Em", "Am"], // modal v→i
  ["G", "Am"], // ♭VII→i (natural minor)
  ["F", "Am"], // VI→i (subdominant colour in minor)
];

const isCadence = (from: string, to: string): boolean =>
  CADENCES.some(([a, b]) => a === from && b === to);

/** Distinct progressions, keyed by their chord sequence. */
function progressions(): { key: string; prog: string[]; tracks: string[]; chip: boolean }[] {
  const byKey = new Map<string, { prog: string[]; tracks: string[]; chip: boolean }>();
  for (const t of TRACKS) {
    const key = t.prog.join(" ");
    const hit = byKey.get(key);
    if (hit) hit.tracks.push(t.name);
    else byKey.set(key, { prog: [...t.prog], tracks: [t.name], chip: Boolean(t.chip) });
  }
  return [...byKey.entries()].map(([key, v]) => ({ key, ...v }));
}

describe("harmonic contract", () => {
  const all = progressions();

  it("gives the catalogue real variety, not one loop under twelve names", () => {
    // PROG_B and PROG_K used to be identical, so 30 tracks shared ~10 harmonic
    // ideas and two of those were the same idea twice.
    expect(all.length).toBeGreaterThanOrEqual(12);
  });

  it("cadences — in the bars or across the loop seam", () => {
    for (const { prog, tracks } of all) {
      const cyclic = [...prog, prog[0]!];
      const hits = cyclic.slice(0, -1).filter((c, i) => isCadence(c, cyclic[i + 1]!));

      expect(hits.length, `${tracks.join(", ")}: ${prog.join(" ")} has no cadence`).toBeGreaterThan(0);
    }
  });

  it("comes home: the loop ends on a tonic or resolves into bar 1", () => {
    for (const { prog, tracks } of all) {
      const last = prog[prog.length - 1]!;
      const resolves = TONICS.has(last) || isCadence(last, prog[0]!);

      expect(resolves, `${tracks.join(", ")}: ends on ${last}, bar 1 is ${prog[0]}`).toBe(true);
      const tonics = prog.filter((c) => TONICS.has(c)).length;
      expect(tonics, `${tracks.join(", ")}: tonic reached ${tonics}×`).toBeGreaterThanOrEqual(2);
    }
  });

  it("lands the cadence at the end of the period, not only in the middle", () => {
    for (const { prog, tracks } of all) {
      const penultimate = prog[prog.length - 2]!;
      const last = prog[prog.length - 1]!;
      const lands =
        isCadence(penultimate, last) || TONICS.has(last) || isCadence(last, prog[0]!);

      expect(lands, `${tracks.join(", ")}: bars 7–8 are ${penultimate}→${last}`).toBe(true);
    }
  });

  it("the score's consequent departs from its antecedent (chip loops exempt)", () => {
    for (const { prog, tracks, chip } of all) {
      if (chip) continue; // a stated-twice loop is the chiptune idiom, on purpose
      const antecedent = prog.slice(0, 4).join(" ");
      const consequent = prog.slice(4).join(" ");

      expect(consequent, `${tracks.join(", ")}: bars 5–8 copy bars 1–4`).not.toBe(antecedent);
    }
  });

  it("keeps the chord vocabulary closed, and the four places that list it in agreement", () => {
    // A chord outside the tables is a first-bar crash: `UKE[chordName]!` and
    // `BASS_ROOT[chordName]!` are non-null assertions in Music.ts.
    for (const t of TRACKS) {
      for (const chord of t.prog) {
        expect(VOCABULARY, `${t.name}: ${chord}`).toContain(chord as (typeof VOCABULARY)[number]);
      }
    }

    const music = readFileSync(join(process.cwd(), "src", "game", "Music.ts"), "utf8");
    for (const chord of VOCABULARY) {
      expect(music, `UKE voicing for ${chord}`).toMatch(new RegExp(`^\\s*${chord}:\\s*\\[`, "m"));
      expect(music, `bass root for ${chord}`).toContain(`${chord}:`);
    }

    // The same list is repeated in two other test files. If one grows a chord
    // and the others do not, the melodic contract silently stops checking it.
    const arcade = readFileSync(
      join(process.cwd(), "src", "game", "__tests__", "arcade-music.test.ts"),
      "utf8",
    );
    const brief = readFileSync(
      join(process.cwd(), "src", "game", "__tests__", "music-brief.test.ts"),
      "utf8",
    );
    const arcadeSet = /knownChords = new Set\(\[([^\]]+)\]/.exec(arcade)?.[1] ?? "";
    const briefSet = /const TRIAD: Record<string, number\[\]> = \{([\s\S]*?)\};/.exec(brief)?.[1] ?? "";
    const names = (s: string): string[] => [...s.matchAll(/([A-G][a-z#b]*)\s*:/g)].map((m) => m[1]);

    expect(new Set(names(arcadeSet.replace(/"/g, "").replace(/,/g, " ").replace(/(\w+)/g, "$1:")))).toEqual(
      new Set(VOCABULARY),
    );
    expect(new Set(names(briefSet))).toEqual(new Set(VOCABULARY));
  });

  it("stays diatonic: no E major until the melodic contract allows G#", () => {
    // The honest limit. A true minor V–i needs E (G#), which the melodies — all
    // written in C major / A minor with one borrowed Bb — would clash against.
    // Adding the chord without opening that contract would put a semitone under
    // the glockenspiel lead; adding it *with* the contract is a key change and a
    // listening pass, not a data edit.
    for (const t of TRACKS) expect(t.prog, t.name).not.toContain("E");

    const music = readFileSync(join(process.cwd(), "src", "game", "Music.ts"), "utf8");
    expect(music).toMatch(/harmonic-minor V–i/);
  });
});
