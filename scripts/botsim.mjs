#!/usr/bin/env node
/**
 * SUNBIRD botsim — N headless pilots on the real wire protocol.
 *
 * These are not stubs. Every bot is a genuine WebSocket client speaking the
 * same legacy frame vocabulary (`state` / `emote` / `ready` / `finish` up;
 * `welcome` / `peers` / `state` / `finish` / `start` down) as the shipped
 * browser client, so a run exercises the same room registry, the same 15 Hz
 * broadcast tick and the same server-assigned finish order that players hit.
 *
 * Four jobs, one binary:
 *   1. Load proof   — 40 concurrent pilots in one room, no crash, sane tick.
 *   2. Anti-cheat   — adversarial bots try teleports and absurd magnitudes;
 *                     honest bots watch whether the server relays them.
 *   3. Resume       — bots drop mid-race and must be re-seated with the same
 *                     identity, which is what makes a dropped tunnel free.
 *   4. Regression   — every run is seeded, so a failure is reproducible with
 *                     one line: `--seed <n>`.
 *
 * Usage:
 *   node scripts/botsim.mjs --url ws://127.0.0.1:8080/ws --players 40 --seconds 12
 *   node scripts/botsim.mjs --seed 1234 --cheaters 3 --require-anticheat
 *
 * Exit code is 0 only when every gate passes.
 */
import { WebSocket } from "ws";

/* ------------------------------- options -------------------------------- */

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

// Match the Node social server used by Vite's /mp proxy (and the Rust server
// on the same port). Override with --url for a deployed WSS endpoint.
const URL = opt("url", "ws://127.0.0.1:8790/mp");
const PLAYERS = Number(opt("players", 40));
const SECONDS = Number(opt("seconds", 12));
const SEED = opt("seed", String(Date.now()));
const CHEATERS = Number(opt("cheaters", 2));
const RESUMERS = Number(opt("resumers", 4));
const REQUIRE_ANTICHEAT = flag("require-anticheat");
const JSON_OUT = opt("json", "");

/** Wire rate the shipped client uses (`Realtime.ts` SEND_HZ). */
const SEND_HZ = 15;
/** Physics ceiling: MAX_SPEED_FEVER × wingboost 1.5 + BOOST_EXTRA_SPEED. */
const MAX_SPEED = 234;

/* Gate thresholds. Deliberately generous — these catch breakage, not jitter. */
const GATE = {
  connectRatio: 1.0,
  rosterRatio: 1.0,
  stateFramesP50Min: 20,
  frameIntervalP95Ms: 300,
  resumeRatio: 1.0,
  maxErrors: 0,
};

/** A single-frame peer jump beyond this is a teleport, not a flight. */
const TELEPORT_UNITS = MAX_SPEED * 4;
/** Anything past this is an absurd magnitude no track can produce. */
const ABSURD_UNITS = 1_000_000;

/* ------------------------------ determinism ----------------------------- */

/** mulberry32 — small, fast, and identical on every platform. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const percentile = (sorted, p) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

/* --------------------------------- bots --------------------------------- */

/**
 * Room seed decides which matchmaking room the bots land in.
 *
 * Default is namespaced (`botsim-<seed>`) so a load test can never wander into
 * a real player's race. Pass `--room-seed 2026-09-13` to join the public room
 * for that seed instead — that is how you fill a room you are sitting in with
 * live networked pilots. The browser derives its seed from `dateSeed()` in
 * `src/game/math.ts`, i.e. its own local YYYY-MM-DD.
 */
const ROOM_SEED = opt("room-seed", "");
const RUN_SEED = ROOM_SEED || `botsim-${SEED}`;

class Bot {
  constructor(index, role, rand) {
    this.index = index;
    this.role = role; // "honest" | "cheater" | "resumer"
    this.rand = rand;
    this.device = `bot-${SEED}-${index}`;
    this.name = `Bot${String(index).padStart(2, "0")}`;

    this.connected = false;
    this.welcomed = false;
    this.id = "";
    this.room = "";
    this.roomChanges = 0;
    this.welcomeIds = new Set();
    this.rosterMax = 0;
    this.stateFrames = 0;
    this.bytesRx = 0;
    this.frameGaps = [];
    this.finishPlace = 0;
    this.errors = [];
    this.leaks = [];
    this.resumed = false;
    this.dropped = false;

    this.x = 64;
    this.y = 20;
    this.rot = 0;
    this.seq = 0;
    this.lastFrameAt = 0;
    this.peerX = new Map();
    this.ws = null;
    this.sendTimer = null;
    this.raceStarted = false;
  }

  connect() {
    const q = new URLSearchParams({
      device: this.device,
      name: this.name,
      skin: "sunbird",
      hue: this.rand().toFixed(3),
      seed: RUN_SEED,
    });
    return new Promise((resolve) => {
      const ws = new WebSocket(`${URL}?${q}`);
      this.ws = ws;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      ws.on("open", () => {
        this.connected = true;
        // Do NOT start sending state frames until after the welcome frame
        // binds our seat. Frames sent on an unbound socket are rejected.
      });
      ws.on("message", (raw) => {
        const parsed = this.onMessage(raw);
        // Resolve the connect() promise only once the welcome frame arrives,
        // so callers (especially the resume path) know the seat is bound.
        if (parsed === "welcomed") done();
      });
      ws.on("error", (err) => {
        this.errors.push(String(err?.message ?? err));
        done();
      });
      // Guarded by identity: a stale socket closing must not stop the sender
      // belonging to the reconnect that replaced it, and must not resolve a
      // connect() promise that was already settled by a newer socket.
      ws.on("close", () => {
        if (this.ws === ws) this.stopSending();
        done();
      });
    });
  }

  startSending() {
    this.stopSending();
    this.sendTimer = setInterval(() => this.emitState(), 1000 / SEND_HZ);
  }

  stopSending() {
    if (this.sendTimer) clearInterval(this.sendTimer);
    this.sendTimer = null;
  }

  emitState() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const dt = 1 / SEND_HZ;

    if (this.role === "cheater") {
      // Alternate between the two cheats that matter: an absurd magnitude that
      // would poison every peer's interpolation buffer, and a teleport to the
      // finish line.
      const absurd = this.index % 2 === 0;
      this.x += absurd ? 0 : 50_000;
      this.send({
        type: "state",
        x: absurd ? 1e300 : this.x,
        y: absurd ? 1e300 : 20,
        r: absurd ? 1e300 : 0,
        d: absurd ? 1e300 : this.x,
      });
      return;
    }

    // A plausible glide: bounded speed, gently varying altitude and bank.
    const speed = MAX_SPEED * (0.35 + this.rand() * 0.45);
    this.x += speed * dt;
    this.y = 20 + Math.sin(this.x / 40) * 12;
    this.rot = Math.cos(this.x / 40) * 0.3;
    this.send({ type: "state", x: this.x, y: this.y, r: this.rot, d: this.x - 64 });

    if (this.rand() < 0.004) {
      this.send({ type: "emote", emote: "gliding" });
    }
    // Finish rate tuned so the field stays airborne long enough for the
    // mid-race drops to land and resume, but still produces natural finishes
    // within the configured test window. (~0.3% per frame × 15 Hz = ~3%/s.)
    if (!this.finishPlace && this.raceStarted && this.x > 2000 && this.rand() < 0.003) {
      this.send({ type: "finish", time: this.x / MAX_SPEED, d: this.x - 64 });
    }
  }

  send(obj) {
    try {
      // Attach a monotonically increasing seq for server-side rate/order
      // accounting. The gateway rejects frames without a valid seq advance.
      const withSeq = obj.type === "state" || obj.type === "heartbeat" ? { ...obj, seq: ++this.seq } : obj;
      this.ws.send(JSON.stringify(withSeq));
    } catch (err) {
      this.errors.push(`send: ${err?.message ?? err}`);
    }
  }

  onMessage(raw) {
    const text = raw.toString();
    this.bytesRx += text.length;

    const now = performance.now();
    if (this.lastFrameAt) this.frameGaps.push(now - this.lastFrameAt);
    this.lastFrameAt = now;

    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      this.errors.push("unparsable frame from server");
      return null;
    }

    switch (msg.type) {
      case "welcome": {
        this.welcomed = true;
        const prevId = this.id;
        const prevRoom = this.room;
        this.id = msg.id;
        this.room = msg.room ?? "";
        this.welcomeIds.add(msg.id);
        // Same identity after a drop is the whole point of the device id:
        // a reconnect must re-seat the SAME seat (same id), not create a new one.
        if (this.dropped && prevId && msg.id === prevId) this.resumed = true;
        // …and in the SAME room. A reconnect that lands in a different room on
        // the same seed is a stranded pilot: the flock is racing elsewhere and
        // this one sits in a fresh lobby that may start its own race (and hand
        // out its own P1). Both servers must put a blip back in its own race.
        if (this.dropped && prevRoom && this.room && this.room !== prevRoom) this.roomChanges++;
        // Now that the seat is bound it is safe to start sending state frames
        // and assert ready. Initial connect uses a short staggered ready so
        // not every bot presses "GO!" on the same tick; reconnect fires ready
        // immediately so the resumed seat doesn't block the field.
        this.startSending();
        const readyDelay = this.dropped ? 50 : 250 + this.index * 15;
        setTimeout(() => this.send({ type: "ready", ready: true }), readyDelay);
        return "welcomed";
      }
      case "peers":
        if (Array.isArray(msg.peers)) this.rosterMax = Math.max(this.rosterMax, msg.peers.length);
        break;
      case "start":
        this.raceStarted = true;
        break;
      case "state":
        // Only count racing snapshots (post-start) towards frame flow, not lobby rosters.
        if (this.raceStarted) this.stateFrames++;
        if (Array.isArray(msg.pilots)) this.watchForLeaks(msg.pilots);
        break;
      case "finish":
        if (msg.id === this.id) this.finishPlace = msg.place;
        break;
      case "error":
        this.errors.push(`server: ${msg.message}`);
        break;
      default:
        break;
    }
    return null;
  }

  /**
   * Cheat containment: did the server relay an impossible position to an
   * honest client? If it did, the fog is decorative and any client can read
   * (or write) the truth.
   */
  watchForLeaks(pilots) {
    if (this.role !== "honest") return;
    for (const row of pilots) {
      const [id, x, y, , d] = row;
      if (id === this.id) continue;
      const reason =
        Math.abs(x) > ABSURD_UNITS || Math.abs(y) > ABSURD_UNITS || Math.abs(d) > ABSURD_UNITS
          ? "absurd-magnitude"
          : null;
      if (reason) {
        this.leaks.push({ id, reason, x });
        continue;
      }
      const prev = this.peerX.get(id);
      if (prev !== undefined && Math.abs(x - prev) > TELEPORT_UNITS) {
        this.leaks.push({ id, reason: "teleport", x, prev });
      }
      this.peerX.set(id, x);
    }
  }

  /** Drop the socket mid-race, the way a mobile network would. */
  drop() {
    this.dropped = true;
    this.stopSending();
    this.lastFrameAt = 0;
    // Save the socket reference BEFORE nulling so the close handler can
    // correctly identify itself as the stale socket (and not touch the
    // replacement's sender).
    const old = this.ws;
    this.ws = null;
    try {
      old?.close();
    } catch {
      /* already gone */
    }
  }

  close() {
    this.stopSending();
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
  }
}

/* --------------------------------- run ---------------------------------- */

async function main() {
  const startedAt = Date.now();
  const base = hashSeed(SEED);
  const bots = [];

  for (let i = 0; i < PLAYERS; i++) {
    const role = i < CHEATERS ? "cheater" : i < CHEATERS + RESUMERS ? "resumer" : "honest";
    bots.push(new Bot(i, role, rng(base + i * 7919)));
  }

  console.log(
    `botsim: ${PLAYERS} pilots (${CHEATERS} cheaters, ${RESUMERS} resumers) → ${URL}\n` +
      `        seed=${SEED} room-seed=${RUN_SEED} duration=${SECONDS}s sendRate=${SEND_HZ}Hz`,
  );

  const connectedAt = Date.now();
  await Promise.all(bots.map((b) => b.connect()));
  const connectMs = Date.now() - connectedAt;

  // Let the room settle and fill before we start measuring.
  await sleep(1500);

  // Mid-race drops, spread across the middle 60% of the run so every one of
  // them both fires and has time to reconnect before the measurement window
  // closes. A drop scheduled past the end would never happen but would still
  // sit in the denominator, which is exactly the false failure this replaced.
  // The first drop needs to land AFTER the race start countdown (6s) has
  // elapsed so the resume gate actually exercises mid-race re-seats rather
  // than lobby-time reconnects. Spread drops across the middle 50% of the
  // racing window.
  const countdownMs = 6000;
  const settleMs = 1500;
  // Race window available for mid-race drops (after settle + countdown).
  const racingWindowMs = Math.max(3000, SECONDS * 1000 - settleMs - countdownMs - 1500);
  const resumers = bots.filter((b) => b.role === "resumer");
  const dropTimers = resumers.map((bot, i) => {
    // Spread drops across the middle 70% of the racing window, starting AFTER
    // the countdown completes so drops are genuinely mid-race.
    const offset = racingWindowMs * (0.15 + (0.7 * i) / Math.max(1, resumers.length));
    const at = settleMs + countdownMs + offset;
    return setTimeout(
      async () => {
        bot.drop();
        await sleep(350);
        await bot.connect();
      },
      at,
    );
  });

  // Wait for the full scheduled run so drops actually happen.
  await sleep(settleMs + countdownMs + racingWindowMs);
  dropTimers.forEach(clearTimeout);

  // Give the last frames and finish broadcasts time to arrive.
  await sleep(800);

  const elapsedSec = (Date.now() - startedAt) / 1000;
  bots.forEach((b) => b.close());
  await sleep(200);

  /* ------------------------------ aggregate ----------------------------- */

  const connected = bots.filter((b) => b.connected).length;
  const welcomed = bots.filter((b) => b.welcomed).length;
  const rosterMax = Math.max(0, ...bots.map((b) => b.rosterMax));
  const errored = bots.filter((b) => b.errors.length > 0);
  const errors = errored.flatMap((b) => b.errors.map((e) => `${b.name}: ${e}`));

  const frameCounts = bots.map((b) => b.stateFrames).sort((a, b) => a - b);
  const allGaps = bots.flatMap((b) => b.frameGaps).sort((a, b) => a - b);

  const finished = bots.filter((b) => b.finishPlace > 0);
  const places = finished.map((b) => b.finishPlace).sort((a, b) => a - b);
  const uniquePlaces = new Set(places);

  const droppedBots = bots.filter((b) => b.role === "resumer" && b.dropped);
  const resumed = droppedBots.filter((b) => b.resumed).length;
  const sameRoom = droppedBots.filter((b) => b.resumed && b.roomChanges === 0).length;

  const leaks = bots.flatMap((b) => b.leaks.map((l) => ({ observer: b.name, ...l })));
  const leakByReason = {};
  for (const l of leaks) leakByReason[l.reason] = (leakByReason[l.reason] ?? 0) + 1;

  const bytesRx = bots.reduce((n, b) => n + b.bytesRx, 0);
  const perClientKBps = bytesRx / Math.max(1, PLAYERS) / elapsedSec / 1024;

  const report = {
    seed: SEED,
    roomSeed: RUN_SEED,
    url: URL,
    players: PLAYERS,
    cheaters: CHEATERS,
    resumers: RESUMERS,
    durationSec: Number(elapsedSec.toFixed(2)),
    connectMs,
    connected,
    welcomed,
    rosterMax,
    stateFrames: {
      total: frameCounts.reduce((a, b) => a + b, 0),
      p50: percentile(frameCounts, 50),
      p95: percentile(frameCounts, 95),
      min: frameCounts[0] ?? 0,
    },
    frameIntervalMs: {
      p50: Number(percentile(allGaps, 50).toFixed(1)),
      p95: Number(percentile(allGaps, 95).toFixed(1)),
    },
    finish: { count: finished.length, unique: uniquePlaces.size },
    resume: { dropped: droppedBots.length, resumed, sameRoom },
    bandwidth: { totalKB: Number((bytesRx / 1024).toFixed(1)), perClientKBps: Number(perClientKBps.toFixed(2)) },
    cheatContainment: {
      leaks: leaks.length,
      byReason: leakByReason,
      samples: leaks.slice(0, 5),
    },
    errors: errors.slice(0, 20),
  };

  /* -------------------------------- gates ------------------------------- */

  const gates = [
    {
      name: "every bot connected",
      pass: connected / PLAYERS >= GATE.connectRatio,
      detail: `${connected}/${PLAYERS} in ${connectMs}ms`,
    },
    {
      name: "every bot was welcomed with a seat",
      pass: welcomed / PLAYERS >= GATE.connectRatio,
      detail: `${welcomed}/${PLAYERS}`,
    },
    {
      name: "all pilots visible in one room",
      pass: rosterMax / PLAYERS >= GATE.rosterRatio,
      detail: `roster max ${rosterMax}/${PLAYERS}`,
    },
    {
      name: "state frames flowing to every client",
      pass: (report.stateFrames.p50 ?? 0) >= GATE.stateFramesP50Min,
      detail: `p50 ${report.stateFrames.p50}, min ${report.stateFrames.min}`,
    },
    {
      name: "broadcast tick keeps its cadence",
      pass: report.frameIntervalMs.p95 <= GATE.frameIntervalP95Ms,
      detail: `p95 ${report.frameIntervalMs.p95}ms (target ${GATE.frameIntervalP95Ms}ms)`,
    },
    {
      name: "finish places are unique",
      pass: report.finish.unique === report.finish.count,
      detail: `${report.finish.unique} unique of ${report.finish.count} finishes`,
    },
    {
      name: "dropped pilots resume with the same identity",
      pass: droppedBots.length === 0 || resumed / droppedBots.length >= GATE.resumeRatio,
      detail: `${resumed}/${droppedBots.length} dropped and re-seated`,
    },
    {
      name: "dropped pilots resume into the same room",
      pass: droppedBots.length === 0 || sameRoom / droppedBots.length >= GATE.resumeRatio,
      detail: `${sameRoom}/${droppedBots.length} back in the room they were racing in`,
    },
    {
      name: "no socket or protocol errors",
      pass: errors.length <= GATE.maxErrors,
      detail: errors.length === 0 ? "clean" : errors.slice(0, 3).join(" | "),
    },
    {
      name: "cheats are contained by the server",
      pass: REQUIRE_ANTICHEAT ? leaks.length === 0 : true,
      optional: !REQUIRE_ANTICHEAT,
      detail:
        leaks.length === 0
          ? "no impossible position was relayed"
          : `${leaks.length} leaked (${Object.entries(leakByReason).map(([k, v]) => `${k}:${v}`).join(", ")})`,
    },
  ];

  /* -------------------------------- output ------------------------------ */

  console.log("\n— results ———————————————————————————————————————————");
  console.log(
    `  connected   ${connected}/${PLAYERS} (${connectMs}ms)   roster ${rosterMax}/${PLAYERS}`,
  );
  console.log(
    `  frames      total ${report.stateFrames.total}  p50 ${report.stateFrames.p50}  min ${report.stateFrames.min}`,
  );
  console.log(
    `  cadence     p50 ${report.frameIntervalMs.p50}ms  p95 ${report.frameIntervalMs.p95}ms`,
  );
  console.log(
    `  finish      ${report.finish.count} finishes, ${report.finish.unique} unique places`,
  );
  console.log(
    `  resume      ${resumed}/${droppedBots.length} re-seated after a mid-race drop ` +
      `(${sameRoom} in the same room)`,
  );
  console.log(`  bandwidth   ${report.bandwidth.perClientKBps} KB/s per client`);
  console.log(
    `  cheats      ${leaks.length === 0 ? "contained" : `${leaks.length} LEAKED`} ` +
      `(${REQUIRE_ANTICHEAT ? "gated" : "reported only — pass --require-anticheat to gate"})`,
  );
  if (errors.length) console.log(`  errors      ${errors.slice(0, 3).join(" | ")}`);

  console.log("\n— gates ————————————————————————————————————————————————");
  let failed = 0;
  for (const gate of gates) {
    const mark = gate.pass ? "PASS" : gate.optional ? "SKIP" : "FAIL";
    if (!gate.pass && !gate.optional) failed++;
    console.log(`  [${mark}] ${gate.name} — ${gate.detail}`);
  }

  if (JSON_OUT) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(JSON_OUT, JSON.stringify({ report, gates }, null, 2));
    console.log(`\n  report written to ${JSON_OUT}`);
  }

  const verdict = failed === 0 ? "PASS" : "FAIL";
  console.log(`\nbotsim: ${verdict} (${failed} gate${failed === 1 ? "" : "s"} failed, seed ${SEED})`);
  process.exit(failed === 0 ? 0 : 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("botsim crashed:", err);
  process.exit(2);
});
