# Sunbird Portal Builds

Sunbird ships four explicit build targets through `VITE_PORTAL_TARGET`:

| Target | Monetization path | Payments in this target | Notes |
| --- | --- | --- | --- |
| `none` | Standalone/PWA model | Coins only; no processor wired | Default local and self-hosted build. |
| `poki` | Poki SDK commercial + rewarded breaks | Coin-only VIP progression; no IAP | No banner integration; Poki rules prohibit IAP. |
| `crazy` | CrazyGames SDK midgame + rewarded breaks | Coin-only VIP progression; no IAP | Optional dashboard banner slot; live multiplayer requires Full Launch approval. |
| `generic` | None (clean build) | Coins only | For every other HTML5 portal — see matrix below. |

## Build commands

```bash
pnpm build:poki      # → sunbird-poki.zip
pnpm build:crazy     # → sunbird-crazy.zip
pnpm build:generic   # → sunbird-generic.zip
pnpm build:portals   # all three
pnpm verify:portals  # compliance gate over the three zips (0 = shippable)
```

Each zip is fully self-contained (single inlined `index.html` + `icons/` + `fonts/`),
uses **only relative asset paths** (`base: "./"`), and boots from any subdirectory
of any CDN — verified by serving the zip from a deep subpath and playing it.

## Portal compliance matrix (what each portal checks, and how Sunbird passes)

| Requirement | Enforced by | How Sunbird complies |
| --- | --- | --- |
| No external payment providers | Poki, CrazyGames, GD, Yandex | No build loads one: `@stripe/stripe-js` is not a dependency, `Payments.ts` / `Payments.portal.ts` return `null` from every processor entry point, and VIP is earned with coins (plus optional host rewarded ads). Tripwire: `scripts/verify-portal.mjs` fails any zip containing `js.stripe.com`, `api.stripe.com`, `hooks.stripe.com`, `upstash` or a `pk_live_`/`pk_test_` key. |
| No external links out of the iframe | All portals | There is no `window.open` anywhere in `src/`. The one outbound link — the hosted privacy policy, which Poki requires before it stores a custom CSP — goes through the platform API (`PokiSDK.openExternalLink`), is rendered only when the host advertises the `externalLink` capability, and `scripts/audit-zips.mjs` fails a zip containing `window.open(`, `location.href =` or an external `<a href>`. |
| Relative asset paths (served from CDN subpaths) | All portals | `base: "./"` in vite config; no absolute `/asset` references (grep-verified in built html). |
| Silent when tab is hidden | CrazyGames QA, Poki QA | `visibilitychange` pauses gameplay **and** hard-mutes the master audio bus (`setHiddenMuted`). |
| Silent + input-locked during ads | Poki, CrazyGames | `onAdOpened` → input disabled + master mute; `onAdClosed` restores. |
| Audio only after user gesture | Chrome autoplay policy, all portals | `AudioContext` resumes exclusively inside input callbacks. |
| `gameplayStart`/`gameplayStop` fired correctly | Poki, CrazyGames | Emitted on every transition in/out of the `playing` state. |
| Portal mute honored over in-game toggle | CrazyGames (Full) | `game.settings.muteAudio` applied at boot + live via `addSettingsChangeListener` → master-bus `setPortalMuted` (takes priority, never touches saved prefs). |
| Celebration signal on special moments | CrazyGames (Full) | `game.happytime()` fired sparingly — only on a new personal-best run. No-op on other targets. |
| Loading-finished signal | Poki (`gameLoadingFinished`), CrazyGames (`loadingStop`) | Fired once boot completes; SDK load capped at 6 s so a blocked SDK never hangs the game. |
| Works in a sandboxed/cross-origin iframe | All portals | Every `localStorage` access is try-wrapped with in-memory fallback; no service worker in portal builds; no `window.top` access beyond a try-wrapped embed check. |
| No install prompts / PWA UX | All portals | `beforeinstallprompt` capture is suppressed in portal builds; manifest link stripped from portal zips. |
| No file downloads | Poki QA | Share falls back to clipboard-copy in portal builds instead of downloading the image card. |
| Keyboard + mouse + touch all fully playable | All portals | One-button design; space/click/touch all drive the same input path; arrows/space `preventDefault`ed so the host page never scrolls. |
| Landscape + portrait both usable | CrazyGames (desktop-first), Poki (mobile-first) | Fluid layout; HUD verified at 1280×720 and 420×800. |
| Ad frequency sane / no forced pre-roll spam | Poki | Commercial break only at the death→restart seam; rewarded only on explicit user choice ("Second Wind"). |
| Runs offline once loaded (no hard network deps) | GD, Yandex | Multiplayer/leaderboard endpoints are compile-time empty in portal builds; the game silently runs local ghosts + local boards. |
| No PII collection / no cookies | GDPR, all portals | No accounts, no cookies; a random device id in localStorage; telemetry logs to console only (no endpoint). |

### Portals covered by `sunbird-generic.zip`

GameDistribution, Yandex Games, itch.io, Newgrounds, GameMonetize, Lagged,
Coolmath Games, Kongregate, Armor Games, GamePix, Famobi, SoftGames. The
generic target applies **all** portal restrictions (no payments, no installs,
no downloads, no external requests at all) with no ads SDK — portals that
require their own SDK wrapper can inject it around the zip, and the game's
`window`-level cleanliness means no conflicts.

> Yandex Games note: Yandex requires their SDK to be called for their ads.
> Upload the generic zip for review; if they request SDK integration, add a
> `yandex` adapter to `src/sdk/platform.ts` following the CrazyGames pattern
> (~40 lines).

## Runtime Sequence

1. The menu becomes interactive immediately; portal SDK setup runs in parallel.
2. When ready, the adapter emits the portal loading-complete signal.
3. Every transition into active play emits `gameplayStart`; pause, death, continue, and menu emit `gameplayStop`.
4. Portal builds request a commercial break only at the death-to-restart seam.
5. A Second Wind requests a rewarded break. The run resumes only when the SDK returns a positive reward result.
6. While an ad is open, Sunbird disables all input and mutes the master audio bus.
7. While the tab is hidden, gameplay pauses and the master bus is muted.

## Portal QA Checklist

- Use a current Chrome, Edge, Firefox, or Safari browser with WebGL hardware acceleration enabled.
- Boot the zip from a subdirectory (portals never serve from `/`) — Sunbird's relative base handles this.
- Confirm zero external requests in portal builds beyond the portal's own SDK.
- Confirm the game is silent when the tab is hidden and while ads play.
- Confirm keyboard-only, mouse-only, and touch-only playthroughs all work.

## Per-portal submission notes (verified 2026-09-14)

All three zips: ~627 KB zipped / ~1.3 MB single-file html + local icons/fonts —
far under Poki's 8 MB initial-load target and CrazyGames' 20 MB mobile /
50 MB initial bars. `pnpm verify:portals` re-checks every line below.

| Portal | File | SDK signals | Submit where |
| --- | --- | --- | --- |
| Poki | `sunbird-poki.zip` | `gameLoadingFinished` on boot; `gameplayStart` on first input / every return; `gameplayStop` on pause, death, menu; `commercialBreak` at death→restart seam; `rewardedBreak` for Second Wind (reward only on positive result) | Poki for Developers → upload → test in Poki Inspector event log |
| CrazyGames | `sunbird-crazy.zip` | `loadingStart` on SDK init → `loadingStop` on boot; `gameplayStart/Stop` bracket play; midgame ad at restart seam, rewarded for Second Wind; mute + input lock during ads | Developer portal → Submit a game → Preview tool (Basic → Full Launch) |
| GameDistribution, Yandex, itch.io, Newgrounds, GameMonetize, Lagged, Coolmath, Kongregate, Armor, GamePix, Famobi, SoftGames | `sunbird-generic.zip` | No SDK, no remote loads at all; host wraps the zip with its own player/SDK | Each portal's upload flow; for Yandex-SDK-gated review add a `yandex` adapter in `src/sdk/platform.ts` (~40 lines, CrazyGames pattern) |

Manual QA per submission (can't be scripted): play 2+ minutes on desktop
Chrome/Edge AND one mobile browser; kill a run to hit the restart seam;
take the Second Wind ad; background the tab mid-flight; confirm silence +
pause in each case; confirm no portal-console errors.
