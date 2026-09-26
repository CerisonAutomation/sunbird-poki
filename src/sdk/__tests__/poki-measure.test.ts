/**
 * `measure()` — proof that events REACH the SDK, not merely that they parse.
 *
 * The bug this suite exists for: `poki.ts` `measure()` gated its action on a
 * hand-rolled `^(start|complete|fail|clear|win|lose|finish)$` allowlist while
 * the tested guard for exactly that job, `sanitizeMeasure`, sat uncalled next to
 * it. Ten of the sixteen live `.measure(` call sites in `Game.ts` were thrown
 * away there — every `visible` and `interact` placement event, plus `reached`
 * and `granted` — so the Poki dashboard's interaction and reward signal was
 * absent in production. `poki-canon.test.ts` was green throughout, because it
 * pinned the pure function nobody called. **A test that a pure function is
 * correct cannot see whether the thing that drops events calls it.**
 *
 * So these assertions are deliberately written at the *boundary*, not on the
 * pure function: they install a recording SDK and check what actually arrives.
 * A pure-function test would have stayed green through the entire outage.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PokiAdapter } from "../poki";

afterEach(() => {
  delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
});

/** A recording SDK: `calls` is what the Poki dashboard would have received. */
function recording() {
  const calls: string[] = [];
  (window as unknown as { PokiSDK?: unknown }).PokiSDK = {
    measure: (c: string, w: string, a: string) => calls.push(`${c}|${w}|${a}`),
    happyTime: () => {},
  };
  return { calls, adapter: new PokiAdapter({}) };
}

describe("measure() reaches the SDK", () => {
  // The two the outage actually cost us: one `visible` and one `interact`.
  it("delivers a `visible` placement event", () => {
    const { calls, adapter } = recording();
    adapter.measure("button", "portal-leaderboard", "visible");
    expect(calls).toEqual(["button|portal-leaderboard|visible"]);
  });

  it("delivers an `interact` placement event", () => {
    const { calls, adapter } = recording();
    adapter.measure("cosmetic", "skin-grid", "interact");
    expect(calls).toEqual(["cosmetic|skin-grid|interact"]);
  });

  it("delivers the actions that were dropped alongside them", () => {
    const { calls, adapter } = recording();
    adapter.measure("player", "funnel-first_flight", "reached");
    adapter.measure("reward", "results-coin-multiplier", "granted");
    expect(calls).toEqual([
      "player|funnel-first_flight|reached",
      "reward|results-coin-multiplier|granted",
    ]);
  });

  it("keeps dropping what the SDK itself would discard", () => {
    // The guard must not have been loosened in the fixing. These four are the
    // exact cases `sanitizeMeasure` exists to reject, and each was a real
    // accidental-send risk: `/` and `^` are reserved by the loader.
    const { calls, adapter } = recording();
    adapter.measure("round", "day/trip", "complete"); // reserved `/`
    adapter.measure("round", "daytrip", "com^plete"); // reserved `^`
    adapter.measure("quest", "2026-38", "clear-1"); // three numerics
    adapter.measure("", "daytrip", "start"); // no category
    expect(calls).toEqual([]);
  });

  it("trims before forwarding, so a padded call site still lands", () => {
    const { calls, adapter } = recording();
    adapter.measure("  button ", " portal-leaderboard ", " visible ");
    expect(calls).toEqual(["button|portal-leaderboard|visible"]);
  });

  it("never throws when the SDK has no measure()", () => {
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = {};
    const adapter = new PokiAdapter({});
    expect(() => adapter.measure("button", "portal-leaderboard", "visible")).not.toThrow();
  });
});

/* ------------------------------------------------------------------ the sweep */

const root = resolve(__dirname, "../../..");

/**
 * Blank out comments, preserving every newline so reported line numbers stay
 * true. String literals are left intact — this sweep has to *read* them, since
 * the literal action is exactly what it is enumerating.
 *
 * This is not decoration. The first run of this suite flagged `poki.ts:619` as
 * an unmapped call site, because the comment documenting the very bug being
 * fixed contains the characters `.measure(`. A scanner that reads prose as code
 * is the failure mode the audit that produced this card warned about, where a
 * symbol named in its own doc comment looked used and hid eight real defects.
 */
function stripComments(src: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      // Copy the literal verbatim, honouring escapes, so a `//` inside a URL
      // does not start a comment and silently truncate an argument.
      const quote = c;
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** The `.measure(...)` call sites in the shipping source, with their arguments. */
function liveCallSites(): { file: string; line: number; args: string[] }[] {
  const found: { file: string; line: number; args: string[] }[] = [];
  for (const file of walk(join(root, "src"))) {
    if (file.includes(`${join("__tests__")}`)) continue;
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((text, i) => {
      let from = 0;
      for (;;) {
        const at = text.indexOf(".measure(", from);
        if (at < 0) break;
        from = at + 1;
        // Walk the balanced argument list, tracking nesting so a call like
        // `measure("button", f(x), "visible")` is not split at the inner comma.
        const args: string[] = [];
        let depth = 0;
        let cur = "";
        for (let j = at + ".measure(".length; j < text.length; j++) {
          const ch = text[j]!;
          if ("([{".includes(ch)) depth++;
          else if (")]}".includes(ch)) {
            if (depth === 0) break;
            depth--;
          }
          if (ch === "," && depth === 0) {
            args.push(cur.trim());
            cur = "";
          } else cur += ch;
        }
        args.push(cur.trim());
        found.push({ file: file.slice(root.length + 1), line: i + 1, args });
      }
    });
  }
  return found;
}

const literal = (arg: string | undefined): string | null =>
  arg !== undefined && arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : null;

/**
 * Actions that are not literals at the call site. Each entry is the *domain* of
 * the value, so the sweep can evaluate the call rather than skip it — a scanner
 * that quietly skips the interesting cases is a scanner that will pass while the
 * bug is live.
 */
const DYNAMIC_ACTION_DOMAINS: Record<string, string[]> = {
  // `Game.ts`: `private runOutcome: "complete" | "fail" = "fail"`.
  "this.runOutcome": ["complete", "fail"],
};

/**
 * Stand-ins for non-literal category/what arguments, chosen from the real
 * domains at the call sites so the replay is representative:
 * `this.modeId` is a `ModeId` (`"distance"`, `"daytrip"`, …),
 * `continuePlacementLabel()` returns `` `continue-ad-${kind}` `` and
 * `id ?? "skin"` is a skin catalogue id. None carries a digit run, so any of
 * them is safe against the two-numerics rule.
 */
const DYNAMIC_CATEGORY_PROBES = ["run", "button", "player", "cosmetic", "event", "mastery", "achievement", "reward"];
const DYNAMIC_WHAT_PROBES = ["daytrip", "continue-ad-near-best", "funnel-first_flight", "skin", "portal-leaderboard"];

describe("every live measure() call site survives the guard", () => {
  const sites = liveCallSites();

  it("finds the call sites at all (scanner sanity, not a tautology)", () => {
    // Nova's lesson, verbatim: a probe whose matcher silently matches nothing
    // reports a clean bill of health. If the pattern or the source shape ever
    // changes, this fails instead of the sweep below passing vacuously.
    expect(sites.length).toBeGreaterThanOrEqual(12);
    const files = new Set(sites.map((s) => s.file));
    expect(files.has("src/game/Game.ts")).toBe(true);
  });

  it("sends no action the guard would discard", () => {
    // Boundary, not pure-function: each call site is replayed through the REAL
    // adapter and asserted to arrive. An earlier version of this test called
    // `sanitizeMeasure` directly and therefore stayed green through the entire
    // outage — it could only catch a bad *argument*, never a guard that drops
    // good ones. That distinction is the entire reason this file exists.
    const offenders: string[] = [];
    for (const { file, line, args } of sites) {
      const [c, w, a] = args;
      const actions = literal(a) !== null ? [literal(a)!] : DYNAMIC_ACTION_DOMAINS[a ?? ""] ?? [];
      if (!actions.length) {
        // An unrecognised dynamic action: fail loudly rather than skip it.
        offenders.push(`${file}:${line} — unmapped action argument ${JSON.stringify(a)}`);
        continue;
      }
      for (const action of actions) {
        const category = literal(c) ?? DYNAMIC_CATEGORY_PROBES[0]!;
        const what = literal(w) ?? DYNAMIC_WHAT_PROBES[0]!;
        const { calls, adapter } = recording();
        adapter.measure(category, what, action);
        if (calls.length !== 1) {
          offenders.push(`${file}:${line} — ${category}|${what}|${action} never reached the SDK`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the `visible`/`interact` pairs the dashboard is measured on", () => {
    const actions = sites.flatMap((s) => [literal(s.args[2])].filter((a): a is string => a !== null));
    // These two are the ad-placement and interaction signal. If a future guard
    // change ever drops them again, this is the assertion that says so out loud
    // rather than leaving it to a dashboard someone has to notice is empty.
    for (const required of ["visible", "interact", "start", "complete"]) {
      expect(actions).toContain(required);
    }
  });
});
