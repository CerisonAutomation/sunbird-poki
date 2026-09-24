import { describe, expect, it } from "vitest";
import { buildChallengeUrl, packChallengeToken, unpackChallengeToken } from "../Challenge";

/**
 * The rival-link payload is `seed.distance.encodedName` inside
 * `#rival=...`. These mirror-tests lock the codec's grammar so a format
 * drift can't silently orphan every previously shared link.
 */
const encode = (seed: string, distance: number, name: string): string =>
  `${seed}.${Math.floor(distance)}.${encodeURIComponent(name)}`;

const decode = (raw: string): { seed: string; distance: number; name: string } | null => {
  const [seed, dist, ...nameParts] = raw.split(".");
  const distance = Math.floor(Number(dist));
  if (!seed || !/^[a-z0-9-]{1,40}$/i.test(seed)) return null;
  if (!Number.isFinite(distance) || distance <= 0 || distance > 1_000_000) return null;
  const name = decodeURIComponent(nameParts.join(".")).replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 14) || "A rival";
  return { seed, distance, name };
};

describe("rival challenge links", () => {
  it("round-trips a normal challenge", () => {
    const raw = encode("2026-09-11", 3121, "Pilot 7Q2F");
    const c = decode(raw)!;
    expect(c.seed).toBe("2026-09-11");
    expect(c.distance).toBe(3121);
    expect(c.name).toBe("Pilot 7Q2F");
  });

  it("survives names containing dots (the payload separator)", () => {
    const raw = encode("wild-abc123", 500, "j.r. hawk");
    const c = decode(raw)!;
    expect(c.name).toBe("j.r. hawk");
    expect(c.distance).toBe(500);
  });

  it("rejects malformed and hostile payloads", () => {
    expect(decode("..")).toBeNull(); // empty seed
    expect(decode("seed$bad.100.x")).toBeNull(); // seed charset
    expect(decode("ok.-5.x")).toBeNull(); // negative distance
    expect(decode("ok.NaN.x")).toBeNull(); // non-numeric distance
    expect(decode("ok.99999999.x")).toBeNull(); // absurd distance
  });

  it("sanitizes script-y names instead of rejecting the challenge", () => {
    const c = decode(encode("2026-09-11", 100, "<img onerror=x>"))!;
    expect(c.name).not.toContain("<");
    expect(c.name).not.toContain(">");
  });
});

describe("mode-aware challenge links (real builder)", () => {
  it("omits mode when none given (backward compatible)", () => {
    const url = buildChallengeUrl("2026-09-12", 1234, "Pilot X");
    expect(url).toContain("#rival=2026-09-12.1234.Pilot%20X");
    expect(url).not.toContain("&mode=");
  });

  it("carries the mode as a sibling hash param when provided", () => {
    const url = buildChallengeUrl("seed-1", 500, "Ace", "race");
    expect(url).toContain("#rival=seed-1.500.Ace");
    expect(url).toContain("&mode=race");
  });

  it("keeps the mode out of the dot payload so old parsers still work", () => {
    const url = buildChallengeUrl("seed-1", 500, "Ace", "zenith");
    const payload = url.split("#rival=")[1]!.split("&")[0]!;
    expect(payload.split(".").length).toBe(3); // seed.distance.name only
  });
});

describe("compact challenge tokens", () => {
  it("round-trips seed, distance, name and mode", () => {
    const token = packChallengeToken({ seed: "2026-09-24", distance: 1840, name: "Pilot 7Q2F", mode: "race" });
    expect(token.startsWith("sb1:")).toBe(true);
    const c = unpackChallengeToken(token)!;
    expect(c.seed).toBe("2026-09-24");
    expect(c.distance).toBe(1840);
    expect(c.name).toBe("Pilot 7Q2F");
    expect(c.mode).toBe("race");
  });

  it("survives names with spaces and rejects hostile payloads", () => {
    const token = packChallengeToken({ seed: "wild-abc123", distance: 500, name: "j r hawk" });
    expect(unpackChallengeToken(token)!.name).toBe("j r hawk");
    expect(unpackChallengeToken("sb1:bad$seed:100:x")).toBeNull();
    expect(unpackChallengeToken("sb1:ok:-5:x")).toBeNull();
    expect(unpackChallengeToken("not-a-token")).toBeNull();
    expect(unpackChallengeToken("rival=ok.100.x")).toBeNull();
  });

  it("strips script-y names instead of rejecting the challenge", () => {
    const token = packChallengeToken({ seed: "2026-09-24", distance: 100, name: "<img onerror=x>" });
    expect(unpackChallengeToken(token)!.name).not.toContain("<");
  });
});
