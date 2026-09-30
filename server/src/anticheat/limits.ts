// Mirrors src/game/AntiCheat.ts. These are not independent choices: the server
// is the side that actually decides whether a run is stored, so a client that
// is more permissive than this file silently loses honest runs, and one that is
// stricter drops them before they are ever sent.
//
// `maxAvgSpeedMps` is MAX_SPEED_FEVER (128) * MAX_SKIN_SPEED_MULT (1.08) *
// ENDLESS_SPEED_SCALE_MAX (1.55) + BOOST_EXTRA_SPEED (42) = 256.272 — the
// ceiling `Bird.step` can actually produce at fever, with the fastest skin in a
// long escalating run, and a boost. `minMsPer100m` is its reciprocal.
//
// These sat at 120 / 500 while the game could legally fly at 170 and is now
// legal to fly at 256, so the server was the binding constraint the whole time
// and rejected runs the game had already accepted. `anticheat.test.ts` reads
// this file and compares it against the client constants, so the pair cannot
// drift apart again.
export const LIMITS = {
  maxAvgSpeedMps: 256.272,
  minMsPer100m: 390.2,
  scoreDensityFactor: 1000,
  scoreDensityBase: 100_000,
};
