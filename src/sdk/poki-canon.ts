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
 *      and the core build it pulls,
 *      `poki-sdk-core-0df3a52d1f37602f598b9432c7bae77681d8e3ea.js`. The loader
 *      assigns `window.PokiSDK`: a 28-name stub list via `forEach`, plus a
 *      handful of keys written directly into its object literal
 *      (`initWithVideoHB` among them — present, but not in the 28). The core
 *      build then overwrites the stubs in place and adds 3 more the loader never
 *      names (`isAdBlocked`, `getLeaderboard`, `generateScreenshot`). Between
 *      them they expose members the v0.0.5 typings predate — those live in
 *      `PokiSdkRuntime`.
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
 * The live Poki SDK global, typed against the canonical surface.
 *
 * One accessor, on purpose. This file exists so that a member Poki does not
 * publish is a *compile error*, and that guarantee evaporates the moment a
 * module reaches in with its own `as { PokiSDK?: … }` cast — which is what
 * `auds.ts` did for `getToken`, and what would let a renamed or dropped member
 * compile cleanly and then no-op in production. Anything outside `poki.ts`
 * that needs the SDK goes through here.
 *
 * Returns undefined on a non-Poki build (the resolve-alias shim contains no
 * SDK reference at all), so callers must still treat every member as optional.
 */
export function pokiSdk(): PokiSdk | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { PokiSDK?: PokiSdk }).PokiSDK;
}

/**
 * Poki's account JWT, cached for most of its life.
 *
 * `getToken()` is a postMessage round trip to the parent frame with an
 * 8-second timeout, and the token is valid for about a minute. Two callers
 * needed it — the adapter's `getIapToken()` and AUDS's bearer token — and each
 * used to fetch its own, so every AUDS write cost a fresh round trip to the
 * parent. One cache, shared, with the TTL deliberately under the token's own
 * lifetime so a cached value is never handed out near its expiry.
 */
const AUTH_TOKEN_TTL_MS = 45_000;
let authToken: { value: string | null; at: number } | null = null;
let authTokenInFlight: Promise<string | null> | null = null;

export async function pokiAuthToken(force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && authToken && now - authToken.at < AUTH_TOKEN_TTL_MS) return authToken.value;
  // Collapse concurrent callers: AUDS can fire several writes at once on boot.
  if (!force && authTokenInFlight) return authTokenInFlight;
  // Keep the receiver. `getToken` is a member of the SDK object like every
  // other one — it reads `this` to reach the parent frame — so detaching it
  // into a bare function throws a TypeError and, worse, latches the in-flight
  // handle below to an already-settled promise (the async body runs
  // synchronously to its first await, so a synchronous throw clears the flag
  // *before* it is assigned). Call it as a member.
  const sdk = pokiSdk();
  if (typeof sdk?.getToken !== "function") return null;
  const request = (async () => {
    try {
      const value = await sdk.getToken!();
      const next = typeof value === "string" && value ? value : null;
      authToken = { value: next, at: Date.now() };
      return next;
    } catch {
      // Off-iframe, or no signed-in user. Do NOT cache a failure: the next
      // caller may be inside the iframe and able to succeed.
      return null;
    }
  })();
  // Clear on settlement, outside the IIFE, so it cannot be assigned a handle
  // that has already finished.
  const clear = () => {
    if (authTokenInFlight === request) authTokenInFlight = null;
  };
  request.then(clear, clear);
  authTokenInFlight = request;
  return request;
}

/** Drop the cached token (used when signing out or on teardown). */
export function clearPokiAuthToken(): void {
  authToken = null;
  authTokenInFlight = null;
}

/**
 * Symbols that reach the Poki SDK global, and may therefore be imported only
 * from inside `src/sdk/`.
 *
 * `pokiSdk()` is the single door to `window.PokiSDK`. Its whole value is that a
 * member Poki does not publish becomes a compile error at the one place that
 * holds the type — but that guarantee evaporates the moment a module outside
 * `src/sdk/` reaches in, either through this accessor or through its own
 * `window as { PokiSDK?: … }` cast.
 *
 * It did. `src/game/Telemetry.ts` imported `pokiSdk` and called
 * `sdk.measure(...)` itself, and because the canon suite only scanned
 * `src/sdk/poki.ts` and `src/sdk/platform.ts`, an invented member touched
 * there would have compiled clean and then no-opped in production. Everything
 * that needs Poki should call a function in this directory instead —
 * `measureViaPoki` below is the pattern.
 *
 * Pinned by `src/sdk/__tests__/poki-canon.test.ts`, which walks `src/` and
 * fails on any importer outside `src/sdk/` (tests excepted: a suite has to be
 * able to stub the global to prove anything about it).
 */
export const POKI_SDK_ACCESS_CONFINE = ["pokiSdk"] as const;

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

/**
 * T2 members with the verdict on each.
 *
 * `impl` is the member's body in the shipped core build
 * (`poki-sdk-core-0df3a52d….js`), transcribed verbatim. It is here because a
 * name being real says nothing about whether it does anything, and this table
 * was originally filled in from Poki's *name lists* alone. That mistake marked
 * three members `wired: true` whose shipped bodies are empty — the celebration
 * overlay, the ad-block probe and the loading-phase opener all no-op in
 * production while this table claimed they worked. 11 of the 17 are stubs
 * today; only the 6 with a real body are worth calling.
 *
 * `poki-canon.test.ts` pins these strings, so a Poki CDN bump that changes a
 * body fails here instead of silently becoming a no-op in the portal.
 */
export const POKI_SDK_RUNTIME_ONLY: ReadonlyArray<{
  name: keyof PokiSdkRuntime;
  wired: boolean;
  /** Verbatim body in the shipped core; `stub` = compiles to a no-op. */
  impl: string;
  why: string;
}> = [
  {
    name: "gameLoadingStart",
    wired: true,
    impl: "()=>{} — stub",
    why: "called, but the shipped core defines it as an empty function, so it never opens a loading phase. Harmless: gameLoadingFinished() is the signal that actually works",
  },
  { name: "gameLoadingProgress", wired: false, impl: "()=>{} — stub", why: "empty in the core, and fraction-vs-percent is undocumented anyway" },
  { name: "gameInteractive", wired: false, impl: "()=>{} — stub", why: "empty in the core; gameLoadingFinished is the documented conversion signal" },
  {
    name: "happyTime",
    wired: true,
    impl: "()=>{} — stub",
    why: "called with a clamped intensity, but the shipped core defines it as an empty function: the celebration overlay NEVER fires. The name is documented (Defold guide) but there is no HTML5 implementation",
  },
  {
    name: "isAdBlocked",
    wired: true,
    impl: "()=>!1 — hardcoded false",
    why: "the shipped core returns literal false (loader stub returns undefined). Real detection exists inside the core but is never exposed, so the ad-block probe is permanently false and any comment claiming it gates a break is wrong",
  },
  { name: "sendHighscore", wired: false, impl: "()=>{} — stub", why: "empty in the core; init({ submitScore }) is the real leaderboard handshake" },
  { name: "getLeaderboard", wired: false, impl: "()=>Promise.resolve([]) — always empty", why: "always resolves an empty array; our board is AUDS-backed" },
  { name: "customEvent", wired: false, impl: "(t,i,n={})=>{…} — real", why: "works, but the Game Events guide steers all checkpoints through measure()" },
  { name: "logError", wired: false, impl: "e=>{this.captureError(e)} — real", why: "works; captureError already routes runtime failures to the portal dashboard" },
  { name: "muteAd", wired: false, impl: "()=>{…this.__monetization.muteAd()} — real", why: "mutes the ad, not the game; we mute our own audio instead" },
  { name: "roundStart", wired: false, impl: "()=>{} — stub", why: "empty in the core; gameplayStart/Stop is the documented lifecycle" },
  { name: "roundEnd", wired: false, impl: "()=>{} — stub", why: "empty in the core; gameplayStart/Stop is the documented lifecycle" },
  { name: "setPlayerAge", wired: false, impl: "()=>{} — stub", why: "empty in the core, and age gating belongs to the portal placement anyway" },
  { name: "generateScreenshot", wired: false, impl: "async ()=>…Wr(null) — resolves null", why: "resolves null rather than a data URL; we render our own share card" },
  { name: "initWithVideoHB", wired: false, impl: "()=>this.init() — real", why: "a video-heartbeat init variant; plain init() is the documented path" },
  { name: "setDebugTouchOverlayController", wired: false, impl: "()=>{} — stub", why: "empty in the core; Inspector touch-overlay debugging only" },
  { name: "setPlaytestCanvas", wired: false, impl: "e=>{…} — real", why: "alias of playtestSetCanvas, which the adapter does call" },
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
// NB: `| (string & {})` is not a widening convenience, it is verbatim fidelity.
// Poki's published type is `'start' | 'complete' | 'fail' | 'visible' |
// 'interact' | string` — the union is advisory and the set is OPEN. An earlier
// `measure()` treated it as closed via a hand-rolled regex allowlist and so
// dropped every action outside those five plus three it invented; the SDK would
// have accepted all of them. Do not close this set.
export type MeasureAction =
  | (typeof MEASURE_PROGRESS_ACTIONS)[number]
  | (typeof MEASURE_INTERACTION_ACTIONS)[number]
  | (string & {});

/**
 * `measure()` arguments as the live SDK will accept them, or null when the SDK
 * would drop the event.
 *
 * These three rules are transcribed from the CDN loader's own `measure`
 * implementation, which validates and then *silently discards* anything that
 * fails — it logs a console error the player never sees, the `pokiTrackingMeasure`
 * postMessage is never sent, and the dashboard never hears about it:
 *
 *  1. `category` and `what` are required and non-empty after trimming;
 *  2. every character of all three must be in the loader's whitelist
 *     `A-Z a-z 0-9 space _ : . + | -` — it tests `/[^A-Za-z0-9_: .+|-]/` and
 *     rejects on a match, so this is a positive allowlist, not a pair of
 *     reserved characters;
 *  3. at most **two** numeric values across category+what+action combined
 *     (the loader counts digit runs and literal `{n}` placeholders), so a
 *     distance or a score must be bucketed, never passed raw.
 *
 * Rule 2 is a whitelist on purpose. An earlier version banned only `/` and `^`
 * on the belief that Poki reserved those two for its own path syntax — the
 * loader contains no such reservation. That belief let 28 further characters
 * through (`, ! ? " ' ( ) [ ] { } # % & * < > = ~ ; @ $ \` é 日` and any
 * whitespace) into events the SDK then dropped without a word, which is the
 * exact failure this function exists to make visible.
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
  if (/[^A-Za-z0-9_: .+|-]/.test(`${c} ${w} ${a}`)) return null;
  const numerics = `${c} ${w} ${a}`.split(/\d+|\{n\}/i).length - 1;
  if (numerics > 2) return null;
  return { category: c, what: w, action: a };
}

/** `happyTime` takes an intensity in 0…1 (Defold guide); clamp rather than drop. */
export function clampHappyIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Validate and forward one game event to Poki. Returns whether it was
 * actually delivered.
 *
 * This is the ONLY place in the app that touches a Poki SDK member for
 * measurement, and it is here rather than in the adapter so that every caller
 * shares it: `PokiAdapter.measure()` (the general portal path, used by
 * `Game.ts`) and `Telemetry.emitPokiMeasure` (the curated engagement set).
 *
 * `src/game/Telemetry.ts` used to import `pokiSdk` from this module and call
 * `sdk.measure(...)` itself, which made it a third, unguarded route into the
 * SDK — `src/sdk/__tests__/poki-canon.test.ts` only scanned `poki.ts` and
 * `platform.ts`, so an invented member touched there would have compiled
 * clean and then no-opped in production. That is precisely the failure this
 * module was written to prevent, and the test's blind spot is now closed by
 * `POKI_SDK_ACCESS_CONFINE` there.
 *
 * `false` means the event did not leave: the SDK was absent, the member was
 * missing, the loader's validation rejected the arguments, or the call threw.
 * Callers that budget must spend on that answer — "we called it" is not
 * "Poki received it", and a caller that assumes otherwise burns a session's
 * whole allowance on a channel that is not there.
 */
export function measureViaPoki(category: string, what: string, action: string): boolean {
  const clean = sanitizeMeasure(category, what, action);
  if (!clean) return false;
  const sdk = pokiSdk();
  // The live loader's `measure` is what the stub list installs; an older CDN
  // build without it must not be treated as delivered.
  if (typeof sdk?.measure !== "function") return false;
  try {
    sdk.measure(clean.category, clean.what, clean.action);
    return true;
  } catch {
    /* measurement must never break gameplay */
    return false;
  }
}
