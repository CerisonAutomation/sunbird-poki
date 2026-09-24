import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  MAX_JSON_PAYLOAD_BYTES,
  ROOM_CODE_MAX,
  NAME_MAX,
  SKIN_MAX,
  TOKEN_MAX,
  ProtocolError,
  encodeClientMessage,
  parseServerJsonFrame,
  parseServerMessage,
  type ServerMessage,
} from "../protocol/v1";

// Test helper: parse + assert the variant + narrow, so variant-specific
// property access type-checks without an `any` cast.
function parseFrame<T extends ServerMessage["type"]>(
  f: string | Uint8Array,
  type: T,
): Extract<ServerMessage, { type: T }> {
  const msg = parseServerJsonFrame(f);
  expect(msg.type).toBe(type);
  if (msg.type !== type) throw new Error(`expected server message "${type}", got "${msg.type}"`);
  return msg as Extract<ServerMessage, { type: T }>;
}

describe("protocol constants", () => {
  it("exposes protocol version 1", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it("max json payload is 8 KiB", () => {
    expect(MAX_JSON_PAYLOAD_BYTES).toBe(8192);
  });

  it("room code is limited to 5 characters", () => {
    expect(ROOM_CODE_MAX).toBe(5);
  });

  it("name is limited to 14 characters", () => {
    expect(NAME_MAX).toBe(14);
  });

  it("skin is limited to 32 characters", () => {
    expect(SKIN_MAX).toBe(32);
  });

  it("token is limited to 512 characters", () => {
    expect(TOKEN_MAX).toBe(512);
  });
});

describe("encodeClientMessage — join type", () => {
  it("encodes a valid join message", () => {
    const encoded = encodeClientMessage({
      type: "join",
      version: 1,
      intentId: "abc123",
      roomCode: "ABCD",
      seed: "test-seed",
      name: "Pilot",
      skin: "sunbird",
    });
    const parsed = JSON.parse(encoded);
    expect(parsed.type).toBe("join");
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe("Pilot");
  });

  it("rejects wrong protocol version on join", () => {
    expect(() =>
      encodeClientMessage({
        type: "join",
        version: 99,
        intentId: "x",
        roomCode: "ABCD",
        seed: "s",
        name: "P",
        skin: "sunbird",
      }),
    ).toThrow(ProtocolError);
  });

  it("truncates room code beyond max", () => {
    expect(() =>
      encodeClientMessage({
        type: "join",
        version: 1,
        intentId: "x",
        roomCode: "ABCDEFGH",
        seed: "s",
        name: "P",
        skin: "sunbird",
      }),
    ).toThrow(ProtocolError);
  });

  it("truncates name beyond max", () => {
    expect(() =>
      encodeClientMessage({
        type: "join",
        version: 1,
        intentId: "x",
        roomCode: "ABCD",
        seed: "s",
        name: "ThisNameIsWayTooLongForProtocol",
        skin: "sunbird",
      }),
    ).toThrow(ProtocolError);
  });

  it("truncates skin beyond max", () => {
    expect(() =>
      encodeClientMessage({
        type: "join",
        version: 1,
        intentId: "x",
        roomCode: "ABCD",
        seed: "s",
        name: "P",
        skin: "x".repeat(SKIN_MAX + 1),
      }),
    ).toThrow(ProtocolError);
  });

  it("allows empty room code (server rejects semantically)", () => {
    const encoded = encodeClientMessage({
      type: "join",
      version: 1,
      intentId: "x",
      roomCode: "",
      seed: "s",
      name: "P",
      skin: "sunbird",
    });
    expect(JSON.parse(encoded).roomCode).toBe("");
  });

  it("allows empty name (server rejects semantically)", () => {
    const encoded = encodeClientMessage({
      type: "join",
      version: 1,
      intentId: "x",
      roomCode: "ABCD",
      seed: "s",
      name: "",
      skin: "sunbird",
    });
    expect(JSON.parse(encoded).name).toBe("");
  });

  it("allows empty reconnect token", () => {
    const encoded = encodeClientMessage({
      type: "join",
      version: 1,
      intentId: "x",
      roomCode: "ABCD",
      seed: "s",
      name: "P",
      skin: "sunbird",
      reconnectToken: "",
    });
    expect(JSON.parse(encoded).reconnectToken).toBe("");
  });

  it("rejects oversized reconnect token on join", () => {
    expect(() =>
      encodeClientMessage({
        type: "join",
        version: 1,
        intentId: "x",
        roomCode: "ABCD",
        seed: "s",
        name: "P",
        skin: "sunbird",
        reconnectToken: "x".repeat(TOKEN_MAX + 1),
      }),
    ).toThrow(ProtocolError);
  });
});

describe("encodeClientMessage — leave type", () => {
  it("encodes a valid leave message", () => {
    const encoded = encodeClientMessage({
      type: "leave",
      version: 1,
      roomId: "room-1",
      seatId: "seat-1",
    });
    const parsed = JSON.parse(encoded);
    expect(parsed.type).toBe("leave");
    expect(parsed.roomId).toBe("room-1");
    expect(parsed.seatId).toBe("seat-1");
  });

  it("rejects wrong version on leave", () => {
    expect(() =>
      encodeClientMessage({ type: "leave", version: 2, roomId: "r", seatId: "s" }),
    ).toThrow(ProtocolError);
  });
});

describe("encodeClientMessage — ready type", () => {
  it("encodes a ready message", () => {
    const encoded = encodeClientMessage({
      type: "ready",
      version: 1,
      roomId: "room-1",
      seatId: "seat-1",
      ready: true,
    });
    expect(JSON.parse(encoded).ready).toBe(true);
  });

  it("encodes a not-ready message", () => {
    const encoded = encodeClientMessage({
      type: "ready",
      version: 1,
      roomId: "room-1",
      seatId: "seat-1",
      ready: false,
    });
    expect(JSON.parse(encoded).ready).toBe(false);
  });
});

describe("encodeClientMessage — heartbeat type", () => {
  it("encodes a heartbeat message", () => {
    const encoded = encodeClientMessage({
      type: "heartbeat",
      version: 1,
      roomId: "room-1",
      seatId: "seat-1",
      sequence: 42,
      clientTime: "2026-09-11T00:00:00Z",
    });
    const parsed = JSON.parse(encoded);
    expect(parsed.sequence).toBe(42);
    expect(parsed.clientTime).toBe("2026-09-11T00:00:00Z");
  });
});

describe("encodeClientMessage — reconnect type", () => {
  it("encodes a reconnect message", () => {
    const encoded = encodeClientMessage({
      type: "reconnect",
      version: 1,
      roomId: "room-1",
      seatId: "seat-1",
      reconnectToken: "token-abc",
    });
    expect(JSON.parse(encoded).reconnectToken).toBe("token-abc");
  });

  it("allows empty reconnect token on reconnect (skipped by truthiness check)", () => {
    const encoded = encodeClientMessage({
      type: "reconnect",
      version: 1,
      roomId: "r",
      seatId: "s",
      reconnectToken: "",
    });
    expect(JSON.parse(encoded).reconnectToken).toBe("");
  });
});

describe("encodeClientMessage — payload size limit", () => {
  it("rejects payloads exceeding 8 KiB", () => {
    const hugeName = "x".repeat(3000);
    expect(() =>
      encodeClientMessage({
        type: "join",
        version: 1,
        intentId: "x",
        roomCode: "ABCD",
        seed: "s",
        name: hugeName,
        skin: "sunbird",
      }),
    ).toThrow(ProtocolError);
  });
});

describe("parseServerJsonFrame — hello", () => {
  it("parses a hello message", () => {
    const frame = JSON.stringify({
      type: "hello",
      version: 1,
      serverName: "sunbird-server",
      limits: { version: 1, maxJsonPayloadBytes: 8192, maxNameChars: 14 },
    });
    const msg = parseFrame(frame, "hello");
    expect(msg.serverName).toBe("sunbird-server");
    expect(msg.limits.version).toBe(1);
    expect(msg.limits.maxJsonPayloadBytes).toBe(8192);
    expect(msg.limits.maxNameChars).toBe(14);
  });

  it("rejects hello with missing serverName", () => {
    expect(() =>
      parseServerJsonFrame(JSON.stringify({ type: "hello", version: 1, limits: { version: 1, maxJsonPayloadBytes: 8192, maxNameChars: 14 } })),
    ).toThrow(ProtocolError);
  });

  it("rejects hello with missing limits", () => {
    expect(() =>
      parseServerJsonFrame(JSON.stringify({ type: "hello", version: 1, serverName: "s" })),
    ).toThrow(ProtocolError);
  });

  it("rejects hello with non-number limit.version", () => {
    expect(() =>
      parseServerJsonFrame(
        JSON.stringify({
          type: "hello",
          version: 1,
          serverName: "s",
          limits: { version: "bad", maxJsonPayloadBytes: 8192, maxNameChars: 14 },
        }),
      ),
    ).toThrow(ProtocolError);
  });
});

describe("parseServerJsonFrame — welcome", () => {
  it("parses a welcome message with grant and room", () => {
    const frame = JSON.stringify({
      type: "welcome",
      version: 1,
      grant: { roomId: "r1", seatId: "s1", playerId: "p1", generation: 1, reconnectToken: "tok" },
      room: { id: "r1", code: "ABCD", seed: "seed", capacity: 40, hostSeatId: "s1", pilots: [] },
    });
    const msg = parseFrame(frame, "welcome");
    expect(msg.grant.roomId).toBe("r1");
    expect(msg.room.code).toBe("ABCD");
    expect(msg.room.capacity).toBe(40);
  });

  it("parses welcome with pilots array", () => {
    const frame = JSON.stringify({
      type: "welcome",
      version: 1,
      grant: { roomId: "r1", seatId: "s1", playerId: "p1", generation: 1, reconnectToken: "tok" },
      room: {
        id: "r1",
        code: "ABCD",
        seed: "seed",
        capacity: 40,
        hostSeatId: "s1",
        pilots: [{ id: "p2", name: "Other", skin: "sunbird", ready: false, reconnecting: false }],
      },
    });
    const msg = parseFrame(frame, "welcome");
    expect(msg.room.pilots).toHaveLength(1);
    expect(msg.room.pilots[0].id).toBe("p2");
  });

  it("rejects welcome with missing grant", () => {
    expect(() =>
      parseServerJsonFrame(
        JSON.stringify({
          type: "welcome",
          version: 1,
          room: { id: "r1", code: "ABCD", seed: "s", capacity: 40, hostSeatId: "s1", pilots: [] },
        }),
      ),
    ).toThrow(ProtocolError);
  });
});

describe("parseServerJsonFrame — rosterUpdate", () => {
  it("parses a roster update", () => {
    const frame = JSON.stringify({
      type: "rosterUpdate",
      version: 1,
      room: { id: "r1", code: "ABCD", seed: "s", capacity: 40, hostSeatId: "s1", pilots: [] },
    });
    const msg = parseFrame(frame, "rosterUpdate");
    expect(msg.room.code).toBe("ABCD");
  });
});

describe("parseServerJsonFrame — started", () => {
  it("parses a started message", () => {
    const frame = JSON.stringify({
      type: "started",
      version: 1,
      roomId: "r1",
      startAt: "2026-09-11T00:00:00Z",
      seed: "seed",
    });
    const msg = parseFrame(frame, "started");
    expect(msg.startAt).toBe("2026-09-11T00:00:00Z");
  });

  it("rejects started with missing startAt", () => {
    expect(() =>
      parseServerJsonFrame(JSON.stringify({ type: "started", version: 1, roomId: "r1", seed: "s" })),
    ).toThrow(ProtocolError);
  });

  it("rejects started with oversized seed", () => {
    expect(() =>
      parseServerJsonFrame(
        JSON.stringify({
          type: "started",
          version: 1,
          roomId: "r1",
          startAt: "2026-09-11T00:00:00Z",
          seed: "x".repeat(65),
        }),
      ),
    ).toThrow(ProtocolError);
  });
});

describe("parseServerJsonFrame — error messages", () => {
  it("parses unsupportedVersion error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "unsupportedVersion", version: 2, minSupported: 1 } }),
      "error",
    );
    expect(msg.error.code).toBe("unsupportedVersion");
  });

  it("parses invalidMessage error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "invalidMessage", reason: "bad" } }),
      "error",
    );
    expect(msg.error.code).toBe("invalidMessage");
    if (msg.error.code !== "invalidMessage") throw new Error("wrong error variant");
    expect(msg.error.reason).toBe("bad");
  });

  it("parses payloadTooLarge error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "payloadTooLarge", maxBytes: 8192 } }),
      "error",
    );
    expect(msg.error.code).toBe("payloadTooLarge");
  });

  it("parses rateLimited error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "rateLimited", retryAfterMs: 500 } }),
      "error",
    );
    expect(msg.error.code).toBe("rateLimited");
  });

  it("parses roomFull error (no extra fields)", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "roomFull" } }),
      "error",
    );
    expect(msg.error.code).toBe("roomFull");
  });

  it("parses roomNotFound error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "roomNotFound" } }),
      "error",
    );
    expect(msg.error.code).toBe("roomNotFound");
  });

  it("parses seatNotFound error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "seatNotFound" } }),
      "error",
    );
    expect(msg.error.code).toBe("seatNotFound");
  });

  it("parses invalidReconnectToken error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "invalidReconnectToken" } }),
      "error",
    );
    expect(msg.error.code).toBe("invalidReconnectToken");
  });

  it("parses rejected error", () => {
    const msg = parseFrame(
      JSON.stringify({ type: "error", version: 1, error: { code: "rejected", message: "nope" } }),
      "error",
    );
    expect(msg.error.code).toBe("rejected");
    if (msg.error.code !== "rejected") throw new Error("wrong error variant");
    expect(msg.error.message).toBe("nope");
  });
});

describe("parseServerJsonFrame — structural failures", () => {
  it("rejects non-JSON input", () => {
    expect(() => parseServerJsonFrame("not json")).toThrow(ProtocolError);
  });

  it("accepts Uint8Array input", () => {
    const frame = new TextEncoder().encode(
      JSON.stringify({
        type: "hello",
        version: 1,
        serverName: "s",
        limits: { version: 1, maxJsonPayloadBytes: 8192, maxNameChars: 14 },
      }),
    );
    const msg = parseFrame(frame, "hello");
    expect(msg.serverName).toBe("s");
  });

  it("rejects payloads exceeding 8 KiB", () => {
    const huge = "x".repeat(9000);
    expect(() =>
      parseServerJsonFrame(
        JSON.stringify({
          type: "hello",
          version: 1,
          serverName: huge,
          limits: { version: 1, maxJsonPayloadBytes: 8192, maxNameChars: 14 },
        }),
      ),
    ).toThrow(ProtocolError);
  });
});

describe("parseServerMessage — type discrimination", () => {
  it("rejects non-object message", () => {
    expect(() => parseServerMessage("string")).toThrow(ProtocolError);
    expect(() => parseServerMessage(42)).toThrow(ProtocolError);
    expect(() => parseServerMessage(null)).toThrow(ProtocolError);
    expect(() => parseServerMessage([1, 2, 3])).toThrow(ProtocolError);
  });

  it("rejects message with missing version", () => {
    expect(() => parseServerMessage({ type: "hello" })).toThrow(ProtocolError);
  });

  it("rejects non-version value", () => {
    expect(() => parseServerMessage({ type: "hello", version: "bad" })).toThrow(ProtocolError);
  });

  it("rejects unsupported version", () => {
    expect(() =>
      parseServerMessage({ type: "hello", version: 2, serverName: "s", limits: {} }),
    ).toThrow("unsupported protocol version");
  });

  it("rejects unknown message type", () => {
    expect(() =>
      parseServerMessage({ type: "unknown", version: 1 }),
    ).toThrow("unknown server message type");
  });
});

describe("ProtocolError", () => {
  it("constructs with message and code", () => {
    const err = new ProtocolError("something broke", "payloadTooLarge");
    expect(err.message).toContain("payloadTooLarge");
    expect(err.message).toContain("something broke");
    expect(err.code).toBe("payloadTooLarge");
    expect(err.name).toBe("ProtocolError");
  });

  it("defaults to invalidMessage code", () => {
    const err = new ProtocolError("generic");
    expect(err.code).toBe("invalidMessage");
  });
});
