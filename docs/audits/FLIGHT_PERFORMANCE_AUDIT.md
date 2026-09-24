# Flight, clarity and performance pass — 15 September 2026

> **Status:** historical evidence — loading path, terrain/flight loop, camera, collectibles, rendering, procedural audio and sharing as of 2026-09-15. Performance budgets are now enforced mechanically by `pnpm verify:prod` and `scripts/audit-ui.mjs`.

## Scope and reference

This pass audits the browser loading path, terrain/flight loop, camera, collectibles,
rendering, procedural audio and sharing. It is **not** a claim that every backend,
payment or multiplayer path has been audited or that virality/FPS is guaranteed.

The supplied reference is [Tiny Wings World Record](https://www.youtube.com/watch?v=nn_s051gdjQ).
Its metadata was accessible; a reliable audio audition was not. No soundtrack was
copied, and no listening comparison is claimed. The existing original island-folk
score was retained and its arrangement, volume routing and resource usage improved.

Implementation guidance checked:
- [Vite features / async chunk loading](https://vite.dev/guide/features): dynamic
  imports with shared dependency preloading; preserve content-hashed vendor caching.
- [Three.js: optimizing objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html):
  reduce draw submissions and retain instancing.
- [Three.js: render on demand](https://threejs.org/manual/pages/rendering-on-demand.html):
  don't treat a non-playing UI like a full-rate action scene.
- [Three.js: responsive rendering](https://threejs.org/manual/pages/responsive.html):
  match canvas size/aspect and control expensive high-DPI rendering.

## Problems fixed

### Loader and presentation
- The loader is the **same SVG geometry and palette** as the menu bird, flapping
  while orbiting the same sun. Artwork is inlined by Vite from `Sunbird.ts`.
- Loading UI lives outside React and persists through the dynamic game import.
  Reduced motion stops both orbit and wingbeat; slow loads expose a retry button.
- Boot recovery moved out of inline scripts so the production script CSP permits it.
- Removed the star point cloud, 1,400-dot background texture, biome ambient dots,
  golden-hour ambient sparkles, and decorative balloon/lantern dots. Coins,
  collectible balloons, weather and short action-feedback bursts remain meaningful.
- Primary play/retry hit targets no longer perpetually scale. The main play button
  no longer squeezes icon, label and instructions into three narrow columns.

### Momentum and progressive difficulty
- Each island has an authored shoulder at x=710, a long drop to the bowl at x=845,
  and a smooth upward launch to the x=928 ocean lip. The descent exceeds 60 world
  units, giving the player actual momentum rather than an unexplained speed boost.
- Fixed a discontinuity between the launch lip and ocean geometry, the tutorial
  blend stopping early, and ocean gaps growing past the island's coordinate wrap.
- A forward-speed recovery floor prevents indefinite uphill stalls/backward rolling.
- `FlightProgression.ts` centralizes bounded progression. Hill/rhythm envelopes
  grow smoothly; Endless speed saturates at 1.55x and uses run time, not menu time.
  Biome amplitude is applied once, not accidentally squared.
- Difficulty changes now invalidate **both** rendered terrain and collision caches.
  Adaptive skill calibration is applied before spawn and only to unshared casual
  seeds; daily/shared/ranked seeds do not depend on an individual player's save.
- Camera fit includes bird height, ground, and horizontal landing room, including
  portrait and reduced-motion configurations. Zoom-out is quicker than zoom-in.
- Contextual hold/release hints mark the big drop, transfer ramp and descent.

### CPU, GPU, caching and lazy loading
- **Collectibles:** complete 26-unit cells spawn once. Previously fractional
  spawn boundaries rounded down, spawning the final cell again on each physics step.
- Coin/gem/ring meshes submit dense active prefixes instead of all 680 reserved
  instances. Empty instances no longer consume vertex processing off-screen.
- Terrain decoration has conservative instance bounds and frustum culling.
- Four far-terrain layers reuse typed vertex/index buffers instead of disposing
  geometry and recalculating unused normals every 40 world units.
- Terrain chunk maintenance only runs on chunk crossings (or invalidation).
- Expensive airborne menu autopilot decisions are cached up to 1/15 s; nearby
  landing decisions and all player physics retain the fixed-step contract.
- Menus and paused scenes render at up to 30 Hz; HUD snapshots refresh at up to
  30 Hz, with immediate invalidation on UI actions. Flight remains 120 Hz fixed-step
  physics with render interpolation. Hidden tabs already pause simulation/audio.
- Bloom and share-card code are separate dynamic imports. Mobile/low quality
  never constructs bloom targets; Auto earns bloom after three healthy windows,
  sheds it under sustained overload and waits before retrying. Mobile shadows
  can no longer accidentally be restored by the desktop recovery path.
- Capped particle replacement is O(1), and spark drag is frame-rate independent.
- Content-hashed `/assets/` retain immutable HTTP/CDN caching. Old service-worker
  retirement is scoped to Sunbird's cache and does not purge other portal apps'
  caches. No second app-shell cache is added to reintroduce stale-menu bugs.

### Sound and shareability
- New original procedural momentum scoop, island-ramp whistle and quiet apex bell.
  Run-up/apex cues are state-triggered and rate limited, not played every frame.
- Music reverb is post-fader/post-duck, so music volume zero really silences new
  music input to reverb. Already-playing reverb tails decay naturally.
- Music scheduler stops at zero/off; normal-flight percussion is sparser, fever
  earns the denser arrangement, and pads last one bar instead of overlapping two.
- Fixed negative night-time filter cutoff, silent extended wind-noise buffer, and
  one-shot gain/send cleanup. Muted/hidden/ad-blocked SFX do not create new voices.
- Share cards now feature the canonical bird visibly beside the stats; challenge
  text has a short playful hook. Extra quips are event-driven, not constant spam.

## Measurements (not promises)

Controlled software-WebGL scene check at x=64, 500 and 845, same camera and scene,
shadows disabled, toggling only terrain instance culling:

| Position | Culling off, draw calls | Culling on, draw calls |
|---|---:|---:|
| 64 | 124 | 66 |
| 500 | 141 | 67 |
| 845 | 141 | 53 |

These were measured before the final active-instance change. After that change,
empty collectible meshes in the menu no longer submitted 88,704 triangles:
controlled scene totals fell from about **94k to 5–6k triangles**. This measures
removed work, **not** an equivalent FPS improvement. A live flight still draws its
active collectibles. Real-device frame time and battery tests remain necessary.

The new cached planner test performs at most 16 expensive decisions over 120
high-airborne ticks rather than 120. The near-ground path deliberately replans.

`pnpm physcheck` (fixed seed, scripted policies, 60 simulated seconds) after the
flight changes: downhill-timed policy ~2,334 m, hold-all ~985 m, no-hold ~637 m.
The earlier audit run before stall/tutorial fixes stuck the downhill-timed policy
at ~204 m. These are synthetic playability checks, not human skill measurements.

The chunked build defers roughly 20 KB raw bloom code and 3 KB share code from
initial play startup. Three.js remains a ~542 KB raw vendor chunk; Vite's existing
500 KB advisory still applies. Portal single-file builds necessarily inline code,
but expensive bloom construction remains deferred there too.

## Verification and repeatable checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm physcheck
pnpm build
pnpm build:generic
pnpm exec playwright install chromium  # once on a normal development machine
pnpm test:e2e
```

- `flight-readability.test.ts`: transfer continuity across seeds/islands, real
  physics gap crossings, query-order-independent terrain cache, projected camera
  bounds at several aspects/altitudes and during a full climb/descent.
- `collectibles.test.ts`: no fractional-cell duplicate spawning, deterministic
  small/large steps, only active instances drawn, reset clears counts.
- `performance.test.ts`: buffer reuse, decoration culling, invalidation, bounded
  progression, planner call budget, bloom hysteresis and sparse sound cues.
- `music-mix.test.ts`: graph routing, zero/off scheduler, filter range.
- `e2e/SunbirdPage.ts`: shared **Page Object Model** for desktop/phone browser
  smoke tests. Tests cover delayed loading, exact menu/boot bird geometry, reduced
  motion, optional chunk deferral, play/pause/resume and browser runtime errors.

Browser tests use a production build. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point
at a provisioned browser in restricted CI. No benchmark hook or test-only game
instance is exposed in the shipped app.

Not verified in this pass: physical iOS/Android battery/FPS, subjective speaker
mix on devices, full backend/payment integration and live multi-client load.
Gameplay changes also mean historical ghost trajectories/records came from a
different terrain/physics version; no historical scores are silently rewritten.

### Previous-pass results (before the follow-up below)

- Production verification gate passed: lint, typecheck, deterministic unit suite,
  production build, debug-artifact scan, bundle budgets and coverage ratchets.
- **777 unit tests passed across 47 files.** Total measured line coverage 32.4%;
  all 19 existing per-module coverage floors passed.
- **6 production-browser tests passed**, split across desktop and phone projects.
- Generic portal single-file build and ZIP packaging passed.
- `git diff --check` passed. The Three.js chunk-size advisory remains informational.

## Follow-up: layout, upload and audio budgets

This follow-up builds on the measurements above; it does not imply a million-fold
FPS gain or an all-device audit.

### Layout and readability

- Replaced independent header positions with flow-based counter/control, metadata,
  power and race-roster lanes. Both mute/pause retain 44px targets. Long counters
  wrap within their own grid cells rather than under buttons.
- Header/footer heights are tracked by `ResizeObserver`, not synchronous layout
  reads in the game loop. The altitude meter and message slot reserve that space.
- Countdown, finish, launch, goal and coaching text share one priority slot.
  Combo moves into metadata; goals, fever, slipstream and scrollable emotes share
  a footer. Narrow layouts use the roster instead of a redundant standings list.
- One notification pill during flight, two in menus; duplicates no longer force
  layout. Short viewports suppress secondary toast pills rather than covering
  timing instructions/landing space. Notification/flash timers are disposed.
- SVG mute controls do not depend on the device having an emoji speaker glyph.
- POM layout fixtures clone the actual compiled HUD and stress long counters,
  three powers, a race roster, fever, goals and emotes at 1280×800, 360×740,
  320×568, 844×390 and 568×320. These are deterministic synthetic state
  combinations, not claims of full live multiplayer validation. The ordinary
  flight tests separately check the live counter/control layout.

### Work avoided

- Shared `uploadDensePrefix` uses Three.js component update ranges for
  collectibles, trail geometry and particles. Pending ranges are replaced rather
  than accumulated across physics ticks or while objects aren't rendered.
- In the deterministic `collectible-cells` fixture at x=64 (bird above pickups),
  51 coins / 0 gems / 0 rings require **3,264 bytes** of dirty matrix data instead
  of **43,520 bytes** of reserved capacity: **92.5% less** for this update.
  Initial GPU allocation still uploads the full buffer; this is a dirty-range
  budget measurement, not a frame-rate benchmark.
- Unchanged resize notifications no longer reset drawing buffers/bloom targets.
  Context restoration invalidates the size cache. Repeated split-screen aspect
  assignments skip redundant projection-matrix recalculation.
- Each bird reuses its own terrain-normal scratch object (no shared mutable
  normal across racers). Existing deterministic physics tests remain applicable.
- Sustained ground dust is limited to at most 30 emissions/second instead of
  120; impact bursts remain immediate. The retired MenuSky system is no longer
  constructed/imported by the HUD (two unused canvases avoided).

### Sound and loading

- Ring chains have a bounded ascending pentatonic cue; ridge skims get a distinct
  brush/whistle. Short tones use one oscillator instead of two; longer accents
  retain their chorus. A repeating five-note ring fanfare was removed.
- Removed duplicate hard-contact audio and duplicate perfect-contact fallback
  rewards/sounds. Existing 28-voice admission and mute gates remain in force.
- A longer noise burst now fills and reuses an expanded noise cache rather than
  allocating an unfilled silent buffer. Disposal releases the cache.
- Interrupted lazy game downloads show a connection/version retry explanation,
  not a misleading WebGL-only diagnosis. Retry is user-initiated; no automatic
  reload can interrupt a flight. Browser tests deliberately abort the game chunk
  and then exercise recovery.
- Existing Vite 7 dynamic imports and hashed-asset caching are retained. Latest
  Vite docs now reference Rolldown; no incompatible Vite 8 configuration was
  copied into this Rollup-based project. HTML stays revalidated (`no-cache`),
  while hashed assets can remain immutable.

Additional references consulted:
- https://vite.dev/guide/build — stale dynamic chunks, preload errors, HTML cache policy.
- https://threejs.org/docs/pages/BufferAttribute.html — update ranges count scalar
  components; set dynamic usage before first upload. Behavior also checked against
  the installed Three.js r186 `WebGLAttributes.js` implementation.

Additional unit suites cover HUD priority/lifecycle, dense-buffer update ranges,
normal reuse, repeated aspect updates, audio pitch bounds, voice cleanup, mute
allocation guards and the noise cache. Subjective speaker quality, physical mobile
FPS/battery and full backend/payment/live-network behavior remain unverified.

### Final follow-up verification

- `pnpm verify:prod` passed: lint, typecheck, production build, debug-artifact
  scan, deterministic simulations, bundle budgets and coverage ratchets.
- **789 unit tests / 50 files passed**, including the repeated coverage run.
  Total line coverage **34.8%**; all 19 existing module floors passed.
- **13 production-browser tests passed**: desktop/phone boot, flight/pause/resume,
  reduced motion, interrupted chunk/retry, and five HUD viewport stress cases.
- Generic portal single-file build/ZIP passed: **1,333.71 kB raw / 370.28 kB gzip**.
- JavaScript budget remains **1.21 MB total / 0.54 MB largest chunk**; the Three.js
  500 kB advisory is still visible, not hidden by raising the warning threshold.
- `git diff --check` passed; the development preview returned HTTP 200.
