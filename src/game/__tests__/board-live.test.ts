// @vitest-environment node
/**
 * Live leaderboard check — the REAL client class, against the reference
 * server (`server/sunbird-server.mjs`), asserting the wire contract from
 * LEADERBOARD_API.md end to end:
 *
 *   POST /score   → run records stored, best-row-per-device kept
 *   GET  /board   → entries sorted best-first, rank + total present
 *
 * Launched by `pnpm board:check` (scripts/board-check.mjs) which boots the
 * reference server on a scratch port and passes the ABSOLUTE http:// URL via
 * VITE_LEADERBOARD_URL (the client reads it at import time). Without a URL
 * the suite SKIPS — a plain `pnpm test` is never a false failure.
 */
import { describe, expect, it } from "vitest";
import { Leaderboard } from "../Leaderboard";

const LIVE_URL = String(import.meta.env.VITE_LEADERBOARD_URL ?? "");
const LIVE = LIVE_URL.startsWith("http");

describe.skipIf(!LIVE)("live leaderboard (reference server)", () => {
  it(
    "submits real runs and reads back a sorted board with honest rank",
    async () => {
      const pilotA = `board-a-${Math.random().toString(36).slice(2, 8)}`;
      const pilotB = `board-b-${Math.random().toString(36).slice(2, 8)}`;
      const rowA = { deviceId: pilotA, name: "Board A", skin: "sunbird", distance: 5000, altitude: 120, perfects: 8, coins: 40, score: 6100, mode: "daytrip", seed: "live-a", durationMs: 333000 };
      const rowB = { deviceId: pilotB, name: "Board B", skin: "sunbird", distance: 8000, altitude: 200, perfects: 12, coins: 70, score: 9800, mode: "daytrip", seed: "live-b", durationMs: 533000 };

      const lbA = new Leaderboard(pilotA);
      const lbB = new Leaderboard(pilotB);
      try {
        lbA.submit(rowA);
        lbB.submit(rowB);
        // A re-submits a WORSE run: the server keeps the best row per device
        // (idempotent best-row semantics from the contract).
        lbA.submit({ ...rowA, distance: 3000, score: 3500 });
        // The POSTs are fire-and-forget with keepalive — poll until the board
        // reflects both pilots (bounded, so a dead server fails fast).
        let page: Awaited<ReturnType<Leaderboard["fetch"]>> | null = null;
        for (let attempt = 0; attempt < 20 && !page; attempt++) {
          await new Promise((r) => setTimeout(r, 150));
          const p = await lbA.fetch("global", "distance");
          const aRow = p.entries.find((e) => e.id === pilotA);
          const bRow = p.entries.find((e) => e.id === pilotB);
          if (p.online && aRow && bRow && aRow.distance === 5000) page = p;
        }
        expect(page, "board never reflected the submissions").not.toBeNull();
        const p = page!;
        // Sorted best-first by the requested metric.
        for (let i = 1; i < p.entries.length; i++) {
          expect(p.entries[i - 1]!.distance).toBeGreaterThanOrEqual(p.entries[i]!.distance);
        }
        // Best-row-keeps: A's worse re-submission did NOT regress the board.
        const aRow = p.entries.find((e) => e.id === pilotA)!;
        expect(aRow.distance).toBe(5000);
        // Honest rank/total from the server payload.
        expect(p.yourRank).toBeGreaterThan(0);
        expect(p.total).toBeGreaterThanOrEqual(2);
        // B outranked A (8000 > 5000).
        const bRow = p.entries.find((e) => e.id === pilotB)!;
        expect(bRow.distance).toBe(8000);
        expect(p.entries.findIndex((e) => e.id === pilotB)).toBeLessThan(p.entries.findIndex((e) => e.id === pilotA));
      } finally {
        lbA.dispose();
        lbB.dispose();
      }
    },
    20_000,
  );
});
