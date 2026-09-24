import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirror vite.config.ts: SELL_AD_REMOVAL is read from this define so Rollup can
// constant-fold it for portal DCE. Without it here, tests would exercise a
// direct build with ad-removal off, which no shipped build ever does.
const PORTAL = (process.env.VITE_PORTAL_TARGET ?? "none").toLowerCase() || "none";

export default defineConfig({
  define: {
    "import.meta.env.VITE_SELL_AD_REMOVAL": JSON.stringify(PORTAL === "none"),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**"],
      exclude: ["src/vite-env.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
