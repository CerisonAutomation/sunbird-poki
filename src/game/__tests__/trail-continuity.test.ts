import { describe, expect, it } from "vitest";

import { TrailRibbon } from "../Trail";

/**
 * A trail must be a record of where the bird WAS, contiguously.
 *
 * `Game.updateTrailRibbon` only pushes a sample while `show` is true, and
 * `show` is a speed gate (speed > 48, or fever, or boost). So a player
 * crossing that threshold leaves a gap in the sample stream, and the bird
 * covers a lot of ground across it. The ribbon used to bridge every such gap
 * with a straight quad between the two ends — which at 2.8 km is a line
 * hundreds of units long, arcing over the top of the screen. Crossing the
 * threshold back and forth drew several of them and the world looked like
 * spaghetti.
 *
 * These pin the property that fixes it: a sample far from the head starts a
 * NEW ribbon rather than joining the old one, and no quad is ever longer than
 * the gap limit.
 */
/** The longest distance between consecutive samples, i.e. the longest quad. */
function longestSpan(t: TrailRibbon): number {
  const s = (t as unknown as { samples: { x: number; y: number }[] }).samples;
  let worst = 0;
  for (let i = 1; i < s.length; i++) {
    worst = Math.max(worst, Math.hypot(s[i]!.x - s[i - 1]!.x, s[i]!.y - s[i - 1]!.y));
  }
  return worst;
}

const count = (t: TrailRibbon) => (t as unknown as { samples: unknown[] }).samples.length;

describe("Trail — sampling gaps", () => {
  it("continues normally when samples are adjacent", () => {
    const t = new TrailRibbon();
    for (let i = 0; i < 12; i++) t.push(i * 0.4, 10);
    expect(count(t)).toBeGreaterThan(2);
    // Adjacent samples must still accumulate, not reset each time.
    expect(longestSpan(t)).toBeLessThan(1);
    t.dispose();
  });

  it("starts a NEW ribbon when the bird reappears far away, rather than bridging", () => {
    const t = new TrailRibbon();
    for (let i = 0; i < 12; i++) t.push(i * 0.4, 10);
    const before = count(t);
    expect(before).toBeGreaterThan(2);

    // A gap the speed gate can produce: sampling paused, bird travelled far.
    t.push(600, 10);
    // Exactly one sample survives the cut — the new head. Nothing survives to
    // be connected to 600 units away, because that is the whole point.
    expect(count(t)).toBe(1);
    t.dispose();
  });

  it("never lets a quad span more than the gap limit, however often the gate flaps", () => {
    const t = new TrailRibbon();
    // Simulate the real bug: build a trail, stop sampling, move far, resume.
    for (let cycle = 0; cycle < 6; cycle++) {
      for (let i = 0; i < 10; i++) t.push(cycle * 40 + i * 0.4, 10 + i * 0.2);
      t.update(1 / 60, 1); // time passes with no samples being pushed
      t.push(cycle * 40 + 400, 80); // ...then a huge jump
      t.update(1 / 60, 1);
    }
    expect(longestSpan(t), "a quad was drawn across a sampling gap").toBeLessThan(13);
    t.dispose();
  });

  it("recovers: the ribbon regrows after a cut instead of staying dead", () => {
    const t = new TrailRibbon();
    for (let i = 0; i < 10; i++) t.push(i * 0.4, 10);
    t.push(900, 10); // cut
    expect(count(t)).toBe(1);
    for (let i = 0; i < 10; i++) t.push(900 + i * 0.4, 10);
    expect(count(t), "the ribbon must build again after a cut").toBeGreaterThan(2);
    expect(longestSpan(t)).toBeLessThan(13);
    t.dispose();
  });

  it("an explicit clear still empties it completely", () => {
    const t = new TrailRibbon();
    for (let i = 0; i < 10; i++) t.push(i * 0.4, 10);
    t.clear();
    expect(count(t)).toBe(0);
    t.dispose();
  });

  it("stays invisible with fewer than two samples, so a cut never flashes a stray quad", () => {
    const t = new TrailRibbon();
    for (let i = 0; i < 10; i++) t.push(i * 0.4, 10);
    t.update(1 / 60, 1);
    expect(t.mesh.visible).toBe(true);
    t.push(900, 10); // cut down to one sample
    t.update(1 / 60, 1);
    expect(t.mesh.visible, "one sample must not render").toBe(false);
    t.dispose();
  });
});
