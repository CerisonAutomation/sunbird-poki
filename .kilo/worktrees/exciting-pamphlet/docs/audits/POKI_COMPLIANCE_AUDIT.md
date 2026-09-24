# Sunbird: Golden Flight — Poki Compliance Audit
> **Status:** historical evidence — the narrative Poki compliance pass of 2026-09-22. Its fix log (F1–F8) and submission actions (C1–C13) are still cited as evidence by [`../poki/requirements.json`](../poki/requirements.json). Live, machine-checked status is generated: `pnpm poki:audit` → [`../poki/COMPLIANCE.md`](../poki/COMPLIANCE.md). One fact below has since changed: the game id quoted here (`7a58628a-…`) is no longer the one in `build:poki`. The authoritative id lives only in `package.json`, is pinned by `src/game/__tests__/poki-build-ids.test.ts`, and must be diffed against the dashboard as rule `TOOL-09` describes — see [`../poki/08-game-dev-tools.md`](../poki/08-game-dev-tools.md).

*Branch: integration · Date: 2026-09-22*

---

## Hard Requirements

| Req | Status | Notes |
|-----|--------|-------|
| Desktop + mobile + tablet | ✅ | Responsive layout, touch controls |
| 16:9 aspect ratio | ✅ | Scales to 640×360, 836×470, 1031×580 |
| Incognito support (localStorage try/catch) | ✅ | All storage wrapped in try/catch |
| No external requests | ✅ | All assets bundled; VITE_LEADERBOARD_URL= in Poki build |
| No branding / external ads | ✅ | Stripe links blanked; no studio splash |
| No ad block prevention | ✅ | Game stays fully playable without ads |

---

## SDK Integration

| Event | Status | Notes |
|-------|--------|-------|
| `gameLoadingStart()` | ✅ | Fires once right after `init()` in bootstrapSdk() |
| `gameLoadingFinished()` | ✅ | One-shot via PokiAdapter; failsafe net prevents double-fire |
| `gameplayStart()` | ✅ | Guarded by GameplayEvents.ts — never fires twice in a row |
| `gameplayStop()` | ✅ | Guarded by same state machine |
| `commercialBreak()` | ✅ | Fires on pause-exit → back-to-gameplay only |
| `rewardedBreak()` | ✅ | Coin multiplier on portal; clear alternative button always shown |
| No SDK events during ads | ✅ | GameplayEvents blocks events while ad flag is set |
| signalGameReady() | ✅ | Called in loadingFinished path |

---

## Monetisation / IAP

| Item | Status | Notes |
|------|--------|-------|
| No internal purchases (IAP) | ✅ FIXED | All `open-paywall` buttons guard on `SELL_AD_REMOVAL=false` in Poki build; `open-paywall` action in Game.ts also returns early |
| Gold upsell strip hidden | ✅ FIXED | `upsellStrip()` returns "" when `SELL_AD_REMOVAL=false` |
| Nest Pass Gold upsell hidden | ✅ FIXED | Guard added on Nest Pass screen |
| Account screen Gold/VIP buttons | ✅ FIXED | Show "Portal member" label instead of buy buttons |
| Shop locked-item Gold/VIP buttons | ✅ FIXED | Show "Gold perk" tag instead of paywall button |
| VIP subscribe/extend hidden | ✅ FIXED | VIP row hidden on Poki |
| No secondary dual currency (gems) | ✅ | Only one currency: coins |
| No ad-timer manipulation | ✅ | Poki controls ad frequency; `INTERSTITIAL_EVERY` only applies to dev builds |
| One reward per action | ✅ | `multiplierClaimed` flag prevents double reward |
| Rewarded button always has alternative | ✅ | Standard continue button shown alongside rewarded option |
| Rewarded buttons not green | ✅ | Gold styling (#ffd264), not green |
| Reward buttons have 🎬 icon | ✅ | Label includes 🎬 on portal build |
| No ad-block custom messaging | ✅ | Poki handles this |

---

## Leaderboard

| Item | Status | Notes |
|------|--------|-------|
| Score submission | ✅ | `pokiSubmitScore()` called after each run via `submitPlatformScore()` |
| Poki leaderboard overlay | ✅ | `showLeaderboard()` wired; button appears when `portalLeaderboard=true` |
| AUDS cloud leaderboard | ✅ | VITE_POKI_GAME_ID=7a58628a-e5de-42eb-8978-244276f68366 set in build:poki |
| Score submitted name | ✅ | Auto-generated pilot name (CUSTOM_PILOT_NAMES=false on Poki) |

> ⚠️ **Verify**: The AUDS game ID (`7a58628a-...`) must match what Poki provisioned for this game. Check the Poki developer dashboard under AUDS settings if leaderboard data is missing.

---

## Multiplayer / Netlib

| Item | Status | Notes |
|------|--------|-------|
| PvP matchmaking | ✅ | Via @poki/netlib; pumpMatchmaking() fixed — waits for full lobby before AI fallback |
| Profanity filtering | ✅ | Pilot names auto-generated (no user text input in Poki build) |
| No unmoderated chat | ✅ | SQUAD_CHAT=false; emote-only in multiplayer |

---

## UI / UX

| Item | Status | Notes |
|------|--------|-------|
| Challenges screen-head overlap | ✅ FIXED | Pill text shortened to "Daily · Weekly"; CSS max-width added |
| Long Light tile position | ✅ FIXED | Added as first item in "Fly" play destinations grid |
| No external links without openExternalLink() | ⚠️ CHECK | Any external URL must call `PokiSDK.openExternalLink()` — verify Discord/social buttons |
| ESC / spacebar pause | ✅ | Space pauses; fires gameplayStop() |
| Cutscenes skippable | ✅ | Tutorial/onboarding skippable from first frame |
| Mobile controls on tablet | ✅ | Touch detection forces mobile scheme |
| Canvas viewport scroll prevention | ✅ | `touch-action: none` on game canvas |

---

## Build Checklist

| Item | Status |
|------|--------|
| `VITE_PORTAL_TARGET=poki` | ✅ |
| `VITE_POKI_GAME_ID` set | ✅ |
| `VITE_STRIPE_*` links blanked | ✅ |
| `VITE_LEADERBOARD_URL=` (empty) | ✅ |
| `VITE_MULTIPLAYER_URL=` (empty) | ✅ |
| `SELL_AD_REMOVAL=false` | ✅ (edition.poki.ts) |
| Debug code removed | ✅ (`setDebug(true)` only in DEV) |
| No `console.log` left | Run: `grep -rn "console\.log" src/game/` |

---

## Human Action Items

- [ ] Run `pnpm build:poki` and verify `dist-poki/` builds clean
- [ ] Open `dist-poki/index.html` in browser and walk the Poki Inspector checklist
- [ ] Confirm AUDS game ID with Poki dashboard matches `VITE_POKI_GAME_ID`
- [ ] Run `node scripts/capture-animated-thumbnail.mjs` on GPU machine (requires WebGL)
- [ ] Upload thumbnail via Poki developer portal
- [ ] Test leaderboard score submission via `pnpm poki:upload` to playtest environment
- [ ] Walk Poki Inspector QA modules on the uploaded build
- [ ] Set `VITE_POKI_NETLIB_GAME_ID` in build script once confirmed from Poki dashboard

---

## Quick Commands

```bash
# Build Poki zip
pnpm build:poki

# Upload to Poki (builds first)
pnpm poki:upload

# Run Poki artifact e2e tests
pnpm test:artifact

# Type check
pnpm tsc --noEmit
```
