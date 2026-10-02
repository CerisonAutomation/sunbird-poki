/**
 * The Poki SDK surface is canonical, or it does not build.
 *
 * The adapter used to declare its own `PokiSdk` type by hand. A hand-written
 * type cannot distinguish "canonical" from "plausible", and five invented
 * members got in — `signalGameReady`, `happytime`, `mute`/`isMuted`,
 * `hasAdBlock`/`setAdBlockActive`, `sendUserEvent`. Each was called through an
 * optional chain, so each was a **silent no-op in production**: no celebration
 * ever reached Poki, the ad-block probe always read false, the portal mute
 * preference never arrived. Two of those names are canonical on CrazyGames
 * (`game.happytime()`, `game.signalGameReady()`), which is how they crossed
 * adapters unnoticed.
 *
 * These tests close that class of bug from both ends:
 *
 *  - the type is now mapped from Poki's published typings (`@poki/sdk`), so an
 *    invented member is a compile error; and
 *  - this suite re-reads those typings at run time and asserts that every
 *    member the adapter and the boot path actually touch is canonical, that the
 *    registry of runtime-only members matches what is wired, and that Poki's
 *    published `measure()` vocabulary has not drifted from ours.
 *
 * Provenance for the canonical surface lives in `src/sdk/poki-canon.ts`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PokiAdapter, markPokiBooted } from "../poki";
import {
  MEASURE_CATEGORIES,
  MEASURE_INTERACTION_ACTIONS,
  MEASURE_PROGRESS_ACTIONS,
  POKI_SDK_ACCESS_CONFINE,
  POKI_SDK_NON_CANONICAL,
  POKI_SDK_RUNTIME_ONLY,
  clampHappyIntensity,
  measureViaPoki,
  sanitizeMeasure,
  pokiAuthToken,
  clearPokiAuthToken,
} from "../poki-canon";

afterEach(() => {
  delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
});

// This file pins WHICH canonical member each adapter method reaches, not when
// it is allowed to reach it — so it runs against a booted SDK, the same
// convention `poki-breaks.test.ts` uses. The boot-order refusals are a
// deliberately separate file (`poki-boot-order.test.ts`), because that flag
// only ever moves one way and cannot be undone between cases here.
markPokiBooted();

const root = resolve(__dirname, "../../..");
const read = (p: string): string => readFileSync(resolve(root, p), "utf8");

/** Poki's published typings — the contract integrators are given. */
const TYPINGS = "node_modules/@poki/sdk/dist/index.d.ts";

function typings(): string {
  expect(existsSync(resolve(root, TYPINGS)), `${TYPINGS} missing — run pnpm install`).toBe(true);
  return read(TYPINGS);
}

/** Every method on `declare const PokiSDK` in the published typings. */
function officialMethods(): string[] {
  const dts = typings();
  const block = dts.slice(dts.indexOf("declare const PokiSDK"));
  expect(block.length).toBeGreaterThan(0);
  return [...block.matchAll(/^\s{4}([A-Za-z]\w*)\s*[(:]/gm)].map((m) => m[1]);
}

/** The string members of a published union type (e.g. MeasureCategory). */
function publishedUnion(name: string): string[] {
  const line = typings().match(new RegExp(`type ${name} = ([^;]+);`))?.[1] ?? "";
  return [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const RUNTIME_ONLY = POKI_SDK_RUNTIME_ONLY.map((m) => m.name as string);
const CANONICAL = new Set([...officialMethods(), ...RUNTIME_ONLY]);

/**
 * Remove comments and string literals, leaving only code.
 *
 * The guard scans source for `sdk.x` / `getPoki().x`. Without this, a URL in a
 * comment is indistinguishable from a call — and two were, which is why this
 * suite failed before it was fixed:
 *
 *   • `sdk.poki.com/html5` (a doc link in the adapter's header) matched the
 *     member `poki`;
 *   • `https://game-cdn.poki.com/.../poki-sdk.js` (the CDN path) matched the
 *     member `js`, because `-` is a word boundary.
 *
 * A guard that cries wolf is a guard that gets ignored, which is exactly how
 * real drift slips past. This is a character scanner rather than a stack of
 * regexes because the three constructs nest: a string can hold `/*`, a comment
 * can hold a quote, and `//` appears inside every URL.
 */
function stripNonCode(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "*") {
      const close = src.indexOf("*/", i + 2);
      i = close === -1 ? src.length : close + 2;
      out += " ";
      continue;
    }
    if (c === "/" && next === "/") {
      const eol = src.indexOf("\n", i);
      i = eol === -1 ? src.length : eol;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i += 1; // skip the escaped character
        i += 1;
      }
      i += 1;
      out += '""';
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Every `PokiSDK` member the code actually touches, per file. The patterns are
 * the two access routes that exist: `this.sdk?.x()` inside the adapter and
 * `getPoki()?.x()` on the boot path. Comments and strings are stripped first so
 * that prose about the SDK is never mistaken for a call into it.
 */
function referencedMembers(file: string, accessor: RegExp): string[] {
  return [...new Set([...stripNonCode(read(file)).matchAll(accessor)].map((m) => m[1]))].sort();
}

const ADAPTER_ACCESS = /\bsdk\s*\??\.([A-Za-z_$][\w$]*)/g;
const BOOT_ACCESS = /getPoki\(\)\s*\??\.([A-Za-z_$][\w$]*)/g;

/** A recording SDK double that also proves which members were reached for. */
function recording(extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const sdk: Record<string, unknown> = {
    measure: (c: string, w: string, a: string) => calls.push(`measure:${c}|${w}|${a}`),
    happyTime: (v: number) => calls.push(`happyTime:${v}`),
    getLanguage: () => "pt-BR",
    isAdBlocked: () => true,
    ...extra,
  };
  (window as unknown as { PokiSDK?: unknown }).PokiSDK = sdk;
  const adapter = new PokiAdapter({});
  return { calls, adapter, sdk };
}

describe("Poki SDK canonical surface", () => {
  it("touches no SDK member Poki does not publish", () => {
    const used = [
      ...referencedMembers("src/sdk/poki.ts", ADAPTER_ACCESS),
      ...referencedMembers("src/sdk/platform.ts", BOOT_ACCESS),
    ];
    // Sanity: the extraction is really finding calls, not returning nothing.
    expect(used.length).toBeGreaterThan(15);
    const invented = used.filter((name) => !CANONICAL.has(name));
    expect(
      invented,
      `non-canonical PokiSDK members referenced: ${invented.join(", ")} — see src/sdk/poki-canon.ts`,
    ).toEqual([]);
  });

  it("keeps every invented member out of the Poki code path", () => {
    // Stripped, so a name mentioned in prose (this file's own comments name
    // them all) is not mistaken for a call.
    const poki = stripNonCode(read("src/sdk/poki.ts"));
    const boot = stripNonCode(read("src/sdk/platform.ts"));
    const offenders: string[] = [];
    for (const name of POKI_SDK_NON_CANONICAL) {
      // Only SDK-object accesses count: `isMuted()` is a legitimate *interface*
      // method (CrazyGames exposes a real mute preference), and so is
      // `onPortalMute` as an event name. What must not exist is
      // `sdk.isMuted?.()` — a call into a member Poki never shipped.
      const pattern = new RegExp(`\\b(?:sdk|getPoki\\(\\))\\s*\\??\\.${name}\\b`);
      if (pattern.test(poki) || pattern.test(boot)) offenders.push(name);
    }
    expect(offenders, `invented members called on the Poki SDK: ${offenders.join(", ")}`).toEqual([]);
  });

  it("keeps the runtime-only registry in sync with what is wired", () => {
    const poki = stripNonCode(read("src/sdk/poki.ts"));
    const boot = stripNonCode(read("src/sdk/platform.ts"));
    for (const entry of POKI_SDK_RUNTIME_ONLY) {
      const called = new RegExp(`\\b(?:sdk|getPoki\\(\\))\\s*\\??\\.${entry.name}\\b`).test(poki + boot);
      expect(called, `${entry.name}: registry says wired=${entry.wired} but the code disagrees`).toBe(entry.wired);
      expect(entry.why.length, `${entry.name}: record why it is or is not wired`).toBeGreaterThan(10);
    }
  });

  it("records what each runtime-only member actually DOES in the shipped core", () => {
    // The registry used to be filled from Poki's name lists, which made three
    // members look wired when the shipped core defines them as `()=>{}` or
    // `()=>!1`. Names being real says nothing about behaviour, so every entry
    // now carries the body transcribed out of
    // poki-sdk-core-0df3a52d1f37602f598b9432c7bae77681d8e3ea.js.
    //
    // This cannot re-fetch that file (it is a CDN artifact, not vendored), so
    // the assertion is that every entry *carries a body* and that the stub
    // classification agrees with that body. When the CDN build hash moves,
    // re-download it and re-transcribe — a changed body is a real behaviour
    // change, not a comment to refresh.
    for (const entry of POKI_SDK_RUNTIME_ONLY) {
      expect(entry.impl.length, `${entry.name}: record the shipped core's body`).toBeGreaterThan(4);
      const claimsStub = /stub|hardcoded/.test(entry.impl);
      const body = entry.impl.split(" — ")[0].trim();
      // A stub must be one of the empty-arrow shapes the core actually uses.
      if (claimsStub) {
        expect(
          /^\(\)=>(\{\}|!1)/.test(body),
          `${entry.name}: impl says stub but body is ${body}`,
        ).toBe(true);
      } else {
        expect(
          !/^\(\)=>(\{\}|!1)$/.test(body),
          `${entry.name}: body ${body} IS a stub — impl must say so`,
        ).toBe(true);
      }
    }
  });

  it("does not claim a stubbed member works", () => {
    // The three members that are called AND are stubs in the shipped build.
    const calledButStubbed = POKI_SDK_RUNTIME_ONLY.filter(
      (e) => e.wired && /stub|hardcoded/.test(e.impl),
    ).map((e) => e.name);
    // `happyTime` and `isAdBlocked` are called and are stubs; their `why` must
    // say so plainly rather than describing behaviour that never happens.
    for (const name of calledButStubbed) {
      const entry = POKI_SDK_RUNTIME_ONLY.find((e) => e.name === name)!;
      expect(
        /\bNEVER\b|\bnever\b|hardcoded|empty function/.test(entry.why),
        `${name} is a stub in the shipped core but its "why" reads as if it works`,
      ).toBe(true);
    }
    expect(calledButStubbed.sort()).toEqual(["gameLoadingStart", "happyTime", "isAdBlocked"]);
  });

  it("declares the runtime-only members as members of the canonical type", () => {
    // Compile-time proof would be the mapped type alone; this asserts the
    // registry did not silently grow a name the type does not carry.
    const canon = read("src/sdk/poki-canon.ts");
    for (const entry of POKI_SDK_RUNTIME_ONLY) {
      expect(canon, `${entry.name} missing from PokiSdkRuntime`).toMatch(new RegExp(`\\b${entry.name}\\?:`));
    }
  });

  it("uses Poki's published measure() vocabulary, verbatim", () => {
    expect([...MEASURE_CATEGORIES]).toEqual(publishedUnion("MeasureCategory"));
    expect([...MEASURE_PROGRESS_ACTIONS, ...MEASURE_INTERACTION_ACTIONS]).toEqual(publishedUnion("MeasureAction"));
  });

  it("publishes the leaderboard handshake the official typings define", () => {
    // `init({ submitScore })` is canonical (InitOptions in the published
    // typings) — it is how a score reaches a Poki leaderboard, and there is no
    // `setScore`. Pinned here so a future "cleanup" does not delete the only
    // working submission path.
    expect(typings()).toMatch(/submitScore\?: \(fn: \(leaderboard: string, score: number\) => void\) => void/);
    expect(read("src/sdk/poki.ts")).toMatch(/submitScore/);
  });
});

/**
 * The canonical surface is only worth anything while `pokiSdk()` is the sole
 * door to `window.PokiSDK`. The suite above checks WHICH members the adapter
 * and the boot path call — and it could only ever check those two files,
 * because those were the only two that had a regex for them.
 *
 * `src/game/Telemetry.ts` imported `pokiSdk` and called `sdk.measure(...)`
 * itself, so it was a third route into the SDK in a file no regex here looked
 * at. An invented member used there would have compiled clean and then no-opped
 * in production: the exact failure `poki-canon.ts` was written to prevent, in
 * the one place the guard could not see.
 *
 * So the guard is widened from "these two files are canonical" to "nothing
 * outside `src/sdk/` may reach the global at all" — which is a property of the
 * tree, not of a file list, and therefore cannot go stale when a file moves.
 */
describe("SDK access is confined to src/sdk/", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (entry === "node_modules") continue;
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  /** Every shipped source file outside the adapter directory. */
  function filesOutsideSdk(): { path: string; code: string }[] {
    return walk(resolve(root, "src"))
      .filter((f) => !f.startsWith(resolve(root, "src/sdk")))
      // A suite has to be able to stub the global to prove anything about it.
      .filter((f) => !f.includes("__tests__"))
      .map((f) => ({ path: relative(root, f), code: stripNonCode(readFileSync(f, "utf8")) }));
  }

  it("has files to check — the walk is not silently empty", () => {
    // A guard that finds nothing to scan passes forever. The count is the
    // floor the tree is expected to stay above.
    expect(filesOutsideSdk().length).toBeGreaterThan(50);
  });

  it("is not imported from outside src/sdk/", () => {
    const offenders: string[] = [];
    for (const { path, code } of filesOutsideSdk()) {
      for (const symbol of POKI_SDK_ACCESS_CONFINE) {
        // An import clause, or any other reference to the symbol itself.
        const used = new RegExp(`\\b${symbol}\\b`).test(code);
        if (used) offenders.push(`${path} — imports/calls ${symbol}()`);
      }
    }
    expect(
      offenders,
      `only src/sdk/ may reach the Poki SDK global. Offenders:\n  ${offenders.join("\n  ")}\n` +
        "Call a function in src/sdk/ instead — see measureViaPoki().",
    ).toEqual([]);
  });

  it("is not reached through a hand-rolled window cast", () => {
    // The other half of the same escape: even without importing `pokiSdk`, a
    // module can declare its own surface with
    // `(window as unknown as { PokiSDK?: … })`. That is precisely the cast
    // `poki-canon.ts` exists to make unnecessary — and it throws away the
    // canonical type, which is the whole guarantee.
    const offenders = filesOutsideSdk()
      .filter(({ code }) => /PokiSDK\s*\??\s*:/.test(code))
      .map(({ path }) => path);
    expect(
      offenders,
      `these modules declare their own PokiSDK shape instead of using src/sdk/poki-canon: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("routes measurement through one shared function that reports delivery", () => {
    // Both callers exist, and both must go through the same door.
    expect(read("src/sdk/poki.ts")).toMatch(/measureViaPoki\(category, label, action\)/);
    expect(read("src/game/Telemetry.ts")).toMatch(/measureViaPoki\(/);

    // Delivery is a fact about the call, not about having called.
    expect(measureViaPoki("round", "daytrip", "start")).toBe(false); // no SDK present
    const calls: string[] = [];
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = {
      measure: (c: string, w: string, a: string) => calls.push(`${c}|${w}|${a}`),
    };
    expect(measureViaPoki("round", "daytrip", "start")).toBe(true);
    // Rejected by the loader's own rules → not delivered, and not called.
    expect(measureViaPoki("quest", "2026-38", "clear-1")).toBe(false);
    expect(calls).toEqual(["round|daytrip|start"]);
  });
});

describe("measure() argument rules (the live SDK's own validation)", () => {
  it("requires category and what", () => {
    expect(sanitizeMeasure("", "daytrip", "start")).toBeNull();
    expect(sanitizeMeasure("round", "", "start")).toBeNull();
    expect(sanitizeMeasure("  ", "  ", "start")).toBeNull();
    // action may be empty — the SDK defaults it.
    expect(sanitizeMeasure("round", "daytrip", "")).toEqual({ category: "round", what: "daytrip", action: "" });
  });

  it("enforces the loader's character allowlist, not just `/` and `^`", () => {
    // The loader tests `/[^A-Za-z0-9_: .+|-]/` and rejects on a match. `/` and
    // `^` are rejected only because they fall outside that set — there is no
    // "reserved character" rule. Banning just those two let the rest through to
    // events the SDK discards without logging anything we can see.
    expect(sanitizeMeasure("round", "day/trip", "start")).toBeNull();
    expect(sanitizeMeasure("round", "daytrip", "com^plete")).toBeNull();
    expect(sanitizeMeasure("ro/und", "daytrip", "start")).toBeNull();

    // Every character the allowlist grants must survive.
    for (const ch of "Az09_:.+|- ") {
      expect(sanitizeMeasure("round", `day${ch}trip`, "start")).not.toBeNull();
    }

    // ...and every character outside it must be caught, so a future caller
    // cannot quietly build an event the SDK will throw away. Space is absent
    // here on purpose: the allowlist grants it.
    for (const ch of [",", "!", "?", '"', "'", "(", ")", "[", "]", "#", "%", "&", "*", "<", ">", "=", "~", ";", "@", "$", "\\", "`", "é", "日", "\n", "\t"]) {
      expect(sanitizeMeasure("round", `day${ch}trip`, "start")).toBeNull();
    }
  });

  it("allows at most two numeric values across all three arguments", () => {
    expect(sanitizeMeasure("round", "daytrip", "complete")).not.toBeNull();
    expect(sanitizeMeasure("level", "1", "complete")).not.toBeNull();
    expect(sanitizeMeasure("level", "1-2", "complete")).not.toBeNull();
    expect(sanitizeMeasure("level", "1-2", "complete-3")).toBeNull();
    expect(sanitizeMeasure("quest", "2026-38", "clear-1")).toBeNull();
    // The loader also counts a literal `{n}` placeholder as a numeric value —
    // but that branch is unreachable, because `{` and `}` are outside the
    // character allowlist, so any string containing one is rejected a rule
    // earlier. Simulating the loader's own validator confirms both `{n}` cases
    // below are REJECTED, not "one placeholder, under budget".
    expect(sanitizeMeasure("level", "{n}", "run-{n}-{n}")).toBeNull();
    expect(sanitizeMeasure("level", "{n}", "run-{n}-x")).toBeNull();
  });

  it("trims what it forwards", () => {
    expect(sanitizeMeasure("  round ", " daytrip", "start  ")).toEqual({
      category: "round",
      what: "daytrip",
      action: "start",
    });
  });

  it("never forwards an event the SDK would discard", () => {
    const { calls, adapter } = recording();
    adapter.measure("round", "daytrip", "complete");
    adapter.measure("quest", "2026-38", "clear-1"); // three numerics → dropped
    adapter.measure("round", "day/trip", "complete"); // outside the allowlist → dropped
    adapter.measure("", "daytrip", "start"); // no category → dropped
    expect(calls).toEqual(["measure:round|daytrip|complete"]);
  });

  it("agrees with the loader's own validator on every case we can construct", () => {
    // A literal transcription of the minified validator inside the CDN
    // loader's `measure`, kept independent of `sanitizeMeasure` on purpose:
    // if the two ever disagree, one of them has drifted from Poki.
    const loaderAccepts = (category: string, what: string, action: string) => {
      const c = `${category ?? ""}`.trim();
      const w = `${what ?? ""}`.trim();
      const a = `${action ?? ""}`.trim();
      if (c === "" || w === "") return false;
      if ([c, w, a].some((x) => /[^A-Za-z0-9_: .+|-]/.test(x))) return false;
      const numerics = [c, w, a].join(" ").split(/\d+|\{n\}/i).length - 1;
      return !(numerics > 2);
    };

    const categories = ["round", "level", "pvp_sprint", "run", "skip-level", "", "  ", "a b", "x/y", "x^y", "1", "2026-38"];
    const whats = ["daytrip", "coin multiplier", "run-{n}", "a.b", "a+b", "a|b", "a-b", "é", "", "1", "1-2-3", "day/trip"];
    const actions = ["start", "complete", "fail", "visible", "interact", "reached", "granted", "", "x y", "x,y", "x;y", "1-2-3"];

    let compared = 0;
    for (const c of categories) {
      for (const w of whats) {
        for (const a of actions) {
          const ours = sanitizeMeasure(c, w, a) !== null;
          const theirs = loaderAccepts(c, w, a);
          expect(
            ours,
            `disagreement on ${JSON.stringify([c, w, a])}: ours=${ours} loader=${theirs}`,
          ).toBe(theirs);
          compared++;
        }
      }
    }
    expect(compared).toBe(categories.length * whats.length * actions.length);
  });
});

describe("canonical member behaviour", () => {
  it("clamps happyTime intensity into Poki's documented 0…1", () => {
    expect(clampHappyIntensity(0.42)).toBeCloseTo(0.42);
    expect(clampHappyIntensity(7)).toBe(1);
    expect(clampHappyIntensity(-7)).toBe(0);
    expect(clampHappyIntensity(Number.NaN)).toBe(0);
    const { calls, adapter } = recording();
    adapter.happyTime(0.85);
    expect(calls).toEqual(["happyTime:0.85"]);
  });

  it("probes ad-block through isAdBlocked(), the only member Poki ships", () => {
    const sync = recording({ isAdBlocked: () => true });
    expect(sync.adapter.hasAdBlock()).toBe(true);

    const promise = recording({ isAdBlocked: () => Promise.resolve(true) });
    expect(promise.adapter.hasAdBlock()).toBe(false); // resolves later, never throws
  });

  it("reads the portal language from getLanguage()", () => {
    const { adapter } = recording({ getLanguage: () => "PT-br" });
    expect(adapter.portalLanguage()).toBe("pt-br");
    const none = recording({ getLanguage: () => "" });
    expect(none.adapter.portalLanguage()).toBeNull();
  });

  it("respects getUser().optedIn from the official User shape", async () => {
    const optedOut = recording({ getUser: async () => ({ username: "pilot", avatarUrl: "", optedIn: false }) });
    await expect(optedOut.adapter.getIdentity()).resolves.toBeNull();

    const optedIn = recording({ getUser: async () => ({ username: "pilot", avatarUrl: "a.png", optedIn: true }) });
    await expect(optedIn.adapter.getIdentity()).resolves.toMatchObject({ id: "pilot", platform: "poki" });
  });

  it("maps the CrazyGames-named signalGameReady onto Poki's loading marker", () => {
    const { calls, adapter } = recording({ gameLoadingFinished: () => calls.push("gameLoadingFinished") });
    adapter.signalGameReady();
    adapter.signalGameReady();
    expect(calls).toEqual(["gameLoadingFinished"]); // one-shot, canonical member
  });
});

/**
 * `getToken()` is a postMessage round trip to the parent frame with an
 * 8-second timeout, and the token lives about a minute. AUDS and the adapter's
 * `getIapToken()` share one cache so a burst of storage writes costs one
 * round trip rather than one each.
 */
describe("the shared Poki account token", () => {
  beforeEach(() => {
    clearPokiAuthToken();
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  });
  afterEach(() => {
    clearPokiAuthToken();
    delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
  });

  const withGetToken = (getToken: () => Promise<string | null>) => {
    (window as unknown as { PokiSDK?: unknown }).PokiSDK = { getToken };
  };

  it("calls the SDK as a member, not detached", async () => {
    // Detaching `getToken` into a bare function loses `this`, and every Poki
    // member reads it to reach the parent frame. The signature is written so
    // this throws if a receiver is needed.
    withGetToken(function (this: unknown) {
      if (this === undefined || this === undefined) throw new TypeError("detached");
      return Promise.resolve("jwt-1");
    });
    await expect(pokiAuthToken()).resolves.toBe("jwt-1");
  });

  it("serves a second caller from cache instead of re-fetching", async () => {
    let calls = 0;
    withGetToken(() => {
      calls += 1;
      return Promise.resolve("jwt-1");
    });
    await expect(pokiAuthToken()).resolves.toBe("jwt-1");
    await expect(pokiAuthToken()).resolves.toBe("jwt-1");
    expect(calls).toBe(1);
  });

  it("collapses concurrent callers onto one request", async () => {
    let calls = 0;
    withGetToken(() => {
      calls += 1;
      return new Promise<string>((r) => setTimeout(() => r("jwt-1"), 5));
    });
    const all = await Promise.all([pokiAuthToken(), pokiAuthToken(), pokiAuthToken()]);
    expect(all).toEqual(["jwt-1", "jwt-1", "jwt-1"]);
    expect(calls).toBe(1);
  });

  it("does not cache a failure, and recovers on the next call", async () => {
    // The first call is what a synchronous throw used to break: the async body
    // settles before the in-flight handle is assigned, so the flag was left
    // pointing at a dead promise and EVERY later call returned null forever.
    let attempt = 0;
    withGetToken(() => {
      attempt += 1;
      if (attempt === 1) throw new TypeError("User accounts is not available");
      return Promise.resolve("jwt-2");
    });
    await expect(pokiAuthToken()).resolves.toBeNull();
    await expect(pokiAuthToken()).resolves.toBe("jwt-2");
  });

  it("returns null when the SDK is absent, without latching", async () => {
    await expect(pokiAuthToken()).resolves.toBeNull();
    withGetToken(() => Promise.resolve("jwt-3"));
    await expect(pokiAuthToken()).resolves.toBe("jwt-3");
  });
});
