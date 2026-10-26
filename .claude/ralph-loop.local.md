---
active: false
iteration: 15
max_iterations: 15
completion_promise: null
---

# Sunbird Poki — Expert Findings Fix Loop (Round 3)

## Objective
Fix verified defect findings from the 5-expert fan-out (design, compliance,
bugs, perf, a11y). Improvements and balance speculation stay out; only
defects with file:line evidence get fixed. Zero behavior change except where
the current behavior is the bug. Same delegation-proof discipline as round 2:
read source + tests before editing, verify after each item.

## Completion Criteria
Complete when TODO.md shows [x] ALL_TASKS_COMPLETE

## Verification Commands
- `pnpm typecheck` → clean
- `pnpm test` → 1997 passed, 0 failed (count may shift only if dead-code tests are removed; never accept a NEW failure)
- `pnpm build` → succeeds
- `rg -n '^      case "' src/game/Game.ts | wc -l` → decreases each iteration

## Context
- Working directory: /Users/cb/Downloads/sunbird-poki
- Delegation pattern lives at top of `handleAction` (~line 3719)
- Sub-handlers live after `handleAction`, before `handleHotkeys`
- Do NOT commit (repo instructions outrank loop instructions)

## Instructions Per Iteration
1. Read TODO.md for next unchecked item
2. Read relevant source before editing
3. Check moved ranges for nested loops/switches first
4. Insert sub-handler, delete original, keep diff reviewable
5. Run typecheck + targeted tests, then full suite + build at the end
6. Mark [x] in TODO.md
7. Continue to next item
