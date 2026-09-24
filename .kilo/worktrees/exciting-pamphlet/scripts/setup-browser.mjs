#!/usr/bin/env node
/**
 * Fetch a runnable Chromium for the browser gates (`pnpm test:policy`,
 * `pnpm test:artifact`, the e2e probes) in sandboxes where
 * `playwright install` is blocked (cdn.playwright.dev is unreachable) and no
 * system browser or NSS libraries exist.
 *
 * `@sparticuz/chromium` ships everything Chromium needs as brotli blobs — the
 * binary, the Amazon-Linux shared libraries (libnss3 & co.), SwiftShader and a
 * font set — so nothing has to be compiled.
 *
 *   node scripts/setup-browser.mjs [dir]        (default /tmp/spart)
 *
 * Then run the gates with:
 *
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE=<dir>/chromium \
 *   LD_LIBRARY_PATH=<dir>/lib \
 *   FONTCONFIG_FILE=<dir>/fonts.conf \
 *   pnpm test:policy
 *
 * fonts.conf looks in /tmp/fonts, so the fonts are copied there too.
 */
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync } from "node:fs";
import { get } from "node:https";
import path from "node:path";

const VERSION = "153.0.0";
const TARBALL = `https://registry.npmjs.org/@sparticuz/chromium/-/chromium-${VERSION}.tgz`;
const dir = path.resolve(process.argv[2] ?? "/tmp/spart");

mkdirSync(dir, { recursive: true });
const tgz = path.join(dir, "chromium.tgz");

if (!existsSync(tgz) || statSync(tgz).size < 1_000_000) {
  process.stdout.write(`↓ ${TARBALL}\n`);
  await new Promise((resolve, reject) => {
    const fetchTo = (url, redirects = 0) => {
      get(url, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location && redirects < 5) {
          res.resume();
          return fetchTo(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        const out = createWriteStream(tgz);
        res.pipe(out);
        out.on("finish", () => out.close(resolve));
        out.on("error", reject);
      }).on("error", reject);
    };
    fetchTo(TARBALL);
  });
}

const pkg = path.join(dir, "package");
rmSync(pkg, { recursive: true, force: true });
execFileSync("tar", ["xzf", tgz], { cwd: dir });

// The blobs are brotli; Node has the decoder built in.
const inflate = async ({ brotliDecompressSync }) => {
  for (const name of ["chromium", "fonts.tar", "swiftshader.tar", "al2023.tar"]) {
    const target = path.join(dir, name);
    if (existsSync(target) && statSync(target).size > 0) continue;
    const raw = readFileSync(path.join(pkg, "bin", `${name}.br`));
    writeFileSync(target, brotliDecompressSync(raw, { chunkSize: 1 << 26 }));
  }
};
await inflate(await import("node:zlib"));

for (const name of ["fonts.tar", "swiftshader.tar", "al2023.tar"]) {
  execFileSync("tar", ["xf", path.join(dir, name)], { cwd: dir });
}
execFileSync("chmod", ["+x", path.join(dir, "chromium")]);

// fonts.conf points at /tmp/fonts; put the bundled faces where it looks.
mkdirSync("/tmp/fonts", { recursive: true });
cpSync(path.join(dir, "fonts"), "/tmp/fonts", { recursive: true });

const version = execFileSync(path.join(dir, "chromium"), ["--version"], {
  env: { ...process.env, LD_LIBRARY_PATH: path.join(dir, "lib"), FONTCONFIG_FILE: path.join(dir, "fonts.conf") },
  encoding: "utf8",
}).trim();

process.stdout.write(`✓ ${version} at ${dir}/chromium\n`);
process.stdout.write(
  `  PLAYWRIGHT_CHROMIUM_EXECUTABLE=${dir}/chromium LD_LIBRARY_PATH=${dir}/lib FONTCONFIG_FILE=${dir}/fonts.conf pnpm test:policy\n`,
);
