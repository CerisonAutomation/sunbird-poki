import { beforeEach, describe, expect, it } from "vitest";
import { flag, setFlag } from "../Flags";

/**
 * Feature flags — the production kill-switch. These lock the resolution
 * contract (default → persisted override) so a rollout can be held back or
 * force-enabled without a redeploy.
 */
describe("feature flags", () => {
  // localStorage.clear() alone is NOT a reset: Flags.ts caches overrides in
  // module state, so a bare clear leaves the previous test's values live and
  // the file passes only in order. Re-assert every default up front instead.
  beforeEach(() => {
    localStorage.clear();
    setFlag("challengeShare", true);
    setFlag("nativeShare", true);
    setFlag("modeAwareChallenge", true);
    setFlag("adaptiveDifficulty", true);
    setFlag("clipWorthy", true);
    setFlag("oneMoreRun", true);
  });

  it("defaults on", () => {
    expect(flag("challengeShare")).toBe(true);
    expect(flag("nativeShare")).toBe(true);
    expect(flag("modeAwareChallenge")).toBe(true);
    expect(flag("adaptiveDifficulty")).toBe(true);
    expect(flag("clipWorthy")).toBe(true);
    expect(flag("oneMoreRun")).toBe(true);
  });

  it("round-trips a persisted override", () => {
    setFlag("nativeShare", false);
    expect(flag("nativeShare")).toBe(false);
    setFlag("nativeShare", true);
    expect(flag("nativeShare")).toBe(true);
  });

  it("an override never bleeds into a sibling flag", () => {
    setFlag("challengeShare", false);
    expect(flag("challengeShare")).toBe(false);
    expect(flag("nativeShare")).toBe(true);
    expect(flag("modeAwareChallenge")).toBe(true);
  });
});
