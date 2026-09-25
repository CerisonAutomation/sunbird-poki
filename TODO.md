# Sunbird Poki — /simplify Autopilot

Simplification opportunities found by whole-codebase audit. One per iteration.

## HUD.ts

- [x] **`(s.pvpModes || [])` redundant guards** — `pvpModes` is typed `ModeDef[]` (non-optional), so `|| []` is unnecessary defensive code. Remove all 3 instances and the `(s.pvpWorlds || [])` instances too.

- [ ] **Inline `s.pvpModes.find(...)` at line 2181** — The AI flock button re-runs `.find()` inline even though `activeMode` already holds the result. Replace with `activeMode.name`.

- [ ] **`SocialSystem.ts` 170-char single-line methods** — `currentWeekKey()` (line 169) and `dateSeedDaysLater()` (line 170) are unreadable single-liners. Break into multi-line for maintainability.

- [ ] **`renderProgress` section titles: repeated inline `<small>` pattern** — Several section headers repeat `<div class="section-title">X <small>Y</small></div>`. Extract a helper `sectionTitle(main, sub)` to deduplicate.

## Game.ts

- [ ] **`Array.from({ length: v.steps }, (_, i) => ...)` at line 2628** — Verbose factory pattern for a pip string. Replace with a simpler approach: `"●".repeat(v.step) + "◉" + "○".repeat(v.steps - v.step - 1)`.

- [ ] **Repeated `this.save.state.rival` access** — In `rivalCard()` and nearby code, `this.save.state.rival` is accessed 4+ times. Cache as a local `const r = this.save.state.rival` (already done in `rivalCard` — check that the pattern is consistent in the snapshot assembly too).

## Economy.ts

- [ ] **`Economy.ts` — check for repeated computation patterns** — Audit for any duplicated price/reward calculations that could be extracted.

## Completion
- [ ] ALL_TASKS_COMPLETE
