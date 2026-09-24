import { describe, expect, it } from "vitest";
import { MASS_RACE_FIELD, MODES, RACE_FINISH, modeById } from "../Modes";

describe("game modes", () => {
  it("defines every advertised mode with unique ids", () => {
    const ids = MODES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MODES.map((m) => m.id).sort()).toEqual(
      ["coinrush", "daytrip", "distance", "endless", "massrace", "perfect", "race", "zenith"].sort(),
    );
  });

  it("every mode has a name, blurb, icon and a valid score basis", () => {
    const scoreBases = new Set(["distance", "altitude", "coins", "perfects", "time"]);
    for (const m of MODES) {
      expect(m.name.length).toBeGreaterThan(1);
      expect(m.blurb.length).toBeGreaterThan(5);
      expect(m.icon.length).toBeGreaterThan(0);
      expect(scoreBases.has(m.scoreBy), `${m.id} scoreBy`).toBe(true);
      expect(m.clock).toBeGreaterThanOrEqual(0);
      expect(m.finish).toBeGreaterThanOrEqual(0);
    }
  });

  it("timed and endless modes are internally consistent", () => {
    for (const m of MODES) {
      // A mode is either clocked (clock > 0) or has a finish line or neither (endless).
      expect(m.clock === 0 || m.finish === 0).toBe(true);
    }
    expect(MODES.find((m) => m.id === "endless")!.escalate).toBe(true);
  });

  it("modeById resolves known ids and falls back to daytrip", () => {
    expect(modeById("race").id).toBe("race");
    expect(modeById("zenith").id).toBe("zenith");
    expect(modeById("daytrip").id).toBe("daytrip");
    // Unknown id falls back to the first (default) mode, never undefined.
    expect(modeById("nope" as never).id).toBe(MODES[0]!.id);
  });

  it("race finish lines are shared across PvP surfaces", () => {
    expect(MODES.find((m) => m.id === "race")!.finish).toBe(RACE_FINISH);
    expect(MODES.find((m) => m.id === "massrace")!.finish).toBe(RACE_FINISH);
    expect(MASS_RACE_FIELD).toBe(40);
  });
});
