import { describe, expect, it } from "vitest";
import { GameplayEventSink } from "../GameplayEvents";
import type { GameplayPhase } from "../GameplayEvents";

function makeSink(emit: (phase: GameplayPhase) => void): GameplayEventSink {
  return new GameplayEventSink(emit);
}

describe("GameplayEventSink (Poki: no duplicate consecutive events)", () => {
  it("passes the canonical death → break → restart sequence through untouched", () => {
    const out: GameplayPhase[] = [];
    const sink = makeSink((p) => out.push(p));
    sink.send("stop"); // playing → gameover
    sink.send("start"); // break done → playing again
    expect(out).toEqual(["stop", "start"]);
  });

  it("suppresses the double-stop from a defensive resend before a break", () => {
    // The old code re-sent gameplayStop() unconditionally when a portal ad
    // opened. On the normal death→restart path the state machine had
    // already sent stop — the resend was the forbidden consecutive
    // duplicate.
    const out: GameplayPhase[] = [];
    const sink = makeSink((p) => out.push(p));
    sink.send("stop"); // state machine: playing → gameover
    sink.send("stop"); // legacy defensive resend in beginPortalAd
    sink.send("start"); // restart after the break
    expect(out).toEqual(["stop", "start"]);
  });

  it("suppresses a repeated start (late SDK landing re-sync)", () => {
    const out: GameplayPhase[] = [];
    const sink = makeSink((p) => out.push(p));
    sink.send("start"); // first input
    sink.send("start"); // adapter landing re-sync while still playing
    expect(out).toEqual(["start"]);
  });

  it("supports repeated pause → resume ping-pong", () => {
    const out: GameplayPhase[] = [];
    const sink = makeSink((p) => out.push(p));
    sink.send("start");
    sink.send("stop"); // pause
    sink.send("start"); // resume
    sink.send("stop"); // pause again
    expect(out).toEqual(["start", "stop", "start", "stop"]);
  });

  it("never emits when nothing has ever been sent", () => {
    let calls = 0;
    const sink = makeSink(() => calls++);
    // A sink that is never used stays silent — no phantom startup events.
    expect(sink.lastPhase).toBeNull();
    expect(calls).toBe(0);
  });

  it("records a phase even when the adapter is not ready yet, and does not replay it", () => {
    // Death happens before the portal SDK lands: the emit is a no-op
    // (no adapter) but the phase must still be recorded, so a later
    // "defensive" resend after the adapter arrives is suppressed.
    const emitted: GameplayPhase[] = [];
    let platform: { fire: (p: GameplayPhase) => void } | null = null;
    const sink = makeSink((p) => platform?.fire(p));
    sink.send("stop"); // no adapter yet — dropped, but recorded
    platform = { fire: (p) => emitted.push(p) };
    sink.send("stop"); // late defensive resend — must be suppressed
    sink.send("start"); // genuine transition after the break
    expect(emitted).toEqual(["start"]);
    expect(sink.lastPhase).toBe("start");
  });
});
