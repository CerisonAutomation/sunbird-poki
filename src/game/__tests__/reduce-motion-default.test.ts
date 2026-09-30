import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "../SaveData";

/**
 * `reduceMotion` used to default to a hard-coded `false`, so a player who had
 * switched reduced motion on at the OS level still got screen shake, hit-stop
 * and full-screen flashes on their very first run, and could only turn them
 * off after being hit by all of them. The OS preference is a stated
 * accessibility need and there is no reason to make someone restate it.
 */
describe("reduced motion follows the operating system", () => {
  const mockMatchMedia = (matches: boolean): void => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the OS preference when it is set", () => {
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("stays off when the OS has no preference", () => {
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("never throws where there is no window or no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal("matchMedia", () => {
      throw new Error("blocked");
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
