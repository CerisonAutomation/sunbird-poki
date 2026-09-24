# Submission readiness — dashboard, policies, testing funnel

Sources: `developers.poki.com/guide/adding-your-game`, `/guide/external-resources-policy`,
`/guide/content-player-safety`, `/guide/player-fit-test`, `/guide/web-fit-test`,
`/guide/how-testing-works`, `/guide/final-review`, `/guide/game-thumbnail`

## What you upload

| ID | Kind | Rule |
|---|---|---|
| `SUB-01` | requirement | Upload a **web build**: a folder with `index.html` at its root, working on desktop, mobile and tablet, starting fast with minimal onboarding. |
| `SUB-02` | requirement | Every version passes **content moderation** before it can enter testing. |
| `SUB-03` | requirement | Run the build through the **Inspector** before requesting a test; it checks SDK usage, mobile behaviour and the biggest technical requirements automatically. |

## Dashboard fields (Poki for Developers → game settings)

| ID | Kind | Rule |
|---|---|---|
| `SUB-04` | requirement | **Thumbnail**: full-bleed square, **≥ 628×628**, one clear foreground subject (the main character in its default skin), minimal or no text, high contrast, not close to the Playground background `#83FFE7`, no borders/padding/rounded corners (the platform masks them). |
| `SUB-05` | recommendation | **Suggested categories**: up to four, chosen for genuine fit. |
| `SUB-06` | requirement | **Privacy policy URL**: a live page, reachable by all players. It is mandatory before an external service (multiplayer servers, analytics, leaderboards) can be approved, and the policy must describe how that service handles player data. |
| `SUB-07` | requirement | The privacy policy must also be **linked from inside the game**. |
| `SUB-08` | recommendation | **Suggested description** and engine field: state what the game is and what it is built with; “three-js” is the correct engine entry for this build. |
| `SUB-09` | requirement | External resources are requested explicitly in **Settings → CSP** with exact links and a short explanation; approval is per-resource, and the game must ship bundled assets rather than runtime CDN fetches (fonts, images, audio, code libraries). |
| `SUB-10` | informational | Exceptions exist for multiplayer servers, analytics providers (case-by-case; Google products are never approved) and externally hosted leaderboards — all of them need the CSP request and the privacy policy. |

## Interaction & content rules that gate testing

| ID | Kind | Rule |
|---|---|---|
| `SUB-11` | requirement | **No in-game chat systems.** Emoji/quick-message systems are the sanctioned alternative. |
| `SUB-12` | requirement | No external account systems and no collection of personal information (no email logins, no social sign-in). |
| `SUB-13` | requirement | Content stays family-friendly: no bullying, stereotypes, graphic violence, sustained scary themes, sexual content, gambling/alcohol/tobacco imagery; misused IP and adult themes are immediate rejections. |
| `SUB-14` | requirement | Controls should offer alternatives where possible (mouse-only, drag steering, auto-acceleration, remappable keys) so players who cannot use WASD are not excluded. |

## The testing funnel

| ID | Kind | Rule |
|---|---|---|
| `SUB-15` | informational | Journey: playtest → player fit test → web fit test → final review → release. |
| `SUB-16` | informational | **Player fit test**: 500 players, unlocks after 10 playtest recordings are watched and requires an uploaded thumbnail. Healthy result = **3 min+ average playtime and ≥ 25 % of plays over 3 min**. |
| `SUB-17` | informational | **Web fit test**: 3–5 days, weighted equally on **CTR**, **average time on page** and **C2P** (share of visitors reaching the first `gameplayStart()`). Monetization is optional during it. |
| `SUB-18` | informational | **Final review** takes 1–2 weeks and weighs the test results plus the game's content; passing leads to legal, QA, Soft Release and Global Release over roughly 2–3 months. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `SUB-01`, `SUB-03` | `pnpm upload:poki` builds, packages `poki-upload/` (root `index.html`, relative assets, no manifest/service worker) and runs the Inspector-shaped gate `pnpm verify:upload`. |
| `SUB-04` | `assets/submission/sunbird-thumbnail-1024.png` / `-628.png` are rendered from the untouched master in `assets/submission/art/` by `scripts/render-thumbnail.mjs`, graded to clear `#83FFE7`, and gated by `pnpm verify:thumbnail` (size, full-bleed, corner mask, contrast, 128 px legibility, weight). The **same graded master** is what ships in the build under `public/poki/thumbnail-*.png`, so the tile and the in-build copy cannot drift (`thumbnail-parity` test). |
| `SUB-05`, `SUB-08` | Values ready to paste into the dashboard are in [`SUBMISSION.md`](./SUBMISSION.md). |
| `SUB-06`, `SUB-07` | `public/privacy.html` is a self-contained, CSP-safe policy page served by the standalone deploy; Settings links it through `platform.openExternalLink()` (`data-action="open-privacy"`), which on Poki opens Poki's own external-link modal instead of navigating the frame. |
| `SUB-09`, `SUB-10` | The portal build makes **no runtime external requests**: fonts are bundled woff2, images are inlined or local, no analytics SDK is present. The only external endpoints are Poki's own approved integrations (SDK CDN, AUDS, Netlib signalling) — `pnpm verify:portals` + `pnpm isolation:check` prove nothing else is reachable. |
| `SUB-11`, `SUB-12` | Portal editions compile with `SQUAD_CHAT = false` and no purchase path (`SELL_AD_REMOVAL = false`): no chat UI, no personal data, no IAP in the bundle at all. A pilot **may** type their own call sign on Poki (`CUSTOM_PILOT_NAMES = true`), because the policy forbids chat systems and personal-data collection rather than display names — every write is moderated (`src/game/pilotNameModeration.ts`, `REQ-61`). `crazy`/`generic` keep the generated name read-only. |
| `SUB-13` | The game is birds, islands and weather — no combat, no gore, no scary content, no gambling imagery; currencies are earned only by flying. |
| `SUB-14` | Steering works with pointer drag, touch drag, keyboard (arrows/WASD) and auto-glide; menus are traversable by mouse, touch and keyboard, and difficulty eases new players in. |
| `SUB-16`, `SUB-17` | C2P funnel work already landed: portal editions skip the name-entry screen (one screen and one tap saved before the first `gameplayStart()`), the loading bar is real, and crash-tolerant boot keeps the game playable even when a portal script is blocked. |
