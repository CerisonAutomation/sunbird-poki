# Sunbird — External Brutal Audit, QA & Design Critique

> **Status:** fixes tracked in `OMNIFIX_LOG_2026-09-30.md`.

**Date:** 2026-09-30 · **Commit:** `cbf6950` · **Branch:** `arena/01a0f277-sunbird-poki`
**Scope:** game design, mechanics & balance, mobile/UX, rendering & performance, architecture, QA & test strategy, build & release engineering, Poki platform compliance, economy & monetisation, live-ops/backend, security & trust, accessibility, localisation, audio, information architecture, docs & process.
**Stance:** adversarial. I am reviewing this as if I were the external QA vendor + publisher's product lead who has to sign the release. Nothing here is softened.

---

## 0. Verdict

> **This is a genuinely impressive piece of engineering hygiene wrapped around a game that has not proved it is fun, on a platform it is over-built for, with its single most important file untested.**

Everything green passes: `lint` clean (`--max-warnings 0`), `typecheck` clean, **2,626 tests / 187 files pass**, no circular dependencies, both builds succeed, the in-house Poki compliance audit reports `action 0`. The discipline on display — sealed saves, CRC envelopes, circuit breakers, offline outbox, quota self-healing, fixed-step deterministic physics, bounded catch-up, derived anti-cheat constants, honest comments about what is and is not simulated — is above the median for commercial web games by a wide margin.

And yet:

| Dimension | Grade | One-line why |
|---|---|---|
| Code hygiene / tooling | **A−** | Clean lint, strict TS, no cycles, ratchets in CI. Best-in-class for a web game. |
| Engineering honesty | **A** | Comments name their own past bugs. Rare and valuable. |
| Test *quantity* | **A** | 2,626 tests. |
| Test *placement* | **F** | `Game.ts` (8,333 lines, the entire game) is at **0.4 % line coverage**. |
| Core game feel / skill ceiling | **D** | Mashing the button beats deliberate play. Measured: 5.8 % expert-vs-masher gap. |
| Rendering perf on target device | **D** | 1,025 draw calls for a 41-bird race. Never measured on a real GPU. |
| Load performance | **D** | 2.1 MB single HTML; the loading screen is at byte 2,093,589 of 2,099,624. |
| Scope discipline | **F** | 22 menu screens, 15 modes, 117 shop entries, season pass, prestige, squads, wheel, vault, piggy bank — for a one-button snack game. |
| Localisation | **C−** | 35 locales × 506 keys, but 335 player-facing strings hardcoded English, and Latin-only fonts. |
| Backend scalability | **D** | Leaderboard reads do `KEYS prefix*` + N/50 `MGET` round-trips per request. |
| Trust & anti-cheat | **D** | Promo codes in plaintext in the bundle; HMAC salt shipped to the client; anti-cheat ceiling is 28 % below what the game legitimately produces. |
| Poki platform fit | **C** | SDK integration is genuinely excellent. Product shape is wrong for the platform. |
| Docs accuracy | **C−** | README describes a chunked, content-hashed, immutably-cached build that does not exist. |

**Ship recommendation:** *Do not submit.* Not because of the SDK work — that part is ready. Because you have not demonstrated that the 30-second core loop is better than the free alternatives on the same portal, and three of the P0s below are player-visible on day one.

---

## 1. Method, and what I could not verify

Verified by execution:
- `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `test:coverage`, `build`, `build:poki`, `circular:check`, `i18n:audit`, `poki:audit`.
- Direct simulation of the shipped `Bird` + `TerrainSystem` under scripted input policies (headless `tsx`) to measure skill expression, speed ceilings and the anti-cheat envelope.
- Scene-graph instrumentation of the shipped `Bird` to count draw calls, materials and triangles.
- Byte-level inspection of `poki-upload/index.html` and the zip contents.
- Static analysis of the coverage summary per file.

**Could not verify (no browser available in this sandbox):** Playwright's Chromium download failed, so the e2e suites (`orientation`, `mobile-touch`, `perf`, `poki-artifact`, `portal-policy`, `visual-baselines`) did not run here, and I could not do hands-on play testing, real-GPU frame timing, or Poki Inspector emulation. **Treat every rendering/feel claim below as derived from code + headless simulation, not from a play session.** That is itself a finding — see §6.4.

---

## 2. Critical (P0) — player-visible, blocks submission

### P0-1 · The core loop has almost no skill ceiling. Mashing beats playing.
This is the finding that matters more than all the others combined.

I drove the shipped `Bird.step()` over the shipped terrain at the shipped 120 Hz with several input policies, 60 s each, seed `2026-09-16`:

| Policy | Distance | vs. masher |
|---|---:|---:|
| Hold on downslope, release at crest (**expert**) | **2,298 m** | +5.8 % |
| **Hold the button forever (zero skill)** | **2,171 m** | — |
| Random 50 % input | 1,906 m | −12 % |
| Hold only on downhill ground (the tutorial's rule) | 1,959 m | −9.8 % |
| Never hold | 898 m | −59 % |

A player who never releases the button scores **94 % of what a perfect player scores**. Random input beats following the game's own tutorial instruction. The entire competitive superstructure — leaderboards, 40-bird races, ranked divisions, ghost rivals, mastery, tournaments, season rank prizes — rests on a **5.8 % signal**, which is inside the noise of terrain seed variance (I measured 1,823 / 1,834 / 1,866 m across three seeds for identical play — i.e. **seed variance ≈ 2.4 %, about 40 % of the entire skill gap**).

Tiny Wings, the stated ancestor, has a skill gap measured in *multiples*, because a missed slope costs you the launch entirely. Here it costs you nothing: `MIN_KEEP_SPEED = 12` plus the `GROUND_STICK_DIVE = 11` floor plus `glideLiftScale()`'s 0.32 floor mean the punishment for bad play was engineered away. Every safety net that was added individually for good reasons ("a new player could get trapped forever in the tutorial valley") has summed into *there is no wrong answer*.

**Fix direction:** make holding through an upslope actively expensive again (restore the uphill penalty as a real cost, not a floor); make the flare a *timing* mechanic with a window, not a 180 ms buffered auto-brake; introduce at least one failure state that a masher hits and an expert doesn't. Then re-run this table and do not ship until expert/masher ≥ 1.8×. **Instrument this as a permanent test** — a policy-vs-policy simulation harness belongs in `src/game/__tests__/` as the game's single most important regression gate.

### P0-2 · `Game.ts` — 8,333 lines, the whole game — is at 0.4 % line coverage.
```
TOTAL       lines 55.23%  statements 54.64%  functions 57.89%  branches 49.09%
Game.ts     0.4%  (4,247 executable lines)
SongbookPlayer.ts 0.5%   Sky.ts 0.7%   ParticleFX.ts 0.6%
Leaderboard.ts 18.2%     Audio.ts 24.5%
```
2,626 tests, and the file that owns **every mode, every state transition, every ad call, every reward payout, every screen route, the whole 120 Hz tick** is functionally untested. The coverage thresholds (`lines: 49`) are ratchets set *below* the measured number, so this can never fail CI. The suite is enormous and is testing the periphery.

Compounding it: **21 test files assert on source *text*** rather than behaviour — e.g. `expect(dueAd).toContain("!this.portalEnabled()")`, `expect(canAd).toContain("SIMULATED_BREAKS")`. Those tests pin the implementation's characters. They break on a rename and pass on a semantic regression. They inflate the test count while proving nothing.

**Fix direction:** extract the tick, the reward payouts and the ad/gameplay-event state machine from `Game.ts` into injectable units with fake renderer/audio/platform, and get the *decision logic* to ≥80 %. Delete or convert every source-text assertion. This is a 2–3 week job and it is the highest-leverage engineering work in the repo.

### P0-3 · The loading screen cannot render until 99.7 % of the game has downloaded.
`poki-upload/index.html` is **2,099,624 bytes** (639.7 kB gzip), single-file, with the entire bundle inlined in `<head>`. The `<body>` — which contains the inline boot loader whose own comment says *"Shown until React takes over the container, so a cold start on a slow connection is never a blank white page"* — begins at **character 2,093,589**.

The HTML parser must stream past 2.09 MB of inline script before it can construct the loader element. On a 1.5 Mbps mobile connection that is ~3.5 s of **white screen** before the "never a blank white page" loader appears; on a congested 3G it is 10–15 s. The mitigation is defeated by the packaging strategy. Poki's guidance is a visible loader immediately and `gameLoadingStart()` at the top of boot; you have the SDK calls right and the payload shape wrong.

**Fix direction:** move the boot shell markup + its inline `<style>` into `<head>` *before* the script (or emit it as the first bytes of `<body>` with the script moved to the end). Zero-cost change, measurable in every field session. Longer term, see P1-1.

### P0-4 · Anti-cheat quarantines legitimate runs. Proven by simulation.
`AntiCheat.ts` derives its ceiling as `MAX_SPEED_FEVER + BOOST_EXTRA_SPEED = 128 + 42 = 170 m/s`, with a comment stating this is now "the physics floor" rather than a literal. It is not — it omits two multipliers the game applies to the same cap in `Bird.step()`:

```
cap = (fever ? MAX_SPEED_FEVER : MAX_SPEED) * opts.speedMult + (boost ? BOOST_EXTRA_SPEED : 0)
speedMult = skin.speedMult (≤1.07) × challengeMods.speedMult × escalateMult()  // endlessSpeedScale → ≤1.55
```
Measured on the shipped `Bird`, fever + boost + a 1.07 skin at island 8 / t=600 s in an escalating mode: **235.9 m/s reachable**, against a 170 m/s quarantine threshold. The companion `MIN_DURATION_MS_PER_100M` is derived from the same wrong number, so both gates agree with each other and disagree with the game. The exact failure mode the comment says was fixed ("the gate was rejecting exactly the players the leaderboard is for") is still live for endless/escalating modes.

**Fix:** derive the ceiling from the same expression `Bird.step()` uses, including max `speedMult` and max `endlessSpeedScale`, or validate per-mode. Add a test that asserts `anticheatCeiling() >= simulatedMaxSpeed()` rather than asserting a number.

### P0-5 · Promo codes are shipped in plaintext in the bundle, and they grant the premium tier.
`src/game/Economy.ts`:
```ts
export const PROMO_CODES: Record<string, Promo> = {
  ZENITH: { type: "gold" },  SUNBIRD: { type: "gold" },  AURORA: { type: "vip" },
  NEST250: { coins 250 }, FEATHER: { 100 }, KONAMI: { 500 }, EASTER: { 100 },
};
```
These are in the shipped `index.html` in the submission zip. `Gold` is 2× coins + skin unlocks + Nest Pass premium track. Anyone who opens devtools — or reads one Reddit thread — bypasses the entire 60,475-coin economy on day one. There is no server validation because there is no server for this.

**Fix:** remove the entitlement-granting codes entirely from the portal build, or make them coin-only and small. A shipped client cannot hold a secret.

### P0-6 · First-time Poki players hit a free-text name-entry gate before they can play.
`edition.ts` sets `CUSTOM_PILOT_NAMES = true` for the Poki build. `Game.ts:1234` then does:
```ts
if (!this.save.state.pilotNameCustomized && this.state === "menu") {
  if (CUSTOM_PILOT_NAMES) { this.setScreen("nameEntry"); ... }
```
The comment immediately above that line argues *against* exactly this: *"a 'confirm your name' screen there has nothing to confirm — it is one screen and one tap between the visitor and the first `gameplayStart()`, and that first gameplay event is exactly what Poki measures as conversion to play."* And `renderNameEntry()`'s own comment says *"portal editions … allow no unmoderated player-authored text … no typing surface at all, and the field is not in those bundles."*

Both are false in the shipped build. The Poki edition renders `<input id="pilot-name-input" maxlength="14">`, and the name is broadcast to other players via netlib rosters and in-world name tags and posted to a public leaderboard. So you simultaneously get:
- a conversion gate in front of first play (the thing the portal ranks you on), and
- a UGC surface the code believes it does not have.

The moderation filter (`pilotNameModeration.ts`) is real and well-built, but its blocklist is **English-only** while you ship 35 locales. A Turkish, Russian, Portuguese or Arabic slur passes cleanly, and the server (`api/score.ts`) only strips `<>&"'`.

**Fix:** flip the portal path to the curated-name plate with no gate (fly first, name later), or at minimum make "Let's Fly" work with the pre-rolled name and no interaction. Then reconcile the flag's name with its meaning — it currently reads as the opposite of what it does.

---

## 3. High (P1) — must fix before a marketing push

### P1-1 · The "chunked, content-hashed, immutably-cached" build in the README does not exist.
`vite.config.ts`: `const singleFile = process.env.VITE_SINGLEFILE !== "false"` — **every** build, including the Vercel/web one, is a 2.1 MB single file. README claims:
> `npm run build` — Production bundle (**chunked**; Vercel/PWA)
> Caching — **Content-hashed Vite assets + immutable HTTP caching**

Actual `pnpm build` output: `dist/index.html 2,098.70 kB`. One file. No hashing, no caching, no vendor split, the 570 kB three.js re-downloaded on every deploy. The `manualChunks` config exists but is unreachable by default. When forced (`VITE_SINGLEFILE=false`) it produces a perfectly sensible split — `three` 570 kB, `Game` 617 kB, `audio` 86 kB, `net` 93 kB — which nobody ships.

Also: the README's Quick Start tells you to run `cargo run --release -p sunbird-server`, and the Tech Stack table describes a Rust room server and Cloudflare workers, in a checkout whose own banner says those are not here. A new engineer's first five commands fail.

### P1-2 · 1,025 draw calls for a 41-bird race, and nothing measures it.
Instrumented the shipped `Bird`'s scene graph:
```
per bird:  25 meshes · 7 unique materials · 1 PointLight · 1,580 triangles
× 41 (player + 40 rivals):  1,025 draw calls · 64,780 triangles
```
No instancing, no geometry merging, no material sharing across birds, no LOD, no distance culling, and every mesh has `castShadow = receiveShadow = true`. Terrain, props, 512 instanced coins, particles, sky and trails are on top. A mid-range Android — the median Poki device — comfortably handles roughly 100–250 draw calls at 60 fps. You are 4–10× over.

`massrace-perf.test.ts` is held up as "the benchmark that proves the PVP performance pass", but it measures **only the CPU simulation**, in Node, with **no renderer at all**, at `dt = 1/60` — while the shipped game steps the field at **120 Hz**, so real per-frame rival CPU cost is 2× the benchmarked figure. The number it defends ("< 4 ms against an 8.3 ms budget") therefore describes neither the shipped step rate nor the actual bottleneck.

**Fix:** instanced or merged rival birds with a shared material atlas (target ≤ 3 draw calls for the whole field), shadows off for rivals, distance culling beyond the camera frustum + lookahead, and a real GPU frame-time gate on a throttled device profile.

### P1-3 · The leaderboard backend cannot scale past a few thousand players.
`api/_lib/store.ts`:
```ts
const keys = await kvCommand<string[]>(`keys/${KEY_PREFIX}*`);   // Redis KEYS
for (let i = 0; i < keys.length; i += 50) { await kvCommand(`mget/…`); }
```
Every single board read does a full `KEYS` scan (O(N), blocking on the Redis server, explicitly discouraged by Upstash) followed by `ceil(N/50)` sequential `MGET` round-trips. At 100 k players that is 2,000 sequential HTTP calls inside one edge function invocation. It will time out, and it will be expensive before it does.

The read limiter that is supposed to protect it is a per-isolate in-memory `Map` — the file says so itself — so it bounds nothing across the fleet.

**Fix:** this is a Redis sorted set. `ZADD board:{scope}:{metric} score member` on write, `ZREVRANGE … 0 49 WITHSCORES` + `ZREVRANK` for the requester's rank on read. Two O(log N) commands, constant round-trips, and you get exact ranks for free.

### P1-4 · Scope is wrong for the platform, by an order of magnitude.
Counted in the shipped build:

- **22 UI screens** (`UiScreen` union), **15 mode ids**, 9 PvP "worlds"
- **117 shop entries / 101 priced skins**, total cost to complete: **60,475 coins**
- Season pass, prestige with a coin multiplier, ranked divisions, tournaments/cups, campaign, atlas, mastery, missions, daily+weekly challenges, login calendar, lucky wheel, mystery vault, piggy bank, squads, referral codes, save-transfer codes, ghost net, emotes, trophies, collections
- A daily stipend of 250 coins plus an 8-sector wheel averaging ~250/day ⇒ **~120 days of perfect daily attendance to complete the collection**, in a browser game with anonymous localStorage saves that a cache clear deletes

Poki's audience arrives from a thumbnail grid, plays for 3–6 minutes, and may never return. This meta layer is sized for a F2P mobile title with accounts, push notifications and a live-ops team. It is the direct cause of three other findings in this report (335 untranslated strings, the 0.4 % coverage on the orchestrator that routes all 22 screens, the 617 kB `Game` chunk). It is also unwinnable content: the shop shows `Gold perk` / `VIP — not on this build` tags on items no Poki player can ever obtain, because the portal edition sells nothing.

**Fix:** decide what this game is. If it is a Poki hypercasual: one mode, one race mode, ~15 cosmetics, a daily, a leaderboard. Everything else moves behind a flag or out of the build. If it is a premium/standalone title, Poki is the wrong shipping target and this repo is optimised for the wrong constraints.

### P1-5 · Feedback overload on the single most common event in the game.
`onLaunch()` for a `perfect` rating fires, in one frame: launch banner, rating label, `audio.perfect()`, music duck, `burstRing`, `emitPerfectBurst`, a `fireMoment()` shout, screen `flash`, `glow(0.85)`, `shake(0.35–0.75)`, **hit-stop freeze (33–40 ms)**, haptic triple-pulse, **`timeScale = 0.45` slow-motion for 0.16 s**, `camera.punch`, `camera.dollyZoom`, `camera.tilt`, possibly a slope-flow toast, possibly a FRENZY toast + fanfare + second flash + `shake(1)` + another moment, possibly sonic-boom particles + a quip toast, possibly fever entry.

Perfect launches happen roughly every 5–10 seconds in good play. You are putting the game into slow motion and freezing the frame several times a minute **in a game whose entire fantasy is speed**. There are 267 `hud.toast()` call sites, 18 `popupAtBird`, 8 `fireMoment`, 16 `shake`, 26 `haptic`. `NotificationQueue`'s own header documents the two-lane split invented to stop these from colliding — which is a symptom, not a solution.

**Fix:** one celebration tier per event, budgeted. A perfect launch gets audio + a particle burst + a 2-frame punch. Slow-motion is reserved for a run-ending or record moment, at most once per run. Cap total on-screen text elements at 1.

### P1-6 · Localisation is 60 % of the way there and looks it.
- 35 locales × 506 keys, all complete, none machine-identical to English — genuinely good work.
- But `audit-i18n` reports **335 untranslated player-facing strings**, of which **266 are `hud.toast()` calls with literal English copy** — i.e. the entire in-flight feedback layer, the part every player reads, is English-only in Japanese, Arabic and Turkish. The ratchet holds the number flat; it does not reduce it.
- The bundled fonts are **Latin-only** (`fredoka-latin-*`, `atkinson-hyperlegible-latin-*`, 6 files). Every CJK, Arabic, Hebrew, Devanagari, Bengali, Thai, Greek and Cyrillic locale falls back to an arbitrary system face, so 20 of your 35 locales render in a completely different typeface at different metrics inside a fixed-size HUD. Nobody has looked at these; `visual-locale.spec.ts` exists but the baselines can't cover what the CI runner's font stack doesn't have.
- RTL is handled at `document.documentElement.dir` only; the 12.7 k lines of hand-written CSS use physical properties extensively.

### P1-7 · Mode-defining mechanics are one-frame no-ops or near-enough.
```ts
this.bird.vx = Math.min(234, this.bird.vx + 6);      // draft slingshot
this.bird.vx = Math.min(235, this.bird.vx + dt*4.0); // typhoon tailwind
this.bird.vx = Math.min(240, this.bird.vx + 6.5);    // slalom warp
this.bird.vx = Math.min(225, this.bird.vx + 2.5);
```
These write `vx` directly outside `Bird.step()`, and `Bird.step()` re-clamps total speed to `cap` on the very next 8.3 ms substep. Measured: setting `vx = 234` on a non-fever bird collapses to **107.97 m/s in one step**. The `234/235/240` literals are meaningless — they are above every reachable cap — so what reads as a tuned per-mode identity is really "+6 m/s, deleted immediately if you were already fast". The marquee PvP mechanic (draft → **SLINGSHOT!** with a screen popup and a particle burst) pays out nothing to a player at speed, which is precisely the player who earned it.

**Fix:** route mode boosts through the same `cap` computation as everything else (raise the cap for the duration, don't inject velocity), and delete the four magic literals.

---

## 4. Medium (P2)

**P2-1 · Dead weight in the submission zip.** Fonts are inlined as data URIs (135,666 base64 chars) **and** shipped as six separate `.woff2` files (102 kB) that the single-file HTML never references. ~100 kB of pure dead payload in a size-sensitive portal upload.

**P2-2 · React and Tailwind are paying rent for nothing.** React 19 + react-dom are in the bundle to render **two `<div>`s** (`GameShell.tsx`, 49 lines) — the entire UI is imperative DOM in `HUD.ts` + `hud/*.ts`. There are **2** `className=` usages in all `.tsx`. `@import "tailwindcss"` pulls preflight for ~8 utility usages, next to **12,786 lines of hand-written CSS** (`ui.css` 5,777, `menu-polish.css` 4,176, `index.css` 2,833 → 294 kB / 59 kB gz). Dropping React saves ~40 kB gz and one whole boot dependency; dropping Tailwind removes a build plugin and a class of CSS-ordering surprises.

**P2-3 · `drop_console: true` in production.** Terser strips every `console.*` including `console.error`. Your resilience kernel captures crashes, but you have deliberately blinded the one channel that Poki's Inspector and your own `poki-artifact` CI job read for diagnosis. Keep `console.error`/`console.warn`.

**P2-4 · `prefers-reduced-motion` is respected in CSS but not in the game.** The CSS has five `@media (prefers-reduced-motion: reduce)` blocks and `MenuSky` checks `matchMedia`. But `settings.reduceMotion` — which gates screen shake, hit-stop, the 0.45 slow-motion, camera punch, dolly zoom and flashes — defaults to `false` and is never seeded from the OS preference. A vestibular-sensitive player who has set the OS flag gets the full treatment until they find the setting. One line to fix; also a WCAG 2.3.3 / photosensitivity consideration given how often `flash()` fires.

**P2-5 · The compliance audit grades its own homework.** `pnpm poki:audit` prints `satisfied 167 · action 0` — from `129/188 machine-verified, 12 human-attested, 26 wired but not run`. **31 % of the rules are not actually checked**, yet the headline is a clean sheet, and the script *rewrites* `docs/poki/COMPLIANCE.md` to say so. Self-certification with a green banner is how a submission gets bounced on a rule nobody checked. Report `action` counts for unverified rules, or grade them `unknown`, never `satisfied`.

**P2-6 · The only performance gate is a 30-second boot ceiling under software GL.** `e2e/perf.spec.ts` asserts `bootMs < 30_000` on SwiftShader and checks for long frames — with the file itself noting "absolute FPS is meaningless here". There is no frame-budget gate, no memory-growth gate, no draw-call gate, no throttled-CPU profile, no real-device lab. For a mobile-first portal target, the performance strategy is *hope*.

**P2-7 · `Game.ts` is a god object.** 8,333 lines, 328 fields, 191 methods, 528 `private`/`public` declarations, importing ~90 modules. It is the render loop, the state machine, the ad broker, the shop, the matchmaker, the reward engine and the screen router. This is the single reason P0-2 exists — you cannot test it because you cannot instantiate it without a GPU.

**P2-8 · Comments have become a changelog.** 23 % of non-test source lines are comments (12,099 / 52,592), and a large fraction narrate history rather than behaviour: *"This used to…", "Before this…", "The old version…", "Two claims that used to sit in this comment were wrong…"*. `Bird.ts` spends ~70 lines explaining the evolution of the flare across three implementations. Git holds that. A reader trying to answer "what does releasing the button do *now*" has to diff prose against code. Keep the invariant, delete the archaeology.

**P2-9 · Committed icons drift from their generator.** `pnpm gen-icons` (which `build:poki` runs first) deterministically produces PNGs that differ from the committed `public/icons/*` (e.g. `icon-192.png` 34,163 → 35,327 bytes). Every build dirties the working tree; the committed art is not what ships.

**P2-10 · Save state is a monolith written synchronously.** `SaveState` carries ~40 top-level sections (tournaments, season, social, squadQuestsClaimed, wheel, piggyBank, prestige, calendar, mastery, campaignClaimed, redeemedCodes, …). `persist()` = `JSON.stringify(whole state)` + CRC32 + `localStorage.setItem`, called from 19 sites in `Game.ts` including one inside `fixedUpdate`. Main-thread, synchronous, and it grows for the life of the player. Poki's cloud-save budget is 1 MB; nothing bounds this against it.

**P2-11 · `dist-poki/index.html` still links a manifest the packager deletes.** The packager logs `removed dist-poki/manifest.webmanifest (not shippable to a portal)` but leaves `<link rel="manifest" href="./manifest.webmanifest">` in `dist-poki/index.html`. `poki-upload/` is correctly cleaned, so the zip is fine — but anyone serving `dist-poki` directly gets a 404 per load.

**P2-12 · Loot-box-shaped mechanics aimed at a young audience.** Lucky Wheel (uniform 1-in-8, including a "1,000 JACKPOT!"), Mystery Vault, Vault Keys, timed flash deals, a daily-streak calendar and a piggy bank. No real money is involved, which keeps you out of gambling regulation — but this is the full dark-pattern vocabulary in a game whose portal skews heavily under 13. Expect questions.

---

## 5. Low (P3) / polish

- `upsellStrip()` in `hud/kit.ts` has **zero callers** — dead code.
- `SIMULATED_BREAKS` is hard-`false` in this fork (`PORTAL` is the literal `"poki"`), so the entire simulated-ad-break subsystem is unreachable code that still has to be read, maintained and tested around.
- `Moments.ts:479` documents `happyTime(intensity)` as **"NOT YET WIRED"** — every call site still sends it bare, so the intensity signal Poki uses for celebration weighting is always default.
- `RESERVED_PILOT_NAMES` is `["poki", "sunbird"]` — two entries, while the generator can produce thousands.
- `MAX_RIVALS = 40` with per-rival `wobbleAmp/wobbleRate/wobblePhase/reaction` and 7 archetypes — a lot of authored AI personality that no player can perceive at 40 simultaneous birds on a phone screen.
- 70 files / 2.0 MB of docs including 17 prior audits, several self-describing as definitive. Doc sprawl has the same root cause as feature sprawl.
- `git log` is a single squashed commit, so none of the "this used to be" comments can be checked against the change that made them true.

---

## 6. Discipline notes

### 6.1 What is genuinely excellent (and should be protected)
- **Fixed-step physics with bounded catch-up.** `PHYS_DT = 1/120`, `MAX_CATCHUP_STEPS = 20`, telemetry on dropped backlog, render interpolation from `prevBirdX/Y`. This is textbook and better than most shipped web games.
- **The resilience kernel.** Crash journal, per-host circuit breakers, full-jitter backoff, durable outbox, stall watchdog, quota self-healing, CRC-sealed saves with quarantine on corruption. Overkill for the game, but correct.
- **Poki SDK integration.** `GameplayEvents.ts` enforcing the no-duplicate-start/stop contract, gating breaks on `init()` *resolution* rather than the global's existence (with the field bug that taught you that documented), the `poki-canon.ts` module that turns an invented SDK member into a compile error. This is the best part of the codebase and I could not fault it.
- **Adaptive quality.** Two-way DPR stepping with an anti-oscillation cooldown, bloom budget, shadow shedding, particle budget, `perf_frame` telemetry, and — crucially — running in the menu and results screens, not just gameplay.
- **Honest self-documentation.** `api/score.ts` states plainly that the HMAC salt ships in the client and a signature is tamper-evidence, not proof. That kind of candour in a comment is worth a lot.

### 6.2 Game design
Beyond P0-1: the game does not know what it is about. `FlightPhysics.glideLiftScale()`'s header says long glides must "go boring" so the player is forced to dive and re-launch — an anti-boredom mechanic. But `MIN_KEEP_SPEED`, `GROUND_STICK_DIVE` and the auto-buffered flare all exist to stop the player from ever being punished. Two opposed design philosophies are both fully implemented and cancel out into a loop with no tension. Pick one.

Nine biomes with distinct `liftMult`, `amp`, `roughness`, `hazard` — and measured outcome variance across seeds of 2.4 %. The world is beautiful wallpaper over a flat difficulty curve.

### 6.3 Mobile / UX
The touch work is careful (correct `touch-action` strategy, `passive: false` only where it owns the surface, pointer-id dedupe, an explicit blur-on-HUD-press fix for a real reported bug, `maximum-scale=5` for WCAG 1.4.4 with a written justification). The problem is not the input layer, it is that a 22-screen IA and a HUD carrying distance, coins, best, medals, island, multiplier, gold chip, VIP chip, ghost chip, powers, sun bar, fever bar, ring chain, slope chain, goal strip, mission strip, roster bar, standings, versus bar and a toast lane has to fit on a 360 pt phone in portrait.

### 6.4 QA & production
The gate is broad (`lint → audit:ui → i18n → docs → typecheck → test → verify:prod → build:poki → verify:portals → verify:csp → audit:zips → verify:upload → verify:thumbnail → isolation:check → test:policy → test:artifact → test:mobile`) and it is *all automated static and structural checking*. There is no manual test plan, no device matrix, no playtest protocol, no bug database, no severity taxonomy, and no record of a human playing the game for an hour. Seventeen audit documents in `docs/audits/` and not one playtest report. That is why P0-1 — the only thing a player will notice in the first thirty seconds — is not on any list.

---

## 7. What I would do, in order

1. **Fix the fun.** Build a policy-simulation harness (I used ~30 lines of `tsx`), make expert/masher ≥ 1.8×, and gate CI on it. Nothing else matters until this is done.
2. **Move the boot shell above the inline bundle.** Ten minutes, removes seconds of white screen for every player.
3. **Remove the name-entry gate from the portal path** and reconcile `CUSTOM_PILOT_NAMES` with its own documentation.
4. **Delete the entitlement promo codes** from the shipped bundle.
5. **Derive the anti-cheat ceiling from the same expression `Bird.step()` uses**, with a test that compares the two.
6. **Cut scope hard.** One flight mode, one race mode, ~15 cosmetics, one daily, one leaderboard. Flag the other 18 screens out of the portal build. This makes items 7–10 tractable.
7. **Break up `Game.ts`** and take the tick, the payouts and the ad/gameplay-event machine to ≥80 % behavioural coverage. Delete every source-text assertion.
8. **Instance the rival field** and put a real GPU frame-budget gate on a throttled device profile.
9. **Rewrite the leaderboard store as a Redis sorted set.**
10. **Translate the 266 toasts and ship non-Latin fonts** (or drop the locales you cannot render properly — 12 good locales beat 35 broken ones).

And then, before anything is submitted: **have five people who have never seen this game play it on their own phones for fifteen minutes, and write down what they say.** Every finding in this report came from a machine. The most important one would have come from that room in the first two minutes.
