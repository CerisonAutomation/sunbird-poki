/**
 * Thumbnail parity (docs/poki/16-submission.md, SUB-04).
 *
 * Poki judges a game by two pictures: the one uploaded in the dashboard and the
 * one a player meets inside the build. They are supposed to be the same picture,
 * and for a while they were not — `public/poki/thumbnail-*.png` shipped an older,
 * softer art direction while `assets/submission/` held the graded, in-game-palette
 * dive, so the tile and the game page disagreed about what the game looks like.
 *
 * Both copies are now rendered from the same master by
 * `scripts/render-thumbnail.mjs`. This test is the guard: identical bytes, or a
 * release fails here instead of on the platform.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const PAIRS = [
  ["assets/submission/sunbird-thumbnail-628.png", "public/poki/thumbnail-628.png", 628],
  ["assets/submission/sunbird-thumbnail-1024.png", "public/poki/thumbnail-1024.png", 1024],
] as const;

const sha = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

/** PNG header: width and height live in the IHDR chunk (big-endian). */
function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("Poki thumbnail", () => {
  for (const [submission, shipped, size] of PAIRS) {
    it(`${size}px copy inside the build is byte-identical to the submission file`, () => {
      expect(existsSync(submission), `${submission} missing — run scripts/render-thumbnail.mjs`).toBe(true);
      expect(existsSync(shipped), `${shipped} missing — run scripts/render-thumbnail.mjs`).toBe(true);
      expect(sha(shipped)).toBe(sha(submission));
    });

    it(`${size}px copy is a square at least 628 px, full-bleed`, () => {
      const { width, height } = pngSize(shipped);
      expect(width).toBe(height);
      expect(width).toBeGreaterThanOrEqual(628);
    });
  }

  it("ships no upscale as a deliverable", () => {
    // The retired 1400px copy was a box-filter upscale of the 1024 master: no
    // extra pixels, triple the bytes, and one more thing to forget to update.
    expect(existsSync("public/poki/thumbnail-1400.png")).toBe(false);
  });
});
