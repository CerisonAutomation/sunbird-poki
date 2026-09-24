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

/* --------------------------------------------------------------------------
 * Integration: the pure phase machine is only half the feature. These cases
 * drive the real `Music` engine through a fake audio graph to prove the splice
 * is live — that a phase change actually re-targets the family gains, that
 * cruise puts them back exactly where the tuned mix had them, and that the
 * landing cadence survives the mode flip and expires on its own window.
 * ------------------------------------------------------------------------ */
import { afterEach, vi } from "vitest";

import { Music } from "../Music";

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

  it("promotes to apex on the intensity the arc is already writing", () => {
    vi.useFakeTimers();
    const { music } = engine();
    music.setLevel(0.5);
    music.setMode("play");
    music.setRunPhase(true, 20);
    expect(music.getRunPhase()).toBe("cruise");

    music.setIntensity(ARR.apexEnter + 0.1);
    music.setRunPhase(true, 21);
    expect(music.getRunPhase()).toBe("apex");

    // Hysteresis through the engine, not only through the pure function.
    music.setIntensity((ARR.apexEnter + ARR.apexLeave) / 2);
    music.setRunPhase(true, 22);
    expect(music.getRunPhase()).toBe("apex");
    music.setIntensity(ARR.apexLeave - 0.1);
    music.setRunPhase(true, 23);
    expect(music.getRunPhase()).toBe("cruise");
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
