/**
 * The render handle exists, and only in a development build.
 *
 * The open performance questions in this build — what the live
 * `coinMesh.count` actually reaches, whether a pass is fragment-bound — need
 * `renderer.info` and the scene graph from a running page. The app exposed no
 * renderer reference, so every such question cost a build. This pins the cheap
 * fix, and pins the half of it that matters more: that it cannot reach a
 * production bundle.
 *
 * "Behind `import.meta.env.DEV`" is only a claim about the source. Vite
 * substitutes the constant at build time and drops the branch, so the test
 * verifies the *enclosure* — that every `__render` assignment sits inside a
 * build-time-guarded block — rather than trusting a comment to say so. A
 * handle guarded by a runtime check would pass a grep and ship.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const GAME = join(process.cwd(), "src", "game", "Game.ts");
const game = readFileSync(GAME, "utf8");

/** The token that makes a branch vanish at build time. A runtime condition
 *  (`location.hostname`, a user-agent match) would keep the handle in
 *  production, so only compile-time constants count as a guard here. */
const BUILD_TIME_GUARD = "if (import.meta.env.DEV)";

/** Spans of `import.meta.env.DEV`-guarded blocks, by brace matching. */
function guardedSpans(): [number, number][] {
  const spans: [number, number][] = [];
  for (let at = game.indexOf(BUILD_TIME_GUARD); at !== -1; at = game.indexOf(BUILD_TIME_GUARD, at + 1)) {
    const open = game.indexOf("{", at + BUILD_TIME_GUARD.length);
    if (open === -1) continue;
    let depth = 0;
    for (let i = open; i < game.length; i++) {
      if (game[i] === "{") depth++;
      else if (game[i] === "}" && --depth === 0) {
        spans.push([at, i]);
        break;
      }
    }
  }
  return spans;
}

describe("a dev-only handle on the renderer", () => {
  it("finds the handle, so the assertions below are not vacuous", () => {
    expect(game.match(/__render\b/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("assigns it to window", () => {
    expect(game).toMatch(/window[^;\n]*\.__render\s*=/);
  });

  it("assigns the live renderer, so renderer.info is readable from the console", () => {
    // A snapshot of `info` would be frozen after one frame and useless; the
    // point is a live reference.
    const m = /__render\s*=\s*([^;]+);/.exec(game);
    expect(m?.[1]).toContain("this.renderer");
  });

  it("is assigned in exactly one place", () => {
    expect(game.match(/__render\s*=/g) ?? []).toHaveLength(1);
  });

  it("sits inside a block that import.meta.env.DEV guards", () => {
    const spans = guardedSpans();
    const at = game.indexOf("__render =");
    expect(at).toBeGreaterThan(-1);
    expect(spans.some(([from, to]) => at > from && at < to)).toBe(true);
  });

  it("is published after the renderer is configured, not before", () => {
    // The consumer is a console call in a running dev session, so the handle
    // has to be published once the renderer is finished — pixel ratio,
    // shadows and all — or a probe that reads it early sees a half-built one.
    const at = game.indexOf("__render =");
    expect(game.indexOf("setPixelRatio(this.dpr)")).toBeGreaterThan(-1);
    expect(game.indexOf("setPixelRatio(this.dpr)")).toBeLessThan(at);
    expect(game.indexOf("shadowMap.enabled")).toBeLessThan(at);
  });

  it("keeps the guard as a compile-time constant, not a runtime check", () => {
    const guards = [...game.matchAll(/if \(([^)]*)\)\s*\{/g)].map((m) => m[1]);
    const spans = guardedSpans();
    const at = game.indexOf("__render =");
    const span = spans.find(([from, to]) => at > from && at < to);
    expect(span).toBeDefined();
    // Nothing else can be the enclosing condition: the guarded block opens
    // immediately at the `if` that precedes the assignment.
    expect(span![0]).toBe(game.lastIndexOf("if (", at));
    expect(guards.filter((g) => g.includes("import.meta.env.DEV")).length).toBeGreaterThanOrEqual(1);
  });

  it("is not also written from the test-only or production-safe paths", () => {
    // One writer. A second handle under a different guard would be the shape
    // that reaches production.
    const others = readFileSync(GAME, "utf8").match(/__render\s*=\s*/g) ?? [];
    expect(others).toHaveLength(1);
  });
});

describe("the handle is not reachable from a production bundle", () => {
  it("is not named in any shipped HTML or CSS", () => {
    // Cheap stand-in for a bundle grep: the shipping shells are the only
    // non-source files a player loads, and nothing there may mention it.
    const shells = ["index.html", "portal.html"].map((f) => join(process.cwd(), f));
    for (const shell of shells) {
      let text: string;
      try {
        text = readFileSync(shell, "utf8");
      } catch {
        continue; // not present in this checkout
      }
      expect(text).not.toContain("__render");
    }
  });

  it("lives in a module that production builds tree-shake on the constant", () => {
    // `import.meta.env.DEV` is a build-time substitution, so a production
    // bundle replaces the condition with `false` and the block is removed
    // entirely. Asserting the constant is spelled that way (not read from an
    // env lookup) is what makes that guarantee real.
    expect(game).toContain(BUILD_TIME_GUARD);
    expect(game).not.toMatch(/import\.meta\.env\[[^\]]*\]\s*===\s*true/);
  });
});
