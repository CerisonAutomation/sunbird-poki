import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BOARD_METRICS, type BoardMetric, metricsToPublish } from "../Leaderboard";

/**
 * A run is worth publishing to the public board only when it beat the
 * device's PREVIOUS best on a metric. Two independent defects made the Poki
 * edition's global board permanently empty, and neither was visible in a
 * screenshot of the working local board:
 *
 *  1. `submit()` sampled the personal bests AFTER persisting the row being
 *     judged. `localBestByDevice()` scans the local store, so the sample
 *     already contained that row: `prev >= v` held for every metric, and
 *     `v <= prev` skipped the whole publish loop. Not one metric ever reached
 *     AUDS.
 *  2. The publish loop listed four of the five `BoardMetric` values — `score`
 *     was missing — while the board screen rendered a "Score" tab. A tab
 *     backed by nothing.
 *
 * The live suite (`board-live.test.ts`) could not catch either: it only runs
 * against the HTTP reference server, and `build:poki` sets
 * `VITE_LEADERBOARD_URL=`, so on the shipped edition the AUDS branch is the
 * only one that ever executes.
 */

const row = {
  distance: 5000,
  altitude: 200,
  perfects: 12,
  coins: 70,
  score: 9800,
};

/**
 * Compile-time adjacency to `BOARD_METRICS`. If a metric is added to the
 * `BoardMetric` union and not to the array, this type becomes non-empty and
 * the assertion below fails — rather than a new tab quietly rendering over an
 * unwritten board.
 */
type MissingFromBoardMetrics = Exclude<BoardMetric, (typeof BOARD_METRICS)[number]>;
const missingFromBoardMetrics: MissingFromBoardMetrics[] = [];

const best = (overrides: Partial<Record<BoardMetric, number>> = {}): Map<BoardMetric, number> =>
  new Map<BoardMetric, number>(Object.entries(overrides) as [BoardMetric, number][]);

describe("metricsToPublish", () => {
  it("covers every BoardMetric — the union is the only list to edit", () => {
    expect(missingFromBoardMetrics).toEqual([]);
    expect([...BOARD_METRICS].sort()).toEqual(
      ["altitude", "coins", "distance", "perfects", "score"].sort(),
    );
  });

  it("publishes a first-ever run on every metric", () => {
    // No previous bests at all: a new device's first run sets every board.
    expect(metricsToPublish(row, best()).sort()).toEqual([...BOARD_METRICS].sort());
  });

  it("publishes only the metrics the run actually beat", () => {
    // Beat distance and score; altitude, perfects and coins were already
    // higher, so publishing them would just re-write the same best row.
    const published = metricsToPublish(row, best({ distance: 4000, score: 9000, altitude: 999, perfects: 99, coins: 999 }));
    expect(published.sort()).toEqual(["distance", "score"]);
  });

  it("publishes nothing when the run beat nothing", () => {
    expect(metricsToPublish(row, best({ distance: 5000, altitude: 200, perfects: 12, coins: 70, score: 9800 }))).toEqual([]);
  });

  it("returns nothing when the 'previous' best already includes the row itself", () => {
    // This is the trap, pinned so the sampling order cannot be moved back.
    // A `previousBest` that already contains `row` reports prev === v for
    // every metric, so the whole board goes quiet — with no error anywhere.
    const contaminated = best({ distance: 5000, altitude: 200, perfects: 12, coins: 70, score: 9800 });
    expect(metricsToPublish(row, contaminated)).toEqual([]);
  });
});

/**
 * Removes comments so a lexical ordering check can only ever match real code.
 *
 * This is load-bearing, not a nicety. `submit()` carries a doc comment that
 * explains why the order matters and names both calls by name while doing so.
 * Against the raw text, `indexOf("localBestByDevice()")` and
 * `indexOf("writeLocal(rows)")` both resolve to the *prose* — so the guard
 * reported success while describing the broken arrangement it exists to
 * prevent, and would have kept doing so after the code regressed.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

describe("submit() samples personal bests before it persists the run", () => {
  // A behavioural test cannot reach this: `submit()` only publishes when AUDS
  // is configured, which needs `VITE_POKI_GAME_ID` and so never holds under
  // `pnpm test`. The invariant is purely lexical, and lexical is what broke.
  const source = readFileSync(join(process.cwd(), "src/game/Leaderboard.ts"), "utf8");
  const submitBody = stripComments(
    source.slice(source.indexOf("  submit(sub: ScoreSubmission): void {")),
  );

  it("reads the bests before the write that would fold this run into them", () => {
    const sample = submitBody.search(/\blocalBestByDevice\s*\(/);
    const write = submitBody.search(/\bwriteLocal\s*\(\s*rows\s*\)/);
    expect(sample, "submit() no longer samples personal bests").toBeGreaterThan(-1);
    expect(write, "submit() no longer persists the run").toBeGreaterThan(-1);
    expect(
      sample,
      "localBestByDevice() must be sampled BEFORE writeLocal(rows); sampling after makes the publish loop a guaranteed no-op",
    ).toBeLessThan(write);
  });
});
