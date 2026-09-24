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

import * as crazyEdition from "../edition.crazy";
import * as directEdition from "../edition";
import * as genericEdition from "../edition.generic";
import * as pokiEdition from "../edition.poki";

describe("edition policy flags", () => {
  it("direct build keeps free-text names and may sell ad removal", () => {
    expect(directEdition.CUSTOM_PILOT_NAMES).toBe(true);
    expect(directEdition.SELL_AD_REMOVAL).toBe(true);
  });

  // The direct build has no ad network wired in, so it must not rehearse
  // sponsored breaks by default: a simulated break is a fake ad state that
  // interrupts a run to show nothing. `VITE_SIM_BREAKS=true` opts in (ad-flow
  // rehearsal / a future real provider); tests run with it unset, which is the
  // shipped configuration and the one this guard protects.
  it("direct build does not rehearse ad breaks unless VITE_SIM_BREAKS opts in", () => {
    expect(directEdition.SIMULATED_BREAKS).toBe(false);
  });

  // Every portal edition is read-only now, Poki included. It used to allow
  // free text behind `isPilotNameClean`, but the name is broadcast to strangers
  // over P2P netlib rooms, `scripts/portal-markers.mjs` treats a
  // `data-ref="pilotName"` surface as forbidden in ANY portal bundle, and the
  // gate was failing the Poki zip because of it. Generated name + 🎲 reroll
  // keeps identity without player-authored text — and it also takes a keyboard
  // out of the first-run path, which the onboarding rules want gone anyway.
  it("poki edition forbids free-text names and ad-removal sales", () => {
    expect(pokiEdition.CUSTOM_PILOT_NAMES).toBe(false);
    expect(pokiEdition.SELL_AD_REMOVAL).toBe(false);
    expect(pokiEdition.SIMULATED_BREAKS).toBe(false);
  });

  it("every edition carries its own no-cloud leaderboard wording", () => {
    for (const edition of [directEdition, pokiEdition, crazyEdition, genericEdition]) {
      expect(edition.LEADERBOARD_LOCAL.chip.length).toBeGreaterThan(2);
      expect(edition.LEADERBOARD_LOCAL.sentence.length).toBeGreaterThan(10);
    }
  });

  it("never names a foreign portal in another portal's copy", () => {
    // The whole reason these strings are edition exports: a shared ternary put
    // every portal's name into every bundle.
    const text = (e: { PORTAL_DISPLAY_NAME: string; LEADERBOARD_LOCAL: { chip: string; sentence: string } }): string =>
      `${e.PORTAL_DISPLAY_NAME} ${e.LEADERBOARD_LOCAL.chip} ${e.LEADERBOARD_LOCAL.sentence}`;
    expect(text(crazyEdition)).not.toMatch(/poki/i);
    expect(text(genericEdition)).not.toMatch(/poki|crazygames/i);
    expect(text(pokiEdition)).not.toMatch(/crazygames/i);
  });

  it.each([
    ["crazy", crazyEdition],
    ["generic", genericEdition],
  ] as const)("%s edition forbids free-text names and ad-removal sales", (_portal, edition) => {
    expect(edition.CUSTOM_PILOT_NAMES).toBe(false);
    expect(edition.SELL_AD_REMOVAL).toBe(false);
    // Portals serve real breaks; a simulated one would be a fake ad state.
    expect(edition.SIMULATED_BREAKS).toBe(false);
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

    // Exactly the env read, no cast: VITE_SIM_BREAKS is typed `boolean` in
    // src/vite-env.d.ts and pinned to a boolean literal by vite.config's define
    // (true only for PORTAL === "none" with VITE_SIM_BREAKS=true), so `as any`
    // was only ever hiding a missing type (and `verify:prod` bans the
    // eslint-disable it needed).
    expect(src).toMatch(
      /\.\.\.\(import\.meta\.env\.VITE_SIM_BREAKS \? \["No sponsored breaks, ever"\] : \[\]\)/,
    );
    // The string must never be reachable via a plain imported const, which
    // Rollup would not constant-fold across modules. (`[^.\w]` keeps this from
    // matching the `import.meta.env.VITE_`-prefixed read asserted above.)
    expect(src).not.toMatch(/(?:^|[^.\w])SIMULATED_BREAKS \? \["No sponsored breaks/);
    expect(src).not.toMatch(/(?:^|[^.\w])SELL_AD_REMOVAL \? \["No sponsored breaks/);
  });

  // The shipped direct build has no ad network, so Gold must not claim to remove
  // breaks — that pitch would sell the removal of a break the build never shows
  // (a fake ad state, and a refund-shaped complaint). The bullet comes back with
  // VITE_SIM_BREAKS=true, i.e. only in a build that actually schedules breaks;
  // the source-shape guard above pins how it is gated.
  it("drops the ad-removal bullet from the shipped direct build's Gold pitch", async () => {
    const { GOLD } = await import("../Economy");

    expect(GOLD.features.some((f) => /sponsored breaks/i.test(f))).toBe(false);
    expect(GOLD.features).toHaveLength(6);
    // The rest of the pitch must survive the gate untouched.
    expect(GOLD.features.some((f) => /2× coins/i.test(f))).toBe(true);
    expect(GOLD.features.some((f) => /free second winds/i.test(f))).toBe(true);
  });
});
