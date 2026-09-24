/**
 * "Can you beat this?" — marks worth flying at, as places in the world, and the
 * band the banner that celebrates them is allowed to occupy.
 *
 * Two things are guarded here:
 *
 *  1. **`BeatLines.ts`** — every number the game already had (personal best,
 *     today's best, a rival's shared mark, the daily target, the lead distance
 *     goal) turned into at most three flags ahead of the bird: ranked by how close
 *     they are, collapsed when two would stand on top of each other, silent until
 *     one is inside the cue window, and crossing exactly once.
 *  2. **`HudLayout.ts`** — the banner floats outside the arbitrated message lane on
 *     purpose, so its position has to come from the *measured* header and footer
 *     lanes rather than a viewport percentage. These are the numbers that say it
 *     cannot land on top of either, on a tall portrait phone or a 360px landscape
 *     one with four rows in the footer.
 *
 * Plus the HUD row that counts down to the nearest flag, and the escaping of a
 * rival's name — which arrives from a shared link, i.e. from another player.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BEAT_CUE_WINDOW,
  BEAT_MAX_LINES,
  BEAT_MIN_GAP,
  BEAT_PRIORITY,
  beatTargets,
  crossedBeatLines,
  nearestBeatLine,
  type BeatLineInput,
} from "../BeatLines";
import { bannerBudget, bannerCentre, bannerFits, FOOTER_FALLBACK_PX, freeBand, HEADER_FALLBACK_PX } from "../HudLayout";

import { cssRules, mountHud } from "./hudHarness";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  vi.spyOn(performance, "now").mockReturnValue(60_000);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/**
 * `mountHud` appends a real HUD to `document.body`, so a test that mounts twice
 * would otherwise query the first one. One mount per body, always.
 */
async function freshMount(overrides: Record<string, unknown> = {}) {
  document.body.innerHTML = "";
  return mountHud(overrides);
}

const LABELS = { rival: "Beat MIKA", best: "Your best", daily: "FAR SHORE", today: "Today's best", goal: "Goal" };
const format = (n: number) => `${Math.round(n)} m`;

function input(over: Partial<BeatLineInput> = {}): BeatLineInput {
  return {
    distance: 0,
    best: 1240,
    todayBest: 980,
    rival: null,
    dailyTarget: null,
    goalTarget: null,
    labels: LABELS,
    format,
    ...over,
  };
}

describe("the marks ahead: what stands in the world this run", () => {
  it("stands a flag at the personal best and at today's best, nearest first", () => {
    const targets = beatTargets(input());

    expect(targets.map((t) => t.kind)).toEqual(["today", "best"]);
    expect(targets.map((t) => t.at)).toEqual([980, 1240]);
  });

  it("drops a mark the bird has already flown past — the crossing was the report", () => {
    const targets = beatTargets(input({ distance: 1000 }));

    expect(targets.map((t) => t.kind)).toEqual(["best"]);
  });

  it("adds a rival's shared mark and a daily target, still capped at three", () => {
    const targets = beatTargets(
      input({ distance: 0, rival: { name: "Mika", distance: 1105 }, dailyTarget: 1500, goalTarget: 900 }),
    );

    expect(targets).toHaveLength(BEAT_MAX_LINES);
    // Nearest three of five candidates: the goal (900), today's best (980) and the
    // rival's mark (1105). Your own best (1240) and the daily (1500) are further
    // out and wait their turn — the cap is about clutter, not about preference.
    expect(targets.map((t) => t.at)).toEqual([900, 980, 1105]);
  });

  it("collapses two marks that would stand on top of each other, keeping the social one", () => {
    // A rival's mark 20 m from your own best: one flag, and it is theirs, because
    // theirs is the reason someone sent you a link.
    const targets = beatTargets(input({ best: 1240, rival: { name: "Mika", distance: 1260 } }));

    expect(targets.filter((t) => t.at >= 1240 && t.at <= 1260)).toHaveLength(1);
    expect(targets.find((t) => t.kind === "rival")).toBeTruthy();
    expect(BEAT_PRIORITY[0]).toBe("rival");
    expect(BEAT_MIN_GAP).toBeGreaterThan(20);
  });

  it("keeps the higher-priority mark whichever order they arrive in", () => {
    const rivalFirst = beatTargets(input({ best: 1260, rival: { name: "Mika", distance: 1240 } }));
    const bestFirst = beatTargets(input({ best: 1240, rival: { name: "Mika", distance: 1260 } }));

    expect(rivalFirst.find((t) => t.at === 1240)!.kind).toBe("rival");
    expect(bestFirst.find((t) => t.at === 1260)!.kind).toBe("rival");
  });

  it("stands no flag for a record the player does not have yet", () => {
    expect(beatTargets(input({ best: 0, todayBest: 0 }))).toEqual([]);
  });

  it("drops a kind the caller supplied no words for, rather than flying a blank flag", () => {
    const targets = beatTargets(input({ labels: { best: "Your best" } }));

    expect(targets.map((t) => t.kind)).toEqual(["best"]);
  });

  it("carries the caller's own words and number format — the seam owns geometry, not vocabulary", () => {
    const [first] = beatTargets(input({ format: (n) => `${n} METRES` }));

    expect(first!.label).toBe("Today's best");
    expect(first!.metres).toBe("980 METRES");
  });

  it("reads non-finite and negative inputs as no mark, never as a flag behind the bird", () => {
    expect(beatTargets(input({ best: Number.NaN, todayBest: Number.POSITIVE_INFINITY }))).toEqual([]);
    // A broken distance reads as "at the start line", so today's best still
    // stands a flag ahead; a negative record stands none.
    expect(beatTargets(input({ distance: Number.NaN, best: -50, todayBest: 0 }))).toEqual([]);
    expect(beatTargets(input({ distance: Number.NaN, best: -50 })).map((t) => t.kind)).toEqual(["today"]);
    expect(beatTargets(input({ distance: -900, best: 1240, todayBest: 0 })).map((t) => t.at)).toEqual([1240]);
  });

  it("rounds a mark to whole metres, because that is what the flag prints", () => {
    expect(beatTargets(input({ best: 1240.6, todayBest: 0 })) [0]!.at).toBe(1241);
  });
});

describe("the countdown: silent until the mark is close enough to matter", () => {
  it("says nothing while the nearest mark is scenery", () => {
    const targets = beatTargets(input({ best: 5000, todayBest: 0 }));

    expect(nearestBeatLine(targets, 0)).toBeNull();
    expect(BEAT_CUE_WINDOW).toBeLessThan(5000);
  });

  it("names the nearest mark once it is inside the window", () => {
    const targets = beatTargets(input({ best: 1240, todayBest: 1100 }));

    expect(nearestBeatLine(targets, 900)!.kind).toBe("today"); // 200 m out vs 340 m
    expect(nearestBeatLine(targets, 1150)!.kind).toBe("best"); // today's is behind now
  });

  it("goes quiet again the moment the mark is behind the bird", () => {
    const targets = beatTargets(input({ best: 1240, todayBest: 0 }));

    expect(nearestBeatLine(targets, 1240)).toBeNull();
    expect(nearestBeatLine(targets, 1300)).toBeNull();
  });

  it("honours a caller-supplied window, and a broken one", () => {
    const targets = beatTargets(input({ best: 1240, todayBest: 0 }));

    expect(nearestBeatLine(targets, 0, 2000)!.kind).toBe("best");
    expect(nearestBeatLine(targets, 0, Number.NaN)).toBeNull();
  });
});

describe("the crossing: once, on the frame it happens", () => {
  it("returns exactly the marks this frame flew past", () => {
    const ahead = beatTargets(input({ best: 1240, todayBest: 1100 }));

    expect(crossedBeatLines(ahead, 1099)).toEqual([]);
    expect(crossedBeatLines(ahead, 1100).map((t) => t.kind)).toEqual(["today"]);
    expect(crossedBeatLines(ahead, 1240).map((t) => t.kind)).toEqual(["today", "best"]);
  });

  it("counts a mark as beaten at its exact distance, not one metre past it", () => {
    const ahead = beatTargets(input({ best: 1240, todayBest: 0 }));

    expect(crossedBeatLines(ahead, 1240)).toHaveLength(1);
  });

  it("cannot report a crossing for a mark that was never ahead", () => {
    // A goal that refills to a number the run has already passed must not fire:
    // it was never something the player was about to beat.
    expect(crossedBeatLines([], 9999)).toEqual([]);
  });

  it("treats a non-finite distance as no crossing rather than every crossing", () => {
    const ahead = beatTargets(input({ best: 1240, todayBest: 1100 }));

    expect(crossedBeatLines(ahead, Number.NaN)).toEqual([]);
  });
});

describe("the banner's band: measured lanes, not a guessed percentage", () => {
  const portrait = { header: HEADER_FALLBACK_PX, footer: FOOTER_FALLBACK_PX, viewport: 640 };
  const landscape = { header: 100, footer: 65, viewport: 360 };
  const landscapeCrowded = { header: 100, footer: 150, viewport: 360 }; // four strip rows

  it("leaves the whole space between the lanes, and never a negative one", () => {
    expect(freeBand(portrait)).toEqual({ top: 110, height: 465 });
    expect(freeBand({ header: 110, footer: 150, viewport: 200 })).toEqual({ top: 110, height: 0 });
  });

  it("centres the banner in that band, so it is as far as possible from both lanes", () => {
    expect(bannerCentre(portrait)).toBe(110 + 465 / 2);
    expect(bannerCentre(landscapeCrowded)).toBe(100 + (360 - 100 - 150) / 2);
  });

  it("clears both lanes on a tall phone and on a crowded 360px landscape one", () => {
    // A full-size banner on a portrait phone: 56px tall, centred at 342.5.
    const centre = bannerCentre(portrait);
    expect(centre - 28).toBeGreaterThan(portrait.header);
    expect(centre + 28).toBeLessThan(portrait.viewport - portrait.footer);
    expect(bannerFits(portrait, 56)).toBe(true);

    // A landscape phone with four footer rows leaves 110px of band: enough for
    // the shrunk banner, not enough for a full-size one plus a launch banner,
    // which is why the short-viewport rules cut the type rather than hide the
    // moment. bannerFits is the predicate that decision is made with.
    expect(bannerFits(landscapeCrowded, 34)).toBe(true);
    expect(bannerFits(landscapeCrowded, 140)).toBe(false);
    // The same phone with a one-row footer leaves far more room — the band tracks
    // the chrome, which is the whole reason it is not a percentage of the viewport.
    expect(bannerBudget(landscape)).toBe(360 - 100 - 65);
    expect(bannerBudget(landscape)).toBeGreaterThan(bannerBudget(landscapeCrowded));
    expect(bannerBudget(landscapeCrowded)).toBe(110);
    const small = bannerCentre(landscapeCrowded);
    expect(small - 17).toBeGreaterThan(landscapeCrowded.header);
    expect(small + 17).toBeLessThan(landscapeCrowded.viewport - landscapeCrowded.footer);
  });

  it("falls back to the stylesheet's own defaults on a broken measurement", () => {
    expect(freeBand({ header: Number.NaN, footer: Number.NaN, viewport: 640 })).toEqual({
      top: HEADER_FALLBACK_PX,
      height: 640 - HEADER_FALLBACK_PX - FOOTER_FALLBACK_PX,
    });
    expect(freeBand({ header: -40, footer: 0, viewport: 640 }).top).toBe(HEADER_FALLBACK_PX);
  });

  it("the stylesheet uses that formula, and the two cannot drift apart silently", () => {
    const base = cssRules("game/ui.css").filter((r) => r.sel === ".rank-up").pop()!;
    const top = /top:\s*calc\(([^;]+)\);/.exec(base.body)?.[1] ?? "";

    expect(top).toContain(`var(--hud-header-height, ${HEADER_FALLBACK_PX}px)`);
    expect(top).toContain(`var(--hud-footer-height, ${FOOTER_FALLBACK_PX}px)`);
    expect(top).toContain("100vh");
    expect(top).toMatch(/\)\s*\/\s*2$/); // header + (viewport - header - footer) / 2
  });
});

describe("the countdown row in the goal strip", () => {
  const beat = { kind: "best", label: "Your best", metres: "1,240 m", gap: 100 };

  it("leads the strip, so a short viewport keeps the mark about to be beaten", async () => {
    const { root } = await mountHud({
      beatLine: beat,
      sessionGoals: [{ id: "g0", kind: "distance", target: 900, label: "Fly 900 m", reward: 52, progress: 300, done: false }],
    });
    const rows = [...root.querySelectorAll<HTMLElement>('[data-ref="goalStrip"] .gs')];

    expect(rows[0]!.classList.contains("gs-beat"), "the mark must be the first row").toBe(true);
    expect(rows[0]!.querySelector("em")!.textContent).toBe("Your best");
    expect(rows[0]!.querySelector("u")!.textContent).toMatch(/to go/);
  });

  it("fills its bar as the gap closes — a countdown that reads like progress", async () => {
    // Captured one at a time: clearing the body for the second mount destroys the
    // first mount's DOM, so a test that compares two mounts must read as it goes.
    const width = (r: ParentNode) => parseFloat((r.querySelector<HTMLElement>(".gs-beat b")!.getAttribute("style") ?? "").replace(/[^0-9.]/g, ""));
    const wideWidth = width((await freshMount({ beatLine: { ...beat, gap: 300 } })).root);
    const nearWidth = width((await freshMount({ beatLine: { ...beat, gap: 100 } })).root);

    expect(wideWidth).toBe(25); // 300 m left of a 400 m window
    expect(nearWidth).toBe(75); // 100 m left: three quarters of the way to the flag
    expect(wideWidth).toBeLessThan(nearWidth);
  });

  it("counts down in 25 m steps, not every frame", async () => {
    const a = await mountHud({ beatLine: { ...beat, gap: 100 } });
    const textA = a.root.querySelector(".gs-beat u")!.textContent;
    Object.assign(a.snap, { beatLine: { ...beat, gap: 91 }, version: 2 });
    a.hud.update(a.snap as never);
    const textB = a.root.querySelector(".gs-beat u")!.textContent;
    Object.assign(a.snap, { beatLine: { ...beat, gap: 60 }, version: 3 });
    a.hud.update(a.snap as never);
    const textC = a.root.querySelector(".gs-beat u")!.textContent;

    expect(textB, "91 m is inside the same 25 m step as 100 m").toBe(textA);
    expect(textC, "60 m is a different step").not.toBe(textA);
  });

  it("marks the row as imminent when the flag is nearly under the bird", async () => {
    const isClose = (r: ParentNode) => r.querySelector(".gs-beat")!.classList.contains("close");
    const near = isClose((await freshMount({ beatLine: { ...beat, gap: 90 } })).root);
    const far = isClose((await freshMount({ beatLine: { ...beat, gap: 300 } })).root);

    expect(near).toBe(true);
    expect(far).toBe(false);
  });

  it("renders no row when nothing is inside the window, and leaves the goals alone", async () => {
    const { root } = await mountHud({
      beatLine: null,
      sessionGoals: [{ id: "g0", kind: "distance", target: 900, label: "Fly 900 m", reward: 52, progress: 300, done: false }],
    });

    expect(root.querySelector(".gs-beat")).toBeFalsy();
    expect(root.querySelectorAll(".gs").length).toBeGreaterThan(0);
  });

  it("escapes a rival's name, which arrives from another player's shared link", async () => {
    const { root } = await mountHud({
      beatLine: { kind: "rival", label: `<img src=x onerror="window.__beatPwned = 7">`, metres: "1,105 m", gap: 120 },
    });

    expect(document.querySelectorAll("img, script, iframe").length).toBe(0);
    expect((globalThis as { __beatPwned?: number }).__beatPwned).toBeUndefined();
    expect(root.querySelector(".gs-beat em")!.textContent).toContain("<img src=x");
  });

  it("is styled apart from the goal rows, and adds no positioning of its own to overlap with", () => {
    const beat_rules = cssRules("game/ui.css").filter((r) => r.sel.includes(".gs-beat"));

    expect(beat_rules.length, "the beat row must have its own treatment").toBeGreaterThan(0);
    expect(beat_rules.map((r) => r.body).join("")).toMatch(/var\(--coin-gold\)/);
    for (const rule of beat_rules) {
      // It inherits the strip's slot in the footer lane: a row that positioned
      // itself would be a new overlap surface on every breakpoint.
      expect(rule.body, `${rule.sel} must not position itself`).not.toMatch(/position:\s*(absolute|fixed)/);
      expect(rule.body, `${rule.sel} must not leave the flow`).not.toMatch(/display:\s*none/);
    }
  });
});
