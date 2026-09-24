import { describe, expect, it } from "vitest";
import { thin } from "../GhostNet";

type Sample = [number, number, number, number];

function ramp(n: number): Sample[] {
  return Array.from({ length: n }, (_, i) => [i * 0.1, i, i * 2, 0] as Sample);
}

describe("ghostnet sample thinning", () => {
  it("returns a copy when already under the cap", () => {
    const s = ramp(100);
    const out = thin(s, 1500);
    expect(out).toHaveLength(100);
    expect(out).not.toBe(s);
    expect(out[0]).toEqual(s[0]);
  });

  it("downsamples to exactly the cap, keeping first and last", () => {
    const s = ramp(6000);
    const out = thin(s, 1500);
    expect(out).toHaveLength(1500);
    expect(out[0]).toEqual(s[0]);
    expect(out[out.length - 1]).toEqual(s[s.length - 1]);
  });

  it("preserves monotonic time order after thinning", () => {
    const out = thin(ramp(5000), 1500);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]![0]).toBeGreaterThan(out[i - 1]![0]);
    }
  });
});
