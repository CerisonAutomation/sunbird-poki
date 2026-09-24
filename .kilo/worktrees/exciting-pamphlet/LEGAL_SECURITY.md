# Sunbird — Legal & Security Register

Honest, evidence-based register. Every "PASS" below names the code that was
checked; every "GAP" is a real open item, not aspiration. Companion documents:
[docs/audits/POKI_COMPLIANCE_AUDIT.md](docs/audits/POKI_COMPLIANCE_AUDIT.md) (platform rules) and
[PRODUCTION_READINESS_PLAN.md](PRODUCTION_READINESS_PLAN.md) (ops hardening).

## 1. Legal

### 1.1 Copyright & licensing — PASS

| Item | Evidence |
|---|---|
| Project license | `LICENSE` — MIT, Copyright (c) 2026 CerisonAutomation |
| Third-party **assets**: zero | `find src -name "*.png" -o -name "*.jpg" -o -name "*.webp" -o -name "*.mp3" -o -name "*.ogg" -o -name "*.woff*" -o -name "*.ttf"` → no results. All art is procedural canvas/SVG code (`src/game/Sunbird.ts` canonical bird, `src/game/Biomes.ts` scenery) and all audio is WebAudio synthesis. Nothing sampled, no font files, no images, no music files — there is no asset provenance to clear. |
| Dependencies | 27 declared deps; installed tree license census: **MIT 15, BSD-2-Clause 1, Apache-2.0 2** — all permissive, no copyleft (GPL/AGPL/MPL) anywhere in the build. |
| Runtime external code | Poki/CrazyGames SDK strings in `src/sdk/platform.ts` are *detection strings only* (checking for an already-injected global); the clean build ships no third-party scripts (verified in `docs/audits/POKI_COMPLIANCE_AUDIT.md`). |

### 1.2 Personal data & privacy

**Game build (what a player actually runs)** — PASS

- Persistence is `localStorage` only (`src/game/Storage.ts`): score, settings,
  challenge seeds, biome flags. No network identity, no cross-site storage,
  no cookies, no analytics, no ad pixels.
- No external account system, no chat, no PII capture — matching the Poki
  external-resources policy (see compliance audit).

**Optional multiplayer/social server (`server/`)** — PASS with one documented GAP

Data stored per participant (`server/src/identity`, `server/src/store/db.ts`):
`playerId` (server-random), `deviceId` (client-generated pseudonymous 64-char
id), `displayName` (self-chosen, default "Sunbird Pilot", length-capped),
optional 2-letter `countryCode` (self-reported, coarse), scores, ghost
flights, friend/squad relations. No email, no real name, no precise location,
no device fingerprinting beyond the client-generated id.

- **GAP L-1 — no public privacy policy / ToS document yet.** The server is
  inert in the shipped game builds (no endpoint is configured; see
  PRODUCTION_READINESS_PLAN). Before the social backend is switched on in
  production a public policy page must be published; Poki additionally
  requires a hosted privacy policy for any exception to its no-external-data
  rule. **Owner: CerisonAutomation. Status: blocked on product decision.**
- **GAP L-2 — no self-service profile erasure API.** `DELETE` exists for
  ghosts (`server/src/http/api.ts` `/mp/v1/ghosts/:id`) but a player cannot
  delete their own profile via the API; erasure would be performed
  out-of-band via the store. Under GDPR the right to erasure should be
  self-service. Low urgency (guest pseudonymous profiles, no contact data)
  but the honest state is: **not implemented**.
- Retention: the store is file-based and bounded; there is no scheduled
  purging. Documented here so it is a conscious choice, not an accident.

#### 1.2.1 EU data-protection register (GDPR/ePrivacy) — roles

| Role | Who | Scope |
|---|---|---|
| Controller (game build) | CerisonAutomation | Device-local storage only; no personal data leaves the device (§1.2 evidence). |
| Controller (optional social/leaderboard backend) | CerisonAutomation | Once `VITE_SOCIAL_URL` / `VITE_MULTIPLAYER_URL` / `VITE_LEADERBOARD_URL` are configured for a deploy. Until then the shipped builds make no such requests. |
| Controller (own analytics) | The portal (e.g. Poki) | Portal builds run in the host's frame; the host's own telemetry is under its policy, not ours. Our code sends nothing to it. |
| Controller (payments) | **None in the shipped client** | No processor is wired: `src/game/Payments.ts` returns `null`/`false` from every Stripe entry point and the economy is coins earned by playing. Card data does not exist in this build, and no processor origin is in the CSP. If a hosted checkout is added later (item L-3), that processor controls card data on its own page and the game keeps only a local receipt reference — and the origin must be declared in `src/game/legal.edition*.ts` first, which publishes it on the policy page and in the CSP request in the same commit. |
| Processor (hosting) | Deploy-time choice (Vercel / GCP) | Acts on backend data under the hosting agreement; DPA to be on file before social launch (item L-4). |

Pseudonymous online identifiers (the client-generated `deviceId`, the
server-random `playerId`) are personal data under GDPR (Recital 30). The
register below treats them accordingly even though they contain no name,
email, or location.

#### 1.2.2 Data inventory — purpose, basis, location, retention

| Data | Purpose | Lawful basis | Where it lives | Retention |
|---|---|---|---|---|
| Save (progress, settings, inventory) | Provide the game | Contract (service delivery) | Device `localStorage` only | Until the player resets it (Settings → Manage saved progress) or browser storage is cleared |
| `deviceId` (client-generated, 64-char random) | Pseudonymous identity for scores/rooms | Contract; storage access is strictly functional | Device; sent only to endpoints this deploy configures | Backend: bounded file store; purge scheduled via item S-1 |
| Pilot name (self-chosen or generated) | Display in boards/rooms | Contract | Device + backend (length-capped, server-cleaned) | As above |
| Scores, ghost flight samples, friend/squad relations | Leaderboards, async PvP, social features | Contract | Backend (only when configured) | Ghosts capped per player (`ghostMaxPerPlayer`); rows bounded; S-1 for full purge |
| Telemetry aggregates (event name + coarse mode/km) | Aggregate service-quality trends | Legitimate interest (service improvement); anonymous by design | Server memory only — never persisted, never per-player (`server/src/telemetry/TelemetryService.ts`) | Process lifetime |
| Crash journal | Diagnose client failures | Legitimate interest; stays on device, PII-redacted at capture | Device `localStorage` (5-entry cap); only event *names* + fingerprint hashes would reach the backend, and only when a sink is configured | Until evicted (quota self-healing may evict it first — it is classified regenerable) |
| Payment receipt references | Entitlement restore — only if a checkout is ever wired (L-3); none is today | Contract | Device `localStorage`; no card data anywhere in this build | Until reset |

#### 1.2.3 ePrivacy — storage and access to the player's device

| Access | Used for | Consent requirement |
|---|---|---|
| `localStorage` | Strictly functional: save, preferences, crash journal, entitlement references | None required — strictly necessary for the service the player requested |
| `sessionStorage` / in-memory | Sandbox fallback when `localStorage` is blocked | Same |
| Network telemetry beacon | Off unless a social endpoint is configured; always off in portal builds | Configured deploys should disclose it in the public policy (item L-1) |
| Cookies, pixels, third-party scripts | **None** (verified: no cookies set anywhere in `src/`) | n/a |

#### 1.2.4 Rights mapping (GDPR Part III) — current state

| Right | Mechanism | State |
|---|---|---|
| Access & portability (Art. 15/20) | Settings → Account → **save-code export** (`data-ref="cloudExport"` — a complete copy of the device save as text) | PASS (device data). Backend profile export: see L-5. |
| Erasure (Art. 17) | Settings → Manage saved progress → **reset** (device). Backend profile: operator-only via the store | GAP L-2 — self-service backend erasure not implemented; open, blocking for EU social launch |
| Rectification (Art. 16) | Pilot name editable in Settings | PASS (where custom names are enabled; portal editions render it read-only per platform policy) |
| Objection/profiling (Art. 21/22) | No profiling, no automated decisions with legal effect, no advertising inside the game build | PASS (n/a) |
| Children | All-ages content, no behavioral data, no contact capture; portals run their own age-gate policy | PASS for the game build |

#### 1.2.5 EU pre-launch checklist (paid SKUs + social backend)

These are product/deployment decisions, not code gaps, and are listed so they
cannot be mistaken for done:

1. **L-1** — publish the privacy policy + ToS at a stable URL; link from Settings. Blocking for social launch and for any portal exception request.
   - **Privacy: DONE.** `pnpm gen-legal` generates `public/privacy.html` from `src/game/legal*.ts`; `vercel.json` rewrites `/privacy` to it; the in-game Settings → Privacy Policy screen renders the same document, and portal builds open the hosted page through the platform's external-link API with an absolute `VITE_PRIVACY_URL`. Poki's CSP screen requires this URL before it stores any custom policy (`docs/poki/requirements.json` REQ-66/67/68).
   - **ToS: OPEN.** No terms of service page exists yet; required before social launch and before any paid SKU.
2. **L-2** — self-service erasure API for backend profiles (GDPR Art. 17).
3. **L-3** — paid SKUs are **not implemented**: the client economy is coins only. If a Stripe Payment Links checkout is added, first enable EU VAT/VAT-IOSS handling, set the correct seller entity, and add consumer-right-of-withdrawal wording (14-day withdrawal for digital content, with the waiver-on-consent mechanism) before selling to EU consumers. The processor is the payment agent — the seller of record is the entity that owns the account — and its origin must be added to the legal edition's host table (which is what puts it on the public policy and in the CSP) in the same commit as the code that loads it.
4. **L-4** — hosting DPA + transfer mechanism (SCCs if processed outside the EEA) on file for the chosen backend host.
5. **L-5** — backend profile export endpoint (GDPR Art. 15/20 for server-side data), pairing with L-2.

> This section is a technical compliance register that maps code and data flows
> to EU legal concepts. It is not legal advice; counsel review is required
> before commercial launch in the EU.

### 1.3 All-ages (COPPA-class) posture — PASS for the game build

No data collection of any kind happens inside the game build, no ads, no
IAP, no external links except through the platform's `openExternalLink`
(never used by the game itself). The all-ages bar set in the Poki audit
applies to content, which passed there.

## 2. Security

### 2.1 Client-side XSS surface — PASS (defence in depth, verified)

All user-controllable strings (rival/remote player names, room codes, emotes,
leaderboard entries, challenge names) that reach the DOM do so through:

1. **`escapeHtml()`** (`src/game/HUD.ts:1320`) — escapes all five specials
   `& < > " '`; applied at every `innerHTML` interpolation of external data
   (roster bar, standings, versus bar, board rows, tags). Verified by grep:
   the only unescaped `.name` interpolations feed `hud.toast()`, which
   renders via `el.textContent` (`src/game/HUD.ts:1051`), never HTML.
2. **Server-side input cleaning** — `cleanText()` (`server/src/util/http.ts:81`)
   strips control characters and `< > & "`, caps length, trims; edge API
   `sanitize()` (`api/_lib/http.ts:32`) does the same. So even a future
   client regression would need to survive the server strip first.
3. **No dangerous APIs** — grep of `src`, `server/src`, `api` for
   `eval(`, `new Function`, `document.write`, `setTimeout('...')` string
   forms: no hits.

### 2.2 Network & transport

| Control | Evidence |
|---|---|
| Game build makes **no cross-origin requests** | Runtime `fetch` calls (`src/game/Leaderboard.ts`, `src/game/GhostNet.ts`) target a same-origin base (`VITE_LEADERBOARD_URL`, defaulting to a relative path); the clean portal builds ship with social disabled (`docs/audits/POKI_COMPLIANCE_AUDIT.md`). No `XMLHttpRequest`, no WebSockets, no iframes, no third-party beacons in the game build. |
| WS auth | Seat-token issuance + verification, one-socket-one-seat, ownership checks (PRODUCTION_READINESS_PLAN "verified already done" column). |
| Origin allowlists | WS + HTTP origin checks (same register). |
| Body caps & timeouts | 3s request timeout, size caps (same register). |
| Rate limiting | Board reads 120/60s per-IP (`api/board.ts`), edge writes 30/60s, WS bucket 80/40s, social per-IP limiter — all in the production register with file pointers. |
| Secrets | Grep of source for key/secret/token literals with realistic entropy: **no hits**. All credentials are env-injected at deploy time. |

### 2.3 Supply chain

- `pnpm audit` → **No known vulnerabilities found** (re-run: `pnpm audit`).
- No lockfile drift: CI installs from `pnpm-lock.yaml`.
- Rust server crate is CI-gated (`.github/workflows/rust.yml`); no binaries
  are committed.

### 2.4 Deployment notes (for whoever runs it)

- Serve over HTTPS only; the social server's token scheme assumes TLS.
- The board read limiter keys on `x-forwarded-for` — behind a proxy that
  overwrites it honestly.
- Store file lives outside the web root (it does: `server/` is never served
  statically), so the JSON state file is not directly downloadable.

## 3. Verification commands

```bash
pnpm audit                                   # dependency vulnerabilities
pnpm verify                                  # typecheck (client+server) + unit tests + build
grep -rn "innerHTML" src --include="*.ts"    # eyeball: every one escapes external data
```

## 4. Open-items register

| ID | Item | Severity | Owner | Status |
|---|---|---|---|---|
| L-1 | Public privacy policy + ToS page | Blocking for social launch | CerisonAutomation | Privacy DONE (`/privacy`, generated, linked in-game); ToS OPEN |
| L-2 | Self-service profile erasure API | Medium | eng | OPEN |
| S-1 | Scheduled data retention purge | Low | eng | OPEN |
| S-2 | Security headers (CSP, X-Content-Type-Options, frame-ancestors) on the *host* that serves the built game | Medium (platforms like Poki set their own; a self-hosted deploy must) | ops | DONE on the Vercel deploy (`vercel.json`: CSP with `frame-ancestors 'none'`/`object-src 'none'`/`upgrade-insecure-requests`, X-Content-Type-Options, X-Frame-Options, HSTS, COOP, Referrer-Policy, Permissions-Policy); still OPEN for any other self-hosted deploy |
| L-3 | Paid-SKU path (no processor wired today): EU consumer config (VAT/IOSS, withdrawal wording, seller entity) + declare the processor origin in the legal edition | Blocking for EU paid SKU launch | ops | OPEN (not started — client is coin-only) |
| L-4 | Hosting DPA + international-transfer mechanism for the backend host | Blocking for social launch | ops | OPEN |
| L-5 | Backend profile export endpoint (Art. 15/20) | Medium | eng | OPEN |
