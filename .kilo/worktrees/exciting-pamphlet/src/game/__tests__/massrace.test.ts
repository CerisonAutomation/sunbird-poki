import { describe, expect, it } from "vitest";
import {
  MassRace,
  PACK_CATCHUP_CAP,
  PACK_CATCHUP_END,
  PACK_CATCHUP_RATE,
  PACK_CATCHUP_START,
  applyPackCatchup,
  packCatchupDelta,
} from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";

/**
 * Network-boundary validation: remote snapshots are untrusted data, and a
 * malformed one (non-finite coordinates, empty id) must be dropped at the
 * boundary — never applied — or a NaN would silently corrupt a rival's sim
 * state and rendered transform for the rest of the race.
 */
describe("mass race network boundary", () => {
  it("drops non-finite remote snapshots instead of corrupting the rival", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => [
        { id: "ai-0", name: "Hacker", x: NaN, y: NaN, rotation: NaN },
        { id: "ai-1", name: "Ok", x: 500, y: 20, rotation: 0 },
      ],
    });
    mr.step(1 / 60, terrain, 4000, 1);
    // The NaN snapshot must have been rejected, not applied.
    expect(Number.isFinite(mr.rivals[0]!.bird.x)).toBe(true);
    expect(Number.isFinite(mr.rivals[0]!.bird.y)).toBe(true);
    // The finite snapshot is applied normally.
    expect(mr.rivals[1]!.bird.x).toBe(500);
    terrain.dispose();
  });

  it("rejects a snapshot with a missing/empty id (no bogus promotion)", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => [{ id: "", name: "Ghost", x: 100, y: 10, rotation: 0 }],
    });
    mr.step(1 / 60, terrain, 4000, 1);
    // The empty-id snapshot is dropped, so the local rival keeps its real id.
    expect(mr.rivals[0]!.id).toMatch(/^ai-/);
    terrain.dispose();
  });

  it("counts live humans: zero offline, one per promoted slot online", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(2, "2026-09-12", terrain, 0);
    expect(mr.remoteCount).toBe(0);
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => [{ id: "human-1", name: "Human", x: 500, y: 20, rotation: 0 }],
    });
    mr.step(1 / 60, terrain, 4000, 1);
    expect(mr.remoteCount).toBe(1);
    terrain.dispose();
  });
});

/**
 * Emote feedback regression (menu audit, 2026-09-18). The emote buttons looked
 * dead because the only local feedback was the in-world bubble, whose lifetime
 * is measured against the sim clock — which is frozen whenever the frame loop
 * is not stepping the race. showEmote() must therefore be visible *immediately*
 * (stamped at the current clock), with the sender's own pop handled by the HUD.
 */
describe("emote visibility", () => {
  it("shows a fresh emote without requiring a simulation step", () => {
    const terrain = new TerrainSystem("2026-09-18");
    const mr = new MassRace();
    mr.spawn(4, "2026-09-18:pvp_sprint:emerald", terrain, 0);

    // No step() call — the clock is still 0.
    mr.showEmote("you", "👋");
    const row = mr.roster(0, 0, 1500, "Pilot").find((r) => r.you);
    expect(row?.emote).toBe("👋");
  });

  it("expires an emote a few seconds later rather than pinning it forever", () => {
    const terrain = new TerrainSystem("2026-09-18");
    const mr = new MassRace();
    mr.spawn(4, "2026-09-18:pvp_sprint:emerald", terrain, 0);
    mr.showEmote("you", "🔥");
    mr.step(4, terrain, 1500, 4, 100, 40); // past the 2.5 s bubble lifetime
    const row = mr.roster(100, 0, 1500, "Pilot").find((r) => r.you);
    expect(row?.emote).toBe("");
  });
});

describe("pack catch-up (casual rubber-band)", () => {
  const DT = 1 / 60;

  it("does nothing inside the pack or beyond the shot", () => {
    expect(packCatchupDelta(0, DT)).toBe(0);
    expect(packCatchupDelta(PACK_CATCHUP_START, DT)).toBe(0);
    expect(packCatchupDelta(PACK_CATCHUP_END, DT)).toBe(0);
    expect(packCatchupDelta(2000, DT)).toBe(0);
  });

  it("preserves the shipped MassRace curve at intensity 1", () => {
    const full = packCatchupDelta(500, DT, 1);
    expect(full).toBeCloseTo(DT * PACK_CATCHUP_RATE, 8);
    const half = packCatchupDelta(425, DT, 1);
    expect(half).toBeCloseTo(DT * PACK_CATCHUP_RATE * 0.5, 8);
  });

  it("never exceeds the catch-up cap", () => {
    expect(applyPackCatchup(194, 500, DT)).toBeLessThanOrEqual(PACK_CATCHUP_CAP);
    expect(applyPackCatchup(PACK_CATCHUP_CAP, 500, DT)).toBe(PACK_CATCHUP_CAP);
  });

  it("scales with intensity and clamps it", () => {
    const base = packCatchupDelta(500, DT, 1);
    expect(packCatchupDelta(500, DT, 1.28)).toBeCloseTo(base * 1.28, 8);
    expect(packCatchupDelta(500, DT, 99)).toBeCloseTo(base * 1.6, 8);
    expect(packCatchupDelta(500, DT, 0)).toBeCloseTo(base * 0.5, 8);
  });

  it("rejects non-finite inputs", () => {
    expect(packCatchupDelta(Number.NaN, DT)).toBe(0);
    expect(packCatchupDelta(500, 0)).toBe(0);
    expect(applyPackCatchup(Number.NaN, 500, DT)).toBe(0);
  });
});
