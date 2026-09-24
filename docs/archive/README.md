# Archive — history, not guidance

Superseded or dated documents, kept for provenance only. **Do not follow these.**
Each one carries a `Status:` line naming what replaced it; `pnpm docs:audit`
enforces that the line exists.

Live guidance starts at [`../README.md`](../README.md). Dated-but-still-cited
evidence lives in [`../audits/`](../audits/).

| Doc | Why it is here | Replaced by |
| --- | --- | --- |
| [`POKI_DOCS.md`](./POKI_DOCS.md) | Flat extract of the Poki developer guide (saved 2026-09-22), no rule IDs, nothing machine-checkable | [`../poki/`](../poki/) — the same corpus as 131 numbered rules + `requirements.json`, audited by `pnpm poki:audit` |
| [`RUST_MIGRATION_PLAN.md`](./RUST_MIGRATION_PLAN.md) | Written before the Rust workspace existed; its central premise ("no Rust backend exists") is now false | [`../../rust/README.md`](../../rust/README.md) + [`../../LEADERBOARD_API.md`](../../LEADERBOARD_API.md); the split is pinned by `pnpm isolation:check` |
| [`REPO_TRUTH_AUDIT.md`](./REPO_TRUTH_AUDIT.md) | Repository state as of M2 integration, with counts from that tree (212 tests; the suite is now ~1,400) | [`../../ROADMAP.md`](../../ROADMAP.md) + `pnpm gate` |
| [`GAME_AUDIT_2026-09.md`](./GAME_AUDIT_2026-09.md) | Competitive gap analysis vs top mobile/web titles plus its implementation log (2026-09-11) | [`../BENCHMARKS.md`](../BENCHMARKS.md) |
| [`ARCHITECTURE_REVIEW-tmultiworlds-2026-09.md`](./ARCHITECTURE_REVIEW-tmultiworlds-2026-09.md) | Review of an external Bevy/replicon proposal; the proposal was not adopted | [`../BENCHMARKS.md`](../BENCHMARKS.md) §3–4 for the multiplayer architecture that shipped |
| [`TINY_WINGS_SUCCESSOR_PROMPT.md`](./TINY_WINGS_SUCCESSOR_PROMPT.md) | The v9 master build prompt that specified the game as it now exists | the code, plus [`../BENCHMARKS.md`](../BENCHMARKS.md) §1 for what it got right |
| [`SUNBIRD_PORTAL_EDITION_PROMPT.md`](./SUNBIRD_PORTAL_EDITION_PROMPT.md) | Deprecated by its own header; written for the wrong game name (SKYBOUND) | `TINY_WINGS_SUCCESSOR_PROMPT.md` v9, itself archived |
| [`MVP-READY-145-PROMPT.md`](./MVP-READY-145-PROMPT.md) | One-shot execution prompt for an earlier agent pass, targeting a path on the author's laptop | [`../HANDOFF.md`](../HANDOFF.md) |
| [`TODO-ralph-loop-2026-09.md`](./TODO-ralph-loop-2026-09.md) | Completed task checklist from an automated iteration loop; every box ticked | [`../HANDOFF.md`](../HANDOFF.md) §5 for the live queue |
| [`GAME_BACKLOG_2026-09-23.md`](./GAME_BACKLOG_2026-09-23.md) | The non-Poki work queue as it stood when the project went Poki-only (i18n batches 3+, their bundle cost, funnel backend, music pass 3, file decomposition, locale proofing). Parked, not abandoned | [`../HANDOFF.md`](../HANDOFF.md) §5, which is Poki-only now; move an item back there when work on it resumes |

## The rule

A document belongs here when following it would produce the wrong result. A parked queue belongs here for the same
reason: it reads like the live one, and working from it would spend effort the
project has deliberately deferred. Prompt
dumps belong here even when harmless, because a prompt is an instruction to a
specific agent at a specific moment and reads like guidance to everyone else.

Deletion is also allowed: git keeps the bytes. These stay because they explain
*why* something was built the way it was, which the code no longer records.
