import { defineConfig } from "vitest/config";

/**
 * Test runner for the social backend (server/). Separate from the
 * browser-side suite: node environment, no jsdom setup file, and the
 * server's own tsconfig (NodeNext ESM) governs its module resolution.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.{test,spec}.{ts,tsx}"],
  },
});
