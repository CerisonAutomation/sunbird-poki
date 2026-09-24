# Sunbird — shop, flight loop and live-race quality pass

> **Status:** historical evidence — shop, flight-loop and live-race quality pass. The illustrated navigation and 23-illustration SVG family it describes shipped; later passes (gated auto-shop, coin-multiplier upgrades, the moment strip) extend it. Read for rationale, not for current counts.

## What changed

### Illustrated navigation and shop
- Extended the original SVG family to 23 illustrations, adding bird, trail, boost and share artwork. Page headings, shop sections, collections and result actions now use the same visual language as Home.
- Added local bird search (name, perk, collection, rarity), All birds / Owned / Can unlock filters, result counts and a recoverable empty state.
- Added explicit bird previews. Previewing neither equips a bird nor spends coins. The showcase labels preview vs equipped, exposes the existing purchase/equip action, and explains the remaining coin shortfall.
- Search and focus survive snapshot refreshes and purchases; the existing disclosure/navigation memory remains intact. Search is bounded to 80 characters, treats text literally and sends no requests.
- Collection totals/rewards always describe the full collection, not the filtered subset. Ownership filtering cannot fabricate collection completion.
- Added direct Birds / Boosts / Trails section buttons and clearer one-flight versus permanent-upgrade explanations.
- Reviewed actual desktop/phone screenshots; removed a rarity-badge/preview overlap and inherited red button shadows. Existing reduced-motion and keyboard behavior remain supported.

### Gameplay and replay loop
- Replaced duplicated drop/ramp coordinates in hints with the terrain constants. The old 830–865 m cue gap is gone.
- Landing advice distinguishes an upcoming downslope from an uphill impact using a short terrain look-ahead. This is guidance, not an auto-pilot or physics change.
- Recaps now show one contextual skill lesson or next distance landmark, plus the cheapest genuinely earnable unowned bird. Subscription/prize gates are excluded from that suggestion.
- Replay stays above the fold. Private-race results honestly say Back to race lobby, rather than implying a seamless party rematch.
- Redesigned the downloadable flight postcard around the canonical bird, selected palette, actual flight profile and real stats. Text is fitted to avoid long-number/name collisions. Existing challenge links, cancellation and permission fallback behavior are retained.

### Live-race fairness and recovery
- Live mass races and ranked AI practice now normalize skin flight modifiers, mastery flight perks, Gold daylight and purchased manual-boost access. Equipped bird artwork remains visible.
- Armed consumables are retained rather than consumed in these equalized races. Ordinary solo, casual AI and local duel rules remain separate. This is client equipment equalization, not a new authoritative anti-cheat system.
- Shared mass-race terrain no longer applies a player's adaptive difficulty when a room inherits a `fly-` seed from a previous solo flight.
- Lobby birds show actual selected skins and Ready / Not ready text, not only an aggregate count or color.
- A socket that never opens now times out after 10 seconds. Late callbacks cannot revive the timed-out attempt. Explicit disconnect clears timers.
- Duplicate start messages cannot change an active race's seed. Server-rejected rooms do not retry forever.
- A connection lost during a race is not silently rejoined as a different round. The interrupted player returns to the lobby with an explicit error; the old simulation stops and is not presented as a resumed live match.

## Verification receipts

| Check | Result |
| --- | --- |
| `pnpm verify:prod` (includes typecheck, lint, deterministic tests, coverage and build) | Passed |
| Unit suite | **858 tests / 58 files** |
| Coverage gate | **37.0% overall + 19 module floors**; not comprehensive coverage |
| Production JavaScript budget | **1.24 MB total / 0.54 MB largest chunk** |
| Production-browser suite | **39 passed**, desktop and phone Chromium profiles |
| Real-service suite | **7 passed**, Node WebSocket reference service + PGlite social service |
| Generic portal build/package | Passed; **1,393.90 kB raw / 386.82 kB gzip** |
| Whitespace and live-preview HTTP checks | Passed |

The real-service private-room case includes a guest with an equipped faster bird, Gold and armed Head Start/Hot Wings. Both players still start at zero from one server start signal, and the guest keeps those consumables. Readiness, shared seed, exchanged movement, real roster, cancellation, leave, transport interruption, Squad chat and authorization checks pass.

Browser purchase tests use an isolated established-player wallet fixture, not a shipped test API. They verify preview has no economic side effects, purchase charges exactly once on double click, search survives purchase and the equipped bird survives reload. A separate real no-input flight reaches recap, exports a 1000×620 PNG, visits the Shop and replays successfully.

Logs: `/home/user/experience-{production,full-browser,live-browser,portal}.txt`.
Screenshots/export: Playwright `test-results` output; generated test artifacts are not source assets.

## Remaining boundaries

No claim of perfection, guaranteed virality, unrestricted scale, full accessibility certification or production anti-cheat certification is made. Seamless mid-race resume and persistent-party rematches require a versioned server protocol; this pass deliberately fails visibly instead of faking them. Real-service tests exercise the Node reference implementation, not the production Rust service. Load/soak testing, real-device Safari/iOS testing and operational moderation/recovery remain follow-up work. See `CONSOLIDATION_AUDIT.md` for the existing social credential migration and deployment limitations.
