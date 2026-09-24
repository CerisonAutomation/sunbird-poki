/**
 * Netlib game id + availability contract.
 *
 * These are the values Poki's platform judges. A malformed game id is
 * rejected by Netlib in production, so a submission build must supply the
 * Poki-issued id through `VITE_POKI_NETLIB_GAME_ID` and a bad value must be
 * discarded at build time — never shipped, never silently used.
 */
import { describe, expect, it } from "vitest";
import { isNetlibGameId, isPokiMultiplayerAvailable, makePokiRoomCode, POKI_NETLIB_GAME_ID } from "../PokiMpUtils";

describe("netlib: game id", () => {
  it("accepts canonical UUIDs (any case) and nothing else", () => {
    expect(isNetlibGameId("33c4c5a6-ee70-4726-aa1f-ced8a9578254")).toBe(true);
    expect(isNetlibGameId("33C4C5A6-EE70-4726-AA1F-CED8A9578254")).toBe(true);
    expect(isNetlibGameId("ed84")).toBe(false); // a lobby code is not a game id
    expect(isNetlibGameId("33c4c5a6ee704726aa1fced8a9578254")).toBe(false); // un-dashed
    expect(isNetlibGameId("33c4c5a6-ee70-4726-aa1f-ced8a957825z")).toBe(false); // non-hex
    expect(isNetlibGameId("")).toBe(false);
    expect(isNetlibGameId(undefined)).toBe(false);
  });

  it("is empty outside Poki builds — the constant is compiled out entirely", () => {
    // vitest runs with no VITE_PORTAL_TARGET, i.e. a non-Poki build.
    expect(POKI_NETLIB_GAME_ID).toBe("");
    expect(isPokiMultiplayerAvailable()).toBe(false);
  });
});

describe("netlib: room codes", () => {
  it("uses the shared 5-char alphabet with no confusable characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = makePokiRoomCode();
      expect(code).toMatch(/^[A-Z2-9]{5}$/);
      expect(code).not.toMatch(/[O0I1]/);
    }
  });
});
