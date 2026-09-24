# Easy access — extracted rules

Source: <https://developers.poki.com/guide/easy-access>

The guide's onboarding page. Everything here exists to reduce *frontal load* —
the amount of information and friction a player meets before they are actually
playing.

## Rules

| ID | Kind | Rule |
|---|---|---|
| `EA-01` | requirement | **Mobile first.** A significant portion of gameplay on the platform happens on mobile devices — prioritise mobile compatibility early in development, not as a late port. |
| `EA-02` | recommendation | **Keep it small.** Aim for a **game file size between 8 and 10 MB**; keeping files small is critical for performance on older hardware and slower connections. |
| `EA-03` | recommendation | **Skip the menu.** Let players jump directly into gameplay. Avoid unnecessary splash screens, title screens, or level-selection menus for first-time players — momentum is what converts. |
| `EA-04` | requirement | **Loading screens must be visually engaging and include a progress bar**, so players never assume the game is broken. |
| `EA-05` | recommendation | **Progressive loading:** download only the essential initial assets first and load the remaining files in the background. This is a highly recommended technique for minimising drop-off. |
| `EA-06` | recommendation | **A safe beginner environment.** Start with simpler levels that let players succeed early; increase difficulty gradually; mechanics such as preventing early player death help users learn without frustration. |
| `EA-07` | recommendation | **Gradual introduction.** Avoid overwhelming players: introduce mechanics and controls gradually over several levels. This reduces frontal load and stops players feeling intimidated by too much information at once. |
| `EA-08` | requirement | **Explain the game with visuals.** Prioritise images, animations and gestures over text so the tutorial also works for non-English speakers; effective tutorials should feel natural and never block gameplay. |
| `EA-09` | recommendation | **Test it.** Poki Playtest recordings show how players navigate the early stages of a game; use that data to fine-tune onboarding so it stays smooth and efficient. |
| `EA-10` | requirement | **Portrait vs landscape.** Poki supports games in landscape, portrait, or both. Developing for **portrait is strongly recommended**: it increases player engagement by **6 % on average** and makes the game eligible for **Gamebar Display ads** (extra revenue on mobile). |

## How Sunbird applies this page

| Rule | Implementation | Evidence |
|---|---|---|
| `EA-01` | Mobile detection covers UA, coarse pointer **and** narrow viewport (tablets included); mobile gets a low-power render path, capped pixel ratio, no shadows, tiered AI fidelity. `isCoarsePointer()` is exported for reuse. | `src/game/Game.ts` (renderer + `isMobile`), `scripts/verify-portal.mjs` |
| `EA-02` | Portal zip gated at **< 8 MB** (strictest bar) and verified near **700 KB**; assets are procedural (no art/audio downloads); fonts are self-hosted, subset, and inlined by the single-file build. | `scripts/verify-portal.mjs`, `scripts/audit-zips.mjs` |
| `EA-03` | The boot screen hands over directly to a one-screen, hold-to-start entry; "Fly now" launches free flight immediately. No splash carousel, no level-select gate. | `index.html` boot shell, `src/game/HUD.ts` home hero |
| `EA-04` | The boot shell renders an inline (zero-request) animated loading screen with a progress bar and stage text; the bar becomes determinate as real boot stages report in. | `index.html`, `src/game/BootProgress.ts` |
| `EA-05` | Boot is staged: interaction first (menu + first frame), then deferred work (music bus warm-up, sky/particle pools, background board fetch) scheduled with `requestIdleCallback`/timeout fallbacks. | `src/game/BootProgress.ts`, `src/game/Game.ts` |
| `EA-06` | First-flight guidance runs on flat, forgiving terrain with launch assist; early death is prevented by the tutorial's landing tolerance and the "second wind" continue offer. | `src/game/FirstFlight.ts`, `src/game/FlightGuidance.ts` |
| `EA-07` | The tutorial is a **3-step play-signal sequence** (dive → soar → land) triggered by actual input, shown one cue at a time. | `src/game/FirstFlight.ts` |
| `EA-08` | Cues are icon + gesture animations with short imperative text, never paragraphs; they never block input; localized into all shipped locales. | `src/game/FirstFlight.ts`, `src/i18n/translations.barrel.json` |
| `EA-09` | Playtest-ready: the build is instrumented (session, run, drop-off, ad-placement events) and e2e-covered at phone/tablet/desktop sizes so a Playtest run needs no extra wiring. | `src/game/Telemetry.ts`, `e2e/` |
| `EA-10` | Portrait is supported and playable (camera pull-back for narrow aspects, adaptive zoom, safe-area insets); orientation is never locked, and the HUD re-flows rather than cropping. | `src/game/CameraRig.ts`, `e2e/scaling.spec.ts`, `e2e/layout.spec.ts` |

### Loading-screen contract implemented for `EA-04`/`EA-05`

`BootProgress` defines named stages with weights, reports each stage to the
inline boot shell (so the bar reflects *real* work, never a fake timer), and
exposes a `defer()` helper for non-essential work:

```
import { bootStage, defer } from "./BootProgress";
bootStage("shell");            // boot shell painted
bootStage("controls");         // input + HUD listeners live
bootStage("flight");           // first flyable frame ready
defer("music-warmup", () => …) // idle-time work, never blocks the menu
```

The shipped order is interaction-first: the player can press Fly before the
background work finishes (§`EA-05`).
