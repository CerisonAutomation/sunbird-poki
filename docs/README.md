# Sunbird docs — start here

One canonical document per topic. Everything else is either **generated** (a
script writes it, so it cannot drift) or a **snapshot** (dated, statused, kept
as evidence — never as guidance).

That split is the whole system. The repo previously held 53 markdown files
(3.8 MB, 89% of it a single 3.4 MB git-diff dump named `HANDOFF.md`), with
point-in-time audits sitting beside canonical guidance, three documents
disagreeing about how many tests pass, and a Rust migration plan asserting the
Rust workspace did not exist while it shipped. `pnpm docs:audit`
([`scripts/audit-docs.mjs`](../scripts/audit-docs.mjs)) now fails the build on a
broken link, an orphan doc, a snapshot without a status line, or new top-level
markdown — so this stays true instead of being true once.

## I want to…

| … | Read |
| --- | --- |
| Understand what the game is and run it | [`README.md`](../README.md) |
| Know what is real vs written vs fiction | [`ROADMAP.md`](../ROADMAP.md) |
| Pick up the work mid-flight | [`HANDOFF.md`](./HANDOFF.md) |
| Know which version/build/protocol is which | [`VERSIONS.md`](./VERSIONS.md) |
| See how Sunbird compares to the best games in the class | [`BENCHMARKS.md`](./BENCHMARKS.md) |
| Ship a build to a host (Vercel/Netlify/static) | [`DEPLOY.md`](../DEPLOY.md) |
| Build + package a portal zip | [`PORTAL_PUBLISHING.md`](../PORTAL_PUBLISHING.md) |
| Submit to Poki, step by step, as a human | [`SUBMISSION_CHECKLIST.md`](../SUBMISSION_CHECKLIST.md) |
| Read Poki's rules as numbered, testable requirements | [`poki/README.md`](./poki/README.md) |
| Check Poki compliance right now (generated) | [`poki/COMPLIANCE.md`](./poki/COMPLIANCE.md) |
| Ask Poki for a custom CSP (generated) | [`poki/CSP_REQUEST.md`](./poki/CSP_REQUEST.md) |
| Upload with `poki-cli` | [`poki/UPLOAD.md`](./poki/UPLOAD.md) · [`poki/POKI_CLI.md`](./poki/POKI_CLI.md) |
| Wire the leaderboard or realtime backend | [`LEADERBOARD_API.md`](../LEADERBOARD_API.md) |
| Wire friends/clubs/chat | [`SOCIAL_API.md`](../SOCIAL_API.md) |
| Use Poki's Arbitrary User Data Store | [`AUDS.md`](./AUDS.md) |
| Check legal/privacy/security posture | [`LEGAL_SECURITY.md`](../LEGAL_SECURITY.md) |
| See the ops/service gap register | [`PRODUCTION_READINESS_PLAN.md`](../PRODUCTION_READINESS_PLAN.md) |
| Walk the pre-release checklist line by line | [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) |
| Know which translation debt is left | [`i18n-debt.json`](./i18n-debt.json) (written by `pnpm i18n:audit`) |
| Read the evidence behind a past decision | [`audits/README.md`](./audits/README.md) |

## Canonical

| Doc | Owns |
| --- | --- |
| [`README.md`](../README.md) | What the game is, how to run it, the command table |
| [`ROADMAP.md`](../ROADMAP.md) | Real / written-but-undeployed / fiction — the honesty ledger |
| [`HANDOFF.md`](./HANDOFF.md) | Current state, standing decisions, verification chain, next queue |
| [`BENCHMARKS.md`](./BENCHMARKS.md) | Category comparison: what the best games do, what Sunbird adopted, what it exceeds |
| [`../AI_RULES.md`](../AI_RULES.md) | Agent-facing rules for this codebase: stack, what is deliberately pure, which constraints are enforced by a test and which are conventions. Read before changing flight, portals or build output |
| [`SUNBIRD_REVIEW_360.md`](./SUNBIRD_REVIEW_360.md) | 11-reviewer critique (design, feel, HUD, a11y, perf, audio, balance, ops) with RICE + MoSCoW prioritisation |
| [`RELEASE-VERDICT.md`](./RELEASE-VERDICT.md) | Dated pre-upload verdict: what was fixed and what was still open when it was written |
| [`multiplayer-social-audit.md`](./multiplayer-social-audit.md) | Short note on where the multiplayer/social surface stands |
| [`DEPLOY.md`](../DEPLOY.md) | Hosting a build, env vars, edge functions |
| [`PORTAL_PUBLISHING.md`](../PORTAL_PUBLISHING.md) | The four `VITE_PORTAL_TARGET` builds and their monetization matrix |
| [`SUBMISSION_CHECKLIST.md`](../SUBMISSION_CHECKLIST.md) | Human walkthrough of a portal submission |
| [`PRODUCTION_READINESS_PLAN.md`](../PRODUCTION_READINESS_PLAN.md) | Service/ops gap register, verified against code |
| [`LEGAL_SECURITY.md`](../LEGAL_SECURITY.md) | Legal + security evidence register (EU-facing) |
| [`LEADERBOARD_API.md`](../LEADERBOARD_API.md) | Leaderboard + realtime wire contract |
| [`SOCIAL_API.md`](../SOCIAL_API.md) | Social server REST contract and auth model |
| [`COMPARATIVE_REVIEW_360.md`](./COMPARATIVE_REVIEW_360.md) | Deep engineering review vs netcode/mobile category standards |
| [`POKI_IMPLEMENTATION_MATRIX.md`](./POKI_IMPLEMENTATION_MATRIX.md) | Guide rule → implementation map (narrative companion to `poki/`) |
| [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) | Deploy-time checks (hosting side; portal side lives in `SUBMISSION_CHECKLIST.md`) |
| [`AUDS.md`](./AUDS.md) | Poki's Arbitrary User Data Store: contract, keys, failure modes |
| [`poki/`](./poki/) | The Poki developer guide extracted into 131 numbered rules + `requirements.json` |
| Parent monorepo's `rust/` workspace | The authoritative realtime server (protocol, rooms, anti-cheat). Not in this checkout — see the note at the top of the root README |

## Generated — do not hand-edit

| Artefact | Regenerate with | Source of truth |
| --- | --- | --- |
| [`poki/COMPLIANCE.md`](./poki/COMPLIANCE.md) | `pnpm poki:audit` | [`poki/requirements.json`](./poki/requirements.json) |
| [`poki/CSP_REQUEST.md`](./poki/CSP_REQUEST.md) | `pnpm gen-csp` | `src/game/legal.edition.poki.ts` |
| `public/privacy.html` | `pnpm gen-legal` | `src/game/legal.edition*.ts` + `composePolicy()` |
| [`i18n-debt.json`](./i18n-debt.json) | `pnpm i18n:audit -- --bless` | `scripts/audit-i18n.mjs` scan |
| `src/i18n/packs/*.json` | `node scripts/gen-i18n-packs.mjs` | `src/i18n/translations.barrel.json` |

## Snapshots — evidence, not guidance

* [`audits/`](./audits/) — 21 dated audits. Each carries a `Status:` line saying
  whether its findings were resolved, and what replaced it for live status.
* [`archive/`](./archive/) — 11 superseded or parked documents (old extracts,
  one-shot agent prompts, a migration plan whose premise is now false, and the
  non-Poki backlog parked on 2026-09-23). Kept for provenance.

<!-- canonical-claims
These numbers are measured from disk by `pnpm docs:audit` and must match it.
Adding a test file, a translation key or an audit means updating this block —
that is the point. Do not hand-edit the prose figures above without this.
tests: 2890
testFiles: 231
barrelKeys: 604
locales: 36
nonEnglishCells: 21140
englishCells: 635
audits: 21
archive: 11
-->

## Verification chain

```bash
pnpm gate          # lint · audit:ui · i18n:audit · typecheck · unit tests
                   # · verify:prod · build:poki · verify:portals · audit:zips
                   # · verify:upload · verify:thumbnail · isolation:check
                   # · policy/artifact/mobile e2e
pnpm verify:csp      # the built dist-poki bundle vs the CSP request (inside verify:portals)
pnpm poki:preflight  # the portal half of the gate, ending in a live poki:audit --run
pnpm poki:audit      # 131 extracted rules → 116 satisfied / 5 human actions / 10 informational
pnpm docs:audit      # doc link / orphan / snapshot-status gate (run separately)
```

Numbers as of 2026-10-04: **2,890 declared unit tests** across 231 files (the
live-socket suites that need a running room server are skipped in CI-less
sandboxes — the room server lives in the parent monorepo), **36 locales × 604
barrel keys** with 100% pack coverage and **635 of 21,140** non-English cells
still holding English — **3.0%**, down from 55% before the translation pass.
What remains is correct by design and will not be translated: the brand name
`Sunbird`, the mode/onomatopoeia names (`FRENZY`, `BOING`, `BONK`, `PERFECT`,
`RECORD`), acronyms (`AI PvP`), and cognates where the English word *is* the
native word (`Pilot` in de/tr/pl, `Shop` in de, `Account` in it/nl,
`Distance`/`Score` in fr).

The locale packs are **fetched, not bundled**. They were once `import.meta.glob`ed
into lazy chunks that `vite-plugin-singlefile` then inlined whole, so every
player downloaded all 36 locales to read one. They now ship as an `i18n/`
sidecar beside `fonts/` and `icons/` and load on demand, which is what lets the
game carry real translations and still ship at **2.07 MB** against a 2.50 MB
budget.

This fork builds the **Poki portal edition only** — there are no crazy/generic
zips. `src/game/edition.ts` is the Poki edition and `vite.config.ts` defines
`VITE_SELL_AD_REMOVAL` to false for every build, so the ad-removal upsell is
compiled out of the portal artifact entirely. The one Poki zip is **1,128 KB**.
The three
Playwright stages of `pnpm gate` need browser binaries; in a sandbox that cannot
download them they fail on environment, not on code, and CI runs them for real.
