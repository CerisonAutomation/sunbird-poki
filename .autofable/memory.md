# Autofable Memory — Sunbird

## Identity

repo_profile: { language: TypeScript, pkg_manager: pnpm@9.15.0, framework: "Vite + React + Three.js", test_runner: Vitest, linter: ESLint, styling: CSS, orm: null, monorepo: false, ci: Vercel, state_mgr: "local game state + SaveData", auth: null }
First encounter: 2026-09-15
Last session: 2026-09-15

## Decision Log

| Date | Task | Risk Score | Mode | Escalation | Outcome | Key Insight |
|------|------|-----------|------|------------|---------|------------|
| 2026-09-15 | Execute Autofable protocol and audit current repo | 6.0 | Mixed | None | Passed reconnaissance, verification, and production checks | Existing worktree has broad uncommitted product changes; preserve them and verify narrowly before delivery |

## Proven Patterns

| Pattern | Risk Profile | Recommended Mode | Verification Count |
|---------|-------------|------------------|-------------------|
| Audio/gameplay changes | cross-file, runtime timing, mobile browser behavior | Mixed | 1 |
| Vite/Vercel delivery | build and network side effects | Mixed | 1 |

## Risk Calibration

| Dimension | Last Score | Running Average | Adjustment |
|-----------|-----------|----------------|------------|
| Assumptions | 6 | 6 | Confirm runtime behavior in browser before claims |
| Unknowns | 5 | 5 | Read config and source before edits |
| Risk | 6 | 6 | Keep deploy separate from code verification |
| Complexity | 7 | 7 | Prefer bounded patches over broad rewrites |

## Assumption Bank

| Assumption | Evidence | Challenge Flag | Resolved |
|------------|----------|----------------|----------|
| The checkout is the intended Sunbird production source | Current branch is `main`; Vercel project and package metadata match Sunbird | Could be stale because many files are already modified | Resolved by current source reads, build, and production verification |
| A passing build is sufficient for delivery | Browser and targeted tests provide stronger evidence | Build alone would miss UI/runtime regressions | Rejected; used browser smoke verification and tests |
