#!/usr/bin/env node
/**
 * One-command leaderboard proof: `pnpm board:check`.
 *
 * Boots BOTH backends that speak the LEADERBOARD_API.md contract and runs
 * the live client suite (src/game/__tests__/board-live.test.ts) against each:
 *
 *   1. the reference server (server/sunbird-server.mjs — in-memory)
 *   2. the social server (server/src/index.ts — the FULL backend: identity,
 *      squads, saves, telemetry and now the persistent device board backed
 *      by the same Db file store as profiles and cloud saves)
 *
 * The REAL `Leaderboard` class submits and reads real HTTP in both runs,
 * asserting sorted entries, server rank/total and best-row-per-device
 * semantics. Everything is thrown away afterwards: scratch ports, no
 * persistence (SUNBIRD_PERSIST=0). Exit code is non-zero unless every
 * layer passes.
 *
 *   node scripts/board-check.mjs            # scratch ports 8796/8797
 *   BOARD_PORT=9011 SOCIAL_BOARD_PORT=9012 node scripts/board-check.mjs
 */
import { spawn } from "node:child_process";

const PORT = Number(process.env.BOARD_PORT || 8796);
const SOCIAL_PORT = Number(process.env.SOCIAL_BOARD_PORT || 8797);

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} → exit ${code}`))));
    child.on("error", reject);
  });
}

async function waitHealthy(base, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`${base} did not become healthy`);
}

async function withServer(label, base, spawnArgs, env) {
  const child = spawn(spawnArgs[0], spawnArgs.slice(1), {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...env },
  });
  let exited = false;
  child.on("exit", (code) => {
    exited = true;
    console.error(`(${label} exited, code ${code})`);
  });
  child.on("error", (err) => {
    exited = true;
    console.error(`(${label} failed to spawn: ${err.message})`);
  });
  try {
    await waitHealthy(base);
    console.log(`\n▶ live board suite against ${label}: ${base}\n`);
    await run("npx", ["vitest", "run", "src/game/__tests__/board-live.test.ts"], {
      VITE_LEADERBOARD_URL: base,
    });
    console.log(`\n✔ ${label} agrees with the client and the HTTP contract`);
  } finally {
    if (!exited) child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
  }
}

try {
  await withServer("reference server", `http://127.0.0.1:${PORT}`, [process.execPath, "server/sunbird-server.mjs"], {
    PORT: String(PORT),
  });
  await withServer("social server (persistent device board)", `http://127.0.0.1:${SOCIAL_PORT}`, [
    process.execPath,
    "--import",
    "tsx",
    "server/src/index.ts",
  ], { PORT: String(SOCIAL_PORT), HOST: "127.0.0.1", SUNBIRD_PERSIST: "0" });
  console.log("\n✔ BOARD CHECK PASSED — client, HTTP contract and BOTH backends agree");
} catch (err) {
  console.error(`\n✖ BOARD CHECK FAILED — ${err.message}`);
  process.exitCode = 1;
}
