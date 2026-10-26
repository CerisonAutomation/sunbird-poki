import { describe, expect, it } from "vitest";
import { MassRace, MAX_RIVALS, leadRangeForSkill, reactionRangeForSkill, wobbleForSkill } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";

const build = (seed = "coherence"): { race: MassRace; terrain: TerrainSystem } => {
  const terrain = new TerrainSystem(seed);
  const race = new MassRace();
  race.spawn(MAX_RIVALS, seed, terrain, 50);
  return { race, terrain };
};

const teardown = (race: MassRace, terrain: TerrainSystem): void => {
  race.clear();
  terrain.dispose();
};

/**
 * A rival's rating and its flying must never disagree.
 *
 * `spawn()` derived `lead`, `wobbleAmp` and `reaction` from `skill` inline,
 * and every other path that changed skill — `shuffle()`, `setFieldSkill()` —
 * moved the number and left the behaviour behind. A 0.95 pilot could drift
 * with a tail-pack wobble; the difficulty dial moved the standings without
 * moving the racing. In a race whose only feedback is "who is ahead of me",
 * an opponent that does not fly like its rating is indistinguishable from one
 * that cheats.
 */
describe("rival behaviour follows rival skill", () => {
  const coherent = (race: MassRace): void => {
    for (const r of race.rivals) {
      // wobble is a pure function of skill: check it exactly.
      expect(wobbleForSkill(r.skill), `${r.id} wobble does not match skill ${r.skill}`)
        .toBeCloseTo(r.wobbleAmp, 6);
      // lead and reaction carry a seeded jitter, so check the envelope. The
      // envelope is exported alongside the derivation, so this asserts
      // against the formula rather than against a copy of it.
      const [leadLo, leadHi] = leadRangeForSkill(r.skill);
      expect(r.lead, `${r.id} lead ${r.lead} outside its skill band`).toBeGreaterThanOrEqual(leadLo - 1e-9);
      expect(r.lead).toBeLessThanOrEqual(leadHi + 1e-9);
      const [reactLo, reactHi] = reactionRangeForSkill(r.skill, r.archetype);
      expect(r.reaction, `${r.id} reaction outside its skill band`).toBeGreaterThanOrEqual(reactLo - 1e-9);
      expect(r.reaction).toBeLessThanOrEqual(reactHi + 1e-9);
    }
  };

  it("holds right after spawn", () => {
    const { race, terrain } = build();
    coherent(race);
    teardown(race, terrain);
  });

  it("still holds after a shuffle", () => {
    const { race, terrain } = build();
    race.shuffle("re-roll");
    coherent(race);
    teardown(race, terrain);
  });

  it("still holds after the difficulty dial moves", () => {
    const { race, terrain } = build();
    race.setFieldSkill(1.3);
    coherent(race);
    race.setFieldSkill(0.7);
    coherent(race);
    teardown(race, terrain);
  });

  it("the difficulty dial actually changes the flying, not just the rating", () => {
    const { race, terrain } = build();
    const before = race.rivals.map((r) => ({ skill: r.skill, wobble: r.wobbleAmp }));
    race.setFieldSkill(1.4);
    let steadier = 0;
    race.rivals.forEach((r, i) => {
      if (r.skill > before[i]!.skill && r.wobbleAmp < before[i]!.wobble) steadier += 1;
    });
    // Harder rivals must fly tighter, not merely score higher.
    expect(steadier).toBeGreaterThan(MAX_RIVALS / 2);
    teardown(race, terrain);
  });
});

/**
 * `shuffle()` seeded itself with `` `${seed}:shuffle:${Date.now() % 100000}` ``
 * — a wall-clock term inside a seeded RNG. The same race seed produced a
 * different field every call, so two players given one seed met different
 * opponents and a replay could not reproduce its own race.
 */
describe("the field is reproducible from its seed", () => {
  const fingerprint = (race: MassRace): string =>
    race.rivals.map((r) => `${r.name}|${r.skill.toFixed(6)}|${r.hue.toFixed(6)}`).join(",");

  it("the same seed shuffles to the same field, twice", () => {
    const a = build("determinism");
    const b = build("determinism");
    a.race.shuffle("round-1");
    b.race.shuffle("round-1");
    expect(fingerprint(a.race)).toBe(fingerprint(b.race));
    teardown(a.race, a.terrain);
    teardown(b.race, b.terrain);
  });

  it("a different seed gives a genuinely different field", () => {
    const a = build("determinism");
    const b = build("determinism");
    a.race.shuffle("round-1");
    b.race.shuffle("round-2");
    expect(fingerprint(a.race)).not.toBe(fingerprint(b.race));
    teardown(a.race, a.terrain);
    teardown(b.race, b.terrain);
  });
});

/**
 * `spawn()` builds a deliberate three-tier field: 15% elites to chase, 25%
 * strong, 60% approachable. `shuffle()` replaced that with
 * `rng.next() * 0.9 + 0.1` — uniform noise — so a reshuffled race had no top
 * end and no tail, just forty pilots of indistinguishable middling ability.
 */
describe("a reshuffled race is still a race", () => {
  const shape = (race: MassRace): { elites: number; tail: number; spread: number } => {
    const skills = race.rivals.map((r) => r.skill);
    return {
      elites: skills.filter((s) => s >= 0.85).length,
      tail: skills.filter((s) => s <= 0.5).length,
      spread: Math.max(...skills) - Math.min(...skills),
    };
  };

  it("keeps a top end to chase and a tail to overtake", () => {
    const { race, terrain } = build();
    const spawned = shape(race);
    race.shuffle("re-roll");
    const shuffled = shape(race);

    expect(shuffled.elites, "the reshuffled field has no elites left").toBeGreaterThan(2);
    expect(shuffled.tail, "the reshuffled field has no tail left").toBeGreaterThan(8);
    // The curve survives the re-roll rather than collapsing toward the mean.
    expect(shuffled.spread).toBeGreaterThan(spawned.spread * 0.7);
    teardown(race, terrain);
  });

  it("does not leave the elites in the same grid slots every time", () => {
    const { race, terrain } = build();
    race.shuffle("round-1");
    const first = race.rivals.map((r) => r.skill >= 0.85);
    race.shuffle("round-2");
    const second = race.rivals.map((r) => r.skill >= 0.85);
    expect(first).not.toEqual(second);
    teardown(race, terrain);
  });
});
