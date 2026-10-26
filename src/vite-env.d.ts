/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Build identity, injected by `define` in vite.config.ts. Declared here so
   * consumers need no cast — `src/game/version.ts` reads all three, and an
   * untyped property there would force an `as any` that `verify:prod` refuses
   * in shipped client code.
   */
  readonly VITE_BUILD_ID?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_GIT_SHA?: string;
  /** `none` for the direct/PWA build, `poki` for the portal export. */
  readonly VITE_PORTAL_TARGET?: "none" | "poki";
  /**
   * Poki display-ad format (e.g. "728x90", "300x250"), or unset to leave the
   * in-game ad slot empty. Chosen per game on the Poki side and handed to the
   * developer, so it is configuration. See src/sdk/banner.ts.
   */
  readonly VITE_POKI_DISPLAY_AD_SIZE?: string;
  /**
   * The Poki-issued game id (a UUID) that AUDS writes are scoped to. Set by
   * `build:poki`; absent everywhere else, which is what makes the AUDS client
   * refuse to construct. Read through `pokiGameId()` in src/sdk/env.ts rather
   * than directly — the value is validated, and three call sites were each
   * re-validating it themselves.
   */
  readonly VITE_POKI_GAME_ID?: string;
  /**
   * The Poki-issued game id Netlib (P2P) is opened with. Set by `build:poki`.
   * Distinct from `VITE_POKI_GAME_ID` because Poki issues the two separately.
   */
  readonly VITE_POKI_NETLIB_GAME_ID?: string;
  /**
   * Name of the Poki leaderboard the run score is submitted to during
   * `init({ submitScore })`. Defaults to "distance"; set it to re-point a
   * build at a renamed board without a code change.
   */
  readonly VITE_POKI_LEADERBOARD?: string;
  /** Optional HTTPS base URL for the global leaderboard (see LEADERBOARD_API.md). */
  readonly VITE_LEADERBOARD_URL?: string;
  /** Optional WebSocket URL enabling real networked rivals in Mass Race. */
  readonly VITE_MULTIPLAYER_URL?: string;
  /** Optional HTTPS base URL for the social server (friends/clubs/chat). */
  readonly VITE_SOCIAL_URL?: string;
  /**
   * Whether this build may offer "remove ads". Injected as a literal by `define`
   * in vite.config.ts and vitest.config.ts, which is what lets Rollup
   * constant-fold it and drop the ad-removal UI from portal bundles (Poki
   * REQ-20 forbids that offer on a portal).
   *
   * Declared here so the call sites need no cast: an untyped property forced
   * `as any`, which in turn forced a lint-suppression comment, and
   * `verify:prod` refuses those in shipped client code.
   */
  readonly VITE_SELL_AD_REMOVAL?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * `true` when the current vitest run is collecting coverage. Injected as a
 * literal by `define` in vitest.config.ts.
 *
 * It exists for exactly one consumer: `src/game/__tests__/physics-perf.test.ts`
 * must not assert a wall-clock per-step budget while the v8 provider is
 * instrumenting the code it is timing. Declared here so that test needs no
 * cast and no `as any` (which `verify:prod` refuses in shipped code).
 */
declare const __COVERAGE_RUN__: boolean;
