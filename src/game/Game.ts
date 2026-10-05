import { buildStamp } from "./version";
import { skinShape } from "./Sunbird";
import { biomeClimb } from "./FlightProgression";
import { chartingBonus, islandTemplate } from "./Biomes";
import { FRENZY_AT, chainBonus, chainLabel, chainPulse, chainScale, chainTier, isFrenzyMoment } from "./ChainFlair";
import { splitLayout, splitViews } from "./Viewport";
import { iconGlyph } from "./MenuIcons";
import { equalizedRace } from "./Racer";
import { terrainCue, landingLookAhead } from "./FlightGuidance";
import { ScreenHistory } from "./ScreenHistory";
import { copyText, shareText } from "./Clipboard";
import { replayOptions, shouldRebuildCasualWorld, type RunOptions } from "./Replay";
import * as THREE from "three";
import { Achievements } from "./Achievements";
import { GameAudio } from "./Audio";
import { biomeForIsland } from "./Biomes";
import { Bird, type BirdStepOpts } from "./Bird";
import { AttractPilot } from "./pilot";
import { CameraRig } from "./CameraRig";
import { PICKUP_STYLE, Collectibles, type CloudKind, type PickupKind } from "./Collectibles";
import { evaluateNearMiss, FlowTuner, SessionGoals, type NearMiss } from "./Engagement";
import { BIG_LAUNCH_QUIPS, BOP_QUIPS, FEVER_QUIPS, GEM_QUIPS, MILESTONE_QUIPS, SLEEP_QUIPS, SPLASH_QUIPS, SURRENDER_QUIPS, SURPRISE_ICON, THUD_QUIPS, SurpriseEngine, quip } from "./Surprises";
import { MOMENTS, MomentLedger, momentShouldReact, type MomentKind } from "./Moments";
import { MusicMomentGate, momentMusic } from "./MusicMoments";
import { Funnel, type FunnelStage } from "./Funnel";
import { outcomeForNaturalEnd } from "./runOutcome";
import type { Fx } from "./Fx";
import { DPR_COOLDOWN_SECONDS, nextBloomBudget, nextDpr, nextEffectBudget, QUALITY_WINDOW_SECONDS, type EffectBudget } from "./quality";
import { LaunchSystem, ratingLabel, type LaunchResult } from "./LaunchSystem";
import { isRaceMode, MASS_RACE_FIELD, MODES, modeById, PVP_MODES, PVP_WORLDS, RACE_FINISH, type ModeDef, type ModeId, type PvpWorldCourse } from "./Modes";
import { adBreakAllowsAction, adBreakCanEnd, adEscapeArmed } from "./adGate";
import { liveFieldSize, MassRace } from "./MassRace";
import { FinishGate } from "./FinishGate";
import { fetchPublicRooms, isMultiplayerConfigured, type AnyRealtimeClient } from "./Realtime";
import { createNetTransport, prewarmNetTransport } from "./net-transport";
import { photoFinishMessage } from "./Racer";
import { SlopeChain } from "./SlopeChain";
import { RoomWatcher, ROOM_POLL_MS, roomSummaryLine, summarizeRooms, type LiveRoom } from "./RoomBrowser";
import { Leaderboard, loadPilotName, savePilotName, isLeaderboardOnline, type BoardMetric, type BoardPage, type BoardScope } from "./Leaderboard";
import { generatePilotName, moderatePilotName, pilotNameRejection } from "./pilotNameGenerator";
import { adoptPortalLocale, setLocale, t, whenLocaleReady, type SupportedLocale } from "../i18n";
import { CUP_TITLES, Tournaments, TRAILS, weekKey, type PrizeGrant } from "./Tournaments";
import {
  challengeMode,
  dailyChallenge,
  dailyVerdict,
  modsFor,
  NO_MODS,
  stageVerdict,
  weeklyGauntlet,
  type ChallengeMods,
  type DailyChallenge,
} from "./Challenges";
import { bankMasteryRun, masteryPerks, masteryViews, NO_MASTERY_PERKS, type MasteryPerks } from "./Mastery";
import { FirstFlight } from "./FirstFlight";
import { bootStage, defer } from "./BootProgress";
import { continueOffer, continuePlacementLabel, type ContinueOffer } from "./ContinueOffer";
import { createWakeLock, type ScreenWakeLock } from "./WakeLock";
import { detectDeviceProfile, describeDeviceProfile, deviceProfileTelemetry, worldTierFor, type DeviceProfile } from "../sdk/device-report";
import { campaignProgress, campaignViews } from "./Campaign";
import { monthKey, monthlyTheme, THEME_TRAIL_CLEARS, weeklyEvent } from "./Events";
import {
  emptySquadState,
  squadQuestClaimState,
  squadQuestScope,
  SquadClient,
  SQUAD_QUESTS,
  type SquadQuestProgressInput,
} from "./Squad";
import { PowerUps } from "./PowerUps";
import { Racer } from "./Racer";
import {
  ALT_CEILING,
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
  AD_SAFETY_SECONDS,
  COMMERCIAL_BREAK_MIN_GAP_MS,
  CONTINUE_TIMEOUT,
  ISLAND_REFILL_CEILING,
  DAYLIGHT_MAX,
  DAYLIGHT_MAX_GOLD,
  DAYLIGHT_OCEAN_PENALTY,
  DAYLIGHT_SPLASH_INTERVAL,
  CLIMB_DAYLIGHT_BONUS,
  RENDER_RECENTER_THRESHOLD,
  SOLO_START_COUNTDOWN,
  MAX_CATCHUP_STEPS,
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
  WATER_Y,
ZENITH_ALT,
ZENITH_DURATION,
ZENITH_SLOWMO,
ZENITH_THERMAL_VY,
SHOP_AD_COINS,
SHOP_AD_SESSION_CAP,
  FLARE_BRAKE,
  START_ALTITUDE,
  START_SPEED,
} from "./constants";
import { islandEntry } from "./hud/islandRefill";
import { RELEASE_KICK } from "./FlightPhysics";
import { freeSlots } from "./hud/loadout";
import { BOOSTS, COLLECTIONS, GOLD, PROMO_CODES, SHOP_TRAILS, SKINS, STARTER_PACK, VIP, WHEEL_SECTORS, dailyDealBoost, dailyFlashBird, normalizePerks, skinById, type BoostView, type ShopTrailDef, type ShopTrailView, type SkinDef, type SkinView } from "./Economy";
import { nextWings, wingsFor, wingsPromotion } from "./Career";
import { GhostPlayer, GhostRecorder } from "./Ghost";
import { fetchRivalGhost, publishGhost } from "./GhostNet";
import { paceTargetDistance, synthesizePaceGhost } from "./RivalGhost";
import { atlas, calendarCard, dailyCard, gauntletCard, loadoutView, rivalCard, wingsCard } from "./gameCards";
import { HUD, type CalendarCard, type CheckoutMode, type DailyCard, type GauntletCard, type HudSnapshot, type SeedMode, type UiScreen, type UiState } from "./HUD";
import { divisionFor, duelOpponent, duelSkillFor, lobbyRivals, rankSeasonId, seasonReward } from "./pvp";
import { PilotBook } from "./pilots";
import { launchIntentFor, pvpCircuitFor } from "./launchRouting";
import { countSharePlay, loadSharedRun, shareRun, sharingAvailable, type SharedRun } from "./SharedRun";
import { Input } from "./Input";
import { clamp, dateSeed, formatDatePretty, lerp, SeededRandom } from "./math";
import { Missions, missionRows as buildMissionRows, nextActionLine, newlyDone, type MissionRow, type MissionView, type QuestReward, type QuestView, type RunStats } from "./Missions";
import { ParticleFX } from "./ParticleFX";
import { celebrationView, planCelebration, wingsProximity, type ProgressEvent } from "./ProgressBeats";
import { NO_RUN_PROGRESS, runProgressEvents, type RunChallenge, type RunProgressFacts } from "./RunProgress";
import { TrailRibbon } from "./Trail";
import { fetchServerEntitlements,
  PlaceholderAdProvider,
  CoinPaymentProvider,
  type AdProvider,
  type Sku,
} from "./Payments";
import { SaveData } from "./SaveData";
import { SocialSystem, type FriendChallenge } from "./SocialSystem";
import { SeasonPass, seasonId, seasonLabel, XP_RULES } from "./SeasonPass";
import { FlightCues } from "./FlightCues";
import { endlessSpeedScale } from "./FlightProgression";
import { buildChallengeUrl, readChallengeFromUrl, type RivalChallenge, buildRoomInviteUrl, normalizeRoomCode, readRoomInviteFromUrl } from "./DeepLinks";
import { flag } from "./Flags";
import { variant } from "./Experiments";
import { PORTAL_BANNER_ID, attachPortalErrorReporters, initPlatform, installPageScrollGuards, isCoarsePointer, isPortalBuild, portalTarget as getPortalTarget, type PlatformAdapter } from "../sdk/platform";
import { CUSTOM_PILOT_NAMES, POKI_MULTIPLAYER, SIMULATED_BREAKS, SQUAD_CHAT } from "./edition";
import { PRIVACY_URL } from "./legal";
import { GameplayEventSink } from "./GameplayEvents";
import { LivingBackground } from "./LivingBackground";
import { Sky } from "./Sky";
import { Telemetry } from "./Telemetry";
import { shopAction, type ShopActionContext } from "./actions/shop";
import { journeyAction, type JourneyActionContext } from "./actions/journey";
import { settingsAction, type SettingsActionContext } from "./actions/settings";
import { crashReporter } from "./resilience/CrashReporter";
import { Watchdog } from "./resilience/Watchdog";
import { TerrainSystem } from "./TerrainSystem";
import { Weather } from "./Weather";

// On Poki builds, warm the Netlib module in the background so the first PvP tap
// doesn't wait on the chunk. The import itself lives in the per-target
// transport module, so `@poki/netlib` stays out of every other bundle (Rollup
// DCE) while the Poki build still gets a warm module.
if (POKI_MULTIPLAYER) prewarmNetTransport();

export type GameState = UiState;
type AdReason = "continue" | "interstitial";

const _hslScratch = new THREE.Color();
function hsl(h: number, s: number, l: number): [number, number, number] {
  _hslScratch.setHSL(h, s, l);
  return [_hslScratch.r, _hslScratch.g, _hslScratch.b];
}

/** Seconds a ring chain stays open — one number for the rule and the meter. */
const RING_CHAIN_WINDOW = 2.8;

const ASLEEP: BirdStepOpts = { diving: false, fever: false, speedMult: 1, boost: false };

/* Mode surge strengths, in m/s of extra cap headroom. These used to be velocity
 * injections with `Math.min(234, …)` guards; see `BirdStepOpts.speedBonus`.
 *
 * `modeSpeedBonus` takes a max, never a sum, so the largest of these is the
 * most the cap can ever be raised by. `MAX_MODE_SPEED_BONUS` is what the
 * anti-cheat ceiling adds, and it lives in constants.ts precisely so this list
 * can be checked against it — a surge raised above it without the ceiling
 * following would put legitimate runs back over the gate, which is the exact
 * bug that put them there once already. */
const SLINGSHOT_BONUS = 16;
const TYPHOON_BONUS = 10;
const SLALOM_WARP_BONUS = 18;
const COIN_TURBO_BONUS = 6;
/** How fast a one-shot surge decays back to nothing, m/s per second. */
const MODE_BONUS_DECAY = 45;

/** Per-biome intro hint shown for ~9 s when the player first enters a world. */
const BIOME_INTRO_HINTS: Record<string, string> = {
  green:   "HOLD to dive · RELEASE to launch — master the rhythm",
  tropical:"RELEASE on thermals — let the updrafts carry you",
  reef:    "Hills drop fast here — release LATE for the biggest launch",
  sunset:  "Deep valleys ahead — dive to the bottom, release sharp",
  desert:  "Slow rises, sharp drops — dune shape is the key",
  night:   "Storm gusts push you — watch the wind and lean into slopes",
  aurora:  "Ice faces are steep — HOLD hard, RELEASE hard",
  volcano: "Jagged spikes — tiny timing windows, maximum rewards",
  canyon:  "Plateau then cliff — hold steady, explode off the lip",
  amethyst:"Floaty air — long faces, chain the spires into one glide",
  grove:   "Long golden glades — one glide can cross the whole grove",
};

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/** How a run ended. Every branch of `onDaylightOut` used to look
 *  identical to the player, and one of them fires with daylight to spare. */
/**
 * How fast the sky is allowed to catch up with the daylight clock, in seconds.
 * A step change in the clock's denominator becomes a glide over roughly this
 * long, which is long enough to read as the sun moving and short enough that a
 * boost still visibly helps before the run ends.
 */
const DAY_T_TAU = 0.45;

/**
 * The daylight level the main menu is lit at. A late, warm, high-sky look: far
 * enough from either end of the palette that the menu cannot be mistaken for
 * gameplay, and now that the palette has a rose stop on the way to gold, it
 * lands on a sunset rather than on the desaturated patch a straight blue-to-
 * cream blend used to put there.
 */
const MENU_DAY_T = 0.86;

export type RunEndReason = "daylight" | "water" | "settled";

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
  private readonly ads: AdProvider = new PlaceholderAdProvider();
  /** Runs started since load. */
  private sessionRuns = 0;
  private platform: PlatformAdapter | null = null;
  /** Detaches the window error → `captureError` reporters (see platform boot). */
  private detachPortalErrorReporters: (() => void) | null = null;
  /** Detacher for the host-page scroll guards (see installPageScrollGuards). */
  private detachPageScrollGuards: (() => void) | null = null;
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
  private readonly ghostPlayer = new GhostPlayer("circle");
  /** Network rival ghost (async PvP on the daily seed) — amber silhouette. */
  private readonly rivalGhostPlayer = new GhostPlayer("diamond");
  private rivalGhostName = "";
  private rivalGhostPassed = false;
  /** Run counter — guards async ghost loads against arriving mid-next-run. */
  private runEpoch = 0;
  /** The ghost-race friend challenge (SocialSystem) currently being flown, if any. */
  private activeFriendChallenge: FriendChallenge | null = null;
  private readonly livingBg = new LivingBackground();
  private terrain: TerrainSystem;
  private collect: Collectibles;
  private weather: Weather;
  private today = dateSeed();
  private seed: string;
  private seedMode: SeedMode = "today";
  /**
   * Daily Login Ritual banner: dismissed for the day once the player clicks
   * the primary "Fly now" CTA or closes it with X. Session-only by design
   * (never persisted) — it resets to false the moment `today` rolls over, in
   * `dayTick`, so the banner is back tomorrow even if it was dismissed today.
   */
  private dismissedDailyPrompt = false;

  private state: GameState = "menu";
  /**
   * The last world-x the floating origin was rebased to. 0 until the first
   * rebase, and the value `maybeRecenter` compares against so it only fires on
   * a threshold crossing, not every frame.
   */
  private renderOriginX = 0;
  /** Climb Breaker: 0..1, set when the run crosses a biome wall. See grantClimbBreaker. */
  private climbRelief = 0;
  /** Seconds of extra daylight the run has earned by clearing walls. */
  private climbDaylight = 0;
    /** Transient cap headroom from the active mode's surge mechanic, in m/s.
     * Decays every step and is applied through `BirdStepOpts.speedBonus`; see
     * `Bird` for why it is a cap raise and not a velocity injection. */
    private modeSpeedBonus = 0;
  /** Seconds of extra daylight bought by a store boost. */
  private boostDaylight = 0;
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
  /** The particle density this device is configured for — what the adaptive
   * ladder may climb back to, which is not always 1 (mobile defaults to 0.5,
   * "low" quality pins 0.3). */
  private particleCeiling = 1;
  /** Soft-shadow + particle state for the two-way adaptive policy. Mirrors
   * `renderer.shadowMap.enabled` and `particleBudget`; see `nextEffectBudget`. */
  private effectBudget: EffectBudget = { shadows: true, particles: 1, goodWindows: 0 };
  /** True when the WebGL context fell back to a software rasteriser: shadows
   * are never affordable there, so they must not be "restored" either. */
  private softwareMode = false;
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

  private daylight = DAYLIGHT_MAX;
  /** What the SKY is showing. Lags `daylight / daylightMax` by `DAY_T_TAU`. */
  private dayTSmooth = 1;
  /** Seconds the bird has sat settled (grounded/water, slow, no input). */
  private settleAcc = 0;
  /** Why the last run ended — see `onDaylightOut`. The only thing the player
   *  is told about their own death. */
  private endReason: RunEndReason = "daylight";
  /** runTime of the last dive input; passive braking keys off it. */
  private lastInputAt = 0;
  private startX = 64;
  private island = 0;
  private lastIsland = 0;
  private perfects = 0;
  private perfectChain = 0;
  /** Latched once FRENZY has fired this run, so a long chain cannot re-announce it. */
  private frenzySeen = false;
  private feverTimer = 0;
  private feverOn = false;
  private feverReached = false;
  private prevVy = 0;
  private bonus = 0;
  private scoreAccum = 0;
  private splashCd = 0;
  private thudCount = 0;
  private bounceCount = 0;
  /** One source of truth for clip-worthy beats, recap telemetry and first-laugh conversion. */
  private readonly moments = new MomentLedger();
  private readonly funnel = new Funnel();
  private funnelSummarySent = false;
  private momentLastAt: Partial<Record<MomentKind, number>> = {};
  /** Second throttle for musical reactions — see `fireMoment`. */
  private readonly momentMusicGate = new MusicMomentGate();
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
  /** In-flight guard for the shop rewarded break (see multiplyCoinsFromShopAd). */
  private shopAdBusy = false;
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
  /** In-flight portal rewarded-break guards: a second tap while the SDK
   * promise is pending must not open a second break (double grant). */
  private continueRewardBusy = false;
  private multiplierRewardBusy = false;
  private continueTimer = 0;
  private adTimer = 0;
  /**
   * Wall-clock spent in the "ad" state, and the state we were in before it.
   *
   * State "ad" is exit-blocked on purpose (see handleAction): a portal break is
   * ended by the platform's promise and by nothing else. That is correct for
   * unskippability, but it means a platform ad that never resolves would trap
   * the player permanently — every control is inert and there is no other way
   * out. This pair is the safety valve: after AD_SAFETY_SECONDS the break is
   * abandoned and the previous state restored, WITHOUT granting anything. The
   * player still cannot skip an ad; they simply cannot be imprisoned by one.
   */
  private adWallClock = 0;
  /** When a commercial break was last REQUESTED (not necessarily served).
   *  Gate for the run-start break; see `maybeBreakOnRunStart`. */
  private lastCommercialBreakAt = 0;
  /** Guards against two overlapping break requests. */
  private portalBreakPending = false;
  private preAdState: GameState | null = null;
  private adReason: AdReason = "interstitial";
  private skipInterstitialOnce = false;
  private runRecorded = false;
  private newlyCompleted: string[] = [];
  private claimedQuests: QuestReward[] = [];
  /**
   * The results card's progress surface, as run state. Empty until a run ends:
   * a flight in progress has moved nothing yet, and the shape is the one
   * `planCelebration([])` returns, so the HUD renders nothing rather than a
   * placeholder. Built once in `finishRun()` by `runProgressEvents` and read
   * only by the snapshot — it is never recomputed per frame.
   */
  private runProgress: ProgressEvent[] = [];
  /** The in-flight mission strip, and the previous frame's rows for the diff. */
  private missionRowViews: MissionRow[] = [];
  private previousMissionRows: MissionRow[] = [];
  /** The quests banked on the frame each one crossed — juice fires once. */
  private justBankedQuests: string[] = [];
  /**
   * The career rung this run is climbing, frozen at launch. `wingsProximity`
   * needs the gap as it was *before* the flight; the live `wingsCard` value
   * shrinks with every metre, so reading it mid-run would always yield zero
   * remaining and the bar could never appear. Null at max rank.
   */
  private wingsRungAtStart: { name: string; needed: number; span: number } | null = null;
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
  private finishRemaining = -1;
  private readonly board: Leaderboard;
  private readonly cups: Tournaments;
  private pilotName = "";
  /** True once the player picked a call sign (dice/save), which outranks the portal name. */
  private pilotNameChosen = false;
  /** Signed-in portal username, shown on the account screen. */
  private portalAccountName = "";
  private boardScope: BoardScope = "global";
  private boardMetric: BoardMetric = "distance";
  private boardPage: BoardPage | null = null;
  private boardLoading = false;
  /** When the last board fetch FAILED, and how long to wait before trying
   *  again. `boardLoading` only stops two fetches overlapping; without this a
   *  failing backend is re-asked on every trigger, and the measured cost on a
   *  session the platform could not authenticate was three rejected calls in
   *  five seconds — from the boot warm-up, the player opening the board, and
   *  the scope settling. A logged-out Poki visitor is a real, common case, and
   *  the right behaviour is to fall back to local scores quietly, not to keep
   *  knocking on a door that is not going to open. */
  private boardFailedAt = 0;
  private static readonly BOARD_RETRY_MS = 30_000;
  private lastPrize: PrizeGrant | null = null;
  private racePlace = 0;
  /** Outcome of the in-flight run for the portal funnel (`complete` only when the goal was reached). */
  private runOutcome: "complete" | "fail" = "fail";
  private raceField = 0;
  private raceFinishTime = 0;
  private net: AnyRealtimeClient | null = null;
  /** Single-flight transport creation (see ensureNet) — Poki's client is async. */
  private netPending: Promise<AnyRealtimeClient> | null = null;
  private roomCode = "";
  /** "Create a room" rather than "join room `roomCode`".
   *
   *  The Poki transport mints the code server-side (`create()` RETURNS it), so
   *  a host cannot know the code before asking. This flag is how "host a room"
   *  survives that: `roomCode` stays "" until the transport reports a real one,
   *  and `pumpNetwork` adopts it. Passing a locally-invented code instead is
   *  what made "Create Private Room" fail on every press — the transport read
   *  it as a join request for a room nobody had created. */
  private hostingLobby = false;
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
  /** Search phase. "searching" counts the window down. "waiting" means the
     *  window closed with pilots in the room — hold it open for ready-up.
     *  "expired" means it closed with nobody here: the search stays open and the
     *  pilot decides. In both post-window phases the pilot chooses what happens
     *  next; a search never falls into a race on its own. */
    private mmPhase: "searching" | "waiting" | "expired" = "searching";
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
  /** One-shot pre-cue for golden hour (see the daylight block in the run loop). */
  private goldenCued = false;
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
  private goalPopKind: "goal" | "quest" = "goal";
  private goalPopT = 0;
  private rankUp = "";
  private rankUpT = 0;
  private recordBanner = "";
  /** Previous personal-best distance, captured at run start (for the record loop). */
  private bestAtStart = 0;
  private distanceRecordCrossed = false;
  private newBest = false;
  /** Distance frozen at finishRun() — see the comment there. Read by pushHud()
   *  so the results screen can't drift away from the number that was scored. */
  private resultDistance = 0;
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
  private biomeHint = "";
  private biomeHintTimer = 0;
  private readonly onFocus: () => void;
  private readonly onBlur: () => void;
  private readonly onOrientationChange: () => void;
  private readonly onFullscreenChange: () => void;
  private readonly onKonami: (e: KeyboardEvent) => void;
  /** Blocks wheel-scroll over the canvas on portal builds (see constructor). */
  private readonly onCanvasWheel = (ev: Event): void => ev.preventDefault();

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
    // One line per boot naming the exact build. A player-reported bug that says
    // "it feels different" is only diagnosable against a version, and this is
    // the one place the id is guaranteed to exist. `console.debug` is the level
    // `verify:prod` permits in shipped client code.
    console.debug(buildStamp());
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
      //
      // Held as a field, not an inline arrow, for the same reason as the Konami
      // listener: an anonymous handler has no identity, so it can never be
      // removed, and it is the only listener in this class that was added
      // without a matching removeEventListener in dispose().
      canvas.addEventListener("wheel", this.onCanvasWheel, { passive: false });
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
    this.softwareMode = softwareMode;
    this.renderer.shadowMap.enabled = !softwareMode && this.deviceProfile.tier !== "lite";
    this.effectBudget = { shadows: this.renderer.shadowMap.enabled, particles: this.particleBudget, goodWindows: 0 };
    // PCFSoftShadowMap was removed in three r165+ — PCF with a slightly larger
    // shadow map is the soft look without the console warning every load.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.dpr = softwareMode ? 1 : this.preferredDpr();
    this.renderer.setPixelRatio(this.dpr);

    // A dev-only handle on the live renderer, so the next "what is actually
    // being drawn?" question is a two-minute console call instead of a build.
    // It exists because a render pass could not read `renderer.info` at all —
    // the app exposed no renderer reference — and the live `coinMesh.count` is
    // still an open question that only a real device can settle.
    // `import.meta.env.DEV` is replaced with `false` at build time, so the
    // whole block is dead code in a production bundle and the handle cannot
    // exist there.
    if (import.meta.env.DEV) {
      (window as Window & { __render?: THREE.WebGLRenderer }).__render = this.renderer;
    }

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
      this.hud.toast(t("hud.gpu.contextLost", undefined, "Graphics context lost — restoring…"));
      this.telemetry.track("webgl_context_lost", {});
      // If the GPU never comes back, say so instead of leaving a dead canvas.
      window.setTimeout(() => {
        if (this.contextLost && !this.disposed) {
          this.hud.toast(t("hud.gpu.unrecovered", undefined, "Graphics could not be restored — reload the page to keep flying"));
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
      this.hud.toast(t("hud.gpu.restored", undefined, "Graphics restored"));
      this.telemetry.track("webgl_context_restored", {});
    };
    canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);

    this.hud = new HUD(host);
    // "boot" is the one stage with no in-loop trigger: it is where the player
    // was when the game opened, and nothing in the loop "happens" at boot. It
    // was never marked, so `Funnel.path()` omitted it and `progress()` capped
    // at 7/8 — every completion percentage the report printed was low by the
    // same amount, and a player who did everything still read as stalled.
    // `mark()` dedupes, so calling it again later costs nothing.
    this.markFunnel("boot");
    this.input = new Input(host, () => {
      void this.audio.resume();
      this.markFunnel("first_input");
    });
    this.audio = new GameAudio();
    // A tasteful "now playing" cue when the score moves to a new track — only
    // when the game is at rest, so it never interrupts a run in flight.
    this.audio.setOnTrackChange((name) => {
      // A quiet "now playing" cue at rest and in flight — never while paused
      // or during an ad, when the game (and audio) is muted or on hold.
      if (this.state === "menu" || this.state === "playing") this.hud.toast(`${name}`, "info", "sparkle");
    });

    this.terrain = new TerrainSystem(this.seed, worldTierFor(this.deviceProfile.tier));
    this.scene.add(this.terrain.group);
    bootStage("world");

    this.bird = new Bird();
    this.bird.addTo(this.scene);
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

    this.collect = new Collectibles(this.terrain.seedN, undefined, worldTierFor(this.deviceProfile.tier));
    this.scene.add(this.collect.group);
    this.weather = new Weather(this.terrain.seedN);
    this.weather.addTo(this.scene);
    this.massRace.addTo(this.scene);
    this.finishGate.addTo(this.scene);

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
      this.hud.toast(`${rival.name} challenged you: beat ${rival.distance} m on their hills`, "quest", "swords");
      this.telemetry.track("rival_received", { distance: rival.distance, mode: this.modeId });
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
    // Held in a field, not an inline arrow, so dispose() can remove it: an
    // anonymous document listener keeps `this` reachable, and with it the whole
    // scene graph and every GPU buffer, for the life of the page.
    this.onKonami = (e: KeyboardEvent) => {
      // Nothing the player types may act during a live break — this listener is
      // on `document`, so unlike the Input class it is not silenced by
      // input.setEnabled(false).
      if (this.state === "ad") return;
      this.konamiBuffer.push(e.key);
      if (this.konamiBuffer.length > KONAMI.length) this.konamiBuffer.shift();
      if (this.konamiBuffer.join(",") === KONAMI.join(",")) {
        this.konamiBuffer = [];
        this.hud.toast(`Cheat mode activated — you found the secret!`, "gold", "star");
        this.save.addCoins(500);
        if (this.state === "playing") this.particles.emitConfetti(0, 0);
      }
    };
    document.addEventListener("keydown", this.onKonami);

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
        // Portal QA requirement (and basic courtesy): a hidden tab is silent.
        this.suspendForBackground();
      } else {
        this.hidden = false;
        this.resumeFromBackground();
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

    // Starter goals: the table that exists FOR a new save was never passed the
    // flag that selects it, so every first run was handed a mid-skill target
    // (1,339-1,565 m) it cannot reach inside a 52 s day. Opt in while the
    // player has no runs on record.
    this.goals.reset(this.today, { starter: this.save.state.runsPlayed <= 1 });
    // monthly VIP really lapses — surface it once per session
    this.vipActive = this.save.isVipActive();
    if (this.save.state.vip === false && this.save.state.vipUntil > 0) this.vipExpiredNotice = true;

    const yesterday = dateSeed(new Date(Date.now() - 86400000));
    // Challenge auto-tune reads "was yesterday's daily done" exactly once per
    // real day boundary — touchStreak() below already guards a same-day
    // re-boot via streak.claimedDate, so mirror that guard here rather than
    // double-counting a failure on every page refresh within the same day.
    if (this.save.state.streak.claimedDate !== this.today) {
      this.save.noteDailyChallengeRollover(this.save.isDailyDone(yesterday));
    }
    const streakReward = this.save.touchStreak(this.today, yesterday);
    const streakMilestone = this.save.justAchievedStreakMilestone();
    const vipGift = this.save.claimVipDaily(this.today);
    window.setTimeout(() => {
      if (this.disposed) return;
      if (this.save.recoveredFromCorruption) this.hud.toast("Save couldn't be read — kept a backup, starting fresh", "warn");
      if (streakReward > 0) this.hud.toast(`Day ${this.save.state.streak.days} streak · +${streakReward} coins`, "gold");
      if (streakMilestone) this.hud.toast(`${streakMilestone.days}-day streak · +${streakMilestone.coins} coins${streakMilestone.trail ? " + a new trail" : ""}!`, "gold", "fire");
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
    // Poki requirement: space/arrow keys and the wheel must not scroll the
    // host page while the game is embedded in it. Installed HERE rather than
    // in the initPlatform continuation below: the doc's guard is about the page,
    // not about the portal handshake, and from inside that continuation the
    // first seconds of a session — the menu a player is already pressing space
    // on — ran unguarded whenever the CDN was slow to answer.
    this.detachPageScrollGuards = installPageScrollGuards();
    // Portal SDK initialization is intentionally late: the first interactive
    // menu frame should never wait on a third-party CDN.
    void initPlatform({
      onAdOpened: () => this.beginPortalAd(),
      onAdClosed: () => this.endPortalAd(),
      onPortalMute: (muted) => this.audio.setPortalMuted(muted),
      onPause: () => {
        // Portal-side pause (in addition to visibilitychange): freeze the
        // same way a hidden tab does — paused state + silenced audio.
        this.suspendForBackground();
      },
      onResume: () => {
        this.resumeFromBackground();
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
      // Poki User Accounts: a signed-in player is shown under their Poki
      // username rather than a generated call sign — that is the name their
      // friends recognise and the name that belongs on the board. It is only
      // adopted when the player has not chosen a name of their own in this
      // save, and rolling the dice always wins over it (the dice handler
      // overwrites this later). `getUser()` is read-only, so this can never
      // pop an account prompt on load — the prompt is user-initiated only.
      void this.adoptPortalIdentity();
      // Localization: adopt the portal's language for the first paint, before
      // the player has chosen one themselves (guide: serve the player's own
      // language automatically rather than making them hunt for a setting).
      void adoptPortalLocale(adapter.getLanguage()).then((changed) => {
        if (changed && !this.disposed) this.bump();
      });
      // Keep the mobile Poki pill off the HUD: the daylight meter and the
      // mute/pause cluster own the top band.
      adapter.movePill(0, 56);
      adapter.loadingFinished();
      adapter.signalGameReady();
      // Late-landing sync: if the player is already mid-flight when the
      // SDK arrives, start fires once — the sink suppresses the repeat
      // on the next genuine transition and never replays a stale phase.
      if (this.state === "playing") this.gameplaySink.send("start");
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
        this.hud.toast(`Invited to room ${portalInvite}`, "quest", "bird");
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
    if (seasonEnd) this.hud.toast(`Ranked season over · ${seasonEnd.division} reward +${seasonEnd.coins} coins`, "gold", "swords");
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
    // First use: never put a screen between the visitor and the first
    // `gameplayStart()`. This used to branch on `CUSTOM_PILOT_NAMES` and send
    // the portal build to `nameEntry` — so the edition whose own comment
    // argued the gate "is one screen and one tap between the visitor and the
    // first gameplayStart(), and that first gameplay event is exactly what
    // Poki measures as conversion to play" was the one edition that showed it.
    // The flag meant the opposite of what its name said, and the audit is right
    // that the two comments on this path contradicted the shipped build.
    //
    // The generated call sign is accepted silently instead. Nothing is lost:
    // the board page still has rename and reroll, so a player who wants a name
    // picks one when they have an incentive to, and `pilotNameChosen` stays
    // false so a signed-in player is still adopted by `adoptPortalIdentity()`
    // when the portal identity resolves.
    if (!this.save.state.pilotNameCustomized && this.state === "menu") {
      this.save.state.pilotNameCustomized = true;
      this.save.persist();
    }
  }

  /**
   * Builds this edition's realtime client through the per-target transport
   * module (`./net-transport`, swapped on the Poki target for the Netlib P2P
   * client) and seats it. Async because the Poki client arrives via a dynamic
   * import, and single-flight: preseatLobby() and connectRace() can both run
   * before the import resolves, and two clients in one lobby is exactly the
   * bug this funnel prevents.
   */
  /** The one way a client is put into a room. Every caller used to inline
   *  `attachTransport` + `setIdentity` + `connect` with the same three
   *  arguments; they are identical by construction, and the mix-and-match
   *  hazard is a race that shows up as an empty lobby. */
  private announceToRoom(client: AnyRealtimeClient, seed: string, remote: boolean): void {
    this.massRace.attachTransport(client);
    client.setIdentity(this.racedName(), this.skin.id, 0.06);
    client.connect(this.roomCode, seed, remote, this.hostingLobby);
  }

  private ensureNet(seed: string, remote: boolean): void {
    this.netPending ??= createNetTransport(this.save.state.deviceId, this.pilotName, this.skin.id);
    void this.netPending
      .then((client) => {
        if (this.disposed) return;
        this.net = client;
        this.announceToRoom(client, seed, remote);
      })
      .catch(() => {
        // A transport that cannot be created leaves `this.net` null, which is
        // the same state as "multiplayer unavailable": MassRace keeps flying
        // the local squadron and the UI says so.
      });
  }

  /** Backgrounding, by either route. A hidden tab (visibilitychange) and a
   *  portal-side pause were two hand-written copies of the same three
   *  statements, so the two ways of getting muted could drift apart — and a
   *  drift here is a player who cannot unpause. */
  private suspendForBackground(): void {
    if (this.state === "playing") this.setState("paused");
    this.audio.setHiddenMuted(true);
    void this.audio.suspend();
  }

  /** The mirror of suspendForBackground, likewise shared by both routes. */
  private resumeFromBackground(): void {
    this.last = performance.now();
    this.acc = 0;
    this.audio.setHiddenMuted(false);
    void this.audio.resumeExisting();
  }

  dispose(): void {
    this.detachPageScrollGuards?.();
    this.detachPageScrollGuards = null;
    if (this.disposed) return;
    this.disposed = true;
    // Release the portal display-ad slot. The page never unmounts the banner
    // host and `destroyAd` is a real member of the shipped core, so without
    // this the only way to release it was a reload. No-op when nothing is up.
    try { this.platform?.destroyBanner?.(); } catch { /* best effort */ }
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
    document.removeEventListener("keydown", this.onKonami);
    this.renderer.domElement.removeEventListener("wheel", this.onCanvasWheel);
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
    // Both own GPU buffers that renderer.dispose() does not reach, because the
    // renderer only walks what it has actually drawn.
    this.livingBg.dispose();
    this.ghostPlayer.dispose();
    this.rivalGhostPlayer.dispose();
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
    // Floor the delta at zero as well as the ceiling. `this.last` is written
    // from performance.now() at several points that can run mid-frame, while
    // `now` is the rAF timestamp; one negative delta made the frame clock run
    // BACKWARDS, which printed a "4" in a three-second countdown.
    const raw = Math.max(0, Math.min(0.25, (now - this.last) / 1000));
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
      this.hud.toast(`Invited to room ${code} — ready up together to race`, "gold", "badge");
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

    // NOTE: the render-interpolation snapshot is NOT taken here. It used to be
    // — once per frame, before the whole physics batch — and that is what made
    // the bird judder. `lerp(prev, cur, acc / PHYS_DT)` is only a correct
    // interpolation of ONE physics step if `prev` is the position immediately
    // before the LAST step. Taken once per frame, `prev` is the position before
    // however many steps this frame ran, so the lerp was stretched across that
    // many steps while still being scaled by a single step's alpha. On a 60 Hz
    // display that is a fixed one-frame lag; on a 144 Hz display, where most
    // frames run ZERO steps, `prev` equals `cur`, the lerp is a no-op, and the
    // bird stands still on those frames and then jumps a whole step on the ones
    // that did step — a visible stutter at exactly the frame rates the
    // interpolation was added to fix. The snapshot now lives inside each
    // accumulator loop, so it is always exactly one PHYS_DT behind.

    switch (this.state) {
      case "menu":
        this.menuTick(raw);
        break;
      case "playing":
        if (this.countdown > 0) {
          const before = Math.ceil(this.countdown - 1);
          this.countdown = this.networkStartAt > 0 ? Math.max(0, (this.networkStartAt - Date.now()) / 1000) : Math.max(0, this.countdown - raw);
          const after = Math.ceil(this.countdown - 1);
          // The countdown used a bird chirp for its ticks, which reads as
          // ambience rather than a cue, while the purpose-built countdownBeep
          // (a 440Hz tick, and a bright two-tone GO on the last one) sat
          // unused. The launch is the one moment a player must react on time,
          // so it gets the deliberate cue — the final tick is the GO.
          if (after !== before) this.audio.countdownBeep(after <= 0);
          if (this.countdown <= 0) this.audio.island();
          break;
        }
        this.acc += simDt;
        // Bounded catch-up. `acc` was drained without a ceiling, so one slow
        // frame asked for a dozen steps, each of which cost the time that made
        // the next frame slower — the convoy spiral. The Poki portal target is
        // a mid-range phone on a CPU-bound renderer, which is exactly where
        // that shows. The backlog is now SERVED to a bound and the stale tail
        // DROPPED: past the bound the world runs momentarily slow rather than
        // the page locking up, which is the only honest trade — time the player
        // spent is theirs, and silently teleporting the bird through a hill to
        // "catch up" would be far worse than a beat of slow motion.
        let steps = 0;
        while (this.acc >= PHYS_DT && this.state === "playing" && steps < MAX_CATCHUP_STEPS) {
          // One PHYS_DT of render history, taken per STEP. See the note above
          // the switch: a once-per-frame snapshot stretches the render lerp
          // across every step the frame ran, which judders on any display
          // faster than the physics rate.
          this.prevBirdX = this.bird.x;
          this.prevBirdY = this.bird.y;
          if (this.versus) this.versusTick(PHYS_DT);
          else this.fixedUpdate(PHYS_DT);
          this.acc -= PHYS_DT;
          steps += 1;
        }
        if (this.acc > PHYS_DT * MAX_CATCHUP_STEPS) {
          this.telemetry.track("sim_backlog_dropped", { seconds: this.acc });
          this.acc = 0;
        }
        break;
      case "continue":
        this.acc += raw;
        // Bounded, like the playing loop. This one was bare, so on the 250 ms
        // frame the dt clamp explicitly allows for a slow phone it ran ~30
        // physics steps in a single frame — the exact backlog spiral the
        // playing path is hardened against, on the frame budget where weak
        // devices can least afford it.
        {
          let steps = 0;
          while (this.acc >= PHYS_DT && steps < MAX_CATCHUP_STEPS) {
            this.prevBirdX = this.bird.x;
            this.prevBirdY = this.bird.y;
            this.bird.step(PHYS_DT, ASLEEP, this.terrain);
            this.acc -= PHYS_DT;
            steps += 1;
          }
          if (this.acc > PHYS_DT * MAX_CATCHUP_STEPS) {
            this.telemetry.track("sim_backlog_dropped", { seconds: this.acc });
            this.acc = 0;
          }
        }
        this.continueTimer -= raw;
        if (this.continueTimer <= 0) this.finishRun();
        break;
      case "ad":
        this.adTimer -= raw;
        // A placeholder break now COMPLETES ITSELF the instant its countdown
        // lands. It never did: the only exit was the player pressing
        // `ad-skip`, which made skipping the intended way out of every break
        // on a non-portal build — the exact opposite of the contract the rest
        // of adGate.ts enforces. The break plays in full and then ends, with
        // no control to press and nothing to skip.
        if (!this.portalEnabled() && this.adTimer <= 0) {
          this.endAd();
          break;
        }
        // Safety valve: the ad state is exit-blocked by design, so a platform
        // ad whose promise never settles must not be allowed to trap the game.
        // Generous on purpose — every real break resolves long before this, so
        // a player-initiated skip is still impossible and this only fires when
        // the SDK has genuinely failed. The previous state is restored and
        // nothing is granted.
        this.adWallClock += raw;
        if (this.adWallClock > AD_SAFETY_SECONDS) {
          this.telemetry.track("ad_abandoned", { reason: this.adReason, portal: this.platform?.name ?? "none" });
          this.endPortalAd();
          const restore = this.preAdState ?? "gameover";
          // An interstitial fires from inside finishRun (previous state
          // "playing", bird asleep, run recorded): restoring "playing" would
          // strand a sleeping bird with no run and no offer. Pause breaks
          // restore "paused" untouched.
          const safe = restore === "playing" ? "gameover" : restore;
          this.setState(safe === "ad" ? "gameover" : safe);
        }
        break;
      case "gameover":
        this.acc += raw;
        // Bounded, like `playing` and `continue`. This one was the last bare
        // loop: the dt clamp allows a 250 ms frame, and at PHYS_HZ 120 that is
        // ~30 physics steps fired in the frame the results card appears — on
        // exactly the device the clamp exists for, and at the one moment the
        // player is reading their score. The bird is asleep here, so dropping
        // the stale tail costs a sleeping bird's slide and nothing else.
        {
          let steps = 0;
          while (this.acc >= PHYS_DT && steps < MAX_CATCHUP_STEPS) {
            this.prevBirdX = this.bird.x;
            this.prevBirdY = this.bird.y;
            this.bird.step(PHYS_DT, ASLEEP, this.terrain);
            this.acc -= PHYS_DT;
            steps += 1;
          }
          if (this.acc > PHYS_DT * MAX_CATCHUP_STEPS) {
            this.telemetry.track("sim_backlog_dropped", { seconds: this.acc });
            this.acc = 0;
          }
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
      if (this.goalPopT === 0) this.bump();
    }
    if (this.rankUpT > 0) {
      this.rankUpT = Math.max(0, this.rankUpT - raw);
      if (this.rankUpT === 0) this.rankUp = "";
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
        if (this.state === "gameover") this.replayRun();
        else this.startRun();
      }
    } else {
      if (this.menuHold > 0 && !this.needRelease) {
        if (this.state === "gameover") this.replayRun();
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
    // The release edge — the other half of the same gesture.
    //
    // The press fired a cue and the release fired nothing, so a pull-out was
    // silent. That is the whole of "the release is broken" from the player's
    // side: the brake was doing its job, but the one moment the game is asking
    // you to feel most directly — you committed, the dive stopped, the bird
    // came back up — had no sound, no touch, and nothing on screen confirming
    // it. A gesture you can only verify by looking away from the bird and
    // reading the speed number reads as dropped input.
    //
    // The feedback is fired AFTER `bird.step()` below, because `flareAmount`
    // is written there: it is the brake acceleration actually applied on this
    // tick, which is the honest measure of how hard the pull-out bit. Scaling
    // off the dive speed instead would fire at full volume on a release from
    // a near-hover, where nothing actually happened.
    const released = !diving && this.wasDiving && !this.bird.grounded && this.state === "playing";
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
    if (!this.fairRace && this.save.hasUpgrade("doubletap") && this.save.state.settings.doubleTapBoost && this.bird.grounded && this.bird.speed() < STALL_SPEED && this.manualBoostCooldown <= 0 && this.runTime > 1.2) {
      this.activateManualBoost("stall_rescue");
    }

    // Decay the mode surge before the step that spends it. A surge is a burst,
        // not a mode: without this, a slingshot landing in a typhoon would hold its
        // headroom until the next one fired.
        this.modeSpeedBonus = Math.max(0, this.modeSpeedBonus - MODE_BONUS_DECAY * dt);
    
        this.bird.step(
          dt,
          {
            diving,
            fever: this.feverOn,
            speedMult: skin.speedMult * this.challengeMods.speedMult * this.escalateMult(),
            speedBonus: this.modeSpeedBonus,
        boost: this.boostTimer > 0 || this.powers.boostOn(),
        liftMult: this.powers.liftMult() * this.masteryPerk.liftMult,
        // Slipstream: tucking behind a rival genuinely reduces your drag.
        dragMult: this.powers.dragMult() * this.massRace.draftFor(this.bird.x, this.bird.y, dt),
        feather: this.powers.featherOn(),
        gravityMult: this.eventRun ? this.weeklyMods.gravityMult : 1,
      },
      this.terrain,
    );

    // Read after the step: `flareAmount` now holds the brake this tick applied.
    if (released) this.releaseFeedback();


    this.stepLaunchAndGhosts(dt, diving);
    this.stepWeather(dt, diving);
    this.stepRivalField(dt);
    this.stepTerrainAndFeel(dt, diving);
    this.stepSurprisesAndIslands(dt);
    this.stepCollectAndPickups(dt);
    this.stepScoreAndFinish(dt);
    this.stepSettleAndGoals(dt, diving);
  }

  /**
   * The release half of `diveCue()`.
   *
   * Scoped to audio + haptic on purpose. The obvious third channel — a
   * `popupAtBird("SOAR!")` — is the wrong call here: perfect launches already
   * fire a banner, a rating, a burst, a shake, a freeze and a slow-motion beat
   * every 5-10 seconds, and releases happen far more often than that. Adding
   * text to the most frequent event in the game is how the HUD ends up with
   * four things to read at once.
   *
   * Returns early when `flareAmount` is 0, which is the case where the brake
   * genuinely did not engage — releasing from a climb, per the `vy >= 0` rule
   * in `Bird.step()`. Silence there is correct: nothing was arrested, so
   * there is nothing to confirm.
   */
  private releaseFeedback(): void {
    const strength = Math.max(this.bird.flareAmount / FLARE_BRAKE, this.bird.releaseKickAmount / RELEASE_KICK);
    if (strength <= 0) return;
    // Two signals, because the release is two things and they never overlap: a
    // dive is met by the sustained BRAKE (`flareAmount`, m/s^2, bounded by
    // FLARE_BRAKE) and everything else by the one-shot KICK
    // (`releaseKickAmount`, m/s, bounded by RELEASE_KICK). Each is normalised
    // against its own bound so a 22 m/s pop is a full-volume cue rather than
    // 7% of one. Reading only `flareAmount` left the ramp release — the bug
    // this fixes — completely silent, which is a large part of why it read as
    // "the release doesn't work" rather than as "the release is quiet".
    const intensity = Math.min(1, strength);
    this.audio.soarCue(intensity);
    this.haptic(6 + Math.round(10 * intensity));
  }

  /** Flight cues, the launch/landing reactions, the first-flight coach and
   *  the two ghost players. */
  private stepLaunchAndGhosts (dt: number, diving: boolean) {
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
        islandIndex: this.island,
      });
      if (this.coach.done) {
        this.save.state.firstFlightDone = true;
        this.save.addCoins(50);
        this.save.persist();
        this.hud.toast(`First flight complete · +50 coins — the sky is yours`, "gold", "bird");
        this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
      }
    }
    if (this.bird.justLanded) this.onLanding();

    this.ghostRecorder.sample(dt, this.runTime, this.bird.x, this.bird.y, this.bird.rotation);
    if (this.rivalGhostPlayer.active) {
      const rx = this.rivalGhostPlayer.update(this.runTime, dt);
      if (rx !== null && !this.rivalGhostPassed && this.bird.x > rx + 0.5 && this.runTime > 4) {
        this.rivalGhostPassed = true;
        this.hud.toast(`Passed ${this.rivalGhostName}'s flight!`, "gold", "ghost");
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
          const newTrophies = this.achievements.checkNew();
          for (const t of newTrophies) this.hud.toast(`Trophy: ${t.title}`, "gold");
          if (newTrophies.length > 0) this.audio.trophy();
          this.hud.toast(`Passed your ghost!`, "quest", "ghost");
          this.audio.ding();
          this.bonus += 30;
          this.awardXp(XP_RULES.ghostBeat);
          this.bump();
        }
      }
    }
  }

  /** Biome weather for this step: thermals, gusts, ash storms. */
  private stepWeather (dt: number, diving: boolean) {
    // biome weather: thermals, headwinds, ash storms
    this.weather.update(dt, this.elapsed, this.bird, this.terrain, diving, {
      onThermalEnter: () => {
        this.audio.thermal();
        // Once per run: after the first call-out the ♨ HUD chip carries the
        // message — toasting every thermal doubled the same text on screen.
        if (!this.thermalToasted && this.hintTimer < 40) {
          this.thermalToasted = true;
          this.hud.toast("Thermal — release to ride it", "power");
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
  }

  /** The rival field's fixed step. Same contract as the player's, and the
   *  single largest block in the tick — it was previously buried in the
   *  middle of fixedUpdate where nothing about it was visible from the
   *  call site. */
  private stepRivalField (dt: number) {
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
            this.popupAtBird(`SLINGSHOT! ${iconGlyph("rocket")}`, "perfect");
            this.modeSpeedBonus = Math.max(this.modeSpeedBonus, SLINGSHOT_BONUS);
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
        this.modeSpeedBonus = Math.max(this.modeSpeedBonus, TYPHOON_BONUS);
      }

      // Sky Slalom launch surge
      if (this.modeId === "pvp_slalom" && this.bird.justLaunched && this.lastLaunch?.rating === "perfect") {
        this.modeSpeedBonus = Math.max(this.modeSpeedBonus, SLALOM_WARP_BONUS);
        this.popupAtBird(`WARP SLALOM! ${iconGlyph("lightning")}`, "fever");
        this.particles.emitWind(this.bird.x, this.bird.y, 1.4);
      }

      // Stratosphere ascent thermal super-lift. The cap was hardcoded to 180 —
      // 1.5x the bird's own top speed — which turned a thermal column into a
      // launch to orbit (see ALT_CEILING). ZENITH_THERMAL_VY keeps the mode's
      // rocketship feel inside the envelope the world is framed for.
      if (this.modeId === "pvp_zenith" && this.weather.inThermal) {
        this.bird.vy = Math.min(ZENITH_THERMAL_VY, this.bird.vy + dt * 25);
      }

      // Knockout mode elimination evaluation
      if (this.modeId === "pvp_knockout" && !this.bird.asleep) {
        const dist = this.bird.x - this.startX;
        if (this.nextKnockoutDist <= 3500) {
          if (dist >= this.nextKnockoutDist - 60 && dist < this.nextKnockoutDist - 15) {
            if (!this.knockoutWarned) {
              this.knockoutWarned = true;
              this.hud.toast(`ELIMINATION IN ${Math.round(this.nextKnockoutDist - dist)}m — OUTFLY THE PACK!`, "warn");
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
              this.hud.toast(`ELIMINATED at ${targetDist}m!`, "warn", "fire");
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
                this.hud.toast(`ROYALE VICTORY! SOLE SURVIVOR!`, "gold", "crown");
                this.audio.fanfare();
                this.finishRun();
              } else {
                this.hud.toast(`ELIMINATED: ${victim.name}! ${remaining} remain`, "gold", "fire");
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
          this.hud.toast(place === 1 ? `LEAD! Hold it!` : `P${this.lastPlace} → P${place}!`, "gold", place === 1 ? "crown" : "flock");
          if (place === 1) {
            this.flash("perfect");
            this.popupAtBird(`${iconGlyph("crown")} P1 LEAD!`, "fever");
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
  }

  /** What the terrain does to you: biome entry, water and the shield,
   *  landing score, dust, the ridge skim bonus, the fever ramp, power
   *  particles and the ocean splash. */
  private stepTerrainAndFeel (dt: number, diving: boolean) {
    const biomeNow = this.terrain.biomeAt(this.bird.x);
    if (biomeNow.id !== this.lastBiomeId) {
      this.lastBiomeId = biomeNow.id;
      const isNew = this.save.markBiomeSeen(biomeNow.id);
      if (isNew) {
        // Charting bonus: the first arrival in a world pays coins that scale
        // with depth (see Biomes.chartingBonus). runCoins is the run tally
        // paid once by recordRun() — same path as surprise coins, so the
        // recap total and the wallet can never disagree with the toast.
        const bonus = chartingBonus(biomeNow.id);
        this.runCoins += bonus;
        this.hud.toast(t("hud.toast.biomeCharted", { name: biomeNow.name, bonus: String(bonus) }, `New shores charted: ${biomeNow.name} · +${bonus}\u25cf`), "gold");
        this.telemetry.track("biome_charted", { biome: biomeNow.id, bonus });
      }
      // Set a short gameplay hint so the player knows what's different here.
      this.biomeHint = BIOME_INTRO_HINTS[biomeNow.id] ?? "";
      this.biomeHintTimer = this.biomeHint ? 9 : 0;
    }
    if (this.biomeHintTimer > 0) this.biomeHintTimer -= dt;

    if (this.bird.inWater && this.shield > 0) {
      this.shield -= 1;
      // Clamp rather than assign. The bird sinks to roughly OCEAN_FLOOR + 2, so
      // `y = WATER_Y + 1.2` was a hard teleport up through the water in one
      // physics step: a one-frame position jump plus a camera lurch, on the
      // frame the splash particles are still being drawn from the old spot.
      // A max() still guarantees the bird is out of the water; it just does not
      // invent a jump when the bird was barely under.
      this.bird.y = Math.max(this.bird.y, WATER_Y + 1.2);
      this.bird.vy = 30;
      this.bird.vx = Math.max(this.bird.vx, 34);
      this.bird.inWater = false;
      this.bird.grounded = false;
      this.particles.emitWaterBounce(this.bird.x, WATER_Y);
      this.audio.shield();
      // The popup below shouts "BOING!" — it needs to be voiced. This bounce
      // played only the shield chime, so the loudest word on screen had no
      // sound behind it.
      this.audio.boing();
      this.hud.toast("Shield bounce!", "power");
      this.fireMoment("boing", { shout: this.bopWord(), always: true });
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
          this.fireMoment("bonk", { shout: "BONK!" });
        } else {
          this.particles.emitDust(this.bird.x, this.bird.y, this.bird.speed(), slope);
        }
      } else if (this.bird.landingQuality < LAND_PERFECT && this.bird.impact < 2.4 && this.bird.speed() > 36 && diving && slope < -0.05) {
        // tangential touchdown at speed on a downslope: reward the finesse
        this.bonus += 10;
        this.audio.butter();
        this.hud.toast("Butter landing +10", "cloud");
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
    const skimming =
      !this.bird.grounded &&
      !this.bird.inWater &&
      this.bird.altitude > 0.4 &&
      this.bird.altitude < 3.2 &&
      this.bird.speed() > 40;
    if (skimming) {
      this.skimTime += dt;
      if (this.skimTime > 1.1 && this.skimCd <= 0) {
        this.skimCd = 1.4;
        const pts = 15;
        this.bonus += pts;
        this.awardXp(XP_RULES.coin);
        this.audio.ridgeSkim();
        this.fireMoment("phew", { popup: false });
        this.popupAtBird("RIDGE SKIM! +15", "power");
        this.hud.toast(`Ridge skim +${pts}`, "cloud");
        this.particles.emitDust(this.bird.x, this.terrain.heightAt(this.bird.x) + 0.4, this.bird.speed(), slope);
      }
    } else if (this.bird.altitude > 6 || this.bird.grounded) {
      this.skimTime = 0;
    }
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
      this.splashCd = DAYLIGHT_SPLASH_INTERVAL;
      this.particles.emitSplash(this.bird.x, WATER_Y);
      this.audio.splash();
      this.fireMoment("splash", { popup: false });
      this.shake(0.45);
      this.daylight = Math.max(0, this.daylight - DAYLIGHT_OCEAN_PENALTY);
      this.splashQuipN += 1;
      if (this.splashQuipN % 3 === 1) this.hud.quip(quip(SPLASH_QUIPS, this.splashQuipN), "cloud");
    }
  }

  /** Seeded rare delights, then island crossings. */
  private stepSurprisesAndIslands (dt: number) {

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
      this.hud.toast(surprise.toast, "gold", SURPRISE_ICON[surprise.kind] ?? "sparkle");
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
              // `runCoins` is the run's tally and is paid ONCE, by recordRun() at
              // finishRun(). Calling addCoins() here as well paid the same coins a
              // second time — the player watched the wallet jump mid-flight and then
              // watched the results card pay the identical amount again. Every other
              // in-flight coin gain (coin sprites, ridge-skim tips, cloud pips) only
              // touches `runCoins`, so this was the lone outlier double-crediting
              // the surprise payout. Pinned by `run-coins-single-payout.test.ts`.
              this.runCoins += surprise.coins;
            }
      this.telemetry.track("surprise", { kind: surprise.kind });
    }

    const idx = this.terrain.islandIndex(this.bird.x);
    if (idx > this.lastIsland) {
      // `island` is a label for where the bird is, so it always advances.
      // `lastIsland` is the "already paid out" marker, and it must NOT —
      // see the airborne gate below. Marking the island consumed on the same
      // frame the bird entered it forfeited the daylight for good whenever the
      // boundary was crossed in the water or above the refill ceiling: the run
      // went on, the toast still said you had reached the island, and the sun
      // never came back. Coming back did not help either, because crossing
      // westbound makes `idx` smaller and `idx > lastIsland` false.
      this.island = idx;
      // The refill has to be EARNED BY FLYING THE ISLAND, not banked by
      // overflying it. The old gate was "above the waterline", which a player
      // cruising at 200 m clears every time — so altitude turned every island
      // into a free +15 s, the clock stopped being a clock, and a careful low
      // run was quietly worse than a careless high one. Crossing high also
      // means skipping the ramp, so it was already leaving coins and launch
      // quality on the table; now it costs daylight too.
      //
      // The band is generous on purpose: you have to actually be flying the
      // hills, and a legitimate high glide still counts, but the stratosphere
      // does not.
      const overhead = this.bird.y < WATER_Y + 2 + ISLAND_REFILL_CEILING;
      const airborne = overhead && !this.bird.inWater;
      const b = biomeForIsland(idx);
      // The whole decision — did this island pay out, how much, and is it now
      // spent — is one pure call, so it can be asserted without flying 1,900 m
      // in a browser. See hud/islandRefill.ts for the two bugs it encodes.
      const entry = islandEntry({
        idx,
        lastIsland: this.lastIsland,
        airborne,
        daylight: this.daylight,
        daylightMax: this.daylightMax(),
        climbRelief: this.climbRelief,
      });
      this.lastIsland = entry.consumed ? idx : this.lastIsland;
      this.daylight = entry.daylight;
      if (entry.consumed) {
        this.grantClimbBreaker(idx);
        this.particles.emitConfetti(this.bird.x, this.bird.y + 4);
        this.audio.island();
        this.audio.duckMusic(0.5, 0.6);
        this.hud.toast(`${b.name}`, "island", b.emoji);
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
  }

  /**
   * Hand the player a hand over a wall, when the island they just entered is
   * one (see `biomeClimb` — two of the nine biomes are).
   *
   * A wall is a bad moment to find out that the game has decided to be cruel,
   * and a bad moment to also be watching a clock. So crossing one raises the
   * rest of the run's daylight cap, warding the weather that arrived with it,
   * and paying out immediately. The reward is bigger the steeper the wall, and
   * it is granted ONCE per island, so re-crossing it cannot farm sun.
   */
  private grantClimbBreaker(island: number): void {
    const climb = biomeClimb(island);
    if (!climb.large) return;
    this.climbRelief = climb.relief;
    const bonus = Math.round(CLIMB_DAYLIGHT_BONUS * climb.relief);
    // The cap rises FIRST, so the grant below is not clipped by the cap the
    // relief just raised — the ordering here is the whole mechanism.
    this.climbDaylight += bonus;
    this.daylight = Math.min(this.daylightMax(), this.daylight + bonus);
    // Neutralises gusts and ash storms for as long as the relief lasts. `ward`
    // is already a first-class, tested flag in Weather; this is the cheapest
    // real compensation the game has, and it costs the world nothing.
    this.weather.ward = true;
    this.hud.toast(`Climb Breaker — ${bonus}s sun and the weather is on your side`, "power", "shield");
    this.audio.fanfare();
    this.glow(1);
  }

  /** Pickup collection and what each pickup awards. */
  private stepCollectAndPickups (dt: number) {
    const magnetOn = this.feverOn || this.magnetTimer > 0 || this.gameplaySkin.magnetAlways || this.powers.magnetOn();
    this.collect.update(dt, this.bird, this.terrain, magnetOn, this.elapsed, this.powers.magnetScale(), {
      onCoin: (x, y, gem) => {
        const base = gem ? 5 : 1;
        // Coin-stacking softcap: gold(2x), coinrush(2x), goldenHour(2x) and a
        // stormfront finale(2x) can all land on the same pickup alongside
        // powers/challenge/mastery/weekly multipliers — unclamped, a lucky
        // stack compounds past 16x and trivializes the coin economy. Clamp
        // the combined multiplier (not `base`, so gems still count 5x within
        // the cap) to keep stacked buffs generous but bounded.
        let multiplier =
          (this.save.state.gold ? 2 : 1) *
          this.powers.coinMult() *
          (this.mode.id === "coinrush" ? 2 : 1) *
          this.challengeMods.coinMult *
          this.masteryPerk.coinMult *
          (this.eventRun ? this.weeklyMods.coinMult : 1) *
          (this.goldenHour ? 2 : 1) *
          (this.stormfront && this.stormPhase >= 3 ? 2 : 1);
        multiplier = Math.min(multiplier, 8);
        const value = Math.round(base * multiplier);
        this.runCoins += value;
        this.markFunnel("first_reward");
        this.bonus += 4 * COIN_VALUE * value;
        if (this.modeId === "pvp_coinrush") {
          this.modeSpeedBonus = Math.max(this.modeSpeedBonus, COIN_TURBO_BONUS);
          this.popupAtBird(`COIN TURBO! ${iconGlyph("lightning")}`, "splash");
        }
        this.awardXp(XP_RULES.coin);
        this.audio.ding(gem);
        this.particles.emitCollect(x, y);
        if (gem) {
          this.runGems += 1;
          this.particles.burstRing(x, y, 0x9ae8ff);
          this.particles.emitSonicBoom(x, y);
          this.glow(0.8);
          // ONE toast, not two. The flight cap is a single pill, so two calls on
          // the same tick meant the second evicted the first within the same
          // frame — the "Sky gem +5" readout was created and destroyed before
          // it could ever be drawn. Merged so the number and the joke arrive
          // together, and the joke now gets the full read window.
          this.hud.toast(`Sky gem +${value}`, "gold", "gem");
          // The joke rides the quip lane rather than being welded onto the score
          // with a "·". On the old single-pill toast that put "Sky gem +12" and
          // a six-word sentence in one narrow pill competing for the same slot.
          if (this.runGems % 2 === 1) this.hud.quip(quip(GEM_QUIPS, this.runGems), "gold");
        }
        this.haptic(8);
      },
      onCloud: (kind, x, y) => this.onCloud(kind, x, y),
      onPickup: (kind, x, y) => this.onPickup(kind, x, y),
      onRing: (x, y) => this.onRing(x, y),
      onBalloon: (x, y) => this.onBalloon(x, y),
    });
  }

  /** Ring chain, fever, score accumulation, distance milestones, the
   *  personal-best crossing, the stormfront, and the two ways a race ends:
   *  the finish line and the clock. Kept as ONE method because the finish
   *  check reads the runDist the milestone code above it computed. */
  private stepScoreAndFinish (dt: number) {
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
        this.hud.toast("NEW ALTITUDE RECORD", "gold");
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
        this.hud.quip(quip(MILESTONE_QUIPS, this.nextMilestone), "cloud");
        this.glow(0.25);
      }
    }
    // Personal-best crossing: the single most addictive moment in the loop.
    // Fire it once, mid-run, the instant you pass your old distance record —
    // "beat your high score" is a feeling, not a post-run footnote.
    if (!this.distanceRecordCrossed && this.bestAtStart > 0 && runDist > this.bestAtStart) {
      this.distanceRecordCrossed = true;
      this.audio.fanfare();
      this.hud.toast(`NEW DISTANCE RECORD — keep flying!`, "gold", "crown");
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
        this.hud.toast("PHASE II — the storm tightens. Wind +25%", "warn", "storm");
      } else if (this.stormPhase === 2 && runDist >= 2200) {
        this.stormPhase = 3;
        this.weather.windMult *= 1.25;
        this.audio.storm();
        this.shake(0.8);
        this.camera.punch(2);
        this.hud.toast(`EYE WALL — survive to the line. Coins ×2 from here`, "warn", "spiral");
      }
    }
    // The moment you pass a rival's posted mark, gloat immediately — don't
    // make the player wait for the results screen to feel it.
    if (this.rival && !this.rivalBeatenToast && this.seed === this.rival.seed && runDist >= this.rival.distance) {
      this.rivalBeatenToast = true;
      this.audio.rivalDown();
      this.hud.toast(`Passed ${this.rival.name}'s mark — keep flying!`, "gold", "swords");
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
          this.popupAtBird(s.place === 1 ? `${iconGlyph("crown")} VICTORY!` : s.place === 2 ? `${iconGlyph("trophy")} 2ND PLACE!` : `${iconGlyph("trophy")} 3RD PLACE!`, "fever");
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
            won ? `${iconGlyph("swords")} Duel won! +${res.delta} rating` : `${iconGlyph("swords")} Duel lost · ${res.delta} rating`,
            won ? "gold" : "warn",
          );
          if (won && res.streak > 0 && res.streak % 5 === 0) this.hud.toast(`${res.streak} duel wins in a row!`, "gold", "fire");
          // Duel prize skin: 10 lifetime duel wins earns the Hummingbird.
          if (this.save.state.duel.wins >= 10 && !this.save.state.ownedSkins.includes("hummingbird")) {
            this.save.ownSkin("hummingbird");
            this.hud.toast(`Jewel Hummingbird unlocked — 10 duel wins!`, "gold", "bird");
          }
          if (won && this.save.ownTrail("trail_duelist")) this.hud.toast("Duelist trail unlocked!", "gold", "sparkle");
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
      this.daylight -= dt;
      // GOLDEN HOUR — the last 22% of the day. The world turns amber, the
      // music opens, and every coin is worth double. Deep runs get a reason.
      const goldenNow = this.daylight > 0 && this.daylight < this.daylightMax() * 0.22;
      // ANTICIPATION CUE — a soft heads-up while there is still daylight to
      // spend: "golden hour soon" tells the player the run has a late-game
      // payoff worth flying to, which is exactly the stretch where new
      // players quit (the 2026-10-04 fit test lost most runs mid-flight).
      // Once per run, one line, no siren: the payoff itself still lands as
      // the surprise when the hour arrives.
      if (
        !this.goldenCued && !this.goldenHour && this.daylight > 0 &&
        this.daylight < this.daylightMax() * 0.35 && this.daylight >= this.daylightMax() * 0.22
      ) {
        this.goldenCued = true;
        this.hud.toast("Golden hour soon — coins ×2 while the sun sets", "info", "half_day", { mustShow: true });
      }
      if (goldenNow && !this.goldenHour) {
        this.goldenHour = true;
        this.audio.goldenHour();
        this.hud.toast(`GOLDEN HOUR — coins are worth double`, "gold", "half_day", { mustShow: true });
        this.flash("fever");
        this.glow(0.8);
      } else if (!goldenNow && this.goldenHour) {
        this.goldenHour = false; // sun flask refilled the day
      }
      if (this.daylight <= 0 && !this.bird.asleep) {
        this.onDaylightOut("daylight");
        return;
      }
    }
  }

  /** The settle rule for an untouched bird, the live session goals, and the
   *  coach hint recomputed at the end of the step. */
  private stepSettleAndGoals (dt: number, diving: boolean) {

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
      this.onDaylightOut(this.bird.inWater ? "water" : "settled");
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
    for (const g of done) {
      this.save.addCoins(g.reward);
      this.audio.ding();
      this.goalPop = `${g.label} ✓  +${g.reward}`;
      this.goalPopKind = "quest";
      this.goalPopT = 2.6;
      this.hud.toast(`Goal complete +${g.reward}`, "quest");
      this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
      this.bump();
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
      this.hud.toast(`SLOPE FLOW ×${linked.chain} +${linked.points}`, linked.chain >= 3 ? "gold" : "cloud");
    }
    if (res.rating === "none") {
      if (this.bird.launchSpeed > 18) this.audio.chirp();
      return;
    }

    const combo = this.launch.combo;
    this.launchBannerText = ratingLabel(res.rating, combo);
    this.launchBannerT = res.rating === "perfect" ? 1.25 : 0.9;
    const local = this.terrain.localX(this.bird.x);
    // This ISLAND's ramp, not the base pitch's. It was hard-coded at 845/954 —
    // the pre-lengthening RAMP_START — so the ramp-launch sound had been firing
    // out in the hills rather than on the ramp, and per-island lengths moved it
    // again. Read the layout the bird is actually launching from.
    const ramp = islandTemplate(this.terrain.islandIndex(this.bird.x)).rampStart;
    if (local >= ramp - 42 && local < ramp + 67) this.audio.rampLaunch(res.speed);
    else this.audio.launchWhoosh(res.rating, res.speed);

    if (res.rating === "perfect") {
      this.perfects += 1;
      this.perfectChain += 1;
      this.bonus += 40 + combo * 15 + chainBonus(this.perfectChain);
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
        // FRENZY. Tiny Wings spent its entire celebration budget here: four clean
      // take-offs in a row, once, announced. Sunbird already pays out Fever for
      // the same chain, so the risk is that it arrives unremarked — a reward the
      // player cannot tell they earned. This is the moment, and it is latched so
      // a long chain does not re-fire it every step.
      if (isFrenzyMoment(this.perfectChain, this.frenzySeen)) {
        this.frenzySeen = true;
        this.hud.toast(`FRENZY — ${this.perfectChain} perfect launches in a row!`, "apex", "lightning");
        this.audio.fanfare();
        this.glow(1.4);
        this.flash("island");
        this.shake(1);
        this.particles.emitPerfectBurst(this.bird.x, this.bird.y, FRENZY_AT);
        this.fireMoment("frenzy", { shout: "FRENZY!", always: true });
      }

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
        this.hud.quip(quip(BIG_LAUNCH_QUIPS, combo + Math.round(res.speed)), "apex");
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
    this.bonus += 80;
    this.awardXp(XP_RULES.coin);
    this.audio.boing();
    this.particles.burstRing(this.bird.x, this.bird.y, 0xffcf33);
    this.particles.emitBounceBop(this.bird.x, this.bird.y, 1.0, 0.85, 0.2);
    this.particles.emitConfetti(this.bird.x, this.bird.y + 1);
    this.popupAtBird(this.bopWord(), "bop");
    this.camera.punch(4);
    this.hud.toast(`Sunflower bounce +80`, "gold", "sun");
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
      this.hud.toast("Butter landing", "cloud");
      this.particles.burstRing(this.bird.x, this.bird.y, 0xffffff);
    } else if (q < 0.8) {
      // A player's very first touchdown is absorbed rather than punished.
      //
      // (The original trigger — the held-dive touchdown 0.70 s into every run
      // from the old 14 m airborne start — is gone now that runs start
      // grounded; the guard stays as a net for a genuinely rough first-run
      // landing mid-flight.) The combo and the hit-stop are what teach
      // "land well"; neither has anything to say to a player who has not yet
      // flown.
      //
      // The combo and the hit-stop are what teach "land well"; neither has
      // anything to say to a player who has not yet flown.
      if (this.save.state.firstFlightDone) {
        this.launch.breakCombo();
        this.perfectChain = 0;
        // The thunk: an 80 ms freeze on a hard thud, matching the prototype's
        // hit-stop. Same path as the perfect-launch freeze above.
        if (!this.save.state.settings.reduceMotion) {
          this.hitStopTimer = Math.max(this.hitStopTimer, 0.08);
        }
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
        if (this.bird.impact > 10) this.popupAtBird(quip(THUD_QUIPS, this.thudCount++), "thud");
      }
    }
  }

  private enterFever(): void {
    const was = this.feverOn;
    this.feverOn = true;
    this.feverReached = true;
    this.feverTimer = FEVER_DURATION + this.gameplaySkin.feverBonus + this.masteryPerk.feverBonus;
    if (!was) {
      this.audio.feverOn();
      this.audio.setMusicMode("fever");
      this.hud.toast("FEVER", "fever");
      this.flash("fever");
      this.glow(0.95);
      this.particles.emitFeverBurst(this.bird.x, this.bird.y);
      this.particles.emitConfetti(this.bird.x, this.bird.y);
      this.popupAtBird("ON FIRE!", "fever");
      this.hud.quip(quip(FEVER_QUIPS, this.perfectChain), "fever");
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
      case "golden":
        this.runCoins += 10;
        this.bonus += 60;
        this.hud.toast("Golden cloud +10", "gold");
        break;
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
      this.hud.toast(`RING CHAIN ×${this.ringChain} +${pts}`, "gold");
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
    this.awardXp(XP_RULES.apex);
    this.audio.balloon();
    this.particles.emitConfetti(x, y + 1);
    this.particles.burstRing(x, y, 0xff6b6b);
    this.particles.emitBounceBop(x, y, 1.0, 0.42, 0.75);
    this.popupAtBird(this.bopWord(), "bop");
    this.camera.punch(6);
    this.shake(0.3);
    this.hud.toast(`Balloon bounce! +150`, "gold", "star");
    this.flash("fever");
    this.glow(0.7);
    this.haptic([20, 10, 40, 20, 60]);
    this.telemetry.track("balloon", {});
  }

  /**
   * Next rotating bop word for a bounce, voiced to match. The words and the
   * bounce sounds were decorrelated — "WHEEE!" is a slide whistle, but it could
   * land on a water splash or a balloon pop and never sound like the word on
   * screen. It now brings its own voice; the springy words ride whatever bounce
   * sound the caller already played.
   */
  private bopWord(): string {
    const word = quip(BOP_QUIPS, this.bounceCount++);
    if (word === "WHEEE!") this.audio.slideWhistle();
    return word;
  }

  private checkZenith(): void {
    const vy = this.bird.vy;
    if (!this.bird.grounded && !this.bird.asleep && this.prevVy > 0 && vy <= 0) {
      const ground = Math.max(this.terrain.heightAt(this.bird.x), WATER_Y);
      const alt = this.bird.y - ground;
      if (alt >= ZENITH_ALT) {
        this.zeniths += 1;

        // Altitude tier: each band has its own feel, copy, and reward weight.
        // Tiers align with the world's visual layers (ALT_CLOUDS=72, ALT_HIGH=135, ALT_CEILING=230).
        const tier =
          alt >= ALT_CEILING ? 4 :
          alt >= ALT_HIGH    ? 3 :
          alt >= ALT_CLOUDS  ? 2 : 1;

        const ptsPerUnit = tier === 4 ? 12 : tier === 3 ? 8 : tier === 2 ? 6 : 4;
        const slowmoDur  = tier === 4 ? 1.4 : tier === 3 ? 1.0 : tier === 2 ? 0.75 : ZENITH_DURATION;
        const punchStr   = tier === 4 ? 14 : tier === 3 ? 11 : tier === 2 ? 9 : 7;
        const glowStr    = tier === 4 ? 1.0 : tier === 3 ? 0.9 : tier === 2 ? 0.85 : 0.75;
        const ringColor  = tier === 4 ? 0xffdd44 : tier === 3 ? 0x88aaff : tier === 2 ? 0xaaddff : 0xffffff;

        // Streak multiplier: successive zeniths in the same run reward consistency.
        const streakMult = this.zeniths >= 3 ? 2.0 : this.zeniths === 2 ? 1.5 : 1.0;

        const basePts = Math.round(alt * ptsPerUnit);
        const pts = Math.round(basePts * streakMult);
        this.bonus += pts;

        this.timeScale = ZENITH_SLOWMO;
        this.zenithTimer = slowmoDur;
        this.camera.punch(punchStr);
        this.particles.burstRing(this.bird.x, this.bird.y, ringColor);
        this.particles.emitPerfectBurst(this.bird.x, this.bird.y, tier >= 3 ? 3 : 2);

        const tierLabel =
          tier === 4 ? "ORBITAL" :
          tier === 3 ? "STRATOSPHERE" :
          tier === 2 ? "ABOVE THE CLOUDS" : "SKY HIGH";
        const streakSuffix = this.zeniths >= 3 ? " ×2!" : this.zeniths === 2 ? " ×1.5!" : "!";

        this.popupAtBird(`${tierLabel}${streakSuffix} +${pts}`, "apex");
        this.audio.apex();
        this.audio.duckMusic(tier >= 3 ? 0.45 : 0.6, tier >= 3 ? 0.9 : 0.7);
        this.hud.toast(`${tierLabel} +${pts}`, "apex");
        this.flash("perfect");
        this.glow(glowStr);
        this.haptic(tier >= 3 ? [80, 40, 100, 40, 120] : [60, 40, 80]);
        this.telemetry.track("apex", { alt: Math.round(alt), tier, streakMult });
      }
    }
    this.prevVy = vy;
  }

  private activateManualBoost(source: "double_tap" | "stall_rescue"): void {
    this.manualBoostCooldown = MANUAL_BOOST_COOLDOWN;
    this.boostTimer = Math.max(this.boostTimer, MANUAL_BOOST_TIME);
    this.bird.vx += MANUAL_BOOST_SPEED;
    this.bird.vy = Math.max(this.bird.vy, 9);
    this.audio.boost();
    this.particles.emitBounceBop(this.bird.x, this.bird.y, 1, 0.65, 0.2);
    this.particles.burstRing(this.bird.x, this.bird.y, 0xffb347);
    this.shake(0.28);
    this.haptic([18, 12, 28]);
    this.hud.toast(source === "double_tap" ? "DOUBLE TAP BOOST!" : "STALL RESCUE BOOST!", "power");
    this.telemetry.track("manual_boost", { source });
  }

  /**
   * A Star Wish, collected in the space band above the cloud deck. It grants
   * ONE random power rather than a fixed one: the uncertainty is what makes the
   * climb worth repeating, and it means a star is never a dud you already hold.
   *
   * The wish is derived from the star's own x, deliberately not Math.random().
   * This game rolls its hills and its surprises from the run seed so a race or a
   * daily challenge is decided by flying, never by luck the field cannot share.
   */
  private grantStarWish(x: number, y: number): void {
    const pool: PickupKind[] = [
      "longglide", "wingboost", "magnet", "feather", "cloudboost", "goldenwings", "shield",
    ];
    const wish = pool[Math.abs(Math.floor(x)) % pool.length]!;
    this.pickups += 1;
    this.bonus += 150;
    this.awardXp(XP_RULES.coin);
    this.powers.add(wish);
    this.audio.chapterFanfare();
    this.particles.emitPickup(x, y, 1, 0.97, 0.9);
    this.particles.burstRing(x, y, 0xfff2c0);
    this.particles.emitConfetti(x, y + 1);
    this.flash("perfect");
    this.glow(0.7);
    this.haptic([50, 30, 50, 30, 120]);
    this.hud.toast(`WISH GRANTED — ${PICKUP_STYLE[wish].label}`, "gold", "star");
  }

  private onPickup(kind: PickupKind, x: number, y: number): void {
    if (this.challengeMods.noPowerups) {
      // Pure Sky: the pickup pops visually but grants nothing.
      this.particles.emitCollect(x, y);
      this.hud.toast("Pure Sky — power-ups are inert", "info");
      return;
    }
    // A star pays a random power instead of one of its own (see grantStarWish).
    if (kind === "star") {
      this.grantStarWish(x, y);
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
      this.hud.toast(`OVERCHARGE II — ${PICKUP_STYLE[kind].label}`, "apex", "lightning");
      this.shake(0.3);
      return;
    }
    switch (kind) {
      case "sun":
        this.daylight = Math.min(this.daylightMax(), this.daylight + PICKUP_SUN_TIME);
        this.particles.burstRing(x, y, 0xffd24a);
        this.hud.toast(`+${PICKUP_SUN_TIME}s Daylight`, "power", "sun");
        break;
      case "rocket":
        this.boostTimer = BOOST_TIME;
        this.bird.vx += 36;
        this.bird.vy += 7;
        this.particles.burstRing(x, y, 0xff5a3a);
        this.audio.boost();
        this.hud.toast(`Rocket Speed`, "power", "rocket");
        this.shake(0.55);
        break;
      case "magnet":
        this.magnetTimer = MAGNET_TIME;
        this.particles.burstRing(x, y, 0x8a6cff);
        this.audio.magnetOn();
        this.hud.toast(`Coin Magnet ${MAGNET_TIME}s`, "power", "magnet");
        break;
      case "shield":
        this.shield = Math.min(2, this.shield + 1);
        this.powers.shield = this.shield;
        this.particles.burstRing(x, y, 0x5ad8ff);
        this.hud.toast(`Sea Shield Active`, "power", "shield");
        break;
      case "longglide":
        this.particles.burstRing(x, y, 0x7fe8c8);
        this.hud.toast(`Long Glide · Low Drag`, "power", "glide");
        break;
      case "wingboost":
        this.particles.burstRing(x, y, 0xffa8e0);
        this.hud.toast(`Wing Boost · Super Lift`, "power", "bird");
        break;
      case "feather":
        this.particles.burstRing(x, y, 0xfff0c0);
        this.hud.toast(`Feather · Butter Landings`, "power", "feather");
        break;
      case "goldenwings":
        this.particles.burstRing(x, y, 0xffd76a);
        this.particles.emitConfetti(x, y + 2);
        this.flash("perfect");
        this.glow(1.0);
        this.audio.island();
        this.camera.punch(7);
        this.hud.toast("GOLDEN WINGS", "gold", "sparkle");
        break;
      case "cloudboost":
        this.particles.burstRing(x, y, 0xc8e8ff);
        this.hud.toast("Cloud Boost Wind Lift", "power", "cloud");
        break;
      default:
        break;
    }
  }

  /** First-flight coach line takes priority over ambient hints. */
  private coachHint(): string {
    if (!this.coach) return "";
    const v = this.coach.view(this.save.state.settings.tapToggleDive);
    if (v.step < 0 || !v.text) return "";
    // Just the sentence. This used to prepend three raw unicode circles
    // (`● ◉ ○`) to mark progress through the coach, which was cheap in three
    // separate ways: the glyphs came from whatever the display font happened to
    // map them to (the filled pip rendered as a RING, not a disc, so the
    // "current step" marker did not read as current), they meant nothing to
    // anyone who had not counted them, and — the part that actually broke the
    // screen — they consumed ~70px of a `width: 90%` centred line, pushing
    // "HOLD to dive down the hill" onto two lines so that "hill" printed across
    // the press-hand SVG sitting directly below it.
    //
    // The progress is still shown, as the segmented bar beside it
    // (`HUD.coachSteps`), where it cannot push the sentence around.
    return v.text;
  }

  /** Coach progress for the HUD's own step indicator. -1 when no coach is up. */
  private coachStep(): { step: number; steps: number } {
    if (!this.coach) return { step: -1, steps: 0 };
    const v = this.coach.view(this.save.state.settings.tapToggleDive);
    return v.step < 0 || !v.text ? { step: -1, steps: 0 } : { step: v.step, steps: v.steps };
  }

  private computeHint(): string {
    // Biome intro hint takes priority for the first few seconds in a new world.
    if (this.biomeHintTimer > 0 && this.biomeHintTimer < 9) return this.biomeHint;
    const novice = this.save.state.tutorialRuns < 3;
    const local = this.terrain.localX(this.bird.x);
    const cue = terrainCue({ grounded: this.bird.grounded, localX: local,
      altitude: this.bird.altitude, vy: this.bird.vy,
      landingSlope: !this.bird.grounded && this.bird.altitude < 55 && this.bird.vy < -8
        ? this.terrain.slopeAt(this.bird.x + landingLookAhead(this.bird.altitude, this.bird.vx, this.bird.vy)) : 0 },
      this.save.state.settings.tapToggleDive);
    if (cue) return cue;
    if (this.hintTimer > (novice ? 26 : 8)) {
      if (this.terrain.isOcean(this.bird.x + 40) && !this.terrain.isOcean(this.bird.x) && this.island < 2) return "Build speed — then RELEASE";
      return "";
    }
    const slope = this.terrain.slopeAt(this.bird.x);
    if (this.hintTimer < 2.6 && slope < -0.08) {
      // Close the first-flight action loop: acknowledge the hold immediately
      // and teach the release that converts the dive into lift.
      if (this.save.state.settings.tapToggleDive) return this.input.diving ? "TAP to soar" : "TAP to dive";
      return this.input.diving ? "RELEASE to soar" : "HOLD to dive";
    }
    if (this.hintTimer > 6 && this.ringChain >= 2) return `RING CHAIN ×${this.ringChain} · KEEP IT GOING`;
    if (this.hintTimer > 8 && this.runRings === 0) return "OPTIONAL: THREAD A RING CHAIN";
    if (this.hintTimer > 12 && this.pickups === 0) return "OPTIONAL: GRAB COINS FOR A BOOST";
    if (novice && !this.fairRace && this.save.hasUpgrade("doubletap") && this.save.state.settings.doubleTapBoost && this.hintTimer >= 3 && this.hintTimer < 5.8) return "DOUBLE TAP for a boost";
    if (slope > 0.16 && this.bird.grounded && this.bird.speed() > 18) return "RELEASE to launch";
    // No thermal line here: the ♨ HUD chip already says "release!" — three
    // simultaneous thermal texts (toast + chip + hint) was the worst offender
    // of the multiple-text bug.
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

  /**
   * Rebase the render origin once the flight is far enough out that float32
   * vertex buffers start to visibly lose precision.
   *
   * Every one of these four systems carried a working `recenter` /
   * `setRenderOrigin` for its whole life with ZERO callers, while the comments
   * on all four pointed at a `RENDER_RECENTER_THRESHOLD` in this file that had
   * never existed. Procedural generation keeps sampling true (float64) world x;
   * only the BAKED render-space coordinates shift, so terrain shape, physics
   * and seed determinism are untouched — which is why this is safe to do
   * mid-flight and why it is worth doing at all. In Endless, the one mode with
   * no natural end, the origin grew without ever rebasing.
   *
   * The threshold is a multiple of itself, so this fires once per
   * RENDER_RECENTER_THRESHOLD metres rather than every frame: a rebase rebuilds
   * the handful of loaded chunks, and doing that at 60 Hz would be the very
   * cost it exists to avoid.
   */
  private maybeRecenter(): void {
    const x = this.bird.x;
    if (x < RENDER_RECENTER_THRESHOLD) return;
    if (x - this.renderOriginX < RENDER_RECENTER_THRESHOLD) return;
    this.renderOriginX = Math.floor(x / RENDER_RECENTER_THRESHOLD) * RENDER_RECENTER_THRESHOLD;
    this.terrain.recenter(this.renderOriginX, x);
    this.camera.recenter(this.renderOriginX);
    this.bird.setRenderOrigin(this.renderOriginX);
    this.collect.setRenderOrigin(this.renderOriginX);
    // These two write true world x straight into their vertex buffers and
    // carry no mesh transform, so they were the only render-space consumers
    // still sitting at x≈4096 after a rebase — the wake and every impact ring
    // simply disappeared off-screen for the rest of an Endless run.
    this.trail.setRenderOrigin(this.renderOriginX);
    this.particles.setRenderOrigin(this.renderOriginX);
  }

  /**
   * Streams the glowing ribbon behind the bird, matching the sparkle trail.
   *
   * @param visX,visY the position the bird MESH was just drawn at, not the raw
   *   120 Hz physics position. At 170 m/s one `PHYS_DT` is 1.42 world units, so
   *   sampling the raw position left the ribbon head visibly detached from the
   *   sprite it is supposed to be attached to — and jittering against it by
   *   that much, every frame, at exactly the speeds where the trail is most
   *   visible.
   */
  private updateTrailRibbon(dt: number, visX: number, visY: number): void {
    this.advanceTrailHue(dt);
    const c = this.trailColor();
    this.trail.setColor(c[0], c[1], c[2]);
    const show =
      this.state === "playing" &&
      !this.save.state.settings.reduceMotion &&
      // A bird carving terrain at 50 m/s is not leaving a wake, it is scraping
      // along the ground — and the ribbon has `depthTest: false`, so it paints
      // over any hill between the camera and the bird.
      !this.bird.grounded &&
      (this.feverOn || this.boostTimer > 0 || this.bird.speed() > 48 || ((this.gameplaySkin.magnetAlways || this.gameplaySkin.id === "aurora") && this.bird.speed() > 24));
    if (show) {
      // Anchored at the tail tip, not the centroid — see `Bird.tailPoint`.
      const t = this.bird.tailPoint(visX, visY);
      this.trail.push(t.x, t.y);
    }
    this.trail.update(dt, show ? 1 : 0);
  }

  private emitTrail(dt: number): void {
    // The ribbon and its sparkle/wing particles are WebGL, so the
    // `sb-reduce-motion` CSS rule that covers the DOM flight HUD cannot reach
    // them. Without this gate the Settings toggle silenced the camera and the
    // popups but left both trails streaming behind the bird at full rate.
    // The ribbon itself is gated in `updateTrailRibbon`, which owns its
    // per-frame update — this only stops the particle emitters.
    if (this.save.state.settings.reduceMotion) return;
    this.trailFxAcc -= dt;
    if (this.trailFxAcc > 0) return;
    this.trailFxAcc = this.bird.speed() > 82 ? 0.028 : 0.055;
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
    // physics step so motion stays smooth above 60 Hz. versus has its own
    // interpolated path in renderVersus().
    //
    // This used to be `interp = 1` for every state except "playing", but the
    // continue and game-over loops BOTH keep stepping the bird at 120 Hz — so
    // the exact moment a run ended was the one moment the mesh fell back to
    // the raw staircase and juddered in ~1-unit steps, and the continue screen
    // is where the player spends seconds watching a coasting bird. Interpolate
    // whenever the bird is actually being stepped; only the menu is exempt.
    const interp = this.state === "menu" ? 1 : clamp(this.acc / PHYS_DT, 0, 1);
    const visX = lerp(this.prevBirdX, this.bird.x, interp);
    const visY = lerp(this.prevBirdY, this.bird.y, interp);
    // `interp` goes in as well: the bird interpolates its own heading, roll,
    // pupil dart, beak and tail flutter from the same one-step history the
    // position uses, so the whole sprite advances together. Passing only the
    // interpolated POSITION left every other visual channel reading the raw
    // 120 Hz physics value — a smooth position with a stepping sprite on it.
    this.bird.syncVisual(visDt, diving, glow, this.elapsed, this.terrain, visX, visY, interp);
    this.massRace.syncVisual(visDt, this.bird.x, interp);
    if (this.massRace.active && this.state === "playing") {
      const tags = this.massRace.getVisibleNameTags(this.camera.camera.position.x, this.bird.x, this.bird.y, this.startX);
      this.hud.updateNameTags(tags, this.camera.camera, this.renderWidth, this.renderHeight);
    } else {
      this.hud.updateNameTags([], this.camera.camera, this.renderWidth, this.renderHeight);
    }
    this.finishRemaining = this.finishGate.update(visDt, this.bird.x);
    this.updateTrailRibbon(visDt, visX, visY);
    this.particles.update(visDt);
    // Attract framing in the menu only: the demo bird leads into the open
    // margin beside the card. Every other state keeps gameplay framing.
    const attract = this.state === "menu" && !this.versus;
    // Follow the position the bird is DRAWN at, not the raw 120 Hz sim value —
    // otherwise the camera trails the sprite it is framing by up to a full
    // physics step and the bird slides around inside its own screen anchor.
    this.camera.update(
      rawDt,
      this.bird,
      playing,
      this.terrain.landingGround(this.bird.x, this.bird.vx),
      attract,
      this.feverOn,
      visX,
      visY,
    );
    // Tell the bird how far away the camera settled, so it can compensate for
    // the altitude dolly and stay legible. Must follow camera.update().
    this.bird.setViewDistance(this.camera.viewDistance);
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
    this.maybeRecenter();
    this.terrain.update(this.bird.x);

    // The raw ratio is the honest one and the audio wants it now. The sky does
    // not, because the ratio is a DIVISION by a value that moves underneath it:
    // buying or expiring a boost, clearing an island, and a mode that hands
    // over a 90 s clock all change `daylightMax()` mid-run, and every one of
    // them steps `daylight / daylightMax` in a single frame. A measured case
    // swung the sky by 902x in one frame — a hard cut from one time of day to
    // another, mid-flight, with nothing in the world having changed. Damping
    // toward the target turns every one of those steps into the sunset they
    // were always meant to be.
    const dayTRaw = Math.max(0, Math.min(1, this.daylight / this.daylightMax()));
    this.dayTSmooth += (dayTRaw - this.dayTSmooth) * (1 - Math.exp(-rawDt / DAY_T_TAU));
    const dayT = dayTRaw;
    this.audio.update(rawDt, this.bird.speed(), diving, this.bird.grounded, this.feverOn, dayT, playing, this.weather.gust);
    this.audio.setMusicIntensity(this.musicIntensity());

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
    // The island picks the song, so crossing a border changes the music.
    this.audio.setBiome(biome.musicMode, biome.id);
    const dayT = this.state === "menu" ? MENU_DAY_T : this.dayTSmooth;
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
   * Today's daily challenge, scaled by this player's own miss streak
   * (Feature: Challenge Difficulty Auto-Tuning). Every reader of "today's
   * daily" — the launch, the toast, the finish-line verdict, the journey
   * card — goes through this one function, so the target a player is shown
   * is always the exact target their run is checked against.
   */
  /**
   * Offer a commercial break when a run starts, if the portal can serve one.
   *
   * Fire-and-forget on purpose: the run begins immediately and the ad, if it
   * comes, arrives over the top. Awaiting here would make every launch after
   * the first feel like a loading screen.
   *
   * The pacing guard is not a politeness gesture. The shipped core's ad timing
   * is `timeBetweenAds: 120000` and `startAdsAfter: 120000` with
   * `preroll: false`, so a request inside those windows is refused and resolves
   * empty. Asking anyway would cost the player a beat of their run for nothing;
   * asking inside the real window is an opportunity the portal can actually
   * honour.
   *
   * The FIRST run of a session is skipped, because the core's `startAdsAfter`
   * refuses any break before gameplayStart has been running. `lastCommercial-
   * BreakAt` starts at 0, and `Date.now()` is an epoch value, so a plain
   * `now - last < GAP` test would NOT skip it — it has to be an explicit check.
   */
  private maybeBreakOnRunStart(): void {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") return;
    if (this.portalBreakPending) return;
    const now = Date.now();
    // Explicit first-run skip (see above). Also the "no break while another is
    // in flight" gate for the pause path, which shares this flag.
    if (this.lastCommercialBreakAt === 0) {
      this.lastCommercialBreakAt = now;
      return;
    }
    if (now - this.lastCommercialBreakAt < COMMERCIAL_BREAK_MIN_GAP_MS) return;

    this.portalBreakPending = true;
    this.lastCommercialBreakAt = now;
    this.telemetry.track("portal_break_request", { portal: platform.name, placement: "run_start" });
    // No `endPortalAd()` here on purpose. This call never begins a break — no
    // `beginPortalAd`, no `setState("ad")` — so closing an ad that never opened
    // would unmute and re-enable input underneath whatever real ad is up
    // (a shop or continue rewarded break), which is exactly the unbalanced
    // onAdOpened/onAdClosed pairing `poki-breaks.test.ts` exists to prevent.
    // The adapter's own balanced onAdClosed covers a break that did open.
    void platform
      .commercialBreak()
      .catch(() => undefined)
      .finally(() => {
        this.portalBreakPending = false;
      });
  }

  private todaysDaily(): DailyChallenge {
    return dailyChallenge(this.today, this.save.state.challenges.dailyChallengeFailures ?? 0);
  }

  private startRun(opts?: RunOptions): void {
    // Poki, "PokiSDK: HTML5" step 4 recommends a commercialBreak() before every
    // gameplayStart() when the player has shown intent to keep playing. That
    // call now lives in `maybeBreakOnRunStart()`.
    //
    // It used to be claimed to be here and was not: the only commercialBreak()
    // in the game sat in `resumeFromPause`, so a player who never paused and
    // simply relaunched from the menu was never offered a break at all — the
    // exact gap the old comment claimed had been closed.
    this.maybeBreakOnRunStart();
    this.sessionRuns += 1;
    this.markFunnel("first_flight");
    if (this.funnel.reached("first_death")) this.markFunnel("first_retry");
    if (this.sessionRuns >= 2) this.markFunnel("second_run");
    if (this.sessionRuns === 2 && !this.save.state.seenShop) {
      // The cheapest bird is 225 coins; a player on their second run has a
      // double-digit wallet. Point at the first thing they CAN buy.
      this.hud.toast("Next step: the Hangar — boosts start at 40, birds at 225", "gold", "coin");
    }
    this.exitVersus();
    this.mode = modeById(this.modeId);
    // Portal game events: open this attempt's measurement span. The run is a
    // `fail` until its goal is actually reached — a finish line, OR (in the
    // no-finish-line modes) a natural end after a real flight; see
    // `runOutcome.ts` for the full contract.
    this.runOutcome = "fail";
    this.platform?.measure("run", this.modeId, "start");
    // Snapshot the record to beat BEFORE this run writes anything, so the
    // mid-run "new record" moment and the results "NEW BEST" banner compare
    // against the genuinely previous best.
    this.bestAtStart = this.save.state.bestDistance;
    this.distanceRecordCrossed = false;
    this.newBest = false;
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
    // A challenge's mode belongs to the challenge, not to the button that was
    // pressed, so re-apply it at the single funnel every run passes through:
    // the journey card already set it, but "Fly again" rebuilds the challenge
    // flag from saved run metadata (Replay.replayOptions) and used to rebuild
    // it WITHOUT the mode — a challenge run in the wrong mode, claimable.
    // The claim re-checks the mode (finishRun), so this is the first of two
    // gates, not the only one.
    const challengeModeId = challengeMode(this.challengeRun, this.today, weekKey());
    if (challengeModeId) {
      this.modeId = challengeModeId;
      this.mode = modeById(challengeModeId);
    }
    this.challengeMods = this.challengeRun === "daily" ? modsFor(this.todaysDaily().modifier.id) : NO_MODS;
    this.eventRun = Boolean(opts?.event);
    if (this.eventRun) this.weeklyMods = weeklyEvent().mods;
    this.serverPlaceApplied = false;
    this.goldenHour = false;
    this.goldenCued = false;
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
    // Seeded, not damped: the first frame of a run must draw the sky the run
    // starts in, and a damped value would glide in from wherever the menu left
    // it — a visible fade-in on every launch.
    this.dayTSmooth = Math.max(0, Math.min(1, this.daylight / this.daylightMax()));
    this.settleAcc = 0;
    this.lastInputAt = 0;
    // Open the window the run's coin payout is timed-weighted over. A run's
    // coins are collected into one number and paid once at the end, so without
    // a start time a bonus armed mid-run can only be applied to the whole run
    // or to none of it (see SaveData.runCoinMultiplier).
    this.save.beginRun();
    this.weather.windMult = (this.eventRun ? this.weeklyMods.windMult : 1) * (this.stormfront ? 1.7 : 1);
    this.weather.stormfront = this.stormfront;
    if (this.stormfront) this.hud.toast("STORMFRONT — same storm for every pilot. Survive and outfly.", "warn", "storm");
    // Mass Race & PvP Variants: build the 40-bird grid on the *same* seed so the field is
    // identical for anyone flying this race. Real players take over slots as
    // they join; unfilled slots keep flying as local squadron pilots.
    if (isRaceMode(this.modeId)) {
      this.massRace.configureMode(this.modeId);
      const livePeers = !this.duelActive && !this.localRace && this.net?.connected ? this.net.roster() : null;
      const fieldSize = this.duelActive ? 1 : livePeers ? liveFieldSize(livePeers.length) : this.roomSize;
      this.massRace.spawn(fieldSize, `${this.seed}:${this.modeId}:${fieldSize}`, this.terrain, this.startX);
      // Reserve actual human seats immediately; do not simulate 40 phantom
      // opponents in a two-person room while waiting for the first packet.
      if (livePeers) livePeers.forEach((peer, i) => {
        const rival = this.massRace.rivals[i];
        if (rival) { rival.id = peer.id; rival.name = peer.name; rival.kind = "remote"; rival.hue = peer.hue; }
      });
      if (this.duelActive) {
        // Duel: one seeded opponent whose skill tracks your rating band.
        const rivalRating = this.save.state.rival.rating;
        const opp = duelOpponent(`${this.seed}:${this.today}`, rivalRating);
        this.massRace.setFieldSkill(duelSkillFor(rivalRating));
        const r = this.massRace.rivals[0];
        if (r) r.name = opp.name;
        this.hud.toast(`Duel vs ${opp.name} · first to the line`, "gold", "swords");
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

    // Race boosts are retained for a later solo flight, never spent invisibly.
    const armed = this.fairRace ? [] : this.save.consumeArmedBoosts();
    for (const id of armed) this.applyBoost(id);
    if (this.eventRun) {
      const ev = weeklyEvent();
      this.hud.toast(`${ev.name} · fly ${ev.target.toLocaleString()} m`, "quest", ev.icon);
      this.audio.eventStinger();
    }
    if (this.challengeRun === "daily") {
      const c = this.todaysDaily();
      this.hud.toast(`${c.title} · ${c.modifier.label}`, "quest", c.modifier.icon);
    } else if (this.challengeRun.startsWith("gauntlet")) {
      const idx = Number(this.challengeRun.slice(8)) || 0;
      const st = weeklyGauntlet(weekKey()).stages[idx];
      if (st) this.hud.toast(`Gauntlet ${idx + 1}/3 · ${st.label}`, "quest", "lightning");
    }
    // A GO countdown before the clock starts.
    //
    // The day is 52 seconds and the clock was already running on the first
    // physics step — so a first-time player lost several seconds of their only
    // day while still reading Distance / daylight / Coins and the coach line.
    // The countdown branch in `frame` already freezes the accumulator, so
    // arming it here is the whole fix: nothing runs, nothing drains, and the
    // existing beeps mark the beats. Versus and networked starts arm their own
    // (a shared start, or the room's server time), so they are left alone.
    if (!this.versus && this.networkStartAt <= 0 && this.roomCode === "") {
      this.countdown = SOLO_START_COUNTDOWN;
    }

    // Compile every shader this run can use BEFORE the clock starts.
    //
    // Three.js compiles a material's program lazily, on the first frame that
    // actually draws it. That is invisible until it is not: the first run of a
    // session stalls on whichever new material appears mid-flight. Measured on
    // the running build — 350 frames, median 83ms under SwiftShader, p95 149ms,
    // and one frame at 858ms. That outlier is a compile, not rendering, and it
    // lands somewhere random in the first seconds of a player's very first
    // run, which is the worst possible moment for the first impression.
    //
    // `renderer.compile` walks the scene and forces the driver to build every
    // program now. It costs the same total work, just moved off the first
    // seconds of play and into the load the player is already waiting through.
    // Wrapped because it touches WebGL and must never be the reason a run fails
    // to start.
    this.warmShaders();

    this.setState("playing");
    this.setScreen("main");
    this.camera.setIntro(0);
    this.hint = "HOLD to dive";
    void this.audio.resume();
    this.audio.setMusicMode("play");
    this.telemetry.track("run_start", { mode: this.modeId, seed: this.seed, skin: this.skin.id, boosts: armed.join(",") || "none", gold: this.save.state.gold });
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
      // The in-flight powerups, bought from the shop. `powers.add` is the exact
      // call a pickup makes (see Game.onPickup), at the same duration, so a
      // bought Long Glide and a caught one put the bird in the same state — the
      // store sells the world's powerups rather than a second, weaker version
      // of them. These ids ARE `PickupKind`s, deliberately: one vocabulary for
      // one mechanic, so a store row and the pickup it mirrors cannot drift.
      // The tier-II overcharge cannot fire here (the timers were just reset and
      // nothing is live yet to double up on), so an armed boost is tier I.
      case "longglide":
      case "wingboost":
      case "feather":
      case "rocket":
      case "cloudboost":
      case "goldenwings": {
        const kind = id as PickupKind;
        this.powers.add(kind);
        this.audio.powerup();
        const pc = PICKUP_STYLE[kind].color;
        this.particles.emitPickup(this.bird.x, this.bird.y, ((pc >> 16) & 255) / 255, ((pc >> 8) & 255) / 255, (pc & 255) / 255);
        // Speed Boost is the one powerup that is also an impulse, not just a
        // timer — a caught one shoves the bird as well (see onPickup), so a
        // bought one has to or it would be strictly worse than the pickup.
        if (kind === "rocket") {
          this.boostTimer = BOOST_TIME;
          this.bird.vx += 36;
          this.bird.vy += 7;
        }
        break;
      }
      // The timed coin multiplier, which SaveData had implemented and nothing
      // had ever armed. `setCoinBonus` records the window, so a bonus armed at
      // takeoff pays for the whole run and never for time it was not live.
      case "luckycoin":
        this.save.setCoinBonus(2, 45);
        break;
      // The Climb Breaker, bought rather than earned. `boostDaylight` raises the
      // CAP as well as the grant, because a grant the cap immediately clips is
      // a booster that does nothing.
      case "sunrunner":
        this.boostDaylight += 20;
        this.daylight = Math.min(this.daylightMax(), this.daylight + 20);
        break;
      // `weather.ward` is already a first-class flag: gusts drop to 1/4 and ash
      // storms stop clamping vertical speed. Nothing new to build.
      case "tailwind":
        this.weather.ward = true;
        break;
      case "stormward":
        this.weather.ward = true;
        break;
      case "hotwings":
        this.enterFever();
        break;
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
    if (def) this.hud.toast(`${def.name} armed`, "power", def.icon);
  }

  /**
   * The run is over. `reason` is the ONLY way the player learns why.
   *
   * The three deaths were indistinguishable — the sun running out, washing out,
   * and simply stopping all produced the same card, and the settle death can
   * fire with most of the day still on the meter, so "the sun won" is not an
   * available inference. The settle variant was the worst: a player who
   * stopped holding for four seconds was shown a full clock and a shrug.
   */
  private onDaylightOut(reason: RunEndReason = "daylight"): void {
    this.bird.asleep = true;
    this.endReason = reason;
    this.daylight = 0;
    // An honest outcome for a mode with no finish line: the flight IS the
    // goal, so sunset after a real flight or choosing to land and rest is the
    // run COMPLETING, while ditching in the sea or a no-show launch stays a
    // fail. Finish-line modes keep their own rule (cross = complete, anything
    // else = fail) — this branch only fires where `finish === 0`, where the
    // old rule reported every run in the game's DEFAULT mode as a fail (the
    // recap screen celebrated a flight the funnel said 0 % of players ever
    // completed). See runOutcome.ts for the full contract.
    if (this.mode.finish === 0 && this.runOutcome !== "complete") {
      this.runOutcome = outcomeForNaturalEnd(reason, {
        distance: this.bird.x - this.startX,
        runTime: this.runTime,
      });
    }
    // Death drama: the sun wins in slow motion. Reuses the zenith slow-mo
    // plumbing so time restores itself automatically.
    this.timeScale = 0.35;
    this.zenithTimer = 1.1;
    this.camera.punch(0.5);
    this.audio.sleep();
    this.audio.setMusicMode("sleep");
    this.flash("sleep");
    this.hud.quip(quip(SLEEP_QUIPS, Math.round(this.bird.x)), "cloud");
    const gold = this.save.state.gold;
    const canCoins = this.save.state.wallet >= CONTINUE_COST;
    // A portal BUILD is not a portal SESSION: a blocked SDK script, an ad-blocked
    // browser or an off-portal preview all leave the Poki build with no ad
    // surface at all. Asking `portalEnabled()` here offered "Watch for Second
    // Wind" in exactly those sessions, and the reward path opens with
    // `if (!this.adsLive()) return;` — so the button was offered AND inert: the
    // tap did nothing, with no ad, no toast and no state change.
    const canAd = this.portalEnabled()
      ? this.adsLive()
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
        // `bestDistance` is only written when the run ENDS, so the run that
        // sets the record could never satisfy this - and that is exactly the
        // run a new player remembers. A first flight is a record by definition.
        isRecord: distance > 0 && distance >= this.save.state.bestDistance,
        altitude: this.bird.y,
        adAvailable: canAd,
      });
      this.setState("continue");
      // Poki game-events: measure the rewarded offer's exposure (visible) so
      // the dashboard can compare it against `interact` when tapped. The label
      // carries the offer kind so placement usage is measurable per context.
      if (this.portalEnabled() && canAd) {
        this.platform?.measure("button", continuePlacementLabel(this.continueOfferView.kind), "visible");
      }
      this.telemetry.track("continue_offer", { kind: this.continueOfferView.kind, distance: Math.round(distance) });
    } else {
      this.finishRun();
    }
  }

  private doContinue(source: string): void {
    // Resuming a lost run is the strongest "show intent to continue" signal in
    // the game, and it went straight back to `playing` with no break offered —
    // same omission as `startVersus`. The rewarded break that preceded it (for
    // the gold path) is a DIFFERENT ad; this is the commercial opportunity the
    // guide asks to be signalled here.
    this.maybeBreakOnRunStart();
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
    this.markFunnel("first_death");
    this.bird.asleep = true;
    // The rival field is done: drop the (up to 41) frozen birds out of the
    // scene the moment the run ends. They keep drawing behind the results
    // card otherwise, on exactly the frame budget where weak phones die.
    // Rivals stay allocated — the next startRun() re-seeds the field, and
    // the server's official-place echo still needs the local finish times.
    if (this.massRace.active) this.massRace.group.visible = false;
    // Portal game events: one outcome per attempt — `complete` when the run
    // reached its goal (crossed its finish line, or — in a no-finish-line
    // mode — flew a real flight to its natural end), `fail` when it fell
    // short (ditched, eliminated, or a no-show launch).
    // (Poki funnel contract: send complete OR fail, never both, and a start
    // without an outcome would break the drop-off funnel.)
    this.platform?.measure("run", this.modeId, this.runOutcome);
    const stats = this.runStats();
    // Freeze the number the results card shows: `bird.asleep` only damps
    // velocity (see Bird.update), it doesn't zero it, so the bird keeps
    // coasting for a couple of seconds after this point. Score, leaderboard
    // submission and this XP award all read `stats.distance` right here —
    // the HUD must show that same frozen number on the results screen, not
    // keep re-reading a bird position that is still sliding underneath it.
    this.resultDistance = stats.distance;
    this.newBest = this.bestAtStart > 0 && stats.distance > this.bestAtStart;
    // A personal best is the one moment CrazyGames wants celebrated site-wide.
    if (this.newBest) this.platform?.happyTime();
    this.telemetry.track("run_end", {
      mode: this.modeId,
      outcome: this.runOutcome,
      distance: Math.round(stats.distance),
      newBest: this.newBest,
      moments: JSON.stringify(this.moments.toJSON()),
      momentRecap: this.moments.recapLine(),
    });
    if (this.sessionRuns === 1) {
      this.hud.toast("Flight logged! Scroll down to open the Shop and spend your coins", "gold", "shop");
      this.telemetry.track("onboarding_first_flight_complete", { distance: Math.round(stats.distance) });
    } else if (this.sessionRuns === 2) {
      // A concrete, time-limited next goal beats a vague social nudge for a
      // player two runs in: the daily course is live content with a payout,
      // and naming it is the CTA (playbook lever 9). The social sky keeps its
      // own surfaces — the lobby, the recap's challenge buttons.
      this.hud.toast("Today's Daily Challenge is live — bonus coins on the daily course", "gold", "sun");
    }

    // A duel abandoned short of the line is a loss — no free retries on rating.
    if (this.duelActive && this.duelResult === "") {
      const res = this.save.recordDuelResult(false, this.today);
      this.duelResult = "lost";
      this.duelDelta = res.delta;
      this.lastRatingDelta = res.delta;
      this.hud.toast(`Duel lost — never reached the line · ${res.delta} rating`, "warn", "swords");
    }

    // A friend's ghost-race challenge (SocialSystem) resolves the moment this
    // flight ends — win/lose/tie against the challenger's posted distance.
    if (this.activeFriendChallenge) {
      const ch = this.activeFriendChallenge;
      const result = this.social.completeChallenge(ch.id, stats.distance);
      if (result) {
        const label = result === "won" ? `Beat ${ch.challengerName}'s ghost!` : result === "lost" ? `Fell short of ${ch.challengerName}'s ghost.` : `Tied ${ch.challengerName}'s ghost.`;
        this.hud.toast(`Ghost challenge — ${label}`, result === "won" ? "gold" : "info", "ghost");
      }
      this.activeFriendChallenge = null;
    }

    this.nearMiss = evaluateNearMiss(
      stats.distance,
      this.save.state.bestDistance,
      this.maxAltitude,
      this.save.state.bestAltitude,
      this.launch.best,
      this.save.state.bestCombo,
    );
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
      this.hud.toast("New personal ghost recorded", "gold");
      this.telemetry.track("ghost_new", { distance: Math.round(stats.distance) });
    }

    // Global board + weekly cups both score off the same verified run stats.
    // durationMs is not decoration: the server's plausibility gate reads it, and
    // a submission that carries none is quarantined instead of ranked.
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
      durationMs: Math.max(0, Math.round(this.runTime * 1000)),
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
    for (const cup of improvedCups) this.hud.toast(`${cup.name} — new personal best`, "gold", cup.icon);
    if (improvedCups.length > 0) this.audio.personalBest();
    this.save.persist();

    this.newlyCompleted = this.missions.applyRun(stats);
    this.claimedQuests = this.missions.claimQuests(this.today, stats);

    // RESULTS-CARD PROGRESS — every ladder this run moved, gathered while it is
    // still in scope. `runProgressEvents` (pure, `RunProgress.ts`) turns these
    // facts into the ranked beats; the snapshot reads the result. Nothing here
    // is a second source of truth: each field is the same local the toast above
    // it was built from, so the card cannot disagree with the flight.
    const progress: RunProgressFacts = { ...NO_RUN_PROGRESS, distance: stats.distance };
    const cleared: RunChallenge[] = [];
    const pushChallenge = (c: RunChallenge): void => { cleared.push(c); };

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
        this.challengeOutcome = `${iconGlyph("swords")} Challenge won! Out-flew ${this.rival.name} (${this.rival.distance} m) · +${bounty} coins`;
        this.hud.toast(this.challengeOutcome, "gold");
        this.audio.island();
      } else {
        this.challengeOutcome = `${iconGlyph("swords")} ${this.rival.name} still leads — ${Math.round(stats.distance)} m of ${this.rival.distance} m`;
        this.hud.toast("Their mark stands. Fly again.", "warn");
      }
      this.telemetry.track("rival_settled", { won });
    }
    if (this.challengeRun === "daily") {
      const c = this.todaysDaily();
      // The mode is part of the claim, not just of the launch: a run only
      // *flagged* as the daily (any "Fly again", any future caller of
      // startRun) can otherwise clear the target in a mode the challenge never
      // asked for, and the target test alone would happily pay out.
      const verdict = dailyVerdict(stats, c, this.modeId);
      if (verdict === "claim" && this.save.completeDaily(this.today)) {
        this.save.addCoins(c.reward);
        this.challengeOutcome = `${iconGlyph("sun")} Daily challenge complete · +${c.reward} coins`;
        this.hud.toast(this.challengeOutcome, "gold");
        this.audio.island();
        pushChallenge({ variant: "daily", icon: "sun", label: c.title, coins: c.reward });
      } else if (verdict === "wrong-mode") {
        this.challengeOutcome = `Daily challenge must be flown in ${modeById(c.mode).name} — this run doesn't count`;
      } else {
        this.challengeOutcome = `Daily challenge missed — needed ${c.target} ${c.metric}`;
      }
    } else if (this.challengeRun.startsWith("gauntlet")) {
      const idx = Number(this.challengeRun.slice(8)) || 0;
      const g = weeklyGauntlet(weekKey());
      const st = g.stages[idx];
      if (st) {
        const verdict = stageVerdict(stats, st, this.modeId);
        if (verdict === "claim") {
          const res = this.save.completeGauntletStage(g.week, idx);
          if (res) {
            this.save.addCoins(st.reward);
            this.challengeOutcome = `${iconGlyph("lightning")} Gauntlet stage ${idx + 1} clear · +${st.reward} coins`;
            this.hud.toast(this.challengeOutcome, "gold");
            pushChallenge({ variant: "gauntletStage", icon: "lightning", label: st.label, coins: st.reward });
            if (res === "clear") {
              this.save.addCoins(g.clearBonus);
              this.hud.toast(`GAUNTLET CLEARED · +${g.clearBonus} coins`, "gold", "trophy");
              // The whole-week clear is its own beat, not a second stage beat:
              // `beatCopy` gives it the dedicated "GAUNTLET CLEARED" key and
              // it outranks everything except a record and a rank-up.
              pushChallenge({ variant: "gauntlet", icon: "trophy", label: g.week, coins: g.clearBonus });
              this.platform?.measure("quest", "gauntlet-clear", "complete");
              this.platform?.happyTime();
              if (this.save.ownTrail("trail_gauntlet")) this.hud.toast("Stormline trail unlocked!", "gold", "sparkle");
              // Gauntlet prize skin: 5 lifetime clears earns the Stormcrow.
              if (this.save.state.challenges.gauntletsCleared >= 5 && !this.save.state.ownedSkins.includes("stormcrow")) {
                this.save.ownSkin("stormcrow");
                this.hud.toast(`Stormcrow unlocked — 5 gauntlets cleared!`, "gold", "bird");
              }
              this.audio.island();
            }
          }
        } else if (verdict === "wrong-mode") {
          this.challengeOutcome = `Gauntlet stage ${idx + 1} must be flown in ${modeById(st.mode).name} — this run doesn't count`;
        } else {
          this.challengeOutcome = `Gauntlet stage ${idx + 1} missed — needed ${st.target} ${st.metric}`;
        }
      }
    }

    // Weekly live event: clear = hit the event distance in an event-flagged run.
    if (this.eventRun) {
      const ev = weeklyEvent();
      if (stats.distance >= ev.target) {
        const counts = this.save.recordEventClear(ev.week, monthKey());
        this.save.addCoins(ev.reward);
        this.challengeOutcome = `${iconGlyph(ev.icon)} ${ev.name} clear ×${counts.week} · +${ev.reward} coins`;
        this.hud.toast(this.challengeOutcome, "gold");
        pushChallenge({ variant: "event", icon: ev.icon, label: ev.name, coins: ev.reward });
        this.platform?.measure("quest", "weekly-clear", "complete");
        this.platform?.happyTime();
        this.audio.eventStinger();
        // Monthly theme trail: 3 event clears inside the month.
        const th = monthlyTheme();
        if (counts.month >= THEME_TRAIL_CLEARS && this.save.claimThemeTrail(th.month)) {
          if (this.save.ownTrail(th.prizeTrail)) {
            this.hud.toast(`${th.name} · ${TRAILS[th.prizeTrail]?.label ?? th.prizeTrail} trail unlocked!`, "gold", "star");
          } else {
            this.save.addCoins(300);
            this.hud.toast(`${th.name} complete · trail owned, +300 coins`, "gold", th.icon);
          }
        }
      } else {
        this.challengeOutcome = `${iconGlyph(ev.icon)} ${ev.name} missed — needed ${ev.target.toLocaleString()} m`;
      }
    }

    // Mode mastery: every finished run banks progress; level-ups pay coins.
    const mastery = bankMasteryRun(this.save, this.modeId);
    if (mastery) {
      this.platform?.measure("level", this.modeId, "complete");
      this.platform?.happyTime();
      progress.mastery = {
        icon: this.mode.icon,
        mode: this.mode.name,
        level: mastery.level,
        // The signature skill *is* the max: `bankMasteryRun` only returns a
        // skill at the last level, so this is the one place the flag is known.
        maxed: Boolean(mastery.skill),
        skill: mastery.skill?.name ?? "",
        coins: mastery.coins,
      };
      if (mastery.skill) {
        this.hud.toast(`${this.mode.name} MASTERED · skill unlocked: ${mastery.skill.name} (${mastery.skill.desc}) · +${mastery.coins} coins`, "gold", "star");
        this.audio.chapterFanfare();
      } else {
        // A live mass race equalises flight equipment, so the mastery perk is
        // NOT live in that mode. Saying otherwise taught the player that every
        // other counter in the game was also wrong.
        const live = !this.fairRace;
        this.hud.toast(
          `${iconGlyph(this.mode.icon)} ${this.mode.name} mastery Lv.${mastery.level} · ${live ? "+2% coins in mode" : "perks apply in solo runs"} · +${mastery.coins} coins`,
          "gold",
        );
        this.audio.milestone();
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
      this.rankUp = `${iconGlyph(promo.icon)} ${promo.name}`;
      this.rankUpT = 3.2;
      this.audio.fanfare();
      this.particles.emitConfetti(this.bird.x, this.bird.y + 4);
      this.hud.toast(`${promo.name.toUpperCase()} — lifetime rank earned`, "gold", promo.icon);
      this.telemetry.track("wings_promo", { tier: promo.id });
      progress.wings = { tierId: promo.id, icon: promo.icon, name: promo.name };
    }
    this.save.addLifetimeApexMoments(stats.apex);
    this.save.addLifetimeSunflowers(this.runSunflowers);
    // distance XP is awarded at the end; everything else accrued live during the flight
    this.awardXp(Math.round(stats.distance * XP_RULES.perMetre));
    const tierBefore = this.seasonPass.tier();
    this.flushXp();
    const tierAfter = this.seasonPass.tier();
    const xp = this.seasonPass.xp();
    const newTrophies = this.achievements.checkNew();
    if (newTrophies.length > 0) {
      this.platform?.measure("achievement", "trophy-unlock", "complete");
      this.platform?.happyTime();
    }
    this.checkPrizeSkins();

    // Poki game-events: the rewarded bonus card is on the recap — measure its
    // exposure once so the dashboard can pair it with the tap's `interact`.
    if (this.portalEnabled() && this.runCoins > 0 && !this.multiplierClaimed) {
      this.platform?.measure("button", "results-coin-multiplier", "visible");
    }
    this.telemetry.track("run_end", {
      mode: this.modeId,
      outcome: this.runOutcome,
      distance: Math.round(stats.distance),
      score: Math.round(score),
      coins: this.runCoins,
      islands: stats.island,
      apexMoments: stats.apex,
      xp,
      moments: JSON.stringify(this.moments.toJSON()),
    });

    if (tierAfter > tierBefore) {
      this.hud.toast(`Nest Pass Lv.${tierAfter} unlocked — claim it!`, "gold");
      this.audio.island();
      progress.passTier = tierAfter;
    }
    if (this.claimedQuests.length) {
      const total = this.claimedQuests.reduce((a, q) => a + q.reward, 0);
      this.hud.toast(`Quest complete · +${total} coins`, "quest");
    }
    if (this.newlyCompleted.length) this.hud.toast("Nest upgraded!", "island");
    for (const t of newTrophies) this.hud.toast(`Trophy: ${t.title}`, "gold");
    if (newTrophies.length > 0) this.audio.trophy();

    // THE WIRE. Everything above noticed a ladder move; `runProgressEvents`
    // turns those same facts into the ranked beats the results card renders,
    // and the snapshot reads only this field. From here the card is a function
    // of the run, so it cannot say anything the flight did not do.
    progress.newBest = this.newBest;
    progress.trophies = newTrophies;
    progress.quests = this.claimedQuests;
    progress.nest = this.newlyCompleted.length
      ? { level: this.save.state.nestLevel, mult: this.save.nestMultiplier() }
      : null;
    progress.challenges = cleared;
    this.runProgress = runProgressEvents(progress);
    this.telemetry.track("run_progress", { beats: this.runProgress.length, kinds: [...new Set(this.runProgress.map((e) => e.kind))].join(",") });

    const runs = this.save.state.runsPlayed;
    const dueAd = SIMULATED_BREAKS && !this.portalEnabled() && !this.save.state.gold && this.save.shouldShowInterstitial(runs);
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
      this.hud.toast(`Solstice unlocked — welcome to Sunbird Legend!`, "gold", "bird");
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
      this.hud.toast("VIP expired — perks paused", "warn");
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
    // Daily Login Ritual banner: a fresh day means a fresh chance to see it.
    this.dismissedDailyPrompt = false;
    this.save.noteDailyChallengeRollover(this.save.isDailyDone(yesterday));
    const reward = this.save.touchStreak(today, yesterday);
    const streakMilestone = this.save.justAchievedStreakMilestone();
    const gift = this.save.claimVipDaily(today);
    // Monthly ranked season rollover: soft reset + peak-division reward.
    const seasonEnd = this.save.ensureRankSeason();
    if (seasonEnd) this.hud.toast(`Ranked season over · ${seasonEnd.division} reward +${seasonEnd.coins} coins`, "gold", "swords");
    // Only swap hills while resting in the menu — a midnight rollover mid-run
    // must never yank the terrain out from under a live flight.
    if (this.state === "menu" && this.seedMode === "today") this.rebuildWorld(today);
    if (reward > 0) this.hud.toast(`Day ${this.save.state.streak.days} streak · +${reward} coins`, "gold");
    if (streakMilestone) this.hud.toast(`${streakMilestone.days}-day streak · +${streakMilestone.coins} coins${streakMilestone.trail ? " + a new trail" : ""}!`, "gold", "fire");
    if (gift > 0) this.hud.toast(`VIP daily gift · +${gift} coins`, "vip");
    this.hud.toast("New hills today", "island");
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
      // A mode surge belongs to the run that earned it. It self-limits to well
      // under a second, but a fresh run must not open with headroom the player
      // has not earned yet.
      this.modeSpeedBonus = 0;
    // A new run inherits nothing from the last one: the card's progress strip,
    // the mission diff baseline and the once-per-quest "just banked" flags are
    // all per-run, and carrying them over would replay the previous flight's
    // celebration on the menu.
    this.runProgress = [];
    this.missionRowViews = [];
    this.previousMissionRows = [];
    this.justBankedQuests = [];
    // Freeze the rung this run climbs. `nextWings` is the same call
    // `wingsCard` makes, read before a single metre is banked.
    {
      const life = this.save.state.lifetime.distance;
      const next = nextWings(life);
      const cur = wingsFor(life);
      this.wingsRungAtStart = next ? { name: next.tier.name, needed: next.needed, span: Math.max(0, next.tier.min - cur.min) } : null;
    }
    this.masteryPerk = this.fairRace ? NO_MASTERY_PERKS : masteryPerks(this.save, this.modeId);
    // Shared/daily/ranked seeds must not depend on an individual save's skill.
    // Apply adaptive calibration only to an unshared casual flight, before sampling spawn.
    this.terrain.setDifficulty(!isRaceMode(this.modeId) && this.seed.startsWith("fly-") ? this.flow.difficulty() : 1);
    const course = isRaceMode(this.modeId) ? this.courseForRace() : null;
    this.startX = course ? course.island * ISLAND_PERIOD + 64 : 64;
    // Start ON the ground — perched on the opening hill, matching the flock
    // (MassRace spawns rivals at heightAt + BIRD_RADIUS) and the tutorial's
    // first cue, which teaches the dive FROM the ground. See START_ALTITUDE
    // for the full history: the old 14 m drop-in opened every run with a fall
    // the player never chose and handed the climb goal free altitude.
    // grounded + wasGrounded are set AFTER reset so the first physics step
    // reads ground→ground: no phantom "justLanded" beat, no landing quality
    // scored for existing, no sunk-into-the-grass frame.
    const y = this.terrain.heightAt(this.startX) + BIRD_RADIUS + 0.5 + START_ALTITUDE;
    this.bird.reset(this.startX, y);
    if (START_ALTITUDE <= 0.5) {
      this.bird.grounded = true;
      this.bird.wasGrounded = true;
    }
    // Re-seed the render-interpolation snapshot. `visX` is
    // `lerp(prevBirdX, bird.x, interp)`, and `interp` is 0 whenever the
    // accumulator is empty — which is the ENTIRE start countdown, because
    // `setState("playing")` zeroes `acc` and no physics step runs until GO.
    // So without this the bird mesh, and the camera following it, are drawn at
    // wherever the PREVIOUS run finished, then snap to the start line on the
    // first frame after GO. Measured on a second run: a 92-unit jump in one
    // 16.7 ms frame, where cruising at 48 m/s should move 0.8 — and the
    // magnitude is however far the last run went, so a 60 s run makes it
    // thousands of units. This is the run-start jolt, and it is the single
    // largest discontinuity in the game.
    this.prevBirdX = this.bird.x;
    this.prevBirdY = this.bird.y;
    this.bird.vx = START_SPEED;
    this.bird.vy = 0;
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
    this.surprises.reset();
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
    this.momentLastAt = {};
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
      // Every solo flight gets a visible, beatable chase line. This fallback is
      // explicitly labelled as a pace target, never as a real player.
      if (!this.versus && !this.massRace.active) {
        // A friend's ghost challenge (SocialSystem) is the point of this
        // flight when one is active — it overrides the generic pace target,
        // and its ghost is never replaced by an incoming network rival.
        const challenge = this.activeFriendChallenge;
        const targetRng = new SeededRandom(`${this.seed}:pace-target`);
        const pace = synthesizePaceGhost({
          seed: this.seed,
          startX: this.startX,
          distance: challenge ? challenge.ghostDistance : paceTargetDistance(this.save.state.bestDistance, () => targetRng.next()),
          terrain: this.terrain,
          skill: clamp(this.flow.difficulty() * 0.5, 0.3, 0.82),
        });
        this.rivalGhostName = challenge ? challenge.challengerName : pace.name;
        this.rivalGhostPlayer.loadRecord(pace.record);
        this.hud.toast(
          challenge
            ? `Ghost challenge vs ${challenge.challengerName} — beat ${Math.round(challenge.ghostDistance)} m`
            : // Only the modes with a real finish line may promise one. Five of
              // the six solo modes are `finish: 0` (endless), and this line
              // fires on every one of them at run start — so the game's very
              // first statement of the objective was to promise an end that
              // does not exist, aimed at a player with no context to doubt it.
              this.mode.finish > 0
                ? `Chase ${pace.name} — pass it before the finish`
                : `Chase ${pace.name} — stay ahead`,
          "quest",
          "ghost",
        );

        // Prefer an actual player's compatible ghost when one exists.
        const epoch = this.runEpoch;
        if (!challenge) {
          void fetchRivalGhost(this.seed, this.save.state.deviceId, this.save.state.bestDistance).then((rg) => {
            if (!rg || this.disposed || epoch !== this.runEpoch || this.state !== "playing") return;
            this.rivalGhostName = rg.name;
            this.rivalGhostPlayer.loadRecord({ seed: this.seed, distance: rg.distance, samples: rg.samples });
            this.hud.toast(`${rg.name} flew ${Math.round(rg.distance)} m here — chase them`, "quest", "ghost");
          });
        }
      }
    }
    this.launch.reset();
    this.powers.reset();
    this.runGems = 0;
    this.recordBanner = "";
    this.goalPop = "";
    this.goalPopKind = "goal";
    this.goalPopT = 0;
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
    // While a break is live, the ONLY actions that may run are the ones the
    // game owns on a placeholder ad. This is the canonical guard: input was
    // already disabled during a break, but that only gates the Input class
    // (keys, dive, pause) — the HUD's own DOM buttons stayed clickable, so any
    // "back"/navigate/pause control left on screen could still fire and walk
    // the player out of the ad. A portal break is ended by the SDK promise and
    // nothing else.
    //
    // The rule itself lives in ./adGate, where a unit test enumerates every
    // action in the shipping markup against both break kinds.
    if (this.state === "ad" && !adBreakAllowsAction(action, this.portalEnabled())) {
      return;
    }
    void this.audio.resume();
    if (this.handleShopEvent(action, id)) return;
    if (this.handleSocialEvent(action, id)) return;
    if (this.handleSettingsEvent(action, id)) return;
    if (this.handleRoomEvent(action, id)) return;
    if (this.handleJourneyEvent(action, id)) return;
    if (this.handleContinueEvent(action, id)) return;
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
          this.hud.toast(`Wheel landed on ${sector.label}! +● ${sector.value}`, "gold", "spin");
        } else if (sector.kind === "boost") {
          // The sector names the boost it pays. This used to arm a Sun Flask
          // whatever landed, so the wheel announced "Coin Magnet!" and handed
          // over a Sun Flask — the one place a reward must never be a different
          // thing from its label. `value` is a BoostDef id, and every wheel
          // sector's value is a real purchasable one.
          const boost = BOOSTS.find((b) => b.id === sector.value);
          if (!boost) break;
          this.save.grantBoost(boost.id);
          this.hud.toast(`Wheel landed on ${boost.name}! Armed for your next flight!`, "gold", "spin");
        } else if (sector.kind === "vault") {
          // The wheel is free, so this hatch is free. It used to call the 150
          // -coin purchase: a player who spun for nothing was either charged
          // 150 coins or told they had won a prize they never received.
          this.hatchMysteryVault();
          this.hud.toast(`Wheel landed on a Mystery Vault hatch!`, "gold", "castle");
        }
        this.audio.fanfare();
        this.bump();
        break;
      }
      case "smash-piggy": {
        const smashed = this.save.smashPiggyBank();
        if (smashed > 0) {
          this.audio.fanfare();
          this.hud.toast(`Smashed Piggy Bank! +● ${smashed} coins!`, "gold", "piggy");
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
          this.hud.toast(`Reborn with Solar Crown! Permanent ×${p.toFixed(1)} Coin Multiplier!`, "gold", "crown");
        } else {
          // The gate is five Nest levels, not a coin total — the old message sent
          // players after the wrong currency entirely.
          this.hud.toast("Solar Crown needs Nest Lv.5 — buy Nest upgrades to ascend", "warn");
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
            platform.measure("button", "results-coin-multiplier", "interact");
            this.setState("ad");
            this.telemetry.track("portal_break_request", { portal: platform.name, placement: "results-multiplier" });
            void this.multiplierWithPortalReward();
          } else {
            const bonus = this.runCoins * 2;
            this.multiplierClaimed = true;
            this.save.addCoins(bonus);
            this.audio.chapterFanfare();
            this.hud.toast(`3× flight bonus — +● ${bonus} coins`, "gold");
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
        if (intent === "lobby") { this.setScreen("challenges"); break; }
        if (intent === "pvp-options") {
          const circuit = pvpCircuitFor(id);
          if (circuit) {
            this.selectedPvpMode = circuit;
            this.mode = modeById(circuit);
            this.hud.toast(`${this.mode.name} selected — ranked, casual, a room, or the AI flock`, "gold", this.mode.icon);
          }
          this.setScreen("challenges");
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
        this.hud.toast(`AI PvP · ${m.name} vs the flock`, "info", "robot");
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
        if (this.state === "gameover") this.replayRun();
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
          // A restart is death-and-restart by another name, so it takes the
          // same break (Poki's event table). It carried `false` here while the
          // identical button on the recap passed `true`, so this whole class of
          // natural breaks — the ones a player makes without dying — signalled
          // nothing and could never be filled. The stop is already on the books
          // either way: `setState("ad")` sends it when we come from `playing`,
          // and the pause transition sent it when we come from `paused`.
          this.replayRun();
        }
        break;
      case "menu":
        // From a pause sub-screen, "Exit to menu" first closes the sub-screen so
        // the confirmation flow (goToMenu returns to menu state) starts clean.
        if (this.state === "paused") this.closePauseScreen();
        this.exitVersus();
        // Poki technical standard (Requirements → SDK integration):
        // commercialBreak() must fire only when exiting a pause and heading
        // back into gameplay — "leaving gameplay and going into a Level
        // selection = Wrong". Results→menu is exactly that navigation shape,
        // so no break fires here; the restart and resume placements carry the
        // commercial load.
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
      case "open-live":
        // First-visit milestone for the home walkthrough. `seenPvp` was
        // persisted but never written, so it could never be true; the panel
        // derived completion from counters that moved for unrelated reasons.
        if (!this.save.state.seenPvp) {
          this.save.state.seenPvp = true;
          this.save.persist();
          this.telemetry.track("onboarding_pvp_opened");
          this.hud.toast("Race Lobby — match up against real pilots on the same hills, ranked or casual", "gold", "flock");
        }
        // Human rivals. The Race Lobby is the matchmaking hub: quick match
        // against live pilots, the format/world picker, and the invite paths.
        this.setScreen("live");
        break;
      case "open-practice":
        // First-visit milestone for the home walkthrough. `seenPve` was
        // persisted but never written, so it could never be true; the panel
        // derived completion from counters that moved for unrelated reasons.
        if (!this.save.state.seenPve) {
          this.save.state.seenPve = true;
          this.save.persist();
          this.telemetry.track("onboarding_pve_opened");
          this.hud.toast("Practice Arena — fly with AI flocks, challenge ghosts, or run today's course solo", "quest", "bird");
        }
        // AI rivals. This is the same split the home menu shows — one tap to
        // a human lobby, one tap to the offline flock — so the two need
        // different screens. Pointing both at "challenges" left the AI
        // practice screen unreachable from anywhere and put the lobby two
        // levels deep behind the home menu.
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
      case "open-paywall":
        // Reachable on every build. The Coin Store sells Gold for coins on
        // Poki too (`buyCoinGold` has no edition gate), so a screen that can
        // only be entered by accident — and that then denies the purchase it
        // just honoured — was strictly worse than no screen.
        this.restoreMessage = "";
        this.setScreen("paywall");
        this.telemetry.track("paywall_open", { from: this.state });
        break;
      case "open-settings":
        // First-visit milestone for the home walkthrough. `seenSettings` was
        // persisted but never written, so it could never be true; the panel
        // derived completion from counters that moved for unrelated reasons.
        if (!this.save.state.seenSettings) {
          this.save.state.seenSettings = true;
          this.save.persist();
          this.telemetry.track("onboarding_settings_opened");
        }
        this.setScreen("settings");
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
        // Portal builds with CUSTOM_PILOT_NAMES allow free text, but the name is
        // broadcast to other players (netlib rosters, name tags) and persisted on
        // a public leaderboard, so every write passes the moderation pipeline in
        // ./pilotNameModeration. Direct/web builds own their surfaces.
        const freeText = CUSTOM_PILOT_NAMES;
        const requested = (this.hud.readValue("pilotName") || this.pilotName).trim();
        if (freeText) {
          const verdict = moderatePilotName(requested);
          if (!verdict.ok) {
            this.hud.toast(pilotNameRejection(verdict.reason), "warn");
            break;
          }
        }
        const chosen = freeText ? requested : generatePilotName();
        const next = savePilotName(chosen);
        this.pilotName = next;
        this.pilotNameChosen = true;
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
        this.pilotNameChosen = true; // an explicit roll outranks a portal name
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
        // One moderation pass, and the union narrows naturally. This used to
        // call `isPilotNameClean` and then `moderatePilotName` on the same
        // input and pick a copy with `verdict.ok ? … : …` — an arm that could
        // never be taken, since `isPilotNameClean` IS `moderatePilotName().ok`.
        const verdict = moderatePilotName(nameInput.trim());
        if (!verdict.ok) {
          this.hud.toast(pilotNameRejection(verdict.reason), "warn");
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
          this.hud.toast(`Too close to the sun, Icarus…`, "warn", "island");
        } else if (nameLower === "phoenix") {
          this.hud.toast(`Rise from the ashes, Phoenix!`, "gold", "fire");
        } else if (nameLower === "sunbird") {
          this.hud.toast(`You ARE the Sunbird.`, "gold", "star");
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
        this.pilotNameChosen = true; // explicit roll; never re-adopted from the portal
        this.save.state.pilotName = next;
        this.save.persist();
        this.bump();
        break;
      }
      case "portal-sign-in": {
        // Explicitly player-initiated, which is the only way Poki permits
        // `login()`: it may show a full-screen auth panel and reload the page.
        // Fire-and-forget from the (synchronous) action dispatcher.
        void this.signInToPortal();
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
        this.hud.toast(`Claimed ${reward.coins} Coins for ${reward.division.name} Rank!`, "achievement", "trophy");
        this.audio.fanfare();
        this.bump();
        break;
      }
      case "claim-cup": {
        const grants = this.cups.claim(id);
        if (!grants) break;
        this.applyPrizes(grants);
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
      case "throw-challenge": {
        // Challenge link: this exact seed + this run's distance (+ mode). Every
        // player becomes a course designer with a posted time. Native share
        // sheet on mobile (one-tap to any messenger), clipboard otherwise.
        // Gated behind the challengeShare flag so a rollout can be held back.
        if (!flag("challengeShare")) break;
        // Reported, not live: this mark is what a rival is asked to beat, so it
        // has to be the flight the results card and the score submission agree
        // on. The bird is still coasting under this very screen.
        const dist = Math.max(1, Math.round(this.reportedRunDistance(this.lastRunDistance())));
        const mode = flag("modeAwareChallenge") ? this.modeId : undefined;
        const url = buildChallengeUrl(this.seed, dist, this.pilotName, mode);
        const text = `Beat my ${dist} m flight on these hills → ${url}`;
        this.shareText(text, `${iconGlyph("swords")} Challenge link copied — send it to a rival`);
        this.telemetry.track("rival_thrown", { distance: dist, mode: this.modeId });
        break;
      }
      case "rematch": {
        // Same stakes, zero menu round-trips. An online race goes back through
        // the honest search so live pilots can seat into the next field; a duel
        // or an AI-flock race replays locally, exactly as it was flown.
        if (this.state !== "gameover") break;
        const opts = this.lastMatchOpts ?? { ranked: false, storm: false };
        if (this.duelActive || this.versus) this.replayRun();
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
      case "open-privacy": {
        // Privacy policy, opened through the platform adapter: on Poki that is
        // `PokiSDK.openExternalLink`, which opens the URL in Poki's own modal
        // instead of navigating the game frame away. Same-origin deploys get a
        // new tab. The page itself is `public/privacy.html` (SUBMISSION plan:
        // SUB-06 … SUB-08).
        const platform = this.platform;
        if (platform && platform.name !== "none") {
          platform.openExternalLink(PRIVACY_URL);
        } else {
          // Off-portal: a plain anchor click. Deliberately not window.open —
          // portal gates ban popups bundle-wide, and a synthesized link is the
          // same navigation without the popup semantics.
          const link = document.createElement("a");
          link.href = PRIVACY_URL;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        this.telemetry.track("privacy_open", { portal: platform?.name ?? "none" });
        break;
      }
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

  /**
   * The port ./actions/shop runs on.
   *
   * Spelled out rather than passing `this` because the class's members are
   * private, and a port typed as the whole class would not be a port. This is
   * the seam: every capability the shop's action table can reach is named
   * exactly once, right here, so the table's blast radius is greppable.
   */
  private shopContext(): ShopActionContext {
    return {
      save: this.save,
      hud: this.hud,
      audio: this.audio,
      particles: this.particles,
      bird: this.bird,
      telemetry: this.telemetry,
      platform: this.platform,
      shopAdClaimed: this.shopAdClaimed,
      checkoutBusy: this.checkoutBusy,
      adsLive: () => this.adsLive(),
      multiplyCoinsFromShopAd: () => this.multiplyCoinsFromShopAd(),
      setScreen: (screen) => this.setScreen(screen),
      backScreen: () => this.backScreen(),
      bump: () => this.bump(),
      buySkin: (id) => this.buySkin(id),
      buyBoost: (id) => this.buyBoost(id),
      buyTrail: (id) => this.buyTrail(id),
      armBoost: (id, n) => this.stageBoost(id, n),
      unarmBoost: (id, n) => this.save.unarmBoost(id, n),
      buyCoinStarter: () => this.buyCoinStarter(),
      buyCoinGold: () => this.buyCoinGold(),
      buyPortalVip: () => this.buyPortalVip(),
      buyMysteryVault: () => this.buyMysteryVault(),
      applySkin: () => this.applySkin(),
      restore: () => this.restore(),
      redeem: () => this.redeem(),
      redeemReferral: () => this.redeemReferral(),
      importCloud: () => this.importCloud(),
      copyWithFeedback: (text, copiedToast) => this.copyWithFeedback(text, copiedToast),
    };
  }

  /**
   * Shop + store/account actions (open-shop, buy/equip flows, referral, cloud
   * save). Returns true when the action was consumed. The table itself lives in
   * ./actions/shop behind a port interface, so it can be exercised with a fake
   * context instead of a live Game.
   */
  private handleShopEvent(action: string, id: string): boolean {
    return shopAction(this.shopContext(), action, id);
  }

  /**
   * Social/squad actions (squad hub, run sharing, pilot lookup, friends,
   * challenges, clubs, chat). Returns true when consumed. Extracted from
   * handleAction; same break-to-return-true transform as handleShopEvent.
   */
  /** A club/squad call that answers with a human-readable notice. Every one of
   *  them settled into the same two lines -- park the message, repaint the
   *  views -- and a route that forgot the repaint shipped a silent button. */
  private squadNotices(pending: Promise<string> | undefined): void {
    void pending?.then((msg) => {
      this.squadNotice = msg;
      this.bump();
    });
  }

  private handleSocialEvent(action: string, id: string): boolean {
    switch (action) {
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
        return true;
      case "squad-page": {
        const [kind, page] = id.split(":");
        this.squad?.setPage(kind, Number(page));
        return true;
      }
      case "squad-copy-code": {
        const code = this.squad?.state.myCode;
        if (code) void copyText(code).then(ok => {
          if (this.disposed) return;
          if (ok) this.hud.toast("Friend code copied", "info"); else this.hud.offerCopy(code);
        });
        return true;
      }
      case "squad-new-profile":
        void this.squad?.startNewProfile(this.hud.readChecked("squadRecoveryConsent"));
        return true;
      case "squad-refresh":
        this.squadNotice = "";
        void this.squad?.refresh();
        return true;
      case "share-run": {
        // Publish this run so a friend can race the same hills against our
        // mark. AUDS is Poki's store (it needs a Poki game id), so elsewhere
        // the button is not rendered and this is unreachable.
        if (this.runShareBusy) return true;
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
            this.hud.toast(`Run shared — send the code to a friend`, "gold", "check");
          } else {
            // Platform-neutral copy: this string ships in every edition, and
            // the isolation gates reject the platform's name in other builds.
            this.shareError = "Sharing isn't available in this build — no platform store is configured.";
          }
          this.bump();
        });
        return true;
      }
      case "copy-score": {
        const dist = Math.round(this.runStats().distance);
        const text = `I flew ${dist.toLocaleString()} m in Sunbird: Golden Flight! Can you beat it?`;
        void copyText(text).then((ok) => {
          if (this.disposed) return;
          this.hud.toast(ok ? "Score copied to clipboard!" : text, ok ? "gold" : "info");
        });
        return true;
      }
      case "copy-share": {
        if (!this.shareCode) return true;
        const code = this.shareCode;
        void copyText(code).then((ok) => {
          if (this.disposed) return;
          this.hud.toast(ok ? `Run code ${code} copied` : `Run code: ${code}`, ok ? "gold" : "info");
        });
        return true;
      }
      case "load-run": {
        const code = this.hud.readValue("shareCode").trim();
        if (!code) return true;
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
          this.hud.toast(`${run.name} flew ${run.distance.toLocaleString()} m here — beat it`, "quest", "swords");
          this.telemetry.track("shared_run_loaded", { mode: this.modeId, distance: run.distance });
          this.bump();
        });
        return true;
      }
      case "race-share": {
        if (!this.sharedRun) return true;
        this.exitVersus();
        this.startRun();
        return true;
      }
      case "pilot-lookup": {
        // Real lookup: the panel shows the directory's answer, including
        // "no pilot with that code" and "this build is offline".
        const code = this.hud.readValue("pilotCode").trim().toUpperCase();
        void this.squad?.lookupPilot(code).then(() => this.bump());
        return true;
      }
      case "pilot-add": {
        const code = id || this.squad?.state.lookup?.code || this.hud.readValue("pilotCode");
        this.squadNotices(this.squad?.addFriend(code));
        return true;
      }
      case "pilot-copy": {
        const code = id || this.squad?.state.lookup?.code || "";
        if (!code) return true;
        void copyText(code).then((ok) => {
          if (this.disposed) return;
          this.hud.toast(ok ? `Pilot code ${code} copied` : "Copy the code from the field", "info");
        });
        return true;
      }
      case "pilot-invite":
      case "mate-invite": {
        // Inviting a wingman is the same real artefact as inviting anyone:
        // the room's invite link. No room yet → say so instead of pretending.
        const who = id || "your wingman";
        if (!this.roomCode) {
          this.hud.toast("Create a private room first — then invites are one tap", "info");
          return true;
        }
        void this.invitePilot(this.roomCode, who);
        return true;
      }
      case "mate-wingman": {
        const name = id;
        if (name) this.squadNotice = this.squad?.rememberWingman(name) ?? "";
        this.bump();
        return true;
      }
      case "mate-forget": {
        if (id && this.pilots.forget(id)) {
          this.hud.toast(`Forgot ${id}`, "info");
          this.bump();
        }
        return true;
      }
      case "req-accept":
        void this.squad?.respondRequest(id, true);
        return true;
      case "req-decline":
        void this.squad?.respondRequest(id, false);
        return true;
      case "req-cancel":
        void this.squad?.cancelRequest(id);
        return true;
      case "squad-add": {
        // Kept for older builds/links that still post a bare code.
        const code = (this.hud.readValue("squadCode") || this.hud.readValue("pilotCode")).trim().toUpperCase();
        if (!code) return true;
        this.squadNotices(this.squad?.addFriend(code));
        return true;
      }
      case "squad-remove":
        void this.squad?.removeFriend(id);
        return true;
      case "friend-challenge": {
        // Post a ghost-race challenge (SocialSystem.FriendChallenge) at a
        // wingman: today's hills, your current best as the line to beat.
        const friend = this.squad?.state.friends.find((f) => (f.code || f.name) === id);
        if (!friend) return true;
        const best = this.save.state.bestDistance;
        if (best <= 0) {
          this.squadNotice = "Fly at least once before you can post a ghost challenge.";
          this.bump();
          return true;
        }
        const ch = this.social.createChallenge(friend.code || friend.name, friend.name, "distance", best, this.today, best);
        this.squadNotice = ch
          ? `${iconGlyph("ghost")} Ghost challenge posted for ${friend.name} — beat ${Math.round(best)} m on today's hills`
          : `${friend.name} already has a pending challenge from you.`;
        this.bump();
        return true;
      }
      case "challenge-race": {
        const ch = this.social.getActiveChallenges().find((c) => c.id === id);
        if (!ch) return true;
        this.beginFriendChallengeRace(ch);
        return true;
      }
      case "squad-create-club": {
        const name = this.hud.readValue("clubName").trim();
        if (!name) {
          this.hud.toast("Give your club a name first", "info");
          return true;
        }
        this.squadNotices(this.squad?.createClub(name, "Fly together, land badly"));
        return true;
      }
      case "squad-join-club":
        this.squadNotices(this.squad?.joinClub(parseInt(id, 10) || 0));
        return true;
      case "squad-leave-club":
        void this.squad?.leaveClub();
        return true;
      case "squad-chat": {
        // Portal editions ship without a chat surface (Poki REQ-31: no chat in
        // multiplayer surfaces; emotes are the sanctioned alternative). The
        // action stays for the direct build; here it can only be reached by a
        // stale DOM node.
        if (!SQUAD_CHAT) return true;
        const text = this.hud.readValue("chatText");
        void this.squad?.sendChat(text).then(sent => {
          if (sent && this.hud.readValue("chatText") === text) this.hud.clearValue("chatText");
          this.bump();
        });
        return true;
      }
      case "claim-squad-quest": {
        const quest = SQUAD_QUESTS.find((q) => q.id === id);
        // An unknown id paid a flat 100 before; nothing to pay it from.
        if (!quest) return true;
        if (!this.save.state.squadQuestsClaimed) this.save.state.squadQuestsClaimed = {};
        // Re-validate here, not at the button. Every other claim path in the
        // game does this; this one used to trust the UI, so a lifetime
        // milestone guarded only per-day paid out again every day forever.
        const state = squadQuestClaimState(quest, this.squadQuestProgressInput(), this.save.state.squadQuestsClaimed, this.today);
        if (state === "already-claimed") {
          this.hud.toast(
            squadQuestScope(quest) === "lifetime"
              ? t("hud.squad.questClaimedLifetime", undefined, "Already claimed — this one is a lifetime goal.")
              : t("hud.squad.questClaimedToday", undefined, "Already claimed today!"),
            "info",
          );
          return true;
        }
        if (state === "not-complete") {
          this.hud.toast(t("hud.squad.questNotComplete", undefined, "Not finished yet."), "info");
          return true;
        }
        this.save.state.squadQuestsClaimed[quest.id] = this.today;
        this.save.addCoins(quest.rewardCoins);
        this.audio.chapterFanfare();
        this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
        this.hud.toast(
          `${iconGlyph("star")} ` + t("hud.squad.questClaimed", { coins: String(quest.rewardCoins) }, "Squadron Goal Claimed! +{{coins}} coins!"),
          "gold",
        );
        this.bump();
        return true;
      }
      case "squad-autonomous": {
        this.squad?.enableAutonomous();
        this.squadNotice = "⚡ Autonomous Squadron Hub active!";
        this.audio.chapterFanfare();
        this.bump();
        return true;
      }
      default:
        return false;
    }
  }

  /** The port ./actions/settings runs on.
   *
   *  Only `resetArmed` and `resetTimer` are writable, and only for the
   *  two-tap progress reset — see the accessor note in journeyContext.
   *  Everything else either is a shared object mutated by reference
   *  (`save.state.settings.*`) or is called. */
  private settingsContext(): SettingsActionContext {
    // See journeyContext: arrow accessors stand in for a `this` alias so the
    // object-literal getters can still read and write the live Game fields.
    const readResetArmed = () => this.resetArmed;
    const writeResetArmed = (value: boolean) => {
      this.resetArmed = value;
    };
    const readResetTimer = () => this.resetTimer;
    const writeResetTimer = (value: number) => {
      this.resetTimer = value;
    };
    return {
      save: this.save,
      hud: this.hud,
      audio: this.audio,
      telemetry: this.telemetry,
      get resetArmed() {
        return readResetArmed();
      },
      set resetArmed(value) {
        writeResetArmed(value);
      },
      get resetTimer() {
        return readResetTimer();
      },
      set resetTimer(value) {
        writeResetTimer(value);
      },
      applySettings: () => this.applySettings(),
      applySkin: () => this.applySkin(),
      bump: () => this.bump(),
    };
  }

  /** Settings + danger-zone actions (every `set-*` toggle, the volume/track
   *  selectors, and the two-tap progress reset). Returns true when consumed;
   *  the table itself lives in ./actions/settings behind a port, so the
   *  toggles can be tested without a live Game. */
  private handleSettingsEvent(action: string, id: string): boolean {
    return settingsAction(this.settingsContext(), action, id);
  }

  /**
   * Room + matchmaking actions (host/join/configure rooms, format/world
   * pickers, quick match, lobby readiness, AI/practice entries). Returns true
   * when consumed. Extracted from handleAction; same break-to-return-true
   * transform as the shop/social/settings sub-handlers.
   */
  private handleRoomEvent(action: string, id: string): boolean {
    switch (action) {
      case "host-room": {
        if (!isMultiplayerConfigured()) {
          this.hud.toast("Live rooms are not available in this edition", "warn");
          return true;
        }
        this.disconnectRace();
        this.localRace = false;
        // No invented code. The Poki transport creates the lobby and reports
        // the code back (see `hostingLobby`), so this stays "" until then and
        // `pumpNetwork` adopts the real one.
        this.roomCode = "";
        this.hostingLobby = true;
        this.joiningRemoteRoom = false;
        this.modeId = this.selectedPvpMode;
        this.mode = modeById(this.selectedPvpMode);
        this.rankedRace = false;
        this.setScreen("live");
        this.preseatLobby();
        this.hud.toast(t("hud.room.creating", undefined, "Creating your room — the code appears in a moment"), "gold");
        this.bump();
        return true;
      }
      case "join-room": {
        if (!isMultiplayerConfigured()) {
          this.hud.toast("Live rooms are not available in this edition", "warn");
          return true;
        }
        const code = normalizeRoomCode(this.hud.readValue("roomCode"));
        if (!code) {
          this.hud.toast("Enter a 5-letter room code", "warn");
          return true;
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
        return true;
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
        // Read "were we seated" BEFORE cancelMatchmaking(), which now clears the
        // room code. Re-hosting is a create-and-read-the-code request, so the
        // code is minted by the transport rather than invented here.
        const wasSeated = Boolean(this.roomCode) || Boolean(this.mmOpts);
        if (wasSeated) {
          this.cancelMatchmaking();
          this.disconnectRace();
          this.roomCode = "";
          this.hostingLobby = true;
          this.preseatLobby();
          this.hud.toast(`New ${this.mode.name} room — the code appears in a moment`, "gold", this.mode.icon);
        }
        this.hud.toast(`${this.mode.name}`, "gold", this.mode.icon);
        this.bump();
        return true;
      }
      case "select-pvp-world": {
        const wId = id || "emerald";
        this.selectedPvpWorld = wId;
        this.selectedCourse = PVP_WORLDS.find((w) => w.id === wId) ?? PVP_WORLDS[0]!;
        // Same reseed safety as select-pvp-mode: changing the world while
        // seated pins a fresh room code so the seed reflects the new course.
        const wasSeated = Boolean(this.roomCode) || Boolean(this.mmOpts);
        if (wasSeated) {
          this.cancelMatchmaking();
          this.disconnectRace();
          this.roomCode = "";
          this.hostingLobby = true;
          this.preseatLobby();
          this.hud.toast(`New ${this.selectedCourse.name} room — the code appears in a moment`, "gold", this.selectedCourse.emoji);
        }
        this.hud.toast(`${this.selectedCourse.name}`, "gold", this.selectedCourse.emoji);
        this.bump();
        return true;
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
        this.hud.toast(`${m.name} on ${w.name}`, "gold", "dice");
        this.bump();
        return true;
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
        return true;
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
        return true;
      }
      case "copy-invite": {
        if (this.roomCode) this.copyRoomInvite(this.roomCode);
        else this.hud.toast("Host a room first to get an invite link", "warn");
        return true;
      }
      case "start-room":
      case "ready-room": {
        // No room yet means "host one". Inventing a code here read as a join
        // request for a room that does not exist; see `hostingLobby`.
        if (!this.roomCode) {
          this.roomCode = "";
          this.hostingLobby = true;
        }
        this.modeId = this.selectedPvpMode;
        this.mode = modeById(this.selectedPvpMode);
        this.rankedRace = false;
        this.preseatLobby();
        if (this.net) {
          const isReady = !this.net.info().ready;
          // `sendReady` returns false when the transport is not in the lobby
          // (still connecting, or already errored). Ignoring that made the
          // button a liar: the tap did nothing and the toast said "You are
          // ready!" anyway.
          if (this.net.sendReady(isReady)) {
            this.hud.toast(isReady ? "You are ready!" : "Ready cancelled", "gold", "check");
          } else {
            this.hud.toast(t("hud.room.notReadyYet", undefined, "The room is not ready for you yet"), "warn");
          }
        } else {
          this.hud.toast("Starting race flock…", "info");
          this.launchMatch({ ranked: false, storm: this.modeId === "pvp_typhoon" }, true);
        }
        this.bump();
        return true;
      }
      case "quick-match":
      case "pvp-ranked":
        this.beginMatchmaking({ ranked: true, storm: false });
        return true;
      case "pvp-storm":
        this.beginMatchmaking({ ranked: true, storm: true });
        return true;
      case "mm-cancel":
        this.cancelMatchmaking();
        return true;
      case "mm-ready": {
        // Explicit opt-in to a live start. The race launches only once every
        // seated pilot is ready, then counts down 6s for everyone.
        if (this.net?.state === "lobby") {
          const nowReady = !this.net.info().ready;
          // Same guard as `ready-room`: never confirm a ready-up that was
          // refused.
          if (!this.net.sendReady(nowReady)) {
            this.hud.toast(t("hud.room.notReadyYet", undefined, "The room is not ready for you yet"), "warn");
            return true;
          }
          this.hud.toast(nowReady ? "You are ready!" : "Ready cancelled", "gold", "check");
          this.bump();
        }
        return true;
      }
      case "mm-ai":
        // Explicit opt-in only: the search never drops a pilot into a bot race.
        this.takeAiFlock();
        return true;
      case "mm-keep-search":
        this.keepSearching();
        return true;
      case "pvp-duel":
        this.roomCode = "";
        this.modeId = "massrace";
        this.mode = modeById("massrace");
        this.rankedRace = false;
        this.startRun({ duel: true });
        return true;
      case "room-size": {
        const n = Math.max(5, Math.min(40, parseInt(id || "40", 10) || 40));
        this.roomSize = n;
        this.hud.toast(`Field size · ${n} rivals`, "info");
        this.bump();
        return true;
      }
      case "room-skill":
        this.roomSkill = (id as "chill" | "sharp" | "ace") || "sharp";
        this.massRace.setFieldSkill(this.roomSkill === "ace" ? 1.25 : this.roomSkill === "chill" ? 0.7 : 1);
        this.hud.toast(`Rival skill · ${this.roomSkill}`, "info");
        this.bump();
        return true;
      case "room-shuffle":
        this.massRace.shuffle(`${this.seed}:${this.modeId}`);
        this.hud.toast("Field shuffled", "info");
        this.audio.ding();
        this.bump();
        return true;
      case "room-kick":
        if (this.massRace.kick(id)) {
          this.hud.toast("Pilot removed from room", "warn");
          this.audio.butter();
        } else {
          this.hud.toast("Pilot already gone", "warn");
        }
        this.bump();
        return true;
      case "room-mute":
        this.roomMuted = !this.roomMuted;
        this.hud.toast(this.roomMuted ? "Emotes muted" : "Emotes on", "info");
        this.bump();
        return true;
      case "room-close":
        this.cancelMatchmaking();
        this.disconnectRace();
        this.massRace.clear();
        this.roomCode = "";
        this.joiningRemoteRoom = false;
        this.hud.toast("You left the room", "info");
        this.bump();
        return true;
      case "practice-race":
        this.roomCode = "";
        this.launchMatch({ ranked: false, storm: false }, true);
        return true;
      case "pvp-casual":
        this.beginMatchmaking({ ranked: false, storm: false });
        return true;
      case "pvp-practice":
        this.exitVersus();
        this.modeId = "daytrip";
        this.mode = modeById("daytrip");
        // The primary "Fly now" CTA on the home menu — dismisses the Daily
        // Login Ritual banner for the rest of today, same as the explicit X.
        this.dismissedDailyPrompt = true;
        this.startRun();
        return true;
      case "dismiss-daily-banner":
        this.dismissedDailyPrompt = true;
        this.bump();
        return true;
      case "start-endless":
        this.exitVersus();
        this.modeId = "endless";
        this.mode = modeById("endless");
        this.startRun();
        return true;
      case "open-rank":
        this.setScreen("rank");
        return true;
      case "back":
        this.backScreen();
        return true;
      default:
        return false;
    }
  }

  /**
   * Timed journey actions (daily challenge, weekly gauntlet, login calendar,
   * live events, campaign chapters, daily stipend). Returns true when
   * consumed. Extracted from handleAction; same break-to-return-true
   * transform as the other sub-handlers.
   */
  /** The port ./actions/journey runs on. Spelled out so the table's blast
   *  radius stays greppable; see shopContext for the same reasoning.
   *
   *  `modeId` and `mode` are accessors, not copies. The table *selects* a
   *  flight mode, so it has to write back through to the game — a plain
   *  `modeId: this.modeId` would typecheck cleanly and then silently drop
   *  every write onto the throwaway context object. The shop table gets away
   *  with plain members only because it mutates through `ctx.save` and
   *  everything else on that port is readonly. */
  private journeyContext(): JourneyActionContext {
    // Arrow accessors, not a `const self = this` alias: an object-literal getter
    // has its own `this`, so the accessors below cannot reach the Game through
    // it. Each arrow closes over the enclosing `this` and the getter calls
    // through, which keeps the write-through semantics without the alias.
    const readModeId = () => this.modeId;
    const writeModeId = (value: JourneyActionContext["modeId"]) => {
      this.modeId = value;
    };
    const readMode = () => this.mode;
    const writeMode = (value: JourneyActionContext["mode"]) => {
      this.mode = value;
    };
    return {
      save: this.save,
      hud: this.hud,
      audio: this.audio,
      particles: this.particles,
      bird: this.bird,
      today: this.today,
      get modeId() {
        return readModeId();
      },
      set modeId(value) {
        writeModeId(value);
      },
      get mode() {
        return readMode();
      },
      set mode(value) {
        writeMode(value);
      },
      todaysDaily: () => this.todaysDaily(),
      exitVersus: () => this.exitVersus(),
      startRun: (opts) => this.startRun(opts),
      setScreen: (screen) => this.setScreen(screen),
      bump: () => this.bump(),
    };
  }

  /** Journey + challenge actions. The table lives in ./actions/journey.
   *  Returns true when the action was consumed. */
  private handleJourneyEvent(action: string, id: string): boolean {
    return journeyAction(this.journeyContext(), action, id);
  }

  /**
   * Run-continuation + break + season-pass actions (second-wind offers, ad
   * break endings, pass claims). Returns true when consumed. Extracted from
   * handleAction; same break-to-return-true transform as the other
   * sub-handlers.
   */
  private handleContinueEvent(action: string, id: string): boolean {
    switch (action) {
      case "continue-coins":
        if (this.state === "continue" && this.save.spend(CONTINUE_COST)) this.doContinue("coins");
        return true;
      case "continue-ad":
        if (this.state === "continue") {
          if (this.portalEnabled() && !this.adsLive()) {
            // Unreachable while `canAd` gates the offer, and deliberately not
            // silent: a tap that does nothing is the worst outcome available.
            this.hud.toast("Ads aren't available right now — second wind costs coins", "info");
          } else if (this.portalEnabled()) {
            // Poki game-events: the player chose the rewarded option. The label
            // matches the `visible` event for the same offer kind (REQ-14).
            const kind = this.continueOfferView?.kind ?? "standard";
            this.platform?.measure("button", continuePlacementLabel(kind), "interact");
            void this.continueWithPortalReward();
          } else {
            this.adReason = "continue";
            this.adTimer = this.ads.duration;
            this.telemetry.track("ad_shown", { reason: "continue" });
            this.setState("ad");
          }
        }
        return true;
      case "continue-gold":
        if (this.state === "continue" && this.save.state.gold) this.doContinue("gold");
        return true;
      case "continue-sleep":
        if (this.state === "continue") this.finishRun();
        return true;
      case "ad-stuck":
        // The ad screen would otherwise render with ZERO buttons on a portal
        // build (both ad-skip and ad-gold are false there) and a frozen bar for
        // the whole safety window. This returns the run — but ONLY once the
        // break has demonstrably failed.
        //
        // It used to fire on the first frame of every break, which made it a
        // one-click skip of a real portal ad: the game tore down its own ad
        // state while the portal's ad was still on screen. The guard is
        // duplicated here rather than trusted to the disabled attribute in the
        // view, because a disabled button is a rendering detail and an action
        // handler is the contract. Nothing is granted on this path either way.
        if (!adEscapeArmed(this.adWallClock, AD_SAFETY_SECONDS)) return true;
        this.telemetry.track("ad_escape_hatch", { reason: this.adReason, portal: this.platform?.name ?? "none" });
        this.endPortalAd();
        this.hud.toast("Returned to your flight", "info");
        return true;
      case "ad-skip":
        // Retained as an explicit no-op, not deleted.
        //
        // There is no longer any surface that dispatches this: the placeholder
        // panel renders a read-only countdown chip, and a placeholder break
        // ends itself the moment its timer lands (see fixedUpdate). Keeping
        // the case means a stray dispatch — a cached view, a deep link, a
        // console call, a future refactor that re-adds the button — is
        // swallowed here rather than falling through to whatever `default`
        // does next year. A portal break was never endable this way and still
        // is not.
        return true;
      case "ad-gold":
        // The upsell must not be an ad-skip. This button used to end the break
        // immediately (finishRun/gameover + paywall), so a player could dismiss
        // every sponsored break without it ever playing — the break was skipped
        // for free and the offer was never actually taken. It now waits out the
        // same timer as `ad-skip`, so the ad always runs; the player still keeps
        // the shortcut to the offer afterwards.
        if (this.state === "ad" && adBreakCanEnd(this.portalEnabled(), this.adTimer)) {
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
        return true;
      case "claim-pass-free":
        this.claimPass(Number(id), "free");
        return true;
      case "claim-pass-premium":
        this.claimPass(Number(id), "premium");
        return true;
      default:
        return false;
    }
  }

  private handleHotkeys(): void {
    // A live break owns the screen. Keyboard is a separate path from
    // handleAction, so adBreakAllowsAction never saw these: ESC/P and R had
    // their own route into backScreen()/replayRun() that did not go past the
    // ad gate. Mute and fullscreen are deliberately still allowed — neither
    // shortens the break, and Poki expects a player to be able to silence a
    // game at any time.
    if (this.state === "ad") {
      this.input.consumePause();
      this.input.consumeRestart();
    }
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
        this.replayRun();
      } else if (this.state === "playing" || this.state === "paused") {
        // Same break as the recap's restart: R abandons the current run for a
        // fresh one, which is intent to keep playing. See "restart-flight".
        this.replayRun();
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
      // Quitting a ranked duel mid-flight counts as the loss it is — no timer
      // floor: finishRun records short duels as losses unconditionally, and a
      // 3s grace here would let a losing duelist dodge rating by quitting fast.
      if (this.duelActive && this.duelResult === "" && !this.runRecorded) {
        const res = this.save.recordDuelResult(false, this.today);
        this.hud.toast(`Duel forfeited · ${res.delta} rating`, "warn", "swords");
      }
      // A graceful retreat still deserves a punchline.
      this.hud.quip(quip(SURRENDER_QUIPS, Math.round(this.bird.x)), "cloud");
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
    // Back to the menu: never the name gate. This one was not even conditional
    // on the edition, so a player who returned to the menu before choosing a
    // name was re-intercepted here even after the first-use path stopped.
    this.setScreen("main");
    this.camera.setIntro(1);
  }

  /**
   * Attempts to spend `price`; on success returns false. On failure it toasts
   * how many more coins are needed and returns true, so a call site can just
   * write `if (this.cantAfford(price)) return;`.
   */
  private cantAfford(price: number): boolean {
    if (this.save.spend(price)) return false;
    this.hud.toast(`Need ${price - this.save.state.wallet} more coins`, "warn");
    return true;
  }

  private buySkin(id: string): void {
    const def = skinById(id);
    const st = this.save.state;
    if (def.prizeOnly && !st.ownedSkins.includes(id)) {
      this.hud.toast(`Earn it: ${def.prizeOnly}`, "info", "trophy");
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
    if (this.cantAfford(price)) return;
    this.save.ownSkin(id);
    this.save.equipSkin(id);
    this.applySkin();
    this.audio.purchase();
    this.hud.toast(`${def.name} is yours!`, "gold");
    this.telemetry.track("skin_bought", { id, price });
    this.bump();
  }

  /**
   * Stage copies of a booster for the next flight, respecting the slot cap.
   *
   * The cap is enforced HERE, not in the loadout markup. A cap that only
   * disables a button is a cap the player can walk around, and the loadout is
   * the one place where "stack every Shield you own" would otherwise be
   * strictly optimal. The UI reads the same number, so button and rule agree.
   */
  private stageBoost(id: string, n: number): number {
    const def = BOOSTS.find((b) => b.id === id);
    if (!def || def.permanent) return 0;
    // The SAME freeSlots() the loadout screen uses to decide whether `+` is
    // live. The cap is enforced here because a cap that only hides a button is
    // a cap the player can walk around; sharing the arithmetic is what keeps
    // the guard and the button from disagreeing about how full the loadout is.
    const room = freeSlots(
      BOOSTS.filter((b) => !b.permanent).map((b) => this.save.boostArmed(b.id)),
    );
    if (room <= 0) {
      this.hud.toast(t("hud.loadout.SlotsFull", undefined, "All boost slots are full — unstage one first."), "info");
      return 0;
    }
    const moved = this.save.armBoost(id, Math.min(n, room));
    if (moved <= 0) this.hud.toast(t("hud.loadout.NoneLeft", undefined, "No more of that in the store."), "info");
    return moved;
  }

  private buyBoost(id: string): void {
    const def = BOOSTS.find((b) => b.id === id);
    if (!def) return;
    if (def.permanent && this.save.hasUpgrade(id)) {
      this.hud.toast("Already unlocked", "info");
      return;
    }
    const deal = dailyDealBoost(this.today);
    const price = def.id === deal.id ? deal.price : def.price;
    if (this.cantAfford(price)) return;
    if (def.permanent) {
      this.save.ownUpgrade(id);
    } else {
      // Buying adds to storage; the loadout screen decides what flies. The
      // old code refused a second copy outright ("Already armed"), which made
      // "stock a few for later" impossible.
      this.save.stockBoost(id);
      this.save.armBoost(id, 1);
    }
    this.audio.purchase();
    this.hud.toast(`${def.name} ${def.permanent ? "unlocked" : "armed"}`, "power", def.icon);
    this.telemetry.track("boost_bought", { id, price });
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
    if (this.cantAfford(def.price)) return;
    this.save.ownTrail(id);
    this.save.equipTrail(id);
    this.audio.purchase();
    this.hud.toast(`${def.label} trail is yours!`, "gold");
    this.telemetry.track("trail_bought", { id, price: def.price });
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
    this.hud.toast(`First Flight Pack · ${STARTER_PACK.price} — 1,200 coins + Goldleaf trail`, "gold", "star");
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
    this.save.grantBoost("sunflask");
    this.audio.fanfare();
    this.hud.toast(`First Flight Pack — +${STARTER_PACK.coins} coins, Goldleaf trail, Sun Flask armed`, "gold", "star");
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
    } else {
      // Coins only. The gold and vip arms that used to live here granted paid
      // entitlements from a table that ships in the bundle — see `Promo`.
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
      //
      // The distance is the REPORTED one, not the bird's live position: this
      // button lives on the results card, the bird is still coasting under it,
      // and a share that claimed a longer flight than the results card (and the
      // leaderboard submission) is the game overstating a score in public.
      const dist = this.reportedRunDistance(this.lastRunDistance());
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
          if (!this.disposed) this.hud.toast("Shared!", "gold");
          return;
        }
      }
      // Portal builds must not initiate downloads, so `allowDownload` is the
      // negation of "we are on a portal" — not the portal flag itself.
      const result = await shareOrDownload(card, undefined, !this.portalEnabled());
      this.telemetry.track("share_run", { result });
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
    this.hud.toast("Welcome to Gold", "gold", "crystal");
    this.telemetry.track("gold_granted", { source });
    this.bump();
  }

  /** Charges a coin price, or tells the player the shortfall and reports
   *  false. The guard, the shortfall arithmetic and the toast were written out
   *  four times over the coin sinks (gold, starter pack, VIP, mystery vault)
   *  with the same wording, so a change to any of them had to be made four
   *  times over and could silently drift between them. */
  private spendCoins(price: number): boolean {
    if (this.save.spend(price)) return true;
    this.hud.toast(`Need ● ${(price - this.save.state.wallet).toLocaleString()} more coins`, "info");
    return false;
  }

  /** The state a VIP purchase actually turns on. Both routes to VIP ran this
   *  same sequence before diverging for their own toast and telemetry line, so
   *  a fix to one of them (the daily claim, the confetti anchor) had to be
   *  repeated in the other to stay honest. */
  private applyVipEntitlement(): void {
    this.save.grantVip();
    this.vipActive = true;
    this.vipExpiredNotice = false;
    this.save.ownSkin("aurora");
    this.save.claimVipDaily(this.today);
    this.audio.purchase();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
  }

  private grantVip(source: string): void {
    this.applyVipEntitlement();
    this.hud.toast("Welcome to VIP", "vip", "crown");
    this.telemetry.track("vip_granted", { source });
    this.bump();
  }

  /** Portal editions convert VIP into an in-game coin sink, with a rewarded
   * ad route for players who are short. This keeps checkout out of iframe
   * portals while giving the portal a clear, opt-in monetisation moment. */
  private buyCoinGold(): void {
    if (this.save.state.gold) return;
    if (!this.spendCoins(GOLD.coinPrice)) return;
    this.grantGold("coin_purchase");
  }

  private buyCoinStarter(): void {
    if (this.save.state.starterPack) return;
    if (!this.spendCoins(STARTER_PACK.coinPrice)) return;
    this.grantStarter("coin_purchase");
  }

  private buyPortalVip(): void {
    const price = VIP.coinPrice;
    if (!this.spendCoins(price)) return;
    this.applyVipEntitlement();
    this.hud.toast("VIP flight unlocked with coins", "vip", "crown");
    this.telemetry.track("vip_granted", { source: "portal_coins", price });
    this.bump();
  }

  private buyMysteryVault(): void {
    if (!this.spendCoins(150)) return;
    this.hatchMysteryVault();
  }

  /**
   * The vault's actual payout.
   *
   * Split out of `buyMysteryVault` so the free wheel spin can hatch WITHOUT
   * charging 150 coins — a free daily reward that debits the wallet is not a
   * reward.
   */
  private hatchMysteryVault(): void {
    const rng = Math.random();
    this.audio.fanfare();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);

    const unownedSkins = SKINS.map((s: SkinDef) => s.id).filter((id: string) => !this.save.state.ownedSkins.includes(id));
    // Trails are owned in `tournaments.trails` (SaveData.ownTrail writes there,
    // and the Tournaments screen equips from the same list). This used to check
    // `ownedUpgrades`, which only ever holds `doubletap` and `goldenfeather` —
    // so the filter was always true, and the vault kept re-awarding a trail the
    // player had already paid for while announcing a hatch for it.
    const unownedTrails = SHOP_TRAILS.map((t: ShopTrailDef) => t.id).filter(
      (id: string) => !this.save.state.tournaments.trails.includes(id),
    );

    if (rng < 0.35 && unownedSkins.length > 0) {
      const pick = unownedSkins[Math.floor(Math.random() * unownedSkins.length)]!;
      this.save.ownSkin(pick);
      const skinDef = skinById(pick);
      this.hud.toast(`Vault Hatched: ${skinDef.name} Bird Skin!`, "gold", "egg");
      this.audio.eggHatch();
    } else if (rng < 0.70 && unownedTrails.length > 0) {
      const pick = unownedTrails[Math.floor(Math.random() * unownedTrails.length)]!;
      this.save.ownTrail(pick);
      this.hud.toast(`Vault Hatched: ${pick.replace("trail_", "").toUpperCase()} Trail!`, "gold", "egg");
      this.audio.eggHatch();
    } else {
      const reward = 300 + Math.floor(Math.random() * 300);
      this.save.addCoins(reward);
      this.hud.toast(`Vault Jackpot: +● ${reward} bonus coins!`, "gold", "egg");
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
    this.terrain = new TerrainSystem(seed, worldTierFor(this.deviceProfile.tier));
    this.scene.add(this.terrain.group);
    this.collect = new Collectibles(this.terrain.seedN, undefined, worldTierFor(this.deviceProfile.tier));
    this.scene.add(this.collect.group);
    this.weather = new Weather(this.terrain.seedN);
    this.weather.addTo(this.scene);
    this.resetRun(true);
  }

  /* --------------------------------------------------------------- helpers */

  get socialSystem(): SocialSystem {
    return this.social;
  }

  /**
   * Launch a solo flight whose point is beating a friend's ghost-race
   * challenge (SocialSystem.FriendChallenge). Rebuilds the world onto the
   * challenge's exact seed so the hills match what the challenger flew, then
   * `resetRun` (via `startRun`) synthesizes the chase ghost from
   * `ghostSeed`/`ghostDistance` — see the `activeFriendChallenge` branch
   * above.
   */
  private beginFriendChallengeRace(ch: FriendChallenge): void {
    // completeChallenge() only resolves an "accepted" challenge — a pending
    // one (just created, or re-opened from the Squad screen) is accepted the
    // moment the player commits to racing it.
    if (ch.status === "pending") this.social.acceptChallenge(ch.id);
    this.activeFriendChallenge = ch;
    this.modeId = "daytrip";
    this.mode = modeById("daytrip");
    this.seedMode = "random"; // keep startRun() from reseeding onto today's world
    this.exitVersus();
    if (this.seed !== ch.ghostSeed) this.rebuildWorld(ch.ghostSeed);
    this.startRun();
    this.bump();
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
    if (this.fairRace) return skinById("sunbird");
    // Ranked 1v1 duels swing rating against a seeded-difficulty opponent
    // (see `duelActive`), so a bought or earned bird's speed/fever/daylight
    // perks are capped instead of left full — same fairness goal as
    // `fairRace`, but a modest cap rather than a hard reset to Sunbird, so
    // the cosmetic still feels like an upgrade without deciding the result.
    if (this.duelActive) return normalizePerks(this.skin, true);
    return this.skin;
  }

  /** Speed boost for modes with `escalate: true`. Grows with island index and
   *  time so Endless mode feels genuinely harder as you go deeper. */
  private escalateMult(): number {
    if (!this.mode.escalate) return 1;
    return endlessSpeedScale(this.island, this.runTime);
  }

  private daylightMax(): number {
    const base =
      (this.save.state.gold && !this.fairRace ? DAYLIGHT_MAX_GOLD : DAYLIGHT_MAX) +
      this.gameplaySkin.daylightBonus +
      this.masteryPerk.daylightBonus +
      this.climbDaylight +
      this.boostDaylight;
    // A mode that hands the player a 90 s day must not have that silently
    // clipped back to 52 s at the first island — that is what used to happen,
    // and in Distance mode it quietly destroyed 23 s the moment you cleared
    // island 0. The cap is a ceiling on REFILL, not a ceiling on the run's
    // own starting budget.
    return Math.max(base, this.mode.clock);
  }

  private applySkin(): void {
    const s = this.skin;
    this.bird.applySkin({ body: s.body, wing: s.wing, belly: s.belly, beak: s.beak });
    // Species as well as colour. The shop draws this bird's silhouette from the
    // same enum (see Sunbird.skinShape), so the bird in the hangar and the bird
    // in the sky are one animal instead of the same oval in two places.
    this.bird.setShape(skinShape(s));
  }

  /**
   * Bloom is the expensive effect: desktop only, never under reduced-motion (a
   * steady glow reads as flicker to some players), and never in split-screen.
   * Split-screen draws two viewports from one scene, so a full-screen post pass
   * costs roughly double at exactly the moment the GPU is busiest.
   */
  private bloomEligible(): boolean {
    const s = this.save.state.settings;
    return !s.reduceMotion && !this.isMobile && !this.versus;
  }

  /**
   * Apply the bloom policy for the current mode. Switching into or out of
   * split-screen does not re-run applySettings(), so both transitions call this
   * explicitly — otherwise a quality:"high" desktop player kept bloom through a
   * two-viewport versus match, and lost it afterwards until the next full
   * settings pass.
   */
  private applyBloomPolicy(): void {
    this.useBloom = this.bloomEligible() && this.save.state.settings.quality === "high";
    this.bloomBudget = { enabled: false, goodWindows: 0, cooldown: 0 };
    if (!this.useBloom) this.fx?.setBase(0);
  }

  private applySettings(): void {
    const s = this.save.state.settings;
    this.audio.setMuted(s.mute);
    this.audio.setMusicEnabled(s.music);
    this.audio.setVolumes(s.musicVolume, s.sfxVolume);
    this.audio.setMusicTrack(s.musicTrack);
    this.audio.setMusicStyle(s.musicStyle);
    this.camera.setReduceMotion(s.reduceMotion);
    // Motion-sickness accessibility: no dolly-zoom, no banked tilt, capped shake.
    this.camera.setSoftCamera(s.softCamera);
    this.applyBloomPolicy();
    // Accessibility classes live on <html> so every overlay inherits them.
    document.documentElement.classList.toggle("a11y-color", s.colorAssist);
    document.documentElement.classList.toggle("a11y-bigtext", s.bigText);
    // Colorblind-assist shape markers on the two translucent ghosts (yours vs
    // a rival's), so they read apart by silhouette, not tint alone.
    this.ghostPlayer.setMarkerVisible(s.colorAssist);
    this.rivalGhostPlayer.setMarkerVisible(s.colorAssist);
    // Motor accessibility: tap-to-toggle-dive instead of hold-to-dive.
    this.input.setToggleDive(s.tapToggleDive);
    this.dpr = this.preferredDpr();
    // Mobile gets a lighter decorative particle stream by default. Gameplay
    // events still render because critical emitters are short-lived and the
    // adaptive quality loop can shed more work under sustained load.
    this.particleBudget = s.quality === "low" ? 0.3 : this.isMobile ? 0.5 : 1;
    this.particleCeiling = this.particleBudget;
    this.particles.setBudget(this.particleBudget);
    // Soft shadows are the single priciest feature on mobile GPUs — keep them
    // only when the user asked for high quality (auto tiers shed them first).
    const wantShadows =
      this.deviceProfile.tier !== "lite" && !this.isMobile && (s.quality === "high" || (s.quality === "auto" && this.frameEma < 1 / 30));
    if (this.renderer.shadowMap.enabled !== wantShadows) this.renderer.shadowMap.enabled = wantShadows;
    // Settings are an explicit instruction, so they reset the adaptive state
    // rather than fighting it: the ladder starts again from what was chosen.
    this.effectBudget = { shadows: wantShadows, particles: this.particleBudget, goodWindows: 0 };
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
    // Phones start at 1 and must be able to go BELOW it. Returning a flat 1
    // made nextDpr's ceiling `max(1, 1)` — every branch returned 1, the
    // resolution ladder was dead code on the platform nearly all players are
    // on, and a struggling phone had no recourse at all.
    return this.isMobile ? 1.25 : dev;
  }

  private adaptQuality(raw: number): void {
    this.frameEma = lerp(this.frameEma, raw, 0.05);
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
    // Not gated on `playing`: the menu's attract flight is the first thing a
    // player sees and the heaviest sustained render, and the results screen is
    // when the device is hottest. Gating adaptation to gameplay meant the
    // places most likely to need it never participated.
    if (this.save.state.settings.quality !== "auto" || this.disposed) return;

    // Resolution is two-way: step down when the budget is blown, and back up
    // when headroom returns, with a lock-out so it cannot oscillate. The old
    // loop only ever stepped down, so one bad moment degraded the whole session.
    this.bloomBudget = nextBloomBudget(this.bloomBudget, this.frameEma, this.bloomEligible());
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

    // Soft shadows and particle density, through the same two-way policy the
    // resolution uses. This used to be an inline one-way ratchet whose
    // recovery branch was gated on `!this.isMobile` — so on a phone, one slow
    // window shed the shadows and 20% of the particles for the rest of the
    // session. See `nextEffectBudget`.
    const shadowsAllowed = !this.softwareMode && this.deviceProfile.tier !== "lite";
    const beforeEffects = this.effectBudget;
    this.effectBudget = nextEffectBudget(beforeEffects, this.frameEma, {
      shadowsAllowed,
      particleCeiling: this.particleCeiling,
    });
    if (this.effectBudget.shadows !== beforeEffects.shadows) {
      this.renderer.shadowMap.enabled = this.effectBudget.shadows;
      this.telemetry.track(this.effectBudget.shadows ? "shadows_restored" : "shadows_disabled", {});
    }
    if (this.effectBudget.particles !== beforeEffects.particles) {
      this.particleBudget = this.effectBudget.particles;
      this.particles.setBudget(this.particleBudget);
    }
  }

  /**
   * Screen shake. `CameraRig.bump` is the whole implementation.
   *
   * This used to drive a second, parallel trauma system (`GameFeel`) that
   * computed shakeX/shakeY/shakeR, an fov kick and a timescale every frame.
   * Nothing ever read any of it — only the camera's own bump reached the
   * player — so the class spent a per-frame sine-sum producing a value that
   * was discarded, and a second, half-wired feel system sat next to the live
   * one waiting for someone to wire it the wrong way.
   */
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

  /** Records a memorable beat once at a readable cadence, then fans it into
   * feedback and telemetry.  The ledger is intentionally per-run; the
   * session-level first-seen set lives inside it for the retention funnel. */
  private fireMoment(
    kind: MomentKind,
    opts: { shout?: string; toast?: string; popup?: boolean; always?: boolean } = {},
  ): number {
    const before = this.moments.count(kind);
    const last = this.momentLastAt[kind];
    const since = last === undefined ? Number.POSITIVE_INFINITY : this.runTime - last;
    if (!opts.always && !momentShouldReact(before, since)) return before;
    const def = MOMENTS[kind];
    const count = this.moments.record(kind);
    this.momentLastAt[kind] = this.runTime;
    if (opts.popup !== false) this.popupAtBird(opts.shout ?? def.shout, def.popup);
    if (opts.toast) this.hud.toast(opts.toast, def.tone);
    this.haptic(def.haptic);
    // Make the beat a *musical* event, not only a sound effect. This is the one
    // place every moment passes through, so wiring it here covers all kinds.
    // The gate is the second throttle: `momentShouldReact` above already decided
    // this beat is worth showing, and this keeps a burst of them from stacking
    // six bus automations onto the same frame.
    const nowMs = this.runTime * 1000;
    if (this.momentMusicGate.allow(kind, nowMs)) {
      this.momentMusicGate.mark(kind, nowMs);
      this.audio.musicReaction(momentMusic(kind));
    }
    if (this.moments.isFirstEver(kind)) {
      this.telemetry.track("moment_first", { kind, mode: this.modeId });
      this.markFunnel("first_moment");
    }
    return count;
  }

  /** Emits each first-session milestone exactly once, with timings that make
   * early churn actionable instead of guessing at it from aggregate playtime. */
  private markFunnel(stage: FunnelStage): void {
    const event = this.funnel.mark(stage);
    if (!event) return;
    this.platform?.measure("player", `funnel-${event.stage}`, "reached");
    this.telemetry.track("funnel_stage", {
      stage: event.stage,
      step: event.step,
      ms: event.ms,
      stepMs: event.stepMs,
      progress: Math.round(event.progress * 100) / 100,
    });
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
  private popupAtBird(text: string, kind: "perfect" | "great" | "thud" | "bop" | "fever" | "apex" | "splash" | "power"): void {
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
  private beginPortalAd(): void {
    // No gameplay event is sent here on purpose. The stop that precedes a
    // break is already on the books from the state transition that halted
    // play (death → gameover, or pause), and Poki's rules are explicit:
    // a gameplayStop() may NOT follow another gameplayStop(), and ads that
    // do not interrupt gameplay (a coin break from the shop) must not be
    // wrapped in stop/start pairs at all. The sink dedupes the rare
    // late-adapter case without ever producing the duplicate.
    this.input.setEnabled(false);
    this.audio.setAdMuted(true);
  }

  private endPortalAd(): void {
    this.audio.setAdMuted(false);
    this.input.setEnabled(true);
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
  /**
   * Use the portal account's username as the pilot name when the player is
   * signed in and has not picked a call sign themselves.
   *
   * Poki's User Accounts doc is explicit that `getUser()` is safe to call
   * after load, and that `login()` must only run from a user interaction —
   * this method only ever calls the former.
   */
  private async adoptPortalIdentity(): Promise<void> {
    const platform = this.platform;
    if (!platform || platform.name === "none") return;
    try {
      const identity = await platform.getIdentity();
      if (this.disposed || !identity?.name) return;
      this.portalAccountName = identity.name;
      // Explicit choices win: the dice, a typed rename. The welcome screen's
      // "let's fly" is NOT a choice — on a portal it merely accepts the curated
      // name already on the plate — so a signed-in player is still adopted
      // after it.
      if (this.pilotNameChosen) return;
      const next = identity.name.slice(0, 14);
      if (!next || next === this.pilotName) return;
      this.pilotName = next;
      this.save.state.pilotName = next;
      // The platform already knows who they are, so the name-entry screen has
      // nothing to ask: straight to the menu (Poki: "skip the menu" / minimal
      // first steps). The dice later still overrides both.
      this.save.state.pilotNameCustomized = true;
      this.save.persist();
      this.bump();
    } catch {
      // No user accounts on this portal (or the player opted out): the
      // generated call sign stays, which is the documented fallback.
    }
  }

  /** Player-initiated portal sign-in. Never call this on load (Poki docs). */
  private async signInToPortal(): Promise<void> {
    const platform = this.platform;
    if (!platform || platform.name === "none") return;
    const linked = await platform.requestAccountLink();
    if (this.disposed) return;
    if (linked) {
      await this.adoptPortalIdentity();
      this.audio.fanfare();
      this.hud.toast("Signed in — progress is now synced", "gold");
    } else {
      this.hud.toast("Sign-in cancelled", "info");
    }
    this.bump();
  }

  private adsLive(): boolean {
    const platform = this.platform;
    if (!this.portalEnabled() || !platform || platform.name === "none") return false;
    // An ad-blocked browser has no ad surface, so a break is not requested at
    // all. Requesting it anyway is what MON-12 calls looping the request: the
    // promise never settles, and the player is left holding a game that muted
    // itself and disabled input for an ad that was never coming. The cached
    // probe already existed for this; nothing consulted it.
    if (platform.hasAdBlock?.()) return false;
    return platform.capabilities().includes("ads");
  }

  /* ------------------------------------------------------- live multiplayer */

  /* ------------------------------------------------------- matchmaking */

  /** Opt into a public room, ready when connected, and launch only on the
     * server's shared start. A search that finds nobody stays open: the pilot
     * keeps waiting or asks for the AI flock by hand. Browsing or cancelling
     * cannot block a room. */
    // The PvP matchmaking search window. 15 s of waiting on a spinner reads as
    // the game being stuck; 10 s still gives a real lobby time to fill while
    // keeping the wait shorter than the player's patience for it.
    private static readonly MM_WINDOW = 10;
  
    /** Ends the search and hands back what it was searching for. Every exit out
     *  of matchmaking tears the search down through here — "the run already
     *  started", "the pilot cancelled", "the pilot asked for the AI flock" —
     *  and they have to stay in step: leave the watcher running and the overlay
     *  comes back on its own. */
    private takeMatchOpts(): { ranked: boolean; storm: boolean } | null {
    const opts = this.mmOpts;
    this.mmOpts = null;
    this.mmDeadline = 0;
    this.roomWatcher?.stop();
    this.closeRoomBrowser();
    return opts;
  }

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
          // direct build without VITE_MULTIPLAYER_URL). Say so and go back to the
          // lobby. This used to launch an AI flock race from here, so "Search
          // Online Pilots" silently became a bot race on every device that could
          // not open a socket — and this branch is also the fallback for the
          // ranked paths. The AI flock has its own button on the very same screen,
          // so starting one here took a choice away without adding one.
          //
          // Nothing is armed below this point on the success path either (mmOpts /
          // mmDeadline / the room watcher are all set further down), so clear them
          // explicitly: a stale search would keep the overlay alive with no way to
          // resolve it.
          this.mmOpts = null;
          this.mmPhase = "searching";
          this.roomWatcher?.stop();
          this.hud.setMatchmaking(false, 0, this.roomSize, 0);
          this.hud.toast("Online racing is unavailable here", "info");
          this.bump();
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
    this.takeMatchOpts();
    this.mmPhase = "searching";
    this.mmRooms = "";
    this.net?.sendReady(false);
    this.disconnectRace();
    // A quick-match GUEST adopts the host's code from the `welcome` frame, so
    // by the time a search is cancelled `roomCode` is routinely populated.
    // It was left set here, and `renderLive` branches on it — so cancelling
    // stranded the player on a room card for a room with nobody in it,
    // captioned "1 connected · 0 ready" (the `Math.max(1, …)` floor on a
    // `roomCount` of 0). Leaving the room means leaving its code.
    this.roomCode = "";
    this.hud.setMatchmaking(false, 0, this.roomSize, 0);
    this.bump();
  }

  /** Releases the P2P browse connection (Poki only; a WS build has nothing to
   *  release). Called when a search ends or is cancelled. */
  private closeRoomBrowser(): void {
    if (!POKI_MULTIPLAYER) return;
    void import("../sdk/PokiNetlib").then((m) => m.closeLobbyBrowser()).catch(() => {
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
      const { listPublicLobbies } = await import("../sdk/PokiNetlib");
      return listPublicLobbies();
    }
    return fetchPublicRooms();
  }

  /**
   * How many REAL, remote pilots are sharing this room. Never includes us, and
   * never includes the AI fallback.
   *
   * `info().count` is `tracks.size + 1`, and in an autonomous room the tracks
   * ARE the local AI flock — so this used to return 4 for a player with zero
   * netlib and zero peers. That number reached the search overlay verbatim
   * ("4 live pilots in this room") and then took the `live > 0` branch at the
   * end of the window, toasting "4 pilots found — hit Ready to race". The
   * whole point of `roomAiFallback` (and of `lobbyRivals`, and of the "Fill
   * with AI flock" label) is that the game never claims bots are people; the
   * one counter that feeds the search overlay was the exception.
   */
     private liveCount(): number {
       const info = this.net?.info();
       if (!info || !this.net?.connected) return 0;
       if (info.aiFallback) return 0;
       return Math.max(0, info.count - 1);
     }

  /**
   * Called every frame while a search is active.
   *
   * `mmDeadline` is a wall-clock STAMP, not a countdown, so it stays positive
   * for the whole life of the search — including the phases that run past it.
   * That is what the opening guard tests ("is a search armed"), and zeroing it
   * is how `takeMatchOpts` takes the overlay down. Reading it as an elapsed
   * flag instead would hide the overlay on the frame after the window closed.
   */
  private pumpMatchmaking(_raw: number): void {
    if (this.mmDeadline <= 0 || !this.mmOpts) return;
    // If the run already started (a real start frame, or a local launch), the
    // search is over — the overlay must never sit on top of gameplay. The run
    // is already the player's, so there is nothing left to find: tear the
    // search down and say so. This used to launch an AI race from here, which
    // is the one case where "the player asked for live pilots" was already
    // decided by something else.
    if (this.state !== "menu") {
      this.takeMatchOpts();
      this.mmPhase = "searching";
      this.hud.setMatchmaking(false, 0, this.roomSize, 0);
      this.hud.toast("No live match found", "info");
      this.bump();
      return;
    }
    const live = this.liveCount();
    // Nobody is auto-readied. A live pilot joining the room never launches a
    // race by itself — the overlay offers an explicit Ready toggle, and the
    // room starts (with a shared 6s countdown) only once every seated pilot
    // has readied up.
    const ready = this.net?.state === "lobby" ? (this.net.info().ready ? "ready" : "unready") : "none";
    // A pilot turned up after the window closed, in either post-window phase:
    // stop parking and hold the lobby for ready-up instead. The room still
    // starts only on all-ready, so arriving cannot start anything.
    if (this.mmPhase !== "searching" && live > 0) {
      this.mmPhase = "waiting";
      this.hud.setMatchmaking(true, live, this.roomSize, 0, "waiting", this.mmRooms, ready);
      return;
    }
    // "waiting": the window closed with pilots here and they have all left.
    // Reopen a fresh window rather than stranding the overlay on an empty
    // room.
    if (this.mmPhase === "waiting") {
      this.mmPhase = "searching";
      this.mmDeadline = performance.now() + Game.MM_WINDOW * 1000;
      this.startRoomWatch();
      this.hud.toast("Pilot left — searching again", "info");
    }
    // "expired": the window closed on an empty lobby. This is the branch that
    // started a 41-bird AI race one frame after the overlay had offered the
    // player a choice — it called takeMatchOpts() (hiding the overlay) and
    // then launchMatch(opts, true). The search now simply stays open: mmOpts
    // and the room watcher stay armed, so "Keep searching" can reopen the
    // window, Cancel (or ESC) can still leave, a joining pilot is noticed on
    // the next frame (above), and the AI flock is reachable only from the
    // explicit button.
    if (this.mmPhase === "expired") {
      this.hud.setMatchmaking(true, 0, this.roomSize, 0, "waiting", this.mmRooms, ready);
      return;
    }

    const secsLeft = (this.mmDeadline - performance.now()) / 1000;
    this.hud.setMatchmaking(true, live, this.roomSize, Math.max(0, secsLeft), "searching", this.mmRooms, ready);
    if (secsLeft <= 0) {
      if (live > 0) {
        // Real pilots found before the window closed — hold the lobby open.
        // The "start" net event fires once everyone readies (allReady in
        // PokiNetlib).
        this.mmPhase = "waiting";
        this.hud.setMatchmaking(true, live, this.roomSize, 0, "waiting", this.mmRooms, ready);
        this.hud.toast(`${live} pilot${live === 1 ? "" : "s"} found — hit Ready to race`, "gold");
        this.telemetry.track("matchmaking_live_waiting", { count: live });
        return;
      }
      // Window closed on an empty lobby: park and let the pilot decide. Nothing
      // is launched from here.
      this.mmPhase = "expired";
      this.hud.setMatchmaking(true, 0, this.roomSize, 0, "waiting", this.mmRooms, ready);
      this.telemetry.track("matchmaking_search_expired", { window: Game.MM_WINDOW });
      this.bump();
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

  /** Pre-seats the lobby so the Race screen shows live pilots immediately.
   *
   *  The transport itself comes from `createNetTransport()` (net-transport.ts):
   *  the Poki build gets the Netlib P2P client behind a dynamic import, and a
   *  browser without WebRTC gets the WebSocket relay client. Both classes
   *  share the same public API so this file does not branch anywhere. */
  private preseatLobby(): void {
    // Warm the ghost source too so the next grid can seat real names.
    void this.refreshBoard();
    // Matchmaking and race entry must use the SAME room seed. Pre-seating with
    // a different seed than connectRace() caused PvP modes to drop their lobby
    // and land in a new empty room the moment the countdown ended — hence the
    // "circuits aren't actually PvP" bug.
    const seed = this.currentMatchSeed();
    const remote = this.joiningRemoteRoom;
    if (this.net) {
      // Already seated (a reconnect, or a second lobby visit): keep the same
      // client and just re-announce ourselves into the room.
      this.announceToRoom(this.net, seed, remote);
      return;
    }
    this.ensureNet(seed, remote);
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
    const seed = this.currentMatchSeed();
    const remote = this.joiningRemoteRoom;
    if (this.net) {
      this.announceToRoom(this.net, seed, remote);
      return;
    }
    this.ensureNet(seed, remote);
  }

  private disconnectRace(): void {
    this.net?.disconnect();
    this.massRace.attachTransport(null);
    // Leaving a room ends the hosting intent too. Every exit path already
    // funnels through here — matchmaking, cancel, room-close, back-to-menu,
    // race replay — so this is the one place that has to remember, rather
    // than ten call sites that each have to.
    this.hostingLobby = false;
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
    // Adopt the code the transport actually holds. A host's room is created
    // server-side and its code only exists once `create()` resolves, so the
    // lobby card, "copy invite" and the seat count all read from here rather
    // than from whatever we hoped for when the button was pressed.
    if (this.hostingLobby && !this.roomCode) {
      const live = net.info().code;
      if (live) {
        this.roomCode = live;
        this.bump();
      }
    }
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
          this.hud.toast(`${e.name} joined the race`, "island", "bird");
          this.audio.chirp();
          this.recordRoomPilots();
          break;
        case "leave":
          this.hud.toast(`${e.name} left`, "warn");
          break;
        case "ready":
          this.hud.toast(`${e.name} is ready`, "cloud", "badge");
          break;
        case "finish":
          // While we're still flying, every rival's finish matters. After we
          // cross, the pack keeps finishing behind the results card — up to
          // ~40 toasts that each re-render the whole card. The referee's
          // official ordering already landed via `myPlace`, so stay silent.
          if (this.state === "playing") this.hud.toast(`${e.name} finished P${e.place}`, "gold", "flag");
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
    // A recent failure is not retried by passive triggers. `force` is the
    // player's own "refresh" tap, which is exactly the moment to try again.
    if (!force && this.boardFailedAt && Date.now() - this.boardFailedAt < Game.BOARD_RETRY_MS) return;
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
      // The page carries the backend's own error state, so a rejected call is
      // visible here rather than thrown.
      this.boardFailedAt = this.board.failed ? Date.now() : 0;
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
      this.hud.toast(`${msg}`, "gold", "bird");
      this.audio.fanfare();
    };
    if (st.lifetime.ghostBeats >= 10) grant("ghost", "Ghost unlocked — 10 ghost wins!");
    if (st.lifetime.apexMoments >= 25) grant("shadow", "Shadow unlocked — 25 skyline moments banked!");
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
      this.hud.toast(`${c.name} collection complete · +${bonus} coins`, "gold", c.icon);
      this.audio.fanfare();
    }
  }

  private applyPrizes(grants: PrizeGrant[]): void {
    const top = grants[grants.length - 1]!;
    for (const grant of grants) {
      const p = grant.prize;
      if (p.kind === "coins") this.save.addCoins(p.amount);
      else if (p.kind === "skin") this.save.ownSkin(p.id);
      else if (p.kind === "boost") this.save.grantBoost(p.id);
      this.telemetry.track("cup_prize", { tier: grant.tier, kind: p.kind, id: p.id });
    }
    // trails/titles were already recorded inside Tournaments.claim()
    this.save.persist();
    this.lastPrize = top;
    this.audio.purchase();
    this.particles.emitConfetti(this.bird.x, this.bird.y + 3);
    // One toast, not one per tier: a jump from nothing to diamond pays four
    // prizes and the player should read one line, not four stacked banners.
    const extra = grants.length > 1 ? ` + ${grants.length - 1} more tier${grants.length > 2 ? "s" : ""}` : "";
    this.hud.toast(`${top.prize.label} — ${top.tier} in ${top.cup}${extra}`, "gold", top.prize.icon);
    this.checkPrizeSkins();
    this.bump();
  }

  /**
   * A portal-controlled commercial break at the natural death/restart seam.
   *
   * Every restart is a break opportunity — it is the same "stop, then back into
   * a run" moment whether the player died, abandoned the flight, or restarted
   * from the pause card. There is deliberately no `allowPortalBreak` opt-out
   * any more: one existed, two of the six paths passed `false`, and those ad
   * slots were silently unfillable ever after. A break that will not serve
   * resolves on its own, so asking costs nothing.
   */
  private replayRun(): void {
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
    // The same pacing gate as the run-start break, and for the same reason: a
    // request the core refuses resolves empty, so entering the "ad" state for
    // one paints a sponsored-break card the portal cannot deliver and then
    // collapses it a frame later. Ask only when the core can actually serve.
    if (
      this.adsLive() &&
      platform &&
      platform.name !== "none" &&
      !this.portalBreakPending &&
      Date.now() - this.lastCommercialBreakAt >= COMMERCIAL_BREAK_MIN_GAP_MS
    ) {
      this.portalBreakPending = true;
      this.lastCommercialBreakAt = Date.now();
      this.setState("ad");
      this.telemetry.track("portal_break_request", { portal: platform.name, placement: "resume" });
      try {
        await platform.commercialBreak();
      } catch { /* a refused break must never wedge the resume */ }
      // Clear the shared in-flight flag on EVERY exit, including the disposed
      // one. It is one-way otherwise: `maybeBreakOnRunStart` bails on it, and
      // nothing else resets it, so a single pause would silently disable the
      // run-start break for the rest of the session.
      this.portalBreakPending = false;
      if (this.disposed) return;
      this.endPortalAd();
    }
    if (this.state === "paused" || this.state === "ad") this.setState("playing");
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
    if (this.multiplierRewardBusy || this.multiplierClaimed) return;
    this.multiplierRewardBusy = true;
    try {
      const earned = await platform.rewardedBreak();
      if (this.disposed) return;
      this.endPortalAd();
    if (earned) {
      const bonus = this.runCoins * 2;
      this.multiplierClaimed = true;
      // Report what was CREDITED, not what was requested. `addCoins` applies
      // the permanent goldenfeather multiplier, so the old toast promised more
      // than the player received — the same bug its three sibling awards were
      // already fixed for.
      const credited = this.save.addCoins(bonus);
      this.audio.chapterFanfare();
      this.hud.toast(`3× flight bonus — +● ${credited} coins`, "gold");
      platform.measure("reward", "results-coin-multiplier", "granted");
    } else {
      this.hud.toast("No reward this time — the 3× bonus is still on the card", "warn");
    }
    if (this.state === "ad") this.setState("gameover");
    this.bump();
    } finally {
      this.multiplierRewardBusy = false;
    }
  }

  /** Shop free-coins rewarded break: capped per hour, modest payout so the
   *  high-price mythic tier (2500-10000) stays aspirational. */
  private async multiplyCoinsFromShopAd(): Promise<void> {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") return;
    if (this.shopAdClaimed >= SHOP_AD_SESSION_CAP) {
      this.hud.toast("Free coin rewards capped for this hour", "info");
      return;
    }
    // In-flight guard, like the other two rewarded placements. The shop button
    // dispatches this with `void`, unawaited, so repeated taps used to stack
    // concurrent rewardedBreak() calls — and unlike the results and continue
    // cards, nothing debounced the click. Each one mutes audio and disables
    // input, so a burst also left the game muted until the slowest resolved.
    if (this.shopAdBusy) return;
    this.shopAdBusy = true;
    this.telemetry.track("portal_break_request", { portal: platform.name, placement: "shop-free-coins" });
    // Shop free-coin break does not bookend gameplay (no gameplayStop/start),
    // so mute + disable input directly around the break instead of begin/endPortalAd
    // (which would risk a duplicate gameplayStop from the sink).
    this.audio.setAdMuted(true);
    this.input.setEnabled(false);
    let earned = false;
    try {
      earned = await platform.rewardedBreak();
    } catch { /* a refused break grants nothing and must not strand the mute */ }
    if (this.disposed) return;
    this.shopAdBusy = false;
    this.audio.setAdMuted(false);
    this.input.setEnabled(true);
    if (earned) {
      this.shopAdClaimed++;
      const payout = Math.min(SHOP_AD_COINS, 60);
      this.save.addCoins(payout);
      this.audio.chapterFanfare();
      this.hud.toast(`Here's a little flying fuel — +● ${payout} coins`, "gold", "coin");
      this.bump();
    } else {
      this.hud.toast("No reward this time — try again next hour", "info");
    }
  }

  private async continueWithPortalReward(): Promise<void> {
    const platform = this.platform;
    if (!this.adsLive() || !platform || platform.name === "none") return;
    if (this.continueRewardBusy) return;
    this.continueRewardBusy = true;
    try {
      this.setState("ad");
      this.telemetry.track("portal_break_request", { portal: platform.name, placement: "continue" });
      const earned = await platform.rewardedBreak();
      if (this.disposed) return;
      // The safety valve may have restored pre-break state while the SDK
      // promise was still pending: a late grant must not resurrect a break
      // the player already left.
      if (this.state !== "ad") return;
      this.endPortalAd();
      if (earned) {
        const gold = this.save.state.gold;
        const max = gold ? 99 : this.save.isVipActive() ? 2 : 1;
        if (this.continuesUsed < max) this.doContinue("portal_rewarded");
        else this.setState("continue");
      } else {
        // The break did not pay: the player closed the portal's ad early (the
        // SDK resolves earned=false), or the SDK had nothing to serve. Either
        // way the rule is the ad plays to the end or there is no second wind —
        // say the rule, so "skip" never looks like it might have worked.
        this.setState("continue");
        this.hud.toast("The ad has to play to the end — try again, or use coins", "warn");
      }
    } finally {
      this.continueRewardBusy = false;
    }
  }

  private setState(s: GameState): void {
    const previous = this.state;
    this.state = s;
    // Arm and disarm the break safety valve (see adWallClock).
    if (s === "ad") {
      this.preAdState = previous;
      this.adWallClock = 0;
    } else if (previous === "ad") {
      this.preAdState = null;
      this.adWallClock = 0;
    }
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
    // Edge-triggered through the sink: stop exactly once per halt
    // (death, pause, menu), start exactly once per resume.
    if (previous === "playing" && s !== "playing") this.gameplaySink.send("stop");
    if (previous !== "playing" && s === "playing") this.gameplaySink.send("start");
    this.bump();
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
    // Every return to the home screen refreshes the embedded leaderboard so a
    // just-finished run shows up immediately (cache-first, non-blocking). Only
    // do this for the real main menu — during pause, "main" is the pause card.
    if (s === "main" && this.state !== "paused") void this.refreshBoard();
    this.measureScreenExposure(s);
    this.bump();
  }

  /**
   * Game Events pairing rule: every `interact` needs a `visible` for the same
   * element, otherwise exposure and engagement cannot be compared. Two elements
   * are measured on interaction only (`open-portal-leaderboard`, `equip-skin`),
   * so the screen that shows them reports their exposure here — once per entry,
   * which is exactly "the player saw this".
   */
  private measureScreenExposure(s: UiScreen): void {
    const platform = this.platform;
    if (!platform || platform.name === "none") return;
    if (s === "board") platform.measure("button", "portal-leaderboard", "visible");
    // The wardrobe lives in the shop screen's skin grid.
    if (s === "shop") platform.measure("cosmetic", "skin-grid", "visible");
    // The loadout's bird picker is measured on interaction only, so the screen
    // that shows it reports the exposure — otherwise the pre-flight picker is
    // the one cosmetic the portal sees engaged but never seen offered.
    if (s === "loadout") platform.measure("cosmetic", "bird-row", "visible");
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

  /**
   * The distance this run is REPORTED at — the one number every surface that
   * shows or publishes a flight has to agree on.
   *
   * Mid-flight that is just where the bird is. On the results screen it is the
   * value `finishRun()` froze into `resultDistance`, because `bird.asleep` only
   * damps velocity: the bird goes on coasting for a couple of seconds under the
   * card. The HUD already read the frozen value (which is why the card stopped
   * climbing past the number that was scored and submitted), but the two paths
   * that PUBLISH the run still re-read the live position:
   *
   *   • the share card and its share text — "I flew 870m" beside a results card
   *     that said 851m, so the viral payload claimed a flight the leaderboard
   *     was never credited with;
   *   • the challenge link, which encodes the distance a rival has to beat.
   *
   * Both are on the solo results card, which is the only surface that renders
   * the share and challenge actions (`renderVersusResult` has neither), so
   * `resultDistance` is always the frozen run when this answers with it.
   *
   * `live` is passed in rather than read here: a caller that already holds the
   * in-flight number (a `RunStats` it is about to spread) must not be handed a
   * second, subtly different read of the same subtraction.
   */
  private reportedRunDistance(live: number): number {
    return this.state === "gameover" ? this.resultDistance : live;
  }

  private runStats(): RunStats {
    return {
      clouds: this.runClouds,
      island: this.island + 1,
      coins: this.runCoins,
      perfects: this.perfects,
      distance: Math.max(0, this.bird.x - this.startX),
      fever: this.feverReached ? 1 : 0,
      apex: this.zeniths,
      pickups: this.pickups,
    };
  }

  /** Force every shader in the current scene to compile now rather than on the
   *  frame that first draws it. Best-effort: a driver that refuses is a lost
   *  optimisation, never a failed run. */
  private warmShaders(): void {
    try {
      this.scene.updateMatrixWorld(true);
      this.renderer.compile(this.scene, this.camera.camera);
    } catch {
      /* SwiftShader / a lost context — the frame will compile it instead. */
    }
  }

  /** 0..1 — continuous musical intensity from the moment-to-moment flight. */
  private musicIntensity(): number {
    if (this.state !== "playing") return 0;
    const speed = Math.min(1, this.bird.speed() / 90);
    const alt = Math.min(1, this.bird.altitude / ALT_HIGH);
    const fever = this.feverOn ? 1 : 0;
    const danger = 1 - Math.max(0, Math.min(1, this.daylight / this.daylightMax()));
    const chain = Math.min(1, this.ringChain / 4);
    return Math.min(1, speed * 0.35 + alt * 0.22 + fever * 0.3 + danger * 0.12 + chain * 0.12);
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
      daily: dailyCard(this.save, this.today),
      gauntlet: gauntletCard(this.save),
      calendar: calendarCard(this.save, this.today),
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
      const permanent = Boolean(def.permanent);
      const armedCount = permanent ? 0 : this.save.boostArmed(def.id);
      const stocked = permanent ? 0 : this.save.boostStocked(def.id);
      return {
        def,
        armed: permanent ? st.ownedUpgrades.includes(def.id) : armedCount > 0,
        affordable: st.wallet >= (dealPrice ?? def.price),
        dealPrice,
        stocked,
        armedCount,
        spare: Math.max(0, stocked - armedCount),
        permanent,
      };
    });
    this.shopTrailViews = SHOP_TRAILS.map((def) => ({
      def,
      owned: st.tournaments.trails.includes(def.id),
      equipped: st.activeTrail === def.id,
      affordable: st.wallet >= def.price,
    }));
    this.viewsVersion = this.uiVersion;
  }

  /**
   * The in-flight mission strip, and the "just banked" flags for this push.
   *
   * `missionRows` is pure over (today's defs, the live run counters, what is
   * already banked), so this is the same call the run-end claim would make —
   * one producer, two readers, no second source of truth. `newlyDone` diffs
   * against the previous push so a row that crosses the line flags exactly
   * once; without the diff a filled bar would keep re-announcing itself for
   * the rest of the flight.
   */
  private stepMissionRows(stats: RunStats): void {
    const rows = buildMissionRows(this.missions.dailyQuests(this.today), this.state === "playing" ? stats : null, this.save.questsClaimed(this.today));
    const crossed = newlyDone(this.previousMissionRows, rows);
    this.previousMissionRows = rows;
    this.justBankedQuests = crossed.map((r) => r.id);
    this.missionRowViews = this.justBankedQuests.length ? rows.map((r) => (crossed.some((c) => c.id === r.id) ? { ...r, justDone: true } : r)) : rows;
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
    this.stepMissionRows(stats);
    const todayBest = this.todayBestDistance(st);
    const sTier = this.seasonPass.tier();
    const sProg = this.seasonPass.progressInTier();
    const snap: HudSnapshot = {
      ...this.hudRunState(st, stats),
      ...this.hudWalletAndBreaks(st),
      ...this.hudProfile(st, todayBest, sTier, sProg),
      ...this.hudFlightAndWorld(st),
      ...this.hudRace(st),
      ...this.hudEventsAndExtras(st),
    };
    this.hud.update(snap);
  }

  /* ------------------------------------------------------------------
   * The HUD snapshot, in six readable parts.
   *
   * This used to be one 280-line object literal, so the only way to answer
   * "where does the HUD get X from" was to scan 280 lines to find it. The
   * six methods below return contiguous slices of that same literal, in the
   * same order, so every field is still evaluated left to right exactly as
   * before -- only the reading changed.
   *
   * Bounds: `snap: HudSnapshot` is still annotated on the call
   * site, so a field added to HudSnapshot that no slice covers is a compile
   * error, and a slice that misspells a field is a compile error. The
   * compiler guarantee is exactly as strong as it was when this was one
   * literal.
   * ------------------------------------------------------------------ */

  /** Run, score and in-flight status. */
  private hudRunState(st: SaveData["state"], stats: RunStats) {
    return {
    state: this.state,
    screen: this.screen,
    checkoutSku: this.checkoutSku,
    portalName: this.platform?.name ?? getPortalTarget(),
    // Poki can render its own leaderboard overlay; the button only appears
    // when the deployed SDK actually offers it.
    portalLeaderboard: this.platform?.capabilities().includes("leaderboard") ?? false,
    version: this.uiVersion,
    // One home for the run's reported distance — see reportedRunDistance().
    // Reading the live bird position here made the results distance climb past
    // the number that was actually scored and submitted to the leaderboard.
    distance: this.reportedRunDistance(stats.distance),
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
    coachStep: this.state === "playing" ? this.coachStep().step : -1,
    coachSteps: this.state === "playing" ? this.coachStep().steps : 0,
    magnetTimer: this.magnetTimer,
    shield: this.shield,
    boostTimer: this.boostTimer,
    };
  }

  /** What the player owns and what is being offered right now: gold, VIP,
   *  the continue offer and the commercial break. */
  private hudWalletAndBreaks(st: SaveData["state"]) {
    return {
    gold: st.gold,
    vip: this.save.isVipActive(),
    vipDaysLeft: this.save.vipDaysLeft(),
    vipExpiredNotice: this.vipExpiredNotice,
    adsLeftToday: this.save.adsLeftToday(),
    ghostDelta: this.state === "playing" || this.state === "gameover" ? this.ghostDelta() : null,
    newBest: this.newBest,
    continueTimer: this.continueTimer,
    continueReason: this.continueOfferView?.reason ?? "",
    continueHighlight: this.continueOfferView?.highlight ?? false,
    continueCost: CONTINUE_COST,
    canAffordContinue: st.wallet >= CONTINUE_COST,
    // Portal: only advertise a rewarded option the SDK can actually pay out.
    adAvailable: this.portalEnabled() ? this.adsLive() : SIMULATED_BREAKS && this.ads.isAvailable(),
    adTimer: this.adTimer,
    adSkippable: !this.portalEnabled(),
    // Wall-clock age of the live break, so the escape hatch can render an
    // honest countdown instead of an enabled button that skips a real ad.
    adElapsed: this.adWallClock,
    adSafetySeconds: AD_SAFETY_SECONDS,
    adTotal: this.ads.duration,
    adReason: this.adReason,
    seedLabel: this.seedLabel(),
    wings: wingsCard(this.save),
    };
  }

  /** Longest flight recorded today. The only day-scoped "best" in the save
   *  file — `state.bestDistance` is a lifetime record and stays that way. */
  private todayBestDistance(st: SaveData["state"]): number {
    let best = 0;
    for (const h of st.highScores) if (h.date === this.today && h.distance > best) best = h.distance;
    return best;
  }

  /** The three stats `SQUAD_QUESTS` are measured against, read once so the
   *  claim handler and the squad panel always judge the same numbers. */
  private squadQuestProgressInput(): SquadQuestProgressInput {
    const st = this.save.state;
    return {
      bestDistance: st.bestDistance,
      runsPlayed: st.runsPlayed,
      todayBest: this.todayBestDistance(st),
    };
  }

  /** Wallet, progression, missions, quests, shop views, pack pricing,
   *  checkout, season pass and trophies. */
  private hudProfile(st: SaveData["state"], todayBest: number, sTier: number, sProg: { have: number; need: number }) {
    return {
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
    nestMaxed: st.nestBought >= 10,
    missions: this.missionViews,
    quests: this.questViews,
    highScores: st.highScores,
    todayBest,
    today: this.today,
    runsPlayed: st.runsPlayed,
    newlyCompleted: this.newlyCompleted,
    claimedQuests: this.claimedQuests,
    skins: this.skinViews,
    boosts: this.boostViews,
    shopTrails: this.shopTrailViews,
    settings: st.settings,
    firstSteps: {
      shop: st.seenShop,
      loadout: st.seenLoadout,
      pve: st.seenPve,
      pvp: st.seenPvp,
      settings: st.seenSettings,
    },
    goldPrice: GOLD.price,
    starterPrice: STARTER_PACK.price,
    starterFeatures: STARTER_PACK.features,
    starterOwned: st.starterPack,
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
    nearestTrophy: this.achievements.nearest(),
    referralCode: st.referralCode,
    referralRedeemed: st.referralRedeemed,
    referralMessage: this.referralMessage,
    cloudCode: this.screen === "account" ? this.save.exportCode() : "",
    cloudMessage: this.cloudMessage,
    canInstall: Boolean(this.deferredInstall) && !this.portalEnabled(),
    shareBusy: this.shareBusy,
    expShareFirst:
      this.state !== "gameover"
        ? false
        : (this.expShareFirst ??= variant(st.deviceId, "results_cta_order", 50, (v) => {
            this.telemetry.track("experiment_exposure", { experiment: "results_cta_order", variant: v });
          })) === "treatment",
    };
  }

  /** The feel of the flight -- chains, weather, biome, launch, altitude --
   *  plus the mode picker, the live goal pops, and pilot/leaderboard
   *  identity. */
  private hudFlightAndWorld(st: SaveData["state"]) {
    return {
    combo: Math.max(this.perfectChain, this.versus && this.p1 ? this.p1.launch.combo : this.launch.combo),
    ringChain: this.ringChain,
    ringChainFrac: RING_CHAIN_WINDOW > 0 ? this.ringChainTimer / RING_CHAIN_WINDOW : 0,
    slopeChain: this.slopeChain.chain,
    slopeScore: this.slopeChain.score,
    speedNorm: Math.min(1, this.bird.speed() / 100),
    gust: this.weather.gust,
    inThermal: this.weather.inThermal,
    biomeName: this.terrain.biomeAt(this.bird.x).name,
    biomeEmoji: this.terrain.biomeAt(this.bird.x).emoji,
    atlas: this.screen === "atlas" ? atlas(this.save, this.island) : [],
    farthestIsland: Math.max(st.farthestIsland, this.island),
    fps: this.frameEma > 0 ? Math.round(1 / this.frameEma) : 0,
    endReason: this.endReason,
    runOutcome: this.runOutcome,
    launchBanner: this.launchBannerText,
    launchBannerT: this.launchBannerT,
    launchRating: this.lastLaunch?.rating ?? "none",
    chain: this.perfectChain,
    chainTier: chainTier(this.perfectChain),
    chainLabel: chainLabel(this.perfectChain),
    chainScale: chainScale(this.perfectChain),
    chainPulse: chainPulse(this.perfectChain),
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
    nearMiss: this.nearMiss.text,
    skillLabel: this.flow.label(),
    skill: this.flow.skill,
    bestAltitude: st.bestAltitude,
    bestCombo: st.bestCombo,
    runGems: this.runGems,
    pilotName: this.pilotName,
    board: this.boardPage,
    boardLoading: this.boardLoading,
    boardScope: this.boardScope,
    boardMetric: this.boardMetric,
    boardOnline: isLeaderboardOnline(),
    portalAccountName: this.portalAccountName,
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
    // Cup titles were granted and never read. Give them somewhere to appear.
    titles: this.cups.ownedTitles().map((id) => ({ id, label: CUP_TITLES[id] ?? id })),
      lastPrize: this.lastPrize ? `${iconGlyph(this.lastPrize.prize.icon)} ${this.lastPrize.prize.label}` : "",
    };
  }

  /** Everything the race screen needs: standings, the room, the
   *  connection, the rival card, the loadout and the duel. */
  private hudRace(st: SaveData["state"]) {
    return {
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
    roomAiFallback: this.net?.info().aiFallback ?? false,
    roomSize: this.roomSize,
    roomSkill: this.roomSkill,
    roomMuted: this.roomMuted,
    // Only the lobby screen can consume these — no per-frame allocs elsewhere.
    roomRivals:
      this.screen === "live"
        ? this.massRace.rivals.slice(0, 12).map((r) => ({ id: r.id, name: r.name, skill: Math.round(r.skill * 100), hue: Math.round(r.hue * 360) }))
        : [],
    netState: this.net?.info().state ?? "offline",
    squadQuestsClaimed: st.squadQuestsClaimed ?? {},
    linkQuality: this.net?.connectionQuality ?? "unknown",
    netError: this.net?.info().error ?? "",
    netLinkNote: this.net?.info().linkNote ?? "",
    draft: this.massRace.draft,
    finishRemaining: this.finishRemaining,
    nemesis: this.nemesis,
    photoFinish: this.photoFinish,
    rival: rivalCard(this.save),
    loadout: loadoutView(this.save, this.skin),
    // Lobby-only field: computed every frame before, including mid-flight
    // and on the results card, where no one renders it.
    lobbyRivals:
      this.state === "menu" && this.screen === "live"
        // Truth only: the pilots actually seated in this room. No padded
        // name-pool rivals, no borrowed leaderboard names — an empty room
        // renders as an empty room. When the room is the local AI fallback,
        // every row is tagged as an AI pilot rather than as a live human.
        ? lobbyRivals(this.net?.roster() ?? [], this.net?.info().aiFallback ?? false)
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
    };
  }

  /** Event cards, campaign, squad, sharing, and the placeholders the HUD
   *  still renders with but the game does not yet fill in. */
  private hudEventsAndExtras(st: SaveData["state"]) {
    return {
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
    friendChallenges: this.social.getActiveChallenges(),
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
    stipendClaimed: st.lastStipendClaimed === this.today,
    rankPrizeClaimed: st.rankPrizeSeason === rankSeasonId(),
    wingmanBundle: st.wingmanBundle === true,
    // Daily Login Ritual banner: dismissed for today (Play now / explicit X).
    // Combined with `daily.done` — see shouldShowDailyBanner in Engagement.ts
    // — is what the HUD needs to decide whether to render it at all.
    dismissedDailyPrompt: this.dismissedDailyPrompt,
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
    beatLine: null,
    nextAction: this.resultsNextAction(),
    // The results card's progress surface, read from the run — the three fields
    // that used to be literals here and were the reason `HUD.renderCelebration`
    // early-returned `""` on every flight.
    celebration: celebrationView(planCelebration(this.runProgress)),
    proximity: this.wingsProximityView(),
    missionRows: this.missionRowViews,
    };
  }

  /**
   * The results card's one next action, from today's quest rows.
   *
   * `nextActionLine` is a pure function of the rows and the distance just
   * flown, so this reads state that already exists (`missionRowViews` is the
   * same rows the in-flight strip shows) rather than recomputing anything. It
   * returns `""` on the menu and mid-flight — a next action is only meaningful
   * once there is a run behind it, and the HUD omits the element for `""`.
   */
  private resultsNextAction(): string {
    if (this.state !== "gameover" || this.missionRowViews.length === 0) return "";
    return nextActionLine(this.missionRowViews, this.resultDistance);
  }

  /**
   * The in-flight wings-proximity bar: how close this flight is to promoting
   * the pilot's career rank.
   *
   * `wingsProximity` needs the gap *measured before the flight* — the live
   * `nextNeeded` shrinks every frame, so feeding it the current value would
   * make `remaining` always zero and the bar would never show. `resetRun`
   * snapshots it, which is the only reason this is not a per-frame recompute of
   * the same subtraction. `tierSpan` is the rung's own width, which is what
   * sets how wide the reveal window is.
   */
  private wingsProximityView(): { visible: boolean; fill: number; remaining: number; name: string } {
    if (this.state !== "playing" || !this.wingsRungAtStart) return { visible: false, fill: 0, remaining: 0, name: "" };
    const prox = wingsProximity({
      flownMetres: this.lastRunDistance(),
      nextName: this.wingsRungAtStart.name,
      nextNeeded: this.wingsRungAtStart.needed,
      tierSpan: this.wingsRungAtStart.span,
    });
    return { visible: prox.visible, fill: prox.fill, remaining: prox.remaining, name: this.wingsRungAtStart.name };
  }

  /* ------------------------------------------------------- versus (2P) */

  private startVersus(): void {
    // A versus is a run start like any other, and `maybeBreakOnRunStart` used
    // to have exactly one caller — inside `startRun()`, which a versus and a
    // replay both bypass. So this path reached `gameplayStart()` with no
    // commercial break ever being offered, which is the one thing the HTML5
    // guide asks for on every "player showed intent to continue" moment.
    this.maybeBreakOnRunStart();
    this.disconnectRace();
    this.roomCode = "";
    this.versus = true;
    this.applyBloomPolicy();
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
    this.applyBloomPolicy();
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
