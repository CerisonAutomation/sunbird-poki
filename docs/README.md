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
| Know which translation debt is left | [`i18n-debt.json`](./i18n-debt.json) (written by `pnpm i18n:audit`) |
| Read the evidence behind a past decision | [`audits/README.md`](./audits/README.md) |

## Canonical

| Doc | Owns |
| --- | --- |
| [`README.md`](../README.md) | What the game is, how to run it, the command table |
| [`ROADMAP.md`](../ROADMAP.md) | Real / written-but-undeployed / fiction — the honesty ledger |
| [`HANDOFF.md`](./HANDOFF.md) | Current state, standing decisions, verification chain, next queue |
| [`BENCHMARKS.md`](./BENCHMARKS.md) | Category comparison: what the best games do, what Sunbird adopted, what it exceeds |
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
| [`../rust/README.md`](../rust/README.md) | The authoritative realtime server (protocol, rooms, anti-cheat) |

## Generated — do not hand-edit

| Artefact | Regenerate with | Source of truth |
| --- | --- | --- |
| [`poki/COMPLIANCE.md`](./poki/COMPLIANCE.md) | `pnpm poki:audit` | [`poki/requirements.json`](./poki/requirements.json) |
| [`poki/CSP_REQUEST.md`](./poki/CSP_REQUEST.md) | `pnpm gen-csp` | `src/game/legal.edition.poki.ts` |
| `public/privacy.html` | `pnpm gen-legal` | `src/game/legal.edition*.ts` + `composePolicy()` |
| [`i18n-debt.json`](./i18n-debt.json) | `pnpm i18n:audit -- --bless` | `scripts/audit-i18n.mjs` scan |
| `src/i18n/packs/*.json` | `node scripts/gen-i18n-packs.mjs` | `src/i18n/translations.barrel.json` |

## Snapshots — evidence, not guidance

* [`audits/`](./audits/) — 15 dated audits. Each carries a `Status:` line saying
  whether its findings were resolved, and what replaced it for live status.
* [`archive/`](./archive/) — 11 superseded or parked documents (old extracts,
  one-shot agent prompts, a migration plan whose premise is now false, and the
  non-Poki backlog parked on 2026-09-23). Kept for provenance.

## Verification chain

```bash
pnpm gate          # lint · audit:ui · i18n:audit · docs:audit · typecheck (client+server)
                   # · 1,781 unit tests · 48 server tests · verify:prod · build:portals
                   # · verify:portals · audit:zips · verify:upload · verify:thumbnail
                   # · isolation:check · policy/artifact/mobile e2e
pnpm verify:csp      # the built dist-poki bundle vs the CSP request (inside verify:portals)
pnpm poki:preflight  # the portal half of the gate, ending in a live poki:audit --run
pnpm poki:audit      # 131 extracted rules → 116 satisfied / 5 human actions / 10 informational
```

Numbers as of 2026-09-24: **1,781 unit tests** across 134 files (+48 server),
**36 locales × 154 barrel keys** with 100% pack coverage and **312** literal
player-facing strings still untranslated (ratcheted, only allowed to fall —
it was 363 before the first two toast batches; the celebration strip removed ten
by replacing literal run-end toasts with translated beats; batch 3 took all 17
screen titles and the back-button label, so the `screenTitle` category is zero),
**three portal zips** —
poki 940 KB, crazy 927 KB, generic 925 KB — all passing the forbidden-string and
foreign-portal-marker gates. The three
Playwright stages of `pnpm gate` need browser binaries; in a sandbox that cannot
download them they fail on environment, not on code, and CI runs them for real.
