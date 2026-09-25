---
active: true
iteration: 0
max_iterations: 30
completion_promise: null
---

# Sunbird Poki — Whole-Codebase Autopilot Loop (/sim)

## Objective
Systematically fix every TypeScript error, dead code warning, and code quality
issue found by `npx tsc --noEmit` across the whole codebase. Each iteration:
pick the highest-priority unfixed item from TODO.md, fix it, run tests to confirm
nothing broke, commit, mark done.

## Completion Criteria
Complete when TODO.md shows [x] ALL_TASKS_COMPLETE

## Verification Commands
- `cd /Users/cb/Downloads/sunbird-poki && npx vitest run --reporter=dot 2>&1 | tail -5`
- `cd /Users/cb/Downloads/sunbird-poki && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l`
- All 2035 tests must pass AND tsc must report 0 errors before marking any item complete

## Context
- Working directory: /Users/cb/Downloads/sunbird-poki
- Main UI file: src/game/HUD.ts (3800+ lines)
- Game logic: src/game/Game.ts
- Git remote: github (not origin) — push with: git push github main
- i18n: t(key, undefined, "fallback") — keys must exist in src/i18n/translations.barrel.json or barrel test fails

## Instructions Per Iteration
1. Read TODO.md to find the next unchecked item
2. Read the relevant source file(s) before editing
3. Make the fix — small, focused, no scope creep
4. Run: npx vitest run --reporter=dot 2>&1 | tail -5
5. Run: npx tsc --noEmit 2>&1 | grep "error TS" | wc -l (should decrease)
6. If tests pass: git add + git commit
7. Mark the item [x] in TODO.md
8. When all items are done: mark [x] ALL_TASKS_COMPLETE
