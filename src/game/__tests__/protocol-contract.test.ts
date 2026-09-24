import { describe, expect, it } from "vitest";

import contractJson from "../../../protocol/contract.json";

import {
  CLIENT_MESSAGE_TYPES,
  ERROR_MESSAGE_MAX,
  IDEMPOTENCY_MAX,
  MAX_JSON_PAYLOAD_BYTES,
  MOVEMENT_LIMITS,
  NAME_MAX,
  PROTOCOL_MIN_VERSION,
  PROTOCOL_VERSION,
  ROOM_CODE_MAX,
  SEED_MAX,
  SERVER_ERROR_CODES,
  SERVER_MESSAGE_TYPES,
  SKIN_MAX,
  TOKEN_MAX,
  TOKEN_MIN,
  ProtocolError,
  encodeClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "../protocol/v1";

/**
 * Conformance against `protocol/contract.json` — the single source of truth.
 *
 * The Rust implementation runs the mirror-image of this suite in
 * `rust/crates/sunbird-protocol/tests/contract.rs` against the same file. The
 * point is that the two language implementations cannot drift silently: this
 * suite exists because `ServerMessage::Snapshot` shipped in Rust with no
 * TypeScript counterpart, so the browser client would have thrown
 * `unknown server message type snapshot` on any authoritative snapshot frame.
 */

type Contract = {
  protocolVersion: number;
  minProtocolVersion: number;
  limits: Record<string, number>;
  movement: Record<string, unknown>;
  clientMessages: Record<string, { required: string[]; optional: string[]; sample: Record<string, unknown> }>;
  serverMessages: Record<string, { required: string[]; sample: Record<string, unknown> }>;
  serverErrorCodes: string[];
  legacy: { up: string[]; down: string[]; capacity: number; tickHz: number; stateFields: string[] };
};

// Imported as JSON so the exact bytes both suites read are the same file, and
// so nothing here depends on the test runner's working directory.
const contract = contractJson as unknown as Contract;

describe("protocol contract — limits are identical on both sides", () => {
  it("pins the protocol version", () => {
    expect(PROTOCOL_VERSION).toBe(contract.protocolVersion);
    expect(PROTOCOL_MIN_VERSION).toBe(contract.minProtocolVersion);
  });

  it("pins every wire limit", () => {
    expect(MAX_JSON_PAYLOAD_BYTES).toBe(contract.limits.maxJsonPayloadBytes);
    expect(NAME_MAX).toBe(contract.limits.maxNameChars);
    expect(ROOM_CODE_MAX).toBe(contract.limits.maxRoomCodeChars);
    expect(SEED_MAX).toBe(contract.limits.maxSeedChars);
    expect(SKIN_MAX).toBe(contract.limits.maxSkinChars);
    expect(IDEMPOTENCY_MAX).toBe(contract.limits.maxIdempotencyChars);
    expect(ERROR_MESSAGE_MAX).toBe(contract.limits.maxErrorMessageChars);
    expect(TOKEN_MIN).toBe(contract.limits.sessionMinTokenChars);
    expect(TOKEN_MAX).toBe(contract.limits.sessionMaxTokenChars);
  });

  it("pins the server-authoritative movement envelope", () => {
    for (const [key, value] of Object.entries(contract.movement)) {
      if (key.startsWith("_") || key === "derivation") continue;
      expect(MOVEMENT_LIMITS, `movement limit "${key}" drifted from the contract`).toHaveProperty(key, value);
    }
  });

  it("derives the per-tick delta cap from the physics ceiling", () => {
    // Guard against someone editing one number without the other: the cap must
    // stay at or above the honest physics ceiling (234 u/s at 15 Hz) and below
    // 3x it, or it is either rejecting real flights or admitting teleports.
    const movementNumber = (key: string): number => {
      const value = contract.movement[key];
      if (typeof value !== "number") throw new Error(`movement.${key} is not a number in the contract`);
      return value;
    };
    const honestMinimum = movementNumber("maxSpeedUnitsPerSec") / movementNumber("tickHz");
    expect(MOVEMENT_LIMITS.maxStateDeltaXPerTick).toBeGreaterThanOrEqual(honestMinimum);
    expect(MOVEMENT_LIMITS.maxStateDeltaXPerTick).toBeLessThan(honestMinimum * 3);
  });
});

describe("protocol contract — variant vocabulary cannot drift", () => {
  it("knows every server message variant the contract declares", () => {
    expect([...SERVER_MESSAGE_TYPES].sort()).toEqual(Object.keys(contract.serverMessages).sort());
  });

  it("knows every client message variant the contract declares", () => {
    expect([...CLIENT_MESSAGE_TYPES].sort()).toEqual(Object.keys(contract.clientMessages).sort());
  });

  it("knows every server error code the contract declares", () => {
    expect([...SERVER_ERROR_CODES].sort()).toEqual([...contract.serverErrorCodes].sort());
  });
});

describe("protocol contract — canonical server samples parse", () => {
  for (const [variant, spec] of Object.entries(contract.serverMessages)) {
    it(`parses "${variant}"`, () => {
      const parsed = parseServerMessage(spec.sample) as ServerMessage;
      expect(parsed.type).toBe(variant);
      expect(parsed.version).toBe(PROTOCOL_VERSION);
      for (const field of spec.required) {
        expect(parsed, `"${variant}" lost required field "${field}"`).toHaveProperty(field);
      }
    });
  }

  it("rejects an unknown variant rather than passing it through", () => {
    expect(() => parseServerMessage({ type: "portalHop", version: PROTOCOL_VERSION })).toThrowError(ProtocolError);
  });

  it("rejects a future version with unsupportedVersion", () => {
    expect(() => parseServerMessage({ type: "hello", version: 2 })).toThrowError(/unsupported protocol version/);
  });

  it("parses the snapshot variant that used to be missing from this mirror", () => {
    const parsed = parseServerMessage(contract.serverMessages.snapshot.sample);
    expect(parsed.type).toBe("snapshot");
    if (parsed.type !== "snapshot") throw new Error("unreachable");
    expect(parsed.snapshot.tick).toBe(105);
    expect(parsed.snapshot.pilots).toHaveLength(1);
    expect(parsed.snapshot.pilots[0]).toMatchObject({ x: 128.25, distance: 64, finished: false });
  });
});

describe("protocol contract — canonical client samples encode", () => {
  for (const [variant, spec] of Object.entries(contract.clientMessages)) {
    it(`encodes "${variant}" and keeps every required field on the wire`, () => {
      const encoded = encodeClientMessage(spec.sample as unknown as ClientMessage);
      const decoded = JSON.parse(encoded) as Record<string, unknown>;
      expect(decoded.type).toBe(variant);
      for (const field of spec.required) {
        expect(decoded, `"${variant}" did not emit required field "${field}"`).toHaveProperty(field);
      }
      expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(MAX_JSON_PAYLOAD_BYTES);
    });
  }

  it("refuses to emit a name over the wire limit", () => {
    const sample = { ...contract.clientMessages.join.sample, name: "x".repeat(NAME_MAX + 1) };
    expect(() => encodeClientMessage(sample as unknown as ClientMessage)).toThrowError(ProtocolError);
  });

  it("refuses to emit a room code over the wire limit", () => {
    const sample = { ...contract.clientMessages.join.sample, roomCode: "ABCDEF" };
    expect(() => encodeClientMessage(sample as unknown as ClientMessage)).toThrowError(ProtocolError);
  });
});

describe("protocol contract — legacy simple protocol is pinned", () => {
  it("declares the frame vocabulary the browser client actually speaks", () => {
    expect(contract.legacy.up).toEqual(["state", "emote", "ready", "finish"]);
    expect(contract.legacy.down).toContain("state");
    expect(contract.legacy.capacity).toBe(40);
    expect(contract.legacy.tickHz).toBe(MOVEMENT_LIMITS.tickHz);
    expect(contract.legacy.stateFields).toEqual(["id", "x", "y", "rot", "distance"]);
  });
});
