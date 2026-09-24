# Poki Networking Library (Netlib) — extracted reference

Source: <https://developers.poki.com/guide/netlib> · package: `@poki/netlib` · GitHub: `poki/netlib`

Netlib is Poki's peer-to-peer transport: WebRTC data channels giving players direct
connections, with an API shaped like WebSockets. It is **beta** — the API can change —
and it is usable whether or not the game is hosted on Poki.

## Model

| ID | Kind | Rule |
|---|---|---|
| `NL-01` | informational | Direct client-to-client connections: no game server to run, no duplicated game logic, lower latency for nearby players, and no per-session server cost. |
| `NL-02` | requirement | `new Network('<game-id>')`, then create a lobby (`network.create()`) or join one by code (`network.join('ed84')`), driven from the `ready` event. |
| `NL-03` | requirement | Traffic uses the right channel: **unreliable** (UDP-like) for real-time state, **reliable** for critical events (spawns, chat, finish order). Unreliable packets must therefore be treated as lossy — never as a state guarantee. |
| `NL-04` | informational | Poki provides hosted **signalling plus STUN/TURN** free of charge; TURN is the fallback when direct P2P fails. Self-hosting is possible (`signalingServer`, `stunServer`, `turnServer` options) but not required. |

## Integration requirements

| ID | Kind | Rule |
|---|---|---|
| `NL-05` | requirement | WebRTC support is feature-detected, and a non-WebRTC path exists (the game stays playable offline or against AI). |
| `NL-06` | requirement | Connection state is surfaced honestly: the UI must say whether the player is in a live room or a local/AI fallback, and must not present bots as remote humans. |
| `NL-07` | requirement | A dropped connection must not end the session: handle reconnection (Netlib reconnects automatically; seats are preserved per device) and degrade to the local flock on failure. |
| `NL-08` | requirement | The library is heavyweight (WebRTC + signalling URL): load it lazily so it never lands in the critical boot path, and never in a build that does not use it. |
| `NL-09` | requirement | A build that ships Netlib must not also ship another platform's transport names or endpoints (portal isolation). |
| `NL-10` | requirement | Lobby codes are short and unambiguous when read aloud; the platform's lobby list can be filtered/sorted for a browser UI. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `NL-01`, `NL-02` | `src/game/PokiNetlib.ts` wraps `Network` (`new Network(NETLIB_GAME_ID)`, host `create()` / guest `join(code)`), and exposes the game's own `NetTransport` interface so `MassRace` renders remote pilots without knowing the transport. |
| `NL-03` | Outbound state rides the **unreliable** channel at a fixed 15 Hz (never per frame), remote birds are interpolated from a two-sample buffer, and reliable channels carry hello/start/place events where loss would corrupt the race. |
| `NL-04` | The Poki-hosted signalling/TURN defaults are used as shipped; no custom endpoints are configured. |
| `NL-05` | `isPokiMultiplayerAvailable()` feature-detects `RTCPeerConnection` + `crypto.getRandomValues` (and the configured game id); `src/game/net-transport.poki.ts` falls back to the WebSocket client when either is missing. |
| `NL-06` | The Race screen and the HUD state the live/local status explicitly (`multiplayerLive`), and the local squadron is labelled as AI practice — never as other players. |
| `NL-07` | `PokiNetlibClient` keeps its seat across reconnects, publishes finish places authoritatively from the host, and degrades to the local flock when the room cannot be reached; `recordRoomPilots()` only ever stores pilots that really raced with you. |
| `NL-08` | The client is created through **one shared dynamic import** in `net-transport.poki.ts` (`loadNetlib()`), so `@poki/netlib` is fetched at race time, not at boot; `prewarmNetTransport()` starts that same import in the background on the Poki target only, and `pnpm isolation:check` proves the library is absent from every non-Poki bundle. |
| `NL-09` | The transport module is swapped per target by `vite.config.ts` (the same mechanism as the edition strings), so the Poki bundle names Netlib and the direct/CrazyGames bundles name the WebSocket relay, never each other. |
| `NL-10` | `makePokiRoomCode()` uses a no-0/O/1/I alphabet; `listPublicLobbies()` feeds the in-game lobby browser. |
