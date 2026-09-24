import { describe, expect, it } from "vitest";
import { isPvpCircuit, launchIntentFor, pvpCircuitFor } from "../launchRouting";
import { MODES, PVP_MODES } from "../Modes";

/**
 * Regression guard for the menu audit (2026-09-18): the "Championship & PvP
 * Circuits" cards all used `pick-mode`, which started a solo run against the
 * AI flock. A card that says PvP dropped the player straight into an offline
 * AI race — no options, no notice.
 *
 * The routing rule is now explicit and pinned here: PvP circuits open the PvP
 * options, solo modes start a run, the mass race opens the lobby, and racing
 * the AI flock has its own route (`ai-pvp`).
 */
describe("mode launch routing", () => {
  it("sends every PvP circuit to the PvP options, never straight into a race", () => {
    expect(PVP_MODES).toHaveLength(8);
    for (const m of PVP_MODES) {
      expect(isPvpCircuit(m.id)).toBe(true);
      expect(launchIntentFor(m.id)).toBe("pvp-options");
    }
  });

  it("keeps solo modes solo and routes the mass race to the lobby", () => {
    const solo = MODES.filter((m) => !isPvpCircuit(m.id) && m.id !== "massrace");
    expect(solo.length).toBeGreaterThan(0);
    for (const m of solo) expect(launchIntentFor(m.id)).toBe("solo");
    expect(launchIntentFor("massrace")).toBe("lobby");
  });

  it("resolves a circuit id for the options screen, rejecting non-circuits", () => {
    expect(pvpCircuitFor("pvp_sprint")).toBe("pvp_sprint");
    expect(pvpCircuitFor("daytrip")).toBeNull();
    expect(pvpCircuitFor("massrace")).toBeNull();
    expect(pvpCircuitFor(undefined)).toBeNull();
    expect(pvpCircuitFor("")).toBeNull();
  });

  it("does not treat an unknown id as PvP (no accidental online seat)", () => {
    expect(launchIntentFor("")).toBe("solo");
    expect(launchIntentFor("totally-unknown")).toBe("solo");
  });
});
