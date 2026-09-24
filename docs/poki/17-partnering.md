# Partnering, curation & what Poki looks for — extracted reference

Sources: `developers.poki.com/guide/working-with-poki`, `/guide/what-we-look-for`,
`/guide/revenue-deal-types`, `/guide/release-process`, `/guide/post-release-updates`

## Working with Poki

| ID | Kind | Rule |
|---|---|---|
| `PAR-01` | informational | Poki curates: not every game fits, and submission is a conversation. |
| `PAR-02` | informational | **Web exclusivity** is the trade for the marketing, QA and user-acquisition work: the same game may not be published on other web portals or aggregators. Steam, app stores and consoles are unaffected. |
| `PAR-03` | informational | Revenue: 100 % to the developer for players arriving directly (bookmarks, search, social, own community); 50/50 for players Poki brings in. |
| `PAR-04` | informational | Free platform tooling: the **Inspector** (requirement QA), **Netlib** (multiplayer transport), **AUDS** (backend storage). |

## What we look for

| ID | Kind | Rule |
|---|---|---|
| `PAR-05` | informational | The three baseline signals are **quality** (UX/feel and the core loop), **player fit** (would this audience enjoy it), and **tech** (mobile + desktop optimisation: load time, stable frame rate, lean file size). |
| `PAR-06` | recommendation | Beyond those: **originality**, **depth and replayability**, a strong **first impression** (clear thumbnail, immediately playable opening), **cross-device feel** (thumb as good as mouse — the audience is majority mobile), and **room to grow** (hooks and systems that support updates). |
| `PAR-07` | informational | None of the signals is a pass/fail checklist; exceptional strength in one can offset weakness in another. Real player testing is the surest read. |

## Release process

| ID | Kind | Rule |
|---|---|---|
| `PAR-08` | informational | After a passed final review: agreement, legal, QA, Soft Release, then Global Release (roughly 2–3 months). |
| `PAR-09` | informational | Soft Release uses invite-only or limited traffic; Global Release adds full promotion. Post-release updates are expected and are how a live game keeps its numbers. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `PAR-02` | The Poki build is a separate artifact (`pnpm build:poki`) from the standalone/itch/CrazyGames builds, and the portal corpora keep each platform's requirements in its own edition folder, so the web-exclusivity question is a build-and-publish decision, not a code fork. |
| `PAR-05`, `PAR-06` | Tech: 1.78 MB single-file build, adaptive quality tiers driven by a measured device profile, 15 Hz net code, and a real progress bar on the loading shell. First impression: the Poki build boots into a one-screen name confirmation that is pre-filled with a generated call sign, so "Let's Fly" is a single tap and typing is optional; crazy/generic skip the screen and keep the curated name. Depth: 30 tracks, seasons, wings, daily goals, endless/solo/race modes. |
| `PAR-08`, `PAR-09` | `docs/poki/COMPLIANCE.md` + `REBUILD_REPORT.md` are the change log for what each release pass touched, so a post-release update can be justified to the platform in the same language its guide uses. |
