import { describe, expect, it } from "vitest";
import { settingsAction, type SettingsActionContext } from "../actions/settings";
import { SaveData } from "../SaveData";
import type { GameAudio } from "../Audio";
import type { HUD } from "../HUD";
import type { Telemetry } from "../Telemetry";

/**
 * The settings action table, exercised without a Game.
 *
 * Every case here is a read-modify-write on `save.state.settings`, which is
 * exactly the shape that breaks quietly: a bad `id` guard or a bad default
 * either pins a setting at its current value forever or throws a player back
 * to the default with no visible cause. The two-tap reset matters for a
 * different reason — it is the one place in the settings table that destroys
 * save data, and it is guarded by nothing but the arming flag.
 */

interface Recorded {
  toasts: string[];
  tracked: string[];
  applySettings: number;
  applySkin: number;
  bump: number;
}

function recorder(): Recorded {
  return { toasts: [], tracked: [], applySettings: 0, applySkin: 0, bump: 0 };
}

function context(save: SaveData, rec: Recorded, over: Partial<SettingsActionContext> = {}): SettingsActionContext {
  return {
    save,
    hud: { toast: (message: string) => rec.toasts.push(message) } as unknown as HUD,
    audio: { ding() {}, uiTick() {} } as unknown as GameAudio,
    telemetry: { track: (event: string) => rec.tracked.push(event) } as unknown as Telemetry,
    resetArmed: false,
    resetTimer: 0,
    applySettings: () => {
      rec.applySettings += 1;
    },
    applySkin: () => {
      rec.applySkin += 1;
    },
    bump: () => {
      rec.bump += 1;
    },
    ...over,
  };
}

describe("settings action table", () => {
  it("consumes only the actions it owns", () => {
    const save = new SaveData();
    const rec = recorder();
    // handleAction dispatches on the return value, so an unknown action must
    // fall through to the next handler rather than being swallowed.
    expect(settingsAction(context(save, rec), "not-a-setting", "")).toBe(false);
    expect(settingsAction(context(save, rec), "set-mute", "")).toBe(true);
  });

  it("flips every boolean toggle and applies it", () => {
    const toggles = [
      ["set-mute", "mute"],
      ["set-music", "music"],
      ["set-haptics", "haptics"],
      ["set-motion", "reduceMotion"],
      ["set-colorassist", "colorAssist"],
      ["set-soft-camera", "softCamera"],
      ["set-bigtext", "bigText"],
      ["set-tap-toggle-dive", "tapToggleDive"],
    ] as const;

    for (const [action, field] of toggles) {
      const save = new SaveData();
      const rec = recorder();
      const before = save.state.settings[field];
      expect(settingsAction(context(save, rec), action, "")).toBe(true);
      expect(save.state.settings[field]).toBe(!before);
      // Two taps is always a round trip, whatever the starting value.
      expect(settingsAction(context(save, rec), action, "")).toBe(true);
      expect(save.state.settings[field]).toBe(before);
    }
  });

  it("will not grant the double-tap upgrade from the settings toggle", () => {
    const save = new SaveData();
    const rec = recorder();
    // The preference is only meaningful once the upgrade is owned, so without
    // it the toggle must leave the stored value exactly as it found it. (The
    // default is already true, so asserting "false" here would pass for the
    // wrong reason; the invariant is that nothing changes.)
    const before = save.state.settings.doubleTapBoost;
    expect(save.hasUpgrade("doubletap")).toBe(false);
    settingsAction(context(save, rec), "set-doubletap", "");
    expect(save.state.settings.doubleTapBoost).toBe(before);

    // With the upgrade owned the same button does flip it.
    save.ownUpgrade("doubletap");
    settingsAction(context(save, rec), "set-doubletap", "");
    expect(save.state.settings.doubleTapBoost).toBe(!before);
  });

  it("steps a volume by 25% and wraps at both ends", () => {
    const save = new SaveData();
    const rec = recorder();
    save.state.settings.musicVolume = 0;
    settingsAction(context(save, rec), "set-music-vol", "");
    expect(save.state.settings.musicVolume).toBeCloseTo(0.25);
    settingsAction(context(save, rec), "set-music-vol", "");
    expect(save.state.settings.musicVolume).toBeCloseTo(0.5);
    // At full it wraps to zero rather than clamping forever at max.
    save.state.settings.musicVolume = 1;
    settingsAction(context(save, rec), "set-music-vol", "");
    expect(save.state.settings.musicVolume).toBe(0);
  });

  it("takes a slider value as a percentage and clamps it into 0..1", () => {
    const save = new SaveData();
    const rec = recorder();
    settingsAction(context(save, rec), "set-sfx-vol", "60");
    expect(save.state.settings.sfxVolume).toBeCloseTo(0.6);
    // A malformed id must not poison the saved value — it takes the step path
    // (0.6 + 0.25) rather than writing NaN into the audio bus.
    settingsAction(context(save, rec), "set-sfx-vol", "not-a-number");
    expect(save.state.settings.sfxVolume).toBeCloseTo(0.85);
    expect(Number.isFinite(save.state.settings.sfxVolume)).toBe(true);
    settingsAction(context(save, rec), "set-sfx-vol", "5000");
    expect(save.state.settings.sfxVolume).toBe(1);
    settingsAction(context(save, rec), "set-sfx-vol", "-20");
    expect(save.state.settings.sfxVolume).toBe(0);
  });

  it("keeps a track id the library does not have from being stored", () => {
    const save = new SaveData();
    const rec = recorder();
    save.state.settings.musicTrack = 0;
    // Out of range for TRACK_NAMES, so it advances one step instead of
    // storing an index the audio bus cannot play.
    settingsAction(context(save, rec), "set-track", "99999");
    expect(save.state.settings.musicTrack).toBe(1);

    settingsAction(context(save, rec), "set-track", "shuffle");
    expect(save.state.settings.musicTrack).toBe("shuffle");
  });

  it("toggles music style between the two real ones and rejects junk", () => {
    const save = new SaveData();
    const rec = recorder();
    settingsAction(context(save, rec), "set-music-style", "songbook");
    expect(save.state.settings.musicStyle).toBe("songbook");
    // Unknown id: songbook is the current value, so it steps to procedural
    // rather than storing the junk string.
    settingsAction(context(save, rec), "set-music-style", "garbage");
    expect(save.state.settings.musicStyle).toBe("procedural");
  });

  it("cycles quality auto → high → low and ignores an unknown id", () => {
    const save = new SaveData();
    const rec = recorder();
    save.state.settings.quality = "auto";
    settingsAction(context(save, rec), "set-quality", "");
    expect(save.state.settings.quality).toBe("high");
    settingsAction(context(save, rec), "set-quality", "");
    expect(save.state.settings.quality).toBe("low");
    settingsAction(context(save, rec), "set-quality", "");
    expect(save.state.settings.quality).toBe("auto");
    settingsAction(context(save, rec), "set-quality", "ultra");
    expect(["auto", "high", "low"]).toContain(save.state.settings.quality);
  });

  it("keeps an explicitly dismissed onboarding card dismissed", () => {
    const save = new SaveData();
    const rec = recorder();
    settingsAction(context(save, rec), "dismiss-onboarding", "");
    // The flag is sticky: the card hides on `runsPlayed < 2`, so clearing it
    // would bring back a card the player already dismissed.
    expect(save.state.settings.dismissedOnboarding).toBe(true);
  });

  it("resets progress only on the second tap, and says so", () => {
    const save = new SaveData();
    save.addCoins(5000);
    const rec = recorder();
    const ctx = context(save, rec);

    settingsAction(ctx, "reset-progress", "");
    // First tap arms. The wallet is untouched and nothing is torn down.
    expect(ctx.resetArmed).toBe(true);
    expect(save.state.wallet).toBeGreaterThan(0);
    expect(rec.toasts).toHaveLength(0);

    settingsAction(ctx, "reset-progress", "");
    expect(ctx.resetArmed).toBe(false);
    expect(save.state.wallet).toBe(0);
    expect(rec.toasts.join(" ")).toMatch(/reset/i);
    expect(rec.tracked).toContain("progress_reset");
  });
});
