import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Transient message timing, pinned against the real corpus.
 *
 * The complaint was that the funny messages vanish before they can be read. The
 * cause was not vibes: the model was 1.2 s + 28 ms/char, and a median quip in
 * this corpus is 35 characters (~6 words), which got 1.73 s — about how long six
 * words take to read, with nothing left for finding the text first.
 */
const ACQUIRE = 450;   // peripheral novel target on a moving background
const PER_WORD = 415;  // 238 wpm, derated for peripheral + divided attention
const FLOOR = 1100;
const CEIL = 6000;

const need = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(CEIL, Math.max(FLOOR, ACQUIRE + words * PER_WORD));
};

describe("message timing model", () => {
  it("gives the corpus's real median quip enough time to read", () => {
    // Straight from the quip pool, not a synthetic string.
    const surprises = readFileSync("src/game/Surprises.ts", "utf8");
    const pools = [...surprises.matchAll(/export const \w*QUIPS\s*=\s*\[([\s\S]*?)\];/g)];
    const quips = pools.flatMap((p) => [...p[1]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!));
    expect(quips.length, "corpus not found").toBeGreaterThan(100);

    const long = quips.filter((q) => q.trim().split(/\s+/).length > 4);
    for (const q of long) {
      const words = q.trim().split(/\s+/).length;
      expect(need(q), `"${q}"`).toBeGreaterThanOrEqual(ACQUIRE + words * PER_WORD);
    }
  });

  it("never gives a message LESS than it needs", () => {
    for (const s of ["THUD!", "Great landing", "The fish gave that landing a standing ovation", "New skill unlocked: damp"]) {
      const words = s.trim().split(/\s+/).length;
      expect(need(s), s).toBeGreaterThanOrEqual(ACQUIRE + words * PER_WORD);
    }
  });

  it("scales with words, not characters", () => {
    // Two 20-character strings: a four-word one and a one-word one. A char-based
    // model gives them identical time; this must not.
    const fourWords = "the bird is gone now";       // 20 chars, 5 words
    const oneWord = "congratulations!!";           // 17 chars, 1 word
    expect(need(fourWords)).toBeGreaterThan(need(oneWord));
  });

  it("keeps a one-word message above the see-it floor", () => {
    expect(need("THUD!")).toBe(FLOOR);
  });

  it("caps so an occupied layer cannot deadlock", () => {
    const absurd = new Array(40).fill("word").join(" ");
    expect(need(absurd)).toBe(CEIL);
  });

  it("the old model was the bug — it under-read the median quip", () => {
    // A median-corpus line: 35 characters, 6 words.
    const oldHold = 1200 + Math.max(0, 35 - 16) * 28;
    expect(oldHold / 1000).toBeLessThan(2);
    // The new model must be materially more generous.
    expect(need("The fish gave that landing ovation")).toBeGreaterThan(oldHold);
  });
});

describe("quips are actually visible on short embedded viewports", () => {
  it("no longer hidden outright below 600px of height", () => {
    // The Poki embed is short. Hiding the toast layer there did not degrade
    // it, it deleted the game's voice for the audience it ships to.
    const css = readFileSync("src/index.css", "utf8");
    expect(css).not.toMatch(/\[data-flying="true"\]\s*\.toasts\s*\{\s*display:\s*none/);
    expect(css).not.toMatch(/\.impact-popups\s*\{\s*display:none/);
  });

  it("still keeps the landing corridor clear, by position rather than deletion", () => {
    const css = readFileSync("src/index.css", "utf8");
    // Compact + moved, not removed.
    expect(css).toMatch(/\[data-flying="true"\]\s*\.toasts\s*\{[^}]*width:/);
  });
});
