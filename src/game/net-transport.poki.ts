/**
 * Realtime transport factory — Poki edition: WebRTC P2P through Poki Netlib.
 *
 * Selected by `src/game/net-transport.ts`, the one dispatcher a race
 * transport comes from: when `POKI_BUILD` is set and the browser has WebRTC,
 * `createNetTransport()` awaits this module and returns the Netlib client.
 * (The dispatcher — not a vite alias, and not a module nothing imports — is
 * what guarantees the shipped Poki zip actually races over Netlib.)
 *
 * Every other edition talks to a WebSocket relay (`VITE_MULTIPLAYER_URL`). The
 * Poki build ships with that URL deliberately emptied, so it must use Poki's
 * own transport — Netlib — for live PvP. If this module is ever bypassed the
 * Poki build advertises live multiplayer (`isMultiplayerConfigured()` is true
 * there) while the WebSocket client answers every room with "No multiplayer
 * server configured" — the exact mismatch this arrangement exists to close.
 *
 * Netlib is loaded with a DYNAMIC import: the menu boots and stays interactive
 * without it, and the ~34 KB gz library (plus WebRTC signalling) is fetched
 * only when a race actually needs a transport.
 *
 * Degradation is explicit. `isPokiMultiplayerAvailable()` is false in local
 * dev without WebRTC, in an id-less preview build, and in browsers without
 * WebRTC; in those cases the WebSocket client is returned and behaves exactly
 * as before, so the game never ends up holding a client that can never
 * connect.
 */
import { RealtimeClient, type AnyRealtimeClient } from "./Realtime";
import { isPokiMultiplayerAvailable } from "../sdk/PokiMpUtils";

/** One in-flight import shared by the warm-up and the first real client. */
let netlib: Promise<typeof import("../sdk/PokiNetlib")> | null = null;

function loadNetlib(): Promise<typeof import("../sdk/PokiNetlib")> {
  const pending = (netlib ??= import("../sdk/PokiNetlib"));
  void pending.catch(() => { if (netlib === pending) netlib = null; });
  return pending;
}

/**
 * Fetch (and keep) the Netlib module ahead of the first race.
 *
 * `Game` calls this once on boot, on the Poki target only. A failed warm-up is
 * not fatal — the next `createNetTransport()` retries the import.
 */
export function prewarmNetTransport(): void {
  if (isPokiMultiplayerAvailable()) loadNetlib();
}

export async function createNetTransport(
  deviceId: string,
  pilotName: string,
  skinId: string,
): Promise<AnyRealtimeClient> {
  if (isPokiMultiplayerAvailable()) {
    const { PokiNetlibClient } = await loadNetlib();
    return new PokiNetlibClient(deviceId, pilotName, skinId, 0.06);
  }
  return new RealtimeClient(deviceId, pilotName, skinId, 0.06);
}
