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
 */
export type MusicMode = "off" | "menu" | "play" | "fever" | "sleep" | "storm";
export type BiomeMusicStyle = "bright" | "warm" | "airy" | "wide" | "night" | "crystal" | "reef" | "ember" | "canyon" | "amethyst";
import { TICK_MS, LOOKAHEAD, MAX_STEPS_PER_TICK } from "./audio-constants";
import { runPhase as computeRunPhase, arrangement, arrangementGlide, ARR, type ArrangementContext, type RunPhase } from "./MusicArrangement";

type Voicing = number[];

const BEAT_BPM = 132;
/** Arcade tracks hold their own tempo floor, independent of the biome. */
const CHIP_BPM = 176;
const CHIP_FEVER_BPM = 196;
/** Tempo surge at intensity 1, as a fraction of the mode's tempo. */
const TEMPO_SURGE = 0.1;
/** Level of the offbeat tension hats at intensity 1, before the biome's perc. */
const TENSION_HATS = 0.24;

/**
 * The modes that mean "a flight is under way".
 *
 * Gameplay flips the music mode at every state change, and the engine already
 * sees that flip — so the transition *into* this set is the score's run-start
 * signal and the transition out of it is the landing, with no per-frame hook
 * needed from the game. `fever` and `storm` are inside the set on purpose: a
 * fever surge and a stormfront happen *during* a flight, and treating them as
 * take-offs would restart the run clock on every combo.
 */
const FLIGHT_MODES: ReadonlySet<MusicMode> = new Set<MusicMode>(["play", "fever", "storm"]);

/**
 * Intensity follower time constants, in seconds. The rise is quicker than the
 * fall so a moment registers immediately and then lingers.
 */
export const INTENSITY_RISE = 0.12;
export const INTENSITY_FALL = 0.34;
/**
 * Filter re-target dead-band in Hz. Below this the ear cannot hear a step, and
 * skipping the write keeps a per-frame call from queueing AudioParam events the
 * hardware would throw away.
 */
const CUTOFF_DEADBAND = 12;
/** Same idea for the tension hats, in linear gain. */
const HAT_DEADBAND = 0.002;

/**
 * One step of the intensity follower, as a pure function of elapsed time.
 *
 * A fixed `lerp(current, target, 0.12)` per tick is only correct at exactly the
 * tick rate it was tuned for. Browsers clamp `setInterval` to >= 1 s in a
 * backgrounded or occluded tab, so the same 0.12 that is a ~0.2 s glide at
 * 25 ms becomes a ~2.4 s glide at 1 s — the score then reacts to the run in
 * slow motion after the player switches back. Exponentiating the *elapsed*
 * time makes the response rate independent of how often we are called, so the
 * filter, the hats, the tempo and the arrangement all arrive together however
 * the browser throttled us.
 *
 * Exported for unit testing; it is pure.
 */
export function intensityFollow(
  current: number,
  target: number,
  dt: number,
  rise = INTENSITY_RISE,
  fall = INTENSITY_FALL,
): number {
  if (!Number.isFinite(current)) return Number.isFinite(target) ? target : 0;
  if (!Number.isFinite(target)) return current;
  const tau = target > current ? rise : fall;
  const step = dt > 0 ? 1 - Math.exp(-dt / tau) : 0;
  return current + (target - current) * Math.min(1, step);
}
/**
 * How many times a section's 8-bar progression plays before the next section.
 *
 * At 132 BPM one pass is ~14.5s. Two passes (~29s) lets a tune land and then
 * naturally hands off: pass 0 states the melody, pass 1 lifts it an octave and
 * the phrase breathes — then a fresh track arrives before the ear tires of the
 * loop. Tracks rotate more frequently, giving the "constantly discovering music"
 * feel of viral game soundtracks.
 */
const PASSES_PER_SECTION = 2;
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
/**
 * Marimba/xylophone bar partials — Yoshi's Island warmth, not bell ringing.
 * Short decays (0.45s fundamental vs 1.9s for a glock) give the bouncy
 * "tok tok tok" of a wooden marimba instead of sustained metallic shimmer.
 * The inharmonic ratio set stays (1 : 2.76 : 5.40 : 8.93) but everything
 * dies much faster so notes pop and breathe instead of bleeding together.
 */
export const GLOCK_PARTIALS: { ratio: number; amp: number; decay: number }[] = [
  { ratio: 1.0,   amp: 1.0,  decay: 0.45 },
  { ratio: 2.756, amp: 0.30, decay: 0.20 },
  { ratio: 5.404, amp: 0.10, decay: 0.10 },
  { ratio: 8.933, amp: 0.03, decay: 0.05 },
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

const PROG_A = ["C", "G", "Am", "F", "C", "G", "F", "G"];
// PROG_K: cinematic minor. Am → F → C → G — a slow-building, emotive climb.
const PROG_K = ["Am", "F", "C", "G", "Am", "F", "C", "G"];
const PROG_B = ["Am", "F", "C", "G", "Am", "F", "C", "G"];
const PROG_C = ["F", "G", "Em", "Am", "F", "G", "C", "C"];
const PROG_D = ["Dm", "G", "C", "Am", "F", "G", "G", "C"];
const PROG_E = ["C", "Am", "F", "G", "C", "Am", "F", "G"];
// PROG_F: night drift. Antecedent Am–Em–F–C; consequent departs to G–Am cadence
// (modal v–i; no harmonic-minor V–i since E major is outside the melodic contract).
const PROG_F = ["Am", "Em", "F", "C", "F", "G", "Em", "Am"];
// PROG_G: crystal sparkle. Adds G–Am cadence so the loop resolves.
const PROG_G = ["C", "G", "Dm", "Am", "C", "Am", "G", "Am"];
const PROG_H = ["G", "C", "Am", "F", "C", "Am", "G", "C"];
const PROG_I = ["F", "C", "Dm", "G", "Am", "F", "G", "C"];
const PROG_J = ["Am", "C", "G", "F", "F", "G", "Em", "Am"];
// PROG_TRON: dark electronic. Am → Dm → Gm → Em — all minor,
// no major relief. Creates a tense, circuit-board claustrophobia.
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

// Track 5 — Night Circuit: neon synth line. Punchy, on-the-grid, lifted ending.
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

// Track 11 — Live Wire: neon riff with a real hook over the dark-electronic progression.
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
const MEL_P = [
  72, 0, 76, 76, 79, 0, 84, -1,
  83, 0, 81, 81, 79, 0, 76, -1,
  77, 0, 81, 81, 84, 0, 86, -1,
  84, 0, 83, 83, 79, 0, 74, -1,
  88, 0, 84, 84, 79, 0, 84, -1,
  86, 0, 84, 84, 81, 0, 79, -1,
  81, 0, 84, 84, 86, 0, 88, -1,
  86, -1, 84, 0, 83, -1, -1, 0,
];

// Track 17 — Skybound Rise: hypnotic build that never sits still — rising pairs.
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

// Track 18 — Clockwork Wing: ticking eighths with a tune inside the pulse.
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

// Track 19 — Last Light: anthemic outro. Big, slow-blooming, heroic.
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

// Track 20 — Pursuit: the chase riff. Doubled sixteenths, no let-up.
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
const PROG_CHIP_6 = ["Dm", "G", "C", "F", "Dm", "G", "F", "C"]; // ii–V–I–IV, ends F→C plagal

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
  // ── ARCADE CHIP FAMILY ── bouncy, hook-first 8-bit-style bangers
  { name: "Flappy Rush",     prog: PROG_CHIP_1, mel: MEL_CHIP_1, mood: "bright", chip: true },
  { name: "Coin Pop",        prog: PROG_CHIP_2, mel: MEL_CHIP_2, mood: "bright", chip: true },
  { name: "Hyper Glide",     prog: PROG_CHIP_3, mel: MEL_CHIP_3, mood: "airy",   chip: true },
  { name: "Bouncy Bird",     prog: PROG_K,      mel: MEL_CHIP_4, mood: "warm",   chip: true },
  { name: "Sunset Sprint",   prog: PROG_CHIP_5, mel: MEL_CHIP_5, mood: "wide",   chip: true },
  { name: "Pixel Coast",     prog: PROG_CHIP_6, mel: MEL_CHIP_6, mood: "night",  chip: true },
  { name: "Sugar Rush",      prog: PROG_CHIP_1, mel: MEL_CHIP_7, mood: "bright", chip: true },
  { name: "Neon Tail",       prog: PROG_CHIP_6, mel: MEL_CHIP_8, mood: "night",  chip: true },
  { name: "Turbo Finch",     prog: PROG_CHIP_5, mel: MEL_CHIP_9, mood: "warm",   chip: true },
  { name: "Moon Arcade",     prog: PROG_CHIP_7, mel: MEL_CHIP_10,mood: "ember",  chip: true },
  // ── ISLAND FOLK FAMILY ── ukulele, glockenspiel lead, whistle, upright bass
  { name: "Ascent",            prog: PROG_A, mel: MEL_A, mood: "bright"  },
  { name: "Voyage",            prog: PROG_B, mel: MEL_B, mood: "airy"    },
  { name: "Cathedral",         prog: PROG_C, mel: MEL_C, mood: "bright"  },
  { name: "Pendulum",          prog: PROG_D, mel: MEL_D, mood: "wide"    },
  { name: "Night Circuit",     prog: PROG_TRON, mel: MEL_E, mood: "night" },
  { name: "Eventide",          prog: PROG_F, mel: MEL_F, mood: "night"   },
  { name: "Glass & Stars",     prog: PROG_G, mel: MEL_G, mood: "crystal" },
  { name: "Trade Winds",       prog: PROG_H, mel: MEL_H, mood: "wide"    },
  { name: "Golden Hour",       prog: PROG_I, mel: MEL_I, mood: "warm"    },
  { name: "Starfall",          prog: PROG_J, mel: MEL_J, mood: "night"   },
  { name: "Live Wire",         prog: PROG_TRON, mel: MEL_K, mood: "ember" },
  { name: "Magma",             prog: PROG_F, mel: MEL_L, mood: "ember"   },
  { name: "Mesa",              prog: PROG_I, mel: MEL_M, mood: "canyon"  },
  { name: "Time's Light",      prog: PROG_K, mel: MEL_N, mood: "wide"    },
  { name: "Horizon Chase",     prog: PROG_H, mel: MEL_O, mood: "bright"  },
  { name: "Fever Dream",       prog: PROG_E, mel: MEL_P, mood: "reef"    },
  { name: "Skybound Rise",     prog: PROG_K, mel: MEL_Q, mood: "night"   },
  { name: "Clockwork Wing",    prog: PROG_J, mel: MEL_R, mood: "ember"   },
  { name: "Last Light",        prog: PROG_TRON, mel: MEL_S, mood: "night" },
  { name: "Pursuit",           prog: PROG_TRON, mel: MEL_T, mood: "ember" },
];

/** Track titles for the settings picker — keep in lockstep with TRACKS. */
export const TRACK_NAMES: string[] = TRACKS.map((t) => t.name);

/**
 * One world's musical identity.
 *
 * The first group is *level*: how loud, how fast, how bright, how far up. The
 * second group is *instrumentation*: which of the band's supporting voices are
 * actually in the room. Both are needed for a biome to be recognisable — level
 * alone makes nine worlds that all sound like the same tune played louder.
 */
export type BiomeMix = {
  bpm: number; fever: number; cutoff: number; transpose: number;
  uke: number; glock: number; bass: number; perc: number; whistle: number;
  /**
   * The supporting voices. These used to be borrowed from `glock` (arp, spark)
   * or not weighted at all (organ, pad), which meant all nine worlds shared one
   * set of pads, organs and arpeggios and could only be told apart by tempo and
   * volume. They are 1 for "as the engine tuned it", so a style that wants the
   * stock bed says 1 and nothing else has to change.
   */
  arp: number; organ: number; pad: number; spark: number;
};

// Per-biome orchestration keeps each island sonically distinct while all
// variants share the same original melodic identity.
export const BIOME_MIX: Record<BiomeMusicStyle, BiomeMix> = {
  // Upbeat floor: nothing in the library sits below 116 BPM, and every island
  // keeps a bright register (transposition stays inside ±4 semitones so the
  // glock lead never sinks into the bass).
  // `glock` is the BELL SPARKLE weight, and it can never exceed 1: the bells are
  // an octave doubling that sits *under* the voice carrying the tune (whistle,
  // uke, chip lead, or Grid synth), never the other way round. Values above 1
  // on the darker biomes (night/crystal/reef were 1.6–1.68) made exactly those
  // tracks read as glockenspiel solos — the score that "sometimes" sounded
  // wrong. Keep every row ≤ 1.
  // The `arp/organ/pad/spark` column is the world's *timbre*, matched to the
  // identity the gameplay lane gives it in `Biomes.ts`:
  //   bright  Green Hills      — clean teaching rhythm: open, light, nothing muddy
  //   warm    Sunset Ridge     — a warm Hammond bed smears the long 2× valleys
  //   airy    Tropical Atoll   — floating: sparkle and air, almost no weight below
  //   wide    Dune Sea         — colossal: a huge horizon pad, little inner motion
  //   night   Midnight Coast   — sparse and dark: everything glows faintly
  //   crystal Aurora Peaks     — glassy: the brightest bells, a glassy arp
  //   reef    Coral Reach      — pastel sparkle over a soft, close bed
  //   ember   Cinder Forge     — low and growling: the organ is the furnace
  //   canyon  Skyreach Canyon  — vast red walls: big pad, brassy bed
  // Dreamy, open, magical — slower base tempos let the ocarina breathe.
  // Fever still surges hard; the contrast is what makes it feel like a
  // transformation instead of just a tempo bump.
  bright:  { bpm: 130, fever: 158, cutoff: 5500, transpose: 0,  uke: 0.88, glock: 0.60, bass: 0.92, perc: 0.96, whistle: 1.00, arp: 1.00, organ: 0.85, pad: 0.70, spark: 1.00 },
  warm:    { bpm: 124, fever: 150, cutoff: 4500, transpose: -2,  uke: 1.04, glock: 0.52, bass: 1.00, perc: 0.92, whistle: 0.90, arp: 0.70, organ: 1.30, pad: 1.15, spark: 0.80 },
  airy:    { bpm: 132, fever: 160, cutoff: 6000, transpose: 2,   uke: 0.72, glock: 0.62, bass: 0.80, perc: 1.06, whistle: 1.08, arp: 1.35, organ: 0.60, pad: 1.25, spark: 1.10 },
  wide:    { bpm: 126, fever: 154, cutoff: 5000, transpose: -3,  uke: 0.78, glock: 0.54, bass: 1.10, perc: 0.94, whistle: 1.06, arp: 0.55, organ: 1.00, pad: 1.45, spark: 0.75 },
  night:   { bpm: 118, fever: 144, cutoff: 4000, transpose: -3,  uke: 0.56, glock: 0.44, bass: 0.74, perc: 0.80, whistle: 0.88, arp: 0.45, organ: 0.70, pad: 1.05, spark: 0.55 },
  crystal: { bpm: 130, fever: 158, cutoff: 6000, transpose: 3,   uke: 0.66, glock: 0.58, bass: 0.84, perc: 0.98, whistle: 1.18, arp: 1.20, organ: 0.65, pad: 0.90, spark: 1.45 },
  reef:    { bpm: 132, fever: 160, cutoff: 6500, transpose: 3,   uke: 0.70, glock: 0.58, bass: 0.78, perc: 0.88, whistle: 1.10, arp: 1.30, organ: 0.90, pad: 0.85, spark: 1.25 },
  ember:   { bpm: 122, fever: 148, cutoff: 4000, transpose: -4,  uke: 0.62, glock: 0.62, bass: 1.20, perc: 1.08, whistle: 0.88, arp: 0.60, organ: 1.40, pad: 0.60, spark: 0.70 },
  canyon:  { bpm: 128, fever: 156, cutoff: 5000, transpose: -2,  uke: 0.70, glock: 0.64, bass: 1.10, perc: 0.96, whistle: 1.08, arp: 0.95, organ: 1.15, pad: 1.30, spark: 1.00 },
  //   amethyst Amethyst Hollow — suspended in violet glass: the slowest base
  //   tempo, the widest pad, the brightest spark. Floaty like `wide`, glassy
  //   like `crystal`, but slower than both — the reward world takes its time.
  amethyst: { bpm: 116, fever: 148, cutoff: 5200, transpose: 5, uke: 0.55, glock: 0.75, bass: 0.78, perc: 0.82, whistle: 1.05, arp: 1.28, organ: 0.55, pad: 1.35, spark: 1.5 },
};

/** Keep every biome/night combination inside WebAudio's usable filter range. */
export function musicCutoff(base: number, night: number, intensity: number): number {
  return Math.max(500, Math.min(8000, base - night * 3000 + intensity * 1200));
}

/** Local copy of the MIDI→frequency formula (Songbook has its own for the
 * player): importing Songbook here would close a Biomes→Music→Songbook→Biomes
 * import cycle, so the one-liner stays duplicated by decision. */
function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class Music {
  private phase: RunPhase = "menu";
  private runSeconds = 0;
  private sinceEnd = Number.POSITIVE_INFINITY;
  /**
   * Audio-clock time the last flight ended, or `Infinity` if none has. The
   * "never" has to be a real infinity and not 0: `sinceEnd` is derived as
   * `now - lastEndTime`, and a 0 here would read as "a run ended at the start of
   * time", which drops a fresh engine straight into the landing cadence.
   */
  private lastEndTime = Number.POSITIVE_INFINITY;
  /** Audio-clock time at which the current flight took off. */
  private flightStart = 0;
  /**
   * True while a flight is under way. Derived from the music mode (see
   * `FLIGHT_MODES`) unless gameplay pins the run clock through `setRunPhase`.
   */
  private inFlight = false;
  /**
   * A run clock handed in by gameplay, or `null` to count the run on the audio
   * clock. One field decides *who owns the clock*, never a second arrangement
   * — both paths feed the one phase machine in `syncPhase()`.
   */
  private pinnedRunSeconds: number | null = null;
  private mode: MusicMode = "off";
  private targetMode: MusicMode = "off";
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  /** Which pass through the current section's progression this is (0-based, up
   *  to PASSES_PER_SECTION). Drives the arrangement variation so a longer stay
   *  develops rather than repeating. */
  private pass = 0;
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
  private lastCutoff = 5000;
  private lastHats = 0;
  /** Audio-clock time of the previous tick, so the follower is time-based. */
  private lastTick = 0;
  /** 0..1 — continuous intensity (speed / altitude / fever / danger / combos). */
  private intensity = 0;
  private intensityTarget = 0;
  /** Moment-driven intensity offset, decaying to 0 — see `pushIntensity`. */
  private intensityPush = 0;
  private intensityPushAtStart = 0;
  private intensityPushStarted = 0;
  private intensityPushUntil = 0;

  private readonly bus: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly saturate: WaveShaperNode;
  private readonly hissGain: GainNode;
  private readonly hissFilter: BiquadFilterNode;
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
  private hissSource: AudioBufferSourceNode | null = null;
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
    const hasSaturate = typeof ctx.createWaveShaper === "function";
    this.saturate = hasSaturate ? ctx.createWaveShaper() : (ctx.createGain() as unknown as WaveShaperNode);
    if (hasSaturate && this.saturate.curve !== undefined) {
      const tapeCurve = new Float32Array(44100);
      for (let i = 0; i < 44100; i++) {
        const x = (i * 2) / 44100 - 1;
        tapeCurve[i] = Math.tanh(x * 3) / Math.tanh(3);
      }
      this.saturate.curve = tapeCurve;
      this.saturate.oversample = "4x";
    }
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.bus.connect(this.filter);
    this.filter.connect(this.saturate);
    this.saturate.connect(comp);
    comp.connect(this.duckGain);
    this.duckGain.connect(destination);
    // Post-fader send: music volume, mode and event ducking control the wet
    // signal too. Per-note sends used to bypass all three (even at volume 0).
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0.30; // more room reverb = spacious, relaxing feel
    this.duckGain.connect(this.wetGain);
    this.wetGain.connect(reverbSend);

    const mk = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.bus);
      return g;
    };
    this.ukeGain = mk(0.30);
    this.glockGain = mk(0.06);
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

    this.hissFilter = ctx.createBiquadFilter();
    this.hissFilter.type = "highpass";
    this.hissFilter.frequency.value = 7000;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0.003;
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise;
    hiss.loop = true;
    hiss.connect(this.hissFilter);
    this.hissFilter.connect(this.hissGain);
    this.hissGain.connect(this.bus);
    hiss.start(0);
    this.hissSource = hiss;

    this.buildOrder();
    this.section = this.order[0] ?? 0;
    this.syncFamilyFlags();
  }

  setMode(mode: MusicMode): void {
    if (mode === this.targetMode) return;
    // The mode flip is the run signal. Stamp the clock *before* applying, so
    // the mix that lands on take-off is already arranged for the new phase.
    // Read the previous *mode* rather than the flight flag: a caller may have
    // pinned the run clock, and the mode is the authority on whether a flight
    // is under way.
    const wasFlight = FLIGHT_MODES.has(this.targetMode);
    const isFlight = FLIGHT_MODES.has(mode);
    if (isFlight && !wasFlight) this.flightStart = this.ctx.currentTime;
    if (!isFlight && wasFlight) this.lastEndTime = this.ctx.currentTime;
    this.inFlight = isFlight;
    // A mode change hands the clock back to the engine: if gameplay is pinning
    // a run clock it will say so again on its next call.
    this.pinnedRunSeconds = null;
    this.targetMode = mode;
    this.apply();
    this.syncPhase();
  }

  /**
   * Hand the score the run's own clock instead of letting it count on the audio
   * clock. Both sources drive the same phase machine, so this is a change of
   * clock, not a second arrangement. Used by the deterministic tests, and the
   * seam gameplay should use if it wants the score on the game's run clock
   * rather than the audio hardware's.
   */
  setRunPhase(inRun: boolean, runSeconds: number): void {
    const wasFlight = this.inFlight;
    this.inFlight = inRun;
    if (inRun) {
      this.pinnedRunSeconds = Math.max(0, runSeconds);
      if (!wasFlight) this.flightStart = this.ctx.currentTime - this.pinnedRunSeconds;
    } else {
      this.pinnedRunSeconds = null;
      if (wasFlight) this.lastEndTime = this.ctx.currentTime;
    }
    this.syncPhase();
  }

  getRunPhase(): RunPhase {
    return this.phase;
  }

  /**
   * Advance the run clock and re-decide the phase. The single place the phase
   * changes, whether the clock came from `setMode` or from `setRunPhase`.
   *
   * Two things here are deliberate. The apex decision reads the *smoothed*
   * intensity, not the raw target, so a one-frame spike the player never heard
   * arrive cannot throw the whole band into an arrangement and back. And a
   * re-arrangement is applied over `arrangementGlide()`, which is asymmetric on
   * purpose: voices arriving are quick enough to read as an entrance, voices
   * leaving slow enough to read as a release.
   */
  private syncPhase(): void {
    const now = this.ctx.currentTime;
    if (this.inFlight) {
      this.runSeconds = this.pinnedRunSeconds ?? Math.max(0, now - this.flightStart);
      this.sinceEnd = Number.POSITIVE_INFINITY;
    } else {
      this.runSeconds = 0;
      this.sinceEnd = Number.isFinite(this.lastEndTime)
        ? Math.max(0, now - this.lastEndTime)
        : Number.POSITIVE_INFINITY;
    }
    const context: ArrangementContext = this.mode === "sleep"
      ? "sleep"
      : this.inFlight || this.sinceEnd < ARR.resolveSeconds
        ? "flight"
        : "menu";
    const prev = this.phase;
    this.phase = computeRunPhase({
      context,
      inRun: this.inFlight,
      runSeconds: this.runSeconds,
      sinceEnd: this.sinceEnd,
      intensity: this.intensity,
      previous: prev,
    });
    if (this.phase !== prev && this.mode !== "off") {
      this.apply(arrangementGlide(prev, this.phase));
    }
  }

  setNight(t: number): void {
    this.night = Math.max(0, Math.min(1, t));
    this.recomputeCutoff(0.6);
  }

  /**
   * Continuous intensity — the arc's speed/altitude/fever/danger/combo number.
   *
   * Only the *target* moves here. Everything audible is derived from the
   * smoothed follower in the tick, so the filter, the hats, the tempo and the
   * arrangement can never disagree about how intense the run is. Writing them
   * from here instead is what made the filter open in 12 Hz staircases: the
   * target only moves in the 0.01 quanta of the early-out below, so the cutoff
   * jumped 12 Hz at a time while the rest of the mix glided.
   */
  setIntensity(v: number): void {
    const t = Math.max(0, Math.min(1, v));
    if (Math.abs(t - this.intensityTarget) < 0.01) return;
    this.intensityTarget = t;
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

  private recomputeCutoff(ramp: number): void {
    const cutoff = musicCutoff(BIOME_MIX[this.biome].cutoff, this.night, this.intensity);
    if (Math.abs(cutoff - this.lastCutoff) < CUTOFF_DEADBAND) return;
    this.lastCutoff = cutoff;
    this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, ramp);
  }

  /**
   * The tempo the score is playing at right now.
   *
   * One place, on purpose. `apply()` used to write `bpm` from the mode alone
   * while `setIntensity()` wrote it with the surge folded in, so every mode flip
   * — fever onset, a stormfront, landing on an island, pause and resume — wiped
   * the surge for a moment and then let it come back, which is a tempo step
   * exactly when the run is changing fastest. Deriving it every tick from the
   * smoothed intensity makes the surge continuous and un-clobbable.
   */
  private tempoFor(): number {
    const style = BIOME_MIX[this.biome];
    // Arcade tracks hold their own tempo floor; intensity adds the same surge
    // on top for island tracks.
    const base = this.isChipTrack
      ? (this.mode === "fever" ? CHIP_FEVER_BPM : CHIP_BPM)
      : (this.mode === "fever" ? style.fever : style.bpm);
    return Math.round(base * (1 + this.intensity * TEMPO_SURGE));
  }

  /**
   * Everything in the band that reacts to intensity, written from one smoothed
   * value: the tempo surge, the filter opening and the tension hats. `rising`
   * keeps the hats' asymmetric response — quick to arrive, slow to leave, so a
   * big moment lingers after the peak.
   */
  private applyIntensity(rising: boolean): void {
    this.bpm = this.tempoFor();
    this.recomputeCutoff(0.25);
    const hats = this.intensity * TENSION_HATS * BIOME_MIX[this.biome].perc;
    if (Math.abs(hats - this.lastHats) < HAT_DEADBAND) return;
    this.lastHats = hats;
    this.tensionGain.gain.setTargetAtTime(hats, this.ctx.currentTime, rising ? 0.1 : 0.4);
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

  // ---------------------------------------------------------------------------
  // Moment reactions — the four primitives `MusicMoments.ts` dispatches to.
  //
  // These exist so a comedy beat is a *musical* event and not only a sound
  // effect: the soundtrack used to play straight through a BONK. The shared
  // rule across all four is that none of them may slow the flight down. They
  // shape the score's brightness, pitch and level for a beat or two; none of
  // them touches tempo, which is what the player's hands are reading.
  // ---------------------------------------------------------------------------

  /** Cartoon descending sag + hard duck: the score face-plants with the bird. */
  faceplant(): void {
    if (this.baseLevel <= 0) return;
    // A pitch sag on the whole bus, restored from the same timer slot the
    // glissando uses rather than a second one — two timers fighting over
    // `transpose` would leave the score in the wrong key if a BONK landed
    // mid-glissando, so when one is running the sag is skipped, not queued.
    if (this.viralGlissandoTimer === null) {
      const home = this.transpose;
      this.transpose = home - 7;
      this.viralGlissandoTimer = setTimeout(() => {
        this.viralGlissandoTimer = null;
        this.transpose = home;
      }, 420);
    }
    this.duck(0.5, 0.45);
    this.sidechainPump(0.5, 0.24);
  }

  /** Muffle the whole bus low, then surface again — "you are in the sea". */
  underwater(seconds = 0.9): void {
    if (this.baseLevel <= 0) return;
    const t = this.ctx.currentTime;
    const f = this.filter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(240, t + 0.14);
    f.exponentialRampToValueAtTime(Math.max(240, this.lastCutoff), t + seconds);
    this.duck(0.3, 0.35);
  }

  /** Rising glockenspiel run — the bright lift a PERFECT or RECORD earns. */
  sparkle(seconds = 0.55): void {
    if (this.baseLevel <= 0) return;
    const t = this.ctx.currentTime;
    const notes = [1318.5, 1567.98, 1760, 2093]; // E6 G6 A6 C7
    notes.forEach((hz, i) => {
      const at = t + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(hz, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.16, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + seconds * 0.5);
      osc.connect(g);
      g.connect(this.bus);
      osc.start(at);
      osc.stop(at + seconds);
    });
  }

  /**
   * Temporary intensity offset that decays back to the game-driven value.
   *
   * Deliberately additive on top of `intensityTarget` rather than a replacement:
   * the game keeps driving the target every frame, so the push has to ride
   * along and fade, or it would either stomp the game's own value or be
   * immediately overwritten by it.
   */
  pushIntensity(delta: number, seconds: number): void {
    if (!Number.isFinite(delta) || !Number.isFinite(seconds) || seconds <= 0) return;
    const t = this.ctx.currentTime;
    // A second push inside an active window compounds and restarts the clock;
    // two moments in quick succession should stack, not truncate.
    const compounding = this.intensityPushUntil > t && this.intensityPush !== 0;
    this.intensityPush = compounding ? this.intensityPushAtStart + delta : delta;
    this.intensityPushAtStart = this.intensityPush;
    this.intensityPushStarted = t;
    this.intensityPushUntil = t + seconds;
  }

  dispose(): void {
    if (this.viralGlissandoTimer !== null) {
      clearTimeout(this.viralGlissandoTimer);
      this.viralGlissandoTimer = null;
    }
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.bus.disconnect();
    this.filter.disconnect();
    this.saturate.disconnect();
    this.duckGain.disconnect();
    this.wetGain.disconnect();
    this.hissGain.disconnect();
    this.hissFilter.disconnect();
    if (this.hissSource) this.hissSource.stop();
    this.tronGain.disconnect();
    this.chipGain.disconnect();
    this.sparkGain.disconnect();
  }

  /**
   * Re-target the whole mix. `glide` is the arrangement's own time constant and
   * is supplied only when the *phase* changed; every other caller (a mode flip,
   * a biome crossing, a track-family change, a level change) keeps the per-voice
   * ramps the engine was tuned with.
   */
  private apply(glide: number | null = null): void {
    const t = this.ctx.currentTime;
    const m = this.targetMode;
    const on = this.baseLevel > 0 && m !== "off";
    this.bus.gain.setTargetAtTime(on ? this.baseLevel : 0, t, 0.5);

    const style = BIOME_MIX[this.biome];
    this.transpose = style.transpose;
    const song = m === "menu" || m === "play" || m === "fever" || m === "storm";
    // Arcade tracks run their own faster tempo; everything else follows the biome.
    // Fever: glock leads more prominently (it's the hook the ear remembers).
    // Island layers stay silent on arcade tracks — square lead + chip bass own
    // the mix, with the glock shimmer on top.
    // Ukulele / pad / organ are island colours: silent under the arcade chiptune.
    const island = this.isChipTrack ? 0 : 1;
    const arr = arrangement(this.phase);
    // A re-arrangement glides over the phase's own time constant; everything
    // else falls back to the ramp this voice was tuned with.
    const r = (base: number): number => glide ?? base;
    this.ukeGain.gain.setTargetAtTime(song ? (m === "menu" ? 0.30 : m === "fever" ? 0.26 : 0.32) * style.uke * island * arr.uke : 0, t, r(0.4));
    // Marimba/xylophone accent — a subtle woody pop under the lead, not a
    // voice of its own. Kept very low so the square lead (chip), whistle
    // (island), or Tron synth can actually be heard.
    this.glockGain.gain.setTargetAtTime(
      song ? (m === "menu" ? 0.04 : m === "fever" ? 0.06 : 0.05) * style.glock * arr.glock : 0,
      t,
      r(0.4),
    );
    this.bassGain.gain.setTargetAtTime(song ? (m === "fever" ? 0.48 : 0.42) * style.bass * arr.bass : 0, t, r(0.4));
    const percBase = m === "play" ? (this.isChipTrack ? 0.22 : 0.18) : m === "fever" ? 0.36 : m === "storm" ? 0.46 : m === "menu" ? (this.isChipTrack ? 0.30 : 0.14) : 0;
    this.percGain.gain.setTargetAtTime(percBase * style.perc * arr.perc, t, r(0.3));
    this.whistleGain.gain.setTargetAtTime((m === "fever" ? 0.58 : m === "play" ? 0.50 : m === "menu" ? 0.36 : 0) * style.whistle * island * arr.whistle, t, r(0.3));
    this.arpGain.gain.setTargetAtTime((m === "fever" ? 0.06 : m === "play" ? 0.03 : m === "menu" ? 0.015 : 0) * style.arp * island * arr.arp, t, r(0.5));
    this.organGain.gain.setTargetAtTime((m === "play" ? 0.10 : m === "fever" ? 0.18 : m === "menu" ? 0.05 : 0) * style.organ * island * arr.organ, t, r(1.2));
    this.padGain.gain.setTargetAtTime(
      m === "sleep" ? 0.18 : (m === "menu" ? 0.16 : m === "play" ? 0.06 : 0) * style.pad * island * arr.pad,
      t,
      r(0.8),
    );
    this.tronGain.gain.setTargetAtTime(this.isTronTrack && song ? (m === "fever" ? 0.36 : 0.30) * arr.tron : 0, t, r(0.4));
    this.chipGain.gain.setTargetAtTime(this.isChipTrack && song ? (m === "menu" ? 0.38 : m === "fever" ? 0.52 : 0.44) * arr.chip : 0, t, r(0.4));
    this.sparkGain.gain.setTargetAtTime(
      song ? (this.isChipTrack ? (m === "fever" ? 0.06 : 0.04) * style.spark : (m === "fever" ? 0.04 : 0.03) * style.glock * style.spark) * arr.spark : 0,
      t,
      r(0.45),
    );
    this.lullabyGain.gain.setTargetAtTime(m === "sleep" ? 0.3 : 0, t, 0.6);
    this.recomputeCutoff(0.55);

    this.mode = m;
    this.bpm = this.tempoFor();

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
    this.pass = 0;
    this.buildOrder();
    this.orderPos = 0;
    this.section = this.order[0] ?? 0;
    this.syncFamilyFlags();
    this.lullabyStep = 0;
    this.counterNote = 0;
    // Seed the follower's clock so the first tick measures ~0 s rather than the
    // whole age of the AudioContext, which would snap the mix to its target.
    this.lastTick = this.ctx.currentTime;
    if (this.mode !== "sleep") this.onTrackChange?.(TRACKS[this.section]!.name);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    // One smoothed intensity, and everything that reacts to it reads the same
    // number: the filter, the hats, the tempo and the arrangement. Stepping it
    // on elapsed audio time rather than a fixed fraction per tick is what keeps
    // those four in agreement after the browser throttles our interval.
    const rising = this.intensityTarget > this.intensity;
    // The moment push rides ON TOP of whatever the game asked for and fades on
    // the audio clock, so a PANIC landing mid-run lifts the run it is reacting
    // to instead of replacing it. `intensityTarget` stays the pure game-driven
    // value — `setIntensity` owns it and is called every frame — so the sum is
    // taken here, at the one point all four intensity consumers already read
    // from. That keeps filter, hats, tempo and arrangement moving as one number.
    let target = this.intensityTarget;
    if (this.intensityPush !== 0) {
      if (this.intensityPushUntil <= now) {
        this.intensityPush = 0;
      } else {
        // Linear fade over the window the caller asked for.
        const span = Math.max(0.05, this.intensityPushUntil - this.intensityPushStarted);
        const left = this.intensityPushUntil - now;
        this.intensityPush = (this.intensityPushAtStart * left) / span;
        if (Math.abs(this.intensityPush) < 0.005) this.intensityPush = 0;
        target = Math.max(0, Math.min(1, target + this.intensityPush));
      }
    }
    this.intensity = intensityFollow(this.intensity, target, now - this.lastTick);
    this.lastTick = now;
    this.applyIntensity(rising);
    this.syncPhase();
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
    // Island tracks use 0.58 swing (groovier), chip tracks use 0.54 (tighter arcade feel)
    const swingBase = this.mode === "sleep" ? 0.5 : this.isChipTrack ? 0.54 : 0.58;
    const swing = swingBase;
    const dur = this.step % 2 === 0 ? beat * swing : beat * (1 - swing);
    this.nextTime += this.mode === "sleep" ? beat * 0.75 : dur;
    this.step += 1;
    if (this.step >= 8) {
      this.step = 0;
      this.bar += 1;
      if (this.bar >= 8) {
        this.bar = 0;
        // Stay on this section for PASSES_PER_SECTION passes before moving on,
        // so the tune is heard as a phrase instead of flickering past.
        this.pass += 1;
        if (this.pass >= PASSES_PER_SECTION) {
          this.pass = 0;
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

    // Chord pad: ensemble strings swell once per bar (island tracks only).
    // On the menu, swell on every bar for a lush ambient bed.
    // In play, swell every other bar — present but not overwhelming.
    if (!this.isChipTrack && this.step === 0) {
      if (this.mode === "menu") this.pad(t, chordName, beat * 5.5);
      else if ((this.mode === "play" || this.mode === "fever") && this.bar % 2 === 0) this.pad(t, chordName, beat * 4.5);
    }

    // Birdsong: menu gets it more often for a relaxing ambient feel;
    // play mode adds an occasional chirp so the world feels alive mid-flight.
    if (!this.isChipTrack && this.step === 6 && Math.random() < (this.mode === "menu" ? 0.5 : 0.15)) {
      this.birdsong(t + Math.random() * beat * 0.5);
      if (this.mode === "menu" && Math.random() < 0.3) this.birdsong(t + beat * 0.7 + Math.random() * beat * 0.3);
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
      // Walk-up: every 4 bars on step 7 + pass 1 also adds a chromatic passing
      // tone on step 6, so the second pass has busier bass movement.
      if (this.step === 7 && this.bar % 4 === 3) this.bass(t, mtof(BASS_ROOT[chordName]! + 5 + this.transpose + stormShift), beat * 0.4);
      if (this.step === 6 && this.pass === 1 && this.bar % 2 === 1) {
        const nextBar = (this.bar + 1) % 8;
        const nextChord = sec.prog[nextBar]!;
        // chromatic passing tone: one semitone below the next root
        this.bass(t, mtof((BASS_ROOT[nextChord] ?? BASS_ROOT[chordName]!) - 1 + this.transpose + stormShift), beat * 0.35);
      }
    }

    // Melody: the glockenspiel lead on every family (island tracks play it
    // straight; the Tron tracks hand the same line to the synth; arcade tracks
    // put the square-wave hook in front with the bells doubling it).
    //
    // The line develops across the section's passes rather than repeating
    // verbatim: pass 0 states it as written, pass 1 lifts it an octave, and the
    // final pass thins it to the on-beat notes and drops out for the last half
    // of the last bar. That gives the ~44s stay a shape — state, lift, breathe —
    // and the tacet lands the phrase end before the next section, instead of a
    // hard cut mid-melody.
    // Whimsy: a four-note ascending twinkle closes each pass. It is built from
    // the chord's own voicing two octaves up, so it is consonant by construction
    // and cannot clash with a minor chord the way a fixed major arpeggio would;
    // it plays through the shimmer voice the score already uses for bells, so it
    // reads as the same instrument grinning rather than a new layer. On the final
    // pass it fills exactly the half-bar the melody now leaves open, so the
    // phrase still breathes — it just breathes upward instead of going quiet.
    // Phrase-end turnaround: a quick 4-note ascending run on the last half of
    // bar 7 bridges back to the start — the phrase resolves UP instead of just
    // stopping, which is why real game OSTs never feel looped.
    if (this.bar === 7 && this.step === 4) {
      const runNotes = [chord[0]!, chord[1] ?? chord[0]!, chord[2] ?? chord[0]!, chord[3] ?? chord[0]!];
      const octShift = this.isChipTrack ? 0 : 12;
      runNotes.forEach((m, i) => {
        const delay = i * beat * 0.22;
        const freq = mtof(m + octShift + this.transpose + stormShift);
        if (this.isChipTrack) {
          this.chipLead(t + delay, freq, beat * 0.18, 0.55);
        } else {
          this.glock(t + delay, freq, 0.28, this.sparkGain);
        }
      });
    }
    const lastPass = this.pass === PASSES_PER_SECTION - 1;
    const breath = lastPass && this.bar === 7 && this.step >= 4;
    const authored = sec.mel[idx] ?? 0;
    const thinned = lastPass && this.step % 2 === 1;
    const note = breath || thinned ? 0 : authored;
    if (note > 0) {
      const noteFreq = mtof(note + (this.pass === 1 ? 12 : 0) + this.transpose + stormShift);
      const vel = this.step === 0 ? 1 : this.step % 4 === 0 ? 0.9 : 0.8;
      // The glockenspiel is a SHIMMER LAYER, never the voice carrying the tune.
      // Leading with bells on every family made the whole score read as one
      // instrument — and a bright, percussive one at that, which is tiring over
      // a long flight. Each family keeps its own lead voice (breathy whistle on
      // the islands, square lead on the arcade tracks, synth on the Grid) and
      // the bell doubles it an octave up, quietly.
      if (this.isTronTrack) {
        this.tronLead(t, noteFreq, beat * 0.85, vel);
        // tiny marimba accent on downbeats only
        if (this.step === 0) this.glock(t, noteFreq, vel * 0.10, this.sparkGain);
      } else if (this.isChipTrack) {
        let len = 1;
        while ((sec.mel[idx + len] ?? 0) === -1) len++;
        this.chipLead(t, noteFreq, Math.min(beat * 0.24 * len, beat * 0.9), vel);
        // no doubling on chip — square lead owns the hook
      } else {
        let len = 1;
        while ((sec.mel[idx + len] ?? 0) === -1) len++;
        const noteDur = Math.min(beat * 0.5 * len * 0.95, beat * 1.9);
        this.whistle(t, noteFreq, noteDur, vel);
        // Harmony voice: a diatonic 3rd below, in play mode, at low volume.
        // Two voices richer than one lead = "lush island OST" feeling.
        if ((this.mode === "play" || this.mode === "fever") && len >= 2) {
          const harmNote = note - 4; // minor 3rd below — always consonant in major/minor
          this.whistle(t, mtof(harmNote + (this.pass === 1 ? 12 : 0) + this.transpose + stormShift), noteDur, vel * 0.30);
        }
        // tiny marimba pop on strong beats (1 and 3) only
        if (this.step === 0 || this.step === 4) this.glock(t, noteFreq, vel * 0.09, this.sparkGain);
      }
    }

    // (phrase-end glock sparkle removed — was too much bell ringing)

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
      // Drum fill: on bar 3 and 7 step 6, a burst of quick 16th hats + snare
      // builds excitement into the next bar — the classic arcade "fill" moment.
      if ((this.bar === 3 || this.bar === 7) && this.step === 6 && (this.mode === "play" || this.mode === "fever")) {
        for (let f = 0; f < 3; f++) this.hat(t + f * beat * 0.22, 0.18 * light, 7400);
        this.snare(t + beat * 0.5, 0.55 * light);
      }
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

    // Biome color: a unique ornament per style so each world sounds distinct.
    // Airy/reef/crystal → a high sparkle trill on the "and" of bar 2 and 6.
    // Night/ember → a low sub-tone accent on bar 1 and 5 beat 1.
    if (!this.isChipTrack && (this.mode === "play" || this.mode === "fever")) {
      if ((this.biome === "airy" || this.biome === "reef" || this.biome === "crystal") && this.step === 1 && (this.bar === 2 || this.bar === 6)) {
        const sparkFreq = mtof((chord[0] ?? 60) + 24 + this.transpose + stormShift);
        this.glock(t, sparkFreq, 0.35, this.sparkGain);
        this.glock(t + beat * 0.24, sparkFreq * Math.pow(2, 2 / 12), 0.22, this.sparkGain);
      }
      if ((this.biome === "night" || this.biome === "ember") && this.step === 0 && (this.bar === 1 || this.bar === 5)) {
        // Low organ accent — warmth without drums
        this.organ(t, chordName, beat * 2);
      }
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

  /**
   * Accordion chord pad — Yoshi's Island warm harmony layer.
   * Three detuned triangle waves per chord note (narrow chorus detune) with a
   * fast attack and a medium-length hold, then a short release. Much lighter
   * than the old string ensemble: it supports the melody without swamping it.
   */
  /** Lush string pad: slow 0.18s attack, lowpass 900 Hz — the Steven Universe warm swell.
   *  Voiced as root+5th+octave+9th (open voicing) for a dreamy, airy quality. */
  private pad(t: number, chordName: string, dur: number): void {
    const root = (BASS_ROOT[chordName] ?? 48) + 12 + this.transpose;
    // Open voicing: root, 5th, octave, 9th — avoids muddy 3rds in the mid-register
    const notes = [root, root + 7, root + 12, root + 14];
    notes.forEach((m, i) => {
      const o = this.ctx.createOscillator();
      const fl = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = i % 2 === 0 ? "sine" : "triangle"; // alternating = silky blend
      o.frequency.value = mtof(m);
      fl.type = "lowpass";
      fl.frequency.value = 1100;
      o.connect(fl); fl.connect(g); g.connect(this.padGain);
      // 9th is quieter — it adds shimmer, not volume
      const vol = (0.07 / notes.length) * (i === 3 ? 0.55 : 1);
      g.gain.setValueAtTime(0.00008, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.22); // slightly slower swell
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.6), t + 0.22 + dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.00008, t + 0.22 + dur * 0.45 + dur * 0.55);
      o.start(t); o.stop(t + dur + 0.18);
    });
  }

  /** Distant bird chirp — 3 random patterns for variety. */
  private birdsong(t: number): void {
    const base = 1800 + Math.random() * 1400;
    const pattern = Math.floor(Math.random() * 3);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    if (pattern === 0) {
      // rising two-note call
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.32, t + 0.08);
      o.frequency.setValueAtTime(base * 1.32, t + 0.10);
      o.frequency.exponentialRampToValueAtTime(base * 0.0001, t + 0.10); // cut
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    } else if (pattern === 1) {
      // three-note twitter: up, down, up
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.18, t + 0.04);
      o.frequency.exponentialRampToValueAtTime(base * 0.88, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(base * 1.22, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.038, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.025, t + 0.07);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    } else {
      // quick descending slide — like a distant warbler
      o.frequency.setValueAtTime(base * 1.4, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.032, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    }
    o.connect(g);
    g.connect(this.glockGain);
    o.start(t);
    o.stop(t + 0.22);
  }


  /**
   * Steel drum / marimba chord pluck — Yoshi's Island signature strum sound.
   * Three additive sine partials (1:2.756:5.4 — inharmonic steel drum ratios)
   * with a fast decay so each "ding" pops and doesn't blur the next one.
   * Strummed one note at a time (with the 11ms delay in the caller) = the
   * classic Yoshi upstroke or downstroke chord hit.
   */
  private pluck(t: number, freq: number, vel: number): void {
    const partials = [
      { ratio: 1.0,   amp: 1.0,  decay: 0.32 },
      { ratio: 2.756, amp: 0.35, decay: 0.14 },
      { ratio: 5.404, amp: 0.12, decay: 0.06 },
    ];
    const peak = 0.22 * vel;
    const out = this.ctx.createGain();
    out.gain.value = 1;
    out.connect(this.ukeGain);
    for (const p of partials) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq * p.ratio;
      const amp = peak * p.amp;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
      o.connect(og);
      og.connect(out);
      o.start(t);
      o.stop(t + p.decay + 0.03);
    }
    // Mallet knock — wooden attack click (bandpass noise burst)
    const knock = this.ctx.createBufferSource();
    knock.buffer = this.noise;
    const kf = this.ctx.createBiquadFilter();
    kf.type = "bandpass";
    kf.frequency.value = Math.min(6000, freq * 3.5);
    kf.Q.value = 0.9;
    const kg = this.ctx.createGain();
    kg.gain.setValueAtTime(0.0001, t);
    kg.gain.exponentialRampToValueAtTime(0.04 * vel, t + 0.001);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    knock.connect(kf); kf.connect(kg); kg.connect(out);
    knock.start(t); knock.stop(t + 0.05);
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

  /**
   * Voice / flute lead — warm sine + slightly detuned triangle, lowpass 1400 Hz.
   * Based on the Steven Universe player's "voice" instrument which sounds
   * immediately smooth and vocal without harsh partials.
   */
  private whistle(t: number, freq: number, dur: number, vel = 1): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const fl = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "sine";
    o2.type = "triangle";
    fl.type = "lowpass";
    fl.frequency.value = 1400;

    // Vibrato on held notes (dur > 0.3s): a 5 Hz LFO ±7 cents — the human
    // touch that separates "performed" from "sequenced".
    if (dur > 0.30) {
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = 5;
      const depthCents = 7;
      // cents → frequency multiplier via semitone ratio: Δf ≈ f * depth/1200
      lfoG.gain.value = freq * (depthCents / 1200) * 2 * Math.PI;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);
      lfoG.connect(o2.frequency);
      lfo.start(t + 0.06); // slight delay before vibrato kicks in
      lfo.stop(t + dur + 0.1);
    }

    o.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 1.003, t); // barely detuned = vocal warmth
    o.connect(fl); o2.connect(fl); fl.connect(g);
    g.connect(this.whistleGain);
    const peak = 0.5 * vel;
    g.gain.setValueAtTime(0.00008, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    g.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.04 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.00008, t + 0.04 + dur * 0.3 + dur * 0.7);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  /**
   * Warm upright bass — triangle + sub-octave sine, lowpass 360 Hz.
   * Based on the Steven Universe player's bass which sounds full and round.
   */
  private bass(t: number, freq: number, dur: number): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator(); // sub octave
    const fl = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o2.type = "sine";
    o.frequency.value = freq;
    o2.frequency.value = freq * 0.5; // sub octave = round body
    fl.type = "lowpass";
    fl.frequency.value = 360;
    o.connect(fl); o2.connect(fl); fl.connect(g);
    g.connect(this.bassGain);
    const snapDur = Math.min(dur * 0.85, 0.7);
    g.gain.setValueAtTime(0.00008, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.012 + 0.10);
    g.gain.exponentialRampToValueAtTime(0.00008, t + snapDur);
    o.start(t); o2.start(t);
    o.stop(t + snapDur + 0.05); o2.stop(t + snapDur + 0.05);
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
    // Warm cartoon kick: 108→34Hz in 160ms (same as the SU demo)
    o.frequency.setValueAtTime(108, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    g.gain.setValueAtTime(vel * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g);
    g.connect(this.percGain);
    o.start(t);
    o.stop(t + 0.30);
  }

  /** Snare: bandpass noise at 1700 Hz — warm and musical, not harsh. */
  private snare(t: number, vel: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1700;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(bp); bp.connect(g); g.connect(this.percGain);
    src.start(t); src.stop(t + 0.13);
  }

  /**
   * Marimba arp fill — Yoshi-style xylophone run.
   * Each note is a fast sine+triangle pop (short decay, wooden attack click)
   * so the run sounds like a xylophone glissando, not a synth bell.
   */
  private arp(t: number, baseFreq: number, dur: number): void {
    const intervals = [0, 4, 7, 12];
    const stepDur = dur * 0.20;
    for (let i = 0; i < 4; i++) {
      const freq = baseFreq * Math.pow(2, intervals[i]! / 12);
      const nt = t + i * stepDur;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, nt);
      g.gain.exponentialRampToValueAtTime(0.32, nt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, nt + 0.14); // short marimba decay
      o.connect(g);
      g.connect(this.arpGain);
      o.start(nt);
      o.stop(nt + 0.18);
    }
  }

  /**
   * Rhodes electric piano chord stab.
   * Sine sustain + f×14.1 tine transient (dies in 80ms) = the electric piano
   * "tink" that makes Steven Universe sound so warm. One note per chord tone.
   */
  private organ(t: number, chordName: string, dur: number): void {
    const root = (BASS_ROOT[chordName] ?? 48) + 12 + this.transpose;
    const pitches = [root, root + 7, root + 12];
    const decayTime = Math.min(dur * 0.75, 0.80);
    pitches.forEach((m, i) => {
      const f = mtof(m);
      const vol = 0.048 - i * 0.006;
      // Sine body
      const o = this.ctx.createOscillator();
      const fl = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      fl.type = "lowpass"; fl.frequency.value = 1800;
      o.connect(fl); fl.connect(g); g.connect(this.organGain);
      g.gain.setValueAtTime(0.00008, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(vol * 0.42, t + 0.012 + 0.16);
      g.gain.exponentialRampToValueAtTime(0.00008, t + decayTime);
      o.start(t); o.stop(t + decayTime + 0.06);
      // Tine transient — the "tink"
      const tine = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      tine.type = "sine"; tine.frequency.value = f * 14.1;
      tg.gain.setValueAtTime(0.00008, t);
      tg.gain.exponentialRampToValueAtTime(vol * 0.14, t + 0.002);
      tg.gain.exponentialRampToValueAtTime(0.00008, t + 0.08);
      tine.connect(tg); tg.connect(this.organGain);
      tine.start(t); tine.stop(t + 0.10);
    });
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
    // Sonic-style attack zip: pitch bends up 10% then snaps to target in 18ms
    o.frequency.setValueAtTime(freq * 1.10, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.018);
    o2.frequency.setValueAtTime(freq * 1.107, t);
    o2.frequency.exponentialRampToValueAtTime(freq * 1.006, t + 0.018);
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 10, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 3.2), t + Math.min(dur, 0.20));
    f.Q.value = 1.1;
    const peak = 0.34 * vel;
    const sustain = Math.max(0.04, dur - 0.035);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004); // hard attack
    g.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.05);
    g.gain.setValueAtTime(peak * 0.7, t + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.01);
    const mix2 = this.ctx.createGain();
    mix2.gain.value = 0.35;
    // Body: a triangle one octave down, low level. Chiptunes on real hardware
    // had this weight from the bass channel doubling the lead; a bare square
    // does not.
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = "triangle";
    sub.frequency.value = freq / 2;
    subG.gain.value = 0.30;
    sub.connect(subG);
    subG.connect(f);
    o.connect(f);
    o2.connect(mix2);
    mix2.connect(f);
    f.connect(g);
    g.connect(this.chipGain);
    o.start(t); o.stop(t + dur + 0.03);
    o2.start(t); o2.stop(t + dur + 0.03);
    sub.start(t); sub.stop(t + dur + 0.03);
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

  /** Crisp double-clap — Yoshi-style bright hand snap. */
  private clap(t: number): void {
    for (let i = 0; i < 2; i++) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2200;
      f.Q.value = 1.1;
      const g = this.ctx.createGain();
      const tt = t + i * 0.010;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.22, tt + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.055);
      src.connect(f);
      f.connect(g);
      g.connect(this.percGain);
      src.start(tt);
      src.stop(tt + 0.08);
    }
  }
}
