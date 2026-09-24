# Production Deployment Checklist

Before deploying to production (Vercel or other CDN), verify the following:

## Pre-Deployment Validation

### 1. Build & Bundle Integrity
- [ ] `pnpm run verify` passes (TypeScript, ESLint, unit tests, build)
- [ ] No new console errors or warnings in production build output
- [ ] Chunk sizes reasonable (three.js vendor chunk is expected >500KB)
- [ ] All dynamic imports resolve correctly
- [ ] Asset manifest is complete and up-to-date

### 2. Vercel Configuration
- [ ] `vercel.json` contains explicit MIME type headers for `.css` and `.js` files
- [ ] CSP header includes all necessary CDN origins (e.g., `https://frontend-cdn.perplexity.ai` for fonts)
- [ ] Cache-Control headers properly distinguish between immutable (assets) and mutable (HTML) content
- [ ] Rewrite rules do not conflict with asset paths

### 3. Asset Loading
- [ ] CSS files served with `Content-Type: text/css; charset=utf-8`
- [ ] JS chunks served with `Content-Type: application/javascript; charset=utf-8`
- [ ] Font files have `Access-Control-Allow-Origin: *` for cross-origin loading
- [ ] Font preloads only include fonts actually used in the app
- [ ] Unused font declarations removed to reduce preload waste

### 4. Multiplayer & Services
- [ ] Multiplayer WebSocket endpoint configured and reachable
- [ ] Social server health check passes (`/social` endpoint responds)
- [ ] Squad proxy health check passes (`/mp` endpoint responds)
- [ ] Connection retry logic tested with simulated network failures
- [ ] Heartbeat mechanism prevents idle connection timeouts

### 5. Browser & E2E Testing
- [ ] `pnpm test:e2e` runs without errors
- [ ] `pnpm test:e2e:multiplayer` runs without errors
- [ ] Manual testing in:
  - [ ] Chrome/Chromium (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest on macOS & iOS)
  - [ ] Mobile browsers (iOS Safari, Chrome Android)
- [ ] Desktop sun/mute button overlap verified as resolved
- [ ] Shop, inventory search, and bird previews functional
- [ ] 1v1 same-screen gameplay working
- [ ] Squad re-enrollment flow tested with explicit consent
- [ ] Chat history scroll persistence verified
- [ ] Friend-code copy functionality working

### 6. Security & Compliance
- [ ] CSP directives do not use `'unsafe-eval'` or overly permissive `'unsafe-inline'`
- [ ] No hardcoded API keys or secrets in bundled code
- [ ] HTTPS enforced (HSTS header present)
- [ ] Cross-origin policies prevent frame embedding (`X-Frame-Options: DENY`)
- [ ] Referrer policy restricts referrer leakage
- [ ] Permissions policy disables unused capabilities (camera, microphone, geolocation)

### 7. Performance & Optimization
- [ ] First Contentful Paint (FCP) < 3s on 4G
- [ ] Largest Contentful Paint (LCP) < 4.5s on 4G
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] No render-blocking resources in critical path
- [ ] Service worker properly caches immutable assets
- [ ] PWA manifest (`manifest.webmanifest`) valid and linked

### 8. Error Handling & Recovery
- [ ] CSS load failures trigger graceful fallback (do not freeze game)
- [ ] Missing JavaScript chunks trigger retry logic with exponential backoff
- [ ] Multiplayer connection failures do not prevent single-player gameplay
- [ ] Network errors display user-friendly messages with retry button
- [ ] Boot error page includes actionable recovery instructions

### 9. Monitoring & Observability
- [ ] Error logging configured (e.g., Sentry, LogRocket)
- [ ] Performance monitoring active (e.g., Web Vitals, Datadog)
- [ ] Deployment notifications sent to appropriate channels
- [ ] Rollback plan documented and tested

### 10. Frontend & Backend Coordination
- [ ] Frontend and authenticated social backend deployed together
- [ ] Legacy unauthenticated identities cannot be claimed with only device ID
- [ ] Squad re-enrollment creates separate social profile (no old membership recovery)
- [ ] Social chat POST response shape backward-compatible
- [ ] Mid-race reconnection failure behavior documented (fail visibly, not pretend-resume)

## Deployment Steps

### Vercel Deployment
```sh
# 1. Test build locally
pnpm run verify

# 2. Clear Vercel cache to force fresh build
# (In Vercel dashboard: Settings > Deployments > Purge Cache)

# 3. Push to main branch (or merge PR)
git push origin main

# 4. Monitor deployment in Vercel dashboard
# - Watch build logs for any ECONNRESET or missing asset warnings
# - Verify preview URL loads without CSS/JS/font errors

# 5. Run post-deployment validation
curl -I https://sunbird-snowy.vercel.app/assets/*.css
# Should return: Content-Type: text/css; charset=utf-8

curl -I https://sunbird-snowy.vercel.app/assets/*.js
# Should return: Content-Type: application/javascript; charset=utf-8

# 6. Test multiplayer connectivity
# - Open DevTools → Network tab
# - Filter for WebSocket connections
# - Verify connection established on /mp

# 7. Run browser test suite
pnpm test:e2e
pnpm test:e2e:multiplayer
```

### Rollback Plan
If deployment fails or critical issues appear:

1. In Vercel dashboard, go to **Deployments**
2. Find the last known-good deployment
3. Click **Redeploy** to restore previous version
4. Investigate root cause in git history and logs
5. Fix and re-deploy

## Post-Deployment Validation

### Immediate (5 min)
- [ ] Website loads without 404 or MIME type errors
- [ ] Single-player game boots and is playable
- [ ] Multiplayer connection established (check DevTools Network tab)

### Short-term (1 hour)
- [ ] Monitor error logs for spike in boot failures
- [ ] Run E2E suite against production URL
- [ ] Manual smoke tests on mobile devices

### Long-term (24 hours)
- [ ] Review analytics for increased bounce rates or errors
- [ ] Validate performance metrics meet targets
- [ ] Collect user feedback for any UX regressions

## Known Issues & Workarounds

### Chromium Download Failure in CI
**Issue**: `ECONNRESET` when installing Playwright Chromium in sandbox environments.

**Workaround**:
```sh
# On a local machine or in a reliable CI environment
corepack pnpm exec playwright install --with-deps chromium

# Commit the Playwright cache or browsers binary if applicable
# Then run E2E suite
pnpm test:e2e
pnpm test:e2e:multiplayer
```

### CSS MIME Type on Vercel
**Issue**: Stylesheets served as `text/plain` causing "Refused to apply style" errors.

**Fix**: Ensure `vercel.json` includes explicit headers:
```json
{
  "source": "/assets/(.*)\\.css$",
  "headers": [{
    "key": "Content-Type",
    "value": "text/css; charset=utf-8"
  }]
}
```

### Unused Font Preloads
**Issue**: Browser warns about preloaded fonts not used within 3s of page load.

**Fix**: Remove preload declarations for fonts not used in critical path. Keep only the fonts actually rendered before game initializes.

## Support & Escalation

For deployment issues:
1. Check Vercel build logs and error messages
2. Review `audits/PR_VALIDATION.md` for validation results
3. Consult the Known Issues section above
4. Contact the team on Slack with build logs and reproduction steps
