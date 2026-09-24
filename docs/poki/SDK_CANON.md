# Poki SDK canon — the exact surface this game may call

**Researched:** 2026-09-23 · **Status:** enforced by types + tests + `requirements.json`
**Purpose:** one authoritative list of what `PokiSDK` actually exposes, so nothing
invented can creep back in. Rule IDs: `REQ-71` … `REQ-76`.

The trigger for this page: the adapter declared its own SDK type by hand, and a
hand-written type cannot tell *canonical* from *plausible*. Five invented members
got in, each called through an optional chain — so each was a **silent no-op in
production** instead of a compile error. Two of them are canonical on
*CrazyGames*, which is how they crossed adapters.

## Sources (all fetched 2026-09-23)

| # | Source | What it settles |
|---|---|---|
| T1 | `@poki/sdk@0.0.5` → `dist/index.d.ts` (github.com/poki/npm-sdk), pinned as a devDependency | The published contract: 28 methods, `InitOptions` (incl. `submitScore`), `User` (incl. `optedIn`), `RewardedBreakParams`, `MeasureCategory`, `MeasureAction` |
| T2 | `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`, core build `78defe077b641dcd4b549b3dc7b497926c34393c` | The live runtime surface: every member the loader assigns to `window.PokiSDK`, plus `measure()`'s own argument validation |
| T3 | `developers.poki.com/guide/sdk-html5`, `/guide/game-events`, `/guide/sdk-defold`, `/guide/sdk-overview` | Documented behaviour and call order: breaks, `measure(category, what, action)`, `happyTime(value)` with value 0…1 |

`src/sdk/poki-canon.ts` is the machine-readable form of this page: `PokiSdkOfficial`
is **mapped from T1**, so a member Poki does not publish is a type error;
`PokiSdkRuntime` holds the T2-only members with a per-member verdict.

## What was invented here, and what it cost

| Invented member | Reality | Cost while it shipped |
|---|---|---|
| `PokiSDK.happytime()` | Canonical is `happyTime(intensity)` — 0…1 (T3). `happytime` (lowercase) is **CrazyGames'** spelling | Personal-best celebrations never reached Poki; the game celebrated locally and the portal saw nothing |
| `PokiSDK.signalGameReady()` | Not a Poki member (it is CrazyGames' `game.signalGameReady`). Poki's marker is `gameLoadingFinished()` | The loading failsafe called a method that did not exist; the suite passed only because its SDK double invented the method too |
| `PokiSDK.hasAdBlock()` / `setAdBlockActive()` | Canonical is `isAdBlocked()` | The ad-block probe always read `false` |
| `PokiSDK.mute()` / `isMuted()` | No such members; Poki exposes no portal mute preference | `onPortalMute` never fired — code that looked like it honoured a portal setting did nothing |
| `PokiSDK.sendUserEvent()` | Not a member; Game Events are `measure()` (T1/T3) | Dead declaration |
| `measure(category, label, action)` | The published parameter is **`what`**, and the live SDK validates the arguments | Events with `/`, `^` or more than two numeric values were dropped by Poki with only a console error |

Two things the audit guessed at that turned out **not** to exist: there is no
`gameplayEvent()` (Game Events are `measure()`) and no `setScore()` (the official
score path is the `init({ submitScore })` handshake, which this repo already had
right). `sendHighscore` does exist in the CDN build but is legacy and unwired.

## The canonical surface

Wired = called by `src/sdk/poki.ts` or the boot path in `src/sdk/platform.ts`.

### T1 — published typings (all wired unless noted)

`init({ debug, logging, submitScore })` · `rewardedBreak({ size, onStart })` ·
`commercialBreak(onStart)` · `shareableURL(params)` · `getURLParam(key)` ·
`getLanguage()` · `getDeviceInfo()` · `getUser()` · `getToken()` · `login()` ·
`showLeaderboard(id)` · `captureError(err)` · `gameLoadingFinished()` ·
`gameplayStart()` · `gameplayStop()` · `setDebug(on)` · `setLogging(on)` ·
`enableEventTracking()` · `openExternalLink(url)` · `playtestSetCanvas(canvas)` ·
`playtestCaptureHtml{Once,Force,On,Off}()` · `movePill(topPercent, topPx)` ·
`measure(category, what, action)`

Not wired, deliberately: `displayAd` / `destroyAd` — real members, but the HTML5
guide documents only commercial and rewarded breaks and Poki decides ad
placement, so opening a display slot is a policy risk with no upside. `mountBanner`
stays an honest no-op.

### T2 — live CDN build only

| Member | Wired | Why |
|---|---|---|
| `gameLoadingStart()` | yes | opens the loading phase; every engine wrapper calls it before asset work |
| `happyTime(intensity)` | yes | documented in T3 as an intensity 0…1 |
| `isAdBlocked()` | yes | the only ad-block probe Poki ships |
| `gameLoadingProgress(v)` | no | fraction vs. percent is undocumented — guessing would misreport the bar |
| `gameInteractive()` | no | legacy marker; `gameLoadingFinished()` is the documented conversion signal |
| `sendHighscore(score)` | no | legacy; `init({ submitScore })` is the published handshake |
| `getLeaderboard()` | no | our board is AUDS-backed; `showLeaderboard()` is the portal UI side |
| `customEvent(...)`, `logError(...)` | no | `measure()` and `captureError()` are the documented channels |
| `muteAd()`, `roundStart()`, `roundEnd()`, `setPlayerAge()`, `generateScreenshot()`, `initWithVideoHB()`, `setDebugTouchOverlayController()`, `setPlaytestCanvas()` | no | undocumented or portal-internal; recorded so nobody re-invents them |

## Game Events (`measure`) — the rules the SDK enforces

`PokiSDK.measure(category, what, action)` is Poki's analytics channel; the live
loader validates it before forwarding, so an invalid call is dropped silently.
`sanitizeMeasure()` in `src/sdk/poki-canon.ts` applies the same three rules
*before* the call, and warns in DEV:

1. `category` and `what` are required and non-empty after trimming (`action` may be empty);
2. no argument may contain `/` or `^` — Poki reserves `/` for event paths and `^` for funnel keys;
3. **at most two numeric values** across all three arguments (digit runs and literal
   `{n}` placeholders both count), so a distance or a level number must be bucketed.

Special actions: `start` → `complete` | `fail` (one outcome per attempt) for
progress; `visible` → `interact` for placements; anything else is a custom event.
Categories come from the published vocabulary (`round`, `quest`, `checkpoint`,
`rewarded`, `cosmetic`, `upgrade`, `powerup`, `achievement`, `economy`, `player`,
`button`, …) and `poki-canon.test.ts` fails if our list drifts from the typings.

What the game now reports upstream:

| Where | Events |
|---|---|
| Run lifecycle | `round/<mode>/start` → `complete`\|`fail` |
| Retention funnel | `player/funnel-<stage>/reached` for every `Funnel` milestone |
| Rewarded placements | `rewarded/continue-ad-<kind>/visible`+`interact`, `rewarded/results-coin-multiplier/visible`+`interact`+`granted` |
| Live-ops (`Events.ts`) | `quest/weekly-event/start`→`complete`\|`fail`, `quest/daily-challenge/…`, `quest/gauntlet/…`, `checkpoint/gauntlet-stage/…` |
| Meta | `achievement/<id>/unlocked`, `achievement/mode-mastery/mastered`, `upgrade/mode-mastery/level-up`, `cosmetic/<id>/unlocked`, `cosmetic/theme-trail/unlocked`, `economy/coins/spent`, `player/personal-best/reached` |

Live-ops was the real gap: weekly and monthly progress was tracked internally and
never reported, which is what Poki's Game Events dashboard was showing as empty.

## Celebrations, locale and the mid-ad lock

- **`happyTime(intensity)`** — personal best `1`, gauntlet clear and prize-bird
  unlock `0.9`, achievement `0.85`, weekly clear and mastery `0.8`. The
  CrazyGames adapter maps the same call to its own `game.happytime()` and gates it
  at `≥ 0.75`, because its docs ask for it to be used sparingly.
- **`getLanguage()`** is the canonical locale source. It is injected into i18n as a
  provider (`setPortalLanguageProvider`) and **outranks** `navigator.language`,
  because it carries the language the player chose on the portal. It only ever
  moves an `auto` preference — an explicit choice wins — and `refreshAutoLocale()`
  re-resolves once the SDK lands, since the adapter boots after i18n initialises.
- **`getUser().optedIn`** is part of the published `User` shape: a player who has
  not opted in is never surfaced as an identity.
- **No `gameplayStart` mid-break.** `beginPortalBreak(placement)` sets the `"ad"`
  state, takes the `adInFlight` lock and emits the request telemetry in one place
  (five placements); `setState` drops any transition out of `"ad"` while the lock
  is held, and `endPortalAd()` releases it before the awaiting caller resumes. The
  self-served interstitial in non-portal builds uses the same state but is driven
  by `adTimer`/`endAd()` and deliberately stays outside the lock.

## Script loading

The HTML5 guide shows a static `<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js">`
in `<head>`. This repo injects the same URL dynamically instead, because the
portal artifact is a single inlined `index.html` and `scripts/audit-zips.mjs`
fails any static remote reference in a zip. Poki's own engine plugins do the same
(the Phaser plugin "injects & loads the Poki SDK for you, asynchronously"), and the
loader itself loads its core build dynamically — so the request pattern the
Inspector sees is identical, and `game-cdn.poki.com` is in the CSP request either way.

## Enforcement

| Layer | What it prevents |
|---|---|
| `PokiSdkOfficial` mapped from `@poki/sdk` | Calling a member Poki does not publish — compile error |
| `src/sdk/__tests__/poki-canon.test.ts` | Re-reads the typings at run time: every referenced member must be canonical; the runtime-only registry must match what is actually wired; the `measure` vocabulary must match the published union; invented names must not appear on a Poki SDK access |
| `src/sdk/__tests__/poki-loading-net.test.ts` | Uses a recording **Proxy** as the SDK double, so a test can no longer pass by inventing a method the real SDK lacks |
| `src/game/__tests__/poki-analytics.test.ts` | Break order, the five placements, the mid-ad lock, `happyTime` clamping |
| `pnpm poki:audit` | `REQ-71` … `REQ-76` |
