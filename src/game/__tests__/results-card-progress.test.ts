/**
 * The results card's progress surface — the assertion that could have caught
 * `Game.ts` filling the snapshot with literals, and now the one that keeps it
 * from doing so again.
 *
 * ## Why this suite exists when `progress-celebration-ui.test.ts` already covers it
 *
 * That suite is good, and it is green, and it did its job. But look at how it
 * builds its snapshot (`progress-celebration-ui.test.ts:68`):
 *
 *     celebration: celebrationView(planCelebration([])),
 *
 * **The test supplies the value.** It proves `renderCelebration` correctly draws
 * a celebration view it was handed. It cannot see whether the game ever hands it
 * one — and the game did not. It used to:
 *
 *     // Celebration and proximity are not yet plumbed from game state; provide
 *     // safe defaults so HUD renders correctly (hidden proximity bar, no beats).
 *     celebration: { staged: [], ledger: [], folded: 0, peak: 0 },
 *     nextAction: "",
 *
 * `renderCelebration` early-returned `""` on exactly that shape and `HUD.ts`
 * omitted `<p class="next-action">` for an empty string, so the player saw a
 * results card with no progress on it at all. The renderer was right; the
 * producer was a stub; the suite was green throughout. That is the whole bug
 * class in one line of test setup.
 *
 * ## What this suite looked like before the wire, and what changed
 *
 * It shipped with the four gaps declared as `it.fails` — the right instrument
 * for a defect that is documented but deliberately not fixed: the suite stayed
 * green, each case named a specific gap, and `it.fails` (which passes on a
 * throw and **fails if the body ever passes**) would have screamed the moment
 * someone wired the feature.
 *
 * That is what happened, and the markers were promoted to plain `it`. Nothing
 * was weakened to do it. The *assertions* are byte-identical; what changed is
 * the fixture, because the game's output changed: `SHIPPED` is now built by
 * the same pure chain `finishRun` runs instead of being hand-written as the
 * empty literal. That makes the suite strictly stronger than either version —
 * a fact dropped in `runProgressEvents`, an event dropped in `planCelebration`,
 * or a snapshot field renamed anywhere in the chain now goes red here.
 *
 * The green control below still exists, for the same reason: a failure in the
 * producer block must be distinguishable from a harness that never mounted.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { growthLedger, type MasteryGrowth, type WingsGrowth } from "../GrowthLedger";
import { missionRows, nextActionLine, type QuestDef, type RunStats } from "../Missions";
import { celebrationView, planCelebration, type ProgressEvent } from "../ProgressBeats";
import { NO_RUN_PROGRESS, runProgressEvents, type RunProgressFacts } from "../RunProgress";

import { cssRules, mountHud } from "./hudHarness";

const RUN = { coins: 9, distance: 1200, clouds: 0, perfects: 2, island: 1, apex: 0, fever: 0, pickups: 1 } as RunStats;

const FOUR_LADDERS: ProgressEvent[] = [
  { kind: "quest", count: 1, coins: 60 },
  { kind: "mastery", icon: "M", mode: "Tempest", level: 2, maxed: false, skill: "", coins: 100 },
  { kind: "wings", tierId: "silver", icon: "S", name: "Silver Wings" },
  { kind: "trophy", id: "dist_100k", title: "World Wanderer", rarity: "gold" },
];

const QUEST: QuestDef = { id: "d1", kind: "coins", target: 15, reward: 60, label: "Collect 15 coins in a run", title: "Coin Snapper" };

const WINGS: WingsGrowth = { icon: "wing", name: "Swift", progress: 0.42, nextName: "Gale", nextNeeded: 1850, lifetime: 12400 };
const MASTERY: MasteryGrowth = { name: "Day Trip", icon: "sun", runs: 7, level: 2, nextAt: 10, progress: 0.7, perk: "+4% coins", maxed: false };

/** A run that moved four ladders, as `finishRun` reports it. */
const FACTS: RunProgressFacts = {
  ...NO_RUN_PROGRESS,
  newBest: true,
  distance: 4200,
  wings: { tierId: "silver", icon: "S", name: "Silver Wings" },
  trophies: [{ id: "dist_100k", title: "World Wanderer", rarity: "gold" }],
  mastery: { icon: "M", mode: "Tempest", level: 2, maxed: false, skill: "", coins: 100 },
  quests: [{ reward: 60 }],
};

const ROWS = missionRows([QUEST], RUN, [], []);

/**
 * The results card as `Game.ts` builds it **now** — every field derived from a
 * real producer, so this fixture is a wire, not a hand-written literal.
 *
 * That is the whole difference from the version of this suite that shipped
 * alongside the gap markers. It used to hand-write
 * `celebration: { staged: [], ledger: [], folded: 0, peak: 0 }` and
 * `nextAction: ""` and then assert the card had beats — an assertion about a
 * value the game never produced. The input here comes from
 * `runProgressEvents → planCelebration → celebrationView` and
 * `missionRows → nextActionLine`, which is the exact chain `finishRun` runs, so
 * a break anywhere in it — a fact dropped, an event dropped, a field renamed —
 * goes red here instead of hiding behind a literal that happens to be empty.
 */
const SHIPPED = {
  state: "gameover",
  screen: "main",
  celebration: celebrationView(planCelebration(runProgressEvents(FACTS))),
  nextAction: nextActionLine(ROWS, 4200),
  missionRows: ROWS,
  distance: 4200,
};

beforeEach(() => {
  vi.resetModules();
  // The HUD observes a few flow containers on construction; jsdom has no
  // ResizeObserver. Same stub the sibling HUD suites install.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("results card: the renderer half (must stay green)", () => {
  // The control. Without it an `it.fails` below could be hiding a test that
  // never worked: `it.fails` passes on ANY throw, including "the HUD never
  // mounted". This proves the harness can genuinely render a populated beat
  // row, so a red sibling is a real gap.
  it("draws the beat row when the snapshot carries a real celebration", async () => {
    const { root } = await mountHud({ ...SHIPPED, celebration: celebrationView(planCelebration(FOUR_LADDERS)) });
    const beats = root.querySelectorAll(".celebration .beat");
    expect(beats.length, "the renderer cannot draw a celebration it is handed — the gaps below may be a broken test").toBeGreaterThan(0);
    expect(root.querySelector(".celebration .beat-row"), "no .beat-row inside .celebration").not.toBeNull();
  });
});

describe("results card: the producer half (wired)", () => {
  it("ships a non-empty `.celebration .beat-row`", async () => {
    // The value `Game.finishRun` hands `renderCelebration`, reached through
    // `runProgressEvents → planCelebration → celebrationView`. The renderer was
    // always correct; it was being handed an empty literal.
    const { root } = await mountHud(SHIPPED);
    expect(root.querySelector(".celebration .beat-row"), "the results card has no beat row: Game.ts supplies an empty celebration").not.toBeNull();
    expect(root.querySelectorAll(".celebration .beat").length, "the beat row carries no beats").toBeGreaterThan(0);
  });

  it("ships a `.next-action` element", async () => {
    // `HUD.ts` emits `<p class="next-action">` only for a truthy `s.nextAction`;
    // `Game.ts` used to set the field to `""`, so the element was never emitted
    // at all. `nextActionLine()` is the tested producer, fed the same rows the
    // in-flight strip shows.
    const { root } = await mountHud(SHIPPED);
    expect(root.querySelector(".next-action"), "no .next-action element: Game.ts sets nextAction to \"\"").not.toBeNull();
  });

  it("ships a non-empty `.growth-ledger`", async () => {
    // Two independent gaps met here and both are closed. `renderCelebration`
    // used to `return ""` on the shipped literal, so the div was not in the DOM
    // at all; and even handed a real celebration it emitted
    // `<div class="growth-ledger"></div>` with nothing inside, because the
    // renderer had no `growthLedger()` call and the module had no importer that
    // reached the HUD. The ledger is now derived from the two ladders the
    // snapshot already carries, so it renders even on a run that moved nothing.
    const { root } = await mountHud(SHIPPED);
    const ledger = root.querySelector(".growth-ledger");
    expect(ledger, "no .growth-ledger element in the results card").not.toBeNull();
    expect(ledger!.innerHTML.trim(), "the growth-ledger div is rendered empty").not.toBe("");
    expect(ledger!.querySelectorAll(".gl-row").length, "the ledger has no rows").toBeGreaterThan(0);
    expect(growthLedger(WINGS, MASTERY).length, "growthLedger() itself is broken").toBeGreaterThan(0);
  });

  it("draws quests in the one goal strip, not a second panel", async () => {
    // `missionRows` had 25 test references and no caller: `renderMissions` draws
    // `MissionView[]` for the menu and progress screens and nothing anywhere
    // drew `MissionRow[]`.
    //
    // Quests used to get their OWN panel (`.mission-strip`, left edge) beside
    // the goal strip (centre-bottom), both drawing the same progress row. That
    // is now ONE panel — the "why are there 2 goal bars" report was correct.
    // So: the quest host must be gone, and the strip must be the one place a
    // quest row can appear.
    const { root } = await mountHud({ ...SHIPPED, sessionGoals: [], missions: [] });
    expect(
      root.querySelector(".mission-strip, [data-ref='missionStrip']"),
      "the second goal panel is back",
    ).toBeNull();
    expect(
      root.querySelector("[data-ref='goalStrip']"),
      "no goal strip to draw quests in",
    ).not.toBeNull();
    expect(ROWS.length).toBeGreaterThan(0);
    expect(nextActionLine(ROWS, 4200)).toBeTruthy();
  });
});

describe("the stub that used to be the producer", () => {
  // Both of these were characterisation tests pinning the BROKEN state, with a
  // comment saying so. They are inverted rather than deleted: a source that
  // re-introduces the literal, or a stylesheet that re-collapses the ledger, is
  // the exact regression this lane exists to prevent, and a test that only
  // passed while the feature was dead was not protecting anything.
  it("Game.ts no longer fills the snapshot with the empty literal", () => {
    const src = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");
    expect(src, "the documented stub is back: Game.ts is feeding the HUD a literal again").not.toContain("Celebration and proximity are not yet plumbed from game state");
    expect(src, "the empty celebration literal is back").not.toMatch(/celebration:s*{s*staged:s*[]/);
    expect(src, "nextAction is back to a hardcoded empty string").not.toMatch(/nextAction:s*""/);
    // And the other end of the wire is a real call, not another literal.
    expect(src, "Game.ts must derive the celebration from the run").toMatch(/celebration:\s*celebrationView\(planCelebration\(/);
  });

  it("`.growth-ledger` is no longer collapsed to 1px in the stylesheet", () => {
    // The other half of the same job: real height for real content.
    const rule = cssRules("game/ui.css").find((r) => r.sel === ".growth-ledger");
    expect(rule, "no .growth-ledger rule in ui.css").toBeDefined();
    expect(rule!.body, "the ledger is styled as a 1px placeholder again").not.toMatch(/min-height:\s*1px/);
  });
});
