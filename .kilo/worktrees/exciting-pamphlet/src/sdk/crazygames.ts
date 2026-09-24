/**
 * CrazyGamesAdapter — the complete official CrazyGames SDK v3 surface.
 *
 * Every capability is feature-detected against the typed model below (which
 * mirrors the documented v3 API: game / user / ad / data modules). Anything
 * the loaded SDK does not expose degrades to an honest no-op or local
 * fallback; nothing throws into the game.
 *
 * Canonical surface covered:
 *   game    — loadingStart/Stop, signalGameReady, gameplayStart/Stop,
 *             happytime, settings (+ change listener), getSettings,
 *             isInstantMultiplayer, inviteParams, getInviteParam,
 *             addJoinRoomListener/removeJoinRoomListener, showInviteButton,
 *             updateRoom, leftRoom, onPause/onResume, share (when exposed)
 *   user    — getUser, systemInfo, addScore, getUserToken/getXsollaUserToken,
 *             showAccountLinkPrompt
 *   ad      — requestAd("midgame"|"rewarded", …), requestBanner/showBanner
 *   data    — setItem/getItem/removeItem/clear/hasKey (cloud save)
 *
 * Cloud saves route to the portal data module only while the SDK reports
 * environment "crazygames"; outside the portal (local preview, disabled)
 * they fall back to localStorage so the save pipeline stays functional.
 */
import type {
  InviteParams,
  PlatformAdapter,
  PlatformEvents,
  PlatformIdentity,
  PlatformSystemInfo,
} from "./platform";
import { storage as storageFacade, type StorageLike } from "../game/Storage";

/* ------------------------------------------------------------ SDK model */

export type CrazyAdType = "midgame" | "rewarded";

type CrazyAdCallbacks = {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error?: unknown, data?: unknown) => void;
};

export type CrazyGamesSdk = {
  init?: () => Promise<void> | void;
  /** "local" | "crazygames" | "disabled" */
  environment?: string;
  game?: {
    loadingStart?: () => void;
    loadingStop?: () => void;
    signalGameReady?: () => void;
    gameplayStart?: () => void;
    gameplayStop?: () => void;
    happytime?: () => Promise<void> | void;
    pause?: () => void;
    share?: (message?: string) => Promise<void> | void;
    settings?: { muteAudio?: boolean; disableChat?: boolean };
    getSettings?: () => { muteAudio?: boolean; disableChat?: boolean } | undefined;
    addSettingsChangeListener?: (listener: (settings: { muteAudio?: boolean; disableChat?: boolean }) => void) => void;
    removeSettingsChangeListener?: (listener: (settings: { muteAudio?: boolean; disableChat?: boolean }) => void) => void;
    onPause?: (listener: () => void) => void;
    onResume?: (listener: () => void) => void;
    isInstantMultiplayer?: boolean;
    inviteParams?: InviteParams | null;
    getInviteParam?: (name: string) => string | null;
    addJoinRoomListener?: (listener: (params: InviteParams) => void) => void;
    removeJoinRoomListener?: (listener: (params: InviteParams) => void) => void;
    showInviteButton?: (params: InviteParams | string) => string;
    inviteLink?: (params: InviteParams | string) => string;
    updateRoom?: (data: { roomId?: string; isJoinable?: boolean; inviteParams?: InviteParams }) => void;
    leftRoom?: () => void;
  };
  user?: {
    getUser?: () => Promise<{ username: string; profilePictureUrl?: string } | null>;
    systemInfo?: {
      countryCode?: string;
      locale?: string;
      device?: { type?: string };
      os?: { name?: string; version?: string };
      browser?: { name?: string; version?: string };
      applicationType?: string;
    };
    /** Portal leaderboard. May be callback- or promise-style. */
    addScore?: (score: number, onError?: (error?: unknown) => void) => Promise<void> | void;
    getUserToken?: () => Promise<string>;
    getXsollaUserToken?: () => Promise<string>;
    showAccountLinkPrompt?: () => Promise<unknown>;
  };
  analytics?: {
    logEvent?: (params: Record<string, unknown>) => void;
    setUserId?: (userId: string) => void;
  };
  ad?: {
    /**
     * v3 positional form: (type, onStart, onFinished, onError). Older builds
     * accept an object: (type, { adStarted, adFinished, adError }).
     */
    requestAd?: (
      type: CrazyAdType,
      onStart: () => void,
      onFinished: () => void,
      onError: (error?: unknown) => void,
    ) => void;
    requestBanner?: (containers: { containerId: string; size: string }[]) => Promise<unknown>;
    showBanner?: (containerId: string) => Promise<unknown> | void;
    hideBanner?: (containerId: string) => Promise<unknown> | void;
  };
  data?: {
    setItem?: (key: string, value: string | number) => Promise<void> | void;
    getItem?: (key: string) => Promise<string | null> | string | null;
    removeItem?: (key: string) => Promise<void> | void;
    clear?: () => Promise<void> | void;
    hasKey?: (key: string) => Promise<boolean> | boolean;
  };
};

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazyGamesSdk };
  }
}

/* ------------------------------------------------------------- adapters */

const LOCAL_SAVE_PREFIX = "sunbird.cloud.";
/** Watchdog: if neither ad callback fires this fast, the SDK shape is not
 *  recognized — resolve instead of hanging the game's break flow. */
const AD_CALLBACK_WATCHDOG_MS = 2_000;

/**
 * Cross-safe storage backend: localStorage → sessionStorage → memory (see
 * Storage.ts) — the raw localStorage accessor throws in sandboxed portal
 * iframes, where this fallback previously no-opped.
 */
function storage(): StorageLike {
  return storageFacade;
}

function localGet(key: string): string | null {
  try {
    return storage()?.getItem(`${LOCAL_SAVE_PREFIX}${key}`) ?? null;
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    storage()?.setItem(`${LOCAL_SAVE_PREFIX}${key}`, value);
  } catch {
    /* quota/privacy mode — save pipeline degrades to memory-only */
  }
}

function localRemove(key: string): void {
  try {
    storage()?.removeItem(`${LOCAL_SAVE_PREFIX}${key}`);
  } catch {
    /* ignore */
  }
}

function localKeys(): string[] {
  try {
    const out: string[] = [];
    const ls = storage();
    if (!ls) return out;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(LOCAL_SAVE_PREFIX)) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

export class CrazyGamesAdapter implements PlatformAdapter {
  readonly name = "crazy" as const;
  readonly ready = true;

  constructor(
    private readonly events: PlatformEvents,
    private readonly bannerId: string,
  ) {}

  private get sdk(): CrazyGamesSdk | undefined {
    return window.CrazyGames?.SDK;
  }

  private get game(): CrazyGamesSdk["game"] | undefined {
    return this.sdk?.game;
  }

  private get user(): CrazyGamesSdk["user"] | undefined {
    return this.sdk?.user;
  }

  /** True when running on the actual portal (data module really persists). */
  private get onPortal(): boolean {
    return this.sdk?.environment === "crazygames";
  }

  capabilities(): string[] {
    const caps: string[] = ["lifecycle", "ads", "mute", "pause"];
    if (this.user?.getUser) caps.push("identity");
    if (this.user?.systemInfo) caps.push("systemInfo");
    if (this.user?.addScore) caps.push("portalLeaderboard");
    if (this.user?.getXsollaUserToken || this.user?.getUserToken) caps.push("iap");
    if (this.game?.showInviteButton || this.game?.inviteLink) caps.push("invites");
    if (this.game?.addJoinRoomListener) caps.push("instantMultiplayer");
    if (this.game?.share) caps.push("share");
    if (this.sdk?.analytics?.logEvent) caps.push("measure");
    if (this.onPortal) caps.push("cloudSave");
    else caps.push("cloudSaveLocal");
    return caps;
  }

  environment(): string | null {
    return typeof this.sdk?.environment === "string" ? this.sdk.environment : null;
  }

  /* ------------------------------------------------------- lifecycle */

  loadingStart(): void {
    this.game?.loadingStart?.();
  }

  loadingFinished(): void {
    this.game?.loadingStop?.();
  }

  signalGameReady(): void {
    // Canonical v3 exposes signalGameReady; older builds only have loadingStop.
    if (this.game?.signalGameReady) {
      this.game.signalGameReady();
    } else {
      this.game?.loadingStop?.();
    }
  }

  gameplayStart(): void {
    this.game?.gameplayStart?.();
  }

  gameplayStop(): void {
    this.game?.gameplayStop?.();
  }

  pause(): void {
    this.game?.pause?.();
  }

  /**
   * CrazyGames' canonical spelling is `game.happytime()` (all lowercase, no
   * argument) and its docs say to use it sparingly — "the celebration should
   * remain a special moment". The shared interface speaks Poki's
   * `happyTime(intensity)`, so this maps down and only fires for a genuinely
   * big moment.
   */
  happyTime(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity < 0.75) return;
    try {
      const r = this.game?.happytime?.();
      if (r instanceof Promise) r.catch(() => undefined);
    } catch {
      /* celebration must never break the game */
    }
  }

  /** CrazyGames exposes no language signal to the game. */
  portalLanguage(): string | null {
    return null;
  }

  /** No portal pill on CrazyGames. */
  movePill(_topPercent: number, _topPx: number): void {}

  /* -------------------------------------------------------------- ads */

  commercialBreak(): Promise<void> {
    return this.requestAd("midgame").then(() => undefined);
  }

  rewardedBreak(): Promise<boolean> {
    return this.requestAd("rewarded");
  }

  async showMidgameAd(): Promise<void> {
    await this.commercialBreak();
  }

  async showRewardedAd(): Promise<boolean> {
    return this.rewardedBreak();
  }

  /**
   * Unified ad request across SDK callback shapes. The v3 positional
   * signature is primary; the object form is the fallback for older builds.
   * A watchdog resolves the promise when no callback ever fires, so a
   * shape mismatch can never hang a break.
   */
  private requestAd(kind: CrazyAdType): Promise<boolean> {
    const ad = this.sdk?.ad;
    if (!ad?.requestAd) return Promise.resolve(kind === "midgame");
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let opened = false;
      const settle = (granted: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        if (opened) this.events.onAdClosed?.();
        resolve(granted);
      };
      const onStart = () => {
        opened = true;
        this.events.onAdOpened?.();
      };
      const watchdog = window.setTimeout(
        () => settle(kind === "midgame" ? true : false),
        AD_CALLBACK_WATCHDOG_MS,
      );
      const positional = () => {
        try {
          ad.requestAd!(kind, onStart, () => settle(true), (err) => {
            void err;
            settle(false);
          });
        } catch {
          // SDK rejected the positional shape — try the legacy object form.
          try {
            (ad.requestAd as unknown as (t: CrazyAdType, cb: CrazyAdCallbacks) => void)(kind, {
              adStarted: onStart,
              adFinished: () => settle(true),
              adError: () => settle(false),
            });
          } catch {
            settle(kind === "midgame");
          }
        }
      };
      positional();
    });
  }

  mountBanner(container: HTMLElement): void {
    const ad = this.sdk?.ad;
    if (!this.bannerId || !ad?.requestBanner || container.childElementCount > 0) return;
    container.id = this.bannerId;
    void ad
      .requestBanner([{ containerId: this.bannerId, size: "320x50" }])
      .then(() => {
        ad.showBanner?.(this.bannerId);
      })
      .catch(() => undefined); // bannerCooldown etc. — never surface banner errors
  }

  /* -------------------------------------------------------- cloud save */

  async saveCloud<T>(key: string, value: T): Promise<void> {
    const payload = JSON.stringify(value);
    if (this.onPortal) {
      try {
        const data = this.sdk?.data;
        if (data?.setItem) await data.setItem(key, payload);
        return;
      } catch {
        /* fall through to local fallback */
      }
    }
    localSet(key, payload);
  }

  async loadCloud<T>(key: string): Promise<T | null> {
    let raw: string | null = null;
    if (this.onPortal) {
      try {
        const data = this.sdk?.data;
        if (data?.getItem) raw = await data.getItem(key);
      } catch {
        raw = null;
      }
    }
    if (raw === null) raw = localGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async removeCloud(key: string): Promise<void> {
    if (this.onPortal) {
      try {
        const data = this.sdk?.data;
        if (data?.removeItem) await data.removeItem(key);
      } catch {
        /* fall through */
      }
    }
    localRemove(key);
  }

  async clearCloud(): Promise<void> {
    if (this.onPortal) {
      try {
        const data = this.sdk?.data;
        if (data?.clear) await data.clear();
      } catch {
        /* keep local keys intact on portal error */
        return;
      }
    }
    for (const k of localKeys()) {
      const ls = storage();
      ls?.removeItem(k);
    }
  }

  async hasCloud(key: string): Promise<boolean> {
    if (this.onPortal) {
      try {
        const data = this.sdk?.data;
        if (data?.hasKey) return Boolean(await data.hasKey(key));
        if (data?.getItem) return (await data.getItem(key)) !== null;
      } catch {
        /* fall through */
      }
    }
    return localGet(key) !== null;
  }

  /* ---------------------------------------------------------- identity */

  async getIdentity(): Promise<PlatformIdentity | null> {
    const user = this.user;
    if (!user?.getUser) return null;
    try {
      const u = await user.getUser();
      if (!u || !u.username) return null;
      // Bind the analytics stream to this user (best-effort, per SDK docs).
      try {
        this.sdk?.analytics?.setUserId?.(u.username);
      } catch {
        /* ignore */
      }
      const info = this.getSystemInfo();
      return {
        id: u.username,
        name: u.username,
        avatarUrl: typeof u.profilePictureUrl === "string" && u.profilePictureUrl ? u.profilePictureUrl : null,
        countryCode: info.countryCode,
        platform: "crazy",
      };
    } catch {
      return null;
    }
  }

  getSystemInfo(): PlatformSystemInfo {
    const info = this.user?.systemInfo;
    const device = info?.device?.type;
    return {
      countryCode: info?.countryCode ?? null,
      locale: info?.locale ?? null,
      deviceType: device === "desktop" || device === "tablet" || device === "mobile" ? device : null,
      osName: info?.os?.name ?? null,
      osVersion: info?.os?.version ?? null,
      browserName: info?.browser?.name ?? null,
      browserVersion: info?.browser?.version ?? null,
      applicationType: info?.applicationType ?? null,
    };
  }

  async submitPlatformScore(score: number): Promise<void> {
    const addScore = this.user?.addScore;
    if (!addScore) return;
    try {
      const r = addScore(score, () => undefined) as Promise<void> | void;
      if (r instanceof Promise) await r;
    } catch {
      /* portal leaderboard is a bonus surface — never throw */
    }
  }

  /*
   * CrazyGames surfaces leaderboards through its own site chrome rather than an
   * in-game overlay, and it has no playtest recorder or error-report hook in
   * the v3 SDK — so these stay inert here. They exist on the interface so the
   * game can call them unconditionally.
   */
  showLeaderboard(_id?: number | null): void {}
  playtestSetCanvas(_canvas: HTMLCanvasElement | HTMLCanvasElement[] | null): void {}
  captureError(_err: string | Error): void {}
  deviceCategory(): "mobile" | "tablet" | "desktop" | null { return null; }
  /** CrazyGames requires the same brokered navigation for external links. */
  openExternalLink(url: string): void {
    try {
      (window as unknown as { open?: (u: string, t: string) => void }).open?.(url, "_blank");
    } catch { /* inert */ }
  }

  async requestAccountLink(): Promise<boolean> {
    const prompt = this.user?.showAccountLinkPrompt;
    if (!prompt) return false;
    try {
      await prompt();
      return true;
    } catch {
      return false; // userNotAuthenticated / already-in-progress / declined
    }
  }

  async getIapToken(): Promise<string | null> {
    const user = this.user;
    if (!user) return null;
    try {
      const xsolla = user.getXsollaUserToken?.();
      if (xsolla) return await xsolla;
      const generic = await user.getUserToken?.();
      return generic ?? null;
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------- invites / rooms */

  isInstantMultiplayer(): boolean {
    return this.game?.isInstantMultiplayer === true;
  }

  getInviteParam(name: string): string | null {
    try {
      return this.game?.getInviteParam?.(name) ?? null;
    } catch {
      return null;
    }
  }

  getInviteParams(): InviteParams | null {
    const p = this.game?.inviteParams;
    if (!p || typeof p !== "object") return null;
    const out: InviteParams = {};
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === "string") out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  onJoinRoom(listener: (params: InviteParams) => void): () => void {
    const add = this.game?.addJoinRoomListener;
    const remove = this.game?.removeJoinRoomListener;
    if (!add || !remove) return () => undefined;
    const wrap = (params: InviteParams) => listener(params ?? {});
    try {
      add(wrap);
    } catch {
      return () => undefined;
    }
    return () => {
      try {
        remove(wrap);
      } catch {
        /* already detached */
      }
    };
  }

  async inviteFriends(params: InviteParams): Promise<string | null> {
    const g = this.game;
    if (!g) return null;
    try {
      if (g.showInviteButton) {
        return g.showInviteButton(params) ?? null;
      }
      if (g.inviteLink) {
        return g.inviteLink(params) ?? null;
      }
    } catch {
      /* fall through */
    }
    return null;
  }

  updateRoom(opts: { roomId?: string; isJoinable?: boolean; inviteParams?: InviteParams }): void {
    try {
      this.game?.updateRoom?.({ ...opts });
    } catch {
      /* room state is advisory to the portal */
    }
  }

  leftRoom(): void {
    try {
      this.game?.leftRoom?.();
    } catch {
      /* ignore */
    }
  }

  /**
   * Gameplay event measurement via the SDK analytics module
   * (start → complete|fail, one outcome per attempt).
   */
  measure(category: string, label: string, action: string): void {
    const analytics = this.sdk?.analytics;
    if (!analytics?.logEvent) return;
    try {
      analytics.logEvent({ category, label, action, event: `${category}.${label}.${action}` });
    } catch {
      /* measurement must never break gameplay */
    }
  }

  async share(message: string, _params?: InviteParams): Promise<boolean> {
    // CrazyGames injects its own multiplayer invite params into shared
    // links; caller-supplied params are not part of its share API.
    const g = this.game;
    try {
      if (g?.share) {
        await g.share(message);
        return true;
      }
    } catch {
      /* fall through */
    }
    // Fallback: the Web Share API (works in most modern browsers).
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message });
        return true;
      } catch (error) {
        // Dismissed sheet: the platform DID show the user the share
        // surface — report it as handled so callers don't show a second one.
        return error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
      }
    }
    return false;
  }

  /* --------------------------------------------------------- settings */

  syncSettings(): void {
    const g = this.game;
    if (g) this.events.onPortalMute?.(g.settings?.muteAudio === true);
  }

  isMuted(): boolean {
    return this.game?.settings?.muteAudio === true;
  }

  getSettings(): { muteAudio: boolean; disableChat: boolean } {
    const g = this.game;
    const s = g?.getSettings?.() ?? g?.settings;
    return {
      muteAudio: s?.muteAudio === true,
      disableChat: s?.disableChat === true,
    };
  }
}
