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
      // Instrumentable SOURCE only. The bare `src/**` glob also matched the Vite
      // entry `src/index.html`, and the v8 provider then tried to remap coverage
      // for it — Rollup threw "Expression expected" on the HTML and the coverage
      // run exited non-zero. That made `verify:prod` fail, and therefore made
      // `pnpm gate` red on every run, whatever the code did.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
