/**
 * The canonical Poki SDK surface — extracted from Poki's own artifacts, not
 * invented here.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The adapter used to declare its own `PokiSdk` type by hand. A hand-written
 * type cannot tell "canonical" from "plausible", and five members drifted into
 * names the SDK does not have — `signalGameReady`, `happytime`, `mute`,
 * `isMuted`, `hasAdBlock`/`setAdBlockActive`, `sendUserEvent`. Every one of
 * them was called through an optional chain (`sdk.happytime?.()`), so each was
 * a **silent no-op in production**: the celebration never fired, the ad-block
 * probe always read false, the portal mute preference never arrived. Two of
 * those names are canonical on *CrazyGames* (`game.happytime()`,
 * `game.signalGameReady()`), which is how they leaked into the shared
 * interface and then into the Poki adapter.
 *
 * The fix is structural: the type below is **derived from Poki's published
 * typings**, so a member that Poki does not declare is a compile error, not a
 * runtime shrug.
 *
 * SOURCES (all checked 2026-09-23)
 * --------------------------------
 * T1 — `@poki/sdk@0.0.5` → `dist/index.d.ts` (github.com/poki/npm-sdk), the
 *      official wrapper typings for `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`.
 *      This is the contract Poki publishes to integrators, and it is what
 *      `PokiSdkOfficial` below is mapped from.
 * T2 — the live CDN loader `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`
 *      (core build `78defe077b641dcd4b549b3dc7b497926c34393c`), which assigns
 *      `window.PokiSDK` and lists every runtime method by name. It exposes
 *      members the v0.0.5 typings predate — those live in `PokiSdkRuntime`.
 * T3 — the integration guides: developers.poki.com/guide/sdk-html5 (init,
 *      loading, gameplay, breaks, shareable URLs, movePill),
 *      /guide/game-events (`measure(category, what, action)` + the special
 *      action values), /guide/sdk-defold (`happyTime(value)`, value 0…1).
 *
 * POLICY FOR WHAT GETS WIRED
 * --------------------------
 * A member is only *called* by the adapter when T1 or T3 documents its
 * behaviour. T2-only members are declared (so the surface is complete and
 * honest) but stay unwired unless their semantics are unambiguous — see
 * `POKI_SDK_RUNTIME_ONLY` for the per-member verdict.
 */
import type { PokiSDK as PokiSdkPublished } from "@poki/sdk";

/**
 * T1 — the official surface, with every member optional.
 *
 * Optional is deliberate and is not a licence to invent: the mapped type keeps
 * exactly the keys Poki publishes, so `sdk.happytime` is still a compile error
 * while `sdk.happyTime?.()` degrades to a no-op on an older CDN build.
 */
export type PokiSdkOfficial = {
  [K in keyof typeof PokiSdkPublished]?: (typeof PokiSdkPublished)[K];
};

/**
 * T2 — members the live CDN build assigns that `@poki/sdk@0.0.5` does not yet
 * declare. Names are verbatim from the loader's method list; the `wired`
 * column in `POKI_SDK_RUNTIME_ONLY` records whether we call them and why.
 */
export type PokiSdkRuntime = {
  /** Loading-phase opener; the Cocos/Unity wrappers call it at engine start. */
  gameLoadingStart?: () => void;
  /** Loading progress. Fraction vs. percent is undocumented — NOT wired. */
  gameLoadingProgress?: (value: number) => void;
  /** Legacy "the game is interactive" marker, predates gameLoadingFinished. */
  gameInteractive?: () => void;
  /**
   * Celebration overlay. T3 (Defold guide) documents the argument: an
   * intensity between 0 and 1. This is the canonical name — the adapter used
   * to call `happytime()`, which is CrazyGames' spelling and does not exist
   * here.
   */
  happyTime?: (intensity: number) => void;
  /** Ad-block detection. The loader stub returns `{}`; the core decides. */
  isAdBlocked?: () => boolean | Promise<boolean> | unknown;
  /** Legacy score submission; T1's `init({ submitScore })` supersedes it. */
  sendHighscore?: (score: number) => void;
  /** Leaderboard fetch. T1 keeps `showLeaderboard` as the UI side. */
  getLeaderboard?: () => Promise<unknown>;
  /** Free-form analytics event; T3 steers integrations to `measure`. */
  customEvent?: (...args: unknown[]) => void;
  /** Error log channel beside `captureError`. */
  logError?: (err: string | Error) => void;
  /** Mute the ad itself (not the game). Semantics undocumented — NOT wired. */
  muteAd?: (muted?: boolean) => void;
  /** Legacy round markers; the guide's lifecycle is gameplayStart/Stop. */
  roundStart?: () => void;
  roundEnd?: () => void;
  /** Age gate for the `tag=kids` placement. Not our call to make — NOT wired. */
  setPlayerAge?: (age: number) => void;
  /** Screenshot capture for share surfaces. NOT wired (we render our own). */
  generateScreenshot?: () => Promise<string>;
  /** `init` variant for video heartbeats. NOT wired. */
  initWithVideoHB?: (options?: unknown) => Promise<void>;
  /** Debug/QA helpers — Inspector and playtest tooling only. */
  setDebugTouchOverlayController?: (on: boolean) => void;
  setPlaytestCanvas?: (canvas: HTMLCanvasElement | HTMLCanvasElement[] | null) => void;
};

/** The one type the adapter is allowed to touch. */
export type PokiSdk = PokiSdkOfficial & PokiSdkRuntime;

/**
 * Names that were invented in this repo and must never come back. Pinned by
 * `src/sdk/__tests__/poki-canon.test.ts`, which greps the adapter for them.
 */
export const POKI_SDK_NON_CANONICAL = [
  "signalGameReady",
  "happytime",
  "hasAdBlock",
  "setAdBlockActive",
  "sendUserEvent",
  "mute",
  "isMuted",
  "onPortalMute",
] as const;

/** T2 members with the verdict on each: wired, or deliberately not. */
export const POKI_SDK_RUNTIME_ONLY: ReadonlyArray<{ name: keyof PokiSdkRuntime; wired: boolean; why: string }> = [
  { name: "gameLoadingStart", wired: true, why: "opens the loading phase; the engine wrappers all call it before asset work" },
  { name: "gameLoadingProgress", wired: false, why: "fraction vs. percent is undocumented — guessing would misreport the bar" },
  { name: "gameInteractive", wired: false, why: "legacy marker; gameLoadingFinished is the documented conversion signal" },
  { name: "happyTime", wired: true, why: "documented in the Defold guide as an intensity 0…1 for celebration moments" },
  { name: "isAdBlocked", wired: true, why: "canonical ad-block probe; replaces the invented hasAdBlock/setAdBlockActive pair" },
  { name: "sendHighscore", wired: false, why: "legacy; init({ submitScore }) in the official typings is the leaderboard handshake" },
  { name: "getLeaderboard", wired: false, why: "our board is AUDS-backed; showLeaderboard is the portal UI side" },
  { name: "customEvent", wired: false, why: "the Game Events guide steers all checkpoints through measure()" },
  { name: "logError", wired: false, why: "captureError already routes runtime failures to the portal dashboard" },
  { name: "muteAd", wired: false, why: "mutes the ad, not the game; undocumented and not ours to drive" },
  { name: "roundStart", wired: false, why: "legacy round markers; gameplayStart/Stop is the documented lifecycle" },
  { name: "roundEnd", wired: false, why: "legacy round markers; gameplayStart/Stop is the documented lifecycle" },
  { name: "setPlayerAge", wired: false, why: "age gating belongs to the portal placement, not the game" },
  { name: "generateScreenshot", wired: false, why: "we render our own share card; no dependency on portal capture" },
  { name: "initWithVideoHB", wired: false, why: "video-heartbeat init variant; plain init() is the documented path" },
  { name: "setDebugTouchOverlayController", wired: false, why: "Inspector touch-overlay debugging only" },
  { name: "setPlaytestCanvas", wired: false, why: "alias of playtestSetCanvas, which the adapter does call" },
];

/**
 * The `measure()` category vocabulary, verbatim from `MeasureCategory` in
 * `@poki/sdk@0.0.5`. Any string is accepted by the SDK; using the published
 * vocabulary is what makes our events comparable with Poki's own reporting.
 * `poki-canon.test.ts` re-reads the typings and fails if this list drifts.
 */
export const MEASURE_CATEGORIES = [
  "achievement",
  "booster",
  "boss",
  "button",
  "checkpoint",
  "cosmetic",
  "death",
  "drawing",
  "economy",
  "enemy",
  "hint",
  "item",
  "level",
  "mode",
  "pet",
  "player",
  "powerup",
  "puzzle",
  "quest",
  "round",
  "skip-level",
  "stage",
  "tutorial",
  "upgrade",
  "wave",
  "world",
] as const;

/** Progress-funnel actions: one `start`, then exactly one of `complete`/`fail`. */
export const MEASURE_PROGRESS_ACTIONS = ["start", "complete", "fail"] as const;
/** Interaction actions: a `visible`/`interact` pair per placement. */
export const MEASURE_INTERACTION_ACTIONS = ["visible", "interact"] as const;

export type MeasureCategory = (typeof MEASURE_CATEGORIES)[number] | (string & {});
export type MeasureAction =
  | (typeof MEASURE_PROGRESS_ACTIONS)[number]
  | (typeof MEASURE_INTERACTION_ACTIONS)[number]
  | (string & {});

/**
 * `measure()` arguments as the live SDK will accept them, or null when the SDK
 * would drop the event.
 *
 * These rules are lifted from the CDN loader's own implementation, so an event
 * we reject here is one Poki would have discarded silently (it only logs a
 * console error the player never sees and the dashboard never receives):
 *
 *  1. `category` and `what` are required and non-empty after trimming;
 *  2. no argument may contain `/` or `^` — Poki reserves `/` for rendering
 *     event paths and `^` for joining the three values into a funnel key;
 *  3. at most **two** numeric values across category+what+action combined
 *     (the loader counts digit runs and literal `{n}` placeholders), so a
 *     distance or a score must be bucketed, never passed raw.
 */
export function sanitizeMeasure(
  category: string,
  what: string,
  action: string,
): { category: string; what: string; action: string } | null {
  const c = `${category ?? ""}`.trim();
  const w = `${what ?? ""}`.trim();
  const a = `${action ?? ""}`.trim();
  if (!c || !w) return null;
  if (/[\/^]/.test(`${c} ${w} ${a}`)) return null;
  const numerics = `${c} ${w} ${a}`.split(/\d+|\{n\}/i).length - 1;
  if (numerics > 2) return null;
  return { category: c, what: w, action: a };
}

/** `happyTime` takes an intensity in 0…1 (Defold guide); clamp rather than drop. */
export function clampHappyIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
