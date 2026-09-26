/**
 * The arrangement: which instruments are in the band, per phase of a flight.
 *
 * These cases exist to keep two promises honest. The first is musical — a phase
 * change has to be *audible as re-arrangement* (voices entering and leaving),
 * not as a volume ride, which is what intensity already does. The second is
 * defensive: `cruise` and `menu` must be exactly neutral, because those are the
 * mixes the engine shipped with and the mixes every other music test asserts.
 * If a multiplier drifts into them, this module has quietly re-tuned the whole
 * soundtrack from a file nobody would think to check.
 */
import { describe, expect, it } from "vitest";

import {
  ARR,
  arrangement,
  arrangementGlide,
  runPhase,
  type ArrFamily,
  type PhaseInput,
  type RunPhase,
} from "../MusicArrangement";

const FAMILIES: ArrFamily[] = [
  "uke", "glock", "bass", "perc", "whistle", "arp",
  "organ", "pad", "spark", "chip", "tron", "tension",
];
const PHASES: RunPhase[] = ["menu", "launch", "cruise", "apex", "resolve"];

function input(over: Partial<PhaseInput> = {}): PhaseInput {
  return {
    context: "flight",
    inRun: true,
    runSeconds: 12,
    sinceEnd: Number.POSITIVE_INFINITY,
    intensity: 0.3,
    previous: "cruise",
    ...over,
  };
}

describe("arrangement: the mixes themselves", () => {
  it("leaves cruise and the menu exactly as the engine tuned them", () => {
    for (const phase of ["menu", "cruise"] as const) {
      for (const family of FAMILIES) {
        expect(arrangement(phase)[family], `${phase}.${family}`).toBe(1);
      }
    }
  });

  it("gives every phase a complete, sane record", () => {
    for (const phase of PHASES) {
      const mix = arrangement(phase);
      for (const family of FAMILIES) {
        const value = mix[family];
        expect(Number.isFinite(value), `${phase}.${family} is ${value}`).toBe(true);
        expect(value, `${phase}.${family}`).toBeGreaterThanOrEqual(0);
        expect(value, `${phase}.${family}`).toBeLessThanOrEqual(1.6);
      }
    }
  });

  it("launch holds the kit back and lets the bed carry the take-off", () => {
    const launch = arrangement("launch");
    const cruise = arrangement("cruise");
    // The hole the kit leaves is the point: cruise is where it arrives.
    expect(launch.perc).toBeLessThan(cruise.perc * 0.6);
    expect(launch.tension).toBeLessThan(cruise.tension * 0.4);
    expect(launch.pad).toBeGreaterThan(cruise.pad);
    expect(launch.organ).toBeGreaterThan(cruise.organ);
    expect(launch.bass).toBeGreaterThanOrEqual(cruise.bass);
    // …but the hook stays recognisable: the melody is never hidden at take-off.
    expect(launch.glock).toBeGreaterThanOrEqual(0.9);
  });

  it("apex brightens the top of the band and thins the bed", () => {
    const apex = arrangement("apex");
    for (const family of ["perc", "glock", "whistle", "arp", "spark", "tension"] as const) {
      expect(apex[family], `apex.${family} should lean in`).toBeGreaterThan(1);
    }
    for (const family of ["pad", "organ"] as const) {
      expect(apex[family], `apex.${family} should get out of the way`).toBeLessThan(1);
    }
  });

  it("resolve takes the rhythm section out and lets the pad ring", () => {
    const resolve = arrangement("resolve");
    expect(resolve.perc).toBe(0);
    expect(resolve.tension).toBe(0);
    expect(resolve.pad).toBeGreaterThan(1.2);
    expect(resolve.organ).toBeGreaterThan(1);
    // The melody finishes its phrase instead of being cut mid-bar.
    expect(resolve.glock).toBeGreaterThan(0.5);
    expect(resolve.uke).toBeLessThan(1);
  });

  it("is a re-arrangement, not a volume ride", () => {
    // If every family moved the same direction by the same ratio, this would be
    // `setMusicIntensity` with extra steps. Each non-neutral phase must both
    // raise some voices and lower others.
    for (const phase of ["launch", "apex", "resolve"] as const) {
      const mix = arrangement(phase);
      const up = FAMILIES.filter((f) => mix[f] > 1);
      const down = FAMILIES.filter((f) => mix[f] < 1);
      expect(up.length, `${phase} raises nothing`).toBeGreaterThan(0);
      expect(down.length, `${phase} lowers nothing`).toBeGreaterThan(0);
    }
  });
});

describe("runPhase: what the score should be arranged for", () => {
  it("keeps the menu and the sleep screen on their own mix", () => {
    expect(runPhase(input({ context: "menu", inRun: false }))).toBe("menu");
    expect(runPhase(input({ context: "sleep", inRun: false }))).toBe("menu");
  });

  it("spends the first seconds of a run in the launch breath", () => {
    expect(runPhase(input({ runSeconds: 0 }))).toBe("launch");
    expect(runPhase(input({ runSeconds: ARR.launchSeconds - 0.05 }))).toBe("launch");
    expect(runPhase(input({ runSeconds: ARR.launchSeconds + 0.05 }))).toBe("cruise");
  });

  it("promotes to apex on intensity and demotes with hysteresis", () => {
    const past = { runSeconds: 20 } as const;
    expect(runPhase(input({ ...past, intensity: ARR.apexEnter - 0.01 }))).toBe("cruise");
    expect(runPhase(input({ ...past, intensity: ARR.apexEnter }))).toBe("apex");
    // Inside the band: hold. A flight hovering at the threshold must not flutter
    // the arrangement — an instrument that re-enters every half second is a bug
    // you hear as a stutter.
    expect(runPhase(input({ ...past, intensity: (ARR.apexEnter + ARR.apexLeave) / 2, previous: "apex" }))).toBe("apex");
    expect(runPhase(input({ ...past, intensity: (ARR.apexEnter + ARR.apexLeave) / 2, previous: "cruise" }))).toBe("cruise");
    expect(runPhase(input({ ...past, intensity: ARR.apexLeave - 0.01, previous: "apex" }))).toBe("cruise");
  });

  it("resolves a landing even after the mode has flipped back to the menu", () => {
    // The mode flip is immediate; the cadence must not be.
    expect(runPhase(input({ context: "menu", inRun: false, sinceEnd: 0 }))).toBe("resolve");
    expect(runPhase(input({ context: "menu", inRun: false, sinceEnd: ARR.resolveSeconds - 0.5 }))).toBe("resolve");
    expect(runPhase(input({ context: "menu", inRun: false, sinceEnd: ARR.resolveSeconds + 0.5 }))).toBe("menu");
  });

  it("never re-arranges the sleep screen, not even for a landing", () => {
    expect(runPhase(input({ context: "sleep", inRun: false, sinceEnd: 0 }))).toBe("menu");
  });

  it("takes a new run out of the resolve window", () => {
    expect(runPhase(input({ sinceEnd: 1, runSeconds: 0.4 }))).toBe("launch");
  });

  it("survives the numbers a paused or backgrounded tab produces", () => {
    // An unreadable run clock falls back to the tuned mix, not to the launch
    // breath: holding the take-off arrangement for a whole flight is the worse
    // failure of the two.
    expect(runPhase(input({ runSeconds: Number.NaN, intensity: Number.NaN }))).toBe("cruise");
    expect(runPhase(input({ runSeconds: 30, intensity: Number.NaN }))).toBe("cruise");
    expect(runPhase(input({ runSeconds: -5 }))).toBe("launch");
    expect(runPhase(input({ runSeconds: 30, intensity: 5 }))).toBe("apex");
    expect(runPhase(input({ runSeconds: 30, intensity: -5 }))).toBe("cruise");
    expect(runPhase(input({ sinceEnd: Number.NaN, runSeconds: 30 }))).toBe("cruise");
    expect(runPhase(input({ runSeconds: Number.POSITIVE_INFINITY, intensity: 0.9 }))).toBe("apex");
  });
});

describe("arrangementGlide: how fast the band re-arranges", () => {
  it("makes the launch drop-in the fastest move in the score", () => {
    const dropIn = arrangementGlide("launch", "cruise");
    expect(dropIn).toBeLessThan(0.25);
    for (const to of PHASES) {
      for (const from of PHASES) {
        if (from === "launch" && to === "cruise") continue;
        expect(arrangementGlide(from, to), `${from}→${to}`).toBeGreaterThanOrEqual(dropIn);
      }
    }
  });

  it("arrives faster than it leaves", () => {
    expect(arrangementGlide("cruise", "apex")).toBeLessThan(arrangementGlide("apex", "cruise"));
  });

  it("lets the cadence ring out longest", () => {
    const out = arrangementGlide("resolve", "menu");
    for (const to of PHASES) {
      for (const from of PHASES) {
        expect(arrangementGlide(from, to), `${from}→${to}`).toBeLessThanOrEqual(out);
      }
    }
  });

  it("stays inside the range setTargetAtTime can actually smooth", () => {
    for (const to of PHASES) {
      for (const from of PHASES) {
        const glide = arrangementGlide(from, to);
        expect(glide).toBeGreaterThan(0.05);
        expect(glide).toBeLessThan(3);
      }
    }
  });
});

describe("intensityFollow: one smoothed value for the whole band", () => {
  it("arrives at the same point however often it is called", () => {
    // The reason the follower steps on elapsed time instead of a fixed fraction
    // per tick: browsers clamp setInterval to >= 1 s in a background tab, and a
    // fixed 0.12 that is a ~0.2 s glide at 25 ms becomes a ~2.4 s glide at 1 s.
    // The score must not react to a backgrounded run in slow motion.
    const run = (seconds: number, hz: number): number => {
      const step = 1 / hz;
      let v = 0;
      for (let t = 0; t < seconds; t += step) {
        v = intensityFollow(v, 1, Math.min(step, seconds - t));
      }
      return v;
    };
    const at40 = run(0.5, 40);
    expect(at40).toBeGreaterThan(0.9);
    // 1 Hz — a throttled background tab — must land in the same place, and
    // `at40` is the continuous answer 1 - exp(-0.5 / 0.12).
    expect(at40).toBeCloseTo(1 - Math.exp(-0.5 / INTENSITY_RISE), 6);
    expect(run(0.5, 1)).toBeCloseTo(at40, 6);
    expect(run(0.5, 2)).toBeCloseTo(at40, 6);
  });

  it("rises quicker than it falls, so a moment registers then lingers", () => {
    const up = intensityFollow(0, 1, 0.2);
    expect(intensityFollow(1, 0, 0.2)).toBeLessThan(up);
  });

  it("does not overshoot, and stands still with no time on the clock", () => {
    for (const dt of [0, 0.001, 0.025, 1, 30]) {
      const v = intensityFollow(0, 1, dt);
      expect(v, `dt=${dt}`).toBeGreaterThanOrEqual(0);
      expect(v, `dt=${dt}`).toBeLessThanOrEqual(1);
    }
    expect(intensityFollow(0.4, 0.4, 5)).toBeCloseTo(0.4, 9);
    expect(intensityFollow(0.4, 0.4, 0)).toBeCloseTo(0.4, 9);
  });

  it("survives the numbers a paused or backgrounded tab produces", () => {
    expect(intensityFollow(Number.NaN, 0.5, 0.1)).toBe(0.5);
    expect(intensityFollow(0.5, Number.NaN, 0.1)).toBe(0.5);
    expect(intensityFollow(Number.NaN, Number.NaN, 0.1)).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * Integration: the pure phase machine is only half the feature. These cases
 * drive the real `Music` engine through a fake audio graph to prove the splice
 * is live — that a phase change actually re-targets the family gains, that
 * cruise puts them back exactly where the tuned mix had them, and that the
 * landing cadence survives the mode flip and expires on its own window.
 * ------------------------------------------------------------------------ */
import { afterEach, vi } from "vitest";

import { BIOME_MIX, INTENSITY_RISE, Music, intensityFollow, musicCutoff } from "../Music";

class Param {
  value = 0;
  targets: number[] = [];
  setTargetAtTime(v: number): void { this.targets.push(v); this.value = v; }
  setValueAtTime(v: number): void { this.value = v; }
  exponentialRampToValueAtTime(v: number): void { this.value = v; }
  cancelScheduledValues(): void { /* no audio clock */ }
}
class FakeNode {
  gain = new Param();
  frequency = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  playbackRate = new Param();
  Q = new Param();
  type = "";
  edges: FakeNode[] = [];
  connect(node: FakeNode): void { this.edges.push(node); }
  disconnect(): void { this.edges = []; }
  start(): void { /* no audio device */ }
  stop(): void { /* no audio device */ }
}
function engine() {
  const nodes: FakeNode[] = [];
  const create = (): FakeNode => { const n = new FakeNode(); nodes.push(n); return n; };
  const dry = new FakeNode();
  const wet = new FakeNode();
  const ctx = {
    currentTime: 0,
    state: "running",
    sampleRate: 44100,
    createGain: create,
    createBiquadFilter: create,
    createDynamicsCompressor: create,
    createOscillator: create,
    createBufferSource: create,
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  const music = new Music(ctx as unknown as AudioContext, dry as unknown as AudioNode, wet as unknown as AudioNode);
  /** The mix as it currently stands: one number per gain node, in creation
   * order. A neutral phase must reproduce it exactly, digit for digit. */
  const signature = (): string => nodes.map((n) => n.gain.value.toFixed(6)).join("|");
  return { music, nodes, ctx, signature };
}

afterEach(() => { vi.useRealTimers(); });

/** Run the engine for `seconds` of audio time, one sequencer tick at a time. */
function settle(ctx: { currentTime: number }, seconds: number): void {
  const step = 0.025;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    ctx.currentTime += step;
    vi.advanceTimersByTime(step * 1000);
  }
}

describe("the engine follows the arrangement", () => {
  it("re-arranges the band when the phase changes, and only then", () => {
    vi.useFakeTimers();
    const { music, ctx, signature } = engine();
    music.setLevel(0.5);
    music.setMode("play");
    // Snapshot *after* the engine has settled on a track: `start()` shuffles the
    // track order and flips the arcade/island family flags, which changes the
    // mix on its own and has nothing to do with the arrangement.
    music.setRunPhase(true, 30);
    expect(music.getRunPhase()).toBe("cruise");
    const tuned = signature();

    // The take-off breath is a different band: the graph must actually change.
    music.setRunPhase(true, 0.2);
    expect(music.getRunPhase()).toBe("launch");
    const launched = signature();
    expect(launched).not.toBe(tuned);

    // …and returning to cruise puts every family back exactly where it was —
    // the neutrality of the tuned mix, asserted against the real graph.
    music.setRunPhase(true, 12);
    expect(music.getRunPhase()).toBe("cruise");
    expect(signature()).toBe(tuned);

    // A landing cadence, held across the mode flip back to the menu.
    music.setMode("menu");
    music.setRunPhase(false, 12);
    expect(music.getRunPhase()).toBe("resolve");
    ctx.currentTime += ARR.resolveSeconds + 0.5;
    music.setRunPhase(false, 12);
    expect(music.getRunPhase()).toBe("menu");

    // Instant retry beats the cadence: a new run is a take-off, not a landing.
    music.setMode("play");
    music.setRunPhase(true, 0.1);
    expect(music.getRunPhase()).toBe("launch");
    music.dispose();
  });

  it("promotes to apex on sustained intensity, not on a one-frame spike", () => {
    vi.useFakeTimers();
    const { music, ctx } = engine();
    music.setLevel(0.5);
    music.setMode("play");
    music.setRunPhase(true, 20);
    expect(music.getRunPhase()).toBe("cruise");

    // A single frame at full tilt is a coin pickup, not a climax. The apex
    // decision reads the *smoothed* intensity, so the band holds: re-arranging
    // for a spike the player never heard arrive is the stutter this guards.
    music.setIntensity(1);
    music.setRunPhase(true, 21);
    expect(music.getRunPhase()).toBe("cruise");

    // Sustained intensity carries the run into apex — without a second call,
    // because the tick is what advances the phase now.
    settle(ctx, 2);
    expect(music.getRunPhase()).toBe("apex");

    // Hysteresis through the engine, not only through the pure function.
    music.setIntensity(ARR.apexLeave - 0.12);
    music.setRunPhase(true, 22);
    settle(ctx, 2);
    expect(music.getRunPhase()).toBe("cruise");
    music.dispose();
  });

  it("opens the take-off breath and the landing cadence off the mode flip alone", () => {
    // No gameplay hook at all: the engine is told the music mode, which is
    // something it already heard on every state change, and the arrangement
    // follows the run from there.
    vi.useFakeTimers();
    const { music, ctx } = engine();
    music.setLevel(0.5);
    expect(music.getRunPhase()).toBe("menu");

    music.setMode("play");
    expect(music.getRunPhase()).toBe("launch");

    // …and it leaves the take-off on its own, on the run clock.
    settle(ctx, ARR.launchSeconds + 0.5);
    expect(music.getRunPhase()).toBe("cruise");

    // A fever surge happens *during* a flight: the run clock must survive it,
    // or every combo would re-run the take-off breath.
    music.setMode("fever");
    expect(music.getRunPhase()).toBe("cruise");
    music.setMode("play");
    expect(music.getRunPhase()).toBe("cruise");

    // Landing: the rhythm section leaves and the pad rings out.
    music.setMode("menu");
    expect(music.getRunPhase()).toBe("resolve");
    settle(ctx, ARR.resolveSeconds + 0.5);
    expect(music.getRunPhase()).toBe("menu");
    music.dispose();
  });

  it("keeps the intensity surge through a mode flip", () => {
    // The regression: `apply()` wrote the tempo from the mode alone while
    // `setIntensity()` wrote it with the surge folded in, so every mode change
    // dropped the surge and let it come back a moment later — a tempo step at
    // exactly the moment the run is changing fastest.
    vi.useFakeTimers();
    const { music, ctx } = engine();
    const internals = music as unknown as { bpm: number };
    music.setTrack(10); // an island track, so the tempo follows the biome
    music.setLevel(0.5);
    music.setMode("play");
    music.setRunPhase(true, 20);

    music.setIntensity(0.5);
    settle(ctx, 2);
    expect(internals.bpm).toBeGreaterThan(BIOME_MIX.bright.bpm);

    // After the flip the surge is still folded in. The old code landed on
    // exactly `fever` here, which is what the player hears as a stumble.
    music.setMode("fever");
    expect(internals.bpm).toBeGreaterThan(BIOME_MIX.bright.fever);
    music.dispose();
  });

  it("drives the filter and the hats from one smoothed value", () => {
    vi.useFakeTimers();
    const { music, ctx, nodes } = engine();
    const internals = music as unknown as { intensity: number; intensityTarget: number };
    music.setLevel(0.5);
    music.setMode("play");
    music.setRunPhase(true, 20);
    music.setIntensity(0.8);
    settle(ctx, 0.3);

    // Mid-glide: the target is ahead of the ear, which is the whole point.
    expect(internals.intensity).toBeGreaterThan(0.3);
    expect(internals.intensity).toBeLessThan(0.79);
    expect(internals.intensityTarget).toBeGreaterThan(internals.intensity);

    // The filter is written from the *smoothed* value. The old code wrote it
    // from the target, which only moves in 0.01 quanta, so the cutoff climbed
    // the 1200 Hz range in 12 Hz steps instead of gliding.
    const filter = nodes.find((n) => n.frequency.targets.length > 0)!;
    const fromFollower = musicCutoff(BIOME_MIX.bright.cutoff, 0, internals.intensity);
    const fromTarget = musicCutoff(BIOME_MIX.bright.cutoff, 0, internals.intensityTarget);
    // Within the 12 Hz dead-band of the follower…
    expect(Math.abs(filter.frequency.value - fromFollower)).toBeLessThanOrEqual(12);
    // …and nowhere near where the raw target would have put it.
    expect(Math.abs(filter.frequency.value - fromTarget)).toBeGreaterThan(12);
    music.dispose();
  });

  it("leaves the sleep screen and a muted engine alone", () => {
    vi.useFakeTimers();
    const { music, signature } = engine();
    music.setLevel(0.5);
    music.setMode("sleep");
    const before = signature();
    music.setRunPhase(true, 4);
    expect(music.getRunPhase()).toBe("menu");
    expect(signature()).toBe(before);
    music.dispose();
  });
});
