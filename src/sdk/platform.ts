/**
 * SUNBIRD platform adapter layer.
 *
 * The core game NEVER touches a portal SDK directly — it speaks this
 * interface. Adapters:
 *   • `PokiAdapter` — the Poki SDK surface this build targets.
 *   • `LocalAdapter`  — no-op platform + localStorage cloud save, so the
 *     save/identity flows run end-to-end in local dev and generic portals.
 *
 * Build targeting: `VITE_PORTAL_TARGET` = "poki" |
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

export type PlatformName = "poki" | "none";

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

/** Portal identity. */
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
  /**
   * Whether the player's browser is blocking ads, as reported by the portal.
   * Optional: only a portal that can detect it implements it. MON-12 makes this
   * load-bearing rather than cosmetic — a break that cannot serve must not be
   * requested at all, because "never loop the request" is the requirement.
   */
  hasAdBlock?(): boolean;
  /** True once the SDK finished init (local adapter: immediately). */
  readonly ready: boolean;
  /** Which capabilities this adapter actually provides (telemetry/UI gating). */
  capabilities(): string[];

  /** Portal environment as reported by the SDK ("local" | "disabled" | null). */
  environment(): string | null;

  /* ------------------------------------------------------- lifecycle */
  loadingStart(): void;
  loadingFinished(): void;
  /**
   * Tell the portal the game is playable. On Poki this is `gameLoadingFinished`
   * (one-shot, and the game's own release marker); the adapter owns the mapping.
   */
  signalGameReady(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Ask the portal to treat the game as paused (best-effort). */
  pause(): void;
  /** Portal celebration for a special moment (personal best). Never throws. */
  /** Poki's milestone celebration (`PokiSDK.happyTime`, capital T). */
  happyTime(): void;

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
   * The language the portal says this player uses (Poki `getLanguage()`), or
   * null to fall back to browser detection. The guide recommends serving the
   * player's own language automatically rather than making them find a
   * setting, and the portal knows it more reliably than `navigator.language`.
   */
  getLanguage(): string | null;
  /**
   * Reposition the portal's own overlay (the mobile Poki pill) so it does not
   * cover game UI. No-op where the portal has no such element.
   */
  movePill(topPercent: number, topPx: number): void;
  /**
   * Level-2 Playtest recording hooks (Poki game-dev-tools). Turning capture on
   * records the HTML around the canvas so the recording shows what the player
   * saw; a no-op everywhere else.
   */
  playtestCapture(on: boolean): void;
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
  measure(category: string, label: string, action: string): void;
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
// every `TARGET === "poki"` branch — without the String() cast above, which
// defeated the substitution. The `as string` cast keeps TS from narrowing the
// union too aggressively inside branches while still being a compile-time
// constant for minification.
const TARGET = (import.meta.env.VITE_PORTAL_TARGET ?? "none") as string;
const PORTAL_BANNER_ID = import.meta.env.VITE_PORTAL_BANNER_ID ?? "";
// URL constants are gated to the matching build target via a compile-time
// constant so Rollup's dead-code elimination strips them from non-target
// bundles entirely — a non-Poki build never contains the Poki SDK URL
// string (or vice-versa), and `scriptFor()` can never return the wrong URL.
const POKI_SRC = TARGET === "poki" ? "https://game-cdn.poki.com/scripts/v2/poki-sdk.js" : "";
/** If the portal SDK can't load in this long, boot the game without it. */
const SDK_LOAD_TIMEOUT_MS = 4000;

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

/**
 * Stop the host page from scrolling under the game.
 *
 * Poki's HTML5 SDK page spells this out: space and the arrow keys scroll the
 * page by default, and on Poki the game sits inside a longer page that can
 * scroll — the game must swallow those keys and wheel events, or pressing
 * space mid-run scrolls the page behind the canvas.
 *
 * Two deliberate exceptions, because the snippet in the docs is blunter than a
 * real game can afford:
 *   • the game's own scrollable surfaces (`.overlay` menus, the emote wheel)
 *     must keep scrolling — the game explicitly allows them to; and
 *   • keys must not be swallowed while a native control has focus, or
 *     space/arrow keys would stop activating buttons (a keyboard-accessibility
 *     regression in the menus).
 *
 * Returns the detacher, so a disposed game leaves no listeners behind.
 */
export function installPageScrollGuards(): () => void {
  if (typeof window === "undefined") return () => {};

  const SCROLLABLE = ".overlay, .emote-wheel, [data-scroll-surface]";
  const inScrollSurface = (target: EventTarget | null): boolean =>
    target instanceof Element ? target.closest(SCROLLABLE) !== null : false;
  const interactive = (target: EventTarget | null): boolean =>
    target instanceof Element ? target.closest("button, a, input, textarea, select, summary, [role=button], [contenteditable]") !== null : false;

  // Every key that scrolls a host page, not only the two the bird dives with.
  // Space and up/down are what a player presses mid-flight, but a left/right
  // arrow or PageUp/Home still moved the page under the game — and the
  // requirement is that the page does not scroll while playing at all.
  const SCROLL_KEYS = new Set([
    " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "PageUp", "PageDown", "Home", "End",
  ]);
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!SCROLL_KEYS.has(e.key)) return;
    if (e.defaultPrevented) return;
    // A focused control owns its keys; a scrollable menu owns its arrows.
    if (interactive(e.target) || inScrollSurface(e.target)) return;
    e.preventDefault();
  };
  const onWheel = (e: WheelEvent): void => {
    if (inScrollSurface(e.target)) return;
    e.preventDefault();
  };

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("wheel", onWheel);
  };
}

export function portalTarget(): PlatformName {
  // The TARGET constant is a compile-time string; these branches are
  // folded by Rollup so non-target code is stripped.
  return TARGET === "poki" ? "poki" : "none";
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

/**
 * SDK bootstrap is specialized per target using compile-time TARGET so the
 * other portal's SDK global (`window.PokiSDK`) and script URL never appear in
 * a build that has no business carrying them.
 */
function ensureSdk(): Promise<PlatformName> {
  if (TARGET !== "poki") return Promise.resolve("none");
  if (loadPromise) return loadPromise;

  if (TARGET === "poki") {
    // Poki global
    type PokiGlobal = {
      init?: () => Promise<void>;
      setDebug?: (v: boolean) => void;
      gameLoadingStart?: () => void;
      movePill?: (x: number, y: number) => void;
    };
    const getPoki = (): PokiGlobal | undefined => (window as unknown as { PokiSDK?: PokiGlobal }).PokiSDK;
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
    type PokiGlobal = {
      init?: (options?: { submitScore?: (submit: (leaderboard: string, score: number) => void) => void }) => Promise<void>;
      setDebug?: (v: boolean) => void;
      gameLoadingStart?: () => void;
      movePill?: (x: number, y: number) => void;
      /** Game Events (`measure()`) reporting — see developers.poki.com/guide/game-events. */
      enableEventTracking?: () => void;
    };
    const getPoki = (): PokiGlobal | undefined => (window as unknown as { PokiSDK?: PokiGlobal }).PokiSDK;
    boot = ensureSdk().then(async (loaded) => {
      if (loaded !== "poki") return { name: "none", platformEnvironment: null };
      try {
        if (import.meta.env.DEV) getPoki()?.setDebug?.(true);
        // init({ submitScore }) is Poki's leaderboard handshake: the SDK hands
        // back the submitter, which the adapter then uses for
        // submitPlatformScore(). Passing no options would silently leave the
        // portal leaderboards unwired.
        await getPoki()?.init?.(pokiInitOptions());
        // Game Events: the SDK only reports measure() checkpoints once event
        // tracking is switched on, and the dashboard's drop-off funnel / C2P
        // read-outs are built from exactly those events. Same handshake shape
        // as init — optional, so an older CDN build degrades to plain events.
        try { getPoki()?.enableEventTracking?.(); } catch { /* events optional */ }
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
  } else {
    boot = Promise.resolve({ name: "none", platformEnvironment: null });
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
  } else {
    // Direct/web build: no portal, so cloud saves fall back to localStorage and
    // every portal-only call is an honest no-op.
    adapter = new LocalAdapter("none");
  }
  const safety = window.setTimeout(() => {
    try { adapter.loadingFinished(); adapter.signalGameReady(); } catch { /* ignore */ }
  }, 6000);
  const originalFinish = adapter.loadingFinished.bind(adapter);
  adapter.loadingFinished = () => { window.clearTimeout(safety); originalFinish(); };
  activeAdapter = adapter;
  return adapter;
}
