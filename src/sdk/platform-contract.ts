/**
 * The platform CONTRACT — the one module every adapter depends on, and the one
 * module no adapter reaches back through.
 *
 * Why this file exists: `platform.ts` composes the adapters (it imports
 * `LocalAdapter` and `PokiAdapter` so Rollup can DCE the branch this build does
 * not target), but the adapters also need the interface they are implementing.
 * When that interface lived in `platform.ts`, the composition root imported its
 * own implementors and the result was a real cycle:
 *
 *     poki.ts → local.ts → platform.ts → poki.ts
 *
 * The types alone did not cause it — `.madgerc` sets `skipTypeImports`, so
 * type-only edges are invisible to the cycle check. The cycle was the one
 * VALUE import: `EMPTY_INFO`, the shared "we know nothing yet" literal every
 * adapter spreads. Splitting the types out while leaving that constant behind
 * would have moved the file boundary and left the cycle exactly where it was.
 *
 * So the contract is types PLUS the one value they own, and it is a leaf: it
 * imports nothing from this directory. Adapters (`local.ts`, `poki.ts`) and the
 * build-target shim (`_shim.ts`) import this module; `platform.ts` imports it
 * too and re-exports it, so `src/game/**` and the sdk tests keep importing the
 * surface from `sdk/platform` unchanged.
 *
 * This also fixes a latent build-time cycle. When `vite.config.ts`'s
 * resolve-alias substitutes `_shim.ts` for `./poki` in a non-target build, the
 * shim's own `./platform` import resolves back to a module that imports the
 * shim — a cycle that madge cannot see, because the alias lives in the bundler
 * config, not in the source graph. The shim now depends on this leaf instead.
 */
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

/**
 * The "we know nothing yet" answer, shared by every adapter.
 *
 * Both the local and the Poki adapter began with their own copy of this
 * literal. Each adapter starts from it and fills in whatever its SDK actually
 * knows, so an unknown field reads as `null` rather than `undefined` leaking
 * into a comparison. Adapters spread it (`{ ...EMPTY_INFO }`) rather than hand
 * back the shared object, so a caller mutating the result cannot corrupt every
 * later caller.
 */
export const EMPTY_INFO: PlatformSystemInfo = {
  countryCode: null,
  locale: null,
  deviceType: null,
  osName: null,
  osVersion: null,
  browserName: null,
  browserVersion: null,
  applicationType: null,
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
  /**
   * Poki's milestone celebration (`PokiSDK.happyTime`, capital T).
   *
   * Takes the intensity so the value means something. The interface used to
   * declare `happyTime(): void`, which made the adapter's intensity parameter
   * unreachable: every one of the five call sites passed nothing and every
   * celebration fired at the default 1.0, while `ProgressBeats.Celebration.peak`
   * — documented as "the one happyTime() value for this run" — was computed
   * from the run's shape and then thrown away.
   */
  happyTime(intensity?: number): void;

  /* -------------------------------------------------------------- ads */
  /** Midgame/commercial break. Resolves when the break is over or unavailable. */
  commercialBreak(): Promise<void>;
  /** Rewarded break. Resolves true only when the portal explicitly granted the reward. */
  rewardedBreak(): Promise<boolean>;
  showRewardedAd(): Promise<boolean>;
  mountBanner(container: HTMLElement): void;
  /**
   * Tear the display-ad slot down.
   *
   * `destroyAd` is a real member of the shipped core and the display slot is
   * never unmounted by the page, so without this the only way to release it is
   * a reload. Games call it on dispose; it is a no-op when nothing is mounted.
   */
  destroyBanner(): void;

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
   * other value is a custom event.
   *
   * Returns whether the event was actually delivered. The adapter validates
   * before sending and the live loader discards anything it rejects, so
   * "called" and "arrived" are not the same thing — a caller that budgets must
   * budget on this, not on the fact that it called. (This comment previously
   * said Poki reserves `/` and `^`; that was wrong. It came from an early
   * hand-rolled guard, and the CDN loader contains no such reservation — the
   * real rules are a character allowlist plus a cap of two numeric runs
   * across the three arguments, both enforced by `sanitizeMeasure`. See
   * `./poki-canon.ts`.)
   */
  measure(category: string, label: string, action: string): boolean;
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