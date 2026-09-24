# Benchmarks — Sunbird against the best games in its class

**Purpose:** the brief was *extract all docs, compare to other games, make it
better*. This is the comparison half: for each title that defines a mechanic
Sunbird needs, what that game actually does, what Sunbird does today (named by
file, because a claim without a location is marketing), and the honest delta.

**Method:** mechanics and design principles from public knowledge of these games;
every Sunbird cell verified against this tree on 2026-09-23. Companion:
[`COMPARATIVE_REVIEW_360.md`](./COMPARATIVE_REVIEW_360.md) grades the
*engineering* (netcode, determinism, resilience) against the same class; this file
grades the *game*. Where the two disagree, that disagreement is listed in §5.

Scale: **adopted** = we do it · **exceeds** = we do it better than the reference
for our constraints · **partial** = present but weaker · **missing** = absent.

---

## 1. One-button flight (the premise)

| Reference | What it does | Sunbird today | Delta |
| --- | --- | --- | --- |
| **Tiny Wings** | One input: hold to dive, release to soar. Speed comes from converting height, so the *terrain* is the difficulty. Sessions end at nightfall, which makes finishing a run a story. | Same input verb (`Bird.step`, `FlightPhysics.ts`), same height→speed conversion, plus day/night daylight chase across 6 biomes with thermals, gusts and ash storms (`Biomes.ts`). 8 modes on top of the core loop. | **exceeds** on variety and physics depth; **partial** on Tiny Wings' hardest trick — making a *single* run feel like a complete story with a beginning, a middle and an ending. Our runs end on a crash, not on a narrative beat. |
| **Alto's Odyssey** | Zen pacing, one trick verb (backflip), and a soundtrack/visual language that makes failing pleasant. Progression is cosmetic + distance goals. | Cosmetic collection (60+ skins with real, test-enforced perks), trails, mastery per mode, fever/zenith states. Procedural audio in `Audio.ts`. Speed now has a shared ramp in `SpeedFeel.ts` (cruise/rush/warp bands) that drives the dive FOV kick, the warp vignette, streak opacity, trail density and whoosh brightness together, and the score reacts to all nine moments (`MusicMoments.ts`). | **partial, closing** — the *feel* layer used to be the thin one; the speed ramp, the moment-reactive score and the run-arc envelope (`MusicArc.ts`) closed most of it. What Alto still has and we do not is arrangement that changes per phase of a run, rather than intensity riding one arrangement (§6 #3). Our perk system is richer than Alto's, which is a different bet (mechanical identity over pure cosmetics). |
| **Flappy Bird** | Difficulty as the joke. Death is instant, funny, and one tap from repeating. That single property made it viral. | Instant retry is wired: `holdToStart()` replays from the `gameover` state, `Input.ts` excludes buttons/`[data-action]` so the tap never steals Share or Main Menu, and the results card now says so (`hud.gameover.retryHint`, 36 locales). 9 comedy moments (BONK/SPLOSH/BOING/PHEW/PERFECT/PANIC/SLEEP/RECORD/WEE) each wired to sound + animation + haptics + telemetry + result-card line + next-action CTA (`Moments.ts`). | **adopted**, and the moment pipeline is the part Flappy never had: its deaths were funny but produced no measurement and no next action. **Unverified in a live browser** — first item after translation batches in [`HANDOFF.md`](./HANDOFF.md). |

## 2. Hyper-casual retention (the loop)

| Reference | What it does | Sunbird today | Delta |
| --- | --- | --- | --- |
| **Crossy Road** | Death → one tap → new run, with a character-collection meta that makes losing feel like progress. Coins earned *while playing*, never gated behind a menu. | `addRunCoins(base)` applies the save's coin multiplier, pops a `+N ×M`, banks once per run (`SaveData.recordRun`). Auto-shop opens once per session, gated on `runsPlayed >= 2` so it never interrupts a first flight. 12 boost upgrades, golden-feather coin multiplier. | **adopted**. The gate is the interesting part: Crossy Road can afford a persistent shop because its runs are 20 seconds; ours are minutes, so the shop is deliberately *not* in the first-session path. |
| **Subway Surfers** | Daily challenge + seasonal events + a hoverboard consumable that turns a mistake into a second chance. | Seeded daily challenge, weekly gauntlet, weekly events with physics modifiers, login calendar, season pass, continue offer with a rewarded-break path on portals. | **adopted** on structure; **missing** on live-ops — their events are server-driven and can be re-tuned daily, ours are baked into the build. |
| **Vampire Survivors** | "One more run" through visible power accumulation; every run changes what the next run can be; the player *feels* the growth curve inside a single session. | Mastery (5 levels/mode with level-5 signature skills wired into coin/lift/fever/daylight pipelines), mission chain, collections, campaign, `FlightProgression.ts`, and — since 2026-09-23 — a **growth ledger on the results card** (`GrowthLedger.ts`: metres to the next career wing, runs to the next mastery level in the mode just flown) so the ladder is visible at the moment of reward instead of one tap away. Growth is now **staged as one celebration** (`ProgressBeats.ts` ranks every reward the run earned by rarity, climaxes on the rarest, keeps the rest on screen as compact chips) and **approachable mid-flight** (the wings proximity meter counts the last metres to the next career rank and chimes once when it is imminent). | **partial** — the *feeling* gap is closing from both ends: progress is now legible inside a run (proximity meter, apex chime, one `happyTime` peak) and celebrated at the end of one (staged strip, fanfare, confetti scaled to rarity). What is still missing is in-run *power* accumulation: the curve stays flat by design (a glider has no weapon upgrades), which is the right call for fairness and the wrong call for dopamine. Compensated by the moment pipeline and the celebration, not by power. |
| **Wordle** | One puzzle a day + a shareable result that is *legible without the game* (the grid of squares). That artefact did the marketing. | `#rival=` zero-server challenge links, share run card, shareable result card with flight recap and moment strip. | **partial** — we have the artefact but not the legibility. A rival link needs the game to mean anything; Wordle's grid meant something in a group chat. The shareable moment strip is the closest thing and should be the thing we push. |

## 3. Competitive and social (the moat)

| Reference | What it does | Sunbird today | Delta |
| --- | --- | --- | --- |
| **Mario Kart Tour** | Async ghosts of real players, server-validated results, and rubber-banding so packs stay close. | Async rivalry is the primary social loop: today-seed race against a real player's ghost with an 1,800 ms fetch fuse falling back to a pace ghost (`RivalGhost.ts`), synthetic ghosts never presented as real players, first target to land owns the run. Pack balancing exists but is **casual-only, stripped in ranked/duel/live, and disclosed in the lobby in the player's language**. | **exceeds on honesty** — MKT's rubber-banding is a documented player-trust complaint; ours is a labelled setting that cannot touch a rated outcome. **partial** on population: their ghosts are plentiful because they have hundreds of millions of players. Ours needs the async foundation to fill before live matchmaking matters. |
| **Brawl Stars** | Trophy road + async-friendly 3v3 + a rivalry graph that makes every loss a rematch prompt. One-tap rematch is the retention engine. | Rival links (`rival_thrown`/`rival_received`/`rival_settled`), one-tap rematch from results, ranked duels, 40-pilot mass race with live pilots + time-shifted leaderboard ghosts, squads/clubs/feed. | **adopted** structurally; **missing** the thing that makes theirs work — a dense population and a trophy ladder with visible stakes. Our ranked duels are honest but thin until there are players. |
| **Clash Royale** | Chest timers create return appointments; competitive integrity is taken seriously enough to be a marketing point. | Daily/weekly/calendar returns; anti-cheat with movement envelope + HMAC scores + rate limits, server-refereed placements, containment proven live with 40 headless pilots. | **partial** — no return *appointment* with a clock on it (chests are a dark pattern we should not copy, but a daily seeded challenge with a visible reset time is the clean version and we have the seed machinery for it). |
| **Rocket League / Trackmania / GGPO** | Server authority, prediction/reconciliation, rollback. The netcode reference class. | Client-trusted movement + server plausibility envelope derived from the sim's own physics ceiling; server owns starts and finish order; seat tokens with one-socket-one-seat, reconnect verified live. Bit-exact deterministic fixed-step sim, so full server re-simulation is *cheap to add later*. | **graded 4/5 and 5/5 in [`COMPARATIVE_REVIEW_360.md`](./COMPARATIVE_REVIEW_360.md)**; the ceiling for ranked esports integrity is 3 and is a known, tracked, deliberate deferral. |

## 4. Web-portal class (the distribution reality)

| Reference | What it does | Sunbird today | Delta |
| --- | --- | --- | --- |
| **Poki's top titles** | Instant load (no install, no login), short sessions, ad pacing owned by the platform, first input within seconds, mobile-first. | Single-file bundle: **939 KB zip / 2.1 MB inlined HTML** for Poki (measured by `pnpm verify:portals`), zero required backend, full offline mode, boot progress + wake lock + device report, one-tap first flight, `gameplayStart()` on first intent, portal break states that are never faked. | **exceeds on footprint** (the category typically ships far heavier builds) and **adopts** the lifecycle contract, verified by `pnpm poki:audit` — every rule satisfied except five human dashboard steps and ten informational ones; the score lives in the generated [`poki/COMPLIANCE.md`](./poki/COMPLIANCE.md), not here. |
| **CrazyGames / GameDistribution / itch titles** | Same build, different SDK, and usually a pile of per-portal forks. | One codebase, four targets via `VITE_PORTAL_TARGET`, per-target edition modules, machine-checked isolation: no bundle contains another portal's name (`pnpm verify:portals`), Rust stays platform-agnostic (`pnpm isolation:check`). | **exceeds** — this is genuinely rare. Most studios maintain portal forks by hand and leak a competitor's SDK string into a build regularly; ours fails the build if it happens. |

## 5. What Sunbird does that none of the above do

1. **A deterministic, bit-exact flight sim in a 900 KB single-file bundle with zero required backend.** Server-side re-simulation of any run is structurally possible — no web arcade game in this class can say that, and most mobile ones can't either.
2. **Honesty as an enforced design rule.** Device-only data is badged local; simulated rivals are labelled; rubber-banding is disclosed and rated-off; the leaderboard chip names its backend. Enforced by tests and by the UI audit, not by a policy document.
3. **Machine-checked portal isolation.** Three zips, each containing exactly one portal's identity, legal disclosures and host table. Enforced by a substring gate that treats an object *key* as a leak — the strictest version of this check we could build.
4. **A comedy-moment pipeline with instrumentation — and a band that plays along.** Eight classified beats, each landing sound + animation + haptics + *a bounded musical reaction* + a telemetry event + a result-card line + a next action. Tiny Wings has a soundtrack that reacts to speed; Flappy Bird has a funny death and nothing else. Ours has a laugh, a musical gag, a number, and a reason to fly again — with a test-enforced rule that no gag may slow the flight down.
5. **36 locales in the boot path budget**, including RTL with a visual baseline, from a single barrel that fails the build on drift — with an explicit ratchet (`pnpm i18n:audit`) on the strings that are still English.

## 6. What the best games do that Sunbird still doesn't

Ordered by expected player impact, not by effort:

| # | Gap | Reference | What closing it looks like |
| --- | --- | --- | --- |
| 1 | **A run with a narrative shape** | Tiny Wings' nightfall | A run that ends on a beat (the sun going down, the island running out) rather than only on a crash. The daylight-chase theme is already the fiction; the ending isn't yet. |
| 2 | **Cohort analytics on the far side of the events** — *narrowed 2026-09-23* | every F2P title | The funnel half is answered: the sink aggregates `funnel_stage` / `funnel_summary` into reach, step-to-step conversion, stalls and a worst step (`GET /mp/v1/telemetry/funnel`, `pnpm funnel:report`), built from anonymous stage counts with no session ids stored at all — and portal traffic is read on Poki's dashboard, where the same stages arrive as `measure` events. What still separates us from an F2P cohort report is **durability**: D1/D7/D30 and second-run conversion need a store that survives a restart, and this sink refuses on principle to become one. That decision belongs to whoever publishes the direct build, not to the telemetry layer. |
| 3 | **A soundtrack with an arc** — *narrowed 2026-09-23* | Alto's Odyssey | Two instrumentation families, 10 tracks, 9 biome styles, 6 modes, a reaction for all 9 comedy moments (`MusicMoments.ts`: a BONK face-plants the band, a SPLOSH puts it underwater, a WEE rises with the dive, a RECORD gets drop + glide + bells) and now an **intensity envelope over the whole run** (`MusicArc.ts`: a launch swell so take-off is never the quietest beat, a handover to the flight's own energy sum, and a slow release so a run resolves instead of cutting — 16 tests). The *arrangement* gap closed later the same day: `MusicArrangement.ts` re-mixes the band per phase of a flight — a take-off breath with the kit held back so the drop-in is an event, the tuned mix in cruise, a brightened top and thinned bed at the apex, and a landing cadence that removes the rhythm section and survives the mode flip back to the menu (20 tests, including one that pins cruise to the exact tuned gain values). What Alto still has beyond this is **recorded material**: real composed audio instead of a synthesis engine. |
| 4 | **Server-driven live-ops** | Subway Surfers | Events and tuning baked into the build cannot be re-tuned without a re-upload to every portal. The Rust server is the natural home for flags. |
| 5 | **A character, not just a bird** | Crossy Road's roster, Fall Guys' beans | 60+ skins with mechanical perks is a collection, not an identity. The billion-dollar ladder in the audit runs through a recognizable character; nothing in the repo builds one yet. |
| 6 | **Legible share artefacts** | Wordle's grid | The share card needs to mean something to someone who will never open the game. The moment strip is the candidate. |
| 7 | **Cross-device progress** | every live-service title | Save export exists; cloud save on web does not. Portals forbid external accounts, so this is a direct-build feature by construction — which is exactly why direct is the monetization layer and portals are acquisition. |

## 7. The measurable targets this doc exists to serve

From the audit's P0 list. Each has an owner mechanism and a way to be observed.

| Target | Threshold | Mechanism | Observable |
| --- | --- | --- | --- |
| One tap to fly | 1 tap from the first screen | `FirstFlight.ts`, `holdToStart` | e2e first-session spec |
| First reward | < 30 s | starter goals with a 40-coin floor, `SessionGoals` | `funnel_stage` = `first_reward` |
| First funny event | < 20 s | `SurpriseEngine` warm mode (6 s cooldown, 140 m gate) while `runsPlayed < 2` | `surprise` telemetry, moment counts |
| Instant retry | 0 screens between death and flight | `holdToStart` in `gameover` + `replayRun(true)` + results-card hint | **needs live-browser verification** |
| Rival within seconds | every run has a target | `RivalGhost.ts` (1,800 ms fuse → pace ghost) | `rival_ghost{kind}` |
| Second-run conversion | measure, then improve | `Funnel.ts` | blocked on gap #2 above |
| Progress felt at the moment of reward | the results card names what the run grew | `GrowthLedger.ts` → `renderGrowthLedger` under the stats row | `growth-ledger.test.ts` (10 tests) |
| A flight *feels* fast | every channel leans in at the same speeds | `SpeedFeel.ts` bands → `CameraRig` FOV, `HUD` streaks + vignette, `Game.emitTrail`, `Audio` whoosh | `speed-feel.test.ts` (21 curve tests) · `run_end.speedPeak` per run · first WEE via `moment_first{kind:wee}` |

Nothing in this file is a promise. Rows marked **partial** or **missing** are the
work queue; the ones marked **exceeds** are the things to stop re-explaining and
start marketing.
