import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { sunbirdSVG, sunSVG } from "./src/game/Sunbird";
import { viteSingleFile } from "vite-plugin-singlefile";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// sunbird-poki is always the Poki portal build (single-file zip).
// VITE_SINGLEFILE=false can override for local dev with chunked output.
const singleFile = process.env.VITE_SINGLEFILE !== "false";
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const PORTAL = "poki"; // intentional literal — poki-build-ids.test.ts asserts this exact string

/** Short commit sha, or "dev" in a source-only checkout. */
function gitShortSha(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: __dirname, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

const APP_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string })
  .version;
const GIT_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SUNBIRD_BUILD_SHA ?? gitShortSha() ?? "dev").slice(0, 8);
const BUILD_ID = `${APP_VERSION}-poki-${GIT_SHA}`;

function copyrightBanner(): Plugin {
  const notice =
    "/*! Sunbird © Cerison. All rights reserved. Unauthorised copying, redistribution or resale is prohibited. */";
  return {
    name: "sunbird-copyright-banner",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") file.code = `${notice}\n${file.code}`;
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base: Poki GDN serves from deep subpaths — any absolute /asset URL 404s.
  base: "./",
  plugins: [
    {
      name: "sunbird-boot-mark",
      transformIndexHtml(html) {
        return html
          .replace("<!-- BOOT_SUN -->", sunSVG({ size: 84, className: "boot-sun" }))
          .replace("<!-- BOOT_BIRD -->", sunbirdSVG({ width: 58, className: "boot-bird", animateWings: true }))
          // Strip the itch.io og:url meta — Poki Inspector flags off-portal host references.
          .replace(/<meta\s+property=["']og:url["'][^>]*>/i, "")
          .replace(/<link[^>]*rel=["'](?:preload|canonical|alternate)["'][^>]*href=["']https?:\/\/[^>]+>/gi, "");
      },
    },
    react(),
    tailwindcss(),
    ...(singleFile ? [viteSingleFile()] : [copyrightBanner()]),
    // Opt-in bundle inspector: `ANALYZE=true pnpm build` (or `pnpm build:analyze`)
    // writes dist/stats.html — a treemap of what's actually shipping, sized by
    // gzip/brotli. Off by default so it never adds cost to a normal build.
    process.env.ANALYZE === "true"
      ? visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true, template: "treemap" })
      : null,
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "./Payments": path.resolve(__dirname, "src/game/Payments.portal.ts"),
    },
  },
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(BUILD_ID),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
    "import.meta.env.VITE_GIT_SHA": JSON.stringify(GIT_SHA),
    "import.meta.env.VITE_PORTAL_TARGET": JSON.stringify(PORTAL),
    // PORTAL is "poki" at build time; the comparison is always false and that is
    // intentional — this flag only fires in a local non-portal dev run.
    // @ts-expect-error TS2367: literal "poki" never equals "none" by design
    "import.meta.env.VITE_SIM_BREAKS": JSON.stringify(PORTAL === "none" && process.env.VITE_SIM_BREAKS === "true"),
    "import.meta.env.VITE_SELL_AD_REMOVAL": JSON.stringify(false),
  },
  // The dev server runs behind a proxied preview host whose name is generated
  // per session, so a fixed allowlist cannot name it. `server` affects `vite
  // dev` only — it is not read by `vite build`, so this cannot loosen the
  // shipped bundle.
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    minify: "terser",
    terserOptions: { compress: { drop_console: true, drop_debugger: true } },
    rollupOptions: {
      output: {
        ...(singleFile
          ? {}
          : {
              manualChunks: {
                three: ["three"],
                react: ["react", "react-dom"],
                audio: ["./src/game/Audio.ts", "./src/game/Music.ts"],
                net: [
                  "./src/game/Realtime.ts",
                  "./src/sdk/PokiMpUtils.ts",
                  "./src/game/MassRace.ts",
                  "./src/game/GhostNet.ts",
                  "./src/game/bufferUpdates.ts",
                  "./src/game/Squad.ts",
                ],
                social: ["./src/game/Leaderboard.ts", "./src/game/Tournaments.ts"],
              },
            }),
      },
    },
  },
});
