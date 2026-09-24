/**
 * Original procedural score — two instrumentation families, all synthesized
 * in-browser (no copied audio, no samples, no binary assets):
 *
 * 1. ARCADE CHIP (tracks flagged `chip`): bouncy 8-bit-style hooks —
 *    staccato square-wave lead, driving root/octave bass, 2-&-4 backbeat,
 *    156 BPM (176 in fever). The "viral game" sound; front and center.
 *    Every chip bar is doubled by the glockenspiel shimmer an octave up, so
 *    the arcade hooks sparkle instead of buzzing.
 * 2. ISLAND FOLK (the rest): ukulele strums, GLOCKENSPIEL LEAD (bar-partial
 *    bell synthesis — the melody voice of the whole game), whistled
 *    counter-line, upright-style bass, and an upbeat kit.
 *
 * Tone rules (2026-09-22 rewrite): bright, melodic, forward-moving. Every
 * track carries a singable tune over a dancing kit; nothing is allowed to
 * sit on a held drone for a whole bar. Melodies are the hook — the glock
 * leads, the square wave answers, the whistle soars over the fever.
 *
 * Layers respond to game state:
 *   menu  → full band with a light kit (a game menu should feel alive)
 *   play  → + shaker 8ths, kick on the beat, melody full-strength
 *   fever → + clap + snare backbeat, whistle lead, brighter, faster
 *   storm → same band, pulled a minor third down, extra kick
 *   sleep → music-box lullaby
 *
 * On top of those modes sits the *arrangement* — which instruments are in the
 * band at this point of a flight (`MusicArrangement.ts`): a take-off breath with
 * the kit held back, the tuned mix in cruise, a brightened and thinned band at
 * the apex, and a landing cadence with the rhythm section removed. Intensity
 * rides one arrangement louder; the arrangement changes who is playing.
 */
import { arrangement, arrangementGlide, runPhase, type RunPhase } from "./MusicArrangement";

export type MusicMode = "off" | "menu" | "play" | "fever" | "sleep" | "storm";
export type BiomeMusicStyle = "bright" | "warm" | "airy" | "wide" | "night" | "crystal" | "reef" | "ember" | "canyon";

type Voicing = number[];

const BEAT_BPM = 132;
const LOOKAHEAD = 0.16;
const TICK_MS = 25;
/** Hard ceiling on steps scheduled in one timer tick. */
const MAX_STEPS_PER_TICK = 8;
/** How far behind the clock the sequencer may fall before it re-anchors. */
const MAX_LAG = 0.28;

/**
 * Glockenspiel bar partials.
 *
 * A struck metal bar vibrates in a fixed, *inharmonic* mode series — roughly
 * 1 : 2.76 : 5.40 : 8.93 — with each higher partial dying far faster than the
 * fundamental. That ratio set (not a harmonic stack, not FM) is what makes a
 * real glockenspiel read as "bright little bell" instead of "clangy synth".
 * The old voice was a DX7-style FM bell (mod ratio 3.5, index 4.5) which is
 * where the harsh, gong-like edge came from.
 */
export const GLOCK_PARTIALS: { ratio: number; amp: number; decay: number }[] = [
  { ratio: 1.0, amp: 1.0, decay: 1.9 },
  { ratio: 2.756, amp: 0.42, decay: 0.9 },
  { ratio: 5.404, amp: 0.17, decay: 0.42 },
  { ratio: 8.933, amp: 0.07, decay: 0.22 },
];


/**
 * Guard against the "machine-gun" failure mode of a lookahead sequencer.
 *
 * Browsers throttle timers in hidden/occluded tabs to >= 1 s. On return, the
 * scheduler's tick loop would otherwise find `nextTime` a whole bar behind the
 * audio clock and schedule every missed step at once — the same instant —
 * which the player hears as the music stuttering or repeating. When the
 * sequencer has fallen further behind than `maxLag`, skip forward instead of
 * replaying the backlog.
 *
 * Exported for unit testing; it is pure.
 */
export function clampSequencerTime(
  nextTime: number,
  now: number,
  maxLag = MAX_LAG,
  reanchor = 0.05,
): number {
  return nextTime < now - maxLag ? now + reanchor : nextTime;
}

// Ukulele GCEA voicings (midi)
const UKE: Record<string, Voicing> = {
  C:  [67, 60, 64, 72],
  G:  [67, 62, 67, 71],
  Am: [69, 60, 64, 69],
  F:  [69, 60, 65, 69],
  Em: [67, 59, 64, 67],
  Dm: [69, 62, 65, 69],
  Gm: [67, 62, 63, 70], // G–D–Eb–Bb, used in PROG_TRON
};

const BASS_ROOT: Record<string, number> = { C: 48, G: 43, Am: 45, F: 41, Em: 40, Dm: 38, Gm: 43 };

/* Progressions — REWRITTEN 2026-09-24 as real 8-bar periods.
 *
 * Eleven of these were a 4-chord loop stated twice: `PROG_B` and `PROG_K` were
 * byte-identical under two names, and almost every set ended where it began or
 * on a dominant that never resolved, so an eight-minute flight was one four-bar
 * idea repeated ~120 times with no cadence anywhere in it. Texture changed (the
 * arrangement phases do that well); harmony never went anywhere.
 *
 * Each progression is now an antecedent (bars 1–4, unchanged — the melodies were
 * written against them and their phrase arrivals are pinned by
 * `music-brief.test.ts`) and a consequent (bars 5–8) that departs and *lands*:
 * a ii–V–I, a plagal IV–I, or in the minor tracks a modal v–i / ♭VII–i. Roman
 * numerals are in the comments because "C G Am F" does not tell you whether a
 * loop closes. `music-harmony.test.ts` enforces the theory: a cadence must exist
 * (in the bars or across the loop seam), the tonic must be reached more than
 * once, and no two progressions may be identical.
 *
 * Known limit, honestly: the chord table has no E major, so the minor tracks
 * cannot produce a true harmonic-minor V–i (the G# leading tone). They cadence
 * modally instead — v–i and ♭VII–i — which is a *choice* with a flatter, colder
 * feel. Adding E means letting G# into the melodic contract, which is a key
 * change, not a data edit: see docs/audits/MUSIC_AND_HUD_CRITIQUE_2026-09-24.md.
 */
const PROG_A = ["C", "G", "Am", "F", "Dm", "G", "C", "C"];   // I V vi IV | ii V I I
const PROG_B = ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];  // I V vi iii | IV I ii V (resolves across the seam)
// PROG_K: Zimmer-style cinematic minor — "Time" / Inception for four bars, then
// a modal cadence home instead of a second copy of the loop.
const PROG_K = ["Am", "F", "C", "G", "Am", "F", "G", "Am"];  // i VI III ♭VII | i VI ♭VII i
const PROG_C = ["F", "G", "Em", "Am", "F", "G", "C", "C"];   // IV V iii vi | IV V I I
const PROG_D = ["Dm", "G", "C", "Am", "F", "G", "C", "C"];   // ii V I vi | IV V I I
const PROG_E = ["C", "Am", "F", "G", "Am", "F", "G", "C"];   // I vi IV V | vi IV V I
const PROG_F = ["Am", "Em", "F", "C", "Am", "F", "Em", "Am"];// i v VI III | i VI v i
const PROG_G = ["C", "G", "Dm", "Am", "F", "Dm", "G", "C"];  // I V ii vi | IV ii V I
const PROG_H = ["G", "C", "Am", "F", "Dm", "G", "C", "C"];   // V I vi IV | ii V I I
const PROG_I = ["F", "C", "Dm", "G", "Am", "F", "G", "C"];   // IV I ii V | vi IV V I
const PROG_J = ["Am", "C", "G", "F", "F", "G", "Em", "Am"];  // i III ♭VII VI | VI VII v i
// PROG_TRON: Daft Punk / Tron Legacy dark electronic. Am → Dm → Gm → Em — all minor,
// no major relief. Creates the claustrophobic Grid tension.
const PROG_TRON = ["Am", "Dm", "Am", "Em", "Am", "Dm", "Gm", "Em"];

/* Melodies: one entry per eighth note (0 = rest, -1 = hold previous).
 *
 * REWRITE (2026-09-22) — the previous island set was "Zimmer architecture":
 * mostly held notes and silence, which read as *dull* in a bright arcade
 * glider where the flight itself is fast and playful. The brief now is
 * upbeat, melodic, glockenspiel-forward:
 *
 *   • every melody is a real tune — a singable 8-bar phrase with a clear
 *     arch (statement → lift → answer → resolve), not a drone;
 *   • motion is mostly stepwise with one heroic leap, and every phrase ends
 *     on a chord tone of the bar it lands on, so nothing clashes no matter
 *     which progression the track pairs it with;
 *   • melodies sit in the C-major / A-minor family, matching the progressions
 *     below, and stay inside the glockenspiel's sweet spot (C5–E6, midi
 *     72–88) so the bar-partial bell rings out instead of thudding;
 *   • the arcade chip family keeps its own hook-first tunes (MEL_CHIP_*) and
 *     now gets a glockenspiel doubling layer on top.
 *
 * Playback layers on top of these lines: glockenspiel lead + octave shimmer,
 * a sparkle run at phrase ends, ukulele strum, bass, and an upbeat kit.
 */

// Track 1 — Ascent: daybreak climb. Rising arpeggio, answered descent, peak.
const MEL_A = [
  72, 0, 76, 0, 79, -1, -1, 0,
  79, 0, 74, 0, 71, -1, -1, 0,
  72, 0, 76, 0, 81, -1, 79, 0,
  77, 0, 76, 0, 72, -1, -1, 0,
  76, 0, 79, 0, 84, -1, 83, 0,
  83, 0, 81, 0, 79, -1, 76, 0,
  77, 0, 81, 0, 84, -1, 83, 0,
  81, 0, 79, 0, 74, -1, -1, 0,
];

// Track 2 — Voyage: open-sea crossing. Long line, wide top, warm landing.
const MEL_B = [
  69, 0, 72, 0, 76, -1, 79, 0,
  77, 0, 76, 0, 72, -1, -1, 0,
  76, 0, 79, 0, 84, -1, 83, 0,
  81, 0, 79, 0, 74, -1, -1, 0,
  81, 0, 84, 0, 88, -1, 86, 0,
  84, 0, 81, 0, 79, -1, 77, 0,
  76, 0, 79, 0, 81, -1, 84, 0,
  83, -1, -1, 0, 79, -1, -1, 0,
];

// Track 3 — Cathedral: hymn for a big sky. Call, answer, and a full top note.
const MEL_C = [
  77, 0, 79, 0, 81, -1, -1, 0,
  79, 0, 83, 0, 86, -1, 84, 0,
  83, 0, 81, 0, 79, -1, 76, 0,
  79, 0, 76, 0, 72, -1, -1, 0,
  81, 0, 84, 0, 86, -1, 84, 0,
  83, 0, 81, 0, 79, -1, 83, 0,
  84, -1, 83, 0, 81, -1, 79, 0,
  76, -1, -1, -1, 0, 0, 0, 0,
];

// Track 4 — Pendulum: swinging, playful, an octave-wide peak at the turn.
const MEL_D = [
  74, 0, 77, 0, 81, -1, 79, 0,
  79, 0, 77, 0, 74, -1, -1, 0,
  72, 0, 76, 0, 79, -1, 84, 0,
  83, 0, 81, 0, 76, -1, 72, 0,
  77, 0, 81, 0, 84, -1, 86, 0,
  84, 0, 83, 0, 79, -1, 74, 0,
  76, 0, 79, 0, 84, -1, 88, 0,
  86, -1, 84, 0, 79, -1, -1, 0,
];

// Track 5 — The Grid: neon synth line. Punchy, on-the-grid, lifted ending.
const MEL_E = [
  69, 0, 69, 0, 72, -1, 76, 0,
  74, 0, 74, 0, 77, -1, 81, 0,
  76, 0, 72, 0, 69, -1, -1, 0,
  67, 0, 71, 0, 76, -1, 79, 0,
  81, 0, 79, 0, 76, -1, 72, 0,
  74, 0, 77, 0, 81, -1, 86, 0,
  79, 0, 77, 0, 74, -1, 70, 0,
  71, -1, -1, 0, 67, -1, -1, 0,
];

// Track 6 — Eventide: dusk drift. Gentle arch, resolving every two bars.
const MEL_F = [
  72, 0, 76, 0, 79, -1, -1, 0,
  76, 0, 74, 0, 71, -1, -1, 0,
  72, 0, 77, 0, 81, -1, 79, 0,
  76, 0, 72, 0, 76, -1, -1, 0,
  79, 0, 81, 0, 84, -1, 81, 0,
  83, 0, 79, 0, 76, -1, 74, 0,
  77, 0, 79, 0, 81, -1, 84, 0,
  83, -1, 81, 0, 76, -1, -1, 0,
];

// Track 7 — Glass & Stars: crystal sparkle. Repeated top eighths, bells answer.
const MEL_G = [
  84, 0, 79, 0, 76, 0, 79, -1,
  83, 0, 79, 0, 74, 0, 79, -1,
  81, 0, 77, 0, 74, 0, 77, -1,
  81, 0, 76, 0, 72, 0, 76, -1,
  88, 0, 84, 0, 79, -1, 83, 0,
  86, 0, 83, 0, 79, -1, 74, 0,
  77, 0, 81, 0, 84, -1, 86, 0,
  84, -1, 81, 0, 76, -1, -1, 0,
];

// Track 8 — Trade Winds: rolling breeze in G. Sailor's lilt, big final lift.
const MEL_H = [
  74, 0, 79, 0, 83, -1, 81, 0,
  79, 0, 76, 0, 72, -1, 76, 0,
  81, 0, 76, 0, 72, -1, 69, 0,
  72, 0, 77, 0, 81, -1, 79, 0,
  83, 0, 86, 0, 88, -1, 86, 0,
  84, 0, 79, 0, 76, -1, 72, 0,
  76, 0, 79, 0, 81, -1, 84, 0,
  81, -1, 79, 0, 77, -1, -1, 0,
];

// Track 9 — Golden Hour: warm lilting 6/8-feel. Golden, unhurried, resolved.
const MEL_I = [
  77, 0, 81, 0, 84, -1, 81, 0,
  79, 0, 76, 0, 72, -1, 74, 0,
  77, 0, 74, 0, 69, -1, 74, 0,
  74, 0, 79, 0, 83, -1, -1, 0,
  84, 0, 81, 0, 77, -1, 79, 0,
  76, 0, 79, 0, 84, -1, 83, 0,
  81, 0, 77, 0, 74, -1, 77, 0,
  79, -1, -1, 0, 74, -1, -1, 0,
];

// Track 10 — Starfall: night flight with hope in it. Rising questions, bright answers.
const MEL_J = [
  76, 0, 81, 0, 84, -1, 81, 0,
  83, 0, 79, 0, 76, -1, 79, 0,
  74, 0, 79, 0, 83, -1, 86, 0,
  84, 0, 81, 0, 77, -1, -1, 0,
  81, 0, 84, 0, 88, -1, 86, 0,
  84, 0, 83, 0, 79, -1, 76, 0,
  79, 0, 83, 0, 86, -1, 84, 0,
  81, -1, -1, 0, 77, -1, -1, 0,
];

// Track 11 — Derezzed: neon riff with a real hook over the Grid progression.
const MEL_K = [
  69, 0, 72, 0, 69, 0, 72, 0,
  74, 0, 72, 0, 74, 0, 77, 0,
  76, 0, 72, 0, 69, -1, -1, 0,
  71, 0, 67, 0, 71, -1, 74, 0,
  81, 0, 79, 0, 76, 0, 72, 0,
  77, 0, 74, 0, 77, -1, 81, 0,
  79, 0, 77, 0, 74, -1, 70, 0,
  71, -1, 74, 0, 71, -1, -1, 0,
];

// Track 12 — Magma: driving sixteenth-feel rock climb. Insistent, hot, peaks twice.
const MEL_L = [
  69, 0, 72, 0, 76, 0, 81, -1,
  79, 0, 76, 0, 71, 0, 76, -1,
  77, 0, 81, 0, 84, -1, 83, 0,
  81, 0, 79, 0, 76, -1, 72, 0,
  76, 0, 79, 0, 84, 0, 88, -1,
  86, 0, 83, 0, 79, 0, 76, -1,
  81, 0, 84, 0, 86, -1, 84, 0,
  83, -1, 81, 0, 79, -1, -1, 0,
];

// Track 13 — Mesa: big-canyon call. Wide intervals, echoes, long resolve.
const MEL_M = [
  72, 0, 77, 0, 81, -1, 79, 0,
  76, 0, 72, 0, 76, -1, 79, 0,
  77, 0, 81, 0, 84, -1, 81, 0,
  83, 0, 79, 0, 74, -1, -1, 0,
  84, 0, 81, 0, 77, -1, 81, 0,
  79, 0, 76, 0, 72, -1, 74, 0,
  77, 0, 74, 0, 77, -1, 81, 0,
  79, -1, -1, -1, 0, 0, 0, 0,
];

// Track 14 — Time's Light: cinematic but singing — the tune carries it, not the pad.
const MEL_N = [
  69, 0, 72, 0, 76, -1, 79, 0,
  81, 0, 79, 0, 77, -1, 76, 0,
  72, 0, 76, 0, 79, -1, 84, 0,
  83, 0, 81, 0, 79, -1, 74, 0,
  81, 0, 84, 0, 88, -1, 86, 0,
  84, 0, 81, 0, 77, -1, 81, 0,
  79, 0, 76, 0, 79, -1, 84, 0,
  83, -1, -1, -1, 0, 0, 0, 0,
];

// Track 15 — Horizon Chase: adventure-theme push. Every bar ends on a lift.
const MEL_O = [
  71, 0, 74, 0, 79, -1, 83, 0,
  84, 0, 79, 0, 76, -1, 79, 0,
  81, 0, 76, 0, 72, -1, 76, 0,
  77, 0, 81, 0, 84, -1, 81, 0,
  83, 0, 86, 0, 88, -1, 86, 0,
  84, 0, 83, 0, 79, -1, 76, 0,
  79, 0, 81, 0, 84, -1, 86, 0,
  84, -1, 81, 0, 77, -1, -1, 0,
];

// Track 16 — Fever Dream: paired-note fever hook. Twice as busy, still melodic.
// The last bar used to land on B5, the third of the G that bar 8 held when the
// progression was a I–vi–IV–V loop stated twice. Bar 8 is now the tonic (the
// period cadences V→I), so the tune does what a cadence always wanted: the
// leading tone resolves up to C. D6 → C6 → C6, same rhythm, one semitone.
const MEL_P = [
  72, 0, 76, 76, 79, 0, 84, -1,
  83, 0, 81, 81, 79, 0, 76, -1,
  77, 0, 81, 81, 84, 0, 86, -1,
  84, 0, 83, 83, 79, 0, 74, -1,
  88, 0, 84, 84, 79, 0, 84, -1,
  86, 0, 84, 84, 81, 0, 79, -1,
  81, 0, 84, 84, 86, 0, 88, -1,
  86, -1, 84, 0, 84, -1, -1, 0,
];

// Track 17 — Inception Drop: hypnotic build that never sits still — rising pairs.
const MEL_Q = [
  69, -1, -1, 0, 72, 0, 76, -1,
  77, -1, -1, 0, 81, 0, 84, -1,
  83, -1, -1, 0, 79, 0, 76, -1,
  74, -1, -1, 0, 79, 0, 83, -1,
  84, -1, -1, 0, 81, 0, 76, -1,
  77, -1, -1, 0, 81, 0, 84, -1,
  86, -1, -1, 0, 84, 0, 79, -1,
  83, -1, -1, -1, 0, 0, 0, 0,
];

// Track 18 — Dunkirk Clock: ticking eighths with a tune inside the pulse.
const MEL_R = [
  81, 0, 81, 0, 84, 0, 81, 0,
  79, 0, 79, 0, 83, 0, 79, 0,
  74, 0, 74, 0, 79, 0, 74, 0,
  72, 0, 72, 0, 77, 0, 81, -1,
  84, 0, 84, 0, 81, 0, 76, 0,
  79, 0, 79, 0, 83, 0, 86, 0,
  84, 0, 83, 0, 79, 0, 74, 0,
  77, -1, -1, 0, 72, -1, -1, 0,
];

// Track 19 — End of Line: anthemic Grid outro. Big, slow-blooming, heroic.
const MEL_S = [
  69, 0, 76, 0, 72, -1, 69, 0,
  74, 0, 77, 0, 81, -1, 77, 0,
  76, -1, -1, 0, 72, 0, 69, 0,
  71, 0, 74, 0, 79, -1, 76, 0,
  76, 0, 81, 0, 84, -1, 81, 0,
  77, 0, 81, 0, 86, -1, 84, 0,
  79, 0, 77, 0, 74, -1, 70, 0,
  71, -1, -1, 0, 67, -1, -1, 0,
];

// Track 20 — Rinzler: the chase riff. Doubled sixteenths, no let-up.
const MEL_T = [
  69, 69, 0, 72, 0, 69, 72, 0,
  74, 74, 0, 77, 0, 74, 77, 0,
  76, 76, 0, 72, 0, 69, -1, 0,
  71, 71, 0, 74, 0, 79, 0, 0,
  81, 81, 0, 84, 0, 81, 79, 0,
  86, 86, 0, 84, 0, 81, 77, 0,
  79, 79, 0, 77, 0, 74, 70, 0,
  71, 0, 0, 74, 0, 71, -1, 0,
];

/* The hand-authored WHISTLE / WHISTLE_B counter-lines lived here. They were
 * written against an older melody set and, once measured against the current
 * one, collided with the lead on 183 eighths — semitone clashes included. The
 * counter-voice is now generated per bar from the chord voicing (see
 * `counterStep`), which is checkable and cannot clash: see the counter-melody
 * block in `scheduleStep` for the full rationale. */

// Strum pattern per eighth: 1 = down, 2 = up, 0 = none (island strum D _ D U _ U D U)
const STRUM = [1, 0, 1, 2, 0, 2, 1, 2];

export type Track = { name: string; prog: string[]; mel: number[]; mood: BiomeMusicStyle; /** Arcade chiptune family: square lead, driving 8th bass, backbeat, fast tempo. */ chip?: boolean };

/* ============================ ARCADE CHIP FAMILY =========================
 * Bouncy, hook-first 8-bit-style bangers — the "viral game" sound:
 * staccato square-wave leads over driving root/octave bass on a 2-&-4
 * backbeat. Each is a tight 8-bar loop built on a 2-bar motif with
 * variation, so the ear locks on in one pass. */

const PROG_CHIP_1 = ["C", "G", "Am", "F", "C", "G", "Am", "F"]; // I–V–vi–IV
const PROG_CHIP_2 = ["C", "F", "G", "F", "C", "F", "G", "G"];  // I–IV–V–IV
const PROG_CHIP_3 = ["C", "Am", "F", "G", "C", "Am", "F", "G"]; // I–vi–IV–V
const PROG_CHIP_5 = ["C", "F", "Am", "G", "C", "F", "Am", "G"]; // I–IV–vi–V
// ii–V–I–IV, then the same period landing on the tonic: bar 8 used to be F, so
// the loop restarted IV→ii and never came home anywhere (the cadence test in
// music-harmony.test.ts is what caught it).
const PROG_CHIP_6 = ["Dm", "G", "C", "F", "Dm", "G", "C", "C"]; // ii V I IV | ii V I I

// Flappy Rush: staccato rising arp → peak hold → falling resolve. The bounce
// of a coin-tap game: C5–E5–G5–C6 on the downbeat of bar 1.
const MEL_CHIP_1 = [
  72, 0, 72, 0, 76, 0, 79, 0,
  79, 0, 79, 0, 84, 0, 83, 0,
  81, 0, 81, 0, 79, 0, 76, 0,
  79, 0, 81, 0, 84, -1, 0, 0,
  72, 0, 76, 0, 79, 0, 84, -1,
  84, 0, 83, 0, 79, 0, 79, 0,
  81, 0, 79, 0, 76, 0, 79, 0,
  77, 0, 74, 0, 72, -1, -1, 0,
];

// Coin Pop: paired-note "coin" figure (C5–C5–G5–C6) that repeats a step
// higher each bar — the most repeatable hook in the box.
const MEL_CHIP_2 = [
  72, 0, 72, 79, 0, 79, 84, 0,
  72, 0, 72, 74, 0, 74, 81, 0,
  74, 0, 74, 79, 0, 79, 84, 0,
  74, 0, 74, 81, 0, 81, 79, 0,
  79, 0, 84, 0, 84, 0, 86, 0,
  81, 0, 84, 0, 84, 0, 81, 0,
  84, 0, 84, 83, 0, 83, 79, 0,
  81, 0, 79, 0, 74, -1, -1, 0,
];

// Hyper Glide: three-note pickup gallop (E5–E5–G5) that climbs bar by bar
// and lands on a held peak — pure forward motion.
const MEL_CHIP_3 = [
  76, 0, 0, 76, 0, 0, 79, 0,
  81, 0, 0, 81, 0, 0, 84, 0,
  79, 0, 0, 79, 0, 0, 76, 0,
  79, 0, 0, 79, 0, 0, 74, 0,
  76, 0, 0, 79, 0, 0, 84, -1,
  81, 0, 0, 79, 0, 0, 81, -1,
  84, 0, 0, 81, 0, 0, 79, -1,
  79, 0, 0, 74, 0, 0, 79, -1,
];

// Bouncy Bird: two-two gallop (A5–A5–G5–E5) over the vi–IV–I–V lift —
// the "run for your life" footwork.
const MEL_CHIP_4 = [
  81, 81, 0, 79, 0, 0, 76, 76,
  76, 76, 0, 74, 0, 0, 72, 72,
  72, 72, 0, 76, 0, 0, 79, 79,
  79, 79, 0, 84, 0, 0, 83, 83,
  81, 81, 0, 84, 0, 0, 81, 81,
  79, 79, 0, 76, 0, 0, 74, 74,
  72, 72, 0, 76, 0, 0, 79, 79,
  79, 0, 0, 79, 0, 0, 79, -1,
];

// Sunset Sprint: syncopated quarter-note pop (C5–E5–G5–A5) with a held
// peak each second phrase — upbeat arcade-pop.
const MEL_CHIP_5 = [
  72, 0, 76, 76, 0, 79, 0, 81,
  79, 0, 76, 76, 0, 81, 0, 84,
  81, 0, 79, 79, 0, 81, 0, 84,
  84, 0, 83, 83, 0, 79, 0, 79,
  76, 0, 79, 79, 0, 84, 0, 84,
  84, 0, 81, 81, 0, 79, 0, 76,
  79, 0, 76, 76, 0, 79, 0, 81,
  79, 0, 74, 74, 0, 79, -1, 0,
];

// Pixel Coast: offbeat syncopation (0–D5–0–F5–F5–A5) over ii–V–I–IV —
// the grooviest one in the box; the night-arcade track.
const MEL_CHIP_6 = [
  0, 74, 0, 76, 77, 0, 81, 0,
  0, 79, 0, 84, 83, 0, 79, 0,
  0, 72, 0, 76, 79, 0, 84, 0,
  0, 77, 0, 81, 84, 0, 79, 0,
  0, 74, 0, 76, 79, 0, 81, -1,
  0, 79, 0, 83, 84, 0, 81, 0,
  0, 72, 0, 79, 84, -1, 0, 0,
  0, 77, 0, 79, 81, -1, -1, 0,
];

// Sugar Rush: paired-call motif (E5–E5–G5) that climbs and answers —
// candy-coated and relentless, the double-tap track.
const MEL_CHIP_7 = [
  76, 76, 0, 76, 0, 79, 0, 0,
  76, 76, 0, 76, 0, 79, 0, 81,
  81, 81, 0, 81, 0, 84, 0, 83,
  81, 79, 76, 0, 79, -1, 0, 0,
  74, 74, 0, 74, 0, 77, 0, 0,
  76, 76, 0, 76, 0, 79, 0, 81,
  84, 84, 0, 83, 0, 81, 0, 79,
  76, 0, 74, 0, 72, -1, 0, 0,
];

// Neon Tail: offbeat 16th drive over ii–V–I–IV with a high sparkle answer —
// the late-night highway track.
const MEL_CHIP_8 = [
  0, 74, 76, 0, 79, 0, 76, 74,
  0, 72, 74, 0, 76, 0, 74, 72,
  0, 74, 76, 0, 79, 0, 81, 79,
  0, 84, 0, 83, 81, -1, 0, 0,
  0, 74, 76, 0, 79, 0, 81, 84,
  0, 86, 84, 0, 81, 0, 79, 76,
  0, 74, 76, 0, 79, 0, 76, 74,
  0, 72, 0, 74, 72, -1, 0, 0,
];

// Turbo Finch: two-note gallop pairs leaping octaves — pure forward motion,
// the "one more run" track.
const MEL_CHIP_9 = [
  72, 72, 79, 0, 76, 76, 84, 0,
  81, 81, 88, 0, 84, 84, 83, 0,
  79, 79, 86, 0, 83, 83, 79, 0,
  76, 0, 74, 0, 72, -1, 0, 0,
  72, 72, 79, 0, 76, 76, 84, 0,
  81, 0, 84, 0, 81, 0, 79, 0,
  76, 76, 83, 0, 79, 79, 84, 0,
  81, 79, 76, 74, 74, -1, 0, 0,
];

// Moon Arcade: syncopated minor groove (A-minor color over the IV loop) —
// the after-hours cabinet track.
const MEL_CHIP_10 = [
  0, 81, 0, 79, 76, 0, 79, 0,
  0, 81, 0, 84, 83, 0, 81, 0,
  0, 79, 0, 76, 74, 0, 76, 0,
  0, 74, 0, 76, 74, -1, 0, 0,
  0, 81, 0, 79, 81, 0, 84, 0,
  0, 86, 0, 84, 83, 0, 81, 0,
  0, 79, 0, 81, 79, 0, 76, 0,
  0, 74, 76, 0, 74, -1, 0, 0,
];

const PROG_CHIP_7 = ["Am", "F", "C", "G", "Am", "F", "C", "G"]; // vi–IV–I–V

/**
 * Track list. The arcade chiptune family comes FIRST so it sits at the top
 * of the settings picker and early in every shuffle pass; the island-folk /
 * cinematic originals follow unchanged.
 */
export const TRACKS: Track[] = [
  { name: "Flappy Rush",     prog: PROG_CHIP_1, mel: MEL_CHIP_1, mood: "bright", chip: true },
  { name: "Coin Pop",        prog: PROG_CHIP_2, mel: MEL_CHIP_2, mood: "bright", chip: true },
  { name: "Hyper Glide",     prog: PROG_CHIP_3, mel: MEL_CHIP_3, mood: "airy",   chip: true },
  { name: "Bouncy Bird",     prog: PROG_K,      mel: MEL_CHIP_4, mood: "warm",   chip: true },
  { name: "Sunset Sprint",   prog: PROG_CHIP_5, mel: MEL_CHIP_5, mood: "wide",   chip: true },
  { name: "Pixel Coast",     prog: PROG_CHIP_6, mel: MEL_CHIP_6, mood: "night",  chip: true },
  { name: "Sugar Rush",      prog: PROG_CHIP_1, mel: MEL_CHIP_7,  mood: "bright", chip: true },
  { name: "Neon Tail",       prog: PROG_CHIP_6, mel: MEL_CHIP_8,  mood: "night",  chip: true },
  { name: "Turbo Finch",     prog: PROG_CHIP_5, mel: MEL_CHIP_9,  mood: "warm",   chip: true },
  { name: "Moon Arcade",     prog: PROG_CHIP_7, mel: MEL_CHIP_10, mood: "ember",  chip: true },
  { name: "Ascent",            prog: PROG_A, mel: MEL_A, mood: "bright"  },
  { name: "Voyage",            prog: PROG_B, mel: MEL_B, mood: "airy"    },
  { name: "Cathedral",         prog: PROG_C, mel: MEL_C, mood: "bright"  },
  { name: "Pendulum",          prog: PROG_D, mel: MEL_D, mood: "wide"    },
  { name: "The Grid",          prog: PROG_TRON, mel: MEL_E, mood: "night" },
  { name: "Eventide",          prog: PROG_F, mel: MEL_F, mood: "night"   },
  { name: "Glass & Stars",     prog: PROG_G, mel: MEL_G, mood: "crystal" },
  { name: "Trade Winds",       prog: PROG_H, mel: MEL_H, mood: "wide"    },
  { name: "Golden Hour",       prog: PROG_I, mel: MEL_I, mood: "warm"    },
  { name: "Starfall",          prog: PROG_J, mel: MEL_J, mood: "night"   },
  { name: "Derezzed",          prog: PROG_TRON, mel: MEL_K, mood: "ember" },
  { name: "Magma",             prog: PROG_F, mel: MEL_L, mood: "ember"   },
  { name: "Mesa",              prog: PROG_I, mel: MEL_M, mood: "canyon"  },
  { name: "Time's Light",      prog: PROG_K, mel: MEL_N, mood: "wide"    },
  { name: "Horizon Chase",     prog: PROG_H, mel: MEL_O, mood: "bright"  },
  { name: "Fever Dream",       prog: PROG_E, mel: MEL_P, mood: "reef"    },
  { name: "Inception Drop",    prog: PROG_K, mel: MEL_Q, mood: "night"   },
  { name: "Dunkirk Clock",     prog: PROG_J, mel: MEL_R, mood: "ember"   },
  { name: "End of Line",       prog: PROG_TRON, mel: MEL_S, mood: "night" },
  { name: "Rinzler",           prog: PROG_TRON, mel: MEL_T, mood: "ember" },
];

/** Track titles for the settings picker — keep in lockstep with TRACKS. */
export const TRACK_NAMES: string[] = TRACKS.map((t) => t.name);

// Per-biome orchestration keeps each island sonically distinct while all
// variants share the same original melodic identity.
export const BIOME_MIX: Record<BiomeMusicStyle, { bpm: number; fever: number; cutoff: number; uke: number; glock: number; bass: number; perc: number; whistle: number; transpose: number }> = {
  // Upbeat floor: nothing in the library sits below 116 BPM, and every island
  // keeps a bright register (transposition stays inside ±4 semitones so the
  // glock lead never sinks into the bass).
  bright:  { bpm: 132, fever: 150, cutoff: 10200, uke: 0.86, glock: 1.42, bass: 0.96, perc: 1.02, whistle: 0.92, transpose: 0  },
  warm:    { bpm: 126, fever: 146, cutoff: 8400,  uke: 1.02, glock: 1.22, bass: 1.04, perc: 1,    whistle: 0.82, transpose: -2 },
  airy:    { bpm: 134, fever: 152, cutoff: 11000, uke: 0.76, glock: 1.52, bass: 0.86, perc: 1.18, whistle: 0.98, transpose: 2  },
  wide:    { bpm: 128, fever: 148, cutoff: 9200,  uke: 0.76, glock: 1.3,  bass: 1.14, perc: 1,    whistle: 1.0,  transpose: -3 },
  night:   { bpm: 124, fever: 144, cutoff: 7400,  uke: 0.6,  glock: 1.6,  bass: 0.78, perc: 0.86, whistle: 0.78, transpose: -3 },
  crystal: { bpm: 132, fever: 150, cutoff: 11600, uke: 0.7,  glock: 1.68, bass: 0.88, perc: 1.06, whistle: 1.1,  transpose: 3  },
  // Coral Reach: flowing, liquid — brighter glock sparkle, open high end
  reef:    { bpm: 136, fever: 154, cutoff: 12000, uke: 0.72, glock: 1.6,  bass: 0.82, perc: 0.92, whistle: 1.02, transpose: 3  },
  // Cinder Forge: driving, volcanic — heavy bass, but the melody stays awake
  ember:   { bpm: 124, fever: 142, cutoff: 6600,  uke: 0.64, glock: 1.32, bass: 1.24, perc: 1.14, whistle: 0.62, transpose: -4 },
  // Skyreach Canyon: wide and open — full band, big dynamics
  canyon:  { bpm: 130, fever: 148, cutoff: 9400,  uke: 0.72, glock: 1.26, bass: 1.14, perc: 1,    whistle: 1.02, transpose: -2 },
};

/** Keep every biome/night combination inside WebAudio's usable filter range. */
export function musicCutoff(base: number, night: number, intensity: number, sampleRate = 44100): number {
  return Math.max(700, Math.min(sampleRate * 0.45, base - night * 4200 + intensity * 2400));
}

function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class Music {
  private mode: MusicMode = "off";
  private targetMode: MusicMode = "off";
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private section = 0;
  /** Which tracks to play: "shuffle" cycles all ten in random order, or a
   *  number pins one track. Mirrors the persisted settings value. */
  private trackSel: number | "shuffle" = "shuffle";
  private order: number[] = [];
  private orderPos = 0;
  /** Fired whenever the engine advances to a new track, with its title. */
  onTrackChange: ((name: string) => void) | null = null;
  private bpm = BEAT_BPM;
  private night = 0;
  private biome: BiomeMusicStyle = "bright";
  private transpose = 0;
  private lastCutoff = 9000;
  /** 0..1 — continuous intensity (speed / altitude / fever / danger / combos). */
  private intensity = 0;
  private intensityTarget = 0;

  /**
   * Music pass 3 — arrangement sections. Which phase of a flight the band is
   * arranged for, and the run clock the phase is derived from. `cruise` and
   * `menu` are neutral by construction (every multiplier is exactly 1), so a
   * flight that never leaves the middle of its intensity range sounds exactly
   * like the score that shipped before this existed.
   */
  private phase: RunPhase = "menu";
  private inRun = false;
  private runClock = 0;
  private runEndedAt: number | null = null;
  /** Set for one `apply()` when the change is a phase change, so the whole band
   * re-arranges as a single gesture instead of thirteen unrelated fades. */
  private arrGlide: number | null = null;
  /** What the game last asked for, before any moment boost — kept so a
   * temporary push can decay back to the real value instead of to zero. */
  private intensityRaw = 0;
  /** Short-lived offset added by `pushIntensity` (moment reactions). */
  private intensityBoost = 0;
  private boostTimer: ReturnType<typeof setTimeout> | null = null;
  private underwaterTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly bus: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly duckGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly ukeGain: GainNode;
  private readonly glockGain: GainNode;
  private readonly bassGain: GainNode;
  private readonly percGain: GainNode;
  private readonly whistleGain: GainNode;
  private readonly padGain: GainNode;
  private readonly lullabyGain: GainNode;
  private readonly tensionGain: GainNode;
  private readonly arpGain: GainNode;
  private readonly organGain: GainNode;
  private readonly tronGain: GainNode;
  private readonly chipGain: GainNode;
  /** Glock shimmer / sparkle bus: octave doubling and closing runs. */
  private readonly sparkGain: GainNode;
  private readonly noise: AudioBuffer;
  private lullabyStep = 0;
  /** Last generated counter-melody note, for stepwise voice leading. */
  private counterNote = 0;
  private baseLevel = 0;
  private isTronTrack = false;
  private isChipTrack = false;
  private viralGlissandoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    reverbSend: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    // Master compressor: glues the mix, adds cinematic punch and loudness
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 9000;
    this.filter.Q.value = 0.4;
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.bus.connect(this.filter);
    this.filter.connect(comp);
    comp.connect(this.duckGain);
    this.duckGain.connect(destination);
    // Post-fader send: music volume, mode and event ducking control the wet
    // signal too. Per-note sends used to bypass all three (even at volume 0).
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0.22;
    this.duckGain.connect(this.wetGain);
    this.wetGain.connect(reverbSend);

    const mk = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.bus);
      return g;
    };
    this.ukeGain = mk(0.30);
    this.glockGain = mk(0.38);
    this.bassGain = mk(0.44);
    this.percGain = mk(0);
    this.whistleGain = mk(0);
    this.padGain = mk(0);
    this.lullabyGain = mk(0);
    this.tensionGain = mk(0);
    this.arpGain = mk(0);
    this.organGain = mk(0);
    this.tronGain = mk(0);
    this.chipGain = mk(0);
    this.sparkGain = mk(0);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.buildOrder();
    this.section = this.order[0] ?? 0;
    this.syncFamilyFlags();
  }

  setMode(mode: MusicMode): void {
    if (mode === this.targetMode) return;
    this.targetMode = mode;
    this.apply();
  }

  setNight(t: number): void {
    this.night = Math.max(0, Math.min(1, t));
    this.recomputeCutoff(0.6);
  }

  /** Continuous intensity — opens the filter, speeds up tempo, and adds a tension hat layer. */
  setIntensity(v: number): void {
    this.intensityRaw = Math.max(0, Math.min(1, v));
    this.applyIntensity();
  }

  /**
   * Music pass 3 — arrangement sections: tell the score where the flight is and
   * the band re-arranges itself around it.
   *
   * Intensity alone could only ride one arrangement louder, which is why
   * adaptive game music so often reads as "the same loop, turned up". This is
   * the other half: the take-off gets a breath with the kit held back, the top
   * of a flight brightens and thins the bed, and a landing loses its rhythm
   * section so the run resolves on a cadence instead of a cut. The decision is
   * pure and lives in `MusicArrangement.ts`; this method only carries the run
   * clock and applies the result.
   *
   * Cheap enough to call every frame: it returns without touching the graph
   * unless the phase actually changed.
   */
  setRunPhase(inRun: boolean, runSeconds: number): void {
    const now = this.ctx.currentTime;
    if (inRun) {
      this.runEndedAt = null;
    } else if (this.inRun && this.runEndedAt === null) {
      this.runEndedAt = now; // just landed — open the cadence window
    }
    this.inRun = inRun;
    this.runClock = Number.isFinite(runSeconds) ? Math.max(0, runSeconds) : 0;
    const m = this.targetMode;
    const next = runPhase({
      context: m === "sleep" ? "sleep" : m === "menu" || m === "off" ? "menu" : "flight",
      inRun,
      runSeconds: this.runClock,
      sinceEnd: this.runEndedAt === null ? Number.POSITIVE_INFINITY : Math.max(0, now - this.runEndedAt),
      intensity: this.intensityTarget,
      previous: this.phase,
    });
    if (next === this.phase) return;
    this.arrGlide = arrangementGlide(this.phase, next);
    this.phase = next;
    this.apply();
  }

  /** Which arrangement phase the band is in — read by tests and diagnostics,
   * never by the mixer itself. */
  getRunPhase(): RunPhase {
    return this.phase;
  }

  /**
   * Moment reaction: a temporary intensity offset that decays back to whatever
   * the game is asking for. BOING and PANIC push up, PHEW pulls down. The boost
   * never changes the underlying tempo floor of an arcade track beyond the same
   * 10% surge intensity already owns, so a comedy beat cannot make the flight
   * feel slower — it can only make the band lean in.
   */
  pushIntensity(delta: number, seconds: number): void {
    if (this.baseLevel <= 0) return;
    const s = Math.max(0.2, Math.min(4, seconds));
    this.intensityBoost = Math.max(-0.5, Math.min(0.6, delta));
    this.applyIntensity();
    if (this.boostTimer !== null) clearTimeout(this.boostTimer);
    this.boostTimer = setTimeout(() => {
      this.intensityBoost = 0;
      this.boostTimer = null;
      this.applyIntensity();
    }, s * 1000);
  }

  private applyIntensity(): void {
    const t = Math.max(0, Math.min(1, this.intensityRaw + this.intensityBoost));
    if (Math.abs(t - this.intensityTarget) < 0.01) return;
    this.intensityTarget = t;
    const now = this.ctx.currentTime;
    // The tension layer rides up quickly for responsiveness, decays a touch
    // slower so a big moment lingers after the peak.
    const style = BIOME_MIX[this.biome];
    // Arcade tracks hold their own tempo floor; intensity adds the same 10%
    // surge on top for island tracks.
    const baseBpm = this.isChipTrack
      ? (this.mode === "fever" ? 184 : 164)
      : (this.mode === "fever" ? style.fever : style.bpm);
    this.bpm = Math.round(baseBpm * (1 + t * 0.10));
    // The hats are part of the rhythm section: a resolve that keeps an offbeat
    // hi-hat ticking under a ringing pad is the mistake the arrangement exists
    // to prevent, so this layer follows the phase like every other family.
    this.tensionGain.gain.setTargetAtTime(
      t * 0.24 * style.perc * arrangement(this.phase).tension,
      now,
      t > this.intensity ? 0.1 : 0.4,
    );
    this.recomputeCutoff(0.3);
  }

  /** Sidechain compressor pumping effect for viral EDM rhythm bounce. */
  sidechainPump(duckAmount = 0.35, duration = 0.12): void {
    if (this.baseLevel <= 0) return;
    const t = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setValueAtTime(1 - duckAmount, t);
    this.duckGain.gain.exponentialRampToValueAtTime(1, t + duration);
  }

  /** Viral beat drop & sub-bass impact for high combo launches and fever triggers. */
  triggerBeatDrop(intensityMult = 1.0): void {
    if (this.baseLevel <= 0) return;
    const t = this.ctx.currentTime;
    // 1. Sub-bass drop sweep
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(130 * intensityMult, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    subG.gain.setValueAtTime(0.0001, t);
    subG.gain.exponentialRampToValueAtTime(0.65, t + 0.008);
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    sub.connect(subG);
    subG.connect(this.bus);
    sub.start(t);
    sub.stop(t + 0.6);

    // 2. Rhythmic sidechain pump
    this.sidechainPump(0.45, 0.22);
  }

  /** Viral pitch glissando / star-power glide during boost or fever onset. */
  triggerViralGlissando(): void {
    if (this.viralGlissandoTimer !== null) clearTimeout(this.viralGlissandoTimer);
    const originalTranspose = this.transpose;
    this.transpose += 2;
    this.viralGlissandoTimer = setTimeout(() => {
      this.transpose = originalTranspose;
      this.viralGlissandoTimer = null;
    }, 1400);
  }

  /**
   * BONK. The cartoon face-plant: one hard pump to clear the mix, then a
   * descending sawtooth sag through a closing lowpass — the "wah-wah-waaaah"
   * the band has been holding in since the first crash. Pitch falls a perfect
   * fifth over 0.7 s, which is the interval a slide whistle uses for a joke.
   */
  faceplant(): void {
    if (this.baseLevel <= 0) return;
    const t = this.ctx.currentTime;
    this.sidechainPump(0.55, 0.28);
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    lp.type = "lowpass";
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + 0.75);
    const base = mtof(67 + this.transpose); // G4, following the track's key
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * Math.pow(2, -7 / 12), t + 0.7);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.85);
  }

  /**
   * SPLOSH. The whole bus goes underwater — the filter drops toward 340 Hz,
   * which is roughly where a submerged ear loses the melody — then surfaces
   * back to the cutoff the biome, night value and intensity actually want.
   * Restoring to a *computed* target (not to a remembered number) means a
   * splash during a fever still comes up bright.
   */
  underwater(seconds = 0.9): void {
    if (this.baseLevel <= 0) return;
    const s = Math.max(0.25, Math.min(2.5, seconds));
    const t = this.ctx.currentTime;
    const target = musicCutoff(
      BIOME_MIX[this.biome].cutoff, this.night, this.intensityTarget, this.ctx.sampleRate,
    );
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(Math.max(200, this.filter.frequency.value), t);
    this.filter.frequency.exponentialRampToValueAtTime(340, t + s * 0.35);
    this.filter.frequency.exponentialRampToValueAtTime(target, t + s);
    // Keep the bookkeeping honest: `recomputeCutoff` skips updates within 12 Hz
    // of `lastCutoff`, and a manual sweep would otherwise leave it stale.
    this.lastCutoff = target;
    if (this.underwaterTimer !== null) clearTimeout(this.underwaterTimer);
    this.underwaterTimer = setTimeout(() => {
      this.underwaterTimer = null;
      this.recomputeCutoff(0.25);
    }, s * 1000 + 40);
  }

  /**
   * PERFECT / RECORD. A rising glockenspiel run on the shimmer bus — six notes
   * up a major arpeggio, each slightly softer than the last so it reads as a
   * lift rather than a fanfare, and scheduled against the audio clock so a
   * throttled timer cannot bunch them.
   */
  sparkle(seconds = 0.6): void {
    if (this.baseLevel <= 0) return;
    const s = Math.max(0.2, Math.min(1.6, seconds));
    const t0 = this.ctx.currentTime + 0.02;
    const steps = [0, 4, 7, 12, 16, 19];
    const base = mtof(84 + this.transpose); // C6
    const gap = s / steps.length;
    steps.forEach((semi, i) => {
      this.glock(t0 + i * gap, base * Math.pow(2, semi / 12), 0.5 - i * 0.04, this.sparkGain);
    });
  }

  private recomputeCutoff(ramp: number): void {
    const cutoff = musicCutoff(BIOME_MIX[this.biome].cutoff, this.night, this.intensityTarget, this.ctx.sampleRate);
    if (Math.abs(cutoff - this.lastCutoff) < 12) return;
    this.lastCutoff = cutoff;
    this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, ramp);
  }

  setLevel(level: number): void {
    this.baseLevel = level;
    this.apply();
  }

  setBiome(style: BiomeMusicStyle): void {
    if (style === this.biome) return;
    this.biome = style;
    this.apply();
  }

  /** Pin a single track (0..TRACK_NAMES.length-1) or "shuffle" to cycle all. */
  setTrack(sel: number | "shuffle"): void {
    this.trackSel = sel;
    this.buildOrder();
    this.orderPos = 0;
    this.section = this.order[0] ?? 0;
    this.syncFamilyFlags();
    // If we're sounding, re-apply immediately: a fresh family (island ↔ chip
    // ↔ tron) must change gains and tempo NOW, not at the next section flip.
    if (this.timer !== null) this.apply();
    if (this.timer !== null) this.onTrackChange?.(TRACKS[this.section]!.name);
  }

  get trackName(): string {
    return TRACKS[this.section]?.name ?? "";
  }

  /** Re-derive the instrumentation family flags from the current section. */
  private syncFamilyFlags(): void {
    const sec = TRACKS[this.section]!;
    const nowTron = sec.prog === PROG_TRON;
    const nowChip = sec.chip === true;
    this.isTronTrack = nowTron;
    this.isChipTrack = nowChip;
  }

  private buildOrder(): void {
    if (this.trackSel === "shuffle") {
      // Weighted draw without replacement: tracks whose mood matches the
      // current biome come up sooner, nightfall favors night tracks and
      // suppresses bright ones — but every track still plays each pass.
      const pool = Array.from({ length: TRACKS.length }, (_, i) => i);
      this.order = [];
      while (pool.length) {
        const weights = pool.map((i) => this.trackWeight(i));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let pick = 0;
        for (let i = 0; i < pool.length; i++) {
          r -= weights[i]!;
          if (r <= 0) {
            pick = i;
            break;
          }
        }
        this.order.push(pool[pick]!);
        pool.splice(pick, 1);
      }
      // Avoid opening on the track we just finished.
      if (this.order.length > 1 && this.order[0] === this.section) {
        const tmp = this.order[0]!;
        this.order[0] = this.order[1]!;
        this.order[1] = tmp;
      }
    } else {
      this.order = [this.trackSel];
    }
  }

  /** Sampling weight for a track given the current biome and time of day. */
  private trackWeight(index: number): number {
    const track = TRACKS[index]!;
    const mood = track.mood;
    // Arcade chiptune bangers are the default front line: weighted above the
    // island-folk tracks so shuffle mode opens on them, but below a perfect
    // biome match so the authored island tracks still surface.
    if (track.chip) {
      if (mood === this.biome) return 3.2;
      if (this.night > 0.6 && mood === "night") return 3.0; // Pixel Coast at night
      return 2.6;
    }
    if (mood === this.biome) return 3; // authored for this island
    if (this.night > 0.6) {
      if (mood === "night") return 2.5; // nightfall pulls toward the moon tracks
      if (mood === "bright" || mood === "airy") return 0.35; // and away from sun
    }
    return 1;
  }

  duck(amount = 0.45, release = 0.5): void {
    const t = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setTargetAtTime(1 - amount, t, 0.02);
    this.duckGain.gain.setTargetAtTime(1, t + 0.12, release);
  }

  dispose(): void {
    if (this.viralGlissandoTimer !== null) {
      clearTimeout(this.viralGlissandoTimer);
      this.viralGlissandoTimer = null;
    }
    if (this.boostTimer !== null) {
      clearTimeout(this.boostTimer);
      this.boostTimer = null;
    }
    if (this.underwaterTimer !== null) {
      clearTimeout(this.underwaterTimer);
      this.underwaterTimer = null;
    }
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.bus.disconnect();
    this.filter.disconnect();
    this.duckGain.disconnect();
    this.wetGain.disconnect();
    this.tronGain.disconnect();
    this.chipGain.disconnect();
    this.sparkGain.disconnect();
  }

  private apply(): void {
    const t = this.ctx.currentTime;
    const arr = arrangement(this.phase);
    const glide = this.arrGlide;
    /** Every family gain goes through here so a phase change can move the whole
     * band on one time constant (`arrangementGlide`) while any other `apply()`
     * keeps the constants this mix was tuned with. */
    const mix = (param: AudioParam, value: number, tc: number): void => {
      param.setTargetAtTime(value, t, glide === null ? tc : Math.max(0.05, glide));
    };
    const m = this.targetMode;
    const on = this.baseLevel > 0 && m !== "off";
    this.bus.gain.setTargetAtTime(on ? this.baseLevel : 0, t, 0.5);

    const style = BIOME_MIX[this.biome];
    this.transpose = style.transpose;
    const song = m === "menu" || m === "play" || m === "fever" || m === "storm";
    // Arcade tracks run their own faster tempo; everything else follows the biome.
    const chipBpm = this.isChipTrack ? (m === "fever" ? 184 : 164) : (m === "fever" ? style.fever : style.bpm);
    // Fever: glock leads more prominently (it's the hook the ear remembers).
    // Island layers stay silent on arcade tracks — square lead + chip bass own
    // the mix, with the glock shimmer on top.
    // Ukulele / pad / organ are island colours: silent under the arcade chiptune.
    const island = this.isChipTrack ? 0 : 1;
    mix(this.ukeGain.gain, (song ? (m === "menu" ? 0.30 : m === "fever" ? 0.26 : 0.32) * style.uke * island : 0) * arr.uke, 0.4);
    // The glock is the lead voice — on EVERY family. It used to be gated to
    // the island tracks (gain 0 on the arcade ten, which left the square wave
    // carrying the tune there and made those tracks sound cheap).
    mix(
      this.glockGain.gain,
      (song
        ? this.isChipTrack
          ? m === "menu" ? 0.38 : m === "fever" ? 0.50 : 0.46
          : (m === "menu" ? 0.42 : m === "fever" ? 0.50 : 0.46) * style.glock
        : 0) * arr.glock,
      0.4,
    );
    mix(this.bassGain.gain, (song ? (m === "fever" ? 0.48 : 0.42) * style.bass : 0) * arr.bass, 0.4);
    // Kit: every family gets drums in the menu, because a silent menu reads as
    // "something is broken". Arcade keeps the busier pattern below.
    const percBase = m === "play" ? (this.isChipTrack ? 0.22 : 0.18) : m === "fever" ? 0.36 : m === "storm" ? 0.46 : m === "menu" ? (this.isChipTrack ? 0.30 : 0.14) : 0;
    mix(this.percGain.gain, percBase * style.perc * arr.perc, 0.3);
    // Whistle: the soaring counter-line. Fever is its solo, play gives it a
    // gentle harmony line, menu leaves it out.
    mix(this.whistleGain.gain, (m === "fever" ? 0.30 : m === "play" ? 0.18 : m === "menu" ? 0.10 : 0) * style.whistle * island * arr.whistle, 0.3);
    mix(this.arpGain.gain, (m === "fever" ? 0.18 : m === "play" ? 0.09 : m === "menu" ? 0.05 : 0) * style.glock * island * arr.arp, 0.5);
    // Organ: deep pad under play and fever only — never a drone on the menu.
    mix(this.organGain.gain, (m === "play" ? 0.10 : m === "fever" ? 0.18 : m === "menu" ? 0.05 : 0) * island * arr.organ, 1.2);
    // Warm pad bed: strongest on the menu, subtle underneath play.
    // Sleep keeps a warm bed under the lullaby bells, so the dozing-off screen
    // is the same band playing quietly rather than a different, thinner one.
    mix(
      this.padGain.gain,
      (m === "sleep" ? 0.18 : (m === "menu" ? 0.16 : m === "play" ? 0.06 : 0) * island) * arr.pad,
      0.8,
    );
    // Tron synth: the dark bed under the bell now, not the lead it once was.
    mix(this.tronGain.gain, (this.isTronTrack && song ? (m === "fever" ? 0.28 : 0.22) : 0) * arr.tron, 0.4);
    // Arcade chiptune lead: a supporting halo under the glock melody.
    mix(this.chipGain.gain, (this.isChipTrack && song ? (m === "menu" ? 0.15 : m === "fever" ? 0.21 : 0.17) : 0) * arr.chip, 0.4);
    // Glock shimmer: octave doubling on the arcade family and the melody
    // sparkle on everything, so the bells are always part of the mix.
    mix(
      this.sparkGain.gain,
      (song ? (this.isChipTrack ? (m === "fever" ? 0.22 : 0.17) : (m === "fever" ? 0.34 : 0.26) * style.glock) : 0) * arr.spark,
      0.45,
    );
    this.lullabyGain.gain.setTargetAtTime(m === "sleep" ? 0.3 : 0, t, 0.6);
    const cutoff = musicCutoff(style.cutoff, this.night, this.intensityTarget, this.ctx.sampleRate);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.55);
    this.lastCutoff = cutoff;
    this.bpm = chipBpm;

    this.arrGlide = null;
    this.mode = m;
    if (on && this.timer === null) this.start();
    if (!on && this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private start(): void {
    if (this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.step = 0;
    this.bar = 0;
    this.buildOrder();
    this.orderPos = 0;
    this.section = this.order[0] ?? 0;
    this.syncFamilyFlags();
    this.lullabyStep = 0;
    this.counterNote = 0;
    if (this.mode !== "sleep") this.onTrackChange?.(TRACKS[this.section]!.name);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    if (this.ctx.state !== "running") return;
    // Smooth the intensity so the hat layer swells instead of stuttering.
    this.intensity += (this.intensityTarget - this.intensity) * 0.12;
    const now = this.ctx.currentTime;
    // If the timer was throttled (background tab, occluded window, locked
    // phone) the sequencer will be far behind. Re-anchor so we skip the missed
    // music rather than dumping the whole backlog onto the audio clock at once.
    this.nextTime = clampSequencerTime(this.nextTime, now);
    let scheduled = 0;
    while (this.nextTime < now + LOOKAHEAD && scheduled < MAX_STEPS_PER_TICK) {
      // Never hand Web Audio a timestamp in the past: it plays immediately, so
      // every missed step would stack into one percussive burst.
      const t = Math.max(this.nextTime, now + 0.001);
      if (this.mode === "sleep") this.scheduleLullaby(t);
      else this.scheduleStep(t);
      this.advance();
      scheduled++;
    }
  }

  private advance(): void {
    const beat = 60 / this.bpm;
    const swing = this.mode === "sleep" ? 0.5 : 0.56;
    const dur = this.step % 2 === 0 ? beat * swing : beat * (1 - swing);
    this.nextTime += this.mode === "sleep" ? beat * 0.75 : dur;
    this.step += 1;
    if (this.step >= 8) {
      this.step = 0;
      this.bar += 1;
      if (this.bar >= 8) {
        this.bar = 0;
        this.orderPos = (this.orderPos + 1) % this.order.length;
        // Reshuffle when a full shuffle cycle completes, so no two passes
        // repeat the same sequence.
        if (this.orderPos === 0 && this.trackSel === "shuffle") this.buildOrder();
        this.section = this.order[this.orderPos]!;
        // Update the instrumentation family when the section changes; only
        // adjust gains if the family (island / tron / chip) actually flipped.
        const wasTron = this.isTronTrack;
        const wasChip = this.isChipTrack;
        this.syncFamilyFlags();
        if (wasTron !== this.isTronTrack || wasChip !== this.isChipTrack) {
          this.apply();
        }
        // Sleep mode plays the lullaby, not the track — don't announce a
        // "now playing" title for music the player can't hear.
        if (this.mode !== "sleep") this.onTrackChange?.(TRACKS[this.section]!.name);
      }
    }
  }

  private scheduleStep(t: number): void {
    // Storm mode pulls the whole song down a minor third — same melody,
    // completely different weather.
    const stormShift = this.mode === "storm" ? -3 : 0;
    const sec = TRACKS[this.section]!;
    const chordName = sec.prog[this.bar]!;
    const chord = UKE[chordName]!;
    const idx = this.bar * 8 + this.step;
    const beat = 60 / this.bpm;

    // Chord pad: ensemble strings swell once per bar (island tracks only)
    if (!this.isChipTrack && this.step === 0 && (this.mode === "menu" || this.mode === "play")) this.pad(t, chordName, beat * 4);

    // Menu-only birdsong: an occasional far-away sparkle chirp
    if (!this.isChipTrack && this.mode === "menu" && this.step === 6 && Math.random() < 0.3) {
      this.birdsong(t + Math.random() * beat * 0.5);
    }

    // Chord strum (island tracks) or Tron chord pulse
    const strum = STRUM[this.step]!;
    if (strum && !this.isTronTrack && !this.isChipTrack) {
      const accent = this.step === 0 ? 1 : this.step === 4 ? 0.85 : 0.65;
      const order = strum === 1 ? chord : [...chord].reverse();
      order.forEach((m, i) => this.pluck(t + i * 0.011 + Math.random() * 0.004, mtof(m + this.transpose + stormShift), accent * (0.7 + 0.3 * Math.random())));
    } else if (strum && this.isTronTrack && this.step === 0) {
      // Tron: staccato chord stab on beat 1 only
      chord.forEach((m) => this.tronStab(t, mtof(m + this.transpose + stormShift), beat * 0.18));
    }

    // Bass: island = root on 1, fifth or root on 3, occasional walk-up on 8;
    // arcade = relentless root/octave pump on every eighth — the 8-bit drive.
    if (this.isChipTrack) {
      const root = mtof(BASS_ROOT[chordName]! + this.transpose + stormShift);
      const oct = mtof(BASS_ROOT[chordName]! + 12 + this.transpose + stormShift);
      if (this.step % 2 === 0) this.chipBass(t, root, beat * 0.42, this.step === 0 ? 1 : 0.85);
      else this.chipBass(t, oct, beat * 0.26, 0.55);
    } else {
      if (this.step === 0) this.bass(t, mtof(BASS_ROOT[chordName]! + this.transpose + stormShift), beat * 0.9);
      if (this.step === 4) this.bass(t, mtof(BASS_ROOT[chordName]! + (this.bar % 2 ? 7 : 0) + this.transpose + stormShift), beat * 0.8);
      if (this.step === 7 && this.bar % 4 === 3) this.bass(t, mtof(BASS_ROOT[chordName]! + 5 + this.transpose + stormShift), beat * 0.4);
    }

    // Melody: the glockenspiel lead on every family (island tracks play it
    // straight; the Tron tracks hand the same line to the synth; arcade tracks
    // put the square-wave hook in front with the bells doubling it).
    const note = sec.mel[idx] ?? 0;
    if (note > 0) {
      const noteFreq = mtof(note + this.transpose + stormShift);
      const vel = this.step === 0 ? 1 : this.step % 4 === 0 ? 0.9 : 0.8;
      if (this.isTronTrack) {
        // The synth keeps the Tron texture, but the bell now doubles it at
        // pitch (not only an octave above) so the tune reads as a melody line
        // rather than a filtered pulse.
        this.tronLead(t, noteFreq, beat * 0.85, vel * 0.9);
        this.glockLead(t, noteFreq, vel * 0.72);
      } else if (this.isChipTrack) {
        let len = 1;
        while ((sec.mel[idx + len] ?? 0) === -1) len++;
        // Arcade tracks used to hand the tune to the square wave and sprinkle
        // bells on top — precisely the thin, cheap sound the mix was pulled up
        // for. Inverted: the glockenspiel states the melody, the chip lead is
        // the 8-bit halo underneath it.
        this.glockLead(t, noteFreq, vel);
        this.chipLead(t, noteFreq, Math.min(beat * 0.24 * len, beat * 0.9), vel * 0.5);
      } else {
        this.glockLead(t, noteFreq, vel);
      }
    }

    // Phrase-end flourish: a quick glock run up the chord on the last bar of
    // each 4-bar phrase, so sections hand over with a lift instead of a gap.
    if (this.step === 6 && this.bar % 4 === 3 && (this.mode === "menu" || this.mode === "play" || this.mode === "fever")) {
      this.glockSparkle(t, chordName, beat, stormShift);
    }

    // Percussion
    if (this.isChipTrack) {
      // Arcade kit: 2-&-4 backbeat, driving 8th hats, present on the menu too.
      const light = this.mode === "menu" ? 0.75 : 1;
      this.hat(t, (this.step % 2 === 0 ? 0.2 : 0.14) * light, 7800);
      if (this.step === 0 || this.step === 4) {
        this.kick(t, (this.step === 0 ? 1 : 0.85) * light);
        if (this.mode === "fever" || this.intensity > 0.5) this.sidechainPump(0.22 + this.intensity * 0.18, 0.11);
      }
      if (this.step === 2 || this.step === 6) {
        this.snare(t, (this.mode === "fever" ? 0.9 : 0.68) * light);
        if (this.mode === "fever") this.clap(t);
      }
      // Momentum: ghost kick into the downbeat once a run is underway.
      if ((this.mode === "play" || this.mode === "fever" || this.mode === "storm") && this.step === 7) this.kick(t, 0.58 * light);
      if (this.mode === "storm" && (this.step === 2 || this.step === 6)) this.kick(t, 0.5 * light);
      if (this.mode === "fever" && this.step === 3) this.hat(t, 0.22 * light, 5200);
    } else if (this.mode === "menu" || this.mode === "play" || this.mode === "fever" || this.mode === "storm") {
      // Upbeat pop kit on the island family: kick on 1 & 3, snare/clap on the
      // 2 & 4 backbeat, shaker on the offbeats. The menu runs the same groove
      // at a lighter weight — a menu that never moves is what "dull" sounds
      // like. Fever earns the full-strength version.
      const menu = this.mode === "menu";
      const groove = menu ? 0.6 : this.mode === "play" ? 0.9 : 1;
      if (!menu || this.step % 2 === 0) this.shaker(t, (this.step % 2 === 0 ? 0.48 : 0.26) * groove);
      if (this.step === 0 || this.step === 4) {
        this.kick(t, (this.step === 0 ? 1 : 0.82) * groove);
        if (this.mode === "fever" || this.intensity > 0.5) {
          this.sidechainPump(0.20 + this.intensity * 0.18, 0.11);
        }
      }
      // Backbeat: the snare/clap pair that makes the whole thing bounce.
      if (this.step === 2 || this.step === 6) {
        const accent = (this.mode === "fever" ? 0.9 : menu ? 0.42 : 0.66) * groove;
        this.snare(t, accent);
        if (this.mode === "fever" || this.mode === "storm" || this.intensity > 0.6) this.clap(t);
      }
      // Eighth-note bell hats keep the pulse ticking under the melody.
      this.hat(t, (menu ? 0.10 : 0.16) * groove, 8200);
      // Snare on 2&4 (steps 2 and 6) in fever — the heartbeat that locks the groove.
      if (this.mode === "fever" && (this.step === 2 || this.step === 6)) {
        this.clap(t);
        this.snare(t, 0.9);
      }
      // Open hi-hat on the "and" of 2 in fever (step 3) — the sizzle between beats.
      if (this.mode === "fever" && this.step === 3) this.hat(t, 0.22, 5000);
      // Snare accent in high-intensity play (not full fever yet — building tension).
      if (this.mode === "play" && this.intensity > 0.7 && (this.step === 2 || this.step === 6)) {
        this.snare(t, 0.4 + this.intensity * 0.3);
      }
      // Storm: relentless — kicks on every other eighth, like weather that won't quit.
      if (this.mode === "storm" && (this.step === 2 || this.step === 6)) this.kick(t, 0.58);
      if (this.step === 7 && this.bar % 2 === 1) this.shaker(t + beat * 0.22, 0.42);

      // Tension layer: offbeat hats that swell with intensity (SSX-style adaptive).
      if (this.intensity > 0.05 && this.step % 2 === 1) {
        this.hat(t, 0.1 + this.intensity * 0.28, 6400 + this.intensity * 2600);
      }
      if (this.mode === "fever" && this.intensity > 0.6 && (this.step === 2 || this.step === 6)) {
        this.hat(t + beat * 0.5, 0.08 + (this.intensity - 0.6) * 0.3, 8400);
      }
    }

    // Organ: Interstellar-style deep swell on bar starts in play/fever.
    if (!this.isChipTrack && (this.mode === "play" || this.mode === "fever") && this.step === 0 && this.bar % 2 === 0) {
      this.organ(t, chordName, beat * 8);
    }

    // Bell arpeggio. In fever it is a Celeste-style fill on both offbeats; the
    // menu and play get a single turn per bar on the second half of the phrase
    // so the bells keep moving between melody notes without crowding them.
    const arpTurn =
      (this.mode === "fever" && (this.step === 1 || this.step === 5) && this.intensity > 0.3) ||
      ((this.mode === "play" || this.mode === "menu") && this.step === 5 && this.bar % 2 === 1);
    if (!this.isChipTrack && arpTurn) {
      // Walk the chord upward instead of repeating one note: the arp is a
      // melodic voice, not a ping.
      const voicing = UKE[chordName] ?? UKE.C!;
      const pick = voicing[(this.bar + this.step) % voicing.length] ?? 60;
      this.arp(t, mtof(pick + 24 + this.transpose + stormShift), beat * 0.9);
    }

    // Counter-melody — derived from the harmony rather than fixed to one line.
    //
    // The old WHISTLE / WHISTLE_B pair was written against an earlier set of
    // melodies and was later switched back on in menu and play; measured
    // against the current tunes it collided with the lead on 183 eighths,
    // including direct semitone clashes. A counter-line that cannot be checked
    // against every progression should not be hand-authored at all: this one
    // is picked per eighth from the bar's own chord voicing, always the tone
    // nearest the previous counter note (so it moves stepwise), and only where
    // the melody is holding or resting — so it can never collide with the lead
    // in any key, on any track, in any order the shuffle deals.
    if (!this.isChipTrack && (this.mode === "fever" || this.mode === "play" || this.mode === "menu")) {
      const counter = this.counterStep(chordName, idx, note);
      if (counter > 0) {
        const vel = this.mode === "fever" ? 1 : this.mode === "play" ? 0.72 : 0.52;
        this.whistle(t, mtof(counter + this.transpose + stormShift), beat * 0.75, vel);
      }
    }
  }

  /**
   * The dozing-off music. It used to be a bare sine arpeggio — a different
   * instrument from everything else in the game, which is exactly the kind of
   * seam the consistency pass is closing. Now it is the same glockenspiel
   * playing slower and softer, over a warm pad: the night sounds like Sunbird
   * winding down, not like a different game.
   */
  private scheduleLullaby(t: number): void {
    const arp = [72, 76, 79, 84, 83, 79, 76, 72];
    const beat = 60 / (this.bpm || BEAT_BPM);
    const m = arp[this.lullabyStep % arp.length]!;
    const idx = this.lullabyStep;
    this.lullabyStep += 1;
    this.glock(t, mtof(m + this.transpose), 0.44, this.lullabyGain);
    // A low bell on the first beat of every bar, and the pad swells under it.
    if (idx % 4 === 0) this.glock(t, mtof(m - 12 + this.transpose), 0.3, this.lullabyGain);
    if (idx % 8 === 0) this.pad(t, "C", beat * 8);
  }

  /* ---------- instruments ---------- */

  /** Ensemble strings: 7 detuned sawtooth oscillators per chord note — the
   *  same algorithm all hardware string synthesizers use. Slow attack (0.5s)
   *  creates the characteristic swell; wide chorus detune = lushness. */
  private pad(t: number, chordName: string, dur: number): void {
    const root = (BASS_ROOT[chordName] ?? 48) + 12 + this.transpose;
    const notes = [root, root + 7, root + 12];
    const detunes = [-14, -8, -3, 0, 3, 8, 14]; // 7 oscillators = chorus ensemble
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.45); // slow string attack
    g.gain.setValueAtTime(0.28, t + dur * 0.78);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.08);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2200; // let harmonics through — real string quality
    f.Q.value = 0.3;
    g.connect(f);
    f.connect(this.padGain);
    for (const m of notes) {
      for (const det of detunes) {
        const o = this.ctx.createOscillator();
        const og = this.ctx.createGain();
        o.type = "sawtooth";
        o.frequency.value = mtof(m) * Math.pow(2, det / 1200);
        og.gain.value = 0.11 / detunes.length;
        o.connect(og);
        og.connect(g);
        o.start(t);
        o.stop(t + dur * 1.12);
      }
    }
  }

  /** Distant two-note bird chirp for the menu — pure decoration. */
  private birdsong(t: number): void {
    const base = 2200 + Math.random() * 900;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.92, t + 0.11);
    o.frequency.exponentialRampToValueAtTime(base * 1.18, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(this.glockGain);
    o.start(t);
    o.stop(t + 0.25);
  }


  private pluck(t: number, freq: number, vel: number): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o2.type = "sawtooth";
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.003;
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.4, t + 0.25);
    f.Q.value = 1.2;
    const peak = 0.22 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    const mix2 = this.ctx.createGain();
    mix2.gain.value = 0.28;
    o.connect(f);
    o2.connect(mix2);
    mix2.connect(f);
    f.connect(g);
    g.connect(this.ukeGain);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.6);
    o2.stop(t + 0.6);
  }

  /**
   * Glockenspiel: additive bar-partial synthesis (see GLOCK_PARTIALS).
   *
   * Every partial is its own sine with its own decay, plus a whisper of
   * filtered noise for the mallet "tick". The result is the bright, sweet,
   * bell-like lead the whole score is built around — no FM clang, no
   * detuned saw stack. `bus` lets the sparkle layer route through its own
   * gain so the island lead fader stays independent.
   */
  private glock(t: number, freq: number, vel: number, bus?: GainNode): void {
    const target = bus ?? this.glockGain;
    const peak = 0.5 * vel;
    const attack = 0.0025;
    const out = this.ctx.createGain();
    out.gain.value = 1;
    out.connect(target);

    for (const p of GLOCK_PARTIALS) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq * p.ratio;
      const amp = peak * p.amp;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp, t + attack);
      og.gain.exponentialRampToValueAtTime(amp * 0.35, t + p.decay * 0.35);
      og.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
      o.connect(og);
      og.connect(out);
      o.start(t);
      o.stop(t + p.decay + 0.05);
    }

    // Mallet strike: a breath of band-passed noise on the attack only.
    const strike = this.ctx.createBufferSource();
    strike.buffer = this.noise;
    const sf = this.ctx.createBiquadFilter();
    sf.type = "bandpass";
    sf.frequency.value = Math.min(9000, Math.max(1200, freq * 4));
    sf.Q.value = 1.1;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.001);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    strike.connect(sf);
    sf.connect(sg);
    sg.connect(out);
    strike.start(t);
    strike.stop(t + 0.09);
  }

  /** Melody lead: glock note + an octave shimmer on the sparkle bus. This is
   *  the "little bell on top of everything" that makes the tune carry. */
  private glockLead(t: number, freq: number, vel: number): void {
    this.glock(t, freq, vel);
    this.glock(t, freq * 2, vel * 0.26, this.sparkGain);
  }

  /** Closing flourish: a fast run up the chord tones, glock-only. */
  private glockSparkle(t: number, chordName: string, beat: number, stormShift: number): void {
    const chord = UKE[chordName] ?? UKE.C!;
    const tones = [...chord].map((m) => m + 12 + this.transpose + stormShift).sort((a, b) => a - b);
    const run = [...tones.slice(0, 3), tones[2]! + 5, tones[3]!, tones[3]! + 4];
    run.forEach((m, i) => this.glock(t + i * beat * 0.16, mtof(m), 0.5 - i * 0.04, this.sparkGain));
  }


  /**
   * One step of the generated counter-line: the chord tone nearest the last
   * counter note, placed only where the lead is silent (a hold or a rest).
   * Returns 0 for "no counter note here". The register sits an octave under
   * the glock lead, where the whistle reads as a second voice rather than a
   * second lead, and the whole thing is a pure function of (chord, step,
   * melody) plus the previous note — which is what makes it safe to run
   * against all 30 tracks.
   */
  private counterStep(chordName: string, idx: number, melody: number): number {
    // Follow the lead's phrasing: fill the gaps, stay out of the way where the
    // melody is already speaking.
    if (melody > 0) return 0;
    // The answer phrase sits a third higher so the two halves differ.
    const phrase = this.bar < 4 ? 0 : 3;
    const voicing = UKE[chordName] ?? UKE.C!;
    const candidates = voicing
      .map((m) => m + 12 + phrase) // up an octave: under the glock, over the uke
      .filter((m) => m >= 64 && m <= 88);
    if (!candidates.length) return 0;
    const prev = this.counterNote || candidates[0]!;
    let best = candidates[0]!;
    for (const c of candidates) if (Math.abs(c - prev) < Math.abs(best - prev)) best = c;
    // Every other eighth at most, so the line breathes instead of chattering.
    if (idx % 2 === 1 && Math.abs(best - prev) > 4) return 0;
    this.counterNote = best;
    return best;
  }

  /** `vel` scales the voice only — the bus gain stays a mix decision. */
  private whistle(t: number, freq: number, dur: number, vel = 1): void {
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    lfo.type = "sine";
    lfo.frequency.value = 5.6;
    lfoG.gain.value = freq * 0.012;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    const peak = 0.5 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
    g.gain.setValueAtTime(peak, t + Math.max(0.06, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    const breath = this.ctx.createBufferSource();
    breath.buffer = this.noise;
    const bf = this.ctx.createBiquadFilter();
    bf.type = "bandpass";
    bf.frequency.value = freq;
    bf.Q.value = 12;
    const bg = this.ctx.createGain();
    bg.gain.value = 0.08;
    breath.connect(bf);
    bf.connect(bg);
    bg.connect(g);
    o.connect(g);
    g.connect(this.whistleGain);
    o.start(t);
    lfo.start(t);
    breath.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
    breath.stop(t + dur + 0.1);
  }

  /** Deep bass: sub sine one octave down + fundamental sine + harmonic triangle.
   *  The sub-octave adds the chest-punch felt in Zimmer/Tron scores. */
  private bass(t: number, freq: number, dur: number): void {
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 580;
    f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // Sub: one octave down (the Zimmer low-end weight)
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.value = freq * 0.5;
    subG.gain.value = 0.55;
    sub.connect(subG);
    subG.connect(f);

    // Fundamental
    const fund = this.ctx.createOscillator();
    fund.type = "sine";
    fund.frequency.value = freq;

    // Harmonic layer for definition
    const harm = this.ctx.createOscillator();
    const harmG = this.ctx.createGain();
    harm.type = "triangle";
    harm.frequency.value = freq;
    harmG.gain.value = 0.28;
    harm.connect(harmG);
    harmG.connect(f);

    fund.connect(f);
    f.connect(g);
    g.connect(this.bassGain);

    sub.start(t);   sub.stop(t + dur + 0.03);
    fund.start(t);  fund.stop(t + dur + 0.03);
    harm.start(t);  harm.stop(t + dur + 0.03);
  }

  private shaker(t: number, vel: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1 + Math.random() * 0.1;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 5200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f);
    f.connect(g);
    g.connect(this.percGain);
    src.start(t);
    src.stop(t + 0.1);
  }

  /** Bright, short hi-hat — the intensity layer's heartbeat. */
  private hat(t: number, vel: number, freq: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1 + Math.random() * 0.08;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(f);
    f.connect(g);
    g.connect(this.tensionGain);
    src.start(t);
    src.stop(t + 0.06);
  }

  private kick(t: number, vel: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    // Punchier: higher start (180Hz), deeper finish (32Hz), bigger peak
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.72 * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g);
    g.connect(this.percGain);
    o.start(t);
    o.stop(t + 0.26);
  }

  /** Snare: noise burst + short tone hit (adds crack on 2&4 in fever). */
  private snare(t: number, vel: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(bp);
    bp.connect(hp);
    hp.connect(g);
    g.connect(this.percGain);
    // Tone crack
    const tone = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(200, t);
    tone.frequency.exponentialRampToValueAtTime(90, t + 0.05);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.002);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    tone.connect(tg);
    tg.connect(this.percGain);
    src.start(t);
    src.stop(t + 0.18);
    tone.start(t);
    tone.stop(t + 0.1);
  }

  /** Short arpeggio burst: 4 quick notes up from root. Celeste-style fill. */
  private arp(t: number, baseFreq: number, dur: number): void {
    const intervals = [0, 4, 7, 12]; // root, third, fifth, octave
    const stepDur = dur * 0.22;
    for (let i = 0; i < 4; i++) {
      const freq = baseFreq * Math.pow(2, intervals[i]! / 12);
      const nt = t + i * stepDur;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, nt);
      g.gain.exponentialRampToValueAtTime(0.38, nt + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, nt + stepDur * 0.85);
      o.connect(g);
      g.connect(this.arpGain);
      o.start(nt);
      o.stop(nt + stepDur + 0.01);
    }
  }

  /** Interstellar-style organ drone: 3 detuned sines + soft tremolo. */
  private organ(t: number, chordName: string, dur: number): void {
    const root = (BASS_ROOT[chordName] ?? 48) + this.transpose;
    // Root + major 2nd + fifth (open, cinematic voicing like Zimmer's pipe organ)
    const pitches = [root, root + 7, root + 12, root + 19];
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.38, t + dur * 0.18);
    g.gain.setValueAtTime(0.38, t + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    // Slow tremolo (Zimmer's pipe organ breathes at ~3 Hz)
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 2.8;
    lfoG.gain.value = 0.06;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 600;
    g.connect(filt);
    filt.connect(this.organGain);
    for (const pitch of pitches) {
      for (const det of [-2, 0, 2]) {
        const o = this.ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = mtof(pitch) * Math.pow(2, det / 1200);
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 0.15);
      }
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.15);
  }

  /** Tron lead synth: Daft Punk / Tron Legacy sound.
   *  Sawtooth carrier through a sharp resonant lowpass that opens on attack,
   *  creating the classic "electronic filter sweep" sound of the Grid. */
  private tronLead(t: number, freq: number, dur: number, vel: number): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o2.type = "square";
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.005; // slight detune for width
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 12, t);     // bright attack
    f.frequency.exponentialRampToValueAtTime(freq * 2.5, t + 0.08); // filter closes
    f.Q.value = 3.5; // resonant peak = electronic character
    const peak = 0.46 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005); // hard attack
    g.gain.exponentialRampToValueAtTime(peak * 0.65, t + 0.04);
    g.gain.setValueAtTime(peak * 0.65, t + Math.max(0.05, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const mix2 = this.ctx.createGain();
    mix2.gain.value = 0.3;
    o.connect(f);
    o2.connect(mix2);
    mix2.connect(f);
    f.connect(g);
    g.connect(this.tronGain);
    o.start(t);  o.stop(t + dur + 0.02);
    o2.start(t); o2.stop(t + dur + 0.02);
  }

  /** Tron chord stab: short percussive hit used on beat 1 of Tron tracks. */
  private tronStab(t: number, freq: number, dur: number): void {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 8, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.8, t + 0.04);
    f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.tronGain);
    o.start(t); o.stop(t + dur + 0.01);
  }

  /** Arcade chiptune lead: two detuned square waves through a bright,
   * resonant filter — the classic 8-bit hook voice. Staccato by default;
   * `dur` extends it for held notes. */
  private chipLead(t: number, freq: number, dur: number, vel: number): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "square";
    o2.type = "square";
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.006; // slight detune for width
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 14, t);          // bright attack
    f.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 3.4), t + Math.min(dur, 0.16));
    f.Q.value = 2.2;
    const peak = 0.34 * vel;
    const sustain = Math.max(0.04, dur - 0.035);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004); // hard attack
    g.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.05);
    g.gain.setValueAtTime(peak * 0.7, t + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.01);
    const mix2 = this.ctx.createGain();
    mix2.gain.value = 0.35;
    o.connect(f);
    o2.connect(mix2);
    mix2.connect(f);
    f.connect(g);
    g.connect(this.chipGain);
    o.start(t); o.stop(t + dur + 0.03);
    o2.start(t); o2.stop(t + dur + 0.03);
  }

  /** Arcade chiptune bass: short, punchy square through a lowpass — the
   * driving 8-bit root/octave pump under the hook. */
  private chipBass(t: number, freq: number, dur: number, vel: number): void {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(480, t + Math.max(0.02, dur));
    f.Q.value = 0.9;
    const peak = 0.5 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.bassGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private clap(t: number): void {
    for (let i = 0; i < 3; i++) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1500;
      f.Q.value = 0.9;
      const g = this.ctx.createGain();
      const tt = t + i * 0.012;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.2, tt + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.16 : 0.04));
      src.connect(f);
      f.connect(g);
      g.connect(this.percGain);
      src.start(tt);
      src.stop(tt + 0.2);
    }
  }
}
