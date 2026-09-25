/**
 * Portal policy gates: player-authored text and ad-removal purchases.
 *
 * Both were live in the shipped portal bundle until the Poki compliance pass:
 *
 *  1. The leaderboard rendered a free-text "Pilot name" input, and the name is
 *     broadcast to real players (netlib rooms, race rosters, floating name
 *     tags). Poki's content & player-safety policy allows no unmoderated
 *     player-authored text, and its external-resources policy forbids
 *     collecting personal data — so portal editions render the generated name
 *     read-only with a 🎲 roll instead.
 *  2. Gold's pitch sold "No sponsored breaks, ever". Poki rule REQ-20 forbids
 *     in-app purchases *and* any UI implying them (explicitly: no "remove ads"
 *     purchase). Portals own ad frequency — the game never injects its own
 *     interstitials there (`dueAd` is gated on `portalEnabled()`), so the claim
 *     was also simply untrue.
 *
 * Both are edition flags rather than runtime portal checks so the offending
 * strings are dead-code-eliminated from the portal bundles; the bundle-level
 * half of the gate lives in scripts/portal-markers.mjs and runs in
 * `pnpm verify:portals`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as edition from "../edition";

/**
 * There is ONE edition module. `src/game/edition.ts` *is* the Poki build — the
 * per-portal `edition.poki.ts` / `edition.crazy.ts` / `edition.generic.ts`
 * variants were deleted with the multi-portal tree, and this file used to
 * import `edition.poki` (a module that no longer exists) alongside it. Every
 * assertion below is therefore a straight Poki policy contract, not a
 * comparison between portals.
 */
describe("edition policy flags", () => {
  it("allows free-text pilot names, because they are profanity-filtered", () => {
    // Poki permits player-authored text once it is moderated; the leaderboard
    // name goes through isPilotNameClean() before it can be broadcast.
    expect(edition.CUSTOM_PILOT_NAMES).toBe(true);
  });

  it("forbids selling ad removal (Poki rule REQ-20)", () => {
    // No in-app purchases of any kind, and no UI implying one — including no
    // "remove ads" offer. Portals own ad frequency.
    expect(edition.SELL_AD_REMOVAL).toBe(false);
  });

  it("ships no in-game chat (emotes are the sanctioned alternative)", () => {
    expect(edition.SQUAD_CHAT).toBe(false);
  });

  it("never simulates its own ad breaks — the portal schedules them", () => {
    // The game must not inject interstitials on Poki; `dueAd` is gated on
    // `portalEnabled()` for the same reason.
    expect(edition.SIMULATED_BREAKS).toBe(false);
  });

  it("declares itself the Poki edition with Poki multiplayer", () => {
    expect(edition.POKI_EDITION).toBe(true);
    expect(edition.POKI_MULTIPLAYER).toBe(true);
  });

  it("reserves portal-owned names so no player can impersonate them", () => {
    expect(edition.RESERVED_PILOT_NAMES).toContain("poki");
  });
});

describe("GOLD.features", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../edition");
  });

  // The bullet is gated on the Vite define (not an imported const) so Rollup
  // can fold it away and DCE the string out of portal bundles entirely. That
  // makes it a compile-time contract: module mocking cannot reach it, so the
  // portal-off case is asserted on the source shape here and on the actual
  // bundle by scripts/portal-markers.mjs (`pnpm verify:portals`).
  it("gates the ad-removal bullet on the Vite define so portal bundles can DCE it", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const src = fs.readFileSync(join(process.cwd(), "src", "game", "Economy.ts"), "utf8");

    // What actually matters for DCE is that the bullet sits directly behind the
    // `import.meta.env` member expression, so `define` can fold it. The cast
    // that was pinned here (`as any`) was incidental syntax — and it forced a
    // lint-suppression comment, which `verify:prod` refuses in shipped client
    // code. The property is now typed in src/vite-env.d.ts, so the cast is gone;
    // this pattern tolerates it either way while still requiring the direct
    // member expression. The assertion below is what proves it is not reached
    // through an imported const.
    expect(src).toMatch(
      /\.\.\.\(import\.meta\.env\.VITE_SIM_BREAKS(?: as any)? \? \["No sponsored breaks, ever"\] : \[\]\)/,
    );
    // The string must never be reachable via a plain imported const, which
    // Rollup would not constant-fold across modules.
    //
    // The lookbehind is load-bearing: a bare identifier (no `VITE_` prefix)
    // would be imported, which Rollup cannot constant-fold across modules.
    expect(src).not.toMatch(/(?<!import\.meta\.env\.VITE_)SIM_BREAKS \? \["No sponsored breaks/);
  });

  it("keeps the bullet out of the direct build (VITE_SIM_BREAKS is off by default)", async () => {
    const { GOLD } = await import("../Economy");

    // VITE_SIM_BREAKS = false in vitest (no VITE_SIM_BREAKS=true env), so
    // the sponsored-breaks bullet is absent — exactly as the Poki build sees it.
    expect(GOLD.features.some((f) => /sponsored breaks/i.test(f))).toBe(false);
    expect(GOLD.features).toHaveLength(6);
  });
});
