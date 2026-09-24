/**
 * The Poki build's game ids (rule `TOOL-09`, docs/poki/08-game-dev-tools.md).
 *
 * Two ids reach the Poki edition at build time, both baked into package.json's
 * `build:poki` script:
 *
 *   VITE_POKI_GAME_ID         — AUDS: boards, ghost shares, run share codes
 *   VITE_POKI_NETLIB_GAME_ID  — Netlib: P2P race/duel rooms
 *
 * A wrong id never throws. AUDS simply answers nothing and Netlib rooms never
 * meet, so the game looks healthy and quietly plays alone — which is why the
 * machine-checkable half of the rule is pinned here: presence, shape, agreement
 * between the two, and a single home. Only the dashboard diff (does this id
 * match the one Poki issued?) is left to a human.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isNetlibGameId } from "../PokiMpUtils";

const scripts = (
  JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

const BUILD_POKI = scripts["build:poki"] ?? "";

/** The id assigned to `NAME=` in a build script, or "" when it is not set. */
function idIn(script: string, name: string): string {
  return new RegExp(`${name}=(\\S+)`).exec(script)?.[1] ?? "";
}

const AUDS_ID = idIn(BUILD_POKI, "VITE_POKI_GAME_ID");
const NETLIB_ID = idIn(BUILD_POKI, "VITE_POKI_NETLIB_GAME_ID");

describe("poki build ids", () => {
  it("build:poki wires both ids, and both are canonical UUIDs", () => {
    expect(BUILD_POKI).toContain("VITE_PORTAL_TARGET=poki");
    expect(isNetlibGameId(AUDS_ID)).toBe(true);
    expect(isNetlibGameId(NETLIB_ID)).toBe(true);
    // Guards against a placeholder being shipped as if it were issued.
    expect(AUDS_ID).not.toBe("00000000-0000-0000-0000-000000000000");
  });

  it("AUDS and Netlib point at the same game", () => {
    // Two different ids would split the player: boards and share codes in one
    // game's store, races in another's signaling namespace. Both are the game id
    // Poki issues for this title, so they must be identical.
    expect(NETLIB_ID).toBe(AUDS_ID);
  });

  it("no other build script carries a Poki id", () => {
    const leaking = Object.entries(scripts)
      .filter(([name]) => name !== "build:poki")
      .filter(([, cmd]) => cmd.includes("VITE_POKI_GAME_ID=") || cmd.includes("VITE_POKI_NETLIB_GAME_ID="))
      .map(([name]) => name);
    expect(leaking).toEqual([]);
  });

  it("the live id has exactly one home — .env.example must not carry it", () => {
    // A second copy rots: the build keeps using package.json while a human reads
    // the stale value from .env.example and "confirms" the wrong id.
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(envExample).not.toContain(AUDS_ID);
    expect(envExample).toContain("package.json");
  });
});
