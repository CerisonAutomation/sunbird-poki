# Game Events (`measure`) — extracted reference

Source: <https://developers.poki.com/guide/game-events>

`measure(category, what, action)` is the analytics checkpoint API. Events are only
recorded once **event tracking is enabled**: the SDK exposes
`PokiSDK.enableEventTracking()`, which the game calls on boot.

## Event values

| ID | Kind | Rule |
|---|---|---|
| `GM-01` | requirement | **Event tracking is switched on at boot** (`enableEventTracking()`), otherwise no `measure()` checkpoint reaches the dashboard. |
| `GM-02` | requirement | `category` is a short stable group (`level`, `tutorial`, `button`, `run`, `difficulty`…); `what` identifies the specific thing; `action` is the state. Values must be stable across versions so funnels stay comparable. |
| `GM-03` | requirement | `/` and `^` are **reserved** by the platform: they must not appear in `category`, `what` or `action`. |
| `GM-04` | requirement | Progress events pair `start` with exactly one of `complete` or `fail`, using the same category/what. |

## Interaction events

| ID | Kind | Rule |
|---|---|---|
| `GM-05` | requirement | An offered interaction emits `visible` when it becomes visible and `interact` when the player uses it, with the same category/what — that pair is what turns exposure and engagement into comparable numbers. |
| `GM-06` | requirement | Ad playback and outcomes are tracked automatically by the ad calls; `measure()` must not duplicate ad impressions or completions. It is still correct — and wanted — to measure the **in-game placement** that led to the break. |
| `GM-07` | recommendation | Rewarded placements should be measured per placement (`rewarded` / `treasure-chest` / `visible`), so the dashboard can show which offer earns its space. |
| `GM-08` | recommendation | Milestones and choices that fit no pattern use custom actions (`currency` / `gold` / `spent`, `milestone` / `first-upgrade` / `reached`). |

## Special action values

| ID | Kind | Rule |
|---|---|---|
| `GM-09` | informational | `start`, `complete`, `fail` feed progress reporting; `visible`, `interact` feed interaction reporting; anything else is reported as a “reached this event” percentage. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `GM-01` | `src/sdk/platform.ts#bootstrapSdk()` calls `enableEventTracking()` right after `init({ submitScore })`, inside its own `try` so an older CDN build degrades instead of failing. Asserted by the stub-SDK boot probe. |
| `GM-02` | Categories in use: `run` (mode id as `what`, `start` at run start, outcome at the end), `button` (`results-coin-multiplier`, the continue placement, `shop-*`), `reward` (`granted` when the multiplier lands). |
| `GM-03` | `src/game/__tests__/poki-game-events.test.ts` scans every `measure(...)` call site in `src/` and fails on a `/` or `^` in any of the three values. |
| `GM-04` | The run funnel sends `run/<mode>/start` when the flight starts and `run/<mode>/complete|fail` from the settlement path — one outcome per attempt. |
| `GM-05`, `GM-07` | Rewarded placements emit `visible` when the offer card renders and `interact` when it is chosen (`continuePlacementLabel(kind)` keeps the placement name stable); the results coin multiplier does the same. |
| `GM-06` | No `measure()` call duplicates an impression; `REQ-14`-style coverage is measured only on the offer UI. |
| `GM-08` | `reward` / `results-coin-multiplier` / `granted` records the milestone; `device_profile` / `device_summary` are telemetry, not `measure()`, so they stay out of the event funnel. |
