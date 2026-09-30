import { browseSkins, newShopBrowse, nextBird, type ShopBrowse } from "./ShopBrowse";
import { flightTakeaway } from "./FlightGuidance";
import { menuIcon, menuIconSm, menuHorizon, arrowUpRightSvg, arrowRightSvg, type MenuIconName } from "./MenuIcons";
import { paginate } from "./Pagination";
import { flockLoadingMark } from "./FlockLoading";
// Only what the home menu actually renders. `renderMain` lays every section
// out as one scroll, so there is no tab strip to drive and nothing else to
// import.
import { seasonReward } from "./pvp";
import { PLAY_DESTINATIONS, PROGRESS_DESTINATIONS, QUICK_ACTIONS, destinationByKey, tournamentCountdownCard, type MenuDestination } from "./MenuCatalog";
import { shouldShowDailyBanner } from "./Engagement";
import { OverlayNavigation } from "./OverlayNavigation";
import { MenuContinuity } from "./MenuContinuity";
import { MenuSky } from "./MenuSky";
import { feedbackSlot } from "./HudFeedback";
import type { AchievementView } from "./Achievements";
import type { ActivePower } from "./PowerUps";
import type { SessionGoal } from "./Engagement";
import { PVP_MODES, type ModeDef, type PvpWorldCourse, type ModeId } from "./Modes";
import type { RacerStats } from "./Racer";
import { CUSTOM_PILOT_NAMES, LEADERBOARD_CLOUD_LABEL, POKI_EDITION, PORTAL_DISPLAY_NAME, PORTAL_EDITION_NOTE, SELL_AD_REMOVAL, SIMULATED_BREAKS, SQUAD_CHAT } from "./edition";
import { leaderboardBackend } from "./Leaderboard";
import type { BoardMetric, BoardPage, BoardScope } from "./Leaderboard";
import type { TournamentView } from "./Tournaments";
import type { RosterBird, Standing, RivalNameTag } from "./MassRace";
import { formatNumberLocalized, SUPPORTED_LOCALES, getLocale, t } from "../i18n";
import * as THREE from "three";
import { DAILY_STIPEND, PIGGY_BANK_CAP, PIGGY_BANK_MIN_SMASH, SHOP_AD_COINS, SHOP_AD_SESSION_CAP, VIP_DAILY_GIFT } from "./constants";
import { TRAILS } from "./Tournaments";
import { COLLECTIONS, dailyFlashBird, GOLD, skinById, STARTER_PACK, VIP, type BoostView, type ShopTrailView, type SkinView } from "./Economy";
import { rivalPalette, skinPalette, skinShape, sunSVG, sunbirdSVG } from "./Sunbird";
import { formatDistance } from "./math";
import type { MissionRow, MissionView, QuestReward, QuestView } from "./Missions";
import type { CampaignChapterView } from "./Campaign";
import type { MonthlyTheme, WeeklyEvent } from "./Events";
import { SQUAD_QUESTS, type SquadState } from "./Squad";
import type { FriendChallenge } from "./SocialSystem";
import { seenAgo, type FlightMate } from "./pilots";
import type { HighScore, Settings } from "./SaveData";
import { TRACK_NAMES } from "./Music";
import type { TierView } from "./SeasonPass";
import { growthLedger } from "./GrowthLedger";
import type { CelebrationView } from "./ProgressBeats";
import { streakOpacity } from "./SpeedFeel";
import { medalStanding, type Medal } from "./RunMedals";

export type UiScreen =
  | "progress"
  | "practice"
  | "main"
  | "shop"
  | "paywall"
  | "checkout"
  | "settings"
  | "scores"
  | "pass"
  | "trophies"
  | "account"
  | "atlas"
  | "modes"
  | "board"
  | "cups"
  | "live"
  | "rank"
  | "challenges"
  | "campaign"
  | "squad"
  | "nameEntry";

/** The home screen's launch CTA. Handed to MenuContinuity as the anchor for a
 * restored view: whatever the player last scrolled, landing on the home menu
 * must never park the one button that starts a run above the fold. */
const LAUNCH_CTA = ".home-launch";

/** The medal line's copy. `toNext` null means the ladder is topped, which says
 *  so rather than going blank — an empty slot reads as a bug, and "maxed" is
 *  the payoff for clearing every rung. */
function medalText(earned: Medal, toNext: number | null): string {
  if (toNext === null) return "◆ Maxed";
  if (earned === "none") return `${toNext} m to first medal`;
  return `${toNext} m to next`;
}
/** In-flight quest strip: how close a quest must be before it earns screen
 *  space mid-run. Matches `closestGoalLine`'s default, deliberately — one
 *  threshold, so the footer and the strip can never disagree. */
const IN_FLIGHT_MISSION_MIN_PCT = 0.5;
/** Longest single-run distance, used to decide whether a mid-run goal is
 *  actually actionable. Measured from the shipped build: a good run reaches
 *  ~2.8 km. A goal further out than this cannot be moved in one run, so showing
 *  it mid-flight is showing a bar that cannot move. */
const RUN_REACHABLE_M = 3000;

/** Stable screen identifiers used by automation, telemetry, and QA. */
export const SCREEN = {
  // `board` is the leaderboard's own screen and `savedScores` is the "Your
  // scores" one. They used to share a slot: `leaderboard` pointed at "scores",
  // which is the saved-scores screen's value, so the leaderboard rendered the
  // saved-scores heading and icon and vice versa.
  leaderboard: "board", savedScores: "scores",
  raceLobby: "live", aiPvp: "practice", challenges: "challenges",
  campaign: "campaign", squad: "squad", rivalRank: "rank", tournaments: "cups",
  gameModes: "modes", atlas: "atlas", shop: "shop", coinStore: "paywall",
  confirmUnlock: "checkout", highGlides: "progress", nestPass: "pass",
  trophyCase: "trophies", account: "account",
} as const;
/**
 * The English heading for each screen key.
 *
 * These are the `defaultText` passed to `t()`, so the screen shows correct
 * English before a pack lands — and they are asserted word-for-word against the
 * barrel's `sourceText` by screen-titles.test.ts, which keeps the fallback from
 * drifting away from the thing translators are actually translating.
 */
export const SCREEN_HEADINGS: Readonly<Record<keyof typeof SCREEN, string>> = {
  leaderboard: "Leaderboard",
  savedScores: "Your scores",
  raceLobby: "Race Lobby",
  aiPvp: "AI PvP",
  challenges: "Challenges",
  campaign: "The Long Migration",
  squad: "Squad",
  rivalRank: "Rival Rank",
  tournaments: "Tournaments",
  gameModes: "Game modes",
  atlas: "Island Atlas",
  shop: "Shop",
  coinStore: "Coin Store",
  confirmUnlock: "Confirm Unlock",
  highGlides: "High glides",
  nestPass: "Nest Pass",
  trophyCase: "Trophy Case",
  account: "Account",
};

/**
 * Screen id → its barrel key and English fallback.
 *
 * `en` used to be set to the camelCase *key* rather than the English heading,
 * which made the "fallback === sourceText" assertion in screen-titles.test.ts
 * compare "leaderboard" against "Leaderboard" and fail on every screen.
 */
export const SCREEN_TITLES: Readonly<Record<string, { key: string; en: string }>> = Object.fromEntries(
  Object.entries(SCREEN).map(([key, value]) => [
    value,
    { key: `hud.screen.${key}.title`, en: SCREEN_HEADINGS[key as keyof typeof SCREEN] ?? key },
  ]),
);

export type RivalCard = {
  rating: number;
  division: string;
  divisionIcon: string;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  nextName: string;
  nextNeeded: number;
  progress: number;
  matches: { place: number; field: number; mode: string; date: string; won: boolean }[];
  season: { daysLeft: number; peak: number; peakDivision: string; peakIcon: string; rewardCoins: number };
};

export type LoadoutView = {
  bird: string;
  trail: string;
  boosts: number;
  /** Preview of what the ranked duel fair-play cap does to this bird's perks. */
  rankedNote: string;
};

export type AtlasEntry = {
  island: number;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  reached: boolean;
  hazard: string;
};
export type UiState = "menu" | "playing" | "paused" | "continue" | "ad" | "gameover";
export type SeedMode = "today" | "yesterday" | "random";
export type CheckoutMode = "demo";
export type PortalName = "none" | "poki";

export type HudSnapshot = {
  state: UiState;
  screen: UiScreen;
  checkoutSku: "sunbird_gold" | "sunbird_vip" | "sunbird_starter";
  portalName: PortalName;
  version: number;
  distance: number;
  coins: number;
  /** True once this run's 3× coin bonus has been claimed (one claim per run). */
  multiplierClaimed: boolean;
  daylight: number;
  daylightMax: number;
  fever: number;
  feverOn: boolean;
  multiplier: number;
  bestDistance: number;
  score: number;
  island: number;
  perfects: number;
  clouds: number;
  zeniths: number;
  rings: number;
  balloons: number;
  sunflowers: number;
  hint: string;
  magnetTimer: number;
  shield: number;
  boostTimer: number;
  gold: boolean;
  vip: boolean;
  vipDaysLeft: number;
  vipExpiredNotice: boolean;
  adsLeftToday: number;
  /** True when the portal offers its own leaderboard overlay. */
  portalLeaderboard: boolean;
  ghostDelta: number | null;
  /** True when this finished run beat the previous personal-best distance. */
  newBest: boolean;
  continueTimer: number;
  /** Context-driven reason line for the continue card (Poki MON-19). */
  continueReason: string;
  /** True when the offer context is worth a little extra emphasis (still optional). */
  continueHighlight: boolean;
  continueCost: number;
  canAffordContinue: boolean;
  adAvailable: boolean;
  adTimer: number;
  adTotal: number;
  adReason: "continue" | "interstitial";
  /**
   * Whether the GAME may end this break. Only the non-portal placeholder ad is
   * game-driven (it runs a local countdown and the player waits it out). A
   * portal-served break is owned by the SDK: it ends when the platform's ad
   * promise resolves, so the game must not render or enable a skip that would
   * cut it short and still award the reward.
   */
  adSkippable: boolean;
  seedLabel: string;
  /** Career wings: lifetime-distance rank shown on the title screen. */
  wings: { icon: string; name: string; progress: number; nextName: string; nextNeeded: number; lifetime: number };
  /** Flight recap: downsampled [metresFromStart, altitude] profile. */
  flightPath: [number, number][];
  /** Active incoming rival challenge: "name|distance", or "" when none. */
  rivalBanner: string;
  seedMode: SeedMode;
  wallet: number;
  streakDays: number;
  nestLevel: number;
  nestPrice: number;
  nestMaxed: boolean;
  nestMult: number;
  missions: MissionView[];
  quests: QuestView[];
  highScores: HighScore[];
  todayBest: number;
  runsPlayed: number;
  newlyCompleted: string[];
  claimedQuests: QuestReward[];
  skins: SkinView[];
  boosts: BoostView[];
  shopTrails: ShopTrailView[];
  settings: Settings;
  /** First-visit milestones for the home walkthrough. Stored, not derived:
   *  "did you open the shop" has no counter that means only that. */
  firstSteps: { shop: boolean; pve: boolean; pvp: boolean; settings: boolean };
  goldPrice: string;
  starterPrice: string;
  starterFeatures: string[];
  starterOwned: boolean;
  goldFeatures: string[];
  vipPrice: string;
  vipFeatures: string[];
  checkoutMode: CheckoutMode;
  checkoutUrl: string;
  checkoutBusy: boolean;
  checkoutError: string;
  checkoutOk: boolean;
  checkoutWaiting: boolean;
  restoreMessage: string;
  resetArmed: boolean;
  season: { tier: number; maxTier: number; have: number; need: number; label: string; tiers: TierView[] };
  trophies: AchievementView[];
  trophyCounts: { unlocked: number; total: number };
  /** Closest-to-completion locked trophy, surfaced during flight (or null once every trophy is unlocked). */
  nearestTrophy: AchievementView | null;
  referralCode: string;
  referralRedeemed: boolean;
  referralMessage: string;
  cloudCode: string;
  cloudMessage: string;
  canInstall: boolean;
  shareBusy: boolean;
  /** A/B test "results_cta_order": when true, the Share CTA leads the card. */
  expShareFirst: boolean;
  combo: number;
  speedNorm: number;
  gust: number;
  inThermal: boolean;
  biomeName: string;
  biomeEmoji: string;
  atlas: AtlasEntry[];
  farthestIsland: number;
  showTutorialHand: boolean;
  /* --- momentum / flight readouts --- */
  /** How the run ended, so the card can say so. */
  endReason: "daylight" | "water" | "settled";
  launchBanner: string;
  launchBannerT: number;
  launchRating: string;
  /** The perfect-launch chain, and how loudly to present it (see ChainFlair). */
  chain: number;
  chainTier: string;
  chainLabel: string;
  chainScale: number;
  chainPulse: number;
  altitude: number;
  altZone: number;
  maxAltitude: number;
  powers: ActivePower[];
  modes: ModeDef[];
  modeId: string;
  modeName: string;
  modeIcon: string;
  countdown: number;
  versus: boolean;
  splitLayout: "off" | "vertical" | "horizontal";
  versusWinner: number;
  p1Stats: RacerStats | null;
  p2Stats: RacerStats | null;
  raceFinish: number;
  /* --- engagement --- */
  sessionGoals: SessionGoal[];
  /** Nearest beat-the-mark flag in the cue window, or null when nothing is close. */
  beatLine: { kind: string; label: string; metres: string; gap: number } | null;
  /** One-line next-action message shown on the results card; empty string = omit. */
  nextAction: string;
  goalPop: string;
  goalPopKind: "goal" | "quest";
  rankUp: string;
  nearMiss: string;
  skillLabel: string;
  skill: number;
  bestAltitude: number;
  bestCombo: number;
  runGems: number;
  /* --- competitive --- */
  pilotName: string;
  board: BoardPage | null;
  boardLoading: boolean;
  boardScope: BoardScope;
  boardMetric: BoardMetric;
  boardOnline: boolean;
  /**
   * Top three pilots from the board already cached at menu time, for the home
   * strip. Empty until a page is in hand — the strip then renders nothing at
   * all rather than an empty box, and no extra request is made to fill it.
   */
  homeBoard: { name: string; value: string; you: boolean }[];
  /** Signed-in portal username, or "" when signed out / no portal accounts. */
  portalAccountName: string;
  /** Live sky-ring chain: how many in a row, and how long the window is open. */
  ringChain: number;
  ringChainFrac: number;
  slopeChain: number;
  slopeScore: number;
  cups: TournamentView[];
  trails: { id: string; label: string; equipped: boolean }[];
  /** Cup title prizes, which are worn beside the pilot's name. */
  titles: { id: string; label: string }[];
  lastPrize: string;
  standings: Standing[];
  racePlace: number;
  /** Finish line in metres for the live race progress strip (0 = endless). */
  raceFinishM: number;
  raceField: number;
  raceFinishTime: number;
  massRace: boolean;
  multiplayerLive: boolean;
  /** True when this build has any live-race transport (URL or Poki Netlib). */
  multiplayerConfigured: boolean;
  /* --- live room + roster --- */
  roster: RosterBird[];
  roomCode: string;
  roomCount: number;
  roomCapacity: number;
  roomReady: boolean;
  roomReadyCount: number;
  /** True when the room is the local AI fallback, not networked pilots. */
  roomAiFallback: boolean;
  roomSize: number;
  roomSkill: string;
  roomMuted: boolean;
  roomRivals: { id: string; name: string; skill: number; hue: number }[];
  netState: string;
  linkQuality: "unknown" | "good" | "fair" | "poor";
  netError: string;
  draft: number;
  finishRemaining: number;
  nemesis: string;
  photoFinish: string;
  rival: RivalCard;
  loadout: LoadoutView;
  lobbyRivals: { name: string; tag: string; ready?: boolean; skin?: string }[];
  raceRated: boolean;
  /** True when the room server (single-threaded referee) confirmed the place. */
  raceVerified: boolean;
  ratingDelta: number;
  ratingBonus: number;
  /* --- duels --- */
  duel: { wins: number; losses: number; streak: number; bestStreak: number };
  duelWas: "" | "won" | "lost";
  duelDelta: number;
  duelFoe: { name: string; tag: string; rating: number };
  /* --- daily challenge / weekly gauntlet / calendar / mastery --- */
  daily: DailyCard;
  gauntlet: GauntletCard;
  calendar: CalendarCard;
  mastery: MasteryRow[];
  challengeOutcome: string;
  /* --- live-ops events + campaign + squad --- */
  weeklyEvent: WeeklyEvent;
  monthlyTheme: MonthlyTheme;
  eventClearsWeek: number;
  eventClearsMonth: number;
  themeTrailClaimed: boolean;
  themeTrailNeed: number;
  campaign: CampaignChapterView[];
  campaignDone: number;
  campaignTotal: number;
  squad: SquadState;
  /** Active ghost-race challenges (SocialSystem) — pending or accepted. */
  friendChallenges: FriendChallenge[];
  /** Real pilots from rooms this device shared — see src/game/pilots.ts. */
  recentPilots: FlightMate[];
  /** AUDS shared-run state (async multiplayer by code, Poki platform only). */
  share: {
    available: boolean;
    code: string;
    busy: boolean;
    error: string;
    loaded: { name: string; seed: string; mode: string; distance: number; timeMs: number; place: number; bird: string } | null;
  };
  squadNotice: string;
  dailyFlash?: { id: string; price: number; originalPrice: number; discountPct: number };
  stipendClaimed?: boolean;
  /** This month's rank prize has already been claimed (one per season). */
  rankPrizeClaimed: boolean;
  /** The one-time Ace Wingman crate was bought (it pays 250 for 240 — no re-claims). */
  wingmanBundle: boolean;
  /** Daily Login Ritual banner dismissed for today (Play now / explicit X). */
  dismissedDailyPrompt: boolean;
  /* --- monetization max value & portal loops --- */
  piggyCoins: number;
  prestigeLevel: number;
  prestigeMult: number;
  canFreeSpin: boolean;
  /* --- pvp modes & worlds catalog --- */
  pvpModes: ModeDef[];
  pvpWorlds: PvpWorldCourse[];
  selectedPvpMode: ModeId;
  selectedPvpWorld: string;
  /** Beats earned this run — results card celebration strip. */
  celebration: CelebrationView;
  /** Wings proximity bar — in-flight rank-up approach meter. */
  proximity: { visible: boolean; fill: number; remaining: number; name: string };
  /** Today's daily-quest bars, filled live. Empty when the HUD has no run. */
  missionRows: MissionRow[];
};

export type DailyCard = {
  title: string;
  modeName: string;
  modeIcon: string;
  modifierIcon: string;
  modifierLabel: string;
  modifierDesc: string;
  metric: string;
  target: number;
  reward: number;
  done: boolean;
  dailiesDone: number;
};

export type GauntletCard = {
  week: string;
  stages: { index: number; label: string; modeName: string; modeIcon: string; metric: string; target: number; reward: number; done: boolean }[];
  clearBonus: number;
  cleared: boolean;
  lifetimeClears: number;
};

export type CalendarCard = {
  cycleDay: number;
  claimedToday: boolean;
  days: { day: number; label: string; claimed: boolean; today: boolean; milestone: boolean }[];
};

export type MasteryRow = {
  modeId: string;
  name: string;
  icon: string;
  runs: number;
  level: number;
  nextAt: number | null;
  progress: number;
  /** Active perk line ("+4% coins" or the signature skill when maxed). */
  perk: string;
  /** Signature level-5 skill this mode builds toward. */
  skillName: string;
  skillDesc: string;
  maxed: boolean;
};

type ActionHandler = (action: string, id: string) => void;

/**
 * Emote wheel visibility. Deliberately a function of the race field ONLY —
 * there is no `state` argument, because the old `state === "playing"` gate hid
 * the wheel in the lobby, where a room's players actually gather. Emotes are
 * the platform-sanctioned alternative to chat (Poki REQ-31), so they must be
 * reachable wherever a field of racers exists.
 */
export function emoteWheelVisible(s: Pick<HudSnapshot, "massRace">): boolean {
  return Boolean(s.massRace);
}

/**
 * The action behind the results card's primary button — and behind a tap on the
 * bare backdrop beside that card, which is the same affordance with a larger hit
 * area.
 *
 * A placed mass race rematches at the same stakes (an online field goes back
 * through the honest search; a duel or an AI flock replays locally). Every other
 * run just flies again.
 *
 * Both callers must agree, so the decision lives here instead of being
 * re-derived inline at each site. It previously existed only inside the render
 * string, and the backdrop tap dispatched `restart-flight` — an action `Game`
 * honours only while paused or playing, so tapping the results backdrop was a
 * silent no-op. It looked like it worked because a touch on the bare overlay
 * also armed the dive gesture and `holdToStart()` restarted the run that way;
 * once overlays stopped arming gameplay gestures (they own the finger, so the
 * card can scroll and the tap can land) that accidental path disappeared and the
 * dead action was exposed.
 */
export function resultsPrimaryAction(
  s: Pick<HudSnapshot, "massRace" | "racePlace" | "duelWas">,
): "rematch" | "retry" {
  return s.massRace && s.racePlace > 0 && !s.duelWas ? "rematch" : "retry";
}

export class HUD {
  readonly root: HTMLDivElement;
  private readonly menuSky: MenuSky;
  private playHud!: HTMLElement;
  private distanceEl!: HTMLElement;
  private coinsEl!: HTMLElement;
  private bestEl!: HTMLElement;
  /** Live medal line under the distance block. */
  private medalLine!: HTMLElement;
  private lastMedalKey = "";
  private islandEl!: HTMLElement;
  private multEl!: HTMLElement;
  private goldChip!: HTMLElement;
  private vipChip!: HTMLElement;
  private ghostChip!: HTMLElement;
  private powersEl!: HTMLElement;
  private sunFill!: HTMLElement;
  private sunKnob!: HTMLElement;
  private feverWrap!: HTMLElement;
  private feverFill!: HTMLElement;
  private ringChainEl!: HTMLElement;
  private ringChainCount!: HTMLElement;
  private ringChainFill!: HTMLElement;
  private slopeChainEl!: HTMLElement;
  private slopeChainText!: HTMLElement;
  private slopeChainFill!: HTMLElement;
  private hintEl!: HTMLElement;
  private menuEl!: HTMLElement;
  private menuCard!: HTMLElement;
  private pauseEl!: HTMLElement;
  private pauseBtnEl!: HTMLElement;
  private muteBtnEl!: HTMLButtonElement;
  /** Live run-stats shown on the pause card (updated every frame while paused). */
  private pauseDistanceEl!: HTMLElement;
  private pauseAltitudeEl!: HTMLElement;
  private pauseComboEl!: HTMLElement;
  private pauseMuteBtn!: HTMLButtonElement;
  private pauseMuteIco!: HTMLElement;
  private pauseMuteLbl!: HTMLElement;
  /** Menu-sheet mute control. The play HUD's button only exists mid-flight, so
   *  the shell needs its own always-reachable toggle. */
  private menuMuteEl: HTMLButtonElement | null = null;
  private menuMuteShown: boolean | null = null;
  private playMuteShown: boolean | null = null;
  private pauseMuteShown: boolean | null = null;
  private contEl!: HTMLElement;
  private contCard!: HTMLElement;
  private adEl!: HTMLElement;
  private adCard!: HTMLElement;
  private overEl!: HTMLElement;
  private overCard!: HTMLElement;
  private toastLayer!: HTMLElement;
  private readonly liveToasts = new Map<string, { el: HTMLElement; count: number; timer: number }>();
  private flashEl!: HTMLElement;
  private comboEl!: HTMLElement;
  private biomeChip!: HTMLElement;
  private speedLines!: HTMLElement;
  private handEl!: HTMLElement;
  private handHintEl!: HTMLElement;
  private altGauge!: HTMLElement;
  private altFill!: HTMLElement;
  private altBird!: HTMLElement;
  private altRead!: HTMLElement;
  private launchBanner!: HTMLElement;
  private chainReadout!: HTMLElement;
  private powerStrip!: HTMLElement;
  private countdownEl!: HTMLElement;
  private versusBar!: HTMLElement;
  private goalStrip!: HTMLElement;
  private missionStrip!: HTMLElement;
  private goalPop!: HTMLElement;
  private rankUp!: HTMLElement;
  private standingsEl!: HTMLElement;
  private rosterBar!: HTMLElement;
  private matchmakingEl!: HTMLElement;
  private matchmakingTitle!: HTMLElement;
  private matchmakingCount!: HTMLElement;
  private matchmakingLabel!: HTMLElement;
  private matchmakingRooms!: HTMLElement;
  private matchmakingAi!: HTMLElement;
  private matchmakingKeep!: HTMLElement;
  private matchmakingReady!: HTMLElement;
  private draftMeter!: HTMLElement;
  private finishCd!: HTMLElement;
  private lastFinishCd = "";
  private emoteWheel!: HTMLElement;
  private emoteBubble!: HTMLElement;
  private emoteBubbleTimer = 0;
  private impactPopupsEl!: HTMLElement;
  private wingsNear!: HTMLElement;
  private lastStandings = "";
  private lastRoster = "";
  private lastRosterAt = 0;
  private lastStandingsAt = 0;
  private lastVersusKey = "";
  private lastGoals = "";

  private lastGoalPop = "";
  private lastMissionStrip = "";
  private lastPowers = "";
  private lastBanner = "";
  private lastCountdown = "";
  /**
   * Tournament countdown urgency (mid-week push): cup ids the "only N days
   * left" toast has already fired for. Never needs manual reset — a cup's
   * `def.id` embeds the ISO week (see Tournaments.weekKey), so it is a
   * different id every week regardless of when this HUD instance was made.
   */
  private tournamentPushed = new Set<string>();
  private lastCombo = -1;
  private lastBiome = "";
  private lastIsland = -1;
  /**
   * Mobile HUD declutter (P0 fix): the island chip only needs to grab
   * attention right when it changes — on a 375px phone it otherwise
   * permanently competes with the biome/multiplier chips for the same row.
   * `.recent` keeps it visible for 3s after a change; the pending timer (from
   * `this.after`, so `dispose()` already sweeps it) lets a second island
   * change — e.g. a fast restart — restart the window instead of letting an
   * earlier timeout hide it early.
   */
  private islandRecentTimer: number | null = null;
  /** Per-frame text write memoization: DOM writes only when content changes. */
  private readonly textCache = new Map<string, string>();
  private readonly styleCache = new Map<string, string>();

  private paintMute(button: HTMLButtonElement, muted: boolean): void {
    const label = muted ? "Unmute sound" : "Mute sound";
    const waves = muted ? '<path d="m16 9 6 6m0-6-6 6"/>'
      : '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>';
    button.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5z"/>${waves}</svg>`;
    button.setAttribute("aria-pressed", String(muted));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  private setText(el: HTMLElement, key: string, value: string): void {
    if (this.textCache.get(key) === value) return;
    this.textCache.set(key, value);
    el.textContent = value;
  }

  private setStyle(el: HTMLElement, key: string, prop: "width" | "height" | "opacity" | "left" | "bottom", value: string): void {
    const ck = `${key}:${prop}`;
    if (this.styleCache.get(ck) === value) return;
    this.styleCache.set(ck, value);
    el.style[prop] = value;
  }

  /** Flush caches when a full re-render happens so we don't skip first writes. */
  private flushCaches(): void {
    this.textCache.clear();
    this.styleCache.clear();
  }
  private contTimerEl: HTMLElement | null = null;
  private adBarEl: HTMLElement | null = null;
  private adSkipEl: HTMLButtonElement | null = null;
  private adHeaderEl: HTMLElement | null = null;
  private adLabelEl: HTMLElement | null = null;
  private lastKey = "";
  private lastHint = "";
  private readonly shopBrowse = newShopBrowse();
  private lastChainKey = "";
  private shopSnapshot: HudSnapshot | null = null;
  private currentSnapshot: HudSnapshot | null = null;
  private lastChips = "";
  private readonly tmpNameTagVec = new THREE.Vector3();
  /** Live nametag elements, reused per frame (see updateNameTags). */
  private readonly nameTagEls = new Map<string, HTMLDivElement>();
  private readonly nameTagKeys = new Map<string, string>();

  constructor(parent: HTMLElement) {
    this.menuSky = new MenuSky();
    this.root = document.createElement("div");
    this.root.className = "hud-root";
    this.root.innerHTML = `
      <div class="play-hud hidden" data-ref="playHud">
        <div class="top-bar">
          <div class="stat-block">
            <div class="stat-label">${t("hud.stat.distance", undefined, "Distance")}</div>
            <div class="stat-value" data-ref="distance">0 m</div>
            <div class="stat-sub">best <span data-ref="best">0</span></div>
            <div class="stat-medal" data-ref="medalLine"></div>
          </div>
          <div class="sun-meter" title="Daylight">
            <div class="sun-track">
              <div class="sun-fill" data-ref="sunFill"></div>
              <div class="sun-knob" data-ref="sunKnob">${menuIcon("daily")}</div>
            </div>
            <div class="sun-caption">${t("hud.stat.daylight", undefined, "daylight")}</div>
          </div>
          <div class="stat-block right">
            <div class="stat-label">${t("hud.stat.coins", undefined, "Coins")}</div>
            <div class="stat-value coin">${COIN_SVG}<span data-ref="coins">0</span></div>
          </div>
        </div>
        <div class="speedlines" data-ref="speedlines"></div>
        <div class="alt-gauge" data-ref="altGauge">
          <div class="alt-track">
            <span class="alt-zone z4"></span><span class="alt-zone z3"></span>
            <span class="alt-zone z2"></span><span class="alt-zone z1"></span>
            <i class="alt-fill" data-ref="altFill"></i>
            <b class="alt-bird" data-ref="altBird">${menuIcon("bird")}</b>
          </div>
          <div class="alt-read" data-ref="altRead">0 m</div>
        </div>
        <div class="chain-readout" data-ref="chainReadout" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="launch-banner" data-ref="launchBanner"></div>
        <div class="power-strip" data-ref="powerStrip"></div>
        <div class="goal-strip" data-ref="goalStrip"></div>
        <div class="mission-strip hidden" data-ref="missionStrip" role="list" aria-label="${escapeHtml(t("hud.progress.strip", undefined, "What this flight grew"))}"></div>
        <div class="goal-pop" data-ref="goalPop" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="rank-up" data-ref="rankUp" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="countdown" role="status" aria-live="assertive" aria-atomic="true" data-ref="countdown"></div>
        <div class="versus-bar hidden" data-ref="versusBar"></div>
        <div class="standings hidden" data-ref="standings"></div>
        <div class="roster-bar hidden" data-ref="rosterBar"></div>
        <div class="rival-nametag-container" data-ref="nametags"></div>
        <div class="draft-meter hidden" data-ref="draftMeter"><i></i><span>SLIPSTREAM</span></div>
        <div class="finish-countdown hidden" data-ref="finishCd"></div>
        <div class="emote-bubble hidden" data-ref="emoteBubble" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="emote-wheel hidden" data-ref="emoteWheel">
          <button class="emotes-toggle" data-ui data-action="toggle-emotes" aria-expanded="false" aria-controls="flight-emotes">💬 Emotes</button>
          <div class="emote-options hidden" id="flight-emotes">${[["👋", "Wave"], ["🔥", "Fire"], ["😂", "Laugh"], ["🙌", "Bravo"], ["👑", "Crown"], ["🤝", "GG"]].map(([icon, label]) => `<button data-ui data-action="emote" data-id="${icon}" aria-label="Send ${label}" title="Send ${label}">${icon} ${label}</button>`).join("")}</div>
        </div>
        <div class="mid-meta">
          <div class="island-chip" data-ref="island">${t("hud.ui.I1", undefined, "Island 1")}</div>
          <div class="biome-chip" data-ref="biome"></div>
          <div class="mult-chip" data-ref="mult">×1.0</div>
          <div class="gold-chip hidden" data-ref="goldChip">✦ GOLD</div>
          <div class="vip-chip hidden" data-ref="vipChip">♛ VIP</div>
          <div class="ghost-chip hidden" data-ref="ghostChip"></div>
        </div>
        <div class="power-chips" data-ref="powers"></div>
        <!-- Ring chain meter: the objective a long flight is chasing. Hidden
             until the first hoop of a chain, then it counts down the window so
             the player can see the next ring is still worth diving for. -->
        <div class="ring-chain hidden" data-ref="ringChain">
          <span class="ring-chain-icon" aria-hidden="true">🔥</span>
          <b data-ref="ringChainCount">×2</b>
          <i><s data-ref="ringChainFill"></s></i>
        </div>
        <!-- Colorblind-friendly: the flow chain used to be identified only by a
             coral-on-teal color and an ambiguous 〽 glyph — a shape cue (📐) plus
             a fill bar mirror the ring chain's own icon + count + bar pattern so
             color is never the only signal. -->
        <div class="slope-chain hidden" data-ref="slopeChain">
          <span class="slope-chain-icon" aria-hidden="true">📐</span>
          <span data-ref="slopeChainText">FLOW ×1</span>
          <i><s data-ref="slopeChainFill"></s></i>
        </div>
        <div class="fever-wrap hidden" data-ref="feverWrap">
          <div class="fever-label">FEVER</div>
          <div class="fever-bar"><div class="fever-fill" data-ref="feverFill"></div></div>
        </div>
        <button class="icon-btn mute-btn" data-ui data-action="set-mute" data-ref="muteBtn" aria-label="${t("hud.ui.MSound", undefined, "Mute sound")}" title="${t("hud.ui.MSoundx", undefined, "Mute sound")}"><span class="audio-glyph" aria-hidden="true"></span></button>
        <button class="icon-btn pause-btn" data-ui data-action="pause" data-ref="pauseBtn" aria-label="Pause">❙❙</button>
        <div class="combo" data-ref="combo"></div>
        <div class="hint" data-ref="hint" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="hand" data-ref="hand">☝<span class="hand-hint" data-ref="handHint"></span></div>
        <div class="wings-near hidden" data-ref="wingsNear"><i role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></i><span aria-hidden="true"></span></div></div>
      </div>

      <div class="overlay menu hidden" data-ref="menu"><div class="paper-card" data-ref="menuCard"></div></div>

      <div class="overlay pause hidden" data-ref="pause" role="dialog" aria-modal="true" aria-label="Paused">
        <div class="paper-card slim pause-card">
          <div class="pause-kicker">${t("hud.ui.FHOLD", undefined, "FLIGHT ON HOLD")}</div>
          <h2>${t("hud.ui.TBreath", undefined, "Take a breath")}</h2>
          <p class="tagline">Your run is safe. Adjust settings, grab boosts, or rally your flock — ready when you are.</p>
          <div class="pause-run-stats">
            <span class="prs"><em>Distance</em><b data-ref="pauseDistance">0 m</b></span>
            <span class="prs"><em>Altitude</em><b data-ref="pauseAltitude">0 m</b></span>
            <span class="prs"><em>Combo</em><b data-ref="pauseCombo">×1</b></span>
          </div>
          <div class="pause-actions">
            <button class="primary-btn pause-resume" data-ui data-action="resume"><span class="pause-action-icon">${menuIcon("flight")}</span>${t("hud.pause.resume", undefined, "Keep flying")}</button>
          </div>
          <div class="pause-quick-grid" role="group" aria-label="${t("hud.ui.QAccess", undefined, "Quick access")}">
            <button class="pause-q pause-mute" data-ui data-action="set-mute" data-ref="pauseMute" aria-pressed="false">
              <i data-ref="pauseMuteIco">${menuIcon("sound")}</i><span data-ref="pauseMuteLbl">${t("hud.ui.S", undefined, "Sound on")}</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="settings">
              <i>${menuIcon("settings")}</i><span>${t("hud.menu.settings", undefined, "Settings")}</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="shop">
              <i>${menuIcon("shop")}</i><span>Shop</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="board">
              <i>${menuIcon("board")}</i><span>${t("hud.pause.globalBoard", undefined, "Global Board")}</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="scores">
              <i>${menuIcon("scores")}</i><span>${t("hud.pause.myScores", undefined, "My Scores")}</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="pass">
              <i>${menuIcon("pass")}</i><span>${t("hud.ui.NPass", undefined, "Nest Pass")}</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="squad">
              <i>${menuIcon("squad")}</i><span>Squad</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="trophies">
              <i>${menuIcon("medal")}</i><span>Trophies</span>
            </button>
            <button class="pause-q" data-ui data-action="pause-to" data-id="progress">
              <i>${menuIcon("progress")}</i><span>Progress</span>
            </button>
            <button class="pause-q" data-ui data-action="toggle-fullscreen">
              <i>${menuIcon("fullscreen")}</i><span>Fullscreen</span>
            </button>
          </div>
          <div class="pause-exit-row">
            <button class="soft-btn" data-ui data-action="restart-flight"><span class="pause-inline-icon">${menuIcon("flight")}</span>${t("hud.pause.restart", undefined, "Restart flight")}</button>
            <button class="ghost-btn danger-btn" data-ui data-action="menu"><span class="pause-inline-icon">${menuIcon("daily")}</span>${t("hud.pause.exitMenu", undefined, "Exit to menu")}</button>
          </div>
          <p class="pause-exit-note">Resume keeps your momentum. Restart begins a fresh flight. Exit returns you to the launch pad.</p>
        </div>
      </div>

      <div class="overlay continue hidden" data-ref="continue"><div class="paper-card slim" data-ref="contCard"></div></div>
      <div class="overlay ad hidden" data-ref="ad"><div class="ad-card" data-ref="adCard"></div></div>
      <div class="overlay gameover hidden" data-ref="over"><div class="paper-card" data-ref="overCard"></div></div>

      <div class="toasts" data-ref="toasts" role="status" aria-live="polite" aria-atomic="false"></div>
      <div class="flash" data-ref="flash"></div>
      <div class="impact-popups" data-ref="impactPopups"></div>
      <div class="matchmaking hidden" data-ref="matchmaking" role="status" aria-live="polite">
        ${flockLoadingMark()}
        <div class="matchmaking-title" data-ref="matchmakingTitle">Searching for live pilots…</div>
        <div class="matchmaking-count" data-ref="matchmakingCount">0 live pilots</div>
        <div class="matchmaking-label" data-ref="matchmakingLabel">Searching for pilots…</div>
        <div class="matchmaking-rooms hidden" data-ref="matchmakingRooms"></div>
        <div class="btn-row mm-actions">
          <button class="primary-btn mm-ready hidden" data-ui data-ref="matchmakingReady" data-action="mm-ready">Ready up ✓</button>
          <button class="primary-btn gold mm-ai hidden" data-ui data-ref="matchmakingAi" data-action="mm-ai">🤖 Race the AI flock instead</button>
          <button class="soft-btn mm-keep hidden" data-ui data-ref="matchmakingKeep" data-action="mm-keep-search">${t("hud.ui.KSearching", undefined, "Keep searching")}</button>
          <button class="soft-btn mm-cancel" data-ui data-action="mm-cancel">Cancel</button>
        </div>
      </div>
    `;
    // Flow-based lanes reserve actual space; independently positioned counters,
    // chips and buttons used to overlap as soon as labels wrapped on phones.
    const play = this.root.querySelector<HTMLElement>('[data-ref="playHud"]')!;
    const lane = (className: string, selectors: string[], parent = play): HTMLElement => {
      const el = document.createElement("div");
      el.className = className;
      for (const selector of selectors) el.appendChild(this.root.querySelector(selector)!);
      parent.appendChild(el);
      return el;
    };
    const top = this.root.querySelector<HTMLElement>(".top-bar")!;
    // The top-right corner is one cluster: the combo multiplier with the mute
    // and pause buttons. It used to be appended into .mid-meta and pinned
    // absolutely, which put it in the roster strip's row on narrow screens.
    lane("hud-controls", ['[data-ref="muteBtn"]', '[data-ref="pauseBtn"]', '.combo'], top);
    // The top bar owns the top-right corner (mute/pause, and the ring counter),
    // so the active-booster pills sit directly under it — the lane order is what
    // puts them there, in normal flow, rather than an absolute offset that has
    // to be kept in sync with the button row's height.
    const header = lane("hud-header", [".top-bar", ".power-strip", ".mid-meta", ".power-chips", ".roster-bar", ".versus-bar"]);
    // `.chain-readout` belongs in this lane and was missing from the list.
    //
    // ui.css:5609 documents the intent — "In the flight-messages lane, not
    // floating at 22% of the screen… Lane placement is what the sibling
    // announcements already do and is size-proof" — and the rule sets
    // `position: static`, which only makes it a flow child INSIDE a lane. The
    // element was never added here, so it stayed a static in-flow child of
    // `.play-hud` itself: a full-width text block at the top of the play area.
    // That is the "CHAIN x2 prints over the distance bar" problem the comment
    // was written to prevent, arriving by a different route.
    //
    // It also escaped `e2e/layout.spec.ts`, whose overlap assertion names the
    // lanes — an element in no lane cannot be asserted into one. The assertion
    // picks it up automatically now that the lane exists.
    lane("flight-messages", [".launch-banner", ".hint", ".goal-pop", ".finish-countdown", ".countdown", ".chain-readout"]);
    // `.fever-wrap` stays in the footer lane: it is `position: static` there
    // (see `.flight-footer .fever-wrap`), so it is a flow child of the footer.
    // Moving it out made the absolutely-positioned base rule resolve against
    // `.play-hud` (`inset: 0`), which parked the meter at `top: 100%` — one
    // screen below the viewport, invisible while fever was active.
    const footer = lane("flight-footer", [".goal-strip", ".draft-meter", ".fever-wrap", ".emote-wheel"]);
    // The menu backdrop is the LIVE 3D gameplay world (Game.menuTick attract
    // flight): the painted 2D sky canvas stays OUT of the DOM so it never
    // covers the world, and its loop never starts. The hero-bird overlay
    // stays mounted (hidden) so MenuSky.dispose() keeps working unchanged.
    this.root.querySelector<HTMLElement>('[data-ref="menu"]')!.appendChild(this.menuSky.heroHost);
    this.menuSky.heroHost.classList.add("hidden");
    parent.appendChild(this.root);
    this.bind();
    this.overlayNavigation = new OverlayNavigation(this.root);
    // Observe only these small flow containers, not the full scene or per-frame
    // positions. Header/footer wrapping automatically reserves feedback space.
    this.resizeObs = new ResizeObserver(() => {
      // Measure the FULL offset from the play-hud edge so that absolutely-
      // positioned elements cleared by this variable actually sit below the
      // header (or above the footer). contentRect.height omits the play-hud
      // padding, causing the elements to land inside the header/footer.
      const hudRect = header.offsetParent?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
      for (const [name, px] of [
        ["header", header.getBoundingClientRect().bottom - hudRect.top],
        ["footer", hudRect.bottom - footer.getBoundingClientRect().top],
      ] as [string, number][]) {
        this.root.style.setProperty(`--hud-${name}-height`, `${px}px`);
      }
    });
    this.resizeObs.observe(header);
    this.resizeObs.observe(footer);
  }

  /** Matchmaking overlay: live pilot count + honest countdown to backfill. */
  /**
   * The search overlay. Two honest phases:
   *   searching — a live countdown to the room start, never to a bot race;
   *   waiting   — the window elapsed with nobody here, the search stays open
   *               and the pilot chooses between waiting and the AI flock.
   */
  setMatchmaking(
    on: boolean,
    live: number,
    _field: number,
    secsLeft: number,
    phase: "searching" | "waiting" = "searching",
    rooms = "",
    ready: "none" | "unready" | "ready" = "none",
  ): void {
    this.matchmakingEl.classList.toggle("hidden", !on);
    if (!on) return;
    const searching = phase === "searching";
    this.matchmakingEl.classList.toggle("is-waiting", !searching);
    this.matchmakingTitle.textContent = searching ? "Searching for live pilots…" : "No live pilots found yet";
    this.matchmakingCount.textContent = live > 0
      ? `${live} live pilot${live === 1 ? "" : "s"} in this room`
      : "Waiting for the first live pilot";
    this.matchmakingLabel.textContent = ready === "ready"
      ? "You're ready — the race launches when every pilot is ready, with a 6s countdown."
      : ready === "unready"
        ? live > 0
          ? "A pilot is in the room — ready up! The race launches when everyone is ready."
          : "Ready up now and the race launches the moment a pilot joins you."
        : searching
          ? secsLeft > 0.5
            ? `Looking for pilots on this circuit · ${Math.ceil(secsLeft)}s`
            : "Searching for pilots…"
          : "The search stays open — anyone who arrives can still join this room";
    this.matchmakingRooms.textContent = rooms;
    this.matchmakingRooms.classList.toggle("hidden", !rooms);
    // Nobody auto-readies: the Ready toggle is the only way into a live start.
    this.matchmakingReady.classList.toggle("hidden", ready === "none");
    this.matchmakingReady.textContent = ready === "ready" ? "Ready ✓ — tap to cancel" : "Ready up ✓";
    this.matchmakingReady.setAttribute("aria-pressed", ready === "ready" ? "true" : "false");
    this.matchmakingAi.classList.toggle("hidden", searching);
    this.matchmakingKeep.classList.toggle("hidden", searching);
  }

  onAction(handler: ActionHandler): void {
    this.root.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing && e.target instanceof HTMLInputElement && e.target.dataset.enterAction) {
        e.preventDefault(); e.stopPropagation();
        const action = e.target.dataset.enterAction;
        const btn = this.menuCard.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
        // Prefer the visible button (keeps focus/press feedback); actions
        // without a dedicated button (e.g. Friend code → direct add) still fire.
        if (btn) btn.click();
        else handler(action, "");
        return;
      }
      if (e.key === "Escape" && this.emoteWheel.contains(e.target as Node) && this.emoteWheel.querySelector('[aria-expanded="true"]')) {
        e.preventDefault(); e.stopPropagation();
        this.emoteWheel.querySelector<HTMLButtonElement>(".emotes-toggle")?.click();
        this.emoteWheel.querySelector<HTMLButtonElement>(".emotes-toggle")?.focus({ preventScroll: true });
        return;
      }
      if (e.key === "Escape" && this.copyDialog && !e.isComposing) {
        e.preventDefault(); e.stopPropagation(); this.dismissCopy();
      }
    });
    this.root.addEventListener("compositionstart", e => {
      if (e.target instanceof Node && this.menuCard.contains(e.target)) this.menuContinuity.beginComposition();
    });
    this.root.addEventListener("compositionend", () => this.menuContinuity.endComposition());
    this.root.addEventListener("click", (e) => {
      if (e.target === this.pauseEl) {
        handler("resume", "");
        return;
      }
      if (e.target === this.overEl) {
        // The results backdrop is deliberately inert. A stray tap (or a drag
        // that ends on the backdrop while scrolling the recap) must never
        // launch another race — the recap is for reading, and restarting is
        // an explicit choice on the card's own buttons.
        return;
      }
      if (e.target === this.menuEl && this.currentSnapshot && this.currentSnapshot.screen !== "main") {
        handler("back", "");
        return;
      }
      const t = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
      if (!t || t.matches("input, select, textarea") || (t as HTMLButtonElement).disabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (t.dataset.action === "toggle-emotes") {
        const expanded = t.getAttribute("aria-expanded") !== "true";
        t.setAttribute("aria-expanded", String(expanded));
        this.emoteWheel.querySelector(".emote-options")?.classList.toggle("hidden", !expanded);
        return;
      }
      if (t.dataset.action === "emote") {
        const toggle = this.emoteWheel.querySelector<HTMLButtonElement>(".emotes-toggle");
        this.emoteWheel.querySelector(".emote-options")?.classList.add("hidden");
        toggle?.setAttribute("aria-expanded", "false");
        toggle?.focus({ preventScroll: true });
      }
      if (t.dataset.action === "shop-filter") {
        const filter = (t.dataset.id ?? "all") as import("./ShopBrowse").ShopFilter;
        if (filter) this.shopBrowse.filter = filter;
        if (this.shopSnapshot) this.renderStatic(this.shopSnapshot);
        return;
      }
      if (t.dataset.action === "preview-skin") {
        this.shopBrowse.preview = t.dataset.id ?? "";
        if (this.shopSnapshot) this.renderStatic(this.shopSnapshot);
        const preview = this.menuCard.querySelector<HTMLElement>(".shop-hero-name");
        preview?.focus({ preventScroll: true });
        this.menuCard.querySelector(".shop-hero")?.scrollIntoView({ block: "start" });
        return;
      }
      if (t.dataset.action === "shop-section") {
        const target = this.menuCard.querySelector<HTMLElement>(`[data-ref="${CSS.escape(t.dataset.id ?? "")}"]`);
        if (target instanceof HTMLDetailsElement) target.open = true;
        (target?.querySelector<HTMLElement>("summary, input") ?? target)?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start" });
        return;
      }
      if (t.dataset.action === "shop-clear") {
        this.shopBrowse.query = ""; this.shopBrowse.filter = "all";
        this.clearValue("shopSearch");
        if (this.shopSnapshot) this.renderStatic(this.shopSnapshot);
        this.menuCard.querySelector<HTMLInputElement>('[data-ref="shopSearch"]')?.focus();
        return;
      }
      if (t.dataset.action === "dismiss-copy") { this.dismissCopy(); return; }
      handler(t.dataset.action ?? "", t.dataset.id ?? "");
    });
    this.root.addEventListener("change", e => {
      const field = e.target;
      if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement) && field.dataset.action) {
        handler(field.dataset.action, field.value);
      }
    });
    this.root.addEventListener("input", e => {
      const field = e.target;
      if (field instanceof HTMLInputElement && field.dataset.ref === "shopSearch") {
        this.shopBrowse.query = field.value.slice(0, 80);
        // Coalesce the repaint. This used to re-render the ENTIRE shop screen on
        // every keystroke, and each skin card builds its own inline SVG bird — so
        // typing an eight-character query queued eight full screens of work, on
        // the frame the player is watching. The query itself still updates
        // immediately (the field keeps its native responsiveness, and a filter
        // read is trivial); only the paint is debounced. The timer is registered
        // through after(), so dispose() clears it.
        if (this.searchRenderTimer !== null) this.cancelTimer(this.searchRenderTimer);
        this.searchRenderTimer = this.after(() => {
          this.searchRenderTimer = null;
          if (this.shopSnapshot) this.renderStatic(this.shopSnapshot);
        }, 120);
      }
      if (field instanceof HTMLInputElement && field.dataset.ref === "pilotNameInput") {
        // The counter is decorative, but it must not lie: it rendered a hardcoded
        // "0/14" and never moved while the player typed.
        this.syncNameCount(field);
      }
      if (field instanceof HTMLInputElement && field.type === "range") {
        const output = field.parentElement?.querySelector("output");
        if (output) output.textContent = `${field.value}%`;
      }
    });
  }

  /** Immediate sender feedback for an emote: your own bubble pops above the
   *  wheel. Without this the tap looked dead in states where the sim clock
   *  (which drives the in-world bubble's lifetime) is not advancing, and the
   *  reply took a whole step to appear while racing. */
  pulseEmote(text: string): void {
    if (!this.emoteBubble) return;
    this.emoteBubble.textContent = text;
    this.emoteBubble.classList.remove("hidden", "pop");
    // Force a reflow so the pop animation restarts on a rapid second emote.
    void this.emoteBubble.offsetWidth;
    this.emoteBubble.classList.add("pop");
    window.clearTimeout(this.emoteBubbleTimer);
    this.emoteBubbleTimer = window.setTimeout(() => this.emoteBubble.classList.add("hidden"), 2200);
  }

  clearValue(ref: string): void {
    const field = this.root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-ref="${CSS.escape(ref)}"]`);
    if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = false;
    else if (field) field.value = "";
  }

  offerCopy(text: string): void {
    this.dismissCopy();
    const dialog = document.createElement("div");
    dialog.className = "overlay copy-dialog";
    // Backticks, not single quotes. With `'…'` the ${t(...)} expressions were
    // emitted as literal text, so the dialog heading literally read
    // `${t("hud.ui.CManually", …)}` in every locale.
    dialog.innerHTML = `<div class="paper-card slim"><h2>${t("hud.ui.CManually", undefined, "Copy manually")}</h2><p class="tagline">Your browser blocked automatic copying. Select the text below and use Copy.</p><textarea class="cloud-box" aria-label="${t("hud.ui.TCopy", undefined, "Text to copy")}" readonly rows="4"></textarea><button class="soft-btn wide" data-ui data-action="dismiss-copy">Done</button></div>`;
    const field = dialog.querySelector("textarea")!;
    field.value = text; // never inject codes/URLs as markup
    this.root.appendChild(dialog);
    this.copyDialog = dialog;
    this.overlayNavigation.sync(dialog);
    field.focus();
    field.select();
  }

  dismissCopy(): boolean {
    if (!this.copyDialog) return false;
    this.copyDialog.remove();
    this.copyDialog = null;
    this.overlayNavigation.sync(this.root.querySelector<HTMLElement>(".overlay:not(.hidden)"));
    return true;
  }

  readChecked(ref: string): boolean {
    return this.root.querySelector<HTMLInputElement>(`[data-ref="${CSS.escape(ref)}"]`)?.checked === true;
  }

  readValue(ref: string): string {
    const el = this.root.querySelector(`[data-ref="${CSS.escape(ref)}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
    return el?.value ?? "";
  }

  setValue(ref: string, val: string): void {
    const el = this.root.querySelector(`[data-ref="${CSS.escape(ref)}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    el.value = val;
    // Keep the character counter truthful for programmatic writes too. The live
    // path updates it from the `input` event, but assigning `.value` fires no
    // such event — so a name written by boot or by the dice left the counter
    // showing the length of whatever the last RENDER produced. Measured on the
    // first-run screen: field 10 characters, counter 12. The counter exists so
    // it cannot lie; this is what made it lie.
    this.syncNameCount(el);
  }

  /** Mirror a name field's current length into its character counter. */
  private syncNameCount(field: HTMLInputElement | HTMLTextAreaElement): void {
    const count = field.closest(".name-input-wrapper")?.querySelector(".name-char-count span");
    if (!count) return;
    const next = String(field.value.length);
    // Write only on a real change. This runs on every HUD push while the name
    // screen is mounted, and an unconditional `textContent` write is a mutation
    // on every frame — which re-ran layout and left the dice button next to it
    // permanently "moving" as far as a click was concerned.
    if (count.textContent !== next) count.textContent = next;
  }

  updateNameTags(tags: RivalNameTag[], camera: THREE.Camera, width: number, height: number): void {
    const container = this.root.querySelector<HTMLElement>('[data-ref="nametags"]');
    if (!container) return;
    // A root re-render (flushCaches) replaces the container's children — the
    // cached elements are detached; drop the caches and start fresh.
    if (!container.childElementCount && this.nameTagEls.size > 0) {
      this.nameTagEls.clear();
      this.nameTagKeys.clear();
    }
    // DOM reuse: positions are cheap style writes (composited), while the
    // tag CONTENT is only re-parsed when rank/name/emote/draft actually
    // changes. The old version rebuilt container.innerHTML 60x/second in a
    // packed field — a full HTML parse + node churn on every frame, which is
    // where mobile PVP frame times went to die.
    const seen = new Set<string>();
    for (const tag of tags ?? []) {
      this.tmpNameTagVec.set(tag.worldX, tag.worldY, -3.5);
      this.tmpNameTagVec.project(camera);
      if (this.tmpNameTagVec.z > 1) continue;
      const px = ((this.tmpNameTagVec.x + 1) * width) / 2;
      const py = ((-this.tmpNameTagVec.y + 1) * height) / 2;
      if (px < -60 || px > width + 60 || py < -60 || py > height + 60) continue;
      seen.add(tag.id);

      let el = this.nameTagEls.get(tag.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "rival-nametag";
        container.appendChild(el);
        this.nameTagEls.set(tag.id, el);
        this.nameTagKeys.set(tag.id, "");
      }
      el.style.left = `${px.toFixed(1)}px`;
      el.style.top = `${py.toFixed(1)}px`;

      const key = `${tag.place}|${tag.name}|${tag.emote}|${tag.drafting ? 1 : 0}`;
      if (this.nameTagKeys.get(tag.id) !== key) {
        this.nameTagKeys.set(tag.id, key);
        el.classList.toggle("drafting", tag.drafting);
        el.innerHTML =
          `${tag.emote ? `<b class="rt-emote" aria-hidden="true">${escapeHtml(tag.emote)}</b>` : ""}` +
          `<span class="rank-badge">#${tag.place}</span><span>${escapeHtml(tag.name)}</span>`;
      }
    }
    for (const [id, el] of this.nameTagEls) {
      if (!seen.has(id)) {
        el.remove();
        this.nameTagEls.delete(id);
        this.nameTagKeys.delete(id);
      }
    }
  }

  update(s: HudSnapshot): void {
    this.currentSnapshot = s;
    if (s.state === "playing" && !this.wasInFlight) this.resultsContinuity.reset();
    this.wasInFlight = s.state === "playing";
    // Tournament countdown urgency push: menu-only, so it never interrupts a
    // flight in progress with a toast about something the player can't act
    // on until they land anyway.
    if (s.state === "menu") this.maybeTournamentPush(s.cups);
    // Keep the menu bird animated by default. The in-game Reduce motion
    // switch remains the explicit opt-out; relying solely on the browser's
    // media query made the hero appear frozen on some desktop profiles.
    document.documentElement.classList.toggle("sb-reduce-motion", s.settings.reduceMotion);
    // Network presence is asynchronous and doesn't increment the save/UI
    // version. Include it or a connected room stays stuck on disabled Ready.
    const roomKey = s.state === "menu" && s.screen === "live"
      // Key on SHAPE, not content. This serialised the whole rival array 30x a
      // second - a few KB of fresh string per tick, thrown away - and it never
      // short-circuited, because the array is a new object on every presence
      // tick. The rows rebuild only when the roster's SIZE or ready-flags move.
      ? `${s.netState}|${s.netError}|${s.roomCode}|${s.roomCount}|${s.roomReady}|${s.roomReadyCount}|${s.lobbyRivals.length}|${s.lobbyRivals.map((r) => (r.ready ? 1 : 0)).join("")}` : "";
    const key = `${s.state}|${s.screen}|${s.version}|${roomKey}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.flushCaches();
      this.renderStatic(s);
    }

    const inPlay = s.state === "playing" || s.state === "paused" || s.state === "continue";
    this.playHud.classList.toggle("hidden", !inPlay);
    this.playHud.classList.toggle("versus", s.versus);
    if (this.playHud.dataset.splitLayout !== s.splitLayout) this.playHud.dataset.splitLayout = s.splitLayout;
    if (this.root.dataset.uiState !== s.state) this.root.dataset.uiState = s.state;
    const flying = String(inPlay);
    if (this.root.dataset.flying !== flying) this.root.dataset.flying = flying;
    const feedback = feedbackSlot(s);
    if (this.root.dataset.feedback !== feedback) this.root.dataset.feedback = feedback;
    // Menu overlay: (a) main menu/attract, (b) post-crash postcards, or
    // (c) paused-run sub-screens (shop/settings/... overlaid on a frozen flight).
    const menuVisible = s.state === "menu" || (s.state === "gameover" && s.screen !== "main")
      || (s.state === "paused" && s.screen !== null && s.screen !== "main");
    this.menuEl.classList.toggle("hidden", !menuVisible);
    this.menuEl.classList.toggle("pause-submenu", s.state === "paused" && s.screen !== null && s.screen !== "main");
    // When a pause sub-screen is open, hide the plain pause card (the menu card
    // shows on top with its own "Back to flight" affordance).
    this.pauseEl.classList.toggle("hidden", s.state !== "paused" || (s.screen !== null && s.screen !== "main"));
    // The painted 2D sky and the hero bird stay OFF everywhere: the menu
    // backdrop is the live 3D gameplay world (attract flight) behind the
    // translucent card — the 2D canvas would cover it with a flat painting.
    this.menuSky.setActive(false);
    this.menuSky.heroHost.classList.add("hidden");
    // The pause control only makes sense in live flight — hide it while the
    // crash "second wind" card is up so it can't read as a dead button.
    this.pauseBtnEl.classList.toggle("hidden", s.state !== "playing");
    this.muteBtnEl.classList.toggle("hidden", !inPlay);
    const muted = s.settings.mute;
    if (this.playMuteShown !== muted) {
      this.playMuteShown = muted;
      this.paintMute(this.muteBtnEl, muted);
    }
    // Keep the pause-card stats & mute in sync while paused.
    if (s.state === "paused") {
      this.pauseDistanceEl.textContent = `${Math.max(0, Math.round(s.distance))} m`;
      this.pauseAltitudeEl.textContent = `${Math.max(0, Math.round(s.altitude))} m`;
      this.pauseComboEl.textContent = `×${Math.max(1, s.combo)}`;
      if (this.pauseMuteShown !== muted) {
        this.pauseMuteShown = muted;
        this.pauseMuteBtn.setAttribute("aria-pressed", String(muted));
        this.pauseMuteIco.innerHTML = menuIcon(muted ? "soundOff" : "sound");
        this.pauseMuteLbl.textContent = muted ? "Sound off" : "Sound on";
      }
    }
    // Menu mute stays in sync without re-querying every frame. Re-query only
    // when the sheet was re-rendered (the old node is detached).
    if (this.menuMuteEl && !this.menuMuteEl.isConnected) this.menuMuteEl = null;
    if (!this.menuMuteEl) {
      this.menuMuteEl = this.menuCard.querySelector<HTMLButtonElement>("[data-menu-mute]");
      if (this.menuMuteEl) this.menuMuteShown = null;
    }
    if (this.menuMuteEl && this.menuMuteShown !== muted) {
      this.menuMuteShown = muted;
      this.paintMute(this.menuMuteEl, muted);
    }
    this.contEl.classList.toggle("hidden", s.state !== "continue");
    this.adEl.classList.toggle("hidden", s.state !== "ad");
    this.overEl.classList.toggle("hidden", !(s.state === "gameover" && s.screen === "main"));

    if (inPlay) {
      this.setText(this.distanceEl, "dist", distanceText(s.distance));
      this.setText(this.coinsEl, "coins", formatNumberLocalized(s.coins));
      this.setText(this.bestEl, "best", distanceText(s.bestDistance));
      // The medal ladder, shown WHILE flying rather than only at the end.
      //
      // "340 m, best 340 m" tells a player where they are and nothing about
      // what is next. This is the line that answers the question they are
      // actually asking on the attempt after a near miss, and it is worth far
      // more in the top-left corner — where the eye already is for the distance
      // number — than in a results card the player sees once it is over.
      //
      // Keyed rather than rewritten every push, same as the other HUD text
      // here, so a 30Hz push does not churn a node for a string that rarely
      // changes (once per metre at most).
      {
        const m = medalStanding(s.distance);
        const mkey = `${m.earned}${m.toNext ?? ""}`;
        if (mkey !== this.lastMedalKey) {
          this.lastMedalKey = mkey;
          this.medalLine.textContent = medalText(m.earned, m.toNext);
          this.medalLine.dataset.medal = m.earned;
          // Near-miss emphasis: within 25% of the next rung, the goal is close
          // enough to steer by, and that is the moment it is worth shouting.
          this.medalLine.classList.toggle("close", m.toNext !== null && m.toNext <= (m.nextAt ?? Infinity) * 0.25);
        }
      }
      this.setText(this.islandEl, "island", `Island ${s.island + 1}`);
      // Mobile HUD declutter: the island chip flashes "recent" for 3s right
      // after the island changes, then fades back to unobtrusive (CSS scopes
      // `.recent` to <=640px only — desktop/tablet keep it always visible).
      if (s.island !== this.lastIsland) {
        this.lastIsland = s.island;
        this.islandEl.classList.add("recent");
        if (this.islandRecentTimer !== null) this.cancelTimer(this.islandRecentTimer);
        this.islandRecentTimer = this.after(() => {
          this.islandEl.classList.remove("recent");
          this.islandRecentTimer = null;
        }, 3000);
      }
      this.setText(this.multEl, "mult", `×${s.multiplier.toFixed(1)}`);
      // Mobile HUD declutter: the multiplier chip is only "relevant" once it
      // is actually boosting the run — at the baseline ×1.0 it is hidden on
      // narrow phones (CSS scopes this to <=640px; desktop keeps it visible).
      this.multEl.classList.toggle("active", s.multiplier > 1);
      // Mobile HUD declutter: the biome chip only matters when a hazard is
      // live nearby (headwind gust or thermal) — otherwise it just crowds the
      // same row as island/multiplier on a 375px phone.
      this.biomeChip.classList.toggle("hazard-near", s.gust > 0.3 || s.inThermal);
      this.goldChip.classList.toggle("hidden", !s.gold);
      this.vipChip.classList.toggle("hidden", !s.vip);
      if (this.vipChip.textContent !== `♛ VIP · ${s.vipDaysLeft}d`) this.vipChip.textContent = `♛ VIP · ${s.vipDaysLeft}d`;
      if (s.ghostDelta === null) {
        this.ghostChip.classList.add("hidden");
      } else {
        this.ghostChip.classList.remove("hidden");
        const ahead = s.ghostDelta >= 0;
        // The arrow is a shape cue that survives colorblindness — the
        // ahead/behind background tint alone (green vs. coral) is not enough.
        this.ghostChip.textContent = `👻 ${ahead ? "▲" : "▼"} ${ahead ? "+" : ""}${Math.round(s.ghostDelta)}m`;
        this.ghostChip.classList.toggle("ahead", ahead);
        this.ghostChip.classList.toggle("behind", !ahead);
      }

      const day = Math.min(1, s.daylight / s.daylightMax);
      this.setStyle(this.sunFill, "sunFill", "width", `${Math.max(2, day * 100)}%`);
      this.setStyle(this.sunKnob, "sunKnob", "left", `${day * 100}%`);
      this.sunFill.classList.toggle("low", day < 0.28);

      // Visible whenever the meter has something to say. It was shown only
      // while fever was LIT, but off-fever it carries the chain->fever
      // progress — which is the moment the player is actually asking "how close
      // am I?", and the moment it was hidden.
      this.feverWrap.classList.toggle("on", s.feverOn || s.fever > 0);
      this.feverWrap.classList.toggle("hidden", !s.feverOn && s.fever <= 0);
      this.setStyle(this.feverFill, "feverFill", "width", `${Math.max(0, Math.min(1, s.fever)) * 100}%`);

      // Ring chain: the airborne objective, so it is always visible while it
      // is live — count first (big), remaining window second (the bar).
      const slopeLinked = s.slopeChain > 0;
      this.slopeChainEl.classList.toggle("hidden", !slopeLinked);
      if (slopeLinked) {
        this.setText(this.slopeChainText, "slopeChainText", `FLOW ×${s.slopeChain} · ${s.slopeScore}`);
        // No timed window backs this chain (unlike the ring chain's countdown
        // fraction) — the fill instead reads as "how established is the
        // streak", climbing toward full at a 5-landing chain.
        this.setStyle(this.slopeChainFill, "slopeChainFill", "width", `${Math.max(0, Math.min(1, s.slopeChain / 5)) * 100}%`);
      }

      const chained = s.ringChain > 1;
      this.ringChainEl.classList.toggle("hidden", !chained);
      if (chained) {
        this.ringChainEl.classList.toggle("hot", s.ringChain >= 3);
        this.setText(this.ringChainCount, "ringChainCount", `×${s.ringChain}`);
        this.setStyle(this.ringChainFill, "ringChainFill", "width", `${Math.max(0, Math.min(1, s.ringChainFrac)) * 100}%`);
      }

      // Timed power-ups live ONLY in the power strip (countdown bars) — chips
      // here double-printed the same power-up (the old bug: pickup magnet fed
      // both magnetTimer AND PowerUps, so "🧲" showed twice). Chips remain as
      // a fallback for armed-boost timers the strip doesn't know about, plus
      // shield stock and weather calls to action.
      const chips: string[] = [];
      if (s.boostTimer > 0 && !s.powers.some((p) => p.kind === "rocket"))
        chips.push(`<span class="pchip boost">🚀 boost</span>`);
      if (s.magnetTimer > 0 && !s.powers.some((p) => p.kind === "magnet"))
        chips.push(`<span class="pchip magnet">🧲 ${Math.ceil(s.magnetTimer)}s</span>`);
      if (s.shield > 0) chips.push(`<span class="pchip shield">🛡 ×${s.shield}</span>`);
      if (s.gust > 0.3) chips.push(`<span class="pchip gust">🌬 headwind — dive!</span>`);
      if (s.inThermal) chips.push(`<span class="pchip thermal">♨ thermal — release!</span>`);
      const html = chips.join("");

      if (s.combo !== this.lastCombo) {
        this.lastCombo = s.combo;
        // "streak", not "chain": this counter is the launch streak (it counts
        // great OR perfect launches, and decays on a grace timer), while the
        // centre readout is the perfect-launch chain that drives Fever. One
        // word over two different numbers read as the HUD disagreeing with
        // itself — which it was, the moment anyone landed a single "great".
        this.comboEl.textContent = s.combo >= 2 ? `×${s.combo} streak` : "";
        this.comboEl.classList.toggle("show", s.combo >= 2);
        if (s.combo >= 2) {
          this.comboEl.classList.remove("pop");
          void this.comboEl.offsetWidth;
          this.comboEl.classList.add("pop");
        }
      }
      const biomeTxt = s.biomeName;
      if (biomeTxt !== this.lastBiome) {
        this.lastBiome = biomeTxt;
        this.biomeChip.innerHTML = `<span class="biome-art">${menuIcon("atlas")}</span><span>${escapeHtml(biomeTxt)}</span>`;
      }
      // Speed lines, from the tuned curve. This used to inline its own
      // `Math.max(0, (speedNorm - 0.55) * 1.6)`, which meant the 2026-09-24
      // retune of `SPEED_BANDS` never reached the player: different threshold,
      // different slope, and the copy could not be re-tuned in one file. The
      // band definitions live in `SpeedFeel.ts`; this is the consumer.
      this.setStyle(this.speedLines, "speedlines", "opacity", String(streakOpacity(s.speedNorm)));

      // altitude gauge (log-ish so low hops still read, big launches still climb)
      const aN = Math.min(1, Math.pow(s.altitude / 340, 0.65));
      this.setStyle(this.altFill, "altFill", "height", `${aN * 100}%`);
      this.setStyle(this.altBird, "altBird", "bottom", `calc(${aN * 100}% - 9px)`);
      this.setText(this.altRead, "altRead", `${Math.round(s.altitude)} m`);
      this.altGauge.dataset.zone = String(s.altZone);

      const chainKey = `${s.chainLabel}|${s.chainTier}`;
      if (chainKey !== this.lastChainKey && this.chainReadout) {
        this.lastChainKey = chainKey;
        this.chainReadout.textContent = s.chainLabel;
        this.chainReadout.className = `chain-readout tier-${s.chainTier}`;
        // Custom properties rather than inline style strings assembled per
        // frame: the tier class carries the look, the scale and pulse carry the
        // magnitude, and the browser does the interpolating.
        this.chainReadout.style.setProperty("--chain-scale", s.chainScale.toFixed(3));
        this.chainReadout.style.setProperty("--chain-pulse", `${s.chainPulse.toFixed(2)}s`);
      }

      const bannerKey = `${s.launchBanner}|${s.launchBannerT > 0}`;
      if (bannerKey !== this.lastBanner) {
        this.lastBanner = bannerKey;
        this.launchBanner.textContent = s.launchBanner;
        this.launchBanner.className = `launch-banner ${s.launchRating} ${s.launchBannerT > 0 ? "show" : ""}`;
      }

      const pkey = s.powers.map((p) => `${p.kind}${p.level}${Math.ceil(p.time)}`).join(",");
      if (pkey !== this.lastPowers) {
        this.lastPowers = pkey;
        this.powerStrip.innerHTML = s.powers
          .map(
            (p) =>
              `<span class="pu${p.time < 1.8 ? " expiring" : ""}${p.level === 2 ? " lv2" : ""}" title="${escapeHtml(p.label)}${p.level === 2 ? " II (overcharged)" : ""}"><i>${escapeHtml(p.icon)}</i>${p.level === 2 ? `<em class="pu-lv">II</em>` : ""}<b style="width:${Math.max(0, Math.min(1, p.time / p.total)) * 100}%"></b><u>${Math.ceil(p.time)}</u></span>`,
          )
          .join("");
      }

      const cd = s.countdown > 0 ? String(Math.ceil(s.countdown)) : "";
      if (cd !== this.lastCountdown) {
        const wasLive = this.lastCountdown !== "" && this.lastCountdown !== "GO!";
        this.lastCountdown = cd;
        if (cd) {
          this.countdownEl.textContent = cd;
          this.countdownEl.className = "countdown show";
        } else if (wasLive) {
          this.countdownEl.textContent = "GO!";
          this.countdownEl.className = "countdown show go";
          setTimeout(() => {
            if (this.countdownEl.textContent === "GO!") {
              this.countdownEl.textContent = "";
              this.countdownEl.className = "countdown";
            }
          }, 700);
        } else {
          this.countdownEl.textContent = "";
          this.countdownEl.className = "countdown";
        }
      }

      // Goal strip: max 2 rows — beat row + closest goal, OR closest goal + career.
      let lead: SessionGoal | null = null;
      for (const g of s.sessionGoals) {
        if (g.done) continue;
        if (!lead || g.progress / g.target > lead.progress / lead.target) lead = g;
      }
      const bl = s.beatLine;
      const blKey = bl ? `${bl.kind}:${Math.ceil(bl.gap / 25)}` : "";
      const gk = lead ? `${lead.id}:${Math.floor((lead.progress / lead.target) * 20)}` : "";
      const wk = s.wings ? `${Math.round(s.wings.progress * 100)}:${s.wings.nextNeeded}` : "";
      const ntRaw = s.nearestTrophy as AchievementView | null;
      const nt = ntRaw && ntRaw.def && typeof ntRaw.def.target === "number" && ntRaw.def.target > 0 && typeof ntRaw.progress === "number" ? ntRaw : null;
      const tk = nt ? `${nt.def.id}:${Math.floor((nt.progress / nt.def.target) * 20)}` : "";
      const stripKey = `${blKey}|${gk}|${wk}|${tk}`;
      if (stripKey !== this.lastGoals) {
        this.lastGoals = stripKey;
        const rows: string[] = [];

        // Row 1: beat countdown row (always first when inside cue window)
        if (bl) {
          const BEAT_WIN = 400;
          const bpct = Math.min(100, Math.max(0, (BEAT_WIN - bl.gap) / BEAT_WIN * 100));
          const bClose = bl.gap <= 100;
          const bSteps = Math.ceil(bl.gap / 25) * 25;
          rows.push(`<span class="gs gs-beat ${bClose ? "close" : ""}"><em>${escapeHtml(bl.label)}</em><u>${bSteps} m to go</u><i><b style="width:${bpct.toFixed(1)}%"></b></i></span>`);
        }

        // Row 2a: closest goal (if beat row is showing) or Row 1: closest goal
        if (lead && (!bl || rows.length < 2)) {
          const pct = Math.min(100, (lead.progress / lead.target) * 100);
          const close = pct >= 70;
          rows.push(`<span class="gs ${close ? "close" : ""}"><em>${escapeHtml(lead.label)}</em><u>${Math.round(lead.progress)}/${Math.round(lead.target)} · +${COIN_SVG}${lead.reward}</u><i><b style="width:${pct.toFixed(1)}%"></b></i></span>`);
        }

        // Career rung: only when no beat row and there's a next rank to chase.
        //
        // ...and only when a SINGLE RUN can actually move it. A run covers a
        // few hundred metres to a couple of km, and the career ladder is measured
        // in tens of km — so this row was permanently unreachable and permanently
        // on screen. The shipped build showed "Paper Wings -> Bronze Wings /
        // 25.00 km to go" during runs measured in hundreds of metres: a progress
        // bar that cannot move, competing with the terrain, for the whole run.
        //
        // This is the same defect the quest strip had, and the same fix. A goal
        // worth showing mid-run is one the player can chase RIGHT NOW. The full
        // career ladder is on the progress screen, where a number that big
        // belongs. The bar is only hidden while a run is in flight; a goal that
        // becomes reachable mid-run shows itself, because `nextNeeded` is part
        // of the strip key.
        if (!bl && s.wings && s.wings.nextNeeded > 0 && s.wings.nextNeeded <= RUN_REACHABLE_M && rows.length < 2) {
          const cpct = Math.min(100, s.wings.progress * 100);
          rows.push(`<span class="gs gs-career"><em>${escapeHtml(s.wings.name)} → ${escapeHtml(s.wings.nextName)}</em><u>${distanceText(s.wings.nextNeeded)} to go</u><i><b style="width:${cpct.toFixed(1)}%"></b></i></span>`);
        }

        // Trophy progress: lowest priority — only when a slot is still free.
        if (nt && rows.length < 2) {
          const tpct = Math.min(100, (nt.progress / nt.def.target) * 100);
          rows.push(`<span class="gs gs-trophy"><em>🏆 ${escapeHtml(nt.def.title)}</em><u>${Math.round(nt.progress)}/${Math.round(nt.def.target)} toward trophy</u><i><b style="width:${tpct.toFixed(1)}%"></b></i></span>`);
        }

        this.goalStrip.innerHTML = rows.join("");
      }
      // The quest strip. Keyed on the numbers rather than rebuilt per frame, so
      // a 30 Hz HUD push does not churn 3-4 nodes; the `just` class is folded
      // into the key so the "banked" flourish still fires on the frame it lands.
      // Only quests worth looking at right now.
      //
      // This rendered EVERY mission unconditionally, so a fresh run put three
      // permanent bars on screen reading 0/6, 0/15 and 0/2 — a screenshot of
      // the shipped build shows exactly that, sitting in the lower-left of the
      // terrain-reading zone. The codebase already contains the answer to this
      // and the strip was ignoring it: `closestGoalLine`'s comment says a
      // permanent "you are 3% of the way there" nag "teaches the player to
      // ignore the strip", and then gates its own line on 50%+. So the in-flight
      // strip now uses the same threshold.
      //
      // Kept: quests at 50%+ (they are close, and close is motivating), and
      // anything that just completed this frame (the payoff is the point of
      // showing it). Dropped: the rows sitting at zero, which are the ones that
      // train the player to stop reading the strip. Nothing is *lost* — every
      // quest is still listed on the progress screen.
      const worthShowing = s.missionRows.filter(
        (r) => r.done || r.justDone || r.pct >= IN_FLIGHT_MISSION_MIN_PCT,
      );
      const mkey = worthShowing.map((r) => `${r.id}${Math.round(r.pct * 200)}${r.done ? "D" : ""}${r.justDone ? "J" : ""}`).join("|");
      if (mkey !== this.lastMissionStrip) {
        this.lastMissionStrip = mkey;
        this.missionStrip.classList.toggle("hidden", worthShowing.length === 0);
        this.missionStrip.innerHTML = renderMissionStrip(worthShowing);
      }
      if (s.goalPop !== this.lastGoalPop) {
        this.lastGoalPop = s.goalPop;
        this.goalPop.textContent = s.goalPop;
        this.goalPop.className = `goal-pop ${s.goalPop ? `show kind-${s.goalPopKind}` : ""}`;
      }
      this.rankUp.textContent = s.rankUp;
      this.rankUp.classList.toggle("show", Boolean(s.rankUp));

      // Top-of-screen bird roster: every pilot as a live bird pip on the race
      // line, with your place badge and the gap to the leader. Rebuilds are
      // throttled to ~6 Hz and quantized so 41 pips don't churn the DOM.
      const showRoster = s.roster.length > 0;
      this.rosterBar.classList.toggle("hidden", !showRoster);
      if (showRoster) {
        const now = performance.now();
        const rkey = s.roster
          .map((r) => `${r.id}${Math.round(r.progress * 50)}${r.finished ? "F" : ""}${r.emote}`)
          .join("|") + `|${s.linkQuality}`;
        if (rkey !== this.lastRoster && now - this.lastRosterAt > 150) {
          this.lastRoster = rkey;
          this.lastRosterAt = now;
          const leader = s.roster[0];
          const you = s.roster.find((r) => r.you);
          const span = Math.max(1, s.raceFinish || 4000);
          const gapM =
            leader && you && !you.finished
              ? Math.max(0, Math.round((leader.progress - you.progress) * span))
              : 0;
          const placeTxt = you ? `P${you.place}` : "–";
          const gapTxt = !you || you.finished ? "FINISHED" : you.place === 1 ? "LEADER" : `-${gapM}m`;
          this.rosterBar.innerHTML =
            `<div class="roster-top"><span class="rp-place ${you && you.place <= 3 ? "podium" : ""}">${placeTxt}</span>` +
            `<span class="rm-lead">👑 ${escapeHtml(leader ? leader.name : "—")}</span>` +
            `<span class="rm-gap">${gapTxt}</span>` +
            `<span class="rm-count">${s.roster.length} birds</span>` +
            `${s.roomCode ? `<span class="rm-room">ROOM ${escapeHtml(s.roomCode)}</span>` : ""}` +
            `<span class="rm-net ${s.netState}">${s.multiplayerLive ? s.netState : "practice"}</span>` +
            `${s.multiplayerLive && s.linkQuality !== "unknown" ? `<span class="link-quality ${s.linkQuality}" title="${t("hud.ui.LStateCadence", undefined, "Live state cadence")}">${s.linkQuality} link</span>` : ""}</div>` +
            `<div class="roster-track" role="img" aria-label="${t("hud.ui.LRacePositions", undefined, "Live race positions")}">${s.roster
              .map(
                (r) =>
                  `<span class="rb ${r.you ? "you" : ""} ${r.remote ? "remote" : ""} ${r.ghost ? "ghost" : ""} ${r.finished ? "done" : ""}" ` +
                  `style="left:${(r.progress * 100).toFixed(1)}%;--h:${Math.round(r.hue * 360)}" ` +
                  `title="#${r.place} ${escapeHtml(r.name)}${r.remote ? " · live player" : r.ghost ? " · player ghost" : ""}">${r.emote ? `<b class="rb-emote">${escapeHtml(r.emote)}</b>` : ""}</span>`,
              )
              .join("")}</div>`;
        }
      }

      // Distance-to-finish readout, escalating as the gate approaches.
      const showCd = s.finishRemaining > 0 && s.finishRemaining < 900;
      this.finishCd.classList.toggle("hidden", !showCd);
      if (showCd) {
        const m = Math.ceil(s.finishRemaining);
        const txt = m > 0 ? `${m} m` : "";
        if (txt !== this.lastFinishCd) {
          this.lastFinishCd = txt;
          this.finishCd.textContent = txt;
        }
        this.finishCd.classList.toggle("close", s.finishRemaining < 250);
      }

      // Slipstream meter — only appears when you are actually drafting.
      const drafting = s.draft > 0.12;
      this.draftMeter.classList.toggle("hidden", !drafting);
      if (drafting) {
        const bar = this.draftMeter.firstElementChild as HTMLElement | null;
        if (bar) bar.style.width = `${Math.round(s.draft * 100)}%`;
      }
      // Emotes show whenever a race field exists — lobby included (see
      // emoteWheelVisible). Sending on the results card is harmless: the
      // toast-free local echo still pops and the net send is a no-op after
      // disconnect.
      this.emoteWheel.classList.toggle("hidden", !emoteWheelVisible(s));

      // Live standings ticker: leaders plus your row, with gaps to the car
      // ahead so every position fight reads at a glance. Throttled like the
      // roster so it never rebuilds mid-frame more than ~5×/s.
      this.standingsEl.classList.toggle("hidden", s.standings.length === 0);

      // The top-of-screen roster bar now carries everything the old position
      // badge + progress strip showed (place, gap to leader, full field line),
      // so those two were removed to stop the same place/gap reading twice.
      if (s.standings.length) {
        const nowS = performance.now();
        const key = s.standings.map((r) => `${r.id}${r.place}${Math.round(r.distance / 12)}${r.finished ? "F" : ""}`).join("|");
        if (key !== this.lastStandings && nowS - this.lastStandingsAt > 200) {
          this.lastStandings = key;
          this.lastStandingsAt = nowS;
          const top = s.standings[0];
          this.standingsEl.innerHTML =
            `<div class="st-head"><span>LIVE</span><span>${s.standings.length} shown</span></div>` +
            s.standings
              .map((r) => {
                const gap = top && r.place > top.place ? `-${Math.max(0, Math.round(top.distance - r.distance))}m` : r.finished ? "🏁" : "—";
                return `<div class="st-row ${r.you ? "you" : ""} ${r.kind === "remote" ? "remote" : ""} ${r.place <= 3 ? "p" + r.place : ""}">
                <span class="st-p">${r.place <= 3 ? ["🥇", "🥈", "🥉"][r.place - 1] : r.place}</span>
                <span class="st-n">${escapeHtml(r.name)}${r.kind === "remote" ? " ⇄" : ""}</span>
                <span class="st-d">${r.you || r.place <= 3 ? `${Math.round(r.distance)}m` : gap}</span>
              </div>`;
              })
              .join("");
        }
      }

      // Local 2P race bar: memoized so it writes only when rounded progress moves.
      this.versusBar.classList.toggle("hidden", !s.versus);
      if (s.versus && s.p1Stats && s.p2Stats) {
        const pct = (d: number): number => Math.min(100, (d / s.raceFinish) * 100);
        const vkey = `${s.splitLayout}|${Math.round(pct(s.p1Stats.distance))}|${Math.round(pct(s.p2Stats.distance))}`;
        if (vkey !== this.lastVersusKey) {
          this.lastVersusKey = vkey;
          const lead1 = s.p1Stats.distance >= s.p2Stats.distance;
          this.versusBar.innerHTML =
            `<div class="vs-row p1 ${lead1 ? "lead" : ""}"><span>P1${lead1 ? " 👑" : ""}</span><i><b style="width:${pct(s.p1Stats.distance)}%"></b></i><em>${Math.round(s.p1Stats.distance)}m</em></div>` +
            `<div class="vs-row p2 ${lead1 ? "" : "lead"}"><span>P2${lead1 ? "" : " 👑"}</span><i><b style="width:${pct(s.p2Stats.distance)}%"></b></i><em>${Math.round(s.p2Stats.distance)}m</em></div>` +
            `<div class="versus-guide"><span>P1: A / Space · ${s.splitLayout === "horizontal" ? "top" : "left"}</span><span>P2: L / Enter · ${s.splitLayout === "horizontal" ? "bottom" : "right"}</span></div>`;
        }
      }
      this.handEl.classList.toggle("show", s.showTutorialHand);
      // One verb, one source. The hand said "Tap . Space . up" - a TAP on a
      // HOLD game, naming two keys that do not exist on the device this
      // ships to - on screen at the same moment as a coach saying HOLD.
      //
      // And when the coach line IS up, the hand does not repeat it. Both were
      // showing at once in the shipped build: "HOLD to dive down the hill" with
      // "Hold to dive" stacked directly beneath it, saying the same thing
      // twice, mid-screen, over the terrain the player is trying to read. The
      // hand still gestures - a gesture is not noise, it is the affordance -
      // it just stops talking while something else already is.
      this.handHintEl.textContent = s.hint
        ? ""
        : s.settings.tapToggleDive
          ? t("onboarding.tapToDive", undefined, "Tap to dive")
          : t("onboarding.tapToDiveHold", undefined, "Hold to dive");
      if (html !== this.lastChips) {
        this.lastChips = html;
        this.powersEl.innerHTML = renderCoins(html);
      }

      if (s.hint !== this.lastHint) {
        this.lastHint = s.hint;
        this.hintEl.textContent = s.hint;
        this.hintEl.classList.toggle("show", Boolean(s.hint));
      }

      const prox = s.proximity;
      this.wingsNear.classList.toggle("hidden", !prox.visible);
      if (prox.visible) {
        const pct = Math.round(prox.fill * 100);
        const remainingText = distanceText(prox.remaining);
        const label = t("hud.progress.proximity", { n: remainingText, name: prox.name }, `${remainingText} to ${prox.name}`);
        const bar = this.wingsNear.firstElementChild as HTMLElement;
        bar.style.width = `${pct}%`;
        // The bar is the accessible element, not the mirrored text beside it:
        // it updates every frame, so it must NOT be a live region (that would
        // announce a new distance ~30×/s) — `role="progressbar"` with
        // `aria-valuetext` reports it on demand instead, and the visible text
        // is `aria-hidden` so it is not read twice.
        if (bar.getAttribute("aria-valuenow") !== String(pct)) {
          bar.setAttribute("aria-valuenow", String(pct));
          bar.setAttribute("aria-valuetext", label);
        }
        (this.wingsNear.lastElementChild as HTMLElement).textContent = label;
      }
    }

    if (s.state === "continue" && this.contTimerEl) {
      const txt = String(Math.max(0, Math.ceil(s.continueTimer)));
      if (this.contTimerEl.textContent !== txt) this.contTimerEl.textContent = txt;
    }
    if (s.state === "ad") {
      const done = s.adTimer <= 0;
      // A finished break is 100% progress, not 0% — the bar used to snap back
      // to empty the instant the timer hit zero, which read as "the ad reset
      // and started over" right when the player was about to be let out.
      const p = done ? 1 : 1 - Math.max(0, s.adTimer) / Math.max(0.01, s.adTotal);
      if (this.adBarEl) this.adBarEl.style.width = `${p * 100}%`;
      if (this.adSkipEl && s.adSkippable) {
        this.adSkipEl.disabled = !done;
        const txt = done ? (s.adReason === "continue" ? "Wake up ▶" : "Continue ▶") : `Continues in ${Math.ceil(s.adTimer)}`;
        if (this.adSkipEl.textContent !== txt) this.adSkipEl.textContent = txt;
      }
      // The header/label are baked into the initial render and, unlike the bar
      // and skip button above, were never touched again — so a placeholder
      // break (no portal SDK) sat on "Your ad is loading" with a spinning
      // spinner for its entire duration, including the seconds after it had
      // already finished and "Wake up" was clickable. That reads as a hung ad,
      // which is exactly the bug report this fixes.
      if (s.portalName === "none" && done) {
        if (this.adHeaderEl && this.adHeaderEl.textContent !== "Ready!") this.adHeaderEl.textContent = "Ready!";
        const label = s.adReason === "continue" ? "Sponsored break · your second wind is ready" : "Sponsored break · ready to fly";
        if (this.adLabelEl && this.adLabelEl.textContent !== label) this.adLabelEl.textContent = label;
      }
    }
    this.overlayNavigation.sync(this.copyDialog ?? (this.matchmakingEl.classList.contains("hidden") ? this.root.querySelector<HTMLElement>(".overlay:not(.hidden)") : this.matchmakingEl));
  }

  /**
   * Tournament Countdown Urgency mid-week push: fires once, the moment a cup
   * crosses into its final 3 days, and only when there is still a tier worth
   * climbing for — a player already at Diamond gets no nag, since there is
   * nothing left to reach.
   */
  private maybeTournamentPush(cups: readonly TournamentView[]): void {
    for (const cup of cups) {
      const daysLeft = Math.ceil(cup.endsInMs / 86_400_000);
      if (daysLeft > 3 || daysLeft < 1 || !cup.nextTier) continue;
      if (this.tournamentPushed.has(cup.def.id)) continue;
      this.tournamentPushed.add(cup.def.id);
      const tierLabel = cup.nextTier[0]!.toUpperCase() + cup.nextTier.slice(1);
      this.toast(`Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left to reach ${tierLabel} tier!`, "warn");
    }
  }

  toast(text: string, kind = "info"): void {
    // Dedup: firing the same line while it is still on screen bumps a ×n
    // counter instead of stacking identical pills (ash storms, repeat
    // pickups). Never show the same words twice at once.
    const live = this.liveToasts.get(text);
    if (live && live.el.isConnected) {
      live.count += 1;
      live.el.textContent = `${text} ×${live.count}`;
      // Updating a duplicate must not force a synchronous browser layout.
      this.cancelTimer(live.timer);
      live.timer = this.scheduleToastOut(live.el, text);
      return;
    }
    // One readable pill in flight, at most two on menu screens.
    const cap = this.root.dataset.flying === "true" ? 1 : 2;
    while (this.toastLayer.children.length >= cap) {
      const oldest = this.toastLayer.firstElementChild;
      if (!oldest) break;
      for (const [k, v] of this.liveToasts) if (v.el === oldest) {
        this.cancelTimer(v.timer);
        this.liveToasts.delete(k);
      }
      oldest.remove();
    }
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toastLayer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    const timer = this.scheduleToastOut(el, text);
    this.liveToasts.set(text, { el, count: 1, timer });
  }

  /** Long lines earn longer reads: 1.2 s base + 28 ms/char, capped at 4 s. */
  private scheduleToastOut(el: HTMLElement, key: string): number {
    const hold = Math.min(4000, 1200 + Math.max(0, el.textContent!.length - 16) * 28);
    return this.after(() => {
      // Once exit starts, a repeat is a new toast rather than refreshing a
      // node that already has a pending removal callback.
      if (this.liveToasts.get(key)?.el === el) this.liveToasts.delete(key);
      el.classList.remove("in");
      el.classList.add("out");
      this.after(() => {
        el.remove();
        const live = this.liveToasts.get(key);
        if (live && live.el === el) this.liveToasts.delete(key);
      }, 420);
    }, hold);
  }

  flash(kind: "perfect" | "fever" | "island" | "sleep"): void {
    this.flashEl.className = `flash show ${kind}`;
    this.after(() => this.flashEl.classList.remove("show"), 280);
  }

  private readonly timers = new Set<number>();
  /** Pending coalesced repaint for the shop search (see the input handler). */
  private searchRenderTimer: number | null = null;
  private after(callback: () => void, ms: number): number {
    const timer = window.setTimeout(() => { this.timers.delete(timer); callback(); }, ms);
    this.timers.add(timer);
    return timer;
  }
  private cancelTimer(timer: number): void {
    window.clearTimeout(timer);
    this.timers.delete(timer);
  }
  private resizeObs: ResizeObserver | null = null;
  private readonly menuContinuity = new MenuContinuity();
  private readonly resultsContinuity = new MenuContinuity();
  private copyDialog: HTMLElement | null = null;
  private wasInFlight = false;
  private readonly overlayNavigation: OverlayNavigation;

  dispose(): void {
    this.resizeObs?.disconnect();
    this.menuSky.dispose();
    this.overlayNavigation.dispose();
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    this.liveToasts.clear();
    this.root.remove();
  }

  private renderStatic(s: HudSnapshot): void {
    const menuRendered = s.state === "menu"
      || (s.state === "gameover" && s.screen !== "main")
      || (s.state === "paused" && s.screen !== null && s.screen !== "main");
    if (menuRendered) {
      // In pause sub-screens never show the menu-hero (the launch grid) and
      // never add "wide" — pause overlays should stay compact over the flight.
      const wide = s.state === "paused" ? "" : (s.screen === "shop" || s.screen === "pass" ? "wide" : "");
      const cls = `paper-card ${s.state === "menu" && s.screen === "main" ? "menu-hero" : wide}`;
      this.menuContinuity.render(this.menuCard, s.screen, renderCoins(this.renderScreen(s)), cls, LAUNCH_CTA);
      // The character counter is rendered from the snapshot, but the field it
      // describes is not owned by the snapshot: boot writes the generated call
      // sign into it, and the async portal identity adoption rewrites it again
      // when it resolves. Whichever of those lands last, a counter rendered
      // from an older snapshot is simply wrong — measured on the portal build:
      // a 14-character field under a counter frozen at "12". Reading the field
      // back after every mount makes the two agree by construction, whatever
      // order the writes land in.
      const nameField = this.menuCard.querySelector<HTMLInputElement>('[data-ref="pilotNameInput"]');
      if (nameField) this.syncNameCount(nameField);
    }
    if (s.state === "gameover") this.resultsContinuity.render(this.overCard, "results", renderCoins(renderGameOver(s)), "paper-card results-card");
    if (s.state === "continue") {
      this.contCard.innerHTML = renderCoins(renderContinue(s));
      this.contTimerEl = this.contCard.querySelector('[data-live="contTimer"]');
    }
    if (s.state === "ad") {
      this.adCard.innerHTML = renderCoins(renderAd(s));
      this.adBarEl = this.adCard.querySelector('[data-live="adBar"]');
      this.adSkipEl = this.adCard.querySelector('[data-live="adSkip"]');
      this.adHeaderEl = this.adCard.querySelector(".portal-ad-wait h3");
      this.adLabelEl = this.adCard.querySelector(".ad-label");
    }
    if (s.state === "playing") this.lastChips = "";
  }

  private renderScreen(s: HudSnapshot): string {
    switch (s.screen) {
      case "shop":
        this.shopSnapshot = s;
        return renderShop(s, this.shopBrowse);
      case "paywall":
        return renderPaywall(s);
      case "checkout":
        return renderCheckout(s);
      case "settings":
        return renderSettings(s);
      case "scores":
        return renderScores(s);
      case "pass":
        return renderPass(s);
      case "trophies":
        return renderTrophies(s);
      case "account":
        return renderAccount(s);
      case "atlas":
        return renderAtlas(s);
      case "modes":
        return renderModes(s);
      case "board":
        return renderBoard(s);
      case "cups":
        return renderCups(s);
      case "live":
        return renderLive(s);
      case "rank":
        return renderRank(s);
      case "practice":
        return renderPractice(s);
      case "progress":
        return renderProgress(s);
      case "challenges":
        return renderChallenges(s);
      case "campaign":
        return renderCampaign(s);
      case "squad":
        return renderSquad(s);
      case "nameEntry":
        return renderNameEntry(s);
      default:
        return renderMain(s);
    }
  }

  private bind(): void {
    const grab = (name: string): HTMLElement => this.root.querySelector(`[data-ref="${name}"]`) as HTMLElement;
    this.chainReadout = grab("chainReadout");
    this.playHud = grab("playHud");
    this.distanceEl = grab("distance");
    this.coinsEl = grab("coins");
    this.bestEl = grab("best");
    this.medalLine = grab("medalLine");
    this.islandEl = grab("island");
    this.multEl = grab("mult");
    this.goldChip = grab("goldChip");
    this.vipChip = grab("vipChip");
    this.ghostChip = grab("ghostChip");
    this.powersEl = grab("powers");
    this.sunFill = grab("sunFill");
    this.sunKnob = grab("sunKnob");
    this.feverWrap = grab("feverWrap");
    this.feverFill = grab("feverFill");
    this.ringChainEl = grab("ringChain");
    this.ringChainCount = grab("ringChainCount");
    this.ringChainFill = grab("ringChainFill");
    this.slopeChainEl = grab("slopeChain");
    this.slopeChainText = grab("slopeChainText");
    this.slopeChainFill = grab("slopeChainFill");
    this.hintEl = grab("hint");
    this.menuEl = grab("menu");
    this.menuCard = grab("menuCard");
    this.pauseEl = grab("pause");
    this.pauseBtnEl = grab("pauseBtn");
    this.muteBtnEl = grab("muteBtn") as HTMLButtonElement;
    this.pauseDistanceEl = grab("pauseDistance");
    this.pauseAltitudeEl = grab("pauseAltitude");
    this.pauseComboEl = grab("pauseCombo");
    this.pauseMuteBtn = grab("pauseMute") as HTMLButtonElement;
    this.pauseMuteIco = grab("pauseMuteIco");
    this.pauseMuteLbl = grab("pauseMuteLbl");
    this.contEl = grab("continue");
    this.contCard = grab("contCard");
    this.adEl = grab("ad");
    this.adCard = grab("adCard");
    this.overEl = grab("over");
    this.overCard = grab("overCard");
    this.toastLayer = grab("toasts");
    this.flashEl = grab("flash");
    this.comboEl = grab("combo");
    this.biomeChip = grab("biome");
    this.speedLines = grab("speedlines");
    this.handEl = grab("hand");
    this.handHintEl = grab("handHint");
    this.altGauge = grab("altGauge");
    this.altFill = grab("altFill");
    this.altBird = grab("altBird");
    this.altRead = grab("altRead");
    this.launchBanner = grab("launchBanner");
    this.powerStrip = grab("powerStrip");
    this.countdownEl = grab("countdown");
    this.versusBar = grab("versusBar");
    this.matchmakingEl = grab("matchmaking");
    this.matchmakingTitle = grab("matchmakingTitle");
    this.matchmakingCount = grab("matchmakingCount");
    this.matchmakingLabel = grab("matchmakingLabel");
    this.matchmakingRooms = grab("matchmakingRooms");
    this.matchmakingAi = grab("matchmakingAi");
    this.matchmakingKeep = grab("matchmakingKeep");
    this.matchmakingReady = grab("matchmakingReady");
    this.goalStrip = grab("goalStrip");
    this.missionStrip = grab("missionStrip");
    this.goalPop = grab("goalPop");
    this.rankUp = grab("rankUp");
    this.standingsEl = grab("standings");
    this.rosterBar = grab("rosterBar");
    this.draftMeter = grab("draftMeter");
    this.finishCd = grab("finishCd");
    this.emoteWheel = grab("emoteWheel");
    this.emoteBubble = grab("emoteBubble");
    this.impactPopupsEl = grab("impactPopups");
    this.wingsNear = grab("wingsNear");
  }

  /** Floating impact text that rises from a screen position and fades out.
   *  x/y are screen fractions 0–1 (0,0 = top-left). kind controls the color.
   *  Use projectBirdToScreen() in Game.ts to get the position. */
  popup(text: string, kind: "perfect" | "great" | "thud" | "bop" | "fever" | "zenith" | "splash" | "power", sx: number, sy: number): void {
    const el = document.createElement("div");
    el.className = `impact-popup impact-popup--${kind}`;
    el.textContent = text;
    // Project into the protected flight corridor, not over menus/controls.
    const lane = this.impactPopupsEl.getBoundingClientRect();
    if (lane.width < 80 || lane.height < 70) return;
    const viewport = this.root.getBoundingClientRect();
    el.style.left = `${Math.max(40, Math.min(lane.width - 40, sx * viewport.width + viewport.left - lane.left))}px`;
    el.style.top = `${Math.max(50, Math.min(lane.height - 20, sy * viewport.height + viewport.top - lane.top))}px`;
    this.impactPopupsEl.replaceChildren(el);
    // Trigger animation on next frame then remove after it finishes.
    requestAnimationFrame(() => el.classList.add("rise"));
    this.after(() => el.remove(), 1100);
  }

  setFullscreenActive(active: boolean): void {
    const btns = this.root.querySelectorAll<HTMLButtonElement>('[data-action="toggle-fullscreen"]');
    for (const b of btns) {
      if (b.classList.contains("menu-fullscreen")) {
        b.textContent = active ? "🗗" : "⛶";
        b.title = active ? "Exit Fullscreen" : "Full Screen";
      } else if (b.textContent?.includes("Fullscreen")) {
        b.textContent = active ? "🗗 Exit Fullscreen" : "⛶ Fullscreen mode";
      }
    }
  }
}

/* ---------- templates ---------- */

/** Icons for screens that exist but are not home destinations. */
const SCREEN_ICONS: Record<string, MenuIconName> = {
  raceLobby: "online",
  aiPvp: "online",
  coinStore: "shop",
  confirmUnlock: "shop",
  highGlides: "trophy",
};

function head(key: string, backAction = "back", right = ""): string {
  const icon = destinationByKey(key)?.icon ?? SCREEN_ICONS[key];
  // Resolve the heading through SCREEN_TITLES, which is keyed by a screen's
  // VALUE ("scores") and carries the i18n key built from its KEY ("leaderboard").
  //
  // Looking SCREEN_HEADINGS up by the value missed on every screen whose key and
  // value differ, and no `hud.screen.*.title` key exists in the barrel, so the
  // fallback is what actually renders: 11 of 17 screens were showing their raw
  // internal id as the visible <h2> — "scores" instead of "Leaderboard", "pass"
  // instead of "Nest Pass", "paywall" instead of "Coin Store".
  //
  // SCREEN_TITLES existed for exactly this and was referenced only by
  // screen-titles.test.ts, which asserts the MAP is well-formed. Nothing
  // rendered from it, so the unit suite was green while the UI was wrong — which
  // is what the orphaned `pnpm test:policy` existed to catch.
  //
  // The two call sites that pass an already-localised string ("Your progress",
  // "Settings") are not screen ids, miss the map, and fall through unchanged.
  const entry = SCREEN_TITLES[key];
  const title = entry
    ? t(entry.key, undefined, entry.en)
    : t(`hud.screen.${key}.title`, undefined, SCREEN_HEADINGS[key as keyof typeof SCREEN] ?? key);
  const back = t("common.back", undefined, "Back");
  return `<div class="screen-head"><button class="back-btn" data-ui data-action="${backAction}" aria-label="${escapeHtml(back)}">‹</button><h2>${icon ? `<span class="heading-art">${menuIcon(icon)}</span>` : ""}${escapeHtml(title)}</h2><span>${right}</span></div>`;
}

function upsellStrip(): string {
  if (!SELL_AD_REMOVAL) return "";
  return `<button class="upsell" data-ui data-action="open-paywall"><div><b>✦ Sunbird Gold &amp; VIP</b><span>2× coins · ad-free · Phoenix &amp; Aurora skins · Nest Pass</span></div><span class="mini-btn gold">Unlock · ● 500</span></button>`;
}

function renderMissions(list: MissionView[], newly: string[] = []): string {
  const done = list.filter((m) => m.done).length;
  const rows = list
    .map((m) => {
      const fresh = newly.includes(m.def.id);
      return `<div class="mission ${m.done ? "done" : ""} ${fresh ? "fresh" : ""}">
        <span class="check">${m.done ? "✓" : ""}</span>
        <div><div class="mt">${m.def.title}</div><div class="md">${m.def.desc}</div></div>
        <span class="mp">${Math.min(m.progress, m.def.target)}/${m.def.target}</span>
      </div>`;
    })
    .join("");
  return `<details class="missions-details"><summary class="mission-head">${t("hud.renderMissions.NMissions", undefined, "Nest missions ")}<span class="mission-count">${done}/${list.length}</span></summary><div class="missions">${rows}</div></details>`;
}

function renderQuests(list: QuestView[]): string {
  return `<div class="quests"><div class="mission-head">${t("hud.renderQuests.TSQuests", undefined, "Today's quests")}</div>${list
    .map((q) => {
      const pct = Math.min(100, (q.progress / q.def.target) * 100);
      return `<div class="quest ${q.done ? "done" : ""}">
        <div><div class="mt">${q.def.label}</div><div class="qb"><i style="width:${pct}%"></i></div></div>
        <span class="qr">${q.claimed ? "✓ claimed" : `● ${q.def.reward}`}</span>
      </div>`;
    })
    .join("")}</div>`;
}

/**
 * Distance, formatted for the player's chosen language.
 *
 * One place so a locale switch reaches every readout that shows a distance —
 * the flight HUD, the board, the recap, the results strip — instead of each
 * call site having to remember the second argument. The "m"/"km" units are
 * locale-neutral by convention in this game (they match the metric toggle in
 * Settings) and are left as-is; only the digits follow the locale.
 */
function distanceText(meters: number): string {
  return formatDistance(meters, getLocale());
}

/**
 * How each ending is named on the results card.
 *
 * Three deaths used to produce one card reading "Flight completed" — including
 * a settle-death that fires with most of the daylight still on the meter, which
 * cannot be read as "the sun won" by any player.
 */
const END_REASON_TITLE: Record<string, string> = {
  daylight: "The sun beat you",
  water: "You washed out",
  settled: "You stopped flying",
};
const END_REASON_LINE: Record<string, string> = {
  daylight: "Your daylight ran out. Each new island refills it — keep moving.",
  water: "The sea took the run. Hit the ramp before you run out of hill.",
  settled: "Four seconds without flying ends the run. Keep the dive going.",
};

function renderScoreTable(rows: HighScore[]): string {
  if (!rows.length) return `<div class="score-table"><div class="row empty">${t("hud.renderScoreTable.NFlightsYet", undefined, "No flights yet")}</div></div>`;
  return `<div class="score-table">${rows
    .map(
      (h, i) =>
        `<div class="row ${h.vip ? "vip" : ""}"><span>${i + 1}${h.vip ? "<i class='spark'>✦</i>" : ""}</span><span>${distanceText(h.distance)}</span><span>${h.coins}c</span><span>${formatNumberLocalized(Math.floor(h.score))}</span></div>`,
    )
    .join("")}</div>`;
}

/** Board names come from a network payload — always escape before injecting. */
function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/** Inline-SVG sun-coin glyph. The UI used to mark coin amounts with the raw
 *  unicode bullet "●" (U+25CF), but neither Fredoka nor Atkinson Hyperlegible
 *  ship that codepoint in their latin subsets — the browser fell back to a
 *  random system font where the glyph was oversized and overlapped adjacent
 *  digits, producing the "● 250" blob that sat on top of the First Flight
 *  Pack header. An inline SVG matches the current text size and color, sits
 *  cleanly on the baseline, and never needs a fallback font. */
const COIN_SVG =
  '<svg class="coin-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="8.7" fill="currentColor" stroke="rgba(0,0,0,0.22)" stroke-width="1.2"/>' +
  '<path d="M7.5 11.5Q12 7.8 16.5 11.5Q12 15.2 7.5 11.5Z" fill="rgba(255,255,255,0.58)"/>' +
  '<circle cx="12" cy="12" r="1.8" fill="rgba(255,255,255,0.86)"/>' +
  "</svg>";

function sectionTitle(main: string, sub?: string): string {
  return `<div class="section-title">${main}${sub ? ` <small>${sub}</small>` : ""}</div>`;
}

/** Replace every leading bullet with the SVG coin glyph. Runs on the final
 *  rendered HTML so price strings defined in Economy.ts and toast strings in
 *  Game.ts all pick up the fix without edits at every call site. */
function renderCoins(html: string): string {
  // Match "●" optionally followed by a space and then digits/punctuation
  // (the coin amount). We keep the whitespace as a non-breaking thin gap.
  return html.replace(/●\s?/g, COIN_SVG);
}

/**
 * Where the numbers on the board actually come from, in the player's language.
 *
 * The chip used to read "Local" on every build, which was wrong on the portal
 * editions: those publish and read through the portal's own cloud when that is
 * configured. Naming the source honestly is the difference between a board the
 * player trusts and one that looks like a placeholder.
 */
function boardSource(_s: HudSnapshot): { chip: string; sentence: string } {
  const backend = leaderboardBackend();
  if (backend === "auds") {
    return { chip: LEADERBOARD_CLOUD_LABEL, sentence: `Scores sync to ${PORTAL_DISPLAY_NAME}'s worldwide board.` };
  }
  if (backend === "http") {
    return { chip: "🌐 global", sentence: "Scores sync to the global leaderboard." };
  }
  // Portal builds name the portal: a Poki player reading "Local" on a Poki page
  // concludes the board is broken, when what is true is narrower — this build
  // has no cloud board configured, so the standings are the ones on this
  // device. Say that, in the portal's own words. The rows named "· Practice"
  // are the device's generated benchmarks, and the sentence says so rather than
  // letting a new player infer that twenty named humans are ahead of them.
  const offlineBench = "Rungs marked “Practice” are this device's benchmarks, not pilots.";
  return POKI_EDITION
    ? { chip: `${PORTAL_DISPLAY_NAME} · on-device`, sentence: `This build keeps scores on your device. ${offlineBench}` }
    : { chip: "💾 local", sentence: `Rankings are stored on this device. Fly well to climb! ${offlineBench}` };
}

function renderBoard(s: HudSnapshot): string {
  const page = s.board;
  // More boards: all-time and today answer "how good am I", the week board
  // answers "how am I flying lately", and "You" is the personal history.
  // The all-time ladder is the portal's own worldwide board on the Poki
  // edition (SDK `init({ submitScore })`), so there the tab is simply the
  // portal's name — a player should never have to guess whose numbers these
  // are, and "All-time" made the Poki board look like a fourth in-game list.
  const scopes: { id: BoardScope; label: string }[] = [
    { id: "global", label: POKI_EDITION ? PORTAL_DISPLAY_NAME : "All-time" },
    { id: "week", label: "This week" },
    { id: "daily", label: "Today" },
    { id: "friends", label: "You" },
  ];
  const metrics: { id: BoardMetric; label: string }[] = [
    { id: "distance", label: "Distance" },
    { id: "score", label: "Score" },
    { id: "altitude", label: "Altitude" },
    { id: "perfects", label: "Perfects" },
    { id: "coins", label: "Coins" },
  ];
  const fmt = (v: number): string =>
    s.boardMetric === "distance" || s.boardMetric === "altitude"
      ? `${Math.round(v)} m`
      : s.boardMetric === "score"
        ? formatNumberLocalized(Math.round(v))
        : String(Math.round(v));

  // Never imply a device-only ladder is worldwide.
  const source = boardSource(s);
  const status = !s.boardOnline
    ? `<span class="board-badge local">${source.chip}</span>`
    : page?.stale
      ? `<span class="board-badge warn">${t("hud.renderBoard.OShowingCached", undefined, "Offline — showing cached")}</span>`
      : `<span class="board-badge live">${source.chip}</span>`;

  const medals = ["🥇", "🥈", "🥉"];
  const rows =
    page && page.entries.length
      ? `<div class="board-podium">${page.entries
          .slice(0, 3)
          .map(
            (e, i) => `<div class="pod p${i + 1} ${e.you ? "you" : ""}">
              <span class="pod-medal">${medals[i]}</span>
              <span class="pod-name">${escapeHtml(e.name)}</span>
              <span class="pod-val">${fmt(e.value)}</span>
            </div>`,
          )
          .join("")}</div>` +
        page.entries
          .slice(3)
          .map(
            (e, i) => `<div class="board-row ${e.you ? "you" : ""}">
              <span class="bp">${i + 4}</span>
              <span class="bn">${escapeHtml(e.name)}</span>
              <span class="bv">${fmt(e.value)}</span>
            </div>`,
          )
          .join("")
      : `<div class="board-row empty">${s.boardLoading ? "Loading…" : "No flights recorded yet — be the first wing on the board"}</div>`;

  return `
    ${head(SCREEN.leaderboard, "back", status)}
    <div class="seg">${scopes
      .map((x) => `<button data-ui data-action="board-scope" data-id="${x.id}" class="${s.boardScope === x.id ? "on" : ""}">${x.label}</button>`)
      .join("")}</div>
    <div class="seg wrap">${metrics
      .map((x) => `<button data-ui data-action="board-metric" data-id="${x.id}" class="${s.boardMetric === x.id ? "on" : ""}">${x.label}</button>`)
      .join("")}</div>
    <div class="board-list">${rows}</div>
    ${page && page.yourRank > 0 ? `<div class="board-rank">${t("hud.renderBoard.R", undefined, "Your rank · ")}<b>#${page.yourRank}</b> of ${page.total}</div>` : ""}
    ${s.portalLeaderboard
      ? `<button class="soft-btn wide" data-ui data-action="open-portal-leaderboard">🏆 ${PORTAL_DISPLAY_NAME} leaderboard</button>`
      : ""}
    ${
      CUSTOM_PILOT_NAMES
        ? `<div class="redeem pilot-name-row">
      <input data-ui data-ref="pilotName" aria-label="Pilot name" maxlength="14" placeholder="Pilot name" value="${escapeHtml(s.pilotName)}" />
      <button class="mini-btn autogen-btn" data-ui data-action="autogen-pilot" title="${t("hud.renderBoard.ARandomPilotName", undefined, "Autogenerate random pilot name")}">🎲 Random</button>
      <button class="mini-btn primary" data-ui data-action="rename-pilot">Save</button>
    </div>`
        : /* Portal editions broadcast this name to real players, so it is a
           curated generated name rather than free text — read-only display
           plus the dice, no typing surface at all. */
          `<div class="redeem pilot-name-row">
      <span class="pilot-name-readonly" aria-label="${t("hud.renderBoard.PName", undefined, "Pilot name")}">${escapeHtml(s.pilotName)}</span>
      <button class="mini-btn autogen-btn" data-ui data-action="autogen-pilot" title="${t("hud.renderBoard.RNewPilotName", undefined, "Roll a new pilot name")}">🎲 Random</button>
    </div>`
    }
    <div class="prize-card">
      ${sectionTitle("🏆 Tournament Rank Prizes")}
      <div class="prize-grid">
        <div class="prize-tier gold"><span>🥇 ${t("hud.rank.peak", undefined, "Peak rating")}</span><b>${seasonReward(s.rival.rating).division.name} &middot; ${seasonReward(s.rival.rating).coins} coins</b></div>
        <div class="prize-tier silver"><span>🥈 ${t("hud.rank.now", undefined, "You now")}</span><b>${escapeHtml(s.rival.division ?? seasonReward(s.rival.rating).division.name)}</b></div>
        <div class="prize-tier bronze"><span>🥉 ${t("hud.rank.resets", undefined, "Resets")}</span><b>${t("hud.rank.resetsBody", undefined, "every month")}</b></div>
      </div>
      ${s.rankPrizeClaimed
        ? `<div class="pc-claimed" style="width:100%; justify-content:center; padding:8px;">✓ Claimed · next prize at the season rollover</div>`
        : `<button class="primary-btn gold wide" data-ui data-action="claim-rank-prize">Claim Rank Prize 🏆</button>`}
    </div>
    <button class="soft-btn wide" data-ui data-action="board-refresh">${s.boardLoading ? "Refreshing…" : "↻ Refresh"}</button>
    <p class="fineprint">${source.sentence}</p>
  `;
}

/** Compact top-wings leaderboard embedded on the main menu. */
/**
 * The AI-flock rival controls: how many computer birds, how good they are, and
 * every format you can throw at them.
 *
 * Extracted from the old standalone AI screen so the combined PvP screen and the
 * AI-only shortcut render the *same* controls. Two copies of this drifted once —
 * the lobby advertised formats the practice screen did not offer — and the only
 * thing that can stop that recurring is there being one of them.
 */
function aiRivalSection(s: HudSnapshot): string {
  const currentMode = s.pvpModes.find((m) => m.id === s.selectedPvpMode) ?? s.pvpModes[0] ?? { name: "Sprint GP" };
  return `<section class="race-section race-section-ai" aria-label="${t("hud.aiRivalSection.RAIFlockOffline", undefined, "Race the AI flock offline")}">
      <div class="race-section-head"><h3>${menuIcon("bird")} Race the AI flock</h3><span class="section-step">offline · starts instantly</span></div>
      <p>Every format below starts immediately against computer-controlled birds — no server, no room, no rating. Learning the circuits here is the fastest way to win them online.</p>
      <div class="room-controls">
        <div class="room-ctl"><span class="room-ctl-label">${t("hud.aiRivalSection.AOpponents", undefined, "AI opponents ")}<small>plus you</small></span><div class="seg" role="group" aria-label="${t("hud.aiRivalSection.AOpponentsx", undefined, "AI opponents")}">${[5, 10, 20, 40].map((n) => `<button data-ui data-action="room-size" data-id="${n}" aria-pressed="${s.roomSize === n}" class="${s.roomSize === n ? "on" : ""}">${n}</button>`).join("")}</div></div>
        <div class="room-ctl"><span class="room-ctl-label">${t("hud.aiRivalSection.ASkill", undefined, "AI skill")}</span><div class="seg" role="group" aria-label="${t("hud.aiRivalSection.ASkillx", undefined, "AI skill")}">${(["chill", "sharp", "ace"] as const).map((k) => `<button data-ui data-action="room-skill" data-id="${k}" aria-pressed="${s.roomSkill === k}" class="${s.roomSkill === k ? "on" : ""}">${k === "chill" ? "Chill" : k === "sharp" ? "Sharp" : "Ace"}</button>`).join("")}</div></div>
      </div>
      <button class="primary-btn gold wide" data-ui data-action="ai-pvp" data-id="${s.selectedPvpMode}">🤖 Race the AI flock · ${currentMode.name}</button>
      <details class="practice-formats"><summary><h3>${t("hud.aiRivalSection.RFormats", undefined, "Race formats")}</h3></summary>
        <p class="fineprint">Dynamic AI pilots adapt locally with neural downslope timing, slipstream drafting, and slingshot attacks. No server connection required!</p>
        ${PVP_MODES.map((m) => `<button class="soft-btn wide ${s.selectedPvpMode === m.id ? "on" : ""}" data-ui data-action="ai-pvp" data-id="${m.id}">${menuIconSm(m.icon)} ${m.name} · ${m.blurb}</button>`).join("")}
        <button class="soft-btn wide" data-ui data-action="pvp-duel">⚔ 1v1 Seeded Rival Duel</button>
        <button class="soft-btn wide" data-ui data-action="practice-storm">⛈ Stormfront Race · wild weather</button>
        <button class="soft-btn wide" data-ui data-action="practice-ranked">🏆 40-Pilot Flock Grand Prix</button>
      </details>
    </section>`;
}

function renderLive(s: HudSnapshot): string {
  const connected = s.netState === "lobby" || s.netState === "racing";
  // The AI fallback seats four generated pilots in the same roster as real
  // ones, so "Connected" and "live" would both be claims about people who are
  // not there. The badge, the presence line and every peer row say AI instead.
  const status = s.roomAiFallback
    ? "AI flock · offline"
    : connected ? "Connected" : s.netState === "connecting" ? "Flock Ready" : "Local Flock";
  const live = s.lobbyRivals.filter((r) => r.tag.includes("live") || r.tag.includes("AI"));

  const modePills = s.pvpModes.map((m) => `
    <button class="pvp-pill ${s.selectedPvpMode === m.id ? "on" : ""}" data-ui data-action="select-pvp-mode" data-id="${m.id}" title="${m.blurb}">
      <span>${menuIconSm(m.icon)}</span> <b>${m.name}</b> <small>${m.finish}m</small>
    </button>
  `).join("");

  const worldPills = s.pvpWorlds.map((w) => `
    <button class="world-pill ${s.selectedPvpWorld === w.id ? "on" : ""}" data-ui data-action="select-pvp-world" data-id="${w.id}" title="${w.tagline}">
      <span>${w.emoji}</span> <b>${w.name}</b> <small>${w.difficulty}</small>
    </button>
  `).join("");

  const activeMode = s.pvpModes.find((m) => m.id === s.selectedPvpMode) ?? s.pvpModes[0] ?? { name: "Sprint GP", icon: "⚡", finish: 1500 };
  const activeWorld = s.pvpWorlds.find((w) => w.id === s.selectedPvpWorld) ?? s.pvpWorlds[0] ?? { name: "Emerald Circuit", emoji: "🌿" };

  return `${head(SCREEN.raceLobby)}
    <p class="tagline">Live pilots, private rooms, or the offline AI flock — both rivals live on this one screen.</p>
    ${s.netState === "error" && s.netError ? `<p class="network-notice" role="alert">${escapeHtml(s.netError)}</p>` : ""}
    <p class="race-fairness">${menuIcon("medal")} Equal flight equipment · your bird, your timing. Store boosts are saved for solo play.</p>

    ${s.roomCode ? `      <section class="race-section private-session" aria-label="${t("hud.renderLive.PRoom", undefined, "Your private room")}">
        <div class="race-section-head">
          <h3>${t("hud.renderLive.FRoom", undefined, "Flock Room: ")}<strong>${escapeHtml(s.roomCode)}</strong></h3>
          <span class="board-badge ${connected ? "live" : "island"}" role="status">${status}</span>
        </div>
        <div class="room-now">
          <span class="room-now-label">${t("hud.renderLive.ICode", undefined, "Invite code")}</span>
          <strong class="room-now-code">${escapeHtml(s.roomCode)}</strong>
          <button class="mini-btn" data-ui data-action="copy-invite">${t("hud.renderLive.CLink", undefined, "Copy link")}</button>
        </div>

        <div class="lobby-selector-box">
          <div class="lobby-selector-label"><span>${t("hud.renderLive.RFormat", undefined, "Race Format")}</span> <b>${activeMode.icon} ${activeMode.name} (${activeMode.finish} m)</b></div>
          <div class="pills-scroll">${modePills}</div>
          <div class="lobby-selector-label"><span>${t("hud.renderLive.WCircuit", undefined, "World Circuit")}</span> <b>${activeWorld.emoji} ${activeWorld.name}</b></div>
          <div class="pills-scroll">${worldPills}</div>
        </div>

        <p class="room-presence" role="status">${Math.max(1, s.roomCount)} ${s.roomAiFallback ? "in room · AI pilots" : "connected"} · ${s.roomReadyCount} ready</p>

        <div class="room-actions-bar">
          <button class="primary-btn gold large-btn" data-ui data-action="start-room-now">⚡ Start Race Now (${s.roomCount > 1 ? "Launch Room" : "Fill with AI flock"})</button>
          <button class="soft-btn ${s.roomReady ? "on" : ""}" data-ui data-action="ready-room" aria-pressed="${s.roomReady}" ${connected ? "" : "disabled"} title="${connected ? "" : "Race connection lost — close the room to race again"}">${s.roomReady ? "Cancel ready" : "Ready up ✓"}</button>
        </div>

        <div class="room-flock" aria-label="${t("hud.renderLive.PRoomx", undefined, "Pilots in this room")}">
          <div class="room-bird ${s.roomReady ? "is-ready" : ""}">
            ${(() => {
              const mine = s.skins.find((v) => v.equipped);
              const def = mine?.def;
              return sunbirdSVG({ width: 48, animateWings: true, palette: def ? skinPalette(def) : undefined, shape: def ? skinShape(def) : undefined });
            })()}
            <b>You</b>
            <small>${s.roomReady ? "Ready ✓" : "In room"}</small>
          </div>
          ${live.slice(0, 7).map((p, i) => `
            <div class="room-bird ${p.ready ? "is-ready" : ""}">
              ${(() => {
                const def = s.skins.find((v) => v.def.id === p.skin)?.def;
                return sunbirdSVG({ width: 48, animateWings: true, palette: def ? skinPalette(def) : rivalPalette(i + 1), shape: def ? skinShape(def) : undefined });
              })()}
              <b>${escapeHtml(p.name)}</b>
              <small>${p.ready ? "Ready ✓" : s.roomAiFallback ? "AI pilot" : "In room"}</small>
            </div>
          `).join("")}
        </div>
        ${!live.length ? `<p class="fineprint">Just you so far — share the code above and the room fills with real pilots.</p>` : ""}
        ${s.roomCount > 8 ? `<p class="fineprint">And ${s.roomCount - 8} more ${s.roomAiFallback ? "AI pilots" : "connected pilots"}</p>` : ""}

        <button class="ghost-btn" data-ui data-action="room-close">${t("hud.renderLive.LRoom", undefined, "Leave room")}</button>
      </section>` : `
      <section class="race-section quick-match-hero" aria-label="${t("hud.renderLive.QMatch", undefined, "Quick Match")}">
        <div class="race-section-head">
          <h3>⚡ Quick Match</h3>
          <span class="board-badge live">${t("hud.renderLive.LSearch", undefined, "Live search")}</span>
        </div>
        <p class="qm-desc">Search this circuit for live pilots. If nobody answers, you choose — keep waiting or race the AI flock.</p>

        <div class="quick-match-btns">
          <button class="primary-btn gold large-btn" data-ui data-action="quick-match-instant">⚡ ${activeMode.name} on ${activeWorld.name}</button>
          <button class="soft-btn" data-ui data-action="quick-match-shuffle">🎲 Surprise me — random race</button>
          <button class="soft-btn" data-ui data-action="pvp-casual">${t("hud.renderLive.SOnlinePilots", undefined, "Search Online Pilots")}</button>
        </div>

        <details class="customize-race">
          <summary>Customize · format &amp; world (${activeMode.name} · ${activeWorld.name})</summary>
          <div class="lobby-selector-box">
            <div class="lobby-selector-label"><span>${t("hud.renderLive.PFormat", undefined, "PvP Format")}</span> <b>${activeMode.icon} ${activeMode.name} (${activeMode.finish} m)</b></div>
            <div class="pills-scroll">${modePills}</div>
            <div class="lobby-selector-label"><span>${t("hud.renderLive.WCircuitx", undefined, "World Circuit")}</span> <b>${activeWorld.emoji} ${activeWorld.name}</b></div>
            <div class="pills-scroll">${worldPills}</div>
          </div>
        </details>
      </section>

      <section class="race-section room-entry" aria-label="${t("hud.renderLive.IFriends", undefined, "Invite friends")}">
        <div class="room-entry-crest">${menuIcon("online")}</div>
        <h3>${t("hud.renderLive.FFlock", undefined, "Fly with your flock")}</h3>
        ${s.multiplayerConfigured
          ? `<p>Create a private room with a custom code and link. Race your squad on any course!</p>
        <button class="primary-btn" data-ui data-action="host-room">${t("hud.renderLive.CPrivateRoom", undefined, "Create Private Room")}</button>`
          : `<p class="pilot-note island" role="note">Live rooms are not available in this edition. AI practice and same-screen 1v1 below still race.</p>
        <button class="primary-btn" data-ui data-action="host-room" disabled>${t("hud.renderLive.CPrivateRoomx", undefined, "Create Private Room")}</button>`}
        <!-- Room-code entry is shared markup: the id must exist exactly once
             in the document (duplicate ids break label/for and getElementById). -->
        <label class="field-label" for="race-room-code">${t("hud.renderLive.EFriendSRoomCode", undefined, "Or enter a friend's room code")}</label>
        <div class="redeem">
          <input id="race-room-code" data-ui data-ref="roomCode" data-enter-action="join-room" aria-label="${t("hud.renderLive.RCode", undefined, "Room code")}" maxlength="2048" placeholder="Code or invite link" autocomplete="off" autocapitalize="characters" spellcheck="false" />
          <button class="mini-btn" data-ui data-action="join-room" ${s.multiplayerConfigured ? "" : "disabled"}>Join</button>
        </div>
      </section>
      <nav class="destination-grid" aria-label="${t("hud.renderLive.MWaysRace", undefined, "More ways to race")}">
        <button class="destination" data-ui data-action="open-practice"><span class="destination-art">${menuIcon("compass")}</span><span class="destination-copy"><b>${t("hud.renderLive.APracticeOnly", undefined, "AI practice only")}</b><span>${t("hud.renderLive.SLobbyStraightFlock", undefined, "Skip the lobby — straight to the flock")}</span></span></button>
        <button class="destination" data-ui data-action="versus"><span class="destination-art">${menuIcon("versus")}</span><span class="destination-copy"><b>${t("hud.renderLive.SScreen1v1", undefined, "Same-screen 1v1")}</b><span>${t("hud.renderLive.LSplitScreenFlight", undefined, "Local split-screen flight")}</span></span></button>
        <button class="destination" data-ui data-action="open-squad"><span class="destination-art">${menuIcon("squad")}</span><span class="destination-copy"><b>Squad</b><span>${SQUAD_CHAT ? "Friends &amp; club chat" : "Friends &amp; clubs"}</span></span></button>
      </nav>`}
    <!-- The other half of the PvP offer, on the same screen as the lobby rather
         than behind a second home tile: an offline AI race is a rival, and
         picking an opponent is the player's decision, not the menu's. -->
    <div class="section-title race-rival-divider"><span>${t("hud.renderLive.RAI", undefined, "Or race the AI")}</span><small>${t("hud.renderLive.ONOWAITING", undefined, "OFFLINE · NO WAITING")}</small></div>
    ${aiRivalSection(s)}
    <button class="soft-btn wide" data-ui data-action="open-shop">${t("hud.changeLoadout", undefined, "Change loadout")}</button>
    <p class="fineprint">${t("hud.loadoutTip", undefined, "Hold downhill to build speed. Release uphill to launch. Slipstream behind rivals for slingshot surges!")}</p>`;
}

function renderPractice(s: HudSnapshot): string {
  // The AI-only view. Still reachable from the lobby's "more ways to race" row
  // for a player who wants to skip the lobby chrome entirely, and it renders the
  // same `aiRivalSection` as the combined PvP screen, so the two cannot drift.
  return `${head(SCREEN.aiPvp)}
    ${aiRivalSection(s)}
    <button class="soft-btn wide" data-ui data-action="open-live">🌐 Want human rivals? Open the lobby</button>
    <button class="soft-btn wide" data-ui data-action="open-shop">${t("hud.renderPractice.CLoadout", undefined, "Change loadout")}</button>`;
}

function renderChallenges(s: HudSnapshot): string {
  const d = s.daily;
  const g = s.gauntlet;
  const c = s.calendar;
  const raceChallenges = `
    <section class="race-section challenge-races" aria-label="${t("hud.renderChallenges.RChallenges", undefined, "Race challenges")}">
      <div class="race-section-head"><h3>${menuIcon("online")} PvP · vs AI</h3><span class="section-step">auto-matched</span></div>
      <p class="fineprint">${t("hud.renderChallenges.WFormatAreMatchedWhoeverSAvailableJumpRace", undefined, "World and format are matched to whoever's available — jump in and race.")}</p>
      <div class="quick-match-btns challenge-actions">
        <button class="primary-btn gold wide" data-ui data-action="quick-match-shuffle">⚡ Race Now · random match</button>
        <button class="soft-btn wide" data-ui data-action="ai-pvp" data-id="${escapeHtml(s.selectedPvpMode)}">🤖 vs AI flock · instant</button>
      </div>
    </section>`;
  const daily = `
    ${sectionTitle("Daily challenge", "resets at midnight")}
    <div class="daily-card ${d.done ? "done" : ""}">
      <div class="daily-head"><span class="daily-icon">${menuIconSm(d.modeIcon)}</span><div><b>${d.title}</b><em>${d.modeName} · ${escapeHtml(d.metric)} ≥ ${d.target}</em></div><span class="pill coin">● ${d.reward}</span></div>
      <div class="daily-mod"><b>${menuIconSm(d.modifierIcon)} ${d.modifierLabel}</b><span>${escapeHtml(d.modifierDesc)}</span></div>
      ${
        d.done
          ? `<div class="reward-strip">✓ Complete · come back tomorrow (${d.dailiesDone} lifetime)</div>`
          : `<button class="primary-btn" data-ui data-action="play-daily">☀ FLY THE CHALLENGE</button>`
      }
    </div>`;

  const gauntlet = `
    ${sectionTitle("Weekly gauntlet", "3 stages · resets Monday")}
    <div class="gauntlet">
      ${g.stages
        .map(
          (st) => `<div class="g-stage ${st.done ? "done" : ""}">
            <span class="g-num">${st.done ? "✓" : st.index + 1}</span>
            <div class="g-body"><b>${menuIconSm(st.modeIcon)} ${escapeHtml(st.label)}</b><em>${st.modeName} · ${escapeHtml(st.metric)} ≥ ${st.target}</em></div>
            ${st.done ? `<span class="tag on">Clear</span>` : `<button class="mini-btn" data-ui data-action="play-gauntlet" data-id="${st.index}">Fly · ● ${st.reward}</button>`}
          </div>`,
        )
        .join("")}
      <div class="g-bonus ${g.cleared ? "done" : ""}">${g.cleared ? `🏆 Gauntlet cleared this week · +${g.clearBonus} paid` : `Clear all 3 → +${g.clearBonus} coins`}${g.lifetimeClears > 0 ? ` · ${g.lifetimeClears} lifetime clears` : ""}</div>
    </div>`;

  const calendar = `
    ${sectionTitle("Login calendar", `day ${c.cycleDay || "—"} of 28`)}
    <div class="cal-grid">
      ${c.days
        .map(
          (day) =>
            `<div class="cal-day ${day.claimed ? "claimed" : ""} ${day.today ? "today" : ""} ${day.milestone ? "milestone" : ""}"><span class="cal-num">${day.day}</span><span class="cal-r">${day.label}</span></div>`,
        )
        .join("")}
    </div>
    ${
      c.claimedToday
        ? `<div class="reward-strip">📅 Today's gift claimed — see you tomorrow</div>`
        : `<button class="primary-btn" data-ui data-action="claim-calendar">📅 CLAIM TODAY'S GIFT</button>`
    }`;

  const mastery = `
    ${sectionTitle("Mode mastery", "fly every mode")}
    <div class="mastery-list">
      ${s.mastery
        .map(
          (m) => `<div class="mastery-row ${m.maxed ? "maxed" : ""}">
            <span class="m-icon">${menuIconSm(m.icon)}</span>
            <div class="m-body"><b>${m.name}${m.maxed ? ` <span class="m-skill">★ ${m.skillName}</span>` : ""}</b>
            <em>${
              m.maxed
                ? `Mastered · ${m.skillDesc} — always on in this mode`
                : `${m.runs} runs · next level at ${formatNumberLocalized(Math.round(m.nextAt ?? 0))}${m.perk ? ` · ${m.perk}` : ` · Lv.5 skill: ${m.skillName} (${m.skillDesc})`}`
            }</em>
            ${m.maxed ? "" : `<div class="qb"><i style="width:${Math.round(m.progress * 100)}%"></i></div>`}</div>
            <span class="m-stars">${"★".repeat(m.level)}${"☆".repeat(Math.max(0, 5 - m.level))}</span>
          </div>`,
        )
        .join("")}
    </div>`;

  const ev = s.weeklyEvent;
  const th = s.monthlyTheme;
  const trailDone = s.themeTrailClaimed;
  const event = `
    ${sectionTitle("Live event", "new twist every week")}
    <div class="event-card">
      <div class="daily-head"><span class="daily-icon">${menuIconSm(ev.icon)}</span><div><b>${ev.name}</b><em>${escapeHtml(ev.desc)}</em></div><span class="pill coin">● ${ev.reward}</span></div>
      <div class="event-meta"><span>Fly ${formatNumberLocalized(ev.target)} m in one event run</span><span>${s.eventClearsWeek > 0 ? `✓ ${s.eventClearsWeek} clear${s.eventClearsWeek > 1 ? "s" : ""} this week` : "No clears yet this week"}</span></div>
      <button class="primary-btn" data-ui data-action="play-event">${menuIconSm(ev.icon)} FLY THE EVENT</button>
      <div class="theme-strip ${trailDone ? "done" : ""}">
        <span class="theme-icon">${menuIconSm(th.icon)}</span>
        <div class="theme-body"><b>${th.name}</b><em>${escapeHtml(th.tagline)}</em></div>
        <span class="theme-prog">${trailDone ? "✨ trail claimed" : `${Math.min(s.eventClearsMonth, s.themeTrailNeed)}/${s.themeTrailNeed} clears → trail`}</span>
      </div>
    </div>`;

  return `
    ${head(SCREEN.challenges, "back", `<span class="pill">${t("hud.renderChallenges.DWeekly", undefined, "Daily · Weekly")}</span>`)}
    <p class="tagline">${t("hud.renderChallenges.SHillsAsEveryoneElseTodayModifiersChangeHowFlyThe", undefined, "Same hills as everyone else today. Modifiers change how you fly them.")}</p>
    ${raceChallenges}
    ${event}
    ${daily}
    ${gauntlet}
    ${calendar}
    ${mastery}
  `;
}

function renderCampaign(s: HudSnapshot): string {
  const rows = s.campaign
    .map((ch) => {
      const goals = ch.goals
        .map(
          (g) => `<div class="camp-goal ${g.done ? "done" : ""}">
            <span class="check">${g.done ? "✓" : ""}</span>
            <span class="cg-label">${escapeHtml(g.def.label)}</span>
            <span class="cg-prog">${formatNumberLocalized(Math.floor(g.progress))}/${formatNumberLocalized(g.def.target)}</span>
          </div>`,
        )
        .join("");
      const cta = !ch.unlocked
        ? `<span class="tag">🔒 Finish chapter ${ch.index} first</span>`
        : ch.claimed
          ? `<span class="tag on">✓ ${formatNumberLocalized(ch.def.rewardCoins)} coins</span>`
          : ch.complete
            ? `<button class="mini-btn gold" data-ui data-action="claim-campaign" data-id="${ch.def.id}">CLAIM ● ${ch.def.rewardCoins}</button>`
            : `<span class="tag">● ${ch.def.rewardCoins} on completion</span>`;
      return `<div class="camp-chapter ${!ch.unlocked ? "locked" : ""} ${ch.claimed ? "claimed" : ""}">
        <div class="camp-head"><span class="camp-icon">${menuIconSm(ch.def.icon)}</span><div><b>Chapter ${ch.index + 1} · ${escapeHtml(ch.def.title)}</b><em>${escapeHtml(ch.def.story)}</em></div></div>
        ${ch.unlocked ? goals : ""}
        <div class="camp-foot">${cta}</div>
      </div>`;
    })
    .join("");
  return `
    ${head(SCREEN.campaign, "back", `<span class="pill">${s.campaignDone}/${s.campaignTotal}</span>`)}
    <p class="tagline">A journey in eight chapters. Progress accrues from every flight — no separate grind.</p>
    <div class="camp-list">${rows}</div>
  `;
}

/** Exported so the Pilot Lookup panel can be tested without a live game. */
export function renderSquad(s: HudSnapshot): string {
  const sq = s.squad;
  const friendPage = paginate(sq.friends, sq.friendPage);
  const clubPage = paginate(sq.clubs, sq.clubPage);
  const pages = (kind: string, view: { page: number; pages: number }): string => view.pages < 2 ? "" : `<nav class="collection-pager" aria-label="${kind} pages"><button class="mini-btn" data-ui data-action="squad-page" data-id="${kind}:${view.page - 1}" aria-label="Previous ${kind}" ${view.page === 0 ? "disabled" : ""}>‹</button><span>${view.page + 1} / ${view.pages}</span><button class="mini-btn" data-ui data-action="squad-page" data-id="${kind}:${view.page + 1}" aria-label="Next ${kind}" ${view.page === view.pages - 1 ? "disabled" : ""}>›</button></nav>`;
  const notice = s.squadNotice ? `<div class="reward-strip">${escapeHtml(s.squadNotice)}</div>` : "";

  const quests = `
    ${sectionTitle("Squadron Team Quests", "Co-Op Milestones")}
    <div class="squad-quests">
      ${SQUAD_QUESTS.map((q) => {
        const prog = q.id === "migration" ? Math.min(q.target, Math.round(s.bestDistance * 1.5)) : q.id === "drafting" ? Math.min(q.target, Math.round(s.runsPlayed * 5)) : Math.min(q.target, Math.round(s.todayBest / 100));
        return `<div class="squad-quest-card">
          <div class="sq-info"><b>${escapeHtml(q.title)}</b><span>${escapeHtml(q.desc)}</span></div>
          <div class="sq-action">
            ${prog >= q.target
              ? `<button class="mini-btn gold" data-ui data-action="claim-squad-quest" data-id="${q.id}">Claim ● ${q.rewardCoins}</button>`
              : `<span class="sq-prog-label">${prog}/${q.target}</span>`}
          </div>
        </div>`;
      }).join("")}
    </div>
  `;

  // ---------------------------------------------------------- pilot lookup
  // The panel never invents a pilot. Every row below is either a code the
  // service resolved, a wingman row the service returned, or a pilot this
  // device actually shared a room with.
  const lookup = sq.lookup;
  const lookupCard = (() => {
    if (!lookup) return "";
    if (lookup.status !== "ok") {
      const tone = lookup.status === "unavailable" ? "island" : "warn";
      return `<div class="pilot-note ${tone}" role="status">${escapeHtml(lookup.message)}${lookup.query ? ` <b>${escapeHtml(lookup.query)}</b>` : ""}</div>`;
    }
    const stats = [
      lookup.club ? `🏰 ${escapeHtml(lookup.club)}` : "",
      lookup.bestDistance > 0 ? `🛫 best ${formatNumberLocalized(lookup.bestDistance)} m` : "",
      lookup.rank > 0 ? `#${lookup.rank} global` : "",
    ].filter(Boolean).join(" · ");
    const action = lookup.friend
      ? `<span class="fineprint">${t("hud.renderCampaign.AWingmen", undefined, "Already in your wingmen")}</span>`
      : lookup.incoming
        ? `<button class="primary-btn" data-ui data-action="pilot-add" data-id="${escapeHtml(lookup.code)}">${t("hud.renderCampaign.ATheirRequest", undefined, "Accept their request")}</button>`
        : lookup.outgoing
          ? `<span class="fineprint">${t("hud.renderCampaign.RSentWaitingThem", undefined, "Request sent — waiting for them")}</span>`
          : `<button class="primary-btn" data-ui data-action="pilot-add" data-id="${escapeHtml(lookup.code)}">🪽 Add wingman</button>`;
    return `
      <div class="pilot-card">
        <div class="pilot-card-head">
          <b>${escapeHtml(lookup.name)}</b>
          <span class="pilot-dot ${lookup.online ? "on" : ""}">${lookup.online ? "● Online now" : "○ Offline"}</span>
        </div>
        <div class="pilot-card-meta"><span class="pilot-code">${escapeHtml(lookup.code)}</span>${stats ? `<span>${stats}</span>` : ""}</div>
        <div class="pilot-card-actions">
          ${action}
          <button class="mini-btn" data-ui data-action="pilot-invite" data-id="${escapeHtml(lookup.name)}">${t("hud.renderCampaign.IMyRoom", undefined, "Invite to my room")}</button>
          <button class="mini-btn" data-ui data-action="pilot-copy" data-id="${escapeHtml(lookup.code)}">${t("hud.renderCampaign.CCode", undefined, "Copy code")}</button>
        </div>
      </div>`;
  })();

  const requests = (() => {
    const rows = [
      ...sq.requestsIn.map((r) => `<div class="friend-row"><span class="fr-name">📨 ${escapeHtml(r.name)}</span><span class="fr-code">wants to fly with you</span><button class="mini-btn" data-ui data-action="req-accept" data-id="${escapeHtml(r.requestId)}">Accept</button><button class="mini-btn ghost" data-ui data-action="req-decline" data-id="${escapeHtml(r.requestId)}">Decline</button></div>`),
      ...sq.requestsOut.map((r) => `<div class="friend-row"><span class="fr-name">📤 ${escapeHtml(r.name)}</span><span class="fr-code">request pending</span><button class="mini-btn ghost" data-ui data-action="req-cancel" data-id="${escapeHtml(r.requestId)}">Cancel</button></div>`),
    ];
    if (!rows.length) return "";
    return `${sectionTitle("Requests", `${rows.length} waiting`)}<div class="friend-list">${rows.join("")}</div>`;
  })();

  const lookupPanel = `
    ${sectionTitle("🔍 Pilot Lookup", sq.live && !sq.isAutonomous ? "online directory" : "offline build")}
    <p class="fineprint">Look a pilot up by their exact code. Results come from the pilot directory — nothing here is invented, and an unknown or unreachable code says so.</p>
    <div class="redeem">
      <input data-ui data-ref="pilotCode" data-enter-action="pilot-add" aria-label="${t("hud.renderCampaign.FCodex", undefined, "Friend code")}" placeholder="Friend code (SUN-9F3K2A)" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${escapeHtml(sq.pilotQuery)}" />
      <button class="mini-btn" data-ui data-action="pilot-lookup">${sq.lookupBusy ? "Looking…" : "Look up"}</button>
    </div>
    ${lookupCard}
    ${requests}`;

  const wingmen = (() => {
    const page = sq.friends.length > 0 ? friendPage : { items: [], page: 0, pages: 0 };
    if (!sq.friends.length) {
      return `${sectionTitle("🪽 Wingmen", "0")}
        <div class="empty-note">No wingmen yet. Look one up by code above, or save a pilot you have actually raced with below. Your code is <b>${escapeHtml(sq.myCode || "…")}</b>.</div>`;
    }
    return `
    ${sectionTitle("🪽 Wingmen", String(sq.friends.length))}
    <div class="friend-list">${(page.items as typeof sq.friends)
      .map((f) => {
        const presence = f.local ? "met in a race" : f.online ? "● online" : "○ offline";
        const best = f.bestDistance && f.bestDistance > 0 ? ` · best ${formatNumberLocalized(Math.round(f.bestDistance))} m` : "";
        return `<div class="friend-row"><span class="fr-name">🐦 ${escapeHtml(f.name)} <small>${escapeHtml(presence)}${best}</small></span><span class="fr-code">${escapeHtml(f.code || "")}</span><button class="mini-btn" data-ui data-action="friend-challenge" aria-label="Challenge ${escapeHtml(f.name)}" data-id="${escapeHtml(f.code || f.name)}">🏁 Challenge</button><button class="mini-btn ghost" data-ui data-action="squad-remove" aria-label="Remove ${escapeHtml(f.name)}" data-id="${escapeHtml(f.code || f.name)}">✕</button></div>`;
      })
      .join("")}</div>${pages("friends", page)}`;
  })();

  // Ghost-race challenges (SocialSystem.FriendChallenge) — an async chase
  // line posted against a wingman's best, settled the moment you land.
  const ghostChallenges = (() => {
    const challenges = s.friendChallenges ?? [];
    if (!challenges.length) return "";
    const kindLabel: Record<FriendChallenge["challengeKind"], string> = {
      distance: "distance", score: "score", altitude: "altitude", perfects: "perfect launches",
    };
    const rows = challenges
      .map((ch) => {
        const status = ch.status === "accepted" ? "racing — fly to settle it" : "posted — tap to race";
        return `<div class="friend-row"><span class="fr-name">🏁 vs ${escapeHtml(ch.challengerName)} <small>${escapeHtml(status)}</small></span><span class="fr-code">beat ${formatNumberLocalized(Math.round(ch.ghostDistance))} m ${kindLabel[ch.challengeKind]}</span><button class="mini-btn gold" data-ui data-action="challenge-race" data-id="${escapeHtml(ch.id)}">🏁 Race ghost</button></div>`;
      })
      .join("");
    return `${sectionTitle("🏁 Ghost Challenges", `${challenges.length} active`)}
      <p class="fineprint">Async races against a wingman's posted line — race the ghost and the result settles the instant you land.</p>
      <div class="friend-list">${rows}</div>`;
  })();

  // Real history: rooms this device actually shared with other pilots.
  const flewWith = (() => {
    const mates = s.recentPilots.filter((m) => !sq.friends.some((f) => f.name.toLowerCase() === m.name.toLowerCase()));
    if (!s.recentPilots.length) {
      return `${sectionTitle("🛫 Flew with", "0")}<div class="empty-note">Pilots who share a room with you appear here — real rooms, real names, remembered on this device.</div>`;
    }
    const rows = mates.slice(0, 8).map((m) => `<div class="friend-row">
      <span class="fr-name">🐦 ${escapeHtml(m.name)}</span>
      <span class="fr-code">room ${escapeHtml(m.roomCode)} · ${escapeHtml(seenAgo(m.lastSeenAt, Date.now()))}${m.bestDistance > 0 ? ` · ${formatNumberLocalized(m.bestDistance)} m` : ""}</span>
      <button class="mini-btn" data-ui data-action="mate-wingman" data-id="${escapeHtml(m.name)}">Save</button>
      <button class="mini-btn ghost" data-ui data-action="mate-invite" data-id="${escapeHtml(m.name)}">Invite</button>
      <button class="mini-btn ghost" data-ui data-action="mate-forget" data-id="${escapeHtml(m.name)}" aria-label="Forget ${escapeHtml(m.name)}">✕</button>
    </div>`).join("");
    return `${sectionTitle("🛫 Flew with", `${s.recentPilots.length} remembered`)}
      <p class="fineprint">${t("hud.renderCampaign.KDeviceFromRacesActuallyFlewTogether", undefined, "Kept on this device from races you actually flew together.")}</p>
      <div class="friend-list">${rows || `<div class="empty-note">${t("hud.renderCampaign.EFlewAlreadyWingmen", undefined, "Everyone you flew with is already in your wingmen.")}</div>`}</div>`;
  })();

  const friends = `${lookupPanel}${wingmen}${ghostChallenges}${flewWith}`;
  const myClub = sq.clubs.find((c) => c.id === sq.myClubId);
  const clubChat = SQUAD_CHAT && myClub
    ? `
    <div class="club-chat">
      <div class="chat-box" data-scroll-memory="squad-chat" data-stick-bottom role="log" aria-label="Club chat history">
        ${sq.chat.length
          ? sq.chat.map((m) => `<div class="chat-line"><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.text)}</span></div>`).join("")
          : `<div class="empty-note">${t("hud.renderCampaign.SHelloClubMessagesStayBetweenMembers", undefined, "Say hello to your club — messages stay between members.")}</div>`}
      </div>
      <div class="redeem">
        <input data-ui data-enter-action="squad-chat" aria-label="${t("hud.renderCampaign.CMessage", undefined, "Club message")}" placeholder="Message your club" maxlength="140" autocomplete="off" />
        <button class="mini-btn" data-ui data-action="squad-chat">Send</button>
      </div>
    </div>`
    : "";
  const clubs = myClub
    ? `
    ${sectionTitle("Your club", `${myClub.members}/30 members`)}
    <div class="club-card mine">
      <div class="daily-head"><span class="daily-icon">🏰</span><div><b>${escapeHtml(myClub.name)}</b><em>${escapeHtml(myClub.motto)}</em></div><button class="mini-btn ghost" data-ui data-action="squad-leave-club">Leave</button></div>
    </div>
    ${clubChat}`
    : `
    ${sectionTitle("Flight Clubs", "join or found one")}
    ${
      sq.clubs.length
        ? `<div class="club-list">${clubPage.items
            .map(
              (c) => `<div class="club-row"><div><b>🏰 ${escapeHtml(c.name)}</b><em>${escapeHtml(c.motto)} · ${c.members}/30</em></div><button class="mini-btn" data-ui data-action="squad-join-club" data-id="${c.id}" ${c.members >= 30 ? "disabled" : ""}>Join</button></div>`,
            )
            .join("")}</div>`
        : `<div class="empty-note">${t("hud.renderCampaign.NClubsYetFoundFirstOne", undefined, "No clubs yet — found the first one.")}</div>`
    }
    ${pages("clubs", clubPage)}
    <div class="redeem"><input data-ui data-enter-action="squad-create-club" aria-label="${t("hud.renderCampaign.CName", undefined, "Club name")}" placeholder="Club name" maxlength="24" autocomplete="off" /><button class="mini-btn gold" data-ui data-action="squad-create-club">${t("hud.renderCampaign.FClub", undefined, "Found club")}</button></div>`;

  const hubBanner = sq.isAutonomous
    ? `<div class="reward-strip" style="background:linear-gradient(135deg,#fff8e1,#ffe082); color:#5d4037; border:1px solid #ffcc80; margin-bottom:12px;">📴 Offline build · wingman requests and pilot lookup need the online service. Pilots you actually raced with still work.</div>`
    : "";

  // A lost Squad key never blocks the pilot: flight progress, coins and
  // birds live in the save file, not in the Squad service. The honest path
  // is an explicit, confirmed re-enrollment into a fresh profile.
  const recovery = sq.credentialError && !sq.isAutonomous
    ? `<section class="squad-recovery" role="region" aria-label="${t("hud.renderRank.SProfileRecovery", undefined, "Squad profile recovery")}">
        ${sectionTitle("Squad profile recovery", "key missing")}
        <p>${escapeHtml(sq.error || "This browser cannot unlock the saved Squad profile.")} Your flight progress, coins and birds are untouched — only the Squad identity is locked.</p>
        <label class="recovery-consent"><input type="checkbox" data-ui /> I understand this creates a separate Squad profile.</label>
        <div class="room-actions-bar">
          <button class="primary-btn" data-ui data-action="squad-new-profile" ${sq.busy || sq.loading ? "disabled" : ""}>${t("hud.renderCampaign.CNewSquadProfile", undefined, "Create a new Squad profile")}</button>
          <button class="soft-btn" data-ui data-action="squad-refresh" ${sq.loading ? "disabled" : ""}>${t("hud.renderCampaign.TReconnecting", undefined, "Try reconnecting")}</button>
        </div>
      </section>`
    : "";

  return `
    ${head(SCREEN.squad, "back", sq.myCode ? `<span class="pill">${escapeHtml(sq.myCode)}</span>` : "")}
    <p class="tagline">${t("hud.renderCampaign.LFlockBiggerAdventure", undefined, "A little flock. A bigger adventure.")}</p>
    ${hubBanner}
    ${recovery}
    ${sq.myCode ? `<div class="squad-invite"><span class="squad-invite-art">${menuIcon("squad")}</span><div><b>${t("hud.renderCampaign.FCode", undefined, "Your friend code")}</b><p>${t("hud.renderCampaign.SSomeoneWantFly", undefined, "Share it with someone you want to fly with.")}</p></div><button class="mini-btn" data-ui data-action="squad-copy-code">${t("hud.renderCampaign.CCodex", undefined, "Copy code")}</button></div>` : ""}
    ${notice}
    ${quests}
    <fieldset class="squad-fields"><legend class="sr-only">${t("hud.renderCampaign.SActions", undefined, "Squad actions")}</legend>${friends + clubs}</fieldset>
    <button class="soft-btn wide" data-ui data-action="squad-refresh" ${sq.loading || sq.busy ? "disabled" : ""}>${sq.loading ? "Connecting…" : "Refresh Squad"}</button>
    <button class="soft-btn wide" data-ui data-action="open-live">${t("hud.renderCampaign.RFriends", undefined, "Race with friends")}</button>
  `;
}

function renderRank(s: HudSnapshot): string {
  const r = s.rival;
  const wl = r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0;
  return `
    ${head(SCREEN.rivalRank, "back", `<span class="pill">${boardSource(s).chip}</span>`)}
    <div class="rank-hero">
      <div class="rank-div-big">${r.divisionIcon}</div>
      <div class="rank-hero-num">${r.rating}</div>
      <div class="rank-hero-div">${r.division}</div>
      <div class="rank-bar big"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
      <div class="rank-hero-next">${r.nextNeeded > 0 ? `${formatNumberLocalized(Math.round(r.nextNeeded))} rating to ${r.nextName}` : "Top division — defend it"}</div>
    </div>
    <div class="rank-stats">
      <div><span>W–L</span><b>${r.wins}–${r.losses}</b></div>
      <div><span>${t("hud.renderRank.WRate", undefined, "Win rate")}</span><b>${wl}%</b></div>
      <div><span>Streak</span><b class="streak-b ${r.streak > 0 ? "lit" : ""}"><svg viewBox="0 0 24 24" class="fl"><path d="M12 2C13 6 17 8 17 13a5 5 0 0 1-10 0c0-2 1-3.4 2-4.6 0 1.6.6 2.6 1.8 3 -.4-3.4 1.4-6.6 1.2-9.4z" fill="currentColor"/></svg>${r.streak}</b></div>
      <div><span>Best</span><b>×${r.bestStreak}</b></div>
    </div>
    <div class="season-card">
      <div class="season-head"><b>Season</b><span class="pill">${r.season.daysLeft}d left</span></div>
      <div class="season-body">Peak ${r.season.peakIcon} ${r.season.peak} · pays <b>● ${r.season.rewardCoins}</b> at reset, then ratings drift halfway back to 1000.</div>
    </div>
    ${sectionTitle("Recent races", "this device only")}
    ${
      r.matches.length
        ? `<div class="match-list">${[...r.matches]
            .reverse()
            .map(
              (m) =>
                `<div class="match-row ${m.won ? "won" : ""}"><span class="m-place">${m.won ? "🏅" : ""}P${m.place}</span><span class="m-meta">of ${m.field} · ${escapeHtml(m.mode)}</span><span class="m-date">${escapeHtml(m.date)}</span></div>`,
            )
            .join("")}</div>`
        : `<p class="fineprint">${t("hud.renderRank.NRankedRacesYetFirst40BirdFinishSetsTone", undefined, "No ranked races yet. Your first 40-bird finish sets the tone.")}</p>`
    }
    ${sectionTitle("Duels", "ranked 1v1 · ±16 rating")}
    <div class="duel-card">
      <div class="vs-stage slim">
        <div class="vs-you"><span class="bird-badge you">${(() => {
        // The badge sat directly above the line that names the bird you are
        // flying, and drew the default Sunbird in default orange — so the one
        // place a ranked player checks their own bird showed them the wrong one.
        const mine = s.skins.find((v) => v.equipped) ?? s.skins.find((v) => v.owned);
        const def = mine?.def;
        return sunbirdSVG({ palette: def ? skinPalette(def) : undefined, shape: def ? skinShape(def) : undefined, width: 62, animateWings: true, title: def ? def.name : "Your sunbird" });
      })()}</span><b>YOU</b><span class="vs-sub">${r.rating}</span></div>
        <div class="vs-mark">VS</div>
        <div class="vs-foes"><div class="vs-foe"><span class="bird-badge">${sunbirdSVG({ palette: rivalPalette(0), width: 54, flap: 0.35, title: s.duelFoe.name })}</span><b>${escapeHtml(s.duelFoe.name)}</b><span class="vs-sub">${escapeHtml(s.duelFoe.tag)} · ~${s.duelFoe.rating}</span></div></div>
      </div>
      <div class="rank-stats">
        <div><span>Duel W–L</span><b>${s.duel.wins}–${s.duel.losses}</b></div>
        <div><span>Streak</span><b class="streak-b ${s.duel.streak > 0 ? "lit" : ""}"><svg viewBox="0 0 24 24" class="fl"><path d="M12 2C13 6 17 8 17 13a5 5 0 0 1-10 0c0-2 1-3.4 2-4.6 0 1.6.6 2.6 1.8 3 -.4-3.4 1.4-6.6 1.2-9.4z" fill="currentColor"/></svg>${s.duel.streak}</b></div>
        <div><span>Best</span><b>×${s.duel.bestStreak}</b></div>
        <div><span>Prize</span><b>${s.duel.wins >= 10 ? "🐦 won" : `${s.duel.wins}/10`}</b></div>
      </div>
      <button class="primary-btn hero" data-ui data-action="pvp-duel"><span class="hero-label">⚔ DUEL</span><span class="hero-hint">1v1 · first to 4,000 m · win 10 for the Hummingbird</span></button>
      <p class="fineprint ranked-perk-note" title="${t("hud.renderCups.RModeCosmeticPerksAreBalancedFairPlay", undefined, "In ranked mode, cosmetic perks are balanced for fair play")}">🛡 In ranked duels, cosmetic perks are balanced for fair play — max +3% speed, +3s buffs, earned birds included. Flying <b>${escapeHtml(s.loadout.bird)}</b>: ${escapeHtml(s.loadout.rankedNote)}</p>
    </div>
    <button class="primary-btn race40 hero" data-ui data-action="pvp-ranked"><span class="hero-label">⚔ RACE RANKED</span><span class="hero-hint">climb or defend ${r.division}</span></button>
    <p class="fineprint">Your rating changes based on how you finish in ranked 40-bird races and duels. Reaching Sunbird Legend unlocks the Solstice bird. Seasons soft-reset monthly with a division reward.</p>
  `;
}

function renderCups(s: HudSnapshot): string {
  const hrs = (ms: number): string => {
    const h = Math.floor(ms / 3600000);
    return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
  };
  const cups = s.cups
    .map((c) => {
      const tierLabel = c.tier ? c.tier.toUpperCase() : "UNRANKED";
      const prize = c.tier ? c.def.prizes[c.tier] : null;
      return `<div class="cup-card ${c.tier ?? ""}">
        <div class="cup-head"><span class="cup-icon">${menuIconSm(c.def.icon)}</span>
          <div><b>${c.def.name}</b><em>${c.def.blurb}</em></div>
          <span class="cup-timer">${hrs(c.endsInMs)} left</span>
        </div>
        <div class="cup-meta"><span class="cup-tier ${c.tier ?? "none"}">${tierLabel}</span><span>Best ${Math.round(c.entry.best)}</span><span>${c.entry.attempts} runs</span></div>
        <div class="qb"><i style="width:${Math.round(c.progress * 100)}%"></i></div>
        <div class="cup-next">${c.nextTier ? `Next: ${c.nextTier} at ${Math.round(c.nextCut)}` : "Diamond secured"}</div>
        ${
          c.claimable && prize
            ? `<button class="mini-btn gold" data-ui data-action="claim-cup" data-id="${c.def.id}">Claim ${menuIconSm(prize.icon)} ${prize.label}</button>`
            : `<button class="mini-btn" data-ui data-action="pick-mode" data-id="${c.def.mode}">Fly ${c.def.mode}</button>`
        }
      </div>`;
    })
    .join("");

  const trails = s.trails.length
    ? `${sectionTitle("Prize trails")}<div class="btn-row">${s.trails
        .map((t) => `<button class="soft-btn ${t.equipped ? "gold" : ""}" data-ui data-action="equip-trail" data-id="${t.id}">${t.equipped ? "✓ " : ""}${t.label}</button>`)
        .join("")}</div>`
    : "";

  // The diamond cup's title prize was written to `state.titles` and read
  // nowhere, so the hardest prize in the game vanished on claim. Shown here
  // beside the prize trails, which is where won cosmetics already live.
  const titles = s.titles.length
    ? `${sectionTitle("Prize titles")}<div class="btn-row">${s.titles
        .map((title) => `<span class="soft-btn prize-title" title="${t("hud.renderCups.wornBesideName", undefined, "Worn beside your name")}">♛ ${escapeHtml(title.label)}</span>`)
        .join("")}</div>`
    : "";

  return `
    ${head(SCREEN.tournaments, "back", `<span class="pill">Weekly</span>`)}
    <p class="tagline">Two cups run every week. Beat a division cut-off, then claim the prize — it lands in your account immediately.</p>
    <div class="cup-list">${cups}</div>
    ${s.lastPrize ? `<div class="reward-strip">Last prize · ${s.lastPrize}</div>` : ""}
    ${trails}
    ${titles}
    <p class="fineprint">${t("hud.renderCups.CResetEveryMondayWonCosmeticsArePermanent", undefined, "Cups reset every Monday. Won cosmetics are permanent.")}</p>
  `;
}

function renderModes(s: HudSnapshot): string {
  return `
    ${head(SCREEN.gameModes)}
    <p class="tagline">${t("hud.renderModes.SFlightsBelowAreAgainstCourse", undefined, "Solo flights below are you against the course. A ")}<b>${t("hud.renderModes.PCircuit", undefined, "PvP circuit")}</b> opens the PvP options — ranked and casual online racing, private rooms, or the AI flock. All modes share your unlocks.</p>
    <div class="mode-list">
      ${s.modes
        .map(
          (m) => `<button class="mode-card ${m.id === s.modeId ? "on" : ""}" data-ui data-action="pick-mode" data-id="${m.id}">
            <span class="mode-icon">${menuIconSm(m.icon)}</span>
            <span class="mode-body"><b>${m.name}</b><em>${m.blurb}</em></span>
            <span class="mode-meta">${m.finish ? `${m.finish / 1000} km` : m.clock ? `${m.clock}s` : "∞"}</span>
            ${m.id === s.modeId ? `<span class="mode-check" aria-hidden="true">✓</span>` : ""}
          </button>`,
        )
        .join("")}
    </div>
    ${sectionTitle("Racing Circuits", "PVP &amp; AI")}
    <div class="mode-list">
      ${PVP_MODES
        .map(
          (m) => `<button class="mode-card ${m.id === s.modeId ? "on" : ""}" data-ui data-action="pick-mode" data-id="${m.id}">
            <span class="mode-icon">${menuIconSm(m.icon)}</span>
            <span class="mode-body"><b>${m.name}</b><em>${m.blurb}</em></span>
            <span class="mode-meta">${m.finish ? `${m.finish / 1000} km` : m.clock ? `${m.clock}s` : "∞"}</span>
            ${m.id === s.modeId ? `<span class="mode-check" aria-hidden="true">✓</span>` : ""}
          </button>`,
        )
        .join("")}
    </div>
    ${sectionTitle("Race the flock offline")}
    <button class="primary-btn gold wide" data-ui data-action="open-practice">🤖 AI PvP · pick a circuit &amp; race the neural flock</button>
    <button class="soft-btn wide" data-ui data-action="versus">👥 Split-screen · 2 players on this device</button>
  `;
}

function renderVersusResult(s: HudSnapshot): string {
  const a = s.p1Stats!;
  const b = s.p2Stats!;
  const row = (label: string, x: number, y: number, fmt: (n: number) => string): string => {
    const win = x === y ? 0 : x > y ? 1 : 2;
    const max = Math.max(x, y, 1);
    return `<div class="vs-stat">
      <span class="${win === 1 ? "w" : ""}">${fmt(x)}</span>
      <em>${label}<i class="vs-bars"><b class="l" style="width:${Math.round((x / max) * 100)}%"></b><b class="r" style="width:${Math.round((y / max) * 100)}%"></b></i></em>
      <span class="${win === 2 ? "w" : ""}">${fmt(y)}</span>
    </div>`;
  };
  const time = (r: RacerStats): string => (r.finishedAt > 0 ? `${r.finishedAt.toFixed(1)}s` : "DNF");
  const margin =
    a.finishedAt > 0 && b.finishedAt > 0 ? Math.abs(a.finishedAt - b.finishedAt).toFixed(1) + "s" : "by distance";
  return `
    <div class="vs-hero ${s.versusWinner === 1 ? "p1win" : "p2win"}">
      <span class="vs-crown-big">🏆</span>
      <div class="vs-winner">PLAYER ${s.versusWinner} WINS</div>
      <div class="vs-margin">by ${margin} · same device, same hills</div>
    </div>
    <div class="vs-head"><span class="p1">🟠 P1 · SPACE / left half</span><span class="p2">P2 · ENTER / right half 🔵</span></div>
    <div class="vs-stats">
      <div class="vs-stat time"><span>${time(a)}</span><em>race time</em><span>${time(b)}</span></div>
      ${row("distance", a.distance, b.distance, (n) => `${Math.round(n)}m`)}
      ${row("max altitude", a.maxAltitude, b.maxAltitude, (n) => `${Math.round(n)}m`)}
      ${row("perfect ramps", a.perfects, b.perfects, (n) => String(n))}
      ${row("best combo", a.bestCombo, b.bestCombo, (n) => `×${n}`)}
      ${row("coins", a.coins, b.coins, (n) => String(n))}
      ${row("top speed", a.topSpeed, b.topSpeed, (n) => `${Math.round(n)}`)}
    </div>
    <button class="primary-btn hero" data-ui data-action="versus"><span class="hero-label">REMATCH</span><span class="hero-hint">swap sides for fairness</span></button>
    <button class="ghost-btn" data-ui data-action="menu">Menu</button>
  `;
}

function renderAtlas(s: HudSnapshot): string {
  return `
    ${head(SCREEN.atlas, "back", `<span class="pill">Farthest: ${s.farthestIsland + 1}</span>`)}
    <p class="tagline">${t("hud.renderAtlas.EIslandHasItsOwnWeatherLearnThemThenChainThem", undefined, "Every island has its own weather. Learn them, then chain them.")}</p>
    <div class="atlas">
      ${s.atlas
        .map(
          (a) => `<div class="atlas-card ${a.reached ? "reached" : ""}" style="--c:${a.color}">
            <div class="atlas-num">Island ${a.island + 1}</div>
            <div class="atlas-emoji">${a.reached ? menuIconSm(a.emoji) : menuIconSm("question")}</div>
            <div class="atlas-name">${a.reached ? a.name : "Unknown shores"}</div>
            <div class="atlas-tag">${a.reached ? a.tagline : "Reach it to chart it"}</div>
            ${a.reached && a.hazard !== "none" ? `<div class="atlas-hazard">${a.hazard === "gust" ? `${menuIconSm("cloud")} headwinds` : `${menuIconSm("lightning")} ash storms`}</div>` : ""}
          </div>`,
        )
        .join("")}
    </div>
    <div class="field-guide">
      <div class="mission-head">${t("hud.fieldGuide", undefined, "Field guide")}</div>
      <div class="fg-row"><b>♨ Thermals</b> Shimmering columns. Release inside one to ride it up.</div>
      <div class="fg-row"><b>🌬 Headwinds</b> Slow you in the air. Hold to tuck and punch through.</div>
      <div class="fg-row"><b>🌩 Ash storms</b> Sap your speed. Fly beneath them, or dive early.</div>
      <div class="fg-row"><b>❄ Snow caps</b> Just pretty — but the peaks are taller. Build speed before them.</div>
    </div>
  `;
}

function menuLinks(items: MenuDestination[]): string {
  return items.map(item =>
    `<button class="destination" data-ui data-action="${item.action}" data-icon="${item.icon}"><span class="destination-art">${menuIcon(item.icon)}</span><span class="destination-copy"><b>${item.title}</b><span>${item.detail}</span></span><span class="destination-arrow" aria-hidden="true">${arrowUpRightSvg()}</span></button>`,
  ).join("");
}

function renderNameEntry(s: HudSnapshot): string {
  // The first-run welcome screen is a name surface like any other, so it obeys
  // the same edition split as the board's pilot-name row: portal editions
  // broadcast this name to real players and allow no unmoderated player-authored
  // text, so they get a curated generated name and a dice — no typing surface at
  // all, and the field is not in those bundles. The direct/web/itch build owns
  // its own surfaces and keeps free rename.
  //
  // The portal variant deliberately uses a <span>, not a <label for=…>: there is
  // no input for it to point at, and a dangling label is an accessibility defect.
  //
  // The direct build's field is pre-filled from the snapshot, the same way the
  // board's rename field is. Boot used to do it with `setValue("pilotNameInput")`
  // immediately after `setScreen("nameEntry")`, but the screen renders on the
  // next HUD push, so the ref did not exist yet and the call was a silent no-op:
  // the field came up empty and "Let's Fly" — the primary CTA, under copy that
  // says "We picked a name for you" — only toasted "Please enter a pilot name".
  // A first-run player who did not notice the dice had no way past the screen.
  const field = CUSTOM_PILOT_NAMES
    ? `<label class="name-entry-label" for="pilot-name-input">${t("hud.renderNameEntry.CSign", undefined, "Your call sign")}</label>
      <div class="name-input-row">
        <div class="name-input-wrapper">
          <input
            type="text"
            id="pilot-name-input"
            data-ui
            data-ref="pilotNameInput"
            placeholder="e.g. Rook, Ivy, Vale…"
            maxlength="14"
            aria-label="${t("hud.homeBoardStrip.PName", undefined, "Pilot name")}"
            autocomplete="off"
            value="${escapeHtml(s.pilotName)}"
          />
          <div class="name-char-count"><span>${s.pilotName.length}</span>/14</div>
        </div>
        <button class="name-random-btn" data-ui data-action="randomize-pilot-name" title="${t("hud.homeBoardStrip.SName", undefined, "Suggest a name")}" aria-label="${t("hud.homeBoardStrip.RName", undefined, "Random name")}">🎲</button>
      </div>`
    : `<span class="name-entry-label">${t("hud.renderNameEntry.CSignx", undefined, "Your call sign")}</span>
      <div class="name-input-row">
        <span class="pilot-name-readonly name-entry-plate" aria-label="Pilot name">${escapeHtml(s.pilotName)}</span>
        <button class="name-random-btn" data-ui data-action="randomize-pilot-name" title="Roll a new name" aria-label="Random name">🎲</button>
      </div>`;

  return `
    <div class="name-entry-hero">
      ${sunSVG({ size: 48, className: "name-entry-sun" })}
      ${sunbirdSVG({ width: 72, className: "name-entry-bird", animateWings: true, title: "Sunbird" })}
    </div>

    <div class="name-entry-headline">
      <h2 class="name-entry-title">${t("hud.renderNameEntry.WPilot", undefined, "Welcome, Pilot")}</h2>
      <p class="name-entry-sub">We picked a name for you — ${CUSTOM_PILOT_NAMES ? "change it" : "roll it"} or fly right now.</p>
    </div>

    <div class="name-entry-form">
      ${field}

      <label class="name-language" for="welcome-language-select">
        <span>${t("hud.renderNameEntry.LIdioma", undefined, "Language / Idioma")}</span>
        <select id="welcome-language-select" data-ui data-action="set-language" aria-label="Choose language">
          ${SUPPORTED_LOCALES.map(loc => `<option value="${loc.code}" ${getLocale() === loc.code ? "selected" : ""}>${loc.flag} ${loc.name}</option>`).join("")}
        </select>
      </label>

      <button class="primary-btn name-entry-cta" data-ui data-action="confirm-pilot-name">
        Let's Fly ›
      </button>
    </div>

    <p class="name-entry-footer">${
      CUSTOM_PILOT_NAMES
        ? "You can rename yourself anytime in Settings."
        : "Roll the dice for a different call sign — you can roll again anytime."
    }</p>
  `;
}

/**
 * "Top wings" — the live board, three rows, on the home screen.
 *
 * Competition is a reason to press play again, so the standing is shown above
 * the Play grid, not only behind a menu page. It is a view onto the page the
 * menu already fetches, and it disappears when there is nothing to show.
 */
function homeBoardStrip(s: HudSnapshot): string {
  const rows = s.homeBoard.slice(0, 3);
  // Render even with no rows. This strip is now the home menu's ONLY route to
  // the leaderboards (the tile moved to SECONDARY_DESTINATIONS), and `homeBoard`
  // is empty whenever the board cache is cold — first boot, a failed fetch, an
  // offline launch. Returning "" there left the leaderboards unreachable from
  // the menu at all, on exactly the boots where a player is most likely to go
  // looking. An empty state that still opens the page beats no control.
  // Rank badges are drawn, not emoji: medal glyphs render as tofu boxes on
  // font sets without the emoji face (several platforms ship none by default),
  // and a row of empty squares under "Top pilots" reads as broken.
  const medals = ["1", "2", "3"];
  // Three compact rows in ONE panel, not three stacked cards. The rows are the
  // live top of the ladder — the player's own line is marked, so the strip says
  // "you belong on this board" instead of "here is a table" — and the whole
  // panel opens the full leaderboards. Density is what keeps it above the Play
  // grid: the earlier three-card version cost ~3x this height and pushed PvP
  // off a 640-tall phone entirely.
  return `
    <button class="home-board" data-ui data-action="open-board" aria-label="${t("hud.renderOnboardingRoute.OLeaderboards", undefined, "Open the leaderboards")}">
      <span class="hb-head">
        <span class="hb-title">🏆 Top pilots</span>
        <span class="hb-go">All boards ›</span>
      </span>
      ${rows.length
        ? rows
            .map(
              (row, i) => `<span class="hb-row${row.you ? " you" : ""}">
            <span class="hb-medal">${medals[i]}</span>
            <span class="hb-name">${escapeHtml(row.name)}</span>
            <span class="hb-val">${row.value}</span>
          </span>`,
            )
            .join("")
        : `<span class="hb-empty">${escapeHtml(t("hud.boardStrip.empty", undefined, "No runs posted yet — set the first mark"))}</span>`}
    </button>`;
}

/**
 * Daily Login Ritual banner: "Daily Challenge ready! +N coins waiting",
 * shown at boot and on every return to the home menu until either the daily
 * is completed or the player dismisses it (Play now / the X). Uses the same
 * `pc pc--gold pc-row` card the "Do this now" strip uses elsewhere, so the
 * home menu and the progress screen share one visual language for "act now".
 */
function renderDailyRitualBanner(s: HudSnapshot): string {
  if (!shouldShowDailyBanner(s.daily.done, s.dismissedDailyPrompt)) return "";
  // Clickable. It announced coins waiting and offered no route to them; the only
  // child control was a dismiss, which is a way to make the problem go away.
  return `<div class="pc pc--gold pc-row daily-ritual-banner">
    <button class="pc-open" data-ui data-action="open-challenges">
    <span class="pc-icon">☀️</span>
    <div class="pc-body"><b>${t("hud.renderDailyRitualBanner.DChallengeReady", undefined, "Daily Challenge ready!")}</b><span>+${s.daily.reward} coins waiting — open ›</span></div>
    </button>
    <button class="mini-btn ghost daily-ritual-close" data-ui data-action="dismiss-daily-banner" aria-label="Dismiss">✕</button>
  </div>`;
}

/**
 * Persistent tournament countdown card (Feature: Tournament Countdown
 * Urgency): "<cup> ends in N day(s) — You're currently <tier>!", for the
 * soonest-ending of this week's two cups. Tapping it opens Tournaments.
 */
function renderTournamentCountdown(s: HudSnapshot): string {
  // The countdown card is the home screen's ONLY route to Tournaments (the
  // tile moved to SECONDARY_DESTINATIONS), and it used to return "" whenever
  // `tournamentCountdownCard` had nothing to say — so tournaments vanished
  // from the menu entirely on exactly the boots where the cups had not loaded
  // yet. With no card there is still a tournament to enter, so the strip
  // renders in a plain state rather than withdrawing the route.
  const card = tournamentCountdownCard(s.cups);
  // Reuses the already-styled `event-strip` card (weekly-event strip on the
  // progress screen) rather than inventing unstyled markup — same visual
  // language for "a clock is running on this", different destination.
  return `<button class="event-strip" data-ui data-action="open-cups" aria-label="${t("hud.renderMain.VTournaments", undefined, "View tournaments")}">
    <span class="ds-icon">🏆</span>
    <span class="ds-body">${escapeHtml(card?.text ?? t("hud.tournaments.idle", undefined, "Weekly score challenges"))}</span>
    <span class="ds-go">›</span>
  </button>`;
}

/**
 * The five things a new pilot is shown, under the main "Fly now" button.
 *
 * These used to be "Feel the glide / Choose your bird / Race the flock" — but
 * step 1 was the same action as the button directly above it, so the panel
 * opened by offering the player something they had just been handed, and the
 * two text destinations it taught (racing, the shop) were not the two the game
 * actually needs explained first. It is now the five surfaces a first run has
 * to meet: fly, the hangar, the AI flock, live rivals, and settings — which is
 * every action in `QUICK_ACTIONS` plus the first flight itself.
 *
 * The steps are honest about WHERE they are: step 1 used to say "Spend the coins
 * you just earned" on a brand-new save, which starts at zero.
 */
function renderOnboardingRoute(s: HudSnapshot): string {
  // A walkthrough, not a poster. Each step dims and strikes itself through once
  // it is done, so the panel shrinks in meaning rather than in height as the
  // player learns the game. Every step is a real destination, and the four rail
  // destinations (PvP, AI PvP, shop, settings) are the same handlers the rail
  // fires, so the panel and the rail can never disagree.
  //
  // `done` is STORED, not derived, and deliberately so. The first attempt
  // derived it from `runsPlayed` / `wallet` / `bestDistance` and every one was
  // wrong: the wallet is a live balance, so a step completed and then spent
  // un-completed itself; `bestDistance > 0` marked "Meet your rivals" done
  // after one solo flight. "Did you open the shop" has no counter that means
  // only that, so it is a first-visit milestone in the save — monotonic, so it
  // cannot revert, and readable on a device that never showed this panel.
  const steps: readonly { n: string; action: string; title: string; sub: string; go: string; done: boolean }[] = [
    {
      n: "01", action: "pvp-practice", go: t("onboarding.step1Action", undefined, "Fly ›"),
      title: t("onboarding.step1Title", undefined, "Fly your first run"),
      sub: t("onboarding.step1Sub", undefined, "One input · the goal is on the strip"),
      done: s.runsPlayed >= 1,
    },
    {
      n: "02", action: "open-shop", go: t("onboarding.step2Action", undefined, "Shop ›"),
      title: t("onboarding.step2Title", undefined, "Choose your bird"),
      sub: t("onboarding.step2Sub", undefined, "Birds, trails and boosts for your next flight"),
      // `seenShop`, not `wallet > 0`. The wallet is a live balance: a player
      // who completed this step and then spent their coins saw it revert to
      // active. A milestone that un-completes itself is worse than none.
      done: s.firstSteps.shop,
    },
    {
      n: "03", action: "open-practice", go: t("onboarding.step3Action", undefined, "AI race ›"),
      title: t("onboarding.step3Title", undefined, "Race the flock"),
      sub: t("onboarding.step3Sub", undefined, "A real opponent is always there, even offline"),
      // `seenPve` — actually opening AI PvP. `runsPlayed >= 2` completed this
      // step for anyone who flew twice, including players who never touched it.
      done: s.firstSteps.pve,
    },
    {
      n: "04", action: "open-live", go: t("onboarding.step4Action", undefined, "Race ›"),
      title: t("onboarding.step4Title", undefined, "Meet your rivals"),
      sub: t("onboarding.step4Sub", undefined, "Live pilots, or a private room for a friend"),
      // `seenPvp` — actually opening the live lobby. `bestDistance > 0` was
      // true after one solo flight, so a solo-only player saw "Meet your
      // rivals" struck through without ever having tried.
      done: s.firstSteps.pvp,
    },
    {
      n: "05", action: "open-settings", go: t("onboarding.step5Action", undefined, "Settings ›"),
      title: t("onboarding.step5Title", undefined, "Make it yours"),
      sub: t("onboarding.step5Sub", undefined, "Sound, controls and how big the world looks"),
      done: s.firstSteps.settings,
    },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);
  const allDone = nextIndex === -1;
  const head = allDone
    ? t("onboarding.allDone", undefined, "You know the ropes")
    : t("onboarding.startSubtitle", undefined, "five things worth knowing");
  return `<section class="onboarding-route" aria-label="${escapeHtml(t("onboarding.routeLabel", undefined, "Your first flight plan"))}">
      <div class="onboarding-route-head"><span>✦ ${allDone ? escapeHtml(t("onboarding.routeDone", undefined, "FLIGHT PLAN")) : escapeHtml(t("onboarding.startHere", undefined, "START HERE"))}</span><small>${escapeHtml(head)}</small><button class="mini-btn ghost onboarding-dismiss" data-ui data-action="dismiss-onboarding" aria-label="${escapeHtml(t("onboarding.skip", undefined, "Skip"))}">✕</button></div>
      <ol class="onboarding-route-steps">
        ${steps.map((step, i) => `<li><button class="onboarding-route-step${step.done ? " done" : ""}${i === nextIndex ? " active" : ""}" data-ui data-action="${step.action}"${step.done ? " disabled" : ""}><b>${step.done ? escapeHtml(t("onboarding.stepDoneMark", undefined, "✓")) : step.n}</b><span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.sub)}</small></span><i>${escapeHtml(step.go)}</i></button></li>`).join("")}
      </ol>
    </section>`;
}

/**
 * The rail that sits directly under the main button.
 *
 * Four destinations, in one row, one tap below "Fly now" — the two things a
 * returning player does most (race someone, change something) used to be
 * scrolled off the bottom of a three-section menu.
 *
 * Rendered as real buttons with an explicit aria-label, because the visible
 * label is the destination's short title ("PvP") and the action it performs is
 * not obvious from it alone ("Race a real pilot" is). The label is the detail
 * line, so a screen reader announces the destination and not just the tile.
 *
 * `aria-current` is deliberately absent: this is navigation, not a position in
 * a set, and marking one of four as "current" would imply a state none of them
 * has.
 */
function renderQuickRail(): string {
  return `<nav class="home-quick-rail" aria-label="${escapeHtml(t("hud.quickRail.label", undefined, "Quick actions"))}">${QUICK_ACTIONS.map(
    (item) =>
      `<button class="quick-action quick-rail-btn" data-ui data-action="${item.action}" data-icon="${item.icon}" aria-label="${escapeHtml(item.title)} — ${escapeHtml(item.detail)}"><span class="quick-rail-art" aria-hidden="true">${menuIcon(item.icon)}</span><span class="quick-rail-copy"><b>${escapeHtml(item.title)}</b></span></button>`,
  ).join("")}</nav>`;
}

function renderMain(s: HudSnapshot): string {
  // MenuCatalog is the single source of truth for home navigation. Keep the
  // renderer declarative: filtering destinations here used to leave stale PvP
  // entries in the catalog and made other screens drift from the home menu.
  const playDestinations = PLAY_DESTINATIONS;
  const progressDestinations = PROGRESS_DESTINATIONS;
  return `
    <button
      class="icon-btn menu-mute"
      data-ui
      data-action="set-mute"
      data-menu-mute
      aria-pressed="${s.settings.mute ? "true" : "false"}"
      aria-label="${s.settings.mute ? "Unmute sound" : "Mute sound"}"
      title="${s.settings.mute ? "Unmute sound" : "Mute sound"}"
    >${s.settings.mute ? "\u{1F507}" : "\u{1F50A}"}</button>
    <header class="hero">
      ${menuHorizon()}
      <!-- Sun and bird both come from Sunbird.ts, so the title screen, the
           lobby and the flock in the menu sky are literally one sun and one
           bird. This SVG *is* the reference the whole game is drawn from. -->
      <div class="hero-sun-wrap">${sunSVG({ size: 64, className: "hero-sun" })}</div>
      ${sunbirdSVG({ className: "hero-bird", width: 92, title: "Sunbird", animateWings: true })}
      <div class="hero-title">
        <span class="hero-kicker">chase the daylight</span>
        <h1>SUNBIRD</h1>
        <p class="hero-sub">${t("hud.heroSub", undefined, "Hold to dive. Release to soar.")}<br>${t("hud.heroSub2", undefined, "Master the glide across endless islands.")}</p>
      </div>
    </header>

    <button class="primary-btn home-launch" data-ui data-action="pvp-practice" aria-label="${t("onboarding.flyNow", undefined, "Fly now")}"><span class="launch-art">${menuIcon("flight")}</span><span class="launch-copy"><small>${t("onboarding.skyIsYours", undefined, "THE SKY IS YOURS")}</small><b>${t("onboarding.flyNow", undefined, "Fly now")}</b><span>${t("onboarding.launchSub", undefined, "Hold to dive · release to glide")}</span></span><span class="launch-arrow" aria-hidden="true">${arrowRightSvg()}</span></button>
    ${renderQuickRail()}
    ${renderDailyRitualBanner(s)}
    ${renderTournamentCountdown(s)}
    ${!s.settings.dismissedOnboarding ? renderOnboardingRoute(s) : ""}
    <!-- 01 — PLAY. PvP, AI PvP and the solo modes are all ways of playing, so
         they sit under the Play heading as one grid. Standings then close the
         section as a single full-width bar instead of a sixth row of choices:
         "how am I doing" is a different question from "what shall I play", and
         one bar at the end reads as the section's full stop. -->
    <div class="home-section-title"><span>${t("hud.renderMain.PNow", undefined, "Play now")}</span><small>${t("hud.renderMain.FRACEEXPLORE", undefined, "FLY · RACE · EXPLORE")}</small></div>
    <nav class="destination-grid play-destinations home-hub-grid" aria-label="Play">${menuLinks(playDestinations)}</nav>
    ${homeBoardStrip(s)}
    <div class="home-section-title"><span>Progress</span><small>${t("hud.renderMain.GRANKREWARDS", undefined, "GOALS · RANK · REWARDS")}</small></div>
    <nav class="destination-grid progress-destinations home-hub-grid" aria-label="Progress">${menuLinks(progressDestinations)}</nav>
    <div class="home-record"><span class="record-art">${menuIcon("medal")}</span><span>${t("hud.menu.personalBest", undefined, "Personal best")} <b>${distanceText(s.bestDistance)}</b></span><button class="record-pass" data-ui data-action="open-pass">${t("hud.menu.nestPass", undefined, "Nest Pass")} Lv.${s.season.tier}/${s.season.maxTier}</button><span class="record-wallet">● ${formatNumberLocalized(s.wallet)} <small>${t("hud.menu.coinBalance", undefined, "coins")}</small></span></div>
  `;
}

function renderProgress(s: HudSnapshot): string {
  const portal = s.portalName !== "none";
  const modes: { id: SeedMode; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "random", label: "Wild" },
  ];
  const seedPicker = !portal && s.gold
    ? `<div class="seg">${modes
        .map((m) => `<button data-ui data-action="seed-${m.id}" class="${s.seedMode === m.id ? "on" : ""}">${m.label}</button>`)
        .join("")}</div>`
    : portal
      ? `<p class="portal-note">${PORTAL_EDITION_NOTE}</p>`
      : SELL_AD_REMOVAL ? `<button class="lock-chip" data-ui data-action="open-paywall">✦ Pick your hills with Gold</button>` : "";
  // The subtitle below is deliberately NOT wrapped in t(). It had a t() call
  // whose key was never added to the barrel, so it read as translated in the
  // source while rendering the English fallback for all 20 locales. The
  // source→barrel coverage test (i18n/__tests__/locales.test.ts) fails on
  // exactly that now; until a real translation exists for every shipped
  // locale, a plain literal is the honest representation of its state.
  // --- Do This Now: time-sensitive actions ---
  const doNow: string[] = [];
  if (!s.calendar.claimedToday) doNow.push(`<button class="cal-strip" data-ui data-action="claim-calendar">📅 Daily gift ready — day ${(s.calendar.cycleDay % 28) + 1} of 28 <b>CLAIM</b></button>`);
  if (s.canFreeSpin) doNow.push(`<div class="pc pc--blue pc-row"><span class="pc-icon">🎡</span><div class="pc-body"><b>${t("hud.renderProgress.DLuckyWheel", undefined, "Daily Lucky Wheel")}</b><span>${t("hud.renderProgress.FSpinAvailableNow", undefined, "Free spin available now!")}</span></div><button class="primary-btn gold" data-ui data-action="spin-wheel">Free Spin! 🎡</button></div>`);
  if (s.piggyCoins >= PIGGY_BANK_MIN_SMASH) doNow.push(`<div class="pc pc--pink pc-row"><span class="pc-icon">🐷</span><div class="pc-body"><b>${t("hud.renderProgress.PBankReady", undefined, "Piggy Bank ready")}</b><span>● ${s.piggyCoins} coins saved — smash it!</span></div><button class="primary-btn gold" data-ui data-action="smash-piggy">Smash 🔨</button></div>`);

  // --- Collect section: non-urgent systems ---
  const collectSections: string[] = [];
  if (!s.canFreeSpin) collectSections.push(`<div class="pc pc--blue pc-row"><span class="pc-icon">🎡</span><div class="pc-body"><b>${t("hud.renderProgress.DLuckyWheelx", undefined, "Daily Lucky Wheel")}</b><span>Spin to win up to ● 1,000 Coins &amp; Mystery Vault Keys</span></div><button class="soft-btn" disabled>🎡 Tomorrow</button></div>`);
  if (s.piggyCoins < PIGGY_BANK_MIN_SMASH) collectSections.push(`<div class="pc pc--pink pc-row"><span class="pc-icon">🐷</span><div class="pc-body"><b>${t("hud.renderProgress.CPiggyBank", undefined, "Coin Piggy Bank")}</b><span>+20% flight bonus: ● ${s.piggyCoins} / ${PIGGY_BANK_CAP}</span></div><span class="tag need">${t("hud.renderProgress.FFill", undefined, "Fly to fill")}</span></div>`);
  if (s.nestLevel >= 5 || s.prestigeLevel > 0) collectSections.push(`<div class="pc pc--purple pc-row"><span class="pc-icon">👑</span><div class="pc-body"><b>Solar Crown Prestige ${s.prestigeLevel > 0 ? `Rank ${s.prestigeLevel}` : ""}</b><span>Permanent coin boost: +${Math.round((s.prestigeMult - 1) * 100)}%</span></div><button class="primary-btn gold" data-ui data-action="perform-prestige">Rebirth 👑</button></div>`);

  return `${head(t("hud.progress.title", undefined, "Your progress"))}
    <div class="hero-meta">
      <span class="pill seed-pill">${s.seedLabel}</span>
      <span class="pill wings-pill" title="${distanceText(s.wings.lifetime)} lifetime">${menuIconSm(s.wings.icon)} ${s.wings.name}</span>
      <span class="pill">● ${formatNumberLocalized(s.wallet)}</span>
      <span class="pill">🔥 ${s.streakDays}d</span>
    </div>
    ${
      s.wings.nextNeeded > 0
        ? `<div class="wings-track" aria-label="${t("hud.renderSkinCollections.CProgress", undefined, "Career progress")}"><i style="width:${Math.round(s.wings.progress * 100)}%"></i><span>${distanceText(s.wings.nextNeeded)} to ${s.wings.nextName}</span></div>`
        : ""
    }
    ${s.rivalBanner ? renderRivalBanner(s.rivalBanner) : ""}

    ${doNow.length ? `<div class="section-title progress-do-now"><span>${t("hud.renderProgress.DNow", undefined, "Do this now")}</span></div>${doNow.join("")}` : ""}

    ${sectionTitle("Today", "QUESTS &amp; GOALS")}
    ${renderGoalList(s.sessionGoals)}
    ${renderQuests(s.quests)}

    <button class="event-strip" data-ui data-action="play-event">
      <span class="ds-icon">${menuIconSm(s.weeklyEvent.icon)}</span>
      <span class="ds-body"><b>Event · ${s.weeklyEvent.name}</b><em>${menuIconSm(s.monthlyTheme.icon)} ${s.monthlyTheme.name} · fly ${formatNumberLocalized(s.weeklyEvent.target)} m · ● ${s.weeklyEvent.reward}</em></span>
      <span class="ds-go">${s.eventClearsWeek > 0 ? `✓${s.eventClearsWeek}` : "FLY"}</span>
    </button>

    ${sectionTitle("Career", "RANK &amp; WINGS")}
    <button class="rank-card" data-ui data-action="open-rank" aria-label="View local Rival rank (practice field)">
      <span class="rank-div">${s.rival.divisionIcon} ${s.rival.division}</span>
      <span class="rank-num">${s.rival.rating}</span>
      <span class="rank-bar"><i style="width:${Math.round(s.rival.progress * 100)}%"></i></span>
      <span class="rank-sub">${
        s.rival.nextNeeded > 0
          ? `${formatNumberLocalized(s.rival.rating)} / ${formatNumberLocalized(Math.round(s.rival.rating + s.rival.nextNeeded))} to ${s.rival.nextName}`
          : "Top division — defend it"
      } · 🔥${s.rival.streak} streak</span>
    </button>
    <div class="wallet-row">
      <span class="pill">Nest Lv.${s.nestLevel} · ×${s.nestMult.toFixed(2)}</span>
      ${!portal && s.gold ? '<span class="pill gold">✦ Gold</span>' : ""}
      ${!portal && s.vip ? '<span class="pill vip">♛ VIP</span>' : ""}
      <span class="pill skill">${s.skillLabel}</span>
    </div>

    ${collectSections.join("")}
    ${seedPicker}

    ${renderMissions(s.missions)}
    <div class="menu-stats"><div>Best <b>${distanceText(s.bestDistance)}</b></div><div>Today <b>${distanceText(s.todayBest)}</b></div></div>
`;
}

function skinRarity(d: { goldOnly?: boolean; vipOnly?: boolean; prizeOnly?: string; price: number; rarity?: string }): { key: string; label: string } {
  if (d.prizeOnly) return { key: "prize", label: "PRIZE" };
  // Explicit rarity from the catalogue wins over inferred price bands.
  if (d.rarity && d.rarity !== "starter") return { key: d.rarity, label: d.rarity.toUpperCase() };
  if (d.vipOnly) return { key: "mythic", label: "MYTHIC" };
  if (d.goldOnly) return { key: "legendary", label: "LEGENDARY" };
  if (d.price >= 700) return { key: "epic", label: "EPIC" };
  if (d.price >= 400) return { key: "rare", label: "RARE" };
  if (d.price > 0) return { key: "common", label: "COMMON" };
  return { key: "starter", label: "STARTER" };
}

function skinStatBars(d: { speedMult: number; feverBonus: number; daylightBonus: number; magnetAlways: boolean }): string {
  const bars: [string, number, string][] = [
    ["Speed", Math.min(100, Math.round(((d.speedMult - 1) / 0.08) * 100)), `${d.speedMult > 1 ? "+" : ""}${Math.round((d.speedMult - 1) * 100)}%`],
    ["Fever", Math.min(100, Math.round((d.feverBonus / 5) * 100)), d.feverBonus > 0 ? `+${d.feverBonus}s` : "—"],
    ["Daylight", Math.min(100, Math.round((d.daylightBonus / 12) * 100)), d.daylightBonus > 0 ? `+${d.daylightBonus}s` : "—"],
  ];
  return `<div class="sk-stats">${bars
    .map(([k, pct, val]) => `<span class="sk-stat"><em>${k}</em><i><b style="width:${pct}%"></b></i><u>${val}</u></span>`)
    .join("")}${d.magnetAlways ? `<span class="sk-stat mag">🧲 always-on</span>` : ""}</div>`;
}

/** Group the 60+ bird wall into browsable collections with owned counters. */
function renderSkinCollections(s: HudSnapshot, browse: ShopBrowse): string {
  const matches = browseSkins(s.skins, browse);
  const filtered = browse.query.trim() !== "" || browse.filter !== "all";
  if (!matches.length) return `<div class="shop-empty">${menuIcon("compass")}<b>${t("hud.renderSkinCollections.NBirdsView", undefined, "No birds in this view")}</b><p>${t("hud.renderSkinCollections.TBirdNamePerkDifferentFilter", undefined, "Try a bird name, a perk, or a different filter.")}</p><button class="soft-btn" data-ui data-action="shop-clear">${t("hud.renderSkinCollections.SAllBirds", undefined, "Show all birds")}</button></div>`;
  const portal = s.portalName !== "none";
  const byId = new Map<string, SkinView[]>();
  for (const v of matches) {
    const cid = v.def.collection ?? "starter";
    if (!byId.has(cid)) byId.set(cid, []);
    byId.get(cid)!.push(v);
  }
  return COLLECTIONS.filter((c) => byId.has(c.id))
    .map((c) => {
      const skins = byId.get(c.id)!;
      const collection = s.skins.filter(v => (v.def.collection ?? "starter") === c.id);
      const got = collection.filter(v => v.owned).length;
      const complete = got === collection.length;
      const bonus = 100 + collection.length * 25;
      return `<details class="collection ${complete ? "complete" : ""}" data-ref="collection-${c.id}${filtered ? "-filtered" : ""}" ${filtered ? "open" : ""}>
        <summary class="coll-head"><span class="collection-art">${menuIcon(c.id === "tournament" ? "trophy" : c.id === "achievement" ? "medal" : c.id === "cosmic" ? "endless" : c.id === "premium" ? "rank" : c.id === "elements" ? "boost" : c.id === "nature" ? "atlas" : "bird")}</span><b>${c.name}</b>
        <span class="coll-count">${complete ? "✓ complete" : `${got}/${collection.length} · bonus ● ${bonus}`}</span></summary>
        <div class="skin-grid">${skins.map((v) => renderSkinCard(v, portal, browse.preview, s.wallet)).join("")}</div>
      </details>`;
    })
    .join("");
}

export function skinAction(v: SkinView, portal: boolean, wallet: number): string {
  const d = v.def;
  const price = v.dealPrice ?? d.price;
  const priceLabel = v.dealPrice !== undefined ? `<s>● ${d.price}</s> ● ${price}` : `● ${price}`;
  let action: string;
  if (v.equipped) action = `<span class="tag on">✓ In use</span>`;
  else if (v.owned) action = `<button class="mini-btn" data-ui data-action="equip-skin" data-id="${d.id}">Equip</button>`;
  else if (d.prizeOnly) action = `<span class="tag prize" title="${d.prizeOnly}">🏆 ${d.prizeOnly}</span>`;
  else if (v.locked && portal)
    // A Gold-locked variant must not become a paywall on the portal build.
    // Selling premium currency is forbidden there (Poki REQ-20) and the portal
    // carries no Gold checkout, so a button here would be an offer the portal
    // edition cannot honour — the same defect REQ-31 covers for the break
    // overlay. It is named as a perk instead, so the row still says why the
    // item is locked rather than hiding behind a dead end.
    action =
      v.lockReason === "gold"
        ? `<span class="tag portal-lock">${t("hud.skinAction.GPerk", undefined, "Gold perk")}</span>`
        : `<span class="tag portal-lock">♛ VIP — not on this build</span>`;
  else if (v.locked && SELL_AD_REMOVAL)
    action = `<button class="mini-btn ${v.lockReason === "vip" ? "vip" : "gold"}" data-ui data-action="open-paywall">${v.lockReason === "vip" ? "♛ VIP" : "✦ Gold"}</button>`;
  else if (v.locked)
    action = `<span class="tag portal-lock">${t("hud.skinAction.GPerk", undefined, "Gold perk")}</span>`;
  else
    action = `<button class="mini-btn ${v.affordable ? (v.dealPrice !== undefined ? "gold" : "") : "off"}" data-ui data-action="buy-skin" data-id="${d.id}" ${v.affordable ? "" : "disabled"} aria-label="${v.affordable ? `Buy ${d.name} for ${price} coins` : `${d.name} costs ${price} coins; earn more coins to unlock`}">${priceLabel}</button>`;
  return action + (!v.owned && !v.locked && !d.prizeOnly && !v.affordable ? `<small class="purchase-shortfall">${Math.max(0, price - wallet)} more coins</small>` : "");
}

function renderSkinCard(v: SkinView, portal: boolean, preview: string, wallet: number): string {
  const d = v.def, rarity = skinRarity(d);
  // Species and colour together, and a real wingbeat. This card is the product
  // shot: it was 88px, static, and one silhouette for all sixty-nine birds, so
  // the shop read as a colour chart. Bigger, alive, and drawn as the species it
  // sells.
  const birdSvg = sunbirdSVG({ palette: skinPalette(d), shape: skinShape(d), width: 104, animateWings: true, title: d.name });
  const dealTag = v.dealPrice !== undefined && !v.owned ? `<span class="deal-tag">TODAY −40%</span>` : "";
  return `<div class="skin-card r-${rarity.key} ${v.equipped ? "equipped" : ""} ${v.owned ? "owned" : ""} ${v.dealPrice !== undefined ? "deal" : ""}" data-skin="${d.id}">
    <span class="rarity">${rarity.label}</span>
    ${dealTag}
    <button class="skin-bird skin-preview" data-ui data-action="preview-skin" data-id="${d.id}" aria-label="Preview ${d.name}" aria-pressed="${preview === d.id}">${birdSvg}<span>Preview</span></button>
    <div class="sk-name">${d.name}</div><div class="sk-perk">${d.perk}</div>${skinStatBars(d)}${skinAction(v, portal, wallet)}</div>`;
}

function renderRivalBanner(banner: string): string {
  const [name, dist] = banner.split("|");
  return `<div class="rival-banner">🥊 <b>${escapeHtml(name)}</b> ${t("hud.rivalChallenge", undefined, "challenged you — beat")} <b>${escapeHtml(dist)} m</b> ${t("hud.rivalOnHills", undefined, "on their hills. Hold to fly.")}</div>`;
}

function renderBoostRow(v: BoostView, wallet: number): string {
  const d = v.def;
  const price = v.dealPrice ?? d.price;
  const missing = Math.max(0, price - wallet);
  const priceLabel = v.dealPrice !== undefined ? `<s>● ${d.price}</s> ● ${price}` : `● ${price}`;
  const action = v.armed
    ? `<span class="tag on">${d.permanent ? "Unlocked ✓" : "Armed ✓"}</span>`
    : v.affordable
      ? `<button class="mini-btn ${v.dealPrice !== undefined ? "gold" : ""}" data-ui data-action="buy-boost" data-id="${d.id}">${priceLabel}</button>`
      : `<span class="tag need">Need ${missing}●</span>`;
  const dealTag = v.dealPrice !== undefined && !v.armed ? `<span class="deal-tag">TODAY −50%</span>` : "";
  return `<div class="boost-row ${v.armed ? "armed" : ""} ${v.dealPrice !== undefined ? "deal" : ""}"><span class="bi">${menuIcon("boost")}</span><div><div class="mt"><b class="boost-name">${escapeHtml(d.name)}</b>${d.permanent ? `<span class="boost-once">permanent</span>` : `<span class="boost-once">one flight</span>`}${dealTag}</div><div class="md">${d.desc}</div></div>${action}</div>`;
}

function renderTrailCard(v: ShopTrailView, wallet: number): string {
  const d = v.def;
  const stops = d.css.join(", ");
  const missing = Math.max(0, d.price - wallet);
  const action = v.equipped
    ? `<span class="tag on">✓ In use</span>`
    : v.owned
      ? `<button class="mini-btn" data-ui data-action="buy-trail" data-id="${d.id}">Equip</button>`
      : v.affordable
        ? `<button class="mini-btn" data-ui data-action="buy-trail" data-id="${d.id}">● ${d.price}</button>`
        : `<span class="tag need">Need ${missing}●</span>`;
  return `<div class="trail-card ${v.equipped ? "equipped" : ""}">
    <span class="trail-swatch" style="background:linear-gradient(90deg, ${stops})"></span>
    <div class="trail-body"><b>${d.label}</b><em>${d.desc}</em></div>${action}</div>`;
}

function renderShop(s: HudSnapshot, browse: ShopBrowse): string {
  const owned = s.skins.filter((v) => v.owned).length;
  const armedBoosts = s.boosts.filter((b) => b.armed);
  const equippedSkin = s.skins.find(v => v.def.id === browse.preview) ?? s.skins.find(v => v.equipped);
  const matches = browseSkins(s.skins, browse).length;
  const heroSvg = equippedSkin
    ? sunbirdSVG({ palette: skinPalette(equippedSkin.def), shape: skinShape(equippedSkin.def), width: 168, animateWings: true, title: equippedSkin.def.name })
    : sunbirdSVG({ width: 128, animateWings: true, title: "Sunbird" });

  const flash = s.dailyFlash ?? dailyFlashBird("today");
  const flashDef = skinById(flash.id);
  const flashView = s.skins.find(v => v.def.id === flash.id);
  const flashOwned = flashView?.owned ?? false;
  const flashSvg = sunbirdSVG({ palette: skinPalette(flashDef), shape: skinShape(flashDef), width: 104, animateWings: true, title: flashDef.name });

  const filters = [
    ["all", "All birds"],
    ["affordable", "Can unlock"],
    ["owned", "Owned"],
    ["nature", "Nature 🌿"],
    ["cosmic", "Cosmic 🌌"],
    ["elements", "Elements 🌪"],
    ["legendary", "Legendary ★"],
  ] as const;

  return `
    ${head(SCREEN.shop, "back", `<span class="pill coin">● ${formatNumberLocalized(s.wallet)}</span>`)}
    <p class="shop-intro">${t("hud.renderShop.H", undefined, "YOUR HANGAR ")}<span>${t("hud.renderShop.FWingsMakeThemYours", undefined, "Find your wings. Make them yours.")}</span></p>

    <div class="pc pc--gold pc-row">
      <span class="pc-icon">🪙</span>
      <div class="pc-body">
        <b>${t("hud.renderShop.DFlightStipend", undefined, "Daily Flight Stipend")}</b>
        <span>Daily test &amp; hangar allowance</span>
      </div>
      ${s.stipendClaimed
        ? `<span class="tag on">Claimed Today ✓</span>`
        : `<button class="primary-btn gold" data-ui data-action="claim-daily-stipend">Claim +● ${DAILY_STIPEND}</button>`
      }
    </div>
    ${s.adAvailable ? `
    <div class="pc pc--gold pc-row">
      <span class="pc-icon">📺</span>
      <div class="pc-body">
        <b>${t("hud.renderShop.FCoins", undefined, "Free Coins")}</b>
        <span>Watch a short ad · +● ${SHOP_AD_COINS} (max ${SHOP_AD_SESSION_CAP}/hour)</span>
      </div>
      <button class="primary-btn gold" data-ui data-action="shop-free-coins">${t("hud.renderShop.WAd", undefined, "Watch Ad")}</button>
    </div>` : ""}

    <div class="pc pc--red">
      <div class="pc-header">
        <span class="pc-badge">🔥 DAILY FLASH SALE · 40% OFF</span>
        <span class="pc-label" style="color:#c62828;">${t("hud.renderShop.RMidnight", undefined, "Resets at Midnight")}</span>
      </div>
      <div class="pc-row">
        <div class="pc-preview">${flashSvg}</div>
        <div class="pc-body">
          <b>${flashDef.name}</b>
          <span>${flashDef.perk}</span>
          <div class="pc-price">
            <s>● ${flashDef.price}</s>
            <b>● ${flash.price}</b>
          </div>
        </div>
        <div class="pc-action">
          ${flashOwned
            ? `<span class="tag on">Owned ✓</span>`
            : s.wallet >= flash.price
              ? `<button class="primary-btn gold" data-ui data-action="buy-skin" data-id="${flashDef.id}">Unlock · ● ${flash.price}</button>`
              : `<span class="tag need">Need ● ${flash.price - s.wallet}</span>`
          }
          <button class="mini-btn" data-ui data-action="preview-skin" data-id="${flashDef.id}">Preview</button>
        </div>
      </div>
    </div>

    <div class="shop-hero">
      ${menuHorizon()}
      <div class="shop-hero-bird">${heroSvg}</div>
      <div class="shop-hero-info">
        <small class="shop-preview-label">${equippedSkin?.equipped ? "YOUR EQUIPPED BIRD" : "BIRD PREVIEW · NOT EQUIPPED"}</small>
        <div class="shop-hero-name" tabindex="-1">${equippedSkin ? equippedSkin.def.name : "Sunbird"}</div>
        <div class="shop-hero-perk">${equippedSkin ? equippedSkin.def.perk : "The original. Fast, honest, unstoppable."}</div>
        ${equippedSkin ? `<div class="shop-preview-action">${skinAction(equippedSkin, s.portalName !== "none", s.wallet)}</div>` : ""}
      </div>
    </div>
    <p class="shop-rules">Bird perks are for solo play. Live races use equal flight equipment; your appearance stays yours.</p>

    <div class="pc pc--blue">
      <div class="pc-header">
        <span class="pc-badge">📦 ACE PILOT CRATE · SAVE 73%</span>
        <span class="pc-label">${t("hud.renderShop.VPack", undefined, "Value Pack")}</span>
      </div>
      <div class="pc-row" style="margin-bottom:10px;">
        <span class="pc-icon">✈️</span>
        <div class="pc-body">
          <b>${t("hud.renderShop.AWingmanBundle", undefined, "Ace Wingman Bundle")}</b>
          <span>3 Boosts · Tideglass Trail · +${DAILY_STIPEND} Coins</span>
        </div>
      </div>
      ${s.wingmanBundle
        ? `<span class="pc-claimed" style="justify-content:center;">✓ Unlocked</span>`
        : s.wallet >= 240
          ? `<button class="primary-btn gold wide" data-ui data-action="buy-bundle" data-id="wingman">Claim · ● 240</button>`
          : `<button class="primary-btn gold wide" data-ui data-action="buy-bundle" data-id="wingman" disabled>Need ● ${240 - s.wallet} more</button>`
      }
    </div>

    <div class="pc pc--vault pc-row">
      <span class="pc-icon">🥚</span>
      <div class="pc-body">
        <b>${t("hud.renderShop.GMysteryVault", undefined, "Golden Mystery Vault")}</b>
        <span>35% Bird Skin · 35% Radiant Trail · 30% Coin Jackpot</span>
      </div>
      ${s.wallet >= 150
        ? `<button class="primary-btn gold" data-ui data-action="buy-vault">Open · ● 150</button>`
        : `<span class="tag need">Need ● ${150 - s.wallet}</span>`
      }
    </div>

    <div class="section-title shop-catalog-divider">${t("hud.renderShop.BCatalog", undefined, "Browse catalog ")}<small>${t("hud.renderShop.BBoostsTrails", undefined, "Birds · Boosts · Trails")}</small></div>
    <nav class="shop-jumps" aria-label="${t("hud.renderPaywall.SSections", undefined, "Shop sections")}">${[["shopBirds", "bird", "Birds"], ["shopBoosts", "boost", "Boosts"], ["shopTrails", "trail", "Trails"]].map(([id, icon, label]) => `<button class="soft-btn" data-ui data-action="shop-section" data-id="${id}">${menuIcon(icon as "bird" | "boost" | "trail")}<span>${label}</span></button>`).join("")}</nav>

    <section class="shop-browser" data-ref="shopBirds" aria-label="Browse birds">
      <div class="section-title shop-section-birds">${t("hud.renderShop.BCollection", undefined, "Bird collection ")}<small>${owned}/${s.skins.length} owned</small></div>
      <label class="field-label" for="shop-search">${t("hud.renderShop.FBird", undefined, "Find a bird")}</label>
      <input id="shop-search" type="search" data-ui data-ref="shopSearch" value="${escapeHtml(browse.query)}" placeholder="Name, collection or perk" maxlength="80" autocomplete="off" />
      <div class="shop-filters" role="group" aria-label="${t("hud.vipBlock.FBirds", undefined, "Filter birds")}">${filters.map(([id, label]) => `<button class="mini-btn ${browse.filter === id ? "gold" : ""}" data-ui data-action="shop-filter" data-id="${id}" aria-pressed="${browse.filter === id}">${label}</button>`).join("")}</div>
      <p class="shop-match-count" role="status">${matches} ${matches === 1 ? "bird" : "birds"} shown${browse.filter === "affordable" ? " · unowned, purchasable with your coins" : ""}</p>
      ${renderSkinCollections(s, browse)}
    </section>

    <details class="shop-section" data-ref="shopBoosts"><summary><span class="section-art">${menuIcon("boost")}</span>Boosts &amp; upgrades <span>${armedBoosts.length} armed</span></summary>
      <p class="fineprint">One-flight boosts are used in solo or casual AI flights. Live races and ranked practice use equal flight equipment and keep these boosts for later. Permanent upgrades stay with you.</p>
      <div class="boost-list">${s.boosts.map((b) => renderBoostRow(b, s.wallet)).join("")}</div>
      ${sectionTitle("Nest", "permanent score multiplier")}
      <div class="boost-list"><div class="boost-row nest-row">
        <span class="bi">${menuIcon("story")}</span>
        <div><div class="mt">${t("hud.renderShop.NUpgrade", undefined, "Nest upgrade ")}<span class="boost-once">forever</span></div>
        <div class="md">Lv.${s.nestLevel} · ×${s.nestMult.toFixed(2)} score${s.nestMaxed ? " · fully upgraded" : ` · next ×${(s.nestMult + 0.12).toFixed(2)}`}</div></div>
        ${
          s.nestMaxed
            ? `<span class="tag on">MAX ✓</span>`
            : s.wallet >= s.nestPrice
              ? `<button class="mini-btn gold" data-ui data-action="buy-nest">● ${s.nestPrice}</button>`
              : `<span class="tag need">Need ${s.nestPrice - s.wallet}●</span>`
        }
      </div></div>
    </details>

    <details class="shop-section" data-ref="shopTrails"><summary><span class="section-art">${menuIcon("trail")}</span>Trails <span>${t("hud.renderShop.CYoursForever", undefined, "Cosmetic · yours forever")}</span></summary>
      <div class="trail-list">${s.shopTrails.map((t) => renderTrailCard(t, s.wallet)).join("")}</div>
    </details>

    ${s.portalName === "none" && !(s.gold && s.vip) ? upsellStrip() : ""}
    <p class="fineprint">${t("hud.renderShop.ECoinsByFlyingDailyQuestsStreaksNestPass", undefined, "Earn coins by flying, daily quests, streaks and the Nest Pass.")}</p>
  `;
}

function renderPaywall(s: HudSnapshot): string {
  const starter = !s.starterOwned
    ? `
    <div class="starter-card">
      <div class="starter-flag">${t("hud.renderPaywall.OTIMEOFFER", undefined, "ONE-TIME OFFER")}</div>
      <h3>🎁 First Flight Pack · ${STARTER_PACK.price}</h3>
      <ul class="feature-list tight">${s.starterFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
      ${
        s.wallet >= STARTER_PACK.coinPrice
          ? `<button class="primary-btn starter" data-ui data-action="starter-buy">Claim Pack · ${STARTER_PACK.price}</button>`
          : `<button class="primary-btn starter off" data-ui data-action="starter-buy">Need ● ${STARTER_PACK.coinPrice - s.wallet} more coins</button>`
      }
    </div>`
    : "";
  return `
    ${head(SCREEN.coinStore)}
    <div class="wallet-row" style="margin-bottom:12px"><span class="pill coin">Your Balance: ● ${formatNumberLocalized(s.wallet)}</span></div>
    ${starter}
    <div class="gold-hero"><div class="gold-badge">✦</div><div class="gold-price">${GOLD.price}<small> lifetime</small></div></div>
    <ul class="feature-list">${s.goldFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
    ${
      s.gold
        ? `<div class="owned-banner">You own Sunbird Gold ✦</div>`
        : s.wallet >= GOLD.coinPrice
          ? `<button class="primary-btn gold" data-ui data-action="gold-buy">Unlock Gold · ${GOLD.price}</button>`
          : `<button class="primary-btn gold off" data-ui data-action="gold-buy">Need ● ${GOLD.coinPrice - s.wallet} more coins</button>`
    }
    ${SELL_AD_REMOVAL ? `${vipBlock(s)}` : `<p class="fineprint">♛ VIP is not sold on this build.</p>`}
    <div class="redeem"><input data-ui aria-label="${t("hud.renderSettings.PCode", undefined, "Promo code")}" placeholder="Promo code" maxlength="16" autocomplete="off" /><button class="mini-btn" data-ui data-action="redeem">Redeem</button></div>
    <button class="ghost-btn" data-ui data-action="restore">${t("hud.renderPaywall.RPasses", undefined, "Restore passes")}</button>
    ${s.restoreMessage ? `<p class="note">${s.restoreMessage}</p>` : ""}
    <p class="fineprint">All passes &amp; packs are earnable 100% through in-game flight coins!</p>
  `;
}

/**
 * The VIP upsell. Never rendered on a build that cannot sell it — it used to
 * render a fully-styled primary button and a six-bullet feature list, then
 * toast "not available on this build" when tapped, which is worse than saying
 * nothing at all.
 */
function vipBlock(s: HudSnapshot): string {
  return `<div class="gold-hero vip"><div class="gold-badge vip">♛</div><div class="gold-price">${VIP.price}<small> 30 days</small></div></div>
    <ul class="feature-list">${s.vipFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
    ${
      s.vip
        ? `<div class="owned-banner vip">VIP active — ${s.vipDaysLeft} day${s.vipDaysLeft === 1 ? "" : "s"} left</div>
           ${s.wallet >= VIP.coinPrice
             ? `<button class="soft-btn wide vip" data-ui data-action="vip-buy">Extend 30 Days · ${VIP.price}</button>`
             : `<p class="fineprint">Need ● ${VIP.coinPrice - s.wallet} more coins to extend.</p>`}`
        : s.wallet >= VIP.coinPrice
          ? `<button class="primary-btn vip" data-ui data-action="vip-buy">Unlock VIP · ${VIP.price}</button>`
          : `<button class="primary-btn vip off" data-ui data-action="vip-buy">Need ● ${VIP.coinPrice - s.wallet} more coins</button>`
    }`;
}

function renderCheckout(s: HudSnapshot): string {
  if (s.checkoutOk) {
    const okLabel = s.checkoutSku === "sunbird_vip" ? "VIP" : s.checkoutSku === "sunbird_starter" ? "ready for takeoff" : "Gold";
    return `<div class="check-ok"><div class="gold-badge big">${s.checkoutSku === "sunbird_vip" ? "♛" : s.checkoutSku === "sunbird_starter" ? "🎁" : "✦"}</div><h2>You're ${okLabel}!</h2><p class="tagline">${t("hud.renderCheckout.PAreActiveImmediately", undefined, "Your perks are active immediately")}</p><button class="primary-btn gold" data-ui data-action="back">Fly on</button></div>`;
  }
  const item =
    s.checkoutSku === "sunbird_vip"
      ? { name: "Sunbird VIP", price: VIP.price, coinPrice: VIP.coinPrice, action: "vip-buy" }
      : s.checkoutSku === "sunbird_starter"
        ? { name: "First Flight Pack", price: STARTER_PACK.price, coinPrice: STARTER_PACK.coinPrice, action: "starter-buy" }
        : { name: "Sunbird Gold Pass", price: GOLD.price, coinPrice: GOLD.coinPrice, action: "gold-buy" };

  const canAfford = s.wallet >= item.coinPrice;
  return `
    ${head(SCREEN.confirmUnlock, "checkout-cancel")}
    <div class="sheet">
      <div class="sheet-row"><span>${item.name}</span><b>${item.price}</b></div>
      <p class="tagline">Wallet: ● ${formatNumberLocalized(s.wallet)}</p>
      ${
        canAfford
          ? `<button class="primary-btn gold" data-ui data-action="${item.action}">Confirm Unlock · ${item.price}</button>`
          : `<p class="error">Need ● ${item.coinPrice - s.wallet} more coins to unlock.</p>
             <button class="primary-btn" data-ui data-action="pvp-practice">Fly &amp; Earn Coins</button>`
      }
    </div>
  `;
}

function volumeControl(label: string, key: string, value: number): string {
  return `<div class="setting-row setting-volume"><label for="${key}">${label}</label><div class="volume-control"><input id="${key}" data-ui data-action="set-${key}" type="range" min="0" max="100" step="5" value="${Math.min(100, Math.max(0, value))}"/><output for="${key}">${Math.min(100, Math.max(0, value))}%</output></div></div>`;
}

function renderSettings(s: HudSnapshot): string {
  const toggle = (label: string, key: string, on: boolean): string =>
    `<div class="setting-row"><span>${label}</span><button class="toggle ${on ? "on" : ""}" data-ui data-action="set-${key}" aria-pressed="${on}" aria-label="${label}"><i></i></button></div>`;
  const mPct = Math.round((s.settings.musicVolume ?? 0.8) * 100);
  const sPct = Math.round((s.settings.sfxVolume ?? 0.9) * 100);
  return `
    ${head(t("hud.settings.title", undefined, "Settings"))}
    <p class="settings-intro">${t("hud.renderSettings.MFlightFeelRightChangesSaveAutomatically", undefined, "Make the flight feel right for you. Changes save automatically.")}</p>
    ${sectionTitle(t("hud.settings.section.pilot", undefined, "Pilot"))}
    ${CUSTOM_PILOT_NAMES
      ? `<div class="redeem pilot-name-row">
      <input data-ui data-ref="pilotName" aria-label="${t("hud.pilot.name", undefined, "Pilot Name")}" maxlength="14" placeholder="${t("hud.pilot.name", undefined, "Pilot Name")}" value="${escapeHtml(s.pilotName)}" />
      <button class="mini-btn autogen-btn" data-ui data-action="autogen-pilot" title="${t("hud.pilot.autogenerate", undefined, "Autogenerate 🎲")}">${t("common.random", undefined, "🎲 Random")}</button>
      <button class="mini-btn primary" data-ui data-action="rename-pilot">${t("common.save", undefined, "Save")}</button>
    </div>`
      : `<div class="redeem pilot-name-row">
      <span class="pilot-name-readonly" aria-label="${t("hud.pilot.name", undefined, "Pilot Name")}">${escapeHtml(s.pilotName)}</span>
      <button class="mini-btn autogen-btn" data-ui data-action="autogen-pilot" title="${t("hud.pilot.autogenerate", undefined, "Autogenerate 🎲")}">${t("common.random", undefined, "🎲 Random")}</button>
    </div>`
    }
    ${sectionTitle(t("hud.settings.section.sound", undefined, "Sound"))}
    ${toggle(t("hud.settings.mute", undefined, "Mute all sound"), "mute", s.settings.mute)}
    ${volumeControl(t("hud.settings.effectsVolume", undefined, "Effects volume"), "sfx-vol", sPct)}
    ${toggle(t("hud.settings.musicToggle", undefined, "Music"), "music", s.settings.music)}
    ${volumeControl(t("hud.settings.music", undefined, "Music Volume"), "music-vol", mPct)}
    <div class="setting-row setting-select"><label for="music-track">${t("hud.renderSettings.MTrack", undefined, "Music track")}</label><select id="music-track" data-ui data-action="set-track"><option value="shuffle" ${s.settings.musicTrack === "shuffle" ? "selected" : ""}>${t("hud.renderSettings.SAllTracks", undefined, "Shuffle all tracks")}</option>${TRACK_NAMES.map((name, i) => `<option value="${i}" ${s.settings.musicTrack === i ? "selected" : ""}>${i + 1}. ${name}</option>`).join("")}</select></div>
    <div class="setting-row setting-select"><label for="language-select">${t("hud.settings.language", undefined, "Language")} / Idioma</label><select id="language-select" data-ui data-action="set-language">${SUPPORTED_LOCALES.map(loc => `<option value="${loc.code}" ${getLocale() === loc.code ? "selected" : ""}>${loc.flag} ${loc.name}</option>`).join("")}</select></div>
    <div class="setting-row"><span>${t("hud.settings.distancesIn", undefined, "Show distances in")}</span><div class="toggle-group"><button class="mini-btn ${s.settings.distUnit !== "mi" ? "gold" : ""}" data-ui data-action="set-dist-unit" data-id="km">km</button><button class="mini-btn ${s.settings.distUnit === "mi" ? "gold" : ""}" data-ui data-action="set-dist-unit" data-id="mi">mi</button></div></div>
    ${sectionTitle(t("hud.settings.section.comfort", undefined, "Comfort &amp; controls"))}
    ${toggle(t("hud.settings.haptics", undefined, "Haptics"), "haptics", s.settings.haptics)}
    ${s.boosts.some((b) => b.def.id === "doubletap" && b.armed) ? toggle("Double-tap boost", "doubletap", s.settings.doubleTapBoost) : ""}
    ${toggle(t("hud.settings.reduceMotion", undefined, "Reduce Motion"), "motion", s.settings.reduceMotion)}
    ${toggle(t("hud.settings.colorAssist", undefined, "Colorblind assist"), "colorassist", s.settings.colorAssist)}
    ${toggle(t("hud.settings.largeText", undefined, "Large text"), "bigtext", s.settings.bigText)}
    ${toggle(t("hud.settings.tapToggleDive", undefined, "Tap to dive (no holding)"), "tap-toggle-dive", s.settings.tapToggleDive)}
    <p class="fineprint">${t("hud.settings.tapToggleDiveHint", undefined, "One tap starts the dive, the next tap ends it — nothing to hold down.")}</p>
    <div class="setting-row setting-select"><label for="render-quality">${t("hud.settings.renderQuality", undefined, "Render quality")}</label><select id="render-quality" data-ui data-action="set-quality">${["auto", "high", "low"].map(q => `<option value="${q}" ${s.settings.quality === q ? "selected" : ""}>${q === "auto" ? t("hud.settings.quality.auto", undefined, "Auto · recommended") : q === "high" ? t("hud.settings.quality.high", undefined, "High · more detail") : t("hud.settings.quality.low", undefined, "Low · less GPU work")}</option>`).join("")}</select></div>
    <div class="setting-row"><span>${t("hud.settings.flightsFlown", undefined, "Flights flown")}</span><b>${s.runsPlayed}</b></div>
    <button class="soft-btn wide" data-ui data-action="toggle-fullscreen">⛶ ${t("hud.settings.fullscreen", undefined, "Fullscreen mode")}</button>
    <!-- Privacy policy, linked from inside the game. The platform guide asks
         for exactly this before it approves an external service (multiplayer,
         storage) for a game: a live policy page the player can reach from the
         build. The URL comes from ./legal.ts so each deploy points at its own
         hosted copy. Kept free of any portal name so this template renders
         identically in every edition. -->
    <button class="soft-btn wide" data-ui data-action="open-privacy">🔒 ${t("hud.settings.privacy", undefined, "Privacy Policy")}</button>
    ${s.canInstall ? `<button class="soft-btn wide" data-ui data-action="install-app">⬇ Install Sunbird</button>` : ""}
    <details class="danger-zone"><summary>${t("hud.renderSettings.MSavedProgress", undefined, "Manage saved progress")}</summary><p class="fineprint">Reset deletes progress saved on this device. Export a save code from Account first.</p>
    <button class="ghost-btn danger" data-ui data-action="reset-progress">${s.resetArmed ? "Confirm: erase saved progress" : "Reset progress"}</button></details>
    <p class="fineprint">Sunbird 1.0 · ${s.seedLabel}</p>
  `;
}

function renderScores(s: HudSnapshot): string {
  return `
    ${head(SCREEN.savedScores)}
    ${renderScoreTable(s.highScores)}
    ${!s.highScores.length ? `<p class="tagline">${t("hud.renderScores.FFlightStartsStoryFlyLittleFartherEachTime", undefined, "Your first flight starts your story. Fly a little farther each time.")}</p><button class="primary-btn" data-ui data-action="pvp-practice">${t("hud.renderScores.TFirstFlight", undefined, "Take your first flight")}</button>` : ""}
    <div class="menu-stats"><div>${t("hud.renderScores.TSBest", undefined, "Today's best ")}<b>${distanceText(s.todayBest)}</b></div><div>Flights <b>${s.runsPlayed}</b></div></div>
  `;
}

function rewardLabel(r: { kind: string; amount?: number; id?: string }): string {
  if (r.kind === "coins") return `● ${r.amount}`;
  // Map through the catalogues. This printed the raw id — "🐦 paradise",
  // "✨ star" — on a fifty-tier track, which is the game's own plumbing shown
  // to the player as if it were a name.
  if (r.kind === "skin") return `🐦 ${skinById(r.id ?? "").name}`;
  if (r.kind === "trail") return `✨ ${TRAILS[r.id ?? ""]?.label ?? "Trail"}`;
  return `🎁 ${r.id ?? "Reward"}`;
}

function renderPass(s: HudSnapshot): string {
  const pct = Math.min(100, (s.season.have / s.season.need) * 100);
  return `
    ${head(SCREEN.nestPass, "back", `<span class="pill">Lv.${s.season.tier}/${s.season.maxTier}</span>`)}
    <div class="pass-progress"><i style="width:${pct}%"></i></div>
    <p class="tagline">${s.season.label} — fly to earn XP.${SELL_AD_REMOVAL ? " Gold unlocks the premium track." : " Fly to unlock rewards."}</p>
    ${!s.gold && SELL_AD_REMOVAL ? `<button class="upsell" data-ui data-action="open-paywall"><div><b>✦ Unlock premium rewards</b><span>${t("hud.renderPass.DTierRewardsGold", undefined, "Double the tier rewards with Gold")}</span></div><span class="mini-btn gold">Unlock</span></button>` : ""}
    ${!SELL_AD_REMOVAL ? `<p class="fineprint pass-portal-note">✦ Portal edition — the free Nest Pass track is fully earnable. Gold is a one-time purchase with flight coins.</p>` : ""}
    <div class="tier-track">
      ${s.season.tiers
        .map((t) => {
          const canFree = t.unlocked && !t.freeClaimed;
          const canPremium = t.unlocked && !t.premiumLocked && !t.premiumClaimed;
          const premiumTitle = t.premiumLocked && !SELL_AD_REMOVAL ? "Portal edition — premium rewards shown for reference" : undefined;
          return `<div class="tier-card ${t.unlocked ? "unlocked" : ""}">
            <div class="tier-num">Lv.${t.tier}</div>
            <button class="tier-reward free ${t.freeClaimed ? "claimed" : ""}" data-ui data-action="${canFree ? "claim-pass-free" : ""}" data-id="${t.tier}" ${canFree ? "" : "disabled"}>${rewardLabel(t.free)}</button>
            <button class="tier-reward premium ${t.premiumClaimed ? "claimed" : ""} ${t.premiumLocked ? "locked" : ""}" data-ui data-action="${canPremium ? "claim-pass-premium" : ""}" data-id="${t.tier}" ${premiumTitle ? `title="${premiumTitle}"` : ""} ${canPremium ? "" : "disabled"}>${rewardLabel(t.premium)}${t.premiumLocked ? `<i class="lock-badge">✦</i>` : ""}</button>
          </div>`;
        })
        .join("")}
    </div>
    <p class="fineprint">${t("hud.renderPass.NPassResetsEveryMonthSpendRewardsBeforeDoes", undefined, "The Nest Pass resets every month — spend rewards before it does!")}</p>
  `;
}

function renderTrophies(s: HudSnapshot): string {
  const groups: Record<string, AchievementView[]> = { bronze: [], silver: [], gold: [], platinum: [] };
  for (const v of s.trophies) groups[v.def.rarity]!.push(v);
  const order: (keyof typeof groups)[] = ["bronze", "silver", "gold", "platinum"];
  return `
    ${head(SCREEN.trophyCase, "back", `<span class="pill">${s.trophyCounts.unlocked}/${s.trophyCounts.total}</span>`)}
    ${order
      .map(
        (rarity) => `
      <details class="shop-section trophy-collection" data-ref="trophies-${rarity}"><summary>${rarity}<span>${groups[rarity]!.filter(v => v.unlocked).length}/${groups[rarity]!.length} unlocked</span></summary>
      <div class="trophy-grid">
        ${groups[rarity]!
          .map((v) => {
            const pct = Math.min(100, (v.progress / v.def.target) * 100);
            return `<div class="trophy ${v.unlocked ? "unlocked" : ""} ${rarity}">
              <div class="trophy-icon">${v.unlocked ? "🏆" : "🔒"}</div>
              <div class="trophy-name">${v.def.title}</div>
              <div class="trophy-desc">${v.def.desc}</div>
              ${v.unlocked ? "" : `<div class="qb"><i style="width:${pct}%"></i></div>`}
            </div>`;
          })
          .join("")}
      </div></details>`,
      )
      .join("")}
  `;
}

function renderAccount(s: HudSnapshot): string {
  // Portal account block: on Poki the player may be signed in, and the game is
  // required to be honest about who it thinks they are (their name is what
  // goes on the board). Sign-in is offered only behind a button — Poki's docs
  // forbid prompting for an account on load.
  const portalAccount = s.portalName !== "none"
    ? `${sectionTitle(`${PORTAL_DISPLAY_NAME} account`)}
    <div class="sheet">
      ${
        s.portalAccountName
          ? `<div class="code-row"><span>${t("hud.renderAccount.SAs", undefined, "Signed in as ")}<b>${escapeHtml(s.portalAccountName)}</b></span><span class="tag on">Linked</span></div>
             <p class="fineprint">Your progress and leaderboard scores follow this ${PORTAL_DISPLAY_NAME} account across devices.</p>`
          : `<div class="code-row"><span>${t("hud.renderAccount.NSigned", undefined, "Not signed in")}</span><button class="mini-btn" data-ui data-action="portal-sign-in">${t("hud.renderAccount.S", undefined, "Sign in")}</button></div>
             <p class="fineprint">Sign in to carry your progress between devices and appear on the board under your own name.</p>`
      }
    </div>`
    : "";
  return `
    ${head(SCREEN.account)}
    ${portalAccount}
    ${sectionTitle("Membership")}
    ${!SELL_AD_REMOVAL ? "" : `
    <div class="sheet">
      <div class="code-row"><span>${s.gold ? "✦ Gold · owned for life" : "✦ Gold · not owned"}</span>${
        s.gold ? `<span class="tag on">Active</span>` : SELL_AD_REMOVAL ? `<button class="mini-btn gold" data-ui data-action="open-paywall">${t("hud.renderAccount.GGold", undefined, "Get Gold")}</button>` : `<span class="tag">${t("hud.renderAccount.PMember", undefined, "Portal member")}</span>`
      }</div>
      ${SELL_AD_REMOVAL ? `<div class="code-row"><span>♛ VIP · ${s.vip ? `${s.vipDaysLeft} day${s.vipDaysLeft === 1 ? "" : "s"} left` : "inactive"}</span>${
        s.vip
          ? `<button class="mini-btn vip" data-ui data-action="vip-buy">Extend</button>`
          : `<button class="mini-btn vip" data-ui data-action="vip-buy">Subscribe</button>`
      }</div>` : ""}
      <p class="fineprint">VIP gifts ${VIP_DAILY_GIFT} coins every day you play and adds a fourth daily quest. ${
        s.vip ? "" : "Cancel anytime — no auto-renewal in this build; your 30 days simply run out."
      }${
        /* Only the direct build schedules its own interstitials; on a portal the
           platform owns ad frequency, so the game must not describe (or count)
           breaks it does not control. */
        SIMULATED_BREAKS && s.portalName === "none" ? ` Sponsored breaks respect a hard cap: <b>${s.adsLeftToday}</b> left today.` : ""
      }</p>
    </div>
    `}

    ${sectionTitle("Invite friends")}
    <div class="sheet">
      <p class="tagline">Share your code — friends who redeem it get a welcome bonus on their device.</p>
      <div class="code-row"><span class="code">${s.referralCode}</span><button class="mini-btn" data-ui data-action="copy-referral">Copy</button></div>
      ${
        s.referralRedeemed
          ? `<p class="note">${t("hud.renderAccount.VAlreadyRedeemedFriendCodeThanksJoining", undefined, "You've already redeemed a friend code. Thanks for joining!")}</p>`
          : `<div class="redeem"><input data-ui data-ref="friendcode" aria-label="${t("hud.renderCelebration.FReferralCode", undefined, "Friend referral code")}" placeholder="Friend's code (SUN-XXXXXX)" maxlength="10" autocomplete="off" /><button class="mini-btn" data-ui data-action="redeem-referral">Apply</button></div>`
      }
      ${s.referralMessage ? `<p class="note">${s.referralMessage}</p>` : ""}
    </div>
    ${sectionTitle("Transfer saved progress")}
    <div class="sheet">
      <p class="tagline">${t("hud.renderAccount.CCodeMoveProgressAnotherDevice", undefined, "Copy this code to move your progress to another device.")}</p>
      <textarea class="cloud-box" data-ui aria-label="${t("hud.renderCelebration.ESaveCode", undefined, "Your exportable save code")}" readonly rows="3">${s.cloudCode}</textarea>
      <button class="mini-btn" data-ui data-action="copy-cloud">${t("hud.renderAccount.CCode", undefined, "Copy code")}</button>
      <p class="tagline" style="margin-top:10px">${t("hud.renderAccount.PCodeFromAnotherDeviceRestoreHere", undefined, "Paste a code from another device to restore it here:")}</p>
      <textarea class="cloud-box" data-ui aria-label="${t("hud.renderCelebration.SCodeImport", undefined, "Save code to import")}" rows="3" placeholder="Paste save code…"></textarea>
      <label class="import-confirm"><input type="checkbox" data-ui/>${t("hud.renderAccount.RProgressDeviceSave", undefined, "Replace progress on this device with this save.")}</label>
      <button class="mini-btn" data-ui data-action="import-cloud">${t("hud.renderAccount.ISave", undefined, "Import save")}</button>
      ${s.cloudMessage ? `<p class="note" role="status">${s.cloudMessage}</p>` : ""}
    </div>
    <p class="fineprint">${t("hud.renderAccount.CSaveCodeTransferProgressBetweenDevices", undefined, "Copy your save code to transfer progress between devices.")}</p>
  `;
}

function renderGoalList(goals: SessionGoal[]): string {
  if (!goals.length) return "";
  return `<div class="quests"><div class="mission-head">${t("hud.renderGoalList.SGoals", undefined, "Session goals")}</div>${goals
    .map((g) => {
      const pct = Math.min(100, (g.progress / g.target) * 100);
      return `<div class="quest ${g.done ? "done" : ""}">
        <div><div class="mt">${g.label}</div><div class="qb"><i style="width:${pct}%"></i></div></div>
        <span class="qr">● ${g.reward}</span>
      </div>`;
    })
    .join("")}</div>`;
}

/** The run's silhouette: an SVG sparkline of the altitude profile. */
export function renderFlightRecap(path: [number, number][]): string {
  if (path.length < 3) return "";
  const w = 320;
  const hgt = 64;
  let maxX = 1;
  let maxY = 12;
  for (const [x, y] of path) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const px = (x: number): number => (x / maxX) * (w - 4) + 2;
  const py = (y: number): number => hgt - 4 - (Math.max(0, y) / maxY) * (hgt - 10);
  const line = path.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ");
  const area = `${line} L${px(path[path.length - 1]![0]).toFixed(1)} ${hgt - 2} L${px(path[0]![0]).toFixed(1)} ${hgt - 2} Z`;
  // Peak marker — the flight's zenith deserves a dot.
  let peak = path[0]!;
  for (const p of path) if (p[1] > peak[1]) peak = p;
  return `
    <div class="flight-recap" aria-label="${t("hud.renderGameOver.FAltitudeProfile", undefined, "Flight altitude profile")}">
      <svg viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none">
        <defs><linearGradient id="fr-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffb020" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#ffb020" stop-opacity="0.05"/>
        </linearGradient></defs>
        <path d="${area}" fill="url(#fr-g)"/>
        <path d="${line}" fill="none" stroke="#e08a10" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${px(peak[0]).toFixed(1)}" cy="${py(peak[1]).toFixed(1)}" r="3" fill="#ff6b4a"/>
      </svg>
      <span class="fr-peak">▲ ${Math.round(peak[1])} m peak</span>
    </div>`;
}

/**
 * End-of-run 3× coin bonus card. Pure and exported so the claim contract is
 * unit-testable: the bonus claims ONCE per run (Game.multiplierClaimed).
 * On portal builds the button triggers a rewarded ad (🎬 icon); on direct
 * builds it is a free bonus (MON-09: clapperboard only on rewarded placements).
 */
export function renderCoinMultiplierCard(coins: number, claimed: boolean, rewarded = false): string {
  if (coins <= 0) return "";
  if (claimed) {
    return `<div class="multiplier-cta-card claimed">✓ 3× bonus applied &nbsp;+● ${formatNumberLocalized(coins * 2)} extra coins</div>`;
  }
  if (rewarded) {
    // Portal editions route the bonus through the platform's rewarded ad: the
    // reward is stated BEFORE the tap (Poki's rewarded-copy rule), the icon
    // marks it as an ad, and a declined ad never steals the card away.
    return `<div class="multiplier-cta-card">
      <div class="multiplier-cta-text">
        <b>3× Flight Coin Bonus</b>
        <span>Watch a short ad · triple ● ${coins} → ● ${coins * 3}</span>
      </div>
      <button class="primary-btn gold wide" data-ui data-action="multiply-run-coins">🎬 Watch → 3× &nbsp;+● ${formatNumberLocalized(coins * 2)}</button>
    </div>`;
  }
  return `<div class="multiplier-cta-card">
      <div class="multiplier-cta-text">
        <b>3× Flight Coin Bonus</b>
        <span>Triple ● ${coins} → ● ${coins * 3}</span>
      </div>
      <button class="primary-btn gold wide" data-ui data-action="multiply-run-coins">Claim 3× &nbsp;+● ${formatNumberLocalized(coins * 2)}</button>
    </div>`;
}

/**
 * The two lines that turn a result into progress: the ranked beats, then the
 * growth ledger underneath.
 *
 * The ledger is derived here, from the two ladders the snapshot *already*
 * carries (`wings` and this flight's `mastery` row), because that is what
 * `GrowthLedger.ts` was written against: "This module decides what the card
 * says; `HUD.ts` only renders it." It is deliberately not a separate snapshot
 * field — that would be a second copy of state the snapshot already has, which
 * is the failure mode this whole card was built to avoid.
 *
 * The ledger is a `<dl>` because it is a set of terms (a ladder and its
 * remaining distance) and not a list of beats: assistive tech gets one
 * announcement per line, and the decorative bar is `aria-hidden` because the
 * text beside it already says the same thing.
 */
function renderCelebration(s: HudSnapshot): string {
  const cel = s.celebration;
  const lines = growthLedger(s.wings, s.mastery.find((m) => m.modeId === s.modeId) ?? null);
  const ledger = lines
    .map(
      (l) => `<div class="gl-row gl-${escapeHtml(l.kind)}">
        <dt><i aria-hidden="true">${escapeHtml(l.icon)}</i>${escapeHtml(l.label)}</dt>
        <dd><span>${escapeHtml(l.detail)}</span><i class="gl-bar" aria-hidden="true"><b style="width:${(l.progress * 100).toFixed(1)}%"></b></i></dd>
      </div>`,
    )
    .join("");
  const growth = `<div class="growth-ledger"><span class="gl-title">${escapeHtml(t("hud.progress.strip", undefined, "What this flight grew"))}</span>${
    ledger ? `<dl>${ledger}</dl>` : ""
  }</div>`;
  if (!cel || (!cel.staged.length && !cel.ledger.length && !cel.folded)) return growth;
  const beatEl = (b: CelebrationView["staged"][0], withDelay = true): string => {
    const cls = ["beat", b.rarity, b.banner ? "banner" : ""].filter(Boolean).join(" ");
    const delay = withDelay ? ` style="animation-delay:${b.delayMs}ms"` : "";
    const text = t(b.key, b.params, b.fallback);
    return `<div class="${cls}" role="listitem"${delay}><i aria-hidden="true">${escapeHtml(b.icon)}</i>${escapeHtml(text)}</div>`;
  };
  const stageBits = cel.staged.map((b) => beatEl(b)).join("");
  const ledgerBits = cel.ledger.map((b) => beatEl(b, false)).join("");
  const moreBit = cel.folded > 0 ? `<div class="beat more" role="listitem">${escapeHtml(t("hud.progress.more", { n: cel.folded }, `+${cel.folded} more from this flight`))}</div>` : "";
  const beatRow = ledgerBits || moreBit ? `<div class="beat-row">${ledgerBits}${moreBit}</div>` : "";
  return `<div class="celebration" role="list" aria-label="${escapeHtml(t("hud.progress.strip", undefined, "What this flight grew"))}">${stageBits}${beatRow}</div>${growth}`;
}

/**
 * The in-flight quest strip — `missionRows`, drawn next to the goal strip.
 *
 * Emitted unconditionally (and hidden when empty) for the same reason
 * `.growth-ledger` is: the element is part of the HUD's structure, so a test
 * and a screen reader can both find it whether or not this particular run has a
 * quest in it. It is a `<ul>` of rows, each with its progress as text, because a
 * bar alone tells a screen reader nothing.
 */
function renderMissionStrip(rows: MissionRow[]): string {
  if (!rows.length) return "";
  return `<ul class="mission-strip-list">${rows
    .map(
      (r) => `<li class="ms-row${r.done ? " done" : ""}${r.justDone ? " just" : ""}">
        <span class="ms-title">${r.done ? "✓ " : ""}${escapeHtml(r.title)}</span>
        <span class="ms-num">${Math.round(r.progress)}/${Math.round(r.target)}</span>
        <i class="ms-bar" aria-hidden="true"><b style="width:${(r.pct * 100).toFixed(1)}%"></b></i>
      </li>`,
    )
    .join("")}</ul>`;
}

function renderGameOver(s: HudSnapshot): string {
  if (s.versus && s.p1Stats && s.p2Stats) return renderVersusResult(s);
  const questTotal = s.claimedQuests.reduce((a, q) => a + q.reward, 0);
  const deltaTxt =
    s.raceRated && s.ratingDelta !== 0
      ? `<span class="rate-delta ${s.ratingDelta > 0 ? "up" : "down"}">${s.ratingDelta > 0 ? "+" : ""}${s.ratingDelta}</span>`
      : "";
  const duelStrip =
    s.duelWas !== ""
      ? `<div class="race-hero ${s.duelWas === "won" ? "win" : ""}">
           <div class="race-medal">${s.duelWas === "won" ? "⚔🥇" : "⚔"}</div>
           <div class="race-place"><b>DUEL ${s.duelWas === "won" ? "WON" : "LOST"}</b><span>${s.duelWas === "won" ? "+" : ""}${s.duelDelta} rating → ${s.rival.rating}</span></div>
           <div class="race-rating">Duel record ${s.duel.wins}–${s.duel.losses} · 🔥${s.duel.streak} streak<span class="race-rated-tag">ranked · local</span></div>
         </div>`
      : "";
  const raceStrip =
    s.duelWas === "" && s.massRace
      ? s.racePlace > 0
        ? `<div class="race-hero ${s.racePlace === 1 ? "win" : s.racePlace <= 3 ? "podium" : ""}">
           <div class="race-medal">${s.racePlace === 1 ? "🥇" : s.racePlace === 2 ? "🥈" : s.racePlace === 3 ? "🥉" : "🏁"}</div>
           <div class="race-place"><b>P${s.racePlace}</b><span>of ${s.raceField} pilots · ${s.raceFinishTime.toFixed(1)}s</span></div>
           ${s.raceVerified ? `<div class="verified-tag">✓ placement refereed by the room server</div>` : ""}
           <div class="race-bar"><i style="width:${Math.round((1 - (s.racePlace - 1) / Math.max(1, s.raceField)) * 100)}%"></i></div>
           ${
             s.raceRated
               ? `<div class="race-rating">Rival rating ${s.rival.rating} ${deltaTxt}<span class="race-rated-tag">ranked · local</span></div>`
               : `<div class="race-rating"><span class="race-rated-tag">casual · rating frozen</span></div>`
           }
           ${
             s.rival.streak >= 2
               ? `<div class="race-streak">🔥 ${s.rival.streak}-race win streak${s.ratingBonus > 0 ? ` · +${s.ratingBonus}● streak bonus` : ""}</div>`
               : ""
           }
         </div>
         ${s.photoFinish ? `<div class="reward-strip photo">📸 ${escapeHtml(s.photoFinish)}</div>` : ""}
`
        : `<div class="race-hero dnf">
           <div class="race-medal">💥</div>
           <div class="race-place"><b>${s.modeId === "pvp_knockout" ? "KNOCKED OUT" : "RACE INCOMPLETE"}</b><span>${s.modeId === "pvp_knockout" ? "Eliminated by the countdown timer" : `DNF · Reached ${Math.round(s.distance)}m of ${s.raceFinishM}m`}</span></div>
           ${
             s.raceRated
               ? `<div class="race-rating">Rival rating ${s.rival.rating} ${deltaTxt}<span class="race-rated-tag">ranked · local</span></div>`
               : `<div class="race-rating"><span class="race-rated-tag">casual · rating frozen</span></div>`
           }
         </div>`
      : "";
  // Clipboard score fallback — always visible when AUDS isn't available so
  // players always have *some* share action on the results screen.
  const clipboardShare = !s.share.available && !s.share.loaded && !s.share.code
    ? `<button class="soft-btn wide" data-ui data-action="copy-score">📋 Copy score to clipboard</button>`
    : "";

  // Async multiplayer by code. Only rendered when this build can actually
  // talk to AUDS (Poki + game id) or when the player has already loaded a run.
  const shareBlock =
    s.share.available || s.share.loaded || s.share.code
      ? `
    <div class="share-run">
      ${sectionTitle("🔗 Shared run", "friend's code · async race")}
      ${
        s.share.code
          ? `<div class="friend-row"><span class="fr-name">${t("hud.renderGameOver.RCode", undefined, "Run code")}</span><span class="fr-code">${escapeHtml(s.share.code)}</span><button class="mini-btn" data-ui data-action="copy-share">${t("hud.renderGameOver.CCode", undefined, "Copy code")}</button></div>`
          : `<button class="soft-btn wide" data-ui data-action="share-run" ${s.share.busy ? "disabled" : ""}>${s.share.busy ? "Publishing…" : "Share this run for a friend"}</button>`
      }
      <div class="redeem">
        <input data-ui data-enter-action="load-run" aria-label="${t("hud.renderNextFlight.SRunCode", undefined, "Shared run code")}" placeholder="A friend's run code" maxlength="40" autocomplete="off" spellcheck="false" />
        <button class="mini-btn" data-ui data-action="load-run" ${s.share.busy ? "disabled" : ""}>Load</button>
      </div>
      ${
        s.share.loaded
          ? `<div class="pilot-note">Loaded <b>${escapeHtml(s.share.loaded.name)}</b>'s run — ${formatNumberLocalized(Math.round(s.share.loaded.distance))} m on the same hills. <button class="mini-btn gold" data-ui data-action="race-share">${t("hud.renderGameOver.RTheirMark", undefined, "Race their mark")}</button></div>`
          : ""
      }
      ${s.share.error ? `<div class="pilot-note warn" role="status">${escapeHtml(s.share.error)}</div>` : ""}
    </div>`
      : "";

  return `
    <div class="results-kicker">${escapeHtml(s.modeName)} · ${t("hud.gameover.flightRecap", undefined, "flight recap")}</div>
    <h2>${escapeHtml(END_REASON_TITLE[s.endReason] ?? "Flight completed")}</h2>
    <p class="end-reason">${escapeHtml(END_REASON_LINE[s.endReason] ?? "")}</p>
    <p class="tagline">${s.massRace ? t("hud.gameover.massraceTagline", undefined, "Your place, your progress, your next race.") : t("hud.gameover.soloTagline", undefined, "A little farther. A little smoother. One more flight?")}</p>
    <div class="result-actions"><button class="play-again-btn" data-ui data-action="${resultsPrimaryAction(s)}">${s.massRace && s.roomCode ? t("hud.gameover.backToLobby", undefined, "Back to race lobby") : s.massRace && s.racePlace > 0 ? t("hud.gameover.raceAgain", undefined, "Race again · same stakes") : t("hud.gameover.flyAgain", undefined, "Fly Again")}</button><button class="soft-btn" data-ui data-action="menu">${t("hud.gameover.mainMenu", undefined, "Main Menu")}</button></div>
    ${!s.massRace ? `<p class="fineprint replay-note">${t("hud.gameover.replayNote", undefined, "Fly again replays this exact course so you can race the ghost of the run you just flew 👻")}</p>` : ""}
    ${s.newBest ? `<div class="new-best">👑 ${t("hud.gameover.newBest", undefined, "NEW BEST")} · ${distanceText(s.distance)}<small>${t("hud.gameover.farthestFlight", undefined, "your farthest flight yet")}</small></div>` : ""}
    ${s.boardScope === "global" && s.boardMetric === "distance" && s.board && s.board.yourRank > 0 ? `<div class="reward-strip rank-strip">${t("hud.gameover.leaderboardRank", undefined, "Leaderboard rank")} · <b>#${s.board.yourRank}</b> of ${s.board.total}</div>` : ""}

    ${shareBlock}
    ${renderCelebration(s)}
    ${renderFlightRecap(s.flightPath)}
    <div class="over-stats meta-progress-strip">
      <div><span>🐦 Migration</span><b>${s.campaignDone}/${s.campaignTotal} legs</b></div>
      <div><span>🏆 Trophies</span><b>${s.trophyCounts.unlocked}/${s.trophyCounts.total}</b></div>
      <div><span>${menuIcon("pass")} Nest Pass</span><b>Lv.${s.season.tier}/${s.season.maxTier}</b></div>
    </div>
    <div class="over-stats result-summary">
      <div><span>${t("hud.stat.distance", undefined, "Distance")}</span><b>${distanceText(s.distance)}</b></div>
      <div><span>${t("hud.stat.score", undefined, "Score")}</span><b>${formatNumberLocalized(Math.floor(s.score))}</b></div>
      <div><span>${t("hud.stat.coins", undefined, "Coins")}</span><b>${formatNumberLocalized(s.coins)}</b></div>
    </div>

    <div class="btn-row result-links">
      <button class="soft-btn gold-tint" data-ui data-action="open-shop">${menuIcon("shop")} Shop</button>
      <button class="soft-btn" data-ui data-action="open-pass">${menuIcon("pass")} Pass</button>
      <button class="soft-btn" data-ui data-action="open-atlas">${menuIcon("atlas")} Atlas</button>
    </div>
    ${s.nextAction ? `<p class="next-action">${escapeHtml(s.nextAction)}</p>` : ""}

    ${renderCoinMultiplierCard(s.coins, s.multiplierClaimed, s.portalName !== "none")}

    ${renderNextFlight(s)}
    <details class="result-details"><summary>${t("hud.renderGameOver.FDetails", undefined, "Flight details ")}<span>Landmarks &amp; skill</span></summary><div class="over-stats">
      <div><span>Perfects</span><b>${s.perfects}</b></div>
      <div><span>${t("hud.renderGameOver.SMoments", undefined, "Skyline moments")}</span><b>${s.zeniths}</b></div>
      <div><span>Rings</span><b>${s.rings}</b></div>
      <div><span>Balloons</span><b>${s.balloons}</b></div>
      <div><span>Sunflowers</span><b>${s.sunflowers}</b></div>
      <div><span>${t("hud.renderGameOver.SFlow", undefined, "Slope flow")}</span><b>${s.slopeScore} pts · ×${s.slopeChain}</b></div>
      <div><span>Islands</span><b>${s.island + 1}</b></div>
    </div></details>
    ${s.ghostDelta !== null ? `<div class="reward-strip ${s.ghostDelta >= 0 ? "" : "nest"}">${s.ghostDelta >= 0 ? `Beat your ghost by ${Math.round(s.ghostDelta)}m! 👻` : `${Math.round(-s.ghostDelta)}m behind your best ghost`}</div>` : ""}
    ${questTotal ? `<div class="reward-strip">Daily quest${s.claimedQuests.length > 1 ? "s" : ""} complete · +${questTotal} coins</div>` : ""}
    ${s.newlyCompleted.length ? `<div class="reward-strip nest">Nest upgraded → Lv.${s.nestLevel} · ×${s.nestMult.toFixed(2)} score</div>` : ""}
    ${s.nearMiss ? `<div class="nearmiss">${s.nearMiss}</div>` : ""}
    ${s.challengeOutcome ? `<div class="reward-strip ${s.challengeOutcome.includes("missed") ? "nest" : ""}">${escapeHtml(s.challengeOutcome)}</div>` : ""}
    ${duelStrip}
    ${raceStrip}
    <div class="reached-strip">Reached <b>${menuIconSm(s.biomeEmoji)} ${s.biomeName}</b> · Island ${s.island + 1}</div>

    ${clipboardShare}
    ${s.expShareFirst
      ? `<button class="soft-btn wide" data-ui data-action="share" ${s.shareBusy ? "disabled" : ""}>${s.shareBusy ? "Preparing…" : `${menuIcon("share")} Share this flight`}</button>
         <button class="soft-btn wide" data-ui data-action="throw-challenge">${menuIcon("versus")} Challenge a rival on these hills</button>`
      : `<button class="soft-btn wide" data-ui data-action="throw-challenge">${menuIcon("versus")} Challenge a rival on these hills</button>
         <button class="soft-btn wide" data-ui data-action="share" ${s.shareBusy ? "disabled" : ""}>${s.shareBusy ? "Preparing…" : `${menuIcon("share")} Share this flight`}</button>`}
    <details class="result-details"><summary>Progress &amp; rewards <span>Goals, quests &amp; records</span></summary>
    ${renderGoalList(s.sessionGoals)}
    ${renderQuests(s.quests)}
    ${renderMissions(s.missions, s.newlyCompleted)}
    <h3 class="table-title">${t("hud.renderGameOver.HGlides", undefined, "High glides")}</h3>
    ${renderScoreTable(s.highScores.slice(0, 5))}</details>
  `;
}

function renderNextFlight(s: HudSnapshot): string {
  const lesson = flightTakeaway(s), bird = nextBird(s.skins);
  return `<section class="next-flight" aria-label="${t("hud.renderAd.NFlightPlan", undefined, "Next flight plan")}"><span class="next-flight-art">${menuIcon("compass")}</span><div><small>${t("hud.renderNextFlight.TINTONEXTFLIGHT", undefined, "TAKE THIS INTO YOUR NEXT FLIGHT")}</small><b>${lesson.title}</b><p>${lesson.tip}</p>${bird ? `<p class="next-unlock">${s.wallet >= bird.def.price ? `${bird.def.name} is within reach · ${bird.def.price} coins in the Shop` : `${bird.def.name} · ${bird.def.price - s.wallet} more coins to unlock`}</p>` : ""}</div></section>`;
}

function renderContinue(s: HudSnapshot): string {
  const portal = s.portalName !== "none";
  // MON-19: the reason line is context-driven (record / near-best / streak /
  // momentum). It explains why this run is worth resuming — it never changes
  // what the options are, and the standard non-ad options stay in the primary
  // position above the rewarded one (MON-05…MON-08).
  // One card language for the whole app: the second-wind offer is a *recap*
  // screen like any other, so it uses the same kicker / heading / stat strip /
  // action row as the results card instead of the old bespoke "zzz" panel.
  // MON-05…MON-08 still hold: the standard options sit above the rewarded one,
  // the rewarded button keeps its 🎬 label, and "let it sleep" is a plain
  // exit — never hidden, never the only way out.
  return `
    <div class="results-kicker">${escapeHtml(s.modeName)} · flight recap</div>
    <h2>${t("hud.renderContinue.SWind", undefined, "Second wind?")}</h2>
    <p class="tagline">Sunbird is dozing off at ${distanceText(s.distance)}.</p>
    ${s.continueReason ? `<p class="continue-reason${s.continueHighlight ? " is-highlight" : ""}">${escapeHtml(s.continueReason)}</p>` : ""}
    <div class="over-stats result-summary">
      <div><span>${t("hud.stat.distance", undefined, "Distance")}</span><b>${distanceText(s.distance)}</b></div>
      <div><span>Score</span><b>${formatNumberLocalized(Math.floor(s.score))}</b></div>
      <div><span>${t("hud.stat.coins", undefined, "Coins")}</span><b>${formatNumberLocalized(s.coins)}</b></div>
    </div>
    ${s.adAvailable
      ? `<div role="status"><button class="reward-strip wake-strip wake-ad-btn" data-ui data-action="continue-ad">🎬 ${portal ? "Watch for Second Wind" : "Watch a short clip → Second Wind"} · <b data-live="contTimer">${Math.ceil(s.continueTimer)}</b>s left</button></div>`
      : `<div class="reward-strip wake-strip" role="status">⏳ Second wind closes in <b data-live="contTimer">${Math.ceil(s.continueTimer)}</b>s</div>`}
    <div class="result-actions">
      <button class="play-again-btn ${s.canAffordContinue ? "" : "off"}" data-ui data-action="continue-coins" ${s.canAffordContinue ? "" : "disabled"}>Spend ● ${s.continueCost} <small>(you have ${s.wallet})</small></button>
      <button class="soft-btn" data-ui data-action="continue-sleep">${t("hud.renderContinue.LSleep", undefined, "Let it sleep")}</button>
    </div>
    ${!portal && s.gold ? `<button class="soft-btn wide" data-ui data-action="continue-gold">✦ Gold · free wake-up</button>` : ""}
    <p class="fineprint replay-note">Sleep ends the flight and shows your recap. Waking up keeps this run alive from where it landed.</p>
  `;
}

function renderAd(s: HudSnapshot): string {
  const portal = s.portalName !== "none";
  const canRemoveBreaks = SELL_AD_REMOVAL && !s.gold;
  const label = portal
    ? `${PORTAL_DISPLAY_NAME} · sponsored break`
    : `Sponsored break · ${s.adReason === "continue" ? "your second wind is loading…" : "back to flying in a moment"}`;
  const header = portal
    ? `Advertisement`
    : `Your ad is loading`;
  const subtext = portal
    ? `Your run is paused while the portal serves this break.`
    : `Back to flying in a moment.`;
  return `
    <div class="ad-label">${label}</div>
    <div class="portal-ad-wait"><div class="spinner"></div><h3>${header}</h3><p>${subtext}</p></div>
    <div class="ad-bar"><i data-live="adBar"></i></div>
    <div class="ad-actions">
      ${
        s.adSkippable
          ? `<button class="mini-btn" data-ui data-action="ad-skip" data-live="adSkip" disabled>Continues in ${Math.ceil(s.adTimer)}</button>`
          // Never render an empty .ad-actions. On Poki BOTH branches above are
          // false, so the panel was a frozen bar and "Your run is paused" for up
          // to 60 s with nothing to press. After the safety window the run is
          // returned to, and the button says so.
          : `<button class="mini-btn" data-ui data-action="ad-stuck">${s.adTimer > 0 ? `Taking longer than usual — return (${Math.ceil(s.adTimer)})` : "Return to flight"}</button>`
      }
      ${canRemoveBreaks ? `<button class="mini-btn gold" data-ui data-action="ad-gold">✦ Remove breaks</button>` : ""}
    </div>
  `;
}
