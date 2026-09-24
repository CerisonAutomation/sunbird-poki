# Poki for Developers — submission sheet

Everything the dashboard asks for, ready to paste. Game:
**Sunbird** · id `3625e78b-0b3d-4f62-8224-ac1c4b2a9ab2` · build: `poki-upload/` + `sunbird-poki.zip`.

## 1. Game settings → General

| Field | Value to enter |
|---|---|
| **Game Title** | `Sunbird` |
| **Thumbnail** | `assets/submission/sunbird-thumbnail-1024.png` (or the 628 copy — both are the same art). Full-bleed square, bird centred, no text, palette graded to clear the `#83FFE7` playground. Regenerate with `node scripts/render-thumbnail.mjs`, verify with `pnpm verify:thumbnail`. |
| **Game Engine** | `three-js` |
| **Suggested Categories** (max 4) | `Multiplayer Games`, `Flappy Bird Games`, `Racing Games`, `Popular Games` |
| **Suggested Description** | see below |
| **Privacy Policy URL** | `https://sunbird-snowy.vercel.app/privacy.html` — or wherever the standalone deploy serves `public/privacy.html`. Override the in-game link with `VITE_PRIVACY_URL` so the game and the dashboard agree. |

### Suggested description (paste as-is)

> Chase the sun across endless floating islands. Hold to dive, release to glide,
> thread the ridges and keep your daylight burning. Race other pilots in real-time
> PvP, take on the AI flock, or fly solo circuits for medals and ghosts. Unlock
> wing designs, seasonal tiers and daily goals as every flight counts.

### Integrations tab

| Setting | Value |
|---|---|
| **Game ID (AUDS / leaderboards / Netlib)** | `3625e78b-0b3d-4f62-8224-ac1c4b2a9ab2` — supply at build time as `VITE_POKI_GAME_ID` (AUDS, leaderboards, ghost shares, settings sync) and `VITE_POKI_NETLIB_GAME_ID` (Netlib P2P races). Both are optional at build time: without them the game degrades honestly (on-device board, AI flock) instead of offering dead buttons. |
| **Poki leaderboard name** | `distance` (the dashboard board the run score is submitted to). Rename it in the dashboard → set `VITE_POKI_LEADERBOARD` to match; no code change needed. |
| **User Accounts** | Enabled in the build. `getUser()` runs after load and greets the signed-in player; `login()` is only ever triggered by the player pressing **Sign in** in Settings, as the User Accounts guide requires. |
| **Cloud gamesaves** | Transparent — nothing to configure. Local-only data (board caches, ghost recordings, AUDS secrets, diagnostics) is excluded with the documented `poki_ignore` prefix, keeping the synced payload far under the 1 MB gzip cap. |

### CSP tab (external resources)

Request these three, with the explanation that they are the platform's own services:

| Resource | Why |
|---|---|
| `https://game-cdn.poki.com` | the PokiSDK script itself, loaded in the page head |
| `https://auds.poki.io` | leaderboards, ghost flights, shared-run codes (AUDS) |
| `wss://netlib.poki.io` | Netlib signalling for peer-to-peer races (WebRTC data channels; Poki-hosted STUN/TURN) |

No other external request exists in the build — fonts, images and audio are bundled
(`pnpm verify:portals` fails the release if anything else is reachable).

## 2. Media kit

| Asset | Path |
|---|---|
| Static thumbnail (1024) | `assets/submission/sunbird-thumbnail-1024.png` |
| Static thumbnail (628, spec minimum) | `assets/submission/sunbird-thumbnail-628.png` |
| Same art inside the build | `public/poki/thumbnail-628.png`, `public/poki/thumbnail-1024.png` (byte-identical — pinned by `thumbnail-parity.test.ts`) |
| Animated thumbnail (3–5 s loop) | `promo/animated/` capture pipeline — `node scripts/capture-animated-thumbnail.mjs` on a GPU machine, then upload from the Versions tab. Required before Global Release. |

## 3. Upload checklist

1. `pnpm upload:poki` — builds, packages `poki-upload/`, prints the folder + zip and runs the Inspector-shaped gate.
2. `pnpm verify:upload` — root `index.html`, fresh against `dist-poki/`, no junk, Poki integrations present.
3. `pnpm poki:audit` — runs every rule in this corpus and rewrites `COMPLIANCE.md`; exit code non-zero if a satisfied rule regressed.
4. Drop the **folder** into the Inspector (or upload the zip in Versions), walk the Event Log, then request review.

## 4. Before requesting a review

| Step | Where |
|---|---|
| Content moderation | automatic on upload (no chat, no IAP, family-friendly content). Typed call signs **are** allowed and go through the moderation pipeline in `src/game/pilotNameModeration.ts` — say this if the reviewer asks, since "no typed player text" would be inaccurate. |
| Playtest | needs 10 recordings watched to unlock the player fit test |
| Player fit test | target: average playtime 3 min+, ≥ 25 % of plays over 3 min |
| Web fit test | weights CTR, average time on page and C2P (first `gameplayStart()`) equally |
| Final review | 1–2 weeks after the tests, then legal → QA → Soft Release → Global Release |

## 5. Build-time environment

```bash
VITE_PORTAL_TARGET=poki \
VITE_POKI_GAME_ID=<game id> \
VITE_POKI_NETLIB_GAME_ID=<netlib game id> \
VITE_POKI_LEADERBOARD=distance \
VITE_PRIVACY_URL=https://<your-host>/privacy.html \
pnpm build:poki
```

Every one of these is optional for the build to succeed and mandatory for the
feature behind it to be active — the build degrades to the on-device board, the AI
flock and the default policy URL rather than shipping a button that does nothing.
