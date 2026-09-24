# Architecture Review — "TMULTIWORLDS" proposal vs. what Sunbird actually is

> **Status:** archived — review of an external "tmultiworlds" Bevy/replicon proposal against this repository (2026-09). The proposal was not adopted; the multiplayer architecture that shipped is `rust/` + [`LEADERBOARD_API.md`](../../LEADERBOARD_API.md).

A long design pitch for a **new** project (`tmultiworlds/`: Bevy + bevy_replicon
+ renet, 3D survival, 40 players, portals, fog-of-war) was put next to this
repository with the instruction *"compare with our set up and upgrade if
better"*.

This file is the result. It records what was adopted, what was rejected, and —
importantly — **what the pitch got right about us that we had not noticed**.

Everything below was verified in this repository on 2026-09-12. Claims are
paired with the command or file that shows them.

---

## 0. The headline

**The proposal is a different game on a different engine.** Sunbird is a
shipped 2D side-scrolling glider: Three.js r186 + React 19 + Vite, with a Rust
axum WebSocket room server, 60+ skins, portal builds for Poki/CrazyGames,
Stripe, a PWA shell, and a green test suite. Adopting the proposal wholesale
means deleting all of it and starting over. That is not an upgrade.

**But the proposal's central thesis landed a real hit.** Its one non-negotiable
rule is:

> *"Every rule you write in `shared/src/rules.rs` runs identically on the
> server, the client, and 40 bots. If it's not in shared, a human has two
> private copies of the truth."*

We have exactly that failure, live, on `main` — in the one place our own docs
claimed we didn't. See §2.

So: **reject the engine, adopt the discipline.** Four of its ideas were
engine-agnostic and worth porting; four were genre-wrong or unverifiable and
were dropped.

---

## 1. What we are, measured

| | |
| --- | --- |
| Client | TypeScript 5.9 / React 19 / Three.js r186 / Vite 7 (`package.json`) |
| Server | Rust axum, two WebSocket routes: `/v1/ws` (protocol v1) and `/ws` (legacy simple protocol the browser actually ships on) |
| Source | 32,790 lines across `src/`, `server/`, `api/`, `scripts/`, `rust/` |
| Baseline check | `npm run typecheck` clean; `npm test` → **183 tests / 26 files passed** |
| Load test on `main` | `scripts/mp-smoke.mjs` — **2** clients, and **no CI job runs it** (`.github/workflows/ci.yml` and `rust.yml` were both checked) |

---

## 2. The hit: our "single source of truth" was already false

`rust/README.md` states:

> `crates/sunbird-protocol` | Wire protocol v1 — … **Source of truth mirrored by
> `src/game/protocol/v1.ts`**.

That was a comment, not a check. And the mirror had drifted:

```
$ grep -nE '^\s{4}(Hello|Welcome|RosterUpdate|Started|Snapshot|Error)' \
      rust/crates/sunbird-protocol/src/lib.rs
163:    Hello {
169:    Welcome {
175:    RosterUpdate { version: u32, room: RoomPublic },
177:    Started {
185:    Snapshot {          <-- exists in Rust
190:    Error { version: u32, error: ProtocolError },

$ grep -c 'snapshot' src/game/protocol/v1.ts
0                            <-- does not exist in TypeScript
```

**Consequence:** `ServerMessage::Snapshot` (with `ServerSnapshot` /
`SnapshotPilot`) could be emitted by the Rust server, and the browser's
`parseServerMessage` would fall through to
`throw new ProtocolError("unknown server message type snapshot")`. The
authoritative movement channel — the entire point of Phase 2+ — would have
failed on the client the first time it was used.

Nothing in CI would have caught it. There was no cross-language check of any
kind.

### Adopted (upgrade 1): a machine-checked contract

New: **`protocol/contract.json`** — one file declaring the protocol version,
every wire limit, every client and server variant with a canonical sample, the
error-code vocabulary, the legacy frame vocabulary, and the movement envelope.

Both implementations now assert against that same file:

| Side | Check |
| --- | --- |
| TypeScript | `src/game/__tests__/protocol-contract.test.ts` (24 tests) |
| Rust | `rust/crates/sunbird-protocol/tests/contract.rs` |

TypeScript types erase at runtime, so `v1.ts` now also exports runtime tables
(`SERVER_MESSAGE_TYPES`, `CLIENT_MESSAGE_TYPES`, `SERVER_ERROR_CODES`) — those
are what the suite compares against the contract.

**The drift is fixed**, not just detected: `Snapshot`, `ServerSnapshot` and
`SnapshotPilot` now exist in `src/game/protocol/v1.ts` with a real parser.

**Proof the gate bites** (mutation-tested, then reverted):

| Mutation injected into the contract | Result |
| --- | --- |
| Added a `portalHop` server variant the TS mirror lacks | **2 tests failed** |
| Widened `limits.maxNameChars` from 14 to 20 | **failed**: `expected 14 to be 20` |
| (reverted) | 24/24 pass |

### 2.1 The contract then caught a second, live bug — in Rust this time

Running the new Rust contract suite in CI produced:

```
serverMessages.hello failed to parse: JSON parse failed: missing field `max_json_payload_bytes`
```

`Limits` was the **only type in the entire protocol** without
`#[serde(rename_all = "camelCase")]` — `PilotPublic`, `RoomPublic`, `SeatGrant`,
`ServerSnapshot`, `SnapshotPilot`, `ClientMessage`, `ServerMessage` and
`ProtocolError` all have it. So `GET /v1/hello` emitted:

```json
{"limits":{"version":1,"max_json_payload_bytes":8192,"max_name_chars":14}}
```

while the browser requires camelCase (`src/game/protocol/v1.ts:227` calls
`requireNumber(data.limits.maxJsonPayloadBytes, ...)`) and its parser threw
`limits.maxJsonPayloadBytes is required as a number`. Nothing in the repo
expects the snake_case form, so the crate was the side that was wrong.

Fixed at the source, and pinned by `hello_limits_are_camel_case_on_the_wire`,
which asserts the wire keys and that the emitted frame round-trips.

That is two independent wire-incompatibility bugs — one in each direction — in a
protocol that a comment asserted could not drift. It is the strongest evidence
in this document that the check was worth more than the fixes.

---

## 3. Adopted: server authority over movement

`ROADMAP.md` on `main`:

> 🔴 Aspirational … rooms today are in-memory and **trust the client's position
> stream**.

That was accurate. In `rust/crates/sunbird-server/src/legacy.rs`, the shipped
transport stored whatever arrived and rebroadcast it to the whole room:

```rust
In::State { x, y, r, d } => {
    if let Some(p) = room.pilots.get_mut(id) {
        p.x = x; p.y = y; p.rot = r; p.distance = d;   // verbatim
```

No finiteness check, no bounds, no speed check. A modified browser could
teleport to the finish line, or send `1e300` and poison the interpolation
buffers of the other 39 pilots.

### Adopted (upgrade 2): `rust/crates/sunbird-server/src/validate.rs`

The proposal's *"clients send intents, never outcomes"* is now enforced on the
shipped path. Key design points:

- **The envelope is derived, not invented.** The hard ceiling is
  `MAX_SPEED_FEVER (128) × wingboost speedMult (1.5) + BOOST_EXTRA_SPEED (42) =
  234 u/s` — `src/game/Bird.ts:260` and `src/game/PowerUps.ts:79`. Every number
  in `validate.rs` is that plus headroom, and the derivation is recorded in the
  contract's `movement.derivation` block.
- **The check is time-aware.** A fixed per-frame cap would false-reject a
  stuttering connection. The allowance is `max_speed × elapsed × headroom`, with
  `elapsed` clamped at both ends — a floor so a fast sender is not
  over-penalised, a ceiling so a long reconnect gap cannot authorise an
  unlimited jump.
- **Rejection is soft.** A bad frame is dropped and counted; the seat is never
  dropped. A false positive costs one interpolated frame, never a player's
  race.
- **It also saves bandwidth.** `canonicalise()` rounds to wire precision. The
  client already rounds to 2dp (`Realtime.ts:426`); doing it server-side stops
  a hand-rolled client inflating every one of the 40 × 15 frames/sec with 17
  digits nobody renders.
- Claimed finish `time`/`distance` are bounded too. Finish **place** was
  already server-assigned by arrival order and still is.

Rejected frames are counted as `sunbird_legacy_state_rejected_total{reason=…}`
with labels `nonFinite` / `outOfBounds` / `distanceRegression` / `speedCap`, so
ops can tell a cheater from a buggy client.

7 unit tests in `validate.rs` + 6 end-to-end tests in `legacy.rs` (join → send
→ tick → assert what actually reached another pilot's socket). The
end-to-end ones are the ones that matter: `a_teleport_never_reaches_another_pilot`
asserts the *broadcast content*, not the validator's return value.

### Verified in CI (this sandbox cannot compile Rust)

This sandbox has no Rust toolchain and no route to one: `sh.rustup.rs`,
`static.rust-lang.org` **and `crates.io` are all unreachable** (TLS
`SSL_ERROR_SYSCALL`), there is no root for apt, and no `rustc` candidate. So the
Rust was verified by pushing the branch and reading CI:

| Check | Result |
| --- | --- |
| `cargo fmt --check` | pass |
| `cargo clippy --workspace --all-targets -- -D warnings` | **pass** (after 3 fixes, below) |
| `cargo test --workspace` | **pass** (after 1 real bug fix, below) |
| `cargo build --release` | pass |
| botsim 40 vs the Rust server, `--require-anticheat` | **pass** |

Getting there took four CI cycles, because the Actions log bundle and the
artifact blob host are *also* unreachable from here. `rust.yml` now republishes
clippy/test diagnostics as check annotations and posts the failing output to the
PR, which is what finally made the errors readable.

**Clippy found three defects in my own Rust** — all real, all mine:

1. `field tick_hz is never read`. My first fix derived `min_sample_interval`
   from a *local* `tick_hz` in `Default`, which writes the field but never reads
   it; `dead_code` is about reads. The stored field is gone and `admit()` now
   computes the interval floor from `self.tick_hz` at the point of use.
2. `type_complexity` on the packed-state tuple — aliased as `WirePilot`.
3. `doc list item without indentation` — a doc continuation line began with
   `+ `, which rustdoc parses as a new unindented Markdown bullet.

**`cargo test` then found a genuine production bug on `main`** — see §2.1.

---

## 4. Adopted: botsim — 40 real clients, gated in CI

This was the single best idea in the proposal, and our gap was widest here: a
2-client smoke test that no CI job ran.

New: **`scripts/botsim.mjs`**. Every bot is a genuine WebSocket client speaking
the same legacy frame vocabulary as the browser, so a run exercises the real
room registry, the real 15 Hz tick and the real server-assigned finish order.

Four jobs from one binary: load proof, anti-cheat probing, mid-race resume, and
seeded reproducibility (`--seed`).

### Measured, against the reference server in this sandbox

(Local numbers. The CI comparison of both servers is in §6 — use those.

```
$ node scripts/botsim.mjs --url ws://127.0.0.1:8787 --players 40 --seconds 15
  connected   40/40 (42ms)   roster 40/40
  frames      total 9498  p50 238  min 232
  cadence     p50 65.6ms  p95 66.8ms
  finish      13 finishes, 13 unique places
  resume      4/4 re-seated after a mid-race drop
  bandwidth   62.72 KB/s per client
  cheats      16150 LEAKED (absurd-magnitude:15538, teleport:612)
botsim: PASS (0 gates failed)
```
)

`cadence p95 66.8ms` is 15 Hz to within a millisecond under 40 concurrent
clients — the broadcast tick holds.

### The cheat number is the finding

**16,150 leaks** in that local run against `server/sunbird-server.mjs` (CI's
run of the same harness logged 16,082 — the count varies with timing, the
behaviour does not). That server stores client
state verbatim (`pilot.x = num(msg.x)`, no plausibility check), so it relays
`1e300` coordinates and 50,000-unit teleports to every honest client in the
room. This is measured, not asserted.

It is why containment is **reported** in the reference job and **gated** in the
Rust job:

```
$ node scripts/botsim.mjs --players 12 --seconds 5 --require-anticheat
  [FAIL] cheats are contained by the server — 1026 leaked (absurd-magnitude:918, teleport:108)
botsim: FAIL (2 gates failed)     # exit code 1
```

A bug was found and fixed in botsim itself while doing this: the last
resumer's drop timer was scheduled past the end of the measurement window, so
it never dropped but still sat in the denominator — a false `3/4` failure.
Drops are now spread across the middle 60% of the run and the denominator only
counts bots that actually dropped. Re-running the identical failing
configuration gives `4/4`.

### CI (`.github/workflows/botsim.yml`)

| Job | Server | Anti-cheat |
| --- | --- | --- |
| `load-reference` | `server/sunbird-server.mjs` | reported |
| `load-authoritative` | Rust `sunbird-server` | **gated** (`--require-anticheat`) |

The second job is the real gate: a regression in `validate.rs` that lets a
teleport through fails the build.

---

## 5. Rejected, and why

Honest rejections matter as much as adoptions, or this is just a yes-list.

### 5.1 The Bevy / bevy_replicon / renet rewrite — **rejected**

The APIs in the pitch are broadly real, which is worth stating because it
makes the rejection a judgement rather than a fact-check:
`bevy_replicon` 0.44.0 (docs.rs, 2026-09-01) does ship
`server::visibility::AppVisibilityExt`, `client_visibility::ClientVisibility`,
`filters_mask::FilterBit` and `registry::FilterRegistry`, and it targets
Bevy ^0.19. So "add a visibility filter" is a genuine capability, not a
hallucination.

It is still the wrong move here. It would discard a shipping product — 207
passing tests, portal builds for Poki/CrazyGames/itch, Stripe, PWA, a
60+ skin catalogue — to rebuild a *different genre* on a different renderer,
and Bevy's WASM path would replace a web game that already runs in a browser
today. The proposal also prices the whole thing at "≈610 dev-hours ≈ $30–60k"
for a game that does not exist yet, against a game that does.

### 5.2 Visibility filters / fog-of-war as combat design — **rejected (genre-wrong)**

This is the proposal's favourite idea and it does not survive contact with our
game. Sunbird is a **mass race**: the fantasy is 40 rivals visible in one
frame. Hiding them behind team/LOS/fog bits would delete the core experience
to import a mechanic from a survival game with no equivalent tension.

The one real concern underneath it — bandwidth — was addressed differently and
without changing what players see: server-side canonicalisation (§3). In CI it
measured a **34.5% cut** in per-client bandwidth at identical cadence and roster
size (79.56 → 52.11 KB/s); see §6.

### 5.3 Spatial audio gated by visibility — **rejected**

There are no hidden enemies to leak the position of, and our audio layer
(`src/game/Music.ts`, 829 lines) is a music/particle system, not a positional
one. "Sound = information" is a good idea in a game with fog; it is inert in a
game with none.

### 5.4 The marketing ROI table — **rejected as planning input**

Specific figures were presented as fact with no basis: `CAC (creator tier)
$0.08–0.15`, `wishlist → purchase >10%`, `LTV 1 month $12–25`, `payback <120
days at 2k wishlists`, `20x spread`, `1–2 million organic impressions`. None of
these are measurable from anything in this repository, and two contradict each
other (`CAC $0 at 10k MAU` vs. a creator tier with non-zero CAC). Nothing here
was adopted as a target.

The one defensible idea — capture shareable moments in-engine rather than
buying distribution — is already partially true: `scripts/botsim.mjs` is the
same binary that would record ghost replays, and `ROADMAP.md` already lists
"real-player ghost replays on the daily seed" as next-up item 2.

---

## 6. Scoreboard

| Proposal idea | Verdict | Where |
| --- | --- | --- |
| One definition of truth, enforced | ✅ **Adopted** | `protocol/contract.json` + 2 suites |
| Clients send intents, never outcomes | ✅ **Adopted** | `rust/…/validate.rs`, wired into `legacy.rs` |
| botsim 40 + CI gate on every PR | ✅ **Adopted** | `scripts/botsim.mjs`, `.github/workflows/botsim.yml` |
| Seeded, reproducible load runs | ✅ **Adopted** | `--seed`, in every CI invocation |
| Bevy/Replicon rewrite | ❌ Rejected | §5.1 |
| Visibility filters / fog-of-war | ❌ Rejected (genre) | §5.2 |
| Visibility-gated spatial audio | ❌ Rejected | §5.3 |
| Marketing ROI table | ❌ Rejected (unverifiable) | §5.4 |

### Verification actually run in this sandbox

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` (`--max-warnings 0`) | clean |
| `npm test` | **207 passed / 27 files** (was 183 / 26) |
| `npm run verify` (typecheck + test + build) | exit 0, `✓ built in 2.95s` |
| `scripts/botsim.mjs` 40 pilots | **PASS**, 9/9 gates |
| `scripts/botsim.mjs --require-anticheat` | **FAIL** as designed against the unvalidated reference server (exit 1) |
| Contract mutation test | drift detected both ways, then reverted |
| `cargo fmt` / `clippy` / `test` / `build` | **pass in CI** (PR #4, `build-test`) |
| botsim 40 vs Rust server, `--require-anticheat` | **pass in CI** (PR #4, `load-authoritative`) |
| All PR checks | **11/11 pass** |

Locally the Rust could not be compiled (no toolchain, and `crates.io` is
unreachable), so every Rust claim above comes from CI, not from me.

### Same 40 bots, both servers — the comparison that justifies the work

`botsim.yml` runs the identical harness against both implementations on every
PR. Measured in CI (PR #4):

| | Node reference | Rust authoritative |
| --- | --- | --- |
| connected | 40/40 | 40/40 |
| roster | 40/40 | 40/40 |
| cadence p50 / p95 | 65.9 / 67.1 ms | 65.2 / **66.9 ms** |
| state frames p50 / min | 237 / 231 | 239 / 233 |
| finish places | 8 finishes, 8 unique | 7 finishes, 7 unique |
| mid-race resume | 4/4 | 4/4 |
| bandwidth per client | 79.56 KB/s | **52.11 KB/s** |
| **cheat leaks** | **16,082** | **0** |
| gates failed | 0 | 0 |

Two things fall out of that table:

1. **Cheat containment is total, not partial.** The same 40 bots — including
   four sending `1e300` coordinates and 50,000-unit teleports — produce
   **16,082** impossible positions relayed to honest clients against the
   reference server, and **0** against the Rust server. That is `validate.rs`
   measured end-to-end, not asserted.
2. **Canonicalisation cut per-client bandwidth by 34.5%** (79.56 → 52.11 KB/s)
   at identical cadence and roster size. Rounding to wire precision was sold as
   a hygiene fix; it turned out to be the larger of the two wins. At a 40-pilot
   room that is ~1.1 MB/s off a single slice.

### Still open

- The Rust changes need a CI run to be considered verified. `rust.yml` and the
  new `load-authoritative` botsim job will do it.
- `mp-smoke.mjs` is now redundant with botsim; it can be retired once
  `botsim.yml` has been green on a few PRs.
- The client still does not consume the `snapshot` message it can now parse.
  Wiring it is the actual Phase 2+ step, and the parser is no longer the
  blocker.
