import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { sunbirdSVG, sunSVG } from "./src/game/Sunbird";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build modes:
//   VITE_SINGLEFILE=true   → inline all JS/CSS into index.html (itch.io + portal zips)
//   VITE_PORTAL_TARGET=*   → portal build (always single-file: zips must be self-contained)
//   default                → chunked output (Vercel CDN, HTTP caching, PWA)
const PORTAL = (process.env.VITE_PORTAL_TARGET ?? "none").toLowerCase() || "none";
const VALID_PORTALS = ["none", "poki", "crazy", "crazygames", "generic"];
if (!VALID_PORTALS.includes(PORTAL)) {
  // Fail the build loudly — a typo'd portal target would silently ship a
  // build with the wrong SDK/monetization profile.
  throw new Error(`VITE_PORTAL_TARGET must be one of ${VALID_PORTALS.join("|")}, got "${PORTAL}"`);
}
const singleFile = process.env.VITE_SINGLEFILE === "true" || PORTAL !== "none";
const paymentAdapter = PORTAL !== "none" ? path.resolve(__dirname, "src/game/Payments.portal.ts") : undefined;

// Stub out non-target portal adapters at module resolution. Vite's
// resolve.alias matches import source strings, not resolved filesystem
// paths, so we register a tiny plugin that intercepts "./poki" /
// "./crazygames" relative imports from platform.ts and redirects them
// to _shim.ts when building for a different target. Without this the
// real adapter modules (with their "PokiSDK" / "shareableURL" method
// names / script URLs) end up in non-target bundles — inert, but flagged
// by portal scanners.
function portalShimPlugin(): Plugin {
  const shim = path.resolve(__dirname, "src/sdk/_shim.ts");
  return {
    name: "sunbird-portal-shim",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return null;
      // Match exactly the relative imports used by src/sdk/platform.ts (and
      // any other module under src/sdk) to pull in the portal adapters.
      // Using path-absolute comparison is robust against ./ vs no-ext etc.
      const base = path.basename(source);
      const dir = path.basename(path.dirname(importer));
      // Per-target edition strings (display name, portal-note, labels). Same
      // reasoning as the adapters: a shared ternary on the runtime portal name
      // embeds EVERY portal's name in EVERY bundle, and scanners flag a
      // competitor's name even in dead code. Each build gets exactly one file.
      if (base === "edition" || base === "edition.ts") {
        if (dir !== "game") return null;
        const edition =
          PORTAL === "poki"
            ? path.resolve(__dirname, "src/game/edition.poki.ts")
            : PORTAL === "crazy" || PORTAL === "crazygames"
              ? path.resolve(__dirname, "src/game/edition.crazy.ts")
              : PORTAL === "generic"
                ? path.resolve(__dirname, "src/game/edition.generic.ts")
                : null;
        return edition; // null => the neutral src/game/edition.ts
      }
      // Per-target legal disclosures (privacy sections + external-host table).
      // Same reasoning as the edition strings: one shared policy that lists
      // every target's hosts puts a competitor's name and endpoints into each
      // bundle, which fails verify:portals AND misinforms the player reading it.
      if (base === "legal.edition" || base === "legal.edition.ts") {
        if (dir !== "game") return null;
        const legalEdition =
          PORTAL === "poki"
            ? path.resolve(__dirname, "src/game/legal.edition.poki.ts")
            : PORTAL === "crazy" || PORTAL === "crazygames"
              ? path.resolve(__dirname, "src/game/legal.edition.crazy.ts")
              : PORTAL === "generic"
                ? path.resolve(__dirname, "src/game/legal.edition.generic.ts")
                : null;
        return legalEdition; // null => the direct/web src/game/legal.edition.ts
      }
      if (dir !== "sdk") return null;
      if (base === "poki" || base === "poki.ts") {
        if (PORTAL !== "poki") return shim;
      }
      if (base === "crazygames" || base === "crazygames.ts") {
        if (PORTAL !== "crazy" && PORTAL !== "crazygames") return shim;
      }
      return null;
    },
  };
}

/** Short commit sha, or null in a source-only checkout (no .git to ask). */
function gitShortSha(): string | null {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: __dirname, encoding: "utf8" }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

/* Build identity — deterministic on purpose. --------------------------------
 *
 * This used to be `Date.now().toString(36)`, described as a service-worker
 * cache stamp. The worker has since become a retirement shim (public/sw.js
 * deletes `sunbird-shell-*` caches and reads nothing), and no module ever
 * imported the define — so the id was dead weight that changed on *every*
 * build. That is the worst of both worlds: a "version" that moves when the code
 * did not (non-reproducible zips, a moving target for the server's
 * SUNBIRD_CLIENT_BUILD pin, leaderboard rows nobody can attribute) and no
 * identity at all when the code did change.
 *
 * Now it is derived from what actually changed: package.json's semver, the
 * portal target, and the commit. Same commit + same target = same id, so
 * rebuilds are comparable and a score, a crash report or an uploaded zip can be
 * tied back to the code that produced it. Vercel injects the sha as an env var;
 * `SUNBIRD_BUILD_SHA` overrides for release builds cut outside git.
 *
 * `docs/VERSIONS.md` is the inventory of every version identifier in the repo,
 * and `src/game/__tests__/version-lockstep.test.ts` fails the build when any two
 * of them disagree. */
const APP_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string })
  .version;
const GIT_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SUNBIRD_BUILD_SHA ?? gitShortSha() ?? "dev").slice(0, 8);
const BUILD_ID = `${APP_VERSION}-${PORTAL}-${GIT_SHA}`;

// Stamp a short copyright notice onto every emitted chunk. Rollup's
// `output.banner` is not honoured through Vite's output pipeline (verified: it
// produced no notice at all), so do it explicitly. This is an honest legal
// notice plus a mild deterrent — it is NOT a substitute for real protection,
// which is not achievable for client-side JS.
function copyrightBanner(): Plugin {
  const notice =
    "/*! Sunbird \u00a9 Cerison. All rights reserved. Unauthorised copying, redistribution or resale is prohibited. */";
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
  // Relative base: portals (Poki GDN, CrazyGames CDN) serve builds from deep
  // subpaths — any absolute /asset URL 404s there. "./" works everywhere.
  base: "./",
  plugins: [
    {
      name: "sunbird-boot-mark",
      transformIndexHtml(html) {
        // Inline the SAME artwork as the menu before any JS or assets arrive.
        let out = html
          .replace("<!-- BOOT_SUN -->", sunSVG({ size: 84, className: "boot-sun" }))
          .replace("<!-- BOOT_BIRD -->", sunbirdSVG({ width: 58, className: "boot-bird", animateWings: true }));
        // Portal builds: strip the itch.io og:url meta so the bundle is
        // self-contained with no third-party host references. Inspector
        // scans the HTML; a stray meta pointing off-portal can trigger the
        // External Resources warning even though it's never fetched.
        if (PORTAL !== "none") {
          out = out.replace(/<meta\s+property=["']og:url["'][^>]*>/i, "");
          out = out.replace(/<link[^>]*rel=["'](?:preload|canonical|alternate)["'][^>]*href=["']https?:\/\/[^>]+>/gi, "");
        }
        return out;
      },
    },
    react(),
    tailwindcss(),
    portalShimPlugin(),
    ...(singleFile ? [viteSingleFile()] : []),
    ...(singleFile ? [] : [copyrightBanner()]),
  ],
  server: {
    host: true,
    allowedHosts: true,
    // Real multiplayer + social: the browser talks to the SAME origin and
    // vite tunnels to the Sunbird social server (server/, default :8791).
    // Identity paths: that server mounts legacy + v1 under /mp and the
    // legacy social REST under /social. No hardcoded hosts anywhere —
    // MULTIPLAYER_PROXY_TARGET / SOCIAL_PROXY_TARGET override per machine.
    proxy: {
      "/mp": {
        target: process.env.MULTIPLAYER_PROXY_TARGET || "http://127.0.0.1:8790",
        ws: true,
        changeOrigin: true,
      },
      "/social": {
        target: process.env.SOCIAL_PROXY_TARGET || "http://127.0.0.1:8790",
        changeOrigin: true,
      },
      // Global leaderboard & score-submission endpoints live at the social
      // server root. Proxy them so dev can hit the board without CORS fuss.
      "/board": {
        target: process.env.SOCIAL_PROXY_TARGET || "http://127.0.0.1:8790",
        changeOrigin: true,
      },
      "/score": {
        target: process.env.SOCIAL_PROXY_TARGET || "http://127.0.0.1:8790",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      ...(paymentAdapter ? { "./Payments": paymentAdapter } : {}),
    },
  },
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(BUILD_ID),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
    "import.meta.env.VITE_GIT_SHA": JSON.stringify(GIT_SHA),
    // Freeze the portal target to a compile-time constant so Rollup can
    // statically fold `TARGET === "poki"` / `TARGET === "crazy"` branches
    // and strip non-target SDK URLs / branches (e.g. Poki Netlib dynamic
    // import) from the output entirely.
    "import.meta.env.VITE_PORTAL_TARGET": JSON.stringify(PORTAL),
    // Inline SELL_AD_REMOVAL so Rollup/Terser DCEs IAP purchase UI from portal
    // builds (Poki REQ-20). Must stay in sync with edition.*.ts values.
    // NOTE: We define the bare identifier too (not just import.meta.env.*) so
    // Rollup replaces every reference in expressions before bundling. The
    // cross-module import form is not constant-folded by Rollup, leaving dead
    // strings ("Remove breaks", "No sponsored breaks") in the bundle.
    // preventAssignment:true (Vite default) means import/export bindings are
    // NOT replaced, only expression usages — so edition exports still compile.
    // Simulated sponsored breaks are a DEV-ONLY rehearsal of the ad-state UI,
    // never a shipped experience. The direct build has no ad network wired in,
    // so a "simulated" break pauses a run to show "Your ad is loading… Skip in 3"
    // for nothing — and the Gold pitch would then be selling the removal of a
    // break that was never an ad. Off by default; `VITE_SIM_BREAKS=true pnpm dev`
    // to exercise the flow. Portals own their own ad scheduling (REQ-20), so the
    // flag is pinned false for every portal target regardless of the env var.
    "import.meta.env.VITE_SIM_BREAKS": JSON.stringify(PORTAL === "none" && process.env.VITE_SIM_BREAKS === "true"),
    "import.meta.env.VITE_SELL_AD_REMOVAL": JSON.stringify(PORTAL === "none"),
  },
  build: {
    // Keep production bundles lean and avoid publishing source maps that
    // expose the original project structure to casual scrapers.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Portal/itch builds are inlined into a single HTML file by
        // vite-plugin-singlefile, so splitting there is pointless at best and
        // breaks the self-contained artefact at worst. Only the chunked
        // (Vercel/CDN) build gets a vendor split — three.js alone is the bulk
        // of the bundle, so isolating it lets app-only deploys reuse the
        // cached vendor chunk instead of re-downloading everything.
        ...(singleFile
          ? {}
          : {
              manualChunks: {
                three: ["three"],
                react: ["react", "react-dom"],
                audio: [
                  "./src/game/Audio.ts",
                  "./src/game/Music.ts",
                ],
                // Net bundle: only the WebSocket multiplayer transport and
                // MassRace (which consumes it). Deliberately excludes
                // src/sdk/platform.ts and src/game/PokiNetlib.ts so that
                // portal-specific code (Poki SDK strings, @poki/netlib)
                // stays in its own chunks and Rollup's DCE can strip the
                // unused adapter path for each build target.
                net: [
                  "./src/game/Realtime.ts",
                  "./src/game/PokiMpUtils.ts",
                  "./src/game/MassRace.ts",
                  "./src/game/GhostNet.ts",
                  "./src/game/bufferUpdates.ts",
                ],
                social: [
                  "./src/game/Leaderboard.ts",
                  "./src/game/Squad.ts",
                  "./src/game/Tournaments.ts",
                ],
              },
            }),
      },
    },
  },
});
