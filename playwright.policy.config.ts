import { defineConfig, devices } from "@playwright/test";
import { resolveChromium } from "./e2e/chromium-executable";

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
 *
 * `resolveChromium()` picks the browser instead of assuming the pinned build is
 * the installed one; see e2e/chromium-executable.ts for why that has to be
 * resolved rather than hardcoded.
 */
const browser = resolveChromium();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /portal-policy\.spec\.ts/,
  // Booting the shipped single-file build under headless SwiftShader is slow
  // (WebGL warm-up alone stalls the main thread for seconds) and the ad-removal
  // case walks 17 menu screens. Two earlier budgets were not enough: at 120s the
  // desktop project timed out mid-walk, and at 240s the suite went 3/8 red on a
  // machine sitting at load average 144 — while those same cases took 22s and
  // 26s when run on their own.
  //
  // That 10x gap is the actual story. SwiftShader rasterises on the CPU, so this
  // suite's runtime is a function of whatever else the machine is doing. 240s
  // left the slowest case at 228s: twelve seconds of headroom on a shared
  // runner, which is why it read as "the tests are broken" when nothing was. A
  // gate that flips on ambient load trains people to re-run it until it happens
  // to go green, which is worse than having no gate at all. The budget is now
  // wide enough that load alone does not decide the outcome; a real regression
  // still fails fast on its own `expect` timeouts, which is what should catch it.
  timeout: 600_000,
  expect: { timeout: 20_000 },
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
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
