import { describe, expect, it } from "vitest";
import { classify, fingerprint, fnv1a, RateGate, redact, safeMessage } from "../resilience/errors";

describe("errors — safeMessage", () => {
  it("formats Errors with their name", () => {
    expect(safeMessage(new TypeError("x is undefined"))).toBe("TypeError: x is undefined");
  });
  it("clips enormous messages and flattens whitespace", () => {
    const msg = safeMessage(`a\n  b\t${"c".repeat(1000)}`);
    expect(msg.length).toBeLessThanOrEqual(220);
    expect(msg).not.toMatch(/\n/);
  });
  it("survives throwing toString", () => {
    const evil = { toString(): never { throw new Error("boom"); } };
    expect(safeMessage(evil)).toBe("unserializable thrown value");
  });
});

describe("errors — redact", () => {
  it("strips emails", () => {
    expect(redact("from player.dev@example.co.uk about lag")).toBe("from <email> about lag");
  });
  it("strips credential query params", () => {
    expect(redact("rejected https://x.io/a?token=abcdef&ok=1")).toContain("token=<redacted>");
  });
  it("strips long hex secrets and long digit runs", () => {
    expect(redact("sig deadbeefcafe0123456789abcdef0123 at 1737500000000")).not.toContain("deadbeef");
    expect(redact("id 1737500000000")).toContain("#");
  });
});

describe("errors — fingerprint", () => {
  it("collapses variable numbers/urls into one key", () => {
    const a = fingerprint("Fetch failed for https://api.x.io/board?page=1 after 1234ms");
    const b = fingerprint("fetch failed for https://api.x.io/board?page=9 after 4321ms");
    expect(a).toBe(b);
  });
  it("keeps distinct root causes distinct", () => {
    expect(fingerprint("TypeError: cannot read x")).not.toBe(fingerprint("RangeError: out of bounds"));
  });
  it("fnv1a is stable", () => {
    expect(fnv1a("sunbird")).toBe(fnv1a("sunbird"));
    expect(fnv1a("sunbird")).not.toBe(fnv1a("sunbirD"));
  });
});

describe("errors — classify", () => {
  it("marks renderer/OOM as fatal", () => {
    expect(classify("THREE.WebGL: context lost while rendering")).toBe("fatal");
    expect(classify("out of memory")).toBe("fatal");
  });
  it("marks network/storage as warning", () => {
    expect(classify("fetch timeout for /board")).toBe("warning");
    expect(classify("QuotaExceededError: storage full")).toBe("warning");
  });
  it("defaults to error", () => {
    expect(classify("TypeError: x is not a function")).toBe("error");
  });
});

describe("RateGate", () => {
  it("allows up to max within the window, then blocks", () => {
    const g = new RateGate(2, 1_000);
    expect(g.allow(0)).toBe(true);
    expect(g.allow(1)).toBe(true);
    expect(g.allow(2)).toBe(false);
  });
  it("frees slots as the window slides", () => {
    const g = new RateGate(2, 1_000);
    g.allow(0);
    g.allow(100);
    expect(g.allow(1_050)).toBe(true); // first stamp expired
    expect(g.count).toBe(2);
  });
});
