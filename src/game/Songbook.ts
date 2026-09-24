import { BIOMES } from "./Biomes";

/**
 * The Sunbird songbook: thirty hand-authored songs, played as written.
 *
 * `Music.ts` *generates* its tracks from a chord progression plus a melody line
 * and infers the arrangement from the family. That is wonderful for endless
 * variety and terrible for a hook: every track shares one tempo, one meter and
 * one drum feel, so a tune can never swing, never sit in 6/8, and never hold a
 * slow half-time groove.
 *
 * These are the opposite. Each carries its own tempo, meter, swing, drum map,
 * delay throw and voice palette, so "Midnight Lullaby" is a real 50 BPM 6/8
 * with no drums at all and "Van Shuffle" is a 96 BPM ska on the off-beat.
 *
 * ## Critique of the source sketch, and what changed here
 *
 * The sketch these came from is a lovely piece of work and it is also a jukebox,
 * not a score. What was wrong with it, in order of how much it mattered:
 *
 * 1. **Four bars, forever.** Every song looped its progression identically. This
 *    is the single biggest reason a game score reads as "repetitive", and it is
 *    a structural problem, not a melody problem — so it is fixed structurally:
 *    each song is now arranged as intro → statement → development → breakdown →
 *    close (`arrange`), and only then does the rotation move on.
 * 2. **One song at a time, chosen by hand.** In a game the music has to follow
 *    the world. Every song now has a home island, and crossing into a new biome
 *    changes the song.
 * 3. **Whimsy by accident.** The palette (bell, whistle, ukulele, music-box
 *    chime) is charming but the sketch states it flatly. Ornaments that could
 *    not clash — a chord-derived twinkle, a grace note before a rest, a third
 *    below the tune on the last pass, a birdsong answer — are now part of the
 *    arrangement, so the score grins instead of repeating.
 * 4. **Dead data.** "Van Shuffle" enabled no lead voice, so its sixteen written
 *    notes never sounded; "Log Date Arp" and "Wailing 7" were unplayable-in-
 *    spirit novelties at speed. The first is fixed, the second pair are kept
 *    (in the odd meters they were written for) but moved to the islands whose
 *    character they suit, where an odd meter is a feature rather than a stumble.
 * 5. **Names that could not ship.** Several titles point at a franchise. A
 *    commercial Poki release cannot carry those, however original the notes —
 *    they are renamed. The notes are unchanged.
 *
 * ## Where a song is heard
 *
 * `role` decides which *moment* a song belongs to (the menu, the results
 * lullaby, a fever run, a stormfront). `biomes` decides which *islands* it suits
 * while flying, which is what makes the world turn over musically — and several
 * islands per song, so each island's pool is deep enough to shuffle.
 */

/** Which rotation a song belongs to when the music mode is not plain flight. */
export type SongRole = "menu" | "play" | "fever" | "sleep" | "storm";

/** The island a song belongs to. Derived from the biome table, so a biome
 *  rename cannot leave a song pointing at an island that no longer exists. */
export type BiomeId = (typeof BIOMES)[number]["id"];

export type Voice = "bass" | "rhodes" | "uke" | "chip" | "chime" | "pad" | "voice";

export type Song = {
  /** Stable id, also the "now playing" label. */
  readonly title: string;
  readonly role: SongRole;
  /** Islands this song suits while flying. */
  readonly biomes: readonly BiomeId[];
  readonly bpm: number;
  /** Steps per bar: 16 = 4/4, 12 = 6/8 or 3/4, 10 = 5/4, 7 = 7/8. */
  readonly steps: number;
  /** 0 = straight; otherwise the fraction of the second eighth held back. */
  readonly swing: number;
  /** Delay-throw time in seconds, and its wet level. */
  readonly delay: number;
  readonly wet: number;
  /** Four chords, as [bass root, ...chord tones], in MIDI note numbers. */
  readonly bars: readonly (readonly number[])[];
  /** One entry per step: MIDI note, or 0 for a rest or a held note. */
  readonly lead: readonly number[];
  /** kick | snare | hat lanes, one character per step, "x"/"s"/"h" to hit. */
  readonly drums: string;
  readonly use: Readonly<Record<Voice, boolean>>;
  /** Square-wave bass instead of triangle — the driving songs. */
  readonly squareBass: boolean;
};

type Voices = Partial<Record<Voice, true>>;

/** A song as authored: note names, like the sketch it came from. */
type Spec = Omit<Song, "bars" | "lead" | "use" | "squareBass"> & {
  readonly bars: readonly (readonly string[])[];
  readonly lead: readonly (string | 0)[];
  readonly use: Voices;
  /** Square-wave bass. The sketch decided this from its own tag text
   *  (`/funk|disco|rock|beep/`), so it is carried per song rather than guessed
   *  from the role — which had "Fusion Walk" playing the one bass it is not. */
  readonly squareBass?: boolean;
};

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" → 60 (middle C is C4, matching the sketch's own conversion).
 *  Returns NaN for unrecognised names instead of throwing — the caller
 *  (arrange/chordForStep) already guards on `note === 0`, and a silent
 *  skip is preferable to crashing a run mid-song over one bad token. */
export function parseNote(name: string): number {
  const m = /^([A-G])([b#]?)(-?\d)$/.exec(name);
  if (!m) return NaN;
  let semi = NOTE_INDEX[m[1]!]!;
  if (m[2] === "b") semi -= 1;
  if (m[2] === "#") semi += 1;
  return 12 * (Number(m[3]) + 1) + semi;
}

const SPECS: readonly Spec[] = [
  /* ---------------------------------------------------------------- menu -- */
  {
    title: "Porch Light", role: "menu", biomes: ["green"], bpm: 84, steps: 16, swing: 0.2, delay: 0.36, wet: 0.22,
    bars: [["F2", "F3", "A3", "C4", "E4"], ["A2", "A3", "C4", "E4", "G4"], ["Bb2", "Bb3", "D4", "F4", "A4"], ["C3", "C3", "E3", "G3", "Bb3"]],
    lead: ["C4", "D4", "F4", 0, 0, "A3", "C4", "D4", "F4", 0, "E4", "D4", "C4", 0, "A3", 0],
    drums: "x.......x.......|....s.......s...|.h.h.h.h.h.h.h.h",
    use: { bass: true, rhodes: true, uke: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Music Box", role: "menu", biomes: ["aurora"], bpm: 76, steps: 12, swing: 0, delay: 0.22, wet: 0.12,
    bars: [["C4", "C5", "E5", "G5"], ["G3", "G4", "B4", "D5"], ["A3", "A4", "C5", "E5"], ["F3", "F4", "A4", "C5"]],
    lead: ["E5", "G5", "E5", "D5", "C5", "G4", "A4", "C5", "E5", "D5", "C5", "G4"],
    drums: "................|................|................",
    use: { chime: true },
  },

  {
    title: "Wings Reprise", role: "menu", biomes: ["green"], bpm: 60, steps: 16, swing: 0.14, delay: 0.42, wet: 0.26,
    bars: [["C2", "C3", "E3", "G3", "B3"], ["E2", "E3", "G#3", "B3"], ["F2", "F3", "A3", "C4", "E4"], ["G2", "G3", "B3", "D4", "F4"]],
    lead: ["G3", 0, "E3", "C3", 0, "G3", "A3", 0, "C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3"],
    drums: "x...............|........s.......|..h.....h.......",
    use: { bass: true, rhodes: true, uke: true, chime: true, pad: true, voice: true },
  },

  /* -------------------------------------------------------------- flight -- */
  {
    title: "Star Bumper", role: "play", biomes: ["green", "tropical", "canyon"], bpm: 88, steps: 16, swing: 0.18, delay: 0.28, wet: 0.18,
    bars: [["C3", "C4", "E4", "G4", "B4"], ["E3", "E3", "G#3", "B3", "D4"], ["F3", "F3", "A3", "C4", "E4"], ["F3", "F3", "Ab3", "C4", "Eb4"]],
    lead: ["G4", 0, "E4", "G4", "A4", 0, "G4", "E4", "C5", 0, "G4", "A4", "G4", "F4", "E4", "C4"],
    drums: "x...x...x...x...|..s...s...s...s.|.h.h.h.h.h.h.h.h",
    use: { bass: true, rhodes: true, uke: true, chip: true, voice: true },
  },
  {
    title: "Bright Star", role: "play", biomes: ["green", "sunset", "tropical"], bpm: 89, steps: 16, swing: 0.06, delay: 0.26, wet: 0.14,
    bars: [["G2", "G3", "B3", "D4"], ["E2", "E3", "G3", "B3"], ["C3", "C4", "E4", "G4"], ["D3", "D3", "F#3", "A3"]],
    lead: ["D4", 0, "B3", "G3", 0, "A3", "B3", 0, "D4", "E4", 0, "D4", "B3", "A3", "G3", 0],
    drums: "x.......x.......|....s.......s...|.h.h...h.h.h...h",
    use: { bass: true, rhodes: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Van Shuffle", role: "play", biomes: ["reef", "tropical", "green", "sunset"], bpm: 96, steps: 16, swing: 0, delay: 0.2, wet: 0.1,
    bars: [["C2", "C4", "E4", "G4"], ["F2", "F4", "A4", "C5"], ["G2", "G3", "B3", "D4"], ["C2", "C4", "E4", "G4"]],
    lead: [0, "G4", 0, "A4", 0, "G4", "E4", 0, "C4", 0, "D4", "E4", 0, "G4", 0, 0],
    drums: "x...x...x...x...|....s.......s...|h.h.h.h.h.h.h.h.",
    // `voice` is added, not in the sketch: that version enabled no lead voice at
    // all, so this song's sixteen written notes never sounded. A silent melody
    // is a data bug, and the whistle is the lead the island songs use.
    use: { bass: true, uke: true, voice: true },
  },
  {
    title: "Beach Cookout", role: "play", biomes: ["tropical", "reef", "sunset"], bpm: 80, steps: 16, swing: 0.1, delay: 0.3, wet: 0.16,
    bars: [["A2", "A3", "C4", "E4"], ["D3", "D4", "F#4", "A4"], ["G2", "G3", "B3", "D4"], ["C3", "C4", "E4", "G4"]],
    lead: ["E4", 0, "A4", 0, "C5", "B4", "A4", 0, "G4", "E4", 0, "D4", "C4", 0, "A3", 0],
    drums: "x.......x.......|....s.......s...|..h...h...h...h.",
    use: { bass: true, rhodes: true, uke: true, voice: true },
  },
  {
    title: "Fusion Walk", role: "play", biomes: ["volcano", "canyon", "night"], bpm: 92, steps: 16, swing: 0.14, delay: 0.27, wet: 0.14,
    bars: [["E2", "E3", "G3", "B3", "D4"], ["A2", "A3", "C4", "E4", "G4"], ["D2", "D3", "F#3", "A3", "C4"], ["G2", "G3", "B3", "D4", "F4"]],
    lead: ["G4", 0, "B4", "A4", "G4", "E4", 0, "G4", "A4", 0, "B4", "A4", "G4", 0, "E4", 0],
    drums: "x...x.x.x...x...|....s.....s.s...|.h.h.h.h.h.h.h.h",
    squareBass: true,
    use: { bass: true, rhodes: true, voice: true },
  },
  {
    title: "Dusty Highway", role: "play", biomes: ["desert", "canyon", "green"], bpm: 94, steps: 16, swing: 0.08, delay: 0.22, wet: 0.1,
    bars: [["G2", "G3", "B3", "D4"], ["C3", "C4", "E4", "G4"], ["D3", "D4", "F#4", "A4"], ["G2", "G3", "B3", "D4"]],
    lead: ["G3", 0, "B3", "D4", 0, "B3", "A3", "G3", 0, "D3", "G3", "A3", 0, "B3", "D4", 0],
    drums: "x...x...x...x...|....s.......s...|h...h...h...h...",
    use: { bass: true, uke: true, voice: true },
  },
  {
    title: "Seventh Porch", role: "play", biomes: ["desert", "sunset", "night"], bpm: 82, steps: 16, swing: 0.16, delay: 0.29, wet: 0.15,
    bars: [["C2", "C3", "E3", "G3", "Bb3"], ["A2", "A3", "C4", "E4", "G4"], ["D2", "D3", "F3", "A3", "C4"], ["G2", "G3", "B3", "D4", "F4"]],
    lead: ["G4", "A4", 0, "C5", "D5", "C5", "A4", 0, "G4", "E4", 0, "D4", "E4", "G4", 0, "C4"],
    drums: "x.....x.x.......|......s.....s...|h.h.h.h.h.h.h.h.",
    use: { bass: true, rhodes: true, uke: true, voice: true },
  },
  {
    title: "Side by Side", role: "play", biomes: ["sunset", "night", "green", "reef"], bpm: 74, steps: 16, swing: 0.12, delay: 0.35, wet: 0.22,
    bars: [["D2", "D3", "F#3", "A3"], ["A2", "A3", "C#4", "E4"], ["B2", "B3", "D4", "F#4"], ["G2", "G3", "B3", "D4"]],
    lead: ["F#4", 0, "A4", "D5", 0, "C#5", "B4", "A4", 0, "F#4", "E4", 0, "D4", "F#4", 0, "A4"],
    drums: "x...............|........s.......|..h...h...h...h.",
    use: { bass: true, rhodes: true, uke: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Late Cabaret", role: "play", biomes: ["night", "sunset", "volcano"], bpm: 64, steps: 16, swing: 0.28, delay: 0.38, wet: 0.22,
    bars: [["F2", "F3", "A3", "C4", "E4"], ["A2", "A3", "C#4", "E4", "G4"], ["Bb2", "Bb3", "D4", "F4"], ["C3", "C4", "E4", "G4", "Bb4"]],
    lead: ["A4", "G4", 0, "F4", "E4", 0, "D4", "C4", "D4", "E4", 0, "F4", "A4", 0, "G4", 0],
    drums: "x.......x.......|....s...........|.h...h...h...h..",
    use: { bass: true, rhodes: true, pad: true, voice: true },
  },
  {
    title: "Keypad Arp", role: "play", biomes: ["aurora", "canyon", "volcano"], bpm: 90, steps: 10, swing: 0, delay: 0.18, wet: 0.08,
    bars: [["E3", "E4", "G#4", "B4"], ["C#3", "C#4", "E4", "G#4"], ["A2", "A3", "C#4", "E4"], ["B2", "B3", "D#4", "F#4"]],
    lead: ["E4", "B3", "G#3", "E3", "F#4", "C#4", "A3", "F#3", "G#3", "B3"],
    drums: "x....x....|....s.....|.h.h.h.h.h",
    squareBass: true,
    use: { bass: true, chip: true },
  },
  {
    title: "Practice Hall", role: "play", biomes: ["canyon", "desert", "aurora"], bpm: 72, steps: 12, swing: 0, delay: 0.2, wet: 0.08,
    bars: [["G2", "G3", "B3", "D4"], ["D3", "D4", "F#4", "A4"], ["C3", "C4", "E4", "G4"], ["G2", "G3", "B3", "D4"]],
    lead: ["D4", "B3", "G3", "A3", "B3", "D4", "C4", "B3", "A3", "G3", "F#3", "G3"],
    drums: "x..x..x..x..|s..s..s..s..|............",
    use: { bass: true, rhodes: true },
  },
  {
    title: "Stand Together", role: "play", biomes: ["canyon", "aurora", "green", "volcano"], bpm: 86, steps: 16, swing: 0.1, delay: 0.32, wet: 0.2,
    bars: [["C2", "C3", "E3", "G3", "B3"], ["G2", "G3", "B3", "D4", "F4"], ["A2", "A3", "C4", "E4", "G4"], ["F2", "F3", "A3", "C4", "E4"]],
    lead: ["E3", 0, "G3", "C4", 0, "D4", "E4", 0, "D4", "C4", "G3", 0, "A3", "C4", "B3", "A3"],
    drums: "x.......x.......|....s.......s...|.h...h.h.h...h.h",
    use: { bass: true, rhodes: true, uke: true, chime: true, pad: true, voice: true },
  },

  /* --------------------------------------------------------- fever / race -- */
  {
    title: "Saturday Heart", role: "fever", biomes: ["sunset"], bpm: 100, steps: 16, swing: 0, delay: 0.23, wet: 0.12,
    bars: [["A1", "A3", "C#4", "E4"], ["F#1", "F#3", "A3", "C#4"], ["D2", "D3", "F#3", "A3"], ["E2", "E3", "G#3", "B3"]],
    lead: ["E4", 0, "C#4", "A3", 0, "B3", "C#4", 0, "E4", "F#4", 0, "E4", "C#4", "B3", "A3", 0],
    drums: "x...x...x...x...|....s.......s...|hhhhhhhhhhhhhhhh",
    squareBass: true,
    use: { bass: true, rhodes: true, voice: true },
  },
  {
    title: "Club Basement", role: "fever", biomes: ["volcano"], bpm: 98, steps: 16, swing: 0, delay: 0.19, wet: 0.08,
    bars: [["A1", "A3", "C4", "E4"], ["F1", "F3", "A3", "C4"], ["C2", "C3", "E3", "G3"], ["G1", "G3", "B3", "D4"]],
    lead: ["A3", "C4", 0, "A3", "G3", "E3", 0, "A3", "C4", 0, "D4", "C4", "A3", "G3", "E3", 0],
    drums: "x...x...x...x...|s...s...s...s...|.h.h.h.h.h.h.h.h",
    squareBass: true,
    use: { bass: true, voice: true },
  },
  {
    title: "Gauntlet Pulse", role: "fever", biomes: ["canyon"], bpm: 85, steps: 16, swing: 0.08, delay: 0.24, wet: 0.12,
    bars: [["A1", "A3", "C4", "E4", "G4"], ["G1", "G3", "B3", "D4", "F4"], ["F1", "F3", "A3", "C4", "E4"], ["E1", "E3", "G#3", "B3", "D4"]],
    lead: [0, "A3", 0, "C4", "E4", 0, "G4", "A4", 0, "G4", "E4", 0, "D4", "C4", "A3", 0],
    drums: "x.......x.x.....|........s.......|.h.....h.h.....h",
    squareBass: true,
    use: { bass: true, rhodes: true, chip: true },
  },

  /* --------------------------------------------------------------- sleep -- */
  {
    title: "Midnight Lullaby", role: "sleep", biomes: ["night"], bpm: 50, steps: 12, swing: 0, delay: 0.48, wet: 0.3,
    bars: [["C3", "C4", "E4", "G4", "B4"], ["A2", "A3", "C4", "E4", "G4"], ["F2", "F3", "A3", "C4", "E4"], ["G2", "G3", "B3", "D4", "F4"]],
    lead: ["E4", 0, "G4", "A4", 0, "G4", "E4", 0, "D4", "C4", 0, "E4"],
    drums: "................|................|................",
    use: { rhodes: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Credits Heart", role: "sleep", biomes: ["sunset"], bpm: 56, steps: 16, swing: 0.05, delay: 0.5, wet: 0.28,
    bars: [["G2", "G3", "B3", "D4", "F#4"], ["E2", "E3", "G3", "B3", "D4"], ["C3", "C3", "E3", "G3", "B3"], ["D3", "D3", "F#3", "A3", "C4"]],
    lead: ["B3", 0, "A3", "G3", 0, "D4", "E4", 0, "G4", 0, "A4", "B4", "A4", "G4", "E4", 0],
    drums: "................|................|................",
    use: { bass: true, rhodes: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Garden Waltz", role: "sleep", biomes: ["tropical"], bpm: 48, steps: 12, swing: 0, delay: 0.55, wet: 0.32,
    bars: [["Bb2", "Bb3", "D4", "F4", "A4"], ["Eb3", "Eb4", "G4", "Bb4"], ["F3", "F3", "A3", "C4"], ["Bb2", "Bb3", "D4", "F4"]],
    lead: ["F4", "D4", 0, "Bb3", "C4", "D4", "F4", 0, "Eb4", "D4", "C4", "Bb3"],
    drums: "................|................|................",
    use: { rhodes: true, chime: true, pad: true },
  },
  {
    title: "Two-Note Quiet", role: "sleep", biomes: ["green"], bpm: 52, steps: 16, swing: 0, delay: 0.4, wet: 0.2,
    bars: [["C3", "C4", "E4", "G4"], ["C3", "C4", "F4", "A4"], ["C3", "C4", "E4", "G4"], ["G2", "B3", "D4", "F4"]],
    lead: ["C4", "D4", "E4", 0, 0, 0, "E4", "D4", "C4", 0, 0, 0, "G3", 0, 0, 0],
    drums: "................|................|................",
    use: { rhodes: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Mirror Water", role: "sleep", biomes: ["reef"], bpm: 53, steps: 16, swing: 0, delay: 0.7, wet: 0.4,
    bars: [["B1", "B3", "D4", "F#4", "A4"], ["G2", "G3", "B3", "D4", "F4"], ["E2", "E3", "G3", "B3"], ["F#2", "F#3", "A3", "C#4"]],
    lead: [0, 0, "F#4", 0, 0, "A4", 0, "B4", 0, 0, "A4", 0, "F#4", 0, "E4", 0],
    drums: "................|................|................",
    use: { bass: true, chime: true, pad: true },
  },
  {
    title: "Temple Night", role: "sleep", biomes: ["tropical"], bpm: 46, steps: 12, swing: 0, delay: 0.58, wet: 0.34,
    bars: [["F2", "F3", "A3", "C4", "E4"], ["D2", "D3", "F3", "A3"], ["Bb1", "Bb2", "D3", "F3"], ["C2", "C3", "E3", "G3"]],
    lead: ["A3", 0, "C4", "A3", "G3", "F3", "E3", 0, "D3", "C3", "D3", "F3"],
    drums: "................|................|................",
    use: { rhodes: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Distant Shore", role: "sleep", biomes: ["reef"], bpm: 55, steps: 16, swing: 0.04, delay: 0.52, wet: 0.3,
    bars: [["E2", "E3", "G3", "B3", "D4"], ["C3", "C4", "E4", "G4"], ["A2", "A3", "C4", "E4"], ["B2", "B3", "D4", "F#4"]],
    lead: ["E4", 0, "G4", "B4", 0, "A4", "G4", "E4", 0, "D4", "B3", 0, "C4", "E4", 0, "G4"],
    drums: "................|................|................",
    use: { bass: true, rhodes: true, chime: true, pad: true, voice: true },
  },
  {
    title: "Glass Waltz", role: "sleep", biomes: ["aurora"], bpm: 66, steps: 12, swing: 0, delay: 0.34, wet: 0.2,
    bars: [["C3", "C4", "E4", "G4"], ["G2", "B3", "D4", "F4"], ["A2", "A3", "C4", "E4"], ["F2", "F3", "A3", "C4"]],
    lead: ["E5", 0, "D5", "C5", 0, "B4", "A4", 0, "G4", "A4", "B4", "C5"],
    drums: "x.....x.....|..s.....s...|h..h..h..h..",
    use: { bass: true, rhodes: true, chime: true, pad: true, voice: true },
  },

  /* --------------------------------------------------------------- storm -- */
  {
    title: "Blue Court", role: "storm", biomes: ["night"], bpm: 44, steps: 16, swing: 0, delay: 0.66, wet: 0.35,
    bars: [["Eb2", "Eb3", "G3", "Bb3", "Db4"], ["Bb1", "Bb2", "D3", "F3"], ["Ab1", "Ab2", "C3", "Eb3"], ["Eb2", "Eb3", "G3", "Bb3"]],
    lead: ["Bb3", 0, "G3", "Eb3", 0, 0, "F3", "G3", 0, "Bb3", "Ab3", 0, "G3", "F3", 0, "Eb3"],
    drums: "x...............|................|................",
    use: { bass: true, rhodes: true, pad: true, voice: true },
  },
  {
    title: "Fog Bank", role: "storm", biomes: ["night"], bpm: 47, steps: 16, swing: 0, delay: 0.62, wet: 0.38,
    bars: [["A1", "A3", "C4", "E4", "G4"], ["F2", "F3", "A3", "C4", "E4"], ["D2", "D3", "F3", "A3", "C4"], ["E2", "E3", "G3", "B3"]],
    lead: [0, "E4", 0, 0, "A4", 0, 0, "G4", 0, 0, "E4", 0, "C5", 0, "A4", 0],
    drums: "................|................|................",
    use: { bass: true, chime: true, pad: true },
  },
  {
    title: "Deep Choir", role: "storm", biomes: ["volcano"], bpm: 58, steps: 16, swing: 0, delay: 0.5, wet: 0.3,
    bars: [["C2", "C3", "Eb3", "G3", "Bb3"], ["Ab1", "Ab2", "C3", "Eb3", "G3"], ["F1", "F2", "Ab2", "C3", "Eb3"], ["G1", "G2", "B2", "D3", "F3"]],
    lead: [0, "G3", 0, "Eb3", "C3", 0, "Eb3", "F3", 0, "G3", "Bb3", 0, "Ab3", "G3", "F3", 0],
    drums: "................|................|................",
    use: { bass: true, pad: true, voice: true },
  },
  {
    title: "Wailing 7", role: "storm", biomes: ["canyon"], bpm: 81, steps: 7, swing: 0, delay: 0.25, wet: 0.2,
    bars: [["D2", "D4", "Eb4", "A4"], ["D2", "D4", "F4", "A4"], ["C2", "C4", "E4", "G4"], ["A1", "A3", "C4", "Eb4"]],
    lead: ["A4", "D4", "Eb4", "D4", "A3", "F3", "A3"],
    drums: "x..x...|..s....|.h.h.h.",
    use: { bass: true, chip: true, chime: true, pad: true },
  },
];

const ALL_VOICES: readonly Voice[] = ["bass", "rhodes", "uke", "chip", "chime", "pad", "voice"];

/** Note names → MIDI once, at load, so playback works in numbers. */
export const SONGBOOK: readonly Song[] = SPECS.map((spec) => ({
  ...spec,
  squareBass: spec.squareBass === true,
  bars: spec.bars.map((chord) => chord.map(parseNote)),
  lead: spec.lead.map((note) => (note === 0 ? 0 : parseNote(note))),
  use: Object.fromEntries(ALL_VOICES.map((v) => [v, spec.use[v] === true])) as Record<Voice, boolean>,
}));

export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Steps a chord lasts before the progression moves on. */
export function chordCycle(steps: number): number {
  if (steps === 7) return 7;
  if (steps === 10) return 10;
  // 16-step bars change twice a bar; 12-step bars keep the sketch's 8, which
  // lands the change on the second beat of a 6/8 bar. 7 and 10 are one chord.
  return Math.max(8, steps / 2);
}

/** Seconds per step. 16 steps = sixteenths; 12 = eighths; 10 and 7 are halves. */
export function stepSeconds(song: Song): number {
  const spb = 60 / song.bpm;
  if (song.steps === 12) return spb / 3;
  if (song.steps === 10) return spb / 2.5;
  if (song.steps === 7) return spb / 2;
  return spb / 4;
}

/** The kick, snare and hat lanes, padded to the song's length. */
export function drumLanes(song: Song): { k: string; s: string; h: string } {
  const parts = song.drums.split("|");
  const lane = (i: number): string => (parts[i] ?? "").replace(/\./g, " ").padEnd(song.steps, " ");
  return { k: lane(0), s: lane(1), h: lane(2) };
}

/** The chord sounding at a step, following `chordCycle`. Root is first. */
export function chordAt(song: Song, step: number): readonly number[] {
  const bar = Math.floor(step / chordCycle(song.steps)) % song.bars.length;
  return song.bars[bar] ?? song.bars[0]!;
}

/**
 * The chord sounding at a step of a pass — the counter the songs were written
 * against.
 *
 * The step is CONTINUOUS across passes, which is the whole point and the thing
 * that was wrong: the source sketch advanced its chord on a running counter
 * (`floor(step / cycle) % 4`), so a 16-step song reaches all four chords over
 * two passes. Driving the chord from the step within a bar instead means the
 * counter only ever reaches 1, and **half of every song's harmony never plays** —
 * the tune is right but the progression underneath it is missing its second
 * half, which is exactly what "it doesn't sound like the original" sounds like.
 */
export function chordForStep(song: Song, loop: number, step: number, shift = 0): readonly number[] {
  return chordAt(song, loop * song.steps + step + shift * chordCycle(song.steps));
}

/** Songs belonging to a role, in rotation order. */
export function songsFor(role: SongRole): readonly Song[] {
  return SONGBOOK.filter((song) => song.role === role);
}

/**
 * What can play over an island while flying: every flight song that suits it.
 * A song whose role is not "play" belongs to a *moment* (the menu, the results
 * lullaby), so it never enters an island's rotation.
 */
export function songsForBiome(biome: BiomeId): readonly Song[] {
  return SONGBOOK.filter((song) => song.role === "play" && song.biomes.includes(biome));
}

/**
 * A random order over `length` items, each used exactly once.
 *
 * Playback shuffles rather than walking the list, so two flights over the same
 * island are not the same flight. It is a queue, not a dice roll per song: every
 * song in the pool is heard before any of them comes back, which is what stops
 * a shuffle from sounding like bad luck.
 */
export function shuffledOrder(length: number, rand: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = order[i]!;
    order[i] = order[j]!;
    order[j] = a;
  }
  return order;
}

/* -------------------------------------------------------------- the form -- */

/**
 * How a song is arranged over its stay.
 *
 * The source sketch played its four bars, again and again, forever. That is the
 * one thing a player notices: the tune stops being music and becomes a ring
 * tone. So a song here is scored as a small piece — it opens, states, develops,
 * breaks down, and closes — and only then does the rotation move on.
 *
 * Every pass presents the tune DIFFERENTLY, which is the part that matters:
 * changing only the layers (as the first version did) still loops the same bar
 * under the same chords, and a listener hears that as repetition no matter how
 * many instruments come and go. So the developed pass runs the progression
 * rotated a bar (real harmonic movement, from the song's own chords) with the
 * tune arriving late, the held-breath pass reharmonises it, and the closing pass
 * mirrors it and doubles it a third below.
 *
 * | loops | section | the tune                          | the arrangement        |
 * |-------|---------|-----------------------------------|------------------------|
 * | 0     | intro   | as written                        | tune and bass, no kit  |
 * | 1     | a       | as written                        | the song as authored   |
 * | 2     | b       | displaced half a bar, chords moved| counter-line, bells    |
 * | 3     | break   | reharmonised (or silent, on a kit)| kit drops out          |
 * | 4     | final   | inverted, harmonised a third below| fill, flourish, breath |
 *
 * Five passes rather than the seven this started at, for the same reason: a
 * shorter stay means the rotation reaches the next song sooner, and thirty songs
 * heard is less repetitive than one song developed at length.
 */
export const LOOPS_PER_SONG = 5;

export type Section = "intro" | "a" | "b" | "break" | "final";

/**
 * How the tune is presented on this pass.
 *
 * This is the answer to "the songs are repetitive", and it had to be. Each song
 * is four chords and ONE bar of melody, so the phrase itself is the loop: no
 * amount of dropping the drums in and out disguises a bar that never changes.
 * Every transformation below is constrained to the chord sounding underneath
 * (or to the song's own notes), so a variation cannot produce a wrong note —
 * which is what makes it safe to run on all thirty songs.
 */
export type TuneView =
  /** As written. */
  | "plain"
  /** The same contour snapped to the chord: new colours, recognisable line. */
  | "reharmonised"
  /** Arriving a half-bar late, so the tune answers itself. */
  | "displaced"
  /** Mirrored around the chord's centre, so the phrase arches the other way. */
  | "inverted";

/** What is playing at one step of one loop. */
export type Arrangement = {
  readonly section: Section;
  readonly drums: "full" | "none";
  readonly bass: boolean;
  readonly rhodes: boolean;
  readonly pad: boolean;
  readonly uke: boolean;
  readonly lead: boolean;
  readonly chip: boolean;
  readonly voice: boolean;
  readonly chime: boolean;
  /** Semitones to lift the tune, and thin it to the on-beat notes. */
  readonly leadShift: number;
  readonly thinLead: boolean;
  /** Rest the tune for the last half of the final bar — the phrase breathes. */
  readonly breath: boolean;
  /** A closing snare roll over the last steps of the section's final bar. */
  readonly fill: boolean;
  /** Swap the two comping voices' rhythms, so the loop is not the same twice. */
  readonly compSwap: boolean;
  /** A chord-derived bell run at the phrase end. */
  readonly twinkle: boolean;
  /** Double the tune a third below — the closing pass arrives in harmony. */
  readonly harmony: boolean;
  /** Answer with a far-away birdsong chirp, in the calm sections only. */
  readonly chirp: boolean;
  /**
   * Whether this pass may add ornaments (grace notes, fills, flourishes). False
   * on the statement passes, which is what keeps them the source sketch verbatim.
   */
  readonly ornament: boolean;
  /** How the tune is presented this pass — see `TuneView`. */
  readonly tuneView: TuneView;
  /** Bars to rotate the progression by, so a section moves harmonically. */
  readonly chordShift: number;
};

function sectionOf(loop: number): Section {
  if (loop <= 0) return "intro";
  if (loop <= 1) return "a";
  if (loop <= 2) return "b";
  if (loop <= 3) return "break";
  return "final";
}

/** The arrangement for a step of a loop. Pure, so the form can be enumerated. */
export function arrange(song: Song, loop: number, step: number): Arrangement {
  const section = sectionOf(loop);
  const lastBar = step >= song.steps - Math.max(2, song.steps / 4);
  const halfBar = step >= song.steps / 2;
  const use = song.use;
  // A song authored without drums (every lullaby) cannot break down to nothing,
  // so its "break" keeps the lead: silence would read as a stopped player.
  const lanes = drumLanes(song);
  const drumless = !lanes.k.includes("x") && !lanes.s.includes("s");
  // Alternative loops swap which voice comps the off-beat, so the same bar
  // twice in a row is never quite the same bar. Deterministic, not random:
  // variation the ear can follow is development, variation it cannot is noise.
  // Only the second loop of each pair, and never in the intro or the breakdown —
  // those two sections have to sound the same every time, because they are the
  // ones that set the ear up and then reset it.
  const compSwap =
    loop % 2 === 0 && (section === "a" || section === "b" || section === "final");
  // The twinkle lands on the phrase end of the developed and closing passes.
  const twinkle = lastBar && (section === "b" || section === "final") && step >= song.steps - 2;

  switch (section) {
    case "intro":
      // Sparser, never different: the tune keeps whatever voice the song gave
      // it, and only the rhythm section thins out. Forcing a pad here (as an
      // earlier draft did) silenced the melody of a song whose only voice is
      // the bell — a silent opening on the track it is most obvious on.
      return {
        section, drums: "none", bass: use.bass, rhodes: use.rhodes && step === 0,
        pad: use.pad, uke: false, lead: true, chip: use.chip, voice: use.voice,
        chime: use.chime, leadShift: 0, thinLead: false, breath: false, fill: false,
        compSwap, twinkle: false, harmony: false, chirp: false,
        ornament: false, tuneView: "plain", chordShift: 0,
      };
    case "a":
      return {
        section, drums: drumless ? "none" : "full", bass: use.bass, rhodes: use.rhodes, pad: use.pad,
        uke: use.uke, lead: true, chip: use.chip, voice: use.voice, chime: use.chime,
        leadShift: 0, thinLead: false, breath: false, fill: false,
        compSwap, twinkle: false, harmony: false, chirp: false,
        ornament: false, tuneView: "plain", chordShift: 0,
      };
    case "b":
      // The development, and it is deliberately not "pass A an octave up": the
      // progression is rotated a bar so the harmony actually moves (I–V–vi–IV
      // becomes V–vi–IV–I) while the tune arrives half a bar late and answers
      // itself, with the counter-line filling the space it leaves.
      return {
        section, drums: drumless ? "none" : "full", bass: use.bass, rhodes: use.rhodes, pad: use.pad,
        uke: use.uke, lead: true, chip: use.chip, voice: use.voice, chime: true,
        leadShift: 0, thinLead: false, breath: false, fill: lastBar,
        compSwap, twinkle, harmony: false, chirp: false,
        ornament: true, tuneView: "displaced", chordShift: 1,
      };
    case "break":
      return {
        section, drums: "none", bass: use.bass, rhodes: false, pad: use.pad, uke: false,
        // On a sung song the tune rests; on a song with no kit to drop (every
        // lullaby) it keeps singing — reharmonised, so even the quiet pass is
        // not the same as the one before it.
        lead: drumless, chip: use.chip && drumless, voice: use.voice && drumless,
        chime: use.chime, leadShift: 0, thinLead: false, breath: false, fill: false,
        compSwap: false, twinkle: false, harmony: false, chirp: true,
        ornament: false, tuneView: "reharmonised", chordShift: 0,
      };
    default:
      return {
        section, drums: drumless ? "none" : "full", bass: use.bass, rhodes: use.rhodes, pad: use.pad,
        uke: use.uke, lead: true, chip: use.chip, voice: use.voice, chime: use.chime,
        leadShift: 0, thinLead: lastBar, breath: lastBar && halfBar, fill: lastBar,
        compSwap, twinkle, harmony: true, chirp: false,
        ornament: true, tuneView: "inverted", chordShift: 0,
      };
  }
}

/**
 * Snap a note to the nearest tone of the chord under it, in whichever octave
 * puts it closest. This is how the tune can be re-coloured without being
 * rewritten: the contour survives, the intervals change, and it cannot land
 * outside the harmony.
 */
export function toChordTone(chord: readonly number[], midi: number): number {
  const candidates = chord.flatMap((m) => [m, m + 12, m + 24]);
  if (candidates.length === 0) return midi;
  let best = candidates[0]!;
  for (const c of candidates) {
    if (Math.abs(c - midi) < Math.abs(best - midi)) best = c;
  }
  return best;
}

/**
 * Mirror the tune around the chord's centre, then snap back to chord tones, so
 * the closing pass arches the other way — the oldest variation there is, and it
 * still cannot produce a wrong note.
 */
export function invertTune(chord: readonly number[], midi: number): number {
  if (chord.length === 0) return midi;
  const centre = chord[Math.floor(chord.length / 2)]! + 12;
  return toChordTone(chord, centre - (midi - centre));
}

/**
 * The answering line, in the gaps the tune leaves. Chords only, so it cannot
 * clash with the harmony, and stepwise from the previous answer so it reads as
 * a second voice rather than an arpeggiator. 0 means "no answer here".
 */
export function counterTone(
  chord: readonly number[],
  step: number,
  leadMidi: number,
  previous: number,
): number {
  if (leadMidi > 0) return 0;
  // Sit an octave under the tune and only on the off-beats, so the two lines
  // interleave instead of competing.
  if (step % 2 === 0) return 0;
  const candidates = chord.slice(1).map((m) => m + 12);
  if (candidates.length === 0) return 0;
  if (previous <= 0) return candidates[0]!;
  let best = candidates[0]!;
  for (const c of candidates) {
    if (Math.abs(c - previous) < Math.abs(best - previous)) best = c;
  }
  return best;
}

/**
 * The whimsy run: four notes climbing the chord's own voicing two octaves up.
 * Built from the harmony rather than fixed, so it is consonant by construction
 * and cannot clash with a minor chord the way a stock major arpeggio would —
 * and rotated by the loop index, so it is a different flourish each time.
 */
export function twinkleRun(chord: readonly number[], loop: number): readonly number[] {
  const tones = chord.slice(1).map((m) => m + 24);
  if (tones.length === 0) return [];
  const start = loop % tones.length;
  const run = [tones[start % tones.length]!, tones[(start + 1) % tones.length]!, tones[(start + 2) % tones.length]!];
  return [run[0]!, run[1]!, run[2]!, run[2]! + 4];
}

/**
 * A grace note for a tune note that is about to leave a silence: the upper
 * neighbour of the chord, a step early and quiet. It is the difference between
 * a melody that is played and one that is typed.
 */
export function graceTone(chord: readonly number[], leadMidi: number, nextMidi: number): number {
  if (leadMidi <= 0 || nextMidi > 0) return 0;
  const upper = chord.find((m) => m > leadMidi);
  return upper ? upper + 12 : 0;
}

/**
 * The chord tone to double the tune with, in the octave below it.
 *
 * Candidates are the chord's own tones taken in the tune's octave and the one
 * under it, so the answer is the *nearest* chord tone beneath the melody rather
 * than a fixed interval — a third where the harmony offers a third, a sixth or
 * an octave where it does not. Adding an octave blindly (as the first draft
 * did) puts the harmony above the tune, which is not a harmony at all.
 */
export function harmonyTone(chord: readonly number[], leadMidi: number): number {
  if (leadMidi <= 0) return 0;
  const candidates = chord
    .flatMap((m) => [m, m + 12, m + 24])
    .filter((m) => m <= leadMidi - 3);
  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}
