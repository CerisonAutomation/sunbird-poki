import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The shipping HUD source as one string, for source-shape tests.
 *
 * The HUD is a module set, not a file: `HUD.ts` holds the shell and the play
 * surface, and `hud/*.ts` holds the extracted subsystems (shop, race, meta,
 * run, kit). Markup assertions that read one file pass vacuously the moment
 * markup moves to a sibling, which is how four suites went red when the
 * subsystems were split out.
 *
 * Concatenating the whole set keeps those assertions honest and future-proof:
 * a template can move between files without the contract changing, and an
 * assertion about "no bare interpolation anywhere" now actually means
 * everywhere. Files are read in a stable sorted order so a slice taken from
 * one of them is reproducible.
 *
 * `.body` files are documentation stubs that precede their module, not code,
 * so they are excluded to keep slices anchored to real functions.
 */
function readHudSources(): string {
  // `process.cwd()` rather than `__dirname`: this package is ESM, where
  // __dirname does not exist, and vitest runs from the project root.
  const gameDir = join(process.cwd(), "src", "game");
  const hudDir = join(gameDir, "hud");

  const parts: string[] = [readFileSync(join(gameDir, "HUD.ts"), "utf8")];

  for (const name of readdirSync(hudDir).sort()) {
    if (!name.endsWith(".ts") || name === "types.ts") continue;
    parts.push(readFileSync(join(hudDir, name), "utf8"));
  }

  return parts.join("\n");
}

export const HUD_SOURCE: string = readHudSources();

/**
 * Every `data-action` value the shipping markup declares.
 *
 * A module-level const, not a function: under this vitest transform an exported
 * function closing over `HUD_SOURCE` resolved against an uninitialised binding
 * and returned an empty list, while the identical regex evaluated inline in the
 * importing test returned all 144. Keep it a const.
 */
export const HUD_ACTIONS: string[] = [
  ...new Set([...HUD_SOURCE.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]!)),
];
