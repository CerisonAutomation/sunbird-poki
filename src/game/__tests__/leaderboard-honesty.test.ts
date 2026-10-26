import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyRunSubmission } from "../AntiCheat";
import {
  isLeaderboardOnline,
  leaderboardBackend,
  loadPilotName,
  savePilotName,
} from "../Leaderboard";
import { isPilotNameClean } from "../pilotNameModeration";
import { storage } from "../Storage";

/**
 * The two trust surfaces this game has.
 *
 * `verifyRunSubmission` decides whether a run reaches a public board, and the
 * leaderboard is a shared space with strangers on it. `savePilotName` is the
 * single choke point every pilot name passes through on its way to that board
 * and to another player's roster — including a portal username, which arrives
 * from someone else's account. Both were thinly covered for what they are.
 */

const clean = { distance: 2000, score: 5000, durationMs: 60_000 };

afterEach(() => {
  try {
    for (const k of ["sunbird.name", "sunbird.pilotName"]) storage.removeItem(k);
  } catch {
    /* private mode */
  }
});

describe("verifyRunSubmission — the plausibility gate", () => {
  it("accepts an ordinary run", () => {
    expect(verifyRunSubmission(clean).valid).toBe(true);
  });

  it("rejects negative telemetry outright", () => {
    for (const bad of [{ distance: -1 }, { score: -1 }, { durationMs: -1 }]) {
      const v = verifyRunSubmission({ ...clean, ...bad });
      expect(v.valid, JSON.stringify(bad)).toBe(false);
      expect(v.quarantined).toBe(true);
    }
  });

  it("rejects distance with no duration — the one the server used to quarantine every honest run", () => {
    // `boundedNum(undefined)` coerces to 0 server-side, so a payload missing
    // durationMs failed the speed check and was filed as `quarantined`. This
    // is the client half of that contract.
    expect(verifyRunSubmission({ distance: 2000, score: 1, durationMs: 0 }).valid).toBe(false);
  });

  it("allows a zero-distance run (a player who never launched)", () => {
    // The duration rule is guarded on `dist > 0`; a 0 m run has no average to
    // be implausible about and must not be quarantined for having no duration.
    expect(verifyRunSubmission({ distance: 0, score: 0, durationMs: 0 }).valid).toBe(true);
  });

  it("rejects an impossible average speed", () => {
    // 100 km in one second is 100,000 m/s.
    const v = verifyRunSubmission({ distance: 100_000, score: 1, durationMs: 1000 });
    expect(v.valid).toBe(false);
    expect(v.quarantined).toBe(true);
  });

  it("rejects a distance that cannot have been flown in the time claimed", () => {
    // The short-run exemption below 100 m was removed on purpose; without it a
    // short run could claim any speed at all.
    const v = verifyRunSubmission({ distance: 5000, score: 1, durationMs: 900 });
    expect(v.valid).toBe(false);
    expect(v.quarantined).toBe(true);
  });

  it("checks the speed rule even for a short run", () => {
    // 99 m is under the old 100 m exemption. If that exemption were ever
    // reintroduced this would pass, so it is pinned deliberately.
    const short = verifyRunSubmission({ distance: 99, score: 1, durationMs: 1 });
    expect(short.valid).toBe(false);
  });

  it("rejects non-numeric and NaN telemetry rather than letting it through", () => {
    // Number("abc") is NaN, and every comparison against NaN is false — so a
    // naive gate would wave this straight through. This is the case that makes
    // the gate a real gate.
    const v = verifyRunSubmission({ distance: Number("abc"), score: 1, durationMs: 1000 });
    expect(v.valid).toBe(false);
  });

  it("treats a missing field as zero, not as absent", () => {
    expect(verifyRunSubmission({}).valid).toBe(true); // nothing claimed
    expect(verifyRunSubmission({ distance: 100 }).valid).toBe(false); // distance with no time
  });
});

describe("savePilotName — the moderation choke point", () => {
  it("keeps a clean name", () => {
    const out = savePilotName("Rook");
    expect(out).toBe("Rook");
    expect(isPilotNameClean(out)).toBe(true);
  });

  it("REPLACES a name that fails moderation rather than storing it", () => {
    // Replacement, not refusal: the dice, the portal account and any future
    // caller have no text field to show a rejection in, and a dirty name on a
    // public board is the failure that actually matters.
    const out = savePilotName("fuck");
    expect(out).not.toBe("fuck");
    expect(isPilotNameClean(out)).toBe(true);
  });

  it("strips characters outside letters, numbers, space, underscore, dot and dash", () => {
    const out = savePilotName("Rook<script>");
    expect(out).toBe("Rookscript");
    expect(out).not.toContain("<");
  });

  it("truncates to 14 characters", () => {
    expect(savePilotName("ABCDEFGHIJKLMNOPQRSTUVWXYZ").length).toBe(14);
  });

  it("keeps non-Latin scripts — the filter must not be an English-only gate", () => {
    // Three characters minimum, so CJK names need three of them: a two-character
    // Japanese or Chinese name is normal in that script and would be rejected
    // on length alone. That asymmetry is a real (if deliberate) policy choice
    // and is called out here so a future change to PILOT_NAME_MIN does not
    // quietly widen or narrow it by accident.
    for (const name of [" Linnut ", "Пётр", "太陽様", "小白龍", "김치맨", "Ísland"]) {
      const out = savePilotName(name);
      expect(out, name).toBe(name.trim());
      expect(out.length).toBeLessThanOrEqual(14);
      expect(isPilotNameClean(out), name).toBe(true);
    }
  });

  it("rejects a name under the minimum length whatever its script", () => {
    // Pinned as intentional, not accidental: two characters is too short.
    expect(isPilotNameClean("太陽")).toBe(false);
    expect(isPilotNameClean("Yo")).toBe(false);
  });

  it("generates a replacement for an empty or whitespace-only name", () => {
    for (const bad of ["", "   ", "\t\n"]) {
      const out = savePilotName(bad);
      expect(out.length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(isPilotNameClean(out)).toBe(true);
    }
  });

  it("persists exactly what it returns", () => {
    const out = savePilotName("Ivy");
    expect(loadPilotName("fallback")).toBe("Ivy");
    expect(out).toBe("Ivy");
  });
});

describe("loadPilotName — re-filters on read", () => {
  beforeEach(() => {
    try {
      storage.clear();
    } catch {
      /* private mode */
    }
  });

  it("generates and persists a name when none is stored", () => {
    const a = loadPilotName("fallback");
    expect(a.length).toBeGreaterThan(0);
    // Second call must return the same name, not a fresh one — otherwise the
    // dice would appear to do nothing on reload.
    expect(loadPilotName("fallback")).toBe(a);
  });

  it("re-filters a stored name that predates the filter or was edited in devtools", () => {
    // This is the whole reason the check is repeated on read: nothing stops
    // someone writing a blocked string straight into localStorage.
    storage.setItem("sunbird.name", "fuck");
    const out = loadPilotName("fallback");
    expect(out).not.toBe("fuck");
    expect(isPilotNameClean(out)).toBe(true);
  });

  it("ignores a stored value that is only whitespace", () => {
    storage.setItem("sunbird.name", "   ");
    expect(loadPilotName("fallback").length).toBeGreaterThan(0);
  });

  it("survives a storage layer that throws (private mode)", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("denied");
    };
    try {
      expect(() => loadPilotName("fallback")).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe("leaderboard backend disclosure", () => {
  it("names a backend, and the two agree with each other", () => {
    // The honesty rule: a device-only number is never presented as worldwide,
    // and the UI reads the backend name from here. If these two can disagree,
    // the chip can say "global" while showing local data.
    const backend = leaderboardBackend();
    expect(["http", "auds", "local"]).toContain(backend);
    if (!isLeaderboardOnline()) expect(backend).toBe("local");
    else expect(backend).not.toBe("local");
  });
});
