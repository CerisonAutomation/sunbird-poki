# Deploying Sunbird

One codebase, four targets. All builds are single-file (`vite-singlefile`):
everything inlines into `index.html` except icons/manifest/sw.

## 1. Vercel (or Netlify/Pages — any static host)

```bash
npm i -g vercel
vercel deploy --prod
```

`vercel.json` is already configured: static build to `dist/`, SPA rewrite
(which excludes `/api` so the leaderboard functions aren't shadowed),
immutable icon caching, `no-cache` on `sw.js`, and security headers.

**Leaderboard on Vercel:** the `api/` directory ships two serverless functions
(`GET /api/board`, `POST /api/score`) implementing `LEADERBOARD_API.md`.
They persist to Upstash Redis when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set,
and fall back to an in-memory board otherwise (preview only, resets on cold
start). To enable it:

1. Create an Upstash Redis database and add its `KV_REST_API_URL` +
   `KV_REST_API_TOKEN` to the project environment.
2. Set `VITE_LEADERBOARD_URL=/api` (same origin) in the build env and redeploy.
3. Optionally set `VITE_LEADERBOARD_SALT` (build) and `LEADERBOARD_SALT`
   (functions) to require HMAC-signed score submissions.
4. Verify `GET https://<deployment>/api/health` returns `ok: true` and
   `storage: "upstash-redis"` before enabling global ranking.

**Multiplayer:** the Rust `sunbird-server` owns the WebSocket room protocol
(`GET /ws`, 15 Hz state, server-refereed finishes). The deployment script
targets a GCP free-tier VM; treat it as unverified until the current binary and
production WSS smoke check pass:

- Host: `sunbird-mp` — e2-micro, `us-central1-a`, Ubuntu 24.04, 30 GB
  standard disk, 4 GB swap (e2-micro has 1 GB RAM), external IP
  `34.123.76.46`, running as a hardened systemd unit (`User=nobody`,
  `MemoryMax=700M`, restart-on-failure). Always-free eligible.
- Endpoint: `ws://34.123.76.46:8080/ws` is a development probe only; the current binary and production WSS endpoint must be verified before release.
- Redeploy after server changes: `bash rust/deploy/gcloud/deploy.sh`
  (cross-compiles for linux/amd64 in Docker, ships, restarts the service).

**TLS note:** pages served over HTTPS (portals, Vercel) cannot open a plain
`ws://` connection (mixed content). Portals currently build with
`VITE_MULTIPLAYER_URL=` (solo field, honestly labelled) until a domain is
pointed at the VM. To enable `wss://`: add an `A` record for your domain →
`34.123.76.46`, then give Caddy (already installed on the VM) a one-line
Caddyfile — it mints the Let's Encrypt cert automatically:

```
mp.yourdomain.com {
    reverse_proxy /ws localhost:8080
}
```

and set `VITE_MULTIPLAYER_URL=wss://mp.yourdomain.com` in the build env.

For any other host, the manual equivalent is still:

```bash
cargo build --release -p sunbird-server
./target/release/sunbird-server   # serves GET /ws on :8080
```

**Docker Compose (multiplayer + social backend):** the repo root ships a
two-service self-hosted stack — the Rust authoritative server and the
TypeScript social backend (`server/`), each with its own multi-stage
Dockerfile:

```bash
cp .env.example .env   # then set the two secrets:
#   SUNBIRD_RECONNECT_HMAC_SECRET="$(openssl rand -hex 32)"
#   SUNBIRD_TOKEN_SECRET="$(openssl rand -hex 32)"
docker compose up -d --build
```

- `multiplayer` — `sunbird-server` on `:8080` (`/v1/ws`, `/ws` legacy,
  `/v1/reconnect-token`, `/healthz`, `/readyz`), Prometheus metrics on
  `:9090` when `SUNBIRD_METRICS_BIND_ADDR` is set.
- `social` — the TS social backend on `:8791` (`/mp/v1/…`, `/health`),
  JSON persistence in the `social-data` volume (`SUNBIRD_PERSIST=1`).

Point a browser build at the services with `VITE_MULTIPLAYER_URL` /
`VITE_SOCIAL_URL`, and list the page origin in `SUNBIRD_PUBLIC_ORIGINS`
(the Rust server refuses `*` outside development and requires `https`
origins in production — `SUNBIRD_ENV=production`).

## 2. Poki

```bash
npm run build:poki        # → sunbird-poki.zip
```

Upload the zip via Poki for Developers (Inspector). The build:
- loads the official Poki SDK v2 and fires `gameLoadingFinished`,
  `gameplayStart/Stop`, `commercialBreak`, `rewardedBreak`
- boots even if the SDK is blocked or slow (6 s cap, then NullAdapter)
- registers **no** service worker and ships **no** manifest link
- shows portal-safe monetization only (no external checkout)

## 3. CrazyGames

```bash
npm run build:crazy       # → sunbird-crazy.zip
```

Upload via the CrazyGames developer portal. Uses SDK v3 (`game.loadingStart/
Stop`, `gameplayStart/Stop`, `ad.requestAd`, optional `banner.requestBanner`
via `VITE_PORTAL_BANNER_ID`). Same graceful-degradation guarantees as Poki.

## 4. Self-hosted / itch.io style

```bash
npm run build             # → dist/ (index.html + icons + manifest + sw)
```

Serve `dist/` from any static server. PWA install + offline shell work
out of the box on HTTPS origins.

## Fonts

Fredoka / Atkinson Hyperlegible load from Google Fonts as a progressive
enhancement (`display=swap`, non-render-blocking). If the CDN is blocked
(some portals, offline), the UI falls back to Trebuchet MS / Segoe UI —
this is deliberate and tested; do not make the font link render-blocking.

## Env matrix

| Variable | Web | Poki | Crazy |
|---|---|---|---|
| `VITE_PORTAL_TARGET` | unset | `poki` | `crazy` |
| `VITE_MULTIPLAYER_URL` | `/mp` (dev) or verified `wss://…` | unset until portal-safe WSS is approved | unset until portal Full Launch multiplayer is approved |
| `VITE_PORTAL_BANNER_ID` | — | — | optional |

## 5. Stripe webhook entitlements (server-authoritative; the client loads no processor)

The backend ships a verified webhook route — `POST /stripe/webhook` — so paid
entitlements are owned by the server, not by a client-side "I paid" button
(closes REPO_TRUTH_AUDIT #12).

> **State of the client today:** no processor is wired into the game. `Payments.ts`
> returns `null` from `ensureStripeJs`, `stripeLinkFor` and `consumeStripeReturn`,
> `@stripe/stripe-js` is not a dependency, and the shipped CSP permits no
> processor origin — the economy is coins. What *is* wired is the restore half:
> `fetchServerEntitlements()` calls `GET /entitlements?device=…` on the configured
> leaderboard base, so a purchase completed through any channel you operate
> grants in-game. If you add a client-side checkout, declare its origin in
> `src/game/legal.edition.ts` in the same commit: that is what publishes it on the
> privacy page, in `docs/poki/CSP_REQUEST.md`, and (via the `legal-editions` test)
> keeps the deployed CSP honest.

Setup (once, ~5 minutes):

```bash
# 1. Give the worker the webhook signing secret (whsec_…):
cd backend && npx wrangler secret put STRIPE_WEBHOOK_SECRET

# 2. In the Stripe dashboard, add a webhook endpoint pointed at
#    https://<your-worker>.workers.dev/stripe/webhook
#    listening for: checkout.session.completed
```

How it works end to end:

1. The player reaches your Payment Link with `client_reference_id=<deviceId>`
   through whatever channel you operate (the game does not open it — see the
   note above).
2. Stripe calls the webhook; the worker verifies the `Stripe-Signature`
   header (HMAC-SHA256 over `t.rawBody`, 5-minute replay window — see
   `backend/src/entitlements.ts`, pinned by `entitlements.test.ts`).
3. `amount_total` maps to the SKU: 299→gold, 199→vip, 99→starter. The grant
   is stored per deviceId in the leaderboard DO.
4. The game syncs on "Restore purchases" (and at boot) via
   `GET /entitlements?device=…` and grants with source `stripe_webhook`.

Unset secret ⇒ the endpoint answers 503 and the client simply sees no
entitlements (`fetchServerEntitlements` returns `[]` on any non-OK response). If you change prices in
Stripe, update `AMOUNT_TO_SKU` in `backend/src/entitlements.ts`.
