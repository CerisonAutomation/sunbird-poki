// "THE BIRD'S MOVEMENT IS JAGGERY AND NOT SMOOTH."
//
// THE BUG. The game runs a 120 Hz fixed physics step (`PHYS_DT = 1/120`) and
// renders on whatever the display does — 60, 120, 144 Hz. Render interpolation
// is what bridges that gap: the renderer draws the bird partway between the last
// two physics states, `alpha = accumulator / PHYS_DT`. It was installed, and it
// was broken in two independent ways, which is why the bird stuttered even
// though the interpolation code existed.
//
// FAULT 1 — the snapshot was taken per FRAME, not per STEP.
//
// `prevBirdX/prevBirdY` were sampled ONCE at the top of `Game.frame`, before the
// accumulator loop ran. So `prev` was the position from the start of the frame
// and `cur` the position after N steps, and the interpolation was stretched
// across all N. At 144 Hz most frames run ZERO physics steps (16.7 ms of
// leftover time vs an 8.3 ms step), so `prev == cur`, `lerp` returned `cur`
// unchanged, and the bird sat still for a frame and then jumped a whole step on
// the frames that did step. A freeze-then-hop, worst on exactly the high-refresh
// displays interpolation exists to serve. The snapshot now lives INSIDE each
// accumulator iteration, so `prev` is genuinely the state one step back.
//
// FAULT 2 — position was interpolated; everything else was not.
//
// `Bird.syncVisual` received already-interpolated `ox`/`oy`, but read RAW
// `this.vx` / `this.vy` / `this.rotation` for the 3D roll, the pupil dart, the
// beak, the tail flutter, the wing-flap rate and the speed stretch. So the
// sprite glided smoothly while the pose on top of it advanced in 120 Hz
// staircases — a smoothly-moving body with a stuttering face. `Bird` now keeps
// its own per-step velocity and heading history and interpolates them with the
// same `alpha`, using `lerpAngle` for the heading so the lerp takes the short
// way round the circle.
//
// This file pins the mechanism. `Game` cannot boot under jsdom (no 2D canvas
// context), so the frame-level snapshot is verified by reading the source — the
// same convention `trail-anchor.test.ts` and `release-feedback.test.ts` already
// use — and the part that IS headless-simulatable, `Bird`'s interpolation, is
// driven for real.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Bird } from "../Bird";
import { PHYS_DT } from "../constants";
import { lerp, lerpAngle } from "../math";
import { TerrainSystem } from "../TerrainSystem";

const IDLE = { fever: false, speedMult: 1, boost: false } as const;
const DIVE = { ...IDLE, diving: true } as const;

/** Fold an angle difference into (-pi, pi] so a distance can be compared
 *  without caring which side of the seam the two angles are on. */
function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** The body of the method starting at `from`, comment-stripped, brace-matched.
 *
 *  Braces inside comments and strings are ignored, so the count cannot be thrown
 *  off by prose. Returns "" if the body never closes, which makes every assertion
 *  below fail loudly rather than pass on a truncated slice. */
function extractMethodBody(src: string, from: number): string {
  // Strip block and line comments, replacing them with spaces so byte offsets and
  // the remaining text stay comparable.
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  const start = clean.indexOf("{", from);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === "{") depth++;
    else if (clean[i] === "}" && --depth === 0) return clean.slice(from, i + 1);
  }
  return "";
}

function probe(seed = "flight-smoothness-probe"): { bird: Bird; terrain: TerrainSystem } {
  const terrain = new TerrainSystem(seed);
  const bird = new Bird();
  bird.reset(64, terrain.heightAt(64) + 120);
  bird.vx = 45;
  return { bird, terrain };
}

describe("the physics history a render interpolates against exists", () => {
  it("Bird snapshots its state once per STEP, before the step mutates it", () => {
    // The ordering is the whole mechanism. If the snapshot moved after the
    // integration, `prev` would equal `cur` every frame and the interpolation
    // would silently become an identity function — a "fix" that does nothing and
    // still looks correct in the source.
    //
    // The integration is written as local `vx`/`vy` and assigned back at the end
    // of the branch, so the check is that the snapshot appears before ANY write
    // to `this.vx` / `this.vy` inside `step`.
    const src = readFileSync(join(process.cwd(), "src/game/Bird.ts"), "utf8");
    const stepAt = src.indexOf("  step(");
    expect(stepAt, "Bird.step was not found").toBeGreaterThan(-1);

    // Extract the REAL method body: brace-matched, with comments stripped first.
    //
    // This used to slice a fixed 4 kB window, on the stated assumption that 4 kB
    // "is the whole of step()". It is not — step() is ~20 kB — so the window
    // covered a fifth of the method and the check passed while examining almost
    // none of it. It then failed for the opposite reason the moment a comment
    // grew the method past the cutoff and pushed the earliest `this.vx =` out of
    // range, reporting "step() never writes this.vx" about a method that plainly
    // does. Both this branch and the arena branch hit that cliff independently;
    // the assertion was right in both cases and the window was the bug.
    //
    // Brace matching removes the failure mode instead of moving the cliff: the
    // window IS the method, so it cannot go stale. Comments are stripped first so
    // that a `this.vx =` mentioned in prose cannot satisfy the check, and so
    // braces inside comments cannot unbalance the count — neither of which the
    // regex-scan alternative guards against.
    const stepBody = extractMethodBody(src, stepAt);

    const snapVx = stepBody.indexOf("this.prevVx = this.vx;");
    const snapVy = stepBody.indexOf("this.prevVy = this.vy;");
    const snapRot = stepBody.indexOf("this.prevRotation = this.rotation;");
    const snapX = stepBody.indexOf("this.prevX = this.x;");
    expect(snapVx, "prevVx is not snapshotted in step()").toBeGreaterThan(-1);
    expect(snapVy, "prevVy is not snapshotted in step()").toBeGreaterThan(-1);
    expect(snapRot, "prevRotation is not snapshotted in step()").toBeGreaterThan(-1);
    expect(snapX, "prevX is not snapshotted in step()").toBeGreaterThan(-1);

    for (const write of ["this.vx =", "this.vy ="]) {
      // The FIRST write in the method, not merely one somewhere after the
      // snapshot. `indexOf(write, snapVx)` used to search *forward from* the
      // snapshot, which asks "is there a write later?" — so a mutation that
      // moved the snapshot to sit immediately after the first write still
      // passed, because some other write further down the method satisfied it.
      // That is precisely the regression this test exists to catch, and it was
      // letting it through. What must hold is that NO write precedes the
      // snapshot, which is the same statement as "the first write comes after
      // it".
      const at = stepBody.indexOf(write);
      expect(at, `step() never writes ${write}, so this test is not measuring the right thing`).toBeGreaterThan(-1);
      expect(at, `${write} is written BEFORE the snapshot — prev would equal cur and the blend would be a no-op`)
        .toBeGreaterThan(snapVx);
    }
  });

  it("Game snapshots the bird INSIDE the accumulator loop, not once per frame", () => {
    // The regression this pins took the snapshot out of the loop. A per-frame
    // snapshot is not merely less accurate: on a display faster than 120 Hz most
    // frames run zero steps, `prev` and `cur` are then the same number, and the
    // lerp is a no-op — the bird freezes for a frame and hops on the next.
    const src = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");
    const loopAt = src.indexOf("while (this.acc >= PHYS_DT");
    expect(loopAt, "the fixed-timestep accumulator loop was not found").toBeGreaterThan(-1);

    // The window has to be TIGHT. `frame()` has three accumulator loops (playing,
    // continue, gameover) and three snapshots, one per loop. A window wide
    // enough to be "the loop" comfortably also covers the NEXT loop, so deleting
    // the snapshot from the playing case still leaves one inside the window and
    // the assertion passes on a file that has reintroduced the exact bug. The
    // first loop is the playing case, and its snapshot sits ~370 chars in, so
    // 800 is generous without reaching the next loop at ~1200.
    const firstLoopEnd = src.indexOf("while (this.acc >= PHYS_DT", loopAt + 1);
    const limit = firstLoopEnd === -1 ? loopAt + 800 : Math.min(loopAt + 800, firstLoopEnd);
    const body = src.slice(loopAt, limit);
    expect(body, "the playing case does not snapshot the bird inside its accumulator loop").toContain(
      "this.prevBirdX = this.bird.x;",
    );
    expect(body, "the playing case does not snapshot the bird inside its accumulator loop").toContain(
      "this.prevBirdY = this.bird.y;",
    );

    // And each of the other two states gets one too, so a mid-race transition
    // (dying, or taking a continue) cannot drop the bird a step on the first
    // frame after it.
    //
    // Checked per loop rather than by counting the assignments. A count of
    // exactly 3 was the old form, and it measured the wrong thing: the
    // property that matters is that EVERY accumulator loop snapshots, and a
    // count cannot tell "three loops, one each" from "one loop, three". A
    // fourth snapshot elsewhere is not a regression — `resetRun` seeds the
    // snapshot for the same reason, and is asserted on its own below.
    const loopStarts: number[] = [];
    for (let at = src.indexOf("while (this.acc >= PHYS_DT"); at !== -1;
      at = src.indexOf("while (this.acc >= PHYS_DT", at + 1)) loopStarts.push(at);
    expect(loopStarts.length, "expected one accumulator loop per frame state").toBe(3);
    for (const [i, at] of loopStarts.entries()) {
      const loopBody = src.slice(at, loopStarts[i + 1] ?? src.length);
      expect(loopBody, `accumulator loop ${i + 1} does not snapshot the bird`)
        .toContain("this.prevBirdX = this.bird.x;");
      expect(loopBody, `accumulator loop ${i + 1} does not snapshot the bird`)
        .toContain("this.prevBirdY = this.bird.y;");
    }

    // `resetRun` teleports the bird to the start line, but no physics step runs
    // until GO and `interp` is 0 while the accumulator is empty — which is the
    // whole countdown. Without re-seeding here, the bird mesh and the camera
    // following it are drawn at the PREVIOUS run's final position for the
    // entire countdown and then snap on the first frame after GO. Measured on a
    // second run: a 92-unit jump in one 16.7 ms frame where cruising at 48 m/s
    // should move 0.8 — and the magnitude is however far the last run went.
    const resetAt = src.indexOf("this.bird.reset(this.startX, y);");
    expect(resetAt, "resetRun's bird.reset was not found").toBeGreaterThan(-1);
    // Slice to the NEXT statement, not by a fixed character count: a fixed
    // window is silently too small the moment someone documents the line they
    // just added, which is exactly how a guard like this decays into one that
    // passes while asserting nothing.
    const afterResetEnd = src.indexOf("this.bird.vx = START_SPEED;", resetAt);
    expect(afterResetEnd, "the end of the resetRun re-seed block was not found")
      .toBeGreaterThan(resetAt);
    const afterReset = src.slice(resetAt, afterResetEnd);
    expect(afterReset, "resetRun does not re-seed the render interpolation snapshot")
      .toContain("this.prevBirdX = this.bird.x;");
    expect(afterReset, "resetRun does not re-seed the render interpolation snapshot")
      .toContain("this.prevBirdY = this.bird.y;");
  });

  it("render passes the interpolation alpha through to syncVisual", () => {
    // Without `interp` reaching `Bird`, `Bird` renders at its raw state and the
    // position glides while the pose staircases — fault 2, unfixed.
    const src = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");
    // The `/s` flag matters: the real declaration spans a line break, and a
    // `.` that cannot cross a newline matches the *wrong* `interp` — the
    // `p1/p2` one in the local-multiplayer path — so the assertion below would
    // pass against a completely broken `interp` in `render()`.
    expect(src).toMatch(/const interp = this\.state === "menu" \? 1 : clamp\(this\.acc \/ PHYS_DT, 0, 1\);/);
    const render = src.slice(src.lastIndexOf("private render("), src.lastIndexOf("private render(") + 6000);
    expect(render, "syncVisual is not called with an interp argument").toMatch(
      /this\.bird\.syncVisual\([^)]*\binterp\)/,
    );
  });
});

describe("interpolating between two physics states actually smooths the motion", () => {
  it("the rendered velocity moves continuously rather than in 120 Hz steps", () => {
    // The assertion the bug report is really about. A raw render reads `this.vy`
    // and can only ever take the 120 Hz physics values, so consecutive rendered
    // frames jump by the full per-step delta. Interpolated, each render frame
    // advances by alpha of that step, and the sequence of rendered deltas is
    // bounded by the single largest physics step no matter how the display rate
    // compares to 120 Hz.
    const { bird, terrain } = probe("interp-velocity");
    bird.reset(64, terrain.heightAt(64) + 120);
    // A glide from level, then a release. A committed dive is the WRONG probe
    // here: at terminal velocity drag exactly balances gravity, so consecutive
    // physics states differ by ~0.001 m/s and "is the render between them" is
    // unmeasurable. A release moves vy by the full kick in one step, so the
    // interval the render must land inside is wide enough to assert on.
    bird.step(PHYS_DT, DIVE, terrain); // arm the release edge
    bird.vy = 0;
    bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain); // the release

    // One more step, so prev = the post-release state and cur = one step later.
    bird.step(PHYS_DT, { ...IDLE, diving: false }, terrain);
    const span = Math.abs(bird.vy - bird.prevVyForTest);
    expect(span, "the probe must span a visible change in vy").toBeGreaterThan(0.1);

    const rendered: number[] = [];
    for (const alpha of [0, 0.25, 0.5, 0.75]) {
      bird.syncVisual(PHYS_DT, false, false, 0, terrain, 0, 0, alpha);
      rendered.push(bird.interpolatedVyForTest);
    }

    // Every rendered sample sits strictly between the two physics states.
    const lo = Math.min(bird.prevVyForTest, bird.vy);
    const hi = Math.max(bird.prevVyForTest, bird.vy);
    for (const v of rendered) {
      expect(v, `rendered ${v} escaped the physics interval [${lo}, ${hi}]`).toBeGreaterThanOrEqual(lo);
      expect(v, `rendered ${v} escaped the physics interval [${lo}, ${hi}]`).toBeLessThanOrEqual(hi);
    }
    // And they are strictly ordered along the path from prev to cur — the render
    // is genuinely walking the interval, not sitting at one end of it. The
    // direction is deliberately not asserted: after a release the peak is
    // already past and gravity is pulling vy back DOWN, so "increasing" is just
    // as wrong here as "decreasing" would be on the way up. Strict ordering in
    // SOME direction is the invariant.
    const delta = rendered[3] - rendered[0];
    expect(Math.abs(delta), "interpolation produced no motion at all").toBeGreaterThan(span * 0.5);
    for (let i = 1; i < rendered.length; i++) {
      const step = rendered[i] - rendered[i - 1];
      expect(Math.sign(step), `rendered sample ${i} broke monotonicity`).toBe(Math.sign(delta));
      expect(Math.abs(step), `rendered sample ${i} stalled`).toBeGreaterThan(0);
    }
    terrain.dispose();
  });

  it("alpha = 0 draws the previous state and alpha = 1 the current one", () => {
    // The endpoint contract. Without it, an off-by-one in the blend shows up as
    // a permanent one-step lag, which looks exactly like the jagginess being
    // fixed and is very hard to spot by eye.
    const { bird, terrain } = probe("interp-endpoints");
    bird.step(PHYS_DT, DIVE, terrain);
    const prevVy = bird.prevVyForTest;
    const curVy = bird.vy;

    bird.syncVisual(PHYS_DT, true, false, 0, terrain, 0, 0, 0);
    expect(bird.interpolatedVyForTest).toBeCloseTo(prevVy, 6);
    bird.syncVisual(PHYS_DT, true, false, 0, terrain, 0, 0, 1);
    expect(bird.interpolatedVyForTest).toBeCloseTo(curVy, 6);
    terrain.dispose();
  });

  it("the drawn heading is interpolated with lerpAngle, not a raw lerp", () => {
    // A plain lerp across the -pi/+pi seam renders a full spin every time the
    // heading crosses it — a bird that is turning a few degrees visibly cartwheels.
    // `lerpAngle` takes the short way round. The property pinned here is the
    // seam itself: a heading just either side of it must interpolate to a
    // heading near BOTH, not to one on the far side of the circle.
    const justBelow = -Math.PI + 0.05;
    const justAbove = Math.PI - 0.05;
    const mid = lerpAngle(justBelow, justAbove, 0.5);
    // The short arc between them is 0.1 rad, through +/-pi, not the long way.
    expect(Math.abs(mid)).toBeGreaterThan(Math.PI - 0.06);
    // A naive linear lerp lands on 0 — pointing the opposite way.
    const naive = justBelow + (justAbove - justBelow) * 0.5;
    expect(Math.abs(naive)).toBeLessThan(0.01);

    // Testing `lerpAngle` in isolation proves nothing about the bird. The call
    // site has to actually use it: swapping `lerpAngle` for `lerp` in
    // `syncVisual` leaves every assertion above green, because the function
    // itself is unchanged. So pin the binding, not just the helper.
    const src = readFileSync(join(process.cwd(), "src/game/Bird.ts"), "utf8");
    const at = src.indexOf("syncVisual(dt: number");
    expect(at, "Bird.syncVisual was not found").toBeGreaterThan(-1);
    const body = src.slice(at, at + 1200);
    expect(body, "the drawn heading is not interpolated with lerpAngle").toContain(
      "lerpAngle(this.prevRotation, this.rotation, interp)",
    );
  });

  it("a turn across the +/-pi seam draws a short arc, not a full spin", () => {
    // The same property, end to end through `syncVisual`, because the seam is
    // invisible until a real heading crosses it. Drive the bird's rotation
    // either side of the seam and check what the mesh is actually given.
    const { bird, terrain } = probe("seam-probe");
    bird.step(PHYS_DT, DIVE, terrain);
    const at = (from: number, to: number, alpha: number): number => {
      bird.setHeadingPairForTest(from, to);
      bird.syncVisual(PHYS_DT, true, false, 0, terrain, 0, 0, alpha);
      return bird.root.rotation.z;
    };
    // Straddle the seam going up: -pi+0.05 to +pi-0.05.
    //
    // There are exactly two defensible midpoints, and they are opposite:
    //   the SHORT way, through the seam, is +/-pi;
    //   the long way round is 0 — which is what a naive lerp produces and is
    //   the bird spinning through a full revolution to turn five degrees.
    const before = -Math.PI + 0.05;
    const after = Math.PI - 0.05;
    const shortWay = wrapPi(lerpAngle(before, after, 0.5));
    const longWay = wrapPi(before + (after - before) * 0.5);
    expect(Math.abs(shortWay), "sanity: the short arc runs through the seam").toBeGreaterThan(Math.PI - 0.06);
    expect(Math.abs(longWay), "sanity: the naive lerp points the opposite way").toBeLessThan(0.01);

    const drawn = wrapPi(at(before, after, 0.5));
    expect(
      Math.abs(wrapPi(drawn - shortWay)),
      `the drawn heading must be the short-arc answer (~${shortWay.toFixed(3)}), not the naive one (~${longWay.toFixed(3)})`,
    ).toBeLessThan(1e-6);
    expect(Math.abs(wrapPi(drawn - longWay)), "and must not be the long way round").toBeGreaterThan(1);
    terrain.dispose();
  });

  it("the tail wake follows the drawn heading, not the raw one", () => {
    // `tailPoint` builds the wake from the heading. Reading the raw `rotation`
    // there while the mesh is drawn at the interpolated angle leaves the wake
    // visibly detached mid-turn — the exact "stuttering" a player sees as a
    // rendering bug when it is really a tail-pointing one.
    const src = readFileSync(join(process.cwd(), "src/game/Bird.ts"), "utf8");
    const at = src.indexOf("tailPoint(x: number");
    expect(at, "tailPoint was not found").toBeGreaterThan(-1);
    const tail = src.slice(at, at + 2000);
    expect(tail, "tailPoint does not use the drawn rotation").toContain("this.drawRotation");
    expect(tail, "tailPoint is reading the raw physics rotation").not.toMatch(/Math\.cos\(this\.rotation\)/);
  });
});

describe("a 144 Hz display is served correctly", () => {
  it("the mesh is drawn exactly where the game told it to", () => {
    // `Bird` receives the interpolated position and must place the mesh there and
    // nowhere else. If it also applied a step of its own correction the two
    // would compound and the bird would trail the camera by a whole step — which
    // reads as lag, the same class of bug as the stutter.
    const { bird, terrain } = probe("high-refresh");
    for (let i = 0; i < 60; i++) bird.step(PHYS_DT, DIVE, terrain);

    const before = bird.x;
    bird.step(PHYS_DT, DIVE, terrain);
    const prevX = bird.prevXForTest;
    expect(prevX, "sanity: the per-step snapshot really is one step back").toBeCloseTo(before, 6);
    expect(bird.x, "sanity: the physics state advanced").not.toBeCloseTo(prevX, 6);

    const drawn = lerp(prevX, bird.x, 0.5);
    bird.syncVisual(PHYS_DT, true, false, 0, terrain, drawn, bird.y, 0.5);
    expect(bird.root.position.x, "the mesh must sit exactly where it was told").toBeCloseTo(drawn, 6);

    // And the drawn point is strictly BETWEEN the two physics states. That is
    // the definition of smooth, and it is what a per-frame snapshot destroys:
    // sampled before the loop, `prev` is the start of the frame and the lerp
    // spans every step the frame ran, so on a zero-step frame it is a no-op and
    // the bird stands still, then hops.
    expect(drawn).toBeGreaterThan(Math.min(prevX, bird.x));
    expect(drawn).toBeLessThan(Math.max(prevX, bird.x));
    terrain.dispose();
  });
});
