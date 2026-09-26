/**
 * The results card's progress surface — the assertion that could have caught
 * `Game.ts` filling the snapshot with literals.
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
 * one — and the game does not. `Game.ts:7470-7472`:
 *
 *     // Celebration and proximity are not yet plumbed from game state; provide
 *     // safe defaults so HUD renders correctly (hidden proximity bar, no beats).
 *     celebration: { staged: [], ledger: [], folded: 0, peak: 0 },
 *     nextAction: "",
 *
 * `renderCelebration` then early-returns `""` on exactly that shape and
 * `HUD.ts:3755` omits `<p class="next-action">` for an empty string, so the
 * player sees a results card with no progress on it at all. The renderer was
 * right; the producer was a stub; the suite was green throughout. That is the
 * whole bug class in one line of test setup.
 *
 * ## What is different here
 *
 * These assertions are written against **what the game supplies**, not against
 * what the renderer can do. The gaps are declared with `it.fails`, which is the
 * right instrument for a defect that is documented but deliberately not fixed:
 *
 *  - the suite stays green, so it does not block the wire-or-delete decision
 *    that is not this repository's to make;
 *  - each case names the specific gap rather than asserting a general "TODO";
 *  - and the moment someone wires the feature the body stops throwing and
 *    `it.fails` reports a failure — the signal to promote the case to a plain
 *    `it` and delete the marker.
 *
 * `it.fails` cuts both ways on purpose: a case that has quietly stopped testing
 * anything also turns red here rather than passing in silence. And a green
 * control below proves the harness can really render a populated strip, so a
 * red sibling means the gap is real rather than a broken mount.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { growthLedger, type MasteryGrowth, type WingsGrowth } from "../GrowthLedger";
import { missionRows, nextActionLine, type QuestDef, type RunStats } from "../Missions";
import { celebrationView, planCelebration, type ProgressEvent } from "../ProgressBeats";

import { cssRules, mountHud } from "./hudHarness";

const FOUR_LADDERS: ProgressEvent[] = [
  { kind: "quest", count: 1, coins: 60 },
  { kind: "mastery", icon: "M", mode: "Tempest", level: 2, maxed: false, skill: "", coins: 100 },
  { kind: "wings", tierId: "silver", icon: "S", name: "Silver Wings" },
  { kind: "trophy", id: "dist_100k", title: "World Wanderer", rarity: "gold" },
];

const QUEST: QuestDef = { id: "d1", kind: "coins", target: 15, reward: 60, label: "Collect 15 coins in a run", title: "Coin Snapper" };

const WINGS: WingsGrowth = { icon: "wing", name: "Swift", progress: 0.42, nextName: "Gale", nextNeeded: 1850, lifetime: 12400 };
const MASTERY: MasteryGrowth = { name: "Day Trip", icon: "sun", runs: 7, level: 2, nextAt: 10, progress: 0.7, perk: "+4% coins", maxed: false };

/** The results card as `Game.ts` actually builds it today. */
const SHIPPED = { state: "gameover", screen: "main", celebration: { staged: [], ledger: [], folded: 0, peak: 0 }, nextAction: "" };

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

describe("results card: the producer half (documented gaps)", () => {
  it.fails("ships a non-empty `.celebration .beat-row`", async () => {
    // What `Game.ts` hands `renderCelebration` in the running game. The
    // renderer is correct; this asserts the value it is actually given.
    const { root } = await mountHud(SHIPPED);
    expect(root.querySelector(".celebration .beat-row"), "the results card has no beat row: Game.ts supplies an empty celebration").not.toBeNull();
    expect(root.querySelectorAll(".celebration .beat").length, "the beat row carries no beats").toBeGreaterThan(0);
  });

  it.fails("ships a `.next-action` element", async () => {
    // `HUD.ts:3755` emits `<p class="next-action">` only for a truthy
    // `s.nextAction`, and the game sets the field to `""`, so the element is
    // never emitted at all. `nextActionLine()` is the tested producer.
    const { root } = await mountHud(SHIPPED);
    expect(root.querySelector(".next-action"), "no .next-action element: Game.ts sets nextAction to \"\"").not.toBeNull();
  });

  it.fails("ships a non-empty `.growth-ledger`", async () => {
    // Two independent gaps meet here, and they need fixing separately.
    //
    // 1. `HUD.ts:3636` — `renderCelebration` opens with
    //    `if (!cel || (!cel.staged.length && !cel.ledger.length && !cel.folded)) return ""`.
    //    The shipped `celebration` literal is exactly that empty shape, so the
    //    function returns before emitting anything, and `.growth-ledger` is not
    //    in the DOM at all. That is why this fails on the shipped snapshot.
    // 2. `HUD.ts:3647` — even handed a real celebration it emits
    //    `<div class="growth-ledger"></div>`, with nothing inside. So wiring
    //    `Game.ts` alone would still leave this red: the renderer has no
    //    `growthLedger()` call, and `growthLedger()` has no importer that
    //    reaches the HUD. The div is also collapsed by `ui.css`.
    //
    // The producer is ready and returns lines; nothing calls it.
    const { root } = await mountHud(SHIPPED);
    const ledger = root.querySelector(".growth-ledger");
    expect(ledger, "no .growth-ledger element in the results card").not.toBeNull();
    expect(ledger!.innerHTML.trim(), "the growth-ledger div is rendered empty").not.toBe("");
    expect(growthLedger(WINGS, MASTERY).length, "growthLedger() itself is broken").toBeGreaterThan(0);
  });

  it.fails("shows the in-flight mission strip", async () => {
    // `missionRows` has 25 test references and no caller. The flight HUD has no
    // strip for it: `renderMissions` draws `MissionView[]` for the menu and
    // progress screens and nothing anywhere draws `MissionRow[]`.
    const stats = { coins: 9, distance: 1200, clouds: 0, perfects: 2, island: 1, zenith: 0, fever: 0, pickups: 1 } as RunStats;
    const rows = missionRows([QUEST], stats);
    expect(rows.length).toBeGreaterThan(0);
    expect(nextActionLine(rows, 1200)).toBeTruthy();
    const { root } = await mountHud({ ...SHIPPED, sessionGoals: [], missions: [] });
    expect(root.querySelector(".mission-strip, .quest-strip, [data-ref='missionStrip']"), "no mission strip in the results card").not.toBeNull();
  });
});

describe("what the game actually ships today", () => {
  // Characterisation, not aspiration: this pins the CURRENT honest state so the
  // gaps above cannot quietly change meaning. If this starts failing, a feature
  // was wired or removed and the `it.fails` markers need revisiting.
  it("Game.ts still fills the snapshot with the empty literal", () => {
    const src = readFileSync(join(process.cwd(), "src/game/Game.ts"), "utf8");
    expect(src, "Game.ts no longer contains the documented stub — revisit this suite").toContain("Celebration and proximity are not yet plumbed from game state");
    expect(src).toMatch(/celebration:\s*\{\s*staged:\s*\[\]/);
    expect(src).toMatch(/nextAction:\s*""/);
  });

  it("`.growth-ledger` is still collapsed to 1px in the stylesheet", () => {
    // If someone gives the div real height without populating it, this fails
    // and points at the half of the job that is left.
    const rule = cssRules("game/ui.css").find((r) => r.sel === ".growth-ledger");
    expect(rule, "no .growth-ledger rule in ui.css").toBeDefined();
    expect(rule!.body).toMatch(/min-height:\s*1px/);
  });
});
