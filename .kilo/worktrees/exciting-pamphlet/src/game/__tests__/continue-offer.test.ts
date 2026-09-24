import { describe, expect, it } from "vitest";
import { CONTINUE_OFFER_KINDS, continueOffer, continuePlacementLabel, type ContinueContext } from "../ContinueOffer";

/**
 * Poki MON-19: "improve engagement by using dynamic rewarded video
 * opportunities — time-limited offers or context-specific triggers — rather
 * than static buttons." These tests pin the framing rules and, just as
 * importantly, the boundaries the surrounding monetization rules impose:
 * the offer never invents an ad (MON-12), never turns a neutral moment into a
 * pushy one (MON-15) and never claims a reward the run did not earn.
 */
const base: ContinueContext = {
  distance: 900,
  runCoins: 120,
  personalBest: 4000,
  streakDays: 1,
  nearBest: false,
  isRecord: false,
  altitude: 30,
  adAvailable: true,
};

describe("context-driven continue offer (MON-19)", () => {
  it("celebrates a record run", () => {
    const offer = continueOffer({ ...base, distance: 5200, isRecord: true });
    expect(offer.kind).toBe("record");
    expect(offer.highlight).toBe(true);
    expect(offer.reason).toMatch(/best flight/i);
  });

  it("narrows the gap on a near-best run", () => {
    const offer = continueOffer({ ...base, distance: 3700, nearBest: true, personalBest: 4000 });
    expect(offer.kind).toBe("near-best");
    expect(offer.reason).toContain("300 m");
  });

  it("protects a real streak", () => {
    const offer = continueOffer({ ...base, streakDays: 6 });
    expect(offer.kind).toBe("streak");
    expect(offer.reason).toContain("Day 6");
  });

  it("acknowledges momentum on a long run without shouting about it", () => {
    const offer = continueOffer({ ...base, distance: 1500 });
    expect(offer.kind).toBe("momentum");
    expect(offer.highlight).toBe(false);
  });

  it("stays neutral when nothing about the run stands out", () => {
    const offer = continueOffer({ ...base, distance: 200 });
    expect(offer.kind).toBe("standard");
    expect(offer.highlight).toBe(false);
    expect(offer.title).toBe("Second Wind");
  });

  it("never implies an ad when the platform offered no rewarded break (MON-12)", () => {
    for (const context of [
      { ...base, adAvailable: false },
      { ...base, adAvailable: false, isRecord: true, distance: 9000 },
      { ...base, adAvailable: false, streakDays: 30 },
    ]) {
      const offer = continueOffer(context);
      expect(offer.kind).toBe("standard");
      expect(offer.highlight).toBe(false);
      expect(offer.reason.toLowerCase()).not.toMatch(/ad|video|watch/);
    }
  });

  it("always returns a valid, total shape — the card can render any input", () => {
    const contexts: ContinueContext[] = [
      base,
      { ...base, distance: 0, personalBest: 0, streakDays: 0, adAvailable: false },
      { ...base, distance: -5, personalBest: -1, nearBest: true, isRecord: true },
      { ...base, distance: Number.NaN === 0 ? 0 : 12345, personalBest: 1, nearBest: true },
    ];
    for (const context of contexts) {
      const offer = continueOffer(context);
      expect(CONTINUE_OFFER_KINDS).toContain(offer.kind);
      expect(offer.title.length).toBeGreaterThan(0);
      expect(offer.reason.length).toBeGreaterThan(0);
      expect(typeof offer.highlight).toBe("boolean");
    }
  });

  it("keeps the rewarded label honest and measurable (MON-04, REQ-14)", () => {
    expect(continuePlacementLabel("record")).toBe("continue-ad-record");
    for (const kind of CONTINUE_OFFER_KINDS) {
      expect(continuePlacementLabel(kind)).toMatch(/^continue-ad-[a-z-]+$/);
    }
  });

  it("prefers the strongest context when several apply", () => {
    const offer = continueOffer({ ...base, distance: 5200, isRecord: true, nearBest: true, streakDays: 12 });
    expect(offer.kind).toBe("record");
  });
});
