# Rebuild report — what applying the Poki guide changed

**Date:** 2026-09-17 · **Branch:** `arena/01a0b118-sunbird`
**Input:** the Poki developer guide, extracted into [`docs/poki/`](./README.md) (113 numbered rules, 72 of them hard requirements)
**Gate:** `pnpm poki:audit` → [`COMPLIANCE.md`](./COMPLIANCE.md) · `pnpm verify:thumbnail` · `pnpm verify:portals` · `pnpm verify:upload` · `pnpm test` (1026 tests)

This is the audit trail for the rebuild: every landed change, the rule it comes
from, and how it can be re-checked. Nothing here is "we believe"; each line has
a verifier.

## 1. The game already satisfied most of the guide — the gap was *provability*

The previous compliance pass (`../audits/POKI_COMPLIANCE_AUDIT.md`) had already fixed
the behavioural defects the rules care about (run-outcome funnel, rewarded
placement analytics, fake ad affordances, scaling sizes, coin faucets). What was
missing was that none of it was **executable**: the rules lived in a 30 KB
markdown audit and in the reviewer's memory. So the rebuild starts by making the
guide itself part of the repository.

| Change | Rule | Verifier |
|---|---|---|
| Extracted the whole guide into 10 numbered-rule documents + `requirements.json` (113 rules: 72 requirements, 31 recommendations, 10 informational) | — | `docs/poki/*.md`, `node scripts/poki-audit.mjs` |
| Added `scripts/poki-audit.mjs`: runs every rule's verification method, rewrites `COMPLIANCE.md`, exits non-zero on failure | — | `pnpm poki:audit` |
| Added `pnpm verify:thumbnail`, `pnpm render:thumbnail`, `pnpm poki:audit` | — | `package.json` |

Result: **98/113 rules machine-verified** (99 satisfied, 3 submission actions,
1 accepted deferral, 10 informational). The remaining 15 are listed by name in
`COMPLIANCE.md` §"Actions and accepted gaps" — never hidden, never assumed.

## 2. Engine decision, recorded (ENG-01…ENG-05)

The guide's engine page is a decision framework, not a menu. Applied to this
game it selects the branch the repository already took: **hand-rolled systems on
Three.js (MIT, 151 KB / 122 KB Brotli base) with a fully procedural asset
pipeline**, because `ENG-02` makes mobile web fit a *requirement* (initial
download < 5 MB, total < 8 MB) and every listed engine's empty build (290 KB –
11 MB) is a floor Sunbird cannot go under. The trade — owning physics,
animation, netcode and lifecycle — is documented in
[`01-web-game-engines.md`](./01-web-game-engines.md) §Part 4 and is what keeps
the Poki artifact near 700 KB.

No engine was swapped in. The deliverable is the *documented* decision plus a
gate that keeps it honest (`verify-portal.mjs` fails above 8 MB).

## 3. New code demanded by the extracted rules

### 3.1 `src/sdk/device-report.ts` — the Player Device Report as a probe (DEV-03…DEV-16)

The report lists what the platform measures: OS/browser, CPU cores, aspect
ratios, device pixel ratios, audio formats, WASM / WebRTC / WebP / WakeLock,
WebGPU + WebGL versions and extensions, and AI features (translator, language
model, summarizer, detector). `DEV-03` turns that into an obligation: *code to the
measured baseline.*

- One synchronous, side-effect-free, injectable probe covers **every** dimension
  the report publishes, including the one that was previously faked: WebGL
  capability was inferred from the UA and a `isMobile` heuristic.
- It derives a **quality tier** (`high` / `standard` / `lite`) from measurements,
  and the game reads that tier for shadows, pixel ratio and recovery.
- It reports one aggregate, identifier-free payload per session
  (`device_profile`), so our tiers can be compared against the platform's
  published distribution — and logs the same line in dev, which is how the
  tier behaviour stays visible during development.
- The AI probes are **detection only**: no AI-generated player-visible content
  ships (`REQ-34`), and the probes exist so a future localisation or moderation
  feature can be feature-detected instead of assumed.

Tests: `src/sdk/__tests__/device-report.test.ts` (17 cases, including a hostile
environment where every accessor throws — the probe must degrade, never throw).

### 3.2 `src/game/WakeLock.ts` — WakeLock where it actually matters (DEV-14)

WakeLock is on the report's list of essential APIs; for this game it has a
concrete job — a run is a long, low-interaction stretch, which is exactly when a
phone dims and suspends the tab mid-flight. The lock is:

- **feature-detected** (unsupported is a silent no-op — iOS Safari, older
  webviews, battery savers),
- **held exactly while flying** (driven from `Game.setState`, so menus, pause,
  sleep, results and ad breaks all release it),
- **re-acquired after a hide/show** (the platform drops the lock when the page
  hides, and the player is still in their run),
- **race-safe** (a lock that lands after the run ends is released immediately),
- **never noisy** (rejections are swallowed and routed to telemetry — portal QA
  treats console errors as defects, `REQ-02`).

Tests: `src/game/__tests__/wakelock.test.ts` (7 cases).

### 3.3 `src/game/BootProgress.ts` — a loading bar that is a measurement (EA-04, EA-05)

`EA-04` requires a visually engaging loading screen **with a progress bar**;
`EA-05` requires progressive loading, essential assets first. The repository
already had a good-looking inline boot screen — and the bar on it was an
indeterminate CSS slide that ran regardless of what the game was doing.

- Seven weighted stages (`shell → chunk → engine → world → hud → flight → ready`)
  are marked as the game actually reaches them; the inline bar switches from
  indeterminate to a real width, and stays honest on slow connections (it stalls
  where the work stalls).
- `ready` is terminal: it closes out every earlier stage, so the bar can never
  stall short of 100 %.
- `defer()` queues non-essential work on `requestIdleCallback` (with a timeout
  fallback) — the leaderboard warm-up and audio priming now load **after** the
  first interactive frame instead of blocking it.

Tests: `src/game/__tests__/boot-progress.test.ts` (9 cases).

### 3.4 `src/game/ContinueOffer.ts` — context-driven rewarded placement (MON-19)

`MON-19` asks for dynamic, context-specific rewarded opportunities instead of
static always-on buttons, while `MON-03…MON-15` fence the placement in. The new
module picks the *framing* from what the run just did — personal record,
near-best (with the exact gap), streak on the line, momentum — and falls back to
the neutral "Second Wind" card otherwise. Boundaries kept deliberately outside
the module:

- it cannot invent an ad: when the platform offers no rewarded break the kind is
  forced to `standard` and the copy contains no ad language (`MON-12`);
- it cannot become pushy: the standard coin option and the free "let it sleep"
  option keep the primary position and size (`MON-05…MON-08`, `MON-15`);
- it never grants anything — the single grant site is still `Game.doContinue()`
  (`MON-10`, `MON-11`).

Placement analytics now carry the context: `measure("button",
"continue-ad-<kind>", "visible"|"interact")`, so the platform dashboard can tell
which contexts convert (`REQ-14`).

Tests: `src/game/__tests__/continue-offer.test.ts` (9 cases).

## 4. Standards applied to shipped code

| Change | Rule | Verifier |
|---|---|---|
| Movement keys standardised: dive/hold now accepts **WASD and arrows** as well as Space (and still nothing is stolen from a focused control) | `EN-02` | `input-ui.test.ts` (+9 cases) |
| **Space/Return activate an overlay's primary action** even when focus sits on the dialog heading (the overlays move focus there for screen readers), without hijacking a control's own activation | `EN-02` | `overlay-navigation.test.ts` (+4 cases) |
| Locale set completed to the guide's phase order: **Turkish** (phase 1), **Russian** (phase 3) added — 12 locales × 44 strings | `LOC-04` | `i18n/__tests__/locales.test.ts` |
| Browser-language matching hardened: `pt`/`pt-PT` → `pt-BR`, `zh-Hant` → `zh-CN`, case/separator-insensitive, `navigator.languages` fallback list | `LOC-05` | `i18n/__tests__/locales.test.ts` |
| Barrel integrity: every shipped locale complete, every placeholder preserved, and every copy byte-identical — `src/` ⇄ `public/`, plus the generated upload folder when it exists | `LOC-02` | `i18n/__tests__/locales.test.ts` |
| Device tier now gates shadows and the 2× pixel-ratio path (a measured-lite device with a desktop UA no longer gets a buffer it cannot fill) | `DEV-03`, `ENG-02` | `device-report.test.ts`, existing perf guards |

## 5. Thumbnail rebuilt to the letter of the spec (THB-05…THB-10)

The gate measured the shipped art and failed it on one specific rule:

> **`THB-08`** — "High contrast is vital … avoid using colours similar to the
> Poki Playground background (`#83FFE7`)."

Measured: the thumbnail's bright cyan sky and spring-green islands put **30 % of
its pixels within 70 (RGB distance) of `#83FFE7`**, with the dominant colour
only 66 away. On the playground page it read as part of the background.

Changes:

| Change | Rule |
|---|---|
| `scripts/verify-thumbnail.mjs`: pure-Node PNG measurement gate — square, ≥ 628 px, full-bleed (no transparency), corners painted and not flat (no baked rounding/letterbox), luminance spread, distance from `#83FFE7`, contrast re-measured **at 128 px**, delivered weight | THB-05…THB-08, THB-10 |
| `scripts/render-thumbnail.mjs`: deterministic colour grade (smooth hue bands — sky rotated/deepened, foliage deepened and muted, bird/sun kept rich, near-neutral and near-white pixels untouched) applied to the raw master | THB-08 |
| Deliverables regenerated from the untouched master in `assets/submission/art/`: `sunbird-thumbnail-1024.png` (1505 KB → 1150 KB) and the new spec-minimum `sunbird-thumbnail-628.png` (445 KB) | THB-05, THB-10 |
| `scripts/png.mjs`: dependency-free PNG codec with adaptive row filtering and a box downscaler (the repo ships no native image dependency, and portal builds ship no raster assets at all) | THB-10 |

After the grade: **6.7 % of pixels** within 70 of the playground colour, dominant
colour distance **150**, luminance spread **145** (128 px: 140), corners painted.
Re-check with `pnpm verify:thumbnail`.

## 6. What the audit says is still open

`COMPLIANCE.md` currently lists:

| Rule | Status | Why |
|---|---|---|
| `EA-09` | action | Playtest recordings are a platform workflow; the build's funnel instrumentation is ready. |
| `THB-09` | action | The 3–5 s animated thumbnail (hover video) must be captured from a real session — not producible in this sandbox. The game is capture-ready. |
| `REQ-52` | action | Inspector QA walk (Event Log sequences, External Resources, Image Optimization, scaling tests, mobile QR) happens at submission on the unzipped folder. |
| `TOOL-08` | deferred | AUDS requires a live Poki game id and is platform-exclusive, so it cannot be a dependency of the portable builds. Leaderboard/ghost seams are shaped for it post-launch. |

## 7. Verification run for this report

| Gate | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm test` | **1026 passed** (77 files) — 77 new cases added by this rebuild (baseline: 949) |
| `pnpm test:server` | 7 passed |
| `pnpm lint` | clean (`--max-warnings 0`) |
| `pnpm build` | clean — 1.76 MB single-file portal bundle, 557 KB gzipped |
| `pnpm verify:prod` | PASS — debug artifacts clean (the device summary moved to the telemetry surface), 1.41 MB JS total of a 2.50 MB budget, largest chunk 0.57 MB of 1.50 MB, coverage floors met |
| `pnpm build:portals` + `pnpm verify:portals` | poki 829 KB · crazy 820 KB · generic 819 KB — gate PASSED |
| `pnpm audit:zips` | ZIP AUDIT PASSED (after reconciling the anatomy/pattern rules with the packaging script — see §8) |
| `pnpm poki:audit --run` | **99/113 verified**, 0 failures, `COMPLIANCE.md` rewritten, gates executed |
| `pnpm verify:thumbnail` | THB gate passed |
| `pnpm verify:upload` | **UPLOAD READY** — `ROOT-01`…`ROOT-07` (folder root, no wrapper, freshness, junk-free, zip ≡ folder, references resolve, Poki-only markers) |
| `pnpm verify:portals` + `pnpm audit:zips` | per-zip isolation: no foreign portal marker in any bundle (§11) |
| CI (PR #14, run for `3ff31af`) | **all 13 checks pass** — incl. *Artifact (Inspector folder in a real browser)* and the portals job with the isolation + upload gates; the browser log records `init → gameLoadingStart → movePill → gameLoadingFinished → getURLParam → getUser` (one loading phase) |

## 8. Two repository gates disagreed — reconciled

Running the extracted rules end to end surfaced a defect in the repository itself:
`scripts/audit-zips.mjs` (the deep portal-zip pass) and
`scripts/package-portal.mjs` (the packager) contradicted each other, so the deep
pass could never pass on a correct build. The audit claimed the artifact says
one thing while the packager shipped another:

| Finding | What was actually true | Fix |
|---|---|---|
| "unexpected zip entry `i18n/`" | The packager copies the locale barrel into every zip on purpose; the audit's allowed-anatomy list did not know about it (and it is consistent with the guide's external-resources policy: bundle, don't fetch). | Anatomy check now allows `index.html`, `icons/`, `fonts/`, `i18n/`. |
| "hardcoded WebSocket backend URL" | The match was `wss://netlib.poki.io/…` — the platform's own P2P signaling endpoint, recommended by the guide (`TOOL-04`), carried as a default by the vendor library. Our backend URL is correctly blanked in portal builds. | The pattern now bans every WebSocket URL **except** the Netlib signaling host. |
| "raw IP address" | The match was `127.0.0.1` inside the vendored WebRTC candidate filter (loopback candidates are dropped on purpose). | Loopback/private literals are allowed; **public** IP literals still fail. |
| "missing `gameLoadingFinished`" in the crazy/generic bundles | The Poki adapter is compiled out of those bundles by design — requiring a Poki signal in a CrazyGames build was the audit's bug. | SDK-specific required strings are now checked per portal (`poki` needs its loading/break signals, `crazy` its SDK loader, `generic` the local adapter). |

With the contradiction resolved, `pnpm audit:zips` is green and the corpus rules
that cite it (`TOOL-02`, `REQ-22`, `REQ-35`, `REQ-51`) are verifiable with
`pnpm poki:audit --run` instead of asserted by hand.

## 9. One more gate for CI-minded readers

`pnpm test:e2e` includes a new `e2e/input-standards.spec.ts` (arrow-key flight
that must not scroll the host page; Space activating an overlay's primary action
from the dialog heading). The browser download for Playwright is blocked in the
sandbox where this rebuild was produced, so those two specs were **not executed
here** — they are discovered by `pnpm test:e2e --list` and run in CI. Every other
gate in §7 ran locally.

## 10. "missing index.html" — the Inspector folder, and why it went stale

A real upload to <https://inspector.poki.dev/> was rejected with **"missing
index.html"**. The Inspector's own documentation states the shape it wants
(`08-game-dev-tools.md`, `TOOL-03`): *"If you are accessing the Poki Inspector
directly, open your game's **folder** to upload it"* and *"drag and drop your
game folder that contains an `index.html` file"* — a **folder**, with
`index.html` at the **root of the folder you select**.

The repository had two defects that could produce exactly that error, and one
that guaranteed the folder would rot:

| Defect | Evidence | Fix |
|---|---|---|
| The upload folder was a **hand-committed snapshot** (`poki-upload/` was tracked, 1.68 MB of pre-rebuild html) that no build refreshed. It was byte-different from `dist-poki/index.html` and had not moved through the latest rebuild. | byte compare against `dist-poki/index.html`; only the packaging step knew the current bytes | `poki-upload/` is now **generated on every `pnpm build:poki`**, byte-identical to the zip's `index.html`, git-ignored, and stamped with `upload-manifest.json` (source hash + staged hash + timestamp) |
| The build output itself was a trap: `dist-poki/` carried `sw.js` + `manifest.webmanifest` next to `index.html`, so a naive folder selection shipped PWA plumbing the portal forbids. | the packager stripped them from the zip only | the packager now **removes** them from `dist-poki/`, `dist-crazy/`, `dist-generic/`, so every folder in the tree is upload-shaped |
| Nothing verified the upload shape — the gates checked the *zip's* content, never "would the Inspector accept this folder". | no gate referenced the folder | new `scripts/verify-upload.mjs` → `pnpm verify:upload`, wired into `poki:preflight` and CI, and now the recorded verifier for `TOOL-03` |

`verify:upload` implements the Inspector's first checks as `ROOT-01`–`ROOT-07`:
root `index.html` in **both** the folder and the zip; no wrapping directory in
the zip; the folder proven **fresh** (packaging-manifest hash, `dist-poki`
source hash, and a byte-identical final 4 KB against `dist-poki/index.html`);
only uploadable files (no `sw.js`, manifest, sourcemaps or dotfiles); zip and
folder byte-identical; every local reference in the shipped html resolving
inside the folder; and `ROOT-07`, the Poki edition carrying no other portal's
markers (§11).

Each failure mode was **negative-tested** rather than assumed:

| Injected defect | Gate response |
|---|---|
| tail of `poki-upload/index.html` edited (a stale snapshot) | `ROOT-03` "was edited after packaging" + "does not carry the current build's code" → exit 1 |
| `index.html` renamed away (the reported error) | `ROOT-01` `index.html MISSING — the Inspector would say "missing index.html"` → exit 1 |
| zip re-created with a `sunbird-main/` wrapping directory (the GitHub "Download ZIP" shape) | `ROOT-02` "zip is wrapped in a directory: sunbird-main/" → exit 1 |

### A duplicate event the Inspector would have flagged

The artifact test immediately earned its keep. On its first green run the
recorded event log read:

```
init → gameLoadingStart → movePill → gameLoadingFinished → getURLParam → getUser
     → gameLoadingFinished → signalGameReady
```

`gameLoadingFinished` was sent **twice** — the second time by
`scheduleFailsafeFinish()` in `src/sdk/platform.ts`, the net that releases
Poki's loading screen if the game never mounts. The net called the raw
`window.PokiSDK` global, so it fired unconditionally 1.5 s after window load
even on a healthy boot, sidestepping the one-shot guard inside
`PokiAdapter.loadingFinished()`. `REQ-10` ("each phase marker once") was marked
satisfied with a unit test that only covered the adapter, not the entry point.

The failsafe now routes through the live adapter (one-shot) and falls back to
the target's **registered net** only when no adapter exists at all — the crash
it was written for. The net body lives in the Poki adapter module
(`src/sdk/net.ts` + `poki.ts`), so shared code names no portal SDK (see §11).
`src/sdk/__tests__/platform-failsafe.test.ts` pins the routing and
`src/sdk/__tests__/poki-loading-net.test.ts` the net itself: the healthy boot is
signalled once, and a boot that never mounts is still released. The e2e test now
settles past the failsafe window before asserting, so the race that hid this
cannot hide it again.

The runbook that replaces the old "unzip and hope" instruction is
[`UPLOAD.md`](./UPLOAD.md); `SUBMISSION_CHECKLIST.md` step 2 now says
`pnpm upload:poki` followed by dragging the generated `poki-upload/` folder.

## 11. Every build is its own way — per-version isolation

The standing requirement is that each artifact is *its own build*: only its own
SDK and integrations, no other portal's markers. An audit of the shipped
`index.html` of every target (grep counts) found real cross-contamination, all
of it from **shared** modules:

| Marker | poki | crazy | generic | Cause |
|---|---|---|---|---|
| `window.PokiSDK` fallback text | own | **1 (leak)** | **1 (leak)** | the loading-net fallback lived in `platform.ts` behind `if (TARGET !== "poki") return;` |
| `CrazyGames` edition string | **2 (leak)** | own | **2 (leak)** | one HUD ternary naming all three portals, plus the ad-label ternary |
| `"☁️ Poki cloud"` leaderboard label | own | **1 (leak)** | **1 (leak)** | same HUD function |
| `stripe` (dead checkout code + CSS) | **4 (leak)** | **4 (leak)** | **4 (leak)** | shared payment strings, telemetry names and dead CSS |
| `crazyEnvironment` key | **3 (leak)** | own | **3 (leak)** | boot-result field name |

The minifier inlines `TARGET` as a literal and **does** fold positive
`TARGET === "poki"` branches (the Poki CDN URL is absent from the other
bundles) — but it does **not** fold a negative early-return guard, and a
runtime ternary on the portal name is never folded at all. Four fixes, all
structural rather than cosmetic:

1. **The loading net moved into the target module.** `platform.ts` no longer
   names any portal SDK; it calls `runLoadingNet()` from `src/sdk/net.ts`, and
   the Poki adapter registers the raw-global release at module scope. Non-Poki
   builds alias that module to `_shim.ts`, so it is not even in the graph.
2. **Edition strings are per-target files** (`src/game/edition.ts` +
   `edition.poki.ts` + `edition.crazy.ts`), swapped by the same alias plugin
   that shims the adapters. No build can name another portal's brand.
3. **Names that ship as object keys were de-branded** (`crazyEnvironment` →
   `platformEnvironment`, `CRAZY_BANNER_ID` → `PORTAL_BANNER_ID` /
   `VITE_PORTAL_BANNER_ID`), and dead payment code was deleted rather than
   scrubbed: the `"stripe"` checkout mode, its telemetry event, the grant
   source, and the unused CSS classes.
4. **A second, unrelated leak:** two comments in the shared `index.html`
   template ("…external-resource warnings on Poki", "(Poki EA-04 …)") survive
   into *every* bundle verbatim — HTML/CSS in the template is not minified
   away. They now say "portals" / "EA-04".

Before/after, same grep, same files:

```
BEFORE  dist-crazy   PokiSDK=1  poki=5   CrazyGames=6   stripe=4
        dist-generic PokiSDK=1  poki=5   CrazyGames=2   stripe=4
        dist-poki    CrazyGames=2 crazy=2  stripe=4
AFTER   dist-crazy   PokiSDK=0  poki=0   CrazyGames=6   stripe=0   (own only)
        dist-generic PokiSDK=0  poki=0   CrazyGames=0   stripe=0   (fully neutral)
        dist-poki    CrazyGames=0 crazy=0  stripe=0      sdk.poki=own
        dist / dist-itch  every portal marker 0
```

The invariant is now **machine-checked** rather than audited by hand:
`scripts/portal-markers.mjs` holds the table, `verify-portal.mjs` fails a zip
that carries a foreign marker (it used to *note* the foreign SDK literal as
expected — that allowance is gone), `audit-zips.mjs` does the same for the
deep zip audit (verifier of `REQ-51`, web exclusivity), and `verify-upload.mjs`
adds `ROOT-07` for the Inspector folder. CI's portals job runs all of them, and
each gate was negative-tested (injecting `sdk.crazygames.com` into the generic
zip fails the audit with a named finding; removing the net registration fails
`poki-loading-net.test.ts`).

## 12. Mode & menu audit — "emote does nothing", chat, and PvP that wasn't PvP

Three player-facing defects were reported against the built game. Each was
reproduced by reading the shipped code path, fixed at the root, and pinned.

### 12.1 Emotes appeared to do nothing

| Cause | Evidence in code | Fix |
|---|---|---|
| The wheel was gated on `state === "playing"`, so it was **invisible in the Race Lobby** — where a room's players gather, and the first screen a PvP player selects | `HUD.update`: `classList.toggle("hidden", !(s.massRace && s.state === "playing"))` | visibility is now `emoteWheelVisible(s)` — a function of the race field only. The signature has no `state` argument, so the old gate cannot come back |
| The sender's only feedback was a ~8 px emoji on their **roster dot** (off-screen when leading); the in-world bubble belongs to the sim clock, which is frozen in the lobby | `MassRace.showEmote` → `emoteFor` measured against `this.clock` | new `HUD.pulseEmote()` pops the player's own bubble instantly (throttled, `aria-live`, auto-fades in 2.2 s). `Game.sendEmote` also stopped firing a toast, whose layer sat above the wheel and swallowed the tap that sent the emote |
| Rate-limit used the **run** clock (`this.elapsed`), which never advances in the lobby | `Game.sendEmote`: `this.elapsed - this.lastEmoteAt < 1.2` | rate-limited on `performance.now()` |

Tests: `src/game/__tests__/emote-ui.test.ts` (6 cases: visibility, six labelled
buttons, bubble pop / auto-fade / rapid re-pop) and `massrace.test.ts` (an
emote is visible without a `step()`, and still expires). Each was
negative-tested: removing the bubble's un-hide fails two cases.

### 12.2 Chat shipped in portal builds (Poki REQ-31)

`game-note: "chat is not allowed in poki"`. The club chat box, its input, the
chat promise in two menu copies and the chat polling loop were in **every**
build. Portal editions now compile chat out entirely — `SQUAD_CHAT = false` in
`edition.poki/crazy/generic.ts`:

| Surface | Direct/web/itch | Portal editions |
|---|---|---|
| Club chat log + message input | yes | **not rendered**, and the Squad copy says "Friends & clubs" |
| `Game` action `squad-chat` | sends | `if (!SQUAD_CHAT) break;` → minifies to `case"squad-chat":break;` (no trigger in the DOM) |
| `SquadClient.sendChat` / `pollChat` | live | dead return / no polling — no chat endpoint is ever contacted |
| Enforcement | — | new `PORTAL_FORBIDDEN_MARKERS` in `scripts/portal-markers.mjs`, checked by `verify-portal`, `audit-zips` and `verify-upload` `ROOT-07` |

Negative-tested: injecting `Message your club` into the Poki zip fails the
portal gate with *"club chat input (REQ-31 forbids chat surfaces)"*. The
sanctioned alternative — emotes — is now reachable in every race state, which is
what §12.1 is about.

### 12.3 "PvP" started an offline AI race

The screen said *Championship & PvP Circuits*; every one of the eight circuit
cards called `pick-mode`, which started a **solo run against the AI flock** —
no lobby, no options, no notice. The same mis-wiring reached "Quick Match", the
one-tap online hero, which called `launchMatch(..., true)` (forced local) for
every player. And "AI Practice" cards used the same action, so any fix had to
split the two intents.

| Route | Behaviour |
|---|---|
| `launchIntentFor(id)` (new `src/game/launchRouting.ts`) | `pvp_*` → **`pvp-options`**, `massrace` → `lobby`, everything else → `solo` |
| Modes screen → a PvP circuit card | opens the Race Lobby with that circuit preselected (ranked, casual, private room, or AI flock) and says so in the toast |
| New **AI PvP** destination (home menu, `open-practice`) | the explicit offline route: race the neural flock, same eight circuits, opponent count + skill |
| Practice screen (retitled **AI PvP**) | its cards now use the new `ai-pvp` action — every one of them really does start an AI race, as its copy promises |
| `quick-match-instant` | routes through `beginMatchmaking` (real public matchmaking) instead of forcing a local race |
| No transport in the runtime | `beginMatchmaking` now **says** "Online racing is unavailable here — starting an AI flock race" instead of silently pretending |

Tests: `src/game/__tests__/launch-routing.test.ts` (4 cases, including "no
unknown id is treated as PvP" so a bad `data-id` cannot seat a player online).
Audit of the rest of the surface: every `data-action` in the HUD has a handler
or is handled locally (`toggle-emotes`, `shop-*`, `preview-skin`,
`dismiss-copy`), every `UiScreen` has a renderer, and every screen has a route
into it.

## 13. PvP actually verified, and a pilot lookup that isn't invented

The previous two sections fixed what the audit could see in the source. This
section is about the thing the source cannot prove: **that two players on two
devices really meet**. Everything below is executed by one command,
`pnpm pvp:check`, which boots the real room server on a scratch port (8795),
then runs three layers against it and fails unless all three pass:

| Layer | What it proves | Script |
|---|---|---|
| 1. Protocol smoke | two raw sockets see each other, receive a shared start and exchange live state frames | `scripts/mp-smoke.mjs` |
| 2. Live client suite | two **real `RealtimeClient` instances** join one room, adopt the host's seed, stream interpolated state, relay emotes, agree on one countdown, see a leave, and get a server-assigned finish place | `src/game/__tests__/pvp-live.test.ts` (7 cases) |
| 3. Pilot directory | unknown code → 404, real code → real name/presence/best, request → pending on both sides, accept → wingmen with a verified code | `scripts/smoke-pilot-lookup.mjs` (17 checks) |

The live suite found and pinned three real defects, all fixed:

| Defect | Symptom for a player | Fix |
|---|---|---|
| `roster().place` was hard-coded `0` | every rival row showed place 0, and `recordRivalResult` (Game.ts:1778) never saw a real placement | the finish frame's place is stored on the track and reported by `roster()` |
| the `peers` roster frame was merged, never reconciled | a pilot who left (or switched rooms) stayed "connected" forever — a ghost in the lobby | the frame is authoritative now: anyone absent is dropped, with a real `leave` event |
| leaving on purpose looked like a dropped socket | the room held your seat for the reconnect grace window, so everyone still counted you | `disconnect()` sends an explicit `leave` frame; the legacy gateway frees the seat immediately (Rust already frees it when the socket closes) |

The exact same honesty rule that §12 established for chat and PvP was then
applied to the squad screen, because it was the last place in the game that
invented people:

- **`DEFAULT_LOCAL_FRIENDS`** — four fictional pilots ("Echo Falcon", "Zephyr
  Sky", …) seeded into every offline build — deleted. Wingmen now start empty.
- **`INITIAL_CLUB_CHAT`** — invented club members talking about races that never
  happened — deleted; offline chat holds only messages this device received.
- **`DEFAULT_LOCAL_CLUBS`** — four clubs with fictional member counts, plus a
  default membership the player never joined — deleted.
- **`addFriend("SUN-XXXXXX")` offline used to invent a name from the code**
  ("Wingman-9F3K"). It now refuses honestly and says the lookup needs the
  online service.
- The wingman request flow no longer claims "added!" for a request that is
  still pending: the panel shows **Requests** (incoming with accept/decline,
  outgoing with cancel) and the toast says *"Request sent to …"* until the
  other pilot accepts. Re-adding an existing wingman answers "already a
  wingman" instead of queueing a duplicate.

What replaced the fabrication is real on both sides of the wire:

- `src/game/pilots.ts` (**new**) — a local book of the pilots this device has
  actually shared a room with: real names from real rosters, the room code, the
  best distance they flew, when you last saw them. Placeholders ("Pilot", "AI",
  empty) are rejected; nothing is ever invented. This is the "🛫 Flew with"
  list, and it works offline because it is real history, not a directory.
- `server/src/http/legacy.ts` — three routes the panel calls:
  `GET /social/players/:code` (real name, presence, club, best distance, rank,
  friend/pending state; 404 for unknown codes), `GET /social/friends/requests`
  (real pending in/out) and `POST /social/friends/respond|cancel`; the add route
  now reports `requested` / `accepted` / `friends` instead of implying success.
  Presence respects the pilot's `showPresence` privacy flag.

The panel itself ("🔍 Pilot Lookup" on the Squad screen) shows a code, a real
result card, the requests, the wingmen list with real presence and best
distance, and the offline banner says exactly what is and is not available.
Tests: `src/game/__tests__/pilot-lookup.test.ts` (13), `server/tests/pilot-lookup-routes.test.ts`
(7, driving the route handlers directly), `pnpm test:lookup` (17 live checks).

CI grew a `pvp-live` job that runs `pnpm pvp:check` on every push, so
"multiplayer works" is a checked claim rather than a remembered one.

### 13.1 One more gate: the state a test itself can be in

The live suite initially reported "7 passed" and still exited non-zero:
vitest was collecting fourteen unhandled `ERR_INVALID_ARG_TYPE` errors from the
Node WebSocket inside the jsdom environment (`The "event" argument must be an
instance of Event. Received an instance of Event` — two realms). The suite is
pinned to `// @vitest-environment node`, where Node's own `Event` and `WebSocket`
agree, and it now throws a clear error if no global `WebSocket` exists rather
than timing out mysteriously.

---

## 14. Async multiplayer by code, and the Rust/Poki split made checkable

Two Poki platform services were pasted alongside the request — **AUDS**
(arbitrary user data store) and **Netlib** (WebRTC P2P) — plus one instruction
that decided the shape of everything below: *"make sure Rust uses P2P and Poki
is separated"*. The split that satisfies it is the one the platform actually
implies: **Poki races peer-to-peer over Netlib and stores through AUDS; the
self-hosted authoritative stack (TS room server + `rust/`) serves direct,
CrazyGames and generic builds; neither knows the other exists.**

### 14.1 AUDS: the missing endpoint and the documented use case

`src/sdk/auds.ts` already wrapped create/read/list/update/delete. The docs'
public counter — `POST /v0/<game-id>/userdata/<key>/<id>/_increment?key=…`,
no secret, key must contain `count`, revision unchanged — was missing, so it is
now `PokiAuds.increment()`, with the documented constraints enforced client-side
(a key without "count" never leaves the browser) and every failure resolving to
`null` instead of a fabricated number.

The flagship AUDS use case per the docs is *"levels, leaderboards, even
non-real-time multiplayer"*. That last one is now a feature: **run share codes**
(`src/game/SharedRun.ts`).

* A finished run publishes `{name, seed, mode, distance, timeMs, place, bird}`
  under `sb:shared:run:v1` and shows the returned code on the results card.
* A friend pastes the code; the game loads the entry, teleports onto the same
  seed/mode — the existing rival-challenge path, delivered by code instead of a
  URL — and races the mark. The entry's play count is bumped through the public
  `_increment` endpoint.
* `topSharedRuns(seed)` reuses the same key as a per-seed mini board
  (`q=seed:…`, `sort=-distance`, `limit` clamped to the documented 1–100).
* **Every field from the network is hostile until proven otherwise:** a payload
  is rejected without a seed or a mark, names have control characters stripped
  and clamp to 14 chars, distance/time/place clamp to sane maxima. A share with
  junk in it becomes "no such run", never a broken race.

Availability is honest: `createAudsIfConfigured()` needs `VITE_POKI_GAME_ID`,
so every non-Poki build offers no share button at all rather than a dead one.

### 14.2 "Rust uses P2P and Poki is separated", made checkable

The instruction started as a phrase and is now four machine-checked statements:

1. **Source level** — `pnpm isolation:check` (`scripts/verify-isolation.mjs`):
   the Rust workspace references no platform integration at all (0 hits across
   13 source files); `@poki/netlib` is imported by exactly one module
   (`src/game/PokiNetlib.ts`) and that module reaches nothing self-hosted; the
   self-hosted transport (`src/game/Realtime.ts`) touches the Poki transport
   only as a type; the Poki-only modules name no self-hosted endpoint. Sabotage
   checks: appending the word "netlib" to a Rust file, or constructing the Poki
   client inside `Realtime.ts`, each fail the gate with a file:line.
2. **Bundle level** — the portal markers gained the mirror image of the foreign
   list: `REQUIRED_MARKERS` (a Poki zip must still carry netlib + AUDS + the
   SDK; CrazyGames must carry its SDK) and the self-hosted bans (`/mp/v1/`,
   `sunbird-social`, `ws://`) that no portal edition may contain. Wired into
   `verify:portals`, `audit:zips` and the Inspector gate (`ROOT-08`).
3. **Rust parity** — the Rust legacy gateway had no inbound `leave` frame, so an
   explicit exit only freed the seat when the socket dropped. It now handles
   `{"type":"leave"}` like the TypeScript gateway, with a unit test asserting the
   seat is freed *and* the remaining pilot is told. (No cargo in this
   environment, so the Rust edit is verified by CI's `cargo fmt`/`clippy`/`test`
   job.)
4. **Netlib id** — a submission no longer means editing a source constant:
   `VITE_POKI_NETLIB_GAME_ID` supplies the Poki-issued UUID, a malformed value
   is discarded in favour of the dev UUID rather than shipped, and the existing
   build-time folding keeps the whole Poki block out of other bundles.

### 14.3 The lobby stops inventing people

The race lobby's rival list had two fallback tiers of fiction: deterministic
name-pool "rivals" from `pvp.ts`, then borrowed leaderboard names presented as
room occupants. Truth is now the only source: `lobbyRivals(roster)` maps the
pilots actually seated in the room, zero peers means zero rows, and the empty
state says so ("Just you so far — share the code above and the room fills with
real pilots"). `featuredRivals()` survives only where it is honest — as the
generator for *simulated* opponents in local duels and the AI flock.

### 14.4 Verification for this round

| Check | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` / `pnpm typecheck:server` | ✅ clean |
| `npx vitest run` (whole suite) | ✅ 1080 passed / 8 skipped (83 files + 1 skipped) — +25 over the round-5 baseline (auds 8, shared-run 11, netlib-id 3, lobby-truth 3) |
| `pnpm isolation:check` | ✅, and both sabotage directions fail it (a "netlib" mention in `rust/`, a runtime use of the Poki client in `Realtime.ts`) |
| `pnpm build:portals` → `verify:portals` → `isolation:check` → `audit:zips` → `verify:upload` | ✅ PORTAL GATE PASSED · ZIP AUDIT PASSED · UPLOAD READY (1.70 MB) with the new `ROOT-08` |
| `pnpm verify:thumbnail`, `pnpm poki:audit -- --run` | ✅ every satisfied rule verified; `COMPLIANCE.md` rewritten (TOOL-08 is now an *action*, not *deferred*) |
| `pnpm pvp:check` | ✅ live suite 7/7 + protocol smoke + pilot directory against a real server |
| CI on the same commit | ✅ all three workflows: `CI` (6 jobs incl. PvP-live, portal zips + source isolation, Inspector artifact), `rust-backend` (fmt · clippy `-D warnings` · test · release build), `botsim` (40 bots vs Node reference **and** vs the Rust authoritative server, 0 cheat leaks) |

Two things the isolation work exposed, both worth remembering:

* **The build gates caught the feature before CI did.** The first cut of
  `SharedRun.ts` imported the AUDS client statically, and `verify:portals`
  immediately reported `auds.poki.io` + `PokiSDK` inside the CrazyGames and
  generic bundles. The fix is the repo's established pattern — a compile-time
  gated *dynamic* import — which is exactly why that gate exists.
* **The Rust change took three CI round-trips, blind.** No Rust toolchain in
  this environment, so the first attempt shipped a non-exhaustive `match`
  (build failure), then a line rustfmt wants broken at 70 columns, then a clippy
  `redundant_pattern_matching` complaint. The workflow's "publish the diff as a
  check run" step turned out to be silently 403ing under `continue-on-error`
  (no `checks: write`), so `rust.yml` now grants `checks: write` **and** emits
  the diff as workflow annotations — the path that actually came back over the
  API and let the last two fixes land.

---

## 15. Player lookup that is real on *every* edition

Round 5 made the Pilot Lookup panel honest: a code either resolves to a real
pilot from the social service, or the panel says why it cannot. That left one
edition stuck on "why it cannot" — the **Poki build has no self-hosted service
at all**, so on the platform the game is actually judged by, every code
answered "lookup needs the online service, which this build does not have".

AUDS closes that gap, and it is the use case the docs name first
("levels, leaderboards, even non-real-time multiplayer"). `src/game/PilotDirectory.ts`
turns the store into a **public pilot directory**:

* **One record per code.** `publishPilot()` writes `{code, name, bestDistance,
  skin, at, lookup-count}` under `sb:pilot:v1` with `putSingleton`, so the
  write secret stays on the device and a later publish *updates* the pilot's
  record instead of leaving duplicates behind the same code.
* **Lookup is code-only.** `lookupDirectoryPilot()` asks
  `GET …/sb:pilot:v1?q=code:SUN-9F3K2A&limit=1&includedata` — no name search,
  no browse, no "players near you" list. That mirrors the privacy contract the
  self-hosted service documents (`IdentityService.byCode`: "the ONLY
  third-party search surface").
* **A hit counts itself** through the public `POST …/_increment?key=lookup-count`
  endpoint (no secret, best-effort — the card never waits on a counter).
* **Honest outcomes only.** A code nobody published is `unknown` ("No pilot has
  published the code …"), a build without the store is `unavailable`, and a
  malformed code never leaves the device. The record carries *when it was last
  updated*, never a presence claim: storage is not presence.
* **Hostile payloads are contained**: names get control characters stripped and
  clamp to 14 chars, marks to 500 km, counts to sane integers, and records
  without a valid `SUN-XXXXXX` code are rejected outright.

Wiring: `SquadClient` publishes on refresh (autonomous *and* live paths), the
game hands over the numbers only it knows (`setPublishStats({bestDistance,
skin})` on boot and at the results screen), and `lookupPilot()` walks
self-hosted service → platform directory → honest "unavailable", in that order.

Tests: `src/game/__tests__/pilot-directory.test.ts` (11) — code normalisation
and rejection, junk/oversized records, scalar-only AUDS values, the exact query
shape, the self-counting lookup, unknown codes, missing-client honesty,
one-record-per-code publishing with the secret retained on the device, and a
publish that refuses an invalid code without touching the network.

---

## 16. "It isn't searching for real players" — honest matchmaking, replayable runs, and a UI audit

Three reports from play, all fixed at the source rather than papered over.

### 16.1 The search no longer hands you bots

`Find race` opened an overlay that read **"Searching… AI practice starts in 8s"**
— and then did exactly that. Nobody asked for the AI flock; the game decided,
and the player learned the multiplayer button lies.

Now the search has two honest phases:

* **searching** — a real countdown to a *room* start, the live pilot count in
  the room, and a live summary of public rooms ("3 joinable now · 12 pilots
  seated") pulled from the room list below. Nothing in the overlay promises a
  bot race.
* **waiting** — after the window the search *stays open* and the player chooses:
  **Keep searching** (another full window, seat held) or **🤖 Race the AI flock
  instead**. The AI path is now only reachable by pressing that button, or from
  a build with no transport at all (where the toast says so).

`Fly Again` after an online race also goes back through the search instead of
dumping the player in the menu, and `Race again` keeps the arena it was flown
in: an AI-flock race rematches the flock, an online race searches for pilots.

### 16.2 A real room list, on both transports

The menu can now show *who is racing right now*, from either stack:

* `GET /mp/rooms` (legacy) and `GET /mp/v1/rooms` (v1) return sanitised public
  rooms — code, seed, status, seats/capacity, host **name**, joinable, uptime.
  No player ids, seat ids, tokens or match ids: asserted by test *and* by the
  live smoke, which greps the payload for each of them.
* The P2P edition lists public lobbies through the signalling service's own
  listing API, and the lobby host publishes its phase (`lobby` / `racing`) so a
  room mid-race is never advertised as somewhere a newcomer can start.
* A room mid-race is shown but **not** marked joinable: a seat in a race already
  under way is not a seat anybody can use. Full rooms and password-protected
  lobbies are visible but closed.

Client side this is one small model (`src/game/RoomBrowser.ts`): normalise →
clamp → sort → summarise, plus a polling watcher that keeps the last good list
when a refresh fails (and says so) instead of blanking a list being read.

### 16.3 The replay replays

A casual run rebuilt the world with a fresh random seed **every time**, and the
ghost record is stored *per seed* — so the ghost (your replay) could never be
seen again, and `Fly again` was a different course than the run it replayed.

`RunOptions.replay` now pins the course: `Fly again` replays the exact hills you
just flew, which is what makes the recorded ghost a real opponent. The results
screen says so ("race the ghost of the run you just flew"). `shouldRebuildCasualWorld`
is a pure predicate, tested for replays, fixed-seed modes, duels, events, storms
and races.

### 16.4 Coin cards that respect a 360px screen

The 3× bonus card, the wingman bundle, the coin piggy bank, the daily stipend,
the vault and the wheel card all carried their *layout* inline — flex rows with
fixed gaps and `white-space: nowrap` claim buttons. On a phone-width viewport
that cannot reflow, so the claim button pushed past the card edge: the exact
"coin button breaks the layout" report.

Layout moved into `ui.css` (`multiplier-cta-card`, `offer-row`, `offer-claim`,
`piggy-card`, `shop-stipend-card`, …) with wrap-first rows and full-width claim
buttons under 420px. The 3× card keeps a one-claim-per-run contract and its test
now asserts there is **no inline style and no nowrap** left to regress.

### 16.5 The audit that keeps it that way

`pnpm audit:ui` (also a CI step, and part of `pnpm poki:preflight`) walks the HUD
source and stylesheets for the failures that do not need pixels:

* **dead buttons** — a `data-action` with no handler anywhere;
* **null refs** — `grab("x")` with no `data-ref="x"` in the markup (the bug this
  round's overlay work hit, now impossible to land);
* **unlabelled controls** — a button with no text and no `aria-label`;
* **inline layout / nowrap** — style that a media query can never override;
* **unstyled classes and buttons** — including the Pilot Lookup card, which had
  no CSS at all until this pass (card, presence dot, code chip and actions are
  now a real component, responsive down to 360px);
* **responsive gaps** — critical surfaces with neither a narrow-screen rule nor a
  wrapping layout.

It currently reports 0 errors and 17 warnings (inline one-off widths on progress
bars, refs used by disclosure helpers) — warnings are printed, not fatal.

### 16.6 Verification for this round

| Gate | Result |
| --- | --- |
| `pnpm lint` · `pnpm typecheck` (+server) | clean |
| `npx vitest run` | **1112 passed** / 8 skipped (87 files) — +21 for the room model, the search overlay contract and the replay policy |
| `pnpm test:server` | 19 passed (adds the public room list contract) |
| `pnpm pvp:check` | **4/4**: protocol smoke · live two-client PvP · pilot directory · public room list (13 live checks) |
| `pnpm audit:ui` | passed — 0 dead buttons, 0 null refs, 0 unlabelled controls |
| `pnpm isolation:check` · `pnpm build:portals` · `pnpm verify:portals` | passed — the three editions stay their own way |

---

## 17. Poki PvP, proven on the transport Poki players actually get

The Poki edition has no room server: multiplayer is WebRTC P2P over
`@poki/netlib`. Everything below is exercised by
`src/game/__tests__/poki-pvp.test.ts` (15 tests) driving **two real clients**
through an in-process stand-in for the signaller, whose behaviour was read out
of the shipped `netlib` dist rather than guessed: the socket connects eagerly and
emits `ready` on the server's welcome packet, `list()` returns the public lobby
rows, `create()`/`join()` connect you to the peers already inside, and
`setLobbySettings()` merges into the row everyone else's `list()` sees.

**Writing that harness found four real defects — all fixed:**

1. **Infinite hello ping-pong.** Both peers answered *every* hello, and a hello
   reply is a hello, so two pilots in one room traded greetings forever: a
   permanent 100 %-CPU loop on the datachannel (the stand-in reproduced it as an
   out-of-memory crash). Each peer now answers the *first* hello it receives from
   a peer and only that one; later hellos are identity updates.
2. **The "different room, different course" event never fired.** `onLobby`
   adopts the room's seed before `join()` resolves, so the old
   `incoming !== prevSeed` comparison was always false — a guest quick-matching
   into a room running another circuit never got the welcome event the game uses
   to switch course/format (and never told the player). The comparison now uses
   the seed we *asked for*.
3. **Finish places were never recorded.** The P2P roster hard-coded
   `place: 0`, so every rival's position stayed blank in the room's own roster
   (the WebSocket transport reports real ones). The host's assignment is now kept
   on the track and broadcast places are stored on receipt.
4. **First finisher got P2.** The host's counter added an extra `+1` ("because
   host also counts"), so when a guest crossed the line first they were P2 — and
   the host, finishing later, took P2 as well. Two pilots, nobody P1. The next
   finisher now takes the next place, whoever they are.

**What the tests pin, in plain terms:**

| Behaviour | Assertion |
| --- | --- |
| Quick match | the first pilot creates one public lobby (seed, `sunbird-race` mode, `phase: lobby`) |
| No fragmentation | a second pilot with a different local seed joins *that* lobby, and adopts its course with a welcome event |
| Real names | both rosters carry the other pilot's real name — never `Pilot` |
| Invite by code | connecting with a room code joins that lobby and takes the room's seed |
| Ready-up | the host broadcasts the authoritative start; both clients enter `racing` at the same instant |
| Lone host | starts immediately instead of waiting for pilots who will never come |
| Finish order | guest-first ⇒ P1/P2 the right way round on **both** clients; host-first likewise |
| Flight state | 15 Hz snapshots arrive on the unreliable channel and interpolate into `poll()` |
| Lobby phase | the host publishes `racing` so the menu never advertises a race in progress as open — and a guest never overwrites the host's entry |
| Room list | real seats/phase/joinability from the signaller; a full lobby is closed; an unreachable signaller fails loudly (no hang) and the next attempt reconnects |
| No WebRTC | the client degrades to the honest local flock instead of a dead lobby |

The browse connection that powers the menu's live list is now closed when the
search ends, is cancelled, or takes the AI route (`closeLobbyBrowser`), so a
lobby screen does not leave a signalling socket open behind it.

**Verification for this round:** `npx vitest run` **1127 passed** / 8 skipped
(88 files) · `pnpm test:server` 19 · `pnpm pvp:check` 4/4 ·
`pnpm poki:preflight` green (UI audit · portals · isolation · zips · upload ·
thumbnail · compliance) · artifact carries the P2P signalling URL, AUDS and the
SDK, and nothing else's.
