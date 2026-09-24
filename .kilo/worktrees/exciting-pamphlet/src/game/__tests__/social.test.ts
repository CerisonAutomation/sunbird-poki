import { describe, expect, it } from "vitest";
import { buildShareText } from "../Social";

/**
 * The fused viral loop: the share text carries the referral code and,
 * when the challenge rollout flag is on, its own beat-me link. Pure
 * function — no canvas needed, so the grammar is pinned without jsdom
 * canvas support.
 */
describe("share text", () => {
  it("keeps the legacy text when no challenge link is attached", () => {
    expect(buildShareText({ distance: 1234.7, referralCode: "ABC123" })).toBe(
      "I flew 1234m in Sunbird 🌤️ Use my code ABC123 for a bonus!",
    );
  });

  it("appends the beat-me link when a challenge URL is fused", () => {
    const url = "https://example.test/#rival=seed-1.500.Ace";
    const text = buildShareText({ distance: 500, referralCode: "ABC123", challengeUrl: url });
    expect(text).toContain("ABC123");
    expect(text).toContain(`Beat me here: ${url}`);
  });

  it("floors fractional distances like the card renderer", () => {
    expect(buildShareText({ distance: 99.9, referralCode: "X" })).toContain("99m");
  });
});
