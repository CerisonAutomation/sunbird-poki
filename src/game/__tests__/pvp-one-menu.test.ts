import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_DESTINATIONS,
  PLAY_DESTINATIONS,
  PROGRESS_DESTINATIONS,
  QUICK_ACTIONS,
  SECONDARY_DESTINATIONS,
} from "../MenuCatalog";

/**
 * Rivals are one question, and the rail is one row.
 *
 * This test previously enforced ONE merged rival tile, on the reasoning that
 * asking "human or AI?" before the player has decided to race makes them pick a
 * category rather than an opponent. That reasoning still holds — and it is why
 * the decision it produced has changed shape rather than been abandoned.
 *
 * The menu is now a rail of four directly under the main button instead of
 * three scrolled sections, and the two rivals sit SIDE BY SIDE at the top of
 * it. Same guarantee as before — neither rival is buried, and neither is hidden
 * behind the other — reached by adjacency rather than by merging. The merged
 * tile is what let "AI PvP" end up a sub-line nobody read; next to each other,
 * both are one tap from the button.
 */
describe("the home menu: rivals lead the rail, side by side", () => {
  it("puts both rivals in the rail, in order, and nowhere else", () => {
    const rivals = ALL_DESTINATIONS.filter(
      (d) => d.action === "open-live" || d.action === "open-practice",
    ).map((d) => d.key);
    expect(rivals.sort(), "a rival left the rail").toEqual(["aiPvp", "raceLobby"]);

    // ...and neither is a scrolled section tile, which was the actual problem.
    const inGrid = [...PLAY_DESTINATIONS, ...PROGRESS_DESTINATIONS]
      .filter((d) => d.action === "open-live" || d.action === "open-practice");
    expect(inGrid, "a rival is back in a scrolled grid").toEqual([]);
  });

  it("leads the rail with them, so they are the first things offered", () => {
    // Array order IS the contract — there is no `pinned` flag to read, because
    // nothing in production ever read one. Assert the order directly.
    expect(QUICK_ACTIONS.map((d) => d.action), "PvP is no longer the first thing offered")
      .toEqual(["open-live", "open-practice", "open-shop", "open-settings"]);
  });

  it("names each opponent on its own tile, so neither is hidden", () => {
    const live = QUICK_ACTIONS[0]!;
    const ai = QUICK_ACTIONS[1]!;
    // A tile that says "PvP" and leaves the flock implied is the same
    // re-hiding the old merged tile was meant to end, one row down.
    expect(live.title.toLowerCase()).toContain("pvp");
    expect(live.title.toLowerCase()).not.toContain("ai");
    expect(live.detail.toLowerCase()).toMatch(/real|pilot|human/);
    expect(ai.title.toLowerCase()).toContain("ai");
    expect(ai.detail.toLowerCase()).toMatch(/flock|offline|practice/);
  });

  it("keeps the rail to four, and keeps shop and settings in it", () => {
    expect(QUICK_ACTIONS).toHaveLength(4);
    const actions = QUICK_ACTIONS.map((d) => d.action);
    expect(actions).toContain("open-shop");
    expect(actions).toContain("open-settings");
  });

  it("keeps every destination addressable by a stable key", () => {
    const keys = ALL_DESTINATIONS.map((d) => d.key);
    expect(new Set(keys).size, "two destinations share a key").toBe(keys.length);
    for (const d of ALL_DESTINATIONS) {
      expect(d.title.length, `${d.key} has no name`).toBeGreaterThan(0);
      expect(d.action.length, `${d.key} has no action`).toBeGreaterThan(0);
    }
  });

  it("renders both rival sections from one shared helper", async () => {
    // The lobby and the AI-only view used to carry separate copies of the AI
    // controls, and they drifted — the lobby advertised formats the practice
    // screen did not offer. One helper is what stops that recurring.
    const hud = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
    const helper = /function aiRivalSection\(s: HudSnapshot\): string \{/.test(hud);
    expect(helper, "the shared AI section helper is gone").toBe(true);
    const uses = [...hud.matchAll(/\$\{aiRivalSection\(s\)\}/g)].length;
    expect(uses, "only one screen renders the AI section, so they can drift again").toBe(2);
  });

  it("renders the rail directly under the main button, in renderMain", () => {
    // Nothing above asserts the rail is EMITTED — only that the catalog is
    // right. A renderer that quietly stopped calling renderQuickRail() would
    // pass every other test here while the menu silently lost its most-used
    // four controls. Pin the call site and its position.
    const hud = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
    const main = hud.slice(hud.indexOf("function renderMain"));
    const launch = main.indexOf('class="primary-btn home-launch"');
    const rail = main.indexOf("${renderQuickRail()}");
    expect(launch, "the main button is gone").toBeGreaterThan(-1);
    expect(rail, "renderMain no longer renders the quick rail").toBeGreaterThan(-1);
    expect(
      rail > launch,
      "the rail must come AFTER the main button, not above it",
    ).toBe(true);
    // ...and nothing sits between them, or it is not "underneath" it.
    expect(main.slice(launch, rail)).not.toContain("renderDailyRitualBanner");
  });

  it("gives every non-tiled destination a real route elsewhere on the screen", () => {
    // SECONDARY_DESTINATIONS holds destinations deliberately kept OUT of the
    // grids because they are already reachable from this same screen. That is
    // only safe while the second route actually exists — so pin it, rather than
    // trusting the comment that justifies their absence.
    const hud = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
    for (const dest of SECONDARY_DESTINATIONS) {
      const inGrid = [...PLAY_DESTINATIONS, ...PROGRESS_DESTINATIONS].some(
        (d) => d.action === dest.action,
      );
      expect(inGrid, `${dest.key} is in a grid AND secondary — pick one`).toBe(false);
      // Reachable from the home screen by some control other than its tile.
      // Search the WHOLE file: a second route can live in a helper defined
      // before renderMain (the tournament strip is), and slicing from
      // renderMain onward would report a false negative.
      const routed = hud.includes(`data-action="${dest.action}"`);
      expect(routed, `${dest.key} has no route from the home screen at all`).toBe(true);
    }
  });

  it("still offers the AI-only shortcut from inside the lobby", () => {
    // `open-practice` is not a home tile any more, but a player already in the
    // race screen who wants only the flock should not have to scroll back.
    const hud = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
    expect(hud, "the in-lobby AI shortcut disappeared").toContain('data-action="open-practice"');
    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    expect(game, "open-practice no longer resolves").toContain('case "open-practice"');
  });
});
