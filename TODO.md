# Sunbird Poki — Visual Critique Fix List

Items identified in `/critique` audit. Fix one per ralph iteration.

## Remaining Issues

- [x] **Locale mixing** — Audit HUD.ts pause screen strings ("Keep flying", "Restart flight", "Exit to menu", "Global Board", "My Scores") and ensure they use t() with barrel keys OR confirm English-only intent and document it. Check translations.barrel.json for coverage gaps on HUD-critical strings.

- [x] **Multiplier tag legibility** — The `×2.0` multiplier readout in the flight HUD is too small. Find the `.mult` or `.multEl` element in HUD.ts and increase its visual weight (font-size, contrast, or bold treatment) so it's readable during active flight.

- [x] **Rank ladder context** — "egg Fledgling · 968" shows no ceiling. Add a rank progress hint to the rank-card on the progress screen and/or the rank hero screen — e.g. "968 / 1,200 to Sparrow" so players know where they stand.

- [x] **Shop: separate Today's Offers from catalog** — The shop opens with Daily Stipend / Watch Ad / Flash Sale / equipped bird / bundle / vault all in one scroll before the actual catalog. Add a clear `<div class="section-title">` separator before the catalog section (Birds/Boosts/Trails) so offers and browsing are visually distinct zones.

- [x] **Back button contrast** — verified: #2a1c28 on parchment = ~12:1, no fix needed — The `‹` back button in `.screen-head` is hard to see against warm card backgrounds. Check its color in menu-polish.css and increase contrast to at least 3:1 against the parchment background.

- [x] **Flight HUD: distance label always white** — hud-contrast.test.ts 10/10 passing — Confirm `.stat-value` and `.stat-label` still render white (not overridden by any recent CSS changes). Run hud-contrast.test.ts in isolation and verify it passes. If not, fix the cascade.

- [ ] **Remove duplicate "Personalize" destinations from quick-strip** — The quick-strip has "Shop" and "Settings" buttons that duplicate the Personalize section grid below. Consider replacing "Shop" and "Settings" in the strip with "Goals" and "Leaderboard" to make the strip complement rather than duplicate the grid, OR add visual differentiation (strip = shortcuts, grid = full nav). Document the intent in a CSS comment.

- [ ] **`×` multiplier inline SVG size** — In the flight HUD, the multiplier combo element uses menuIcon or a text glyph. Verify it renders cleanly at the intended size and is not cropped or oversized.

## Completion
- [ ] ALL_TASKS_COMPLETE
