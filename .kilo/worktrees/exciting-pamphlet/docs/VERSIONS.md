# VERSIONS — every version Sunbird speaks, and what breaks when two disagree

Last audited: 2026-09-24 (all identifiers below verified against source, not memory).

Sunbird is one game in **four editions** (`none`/`poki`/`crazy`/`generic`) talking to
**two trees** (`src/`, `server/src/`) whose test suites never import each other. It
therefore has more than one "version", and they answer different questions: which
*release*, which *build*, which *save format*, which *wire protocol*, which *replay
format*, which *HTTP namespace*, which *edition*.

They used to live in five unrelated files, one of them recomputed from `Date.now()` on
every build — so the game appeared to change when nothing had, and nothing appeared to
change when it did. This doc is the inventory; the enforceable half is
[`src/game/__tests__/version-lockstep.test.ts`](../src/game/__tests__/version-lockstep.test.ts),
which fails the build when any two of these drift.

## Inventory

| Identifier | Value now | Owner (source of truth) | Must agree with | If it drifts |
| --- | --- | --- | --- | --- |
| `APP_VERSION` (release semver) | `1.1.0` | [`package.json`](../package.json) `"version"` | Vite define `VITE_APP_VERSION`; `BUILD_ID`; generated `docs/poki/CSP_REQUEST.md` ("Sunbird 1.1.0") | Support reports and Poki's CSP request name a build that does not exist |
| `GIT_SHA` | commit, 8 chars (`dev` without git) | `vite.config.ts` (`VERCEL_GIT_COMMIT_SHA` → `SUNBIRD_BUILD_SHA` → `git rev-parse`) | — | A zip or a crash cannot be tied back to code |
| `BUILD_ID` | `<semver>-<portal>-<sha8>` | `vite.config.ts` | [`src/game/version.ts`](../src/game/version.ts); AUDS `build` column; server `SUNBIRD_CLIENT_BUILD` pin | Leaderboard rows are unattributable; a build pin rejects every submission |
| `SAVE_SCHEMA` | `2` | `SAVE_KEY = "sunbird.save.v2"` in [`src/game/constants.ts`](../src/game/constants.ts) | `SAVE_KEY_V1` (migration source); `CloudSave.version` rows server-side | Players lose progress, or a v1 save is read as v2 |
| `PROTOCOL_VERSION` / `PROTOCOL_MIN_VERSION` | `1` / `1` | [`src/game/protocol/v1.ts`](../src/game/protocol/v1.ts) | `PROTO_VERSION` in `server/src/realtime/gateways.ts` | **Every room breaks at once**: the gateway answers `unsupportedVersion` to any frame it does not recognise |
| `REPLAY_VERSION` | `2` | [`src/game/version.ts`](../src/game/version.ts) (client anchor) | `server/src/ghosts/GhostService.ts` — stamps `{ v: 2, … }` and `410`s anything else | Rival ghosts silently expire; async PvP empties out |
| HTTP namespace | root + `/mp` (see V-4) | `server/src/http/{api,legacy}.ts`; client paths via [`src/game/apiBase.ts`](../src/game/apiBase.ts) | `VITE_LEADERBOARD_URL` (must include `/mp` in prod) | `404`s that every caller swallows — the backend looks "offline" |
| `PORTAL_TARGET` / editions | `none`, `poki`, `crazy`, `crazygames` | `vite.config.ts` `VALID_PORTALS` | `src/game/edition.ts` + `edition.{poki,crazy,generic}.ts` | A portal build ships direct-build behaviour (IAP copy, free-text names, fake ad breaks) |
| i18n pack format | positional arrays | `src/locales/packs/*.json` aligned to `pack-keys.json` | `scripts/gen-i18n-packs.mjs`; `loadPack` refuses misalignment | A locale shows the wrong string for every key after the first insertion |
| Poki rule set | 131 rules (`REQ-*`, `TOOL-*`, `EA-*`, `THB-*`) | [`docs/poki/requirements.json`](./poki/requirements.json) | generated `docs/poki/COMPLIANCE.md`; `pnpm poki:preflight` | Compliance claims stop describing the build |
| UI snapshot `version` | runtime counter | `Game.ts` `uiVersion` | nothing — **not a release version** | (Documented so nobody mistakes it for one: it increments per HUD mutation to throttle repaints) |
| PWA cache | `sunbird-shell-*` prefix, unversioned | `public/sw.js` (retirement shim) + `src/boot.ts` | — | Nothing: the worker deletes old caches and unregisters itself; it reads no build id |
| `server/social` package | `1.0.0` | `server/social/package.json` | nothing (legacy standalone service) | Cosmetic only |

## Bump rules

* **Release** — bump `package.json` `"version"` (minor per Poki upload or feature
  batch, patch for fixes), then `pnpm gen-csp` so the generated CSP request names the
  right build. `BUILD_ID` follows automatically; nothing else is hand-edited.
* **Save schema** — bump the key (`sunbird.save.v3`), keep the previous constant
  (`SAVE_KEY_V2`) addressable, add a migration, and bump `SAVE_SCHEMA`'s expectation in
  the lockstep test. Never overwrite an older key in place.
* **Wire protocol** — change `PROTOCOL_VERSION` *and* `PROTO_VERSION` in
  `server/src/realtime/gateways.ts` in the same commit, and deploy the server first:
  the gateway's check is strict equality, so there is no window where both work.
  Supporting a *range* means changing that check, the test and this doc together.
* **Replay format** — bump `REPLAY_VERSION` and both server literals (the stamp in
  `GhostService.publish`, the `410` guard on read) together, and expect old ghosts to
  expire: that is deliberate, they are 1-year-TTL rival data, not saves.
* **Edition flags** — add the export to **all four** `edition*.ts` modules in the same
  commit. The lockstep test compares their export sets, so a partial add fails.

## Audit findings (2026-09-24)

**V-1 — the build id was `Date.now()`, and dead.** `vite.config.ts` carried
`const BUILD_ID = Date.now().toString(36)` under the comment "stamp the service worker
cache key per build". The worker became a retirement shim that reads nothing, and no
module ever imported the define: a non-deterministic value nobody consumed. Every
rebuild of the same commit produced a "new version", so zips were not reproducible and
`SUNBIRD_CLIENT_BUILD` could never be satisfied. **Fixed:** the id is now
`<semver>-<portal>-<sha8>`, typed in `src/vite-env.d.ts`, exported from
`src/game/version.ts`, printed once per boot (`console.debug(buildStamp())`) and
attached to every leaderboard row.

**V-2 — the wire protocol was two literals in two trees.** Client `PROTOCOL_VERSION`,
server `PROTO_VERSION`, no test in either suite comparing them, and a gateway that
rejects mismatched frames. **Guarded** (lockstep test); no code change needed today.

**V-3 — the replay version existed only server-side.** `GhostService` stamps `{ v: 2 }`
and `410`s anything else; the client had no anchor at all. **Fixed:** `REPLAY_VERSION`
in `version.ts`, pinned against both server literals.

**V-4 — one env var, two required prefixes, three copies of the derivation.**
`VITE_LEADERBOARD_URL` fed `GhostNet.ts`, `Payments.ts` and `Leaderboard.ts`, each
hand-rolling the fallback; `Leaderboard.ts` had drifted to `import.meta.env.DEV ? "" :
""` (two identical branches) which read like a bug but was accidentally correct — the
board routes live at the server **root** (`/board`, `/score`) while ghosts and
entitlements live under **`/mp`** (`/mp/ghost`, `/mp/entitlements`). **Fixed:** one
helper, `backendBase(devPrefix)`, with the contract written down and a guard that no
other module reads the env var. **Deferred (deliberately):** the shipped client still
speaks the retired `/mp` namespace for ghosts, while `/mp/v1/ghosts` (+ `/rival`,
`/featured`) exists server-side. Migrating is not a drive-by — the `/mp/v1` surface
requires a session actor (`/mp/v1/identity/guest` → token → `authorization` header),
which the ghost path has never had, and it cannot be validated here without a live
server. Tracked as the next namespace task; until then both surfaces stay up.

**V-5 — leaderboard rows were unattributable.** AUDS `submitScore` has carried a
`build` field since it was written and the client never passed it, so every row stored
`build: ""`. After any physics or scoring change there was no way to separate
old-format scores from new ones, or to roll a board over per release. **Fixed:**
`build: BUILD_ID` (semver + edition + sha — no device id, no PII).

**V-6 — editions could drift silently.** Four hand-maintained `edition*.ts` modules,
kept in sync by a comment asking people to. **Guarded:** the lockstep test compares
their runtime export sets, and lists one edition module per accepted portal target.

**V-7 — the semver never moved.** `1.0.0` since the first commit, through progression
rework, three music passes, positional i18n packs, funnel analytics, full screen-title
localisation and the ad-honesty change. **Fixed:** `1.1.0`, with the bump rule above so
the number means something next time.
