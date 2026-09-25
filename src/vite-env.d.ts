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
