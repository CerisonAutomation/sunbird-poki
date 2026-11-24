import { defineConfig, devices } from "@playwright/test";
import { resolveChromium } from "./e2e/chromium-executable";

/**
 * Config for the visual regression suite (e2e/visual-*.spec.ts). It serves the
 * SHIPPING folder (`poki-upload/`) itself, so what is compared is the artifact a
 * portal player loads, not a dev server.
 *
 * Pixel baselines live in e2e/visual-baselines.spec.ts-snapshots/ and are committed.
 * They are pixel-sensitive to the machine's fonts: regenerate deliberately with
 * `pnpm test:visual -- --update-snapshots` after an intended design change, and
 * review the diff before committing.
 *
 * Run: pnpm test:visual    (needs `pnpm build:poki` first).
 * Set VISUAL_CAPTURE=1 to save screenshots from the screen-walk audit.
 */
const browser = resolveChromium();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /visual-.*\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: browser.executablePath,
      args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    // Exercise every navigable screen on a phone as well; pixel baselines and
    // exhaustive locale checks remain desktop-only in this configuration.
    { name: "phone", testMatch: /visual-screens\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
});
