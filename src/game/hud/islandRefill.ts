import { CLIMB_REFILL_MULT, DAYLIGHT_ISLAND_REFILL_FRACTION } from "../constants";

export interface IslandEntryInput {
  /** The island the bird is over right now. */
  idx: number;
  /** The furthest island already PAID OUT. Not the furthest island seen. */
  lastIsland: number;
  /** Is the bird flying this island, rather than splashing across it? */
  airborne: boolean;
  daylight: number;
  daylightMax: number;
  /** 0..1 — how much relief this biome's wall grants on the refill. */
  climbRelief: number;
}

export interface IslandEntry {
  /** A new island was entered, celebration or not. */
  entered: boolean;
  /** This island's daylight (and Climb Breaker) has been paid out. */
  consumed: boolean;
  /** The daylight to carry forward. */
  daylight: number;
}

/**
 * What happens when the bird's island index moves forward.
 *
 * Two things were wrong here, and both read to the player as "the sun doesn't
 * come back on the next island".
 *
 * 1. The payout was a flat 15 seconds against a cap that is not 15-shaped.
 *    `daylightMax()` grows every island — the Climb Breaker adds to
 *    `climbDaylight`, sun flasks add to `boostDaylight`, gold and perks raise
 *    the base — while the refill stayed 15. Measured on a live flight that had
 *    taken boosts, the cap had reached ~141 and the refill had shrunk to 10.6%
 *    of the meter: the player crossed an island and nothing appeared to
 *    happen, against a results card that promises "Each new island refills it".
 *    The payout is therefore a SHARE of the cap. At base stats it is
 *    0.29 x 52 = 15.1, which rounds to the 15 it always was, so an unupgraded
 *    run is unchanged.
 *
 * 2. The island was marked consumed on the frame it was ENTERED, before the
 *    airborne gate. Crossing a boundary in the water — or above the refill
 *    ceiling — consumed the island and paid nothing. There was no recovery:
 *    coming back westbound makes `idx` smaller, so `idx > lastIsland` is false
 *    and the island is unreachable for the rest of the run. The toast still
 *    said you had reached the island.
 *
 * So `lastIsland` is the "already paid out" marker and it only moves on the
 * frame the island is actually flown. Everything here is arithmetic on plain
 * numbers, which is what makes it assertable: jsdom performs no layout, and
 * this decision used to be reachable only by flying 1,900 m in a real browser.
 */
export function islandEntry(input: IslandEntryInput): IslandEntry {
  const { idx, lastIsland, airborne, daylight, daylightMax, climbRelief } = input;
  if (idx <= lastIsland) return { entered: false, consumed: false, daylight };
  if (!airborne) return { entered: true, consumed: false, daylight };
  const refill = Math.round(daylightMax * DAYLIGHT_ISLAND_REFILL_FRACTION * (1 + climbRelief * CLIMB_REFILL_MULT));
  return {
    entered: true,
    consumed: true,
    // The cap still wins: an island cannot hand back more than a full day.
    daylight: Math.min(daylightMax, daylight + refill),
  };
}