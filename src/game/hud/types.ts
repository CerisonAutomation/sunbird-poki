/**
 * The HUD's view-model contract.
 *
 * These types used to live at the top of `src/game/HUD.ts`, which made that
 * file a 4,478-line collision of three unrelated concerns: view-model types,
 * a DOM controller, and ~50 screen renderers. They live here now so screen
 * modules can import their input type without importing `HUD.ts` — a screen
 * module reaching back into the controller for a type is a cycle, and
 * `pnpm circular:check` fails the build on one.
 *
 * `HudSnapshot` is deliberately still the *complete* state of the HUD. It is
 * the transport between `Game` and the renderer, and splitting it per screen
 * would mean `Game` assembling 20 partial objects. The narrowing happens one
 * level down, at each renderer's own signature: a screen declares the fields
 * it reads (`Pick<HudSnapshot, "wallet" | "skins">`) and nothing else it gets
 * to touch. The bag stays wide; the contract at the call site does not.
 *
 * Every import here is `import type`, so this module erases completely at build
 * time and costs the shipped bundle nothing.
 */

import type { AchievementView } from "../Achievements";
import type { CampaignChapterView } from "../Campaign";
import type { BoostView, ShopTrailView, SkinView } from "../Economy";
import type { WeeklyEvent, MonthlyTheme } from "../Events";
import type { SessionGoal } from "../Engagement";
import type { MissionRow, MissionView, QuestReward, QuestView } from "../Missions";
import type { ModeDef, PvpWorldCourse, ModeId } from "../Modes";
import type { RosterBird, Standing } from "../MassRace";
import type { BoardMetric, BoardPage, BoardScope } from "../Leaderboard";
import type { ActivePower } from "../PowerUps";
import type { CelebrationView } from "../ProgressBeats";
import type { RacerStats } from "../Racer";
import type { HighScore, Settings } from "../SaveData";
import type { TierView } from "../SeasonPass";
import type { FriendChallenge } from "../SocialSystem";
import type { SquadState } from "../Squad";
import type { TournamentView } from "../Tournaments";
import type { FlightMate } from "../pilots";

/** Every screen the HUD can be showing. Drives `SCREEN` and the render dispatch. */
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
  | "loadout"
  | "nameEntry";

export type UiState = "menu" | "playing" | "paused" | "continue" | "ad" | "gameover";
export type SeedMode = "today" | "yesterday" | "random";
export type CheckoutMode = "demo";
export type PortalName = "none" | "poki";

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

/**
 * The complete state the renderer is handed on every `HUD.update()`.
 *
 * 227 fields, and that width is the point of the type rather than a defect:
 * it is the full observable state of the UI, so a screen can read anything
 * without the caller assembling a partial. Renderers narrow it themselves —
 * see the doc comment on this module.
 */
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
  /**
   * First-flight coach progress. `step` is -1 whenever no coach line is up, and
   * `steps` is 0 in that case. Kept off `hint` on purpose: the progress used to
   * be three unicode circles pasted onto the front of the sentence, which both
   * looked cheap and pushed the sentence onto a second line.
   */
  coachStep: number;
  coachSteps: number;
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
  /** Wall-clock seconds the live break has been open. */
  adElapsed: number;
  /** Seconds before the escape hatch arms — never a player-facing skip. */
  adSafetySeconds: number;
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
  /** The active calendar day, `YYYY-MM-DD`. The squad quest ledger stores
   *  claim days, so the panel needs the current one to compare against. */
  today: string;
  runsPlayed: number;
  newlyCompleted: string[];
  claimedQuests: QuestReward[];
  skins: SkinView[];
  boosts: BoostView[];
  shopTrails: ShopTrailView[];
  settings: Settings;
  /** First-visit milestones for the home walkthrough. Stored, not derived:
   *  "did you open the shop" has no counter that means only that. */
  firstSteps: { shop: boolean; loadout: boolean; pve: boolean; pvp: boolean; settings: boolean };
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
  /** Live frame rate (from the adaptive-quality EMA), 0 before the first
   *  measured frame. Rendered by the optional FPS chip (settings.showFps). */
  fps: number;
  /** How the run ended, so the card can say so. */
  endReason: "daylight" | "water" | "settled";
  /** Whether the run actually ended in failure. A run that simply ran its
   *  course (daylight out, or a settled landing after a full card) is a
   *  complete run, and the recap headline must celebrate it, not mourn it —
   *  shaming successful players is how a recap loses the retry. */
  runOutcome: "complete" | "fail";
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
  /** Non-fatal link degradation (a signaling blip we are riding out). Shown
   *  beside the room, never as an error — the room and its peers are intact. */
  netLinkNote: string;
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
  /** Claim ledger for `SQUAD_QUESTS` — quest id -> the day it was claimed.
   *  The squad panel needs it so a claim button can disappear once spent; a
   *  button that outlives its own reward is the re-claim hole. */
  squadQuestsClaimed: Record<string, string>;
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
