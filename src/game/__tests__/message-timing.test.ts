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
// Import the REAL model rather than re-implementing it.
//
// This file used to declare its own copy of the formula with the same five
// constants. That made all six tests below satisfiable by the copy: delete
// src/game/MessageTiming.ts entirely, or restore the old 1200 + 28ms/char model
// this suite exists to guard against, and every one still passed. A guard that
// cannot fail is worse than no guard — it certifies a model nobody ships.
import { messageHoldMs as need, wordCount } from "../MessageTiming";

describe("message timing model", () => {
  it("gives the corpus's real median quip enough time to read", () => {
    // Straight from the quip pool, not a synthetic string.
    const surprises = readFileSync("src/game/Surprises.ts", "utf8");
    const pools = [...surprises.matchAll(/export const \w*QUIPS\s*=\s*\[([\s\S]*?)\];/g)];
    const quips = pools.flatMap((p) => [...p[1]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!));
    expect(quips.length, "corpus not found").toBeGreaterThan(100);

    // Literal 450 / 415, NOT the imported constants. Comparing the production
    // function against values it imports from the same module is satisfied by
    // ANY self-consistent model — breaking ACQUIRE to 5 passed, and so did
    // replacing the whole formula with the old 1.2s + 28ms/char one. The point
    // of this file is to pin the shipped numbers, so the numbers live here.
    const ACQUIRE_MS = 450;   // peripheral novel target on a moving background
    const PER_WORD_MS = 415;  // 238 wpm, derated for peripheral + divided attention
    const long = quips.filter((q) => wordCount(q) > 4);
    for (const q of long) {
      expect(need(q), `"${q}"`).toBeGreaterThanOrEqual(ACQUIRE_MS + wordCount(q) * PER_WORD_MS);
    }
  });

  it("never gives a message LESS than it needs", () => {
    const ACQUIRE_MS = 450;
    const PER_WORD_MS = 415;
    for (const s of ["THUD!", "Great landing", "The fish gave that landing a standing ovation", "New skill unlocked: damp"]) {
      expect(need(s), s).toBeGreaterThanOrEqual(ACQUIRE_MS + wordCount(s) * PER_WORD_MS);
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
    // Literal 1100, not TOAST_FLOOR_MS: asserting a function returns the
    // constant it reads is true for every value of that constant.
    expect(need("THUD!")).toBe(1100);
  });

  it("caps so an occupied layer cannot deadlock", () => {
    const absurd = new Array(40).fill("word").join(" ");
    expect(need(absurd)).toBe(6000);
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
    // Narrow: the `:not([data-feedback])` guard that hides impact popups OUTSIDE
    // the hint beat is correct and stays. It is only the short-viewport
    // media query that was deleting them mid-run.
    const shortViewportHides = /@media\s*\([^)]*max-height:\s*500px[^)]*\)\s*\{[^{}]*\{[^{}]*\.impact-popups\s*\{\s*display:\s*none/;
    expect(css, "impact popups are still hidden by a short-viewport query").not.toMatch(shortViewportHides);
  });

  it("still keeps the landing corridor clear, by position rather than deletion", () => {
    const css = readFileSync("src/index.css", "utf8");
    // Compact + moved, not removed.
    expect(css).toMatch(/\[data-flying="true"\]\s*\.toasts\s*\{[^}]*width:/);
  });
});
