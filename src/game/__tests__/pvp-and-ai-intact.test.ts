import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MASS_RACE_FIELD, MODES, PVP_MODES, isRaceMode, type ModeId } from "../Modes";
import { MassRace, liveFieldSize, MAX_RIVALS } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";
import { Bird } from "../Bird";

/**
 * PvP AND THE AI RIVAL FIELD ARE LOAD-BEARING. THEY DO NOT GET CUT.
 *
 * This file exists as a standing guard, not because anything was removed —
 * nothing was — but because the two most recent performance passes touched
 * exactly the code a well-meaning optimisation would delete next:
 *
 *   · `Bird.setShadowCasting(false)` is called on every rival, so a future
 *     reader could conclude rivals are "decorative" and start trimming them;
 *   · shared bird geometry made 40 rivals nearly free, which removes the
 *     performance argument that would otherwise justify cutting the field;
 *   · the effect-budget ladder now sheds shadows and particles under load,
 *     and the tempting next step is to shed *rivals* under load instead.
 *
 * Do not. The rival field is the mode. A "mass race" with eight rivals is a
 * different, worse game, and Poki's engagement guidance is built on session
 * length and return rate — which for this game come from racing a full pack.
 *
 * What is allowed to change: how rivals are drawn. What is not: that there are
 * forty of them, that all eight PvP modes exist, and that a rival is a real
 * simulated flier rather than a sprite on a rail.
 */
describe("PvP modes are all present", () => {
  const EXPECTED: ModeId[] = [
    "pvp_sprint",
    "pvp_endurance",
    "pvp_knockout",
    "pvp_draft",
    "pvp_slalom",
    "pvp_typhoon",
    "pvp_zenith",
    "pvp_coinrush",
  ];

  it("ships all eight, by id", () => {
    const shipped = [...PVP_MODES, ...MODES].map((m) => m.id);
    for (const id of EXPECTED) {
      expect(shipped, `PvP mode "${id}" was removed`).toContain(id);
    }
  });

  it("every one of them still routes as a race", () => {
    for (const id of EXPECTED) {
      expect(isRaceMode(id), `"${id}" no longer routes as a race`).toBe(true);
    }
  });

  it("each has the copy a player needs to choose it", () => {
    for (const id of EXPECTED) {
      const mode = PVP_MODES.find((m) => m.id === id)!;
      expect(mode, `${id} is not in PVP_MODES`).toBeDefined();
      expect(mode.name.length, `${id} has no name`).toBeGreaterThan(0);
      expect((mode.blurb ?? "").length, `${id} has no description`).toBeGreaterThan(0);
    }
  });
});

describe("the AI rival field is a full field", () => {
  it("still seats forty", () => {
    // Not "at least a few". Forty. A thinner pack is a different game, and
    // the two constants that say so must not drift apart.
    expect(MAX_RIVALS).toBe(40);
    expect(MASS_RACE_FIELD).toBe(MAX_RIVALS);
  });

  it("actually builds forty simulated fliers", () => {
    const terrain = new TerrainSystem("pvp-intact");
    const race = new MassRace();
    race.spawn(MAX_RIVALS, "guard-seed", terrain, 50);
    expect(race.rivals.length).toBe(MAX_RIVALS);
    // Each one is a real Bird with its own state, not a shared puppet.
    const births = new Set(race.rivals.map((r) => r.bird));
    expect(births.size).toBe(MAX_RIVALS);
        race.clear();
        terrain.dispose();
      });
    
      it("keeps a LIVE room inside the 2-40 real-user band", () => {
        // A live grid is made of PEOPLE and `roster()` never includes us, so the
        // clamp has to stop one short of MAX_RIVALS: you plus 39 remotes is a
        // 40-pilot room. A 41st seated human would be a 41st bird on the grid.
        expect(liveFieldSize(39) + 1).toBe(40);
        expect(liveFieldSize(40) + 1).toBe(40);
        expect(liveFieldSize(1000) + 1).toBe(40);
        // Two is the floor that makes a live room a race rather than a time trial:
        // one remote plus you.
        expect(liveFieldSize(1)).toBe(1);
        expect(liveFieldSize(0)).toBe(1);
      });

  it("rivals are still drawn — not casting shadows is not the same as not existing", () => {
    // `setShadowCasting(false)` keeps them out of the depth pass only. Their
    // meshes stay visible, and their blob shadow (added to the scene, not to
    // the squash group) is untouched, so they still read as grounded.
    const rival = new Bird();
    rival.setShadowCasting(false);

    let visibleMeshes = 0;
    rival.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.visible) visibleMeshes += 1;
    });
    expect(visibleMeshes, "a rival stopped being drawn").toBeGreaterThan(10);
    expect(rival.root.visible).toBe(true);
    rival.dispose();
  });

  it("rivals keep distinct AI, so the pack is a race and not a parade", () => {
    const terrain = new TerrainSystem("pvp-intact-ai");
    const race = new MassRace();
    race.spawn(MAX_RIVALS, "guard-seed", terrain, 50);
    const skills = new Set(race.rivals.map((r) => Math.round(r.skill * 100)));
    const archetypes = new Set(race.rivals.map((r) => r.archetype));
    // A spread of ability and more than one behaviour: this is what makes a
    // finishing position mean something.
    expect(skills.size).toBeGreaterThan(10);
    expect(archetypes.size).toBeGreaterThan(1);
    race.clear();
    terrain.dispose();
  });
});
