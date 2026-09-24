/**
 * Music arrangement — which instruments are in the band, per phase of a flight.
 *
 * The score already had two kinds of reaction:
 *
 *   • *intensity* (`MusicArc.ts` → `audio.setMusicIntensity`) — one number that
 *     opens the filter, nudges the tempo and swells the tension hats;
 *   • *moments* (`MusicMoments.ts`) — bounded gestures for the comedy beats.
 *
 * What it did not have is the thing a real score does with a run: **change the
 * instrumentation**. Riding one arrangement louder is why adaptive game music so
 * often reads as "the same loop, turned up". Alto's Odyssey — the reference this
 * repo keeps being measured against — re-arranges: the rhythm section leaves, a
 * solo voice takes the bridge, the bed swells under a landing.
 *
 * So a flight now has four audible phases plus the menu, and each one is a set
 * of *multipliers on the mix the engine already tuned* (`Music.apply()`):
 *
 *   `launch`  the first seconds — the kit is held back so the band has room to
 *             arrive; the pad and bass carry the take-off (MusicArc's swell).
 *   `cruise`  the tuned mix, untouched. Every multiplier is exactly 1, so this
 *             module cannot make an ordinary flight sound different from the
 *             score that was already shipped and tested.
 *   `apex`    high intensity — the top of the band brightens (glock, shimmer,
 *             whistle, arp, kit) and the bed gets out of the way.
 *   `resolve` the run ended — the rhythm section leaves and the pad rings out,
 *             so a landing is a cadence instead of a cut. It survives the mode
 *             flip back to the menu on purpose: that is the moment it exists for.
 *
 * Everything here is a pure function of scalars with no audio graph, no DOM and
 * no game state — the same rule `MusicArc.ts` and `SpeedFeel.ts` follow — so the
 * whole feel of the arrangement can be unit-tested and re-tuned in one file.
 */

/** The phases a flight's arrangement moves through. */
export type RunPhase = "menu" | "launch" | "cruise" | "apex" | "resolve";

/**
 * The instrument families `Music.apply()` mixes. `tension` is the offbeat hat
 * layer that rides intensity; it is included because a resolve that keeps a hi-hat
 * going under a ringing pad is exactly the mistake this module exists to prevent.
 */
export type ArrFamily =
  | "uke"
  | "glock"
  | "bass"
  | "perc"
  | "whistle"
  | "arp"
  | "organ"
  | "pad"
  | "spark"
  | "chip"
  | "tron"
  | "tension";

/** Tuning constants. Seconds are of run time, not of music time. */
export const ARR = {
  /** How long the take-off breath lasts before the band drops in. */
  launchSeconds: 2.6,
  /** Intensity that promotes cruise → apex… */
  apexEnter: 0.62,
  /** …and the lower bound that demotes apex → cruise. The gap is hysteresis:
   * a flight hovering at the threshold must not flutter the arrangement. */
  apexLeave: 0.52,
  /** How long the landing cadence holds after a run ends. */
  resolveSeconds: 6,
} as const;

/** What the score is being asked to do underneath the arrangement. */
export type ArrangementContext = "menu" | "flight" | "sleep";

export type PhaseInput = {
  context: ArrangementContext;
  /** True while a flight is in progress. */
  inRun: boolean;
  /** Seconds since take-off (frozen once the run ends). */
  runSeconds: number;
  /** Seconds since the run ended — `Infinity` when it has not. */
  sinceEnd: number;
  /** The arc-smoothed 0..1 intensity the score is already riding. */
  intensity: number;
  /** The phase we are in now, so apex can use hysteresis. */
  previous: RunPhase;
};

const NEUTRAL: Record<ArrFamily, number> = {
  uke: 1,
  glock: 1,
  bass: 1,
  perc: 1,
  whistle: 1,
  arp: 1,
  organ: 1,
  pad: 1,
  spark: 1,
  chip: 1,
  tron: 1,
  tension: 1,
};

/**
 * The arrangements. Read as "who is in the band":
 *
 * `launch` — no kit, big bed. Percussion at 0.42 and the tension hats nearly
 * gone leave a hole that the pad, organ and bass fill, which is what makes the
 * kit's arrival at `cruise` an *event* rather than a fade. The melody stays up
 * (glock 0.95): the hook is how a player recognises the track, and take-off is
 * the worst moment to hide it.
 *
 * `apex` — the top brightens, the bed thins. Whistle 1.28 is its solo, spark
 * 1.32 and glock 1.12 put the bells forward, kit 1.18 drives; pad 0.58 and
 * organ 0.74 get out of the way so the mix does not turn to mud at the loudest
 * moment of a flight.
 *
 * `resolve` — the rhythm section leaves the room. Kit and hats at 0, the comping
 * voices down, pad 1.5 and organ 1.28 ringing: a cadence. Glock stays at 0.85 so
 * the melody finishes its phrase instead of being cut off mid-bar.
 */
const ARRANGEMENTS: Record<RunPhase, Record<ArrFamily, number>> = {
  menu: NEUTRAL,
  cruise: NEUTRAL,
  launch: {
    uke: 0.72,
    glock: 0.95,
    bass: 1.06,
    perc: 0.42,
    whistle: 0.6,
    arp: 0.9,
    organ: 1.2,
    pad: 1.35,
    spark: 0.8,
    chip: 0.78,
    tron: 1,
    tension: 0.3,
  },
  apex: {
    uke: 0.9,
    glock: 1.12,
    bass: 1.08,
    perc: 1.18,
    whistle: 1.28,
    arp: 1.2,
    organ: 0.74,
    pad: 0.58,
    spark: 1.32,
    chip: 1.1,
    tron: 0.9,
    tension: 1.25,
  },
  resolve: {
    uke: 0.55,
    glock: 0.85,
    bass: 0.7,
    perc: 0,
    whistle: 0.5,
    arp: 0.6,
    organ: 1.28,
    pad: 1.5,
    spark: 0.7,
    chip: 0.6,
    tron: 1.05,
    tension: 0,
  },
};

/** Multipliers for a phase — always a full record, never undefined per family. */
export function arrangement(phase: RunPhase): Record<ArrFamily, number> {
  return ARRANGEMENTS[phase] ?? NEUTRAL;
}

/**
 * Which phase the score should be arranged for right now.
 *
 * Order matters twice over. A flight in progress beats the resolve window,
 * because instant retry is this game's headline loop: scoring a take-off as a
 * landing cadence would strip the kit out of the first seconds of the next run.
 * And the resolve window beats the menu, because the music mode flips back to
 * `menu` the instant a run ends — which is precisely why the old behaviour
 * sounded like a cut rather than a cadence. The sleep screen is never
 * re-arranged: it is a lullaby with its own mix.
 */
export function runPhase(input: PhaseInput): RunPhase {
  const { context, inRun, previous } = input;
  if (context === "sleep") return "menu";

  const sinceEnd = Number.isFinite(input.sinceEnd) ? Math.max(0, input.sinceEnd) : Number.POSITIVE_INFINITY;
  // A run clock we cannot read means "do not guess that this is a take-off":
  // the launch arrangement is a distinct sound, and holding it for a whole
  // flight would be worse than falling back to the tuned mix.
  const runSeconds = Number.isFinite(input.runSeconds)
    ? Math.max(0, input.runSeconds)
    : Number.POSITIVE_INFINITY;
  const intensity = Number.isFinite(input.intensity) ? Math.min(1, Math.max(0, input.intensity)) : 0;

  if (inRun && context === "flight") {
    if (runSeconds < ARR.launchSeconds) return "launch";
    // Hysteresis: enter apex on the way up at apexEnter, leave on the way down
    // at apexLeave, and hold whatever we were while inside the band.
    if (previous === "apex") return intensity >= ARR.apexLeave ? "apex" : "cruise";
    return intensity >= ARR.apexEnter ? "apex" : "cruise";
  }

  if (sinceEnd < ARR.resolveSeconds) return "resolve";
  return "menu";
}

/**
 * The `setTargetAtTime` time constant for a phase change — how fast the band
 * re-arranges. Asymmetric on purpose: instruments *arriving* should be quick
 * enough to read as an entrance, instruments *leaving* slow enough to read as a
 * release. A 0.18 s drop-in for the kit at the end of the launch breath is the
 * one that makes the phase audible at all.
 */
export function arrangementGlide(from: RunPhase, to: RunPhase): number {
  if (from === to) return 0.4;
  if (to === "resolve") return 0.5; // the kit leaves, the pad swells in
  if (to === "launch") return 0.25; // take-off: no time to fade
  if (from === "launch") return 0.18; // the drop-in — the moment of the arc
  if (to === "apex") return 0.6; // a lean-in, not a jump
  if (from === "apex") return 1.2; // …and a slow release out of it
  if (from === "resolve") return 1.6; // let the cadence ring out
  return 0.4;
}
