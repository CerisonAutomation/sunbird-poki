# Poki Developer Guide — extracted corpus

**Extracted:** 2026-09-17 · **Sources:** the public Poki developer guide at `developers.poki.com`
**Purpose:** the canonical, machine-checkable spec this repository builds against.

This folder is the *extracted form* of the Poki developer guide, rewritten as a
page-per-topic corpus of numbered, testable rules. It exists so that:

1. every rule the platform states has a stable ID (`EA-04`, `MON-11`, …) that code,
   tests, and PRs can cite;
2. the build can be **audited automatically** — `docs/poki/requirements.json` maps
   each rule to a verification method, and `pnpm poki:audit` executes them and writes
   [`COMPLIANCE.md`](./COMPLIANCE.md);
3. the rebuild decisions made from this spec are traceable — every change landed
   from this extraction is listed in [`REBUILD_REPORT.md`](./REBUILD_REPORT.md).

## Provenance & extraction method

Content was extracted from the guide's rendered pages and de-duplicated into rules.
Where the guide states something the platform **requires** (enforced by the Poki
Inspector or by review) the rule is marked `requirement`; where the guide advises,
it is marked `recommendation`; platform/business facts with nothing to implement are
marked `informational`. Extraction is lossy in one direction only — nothing that
carries an obligation was dropped.

| Source page | Extracted into |
|---|---|
| `developers.poki.com/guide` (Developer Guide overview) | [`00-guide-overview.md`](./00-guide-overview.md) |
| `developers.poki.com/guide/web-game-engines` | [`01-web-game-engines.md`](./01-web-game-engines.md) |
| `developers.poki.com/guide/easy-access` | [`02-easy-access.md`](./02-easy-access.md) |
| `developers.poki.com/guide/engagement` | [`03-engagement.md`](./03-engagement.md) |
| `developers.poki.com/guide/monetization` | [`04-monetization.md`](./04-monetization.md) |
| `developers.poki.com/guide/localization` | [`05-localization.md`](./05-localization.md) |
| `developers.poki.com/guide/thumbnail` | [`06-thumbnail.md`](./06-thumbnail.md) |
| `developers.poki.com/guide/player-device-report` | [`07-player-device-report.md`](./07-player-device-report.md) |
| `developers.poki.com/guide/game-dev-tools` | [`08-game-dev-tools.md`](./08-game-dev-tools.md) |
| `developers.poki.com/guide` (requirements, policies, events, release) | [`09-platform-requirements.md`](./09-platform-requirements.md) |
| `developers.poki.com/guide/sdk-html5` | [`10-sdk-html5.md`](./10-sdk-html5.md) |
| `developers.poki.com/guide/sdk-overview` | [`11-sdk-events.md`](./11-sdk-events.md) |
| `developers.poki.com/guide/game-events` | [`12-game-events.md`](./12-game-events.md) |
| `developers.poki.com/guide/netlib` | [`13-netlib.md`](./13-netlib.md) |
| `developers.poki.com/guide/auds` | [`14-auds.md`](./14-auds.md) |
| `developers.poki.com/guide/accounts` | [`15-user-accounts.md`](./15-user-accounts.md) |
| `developers.poki.com/guide/adding-your-game`, `/external-resources-policy`, `/content-player-safety`, `/player-fit-test`, `/web-fit-test`, `/final-review`, `/inspector` | [`16-submission.md`](./16-submission.md) |
| `developers.poki.com/guide/working-with-poki`, `/what-we-look-for`, `/revenue-deal-types`, `/release-process` | [`17-partnering.md`](./17-partnering.md) |

## Files

| File | What it is |
|---|---|
| `00-guide-overview.md` … `17-partnering.md` | The extracted guide, one page per topic, every rule numbered |
| [`requirements.json`](./requirements.json) | Machine-readable rule list: `id`, `section`, `kind`, `rule`, `verify`, `evidence`, `status` |
| [`COMPLIANCE.md`](./COMPLIANCE.md) | **Generated** — the audit result per rule (`pnpm poki:audit`) |
| [`REBUILD_REPORT.md`](./REBUILD_REPORT.md) | What this extraction changed in the game, why, and the evidence |
| [`SUBMISSION.md`](./SUBMISSION.md) | The Poki for Developers dashboard sheet: title, thumbnail, categories, engine, description, privacy URL, integrations, CSP requests |

## Using the spec

```bash
pnpm poki:audit        # run every automated rule check, rewrite COMPLIANCE.md, exit non-zero on failure
pnpm build:portals     # produce sunbird-poki.zip / -crazy.zip / -generic.zip + the generated poki-upload/
pnpm upload:poki       # build Poki only + prove the Inspector can accept the folder (see UPLOAD.md)
pnpm verify:upload     # the Inspector-shaped gate: root index.html, fresh, uploadable files only
pnpm verify:portals    # the shippability gate on those zips (Poki size/asset/external-URL rules)
```

Rule IDs are cited in code comments (e.g. `// Poki EA-04: keep it small`), in test
names, and in `requirements.json` `evidence` fields, so a reviewer can walk from a
platform sentence to the line of code that honours it.

## Scope note

The guide describes the whole platform (engines, portals, business terms). Only the
parts that bind *this* game are implemented here. Engine-comparison material
(`01-web-game-engines.md`) is kept because it documents why Sunbird is built as a
hand-rolled Three.js game with a procedural asset pipeline — the "purpose-built for
web" branch of the guide's own decision tree — and because it is the reference that
justified the mobile-web optimisation targets in `02-easy-access.md`.
