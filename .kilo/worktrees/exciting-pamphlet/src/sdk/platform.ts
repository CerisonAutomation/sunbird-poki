/**
 * SUNBIRD platform adapter layer.
 *
 * The core game NEVER touches a portal SDK directly — it speaks this
 * interface. Adapters:
 *   • `CrazyGamesAdapter` — the full official CrazyGames SDK v3 surface
 *     (init, loading/gameplay lifecycle, ads, banners, data-module cloud
 *     save, user identity + system info, portal leaderboard, invites and
 *     instant multiplayer, account linking, IAP tokens, mute, pause/resume).
 *   • `PokiAdapter` — the Poki SDK surface this build targets.
 *   • `LocalAdapter`  — no-op platform + localStorage cloud save, so the
 *     save/identity flows run end-to-end in local dev and generic portals.
 *
 * Build targeting: `VITE_PORTAL_TARGET` = "crazy" | "poki" | "generic" |
 * "none". The SDK script URLs ship as inert literals (verified by
 * scripts/verify-portal.mjs); only the build target's URL is ever injected.
 */
import { LocalAdapter } from "./local";
import { runLoadingNet } from "./net";
// Portal adapters are statically imported below but routed through the
// compile-time TARGET constant. The Vite resolve-alias shim (see
// vite.config.ts) replaces non-target adapters with `./_shim.ts`, whose
// classes contain zero SDK references — so a non-Poki build contains
// neither "@poki/netlib" nor any "PokiSDK" / "shareableURL" literal, and
// vice-versa for non-Crazy builds. The shim also means the dynamic import
// is unnecessary; we can instantiate directly and let Rollup DCE the
// unused branch completely.
import { PokiAdapter, pokiInitOptions } from "./poki";
// The Poki global is typed once, from Poki's own published typings (see
// ./poki-canon). Two hand-rolled subsets used to live in this file and drifted
// independently of the adapter's type.
import type { PokiSdk } from "./poki-canon";
// The portal's language signal is canonical (Poki `getLanguage()`), and it
// arrives after the i18n module initialised — so it is injected, not imported
// the other way round.
import { refreshAutoLocale, setPortalLanguageProvider } from "../i18n";
import { CrazyGamesAdapter } from "./crazygames";

export type PlatformName = "poki" | "crazy" | "generic" | "none";

/**
 * Portal events the game subscribes to at adapter init. `onPause`/`onResume`
 * fire on portal-side pause/resume (in addition to visibilitychange);
 * `onPortalMute` is the portal audio preference and must beat the in-game
 * toggle.
 */
export type PlatformEvents = {
  onAdOpened?: () => void;
  onAdClosed?: () => void;
  onPortalMute?: (muted: boolean) => void;
  onPause?: () => void;
  onResume?: () => void;
};

/** Portal identity (pseudonymous on CrazyGames; username + avatar). */
export type PlatformIdentity = {
  id: string;
  name: string;
  avatarUrl: string | null;
  countryCode: string | null;
  platform: PlatformName;
};

/** Canonical `user.systemInfo` shape, normalized to nullable fields. */
export type PlatformSystemInfo = {
  countryCode: string | null;
  locale: string | null;
  deviceType: "desktop" | "tablet" | "mobile" | null;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  applicationType: string | null;
};

/** Invite params passed via portal invite links (roomName, region, …). */
export type InviteParams = Record<string, string>;

/**
 * The STRICT platform surface. Every member is required — adapters that
 * don't support a capability implement an honest no-op (or a local
 * fallback, for the local adapter) and report it via `capabilities()`.
 */
export interface PlatformAdapter {
  readonly name: PlatformName;
  /** True once the SDK finished init (local adapter: immediately). */
  readonly ready: boolean;
  /** Which capabilities this adapter actually provides (telemetry/UI gating). */
  capabilities(): string[];

  /** Portal environment as reported by the SDK ("crazygames" | "local" | "disabled" | null). */
  environment(): string | null;

  /* ------------------------------------------------------- lifecycle */
  loadingStart(): void;
  loadingFinished(): void;
  /**
   * Tell the portal the game is playable. The name is CrazyGames' canonical
   * `game.signalGameReady()`; Poki has no such member, so the Poki adapter maps
   * this onto its own documented marker (`gameLoadingFinished()`) rather than
   * calling a method that does not exist — see docs/poki/SDK_CANON.md.
   */
  signalGameReady(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Ask the portal to treat the game as paused (best-effort). */
  pause(): void;
  /**
   * Portal celebration for a special moment, at an intensity in 0…1.
   *
   * The name and the argument are Poki's canon: `PokiSDK.happyTime(intensity)`
   * (Defold guide: "value is between 0 and 1"). CrazyGames' equivalent is
   * spelled `game.happytime()` with no argument and its docs ask for it to be
   * used sparingly, so that adapter maps the call and gates on intensity.
   * Sharing one spelling across adapters is what made the Poki celebration a
   * silent no-op for as long as it did. Never throws.
   */
  happyTime(intensity: number): void;

  /* -------------------------------------------------------------- ads */
  /** Midgame/commercial break. Resolves when the break is over or unavailable. */
  commercialBreak(): Promise<void>;
  /** Rewarded break. Resolves true only when the portal explicitly granted the reward. */
  rewardedBreak(): Promise<boolean>;
  showMidgameAd(): Promise<void>;
  showRewardedAd(): Promise<boolean>;
  mountBanner(container: HTMLElement): void;

  /* -------------------------------------------------------- cloud save */
  saveCloud<T>(key: string, value: T): Promise<void>;
  loadCloud<T>(key: string): Promise<T | null>;
  removeCloud(key: string): Promise<void>;
  clearCloud(): Promise<void>;
  hasCloud(key: string): Promise<boolean>;

  /* ---------------------------------------------------------- identity */
  /** Portal user, or null when signed out / unavailable. */
  getIdentity(): Promise<PlatformIdentity | null>;
  /** `user.systemInfo` (synchronous on the SDK; null fields when absent). */
  getSystemInfo(): PlatformSystemInfo;
  /** Portal leaderboard submission (`user.addScore`) — best-effort, never throws. */
  submitPlatformScore(score: number): Promise<void>;
  /**
   * Open the portal's own leaderboard overlay (Poki `showLeaderboard`).
   * No-op on platforms without one — gated in the UI by `capabilities()`.
   */
  showLeaderboard(id?: number | null): void;
  /**
   * Register the gameplay canvas with the portal's playtest recorder
   * (Poki `playtestSetCanvas`): Level-2 playtest recordings need it.
   */
  playtestSetCanvas(canvas: HTMLCanvasElement | HTMLCanvasElement[] | null): void;
  /** Report a runtime error to the portal's dashboard. Never throws. */
  captureError(err: string | Error): void;
  /** Device class as the portal reports it; null when unavailable. */
  deviceCategory(): "mobile" | "tablet" | "desktop" | null;
  /**
   * The portal's own language signal, or null when it has none. On Poki this is
   * `PokiSDK.getLanguage()` (its `iso_lang` URL param, else navigator.language,
   * reduced to the base tag) and it outranks the game's own sniffing, so a
   * player who chose a language on the portal gets it in-game.
   */
  portalLanguage(): string | null;
  /**
   * Reposition the portal's mobile UI pill (Poki `movePill(topPercent, topPx)`,
   * topPercent 0–50). No-op on portals without one.
   */
  movePill(topPercent: number, topPx: number): void;
  /** Open an external URL through the portal (required instead of navigating). */
  openExternalLink(url: string): void;
  /** Account linking prompt (identity upgrade flow). True when completed. */
  requestAccountLink(): Promise<boolean>;
  /**
   * Portal user token for backend verification: the Xsolla/IAP user token on
   * CrazyGames, the short-lived (1-minute) JWT on Poki. Never store it —
   * verify it server-side immediately.
   */
  getIapToken(): Promise<string | null>;

  /* ------------------------------------------------- invites / rooms */
  isInstantMultiplayer(): boolean;
  /** A specific invite-link parameter, or null. */
  getInviteParam(name: string): string | null;
  /** All invite params, or null when not launched from an invite. */
  getInviteParams(): InviteParams | null;
  /** Portal-initiated join (invite click while the game is open). Returns unregister. */
  onJoinRoom(listener: (params: InviteParams) => void): () => void;
  /**
   * Show the portal invite button/link for the current room.
   * Resolves with the shareable link, or null when unavailable.
   */
  inviteFriends(params: InviteParams): Promise<string | null>;
  /** Push room state to the portal (joinable flag, room id, invite params). */
  updateRoom(opts: { roomId?: string; isJoinable?: boolean; inviteParams?: InviteParams }): void;
  leftRoom(): void;
  /**
   * Gameplay event measurement. `action` is a stable string: `start`/
   * `complete`/`fail` form progress funnels (one outcome per attempt);
   * `visible`/`interact` measure placement exposure vs. engagement; any
   * other value is a custom event (Poki reserves `/` and `^` — never use them).
   */
  measure(category: string, what: string, action: string): void;
/** Share via the portal (best-effort). True on success.
 *
 * `params` is portal share data (Poki appends it to a signed shareable URL,
 * readable again with `getInviteParam`; CrazyGames injects its own
 * multiplayer params and ignores extras).
 */
  share(message: string, params?: InviteParams): Promise<boolean>;

  /* --------------------------------------------------------- settings */
  /** Push the portal's current mute state into `PlatformEvents.onPortalMute`. */
  syncSettings(): void;
  isMuted(): boolean;
  /** Settings as exposed by the portal (disableChat etc.). */
  getSettings(): { muteAudio: boolean; disableChat: boolean };
}

/* ------------------------------------------------------------------ boot */

// Vite replaces import.meta.env.VITE_PORTAL_TARGET with a string literal at
// build time. Do NOT call .toLowerCase() on it here — doing so prevented
// Rollup's dead-code elimination from folding the ternaries below, leaking
// non-target SDK URLs into every bundle. The define in vite.config.ts
// already lowercases the value.
// TARGET is replaced with a string literal at build time by Vite's
// define plugin (vite.config.ts pins VITE_PORTAL_TARGET to a constant).
// Access it directly via import.meta.env so Rollup can statically fold
// every `TARGET === "poki"` / `TARGET === "crazy"` branch — without the
// String() cast above, which defeated the substitution. The `as string`
// cast keeps TS from narrowing the union too aggressively inside branches
// (which made the "crazygames" alias look unreachable) while still being a
// compile-time constant for minification.
const TARGET = (import.meta.env.VITE_PORTAL_TARGET ?? "none") as string;
const PORTAL_BANNER_ID = import.meta.env.VITE_PORTAL_BANNER_ID ?? "";
// URL constants are gated to the matching build target via a compile-time
// constant so Rollup's dead-code elimination strips them from non-target
// bundles entirely — a non-Poki build never contains the Poki SDK URL
// string (or vice-versa), and `scriptFor()` can never return the wrong URL.
const POKI_SRC = TARGET === "poki" ? "https://game-cdn.poki.com/scripts/v2/poki-sdk.js" : "";
const CRAZY_SRC = TARGET === "crazy" || TARGET === "crazygames" ? "https://sdk.crazygames.com/crazygames-sdk-v3.js" : "";
/** If the portal SDK can't load in this long, boot the game without it. */
const SDK_LOAD_TIMEOUT_MS = 6000;

/**
 * Route runtime failures to the portal's error dashboard (`captureError`).
 * Poki surfaces these in the developer console for the game, which is the only
 * crash signal a portal build ever gets — the player's console is unreachable.
 * Returns the detacher so a disposed Game leaves no listeners behind.
 */
export function attachPortalErrorReporters(adapter: PlatformAdapter): () => void {
  const onError = (event: ErrorEvent): void => {
    adapter.captureError(event.error instanceof Error ? event.error : event.message || "window error");
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    adapter.captureError(event.reason instanceof Error ? event.reason : String(event.reason));
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

export function portalTarget(): PlatformName {
  // The TARGET constant is a compile-time string; these branches are
  // folded by Rollup so non-target code is stripped.
  if (TARGET === "poki") return "poki";
  if (TARGET === "crazy" || TARGET === "crazygames") return "crazy";
  if (TARGET === "generic") return "generic";
  return "none";
}

export function isPortalBuild(): boolean {
  return TARGET !== "none";
}

/** Touch/pointer-coarse device (portal mobile + real phones). */
export function isCoarsePointer(): boolean {
  try {
    return (
      window.matchMedia?.("(pointer: coarse)").matches === true ||
      "ontouchstart" in window
    );
  } catch {
    return false;
  }
}

/**
 * Start the portal SDK script at app entry, before React renders. The CDN
 * fetch then overlaps the game's own load instead of waiting for the first
 * interactive frame — `initPlatform` awaits the same singleton promise, so
 * this only moves the work earlier and changes nothing else (target-gated
 * injection and the never-fail boot are untouched).
 */
export function preloadPortalSdk(): void {
  void bootstrapSdk().then(() => {
    // Hard safety net: if the Game never mounts (WebGL crash, sandbox, a
    // misbehaving browser) and therefore never calls adapter.loadingFinished(),
    // release the portal's loading screen ourselves after a generous timeout.
    // The release is idempotent with the adapter's own finish, so a healthy
    // boot is not signalled twice.
    scheduleFailsafeFinish();
  });
}

/** The newest adapter (see `initPlatform`). The entry-point failsafe routes
 *  through it so a late safety net can never re-send a loading phase that the
 *  adapter — the one-shot owner of `gameLoadingFinished` — already sent. */
let activeAdapter: PlatformAdapter | null = null;

/** Releases the portal loading screen as a last resort, so a crash or
 *  headless-sandbox WebGL failure can never leave the portal stuck on its
 *  loading splash.
 *
 *  It is a NET, not a second signal: when an adapter exists the release goes
 *  through it, and `PokiAdapter.loadingFinished()` is one-shot, so a healthy
 *  boot is never signalled twice. (Sending the raw SDK global here — as this
 *  used to — added a second `gameLoadingFinished` 1.5 s after window load on
 *  every healthy Poki boot, which the Inspector flags as an invalid event
 *  sequence. Caught by e2e/poki-artifact.spec.ts.)
 *
 *  The net body is portal specific and lives in the target adapter module
 *  (see sdk/net.ts) — this file names no portal SDK, so no build can inherit
 *  another portal's global, and there is no `TARGET` guard left for the
 *  minifier to fail to fold. */
let failsafeScheduled = false;
function scheduleFailsafeFinish(): void {
  if (failsafeScheduled) return;
  failsafeScheduled = true;
  const release = (): void => {
    const adapter = activeAdapter;
    if (adapter) {
      // Preferred path: the adapter owns the phase markers and dedupes them.
      adapter.loadingFinished();
      adapter.signalGameReady();
      return;
    }
    // No adapter exists at all — the Game never reached initPlatform (crash,
    // CSP, headless WebGL failure). Nothing has been sent yet, so run the
    // target's net, which is a no-op in builds that have no portal splash.
    runLoadingNet();
  };
  // Prefer window.load (fires after all subresources), then cap with a timer.
  if (document.readyState === "complete") {
    window.setTimeout(release, 1500);
  } else {
    window.addEventListener("load", () => window.setTimeout(release, 1500), { once: true });
    window.setTimeout(release, 8000);
  }
}

export { PORTAL_BANNER_ID };

/* ------------------------------------------------------------- SDK loading */

let loadPromise: Promise<PlatformName> | null = null;
let sdkBootPromise: Promise<{ name: PlatformName; platformEnvironment: string | null }> | null = null;
/**
 * Forwards portal settings/pause events to the newest adapter's events. SDK
 * listeners are singletons (registered once at boot), but Game instances come
 * and go under StrictMode remounts — these refs always point at the live one.
 */
let portalEventSink: PlatformEvents | null = null;
let settingsListenerRegistered = false;
let pauseListenersRegistered = false;

/**
 * SDK bootstrap is specialized per target using compile-time TARGET so the
 * non-target SDK globals (`window.PokiSDK`, `window.CrazyGames`) and script
 * URLs never appear in the wrong bundle. The `as PlatformName` casts inside
 * each branch keep TypeScript happy; the branch itself is eliminated by
 * Rollup for the other targets.
 */
function ensureSdk(): Promise<PlatformName> {
  if (TARGET === "none" || TARGET === "generic") return Promise.resolve(TARGET);
  if (loadPromise) return loadPromise;

  if (TARGET === "poki") {
    const getPoki = (): PokiSdk | undefined => (window as unknown as { PokiSDK?: PokiSdk }).PokiSDK;
    loadPromise = new Promise((resolve) => {
      // Poki Inspector injects the SDK before the bundle loads; wait up to
      // 2 s, then fall back to loading from the Poki CDN.
      let waited = 0;
      const check = window.setInterval(() => {
        if (getPoki()) { window.clearInterval(check); resolve("poki"); return; }
        waited += 100;
        if (waited >= 2000) { window.clearInterval(check); loadCdn(); }
      }, 100);

      function loadCdn() {
        if (getPoki()) { resolve("poki"); return; }
        const existing = document.querySelector<HTMLScriptElement>('script[data-sunbird-sdk="poki"]');
        if (existing) {
          if (existing.dataset.loaded === "true") { resolve("poki"); return; }
          existing.addEventListener("load", () => resolve("poki"), { once: true });
          existing.addEventListener("error", () => resolve("none"), { once: true });
          return;
        }
        // One retry: the CDN occasionally fails a cold request on a flaky
        // connection, and a single failure used to cost the player every ad
        // (and every rewarded reward) for the whole session.
        let attempt = 0;
        const inject = (): void => {
          attempt += 1;
          const script = document.createElement("script");
          script.src = POKI_SRC;
          script.async = true;
          script.dataset.sunbirdSdk = "poki";
          script.onload = () => { script.dataset.loaded = "true"; resolve("poki"); };
          script.onerror = () => {
            script.remove();
            if (attempt < 2) { window.setTimeout(inject, 400); return; }
            resolve("none");
          };
          document.head.appendChild(script);
        };
        inject();
      }
    });
    return loadPromise;
  }

  if (TARGET === "crazy" || TARGET === "crazygames") {
    type CrazyGlobal = {
      SDK?: {
        init?: () => Promise<void>;
        environment?: string;
        game?: {
          loadingStart?: () => void;
          settings?: { muteAudio?: boolean };
          addSettingsChangeListener?: (cb: (s: { muteAudio?: boolean }) => void) => void;
          onPause?: (cb: () => void) => void;
          onResume?: (cb: () => void) => void;
        };
      };
    };
    const getCrazy = (): CrazyGlobal | undefined => (window as unknown as { CrazyGames?: CrazyGlobal }).CrazyGames;
    loadPromise = new Promise((resolve) => {
      if (getCrazy()?.SDK) { resolve("crazy"); return; }
      const existing = document.querySelector<HTMLScriptElement>('script[data-sunbird-sdk="crazy"]');
      if (existing) {
        if (existing.dataset.loaded === "true") { resolve("crazy"); return; }
        existing.addEventListener("load", () => resolve("crazy"), { once: true });
        existing.addEventListener("error", () => resolve("none"), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = CRAZY_SRC;
      script.async = true;
      script.dataset.sunbirdSdk = "crazy";
      script.onload = () => {
        const isReady = Boolean(window.CrazyGames?.SDK);
        if (isReady) {
          script.dataset.loaded = "true";
          resolve("crazy");
        } else {
          // Script loaded but SDK wasn't defined; treat as load failure
          resolve("none");
        }
      };
      script.onerror = () => resolve("none");
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  return Promise.resolve("none");
}

/** Boot the portal SDK once; adapters stay per-Game so callbacks are fresh after remounts. */
function bootstrapSdk(): Promise<{ name: PlatformName; platformEnvironment: string | null }> {
  if (sdkBootPromise) return sdkBootPromise;
  // Hard cap: a hanging/blocked SDK script must never hold the game hostage.
  const timeout = new Promise<{ name: PlatformName; platformEnvironment: string | null }>((resolve) => {
    window.setTimeout(() => resolve({ name: "none", platformEnvironment: null }), SDK_LOAD_TIMEOUT_MS);
  });

  let boot: Promise<{ name: PlatformName; platformEnvironment: string | null }>;
  if (TARGET === "poki") {
    const getPoki = (): PokiSdk | undefined => (window as unknown as { PokiSDK?: PokiSdk }).PokiSDK;
    boot = ensureSdk().then(async (loaded) => {
      if (loaded !== "poki") return { name: "none", platformEnvironment: null };
      try {
        if (import.meta.env.DEV) getPoki()?.setDebug?.(true);
        // init({ submitScore }) is Poki's leaderboard handshake: the SDK hands
        // back the submitter, which the adapter then uses for
        // submitPlatformScore(). Passing no options would silently leave the
        // portal leaderboards unwired.
        await getPoki()?.init?.(pokiInitOptions());
        // Enable Poki event tracking after init for analytics.
        getPoki()?.enableEventTracking?.();
        // gameLoadingStart() fires exactly once, right after init, before
        // any asset/3D scene work begins. Game.loadingFinished() is called
        // by the Game constructor once the renderer/HUD/terrain are ready.
        getPoki()?.gameLoadingStart?.();
      } catch { /* preserve playable build in sandbox */ }
      // Mobile: move the Poki pill out of the flight-HUD so it never covers
      // the score/altitude/distance chips. The 0,0 default has it in the
      // top-left which clashes with our HUD, so nudge it to a safer spot.
      try { getPoki()?.movePill?.(50, -4); } catch { /* cosmetic */ }
      return { name: "poki", platformEnvironment: null };
    });
  } else if (TARGET === "crazy" || TARGET === "crazygames") {
    type CrazyGlobal = {
      SDK?: {
        init?: () => Promise<void>;
        environment?: string;
        game?: {
          loadingStart?: () => void;
          settings?: { muteAudio?: boolean };
          addSettingsChangeListener?: (cb: (s: { muteAudio?: boolean }) => void) => void;
          onPause?: (cb: () => void) => void;
          onResume?: (cb: () => void) => void;
        };
      };
    };
    const getCrazy = (): CrazyGlobal | undefined => (window as unknown as { CrazyGames?: CrazyGlobal }).CrazyGames;
    boot = ensureSdk().then(async (loaded) => {
      if (loaded !== "crazy") return { name: "none", platformEnvironment: null };
      try {
        const sdk = getCrazy()?.SDK;
        await sdk?.init?.();
        sdk?.game?.loadingStart?.();
        const environment = typeof sdk?.environment === "string" ? sdk.environment : null;
        const game = sdk?.game;
        portalEventSink?.onPortalMute?.(game?.settings?.muteAudio === true);
        if (!settingsListenerRegistered && game?.addSettingsChangeListener) {
          settingsListenerRegistered = true;
          game.addSettingsChangeListener((s) => portalEventSink?.onPortalMute?.(s.muteAudio === true));
        }
        if (!pauseListenersRegistered && (game?.onPause || game?.onResume)) {
          pauseListenersRegistered = true;
          game.onPause?.(() => portalEventSink?.onPause?.());
          game.onResume?.(() => portalEventSink?.onResume?.());
        }
        return { name: "crazy", platformEnvironment: environment };
      } catch {
        return { name: "none", platformEnvironment: null };
      }
    });
  } else {
    boot = Promise.resolve({ name: TARGET === "generic" ? "generic" : "none", platformEnvironment: null });
  }

  sdkBootPromise = Promise.race([boot, timeout]);
  return sdkBootPromise;
}

/**
 * Initializes exactly one portal SDK script per build. The SDK core is a
 * singleton, while each Game instance gets a fresh event-bound adapter, so
 * React StrictMode re-mounts cannot leave stale audio/input callbacks behind.
 *
 * A "crazy" build that boots OUTSIDE the portal (environment "disabled", or
 * an unloaded SDK in local dev) falls back to the LocalAdapter so cloud
 * saves still work via localStorage and every other call is an honest no-op.
 */
export async function initPlatform(events: PlatformEvents): Promise<PlatformAdapter> {
  portalEventSink = events;
  // Read lazily so it always asks the live adapter, and only ever consulted
  // while the player's preference is "Browser language".
  setPortalLanguageProvider(() => activeAdapter?.portalLanguage() ?? null);
  // Safety net: on portals the loader must be dismissed even if the Game
  // constructor throws (e.g. headless WebGL failure, content-security, a
  // misbehaving browser). If loadingFinished() has not been called within
  // a short grace period after SDK init, fire it ourselves so the portal
  // never sits on its loading screen over our error overlay. Real devices
  // construct the Game fast enough that this timer is always cleared first.
  let adapter: PlatformAdapter;
  // Each branch is gated by a compile-time TARGET check so Rollup can strip
  // the other portals' code entirely from the bundle — dev/generic builds
  // ship only LocalAdapter, Poki builds ship only PokiAdapter, etc.
  if (TARGET === "poki") {
    await bootstrapSdk();
    adapter = new PokiAdapter(events);
  } else if (TARGET === "crazy" || TARGET === "crazygames") {
    const { platformEnvironment } = await bootstrapSdk();
    // Runtime fallback: if the SDK never loads (outside the Crazy portal)
    // use a local adapter so cloud saves still work. Gated behind the
    // compile-time "crazy" target so the global reference never appears
    // in other builds.
    type CGlobal = { SDK?: unknown };
    const cg = (window as unknown as { CrazyGames?: CGlobal }).CrazyGames;
    if (platformEnvironment === "disabled" || !cg?.SDK) {
      activeAdapter = new LocalAdapter("none");
      return activeAdapter;
    }
    adapter = new CrazyGamesAdapter(events, PORTAL_BANNER_ID);
    adapter.syncSettings();
    activeAdapter = adapter;
    return adapter;
  } else {
    // generic / none
    adapter = new LocalAdapter(TARGET === "generic" ? "generic" : "none");
  }
  const safety = window.setTimeout(() => {
    try { adapter.loadingFinished(); adapter.signalGameReady(); } catch { /* ignore */ }
  }, 6000);
  const originalFinish = adapter.loadingFinished.bind(adapter);
  adapter.loadingFinished = () => { window.clearTimeout(safety); originalFinish(); };
  activeAdapter = adapter;
  // A portal language (Poki's `iso_lang` param, else navigator.language) now
  // outranks the browser's own list; let an "auto" preference follow it. An
  // explicit player choice is never touched. `setLocale` notifies the pack
  // listeners, which is the same re-render path the Settings language selector
  // uses — no game callback is borrowed for it (firing `onResume` here could
  // unpause a game that is legitimately paused).
  void refreshAutoLocale();
  return adapter;
}
