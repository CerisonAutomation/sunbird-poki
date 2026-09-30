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

/**
 * Move the inlined bundle to the END of `<body>`.
 *
 * `vite-plugin-singlefile` hoists the inlined `<script>` into `<head>`, which
 * puts it in front of everything. The measured consequence on the shipped
 * artifact was stark: `<body>` — and therefore the inline boot loader whose
 * entire job is "a cold start on a slow connection is never a blank white
 * page" — began at byte 2,093,589 of 2,099,624. The loader could not paint
 * until 99.7% of the payload had arrived, so the one mitigation against a slow
 * first load was itself gated behind the slow first load.
 *
 * HTML is streamed and parsed incrementally, so relocating the script past the
 * boot shell means the loader paints after ~6 KB instead of ~2 MB. Nothing
 * else changes: the tag is `type="module"`, which is deferred by definition, so
 * execution still happens after the document is parsed and in the same order.
 *
 * Poki's requirement is a 10-second ceiling on time-to-playable from anywhere
 * in the world; this is the cheapest second available.
 */
function bootShellFirst(): Plugin {
  return {
    name: "sunbird-boot-shell-first",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".html")) continue;
        const html = typeof file.source === "string" ? file.source : Buffer.from(file.source).toString("utf8");
        // Only the inlined module bundle moves. A tag with a `src` is a real
        // network request the browser should start discovering early, and the
        // boot-progress shim must keep running before the game does.
        // Both the inlined bundle and the inlined stylesheet move. The boot
        // shell carries its own `<style>` inside its own subtree and covers the
        // viewport at z-index 10000, so the game's stylesheet is not needed for
        // the first paint — and at 294 KB of CSS plus 136 KB of base64 fonts it
        // is by far the largest thing standing between the player and the
        // loader. Moving both takes first-paint bytes from ~432 KB to ~6 KB.
        const blocks: string[] = [];
        let rest = html;
        for (const re of [/<script type="module"[^>]*>[\s\S]*?<\/script>/g, /<style[^>]*>[\s\S]*?<\/style>/g]) {
          const matches = rest.match(re);
          if (!matches || matches.length === 0) continue;
          const biggest = matches.reduce((a, b) => (b.length > a.length ? b : a));
          // A tag with a `src`/`href` is a real request the browser should
          // discover early, and the small boot-shell style must stay put.
          if (biggest.length < 50_000) continue;
          rest = rest.replace(biggest, "");
          blocks.push(biggest);
        }
        if (blocks.length === 0 || !rest.includes("</body>")) continue;
        // Stylesheet first so the game's own CSS is applied before its script
        // runs, exactly as it was in `<head>`.
        blocks.reverse();
        file.source = rest.replace("</body>", `${blocks.join("\n    ")}\n  </body>`);
      }
    },
  };
}

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
    ...(singleFile ? [viteSingleFile(), bootShellFirst()] : [copyrightBanner()]),
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
    // `drop_console: true` stripped `console.error` too, which blinded the two
    // reporters that matter in the field — the frame-error handler and the boot
    // failure path — and left the Poki Inspector's console view empty on a real
    // crash. Drop the noise, keep the signal: `error` and `warn` survive,
    // everything else (including the gated telemetry `debug`) is removed.
    terserOptions: {
      compress: {
        drop_console: ["log", "info", "debug", "trace", "dir", "table", "group", "groupCollapsed", "groupEnd", "time", "timeEnd", "count", "assert"],
        drop_debugger: true,
      },
    },
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
