# Handoff — where Sunbird stands and what to do next

**Status:** current as of 2026-09-23 · branch `arena/01a0cba9-sunbird`
**Focus:** Poki only — submission, compliance, SDK integration. The non-Poki
queue is parked in [`archive/GAME_BACKLOG_2026-09-23.md`](./archive/GAME_BACKLOG_2026-09-23.md).
**Supersedes:** the 3.4 MB root `HANDOFF.md` that used to live here, which was a
raw `git diff` dump — reproducible from git, unreadable as documentation, and 89%
of the repo's total markdown weight. A handoff is a map, not a patch file.

Read [`README.md`](./README.md) first for the doc system. This file is the
"pick up the work mid-flight" document: what is true now, which decisions are
standing (and were contested), what breaks if you touch the wrong thing, and what
is next.

---

## 1. Verified state

Every claim below was produced by a command in this tree, not remembered.

| Gate | Result |
| --- | --- |
| `pnpm lint` (`--max-warnings 0`) | pass |
| `pnpm audit:ui` | pass — no dead buttons, no null refs, no unlabelled controls (19 advisory warnings) |
| `pnpm i18n:audit` | pass — debt **down to 312** (two toast batches, the celebration strip, then batch 3: every screen title — that category is now **0**), ratchet re-blessed |
| `pnpm docs:audit` | pass — no broken links, no orphans, every snapshot statused |
| `pnpm typecheck` + `pnpm typecheck:server` | pass |
| `pnpm test` | **1,781 passed**, 9 skipped, 134 files |
| `pnpm test:server` | **48 passed**, 7 files |
| `pnpm verify:prod` | **PRODUCTION READY** — coverage 49.3% + 19 module floors, JS 1.69 / 2.50 MB (positional i18n packs took it down from 1.78 MB), zero debug artifacts in shipped client code |
| `pnpm build:portals` + `pnpm verify:portals` | **3/3 zips shippable** — poki 945 KB, crazy 932 KB, generic 929 KB (the positional pack format took ~105 KB of repeated key names out of every bundle) |
| `pnpm audit:zips` · `verify:upload` · `verify:thumbnail` · `isolation:check` | pass |
| `pnpm poki:preflight` | exit 0 — the whole portal pipeline, ending in a live audit run |
| `pnpm poki:audit` | **116/131** rules satisfied · 5 need a human at Poki's dashboard or a GPU (§6) · 10 informational |
| `pnpm gate` → `test:policy` / `test:artifact` / `test:mobile` | **environment-blocked**: Playwright cannot download browser binaries in this sandbox. CI runs them. Not a code failure. |

Localization: **36 locales** (the 34 codes the portal inspector offers, plus `vi`
and `mt` that already shipped, plus `"auto"` = browser detection) × **154 barrel
keys**, 100% pack coverage, drift-checked by `src/i18n/__tests__/locales.test.ts`.

## 2. Standing decisions — do not re-litigate without new evidence

These were all contested at some point. Each line names the mechanism that
enforces it, because a decision without an enforcing test is a rumour.

1. **Portal builds never carry another portal's name.** Enforced by
   `scripts/portal-markers.mjs` (case-insensitive substring scan of each zip's
   inlined HTML — object *keys* count) via `pnpm verify:portals`. Cross-edition
   content therefore lives in per-target modules resolved by
   `portalShimPlugin.resolveId` in `vite.config.ts`: `edition{,.poki,.crazy,
   .generic}.ts` and `legal.edition{,.poki,.crazy,.generic}.ts`. Only *positive
   constant* comparisons against `import.meta.env.VITE_PORTAL_TARGET` fold;
   a runtime `someObject.portalName === "poki"` leaks and has been removed twice.
2. **Portal pilots get a generated read-only name + 🎲 reroll.** Free text is
   broadcast to strangers over P2P netlib rooms, the marker gate forbids a
   `data-ref="pilotName"` surface in any portal bundle, and
   `e2e/portal-policy.spec.ts` asserts the read-only plate. Direct/web keeps free
   rename behind the profanity filter. `CUSTOM_PILOT_NAMES` is `false` in all
   three portal editions, `true` only in `edition.ts`.
3. **No ad-removal purchase anywhere a portal can see it** (Poki REQ-20 forbids
   IAP *and* UI implying it). `VITE_SELL_AD_REMOVAL` is pinned by Vite `define`
   to a boolean literal, typed in `src/vite-env.d.ts`, so Rollup folds the copy
   out. Do not reintroduce `as any` here: `verify:prod` bans `eslint-disable` in
   shipped client code, which is what the cast needed.
4. **Rubber-banding exists, is disclosed, and is casual-only.** `packBalancing`
   is stripped in ranked/duel/live races and the race lobby says so in the
   player's own language (`hud.race.fairness.assistOn/assistOff`). Hidden
   assistance that touches a paid or ranked outcome is the one trust failure this
   game cannot survive.
5. **Anything simulated on-device is badged as local.** No device-only number is
   ever presented as worldwide (`LEADERBOARD_API.md`); the leaderboard chip names
   its backend from the edition module.
6. **The privacy page is a union; the bundles are not.** `public/privacy.html`
   (public, Node-rendered) lists every edition's hosts. Each bundle carries only
   its own `legal.edition.*`, because a shared policy would put
   `netlib.poki.io` inside the CrazyGames zip.
7. **A comedy beat is a musical event, not just a sound effect.** Every kind in
   `Moments.ts` has a bounded reaction in `MusicMoments.ts`; the design rule the
   tests enforce is that no reaction may slow the flight down (only PHEW may pull
   intensity, and gently). Add a moment kind → add its recipe → the coverage test
   fails until you do.
8. **Speed feel has one source of truth: `src/game/SpeedFeel.ts`.** The bands
   (cruise 0.45 / rush 0.72 / warp 0.90 of `MAX_SPEED`) and every curve derived
   from them — dive FOV kick (`CameraRig`), streak + warp-vignette opacity
   (`HUD`), trail density and whoosh brightness (`Game.emitTrail`, `Audio`),
   the WEE trigger and the adaptive particle budget — are pure functions of
   scalars, so they are unit-tested (`speed-feel.test.ts`, 21 tests) and cannot
   drift apart per system. Do not hand-tune a threshold inside a consumer: add
   or bend a curve in `SpeedFeel.ts` and let the test pin it. Two rules the
   tests enforce: effects ramp (never pop), and a weak device loses *particles*
   before it loses frames.
9. **The barrel is the only place a string gets translated.** Edit
   `src/i18n/translations.barrel.json` (all 36 locales), run
   `node scripts/gen-i18n-packs.mjs`, render with `t(key, params, defaultText)`.
   `defaultText` must match `sourceText` word for word — the tests check drift.
10. **No build shows an ad break it cannot serve.** The direct build has no ad
    network, so `edition.SIMULATED_BREAKS` is off unless the build is made with
    `VITE_SIM_BREAKS=true`, and every break surface — the end-of-run
    interstitial, the continue card's second-wind offer, the `adAvailable`
    snapshot field, the Account screen's "N left today" copy and Gold's
    ad-removal bullet — is gated on it, so the pitch and the product cannot
    disagree. `SELL_AD_REMOVAL` is a different flag and stays `true` on direct:
    it drives the paywall/VIP UI, which is legitimate whether or not breaks
    exist. Enforced by `ad-honesty.test.ts` (gates + the cadence maths the copy
    promises) and `poki-breaks.test.ts` (the official SDK contract: no-fill and
    rejected opportunities resolve without wedging a restart, and
    `onAdOpened`/`onAdClosed` stay a balanced pair).
11. **Versions have one inventory and one guard.** `docs/VERSIONS.md` lists every
    identifier (semver, build id, save schema, wire protocol, replay format, HTTP
    namespace, editions) with its owner and what breaks on drift;
    `version-lockstep.test.ts` fails the build when the client and server copies
    disagree — the realtime gateway *rejects* frames whose protocol version it
    does not recognise, so a client-only bump breaks every room. `BUILD_ID` is
    `<semver>-<portal>-<sha8>` and must stay deterministic: it was
    `Date.now().toString(36)` and nothing read it, which made every rebuild of the
    same commit a new "version" and made the server's `SUNBIRD_CLIENT_BUILD` pin
    unsatisfiable.
12. **The score cadences and the HUD's numbers are white.** Every progression is a
    period (antecedent bars 1–4, consequent bars 5–8 that departs and lands) and
    `music-harmony.test.ts` enforces the theory: a cadence in the bars or across
    the loop seam, the tonic reached twice, no consequent that copies its
    antecedent (chip loops exempt — that is the idiom), and a closed chord
    vocabulary agreed by all four places that list it. `.stat-value`/`.stat-label`
    float on the sky with nothing opaque behind them, so `hud-contrast.test.ts`
    measures WCAG luminance against the six zenith colours `Sky.ts` actually
    paints. A menu-styled dark ink there once shipped: 0.8:1 on the dusk sky.

13. **Colours have a core, and the sprawl has a ceiling.** `index.css` `:root`
    carries 19 colour/role tokens — the 17 most-repeated hexes (21 % of all
    declarations) plus `--text-on-sky` and `--halo-on-sky` for the flight HUD.
    Each token is defined as *exactly* the hex it replaced, so the migration was
    pixel-identical: with no browser in the loop, value-identity is the only CSS
    refactor that is safe to make. `css-tokens.test.ts` fails on a `var()` that is
    neither defined nor fallback-ed, a raw copy of a global token's value, a token
    defined twice, and any rise in unique colours (906), hex declarations (1,481),
    raw `color:` literals or `!important` counts (11/13/1,491 per sheet). Those
    caps are debt recorded, not targets met — the goal is that they only shrink.
    Scoped tokens (`--pc-*`, declared on one selector) are deliberately *not*
    substituted elsewhere: outside their scope they resolve to nothing.
14. **Every network-supplied string reaches the DOM as text.** The HUD is
    string-concatenated `innerHTML` (13 sinks) guarded by a per-call-site
    `escapeHtml`, plus a second escaper (`escapeText` in `Sunbird.ts`) for inline
    SVG `<title>`. `hud-injection.test.ts` renders hostile names through all six
    surfaces a stranger controls — room roster, room code, live standings, home
    leaderboard strip, P2P rival tags, duel-foe SVG title — and asserts no live
    element, no `on*` attribute, no execution, and a still-readable name. Payloads
    must be quote-breakouts (`" onmouseover="`, `"><img …>`): a bare `<img>` is
    inert in an attribute context, and HTML attribute serialisation escapes only
    `&`, `"` and nbsp, so a correctly escaped name still comes back out of
    `innerHTML` with a literal `<` in it.

15. **`Game.ts` gets decomposed by lifting view-builders out, not by
    refactoring in place.** 7,662 lines, 153 methods, and only 5 of them touch no
    `this.` at all — so nothing can be moved mechanically. The pattern that works
    (`src/game/Cards.ts`, first cut): take a method that turns saved state plus
    content constants into a HUD view object, pass the state in as arguments,
    **pass the clock-derived value in too** (the week key, the season footer) so
    the extracted function never reads a `Date`, leave a one-line delegation
    behind, and write the behavioural tests the method never had. Do not attempt
    `handleAction` (1,311 lines) or `fixedUpdate` (828) this way; they need a
    run-context object first. The first two lifted methods immediately exposed a
    false "bonus paid" claim — see the audit's §1.
16. **Barreling a string costs 36 translations, so it is a decision, not a
    sweep.** The barrel (`src/i18n/translations.barrel.json`, 154 keys × 36
    locales, all populated) is the single source of truth and
    `src/i18n/__tests__/locales.test.ts` rejects an empty cell, so adding a key
    means supplying every locale. Of 97 `hud.toast("…")` literals exactly one
    already had a key (`hud.settings.languageUpdated`, now used). The rest need a
    translation pass with a reviewer; machine-filling 36 locales blind would ship
    worse text than honest English, so the ratchet (311) moves only on real
    translations.

17. **Progression has to be visible during the flight, or it does not register.**
    The game had nine ladders and players still reported feeling none of them,
    because almost all of it lived in menus: the flight HUD drew **one** of the
    three live session goals, the career rung appeared only when nearly complete,
    and today's quests were evaluated from finished-run stats and shown in a menu.
    Two `@media (max-height: 500px)` queries then set
    `.flight-footer .goal-strip { display: none }` — a phone in landscape, i.e.
    most of a portal's audience, saw no in-flight progress at all. Now: three goals
    ranked closest-first with their count and reward under each bar, the career rung
    beside them for the whole flight, short viewports *condense* to the lead row
    instead of hiding it, and the results card ends with one next action rather than
    a list of nine ladders. `flight-goal-strip.test.ts` fails if any stylesheet
    hides the strip again (versus races are allowlisted by name, because place and
    gap already cover that flight). Evidence and sources:
    [`audits/PROGRESSION_FEEL_2026-09-24.md`](./audits/PROGRESSION_FEEL_2026-09-24.md).
    **Unverified:** whether four footer rows crowd the bird on a 360×640 landscape
    phone — that needs `e2e/layout.spec.ts` in a browser, and it is the first thing
    to check before submitting.

18. **A moment that can lose an arbitration is not a moment.** The flight HUD gives
    competing text *one* slot — `HudFeedback.feedbackSlot()` ranks countdown above
    finish-countdown above launch banner above the goal pill above the hint, and CSS
    hides every child of `lane("flight-messages")` whose kind is not the winner. That
    is the right call for text that fights the landing corridor for attention, and
    the wrong call for the rarest event in the game: the finish countdown owns the
    slot for the last 900 m, which is precisely where a long flight crosses a career
    rung. So the rank-up banner is authored beside the pill but **never handed to a
    lane**, and `flight-moments.test.ts` asserts it is not a `.flight-messages`
    descendant and that no stylesheet hides it. Same rule for anything new that is
    rare, unmissable and earned: give it its own element, not a turn in the queue.
    Portal signals do *not* follow the moment — `wings_promo` telemetry and the
    single `happyTime` peak stay at run end, because Poki asks for that signal
    sparingly and one honest peak per landing beats two.
    Two boundaries worth keeping: the rank-up is **not** a tenth `MomentKind` (those
    nine are the comedy/physics vocabulary feeding the results-card joke tally and
    the `first funny moment` funnel stage — a promotion is neither), and progression
    *is* now in the music: `runEnergy()` in `MusicArc.ts` takes `goalsDone`, weighted
    last and smallest so it lifts a quiet-but-achieving flight instead of pushing a
    loud one louder.

19. **A floating HUD element takes its position from the measured lanes, never
    from a viewport percentage.** The header and footer are flow lanes whose
    heights a ResizeObserver publishes as `--hud-header-height` /
    `--hud-footer-height`; anything that must float *outside* them — because it
    cannot be allowed to lose the arbitrated message slot (decision 18) — has to be
    centred in the band those two measurements leave:
    `calc(header + (100vh - header - footer) / 2)`. `HudLayout.ts` is the readable
    arithmetic, `ui.css` is the `calc()`, and `beat-lines.test.ts` fails if the two
    disagree. A percentage is a guess that happens to be right on one device: 40 %
    of a 640 px portrait phone clears a one-row footer and lands inside a four-row
    footer on a 360 px landscape one. Corollary, also guarded: a new HUD row joins
    an existing lane rather than positioning itself, so it adds no new overlap
    surface on any breakpoint.
20. **A mark is a place, not a total.** Personal best, today's best, a rival's
    shared mark, the daily target and the lead distance goal were all already
    computed and all only ever *read* — on a card, after the flight. `BeatLines.ts`
    turns them into at most three flags standing in the world ahead of the bird
    (`BeatLine.ts`), with a countdown row in the goal strip inside a 400 m cue
    window and one moment per crossing. Keep the caps: three flags is readable, six
    is clutter, and two flags 20 m apart fire two celebrations in one frame, which
    feels like a stutter rather than a win. `BeatLine.ts` is untestable in jsdom
    (no WebGL, no 2D canvas) exactly like `FinishGate.ts` — that is why total
    coverage reads 49.3 % with every module floor still passing, and it is what the
    browser specs owe us.

## 3. Traps

* **`menu-polish.css` wins the cascade over `index.css`, and it uses
  `!important`.** `main.tsx` imports `index.css` first, then
  `game/menu-polish.css`, so a restyle written for menu cards applies to anything
  sharing a class name — including the flight HUD. That is how the distance
  readout became `#2c1f14` on a transparent header over a `#12102c` night sky
  (1.2:1; 0.8:1 at dusk). Before restyling a class here, check whether the flight
  HUD uses it too; `hud-contrast.test.ts` guards the stat block specifically.
  (How to parse these sheets inside a test: the "Parsing CSS" trap below.)
* **`src/game/legal.ts` must stay Node-safe.** `scripts/gen-privacy-page.ts`
  imports it under plain `tsx`, where `import.meta.env` is undefined. Isolation
  comes from the module alias, never from an env fold inside that file.
* **`docs/poki/COMPLIANCE.md` and `docs/poki/CSP_REQUEST.md` are generated.**
  Editing them by hand is a no-op that looks like a fix. Edit
  `requirements.json` / `legal.edition.poki.ts` and re-run the generator.
* **The host list has a fourth copy nobody used to check: the built bundle.**
  `legal.edition.poki.ts` declares it, `gen-csp` writes the submission text,
  `legal-editions.test.ts` pins the deployed header — and then there is what
  `dist-poki/` actually reaches for. `pnpm verify:csp` (chained into
  `verify:portals`, so it runs in both `gate` and `poki:preflight`) scans the
  built bundle for every scheme it can find — `https:`, `wss:`, `stun:`, `turns:`,
  protocol-relative — and fails on an origin that is not declared, on a declared
  host the bundle never uses, and on a host that never reached the generated
  request. Prose-only URLs (`xmlns` namespaces, a doc link inside a minified
  library warning) live in its `REFERENCE_ONLY` map with a reason each; never add
  a Poki host there, and a test fails if you do.
* **Locale codes are load-bearing strings.** `zh` not `zh-CN`, `pt` not `pt-BR`,
  `no` not `nb`. Pack filenames, `matchLocale`, `locales.test.ts`, the e2e visual
  baseline and the public copy all interlock; regenerate packs with the script.
* **`Game.ts` is ~7,300 lines and `HUD.ts` ~3,600.** Both are god objects. A
  change to onboarding, ads, results or telemetry can touch Poki lifecycle
  events, save state and race state in one edit. Decomposition is parked
  ([`archive/GAME_BACKLOG_2026-09-23.md`](./archive/GAME_BACKLOG_2026-09-23.md) §5), not started; until then, prefer additive modules with type-only imports
  (`Moments.ts`, `Funnel.ts`, `Economy.ts`, `RivalGhost.ts`, `ProgressBeats.ts`
  are the pattern — they import nothing back from `Game`/`SaveData`).
* **Translations are bundle payload, and the JS budget is the real limit.**
  A portal zip is one file, so `import.meta.glob` inlines **all 36 packs** into
  `index.html` however lazily the runtime asks for them. Since 2026-09-23 packs
  are **positional arrays** aligned with `src/i18n/pack-keys.json` — the key
  names used to be repeated 36 times and were 111 KB of a 297 KB payload. A key
  now costs roughly **0.45 KB per zip** instead of 0.75 KB, and short labels less
  (batch 3's 17 screen titles cost 5 KB per zip, ~0.3 KB each), so the remaining
  ~312 strings fit inside `verify:prod`'s 2.5 MB JS cap with room to spare. Two rules keep that true: regenerate with
  `node scripts/gen-i18n-packs.mjs` (never hand-edit a pack — position is
  meaning, and `loadPack` refuses a pack whose length disagrees with the key
  list), and keep copy short with numbers as placeholders. Re-check the budget
  line `verify:prod` prints after each batch.
* **Run-end progression goes through the celebration, never through `toast()`.**
  The toast lane is capped at 2 in menus and 1 in flight and evicts the oldest
  (`HUD.ts` `toast()`), so a run that ends with four rewards used to show one of
  them and silently drop the rest — the rarest one first, because it arrived
  last. `ProgressBeats.planCelebration()` now ranks every reward the run earned
  by rarity, stages the top three quietest-first on the results card, keeps the
  remainder as compact ledger chips (`LEDGER_CHIP_CAP` = 4, then `+n more`), and
  emits **one** `happyTime(peak)`, **one** audio cue and confetti scaled to the
  rarest beat. Adding a new reward type means adding a `ProgressEvent` kind and a
  weight there — not another toast. Mid-run toasts (a record, a trophy) stay.
* **`happyTime` call sites are two, on purpose.** One at run end at the
  celebration peak (`Game.ts` ~:3635) and one per mid-run trophy unlock (~:5934),
  suppressed when trophies unlock in a batch (`portalAchievement(id, false)`).
  Poki's guide says use it sparingly; a fourth call site needs a reason.
* **Do not remove the results → menu commercial break.** An external audit
  reported our break count as wrong (3 expected, 2 found); that failure came from
  *their* uncommitted change to `Game.ts`. Our tree's `poki-analytics` contract
  passes as shipped.

* **Parsing CSS in a test needs three things stripped first.** Comments (a block
  comment otherwise glues itself onto the next rule's selector and silently fails
  an exact match), custom-property *definitions* — anywhere, not just at line
  start, because `index.css` has compact single-line rules like
  `.pc{--pc-bg1:#fff;…}` — and `var(...)` groups, whose fallback hexes are safety
  nets rather than committed colours. Get any of the three wrong and the test
  passes while reading the wrong value.


## 4. Where the remaining risk actually is

Not in features. The audit that produced this queue concluded the game is
"technically much closer to a real product than the first audit suggested" and
that the risk is proving one dominant player habit:

> *I want to fly again immediately because something funny, competitive, or
> personally meaningful just happened.*

Concretely: 311 player-facing strings are still English-only (219 of them toasts,
44 `aria-label`s, 48 button labels — `pnpm i18n:audit` owns these numbers and the
ratchet, so restate them from its output, never from prose); the results screen is
the growth engine and its instrumentation is complete — eight funnel stages go to
Poki's dashboard as canonical `measure()` events (`Game.ts:5975`), and the direct
build additionally aggregates server-side (`funnel_summary` →
`GET /mp/v1/telemetry/funnel` → `pnpm funnel:report`, which prints its own
population caveats). What is missing is the return leg: no decision in this repo
has ever cited a dashboard number. See
[`audits/BRUTAL_REPO_AUDIT_2026-09-24.md`](./audits/BRUTAL_REPO_AUDIT_2026-09-24.md)
§6; and population — not protocol — is what decides whether the multiplayer work
reads as alive.

All three are parked (§5). While the project is Poki-only the live risk is
narrower and cannot be retired from this repo: the five `action` rules in
`pnpm poki:audit` need a human at the dashboard or a GPU (§6), and the CSP
decision sits behind them — until Poki stores the host list in
[`poki/CSP_REQUEST.md`](./poki/CSP_REQUEST.md), the submitted build boots, looks
healthy, and plays alone: no AUDS boards, no Netlib rooms, no shared run codes.

## 5. Next queue, in order — Poki only

**Since 2026-09-23 this queue holds nothing but Poki submission and compliance
work.** Four parked items were revived and shipped the same day, each because it
feeds the submission rather than distracting from it:

1. **Progression feel** — `ProgressBeats.ts`, the results-card celebration strip
   and the in-run wings proximity meter (34 tests, 8 barrel keys × 36 locales,
   i18n debt 340 → 330). See §3 for the rule it established.
2. **The i18n bundle cost** (archive §2) — positional packs took 111 KB of
   repeated key names out of every bundle; a key now costs ~0.45 KB per zip
   instead of 0.75 KB. That was the blocker on every remaining translation
   batch, and it is gone.
3. **Music pass 3, code half** (archive §8) — arrangement sections: the band
   re-arranges per phase of a flight instead of one loop riding louder.
4. **Funnel aggregation** (archive §4) — `GET /mp/v1/telemetry/funnel` and
   `pnpm funnel:report` answer "where do players drop off", which is what §6
   step 5 needs to read a playtest.
5. **i18n batch 3** (archive §1) — all 17 screen titles plus the back button's
   aria-label, 17 keys × 36 locales: the `screenTitle` debt category is now
   **zero**, and `screen-titles.test.ts` pins what the i18n suite never did —
   that every `t()` fallback matches the barrel's `sourceText` word for word.

Still parked in
[`archive/GAME_BACKLOG_2026-09-23.md`](./archive/GAME_BACKLOG_2026-09-23.md):
i18n batches 4+ (312 strings: 220 toasts, 48 button labels, 44 aria labels —
unblocked, and now ~0.45 KB per key; the natural next batch is the menu
destination grid in `MenuCatalog.ts`, 18 titles + 18 details), browser
verification of instant-retry, **recorded** music material, the
`Game.ts`/`HUD.ts` decomposition, native proofing of `vi`/`mt`, and the
live-traffic cohorts (which now also own the durable-analytics-store decision
that D1/D7/D30 retention needs). Its recipes are intact — move an item back here
when work on it resumes, and delete it from the archive.

The code side of Poki compliance is **done**. `pnpm poki:audit` reports
116/131 rules satisfied; of the rest, 10 are `informational` (reference material
and business terms lifted from the guide — nothing to build) and 5 are `action`,
each needing a human at the dashboard or a machine with a GPU:

| # | Rule | What is actually left |
| --- | --- | --- |
| 1 | `TOOL-09` | Diff the game id against the dashboard. It is already wired in `build:poki`, pinned by `poki-build-ids.test.ts`, and absent from every other edition — only the human confirmation is open (§6.1) |
| 2 | `REQ-66` | Three dashboard steps in a fixed order: privacy URL, then CSP, then re-upload (§6.2) |
| 3 | `REQ-52` | Walk the Inspector QA modules on the unzipped folder (§6.3) |
| 4 | `THB-09` | Capture the animated 3–5 s thumbnail on a GPU machine — the script exists, sandboxed renderers cannot (§6.4) |
| 5 | `EA-09` | Upload to Poki Playtest, record sessions, read the first-run funnel (§6.5) |

## 6. Poki submission — the runbook for those five actions

1. **`TOOL-09` — confirm the issued game id.** On the Poki developer dashboard,
   copy the game's id and diff it against `VITE_POKI_GAME_ID` and
   `VITE_POKI_NETLIB_GAME_ID` in `package.json`'s `build:poki` (all three must be
   the same value — AUDS and Netlib are the same game). `package.json` is the only
   place the id lives; `.env.example` carries a placeholder on purpose, and a test
   fails if a second copy appears. If the id changes: edit `build:poki`, run
   `pnpm build:poki`, then confirm it is in `dist-poki/index.html`, in neither
   `dist-crazy/` nor `dist-generic/`, and that `pnpm isolation:check` stays green.
2. **`REQ-66` — privacy URL, then CSP, then re-upload, in that order.** Game
   settings → Privacy Policy URL = `https://sunbird-snowy.vercel.app/privacy`
   (Poki will not store a custom CSP until the policy is live). Then Settings →
   Content Security Policy → paste the hosts and reasons from
   [`poki/CSP_REQUEST.md`](./poki/CSP_REQUEST.md) — 5 hosts across `script-src`,
   `connect-src` and `webrtc-connect-src`; regenerate it with `pnpm gen-csp` if
   `src/game/legal.edition.poki.ts` changes. Then re-upload the build *after* the
   CSP review completes, so the CDN cache resets. Multiplayer and AUDS both need
   those `connect-src` hosts; without them the game boots and silently plays alone.
   What you paste is machine-checked first: `pnpm verify:csp` reads `dist-poki/`
   and fails if the bundle touches a host the document does not list, or lists one
   it never touches — so the request cannot be short, and cannot be padded.
3. **`REQ-52` — Inspector QA.** Drag `poki-upload/` (the folder, not the zip) into
   the Poki Inspector and work the modules: Event Log sequences, External
   Resources, Image Optimization, scaling tests, the mobile QR. Warnings must end
   at zero. `pnpm verify:upload` pre-checks the folder-shaped rules locally, and
   `pnpm poki:preflight` runs the portal half of the gate before you upload.
4. **`THB-09` — animated thumbnail.** `node scripts/capture-animated-thumbnail.mjs`
   on a GPU machine: it serves `poki-upload/`, plays a scripted dive-glide loop and
   writes `assets/submission/sunbird-thumbnail-animated.gif`. Sandboxed and CI
   renderers read WebGL back too slowly for a smooth capture, so this one cannot be
   automated here. The static thumbnail is already in place for the player-fit test.
5. **`EA-09` — Playtest recordings.** Upload to Poki Playtest and record real
   first-run sessions. The client already emits every funnel stage, so the
   recordings are for watching behaviour the events cannot show — where a player
   hesitates, what they tap first, whether the gated shop auto-open reads as help
   or as interruption.

   **Where the funnel numbers come from, per build.** Portal builds send no
   telemetry to our backend (compliance forbids it), so for Poki traffic read
   Poki's own dashboard: every stage is also emitted as
   `measure("player", "funnel-<stage>", "reached")`, which is exactly the shape
   their funnel report wants. For the direct build and for local sessions, the
   aggregation is ours and it is one command — `pnpm funnel:report` (or
   `SOCIAL_URL=… pnpm funnel:report`) prints stage-by-stage reach, step-to-step
   conversion, where sessions stalled, and the single worst step. Two limits to
   keep in mind while reading it: the sink's counters are in-memory by design (a
   restart resets them — it refuses to be a tracking system), and ingest is
   rate-limited per IP, so a whole playtest cohort behind one NAT under-reports.
   Read the shape and the worst step, not the totals.