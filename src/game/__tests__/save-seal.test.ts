import { beforeEach, describe, expect, it } from "vitest";
import { SaveData } from "../SaveData";
import { isSealed, openPayload, sealPayload } from "../resilience/crc";
import { SAVE_KEY, SAVE_KEY_CORRUPT } from "../constants";
import { storage } from "../Storage";

/**
 * Save integrity seal (CRC32 envelope) — migration contract:
 *
 *   write   → every persist stores a sealed envelope (v2 key + cloud adapter)
 *   read    → sealed loads verified; legacy bare-JSON loads pass through
 *   corrupt → checksum mismatch quarantines the blob and boots clean,
 *             exactly like unparseable JSON did before the seal existed
 */

beforeEach(() => {
  storage.clear();
});

describe("save sealing", () => {
  it("persists a sealed envelope whose payload round-trips", () => {
    const save = new SaveData();
    save.state.wallet = 432;
    save.persist();
    const stored = storage.getItem(SAVE_KEY);
    expect(stored).toBeTruthy();
    expect(isSealed(stored!)).toBe(true);
    const opened = openPayload(stored!);
    expect(opened.ok).toBe(true);
    expect(JSON.parse(opened.data).wallet).toBe(432);
  });

  it("loads a legacy bare-JSON save unchanged and upgrades it on next persist", () => {
    storage.setItem(SAVE_KEY, JSON.stringify({ bestDistance: 5555, wallet: 77 }));
    const save = new SaveData();
    expect(save.state.bestDistance).toBe(5555);
    expect(save.state.wallet).toBe(77);
    expect(save.recoveredFromCorruption).toBe(false);
    save.persist();
    expect(isSealed(storage.getItem(SAVE_KEY)!)).toBe(true);
    // Values survived the migration.
    expect(JSON.parse(openPayload(storage.getItem(SAVE_KEY)!).data).bestDistance).toBe(5555);
  });

  it("quarantines a sealed save whose values were tampered with (valid JSON, bad checksum)", () => {
    // Seed a good sealed save first.
    const save = new SaveData();
    save.state.wallet = 10;
    save.persist();
    const sealed = storage.getItem(SAVE_KEY)!;
    const env = JSON.parse(sealed) as { v: number; crc: string; data: string };
    // Tamper: valid JSON inside the envelope, but the bytes no longer match the CRC.
    const inner = JSON.parse(env.data) as { wallet: number };
    inner.wallet = 999_999;
    const tampered = JSON.stringify({ ...env, data: JSON.stringify(inner) });
    storage.setItem(SAVE_KEY, tampered);

    const booted = new SaveData();
    expect(booted.recoveredFromCorruption).toBe(true);
    expect(booted.state.wallet).not.toBe(999_999); // corrupt numbers never trusted
    expect(storage.getItem(SAVE_KEY_CORRUPT)).toBe(tampered); // parked for recovery
  });

  it("quarantines a truncated envelope", () => {
    const save = new SaveData();
    save.persist();
    const sealed = storage.getItem(SAVE_KEY)!;
    storage.setItem(SAVE_KEY, sealed.slice(0, Math.floor(sealed.length / 2)));
    const booted = new SaveData();
    expect(booted.recoveredFromCorruption).toBe(true);
    expect(storage.getItem(SAVE_KEY_CORRUPT)?.length).toBeGreaterThan(0);
  });

  it("hands the cloud adapter the sealed payload (every copy carries its own seal)", () => {
    const save = new SaveData();
    const received: Record<string, string> = {};
    save.platformAdapter = {
      saveData: (key, data) => {
        received[key] = data;
        return Promise.resolve();
      },
    };
    save.persist();
    expect(isSealed(received[SAVE_KEY] ?? "")).toBe(true);
    expect(received[SAVE_KEY]).toBe(storage.getItem(SAVE_KEY));
  });

  it("seal/open helpers agree on the envelope shape", () => {
    const raw = JSON.stringify({ a: 1 });
    expect(isSealed(sealPayload(raw))).toBe(true);
    expect(isSealed(raw)).toBe(false);
  });
});
