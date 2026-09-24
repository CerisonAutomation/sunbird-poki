/**
 * SUNBIRD protocol v1 TypeScript models and parsers.
 *
 * This file mirrors `rust/crates/sunbird-protocol/src/lib.rs`. It is used as
 * the Phase 1 capability gate only: authoritative rooms are not enabled until
 * Phase 3, so unknown variants and unversioned traffic are rejected strictly.
 */

export const PROTOCOL_VERSION = 1;
export const PROTOCOL_MIN_VERSION = 1;
export const MAX_JSON_PAYLOAD_BYTES = 8 * 1024;
export const ROOM_CODE_MAX = 5;
export const NAME_MAX = 14;
export const SEED_MAX = 64;
export const SKIN_MAX = 32;
export const IDEMPOTENCY_MAX = 80;
export const ERROR_MESSAGE_MAX = 256;
export const TOKEN_MIN = 16;
export const TOKEN_MAX = 512;

export type PilotPublic = {
  joinedAt?: string;
  id: string;
  name: string;
  skin: string;
  ready: boolean;
  reconnecting: boolean;
};

export type RoomPublic = {
  id: string;
  code: string;
  seed: string;
  capacity: number;
  hostSeatId: string;
  pilots: PilotPublic[];
};

export type SeatGrant = {
  roomId: string;
  seatId: string;
  playerId: string;
  generation: number;
  reconnectToken: string;
};

export type SnapshotPilot = {
  seatId: string;
  x: number;
  y: number;
  rotation: number;
  distance: number;
  finished: boolean;
};

export type ServerSnapshot = {
  serverTime: string;
  tick: number;
  pilots: SnapshotPilot[];
};

export type ProtocolLimits = {
  version: number;
  maxJsonPayloadBytes: number;
  maxNameChars: number;
};

export type ServerError =
  | { code: "unsupportedVersion"; version: number; minSupported: number }
  | { code: "invalidMessage"; reason: string }
  | { code: "payloadTooLarge"; maxBytes: number }
  | { code: "rateLimited"; retryAfterMs: number }
  | { code: "roomFull" }
  | { code: "roomNotFound" }
  | { code: "seatNotFound" }
  | { code: "invalidReconnectToken" }
  | { code: "rejected"; message: string };

export type ClientMessage =
  | {
      type: "join";
      version: number;
      intentId: string;
      roomCode: string;
      seed: string;
      name: string;
      skin: string;
      reconnectToken?: string | null;
    }
  | { type: "leave"; version: number; roomId: string; seatId: string }
  | { type: "ready"; version: number; roomId: string; seatId: string; ready: boolean }
  | { type: "heartbeat"; version: number; roomId: string; seatId: string; sequence: number; clientTime: string }
  | { type: "reconnect"; version: number; roomId: string; seatId: string; reconnectToken: string };

export type ServerMessage =
  | { type: "hello"; version: number; serverName: string; limits: ProtocolLimits }
  | { type: "welcome"; version: number; grant: SeatGrant; room: RoomPublic }
  | { type: "rosterUpdate"; version: number; room: RoomPublic }
  | { type: "started"; version: number; roomId: string; startAt: string; seed: string }
  | { type: "snapshot"; version: number; snapshot: ServerSnapshot }
  | { type: "error"; version: number; error: ServerError };

/**
 * Runtime variant tables. TypeScript types are erased at runtime, so without
 * these arrays there is nothing to compare against `protocol/contract.json` —
 * which is exactly how the Rust `ServerMessage::Snapshot` variant went missing
 * from this file unnoticed. `protocol-contract.test.ts` asserts these match the
 * contract, so a variant added on one side and not the other fails CI.
 */
export const CLIENT_MESSAGE_TYPES = ["join", "leave", "ready", "heartbeat", "reconnect"] as const;
export const SERVER_MESSAGE_TYPES = [
  "hello",
  "welcome",
  "rosterUpdate",
  "started",
  "snapshot",
  "error",
] as const;
export const SERVER_ERROR_CODES = [
  "unsupportedVersion",
  "invalidMessage",
  "payloadTooLarge",
  "rateLimited",
  "roomFull",
  "roomNotFound",
  "seatNotFound",
  "invalidReconnectToken",
  "rejected",
] as const;

/**
 * Server-authoritative movement envelope. The Rust room server rejects `state`
 * frames outside these bounds; the client mirrors them so a rejected frame is
 * diagnosable instead of looking like packet loss. Values are mirrored from
 * `protocol/contract.json` and pinned by `protocol-contract.test.ts`.
 *
 * Ceiling derivation: MAX_SPEED_FEVER (128) × wingboost speedMult (1.5)
 * + BOOST_EXTRA_SPEED (42) = 234 units/sec (`Bird.ts` / `PowerUps.ts`),
 * divided by the 15 Hz send rate and doubled for headroom.
 */
export const MOVEMENT_LIMITS = {
  tickHz: 15,
  maxSpeedUnitsPerSec: 234,
  speedHeadroomFactor: 2,
  /** Floor on the elapsed-time estimate so a fast sender is not over-penalised. */
  minSampleIntervalSec: 0.0167,
  /** Ceiling on it so a long reconnect gap cannot authorise an unlimited jump. */
  maxSampleIntervalSec: 2,
  maxStateDeltaXPerTick: 31,
  maxStateDeltaYPerTick: 31,
  maxCoordinateAbs: 1_000_000,
  maxAltitudeAbs: 100_000,
  maxRotationAbs: 12.5664,
  maxDistance: 500_000,
  distanceRegressionTolerance: 0.5,
  positionDecimalPlaces: 2,
  rotationDecimalPlaces: 2,
} as const;

export class ProtocolError extends Error {
  constructor(
    message: string,
    readonly code: "unsupportedVersion" | "payloadTooLarge" | "invalidMessage" = "invalidMessage",
  ) {
    super(`protocol/${code}: ${message}`);
    this.name = "ProtocolError";
  }
}

function typedError(data: unknown): ServerError {
  if (!isRecord(data) || !isRecordish(data.code)) {
    return { code: "invalidMessage", reason: "server error payload is malformed" };
  }
  const code = data.code;
  if (code === "unsupportedVersion" && isNumber(data.version) && isNumber(data.minSupported)) {
    return { code, version: data.version, minSupported: data.minSupported };
  }
  if (code === "invalidMessage" && isString(data.reason)) return { code, reason: data.reason };
  if (code === "payloadTooLarge" && isNumber(data.maxBytes)) return { code, maxBytes: data.maxBytes };
  if (code === "rateLimited" && isNumber(data.retryAfterMs)) return { code, retryAfterMs: data.retryAfterMs };
  if (["roomFull", "roomNotFound", "seatNotFound", "invalidReconnectToken"].includes(code)) return { code: code as ServerError["code"] } as ServerError;
  if (code === "rejected" && isString(data.message)) return { code, message: data.message };
  return { code: "invalidMessage", reason: "server error variant is unrecognized" };
}

// ts-prune-ignore-next -- phase-2 wire codec, consumed when authoritative rooms land
export function encodeClientMessage(message: ClientMessage): string {
  assertVersion(message.version);
  if (message.type === "join") {
    assertText(message.roomCode, ROOM_CODE_MAX, "roomCode");
    assertText(message.seed, SEED_MAX, "seed");
    assertText(message.name, NAME_MAX, "name");
    assertText(message.skin, SKIN_MAX, "skin");
    if (message.reconnectToken) assertText(message.reconnectToken, TOKEN_MAX, "reconnectToken");
  }
  if (message.type === "reconnect") assertText(message.reconnectToken, TOKEN_MAX, "reconnectToken");
  const encoded = JSON.stringify(message);
  requireBytesAtOrBelow(byteLength(encoded), MAX_JSON_PAYLOAD_BYTES);
  return encoded;
}

// ts-prune-ignore-next -- phase-2 wire codec, consumed when authoritative rooms land
export function parseServerJsonFrame(frame: string | Uint8Array): ServerMessage {
  const text = typeof frame === "string" ? frame : new TextDecoder().decode(frame);
  requireBytesAtOrBelow(byteLength(text), MAX_JSON_PAYLOAD_BYTES);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProtocolError("frame is not valid JSON", "invalidMessage");
  }
  return parseServerMessage(data);
}

export function parseServerMessage(data: unknown): ServerMessage {
  if (!isRecord(data)) throw new ProtocolError("message is not an object", "invalidMessage");
  const version = requireVersion(data.version);
  if (version !== PROTOCOL_VERSION) throw new ProtocolError(`unsupported protocol version ${version}`, "unsupportedVersion");
  const type = data.type;
  if (type === "hello") {
    return {
      type,
      version,
      serverName: requireString(data.serverName, "serverName"),
      limits: {
        version: requireNumber((data.limits as Record<string, unknown> | undefined)?.version, "limits.version"),
        maxJsonPayloadBytes: requireNumber((data.limits as Record<string, unknown> | undefined)?.maxJsonPayloadBytes, "limits.maxJsonPayloadBytes"),
        maxNameChars: requireNumber((data.limits as Record<string, unknown> | undefined)?.maxNameChars, "limits.maxNameChars"),
      },
    };
  }
  if (type === "welcome") {
    return { type, version, grant: parseSeatGrant(data.grant), room: parseRoom(data.room) };
  }
  if (type === "rosterUpdate") {
    return { type, version, room: parseRoom(data.room) };
  }
  if (type === "started") {
    return {
      type,
      version,
      roomId: requireString(data.roomId, "roomId"),
      startAt: requireString(data.startAt, "startAt"),
      seed: assertText(requireString(data.seed, "seed"), SEED_MAX, "seed"),
    };
  }
  if (type === "snapshot") {
    return { type, version, snapshot: parseSnapshot(data.snapshot) };
  }
  if (type === "error") {
    return { type, version, error: typedError(data.error) };
  }
  throw new ProtocolError(`unknown server message type ${String(type)}`, "invalidMessage");
}

function parseRoom(data: unknown): RoomPublic {
  if (!isRecord(data)) throw new ProtocolError("room is not an object", "invalidMessage");
  return {
    id: requireString(data.id, "room.id"),
    code: assertText(requireString(data.code, "room.code"), ROOM_CODE_MAX, "room.code"),
    seed: assertText(requireString(data.seed, "room.seed"), SEED_MAX, "room.seed"),
    capacity: requireNumber(data.capacity, "room.capacity"),
    hostSeatId: requireString(data.hostSeatId, "room.hostSeatId"),
    pilots: Array.isArray(data.pilots) ? data.pilots.map((pilot) => parsePilot(pilot)) : [],
  };
}

function parsePilot(data: unknown): PilotPublic {
  if (!isRecord(data)) throw new ProtocolError("pilot is not an object", "invalidMessage");
  return {
    id: requireString(data.id, "pilot.id"),
    name: assertText(requireString(data.name, "pilot.name"), NAME_MAX, "pilot.name"),
    skin: isString(data.skin) ? assertText(data.skin, SKIN_MAX, "pilot.skin") : "",
    ready: Boolean(data.ready),
    reconnecting: Boolean(data.reconnecting),
    joinedAt: isString(data.joinedAt) ? data.joinedAt : undefined,
  };
}

function parseSeatGrant(data: unknown): SeatGrant {
  if (!isRecord(data)) throw new ProtocolError("seat grant is not an object", "invalidMessage");
  return {
    roomId: requireString(data.roomId, "grant.roomId"),
    seatId: requireString(data.seatId, "grant.seatId"),
    playerId: requireString(data.playerId, "grant.playerId"),
    generation: requireNumber(data.generation, "grant.generation"),
    reconnectToken: assertText(requireString(data.reconnectToken, "grant.reconnectToken"), TOKEN_MAX, "grant.reconnectToken"),
  };
}

function parseSnapshot(data: unknown): ServerSnapshot {
  if (!isRecord(data)) throw new ProtocolError("snapshot is not an object", "invalidMessage");
  return {
    serverTime: requireString(data.serverTime, "snapshot.serverTime"),
    tick: requireNumber(data.tick, "snapshot.tick"),
    pilots: Array.isArray(data.pilots) ? data.pilots.map((pilot) => parseSnapshotPilot(pilot)) : [],
  };
}

function parseSnapshotPilot(data: unknown): SnapshotPilot {
  if (!isRecord(data)) throw new ProtocolError("snapshot pilot is not an object", "invalidMessage");
  return {
    seatId: requireString(data.seatId, "pilot.seatId"),
    x: requireNumber(data.x, "pilot.x"),
    y: requireNumber(data.y, "pilot.y"),
    rotation: requireNumber(data.rotation, "pilot.rotation"),
    distance: requireNumber(data.distance, "pilot.distance"),
    finished: Boolean(data.finished),
  };
}

function assertVersion(version: unknown): void {
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolError(`client cannot emit protocol version ${String(version)}`, "unsupportedVersion");
  }
}

function requireVersion(value: unknown): number {
  return requireNumber(value, "version");
}

function byteLength(text: string): number {
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : text.length;
}

function requireBytesAtOrBelow(bytes: number, limit: number): void {
  if (bytes > limit) {
    throw new ProtocolError(`JSON payload is ${bytes} bytes; limit is ${limit}`, "payloadTooLarge");
  }
}

function assertText(value: string, limit: number, field: string): string {
  if (Array.from(value).length > limit) {
    throw new ProtocolError(`${field} exceeds ${limit} characters`, "invalidMessage");
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (!isString(value)) throw new ProtocolError(`${field} is required as a string`, "invalidMessage");
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (!isNumber(value)) throw new ProtocolError(`${field} is required as a number`, "invalidMessage");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecordish(value: unknown): value is string {
  return isString(value);
}
