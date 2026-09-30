# Sunbird — Visual & Design Critique by Ten Specialists

**Date:** 2026-09-30 · **Branch:** `arena/01a0f277-sunbird-poki` · **Supersedes:** `VISUAL_QA_2026-09-30.md`

**Method.** Headless Chromium 153 driven over CDP against the live dev server — the same server the preview pane shows. Eighteen menu destinations × six viewports (640×360, 836×470, 1031×580, 390×844, 844×390, 1280×720), plus launch, sustained flight to 1.65 km, pause, and the continue offer. Every claim below is either a measurement or a captured frame in `shots/`. Nothing here is from reading the source alone.

**Status.** This is not a wishlist. Findings marked ✅ were **fixed and re-verified in-browser** in the same pass; the measurement after the fix is quoted next to the measurement before it. Findings marked ◻ are open, with the reason.

---

## The panel

| # | Lens | Reads for |
|---|---|---|
| 1 | Art Director | Palette, silhouette, readability of the world |
| 2 | UI/UX Designer | Information architecture, screen count, hierarchy |
| 3 | Visual/Interaction Designer | Grid, rhythm, optical alignment, affordance |
| 4 | Typographer | Type scale, tracking, numerals, glyph coverage |
| 5 | Game Feel Designer | What the HUD says while your hands are busy |
| 6 | Mobile/Responsive Engineer | 640×360 up to desktop, safe areas, tap targets |
| 7 | Accessibility Specialist | Contrast, motion, keyboard, non-colour cues |
| 8 | Platform Compliance (Poki) | The published requirements, read literally |
| 9 | Performance Engineer | Frame cost of anything added |
| 10 | QA Lead | Reproduction, measurement, regression guards |

---

## The three findings that mattered

### 1 ✅ The world stopped being readable at dusk — Art Director, with Accessibility

**Evidence.** `shots/g-gameover.png`, 1.65 km into a continuous run. The grade collapsed to maroon sky over teal-to-black terrain. Sampling the frame, the distant hill band and the sky behind it measured a **WCAG contrast ratio of roughly 1.2:1** — visually one flat field. The horizon, the water plane and the hill silhouettes were indistinguishable.

**Why it is the worst finding.** It is not a mood problem. In a one-button glider the hill line *is* the game: it is the only thing you steer against. And it degrades with distance, so it punishes exactly the players who are doing well, in the runs they most care about. A player cannot tell "the art got moody" from "I was cheated".

**The wrong fix** would be to brighten dusk, which throws away the game's best art. **The fix shipped** is a *floor*, not a grade:

- New pure module `src/game/legibility.ts` — sRGB transfer functions, WCAG relative luminance, contrast ratio, and `enforceMinContrast(fg, bg, ratio)`, which pushes a colour *away* from its background only when it has fallen under the floor, preserving hue so a teal hill becomes a lighter teal hill and never a grey one. Above the floor it is the identity function and the art is untouched.
- `nightFillIntensity(daylight)` adds ambient fill that is **exactly zero above 55 % daylight** and eases in as a smoothstep, so the daytime look is bit-identical and the transition never reads as a light switch being thrown.
- Wired into `Sky.update()` against `farA`/`farB`/`farC` and the hemisphere light. Allocation-free — scratch objects are reused, because this runs every frame.
- Colour is read and written through `THREE.SRGBColorSpace` explicitly, so the floor means the same thing whether or not renderer colour management is on.

**Guard.** `src/game/__tests__/legibility.test.ts` — **21 tests**, including a regression that reconstructs the two colours sampled from the broken frame and asserts the floor rescues them while keeping the hue order, plus idempotence, gamut safety, monotonicity of the night fill, and the "no-op in daylight" property.

**After:** `shots/fix-dusk.png` at 599 m — hills, water and sky are three clearly separated planes, and it is still unmistakably a sunset.

### 2 ✅ The pause button rendered as two empty boxes — Typographer, with Compliance

**Evidence.** `shots/p-1280x720-flight2.png`. The top-right pause control is two tofu glyphs. `HUD.ts:379` drew it with `❙❙` (U+2759). `MenuIcons.ts` also used `✕` (U+2715) for dismiss and `‹` for back, and mapped nine icons onto the U+2B00 Miscellaneous-Symbols-and-Arrows block (`⬆ ⬇ ⬨ ⬩ ⬦ ⬟`) — emoji-presentation or rare code points absent from lean Android WebViews, several Linux distributions and stripped Chromebook images.

The codebase already knew this. `MenuIcons.ts` carries a comment explaining that text arrows were converted to inline SVG *for exactly this reason*, and `smGlyph` is documented as "text-presentation code points only". The functional controls were simply never migrated, and the U+2B block entries quietly violated the stated rule.

**Fix.** `pauseSvg()`, `closeSvg()`, `backSvg()` — stroked on a 24-unit grid, inheriting `currentColor`, sized and optically aligned in CSS (a chevron's optical centre is right of its bounding box, so the back arrow carries a 0.12 em nudge). Swapped in at all four call sites. The nine U+2B glyphs moved to Geometric Shapes / Mathematical Operators equivalents. `src/game/MenuIcons.ts` and `src/game/FirstFlight.ts` now contain **zero** code points in the U+2B00–U+2BFF range.

**Verified:** the pause button's `textContent` is now empty and it contains an `<svg>`. `shots/fix-final.png` shows a clean two-bar pause icon.

**Honest caveat.** Four tofu boxes remain in the flight-cue line (`● ◉ ○ ◇`). Those are Geometric Shapes — present in essentially every real font — and are tofu here only because the headless container ships a near-empty font set. I fixed the code points that are genuinely at risk on shipping devices and deliberately did not churn the ones that are not.

### 3 ✅ Panels were fixed-width columns shorn off at the viewport edge — UI/UX, with Responsive

**Evidence.** Measured content height vs visible height:

| Viewport | Panel content | Visible | Screens of scroll |
|---|---|---|---|
| 640×360 (Poki floor) | 1,937 px | 310 px | **6.2** |
| 1280×720 | 1,999 px | 686 px | 2.9 |
| 390×844 | 2,187 px | 762 px | 2.9 |
| Game modes, any size | 1,817 px | 310–638 px | 2.8–5.9 |

It *did* scroll — the inner `.paper-card` is the scroller and the wheel works — but with **no affordance whatsoever**. Every capture shows a card sheared mid-row. At 1280×720 the Game modes screen showed 6 of 17 entries: **all nine PvP circuits, AI PvP and split-screen sat below the fold with nothing hinting they existed.** A 440 px column floated over ~840 px of unused backdrop while its own content needed three screens of scrolling.

Separately, `.overlay.menu` measured `scrollHeight 768` against `clientHeight 720` under `overflow: hidden` — **48 px clipped and unreachable**, also present at 1031×580.

**Fixes, all in the new `src/game/design-polish.css`:**

- **The 48 px clip.** Root cause found by measurement, not guesswork: `max-height: 100%` on a flex row whose container carries asymmetric padding did not resolve against the content box, so the card measured 688 px inside a 640 px well. Replaced with `calc(100dvh - 80px - safe-areas)` — 80 px being the overlay's own 12 px top + 68 px bottom toast reserve, which is kept and now actually honoured. **Before: 48 px overflow at 1280×720 and 1031×580. After: 0 px at 640×360, 1031×580 and 1280×720.**
- **Affordance.** A 28 px `mask-image` fade on the last rows so a cut-off row reads as "continues" rather than "ends", removed at the scroll end via `animation-timeline: scroll()` where supported; plus a genuinely visible scrollbar (8 px thumb on a tinted track, replacing a 6 px thumb on a transparent one that was invisible against warm paper until you were already scrolling — which is too late to tell you that you can).
- **Stop wasting the screen.** Above 900 px of landscape, destination lists go two columns and the card widens. **Card width 440 → 760 px**, roughly halving scroll depth on exactly the viewports where it was worst. Primary CTAs, prose and sliders are explicitly excluded and still get their own full row.

**A note on how this was won.** The first attempt silently lost: `menu-polish.css:381` sets the same property at four-class specificity. The correction matches that specificity rather than reaching for `!important` — this sheet ships **zero** `!important` declarations, against menu-polish's 1,491, and `index.css`/`ui.css` are both at their documented cap. It is also imported from `main.tsx` rather than `@import`-ed at the foot of `index.css`, because CSS hoists `@import` to the top of a file, which would have placed it first and lost every tie.

---

## Also fixed

### 4 ✅ The flight corridor was occupied — Game Feel

Two stacked objective cards sat at **x = 440, dead centre-bottom** — directly over the airspace the bird descends into — while a toast, a reward pill and a progress bar competed elsewhere. Five notification channels; a measured **88 visible HUD nodes and 17 simultaneous live text readouts**, in a one-button game.

The strip is now at **x = 28, lower-left**, above the altitude ribbon where nothing is ever flown, and tucks under the top bar on portrait phones where the ribbon would collide. Lower-centre is left empty on purpose: it is the only part of the screen the player is actually looking at.

It is **moved, never hidden** — `flight-goal-strip.test.ts` guards that distinction by name and the guard is correct. The complaint was never that the strip exists.

### 5 ✅ "best 0 m" next to "1.65 km" — Typographer

A fresh save showed `best 0 m` under the distance counter for the entire duration of a record-setting run. That reads as a bug, not an empty state. The row is now out of the layout until a real record exists, and once shown never disappears mid-run, so the HUD cannot reflow under the player. Verified: `bestRowHidden: true` on a fresh save.

### 6 ✅ The daylight meter was under the sun sprite — Visual Design

The centre-top meter — the clock for the entire run — was being overdrawn by the rendered sun disc. Lifted above the scene with a legibility plate and a text shadow on its label. Fixed in CSS; the renderer was not touched.

### 7 ✅ A green reward pill in the top-right — Compliance

"Goal complete +40" was a green reward-shaped pill in the top-right corner. It is not a rewarded-ad button, so it is not a literal violation — but Poki's guidance is explicit that rewarded controls are not green, and reviewers pattern-match on the shape and the position. Recoloured to the game's own gold via existing palette tokens, which is also the colour of every other reward in the economy: more consistent as well as more compliant.

### 8 ✅ Hero art overflowed its card at the Poki floor — Responsive

`shots/v-640x360-flight.png`: at 640×360 the AI PvP screen was almost entirely one enormous bird illustration bursting out of its card with the content pushed off-screen. Art authored for a desktop card, never constrained. Now capped at `min(30vh, 160px)` and dropped entirely below 460 px of height — at which point it is not decoration, it is an obstruction — with the space reclaimed rather than left as a gap.

### 9 ✅ Optical rhythm — Visual Design, Typographer

Tabular numerals on every live counter so distance and coin readouts stop jittering their own width as digits change; tightened display tracking; a consistent 4 px baseline grid and optical size for the two-line tiles that make up most of the menu. The whole sheet is written on a 4 px grid — no 5s, no 7s, no 13s — and sizes against the viewport with `clamp()` so a rule is pixel-correct at 640×360 *and* at 1440p rather than correct at one and approximate at the other.

### 10 ✅ Motion honesty — Accessibility

The one thing added that moves is the scroll-driven mask. It is disabled under `prefers-reduced-motion: reduce` rather than assumed acceptable.

---

## Open, with reasons

◻ **The pre-gameplay surface still contradicts Poki's core UX rule.** Poki: *"minimise the number of UI screens, ideally drop players straight into gameplay."* Home carries **20 destinations and 54 buttons** before a new player has flown once: title, Fly now, PvP, AI PvP, Shop, Settings, two banners, a five-item checklist, then Endless, Same-screen 1v1, Squad, Top pilots, Progress, Story, Trophies, Atlas, Scores, Account, Nest Pass. `Fly now` is correctly the first, largest, highest-contrast element — everything under it is a reason not to press it.

The two-column layout and the affordance work cut the *symptom* (scroll depth roughly halved at desktop). The *cause* is a product decision: gating the checklist and both banners behind "has completed ≥ 1 run", and collapsing nine meta destinations behind one "More". Target: ≤ 6 home destinations, zero scroll at 640×360. **Not done unilaterally** — it changes what players see first and how they reach the shop and the season pass, which is a call for you, not for a stylesheet.

◻ **The pause card is a second main menu** — twelve controls (`shots/p-pause.png`). "Keep flying" is correctly dominant, but ten side-doors out of pause are ten paths that are not "back into gameplay", which is precisely the condition Poki attaches to `commercialBreak()`. Recommended set: Keep flying / Restart / Exit / Sound / Settings / Fullscreen. Same reason for not doing it unilaterally.

◻ **The menu backdrop is dead space** and the attract bird reads as an orange blob at 1280×720 (`shots/00-boot.png`). Either push it to a hero shot or honestly blur it. Art direction call.

◻ **Space does not resume from pause.** ESC and P both toggle correctly — verified `flying → pause-actions → flying → pause-actions`. Poki's wording mentions spacebar; since Space is the dive key, accepting it would need a short input lockout so the resume press does not also dive. Defensible as-is, flagged for a decision.

---

## What was already right, and stayed right

The panel was ready to be harsher than this. It could not be, on these points:

- **Zero uncaught exceptions and zero non-CDN console errors** across 18 screens × 6 viewports and sustained gameplay — before and after every change here.
- **Zero sub-44 px tap targets** in the flight HUD at 640×360, 390×844 and 844×390. Genuinely rare.
- **ESC pauses and resumes**, including collapsing a pause sub-screen first. A hard Poki requirement most submissions fail.
- **No page-level scroll** at any viewport — `document.body.scrollHeight === innerHeight` throughout. Poki's parent-page requirement holds.
- **Gameplay starts on first input, not on load.**
- Settings, Race Lobby and the pause card are well-composed and legible, and the copy ("Your run is safe", "Resume keeps your momentum") is better written than this genre's norm.

---

## Not verifiable here — still needs a human

- **Rewarded video, midrolls, `commercialBreak()` on pause-exit, the 🎬 label, the ad-blocker no-reward path, and the standard-continue-vs-rewarded sizing rule.** All portal-gated; the SDK CDN is blocked in this sandbox. The continue offer that fired after the long run was the non-portal branch: "Second wind?" → **"Spend 80 (you have 100)" (286×50) vs "Let it sleep" (92×50)**. On a portal build the primary must be a rewarded video, clapperboard-marked and not green, with a free continue at least as large beside or above it. **Needs a playtest on a real Poki test build.**
- **Frame pacing.** Everything here ran on SwiftShader software rasterisation, which reported a 4.5–8.8 fps median. That is the rasteriser, not the game, and no performance conclusion should be drawn from it. Real-GPU profiling on a mid-range Android is still outstanding. What *can* be said: the additions are a per-frame allocation-free colour comparison and static CSS — no new layers, no new draw calls, no new timers.

---

## Verification

Full gate, after all changes:

| Gate | Result |
|---|---|
| `lint --max-warnings 0` | ✅ |
| `typecheck` | ✅ |
| `test` | ✅ **2,777 passed / 9 skipped, 193 files** (+21 new legibility tests) |
| `circular:check` | ✅ no cycles |
| `build` | ✅ 2,118 kB / 644 kB gzip |
| `build:poki` | ✅ |
| `i18n:audit` | ✅ ratchet held |
| `poki:audit` | ✅ |
| `verify:upload` | ✅ 2.02 MB, index.html at folder root |

Plus the in-browser re-measurements quoted inline: overlay overflow 48 → 0 px at three viewports, card width 440 → 760 px, objective strip x 440 → 28, pause button text → empty with an `<svg>` child, best row hidden on a fresh save, and zero `pageerror`s throughout.

**Frames:** `shots/fix-*.png` are after; `shots/s-*.png`, `shots/v-*.png`, `shots/p-*.png`, `shots/g-*.png` are before.

**Files changed:** `src/game/legibility.ts` (new), `src/game/__tests__/legibility.test.ts` (new), `src/game/design-polish.css` (new), `src/game/Sky.ts`, `src/game/MenuIcons.ts`, `src/game/HUD.ts`, `src/game/hud/kit.ts`, `src/game/FirstFlight.ts`, `src/main.tsx`, and the two CSS guard tests extended to cover the new sheet — so the colour ratchet and the "never hide the goal strip" rule police it too. The colour ratchet did in fact catch this work adding six one-off hex values; they were replaced with existing palette tokens rather than raising the baseline.
