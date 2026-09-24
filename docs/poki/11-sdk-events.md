# SDK overview & events — extracted reference

Source: <https://developers.poki.com/guide/sdk-overview>

## What the events unlock

| ID | Kind | Rule |
|---|---|---|
| `EV-01` | informational | With the events implemented the dashboard reports playing users, engagement (time in game, loading, ads), earnings by impression type, an hourly error scanner, and player feedback. |
| `EV-02` | informational | `gameLoadingFinished()` is **required** to track loading and conversion to play. |

## The events

| ID | Kind | Rule |
|---|---|---|
| `EV-03` | requirement | `gameplayStart()` = the player starts interacting (first input, level start, unpause). `gameplayStop()` = gameplay halts (pause, level complete, death, quit to menu). |
| `EV-04` | requirement | `commercialBreak()` is fired at natural stops whenever the player is about to head back into gameplay — signal as many opportunities as possible; the platform decides when an ad actually shows. |
| `EV-05` | requirement | `rewardedBreak()` fires only on the player's explicit choice to watch an ad for a reward, and it must be clear beforehand that an ad is coming. |

## Order of events

| ID | Kind | Rule |
|---|---|---|
| `EV-06` | requirement | Startup: `gameLoadingFinished()` → `gameplayStart()`. |
| `EV-07` | requirement | Death and restart / next level / pause and unpause: `gameplayStop()` → `commercialBreak()` → `gameplayStart()`. |
| `EV-08` | requirement | Death and revive: `gameplayStop()` → `rewardedBreak()` → `gameplayStart()`. |
| `EV-09` | requirement | An ad that does **not** interrupt gameplay needs no stop/start pair around it. |
| `EV-10` | requirement | The Inspector will flag consecutive duplicates and out-of-order phases; a phase may never be sent twice in a row, and no gameplay phase may be sent while an ad is on screen. |

## Testing

| ID | Kind | Rule |
|---|---|---|
| `EV-11` | requirement | The Inspector's Event Log is the acceptance surface: run the build there and confirm the sequence before requesting review. |
| `EV-12` | informational | `poki-cli` (GitHub: `poki/poki-cli`) uploads builds from CI. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `EV-06`, `EV-07`, `EV-08` | The exact sequences are encoded in `src/game/__tests__/poki-analytics.test.ts`, which drives the real adapter with a stubbed `window.PokiSDK` and asserts: boot = `init → gameLoadingStart → … → gameLoadingFinished → gameplayStart`; pause→resume = `commercialBreak` start/end then `gameplayStart`; revive = `rewardedBreak` then `gameplayStart`. |
| `EV-10` | `GameplayEventSink` suppresses repeats; the tests assert zero gameplay events between a break's start and end, and that no `gameplayStart` follows a `gameplayStop` without an intervening break. |
| `EV-09` | `beginPortalAd()` documents and implements the rule: a coin/menu break sends no phase change of its own, because the halt that preceded it is already on the books. |
| `EV-11` | `poki-upload/` (folder + zip) is the Inspector input; `pnpm verify:upload` proves it matches the built artifact byte-for-byte, so what the Inspector sees is what shipped. |
| `EV-12` | `pnpm upload:poki` performs the full local equivalent (build → package → verify → print the exact folder/zip to drop into the Inspector). |
