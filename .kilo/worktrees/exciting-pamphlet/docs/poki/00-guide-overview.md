# Developer Guide — overview

Source: <https://developers.poki.com/guide>

The guide is the entry point for web game development on Poki: the platform's
expectations, the tooling, and the differences between shipping on the web and
shipping on app stores. It frames everything that follows in the other pages.

## Extracted rules

| ID | Kind | Rule |
|---|---|---|
| `GK-01` | recommendation | Web games share similarities with other platforms but require specific best practices to succeed. Focus first on (a) choosing an appropriate web game engine and (b) understanding player-hardware insights so the build stays compatible and performant. |
| `GK-02` | recommendation | Success on the web depends on three things above all: **fast onboarding flows**, **high engagement strategies**, and **localization** to reach a global audience. |
| `GK-03` | recommendation | Integrate monetization early in the development process rather than bolting it on at the end — early integration is what lets rewarded placements feel natural at the right moments. |
| `GK-04` | recommendation | Make thumbnails impactful: they are what attracts players to the game in the first place (see `06-thumbnail.md`). |
| `GK-05` | informational | The developer guide's purpose is to offer best practices and serve as a starting point for creators optimising games for the web environment. |

## Development tools the guide points at

Poki ships a suite of development tools intended to help creators throughout the
web development journey and to streamline launching and improving a game
(see `08-game-dev-tools.md` — Inspector, Netlib, AUDS).

## What this means for Sunbird

- `GK-01` → engine choice is documented as a deliberate decision, not a default:
  see `REBUILD_REPORT.md` §"Engine decision" and `01-web-game-engines.md`.
- `GK-02` → onboarding (3-step play-signal tutorial), engagement (daily
  challenges, streaks, season pass, cups), and localization (12 locales,
  browser-language detection) are all first-class systems, not extras.
- `GK-03` → the rewarded placement lives inside the game loop (the continue
  prompt after a crash), not in a bolted-on menu; measurement events
  (`button`/`visible`/`interact`) ship with it.
- `GK-04` → `assets/submission/` holds spec-checked thumbnails and
  `scripts/verify-thumbnail.mjs` gates them.
