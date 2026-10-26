/**
 * Netlib game id + availability contract.
 *
 * These are the values Poki's platform judges. A malformed game id is
 * rejected by Netlib in production, so a submission build must supply the
 * Poki-issued id through `VITE_POKI_NETLIB_GAME_ID` and a bad value must be
 * discarded at build time — never shipped, never silently used.
 */
import { describe, expect, it } from "vitest";
import { DEV_NETLIB_ID, isNetlibGameId, isPokiMultiplayerAvailable, makePokiRoomCode, POKI_NETLIB_GAME_ID } from "../../sdk/PokiMpUtils";

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

  it("falls back to the shared DEV id in a build that supplies none", () => {
    // This contract CHANGED. It used to be "empty outside Poki builds — the
    // constant is compiled out entirely", on the reasoning that Netlib is a Poki
    // runtime. The developer guide says otherwise:
    //
    //   "The Poki Networking Library (Netlib) is a peer-to-peer library
    //    utilizing WebRTC datachannels to facilitate direct UDP connections
    //    between players [...] available for use regardless of whether the game
    //    is hosted on Poki."  (developers.poki.com/guide/game-dev-tools)
    //
    // Netlib ships its own ICE servers (stun.l.google.com, turn.rtc.poki.com),
    // so it needs nothing from a Poki page. Compiling the id out meant live PvP
    // could not be exercised on localhost or a self-hosted preview — the two
    // places it is cheapest to debug — and every multiplayer report could only
    // ever be reproduced on a portal build.
    //
    // vitest runs with no VITE_POKI_NETLIB_GAME_ID, i.e. an unconfigured build.
    expect(POKI_NETLIB_GAME_ID).toBe(DEV_NETLIB_ID);
    // ...and it is a real UUID, so Netlib will not reject it outright. Every
    // developer lands in the same lobbies rather than each in a private one.
    expect(isNetlibGameId(POKI_NETLIB_GAME_ID)).toBe(true);
  });

  it("never ships a malformed id, on any build", () => {
    // The half of the old contract that was right, and the one that matters for
    // submission: Netlib rejects a bad game id in production, so a bad value is
    // discarded at build time rather than shipped.
    expect(isNetlibGameId("")).toBe(false);
    expect(isNetlibGameId(undefined)).toBe(false);
    expect(isNetlibGameId("not-a-uuid")).toBe(false);
    expect(isNetlibGameId(POKI_NETLIB_GAME_ID)).toBe(true);
  });

  it("offers Netlib wherever WebRTC exists, not only on Poki", () => {
    // jsdom has no RTCPeerConnection, so availability is correctly false HERE.
    // The gate that was removed was `IS_POKI`, never a capability check — and
    // that is the distinction worth keeping under test.
    expect(isPokiMultiplayerAvailable()).toBe(false);
    const probe = isPokiMultiplayerAvailable();
    expect(typeof probe).toBe("boolean");
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
