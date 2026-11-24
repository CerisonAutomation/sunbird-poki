# Sunbird engineering handoff

This is the concise working handoff, not a release approval. For commands and ownership, start with the [root README](../README.md); for the rest of the documentation, use the [index](./README.md).

## Architecture and boundaries

- The Poki game is the priority. Shared game systems live in `src/game/`; Poki integration is behind `src/sdk/` and build-time edition adapters. Keep platform-specific behavior out of flight physics and keep Poki free of real-money purchase SDKs.
- `Game.ts` remains a large orchestration class. Extend existing small modules and typed action/rendering boundaries rather than moving behavior wholesale without regression coverage. Input, fixed-step simulation, lifecycle events, save compatibility and ad promise ordering are safety-critical.
- UI renderers return markup from snapshots; escape external or player-provided strings. Locale packs load asynchronously: resolve translated text at render time and preserve explicit user choice over automatic detection.

## Release verification

1. Run the checks and build commands in the root README. Record actual results against the exact source and artifact being reviewed.
2. Open the rebuilt `poki-upload/` in Poki Inspector. Verify boot, the gameplay start/stop event sequence, restart and resume, no-fill and successful/declined rewarded breaks, muting and input suppression, locale detection, saved choices, and offline/ad-blocked play.
3. Play on actual phones, tablets and desktop in both supported orientations. Check onboarding, touch/keyboard input, readability, performance, saves and complete runs. Automated screenshots and simulated SDKs do not prove feel or live behavior.
4. Confirm Poki's current requirements, approved external integrations/CSP, thumbnail assets, privacy and submission settings with the platform. Do not publish merely because a static packaging check passes.

## Known limitations

- Some game text remains hardcoded English. `pnpm i18n:audit` measures a limited set of patterns, not complete UI coverage; translation accuracy and long/RTL layouts still need human review.
- Platform ads depend on the SDK promise. There is no game-side timeout to cut off a live ad; if the SDK never settles the game remains in the break. Check real Inspector behavior and report platform failures rather than granting unconfirmed rewards.
- Multiplayer, Poki user data, live ads and production platform access have not been verified by local mocks. The old dated audit reports are historical evidence, not current certification.
- As of this audit, production dependency scanning reported no known vulnerabilities at high severity, but development dependencies retain moderate `glob` and `minimatch` advisories. They are tooling dependencies, not evidence of a clean supply chain; monitor and upgrade their parent packages when compatible fixes are available.
- There is no verified automated CI service in this checkout. Local checks are useful but do not replace independent review, security monitoring, device testing or release approval.

## Engineering reference points

The cleanup prioritizes reproducible builds and tests on packaged artifacts ([Google SRE release engineering](https://sre.google/sre-book/release-engineering/)), a discoverable README and responsible security workflow ([GitHub repository practices](https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories)), and dependency/security risk management ([OWASP Top 10](https://owasp.org/Top10/2025/)). These are practices to apply, not claims of certification or a substitute for a security review.
