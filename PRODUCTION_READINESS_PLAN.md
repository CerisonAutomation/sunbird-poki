# Production Readiness Plan — Multi-App Audit & Monitoring

## Sunbird Service Gap Register (verified against code, 2026-09-16)

Every production-MVP blocker was re-verified against the actual code on this date. ✅ = implemented **with tests** in-repo; 🟡 = handled at deploy level (docs/proxy); ⬜ = deferred by decision.

| Area | Status | Where |
|---|---|---|
| WS seat-token enforcement on reconnect (signature + room/seat binding + generation + expiry; one socket one seat; HTTP issuer ownership-checked) | ✅ | `rust/crates/sunbird-server/src/auth.rs`, `ws.rs` (`ClientMessage::Reconnect`), `main.rs` (`/v1/reconnect-token`) — 5 tests |
| Per-socket WS rate limit (80 burst / 40 s token bucket; one strike closes the socket) | ✅ | `rust/.../ws.rs` (`MSG_BUCKET_*`) |
| Legacy protocol per-seat state rate limit (MAX_STATE_HZ clamp) | ✅ | `rust/.../legacy.rs` — `state_rate_limited_per_seat` test |
| Social REST per-IP rate limits (read/write/guest buckets, 429 + retry-after) | ✅ | `server/src/http/router.ts` |
| Edge leaderboard write limit (30/60 s per key) | ✅ | `api/score.ts` |
| Edge leaderboard **read** limit (120/60 s per IP — board reads are full KV scans) | ✅ | `api/board.ts` |
| WS/HTTP origin enforcement (explicit allowlist in prod; `*` in dev) | ✅ | `rust/.../ws.rs origin_allowed`, `main.rs cors_layer` |
| Request-body caps + 3 s request timeout + payload size validation | ✅ | `main.rs` layers, `sunbird-protocol` parse caps |
| **Storage health gate** — corrupt state file refuses boot (no silent empty DB); failing disk degrades loudly (no timer crash, honest `/health`, 503 `storageDegraded`, recovery re-green) | ✅ | `server/src/store/db.ts` (`storageStatus()`, contained `flush()`), `http/api.ts` + `http/legacy.ts` health routes — 7 tests in `server/tests/db.test.ts` |
| Social backend inside the gates (typecheck + tests + CI) | ✅ | `pnpm typecheck:server` / `pnpm test:server` (`vitest.server.config.ts`), wired into `pnpm verify` and `.github/workflows/ci.yml` |
| Edge leaderboard fail-closed in production (503 without KV + signing; /api/health reflects readiness) | ✅ | `api/health.ts`, `api/board.ts`, `api/score.ts` |
| TLS termination | 🟡 | Terminate at the proxy (see `DEPLOY.md`); both Dockerfiles ship HTTP-only binaries behind it. No app-side `http://` assumptions. |
| Containerization | ✅ | Root `Dockerfile` (rust server), `server/Dockerfile` (social), `rust/deploy/gcloud/` |
| Graceful shutdown + health/ready probes (SIGTERM/SIGINT, 503 during drain) | ✅ | `rust/.../main.rs` (`shutdown_signal`, middleware), `server/src/index.ts` |
| Metrics | ✅ | Prometheus endpoint on a private port (`rust/.../metrics.rs`), `/metrics` plain on the social server |
| Portal zips separate + deep-audited | ✅ | `scripts/audit-zips.mjs`, `scripts/verify-portal.mjs` — part of the build pipeline |
| Poki launch (SDK event sequences, ad hierarchy, incognito, size, exclusivity) | ✅ | `docs/audits/POKI_COMPLIANCE_AUDIT.md` — full doc-by-doc matrix |

⬜ Deferred by decision: AUDS global data (needs the live Poki game id), portal multiplayer (external-server approval process), Netlib. See `docs/audits/POKI_COMPLIANCE_AUDIT.md` §8.

## Apps Under Management

| App | Repo | Stack | Status |
|-----|------|-------|--------|
| **Sunbird** | CerisonAutomation/sunbird | React + Three.js + Vite | ✅ Deployed |
| **FYK Consolidated** | CerisonAutomation/fyk-consolidated | React + Vite + Prisma + Supabase | 🔄 Audit pending |
| **Arena AI Agents** | arena.ai/agent/* | Arena platform | 🔄 Monitor |

## Automated Monitoring Schedule

### Every 15 Minutes (Cron)
- Build verification (typecheck + test + build)
- Production URL health check
- Security header validation
- Performance metrics

### Every Hour
- Full codebase audit (security, performance, bugs)
- Dependency vulnerability scan
- Test coverage analysis

### Daily
- Complete production readiness report
- Arena AI agent status check
- Deployment verification

## Production Standards

### Code Quality
- [ ] 0 TypeScript errors
- [ ] 100% test pass rate
- [ ] Build time < 30s
- [ ] Bundle size < 2MB

### Security
- [ ] CSP headers (no unsafe-inline)
- [ ] HTTPS enforced
- [ ] No exposed secrets
- [ ] Input validation on all endpoints

### Performance
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.5s
- [ ] No memory leaks

### Reliability
- [ ] Error boundaries on all pages
- [ ] Graceful degradation
- [ ] Offline support (PWA)
- [ ] Auto-recovery from failures

## Monitoring Actions

1. **Health Check**: Verify production URLs return 200
2. **Build Check**: Run typecheck + test + build
3. **Security Check**: Validate CSP, headers, no secrets
4. **Performance Check**: Lighthouse scores, Core Web Vitals
5. **Dependency Check**: npm audit, outdated packages
6. **Arena Check**: Agent status, response quality

## Escalation

- **Critical**: immediate notification
- **High**: within 1 hour
- **Medium**: within 4 hours
- **Low**: next daily report
