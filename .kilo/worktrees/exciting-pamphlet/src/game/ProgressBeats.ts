/**
 * Progress beats — one ranked celebration instead of a burst of toasts.
 *
 * The game has six ladders (career wings, 46 trophies, per-mode mastery, the
 * Nest Pass, missions/quests, streaks and live-ops) and a good flight can move
 * on four of them at once. Every one of those used to announce itself with
 * `hud.toast(...)`, in code order, in the same gold pill — and the toast layer
 * caps at **two** pills on a menu screen and evicts the oldest to honour that
 * cap. So a Platinum trophy and a lifetime rank-up were routinely deleted by a
 * "+2% coins in mode" line fired two statements later. Progression was not
 * under-celebrated; it was celebrated eleven times at once, which is the same
 * thing as never.
 *
 * This module decides what a run's progress *sounds and looks like*: rank every
 * event by how rare it is, stage the top few as a build-up (quietest first, so
 * the rarest lands last), fold the rest into compact chips that are still on
 * screen, and derive a single audio cue, a single confetti scale and a single
 * `happyTime()` value from the peak. One celebration with a shape, not a queue.
 *
 * It also decides the in-run half: the wings ladder is fed by every metre of
 * every flight, but the player only ever saw it on a menu. `wingsProximity()`
 * turns "you are 90 m from Silver Wings" into a bar that fills while you fly,
 * which is what makes the promotion at the end feel earned rather than random.
 *
 * Dependency-free by design — no `SaveData`, no DOM, no HUD: the inputs are
 * structural copies of what a run end already knows, so this is unit-tested
 * directly and importable from anywhere without a cycle. The rule `Moments.ts`
 * set and `GrowthLedger.ts` follows.
 */

export type Rarity = "bronze" | "silver" | "gold" | "platinum";

/** One thing a finished run moved. Built by `Game.ts` at run end. */
export type ProgressEvent =
  | { kind: "wings"; tierId: string; icon: string; name: string }
  | { kind: "trophy"; id: string; title: string; rarity: Rarity }
  | { kind: "mastery"; icon: string; mode: string; level: number; maxed: boolean; skill: string; coins: number }
  | { kind: "pass"; tier: number }
  | { kind: "record"; metres: number }
  | { kind: "cosmetic"; icon: string; label: string }
  | {
      kind: "challenge";
      /** Which live-ops surface cleared — the gauntlet has its own copy key. */
      variant: "daily" | "gauntlet" | "gauntletStage" | "event";
      icon: string;
      label: string;
      coins: number;
    }
  | { kind: "quest"; count: number; coins: number }
  | { kind: "nest"; level: number; mult: number };

export type Beat = {
  event: ProgressEvent;
  /** Colour and accessible word for this beat; wings take their own tier's metal. */
  rarity: Rarity;
  /** Ranking weight, 0..100. Higher is rarer. */
  weight: number;
  /** 0..1 loudness, derived from weight. */
  intensity: number;
  /** Milliseconds after the card opens — the stagger is CSS, not a timer. */
  delayMs: number;
  /** `stage` = the big animated chip, `ledger` = the compact row underneath. */
  surface: "stage" | "ledger";
  /** Stable identity, so the DOM animates once and repeats dedupe. */
  key: string;
};

export type Celebration = {
  /** The build-up: quietest first, rarest last. At most `STAGE_CAP`. */
  staged: Beat[];
  /** Everything else — still on screen, still legible, just not shouting. */
  ledger: Beat[];
  /** 0..1 — the one `happyTime()` value for this run. 0 means do not call it. */
  peak: number;
  /** The loudest cue earned (rank-up, personal best, platinum trophy). */
  fanfare: boolean;
  /** The mid cue — a mastery level, a pass tier, a gauntlet stage. */
  chime: boolean;
  /** 0..1 confetti scale. 0 when the run moved nothing. */
  confetti: number;
};

/** How many beats get the full treatment. Three is a shape; five is a list. */
export const STAGE_CAP = 3;

/** Milliseconds between staged reveals. */
export const STAGGER_MS = 240;

const clamp01 = (v: number) => (Number.isFinite(v) ? (v <= 0 ? 0 : v > 1 ? 1 : v) : 0);

const TROPHY_WEIGHT: Record<Rarity, number> = { bronze: 18, silver: 46, gold: 72, platinum: 98 };

/** A wings promotion wears the metal it just earned. */
const WINGS_RARITY: Record<string, Rarity> = {
  paper: "bronze",
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  platinum: "platinum",
  aurora: "platinum",
};

/**
 * How rare each event is. The ordering is the whole argument.
 *
 * A personal best sits at the top — above even a platinum trophy — because it is
 * the only beat that is about *this* player and *this* flight: "fly 100,000 m
 * lifetime" can unlock on a run the player barely noticed, while a PB is the
 * thing they just did. It also keeps Poki's canonical signal intact, since the
 * peak of 100 maps to `happyTime(1)`, which is what a PB has always sent.
 *
 * A rank-up is next because it happens a handful of times in a career, and a
 * mastery level-up sits near the bottom because it happens every few flights —
 * which is exactly why it used to be able to evict all of the above.
 */
function weightOf(event: ProgressEvent): number {
  switch (event.kind) {
    case "wings":
      return 96;
    case "trophy":
      return TROPHY_WEIGHT[event.rarity];
    case "record":
      return 100;
    case "mastery":
      return event.maxed ? 64 : 32;
    case "cosmetic":
      return 58;
    case "pass":
      return 44;
    case "challenge":
      return 38;
    case "nest":
      return 26;
    case "quest":
      return 20;
    default:
      return 0;
  }
}

function rarityOf(event: ProgressEvent): Rarity {
  switch (event.kind) {
    case "trophy":
      return event.rarity;
    case "wings":
      return WINGS_RARITY[event.tierId] ?? "gold";
    case "record":
    case "cosmetic":
    case "mastery":
      return event.kind === "mastery" && !event.maxed ? "silver" : "gold";
    case "pass":
    case "challenge":
      return "silver";
    default:
      return "bronze";
  }
}

/** Identity for dedupe and for the DOM's animate-once rule. */
function keyOf(event: ProgressEvent): string {
  switch (event.kind) {
    case "trophy":
      return `trophy:${event.id}`;
    case "wings":
      return `wings:${event.tierId}`;
    case "mastery":
      return `mastery:${event.mode}:${event.level}`;
    case "pass":
      return `pass:${event.tier}`;
    case "nest":
      return `nest:${event.level}`;
    case "quest":
      return `quest:${event.count}:${event.coins}`;
    case "cosmetic":
      return `cosmetic:${event.label}`;
    case "challenge":
      return `challenge:${event.label}`;
    case "record":
      return `record:${Math.round(event.metres)}`;
    default:
      return "unknown";
  }
}

/**
 * Rank a run's progress into one celebration.
 *
 * Deterministic and total: the same events always produce the same plan, an
 * empty list produces an empty plan (a run that moved nothing celebrates
 * nothing — a fanfare for no reason is the fastest way to teach a player that
 * the fanfare means nothing), and duplicates collapse to their rarest instance.
 */
export function planCelebration(events: ProgressEvent[]): Celebration {
  const byKey = new Map<string, ProgressEvent>();
  for (const event of events) {
    const key = keyOf(event);
    const existing = byKey.get(key);
    if (!existing || weightOf(event) > weightOf(existing)) byKey.set(key, event);
  }

  const ranked = [...byKey.values()]
    .map((event) => ({ event, weight: weightOf(event), key: keyOf(event) }))
    .sort((a, b) => b.weight - a.weight);

  const top = ranked.slice(0, STAGE_CAP);
  const rest = ranked.slice(STAGE_CAP);

  // Staged beats are returned quietest-first so the reveal is a build-up and the
  // rarest thing the player did is the last thing they see.
  const staged: Beat[] = top
    .slice()
    .sort((a, b) => a.weight - b.weight)
    .map((entry, index) => ({
      event: entry.event,
      rarity: rarityOf(entry.event),
      weight: entry.weight,
      intensity: clamp01(0.5 + entry.weight / 200),
      delayMs: index * STAGGER_MS,
      surface: "stage" as const,
      key: entry.key,
    }));

  const ledger: Beat[] = rest.map((entry) => ({
    event: entry.event,
    rarity: rarityOf(entry.event),
    weight: entry.weight,
    intensity: clamp01(0.5 + entry.weight / 200),
    delayMs: staged.length * STAGGER_MS,
    surface: "ledger" as const,
    key: entry.key,
  }));

  const peakWeight = ranked.length ? ranked[0]!.weight : 0;
  return {
    staged,
    ledger,
    peak: peakWeight ? clamp01(0.5 + peakWeight / 200) : 0,
    fanfare: peakWeight >= 88,
    chime: peakWeight >= 30 && peakWeight < 88,
    confetti: peakWeight === 0 ? 0 : peakWeight >= 88 ? 1 : peakWeight >= 30 ? 0.55 : 0.25,
  };
}

/**
 * The words for one beat: a barrel key, its params, and the English fallback.
 *
 * Kept here rather than in the HUD so the results card, the staged chip and any
 * future surface say the same thing about the same event — and so the fallbacks
 * stay next to the ranking logic that decides whether they are spoken at all.
 * Reused keys (`hud.toast.trophy`, `hud.toast.newRecord`, `hud.toast.questComplete`,
 * `hud.toast.nestUpgraded`, `hud.toast.nestPassUnlock`, `hud.toast.gauntletCleared`)
 * must match the barrel's `sourceText` word for word: the drift test checks.
 */
export type BeatCopy = { key: string; params: Record<string, string | number> | undefined; fallback: string };

export function beatCopy(beat: Beat): BeatCopy {
  const e = beat.event;
  switch (e.kind) {
    case "wings":
      return { key: "hud.progress.wings", params: { name: e.name }, fallback: "Lifetime rank earned · {{name}}" };
    case "trophy":
      return { key: "hud.toast.trophy", params: { title: e.title }, fallback: "Trophy: {{title}}" };
    case "record":
      return {
        key: "hud.toast.newRecord",
        params: undefined,
        fallback: "👑 NEW DISTANCE RECORD — keep flying!",
      };
    case "mastery":
      return e.maxed
        ? {
            key: "hud.progress.mastered",
            params: { mode: e.mode, skill: e.skill, c: e.coins },
            fallback: "{{mode}} MASTERED · {{skill}} unlocked · +{{c}} coins",
          }
        : {
            key: "hud.progress.mastery",
            params: { mode: e.mode, n: e.level, c: e.coins },
            fallback: "{{mode}} mastery Lv.{{n}} · +{{c}} coins",
          };
    case "pass":
      return { key: "hud.toast.nestPassUnlock", params: { n: e.tier }, fallback: "Nest Pass Lv.{{n}} unlocked — claim it!" };
    case "quest":
      return { key: "hud.toast.questComplete", params: { n: e.coins }, fallback: "Quest complete · +{{n}} coins" };
    case "nest":
      return { key: "hud.toast.nestUpgraded", params: undefined, fallback: "Nest upgraded!" };
    case "cosmetic":
      return { key: "hud.progress.cosmetic", params: { label: e.label }, fallback: "Unlocked · {{label}}" };
    case "challenge":
      return e.variant === "gauntlet"
        ? { key: "hud.toast.gauntletCleared", params: { n: e.coins }, fallback: "🏆 GAUNTLET CLEARED · +{{n}} coins" }
        : { key: "hud.progress.challenge", params: { label: e.label, c: e.coins }, fallback: "{{label}} · +{{c}} coins" };
    default:
      return { key: "hud.progress.challenge", params: undefined, fallback: "" };
  }
}

/** The chip glyph for a beat. Rarity is carried by colour, never by the icon. */
export function beatIcon(beat: Beat): string {
  const e = beat.event;
  switch (e.kind) {
    case "wings":
      return e.icon || "🪶";
    case "trophy":
      return "🏅";
    case "record":
      return "👑";
    case "mastery":
      return e.icon || "🎖";
    case "pass":
      return "🎫";
    case "nest":
      return "🪺";
    case "quest":
      return "📜";
    case "cosmetic":
      return e.icon || "✨";
    case "challenge":
      return e.icon || "🏁";
    default:
      return "✨";
  }
}

/** How many compact ledger chips to show before folding the rest into "+n more". */
export const LEDGER_CHIP_CAP = 4;

/**
 * The render-ready shape the HUD snapshot carries — the same contract
 * `MomentTally` uses: a barrel key, its params and the English fallback, so the
 * HUD translates at render time and nothing here imports the i18n layer.
 */
export type BeatView = {
  key: string;
  params: Record<string, string | number> | undefined;
  fallback: string;
  icon: string;
  rarity: Rarity;
  delayMs: number;
  /** True for a career rank-up, which earns a banner instead of a chip. */
  banner: boolean;
};

export function beatView(beat: Beat): BeatView {
  return { ...beatCopy(beat), icon: beatIcon(beat), rarity: beat.rarity, delayMs: beat.delayMs, banner: beat.event.kind === "wings" };
}

export type CelebrationView = {
  staged: BeatView[];
  ledger: BeatView[];
  /** Beats too numerous to chip; the card says "+n more from this flight". */
  folded: number;
  /** 0..1 — the intensity the run's celebration peaked at. */
  peak: number;
};

/** What the results card renders. Empty in, empty out: no run, no celebration. */
export function celebrationView(plan: Celebration): CelebrationView {
  const chips = plan.ledger.slice(0, LEDGER_CHIP_CAP).map(beatView);
  return {
    staged: plan.staged.map(beatView),
    ledger: chips,
    folded: Math.max(0, plan.ledger.length - chips.length),
    peak: plan.peak,
  };
}

/**
 * The in-run half: how close this flight is to promoting the pilot's career
 * wings, and whether that is close enough to be worth showing.
 *
 * Only the wings ladder qualifies — it is fed by raw distance, so it is free to
 * evaluate every frame and it is true on every flight in every mode. Trophies
 * and mastery would need 46 metric functions re-run mid-flight to know how close
 * they are, and a bar that only appears once every twenty flights teaches
 * nothing.
 */
export type Proximity = {
  visible: boolean;
  /** 0..1 fill of the reveal window, not of the whole tier. */
  fill: number;
  /** Metres still needed, rounded; 0 once the promotion has happened. */
  remaining: number;
  /** 0..1 urgency, for the audio shimmer in the last stretch. */
  imminence: number;
};

/**
 * @param flownMetres    this flight's distance so far.
 * @param nextName       the rung being climbed, or "" at max rank.
 * @param nextNeeded     metres to that rung, measured before the flight.
 * @param tierSpan       metres from the current rung's floor to the next one,
 *                       which sets how wide the reveal window is.
 */
export function wingsProximity(options: {
  flownMetres: number;
  nextName: string;
  nextNeeded: number;
  tierSpan: number;
}): Proximity {
  const { nextName, tierSpan } = options;
  const flown = Number.isFinite(options.flownMetres) ? Math.max(0, options.flownMetres) : 0;
  const needed = Number.isFinite(options.nextNeeded) ? Math.max(0, options.nextNeeded) : 0;
  const span = Number.isFinite(tierSpan) ? Math.max(0, tierSpan) : 0;
  if (!nextName || needed <= 0) return { visible: false, fill: 0, remaining: 0, imminence: 0 };

  const remaining = Math.max(0, Math.round(needed - flown));
  // Wide enough to be readable at speed, narrow enough to feel like the last
  // stretch: 6% of the rung, but never less than 120 m or more than 600 m.
  const window = Math.max(120, Math.min(600, span * 0.06));
  if (remaining > window) return { visible: false, fill: 0, remaining, imminence: 0 };

  const fill = clamp01((window - remaining) / window);
  return { visible: remaining > 0, fill, remaining, imminence: fill };
}
