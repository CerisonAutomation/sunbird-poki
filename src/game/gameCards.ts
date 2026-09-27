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
import { buildGauntletCard, buildRivalCard } from "./Cards";
import { calendarRewardLabel, CALENDAR_DAYS, dailyChallenge } from "./Challenges";
import { BIOMES, biomeForIsland } from "./Biomes";
import { nextWings, wingsFor, wingsProgress } from "./Career";
import type { SaveData } from "./SaveData";
import { modeById } from "./Modes";
import { seasonReward } from "./pvp";
import { TRAILS, weekKey } from "./Tournaments";
import type { AtlasEntry, CalendarCard, DailyCard, GauntletCard, HudSnapshot, LoadoutView, RivalCard } from "./HUD";
import { rankedPerkPreview, type SkinDef } from "./Economy";

/** Today's daily challenge, and whether it is already banked. */
export function dailyCard(save: SaveData, today: string): DailyCard {
  const c = dailyChallenge(today, save.state.challenges.dailyChallengeFailures ?? 0);
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

/**
 * The week's gauntlet as the HUD draws it.
 *
 * A one-line delegation to `Cards.buildGauntletCard` — the seam that module
 * documented but was never carried out, which left the tested copy and the live
 * copy of this rule drifting apart. The live one used `done.length >= 3`; the
 * tested one uses "every stage of *this* gauntlet is done". They agree through
 * normal play and diverge on a save whose `gauntletDone` holds stale indices,
 * where the old rule renders "Gauntlet cleared this week · +N paid" and pays
 * out for a gauntlet the player did not finish.
 */
export function gauntletCard(save: SaveData): GauntletCard {
  // One clock read: `weekKey()` is a pure function of the date, but calling it
  // twice would let a midnight rollover hand the builder a week and a done-list
  // that belong to different weeks.
  const week = weekKey();
  return buildGauntletCard(week, save.gauntletDone(week), save.state.challenges.gauntletsCleared);
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

/**
 * The ranked-rival card: rating, division, streak and the season footer.
 *
 * The one-line delegation the `Cards.ts` header asked for. `seasonCard` is
 * passed in rather than read here so the builder stays pure — the season footer
 * is clock-derived, so the caller owns the clock.
 */
export function rivalCard(save: SaveData): RivalCard {
  return buildRivalCard(save.state.rival, seasonCard(save));
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
    // Preview of what ranked duels do to this bird's perks, so the cap is
    // visible before the pilot launches instead of only felt mid-race.
    rankedNote: rankedPerkPreview(skin),
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
