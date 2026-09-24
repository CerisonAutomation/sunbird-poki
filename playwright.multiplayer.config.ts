import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Real sockets + two independent storage contexts. The Node server is the
// legacy protocol reference, NOT a replacement for production Rust validation.
export default defineConfig({
  ...base,
  testDir: "./e2e-multiplayer",
  timeout: 90000,
  projects: [{ name: "two-player", use: { viewport: { width: 390, height: 844 } } }],
  use: { ...base.use, baseURL: "http://127.0.0.1:4175" },
  webServer: [
    { command: "PORT=8081 node server/sunbird-server.mjs", url: "http://127.0.0.1:8081/health", reuseExistingServer: !process.env.CI },
    { command: "PORT=8789 PGLITE_DIR=memory:// node server/social/social-server.mjs", url: "http://127.0.0.1:8789/health", reuseExistingServer: !process.env.CI },
    { command: "VITE_SOCIAL_URL=/social VITE_MULTIPLAYER_URL=/mp npm run build -- --outDir dist-multiplayer && SOCIAL_PROXY_TARGET=http://127.0.0.1:8789 MULTIPLAYER_PROXY_TARGET=http://127.0.0.1:8081 npm run preview -- --outDir dist-multiplayer --host 0.0.0.0 --port 4175", url: "http://127.0.0.1:4175", timeout: 120000, reuseExistingServer: !process.env.CI },
  ],
});
