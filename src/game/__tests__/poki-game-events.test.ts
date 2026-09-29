/**
 * Poki Game Events contract (docs/poki/12-game-events.md, GM-03).
 *
 * The platform reserves two characters in `measure(category, what, action)`:
 * `/` separates event paths in its reporting UI and `^` separates the three
 * values in funnel keys. A stray slash therefore does not merely look odd in
 * the dashboard — it corrupts the event's identity, and the mistake is
 * invisible until someone reads a funnel and finds rows split in half.
 *
 * The check is source-level on purpose: `measure()` is called from a dozen
 * places in the game loop, and the only reliable way to keep every call site
 * clean is to read them all. It also pins the second half of the contract —
 * that a `visible` always has a matching `interact` for the same placement, so
 * the interaction funnel cannot silently lose its other half.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "__tests__") continue;
      sourceFiles(path, out);
    } else if (entry.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

/** Every `measure("cat", "what", "action")` literal call in the source tree. */
function measureCalls(): { file: string; line: number; values: string[] }[] {
  const calls: { file: string; line: number; values: string[] }[] = [];
  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8");
    const re = /measure\(\s*"([^"]*)"\s*,\s*([^,]+),\s*([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      calls.push({ file, line, values: [match[1]!, match[2]!.trim(), match[3]!.trim()] });
    }
  }
  return calls;
}

/**
 * The characters the LIVE loader will actually accept.
 *
 * The Game Events guide says only "do not use `/` or `^`", and this file used
 * to pin exactly that — so a value like `measure("run", "a,b", "start")` passed
 * CI while the SDK silently discarded the event. The loader enforces a positive
 * allowlist instead: it tests `/[^A-Za-z0-9_: .+|-]/` and rejects on a match.
 * Pin the loader's rule, not the summary in the docs.
 */
const DISALLOWED = /[^A-Za-z0-9_: .+|-]/;

describe("Poki game events", () => {
  it("keeps every measure() value inside the loader's allowlist", () => {
    const offenders = measureCalls().filter((call) =>
      call.values.some((value) => {
        // Only string literals can be judged statically; identifiers (a mode
        // id, a placement label) are checked at their own definition sites below.
        const literal = value.match(/^"([^"]*)"$/);
        return literal ? DISALLOWED.test(literal[1]!) : false;
      }),
    );
    expect(offenders.map((c) => `${c.file}:${c.line} ${c.values.join(" | ")}`)).toEqual([]);
  });

  it("keeps dynamic measure() values inside the allowlist at their source", () => {
    // Call sites pass two non-literal values: `this.modeId` (mode slugs from
    // ModeCatalog) and `continuePlacementLabel(kind)`. Both are checked where
    // they are defined, because that is where a stray character is introduced.
    const modes = readFileSync("src/game/Modes.ts", "utf8");
    const modeIds = [...modes.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(modeIds.length).toBeGreaterThan(0);
    for (const id of modeIds) {
      expect(id, `mode id "${id}" reaches measure() as a value`).not.toMatch(DISALLOWED);
    }
    const labels = readFileSync("src/game/ContinueOffer.ts", "utf8");
    const labelTemplate = labels.match(/continuePlacementLabel[\s\S]*?return `([^`]*)`/)?.[1] ?? "";
    expect(labelTemplate.length).toBeGreaterThan(0);
    // Strip `${...}` first: those characters are template syntax, substituted
    // away before the value ever reaches the SDK. What must be clean is the
    // literal text around them — and the interpolated kind, which is a
    // ContinueOffer union checked to be a lowercase slug.
    expect(labelTemplate.replace(/\$\{[^}]*\}/g, "")).not.toMatch(DISALLOWED);
    const kinds = [...readFileSync("src/game/ContinueOffer.ts", "utf8").matchAll(/kind:\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(kinds.length).toBeGreaterThan(0);
    for (const k of kinds) expect(k, `continue kind "${k}" is interpolated into measure()`).not.toMatch(DISALLOWED);
  });

  it("never puts a Poki-reserved character in a measure() value", () => {
    // GM-03. The portal reserves `/` and `^` — they are its own path and
    // pointer syntax, and the SDK parses the value as a three-part path, so a
    // `/` smuggled into a category or label silently splits the event into the
    // wrong bucket on Poki's side. The client cannot see that happen: the call
    // succeeds either way, and the loss only shows up in the portal dashboard
    // weeks later. Hence a source-level check on every value, literals and
    // dynamic ones alike.
    //
    // `DISALLOWED` above is stricter than this and would also fail on other
    // characters; this test is the narrower, named rule, so a failure points at
    // the reserved pair specifically.
    const RESERVED = /[\/^]/;
    const offenders: string[] = [];
    for (const call of measureCalls()) {
      for (const value of call.values) {
        const literal = value.match(/^"([^"]*)"$/);
        // Literals are judged directly. The two dynamic sources are checked at
        // their own definitions by the test above, for the same reason: a
        // reserved character enters a value where the value is built, not where
        // it is passed.
        if (literal && RESERVED.test(literal[1]!)) {
          offenders.push(`${call.file}:${call.line} reserved char in ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("pairs every rewarded placement with visible + interact", () => {
    const calls = measureCalls();
    const actions = new Set(calls.map((c) => c.values[2]));
    expect(actions.has('"visible"')).toBe(true);
    expect(actions.has('"interact"')).toBe(true);
    // The offer must be measured before it can be chosen: a visible without an
    // interact (or vice versa) would make exposure and engagement incomparable.
    const visibleCount = calls.filter((c) => c.values[2] === '"visible"').length;
    const interactCount = calls.filter((c) => c.values[2] === '"interact"').length;
    expect(visibleCount).toBeGreaterThanOrEqual(interactCount);
  });

  it("enables event tracking on the boot path", () => {
    const platform = readFileSync("src/sdk/platform.ts", "utf8");
    expect(platform).toContain("enableEventTracking");
    // …and only for the Poki target: no other portal's SDK is mentioned there.
    expect(platform).not.toContain("CrazySDK.enableEventTracking");
  });
});
