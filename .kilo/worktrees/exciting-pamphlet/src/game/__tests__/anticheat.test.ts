import { describe, expect, it } from "vitest";
import { verifyRunSubmission } from "../AntiCheat";
import { defaultProfile } from "../PlayerProfile";

describe("AntiCheat & Profiles", () => {
  it("generates a valid canonical profile", () => {
    const prof = defaultProfile("player_123", "Ace Pilot");
    expect(prof.playerId).toBe("player_123");
    expect(prof.displayName).toBe("Ace Pilot");
    expect(prof.guest).toBe(true);
    expect(prof.privacy.showOnLeaderboards).toBe(true);
    expect(prof.moderation.status).toBe("clear");
  });

  it("verifies realistic run submissions", () => {
    const res = verifyRunSubmission({
      distance: 1200,
      score: 15000,
      durationMs: 30000,
    });
    expect(res.valid).toBe(true);
    expect(res.quarantined).toBe(false);
  });

  it("quarantines impossible high-speed submissions", () => {
    const res = verifyRunSubmission({
      distance: 10000,
      score: 100000,
      durationMs: 5000, // 2000 m/s average speed!
    });
    expect(res.valid).toBe(false);
    expect(res.quarantined).toBe(true);
    expect(res.reason).toContain("Unrealistic average speed");
  });

  it("quarantines negative telemetry values", () => {
    const res = verifyRunSubmission({
      distance: -500,
      score: 100,
      durationMs: 1000,
    });
    expect(res.valid).toBe(false);
    expect(res.quarantined).toBe(true);
  });
});
