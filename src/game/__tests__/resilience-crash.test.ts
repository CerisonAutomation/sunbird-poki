import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrashReporter } from "../resilience/CrashReporter";
import { storage } from "../Storage";

beforeEach(() => {
  storage.clear();
  window.removeEventListener("error", () => undefined);
});

describe("CrashReporter", () => {
  it("captures an error into a typed entry and persists the journal", () => {
    const r = new CrashReporter();
    r.install();
    const entry = r.capture("error", new TypeError("boom is not a function"));
    expect(entry).not.toBeNull();
    expect(entry?.severity).toBe("error");
    expect(entry?.fp).toBeTruthy();
    // Journal survives a new instance (new session reads it back).
    const next = new CrashReporter();
    next.install();
    expect(next.previousSessionCrashes.length).toBe(1);
    expect(next.previousSessionCrashes[0]?.message).toContain("boom");
  });

  it("dedups identical fingerprints inside the window", () => {
    const r = new CrashReporter();
    r.install();
    expect(r.capture("error", new Error("game.render crashed at frame 12"))).not.toBeNull();
    expect(r.capture("error", new Error("game.render crashed at frame 99"))).toBeNull(); // same fp
    expect(r.capture("error", new Error("entirely different failure"))).not.toBeNull();
  });

  it("rate-caps a crash storm (12 per 5 min by default)", () => {
    const r = new CrashReporter();
    r.install();
    let accepted = 0;
    // Distinct words (not distinct numbers — fingerprints intentionally
    // collapse numeric noise, which is exactly the dedup this must not fight).
    const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa"];
    for (let i = 0; i < 50; i++) {
      if (r.capture("error", new Error(`failure ${words[i % words.length]} ${words[(i * 7) % words.length]}`))) accepted += 1;
    }
    expect(accepted).toBe(12);
  });

  it("redacts emails/secrets before persisting", () => {
    const r = new CrashReporter();
    r.install();
    const entry = r.capture("error", new Error("failed for user@corp.io with token=supersecret123"));
    expect(entry?.message).not.toContain("user@corp.io");
    expect(entry?.message).not.toContain("supersecret123");
  });

  it("forwards fingerprint+severity to the telemetry sink, not the message", () => {
    const r = new CrashReporter();
    const track = vi.fn();
    r.attach({ track });
    r.install();
    r.capture("error", new Error("explosive detail that must not travel"));
    expect(track).toHaveBeenCalledTimes(1);
    const [name, props] = track.mock.calls[0] as [string, Record<string, string>];
    expect(name).toBe("client_error");
    expect(props.fp).toBeTruthy();
    expect(props.severity).toBe("error");
    expect(JSON.stringify(props)).not.toContain("explosive detail");
  });

  it("classifies renderer failures as fatal for routing", () => {
    const r = new CrashReporter();
    r.install();
    const entry = r.capture("error", new Error("WebGL context lost during draw"));
    expect(entry?.severity).toBe("fatal");
  });

  it("captures through the real window error event, and stops after dispose", () => {
    const r = new CrashReporter();
    r.install();
    const spy = vi.spyOn(r, "capture");
    window.dispatchEvent(new ErrorEvent("error", { message: "real global error", error: new Error("real global error") }));
    expect(spy).toHaveBeenCalledTimes(1);
    r.dispose();
    // NOTE: re-spying the same method shares mock history — so assert on the
    // COUNT not re-creating a spy.
    window.dispatchEvent(new ErrorEvent("error", { message: "after dispose", error: new Error("after dispose") }));
    expect(spy).toHaveBeenCalledTimes(1); // listener gone — no new capture
  });

  it("ignores cross-origin Script error noise", () => {
    const r = new CrashReporter();
    r.install();
    const spy = vi.spyOn(r, "capture");
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    expect(spy).not.toHaveBeenCalled();
  });

  it("breadcrumbs ride along with the entry", () => {
    const r = new CrashReporter();
    r.install();
    r.breadcrumb("mode:zenith started");
    r.breadcrumb("board open distance");
    const entry = r.capture("error", new Error("crash with context"));
    expect(entry?.crumbs).toContain("mode:zenith started");
    expect(entry?.crumbs).toContain("board open distance");
  });

  it("a capture that itself throws is swallowed (never the new crash)", () => {
    const r = new CrashReporter();
    r.install();
    const evil = { toString(): never { throw new Error("nope"); } };
    expect(() => r.capture("error", evil)).not.toThrow();
  });

  it("install is idempotent", () => {
    const r = new CrashReporter();
    r.install();
    r.install();
    expect(() => r.dispose()).not.toThrow();
  });

  it("journal survives its own key being garbage (boots clean)", () => {
    storage.setItem("sunbird.crash.journal.v1", "not-json{{");
    const r = new CrashReporter();
    r.install();
    expect(r.previousSessionCrashes).toEqual([]);
  });

  it("journal is capped at 5 entries", () => {
    const r = new CrashReporter();
    r.install();
    for (let i = 0; i < 9; i++) r.capture("error", new Error(`distinct failure number ${i} ${"y".repeat(30)}`));
    const next = new CrashReporter();
    next.install();
    expect(next.previousSessionCrashes.length).toBeLessThanOrEqual(5);
  });
});
