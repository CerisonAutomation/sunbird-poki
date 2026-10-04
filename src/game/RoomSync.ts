/**
 * The multiplayer hexagon's domain core.
 *
 * There are two multiplayer transports — `RealtimeClient` (WebSocket relay,
 * `src/game/Realtime.ts`) and `PokiNetlibClient` (WebRTC P2P,
 * `src/sdk/PokiNetlib.ts`) — and they implement the same `NetTransport`
 * surface so the gameplay loop never forks. What they were *also* doing is
 * carrying byte-identical copies of everything in this file: the `Keyframe`
 * and `Track` shapes, the 15 Hz / 120 ms cadence constants, and a 38-line
 * interpolation routine pasted into both `poll()` methods.
 *
 * Only the wire differs between the two — sockets and datachannels. The
 * vocabulary and the smoothing do not, so they live here, once, and both
 * adapters compose it. Everything in this module is pure: no clocks, no
 * sockets, no DOM. That is what makes it safe to share across the boundary.
 */

/** One received state sample for a remote pilot. */
export type Keyframe = { t: number; x: number; y: number; rot: number; vx?: number; vy?: number };

/** Everything known about one remote pilot, assembled from their frames. */
export type Track = {
  id: string;
  name: string;
  hue: number;
  skin: string;
  buffer: Keyframe[];
  distance: number;
  finished: boolean;
  finishTime: number;
  /** Finish place as agreed in this room (0 until one is assigned). */
  place: number;
  emote: string;
  emoteAt: number;
  ready: boolean;
    lastSeen: number;
  };
  
  /** A fresh track for a peer we have just heard from but know nothing about. */
  export function newTrack(id: string, now: number): Track {
    return {
      id,
      name: "Pilot",
      hue: Math.random(),
      skin: "sunbird",
      buffer: [],
      distance: 0,
      finished: false,
      finishTime: 0,
      place: 0,
      emote: "",
      emoteAt: -99,
      ready: false,
      lastSeen: now,
    };
  }
  
  export type PresenceState = "offline" | "connecting" | "lobby" | "racing" | "error";

export type RoomPeer = {
  id: string;
  name: string;
  hue: number;
  skin: string;
  distance: number;
  place: number;
  finished: boolean;
  finishTime: number;
  emote: string;
  emoteAt: number;
  ready: boolean;
  you: boolean;
};

/** A live multiplayer signal, surfaced as an in-flight toast by the game. */
export type PresenceEvent =
  | { type: "join"; name: string }
  | { type: "leave"; name: string }
  | { type: "ready"; name: string }
  | { type: "finish"; name: string; place: number }
  | { type: "start" }
  | { type: "welcome"; roomCode: string; seed: string }
  | { type: "interrupted"; message: string };

/** Outbound state rate. 15 Hz is plenty given client-side interpolation.
 *  Private: only the derived interval below is used outside this module. */
const SEND_HZ = 15;
export const SEND_DT = 1 / SEND_HZ;
/** Render remote pilots this far in the past. Note this is larger than one send
 *  interval, so at steady state peers advance by dead reckoning between packets
 *  rather than by lerping between them — which is why keyframes carry velocity. */
export const INTERP_DELAY = 0.12;
/** Drop a peer that has been silent this long (seconds). */
export const STALE_AFTER = 6;

/** A pilot's pose at a render instant, ready to hand to the renderer. */
export type SampledState = { x: number; y: number; rotation: number };

/**
 * Interpolate one pilot's keyframe buffer at `renderAt`, or `null` if they have
 * sent nothing yet.
 *
 * This is the routine that turns jittery 15 Hz network data into smooth 60 Hz
 * motion, and it is the reason remote birds glide instead of teleporting
 * between packets. Two cases:
 *
 *  • `renderAt` falls inside the buffer — lerp between the bracketing pair.
 *  • `renderAt` is past the newest sample — dead-reckon from stored velocity,
 *    capped at 200 ms ahead so a stalled remote bird does not fly off to
 *    infinity while its packets are still in flight.
 */
export function sampleTrack(buffer: readonly Keyframe[], renderAt: number): SampledState | null {
  if (buffer.length === 0) return null;

  let a = buffer[0]!;
  let c = buffer[buffer.length - 1]!;
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i]!.t <= renderAt && buffer[i + 1]!.t >= renderAt) {
      a = buffer[i]!;
      c = buffer[i + 1]!;
      break;
    }
  }

  if (renderAt > c.t) {
    const ahead = Math.min(0.2, renderAt - c.t);
    return {
      x: c.x + (c.vx ?? 0) * ahead,
      y: c.y + (c.vy ?? 0) * ahead,
      rotation: c.rot,
    };
  }
  const span = Math.max(1e-4, c.t - a.t);
  const u = Math.max(0, Math.min(1, (renderAt - a.t) / span));
  return {
    x: a.x + (c.x - a.x) * u,
    y: a.y + (c.y - a.y) * u,
    rotation: a.rot + (c.rot - a.rot) * u,
  };
}