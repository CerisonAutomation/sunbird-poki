import { describe, expect, it } from "vitest";
import { GameAudio } from "../Audio";

// A small event-capable WebAudio graph: verify allocation, pitch and cleanup,
// not subjective sound quality or real-device latency.
class Param {
  value = 0;
  values: number[] = [];
  setValueAtTime(v: number): void { this.values.push(v); this.value = v; }
  exponentialRampToValueAtTime(v: number): void { this.values.push(v); this.value = v; }
  setTargetAtTime(v: number): void { this.value = v; }
  cancelScheduledValues(): void {}
}
class Node extends EventTarget {
  gain = new Param();
  frequency = new Param();
  detune = new Param();
  edges: Node[] = [];
  connect(node: Node): void { this.edges.push(node); }
  disconnect(): void { this.edges = []; }
  start(): void {}
  stop(): void {}
}
function fixture() {
  const audio = new GameAudio();
  const oscillators: Node[] = [];
  const sources: Node[] = [];
  const buffers: Float32Array[] = [];
  const ctx = {
    currentTime: 0, sampleRate: 8000,
    createOscillator: () => { const n = new Node(); oscillators.push(n); return n; },
    createBufferSource: () => { const n = new Node(); sources.push(n); return n; },
    createGain: () => new Node(),
    createBiquadFilter: () => new Node(),
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length);
      buffers.push(data);
      return { length, getChannelData: () => data };
    },
  };
  // Inject the already-unlocked graph; production still requires a gesture.
  Object.assign(audio, { ctx, sfxBus: new Node(), reverbSend: new Node(), started: true });
  const end = () => {
    for (const n of [...oscillators.splice(0), ...sources.splice(0)]) n.dispatchEvent(new Event("ended"));
  };
  return { audio, oscillators, sources, buffers, end };
}

describe("sound cue budgets", () => {
  it("climbs ring pitches to a cap with two oscillators, not a fanfare", () => {
    const f = fixture();
    let previous = 0;
    for (const chain of [1, 2, 3, 4, 5, 30]) {
      f.audio.ringPass(chain);
      expect(f.oscillators).toHaveLength(2);
      const pitch = f.oscillators[0]!.frequency.values[0]!;
      expect(pitch).toBeGreaterThanOrEqual(previous);
      expect(pitch).toBeLessThanOrEqual(880);
      previous = pitch;
      f.end();
    }
  });
  it("shares a bounded budget across bursts, releases it on ended, and disconnects sources", () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) f.audio.ringPass(i + 1);
    expect(f.oscillators).toHaveLength(28);
    f.audio.ridgeSkim();
    expect(f.sources).toHaveLength(0);
    const nodes = [...f.oscillators];
    f.end();
    expect(nodes.every(n => n.edges.length === 0)).toBe(true);
    f.audio.ridgeSkim();
    expect(f.oscillators).toHaveLength(1);
    expect(f.sources).toHaveLength(1);
    f.end();
  });
  it("allocates no effects while any mute gate is active", () => {
    const f = fixture();
    for (const toggle of [f.audio.setMuted, f.audio.setAdMuted, f.audio.setHiddenMuted, f.audio.setPortalMuted]) {
      toggle.call(f.audio, true);
      f.audio.ringPass(3);
      f.audio.ridgeSkim();
      expect(f.oscillators).toHaveLength(0);
      expect(f.sources).toHaveLength(0);
      toggle.call(f.audio, false);
    }
    f.audio.setVolumes(1, 0);
    f.audio.ringPass(1);
    expect(f.oscillators).toHaveLength(0);
  });
  it("reuses noise and fills the expanded cache rather than playing silence", () => {
    const f = fixture();
    f.audio.ridgeSkim();
    f.end();
    f.audio.ridgeSkim();
    f.end();
    expect(f.buffers).toHaveLength(1);
    const internal = f.audio as unknown as { noiseBurst: (duration: number, freq: number, gain: number) => void };
    internal.noiseBurst(1.2, 1200, 0.02);
    expect(f.buffers).toHaveLength(2);
    expect(f.buffers[1]!.some(value => value !== 0)).toBe(true);
    f.end();
    internal.noiseBurst(1, 1200, 0.02);
    expect(f.buffers).toHaveLength(2);
    f.end();
  });
});
