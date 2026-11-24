# Documentation index

Start with the [project README](../README.md) for setup and the [engineering handoff](./HANDOFF.md) for current priorities and release limitations. Dates and assertions in older documents describe the tree at the time they were written; do not treat a historical pass or approval as current evidence.

## Working references

- [Poki guide notes and rule inventory](./poki/README.md) · [implementation matrix](./POKI_IMPLEMENTATION_MATRIX.md) · [Poki data store](./AUDS.md)
- [Poki upload](./poki/UPLOAD.md) · [CLI](./poki/POKI_CLI.md) · [generated compliance report](./poki/COMPLIANCE.md) · [CSP request](./poki/CSP_REQUEST.md)
- [AI and engineering rules](../AI_RULES.md) · [roadmap](../ROADMAP.md) · [version notes](./VERSIONS.md)
- [Deployment](../DEPLOY.md) · [portal publishing](../PORTAL_PUBLISHING.md) · [submission checklist](../SUBMISSION_CHECKLIST.md) · [deployment checklist](./DEPLOYMENT_CHECKLIST.md) · [production checklist](./PRODUCTION_CHECKLIST.md)
- [Leaderboard API](../LEADERBOARD_API.md) · [social API](../SOCIAL_API.md) · [multiplayer/social notes](./multiplayer-social-audit.md)
- [Legal and security](../LEGAL_SECURITY.md) · [production readiness plan](../PRODUCTION_READINESS_PLAN.md)

## Research and historical evidence

These are prior snapshots, not current release guarantees: [benchmarks](./BENCHMARKS.md), [comparative review](./COMPARATIVE_REVIEW_360.md), [game review](./SUNBIRD_REVIEW_360.md), [release verdict](./RELEASE-VERDICT.md), and [Poki verification](./POKI_COMPLIANCE_VERIFICATION_2026-10-06.md). The [audit index](./audits/README.md) and [archive index](./archive/README.md) retain cited decisions and older notes.

## Generated data

- [`i18n-debt.json`](./i18n-debt.json): narrow source-pattern ratchet, updated with `pnpm i18n:audit -- --bless` when genuine debt falls. It does not measure all untranslated copy.
- `public/i18n/*.json` and `src/i18n/pack-keys.json`: generated from `src/i18n/translations.barrel.json` with `node scripts/gen-i18n-packs.mjs`.
- The compliance and CSP reports are generated from the corresponding audit tools. Re-run checks against the current artifact; their presence alone is not proof of compliance.

`pnpm docs:audit` checks internal links, indexed documents, historical status headers and the machine-readable inventory below. Test declarations are a source scan, not the number of executed or passing tests.

<!-- canonical-claims
tests: 2928
testFiles: 240
barrelKeys: 628
locales: 36
nonEnglishCells: 21980
englishCells: 1375
audits: 21
archive: 11
-->
