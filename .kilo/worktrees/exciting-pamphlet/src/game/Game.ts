import { splitLayout, splitViews } from "./Viewport";
import { equalizedRace } from "./RaceRules";
import { terrainCue, landingLookAhead } from "./FlightGuidance";
import { ScreenHistory } from "./ScreenHistory";
import { copyText, shareText } from "./Clipboard";
import { replayOptions, shouldRebuildCasualWorld, type RunOptions } from "./Replay";
import * as THREE from "three";
import { Achievements } from "./Achievements";
import { GameAudio } from "./Audio";
import { BIOMES, biomeForIsland } from "./Biomes";
import { TRACK_NAMES } from "./Music";
import { Bird, type BirdStepOpts } from "./Bird";
import { AttractPilot } from "./pilot";
import { CameraRig, clipShotFor } from "./CameraRig";
import { PICKUP_STYLE, Collectibles, type CloudKind, type PickupKind } from "./Collectibles";
import { evaluateNearMiss, FlowTuner, SessionGoals, IDENTITY_TUNE, type DifficultyTune, type NearMiss, tuneDifficulty } from "./Engagement";
import { BIG_LAUNCH_QUIPS, BOP_QUIPS, FEVER_QUIPS, GEM_QUIPS, MILESTONE_QUIPS, SLEEP_QUIPS, SPLASH_QUIPS, SURRENDER_QUIPS, THUD_QUIPS, SurpriseEngine, quip } from "./Surprises";
import { MOMENTS, MomentLedger, momentShouldReact, type MomentKind, ClipLedger, clipFromMoment, clipHappyTime, clipShareLine, viralScore, pickCta } from "./Moments";
import { WEE_IDLE, fxScale, warpT, weeCheck, type WeeState } from "./SpeedFeel";
import { arcShouldWrite, arcSmooth, arcTarget , runEnergy } from "./MusicArc";
import { PRIVACY_POLICY_URL } from "./legal";
import { Funnel, visitKind, type FunnelStage, viralEventProps } from "./Funnel";
import type { Fx } from "./Fx";
import { DPR_COOLDOWN_SECONDS, nextBloomBudget, nextDpr, QUALITY_WINDOW_SECONDS } from "./quality";
import { LaunchSystem, ratingLabel, type LaunchResult } from "./LaunchSystem";
import { isRaceMode, MASS_RACE_FIELD, MODES, modeById, PVP_MODES, PVP_WORLDS, RACE_FINISH, type ModeDef, type ModeId, type PvpWorldCourse } from "./Modes";
import { MassRace } from "./MassRace";
import { BeatLine } from "./BeatLine";
import { beatTargets, crossedBeatLines, nearestBeatLine, type BeatLineInput, type BeatLineKind, type BeatTarget } from "./BeatLines";
import { FinishGate } from "./FinishGate";
import { fetchPublicRooms, isMultiplayerConfigured, makeRoomCode, RealtimeClient, type AnyRealtimeClient } from "./Realtime";
import { photoFinishMessage } from "./RacePolish";
import { SlopeChain } from "./SlopeChain";
import { RoomWatcher, ROOM_POLL_MS, roomSummaryLine, summarizeRooms, type LiveRoom } from "./RoomBrowser";
import { Leaderboard, loadPilotName, savePilotName, isLeaderboardOnline, type BoardMetric, type BoardPage, type BoardScope } from "./Leaderboard";
import { generatePilotName, isPilotNameClean } from "./pilotNameGenerator";
import { setLocale, t, whenLocaleReady, type SupportedLocale } from "../i18n";
import { Tournaments, TRAILS, weekKey, type PrizeGrant } from "./Tournaments";
import {
  dailyChallenge,
  dailyDone,
  modsFor,
  NO_MODS,
  stageDone,
  weeklyGauntlet,
  calendarReward,
  calendarRewardLabel,
  CALENDAR_DAYS,
  type ChallengeMods,
} from "./Challenges";
import { bankMasteryRun, masteryPerks, masteryViews, NO_MASTERY_PERKS, type MasteryPerks } from "./Mastery";
import { FirstFlight } from "./FirstFlight";
import { ONBOARDING_TIPS, nextOnboardingTip, type OnboardingContext, type OnboardingId, type OnboardingTip } from "./Onboarding";
import { bootStage, defer } from "./BootProgress";
import { continueOffer, continuePlacementLabel, type ContinueOffer } from "./ContinueOffer";
import { createWakeLock, type ScreenWakeLock } from "./WakeLock";
import { detectDeviceProfile, describeDeviceProfile, deviceProfileTelemetry, type DeviceProfile } from "../sdk/device-report";
import { campaignProgress, campaignViews, CAMPAIGN } from "./Campaign";
import { monthKey, monthlyTheme, THEME_TRAIL_CLEARS, weeklyEvent } from "./Events";
import { emptySquadState, SquadClient } from "./Squad";
import { PowerUps } from "./PowerUps";
import { INFLIGHT_POWERUPS } from "./hud/components/InFlightShop";
import { getPraise, getTimePressureMessage } from "./FunnyPraise";
import { Racer } from "./Racer";
import {
  ALT_CLOUDS,
  ALT_HIGH,
  ALT_SKY,
  ALT_STRATO,
  BIRD_RADIUS,
  BOOST_TIME,
  CLOUD_BONUS,
  LAND_PERFECT,
  COIN_VALUE,
  CONTINUE_COST,
  CONTINUE_DAYLIGHT,
  CONTINUE_TIMEOUT,
  DAYLIGHT_ISLAND_REFILL,
  DAYLIGHT_MAX,
  DAYLIGHT_MAX_GOLD,
  DAYLIGHT_OCEAN_PENALTY,
  FEVER_DURATION,
  FEVER_NEED,
  HEADSTART_DISTANCE,
  ISLAND_PERIOD,
  MAGNET_TIME,
  MANUAL_BOOST_COOLDOWN,
  MANUAL_BOOST_SPEED,
  MANUAL_BOOST_TIME,
  PHYS_DT,
  PICKUP_SUN_TIME,
  DAILY_STIPEND,
  REFERRAL_BONUS,
  STALL_SPEED,
  MAX_SPEED,
  WATER_Y,
ZENITH_ALT,
ZENITH_DURATION,
ZENITH_SLOWMO,
SHOP_AD_COINS,
SHOP_AD_SESSION_CAP,
} from "./constants";
import { BOOSTS, COLLECTIONS, GOLD, PROMO_CODES, SHOP_TRAILS, SKINS, STARTER_PACK, VIP, WHEEL_SECTORS, dailyDealBoost, dailyFlashBird, skinById, type BoostView, type ShopTrailDef, type ShopTrailView, type SkinDef, type SkinView } from "./Economy";
import { nextWings, wingsCrossing, wingsFor, wingsProgress, wingsPromotion } from "./Career";
import { celebrationView, planCelebration, wingsProximity, type Celebration, type ProgressEvent } from "./ProgressBeats";
import { GhostPlayer, GhostRecorder } from "./Ghost";
import { fetchRivalGhost, publishGhost } from "./GhostNet";
import { paceTargetDistance, synthesizePaceGhost } from "./RivalGhost";
import { buildGauntletCard, buildRivalCard } from "./Cards";
import { HUD, type CalendarCard, type CheckoutMode, type DailyCard, type GauntletCard, type HudSnapshot, type LoadoutView, type RivalCard, type SeedMode, type UiScreen, type UiState } from "./HUD";
import { divisionFor, duelOpponent, duelSkillFor, lobbyRivals, rankSeasonId, seasonReward } from "./pvp";
import { PilotBook } from "./pilots";
import { launchIntentFor, pvpCircuitFor } from "./launchRouting";
import { countSharePlay, loadSharedRun, shareRun, sharingAvailable, type SharedRun } from "./SharedRun";
import { Input } from "./Input";
import { clamp, dateSeed, formatDatePretty, lerp, SeededRandom } from "./math";
import { Missions, missionRows, newlyDone, nextActionLine, type MissionView, type QuestReward, type MissionRow, type QuestView, type RunStats } from "./Missions";
import { enqueue, enqueuePop, type BannerKind, type BannerMoment, type PopMoment } from "./HudFeedback";
import { ParticleFX } from "./ParticleFX";
import { TrailRibbon } from "./Trail";
import { fetchServerEntitlements,
  MockAdProvider,
  CoinPaymentProvider,
  type AdProvider,
  type Sku,
} from "./Payments";
import { SaveData } from "./SaveData";
import { SocialSystem } from "./SocialSystem";
import { SeasonPass, seasonId, seasonLabel, XP_RULES } from "./SeasonPass";
import { FlightCues } from "./FlightCues";
import { endlessSpeedScale } from "./FlightProgression";
import { buildChallengeUrl, readChallengeFromUrl, type RivalChallenge } from "./Challenge";
import { flag } from "./Flags";
import { EXPERIMENTS, variant } from "./Experiments";
import { buildRoomInviteUrl, normalizeRoomCode, readRoomInviteFromUrl } from "./RoomInvite";
import { PORTAL_BANNER_ID, attachPortalErrorReporters, initPlatform, isCoarsePointer, isPortalBuild, portalTarget as getPortalTarget, type PlatformAdapter } from "../sdk/platform";
import { CUSTOM_PILOT_NAMES, POKI_MULTIPLAYER, SELL_AD_REMOVAL, SIMULATED_BREAKS, SQUAD_CHAT } from "./edition";
import { buildStamp } from "./version";
import type { PokiNetlibClient } from "./PokiNetlib";
import { GameplayEventSink } from "./GameplayEvents";
import { LivingBackground } from "./LivingBackground";
import { Sky } from "./Sky";
import { Telemetry } from "./Telemetry";
import { crashReporter } from "./resilience/CrashReporter";
import { Watchdog } from "./resilience/Watchdog";
import { TerrainSystem } from "./TerrainSystem";
import { Weather } from "./Weather";

// On Poki builds, eagerly fetch the PokiNetlib module so createNetTransport
// can instantiate PokiNetlibClient synchronously when the player first taps PvP.
// The dynamic import keeps @poki/netlib out of non-Poki bundles (Rollup DCE).
let _PokiNetlibClass: typeof PokiNetlibClient | null = null;
if (POKI_MULTIPLAYER) {
  void import("./PokiNetlib").then((m) => { _PokiNetlibClass = m.PokiNetlibClient; }).catch(() => { /* best-effort */ });
}

export type GameState = UiState;
type AdReason = "continue" | "interstitial";

/**
 * Which states count as "the player is interacting" for the portal gameplay
 * clock.
 *
 * Poki defines `gameplayStart()` as *interaction*, not "the run timer is
 * running": "fire when the player starts interacting (first input, level start,
 * unpause)", and the documented startup sequence is
 * `gameLoadingFinished()` → `gameplayStart()`. A menu-driven game that only
 * starts the clock when a flight begins reports **zero** engaged time for the
 * whole first minute of a session — the menu, the shop, the results screen and
 * every choice in between — and a player who browses for 50 s and leaves has
 * an engaged session of 0 s.
 *
 * So: the clock runs whenever the player can act, and stops only when they
 * genuinely cannot — an ad break (the portal owns the screen), paused, or the
 * tab is hidden. `GameplayEventSink` still guarantees no duplicate phase ever
 * reaches the SDK, which is the one thing the Inspector flags.
 */
/** What triggered the shared speed burst — telemetry + the toast copy. */
type ManualBoostSource = "double_tap" | "stall_rescue" | "tailwind";

const MANUAL_BOOST_COPY: Record<ManualBoostSource, string> = {
  double_tap: "DOUBLE TAP BOOST!",
  stall_rescue: "STALL RESCUE BOOST!",
  tailwind: "TAILWIND! Off like a shot",
};

const INTERACTIVE_STATES: ReadonlySet<GameState> = new Set<GameState>([
  "menu", "playing", "gameover", "continue",
]);

function isInteractive(state: GameState): boolean {
  return INTERACTIVE_STATES.has(state);
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = new THREE.Color().setHSL(h, s, l);
  return [c.r, c.g, c.b];
}

/** Seconds a ring chain stays open — one number for the rule and the meter. */
const RING_CHAIN_WINDOW = 2.8;

const ASLEEP: BirdStepOpts = { diving: false, fever: false, speedMult: 1, boost: false };

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Flags alive at once — matches `BEAT_MAX_LINES`, the cap the pure seam returns. */
const BEAT_MAX_FLAGS = 3;

/**
 * The tint on each flag's band: a rival's mark is the same amber as their ghost
 * silhouette, so the flag and the bird you are chasing read as one opponent.
 */
const BEAT_TINTS: Record<BeatLineKind, number> = {
  rival: 0xffc86a,
  best: 0xffd76a,
  daily: 0x9dffb0,
  today: 0xb6e0a8,
  goal: 0xffffff,
};

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly save: SaveData;
  private readonly social: SocialSystem;
  private readonly missions: Missions;
  private readonly achievements: Achievements;
  private readonly seasonPass: SeasonPass;
  private readonly input: Input;
  private readonly audio: GameAudio;
  private readonly hud: HUD;
  private readonly bird: Bird;
  private readonly camera: CameraRig;
  private readonly particles: ParticleFX;
  private readonly trail: TrailRibbon;
  private fx: Fx | null = null;
  private fxLoading = false;
  private fxFailed = false;
  private menuRenderAcc = 1 / 30;
  private readonly attractPilot = new AttractPilot();
  private readonly flightCues = new FlightCues();
  private lastHudAt = -Infinity;
  private lastHudVersion = -1;
  private readonly isMobile: boolean;
  private useBloom = false;
  private bloomBudget = { enabled: false, goodWindows: 0, cooldown: 0 };
  private readonly sky: Sky;
  private readonly mockPayments = new CoinPaymentProvider();
  private readonly ads: AdProvider = new MockAdProvider();
  private platform: PlatformAdapter | null = null;
  /** Detaches the window error → `captureError` reporters (see platform boot). */
  private detachPortalErrorReporters: (() => void) | null = null;
  /** Set once `maybeAutoOpenShop()` has fired; the hangar opens itself at most
   * once per session, so a player who backs out is never dragged back in. */
  private autoShopDone = false;
  /** Wallet value from the previous auto-shop scan; -1 = never scanned. The
   * hangar only opens for an item that crossed from "too dear" to "yours" since
   * then, so it is always news and never a nag. */
  private autoShopLastWallet = -1;
  /**
   * Every gameplayStart/gameplayStop that reaches a portal funnels through
   * this sink — Poki forbids a gameplay event following an identical one.
   * The adapter may not exist until the async SDK init lands; the sink
   * records the phase either way so a late landing never replays a stale
   * stop/start.
   */
  private readonly gameplaySink = new GameplayEventSink((phase) => {
    if (phase === "start") this.platform?.gameplayStart();
    else this.platform?.gameplayStop();
  });
  private readonly telemetry = new Telemetry();
  /** Detects multi-second main-thread stalls while the tab is visible and
   * reports them through telemetry. Suspended during context loss and ad
   * breaks (rAF legitimately stops there — naively checking would report
   * every tab switch as a stall). */
  private readonly watchdog = new Watchdog({
    onStall: (stallMs, bucket, worstTaskMs) => {
      this.telemetry.track("main_thread_stall", { ms: stallMs, bucket, worstTaskMs });
      crashReporter.breadcrumb(`stall ${bucket} (${Math.round(stallMs)}ms, worst task ${worstTaskMs}ms)`);
    },
  });
  private readonly ghostRecorder = new GhostRecorder();
  private readonly ghostPlayer = new GhostPlayer();
  /** Network rival ghost (async PvP on the daily seed) — amber silhouette. */
  private readonly rivalGhostPlayer = new GhostPlayer();
  private rivalGhostName = "";
  /**
   * True when the chase target is a generated pace ghost rather than a real
   * pilot's flight. The copy has to differ: claiming a synthetic line was flown
   * by a person would poison every rival in the game the day a player works it
   * out (see `RivalGhost.ts`).
   */
  private rivalGhostSynthetic = false;
  private rivalGhostPassed = false;
  /** Run counter — guards async ghost loads against arriving mid-next-run. */
  private runEpoch = 0;
  private readonly livingBg = new LivingBackground();
  private terrain: TerrainSystem;
  private collect: Collectibles;
  private weather: Weather;
  private today = dateSeed();
  private seed: string;
  private seedMode: SeedMode = "today";

  private state: GameState = "menu";
  private screen: UiScreen = "main";
  private readonly screenHistory = new ScreenHistory<UiScreen>("main");
  private uiVersion = 0;
  private viewsVersion = -1;
  private missionViews: MissionView[] = [];
  private questViews: QuestView[] = [];
  private skinViews: SkinView[] = [];
  private boostViews: BoostView[] = [];
  private shopTrailViews: ShopTrailView[] = [];

  private raf = 0;
  private acc = 0;
  /** Bird position at the start of this frame's physics steps — the "from"
   *  end of render interpolation (lerped toward this.bird.x/y each frame). */
  private prevBirdX = 50;
  private prevBirdY = 30;
  private last = 0;
  private elapsed = 0;
  private runTime = 0;
  private disposed = false;
  private hidden = false;
  /** The browser dropped the WebGL context (GPU reset, driver crash, a long
   *  background stint). We stop drawing and wait for webglcontextrestored
   *  instead of burning frames against a dead context. */
  private contextLost = false;
  /** Anti-oscillation lock-out for resolution changes, in seconds. */
  private dprCooldown = 0;
  private timeScale = 1;
  private zenithTimer = 0;
  private hitStopTimer = 0;
  private frameEma = 1 / 60;
  /** Hysteresis state for the WEE celebration (see SpeedFeel.weeCheck). */
  private weeState: WeeState = WEE_IDLE;
  /** Fastest speed reached this run, for `run_end.speedPeak` (units/s). */
  private speedPeak = 0;
  /** Smoothed music-arc intensity, and the last value actually written to the
   *  audio graph (see MusicArc.arcShouldWrite — the dead band exists so the
   *  automation timeline does not grow by one event per frame). */
  private arcIntensity = 0;
  private arcWritten = 0;
  /** Last particle budget pushed to ParticleFX, so we only write on change. */
  private fxBudget = 1;
  /** Wall-clock ms of the last emitted frame_error telemetry (throttled). */
  private frameErrAt = 0;
  /** Rolling field-performance stats, flushed to telemetry every ~10s so a
   *  device-side perf regression is visible without a debugger attached. */
  private perfLongFrames = 0;
  private perfWorst = 0;
  private perfTimer = 0;
  private qualityTimer = 0;
  private dpr = 1;
  private renderWidth = 0;
  private renderHeight = 0;
  private renderDpr = 0;
  private dustCooldown = 0;
  private particleBudget = 1;
  private deferredInstall: BeforeInstallPromptEvent | null = null;
  private readonly onBeforeInstall: (e: Event) => void;
  private readonly onInstalled: () => void;
  private readonly onContextLost: (e: Event) => void;
  private readonly onContextRestored: () => void;

  /**
   * Measured capability baseline (Poki Player Device Report, DEV-03). Probed
   * once, before the renderer exists, and read for every quality decision —
   * shadows, pixel ratio, particle budget. Never inferred from the UA alone.
   */
  private readonly deviceProfile: DeviceProfile = detectDeviceProfile();
  /**
   * Keeps the phone screen awake for the duration of a run (DEV-14: WakeLock is
   * one of the APIs the Device Report tracks; a dimming screen mid-flight is
   * the most common non-bug drop-off on mobile). No-op where unsupported.
   */
  private readonly wakeLock: ScreenWakeLock = createWakeLock();
  /** Context-driven rewarded framing for the continue screen (MON-19). */
  private continueOfferView: ContinueOffer | null = null;
  /** Current progressive onboarding tip, or null when none eligible */
  private onboardingTip: OnboardingTip | null = null;

  private daylight = DAYLIGHT_MAX;
  /** Seconds the bird has sat settled (grounded/water, slow, no input). */
  private settleAcc = 0;
  /** runTime of the last dive input; passive braking keys off it. */
  private lastInputAt = 0;
  private startX = 64;
  private island = 0;
  private lastIsland = 0;
  private perfects = 0;
  private perfectChain = 0;
  private feverTimer = 0;
  private feverOn = false;
  private feverReached = false;
  private prevVy = 0;
  private bonus = 0;
  private scoreAccum = 0;
  private splashCd = 0;
  private thudCount = 0;
  private bounceCount = 0;
  /**
   * The run's moment ledger: every BONK / SPLOSH / BOING / PHEW / PERFECT /
   * PANIC / SLEEP / RECORD, tallied for the results card, the share line and
   * the retention funnel. Classification and copy both live in `Moments.ts` so
   * one table drives popups, haptics, telemetry and the recap.
   */
  private readonly moments = new MomentLedger();
  /** Share-layer ledger: near-miss / overtake / photo-finish / crash / clean. */
  private readonly clips = new ClipLedger();
  /** Previous finished run, for Engagement.tuneDifficulty (resetRun zeroes the bird). */
  private lastFinishedDistance = 0;
  private lastFinishedDuration = 0;
  private recentPlaces: number[] = [];
  private lastViralScore = 0;
  /** Casual-only contest feel. Identity on rated / live rooms. */
  private difficultyTune: DifficultyTune = IDENTITY_TUNE;
  /**
   * Retention funnel: when this session first saw a tap, a flight, a coin, a
   * laugh, a death and a retry. One beacon per stage, ever - see `Funnel.ts`.
   */
  private readonly funnel = new Funnel();
  /** `funnel_summary` fires at most once per session (first tab-hide). */
  private funnelSummarySent = false;
  /** Run-clock stamp of each kind's last *shown* reaction (throttle budget). */
  private momentLastAt: Partial<Record<MomentKind, number>> = {};
  private konamiBuffer: string[] = [];
  /** Edge-trigger for the ocean-entry splash burst (see fixedUpdate). */
  private wasInWater = false;
  private hintTimer = 0;
  private hint = "";
  private runCoins = 0;
  /** The end-of-run 3× coin bonus claims once per run — the results card
   * re-renders every frame, so without this flag the bonus was re-claimable
   * forever (each claim tripled runCoins and re-armed the card). */
  private multiplierClaimed = false;
  /** Rewarded-ad coin claims earned via the shop this hour (see adHourKey). */
  private shopAdClaimed = 0;
  /** Hour-buckets the shopAdClaimed counter; resets when the wall-clock hour rolls. */
  private adHourKey = Math.floor(Date.now() / 3_600_000);
  private runClouds = 0;
  private zeniths = 0;
  private pickups = 0;
  private magnetTimer = 0;
  /** Ridge-skim flow: seconds spent hugging the terrain at speed. */
  private skimTime = 0;
  private skimCd = 0;
  /** Rare delightful mid-run events (comedy + windfalls). */
  private readonly surprises = new SurpriseEngine();
  /** Seeded RNG for surprises, so the same run seed yields the same events. */
  private surpriseRng = new SeededRandom("surprises");
  private splashQuipN = 0;
  private shield = 0;
  private boostTimer = 0;
  private manualBoostCooldown = 0;
  private wasDiving = false;
  private continuesUsed = 0;
  private continueTimer = 0;
  private adTimer = 0;
  private adReason: AdReason = "interstitial";
  private skipInterstitialOnce = false;
  private runRecorded = false;
  private newlyCompleted: string[] = [];
  private claimedQuests: QuestReward[] = [];
  private menuHold = 0;
  private needRelease = false;
  /**
   * Attract mode: the live sim flies behind the menu (see menuTick). Demo
   * physics runs the real Bird.step with the pilot's hold decisions — no
   * scoring, audio, saves or telemetry, so the backdrop can never leak
   * into a run. resetRun(true) is the silent demo reset; startRun() takes
   * over seamlessly because the first menu HOLD carries straight into it.
   */
  private demoAcc = 0;
  private demoTime = 0;
  private demoStuck = 0;
  private ghostWasAhead = false;
  private ghostPassed = false;
  private readonly launch = new LaunchSystem();
  private readonly massRace = new MassRace();
  private readonly finishGate = new FinishGate();
  /**
   * The "can you beat this?" flags: a pool of `BEAT_MAX_LINES` world props, stood
   * at the marks ahead of the bird and hidden when a slot has nothing to show.
   */
  private readonly beatFlags: BeatLine[] = [];
  private beatAhead: BeatTarget[] = [];
  private beatCue: BeatTarget | null = null;
  private beatFired = new Set<string>();
  private beatPollT = 0;
  private finishRemaining = -1;
  private readonly board: Leaderboard;
  private readonly cups: Tournaments;
  private pilotName = "";
  private boardScope: BoardScope = "global";
  private boardMetric: BoardMetric = "distance";
  private boardPage: BoardPage | null = null;
  private boardLoading = false;
  private lastPrize: PrizeGrant | null = null;
  private racePlace = 0;
  /** Outcome of the in-flight run for the portal funnel (`complete` only when the goal was reached). */
  private runOutcome: "complete" | "fail" = "fail";
  private raceField = 0;
  private raceFinishTime = 0;
  private net: AnyRealtimeClient | null = null;
  private roomCode = "";
  /** True when the current roomCode was entered/invited by another player
   *  (vs. generated locally by host-room or by quick-match shuffle). Only
   *  remote codes cause the client to adopt the host's seed on welcome —
   *  our own codes should keep our selected format/world. */
  private joiningRemoteRoom = false;
  /** Room invite (#room=) pending application on the first frame. */
  private pendingRoomInvite = "";
  private roomSize = 40;
  private roomSkill: "chill" | "sharp" | "ace" = "sharp";
  private roomMuted = false;
  private lastEmoteWallAt = 0;
  /** Run-clock stamp for the automatic crown emote on a personal best. */
  private lastEmoteRunAt = 0;
  private draftBanner = 0;
  private wasDrafting = false;
  /** Rival tracking: who beat you last time, for the revenge prompt. */
  private nemesis = "";
  private photoFinish = "";
  private rankedRace = true;
  private lastRatingDelta = 0;
  private lastRatingBonus = 0;
  private lastPlace = 0;
  private overtakeAcc = 0;
  private closeCallAcc = 0;
  private nextKnockoutDist = 500;
  private knockoutWarned = false;
  /** Ranked 1v1 duel: one seeded opponent, flat ±16 rating swing. */
  private duelActive = false;
  /** Matchmaking search deadline (wall-clock ms; 0 = not searching). Wall
   *  clock, not frame dt — frame time is capped at 100 ms, so on slow
   *  devices an accumulated-dt countdown runs slower than real time. */
  private mmDeadline = 0;
  private localRace = false;
  private networkStartAt = 0;
  /** Deferred launch options for when the search resolves. */
  private mmOpts: { ranked: boolean; storm: boolean } | null = null;
  /** Search phase: a live countdown while "searching", then "waiting" — the
   *  search stays open and the pilot decides, instead of being dropped into an
   *  AI race they never asked for. */
  private mmPhase: "searching" | "waiting" = "searching";
  /** Summary of public rooms seen during the search (real players, no fakes). */
  private mmRooms = "";
  private roomWatcher: RoomWatcher | null = null;
  /** The last launched match's options — powers the one-tap Rematch button. */
  private lastMatchOpts: { ranked: boolean; storm: boolean } | null = null;
  /** Stormfront mode: PvE hazards×PvP race hybrid — everyone flies the gauntlet. */
  private stormfront = false;
  /** Stormfront phase (1-3): the storm escalates as the field advances. */
  private stormPhase = 1;
  /** First thermal of the run gets a toast; the HUD chip covers the rest. */
  private thermalToasted = false;
  /** Flight recap: downsampled [x, y] profile of the finished run. */
  private flightPath: [number, number][] = [];
  /** Weekly-event physics mods, cached at run start (hot path: every frame + every coin). */
  private weeklyMods = { coinMult: 1, gravityMult: 1, windMult: 1, daylightMult: 1 };
  /** Golden Hour: the last stretch of daylight — 2× coins, amber world. */
  private goldenHour = false;
  private nextMilestone = 500;
  private rivalBeatenToast = false;

  /* ---- AUDS shared runs: async multiplayer by code (Poki builds) ---- */
  /** The code published for the run on screen, "" until the player shares. */
  private shareCode = "";
  private runShareBusy = false;
  private shareError = "";
  /** The friend's run loaded from a code, waiting to be raced. */
  private sharedRun: SharedRun | null = null;
  /** True once the DO's official finish place has been folded in this race. */
  private serverPlaceApplied = false;
  private duelResult: "" | "won" | "lost" = "";
  private duelDelta = 0;
  /** Which challenge (if any) the current run is flying under. */
  private challengeRun: "" | "daily" | `gauntlet${number}` = "";
  private challengeMods: ChallengeMods = NO_MODS;
  /** End-of-run outcome line for the challenge strip on the results card. */
  private challengeOutcome = "";
  /** Incoming rival challenge (#rival= link): fly their seed, beat their mark. */
  private rival: RivalChallenge | null = null;
  private rivalResult: "" | "won" | "lost" = "";
  /** Weekly live event: current run flies under the event modifiers. */
  private eventRun = false;
  /** Squad (friends/clubs/chat) client + last action notice. */
  private squad: SquadClient | null = null;
  /** The real pilots this device has flown with (see pilots.ts). */
  private readonly pilots = new PilotBook();
  private squadNotice = "";
  private squadPoll = 0;
  private readonly flow = new FlowTuner();
  private readonly goals: SessionGoals;
  private nearMiss: NearMiss = { kind: "none", gap: 0, text: "" };
  private goalPop = "";
  private goalPopT = 0;
  private goalPopKind: "goal" | "quest" = "goal";
  /** Session goals completed this run — the only music term that cannot fall. */
  private runGoalsDone = 0;
  /** Moments waiting for the single pill, in the order they were earned. */
  private popQueue: PopMoment[] = [];
  /** Career rung crossed during this flight: banner text and its own timer. */
  private rankUp = "";
  private rankUpKind: BannerKind = "rank";
  private rankUpT = 0;
  private rankCued = false;
  /** Banners waiting for the one banner slot, in the order they were earned. */
  private bannerQueue: BannerMoment[] = [];
  /** Today's quest rows as of the last live poll, so crossings fire once. */
  private questRowsPrev: MissionRow[] = [];
  private questPollT = 0;
  private recordBanner = "";
  /** Previous personal-best distance, captured at run start (for the record loop). */
  private bestAtStart = 0;
  private distanceRecordCrossed = false;
  private newBest = false;
  /** Progression this flight earned — collected into ONE ranked celebration. */
  private progressEvents: ProgressEvent[] = [];
  /** The plan the results card renders (`ProgressBeats.ts` decides it). */
  private celebration: Celebration = planCelebration([]);
  /** Career-wings proximity: the bar that fills while a rank-up approaches. */
  private proximity = { visible: false, fill: 0, remaining: 0, name: "" };
  /** One shimmer per flight, fired in the last stretch of the rung. */
  private proximityCued = false;
  private runGems = 0;
  private runRings = 0;
  private ringChain = 0;
  private ringChainTimer = 0;
  private readonly slopeChain = new SlopeChain();
  private runBalloons = 0;
  private runSunflowers = 0;
  private readonly powers = new PowerUps();
  private coach: FirstFlight | null = null;
  private mode: ModeDef = modeById("daytrip");
  private modeId: ModeId = "daytrip";
  private selectedPvpMode: ModeId = "pvp_sprint";
  private selectedPvpWorld = "emerald";
  private selectedCourse: PvpWorldCourse = PVP_WORLDS[0]!;

  /** The race course in effect (selection, with legacy world-id fallback). */
  private courseForRace(): PvpWorldCourse {
    return (
      this.selectedCourse ??
      (this.selectedPvpWorld ? PVP_WORLDS.find((w) => w.id === this.selectedPvpWorld) : null) ??
      PVP_WORLDS[0]!
    );
  }
  /** Permanent per-mode mastery perks (coin/daylight/fever/lift), refreshed each run. */
  private masteryPerk: MasteryPerks = NO_MASTERY_PERKS;
  private maxAltitude = 0;
  private maxSpeed = 0;
  private lastLaunch: LaunchResult | null = null;
  private launchBannerT = 0;
  private launchBannerText = "";
  private countdown = 0;
  private versus = false;
  private p2: Racer | null = null;
  private p1: Racer | null = null;
  private versusWinner = 0;
  private versusGrace = 5;
  private altZone = 0;
  private readonly tmpSize = new THREE.Vector2();
  private readonly tmpColor = new THREE.Color();
  private vipActive = false;
  private vipExpiredNotice = false;
  private dayTimer = 0;
  private pendingXp = 0;
  private xpFlush = 0;
  private thermalEmitAcc = 0;
  private windEmitAcc = 0;
  private trailFxAcc = 0;
  private powerFxAcc = 0;
  private hueT = 0;
  private lastBiomeId = "";
  private readonly onFocus: () => void;
  private readonly onBlur: () => void;
  private readonly onOrientationChange: () => void;
  private readonly onFullscreenChange: () => void;

  private checkoutSku: Sku = "sunbird_gold";
  private checkoutBusy = false;
  private checkoutError = "";
  private checkoutOk = false;
  private checkoutWaiting = false;
  private restoreMessage = "";
  private referralMessage = "";
  private cloudMessage = "";
  private shareBusy = false;
  /** A/B "results_cta_order" variant, resolved (and exposed) once on the
   *  first results screen — sticky per device, logged via telemetry. */
  private expShareFirst: "control" | "treatment" | null = null;
  private resetArmed = false;
  private resetTimer = 0;

  private readonly resizeObs: ResizeObserver;
  private orientationTimers: number[] = [];
  private readonly onVis: () => void;
  private readonly onResize: () => void;
  private readonly loop: (t: number) => void;

  constructor(private readonly host: HTMLElement) {
    // The funnel clock starts before anything is built, so the "boot" mark
    // measures real time-to-interactive instead of always reading zero.
    this.funnel.start();
    this.save = new SaveData();
    this.social = new SocialSystem(this.save);
    // Corruption recovery is a data-loss event worth knowing about: the blob is
    // parked (not destroyed), but the player is silently starting fresh unless
    // we say so. Track it once, and toast it below once the HUD exists.
    if (this.save.recoveredFromCorruption) this.telemetry.track("save_corrupt_recovered", {});
    this.flow.load(this.save);
    this.goals = new SessionGoals(this.flow);
    this.missions = new Missions(this.save);
    this.achievements = new Achievements(this.save);
    this.seasonPass = new SeasonPass(this.save);
    this.board = new Leaderboard(this.save.state.deviceId);
    // Warm the startup locale pack (English is resident; everyone else
    // fetches one small file). Runs while the HUD/menu build — the module
    // already lives in this chunk, so this costs nothing on the entry path.
    void whenLocaleReady();
    this.telemetry.bindDevice(this.save.state.deviceId);
    // The crash reporter's network copy goes through the same privacy
    // pipeline as every other event; the journal from the previous session
    // (if any) is reported exactly once, here.
    crashReporter.attach(this.telemetry);
    const priorCrashes = crashReporter.previousSessionCrashes.length;
    if (priorCrashes > 0) this.telemetry.track("boot_after_crash", { count: priorCrashes });
    // Build identity, once per boot: the line a player bug report, a portal
    // review or a crash journal gets tied back to. `console.debug` only (shipped
    // code may not carry log/warn/info — `verify:prod` fails on them) and no PII:
    // a semver, an edition name and a commit sha. See docs/VERSIONS.md.
    console.debug(buildStamp());
    this.watchdog.start();
    // Persistence failures (quota / blocked storage) lose progress silently
    // unless we say so — route them through the same observability bus.
    this.save.onPersistError = () => this.telemetry.track("save_persist_failed", {});
    this.cups = new Tournaments(this.save.state.tournaments);
    // First-boot name: if no pilotName was saved, generate one right now so the
    // player has an identity for leaderboards, multiplayer, and the account
    // screen before they ever touch a name field. The generator produces
    // memorable <SkyWord><BirdWord><NN> pairs (e.g. NovaFalcon42).
    const generatedFresh = !this.save.state.pilotName;
    this.pilotName = this.save.state.pilotName || loadPilotName(this.save.state.deviceId);
    this.save.state.pilotName = this.pilotName;
    if (generatedFresh || this.cups.rollover()) this.save.persist();
    // Ranked season rollover can also land between sessions.
    const seasonEnd = this.save.ensureRankSeason();
    this.seed = this.today;
    this.squad = new SquadClient(this.save.state.deviceId, () => this.pilotName);
    this.squad.setOnChange(() => this.bump());
    // The public pilot record needs the mark and the bird; the game is the only
    // thing that knows them. Refresh it whenever a run might have improved it.
    this.squad.setPublishStats({ bestDistance: this.save.state.bestDistance, skin: this.skin.id });

    host.classList.add("game-root");
    const canvas = document.createElement("canvas");
    canvas.className = "game-canvas";
    host.appendChild(canvas);
    if (isPortalBuild()) {
      // Portal pages are long (the game sits in an iframe on a scrollable
      // host page): a wheel over the canvas must not scroll the page.
      // In-game HTML panels keep their own scroll behavior untouched.
      canvas.addEventListener("wheel", (ev) => ev.preventDefault(), { passive: false });
    }

    // Embedded portal browsers often expose a desktop UA at a phone-sized
    // viewport. Treat the narrow viewport as mobile too, otherwise we keep a
    // 2x render target and shadows that make the flight feel laggy.
    // Tablets count as mobile-class: iPads report desktop-ish UAs and wide
    // viewports, so UA+width alone would hand them the desktop scheme.
    // Poki requires mobile control/perf schemes on tablets — a coarse
    // primary pointer (touch) is the robust signal.
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isCoarsePointer() || window.innerWidth < 700;
    this.isMobile = isMobile;

    // Try hardware-accelerated WebGL first; fall back to software (SwiftShader)
    // so the game runs in sandboxed/headless environments (e.g. in-app browsers,
    // CI, Electron without GPU) instead of showing an error screen.
    let softwareMode = false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile,
        powerPreference: isMobile ? "low-power" : "default",
        stencil: false,
        alpha: false,
        premultipliedAlpha: true,
        // A mobile browser may report a performance caveat even when its
        // hardware WebGL path is substantially faster than software. Rejecting
        // it here caused lag spikes on embedded portal browsers.
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      softwareMode = true;
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "default",
        stencil: false,
        alpha: false,
        premultipliedAlpha: true,
        failIfMajorPerformanceCaveat: false,
      });
    }

    this.renderer.setClearColor(0x87c8ee, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 1.27 washed the highlights out under ACES; 1.16 keeps the sun bright
    // but lets the hills hold their colour instead of turning milky.
    this.renderer.toneMappingExposure = 1.16;
    // Software renderer: disable shadows and cap pixel ratio to keep it usable.
    // The device baseline does the same for measured-lite hardware (≤2 cores,
    // ≤2 GB, no WebGL) — DEV-03 is "pick tiers from the probe", not from taste.
    this.renderer.shadowMap.enabled = !softwareMode && this.deviceProfile.tier !== "lite";
    // PCFSoftShadowMap was removed in three r165+ — PCF with a slightly larger
    // shadow map is the soft look without the console warning every load.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.dpr = softwareMode ? 1 : this.preferredDpr();
    this.renderer.setPixelRatio(this.dpr);

    // EA-04/EA-05: the renderer (the expensive object) exists — the loading
    // screen can now say so truthfully.
    bootStage("engine");

    this.scene = new THREE.Scene();
    // Fog pushed well past the action: at near=62 the hills the bird is about
    // to fly through were already washed out, which read as permanent mist.
    // Keep the horizon readable. The old near fog started inside the play
    // space and made the whole menu/gameplay read as a white cloud layer.
    this.scene.fog = new THREE.Fog(0x8ed0ee, 600, 2600);

    // WebGL context loss. A mobile GPU reset, a driver hiccup or a long
    // background stint can drop the context; without preventDefault() the
    // browser never restores it and the canvas stays frozen with no
    // explanation. Three.js re-initialises its own GPU state on restore, so we
    // only need to stop drawing, tell the player, and resume.
    this.onContextLost = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.state === "playing") this.setState("paused");
      this.audio.setHiddenMuted(true);
      this.watchdog.suspend(); // rAF stops with the context — not a stall
      this.hud.toast("Graphics context lost — restoring…");
      this.telemetry.track("webgl_context_lost", {});
      // If the GPU never comes back, say so instead of leaving a dead canvas.
      window.setTimeout(() => {
        if (this.contextLost && !this.disposed) {
          this.hud.toast("Graphics could not be restored — reload the page to keep flying");
          this.telemetry.track("webgl_context_lost_unrecovered", {});
        }
      }, 8000);
    };
    this.onContextRestored = () => {
      this.contextLost = false;
      this.watchdog.resume();
      this.renderWidth = 0; // force a fresh buffer after GPU/context restoration
      this.audio.setHiddenMuted(false);
      // Rebuild the drawing buffer at the current size and drop the stale clock.
      this.dprCooldown = 0;
      this.last = performance.now();
      this.acc = 0;
      this.resize();
      this.hud.toast("Graphics restored");
      this.telemetry.track("webgl_context_restored", {});
    };
    canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);

    this.hud = new HUD(host);
    this.input = new Input(host, () => {
      void this.audio.resume();
      // The first touch is the first real commitment a portal visitor makes and
      // the cheapest stage to lose. Marked from the input callback itself, so
      // no input path (mouse, touch, key, pad) can be missed.
      this.markFunnel("first_input");
    });
    this.audio = new GameAudio();
    // A tasteful "now playing" cue when the score moves to a new track — only
    // when the game is at rest, so it never interrupts a run in flight.
    this.audio.setOnTrackChange((name) => {
      // A quiet "now playing" cue at rest and in flight — never while paused
      // or during an ad, when the game (and audio) is muted or on hold.
      if (this.state === "menu" || this.state === "playing") this.hud.toast(`♪ ${name}`, "info");
    });

    // Critical preload: bird first (player must see self immediately), then first 2 islands
    // (920 units each = 1840). Remaining chunks load via idle — EA-05 progressive.
    this.bird = new Bird();
    this.bird.addTo(this.scene);
    const qualityTier = this.deviceProfile.tier === "lite" ? "lite" : this.deviceProfile.tier === "standard" ? "mid" : "high";
    this.terrain = new TerrainSystem(this.seed, qualityTier);
    this.scene.add(this.terrain.group);
    // Pre-warm first 2 islands synchronously — player spawns at 0, needs 0-1840 visible
    this.terrain.update(0);
    this.terrain.update(920);
    bootStage("world");
    this.ghostPlayer.addTo(this.scene);
    this.rivalGhostPlayer.addTo(this.scene);
    this.rivalGhostPlayer.setTint(0xffc86a, 0xffe8b0);
    this.scene.add(this.livingBg);

    this.camera = new CameraRig(1);
    this.particles = new ParticleFX();
    this.particles.addTo(this.scene);
    this.trail = new TrailRibbon();
    this.trail.addTo(this.scene);
    // Optional post-processing is loaded only when a desktop flight needs it.
    this.sky = new Sky();
    this.scene.add(this.sky.group);
    this.sky.addLights(this.scene);

    this.collect = new Collectibles(this.terrain.seedN, this.seed, qualityTier);
    this.scene.add(this.collect.group);
    this.weather = new Weather(this.terrain.seedN);
    this.weather.addTo(this.scene);
    this.massRace.addTo(this.scene);
    this.finishGate.addTo(this.scene);
    for (let i = 0; i < BEAT_MAX_FLAGS; i++) {
      const flag = new BeatLine();
      flag.addTo(this.scene);
      this.beatFlags.push(flag);
    }

    this.applySkin();
    this.applySettings();
    this.resetRun(true);
    this.camera.setIntro(1);
    this.audio.setMusicMode("menu");

    // Rival links: #rival=seed.distance.name[&mode=] → same hills, their mark.
    const rival = readChallengeFromUrl();
    if (rival) {
      this.rival = rival;
      this.rebuildWorld(rival.seed);
      this.seedMode = "random";
      if (rival.mode && MODES.some((m) => m.id === rival.mode)) {
        this.modeId = rival.mode as ModeId;
        this.mode = modeById(this.modeId);
      }
      this.hud.toast(
        t("toast.rival.challenge", { name: rival.name, distance: rival.distance }, "🥊 {name} challenged you: beat {distance} m on their hills"),
        "quest",
      );
      this.telemetry.track("rival_received", { distance: rival.distance, mode: this.modeId });
      this.telemetry.track("challenge_open", viralEventProps("challenge_open", { mode: this.modeId, distance: rival.distance }));
    }

    // Room invite links: #room=CODE → seat straight into that private room.
    // Only honored when a realtime server is configured (portals ship none).
    const roomInvite = isMultiplayerConfigured() ? readRoomInviteFromUrl() : null;
    if (roomInvite) {
      this.roomCode = roomInvite;
      this.joiningRemoteRoom = true;
      this.pendingRoomInvite = roomInvite;
    }

    // Async-race share link: ?run=CODE → auto-populate the shared-run input
    // so the friend who clicked a result link lands straight into loading that run.
    try {
      const runParam = new URLSearchParams(window.location.search).get("run");
      if (runParam && runParam.length > 0) {
        this.shareCode = runParam.trim();
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
      }
    } catch { /* non-browser env */ }

    this.onFocus = () => {
      if (!this.hidden) {
        this.audio.setHiddenMuted(false);
        void this.audio.resumeExisting();
      }
      if (this.checkoutWaiting && this.screen === "checkout") {
        this.telemetry.track("checkout_return_focus", { sku: this.checkoutSku });
        this.hud.toast("Welcome back — confirm below if you finished paying", "info");
      }
    };
    this.onBlur = () => {
      this.audio.setHiddenMuted(true);
      void this.audio.suspend();
    };
    this.onOrientationChange = () => {
      try { window.scrollTo(0, 0); } catch { /* ignore */ }
      this.resize();
      // Mobile browsers may report the old dimensions during orientationchange.
      // Coalesce recovery passes, and never let them outlive this game instance.
      this.orientationTimers.forEach(id => window.clearTimeout(id));
      this.orientationTimers = [100, 300].map(delay => window.setTimeout(() => this.resize(), delay));
    };
    this.onFullscreenChange = () => {
      this.resize();
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      this.hud.setFullscreenActive(isFull);
    };
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("orientationchange", this.onOrientationChange);
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this.onFullscreenChange);

    // Easter egg: Konami code → 500 coins + confetti
    const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      this.konamiBuffer.push(e.key);
      if (this.konamiBuffer.length > KONAMI.length) this.konamiBuffer.shift();
      if (this.konamiBuffer.join(",") === KONAMI.join(",")) {
        this.konamiBuffer = [];
        this.hud.toast("✨ Cheat mode activated — you found the secret!", "gold");
        this.save.addCoins(500);
        if (this.state === "playing") this.particles.emitConfetti(0, 0);
      }
    });

    this.hud.onAction((action, id) => this.handleAction(action, id));
    this.onResize = () => this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    window.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("scroll", this.onResize);
    this.onVis = () => {
      if (document.hidden) {
        this.hidden = true;
        // A tab going quiet is the last chance to ask "how far did they get?".
        // One beacon: the path walked, where it stalled, how long it sat there.
        if (!this.funnelSummarySent) {
          this.funnelSummarySent = true;
          const drop = this.funnel.dropOff();
          this.telemetry.track("funnel_summary", {
            path: this.funnel.path().join(">"),
            stalledAt: drop?.stage ?? "",
            step: drop?.step ?? 0,
            stalledAfterMs: drop?.afterMs ?? 0,
            stuckForMs: drop?.stuckForMs ?? 0,
          });
        }
        // A hidden tab is not being played: stop the portal clock even when the
        // player was only browsing the menu (setState("paused") below only runs
        // mid-flight, so without this the clock would keep running forever).
        this.gameplaySink.send("stop");
        if (this.state === "playing") this.setState("paused");
        // Portal QA requirement (and basic courtesy): a hidden tab is silent.
        this.audio.setHiddenMuted(true);
        void this.audio.suspend();
      } else {
        this.hidden = false;
        this.last = performance.now();
        this.acc = 0;
        this.audio.setHiddenMuted(false);
        void this.audio.resumeExisting();
        if (isInteractive(this.state)) this.gameplaySink.send("start");
      }
    };
    document.addEventListener("visibilitychange", this.onVis);
    this.onBeforeInstall = (e) => {
      e.preventDefault();
      this.deferredInstall = e as BeforeInstallPromptEvent;
      this.bump();
    };
    this.onInstalled = () => {
      this.deferredInstall = null;
      this.bump();
    };
    window.addEventListener("beforeinstallprompt", this.onBeforeInstall);
    window.addEventListener("appinstalled", this.onInstalled);

    this.loop = (t) => this.frame(t);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);

    // First two sessions run on the starter goal table so the first reward
    // lands inside ~30 s of play instead of after a flight they cannot yet fly.
    this.goals.reset(this.today, { starter: this.save.state.runsPlayed < 2 });
    // monthly VIP really lapses — surface it once per session
    this.vipActive = this.save.isVipActive();
    if (this.save.state.vip === false && this.save.state.vipUntil > 0) this.vipExpiredNotice = true;

    const yesterday = dateSeed(new Date(Date.now() - 86400000));
    const streakReward = this.save.touchStreak(this.today, yesterday);
    const vipGift = this.save.claimVipDaily(this.today);
    window.setTimeout(() => {
      if (this.disposed) return;
      if (this.save.recoveredFromCorruption) this.hud.toast("⚠ Save couldn't be read — kept a backup, starting fresh", "warn");
      if (streakReward > 0) this.hud.toast(`Day ${this.save.state.streak.days} streak · +${streakReward} coins`, "gold");
      if (vipGift > 0) this.hud.toast(`VIP daily gift · +${vipGift} coins`, "vip");
    }, 700);
    this.telemetry.track("session_start", {
      gold: this.save.state.gold,
      vip: this.save.isVipActive(),
      runs: this.save.state.runsPlayed,
      streak: this.save.state.streak.days,
    });
    // Player Device Report (DEV-03): report the measured baseline once per
    // session so our own quality-tier decisions can be compared against the
    // platform's published distribution. Aggregate capability data only — no
    // identifiers (REQ-32).
    this.telemetry.track("device_profile", deviceProfileTelemetry(this.deviceProfile));
    // The human-readable line rides along as a `summary` field: telemetry's
    // debug channel prints it on localhost, which is where a tier surprise
    // should be noticed (the production gate forbids console.* in shipped
    // client code, so this is the sanctioned observability surface).
    this.telemetry.track("device_summary", { summary: describeDeviceProfile(this.deviceProfile) });
    // Portal SDK initialization is intentionally late: the first interactive
    // menu frame should never wait on a third-party CDN.
    void initPlatform({
      onAdOpened: () => this.beginPortalAd(),
      onAdClosed: () => this.endPortalAd(),
      onPortalMute: (muted) => this.audio.setPortalMuted(muted),
      onPause: () => {
        // Portal-side pause (in addition to visibilitychange): freeze the
        // same way a hidden tab does — paused state + silenced audio.
        if (this.state === "playing") this.setState("paused");
        this.audio.setHiddenMuted(true);
        void this.audio.suspend();
      },
      onResume: () => {
        this.last = performance.now();
        this.acc = 0;
        this.audio.setHiddenMuted(false);
        void this.audio.resumeExisting();
      },
    }).then((adapter) => {
      if (this.disposed) return;
      this.platform = adapter;
      // Level-2 playtest recordings capture whatever canvas the SDK is pointed
      // at (Poki `playtestSetCanvas`). Without this the recordings Poki sends
      // back have no gameplay in them.
      adapter.playtestSetCanvas(this.renderer.domElement);
      // Surface runtime failures in the portal's error dashboard, not only in
      // a console nobody watches on a portal.
      this.detachPortalErrorReporters = attachPortalErrorReporters(adapter);
      adapter.loadingFinished();
      adapter.signalGameReady();
      // Poki's documented startup sequence is gameLoadingFinished() →
      // gameplayStart(): the player is now looking at an interactive menu, so
      // the engaged clock starts here rather than at the first flight. The
      // sink suppresses any repeat on a later transition, so a late-landing
      // SDK can never double-start.
      if (isInteractive(this.state) && !this.hidden) this.gameplaySink.send("start");
      this.telemetry.track("portal_ready", { portal: adapter.name, caps: adapter.capabilities().join(",") });

      // Portal-native room invite (CrazyGames instant multiplayer): the
      // platform can deep-link a room through invite params instead of the
      // #room= URL hash the direct build uses.
      const portalInvite = normalizeRoomCode(adapter.getInviteParam("room") ?? "");
      if (portalInvite && !this.pendingRoomInvite) {
        this.roomCode = portalInvite;
        this.joiningRemoteRoom = true;
        this.pendingRoomInvite = portalInvite;
        this.telemetry.track("portal_invite", { code: portalInvite });
        this.hud.toast(`🕊 Invited to room ${portalInvite}`, "quest");
      }

      // Portal identity → pilot name. The portal user's handle is their
      // public name; honor it unless the player already picked their own.
      void adapter.getIdentity().then((identity) => {
        if (this.disposed || !identity?.name) return;
        if (this.save.state.pilotNameCustomized) return;
        const next = savePilotName(identity.name);
        if (!next || next === this.pilotName) return;
        this.pilotName = next;
        this.save.state.pilotName = next;
        this.save.persist();
        this.telemetry.track("portal_identity", { linked: 1 });
        this.bump();
      });

      // Portal ad banner: the host div is rendered by App for portal builds.
      if (PORTAL_BANNER_ID) {
        const host = document.getElementById(PORTAL_BANNER_ID);
        if (host) adapter.mountBanner(host);
      }
      this.bump();
    });
    if (seasonEnd) this.hud.toast(`⚔ Ranked season over · ${seasonEnd.division} reward +${seasonEnd.coins} coins`, "gold");
    // Warm the embedded main-menu leaderboard on boot so it isn't empty on
    // the first frame. EA-05: this is background work — it is queued as idle
    // work so the first interactive frame (and the boot bar's last stage) does
    // not wait on a network round trip. The board serves its cache first, so
    // arriving late costs the player nothing.
    defer("menu-board-warmup", () => this.refreshBoard());
    // EA-05: same for the music bus — the synth graph is created on the first
    // gesture anyway (autoplay policy), so priming it here is pure headroom.
    defer("audio-warmup", () => this.audio.setMusicEnabled(this.save.state.settings.music));
    // The first flyable frame is what the player is actually waiting for: the
    // world exists, the menu is interactive, and the loop is about to start.
    bootStage("flight");
    this.bump();
    this.pushHud();
    this.noteSessionStart();
    this.updateOnboarding();
    // Show name entry on first use
    if (!this.save.state.pilotNameCustomized && this.state === "menu") {
      this.setScreen("nameEntry");
      this.hud.setValue("pilotNameInput", this.pilotName);
    }
  }

  private createNetTransport(deviceId: string, pilotName: string, skinId: string): AnyRealtimeClient {
    if (POKI_MULTIPLAYER && _PokiNetlibClass) {
      return new _PokiNetlibClass(deviceId, pilotName, skinId, 0.06);
    }
    return new RealtimeClient(deviceId, pilotName, skinId, 0.06);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.watchdog.stop();
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.orientationTimers.forEach(id => window.clearTimeout(id));
    this.orientationTimers = [];
    window.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("scroll", this.onResize);
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", this.onFullscreenChange);
    document.removeEventListener("visibilitychange", this.onVis);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored);
    window.removeEventListener("beforeinstallprompt", this.onBeforeInstall);
    window.removeEventListener("appinstalled", this.onInstalled);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("orientationchange", this.onOrientationChange);
    this.detachPortalErrorReporters?.();
    this.detachPortalErrorReporters = null;
    this.wakeLock.dispose();
    this.telemetry.flush();
    this.squad?.dispose();
    this.telemetry.dispose();
    this.board.dispose();
    this.weather.dispose();
    this.net?.disconnect();
    this.massRace.dispose();
    this.finishGate.dispose();
    for (const flag of this.beatFlags) flag.dispose();
    this.beatFlags.length = 0;
    this.input.dispose();
    this.audio.dispose();
    this.hud.dispose();
    this.terrain.dispose();
    this.bird.dispose();
    this.particles.dispose();
    this.trail.dispose();
    this.fx?.dispose();
    this.sky.dispose();
    this.collect.dispose();
    this.p1?.dispose(this.scene);
    this.p2?.dispose(this.scene);
    this.p1 = null;
    this.p2 = null;
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  /* ------------------------------------------------------------------ loop */

  private frame(now: number): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    try {
    // Cap the frame delta so a backgrounded tab or a hiccup never teleports
    // physics. 0.25s (not 0.1): on low-end devices the renderer can dip below
    // 10 fps, and with a tighter cap the GAME CLOCK runs slower than real
    // time — runs take forever and timed gates drift. Physics is fixed-step
    // (PHYS_DT accumulator), so a larger delta just means more cheap substeps.
    const raw = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (this.hidden || this.contextLost) return;

    this.handleHotkeys();
    this.pumpNetwork(raw);
    this.pumpMatchmaking(raw);
    this.dayTick(raw);
    this.adaptQuality(raw);
    // A #room= invite applies once the shell is live: open the lobby already
    // seated in that room so the guest sees the host before committing.
    if (this.pendingRoomInvite && this.state === "menu") {
      const code = this.pendingRoomInvite;
      this.pendingRoomInvite = "";
      this.roomCode = code;
      this.setScreen("live");
      this.preseatLobby();
      this.hud.toast(`🎟 Invited to room ${code} — ready up together to race`, "gold");
      this.telemetry.track("room_invite_opened", { room: code });
    }
    // Club chat: light polling only while the Squad screen is on screen, and
    // only in editions that have a chat surface at all (portal builds do not —
    // Poki REQ-31). No dead network traffic, no chat endpoint in the log.
    if (SQUAD_CHAT && this.screen === "squad" && (this.state === "menu" || this.state === "gameover") && this.squad?.live) {
      this.squadPoll += raw;
      if (this.squadPoll >= 4) {
        this.squadPoll = 0;
        void this.squad.pollChat(false);
      }
    }
    // Hit stop: freeze time for cinematic impact on perfect launches.
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= raw;
      this.elapsed += raw;
      this.input.pollGamepads();
      this.render(raw, raw);
      this.pushHud();
      return;
    }
    if (this.resetArmed) {
      this.resetTimer -= raw;
      if (this.resetTimer <= 0) {
        this.resetArmed = false;
        this.bump();
      }
    }

    if (this.zenithTimer > 0) {
      this.zenithTimer -= raw;
      if (this.zenithTimer <= 0) this.timeScale = 1;
    }
    const simDt = raw * this.timeScale;

    // Snapshot before any physics advances so the render can interpolate.
    this.prevBirdX = this.bird.x;
    this.prevBirdY = this.bird.y;

    switch (this.state) {
      case "menu":
        this.menuTick(raw);
        break;
      case "playing":
        if (this.countdown > 0) {
          const before = Math.ceil(this.countdown - 1);
          this.countdown = this.networkStartAt > 0 ? Math.max(0, (this.networkStartAt - Date.now()) / 1000) : this.countdown - raw;
          const after = Math.ceil(this.countdown - 1);
          if (after !== before) this.audio.chirp();
          if (this.countdown <= 0) this.audio.island();
          break;
        }
        this.acc += simDt;
        while (this.acc >= PHYS_DT && this.state === "playing") {
          if (this.versus) this.versusTick(PHYS_DT);
          else this.fixedUpdate(PHYS_DT);
          this.acc -= PHYS_DT;
        }
        break;
      case "continue":
        this.acc += raw;
        while (this.acc >= PHYS_DT) {
          this.bird.step(PHYS_DT, ASLEEP, this.terrain);
          this.acc -= PHYS_DT;
        }
        this.continueTimer -= raw;
        if (this.continueTimer <= 0) this.finishRun();
        break;
      case "ad":
        this.adTimer -= raw;
        break;
      case "gameover":
        this.acc += raw;
        while (this.acc >= PHYS_DT) {
          this.bird.step(PHYS_DT, ASLEEP, this.terrain);
          this.acc -= PHYS_DT;
        }
        if (this.screen === "main") this.holdToStart(raw, 0.12);
        break;
      default:
        break;
    }

    this.elapsed += raw;
    if (this.launchBannerT > 0) this.launchBannerT = Math.max(0, this.launchBannerT - raw);
    if (this.goalPopT > 0) {
      this.goalPopT = Math.max(0, this.goalPopT - raw);
      if (this.goalPopT === 0) {
        // The pill is free: hand it to the next moment earned while it was busy,
        // so nothing the player did goes unreported.
        const next = this.popQueue.shift();
        if (next) {
          this.goalPop = next.text;
          this.goalPopKind = next.kind;
          this.goalPopT = 2.6;
        }
        this.bump();
      }
    }
    if (this.rankUpT > 0) {
      this.rankUpT = Math.max(0, this.rankUpT - raw);
      if (this.rankUpT === 0) {
        const next = this.bannerQueue.shift();
        if (next) {
          this.rankUp = next.text;
          this.rankUpKind = next.kind;
          this.rankUpT = 2.6;
        }
        this.bump();
      }
    }
    this.input.pollGamepads();
    this.render(simDt, raw);
    this.pushHud();
    } catch (err) {
      console.error("Sunbird frame error:", err);
      // The loop must never die from a single bad frame, but a repeat offender
      // is worth knowing about. Report the message only (no stack — that can
      // carry device/URL fingerprints) through the existing telemetry bus, at
      // most once a minute so a stuck frame can't flood the beacon.
      const now = performance.now();
      if (now - this.frameErrAt > 60_000) {
        this.frameErrAt = now;
        this.telemetry.track("frame_error", { message: String(err instanceof Error ? err.message : err).slice(0, 120) });
      }
    }
  }

  private menuTick(dt: number): void {
    // Attract mode: fly the actual game behind the menu. Same fixed-step
    // contract as a run, but the pilot holds the button and nothing outside
    // the scene (no score, audio, saves, telemetry) can hear it.
    const calm = this.save.state.settings.reduceMotion;
    if (calm) {
      // Reduced motion: static perched bird, like the old painted backdrop.
      const h = this.terrain.heightAt(this.startX);
      this.bird.x = this.startX;
      this.bird.y = h + BIRD_RADIUS;
      this.bird.vx = 6;
      this.bird.vy = 0;
      this.bird.grounded = true;
      this.bird.rotation = Math.atan(this.terrain.slopeAt(this.startX));
      if (this.screen === "main") this.holdToStart(dt, 0.18);
      return;
    }
    this.demoTime += dt;
    this.demoAcc = Math.min(this.demoAcc + dt, 0.25);
    let n = 0;
    while (this.demoAcc >= PHYS_DT && n < 12) {
      const hold = this.attractPilot.update(PHYS_DT, this.bird, this.terrain);
      this.bird.step(PHYS_DT, { diving: hold, fever: false, speedMult: 1, boost: false }, this.terrain);
      if (this.bird.justLanded && !calm && this.bird.impact > 5) {
        this.particles.emitDust(
          this.bird.x,
          this.terrain.heightAt(this.bird.x) + 0.3,
          this.bird.speed(),
          this.terrain.slopeAt(this.bird.x),
        );
      }
      this.demoAcc -= PHYS_DT;
      n++;
    }
    if (!calm && this.bird.speed() > 48) this.emitTrail(dt);
    // Watchdog: beached, stalled or flown off-screen → silent loop restart
    // on the same island (resetRun pops nothing, banks nothing). Open water
    // counts double: a drowning bird is never good backdrop, cut in ~1.5 s.
    // (Needed because a swimming bird keeps speed ~9 and would otherwise
    // bob past the stall trip and never trigger it.)
    if (this.bird.speed() < 9 || this.bird.inWater) this.demoStuck += dt * (this.bird.inWater ? 2 : 1);
    else this.demoStuck = 0;
    if (this.demoTime > 90 || this.demoStuck > 3 || this.bird.x - this.startX > 4000) {
      this.resetRun(true);
      this.demoAcc = 0;
      this.demoTime = 0;
      this.demoStuck = 0;
    }
    if (this.screen === "main") this.holdToStart(dt, 0.18);
  }

  private holdToStart(dt: number, threshold: number): void {
    if (this.input.diving) {
      if (this.needRelease) return;
      this.menuHold += dt;
      if (this.menuHold >= Math.min(threshold, 0.05)) {
        if (this.state === "gameover") this.replayRun(true);
        else this.startRun();
      }
    } else {
      if (this.menuHold > 0 && !this.needRelease) {
        if (this.state === "gameover") this.replayRun(true);
        else this.startRun();
      }
      this.needRelease = false;
      this.menuHold = 0;
    }
  }

  private fixedUpdate(dt: number): void {
    // Ranked races keep every pilot's flight model identical. Your equipped
    // bird remains visible, but store perks never decide a competitive result.
    const skin = this.gameplaySkin;
    const diving = this.input.diving && !this.bird.asleep;
    if (diving && !this.wasDiving && !this.bird.grounded && this.state === "playing") {
      this.audio.diveCue();
      this.haptic(10);
    }
    this.wasDiving = diving;
    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.manualBoostCooldown = Math.max(0, this.manualBoostCooldown - dt);
    this.runTime += dt;
    // Hour roll resets the shop ad reward counter (cap per wall-clock hour).
    const nowHour = Math.floor(Date.now() / 3_600_000);
    if (nowHour !== this.adHourKey) { this.adHourKey = nowHour; this.shopAdClaimed = 0; }
    this.xpFlush -= dt;
    if (this.xpFlush <= 0) {
      this.xpFlush = 2;
      this.flushXp();
    }

    this.powers.tick(dt);
    this.launch.tick(dt);
    this.launch.observeInput(diving, this.runTime);

    // Touch-first power activation: a quick double tap triggers a short
    // momentum burst. It is deliberately cooldown-gated and additive, so the
    // hill timing remains the skill expression. A stalled bird can also use
    // the same rescue burst once the cooldown is clear.
    if (!this.fairRace && this.save.hasUpgrade("doubletap") && this.save.state.settings.doubleTapBoost && this.input.consumeBoost() && this.manualBoostCooldown <= 0) this.activateManualBoost("double_tap");
    // PANIC: a grounded bird bleeding speed is the most anxious beat a run has.
    // Tallied and buzzed for even when no rescue boost is owned - that is
    // exactly the flight the results card should be able to talk about, and the
    // shared throttle keeps it off every physics frame.
    if (this.bird.grounded && this.bird.speed() < STALL_SPEED && this.runTime > 1.5 && this.bird.x - this.startX > 40) {
      this.fireMoment("panic", { popup: false });
    }
    if (!this.fairRace && this.save.hasUpgrade("doubletap") && this.save.state.settings.doubleTapBoost && this.bird.grounded && this.bird.speed() < STALL_SPEED && this.manualBoostCooldown <= 0 && this.runTime > 1.2) {
      this.activateManualBoost("stall_rescue");
    }

    this.bird.step(
      dt,
      {
        diving,
        fever: this.feverOn,
        speedMult: skin.speedMult * this.challengeMods.speedMult * this.escalateMult(),
        boost: this.boostTimer > 0 || this.powers.boostOn(),
        liftMult: this.powers.liftMult() * this.masteryPerk.liftMult,
        // Slipstream: tucking behind a rival genuinely reduces your drag.
        dragMult: this.powers.dragMult() * this.massRace.draftFor(this.bird.x, this.bird.y, dt),
        feather: this.powers.featherOn(),
        gravityMult: this.eventRun ? this.weeklyMods.gravityMult : 1,
      },
      this.terrain,
    );

    const cue = this.flightCues.update(dt, this.bird, this.terrain.islandIndex(this.bird.x), this.terrain.localX(this.bird.x));
    if (cue === "runup") this.audio.runup();
    else if (cue === "apex") this.audio.apexChime();
    if (this.bird.justLaunched) this.onLaunch();
    if (this.bird.bounced) {
      this.bird.bounced = false;
      this.onSunflower();
    }

    // First-flight coach: verify dive -> launch -> soar with real play signals.
    if (this.coach && !this.coach.done) {
      this.coach.update(dt, {
        diving,
        grounded: this.bird.grounded,
        slope: this.terrain.slopeAt(this.bird.x),
        justLaunched: this.bird.justLaunched,
        airborne: !this.bird.grounded,
      });
      if (this.coach.done) {
        this.save.state.firstFlightDone = true;
        const firstFlightCoins = 50;
        this.save.addCoins(firstFlightCoins);
        this.save.persist();
        this.hud.toast(t("hud.toast.firstFlight", { n: firstFlightCoins }, "🕊 First flight complete · +{{n}} coins — the sky is yours"), "gold");
        this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
      }
    }
    if (this.bird.justLanded) this.onLanding();

    this.ghostRecorder.sample(dt, this.runTime, this.bird.x, this.bird.y, this.bird.rotation);
    if (this.rivalGhostPlayer.active) {
      const rx = this.rivalGhostPlayer.update(this.runTime, dt);
      if (rx !== null && !this.rivalGhostPassed && this.bird.x > rx + 0.5 && this.runTime > 4) {
        this.rivalGhostPassed = true;
        this.hud.toast(
          this.rivalGhostSynthetic
            ? `👻 Pace beaten — you are ahead of the ${this.rivalGhostName.replace("Pace · ", "")} line`
            : `👻 Passed ${this.rivalGhostName}'s flight!`,
          "gold",
        );
        this.audio.ding();
        this.bonus += 60;
      }
    }
    if (this.ghostPlayer.active) {
      const gx = this.ghostPlayer.update(this.runTime, dt);
      if (gx !== null) {
        const ahead = this.bird.x > gx + 0.5;
        if (!ahead) this.ghostWasAhead = true;
        if (ahead && this.ghostWasAhead && !this.ghostPassed && this.runTime > 4) {
          this.ghostPassed = true;
          this.save.addGhostBeat();
          for (const trophy of this.achievements.checkNew()) {
            // Announced now (the flight is still live) and again on the card, so
            // a trophy unlocked behind a hill is not lost when the run ends.
            this.progressEvents.push({ kind: "trophy", id: trophy.id, title: trophy.title, rarity: trophy.rarity });
            this.hud.toast(t("hud.toast.trophy", { title: trophy.title }, "Trophy: {{title}}"), "gold");
            this.portalAchievement(trophy.id);
          }
          this.hud.toast(t("toast.ghost.passed", undefined, "Passed your ghost! 👻"), "quest");
          this.audio.ding();
          this.bonus += 30;
          this.awardXp(XP_RULES.ghostBeat);
          this.bump();
        }
      }
    }

    // biome weather: thermals, headwinds, ash storms
    this.weather.update(dt, this.elapsed, this.bird, this.terrain, diving, {
      onThermalEnter: () => {
        this.audio.thermal();
        // Once per run: after the first call-out the ♨ HUD chip carries the
        // message — toasting every thermal doubled the same text on screen.
        if (!this.thermalToasted && this.hintTimer < 40) {
          this.thermalToasted = true;
          this.hud.toast(t("hud.toast.thermal", undefined, "Thermal — release to ride it"), "power");
        }
      },
      onGustStart: () => {
        this.audio.gust();
        this.audio.duckMusic(0.2, 0.8);
      },
      onStormHit: (x, y) => {
        this.audio.storm();
        this.particles.emitAsh(x, y);
        this.shake(0.6);
        this.haptic([15, 10, 15, 10, 30]);
        this.hud.toast("Ash cloud!", "warn");
        this.perfectChain = 0;
      },
    });
    if (this.weather.inThermal) {
      this.thermalEmitAcc += dt;
      if (this.thermalEmitAcc > 0.03) {
        this.thermalEmitAcc = 0;
        this.particles.emitThermal(this.bird.x, this.bird.y - 4, 10);
      }
    }
    if (this.weather.gust > 0.3) {
      this.windEmitAcc += dt * this.weather.gust;
      if (this.windEmitAcc > 0.04) {
        this.windEmitAcc = 0;
        this.particles.emitWind(this.bird.x, this.bird.y, this.weather.gust);
      }
    }

    // The rival field runs the same fixed-step contract as the player.
    if (this.massRace.active) {
      this.massRace.step(dt, this.terrain, this.startX + this.mode.finish, this.runTime, this.bird.x, this.bird.y);
      // Reward the player for holding a draft: visible, audible, scoring.
      if (this.massRace.draft > 0.3) {
        if (!this.wasDrafting) {
          this.wasDrafting = true;
          this.audio.diveCue();
          this.haptic([10, 15, 20]);
          this.popupAtBird("SLIPSTREAM", "power");
        }
        this.draftBanner = Math.min(1, this.draftBanner + dt * 2);
        this.bonus += 14 * dt * this.massRace.draft;
        if (this.draftBanner > 0.98) {
          this.draftBanner = 0;
          this.particles.emitWind(this.bird.x, this.bird.y, 0.8);
        }
      } else {
        if (this.wasDrafting && this.massRace.draft < 0.12) {
          this.wasDrafting = false;
          if (this.bird.speed() > 18) {
            this.audio.chirp();
            this.haptic([15, 10, 25]);
            this.popupAtBird("SLINGSHOT! 🚀", "perfect");
            this.bird.vx = Math.min(234, this.bird.vx + 6);
            this.particles.emitWind(this.bird.x, this.bird.y + 0.5, 1.6);
          }
        }
        this.draftBanner = Math.max(0, this.draftBanner - dt);
      }
      // Wingtip buzz near-miss feedback
      this.closeCallAcc += dt;
      if (this.closeCallAcc >= 0.35 && !this.bird.asleep) {
        const close = this.massRace.checkCloseCall(this.bird.x, this.bird.y, this.bird.speed());
        if (close) {
          this.closeCallAcc = 0;
          this.audio.chirp();
          this.haptic(10);
          this.popupAtBird("WINGTIP BUZZ! +50", "splash");
          this.bonus += 50;
          this.particles.emitWind(this.bird.x, this.bird.y, 0.9);
        }
      }

      // Typhoon blitz storm tailwinds
      if (this.modeId === "pvp_typhoon" && !this.bird.asleep && !this.bird.grounded) {
        this.bird.vx = Math.min(235, this.bird.vx + dt * 4.0);
      }

      // Sky Slalom launch surge
      if (this.modeId === "pvp_slalom" && this.bird.justLaunched && this.lastLaunch?.rating === "perfect") {
        this.bird.vx = Math.min(240, this.bird.vx + 6.5);
        this.popupAtBird("WARP SLALOM! ⚡", "fever");
        this.particles.emitWind(this.bird.x, this.bird.y, 1.4);
      }

      // Stratosphere ascent thermal super-lift
      if (this.modeId === "pvp_zenith" && this.weather.inThermal) {
        this.bird.vy = Math.min(180, this.bird.vy + dt * 25);
      }

      // Knockout mode elimination evaluation
      if (this.modeId === "pvp_knockout" && !this.bird.asleep) {
        const dist = this.bird.x - this.startX;
        if (this.nextKnockoutDist <= 3500) {
          if (dist >= this.nextKnockoutDist - 60 && dist < this.nextKnockoutDist - 15) {
            if (!this.knockoutWarned) {
              this.knockoutWarned = true;
              this.hud.toast(`⚠️ ELIMINATION IN ${Math.round(this.nextKnockoutDist - dist)}m — OUTFLY THE PACK!`, "warn");
              this.audio.chirp();
              this.haptic([15, 15, 30]);
            }
          }
          if (dist >= this.nextKnockoutDist) {
            this.knockoutWarned = false;
            const targetDist = this.nextKnockoutDist;
            this.nextKnockoutDist += 500;
            const standings = this.massRace.standings(this.bird.x, this.startX, this.pilotName, 40);
            if (standings.place === standings.total) {
              this.hud.toast(`💥 ELIMINATED at ${targetDist}m!`, "warn");
              this.audio.rivalDown();
              this.finishRun();
            } else {
            const victim = this.massRace.eliminateTrailing(targetDist);
            if (victim) {
              const remaining = standings.total - 1;
              if (remaining === 1 && standings.place === 1) {
                this.racePlace = 1;
                this.raceField = standings.total;
                this.raceFinishTime = this.runTime;
                this.save.noteRacePlace(1, standings.total);
                this.hud.toast(`👑 ROYALE VICTORY! SOLE SURVIVOR!`, "gold");
                this.audio.fanfare();
                this.finishRun();
              } else {
                this.hud.toast(`💥 ELIMINATED: ${victim.name}! ${remaining} remain`, "gold");
                this.audio.ding();
                this.haptic(10);
              }
            }
            }
          }
        }
      }
      // Overtake / lead-change feedback, sampled at ~4 Hz so the 41-row
      // sort never runs per physics tick.
      this.overtakeAcc += dt;
      if (this.overtakeAcc >= 0.25 && !this.bird.asleep) {
        this.overtakeAcc = 0;
        const place = this.massRace.standings(this.bird.x, this.startX, this.pilotName, 8).place;
        if (this.lastPlace > 0 && place > 0 && place < this.lastPlace) {
          const gain = this.lastPlace - place;
          if (flag("clipWorthy")) {
            const first = this.clips.isFirstEver("overtake");
            this.clips.record("overtake");
            if (first) {
              this.telemetry.track("clip_moment", viralEventProps("clip_moment", { kind: "overtake", mode: this.modeId }));
              this.platform?.happyTime(clipHappyTime("overtake"));
              this.camera.pulseClip(clipShotFor("overtake"), Math.min(1.2, this.bird.speed() / MAX_SPEED), this.bird.altitude);
            }
          }
          this.hud.toast(place === 1 ? "👑 LEAD! Hold it!" : `P${this.lastPlace} → P${place}!`, "gold");
          if (place === 1) {
            this.flash("perfect");
            this.popupAtBird("👑 P1 LEAD!", "fever");
            this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
            this.audio.purchase();
            this.haptic([25, 15, 45]);
            if (this.elapsed - this.lastEmoteRunAt >= 2.0) {
              this.lastEmoteRunAt = this.elapsed;
              this.sendEmote("👑");
            }
          } else if (gain >= 3) {
            this.audio.ding();
            this.haptic(10);
            this.popupAtBird(`P${this.lastPlace} → P${place}`, "great");
          } else {
            this.audio.ding();
            this.haptic(8);
          }
        }
        this.lastPlace = place;
      }
    }

    const biomeNow = this.terrain.biomeAt(this.bird.x);
    if (biomeNow.id !== this.lastBiomeId) {
      this.lastBiomeId = biomeNow.id;
      if (this.save.markBiomeSeen(biomeNow.id)) this.hud.toast(`New shores charted: ${biomeNow.name}`, "island");
    }

    if (this.bird.inWater && this.shield > 0) {
      this.shield -= 1;
      this.bird.y = WATER_Y + 1.2;
      this.bird.vy = 30;
      this.bird.vx = Math.max(this.bird.vx, 34);
      this.bird.inWater = false;
      this.bird.grounded = false;
      this.particles.emitWaterBounce(this.bird.x, WATER_Y);
      this.audio.shield();
      this.hud.toast("Shield bounce!", "power");
      this.bounceCount += 1;
      this.fireMoment("boing", { shout: quip(BOP_QUIPS, this.bounceCount), always: true });
      this.shake(0.6);
      this.haptic([15, 10, 15, 10, 30]);
    }

    const slope = this.terrain.slopeAt(this.bird.x);

    this.checkZenith();
    if (this.bird.justLanded) {
      if (this.bird.impact > 5) {
        this.audio.land(this.bird.impact);
        this.shake(Math.min(0.55, this.bird.impact * 0.04));
        // Make hard contact read at a glance on small screens: the impact
        // burst is larger and higher contrast than a dust puff.
        if (this.bird.impact > 8) {
          const ridge = this.terrain.biomeAt(this.bird.x).ridge;
          this.particles.emitThunk(this.bird.x, this.bird.y, ((ridge >> 16) & 255) / 255, ((ridge >> 8) & 255) / 255, (ridge & 255) / 255);
          // BONK: hard contact with the world. Shout it - a hit the player only
          // hears is a hit they will blame the game for.
          this.fireMoment("bonk", { shout: "BONK!" });
        } else {
          this.particles.emitDust(this.bird.x, this.bird.y, this.bird.speed(), slope);
        }
      } else if (this.bird.landingQuality < LAND_PERFECT && this.bird.impact < 2.4 && this.bird.speed() > 36 && diving && slope < -0.05) {
        // tangential touchdown at speed on a downslope: reward the finesse
        const butterBonus = 10;
        this.bonus += butterBonus;
        this.audio.butter();
        this.hud.toast(t("hud.toast.butterLanding", { n: butterBonus }, "Butter landing +{{n}}"), "cloud");
        this.particles.burstRing(this.bird.x, this.bird.y, 0xffffff);
      }
    }
    this.dustCooldown = Math.max(0, this.dustCooldown - dt);
    if (this.bird.grounded && this.bird.speed() > 10 && this.dustCooldown <= 1e-6) {
      this.dustCooldown = 1 / 30;
      this.particles.emitDust(this.bird.x, this.terrain.heightAt(this.bird.x) + 0.3, this.bird.speed(), slope);
    }

    // Ridge skim: airborne, fast, and hugging the hill — flow-state bonus.
    this.skimCd = Math.max(0, this.skimCd - dt);
    const skimCeil = 3.2 + this.difficultyTune.ridgeForgiveness;
    const skimming =
      !this.bird.grounded &&
      !this.bird.inWater &&
      this.bird.altitude > 0.4 &&
      this.bird.altitude < skimCeil &&
      this.bird.speed() > 40;
    if (skimming) {
      this.skimTime += dt;
      if (this.skimTime > 1.1 && this.skimCd <= 0) {
        this.skimCd = 1.4;
        const pts = 15;
        this.bonus += pts;
        this.awardXp(XP_RULES.coin);
        this.audio.ridgeSkim();
        // PHEW: skimming a ridge at speed is the run's "that close" beat. The
        // bespoke popup and audio stay; the ledger gets the moment.
        this.fireMoment("phew", { popup: false });
        this.popupAtBird("RIDGE SKIM! +15", "power");
        this.hud.toast(t("hud.toast.ridgeSkim", { n: pts }, "Ridge skim +{{n}}"), "cloud");
        this.particles.emitDust(this.bird.x, this.terrain.heightAt(this.bird.x) + 0.4, this.bird.speed(), slope);
      }
    } else if (this.bird.altitude > 6 || this.bird.grounded) {
      this.skimTime = 0;
    }

    // WEE: warp speed while diving. Every other moment in the ledger is a
    // collision with the world; this one is the world falling away, and it is
    // the beat that tells the player the fast line they just found was the
    // point of the game. SpeedFeel owns the hysteresis (fire once per
    // acceleration, re-arm below the rush band) and `momentShouldReact` inside
    // fireMoment owns the repeat gap, so a chaotic flight cannot turn it into
    // a machine gun.
    const spd = this.bird.speed();
    const speedNorm = Math.min(1.2, spd / MAX_SPEED);
    // Peak speed is the one number that says whether a flight *felt* fast, so
    // it rides along on run_end instead of needing its own event.
    if (spd > this.speedPeak) this.speedPeak = spd;
    const wee = weeCheck(this.weeState, speedNorm, this.bird.vy);
    this.weeState = wee.state;
    if (wee.fire) this.fireMoment("wee");
    if (this.feverOn || this.boostTimer > 0 || this.bird.speed() > 48 || ((this.gameplaySkin.magnetAlways || this.gameplaySkin.id === "aurora") && this.bird.speed() > 24)) {
      this.emitTrail(dt);
    }

    // Ambient particles for whatever power-up is currently in effect.
    this.powerFxAcc -= dt;
    if (this.powerFxAcc <= 0) {
      this.powerFxAcc = 0.05;
      this.emitPowerFx();
    }

    this.splashCd -= dt;
    // Ocean entry gets the full thunk treatment — spray ring, freeze, kick —
    // then the swim itself is just the periodic bob below.
    const wet = this.bird.inWater;
    if (wet && !this.wasInWater) {
      this.particles.emitSplash(this.bird.x, WATER_Y);
      this.particles.burstRing(this.bird.x, WATER_Y + 1, 0xafe8ff);
      this.audio.splash();
      this.fireMoment("splash", { shout: "SPLOSH!", always: true });
      if (!this.save.state.settings.reduceMotion) {
        this.hitStopTimer = Math.max(this.hitStopTimer, 0.06);
        this.shake(0.7);
      }
    }
    this.wasInWater = wet;
    if (wet && this.splashCd <= 0) {
      this.splashCd = 0.55;
      this.particles.emitSplash(this.bird.x, WATER_Y);
      this.audio.splash();
      this.shake(0.45);
      this.daylight = Math.max(0, this.daylight - DAYLIGHT_OCEAN_PENALTY);
      this.splashQuipN += 1;
      this.fireMoment("splash", { popup: false });
      if (this.splashQuipN % 3 === 1) this.hud.toast(quip(SPLASH_QUIPS, this.splashQuipN), "cloud");
    }

    // Rare delight: golden geese, sneezes, encores. Never punishing. Rolled on
    // the run seed so the same hills yield the same surprises (and a race or
    // daily challenge is never decided by cosmic RNG the field can't share).
    const surprise = this.surprises.tick(
      dt,
      this.bird.x - this.startX,
      !this.bird.grounded && !this.bird.inWater && !this.bird.asleep,
      () => this.surpriseRng.next(),
    );
    if (surprise) {
      this.hud.toast(surprise.toast, "gold");
      switch (surprise.kind) {
        case "golden-goose":
          this.audio.honk();
          this.particles.emitConfetti(this.bird.x + 6, this.bird.y + 4);
          break;
        case "tailwind":
          this.audio.slideWhistle();
          this.bird.vx += 9;
          this.particles.emitWind(this.bird.x, this.bird.y, 1);
          break;
        case "sneeze":
          this.audio.sneeze();
          this.shake(0.3);
          this.particles.emitDust(this.bird.x, this.bird.y, this.bird.speed(), 0);
          break;
        case "coin-comet":
          this.audio.fanfare();
          this.particles.emitConfetti(this.bird.x + 10, this.bird.y + 8);
          break;
        case "photobomb":
          this.audio.boing();
          this.particles.emitSplash(this.bird.x + 4, WATER_Y);
          break;
        case "encore":
          this.audio.fanfare();
          this.enterFever();
          this.feverTimer = Math.max(this.feverTimer, surprise.feverSeconds);
          break;
        case "moonbow":
          // A shimmering arc overhead: glissando + a burst of colour above
          // the bird. Pure delight — no coins, no strings attached.
          this.audio.triggerViralGlissando();
          this.particles.emitConfetti(this.bird.x, this.bird.y - 14);
          break;
        case "flock-chorus":
          // A V-formation honks past downwind: a gust, honks, and a tip.
          this.audio.honk();
          this.audio.slideWhistle();
          this.particles.emitWind(this.bird.x - 8, this.bird.y, 0.6);
          break;
      }
      if (surprise.coins > 0) {
        // Banked once, at the end of the flight, like every other coin this run
        // earns. This used to also call `save.addCoins()` on the spot, which
        // paid every surprise twice: once live and again through `recordRun`.
        this.addRunCoins(surprise.coins);
      }
      this.telemetry.track("surprise", { kind: surprise.kind });
    }

    const idx = this.terrain.islandIndex(this.bird.x);
    if (idx > this.lastIsland) {
      this.lastIsland = idx;
      this.island = idx;
      const airborne = this.bird.y > WATER_Y + 2 && !this.bird.inWater;
      const b = biomeForIsland(idx);
      if (airborne) {
        this.daylight = Math.min(this.daylightMax(), this.daylight + DAYLIGHT_ISLAND_REFILL);
        this.particles.emitConfetti(this.bird.x, this.bird.y + 4);
        this.audio.island();
        this.audio.duckMusic(0.5, 0.6);
        this.hud.toast(`${b.emoji} ${b.name}`, "island");
        this.flash("island");
        this.glow(0.75);
        this.shake(0.7);
        this.haptic([40, 20, 60]);
        this.bonus += 80 * idx;
        this.awardXp(XP_RULES.island);
      } else {
        this.hud.toast(`Washed ashore on ${b.name}`, "warn");
      }
    }

    const magnetOn = this.feverOn || this.magnetTimer > 0 || this.gameplaySkin.magnetAlways || this.powers.magnetOn();
    this.collect.update(dt, this.bird, this.terrain, magnetOn, this.elapsed, this.powers.magnetScale() * (1 + this.difficultyTune.magnetBonus), {
      onCoin: (x, y, gem) => {
        const base = gem ? 5 : 1;
        const value = Math.round(
          base *
            (this.save.state.gold ? 2 : 1) *
            this.powers.coinMult() *
            (this.mode.id === "coinrush" ? 2 : 1) *
            this.challengeMods.coinMult *
            this.masteryPerk.coinMult *
            (this.eventRun ? this.weeklyMods.coinMult : 1) *
            (this.goldenHour ? 2 : 1) *
            (this.stormfront && this.stormPhase >= 3 ? 2 : 1),
        );
        const awarded = this.addRunCoins(value);
        this.bonus += 4 * COIN_VALUE * awarded;
        if (this.modeId === "pvp_coinrush") {
          this.bird.vx = Math.min(225, this.bird.vx + 2.5);
          this.popupAtBird("COIN TURBO! ⚡", "splash");
        }
        this.awardXp(XP_RULES.coin);
        this.audio.ding(gem);
        this.particles.emitCollect(x, y);
        if (gem) {
          this.runGems += 1;
          this.particles.burstRing(x, y, 0x9ae8ff);
          this.particles.emitSonicBoom(x, y);
          this.glow(0.8);
          this.hud.toast(t("hud.toast.skyGem", { n: value }, "Sky gem +{{n}}"), "gold");
          if (this.runGems % 2 === 1) this.hud.toast(quip(GEM_QUIPS, this.runGems), "gold");
        }
        this.haptic(8);
      },
      onCloud: (kind, x, y) => this.onCloud(kind, x, y),
      onPickup: (kind, x, y) => this.onPickup(kind, x, y),
      onRing: (x, y) => this.onRing(x, y),
      onBalloon: (x, y) => this.onBalloon(x, y),
    });

    // Ring chain cools off if the player eases off the sky line.
    if (this.ringChainTimer > 0) {
      this.ringChainTimer -= dt;
      if (this.ringChainTimer <= 0) this.ringChain = 0;
    }

    if (this.feverOn) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) {
        this.feverOn = false;
        this.perfectChain = 0;
        this.audio.setMusicMode("play");
      }
    }

    this.scoreAccum += Math.max(0, this.bird.vx) * dt * (this.feverOn ? 2 : 1);
    if (this.bird.altitude > this.maxAltitude) {
      this.maxAltitude = this.bird.altitude;
      // Celebrate a mid-run record crossing exactly once, but never persist
      // here — during a sustained climb this runs every physics step, and a
      // synchronous localStorage write per step stalls the frame. finishRun()
      // banks the real record with a single persist.
      if (this.maxAltitude > this.save.state.bestAltitude && this.save.state.bestAltitude > 40 && this.recordBanner !== "altitude") {
        this.recordBanner = "altitude";
        this.fireMoment("record", { popup: false, toast: "👑 NEW ALTITUDE RECORD", always: true });
        this.flash("perfect");
      }
    }
    if (this.bird.speed() > this.maxSpeed) this.maxSpeed = this.bird.speed();

    // Distance milestones: a small rising chime every 500 m keeps long runs
    // punctuated even when nothing else is happening.
    const runDist = this.bird.x - this.startX;
    if (runDist >= this.nextMilestone) {
      this.nextMilestone += 500;
      this.audio.milestone();
      this.particles.emitSparkle(this.bird.x, this.bird.y);
      // Every 1,000 m the sky heckles you — a wink to keep long runs fresh.
      if (this.nextMilestone % 1000 === 0) {
        this.hud.toast(quip(MILESTONE_QUIPS, this.nextMilestone), "cloud");
        this.glow(0.25);
      }
    }
    // Personal-best crossing: the single most addictive moment in the loop.
    // Fire it once, mid-run, the instant you pass your old distance record —
    // "beat your high score" is a feeling, not a post-run footnote.
    if (!this.distanceRecordCrossed && this.bestAtStart > 0 && runDist > this.bestAtStart) {
      this.distanceRecordCrossed = true;
      this.audio.fanfare();
      this.fireMoment("record", { popup: false, always: true });
      this.hud.toast(t("hud.toast.newRecord", undefined, "👑 NEW DISTANCE RECORD — keep flying!"), "gold");
      this.flash("perfect");
      this.particles.emitConfetti(this.bird.x, this.bird.y + 4);
      this.glow(0.9);
      this.haptic([40, 30, 60]);
      this.telemetry.track("record_crossed", { at: Math.round(runDist) });
    }
    // STORMFRONT ESCALATION — the flagship hook: the storm is a character
    // with three acts. Same seed, same acts, for every pilot in the field.
    if (this.stormfront) {
      if (this.stormPhase === 1 && runDist >= 1000) {
        this.stormPhase = 2;
        this.weather.windMult *= 1.25;
        this.audio.storm();
        this.shake(0.5);
        this.hud.toast("⛈ PHASE II — the storm tightens. Wind +25%", "warn");
      } else if (this.stormPhase === 2 && runDist >= 2200) {
        this.stormPhase = 3;
        this.weather.windMult *= 1.25;
        this.audio.storm();
        this.shake(0.8);
        this.camera.punch(2);
        this.hud.toast("🌀 EYE WALL — survive to the line. Coins ×2 from here", "warn");
      }
    }
    // The moment you pass a rival's posted mark, gloat immediately — don't
    // make the player wait for the results screen to feel it.
    if (this.rival && !this.rivalBeatenToast && this.seed === this.rival.seed && runDist >= this.rival.distance) {
      this.rivalBeatenToast = true;
      this.audio.rivalDown();
      this.hud.toast(
        t("toast.rival.passed", { name: this.rival.name }, "🥊 Passed {name}'s mark — keep flying!"),
        "gold",
      );
    }

    // Finish line (Race / Mass Race) — reached by distance, not by clock.
    if (this.mode.finish > 0 && !this.runRecorded && this.bird.x - this.startX >= this.mode.finish) {
      this.runOutcome = "complete";
      if (this.massRace.active) {
        // Placing is decided by who has actually crossed, not by a script.
        const s = this.massRace.standings(this.bird.x, this.startX, this.pilotName, 8);
        this.racePlace = s.place;
        this.raceField = s.total;
        this.raceFinishTime = this.runTime;
        const better = this.save.noteRacePlace(s.place, s.total);
        this.net?.sendFinish(this.runTime, this.bird.x - this.startX);

        // Photo finish: name the pilot within a wing-length of you at the line.
        const you = s.rows.find((r) => r.you);
        const rival = s.rows
          .filter((r) => !r.you)
          .sort((a, b) => Math.abs(a.distance - (you?.distance ?? 0)) - Math.abs(b.distance - (you?.distance ?? 0)))[0];
        if (rival && you && Math.abs(rival.distance - you.distance) < 25) {
          const won = you.distance > rival.distance;
          if (flag("clipWorthy")) {
            this.clips.record("last_second");
            this.telemetry.track("clip_moment", viralEventProps("clip_moment", { kind: "last_second", mode: this.modeId }));
            this.platform?.happyTime(clipHappyTime("last_second"));
            this.camera.pulseClip(clipShotFor("last_second"), Math.min(1.2, this.bird.speed() / MAX_SPEED), this.bird.altitude);
          }
          this.photoFinish = photoFinishMessage(won, rival.name, Math.abs(rival.distance - you.distance));
          if (!won) this.nemesis = rival.name;
          this.hud.toast(this.photoFinish, won ? "gold" : "warn");
          this.flash("perfect");
          if (won) {
            this.popupAtBird("PHOTO FINISH WIN!", "fever");
            this.haptic([30, 20, 50, 20, 80]);
          }
        } else if (s.place > 1) {
          const ahead = s.rows.find((r) => r.place === s.place - 1);
          if (ahead) this.nemesis = ahead.name;
        }

        if (s.place <= 3) {
          this.popupAtBird(s.place === 1 ? "🥇 VICTORY!" : s.place === 2 ? "🥈 2ND PLACE!" : "🥉 3RD PLACE!", "fever");
          this.flash("perfect");
          this.haptic([40, 20, 60, 20, 100]);
          this.particles.emitConfetti(this.bird.x, this.bird.y + 4);
          this.particles.emitConfetti(this.bird.x + 3, this.bird.y + 6);
        }

        this.hud.toast(`FINISH · P${s.place} of ${s.total}`, s.place <= 3 ? "gold" : "island");
        if (better) this.hud.toast("New best placing!", "gold");
        if (this.duelActive) {
          const won = s.place === 1;
          const res = this.save.recordDuelResult(won, this.today);
          this.duelResult = won ? "won" : "lost";
          this.duelDelta = res.delta;
          this.lastRatingDelta = res.delta;
          this.lastRatingBonus = 0;
          this.hud.toast(
            won ? `⚔ Duel won! +${res.delta} rating` : `⚔ Duel lost · ${res.delta} rating`,
            won ? "gold" : "warn",
          );
          if (won && res.streak > 0 && res.streak % 5 === 0) this.hud.toast(`🔥 ${res.streak} duel wins in a row!`, "gold");
          // Duel prize skin: 10 lifetime duel wins earns the Hummingbird.
          if (this.save.state.duel.wins >= 10 && !this.save.state.ownedSkins.includes("hummingbird")) {
            this.save.ownSkin("hummingbird");
            this.hud.toast("🐦 Jewel Hummingbird unlocked — 10 duel wins!", "gold");
          }
          if (won && this.save.ownTrail("trail_duelist")) this.hud.toast("✨ Duelist trail unlocked!", "gold");
          this.audio.purchase();
        } else if (this.rankedRace) {
          const live = this.massRace.remoteCount > 0;
          const res = this.save.recordRivalResult(s.place, s.total, live ? "massrace-live" : "massrace", this.today, live);
          this.lastRatingDelta = res.delta;
          this.lastRatingBonus = res.bonus;
          this.hud.toast(
            `Rival rating ${res.delta >= 0 ? "+" : ""}${res.delta} → ${this.save.state.rival.rating}${res.bonus > 0 ? ` · +${res.bonus}● streak` : ""}${live ? " · live field" : ""}`,
            res.delta >= 0 ? "gold" : "warn",
          );
          this.audio.purchase();
          this.checkDivisionPrize();
        } else {
          this.lastRatingDelta = 0;
          this.lastRatingBonus = 0;
        }
      } else {
        this.hud.toast("FINISH!", "gold");
      }
      this.particles.emitConfetti(this.bird.x, this.bird.y + 4);
      this.audio.island();
      this.finishRun();
      return;
    }

    if (this.mode.clock > 0) {
      this.daylight -= dt * this.difficultyTune.daylightMult;
      // GOLDEN HOUR — the last 22% of the day. The world turns amber, the
      // music opens, and every coin is worth double. Deep runs get a reason.
      const goldenNow = this.daylight > 0 && this.daylight < this.daylightMax() * 0.22;
      if (goldenNow && !this.goldenHour) {
        this.goldenHour = true;
        this.audio.goldenHour();
        this.hud.toast("🌇 GOLDEN HOUR — coins are worth double", "gold");
        this.flash("fever");
        this.glow(0.8);
      } else if (!goldenNow && this.goldenHour) {
        this.goldenHour = false; // sun flask refilled the day
      }
      if (this.daylight <= 0 && !this.bird.asleep) {
        this.onDaylightOut();
        return;
      }
    }

    // Settle rule: a bird that is down (grounded, in water, or skimming the
    // deck) with crawl speed and no held input has nothing left to do — let
    // it fall asleep now instead of waiting out the whole sun. Passive runs
    // end in seconds, matching the recap's "let it sleep" framing; active
    // flight cruises far above the speed threshold, so play never trips it.
    // An untouched bird tucks its wings: while grounded and passive, bleed
    // the taxi surges terrain bumps keep pumping in, so a run nobody plays
    // settles to a stop instead of surfing valleys until sundown.
    if (diving) this.lastInputAt = this.runTime;
    if (!diving && this.bird.grounded && this.runTime - this.lastInputAt > 3) {
      this.bird.vx *= Math.max(0, 1 - 2.5 * dt);
    }
    const surfaceY = this.terrain.isOcean(this.bird.x) ? WATER_Y : this.terrain.heightAt(this.bird.x);
    const settleAlt = this.bird.y - surfaceY;
    // Threshold is deliberately below MIN_KEEP_SPEED (6) so the speed-bleed
    // that keeps a grounded AFK bird slow doesn't resonate with Bird.step()'s
    // MIN_KEEP_SPEED floor and falsely trigger the settle timer mid-play.
    const settled = (this.bird.grounded || this.bird.inWater || settleAlt < 6) && this.bird.speed() < 4;
    if (!this.bird.asleep && !this.input.diving && settled) {
      this.settleAcc += dt;
    } else {
      this.settleAcc = 0;
    }
    if (this.settleAcc >= 4 && !this.bird.asleep) {
      this.onDaylightOut();
      return;
    }

    // Session goals update live so the player sees a bar fill mid-flight.
    const done = this.goals.update({
      distance: this.bird.x - this.startX,
      perfects: this.perfects,
      combo: this.launch.best,
      altitude: this.maxAltitude,
      coins: this.runCoins,
      clouds: this.runClouds,
      gems: this.runGems,
      sunflowers: this.runSunflowers,
    });
    this.runGoalsDone += done.length;
    for (const g of done) {
      this.save.addCoins(g.reward);
      this.audio.ding();
      this.goalPop = `${g.label} ✓  +${g.reward}`;
      this.goalPopT = 2.6;
      this.hud.toast(t("hud.toast.goalComplete", { n: g.reward }, "Goal complete +{{n}}"), "quest");
      this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
      this.bump();
    }

    // Today's quests, read against *live* counters so the day horizon fires in
    // the run instead of only on the card afterwards. Sampled at 5 Hz: three rows
    // is nothing, but this is the 60 fps hot path and a crossing only has to feel
    // instant, not be instant.
    this.questPollT -= dt;
    if (this.questPollT <= 0) {
      this.questPollT = 0.2;
      const rows = missionRows(
        this.missions.dailyQuests(this.today),
        this.runStats(),
        this.save.questsClaimed(this.today),
      );
      for (const q of newlyDone(this.questRowsPrev, rows)) {
        // Coins are paid when the run lands, so the pill says so: a reward that
        // reads as instant and arrives later feels like the game lied.
        this.popQueue = enqueuePop(this.popQueue, { text: `${q.title} \u2713  +${q.reward} on landing`, kind: "quest" }, 3);
        this.audio.ding();
        this.telemetry.track("quest_live", { id: q.id });
        this.bump();
      }
      this.questRowsPrev = rows;
    }

    // "Can you beat this?" — the marks ahead of the bird, as flags in the world.
    // Crossings are tested every frame against the marks that were ahead, so a
    // flag is beaten on the frame it is beaten; the target list itself is rebuilt
    // at 4 Hz, because sorting five candidates is not worth doing sixty times a
    // second when the numbers move once a run.
    {
      const flown = Math.max(0, this.bird.x - this.startX);
      const crossed = crossedBeatLines(this.beatAhead, flown);
      if (crossed.length) {
        const keys = new Set(crossed.map((c) => `${c.kind}:${c.at}`));
        this.beatAhead = this.beatAhead.filter((t) => !keys.has(`${t.kind}:${t.at}`));
        for (const t of crossed) this.beatLineCrossed(t);
      }
      this.beatPollT -= dt;
      if (this.beatPollT <= 0) {
        this.beatPollT = 0.25;
        this.beatAhead = beatTargets(this.beatInput(flown));
        this.beatCue = nearestBeatLine(this.beatAhead, flown);
        this.placeBeatFlags();
      }
    }

    // Career wings are fed by every metre of every flight, but the ladder used
    // to be something you only ever saw on a menu. Show the last stretch of the
    // rung as a bar filling while the player flies: progress felt *during* the
    // run is what makes the promotion at the end read as earned rather than
    // random. Only the wings ladder qualifies — it is free to evaluate per frame
    // and true on every flight, where 46 trophy metrics are neither.
    {
      const life = this.save.state.lifetime.distance;
      const next = nextWings(life);
      if (next) {
        const near = wingsProximity({
          flownMetres: Math.max(0, this.bird.x - this.startX),
          nextName: next.tier.name,
          nextNeeded: next.needed,
          tierSpan: next.tier.min - wingsFor(life).min,
        });
        this.proximity = { visible: near.visible, fill: near.fill, remaining: near.remaining, name: next.tier.name };
        if (near.visible && near.imminence >= 0.85 && !this.proximityCued) {
          this.proximityCued = true;
          this.audio.apexChime();
        }
        // The crossing itself: the biggest status jump in the game, felt at the
        // instant it is earned instead of read off a card 20 s later. No portal
        // event here on purpose — the run-end `wingsPromotion` already owns the
        // `wings_promo` telemetry and the single happyTime peak, and Poki asks
        // for that signal sparingly.
        if (
          wingsCrossing({
            flownMetres: Math.max(0, this.bird.x - this.startX),
            nextNeeded: next.needed,
            alreadyCued: this.rankCued,
          })
        ) {
          this.rankCued = true;
          this.showBanner(`${next.tier.icon} ${next.tier.name}`, "rank");
          this.audio.milestone();
          // The score marks it too: one bounded beat drop, the same reaction the
          // comedy moments get. Not a MomentKind on purpose — those nine feed the
          // "first funny moment" funnel and the results-card joke tally, and a
          // career promotion is neither a joke nor a physics event.
          this.audio.triggerBeatDrop(1.15);
          this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
          this.bump();
        }
      } else {
        this.proximity = { visible: false, fill: 0, remaining: 0, name: "" };
      }
    }

    this.hintTimer += dt;
    this.hint = this.computeHint();
  }

  /**
   * Take-off: rate it, pay it out, and sell it. This is the moment the whole
   * game is built around, so it gets slow-mo, a banner, particles and a chirp.
   */
  private onLaunch(): void {
    const res = this.launch.evaluate(this.bird, this.terrain, this.runTime);
    this.lastLaunch = res;
    const linked = this.slopeChain.launch(res.rating);
    if (linked) {
      this.bonus += linked.points;
      this.audio.ringPass(linked.chain);
      this.hud.toast(t("hud.toast.slopeFlow", { n: linked.chain, p: linked.points }, "SLOPE FLOW ×{{n}} +{{p}}"), linked.chain >= 3 ? "gold" : "cloud");
    }
    if (res.rating === "none") {
      if (this.bird.launchSpeed > 18) this.audio.chirp();
      return;
    }

    const combo = this.launch.combo;
    this.launchBannerText = ratingLabel(res.rating, combo);
    this.launchBannerT = res.rating === "perfect" ? 1.25 : 0.9;
    const local = this.terrain.localX(this.bird.x);
    if (local >= 845 && local < 954) this.audio.rampLaunch(res.speed);
    else this.audio.launchWhoosh(res.rating, res.speed);

    if (res.rating === "perfect") {
      this.perfects += 1;
      this.perfectChain += 1;
      this.bonus += 40 + combo * 15;
      this.awardXp(XP_RULES.perfect);
      this.audio.perfect();
      this.audio.duckMusic(0.32, 0.35);
      this.particles.burstRing(this.bird.x, this.bird.y, 0xffe08a);
      this.particles.emitPerfectBurst(this.bird.x, this.bird.y, combo);
      this.fireMoment("perfect", { shout: combo >= 3 ? `PERFECT ×${combo}!` : "PERFECT!", always: true });
      this.flash("perfect");
      this.glow(0.85);
      this.shake(0.35 + Math.min(0.4, combo * 0.06));
      // Hit stop: 2-frame freeze for cinematic impact, 40 ms on the
      // fever-clinching perfect (prototype parity: thuds 80 ms, fever 40 ms).
      if (!this.save.state.settings.reduceMotion) {
        const clinchesFever = this.perfectChain >= FEVER_NEED && !this.feverOn;
        this.hitStopTimer = clinchesFever ? 0.04 : 2 / 60;
      }
      this.haptic([50, 30, 50]);
      // A breath of slow-motion so the launch lands emotionally.
      if (!this.save.state.settings.reduceMotion) {
        this.timeScale = 0.45;
        this.zenithTimer = 0.16;
      }
      // Cinematic beat: dolly-zoom + banked tilt sized to the chain.
      this.camera.punch(5 + combo);
      this.camera.dollyZoom(1.5 + Math.min(2.4, combo * 0.5));
      this.camera.tilt(-0.06 - Math.min(0.14, combo * 0.03));
      if (res.speed > 74) {
        this.particles.emitSonicBoom(this.bird.x, this.bird.y);
        this.hud.toast(quip(BIG_LAUNCH_QUIPS, combo + Math.round(res.speed)), "zenith");
      }
      if (this.perfectChain >= FEVER_NEED) this.enterFever();
    } else if (res.rating === "great") {
      this.bonus += 18;
      this.awardXp(3);
      this.audio.butter();
      this.particles.burstRing(this.bird.x, this.bird.y, 0xc8f0ff);
      this.popupAtBird("GREAT!", "great");
      this.camera.punch(3);
      this.haptic(9);
    } else {
      this.bonus += 6;
      this.audio.chirp();
    }
  }

  /** Sunflower pad: a springy launch off a bloom — pure, reviewable bounce. */
  private onSunflower(): void {
    this.slopeChain.break();
    this.runSunflowers += 1;
    const sunflowerBonus = 80;
    this.bonus += sunflowerBonus;
    this.awardXp(XP_RULES.coin);
    this.audio.boing();
    this.particles.burstRing(this.bird.x, this.bird.y, 0xffcf33);
    this.particles.emitBounceBop(this.bird.x, this.bird.y, 1.0, 0.85, 0.2);
    this.particles.emitConfetti(this.bird.x, this.bird.y + 1);
    this.bounceCount += 1;
    this.fireMoment("boing", { shout: quip(BOP_QUIPS, this.bounceCount), always: true });
    this.camera.punch(4);
    this.hud.toast(t("hud.toast.sunflower", { n: sunflowerBonus }, "🌻 Sunflower bounce +{{n}}"), "gold");
    this.glow(0.55);
    this.haptic([20, 10, 40]);
    this.telemetry.track("sunflower", {});
  }

  /** Landings feed straight back into momentum, so they get feedback too. */
  private onLanding(): void {
    const q = this.bird.landingQuality;
    this.slopeChain.land(q, this.terrain.slopeAt(this.bird.x), this.bird.impact);
    if (q >= LAND_PERFECT && this.bird.speed() > 30) {
      this.bonus += 12;
      this.audio.butter();
      this.fireMoment("perfect", { shout: "BUTTER!", popup: false });
      this.hud.toast("Butter landing", "cloud");
      this.particles.burstRing(this.bird.x, this.bird.y, 0xffffff);
    } else if (q < 0.8) {
      this.launch.breakCombo();
      this.perfectChain = 0;
      // The thunk: an 80 ms freeze on a hard thud, matching the prototype's
      // hit-stop. Same path as the perfect-launch freeze above.
      if (!this.save.state.settings.reduceMotion) {
        this.hitStopTimer = Math.max(this.hitStopTimer, 0.08);
      }
      if (this.bird.impact > 6) {
        // Contact sound and camera impulse are emitted once by the main step.
        // Biome-colored thunk burst instead of plain dust.
        const ridge = this.terrain.biomeAt(this.bird.x).ridge;
        const tr = ((ridge >> 16) & 255) / 255;
        const tg = ((ridge >> 8) & 255) / 255;
        const tb = (ridge & 255) / 255;
        // The main step emits the high-impact burst; keep this fallback for
        // rough landings that are below that visual threshold.
        if (this.bird.impact <= 8) this.particles.emitThunk(this.bird.x, this.bird.y, tr, tg, tb);
        if (this.bird.impact > 10) {
          this.thudCount += 1;
          this.fireMoment("bonk", { shout: quip(THUD_QUIPS, this.thudCount) });
        }
      }
    }
  }

  private enterFever(): void {
    const was = this.feverOn;
    this.feverOn = true;
    this.feverReached = true;
    this.updateOnboarding();
    this.feverTimer = FEVER_DURATION + this.gameplaySkin.feverBonus + this.masteryPerk.feverBonus;
    if (!was) {
      this.audio.feverOn();
      this.audio.setMusicMode("fever");
      this.hud.toast(t("hud.toast.fever", undefined, "FEVER"), "fever");
      this.flash("fever");
      this.glow(0.95);
      this.particles.emitFeverBurst(this.bird.x, this.bird.y);
      this.particles.emitConfetti(this.bird.x, this.bird.y);
      this.popupAtBird("ON FIRE!", "fever");
      this.hud.toast(quip(FEVER_QUIPS, this.perfectChain), "fever");
      // Funny praise — makes player feel legendary
      const praise = getPraise("fever", this.perfectChain + this.island);
      this.hud.toast(praise.text, praise.tone as "gold" | "power" | "info" | "warn" | "zenith");
      this.telemetry.track("fever", { distance: Math.round(this.bird.x - this.startX) });
    }
  }

  /** Cloud gameplay — each kind pays back into the momentum loop. */
  private onCloud(kind: CloudKind, x: number, y: number): void {
    this.runClouds += 1;
    this.awardXp(XP_RULES.cloud);
    this.audio.cloud();
    this.particles.emitCollect(x, y);
    this.particles.burstRing(x, y, 0xffffff);
    const cb = this.powers.cloudBoostOn();
    switch (kind) {
      case "boost":
        this.powers.add("longglide");
        this.bonus += 25;
        this.hud.toast("Cloud boost — light as air", "power");
        break;
      case "golden": {
        const awarded = this.addRunCoins(10);
        this.bonus += 60;
        this.hud.toast(`Golden cloud +${awarded}`, "gold");
        break;
      }
      case "wind":
        this.bird.vx += cb ? 22 : 14;
        this.bonus += 25;
        this.hud.toast("Tailwind cloud", "power");
        break;
      case "super":
        this.powers.add("wingboost");
        this.powers.add("longglide");
        this.bonus += 90;
        this.hud.toast("SUPER CLOUD", "fever");
        this.flash("fever");
        break;
      default:
        this.bonus += CLOUD_BONUS;
        this.bird.vx += cb ? 8 : 2;
        break;
    }
    if (cb) this.bird.vx += 6;
  }

  /** Threading a sky ring: a speed surge + score that scales with the chain. */
  private onRing(x: number, y: number): void {
    this.runRings += 1;
    this.ringChainTimer = RING_CHAIN_WINDOW;
    this.ringChain += 1;
    // Deeper chains pay more: the courses make long ones reachable, so the
    // ceiling sits at 8 instead of 4 and the speed reward keeps climbing.
    const chainBonus = Math.min(8, this.ringChain) * 8;
    const pts = 30 + chainBonus;
    this.bonus += pts;
    this.awardXp(XP_RULES.cloud);
    this.audio.ringPass(this.ringChain);
    this.bird.vx += 8 + Math.min(22, this.ringChain * 2.4);
    this.particles.burstRing(x, y, 0xffd76a);
    this.particles.emitSonicBoom(x, y);
    if (this.ringChain >= 3) {
      this.particles.emitConfetti(x, y + 2);
      this.hud.toast(t("hud.toast.ringChain", { n: this.ringChain, p: pts }, "RING CHAIN ×{{n}} +{{p}}"), "gold");
      this.flash("fever");
      this.glow(0.6);
      // The ring chord already marks the chain; a five-note fanfare on every
      // subsequent ring drowned out landing/timing cues.
    } else {
      this.hud.toast(`Through the ring +${pts}`, "gold");
    }
    this.haptic([20, 10, 30]);
    this.telemetry.track("ring", { chain: this.ringChain });
  }

  /** Balloon pop: a springy launch back into the sky — pure, silly reward. */
  private onBalloon(x: number, y: number): void {
    this.runBalloons += 1;
    this.bird.vy = Math.max(this.bird.vy, 46);
    this.bird.vx += 18;
    this.bird.grounded = false;
    this.bird.inWater = false;
    this.bonus += 150;
    this.awardXp(XP_RULES.zenith);
    this.audio.balloon();
    this.particles.emitConfetti(x, y + 1);
    this.particles.burstRing(x, y, 0xff6b6b);
    this.particles.emitBounceBop(x, y, 1.0, 0.42, 0.75);
    this.bounceCount += 1;
    this.fireMoment("boing", { shout: quip(BOP_QUIPS, this.bounceCount), always: true });
    this.camera.punch(6);
    this.shake(0.3);
    this.hud.toast("🎈 Balloon bounce! +150", "gold");
    this.flash("fever");
    this.glow(0.7);
    this.haptic([20, 10, 40, 20, 60]);
    this.telemetry.track("balloon", {});
  }

  private checkZenith(): void {
    const vy = this.bird.vy;
    if (!this.bird.grounded && !this.bird.asleep && this.prevVy > 0 && vy <= 0) {
      const ground = Math.max(this.terrain.heightAt(this.bird.x), WATER_Y);
      const alt = this.bird.y - ground;
      if (alt >= ZENITH_ALT) {
        this.zeniths += 1;
        const pts = Math.round(alt * 4);
        this.bonus += pts;
        this.timeScale = ZENITH_SLOWMO;
        this.zenithTimer = ZENITH_DURATION;
        this.camera.punch(9);
        this.particles.burstRing(this.bird.x, this.bird.y, 0xffffff);
        this.particles.emitPerfectBurst(this.bird.x, this.bird.y, 2);
        this.popupAtBird(`SKY HIGH! +${pts}`, "zenith");
        this.audio.zenith();
        this.audio.duckMusic(0.6, 0.7);
        this.hud.toast(`SKYLINE +${pts}`, "zenith");
        this.flash("perfect");
        this.glow(0.8);
        this.haptic([60, 40, 80]);
        this.telemetry.track("zenith", { alt: Math.round(alt) });
      }
    }
    this.prevVy = vy;
  }

  /**
   * The one speed burst the player can trigger, shared by every source.
   *
   * One function on purpose: the burst is the single most "feels like flying
   * fast" moment in the game, so a new source (the Tailwind Launch boost, a
   * stall rescue, a double tap) inherits the identical speed curve, audio,
   * particle ring, shake and haptics instead of growing a slightly different
   * variant that nobody tuned.
   */
  private activateManualBoost(source: ManualBoostSource): void {
    this.manualBoostCooldown = MANUAL_BOOST_COOLDOWN;
    this.boostTimer = Math.max(this.boostTimer, MANUAL_BOOST_TIME);
    this.bird.vx += MANUAL_BOOST_SPEED;
    this.bird.vy = Math.max(this.bird.vy, 9);
    this.audio.boost();
    this.particles.emitBounceBop(this.bird.x, this.bird.y, 1, 0.65, 0.2);
    this.particles.burstRing(this.bird.x, this.bird.y, 0xffb347);
    this.shake(0.28);
    this.haptic([18, 12, 28]);
    this.hud.toast(MANUAL_BOOST_COPY[source], "power");
    this.telemetry.track("manual_boost", { source });
  }

  private onPickup(kind: PickupKind, x: number, y: number): void {
    if (this.challengeMods.noPowerups) {
      // Pure Sky: the pickup pops visually but grants nothing.
      this.particles.emitCollect(x, y);
      this.hud.toast("Pure Sky — power-ups are inert", "info");
      return;
    }
    this.pickups += 1;
    this.bonus += 25;
    this.audio.powerup();
    // Color-coded pickup burst using the pickup's own material color.
    const pc = PICKUP_STYLE[kind].color;
    this.particles.emitPickup(x, y, ((pc >> 16) & 255) / 255, ((pc >> 8) & 255) / 255, (pc & 255) / 255);
    this.haptic([40, 30, 40, 30, 100]);
    const wasLive = this.powers.has(kind);
    this.powers.add(kind);
    // OVERCHARGE: doubling up while live promotes the power-up to tier II.
    if (wasLive && this.powers.level(kind) === 2) {
      // Impulse-style effects still fire — the promotion adds, never removes.
      if (kind === "rocket") {
        this.boostTimer = BOOST_TIME;
        this.bird.vx += 42;
        this.bird.vy += 8;
        this.shake(0.55);
      }
      this.particles.burstRing(x, y, 0xffffff);
      this.hud.toast(`⚡ OVERCHARGE II — ${PICKUP_STYLE[kind].label}`, "zenith");
      this.shake(0.3);
      return;
    }
    switch (kind) {
      case "sun":
        this.daylight = Math.min(this.daylightMax(), this.daylight + PICKUP_SUN_TIME);
        this.particles.burstRing(x, y, 0xffd24a);
        this.hud.toast(`+${PICKUP_SUN_TIME}s Daylight ☀`, "power");
        break;
      case "rocket":
        this.boostTimer = BOOST_TIME;
        this.bird.vx += 36;
        this.bird.vy += 7;
        this.particles.burstRing(x, y, 0xff5a3a);
        this.audio.boost();
        this.hud.toast("Rocket Speed 🚀", "power");
        this.shake(0.55);
        break;
      case "magnet":
        this.magnetTimer = MAGNET_TIME;
        this.particles.burstRing(x, y, 0x8a6cff);
        this.audio.magnetOn();
        this.hud.toast(`Coin Magnet ${MAGNET_TIME}s 🧲`, "power");
        break;
      case "shield":
        this.shield = Math.min(2, this.shield + 1);
        this.powers.shield = this.shield;
        this.particles.burstRing(x, y, 0x5ad8ff);
        this.hud.toast("Sea Shield Active 🛡", "power");
        break;
      case "longglide":
        this.particles.burstRing(x, y, 0x7fe8c8);
        this.hud.toast("Long Glide 🪁 Low Drag", "power");
        break;
      case "wingboost":
        this.particles.burstRing(x, y, 0xffa8e0);
        this.hud.toast("Wing Boost 🕊 Super Lift", "power");
        break;
      case "feather":
        this.particles.burstRing(x, y, 0xfff0c0);
        this.hud.toast("Feather 🐦 Butter Landings", "power");
        break;
      case "goldenwings":
        this.particles.burstRing(x, y, 0xffd76a);
        this.particles.emitConfetti(x, y + 2);
        this.flash("perfect");
        this.glow(1.0);
        this.audio.island();
        this.camera.punch(7);
        this.hud.toast("✨ GOLDEN WINGS ✨", "gold");
        break;
      case "cloudboost":
        this.particles.burstRing(x, y, 0xc8e8ff);
        this.hud.toast("Cloud Boost ☁ Wind Lift", "power");
        break;
      default:
        break;
    }
  }

  /** First-flight coach line takes priority over ambient hints. */
  private coachHint(): string {
    if (!this.coach) return "";
    const v = this.coach.view();
    if (v.step < 0 || !v.text) return "";
    const pips = Array.from({ length: v.steps }, (_, i) => (i < v.step ? "●" : i === v.step ? "◉" : "○")).join(" ");
    return `${pips}  ${v.text}`;
  }

  private computeHint(): string {
    const novice = this.save.state.tutorialRuns < 3;
    const local = this.terrain.localX(this.bird.x);
    const cue = terrainCue({ grounded: this.bird.grounded, localX: local,
      altitude: this.bird.altitude, vy: this.bird.vy,
      landingSlope: !this.bird.grounded && this.bird.altitude < 55 && this.bird.vy < -8
        ? this.terrain.slopeAt(this.bird.x + landingLookAhead(this.bird.altitude, this.bird.vx, this.bird.vy)) : 0 });
    if (cue) return cue;

    // Anti-bore: long passive glide = immediate actionable hint
    if (!this.bird.grounded && this.bird.airTime > 2.8) {
      const sp = this.bird.speed();
      if (sp < 14) return "STALLING — HOLD to dive!";
      if (this.bird.airTime > 3.5 && this.bird.vy < -4) return this.weather.inThermal ? "RELEASE to ride thermal ♨" : "HOLD to dive — find lift!";
      if (this.bird.airTime > 4.5) return "DIVE for speed — then launch again";
    }

    if (this.hintTimer > (novice ? 26 : 8)) {
      if (this.terrain.isOcean(this.bird.x + 40) && !this.terrain.isOcean(this.bird.x) && this.island < 2) return "Build speed — then RELEASE";
      return "";
    }
    const slope = this.terrain.slopeAt(this.bird.x);
    if (this.hintTimer < 2.6 && slope < -0.08) return "HOLD to dive";
    if (novice && !this.fairRace && this.save.hasUpgrade("doubletap") && this.save.state.settings.doubleTapBoost && this.hintTimer >= 3 && this.hintTimer < 5.8) return "DOUBLE TAP for a boost";
    if (slope > 0.16 && this.bird.grounded && this.bird.speed() > 18) return "RELEASE to launch";
    if (this.terrain.isOcean(this.bird.x + 40) && !this.terrain.isOcean(this.bird.x)) return "Build speed — then RELEASE";
    return "";
  }

  /** Current trail colour, from the equipped prize trail or the bird's skin. */
  private trailColor(): [number, number, number] {
    const prize = this.save.state.activeTrail ? TRAILS[this.save.state.activeTrail] : undefined;
    if (prize && prize.colors.length) {
      return prize.colors[Math.floor(this.hueT) % prize.colors.length]!;
    }
    switch (this.skin.id) {
      case "aurora":
        return hsl(this.hueT % 1, 0.9, 0.65);
      case "phoenix":
        return [1, 0.5, 0.16];
      case "bluejay":
        return [0.6, 0.85, 1];
      case "owl":
        return [0.75, 0.65, 1];
      case "ember":
        return [1, 0.55, 0.2];
      default:
        return [1, 0.95, 0.85];
    }
  }

  /** Advance the trail hue so prize/aurora colours cycle smoothly (not strobe). */
  private advanceTrailHue(dt: number): void {
    const prize = this.save.state.activeTrail ? TRAILS[this.save.state.activeTrail] : undefined;
    if (prize && prize.colors.length) this.hueT += dt * 2.4;
    else if (this.skin.id === "aurora") this.hueT += dt * 0.45;
  }

  /** Streams the glowing ribbon behind the bird, matching the sparkle trail. */
  private updateTrailRibbon(dt: number): void {
    this.advanceTrailHue(dt);
    const c = this.trailColor();
    this.trail.setColor(c[0], c[1], c[2]);
    const show =
      this.state === "playing" &&
      (this.feverOn || this.boostTimer > 0 || this.bird.speed() > 48 || ((this.gameplaySkin.magnetAlways || this.gameplaySkin.id === "aurora") && this.bird.speed() > 24));
    if (show) this.trail.push(this.bird.x, this.bird.y);
    this.trail.update(dt, show ? 1 : 0);
  }

  private emitTrail(dt: number): void {
    this.trailFxAcc -= dt;
    if (this.trailFxAcc > 0) return;
    // Trail density is a speed *curve*, not two thresholds: the sparkle
    // cadence tightens continuously from cruise to warp, so the streak behind
    // the bird visibly compresses as the flight accelerates. Cheap by
    // construction (one division per emission) and it inherits the adaptive
    // particle budget — a slow device thins the trail instead of dropping
    // frames, because ParticleFX skips spawns when setBudget is below 1.
    const warp = warpT(Math.min(1.2, this.bird.speed() / MAX_SPEED));
    this.trailFxAcc = 0.055 - 0.03 * warp;
    const c = this.trailColor();
    this.particles.emitSparkle(this.bird.x - 0.4, this.bird.y, c[0], c[1], c[2]);
    if (this.bird.speed() > 68) this.particles.emitWingTrails(this.bird.x, this.bird.y, this.bird.speed());
  }

  /** Ambient particles for the power-up currently in effect. */
  private emitPowerFx(): void {
    const x = this.bird.x;
    const y = this.bird.y;
    if (this.powers.has("goldenwings")) {
      this.particles.emitSparkle(x - Math.random() * 1.4, y + (Math.random() - 0.5) * 1.6, 1, 0.8 + Math.random() * 0.2, 0.3);
    } else if (this.powers.has("magnet") || this.magnetTimer > 0) {
      this.particles.emitSparkle(x + 1.5 + Math.random() * 2.5, y + (Math.random() - 0.5) * 2.2, 0.55, 0.42, 1);
    }
    if (this.shield > 0) {
      this.particles.emitSparkle(x + (Math.random() - 0.5) * 1.8, y + (Math.random() - 0.5) * 1.8, 0.35, 0.85, 1);
    }
    if (this.powers.has("wingboost")) this.particles.emitWind(x, y, 0.6);
    if (this.powers.has("longglide")) this.particles.emitWind(x, y, 0.35);
    if (this.powers.has("cloudboost")) this.particles.emitWind(x, y, 0.2);
    if (this.powers.has("feather")) this.particles.emitSparkle(x - 0.5, y + 0.3, 1, 0.98, 0.85);
    if (this.boostTimer > 0) this.particles.emitSparkle(x - 0.6, y - 0.2, 1, 0.45, 0.15);
  }

  private render(visDt: number, rawDt: number): void {
    // Keep input, matchmaking and clocks live; decorative menus only need 30 Hz.
    if (this.state === "menu" || this.state === "paused") {
      this.menuRenderAcc += rawDt;
      if (this.menuRenderAcc < 1 / 30) return;
      visDt = rawDt = this.menuRenderAcc;
    }
    this.menuRenderAcc = 0;
    const playing = this.state === "playing";
    const diving = playing && this.input.diving;

    if (this.versus && this.p1 && this.p2) {
      this.renderVersus(visDt, rawDt);
      return;
    }

    const glow = this.feverOn || this.powers.has("goldenwings") || (this.gameplaySkin.magnetAlways && this.bird.speed() > 30);
    // Render interpolation: draw the bird between the previous and current
    // physics step so motion stays smooth above 60 Hz. The menu, sleep and
    // game-over states step the bird directly (or not at all), so they draw
    // at interp = 1; versus has its own interpolated path in renderVersus().
    const interp = this.state === "playing" ? clamp(this.acc / PHYS_DT, 0, 1) : 1;
    const visX = lerp(this.prevBirdX, this.bird.x, interp);
    const visY = lerp(this.prevBirdY, this.bird.y, interp);
    this.bird.syncVisual(visDt, diving, glow, this.elapsed, this.terrain, visX, visY);
    this.massRace.syncVisual(visDt, this.bird.x, interp);
    if (this.massRace.active && this.state === "playing") {
      const tags = this.massRace.getVisibleNameTags(this.camera.camera.position.x, this.bird.x, this.bird.y, this.startX);
      this.hud.updateNameTags(tags, this.camera.camera, this.renderWidth, this.renderHeight);
    } else {
      this.hud.updateNameTags([], this.camera.camera, this.renderWidth, this.renderHeight);
    }
    this.finishRemaining = this.finishGate.update(visDt, this.bird.x);
    this.updateTrailRibbon(visDt);
    this.particles.update(visDt);
    // Attract framing in the menu only: the demo bird leads into the open
    // margin beside the card. Every other state keeps gameplay framing.
    const attract = this.state === "menu" && !this.versus;
    this.camera.update(rawDt, this.bird, playing, this.terrain.landingGround(this.bird.x, this.bird.vx), attract, this.feverOn);
    // Sink foreground props that would cross the bird's sight line (per-view
    // in split-screen so neither player loses their bird behind a tree).
    this.terrain.updateOcclusion(
      [{ x: this.bird.x, y: this.bird.y }],
      this.camera.camera.position.x,
      this.camera.camera.position.y,
      this.camera.camera.position.z,
    );
    this.livingBg.update(rawDt, this.bird.x, this.bird.y);

    this.applyWorldLook(this.bird.x, this.bird.altitude);
    this.terrain.update(this.bird.x);

    const dayT = Math.max(0, Math.min(1, this.daylight / this.daylightMax()));
    this.audio.update(rawDt, this.bird.speed(), diving, this.bird.grounded, this.feverOn, dayT, playing, this.weather.gust);
    // Music phase 2 — the score follows the *arc* of a run, not only its events.
    // `musicEnergy()` is the game's own weighted sum (speed, altitude, fever,
    // danger, ring chain) and stays untouched; MusicArc wraps it in a launch
    // swell, so the take-off is never the quietest beat of a flight, and in a
    // slow release, so the run resolves instead of cutting to silence.
    const arc = arcSmooth(this.arcIntensity, arcTarget(playing, this.runTime, this.musicEnergy()), rawDt);
    this.arcIntensity = arc;
    if (arcShouldWrite(this.arcWritten, arc)) {
      this.arcWritten = arc;
      this.audio.setMusicIntensity(arc);
    }
    // Music pass 3 — the *arrangement* follows the flight next to the intensity:
    // a take-off breath with the kit held back, the tuned mix in cruise, a
    // brightened and thinned band at the apex, and a landing cadence that keeps
    // its own window after the mode has already flipped back to the menu. Not
    // gated by the arc's dead band — the phase has to change on the frame a run
    // ends, which is exactly when the intensity write is skipped.
    this.audio.setMusicRunPhase(playing, this.runTime);

    const size = this.renderer.getSize(this.tmpSize);
    this.renderer.setViewport(0, 0, size.x, size.y);
    this.renderer.setScissorTest(false);
    if (this.useBloom && playing) this.ensureFx();
    if (this.useBloom && playing && this.fx) {
      this.updateGlowBase();
      this.fx.render(rawDt);
    } else {
      this.renderer.render(this.scene, this.camera.camera);
    }
  }

  /** Shared sky / fog / palette work, driven by whoever the camera follows. */
  private applyWorldLook(x: number, altitude: number): void {
    const biome = this.terrain.biomeAt(x + 60);
    this.audio.setBiome(biome.musicMode);
    const dayT = this.state === "menu" ? 0.86 : Math.max(0, Math.min(1, this.daylight / this.daylightMax()));
    const altT = clamp((altitude - ALT_CLOUDS) / (ALT_STRATO - ALT_CLOUDS), 0, 1);
    const isAurora = biome.id === "aurora";
    const auroraVal = isAurora ? 0.9 : altT > 0.4 ? (altT - 0.4) * 1.3 : 0;
    this.sky.setBiomeTint(biome.skyTop, biome.skyHorizon, this.state === "menu" ? biome.skyMix * 0.3 : biome.skyMix);
    this.sky.setBiomeAtmosphere(biome.cloudTint, biome.cloudDensity, biome.glow);
    this.sky.setFlightAltitude(altitude);
    this.sky.setAltitude(altT);
    this.sky.setAurora(auroraVal);
    const pal = this.sky.update(dayT, x, this.elapsed);
    this.terrain.setPalette(pal, x);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.sky.fogColor).lerp(this.tmpColor.setHex(biome.fogTint), 0.12);
      // Thin the haze as we climb so the whole world opens up beneath the bird.
      // Keep the playable horizon crisp on desktop and mobile. The previous
      // near/far range put fog directly across the flight path, reading as a
      // permanent cloud veil even in clear daytime biomes.
      this.scene.fog.near = 560 + altT * 520;
      this.scene.fog.far = 5000 + altT * 3000;
      this.renderer.setClearColor(this.scene.fog.color, 1);
    }
    this.altZone =
      altitude >= ALT_STRATO ? 4 : altitude >= ALT_HIGH ? 3 : altitude >= ALT_CLOUDS ? 2 : altitude >= ALT_SKY ? 1 : 0;
  }

  /** Two viewports, one scene, one shared terrain — nothing is simulated twice. */
  private renderVersus(visDt: number, rawDt: number): void {
    const p1 = this.p1!;
    const p2 = this.p2!;
    const playing = this.state === "playing";
    const interp = playing ? clamp(this.acc / PHYS_DT, 0, 1) : 1;
    p1.syncVisual(visDt, playing && this.input.diving, this.elapsed, this.terrain, interp);
    p2.syncVisual(visDt, playing && this.input.diving2, this.elapsed, this.terrain, interp);
    this.particles.update(visDt);
    p1.updateCamera(rawDt, playing, this.terrain);
    p2.updateCamera(rawDt, playing, this.terrain);

    const lead = p1.bird.x >= p2.bird.x ? p1 : p2;
    // Occlusion against both birds, sampled from the lead camera — a prop that
    // blocks either player's view sinks out of the way.
    this.terrain.updateOcclusion(
      [
        { x: p1.bird.x, y: p1.bird.y },
        { x: p2.bird.x, y: p2.bird.y },
      ],
      lead.camera.camera.position.x,
      lead.camera.camera.position.y,
      lead.camera.camera.position.z,
    );
    this.applyWorldLook(lead.bird.x, lead.bird.altitude);
    this.terrain.update(lead.bird.x);
    this.audio.update(rawDt, lead.bird.speed(), playing && this.input.diving, lead.bird.grounded, false, 1, playing, 0);
    this.audio.setMusicIntensity(playing ? Math.min(1, lead.bird.speed() / 90 * 0.5 + Math.min(1, lead.bird.altitude / ALT_HIGH) * 0.3) : 0);
    // Same arrangement contract as the solo path: two players share one band,
    // and it follows the leader's flight.
    this.audio.setMusicRunPhase(playing, this.runTime);

    const size = this.renderer.getSize(this.tmpSize);
    const views = splitViews(size.x, size.y, this.renderer.getPixelRatio());
    this.renderer.setScissorTest(true);
    for (const [index, racer] of [p1, p2].entries()) {
      const { x: ox, y: oy, width: w, height: h } = views[index]!;
      // Each split viewport gets one authoritative bird. Rendering both
      // meshes into both cameras made nearby racers visually stack or appear
      // to teleport across the divider. Terrain and particles remain shared,
      // while the focused racer stays unambiguous in their own lane.
      p1.bird.root.visible = racer === p1;
      p2.bird.root.visible = racer === p2;
      this.renderer.setViewport(ox, oy, w, h);
      this.renderer.setScissor(ox, oy, w, h);
      racer.camera.resize(w / Math.max(1, h));
      this.renderer.render(this.scene, racer.camera.camera);
    }
    this.renderer.setScissorTest(false);
    p1.bird.root.visible = true;
    p2.bird.root.visible = true;
  }


  /* ------------------------------------------------------------- run flow */

  /**
   * Puts a chase target in the sky for this run.
   *
   * Real rival first, pace ghost as the guaranteed fallback. The network call
   * gets 1.8 s: long enough to win on a warm cache, short enough that a cold
   * backend never leaves the player staring at an empty sky through the opening
   * seconds - which is exactly when a first-timer decides whether this game is
   * worth another tap. Whichever target lands first owns the run: swapping
   * ghosts mid-flight would teleport a bird in front of the player, and that
   * reads as a bug no matter how correct the data behind it is.
   */
  private armRivalGhost(): void {
    const epoch = this.runEpoch;
    const alive = (): boolean => !this.disposed && epoch === this.runEpoch && this.state === "playing";
    const armPace = (): void => {
      if (!alive() || this.rivalGhostPlayer.active) return;
      const best = this.save.state.bestDistance;
      const target = paceTargetDistance(best);
      // Skill gradient with progress: a new player faces a sloppier pace line,
      // an experienced one a cleaner line. Never a wall, always catchable.
      const skill = best <= 0 ? 0.35 : Math.min(0.85, 0.4 + best / 6000);
      const pace = synthesizePaceGhost({
        seed: this.seed,
        startX: this.startX,
        distance: target,
        terrain: this.terrain,
        skill,
      });
      this.rivalGhostName = pace.name;
      this.rivalGhostSynthetic = true;
      this.rivalGhostPlayer.loadRecord(pace.record);
      this.hud.toast(t("toast.pace.ghost", { name: pace.name }, "👻 {name} on these hills — catch it"), "quest");
      this.telemetry.track("rival_ghost", { kind: "pace", distance: pace.distance, best: Math.round(best) });
    };

    if (this.seedMode === "today") {
      const real = fetchRivalGhost(this.seed, this.save.state.deviceId, this.save.state.bestDistance);
      // Race the backend against a short fuse. A rejected or hanging fetch must
      // still end with a rival in the sky, never with an empty one.
      const fuse = new Promise<null>((resolve) => {
        const id = window.setTimeout(() => resolve(null), 1800);
        real.then(
          () => window.clearTimeout(id),
          () => window.clearTimeout(id),
        );
      });
      void Promise.race([real.catch(() => null), fuse]).then((rg) => {
        if (!alive()) return;
        if (!rg) {
          armPace();
          return;
        }
        if (this.rivalGhostPlayer.active) return;
        this.rivalGhostName = rg.name;
        this.rivalGhostSynthetic = false;
        this.rivalGhostPlayer.loadRecord({ seed: this.seed, distance: rg.distance, samples: rg.samples });
        this.hud.toast(`👻 ${rg.name} flew ${Math.round(rg.distance)} m here — chase them`, "quest");
        this.telemetry.track("rival_ghost", { kind: "player", distance: Math.round(rg.distance) });
      });
      return;
    }
    // Yesterday / Random / shared seeds have no population to ask, so the pace
    // ghost is the rival. The player still races somebody.
    armPace();
  }

  private startRun(opts?: RunOptions): void {
    this.exitVersus();
    this.mode = modeById(this.modeId);
    // Portal game events: open this attempt's measurement span. The run is a
    // `fail` until the goal is actually reached (death/sun-out/elimination
    // all keep it a fail).
    this.runOutcome = "fail";
    // `round` is in Poki's published MeasureCategory vocabulary (so it reports
    // alongside every other game's round funnels); `run` was ours alone.
    this.platform?.measure("round", this.modeId, "start");
    // Snapshot the record to beat BEFORE this run writes anything, so the
    // mid-run "new record" moment and the results "NEW BEST" banner compare
    // against the genuinely previous best.
    this.bestAtStart = this.save.state.bestDistance;
    this.distanceRecordCrossed = false;
    this.newBest = false;
    this.progressEvents = [];
    this.celebration = planCelebration([]);
    this.proximity = { visible: false, fill: 0, remaining: 0, name: "" };
    this.proximityCued = false;
    // World variety: in the default "today" mode a plain casual flight gets
    // fresh random hills every run so no two free-flights look alike. An
    // explicit Yesterday/Random seed pick is honoured, and date-seeded
    // daily/gauntlet runs plus shared-field races (duels, events, stormfront,
    // mass races) keep their fixed seed so the field stays fair/comparable.
    const casualRun = shouldRebuildCasualWorld({
      replay: Boolean(opts?.replay),
      seedMode: this.seedMode,
      duel: Boolean(opts?.duel),
      challenge: typeof opts?.challenge === "string" ? opts.challenge : "",
      event: Boolean(opts?.event),
      storm: Boolean(opts?.storm),
      raceMode: isRaceMode(this.modeId),
    });
    if (casualRun) {
      this.rebuildWorld(`fly-${Math.random().toString(36).slice(2, 10)}`);
    } else if (opts?.challenge && this.seed !== this.today) {
      this.rebuildWorld(this.today);
    } else if (isRaceMode(this.modeId)) {
      const course = this.courseForRace();
      this.startX = course.island * ISLAND_PERIOD + 64;
      const targetSeed = `${this.seed}:${course.id}`;
      if (this.seed !== targetSeed) {
        this.rebuildWorld(targetSeed);
      }
    }
    // Duels and challenges only apply when their action explicitly asks for
    // them; every other launch path resets to a plain run.
    this.duelActive = Boolean(opts?.duel);
    this.duelResult = "";
    this.duelDelta = 0;
    this.challengeRun = opts?.challenge ?? "";
    this.challengeMods = this.challengeRun === "daily" ? modsFor(dailyChallenge(this.today).modifier.id) : NO_MODS;
    this.eventRun = Boolean(opts?.event);
    if (this.eventRun) this.weeklyMods = weeklyEvent().mods;
    this.serverPlaceApplied = false;
    this.goldenHour = false;
    this.nextMilestone = 500;
    this.rivalBeatenToast = false;
    this.stormPhase = 1;
    this.thermalToasted = false;
    // Stormfront survives only through launchMatch(); any other entry resets.
    if (!opts?.storm) this.stormfront = false;
    this.challengeOutcome = "";
    this.resetRun(false);
    // First ever flight: spin up the interactive dive/launch/soar coach.
    // Non-qualifying launches (duels, events, other modes) clear any live
    // coach so tutorial text can never bleed into them.
    if (!this.save.state.firstFlightDone && this.modeId === "daytrip" && !this.duelActive && !this.challengeRun && !this.eventRun) {
      this.coach = new FirstFlight(false);
    } else {
      this.coach = null;
    }
    // Modes reshape the clock; Race has no sunset at all.
    this.daylight =
      (this.mode.clock > 0 ? this.mode.clock : this.daylightMax()) *
      this.challengeMods.daylightMult *
      (this.eventRun ? this.weeklyMods.daylightMult : 1);
    this.settleAcc = 0;
    this.lastInputAt = 0;
    this.weather.windMult = (this.eventRun ? this.weeklyMods.windMult : 1) * (this.stormfront ? 1.7 : 1);
    this.weather.stormfront = this.stormfront;
    if (this.stormfront) this.hud.toast("⛈ STORMFRONT — same storm for every pilot. Survive and outfly.", "warn");
    // Mass Race & PvP Variants: build the 40-bird grid on the *same* seed so the field is
    // identical for anyone flying this race. Real players take over slots as
    // they join; unfilled slots keep flying as local squadron pilots.
    if (isRaceMode(this.modeId)) {
      this.massRace.configureMode(this.modeId);
      const livePeers = !this.duelActive && !this.localRace && this.net?.connected ? this.net.roster() : null;
      const fieldSize = this.duelActive ? 1 : livePeers ? Math.max(1, livePeers.length) : this.roomSize;
      this.massRace.spawn(fieldSize, `${this.seed}:${this.modeId}:${fieldSize}`, this.terrain, this.startX);
      // Reserve actual human seats immediately; do not simulate 40 phantom
      // opponents in a two-person room while waiting for the first packet.
      if (livePeers) livePeers.forEach((peer, i) => {
        const rival = this.massRace.rivals[i];
        if (rival) { rival.id = peer.id; rival.name = peer.name; rival.kind = "remote"; rival.hue = peer.hue; }
      });
      if (this.duelActive) {
        // Duel: one seeded opponent whose skill tracks your rating band.
        const opp = duelOpponent(`${this.seed}:${this.today}`, this.save.state.rival.rating);
        this.massRace.setFieldSkill(duelSkillFor(this.save.state.rival.rating));
        const r = this.massRace.rivals[0];
        if (r) r.name = opp.name;
        this.hud.toast(`⚔ Duel vs ${opp.name} · first to the line`, "gold");
      } else {
        this.massRace.setFieldSkill(this.roomSkill === "ace" ? 1.25 : this.roomSkill === "chill" ? 0.7 : 1);
      }
      // Time-shifted multiplayer: seat doppelgängers of real players from the
      // global board over local slots (name + skill from their best run).
      if (!this.duelActive && !livePeers) {
        const page = this.board.peek("global", "distance");
        const rows = (page?.entries ?? [])
          .filter((en) => !en.you && en.name)
          .slice(0, 8)
          .map((en) => ({ name: en.name, distance: en.distance }));
        if (rows.length) this.massRace.applyGhosts(rows, this.mode.finish);
      }
      this.raceField = fieldSize + 1;
      this.racePlace = 0;
      this.raceFinishTime = 0;
      this.photoFinish = "";
      this.lastRatingDelta = 0;
      this.lastRatingBonus = 0;
      this.lastPlace = 0;
      this.overtakeAcc = 0;
      this.closeCallAcc = 0;
      // Duels are strictly 1v1 vs the seeded opponent — never let a stale
      // room connection promote remote pilots into the field.
      if (this.duelActive) this.disconnectRace();
      else this.connectRace();
    } else {
      this.disconnectRace();
      this.massRace.clear();
      this.raceField = 0;
    }
    // Give race modes something to actually aim at.
    if (this.mode.finish > 0) this.finishGate.place(this.startX + this.mode.finish, this.terrain);
    else this.finishGate.hide();
    this.beatAhead = [];
    this.beatCue = null;
    this.beatFired.clear();
    this.beatPollT = 0;
    for (const flag of this.beatFlags) flag.hide();

    // Race boosts are retained for a later solo flight, never spent invisibly.
    const armed = this.fairRace ? [] : this.save.consumeArmedBoosts();
    for (const id of armed) this.applyBoost(id);
    if (this.eventRun) {
      const ev = weeklyEvent();
      this.hud.toast(`${ev.icon} ${ev.name} · fly ${ev.target.toLocaleString()} m`, "quest");
      this.audio.eventStinger();
      // Progress funnel, canonical shape: one `start` per attempt, then exactly
      // one of `complete`/`fail` at the end of the same run.
      this.platform?.measure("quest", "weekly-event", "start");
    }
    if (this.challengeRun === "daily") {
      const c = dailyChallenge(this.today);
      this.hud.toast(`${c.modifier.icon} ${c.title} · ${c.modifier.label}`, "quest");
      this.platform?.measure("quest", "daily-challenge", "start");
    } else if (this.challengeRun.startsWith("gauntlet")) {
      const idx = Number(this.challengeRun.slice(8)) || 0;
      const st = weeklyGauntlet(weekKey()).stages[idx];
      if (st) this.hud.toast(`🌩 Gauntlet ${idx + 1}/3 · ${st.label}`, "quest");
      this.platform?.measure("quest", "gauntlet", "start");
    }
    // Trust rule: wherever the player's own paid advantages are stripped
    // (`fairRace`), the field's hidden catch-up push is stripped too. A ranked
    // result must not be decided by assistance on either side of the race.
    this.massRace.setPackBalancing(!this.fairRace);
    if (flag("adaptiveDifficulty") && !this.fairRace) {
      this.difficultyTune = tuneDifficulty({
        runsPlayed: this.save.state.runsPlayed,
        skill: this.flow.skill,
        lastDistance: this.lastFinishedDistance,
        lastDurationSec: this.lastFinishedDuration,
        recentPlaces: this.recentPlaces,
      }, false);
      this.massRace.setPackIntensity(this.difficultyTune.packCatchupMult);
    } else {
      this.difficultyTune = IDENTITY_TUNE;
      this.massRace.setPackIntensity(1);
    }
    this.setState("playing");
    this.setScreen("main");
    this.camera.setIntro(0);
    this.hint = "HOLD to dive";
    // Funnel: the first launch is the conversion moment, a launch after a death
    // is the retry, and a second run at all is the habit forming.
    this.markFunnel("first_flight");
    if (this.funnel.reached("first_death")) this.markFunnel("first_retry");
    if (this.save.state.runsPlayed >= 1) this.markFunnel("second_run");
    void this.audio.resume();
    this.audio.setMusicMode("play");
    this.telemetry.track("run_start", { mode: this.modeId, seed: this.seed, skin: this.skin.id, boosts: armed.join(",") || "none", gold: this.save.state.gold });
  }

  /**
   * Open the Hangar by itself — once per session, and only when it is news.
   *
   * The shop is where progression is *felt*, and a shop nobody opens is a
   * feature nobody has. But an auto-navigation the player cannot predict is
   * exactly what breaks flow, so this is fenced on every side:
   *   • once per session (`autoShopDone`), never repeatedly;
   *   • only from the main menu — never over a results screen the player is
   *     still reading, never mid-flight, never during a portal break;
   *   • only when a flight just made something affordable that was not
   *     affordable before, so it always has a reason to exist;
   *   • only when the setting is on (default on, one tap off in Settings);
   *   • and it says why, so the player learns the rule instead of guessing.
   */
  private maybeAutoOpenShop(): void {
    if (this.autoShopDone) return;
    if (!this.save.state.settings.autoShop) return;
    if (this.state !== "menu" || this.screen !== "main") return;
    if (this.hidden || this.disposed) return;
    const st = this.save.state;
    // Never interrupt the opening minutes: the first flights belong to flying.
    if (st.runsPlayed < 2) { this.autoShopLastWallet = st.wallet; return; }
    const target = this.newlyAffordableShopItem(this.autoShopLastWallet, st.wallet);
    this.autoShopLastWallet = st.wallet;
    if (!target) return;
    this.autoShopDone = true;
    this.setScreen("shop");
    this.audio.purchase();
    this.hud.toast(t("hud.toast.shopAfford", { name: target.name }, "You can afford {{name}} now — one look, then back to the sky"), "gold");
    this.telemetry.track("shop_auto_open", { item: target.id, price: target.price, wallet: this.save.state.wallet });
    this.bump();
  }

  /**
   * The cheapest unowned item that became affordable between two wallet
   * readings — across gear, trails and birds together, because "the shop has
   * something new for me" is true far more often when all three shelves are
   * scanned as one. Items paid for in gold or gated to VIP/prize shelves are
   * excluded: the wallet cannot actually buy them, so promising otherwise
   * would be a lie the player discovers in one tap.
   */
  private newlyAffordableShopItem(prevWallet: number, wallet: number): { id: string; name: string; price: number } | null {
    if (prevWallet < 0 || wallet <= prevWallet) return null;
    const st = this.save.state;
    let best: { id: string; name: string; price: number } | null = null;
    const consider = (id: string, name: string, price: number, owned: boolean): void => {
      if (owned || price <= 0 || price > wallet || price <= prevWallet) return;
      if (!best || price < best.price) best = { id, name, price };
    };
    for (const def of BOOSTS) consider(def.id, `${def.icon} ${def.name}`, def.price, this.save.hasUpgrade(def.id));
    for (const trail of SHOP_TRAILS) consider(trail.id, `\u2728 ${trail.label} trail`, trail.price, st.tournaments.trails.includes(trail.id));
    for (const skin of SKINS) {
      if (skin.prizeOnly || skin.goldOnly || skin.vipOnly) continue;
      consider(skin.id, skin.name, skin.price, st.ownedSkins.includes(skin.id));
    }
    return best;
  }

  private applyBoost(id: string): void {
    const def = BOOSTS.find((b) => b.id === id);
    switch (id) {
      case "shield":
        this.shield = 1;
        break;
      case "magnet":
        this.magnetTimer = 15;
        break;
      case "sunflask":
        this.daylight += 12;
        break;
      case "stormward":
        this.weather.ward = true;
        break;
      case "hotwings":
        this.enterFever();
        break;
      case "tailwind":
        // The same burst the permanent Sunburst Trigger gives on a double-tap,
        // handed over for free at takeoff. Reusing activateManualBoost keeps
        // the speed curve, the audio and the camera punch identical to a boost
        // the player already knows — a new SKU should feel like more of the
        // good thing, not like an untested one.
        this.activateManualBoost("tailwind");
        break;
      case "daybreak":
        this.daylight += 20;
        break;
      case "luckycoin":
        // Timed, session-only, and announced: the player should be able to see
        // the window they just bought, and coins picked up inside it read x2 in
        // the air (`addRunCoins` prints the awarded number, not the base one).
        const luckySeconds = 20;
        this.save.setCoinBonus(2, luckySeconds);
        this.hud.toast(t("hud.toast.luckyCoin", { n: luckySeconds }, "🍀 LUCKY COIN — double coins for {{n}} s"), "gold");
        this.audio.ding();
        break;
      case "fullhouse": {
        // A bundle, not a new mechanic: the three cheapest consumables in one
        // tap, priced below their parts. Bundles are what make a shop feel
        // generous instead of grindy, and this one cannot desync anything
        // because each half is the same assignment the solo boost makes.
        this.shield = Math.max(this.shield, 1);
        this.magnetTimer = Math.max(this.magnetTimer, 15);
        this.daylight += 12;
        break;
      }
      case "headstart": {
        let hx = this.startX + HEADSTART_DISTANCE;
        for (let i = 0; i < 40; i++) {
          if (this.terrain.slopeAt(hx) < -0.12 && !this.terrain.isOcean(hx)) break;
          hx += 4;
        }
        this.bird.x = hx;
        this.bird.y = this.terrain.heightAt(hx) + BIRD_RADIUS + 3;
        this.bird.vx = 46;
        this.bird.vy = -4;
        this.lastIsland = this.terrain.islandIndex(hx);
        this.island = this.lastIsland;
        this.terrain.update(hx);
        this.camera.snapTo(this.bird);
        break;
      }
      default:
        return;
    }
    if (def) this.hud.toast(`${def.icon} ${def.name} armed`, "power");
  }

  private onDaylightOut(): void {
    this.bird.asleep = true;
    this.daylight = 0;
    // Death drama: the sun wins in slow motion. Reuses the zenith slow-mo
    // plumbing so time restores itself automatically.
    this.timeScale = 0.35;
    this.zenithTimer = 1.1;
    this.camera.punch(0.5);
    this.audio.sleep();
    this.audio.setMusicMode("sleep");
    this.flash("sleep");
    this.fireMoment("sleep", { shout: quip(SLEEP_QUIPS, Math.round(this.bird.x)), always: true });
    const gold = this.save.state.gold;
    const canCoins = this.save.state.wallet >= CONTINUE_COST;
    const canAd = this.portalEnabled()
      ? Boolean(this.platform && this.platform.name !== "none")
      : SIMULATED_BREAKS && !gold && this.ads.isAvailable() && this.save.adsLeftToday() > 0;
    // Honest tiering: free players get 1 second wind, VIP gets 2, and Gold
    // gets what its feature list promises — the sun never wins on a technicality.
    const maxContinues = gold ? 99 : this.save.isVipActive() ? 2 : 1;
    if (this.continuesUsed < maxContinues && (gold || canCoins || canAd)) {
      this.continueTimer = CONTINUE_TIMEOUT;
      // MON-19: the offer is context-driven, not a static button — the framing
      // is chosen from what the run just did (record / near-best / streak /
      // momentum) and falls back to the neutral card. It never changes what is
      // on offer, only why the player might care; the standard non-ad options
      // are rendered beside it either way (MON-05…MON-08).
      const distance = this.lastRunDistance();
      this.continueOfferView = continueOffer({
        distance,
        runCoins: this.runCoins,
        personalBest: this.save.state.bestDistance,
        streakDays: this.save.state.streak.days,
        nearBest: this.save.state.bestDistance > 0 && distance >= this.save.state.bestDistance * 0.85,
        isRecord: this.save.state.bestDistance > 0 && distance > this.save.state.bestDistance,
        altitude: this.bird.y,
        adAvailable: canAd,
      });
      this.setState("continue");
      // Poki game-events: measure the rewarded offer's exposure (visible) so
      // the dashboard can compare it against `interact` when tapped. The label
      // carries the offer kind so placement usage is measurable per context.
      if (this.portalEnabled() && canAd) {
        this.platform?.measure("rewarded", continuePlacementLabel(this.continueOfferView.kind), "visible");
      }
      this.telemetry.track("continue_offer", { kind: this.continueOfferView.kind, distance: Math.round(distance) });
    } else {
      this.finishRun();
    }
  }

  private doContinue(source: string): void {
    this.continuesUsed += 1;
    this.bird.asleep = false;
    this.daylight = CONTINUE_DAYLIGHT;
    this.bird.y = Math.max(this.bird.y, this.terrain.heightAt(this.bird.x) + BIRD_RADIUS + 0.5);
    this.bird.vy = 16;
    this.bird.vx = Math.max(this.bird.vx, 24);
    this.bird.grounded = false;
    this.bird.inWater = false;
    this.particles.emitConfetti(this.bird.x, this.bird.y);
    this.audio.island();
    this.audio.setMusicMode(this.feverOn ? "fever" : "play");
    this.hud.toast("Second wind!", "island");
    this.setState("playing");
    this.telemetry.track("continue_used", { source });
  }

  private finishRun(): void {
    if (this.runRecorded) return;
    this.runRecorded = true;
    this.bird.asleep = true;
    // The rival field is done: drop the (up to 41) frozen birds out of the
    // scene the moment the run ends. They keep drawing behind the results
    // card otherwise, on exactly the frame budget where weak phones die.
    // Rivals stay allocated — the next startRun() re-seeds the field, and
    // the server's official-place echo still needs the local finish times.
    if (this.massRace.active) this.massRace.group.visible = false;
    // Portal game events: one outcome per attempt — `complete` when the run
    // reached its goal, `fail` when it ended by death/elimination/sun-out.
    // (Poki funnel contract: send complete OR fail, never both, and a start
    // without an outcome would break the drop-off funnel.)
    this.platform?.measure("round", this.modeId, this.runOutcome);
    const stats = this.runStats();
    // Every way a flight can end (sun down, water, elimination, surrender)
    // banks through here, so this is the one honest place to mark the death.
    this.markFunnel("first_death");
    this.newBest = this.bestAtStart > 0 && stats.distance > this.bestAtStart;
    // A personal best is the strongest celebration signal there is, and the only
    // one that is about *this* player: `planCelebration` ranks it above every
    // trophy, and its weight maps to Poki's canonical happyTime(1). The adapter
    // used to call `happytime()` — CrazyGames' spelling — which silently did
    // nothing on Poki; the CrazyGames adapter gates on intensity, so the single
    // call this run sends at the end of finishRun() serves both portals.
    if (this.newBest) {
      this.progressEvents.push({ kind: "record", metres: Math.round(stats.distance) });
      this.platform?.measure("player", "personal-best", "reached");
    }
    // The run's moment fingerprint travels with run_end as one compact string
    // ("bonk:2,splash:1") rather than a burst of per-moment events: the funnel
    // needs which kinds a run contained, not 40 identical beacons.
    this.telemetry.track("run_end", {
      mode: this.modeId,
      distance: Math.round(stats.distance),
      newBest: this.newBest,
      moments: Object.entries(this.moments.toJSON())
        .map(([kind, n]) => `${kind}:${n}`)
        .join(","),
      clips: this.clips.recapLine(),
      speedPeak: Math.round(this.speedPeak),
    });

    // A duel abandoned short of the line is a loss — no free retries on rating.
    if (this.duelActive && this.duelResult === "") {
      const res = this.save.recordDuelResult(false, this.today);
      this.duelResult = "lost";
      this.duelDelta = res.delta;
      this.lastRatingDelta = res.delta;
      this.hud.toast(`⚔ Duel lost — never reached the line · ${res.delta} rating`, "warn");
    }

    this.nearMiss = evaluateNearMiss(
      stats.distance,
      this.save.state.bestDistance,
      this.maxAltitude,
      this.save.state.bestAltitude,
      this.launch.best,
      this.save.state.bestCombo,
    );
    this.lastFinishedDistance = stats.distance;
    this.lastFinishedDuration = this.runTime;
    if (this.racePlace > 0) {
      this.recentPlaces.push(this.racePlace);
      if (this.recentPlaces.length > 5) this.recentPlaces.shift();
    }
    this.lastViralScore = viralScore({
      clips: this.clips.toJSON(),
      distance: stats.distance,
      newBest: this.newBest,
      nearMiss: this.nearMiss.kind !== "none",
      photoFinish: Boolean(this.photoFinish),
      perfects: this.perfects,
      crashes: this.clips.count("crash"),
    });
    this.save.noteRecords(this.maxAltitude, this.launch.best);
    this.flow.noteRun(stats.distance, this.perfects, this.launch.goods + this.launch.greats + this.launch.perfects, this.save);

    // Publish this flight to the ghost network (daily seed only, best-per-
    // pilot kept server-side; silent no-op without a backend).
    if (this.seedMode === "today" && !this.versus && !this.seed.startsWith("fly-") && stats.distance > 100) {
      void publishGhost({
        seed: this.seed,
        deviceId: this.save.state.deviceId,
        name: this.racedName(),
        distance: stats.distance,
        samples: this.ghostRecorder.snapshot(),
      });
    }
    // One-off "fresh hills" runs have no stable seed to build a personal best
    // on, so skip ghost recording for them (the ghost only ever replays a
    // run on identical terrain). The seedMode check above already keeps them
    // off the ghost network; this guard keeps them out of local replays too.
    const beatGhost = this.seed.startsWith("fly-") ? false : this.ghostRecorder.commit(this.seed, stats.distance);
    if (beatGhost) {
      this.hud.toast(t("toast.ghost.recorded", undefined, "New personal ghost recorded"), "gold");
      this.telemetry.track("ghost_new", { distance: Math.round(stats.distance) });
    }

    // Global board + weekly cups both score off the same verified run stats.
    this.updateOnboarding();
    this.board.submit({
      deviceId: this.save.state.deviceId,
      name: this.racedName(),
      skin: this.skin.id,
      distance: Math.round(stats.distance),
      altitude: Math.round(this.maxAltitude),
      perfects: this.perfects,
      coins: this.runCoins,
      score: Math.round(this.score()),
      seed: this.seed,
      mode: this.modeId,
    });
    this.boardPage = null;
    // Re-pull the board so the results screen (and the home screen) can show
    // the just-earned rank. Local rows were already updated synchronously, so
    // this resolves to the new standing without a network round-trip.
    void this.refreshBoard(true);
    this.squad?.setPublishStats({ bestDistance: this.save.state.bestDistance, skin: this.skin.id });
    const improvedCups = this.cups.submit(this.modeId, {
      distance: stats.distance,
      altitude: this.maxAltitude,
      perfects: this.perfects,
      coins: this.runCoins,
    });
    for (const cup of improvedCups) this.hud.toast(`${cup.icon} ${cup.name} — new personal best`, "gold");
    this.save.persist();

    this.newlyCompleted = this.missions.applyRun(stats);
    this.claimedQuests = this.missions.claimQuests(this.today, stats);

    // Daily challenge / weekly gauntlet resolution for flagged runs.
    this.challengeOutcome = "";
    // Rival verdict first: same seed, straight distance comparison. Runs on
    // ANY run flown on the rival's hills (the recipient shouldn't need to
    // find a special mode — the link already set the world).
    if (this.rival && this.seed === this.rival.seed && this.rivalResult === "") {
      const won = stats.distance >= this.rival.distance;
      this.rivalResult = won ? "won" : "lost";
      if (won) {
        const bounty = this.save.isVipActive() ? 300 : 150;
        this.save.addCoins(bounty);
        this.challengeOutcome = `🥊 Challenge won! Out-flew ${this.rival.name} (${this.rival.distance} m) · +${bounty} coins`;
        this.hud.toast(this.challengeOutcome, "gold");
        this.audio.island();
      } else {
        this.challengeOutcome = `🥊 ${this.rival.name} still leads — ${Math.round(stats.distance)} m of ${this.rival.distance} m`;
        this.hud.toast("Their mark stands. Fly again.", "warn");
      }
      this.telemetry.track("rival_settled", { won });
    }
    if (this.challengeRun === "daily") {
      const c = dailyChallenge(this.today);
      if (dailyDone(stats, c) && this.save.completeDaily(this.today)) {
        this.save.addCoins(c.reward);
        this.challengeOutcome = `☀ Daily challenge complete · +${c.reward} coins`;
        this.progressEvents.push({ kind: "challenge", variant: "daily", icon: "☀", label: "Daily challenge", coins: c.reward });
        this.platform?.measure("quest", "daily-challenge", "complete");
      } else if (!dailyDone(stats, c)) {
        this.challengeOutcome = `Daily challenge missed — needed ${c.target} ${c.metric}`;
        this.platform?.measure("quest", "daily-challenge", "fail");
      }
    } else if (this.challengeRun.startsWith("gauntlet")) {
      const idx = Number(this.challengeRun.slice(8)) || 0;
      const g = weeklyGauntlet(weekKey());
      const st = g.stages[idx];
      if (st && stageDone(stats, st)) {
        const res = this.save.completeGauntletStage(g.week, idx);
        if (res) {
          this.save.addCoins(st.reward);
          this.challengeOutcome = `🌩 Gauntlet stage ${idx + 1} clear · +${st.reward} coins`;
          this.progressEvents.push({
            kind: "challenge",
            variant: "gauntletStage",
            icon: "🌩",
            label: `Gauntlet stage ${idx + 1}`,
            coins: st.reward,
          });
          // Stage checkpoints are their own progress pair, so a drop-off inside
          // a gauntlet is visible instead of hiding behind the quest event.
          this.platform?.measure("checkpoint", "gauntlet-stage", "complete");
          if (res === "clear") {
            this.save.addCoins(g.clearBonus);
            this.progressEvents.push({ kind: "challenge", variant: "gauntlet", icon: "🏆", label: "Gauntlet", coins: g.clearBonus });
            this.platform?.measure("quest", "gauntlet", "complete");
            if (this.save.ownTrail("trail_gauntlet")) {
              this.progressEvents.push({ kind: "cosmetic", icon: "✨", label: "Stormline trail" });
              this.platform?.measure("cosmetic", "trail-stormline", "unlocked");
            }
            // Gauntlet prize skin: 5 lifetime clears earns the Stormcrow.
            if (this.save.state.challenges.gauntletsCleared >= 5 && !this.save.state.ownedSkins.includes("stormcrow")) {
              this.save.ownSkin("stormcrow");
              this.progressEvents.push({ kind: "cosmetic", icon: "🐦", label: "Stormcrow" });
              this.platform?.measure("cosmetic", "bird-stormcrow", "unlocked");
            }
          }
        }
      } else if (st) {
        this.challengeOutcome = `Gauntlet stage ${idx + 1} missed — needed ${st.target} ${st.metric}`;
        this.platform?.measure("checkpoint", "gauntlet-stage", "fail");
      }
    }

    // Weekly live event: clear = hit the event distance in an event-flagged run.
    if (this.eventRun) {
      const ev = weeklyEvent();
      if (stats.distance >= ev.target) {
        const counts = this.save.recordEventClear(ev.week, monthKey());
        this.save.addCoins(ev.reward);
        this.challengeOutcome = `${ev.icon} ${ev.name} clear ×${counts.week} · +${ev.reward} coins`;
        this.progressEvents.push({ kind: "challenge", variant: "event", icon: ev.icon, label: ev.name, coins: ev.reward });
        // Live-ops was invisible to the portal: Events.ts tracked clears
        // internally and nothing was reported upstream. Canonical Game Events
        // close that, with stable values (`weekly-event`, not the dated key,
        // which would burn measure()'s two-numeric budget).
        this.platform?.measure("quest", "weekly-event", "complete");
        // Monthly theme trail: 3 event clears inside the month.
        const th = monthlyTheme();
        if (counts.month >= THEME_TRAIL_CLEARS && this.save.claimThemeTrail(th.month)) {
          this.platform?.measure("cosmetic", "theme-trail", "unlocked");
          if (this.save.ownTrail(th.prizeTrail)) {
            this.progressEvents.push({
              kind: "cosmetic",
              icon: th.icon,
              label: `${th.name} · ${TRAILS[th.prizeTrail]?.label ?? th.prizeTrail} trail`,
            });
          } else {
            this.save.addCoins(300);
            this.progressEvents.push({ kind: "challenge", variant: "event", icon: th.icon, label: `${th.name} complete`, coins: 300 });
          }
        }
      } else {
        this.challengeOutcome = `${ev.icon} ${ev.name} missed — needed ${ev.target.toLocaleString()} m`;
        this.platform?.measure("quest", "weekly-event", "fail");
      }
    }

    // Mode mastery: every finished run banks progress; level-ups pay coins.
    const mastery = bankMasteryRun(this.save, this.modeId);
    if (mastery) {
      this.progressEvents.push({
        kind: "mastery",
        icon: this.mode.icon,
        mode: this.mode.name,
        level: mastery.level,
        maxed: mastery.skill !== null,
        skill: mastery.skill?.name ?? "",
        coins: mastery.coins,
      });
      if (mastery.skill) {
        this.platform?.measure("achievement", "mode-mastery", "mastered");
      } else {
        // The level number stays out of the event value: a digit run in `what`
        // would spend measure()'s two-numeric budget and compare worse.
        this.platform?.measure("upgrade", "mode-mastery", "level-up");
      }
    }
    const score = this.score();
    // FLIGHT RECAP — the run's altitude profile, drawn on the results card.
    // The ghost recorder already sampled the whole flight; thin it to ~72
    // points and normalize x to metres-from-start.
    {
      const s = this.ghostRecorder.snapshot();
      const pts: [number, number][] = [];
      const step = Math.max(1, Math.floor(s.length / 72));
      for (let i = 0; i < s.length; i += step) pts.push([s[i]![1] - this.startX, s[i]![2]]);
      if (s.length > 0) pts.push([s[s.length - 1]![1] - this.startX, s[s.length - 1]![2]]);
      this.flightPath = pts.length >= 3 ? pts : [];
    }
    const lifetimeBefore = this.save.state.lifetime.distance;
    this.save.recordRun(stats.distance, this.runCoins, score, this.today, this.island, this.terrain.biomeAt(this.bird.x).id);
    // Poki's own leaderboards (the SDK's init({ submitScore }) handshake) get
    // the same run distance — best-effort, alongside the AUDS board the game
    // UI reads. A platform without the handshake ignores it.
    if (this.platform) void this.platform.submitPlatformScore(stats.distance);
    // CAREER WINGS promotion — a lifetime rank-up is rare; make it land.
    const promo = wingsPromotion(lifetimeBefore, this.save.state.lifetime.distance);
    if (promo) {
      // Fanfare, confetti and the words belong to the celebration plan now: it
      // ranks a rank-up above every trophy except a personal best, and fires one
      // cue for the whole run instead of one per ladder that moved.
      this.progressEvents.push({ kind: "wings", tierId: promo.id, icon: promo.icon, name: promo.name });
      this.telemetry.track("wings_promo", { tier: promo.id });
    }
    this.save.addLifetimeZeniths(stats.zenith);
    this.save.addLifetimeSunflowers(this.runSunflowers);
    // distance XP is awarded at the end; everything else accrued live during the flight
    this.awardXp(Math.round(stats.distance * XP_RULES.perMetre));
    const tierBefore = this.seasonPass.tier();
    this.flushXp();
    const tierAfter = this.seasonPass.tier();
    const xp = this.seasonPass.xp();
    const newTrophies = this.achievements.checkNew();
    // celebrate=false: the run's one celebration signal is fired below at the
    // peak of everything the flight earned, not once per trophy.
    for (const trophy of newTrophies) this.portalAchievement(trophy.id, false);
    this.checkPrizeSkins();

    // Poki game-events: the rewarded bonus card is on the recap — measure its
    // exposure once so the dashboard can pair it with the tap's `interact`.
    if (this.portalEnabled() && this.runCoins > 0 && !this.multiplierClaimed) {
      this.platform?.measure("rewarded", "results-coin-multiplier", "visible");
    }
    this.telemetry.track("run_end", {
      distance: Math.round(stats.distance),
      score: Math.round(score),
      coins: this.runCoins,
      islands: stats.island,
      zeniths: stats.zenith,
      xp,
      speedPeak: Math.round(this.speedPeak),
      viral: this.lastViralScore,
      clips: this.clips.recapLine(),
    });

    if (tierAfter > tierBefore) this.progressEvents.push({ kind: "pass", tier: tierAfter });
    if (this.claimedQuests.length) {
      this.progressEvents.push({
        kind: "quest",
        count: this.claimedQuests.length,
        coins: this.claimedQuests.reduce((a, q) => a + q.reward, 0),
      });
    }
    if (this.newlyCompleted.length) {
      this.progressEvents.push({ kind: "nest", level: this.save.state.nestLevel, mult: this.save.nestMultiplier() });
    }
    for (const trophy of newTrophies) {
      this.progressEvents.push({ kind: "trophy", id: trophy.id, title: trophy.title, rarity: trophy.rarity });
    }

    // ONE celebration for everything this flight grew: ranked, staggered, capped,
    // and rendered on the results card, which is where the player is already
    // looking. The toast layer caps at two pills and evicts the oldest to hold
    // that cap, so the old burst routinely deleted the rarest thing a run earned
    // — a Platinum trophy or a lifetime rank-up — two statements before it fired
    // a "+2% coins in mode" line. Progression was not under-celebrated; it was
    // celebrated eleven times at once, which reads the same as never.
    this.celebration = planCelebration(this.progressEvents);
    if (this.celebration.fanfare) this.audio.fanfare();
    else if (this.celebration.chime) this.audio.milestone();
    if (this.celebration.confetti > 0) {
      this.particles.emitConfetti(this.bird.x, this.bird.y + 4, this.celebration.confetti);
    }
    // Poki's happyTime is one signal per moment at the peak of what happened: a
    // personal best still sends 1, and four ladders moving at once no longer send
    // four competing calls (the guide asks for it sparingly).
    if (this.celebration.peak > 0) this.platform?.happyTime(this.celebration.peak);
    this.telemetry.track("progress_celebration", {
      staged: this.celebration.staged.length,
      folded: this.celebration.ledger.length,
      peak: Math.round(this.celebration.peak * 100) / 100,
      top: this.celebration.staged[this.celebration.staged.length - 1]?.event.kind ?? "none",
    });

    const runs = this.save.state.runsPlayed;
    // The direct build only schedules a break when SIMULATED_BREAKS is on:
    // with no ad network wired in, a "break" would be a fake ad state that
    // interrupts a run to show nothing (and Gold would sell its removal).
    const dueAd =
      !this.portalEnabled() && SIMULATED_BREAKS && !this.save.state.gold && this.save.shouldShowInterstitial(runs);
    if (dueAd && !this.skipInterstitialOnce && this.ads.isAvailable()) {
      this.adReason = "interstitial";
      this.adTimer = this.ads.duration;
      this.telemetry.track("ad_shown", { reason: "interstitial" });
      this.setState("ad");
    } else {
      this.setState("gameover");
      this.maybeNudgeStarter();
    }
    this.skipInterstitialOnce = false;
  }

  /** Legend prize skin: reaching the top division earns the Solstice bird. */
  private checkDivisionPrize(): void {
    const div = divisionFor(this.save.state.rival.rating);
    if (div.id === "legend" && !this.save.state.ownedSkins.includes("solstice")) {
      this.save.ownSkin("solstice");
      this.hud.toast("🐦 Solstice unlocked — welcome to Sunbird Legend!", "gold");
      this.flash("perfect");
    }
  }

  private endAd(): void {
    this.save.recordAdImpression(this.save.state.runsPlayed);
    this.telemetry.track("ad_completed", { reason: this.adReason, left: this.save.adsLeftToday() });
    if (this.adReason === "continue") this.doContinue("ad");
    else this.setState("gameover");
  }

  /** Day rollover while the tab stays open: new hills, new quests, fresh streak. */
  private dayTick(raw: number): void {
    this.dayTimer += raw;
    if (this.dayTimer < 2) return;
    this.dayTimer = 0;
    const now = this.save.isVipActive();
    if (this.vipActive && !now) {
      this.vipActive = false;
      this.vipExpiredNotice = true;
      this.hud.toast(t("hud.toast.vipExpired", undefined, "VIP expired — perks paused"), "warn");
      this.telemetry.track("vip_expired", {});
      this.bump();
    } else if (!this.vipActive && now) {
      this.vipActive = true;
      this.bump();
    }
    const today = dateSeed();
    if (today === this.today) return;
    const yesterday = this.today;
    this.today = today;
    const reward = this.save.touchStreak(today, yesterday);
    const gift = this.save.claimVipDaily(today);
    // Monthly ranked season rollover: soft reset + peak-division reward.
    const seasonEnd = this.save.ensureRankSeason();
    if (seasonEnd) this.hud.toast(`⚔ Ranked season over · ${seasonEnd.division} reward +${seasonEnd.coins} coins`, "gold");
    // Only swap hills while resting in the menu — a midnight rollover mid-run
    // must never yank the terrain out from under a live flight.
    if (this.state === "menu" && this.seedMode === "today") this.rebuildWorld(today);
    if (reward > 0) this.hud.toast(t("hud.toast.streakDay", { n: this.save.state.streak.days, c: reward }, "Day {{n}} streak · +{{c}} coins"), "gold");
    if (gift > 0) this.hud.toast(t("hud.toast.vipGift", { n: gift }, "VIP daily gift · +{{n}} coins"), "vip");
    this.hud.toast(t("hud.toast.newHills", undefined, "New hills today"), "island");
    this.telemetry.track("day_rollover", { date: today });
    this.bump();
  }

  private awardXp(amount: number): void {
    this.pendingXp += amount;
  }

  private flushXp(): void {
    if (this.pendingXp <= 0) return;
    this.seasonPass.addXp(this.pendingXp);
    this.pendingXp = 0;
  }

  private resetRun(idle: boolean): void {
    this.attractPilot.reset();
    this.flightCues.reset();
    this.masteryPerk = this.fairRace ? NO_MASTERY_PERKS : masteryPerks(this.save, this.modeId);
    // Shared/daily/ranked seeds must not depend on an individual save's skill.
    // Apply adaptive calibration only to an unshared casual flight, before sampling spawn.
    this.terrain.setDifficulty(!isRaceMode(this.modeId) && this.seed.startsWith("fly-") ? this.flow.difficulty() : 1);
    const course = isRaceMode(this.modeId) ? this.courseForRace() : null;
    this.startX = course ? course.island * ISLAND_PERIOD + 64 : 64;
    const y = this.terrain.heightAt(this.startX) + BIRD_RADIUS;
    this.bird.reset(this.startX, y);
    if (this.modeId === "pvp_sprint" || this.modeId === "pvp_typhoon") {
      this.bird.vx = 42;
    }
    this.nextKnockoutDist = 500;
    this.knockoutWarned = false;
    this.daylight = this.daylightMax();
    this.island = course ? course.island : 0;
    this.lastIsland = course ? course.island : 0;
    this.perfects = 0;
    this.perfectChain = 0;
    this.skimTime = 0;
    this.skimCd = 0;
    // Warm the surprise engine for a brand-new pilot: one delight inside the
    // first ~20 s of the first flights, normal rarity from the second surprise.
    this.surprises.reset({ warm: !idle && this.save.state.runsPlayed < 2 });
    this.surpriseRng = new SeededRandom(`${this.seed}:surprises`);
    this.feverTimer = 0;
    this.feverOn = false;
    this.feverReached = false;
    this.prevVy = 0;
    this.bonus = 0;
    this.scoreAccum = 0;
    this.splashCd = 0;
    this.thudCount = 0;
    this.bounceCount = 0;
    this.moments.resetRun();
    this.clips.resetRun();
    this.lastViralScore = 0;
    this.difficultyTune = IDENTITY_TUNE;
    this.momentLastAt = {};
    this.weeState = WEE_IDLE;
    this.speedPeak = 0;
    this.wasInWater = false;
    this.hintTimer = 0;
    this.hint = idle ? "" : "HOLD to dive";
    this.runCoins = 0;
    this.multiplierClaimed = false;
    this.runClouds = 0;
    this.zeniths = 0;
    this.pickups = 0;
    this.runRings = 0;
    this.ringChain = 0;
    this.ringChainTimer = 0;
    this.slopeChain.reset();
    this.dustCooldown = 0;
    this.runBalloons = 0;
    this.runSunflowers = 0;
    this.pendingXp = 0;
    this.xpFlush = 0;
    this.trailFxAcc = 0;
    this.powerFxAcc = 0;
    this.trail.clear();
    this.magnetTimer = 0;
    this.shield = 0;
    this.boostTimer = 0;
    this.manualBoostCooldown = 0;
    this.wasDiving = false;
    this.wasDrafting = false;
    this.continuesUsed = 0;
    this.continueTimer = 0;
    this.timeScale = 1;
    this.zenithTimer = 0;
    this.hitStopTimer = 0;
    this.runRecorded = false;
    this.newlyCompleted = [];
    this.claimedQuests = [];
    this.menuHold = 0;
    this.needRelease = true;
    this.runTime = 0;
    // The arc restarts from silence so every launch gets the swell: the band
    // arriving with the player is the beat, and it only reads if it starts low.
    this.arcIntensity = 0;
    this.arcWritten = 0;
    this.ghostWasAhead = false;
    this.ghostPassed = false;
    this.lastBiomeId = idle ? "" : this.terrain.biomeAt(this.startX).id;
    this.ghostRecorder.reset();
    this.ghostPlayer.reset();
    this.rivalGhostPlayer.reset();
    this.rivalGhostPlayer.loadRecord(null);
    this.rivalGhostPassed = false;
    this.runEpoch += 1;
    if (!idle) {
      this.ghostPlayer.load(this.seed);
      this.rivalGhostSynthetic = false;
      // A rival is not a feature, it is the loop: every solo flight gets
      // somebody to chase. Best case that is a REAL pilot's flight on the same
      // hills (async PvP - no matchmaking, no waiting). When the backend has no
      // answer (cold cache, portal build, dead network, first ever session) a
      // deterministic pace ghost takes the slot instead, aimed just past the
      // player's own best so the chase is winnable and worth something.
      if (!this.versus && !this.massRace.active) this.armRivalGhost();
    }
    this.launch.reset();
    this.powers.reset();
    this.runGems = 0;
    this.recordBanner = "";
    this.goalPop = "";
    this.goalPopT = 0;
    this.goalPopKind = "goal";
    this.popQueue = [];
    this.runGoalsDone = 0;
    this.rankUp = "";
    this.rankUpKind = "rank";
    this.rankUpT = 0;
    this.rankCued = false;
    this.bannerQueue = [];
    this.questRowsPrev = [];
    this.questPollT = 0;
    this.maxAltitude = 0;
    this.maxSpeed = 0;
    this.launchBannerT = 0;
    this.launchBannerText = "";
    this.lastLaunch = null;
    this.altZone = 0;
    this.countdown = 0;
    this.networkStartAt = 0;
    this.versusGrace = 5;
    this.collect.reset();
    this.weather.reset();
    // Skin-borne weather perks: weatherproof birds fly warded, stealth birds slip past hazards.
    this.weather.ward = this.gameplaySkin.weatherProof ?? false;
    this.weather.stealth = this.gameplaySkin.stealth ?? false;
    this.particles.clear();
    this.terrain.update(this.startX);
    if (idle) this.camera.setIntro(1);
    else this.camera.snapTo(this.bird);
  }

  /* --------------------------------------------------------------- actions */

  private handleAction(action: string, id: string): void {
    void this.audio.resume();
    switch (action) {
      case "spin-wheel": {
        if (!this.save.canFreeWheelSpin(this.today)) {
          this.hud.toast("Wheel spin on cooldown until tomorrow", "info");
          break;
        }
        const sectorIndex = Math.floor(Math.random() * WHEEL_SECTORS.length);
        const sector = WHEEL_SECTORS[sectorIndex]!;
        this.save.recordWheelSpin(this.today);
        if (sector.kind === "coins" && typeof sector.value === "number") {
          this.save.addCoins(sector.value);
          this.hud.toast(`🎡 Wheel landed on ${sector.label}! +● ${sector.value}`, "gold");
        } else if (sector.kind === "boost") {
          this.save.armBoost("sunflask");
          this.hud.toast(`🎡 Wheel landed on ${sector.label}! Sun Flask Armed!`, "gold");
        } else if (sector.kind === "vault") {
          this.buyMysteryVault();
          this.hud.toast(`🎰 Wheel landed on Vault Key!`, "gold");
        }
        this.audio.fanfare();
        this.bump();
        break;
      }
      case "smash-piggy": {
        const smashed = this.save.smashPiggyBank();
        if (smashed > 0) {
          this.audio.fanfare();
          this.hud.toast(`🐷 Smashed Piggy Bank! +● ${smashed} coins!`, "gold");
        } else {
          this.hud.toast("Piggy Bank is empty!", "info");
        }
        this.bump();
        break;
      }
      case "perform-prestige": {
        if (this.save.performPrestige()) {
          this.audio.chapterFanfare();
          const p = this.save.state.prestige?.multiplier ?? 1.0;
          this.hud.toast(`👑 Reborn with Solar Crown! Permanent ×${p.toFixed(1)} Coin Multiplier!`, "gold");
        } else {
          this.hud.toast("Need ● 50,000 coins to ascend Solar Crown prestige!", "warn");
        }
        this.bump();
        break;
      }
      case "multiply-run-coins": {
        // One claim per run. The old handler tripled runCoins on every click
        // and the card re-armed from the live snapshot — an infinite 3× coin
        // loop. Now it pays the bonus once and the card flips to a claimed
        // chip (renderCoinMultiplierCard). On portals the bonus is the
        // results-screen REWARDED placement (optional value, reward stated on
        // the card); a declined ad leaves the card armed, never punishes.
        if (this.state === "gameover" && !this.multiplierClaimed && this.runCoins > 0) {
          const platform = this.platform;
          if (this.portalEnabled() && platform && platform.name !== "none") {
            platform.measure("rewarded", "results-coin-multiplier", "interact");
            this.beginPortalBreak("results-multiplier");
            void this.multiplierWithPortalReward();
          } else {
            const flightMultiplier = 3;
            const bonus = this.runCoins * (flightMultiplier - 1);
            this.multiplierClaimed = true;
            this.save.addCoins(bonus);
            this.audio.chapterFanfare();
            this.hud.toast(t("hud.toast.flightBonus", { m: flightMultiplier, n: bonus }, "{{m}}× flight bonus — +● {{n}} coins"), "gold");
          }
        }
        this.bump();
        break;
      }
      case "mode-select":
        this.setScreen("modes");
        break;
      case "pick-mode": {
        // Route by intent (see launchRouting.ts): solo modes start a run, the
        // mass race opens the lobby, and a PvP circuit opens the PvP OPTIONS
        // with that circuit preselected. A card labelled PvP must never drop
        // the player straight into an offline AI race.
        const intent = launchIntentFor(id);
        if (intent === "lobby") { this.setScreen("live"); break; }
        if (intent === "pvp-options") {
          const circuit = pvpCircuitFor(id);
          if (circuit) {
            this.selectedPvpMode = circuit;
            this.mode = modeById(circuit);
            this.hud.toast(`${this.mode.icon} ${this.mode.name} selected — ranked, casual, a room, or the AI flock`, "gold");
          }
          this.setScreen("live");
          this.bump();
          break;
        }
        this.modeId = (id || "daytrip") as ModeId;
        this.mode = modeById(this.modeId);
        this.exitVersus();
        this.startRun();
        break;
      }
      case "ai-pvp": {
        // The explicit offline route: race the neural flock right now, on the
        // card's circuit when it names one, otherwise on the last selection.
        const circuit = pvpCircuitFor(id) ?? this.selectedPvpMode;
        const m = modeById(circuit);
        this.selectedPvpMode = m.id;
        this.modeId = m.id;
        this.mode = m;
        this.exitVersus();
        this.cancelMatchmaking();
        this.disconnectRace();
        this.roomCode = "";
        this.rankedRace = false;
        this.hud.toast(`🤖 AI PvP · ${m.icon} ${m.name} vs the flock`, "info");
        this.launchMatch({ ranked: false, storm: m.id === "pvp_typhoon" }, true);
        break;
      }
      case "versus":
        this.startVersus();
        break;
      case "start":
        if (this.state !== "ad" && this.state !== "continue") this.startRun();
        break;
      case "retry":
        if (this.state === "gameover") this.replayRun(true);
        break;
      case "pause":
        if (this.state === "playing") this.setState("paused");
        break;
      case "toggle-fullscreen":
        this.toggleFullscreen();
        break;
      case "resume":
        // If the user hit resume (or ESC) while browsing a pause sub-screen,
        // first drop back to the plain pause card rather than flying off
        // unexpectedly. A second resume press/ESC gets them back to flight.
        if (this.state === "paused" && this.screen !== "main") {
          this.closePauseScreen();
          break;
        }
        void this.resumeFromPause();
        break;
      case "restart-flight":
        if (this.state === "paused" || this.state === "playing") {
          if (this.state === "paused") this.closePauseScreen();
          this.replayRun(false);
        }
        break;
      case "menu":
        // From a pause sub-screen, "Exit to menu" first closes the sub-screen so
        // the confirmation flow (goToMenu returns to menu state) starts clean.
        if (this.state === "paused") this.closePauseScreen();
        this.exitVersus();
        if (this.state === "gameover" && this.portalEnabled() && this.platform && this.platform.name !== "none") {
          // Leaving the recap for the menu is one of Poki's documented
          // commercial-break points ("back to the main menu"); the SDK
          // frequency-caps how often a real ad actually serves. The request
          // telemetry is emitted by beginPortalBreak("to-menu") inside, so this
          // path does not track it a second time.
          void this.menuAfterPortalBreak();
          break;
        }
        this.goToMenu();
        break;
      case "pause-to": {
        // Navigate into a menu sub-screen WITHOUT forfeiting the paused run.
        // Only valid during pause; otherwise fall through to setScreen below.
        const target = id as UiScreen;
        if (this.state === "paused") this.openPauseScreen(target);
        else this.setScreen(target);
        break;
      }
      case "open-practice":
        this.setScreen("practice");
        break;
      case "practice-ranked":
      case "practice-storm":
        this.roomCode = "";
        this.launchMatch({ ranked: true, storm: action === "practice-storm" }, true);
        break;
      case "open-progress":
        this.setScreen("progress");
        break;
      case "open-shop":
        this.setScreen("shop");
        break;
      case "open-paywall":
        if (!SELL_AD_REMOVAL) break;
        this.restoreMessage = "";
        this.setScreen("paywall");
        this.telemetry.track("paywall_open", { from: this.state });
        break;
      case "open-settings":
        this.setScreen("settings");
        break;
      case "open-privacy":
        // In-game screen, not a link out: portals sandbox the iframe, so a
        // popup is a dead button for exactly the players the policy protects.
        // `legal.ts` renders the same document the hosted page is built from.
        this.setScreen("privacy");
        this.telemetry.track("privacy_open", { from: this.state });
        break;
      case "open-privacy-url":
        // The hosted copy, opened through the portal's own external-link API —
        // never window.open, never top-level navigation. Rendered only when the
        // SDK advertises the capability, so this cannot be a dead button.
        if (this.platform && /^https?:\/\//i.test(PRIVACY_POLICY_URL)) {
          this.platform.openExternalLink(PRIVACY_POLICY_URL);
          this.telemetry.track("privacy_open_hosted", { portal: this.platform.name });
        }
        break;
      case "open-scores":
        this.setScreen("scores");
        break;
      case "open-pass":
        this.flushXp();
        this.setScreen("pass");
        break;
      case "vip-dismiss":
        this.vipExpiredNotice = false;
        this.bump();
        break;
      case "open-trophies":
        this.setScreen("trophies");
        break;
      case "open-account":
        this.referralMessage = "";
        this.cloudMessage = "";
        this.setScreen("account");
        break;
      case "open-atlas":
        this.setScreen("atlas");
        break;
      case "open-board":
        this.setScreen("board");
        void this.refreshBoard();
        break;
      case "open-cups":
        this.setScreen("cups");
        break;
      case "board-scope":
        this.boardScope = (id as BoardScope) || "global";
        void this.refreshBoard();
        break;
      case "board-metric":
        this.boardMetric = (id as BoardMetric) || "distance";
        void this.refreshBoard();
        break;
      case "board-refresh":
        void this.refreshBoard(true);
        break;
      case "open-portal-leaderboard": {
        // Poki's own leaderboard overlay (SDK showLeaderboard) — the platform
        // renders and owns it, so there is nothing to guard beyond offering the
        // button only when the capability is reported.
        this.platform?.showLeaderboard();
        this.platform?.measure("button", "portal-leaderboard", "interact");
        this.telemetry.track("portal_leaderboard_open", { portal: this.platform?.name ?? "none" });
        break;
      }
      case "rename-pilot": {
        // Portal builds with CUSTOM_PILOT_NAMES allow free text, but all
        // player-typed names must pass the profanity filter before being
        // broadcast to other players. Direct/web builds own their surfaces
        // and keep free rename without filtering.
        const freeText = CUSTOM_PILOT_NAMES;
        const requested = (this.hud.readValue("pilotName") || this.pilotName).trim();
        if (freeText && !isPilotNameClean(requested)) {
          this.hud.toast("That call sign isn't allowed — try a different one", "warn");
          break;
        }
        const chosen = freeText ? requested : generatePilotName();
        const next = savePilotName(chosen);
        this.pilotName = next;
        this.save.state.pilotName = next;
        this.save.state.pilotNameCustomized = true;
        if (freeText) this.hud.setValue("pilotName", next);
        this.save.persist();
        this.hud.toast(`Flying as ${next}`, "info");
        void this.refreshBoard(true);
        break;
      }
      case "autogen-pilot": {
        const gen = generatePilotName();
        this.hud.setValue("pilotName", gen);
        const next = savePilotName(gen);
        this.pilotName = next;
        this.save.state.pilotName = next;
        this.save.state.pilotNameCustomized = true;
        this.save.persist();
        this.hud.toast(`Generated Pilot Name: ${next}`, "info");
        void this.refreshBoard(true);
        break;
      }
      case "set-language": {
        if (id) {
          // Pack loads before the re-render: UI never paints half-switched
          // text, and the confirmation toast lands once strings are live.
          void setLocale(id as SupportedLocale).then(() => {
            this.hud.toast(t("hud.settings.languageUpdated", undefined, "Language updated"), "info");
            this.bump();
          });
        }
        break;
      }
      case "set-dist-unit": {
        if (id === "km" || id === "mi") {
          this.save.state.settings.distUnit = id;
          this.save.persist();
          this.hud.toast(`Distances shown in ${id}`, "info");
          this.bump();
        }
        break;
      }
      case "confirm-pilot-name": {
        if (!CUSTOM_PILOT_NAMES) {
          // Portal editions render no typing surface, so the curated generated
          // name on the plate *is* the name. Falling through to the free-text
          // guard below would toast "Please enter a pilot name" forever and trap
          // a first-run player on the welcome screen with no way out. The
          // typed-name easter eggs are skipped with it — there is nothing typed,
          // and "sunbird" awarding coins would otherwise be free to farm.
          const curated = savePilotName(this.pilotName);
          this.pilotName = curated;
          this.save.state.pilotName = curated;
          this.save.state.pilotNameCustomized = true;
          this.save.persist();
          this.audio.fanfare();
          this.hud.toast(`Welcome, ${curated}!`, "info");
          this.setScreen("main");
          break;
        }
        const nameInput = this.hud.readValue("pilotNameInput");
        if (!nameInput || !nameInput.trim()) {
          this.hud.toast("Please enter a pilot name", "warn");
          break;
        }
        if (!isPilotNameClean(nameInput.trim())) {
          this.hud.toast("That call sign isn't allowed — try a different one", "warn");
          break;
        }
        const next = savePilotName(nameInput);
        this.pilotName = next;
        this.save.state.pilotName = next;
        this.save.state.pilotNameCustomized = true;
        this.save.persist();
        this.audio.fanfare();
        // Easter egg: secret pilot names
        const nameLower = next.toLowerCase();
        if (nameLower === "icarus") {
          this.hud.toast("🌊 Too close to the sun, Icarus…", "warn");
        } else if (nameLower === "phoenix") {
          this.hud.toast("🔥 Rise from the ashes, Phoenix!", "gold");
        } else if (nameLower === "sunbird") {
          this.hud.toast("🌟 You ARE the Sunbird.", "gold");
          this.save.addCoins(DAILY_STIPEND);
        } else {
          this.hud.toast(`Welcome, ${next}!`, "info");
        }
        this.setScreen("main");
        break;
      }
      case "randomize-pilot-name": {
        const gen = generatePilotName();
        if (CUSTOM_PILOT_NAMES) {
          // Free-text build: fill the field and let "Let's Fly" commit it, so a
          // player can keep rolling without each roll silently saving.
          this.hud.setValue("pilotNameInput", gen);
          break;
        }
        // Portal build: there is no field to fill, so `setValue` would be a
        // no-op and the dice would be dead. Commit the roll and re-render the
        // plate instead. `pilotNameCustomized` stays false until the player
        // confirms, so a reload still lands on the welcome screen.
        const next = savePilotName(gen);
        this.pilotName = next;
        this.save.state.pilotName = next;
        this.save.persist();
        this.bump();
        break;
      }
      case "claim-rank-prize": {
        // One prize per monthly season: the board re-renders from the live
        // snapshot, so an unguarded claim button was an infinite coin loop.
        const season = rankSeasonId();
        if (this.save.state.rankPrizeSeason === season) {
          this.hud.toast("Rank prize claimed — the next season starts a fresh one", "info");
          break;
        }
        const reward = seasonReward(this.save.state.rival.rating);
        this.save.state.rankPrizeSeason = season;
        this.save.persist();
        this.save.addCoins(reward.coins);
        this.hud.toast(`Claimed ${reward.coins} Coins for ${reward.division.name} Rank! 🏆`, "achievement");
        this.audio.fanfare();
        this.bump();
        break;
      }
      case "claim-cup": {
        const grant = this.cups.claim(id);
        if (!grant) break;
        this.applyPrize(grant);
        break;
      }
      case "equip-trail":
        this.save.equipTrail(this.save.state.activeTrail === id ? "" : id);
        this.audio.ding();
        this.bump();
        break;
      case "race-40":
        this.modeId = "massrace";
        this.mode = modeById("massrace");
        this.exitVersus();
        this.startRun();
        break;
      case "emote":
        this.sendEmote(id || "👋");
        break;
      case "host-room": {
        if (!isMultiplayerConfigured()) {
          this.hud.toast("Live rooms are not available in this edition", "warn");
          break;
        }
        this.disconnectRace();
        this.localRace = false;
        this.roomCode = makeRoomCode();
        this.joiningRemoteRoom = false;
        this.modeId = this.selectedPvpMode;
        this.mode = modeById(this.selectedPvpMode);
        this.rankedRace = false;
        this.setScreen("live");
        this.preseatLobby();
        this.hud.toast(`Flock room ${this.roomCode} ready!`, "gold");
        this.bump();
        break;
      }
      case "join-room": {
        if (!isMultiplayerConfigured()) {
          this.hud.toast("Live rooms are not available in this edition", "warn");
          break;
        }
        const code = normalizeRoomCode(this.hud.readValue("roomCode"));
        if (!code) {
          this.hud.toast("Enter a 5-letter room code", "warn");
          break;
        }
        this.disconnectRace();
        this.localRace = false;
        this.roomCode = code;
        this.joiningRemoteRoom = true;
        this.modeId = this.selectedPvpMode;
        this.mode = modeById(this.selectedPvpMode);
        this.rankedRace = false;
        this.setScreen("live");
        this.preseatLobby();
        this.hud.toast(`Joined room ${code}`, "gold");
        this.bump();
        break;
      }
      case "select-pvp-mode": {
        const mId = (id as ModeId) || "pvp_sprint";
        this.selectedPvpMode = mId;
        this.modeId = mId;
        this.mode = modeById(mId);
        // Selecting a new format while already in a private room MUST move
        // you to a new room code — the existing room's seed is pinned to the
        // old format on the server, so staying connected would have you
        // flying Sprint while your invitees queued for Slalom. Same safety
        // applies mid-matchmaking: tear down so the next preseating uses the
        // new seed.
        if (this.roomCode || this.mmOpts) {
          this.cancelMatchmaking();
          this.disconnectRace();
          this.roomCode = this.roomCode ? makeRoomCode() : "";
          if (this.roomCode) {
            this.preseatLobby();
            this.hud.toast(`New room ${this.roomCode} · ${this.mode.icon} ${this.mode.name}`, "gold");
          }
        }
        this.hud.toast(`${this.mode.icon} ${this.mode.name}`, "gold");
        this.bump();
        break;
      }
      case "select-pvp-world": {
        const wId = id || "emerald";
        this.selectedPvpWorld = wId;
        this.selectedCourse = PVP_WORLDS.find((w) => w.id === wId) ?? PVP_WORLDS[0]!;
        // Same reseed safety as select-pvp-mode: changing the world while
        // seated pins a fresh room code so the seed reflects the new course.
        if (this.roomCode || this.mmOpts) {
          this.cancelMatchmaking();
          this.disconnectRace();
          this.roomCode = this.roomCode ? makeRoomCode() : "";
          if (this.roomCode) {
            this.preseatLobby();
            this.hud.toast(`New room ${this.roomCode} · ${this.selectedCourse.emoji} ${this.selectedCourse.name}`, "gold");
          }
        }
        this.hud.toast(`${this.selectedCourse.emoji} ${this.selectedCourse.name}`, "gold");
        this.bump();
        break;
      }
      case "quick-match-shuffle": {
        // "Just make it random": one tap picks a random format AND world so
        // the big button is always the fastest path into a race.
        const m = PVP_MODES[Math.floor(Math.random() * PVP_MODES.length)]!;
        const w = PVP_WORLDS[Math.floor(Math.random() * PVP_WORLDS.length)]!;
        this.selectedPvpMode = m.id;
        this.selectedPvpWorld = w.id;
        this.selectedCourse = w;
        this.modeId = m.id;
        this.mode = m;
        this.hud.toast(`🎲 ${m.icon} ${m.name} on ${w.emoji} ${w.name}`, "gold");
        this.bump();
        break;
      }
      case "quick-match-instant": {
        // "Quick Match" is the one-tap ONLINE path: it seats the player in
        // public matchmaking for the chosen circuit. It used to force a local
        // AI race (launchMatch(..., true)) while sitting under a "40 pilots,
        // ready now" hero — the player asked for a PvP race and got bots.
        // beginMatchmaking falls back to the AI flock only when no transport
        // exists in this runtime, and now says so when it does.
        const mode = modeById(this.selectedPvpMode);
        this.modeId = mode.id;
        this.mode = mode;
        this.beginMatchmaking({ ranked: true, storm: mode.id === "pvp_typhoon" });
        break;
      }
      case "start-room-now": {
        this.modeId = this.selectedPvpMode;
        this.mode = modeById(this.selectedPvpMode);
        // With real pilots seated, the room launches together: the transport
        // issues ONE shared start (a 6s countdown for everyone) instead of the
        // host racing off alone while guests watch an empty sky.
        const seatedWithPilots = Boolean(this.net) && this.net!.connected && this.liveCount() > 0;
        if (this.net) this.net.startNow();
        if (seatedWithPilots) {
          this.hud.toast("Launching together — every pilot gets the countdown", "gold");
        } else {
          this.launchMatch({ ranked: false, storm: this.modeId === "pvp_typhoon" }, false);
        }
        break;
      }
      case "copy-invite": {
        if (this.roomCode) this.copyRoomInvite(this.roomCode);
        else this.hud.toast("Host a room first to get an invite link", "warn");
        break;
      }
      case "start-room":
      case "ready-room": {
        if (!this.roomCode) {
          this.roomCode = makeRoomCode();
        }
        this.modeId = this.selectedPvpMode;
        this.mode = modeById(this.selectedPvpMode);
        this.rankedRace = false;
        this.preseatLobby();
        if (this.net) {
          const isReady = !this.net.info().ready;
          this.net.sendReady(isReady);
          this.hud.toast(isReady ? "You are ready! ✓" : "Ready cancelled", "gold");
        } else {
          this.hud.toast("Starting race flock…", "info");
          this.launchMatch({ ranked: false, storm: this.modeId === "pvp_typhoon" }, true);
        }
        this.bump();
        break;
      }
      case "quick-match":
      case "pvp-ranked":
        this.beginMatchmaking({ ranked: true, storm: false });
        break;
      case "pvp-storm":
        this.beginMatchmaking({ ranked: true, storm: true });
        break;
      case "mm-cancel":
        this.cancelMatchmaking();
        break;
      case "mm-ready": {
        // Explicit opt-in to a live start. The race launches only once every
        // seated pilot is ready, then counts down 6s for everyone.
        if (this.net?.state === "lobby") {
          const nowReady = !this.net.info().ready;
          this.net.sendReady(nowReady);
          this.hud.toast(nowReady ? "You are ready! ✓" : "Ready cancelled", "gold");
          this.bump();
        }
        break;
      }
      case "mm-ai":
        // Explicit opt-in only: the search never drops a pilot into a bot race.
        this.takeAiFlock();
        break;
      case "mm-keep-search":
        this.keepSearching();
        break;
      case "pvp-duel":
        this.roomCode = "";
        this.modeId = "massrace";
        this.mode = modeById("massrace");
        this.rankedRace = false;
        this.startRun({ duel: true });
        break;
      case "play-daily": {
        const c = dailyChallenge(this.today);
        if (this.save.isDailyDone(this.today)) {
          this.hud.toast("Today's challenge is already complete — back tomorrow!", "info");
          break;
        }
        this.modeId = c.mode;
        this.mode = modeById(c.mode);
        this.exitVersus();
        this.startRun({ challenge: "daily" });
        break;
      }
      case "play-gauntlet": {
        const idx = Math.max(0, Math.min(2, parseInt(id || "0", 10) || 0));
        const g = weeklyGauntlet(weekKey());
        if (this.save.gauntletDone(g.week).includes(idx)) {
          this.hud.toast("Stage already cleared this week", "info");
          break;
        }
        const st = g.stages[idx]!;
        this.modeId = st.mode;
        this.mode = modeById(st.mode);
        this.exitVersus();
        this.startRun({ challenge: `gauntlet${idx}` as `gauntlet${number}` });
        break;
      }
      case "claim-calendar": {
        const day = this.save.claimCalendar(this.today);
        if (day === 0) {
          this.hud.toast("Today's gift is already claimed", "info");
          break;
        }
        const r = calendarReward(day);
        if (r.kind === "coins") {
          this.save.addCoins(r.amount);
          this.hud.toast(`📅 Day ${day} gift · +${r.amount} coins`, "gold");
        } else if (r.kind === "boost") {
          this.save.armBoost(r.id);
          this.hud.toast(`📅 Day ${day} gift · boost armed for next flight`, "gold");
        } else {
          if (this.save.ownTrail(r.id)) this.hud.toast(`📅 Day ${day} gift · ✨ ${TRAILS[r.id]?.label ?? r.id} trail!`, "gold");
          else {
            this.save.addCoins(200);
            this.hud.toast(`📅 Day ${day} · trail already owned, +200 coins instead`, "gold");
          }
        }
        this.audio.purchase();
        this.bump();
        break;
      }
      case "open-challenges":
        this.setScreen("challenges");
        break;
      case "play-event": {
        this.modeId = "daytrip";
        this.mode = modeById("daytrip");
        this.exitVersus();
        this.startRun({ event: true });
        break;
      }
      case "open-campaign":
        this.setScreen("campaign");
        break;
      case "claim-campaign": {
        const ch = CAMPAIGN.find((c) => c.id === id);
        if (!ch) break;
        const view = campaignViews(this.save, this.save.state.campaignClaimed).find((v) => v.def.id === id);
        if (!view || !view.unlocked || !view.complete || !this.save.claimCampaign(id)) {
          this.hud.toast("Chapter not ready yet", "info");
          break;
        }
        this.save.addCoins(ch.rewardCoins);
        this.hud.toast(`${ch.icon} ${ch.title} · +${ch.rewardCoins} coins — ${ch.rewardLabel}`, "gold");
        this.audio.chapterFanfare();
        this.bump();
        break;
      }
      case "claim-daily-stipend": {
        // The card disables via the snapshot, but a double-tap can land before
        // the re-render — the handler must be its own guard.
        if (this.save.state.lastStipendClaimed === this.today) break;
        this.save.addCoins(DAILY_STIPEND);
        this.save.state.lastStipendClaimed = this.today;
        this.audio.chapterFanfare();
        this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
        this.hud.toast(`🪙 Daily Flight Stipend Claimed! +● ${DAILY_STIPEND} coins!`, "gold");
        this.bump();
        break;
      }
      case "shop-free-coins": {
        // Rewarded ad from the shop: capped per session to prevent ad farming.
        if (!this.platform || this.platform.name === "none") break;
        if (this.shopAdClaimed >= SHOP_AD_SESSION_CAP) {
          this.hud.toast("Ad rewards capped for this visit", "info");
          break;
        };
        void this.multiplyCoinsFromShopAd();
        break;
      }
      case "buy-bundle": {
        // One crate per save. It pays 250 coins for 240 — re-claimable it is
        // an infinite +10/click coin faucet.
        if (this.save.state.wingmanBundle) break;
        if (!this.save.spend(240)) {
          this.hud.toast("Need ● 240 coins to claim Ace Wingman Crate", "warn");
          break;
        }
        this.save.state.wingmanBundle = true;
        this.save.persist();
        this.save.armBoost("shield");
        this.save.armBoost("sunflask");
        this.save.armBoost("magnet");
        this.save.ownTrail("trail_tide");
        this.save.equipTrail("trail_tide");
        this.save.addCoins(DAILY_STIPEND);
        this.audio.chapterFanfare();
        this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
        this.hud.toast(`📦 Ace Wingman Crate Unlocked! 3 Boosts + Tideglass Trail + ${DAILY_STIPEND} Coins!`, "gold");
        this.bump();
        break;
      }
      case "claim-squad-quest": {
        const questId = id;
        const rewards: Record<string, number> = {
          migration: 150,
          drafting: 120,
          precision: 100,
        };
        const coins = rewards[questId] ?? 100;
        if (!this.save.state.squadQuestsClaimed) this.save.state.squadQuestsClaimed = {};
        if (this.save.state.squadQuestsClaimed[questId] === this.today) {
          this.hud.toast("Already claimed today!", "info");
          break;
        }
        this.save.state.squadQuestsClaimed[questId] = this.today;
        this.save.addCoins(coins);
        this.audio.chapterFanfare();
        this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
        this.hud.toast(`🎁 Squadron Goal Claimed! +● ${coins} coins!`, "gold");
        this.bump();
        break;
      }
      case "squad-autonomous": {
        this.squad?.enableAutonomous();
        this.squadNotice = "⚡ Autonomous Squadron Hub active!";
        this.audio.chapterFanfare();
        this.bump();
        break;
      }
      case "open-squad":
        this.setScreen("squad");
        this.squadNotice = "";
        if (this.squad) {
          if (!this.squad.live || this.squad.isAutonomous) {
            this.squad.enableAutonomous();
          } else {
            void this.squad.refresh().then(() => {
              // A lost key is not "no service": keep the honest recovery
              // surface (explicit re-enrollment) instead of silently
              // dropping into the autonomous offline hub.
              if (!this.squad?.state.registered && !this.squad?.state.credentialError) {
                this.squad?.enableAutonomous();
                this.bump();
              }
            }).catch(() => {
              if (!this.squad?.state.credentialError) {
                this.squad?.enableAutonomous();
                this.bump();
              }
            });
          }
        }
        break;
      case "squad-page": {
        const [kind, page] = id.split(":");
        this.squad?.setPage(kind, Number(page));
        break;
      }
      case "squad-copy-code": {
        const code = this.squad?.state.myCode;
        if (code) void copyText(code).then(ok => {
          if (this.disposed) return;
          if (ok) this.hud.toast("Friend code copied", "info"); else this.hud.offerCopy(code);
        });
        break;
      }
      case "squad-new-profile":
        void this.squad?.startNewProfile(this.hud.readChecked("squadRecoveryConsent"));
        break;
      case "squad-refresh":
        this.squadNotice = "";
        void this.squad?.refresh();
        break;
      case "share-run": {
        // Publish this run so a friend can race the same hills against our
        // mark. AUDS is Poki's store (it needs a Poki game id), so elsewhere
        // the button is not rendered and this is unreachable.
        if (this.runShareBusy) break;
        this.runShareBusy = true;
        this.shareError = "";
        this.bump();
        const run: SharedRun = {
          v: 1,
          name: this.racedName(),
          seed: this.seed,
          mode: this.modeId,
          distance: Math.round(this.bird.x - this.startX),
          timeMs: Math.round((this.raceFinishTime || this.runTime) * 1000),
          place: this.racePlace,
          bird: this.skin.id,
        };
        void shareRun(run).then((code) => {
          if (this.disposed) return;
          this.runShareBusy = false;
          if (code) {
            this.shareCode = code;
            this.hud.toast("🔗 Run shared — send the code to a friend", "gold");
          } else {
            // Platform-neutral copy: this string ships in every edition, and
            // the isolation gates reject the platform's name in other builds.
            this.shareError = "Sharing isn't available in this build — no platform store is configured.";
          }
          this.bump();
        });
        break;
      }
      case "copy-score": {
        const dist = Math.round(this.runStats().distance);
        const text = `I flew ${dist.toLocaleString()} m in Sunbird: Golden Flight! Can you beat it?`;
        void copyText(text).then((ok) => {
          if (this.disposed) return;
          this.hud.toast(ok ? "Score copied to clipboard!" : text, ok ? "gold" : "info");
        });
        break;
      }
      case "copy-share": {
        if (!this.shareCode) break;
        const code = this.shareCode;
        void copyText(code).then((ok) => {
          if (this.disposed) return;
          this.hud.toast(ok ? `Run code ${code} copied` : `Run code: ${code}`, ok ? "gold" : "info");
        });
        break;
      }
      case "load-run": {
        const code = this.hud.readValue("shareCode").trim();
        if (!code) break;
        this.runShareBusy = true;
        this.shareError = "";
        this.bump();
        void loadSharedRun(code).then((run) => {
          if (this.disposed) return;
          this.runShareBusy = false;
          if (!run) {
            this.shareError = sharingAvailable()
              ? "No shared run with that code — check the code and try again."
              : "Run codes aren't available in this build — no platform store is configured.";
            this.bump();
            return;
          }
          this.sharedRun = run;
          // Same hills, same mode, their mark: this is the existing rival
          // challenge path, just delivered by code instead of a URL.
          this.rival = { seed: run.seed, distance: run.distance, name: run.name, mode: run.mode };
          this.rebuildWorld(run.seed);
          this.seedMode = "random";
          if (MODES.some((m) => m.id === run.mode)) {
            this.modeId = run.mode as ModeId;
            this.mode = modeById(this.modeId);
          }
          // Count the play — the AUDS counter endpoint is public by design.
          void countSharePlay(code);
          this.hud.toast(`🥊 ${run.name} flew ${run.distance.toLocaleString()} m here — beat it`, "quest");
          this.telemetry.track("shared_run_loaded", { mode: this.modeId, distance: run.distance });
          this.bump();
        });
        break;
      }
      case "race-share": {
        if (!this.sharedRun) break;
        this.exitVersus();
        this.startRun();
        break;
      }
      case "pilot-lookup": {
        // Real lookup: the panel shows the directory's answer, including
        // "no pilot with that code" and "this build is offline".
        const code = this.hud.readValue("pilotCode").trim().toUpperCase();
        void this.squad?.lookupPilot(code).then(() => this.bump());
        break;
      }
      case "pilot-add": {
        const code = id || this.squad?.state.lookup?.code || this.hud.readValue("pilotCode");
        void this.squad?.addFriend(code).then((msg) => {
          this.squadNotice = msg;
          this.bump();
        });
        break;
      }
      case "pilot-copy": {
        const code = id || this.squad?.state.lookup?.code || "";
        if (!code) break;
        void copyText(code).then((ok) => {
          if (this.disposed) return;
          this.hud.toast(ok ? `Pilot code ${code} copied` : "Copy the code from the field", "info");
        });
        break;
      }
      case "pilot-invite":
      case "mate-invite": {
        // Inviting a wingman is the same real artefact as inviting anyone:
        // the room's invite link. No room yet → say so instead of pretending.
        const who = id || "your wingman";
        if (!this.roomCode) {
          this.hud.toast("Create a private room first — then invites are one tap", "info");
          break;
        }
        void this.invitePilot(this.roomCode, who);
        break;
      }
      case "mate-wingman": {
        const name = id;
        if (name) this.squadNotice = this.squad?.rememberWingman(name) ?? "";
        this.bump();
        break;
      }
      case "mate-forget": {
        if (id && this.pilots.forget(id)) {
          this.hud.toast(`Forgot ${id}`, "info");
          this.bump();
        }
        break;
      }
      case "req-accept":
        void this.squad?.respondRequest(id, true);
        break;
      case "req-decline":
        void this.squad?.respondRequest(id, false);
        break;
      case "req-cancel":
        void this.squad?.cancelRequest(id);
        break;
      case "squad-add": {
        // Kept for older builds/links that still post a bare code.
        const code = (this.hud.readValue("squadCode") || this.hud.readValue("pilotCode")).trim().toUpperCase();
        if (!code) break;
        void this.squad?.addFriend(code).then((msg) => {
          this.squadNotice = msg;
          this.bump();
        });
        break;
      }
      case "squad-remove":
        void this.squad?.removeFriend(id);
        break;
      case "squad-create-club": {
        const name = this.hud.readValue("clubName").trim();
        if (!name) {
          this.hud.toast("Give your club a name first", "info");
          break;
        }
        void this.squad?.createClub(name, "Fly together, land badly").then((msg) => {
          this.squadNotice = msg;
          this.bump();
        });
        break;
      }
      case "squad-join-club":
        void this.squad?.joinClub(parseInt(id, 10) || 0).then((msg) => {
          this.squadNotice = msg;
          this.bump();
        });
        break;
      case "squad-leave-club":
        void this.squad?.leaveClub();
        break;
      case "squad-chat": {
        // Portal editions ship without a chat surface (Poki REQ-31: no chat in
        // multiplayer surfaces; emotes are the sanctioned alternative). The
        // action stays for the direct build; here it can only be reached by a
        // stale DOM node.
        if (!SQUAD_CHAT) break;
        const text = this.hud.readValue("chatText");
        void this.squad?.sendChat(text).then(sent => {
          if (sent && this.hud.readValue("chatText") === text) this.hud.clearValue("chatText");
          this.bump();
        });
        break;
      }
      case "room-size": {
        const n = Math.max(5, Math.min(40, parseInt(id || "40", 10) || 40));
        this.roomSize = n;
        this.hud.toast(t("toast.field.size", { n }, "Field size · {n} rivals"), "info");
        this.bump();
        break;
      }
      case "room-skill":
        this.roomSkill = (id as "chill" | "sharp" | "ace") || "sharp";
        this.massRace.setFieldSkill(this.roomSkill === "ace" ? 1.25 : this.roomSkill === "chill" ? 0.7 : 1);
        this.hud.toast(
          t("toast.rival.skill", { skill: t(`race.skill.${this.roomSkill}`, undefined, this.roomSkill) }, "Rival skill · {skill}"),
          "info",
        );
        this.bump();
        break;
      case "room-shuffle":
        this.massRace.shuffle(`${this.seed}:${this.modeId}`);
        this.hud.toast("Field shuffled", "info");
        this.audio.ding();
        this.bump();
        break;
      case "room-kick":
        if (this.massRace.kick(id)) {
          this.hud.toast("Pilot removed from room", "warn");
          this.audio.butter();
        } else {
          this.hud.toast("Pilot already gone", "warn");
        }
        this.bump();
        break;
      case "room-mute":
        this.roomMuted = !this.roomMuted;
        this.hud.toast(this.roomMuted ? "Emotes muted" : "Emotes on", "info");
        this.bump();
        break;
      case "room-close":
        this.cancelMatchmaking();
        this.disconnectRace();
        this.massRace.clear();
        this.roomCode = "";
        this.joiningRemoteRoom = false;
        this.hud.toast("You left the room", "info");
        this.bump();
        break;
      case "practice-race":
        this.roomCode = "";
        this.launchMatch({ ranked: false, storm: false }, true);
        break;
      case "pvp-casual":
        this.beginMatchmaking({ ranked: false, storm: false });
        break;
      case "pvp-practice":
        this.exitVersus();
        this.modeId = "daytrip";
        this.mode = modeById("daytrip");
        this.startRun();
        break;
      case "start-endless":
        this.exitVersus();
        this.modeId = "endless";
        this.mode = modeById("endless");
        this.startRun();
        break;
      case "open-rank":
        this.setScreen("rank");
        break;
      case "open-live":
        this.setScreen("live");
        // Browsing must not seat an unready spectator into public matchmaking.
        break;
      case "back":
        this.backScreen();
        break;
      case "buy-nest": {
        const price = this.save.nestUpgradePrice();
        if (this.save.buyNestUpgrade()) {
          this.audio.fanfare();
          this.hud.toast(`Nest upgraded → ×${this.save.nestMultiplier().toFixed(2)} score forever`, "gold");
        } else {
          this.hud.toast(this.save.state.nestBought >= 10 ? "Nest is fully upgraded" : `Need ● ${price}`, "info");
        }
        this.bump();
        break;
      }
      case "buy-skin":
        this.buySkin(id);
        break;
      case "equip-skin":
        this.save.equipSkin(id);
        this.applySkin();
        this.audio.ding();
        this.platform?.measure("cosmetic", id ?? "skin", "interact");
        this.bump();
        break;
      case "buy-boost":
        this.buyBoost(id);
        break;
      case "buy-trail":
        this.buyTrail(id);
        break;
      case "starter-buy":
        this.buyCoinStarter();
        break;
      case "gold-buy":
        this.buyCoinGold();
        break;
      case "vip-buy":
        if (SELL_AD_REMOVAL) this.buyPortalVip();
        break;
      case "buy-vault":
        this.buyMysteryVault();
        break;
      case "checkout-cancel":
        if (!this.checkoutBusy) this.backScreen();
        break;
      case "restore":
        this.restore();
        break;
      case "redeem":
        this.redeem();
        break;
      case "copy-referral":
        void this.copyWithFeedback(this.save.state.referralCode, "Code copied");
        break;
      case "redeem-referral":
        this.redeemReferral();
        break;
      case "copy-cloud":
        void this.copyWithFeedback(this.save.exportCode(), "Save code copied");
        break;
      case "import-cloud":
        this.importCloud();
        break;
      case "throw-challenge": {
        // Challenge link: this exact seed + this run's distance (+ mode). Every
        // player becomes a course designer with a posted time. Native share
        // sheet on mobile (one-tap to any messenger), clipboard otherwise.
        // Gated behind the challengeShare flag so a rollout can be held back.
        if (!flag("challengeShare")) break;
        const dist = Math.max(1, Math.round(this.lastRunDistance()));
        const mode = flag("modeAwareChallenge") ? this.modeId : undefined;
        const url = buildChallengeUrl(this.seed, dist, this.pilotName, mode);
        const recap = clipShareLine(this.lastViralScore, this.clips.recapLine(), dist, this.pilotName);
        const text = recap ? `${recap} 🐦 → ${url}` : `Beat my ${dist} m flight on these hills 🐦 → ${url}`;
        this.shareText(text, `🥊 Challenge link copied — send it to a rival`);
        this.telemetry.track("rival_thrown", { distance: dist, mode: this.modeId });
        this.telemetry.track("challenge_share", viralEventProps("challenge_share", { mode: this.modeId, distance: dist, score: this.lastViralScore }));
        break;
      }
      case "buy-powerup": {
        // Game-changing: in-flight shop — buy powerups mid-flight with coins
        if (this.state !== "playing" && this.state !== "paused") break;
        const def = INFLIGHT_POWERUPS.find((p) => p.id === id);
        if (!def) break;
        if (this.runCoins < def.cost) {
          this.hud.toast(t("inflight.needCoins", { cost: def.cost, have: this.runCoins }, `Need ●${def.cost} — you have ●${this.runCoins}`), "warn");
          break;
        }
        // Deduct and apply
        this.runCoins -= def.cost;
        this.bonus += 0; // coins already deducted from run
        switch (def.id) {
          case "boost":
            this.powers.add("rocket");
            this.audio.powerup();
            this.hud.toast(t("inflight.bought.boost", { s: def.duration }, `🚀 Boost! +30 speed ${def.duration}s`), "power");
            break;
          case "magnet":
            this.powers.add("magnet");
            this.audio.powerup();
            this.hud.toast(t("inflight.bought.magnet", { s: def.duration }, `🧲 Magnet! Coins ${def.duration}s`), "power");
            break;
          case "shield":
            this.shield = Math.min(2, this.shield + 1);
            this.powers.shield = this.shield;
            this.audio.powerup();
            this.hud.toast(t("inflight.bought.shield", { s: def.duration }, `🛡 Shield! No crash ${def.duration}s`), "power");
            break;
          case "fever":
            this.feverTimer = def.duration;
            this.feverOn = true;
            this.feverReached = true;
            this.audio.feverOn();
            this.hud.toast(t("inflight.bought.fever", { s: def.duration }, `🔥 Fever! Warp ${def.duration}s`), "gold");
            break;
        }
        this.telemetry.track("inflight_shop_buy", { id: def.id, cost: def.cost, coinsLeft: this.runCoins });
        this.bump();
        break;
      }
      case "rematch": {
        // Same stakes, zero menu round-trips. An online race goes back through
        // the honest search so live pilots can seat into the next field; a duel
        // or an AI-flock race replays locally, exactly as it was flown.
        if (this.state !== "gameover") break;
        const opts = this.lastMatchOpts ?? { ranked: false, storm: false };
        if (this.duelActive || this.versus) this.replayRun(true);
        else if (this.localRace || !isMultiplayerConfigured()) this.launchMatch(opts, true);
        else this.beginMatchmaking(opts);
        break;
      }
      case "share":
        void this.shareRun();
        break;
      case "install-app":
        void this.installApp();
        break;
      case "continue-coins":
        if (this.state === "continue" && this.save.spend(CONTINUE_COST)) this.doContinue("coins");
        break;
      case "onboarding-dismiss":
        if (id) {
          this.save.markOnboardingSeen(id);
          this.onboardingTip = null;
          this.bump();
        }
        break;
      case "onboarding-skip":
        // Mark all as seen
        for (const tipId of Object.keys(ONBOARDING_TIPS)) this.save.markOnboardingSeen(tipId);
        this.onboardingTip = null;
        this.bump();
        break;
      case "skip-goal": {
        const goalId = (action as { id?: string }).id;
        if (!goalId) break;
        const goal = this.goals.goals.find((g) => g.id === goalId);
        if (!goal || goal.done) break;
        const cost = this.goals.skipCost(goal);
        if (this.save.state.wallet < cost) {
          this.hud.toast(t("inflight.shop.skip.needCoins", { cost, have: this.save.state.wallet }, `Need ●${cost} to skip — you have ●${this.save.state.wallet}`), "warn");
          break;
        }
        this.save.spend(cost);
        const replacement = this.goals.skip(goalId, this.seed);
        this.hud.toast(t("inflight.shop.skip.done", { old: goal.label, new: replacement?.label ?? "new goal", cost }, `Skipped ${goal.label} → ${replacement?.label ?? "new goal"} for ●${cost}`), "info");
        this.telemetry.track("goal_skip", { id: goalId, cost, newId: replacement?.id ?? "" });
        this.pushHud();
        break;
      }
      case "continue-ad":
        if (this.state === "continue") {
          if (this.portalEnabled()) {
            // Poki game-events: the player chose the rewarded option. The label
            // matches the `visible` event for the same offer kind (REQ-14).
            const kind = this.continueOfferView?.kind ?? "standard";
            this.platform?.measure("rewarded", continuePlacementLabel(kind), "interact");
            void this.continueWithPortalReward();
          } else {
            this.adReason = "continue";
            this.adTimer = this.ads.duration;
            this.telemetry.track("ad_shown", { reason: "continue" });
            this.setState("ad");
          }
        }
        break;
      case "continue-gold":
        if (this.state === "continue" && this.save.state.gold) this.doContinue("gold");
        break;
      case "continue-sleep":
        if (this.state === "continue") this.finishRun();
        break;
      case "ad-skip":
        if (this.state === "ad" && this.adTimer <= 0) this.endAd();
        break;
      case "ad-gold":
        if (this.state === "ad") {
          if (this.adReason === "continue") {
            this.skipInterstitialOnce = true;
            this.finishRun();
          } else {
            this.setState("gameover");
          }
          this.restoreMessage = "";
          this.setScreen("paywall");
          this.telemetry.track("paywall_open", { from: "ad" });
        }
        break;
      case "claim-pass-free":
        this.claimPass(Number(id), "free");
        break;
      case "claim-pass-premium":
        this.claimPass(Number(id), "premium");
        break;
      case "set-mute":
        this.save.state.settings.mute = !this.save.state.settings.mute;
        this.save.persist();
        this.applySettings();
        break;
      case "set-doubletap":
        if (!this.save.hasUpgrade("doubletap")) break;
        this.save.state.settings.doubleTapBoost = !this.save.state.settings.doubleTapBoost;
        this.save.persist();
        this.bump();
        break;
      case "set-music":
        this.save.state.settings.music = !this.save.state.settings.music;
        this.save.persist();
        this.applySettings();
        break;
      case "set-music-vol": {
        const cur = this.save.state.settings.musicVolume;
        const next = id !== "" && Number.isFinite(Number(id)) ? Math.max(0, Math.min(1, Number(id) / 100)) : cur >= 1 ? 0 : Math.min(1, Math.round((cur + 0.25) * 100) / 100);
        this.save.state.settings.musicVolume = next;
        this.save.persist();
        this.applySettings();
        break;
      }
      case "set-sfx-vol": {
        const cur = this.save.state.settings.sfxVolume;
        const next = id !== "" && Number.isFinite(Number(id)) ? Math.max(0, Math.min(1, Number(id) / 100)) : cur >= 1 ? 0 : Math.min(1, Math.round((cur + 0.25) * 100) / 100);
        this.save.state.settings.sfxVolume = next;
        this.save.persist();
        this.applySettings();
        this.audio.ding();
        break;
      }
      case "set-track": {
        const cur = this.save.state.settings.musicTrack;
        const next = id === "shuffle" ? "shuffle" : id !== "" && Number.isInteger(Number(id)) && Number(id) >= 0 && Number(id) < TRACK_NAMES.length ? Number(id) : cur === "shuffle" ? 0 : cur >= TRACK_NAMES.length - 1 ? "shuffle" : cur + 1;
        this.save.state.settings.musicTrack = next;
        this.save.persist();
        this.applySettings();
        this.audio.uiTick();
        break;
      }
      case "set-haptics":
        this.save.state.settings.haptics = !this.save.state.settings.haptics;
        this.save.persist();
        this.bump();
        break;
      case "set-motion":
        this.save.state.settings.reduceMotion = !this.save.state.settings.reduceMotion;
        this.save.persist();
        this.applySettings();
        break;
      case "set-colorassist":
        this.save.state.settings.colorAssist = !this.save.state.settings.colorAssist;
        this.save.persist();
        this.applySettings();
        break;
      case "set-bigtext":
        this.save.state.settings.bigText = !this.save.state.settings.bigText;
        this.save.persist();
        this.applySettings();
        break;
      case "set-autoshop":
        this.save.state.settings.autoShop = !this.save.state.settings.autoShop;
        this.save.persist();
        this.hud.toast(
          this.save.state.settings.autoShop
            ? "Hangar will open itself once a session when you can afford something new"
            : "Hangar will only open when you tap it",
          "info",
        );
        this.bump();
        break;
      case "set-quality": {
        const order = ["auto", "high", "low"] as const;
        const cur = this.save.state.settings.quality;
        this.save.state.settings.quality = id === "auto" || id === "high" || id === "low" ? id : order[(order.indexOf(cur) + 1) % order.length]!;
        this.save.persist();
        this.applySettings();
        break;
      }
      case "reset-progress":
        if (!this.resetArmed) {
          this.resetArmed = true;
          this.resetTimer = 3;
        } else {
          this.resetArmed = false;
          this.save.resetProgress();
          this.applySkin();
          this.applySettings();
          this.hud.toast("Progress reset", "warn");
          this.telemetry.track("progress_reset", {});
        }
        this.bump();
        break;
      case "seed-today":
        this.setSeedMode("today");
        break;
      case "seed-yesterday":
        this.setSeedMode("yesterday");
        break;
      case "seed-random":
        this.setSeedMode("random");
        break;
      default:
        break;
    }
  }

  private handleHotkeys(): void {
    if (this.input.consumePause()) {
      if (this.hud.dismissCopy()) return;
      if (this.mmOpts) { this.cancelMatchmaking(); return; }
      if (this.state === "playing") this.setState("paused");
      else if (this.state === "paused") {
        // ESC/P from a pause sub-screen collapses the sub-screen first (matching
        // the button behaviour); from the bare pause card it resumes flight.
        if (this.screen !== "main") this.closePauseScreen();
        else void this.resumeFromPause();
      }
      else if (this.screen !== "main" && !this.checkoutBusy) this.backScreen();
    }
    if (this.input.consumeRestart()) {
      if (this.state === "gameover") {
        this.replayRun(true);
      } else if (this.state === "playing" || this.state === "paused") {
        this.replayRun(false);
      }
    }
    if (this.input.consumeMute()) {
      // M works everywhere (menu, play, pause, sub-screens) — global toggle.
      this.save.state.settings.mute = !this.save.state.settings.mute;
      this.save.persist();
      this.applySettings();
      this.hud.toast(this.save.state.settings.mute ? "Sound off" : "Sound on", "info");
    }
    if (this.input.consumeFullscreen()) {
      this.toggleFullscreen();
    }
  }

  private goToMenu(): void {
    if (this.state === "playing" || this.state === "paused") {
      this.telemetry.track("run_abandon", { distance: Math.round(this.bird.x - this.startX) });
      // Quitting a ranked duel mid-flight counts as the loss it is.
      if (this.duelActive && this.duelResult === "" && !this.runRecorded && this.runTime > 3) {
        const res = this.save.recordDuelResult(false, this.today);
        this.hud.toast(`⚔ Duel forfeited · ${res.delta} rating`, "warn");
      }
      // A graceful retreat still deserves a punchline.
      this.fireMoment("sleep", { shout: quip(SURRENDER_QUIPS, Math.round(this.bird.x)), always: true });
    }
    this.disconnectRace();
    this.roomCode = "";
    this.duelActive = false;
    this.duelResult = "";
    this.challengeRun = "";
    this.challengeMods = NO_MODS;
    // The demo flies the menu island, not whatever random hills the last run
    // used — otherwise the backdrop (and the "Hills of …" label) is a dice
    // roll per run: it flies once, then stalls on a brutal island. Wild
    // keeps its current hills; dated modes return to their date. Guarded:
    // a failed rebuild must never trap the player — worst case the menu
    // shows the current hills.
    if (this.seedMode !== "random") {
      const menuSeed = this.seedMode === "today" ? this.today : dateSeed(new Date(Date.now() - 86400000));
      if (this.seed !== menuSeed) {
        try {
          this.rebuildWorld(menuSeed);
        } catch (err) {
          console.error("Sunbird menu world rebuild failed, keeping hills:", err);
        }
      }
    }
    this.resetRun(true);
    this.demoAcc = 0;
    this.demoTime = 0;
    this.demoStuck = 0;
    this.setState("menu");
    // Show name entry on first use
    const screen = !this.save.state.pilotNameCustomized ? "nameEntry" : "main";
    this.setScreen(screen);
    this.camera.setIntro(1);
  }

  private buySkin(id: string): void {
    const def = skinById(id);
    const st = this.save.state;
    if (def.prizeOnly && !st.ownedSkins.includes(id)) {
      this.hud.toast(`🏆 Earn it: ${def.prizeOnly}`, "info");
      return;
    }
    if ((def.goldOnly && !st.gold) || (def.vipOnly && !st.vip)) {
      this.setScreen("paywall");
      return;
    }
    if (st.ownedSkins.includes(id)) {
      this.save.equipSkin(id);
      this.applySkin();
      this.bump();
      return;
    }
    const flash = dailyFlashBird(this.today);
    const price = def.id === flash.id ? flash.price : def.price;
    if (!this.save.spend(price)) {
      this.hud.toast(`Need ${price - st.wallet} more coins`, "warn");
      return;
    }
    this.save.ownSkin(id);
    this.save.equipSkin(id);
    this.applySkin();
    this.audio.purchase();
    this.hud.toast(`${def.name} is yours!`, "gold");
    this.telemetry.track("skin_bought", { id, price });
    this.portalPurchase("cosmetic", id, "unlocked");
    this.bump();
  }

  private buyBoost(id: string): void {
    const def = BOOSTS.find((b) => b.id === id);
    if (!def) return;
    const st = this.save.state;
    if (def.permanent && this.save.hasUpgrade(id)) {
      this.hud.toast("Already unlocked", "info");
      return;
    }
    if (st.armedBoosts.includes(id)) {
      this.hud.toast("Already armed for next flight", "info");
      return;
    }
    const deal = dailyDealBoost(this.today);
    const price = def.id === deal.id ? deal.price : def.price;
    if (!this.save.spend(price)) {
      this.hud.toast(`Need ${price - st.wallet} more coins`, "warn");
      return;
    }
    if (def.permanent) this.save.ownUpgrade(id);
    else this.save.armBoost(id);
    this.audio.purchase();
    this.hud.toast(`${def.icon} ${def.name} ${def.permanent ? "unlocked" : "armed"}`, "power");
    this.telemetry.track("boost_bought", { id, price });
    this.portalPurchase(def.permanent ? "upgrade" : "powerup", id, def.permanent ? "unlocked" : "armed");
    this.bump();
  }

  private buyTrail(id: string): void {
    const def = SHOP_TRAILS.find((t) => t.id === id);
    if (!def) return;
    const st = this.save.state;
    if (st.tournaments.trails.includes(id)) {
      // already owned → toggle equip
      this.save.equipTrail(st.activeTrail === id ? "" : id);
      this.audio.ding();
      this.bump();
      return;
    }
    if (!this.save.spend(def.price)) {
      this.hud.toast(`Need ${def.price - st.wallet} more coins`, "warn");
      return;
    }
    this.save.ownTrail(id);
    this.save.equipTrail(id);
    this.audio.purchase();
    this.hud.toast(`${def.label} trail is yours!`, "gold");
    this.telemetry.track("trail_bought", { id, price: def.price });
    this.portalPurchase("cosmetic", id, "unlocked");
    this.bump();
  }

  private claimPass(tier: number, track: "free" | "premium"): void {
    const reward = this.seasonPass.claim(tier, track);
    if (!reward) {
      if (track === "premium" && !this.save.state.gold) this.setScreen("paywall");
      return;
    }
    this.audio.ding();
    this.hud.toast(`Tier ${tier} reward claimed!`, "gold");
    this.bump();
  }

  /* ----------------------------------------------------------- checkout */

  private checkoutMode(): CheckoutMode {
    return "demo";
  }

  /** The one honest upsell moment: after the player proves they like the
   * game (run 3+), surface the starter pack ONCE per session at the results
   * screen — never mid-run, never modal, never repeated. */
  private starterNudged = false;
  private maybeNudgeStarter(): void {
    if (this.starterNudged) return;
    if (this.save.state.starterPack || this.save.state.gold) return;
    const runs = this.save.state.runsPlayed;
    if (runs < 3 || runs > 12) return;
    this.starterNudged = true;
    this.hud.toast(`🎁 First Flight Pack · ${STARTER_PACK.price} — 1,200 coins + Goldleaf trail`, "gold");
    this.telemetry.track("starter_nudge", { runs });
  }

  /** Pull webhook-verified purchases from the backend and grant any missing.
   * Silent no-op when no backend is configured — local flow is unchanged. */
  private async syncServerEntitlements(): Promise<void> {
    const skus = await fetchServerEntitlements(this.save.state.deviceId);
    if (this.disposed || skus.length === 0) return;
    for (const sku of skus) {
      const owned =
        sku === "sunbird_gold" ? this.save.state.gold
        : sku === "sunbird_vip" ? this.save.isVipActive()
        : this.save.state.starterPack;
      if (!owned) this.grantSku(sku, "payment_webhook");
    }
  }

  private grantSku(sku: Sku, source: string): void {
    if (sku === "sunbird_vip") this.grantVip(source);
    else if (sku === "sunbird_starter") this.grantStarter(source);
    else this.grantGold(source);
  }

  private grantStarter(source: string): void {
    if (this.save.state.starterPack) return;
    this.save.state.starterPack = true;
    this.save.addCoins(STARTER_PACK.coins);
    this.save.ownTrail(STARTER_PACK.trailId);
    this.save.equipTrail(STARTER_PACK.trailId);
    this.save.armBoost("sunflask");
    this.audio.fanfare();
    this.hud.toast(`🎁 First Flight Pack — +${STARTER_PACK.coins} coins, Goldleaf trail, Sun Flask armed`, "gold");
    this.telemetry.track("purchase_ok", { sku: "sunbird_starter", source });
    this.bump();
  }

  private restore(): void {
    this.restoreMessage = "Checking…";
    this.bump();
    // Server-verified entitlements first (authoritative), local receipts second.
    void this.syncServerEntitlements();
    void this.mockPayments.restore().then((skus) => {
      if (this.disposed) return;
      let found = false;
      if (skus.includes("sunbird_gold") && !this.save.state.gold) {
        this.grantGold("restore");
        found = true;
      }
      if (skus.includes("sunbird_vip") && !this.save.isVipActive()) {
        this.grantVip("restore");
        found = true;
      }
      this.restoreMessage = found || this.save.state.gold || this.save.isVipActive() ? "Purchases restored ✦" : "No purchases found on this device.";
      this.bump();
    });
  }

  private redeem(): void {
    const code = this.hud.readValue("redeem").trim().toUpperCase();
    if (!code) return;
    const promo = PROMO_CODES[code];
    if (!promo) {
      this.restoreMessage = "Hmm, that code isn't valid.";
    } else if (!this.save.redeem(code)) {
      this.restoreMessage = "That code was already used.";
    } else if (promo.type === "gold") {
      this.grantGold("promo");
      this.restoreMessage = "Gold unlocked with code ✦";
    } else if (promo.type === "vip") {
      this.grantVip("promo");
      this.restoreMessage = "VIP unlocked with code ♛";
    } else {
      this.save.addCoins(promo.amount);
      this.audio.ding();
      this.restoreMessage = `+${promo.amount} coins added.`;
    }
    this.telemetry.track("promo_redeem", { code, ok: Boolean(promo) });
    this.bump();
  }

  private redeemReferral(): void {
    const code = this.hud.readValue("friendcode");
    if (this.save.redeemReferral(code)) {
      this.save.addCoins(REFERRAL_BONUS);
      this.audio.ding();
      this.particles.emitConfetti(this.bird.x, this.bird.y);
      this.referralMessage = `Welcome bonus applied · +${REFERRAL_BONUS} coins`;
      this.telemetry.track("referral_redeemed", {});
    } else {
      this.referralMessage = "That code doesn't look right (or you've already used one).";
    }
    this.bump();
  }

  private importCloud(): void {
    const code = this.hud.readValue("cloudImport");
    if (!code.trim()) {
      this.cloudMessage = "Paste a save code first.";
      this.bump();
      return;
    }
    if (!this.hud.readChecked("confirmImport")) {
      this.cloudMessage = "Confirm that you want to replace this device’s progress before importing.";
      this.bump();
      return;
    }
    this.hud.clearValue("confirmImport");
    if (this.save.importCode(code)) {
      this.hud.clearValue("cloudImport");
      this.applySkin();
      this.applySettings();
      this.cloudMessage = "Save imported! Welcome back.";
      this.telemetry.track("cloud_import", { ok: true });
    } else {
      this.cloudMessage = "That code couldn't be read.";
      this.telemetry.track("cloud_import", { ok: false });
    }
    this.bump();
  }

  private async shareRun(): Promise<void> {
    if (this.shareBusy) return;
    this.shareBusy = true;
    this.bump();
    try {
      const { buildShareCard, shareOrDownload } = await import("./Social");
      // Fuse the two viral halves: the image card carries its own beat-me
      // link, so one share (not card + separate link) is the whole loop.
      // Gated behind challengeShare like throw-challenge — rollout-safe.
      const dist = Math.max(0, this.bird.x - this.startX);
      const challengeUrl = flag("challengeShare")
        ? buildChallengeUrl(this.seed, Math.max(1, Math.round(dist)), this.pilotName, flag("modeAwareChallenge") ? this.modeId : undefined)
        : undefined;
      const card = await buildShareCard({
        distance: dist,
        coins: this.runCoins,
        score: this.score(),
        skin: this.skin,
        referralCode: this.save.state.referralCode,
        seedLabel: this.seedLabel(),
        flightPath: this.flightPath,
        challengeUrl,
      });
      // Portal-native share sheet first: the platform owns the link
      // formatting (and, on CrazyGames, appends its multiplayer invite
      // params). A dismissed sheet counts as handled — the fallback below
      // would just show the user a second sheet.
      const platform = this.platform;
      if (platform && platform.name !== "none") {
        const handled = await platform.share(card.text);
        if (handled) {
          this.telemetry.track("share_run", { result: "shared" });
          this.telemetry.track("clip_export", viralEventProps("clip_export", { mode: this.modeId, distance: dist, score: this.lastViralScore }));
          if (!this.disposed) this.hud.toast("Shared!", "gold");
          return;
        }
      }
      const result = await shareOrDownload(card, undefined, !this.portalEnabled());
      this.telemetry.track("share_run", { result });
      if (result === "shared" || result === "copied") {
        this.telemetry.track("clip_export", viralEventProps("clip_export", { mode: this.modeId, distance: dist, score: this.lastViralScore }));
      }
      if (this.disposed) return;
      if (result === "unavailable") this.hud.offerCopy(card.text);
      else if (result !== "cancelled") this.hud.toast(result === "shared" ? "Shared!" : result === "copied" ? "Flight link copied" : "Image download requested", "info");
    } catch {
      this.hud.toast("Couldn't build the share card", "warn");
    } finally {
      this.shareBusy = false;
      this.bump();
    }
  }

  private async installApp(): Promise<void> {
    if (!this.deferredInstall) return;
    await this.deferredInstall.prompt();
    this.deferredInstall = null;
    this.bump();
  }

  private grantGold(source: string): void {
    this.save.setGold(true);
    this.save.ownSkin("phoenix");
    this.audio.purchase();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
    this.hud.toast("Welcome to Gold ✦", "gold");
    this.telemetry.track("gold_granted", { source });
    this.bump();
  }

  private grantVip(source: string): void {
    this.save.grantVip();
    this.vipActive = true;
    this.vipExpiredNotice = false;
    this.save.ownSkin("aurora");
    this.save.claimVipDaily(this.today);
    this.audio.purchase();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
    this.hud.toast("Welcome to VIP ♛", "vip");
    this.telemetry.track("vip_granted", { source });
    this.bump();
  }

  /** Portal editions convert VIP into an in-game coin sink, with a rewarded
   * ad route for players who are short. This keeps checkout out of iframe
   * portals while giving the portal a clear, opt-in monetisation moment. */
  private buyCoinGold(): void {
    if (this.save.state.gold) return;
    const price = GOLD.coinPrice;
    if (!this.save.spend(price)) {
      this.hud.toast(`Need ● ${(price - this.save.state.wallet).toLocaleString()} more coins`, "info");
      return;
    }
    this.grantGold("coin_purchase");
  }

  private buyCoinStarter(): void {
    if (this.save.state.starterPack) return;
    const price = STARTER_PACK.coinPrice;
    if (!this.save.spend(price)) {
      this.hud.toast(`Need ● ${(price - this.save.state.wallet).toLocaleString()} more coins`, "info");
      return;
    }
    this.grantStarter("coin_purchase");
  }

  private buyPortalVip(): void {
    const price = VIP.coinPrice;
    if (!this.save.spend(price)) {
      this.hud.toast(`Need ● ${(price - this.save.state.wallet).toLocaleString()} more coins`, "info");
      return;
    }
    this.save.grantVip();
    this.vipActive = true;
    this.vipExpiredNotice = false;
    this.save.ownSkin("aurora");
    this.save.claimVipDaily(this.today);
    this.audio.purchase();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
    this.hud.toast("VIP flight unlocked with coins ♛", "vip");
    this.telemetry.track("vip_granted", { source: "portal_coins", price });
    this.bump();
  }

  private buyMysteryVault(): void {
    const price = 150;
    if (!this.save.spend(price)) {
      this.hud.toast(`Need ● ${(price - this.save.state.wallet).toLocaleString()} more coins`, "info");
      return;
    }
    const rng = Math.random();
    this.audio.fanfare();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);

    const unownedSkins = SKINS.map((s: SkinDef) => s.id).filter((id: string) => !this.save.state.ownedSkins.includes(id));
    const unownedTrails = SHOP_TRAILS.map((t: ShopTrailDef) => t.id).filter((id: string) => !this.save.state.ownedUpgrades.includes(id));

    if (rng < 0.35 && unownedSkins.length > 0) {
      const pick = unownedSkins[Math.floor(Math.random() * unownedSkins.length)]!;
      this.save.ownSkin(pick);
      const skinDef = skinById(pick);
      this.hud.toast(`🥚 Vault Hatched: ${skinDef.name} Bird Skin!`, "gold");
    } else if (rng < 0.70 && unownedTrails.length > 0) {
      const pick = unownedTrails[Math.floor(Math.random() * unownedTrails.length)]!;
      this.save.ownTrail(pick);
      this.hud.toast(`🥚 Vault Hatched: ${pick.replace("trail_", "").toUpperCase()} Trail!`, "gold");
    } else {
      const reward = 300 + Math.floor(Math.random() * 300);
      this.save.addCoins(reward);
      this.hud.toast(`🥚 Vault Jackpot: +● ${reward} bonus coins!`, "gold");
    }
    this.bump();
  }

  private setSeedMode(mode: SeedMode): void {
    if (!this.save.state.gold && mode !== "today") {
      this.setScreen("paywall");
      return;
    }
    this.seedMode = mode;
    const seed =
      mode === "today" ? this.today : mode === "yesterday" ? dateSeed(new Date(Date.now() - 86400000)) : `wild-${Math.random().toString(36).slice(2, 8)}`;
    this.rebuildWorld(seed);
    this.telemetry.track("seed_change", { mode });
    this.bump();
  }

  private rebuildWorld(seed: string): void {
    this.seed = seed;
    this.scene.remove(this.terrain.group);
    this.terrain.dispose();
    this.scene.remove(this.collect.group);
    this.collect.dispose();
    this.scene.remove(this.weather.group);
    this.weather.dispose();
    const qualityTier2 = this.deviceProfile.tier === "lite" ? "lite" : this.deviceProfile.tier === "standard" ? "mid" : "high";
    this.terrain = new TerrainSystem(seed, qualityTier2);
    this.scene.add(this.terrain.group);
    this.collect = new Collectibles(this.terrain.seedN, seed, qualityTier2);
    this.scene.add(this.collect.group);
    this.weather = new Weather(this.terrain.seedN);
    this.weather.addTo(this.scene);
    this.resetRun(true);
  }

  /* --------------------------------------------------------------- helpers */

  get socialSystem(): SocialSystem {
    return this.social;
  }

  private get skin(): SkinDef {
    return skinById(this.save.state.activeSkin);
  }

  private get fairRace(): boolean {
    if (equalizedRace(this.modeId, this.rankedRace, this.localRace, this.duelActive)) return true;
    // Private-room rooms are live shared-field races too: the lobby promises
    // "Equal flight equipment — Store boosts are saved for solo play", so any
    // race mode flown inside a live room strips paid advantages (boosts,
    // daylight, mastery perks) the same way ranked rooms do.
    return isRaceMode(this.modeId) && !this.localRace && !this.duelActive && this.roomCode !== "";
  }

  /** Keep the chosen artwork, but not paid flight advantages in a live race. */
  private get gameplaySkin(): SkinDef {
    return this.fairRace ? skinById("sunbird") : this.skin;
  }

  /** Speed boost for modes with `escalate: true`. Grows with island index and
   *  time so Endless mode feels genuinely harder as you go deeper. */
  private escalateMult(): number {
    if (!this.mode.escalate) return 1;
    return endlessSpeedScale(this.island, this.runTime);
  }

  private daylightMax(): number {
    return (this.save.state.gold && !this.fairRace ? DAYLIGHT_MAX_GOLD : DAYLIGHT_MAX) + this.gameplaySkin.daylightBonus + this.masteryPerk.daylightBonus;
  }

  private applySkin(): void {
    const s = this.skin;
    this.bird.applySkin({ body: s.body, wing: s.wing, belly: s.belly, beak: s.beak });
  }

  private applySettings(): void {
    const s = this.save.state.settings;
    this.audio.setMuted(s.mute);
    this.audio.setMusicEnabled(s.music);
    this.audio.setVolumes(s.musicVolume, s.sfxVolume);
    this.audio.setMusicTrack(s.musicTrack);
    this.camera.setReduceMotion(s.reduceMotion);
    // Bloom is the expensive effect — desktop high/auto only, and never under
    // reduced-motion (a steady glow reads as flicker to some players).
    this.useBloom = !s.reduceMotion && !this.isMobile && s.quality === "high";
    this.bloomBudget = { enabled: false, goodWindows: 0, cooldown: 0 };
    if (!this.useBloom) this.fx?.setBase(0);
    // Accessibility classes live on <html> so every overlay inherits them.
    document.documentElement.classList.toggle("a11y-color", s.colorAssist);
    document.documentElement.classList.toggle("a11y-bigtext", s.bigText);
    this.dpr = this.preferredDpr();
    // Mobile gets a lighter decorative particle stream by default. Gameplay
    // events still render because critical emitters are short-lived and the
    // adaptive quality loop can shed more work under sustained load.
    this.particleBudget = s.quality === "low" ? 0.3 : this.deviceProfile.tier === "lite" || this.isMobile || this.deviceProfile.tier === "standard" ? 0.5 : 1;
    this.particles.setBudget(this.particleBudget);
    // Soft shadows are the single priciest feature on mobile GPUs — keep them
    // only when the user asked for high quality (auto tiers shed them first).
    const wantShadows =
      this.deviceProfile.tier !== "lite" && !this.isMobile && (s.quality === "high" || (s.quality === "auto" && this.frameEma < 1 / 30));
    if (this.renderer.shadowMap.enabled !== wantShadows) this.renderer.shadowMap.enabled = wantShadows;
    this.resize();
    this.bump();
  }

  private preferredDpr(): number {
    const dev = Math.min(window.devicePixelRatio || 1, 2);
    // Fill-rate is the dominant mobile cost for this Three.js scene. Tiny
    // Wings-style clarity comes from a stable frame rate, so cap phones at
    // 1x keeps the fill-rate stable on phones; native DPR is reserved for
    // desktop/high quality settings where the GPU budget is predictable.
    // DEV-03: a measured-lite device never gets a 2x buffer, whatever its UA
    // claims — fill-rate is the first thing that dies on those GPUs.
    if (this.deviceProfile.tier === "lite" || this.save.state.settings.quality === "low") return 1;
    return this.isMobile ? 1 : dev;
  }

  private adaptQuality(raw: number): void {
    this.frameEma = lerp(this.frameEma, raw, 0.05);
    // Shed particles before frames. The budget follows the same 38/48/58 fps
    // ladder as the DPR stepper in quality.ts, so a weak device loses sparkle
    // rather than responsiveness — and the write only happens on a change,
    // because ParticleFX.setBudget is called from inside the frame loop.
    const budget = fxScale(this.frameEma);
    if (budget !== this.fxBudget) {
      this.fxBudget = budget;
      this.particles.setBudget(budget);
    }
    // Field perf telemetry: count frames that blow the 60 fps budget (16.7 ms)
    // and track the worst, then report a coarse aggregate every ~10s. This is
    // the same signal the quality stepper reacts to — surfaced so a deploy that
    // regresses frame time shows up in the analytics, not just as user churn.
    if (raw > 1 / 30) this.perfLongFrames += 1;
    if (raw > this.perfWorst) this.perfWorst = raw;
    this.perfTimer += raw;
    if (this.perfTimer >= 10) {
      this.perfTimer = 0;
      this.telemetry.track("perf_frame", {
        frameMs: Math.round(this.frameEma * 1000),
        longFrames: this.perfLongFrames,
        worstMs: Math.round(this.perfWorst * 1000),
        dpr: this.dpr,
      });
      this.perfLongFrames = 0;
      this.perfWorst = 0;
    }
    this.qualityTimer += raw;
    if (this.qualityTimer < QUALITY_WINDOW_SECONDS) return;
    this.qualityTimer = 0;
    // One decision per window, and the anti-oscillation cooldown ticks with it.
    this.dprCooldown = Math.max(0, this.dprCooldown - QUALITY_WINDOW_SECONDS);
    if (this.save.state.settings.quality !== "auto" || this.state !== "playing") return;

    // Resolution is two-way: step down when the budget is blown, and back up
    // when headroom returns, with a lock-out so it cannot oscillate. The old
    // loop only ever stepped down, so one bad moment degraded the whole session.
    this.bloomBudget = nextBloomBudget(this.bloomBudget, this.frameEma, !this.isMobile && !this.save.state.settings.reduceMotion && !this.versus);
    this.useBloom = this.bloomBudget.enabled;
    const previousDpr = this.dpr;
    this.dpr = nextDpr(this.dpr, this.preferredDpr(), this.frameEma, this.dprCooldown);
    if (this.dpr !== previousDpr) {
      this.dprCooldown = DPR_COOLDOWN_SECONDS;
      this.resize();
      this.telemetry.track(this.dpr < previousDpr ? "quality_step_down" : "quality_step_up", {
        dpr: this.dpr,
      });
    }

    if (this.frameEma > 1 / 40) {
      // At the floor resolution already? Kill soft shadows for the frame budget.
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.telemetry.track("shadows_disabled", {});
      }
      if (this.particleBudget > 0.3) {
        this.particleBudget = Math.max(0.3, this.particleBudget - 0.2);
        this.particles.setBudget(this.particleBudget);
      }
    } else if (
      this.frameEma < 1 / 58 &&
      !this.isMobile &&
      this.deviceProfile.tier !== "lite" &&
      this.renderer.shadowMap.enabled === false
    ) {
      // Headroom is back — restore soft shadows (they were only shed under load).
      this.renderer.shadowMap.enabled = true;
      this.particleBudget = Math.min(1, this.particleBudget + 0.2);
      this.particles.setBudget(this.particleBudget);
    }
  }

  private shake(amount: number): void {
    this.camera.bump(amount);
  }

  /** A single in-flight import; low-power devices never allocate bloom targets. */
  private ensureFx(): void {
    if (this.fx || this.fxLoading || this.fxFailed || this.disposed) return;
    this.fxLoading = true;
    void import("./Fx").then(({ Fx: Effects }) => {
      if (this.disposed || !this.useBloom) return;
      const fx = new Effects(this.renderer, this.scene, this.camera.camera);
      const size = this.renderer.getSize(this.tmpSize);
      fx.resize(size.x, size.y, this.dpr);
      this.fx = fx;
    }).catch(() => {
      this.fxFailed = true; // Plain rendering stays playable if the optional chunk fails.
    }).finally(() => { this.fxLoading = false; });
  }

  /** Ambient bloom from game state, refreshed once per rendered frame. */
  private updateGlowBase(): void {
    if (!this.useBloom) return;
    const golden = this.goldenHour ? 0.4 : 0;
    const fever = this.feverOn ? 0.5 : 0;
    const wings = this.powers.has("goldenwings") ? 0.45 : 0;
    const boost = this.boostTimer > 0 ? 0.25 : 0;
    this.fx?.setBase(0.1 + Math.max(golden, fever, wings, boost));
  }

  /** Transient bloom spike on a trigger moment. */
  private glow(amount: number): void {
    if (!this.useBloom) return;
    this.fx?.pulse(amount);
  }

  private flash(kind: "perfect" | "fever" | "island" | "sleep"): void {
    if (this.save.state.settings.reduceMotion && kind !== "sleep") return;
    this.hud.flash(kind);
  }

  /** Project a world position to screen fractions [0..1, 0..1] for popups.
   *  Returns [0.42, 0.5] as a safe fallback when projection fails. */
  private projectToScreen(wx: number, wy: number): [number, number] {
    const cam = this.camera.camera;
    const v = new THREE.Vector3(wx, wy, 0).project(cam);
    return [
      Math.max(0.05, Math.min(0.95, (v.x + 1) / 2)),
      Math.max(0.05, Math.min(0.95, (-v.y + 1) / 2)),
    ];
  }

  /** Fire a floating impact text popup near the bird's current screen position. */
  /**
   * The one door every memorable beat walks through: classify → react → tally.
   *
   * `Moments.ts` owns what a kind means (shout word, popup style, toast tone,
   * vibration pattern, results-card language, next-action CTA); this owns doing
   * it exactly once, on the run clock, and counting it even when the reaction
   * is throttled. Call sites keep their own audio and particles because those
   * depend on live scene context — but they all feed the same ledger now, so
   * the recap card, the share line and the funnel see one truth instead of ten
   * private counters.
   *
   * @param opts.shout overrides the popup word (quip pools still work)
   * @param opts.toast optional toast text, shown in the kind's tone
   * @param opts.popup `false` to tally silently (sites with a bespoke popup)
   * @param opts.always bypass the repeat throttle (records, sleeping)
   * @returns the kind's new count for this run
   */
  /**
   * The one door flight coins walk through.
   *
   * Everything a run earns is accumulated here and banked once by
   * `SaveData.recordRun()` at the end of the flight, so this is where the coin
   * multipliers have to live: the permanent Golden Feather upgrade and the
   * timed Lucky Coin bonus both read through `SaveData.coinMultiplier()`. A
   * multiplier applied anywhere else only ever catches part of the economy,
   * which is how shops end up selling upgrades that quietly do nothing.
   *
   * @returns the coins actually awarded (>= `base`), so callers can print the
   * number the player will really get instead of the pre-multiplier one.
   */
  private addRunCoins(base: number): number {
    if (base <= 0) return 0;
    const mult = this.save.coinMultiplier();
    const awarded = Math.max(base, Math.ceil(base * mult));
    this.runCoins += awarded;
    this.markFunnel("first_reward");
    // Say so out loud while it lasts: a paid or earned multiplier that is
    // invisible is a multiplier players stop believing in.
    if (mult > 1) this.popupAtBird(`+${awarded} ×${mult % 1 === 0 ? mult : mult.toFixed(1)}`, "power");
    return awarded;
  }

  /**
   * One beacon per session, carrying the two numbers retention actually turns
   * on: how long boot took, and which cohort today's visit belongs to (new /
   * D1 / D2-6 / D7+). The cohort comes from the stamped first-session day, so
   * D1 here means the same thing D1 means on a portal dashboard - a real
   * calendar day later, in the player's own timezone. Nothing identifying is
   * attached: stage timings and a cohort label, that is all.
   */
  private noteSessionStart(): void {
    this.markFunnel("boot");
    const cohort = visitKind(this.save.state.firstPlayed, this.today);
    this.save.noteFirstPlayed(this.today);
    this.telemetry.track("session_start", { cohort, runsPlayed: this.save.state.runsPlayed });
  }

  /**
   * Records a funnel stage and reports it once.
   *
   * `Funnel.mark()` returns an event only the first time a stage is reached, so
   * this is safe to call from hot paths (input handling, every coin pickup)
   * without double-counting or spamming beacons. `stepMs` is the number that
   * matters: it turns "players drop off" into "38 s between first flight and
   * first coin".
   */
  /**
   * Achievement unlock → canonical Game Events + celebration:
   * `measure('achievement', id, 'unlocked')` and a strong `happyTime`.
   *
   * `celebrate` is false when the unlock is part of a run-end batch: Poki asks
   * for happyTime sparingly, and four trophies unlocking on one landing are one
   * moment, not four. `finishRun()` then sends a single call at the peak of
   * everything the flight grew (`ProgressBeats.planCelebration`).
   */
  private portalAchievement(id: string, celebrate = true): void {
    this.platform?.measure("achievement", id, "unlocked");
    if (celebrate) this.platform?.happyTime(0.85);
  }

  /**
   * Shop purchase → the item event plus the shared economy event, so the
   * dashboard can compare a card's `visible`/`interact` pair with actual spend
   * (the guide's "UI and shop usage" pattern).
   */
  private portalPurchase(category: string, id: string, action: string): void {
    this.platform?.measure(category, id, action);
    this.platform?.measure("economy", "coins", "spent");
  }

  private markFunnel(stage: FunnelStage): void {
    const ev = this.funnel.mark(stage);
    if (!ev) return;
    // Canonical Game Events: each funnel milestone is also a custom event, so
    // Poki's dashboard reports the percentage of gameplays that reached it.
    // Stage names carry no digits, which keeps them inside measure()'s
    // two-numeric limit.
    this.platform?.measure("player", `funnel-${ev.stage}`, "reached");
    this.telemetry.track("funnel_stage", {
      stage: ev.stage,
      step: ev.step,
      ms: ev.ms,
      stepMs: ev.stepMs,
      progress: Math.round(ev.progress * 100) / 100,
    });
  }

  private fireMoment(
    kind: MomentKind,
    opts: { shout?: string; toast?: string; popup?: boolean; always?: boolean } = {},
  ): number {
    const def = MOMENTS[kind];
    const before = this.moments.count(kind);
    const last = this.momentLastAt[kind];
    const since = last === undefined ? Number.POSITIVE_INFINITY : this.runTime - last;
    // Throttled beats are ignored outright rather than counted silently: a
    // beached bird stalls on every physics frame, and a ledger that recorded
    // all of them would report "PANIC x412" for one bad beach. The cadence in
    // `momentRepeatGap` is the shared budget, so every kind degrades the same.
    if (!opts.always && !momentShouldReact(before, since)) return before;
    const n = this.moments.record(kind);
    this.momentLastAt[kind] = this.runTime;
    if (flag("clipWorthy")) {
      const clip = clipFromMoment(kind);
      if (clip) {
        const first = this.clips.isFirstEver(clip);
        this.clips.record(clip);
        if (first) {
          this.telemetry.track("clip_moment", viralEventProps("clip_moment", { kind: clip, mode: this.modeId }));
          this.camera.pulseClip(clipShotFor(clip), Math.min(1.2, this.bird.speed() / MAX_SPEED), this.bird.altitude);
        }
      }
    }
    if (opts.popup !== false) this.popupAtBird(opts.shout ?? def.shout, def.popup);
    if (opts.toast) this.hud.toast(opts.toast, def.tone);
    this.haptic(def.haptic);
    // The score is part of the beat, not wallpaper under it: each kind has a
    // bounded musical reaction (MusicMoments.ts), gated so a beached bird
    // spamming PANIC cannot stack filter sweeps on the music bus.
    this.audio.musicMoment(kind);
    // One telemetry event the first time each kind appears in a session — the
    // funnel's "first funny moment". Never one per occurrence: a splashy run
    // would fire dozens of identical beacons for no extra insight.
    if (this.moments.isFirstEver(kind)) {
      this.telemetry.track("moment_first", { kind, mode: this.modeId });
      // "First funny moment" predicts a second run better than distance does,
      // so it is a funnel stage in its own right.
      this.markFunnel("first_moment");
    }
    return n;
  }

  private popupAtBird(text: string, kind: "perfect" | "great" | "thud" | "bop" | "fever" | "zenith" | "splash" | "power"): void {
    if (this.save.state.settings.reduceMotion) return;
    const [sx, sy] = this.projectToScreen(this.bird.x, this.bird.y + 4);
    this.hud.popup(text, kind, sx, sy);
  }

  private haptic(pattern: number | number[]): void {
    if (!this.save.state.settings.haptics) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* unsupported */
    }
  }

  /** The SDK owns ad focus. Silence and freeze immediately, then restore only
   * after the callback so portal ads cannot leak game audio/input beneath them. */
  /**
   * True while a portal break owns the state machine.
   *
   * Poki's documented order is `gameplayStop()` → break → `gameplayStart()`,
   * and the start must not fire *during* the ad. Every path back into gameplay
   * already awaits the break first, but a break is an await: anything else that
   * calls `setState("playing")` while it is in flight (a stray tap on a path
   * that does not disable input, a late callback, a visibility handler) would
   * emit `gameplayStart` mid-ad. `setState` drops transitions out of `"ad"`
   * while this is set; `endPortalAd()` releases it.
   *
   * Only *portal* breaks take the lock. The self-served interstitial (non-portal
   * builds) also uses the `"ad"` state but is driven by `adTimer` and released
   * by `endAd()`, so it must stay out of this.
   */
  private adInFlight = false;

  /**
   * Enter a portal break: `"ad"` state + the in-flight lock + the request
   * telemetry, in one place so the five placements cannot drift apart.
   */
  private beginPortalBreak(placement: string): void {
    this.setState("ad");
    this.adInFlight = true;
    this.telemetry.track("portal_break_request", {
      portal: this.platform?.name ?? "none",
      placement,
    });
  }

  private beginPortalAd(): void {
    // A break always interrupts the player now that the gameplay window covers
    // every interactive state, so it is always bookended: stop on the way in,
    // start on the way out. Poki's only hard rule is that a phase must not
    // repeat itself — that is exactly what GameplayEventSink enforces — so an
    // ad that begins while the clock is already stopped (death → results →
    // break) costs nothing and cannot produce the forbidden duplicate.
    this.gameplaySink.send("stop");
    this.input.setEnabled(false);
    this.audio.setAdMuted(true);
  }

  private endPortalAd(): void {
    // Release the state-machine lock FIRST: the caller's next transition
    // (startRun / resume / menu / continue) is the canonical way back into
    // gameplay, and it must be honoured now that the break has resolved.
    this.adInFlight = false;
    this.audio.setAdMuted(false);
    this.input.setEnabled(true);
    // The player can act again, so the engaged clock resumes — unless the tab
    // is hidden, in which case onVis owns the next start.
    if (isInteractive(this.state) && !this.hidden) this.gameplaySink.send("start");
  }

  private portalEnabled(): boolean {
    return isPortalBuild();
  }

  /**
   * True only when the portal SDK is present AND exposes a real ad surface.
   *
   * A portal *build* is not the same thing as a portal *session*: off the
   * portal CDN (a local preview, a blocked script, a rejected handshake) the
   * build still runs, but every break would resolve instantly and every
   * rewarded button would be a lie. Callers use this to skip the ad state
   * entirely and offer the coin / gold paths instead.
   */
  private adsLive(): boolean {
    const platform = this.platform;
    if (!this.portalEnabled() || !platform || platform.name === "none") return false;
    return platform.capabilities().includes("ads");
  }

  /* ------------------------------------------------------- live multiplayer */

  /* ------------------------------------------------------- matchmaking */

  /** Opt into a public room, ready when connected, and launch only on the
   * server's shared start. A timed-out search explicitly disconnects before
   * starting local AI practice. Browsing or cancelling cannot block a room. */
  private static readonly MM_WINDOW = 15;

  private beginMatchmaking(opts: { ranked: boolean; storm: boolean }): void {
    this.disconnectRace();
    this.roomCode = "";
    this.localRace = false;
    // Commit the selected PvP mode up-front so currentMatchSeed() uses the
    // right mode+course and the server groups pilots into per-circuit rooms.
    // Without this, matchmaking used the lobby's casual seed and pilots were
    // shunted into an empty (or wrong) room the moment the race started.
    this.modeId = this.selectedPvpMode;
    this.mode = modeById(this.selectedPvpMode);
    if (!isMultiplayerConfigured()) {
      // No transport in this runtime (e.g. a Poki iframe without WebRTC, or a
      // direct build without VITE_MULTIPLAYER_URL). Say so instead of silently
      // starting an offline race the player believes is online.
      this.hud.toast("Online racing is unavailable here — starting an AI flock race", "info");
      this.launchMatch(opts, true);
      return;
    }
    this.mmOpts = opts;
    this.mmPhase = "searching";
    this.mmRooms = "";
    this.mmDeadline = performance.now() + Game.MM_WINDOW * 1000;
    this.preseatLobby();
    this.startRoomWatch();
    const ready = this.net?.state === "lobby" ? (this.net.info().ready ? "ready" : "unready") : "none";
    this.hud.setMatchmaking(true, this.liveCount(), this.roomSize, Game.MM_WINDOW, "searching", "", ready);
    this.bump();
  }

  private cancelMatchmaking(): void {
    this.mmDeadline = 0;
    this.mmOpts = null;
    this.mmPhase = "searching";
    this.mmRooms = "";
    this.roomWatcher?.stop();
    this.closeRoomBrowser();
    this.net?.sendReady(false);
    this.disconnectRace();
    this.hud.setMatchmaking(false, 0, this.roomSize, 0);
    this.bump();
  }

  /** Releases the P2P browse connection (Poki only; a WS build has nothing to
   *  release). Called when a search ends or is cancelled. */
  private closeRoomBrowser(): void {
    if (!POKI_MULTIPLAYER) return;
    void import("./PokiNetlib").then((m) => m.closeLobbyBrowser()).catch(() => {
      /* the connection is best-effort */
    });
  }

  /** True while we asked the transport for a public room and have not been
   *  seated/started yet. */
  private searching(): boolean {
    return this.mmDeadline > 0 && this.mmOpts !== null;
  }

  private startRoomWatch(): void {
    if (!this.roomWatcher) {
      this.roomWatcher = new RoomWatcher(
        () => this.fetchLiveRooms(),
        ROOM_POLL_MS,
        (result) => {
          if (!this.searching()) return;
          this.mmRooms = result.rooms.length ? roomSummaryLine(summarizeRooms(result.rooms)) : "";
          this.bump();
        },
      );
    }
    this.roomWatcher.start();
  }

  /** What is racing right now, on whichever transport this edition ships. */
  private async fetchLiveRooms(): Promise<LiveRoom[]> {
    if (!isMultiplayerConfigured()) return [];
    if (POKI_MULTIPLAYER) {
      // Compile-time gated: only the Poki bundle contains the P2P browser.
      const { listPublicLobbies } = await import("./PokiNetlib");
      return listPublicLobbies();
    }
    return fetchPublicRooms();
  }

  private liveCount(): number {
    const info = this.net?.info();
    return info && this.net?.connected ? Math.max(0, info.count - 1) : 0;
  }

  /** Called every frame while a search is active. */
  private pumpMatchmaking(_raw: number): void {
    if (this.mmDeadline <= 0 || !this.mmOpts) return;
    // If the run already started (a real start frame, or a local launch), the
    // search is over — the overlay must never sit on top of gameplay.
    if (this.state !== "menu") {
      const opts = this.mmOpts;
      this.mmOpts = null;
      this.mmDeadline = 0;
      this.roomWatcher?.stop();
      this.closeRoomBrowser();
      this.hud.setMatchmaking(false, 0, this.roomSize, 0);
      this.hud.toast("No players found — starting AI race", "info");
      if (opts) this.launchMatch(opts, true);
      return;
    }
    const live = this.liveCount();
    // Nobody is auto-readied. A live pilot joining the room never launches a
    // race by itself — the overlay offers an explicit Ready toggle, and the
    // room starts (with a shared 6s countdown) only once every seated pilot
    // has readied up.
    const ready = this.net?.state === "lobby" ? (this.net.info().ready ? "ready" : "unready") : "none";
    // "Waiting" phase: the search window elapsed with real pilots in the room.
    // Keep the lobby alive for ready-up rather than abandoning them to AI; if
    // they all leave, reopen the search window.
    if (this.mmPhase === "waiting") {
      if (live > 0) {
        this.hud.setMatchmaking(true, live, this.roomSize, 0, "waiting", this.mmRooms, ready);
        return;
      }
      this.mmPhase = "searching";
      this.mmDeadline = performance.now() + Game.MM_WINDOW * 1000;
      this.startRoomWatch();
      this.hud.toast("Pilot left — searching again", "info");
    }

    const secsLeft = (this.mmDeadline - performance.now()) / 1000;
    this.hud.setMatchmaking(true, live, this.roomSize, Math.max(0, secsLeft), "searching", this.mmRooms, ready);
    if (secsLeft <= 0) {
      if (live > 0) {
        // Real pilots found before the window closed — hold the lobby open.
        // The "start" net event fires once everyone readies (allReady in
        // PokiNetlib). Only an empty room may launch on its own.
        this.mmPhase = "waiting";
        this.hud.setMatchmaking(true, live, this.roomSize, 0, "waiting", this.mmRooms, ready);
        this.hud.toast(`${live} pilot${live === 1 ? "" : "s"} found — hit Ready to race`, "gold");
        this.telemetry.track("matchmaking_live_waiting", { count: live });
        return;
      }
      // Empty lobby — fall back to a clearly labeled AI flock so the pilot is
      // never left staring at a dead search.
      this.mmPhase = "waiting";
      const opts = this.mmOpts;
      this.mmOpts = null;
      this.mmDeadline = 0;
      this.roomWatcher?.stop();
      this.closeRoomBrowser();
      this.hud.setMatchmaking(false, live, this.roomSize, 0);
      this.hud.toast("No live pilots found — racing the AI flock (practice)", "info");
      this.telemetry.track("matchmaking_ai_fallback", { window: Game.MM_WINDOW });
      this.bump();
      if (opts) this.launchMatch(opts, true);
    }
  }

  /** Leave the search running (another full window) without dropping the room. */
  private keepSearching(): void {
    if (!this.mmOpts) return;
    this.mmPhase = "searching";
    this.mmDeadline = performance.now() + Game.MM_WINDOW * 1000;
    this.hud.toast("Searching again — inviting any pilot who is online", "info");
    this.bump();
  }

  /** Explicit "race the AI flock" opt-in from the search overlay. */
  private takeAiFlock(): void {
    const opts = this.mmOpts ?? this.lastMatchOpts ?? { ranked: false, storm: false };
    this.mmOpts = null;
    this.mmDeadline = 0;
    this.mmPhase = "searching";
    this.roomWatcher?.stop();
    this.closeRoomBrowser();
    this.hud.setMatchmaking(false, 0, this.roomSize, 0);
    this.hud.toast("Racing the AI flock — offline practice", "info");
    this.launchMatch(opts, true);
  }

  private launchMatch(opts: { ranked: boolean; storm: boolean }, local = false): void {
    this.lastMatchOpts = opts;
    this.localRace = local;
    if (local) this.disconnectRace();
    if (!isRaceMode(this.modeId)) {
      this.modeId = this.selectedPvpMode;
      this.mode = modeById(this.selectedPvpMode);
    }
    this.rankedRace = opts.ranked;
    this.stormfront = opts.storm || this.modeId === "pvp_typhoon";
    this.startRun({ storm: this.stormfront });
  }

  /** Instantiates the appropriate multiplayer backend for this build:
   *  Poki uses WebRTC P2P via @poki/netlib; direct/crazy/generic keep the
   *  existing WebSocket relay. The two classes share the same public API
   *  so Game.ts doesn't need to branch elsewhere.
   *
   *  The Poki client is loaded via a DYNAMIC import guarded by a
   *  compile-time constant (`VITE_PORTAL_TARGET === "poki"`). Rollup
   *  can statically evaluate this: in non-Poki builds the branch is
   *  dead-code-eliminated along with the dynamic import, so @poki/netlib
   *  (~34 KB gz, with WebRTC + the wss:// signalling URL) is NEVER
   *  emitted into direct/crazy/generic/none bundles. */
  /** Pre-seats the lobby so the Race screen shows live pilots immediately. */
  private preseatLobby(): void {
    // Warm the ghost source too so the next grid can seat real names.
    void this.refreshBoard();
    // Matchmaking and race entry must use the SAME room seed. Pre-seating with
    // a different seed than connectRace() caused PvP modes to drop their lobby
    // and land in a new empty room the moment the countdown ended — hence the
    // "circuits aren't actually PvP" bug.
    const seed = this.currentMatchSeed();
    const remote = this.joiningRemoteRoom;
    if (!this.net) {
      this.net = this.createNetTransport(this.save.state.deviceId, this.pilotName, this.skin.id);
      this.massRace.attachTransport(this.net);
    }
    this.net.setIdentity(this.racedName(), this.skin.id, 0.06);
    this.net.connect(this.roomCode, seed, remote);
  }

  /** Stable seed for matchmaking/connect that identifies ONE race uniquely:
   *  world (course) + mode (+ storm qualifier when on). Using the same seed
   *  in preseatLobby and connectRace is what keeps pilots in the room they
   *  matched into when the server fires the shared start. */
  private currentMatchSeed(): string {
    const mode = isRaceMode(this.modeId) ? this.modeId : this.selectedPvpMode;
    const course = this.courseForRace();
    let seed = `${this.today}:${mode}:${course.id}`;
    if (this.mmOpts?.storm || (mode === "pvp_typhoon")) seed += ":storm";
    return seed;
  }

  /** Adopt a server-sent seed (e.g. on a private-room 'start'). Parses the
   *  mode:course suffixes so when you join a friend on Sprint/Emerald you
   *  load Sprint/Emerald rather than your last-picked local default. Any
   *  unrecognized seed is taken verbatim. */
  private applySeedFromServer(serverSeed: string): void {
    this.seed = serverSeed;
    const parts = serverSeed.split(":");
    // Expected shape: `<today>:<modeId>:<courseId>[:storm]`
    if (parts.length >= 3) {
      const modeId = parts[1] as ModeId;
      const worldId = parts[2];
      const mode = MODES.find((m) => m.id === modeId) ?? PVP_MODES.find((m) => m.id === modeId);
      const world = PVP_WORLDS.find((w) => w.id === worldId);
      if (mode) {
        this.selectedPvpMode = mode.id;
        this.modeId = mode.id;
        this.mode = mode;
      }
      if (world) {
        this.selectedPvpWorld = world.id;
        this.selectedCourse = world;
      }
      this.stormfront = parts.includes("storm") || modeId === "pvp_typhoon";
    }
    this.rebuildWorld(serverSeed);
  }

  /** Opens (or reuses) a realtime seat for the current race seed. */
  private connectRace(): void {
    // Compile-time edition constant, not a runtime `getPortalTarget() !== "poki"`
    // comparison. The minifier folds positive `TARGET === "poki"` branches but
    // not a negative early-return, so the literal survived into the CrazyGames
    // and generic bundles and tripped their cross-portal isolation gate — the
    // same trap `src/sdk/net.ts` documents having already fallen into.
    // Identical semantics: POKI_MULTIPLAYER is true only in the Poki build, so
    // Poki still never bails here and every other edition still bails unless a
    // multiplayer backend is configured.
    if (!isMultiplayerConfigured() && !POKI_MULTIPLAYER) return;
    if (this.net?.connected) { this.massRace.attachTransport(this.net); return; }
    if (!this.net) {
      this.net = this.createNetTransport(this.save.state.deviceId, this.pilotName, this.skin.id);
      this.massRace.attachTransport(this.net);
    }
    this.net.setIdentity(this.racedName(), this.skin.id, 0.06);
    this.net.connect(this.roomCode, this.currentMatchSeed(), this.joiningRemoteRoom);
  }

  private disconnectRace(): void {
    this.net?.disconnect();
    this.massRace.attachTransport(null);
  }

  /** Per-frame network pump: cadence, inbound emotes, outbound state. */
  /**
   * Remember the real pilots sharing our room: real names, the room code and
   * how far they flew. This is the local, honest source behind the "Flew with"
   * list in Pilot Lookup — it never invents anyone.
   */
  private recordRoomPilots(): void {
    const net = this.net;
    if (!net?.connected) return;
    const code = net.info().code;
    if (!code) return;
    if (this.pilots.remember(net.roster(), code, Date.now())) this.bump();
  }

  private pumpNetwork(raw: number): void {
    const net = this.net;
    if (!net) return;
    net.tick(raw);
    // Server-authoritative result: the DO ordered every live pilot's finish.
    // Blend it with the local bot field — humans ranked by the referee, bots
    // by simulation — and correct the shown place if the estimate was off.
    // Gated on mode, not massRace.active: the pack is hidden the instant the
    // run ends, but the referee's place echo lands a round-trip later.
    if (!this.serverPlaceApplied && net.myPlace > 0 && this.raceFinishTime > 0 && isRaceMode(this.modeId)) {
      this.serverPlaceApplied = true;
      const botsAhead = this.massRace.rivals.filter(
        (r) => r.kind === "local" && r.finished && r.finishTime <= this.runTime,
      ).length;
      const official = net.myPlace + botsAhead;
      if (official !== this.racePlace) {
        this.racePlace = official;
        this.hud.toast(`Official result: P${official} (server-verified)`, "gold");
        this.bump();
      }
    }
    for (const e of net.drainEmotes()) this.massRace.showEmote(e.id, e.emote);
    // Live multiplayer signals: surface presence changes as in-flight toasts
    // so a connecting/leaving/finishing rival never goes unnoticed.
    for (const e of net.drainEvents()) {
      switch (e.type) {
        case "join":
          this.hud.toast(`🕊 ${e.name} joined the race`, "island");
          this.audio.chirp();
          this.recordRoomPilots();
          break;
        case "leave":
          this.hud.toast(`👋 ${e.name} left`, "warn");
          break;
        case "ready":
          this.hud.toast(`✅ ${e.name} is ready`, "cloud");
          break;
        case "finish":
          // While we're still flying, every rival's finish matters. After we
          // cross, the pack keeps finishing behind the results card — up to
          // ~40 toasts that each re-render the whole card. The referee's
          // official ordering already landed via `myPlace`, so stay silent.
          if (this.state === "playing") this.hud.toast(`🏁 ${e.name} finished P${e.place}`, "gold");
          break;
        case "interrupted":
          this.serverPlaceApplied = false;
          if (this.state === "playing" || this.state === "paused") {
            this.massRace.clear();
            this.networkStartAt = 0;
            this.setState("menu");
            this.setScreen("live");
          }
          this.hud.toast(e.message, "warn");
          this.bump();
          break;
        case "welcome": {
          // We just landed in a room whose seed may differ from what we asked
          // for: either a friend's invite code (joiningRemoteRoom) or a
          // quick-match that seated us into an existing fuller lobby. In both
          // cases the server/host seed is authoritative for format+course —
          // adopt it so the lobby UI and startRun() build the right terrain.
          const shouldAdopt = (this.joiningRemoteRoom || Boolean(this.mmOpts)) && e.seed && e.seed !== this.currentMatchSeed();
          if (shouldAdopt) {
            this.roomCode = e.roomCode || this.roomCode;
            this.applySeedFromServer(e.seed);
            this.joiningRemoteRoom = false;
            this.bump();
          }
          break;
        }
        case "start": {
          if (this.mmOpts || (this.state === "menu" && this.screen === "live" && this.roomCode)) {
            const opts = this.mmOpts ?? { ranked: false, storm: false };
            this.mmOpts = null;
            this.mmDeadline = 0;
            this.hud.setMatchmaking(false, this.liveCount(), this.roomSize, 0);
            this.roomWatcher?.stop();
            this.closeRoomBrowser();
            // Adopt the host/server seed as authoritative. When we joined a
            // friend's private code this is the host's format+course; without
            // parsing it the guest would rebuild Emerald/Sprint and fly the
            // wrong terrain/finish against a host on Turquoise/Slalom.
            if (net.seed) this.applySeedFromServer(net.seed);
            this.launchMatch(opts);
            this.networkStartAt = net.startsAt;
            this.countdown = Math.max(0, (net.startsAt - Date.now()) / 1000);
            this.hud.toast("Room ready — starting together", "gold");
          }
        }
          break;
      }
    }
    if (this.state === "playing" && this.massRace.active) {
      net.send(this.bird.x, this.bird.y, this.bird.rotation, Math.max(0, this.bird.x - this.startX));
    }
  }

  private sendEmote(text: string): void {
    if (this.roomMuted) {
      this.hud.toast("Emotes muted in this room", "info");
      return;
    }
    // Rate-limit on wall-clock, not the run clock: the run clock is frozen in
    // the menu, where the emote wheel is also visible.
    const now = performance.now();
    if (now - this.lastEmoteWallAt < 1200) return;
    this.lastEmoteWallAt = now;
    // Sender feedback is immediate: the flight HUD pops your own bubble and the
    // floating nametag shows it, regardless of whether a net transport exists.
    this.massRace.showEmote("you", text);
    this.hud.pulseEmote(text);
    this.net?.sendEmote(text);
    // No toast here: the toast layer renders above the wheel and swallowed the
    // click that sent the emote (feedback is the bubble, not a banner).
    this.audio.chirp();
    this.bump();
  }

  /** Pulls the selected board page; keeps the last page visible while loading. */
  private async refreshBoard(force = false): Promise<void> {
    if (this.boardLoading) return;
    if (!force) {
      const cached = this.board.peek(this.boardScope, this.boardMetric);
      if (cached) {
        this.boardPage = cached;
        this.bump();
      }
    }
    this.boardLoading = true;
    this.bump();
    try {
      this.boardPage = await this.board.fetch(this.boardScope, this.boardMetric);
    } finally {
      this.boardLoading = false;
      this.bump();
    }
  }

  /** Tournament prizes are granted through the same APIs the shop uses. */
  /**
   * Achievement/tournament prize skins: each `prizeOnly` label in Economy.ts
   * has a matching trigger here, so no earnable skin is ever a dead promise.
   */
  private checkPrizeSkins(): void {
    const st = this.save.state;
    const grant = (id: string, msg: string): void => {
      if (st.ownedSkins.includes(id)) return;
      this.save.ownSkin(id);
      this.hud.toast(`🐦 ${msg}`, "gold");
      this.audio.fanfare();
    };
    if (st.lifetime.ghostBeats >= 10) grant("ghost", "Ghost unlocked — 10 ghost wins!");
    if (st.lifetime.zeniths >= 25) grant("shadow", "Shadow unlocked — 25 skyline moments banked!");
    if (st.duel.bestStreak >= 10) grant("mythic", "Mythic unlocked — 10-duel win streak!");
    if (st.ownedSkins.length >= 16) grant("rainbow", "Rainbow unlocked — 15-skin collection!");
    const tiers = this.cups.claimedTiers();
    if (tiers.includes("gold") || tiers.includes("diamond")) grant("champion", "Champion unlocked — gold cup claimed!");
    if (tiers.includes("diamond")) grant("legendary", "Legendary unlocked — diamond cup claimed!");

    // Collection completion bonuses: finishing a themed set pays real coins,
    // once per collection. The shop header shows progress toward each.
    for (const c of COLLECTIONS) {
      if (st.claimedCollections.includes(c.id)) continue;
      const members = SKINS.filter((k) => (k.collection ?? "starter") === c.id);
      if (members.length < 2) continue; // starter isn't a chase
      if (!members.every((k) => st.ownedSkins.includes(k.id))) continue;
      st.claimedCollections.push(c.id);
      const bonus = 100 + members.length * 25;
      this.save.addCoins(bonus);
      this.save.persist();
      this.hud.toast(`${c.icon} ${c.name} collection complete · +${bonus} coins`, "gold");
      this.audio.fanfare();
    }
  }

  private applyPrize(grant: PrizeGrant): void {
    const p = grant.prize;
    if (p.kind === "coins") this.save.addCoins(p.amount);
    else if (p.kind === "skin") this.save.ownSkin(p.id);
    else if (p.kind === "boost") this.save.armBoost(p.id);
    // trails/titles were already recorded inside Tournaments.claim()
    this.save.persist();
    this.lastPrize = grant;
    this.audio.purchase();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
    this.hud.toast(`${p.icon} ${p.label} — ${grant.tier} in ${grant.cup}`, "gold");
    this.telemetry.track("cup_prize", { tier: grant.tier, kind: p.kind, id: p.id });
    this.checkPrizeSkins();
    this.bump();
  }

  /** A portal-controlled commercial break at the natural death/restart seam. */
  private replayRun(allowPortalBreak: boolean): void {
    if (this.versus) { this.startVersus(); return; }
    if (isRaceMode(this.modeId) && this.roomCode && !this.localRace) {
      // An online race "replay" means going back through the search so the next
      // round can seat real pilots. Bouncing the player to the menu (what this
      // used to do) read as a broken replay button.
      this.disconnectRace();
      this.roomCode = "";
      const opts = this.lastMatchOpts ?? { ranked: false, storm: false };
      this.setState("menu");
      this.setScreen("live");
      if (isMultiplayerConfigured()) {
        this.beginMatchmaking(opts);
        return;
      }
      this.hud.toast("Online racing is unavailable here — replaying the AI flock", "info");
      this.launchMatch(opts, true);
      return;
    }
    // Local run: replay means the SAME course, so the ghost recorded from the
    // run that just ended is a real opponent instead of a random island nobody
    // ever flew. Without this the ghost feature could never be seen.
    const options: RunOptions = {
      ...replayOptions({ duel: this.duelActive, challenge: this.challengeRun,
        dailyDone: this.save.isDailyDone(this.today), gauntletDone: this.save.gauntletDone(weekKey()),
        event: this.eventRun, storm: this.stormfront }),
      replay: true,
    };
    if (allowPortalBreak && this.adsLive()) void this.restartWithPortalBreak(options);
    else this.startRun(options);
  }

  private async restartWithPortalBreak(options: RunOptions = {}): Promise<void> {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") {
      this.startRun(options);
      return;
    }
    this.beginPortalBreak("restart");
    await platform.commercialBreak();
    if (this.disposed) return;
    this.endPortalAd();
    this.startRun(options);
  }

  /**
   * Every resume-from-pause path (button, ESC, P) funnels through here. On
   * portal builds the return into gameplay routes through commercialBreak()
   * — the documented pause/unpause event order — while the sink keeps the
   * surrounding stop/start pair duplicate-free. A rejected or absent break
   * resolves immediately and the resume proceeds; a pause can never wedge
   * the game in the ad state.
   */
  private async resumeFromPause(): Promise<void> {
    if (this.state !== "paused") return;
    // Collapse any pause sub-screen (shop/settings/...) before returning to flight.
    this.closePauseScreen();
    const platform = this.platform;
    if (this.adsLive() && platform && platform.name !== "none") {
      this.beginPortalBreak("resume");
      await platform.commercialBreak();
      if (this.disposed) return;
      this.endPortalAd();
    }
    if (this.state === "paused" || this.state === "ad") this.setState("playing");
  }

  /**
   * The "back to the main menu" commercial break (results → menu on portal
   * builds). A rejected or absent break resolves straight into the menu —
   * leaving a results screen can never wedge in the ad state.
   */
  private async menuAfterPortalBreak(): Promise<void> {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") return;
    this.beginPortalBreak("to-menu");
    await platform.commercialBreak();
    if (this.disposed) return;
    this.endPortalAd();
    this.goToMenu();
    this.bump();
  }

  /**
   * Results-screen 3× coin bonus via the platform's rewarded ad. The card
   * states the reward before the tap; the payout happens only on a true
   * grant, and a declined/failed ad just returns the player to the recap
   * with the card still armed (Poki rewarded rules: optional, honest, no
   * penalty on decline).
   */
  private async multiplierWithPortalReward(): Promise<void> {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") return;
    const earned = await platform.rewardedBreak();
    if (this.disposed) return;
    this.endPortalAd();
    if (earned) {
      const bonus = this.runCoins * 2;
      this.multiplierClaimed = true;
      this.save.addCoins(bonus);
      this.audio.chapterFanfare();
      this.hud.toast(`3× flight bonus — +● ${bonus} coins`, "gold");
      platform.measure("rewarded", "results-coin-multiplier", "granted");
    } else {
      this.hud.toast("No reward this time — the 3× bonus is still on the card", "warn");
    }
    if (this.state === "ad") this.setState("gameover");
    this.bump();
  }

  /** Shop free-coins rewarded break: capped per hour, modest payout so the
   *  high-price mythic tier (2500-10000) stays aspirational. */
  private async multiplyCoinsFromShopAd(): Promise<void> {
    const platform = this.platform;
    if (!platform || platform.name === "none") return;
    if (this.shopAdClaimed >= SHOP_AD_SESSION_CAP) {
      this.hud.toast("Free coin rewards capped for this hour", "info");
      return;
    }
    this.telemetry.track("portal_break_request", { portal: platform.name, placement: "shop-free-coins" });
    // Shop free-coin break does not bookend gameplay (no gameplayStop/start),
    // so mute + disable input directly around the break instead of begin/endPortalAd
    // (which would risk a duplicate gameplayStop from the sink).
    this.audio.setAdMuted(true);
    this.input.setEnabled(false);
    const earned = await platform.rewardedBreak();
    if (this.disposed) return;
    this.audio.setAdMuted(false);
    this.input.setEnabled(true);
    if (earned) {
      this.shopAdClaimed++;
      const payout = Math.min(SHOP_AD_COINS, 60);
      this.save.addCoins(payout);
      this.audio.chapterFanfare();
      this.hud.toast(`🍪 Here's a little flying fuel — +● ${payout} coins`, "gold");
      this.bump();
    } else {
      this.hud.toast("No reward this time — try again next hour", "info");
    }
  }

  private async continueWithPortalReward(): Promise<void> {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") return;
    this.beginPortalBreak("continue");
    const earned = await platform.rewardedBreak();
    if (this.disposed) return;
    this.endPortalAd();
    if (earned) {
      this.doContinue("portal_rewarded");
    } else {
      this.setState("continue");
      this.hud.toast("No reward this time — try coins or rest", "warn");
    }
  }

  private setState(s: GameState): void {
    const previous = this.state;
    // While a portal break is in flight, nothing but the code that awaited it
    // may move the game out of the ad state — otherwise `gameplayStart` can
    // land mid-ad (see `adInFlight`).
    if (this.adInFlight && previous === "ad" && s !== "ad") return;
    this.state = s;
    // Leaving pause entirely collapses any open pause sub-screen state so the
    // next pause opens cleanly on the base card.
    if (s !== "paused") this.pauseScreenOrigin = null;
    this.acc = 0;
    this.last = performance.now();
    this.menuHold = 0;
    this.needRelease = true;
    if (s !== "playing") {
      this.timeScale = 1;
      this.zenithTimer = 0;
    }
    // Wake lock follows gameplay exactly: held while flying, released the
    // moment the player is in a menu, paused, asleep, or watching a break.
    if (s === "playing") this.wakeLock.acquire();
    else this.wakeLock.release();
    if (s === "menu" || s === "ad") this.audio.setMusicMode("menu");
    else if (s === "gameover" || s === "continue") this.audio.setMusicMode("sleep");
    else if (s === "paused") this.audio.duckMusic(0.55, 3);
    else if (s === "playing") this.audio.setMusicMode(this.feverOn ? "fever" : this.stormfront ? "storm" : "play");
    // Edge-triggered through the sink on the *interaction* boundary, not the
    // run boundary: stop exactly once when the player loses the ability to act
    // (pause, ad), start exactly once when they get it back. Moving between two
    // interactive states (playing → results → menu) is not a halt, so the
    // portal keeps counting the session the player is actually having.
    if (isInteractive(previous) && !isInteractive(s)) this.gameplaySink.send("stop");
    if (!isInteractive(previous) && isInteractive(s) && !this.hidden) this.gameplaySink.send("start");
    this.bump();
  }

  private atlas(): import("./HUD").AtlasEntry[] {
    const far = Math.max(this.save.state.farthestIsland, this.island);
    const count = Math.max(BIOMES.length * 2, far + 3);
    const out: import("./HUD").AtlasEntry[] = [];
    for (let i = 0; i < count; i++) {
      const b = biomeForIsland(i);
      const seen = this.save.state.biomesSeen.includes(b.id);
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

  // ----- Pause overlay / sub-menu navigation --------------------------------
  // When paused, sub-screens (shop, settings, scores, ...) show over the
  // frozen flight without abandoning the run. `closePauseScreen()` returns to
  // the plain pause card (the equivalent of "back to pause" from a sub-screen).

  private pauseScreenOrigin: "main" | "paused" | null = null;

  private openPauseScreen(target: UiScreen): void {
    if (this.pauseScreenOrigin === null) this.pauseScreenOrigin = this.screen === "main" ? "main" : "paused";
    // Re-seed history from main so back() lands back on the pause card.
    this.screenHistory.resetTo("main");
    this.setScreen(target);
    // Data-heavy screens should refresh when opened from pause so the player
    // sees current data, not a stale snapshot from the last menu visit.
    if (target === "board") void this.refreshBoard();
  }

  private closePauseScreen(): void {
    if (this.screen === "live" && this.state === "paused") this.disconnectRace();
    this.checkoutOk = false;
    this.checkoutWaiting = false;
    this.pauseScreenOrigin = null;
    this.screenHistory.resetTo("main");
    this.setScreen("main");
  }
  // --------------------------------------------------------------------------

  private backScreen(): void {
    if (this.checkoutBusy) return;
    // If we're in a pause sub-screen, "back" collapses to the pause card, not
    // to the previous menu page (which would belong to the main menu stack).
    if (this.state === "paused") {
      this.closePauseScreen();
      return;
    }
    this.checkoutOk = false;
    this.checkoutWaiting = false;
    if (this.screen === "live") { this.disconnectRace(); this.roomCode = ""; }
    this.setScreen(this.screenHistory.back());
  }

  private setScreen(s: UiScreen): void {
    // Block sub-screens that would implicitly abandon or race a paused run.
    // (Quick-launch grid deliberately omits "live" and "practice"; this is the
    // belt-and-braces guard if anything else tries to navigate there.)
    if (this.state === "paused" && (s === "live" || s === "practice")) {
      this.hud.toast("Resume your flight first, then race.", "info");
      return;
    }
    // If we ever navigate away from main while paused without going through
    // openPauseScreen (e.g. clicking a score/settings button from a postcard
    // or reward flow), mark origin so back returns us cleanly.
    if (this.state === "paused" && s !== "main" && this.pauseScreenOrigin === null) {
      this.pauseScreenOrigin = "paused";
      this.screenHistory.resetTo("main");
    }
    this.screenHistory.visit(s);
    if (this.screen === "live" && s !== "live" && this.state === "menu") this.net?.sendReady(false);
    if (s !== this.screen) this.audio.uiTick();
    this.screen = s;
    this.menuHold = 0;
    this.needRelease = true;
    // Track onboarding — when player actually opens these screens
    if (s === "shop") this.save.markSeen("shop");
    if (s === "live") this.save.markSeen("pvp");
    if (s === "practice") this.save.markSeen("pve");
    if (s === "board") this.save.markSeen("leaderboards");
    if (s === "challenges") this.save.markSeen("challenges");
    this.updateOnboarding();
    // Every return to the home screen refreshes the embedded leaderboard so a
    // just-finished run shows up immediately (cache-first, non-blocking). Only
    // do this for the real main menu — during pause, "main" is the pause card.
    if (s === "main" && this.state !== "paused") {
      void this.refreshBoard();
      // Landing home after a flight is the one calm beat where a "you can
      // afford this now" nudge reads as a reward instead of an interruption.
      this.maybeAutoOpenShop();
    }
    this.bump();
  }

  private bump(): void {
    this.uiVersion += 1;
  }

  /** Public-facing pilot identity: VIPs wear the crown in every roster. */
  private racedName(): string {
    return this.save.isVipActive() ? `♛ ${this.pilotName}`.slice(0, 16) : this.pilotName;
  }

  /** Copies the room invite link, preferring the native share sheet. */
  /** Share the room invite link with a named pilot (real link, real toast). */
  private async invitePilot(room: string, who: string): Promise<void> {
    const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(room)}`;
    const ok = await copyText(link);
    if (this.disposed) return;
    this.hud.toast(
      ok ? `Invite link for room ${room} copied — send it to ${who}` : `Room ${room} — copy the link from the lobby`,
      ok ? "gold" : "info",
    );
  }

  private copyRoomInvite(code: string): void {
    const url = buildRoomInviteUrl(code);
    const text = `Join my Sunbird race room ${code}: ${url}`;
    // Portal share first: on CrazyGames the native sheet carries its own
    // multiplayer invite params, and on Poki the shareable URL embeds
    // `room=CODE` (read back via getInviteParam) so friends land in the room.
    const platform = this.platform;
    if (platform && platform.name !== "none") {
      void platform.share(text, { room: code }).then((handled) => {
        if (this.disposed) return;
        if (handled) this.hud.toast("Invite shared — send it to friends", "gold");
        else this.shareText(text, `Invite link copied — send it to friends`);
      });
      return;
    }
    this.shareText(text, `Invite link copied — send it to friends`);
  }

  private async copyWithFeedback(text: string, copiedToast: string): Promise<void> {
    const copied = await copyText(text);
    if (this.disposed) return;
    if (copied) this.hud.toast(copiedToast, "info");
    else this.hud.offerCopy(text);
  }

  /** Cancellation is deliberate. Never copy or download behind a dismissed sheet. */
  private shareText(text: string, copiedToast: string): void {
    void shareText(text, flag("nativeShare")).then(result => {
      if (this.disposed) return;
      if (result === "shared") this.hud.toast("Shared!", "gold");
      else if (result === "copied") this.hud.toast(copiedToast, "gold");
      else if (result === "unavailable") this.hud.offerCopy(text);
    });
  }

  private lastRunDistance(): number {
    return Math.max(0, this.bird.x - this.startX);
  }

  /** Share leads the recap when the run is clip-worthy, else the A/B decides. */
  private shareCtaLeads(): boolean {
    if (this.state !== "gameover") return false;
    const experimentShareFirst =
      (this.expShareFirst ??= variant(
        this.save.state.deviceId,
        EXPERIMENTS.results_cta_order.id,
        EXPERIMENTS.results_cta_order.split,
        (v) => {
          this.telemetry.track("experiment_exposure", { experiment: EXPERIMENTS.results_cta_order.id, variant: v });
        },
      )) === "treatment";
    if (!flag("oneMoreRun")) return experimentShareFirst;
    return pickCta({
      viralScore: this.lastViralScore,
      newBest: this.newBest,
      nearMiss: this.nearMiss.kind !== "none",
      photoFinish: Boolean(this.photoFinish),
      runsPlayed: this.save.state.runsPlayed,
      challengeShareOn: flag("challengeShare"),
      experimentShareFirst,
    }).shareFirst;
  }

  private runStats(): RunStats {
    return {
      clouds: this.runClouds,
      island: this.island + 1,
      coins: this.runCoins,
      perfects: this.perfects,
      distance: Math.max(0, this.bird.x - this.startX),
      fever: this.feverReached ? 1 : 0,
      zenith: this.zeniths,
      pickups: this.pickups,
    };
  }

  /** 0..1 — continuous musical intensity from the moment-to-moment flight. */
  /**
   * The game's own 0..1 energy sum: speed, altitude, fever, danger (daylight
   * burning down) and ring chain. This is the *input* to the music arc, not the
   * value written to the score — `MusicArc.ts` shapes it into an envelope over
   * the whole run, and the two are kept apart so the tuning of one never
   * silently changes the other.
   */
  private musicEnergy(): number {
    if (this.state !== "playing") return 0;
    return runEnergy({
      speed: this.bird.speed() / 90,
      alt: this.bird.altitude / ALT_HIGH,
      fever: this.feverOn,
      danger: 1 - Math.max(0, Math.min(1, this.daylight / this.daylightMax())),
      chain: this.ringChain / 4,
      goalsDone: this.runGoalsDone,
    });
  }

  private score(): number {
    return (this.scoreAccum + this.bonus) * this.save.nestMultiplier();
  }

  private seedLabel(): string {
    if (this.seed.startsWith("fly-")) return `Fresh hills · ${this.seed.slice(4).toUpperCase()}`;
    if (this.seedMode === "yesterday") return `Yesterday's hills · ${formatDatePretty(this.seed)}`;
    if (this.seedMode === "random") return `Wild hills · ${this.seed.replace("wild-", "").toUpperCase()}`;
    return `Hills of ${formatDatePretty(this.seed)}`;
  }

  private dailyCard(): DailyCard {
    const c = dailyChallenge(this.today);
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
      done: this.save.isDailyDone(this.today),
      dailiesDone: this.save.state.challenges.dailiesDone,
    };
  }

  private gauntletCard(): GauntletCard {
    // Pure view-building lives in Cards.ts, where it can be tested (audit §10.3).
    const week = weekKey();
    return buildGauntletCard(week, this.save.gauntletDone(week), this.save.state.challenges.gauntletsCleared);
  }

  private calendarCard(): CalendarCard {
    const cal = this.save.state.calendar;
    const claimedToday = cal.lastClaim === this.today;
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

  /** Best distance flown today, or 0 — the mark a "beat today's best" flag stands at. */
  private todayBestDistance(): number {
    let best = 0;
    for (const h of this.save.state.highScores) if (h.date === this.today && h.distance > best) best = h.distance;
    return best;
  }

  /**
   * The marks worth flying at this run, with the caller's own words on them.
   *
   * Labels are built here rather than in `BeatLines.ts` so that module stays pure
   * and owns no vocabulary; a rival's flag carries their name, a daily's carries
   * the day's title. A daily only counts when this run is actually flying the
   * daily and its metric is distance — a coin target cannot be a place on the
   * ground, and a flag that measures the wrong thing is worse than no flag.
   */
  private beatInput(flown: number): BeatLineInput {
    const daily = this.challengeRun === "daily" ? dailyChallenge(this.today) : null;
    const goal = this.goals.goals.find((g) => !g.done && g.kind === "distance");
    const rival = this.rival && this.seed === this.rival.seed ? this.rival : null;
    return {
      distance: flown,
      best: this.save.state.bestDistance,
      todayBest: this.todayBestDistance(),
      rival: rival ? { name: rival.name, distance: rival.distance } : null,
      dailyTarget: daily && daily.metric === "distance" ? daily.target : null,
      goalTarget: goal ? goal.target : null,
      labels: {
        rival: rival ? `Beat ${rival.name.toUpperCase()}` : "",
        best: "Your best",
        daily: daily ? daily.title.toUpperCase() : "",
        today: "Today's best",
        goal: "Goal",
      },
      format: (n) => `${Math.round(n).toLocaleString("en-US")} m`,
    };
  }

  /** Stand the pool's flags at the marks ahead; hide slots with nothing to show.
   * In race modes the finish gate is the star — a beat flag 20m from it would
   * read as clutter and steal the finish moment, so flags within 80m of the gate
   * or beyond it are hidden. No overlap in gameplay. */
  private placeBeatFlags(): void {
    const finish = this.mode.finish > 0 ? this.mode.finish : 0;
    for (let i = 0; i < this.beatFlags.length; i++) {
      const flag = this.beatFlags[i]!;
      const target = this.beatAhead[i];
      if (!target) {
        flag.hide();
        continue;
      }
      if (finish > 0 && (target.at >= finish || Math.abs(target.at - finish) < 80)) {
        flag.hide();
        continue;
      }
      flag.place(this.startX + target.at, this.terrain, target.label, target.metres, BEAT_TINTS[target.kind]);
    }
  }

  /**
   * A mark flown past. Fires once per mark per run — a goal flag can legitimately
   * return at a new number when the goal refills, but the same number twice would
   * be the same celebration replayed.
   */
  private beatLineCrossed(target: BeatTarget): void {
    const key = `${target.kind}:${target.at}`;
    if (this.beatFired.has(key)) return;
    this.beatFired.add(key);
    this.telemetry.track("beat_line", { kind: target.kind });
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);

    if (target.kind === "best") {
      // The number the whole session has been chasing, flown past in the world
      // where it lives: the loudest honest moment the game has.
      this.showBanner(`${target.metres} beaten`, "best");
      this.audio.triggerViralGlissando();
      this.audio.milestone();
    } else if (target.kind === "rival") {
      // The words already exist — `rivalBeatenToast` fires on this same threshold
      // — so the flag turning green plus confetti is the visual half of that
      // moment, not a second one competing with it.
      this.audio.milestone();
    } else if (target.kind === "daily") {
      const reward = dailyChallenge(this.today).reward;
      this.audio.ding();
      // Paid when the run lands, and the pill says so.
      this.popQueue = enqueuePop(this.popQueue, { text: `${target.label} ✓  +${reward} on landing`, kind: "quest" }, 3);
    } else {
      this.audio.ding();
      this.popQueue = enqueuePop(this.popQueue, { text: `${target.label} ✓  ${target.metres} beaten`, kind: "goal" }, 3);
    }
    this.bump();
  }

  /**
   * One banner, so two rare moments in one frame queue instead of overwriting:
   * crossing a personal best and a career rung on the same long flight is not
   * unusual, and losing either would be losing the point of the flight.
   */
  private showBanner(text: string, kind: BannerKind): void {
    if (this.rankUpT > 0) {
      this.bannerQueue = enqueue(this.bannerQueue, { text, kind }, 2);
      return;
    }
    this.rankUp = text;
    this.rankUpKind = kind;
    this.rankUpT = 2.6;
  }

  /** Build onboarding context from live save + run state */
  private onboardingContext(): OnboardingContext {
    const st = this.save.state;
    return {
      runs: st.runsPlayed,
      bestDistance: st.bestDistance,
      coins: st.wallet,
      ownedBirds: st.ownedSkins.length,
      hasSeenShop: st.seenShop,
      hasSeenPvp: st.seenPvp,
      hasSeenPve: st.seenPve,
      hasSeenLeaderboards: st.seenLeaderboards,
      hasSeenChallenges: st.seenChallenges,
      hasSeenStoreBirds: st.onboardingSeen.includes("store-birds"),
      hasSeenStoreTrails: st.onboardingSeen.includes("store-trails"),
      hasSeenStoreUpgrades: st.onboardingSeen.includes("store-upgrades"),
      feverUnlocked: st.lifetime.zeniths > 0 || this.feverReached,
      sunflowerBounced: st.lifetime.sunflowers > 0,
      perfectLandings: this.perfects,
      nearBest: this.rival ? false : false,
      isRecord: this.newBest,
    };
  }

  /** Update current onboarding tip — called on screen changes and run ends */
  private updateOnboarding(): void {
    const ctx = this.onboardingContext();
    const seen = new Set<OnboardingId>(this.save.state.onboardingSeen as OnboardingId[]);
    const inFlight = this.state === "playing";
    this.onboardingTip = nextOnboardingTip(ctx, seen, inFlight);
  }

  private wingsCard(): HudSnapshot["wings"] {
    const life = this.save.state.lifetime.distance;
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

  private rivalCard(): RivalCard {
    // Pure view-building lives in Cards.ts; the clock-derived season footer is
    // passed in so that module never reads a Date.
    return buildRivalCard(this.save.state.rival, this.seasonCard());
  }

  /** Ranked-season summary: countdown, peak, and the payout it locks in. */
  private seasonCard(): RivalCard["season"] {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
    const peak = this.save.state.rankSeason.peak;
    const reward = seasonReward(peak);
    return {
      daysLeft,
      peak: Math.floor(peak),
      peakDivision: reward.division.name,
      peakIcon: reward.division.icon,
      rewardCoins: reward.coins,
    };
  }

  private loadoutView(): LoadoutView {
    const trail = this.save.state.activeTrail
      ? (TRAILS[this.save.state.activeTrail]?.label ?? this.save.state.activeTrail)
      : "Default trail";
    return {
      bird: this.skin.name,
      trail,
      boosts: this.save.state.armedBoosts.length,
    };
  }

  private ghostDelta(): number | null {
    if (!this.ghostPlayer.active) return null;
    const dist = Math.max(0, this.bird.x - this.startX);
    const t = Math.min(this.runTime, 99999);
    const gx = this.ghostPlayer.update(t, 0);
    if (gx === null) return dist - this.ghostPlayer.bestDistance();
    return this.bird.x - gx;
  }

  /** Challenge/calendar/mastery cards, rebuilt only when the UI version bumps. */
  private cardCache: { daily: DailyCard; gauntlet: GauntletCard; calendar: CalendarCard; mastery: ReturnType<typeof masteryViews> } = {
    daily: { title: "", modeName: "", modeIcon: "", modifierIcon: "", modifierLabel: "", modifierDesc: "", metric: "", target: 0, reward: 0, done: false, dailiesDone: 0 },
    gauntlet: { week: "", stages: [], clearBonus: 0, cleared: false, lifetimeClears: 0 },
    calendar: { cycleDay: 0, claimedToday: false, days: [] },
    mastery: [],
  };

  private refreshViews(): void {
    const st = this.save.state;
    this.cardCache = {
      daily: this.dailyCard(),
      gauntlet: this.gauntletCard(),
      calendar: this.calendarCard(),
      mastery: masteryViews(this.save),
    };
    const stats = this.state === "menu" ? null : this.runStats();
    this.missionViews = this.missions.view(stats);
    this.questViews = this.missions.questView(this.today, stats);
    const flash = dailyFlashBird(this.today);
    this.skinViews = SKINS.map((def) => {
      const dealPrice = def.id === flash.id ? flash.price : undefined;
      const price = dealPrice ?? def.price;
      return {
        def,
        owned: st.ownedSkins.includes(def.id),
        equipped: st.activeSkin === def.id,
        locked: (Boolean(def.goldOnly) && !st.gold) || (Boolean(def.vipOnly) && !st.vip),
        lockReason: def.vipOnly && !this.save.isVipActive() ? "vip" : def.goldOnly && !st.gold ? "gold" : null,
        affordable: st.wallet >= price,
        dealPrice,
      };
    });
    const deal = dailyDealBoost(this.today);
    this.boostViews = BOOSTS.map((def) => {
      const dealPrice = def.id === deal.id ? deal.price : undefined;
      return { def, armed: def.permanent ? st.ownedUpgrades.includes(def.id) : st.armedBoosts.includes(def.id), affordable: st.wallet >= (dealPrice ?? def.price), dealPrice };
    });
    this.shopTrailViews = SHOP_TRAILS.map((def) => ({
      def,
      owned: st.tournaments.trails.includes(def.id),
      equipped: st.activeTrail === def.id,
      affordable: st.wallet >= def.price,
    }));
    this.viewsVersion = this.uiVersion;
  }

  private pushHud(): void {
    const now = performance.now();
    // Values refresh at 30 Hz; screen/action changes still commit immediately.
    if (this.lastHudVersion === this.uiVersion && now - this.lastHudAt < 1000 / 30) return;
    this.lastHudAt = now;
    this.lastHudVersion = this.uiVersion;
    if (this.viewsVersion !== this.uiVersion) this.refreshViews();
    const st = this.save.state;
    const stats = this.runStats();
    const todayBest = this.todayBestDistance();
    const sTier = this.seasonPass.tier();
    const sProg = this.seasonPass.progressInTier();
    const snap: HudSnapshot = {
      state: this.state,
      screen: this.screen,
      checkoutSku: this.checkoutSku,
      portalName: this.platform?.name ?? getPortalTarget(),
      // Poki can render its own leaderboard overlay; the button only appears
      // when the deployed SDK actually offers it.
      portalLeaderboard: this.platform?.capabilities().includes("leaderboard") ?? false,
      // Same rule as the leaderboard button: only offer a portal surface the
      // deployed SDK actually exposes, so the privacy screen never grows a
      // button that silently does nothing.
      portalExternalLink: this.platform?.capabilities().includes("externalLink") ?? false,
      version: this.uiVersion,
      distance: stats.distance,
      runTime: this.runTime,
      coins: this.runCoins,
      multiplierClaimed: this.multiplierClaimed,
      daylight: this.daylight,
      daylightMax: this.daylightMax(),
      fever: this.feverOn ? this.feverTimer / (FEVER_DURATION + this.gameplaySkin.feverBonus + this.masteryPerk.feverBonus) : this.perfectChain / FEVER_NEED,
      feverOn: this.feverOn,
      multiplier: this.save.nestMultiplier() * (this.feverOn ? 2 : 1),
      bestDistance: st.bestDistance,
      score: this.score(),
      island: this.island,
      perfects: this.perfects,
      clouds: this.runClouds,
      zeniths: this.zeniths,
      rings: this.runRings,
      balloons: this.runBalloons,
      sunflowers: this.runSunflowers,
      hint: this.state === "playing" ? this.coachHint() || this.hint : "",
      magnetTimer: this.magnetTimer,
      shield: this.shield,
      boostTimer: this.boostTimer,
      gold: st.gold,
      vip: this.save.isVipActive(),
      vipDaysLeft: this.save.vipDaysLeft(),
      vipExpiredNotice: this.vipExpiredNotice,
      adsLeftToday: this.save.adsLeftToday(),
      ghostDelta: this.state === "playing" || this.state === "gameover" ? this.ghostDelta() : null,
      timePressure: this.state === "playing" ? getTimePressureMessage(this.ghostDelta(), Math.max(0, this.bird.x - this.startX), this.save.state.bestDistance, Math.floor(this.runTime)) : null,
      newBest: this.newBest,
      celebration: celebrationView(this.celebration),
      proximity: this.proximity,
      continueTimer: this.continueTimer,
      continueReason: this.continueOfferView?.reason ?? "",
      continueHighlight: this.continueOfferView?.highlight ?? false,
      continueCost: CONTINUE_COST,
      canAffordContinue: st.wallet >= CONTINUE_COST,
      // Portal: only advertise a rewarded option the SDK can actually pay out.
      adAvailable: this.portalEnabled() ? this.adsLive() : SIMULATED_BREAKS && this.ads.isAvailable(),
      adTimer: this.adTimer,
      adTotal: this.ads.duration,
      adReason: this.adReason,
      seedLabel: this.seedLabel(),
      wings: this.wingsCard(),
      flightPath: this.state === "gameover" ? this.flightPath : [],
      rivalBanner: this.rival && this.rivalResult === "" ? `${this.rival.name}|${this.rival.distance}` : "",
      seedMode: this.seedMode,
      wallet: st.wallet,
      piggyCoins: st.piggyBank?.coins ?? 0,
      prestigeLevel: st.prestige?.level ?? 0,
      prestigeMult: st.prestige?.multiplier ?? 1.0,
      canFreeSpin: this.save.canFreeWheelSpin(this.today),
      streakDays: st.streak.days,
      nestLevel: st.nestLevel,
      nestMult: this.save.nestMultiplier(),
      nestPrice: this.save.nestUpgradePrice(),
      nestMaxed: this.save.state.nestBought >= 10,
      missions: this.missionViews,
      quests: this.questViews,
      // One next action, from today's quests read against *live* counters, so the
      // line on the results card is about the flight that just ended and not the
      // last time the menu was opened.
      nextAction: nextActionLine(
        missionRows(this.missions.dailyQuests(this.today), this.state === "menu" ? null : this.runStats(), this.save.questsClaimed(this.today)),
        Math.max(todayBest, this.state === "menu" ? 0 : this.runStats().distance),
      ),
      highScores: st.highScores,
      todayBest,
      runsPlayed: st.runsPlayed,
      newlyCompleted: this.newlyCompleted,
      claimedQuests: this.claimedQuests,
      skins: this.skinViews,
      boosts: this.boostViews,
      shopTrails: this.shopTrailViews,
      settings: st.settings,
      goldPrice: GOLD.price,
      starterPrice: STARTER_PACK.price,
      starterFeatures: STARTER_PACK.features,
      starterOwned: this.save.state.starterPack,
      goldFeatures: GOLD.features,
      vipPrice: VIP.price,
      vipFeatures: VIP.features,
      checkoutMode: this.checkoutMode(),
      checkoutUrl: "",
      checkoutBusy: this.checkoutBusy,
      checkoutError: this.checkoutError,
      checkoutOk: this.checkoutOk,
      checkoutWaiting: this.checkoutWaiting,
      restoreMessage: this.restoreMessage,
      resetArmed: this.resetArmed,
      season: {
        tier: sTier,
        maxTier: this.seasonPass.view().length,
        have: sProg.have,
        need: sProg.need,
        label: seasonLabel(seasonId()),
        tiers: this.seasonPass.view(),
      },
      trophies: this.achievements.view(),
      trophyCounts: this.achievements.counts(),
      referralCode: st.referralCode,
      referralRedeemed: st.referralRedeemed,
      referralMessage: this.referralMessage,
      cloudCode: this.screen === "account" ? this.save.exportCode() : "",
      cloudMessage: this.cloudMessage,
      canInstall: Boolean(this.deferredInstall) && !this.portalEnabled(),
      shareBusy: this.shareBusy,
      expShareFirst: this.shareCtaLeads(),
      combo: Math.max(this.perfectChain, this.versus && this.p1 ? this.p1.launch.combo : this.launch.combo),
      ringChain: this.ringChain,
      ringChainFrac: RING_CHAIN_WINDOW > 0 ? this.ringChainTimer / RING_CHAIN_WINDOW : 0,
      slopeChain: this.slopeChain.chain,
      slopeScore: this.slopeChain.score,
      // Normalised against the real top speed (MAX_SPEED), not a round 100:
      // the HUD's speed FX share the SpeedFeel bands with the camera, and a
      // denominator that saturates 8 units early would flatten the ramp.
      speedNorm: Math.min(1, this.bird.speed() / MAX_SPEED),
      gust: this.weather.gust,
      inThermal: this.weather.inThermal,
      biomeName: this.terrain.biomeAt(this.bird.x).name,
      biomeEmoji: this.terrain.biomeAt(this.bird.x).emoji,
      atlas: this.screen === "atlas" ? this.atlas() : [],
      farthestIsland: Math.max(st.farthestIsland, this.island),
      launchBanner: this.launchBannerText,
      launchBannerT: this.launchBannerT,
      launchRating: this.lastLaunch?.rating ?? "none",
      altitude: this.versus && this.p1 ? this.p1.bird.altitude : this.bird.altitude,
      altZone: this.altZone,
      maxAltitude: this.maxAltitude,
      powers: this.versus && this.p1 ? this.p1.powers.view() : this.powers.view(),
      modes: MODES,
      modeId: this.modeId,
      modeName: this.mode.name,
      modeIcon: this.mode.icon,
      countdown: this.countdown,
      versus: this.versus,
      splitLayout: this.input.splitMode,
      versusWinner: this.versusWinner,
      p1Stats: this.p1 && this.versus ? this.p1.stats : null,
      p2Stats: this.p2 && this.versus ? this.p2.stats : null,
      raceFinish: RACE_FINISH,
      sessionGoals: this.goals.goals,
      goalPop: this.goalPopT > 0 ? this.goalPop : "",
      goalPopKind: this.goalPopKind,
      rankUp: this.rankUpT > 0 ? this.rankUp : "",
      rankUpKind: this.rankUpKind,
      onboardingTip: this.onboardingTip ? { id: this.onboardingTip.id, title: this.onboardingTip.title, body: this.onboardingTip.body, target: this.onboardingTip.target } : null,
      beatLine: this.beatCue
        ? {
            kind: this.beatCue.kind,
            label: this.beatCue.label,
            metres: this.beatCue.metres,
            gap: Math.max(0, Math.round(this.beatCue.at - Math.max(0, this.bird.x - this.startX))),
          }
        : null,
      nearMiss: this.nearMiss.text,
      skillLabel: this.flow.label(),
      skill: this.flow.skill,
      bestAltitude: this.save.state.bestAltitude,
      bestCombo: this.save.state.bestCombo,
      runGems: this.runGems,
      moments: this.state === "playing" || this.state === "gameover" || this.state === "continue" ? this.moments.tally(4) : [],
      clips: this.state === "gameover" || this.state === "continue" ? this.clips.tally(4) : [],
      viralScore: this.state === "gameover" || this.state === "continue" ? this.lastViralScore : 0,
      packBalancing: this.massRace.packBalancingOn,
      pilotName: this.pilotName,
      board: this.boardPage,
      boardLoading: this.boardLoading,
      boardScope: this.boardScope,
      boardMetric: this.boardMetric,
      boardOnline: isLeaderboardOnline(),
      // Pulled from the page the menu already warms (scope global / distance):
      // no extra request, and nothing to render on a cold cache.
      homeBoard: (this.board.peek("global", "distance")?.entries ?? []).slice(0, 3).map((e) => ({
        name: e.name,
        value: `${Math.round(e.value).toLocaleString()} m`,
        you: e.you,
      })),

      cups: this.cups.view(),
      trails: this.cups.ownedTrails().map((id) => ({
        id,
        label: TRAILS[id]?.label ?? id,
        equipped: st.activeTrail === id,
      })),
      lastPrize: this.lastPrize ? `${this.lastPrize.prize.icon} ${this.lastPrize.prize.label}` : "",
      standings:
        this.massRace.active && this.state === "playing"
          ? this.massRace.standings(this.bird.x, this.startX, this.pilotName, 6).rows
          : [],
      racePlace: this.racePlace,
      raceFinishM: this.mode.finish,
      raceField: this.raceField,
      raceFinishTime: this.raceFinishTime,
      massRace: isRaceMode(this.modeId),
      multiplayerLive: isMultiplayerConfigured() && !(this.state === "playing" && this.localRace),
      multiplayerConfigured: isMultiplayerConfigured(),
      roster:
        this.massRace.active && this.state === "playing"
          ? this.massRace.roster(this.bird.x, this.startX, this.mode.finish, this.pilotName)
          : [],
      roomCode: this.roomCode,
      roomCount: this.net?.info().count ?? 0,
      roomCapacity: this.net?.info().capacity ?? MASS_RACE_FIELD,
      roomReady: this.net?.info().ready ?? false,
      roomReadyCount: (this.net?.roster().filter((p) => p.ready).length ?? 0) + (this.net?.info().ready ? 1 : 0),
      roomSize: this.roomSize,
      roomSkill: this.roomSkill,
      roomMuted: this.roomMuted,
      // Only the lobby screen can consume these — no per-frame allocs elsewhere.
      roomRivals:
        this.screen === "live"
          ? this.massRace.rivals.slice(0, 12).map((r) => ({ id: r.id, name: r.name, skill: Math.round(r.skill * 100), hue: Math.round(r.hue * 360) }))
          : [],
      netState: this.net?.info().state ?? "offline",
      linkQuality: this.net instanceof RealtimeClient ? this.net.connectionQuality : "unknown",
      netError: this.net?.info().error ?? "",
      draft: this.massRace.draft,
      finishRemaining: this.finishRemaining,
      nemesis: this.nemesis,
      photoFinish: this.photoFinish,
      rival: this.rivalCard(),
      loadout: this.loadoutView(),
      // Lobby-only field: computed every frame before, including mid-flight
      // and on the results card, where no one renders it.
      lobbyRivals:
        this.state === "menu" && this.screen === "live"
          // Truth only: the pilots actually seated in this room. No padded
          // name-pool rivals, no borrowed leaderboard names — an empty room
          // renders as an empty room.
          ? lobbyRivals(this.net?.roster() ?? [])
          : [],
      raceRated: this.rankedRace,
      raceVerified: this.serverPlaceApplied,
      ratingDelta: this.lastRatingDelta,
      ratingBonus: this.lastRatingBonus,
      duel: { ...st.duel },
      duelWas: this.duelResult,
      duelDelta: this.duelDelta,
      duelFoe: duelOpponent(`${this.seed}:${this.today}`, st.rival.rating),
      daily: this.cardCache.daily,
      gauntlet: this.cardCache.gauntlet,
      calendar: this.cardCache.calendar,
      mastery: this.cardCache.mastery,
      challengeOutcome: this.challengeOutcome,
      weeklyEvent: weeklyEvent(),
      monthlyTheme: monthlyTheme(),
      eventClearsWeek: st.events.week === weekKey() ? st.events.clearsThisWeek : 0,
      eventClearsMonth: st.events.month === monthKey() ? st.events.clearsThisMonth : 0,
      themeTrailClaimed: st.events.claimedTrailMonth === monthKey(),
      themeTrailNeed: THEME_TRAIL_CLEARS,
      campaign: campaignViews(this.save, st.campaignClaimed),
      campaignDone: campaignProgress(st.campaignClaimed).done,
      campaignTotal: campaignProgress(st.campaignClaimed).total,
      squad: this.squad?.state ?? emptySquadState(),
      recentPilots: this.pilots.all(),
      share: {
        available: sharingAvailable(),
        code: this.shareCode,
        busy: this.runShareBusy,
        error: this.shareError,
        loaded: this.sharedRun,
      },
      squadNotice: this.squadNotice,
      dailyFlash: dailyFlashBird(this.today),
      stipendClaimed: this.save.state.lastStipendClaimed === this.today,
      rankPrizeClaimed: this.save.state.rankPrizeSeason === rankSeasonId(),
      wingmanBundle: this.save.state.wingmanBundle === true,
      showTutorialHand:
        this.state === "playing" &&
        !this.input.diving &&
        // First-flight coach: a brand-new player who has not held yet gets the
        // demonstrative press hand for the whole "dive" step, not just the old
        // 2.6 s — a static text line for up to two minutes is exactly the
        // dead-air the baseline probe measured. The hand hides the instant the
        // player dives (they've got it) and never outstays a completed coach.
        (this.coach && !this.coach.done && this.coach.view().step === 0
          ? true
          : st.tutorialRuns < 2 && this.hintTimer < 2.6),
      pvpModes: PVP_MODES,
      pvpWorlds: PVP_WORLDS,
      selectedPvpMode: this.selectedPvpMode,
      selectedPvpWorld: this.selectedPvpWorld,
    };
    this.hud.update(snap);
  }

  /* ------------------------------------------------------- versus (2P) */

  private startVersus(): void {
    this.disconnectRace();
    this.roomCode = "";
    this.versus = true;
    this.modeId = "race";
    this.mode = modeById("race");
    this.versusWinner = 0;
    this.resetRun(true);
    this.bird.root.visible = false;
    this.ghostPlayer.reset();

    if (!this.p1) this.p1 = new Racer(0, "P1", 0xff7a45, this.terrain, this.scene);
    if (!this.p2) this.p2 = new Racer(1, "P2", 0x4aa8f0, this.terrain, this.scene);
    this.p1.applySkin(this.skin);
    this.p2.applySkin(skinById(this.save.state.ownedSkins.includes("bluejay") ? "bluejay" : "sunbird"));
    this.p1.reset(this.terrain, 64);
    this.p2.reset(this.terrain, 64);
    this.p1.camera.setBaseFov(58);
    this.p2.camera.setBaseFov(58);

    this.countdown = 3;
    this.resize(); // Resolve touch halves immediately, not after a later resize event.
    this.setState("playing");
    this.setScreen("main");
    void this.audio.resume();
    this.audio.setMusicMode("play");
    this.telemetry.track("versus_start", { seed: this.seed });
  }

  private versusTick(dt: number): void {
    const p1 = this.p1!;
    const p2 = this.p2!;
    const ev = {
      onLaunch: (r: LaunchResult, racer: Racer) => {
        if (r.rating === "perfect") {
          this.particles.burstRing(racer.bird.x, racer.bird.y, 0xffe08a);
          this.audio.perfect();
        } else if (r.rating === "great") {
          this.particles.burstRing(racer.bird.x, racer.bird.y, 0xc8f0ff);
        }
      },
      onLand: (_quality: number, racer: Racer) => {
        if (racer.bird.impact <= 5) return;
        this.audio.land(racer.bird.impact);
        racer.camera.bump(Math.min(0.45, racer.bird.impact * 0.03));
        if (racer.bird.impact > 6) {
          const ridge = this.terrain.biomeAt(racer.bird.x).ridge;
          this.particles.emitThunk(racer.bird.x, racer.bird.y, ((ridge >> 16) & 255) / 255, ((ridge >> 8) & 255) / 255, (ridge & 255) / 255);
          this.particles.burstRing(racer.bird.x, racer.bird.y, racer.tint);
          if (racer.bird.impact > 10) this.hud.toast(`${racer.label} SMASH!`, "thud");
        }
      },
      onCoin: (gem: boolean, x: number, y: number) => {
        this.audio.ding();
        this.particles.emitCollect(x, y);
        if (gem) this.particles.burstRing(x, y, 0x9ae8ff);
      },
      onCloud: (_k: CloudKind, x: number, y: number) => {
        this.audio.cloud();
        this.particles.burstRing(x, y, 0xffffff);
      },
      onPickup: (_k: string, x: number, y: number) => {
        this.audio.powerup();
        this.particles.emitCollect(x, y);
      },
      onSplash: (racer: Racer) => {
        this.audio.splash();
        this.particles.burstRing(racer.bird.x, WATER_Y + 1, 0xafe8ff);
        this.hud.toast(`${racer.label} SPLASH!`, "cloud");
      },
    };
    p1.step(dt, this.input.diving, this.terrain, this.particles, ev);
    p2.step(dt, this.input.diving2, this.terrain, this.particles, ev);

    for (const r of [p1, p2]) {
      if (!r.finished && r.stats.distance >= RACE_FINISH) {
        r.finished = true;
        r.stats.finishedAt = r.runTime;
        if (this.versusWinner === 0) {
          this.versusWinner = r.index + 1;
          this.hud.toast(`${r.label} wins!`, "gold");
          this.audio.island();
          this.particles.emitConfetti(r.bird.x, r.bird.y + 4);
        }
      }
    }
    if (p1.finished && p2.finished) this.finishVersus();
    else if (this.versusWinner !== 0) {
      // Give the trailing bird a few seconds of glory, then wrap up.
      this.versusGrace -= dt;
      if (this.versusGrace <= 0) this.finishVersus();
    }
  }

  private finishVersus(): void {
    if (this.state === "gameover") return;
    const p1 = this.p1!;
    const p2 = this.p2!;
    if (this.versusWinner === 0) this.versusWinner = p1.stats.distance >= p2.stats.distance ? 1 : 2;
    this.input.splitMode = "off";
    this.telemetry.track("versus_end", { winner: this.versusWinner });
    this.setState("gameover");
  }

  private exitVersus(): void {
    this.versus = false;
    this.input.splitMode = "off";
    this.bird.root.visible = true;
    if (this.p1) this.p1.bird.root.visible = false;
    if (this.p2) this.p2.bird.root.visible = false;
  }

  private toggleFullscreen(): void {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
      webkitCancelFullScreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    const docEl = (document.documentElement || document.body) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      webkitRequestFullScreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
    if (!isFull) {
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.webkitRequestFullScreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (req) {
        try {
          const res = req.call(docEl);
          if (res && typeof res.then === "function") {
            res.then(() => {
              this.hud.toast("Full screen mode", "gold");
              this.resize();
            }).catch(() => {
              this.hud.toast("Full screen mode unavailable", "info");
            });
          } else {
            this.hud.toast("Full screen mode", "gold");
            this.resize();
          }
        } catch {
          this.hud.toast("Full screen mode unavailable", "info");
        }
      } else {
        this.hud.toast("Full screen not supported on this browser", "info");
      }
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (exit) {
        try {
          const res = exit.call(doc);
          if (res && typeof res.then === "function") {
            res.then(() => {
              this.hud.toast("Exited full screen", "info");
              this.resize();
            }).catch(() => {});
          } else {
            this.hud.toast("Exited full screen", "info");
            this.resize();
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  private resize(): void {
    if (this.disposed) return;
    // CSS sizes the canvas/HUD to the host. A keyboard or pinch zoom can shrink
    // visualViewport without resizing that host; using it would stretch WebGL
    // and make its split layout disagree with pointer coordinates and the HUD.
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w <= 0 || h <= 0) return; // Ignore transient hidden/rotation dimensions.
    // A ResizeObserver and window resize can report the same size. Avoid
    // resetting canvas storage / bloom targets twice (or on unchanged DPR).
    if (w !== this.renderWidth || h !== this.renderHeight || this.dpr !== this.renderDpr) {
      if (this.dpr !== this.renderDpr) this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(w, h, false);
      this.camera.resize(w / Math.max(1, h));
      this.camera.setBaseFov(50);
      this.fx?.resize(w, h, this.dpr);
      this.renderWidth = w;
      this.renderHeight = h;
      this.renderDpr = this.dpr;
    }
    if (this.p1 && this.p2) {
      this.input.splitMode = this.versus ? splitLayout(w, h) : "off";
    }
  }
}
