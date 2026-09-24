# Poki game development tools — extracted reference

Source: <https://developers.poki.com/guide/game-dev-tools>

## Poki Inspector

| ID | Kind | Rule |
|---|---|---|
| `TOOL-01` | informational | The Inspector is a **quality-assurance tool**: it evaluates an uploaded web game against the platform's key success factors. |
| `TOOL-02` | requirement | Test **mobile compatibility** and **technical optimisation** by uploading a web build; the Inspector runs the game (including mobile mode) and flags SDK event sequences, external resources and image weights. |
| `TOOL-03` | requirement | The build must therefore be **uploadable as a folder with `index.html` at the root** and must run correctly when served from an arbitrary sub-path inside the Inspector's mobile frame. |

## Poki Networking Library (Netlib)

| ID | Kind | Rule |
|---|---|---|
| `TOOL-04` | informational | Netlib is a **peer-to-peer library using WebRTC datachannels** to give players direct connections. It exists to make WebRTC tractable for web games — the guide compares it in spirit to the Steam Networking Library. |
| `TOOL-05` | informational | Netlib is available **whether or not the game is hosted on Poki** — it is not a hosting lock-in. |
| `TOOL-06` | requirement | If the game uses it: WebRTC support must be feature-detected, and a non-WebRTC path must exist for players/browsers without it. |

## Arbitrary User Data Store (AUDS)

| ID | Kind | Rule |
|---|---|---|
| `TOOL-07` | informational | AUDS is a **prototype backend service** for storing user-generated content such as levels or leaderboard data. It generates **shareable codes** for stored data, which enables features such as **non-real-time multiplayer**. |
| `TOOL-08` | informational | AUDS is currently **exclusive to games hosted on the Poki platform** (`auds.poki.io/v0/<game-id>/…`), so it cannot be a dependency of a build that must also ship to other portals. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `TOOL-01`–`TOOL-03` | `pnpm build:poki` produces `dist-poki/` and **generates `poki-upload/`** — the folder the Inspector is given — plus `sunbird-poki.zip` with the same bytes. `scripts/package-portal.mjs` puts `index.html` at the root, keeps references relative and strips the manifest link; `pnpm verify:upload` (`ROOT-01`–`ROOT-06`) is the Inspector-shaped gate: root `index.html` in folder *and* zip, no wrapping directory, folder proven current against `dist-poki/`, uploadable files only. `pnpm verify:portals` + `pnpm audit:zips` cover the content rules. Nothing in the build requires a sub-path assumption. Runbook: [`UPLOAD.md`](./UPLOAD.md). |
| `TOOL-04`–`TOOL-06` | The Poki edition races over **Netlib P2P** — `src/game/PokiNetlib.ts` (WebRTC datachannels, `wss://netlib.poki.io/v0/signaling`, reliable + unreliable channels) is loaded through a dynamic import, so its weight never lands in the initial download and never reaches another edition. `isPokiMultiplayerAvailable()` feature-detects `RTCPeerConnection` + `crypto.getRandomValues`; without them (or without `POKI_MULTIPLAYER`) the game falls back to the local/AI flock instead of failing. Direct and CrazyGames builds keep the self-hosted authoritative WebSocket room server (`VITE_MULTIPLAYER_URL`), and `pnpm isolation:check` + the portal markers keep the two transports from bleeding into each other's bundles. |
| `TOOL-07` | AUDS is implemented in `src/sdk/auds.ts` (create / read / list / update / delete / `_increment`, per-user secrets kept in `localStorage`) and used for public score boards, ghost shares, per-user settings/loadout/progress sync and — the documented non-real-time multiplayer case — **run share codes** (`src/game/SharedRun.ts`). A player publishes a finished run from the results card, gets a code back, and a friend loads it to race the same hills against the same mark; plays are counted through the public `POST …/_increment?key=play-count` endpoint. Every payload from the network is validated and clamped before the game renders it. |
| `TOOL-08` | AUDS stays Poki-only **by construction**: `createAudsIfConfigured()` returns `null` unless `VITE_POKI_GAME_ID` is set, and portal/generic/itch builds ship without it, so every AUDS call is skipped and the UI says so instead of offering a dead button. `pnpm isolation:check` fails the build if `auds.poki.io` or a self-hosted endpoint appears in the wrong edition. Both ids are wired: `package.json`'s `build:poki` sets `VITE_POKI_GAME_ID` and `VITE_POKI_NETLIB_GAME_ID`, which `pnpm poki:audit` grep-verifies, so the built `dist-poki/index.html` carries the id while `dist-crazy` and `dist-generic` carry zero occurrences of it. Whether that id is the one Poki issued cannot be checked from the repo — that is `TOOL-09`. |
| `TOOL-09` | The ids have exactly one home: `package.json`'s `build:poki` script. `.env.example` deliberately carries a placeholder instead of an id, because a second, stale copy fails *silently* — `createAudsIfConfigured()` still returns a client, every AUDS call is skipped by the platform, and boards quietly fall back to local. Before submission: copy the game id from the Poki developer dashboard, diff it against `VITE_POKI_GAME_ID` and `VITE_POKI_NETLIB_GAME_ID` in `build:poki` (they must match exactly), rebuild with `pnpm build:poki`, and confirm the id appears in `dist-poki/index.html` and in no other edition (`pnpm isolation:check`). |
