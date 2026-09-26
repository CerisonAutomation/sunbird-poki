# Sunbird Poki — Expert Findings Fix Loop (Round 3)

Fix verified defect findings from the 5-expert fan-out (design, compliance,
bugs, perf, a11y). Improvements/balance speculation stays out; only defects
with file:line evidence get fixed. Zero behavior change except where the
current behavior is the bug.

## Tasks

- [x] **Portal continue double-grant** — `continueWithPortalReward`: in-flight
  guard + post-await `state === "ad"` check + `continuesUsed < max` re-check.
- [x] **parseSocial shape trust** — filter corrupt array elements, fall back to
  `emptySocialState()` fields.
- [x] **SaveData negatives** — clamp currency/record fields `>= 0` at import.
- [x] **Second Wind CTA role** — wrapper `div[role=status]` + plain inner
  button; update `second-wind-countdown.test.ts:33`.
- [x] **Toasts aria-live** — `role="status"` on toasts layer.
- [x] **Focus-trap selector** — reuse `ACTIVATABLE`; inert covers copy dialog.
- [x] **Tap-mode verbs post-tutorial** — `FlightGuidance.terrainCue` honors
  tapMode like `FirstFlight.view` does.
- [x] **TERMS_URL derivation** — path-segment replace, not `.html` assumption.
- [x] **Duel forfeit floor** — drop `runTime > 3` gate in `goToMenu`.
- [x] **Tournament lower-tier forfeit** — grant all unclaimed tiers ≤ reached.
- [x] **Full proof** — typecheck, tests, lint, build all green.

## Completion
- [x] ALL_TASKS_COMPLETE
