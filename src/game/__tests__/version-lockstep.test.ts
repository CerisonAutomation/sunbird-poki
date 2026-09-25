/**
 * Version lockstep — every "version" in the repo, checked against its twin.
 *
 * Sunbird speaks several versions at once: a release semver, a build id, a save
 * schema, a realtime wire protocol and a replay format. They live in different
 * trees (`src/`, `vite.config.ts`, `package.json`) and the two test suites never
 * import each other, so a bump on one side used to be invisible until
 * production:
 *
 *   • the realtime gateway **rejects** any frame whose `version` it does not
 *     recognise (`unsupportedVersion`), so a client-only protocol bump breaks
 *     every room at once;
 *   • `SUNBIRD_CLIENT_BUILD` pins leaderboard writes to one build id, so a pin
 *     set against a non-deterministic id rejects everything.
 *
 * `docs/VERSIONS.md` is the human-readable inventory and bump rules; this file
 * is the part that fails the build.
 *
 * CONSOLIDATION NOTE: this file used to cross-check a `server/` tree
 * (`server/src/realtime/gateways.ts`, `server/src/ghosts/GhostService.ts`,
 * `server/src/config.ts`) and three per-portal edition modules
 * (`edition.poki.ts`, `edition.crazy.ts`, `edition.generic.ts`). Sunbird is now
 * a Poki-only, serverless build: Poki's Netlib carries multiplayer and AUDS
 * carries leaderboards, so that tree and those modules were deleted. The
 * assertions that depended on them were silently dead (they threw ENOENT, or
 * failed to resolve the import) and are replaced below by checks against the
 * code that actually ships.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as edition from "../edition";
import { SAVE_KEY, SAVE_KEY_V1 } from "../constants";
import { PROTOCOL_MIN_VERSION, PROTOCOL_VERSION } from "../protocol/v1";
import { APP_VERSION, BUILD_ID, GIT_SHA, REPLAY_VERSION, SAVE_SCHEMA, buildStamp } from "../version";

/** Read a repo file (vitest runs from the workspace root). */
function repo(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("realtime wire protocol", () => {
  it("keeps the protocol module versioned in its path (protocol/v1)", () => {
    expect(repo("src", "game", "protocol", "v1.ts")).toMatch(
      /export const PROTOCOL_VERSION = \d+;/,
    );
  });

  it("pins one protocol version, with the floor equal to it", () => {
    // The Poki transport (Netlib) carries these frames peer-to-peer; there is
    // no server-side negotiation any more, so a range would only mean peers
    // silently disagreeing. Both numbers stay locked together.
    expect(PROTOCOL_MIN_VERSION).toBe(PROTOCOL_VERSION);
  });
});

describe("replay format", () => {
  it("stays a positive integer so ghost stores can reject a stale one", () => {
    expect(REPLAY_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(REPLAY_VERSION)).toBe(true);
  });
});

describe("save schema", () => {
  it("derives the generation from the storage key, not a second literal", () => {
    expect(SAVE_KEY).toMatch(/\.v\d+$/);
    expect(SAVE_SCHEMA).toBe(Number(/\.v(\d+)$/.exec(SAVE_KEY)?.[1]));
    expect(SAVE_SCHEMA).toBe(2);
  });

  it("keeps the previous generation addressable for migration", () => {
    expect(SAVE_KEY_V1).toBe(SAVE_KEY.replace(/\.v\d+$/, `.v${SAVE_SCHEMA - 1}`));
  });
});

describe("build identity: deterministic, declared, and actually used", () => {
  it("is derived from the semver, the portal target and the commit", () => {
    const config = repo("vite.config.ts");

    // The portal is a literal in a single-portal repo (`poki`), so this pins
    // the SHAPE that matters: derived from semver + target + commit, never
    // from a clock.
    expect(config).toMatch(
      /const BUILD_ID = `\$\{APP_VERSION\}-(?:\$\{PORTAL\}|poki)-\$\{GIT_SHA\}`;/,
    );
    expect(config).toMatch(/const APP_VERSION = \(JSON\.parse\(readFileSync\(path\.resolve\(__dirname, "package\.json"\)/);
    // The old value was `Date.now().toString(36)`: a "version" that changed on
    // every rebuild of the same commit, which made zips non-reproducible and the
    // leaderboard's build attribution meaningless. Never again.
    expect(config).not.toMatch(/BUILD_ID = Date\.now\(\)/);
  });

  it("injects all three values and types them, so no consumer casts", () => {
    const config = repo("vite.config.ts");
    const types = repo("src", "vite-env.d.ts");

    for (const key of ["VITE_BUILD_ID", "VITE_APP_VERSION", "VITE_GIT_SHA"]) {
      expect(config, `${key} define`).toContain(`"import.meta.env.${key}": JSON.stringify(`);
      expect(types, `${key} declaration`).toContain(`readonly ${key}?: string;`);
    }
  });

  it("reports a well-formed id even when the defines are absent (tests, dev SSR)", () => {
    // package.json is the semver source of truth; vite injects it at build time.
    expect(repo("package.json")).toMatch(/"version": "\d+\.\d+\.\d+"/);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(GIT_SHA.length).toBeGreaterThan(1);
    expect(BUILD_ID).toBe(`${APP_VERSION}-${BUILD_ID.split("-")[1]}-${GIT_SHA}`);
    expect(buildStamp()).toContain(APP_VERSION);
  });

  it("stamps the build once per boot, with console.debug (verify:prod allows it)", () => {
    expect(repo("src", "game", "Game.ts")).toContain("console.debug(buildStamp())");
  });

  it("attributes every leaderboard row to the build that set it", () => {
    // AUDS always carried a `build` field and the client never filled it, so
    // every row read `build: ""` — no way to tell an old-format score from a new
    // one after a physics or scoring change.
    expect(repo("src", "game", "Leaderboard.ts")).toContain("build: BUILD_ID");
  });
});

describe("edition module", () => {
  it("exports the whole policy surface from the single shipped edition", () => {
    // One edition ships. A flag that is expected but missing is how a build
    // silently reverts to a default, so the surface is pinned in full.
    expect(Object.keys(edition).sort()).toEqual(
      [
        "CUSTOM_PILOT_NAMES",
        "LEADERBOARD_CLOUD_LABEL",
        "POKI_EDITION",
        "POKI_MULTIPLAYER",
        "PORTAL_DISPLAY_NAME",
        "PORTAL_EDITION_NOTE",
        "RESERVED_PILOT_NAMES",
        "SELL_AD_REMOVAL",
        "SIMULATED_BREAKS",
        "SQUAD_CHAT",
      ].sort(),
    );
  });

  it("keeps exactly one edition module in src/game", () => {
    // `edition.poki.ts` / `edition.crazy.ts` / `edition.generic.ts` were the
    // multi-portal variants. Their return would mean a portal split is being
    // reintroduced without the vite aliases that isolate each bundle.
    const files = readdirSync(join(process.cwd(), "src", "game")).filter((f) =>
      /^edition\..+\.ts$/.test(f),
    );
    // Only `legal.edition.ts` may look similar — it is the privacy copy, not a
    // portal edition, and its filename starts with `legal.`.
    expect(files).toEqual([]);
  });
});

describe("HTTP namespaces: one derivation, documented drift", () => {
  it("reads VITE_LEADERBOARD_URL in exactly one module", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(rel);
          continue;
        }
        if (!entry.name.endsWith(".ts")) continue;
        if (rel.endsWith("game/apiBase.ts") || rel.endsWith("vite-env.d.ts")) continue;
        const text = repo(rel);
        // Comments are fine; a second live read of the env var is not.
        if (
          text
            .split("\n")
            .some((line) => line.includes("VITE_LEADERBOARD_URL") && !line.trim().startsWith("*") && !line.trim().startsWith("//"))
        ) {
          offenders.push(rel);
        }
      }
    };
    walk("src");

    expect(offenders).toEqual([]);
  });

  it("keeps the client's endpoint list in the audit doc", () => {
    const doc = repo("docs", "VERSIONS.md");

    // The shipped client still speaks the root (`/board`, `/score`) and legacy
    // `/mp` namespaces. Migrating is a project, so the doc carries it — and this
    // fails if the doc stops naming the routes the client actually calls.
    for (const route of ["/board", "/score"]) {
      expect(doc, `VERSIONS.md mentions ${route}`).toContain(route);
    }
  });
});
