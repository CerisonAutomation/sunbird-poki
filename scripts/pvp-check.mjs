#!/usr/bin/env node
/**
 * One-command PvP proof: `pnpm pvp:check`.
 *
 * Boots the real room server (the TypeScript backend on a scratch port), then
 * runs both levels of verification against it:
 *
 *   1. protocol smoke   — scripts/mp-smoke.mjs, two raw sockets, no browser
 *   2. live client suite — src/game/__tests__/pvp-live.test.ts, two real
 *                          RealtimeClient instances speaking the shipped
 *                          protocol to the same server
 *   3. pilot directory  — scripts/smoke-pilot-lookup.mjs, the route contract
 *                          behind the Pilot Lookup panel
 *
 * Everything is thrown away afterwards: scratch port, no persistence, no
 * touching a developer's running dev server. Exit code is non-zero unless
 * every layer passes, so this is safe to wire into CI or a release check.
 *
 *   node scripts/pvp-check.mjs            # scratch port 8795
 *   PVP_PORT=9001 node scripts/pvp-check.mjs
 */
import { spawn } from "node:child_process";
import net from "node:net";

const PORT = Number(process.env.PVP_PORT || 8795);
const BASE = `ws://127.0.0.1:${PORT}/mp`;
const cwd = process.cwd();
const children = new Set();

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    let out = "";
    child.stdout.on("data", (d) => {
      const s = String(d);
      out += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = String(d);
      out += s;
      process.stdout.write(s);
    });
    child.on("close", (code) => {
      children.delete(child);
      resolve({ code: code ?? 1, out });
    });
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: "127.0.0.1", port });
    const done = (ok) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(ok);
    };
    sock.on("connect", () => done(true));
    sock.on("error", () => done(false));
    sock.setTimeout(400, () => done(false));
  });
}

async function waitForServer(ms = 25000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await portOpen(PORT)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

console.log(`▶ PvP check — booting room server on 127.0.0.1:${PORT}`);
const server = spawn("node", ["--import", "tsx", "server/src/index.ts"], {
  cwd,
  env: { ...process.env, PORT: String(PORT), SUNBIRD_PERSIST: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
children.add(server);
server.stdout.on("data", () => {});
server.stderr.on("data", (d) => process.stderr.write(`  [server] ${d}`));

let failed = false;
try {
  if (!(await waitForServer())) throw new Error(`server never listened on ${PORT}`);
  console.log(`▶ Room server up (${BASE})\n`);

  console.log("▶ 1/3 protocol smoke (raw sockets)");
  const smoke = await run("node", ["scripts/mp-smoke.mjs", BASE]);
  if (smoke.code !== 0) {
    failed = true;
    console.log("✖ protocol smoke failed");
  } else {
    console.log("✔ protocol smoke passed\n");
  }

  console.log("▶ 2/3 live client suite (real RealtimeClient, same protocol)");
  const suite = await run("npx", ["vitest", "run", "src/game/__tests__/pvp-live.test.ts"], {
    VITE_MULTIPLAYER_URL: BASE,
  });
  if (suite.code !== 0) {
    failed = true;
    console.log("✖ live client suite failed");
  } else {
    console.log("✔ live client suite passed\n");
  }

  console.log("▶ 3/4 pilot directory (lookup, requests, presence)");
  const lookup = await run("node", ["scripts/smoke-pilot-lookup.mjs"], { LOOKUP_BASE: `http://127.0.0.1:${PORT}` });
  if (lookup.code !== 0) {
    failed = true;
    console.log("✖ pilot directory failed");
  } else {
    console.log("✔ pilot directory passed\n");
  }

  console.log("▶ 4/4 public room list (what the menu shows before you commit)");
  const rooms = await run("node", ["scripts/smoke-room-list.mjs"], { ROOMS_BASE: `http://127.0.0.1:${PORT}` });
  if (rooms.code !== 0) {
    failed = true;
    console.log("✖ public room list failed");
  } else {
    console.log("✔ public room list passed\n");
  }
} catch (err) {
  failed = true;
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
} finally {
  shutdown();
}

console.log(
  failed
    ? "\n✖ PvP CHECK FAILED"
    : "\n✔ PvP CHECK PASSED — server, protocol, two live clients, the pilot directory and the public room list agree",
);
process.exit(failed ? 1 : 0);
