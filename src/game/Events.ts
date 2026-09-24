/**
 * Events — the live-ops calendar, fully deterministic and client-side.
 *
 * Two layers, mirroring how the big titles run engagement:
 *  - WEEKLY EVENT MODE: every ISO week features one twist on the rules
 *    (double coins, storm surge, feather-light gravity…). Same for every
 *    player in the same week, no server needed.
 *  - MONTHLY THEME: each calendar month recolors the mood — a headline,
 *    a featured biome, and a themed prize trail earned by clearing the
 *    weekly event 3 times during that month.
 *
 * Everything derives from the date, so devices agree with zero backend —
 * and when the real backend lands, the same ids key server-side prizes.
 */

import { weekKey } from "./Tournaments";

export type WeeklyEvent = {
  id: string;
  week: string;
  name: string;
  icon: string;
  desc: string;
  /** Gameplay modifiers applied when playing the event. */
  mods: {
    coinMult: number;
    gravityMult: number;
    windMult: number;
    daylightMult: number;
  };
  /** Distance to clear one event run. */
  target: number;
  reward: number;
};

const WEEKLY_POOL: Omit<WeeklyEvent, "id" | "week">[] = [
  {
    name: "Gold Rush",
    icon: "🤑",
    desc: "Every coin counts double. The geese are furious",
    mods: { coinMult: 2, gravityMult: 1, windMult: 1, daylightMult: 1 },
    target: 1800,
    reward: 90,
  },
  {
    name: "Feather Week",
    icon: "🐦",
    desc: "Gravity took the week off — float like a rumour",
    mods: { coinMult: 1, gravityMult: 0.82, windMult: 1, daylightMult: 1 },
    target: 2600,
    reward: 80,
  },
  {
    name: "Storm Surge",
    icon: "🌪",
    desc: "Double wind. Hold your hat. You don't have a hat",
    mods: { coinMult: 1.5, gravityMult: 1, windMult: 2, daylightMult: 1 },
    target: 1500,
    reward: 110,
  },
  {
    name: "Endless Noon",
    icon: "🌞",
    desc: "The sun is showing off — 40% longer days",
    mods: { coinMult: 1, gravityMult: 1, windMult: 1, daylightMult: 1.4 },
    target: 3200,
    reward: 85,
  },
  {
    name: "Heavy Metal",
    icon: "🏋️",
    desc: "Chunky gravity. Massive dives. Earn your lift",
    mods: { coinMult: 1.8, gravityMult: 1.18, windMult: 1, daylightMult: 1 },
    target: 1300,
    reward: 120,
  },
  {
    name: "Twilight Sprint",
    icon: "🌆",
    desc: "Short days, fat rewards. Blink and it's night",
    mods: { coinMult: 2.2, gravityMult: 1, windMult: 1, daylightMult: 0.65 },
    target: 1100,
    reward: 130,
  },
];

export type MonthlyTheme = {
  id: string;
  month: string; // "YYYY-MM"
  name: string;
  icon: string;
  tagline: string;
  /** biome id featured on the menu & atlas this month */
  biome: string;
  /** trail granted for 3 weekly-event clears within the month */
  prizeTrail: string;
};

const THEME_POOL: Omit<MonthlyTheme, "id" | "month">[] = [
  { name: "Harvest Skies", icon: "🍂", tagline: "Amber light over golden hills", biome: "desert", prizeTrail: "trail_harvest" },
  { name: "Frostreach", icon: "❄", tagline: "The peaks put on their winter coats", biome: "aurora", prizeTrail: "trail_frost" },
  { name: "Carnival of Wings", icon: "🎪", tagline: "Every sunset is a parade", biome: "sunset", prizeTrail: "trail_carnival" },
  { name: "Reef Days", icon: "🐚", tagline: "Warm lagoons and lazy thermals", biome: "reef", prizeTrail: "trail_harvest" },
  { name: "Forge Nights", icon: "🌋", tagline: "The mountain hums. Fly anyway", biome: "volcano", prizeTrail: "trail_frost" },
  { name: "Canyon Calling", icon: "🏜", tagline: "Big walls, bigger launches", biome: "canyon", prizeTrail: "trail_carnival" },
];

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function weeklyEvent(date = new Date()): WeeklyEvent {
  const week = weekKey(date);
  const pick = WEEKLY_POOL[hashStr(week) % WEEKLY_POOL.length]!;
  return { ...pick, id: `evt-${week}`, week };
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthlyTheme(date = new Date()): MonthlyTheme {
  const month = monthKey(date);
  const pick = THEME_POOL[hashStr(month) % THEME_POOL.length]!;
  return { ...pick, id: `theme-${month}`, month };
}

/** Persistent event progress kept inside SaveState. */
export type EventProgress = {
  week: string;
  clearsThisWeek: number;
  month: string;
  clearsThisMonth: number;
  claimedTrailMonth: string;
};

export function emptyEventProgress(): EventProgress {
  return { week: "", clearsThisWeek: 0, month: "", clearsThisMonth: 0, claimedTrailMonth: "" };
}

/** Roll week/month windows forward, resetting counters when they change. */
export function rollEventProgress(p: EventProgress, date = new Date()): EventProgress {
  const wk = weekKey(date);
  const mo = monthKey(date);
  const next = { ...p };
  if (next.week !== wk) {
    next.week = wk;
    next.clearsThisWeek = 0;
  }
  if (next.month !== mo) {
    next.month = mo;
    next.clearsThisMonth = 0;
  }
  return next;
}

/** Clears needed inside one month to earn the theme trail. */
export const THEME_TRAIL_CLEARS = 3;
