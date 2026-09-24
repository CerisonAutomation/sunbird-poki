import { SeededRandom } from "./math";
import type { ModeId } from "./Modes";

/**
 * Tournaments & the prize vault.
 *
 * Everything here is deterministic and verifiable on-device: the event
 * rotation is derived from the ISO week, the division you land in is derived
 * from your own results, and every prize maps onto a real unlock that the
 * shop/skin systems already understand. No prize is decorative.
 */

export type TrophyTier = "bronze" | "silver" | "gold" | "diamond";

export type PrizeKind = "coins" | "skin" | "boost" | "trail" | "title";

export type Prize = {
  kind: PrizeKind;
  id: string;
  amount: number;
  label: string;
  icon: string;
};

export type TournamentDef = {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  mode: ModeId;
  metric: "distance" | "altitude" | "perfects" | "coins";
  /** epoch ms */
  startsAt: number;
  endsAt: number;
  /** cut-offs for each division, in metric units */
  cuts: { bronze: number; silver: number; gold: number; diamond: number };
  prizes: Record<TrophyTier, Prize>;
};

export type TournamentEntry = {
  best: number;
  attempts: number;
  claimedTier: TrophyTier | null;
};

export type TournamentView = {
  def: TournamentDef;
  entry: TournamentEntry;
  tier: TrophyTier | null;
  nextTier: TrophyTier | null;
  nextCut: number;
  progress: number;
  claimable: boolean;
  endsInMs: number;
};

const CATALOG: {
  name: string;
  blurb: string;
  icon: string;
  mode: ModeId;
  metric: TournamentDef["metric"];
  cuts: TournamentDef["cuts"];
}[] = [
  {
    name: "Long Haul Cup",
    blurb: "One sunset. Push the furthest line you can hold.",
    icon: "🏁",
    mode: "distance",
    metric: "distance",
    cuts: { bronze: 600, silver: 1400, gold: 2600, diamond: 4200 },
  },
  {
    name: "Skyline Trials",
    blurb: "Chain launches and touch the stratosphere.",
    icon: "🚀",
    mode: "zenith",
    metric: "altitude",
    cuts: { bronze: 60, silver: 130, gold: 220, diamond: 330 },
  },
  {
    name: "Perfect Circuit",
    blurb: "Only flawless lips count. Time every release.",
    icon: "✦",
    mode: "perfect",
    metric: "perfects",
    cuts: { bronze: 4, silver: 10, gold: 18, diamond: 28 },
  },
  {
    name: "Gold Rush Open",
    blurb: "Sixty seconds. Every coin on the ideal line.",
    icon: "💰",
    mode: "coinrush",
    metric: "coins",
    cuts: { bronze: 25, silver: 60, gold: 110, diamond: 180 },
  },
];

const TIER_ORDER: TrophyTier[] = ["bronze", "silver", "gold", "diamond"];

const TIER_PRIZES: Record<TrophyTier, Prize[]> = {
  bronze: [
    { kind: "coins", id: "coins_bronze", amount: 120, label: "120 coins", icon: "💰" },
    { kind: "boost", id: "sunflask", amount: 1, label: "Sun Flask", icon: "☀" },
  ],
  silver: [
    { kind: "coins", id: "coins_silver", amount: 320, label: "320 coins", icon: "💰" },
    { kind: "boost", id: "headstart", amount: 1, label: "Head Start", icon: "🚀" },
  ],
  gold: [
    { kind: "trail", id: "trail_comet", amount: 1, label: "Comet Trail", icon: "☄" },
    { kind: "coins", id: "coins_gold", amount: 700, label: "700 coins", icon: "💰" },
  ],
  diamond: [
    { kind: "trail", id: "trail_prism", amount: 1, label: "Prism Trail", icon: "🌈" },
    { kind: "title", id: "title_ace", amount: 1, label: "“Ace” title", icon: "🎖" },
  ],
};

/** Monday-anchored ISO week key, e.g. `2026-W07`. */
export function weekKey(now = new Date()): string {
  // Local calendar day, matching weekBounds() so keys and windows agree.
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekBounds(now = new Date()): { start: number; end: number } {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
  return { start, end: start + 7 * 86400000 };
}

/**
 * Two events run concurrently each week, chosen deterministically from the
 * catalogue so every device on the same week sees the same pairing.
 */
export function tournamentsForWeek(now = new Date()): TournamentDef[] {
  const key = weekKey(now);
  const { start, end } = weekBounds(now);
  const rng = new SeededRandom(`${key}:cups`);
  const first = rng.int(0, CATALOG.length);
  let second = rng.int(0, CATALOG.length);
  if (second === first) second = (second + 1) % CATALOG.length;

  return [first, second].map((idx, slot) => {
    const c = CATALOG[idx]!;
    const prizeRng = new SeededRandom(`${key}:prize:${idx}:${slot}`);
    const prizes = {} as Record<TrophyTier, Prize>;
    for (const tier of TIER_ORDER) {
      const pool = TIER_PRIZES[tier];
      prizes[tier] = pool[prizeRng.int(0, pool.length)]!;
    }
    return {
      id: `${key}:${c.mode}:${slot}`,
      name: c.name,
      blurb: c.blurb,
      icon: c.icon,
      mode: c.mode,
      metric: c.metric,
      startsAt: start,
      endsAt: end,
      cuts: c.cuts,
      prizes,
    };
  });
}

export function tierFor(def: TournamentDef, value: number): TrophyTier | null {
  if (value >= def.cuts.diamond) return "diamond";
  if (value >= def.cuts.gold) return "gold";
  if (value >= def.cuts.silver) return "silver";
  if (value >= def.cuts.bronze) return "bronze";
  return null;
}

function nextTierFor(def: TournamentDef, value: number): { tier: TrophyTier | null; cut: number } {
  for (const t of TIER_ORDER) {
    if (value < def.cuts[t]) return { tier: t, cut: def.cuts[t] };
  }
  return { tier: null, cut: def.cuts.diamond };
}

export type TournamentState = {
  week: string;
  entries: Record<string, TournamentEntry>;
  /** Cosmetic ids won from events — real unlocks, persisted forever. */
  trails: string[];
  titles: string[];
};

export function emptyTournamentState(): TournamentState {
  return { week: weekKey(), entries: {}, trails: [], titles: [] };
}

export type PrizeGrant = { prize: Prize; tier: TrophyTier; cup: string };

/**
 * Owns tournament progress + prize granting. It never touches gameplay state
 * directly — it returns grants and the caller applies them through the same
 * save API the shop uses, so a tournament skin is identical to a bought one.
 */
export class Tournaments {
  private defs: TournamentDef[];

  constructor(private state: TournamentState) {
    this.defs = tournamentsForWeek();
    this.rollover();
  }

  /** Weekly reset: results clear, permanent cosmetics never do. */
  rollover(): boolean {
    const key = weekKey();
    if (this.state.week === key) return false;
    this.state.week = key;
    this.state.entries = {};
    this.defs = tournamentsForWeek();
    return true;
  }

  active(): TournamentDef[] {
    return this.defs;
  }

  view(): TournamentView[] {
    const now = Date.now();
    return this.defs.map((def) => {
      const entry = this.state.entries[def.id] ?? { best: 0, attempts: 0, claimedTier: null };
      const tier = tierFor(def, entry.best);
      const next = nextTierFor(def, entry.best);
      const floor = tier ? def.cuts[tier] : 0;
      const span = Math.max(1, next.cut - floor);
      return {
        def,
        entry,
        tier,
        nextTier: next.tier,
        nextCut: next.cut,
        progress: next.tier ? Math.min(1, Math.max(0, (entry.best - floor) / span)) : 1,
        claimable: tier !== null && entry.claimedTier !== tier,
        endsInMs: Math.max(0, def.endsAt - now),
      };
    });
  }

  /**
   * Submit a finished run against every event whose mode matches.
   * @returns the events whose personal best improved.
   */
  submit(mode: ModeId, stats: { distance: number; altitude: number; perfects: number; coins: number }): TournamentDef[] {
    const improved: TournamentDef[] = [];
    for (const def of this.defs) {
      if (def.mode !== mode) continue;
      const value =
        def.metric === "altitude"
          ? stats.altitude
          : def.metric === "perfects"
            ? stats.perfects
            : def.metric === "coins"
              ? stats.coins
              : stats.distance;
      const entry = this.state.entries[def.id] ?? { best: 0, attempts: 0, claimedTier: null };
      entry.attempts += 1;
      if (value > entry.best) {
        entry.best = value;
        improved.push(def);
      }
      this.state.entries[def.id] = entry;
    }
    return improved;
  }

  /** Claims the highest tier the player has actually reached but not banked. */
  claim(cupId: string): PrizeGrant | null {
    const def = this.defs.find((d) => d.id === cupId);
    if (!def) return null;
    const entry = this.state.entries[cupId];
    if (!entry) return null;
    const tier = tierFor(def, entry.best);
    if (!tier || entry.claimedTier === tier) return null;
    entry.claimedTier = tier;
    const prize = def.prizes[tier];
    if (prize.kind === "trail" && !this.state.trails.includes(prize.id)) this.state.trails.push(prize.id);
    if (prize.kind === "title" && !this.state.titles.includes(prize.id)) this.state.titles.push(prize.id);
    return { prize, tier, cup: def.name };
  }

  ownedTrails(): string[] {
    return [...this.state.trails];
  }

  /** Every trophy tier the player has claimed across all cups (for prize-skin gates). */
  claimedTiers(): TrophyTier[] {
    return Object.values(this.state.entries)
      .map((e) => e.claimedTier)
      .filter((t): t is TrophyTier => t !== null);
  }

  ownedTitles(): string[] {
    return [...this.state.titles];
  }
}

/** Cosmetic trail definitions won exclusively from tournaments. */
export const TRAILS: Record<string, { label: string; colors: [number, number, number][] }> = {
  trail_comet: {
    label: "Comet",
    colors: [
      [1, 0.85, 0.4],
      [1, 0.55, 0.2],
      [1, 0.95, 0.8],
    ],
  },
  trail_prism: {
    label: "Prism",
    colors: [
      [1, 0.3, 0.45],
      [0.35, 0.8, 1],
      [0.7, 1, 0.5],
      [0.95, 0.7, 1],
    ],
  },
  trail_star: {
    label: "Starfall",
    colors: [
      [1, 1, 0.85],
      [0.8, 0.85, 1],
      [1, 0.9, 0.55],
    ],
  },
  trail_duelist: {
    label: "Duelist",
    colors: [
      [1, 0.35, 0.3],
      [1, 0.7, 0.25],
    ],
  },
  trail_gauntlet: {
    label: "Stormline",
    colors: [
      [0.6, 0.5, 1],
      [0.35, 0.85, 1],
      [0.9, 0.95, 1],
    ],
  },
  /* shop trails — bought with coins in the Shop (SHOP_TRAILS in Economy.ts) */
  trail_ember: {
    label: "Emberline",
    colors: [
      [1, 0.54, 0.23],
      [1, 0.29, 0.16],
      [1, 0.82, 0.48],
    ],
  },
  trail_tide: {
    label: "Tideglass",
    colors: [
      [0.23, 0.88, 0.78],
      [0.16, 0.6, 0.85],
      [0.78, 1, 0.95],
    ],
  },
  trail_bloom: {
    label: "Petalfall",
    colors: [
      [1, 0.6, 0.78],
      [1, 0.42, 0.6],
      [1, 0.88, 0.93],
    ],
  },
  trail_gold: {
    label: "Goldleaf",
    colors: [
      [1, 0.84, 0.42],
      [1, 0.69, 0.13],
      [1, 0.95, 0.78],
    ],
  },
  trail_void: {
    label: "Voidwake",
    colors: [
      [0.42, 0.23, 1],
      [0.16, 0.1, 0.42],
      [0.78, 0.66, 1],
    ],
  },
  trail_mint: {
    label: "Mintcloud",
    colors: [
      [0.48, 1, 0.78],
      [0.23, 0.85, 0.6],
      [0.88, 1, 0.95],
    ],
  },
  trail_rose: {
    label: "Rosewind",
    colors: [
      [1, 0.69, 0.63],
      [1, 0.48, 0.42],
      [1, 0.91, 0.85],
    ],
  },
  trail_neon: {
    label: "Neonpulse",
    colors: [
      [0.23, 1, 1],
      [1, 0.23, 1],
      [1, 1, 0.23],
    ],
  },
  /* event trails — earned from weekly live events (Events.ts) */
  trail_harvest: {
    label: "Harvestlight",
    colors: [
      [1, 0.72, 0.29],
      [0.85, 0.48, 0.16],
      [1, 0.92, 0.6],
    ],
  },
  trail_frost: {
    label: "Frostspire",
    colors: [
      [0.72, 0.91, 1],
      [0.42, 0.66, 1],
      [0.95, 0.98, 1],
    ],
  },
  trail_carnival: {
    label: "Carnivale",
    colors: [
      [1, 0.29, 0.42],
      [0.29, 0.78, 1],
      [1, 0.85, 0.23],
      [0.54, 1, 0.42],
    ],
  },
  /* shop trails — new additions */
  trail_spark: {
    label: "Sparklejet",
    colors: [
      [1, 0.95, 0.44],
      [1, 0.9, 0.5],
      [1, 1, 1],
    ],
  },
  trail_aurora: {
    label: "Aurorawave",
    colors: [
      [0.25, 0.88, 0.82],
      [0.48, 0.41, 0.93],
      [0.6, 0.98, 0.6],
    ],
  },
  trail_lava: {
    label: "Lavaflow",
    colors: [
      [1, 0.27, 0],
      [0.55, 0.27, 0],
      [1, 0.55, 0],
    ],
  },
  trail_crystal: {
    label: "Crystaline",
    colors: [
      [0.69, 0.88, 1],
      [0.91, 0.97, 1],
      [0.43, 0.78, 1],
    ],
  },
  trail_shadow: {
    label: "Shadowrift",
    colors: [
      [0.1, 0, 0.19],
      [0.29, 0, 0.5],
      [0.56, 0.38, 0.78],
    ],
  },
  trail_cherry: {
    label: "Sakuradrift",
    colors: [
      [1, 0.72, 0.77],
      [1, 0.52, 0.63],
      [1, 0.94, 0.96],
    ],
  },
  trail_cosmic: {
    label: "Cosmicray",
    colors: [
      [1, 0.43, 0.78],
      [0.52, 0.37, 0.97],
      [0.3, 0.79, 0.94],
    ],
  },
};
