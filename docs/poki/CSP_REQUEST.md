# Poki Content-Security-Policy request

**Generated:** 2026-09-23 by `pnpm gen-csp` — do not edit by hand.
**Source of truth:** `src/game/legal.edition.poki.ts` (host table) and `src/game/legal.ts` (policy URL).
**Build:** Sunbird 1.1.0 · privacy policy version 2026-09-23

Poki's external-resources policy requires the exact links a build needs, a short
explanation of each, and an up-to-date privacy policy hosted on a public page and
linked from inside the game. This document is that submission.

## 1. Privacy policy URL (required before any custom CSP is stored)

```
https://sunbird-snowy.vercel.app/privacy
```

The page is generated from the same data module the in-game Settings → Privacy
Policy screen renders, and that screen links to this URL — so the policy is both
"hosted on a live webpage accessible to all players" and "linked inside the game".
It is self-contained: no stylesheet, script, font or analytics request of any kind.

## 2. External hosts this build needs

| Host | Directive | Why the game contacts it |
|---|---|---|
| `game-cdn.poki.com` | `script-src` | Poki SDK script (ads, lifecycle, leaderboard handshake) |
| `netlib.poki.io` | `connect-src` | Poki Netlib WebRTC signalling — multiplayer lobby create/join |
| `turn.rtc.poki.com` | `webrtc` | TURN relay when a direct peer connection fails |
| `stun.l.google.com` | `webrtc` | STUN candidate gathering for WebRTC |
| `auds.poki.io` | `connect-src` | Poki Arbitrary User Data Store — leaderboard entries, shared daily runs |

Nothing else is contacted. The build carries no analytics endpoint, no developer
backend, no font CDN and no remote asset: every asset is inlined into the
single-file bundle by `scripts/package-portal.mjs`. `pnpm verify:portals` fails
the build if a foreign portal's markers appear in it, and its `verify:csp` step
reads the built bundle and fails if the game reaches for a host this document does
not list — or lists a host the bundle never uses.

## 3. Values to paste, per directive

**script-src**

```
https://game-cdn.poki.com
```

- `game-cdn.poki.com` — Poki SDK script (ads, lifecycle, leaderboard handshake)

**connect-src**

```
https://netlib.poki.io https://auds.poki.io
```

- `netlib.poki.io` — Poki Netlib WebRTC signalling — multiplayer lobby create/join
- `auds.poki.io` — Poki Arbitrary User Data Store — leaderboard entries, shared daily runs

**webrtc**

```
https://turn.rtc.poki.com https://stun.l.google.com
```

- `turn.rtc.poki.com` — TURN relay when a direct peer connection fails
- `stun.l.google.com` — STUN candidate gathering for WebRTC

## 4. ICE / relay servers (multiplayer)

WebRTC has no CSP directive of its own; the ICE servers below must be allowed by the portal's
network policy (or by an `webrtc:` allow-list if the form provides one). They are only contacted
when a direct peer-to-peer connection between two players fails, and never by a solo flight.

- `turn.rtc.poki.com` — TURN relay when a direct peer connection fails
- `stun.l.google.com` — STUN candidate gathering for WebRTC

## 5. Usage explanation (short form for the request box)

> Sunbird is a single-file HTML5 flight game. It needs `game-cdn.poki.com` to load
> the Poki SDK (advertising, lifecycle events, leaderboard handshake). Multiplayer
> is peer-to-peer through Poki Netlib, which requires `netlib.poki.io` for lobby
> signalling and, only when a direct connection fails, a STUN/TURN relay
> (`stun.l.google.com`, `turn.rtc.poki.com`). `auds.poki.io` is Poki's own
> Arbitrary User Data Store, used for leaderboard entries and for sharing a daily
> run as a ghost; it is keyed by the identifier Poki assigns the game, never by
> anything the player types. The game contacts no other host, collects no personal
> data, has no account system, no chat and no in-app purchases.

## 6. After approval

Re-upload the build once the CSP has been reviewed — the portal caches the
previous bundle, so a stored policy does not take effect on the old upload.

Verification commands for this submission:

```
pnpm gen-csp           # regenerate this document from the shipped host table
pnpm verify:csp        # the built dist-poki bundle against this host list
pnpm poki:preflight    # builds every portal target and gates isolation, zips, upload folder
pnpm poki:audit        # 131-rule Poki compliance audit (docs/poki/COMPLIANCE.md)
```
