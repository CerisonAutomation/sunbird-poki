> **2026-09-15 security update:** the shipped PGlite service now requires
> `Authorization: Bearer <64 lowercase hex characters>` on every non-health
> request. This browser-local capability is separate from public race IDs.
> GET requests include `device`; chat also verifies club membership. Friend
> saving is now one-way. Existing unauthenticated profiles require trusted
> administrator migration, not automatic claiming by device ID. Frontend and
> backend must be deployed together. See
> [deployment and migration limits](docs/audits/CONSOLIDATION_AUDIT.md).
> The older examples below must be used with these authentication requirements.

# Sunbird social server (friends · clubs · chat)

A tiny REST service backed by **PGlite** (embedded Postgres, zero external
dependencies) living in `server/social/`. The client (`src/game/Squad.ts` +
the Squad screen) degrades to a clearly-labelled offline state when it is not
configured — no fake friends, ever. The client has no offline fallback
that invents a pilot name: when the service is unreachable the Pilot Lookup
panel says so and falls back to the local, real record of pilots this device
actually raced with (`src/game/pilots.ts`).

## Run

```sh
cd server/social
npm install
node social-server.mjs           # listens on 0.0.0.0:8788
# PORT=9000 PGLITE_DIR=/var/lib/sunbird-social node social-server.mjs
```

Point the game at it:

```sh
# .env
VITE_SOCIAL_URL=https://your-social-host.example
```

## Model

- Players self-register with their `deviceId`; the public **friend code** is
  derived exactly like the referral code in `SaveData.ts` (`SUN-` + last 6
  alphanumerics, uppercased), so codes match what players already share.
- Friends are mutual follows keyed by friend code.
- Clubs cap at 30 members; a player belongs to at most one club.
- Chat is club-scoped, 200 chars per message, paged 50 at a time via
  `?after=<id>`; angle brackets are stripped server-side.

## Routes

| method + path | body / query | returns |
| --- | --- | --- |
| `POST /register` | `{deviceId, name}` | `{code}` |
| `GET /profile` | `?device=` | `{name, code, friends[], clubId}` — each friend row carries `code`, `online`, `bestDistance`, `lastSeen` when the service knows them |
| `GET /players/:code` | `?device=` | `{pilot: {name, code, online, countryCode, club, bestDistance, rank, friend, outgoing, incoming, self}}` — **the Pilot Lookup panel's lookup**. Exact codes only; unknown code → `404` (`{error:"No pilot with that code"}`). Presence honours the pilot's `showPresence` privacy flag |
| `POST /friends/add` | `{deviceId, code}` | `{status, friend}` where `status` is `"requested"` (a real request was sent), `"accepted"` (they had already asked you), or `"friends"` (already wingmen). It never implies a friendship that does not exist |
| `GET /friends/requests` | `?device=` | `{incoming[], outgoing[]}` — real pending requests, `{requestId, name, code}` |
| `POST /friends/respond` | `{deviceId, requestId, accept}` | `{ok, status}` |
| `POST /friends/cancel` | `{deviceId, requestId}` | `{ok, status}` |
| `POST /friends/remove` | `{deviceId, code}` | `{ok}` |
| `GET /clubs` | `?device=` | `{clubs[], mine}` |
| `POST /clubs/create` | `{deviceId, name, motto, playerName}` | `{club}` |
| `POST /clubs/join` | `{deviceId, clubId, playerName}` | `{ok}` |
| `POST /clubs/leave` | `{deviceId}` | `{ok}` |
| `GET /chat` | `?club=&after=` | `{messages[]}` |
| `POST /chat` | `{deviceId, text}` | `{message}` |
| `GET /health` | — | `{ok, players, clubs, messages}` |

All routes are CORS-open (`*`) and JSON-only; errors are
`{error: string}` with a 4xx status.
