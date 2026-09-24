import { describe, expect, it } from "vitest";
import {
  CLIP_KINDS, CLIPS, CLIP_SHARE_THRESHOLD, ClipLedger,
  MOMENT_KINDS, MOMENTS, MomentLedger,
  clipFromMoment, clipHappyTime, clipShareLine, isClipWorthy, momentNextAction,
  momentRepeatGap, momentShouldReact, pickCta, viralScore, type CtaContext,
} from "../Moments";

describe("moment reaction table", () => {
  it("defines a complete bundle for every kind", () => {
    for (const kind of MOMENT_KINDS) {
      const def = MOMENTS[kind];
      expect(def).toBeDefined();
      expect(def.kind).toBe(kind);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.label.length).toBeGreaterThan(0);
      // i18n keys follow the documented namespace so the barrel can be audited.
      expect(def.key).toBe(`moments.${kind}`);
      expect(def.cardKey).toBe(`moments.${kind}.card`);
      expect(def.popup).toBeTruthy();
      expect(def.tone).toBeTruthy();
      expect(def.shout.length).toBeGreaterThan(0);
      expect(def.next.title.length).toBeGreaterThan(0);
      expect(def.next.tip.length).toBeGreaterThan(0);
    }
  });

  it("writes a readable card line for one and for many", () => {
    for (const kind of MOMENT_KINDS) {
      for (const n of [1, 2, 7]) {
        const line = MOMENTS[kind].cardLine(n);
        expect(typeof line).toBe("string");
        expect(line.length).toBeGreaterThan(3);
        expect(line).not.toContain("NaN");
        expect(line).not.toContain("undefined");
      }
    }
  });

  it("keeps shout text short enough for a popup", () => {
    for (const kind of MOMENT_KINDS) expect(MOMENTS[kind].shout.length).toBeLessThanOrEqual(10);
  });
});

describe("MomentLedger", () => {
  it("counts occurrences and reports the new total", () => {
    const led = new MomentLedger();
    expect(led.record("bonk")).toBe(1);
    expect(led.record("bonk")).toBe(2);
    expect(led.count("bonk")).toBe(2);
    expect(led.count("splash")).toBe(0);
    expect(led.length).toBe(2);
  });

  it("starts with an empty recap so the card can skip the strip", () => {
    const led = new MomentLedger();
    expect(led.recapLine()).toBe("");
    expect(led.tally()).toEqual([]);
    expect(led.headline()).toBeNull();
    expect(led.toJSON()).toEqual({});
  });

  it("orders the tally by frequency, then by chronology", () => {
    const led = new MomentLedger();
    led.record("splash");
    led.record("bonk");
    led.record("bonk");
    led.record("splash");
    led.record("record");
    const rows = led.tally();
    expect(rows.map((r) => r.kind)).toEqual(["splash", "bonk", "record"]);
    expect(rows[0].count).toBe(2);
    expect(rows[0].icon).toBe(MOMENTS.splash.icon);
    expect(rows[0].key).toBe("moments.splash");
  });

  it("caps the tally when asked", () => {
    const led = new MomentLedger();
    for (const kind of MOMENT_KINDS) led.record(kind);
    expect(led.tally(3)).toHaveLength(3);
    expect(led.tally(0)).toHaveLength(MOMENT_KINDS.length);
  });

  it("names the dominant moment as the headline", () => {
    const led = new MomentLedger();
    led.record("perfect");
    led.record("bonk");
    led.record("bonk");
    expect(led.headline()).toBe("bonk");
    expect(momentNextAction(led)).toEqual(MOMENTS.bonk.next);
  });

  it("has no headline and no CTA for an uneventful flight", () => {
    expect(momentNextAction(new MomentLedger())).toBeNull();
  });

  it("emits only fired kinds for telemetry", () => {
    const led = new MomentLedger();
    led.record("sleep");
    led.record("sleep");
    expect(led.toJSON()).toEqual({ sleep: 2 });
  });

  it("keeps session memory across run resets", () => {
    const led = new MomentLedger();
    expect(led.isFirstEver("boing")).toBe(true);
    led.record("boing");
    led.record("boing");
    expect(led.isFirstEver("boing")).toBe(false);
    led.resetRun();
    expect(led.length).toBe(0);
    expect(led.recapLine()).toBe("");
    // "First funny moment" must never be reported twice in one session.
    expect(led.isFirstEver("boing")).toBe(false);
    led.resetAll();
    expect(led.isFirstEver("boing")).toBe(true);
  });

  it("writes a recap line listing the loudest moments", () => {
    const led = new MomentLedger();
    led.record("bonk");
    led.record("bonk");
    led.record("record");
    expect(led.recapLine()).toContain("2 BONK");
    expect(led.recapLine()).toContain("1 RECORD");
    expect(led.recapLine().split("\u00b7")).toHaveLength(2);
  });
});

describe("repeat throttle", () => {
  it("suppresses same-frame repeats", () => {
    expect(momentShouldReact(0, 0.1)).toBe(false);
    expect(momentShouldReact(1, 0.29)).toBe(false);
    expect(momentShouldReact(1, 0.3)).toBe(true);
  });

  it("always lets the first three land", () => {
    for (const n of [0, 1, 2]) expect(momentShouldReact(n, 0.31)).toBe(true);
  });

  it("slows the cadence as a run gets chaotic", () => {
    const gaps = [0, 3, 7, 15].map((n) => momentRepeatGap(n));
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    expect(momentShouldReact(7, 1)).toBe(false);
    expect(momentShouldReact(7, 2.3)).toBe(true);
    expect(momentShouldReact(15, 4.9)).toBe(false);
    expect(momentShouldReact(15, 5)).toBe(true);
  });

  it("caps the count a single stall can produce", () => {
    const led = new MomentLedger();
    let clock = 0;
    let last = Number.NEGATIVE_INFINITY;
    // 10 s of stalling sampled at 60 Hz, exactly what a beached bird does.
    for (let frame = 0; frame < 600; frame += 1) {
      clock += 1 / 60;
      if (momentShouldReact(led.count("panic"), clock - last)) {
        led.record("panic");
        last = clock;
      }
    }
    expect(led.count("panic")).toBeGreaterThan(3);
    expect(led.count("panic")).toBeLessThan(25);
  });
});

describe("clip table", () => {
  it("defines a complete bundle for every kind", () => {
    for (const kind of CLIP_KINDS) {
      const def = CLIPS[kind];
      expect(def.kind).toBe(kind);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.shout.length).toBeLessThanOrEqual(10);
      expect(def.weight).toBeGreaterThan(0);
    }
  });

  it("maps only the clip-shaped comedy moments", () => {
    expect(clipFromMoment("phew")).toBe("near_miss");
    expect(clipFromMoment("wee")).toBe("near_miss");
    expect(clipFromMoment("bonk")).toBe("crash");
    expect(clipFromMoment("splash")).toBe("crash");
    expect(clipFromMoment("record")).toBe("perfect_run");
    expect(clipFromMoment("perfect")).toBeNull();
    expect(clipFromMoment("panic")).toBeNull();
    expect(clipFromMoment("sleep")).toBeNull();
    expect(clipFromMoment("boing")).toBeNull();
  });

  it("covers every moment kind without throwing", () => {
    for (const kind of MOMENT_KINDS) {
      expect(() => clipFromMoment(kind)).not.toThrow();
    }
  });

  it("keeps happyTime inside Poki's 0..1 range and silent on crashes", () => {
    for (const kind of CLIP_KINDS) {
      const h = clipHappyTime(kind);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(clipHappyTime("crash")).toBe(0);
    expect(clipHappyTime("last_second")).toBe(1);
  });
});

describe("ClipLedger", () => {
  it("counts, tallies by frequency, and recaps", () => {
    const led = new ClipLedger();
    expect(led.record("crash")).toBe(1);
    expect(led.record("near_miss")).toBe(1);
    expect(led.record("crash")).toBe(2);
    expect(led.length).toBe(3);
    expect(led.headline()).toBe("crash");
    expect(led.tally().map((r) => r.kind)).toEqual(["crash", "near_miss"]);
    expect(led.recapLine()).toContain("CRASH");
    expect(led.toJSON()).toEqual({ crash: 2, near_miss: 1 });
  });

  it("starts empty so the card can skip the strip", () => {
    const led = new ClipLedger();
    expect(led.recapLine()).toBe("");
    expect(led.tally()).toEqual([]);
    expect(led.headline()).toBeNull();
  });

  it("resetRun keeps session-long firsts", () => {
    const led = new ClipLedger();
    expect(led.isFirstEver("overtake")).toBe(true);
    expect(led.isFirstEver("overtake")).toBe(false);
    led.record("overtake");
    led.resetRun();
    expect(led.length).toBe(0);
    expect(led.isFirstEver("overtake")).toBe(false);
    led.resetAll();
    expect(led.isFirstEver("overtake")).toBe(true);
  });
});

describe("viralScore", () => {
  it("scores a photo-finish record as clip-worthy", () => {
    const score = viralScore({
      clips: { last_second: 1, overtake: 2 },
      distance: 2100,
      newBest: true,
      nearMiss: false,
      photoFinish: true,
      perfects: 3,
      crashes: 0,
    });
    expect(score).toBeGreaterThanOrEqual(CLIP_SHARE_THRESHOLD);
    expect(isClipWorthy(score)).toBe(true);
  });

  it("caps a beach of crashes so they cannot outrank a finish", () => {
    const crashy = viralScore({
      clips: { crash: 40 },
      distance: 800,
      newBest: false,
      nearMiss: false,
      photoFinish: false,
      perfects: 0,
      crashes: 40,
    });
    const finish = viralScore({
      clips: { last_second: 1 },
      distance: 800,
      newBest: false,
      nearMiss: false,
      photoFinish: true,
      perfects: 0,
      crashes: 0,
    });
    expect(finish).toBeGreaterThan(crashy);
  });

  it("refuses to call a 40 m hop clip-worthy", () => {
    const score = viralScore({
      clips: { last_second: 1, perfect_run: 1 },
      distance: 40,
      newBest: true,
      nearMiss: true,
      photoFinish: true,
      perfects: 8,
      crashes: 0,
    });
    expect(score).toBeLessThanOrEqual(20);
    expect(isClipWorthy(score)).toBe(false);
  });
});

describe("clipShareLine", () => {
  it("builds a beat-me sentence and sanitises the name", () => {
    const line = clipShareLine(70, "1 PHOTO FINISH", 1840, "Pilot 7Q2F");
    expect(line).toContain("1,840");
    expect(line).toContain("Pilot 7Q2F");
    expect(line).toContain("beat them");
  });

  it("stays quiet when there is nothing to send", () => {
    expect(clipShareLine(10, "", 900, "x")).toBe("");
    expect(clipShareLine(80, "1 CRASH", 0, "x")).toBe("");
  });
});

describe("pickCta", () => {
  const ctx = (over: Partial<CtaContext> = {}): CtaContext => ({
    viralScore: 10,
    newBest: false,
    nearMiss: false,
    photoFinish: false,
    runsPlayed: 4,
    challengeShareOn: true,
    experimentShareFirst: false,
    ...over,
  });

  it("teaches Fly again on the first recap", () => {
    const pick = pickCta(ctx({ runsPlayed: 0, viralScore: 90, photoFinish: true }));
    expect(pick.primary).toBe("retry");
    expect(pick.shareFirst).toBe(false);
  });

  it("leads with Challenge when the run is clip-worthy", () => {
    const pick = pickCta(ctx({ viralScore: 80, photoFinish: true }));
    expect(pick.primary).toBe("challenge");
    expect(pick.reason).toBe("clip");
    expect(pick.shareFirst).toBe(false);
  });

  it("falls back to Share when challenge links are flagged off", () => {
    const pick = pickCta(ctx({ viralScore: 80, challengeShareOn: false }));
    expect(pick.primary).toBe("share");
    expect(pick.shareFirst).toBe(true);
  });

  it("leads with Retry on a near-miss that was not a record", () => {
    const pick = pickCta(ctx({ nearMiss: true, viralScore: 20, experimentShareFirst: true }));
    expect(pick.primary).toBe("retry");
    expect(pick.reason).toBe("near_miss");
  });

  it("honours the A/B when nothing more specific applies", () => {
    const pick = pickCta(ctx({ experimentShareFirst: true }));
    expect(pick.shareFirst).toBe(true);
    expect(pick.reason).toBe("experiment");
  });
});
