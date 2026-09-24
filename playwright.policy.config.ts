import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the platform-policy contract test: it drives the SHIPPING
 * artifacts (`poki-upload/` and `dist/`) through both policies in a real
 * browser — that a Poki player may type a call sign and that the shipped
 * moderation refuses a blocked one, and that nothing offers to remove ads.
 *
 * No webServer: the spec serves both folders itself, so what runs is the
 * artifact, not a dev build.
 *
 * Run: pnpm test:policy — it builds `dist/` and `poki-upload/` itself first, so
 * it can never report on a stale committed artifact.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /portal-policy\.spec\.ts/,
  // Booting the shipped single-file build under headless SwiftShader is slow
  // (WebGL warm-up alone stalls the main thread for seconds) and the ad-removal
  // case walks 17 menu screens. At 120s the desktop project timed out mid-walk
  // while the phone project passed the same assertions in ~9s — the budget was
  // the constraint, not the behaviour.
  timeout: 240_000,
  expect: { timeout: 20_000 },
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
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
