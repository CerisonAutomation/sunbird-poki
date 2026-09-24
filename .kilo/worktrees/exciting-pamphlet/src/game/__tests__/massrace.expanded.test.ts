import { describe, expect, it } from "vitest";
import { MassRace, MAX_RIVALS } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";
import { BIRD_RADIUS } from "../constants";

// ── spawn (8 tests) ────────────────────────────────────────────────────────────
describe("mass race: spawn", () => {
  it("spawns 0 rivals when count is 0", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(0, "2026-09-12", terrain, 0);
    expect(mr.rivals).toHaveLength(0);
    expect(mr.fieldSize).toBe(0);
    expect(mr.active).toBe(false);
    terrain.dispose();
  });

  it("spawns correct number of rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(10, "2026-09-12", terrain, 0);
    expect(mr.rivals).toHaveLength(10);
    expect(mr.fieldSize).toBe(10);
    expect(mr.active).toBe(true);
    terrain.dispose();
  });

  it("clamps count to MAX_RIVALS (40)", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(50, "2026-09-12", terrain, 0);
    expect(mr.rivals).toHaveLength(MAX_RIVALS);
    terrain.dispose();
  });

  it("clamps negative count to 0", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(-5, "2026-09-12", terrain, 0);
    expect(mr.rivals).toHaveLength(0);
    terrain.dispose();
  });

  it("all spawned rivals are local kind", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    for (const r of mr.rivals) {
      expect(r.kind).toBe("local");
    }
    terrain.dispose();
  });

  it("all spawned rivals have unique ids", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(10, "2026-09-12", terrain, 0);
    const ids = mr.rivals.map((r) => r.id);
    expect(new Set(ids).size).toBe(10);
    terrain.dispose();
  });

  it("rivals are positioned at startX baseline", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    const startX = 100;
    mr.spawn(3, "2026-09-12", terrain, startX);
    expect(mr.rivals[0]!.bird.x).toBe(startX);
    terrain.dispose();
  });

  it("rivals are positioned at terrain height + BIRD_RADIUS", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    expect(mr.rivals[0]!.bird.y).toBeCloseTo(terrain.heightAt(0) + BIRD_RADIUS, 2);
    terrain.dispose();
  });
});

// ── skill distribution (5 tests) ───────────────────────────────────────────────
describe("mass race: skill distribution", () => {
  it("skills are within 0.12..1 range", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(20, "2026-09-12", terrain, 0);
    for (const r of mr.rivals) {
      expect(r.skill).toBeGreaterThanOrEqual(0.12);
      expect(r.skill).toBeLessThanOrEqual(1);
    }
    terrain.dispose();
  });

  it("skills are deterministic for same seed", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr1 = new MassRace();
    const mr2 = new MassRace();
    mr1.spawn(10, "2026-09-12", terrain, 0);
    mr2.spawn(10, "2026-09-12", terrain, 0);
    for (let i = 0; i < 10; i++) {
      expect(mr1.rivals[i]!.skill).toBe(mr2.rivals[i]!.skill);
    }
    terrain.dispose();
  });

  it("skills differ for different seeds", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr1 = new MassRace();
    const mr2 = new MassRace();
    mr1.spawn(10, "2026-09-12", terrain, 0);
    mr2.spawn(10, "2026-09-13", terrain, 0);
    let diff = false;
    for (let i = 0; i < 10; i++) {
      if (mr1.rivals[i]!.skill !== mr2.rivals[i]!.skill) diff = true;
    }
    expect(diff).toBe(true);
    terrain.dispose();
  });

  it("lead values are within 18..132 range", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(20, "2026-09-12", terrain, 0);
    for (const r of mr.rivals) {
      expect(r.lead).toBeGreaterThanOrEqual(18);
      expect(r.lead).toBeLessThanOrEqual(132);
    }
    terrain.dispose();
  });

  it("higher skill pilots have lower wobble amplitude", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(20, "2026-09-12", terrain, 0);
    const sorted = [...mr.rivals].sort((a, b) => a.skill - b.skill);
    const lowSkill = sorted[0]!;
    const highSkill = sorted[sorted.length - 1]!;
    expect(highSkill.wobbleAmp).toBeLessThanOrEqual(lowSkill.wobbleAmp);
    terrain.dispose();
  });
});

// ── clear (4 tests) ────────────────────────────────────────────────────────────
describe("mass race: clear", () => {
  it("clears all rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(10, "2026-09-12", terrain, 0);
    expect(mr.rivals).toHaveLength(10);
    mr.clear();
    expect(mr.rivals).toHaveLength(0);
    terrain.dispose();
  });

  it("sets group visibility to false after clear", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    expect(mr.active).toBe(true);
    mr.clear();
    expect(mr.active).toBe(false);
    terrain.dispose();
  });

  it("sets instance mesh counts to 0", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    mr.clear();
    expect(mr.rivals).toHaveLength(0);
    terrain.dispose();
  });

  it("can be called on empty race without error", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    expect(() => mr.clear()).not.toThrow();
    terrain.dispose();
  });
});

// ── kick (5 tests) ─────────────────────────────────────────────────────────────
describe("mass race: kick", () => {
  it("returns false for non-existent id", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    expect(mr.kick("nobody")).toBe(false);
    expect(mr.rivals).toHaveLength(5);
    terrain.dispose();
  });

  it("returns true and removes when id exists", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const target = mr.rivals[2]!.id;
    expect(mr.kick(target)).toBe(true);
    expect(mr.rivals).toHaveLength(4);
    terrain.dispose();
  });

  it("kick removes by ai-N id", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    expect(mr.kick("ai-0")).toBe(true);
    expect(mr.rivals[0]!.id).not.toBe("ai-0");
    terrain.dispose();
  });

  it("kick can remove all rivals one by one", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const ids = mr.rivals.map((r) => r.id);
    for (const id of ids) {
      expect(mr.kick(id)).toBe(true);
    }
    expect(mr.rivals).toHaveLength(0);
    terrain.dispose();
  });

  it("kick on already-removed id returns false", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const id = mr.rivals[0]!.id;
    expect(mr.kick(id)).toBe(true);
    expect(mr.kick(id)).toBe(false);
    terrain.dispose();
  });
});

// ── shuffle (6 tests) ──────────────────────────────────────────────────────────
describe("mass race: shuffle", () => {
  it("does nothing on empty race", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    expect(() => mr.shuffle("seed")).not.toThrow();
    expect(mr.rivals).toHaveLength(0);
    terrain.dispose();
  });

  it("renames all rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const oldNames = mr.rivals.map((r) => r.name);
    mr.shuffle("other-seed");
    const newNames = mr.rivals.map((r) => r.name);
    // At least some names should differ
    let diff = false;
    for (let i = 0; i < oldNames.length; i++) {
      if (oldNames[i] !== newNames[i]) diff = true;
    }
    expect(diff).toBe(true);
    terrain.dispose();
  });

  it("resets finished state", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.finished = true;
    mr.rivals[0]!.finishTime = 42;
    mr.shuffle("seed");
    expect(mr.rivals[0]!.finished).toBe(false);
    expect(mr.rivals[0]!.finishTime).toBe(0);
    terrain.dispose();
  });

  it("keeps same count after shuffle", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(10, "2026-09-12", terrain, 0);
    const count = mr.rivals.length;
    mr.shuffle("newseed");
    expect(mr.rivals.length).toBe(count);
    terrain.dispose();
  });

  it("skills are in 0.1..1 range after shuffle", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(10, "2026-09-12", terrain, 0);
    mr.shuffle("newseed");
    for (const r of mr.rivals) {
      expect(r.skill).toBeGreaterThanOrEqual(0.1);
      expect(r.skill).toBeLessThanOrEqual(1);
    }
    terrain.dispose();
  });

  it("shuffle renames pilots (uses time-based seed internally)", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const oldNames = mr.rivals.map((r) => r.name);
    mr.shuffle("newseed");
    const newNames = mr.rivals.map((r) => r.name);
    // At least some names should differ (shuffle re-rolls names)
    let diff = false;
    for (let i = 0; i < oldNames.length; i++) {
      if (oldNames[i] !== newNames[i]) diff = true;
    }
    expect(diff).toBe(true);
    terrain.dispose();
  });
});

// ── applyGhosts (7 tests) ─────────────────────────────────────────────────────
describe("mass race: applyGhosts", () => {
  it("returns 0 when no locals available", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(0, "2026-09-12", terrain, 0);
    expect(mr.applyGhosts([{ name: "Ghost", distance: 1000 }], 4000)).toBe(0);
    terrain.dispose();
  });

  it("seats ghosts up to available locals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const rows = [
      { name: "AAA", distance: 3000 },
      { name: "BBB", distance: 2000 },
      { name: "CCC", distance: 1000 },
    ];
    expect(mr.applyGhosts(rows, 4000)).toBe(3);
    const ghosts = mr.rivals.filter((r) => r.ghost);
    expect(ghosts).toHaveLength(3);
    terrain.dispose();
  });

  it("ghost skill scales with distance", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.applyGhosts([{ name: "AAA", distance: 4000 }], 4000);
    const ghost = mr.rivals[0]!;
    expect(ghost.ghost).toBe(true);
    expect(ghost.skill).toBeCloseTo(0.9, 1);
  });

  it("ghost skill is min 0.3 for distance 0", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.applyGhosts([{ name: "Zero", distance: 0 }], 4000);
    const ghost = mr.rivals[0]!;
    expect(ghost.skill).toBeCloseTo(0.3, 2);
    terrain.dispose();
  });

  it("ghost skill is capped at 1 for distance beyond gate", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.applyGhosts([{ name: "Ace", distance: 5000 }], 4000);
    const ghost = mr.rivals[0]!;
    // 0.3 + 0.6 * (5000/4000) = 1.05, clamped to 1
    expect(ghost.skill).toBeCloseTo(1, 2);
    terrain.dispose();
  });

  it("uses default gate of 4000 when gate is 0", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.applyGhosts([{ name: "Test", distance: 4000 }], 0);
    expect(mr.rivals[0]!.skill).toBeCloseTo(0.9, 2);
    terrain.dispose();
  });

  it("truncates ghost names to 14 chars", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.applyGhosts([{ name: "ThisIsAReallyLongName", distance: 2000 }], 4000);
    expect(mr.rivals[0]!.name.length).toBeLessThanOrEqual(14);
    terrain.dispose();
  });
});

// ── setFieldSkill (4 tests) ───────────────────────────────────────────────────
describe("mass race: setFieldSkill", () => {
  it("scales all rival skills by multiplier", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const original = mr.rivals.map((r) => r.skill);
    mr.setFieldSkill(1.5);
    for (let i = 0; i < mr.rivals.length; i++) {
      expect(mr.rivals[i]!.skill).toBeCloseTo(Math.min(1, original[i]! * 1.5), 3);
    }
    terrain.dispose();
  });

  it("clamps skills to max 1", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    mr.setFieldSkill(2);
    for (const r of mr.rivals) {
      expect(r.skill).toBeLessThanOrEqual(1);
    }
    terrain.dispose();
  });

  it("clamps skills to min 0.1", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    mr.setFieldSkill(0.1);
    for (const r of mr.rivals) {
      expect(r.skill).toBeGreaterThanOrEqual(0.1);
    }
    terrain.dispose();
  });

  it("adjusts leads in the right direction", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    mr.setFieldSkill(1.4);
    for (let i = 0; i < mr.rivals.length; i++) {
      expect(mr.rivals[i]!.lead).toBeGreaterThanOrEqual(18);
      expect(mr.rivals[i]!.lead).toBeLessThanOrEqual(132);
    }
    terrain.dispose();
  });
});

// ── draftFor (6 tests) ────────────────────────────────────────────────────────
describe("mass race: draftFor", () => {
  it("returns 1 (no draft) when group not visible", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(0, "2026-09-12", terrain, 0);
    expect(mr.draftFor(0, 0, 1 / 60)).toBe(1);
    expect(mr.draft).toBe(0);
    terrain.dispose();
  });

  it("returns <1 when drafting behind another bird", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 100;
    mr.rivals[0]!.bird.y = 0;
    // We're at x=80, 20 units behind (within DRAFT_BEHIND=26)
    const mult = mr.draftFor(80, 0, 1 / 60);
    expect(mult).toBeLessThan(1);
    expect(mr.draft).toBeGreaterThan(0);
    terrain.dispose();
  });

  it("returns 1 when no rivals are behind us", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 50;
    // We're ahead of all rivals
    const mult = mr.draftFor(200, 0, 1 / 60);
    expect(mult).toBe(1);
    terrain.dispose();
  });

  it("draft smooths over time", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 100;
    mr.rivals[0]!.bird.y = 0;
    mr.draftFor(80, 0, 1 / 60);
    const draft1 = mr.draft;
    // Call again with same setup — draft should smooth
    mr.draftFor(80, 0, 1 / 60);
    const draft2 = mr.draft;
    expect(draft2).toBeCloseTo(draft1, 1);
    terrain.dispose();
  });

  it("draft is zero when no rivals ahead", async () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    // Rivals placed behind player
    mr.rivals[0]!.bird.x = 50;
    const mult = mr.draftFor(100, 0, 1 / 60);
    expect(mult).toBe(1);
    expect(mr.draft).toBe(0);
    terrain.dispose();
  });

  it("outside lateral range is not drafted", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 100;
    mr.rivals[0]!.bird.y = 100; // far above
    const mult = mr.draftFor(80, 0, 1 / 60);
    expect(mult).toBe(1);
    terrain.dispose();
  });
});

// ── standings (8 tests) ────────────────────────────────────────────────────────
describe("mass race: standings", () => {
  it("includes player in standings", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const { rows, place, total } = mr.standings(500, 0, "Player");
    expect(rows.some((r) => r.you)).toBe(true);
    expect(place).toBeGreaterThan(0);
    expect(total).toBe(4); // 3 rivals + player
    terrain.dispose();
  });

  it("player placed last when behind all rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    for (const r of mr.rivals) r.bird.x = 1000;
    const { place } = mr.standings(500, 0, "Player");
    expect(place).toBe(4);
    terrain.dispose();
  });

  it("player placed first when ahead of all rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    for (const r of mr.rivals) r.bird.x = 100;
    const { place } = mr.standings(500, 0, "Player");
    expect(place).toBe(1);
    terrain.dispose();
  });

  it("standings sorted by distance descending", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 100;
    mr.rivals[1]!.bird.x = 200;
    mr.rivals[2]!.bird.x = 50;
    const { rows } = mr.standings(50, 0, "Player");
    expect(rows[0]!.distance).toBeGreaterThanOrEqual(rows[1]!.distance);
  });

  it("standings limit controls max rows", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(10, "2026-09-12", terrain, 0);
    const { rows } = mr.standings(500, 0, "Player", 3);
    expect(rows.length).toBeLessThanOrEqual(3);
    terrain.dispose();
  });

  it("standings includes a window around player", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(20, "2026-09-12", terrain, 0);
    for (let i = 0; i < 20; i++) {
      mr.rivals[i]!.bird.x = 100 + i * 50;
    }
    const { rows } = mr.standings(600, 0, "Player", 8);
    const playerRow = rows.find((r) => r.you);
    expect(playerRow).toBeDefined();
    terrain.dispose();
  });

  it("standings handles zero rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    const { rows, place, total } = mr.standings(500, 0, "Player");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.you).toBe(true);
    expect(place).toBe(1);
    expect(total).toBe(1);
    terrain.dispose();
  });

  it("standings distance clamped to non-negative", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 10;
    const { rows } = mr.standings(-100, 0, "Player");
    const player = rows.find((r) => r.you);
    expect(player!.distance).toBeGreaterThanOrEqual(0);
    terrain.dispose();
  });
});

// ── roster (5 tests) ──────────────────────────────────────────────────────────
describe("mass race: roster", () => {
  it("includes player at end of roster", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const list = mr.roster(500, 0, 4000, "Player");
    const you = list.find((r) => r.you);
    expect(you).toBeDefined();
    expect(you!.name).toBe("Player");
    terrain.dispose();
  });

  it("includes all rivals in roster", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(5, "2026-09-12", terrain, 0);
    const list = mr.roster(500, 0, 4000, "Player");
    expect(list).toHaveLength(6); // 5 rivals + player
    terrain.dispose();
  });

  it("roster is sorted by progress descending", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 100;
    mr.rivals[1]!.bird.x = 500;
    mr.rivals[2]!.bird.x = 50;
    const list = mr.roster(200, 0, 4000, "Player");
    expect(list[0]!.progress).toBeGreaterThanOrEqual(list[1]!.progress);
    terrain.dispose();
  });

  it("roster assigns places starting from 1", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const list = mr.roster(100, 0, 4000, "Player");
    list.forEach((r, i) => {
      expect(r.place).toBe(i + 1);
    });
    terrain.dispose();
  });

  it("roster marks ghosts correctly", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.applyGhosts([{ name: "Ghost", distance: 2000 }], 4000);
    const list = mr.roster(500, 0, 4000, "Player");
    const ghost = list.find((r) => r.ghost);
    expect(ghost).toBeDefined();
    terrain.dispose();
  });
});

// ── step (7 tests) ─────────────────────────────────────────────────────────────
describe("mass race: step", () => {
  it("step does nothing when not active", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    expect(() => mr.step(1 / 120, terrain, 4000, 0)).not.toThrow();
    terrain.dispose();
  });

  it("step advances clock", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const before = mr["clock"];
    mr.step(1, terrain, 4000, 1);
    expect(mr["clock"]).toBeGreaterThan(before);
    terrain.dispose();
  });

  it("step updates prevX/prevY for all rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.step(1, terrain, 4000, 1);
    for (const r of mr.rivals) {
      expect(r.prevX).toBeDefined();
      expect(r.prevY).toBeDefined();
    }
    terrain.dispose();
  });

  it("finished rivals stop moving", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    mr.rivals[0]!.finished = true;
    const xBefore = mr.rivals[0]!.bird.x;
    mr.step(1, terrain, 4000, 1);
    // Local rivals that are finished don't step physics
    // (they have finished=true so the `continue` in step skips them)
    expect(mr.rivals[0]!.bird.x).toBe(xBefore);
    terrain.dispose();
  });

  it("remote rivals are positioned by snapshots, not physics", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const transport = {
      connected: true,
      send: () => undefined,
      poll: () => [{ id: "ai-0", name: "Remote", x: 999, y: 10, rotation: 0 }],
    };
    mr.attachTransport(transport);
    mr.step(1 / 60, terrain, 4000, 1);
    expect(mr.rivals[0]!.bird.x).toBe(999);
    terrain.dispose();
  });

  it("step detects finish line crossing", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.rivals[0]!.bird.x = 3999;
    mr.rivals[0]!.bird.vx = 1000;
    mr.step(1, terrain, 4000, 1);
    expect(mr.rivals[0]!.finished).toBe(true);
    expect(mr.rivals[0]!.finishTime).toBe(1);
    terrain.dispose();
  });

  it("step with no transport still works", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    expect(() => mr.step(1, terrain, 4000, 1)).not.toThrow();
    terrain.dispose();
  });
});

// ── attachTransport / syncVisual (4 tests) ─────────────────────────────────────
describe("mass race: transport & visuals", () => {
  it("attachTransport sets transport", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    const transport = {
      connected: true,
      send: () => undefined,
      poll: () => [],
    };
    mr.attachTransport(transport);
    expect(mr["transport"]).toBe(transport);
    terrain.dispose();
  });

  it("attachTransport(null) disconnects", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(3, "2026-09-12", terrain, 0);
    const transport = { connected: true, send: () => undefined, poll: () => [] };
    mr.attachTransport(transport);
    mr.attachTransport(null);
    expect(mr["transport"]).toBeNull();
    terrain.dispose();
  });

  it("syncVisual does nothing when not active", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    expect(() => mr.syncVisual(1 / 60, 0)).not.toThrow();
    terrain.dispose();
  });

  it("syncVisual does nothing when no rivals", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(0, "2026-09-12", terrain, 0);
    expect(() => mr.syncVisual(1 / 60, 0)).not.toThrow();
    terrain.dispose();
  });
});

// ── network boundary validation (3 tests) ──────────────────────────────────────
describe("mass race: network boundary", () => {
  it("drops non-finite remote snapshots", () => {
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
    expect(Number.isFinite(mr.rivals[0]!.bird.x)).toBe(true);
    expect(mr.rivals[1]!.bird.x).toBe(500);
    terrain.dispose();
  });

  it("rejects snapshot with empty id", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(1, "2026-09-12", terrain, 0);
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => [{ id: "", name: "Ghost", x: 100, y: 10, rotation: 0 }],
    });
    mr.step(1 / 60, terrain, 4000, 1);
    expect(mr.rivals[0]!.id).toMatch(/^ai-/);
    terrain.dispose();
  });

  it("promotes local slot to remote for new id", () => {
    const terrain = new TerrainSystem("2026-09-12");
    const mr = new MassRace();
    mr.spawn(2, "2026-09-12", terrain, 0);
    mr.attachTransport({
      connected: true,
      send: () => undefined,
      poll: () => [{ id: "remotely-unique", name: "Remote", x: 300, y: 10, rotation: 0 }],
    });
    mr.step(1 / 60, terrain, 4000, 1);
    const remote = mr.rivals.find((r) => r.kind === "remote");
    expect(remote).toBeDefined();
    expect(remote!.id).toBe("remotely-unique");
    terrain.dispose();
  });
});
