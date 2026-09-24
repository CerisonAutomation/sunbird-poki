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

import * as directEdition from "../edition";
import * as pokiEdition from "../edition.poki";

describe("edition policy flags", () => {
  it("direct build keeps free-text names and may sell ad removal", () => {
    expect(directEdition.CUSTOM_PILOT_NAMES).toBe(true);
    expect(directEdition.SELL_AD_REMOVAL).toBe(true);
  });

  // Poki now allows free-text pilot names with profanity filtering (isPilotNameClean).
  // crazy/generic still forbid them (no filter shipped there).
  it("poki edition allows free-text names (profanity-filtered) but forbids ad-removal sales", () => {
    expect(pokiEdition.CUSTOM_PILOT_NAMES).toBe(true);
    expect(pokiEdition.SELL_AD_REMOVAL).toBe(false);
  });

  it("the direct/web edition forbids neither, which is the contrast that matters", () => {
    // The other portal editions are gone — Poki is the only portal this game
    // ships to — so the contrast is now Poki's policy against the neutral build.
    expect(directEdition.CUSTOM_PILOT_NAMES).toBe(true);
    expect(directEdition.SELL_AD_REMOVAL).toBe(true);
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
      /\.\.\.\(import\.meta\.env\.VITE_SELL_AD_REMOVAL(?: as any)? \? \["No sponsored breaks, ever"\] : \[\]\)/,
    );
    // The string must never be reachable via a plain imported const, which
    // Rollup would not constant-fold across modules.
    //
    // The lookbehind is load-bearing. Without it this pattern is satisfied by
    // the GOOD form too, because `import.meta.env.VITE_SELL_AD_REMOVAL ? [`
    // contains the substring `SELL_AD_REMOVAL ? [`. The old `as any` cast
    // happened to break the match by sitting between them, so removing the cast
    // silently turned this guard into a tautology — it rejected the foldable
    // form it exists to protect. A bare identifier (no `VITE_` prefix) is the
    // thing to catch.
    expect(src).not.toMatch(/(?<!import\.meta\.env\.VITE_)SELL_AD_REMOVAL \? \["No sponsored breaks/);
  });

  it("keeps the bullet in the direct build", async () => {
    const { GOLD } = await import("../Economy");

    expect(GOLD.features.some((f) => /sponsored breaks/i.test(f))).toBe(true);
    expect(GOLD.features).toHaveLength(7);
  });
});
