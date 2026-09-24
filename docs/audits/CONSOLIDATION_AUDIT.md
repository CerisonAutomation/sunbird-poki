# Sunbird: play, party and Squad consolidation

> **Status:** historical evidence — product critique → implemented changes, 2026-09-15. Still cited by [`SOCIAL_API.md`](../../SOCIAL_API.md) for deployment and migration limits; counts and screenshots are of that tree.

Date: 2026-09-15. This supersedes earlier menu screenshots and verification counts.
Scope is the existing Sunbird game, not an unrelated dating-platform rewrite.

## Product critique → implemented changes

| Problem | Resolution |
|---|---|
| “Explore” hid the play choices and a long, unrelated pile of progression controls. | Removed the home dropdown. A canonical destination catalogue renders visible Play online, Same-screen 1v1, Solo modes, Endless, and labeled hangar/progression navigation. Missions, gifts, events and career detail move to **Your progress**, without deleting those features. |
| Race, Time Trial, AI duel, local rank and online play were easy to confuse. | Solo Race is **Time Trial**; the multiplayer mode is **Flock Race**. Room entry focuses on Create / Join. Quick match and Practice are separate choices; practice settings live on a separate page. Local rating is explicitly not a global ladder. |
| Lobby decoration pretended AI names were connected people. | Connected rooms show real counts and actual peer birds. Small rosters show each bird; large ones show the first eight with a remaining-pilots count. No fake occupied seats. Ready appears before secondary detail. |
| A two-person private room spawned a 41-bird AI field. | Live fields reserve actual human seats immediately; AI settings apply only to practice. The two-client browser test checks two birds and one remote pilot per client. |
| Start/Ready reconnected sockets after the server assigned a code or changed the guest's seed. | Separate requested-room identity from server-assigned metadata; preserve the active socket, adopt server terrain before spawning, and wait for its start timestamp. Different-day guests are tested. |
| Ready could stay disabled after connection; idle peers disappeared. | Network presence participates in the menu update key. Lobby presence is not aged out by movement inactivity. Legacy ready heartbeat keeps active seats alive while on the menu. |
| Public timers independently started races; cancelling left seats behind. | Public entry readies explicitly and starts from the shared server signal. Timeout disconnects before an honestly labeled AI fallback; cancel and leaving remove the seat. |
| Room codes could turn pasted URLs into `HTTPS`. | Parse full invite links, retain direct-code support and add Enter-to-join. |
| Split-screen was buried and portrait touch routing initially disagreed with the renderer. | Direct home and lobby buttons. Resolve orientation at start. P1: A/Space; P2: L/Enter (existing aliases retained). Touch follows left/right or top/bottom views; on-screen guidance names both. Held aliases, blur and individual pointer cancellation are handled independently. |
| HUD feedback and eight permanent emote buttons consumed the flight corridor. | Optional emotes behind one 44px control; keyboard dismissal; readable text labels independent of emoji-font availability. Split scores take part in measured layout. Secondary impact text is bounded away from controls and suppressed on short screens. |
| Powered glides could hang for too long. | Preserve the first three seconds of lift, then smoothly reduce it to 40% over five seconds. No teleport or hard altitude cap. A controlled powered-flight test lands at least 15% sooner than the old lift model; all 12 island-transfer/readability checks still pass. |
| Every loading surface used different decoration. | The canonical menu sun and bird now form a shared loading mark for matchmaking, room connection and Squad. Reduced motion disables orbiting. |
| Squad hung indefinitely, accepted duplicate sends, lost state on failed leave, and merged stale club messages. | Ten-second abortable requests, mutation gating, honest failure states, retained unsent drafts/history, deduplicated chat, and rejection of responses from a departed club. Empty/offline Squad offers real local-play alternatives. |
| Squad lists were long and chat strings were inserted as markup. | Six-item client-side friend/club pages and escaped chat text. The server directory remains bounded to 50 clubs, with your own club prioritized; this is not a global search implementation. |
| Social API trusted public device IDs and exposed club chat to nonmembers. | Independent browser-local 256-bit capability; server stores its hash. All non-health routes authenticate ownership; chat checks membership. Unknown clubs are rejected. Club create/join uses transactions; basic bounded quotas, body limits, no-store responses and configurable CORS are included. |
| Friend addition changed the other person's list without their action. | Saved-pilot lists are private, one-way and idempotent. |

## Canonical boundaries, not a risky wholesale rewrite

- `MenuCatalog.ts`: labels and home destinations.
- `FlockLoading.ts` + `Sunbird.ts`: one sun/bird artwork source.
- `FlightPhysics.ts` + `Bird.step`: one lift envelope for solo, split-screen and AI.
- `Pagination.ts`: one bounded collection-window implementation.
- Existing navigation history, continuity, focus management, clipboard helpers,
  dynamic imports, GPU budgets and deterministic simulation remain in place.
- Existing save data and unlocks are not wiped or reformatted by this UI pass.

## Evidence and reference review

- W3C APG disclosure navigation: native semantic controls are preferable to
  inventing an ARIA menu with incomplete keyboard behavior. The APG explicitly
  warns its examples are illustrative, not production certification:
  https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
- MDN documents aborting fetch/body consumption through `AbortController`:
  https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- Ran `pnpm outdated --format json` against the package registry. Newer versions
  exist, including a Vite major and newer React/Playwright releases. Kept the
  pinned, tested toolchain for this gameplay/security change rather than mixing
  an unvalidated bundler migration into it. Three.js was not reported outdated.
- No unsupported WCAG 3.0 AAA, HIPAA, SOC 2, Lighthouse 98, 100% coverage,
  sub-100KB Three.js bundle or sub-10ms p95 claims are made.

## Deployment and security boundary

**PvP preview/testing:** real WebSocket clients use the repository's Node legacy
protocol reference. Fixed that reference's missing all-ready launch check to
match the Rust protocol. Production still uses the Rust service under `rust/`;
Rust could not be installed in this sandbox because download endpoints failed.
These results do not certify Rust deployment, anti-cheat, reconnect fairness,
clock skew, or high-concurrency load. Private replay returns to room choices for
creating/joining the next room; seamless persistent-party rematches are not implemented.

**Squad:** frontend and server must ship together. The new capability is separate
from game saves and stays in this browser. Clearing storage loses it. Existing
social database rows without `auth_hash` deliberately fail closed: administrators
must perform a trusted identity migration/re-enrollment; never automatically claim
those rows with knowledge of a public device ID. Game progress is unaffected.
A recovery/migration product flow is still needed before upgrading an existing
public social deployment. Do not delete the existing database as an upgrade step.

Production also needs TLS, persistent storage/backups, abuse reporting/moderation,
retention/deletion policy, operational monitoring and a tested deployment/rollback
plan. Browser-local capabilities are not a complete account-recovery system.

### Repeatable commands

```sh
corepack pnpm verify:prod
corepack pnpm test:e2e
npm ci --prefix server/social --ignore-scripts
corepack pnpm test:e2e:multiplayer
corepack pnpm build:generic
```

The multiplayer suite builds a separate configured production artifact and starts
isolated real room/social services. Its PGlite database is in memory. Test identities
and tokens are ephemeral. Production portal builds remain explicitly offline.

Final verification results are recorded below when the full gates finish.

## Final verified results

- `verify:prod`: passed lint, typecheck, deterministic tests, production build,
  artifact scan, bundle limits and coverage ratchets.
- **842 unit tests in 56 files passed**, including the coverage rerun.
  Total line coverage **37.0%**; all 19 existing module floors passed.
- **35 production-browser cases passed** across desktop/phone projects, including
  the completed-flight replay journey, 15 menu routes, small/short layouts,
  split-screen geometry and optional emote controls.
- **6 live-service checks passed**: four real-socket room journeys; a real
  two-browser Squad registration/friends/clubs/chat/leave flow (including unsent
  draft retention during incoming chat); and authenticated API rejection cases.
- Generic portal package passed: **1,361.73 kB raw / 377.90 kB gzip**.
  Chunked JS is **1.22 MB total**, largest chunk **0.54 MB**. The existing Three.js
  chunk-size advisory remains visible; it is not suppressed.
- `git diff --check` passed. Reviewed new 320px Home, portrait split-screen and
  connected two-pilot room screenshots. The development preview has both local
  room and Squad services running.

Passing gates do not erase the deployment, migration, moderation, recovery,
physical-device accessibility and production Rust limitations above.

## Illustrated flight-deck art direction (follow-up)

The simplified navigation was functionally clearer but visually too generic.
This follow-up replaces plain-card presentation with original local SVG miniature
illustrations, a layered island horizon, a higher-contrast copper launch button,
coordinated mode colors, tactile borders and quieter supporting typography.
The canonical menu/loader sun and bird are unchanged. The same icon anatomy is
used for the room shortcuts, and the room entry/roster receives matching materials.

`MenuIcons.ts` owns 18 navigation illustrations plus the launch illustration and
static horizon. `MenuCatalog.ts` pairs destinations with typed icon names. The
icons are decorative, cannot take keyboard focus and contain no network resources,
shared gradient IDs or icon-font dependencies. Gameplay physics, input routing,
backend behavior and menu destinations were not rewritten for this visual pass.

Validation for this follow-up: lint/typecheck; **844 unit tests / 57 files**;
**17 desktop/phone menu-journey checks** (including 320×568 and 568×320 layout,
keyboard, copy fallback, settings and route navigation); and **6 live-service
checks** for PvP/Squad all passed. An earlier seven-case art-direction run also
covered boot artwork, lazy-load recovery and flight/pause. Portal packaging passed
at **1,377.53 kB raw / 382.13 kB gzip** before the final label-wrap safeguard.
Existing deployment/security limitations remain unchanged.

## Shop, gameplay loop and PvP follow-up

The next pass extends beyond artwork: searchable/previewable inventory, contextual
flight takeaways, a redesigned share postcard, equalized live-race equipment,
per-pilot ready states and explicit interrupted-race recovery. See
[EXPERIENCE_QUALITY_PASS.md](EXPERIENCE_QUALITY_PASS.md) for behavior changes,
**858 unit / 39 browser / 7 real-service** passing checks and remaining limits.
