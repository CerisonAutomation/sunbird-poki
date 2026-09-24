/**
 * The flight HUD's goal strip: one live goal, optionally the career rung or a
 * "can you beat this?" countdown, and a stylesheet that is not allowed to hide them.
 *
 * The game always had the machinery — `SessionGoals` keeps three goals in
 * flight, sized to the player's own skill estimate, and refills a slot the
 * instant it completes. Three things stopped it reading as progression:
 *
 *  1. The HUD rendered **only the lead goal**, so a run where the lead was
 *     hopeless and another was 80 % done had nothing on screen to chase.
 *  2. `index.css` set `.flight-footer .goal-strip { display: none }` in two
 *     `max-height: 500px` queries — a phone in landscape and most embedded
 *     portal iframes never saw an in-flight goal at all.
 *  3. Then it rendered **three goals plus career plus beat** — 5 rows — which
 *     is clutter on a phone and the reason players said "too many goals".
 *
 * Fix: max 2 rows — beat + closest goal, or closest goal + career. One primary
 * chase, one secondary, never a wall of bars. Behaviourally guarded here and
 * statically (no display:none) because a bar nobody can see is not a bar.
 *
 * Research grounding: Jetpack Joyride shows 3 missions but highlights 1;
 * Tiny Wings shows 1 island counter. `docs/audits/PROGRESSION_FEEL_2026-09-24.md`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionGoal } from "../Engagement";
import type { HudSnapshot } from "../HUD";

import { cssRules, goal, mount, snapshotStub, WINGS } from "./hudHarness";


/** Rows in rendered order, with the bar width the browser would apply. */
function rows(strip: HTMLElement) {
  return [...strip.querySelectorAll<HTMLElement>(".gs")].map((el) => ({
    el,
    label: el.querySelector("em")?.textContent ?? "",
    count: el.querySelector("u")?.textContent ?? "",
    width: el.querySelector("b")?.getAttribute("style") ?? "",
    close: el.classList.contains("close"),
    career: el.classList.contains("gs-career"),
  }));
}

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

describe("the strip shows the run's goals, not just the nearest one", () => {
  it("renders the single closest goal, not a wall of three", async () => {
    const { strip } = await mount({
      sessionGoals: [
        goal({ id: "g0", label: "Fly 900 m in one run", target: 900, progress: 810, reward: 52 }),
        goal({ id: "g1", kind: "coins", label: "Collect 24 coins", target: 24, progress: 6, reward: 217 }),
        goal({ id: "g2", kind: "perfects", label: "Land 3 perfect launches", target: 3, progress: 1, reward: 49 }),
      ],
    });
    const r = rows(strip);

    // Max 2 rows now: closest goal + career (beat absent), not 3+career=4.
    // Too many goals was clutter — 1 primary chase is readable at 60fps on a phone.
    expect(r).toHaveLength(2);
    expect(r.filter((x) => x.career)).toHaveLength(1);
    // Ranked by fill, so 810/900 (90 %) leads — only the closest is shown.
    expect(r.filter((x) => !x.career).map((x) => x.label)).toEqual(["Fly 900 m in one run"]);
  });

  it("ranks the closest goal first, because that is the one worth chasing", async () => {
    const { strip } = await mount({
      sessionGoals: [
        goal({ id: "g0", target: 900, progress: 100, label: "far" }),
        goal({ id: "g1", kind: "coins", target: 20, progress: 18, label: "nearly" }),
        goal({ id: "g2", kind: "perfects", target: 4, progress: 1, label: "mid" }),
      ],
    });

    // Only the closest goal is rendered now — max 2 rows total.
    expect(rows(strip).filter((r) => !r.career).map((r) => r.label)).toEqual(["nearly"]);
  });

  it("fills each bar to its own progress and marks the close one", async () => {
    const { strip } = await mount({
      sessionGoals: [
        goal({ id: "g0", target: 900, progress: 810, label: "close one" }),
        goal({ id: "g1", kind: "coins", target: 24, progress: 6, label: "early one" }),
      ],
    });
    const r = rows(strip);

    // Closest goal first: 810/900 = 90% close, career second.
    expect(r[0]!.width).toContain("90.0%");
    expect(r[0]!.close).toBe(true); // >= 70 % earns the "almost!" cue
    expect(r[1]!.career).toBe(true);
  });

  it("puts the concrete gap under every bar, with what it pays", async () => {
    const { strip } = await mount({
      sessionGoals: [goal({ id: "g0", target: 900, progress: 810, reward: 52, label: "Fly 900 m in one run" })],
    });

    expect(rows(strip)[0]!.count).toBe("810/900 · +52");
  });

  it("leaves a completed goal out — SessionGoals has already refilled the slot", async () => {
    const { strip } = await mount({
      sessionGoals: [goal({ id: "g0", progress: 900, done: true, label: "banked" }), goal({ id: "g1", kind: "coins", progress: 3, label: "live" })],
    });

    expect(rows(strip).filter((r) => !r.career).map((r) => r.label)).toEqual(["live"]);
  });

  it("shows the career rung with the gap to the next rank", async () => {
    const { strip } = await mount({ sessionGoals: [] });
    const career = rows(strip).find((r) => r.career);

    expect(career, "the career rung must fly even with no run goals left").toBeTruthy();
    expect(career!.label).toContain("Fledgling");
    expect(career!.label).toContain("Sky Racer");
    expect(career!.width).toContain("42.0%");
    expect(career!.count).toMatch(/340/);
    expect(career!.count).toContain("to go");
  });

  it("drops the career rung at the top rank instead of showing a full bar forever", async () => {
    const { strip } = await mount({ sessionGoals: [], wings: { ...WINGS, nextNeeded: 0 } });

    expect(rows(strip).filter((r) => r.career)).toHaveLength(0);
  });

  it("is empty when there is nothing to chase, rather than showing a zero bar", async () => {
    const { strip } = await mount({ sessionGoals: [], wings: { ...WINGS, nextNeeded: 0 } });

    expect(strip.innerHTML).toBe("");
  });

  it("updates in place as the run progresses, without stacking rows", async () => {
    const { hud, snap } = await mount({ sessionGoals: [goal({ id: "g0", target: 900, progress: 100 })] });

    (snap.sessionGoals as SessionGoal[])[0]!.progress = 500;
    snap.version = 2;
    hud.update(snap as unknown as HudSnapshot);

    // A version change re-renders the root, so the strip is a new element.
    const strip = document.querySelector<HTMLElement>('[data-ref="goalStrip"]')!;
    const r = rows(strip);
    expect(r).toHaveLength(2); // the goal + the career rung, not a second copy
    expect(r[0]!.count).toBe("500/900 · +52");
  });

  it("rewrites the strip only when a bar actually moved", async () => {
    const { hud, snap } = await mount({ sessionGoals: [goal({ id: "g0", target: 900, progress: 100 })] });
    const before = document.querySelector<HTMLElement>('[data-ref="goalStrip"]')!.innerHTML;

    // Same version, so no root re-render: the strip is quantized to 5 % steps and
    // a frame that moved nothing writes nothing at all.
    hud.update(snap as unknown as HudSnapshot);
    expect(document.querySelector<HTMLElement>('[data-ref="goalStrip"]')!.innerHTML).toBe(before);

    (snap.sessionGoals as SessionGoal[])[0]!.progress = 800;
    hud.update(snap as unknown as HudSnapshot);
    expect(document.querySelector<HTMLElement>('[data-ref="goalStrip"]')!.innerHTML).not.toBe(before);
  });
});

describe("the results card ends with one next action, not nine ladders", () => {
  async function results(nextAction: string) {
    const { HUD } = await import("../HUD");
    const hud = new HUD(document.body);
    const snap = snapshotStub();
    Object.assign(snap, {
      state: "gameover",
      screen: "main",
      version: 1,
      race: null,
      versus: false,
      p1Stats: null,
      p2Stats: null,
      settings: { reduceMotion: false },
      sessionGoals: [goal({ id: "g0", target: 900, progress: 888, reward: 52 })],
      wings: WINGS,
      nextAction,
    });
    hud.update(snap as unknown as HudSnapshot);
    return document.querySelector<HTMLElement>(".next-action");
  }

  it("names the nearest goal and its exact gap beside the goal list", async () => {
    const el = await results("12 short of Gold Rush · +120 coins — one more flight");

    expect(el, "the next-action line must render on the results card").toBeTruthy();
    expect(el!.textContent).toContain("12 short of Gold Rush");
    expect(el!.textContent).toContain("+120 coins");
  });

  it("renders nothing at all when there is nothing worth saying", async () => {
    // An always-on banner trains the player to look straight past it.
    expect(await results("")).toBeFalsy();
  });

  it("escapes the line, since it is built from quest labels and numbers", async () => {
    const el = await results(`<img src=x onerror="window.__sunbirdPwned = 9">`);

    expect(document.querySelectorAll("img, script, iframe").length).toBe(0);
    expect((globalThis as { __sunbirdPwned?: number }).__sunbirdPwned).toBeUndefined();
    expect(el!.textContent).toContain("<img src=x");
  });
});

/* ------------------------------------------------------------------ the sheet */

const SHEETS = ["index.css", "game/ui.css", "game/menu-polish.css"];


describe("no viewport is allowed to delete the progress readout", () => {
  /**
   * The one place the strip is deliberately hidden: a versus race, where the
   * versus bar and the compact roster already carry place and gap, and a second
   * progress readout would cover the flight for no new information. Allowed by
   * name so the allowlist cannot quietly grow — and the next case checks the
   * readout that replaces it actually exists.
   */
  const ALLOWED_HIDDEN = [".play-hud.versus .goal-strip"];

  it("never sets the goal strip to display: none outside a versus race", () => {
    // This is the regression that hid in-flight progression from every screen
    // under 500px tall. Condensing is fine — the strip may drop to its lead row
    // and shrink its type — but it may not disappear, because a bar nobody can
    // see is not a bar.
    const offenders: string[] = [];
    for (const file of SHEETS) {
      for (const r of cssRules(file)) {
        // The strip itself, not its rows: condensing on a short viewport
        // legitimately hides the goals that do not fit (`:not(:first-child)`).
        // Only the entries that target the strip itself matter here; a rule may
        // legitimately hide other flight furniture (`.goal-pop`) alongside it.
        const stripSelectors = r.sel.split(",").map((x) => x.trim()).filter((x) => /\.goal-strip$/.test(x));
        if (!stripSelectors.length) continue;
        if (stripSelectors.every((x) => ALLOWED_HIDDEN.includes(x))) continue;
        if (/display\s*:\s*none/.test(r.body)) offenders.push(`${file}: ${r.sel}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("replaces the strip in a versus race with a live place-and-gap readout", () => {
    // The allowlist above is only honest if the thing it defers to exists.
    const selectors = SHEETS.flatMap((f) => cssRules(f).map((r) => r.sel));
    expect(selectors.some((x) => /\.versus-bar/.test(x)), "the versus bar must be styled").toBe(true);
    expect(selectors.some((x) => /\.roster-bar/.test(x)), "the compact roster must be styled").toBe(true);
  });

  it("still condenses on a short viewport, so it fits the screen it is on", () => {
    const index = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    const short = [...index.matchAll(/@media[^{]*max-height:\s*500px[^{]*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");

    expect(short).toMatch(/\.flight-footer \.goal-strip \.gs:not\(:first-child\) \{ display: none; \}/);
    expect(short).not.toMatch(/\.flight-footer \.goal-strip \{ display: none; \}/);
  });

  it("keeps the next-action line in white ink too", () => {
    const rule = cssRules("game/ui.css").filter((r) => r.sel === ".next-action").pop();
    expect(rule, ".next-action must be styled").toBeTruthy();
    expect(rule!.body).toMatch(/color:\s*var\(--text-on-sky\)/);
    expect(rule!.body).toMatch(/text-shadow/);
  });

  it("keeps the strip legible on the dark skies, in white ink with a halo", () => {
    // Same contract as the distance readout: the strip floats on Sky.ts zeniths
    // with nothing opaque behind it, so its ink is --text-on-sky / --pure-white.
    const tokens = new Map<string, string>();
    for (const file of SHEETS) {
      const text = readFileSync(join(process.cwd(), "src", ...file.split("/")), "utf8");
      for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim());
    }
    const resolve = (v: string) => v.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_a, n: string) => tokens.get(n) ?? "");
    const luminance = (hex: string) => {
      const full = hex.replace("#", "").replace(/^(.{3})$/, "$1$1").replace(/^(.)(.)(.)$/, "$1$1$2$2$3$3");
      const ch = (i: number) => {
        const v = parseInt(full.slice(i, i + 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    for (const sel of [".gs em", ".gs u"]) {
      const rule = cssRules("game/ui.css").filter((r) => r.sel === sel).pop();
      expect(rule, `${sel} must be styled`).toBeTruthy();
      const colour = resolve(/color\s*:\s*([^;]+);/.exec(rule!.body)?.[1].trim() ?? "");
      expect(colour, `${sel} colour`).toMatch(/^#/);
      expect(luminance(colour), `${sel} must be white ink, got ${colour}`).toBeGreaterThan(0.9);
      // Night #12102c and dusk #3a2460 are the two darkest skies a player flies under.
      for (const sky of ["#12102c", "#3a2460"]) {
        expect(contrast(colour, sky), `${sel} on ${sky}`).toBeGreaterThanOrEqual(7);
      }
      expect(rule!.body, `${sel} needs a halo for the bright skies`).toMatch(/text-shadow/);
    }
  });
});
