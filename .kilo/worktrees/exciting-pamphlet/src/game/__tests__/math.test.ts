import { describe, expect, it } from "vitest";
import { formatDatePretty, formatDistance, truncate } from "../math";

describe("math string/date helpers", () => {
  it("truncate never splits a surrogate pair", () => {
    // "ab🚀cd" is 6 UTF-16 code units but 5 code points. Slicing at 3 units
    // ("ab" + the emoji's high surrogate) corrupts the string; truncating by
    // code point keeps the emoji whole.
    const s = "ab🚀cd";
    expect(s.length).toBe(6);
    expect(s.slice(0, 3)).not.toBe("ab🚀");
    expect(truncate(s, 3)).toBe("ab🚀");
  });

  it("truncate leaves a short ASCII name untouched", () => {
    expect(truncate("Aria", 14)).toBe("Aria");
  });

  it("truncate caps a long ASCII name at the code-point limit", () => {
    expect(truncate("abcdefghijklmnop", 14)).toBe("abcdefghijklmn");
  });

  it("truncate keeps a boundary emoji intact on a long name", () => {
    const s = "abcdefghijklm🚀"; // 13 ASCII + emoji = 14 code points
    expect(s.length).toBe(15); // 15 code units
    expect(truncate(s, 14)).toBe(s); // full name, no lone surrogate
  });

  it("formatDatePretty renders a valid date", () => {
    expect(formatDatePretty("2026-09-12")).toBe("September 12, 2026");
  });

  it("formatDatePretty round-trips a malformed month instead of 'undefined'", () => {
    expect(formatDatePretty("2026-13-05")).toBe("2026-13-05");
    expect(formatDatePretty("2026-00-05")).toBe("2026-00-05");
  });

  it("formatDatePretty round-trips a non-numeric date", () => {
    expect(formatDatePretty("not-a-date")).toBe("not-a-date");
  });

  it("formatDistance formats metres and kilometres", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1000)).toBe("1.00 km");
    expect(formatDistance(3121)).toBe("3.12 km");
  });

  it("formatDistance never renders garbage for a bad value", () => {
    expect(formatDistance(-50)).toBe("0 m"); // clamp negative
    expect(formatDistance(NaN)).toBe("0 m"); // NaN → 0
    expect(formatDistance(Infinity)).toBe("0 m"); // Infinity → 0
  });
});
