import { afterEach, describe, expect, it, vi } from "vitest";
import { mountHud } from "./hudHarness";

vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
afterEach(() => { document.body.innerHTML = ""; });

describe("flight daylight meter", () => {
  it.each([
    [100, 100, "100", false],
    [25, 100, "25", true],
    [-10, 100, "0", true],
    [120, 100, "100", false],
    [0, 0, "0", true],
  ])("reports remaining daylight accessibly (%s/%s)", async (daylight, daylightMax, percent, low) => {
    const { root } = await mountHud({ daylight, daylightMax });
    const meter = root.querySelector<HTMLElement>('[data-ref="sunFill"]')!;
    expect(meter.getAttribute("role")).toBe("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe(percent);
    expect(meter.classList.contains("low")).toBe(low);
    expect(meter.style.width).toBe(`${Math.max(2, Number(percent))}%`);
  });
});
