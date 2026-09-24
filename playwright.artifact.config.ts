import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the artifact contract test: it loads the SHIPPING folder
 * (`poki-upload/`) in a real browser, with the Poki SDK stubbed the same way
 * the Inspector injects it, and asserts the SDK event contract.
 *
 * There is deliberately no `webServer` here — the spec serves `poki-upload/`
 * itself (see e2e/poki-artifact.spec.ts), so this never builds the app or
 * touches `dist/`. That is the point: what is under test is the artifact, not
 * a dev server.
 *
 * Run: pnpm test:artifact — it runs `pnpm build:poki` itself first, so a stale
 * `poki-upload/` snapshot can never make these pass for the wrong reason.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /poki-artifact\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4176",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      // Headless CI has no GPU: WebGL comes from SwiftShader, same flags the
      // main Playwright config uses for the game itself.
      args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
