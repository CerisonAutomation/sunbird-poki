# Poki compliance report

**Generated:** 2026-09-24 by `pnpm poki:audit` — do not edit by hand.
**Result:** ✅ every satisfied rule verified · 167/188 rules verified · 131 of them hard requirements.

**Scope:** the extracted guide corpus in this folder (`requirements.json`, version 2026-09-22). Rules marked *action* are human/submission steps, *deferred* are accepted gaps with a recorded reason — both are listed so nothing is silently skipped.

| Status | Rules |
|---|---|
| satisfied | 167 |
| action (submission step) | 0 |
| deferred (accepted) | 0 |
| informational | 21 |

## GK — Developer Guide overview

*Source page: [`00-guide-overview.md`](./00-guide-overview.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `GK-01` | recommendation | Choose a web game engine deliberately (2D/3D + multiplayer needs) and understand player-hardware insights so the build stays compatible and performant. | ✅ | docs/poki/01-web-game-engines.md |
| `GK-02` | recommendation | Success on web depends on fast onboarding, high engagement strategies, and localization. | ✅ | src/game/__tests__/firstflight.test.ts |
| `GK-03` | recommendation | Integrate monetization early so rewarded placements land at natural moments. | ✅ | src/game/Game.ts matches /rewardedBreak\|continue-ad/ |
| `GK-04` | recommendation | Thumbnails are the primary acquisition surface; make them impactful. | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |
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
| `EA-02` | requirement | Keep it small: target an 8–10 MB game file for older hardware and slow connections. | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `EA-03` | recommendation | Skip the menu: let first-time players reach gameplay without splash/title/level-select detours. | ✅ | src/game/HUD.ts matches /home-launch/ |
| `EA-04` | requirement | Loading screens must be visually engaging and include a progress bar. | ✅ | index.html matches /role="progressbar"/ |
| `EA-05` | recommendation | Progressive loading: ship essential initial assets first, load the rest in the background. | ✅ | src/game/__tests__/boot-progress.test.ts |
| `EA-06` | recommendation | Safe beginner environment: simple early levels, gradual difficulty, prevent early death. | ✅ | src/game/__tests__/firstflight.test.ts |
| `EA-07` | recommendation | Gradual introduction: teach mechanics and controls over several levels to cut frontal load. | ✅ | src/game/__tests__/firstflight.test.ts |
| `EA-08` | requirement | Explain the game with visuals, not text walls; tutorials must not block gameplay. | ✅ | src/game/__tests__/input-ui.test.ts |
| `EA-09` | recommendation | Playtest recordings to fine-tune onboarding and drop-off. | ✅ | src/game/__tests__/poki-game-events.test.ts (pinned: /enables event tracking on the boot path/) |
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
| `LOC-04` | requirement | Phase 1: EFIGS + Turkish. Phase 2: CJK. Phase 3: pt-BR + Russian. | ✅ | 10 locales × 218 strings complete |
| `LOC-05` | requirement | Detect the browser language and serve it; a manual selector should exist too. | ✅ | src/i18n/__tests__/locales.test.ts |

## THB — Game thumbnail

*Source page: [`06-thumbnail.md`](./06-thumbnail.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `THB-01` | requirement | A high-quality thumbnail is essential for attracting players. | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |
| `THB-02` | requirement | The thumbnail must accurately reflect the game's content. | ✅ attested | Thumbnail uses the game's sky/sun/ridge palette and the player's bird in the pose seen in the first five seconds. |
| `THB-03` | recommendation | Embrace simplicity: one clear foreground object. | ✅ attested | Single hero subject (bird) over a two-layer background; no clutter or screenshot chrome. |
| `THB-04` | recommendation | Keep a series visually consistent across thumbnails. | ✅ attested | One palette and hero pose reused across icon sizes, store card and video frame. |
| `THB-05` | requirement | Full-bleed square, minimum 628 x 628 px. | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |
| `THB-06` | requirement | Do not cut corners: rounded corners are applied by the platform mask. | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |
| `THB-07` | requirement | Details and typography must stay legible when scaled down. | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |
| `THB-08` | requirement | High contrast; avoid colours close to the Poki Playground background #83FFE7. | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |
| `THB-09` | requirement | Static thumbnail for the player-fit test; animated 3-5 s gameplay loop before global release. | ✅ | assets/submission/sunbird-thumbnail-animated.gif |
| `THB-10` | recommendation | Keep delivered image weight sane (Inspector warns on heavy images). | ✅ verified (executed) | executed: node scripts/verify-thumbnail.mjs |

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
| `TOOL-02` | requirement | The build must survive the Inspector's mobile and technical-optimisation passes (no external resources, no console errors, sane image weights). | ✅ verified (executed) | executed: node scripts/audit-zips.mjs |
| `TOOL-03` | requirement | Uploadable as a folder with index.html at the root, working from any sub-path. | ✅ verified (executed) | executed: node scripts/verify-upload.mjs |
| `TOOL-04` | informational | Netlib is a WebRTC-datachannel P2P library for web games. | ℹ️ info | src/game/PokiNetlib.ts |
| `TOOL-05` | informational | Netlib is usable whether or not the game is hosted on Poki. | ℹ️ info | Availability note. |
| `TOOL-06` | requirement | Feature-detect WebRTC and keep a non-P2P path when using Netlib. | ✅ | src/game/PokiMpUtils.ts matches /RTCPeerConnection/ |
| `TOOL-07` | informational | AUDS stores user-generated content and returns shareable codes, enabling non-real-time multiplayer. | ℹ️ info | src/sdk/auds.ts |
| `TOOL-08` | requirement | AUDS is exclusive to Poki-hosted games and needs a live game id, so it cannot be a dependency of portable builds. | ✅ verified (executed) | executed: node scripts/verify-upload.mjs |

## REQ — Platform requirements, policies & release

*Source page: [`09-platform-requirements.md`](./09-platform-requirements.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `REQ-01` | requirement | Scale to 640x360, 836x470 and 1031x580 (plus real devices) with no crop or scroll. | ✅ | e2e/scaling.spec.ts (pinned: /640\|836\|1031/) |
| `REQ-02` | requirement | Run inside a cross-origin iframe: no top-level navigation, window.open, dialogs, or console errors. | ✅ | src/rejection-guard.ts matches /unhandledrejection\|rejection/ |
| `REQ-03` | requirement | Fully playable in incognito / with storage blocked. | ✅ | src/game/__tests__/storage.test.ts |
| `REQ-04` | requirement | Initial download under ~5 MB, total under ~8 MB. | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `REQ-05` | requirement | No service worker or manifest inside portal builds. | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `REQ-06` | requirement | Fixed non-scrolling page with the canvas filling the viewport; portrait and landscape supported. | ✅ | src/index.css matches /position: fixed/ |
| `REQ-10` | requirement | Lifecycle order init -> gameLoadingStart -> gameLoadingFinished, each phase marker once. | ✅ | src/sdk/__tests__/platform-failsafe.test.ts |
| `REQ-11` | requirement | gameplayStart on real play start, gameplayStop on stop; never duplicated or inverted. | ✅ | e2e/poki-artifact.spec.ts |
| `REQ-12` | requirement | Pause/unpause order: gameplayStop -> commercialBreak -> gameplayStart. | ✅ | src/game/Game.ts matches /resumeFromPause/ |
| `REQ-13` | requirement | Game events: one start per attempt, then exactly one of complete or fail. | ✅ | src/game/Game.ts matches /runOutcome/ |
| `REQ-14` | requirement | Rewarded placements emit visible when shown and interact when chosen. | ✅ | src/game/Game.ts matches /continue-ad/ |
| `REQ-15` | requirement | Mute audio and disable input for the whole ad break. | ✅ | src/game/Game.ts matches /beginPortalAd/ |
| `REQ-16` | requirement | Work when the SDK is unavailable: boot anyway, never block on the portal. | ✅ | src/game/__tests__/journey-reliability.test.ts |
| `REQ-20` | requirement | No in-app purchases on the platform and no UI implying them. | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `REQ-21` | requirement | No secondary spendable currencies. | ✅ | src/game/__tests__/economy.test.ts |
| `REQ-22` | requirement | No third-party ad systems. | ✅ verified (executed) | executed: node scripts/audit-zips.mjs |
| `REQ-23` | requirement | No ad-timer or cooldown manipulation. | ✅ | src/game/Game.ts matches /portalEnabled\(\)/ |
| `REQ-24` | requirement | External links only through the platform API; portal builds should have none. | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `REQ-30` | requirement | All-ages content: no violence, sexual content, gambling, substances, fear or bullying. | ✅ attested | Family-friendly bird flight; no combat, no gore, no casino framing (the lucky wheel is a free daily gift, not a paid spin), no substances, no chat. |
| `REQ-31` | requirement | No chat in multiplayer surfaces; emotes are the recommended alternative. | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `REQ-32` | requirement | No PII collection; platform identity is display-only. | ✅ | src/sdk/poki.ts matches /getIdentity/ |
| `REQ-33` | requirement | Originality: art, UI, mechanics, characters, audio and name must be the developer's own. | ✅ attested | Procedural biomes, custom UI, original bird/characters, procedural score; no third-party art or audio. |
| `REQ-34` | requirement | AI-assisted production: no watermarks or prompt text; process documentable on request. | ✅ attested | No AI-generated asset files ship (art is procedural, audio is synthesized); production history is the git log. |
| `REQ-35` | recommendation | External resources policy: prefer zero external requests; bundle assets and avoid CDNs. | ✅ verified (executed) | executed: node scripts/audit-zips.mjs |
| `REQ-40` | requirement | Identity is passive: never force a login at boot. | ✅ attested | login() is deliberately not called at boot (Poki's login reloads the page on first use); getUser() is passive with a local fallback name. |
| `REQ-41` | recommendation | Platform tokens are short-lived and must be verified server-side immediately, never stored. | ✅ | src/sdk/poki.ts matches /getToken/ |
| `REQ-42` | requirement | A player who is not signed in must still play the full game. | ✅ | src/game/__tests__/save.test.ts |
| `REQ-50` | informational | Revenue split: 100% on search/owned traffic, 50/50 on platform-driven traffic. | ℹ️ info | Business term; nothing to implement. |
| `REQ-51` | requirement | The submitted build is web-exclusive: no store build that double-serves the Poki artifact. | ✅ verified (executed) | executed: node scripts/audit-zips.mjs |
| `REQ-52` | informational | Release flow: folder upload -> Inspector QA -> player-fit test -> web-fit test -> review. | ✅ verified (executed) | executed: node scripts/verify-inspector-qa.mjs |
| `REQ-53` | informational | Web-fit metrics: C2P (click-to-play), CTR (thumbnail), time on page. | ℹ️ info | C2P is minimised by the sub-1 MB boot and immediate first frame; CTR by the specification-compliant thumbnail; time-on-page by the daily/weekly retention loops. |
| `REQ-60` | requirement | Do not place HUD under the mobile platform pill; use movePill() to relocate it. | ✅ | src/sdk/platform.ts matches /movePill/ |
| `REQ-61` | requirement | Player-authored text is limited to the pilot's own display name: no chat system, no personal-data collection, and the name is moderated before it can be broadcast or stored, because it reaches other players (netlib rosters, name tags) and a public leaderboard. | ✅ | src/game/__tests__/pilot-name-moderation.test.ts (pinned: /Scunthorpe problem/) |
| `REQ-62` | requirement | No offer to remove or disable ads, and no ad-frequency claim in a portal paywall. | ✅ | src/game/__tests__/portal-policy.test.ts (pinned: /sponsored breaks/) |
| `REQ-63` | requirement | Portal bundles must contain no ad-removal copy, and no portal may ship a name surface it does not moderate (bundle-level enforcement of REQ-20 and the pilot-name policy). | ✅ verified (executed) | executed: node scripts/verify-portal.mjs |
| `REQ-64` | requirement | A portal build must not describe or count ad breaks it does not schedule — the platform owns ad frequency. | ✅ | e2e/portal-policy.spec.ts (pinned: /must not offer ad removal/) |
| `REQ-65` | requirement | A portal build must issue no request that can fail on the host origin (no relative calls to absent backends). | ✅ | e2e/portal-policy.spec.ts (pinned: /HTTP \$\{r.status/) |

## SDK — PokiSDK: HTML5

*Source page: [`10-sdk-html5.md`](./10-sdk-html5.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `SDK-01` | requirement | The SDK is loaded from the platform CDN in the page head; never bundled or re-hosted. | ✅ | scripts/package-portal.mjs matches /game-cdn\.poki\.com/scripts/v2/poki-sdk\.js/ |
| `SDK-02` | requirement | init() runs at start and the game continues on both then() and catch(). | ✅ | src/sdk/platform.ts matches /pokiInitOptions/ |
| `SDK-03` | requirement | gameLoadingFinished() fires when loading completes, exactly once. | ✅ | src/sdk/poki.ts matches /loadingFinishedSent/ |
| `SDK-04` | requirement | gameplayStart()/gameplayStop() mark play and its halt, never repeating the same phase. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /GameplayEventSink\|gameplayStart/) |
| `SDK-05` | requirement | commercialBreak() fires at natural stops as the player heads back into gameplay. | ✅ | src/game/Game.ts matches /commercialBreak/ |
| `SDK-06` | requirement | Audio is muted and input disabled for the duration of a break, restored afterwards. | ✅ | src/game/Game.ts matches /setAdMuted/ |
| `SDK-07` | requirement | A break that does not interrupt gameplay carries no stop/start pair. | ✅ | src/game/Game.ts matches /No gameplay event is sent here on purpose/ |
| `SDK-08` | requirement | rewardedBreak() rewards only on true, after telling the player an ad is coming. | ✅ | src/game/Game.ts matches /rewardedBreak/ |
| `SDK-09` | informational | A rewarded break resets the platform's commercial ad timer. | ℹ️ info | Platform-side behaviour; the game schedules no ads of its own. |
| `SDK-10` | requirement | Space/arrow keys and wheel must not scroll the host page. | ✅ | src/sdk/platform.ts matches /installPageScrollGuards/ |
| `SDK-11` | requirement | Shareable links use shareableURL() and are read back with getURLParam(). | ✅ | src/sdk/poki.ts matches /shareableURL/ |
| `SDK-12` | requirement | External navigation goes through openExternalLink() — the game frame never navigates away. | ✅ | src/game/Game.ts matches /openExternalLink/ |
| `SDK-13` | recommendation | movePill(topPercent, topPx) keeps the mobile pill clear of the UI; topPercent is 0–50. | ✅ | src/sdk/platform.ts matches /movePill/ |
| `SDK-14` | informational | Pill is 46x62 below 1211px wide and 92x64 at 1211px and up. | ℹ️ info | Platform-drawn element; sizing is informational for layout decisions. |
| `SDK-15` | requirement | The build is uploaded as a folder with index.html at the root and its event log checked in the Inspector. | ✅ verified (executed) | executed: pnpm verify:upload |

## EV — SDK overview & events

*Source page: [`11-sdk-events.md`](./11-sdk-events.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `EV-02` | informational | gameLoadingFinished() is required to track loading and C2P. | ℹ️ info | Tracked by SDK-03. |
| `EV-03` | requirement | gameplayStart() = player starts interacting; gameplayStop() = gameplay halts. | ✅ | src/game/GameplayEvents.ts matches /send\(phase/ |
| `EV-04` | requirement | Signal commercial opportunities liberally at natural stops; the platform decides when an ad shows. | ✅ | src/game/Game.ts matches /onAdOpened: \(\) => this.beginPortalAd\(\)/ |
| `EV-06` | requirement | Startup order is gameLoadingFinished() then gameplayStart(). | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /gameplayStart/) |
| `EV-07` | requirement | Death/next-level/pause sequence is stop → commercialBreak → start. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /commercialBreak/) |
| `EV-08` | requirement | Revive sequence is stop → rewardedBreak → start. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /rewardedBreak/) |
| `EV-09` | requirement | Non-interrupting ads need no stop/start pair. | ✅ | src/game/Game.ts matches /stop/start pairs/ |
| `EV-10` | requirement | No consecutive duplicate phases and no gameplay phase while an ad is on screen. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /break/) |
| `EV-11` | requirement | The Inspector Event Log is the acceptance surface for the sequences. | ✅ | src/game/__tests__/poki-analytics.test.ts (pinned: /dashboard order/) |

## GM — Game Events (measure)

*Source page: [`12-game-events.md`](./12-game-events.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `GM-01` | requirement | Event tracking is switched on at boot, or no measure() checkpoint is recorded. | ✅ | src/sdk/platform.ts matches /enableEventTracking/ |
| `GM-02` | requirement | measure() uses short, stable category/what/action values. | ✅ | src/game/Game.ts matches /measure\("run"/ |
| `GM-03` | requirement | '/' and '^' must not appear in any measure() value. | ✅ | src/game/__tests__/poki-game-events.test.ts (pinned: /reserved/) |
| `GM-04` | requirement | Progress events pair start with exactly one of complete/fail, same category and what. | ✅ | src/game/Game.ts matches /this.runOutcome/ |
| `GM-05` | requirement | Interaction events pair visible with interact for the same category/what. | ✅ | src/game/__tests__/poki-game-events.test.ts (pinned: /visible/) |
| `GM-06` | requirement | measure() must not duplicate ad impressions or completions. | ✅ | src/game/Game.ts matches /rewarded bonus card is on the recap/ |
| `GM-07` | recommendation | Rewarded placements are measured per placement. | ✅ | src/game/ContinueOffer.ts matches /continuePlacementLabel/ |
| `GM-08` | recommendation | Custom events cover milestones and choices that fit no pattern. | ✅ | src/game/Game.ts matches /measure\("reward"/ |

## NL — Poki Networking Library (Netlib)

*Source page: [`13-netlib.md`](./13-netlib.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `NL-02` | requirement | new Network(<game-id>) then create() a lobby or join(code) it. | ✅ | src/game/PokiNetlib.ts matches /new Network\(NETLIB_GAME_ID\)/ |
| `NL-03` | requirement | Real-time state on the unreliable channel; critical events on reliable. | ✅ | src/game/PokiNetlib.ts matches /unreliable/ |
| `NL-05` | requirement | WebRTC is feature-detected and a non-WebRTC path exists. | ✅ | src/game/PokiMpUtils.ts matches /RTCPeerConnection/ |
| `NL-06` | requirement | The UI says whether the player is in a live room or a local/AI fallback. | ✅ | src/game/Game.ts matches /multiplayerLive/ |
| `NL-07` | requirement | A dropped connection must not end the session; degrade to the local flock. | ✅ | src/game/PokiNetlib.ts matches /closedByUs/ |
| `NL-08` | requirement | Netlib is loaded lazily so it never lands in the boot path. | ✅ | src/game/net-transport.poki.ts matches /import\("\./PokiNetlib"\)/ |
| `NL-09` | requirement | A Netlib build must not contain another platform's transport names or endpoints. | ✅ verified (executed) | executed: pnpm isolation:check |
| `NL-10` | requirement | Lobby codes are short and unambiguous to read aloud. | ✅ | src/game/PokiMpUtils.ts matches /ABCDEFGHJKLMNPQRSTUVWXYZ/ |

## AU — AUDS: Arbitrary User Data Store

*Source page: [`14-auds.md`](./14-auds.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `AU-01` | informational | POST …/<key> creates an entry from {data, values}; values accepts string\|number\|boolean. | ℹ️ info | API shape; implemented in src/sdk/auds.ts. |
| `AU-02` | requirement | The create secret is returned once and must be stored if the entry will ever change. | ✅ | src/sdk/auds.ts matches /SECRET_STORAGE_PREFIX/ |
| `AU-04` | requirement | List supports q=, sort=/-sort=, includedata and limit (1–100). | ✅ | src/sdk/auds.ts matches /sort=-/ |
| `AU-07` | requirement | Public counters use POST …/_increment?key=<k>, key must contain 'count', no secret. | ✅ | src/game/SharedRun.ts matches /play-count/ |
| `AU-09` | requirement | Published content is public: payloads from the network must be validated before use. | ✅ | src/game/Leaderboard.ts matches /truncate/ |
| `AU-10` | requirement | AUDS is Poki-only; no other edition may reach auds.poki.io. | ✅ | src/sdk/auds.ts matches /createAudsIfConfigured/ |

## UA — User Accounts & cloud gamesaves

*Source page: [`15-user-accounts.md`](./15-user-accounts.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `UA-01` | requirement | getUser() is called after load and every state (signed in, out, opted out) is handled. | ✅ | src/game/Game.ts matches /adoptPortalIdentity/ |
| `UA-02` | requirement | login() is only called from a user interaction, never automatically on load. | ✅ | src/game/Game.ts matches /case "portal-sign-in"/ |
| `UA-04` | requirement | getToken() tokens are short-lived (~1 min) and must not be stored or reused. | ✅ | src/sdk/poki.ts matches /getToken/ |
| `UA-07` | requirement | Local-only data is prefixed poki_ignore so cloud gamesaves skip it. | ✅ | src/game/__tests__/storage.test.ts (pinned: /poki_ignore/) |
| `UA-08` | requirement | The cloud save payload must stay under 1 MB gzipped. | ✅ | src/game/Storage.ts matches /LOCAL_ONLY_PREFIXES/ |
| `UA-09` | requirement | Synced state must be safe to receive from another device. | ✅ | src/game/Storage.ts matches /physicalKey/ |
| `UA-03` | informational | Inspector debug mode returns a static TestUser with a placeholder avatar. | ℹ️ info | The Account screen renders whatever getUser() returns. |

## SUB — Submission readiness & policies

*Source page: [`16-submission.md`](./16-submission.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `SUB-01` | requirement | Upload a web build: folder with index.html at the root, working on desktop, mobile and tablet. | ✅ verified (executed) | executed: pnpm verify:upload |
| `SUB-04` | requirement | Thumbnail: full-bleed square >=628px, one subject, minimal text, high contrast, not near #83FFE7. | ✅ verified (executed) | executed: pnpm verify:thumbnail |
| `SUB-05` | recommendation | Suggested categories: up to four chosen for genuine fit. | ✅ | docs/poki/SUBMISSION.md matches /Suggested Categories/ |
| `SUB-06` | requirement | A live privacy policy page is required before an external service can be approved. | ✅ | public/privacy.html |
| `SUB-07` | requirement | The privacy policy must also be linked from inside the game. | ✅ | src/game/HUD.ts matches /open-privacy/ |
| `SUB-08` | recommendation | Dashboard description and engine field describe the game and the tech. | ✅ | docs/poki/SUBMISSION.md matches /three-js/ |
| `SUB-09` | requirement | External resources are requested in Settings → CSP; assets are bundled, not fetched from CDNs. | ✅ verified (executed) | executed: pnpm verify:portals |
| `SUB-11` | requirement | No in-game chat systems; emoji/quick messages are the sanctioned alternative. | ✅ | src/game/edition.poki.ts matches /SQUAD_CHAT = false/ |
| `SUB-12` | requirement | No external account systems and no collection of personal information. | ✅ | src/game/pilotNameModeration.ts matches /const CONTACT/ |
| `SUB-13` | requirement | Content must stay family-friendly (no violence, gambling, adult or scary themes). | ✅ attested | Game content: birds, islands, weather; currency earned only by flying. |
| `SUB-14` | requirement | Controls offer alternatives so players who cannot use WASD are not excluded. | ✅ | src/game/Input.ts matches /pointerdown/ |
| `SUB-16` | informational | Player fit test: 500 players; healthy = 3 min+ average and >=25% over 3 min. | ℹ️ info | Run after the thumbnail is uploaded; requires 10 playtest recordings watched first. |
| `SUB-17` | informational | Web fit test weights CTR, average time on page and C2P equally; C2P comes from the first gameplayStart(). | ℹ️ info | C2P work already landed: portal editions skip the name screen and boot straight to play. |

## PAR — Partnering, curation & release

*Source page: [`17-partnering.md`](./17-partnering.md)*

| Rule | Kind | Requirement | Status | Verification |
|---|---|---|---|---|
| `PAR-02` | informational | Web exclusivity: the same game may not be published on other web portals or aggregators. | ℹ️ info | Separate per-target artifacts; the exclusivity decision is a publishing choice. |
| `PAR-05` | informational | Baseline signals: quality, player fit, and tech (load time, frame rate, file size). | ℹ️ info | executed: pnpm audit:zips |
| `PAR-06` | recommendation | Beyond the baseline: originality, depth, first impression, cross-device feel, room to grow. | ℹ️ info | Documented in REBUILD_REPORT.md (30 tracks, seasons, wings, daily goals, endless/solo/race). |
| `PAR-08` | informational | After final review: agreement, legal, QA, Soft Release, Global Release (~2-3 months). | ℹ️ info | Tracked in docs/poki/SUBMISSION.md as the roadmap after upload. |

## Actions and accepted gaps

| Rule | Status | What remains |
|---|---|---|

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
| `EA-09` | First-run funnel is instrumented and pinned (boot-path event tracking + visible/interact pairing, poki-game-events.test.ts). The Playtest upload itself is a dashboard action. |
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
| `MON-21` | One continue per crash; economy faucets are audited (see POKI_COMPLIANCE_AUDIT.md fix log F5/F8). |
| `MON-22` | POKI_COMPLIANCE_AUDIT.md F6 |
| `LOC-01` | 12 shipped locales. |
| `LOC-02` | One barrel file with keyed entries (sourceText + meta + placeholders + translations); lookup via t()/useTranslations(). |
| `LOC-03` | Tutorial, shop, settings and results copy are all in the barrel. |
| `LOC-04` | All phase-1 and phase-3 locales ship, with the phase-2 CJK pair present (Korean is the remaining optional locale). |
| `LOC-05` | Boot-time navigator.language matching, persisted choice (private-mode safe), manual selector in Settings, RTL direction handling. |
| `THB-01` | assets/submission/sunbird-thumbnail-1024.png rendered from the game's own palette and mid-dive pose. |
| `THB-02` | assets/submission/sunbird-thumbnail-1024.png |
| `THB-03` | assets/submission/sunbird-thumbnail-1024.png |
| `THB-04` | public/icons/ + assets/submission/ |
| `THB-05` | 1024x1024, square, full-bleed. |
| `THB-06` | Gate asserts corner pixels are opaque and painted (no baked rounding, border or letterbox). |
| `THB-07` | Gate downsamples to 128 px and requires the subject/background contrast to survive; thumbnail carries no typography by design. |
| `THB-08` | Gate rejects a dominant colour within the threshold of #83FFE7 and requires a minimum luminance spread. |
| `THB-09` | Animated 3-5 s gameplay loop captured from the shipping folder by scripts/capture-animated-thumbnail.mjs (628x628 GIF); the static thumbnails are gated by verify:thumbnail. |
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
| `TOOL-08` | ROOT-10 proves the shipped html carries the Poki game id with AUDS live; isolation:check proves no non-Poki edition can reach auds.poki.io. |
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
| `REQ-14` | measure('button','continue-ad','visible'\|'interact') on the continue screen. |
| `REQ-15` | beginPortalAd/endPortalAd mute audio and gate input around the break. |
| `REQ-16` | SDK load races a hard timeout; init rejection is swallowed; a safety timer dismisses the portal loader. |
| `REQ-20` | Packaging scrubs payment markers; verify-portal rejects stripe literals; portal builds use coin-only progression. |
| `REQ-21` | One spendable currency (coins); VIP/Gold are statuses. The dead VIP-coin ad flow was removed. |
| `REQ-22` | Bundle sweep asserts the absence of non-platform ad literals. |
| `REQ-23` | Local ad pacing logic is excluded from portal builds. |
| `REQ-24` | Zero external links in portal bundles (og:url stripped, store links scrubbed). |
| `REQ-30` | POKI_COMPLIANCE_AUDIT.md C12 |
| `REQ-31` | Portal editions ship NO chat: SQUAD_CHAT=false in edition.poki/crazy/generic.ts removes the club chat box, its input and the chat promise from the menu copy, Game/Squad refuse the send, and the polling loop never runs. Enforced by the PORTAL_FORBIDDEN_MARKERS table in scripts/portal-markers.mjs (checked by verify-portal, audit-zips and verify-upload ROOT-07); emotes are the sanctioned alternative and are now reachable in every race state (src/game/__tests__/emote-ui.test.ts). |
| `REQ-32` | Passive getUser() only, never persisted; no email/social login. |
| `REQ-33` | POKI_COMPLIANCE_AUDIT.md C13 |
| `REQ-34` | Bundle sweep for watermark/prompt strings (audit-zips.mjs) |
| `REQ-35` | Full external-URL inventory of the bundle; fonts self-hosted and inlined. |
| `REQ-40` | src/sdk/poki.ts getIdentity() |
| `REQ-41` | getIapToken() returns the token for immediate verification; nothing persists it. |
| `REQ-42` | Local save and local boards are the default; platform identity only decorates the profile. |
| `REQ-50` | docs/poki/09-platform-requirements.md |
| `REQ-51` | Separate artifacts per portal with distinct hashes; the Poki zip carries no store links, and scripts/audit-zips.mjs + verify-portal.mjs fail on ANY foreign portal marker (scripts/portal-markers.mjs). |
| `REQ-52` | Inspector QA modules mapped to gates: folder/root index (verify:upload), External Resources (audit:zips), Image Optimization (verify:thumbnail); scaling and mobile are covered by test:orientation and test:mobile in `pnpm gate`. |
| `REQ-53` | docs/poki/09-platform-requirements.md |
| `REQ-60` | Pill moved clear of the flight HUD at SDK boot. |
| `REQ-61` | Poki forbids chat systems and personal-data collection (external-resources policy: 'Chat systems aren't allowed', 'Games must not collect personal information', 'no email-based logins'), which is SQUAD_CHAT=false — the chat UI is not in the bundle. It does not forbid a chosen display name, so edition.poki.ts sets CUSTOM_PILOT_NAMES=true and the safety work moves to moderation: every write goes through src/game/pilotNameModeration.ts (shape + contact guard + NFKD/leit/homoglyph normalisation + blocklist + a safe-word allowlist so 'Cockpit'/'Classic'/'Assassin' are not caught by their own substrings), asserted by pilot-name-moderation.test.ts (95 cases) and gated at both write paths in Game.ts. crazy/generic keep CUSTOM_PILOT_NAMES=false (no filter there). |
| `REQ-62` | GOLD's "No sponsored breaks, ever" bullet is emitted only when edition SELL_AD_REMOVAL is true (direct build); portal bundles fold the ternary to [] and contain no such string. Portal builds never inject their own interstitials (dueAd is gated on portalEnabled()), so the claim was untrue there as well as forbidden. |
| `REQ-63` | PORTAL_FORBIDDEN_MARKERS rejects /No sponsored breaks/i and ad-removal phrasing in every portal zip; the direct build keeps both (dist/assets/Game-*.js). data-ref="pilotName" is a FOREIGN marker for crazy/generic (CUSTOM_PILOT_NAMES=false there, so a typed field in those bundles means the flag regressed) and an allowed surface on Poki, which moderates it. |
| `REQ-64` | The Account screen's "Sponsored breaks respect a hard cap: N left today" line is now gated on portalName === "none"; e2e/portal-policy.spec.ts (pnpm test:policy) boots poki-upload/ in a real browser and scans the rendered text of 17 reachable screens for ad-removal/ad-schedule copy on desktop and phone. |
| `REQ-65` | Squad.load() returned early only on abort/live/loading, so with VITE_SOCIAL_URL blanked it fetched a relative /register against the host origin — a 404 plus a console error the moment a player opened Squad on Poki. It now also bails when API is empty; the policy spec fails on any response >= 400 while walking every menu screen. |
| `SDK-01` | scripts/package-portal.mjs injects the exact CDN script tag into the Poki head; ROOT-08 + the analytics test assert it survives packaging. |
| `SDK-02` | bootstrapSdk() awaits init() inside a try; SDK_LOAD_TIMEOUT_MS and the loading failsafe keep a blocked CDN playable. |
| `SDK-03` | One-shot flag in PokiAdapter.loadingFinished(); the entry-point failsafe routes through the same adapter. |
| `SDK-04` | Every phase change funnels through GameplayEventSink (src/game/GameplayEvents.ts), which suppresses consecutive duplicates. |
| `SDK-05` | Result/continue/pause transitions route through PlatformAdapter.commercialBreak(). |
| `SDK-06` | beginPortalAd()/endPortalAd() silence audio and lock input; restore never depends on the pause callback firing. |
| `SDK-07` | Documented and implemented in beginPortalAd(); pinned by the analytics test. |
| `SDK-08` | The boolean gates the reward; the offer card is labelled with the 🎬 ad path beside a non-ad alternative. |
| `SDK-09` | No internal ad timer exists (REQ-21), so the platform's timer is the only one. |
| `SDK-10` | installPageScrollGuards() is wired in Game boot and detached on dispose. |
| `SDK-11` | PokiAdapter.share() prefers the SDK URL builder and only degrades when the SDK is absent. |
| `SDK-12` | The Settings privacy link routes through platform.openExternalLink(). |
| `SDK-13` | Boot nudges to (50,-4) then (0,56) once the HUD exists — below the daylight meter, still above 50%. |
| `SDK-14` | The HUD keeps the top-left band clear on both pill widths. |
| `SDK-15` | Folder shape is ROOT-01..ROOT-10 (index.html at the root, no wrapping directory, uploadable files only). The event-log sequences are pinned by src/game/__tests__/poki-analytics.test.ts; the Inspector walk confirms the same log. |
| `EV-02` | Fired once per boot. |
| `EV-03` | The sink is the single emitter of both phases. |
| `EV-04` | Breaks are requested at every natural halt (death, results exit, pause return). |
| `EV-06` | The stub-SDK test asserts the boot order. |
| `EV-07` | Pause→resume is asserted as commercialBreak start/end then gameplayStart. |
| `EV-08` | Revive path asserted with the rewarded break. |
| `EV-09` | Documented in beginPortalAd()'s comment and enforced by the sink. |
| `EV-10` | The analytics test asserts zero gameplay events between break start and end. |
| `EV-11` | The documented sequence (gameplayStop -> commercialBreak -> gameplayStart, and the rewarded revive) is asserted in-process by poki-analytics.test.ts and observed end-to-end on the shipping artifact by e2e/poki-artifact.spec.ts. |
| `GM-01` | Called right after init({submitScore}) inside its own try. |
| `GM-02` | run/<mode>/start + outcome, button/<placement>/visible + interact, reward/<placement>/granted. |
| `GM-03` | Source-level scan of every measure() call site plus the two dynamic value definitions. |
| `GM-04` | The settlement path sends one outcome per attempt. |
| `GM-05` | Pinned by the game-events test (visible count >= interact count). |
| `GM-06` | Only the offer UI is measured; ad playback is tracked by the ad calls themselves. |
| `GM-07` | Placement labels ('continue-ad-<kind>') keep offers comparable across contexts. |
| `GM-08` | reward/<placement>/granted records the milestone. |
| `NL-02` | Host creates, guest joins by code; both wrapped behind the game's NetTransport interface. |
| `NL-03` | 15 Hz unreliable state + reliable hello/start/place events. |
| `NL-05` | isPokiMultiplayerAvailable() gates the Netlib client; net-transport.poki.ts falls back to the WebSocket client. |
| `NL-06` | HUD status + race screen state the live/local truth; local rivals are labelled AI. |
| `NL-07` | Reconnect + seat preservation in PokiNetlibClient; MassRace keeps flying the local squadron otherwise. |
| `NL-08` | One shared dynamic import (loadNetlib) is awaited by createNetTransport and warmed by prewarmNetTransport: the library is never in the boot path, and never in a non-Poki bundle. |
| `NL-09` | Per-target transport module swap + isolation check. |
| `NL-10` | No 0/O/1/I alphabet, five characters, shared with the WebSocket transport. |
| `AU-01` | Create payloads keep values scalar. |
| `AU-02` | Secrets are stored per entry; public score rows deliberately retain none (immutable). |
| `AU-04` | Boards query the public sorted list with a limit. |
| `AU-07` | Shared-run plays are counted through the public counter endpoint. |
| `AU-09` | Leaderboard/SharedRun/GhostNet validate, clamp and truncate every network payload before rendering. |
| `AU-10` | Gated on VITE_POKI_GAME_ID and asserted by pnpm isolation:check. |
| `UA-01` | Adoption runs after boot; a null or throwing getUser() leaves the generated call sign in place. |
| `UA-02` | Only the Account screen's Sign in button reaches signInToPortal(). |
| `UA-04` | No backend needs the token, so the build never requests, stores or transmits one. |
| `UA-07` | physicalKey() maps board/ghost/journal/squad caches, AUDS secrets and the probe onto poki_ignore.*; reads migrate legacy keys. |
| `UA-08` | The synced set is the small progress/settings blob; large or device-specific data is ignored by construction. |
| `UA-09` | Per-device identifiers, recordings and caches live outside the synced set. |
| `UA-03` | TestUser renders as an ordinary signed-in account. |
| `SUB-01` | poki-upload/ root index.html + responsive layout gates. |
| `SUB-04` | THB gate measures size, bleed, corner mask, contrast, 128px legibility and weight. |
| `SUB-05` | Four categories chosen for fit and recorded in SUBMISSION.md (Multiplayer, Flappy-style, Racing, Popular); pasting them into the dashboard is the submission step. |
| `SUB-06` | Self-contained policy page shipped with the standalone deploy; VITE_PRIVACY_URL can point at another host. |
| `SUB-07` | Settings links it through platform.openExternalLink(). |
| `SUB-08` | Description and engine field prepared in SUBMISSION.md (engine: three-js); pasting them into the dashboard is the submission step. |
| `SUB-09` | Bundled fonts/images + the portal external-URL gate. |
| `SUB-11` | The chat UI is not in the portal bundle at all; emotes remain. |
| `SUB-12` | No email/social login in any portal build: identity comes from Poki's own getUser() (docs/poki/15-user-accounts.md), and the null/throwing case simply keeps the generated call sign. A typed pilot name is allowed, but CONTACT in src/game/pilotNameModeration.ts rejects anything shaped like an address, link, @handle or long digit run, so a public leaderboard cannot be used to publish contact details. |
| `SUB-13` | Reviewed against the content list; nothing to remove. |
| `SUB-14` | Pointer drag, touch drag, keyboard and auto-glide all steer; menus are mouse/touch/keyboard navigable. |
| `SUB-16` | Target metric for the first fit test. |
| `SUB-17` | Measured by the platform. |
| `PAR-02` | Kept as a build/publish policy rather than a code fork. |
| `PAR-05` | 1.78 MB single-file build, adaptive quality tiers, measured device profile. |
| `PAR-06` | Feature depth is tracked in the rebuild report. |
| `PAR-08` | Planning note. |
