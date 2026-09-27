import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_DESTINATIONS, PLAY_DESTINATIONS } from "../MenuCatalog";

/**
 * Rivals are one question with two answers, and the home menu is one row.
 *
 * A home menu that asks "human or AI?" before it has established that the
 * player wants to race at all makes the player choose a category rather than
 * an opponent. So there is ONE rival tile, it leads, and the screen behind it
 * carries both kinds of rival.
 */
describe("the home menu: one PvP tile, both rivals behind it", () => {
  it("has exactly one rival destination", () => {
    const rivals = PLAY_DESTINATIONS.filter((d) => d.action === "open-live" || d.action === "open-practice");
    expect(rivals.map((d) => d.key), "the home menu went back to choosing a category").toEqual(["raceLobby"]);
  });

  it("leads with it, and pins it above the sections", () => {
    expect(PLAY_DESTINATIONS[0]!.action, "PvP is no longer the first thing offered").toBe("open-live");
    expect(PLAY_DESTINATIONS[0]!.pinned, "PvP can be a tab-switch away").toBe(true);
  });

  it("names both opponents on the tile, so the choice is not hidden", () => {
    const pvp = PLAY_DESTINATIONS[0]!;
    // A tile that says "Race live rivals" and hides the flock is the same
    // re-hiding the second tile was meant to end, one level down.
    expect(pvp.title.toLowerCase()).toContain("ai");
    expect(pvp.detail.toLowerCase()).toMatch(/live|room/);
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

  it("still offers the AI-only shortcut from inside the lobby", () => {
    // `open-practice` is not a home tile any more, but a player already in the
    // race screen who wants only the flock should not have to scroll back.
    const hud = readFileSync(join(process.cwd(), "src", "game", "HUD.ts"), "utf8");
    expect(hud, "the in-lobby AI shortcut disappeared").toContain('data-action="open-practice"');
    const game = readFileSync(join(process.cwd(), "src", "game", "Game.ts"), "utf8");
    expect(game, "open-practice no longer resolves").toContain('case "open-practice"');
  });
});
