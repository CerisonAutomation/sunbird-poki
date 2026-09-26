# Release verdict — Sunbird Poki, portal build

Author: god (orchestrator). Written directly, not delegated: the harness lane was given this
deliverable and spent 3h58m/113min CPU producing a broken gate edit instead.

Commit: `66bb730`. Pushed: `main` == `github/main`, 0 unpushed.
Gates on the tree: `typecheck` 0 · `lint` 0 · `madge --circular` 0 · **2228 tests passed / 9 skipped**.

---

## 1. VERDICT

**Conditional — do not upload yet. One blocker, and it is a broken test rather than a broken game.**

`pnpm gate` exits 1, and it exits at the **last** step (`test:policy`). Every step before it is green.
The failure is not a policy violation by the game. It is that one assertion in the platform-policy spec
asserts the existence of an element that a correct portal build must not render, so it waits for a
locator that can never appear and times out. That is a real defect and it has to be fixed, but fixing it
is a test fix, not a game change, and it does not indicate the game breaks Poki's rules.

**One environment blocker is also outstanding**: the Playwright browser build this repo expects is not
installed. See §4.

---

## 2. What `pnpm gate` actually did

Ran to completion, exit 1, 1975 lines of output. Steps that passed, in order: `lint`, `audit:ui`,
`typecheck`, `test`, `verify:prod`, `build:poki`, `verify:portals`, `audit:zips`, `verify:upload`,
`verify:thumbnail`, `isolation:check`. It then reached `test:policy` and failed there.

**`test:policy` real result — 2 of 4 assertions verified passing, 1 broken, 1 unrun:**

| assertion | desktop | phone |
|---|---|---|
| first-run welcome screen offers typing, pre-filled call sign | **PASS** | not reached |
| lets a Poki player type a call sign, and **refuses one that is not allowed** | **PASS** | not reached |
| never offers to remove ads | BROKEN (see §3) | BROKEN (same cause) |
| direct build keeps what the portal drops | not reached | not reached |

The second row is the one that matters most for platform compliance, and it passes: a Poki player can
type a call sign and a disallowed one is refused.

---

## 3. The blocker: a test that asserts a correct build must fail

`e2e/portal-policy.spec.ts:274-277` does:

```ts
await openMenu(page, "open-pass", "Nest Pass");
await page.locator('[data-action="open-paywall"]').first().click();
await expect(...).toHaveText("Coin Store", { timeout: 20_000 });
```

`open-paywall` appears in `src/game/HUD.ts` at five sites (1901, 2994, 3127, 3494, 3566) and **every one
of them is gated behind `SELL_AD_REMOVAL`**. And `src/game/edition.ts` reads:

```ts
export const SELL_AD_REMOVAL = false;
```

So in this build the paywall is never rendered. That is the **desired** behaviour: the portal edition
must not offer to sell ad removal. The HUD even says so — `!SELL_AD_REMOVAL` renders *"Portal edition —
premium rewards shown for reference"*. In the shipped artifact `poki-upload/index.html`, `open-paywall`
appears once and `SELL_AD_REMOVAL` zero times: the string survives in the bundle but no code path
renders it.

The test's premise — walk into the paywall, then check it does not offer ad removal — is wrong for a
build where the paywall correctly does not exist. Both projects hung on the same locator for the full
240s, which is a missing-element signature rather than a slow-box signature.

**The correct fix is to invert the assertion**: the portal build must render **no** ad-removal offer
anywhere, so the test should assert the absence of those controls across the walk it already performs,
not try to click into a screen that must not be there. Do not simply delete the test — the
screen-headings regression it also catches (11 of 17 screens were once showing raw internal ids) is
exactly the class of bug a human reviewer will not spot.

---

## 4. Environment blocker: Playwright browser build mismatch

The first gate run failed all 8 policy tests with one cause:

```
Error: browserType.launch: Executable doesn't exist at
  ~/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-
```

Installed is `chromium-1243` / `chromium_headless_shell-1243`; the spec wants build **1208**. The config
already carries the right escape hatch — `launchOptions.executablePath:
process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE` — and every result in §2 was obtained by setting it to the
installed headless shell. **CI will hit the same wall unless the expected build is installed or the
config pins the path.** That is a one-line fix and it should be made, not worked around.

---

## 5. "Coin-only, no payment processor" — NOW ENFORCED

This was the open trust question and it is resolved. The authoritative check moved to a **fatal,
pre-scrub** gate at `scripts/package-portal.mjs:63-81`: it runs on the bundle *before* the name scrub,
where a payment SDK is still plain text, and `throw`s on any hit.

The old `.replace(/stripe/gi, "portal")` is now explicitly labelled *"hygiene, not verification"* and
documented as *"provably a no-op on a clean tree"* because the pre-scrub gate is fatal — which is exactly
the right relationship between the two.

`scripts/verify-portal.mjs:91-96` is now honestly scoped: *"Staged-artifact hygiene, NOT the coin-only
gate… It cannot see a processor that was never spelled this way, and does not pretend to."*

**Residual limit, stated rather than hidden:** it is a text scan, so a processor whose name is assembled
at runtime would still pass. That is a real gap, honestly bounded, and materially better than the
previous state where the check was a tautology and the claim was true *only by inspection*.

---

## 6. Other state, for completeness

- **`server/tsconfig.json` still does not exist** (`server/` holds one file), so `pnpm typecheck:server`
  cannot work. `pnpm gate` no longer calls it, so it is a dangling script rather than a broken gate.
  Either delete the script or add the tsconfig; leaving it is the one option that is neither.
- **G3 is properly fixed, not renamed**: the coverage floor points at `DeepLinks.ts`, which exists and
  measures 70.42%, and a second unsatisfiable floor (`Achievements.ts` 87.5% vs a 95 bar) was found and
  fixed. Both were "the same defect wearing a different name."
- The Poki analytics channel is fixed. The old guard discarded **10 of 16** live event kinds; the action
  set is now open with no allowlist, tested at the SDK boundary.
- `main` and `github/main` are level. Nothing is unpushed.

---

## 7. What has to happen before upload

1. **Fix the ad-removal assertion** — invert it to assert absence (§3). Do not delete the test.
2. **Install or pin the Playwright browser build** (§4), so `test:policy` is reproducible in CI.
3. Re-run `pnpm gate` end to end and confirm exit 0.
4. **The human makes the upload decision.** Nothing on this floor uploads, and nothing should.

Two of those are small. Neither requires a game change. Once they are done this build is defensible to
hand to the Poki Inspector.
