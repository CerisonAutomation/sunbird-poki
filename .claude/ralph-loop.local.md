---
active: true
iteration: 0
max_iterations: 25
completion_promise: null
---

# Sunbird Poki — Whole-Codebase /simplify Loop

## Objective
Simplify code throughout the codebase: remove redundant guards, collapse
repeated expressions into variables, shorten verbose patterns, remove dead
defensive code. One focused simplification per iteration — no scope creep.

## Completion Criteria
Complete when TODO.md shows [x] ALL_TASKS_COMPLETE

## Verification Commands
- `cd /Users/cb/Downloads/sunbird-poki && npx vitest run --reporter=dot 2>&1 | tail -5`
- `cd /Users/cb/Downloads/sunbird-poki && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l`
- Both must pass: 2035 tests passing AND 0 TS errors before marking any item complete

## Context
- Working directory: /Users/cb/Downloads/sunbird-poki
- Main UI file: src/game/HUD.ts (3800+ lines)
- Git remote: github — push with: git push github main

## Instructions Per Iteration
1. Read TODO.md for next unchecked item
2. Read relevant source before editing
3. Make the focused simplification
4. Run vitest + tsc
5. git add + git commit
6. Mark [x] in TODO.md
