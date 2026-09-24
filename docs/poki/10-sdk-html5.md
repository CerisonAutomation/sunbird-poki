# PokiSDK: HTML5 — extracted reference

Source: <https://developers.poki.com/guide/sdk-html5>

The JavaScript SDK is the foundation every engine integration wraps. Five steps.

## 1 — Initialize

| ID | Kind | Rule |
|---|---|---|
| `SDK-01` | requirement | The SDK is loaded from the platform's own CDN **in the page head**: `<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>`. No bundler-side copy, no other host. |
| `SDK-02` | requirement | `PokiSDK.init()` runs at the start of the game; the game **continues on both outcomes** (`.then()` and `.catch()`) — a blocked or failed SDK must never block play. |
| `SDK-03` | requirement | `gameLoadingFinished()` fires when loading completes; it is what conversion-to-play is measured from. |

## 2 — Gameplay phase

| ID | Kind | Rule |
|---|---|---|
| `SDK-04` | requirement | `gameplayStart()` marks player-controllable play (level start, unpause) and `gameplayStop()` marks its halt (level finish, game over, pause, quit to menu). Both are one-shot per transition: **a phase may not repeat itself**. |

## 3 — Commercial breaks

| ID | Kind | Rule |
|---|---|---|
| `SDK-05` | requirement | `commercialBreak()` is called on natural stops, at the moment the player is about to head back into gameplay. Not every call shows an ad — the platform decides — so opportunities should be signalled liberally. |
| `SDK-06` | requirement | Around the break the game pauses itself: mute audio and disable input while the ad runs, restore after. The pause callback may not fire (a break can be skipped), so restore must never depend on it. |
| `SDK-07` | requirement | A break that does **not** interrupt gameplay (unlock a skin from a menu) carries no `gameplayStop()`/`gameplayStart()` pair. |

## 4 — Rewarded breaks

| ID | Kind | Rule |
|---|---|---|
| `SDK-08` | requirement | `rewardedBreak()` resolves with a boolean: reward **only** on `true`. The player must be told beforehand that a video is coming, and the option must be optional and clearly labelled (see `MON-*`, `REQ-14`). |
| `SDK-09` | informational | A rewarded break resets the platform's commercial-ad timer, so a player who just watched one will not immediately see another. |

## 5 — Page-level requirements

| ID | Kind | Rule |
|---|---|---|
| `SDK-10` | requirement | Space/arrow keypresses must not scroll the host page: `preventDefault()` on those keys, and `wheel` handled with `{ passive: false }`. Full-window dev hides this; on Poki the game sits in a scrollable page. |
| `SDK-11` | requirement | Shareable links are built with `PokiSDK.shareableURL(params)` (they come back with the platform's `gd…` prefixes) and read back with `PokiSDK.getURLParam(name)`. |
| `SDK-12` | requirement | External navigation goes through `PokiSDK.openExternalLink(url)`; the game must not navigate its own frame away. |
| `SDK-13` | recommendation | The pill can be nudged with `PokiSDK.movePill(topPercent, topPx)` — `topPercent` is 0–50, `topPx` an extra offset on top; the default is `(0, 24)`. It cannot go below 50 % of the game area. |
| `SDK-14` | informational | Pill size: 46×62 px below 1211 px wide, 92×64 px at 1211 px and up. |
| `SDK-15` | requirement | The build is uploaded to the Inspector (folder with `index.html` at its root) and its event log checked before a review request. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `SDK-01` | `scripts/package-portal.mjs` injects the exact CDN `<script>` tag into the Poki head; `pnpm verify:upload` (`ROOT-08`) fails the build if it goes missing, and the tag is asserted by `src/game/__tests__/poki-analytics.test.ts`. |
| `SDK-02` | `src/sdk/platform.ts#bootstrapSdk()` calls `init()` and `gameLoadingStart()` inside a `try`, so a rejected handshake still boots; a 2 s SDK-wait timeout and a loading-screen failsafe cover a CDN that never answers. |
| `SDK-03` | `PokiAdapter.loadingFinished()` is one-shot (`loadingFinishedSent`) and is sent from the Game constructor once renderer, HUD and terrain exist; the entry-point safety net routes through the same adapter so a healthy boot is never double-sent. |
| `SDK-04` | Every phase change funnels through `src/game/GameplayEvents.ts`, which suppresses consecutive duplicates — the exact thing the Inspector flags. |
| `SDK-05`, `SDK-07` | Breaks fire from the state transition that halted play (`Game.beginPortalAd()` deliberately sends no extra phase event); a shop/coin break is not wrapped in stop/start. |
| `SDK-06` | `beginPortalAd()` disables input and ad-mutes audio immediately; `endPortalAd()` restores both and re-syncs the phase if play already resumed. |
| `SDK-08` | `rewardedBreak()`'s boolean gates the reward; the offer is labelled and sits beside a non-ad alternative (`MON-06`, `REQ-14`), with 🎬 on the ad path. |
| `SDK-09` | Nothing in the game schedules ads — no internal timer exists, so the platform's timer is the only one (pinned by `poki-analytics.test.ts`). |
| `SDK-10` | `installPageScrollGuards()` (wired in `Game` boot, detached on dispose) prevents default scrolling for space/arrows and the wheel. |
| `SDK-11` | `PokiAdapter.share()` prefers `shareableURL()` + `getURLParam()` and only degrades to the Web Share API / clipboard when the SDK is absent. |
| `SDK-12` | The settings privacy link goes through `platform.openExternalLink()`; every other outbound link in portal builds is a plain share/copy action. |
| `SDK-13` | `movePill(50, -4)` during boot then `movePill(0, 56)` once the HUD exists, keeping the pill clear of the daylight meter and pause cluster. |
| `SDK-15` | `pnpm build:poki` → `poki-upload/` + `sunbird-poki.zip`; `pnpm verify:upload` is the Inspector-shaped gate (root `index.html`, fresh, uploadable files only). See [`UPLOAD.md`](./UPLOAD.md). |
