# Sunbird — Strict Production Checklist

**Target:** Poki portal release · **Branch:** `arena/01a0f277-sunbird-poki` · **Last verified:** 2026-10-01 at `3f4ad9d`

## How to read this

Every line is one of four states. Nothing is marked ✅ on the strength of a code
change alone — it needs a green automated assertion, a measurement, or a frame
I actually looked at.

| | Meaning |
|---|---|
| ✅ | **Verified.** Named evidence: a passing test, a measured number, or a captured frame. |
| ⚠️ | **Partially done.** Improved and measured, but not finished. The gap is stated. |
| ❌ | **Open.** Not done, or not reproduced. No claim made. |
| 🔒 | **Blocked here.** Needs a real portal build, a real GPU, or a human. Cannot be closed in this sandbox. |

**The rule that makes this checklist worth anything: a failing gate is never
"fixed" by relaxing the assertion.** Where a bound genuinely had to move
(three times so far) it is listed in §9 with its reasoning, so the change is
visible rather than buried in a green run.

---

## 1. Release gate — must be green on every push

| # | Check | Command | State |
|---|---|---|---|
| 1.1 | Lint, zero warnings tolerated | `pnpm lint` (`--max-warnings 0`) | ✅ |
| 1.2 | Types | `pnpm typecheck` | ✅ |
| 1.3 | Unit + integration suite | `pnpm test` | ✅ 2,837 passed / 9 skipped, 196 files |
| 1.4 | No circular imports | `pnpm circular:check` | ✅ 367 files, 0 cycles |
| 1.5 | Web build | `pnpm build` | ✅ 2,124 kB / 646 kB gzip |
| 1.6 | Portal bundle | `pnpm build:poki` | ✅ single `index.html` at folder root |
| 1.7 | Upload shape | `pnpm verify:upload` | ✅ 2.03 MB |
| 1.8 | Translation ratchet | `pnpm i18n:audit` | ✅ held |
| 1.9 | Poki rule audit | `pnpm poki:audit` | ✅ rewrites `docs/poki/COMPLIANCE.md` |

**Gate discipline.** 1.1–1.9 run before every push. None may be skipped, and
`--max-warnings 0` is not to be softened — a warning budget above zero is a
budget that gets spent.

---

## 2. Poki platform requirements

Source: `developers.poki.com/guide/requirements-quality`.

| # | Requirement | State | Evidence |
|---|---|---|---|
| 2.1 | Runs desktop, mobile, tablet | ⚠️ | Desktop + emulated mobile verified. Real tablet 🔒 |
| 2.2 | Scales to 640×360, 836×470, 1031×580 | ✅ | Overlay overflow **0 px** at all three (was 48 px) |
| 2.3 | `localStorage` incognito-safe | ✅ | All access in `try`/`catch` |
| 2.4 | No external requests | ✅ | Only the Poki SDK tag; fonts and icons are local |
| 2.5 | No external ads or branding | ✅ | `poki:audit` |
| 2.6 | No ad-block circumvention | ✅ | No reward when blocked; no custom "ad blocked" copy |
| 2.7 | No SDK event fires twice in succession | ✅ | `ad-gate`, `ad-surfaces` |
| 2.8 | `gameplayStart()` on first input, not load | ✅ | `gameplaySink` |
| 2.9 | `gameplayStop()` on any interruption | ✅ | pause, break, visibility |
| 2.10 | No SDK events during a break | ✅ | `adBreakAllowsAction` refuses all 16 actions |
| 2.11 | `commercialBreak()` only on pause → gameplay | ⚠️ | Correct in code; pause has 10 other exits (§6.2) |
| 2.12 | Parent page never scrolls | ✅ | `body.scrollHeight === innerHeight` at every viewport |
| 2.13 | Mobile controls forced on tablets | 🔒 | Needs a real tablet |
| 2.14 | Profanity filter = MauriceButler list, extended | ✅ | `pokiBadWords.ts`, 64 tests |
| 2.15 | No currency purchase UI, no ad-removal IAP | ✅ | `poki:audit` |
| 2.16 | External links only via `PokiSDK.openExternalLink` | ✅ | |
| 2.17 | Static + animated thumbnails | ❌ | **Not produced. Submission blocker.** |
| 2.18 | Debug artifacts stripped | ✅ | `verify:upload` |

---

## 3. Ads — the unskippable contract

Four separate skip vectors have been found and closed. All four are in
`ad-unskippable.test.ts` (20 tests), which asserts the **allowlist itself** by
exact equality so it cannot quietly regrow.

| # | Check | State |
|---|---|---|
| 3.1 | No game-side input ends a portal break, at any timer value | ✅ |
| 3.2 | `ad-gold` upsell cannot double as a skip | ✅ |
| 3.3 | `ad-skip` not permitted on either path | ✅ |
| 3.4 | Escape hatch disabled for the full 60 s safety window | ✅ measured at t=0/30/59.2/60 |
| 3.5 | Keyboard (ESC/P/R) inert during a break | ✅ |
| 3.6 | Placeholder break ends **itself**; no control to press | ✅ |
| 3.7 | Reward granted only on the SDK's `earned` flag | ✅ |
| 3.8 | No double-rewarding; in-flight guards on all three placements | ✅ |
| 3.9 | Rewarded button not green, carries 🎬 | ⚠️ non-portal branch only |
| 3.10 | Free continue ≥ rewarded button, adjacent or above | 🔒 portal build |
| 3.11 | Rewarded video end-to-end | 🔒 SDK CDN blocked here |

---

## 4. Flight model — the one input

| # | Check | State | Evidence |
|---|---|---|---|
| 4.1 | Release always produces a launch off a real lip | ✅ | Crest gate demoted from veto to filter: 133 → 249 launches / 784 cases |
| 4.2 | Release never worth nothing on a long ramp | ✅ | Pop floor 0.4; window 0.45 → 0.9 s |
| 4.3 | "Release at the top" lands | ✅ | 0.2 s coyote grace |
| 4.4 | Released bird accelerates downhill like the first build | ✅ | `GROUND_G_GLIDE_DOWN` restored to 30 |
| 4.5 | Ceiling is soft, not a wall | ✅ | 260/50 restored; was 230/20 |
| 4.6 | Diving still beats coasting (skill ceiling intact) | ✅ | `GROUND_G_DIVE` 88 > 30 > 14 |
| 4.7 | Motion smooth — no judder | ✅ | Interpolation re-snapshots per substep, not per frame |
| 4.8 | Held stick pays zero | ✅ | |
| 4.9 | Feel confirmed by a human | 🔒 | **Only you can close this one.** |

---

## 5. Worlds

| # | Check | State |
|---|---|---|
| 5.1 | Ocean widens meaningfully with progress | ✅ 218 → 430, saturating |
| 5.2 | Gap bounded so it is always crossable | ✅ ceiling the old formula already reached |
| 5.3 | Hills escalate across a career | ✅ 32% → 55% |
| 5.4 | Difficulty **step** per island ≤ 0.03 | ✅ 0.025 |
| 5.5 | Nine biomes differ in play, not just palette | ⚠️ `liftMult`, hazard, thermals differ; not A/B'd |
| 5.6 | Per-world signature mechanic | ❌ Not built |

---

## 6. UX and information architecture

| # | Check | State |
|---|---|---|
| 6.1 | Drop players into gameplay; minimise screens | ❌ **20 destinations, 54 buttons on home.** Product decision, see §8 |
| 6.2 | Pause card is a pause card | ❌ 12 controls. Product decision |
| 6.3 | No panel clipped by the viewport | ✅ 0 px overflow, three viewports |
| 6.4 | Scroll affordance where content continues | ✅ mask + visible scrollbar |
| 6.5 | Flight corridor clear of UI | ✅ objectives x440 → x28 |
| 6.6 | Flavour messages reach the player | ✅ 3 → 12 distinct per run |
| 6.7 | No icon name rendered as text | ✅ `iconGlyph` cannot emit its key |
| 6.8 | No empty icon slots | ✅ `menuIconSm` never returns `""` |
| 6.9 | **No text overlaps another text node** | ⚠️ **8 → 6 pairs. Cause of the last 6 not isolated.** |
| 6.10 | Bird catalog reachable | ✅ moved above five promo panels |
| 6.11 | Trails work | ❌ **Not reproduced.** 15 cards, valid gradients. Need a repro |
| 6.12 | Every timer carries an icon | ✅ |
| 6.13 | Terrain readable at dusk | ✅ contrast floor, 1.9:1 min |
| 6.14 | No tofu glyphs | ⚠️ Risky code points removed; container font set is not a device font set |

---

## 7. Accessibility

| # | Check | State |
|---|---|---|
| 7.1 | Tap targets ≥ 44 px | ✅ zero violations at 640×360, 390×844, 844×390 |
| 7.2 | ESC pauses and resumes | ✅ |
| 7.3 | Visible focus ring everywhere | ✅ extended to flight HUD |
| 7.4 | `prefers-reduced-motion` honoured | ✅ |
| 7.5 | Text contrast ≥ 4.5:1 | ⚠️ HUD guarded; menus not swept |
| 7.6 | Screen-reader pass | ❌ Not done |

---

## 8. Product decisions — deliberately **not** taken unilaterally

These are real violations of Poki's own UX guidance. They are open because
they change what a player sees first and how they reach the shop and the
season pass. That is your call, not a stylesheet's.

- **Home: 20 destinations → ≤ 6.** Gate the checklist and both banners behind
  "has flown once"; collapse nine meta destinations behind "More".
- **Pause: 12 controls → 6.** Keep flying / Restart / Exit / Sound / Settings /
  Fullscreen. Ten side-doors out of pause are ten paths that are not "back
  into gameplay", which is the exact condition Poki attaches to
  `commercialBreak()`.
- **Menu backdrop** is dead space; the attract bird reads as a blob at 1280×720.
- **Space to resume from pause.** Space is the dive key; accepting it needs a
  short input lockout so the resume press does not also dive.

---

## 9. Assertions that were changed — full disclosure

A green gate means nothing if the bounds moved to meet it. Every bound that
moved, and why:

| Test | Was | Now | Why |
|---|---|---|---|
| `ad-gate` / `ad-surfaces` (3 tests) | required `ad-skip` to exist and be permitted | asserts it is gone | They encoded the old contract: a placeholder break had no self-exit, so skipping *was* the intended exit. Rewritten, not deleted. |
| `performance` hillScale | ≤ 1.32 | ≤ 1.56 | 1.32 was the old asymptote — the exact ceiling the work exists to raise. Step bound (0.03) untouched. |
| `performance` rhythmScale | ≤ 1.24 | ≤ 1.41 | Same. |
| `hud-layout` toast | newest evicts incumbent | incumbent keeps slot, deferred still arrives | Encoded the eviction that made flavour text unreadable. |
| `css-tokens` colour ratchet | — | **not moved** | Caught this work adding 7 one-off hex values. All replaced with tokens; baseline held. |
| `flight-ceiling` star band | — | **not moved** | Refused a 230/45 ceiling that would have made stars uncollectable. It was right. |

---

## 10. Before submitting — blockers

1. ❌ **Thumbnails** (2.17) — static and animated. Hard submission requirement.
2. 🔒 **Rewarded video on a real portal build** (3.10, 3.11).
3. 🔒 **Frame pacing on a mid-range Android.** Every number here came from
   SwiftShader software rasterisation (4.5–8.8 fps) — that is the rasteriser,
   not the game, and **no performance claim should be made from it**.
4. ⚠️ **Text overlap** (6.9) — 6 pairs remain.
5. ❌ **Trails** (6.11) — needs a reproduction.
6. 🔒 **Human feel pass** on the flight model (4.9).

---

## 11. Standing constraints

- **PvP and the 40-strong AI rival field are never cut.** All 8 PvP modes stay.
  Performance work may change how rivals are *drawn*, never how many exist.
  Guarded by `pvp-and-ai-intact.test.ts`.
- `design-polish.css` ships **zero `!important` declarations**. It wins by
  cascade position and by matching specificity.
  Verify — note the regex, not a bare `grep -c`, because the sheet's own
  comment discusses the rule and a plain count returns 1 for that prose:
  ```sh
  grep -cE '^[^/*]*[a-z-]+:[^;]*!important' src/game/design-polish.css   # → 0
  ```
  (`menu-polish.css` carries 1,491 for comparison; `index.css` and `ui.css`
  are both at their documented caps and may only shrink.)
- `design-polish.css` is imported from `main.tsx`, **not** `@import`-ed at the
  foot of `index.css` — CSS hoists `@import`, which would lose every tie.
- Colour is painted with palette tokens. The ratchet only goes down.
