# Poki Player Device Report — extracted rules

Source: <https://developers.poki.com/guide/player-device-report>

The Device Report is Poki's continuously updated picture of the hardware and
software its players actually have. The guide's point is simple: **code to the
measured baseline, not to your own development machine.**

## What the report is

| ID | Kind | Rule |
|---|---|---|
| `DEV-01` | informational | The report provides **daily-updated insights** into the hardware and software environments used by players. |
| `DEV-02` | informational | Data is derived from a **random sampling of 100 million players** and adheres to Poki's privacy policies — it is aggregate telemetry, not per-player data. |
| `DEV-03` | requirement | Use it to **understand the baseline technical environment of the player base** so development standards (feature tiers, quality settings, format choices) match what players actually have. |

## What is measured

| ID | Kind | Dimension | Documented scope |
|---|---|---|---|
| `DEV-10` | informational | Platform distribution | Operating systems, browser usage. |
| `DEV-11` | informational | Device capability | CPU core counts. |
| `DEV-12` | informational | Display | Screen aspect ratios, device pixel ratios. |
| `DEV-13` | informational | Media support | Support for various **audio formats**. |
| `DEV-14` | informational | Essential web APIs | **WASM, WebRTC, WebP, WakeLock**. |
| `DEV-15` | informational | Advanced web APIs | **WebGPU** support, **WebGL versions and extensions**. |
| `DEV-16` | informational | AI capabilities | Availability of AI features — **translator, language model, summarizer, detector**. |

## The obligation in code

The report is informational, but `DEV-03` turns it into a build rule: the game
must (a) know its own runtime capabilities, (b) pick quality tiers from the
*measured* baseline rather than assuming, and (c) degrade rather than fail when a
capability is missing. That is what `src/sdk/device-report.ts` implements.

| Rule | Implementation |
|---|---|
| `DEV-03` | `detectDeviceProfile()` probes every dimension the report lists and returns a profile with a derived `tier` (`high` / `standard` / `lite`); the game reads the tier for render quality, DPR caps and AI fidelity instead of guessing from a user-agent string. |
| `DEV-10` | OS/browser name + version parsed from `navigator.userAgentData` when present, with a UA fallback; contributes to tier and to the session telemetry snapshot. |
| `DEV-11` | `navigator.hardwareConcurrency` (+ `deviceMemory` when exposed) feeds the tier — low-core devices get `lite`. |
| `DEV-12` | `devicePixelRatio` and viewport aspect ratio are captured; the game caps render DPR (never rendering more than 2× on a 3–4× screen) and pulls the camera back on narrow aspects. |
| `DEV-13` | `canPlayType()` is probed for `audio/ogg; codecs=opus`, `audio/mp4; codecs=mp4a.40.2`, `audio/mpeg`, `audio/webm; codecs=opus`, FLAC and WAV. Sunbird's audio is a **procedural WebAudio synth**, so no asset format can fail — the probe drives the *fallback* decision (WebAudio → silence-with-UI, never a silent hang) and is reported for future asset needs. |
| `DEV-14` | **WASM**: probed (and required by the Rust multiplayer client path). **WebRTC**: the hard gate for the P2P transport (`Netlib`) — when absent, the game falls back to the WebSocket room server or local play. **WebP**: probed before any share-card/image output uses it. **WakeLock**: used during active runs so a mobile screen does not sleep mid-flight (`src/game/WakeLock.ts`). |
| `DEV-15` | WebGL 1/2 availability, renderer string, and max texture size are probed before renderer creation; WebGL2 → WebGL1 → software fallback is explicit, and the preferred path caps quality on `lite` tiers. WebGPU availability is probed and reported (the renderer stays on WebGL until a WebGPU path ships — knowing how many players could use it is what makes that call possible). |
| `DEV-16` | AI feature availability (`Translator`, `LanguageModel`, `Summarizer`, `Detector`) is probed and reported. It is **not** used to generate player-visible content in this build (Poki's AI-content rules are honoured by shipping only authored/procedural content); the probe exists so a future localisation or moderation assistant can be feature-detected rather than assumed. |

The probe is deliberately defensive: every accessor is wrapped, the whole probe
is synchronous and side-effect free, and a hostile/partitioned environment (no
`navigator.gpu`, blocked `matchMedia`, missing `canPlayType`) returns a profile
with `null`s instead of throwing. `pbk`-style privacy modes are covered by the
storage facade, not here.

## Reporting

The profile is emitted once per session as `device_profile` telemetry (portal
builds send the same payload through the portal's own event sink when one
exists), so the build's tier decisions can be compared against the platform's
published baseline over time.
