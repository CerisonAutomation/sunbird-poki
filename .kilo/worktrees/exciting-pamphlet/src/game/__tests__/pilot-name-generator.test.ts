import { describe, expect, it } from "vitest";
import { PILOT_BIRDS, PILOT_NAME_MAX, PILOT_PREFIXES, generatePilotName } from "../pilotNameGenerator";

/**
 * The 14-character budget is not the generator's own preference — it is what the
 * rest of the game enforces. Both rename fields are `maxlength="14"`,
 * `savePilotName()` truncates to 14, `loadPilotName()` truncates a stored name to
 * 14, and rosters slice to it. A generated name that overshoots is therefore not
 * a cosmetic problem: it gets stored and displayed untruncated, renders past the
 * field's own limit, and is silently truncated into a *different* name the moment
 * the player confirms it.
 */
describe("pilot name generator", () => {
  it("never exceeds the limit the UI enforces", () => {
    for (let i = 0; i < 4000; i += 1) {
      const name = generatePilotName();
      expect(name.length, `"${name}" is over budget`).toBeLessThanOrEqual(PILOT_NAME_MAX);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("keeps the prefix + bird + number shape", () => {
    for (let i = 0; i < 500; i += 1) {
      const name = generatePilotName();
      expect(PILOT_PREFIXES.some(p => name.startsWith(p)), `"${name}" starts with a known prefix`).toBe(true);
      expect(PILOT_BIRDS.some(b => name.includes(b)), `"${name}" contains a known bird`).toBe(true);
      expect(/\d{2}$/.test(name), `"${name}" ends in a two-digit number`).toBe(true);
    }
  });

  it("survives being saved and read back unchanged", async () => {
    // savePilotName() truncates to the same budget, so a generated name must come
    // out the other side identical — otherwise confirming your own freshly
    // generated name renames you.
    const { savePilotName } = await import("../Leaderboard");
    for (let i = 0; i < 300; i += 1) {
      const name = generatePilotName();
      expect(savePilotName(name), `"${name}" changed on save`).toBe(name);
    }
  });

  it("the word lists can actually overshoot, so the clamp is load-bearing", () => {
    const longestPrefix = Math.max(...PILOT_PREFIXES.map(p => p.length));
    const longestBird = Math.max(...PILOT_BIRDS.map(b => b.length));
    expect(longestPrefix + longestBird + 2).toBeGreaterThan(PILOT_NAME_MAX);
  });
});
