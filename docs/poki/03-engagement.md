# Engagement — extracted rules

Source: <https://developers.poki.com/guide/engagement>

Retention on the web is earned in the first minutes and defended by goals,
feedback and pacing.

## Rules

| ID | Kind | Rule |
|---|---|---|
| `EN-01` | requirement | **Accessibility of input.** Ensure games are accessible by supporting both mouse and keyboard navigation. |
| `EN-02` | requirement | **Standardise controls:** use **WASD or arrow keys** for movement and the **space bar or return key** for primary menu actions. |
| `EN-03` | recommendation | **Clear goals.** In addition to short-term level goals, implement long-term objectives — unlocking new items, weapons, or characters. A clear progression path encourages players to keep playing for rewards. |
| `EN-04` | recommendation | **Tune the difficulty.** Balance with an increasing scale: start accessible so new players are not overwhelmed, then gradually introduce new mechanics and challenges so interest is maintained without frustration. |
| `EN-05` | recommendation | **Congratulate the player.** Celebrate milestones — confetti, celebratory sound, visual effects at the end of levels or on achievements — to build confidence and retention. |
| `EN-06` | recommendation | **Test it.** Use playtesting to validate design choices and find drop-off points. Analysing where players stop tells you whether they are struggling with difficulty or losing interest, which points to targeted fixes (rewards vs challenge). |

## How Sunbird applies this page

| Rule | Implementation | Evidence |
|---|---|---|
| `EN-01` | One-button play means the *entire* game is playable with mouse alone, keyboard alone, touch alone, or a gamepad. Every menu is a real DOM overlay with focus management and inert backgrounding, so keyboard and assistive tech work end to end. | `src/game/Input.ts`, `src/game/OverlayNavigation.ts`, `src/game/HUD.ts` |
| `EN-02` | Dive/primary gameplay action accepts **Space, WASD **and** arrow keys** (`Space`, `KeyA`, `KeyW`, `KeyS`, `KeyD`, `ArrowUp`, `ArrowDown`); the second local player uses **Enter/Return** (plus `KeyL`, `ShiftRight`); **Space/Return activate the primary menu action** of an open overlay even when focus sits on a heading. | `src/game/Input.ts`, `src/game/OverlayNavigation.ts`, `src/game/__tests__/input-ui.test.ts`, `src/game/__tests__/overlay-navigation.test.ts` |
| `EN-03` | Short-term: per-run distance/coins/medals. Long-term: 60+ skins with mechanical perks, trails, biomes, mastery tiers, missions, collections, season pass, weekly cups, ranked divisions. | `src/game/Economy.ts`, `src/game/Mastery.ts`, `src/game/Missions.ts`, `src/game/SeasonPass.ts`, `src/game/Tournaments.ts`, `src/game/pvp.ts` |
| `EN-04` | Mode difficulty ramps inside a run (speed/gravity/obstacle density) and across progression (campaign stages, mastery tiers, ranked divisions). Onboarding runs on forgiving terrain. | `src/game/Modes.ts`, `src/game/Campaign.ts`, `src/game/FlightProgression.ts` |
| `EN-05` | Confetti + jingle on personal bests, level-ups, chest opens and race wins; personal-best moments also trigger the portal's own celebration hook when one exists (`happyTime()` on Poki — capital T; the guide's prose spells it `happytime` and the SDK does not). | `src/game/Fx.ts`, `src/game/HudFeedback.ts`, `src/sdk/poki.ts` |
| `EN-06` | Drop-off is measurable: `session_start`, run start/complete/fail, first-play milestone, economy and quest events all flow to telemetry, and Poki `measure()` follows the start → complete\|fail contract per attempt. | `src/game/Telemetry.ts`, `src/game/GameplayEvents.ts` |

### Notes on `EN-02` in a one-button game

Movement is auto-forward, so "movement keys" map to the single control the
player has (hold to dive / release to soar). Accepting both the WASD cluster and
the arrow cluster means muscle memory from either convention works, and the
primary menu action is reachable with Space/Return without hunting for a focused
button — the two behaviours the rule exists to guarantee.
