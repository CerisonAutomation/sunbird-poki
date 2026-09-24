import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRoomInviteUrl, normalizeRoomCode } from "../RoomInvite";

describe("room invite deep links", () => {
  it("normalizes input to a 5-char code", () => {
    expect(normalizeRoomCode("abc12")).toBe("ABC12");
    expect(normalizeRoomCode("  a-bc1-2 ")).toBe("ABC12");
    expect(normalizeRoomCode("abc12zzz")).toBe("ABC12"); // truncated to 5
  });

  it("strips non-alphanumerics before validating", () => {
    expect(normalizeRoomCode("a!b@c#1$2")).toBe("ABC12");
  });

  it("rejects input with fewer than 5 usable characters", () => {
    expect(normalizeRoomCode("abc")).toBe("");
    expect(normalizeRoomCode("")).toBe("");
    expect(normalizeRoomCode("!!")).toBe("");
  });

  it("accepts a pasted invite without converting HTTPS into a room", () => {
    expect(normalizeRoomCode("https://game.example/play#room=abc12")).toBe("ABC12");
    expect(normalizeRoomCode("#room=ABC12&rival=other")).toBe("ABC12");
    expect(normalizeRoomCode("https://game.example/play")).toBe("");
    expect(normalizeRoomCode("https://game.example/#other=ABCDE")).toBe("");
  });
  it("builds a shareable URL", () => {
    expect(buildRoomInviteUrl("abc12")).toMatch(/#room=ABC12$/);
    expect(buildRoomInviteUrl("bad")).toMatch(/#room=BAD$/);
  });

  it("parses and consumes a #room= invite exactly once", async () => {
    vi.resetModules();
    const { readRoomInviteFromUrl } = await import("../RoomInvite");
    window.location.hash = "#room=XYZ12";
    expect(readRoomInviteFromUrl()).toBe("XYZ12");
    expect(readRoomInviteFromUrl()).toBe("XYZ12"); // already consumed this session
    expect(window.location.hash).not.toContain("room=");
  });

  it("ignores a hash without a room code", async () => {
    vi.resetModules();
    const { readRoomInviteFromUrl } = await import("../RoomInvite");
    window.location.hash = "#rival=a.b.c";
    expect(readRoomInviteFromUrl()).toBeNull();
  });

  afterEach(() => {
    window.location.hash = "";
  });
});
