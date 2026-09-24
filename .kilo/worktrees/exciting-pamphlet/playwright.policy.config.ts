import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the platform-policy contract test: it drives the SHIPPING
 * artifacts (`poki-upload/` and `dist/`) through the two Poki policy fixes —
 * read-only pilot name, and no ad-removal offers — in a real browser.
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
  timeout: 120_000,
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
