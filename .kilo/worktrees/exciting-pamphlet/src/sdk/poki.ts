/**
 * PokiAdapter — the canonical Poki HTML5 SDK surface, and nothing else.
 *
 * Every `PokiSDK.*` member this file touches comes from `./poki-canon`, whose
 * type is mapped from Poki's own published typings (`@poki/sdk@0.0.5`). That is
 * a deliberate constraint: the previous hand-written type let invented members
 * in (`signalGameReady`, `happytime`, `mute`/`isMuted`,
 * `hasAdBlock`/`setAdBlockActive`, `sendUserEvent`), and because each was
 * called through an optional chain they were silent no-ops in production rather
 * than type errors. Two of them are canonical on *CrazyGames*, which is how they
 * leaked across adapters.
 *
 * Wired here (T1 = official typings, T3 = integration guides):
 *   init({ submitScore }) · setDebug/setLogging (DEV) · enableEventTracking ·
 *   gameLoadingStart → gameLoadingFinished · gameplayStart/Stop ·
 *   commercialBreak · rewardedBreak({ size, onStart }) · getUser (optedIn
 *   respected) · getToken (1-minute backend-verification JWT) · login ·
 *   shareableURL · getURLParam · getLanguage · getDeviceInfo ·
 *   showLeaderboard · openExternalLink · captureError · movePill ·
 *   playtestSetCanvas · measure(category, what, action) · happyTime(0…1) ·
 *   isAdBlocked.
 *
 * Deliberately NOT wired, with the reason recorded per member in
 * `POKI_SDK_RUNTIME_ONLY`: gameLoadingProgress, gameInteractive, sendHighscore,
 * getLeaderboard, customEvent, logError, muteAd, roundStart/End, setPlayerAge,
 * generateScreenshot, displayAd/destroyAd.
 *
 * What Poki does not expose at all: banners, room state, pause hooks, a portal
 * mute preference, and a data module. Those are honest no-ops; cloud save uses
 * AUDS when a game id is configured and localStorage otherwise.
 */
import type {
  InviteParams,
  PlatformAdapter,
  PlatformEvents,
  PlatformIdentity,
  PlatformSystemInfo,
} from "./platform";
import { localCloudFallback } from "./local";
import { setLoadingNet } from "./net";
import { createAudsIfConfigured, AUDSPREFIX, PokiAuds } from "./auds";
import { clampHappyIntensity, sanitizeMeasure, type PokiSdk } from "./poki-canon";

// The user shape comes from the official typings (`User`: username, avatarUrl,
// optedIn) — redeclaring it locally is how `optedIn` went unnoticed.
type PokiShareableData = Record<string, string | number | boolean>;

/*
 * The SDK type is imported from ./poki-canon (mapped from @poki/sdk@0.0.5 plus
 * the runtime-only members the live CDN build assigns). Declaring it locally is
 * what allowed non-canonical names to compile, so it no longer lives here.
 */

/**
 * `init({ submitScore })` is Poki's leaderboard handshake: the SDK hands us a
 * submit function, which we then call per leaderboard name. Kept optional —
 * older CDN builds init with no arguments.
 */
type PokiInitOptions = {
  debug?: boolean;
  logging?: boolean;
  submitScore?: (submit: (leaderboard: string, score: number) => void) => void;
};

/** Leaderboard the run score is submitted to (Poki dashboard leaderboard name). */
const POKI_LEADERBOARD = "distance";

/**
 * The submit function Poki hands us during `init({ submitScore })`. Held at
 * module scope because init runs on the boot path (sdk/platform.ts) long
 * before the adapter is constructed.
 */
let scoreSubmit: ((leaderboard: string, score: number) => void) | null = null;

/** Options for the boot path's `PokiSDK.init()` — the leaderboard handshake. */
export function pokiInitOptions(): PokiInitOptions {
  return {
    ...(import.meta.env.DEV ? { debug: true, logging: true } : {}),
    submitScore: (submit) => {
      scoreSubmit = typeof submit === "function" ? submit : null;
    },
  };
}

/** True once the SDK has handed over its score submitter. */
export function pokiLeaderboardReady(): boolean {
  return scoreSubmit !== null;
}

/** Submit one score to a Poki leaderboard. False when unavailable. */
export function pokiSubmitScore(score: number, leaderboard: string = POKI_LEADERBOARD): boolean {
  if (!scoreSubmit || !Number.isFinite(score)) return false;
  try {
    scoreSubmit(leaderboard, Math.round(score));
    return true;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    PokiSDK?: PokiSdk;
  }
}

const EMPTY_INFO: PlatformSystemInfo = {
  countryCode: null,
  locale: null,
  deviceType: null,
  osName: null,
  osVersion: null,
  browserName: null,
  browserVersion: null,
  applicationType: null,
};

/** Dismissed share sheet = the surface was shown; report it as handled. */
function shareDismissed(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
}

/**
 * Last-resort loading-screen release, registered into the shared net
 * (sdk/net.ts). This is the ONLY place in the codebase that may call the raw
 * `PokiSDK` global behind the adapter's back, and it only ever runs when no
 * adapter was constructed — i.e. nothing has signalled the portal yet. On a
 * healthy boot the adapter owns both markers, one-shot, and this never fires.
 */
setLoadingNet(() => {
  const sdk = (window as unknown as { PokiSDK?: PokiSdk }).PokiSDK;
  // gameLoadingFinished() is the documented conversion-to-play marker; the
  // failsafe fires it exactly once. (`gameInteractive` also exists in the CDN
  // build but is the legacy marker — see POKI_SDK_RUNTIME_ONLY.)
  sdk?.gameLoadingFinished?.();
});

export class PokiAdapter implements PlatformAdapter {
  readonly name = "poki" as const;
  readonly ready = true;

  /** AUDS client — non-null only when VITE_POKI_GAME_ID is configured. */
  private readonly auds: PokiAuds | null = createAudsIfConfigured();

  constructor(private readonly events: PlatformEvents) {}

  private get sdk(): PokiSdk | undefined {
    return window.PokiSDK;
  }

  capabilities(): string[] {
    const caps = ["lifecycle", "cloudSaveLocal", "identity", "iap", "urlParams", "share", "measure"];
    // Canonical locale source: getLanguage() reads Poki's `iso_lang` URL param
    // and falls back to navigator.language, then reduces to the base tag.
    if (typeof this.sdk?.getLanguage === "function") caps.push("language");
    if (typeof this.sdk?.happyTime === "function") caps.push("celebration");
    // "ads" is reported from the live SDK, not from the build target. Off the
    // Poki CDN (local preview, CDN blocked, SDK rejected) there is no ad
    // surface at all, and the game must not offer breaks or rewarded buttons
    // that can only fail — it offers the coin/gold paths instead.
    if (typeof this.sdk?.commercialBreak === "function" || typeof this.sdk?.rewardedBreak === "function") {
      caps.push("ads");
    }
    // Reported from what the deployed SDK actually exposes, so the UI never
    // offers a portal surface that isn't there.
    if (typeof this.sdk?.showLeaderboard === "function" || pokiLeaderboardReady()) caps.push("leaderboard");
    if (typeof this.sdk?.playtestSetCanvas === "function") caps.push("playtestCanvas");
    if (typeof this.sdk?.openExternalLink === "function") caps.push("externalLink");
    if (typeof this.sdk?.getDeviceInfo === "function") caps.push("deviceInfo");
    return caps;
  }

  environment(): string | null {
    return null;
  }

  /* lifecycle */
  loadingStart(): void {
    // Poki marks the loading phase with gameLoadingStart(). bootstrapSdk()
    // already fired it right after init (before the game's asset work), so
    // this delegate exists for interface symmetry — re-sending a phase
    // marker is harmless.
    this.sdk?.gameLoadingStart?.();
  }

  private loadingFinishedSent = false;

  loadingFinished(): void {
    // Phase markers are one-shot: Poki's "no consecutive duplicates" rule
    // (enforced by the Inspector) is applied to the loading signal too.
    if (this.loadingFinishedSent) return;
    this.loadingFinishedSent = true;
    this.sdk?.gameLoadingFinished?.();
  }

  /**
   * The interface name comes from CrazyGames (`game.signalGameReady`). Poki has
   * no such method: the canonical "the player can play now" signal is
   * `gameLoadingFinished()`, so this delegates to it (one-shot) instead of
   * calling a member that would never exist.
   */
  signalGameReady(): void {
    this.loadingFinished();
  }

  /**
   * Poki's hard lifecycle rule: `gameplayStart()` must never follow another
   * `gameplayStart()`, and the same for stop — the Inspector's Event Log flags
   * consecutive duplicates, and its dashboard derives session length from the
   * alternation.
   *
   * The primary guard is `GameplayEventSink` in the game, which every phase
   * emission funnels through. This is the backstop at the boundary the portal
   * actually observes, so that no *future* call path — a late SDK landing, a
   * visibility handler, a defensive resend around a break — can emit a duplicate
   * the sink never saw. A stop before any start is dropped for the same reason:
   * the portal cannot stop a session it was never told began.
   */
  private gameplayRunning = false;

  gameplayStart(): void {
    if (this.gameplayRunning) return;
    this.gameplayRunning = true;
    this.sdk?.gameplayStart?.();
  }

  gameplayStop(): void {
    if (!this.gameplayRunning) return;
    this.gameplayRunning = false;
    this.sdk?.gameplayStop?.();
  }

  /** Test/inspection helper: has the portal been told gameplay is running? */
  get gameplayIsRunning(): boolean {
    return this.gameplayRunning;
  }

  pause(): void {
    /* no portal pause hook on Poki — visibility handling covers it. */
  }

  /**
   * `PokiSDK.happyTime(intensity)` — intensity is 0…1 (Defold guide:
   * "value is between 0 and 1"). The adapter previously called `happytime()`,
   * which is CrazyGames' spelling: on Poki the optional chain resolved to
   * undefined and **no celebration ever reached the portal**. Fire-and-forget,
   * clamped, and never throws — the game runs its own confetti regardless.
   */
  happyTime(intensity: number): void {
    try {
      this.sdk?.happyTime?.(clampHappyIntensity(intensity));
    } catch {
      /* celebrate locally — the game already emits its own confetti */
    }
  }

  /* ads */
  async commercialBreak(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk?.commercialBreak) return;
    let opened = false;
    try {
      await sdk.commercialBreak(() => {
        opened = true;
        this.events.onAdOpened?.();
      });
    } catch {
      // The portal decides whether an ad is available. A rejected opportunity
      // is not a game error and must never block a restart.
    } finally {
      if (opened) this.events.onAdClosed?.();
    }
  }

  async rewardedBreak(): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk?.rewardedBreak) return false;
    let opened = false;
    try {
      const rewarded = await sdk.rewardedBreak(() => {
        opened = true;
        this.events.onAdOpened?.();
      });
      return Boolean(rewarded);
    } catch {
      return false;
    } finally {
      if (opened) this.events.onAdClosed?.();
    }
  }

  async showMidgameAd(): Promise<void> {
    await this.commercialBreak();
  }

  async showRewardedAd(): Promise<boolean> {
    return this.rewardedBreak();
  }

  mountBanner(_container: HTMLElement): void {
    // Poki intentionally does not expose a banner placement API.
  }

  /** Cache the Poki user id after first resolution so we don't await on every save. */
  private _cachedAudsUserId: string | null | undefined = undefined;
  private async _audsUserId(): Promise<string | null> {
    if (this._cachedAudsUserId !== undefined) return this._cachedAudsUserId;
    try {
      const u = await this.sdk?.getUser?.();
      this._cachedAudsUserId = u?.username ?? null;
    } catch {
      this._cachedAudsUserId = null;
    }
    return this._cachedAudsUserId;
  }

  /** Cached ad-block detection result (probed once, resolved at most once). */
  private adBlockProbed = false;
  private cachedAdBlock = false;

  /**
   * `PokiSDK.isAdBlocked()` is the canonical probe (the invented
   * `hasAdBlock`/`setAdBlockActive` pair does not exist in any Poki build, so
   * the old probe always read false). The loader stub answers `{}` while the
   * core decides, so every shape is handled: boolean, promise, or junk.
   *
   * Detection never gates content — Poki's policy forbids that — it only lets
   * ad opportunities short-circuit instead of hanging.
   */
  private probeAdBlock(): void {
    if (this.adBlockProbed) return;
    this.adBlockProbed = true;
    try {
      const result = this.sdk?.isAdBlocked?.();
      if (typeof result === "boolean") this.cachedAdBlock = result;
      else if (result instanceof Promise) {
        void result
          .then((v) => { this.cachedAdBlock = typeof v === "boolean" ? v : false; })
          .catch(() => { this.cachedAdBlock = false; });
      }
    } catch { /* ignore */ }
  }

  /* cloud save — AUDS when game id configured, localStorage fallback otherwise */
  async saveCloud<T>(key: string, value: T): Promise<void> {
    if (this.auds) {
      try {
        const userId = await this._audsUserId();
        const existingId = PokiAuds.readSingletonId(AUDSPREFIX.settings, userId ?? undefined);
        const slot = await this.auds.putSingleton(
          AUDSPREFIX.settings,
          { key },
          { key, value: JSON.stringify(value) },
          { existingId, userId: userId ?? undefined },
        );
        if (slot) return;
      } catch { /* fall through to local */ }
    }
    return localCloudFallback.save(key, value);
  }

  async loadCloud<T>(key: string): Promise<T | null> {
    if (this.auds) {
      try {
        const userId = await this._audsUserId();
        const id = PokiAuds.readSingletonId(AUDSPREFIX.settings, userId ?? undefined);
        if (id) {
          const entry = await this.auds.fetchById(AUDSPREFIX.settings, id);
          if (entry?.data) {
            const raw = (entry.data as Record<string, unknown>)["value"];
            if (typeof raw === "string") return JSON.parse(raw) as T;
          }
        }
      } catch { /* fall through to local */ }
    }
    return localCloudFallback.load<T>(key);
  }

  removeCloud(key: string): Promise<void> {
    return localCloudFallback.remove(key);
  }
  clearCloud(): Promise<void> {
    return localCloudFallback.clear();
  }
  hasCloud(key: string): Promise<boolean> {
    return localCloudFallback.has(key);
  }

  /* identity / portal leaderboard / IAP */
  async getIdentity(): Promise<PlatformIdentity | null> {
    const sdk = this.sdk;
    if (!sdk?.getUser) return null;
    try {
      const u = await sdk.getUser();
      if (!u || !u.username) return null;
      // `optedIn` is part of the official User shape: a player who has not
      // opted in must not be surfaced as an identity anywhere in the game.
      if (u.optedIn === false) return null;
      return {
        id: u.username,
        name: u.username,
        avatarUrl: typeof u.avatarUrl === "string" && u.avatarUrl ? u.avatarUrl : null,
        countryCode: null,
        platform: "poki",
      };
    } catch {
      return null; // user accounts unavailable or user opted out
    }
  }

  getSystemInfo(): PlatformSystemInfo {
    // Poki exposes locale via getLanguage() but does not expose device/OS
    // descriptors to the game (the portal abstracts them). Provide what we
    // can detect locally, leave the rest null.
    const locale = (() => {
      try { return this.sdk?.getLanguage?.() ?? navigator.language ?? null; } catch { return null; }
    })();
    const deviceType: PlatformSystemInfo["deviceType"] = (() => {
      try {
        const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
        const narrow = window.innerWidth < 700;
        const ipad = /Macintosh/i.test(navigator.userAgent) && coarse;
        const tablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) || ipad;
        if (tablet) return "tablet";
        if (coarse || narrow || /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent)) return "mobile";
        return "desktop";
      } catch { return null; }
    })();
    return { ...EMPTY_INFO, locale, deviceType };
  }

  async submitPlatformScore(score: number): Promise<void> {
    // Poki's own leaderboards: the SDK handed us a submitter during
    // init({ submitScore }). Best-effort — the in-game board (AUDS) is the
    // authoritative surface, so a missing handle is not an error.
    pokiSubmitScore(score);
  }

  /* ------------------------------------------- Poki-native UI & diagnostics */

  /** Poki's own leaderboard overlay (`PokiSDK.showLeaderboard`). */
  showLeaderboard(id?: number | null): void {
    try {
      this.sdk?.showLeaderboard?.(id ?? null);
    } catch { /* never break the menu over a portal overlay */ }
  }

  /** Register the gameplay canvas so playtest recordings capture the game. */
  playtestSetCanvas(canvas: HTMLCanvasElement | HTMLCanvasElement[] | null): void {
    try {
      this.sdk?.playtestSetCanvas?.(canvas);
    } catch { /* recorder optional */ }
  }


  /**
   * Canonical locale source: `PokiSDK.getLanguage()` returns the base tag of
   * Poki's `iso_lang` URL param, or `navigator.language` when absent. The game
   * prefers this over its own sniffing on a portal build, so a player who set a
   * language on poki.com gets it in-game.
   */
  portalLanguage(): string | null {
    try {
      const value = this.sdk?.getLanguage?.();
      return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Reposition the Poki Pill on mobile: `movePill(topPercent, topPx)`, where
   * topPercent is 0–50 and topPx is an extra offset (default `movePill(0, 24)`).
   * Exposed so the HUD can keep the pill off its own controls once a device
   * check says they collide; it is not called speculatively.
   */
  movePill(topPercent: number, topPx: number): void {
    try {
      this.sdk?.movePill?.(
        Math.min(50, Math.max(0, Number.isFinite(topPercent) ? topPercent : 0)),
        Number.isFinite(topPx) ? topPx : 0,
      );
    } catch { /* cosmetic only */ }
  }

  /** Device class as the portal sees it (tablets are "tablet", not "mobile"). */
  deviceCategory(): "mobile" | "tablet" | "desktop" | null {
    try {
      return this.sdk?.getDeviceInfo?.()?.category ?? null;
    } catch {
      return null;
    }
  }

  /** External navigation must go through the portal, never `location.href`. */
  openExternalLink(url: string): void {
    try {
      this.sdk?.openExternalLink?.(url);
    } catch { /* no external links are shipped today; stay inert */ }
  }

  async requestAccountLink(): Promise<boolean> {
    return false; // Poki has no account-link prompt
  }

  async getIapToken(): Promise<string | null> {
    const sdk = this.sdk;
    if (!sdk?.getToken) return null;
    try {
      const token = await sdk.getToken();
      return typeof token === "string" && token ? token : null;
    } catch {
      return null;
    }
  }

  /* invites / rooms / share */
  isInstantMultiplayer(): boolean {
    return false;
  }

  getInviteParam(name: string): string | null {
    const sdk = this.sdk;
    if (!sdk?.getURLParam) return null;
    try {
      const value = sdk.getURLParam(name);
      return typeof value === "string" && value ? value : null;
    } catch {
      return null;
    }
  }

  getInviteParams(): InviteParams | null {
    return null;
  }

  onJoinRoom(_listener: (params: InviteParams) => void): () => void {
    return () => undefined;
  }

  async inviteFriends(_params: InviteParams): Promise<string | null> {
    return null;
  }

  updateRoom(_opts: { roomId?: string; isJoinable?: boolean; inviteParams?: InviteParams }): void {
    /* no portal room state on Poki */
  }

  leftRoom(): void {
    /* no portal room state on Poki */
  }

  /**
   * Portal-native share: ask the SDK for a signed shareable URL carrying the
   * share params (each key is prefixed `gd` on poki.com and readable again
   * with `getURLParam`), then hand URL + message to the Web Share API
   * (clipboard fallback when the sheet is unavailable).
   */
  async share(message: string, params?: InviteParams): Promise<boolean> {
    let url: string | null = null;
    const sdk = this.sdk;
    if (sdk?.shareableURL) {
      try {
        const data: PokiShareableData = { id: "sunbird" };
        for (const [key, value] of Object.entries(params ?? {})) {
          data[key] = value.slice(0, 64);
        }
        const built = await sdk.shareableURL(data);
        if (typeof built === "string" && built) url = built;
      } catch {
        /* fall through to a plain share */
      }
    }
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Sunbird", text: message, url: url ?? undefined });
        return true;
      } catch (error) {
        return shareDismissed(error);
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url ?? message);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Game Events: `PokiSDK.measure(category, what, action)` — the official
   * signature (the second parameter is `what`, not `label`).
   *
   * Arguments go through `sanitizeMeasure`, which enforces the three rules the
   * live SDK enforces: category+what required, no `/` or `^`, and at most two
   * numeric values across all three. An event that violates them is dropped by
   * Poki with only a console error, so rejecting it here keeps the funnel honest
   * (and `import.meta.env.DEV` surfaces the mistake to us instead, through
   * `console.debug` — the one channel the production gate allows, since
   * `console.warn` would ship a red line into every player's console).
   */
  measure(category: string, what: string, action: string): void {
    const clean = sanitizeMeasure(category, what, action);
    if (!clean) {
      if (import.meta.env.DEV) {
        console.debug(`[poki] measure() dropped — invalid (${category}, ${what}, ${action})`);
      }
      return;
    }
    try {
      this.sdk?.measure?.(clean.category, clean.what, clean.action);
    } catch {
      /* measurement must never break gameplay */
    }
  }

  /* ad-block state */
  hasAdBlock(): boolean {
    this.probeAdBlock();
    return this.cachedAdBlock;
  }

  /* settings */
  /**
   * Poki exposes **no** mute preference and no settings-change event — the
   * invented `isMuted()`/`mute()`/`setAdBlockActive()` calls here never
   * resolved, so `onPortalMute` never fired and the code only looked like it
   * honoured a portal setting. Audio during breaks is handled where Poki
   * documents it: the game mutes itself around `commercialBreak`/`rewardedBreak`
   * (Game.beginPortalAd/endPortalAd). All that is left to probe is ad-block.
   */
  syncSettings(): void {
    this.probeAdBlock();
  }
  isMuted(): boolean {
    return false;
  }
  getSettings(): { muteAudio: boolean; disableChat: boolean } {
    return { muteAudio: this.isMuted(), disableChat: false };
  }

  /* error reporting */
  captureError(err: string | Error): void {
    const sdk = this.sdk;
    if (!sdk?.captureError) return;
    try {
      sdk.captureError(err);
    } catch {
      /* Poki error capture is best-effort */
    }
  }
}
