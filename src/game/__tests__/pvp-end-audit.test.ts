import { beforeEach, describe, expect, it } from "vitest";
import { MassRace } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";
import { SaveData } from "../SaveData";
import { divisionFor, duelOpponent, ratingDelta } from "../pvp";

/**
 * End-of-PVP crash audit.
 *
 * Replays the exact sequences the game runs when a race ends (finish line,
 * knockout elimination, DNF), including ranked/duel settlement and hostile
 * network frames arriving around the same moment. Any throw here is a
 * frame-killer: the rAF loop's catch logs and continues, but a repeat
 * offender leaves the player frozen on the results screen — the reported
 * "crashes at the end of PVP".
 */

type HostileFrame = { id: string; name: string; x: number; y: number; rotation: number; finished?: boolean };

function raceField(seed = "2026-09-16") {
  const terrain = new TerrainSystem(seed);
  const mr = new MassRace();
  mr.spawn(40, seed, terrain, 0);
  return { terrain, mr };
}

function stepField(mr: MassRace, terrain: TerrainSystem, finish: number, seconds: number): number {
  let t = 0;
  for (let i = 0; i < Math.floor(seconds * 60); i++) mr.step(1 / 60, terrain, finish, (t = i / 60));
  return t;
}

// SaveData persists through localStorage; each audit scenario starts fresh.
beforeEach(() => localStorage.clear());

describe("end of PVP", () => {
  it("settles a ranked mass-race finish without throwing (photo finish included)", () => {
    const { terrain, mr } = raceField();
    // Player crosses the line alongside a rival within 25m → photo-finish branch.
    mr.rivals[0]!.bird.x = 1510; // 10m behind the player at 1520
    const t = stepField(mr, terrain, 1500, 10);
    expect(t).toBeGreaterThan(0);

    const s = mr.standings(1520, 0, "You", 8);
    expect(s.place).toBeGreaterThan(0);
    expect(s.total).toBe(41);

    // The exact finish-line sequence from Game.ts (race branch).
    const you = s.rows.find((r) => r.you);
    const rival = s.rows
      .filter((r) => !r.you)
      .sort((a, b) => Math.abs(a.distance - (you?.distance ?? 0)) - Math.abs(b.distance - (you?.distance ?? 0)))[0];
    const photo = rival && you && Math.abs(rival.distance - you.distance) < 25;
    expect(typeof photo).toBe("boolean");
    if (s.place > 1) {
      const ahead = s.rows.find((r) => r.place === s.place - 1);
      expect(ahead === undefined || typeof ahead.name === "string").toBe(true);
    }

    // Ranked settlement (recordRivalResult + division check).
    const save = new SaveData();
    const better = save.noteRacePlace(s.place, s.total);
    expect(typeof better).toBe("boolean");
    const res = save.recordRivalResult(s.place, s.total, "massrace-live", "2026-09-16", true);
    expect(Number.isFinite(res.delta)).toBe(true);
    const div = divisionFor(save.state.rival.rating);
    expect(typeof div.id).toBe("string");
    terrain.dispose();
  });

  it("settles a duel finish and an abandoned-duel DNF without throwing", () => {
    const { terrain, mr } = raceField("2026-09-17");
    const s = mr.standings(200, 0, "You", 8);
    const save = new SaveData();
    // Won.
    const won = s.place === 1;
    const res = save.recordDuelResult(won, "2026-09-17");
    expect(Number.isFinite(res.delta)).toBe(true);
    // Abandoned short of the line = loss.
    const dnf = save.recordDuelResult(false, "2026-09-17");
    expect(dnf.delta).toBeLessThan(0);
    // Duel opponent card (rendered on the results strip) must not throw.
    const foe = duelOpponent(`2026-09-17:2026-09-17`, save.state.rival.rating);
    expect(typeof foe.name).toBe("string");
    terrain.dispose();
  });

  it("runs knockout elimination to a sole survivor without throwing", () => {
    const { terrain, mr } = raceField("2026-09-18");
    stepField(mr, terrain, 4000, 2);
    let eliminated = 0;
    // Repeatedly eliminate the trailing pilot until one local remains,
    // mirroring the pvp_knockout countdown loop.
    for (let i = 0; i < 60; i++) {
      const standings = mr.standings(9999, 0, "You", 40);
      if (standings.total - eliminated <= 1) break;
      const victim = mr.eliminateTrailing(500);
      if (!victim) break;
      eliminated++;
    }
    const final = mr.standings(9999, 0, "You", 40);
    expect(final.total).toBeGreaterThanOrEqual(1);
    // Sole-survivor victory branch math.
    const save = new SaveData();
    expect(save.noteRacePlace(1, final.total)).toBe(true);
    terrain.dispose();
  });

  it("absorbs hostile finish/emote/state frames around the finish line without throwing", () => {
    const { terrain, mr } = raceField("2026-09-19");
    const frames: HostileFrame[] = [
      // Emote payload that is also a valid remote snapshot: oversized, control-laden.
      { id: "hacker-1", name: "Bad\nPlayer\u0000", x: 1234.5, y: 8, rotation: 0.2 },
      // Non-finite coordinates (replay tamper).
      { id: "hacker-2", name: "NaN", x: NaN, y: Infinity, rotation: NaN },
      // Empty id (must not promote a phantom rival).
      { id: "", name: "Ghost", x: 50, y: 10, rotation: 0 },
      // A remote that "finishes" with a bogus place far past the line.
      { id: "hacker-3", name: "Cheese", x: 999999, y: 1, rotation: 0, finished: true },
    ];
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => frames,
    });
    for (let i = 0; i < 300; i++) mr.step(1 / 60, terrain, 1500, i / 60);
    // No NaN leaked into any rival's sim state.
    for (const r of mr.rivals) {
      expect(Number.isFinite(r.bird.x)).toBe(true);
      expect(Number.isFinite(r.bird.y)).toBe(true);
    }
    // Roster + standings + emotes render inputs stay finite after the barrage.
    const roster = mr.roster(1501, 0, 1500, "You");
    expect(roster.length).toBe(41);
    for (const row of roster) expect(Number.isFinite(row.progress)).toBe(true);
    const s = mr.standings(1501, 0, "You", 41);
    expect(s.total).toBe(41);
    terrain.dispose();
  });

  it("hides the rival pack at run end (no step, no draw) and re-seeds on the next run", () => {
    const { terrain, mr } = raceField("2026-09-20");
    stepField(mr, terrain, 1500, 2);
    expect(mr.active).toBe(true);
    // The finishRun() fix: hide the group the moment the run is recorded.
    mr.group.visible = false;
    expect(mr.active).toBe(false);
    const frozen = mr.rivals[0]!.bird.x;
    // A hidden pack must be a full no-op: no physics, no remote application.
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => [{ id: "ai-0", name: "Late", x: 5555, y: 5, rotation: 0 }],
    });
    mr.step(1 / 60, terrain, 1500, 2.01);
    mr.syncVisual(1 / 60, 100);
    expect(mr.rivals[0]!.bird.x).toBeCloseTo(frozen, 3);
    // The next startRun() re-seeds: visible again with a full field.
    mr.spawn(40, "2026-09-20:pvp_sprint:40", terrain, 0);
    expect(mr.active).toBe(true);
    expect(mr.group.visible).toBe(true);
    expect(mr.rivals.length).toBe(40);
    terrain.dispose();
  });

  it("keeps rating math total: every place/field combo yields a finite delta", () => {
    for (let field = 2; field <= 41; field += 3) {
      for (let place = 1; place <= field; place += 5) {
        const d = ratingDelta(place, field, true);
        expect(Number.isFinite(d)).toBe(true);
      }
    }
  });
});
