import { afterEach, describe, expect, it, vi } from "vitest";
import { Music, musicCutoff } from "../Music";

// Small graph fake: test routing and scheduling, not subjective sound quality.
class Param {
  value = 0;
  targets: number[] = [];
  setTargetAtTime(v: number): void { this.targets.push(v); this.value = v; }
  setValueAtTime(v: number): void { this.value = v; }
  exponentialRampToValueAtTime(v: number): void { this.value = v; }
  cancelScheduledValues(): void { /* no audio clock */ }
}
class Node {
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
  edges: Node[] = [];
  connect(node: Node): void { this.edges.push(node); }
  disconnect(): void { this.edges = []; }
  start(): void { /* no audio device */ }
  stop(): void { /* no audio device */ }
}
function fixture() {
  const nodes: Node[] = [];
  const create = (): Node => { const n = new Node(); nodes.push(n); return n; };
  const dry = new Node();
  const wet = new Node();
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
    createWaveShaper: () => { const n = create(); (n as unknown as { curve: null }).curve = null; return n; },
  };
  const music = new Music(ctx as unknown as AudioContext, dry as unknown as AudioNode, wet as unknown as AudioNode);
  return { music, nodes, ctx, dry, wet };
}

afterEach(() => { vi.useRealTimers(); });

describe("music mix safety", () => {
  it("keeps night-time ember filters positive and below Nyquist", () => {
    for (const base of [3800, 7000, 11200]) {
      for (const night of [0, 0.5, 1]) {
        const cutoff = musicCutoff(base, night, 1);
        expect(cutoff).toBeGreaterThanOrEqual(500);
        expect(cutoff).toBeLessThanOrEqual(8000);
      }
    }
    expect(musicCutoff(3800, 1, 0)).toBe(800);
  });

  it("does no sequencer work when music is zero or off, and resumes on unmute", () => {
    vi.useFakeTimers();
    const { music } = fixture();
    music.setMode("play");
    expect(vi.getTimerCount()).toBe(0);
    music.setLevel(0.5);
    expect(vi.getTimerCount()).toBe(1);
    music.setMode("fever");
    expect(vi.getTimerCount()).toBe(1);
    music.setLevel(0);
    expect(vi.getTimerCount()).toBe(0);
    music.setLevel(0.5);
    expect(vi.getTimerCount()).toBe(1);
    music.setMode("off");
    expect(vi.getTimerCount()).toBe(0);
    music.dispose();
  });

  it("routes every instrument's reverb through the music fader and duck bus", () => {
    vi.useFakeTimers();
    const { music, nodes, ctx, dry, wet } = fixture();
    music.setLevel(0.5);
    for (const mode of ["menu", "play", "fever", "storm", "sleep"] as const) {
      music.setMode(mode);
      // Advance the simulated audio clock too, to exercise more than step zero.
      for (let i = 0; i < 40; i++) { ctx.currentTime += 0.1; vi.advanceTimersByTime(100); }
    }
    const wetSources = nodes.filter(n => n.edges.includes(wet));
    expect(wetSources).toHaveLength(1); // never a per-voice bypass
    const duck = nodes.find(n => n.edges.includes(dry))!;
    expect(duck.edges).toContain(wetSources[0]);
    music.duck(0.45);
    expect(duck.gain.targets).toContain(0.55);
    const bus = nodes[0]!;
    music.setLevel(0);
    expect(bus.gain.value).toBe(0);
    music.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(wetSources[0]!.edges).toHaveLength(0);
  });
});
