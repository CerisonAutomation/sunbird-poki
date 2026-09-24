import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAVE_KEY, SAVE_KEY_CORRUPT, SAVE_KEY_V1 } from "../constants";
import { openPayload } from "../resilience/crc";
import { SaveData } from "../SaveData";

/**
 * Local-first persistence acceptance tests — the outcomes a player actually
 * experiences, not internals: a healthy save loads, a corrupt save boots clean
 * *without* destroying the recoverable blob, a v1 save migrates forward, a
 * failed write is observable, and export/import round-trips.
 */
describe("local-first persistence", () => {
  beforeEach(() => localStorage.clear());

  it("loads a healthy save", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ bestDistance: 1234, wallet: 50, lifetime: { sunflowers: 7 } }));
    const sd = new SaveData();
    expect(sd.state.bestDistance).toBe(1234);
    expect(sd.state.wallet).toBe(50);
    expect(sd.state.lifetime.sunflowers).toBe(7);
    expect(sd.recoveredFromCorruption).toBe(false);
  });

  it("first boot creates a valid default save", () => {
    const sd = new SaveData();
    expect(sd.state.ownedSkins).toContain("sunbird");
    expect(Number.isFinite(sd.state.wallet)).toBe(true);
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();
  });

  it("recovers from a corrupt save without destroying the data", () => {
    localStorage.setItem(SAVE_KEY, '{"bestDistance": 5000, wallet: 30'); // truncated JSON
    const sd = new SaveData();
    expect(sd.recoveredFromCorruption).toBe(true);
    expect(sd.state.bestDistance).toBe(0); // booted clean
    // The unreadable blob is parked, not overwritten.
    expect(localStorage.getItem(SAVE_KEY_CORRUPT)).toContain("5000");
    // A subsequent persist writes fresh state but must leave the backup alone.
    sd.addCoins(100);
    expect(localStorage.getItem(SAVE_KEY_CORRUPT)).toContain("5000");
    expect(JSON.parse(openPayload(localStorage.getItem(SAVE_KEY)!).data).wallet).toBe(100);
  });

  it("migrates a v1 save forward to v2", () => {
    localStorage.setItem(SAVE_KEY_V1, JSON.stringify({ bestDistance: 777, wallet: 99 }));
    const sd = new SaveData();
    expect(sd.recoveredFromCorruption).toBe(false);
    expect(sd.state.bestDistance).toBe(777);
    sd.persist();
    expect(JSON.parse(openPayload(localStorage.getItem(SAVE_KEY)!).data).bestDistance).toBe(777);
  });

  it("observes write failures (throttled) instead of swallowing them", () => {
    const sd = new SaveData();
    let calls = 0;
    sd.onPersistError = () => calls++;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      sd.persist();
      sd.persist();
      sd.persist();
      // All three failed, but the observer fired once (10s throttle).
      expect(calls).toBe(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it("export/import round-trips the save", () => {
    const sd = new SaveData();
    sd.state.wallet = 321;
    sd.state.bestDistance = 4567;
    const code = sd.exportCode();
    expect(code.length).toBeGreaterThan(0);

    const sd2 = new SaveData();
    expect(sd2.importCode(code)).toBe(true);
    expect(sd2.state.wallet).toBe(321);
    expect(sd2.state.bestDistance).toBe(4567);
  });

  it("rejects a malformed import code", () => {
    const sd = new SaveData();
    expect(sd.importCode("not-a-valid-code!!")).toBe(false);
    expect(sd.importCode(btoa("{\"junk\":true}"))).toBe(false); // no deviceId
  });

  it("keeps one-time/daily claim records across a reload (no re-claim on boot)", () => {
    // Regression: these optional fields were missing from the parse literal,
    // so EVERY reload silently dropped them — the daily stipend (+250),
    // squad quests and the one-time crate (net +10/click) were all re-claimable
    // after each page load.
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        deviceId: "dev-1",
        lastStipendClaimed: "2026-09-16",
        squadQuestsClaimed: { drafting: "2026-09-16" },
        rankPrizeSeason: "R2026-09",
        wingmanBundle: true,
      }),
    );
    const sd = new SaveData();
    expect(sd.state.lastStipendClaimed).toBe("2026-09-16");
    expect(sd.state.squadQuestsClaimed).toEqual({ drafting: "2026-09-16" });
    expect(sd.state.rankPrizeSeason).toBe("R2026-09");
    expect(sd.state.wingmanBundle).toBe(true);
    // A fresh persist keeps them in the on-disk blob.
    sd.persist();
    const onDisk = JSON.parse(openPayload(localStorage.getItem(SAVE_KEY)!).data);
    expect(onDisk.lastStipendClaimed).toBe("2026-09-16");
    expect(onDisk.wingmanBundle).toBe(true);
  });

  it("sanitizes hostile claim-record payloads on load", () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        deviceId: "dev-2",
        lastStipendClaimed: { evil: true },
        squadQuestsClaimed: ["drafting"], // array, not a record
        rankPrizeSeason: 42,
        wingmanBundle: "yes",
      }),
    );
    const sd = new SaveData();
    // Type-safe coercion: an object/number/bool never passes through typed.
    expect(typeof sd.state.lastStipendClaimed).toBe("string");
    expect(sd.state.squadQuestsClaimed).toEqual({});
    expect(sd.state.rankPrizeSeason).toBe("42");
    expect(sd.state.wingmanBundle).toBe(true);
  });
});
