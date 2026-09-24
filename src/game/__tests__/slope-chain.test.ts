import { describe, expect, it } from "vitest";
import { SlopeChain } from "../SlopeChain";

describe("slope chain", () => {
  it("links a clean downslope kiss into the next rated launch", () => {
    const flow = new SlopeChain();
    expect(flow.land(0.9, -0.1, 2)).toBe(true);
    expect(flow.launch("great")).toEqual({ chain: 1, points: 30 });
    expect(flow.score).toBe(30);
  });
  it("does not award an unrated lip and breaks on rough or sunflower paths", () => {
    const flow = new SlopeChain();
    flow.land(0.9, -0.1, 2);
    expect(flow.launch("none")).toBeNull();
    flow.land(0.9, -0.1, 2);
    flow.break();
    expect(flow.launch("perfect")).toBeNull();
    expect(flow.land(0.7, -0.1, 7)).toBe(false);
  });
});
