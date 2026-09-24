# User Accounts & cloud gamesaves — extracted reference

Source: <https://developers.poki.com/guide/accounts>

## Methods

| ID | Kind | Rule |
|---|---|---|
| `UA-01` | requirement | `getUser()` is called **after the game loads** and handles every state: signed in (`{ username, avatarUrl }`), signed out (`null`), or just reloaded after an auth change. It throws only when the feature is unavailable or the player opted out — the game must catch and continue. |
| `UA-02` | requirement | `login()` is called **only in response to a user interaction that needs an account** — never automatically on load. It may trigger a full page refresh on success, and rejects if the panel is closed or times out (45 s). |
| `UA-03` | informational | In Inspector debug mode `getUser()` returns a static `TestUser` with a placeholder avatar; the game must render that as an ordinary account. |
| `UA-04` | requirement | `getToken()` returns a short-lived JWT (**~1 minute**). It must not be stored or reused; it is meant to be verified server-side, immediately, against `user-vault.poki.com/auth/verify-token` with the team API key, which returns the persistent `user_id`. |
| `UA-05` | informational | The token verification endpoint needs an `X-Poki-Team-Api-Key` from the account manager, and returns an id that is immutable and unique **per game**. |

## Cloud gamesaves

| ID | Kind | Rule |
|---|---|---|
| `UA-06` | informational | When a player is signed in, the SDK transparently loads their save from the cloud before the game starts and batches later `localStorage`/`IndexedDB` changes back up. No SDK calls are needed to enable it. |
| `UA-07` | requirement | Anything that must not sync is prefixed `poki_ignore` — for `localStorage` keys, IndexedDB stores **and** rows (caches, recordings, diagnostics, per-device state). |
| `UA-08` | requirement | The save payload must stay **under 1 MB gzipped**; if a player's save exceeds it, cloud sync is disabled for that player and progress silently stops syncing. Save design must keep well clear of the cap. |
| `UA-09` | requirement | Because sync is transparent, the game's own state must be small, correctly namespaced, and safe to receive from another device (no device-specific ids or half-written blobs in the synced set). |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `UA-01` | `Game.adoptPortalIdentity()` calls `platform.getIdentity()` (Poki: `getUser()`) after boot, greets the player by their Poki username, and treats the `null`/throwing case as “no account” — the generated call sign stays. |
| `UA-02` | `Game.signInToPortal()` is reached only from the Account screen's **Sign in** button (`data-action="portal-sign-in"`); nothing on the boot path calls `login()`. |
| `UA-03` | The Account screen renders whatever `getUser()` returns, so the Inspector's `TestUser` appears as a normal signed-in account. |
| `UA-04`, `UA-05` | The build ships no game backend that needs the token, so it is never requested, stored or transmitted — which is also why no team API key exists in the client. If a backend is added, the token must be verified server-side and used immediately. |
| `UA-07` | `src/game/Storage.ts` maps local-only keys through `physicalKey()` onto a `poki_ignore.` prefix on Poki: board caches, ghost flights, journal, squad caches, the AUDS secret store and the write canary. Reads fall through to legacy unprefixed keys so existing saves keep working. |
| `UA-08` | The synced set is bounded by design: the save is a small JSON blob of progress/settings, while everything large or device-specific is in the ignored set. `src/game/__tests__/storage.test.ts` pins the prefix mapping and the read-through migration. |
| `UA-09` | Player progress is plain, versioned JSON with a repair path for corrupt data; per-device identifiers (device id, ghost recordings, caches) live outside the synced set so a save arriving from another device cannot carry them in. |
