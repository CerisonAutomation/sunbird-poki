import { TRACK_NAMES } from "../Music";
import type { GameAudio } from "../Audio";
import type { HUD } from "../HUD";
import type { Telemetry } from "../Telemetry";
import type { SaveData } from "../SaveData";

/**
 * The settings + danger-zone action table: every `set-*` toggle, the volume
 * and track selectors, and the two-step progress reset.
 *
 * The narrowest port of the three extracted so far — nine members for 118
 * lines, against 25 for the shop's 112. Almost everything a setting changes
 * lives on `SaveData`, so the table needs one shared object and a few verbs;
 * the toggles are read-modify-write pairs on it, which is why `save` is the
 * single mutable member and needs no accessor.
 *
 * `resetArmed` and `resetTimer` are the only writable primitives, and they
 * exist solely so "reset progress" takes two taps. They are accessors in
 * `Game.settingsContext()` for the reason the shop and journey ports are:
 * a plain copy would typecheck and then drop the arming.
 */
export interface SettingsActionContext {
  readonly save: SaveData;
  readonly hud: HUD;
  readonly audio: GameAudio;
  readonly telemetry: Telemetry;
  resetArmed: boolean;
  resetTimer: number;
  applySettings(): void;
  applySkin(): void;
  bump(): void;
}

/**
 * Route a settings action. Returns true when the table consumed it; unknown
 * actions fall through to the next handler in `handleAction`.
 */
export function settingsAction(ctx: SettingsActionContext, action: string, id: string): boolean {

    switch (action) {
      case "set-mute":
        ctx.save.state.settings.mute = !ctx.save.state.settings.mute;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-doubletap":
        if (!ctx.save.hasUpgrade("doubletap")) return true;
        ctx.save.state.settings.doubleTapBoost = !ctx.save.state.settings.doubleTapBoost;
        ctx.save.persist();
        ctx.bump();
        return true;
      case "set-music":
        ctx.save.state.settings.music = !ctx.save.state.settings.music;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-music-vol": {
        const cur = ctx.save.state.settings.musicVolume;
        const next = id !== "" && Number.isFinite(Number(id)) ? Math.max(0, Math.min(1, Number(id) / 100)) : cur >= 1 ? 0 : Math.min(1, Math.round((cur + 0.25) * 100) / 100);
        ctx.save.state.settings.musicVolume = next;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      }
      case "set-sfx-vol": {
        const cur = ctx.save.state.settings.sfxVolume;
        const next = id !== "" && Number.isFinite(Number(id)) ? Math.max(0, Math.min(1, Number(id) / 100)) : cur >= 1 ? 0 : Math.min(1, Math.round((cur + 0.25) * 100) / 100);
        ctx.save.state.settings.sfxVolume = next;
        ctx.save.persist();
        ctx.applySettings();
        ctx.audio.ding();
        return true;
      }
      case "set-track": {
        const cur = ctx.save.state.settings.musicTrack;
        const next = id === "shuffle" ? "shuffle" : id !== "" && Number.isInteger(Number(id)) && Number(id) >= 0 && Number(id) < TRACK_NAMES.length ? Number(id) : cur === "shuffle" ? 0 : cur >= TRACK_NAMES.length - 1 ? "shuffle" : cur + 1;
        ctx.save.state.settings.musicTrack = next;
        ctx.save.persist();
        ctx.applySettings();
        ctx.audio.uiTick();
        return true;
      }
      case "set-music-style": {
        ctx.save.state.settings.musicStyle =
          id === "procedural" || id === "songbook"
            ? id
            : ctx.save.state.settings.musicStyle === "songbook"
              ? "procedural"
              : "songbook";
        ctx.save.persist();
        ctx.applySettings();
        ctx.audio.uiTick();
        return true;
      }
      case "set-haptics":
        ctx.save.state.settings.haptics = !ctx.save.state.settings.haptics;
        ctx.save.persist();
        ctx.bump();
        return true;
      case "dismiss-onboarding":
        // Explicit skip on the "START HERE" route — once dismissed it stays
        // gone even though `runsPlayed < 2` would otherwise keep showing it.
        ctx.save.state.settings.dismissedOnboarding = true;
        ctx.save.persist();
        ctx.bump();
        return true;
      case "set-motion":
        ctx.save.state.settings.reduceMotion = !ctx.save.state.settings.reduceMotion;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-colorassist":
        ctx.save.state.settings.colorAssist = !ctx.save.state.settings.colorAssist;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-soft-camera":
        ctx.save.state.settings.softCamera = !ctx.save.state.settings.softCamera;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-bigtext":
        ctx.save.state.settings.bigText = !ctx.save.state.settings.bigText;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-tap-toggle-dive":
        ctx.save.state.settings.tapToggleDive = !ctx.save.state.settings.tapToggleDive;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      case "set-quality": {
        const order = ["auto", "high", "low"] as const;
        const cur = ctx.save.state.settings.quality;
        ctx.save.state.settings.quality = id === "auto" || id === "high" || id === "low" ? id : order[(order.indexOf(cur) + 1) % order.length]!;
        ctx.save.persist();
        ctx.applySettings();
        return true;
      }
      case "reset-progress":
        if (!ctx.resetArmed) {
          ctx.resetArmed = true;
          ctx.resetTimer = 3;
        } else {
          ctx.resetArmed = false;
          ctx.save.resetProgress();
          ctx.applySkin();
          ctx.applySettings();
          ctx.hud.toast("Progress reset", "warn");
          ctx.telemetry.track("progress_reset", {});
        }
        ctx.bump();
        return true;
      default:
        return false;
    }
}
