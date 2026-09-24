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

  it("refuses to persist a name no player could be shown, whatever the caller", async () => {
    // The typing surfaces already reject with a message. This is the backstop for
    // every other caller — the portal account, a future surface, anything — and it
    // replaces rather than throws, because a caller that is not a text field has
    // nobody to show a refusal to.
    const { savePilotName } = await import("../Leaderboard");
    const { isPilotNameClean } = await import("../pilotNameGenerator");

    for (const dirty of ["Fucker", "N1gger", "a$$hole", "F u C k", "admin", "moderator"]) {
      const stored = savePilotName(dirty);
      expect(isPilotNameClean(stored), `"${dirty}" survived the choke point as "${stored}"`).toBe(true);
      expect(stored, `"${dirty}" was stored verbatim`).not.toBe(dirty);
    }
    // A clean name is still kept exactly as asked.
    expect(savePilotName("Kestrel42")).toBe("Kestrel42");
  });

  it("re-checks what it reads, so a stored name cannot smuggle itself back in", async () => {
    // Storage is the other way a bad name gets broadcast: it can predate this
    // filter, or have been edited in devtools. Reading must not assume the write
    // path was the one that put it there.
    const { loadPilotName } = await import("../Leaderboard");
    const { storage } = await import("../Storage");
    const { isPilotNameClean } = await import("../pilotNameGenerator");

    storage.setItem("sunbird.pilotname", "Fucker");
    try {
      expect(isPilotNameClean(loadPilotName("fallback")), "a tampered stored name was loaded").toBe(true);
      // …and the corrected name is what gets persisted, so it stays corrected.
      expect(isPilotNameClean(storage.getItem("sunbird.pilotname") ?? "")).toBe(true);
    } finally {
      storage.removeItem("sunbird.pilotname");
    }
  });

  it("the word lists can actually overshoot, so the clamp is load-bearing", () => {
    const longestPrefix = Math.max(...PILOT_PREFIXES.map(p => p.length));
    const longestBird = Math.max(...PILOT_BIRDS.map(b => b.length));
    expect(longestPrefix + longestBird + 2).toBeGreaterThan(PILOT_NAME_MAX);
  });
});
