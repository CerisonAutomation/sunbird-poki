// The bird-position quips (THUD, BOP) were built on a lane that held exactly one
// node. `popup()` did `impactPopupsEl.replaceChildren(el)`, so the second quip
// to arrive inside the 1100ms window destroyed the first on the same tick it
// spawned. The net effect: during a continuous scrape the player saw a single
// word flicker rather than the run of quips the game was generating — which is
// the report that "the funny messages don't even show up".
//
// A test is required because the lane is invisible to the DOM snapshot tests:
// nothing asserts how many children the popup lane holds, and jsdom runs no
// animation, so a cap or an append that never happens would not surface
// anywhere else.
//
// The lane is only rendered while `data-ui-state="playing"` (see index.css), and
// the harness mounts the real HUD, so these drive the real `popup()`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountHud } from "./hudHarness";
import type { HUD } from "../HUD";

/** Only the two members these tests drive, so a signature change surfaces here. */
type PopupDriver = Pick<HUD, "popup" | "dispose">;

/** The popup lane as the HUD owns it. */
function lane(root: HTMLElement): HTMLElement {
  const el = root.querySelector<HTMLElement>(".impact-popups");
  if (!el) throw new Error("no .impact-popups lane in the flight HUD");
  return el;
}

/** Distinct words so we can assert *which* popup survived, not just a count. */
function words(root: HTMLElement): string[] {
  return [...lane(root).children].map((c) => c.textContent ?? "");
}

describe("impact popup lane", () => {
  let hud: PopupDriver | null = null;

  beforeEach(() => {
    // jsdom has no ResizeObserver and the HUD constructs one to watch its flow
    // containers. Same stub the sibling HUD suites install.
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    document.body.innerHTML = "";
  });

  afterEach(() => {
    hud?.dispose();
    hud = null;
  });

  /** jsdom performs no layout, so `popup()` bails on a zero-size lane. Give it one. */
  function stubLane(el: HTMLElement): void {
    el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) }) as DOMRect;
  }

  it("keeps a second quip instead of destroying the first", async () => {
    const m = await mountHud();
    hud = m.hud;
    const popup = (...a: Parameters<PopupDriver["popup"]>) => hud!.popup(...a);
    stubLane(lane(m.root));

    popup("THUD!", "thud", 0.5, 0.5);
    popup("BONK!", "bop", 0.5, 0.5);

    // The bug: only the newest survives. The fix: both are alive.
    expect(words(m.root)).toEqual(["THUD!", "BONK!"]);
  });

  it("survives a burst of five quips — the case the report describes", async () => {
    const m = await mountHud();
    hud = m.hud;
    const popup = (...a: Parameters<PopupDriver["popup"]>) => hud!.popup(...a);
    stubLane(lane(m.root));

    for (const w of ["THUD!", "BONK!", "THUD!", "OOF!", "BONK!"]) popup(w, "thud", 0.5, 0.5);

    // A continuous scrape. It must read as a run, not a single word.
    expect(words(m.root).length).toBeGreaterThan(1);
    // The two most recent are the ones a player can still be reading.
    expect(words(m.root).slice(-2)).toEqual(["OOF!", "BONK!"]);
  });

  it("bounds the lane so a sustained scrape cannot bury the play area", async () => {
    const m = await mountHud();
    hud = m.hud;
    const popup = (...a: Parameters<PopupDriver["popup"]>) => hud!.popup(...a);
    stubLane(lane(m.root));

    for (let i = 0; i < 40; i += 1) popup(`Q${i}`, "thud", 0.5, 0.5);

    // Unbounded stacking is the opposite failure and just as bad: the lane is
    // full of words over the play field.
    expect(lane(m.root).children.length).toBeLessThanOrEqual(3);
    // …and the cap evicts oldest-first, so what remains is the newest.
    expect(words(m.root)).toEqual(["Q37", "Q38", "Q39"]);
  });

  it("drops the oldest first, not the newest", async () => {
    const m = await mountHud();
    hud = m.hud;
    const popup = (...a: Parameters<PopupDriver["popup"]>) => hud!.popup(...a);
    stubLane(lane(m.root));

    for (const w of ["one", "two", "three", "four"]) popup(w, "thud", 0.5, 0.5);

    // Evicting the newest would make the newest quip — the one the player is
    // looking at — vanish the instant it appeared. That is the same bug wearing
    // a different hat, and a count-only assertion would not catch it.
    expect(words(m.root)).not.toContain("one");
    expect(words(m.root)).toContain("four");
  });

  it("still routes each popup into the lane rather than the toast lane", async () => {
    const m = await mountHud();
    hud = m.hud;
    const popup = (...a: Parameters<PopupDriver["popup"]>) => hud!.popup(...a);
    stubLane(lane(m.root));

    popup("THUD!", "thud", 0.5, 0.5);

    // A quip that quietly migrated to the toast lane would "fix" the pile-up by
    // changing which lane owns it — the toast lane is capped at 1 in flight and
    // right-anchored away from the bird, so it would go back to flickering.
    expect(lane(m.root).children.length).toBe(1);
    expect(m.root.querySelectorAll(".toast").length).toBe(0);
  });
});
