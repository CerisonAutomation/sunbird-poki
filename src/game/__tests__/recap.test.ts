import { describe, expect, it } from "vitest";
import { renderFlightRecap } from "../HUD";

describe("flight recap sparkline", () => {
  const flight: [number, number][] = [
    [0, 2],
    [120, 40],
    [260, 88],
    [400, 30],
    [560, 61],
    [780, 12],
    [900, 4],
  ];

  it("renders an svg path with a peak marker", () => {
    const html = renderFlightRecap(flight);
    expect(html).toContain("<svg");
    expect(html).toContain("fr-peak");
    expect(html).toContain("88 m peak");
    expect(html).toContain("<circle");
  });

  it("renders nothing for degenerate paths", () => {
    expect(renderFlightRecap([])).toBe("");
    expect(renderFlightRecap([[0, 1], [10, 2]])).toBe("");
  });

  it("never emits NaN coordinates even for flat flights", () => {
    const flat: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const html = renderFlightRecap(flat);
    expect(html).not.toContain("NaN");
  });

  it("clamps negative altitudes to the floor", () => {
    const dip: [number, number][] = [
      [0, 5],
      [10, -8],
      [20, 12],
    ];
    const html = renderFlightRecap(dip);
    expect(html).not.toContain("NaN");
    expect(html).toContain("12 m peak");
  });
});
