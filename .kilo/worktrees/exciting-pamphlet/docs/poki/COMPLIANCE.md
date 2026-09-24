# Poki compliance report

**Generated:** 2026-09-24 by `pnpm poki:audit` — do not edit by hand.
**Result:** ✅ every satisfied rule verified · 116/131 rules verified · 89 of them hard requirements.

**Scope:** the extracted guide corpus in this folder (`requirements.json`, version 2026-09-17). Rules marked *action* are human/submission steps, *deferred* are accepted gaps with a recorded reason — both are listed so nothing is silently skipped.

| Status | Rules |
|---|---|
| satisfied | 116 |
| action (submission step) | 5 |
| deferred (accepted) | 0 |
| informational | 10 |

## GK — Developer Guide overview

*Source page: [`00-guide-overview.md`](./00-guide-overview.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `GK-01` | recommendation | Choose a web game engine deliberately (2D/3D + multiplayer needs) and understand player-hardware insights so the build stays compatible and performant. | ✅ | docs/poki/01-web-game-engines.md |
| `GK-02` | recommendation | Success on web depends on fast onboarding, high engagement strategies, and localization. | ✅ | src/game/__tests__/firstflight.test.ts |
| `GK-03` | recommendation | Integrate monetization early so rewarded placements land at natural moments. | ✅ | src/game/Game.ts matches /rewardedBreak\|continue-ad/ |
| `GK-04` | recommendation | Thumbnails are the primary acquisition surface; make them impactful. | ✅ | gate wired: node scripts/verify-thumbnail.mjs |
| `GK-05` | informational | The guide is the starting point for optimising games for the web environment. | ℹ️ info | docs/poki/README.md |

## ENG — Choosing your web game engine

*Source page: [`01-web-game-engines.md`](./01-web-game-engines.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `ENG-01` | recommendation | Filter engines by required dimensions (2D/3D) and multiplayer support before deeper research. | ✅ | docs/poki/01-web-game-engines.md |
| `ENG-02` | requirement | Mobile web fit: prefer engines with touch support and small files — initial download < 5 MB, total < 8 MB. | ✅ | scripts/verify-portal.mjs matches /MAX_ZIP_BYTES = 8_000_000/ |
| `ENG-03` | requirement | Team fit: the engine must support collaborative work on the same project files; count per-seat licensing. | ✅ | LICENSE matches /MIT/ |
| `ENG-04` | recommendation | Some engines are purpose-built for web performance; heavy engines need extra effort for web exports. | ✅ | docs/poki/REBUILD_REPORT.md |
| `ENG-05` | informational | Web success factors: mobile web optimisation, engine capabilities, team workflow. | ℹ️ info | Reference material. |

## EA — Easy access

*Source page: [`02-easy-access.md`](./02-easy-access.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `EA-01` | requirement | Mobile first: prioritise mobile compatibility early, not as a late port. | ✅ | src/game/Game.ts matches /isCoarsePointer\(\)/ |
| `EA-02` | requirement | Keep it small: target an 8–10 MB game file for older hardware and slow connections. | ✅ | gate wired: node scripts/verify-portal.mjs |
| `EA-03` | recommendation | Skip the menu: let first-time players reach gameplay without splash/title/level-select detours. | ✅ | src/game/HUD.ts matches /home-launch/ |
| `EA-04` | requirement | Loading screens must be visually engaging and include a progress bar. | ✅ | index.html matches /role="progressbar"/ |
| `EA-05` | recommendation | Progressive loading: ship essential initial assets first, load the rest in the background. | ✅ | src/game/__tests__/boot-progress.test.ts |
| `EA-06` | recommendation | Safe beginner environment: simple early levels, gradual difficulty, prevent early death. | ✅ | src/game/__tests__/firstflight.test.ts |
| `EA-07` | recommendation | Gradual introduction: teach mechanics and controls over several levels to cut frontal load. | ✅ | src/game/__tests__/firstflight.test.ts |
| `EA-08` | requirement | Explain the game with visuals, not text walls; tutorials must not block gameplay. | ✅ | src/game/__tests__/input-ui.test.ts |
| `EA-09` | recommendation | Playtest recordings to fine-tune onboarding and drop-off. | 📋 action | Upload to Poki Playtest and review the first-run funnel; telemetry already emits the funnel events. |
| `EA-10` | requirement | Portrait vs landscape: portrait raises engagement ~6% and unlocks Gamebar Display ads; both orientations are supported. | ✅ | e2e/scaling.spec.ts |

## EN — Engagement

*Source page: [`03-engagement.md`](./03-engagement.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `EN-01` | requirement | Accessibility: support both mouse and keyboard navigation. | ✅ | src/game/__tests__/input-ui.test.ts |
| `EN-02` | requirement | Standardise controls: WASD or arrow keys for movement, space or return for primary menu actions. | ✅ | src/game/__tests__/input-ui.test.ts (pinned: /ArrowDown\|KeyW/) |
| `EN-03` | recommendation | Clear long-term goals in addition to short-term level goals. | ✅ | src/game/Mastery.ts |
| `EN-04` | recommendation | Tune difficulty with an increasing scale from accessible starts to new mechanics. | ✅ | src/game/FlightProgression.ts |
| `EN-05` | recommendation | Congratulate the player: celebrate milestones with visual and audio feedback. | ✅ | src/game/HUD.ts matches /new-best/ |
| `EN-06` | recommendation | Test it: find drop-off points to distinguish difficulty frustration from lost interest. | ✅ | src/game/Telemetry.ts |

## MON — Monetization

*Source page: [`04-monetization.md`](./04-monetization.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `MON-01` | recommendation | Integrate monetization early so rewarded video fits the natural game flow. | ✅ | src/game/Game.ts matches /rewardedBreak/ |
| `MON-02` | recommendation | Engagement first: rewarded video performance follows engagement. | ✅ | src/game/SeasonPass.ts |
| `MON-03` | requirement | Rewarded videos must be optional and never block core gameplay. | ✅ | src/game/HUD.ts matches /Let it sleep/ |
| `MON-04` | requirement | Every video-triggering element must be clearly labelled, accessible and transparent about the reward. | ✅ | src/game/HUD.ts matches /Watch for Second Wind/ |
| `MON-05` | requirement | Always provide a standard (non-ad) alternative to a rewarded option. | ✅ | e2e/results.spec.ts (pinned: /continue-sleep/) |
| `MON-06` | requirement | Standard and rewarded options appear simultaneously. | ✅ | src/game/HUD.ts matches /renderContinue/ |
| `MON-07` | requirement | The standard button is at least as large as the rewarded button and sits above or beside it. | ✅ attested | CSS audit: .primary-btn (18px type, 12px padding, full width) renders above .soft-btn.wide (14px, 10px padding); pinned by HUD test. |
| `MON-08` | requirement | Rewarded buttons must not be green. | ✅ attested | Rewarded CTA uses the warm-neutral .soft-btn surface; the game's action colour is orange and gold is reserved for the Gold pass. |
| `MON-09` | requirement | Reward buttons carry a prominent clapperboard icon. | ✅ | src/game/HUD.ts matches /🎬/ |
| `MON-10` | requirement | One video per reward, maximum. | ✅ | src/game/Game.ts matches /rewardedBreak/ |
| `MON-11` | requirement | Confirm rewards immediately (animation/sound) and apply them automatically. | ✅ | src/game/Game.ts matches /doContinue/ |
| `MON-12` | requirement | No reward when the ad fails or is blocked; handle it silently. | ✅ | src/sdk/poki.ts matches /rewardedBreak/ |
| `MON-13` | requirement | No ad-timer manipulation; the platform decides ad availability. | ✅ | src/game/Game.ts matches /portalEnabled\(\)/ |
| `MON-14` | requirement | Never reward-wall core gameplay. | ✅ | src/game/__tests__/experience-loop.test.ts |
| `MON-15` | requirement | No pushy prompts: non-ad options in primary positions, no invasive rewarded CTAs. | ✅ attested | One rewarded placement in the whole game, shown only after crash; standard option is the primary-styled button. |
| `MON-16` | recommendation | Helping hand: revives, skips, hints, boosts to reduce drop-off. | ✅ | src/game/HUD.ts matches /Second Wind/ |
| `MON-17` | recommendation | In-game economy: let players spend earned currency or watch a video for the same reward. | ✅ | src/game/HUD.ts matches /Spend/ |
| `MON-18` | recommendation | Customization: rewarded video can unlock cosmetics and replayability. | ✅ | src/game/Economy.ts |
| `MON-19` | recommendation | Prefer dynamic, context-specific rewarded opportunities over static always-on buttons. | ✅ | src/game/__tests__/continue-offer.test.ts |
| `MON-20` | recommendation | Use temporary or seasonal content to lift long-term retention. | ✅ | src/game/Events.ts |
| `MON-21` | recommendation | Monitor balance: ad rewards must not distort progression; consider limits. | ✅ | src/game/__tests__/economy.test.ts |
| `MON-22` | requirement | No fake ad affordances: nothing may look like an ad surface unless it is one. | ✅ attested | Removed in the compliance pass: the 'Ad Multiplier' card and the wheel's video-option button were deleted; the only TV/clapperboard surface is the real rewarded break. |

## LOC — Localization

*Source page: [`05-localization.md`](./05-localization.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `LOC-01` | recommendation | Localization is essential for engagement outside English-speaking regions. | ✅ | src/i18n/translations.barrel.json |
| `LOC-02` | requirement | Centralize all text into a single file format before translating. | ✅ | src/i18n/index.ts matches /export function t\(/ |
| `LOC-03` | recommendation | Prioritise localization for text-carrying genres/mechanics. | ✅ | docs/poki/05-localization.md |
| `LOC-04` | requirement | Phase 1: EFIGS + Turkish. Phase 2: CJK. Phase 3: pt-BR + Russian. | ✅ | 11 locales × 218 strings complete |
| `LOC-05` | requirement | Detect the browser language and serve it; a manual selector should exist too. | ✅ | src/i18n/__tests__/locales.test.ts |
| `LOC-06` | requirement | Every language Poki's game inspector lists as selectable must ship complete, plus browser auto-detect. | ✅ | 36 locales × 218 strings complete |

## THB — Game thumbnail

*Source page: [`06-thumbnail.md`](./06-thumbnail.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `THB-01` | requirement | A high-quality thumbnail is essential for attracting players. | ✅ | gate wired: node scripts/verify-thumbnail.mjs |
| `THB-02` | requirement | The thumbnail must accurately reflect the game's content. | ✅ attested | Thumbnail uses the game's sky/sun/ridge palette and the player's bird in the pose seen in the first five seconds. |
| `THB-03` | recommendation | Embrace simplicity: one clear foreground object. | ✅ attested | Single hero subject (bird) over a two-layer background; no clutter or screenshot chrome. |
| `THB-04` | recommendation | Keep a series visually consistent across thumbnails. | ✅ attested | One palette and hero pose reused across icon sizes, store card and video frame. |
| `THB-05` | requirement | Full-bleed square, minimum 628 x 628 px. | ✅ | gate wired: node scripts/verify-thumbnail.mjs |
| `THB-06` | requirement | Do not cut corners: rounded corners are applied by the platform mask. | ✅ | gate wired: node scripts/verify-thumbnail.mjs |
| `THB-07` | requirement | Details and typography must stay legible when scaled down. | ✅ | gate wired: node scripts/verify-thumbnail.mjs |
| `THB-08` | requirement | High contrast; avoid colours close to the Poki Playground background #83FFE7. | ✅ | gate wired: node scripts/verify-thumbnail.mjs |
| `THB-09` | requirement | Static thumbnail for the player-fit test; animated 3-5 s gameplay loop before global release. | 📋 action | Record the 3-5 s capture from a real play session on a GPU machine: node scripts/capture-animated-thumbnail.mjs (serves poki-upload/, plays a scripted dive-glide loop, writes assets/submission/sunbird-thumbnail-animated.gif). Sandboxed/CI renderers read back WebGL too slowly for a smooth capture. |
| `THB-10` | recommendation | Keep delivered image weight sane (Inspector warns on heavy images). | ✅ | gate wired: node scripts/verify-thumbnail.mjs |

## DEV — Poki Player Device Report

*Source page: [`07-player-device-report.md`](./07-player-device-report.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `DEV-01` | informational | The Player Device Report gives daily-updated insights into player hardware and software. | ℹ️ info | Reference: the platform publishes this; the game consumes the implications. |
| `DEV-02` | informational | Report data comes from a random sample of 100M players and follows Poki's privacy policies. | ℹ️ info | Reference. Sunbird's own device_profile telemetry is aggregate capability data only - no PII, no persistent identifier. |
| `DEV-03` | requirement | Code to the measured baseline: know the runtime's capabilities and pick tiers from them. | ✅ | src/sdk/__tests__/device-report.test.ts |
| `DEV-10` | requirement | Capture OS and browser distribution inputs. | ✅ | src/sdk/device-report.ts matches /browserName/ |
| `DEV-11` | requirement | Capture CPU core counts and size quality tiers accordingly. | ✅ | src/sdk/device-report.ts matches /hardwareConcurrency/ |
| `DEV-12` | requirement | Capture aspect ratios and device pixel ratios; never render more pixels than needed. | ✅ | src/game/Game.ts matches /preferredDpr/ |
| `DEV-13` | requirement | Know audio format support. | ✅ | src/sdk/device-report.ts matches /audio/ogg/ |
| `DEV-14` | requirement | Know WASM, WebRTC, WebP and WakeLock support and gate features on it. | ✅ | src/sdk/device-report.ts matches /wakeLock/ |
| `DEV-15` | requirement | Know WebGPU and WebGL version/extension support. | ✅ | src/sdk/device-report.ts matches /webgl2/ |
| `DEV-16` | requirement | Know AI feature availability (translator, language model, summarizer, detector). | ✅ | src/sdk/device-report.ts matches /LanguageModel\|Translator/ |

## TOOL — Poki game development tools

*Source page: [`08-game-dev-tools.md`](./08-game-dev-tools.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `TOOL-01` | informational | The Inspector evaluates a web build against the platform's success factors. | ℹ️ info | Submission-time tool run. |
| `TOOL-02` | requirement | The build must survive the Inspector's mobile and technical-optimisation passes (no external resources, no console errors, sane image weights). | ✅ | gate wired: node scripts/audit-zips.mjs |
| `TOOL-03` | requirement | Uploadable as a folder with index.html at the root, working from any sub-path. | ✅ | gate wired: node scripts/verify-upload.mjs |
| `TOOL-04` | informational | Netlib is a WebRTC-datachannel P2P library for web games. | ℹ️ info | src/game/PokiNetlib.ts |
| `TOOL-05` | informational | Netlib is usable whether or not the game is hosted on Poki. | ℹ️ info | Availability note. |
| `TOOL-06` | requirement | Feature-detect WebRTC and keep a non-P2P path when using Netlib. | ✅ | src/game/PokiMpUtils.ts matches /RTCPeerConnection/ |
| `TOOL-07` | informational | AUDS stores user-generated content and returns shareable codes, enabling non-real-time multiplayer. | ℹ️ info | src/sdk/auds.ts |
| `TOOL-08` | requirement | AUDS is exclusive to Poki-hosted games and needs a live game id, so it cannot be a dependency of portable builds. | ✅ | package.json matches /build:poki.*VITE_POKI_GAME_ID=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ |
| `TOOL-09` | requirement | AUDS and Netlib only work against the game id Poki issues for this title, so the ids baked into the Poki build must be confirmed against the dashboard before submission — a wrong or stale id fails silently (every AUDS call is skipped and boards fall back to local), not loudly. | 📋 action | On the Poki developer dashboard, open the game and copy its id, then diff it against VITE_POKI_GAME_ID and VITE_POKI_NETLIB_GAME_ID in package.json's build:poki script (they must be identical). package.json is the single source of truth, and src/game/__tests__/poki-build-ids.test.ts fails the build if the two ids diverge, if either stops being a canonical UUID, if another edition picks one up, or if .env.example grows a second copy. After any change, rebuild with `pnpm build:poki` and confirm the id appears in dist-poki/index.html and in none of the other editions (`pnpm isolation:check`). |

## REQ — Platform requirements, policies & release

*Source page: [`09-platform-requirements.md`](./09-platform-requirements.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `REQ-01` | requirement | Scale to 640x360, 836x470 and 1031x580 (plus real devices) with no crop or scroll. | ✅ | e2e/scaling.spec.ts (pinned: /640\|836\|1031/) |
| `REQ-02` | requirement | Run inside a cross-origin iframe: no top-level navigation, window.open, dialogs, or console errors. | ✅ | src/rejection-guard.ts matches /unhandledrejection\|rejection/ |
| `REQ-03` | requirement | Fully playable in incognito / with storage blocked. | ✅ | src/game/__tests__/storage.test.ts |
| `REQ-04` | requirement | Initial download under ~5 MB, total under ~8 MB. | ✅ | gate wired: node scripts/verify-portal.mjs |
| `REQ-05` | requirement | No service worker or manifest inside portal builds. | ✅ | gate wired: node scripts/verify-portal.mjs |
| `REQ-06` | requirement | Fixed non-scrolling page with the canvas filling the viewport; portrait and landscape supported. | ✅ | src/index.css matches /position: fixed/ |
| `REQ-10` | requirement | Lifecycle order init -> gameLoadingStart -> gameLoadingFinished, each phase marker once. | ✅ | src/sdk/__tests__/platform-failsafe.test.ts |
| `REQ-11` | requirement | gameplayStart on real play start, gameplayStop on stop; never duplicated or inverted. | ✅ | e2e/poki-artifact.spec.ts |
| `REQ-12` | requirement | Pause/unpause order: gameplayStop -> commercialBreak -> gameplayStart. | ✅ | src/game/Game.ts matches /resumeFromPause/ |
| `REQ-13` | requirement | Game events: one start per attempt, then exactly one of complete or fail. | ✅ | src/game/Game.ts matches /runOutcome/ |
| `REQ-14` | requirement | Rewarded placements emit visible when shown and interact when chosen. | ✅ | src/game/Game.ts matches /continue-ad/ |
| `REQ-15` | requirement | Mute audio and disable input for the whole ad break. | ✅ | src/game/Game.ts matches /beginPortalAd/ |
| `REQ-16` | requirement | Work when the SDK is unavailable: boot anyway, never block on the portal. | ✅ | src/game/__tests__/journey-reliability.test.ts |
| `REQ-20` | requirement | No in-app purchases on the platform and no UI implying them. | ✅ | gate wired: node scripts/verify-portal.mjs |
| `REQ-21` | requirement | No secondary spendable currencies. | ✅ | src/game/__tests__/economy.test.ts |
| `REQ-22` | requirement | No third-party ad systems. | ✅ | gate wired: node scripts/audit-zips.mjs |
| `REQ-23` | requirement | No ad-timer or cooldown manipulation. | ✅ | src/game/Game.ts matches /portalEnabled\(\)/ |
| `REQ-24` | requirement | External links only through the platform API; portal builds should have none. | ✅ | gate wired: node scripts/verify-portal.mjs |
| `REQ-30` | requirement | All-ages content: no violence, sexual content, gambling, substances, fear or bullying. | ✅ attested | Family-friendly bird flight; no combat, no gore, no casino framing (the lucky wheel is a free daily gift, not a paid spin), no substances, no chat. |
| `REQ-31` | requirement | No chat in multiplayer surfaces; emotes are the recommended alternative. | ✅ | gate wired: node scripts/verify-portal.mjs |
| `REQ-32` | requirement | No PII collection; platform identity is display-only. | ✅ | src/sdk/poki.ts matches /getIdentity/ |
| `REQ-33` | requirement | Originality: art, UI, mechanics, characters, audio and name must be the developer's own. | ✅ attested | Procedural biomes, custom UI, original bird/characters, procedural score; no third-party art or audio. |
| `REQ-34` | requirement | AI-assisted production: no watermarks or prompt text; process documentable on request. | ✅ attested | No AI-generated asset files ship (art is procedural, audio is synthesized); production history is the git log. |
| `REQ-35` | recommendation | External resources policy: prefer zero external requests; bundle assets and avoid CDNs. | ✅ | gate wired: node scripts/audit-zips.mjs |
| `REQ-40` | requirement | Identity is passive: never force a login at boot. | ✅ attested | login() is deliberately not called at boot (Poki's login reloads the page on first use); getUser() is passive with a local fallback name. |
| `REQ-41` | recommendation | Platform tokens are short-lived and must be verified server-side immediately, never stored. | ✅ | src/sdk/poki.ts matches /getToken/ |
| `REQ-42` | requirement | A player who is not signed in must still play the full game. | ✅ | src/game/__tests__/save.test.ts |
| `REQ-50` | informational | Revenue split: 100% on search/owned traffic, 50/50 on platform-driven traffic. | ℹ️ info | Business term; nothing to implement. |
| `REQ-51` | requirement | The submitted build is web-exclusive: no store build that double-serves the Poki artifact. | ✅ | gate wired: node scripts/audit-zips.mjs |
| `REQ-52` | informational | Release flow: folder upload -> Inspector QA -> player-fit test -> web-fit test -> review. | 📋 action | Walk the Inspector QA modules on the unzipped folder (Event Log sequences, External Resources, Image Optimization, Scaling tests, mobile QR). |
| `REQ-53` | informational | Web-fit metrics: C2P (click-to-play), CTR (thumbnail), time on page. | ℹ️ info | C2P is minimised by the sub-1 MB boot and immediate first frame; CTR by the specification-compliant thumbnail; time-on-page by the daily/weekly retention loops. |
| `REQ-60` | requirement | Do not place HUD under the mobile platform pill; use movePill() to relocate it. | ✅ | src/sdk/platform.ts matches /movePill/ |
| `REQ-61` | requirement | No player-authored text or personal-data collection: multiplayer-visible names must be curated, not typed by the player. | ✅ | src/game/__tests__/pilot-name-surface.test.ts (pinned: /CUSTOM_PILOT_NAMES/) |
| `REQ-62` | requirement | No offer to remove or disable ads, and no ad-frequency claim in a portal paywall. | ✅ | src/game/__tests__/portal-policy.test.ts (pinned: /sponsored breaks/) |
| `REQ-63` | requirement | Portal bundles must contain no ad-removal copy and no free-text name field (bundle-level enforcement of REQ-20 and the player-safety policy). | ✅ | gate wired: node scripts/verify-portal.mjs |
| `REQ-64` | requirement | A portal build must not describe or count ad breaks it does not schedule — the platform owns ad frequency. | ✅ | e2e/portal-policy.spec.ts (pinned: /must not offer ad removal/) |
| `REQ-65` | requirement | A portal build must issue no request that can fail on the host origin (no relative calls to absent backends). | ✅ | e2e/portal-policy.spec.ts (pinned: /HTTP \$\{r.status/) |
| `REQ-66` | requirement | An up-to-date privacy policy must be live on a public webpage before Poki stores a custom CSP, and it must also be linked from inside the game. | 📋 action | Dashboard, in this order: (1) Game settings -> Privacy Policy URL = https://sunbird-snowy.vercel.app/privacy ; (2) Settings -> Content Security Policy -> paste the host list and reasons from docs/poki/CSP_REQUEST.md ; (3) re-upload the build after the CSP is reviewed so the CDN cache resets. Until step (1) is saved the CSP screen keeps saying "No custom CSP will be stored". The page itself is generated (pnpm gen-legal) from src/game/legal*.ts and served by the vercel.json rewrite /privacy -> /privacy.html, so the in-game screen and the hosted page are one document. |
| `REQ-67` | requirement | Portal builds must pin an absolute https privacy URL (VITE_PRIVACY_URL): inside a portal iframe the game's own origin is the portal CDN, so a relative /privacy link would 404 for the player. | ✅ | package.json matches /build:(poki\|crazy\|generic)":.*VITE_PRIVACY_URL=https:/// |
| `REQ-68` | requirement | The in-game privacy screen may open the hosted page only through the platform's sanctioned external-link API - never window.open, never target=_blank, never a bare location assignment. | ✅ | src/game/__tests__/legal-editions.test.ts (pinned: /sanctioned external-link API only/) |
| `REQ-69` | requirement | Declared external hosts, the public policy page, the portal CSP request and the deployed CSP header must be one list - adding a host publishes it everywhere in the same commit, and no deployment may permit an origin the policy does not disclose. | ✅ | gate wired: pnpm verify:csp |
| `REQ-70` | requirement | gameplayStart/gameplayStop alternation must be enforced at the adapter boundary as well as by the event sink, so no caller path can reach the SDK with a duplicate or inverted pair. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /adapter itself refuses consecutive duplicates/) |
| `REQ-71` | requirement | Only canonical PokiSDK members may be called: the adapter's type is derived from Poki's published typings, and every member the code touches must exist in that typings surface or in the recorded runtime-only registry. | ✅ | src/sdk/__tests__/poki-canon.test.ts (pinned: /touches no SDK member Poki does not publish/) |
| `REQ-72` | requirement | Game Events use measure(category, what, action) with Poki's published vocabulary and must satisfy the SDK's own argument rules: category and what required, no '/' or '^', at most two numeric values across the three. | ✅ | src/sdk/__tests__/poki-canon.test.ts (pinned: /published measure\(\) vocabulary/) |
| `REQ-73` | requirement | In-game progress and live-ops must be reported upstream as Game Events, not only tracked locally: run funnel, retention funnel, rewarded placements, weekly/daily/gauntlet, achievements, shop and cosmetics. | ✅ | src/game/Game.ts matches /measure\("quest", "weekly-event", "complete"\)/ |
| `REQ-74` | requirement | Celebration moments must use the canonical happyTime(intensity 0…1), and the portal's own language signal (getLanguage) must outrank browser sniffing for the Browser-language option. | ✅ | src/i18n/__tests__/locales.test.ts (pinned: /the portal's own language signal/) |
| `REQ-75` | requirement | gameplayStart must never fire while a commercial or rewarded break is in flight; every break placement must enter through one path that locks the state machine until the break resolves. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /locks the state machine for the whole of every portal break/) |
| `REQ-76` | informational | Score submission to a Poki leaderboard is the published init({ submitScore }) handshake; there is no setScore, and the CDN build's sendHighscore is legacy. | ✅ | src/sdk/__tests__/poki-canon.test.ts (pinned: /publishes the leaderboard handshake/) |

## Actions and accepted gaps

| Rule | Status | What remains |
|---|---|---|
| `EA-09` | action | Upload to Poki Playtest and review the first-run funnel; telemetry already emits the funnel events. |
| `THB-09` | action | Record the 3-5 s capture from a real play session on a GPU machine: node scripts/capture-animated-thumbnail.mjs (serves poki-upload/, plays a scripted dive-glide loop, writes assets/submission/sunbird-thumbnail-animated.gif). Sandboxed/CI renderers read back WebGL too slowly for a smooth capture. |
| `TOOL-09` | action | On the Poki developer dashboard, open the game and copy its id, then diff it against VITE_POKI_GAME_ID and VITE_POKI_NETLIB_GAME_ID in package.json's build:poki script (they must be identical). package.json is the single source of truth, and src/game/__tests__/poki-build-ids.test.ts fails the build if the two ids diverge, if either stops being a canonical UUID, if another edition picks one up, or if .env.example grows a second copy. After any change, rebuild with `pnpm build:poki` and confirm the id appears in dist-poki/index.html and in none of the other editions (`pnpm isolation:check`). |
| `REQ-52` | action | Walk the Inspector QA modules on the unzipped folder (Event Log sequences, External Resources, Image Optimization, Scaling tests, mobile QR). |
| `REQ-66` | action | Dashboard, in this order: (1) Game settings -> Privacy Policy URL = https://sunbird-snowy.vercel.app/privacy ; (2) Settings -> Content Security Policy -> paste the host list and reasons from docs/poki/CSP_REQUEST.md ; (3) re-upload the build after the CSP is reviewed so the CDN cache resets. Until step (1) is saved the CSP screen keeps saying "No custom CSP will be stored". The page itself is generated (pnpm gen-legal) from src/game/legal*.ts and served by the vercel.json rewrite /privacy -> /privacy.html, so the in-game screen and the hosted page are one document. |

## Evidence index

| Rule | Evidence |
|---|---|
| `GK-01` | Engine decision + device baseline documented; the game uses Three.js with hand-rolled systems (see docs/poki/01-web-game-engines.md §Part 4). |
| `GK-02` | 3-step play-signal onboarding, progression systems, and 12 locales. |
| `GK-03` | Rewarded revive is part of the crash flow, with placement analytics. |
| `GK-04` | Spec-checked thumbnails in assets/submission/ + THB gate. |
| `GK-05` | This corpus. |
| `ENG-01` | §Part 4 records the filter outcome for Sunbird. |
| `ENG-02` | Portal zips gated at 8 MB; shipped size ≈0.7 MB. |
| `ENG-03` | MIT-licensed library + plain TypeScript modules + git: no per-seat cost, no binary project format. |
| `ENG-04` | Documented engine decision; no engine runtime ships. |
| `ENG-05` | See docs/poki/01-web-game-engines.md §Part 3. |
| `EA-01` | Mobile/tablet detection (UA + coarse pointer + narrow viewport) drives render tier, DPR and AI fidelity. |
| `EA-02` | Procedural assets, self-hosted subset fonts, single-file build; zip gated < 8 MB. |
| `EA-03` | One-screen entry with a single hero 'Fly now' action. |
| `EA-04` | Inline zero-request boot screen with an animated mark and a progress bar driven by real boot stages. |
| `EA-05` | Interaction-first boot stages + idle-deferred work (BootProgress). |
| `EA-06` | Onboarding runs on forgiving terrain with launch assist; second-wind continue exists. |
| `EA-07` | One cue at a time (dive → soar → land), gated on real input. |
| `EA-08` | Gesture/icon cues that never take input away, localized across all locales. |
| `EA-09` | Instrumentation ready (session/run/drop-off events); recording is a platform action. |
| `EA-10` | Portrait and landscape both playable: narrow-aspect camera pull-back, safe-area insets, HUD reflow; e2e covers phone portrait + landscape. |
| `EN-01` | Full play with mouse-only, keyboard-only, touch-only or gamepad; menus are focus-managed DOM overlays. |
| `EN-02` | Dive accepts Space/WASD/arrows; Space+Return activate an overlay's primary action (OverlayNavigation). |
| `EN-03` | Skins with perks, trails, biomes, mastery, missions, collections, season pass, cups, ranked divisions. |
| `EN-04` | In-run ramps + campaign/mastery/rank progression. |
| `EN-05` | Confetti burst + jingle on personal bests, level-ups, chests and race wins; the results card carries a NEW BEST banner and the portal celebration hook fires when one exists. |
| `EN-06` | Run outcome, placement visibility/interaction and economy events are all instrumented. |
| `MON-01` | Rewarded revive wired into the crash flow. |
| `MON-02` | Deep progression layer independent of ads. |
| `MON-03` | Free restart and free 'let it sleep' paths always exist; no mode is ad-gated. |
| `MON-04` | Labelled button, aria-labelled, explicit reward wording. |
| `MON-05` | e2e/results.spec.ts pins the standard and free options beside the rewarded one ('Let it sleep' always rendered). |
| `MON-06` | All three options render in one pass; nothing gates the ad behind a wizard step. |
| `MON-07` | src/game/HUD.ts renderContinue markup order. |
| `MON-08` | src/index.css .soft-btn |
| `MON-09` | 🎬 present on the rewarded continue button and verified in the shipped bundle. |
| `MON-10` | A single grant site; the returned boolean is the only reward source. |
| `MON-11` | Run resumes in place with a jingle, coin toast and slow-mo restore - no menu detour. |
| `MON-12` | false/rejected break grants nothing, offers fallbacks, and never mentions ad blocking. |
| `MON-13` | adTimer/shouldShowInterstitial/adsLeftToday are local-build-only; portal builds ask the SDK. |
| `MON-14` | Every mode is reachable with earned coins or for free. |
| `MON-15` | src/game/HUD.ts renderContinue |
| `MON-16` | Rewarded revive. |
| `MON-17` | Coins-or-video choice on the continue screen, single currency. |
| `MON-18` | Skins/trails/biomes are earned with in-game coins (no real money in portal builds). |
| `MON-19` | ContinueOffer picks framing from run context (near-best, streak at risk, momentum) and only exists after a crash. |
| `MON-20` | Season pass, weekly cups, festival events, rotating daily/weekly challenges. |
| `MON-21` | One continue per crash; economy faucets are audited (see docs/audits/POKI_COMPLIANCE_AUDIT.md fix log F5/F8). |
| `MON-22` | docs/audits/POKI_COMPLIANCE_AUDIT.md F6 |
| `LOC-01` | 36 shipped locales: the 34 language codes Poki's own inspector lists for this game, plus vi and mt (poki:false), with "auto" browser detection as a first-class preference. |
| `LOC-02` | One barrel file with keyed entries (sourceText + meta + placeholders + translations); lookup via t()/useTranslations(). |
| `LOC-03` | Tutorial, shop, settings and results copy are all in the barrel. |
| `LOC-04` | Phase 1 (EFIGS + tr), phase 2 (zh, ja, ko) and phase 3 (pt, ru) all ship at 100% coverage, using the exact codes Poki's inspector exposes for this game. |
| `LOC-05` | Boot-time navigator.language matching with an explicit "auto" preference, persisted choice (private-mode safe), manual selector for all 36 in Settings, RTL direction handling. |
| `LOC-06` | 34 inspector codes + vi/mt, every key translated in every locale; enforced on every `pnpm poki:audit` run. |
| `THB-01` | assets/submission/sunbird-thumbnail-1024.png rendered from the game's own palette and mid-dive pose. |
| `THB-02` | assets/submission/sunbird-thumbnail-1024.png |
| `THB-03` | assets/submission/sunbird-thumbnail-1024.png |
| `THB-04` | public/icons/ + assets/submission/ |
| `THB-05` | 1024x1024, square, full-bleed. |
| `THB-06` | Gate asserts corner pixels are opaque and painted (no baked rounding, border or letterbox). |
| `THB-07` | Gate downsamples to 128 px and requires the subject/background contrast to survive; thumbnail carries no typography by design. |
| `THB-08` | Gate rejects a dominant colour within the threshold of #83FFE7 and requires a minimum luminance spread. |
| `THB-09` | docs/audits/POKI_COMPLIANCE_AUDIT.md submission actions 1-2 |
| `THB-10` | Gate enforces a maximum encoded size per thumbnail. |
| `DEV-01` | docs/poki/07-player-device-report.md |
| `DEV-02` | src/sdk/device-report.ts (no identifiers emitted) |
| `DEV-03` | detectDeviceProfile() probes every dimension the report lists and derives a render tier. |
| `DEV-10` | userAgentData first, UA fallback; reported once per session. |
| `DEV-11` | Low-core devices resolve to the lite tier (shadows off, capped DPR, reduced AI fidelity). |
| `DEV-12` | DPR capped (never above 2x) and reduced automatically under load; aspect feeds the camera rig. |
| `DEV-13` | Opus/AAC/MP3/WebM/FLAC/WAV probed; the audio path is a procedural WebAudio synth, so no asset format can fail - the probe drives the no-WebAudio fallback. |
| `DEV-14` | WebRTC gates the P2P transport; WakeLock keeps mobile screens awake during runs; WebP checked before image output; WASM probed for the multiplayer client path. |
| `DEV-15` | WebGL 1/2 + renderer string + max texture size probed before renderer creation; WebGPU availability reported for future renderer decisions. |
| `DEV-16` | Probed and reported only; no AI-generated player-visible content ships (see REQ-34). |
| `TOOL-01` | docs/poki/08-game-dev-tools.md |
| `TOOL-02` | audit-zips.mjs sweeps the bundle for external URLs, banned markers and lifecycle signals. |
| `TOOL-03` | `pnpm build:poki` GENERATES `poki-upload/` (index.html at the root); `pnpm verify:upload` (ROOT-01…ROOT-06) asserts the folder and the zip both carry a root index.html, that the folder is current with `dist-poki/`, and that it holds only uploadable files — the failure mode behind the reported "missing index.html" upload. Runbook: docs/poki/UPLOAD.md. |
| `TOOL-04` | Client implemented behind a code-split. |
| `TOOL-05` | docs/poki/08-game-dev-tools.md |
| `TOOL-06` | P2P is selected only when the build targets Poki AND RTCPeerConnection/crypto are present (PokiMpUtils.isPokiMultiplayerAvailable); WebSocket and local paths remain for every other build. |
| `TOOL-07` | Implemented: score boards, ghost shares, per-user sync, a public pilot directory (src/game/PilotDirectory.ts — code-only lookup, one record per pilot, no presence claims) and — for non-real-time multiplayer — run share codes (src/sdk/auds.ts, src/game/SharedRun.ts: publish a run, race a friend's code, count plays through the public _increment endpoint). |
| `TOOL-08` | Portability is enforced by construction and the ids are wired: createAudsIfConfigured() returns null unless VITE_POKI_GAME_ID is set, `pnpm isolation:check` fails if auds.poki.io reaches a non-Poki edition, and build:poki sets both VITE_POKI_GAME_ID and VITE_POKI_NETLIB_GAME_ID (grep-verified here). The built dist-poki/index.html carries the id; dist-crazy and dist-generic carry zero occurrences. src/game/__tests__/poki-build-ids.test.ts pins the invariants a grep cannot: both ids are canonical UUIDs, they are the same game, no other build script carries one, and .env.example never duplicates the live value. Whether the id is the one Poki issued is TOOL-09. |
| `TOOL-09` | package.json (build:poki) · src/game/__tests__/poki-build-ids.test.ts · docs/poki/08-game-dev-tools.md · docs/AUDS.md · scripts/verify-isolation.mjs |
| `REQ-01` | e2e asserts canvas coverage, visible menu/lobby and zero page errors at each size. |
| `REQ-02` | Rejection guard installed before anything else; overlay-only UI; share flow uses the platform share API. |
| `REQ-03` | Storage facade: localStorage -> sessionStorage -> in-memory, canary-probed. |
| `REQ-04` | Zip gate at 8 MB; measured ≈0.7 MB. |
| `REQ-05` | Manifest link stripped at packaging; boot.ts skips registration entirely for portal targets. |
| `REQ-06` | body/#root fixed inset:0 overflow:hidden; renderer resize on viewport change. |
| `REQ-10` | PokiAdapter.loadingFinished() is one-shot; gameLoadingStart fires once right after init; and the entry-point loading-screen failsafe routes through the live adapter instead of the raw SDK global, so it cannot add a second gameLoadingFinished on a healthy boot (it used to, 1.5 s after window load — found by e2e/poki-artifact.spec.ts, pinned by platform-failsafe.test.ts). |
| `REQ-11` | GameplayEventSink dedupes every emission and suppresses stale phase replays; the shipping artifact is now recorded in a real browser (pnpm test:artifact) and the sequence is asserted to contain no consecutive duplicate gameplay phase. |
| `REQ-12` | Both resume call sites (button, ESC/P) route through the commercial break. |
| `REQ-13` | runOutcome resets to fail at run start and is only set to complete on the goal-reached branch. |
| `REQ-14` | measure('rewarded', continuePlacementLabel(kind), 'visible'\|'interact') on the continue screen — `rewarded` is the category the Game Events guide uses for ad placements (REQ-72). |
| `REQ-15` | beginPortalAd/endPortalAd mute audio and gate input around the break. |
| `REQ-16` | SDK load races a hard timeout; init rejection is swallowed; a safety timer dismisses the portal loader. |
| `REQ-20` | Packaging scrubs payment markers; verify-portal rejects stripe literals; portal builds use coin-only progression. |
| `REQ-21` | One spendable currency (coins); VIP/Gold are statuses. The dead VIP-coin ad flow was removed. |
| `REQ-22` | Bundle sweep asserts the absence of non-platform ad literals. |
| `REQ-23` | Local ad pacing logic is excluded from portal builds. |
| `REQ-24` | Zero external links in portal bundles (og:url stripped, store links scrubbed). |
| `REQ-30` | docs/audits/POKI_COMPLIANCE_AUDIT.md C12 |
| `REQ-31` | Portal editions ship NO chat: SQUAD_CHAT=false in edition.poki/crazy/generic.ts removes the club chat box, its input and the chat promise from the menu copy, Game/Squad refuse the send, and the polling loop never runs. Enforced by the PORTAL_FORBIDDEN_MARKERS table in scripts/portal-markers.mjs (checked by verify-portal, audit-zips and verify-upload ROOT-07); emotes are the sanctioned alternative and are now reachable in every race state (src/game/__tests__/emote-ui.test.ts). |
| `REQ-32` | Passive getUser() only, never persisted; no email/social login. |
| `REQ-33` | docs/audits/POKI_COMPLIANCE_AUDIT.md C13 |
| `REQ-34` | Bundle sweep for watermark/prompt strings (audit-zips.mjs) |
| `REQ-35` | Full external-URL inventory of the bundle; fonts self-hosted and inlined. |
| `REQ-40` | src/sdk/poki.ts getIdentity() |
| `REQ-41` | getIapToken() returns the token for immediate verification; nothing persists it. |
| `REQ-42` | Local save and local boards are the default; platform identity only decorates the profile. |
| `REQ-50` | docs/poki/09-platform-requirements.md |
| `REQ-51` | Separate artifacts per portal with distinct hashes; the Poki zip carries no store links, and scripts/audit-zips.mjs + verify-portal.mjs fail on ANY foreign portal marker (scripts/portal-markers.mjs). |
| `REQ-52` | SUBMISSION_CHECKLIST.md |
| `REQ-53` | docs/poki/09-platform-requirements.md |
| `REQ-60` | Pill moved clear of the flight HUD at SDK boot. |
| `REQ-61` | edition CUSTOM_PILOT_NAMES=false in edition.poki/crazy/generic.ts: the leaderboard renders the generated pilot name read-only with a 🎲 roll instead of an input (pilot-name-surface.test.ts drives the real renderer both ways), rename-pilot refuses typed text, and scripts/portal-markers.mjs fails any portal bundle containing data-ref="pilotName" (dist-poki/index.html has 0 matches). |
| `REQ-62` | GOLD's "No sponsored breaks, ever" bullet is emitted only when edition SELL_AD_REMOVAL is true (direct build); portal bundles fold the ternary to [] and contain no such string. Portal builds never inject their own interstitials (dueAd is gated on portalEnabled()), so the claim was untrue there as well as forbidden. |
| `REQ-63` | PORTAL_FORBIDDEN_MARKERS rejects /No sponsored breaks/i, ad-removal phrasing and data-ref="pilotName" in every portal zip; the direct build keeps both (dist/assets/Game-*.js). |
| `REQ-64` | The Account screen's "Sponsored breaks respect a hard cap: N left today" line is now gated on portalName === "none"; e2e/portal-policy.spec.ts (pnpm test:policy) boots poki-upload/ in a real browser and scans the rendered text of 17 reachable screens for ad-removal/ad-schedule copy on desktop and phone. |
| `REQ-65` | Squad.load() returned early only on abort/live/loading, so with VITE_SOCIAL_URL blanked it fetched a relative /register against the host origin — a 404 plus a console error the moment a player opened Squad on Poki. It now also bails when API is empty; the policy spec fails on any response >= 400 while walking every menu screen. |
| `REQ-66` | docs/poki/CSP_REQUEST.md; public/privacy.html; SUBMISSION_CHECKLIST.md Step 2b; src/game/__tests__/legal-editions.test.ts |
| `REQ-67` | All three portal build scripts set VITE_PRIVACY_URL=https://sunbird-snowy.vercel.app/privacy; privacyPolicyUrl() only falls back to the relative /privacy when nothing is configured (the direct web build), and legal-editions.test.ts pins both halves. |
| `REQ-68` | HUD.renderPrivacy() renders the button only when the snapshot says the host exposes the externalLink capability AND the configured URL is http(s); the click routes to Game's open-privacy-url case, which calls platform.openExternalLink() (PokiSDK.openExternalLink on Poki) plus a privacy_open_hosted telemetry event. audit-zips.mjs additionally hard-fails on window.open( / location.href = in any portal artifact. |
| `REQ-69` | src/game/legal.edition.poki.ts (the host table) · scripts/gen-csp-request.ts → docs/poki/CSP_REQUEST.md · scripts/verify-csp.ts, which scans the built dist-poki bundle for every origin (https, wss, stun, turns, protocol-relative) and fails on an undeclared one, on a declared host the bundle never uses, or on a host that never reached the request · src/game/__tests__/legal-editions.test.ts (deployed CSP header permits no origin) · src/game/__tests__/csp-crosscheck.test.ts (10 cases proving that scan bites) |
| `REQ-70` | PokiAdapter keeps a gameplayRunning flag: gameplayStart() no-ops while running, gameplayStop() no-ops while stopped, and gameplayIsRunning exposes the state for tests. GameplayEventSink stays the first line of defence; the adapter is the backstop that keeps the contract even if a future call site bypasses the sink. |
| `REQ-71` | src/sdk/poki-canon.ts maps PokiSdkOfficial from @poki/sdk@0.0.5 (devDependency) and lists the live CDN build's extra members with a wired/not-wired verdict each. The suite re-reads node_modules/@poki/sdk/dist/index.d.ts at run time, extracts every referenced member from src/sdk/poki.ts and the boot path in platform.ts, and fails on anything unpublished. Five invented members were removed: happytime (canonical happyTime(intensity)), signalGameReady (CrazyGames'), hasAdBlock/setAdBlockActive (canonical isAdBlocked), mute/isMuted (Poki has no portal mute preference) and sendUserEvent (canonical measure). Each was called through an optional chain, so each was a silent no-op in production. See docs/poki/SDK_CANON.md. |
| `REQ-72` | sanitizeMeasure() applies the loader's three rules before the call (the SDK drops violations with only a console error, so the dashboard silently loses the event) and MEASURE_CATEGORIES is asserted equal to the MeasureCategory union in the published typings. The second parameter is named `what`, not `label`. |
| `REQ-73` | Events.ts tracked weekly and monthly progress internally and nothing reached the portal, which is what the Game Events dashboard showed as empty. Game.ts now emits quest/checkpoint progress pairs (start then exactly one of complete\|fail) for the weekly event, the daily challenge and the gauntlet, plus achievement/cosmetic/upgrade/economy/player events for trophies, unlocks, mastery, spend, personal bests and every Funnel milestone. |
| `REQ-74` | happyTime is clamped by clampHappyIntensity and fired at personal best (1), gauntlet clear and prize unlocks (0.9), achievements (0.85), weekly clear and mastery (0.8); the CrazyGames adapter maps the same call to its own game.happytime() and gates it at >= 0.75 per its 'use sparingly' rule. getLanguage() is injected into i18n via setPortalLanguageProvider, consulted first by browserLocales(), and refreshAutoLocale() re-resolves once the SDK lands - only ever moving an `auto` preference. |
| `REQ-75` | beginPortalBreak(placement) sets the `ad` state, takes the adInFlight lock and emits the portal_break_request telemetry; setState drops any transition out of `ad` while the lock is held, so a stray tap or a late callback cannot emit a mid-ad start; endPortalAd() releases the lock first so the awaiting caller's own transition is the way back into gameplay. All five portal placements (restart, resume, to-menu, results-multiplier, continue) go through the helper. The self-served interstitial in non-portal builds uses the same state but is driven by adTimer/endAd() and stays outside the lock. |
| `REQ-76` | InitOptions in @poki/sdk@0.0.5 declares submitScore?: (fn: (leaderboard: string, score: number) => void) => void; platform.ts calls init(pokiInitOptions()) on the boot path, poki.ts keeps the submitter and submitPlatformScore() uses it for the `distance` leaderboard. sendHighscore exists in the live CDN build but is recorded as unwired legacy in POKI_SDK_RUNTIME_ONLY. |
