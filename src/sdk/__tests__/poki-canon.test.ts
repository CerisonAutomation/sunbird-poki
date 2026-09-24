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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PokiAdapter } from "../poki";
import {
  MEASURE_CATEGORIES,
  MEASURE_INTERACTION_ACTIONS,
  MEASURE_PROGRESS_ACTIONS,
  POKI_SDK_NON_CANONICAL,
  POKI_SDK_RUNTIME_ONLY,
  clampHappyIntensity,
  sanitizeMeasure,
} from "../poki-canon";

afterEach(() => {
  delete (window as unknown as { PokiSDK?: unknown }).PokiSDK;
});

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
 * Every `PokiSDK` member the code actually touches, per file. The patterns are
 * the two access routes that exist: `this.sdk?.x()` inside the adapter and
 * `getPoki()?.x()` on the boot path.
 */
function referencedMembers(file: string, accessor: RegExp): string[] {
  return [...new Set([...read(file).matchAll(accessor)].map((m) => m[1]))].sort();
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
    const poki = read("src/sdk/poki.ts");
    const boot = read("src/sdk/platform.ts");
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
    const poki = read("src/sdk/poki.ts");
    const boot = read("src/sdk/platform.ts");
    for (const entry of POKI_SDK_RUNTIME_ONLY) {
      const called = new RegExp(`\\b(?:sdk|getPoki\\(\\))\\s*\\??\\.${entry.name}\\b`).test(poki + boot);
      expect(called, `${entry.name}: registry says wired=${entry.wired} but the code disagrees`).toBe(entry.wired);
      expect(entry.why.length, `${entry.name}: record why it is or is not wired`).toBeGreaterThan(10);
    }
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

describe("measure() argument rules (the live SDK's own validation)", () => {
  it("requires category and what", () => {
    expect(sanitizeMeasure("", "daytrip", "start")).toBeNull();
    expect(sanitizeMeasure("round", "", "start")).toBeNull();
    expect(sanitizeMeasure("  ", "  ", "start")).toBeNull();
    // action may be empty — the SDK defaults it.
    expect(sanitizeMeasure("round", "daytrip", "")).toEqual({ category: "round", what: "daytrip", action: "" });
  });

  it("rejects the reserved `/` and `^` characters", () => {
    expect(sanitizeMeasure("round", "day/trip", "start")).toBeNull();
    expect(sanitizeMeasure("round", "daytrip", "com^plete")).toBeNull();
    expect(sanitizeMeasure("ro/und", "daytrip", "start")).toBeNull();
  });

  it("allows at most two numeric values across all three arguments", () => {
    expect(sanitizeMeasure("round", "daytrip", "complete")).not.toBeNull();
    expect(sanitizeMeasure("level", "1", "complete")).not.toBeNull();
    expect(sanitizeMeasure("level", "1-2", "complete")).not.toBeNull();
    expect(sanitizeMeasure("level", "1-2", "complete-3")).toBeNull();
    expect(sanitizeMeasure("quest", "2026-38", "clear-1")).toBeNull();
    // The loader also counts literal `{n}` placeholders as numeric values, so
    // three of them is over the budget exactly like three digit runs are.
    expect(sanitizeMeasure("level", "{n}", "run-{n}-{n}")).toBeNull();
    expect(sanitizeMeasure("level", "{n}", "run-{n}-x")).not.toBeNull();
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
    adapter.measure("round", "day/trip", "complete"); // reserved char → dropped
    adapter.measure("", "daytrip", "start"); // no category → dropped
    expect(calls).toEqual(["measure:round|daytrip|complete"]);
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
