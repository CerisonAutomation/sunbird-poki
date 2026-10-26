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
 * Put the inlined bundle AFTER the boot shell instead of before it.
 *
 * `vite-plugin-singlefile` inlines the entire app into `<head>`, which puts the
 * 2.1 MB bundle in front of the boot loader. Module scripts are deferred, so
 * this was never an *execution* problem — it is a *parse* one: the HTML parser
 * has to stream past ~2.09 MB of script text before it reaches `<body>` and can
 * construct `#boot-shell` at all. The loader whose own comment promises "a cold
 * start on a slow connection is never a blank white page" therefore cannot
 * paint until the download is essentially complete — measured at body offset
 * 2,090,787 of a 2,098,928 byte file, i.e. 99.6% in. On a 1.5 Mbps phone that
 * is seconds of pure white before the loader appears.
 *
 * Moving the inlined `<style>` and `<script>` to the end of `<body>` lets the
 * parser build the shell immediately; the shell carries its own complete inline
 * CSS, so it renders correctly before any of this arrives. The app CSS is still
 * parsed before the script runs, so there is no unstyled flash once React
 * takes over.
 *
 * No-op when chunked (nothing is inlined) and when no assets are found.
 */
function inlineAssetsAfterBoot(): Plugin {
  const relocate = (html: string): string => {
    const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (!head || !body) return html;

    const moved: string[] = [];
    const strippedHead = head[1].replace(
      /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
      (tag) => {
        moved.push(tag);
        return "";
      },
    );
    if (moved.length === 0) return html;

    // Replacers MUST be functions. With a string replacement, `String.replace`
    // expands `$&`, `$'` and `` $` `` against the match — and the payload being
    // moved here is a megabyte of minified CSS/JS that is dense with `$`, so a
    // string replacement silently spliced copies of the document into itself
    // and grew the output by tens of kilobytes.
    return html
      .replace(head[0], () => `<head>${strippedHead}</head>`)
      .replace(body[1], () => `${body[1]}\n${moved.join("\n")}\n`);
  };

  return {
    name: "sunbird-inline-assets-after-boot",
    apply: "build",
    enforce: "post",
    // generateBundle, NOT transformIndexHtml: vite-plugin-singlefile injects
    // the inlined CSS from generateBundle, which runs after every
    // transformIndexHtml hook — a hook-based version silently relocated the
    // script and left all 427 KB of stylesheet sitting in front of the loader.
    // Being later in the plugin array than viteSingleFile is what makes this
    // see the finished HTML.
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".html") && typeof file.source === "string") {
          file.source = relocate(file.source);
        }
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
    ...(singleFile ? [viteSingleFile(), inlineAssetsAfterBoot()] : [copyrightBanner()]),
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
      // The multiplayer transport is swapped per portal, exactly like Payments —
      // and until this line existed it was NOT swapped at all.
      //
      // `net-transport.poki.ts` documented that this swap would happen here, and
      // nothing in this file ever did it. So the Poki build resolved
      // `import ... from "./net-transport"` to the NEUTRAL module, whose
      // `createNetTransport` builds a WebSocket client — against a
      // `VITE_MULTIPLAYER_URL` that `build:poki` deliberately empties. The
      // Netlib module was never imported by anything: live PvP could not run,
      // every "live" race silently degraded to the local AI flock, and no lobby
      // was ever created for the Netlib dashboard to show.
      "./net-transport": PORTAL === "poki"
        ? path.resolve(__dirname, "src/game/net-transport.poki.ts")
        : path.resolve(__dirname, "src/game/net-transport.ts"),
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
    // `drop_console: true` also removed console.error and console.warn, which
        // is the channel the crash journal, Poki's Inspector and the poki-artifact
        // CI job read when a submission misbehaves on real hardware. Debug noise is
        // still dropped; failures are not — a production build you cannot diagnose
        // is not a cheaper build, it is an unfixable one.
        terserOptions: { compress: { drop_console: ["log", "info", "debug", "trace"], drop_debugger: true } },
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
