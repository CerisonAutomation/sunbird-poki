# SUNBIRD Rust Migration Plan

> **Status:** archived — migration plan written *before* the Rust workspace existed. Its central premise, "no Rust backend exists", is now false: `rust/` ships `sunbird-protocol` + `sunbird-server`, pinned by `pnpm isolation:check`. Kept as the design rationale for the split; do not read it as current state. See [`../../rust/README.md`](../../rust/README.md).

Status: architecture plan only. No Rust workspace or production backend exists in the repository at the time of this document.

## Current Repository Truth

| Area | Current implementation | Classification |
| --- | --- | --- |
| Browser runtime | TypeScript, Vite, React mount, Three.js game | Canonical browser client; keep |
| Realtime client | `src/game/Realtime.ts` | Candidate client transport; adapt to protocol v1 |
| Multiplayer presentation | `MassRace.ts`, `Racer.ts`, HUD | Keep; distinguish online pilots, local bots, and split-screen players |
| Backend | `server/sunbird-server.mjs` | Experimental protocol reference only |
| Rust backend | None | Canonical production target; blocked until implemented |
| Leaderboard | Client HTTP adapter plus local fallback | Local fallback stays; global path must move to Rust authority |
| Tournaments/rewards | Client-generated definitions, progress, and claims | Offline-only until Rust authority exists |
| Profiles/inventory | Versioned localStorage | Client cache/preferences only after server authority is introduced |
| Portal SDK | `src/sdk/platform.ts` | Browser-only; keep and validate in portal sandboxes |
| Direct payments | Stripe Payment Links plus local confirmation | Direct-build only; server webhook authority required before activation |

## Canonical MVP Shape

One Rust workspace and one deployable service binary are sufficient for the next release milestone.

```text
rust/
  Cargo.toml
  crates/
    sunbird-protocol/   # serde models, validation limits, protocol version
    sunbird-server/     # one Axum binary
      src/
        main.rs
        config.rs
        auth.rs
        rooms.rs
        realtime.rs
        results.rs
        leaderboard.rs
        tournaments.rs
        persistence.rs
        metrics.rs
  migrations/
```

The server binary owns HTTP, WebSocket rooms, matchmaking, persisted results, leaderboards, tournament claims, health/readiness, metrics, and background expiry/reconciliation tasks. This is a modular monolith, not a microservice system.

## What Remains Browser-Only

- Three.js rendering, camera, particles, audio, HUD, input, and portal SDK adapters.
- Fixed-step local flight simulation for immediate feel and prediction.
- Solo, practice bots, and local split-screen modes.
- Local settings, accessibility preferences, cached profile presentation, and offline personal records.
- Cosmetic rendering and local previews.

The browser may predict movement but may not authoritatively decide an online start, finish order, leaderboard result, tournament result, entitlement, or reward claim.

## What Moves To Rust Immediately

1. Versioned protocol models and validation limits.
2. Public matchmaking and private room creation/join semantics.
3. Signed reconnect seat tokens with generation/session ownership.
4. Lobby roster, ready state, and server-time synchronized starts.
5. Monotonic input/state sequence validation and plausible movement envelopes.
6. Server-derived finish crossing and finish order.
7. Authoritative race-result records.
8. Leaderboard reads derived only from persisted server race results.
9. Tournament definitions, participation, scoring, and idempotent cosmetic reward claims.
10. Configuration validation, origin enforcement, rate limits, structured logs, graceful shutdown, health/readiness, and Prometheus metrics.
11. Postgres migrations and persistence access through SQLx.

## Deferred Architecture

| Item | Decision | Trigger to revisit |
| --- | --- | --- |
| Redis room coordination | Deferred | Multiple service instances are required and measured single-instance limits are reached |
| WebTransport/QUIC | Deferred | WebSocket latency/loss measurements show a user-visible problem and portal support is confirmed |
| Binary protocol | Deferred | Captured JSON snapshot bandwidth or CPU exceeds the release budget |
| Microservices | Rejected for MVP | Independent scaling/ownership needs are proven |
| Full account system | Deferred | Publisher/product requirements need cross-device identity beyond signed guest sessions |
| Server-reimplemented full terrain physics | Deferred | Movement-envelope validation is insufficient against cheating or competitive stakes require deterministic replay |
| Real-money prizes | Prohibited | Not a future path |

## Protocol Ownership

Rust owns the protocol source of truth in `sunbird-protocol`.

MVP synchronization strategy:

1. Rust structs use `serde` with explicit `version: 1` and tagged enums.
2. A checked-in TypeScript protocol file mirrors those models and includes runtime validators for untrusted server data.
3. Rust fixture tests serialize every server/client message variant into `protocol/fixtures/*.json`.
4. Frontend tests parse all Rust-generated fixtures.
5. CI fails if fixtures change without the synchronized TypeScript update.

Code generation can replace this fixture contract later, but adding a generator is not required for the first Rust milestone.

## Protocol Boundaries

| Direction | Message class | Authority |
| --- | --- | --- |
| Client → server | Join intent, ready intent, sequenced input/state sample, heartbeat, emote intent | Untrusted intent only |
| Server → client | Seat grant, signed reconnect token, roster, start timestamp, snapshots, finish/result, typed errors | Authoritative session/race state |
| HTTP client → server | Leaderboard query, tournament query, idempotent claim request | Query or untrusted request |
| Server/database → client | Persisted leaderboard rows, tournament state, inventory grants | Authoritative competitive/reward state |

Required envelope fields:

- `version`
- `message_id` where idempotency matters
- `room_id`
- `seat_id`
- monotonic `sequence`
- server timestamp where ordering matters
- typed error code with optional retry-after duration

Maximum JSON WebSocket payload for MVP: 8 KiB. Larger frames are rejected before deserialization.

## Room Authority Model

- Capacity: 40 active seats; spectators are rejected for MVP.
- Room state: waiting → countdown → racing → complete → expired.
- Public matchmaking selects a waiting room with compatible build/protocol/seed, otherwise creates one.
- Private codes address a server-owned room. A code does not prove seat ownership.
- Ready policy: private rooms start when the host requests start and minimum-ready policy passes; public rooms start at capacity or after a bounded matchmaking timer.
- Server publishes `start_at` in its own monotonic time domain and rejects movement before it.
- Each accepted state/input message must increment `sequence` and satisfy elapsed-time movement/acceleration envelopes.
- Finish is derived when an accepted server state crosses the configured finish distance after `start_at`.
- Finish place and elapsed time are generated by the server and persisted transactionally.

This MVP uses authoritative validation of client-predicted state, not a full server copy of Three.js terrain physics. The limitation must remain documented: plausible-envelope validation reduces basic cheating but is not deterministic simulation authority.

## Reconnect Seat Ownership

Use an HMAC-SHA256 token signed by the Rust service. Token claims:

- protocol version
- player id
- room id
- seat id
- session generation
- issued-at and expiry
- reconnect nonce

Rules:

- Tokens are opaque to gameplay code and never accepted after expiry.
- A successful reconnect increments the seat generation and rotates the token.
- Socket close handlers carry the generation they opened with; an old generation cannot remove a newer connection.
- A disconnected seat remains reserved for a short configurable grace period, then becomes vacant.
- Signing secret must be at least 32 random bytes and is required in staging/production mode.

## Persistence Decision

### Choice: SQLx + Postgres

| Option | Advantages | Costs | Decision |
| --- | --- | --- | --- |
| SQLx | Explicit SQL, compile-time query checking, transparent transactions, minimal abstraction | Schema/queries are written manually | **Selected** |
| SeaORM | Faster CRUD scaffolding and entity ergonomics | More generated/ORM surface than this small schema needs | Not selected |

SQLx is preferred because the MVP has a small integrity-sensitive schema and benefits from explicit transaction boundaries for results and reward claims.

### Minimum schema

```text
players
  id uuid primary key
  guest_key_hash bytea unique
  display_name text
  created_at timestamptz
  updated_at timestamptz

race_results
  id uuid primary key
  room_id uuid
  player_id uuid references players
  mode text
  seed text
  started_at timestamptz
  finished_at timestamptz
  elapsed_ms bigint
  place integer
  distance integer
  altitude integer
  perfects integer
  coins integer
  validation_status text
  unique(room_id, player_id)

tournaments
  id uuid primary key
  slug text unique
  mode text
  metric text
  starts_at timestamptz
  ends_at timestamptz
  definition jsonb

tournament_results
  tournament_id uuid references tournaments
  player_id uuid references players
  best_value bigint
  race_result_id uuid references race_results
  updated_at timestamptz
  primary key(tournament_id, player_id)

inventory_grants
  id uuid primary key
  player_id uuid references players
  item_id text
  source_type text
  source_id uuid
  idempotency_key text unique
  granted_at timestamptz
```

Global scores are materialized from valid `race_results`; clients never POST arbitrary leaderboard values. Inventory is derived from grants; clients never grant their own competitive rewards.

## Redis Decision

Redis is not added for the MVP.

One Rust process owns all active rooms in memory. Postgres owns durable results and grants. This avoids distributed room ownership and split-brain complexity. If a measured capacity test requires multiple instances, the next design step is sticky room routing first; Redis fan-out is considered only after that evidence.

## Node Prototype Retirement

`server/sunbird-server.mjs` is classified as experimental and must not be included in the production image.

Migration sequence:

1. Freeze its useful behavior into `PROTOCOL_SPEC.md` and integration fixtures.
2. Bring the Rust service to protocol parity for join, roster, state broadcast, and typed errors.
3. Add Rust-only start, reconnect, finish, persistence, and operations semantics.
4. Run client integration tests against Rust.
5. Move the Node file under `archive/node-prototype/` or delete it.
6. CI rejects production references to `server/sunbird-server.mjs` and undeclared Node backend dependencies.

There is no migration need to run Node and Rust as parallel production backends.

## Environment Strategy

Required staging/production configuration:

- `SUNBIRD_ENV=development|staging|production`
- `SUNBIRD_BIND_ADDR`
- `SUNBIRD_PUBLIC_ORIGINS` (comma-separated, non-wildcard outside development)
- `SUNBIRD_DATABASE_URL`
- `SUNBIRD_RECONNECT_HMAC_SECRET`
- `SUNBIRD_ROOM_CAPACITY=40`
- `SUNBIRD_RECONNECT_GRACE_SECONDS`
- `SUNBIRD_MATCHMAKING_TIMEOUT_SECONDS`
- `RUST_LOG`

Startup fails closed when production requirements are missing or invalid.

## Operational Baseline

- `/health`: process event loop is alive; no dependency guarantee.
- `/ready`: migrations complete, Postgres ping succeeds, service accepting joins.
- `/metrics`: Prometheus text endpoint with connection count, room count, joins, reconnects, rejects, invalid messages, rate-limit rejects, tick duration, snapshot bytes, results persisted, and persistence failures.
- JSON tracing logs with request/session/room ids; no reconnect tokens or secrets logged.
- Graceful shutdown stops matchmaking, broadcasts server shutdown, allows a bounded drain, flushes persistence, then exits.
- Origin allowlist applies to HTTP CORS and WebSocket upgrades.
- Tower layers bound HTTP body size, request concurrency, timeouts, and request rates; WebSocket logic separately bounds payload, message frequency, and invalid-message budget.

## Client Migration

Preserve `Game.ts`, `MassRace.ts`, and game feel. Change only online state ownership:

1. Replace the ad hoc `ServerMsg` union in `Realtime.ts` with protocol-v1 types and runtime parsing.
2. Join using guest session + optional signed reconnect token.
3. Expose waiting, ready, countdown, racing, reconnecting, completed, and rejected states.
4. Gate online fixed-step race progression until authoritative `start_at` is reached.
5. Send monotonic sequenced samples/intents; do not send a trusted finish.
6. Consume server finish/result and persisted reward responses.
7. Keep local squadron pilots when backend is absent; label the mode practice/offline.
8. Only show “Global” and server tournaments when the API readiness check passes.

No camera, terrain, launch timing, physics, or input constants are changed by this migration.

## Rollback Strategy

If Rust is incomplete or unhealthy:

1. Build the client with `VITE_MULTIPLAYER_URL=` and `VITE_LEADERBOARD_URL=`.
2. Hide/disable online matchmaking, global leaderboard, server tournaments, and competitive reward claims.
3. Preserve solo, local split-screen, and explicitly labeled practice bots.
4. Do **not** route production traffic back to the untrusted Node prototype.
5. Revert only the backend endpoint environment variables; no client save migration is required because authoritative grants remain additive and local settings remain local.

Blast radius: online competitive features only. Core game feel and offline play remain available.

## Phased Implementation Plan

| Phase | Deliverable | Verification gate |
| --- | --- | --- |
| 0 | Truth audit and this migration plan | File inventory and local frontend build |
| 1 | Rust workspace skeleton, config, protocol models | `cargo fmt --check`, Clippy `-D warnings`, tests, build |
| 2 | Protocol spec, Rust fixtures, synchronized TypeScript validators | Rust fixture tests + frontend protocol tests |
| 3 | In-memory authoritative rooms, signed reconnect, enforced start/finish | Rust unit/integration tests including old-socket reconnect race |
| 4 | SQLx migrations and authoritative result/leaderboard/tournament/reward flows | Migration test against local Postgres; idempotency tests |
| 5 | Origin/rate/payload controls, health/readiness/metrics/logging/shutdown | HTTP/WS integration tests and metrics assertions |
| 6 | TypeScript client integration and honest offline degradation | Browser smoke tests against Rust and unavailable-backend cases |
| 7 | Lockfiles, scripts, CI, Docker, Compose, synthetic 40-user load harness | CI-equivalent local run, Docker build, captured load report |
| 8 | Release and portal evidence documents | Checklist review; no unverified pass labels |
| 9 | Staging deployment | Explicit external action; not performed automatically |

## Top Five Production Blockers

1. Rust canonical service does not exist.
2. Online race truth and finish order are client-controlled.
3. Reconnect seats have no trusted ownership or generation protection.
4. Leaderboard, tournament score, reward, and payment entitlement paths are not server-authoritative.
5. Reproducible builds and operations are absent: no lockfile, tests, CI, Docker, Postgres migrations, metrics, origin controls, or rate limits.

## Rollout Stop Point

This plan stops before production deployment, DNS changes, real payment activation, and portal submissions. A later deploy step must show the exact command, affected service/environment, database migration blast radius, and rollback command before execution.