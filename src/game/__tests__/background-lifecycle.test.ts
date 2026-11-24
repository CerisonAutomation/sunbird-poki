import { describe, expect, it, vi } from "vitest";
import { Game } from "../Game";

type Reason = "blur" | "hidden" | "portal" | "context";
const methods = Game.prototype as unknown as {
  suspendForBackground(reason: Reason): void;
  resumeFromBackground(reason: Reason): void;
  setState(state: "playing" | "paused" | "ad"): void;
};

function fixture(state: "playing" | "paused" | "ad" = "playing") {
  const game = {
    state, backgroundReasons: new Set<Reason>(),
    acc: 1, last: 0, menuHold: 0, needRelease: false, timeScale: 1, zenithTimer: 0,
    feverOn: false, stormfront: false, pauseScreenOrigin: null,
    audio: { setHiddenMuted: vi.fn(), suspend: vi.fn(), resumeExisting: vi.fn(), duckMusic: vi.fn(), setMusicMode: vi.fn() },
    wakeLock: { acquire: vi.fn(), release: vi.fn() },
    gameplaySink: { send: vi.fn() }, bump: vi.fn(),
    setState: methods.setState,
  };
  return game;
}

describe("overlapping background interruptions", () => {
  it("pauses once on blur and never automatically restarts on focus", () => {
    const game = fixture();
    methods.suspendForBackground.call(game, "blur");
    expect(game.state).toBe("paused");
    expect(game.gameplaySink.send).toHaveBeenCalledTimes(1);
    expect(game.gameplaySink.send).toHaveBeenCalledWith("stop");
    methods.resumeFromBackground.call(game, "blur");
    expect(game.state).toBe("paused");
    expect(game.audio.setHiddenMuted).toHaveBeenLastCalledWith(false);
    expect(game.gameplaySink.send).toHaveBeenCalledTimes(1);
  });

  it("keeps audio muted until every overlapping interruption clears", () => {
    const game = fixture();
    methods.suspendForBackground.call(game, "hidden");
    methods.suspendForBackground.call(game, "context");
    methods.suspendForBackground.call(game, "portal");
    methods.resumeFromBackground.call(game, "context");
    methods.resumeFromBackground.call(game, "portal");
    expect(game.audio.setHiddenMuted).not.toHaveBeenCalledWith(false);
    expect(game.audio.resumeExisting).not.toHaveBeenCalled();
    methods.resumeFromBackground.call(game, "hidden");
    expect(game.audio.setHiddenMuted).toHaveBeenLastCalledWith(false);
    expect(game.audio.resumeExisting).toHaveBeenCalledTimes(1);
  });

  it("does not start gameplay if an ad completes while still backgrounded", () => {
    const game = fixture("ad");
    methods.suspendForBackground.call(game, "blur");
    methods.setState.call(game, "playing");
    expect(game.state).toBe("paused");
    expect(game.gameplaySink.send).not.toHaveBeenCalledWith("start");
    methods.resumeFromBackground.call(game, "blur");
    methods.setState.call(game, "playing");
    expect(game.state).toBe("playing");
    expect(game.gameplaySink.send).toHaveBeenCalledWith("start");
  });
});
