/**
 * The goal panel: one panel, and rows that leave when they are finished.
 *
 * Both of these are player reports, not hypotheticals:
 *
 *  - "why are there 2 goal showers?" — there genuinely were two. The session
 *    goals rendered into `.goal-strip` (centre-bottom) while quests rendered
 *    into a separate `.mission-strip` panel (left edge), and both drew the same
 *    label / progress / bar row in the same corner of the screen. Restyling one
 *    of them would have been the wrong fix: the player was counting panels, so
 *    there is now one.
 *
 *  - "the goals are stuck on the HUD, they don't disappear once completed" —
 *    the quest filter kept `r.done` UNCONDITIONALLY, so a banked quest kept a
 *    full gold bar on screen for the remainder of the flight. Completion is a
 *    moment, not a state: the row lingers, then leaves.
 *
 * The linger is the subtle half. It only works if the strip's rebuild key
 * changes as the window closes — a key that goes constant is a row that never
 * disappears, which is the original bug wearing a delay. So the clock is a spy
 * the test moves by hand: the only way to see the expiry is to cross it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mount, mountHud } from "./hudHarness";
import type { HudSnapshot } from "../HUD";
import type { MissionRow } from "../Missions";

/** The HUD's linger clock reads `performance.now()`. Moved by hand below. */
let clock = 60_000;

function quest(over: Partial<MissionRow> = {}): MissionRow {
  return {
    id: "q1",
    title: "Pocket 30 coins",
    progress: 30,
    target: 30,
    pct: 1,
    done: true,
    reward: 120,
    justDone: false,
    ...over,
  };
}

const OPEN = { done: false, pct: 0.8, progress: 24, target: 30 };

/** mountHud hands back the root, not the strip — grab it the same way mount() does. */
const stripOf = (root: HTMLElement) => {
  const el = root.querySelector<HTMLElement>('[data-ref="goalStrip"]');
  if (!el) throw new Error("no goal strip in the flight HUD");
  return el;
};

const titles = (strip: HTMLElement) =>
  [...strip.querySelectorAll<HTMLElement>(".gs em")].map((e) => e.textContent?.trim() ?? "");

const hudSource = () => readFileSync(join(process.cwd(), "src/game/HUD.ts"), "utf8");
const declared = (name: string) =>
  Number(new RegExp(`${name} = ([\\d_]+)`).exec(hudSource())![1]!.replace(/_/g, ""));

beforeEach(() => {
  document.body.innerHTML = "";
  clock = 60_000;
  vi.resetModules();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

describe("there is one goal panel, not two", () => {
  it("has no second quest panel beside the goal strip", async () => {
    const { root } = await mountHud({ sessionGoals: [], missionRows: [quest(OPEN)] });
    // The duplication was structural: a whole extra absolutely-positioned
    // panel. Assert its ABSENCE rather than its styling, because a restyle
    // would leave the player's "two bars" report exactly as valid as it is now.
    expect(
      root.querySelector(".mission-strip, [data-ref='missionStrip']"),
      "a second goal panel is back in the flight HUD",
    ).toBeNull();
  });

  it("draws a quest as a row in the goal strip itself", async () => {
    const { strip } = await mount({
      sessionGoals: [],
      wings: undefined,
      missionRows: [quest(OPEN)],
    });
    const rows = strip.querySelectorAll(".gs");
    expect(rows.length, "the quest never reached the strip").toBe(1);
    expect(rows[0]!.className).toContain("gs-quest");
    expect(titles(strip)).toContain("Pocket 30 coins");
  });

  it("caps the panel, so merging the two cannot become a wall", async () => {
    const many = Array.from({ length: 8 }, (_, i) => quest({ ...OPEN, id: `q${i}`, title: `Quest ${i}` }));
    const { strip } = await mount({ sessionGoals: [], wings: undefined, missionRows: many });
    const rows = strip.querySelectorAll(".gs").length;

    // 3 is a LITERAL on purpose. An earlier version of this test read the cap
    // out of HUD.ts and compared the strip against it — which meant raising the
    // cap raised the expectation too, and the assertion could not fail. It
    // passed while the mutation that broke it was applied. The cap is a design
    // decision (a phone footer holds three rows), so the test states the number
    // rather than mirroring the code.
    expect(rows, "the merged panel grew past three rows").toBeLessThanOrEqual(3);
    expect(rows, "the cap was satisfied by showing nothing at all").toBeGreaterThan(0);

    // And the code must still be driven by the named constant, not a bare 3.
    expect(hudSource(), "the cap is inlined instead of named").toContain("GOAL_STRIP_MAX_ROWS = 3");
  });
});

describe("a finished quest leaves the strip", () => {
  it("shows the completed row, so the payoff is seen", async () => {
    const { strip } = await mount({ sessionGoals: [], wings: undefined, missionRows: [quest()] });
    expect(titles(strip)).toContain("Pocket 30 coins");
    expect(strip.querySelector(".gs-quest.done")).not.toBeNull();
  });

  it("keeps it while the linger window is open", async () => {
    const { hud, snap, root } = await mountHud({
      sessionGoals: [],
      wings: undefined,
      missionRows: [quest()],
    });
    const strip = stripOf(root);
    expect(titles(strip), "the payoff row never appeared").toContain("Pocket 30 coins");

    // A second push inside the window must NOT clear it. A row that vanished on
    // the very next frame would be worse than the original bug — the player
    // would never see what they just earned.
    clock += 500;
    hud.update(snap as unknown as HudSnapshot);
    expect(titles(strip), "the row vanished before the player could read it").toContain(
      "Pocket 30 coins",
    );
  });

  it("drops it once the window closes — the stuck-goal fix", async () => {
    const { hud, snap, root } = await mountHud({
      sessionGoals: [],
      wings: undefined,
      missionRows: [quest()],
    });
    const strip = stripOf(root);
    expect(titles(strip), "precondition: the completed row should be showing").toContain(
      "Pocket 30 coins",
    );

    clock += declared("QUEST_DONE_LINGER_MS") + 500;
    hud.update(snap as unknown as HudSnapshot);

    expect(
      titles(strip),
      "the completed quest is STILL on the HUD after its window closed — this is the stuck-goal bug",
    ).not.toContain("Pocket 30 coins");
    expect(strip.querySelector(".gs-quest.done")).toBeNull();
  });

  it("keeps an unfinished quest that is still worth chasing", async () => {
    const { strip } = await mount({
      sessionGoals: [],
      wings: undefined,
      missionRows: [quest(OPEN)],
    });
    expect(titles(strip)).toContain("Pocket 30 coins");
    expect(strip.querySelector(".gs-quest.done")).toBeNull();
  });

  it("hides a quest that is nowhere near done", async () => {
    // Unchanged behaviour, kept so the expiry fix cannot quietly become a
    // "show everything" fix: a row at 0% is the one that teaches a player to
    // stop reading the strip.
    const { strip } = await mount({
      sessionGoals: [],
      wings: undefined,
      missionRows: [quest({ ...OPEN, pct: 0.05, progress: 1 })],
    });
    expect(titles(strip)).not.toContain("Pocket 30 coins");
  });
});
