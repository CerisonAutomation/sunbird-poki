---
active: false
iteration: 1
max_iterations: 8
completion_promise: null
---

# Sunbird 150/100 Visual Quality Loop

## Objective
Iteratively improve the menu, flight HUD, bird readability, terrain presentation,
music feedback, onboarding, and Poki-facing UX using the current live build as the
visual baseline.

## Completion Criteria
Complete when TODO.md shows [x] ALL_TASKS_COMPLETE.

## Verification Commands
- `pnpm vitest run src/game/__tests__/hud-contrast.test.ts src/game/__tests__/flight-moments.test.ts`
- `pnpm audit:ui`
- `pnpm poki:audit -- --run`
- `pnpm build:poki && pnpm verify:upload`
- `git diff --check`

## Loop Rules
- Preserve the existing flight physics and portal contracts.
- Inspect the current browser menu and flight HUD before each visual edit.
- Prefer reusable tokens and existing HUD lanes over one-off decoration.
- Stop if a change worsens focused tests, accessibility, or readability.
