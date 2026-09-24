# Portrait and landscape audit

> **Status:** resolved — findings below were fixed on 2026-09-20. Portal scaling is now checked by `e2e/scaling.spec.ts` and `pnpm verify:thumbnail`.

Audited 2026-09-20. Scope: browser/PWA orientation configuration, canvas/camera sizing,
local split-screen, touch recovery, menus/HUD, and rotation through gameplay and results.

## Findings and fixes

| Finding | Fix / regression coverage |
| --- | --- |
| A portrait-only body overlay intercepted play; the installed app requested landscape only. | Removed the overlay and changed the manifest orientation to `any`. Browser checks test actual clicks/taps and the manifest, not just DOM visibility. |
| The split divider used a phone-width media query, disagreeing with the renderer on tablets and near-square windows. | HUD uses the authoritative split-layout state. Tests include portrait/landscape phones and tablets, square windows, and the 1.25 aspect boundary. |
| `visualViewport` dimensions could differ from the CSS canvas and input surface during keyboard/zoom changes. | Renderer and camera now use the host's dimensions; invalid transient dimensions are ignored. Unit and browser tests simulate a reduced visual viewport. |
| Integer-halving both split views lost a row/column on odd-sized screens; fractional DPR could also create seams. | Partition physical pixels and convert to Three.js logical units. Geometry tests verify complete, non-overlapping coverage at six DPRs, including 1.25 and 2.625. |
| Rotation recovery timers accumulated and could run after disposal. | Coalesce delayed resize passes, cancel on disposal, and guard late resize callbacks. |
| Old touch assignments survived split-layout changes; cancelled/untracked pointer releases could trigger a boost. | Clear touch/gesture state when the split changes, retain keyboard/gamepad holds, and ignore cancelled or untracked gesture releases. Unit tests cover cancellation, simultaneous touches, offset hosts, and fresh routing after rotation. |
| Menu artwork overlapped the sound button and the title on narrow portrait screens. | Repositioned the illustrations; reviewed screenshots and retained the menu no-overlap checks. |
| Browser helpers assumed the welcome screen did not exist and measured cloned HUD lanes before layout settled. Some test labels referred to older UI copy/actions. | Complete onboarding through real controls, settle layout around fixture measurements, and update stale selectors without weakening layout assertions. |
| Existing `MenuSky` cache fields used eight explicit `any` casts, failing the repository lint gate. | Replaced them with typed private cache fields; scenery tests still pass. |

## Validation

- `npm run lint`: pass.
- `npm run typecheck` and `npm run typecheck:server`: pass.
- `npm test`: **1,165 passed**, 8 live-PvP tests skipped by their existing configuration.
- `npm run test:server`: **23 passed**.
- `npm run build`: pass; existing large-chunk advisory remains.
- `npm run audit:ui`: pass, with 17 existing advisory warnings.
- Browser checks: **51 passed** (50 orientation/scaling/HUD/menu/flight checks plus
  the real completed-flight/results/shop/replay check). The consolidated command is
  `npm run test:orientation`; CI runs this against a production build.
- Browser evidence uses Chromium 153 with SwiftShader, desktop and Pixel 7 emulation.
  Sizes cover 320×568 / 568×320, 390×844 / 844×390, 393×853 / 853×393,
  768×1024 / 1024×768, square/near-square windows, and portal minimum/intermediate sizes.
  Tests include a portrait iframe within a landscape outer page and large-text menus.

In this sandbox, Chromium was provisioned with `node scripts/setup-browser.mjs`;
Playwright was run with:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/spart/chromium \
LD_LIBRARY_PATH=/tmp/spart/lib FONTCONFIG_FILE=/tmp/spart/fonts.conf \
npm run test:orientation
```

## Separate release blocker and limits

The Poki single-file build succeeds, but `npm run verify:upload` fails `ROOT-07`
because the existing onboarding screen emits `data-ref="pilotNameInput"` for a
free-text name field. This markup is also present in the base revision and is not
introduced by this orientation work. The portal upload must **not** be called
release-ready until its name-entry policy is fixed. Generated upload files and
icons from that audit are not included in this PR.

Automated viewport changes and touch emulation do not replace physical-device QA.
Before release, check Safari/iOS and Android on real hardware: rotate while holding
input, open/close the keyboard, enter/leave fullscreen, and confirm notched-device
safe areas. The manifest is verified, but OS-level installed-PWA rotation was not
exercised in this sandbox. Portal Inspector approval was not performed.
