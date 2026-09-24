import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the visual regression suite (e2e/visual.spec.ts). It serves the
 * SHIPPING folder (`poki-upload/`) itself, so what is compared is the artifact a
 * portal player loads, not a dev server.
 *
 * Baselines live in e2e/visual.spec.ts-snapshots/<project>/ and are committed.
 * They are pixel-sensitive to the machine's fonts: regenerate deliberately with
 * `pnpm test:visual -- --update-snapshots` after an intended design change, and
 * review the diff before committing.
 *
 * Run: pnpm test:visual    (needs `pnpm build:poki` first)
 */
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
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    // Desktop only: the phone form factor already has its own layout specs
    // (menu-layout, session-layout, scaling), and a second pixel baseline set
    // doubles the run without catching anything those do not.
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
