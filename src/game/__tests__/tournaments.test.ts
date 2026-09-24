import { describe, expect, it } from "vitest";
import { Tournaments, emptyTournamentState, tierFor, tournamentsForWeek, weekKey } from "../Tournaments";

describe("tournament week key", () => {
  it("anchors to Monday and zero-pads the week", () => {
    // 2026-09-10 is a Thursday → week 37 of 2026. weekKey anchors on the
    // player-local day (same convention as dateSeed), so build dates from
    // local parts instead of UTC-string literals that shift on other zones.
    expect(weekKey(new Date(2026, 8, 10, 12))).toBe("2026-W37");
  });

  it("is stable across the whole week", () => {
    const mon = weekKey(new Date(2026, 8, 7));
    const sun = weekKey(new Date(2026, 8, 13, 23, 59, 59));
    expect(mon).toBe(sun);
  });
});

describe("tournament rotation", () => {
  it("always yields two distinct concurrent cups", () => {
    const cups = tournamentsForWeek(new Date("2026-09-10T12:00:00Z"));
    expect(cups).toHaveLength(2);
    expect(cups[0]!.id).not.toBe(cups[1]!.id);
    expect(cups[0]!.mode).not.toBe(cups[1]!.mode);
  });

  it("is deterministic per week and differs across weeks", () => {
    const w1 = tournamentsForWeek(new Date(2026, 8, 7));
    const w1b = tournamentsForWeek(new Date(2026, 8, 7, 12));
    expect(w1.map((c) => c.id)).toEqual(w1b.map((c) => c.id));
    const w2 = tournamentsForWeek(new Date(2026, 8, 14));
    expect(w2[0]!.id).not.toBe(w1[0]!.id);
  });

  it("every cup has bounded dates and one prize per tier", () => {
    for (const c of tournamentsForWeek()) {
      expect(c.endsAt).toBeGreaterThan(c.startsAt);
      expect(c.cuts.diamond).toBeGreaterThan(c.cuts.gold);
      expect(c.cuts.gold).toBeGreaterThan(c.cuts.silver);
      expect(c.cuts.silver).toBeGreaterThan(c.cuts.bronze);
      for (const tier of ["bronze", "silver", "gold", "diamond"] as const) {
        expect(c.prizes[tier].label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("tierFor", () => {
  const def = tournamentsForWeek(new Date(2026, 8, 7))[0]!;
  it("maps a value onto the highest tier reached", () => {
    expect(tierFor(def, 0)).toBeNull();
    expect(tierFor(def, def.cuts.bronze)).toBe("bronze");
    expect(tierFor(def, def.cuts.silver)).toBe("silver");
    expect(tierFor(def, def.cuts.gold)).toBe("gold");
    expect(tierFor(def, def.cuts.diamond)).toBe("diamond");
    expect(tierFor(def, Number.MAX_SAFE_INTEGER)).toBe("diamond");
  });
});

describe("Tournaments", () => {
  it("submits a run, improves best, and only matches the right mode", () => {
    const t = new Tournaments(emptyTournamentState());
    const cup = t.active()[0]!;
    const improved = t.submit(cup.mode, { distance: 5000, altitude: 5000, perfects: 5000, coins: 5000 });
    expect(improved.map((c) => c.id)).toContain(cup.id);
    // The other cup is a different mode, so it must not be touched.
    const other = t.active()[1]!;
    expect(t.view().find((v) => v.def.id === other.id)!.entry.attempts).toBe(0);
    expect(t.view().find((v) => v.def.id === cup.id)!.entry.best).toBeGreaterThan(0);
  });

  it("claims the reached tier exactly once and grants its prize", () => {
    const t = new Tournaments(emptyTournamentState());
    const cup = t.active()[0]!;
    t.submit(cup.mode, { distance: Number.MAX_SAFE_INTEGER, altitude: Number.MAX_SAFE_INTEGER, perfects: Number.MAX_SAFE_INTEGER, coins: Number.MAX_SAFE_INTEGER });
    const grant = t.claim(cup.id);
    expect(grant).not.toBeNull();
    expect(grant!.tier).toBe("diamond");
    // Second claim is refused.
    expect(t.claim(cup.id)).toBeNull();
  });

  it("tracks claimed tiers and owned cosmetics", () => {
    const t = new Tournaments(emptyTournamentState());
    expect(t.claimedTiers()).toHaveLength(0);
    expect(t.ownedTrails()).toHaveLength(0);
    const cup = t.active()[0]!;
    t.submit(cup.mode, { distance: 100000, altitude: 100000, perfects: 100000, coins: 100000 });
    t.claim(cup.id);
    expect(t.claimedTiers()).toContain("diamond");
  });

  it("rolls over to a new week, clearing entries but not cosmetics", () => {
    const state = emptyTournamentState();
    state.trails.push("trail_comet");
    const t = new Tournaments(state);
    t.submit(t.active()[0]!.mode, { distance: 9000, altitude: 0, perfects: 0, coins: 0 });
    t.claim(t.active()[0]!.id);
    // Force a week change.
    state.week = "1900-W01";
    expect(t.rollover()).toBe(true);
    expect(Object.keys(state.entries)).toHaveLength(0);
    expect(t.ownedTrails()).toContain("trail_comet");
  });
});
