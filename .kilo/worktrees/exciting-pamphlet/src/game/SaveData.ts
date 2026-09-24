import {
  ADS_PER_DAY,
  AD_MIN_RUN_GAP,
  INTERSTITIAL_EVERY,
  NEST_MULT_PER_LEVEL,
  SAVE_KEY,
  SAVE_KEY_CORRUPT,
  SAVE_KEY_V1,
  VIP_DAILY_GIFT,
  VIP_DAYS,
} from "./constants";
import { dateSeed } from "./math";
import { durableSetItem } from "./resilience/durableSet";
import { openPayload, sealPayload } from "./resilience/crc";
import { TRACK_NAMES } from "./Music";
import { COIN_MULTIPLIER_UPGRADES } from "./Economy";
import { defaultRival, rankSeasonId, ratingDelta, RIVAL_BASE_RATING, seasonReward, softResetRating, streakBonus, type RivalMatch, type RivalState } from "./pvp";
import { seasonId } from "./season";
import { emptyTournamentState, type TournamentState } from "./Tournaments";
import { emptySocialState, type SocialState } from "./SocialSystem";
import { storage } from "./Storage";

export type HighScore = {
  date: string;
  distance: number;
  coins: number;
  score: number;
  vip?: boolean;
  island?: number;
};

export type Quality = "auto" | "high" | "low";

export type Settings = {
  mute: boolean;
  /** Purchased double-tap boost can be disabled without losing ownership. */
  doubleTapBoost: boolean;
  music: boolean;
  musicVolume: number;
  sfxVolume: number;
  /** Which music track to play: "shuffle" (all ten) or a 0-based track index. */
  musicTrack: number | "shuffle";
  haptics: boolean;
  reduceMotion: boolean;
  /** Colorblind assist: shifts warning reds/greens to blue/orange + adds glyphs. */
  colorAssist: boolean;
  /** Large-text mode: bumps every UI font a step for readability. */
  bigText: boolean;
  quality: Quality;
  /** Distance unit preference: "km" (default) or "mi". */
  distUnit: "km" | "mi";
  /**
   * Let the game open the Hangar by itself once per session, the first time a
   * flight leaves the player able to afford something they do not own.
   *
   * On by default because the shop is where progression is felt, and a shop
   * nobody opens is a feature nobody has. It is a *setting* because an
   * auto-navigation the player cannot turn off is exactly the kind of thing
   * that breaks flow — and this game's whole contract is one button and no
   * interruptions. Fires at most once per session, only on the main menu (never
   * over a results screen or mid-flight), and says why when it happens.
   */
  autoShop: boolean;
};

export type LifetimeStats = {
  distance: number;
  coins: number;
  zeniths: number;
  ghostBeats: number;
  sunflowers: number;
};

export type SeasonState = {
  id: string;
  xp: number;
  claimedFree: number[];
  claimedPremium: number[];
};

export type SaveState = {
  bestScore: number;
  bestDistance: number;
  totalCoins: number;
  wallet: number;
  nestLevel: number;
  completedMissions: string[];
  /** Nest levels bought with coins (stacks with mission levels). */
  nestBought: number;
  /** One-time starter pack purchased (never offered again). */
  starterPack: boolean;
  highScores: HighScore[];
  gold: boolean;
  vip: boolean;
  /** epoch ms — a monthly subscription really expires */
  vipUntil: number;
  vipLastClaim: string;
  ads: { day: string; count: number; lastRun: number };
  ownedSkins: string[];
  activeSkin: string;
  armedBoosts: string[];
  /** Permanent gameplay upgrades purchased with coins. */
  ownedUpgrades: string[];
  settings: Settings;
  quests: { date: string; claimed: string[] };
  streak: { last: string; days: number; claimedDate: string };
  /** Collection ids whose completion bonus has been paid. */
  claimedCollections: string[];
  redeemedCodes: string[];
  /**
   * Calendar day (`YYYY-MM-DD`) of the very first session on this device, ""
   * until it is stamped. The retention cohort (new / D1 / D2-6 / D7+) is
   * derived from it, so it is written once and never rewritten - a reset of
   * progress clears it, which is correct: that device really is new again.
   */
  firstPlayed: string;
  runsPlayed: number;
  lifetime: LifetimeStats;
  achievements: string[];
  season: SeasonState;
  deviceId: string;
  referralCode: string;
  referralRedeemed: boolean;
  farthestIsland: number;
  biomesSeen: string[];
  tutorialRuns: number;
  /** One-time interactive first-flight coach completed (dive/launch/soar). */
  firstFlightDone: boolean;
  /** Progressive onboarding tips that have been seen/dismissed (never shown again). */
  onboardingSeen: string[];
  /** Flags for contextual onboarding — when player actually opened these */
  seenShop: boolean;
  seenPvp: boolean;
  seenPve: boolean;
  seenLeaderboards: boolean;
  seenChallenges: boolean;
  /** rolling flow-calibration estimate */
  skill: number;
  skillSamples: number;
  bestAltitude: number;
  bestCombo: number;
  /** Weekly tournament progress + permanently-won cosmetics. */
  tournaments: TournamentState;
  /** Cosmetic trail currently equipped ("" = skin default). */
  activeTrail: string;
  pilotName: string;
  /** True once the player picked/generated a name — stops the portal from
    overwriting it with their platform handle on a later boot. */
  pilotNameCustomized: boolean;
  bestPlace: number;
  racesRun: number;
  /** On-device Rival rating for the simulated 40-bird field. Local only —
   *  never synced, never presented as a server rank. */
  rival: RivalState;
  /** Head-to-head duel record (local ranked 1v1). */
  duel: DuelState;
  /** Monthly ranked season bookkeeping: soft reset + peak-division reward. */
  rankSeason: { id: string; peak: number };
  /** Daily challenge / weekly gauntlet completion state. */
  challenges: ChallengeState;
  /** 28-day login calendar, separate from the streak. */
  calendar: { cycleDay: number; lastClaim: string };
  /** Runs flown per mode, feeding mode mastery levels. */
  mastery: Record<string, number>;
  /** Campaign chapters whose rewards were claimed. */
  campaignClaimed: string[];
  /** Weekly-event / monthly-theme progress windows. */
  events: { week: string; clearsThisWeek: number; month: string; clearsThisMonth: number; claimedTrailMonth: string };
  /** Local-first social graph (friends, clubs, DMs, challenges, replays). */
  social: SocialState;
  /** Piggy Bank accumulator storage. */
  piggyBank: { coins: number; maxCoins: number };
  /** Prestige / Rebirth tier (+25% coin earning multiplier per level). */
  prestige: { level: number; multiplier: number };
  /** Wheel of Fortune / Daily Lucky Spin state. */
  wheel: { lastFreeSpin: string; spinsToday: number };
  /** Daily flight stipend claimed date. */
  lastStipendClaimed?: string;
  /** Squad team quests claimed record (questId -> dateStr). */
  squadQuestsClaimed?: Record<string, string>;
  /** Rank-season id (e.g. "R2026-09") whose division prize was claimed. */
  rankPrizeSeason?: string;
  /** The one-time Ace Wingman crate was bought (pays 250 for 240 — never re-sell). */
  wingmanBundle?: boolean;
};

export type DuelState = {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
};

export type ChallengeState = {
  dailyDate: string;
  dailyDone: boolean;
  dailiesDone: number;
  gauntletWeek: string;
  gauntletDone: number[];
  gauntletsCleared: number;
};

const DEFAULT_SETTINGS: Settings = {
  mute: false,
  doubleTapBoost: true,
  music: true,
  musicVolume: 0.8,
  sfxVolume: 0.9,
  musicTrack: "shuffle",
  haptics: true,
  reduceMotion: false,
  colorAssist: false,
  bigText: false,
  quality: "auto",
  distUnit: "km",
  autoShop: true,
};

function makeDeviceId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `d${Date.now().toString(36)}${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function codeFromId(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `SUN-${clean.slice(-6).padStart(6, "0")}`;
}

function defaults(): SaveState {
  const deviceId = makeDeviceId();
  return {
    bestScore: 0,
    bestDistance: 0,
    totalCoins: 0,
    wallet: 0,
    nestLevel: 0,
    completedMissions: [],
    nestBought: 0,
    starterPack: false,
    highScores: [],
    gold: false,
    vip: false,
    vipUntil: 0,
    vipLastClaim: "",
    ads: { day: "", count: 0, lastRun: -999 },
    ownedSkins: ["sunbird"],
    activeSkin: "sunbird",
    armedBoosts: [],
    ownedUpgrades: [],
    settings: { ...DEFAULT_SETTINGS },
    quests: { date: "", claimed: [] },
    streak: { last: "", days: 0, claimedDate: "" },
    claimedCollections: [],
    redeemedCodes: [],
    firstPlayed: "",
    runsPlayed: 0,
    lifetime: { distance: 0, coins: 0, zeniths: 0, ghostBeats: 0, sunflowers: 0 },
    achievements: [],
    season: { id: seasonId(), xp: 0, claimedFree: [], claimedPremium: [] },
    deviceId,
    referralCode: codeFromId(deviceId),
    referralRedeemed: false,
    farthestIsland: 0,
    biomesSeen: [],
    tutorialRuns: 0,
    firstFlightDone: false,
    onboardingSeen: [],
    seenShop: false,
    seenPvp: false,
    seenPve: false,
    seenLeaderboards: false,
    seenChallenges: false,
    skill: 0.25,
    skillSamples: 0,
    bestAltitude: 0,
    bestCombo: 0,
    tournaments: emptyTournamentState(),
    activeTrail: "",
    pilotName: "",
    pilotNameCustomized: false,
    bestPlace: 0,
    racesRun: 0,
    rival: defaultRival(),
    duel: { wins: 0, losses: 0, streak: 0, bestStreak: 0 },
    rankSeason: { id: rankSeasonId(), peak: RIVAL_BASE_RATING },
    challenges: { dailyDate: "", dailyDone: false, dailiesDone: 0, gauntletWeek: "", gauntletDone: [], gauntletsCleared: 0 },
    calendar: { cycleDay: 0, lastClaim: "" },
    mastery: {},
    campaignClaimed: [],
    events: { week: "", clearsThisWeek: 0, month: "", clearsThisMonth: 0, claimedTrailMonth: "" },
    social: emptySocialState(),
    piggyBank: { coins: 0, maxCoins: 1000 },
    prestige: { level: 0, multiplier: 1.0 },
    wheel: { lastFreeSpin: "", spinsToday: 0 },
    lastStipendClaimed: "",
    squadQuestsClaimed: {},
    rankPrizeSeason: "",
    wingmanBundle: false,
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function numArr(v: unknown): number[] {
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : [];
}

function parseSocial(v: unknown): SocialState {
  const d = emptySocialState();
  if (!v || typeof v !== "object") return d;
  const p = v as Partial<SocialState>;
  return {
    friends: Array.isArray(p.friends) ? (p.friends as SocialState["friends"]) : d.friends,
    pendingRequests: strArr(p.pendingRequests),
    incomingRequests: strArr(p.incomingRequests),
    blocked: strArr(p.blocked),
    club: p.club ?? null,
    dmThreads: Array.isArray(p.dmThreads) ? (p.dmThreads as SocialState["dmThreads"]) : d.dmThreads,
    challenges: Array.isArray(p.challenges) ? (p.challenges as SocialState["challenges"]) : d.challenges,
    savedReplays: Array.isArray(p.savedReplays) ? (p.savedReplays as SocialState["savedReplays"]) : d.savedReplays,
    socialQuestsClaimed: strArr(p.socialQuestsClaimed),
  };
}

function parseRival(v: unknown): RivalState {
  const d = defaultRival();
  if (!v || typeof v !== "object") return d;
  const p = v as Partial<RivalState> & { matches?: unknown };
  const matches: RivalMatch[] = Array.isArray(p.matches)
    ? (p.matches as unknown[])
        .filter((m): m is RivalMatch => !!m && typeof m === "object")
        .map((m) => {
          const r = m as Partial<RivalMatch>;
          return {
            place: num(r.place),
            field: Math.max(2, num(r.field)),
            mode: String(r.mode ?? "massrace"),
            date: String(r.date ?? ""),
            won: Boolean(r.won),
          };
        })
        .slice(-8)
    : [];
  return {
    rating: num(p.rating) || d.rating,
    wins: num(p.wins),
    losses: num(p.losses),
    streak: num(p.streak),
    bestStreak: num(p.bestStreak),
    matches,
  };
}

export class SaveData {
  state: SaveState;
  /** True when the on-disk save was unreadable this session and we booted
   *  clean. The corrupt payload is parked under SAVE_KEY_CORRUPT, not lost. */
  recoveredFromCorruption = false;
  /** Invoked (throttled) when a persist fails — lets the game observe data-
   *  loss risk instead of swallowing it silently. */
  onPersistError: (() => void) | null = null;
  /** Invoked when quota pressure forced cache eviction to complete a write. */
  onEviction: ((evicted: readonly string[]) => void) | null = null;
  /** Optional platform SDK adapter for cloud save syncing (e.g. CrazyGames data.setItem). */
  platformAdapter: { saveData?: (key: string, data: string) => Promise<void> } | null = null;
  private lastPersistErrorAt = 0;
  /** Timed coin multiplier (the `luckycoin` boost) — session-only on purpose:
   *  a consumable bought for one flight must not survive into the next. */
  private coinBonus = 1;
  private coinBonusUntil = 0;

  constructor() {
    this.state = this.load();
  }

  private load(): SaveState {
    const d = defaults();
    let raw: string | null = null;
    try {
      raw = storage.getItem(SAVE_KEY) ?? storage.getItem(SAVE_KEY_V1);
      if (!raw) {
        this.persistNow(d);
        return d;
      }
      // Integrity seal (CRC32 envelope). Legacy bare-JSON saves pass through
      // untouched; a sealed save whose bytes no longer match its checksum is
      // treated exactly like unparseable JSON — the catch below quarantines
      // the raw blob and boots clean instead of trusting corrupt numbers.
      const opened = openPayload(raw);
      if (!opened.ok) throw new Error("save integrity check failed");
      const p = JSON.parse(opened.data) as Partial<SaveState> & { settings?: Partial<Settings> };
      const owned = strArr(p.ownedSkins);
      if (!owned.includes("sunbird")) owned.unshift("sunbird");
      const quality = p.settings?.quality;
      const deviceId = typeof p.deviceId === "string" && p.deviceId ? p.deviceId : d.deviceId;
      // Build on top of defaults() so the loaded object keeps EXACTLY the same
      // key order as a fresh save — exportCode() stringifies this object, and
      // the code must be byte-identical across a reload (persistence gate).
      const parsedState: SaveState = {
        ...d,
        bestScore: num(p.bestScore),
        bestDistance: num(p.bestDistance),
        totalCoins: num(p.totalCoins),
        wallet: p.wallet === undefined ? num(p.totalCoins) : num(p.wallet),
        nestLevel: num(p.nestLevel),
        completedMissions: strArr(p.completedMissions),
        nestBought: num(p.nestBought),
        starterPack: Boolean(p.starterPack),
        highScores: Array.isArray(p.highScores)
          ? p.highScores
              .map((h) => ({
                date: String(h.date ?? ""),
                distance: num(h.distance),
                coins: num(h.coins),
                score: num(h.score),
                vip: Boolean(h.vip),
                island: num(h.island),
              }))
              .slice(0, 8)
          : [],
        gold: Boolean(p.gold),
        vip: Boolean(p.vip),
        vipUntil: num(p.vipUntil),
        vipLastClaim: typeof p.vipLastClaim === "string" ? p.vipLastClaim : "",
        ads:
          p.ads && typeof p.ads.day === "string"
            ? { day: p.ads.day, count: num(p.ads.count), lastRun: num(p.ads.lastRun) }
            : { day: "", count: 0, lastRun: -999 },
        ownedSkins: owned,
        activeSkin: typeof p.activeSkin === "string" ? p.activeSkin : "sunbird",
        armedBoosts: strArr(p.armedBoosts),
        ownedUpgrades: strArr(p.ownedUpgrades),
        settings: {
          mute: Boolean(p.settings?.mute),
          doubleTapBoost: p.settings?.doubleTapBoost === undefined ? true : Boolean(p.settings.doubleTapBoost),
          music: p.settings?.music === undefined ? true : Boolean(p.settings.music),
          musicVolume:
            p.settings?.musicVolume !== undefined
              ? Math.max(0, Math.min(1, Number(p.settings.musicVolume) || 0))
              : 0.8,
          sfxVolume:
            p.settings?.sfxVolume !== undefined
              ? Math.max(0, Math.min(1, Number(p.settings.sfxVolume) || 0))
              : 0.9,
          musicTrack:
            p.settings?.musicTrack === "shuffle"
              ? "shuffle"
              : typeof p.settings?.musicTrack === "number"
                ? Math.max(0, Math.min(TRACK_NAMES.length - 1, Math.floor(p.settings.musicTrack)))
                : "shuffle",
          haptics: p.settings?.haptics === undefined ? true : Boolean(p.settings.haptics),
          reduceMotion: Boolean(p.settings?.reduceMotion),
          colorAssist: Boolean(p.settings?.colorAssist),
          bigText: Boolean(p.settings?.bigText),
          quality: quality === "high" || quality === "low" ? quality : "auto",
          distUnit: p.settings?.distUnit === "mi" ? "mi" : "km",
          // Undefined (a save from before this existed) means on, matching
          // DEFAULT_SETTINGS — an explicit `false` is respected.
          autoShop: p.settings?.autoShop === undefined ? true : Boolean(p.settings.autoShop),
        },
        quests:
          p.quests && typeof p.quests.date === "string"
            ? { date: p.quests.date, claimed: strArr(p.quests.claimed) }
            : d.quests,
        streak:
          p.streak && typeof p.streak.last === "string"
            ? { last: p.streak.last, days: num(p.streak.days), claimedDate: String(p.streak.claimedDate ?? "") }
            : d.streak,
        redeemedCodes: strArr(p.redeemedCodes),
        firstPlayed: typeof p.firstPlayed === "string" ? p.firstPlayed : "",
        runsPlayed: num(p.runsPlayed),
        lifetime: {
          distance: num(p.lifetime?.distance),
          coins: num(p.lifetime?.coins),
          zeniths: num(p.lifetime?.zeniths),
          ghostBeats: num(p.lifetime?.ghostBeats),
          sunflowers: num(p.lifetime?.sunflowers),
        },
        achievements: strArr(p.achievements),
        season:
          p.season && typeof p.season.id === "string"
            ? {
                id: p.season.id,
                xp: num(p.season.xp),
                claimedFree: numArr(p.season.claimedFree),
                claimedPremium: numArr(p.season.claimedPremium),
              }
            : d.season,
        deviceId,
        referralCode: typeof p.referralCode === "string" && p.referralCode ? p.referralCode : codeFromId(deviceId),
        referralRedeemed: Boolean(p.referralRedeemed),
        farthestIsland: num(p.farthestIsland),
        biomesSeen: strArr(p.biomesSeen),
        claimedCollections: strArr(p.claimedCollections),
        tutorialRuns: num(p.tutorialRuns),
        firstFlightDone: Boolean(p.firstFlightDone),
        onboardingSeen: strArr(p.onboardingSeen),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seenShop: Boolean((p as any).seenShop),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seenPvp: Boolean((p as any).seenPvp),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seenPve: Boolean((p as any).seenPve),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seenLeaderboards: Boolean((p as any).seenLeaderboards),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seenChallenges: Boolean((p as any).seenChallenges),
        skill: p.skill === undefined ? 0.25 : num(p.skill),
        skillSamples: num(p.skillSamples),
        bestAltitude: num(p.bestAltitude),
        bestCombo: num(p.bestCombo),
        tournaments:
          p.tournaments && typeof p.tournaments.week === "string"
            ? {
                week: p.tournaments.week,
                entries:
                  p.tournaments.entries && typeof p.tournaments.entries === "object"
                    ? (p.tournaments.entries as TournamentState["entries"])
                    : {},
                trails: strArr(p.tournaments.trails),
                titles: strArr(p.tournaments.titles),
              }
            : emptyTournamentState(),
        activeTrail: typeof p.activeTrail === "string" ? p.activeTrail : "",
        pilotName: typeof p.pilotName === "string" ? p.pilotName : "",
        pilotNameCustomized: p.pilotNameCustomized === true,
        bestPlace: num(p.bestPlace),
        racesRun: num(p.racesRun),
        rival: parseRival(p.rival),
        duel:
          p.duel && typeof p.duel === "object"
            ? { wins: num(p.duel.wins), losses: num(p.duel.losses), streak: num(p.duel.streak), bestStreak: num(p.duel.bestStreak) }
            : { wins: 0, losses: 0, streak: 0, bestStreak: 0 },
        rankSeason:
          p.rankSeason && typeof p.rankSeason.id === "string"
            ? { id: p.rankSeason.id, peak: num(p.rankSeason.peak) || RIVAL_BASE_RATING }
            : { id: rankSeasonId(), peak: RIVAL_BASE_RATING },
        challenges:
          p.challenges && typeof p.challenges === "object"
            ? {
                dailyDate: String(p.challenges.dailyDate ?? ""),
                dailyDone: Boolean(p.challenges.dailyDone),
                dailiesDone: num(p.challenges.dailiesDone),
                gauntletWeek: String(p.challenges.gauntletWeek ?? ""),
                gauntletDone: numArr(p.challenges.gauntletDone),
                gauntletsCleared: num(p.challenges.gauntletsCleared),
              }
            : d.challenges,
        calendar:
          p.calendar && typeof p.calendar === "object"
            ? { cycleDay: num(p.calendar.cycleDay), lastClaim: String(p.calendar.lastClaim ?? "") }
            : d.calendar,
        mastery:
          p.mastery && typeof p.mastery === "object" && !Array.isArray(p.mastery)
            ? Object.fromEntries(Object.entries(p.mastery as Record<string, unknown>).map(([k, v]) => [k, num(v)]))
            : {},
        campaignClaimed: strArr(p.campaignClaimed),
        events:
          p.events && typeof p.events === "object"
            ? {
                week: String((p.events as Record<string, unknown>).week ?? ""),
                clearsThisWeek: num((p.events as Record<string, unknown>).clearsThisWeek),
                month: String((p.events as Record<string, unknown>).month ?? ""),
                clearsThisMonth: num((p.events as Record<string, unknown>).clearsThisMonth),
                claimedTrailMonth: String((p.events as Record<string, unknown>).claimedTrailMonth ?? ""),
              }
            : d.events,
        social: parseSocial(p.social),
        piggyBank:
          p.piggyBank && typeof p.piggyBank === "object"
            ? { coins: num(p.piggyBank.coins), maxCoins: num(p.piggyBank.maxCoins) || 1000 }
            : d.piggyBank,
        prestige:
          p.prestige && typeof p.prestige === "object"
            ? { level: num(p.prestige.level), multiplier: num(p.prestige.multiplier) || 1.0 }
            : d.prestige,
        wheel:
          p.wheel && typeof p.wheel === "object"
            ? { lastFreeSpin: String(p.wheel.lastFreeSpin ?? ""), spinsToday: num(p.wheel.spinsToday) }
            : d.wheel,
        // Optional claim records: these were missing from the parse literal,
        // so EVERY reload silently dropped them — the daily stipend and squad
        // quests could be re-claimed after each page load.
        lastStipendClaimed: String(p.lastStipendClaimed ?? ""),
        squadQuestsClaimed:
          p.squadQuestsClaimed && typeof p.squadQuestsClaimed === "object" && !Array.isArray(p.squadQuestsClaimed)
            ? Object.fromEntries(
                Object.entries(p.squadQuestsClaimed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
              )
            : {},
        rankPrizeSeason: String(p.rankPrizeSeason ?? ""),
        wingmanBundle: Boolean(p.wingmanBundle),
      };
      return parsedState;
    } catch {
      // Corruption recovery: never destroy a player's data. If we actually read
      // a blob but couldn't parse it, park it under a dedicated key before
      // booting clean, so it survives for manual recovery instead of being
      // silently overwritten by the next persist().
      if (raw !== null) {
        this.recoveredFromCorruption = true;
        try {
          storage.setItem(SAVE_KEY_CORRUPT, raw);
        } catch {
          /* ignore — nothing more we can do */
        }
      }
      return d;
    }
  }

  private persistNow(state: SaveState): void {
    // CRC32-sealed envelope: a silently truncated or bit-flipped write is
    // detectable on load (the load path quarantines it) instead of quietly
    // restoring wrong numbers. Portal cloud-save adapters receive the same
    // sealed string, so every copy of the save carries its own integrity seal.
    const raw = sealPayload(JSON.stringify(state));
    // Quota self-healing: regenerable caches (ghosts, journal, board cache)
    // are evicted to make room before this write is allowed to fail. Only a
    // truly unusable store (private-mode quota-zero sandbox) reaches the
    // degraded path — which is still reported, throttled, never thrown.
    const result = durableSetItem(SAVE_KEY, raw, { protectedKeys: [SAVE_KEY, SAVE_KEY_V1, SAVE_KEY_CORRUPT] });
    if (result.ok) {
      if (this.platformAdapter?.saveData) {
        void this.platformAdapter.saveData(SAVE_KEY, raw);
      }
      return;
    }
    if (result.evicted.length > 0) {
      this.onEviction?.(result.evicted);
    }
    const now = Date.now();
    if (now - this.lastPersistErrorAt > 10_000) {
      this.lastPersistErrorAt = now;
      this.onPersistError?.();
    }
  }

  persist(): void {
    this.persistNow(this.state);
  }

  recordRun(distance: number, coins: number, score: number, date: string, island = 0, biomeId = ""): void {
    const s = this.state;
    // Apply prestige coin multiplier bonus
    const prestigeBonus = Math.round(coins * ((s.prestige?.multiplier ?? 1.0) - 1));
    const totalRunCoins = coins + prestigeBonus;

    s.totalCoins += totalRunCoins;
    s.wallet += totalRunCoins;
    s.runsPlayed += 1;
    s.tutorialRuns += 1;
    s.lifetime.distance += distance;
    s.lifetime.coins += totalRunCoins;

    // Accumulate +20% bonus coins into Piggy Bank
    const bonusPiggy = Math.max(1, Math.round(totalRunCoins * 0.2));
    if (!s.piggyBank) s.piggyBank = { coins: 0, maxCoins: 1000 };
    s.piggyBank.coins = Math.min(s.piggyBank.maxCoins, s.piggyBank.coins + bonusPiggy);

    if (score > s.bestScore) s.bestScore = score;
    if (distance > s.bestDistance) s.bestDistance = distance;
    if (island > s.farthestIsland) s.farthestIsland = island;
    if (biomeId && !s.biomesSeen.includes(biomeId)) s.biomesSeen.push(biomeId);
    s.highScores.push({ date, distance, coins: totalRunCoins, score, vip: s.vip, island });
    s.highScores.sort((a, b) => b.score - a.score);
    s.highScores = s.highScores.slice(0, 8);
    this.persist();
  }

  smashPiggyBank(): number {
    const s = this.state;
    if (!s.piggyBank || s.piggyBank.coins <= 0) return 0;
    const amount = s.piggyBank.coins;
    s.piggyBank.coins = 0;
    s.wallet += amount;
    s.totalCoins += amount;
    this.persist();
    return amount;
  }

  performPrestige(): boolean {
    const s = this.state;
    if (s.nestBought < 5 && s.nestLevel < 5) return false;
    s.nestBought = 0;
    s.nestLevel = s.completedMissions.length;
    if (!s.prestige) s.prestige = { level: 0, multiplier: 1.0 };
    s.prestige.level += 1;
    s.prestige.multiplier = Number((1.0 + s.prestige.level * 0.25).toFixed(2));
    this.persist();
    return true;
  }

  canFreeWheelSpin(today: string): boolean {
    const s = this.state;
    if (!s.wheel) s.wheel = { lastFreeSpin: "", spinsToday: 0 };
    return s.wheel.lastFreeSpin !== today;
  }

  recordWheelSpin(today: string): void {
    const s = this.state;
    if (!s.wheel) s.wheel = { lastFreeSpin: "", spinsToday: 0 };
    if (s.wheel.lastFreeSpin !== today) {
      s.wheel.lastFreeSpin = today;
      s.wheel.spinsToday = 1;
    } else {
      s.wheel.spinsToday += 1;
    }
    this.persist();
  }

  addLifetimeZeniths(n: number): void {
    this.state.lifetime.zeniths += n;
    this.persist();
  }

  addLifetimeSunflowers(n: number): void {
    this.state.lifetime.sunflowers += n;
    this.persist();
  }

  /** @returns true when a personal record was beaten (drives the record banner). */
  noteRecords(altitude: number, combo: number): { altitude: boolean; combo: boolean } {
    const out = { altitude: false, combo: false };
    if (altitude > this.state.bestAltitude) {
      this.state.bestAltitude = altitude;
      out.altitude = true;
    }
    if (combo > this.state.bestCombo) {
      this.state.bestCombo = combo;
      out.combo = true;
    }
    if (out.altitude || out.combo) this.persist();
    return out;
  }

  /** Records a mass-race result. @returns true when it is a new best placing. */
  noteRacePlace(place: number, field: number): boolean {
    this.state.racesRun += 1;
    const better = this.state.bestPlace === 0 || (place > 0 && place < this.state.bestPlace);
    if (better) this.state.bestPlace = place;
    this.persist();
    void field;
    return better;
  }

  /**
   * Records a ranked 40-bird result into the on-device Rival rating.
   * Returns the rating delta and any streak bonus actually granted.
   * Local only — never synced, never a server rank.
   */
  recordRivalResult(place: number, field: number, mode: string, date: string, live = false): { delta: number; bonus: number; streak: number } {
    const r = this.state.rival;
    const p = Math.max(1, Math.min(Math.max(2, field), Math.floor(place)));
    const f = Math.max(2, Math.floor(field));
    const delta = ratingDelta(p, f, live);
    const won = p <= Math.max(1, Math.ceil(f * 0.25));
    r.rating = Math.max(0, r.rating + delta);
    this.state.rankSeason.peak = Math.max(this.state.rankSeason.peak, r.rating);
    if (won) {
      r.wins += 1;
      r.streak += 1;
      r.bestStreak = Math.max(r.bestStreak, r.streak);
    } else {
      r.losses += 1;
      r.streak = 0;
    }
    r.matches.push({ place: p, field: f, mode, date, won });
    if (r.matches.length > 8) r.matches.splice(0, r.matches.length - 8);
    const bonus = won ? streakBonus(r.streak) : 0;
    if (bonus > 0) {
      this.state.wallet += bonus;
      this.state.totalCoins += bonus;
    }
    this.persist();
    return { delta, bonus, streak: r.streak };
  }

  /**
   * Monthly ranked season rollover: soft-reset the rating toward base and pay
   * a coin reward for the peak division reached last season.
   * @returns the reward paid, or null when no rollover happened.
   */
  ensureRankSeason(): { coins: number; division: string } | null {
    const id = rankSeasonId();
    if (this.state.rankSeason.id === id) return null;
    const reward = seasonReward(this.state.rankSeason.peak);
    this.state.rival.rating = softResetRating(this.state.rival.rating);
    this.state.rival.streak = 0;
    this.state.rankSeason = { id, peak: this.state.rival.rating };
    this.state.wallet += reward.coins;
    this.state.totalCoins += reward.coins;
    this.persist();
    return { coins: reward.coins, division: reward.division.name };
  }

  /** Head-to-head duel result. Rating swing is a flat ±16 vs the duelist. */
  recordDuelResult(won: boolean, date: string): { delta: number; streak: number } {
    const d = this.state.duel;
    const delta = won ? 16 : -16;
    this.state.rival.rating = Math.max(0, this.state.rival.rating + delta);
    this.state.rankSeason.peak = Math.max(this.state.rankSeason.peak, this.state.rival.rating);
    if (won) {
      d.wins += 1;
      d.streak += 1;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
    } else {
      d.losses += 1;
      d.streak = 0;
    }
    this.state.rival.matches.push({ place: won ? 1 : 2, field: 2, mode: "duel", date, won });
    if (this.state.rival.matches.length > 8) this.state.rival.matches.splice(0, this.state.rival.matches.length - 8);
    this.persist();
    return { delta, streak: d.streak };
  }

  /** Marks today's daily challenge complete. @returns false if already done. */
  completeDaily(date: string): boolean {
    const c = this.state.challenges;
    if (c.dailyDate === date && c.dailyDone) return false;
    c.dailyDate = date;
    c.dailyDone = true;
    c.dailiesDone += 1;
    this.persist();
    return true;
  }

  isDailyDone(date: string): boolean {
    const c = this.state.challenges;
    return c.dailyDate === date && c.dailyDone;
  }

  /** Marks a gauntlet stage done. @returns "stage" | "clear" | null. */
  completeGauntletStage(week: string, index: number): "stage" | "clear" | null {
    const c = this.state.challenges;
    if (c.gauntletWeek !== week) {
      c.gauntletWeek = week;
      c.gauntletDone = [];
    }
    if (c.gauntletDone.includes(index)) return null;
    c.gauntletDone.push(index);
    const cleared = c.gauntletDone.length >= 3;
    if (cleared) c.gauntletsCleared += 1;
    this.persist();
    return cleared ? "clear" : "stage";
  }

  gauntletDone(week: string): number[] {
    const c = this.state.challenges;
    return c.gauntletWeek === week ? [...c.gauntletDone] : [];
  }

  /** Claims today's login-calendar day. @returns the new cycle day, or 0. */
  claimCalendar(today: string): number {
    const c = this.state.calendar;
    if (c.lastClaim === today) return 0;
    c.lastClaim = today;
    c.cycleDay = (c.cycleDay % 28) + 1;
    this.persist();
    return c.cycleDay;
  }

  /** Records a weekly-event clear. @returns clears this week / this month. */
  recordEventClear(week: string, month: string): { week: number; month: number } {
    const e = this.state.events;
    if (e.week !== week) {
      e.week = week;
      e.clearsThisWeek = 0;
    }
    if (e.month !== month) {
      e.month = month;
      e.clearsThisMonth = 0;
    }
    e.clearsThisWeek += 1;
    e.clearsThisMonth += 1;
    this.persist();
    return { week: e.clearsThisWeek, month: e.clearsThisMonth };
  }

  /** Marks the monthly theme trail as claimed for `month`. @returns false if already claimed. */
  claimThemeTrail(month: string): boolean {
    if (this.state.events.claimedTrailMonth === month) return false;
    this.state.events.claimedTrailMonth = month;
    this.persist();
    return true;
  }

  /** Claims a campaign chapter reward. @returns false if already claimed. */
  claimCampaign(chapterId: string): boolean {
    if (this.state.campaignClaimed.includes(chapterId)) return false;
    this.state.campaignClaimed.push(chapterId);
    this.persist();
    return true;
  }

  /** Counts a run toward per-mode mastery. @returns the new run count. */
  addMasteryRun(modeId: string): number {
    const n = (this.state.mastery[modeId] ?? 0) + 1;
    this.state.mastery[modeId] = n;
    this.persist();
    return n;
  }

  ownTrail(id: string): boolean {
    if (this.state.tournaments.trails.includes(id)) return false;
    this.state.tournaments.trails.push(id);
    this.persist();
    return true;
  }

  equipTrail(id: string): void {
    this.state.activeTrail = this.state.tournaments.trails.includes(id) ? id : "";
    this.persist();
  }

  markBiomeSeen(id: string): boolean {
    if (this.state.biomesSeen.includes(id)) return false;
    this.state.biomesSeen.push(id);
    this.persist();
    return true;
  }

  /** Onboarding: mark a tip as seen so it never shows again. */
  markOnboardingSeen(id: string): boolean {
    if (!this.state.onboardingSeen) this.state.onboardingSeen = [];
    if (this.state.onboardingSeen.includes(id)) return false;
    this.state.onboardingSeen.push(id);
    this.persist();
    return true;
  }

  /** Onboarding: mark a contextual screen as seen (shop, pvp, etc). */
  markSeen(area: "shop" | "pvp" | "pve" | "leaderboards" | "challenges"): void {
    const key = `seen${area.charAt(0).toUpperCase()}${area.slice(1)}` as keyof SaveState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(this.state as any)[key]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.state as any)[key] = true;
      this.persist();
    }
  }

  addGhostBeat(): void {
    this.state.lifetime.ghostBeats += 1;
    this.persist();
  }

  completeMission(id: string): boolean {
    if (this.state.completedMissions.includes(id)) return false;
    this.state.completedMissions.push(id);
    this.state.nestLevel = this.state.completedMissions.length + this.state.nestBought;
    this.persist();
    return true;
  }

  /** Price of the next bought nest level: 300, 450, 675… (×1.5 per level). */
  nestUpgradePrice(): number {
    return Math.round(300 * Math.pow(1.5, this.state.nestBought));
  }

  /** The coin sink: convert coins into a permanent score multiplier level. */
  buyNestUpgrade(): boolean {
    const price = this.nestUpgradePrice();
    if (this.state.nestBought >= 10) return false; // cap: +1.2x from purchases
    if (!this.spend(price)) return false;
    this.state.nestBought += 1;
    this.state.nestLevel = this.state.completedMissions.length + this.state.nestBought;
    this.persist();
    return true;
  }

  unlockAchievement(id: string): boolean {
    if (this.state.achievements.includes(id)) return false;
    this.state.achievements.push(id);
    this.persist();
    return true;
  }

  nestMultiplier(): number {
    const base = 1 + this.state.nestLevel * NEST_MULT_PER_LEVEL;
    // VIP: the nest works 25% harder while the subscription is active.
    return this.isVipActive() ? 1 + (base - 1) * 1.25 : base;
  }

  spend(amount: number): boolean {
    if (this.state.wallet < amount) return false;
    this.state.wallet -= amount;
    this.persist();
    return true;
  }

  /**
   * Award coins. Every coin in the game arrives here, which is what makes it
   * the right place for multipliers: a bonus applied at one of the ~20 award
   * sites would be missed by the other nineteen.
   *
   * Two independent multipliers stack multiplicatively:
   *   • permanent — owning `goldenfeather` (see COIN_MULTIPLIER_UPGRADES)
   *   • timed — `luckycoin`, armed for a run by `setCoinBonus()`
   * The awarded amount is rounded UP so a 1-coin pickup is never silently
   * rounded back down to 1 by a 1.1× bonus (a bonus that does nothing on small
   * awards reads as a broken purchase).
   */
  /**
   * Stamps the first-session day the first time it is asked, then leaves it
   * alone forever. @returns true when this call is the one that stamped it, so
   * the caller can tell a brand-new player from a returning one without
   * reading the field back.
   */
  noteFirstPlayed(date: string): boolean {
    if (this.state.firstPlayed) return false;
    this.state.firstPlayed = date;
    this.persist();
    return true;
  }

  addCoins(amount: number): void {
    const awarded = Math.max(0, Math.ceil(amount * this.coinMultiplier()));
    this.state.wallet += awarded;
    this.state.totalCoins += awarded;
    this.persist();
  }

  /** Arm a timed coin multiplier (the `luckycoin` boost). Re-arming extends. */
  setCoinBonus(multiplier: number, seconds: number): void {
    this.coinBonus = Math.max(1, multiplier);
    this.coinBonusUntil = Date.now() + Math.max(0, seconds) * 1000;
  }

  /** Combined multiplier in effect right now (>= 1). */
  coinMultiplier(): number {
    let mult = 1;
    for (const [id, value] of Object.entries(COIN_MULTIPLIER_UPGRADES)) {
      if (this.state.ownedUpgrades.includes(id)) mult *= value;
    }
    if (this.coinBonus > 1 && Date.now() < this.coinBonusUntil) mult *= this.coinBonus;
    else this.coinBonus = 1;
    return mult;
  }

  ownSkin(id: string): void {
    if (!this.state.ownedSkins.includes(id)) this.state.ownedSkins.push(id);
    this.persist();
  }

  equipSkin(id: string): void {
    if (!this.state.ownedSkins.includes(id)) return;
    this.state.activeSkin = id;
    this.persist();
  }

  armBoost(id: string): void {
    if (!this.state.armedBoosts.includes(id)) this.state.armedBoosts.push(id);
    this.persist();
  }

  hasUpgrade(id: string): boolean {
    return this.state.ownedUpgrades.includes(id);
  }

  ownUpgrade(id: string): boolean {
    if (this.state.ownedUpgrades.includes(id)) return false;
    this.state.ownedUpgrades.push(id);
    this.persist();
    return true;
  }

  consumeArmedBoosts(): string[] {
    const list = [...this.state.armedBoosts];
    this.state.armedBoosts = [];
    this.persist();
    return list;
  }

  setGold(v: boolean): void {
    this.state.gold = v;
    this.persist();
  }

  /** VIP is a real monthly subscription: it accrues from now (or extends) and expires. */
  grantVip(days = VIP_DAYS): void {
    const base = this.isVipActive() && this.state.vipUntil > Date.now() ? this.state.vipUntil : Date.now();
    this.state.vip = true;
    this.state.vipUntil = base + days * 86_400_000;
    this.persist();
  }

  setVip(v: boolean): void {
    this.state.vip = v;
    this.state.vipUntil = v ? Date.now() + VIP_DAYS * 86_400_000 : 0;
    this.persist();
  }

  isVipActive(): boolean {
    if (!this.state.vip) return false;
    if (this.state.vipUntil && Date.now() > this.state.vipUntil) {
      this.state.vip = false;
      this.persist();
      return false;
    }
    return true;
  }

  vipDaysLeft(): number {
    if (!this.isVipActive() || !this.state.vipUntil) return 0;
    return Math.max(0, Math.ceil((this.state.vipUntil - Date.now()) / 86_400_000));
  }

  claimVipDaily(today: string): number {
    if (!this.isVipActive() || this.state.vipLastClaim === today) return 0;
    this.state.vipLastClaim = today;
    this.addCoins(VIP_DAILY_GIFT);
    return VIP_DAILY_GIFT;
  }

  /* ---------- advertising frequency caps (enforced, not decorative) ---------- */

  adsLeftToday(cap = ADS_PER_DAY): number {
    const day = dateSeed();
    if (this.state.ads.day !== day) return cap;
    return Math.max(0, cap - this.state.ads.count);
  }

  shouldShowInterstitial(runsPlayed: number, every = INTERSTITIAL_EVERY, cap = ADS_PER_DAY): boolean {
    if (runsPlayed < 2) return false;
    if ((runsPlayed - 2) % every !== 0) return false;
    if (runsPlayed - this.state.ads.lastRun < AD_MIN_RUN_GAP) return false;
    return this.adsLeftToday(cap) > 0;
  }

  recordAdImpression(runsPlayed: number): void {
    const day = dateSeed();
    const a = this.state.ads;
    if (a.day !== day) {
      a.day = day;
      a.count = 0;
    }
    a.count += 1;
    a.lastRun = runsPlayed;
    this.persist();
  }

  redeem(code: string): boolean {
    if (this.state.redeemedCodes.includes(code)) return false;
    this.state.redeemedCodes.push(code);
    this.persist();
    return true;
  }

  redeemReferral(code: string): boolean {
    const clean = code.trim().toUpperCase();
    if (!clean || clean === this.state.referralCode || this.state.referralRedeemed) return false;
    if (!/^SUN-[A-Z0-9]{6}$/.test(clean)) return false;
    this.state.referralRedeemed = true;
    this.persist();
    return true;
  }

  touchStreak(today: string, yesterday: string): number {
    const s = this.state.streak;
    if (s.claimedDate === today) return 0;
    // Check for comeback BEFORE overwriting s.last
    const isComeback = s.last !== yesterday && s.last !== today && s.days > 0;
    if (s.last === yesterday) s.days += 1;
    else if (s.last !== today) s.days = 1;
    s.last = today;
    s.claimedDate = today;
    const reward = 20 * Math.min(7, Math.max(1, s.days));
    this.state.wallet += reward;
    this.state.totalCoins += reward;
    // Comeback bonus: only when returning after missing days (not day 1)
    if (isComeback) {
      const comebackBonus = 50;
      this.state.wallet += comebackBonus;
      this.state.totalCoins += comebackBonus;
    }
    this.persist();
    return reward;
  }

  questsClaimed(date: string): string[] {
    return this.state.quests.date === date ? this.state.quests.claimed : [];
  }

  claimQuest(date: string, id: string): void {
    if (this.state.quests.date !== date) this.state.quests = { date, claimed: [] };
    if (!this.state.quests.claimed.includes(id)) this.state.quests.claimed.push(id);
    this.persist();
  }

  exportCode(): string {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));
    } catch {
      return "";
    }
  }

  importCode(code: string): boolean {
    try {
      const json = decodeURIComponent(escape(atob(code.trim())));
      const parsed = JSON.parse(json) as Partial<SaveState>;
      if (typeof parsed !== "object" || parsed === null || !("deviceId" in parsed)) return false;
      // Whitelist only known fields to prevent injection of arbitrary keys.
      const allowed: Record<string, unknown> = {};
      for (const k of Object.keys(defaults())) {
        if (k in parsed) (allowed as Record<string, unknown>)[k] = (parsed as Record<string, unknown>)[k];
      }
      storage.setItem(SAVE_KEY, JSON.stringify(allowed));
      this.state = this.load();
      return true;
    } catch {
      return false;
    }
  }

  resetProgress(): void {
    this.state = defaults();
    this.persist();
  }
}
