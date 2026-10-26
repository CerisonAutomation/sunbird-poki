/**
 * Which Chromium the Playwright gates should launch.
 *
 * The failure this exists to stop: `@playwright/test` pins one exact Chromium
 * build, and a machine that has a *different* build installed makes every spec
 * in every config die with the same
 *
 *   browserType.launch: Executable doesn't exist at
 *     ~/Library/Caches/ms-playwright/chromium_headless_shell-1208/...
 *
 * Once per test, so one wrong machine reads as eight identical stack traces
 * rather than as one diagnosable problem.
 *
 * Resolution order, and why:
 *
 *   1. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — the pre-existing override. Kept, and
 *      now checked: pointing it at a path that is not there fails here with a
 *      sentence, instead of surfacing as a launch error 200 lines into a run.
 *   2. The build `@playwright/test` pins, when it is installed. This is the
 *      normal CI path (`playwright install chromium` puts it there) and it is
 *      left entirely to Playwright — no override, so the pinned build is the one
 *      that runs.
 *   3. The closest *installed* Chromium, used as an explicit `executablePath`.
 *      This is what keeps a fresh clone working on a machine whose cache holds
 *      a different build, which is the case that broke the gate.
 *   4. Otherwise: throw, with what was wanted, what was searched, and the one
 *      command that fixes it.
 *
 * No home-directory path is hardcoded. The cache root is found by walking up
 * from the path Playwright itself reports, so it follows `PLAYWRIGHT_BROWSERS_PATH`
 * and each platform's own layout instead of assuming macOS.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/** How the browser was chosen, for the one-line note each config prints. */
export type ChromiumResolution =
  | { readonly executablePath: undefined; readonly source: "playwright-default" }
  | {
      readonly executablePath: string;
      readonly source: "env" | "cache";
      readonly note: string;
    };

/** `chromium-1243` / `chromium_headless_shell-1243` — the build directories. */
const BUILD_DIR = /^chromium(?:_headless_shell)?-(\d+)$/;

/** The same name without a revision, which is the directory we are looking for
 *  when walking up out of the path Playwright reports. */
const BUILD_DIR_NO_REV = /^chromium(?:_headless_shell)?(?:-\d+)?$/;

/** Playwright writes this last, so its presence means the build finished
 *  unpacking. A half-downloaded directory is not a candidate. */
const INSTALL_COMPLETE = "INSTALLATION_COMPLETE";

/** Headless shell first: that is what Playwright launches itself in headless
 *  mode, so it is the substitute least likely to behave differently. */
const HEADLESS_SHELL_BINARIES = ["chrome-headless-shell", "headless_shell"] as const;
const CHROMIUM_BINARIES = ["Google Chrome for Testing", "Chromium", "chrome", "chrome.exe"] as const;

/** Bounded so a stray deep tree cannot turn config loading into a long walk. */
const MAX_WALK_DEPTH = 5;

let resolution: ChromiumResolution | undefined;

/**
 * Resolve the Chromium to launch, printing at most one line of explanation.
 *
 * The line matters as much as the path: when the pinned build is missing and a
 * substitute is used, the operator needs to know the run was not on the pinned
 * browser. Silence on the default path keeps CI logs clean.
 */
export function resolveChromium(): ChromiumResolution {
  if (resolution) return resolution;

  const override = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(
        [
          `PLAYWRIGHT_CHROMIUM_EXECUTABLE is set to a path that does not exist:`,
          `  ${override}`,
          `Unset it to fall back to the installed browser, or point it at one.`,
        ].join("\n"),
      );
    }
    resolution = { executablePath: override, source: "env", note: `chromium: ${override} (PLAYWRIGHT_CHROMIUM_EXECUTABLE)` };
    announce(resolution);
    return resolution;
  }

  const wanted = chromium.executablePath();
  if (existsSync(wanted)) {
    // The pinned build is installed. Nothing to override and nothing to report.
    resolution = { executablePath: undefined, source: "playwright-default" };
    return resolution;
  }

  const cacheRoot = browsersCacheRoot(wanted);
  const substitute = cacheRoot && closestInstalled(cacheRoot, pinnedRevision(wanted));
  if (!substitute) {
    throw new Error(
      [
        `No Chromium is available for the Playwright gates.`,
        `  @playwright/test wants build ${pinnedRevision(wanted)}: ${wanted}`,
        cacheRoot ? `  searched for installed builds under: ${cacheRoot}` : `  the browser cache directory could not be located from ${wanted}`,
        `  found: ${cacheRoot ? "none" : "unknown"}`,
        ``,
        `Fix it with:`,
        `  pnpm exec playwright install chromium`,
        ``,
        `That downloads the pinned build and needs network access to cdn.playwright.dev.`,
        `Behind a proxy or with no route to it, PLAYWRIGHT_CHROMIUM_EXECUTABLE=<path to a chromium binary>`,
        `still overrides everything, and scripts/setup-browser.mjs fetches a self-contained`,
        `Chromium for sandboxes that cannot reach the CDN at all.`,
      ].join("\n"),
    );
  }

  resolution = {
    executablePath: substitute,
    source: "cache",
    note:
      `chromium: ${substitute} (build ${buildOf(substitute) ?? "?"} substituted for the pinned ` +
      `${pinnedRevision(wanted)}, which is not installed — see browsers in the Playwright cache)`,
  };
  announce(resolution);
  return resolution;
}

function announce(resolved: ChromiumResolution): void {
  if ("note" in resolved) process.stderr.write(`[playwright] ${resolved.note}\n`);
}

/** The build number Playwright pins, read out of the path it reports. */
function pinnedRevision(wanted: string): string {
  return buildOf(wanted) ?? "unknown";
}

function buildOf(anyPathUnderTheCache: string): string | undefined {
  let dir = path.dirname(anyPathUnderTheCache);
  for (let i = 0; i < 6 && path.dirname(dir) !== dir; i += 1) {
    const match = BUILD_DIR.exec(path.basename(dir));
    if (match) return match[1];
    dir = path.dirname(dir);
  }
  return undefined;
}

/**
 * The Playwright browsers cache root, found by walking up until the enclosing
 * directory is one of the build directories. Each platform nests the binary a
 * different number of levels deep (`Contents/MacOS/...` vs a bare `chrome`), so
 * counting levels would be a per-OS guess; matching the name is not.
 *
 * The walk matches on the *name* and does not require the directory to exist:
 * the pinned build is the one most likely to be missing, and its absence is the
 * whole reason this runs. Only the cache root it lands on has to be real.
 */
function browsersCacheRoot(wanted: string): string | undefined {
  let dir = path.dirname(wanted);
  for (let i = 0; i < 6 && path.dirname(dir) !== dir; i += 1) {
    if (BUILD_DIR_NO_REV.test(path.basename(dir))) {
      const root = path.dirname(dir);
      return existsSync(root) ? root : undefined;
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

/**
 * The installed build closest to the pinned one, headless shell winning a tie.
 *
 * Closest rather than newest on purpose: a build many revisions ahead is as
 * likely to have drifted from the CDP surface this Playwright speaks as one far
 * behind is. `chromium-tip-of-tree-*` is excluded by the pattern, which is
 * correct — it is a development channel, not a supported build.
 */
function closestInstalled(cacheRoot: string, pinned: string): string | undefined {
  const pinnedNumber = Number(pinned);
  let best: { file: string; distance: number; shell: number } | undefined;

  for (const entry of readdirSync(cacheRoot)) {
    const match = BUILD_DIR.exec(entry);
    if (!match) continue;
    const dir = path.join(cacheRoot, entry);
    if (!existsSync(path.join(dir, INSTALL_COMPLETE))) continue;
    const shell = entry.startsWith("chromium_headless_shell") ? 0 : 1;
    const binary = findBinary(dir, shell === 0 ? HEADLESS_SHELL_BINARIES : CHROMIUM_BINARIES);
    if (!binary) continue;
    const distance = Number.isFinite(pinnedNumber) ? Math.abs(Number(match[1]) - pinnedNumber) : Number(match[1]);
    if (!best || distance < best.distance || (distance === best.distance && shell < best.shell)) {
      best = { file: binary, distance, shell };
    }
  }
  return best?.file;
}

/** First file under `dir` (sorted, so the answer does not depend on readdir
 *  order) whose name is one of `names`. */
function findBinary(dir: string, names: readonly string[], depth = 0): string | undefined {
  if (depth > MAX_WALK_DEPTH) return undefined;
  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    const child = path.join(dir, entry);
    const stat = statSync(child, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      const hit = findBinary(child, names, depth + 1);
      if (hit) return hit;
    } else if (stat.isFile() && names.includes(entry)) {
      return child;
    }
  }
  return undefined;
}
