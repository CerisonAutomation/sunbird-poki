# PvP transport incident — 2026-10-04

**Impact:** every "live" PvP room in the shipped Poki build was dead on arrival.
**Root cause:** an unwired module and three audits that verified the file, not
the wiring.
**Status:** FIXED on this branch, proven on the shipping artifact in a real
browser.

## What a player saw

The Race Lobby offered live multiplayer (`isMultiplayerConfigured()` returns
true on the Poki build). Hosting a private room or quick-matching produced an
offline room: the transport answered every connection attempt with **"No
multiplier server configured"** and degraded to the AI flock. Live PvP was
unreachable — every mass race, every rival duel, every invite link.

## Root cause

`src/game/net-transport.poki.ts` (the factory that builds the Netlib P2P
client) existed, was documented, and was **imported by nothing**. Its header
claimed "vite.config.ts swaps this module for net-transport.poki.ts on the
Poki target" — no such alias existed anywhere. `Game.ts` imported
`./net-transport`, which resolves to the neutral WebSocket factory; the Poki
zip ships with `VITE_MULTIPLAYER_URL` deliberately empty, so that client can
never connect. Result: the menu advertised live PvP while the build contained
no reachable transport.

Three separate audits had marked this wiring "✅ verified" (`NL-05`, `NL-08`,
`NL-09` in `docs/poki/COMPLIANCE.md`): each verified the *file* (it exists, it
matches a regex, it contains a dynamic import) and none verified that anything
*resolves to it*. A gate that checks the part can pass forever while the whole
is broken.

## The fix

`src/game/net-transport.ts` is now an explicit, readable dispatcher — no alias
magic: on the Poki target with WebRTC available it delegates to
`net-transport.poki.ts` (Netlib P2P, loaded behind one shared dynamic import);
otherwise it returns the WebSocket client exactly as before (the NL-05
non-WebRTC fallback).

## The proof (all machine-checked, all on this branch)

| Layer | Check | Where |
|---|---|---|
| Unit | 7 tests: runtime dispatch (Netlib client on Poki+WebRTC, WebSocket fallback without WebRTC, neutral off-target), prewarm shares the import, source contract | `src/game/__tests__/net-transport-wiring.test.ts` |
| Artifact | Boots the SHIPPING `poki-upload/` folder in a real browser, hosts a private room, and asserts a `wss://netlib.poki.io` signalling dial happens, no relay is dialled, and the game degrades without throwing when the dial cannot connect | `e2e/poki-artifact.spec.ts` ("opening the Race Lobby races over Poki Netlib") |
| Console | The signalling-unreachable console spam (`signallingerror not handled`, one line per retry, forever) is silenced at both teardown paths, and the lobby browse redial loop is cooled down (15 s) so a poll loop cannot hammer a dead service | `src/sdk/PokiNetlib.ts` |
| Honesty | The Netlib client now has a 12 s connect timeout — netlib retries signalling internally up to 42 times before emitting `failed`, which was minutes of a dead "connecting" lobby during an outage; the WebSocket transport always failed honestly at 10 s | `src/sdk/PokiNetlib.ts` |

## Why it stayed green for so long (the lesson, stated once)

A verification method that inspects a module in isolation cannot see a missing
import. Every new "X is wired" claim needs at least one check that observes
**the artifact behaving**, not the source *shaped like* it should behave. The
artifact-level PvP test is now the template: it watched the shipped bundle dial
nothing, and now watches it dial Netlib.
