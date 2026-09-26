/**
 * Per-biome identity: can you tell the nine worlds apart with your eyes shut?
 *
 * `BIOME_MIX` used to carry only *level* — bpm, cutoff, transposition and five
 * voice weights. The band's supporting voices (arp, organ, pad, spark) were
 * either borrowed from the bell weight or not weighted at all, which meant all
 * nine worlds played the same pads, organs and arpeggios and could only be told
 * apart by how loud and how fast they were. That is what "the same loop turned
 * up" sounds like.
 *
 * These cases are pure data, no audio graph: the point is that the table itself
 * carries an identity, so the property survives any later retune of the engine.
 * The graph-level guarantee that the bells never overtake the tune is already
 * pinned in `arcade-music.test.ts`, and it runs over these same weights.
 */
import { describe, expect, it } from "vitest";

import { BIOME_MIX, musicCutoff, type BiomeMix, type BiomeMusicStyle } from "../Music";

const STYLES = Object.keys(BIOME_MIX) as BiomeMusicStyle[];

/** The voices that give a world its colour, and the range they stay inside. */
const TIMBRE: ReadonlyArray<{ key: keyof BiomeMix; min: number; max: number }> = [
  { key: "arp", min: 0.4, max: 1.4 },
  { key: "organ", min: 0.55, max: 1.45 },
  { key: "pad", min: 0.55, max: 1.5 },
  { key: "spark", min: 0.5, max: 1.5 },
];

describe("BIOME_MIX: every world is a place, not a volume", () => {
  it("covers every style exactly once", () => {
    expect(STYLES).toHaveLength(9);
    expect(new Set(STYLES).size).toBe(9);
  });

  it("gives the nine worlds nine distinct timbres", () => {
    // The regression this guards: with `organ` and `pad` unweighted, every row
    // carried the same bed and the only difference between Midnight Coast and
    // Green Hills was tempo and cutoff. Distinctness is measured over the
    // timbre vector, so a row that quietly returns to the stock bed fails here
    // even though nothing about it looks wrong on its own.
    const signatures = STYLES.map((style) =>
      TIMBRE.map(({ key }) => BIOME_MIX[style][key].toFixed(2)).join(","),
    );
    expect(new Set(signatures).size, "two worlds share a timbre").toBe(STYLES.length);
  });

  it("keeps every timbre weight inside its authored range", () => {
    for (const style of STYLES) {
      for (const { key, min, max } of TIMBRE) {
        const value = BIOME_MIX[style][key];
        expect(value, `${style}.${key} = ${value}`).toBeGreaterThanOrEqual(min);
        expect(value, `${style}.${key} = ${value}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("matches the identity the gameplay lane gives each world", () => {
    // Each row is a deliberate reading of `Biomes.ts`, not a spread of numbers.
    // If the gameplay lane renames or repurposes a world, this is the line that
    // has to change with it.
    const expect_ = (style: BiomeMusicStyle, higher: keyof BiomeMix, lower: keyof BiomeMix): void => {
      expect(BIOME_MIX[style][higher], `${style}: ${String(higher)} > ${String(lower)}`)
        .toBeGreaterThan(BIOME_MIX[style][lower]);
    };
    expect_("wide", "pad", "arp");        // Dune Sea: colossal horizon, little inner motion
    expect_("ember", "organ", "pad");     // Cinder Forge: the organ is the furnace
    expect_("crystal", "spark", "organ"); // Aurora Peaks: glass, not weight
    expect_("airy", "arp", "organ");      // Tropical Atoll: floating
    expect_("night", "pad", "spark");     // Midnight Coast: sparse, everything dim
    expect_("warm", "organ", "spark");    // Sunset Ridge: a warm bed, not a bright one
  });

  it("rebalances the bed in every world rather than pushing it one way", () => {
    // A world is identified by *which* voices it trades, not by a uniform lift.
    // If all four supporting voices moved together the nine rows would be one
    // row nine times — the same failure the arrangement test looks for in
    // phases, and the reason `night` and `crystal` are more than a tempo apart.
    for (const style of STYLES) {
      const voices = TIMBRE.map(({ key }) => BIOME_MIX[style][key]);
      const spread = Math.max(...voices) - Math.min(...voices);
      expect(spread, `${style} moves its bed as one block (${voices.join(", ")})`)
        .toBeGreaterThanOrEqual(0.3);
      // …and no world leaves the arrangement-neutral bed completely alone.
      expect(voices.some((v) => v !== 1), `${style} is the stock bed`).toBe(true);
    }
  });

  it("still honours the upbeat floor and the fever lift", () => {
    for (const style of STYLES) {
      const mix = BIOME_MIX[style];
      expect(mix.bpm, `${style} play tempo`).toBeGreaterThanOrEqual(116);
      expect(mix.fever - mix.bpm, `${style} fever lift`).toBeGreaterThanOrEqual(14);
    }
  });

  it("keeps every world inside a usable filter range at every hour", () => {
    for (const style of STYLES) {
      const { cutoff } = BIOME_MIX[style];
      for (const night of [0, 0.5, 1]) {
        for (const intensity of [0, 0.5, 1]) {
          const value = musicCutoff(cutoff, night, intensity);
          expect(value, `${style} night=${night} i=${intensity}`).toBeGreaterThanOrEqual(500);
          expect(value, `${style} night=${night} i=${intensity}`).toBeLessThanOrEqual(8000);
        }
      }
    }
  });

  it("keeps the bell weight at or under 1, so the bells can never lead", () => {
    // The one hard rule in this table: `glock` is an octave doubling *under*
    // the voice carrying the tune. Values above 1 on the darker biomes made
    // exactly those tracks read as glockenspiel solos.
    for (const style of STYLES) {
      expect(BIOME_MIX[style].glock, `${style}.glock`).toBeLessThanOrEqual(1);
      expect(BIOME_MIX[style].glock, `${style}.glock`).toBeGreaterThan(0);
    }
  });
});
