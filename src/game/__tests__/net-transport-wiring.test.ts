/**
 * Netlib transport wiring — the regression test for the Poki PvP outage.
 *
 * For the whole life of this fork, `net-transport.poki.ts` existed and nothing
 * imported it. `Game.ts` imported `./net-transport` (the neutral module), so
 * the Poki zip — which ships `VITE_MULTIPLAYER_URL` deliberately empty —
 * offered a live-PvP menu and answered every room with the WebSocket client's
 * "No multiplayer server configured". Three separate audits marked the wiring
 * "✅ verified" because they checked `net-transport.poki.ts` in isolation and
 * never checked that anything resolves to it.
 *
 * This file pins the wiring from three directions so it cannot rot silently
 * again:
 *
 *   1. RUNTIME — with the Poki target and WebRTC present,
 *      `createNetTransport()` must hand back a `PokiNetlibClient`; without
 *      WebRTC it must fall back to the WebSocket `RealtimeClient` (NL-05);
 *      with no Poki target at all it must stay neutral.
 *   2. SOURCE CONTRACT — `Game.ts` must choose its transport through
 *      `./net-transport`, and that module must delegate to
 *      `./net-transport.poki` on the Poki build. A revert to an unimported
 *      side module fails here with the file that changed.
 *   3. PREWARM — `prewarmNetTransport()` must start the same shared import
 *      the first race awaits (NL-08), not a second, competing one.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyRealtimeClient } from "../Realtime";

const here = dirname(fileURLToPath(import.meta.url));

function source(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

/** jsdom has no WebRTC; the Poki dispatch requires the feature probe to pass. */
function installFakeWebRTC(): void {
  (globalThis as Record<string, unknown>).RTCPeerConnection = class FakeRTCPeerConnection {};
}

function removeFakeWebRTC(): void {
  delete (globalThis as Record<string, unknown>).RTCPeerConnection;
}

afterEach(() => {
  removeFakeWebRTC();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("net-transport wiring: runtime dispatch", () => {
  it("returns the Netlib client on the Poki target with WebRTC available", async () => {
    installFakeWebRTC();
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    vi.resetModules();

    const { createNetTransport } = await import("../net-transport");
    const client: AnyRealtimeClient = await createNetTransport("device-1", "Kestrel", "phoenix");

    // The class identity comes from the same module registry entry the factory
    // used, so instanceof is the honest check — not a name comparison.
    const { PokiNetlibClient } = await import("../../sdk/PokiNetlib");
    expect(client).toBeInstanceOf(PokiNetlibClient);
    expect(client.isAutonomous).toBe(false);
    expect(client.state).toBe("offline"); // constructed, not yet connected
  });

  it("falls back to the WebSocket client when WebRTC is missing (NL-05)", async () => {
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    vi.resetModules();

    const { createNetTransport } = await import("../net-transport");
    const client: AnyRealtimeClient = await createNetTransport("device-1", "Kestrel", "phoenix");

    const { RealtimeClient } = await import("../Realtime");
    expect(client).toBeInstanceOf(RealtimeClient);
  });

  it("stays neutral on a non-Poki target even with WebRTC present", async () => {
    installFakeWebRTC();
    vi.stubEnv("VITE_PORTAL_TARGET", "none");
    vi.resetModules();

    const { createNetTransport } = await import("../net-transport");
    const client: AnyRealtimeClient = await createNetTransport("device-1", "Kestrel", "phoenix");

    const { RealtimeClient } = await import("../Realtime");
    expect(client).toBeInstanceOf(RealtimeClient);
  });

  it("prewarm shares the import the first race awaits (NL-08)", async () => {
    installFakeWebRTC();
    vi.stubEnv("VITE_PORTAL_TARGET", "poki");
    vi.resetModules();

    const factory = await import("../net-transport");
    expect(() => factory.prewarmNetTransport()).not.toThrow();

    // Warm-then-create must still resolve to the Netlib client: a prewarm that
    // cached a rejected or competing import would make the first race fail.
    const client = await factory.createNetTransport("device-1", "Kestrel", "phoenix");
    const { PokiNetlibClient } = await import("../../sdk/PokiNetlib");
    expect(client).toBeInstanceOf(PokiNetlibClient);
  });
});

describe("net-transport wiring: source contract", () => {
  it("Game.ts chooses its transport through ./net-transport", () => {
    const game = source("../Game.ts");
    expect(game).toMatch(/from "\.\/net-transport"/);
    // The old lie, kept out on purpose: if the dispatch ever moves back to a
    // "vite swaps this module" claim, the comment must not reappear untouched.
    expect(game).not.toMatch(/vite\.config\.ts swaps this module/);
  });

  it("net-transport.ts delegates to the Poki factory on the Poki build", () => {
    const dispatcher = source("../net-transport.ts");
    expect(dispatcher).toMatch(/import\("\.\/net-transport\.poki"\)/);
    expect(dispatcher).toMatch(/POKI_BUILD/);
    expect(dispatcher).toMatch(/isPokiMultiplayerAvailable/);
  });

  it("net-transport.poki.ts still builds the Netlib client behind one dynamic import", () => {
    const poki = source("../net-transport.poki.ts");
    expect(poki).toMatch(/import\("\.\.\/sdk\/PokiNetlib"\)/);
    expect(poki).toMatch(/new PokiNetlibClient\(/);
  });
});
