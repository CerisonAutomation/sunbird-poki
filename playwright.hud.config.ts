import { defineConfig, devices } from "@playwright/test";
import { resolveChromium } from "./e2e/chromium-executable";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /(?:^|\/)(?:layout|flight-hierarchy)\.spec\.ts$/,
  timeout: 300_000, expect: { timeout: 30_000 }, workers: 1, reporter: "list",
  use: { baseURL: "http://127.0.0.1:4192", launchOptions: { executablePath: resolveChromium().executablePath, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "pnpm exec vite preview --host 127.0.0.1 --port 4192 --outDir dist-poki", port: 4192, reuseExistingServer: false },
});
