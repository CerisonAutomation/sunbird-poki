/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute URL of the hosted privacy policy. Portal builds must set it:
   * inside a portal iframe the game's own origin is the portal CDN. Empty on
   * direct/web builds, which resolve `/privacy` against the page origin. */
  readonly VITE_PRIVACY_URL?: string;
  /** `none` for direct/PWA builds, `poki` or `crazy` for a portal export. */
  readonly VITE_PORTAL_TARGET?: "none" | "poki" | "crazy" | "crazygames";
  /** Optional CrazyGames dashboard banner placement id. */
  readonly VITE_PORTAL_BANNER_ID?: string;
  /** Optional HTTPS base URL for the global leaderboard (see LEADERBOARD_API.md). */
  readonly VITE_LEADERBOARD_URL?: string;
  /** Optional WebSocket URL enabling real networked rivals in Mass Race. */
  readonly VITE_MULTIPLAYER_URL?: string;
  /** Optional HTTPS base URL for the social server (friends/clubs/chat). */
  readonly VITE_SOCIAL_URL?: string;
  /**
   * Build identity, injected by vite.config's `define` (see `docs/VERSIONS.md`):
   * `VITE_APP_VERSION` is package.json's semver, `VITE_GIT_SHA` the commit the
   * bundle was cut from (`"dev"` without git), and `VITE_BUILD_ID` the
   * `<version>-<portal>-<sha>` triple stamped into logs and leaderboard rows.
   * Deterministic: rebuilding the same commit yields the same values. Optional
   * here because vitest does not apply the defines — `game/version.ts` supplies
   * the fallbacks.
   */
  readonly VITE_APP_VERSION?: string;
  readonly VITE_GIT_SHA?: string;
  readonly VITE_BUILD_ID?: string;
  /**
   * Does this build rehearse sponsored breaks with `MockAdProvider`? Pinned by
   * vite.config's `define` to `VITE_SIM_BREAKS=true` on the direct target only
   * (portals supply real breaks), and read by `edition.SIMULATED_BREAKS`.
   */
  readonly VITE_SIM_BREAKS: boolean;
  /**
   * May this build sell "no sponsored breaks"? Pinned by vite.config's `define`
   * to `PORTAL === "none"`, so it is a compile-time BOOLEAN LITERAL in every
   * bundle: Rollup folds the expression and dead-code-eliminates the IAP copy
   * from portal builds (Poki rule REQ-20 forbids in-app purchases, including
   * any "remove ads" offer). Typed here so no call site needs a cast.
   */
  readonly VITE_SELL_AD_REMOVAL?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
