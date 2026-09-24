/**
 * Realtime transport factory — neutral / direct / CrazyGames edition.
 *
 * `vite.config.ts` swaps this module for `net-transport.poki.ts` on the Poki
 * target, exactly the way it swaps the edition strings and the portal
 * adapters: each bundle contains ONE transport decision, so `@poki/netlib`
 * (and Poki's wss:// signalling URL) can never leak into another portal's
 * bundle, and no competitor's transport name can appear in ours.
 *
 * The factory is async by contract. The Poki edition has to resolve its client
 * through a dynamic import to keep Netlib out of the boot path; the neutral
 * client is created synchronously inside this function, so callers deal with
 * one shape either way.
 */
import { RealtimeClient, type AnyRealtimeClient } from "./Realtime";

/**
 * Warm this edition's transport, if warming means anything here.
 *
 * The neutral editions build a client from an already-imported module, so
 * there is nothing to fetch: the hook exists so `Game` can warm Poki's Netlib
 * module through the same per-target module it creates the transport from,
 * instead of a second `import("./PokiNetlib")` in shared code.
 */
export function prewarmNetTransport(): void {}

export async function createNetTransport(
  deviceId: string,
  pilotName: string,
  skinId: string,
): Promise<AnyRealtimeClient> {
  return new RealtimeClient(deviceId, pilotName, skinId, 0.06);
}
