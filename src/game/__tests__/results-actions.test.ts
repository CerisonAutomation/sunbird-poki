import { afterEach, describe, expect, it, vi } from "vitest";
import { HUD, resultsPrimaryAction } from "../HUD";

/**
 * The results screen has one primary affordance and two hit areas for it: the
 * card's own button, and a tap on the bare backdrop beside the card. They must
 * dispatch the same action, which is why the decision is a function rather than
 * an expression duplicated at both sites.
 *
 * The regression this pins: the backdrop tap used to dispatch `restart-flight`,
 * an action `Game` only honours while `paused` or `playing`. On a results card
 * the state is `gameover`, so the tap was a silent no-op — and it stayed hidden
 * because a touch on the bare overlay also armed the dive gesture, and
 * `holdToStart()` restarted the run through that unrelated path instead.
 */
describe("results primary action", () => {
  it("flies again after an ordinary run", () => {
    expect(resultsPrimaryAction({ massRace: false, racePlace: 0, duelWas: "" })).toBe("retry");
  });

  it("rematches a placed mass race at the same stakes", () => {
    expect(resultsPrimaryAction({ massRace: true, racePlace: 1, duelWas: "" })).toBe("rematch");
    expect(resultsPrimaryAction({ massRace: true, racePlace: 27, duelWas: "" })).toBe("rematch");
  });

  it("does not offer a rematch for a race that was not finished", () => {
    // racePlace 0 is a DNF — there is no placing to rematch on, so the honest
    // offer is to fly the run again rather than re-enter the same field.
    expect(resultsPrimaryAction({ massRace: true, racePlace: 0, duelWas: "" })).toBe("retry");
  });

  it("replays a settled duel locally instead of re-seating a field", () => {
    // A duel is head-to-head, so `rematch`'s "back through the honest search"
    // path does not apply once it has a result.
    expect(resultsPrimaryAction({ massRace: true, racePlace: 1, duelWas: "won" })).toBe("retry");
    expect(resultsPrimaryAction({ massRace: true, racePlace: 2, duelWas: "lost" })).toBe("retry");
  });

  it("never returns restart-flight, which Game ignores in the gameover state", () => {
    for (const massRace of [false, true]) {
      for (const racePlace of [0, 1, 12]) {
        for (const duelWas of ["", "won", "lost"] as const) {
          expect(["rematch", "retry"]).toContain(resultsPrimaryAction({ massRace, racePlace, duelWas }));
        }
      }
    }
  });
});

/**
 * The wiring half: the bare results backdrop is deliberately INERT. Players
 * tap and drag anywhere while reading the recap — a backdrop tap that
 * launches another race turned "look at my results" into an accidental
 * restart. Restarting is an explicit choice on the card's own buttons
 * (resultsPrimaryAction), so a backdrop click must dispatch nothing.
 */
describe("results backdrop tap", () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

  function resultsHud(snapshot: { massRace: boolean; racePlace: number; duelWas: "" | "won" | "lost" }) {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const hud = new HUD(document.body);
    const dispatched: Array<[string, string]> = [];
    hud.onAction((id, value) => { dispatched.push([id, value]); });
    // `update()` is the production path, but it renders the whole HUD from a
    // full snapshot; the click handler only reads these three fields.
    (hud as unknown as { currentSnapshot: unknown }).currentSnapshot = snapshot;
    const over = hud.root.querySelector<HTMLElement>('[data-ref="over"]');
    expect(over, "the results overlay exists").not.toBeNull();
    over!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return dispatched;
  }

  it("stays on the recap after an ordinary run", () => {
    expect(resultsHud({ massRace: false, racePlace: 0, duelWas: "" })).toEqual([]);
  });

  it("stays on the recap for a placed mass race", () => {
    expect(resultsHud({ massRace: true, racePlace: 3, duelWas: "" })).toEqual([]);
  });

  it("stays on the recap for a DNF or a settled duel", () => {
    expect(resultsHud({ massRace: true, racePlace: 0, duelWas: "" })).toEqual([]);
    expect(resultsHud({ massRace: true, racePlace: 1, duelWas: "won" })).toEqual([]);
  });

  it("stays on the recap when no snapshot has been rendered yet", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const hud = new HUD(document.body);
    const dispatched: Array<[string, string]> = [];
    hud.onAction((id, value) => { dispatched.push([id, value]); });
    hud.root.querySelector<HTMLElement>('[data-ref="over"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dispatched).toEqual([]);
  });

});
