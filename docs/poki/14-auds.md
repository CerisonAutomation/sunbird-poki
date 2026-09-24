# AUDS: Arbitrary User Data Store — extracted reference

Source: <https://developers.poki.com/guide/auds> · endpoint `https://auds.poki.io/v0/<game-id>/userdata/<key>`

A prototype backend for user-generated content: store data, get a short code back,
let players share it. **Games must be live on Poki to use it.**

## Endpoints

| ID | Kind | Rule |
|---|---|---|
| `AU-01` | informational | `POST …/<freeform-key>` creates an entry from `{ data, values }` and returns `{ id, secret, meta }`. `data` is freeform; `values` accepts only `string \| number \| boolean` pairs. |
| `AU-02` | requirement | The **secret is returned once** — store it if the entry will ever be updated or deleted; it can never be fetched again. |
| `AU-03` | requirement | `GET …/<key>/<id>` fetches one entry by id (public, no secret). |
| `AU-04` | requirement | `GET …/<key>` lists entries with `q=key:value` (or a URL-encoded JSON query), `sort=key` / `sort=-key`, `includedata`, and `limit=n` (1–100). |
| `AU-05` | requirement | `POST …/<key>/<id>` with `{ secret }` **updates only the keys provided**; omitted fields are untouched. |
| `AU-06` | requirement | `DELETE …/<key>/<id>` with `{ secret }` removes the entry. |
| `AU-07` | requirement | `POST …/<key>/<id>/_increment?key=<value-key>` bumps a numeric counter with **no secret** (public counters). The key must contain `count`, the existing value must be a number, only `updated_at` changes. |
| `AU-08` | informational | Entries expire after a year (`expires_in` 31 536 000 s); `meta.revision` increments on update. |
| `AU-09` | requirement | Everything a player publishes is **public**: anyone holding the id or code can read it, and payloads come back off the network rather than from a trusted store. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `AU-01`, `AU-02` | `src/sdk/auds.ts` implements create/read/list/update/delete/increment. Secrets are written to `localStorage` under `auds-secret:` (see `UA-*` for why that key is local-only), and public score entries deliberately **retain no secret** — a score is immutable once posted. |
| `AU-03`, `AU-04` | Boards query the public list with `sort=-value` and `limit`, then render the rows; ghost flights and shared runs are fetched by id/code. |
| `AU-05`, `AU-06` | Per-user settings/loadout sync writes through the stored secret; the same secret is what allows a player's own entries to be replaced. |
| `AU-07` | Shared-run codes use the public counter: `POST …/_increment?key=play-count` counts how often a code was loaded, with no secret in the client. |
| `AU-08` | Entry age is treated as real: the board fallback keeps working when a share code has expired instead of showing a broken card. |
| `AU-09` | Every payload arriving from AUDS is validated, type-checked, clamped and truncated before it reaches the HUD (`Leaderboard`, `SharedRun`, `GhostNet`), because it is public UGC — stranger-authored text and numbers — not internal state. |
| — | AUDS is Poki-gated by construction: `createAudsIfConfigured()` returns `null` unless `VITE_POKI_GAME_ID` is set, so no other edition can call `auds.poki.io` (enforced by `pnpm isolation:check`, `TOOL-08`). |
