import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GHOST_MAX_SAMPLES, GHOST_SAMPLE_DT } from "../constants";
import { GhostRecorder, type GhostRecord } from "../Ghost";
import { storage } from "../Storage";

const KEY = "sunbird.ghost.";

/** A stored ghost as `commit` would have written it. */
function write(seed: string, savedAt: number | undefined, distance = 100): void {
  const record: GhostRecord = { seed, distance, samples: [[0, 0, 0, 0]], ...(savedAt === undefined ? {} : { savedAt }) };
  storage.setItem(KEY + seed, JSON.stringify(record));
}

const ghostKeys = (): string[] => {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(KEY)) out.push(k);
  }
  return out;
};

const clearGhosts = (): void => {
  for (const k of ghostKeys()) storage.removeItem(k);
};

beforeEach(clearGhosts);
afterEach(clearGhosts);

describe("GhostRecorder sampling", () => {
  it("emits at the sample cadence, not every frame", () => {
    const rec = new GhostRecorder();
    // Six 60fps frames is 0.1s, but 6 * (1/60) is 0.09999... in binary
    // floating point, so it must NOT have fired yet.
    for (let i = 0; i < 6; i++) rec.sample(1 / 60, i / 60, i, i, 0);
    expect(rec.snapshot()).toHaveLength(0);
    // The seventh crosses the cadence and emits exactly one.
    rec.sample(1 / 60, 6 / 60, 6, 6, 0);
    expect(rec.snapshot()).toHaveLength(1);
  });

  it("rounds to a fixed precision so a run serialises to a stable size", () => {
    const rec = new GhostRecorder();
    rec.sample(GHOST_SAMPLE_DT, 1.23456, 10.98765, 3.14159, 0.98765);
    const [s] = rec.snapshot();
    expect(s![0]).toBe(1.23);
    expect(s![1]).toBe(11); // 10.98765 -> 1dp
    expect(s![2]).toBe(3.1);
    expect(s![3]).toBe(0.99);
  });

  it("caps the buffer so a long run cannot grow without bound", () => {
    const rec = new GhostRecorder();
    // Far past the cap: a 20-minute run at 10Hz.
    const frames = Math.ceil((GHOST_MAX_SAMPLES * 2 * GHOST_SAMPLE_DT) / (1 / 60));
    for (let i = 0; i < frames; i++) rec.sample(1 / 60, i / 60, i, 0, 0);
    expect(rec.snapshot().length).toBe(GHOST_MAX_SAMPLES);
  });

  it("reset drops everything, including the sample accumulator", () => {
    const rec = new GhostRecorder();
    rec.sample(1 / 60, 0, 0, 0, 0);
    rec.reset();
    // The accumulator is cleared too, so the first post-reset call must wait a
    // full cadence rather than firing immediately on the leftover remainder.
    rec.sample(1 / 60, 1, 0, 0, 0);
    expect(rec.snapshot()).toHaveLength(0);
  });

  it("snapshot is the live buffer, typed readonly for callers", () => {
    const rec = new GhostRecorder();
    rec.sample(GHOST_SAMPLE_DT, 0, 0, 0, 0);
    const view = rec.snapshot();
    // No copy is made: the view is the same array, and the only thing stopping
    // a caller writing to it is the `readonly` type. Pinned so that stays a
    // conscious choice rather than an accident.
    expect(view).toBe(rec.snapshot());
    expect(view[0]![1]).toBe(0);
  });
});

describe("GhostRecorder.commit", () => {
  it("stores a better run and refuses a worse one", () => {
    const good = new GhostRecorder();
    good.sample(GHOST_SAMPLE_DT, 0, 500, 10, 0);
    expect(good.commit("seed-a", 500)).toBe(true);

    const worse = new GhostRecorder();
    worse.sample(GHOST_SAMPLE_DT, 0, 300, 10, 0);
    expect(worse.commit("seed-a", 300)).toBe(false);

    // The stored best is untouched by the losing run.
    expect(GhostRecorder.load("seed-a")?.distance).toBe(500);
  });

  it("treats an equal distance as not a new best", () => {
    const a = new GhostRecorder();
    a.sample(GHOST_SAMPLE_DT, 0, 400, 0, 0);
    a.commit("seed-a", 400);
    const b = new GhostRecorder();
    b.sample(GHOST_SAMPLE_DT, 0, 400, 0, 0);
    expect(b.commit("seed-a", 400)).toBe(false);
  });

  it("keeps ghosts for different seeds side by side", () => {
    const a = new GhostRecorder();
    a.sample(GHOST_SAMPLE_DT, 0, 100, 0, 0);
    a.commit("fly-3f9a", 100);
    const b = new GhostRecorder();
    b.sample(GHOST_SAMPLE_DT, 0, 200, 0, 0);
    b.commit("fly-77b2", 200);
    expect(GhostRecorder.load("fly-3f9a")?.distance).toBe(100);
    expect(GhostRecorder.load("fly-77b2")?.distance).toBe(200);
  });

  it("stamps savedAt so the eviction pass can order by recency", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const rec = new GhostRecorder();
    rec.sample(GHOST_SAMPLE_DT, 0, 10, 0, 0);
    rec.commit("seed-a", 10);
    expect(GhostRecorder.load("seed-a")?.savedAt).toBe(1_700_000_000_000);
    vi.restoreAllMocks();
  });
});

describe("GhostRecorder eviction", () => {
  // The bug this pins: the eviction pass used to parse the storage KEY — whose
  // suffix is the world seed, e.g. "fly-3f9a" — as a millisecond timestamp.
  // parseInt("fly-3f9a") is NaN -> 0 for every ghost, so the recency sort was a
  // no-op and the age test `0 < cutoff` always passed. The net effect was "keep
  // 10 arbitrary, delete every other ghost no matter how fresh".
  it("keeps the 10 most recent and drops the rest only once they are old", () => {
    const now = 1_800_000_000_000;
    const day = 86_400_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 14; i++) {
      // 0..9 are fresh (within the day), 10..13 are ancient.
      write(`seed-${i}`, i < 10 ? now - i * 1000 : now - 40 * day);
    }
    expect(ghostKeys()).toHaveLength(14);

    const rec = new GhostRecorder();
    rec.sample(GHOST_SAMPLE_DT, 0, 999, 0, 0);
    rec.commit("seed-trigger", 999);

    // The 4 ancient ones are reclaimed. "Keep 10" is a floor, not a ceiling:
    // the 11th ghost is also fresh, so it stays — age only removes entries past
    // the 10th, which is what the original doc comment describes.
    const left = ghostKeys();
    expect(left).toHaveLength(11);
    for (const i of [10, 11, 12, 13]) expect(left).not.toContain(KEY + `seed-${i}`);
    for (let i = 0; i < 10; i++) expect(left).toContain(KEY + `seed-${i}`);
    vi.restoreAllMocks();
  });

  it("reclaims a legacy ghost that has no savedAt at all", () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    for (let i = 0; i < 10; i++) write(`fresh-${i}`, now - i * 1000);
    write("legacy", undefined); // written before savedAt existed

    const rec = new GhostRecorder();
    rec.sample(GHOST_SAMPLE_DT, 0, 5, 0, 0);
    rec.commit("trigger", 5);

    expect(ghostKeys()).not.toContain(KEY + "legacy");
    // 10 fresh + the ghost that triggered the write.
    expect(ghostKeys()).toHaveLength(11);
    for (let i = 0; i < 10; i++) expect(ghostKeys()).toContain(KEY + `fresh-${i}`);
    vi.restoreAllMocks();
  });

  it("reclaims a ghost whose record is corrupt rather than throwing", () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    for (let i = 0; i < 10; i++) write(`fresh-${i}`, now - i * 1000);
    storage.setItem(KEY + "corrupt", "{not json");

    const rec = new GhostRecorder();
    rec.sample(GHOST_SAMPLE_DT, 0, 5, 0, 0);
    expect(() => rec.commit("trigger", 5)).not.toThrow();
    expect(ghostKeys()).not.toContain(KEY + "corrupt");
    vi.restoreAllMocks();
  });
});

describe("GhostRecorder.load", () => {
  it("returns null for a ghost that was never saved", () => {
    expect(GhostRecorder.load("never-flown")).toBeNull();
  });

  it("rejects a record whose samples are not an array", () => {
    storage.setItem(KEY + "bad", JSON.stringify({ seed: "bad", distance: 10, samples: "nope" }));
    expect(GhostRecorder.load("bad")).toBeNull();
  });

  it("survives unparseable JSON instead of throwing", () => {
    storage.setItem(KEY + "broken", "{oh no");
    expect(GhostRecorder.load("broken")).toBeNull();
  });

  it("clamps a tampered sample array back to the cap", () => {
    const samples = Array.from({ length: GHOST_MAX_SAMPLES + 50 }, (_, i) => [i, i, 0, 0]);
    storage.setItem(KEY + "big", JSON.stringify({ seed: "big", distance: 1, samples }));
    expect(GhostRecorder.load("big")!.samples).toHaveLength(GHOST_MAX_SAMPLES);
  });

  it("coerces a missing or non-numeric distance to 0 rather than NaN", () => {
    storage.setItem(KEY + "nodist", JSON.stringify({ seed: "nodist", samples: [[0, 0, 0, 0]] }));
    const rec = GhostRecorder.load("nodist");
    expect(rec?.distance).toBe(0);
    expect(Number.isNaN(rec?.distance ?? NaN)).toBe(false);
  });
});
