import { describe, expect, it, vi, afterEach } from "vitest";

// ── normalizeRoomCode (10 tests) ───────────────────────────────────────────────
describe("room invite: normalizeRoomCode", () => {
  async function loadModule() {
    vi.resetModules();
    const mod = await import("../RoomInvite");
    return mod;
  }

  it("uppercases lowercase input", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("abc12")).toBe("ABC12");
  });

  it("strips spaces and hyphens", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("a-b-c-1-2")).toBe("ABC12");
  });

  it("strips non-alphanumeric chars", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("a!b@c#1$2")).toBe("ABC12");
  });

  it("truncates to exactly 5 chars", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("abc123456")).toBe("ABC12");
  });

  it("returns empty string for < 5 usable chars", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("ab")).toBe("");
  });

  it("returns empty string for empty input", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("")).toBe("");
  });

  it("handles null/undefined input", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode(null as unknown as string)).toBe("");
    expect(normalizeRoomCode(undefined as unknown as string)).toBe("");
  });

  it("validates 5 alphanumeric chars", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("ABC12")).toBe("ABC12");
    expect(normalizeRoomCode("a1b2c")).toBe("A1B2C");
  });

  it("rejects codes with underscores", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("AB_C1")).toBe("");
  });

  it("preserves digits in valid position", async () => {
    const { normalizeRoomCode } = await loadModule();
    expect(normalizeRoomCode("1AB2C")).toBe("1AB2C");
  });
});

// ── buildRoomInviteUrl (6 tests) ────────────────────────────────────────────────
describe("room invite: buildRoomInviteUrl", () => {
  async function loadModule(pathname = "/game") {
    vi.resetModules();
    Object.defineProperty(window, "location", {
      value: { origin: "https://sunbird.example", pathname },
      writable: true,
      configurable: true,
    });
    return await import("../RoomInvite");
  }

  it("builds URL with room hash", async () => {
    const { buildRoomInviteUrl } = await loadModule();
    expect(buildRoomInviteUrl("abc12")).toBe("https://sunbird.example/game#room=ABC12");
  });

  it("builds URL with full URL base", async () => {
    const { buildRoomInviteUrl } = await loadModule();
    expect(buildRoomInviteUrl("XYZ78")).toBe("https://sunbird.example/game#room=XYZ78");
  });

  it("encodes the room code", async () => {
    const { buildRoomInviteUrl } = await loadModule();
    const url = buildRoomInviteUrl("abc12");
    expect(url).toContain("room=ABC12");
  });

  it("preserves path with multiple segments", async () => {
    const { buildRoomInviteUrl } = await loadModule("/game/lobby");
    expect(buildRoomInviteUrl("abc12")).toBe("https://sunbird.example/game/lobby#room=ABC12");
  });

  it("uses raw code if normalize returns empty", async () => {
    const { buildRoomInviteUrl } = await loadModule();
    const url = buildRoomInviteUrl("bad");
    expect(url).toContain("room=BAD");
  });

  it("preserves valid 5-char codes with digits", async () => {
    const { buildRoomInviteUrl } = await loadModule();
    expect(buildRoomInviteUrl("1A2B3")).toContain("room=1A2B3");
  });
});

// ── readRoomInviteFromUrl (8 tests) ────────────────────────────────────────────
describe("room invite: readRoomInviteFromUrl", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  async function loadFresh() {
    vi.resetModules();
    const mod = await import("../RoomInvite");
    return mod;
  }

  it("reads and consumes a valid room code", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "#room=ABC12";
    expect(readRoomInviteFromUrl()).toBe("ABC12");
  });

  it("returns null when no room code in hash", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "#other=foo";
    expect(readRoomInviteFromUrl()).toBeNull();
  });

  it("returns null for empty hash", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "";
    expect(readRoomInviteFromUrl()).toBeNull();
  });

  it("returns null for invalid code", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "#room=abc";
    expect(readRoomInviteFromUrl()).toBeNull();
  });

  it("consumes the code once (returns same code twice)", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "#room=XYZ12";
    const first = readRoomInviteFromUrl();
    expect(first).toBe("XYZ12");
    const second = readRoomInviteFromUrl();
    expect(second).toBe("XYZ12");
  });

  it("preserves sibling hash params after consuming", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "#rival=abc&room=ABC12";
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const code = readRoomInviteFromUrl();
    expect(code).toBe("ABC12");
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls[0][2]).not.toContain("room=");
    replaceSpy.mockRestore();
  });

  it("handles malformed hash gracefully", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "not-a-valid-hash";
    expect(readRoomInviteFromUrl()).toBeNull();
  });

  it("throws are caught (returns null)", async () => {
    const { readRoomInviteFromUrl } = await loadFresh();
    window.location.hash = "#room=ABC12";
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRoomInviteFromUrl()).toBeNull();
  });
});
