# SUNBIRD — Competitive Audit vs. Top Games & Implementation Report

> **Status:** archived — competitive gap analysis against top mobile/web titles (Brawl Stars, Clash Royale, Subway Surfers, Mario Kart Tour, Fall Guys) plus its implementation log, 2026-09-11. The live benchmark set is [`../BENCHMARKS.md`](../BENCHMARKS.md).

Date: 2026-09-11 · Branch: `arena/01a08de2-sunbird`

This document records (1) the gap analysis against top mobile/web titles
(Brawl Stars, Clash Royale, Subway Surfers, Mario Kart Tour, Fall Guys,
Rocket League Sideswipe, Pokémon GO, Candy Crush), and (2) exactly what was
implemented in this pass — all client-side, honest, and verifiable, in keeping
with the repo's "no fake multiplayer, no decorative prizes" principles.

## Scorecard: before → after (client-side scope)

| Axis | Before | After | Top-game reference |
| --- | --- | --- | --- |
| PvP modes | Ranked 40 / Casual 40 / rooms | + **Ranked Duel 1v1** with rating-matched opponent, forfeit penalty, rematch | Clash Royale 1v1 ladder |
| Ranked structure | Endless Elo, no seasons | + **Monthly ranked seasons**: soft reset, peak-division reward | Rocket League/Brawl Stars season resets |
| PvE structure | 8 modes, static | + **Daily Challenge** (seeded mode + modifier), + **Weekly Gauntlet** (3 escalating stages + clear bonus) | Fortnite dailies, Candy Crush episodes |
| Retention | Streak + daily quests | + **28-day login calendar** (milestones at 7/14/21/28, catch-up-proof cycle) | Pokémon GO / Genshin login calendars |
| 1P progression | Missions, 16 trophies | + **Mode mastery** (5 star levels × 8 modes, coin payouts), + 10 new achievements (26 total) | Brawl Stars mastery |
| Content depth | 6 skins, 2 trails | **24 skins** (incl. 4 prize-only skins), **6 trails** (2 tournament, 1 calendar, 1 duel, 1 gauntlet, 1 pass) | shop depth of top arcades |
| Season pass | 20 tiers | **50 tiers**, free track now includes a trail + an exclusive skin | Pass tier counts of top passes |
| Cosmetic honesty | Prize trails label-only | **Prize trails now render in flight** and override the skin trail | — |
| Emotes | 4 | 8 | Clash Royale emote wheels |
| Anti-rage-quit | none | Duel quit/DNF counts as a loss | standard ranked hygiene |
| Tests | 0 (verify script failed) | **39 tests** across pvp/challenges/mastery/economy/physics-determinism; `npm run verify` passes | — |
| PWA | stale cache key | cache bumped to `sunbird-shell-v3`; icons verified present | — |

## What was deliberately NOT done (needs infrastructure, not client code)

Per `REPO_TRUTH_AUDIT.md` and `RUST_MIGRATION_PLAN.md`, these remain honest
gaps that cannot be closed client-side without shipping the Rust
authoritative backend and an account system:

1. **Real matchmaking / live multiplayer** — the canonical Rust WebSocket
   service is still absent; `Realtime.ts` remains the transport candidate.
2. **Server-authoritative leaderboards / anti-cheat** — client submission is
   untrusted by design and labelled as such in the UI.
3. **Accounts, cloud save, cross-device sync** — the export/import code
   remains the only transfer path.
4. **Friends / clubs / chat / spectating / push notifications** — social
   graph features require identity + backend.
5. **Real payments entitlement** — Stripe webhook verification is a server
   concern.

Everything added in this pass is device-local and clearly labelled as such
(the game's existing "local rating / practice field" honesty rules were
preserved everywhere, including the new duel and season UI).

## New systems in detail

### Ranked Duel (1v1)
- Entry: main menu "Duel 1v1", Rank screen, or post-duel rematch.
- One seeded opponent whose simulated skill tracks your rating band
  (`duelSkillFor`), named deterministically from the daily seed.
- Flat ±16 rating; forfeit or DNF = loss. Duel record (W–L, streak, best)
  stored in save. 10 lifetime wins award the **Jewel Hummingbird** skin;
  first win awards the **Duelist** trail.

### Ranked Seasons
- Monthly (`rankSeasonId`), rolled over on load and at day-tick.
- Soft reset: rating drifts halfway back to 1000; peak division of the
  finished season pays 60–340 coins.
- Reaching Sunbird Legend at any point awards the **Solstice** skin.

### Daily Challenge
- Deterministic from the date: mode + metric target + one of four modifiers
  (Pure Sky = power-ups inert, Short Day = 65% daylight, Heavy Wings = −5%
  speed, Gold Rush = 2× coins). Modifiers genuinely alter the physics/economy.
- 150 coins on completion, once per day; lifetime counter feeds achievements.

### Weekly Gauntlet
- 3 deterministic stages per ISO week at ×1 / ×1.6 / ×2.4 difficulty,
  80/140/260 coins + 300 clear bonus.
- First clear awards the **Stormline** trail; 5 lifetime clears award the
  **Stormcrow** skin.

### Login Calendar
- 28-day cycle independent of the streak; milestones at day 7 (boost),
  14 (300 coins), 21 (headstart boost), 28 (**Starfall** trail; converts to
  200 coins if already owned). One-tap claim strip on the main menu.

### Mode Mastery
- Every finished run banks a mastery run for its mode; 5 levels at
  3/10/25/50/100 runs pay 40→400 coins. 15 total stars = gold trophy.

### Content
- 18 new purchasable/prize skins across the price curve (150–950 coins),
  perks kept within the existing non-pay-to-win envelope (≤ +8% speed,
  ≤ +5 s fever, ≤ +10 s daylight — all matching pre-existing bounds).
- Nest Pass: 50 tiers; free track now contains the Starfall trail (t25) and
  Bird of Paradise skin (t30); premium adds Prism trail (t35) and Midnight
  Raven capstone (t50).

## Verification

```
npm run verify   # typecheck + 39 tests + production build — all green
```

Key invariants covered by tests: division continuity, Elo symmetry/clamps,
streak caps, season soft-reset math, duel determinism, daily/gauntlet
determinism and reward escalation, calendar cycle, catalogue integrity
(every pass reward maps to a real unlock; prize skins are unbuyable), and
bit-exact physics determinism of `Bird.step()` on seeded terrain.
