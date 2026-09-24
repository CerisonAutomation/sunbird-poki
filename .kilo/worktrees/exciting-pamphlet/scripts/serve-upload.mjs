#!/usr/bin/env node
/**
 * Serves the EXACT Poki upload artifact (`poki-upload/`) over HTTP so it can be
 * opened in a real browser — three ways to use it:
 *
 *   1. Local sanity check — open http://localhost:4174/ and fly a run. This is
 *      the same single file Poki's Inspector loads, not a dev-server view.
 *   2. The sandbox live preview (bound to 0.0.0.0) — the same thing from a
 *      phone, over the tunnel URL.
 *   3. The Inspector's URL mode, which can load a game from a host:
 *        https://inspector.poki.dev/?game=external-<host>%2F
 *      For that the host must allow being framed — this server deliberately
 *      sends no `X-Frame-Options`, a permissive `frame-ancestors`, and CORS for
 *      good measure, so only the tunnel/proxy in front can stand in the way.
 *
 * It also serves `sunbird-poki.zip` (download) and `/__status` (what the page
 * requested — evidence that the artifact asks for nothing but itself).
 *
 * Usage: node scripts/serve-upload.mjs [port]
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const ROOT = "poki-upload";
const ZIP = "sunbird-poki.zip";
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4174);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
};

/** Frameable, cache-free, cross-origin-readable — what an Inspector needs. */
const OPEN = {
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": "frame-ancestors *",
  "Cache-Control": "no-store",
};

/** Every path the browser asked for, in order — the evidence for /__status. */
const requests = [];

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://placeholder");
  const pathname = decodeURIComponent(url.pathname);
  requests.push({
    at: new Date().toISOString(),
    path: pathname,
    ua: String(req.headers["user-agent"] ?? "").slice(0, 60),
  });

  const sendText = (status, message) => {
    res.writeHead(status, { ...OPEN, "Content-Type": "text/plain; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : message);
  };

  const sendFile = (file, extra = {}) => {
    if (!existsSync(file) || !statSync(file).isFile()) return sendText(404, `404 ${pathname}\n`);
    const size = statSync(file).size;
    res.writeHead(200, {
      ...OPEN,
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": size,
      ...extra,
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  };

  if (pathname === "/__status") {
    res.writeHead(200, { ...OPEN, "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        {
          artifact: ROOT,
          indexPath: `${ROOT}/index.html`,
          indexBytes: existsSync(path.join(ROOT, "index.html")) ? statSync(path.join(ROOT, "index.html")).size : 0,
          uploadManifest: existsSync(path.join(ROOT, "upload-manifest.json"))
            ? JSON.parse(readFileSync(path.join(ROOT, "upload-manifest.json"), "utf8"))
            : null,
          requests,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (pathname === `/${ZIP}`) {
    if (!existsSync(ZIP)) return sendText(404, `missing ${ZIP} — run pnpm build:poki\n`);
    return sendFile(ZIP, { "Content-Disposition": `attachment; filename="${ZIP}"` });
  }

  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(path.normalize(ROOT))) return sendText(403, `403 ${pathname}\n`);
  if (!existsSync(file)) {
    return sendText(404, `404 ${pathname}\nThe upload folder holds: index.html, icons/, fonts/, i18n/\n`);
  }
  sendFile(file);
});

server.listen(PORT, "0.0.0.0", () => {
  const index = path.join(ROOT, "index.html");
  console.log(`serving the Poki upload artifact from ${ROOT}/`);
  console.log(`  http://localhost:${PORT}/            ← the exact folder Poki's Inspector loads`);
  console.log(`  http://localhost:${PORT}/__status    ← what the page requested`);
  console.log(`  http://localhost:${PORT}/${ZIP}      ← the same build as a zip`);
  console.log(
    `  index.html ${existsSync(index) ? `${(statSync(index).size / 1048576).toFixed(2)} MB` : "MISSING — run pnpm build:poki"}`,
  );
});
