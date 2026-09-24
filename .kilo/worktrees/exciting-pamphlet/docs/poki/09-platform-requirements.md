# Platform requirements, policies and release workflow

Sources: Poki's **Requirements & policies**, **HTML5 SDK / game events**, **external
resources policy**, **content & player safety**, **user accounts** and **release
workflow** documentation, as extracted during the compliance passes recorded in
[`../audits/POKI_COMPLIANCE_AUDIT.md`](../audits/POKI_COMPLIANCE_AUDIT.md).

> **Provenance note.** This file is the *normative checklist* the build is gated
> against. It compiles the platform pages that are not part of the guide's
> best-practice pages (covered in `00`–`08`), plus the hard numbers the Inspector
> enforces. Where a rule is enforced by tooling, the audit script
> (`pnpm poki:audit`) checks it mechanically.

## Launch requirements

| ID | Kind | Rule |
|---|---|---|
| `REQ-01` | requirement | The game must **scale to the platform's required viewport sizes**: **640×360**, **836×470**, **1031×580** (plus real devices). The canvas covers the viewport, nothing is cropped, nothing scrolls. |
| `REQ-02` | requirement | The game must run **inside a cross-origin iframe** on a longer host page: no top-level navigation, no `window.open`, no host-page scroll capture, no dialogs, no console errors. |
| `REQ-03` | requirement | **Incognito / blocked-storage support:** the game must be fully playable when `localStorage` is unavailable. |
| `REQ-04` | requirement | **Initial download guidance:** keep the initial download under ~5 MB and the total under ~8 MB; the Inspector flags excessive asset weight. |
| `REQ-05` | requirement | **No service worker and no PWA manifest** inside portal builds (the game is not installable there, and scanners flag the APIs). |
| `REQ-06` | requirement | **Fixed, non-scrolling page body** with the canvas filling the viewport; portrait and landscape both supported. |

## SDK lifecycle & game events

| ID | Kind | Rule |
|---|---|---|
| `REQ-10` | requirement | Lifecycle order is `init()` → `gameLoadingStart()` → `gameLoadingFinished()`. Each phase marker is sent **once**; consecutive duplicates are a defect. |
| `REQ-11` | requirement | `gameplayStart()` fires when the player actually starts playing (first input), `gameplayStop()` when play stops (death, pause, menus, ad). Never two `gameplayStop()` calls in a row, never `gameplayStart()` during loading. |
| `REQ-12` | requirement | Pause → resume is `gameplayStop()` → `commercialBreak()` → `gameplayStart()`. |
| `REQ-13` | requirement | **Game events** use `measure(category, label, action)`. For a run: `start` once per attempt, then exactly one of `complete` (goal reached) or `fail` (died/quit) — **never both, never a second outcome for the same attempt**. |
| `REQ-14` | requirement | Rewarded placements emit `visible` when the offer appears and `interact` when the player chooses it. |
| `REQ-15` | requirement | Audio must be muted for the duration of an ad break (the SDK's `onStart` callback is the cue) and input disabled while the ad plays. |
| `REQ-16` | requirement | The game must **work when the SDK is unavailable** (sandbox, offline preview, rejected `init()`): boot anyway, keep playing, never block on the portal. |

## Monetization policy

| ID | Kind | Rule |
|---|---|---|
| `REQ-20` | requirement | **No in-app purchases** on the platform and no UI that implies them (no checkout links, no "remove ads" purchase, no real-money currency). |
| `REQ-21` | requirement | **No secondary/dual currencies** in the shop economy — one spendable currency only; statuses are allowed, spendable parallel currencies are not. |
| `REQ-22` | requirement | **No third-party ad systems.** All ad surface is the platform SDK. |
| `REQ-23` | requirement | **No ad-timer or cooldown manipulation**; the platform decides ad availability. |
| `REQ-24` | requirement | **External links** must go through the SDK's external-link API — and a portal build should have none at all. |

## Content, community & player safety

| ID | Kind | Rule |
|---|---|---|
| `REQ-30` | requirement | **All-ages content**: no violence, sexual content, gambling, substances, fear or bullying mechanics. |
| `REQ-31` | requirement | **No chat** in multiplayer product surfaces. Emotes/quick-messages are the recommended alternative. |
| `REQ-32` | requirement | **No PII collection**; any platform identity is display-only and must not be persisted beyond the session's needs. |
| `REQ-33` | requirement | **Originality — inspired, not imitated:** art, UI, mechanics, characters, audio and name must be the developer's own; a reskin/clone of an existing game is rejected. |
| `REQ-34` | requirement | **AI-assisted production rules:** no AI watermarks and no prompt text in assets or UI; the creation process must be documentable on request. |
| `REQ-35` | recommendation | **External resources policy:** prefer zero external requests from the game; bundle fonts/assets, avoid CDNs, avoid third-party account systems. |

## Accounts & platform identity

| ID | Kind | Rule |
|---|---|---|
| `REQ-40` | requirement | Identity is **passive**: read the signed-in user for display when the platform provides one; never force a login at boot (a first login can reload the page). |
| `REQ-41` | recommendation | Any platform token is short-lived (the reference implementation's token expires in one minute) and must be verified server-side immediately — never stored. |
| `REQ-42` | requirement | A player who is not signed in must still play the full game. |

## Business / release

| ID | Kind | Rule |
|---|---|---|
| `REQ-50` | informational | Revenue split: 100 % on search/owned traffic, 50/50 on platform-driven traffic. |
| `REQ-51` | requirement | **Web exclusivity** applies to the submitted build: the Poki artifact must not double as a build published to Steam, app stores or consoles. Separate artifacts for other portals are what makes the pledge honest. |
| `REQ-52` | informational | Release flow: upload the unzipped **folder** (with `index.html` at root) to Poki for Developers → Inspector QA pass → player-fit test → web-fit test → final review. |
| `REQ-53` | informational | Web-fit metrics to watch: **C2P** (click-to-play), **CTR** (thumbnail), **time on page**. |

## The mobile Poki pill

| ID | Kind | Rule |
|---|---|---|
| `REQ-60` | requirement | On mobile the platform renders its own pill/overlay in the game frame; the game's HUD must not sit under it and must not attempt to draw over it. The SDK's `movePill()` is the supported way to relocate it. |

## How Sunbird applies this page

Every rule above maps to either (a) a build-time gate (`verify-portal`,
`audit-zips`, `verify-thumbnail`, `poki:audit`), (b) an automated test
(`src/game/__tests__/gameplay-events.test.ts`, `e2e/scaling.spec.ts`,
`e2e/persistence.spec.ts`, `e2e/menu-layout.spec.ts`, …) or (c) a documented
submission action. The authoritative status table for the whole list is
generated into [`COMPLIANCE.md`](./COMPLIANCE.md) by `pnpm poki:audit`; the
narrative version with the fixes that came out of these rules is
[`../audits/POKI_COMPLIANCE_AUDIT.md`](../audits/POKI_COMPLIANCE_AUDIT.md).
