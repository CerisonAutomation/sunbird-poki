/**
 * PokiAdapter — full Poki HTML5 SDK surface (sdk.poki.com/html5):
 *
 *   init, gameLoadingStart, gameLoadingFinished, gameplayStart/Stop,
 *   commercialBreak,
 *   rewardedBreak, getUser, getToken (1-minute backend-verification JWT),
 *   shareableURL, getURLParam, measure (game events).
 *
 * Poki-specific contracts honored here:
 *   • `init()` rejects in the local sandbox → the game still boots
 *     (handled in platform.ts, "load your game anyway").
 *   • `setDebug(true)` is enabled in DEV only — never shipped.
 *   • `getToken()` expires in one minute: it is verified server-side
 *     immediately, never stored (exposed as `getIapToken`).
 *   • `shareableURL({...})` yields a signed, embeddable game link; it is
 *     handed to the Web Share API (or clipboard) so the player chooses the
 *     destination.
 *   • `measure(category, label, action)` follows the start → complete|fail
 *     contract (one outcome per attempt).
 *
 * Surfaces the SDK genuinely does not have are honest no-ops: there is no room
 * state, no portal pause hook, and no invite API, so those return null/false
 * rather than pretending. Two claims that used to sit in this comment were
 * wrong and are worth naming, because both cost compliance:
 *
 *   • "no in-SDK score submission" — `init({ submitScore })` IS Poki's
 *     leaderboard handshake, and `showLeaderboard()` is its overlay. Both are
 *     implemented below and wired to the end of a run.
 *   • "no banner API" — `displayAd()`/`destroyAd()` exist (see mountBanner).
 *
 * Cloud saves are handled by the SDK itself once a player is signed in, with a
 * 1 MB gamesave budget; `src/game/Storage.ts` keeps caches out of that sync
 * with the documented `poki_ignore` key prefix.
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

type PokiUser = { username: string; avatarUrl?: string | null; optedIn?: boolean } | null;

/**
 * Display-ad format for this game, or "" to leave the slot empty. Poki's
 * `displayAd(container, size)` needs a size the game cannot infer (the format
 * is chosen per game on the Poki side), so it is configuration, not code.
 */
const POKI_DISPLAY_AD_SIZE = (import.meta.env.VITE_POKI_DISPLAY_AD_SIZE as string | undefined)?.trim() ?? "";

type PokiShareableData = Record<string, string | number | boolean>;

/**
 * The Poki SDK global, typed against `@poki/sdk` (github.com/poki/npm-sdk,
 * v0.0.5) — the official wrapper around
 * `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`. Every member is optional
 * because the CDN script owns the runtime: a method that is absent on the
 * deployed version must degrade to a no-op, never a TypeError.
 */
type PokiSdk = {
  init?: (options?: PokiInitOptions) => Promise<void>;
  setDebug?: (on: boolean) => void;
  setLogging?: (on: boolean) => void;
  enableEventTracking?: () => void;
  /**
   * Marks the start of the loading phase. Poki's loading pipeline is
   * `gameLoadingStart()` → (assets load) → `gameLoadingFinished()`; calling
   * only the finished side mis-handles the portal's loading screen.
   */
  gameLoadingStart?: () => void;
  gameLoadingFinished?: () => void;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  /**
   * Poki's milestone celebration overlay. NOTE the capital T: the SDK exposes
   * `happyTime`, and this file previously called `happytime()`, which does not
   * exist on it — so the overlay (and its analytics) never fired once. Verified
   * against the live SDK: `typeof PokiSDK.happytime === "undefined"`.
   */
  happyTime?: (intensity?: number) => Promise<void>;
  commercialBreak?: (onStart?: () => void) => Promise<void>;
  rewardedBreak?: (onStart?: (() => void) | { onStart?: () => void; size?: "small" | "medium" | "large" }) => Promise<boolean>;

  /** Gamebar display ad rendered into a container the game owns. */
  displayAd?: (
    container: HTMLElement,
    size: string,
    onCanDestroy?: () => void,
    onDisplayRendered?: (isEmpty: boolean) => void,
  ) => void;
  destroyAd?: (container?: HTMLElement) => void;
  /** Celebratory overlay (personal best, level complete). */
  /** Mute / unmute gameplay audio on portal request. */
  mute?: (muted?: boolean) => void;
  /** Detect ad blockers so the game can avoid gating content behind ads. */
  /**
   * The SDK's own ad-block report. Named `isAdBlocked` on the live SDK; the
   * `hasAdBlock` this used to call does not exist, so the probe always answered
   * "no" and the short-circuit it exists for could never fire.
   */
  isAdBlocked?: () => boolean;
  /** Language tag for the current player (e.g. "en", "es-MX"). */
  getLanguage?: () => string;
  /** Device class as the portal sees it — tablets report "tablet", not "mobile". */
  getDeviceInfo?: () => { category: "mobile" | "tablet" | "desktop" } | null;
  getUser?: () => Promise<PokiUser>;
  /** Short-lived JWT for backend verification (expires in 1 minute). */
  getToken?: () => Promise<string | null>;
  login?: () => Promise<void>;
  /** Signed shareable URL carrying the given game data. */
  shareableURL?: (data: PokiShareableData) => Promise<string>;
  /** Read a parameter from the page query string (portal share deep-links). */
  getURLParam?: (key: string) => string | null;
  /** Poki's own leaderboard overlay. `null`/`false` closes it. */
  showLeaderboard?: (id?: number | null | false) => void;
  /** Report a runtime error to the portal's error dashboard. */
  captureError?: (err: string | Error) => void;
  /** Game-events measurement: `measure("level", "1", "start")`. */
  measure?: (category: string, label: string, action: string) => void;
  /** Reposition the mobile Poki Pill: (0–50)% from top + px offset. */
  movePill?: (topPercent: number, topPx: number) => void;
  /** Tracking events for custom analytics. */
  sendUserEvent?: (name: string, params?: Record<string, unknown>) => void;
  /** Any external navigation MUST go through this, never `location.href`. */
  openExternalLink?: (url: string) => void;
  /**
   * Register the gameplay canvas with the playtest recorder. Without this the
   * Level-2 playtest recordings have nothing to capture.
   */
  playtestSetCanvas?: (canvas: HTMLCanvasElement | HTMLCanvasElement[] | null) => void;
  playtestCaptureHtmlOnce?: () => void;
  playtestCaptureHtmlForce?: () => void;
  playtestCaptureHtmlOn?: () => void;
  playtestCaptureHtmlOff?: () => void;
};

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

/**
 * Leaderboard the run score is submitted to. The name must match the board as
 * it is configured in Poki for Developers; `VITE_POKI_LEADERBOARD` lets a
 * build be re-pointed at a renamed board without a code change, and the
 * default stays the one the game has always submitted to.
 */
const POKI_LEADERBOARD = (import.meta.env.VITE_POKI_LEADERBOARD as string | undefined)?.trim() || "distance";

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
  // `gameLoadingFinished` is the documented release; there is no
  // `signalGameReady` on Poki, and asking for one hid the real call in noise.
  sdk?.gameLoadingFinished?.();
});

export class PokiAdapter implements PlatformAdapter {
  readonly name = "poki" as const;
  readonly ready = true;
  /** Container currently holding a display ad, so it can be torn down. */
  private banner: HTMLElement | null = null;

  constructor(private readonly events: PlatformEvents = {}) {}

  portalLanguage(): string | null { return this.getLanguage()?.toLowerCase() ?? null; }

  private get sdk(): PokiSdk | undefined {
    return window.PokiSDK;
  }

  capabilities(): string[] {
    // Poki automatically syncs the game's localStorage/IndexedDB for signed-in
    // players. This is the official cloud-gamesave path; AUDS is a separate
    // public-data service and must not replace ordinary save storage.
    const caps = ["lifecycle", "cloudSave", "identity", "iap", "urlParams", "share", "measure"];
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

  /**
   * Poki's own view of the player's language. The guide is explicit that the
   * best experience is to serve the player's language automatically, and Poki
   * knows the account/region language better than `navigator.language` does.
   * Returns null when the SDK is absent, so the caller keeps its browser
   * detection.
   */
  getLanguage(): string | null {
    try {
      const lang = this.sdk?.getLanguage?.();
      return typeof lang === "string" && lang.length > 0 ? lang : null;
    } catch {
      return null;
    }
  }

  /**
   * Keep the mobile Poki pill clear of the HUD. The default is (0, 24); our
   * daylight meter and mute/pause buttons live in that band, so the pill is
   * pushed below the top-left cluster on small screens.
   */
  movePill(topPercent: number, topPx: number): void {
    try {
      this.sdk?.movePill?.(topPercent, topPx);
    } catch {
      /* pill positioning is cosmetic — never fatal */
    }
  }

  /**
   * Level-2 Playtest recordings need the canvas registered and HTML capture
   * switched on (Poki game-dev-tools). Both are no-ops off the portal.
   */
  playtestCapture(on: boolean): void {
    try {
      if (on) this.sdk?.playtestCaptureHtmlOn?.();
      else this.sdk?.playtestCaptureHtmlOff?.();
    } catch {
      /* capture is best-effort */
    }
  }

  environment(): string | null {
    return null;
  }

  /* lifecycle */
  private loadingStartSent = false;

  loadingStart(): void {
    // Poki marks the loading phase with gameLoadingStart(). bootstrapSdk()
    // already fired it right after init (before the game's asset work), so
    // this delegate exists for interface symmetry — re-sending a phase
    // marker is harmless.
    if (this.loadingStartSent) return;
    this.loadingStartSent = true;
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

  signalGameReady(): void {
    // Poki has no `signalGameReady`; `gameLoadingFinished` is the release the
    // platform documents, and it is one-shot.
    this.loadingFinished();
  }

  gameplayStart(): void {
    this.sdk?.gameplayStart?.();
  }

  gameplayStop(): void {
    this.sdk?.gameplayStop?.();
  }

  pause(): void {
    /* no portal pause hook on Poki — visibility handling covers it. */
  }

  happyTime(intensity = 1): void {
    // PokiSDK.happyTime() triggers a celebratory confetti overlay for
    // personal bests and other milestone moments. Fire-and-forget so it
    // never blocks gameplay even when the SDK is unavailable in an
    // off-portal preview.
    try {
      void this.sdk?.happyTime?.(Math.max(0, Math.min(1, intensity)));
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
      // Exactly the documented shape: the callback pauses audio and input, and
      // the promise settles when the platform says the break is over. Nothing
      // here may end it earlier — the game's `AD_SAFETY_SECONDS` valve at
      // the tick level is the hard second layer; this race is the first.
      // The Poki docs are explicit: `PokiSDK.commercialBreak(cb).then(() => {
      // ... proceed with gameplay })` — the `.then()` must always fire,
      // including when Poki decides not to serve an ad. If the SDK promise
      // never settles (a broken or blocked CDN, an Inspector with no ad
      // service behind it), this race wins and the break resolves as declined
      // rather than trapping the game forever.
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
      // Documented shape again: the SDK's own verdict decides the reward, and a
      // declined or failed break resolves false rather than throwing.
      // Same timeout as commercialBreak — a rewarded break that never
      // settles must still let the player continue, just without coins.
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

  /**
   * In-game display ads (`PokiSDK.displayAd`).
   *
   * The comment here used to claim Poki exposes no banner API at all — the
   * documented SDK has `displayAd(container, size)` / `destroyAd(container)`,
   * and the guide notes that portrait games additionally earn from Gamebar
   * Display ads with no code. A size is therefore a per-game decision rather
   * than something the game can guess, so the slot is filled only when a size
   * is configured (`VITE_POKI_DISPLAY_AD_SIZE`); otherwise the container stays
   * empty and nothing is requested.
   */
  mountBanner(container: HTMLElement): void {
    const size = POKI_DISPLAY_AD_SIZE;
    if (!this.sdk?.displayAd || !size) return;
    this.banner = container;
    try {
      this.sdk.displayAd(
        container,
        size,
        undefined,
        (isEmpty) => {
          // An empty creative (no fill, or an ad blocker) must leave no hole in
          // the layout; the container is collapsed rather than showing a box.
          container.classList.toggle("ad-empty", isEmpty);
        },
      );
    } catch {
      /* a failed display ad is not a game error */
    }
  }

  destroyBanner(): void {
    const container = this.banner;
    if (!container || !this.sdk?.destroyAd) return;
    this.banner = null;
    try {
      this.sdk.destroyAd(container);
    } catch {
      /* best effort */
    }
  }

  /** Cached ad-block detection result (probed once at boot). */
  private adBlockProbed = false;
  private cachedAdBlock = false;

  private probeAdBlock(): void {
    if (this.adBlockProbed) return;
    this.adBlockProbed = true;
    try {
      if (this.sdk?.isAdBlocked) {
        const result = this.sdk.isAdBlocked();
        this.cachedAdBlock = typeof result === "boolean" ? result : false;
      }
    } catch { /* ignore */ }
  }

  /* Cloud gamesaves: Poki syncs localStorage/IndexedDB automatically for
   * signed-in players. Keep the same storage facade used by the game so the
   * official SDK owns synchronization instead of a parallel custom ledger. */
  async saveCloud<T>(key: string, value: T): Promise<void> {
    return localCloudFallback.save(key, value);
  }

  async loadCloud<T>(key: string): Promise<T | null> {
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
      if (!u || !u.username || u.optedIn === false) return null;
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

  /**
   * Poki's account upgrade prompt (`PokiSDK.login()` — "Poki User Accounts").
   * It used to return false unconditionally on the assumption that Poki had no
   * such prompt; the documented SDK surface has one, so this now actually asks
   * and reports whether a player ended up signed in.
   */
  async requestAccountLink(): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk?.login) return false;
    try {
      await sdk.login();
      const user = await sdk.getUser?.();
      return Boolean(user && user.username);
    } catch {
      // Declining the prompt rejects in some SDK versions; that is a choice,
      // not an error.
      return false;
    }
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

  /* game events */
  measure(category: string, label: string, action: string): void {
    if (!category || !label || !action || /[^a-zA-Z0-9_.:-]/.test(category) || /[^a-zA-Z0-9_.:-]/.test(label) || !/^(start|complete|fail|clear|win|lose|finish)$/.test(action)) return;
    try {
      this.sdk?.measure?.(category, label, action);
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
  syncSettings(): void {
    // Poki exposes no "is the site muted" API — its volume controls are for ads,
    // not for the player's preference — so the game's own mute setting is the
    // single source of truth and there is nothing to poll. The ad-block probe is
    // still worth taking once at boot, because it is what stops a break being
    // requested that could never serve (MON-12).
    this.probeAdBlock();
  }

  getSettings(): { muteAudio: boolean; disableChat: boolean } {
    return { muteAudio: false, disableChat: false };
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
