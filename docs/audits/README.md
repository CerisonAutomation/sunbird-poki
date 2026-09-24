# Audits — dated evidence, not live guidance

Every file here is a snapshot: it records what was measured, on which tree, on
which date, and what was done about it. `pnpm docs:audit` fails if one of these
loses its `Status:` line, because a snapshot without a status is how stale
guidance survives next to the truth.

For **live** status use the generated docs instead:
[`../poki/COMPLIANCE.md`](../poki/COMPLIANCE.md) (`pnpm poki:audit`),
[`../../ROADMAP.md`](../../ROADMAP.md) (real vs written vs fiction),
[`../HANDOFF.md`](../HANDOFF.md) (current state + next queue).

| Snapshot | Date | Status | Still cited for |
| --- | --- | --- | --- |
| [`PRODUCTION_100X_POLISH_2026-09-24.md`](./PRODUCTION_100X_POLISH_2026-09-24.md) | 2026-09-24 | Done — adaptive perf tiers, mission skip, island progress, nest growth | 100× polish vs Tiny Wings/Jetpack/Alto: terrain chunkRes adaptive, collectible pools lite/mid/high, skip-goal for coins, island progress bar, nest visual growth |
| [`PROGRESSION_FEEL_2026-09-24.md`](./PROGRESSION_FEEL_2026-09-24.md) | 2026-09-24 | current evidence | Why progression did not *feel* real despite nine ladders: the flight HUD drew one goal of three, and two `max-height: 500px` queries deleted the strip entirely on phones in landscape. Research-grounded fix (three ranked goals + career rung + one next action, then a mid-flight rank-up banner, live quest pops, and beat-this flags standing in the world), cited by `flight-goal-strip.test.ts` and `missions-live.test.ts` |
| [`BRUTAL_REPO_AUDIT_2026-09-24.md`](./BRUTAL_REPO_AUDIT_2026-09-24.md) | 2026-09-24 | current evidence | Whole-repo measured audit: `Game.ts` at 0.52 % coverage, the 25-spec browser layer that has never run here, the CSS override war (1,492 `!important`, 973 hex colours), three server API namespaces, analytics built but never fed, and §9 self-critique of this session's own commits — cited by `hud-injection.test.ts` |
| [`MUSIC_AND_HUD_CRITIQUE_2026-09-24.md`](./MUSIC_AND_HUD_CRITIQUE_2026-09-24.md) | 2026-09-24 | current evidence | Music findings M-1…M-7 and HUD contrast findings H-1…H-2, cited by `music-harmony.test.ts` and `hud-contrast.test.ts` |
| [`POKI_COMPLIANCE_AUDIT.md`](./POKI_COMPLIANCE_AUDIT.md) | 2026-09-22 | historical evidence | Fix log F1–F8 and submission actions C1–C13, cited as evidence by `../poki/requirements.json` |
| [`RESILIENCE_AUDIT.md`](./RESILIENCE_AUDIT.md) | 2026-09-22 | historical evidence | Reliability scorecard (outbox, circuit breakers, crash recovery) with code/test citations |
| [`MOBILE_TOUCH_AUDIT.md`](./MOBILE_TOUCH_AUDIT.md) | 2026-09-20 | resolved | The measurement method: real Chromium over CDP touch events, A/B by reverting source |
| [`ORIENTATION_AUDIT.md`](./ORIENTATION_AUDIT.md) | 2026-09-20 | resolved | Portrait/landscape, split-screen and rotation findings |
| [`ZENITH_TRUTH_MAP.md`](./ZENITH_TRUTH_MAP.md) | 2026-09-18 | historical evidence | Phase Zero repository truth map at commit `a9666a1` |
| [`CONSOLIDATION_AUDIT.md`](./CONSOLIDATION_AUDIT.md) | 2026-09-15 | historical evidence | Deployment and migration limits, referenced by [`SOCIAL_API.md`](../../SOCIAL_API.md) |
| [`FLIGHT_PERFORMANCE_AUDIT.md`](./FLIGHT_PERFORMANCE_AUDIT.md) | 2026-09-15 | historical evidence | Loading path, terrain loop, camera, rendering and audio findings |
| [`MENU_UX_AUDIT.md`](./MENU_UX_AUDIT.md) | 2026-09-15 | superseded | Menu-system findings; structure since changed |
| [`PRODUCTION-GAP-ANALYSIS-2026-09.md`](./PRODUCTION-GAP-ANALYSIS-2026-09.md) | 2026-09-14 | superseded | Portal/leaderboard/Rust gap list; the live register is [`PRODUCTION_READINESS_PLAN.md`](../../PRODUCTION_READINESS_PLAN.md) |
| [`EXPERIENCE_QUALITY_PASS.md`](./EXPERIENCE_QUALITY_PASS.md) | undated | historical evidence | Shop, flight-loop and live-race quality rationale (illustrated navigation, 23-illustration SVG family) |
| [`PR_VALIDATION.md`](./PR_VALIDATION.md) | undated | superseded | Branch validation note for a tree that has since moved on |

## Why these are kept at all

Three reasons, in descending order of usefulness:

1. **Evidence citations.** `../poki/requirements.json` points at specific fix-log
   entries here; deleting them would make the generated compliance report cite
   nothing.
2. **Method.** `MOBILE_TOUCH_AUDIT.md` and `RESILIENCE_AUDIT.md` document *how*
   something was measured (CDP touch dispatch, A/B by reverting source, scored
   only from code citations). That method is worth more than the findings, which
   are all either fixed or obsolete.
3. **Provenance.** When a future change reverses one of these decisions, the
   snapshot says what was known at the time — which is the difference between
   "this was a mistake" and "this was a trade".

Anything here that has stopped being useful for all three goes to
[`../archive/`](../archive/), and anything in the archive that stops being useful
for provenance gets deleted: git keeps the bytes either way.
