# Menu UX audit and reliability pass

> **Status:** superseded — front-end menu system and reliability pass, 2026-09-15. Structure has since changed; the live menu is `src/game/HUD.ts`, and the consolidation that followed is [`CONSOLIDATION_AUDIT.md`](./CONSOLIDATION_AUDIT.md).

> Historical passes. Current menu structure, multiplayer/Squad work and final
> verification are in [the consolidation audit](CONSOLIDATION_AUDIT.md).

Date: 2026-09-15. Scope: the front-end menu system, real production-browser
navigation, keyboard interaction, responsive layout, and local save/settings flows.

## Critique

The menus had accumulated individually styled features without consistent screen
state or interaction rules. The problems were not just visual: an attractive button
could swallow keyboard input, a new screen could open halfway down its content,
and changing a setting could replace the focused element. The home screen gave
progression and monetization priority over the primary action, while long lists
made the feature set feel much more complicated than the game itself.

A trustworthy interface should put playing first, preserve the user's work, explain
what a control actually does, and keep Back and keyboard focus predictable. This
pass uses that hierarchy rather than adding more decorative effects.

## Findings and resolution

| Priority | Finding | Resolution / verification |
|---|---|---|
| P1 | Screen transitions reused one scroll container's position. In a 390×844 audit, Account opened at 274px, Race/Challenges at 557px, Trophies at 1474px. | Screen-keyed scroll/focus/disclosure memory. First visits start at zero; returning restores the previous view. Browser route walk checks 14 screens. |
| P1 | Enter/Space were consumed by gameplay instead of activating menu controls. Space keyup also prevented native button activation. | Native control key events are left alone; gameplay still receives scene keys and clears held keys even after focus changes. Unit and browser keyboard tests. |
| P1 | Full snapshot replacements erased form drafts, selection and focused controls. | Shared `MenuContinuity` preserves drafts only for same-screen replacements, plus focus/selection. Identical markup is not replaced. No drafts are logged or stored persistently. |
| P1 | Mute-all switch showed ON when sound was not muted. | Correct state mapping, validated against `aria-pressed` and repeated Space toggles. |
| P1 | Volume cycling could produce 105% or 115% in saved/displayed values before audio clamping. | Native 0–100% sliders, bounded actions, direct track/quality selects, immediate percentage feedback and persistence checks. Track list is generated from all available tracks rather than hard-coded “all 10”. |
| P1 | Modal focus could reach background controls or leave the game. | Labeled dialogs, inert background controls, Tab/Shift+Tab boundaries, canvas focus on resume. Closed-details descendants are explicitly excluded (client rectangles alone are insufficient in Chromium). Matchmaking uses the same boundary. |
| P1 | Import could replace device progress on one click. | Explicit replacement-consent checkbox, nonempty-code feedback, invalid-code rejection test proving the exported save is unchanged. Actual account migration across devices is not claimed tested. |
| P2 | Chat failure was swallowed; clearing a draft after an unacknowledged send could lose the message. | Chat returns delivery success/failure. Only acknowledged, unchanged drafts are cleared; failed messages retain text and display actionable feedback. Unit tests use a mocked HTTP boundary. |
| P2 | Startup reward pills covered the canonical title bird/sun. | Dedicated notification area below the menu card, outside its scroll surface. Only the newest menu pill is shown. |
| P2 | Primary flight options sat below career, shop and upsell content. | Play-first home hierarchy; shop/settings immediately below; progression, memberships and secondary systems inside “Explore Sunbird”. Primary flight is checked fully in view at small/short sizes. |
| P2 | Shop rendered a 10,362px initial wall of bird cards on a 390×844 phone viewport. | Compact collection disclosures and separate boost/trail sections: measured initial content 981px in the follow-up audit. All 66 birds remain reachable; this is reduced initial scroll depth, not fewer catalog items. |
| P2 | Settings toggles and some lobby/pass controls were undersized. | 44px minimum targets for relevant controls; the switch track sits inside a larger real button. Target checks at desktop, 320×568 and 568×320. |
| P2 | Background/card transparency reduced text consistency; multiple scroll surfaces could fight each other. | Quiet warm-paper cards, ink text, restrained borders/shadows, no menu backdrop blur, one bounded card scroller, sticky Back/header, reserved safe-area space. |
| P2 | Fields relied on disappearing placeholder text. | Associated labels for ranges/selects; explicit accessible names for codes, pilot name, chat and save transfer fields. |
| P2 | Unaffordable bird purchases looked active; trophy browsing was another long wall. | Disabled price actions with accessible explanations; collection and trophy disclosures preserve their open state. |
| P3 | “Cloud save” suggested automatic synchronization; Endless copy promised infinite acceleration. | “Transfer saved progress” with explicit copy/import instructions; Endless copy now describes gradually increasing challenge. |
| P3 | Empty screens offered little direction or exposed developer setup language. | First-flight action on empty Scores; player-facing unavailable-edition copy for Squad. No claims that an offline feature is online. |
| P3 | New component styling could override accessibility settings. | Explicit large-text rules, blue color-assist switch track, reduced-motion rules for menu animations/transitions. |

## Visual direction

- Preserve the canonical sun and bird, the warm palette, rounded character and
  visible 3D flight around the menu; do not replace the game's identity.
- One warm paper surface, dark readable copy, teal focus rings, amber primary
  flight choice and lavender Endless choice.
- Consistent 44px Back control, modest shadows, 14–24px radii and regular spacing.
- Show detail on demand rather than shrinking a hundred controls into one screen.
- Large text can increase scroll length. Controls and Back remain reachable;
  hiding content to obtain a prettier screenshot is not the objective.

## Test coverage and boundaries

- POM route walk: Settings, Shop, Scores, Account, Race Lobby, Challenges,
  Tournaments, Trophy Case, Nest Pass, Island Atlas, Long Migration, Rival Rank,
  Leaderboard and Squad on desktop and phone browser profiles.
- Actual keyboard Enter/Space, focus continuity, focus wrapping, settings reload
  persistence, unsent code retention, collection reopening, disabled unaffordable
  purchases and safe invalid-import handling.
- Home/settings geometry at 1280×800, 320×568 and 568×320; large-text layout;
  pre-existing gameplay/HUD/loader browser cases remain in the suite.
- Unit tests cover same/different-screen draft rules, caret/scroll restoration,
  identical-markup reuse, native input events, closed-disclosure focus boundaries
  and acknowledged/failed chat delivery.

Not a claim of universal pixel perfection or an exhaustive product certification.
No real purchase/subscription, portal ad provider, production account migration,
live multiplayer load, IME/device keyboard matrix or physical screen-reader/device
lab was exercised. Payment copy and provider-specific cancellation/renewal semantics
still need a separate commerce review against the deployed provider configuration.

## Initial-pass verification (superseded by the journey-pass results below)

- `pnpm verify:prod`: passed lint, typecheck, deterministic tests, production
  build, debug scan, coverage ratchets and bundle budgets.
- **805 unit tests across 54 files passed**, including the coverage rerun.
  Total line coverage **36.0%**; all 19 established module floors passed.
- **24 production-browser tests passed**, including all earlier loader, gameplay
  and HUD cases plus 11 new menu cases.
- Generic portal single-file build and ZIP packaging passed: **1,349.74 kB raw /
  374.43 kB gzip**. JS budget: **1.22 MB total**, **0.54 MB largest chunk**.
- `git diff --check`: clean. Development preview returned HTTP 200.
- Reviewed final home screenshots at 320×568 and 568×320: primary flight choices
  are fully in view; additional content remains scrollable rather than squeezed.

## Journey-level follow-up (2026-09-15)

The earlier route walk validated individual screens, not every transition between
screens. A fresh audit found important failures that a screen checklist alone
would miss. This pass keeps the visual direction and fixes the journeys below.

| Finding | Change | Regression coverage |
|---|---|---|
| Back/Escape from a nested loadout or purchase screen always jumped home. | Added bounded-by-screen history, parent trimming, and a shared Back path. Returning from Shop restores the Race Lobby; returning from a results detour restores results. | Unit history tests; real browser Lobby → Shop → Back → Escape and Results → Shop → Back. |
| Fly Again could swallow its own pointer click. | Removed the gameplay input exceptions for Start/Retry: all DOM buttons own their pointer sequence. Canvas hold-to-start remains available. | Pointer/SVG unit tests; a real no-input flight ends, visits Shop and successfully replays. This test initially failed and exposed the bug. |
| Restart/hotkey/hold retries dropped challenge/event/storm options; portal replay also started a plain run. | Centralized replay-option selection and reused it across replay entry points, including the portal-break continuation. Split-screen restart stays split-screen. | Daily/gauntlet/duel/event/storm option tests, real free-flight replay. Live portal callbacks are not exercised here. |
| Copy UI reported success without awaiting permission; share cancellation could cause an unwanted copy/download. | Await clipboard acknowledgement, distinguish cancellation from failure, and show a selectable manual-copy dialog if clipboard access is denied. Native share cancellation is a no-op. Image feedback distinguishes copying from requesting a download. | Permission-denial browser test; absent API, denied API, native cancellation and portal no-download unit tests. |
| The manual-copy fallback needs keyboard exit while the textarea owns focus. | Done and Escape dismiss it without leaving the underlying screen. | Browser checks both exit paths and exact copied text. |
| Offline editions offered private-room Host/Join and misleading connection wording. | Disabled unavailable private-room actions with an explanation; local practice remains playable. Join now says “Connecting” rather than claiming a confirmed join. | Production offline-browser checks; no claim that a configured live server was tested. |
| Solo modes were difficult to discover from home. | Added a labeled Solo modes entry inside Explore, leading to the existing mode chooser. | Browser navigation into Endless through the chooser. |
| Results buried replay under statistics, offered competing rematches and attributed every ending to daylight. | One primary replay plus Home at the top, mode-labeled neutral completion copy, a compact three-stat summary, and expandable flight/progress details. Removed duplicate rematch prompts. | Actual completed-flight screen at 320×568 and 568×320; replay is fully visible. |
| A previous result's scroll/expanded state could bleed into the next flight. | Results use their own continuity manager, reset when flight resumes/starts. Same-result updates preserve context. | Continuity reset unit test and results navigation browser flow. |
| Rewards could cover the bottom of results; pause/continue notifications competed with choices. | Reserved the same notification space below results as below menus. Suppressed background toast pills while pause/continue/ad decisions are active. | Results/notification bounds check, existing gameplay regression suite. |
| Refreshing during IME composition could replace the composing input. | Deferred same-screen replacements until composition ends; apply only the latest pending render after native input commits. | Simulated composition unit test. Physical IME/device testing remains outstanding. |
| Nested summaries inside closed outer disclosures could still enter the focus trap. | Shared ancestor-aware disclosure visibility helper. | Nested-disclosure unit test; existing Tab-wrap regression. |

### Visual critique

The results screen needed an obvious next action, not another layer of effects.
The new hierarchy uses the existing warm paper/amber palette: mode, completion,
replay, a readable recap, then optional detail. The first screen remains compact;
secondary catalogue screens are reachable through a real navigation trail instead
of forcing repeated trips through Home. Notifications must never conceal the next
step. No billion-fold or universal pixel-perfect claim is made.

### Final journey-pass verification

- Production verification passed: lint, typecheck, deterministic tests, build,
  debug scan, bundle gates and coverage ratchets.
- **825 unit tests / 55 files passed**, including the coverage rerun. Total line
  coverage **36.2%**; all 19 existing per-module floors passed.
- **31 production-browser tests passed** on desktop/phone projects. The additional
  completed-flight test runs real gameplay through its daylight ending, visits
  the shop, returns to results and successfully activates replay. It also checks
  replay visibility at 320×568 and 568×320 and the notification clearance below
  the results card.
- Generic portal single-file build and packaging passed: **1,354.89 kB raw /
  376.00 kB gzip**. JS total **1.22 MB**, largest chunk **0.54 MB**; the existing
  Three.js size advisory remains visible.
- Live multiplayer matchmaking, native mobile share-sheet UX, real portal ad
  callbacks and physical IME/screen-reader device matrices remain outside these
  verified results. Those limitations are not erased by the passing local suite.
