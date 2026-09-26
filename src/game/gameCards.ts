/**
 * The read-only cards and views the HUD renders from saved state.
 *
 * These were eight private methods on `Game`. Every one of them reads exactly
 * two things — the `SaveData` and at most one scalar (`today`, `island`, or
 * the equipped skin) — and none of them mutates anything, schedules anything,
 * or touches the clock. That makes them a unit: they can be stated as
 * functions of saved state, tested without a Game, and read without paging
 * through a 7,800-line class to find out where a card's numbers come from.
 *
 * Nothing here is allowed to become a place that reaches back into the running
 * game. If a card needs live state (a run timer, a network count), it stays on
 * `Game`; the snapshot field that carries it is built in `pushHud`.
 */
import { calendarRewardLabel, CALENDAR_DAYS, dailyChallenge, weeklyGauntlet } from "./Challenges";
import { BIOMES, biomeForIsland } from "./Biomes";
import { nextWings, wingsFor, wingsProgress } from "./Career";
import type { SaveData } from "./SaveData";
import { modeById } from "./Modes";
import { divisionFor, nextDivision, seasonReward } from "./pvp";
import { TRAILS, weekKey } from "./Tournaments";
import type { AtlasEntry, CalendarCard, DailyCard, GauntletCard, HudSnapshot, LoadoutView, RivalCard } from "./HUD";
import type { SkinDef } from "./Economy";

/** Today's daily challenge, and whether it is already banked. */
export function dailyCard(save: SaveData, today: string): DailyCard {
  const c = dailyChallenge(today);
  const mode = modeById(c.mode);
  return {
    title: c.title,
    modeName: mode.name,
    modeIcon: mode.icon,
    modifierIcon: c.modifier.icon,
    modifierLabel: c.modifier.label,
    modifierDesc: c.modifier.desc,
    metric: c.metric,
    target: c.target,
    reward: c.reward,
    done: save.isDailyDone(today),
    dailiesDone: save.state.challenges.dailiesDone,
  };
}

export function gauntletCard(save: SaveData): GauntletCard {
  const g = weeklyGauntlet(weekKey());
  const done = save.gauntletDone(g.week);
  return {
    week: g.week,
    stages: g.stages.map((st) => {
      const mode = modeById(st.mode);
      return {
        index: st.index,
        label: st.label,
        modeName: mode.name,
        modeIcon: mode.icon,
        metric: st.metric,
        target: st.target,
        reward: st.reward,
        done: done.includes(st.index),
      };
    }),
    clearBonus: g.clearBonus,
    cleared: done.length >= 3,
    lifetimeClears: save.state.challenges.gauntletsCleared,
  };
}

export function calendarCard(save: SaveData, today: string): CalendarCard {
  const cal = save.state.calendar;
  const claimedToday = cal.lastClaim === today;
  const days = [];
  for (let d = 1; d <= CALENDAR_DAYS; d++) {
    days.push({
      day: d,
      label: calendarRewardLabel(d),
      claimed: d <= cal.cycleDay,
      today: !claimedToday && d === (cal.cycleDay % CALENDAR_DAYS) + 1,
      milestone: d % 7 === 0,
    });
  }
  return { cycleDay: cal.cycleDay, claimedToday, days };
}

/** Ranked-season summary: countdown, peak, and the payout it locks in. */
export function seasonCard(save: SaveData): RivalCard["season"] {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
  const peak = save.state.rankSeason.peak;
  const reward = seasonReward(peak);
  return {
    daysLeft,
    peak: Math.floor(peak),
    peakDivision: reward.division.name,
    peakIcon: reward.division.icon,
    rewardCoins: reward.coins,
  };
}

export function rivalCard(save: SaveData): RivalCard {
  const r = save.state.rival;
  const div = divisionFor(r.rating);
  const next = nextDivision(r.rating);
  const span = div.max - div.min;
  return {
    rating: Math.floor(r.rating),
    division: div.name,
    divisionIcon: div.icon,
    wins: r.wins,
    losses: r.losses,
    streak: r.streak,
    bestStreak: r.bestStreak,
    nextName: next ? next.div.name : "",
    nextNeeded: next ? next.needed : 0,
    progress: span > 0 ? Math.max(0, Math.min(1, (r.rating - div.min) / span)) : 1,
    matches: r.matches.map((m) => ({ place: m.place, field: m.field, mode: m.mode, date: m.date, won: m.won })),
    season: seasonCard(save),
  };
}

export function wingsCard(save: SaveData): HudSnapshot["wings"] {
  const life = save.state.lifetime.distance;
  const cur = wingsFor(life);
  const next = nextWings(life);
  return {
    icon: cur.icon,
    name: cur.name,
    progress: wingsProgress(life),
    nextName: next ? next.tier.name : "",
    nextNeeded: next ? next.needed : 0,
    lifetime: life,
  };
}

export function loadoutView(save: SaveData, skin: SkinDef): LoadoutView {
  const trail = save.state.activeTrail
    ? (TRAILS[save.state.activeTrail]?.label ?? save.state.activeTrail)
    : "Default trail";
  return {
    bird: skin.name,
    trail,
    boosts: save.state.armedBoosts.length,
  };
}

export function atlas(save: SaveData, island: number): AtlasEntry[] {
  const far = Math.max(save.state.farthestIsland, island);
  const count = Math.max(BIOMES.length * 2, far + 3);
  const out: AtlasEntry[] = [];
  for (let i = 0; i < count; i++) {
    const b = biomeForIsland(i);
    const seen = save.state.biomesSeen.includes(b.id);
    out.push({
      island: i,
      name: b.name,
      emoji: b.emoji,
      tagline: b.tagline,
      color: `#${b.top.toString(16).padStart(6, "0")}`,
      reached: i <= far && seen,
      hazard: b.hazard,
    });
  }
  return out;
}
