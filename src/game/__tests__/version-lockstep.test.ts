/**
 * Version lockstep — every "version" in the repo, checked against its twin.
 *
 * Sunbird speaks several versions at once: a release semver, a build id, a save
 * schema, a realtime wire protocol, a replay format, an HTTP namespace and four
 * edition variants. They live in different trees (`src/`, `server/src/`,
 * `vite.config.ts`, `package.json`) and the two test suites never import each
 * other, so a bump on one side used to be invisible until production:
 *
 *   • the realtime gateway **rejects** any frame whose `version` it does not
 *     recognise (`unsupportedVersion`), so a client-only protocol bump breaks
 *     every room at once;
 *   • the ghost store **410s** any replay whose `v` is not the current one, so a
 *     server-only bump silently expires every rival ghost;
 *   • `SUNBIRD_CLIENT_BUILD` pins leaderboard writes to one build id, so a pin
 *     set against a non-deterministic id rejects everything.
 *
 * `docs/VERSIONS.md` is the human-readable inventory and bump rules; this file
 * is the part that fails the build.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SAVE_KEY, SAVE_KEY_V1 } from "../constants";
import * as crazyEdition from "../edition.crazy";
import * as genericEdition from "../edition.generic";
import * as pokiEdition from "../edition.poki";
import * as directEdition from "../edition";
import { PROTOCOL_MIN_VERSION, PROTOCOL_VERSION } from "../protocol/v1";
import { APP_VERSION, BUILD_ID, GIT_SHA, REPLAY_VERSION, SAVE_SCHEMA, buildStamp } from "../version";

/** Read a repo file (vitest runs from the workspace root). */
function repo(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

/** The first capture group of `pattern` in `text`, or null. */
function capture(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1] ?? null;
}

describe("realtime wire protocol: client and server must agree", () => {
  it("pins the same number on both sides of the socket", () => {
    const gateway = repo("server", "src", "realtime", "gateways.ts");
    const server = Number(capture(gateway, /const PROTO_VERSION = (\d+);/));

    expect(server).toBe(PROTOCOL_VERSION);
    // The gateway's check is strict equality (`version !== PROTO_VERSION` →
    // unsupportedVersion), so the client's floor has to be the same number too.
    // Introducing a supported *range* means changing that check, this test and
    // docs/VERSIONS.md together.
    expect(PROTOCOL_MIN_VERSION).toBe(PROTOCOL_VERSION);
  });

  it("keeps the protocol module versioned in its path (protocol/v1)", () => {
    expect(repo("src", "game", "protocol", "v1.ts")).toMatch(
      /export const PROTOCOL_VERSION = \d+;/,
    );
  });
});

describe("replay format: the number the ghost store 410s on", () => {
  it("matches what the server stamps and what it requires", () => {
    const ghosts = repo("server", "src", "ghosts", "GhostService.ts");
    const stamped = Number(capture(ghosts, /JSON\.stringify\(\{ v: (\d+),/));
    const required = Number(capture(ghosts, /parsed\.v !== (\d+)/));

    expect(stamped).toBe(REPLAY_VERSION);
    expect(required).toBe(REPLAY_VERSION);
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

    expect(config).toMatch(
      /const BUILD_ID = `\$\{APP_VERSION\}-\$\{PORTAL\}-\$\{GIT_SHA\}`;/,
    );
    expect(config).toMatch(/const APP_VERSION = \(JSON\.parse\(readFileSync\(path\.resolve\(__dirname, "package\.json"\)/);
    // The old value was `Date.now().toString(36)`: a "version" that changed on
    // every rebuild of the same commit, which made zips non-reproducible and the
    // server's client-build pin impossible to satisfy. Never again.
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

  it("documents the server-side pin against that same id", () => {
    const config = repo("server", "src", "config.ts");
    const trust = repo("server", "src", "anticheat", "trust.ts");

    // Permissive by default; pinning is opt-in via SUNBIRD_CLIENT_BUILD and now
    // actually satisfiable because BUILD_ID is deterministic.
    expect(config).toMatch(/clientBuildId: env\("SUNBIRD_CLIENT_BUILD", "unpinned"\)/);
    expect(trust).toContain('this.cfg.clientBuildId === "unpinned"');
    expect(repo("docs", "VERSIONS.md")).toContain("SUNBIRD_CLIENT_BUILD");
  });
});

describe("edition variants stay in lockstep", () => {
  const editions = {
    direct: directEdition,
    poki: pokiEdition,
    crazy: crazyEdition,
    generic: genericEdition,
  } as const;

  it("exports the same policy surface from every edition", () => {
    const names = (m: Record<string, unknown>): string[] => Object.keys(m).sort();
    const reference = names(editions.direct);

    expect(reference).toContain("SIMULATED_BREAKS");
    expect(reference).toContain("SELL_AD_REMOVAL");
    for (const [portal, edition] of Object.entries(editions)) {
      // A flag added to one edition and not the others is how a portal build
      // ends up shipping direct-build behaviour (or vice versa).
      expect(names(edition as Record<string, unknown>), `${portal} edition exports`).toEqual(reference);
    }
  });

  it("keeps one edition module per portal target the build accepts", () => {
    const config = repo("vite.config.ts");
    const valid = /const VALID_PORTALS = \[([^\]]+)\]/.exec(config)?.[1] ?? "";
    const targets = valid
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter((s) => s && s !== "none");

    // crazygames is an alias of crazy; every other target needs its own file.
    const files = readdirSync(join(process.cwd(), "src", "game")).filter((f) => /^edition\..+\.ts$/.test(f));
    for (const target of targets) {
      const name = target === "crazygames" ? "crazy" : target;
      expect(files, `edition module for ${target}`).toContain(`edition.${name}.ts`);
    }
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

  it("keeps the client's endpoint list in the audit doc (V-5 migration debt)", () => {
    const doc = repo("docs", "VERSIONS.md");

    // The shipped client still speaks the root (`/board`, `/score`) and legacy
    // `/mp` (`/ghost`, `/entitlements`) namespaces; `/mp/v1` needs session auth.
    // Migrating is a project, so the doc carries it — and this fails if the doc
    // stops naming the routes the client actually calls.
    for (const route of ["/board", "/score", "/mp/ghost", "/mp/v1"]) {
      expect(doc, `VERSIONS.md mentions ${route}`).toContain(route);
    }
  });
});
