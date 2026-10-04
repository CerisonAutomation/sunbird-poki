/**
 * Realtime transport factory — the ONE place a race transport is chosen.
 *
 * This fork is the Poki edition, so the live transport is Poki Netlib
 * (WebRTC P2P over `@poki/netlib`): `net-transport.poki.ts` builds it behind
 * a dynamic import so the signalling library stays out of the boot path.
 *
 * HOW THE POKI CLIENT IS SELECTED
 *
 * The first version of this file shipped a comment claiming "vite.config.ts
 * swaps this module for net-transport.poki.ts on the Poki target" — and no
 * such swap existed. Nothing imported `net-transport.poki.ts`; every build,
 * including the Poki zip, resolved `import … from "./net-transport"` to THIS
 * file and got the WebSocket client. The Poki zip ships with
 * `VITE_MULTIPLAYER_URL` deliberately emptied, so `RealtimeClient.connect()`
 * answered every race with "No multiplayer server configured" while
 * `isMultiplayerConfigured()` advertised live PvP — the menu offered rooms
 * that could never open. Three audits called the wiring "✅ verified" because
 * each checked `net-transport.poki.ts` in isolation (the file exists, it
 * matches a regex) and none checked that anything imports it.
 *
 * The fix is dispatch you can read in the source, not resolution magic:
 *
 *   • `POKI_BUILD` (compile-time, from `sdk/env`) and
 *     `isPokiMultiplayerAvailable()` (WebRTC + crypto feature detection) are
 *     both true → delegate to `net-transport.poki.ts`, which returns the
 *     Netlib client.
 *   • Anything else — a browser without WebRTC, or a hypothetical non-Poki
 *     target — gets the neutral WebSocket `RealtimeClient`, exactly as
 *     before. That fallback is what keeps NL-05 true: no WebRTC, still a
 *     playable (AI-flock) race.
 *
 * The dynamic import keeps the heavy module out of the boot path, and the
 * shared promise means prewarm and the first race await the same fetch.
 */
import { POKI_BUILD } from "../sdk/env";
import { isPokiMultiplayerAvailable } from "../sdk/PokiMpUtils";
import { RealtimeClient, type AnyRealtimeClient } from "./Realtime";

/** One in-flight import, shared by the warm-up and the first real client. */
let pokiFactory: Promise<typeof import("./net-transport.poki")> | null = null;

function loadPokiFactory(): Promise<typeof import("./net-transport.poki")> {
  const pending = (pokiFactory ??= import("./net-transport.poki"));
  // A failed fetch must not be cached: the next createNetTransport() retries.
  void pending.catch(() => {
    if (pokiFactory === pending) pokiFactory = null;
  });
  return pending;
}

/**
 * Warm this edition's transport, if warming means anything here.
 *
 * On the Poki target this starts the `net-transport.poki` import (which in
 * turn starts the Netlib module import) in the background, so the first
 * "race" tap does not pay the module-fetch cost. Everywhere else it is a
 * no-op: the neutral client is created synchronously from an
 * already-imported module.
 */
export function prewarmNetTransport(): void {
  if (POKI_BUILD && isPokiMultiplayerAvailable()) void loadPokiFactory();
}

export async function createNetTransport(
  deviceId: string,
  pilotName: string,
  skinId: string,
): Promise<AnyRealtimeClient> {
  if (POKI_BUILD && isPokiMultiplayerAvailable()) {
    const factory = await loadPokiFactory();
    return factory.createNetTransport(deviceId, pilotName, skinId);
  }
  return new RealtimeClient(deviceId, pilotName, skinId, 0.06);
}
