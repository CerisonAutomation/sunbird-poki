import { defineConfig, devices } from "@playwright/test";
import { resolveChromium } from "./e2e/chromium-executable";

/**
 * `resolveChromium()` picks the browser instead of assuming the build
 * `@playwright/test` pins is the one installed here; see
 * e2e/chromium-executable.ts. Without it, a machine holding a different
 * Chromium build fails every spec in this config identically.
 */
const browser = resolveChromium();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: browser.executablePath,
      args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", testIgnore: /layout\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 0.0.0.0 --port 4173",
    url: "http://127.0.0.1:4173",
    // Never reuse: Playwright cannot tell whose server is on the port, and a
    // squatting `vite preview` from another checkout (or an earlier build of
    // this one) silently runs the whole suite against a stale bundle — every
    // assertion then describes code that isn't the code under test. With this
    // false, an occupied port is a loud startup error instead. The build is a
    // couple of seconds; correctness is worth more than that.
    reuseExistingServer: false,
    timeout: 120000,
  },
});
