/**
 * PvP helpers — pure functions only, no DOM, no save access.
 *
 * Everything here describes the *on-device* Rival rating earned in the
 * simulated 40-bird field. It is never presented as a global/server rank:
 * every label carries the word "local" or "practice". Server-authoritative
 * ranking stays deferred until a real backend owns results.
 */

export type RivalMatch = {
  place: number;
  field: number;
  mode: string;
  date: string;
  won: boolean;
};

export type RivalState = {
  rating: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  matches: RivalMatch[];
};

export type Division = {
  id: string;
  name: string;
  icon: string;
  min: number;
  max: number;
};

export const DIVISIONS: Division[] = [
  { id: "fledgling", name: "Fledgling", icon: "🐣", min: 0, max: 1099 },
  { id: "glider", name: "Glider", icon: "🐦", min: 1100, max: 1249 },
  { id: "racer", name: "Sky Racer", icon: "🌤️", min: 1250, max: 1399 },
  { id: "ace", name: "Sky Ace", icon: "⚡", min: 1400, max: 1549 },
  { id: "legend", name: "Sunbird Legend", icon: "👑", min: 1550, max: 1_000_000 },
];

export const RIVAL_BASE_RATING = 1000;
export const RIVAL_K = 26;
/** Live humans are harder than the local flock: rating swings are larger. */
export const LIVE_RATING_MULT = 1.5;

export function divisionFor(rating: number): Division {
  const r = Math.max(0, Math.floor(rating));
  return DIVISIONS.find((d) => r >= d.min && r <= d.max) ?? DIVISIONS[DIVISIONS.length - 1]!;
}

export function nextDivision(rating: number): { div: Division; needed: number } | null {
  const r = Math.max(0, Math.floor(rating));
  const next = DIVISIONS.find((d) => r < d.min);
  if (!next) return null;
  return { div: next, needed: next.min - r };
}

/**
 * Elo-style delta against the whole field, treated as one composite
 * opponent at rating 1000 + field strength. Beating 40 pilots pays more
 * than beating 8. Returns a signed integer, wins positive.
 *
 * Pass live=true when real humans shared the field: the same math, scaled
 * up, because a live field is genuinely harder than the local flock.
 */
export function ratingDelta(place: number, field: number, live = false): number {
  const p = Math.max(1, Math.min(field, Math.floor(place)));
  const f = Math.max(2, Math.floor(field));
  const score = (f - p) / (f - 1); // 1.0 win … 0.0 last
  const delta = Math.round(RIVAL_K * (score - 0.5) * 2);
  return live ? Math.round(delta * LIVE_RATING_MULT) : delta;
}

/** Streak bonus coins actually granted on a ranked win. Capped, honest. */
export function streakBonus(streak: number): number {
  if (streak < 2) return 0;
  return Math.min(60, 10 * streak);
}




const RIVAL_NAMES = [
  "Aria", "Kestrel", "Nomi", "Tavi", "Wren", "Bex", "Juno", "Pike", "Sable", "Fen",
  "Rook", "Vale", "Ivy", "Cass", "Odin", "Lux",
];

/**
 * Presence list for the race lobby — **real pilots only**.
 *
 * The lobby once padded itself with deterministic name-pool "rivals" and with
 * time-shifted leaderboard names so the room never looked empty. Both were
 * fiction: nobody was in the room. A lobby that invents occupants is worse
 * than a lobby that says it is empty, so this maps the live roster and stops
 * there — zero peers in, zero rows out, and the UI can say so honestly.
 */
export function lobbyRivals(
  peers: { name: string; ready: boolean; skin: string }[],
  aiFallback = false,
): { name: string; tag: string; ready: boolean; skin: string }[] {
  // The AI fallback populates the same roster as networked pilots, so the tag
  // has to come from the transport's own disclosure — otherwise a generated
  // pilot is advertised to the player as a live human in the room.
  const tag = aiFallback ? "in room · AI pilot" : "in room · live";
  return peers.slice(0, 39).map((p) => ({ name: p.name, tag, ready: p.ready, skin: p.skin }));
}

/**
 * Deterministic featured rivals, drawn from the same name pool as the
 * simulated field. Used for **simulated opponents** (local duels, the AI
 * flock) — never to stand in for live players in the lobby.
 */
export function featuredRivals(seed: string, count = 3): { name: string; tag: string }[] {
  let h = 2166136261;
  const s = `${seed}:rivals`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: { name: string; tag: string }[] = [];
  let x = h >>> 0 || 1;
  const tags = ["dives late", "climbs hard", "draft hunter", "steady wings", "crest sniper"];
  while (out.length < count) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const name = RIVAL_NAMES[x % RIVAL_NAMES.length]!;
    if (out.some((r) => r.name === name)) continue;
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push({ name, tag: tags[x % tags.length]! });
  }
  return out;
}

export function medalFor(place: number): string {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return `#${place}`;
}


export function defaultRival(): RivalState {
  return { rating: RIVAL_BASE_RATING, wins: 0, losses: 0, streak: 0, bestStreak: 0, matches: [] };
}

/* ------------------------------------------------------------- seasons */

/** Ranked seasons roll monthly, matching the Nest Pass cadence. */
export function rankSeasonId(d = new Date()): string {
  return `R${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Soft reset applied at each season rollover: ratings drift halfway back to
 * base so climbing stays meaningful without erasing a season of work.
 */
export function softResetRating(rating: number): number {
  return Math.round((Math.max(0, rating) + RIVAL_BASE_RATING) / 2);
}

/** End-of-season coin reward for the peak division reached. */
export function seasonReward(peakRating: number): { coins: number; division: Division } {
  const div = divisionFor(peakRating);
  const idx = DIVISIONS.findIndex((d) => d.id === div.id);
  return { coins: 60 + idx * 70, division: div };
}

/* --------------------------------------------------------------- duels */

/**
 * Duel matchmaking (local): map the player's rating onto an opponent skill
 * multiplier so a Legend faces a genuinely sharper pilot than a Fledgling.
 */
export function duelSkillFor(rating: number): number {
  const r = Math.max(0, rating);
  return Math.min(1.4, Math.max(0.55, 0.6 + (r - RIVAL_BASE_RATING) / 800));
}

/** Deterministic duel opponent for a given seed + rating band. */
export function duelOpponent(seed: string, rating: number): { name: string; tag: string; rating: number } {
  const picks = featuredRivals(`${seed}:duel`, 1);
  const base = picks[0] ?? { name: "Kestrel", tag: "steady wings" };
  // Opponent rating shown in the lobby: your band, ± a small seeded offset.
  let h = 5381;
  const s = `${seed}:duelr`;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  const jitter = ((h >>> 0) % 121) - 60;
  return { ...base, rating: Math.max(0, Math.round(rating + jitter)) };
}
