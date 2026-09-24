# Poki AUDS Integration (Poki Cloud Storage)

Sunbird ships with first-class support for **Poki AUDS** — Poki's free cloud
storage layer — so Poki-hosted builds get global leaderboards, shared ghosts,
and per-user settings/progress sync **without requiring any self-hosted
backend**. The same build still works outside Poki via the existing Vercel
HTTP leaderboard API (see `LEADERBOARD_API.md`) and offline via localStorage.

- [Enabling it](#enabling-it)
- [Three-tier backend resolution](#three-tier-backend-resolution)
- [AUDS keys used by Sunbird](#auds-keys-used-by-sunbird)
- [Data shapes](#data-shapes)
- [Adding new AUDS-backed features](#adding-new-auds-backed-features)
- [Authentication (Poki User Accounts)](#authentication-poki-user-accounts)
- [Privacy & moderation notes](#privacy--moderation-notes)
- [Testing locally without Poki](#testing-locally-without-poki)

---

## Enabling it

1. Upload the build to Poki (AUDS is only reachable for games on Poki;
   `auds.poki.io` rejects unknown game ids).
2. Copy the game id from your Poki dashboard — it matches the slug in
   `https://poki.com/en/g/<game-id>` (lowercase letters, numbers, hyphens).
3. Build the portal bundle with both env vars set:

```bash
VITE_PORTAL_TARGET=poki VITE_POKI_GAME_ID=your-game-slug \
  pnpm build:poki
```

Leave `VITE_POKI_GAME_ID` blank in local dev / standalone / other-portal
builds — AUDS is silently skipped and the HTTP/local fallback is used.

The client is in `src/sdk/auds.ts` (`createAudsIfConfigured()` returns
`null` whenever the id is missing or malformed).

---

## Three-tier backend resolution

Leaderboards and cloud storage probe backends in order, so every
environment lands on the best available path without compile-time
splitting:

| Priority | Backend             | When it is used                                                  | Scope available         |
|----------|---------------------|------------------------------------------------------------------|-------------------------|
| 1        | HTTP (Vercel/api)   | `VITE_LEADERBOARD_URL` reachable AND game is not a Poki-only build | Global + friends + daily |
| 2        | Poki AUDS           | Poki portal + `VITE_POKI_GAME_ID` set                            | Global top-50, ghosts, sync |
| 3        | localStorage        | Always — last-resort offline mirror                              | Local only              |

`src/game/Leaderboard.ts` exposes `leaderboardBackend()` which returns
`"http" | "auds" | "local"` — the UI surfaces this as a small badge on the
leaderboard tab (🌐 HTTP / ☁️ Poki / 💾 Local) so QA can tell which path is
live.

Submissions fan out to **both** HTTP (when configured) **and** AUDS on a
personal-best, so Poki players always populate the Poki-native board even
if a self-hosted URL is still compiled in.

---

## AUDS keys used by Sunbird

All keys live under a `sb:` namespace (`src/sdk/auds.ts` → `AUDSPREFIX`).
Using namespaced prefixes keeps `list()` scans and TTL sweeps cheap and
avoids collisions with AUDS data other games on your account might store.

| Key prefix                | Visibility | Used for                                                            |
|---------------------------|------------|---------------------------------------------------------------------|
| `sb:score:<metric>`       | Public     | Global leaderboard entries (distance/altitude/perfects/coins).     |
| `sb:ghost:feat:<metric>`  | Public     | Featured/seasonal ghost of the week — picked by the server/dev.    |
| `sb:ghost:share:*`        | Public     | Player-published ghost replays (ranked by score).                  |
| `sb:settings:v1`          | Private    | Per-user settings (audio, controls, pilot name, graphics).         |
| `sb:loadout:v1`           | Private    | Equipped glider/skin/boost starter and cosmetic loadout.           |
| `sb:progress:v1`          | Private    | Coins, season pass progress, unlocks (sync keyed by Poki user id). |
| `sb:ugc:draft:<id>`       | Private    | Work-in-progress custom courses/levels.                            |
| `sb:ugc:pub:<id>`         | Public     | Published user-generated content, browsable/playable by anyone.    |

Leaderboard score entries are POSTed **without retaining the per-entry
secret** — they are effectively immutable once published, matching Poki's
recommendation for high-score tables (prevents casual tampering from the
browser console). Private records (settings/loadout/progress/drafts)
persist the returned secret in localStorage scoped by Poki user id, so
subsequent writes from the same device can update or delete the entry.

---

## Data shapes

### Score entry (`sb:score:<metric>`)

`values` (sortable / queryable):

| Field    | Type   | Notes                                              |
|----------|--------|----------------------------------------------------|
| `name`   | string | Pilot name, truncated to 14 chars.                |
| `value`  | number | Primary metric value (sorted descending).          |
| `distance` | number | Meters flown (denormalised for multi-metric rows).|
| `device` | string | First 12 chars of the local device id (for "you" detection). |
| `mode`   | string | `"solo"` / `"pvp"` / etc.                          |
| `date`   | string | YYYY-MM-DD bucket for daily rollups.               |
| `build`  | string | `VITE_BUILD_ID` — lets the client ignore stale physics entries. |

`data`:

```json
{ "skin": "sunbird", "altitude": 412, "perfects": 7, "coins": 23, "seed": "ab12" }
```

### Ghosts (`sb:ghost:share:*`, `sb:ghost:feat:<metric>`)

`values`: `{ metric, name, value, build }`
`data`: `{ replayB64, distance, altitude, perfects, coins }`

The `replayB64` field carries the compressed base64 ghost trace (written by
`src/game/Ghost.ts`). Keep total entry size **under ~100 KB** — AUDS docs
recommend it for latency, and larger entries risk hitting the per-request
payload limit. Long traces should be downsampled before upload.

### Private singletons (`sb:settings:v1`, `sb:loadout:v1`, `sb:progress:v1`)

One record per Poki user; upserted via `PokiAuds.putSingleton()` which
caches the AUDS id in localStorage under `auds-singleton:<uid>:<key>` so
subsequent sessions know which entry to PATCH.

---

## Adding new AUDS-backed features

1. Add a new key prefix constant to `AUDSPREFIX` in `src/sdk/auds.ts`.
2. For **public** data (listable, world-readable), use `submitScore()` as
   the reference implementation: POST, discard the secret, sort via
   `?sort=-<field>&limit=N&includedata`.
3. For **private per-user** data, use `putSingleton(key, values, data, {
   userId })` — it creates on first write and updates thereafter,
   remembering the secret automatically. Pass `userId` from
   `PokiSDK.user.getId()` when signed in so secrets don't leak between
   accounts sharing a device.
4. For **user-editable content with multiple entries per user** (drafts,
   UGC), store entry ids in a local index and call `create()` /
   `update()` / `delete()` explicitly.
5. When reading on boot: attempt an AUDS fetch first; fall back to the
   local mirror; always write the local mirror after a successful AUDS
   fetch so offline play keeps working.
6. Keep entries small. AUDS is not a binary CDN — ship replays as
   compressed base64, levels as compact JSON; host large assets via the
   build bundle or Poki's own CDN.

See `src/sdk/auds.ts` JSDoc for the full surface (`create`, `fetchById`,
`list`, `update`, `delete`, `putSingleton`, `submitScore`, `fetchTop`,
`_increment` via raw POST to `<key>/<id>/_increment`).

---

## Authentication (Poki User Accounts)

When the player signs in via the Poki SDK (Poki User Accounts), Sunbird
automatically attaches `Authorization: Bearer <JWT>` to mutating AUDS
calls. The JWT is obtained via `PokiSDK.user.getToken()` (1-minute TTL,
refreshed on demand). This lets AUDS:

* Bind private records (`settings`, `loadout`, `progress`, `ugc:draft:*`)
  to the Poki user id instead of just the device.
* Let signed-in users read back their own data across devices.
* (Future) support server-side moderation calls authenticated by the
  player's JWT.

If the user is not signed in, writes still work anonymously — the secret
is stored device-local only, which means uninstalling/clearing site data
loses access to private records. Public features (leaderboards, featured
ghosts, published UGC) never require sign-in.

To surface a sign-in prompt in-game: call `PokiSDK.user.showSignIn()`
from a user-initiated event (e.g. the "Enable cloud sync" button in
Settings → Account). The token resolver in `createAudsIfConfigured()`
will pick up the signed-in state automatically on the next call.

---

## Privacy & moderation notes

* Don't put free-text fields in public entries without client-side
  length/character filtering and profanity checks before POST. For
  pilot names we already re-use the same allowlist as the multiplayer
  name prompt.
* AUDS deletions are permanent when the client holds the secret; keep
  per-user secret storage keyed by Poki user id to prevent cross-user
  deletion on shared devices.
* For GDPR/CCNA delete requests, iterate the user's known singleton +
  UGC draft ids and call `PokiAuds.delete()` for each; also call
  `PokiSDK.user.requestDataDeletion()` to let Poki purge their own
  account data.
* Because public score entries are immutable-by-design (secret dropped),
  cheater entries must be cleaned up via a server-side moderation token
  (or AUDS dashboard) rather than from the client.

---

## Testing locally without Poki

AUDS rejects unknown game ids from non-Poki origins with CORS/403, so
local typecheck/tests use a **null client** by default (3rd tier —
localStorage). To exercise the AUDS code path end-to-end:

1. Publish a draft build to Poki and test inside the Poki preview iframe,
   or
2. Point the game at a local AUDS-compatible mock by setting
   `VITE_POKI_AUDS_BASE_URL` (future extension — the constant is at the
   top of `src/sdk/auds.ts` if you need it for QA), or
3. Run `pnpm test` — the existing storage/leaderboard tests include a
   fake `PokiAuds` implementation via dependency injection, which covers
   the fan-out and fallback behaviour without hitting the network.

---

## Relevant files

| File                          | Purpose                                                   |
|-------------------------------|-----------------------------------------------------------|
| `src/sdk/auds.ts`             | AUDS client (class `PokiAuds`), key prefixes, factory.    |
| `src/game/Leaderboard.ts`     | Three-tier fetch/submit; surfaces `leaderboardBackend()`. |
| `src/sdk/poki.ts`             | Poki SDK loader, user account helpers.                    |
| `LEADERBOARD_API.md`          | HTTP (Vercel) backend reference.                          |
| `STORAGE_ARCHITECTURE.md`     | Storage facade + cloud-sync design (this doc extends it). |
| `vite.config.ts`              | Build flags (`VITE_PORTAL_TARGET`, `VITE_POKI_GAME_ID`).  |
