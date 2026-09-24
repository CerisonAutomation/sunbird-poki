/**
 * End-to-end smoke test for the sunbird-social backend (server/src).
 *
 *   node scripts/smoke-social.mjs            # default base http://127.0.0.1:8790
 *   SMOKE_BASE=http://127.0.0.1:9000 node scripts/smoke-social.mjs
 *
 * Exercises: identity (guest + link), friends, v1 rooms + full WS race,
 * leaderboards (submit/quarantine/pagination), ghosts (publish/rival/
 * privacy/report-takedown), squads (roles/goal/shout), tournaments
 * (mod lifecycle + rewards + duplicate claim), saves (LWW + 409 conflict),
 * achievements, moderation (suspend propagation + rollback), and the
 * legacy WS protocol.
 */
import { WebSocket } from "ws";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:8790";
const WS_BASE = BASE.replace(/^http/, "ws");
const MOD_KEY = process.env.SMOKE_MOD_KEY ?? "sunbird-dev-moderation";

let failures = 0;
let checks = 0;
function ok(cond, label) {
  checks += 1;
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}
async function api(path, { method = "GET", body, token, mod } = {}) {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(mod ? { "x-moderator-key": mod } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let res = await doFetch();
  // Rate limiters are part of the contract — a well-behaved client retries.
  if (res.status === 429) {
    let data429 = null;
    try {
      data429 = await res.json();
    } catch {
      /* noop */
    }
    await sleep(Math.min(2000, data429?.retryAfterMs ?? 600));
    res = await doFetch();
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}
function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const client = { ws, frames: [], waiters: [] };
    ws.on("message", (data) => {
      let frame;
      try {
        frame = JSON.parse(String(data));
      } catch {
        return;
      }
      client.frames.push(frame);
      client.waiters = client.waiters.filter((w) => {
        if (w.pred(frame)) {
          w.fn(frame);
          return false;
        }
        return true;
      });
    });
    ws.on("error", reject);
    ws.on("open", () => resolve(client));
  });
}
/** Wait for the first frame matching `pred` (already-received or future). */
function waitFor(client, pred, ms = 6000) {
  return new Promise((resolve) => {
    const found = client.frames.find(pred);
    if (found) return resolve(found);
    const t = setTimeout(() => resolve(null), ms);
    client.waiters.push({
      pred,
      fn: (f) => {
        clearTimeout(t);
        resolve(f);
      },
    });
  });
}
const isFrame = (type) => (f) => f.type === type;
const isFrameById = (type, id) => (f) => f.type === type && f.id === id;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  /* --------------------------------------------------------------- health */
  console.log("health");
  let r = await api("/health");
  ok(r.status === 200 && r.data.ok === true, "GET /health");
  ok(r.data.players >= 0, "health reports players");

  /* ------------------------------------------------------------- identity */
  console.log("identity");
  r = await api("/mp/v1/identity/guest", { method: "POST", body: { deviceId: "smoke-a", name: "Alita" } });
  ok(r.status === 200 && r.data.created === true, "guest A created");
  const A = { id: r.data.playerId, token: r.data.token, code: r.data.profile.playerCode };
  r = await api("/mp/v1/identity/guest", { method: "POST", body: { deviceId: "smoke-a" } });
  ok(r.data.playerId === A.id && r.data.created === false, "guest A idempotent");
  r = await api("/mp/v1/identity/guest", { method: "POST", body: { deviceId: "smoke-b", name: "Bravo" } });
  ok(r.status === 200, "guest B created");
  const B = { id: r.data.playerId, token: r.data.token, code: r.data.profile.playerCode };
  r = await api("/mp/v1/identity/platform", {
    method: "POST",
    body: { platform: "crazygames", platformId: "cg-1", deviceId: "smoke-c", name: "Cora" },
  });
  ok(r.status === 200 && r.data.profile.guest === false, "platform identity upgrade");
  const C = { id: r.data.playerId, token: r.data.token, code: r.data.profile.playerCode };
  // Re-linking the same platform id merges into C, never a second account.
  r = await api("/mp/v1/identity/platform", {
    method: "POST",
    body: { platform: "crazygames", platformId: "cg-1", deviceId: "smoke-c2", name: "Cora2" },
  });
  ok(r.data.playerId === C.id, "platform identity merge on collision");
  r = await api(`/mp/v1/players/${A.code}`);
  ok(r.status === 200 && r.data.profile.displayName === "Alita", "lookup by exact player code");
  r = await api("/mp/v1/players/SUN-000000");
  ok(r.status === 404, "unknown code → 404");
  r = await api("/mp/v1/me", { token: A.token });
  ok(r.status === 200 && r.data.profile.playerId === A.id, "GET /me");
  r = await api("/mp/v1/me", { method: "PATCH", body: { displayName: "Alita A", privacy: { showOnLeaderboards: false } }, token: A.token });
  ok(r.data.profile.displayName === "Alita A" && r.data.profile.privacy.showOnLeaderboards === false, "PATCH /me (name + privacy)");
  r = await api("/mp/v1/me");
  ok(r.status === 401, "no token → 401");
  r = await api("/mp/v1/me", { method: "PATCH", body: { privacy: { showOnLeaderboards: true } }, token: A.token });
  ok(r.data.profile.privacy.showOnLeaderboards === true, "privacy restored");

  /* -------------------------------------------------------------- friends */
  console.log("friends");
  r = await api("/mp/v1/friends/request", { method: "POST", body: { code: B.code }, token: A.token });
  ok(r.status === 200 && r.data.status === "pending", "friend request A→B");
  const requestId = r.data.requestId;
  r = await api("/mp/v1/friends", { token: B.token });
  ok(r.data.pendingIn.some((x) => x.id === requestId), "B sees pending request");
  r = await api("/mp/v1/friends/respond", { method: "POST", body: { requestId, accept: true }, token: B.token });
  ok(r.status === 200, "B accepts");
  r = await api("/mp/v1/friends", { token: A.token });
  ok(r.data.friends.some((f) => f.playerId === B.id), "A lists B");
  r = await api("/mp/v1/friends/check/" + B.id, { token: A.token });
  ok(r.status === 200 && r.data.canInvite === true, "canInvite friend → true");
  r = await api("/mp/v1/friends/block", { method: "POST", body: { code: C.code }, token: A.token });
  ok(r.status === 200, "A blocks C");
  r = await api("/mp/v1/friends/check/" + C.id, { token: A.token });
  ok(r.status === 200 && r.data.canInvite === false, "blocked → cannot invite");

  /* ----------------------------------------------------------- v1 race WS */
  console.log("v1 rooms + race");
  r = await api("/mp/v1/rooms", { method: "POST", body: {}, token: A.token });
  ok(r.status === 200 && r.data.room.code.length === 5, "room created");
  const code = r.data.room.code;
  ok(r.data.grant.reconnectToken.startsWith("sbseat"), "seat grant with reconnect token");
  const wsA = await wsConnect(`${WS_BASE}/mp/v1/rooms/ws?token=${A.token}`);
  const hello = await waitFor(wsA, isFrame("hello"));
  ok(hello && hello.version === 1, "v1 hello frame");
  wsA.ws.send(JSON.stringify({ type: "join", version: 1, intentId: "i-1", roomCode: code, seed: r.data.room.seed, name: "Alita A", skin: "sunbird" }));
  let welcome = await waitFor(wsA, isFrame("welcome"));
  ok(welcome && welcome.grant.seatId === r.data.grant.seatId, "A seated (REST grant == WS grant)");
  // B joins via WS matchmaking into the same room.
  const wsB = await wsConnect(`${WS_BASE}/mp/v1/rooms/ws?token=${B.token}`);
  wsB.ws.send(JSON.stringify({ type: "join", version: 1, intentId: "i-2", roomCode: code, seed: "", name: "Bravo", skin: "bluejay" }));
  welcome = await waitFor(wsB, isFrame("welcome"));
  ok(welcome && welcome.room.pilots.length === 2, "B joined; roster shows 2 pilots");

  // Host starts; all-ready barrier should also start — use host start.
  wsA.ws.send(JSON.stringify({ type: "ready", version: 1, roomId: r.data.room.roomId, seatId: r.data.grant.seatId, ready: true }));
  wsB.ws.send(JSON.stringify({ type: "ready", version: 1, roomId: r.data.room.roomId, seatId: welcome.grant.seatId, ready: true }));
  const startedA = await waitFor(wsA, isFrame("started"), 10_000);
  ok(startedA && typeof startedA.startAt === "string", "started frame (ISO startAt)");
  const startedB = await waitFor(wsB, isFrame("started"), 10_000);
  ok(startedA && startedB && startedA.startAt === startedB.startAt && startedA.seed === startedB.seed, "identical start for both");

  // Fly: send movement (legacy state frames ride the v1 socket).
  const seats = { A: r.data.grant.seatId, B: welcome.grant.seatId };
  let seq = 0;
  const flyA = setInterval(() => {
    seq += 1;
    wsA.ws.send(JSON.stringify({ type: "state", x: seq * 2.2, y: 40 + Math.sin(seq / 5) * 10, r: 0.2, d: seq * 3.1 }));
  }, 80);
  const flyB = setInterval(() => {
    seq += 1;
    wsB.ws.send(JSON.stringify({ type: "state", x: seq * 1.6, y: 30, r: -0.1, d: seq * 2.4 }));
  }, 80);
  await sleep(1200);
  const snap = await waitFor(wsA, isFrame("snapshot"));
  ok(snap && snap.snapshot.pilots.length === 2, "snapshot with both pilots");
  ok(snap.snapshot.pilots.every((p) => Number.isFinite(p.x) && p.distance >= 0), "snapshot pilots bounded");

  // Reconnect mid-race: A's socket drops, the seat is kept for the grace
  // window, and A2 reclaims the SAME seat (generation bumps, progress kept).
  clearInterval(flyA);
  wsA.ws.close();
  await sleep(300);
  const wsA2 = await wsConnect(`${WS_BASE}/mp/v1/rooms/ws?token=${A.token}`);
  wsA2.ws.send(JSON.stringify({ type: "join", version: 1, intentId: "i-1b", roomCode: code, seed: r.data.room.seed, name: "Alita A", skin: "sunbird" }));
  const welcomeA2 = await waitFor(wsA2, isFrame("welcome"));
  ok(welcomeA2 && welcomeA2.grant.playerId === A.id, "A re-seated (grace window)");
  ok(welcomeA2 && welcomeA2.grant.seatId === seats.A, "reconnect keeps the same seat");
  ok(welcomeA2 && welcomeA2.grant.reconnectToken !== r.data.grant.reconnectToken, "generation bump rotates the reconnect token");
  const flyA2 = setInterval(() => {
    seq += 1;
    wsA2.ws.send(JSON.stringify({ type: "state", x: seq * 2.2, y: 40, r: 0.2, d: seq * 3.1 }));
  }, 80);
  await sleep(400);

  // A finishes first; server assigns place 1 to A.
  wsA2.ws.send(JSON.stringify({ type: "finish", time: 1200, d: 100 }));
  const finA = await waitFor(wsA2, isFrameById("finish", seats.A));
  ok(finA && finA.place === 1, "A wins place 1 (server-assigned)");
  wsB.ws.send(JSON.stringify({ type: "finish", time: 1250, d: 80 }));
  const finB = await waitFor(wsB, isFrameById("finish", seats.B));
  ok(finB && finB.place === 2, "B place 2");
  const resultsA = await waitFor(wsA2, isFrame("results"), 8000);
  ok(resultsA && resultsA.standings.length === 2, "results standings broadcast");
  clearInterval(flyA2);
  clearInterval(flyB);
  wsA2.ws.send(JSON.stringify({ type: "leave", version: 1, roomId: r.data.room.roomId, seatId: seats.A }));
  wsB.ws.send(JSON.stringify({ type: "leave", version: 1, roomId: r.data.room.roomId, seatId: seats.B }));
  wsA2.ws.close();
  wsB.ws.close();

  /* ---------------------------------------------------------- leaderboard */
  console.log("leaderboard");
  r = await api("/mp/v1/scores", {
    method: "POST",
    body: { runId: "run-A-1", distance: 980, altitude: 90, perfects: 6, coins: 140, score: 9000, durationMs: 62_000 },
    token: A.token,
  });
  ok(r.status === 200 && r.data.status === "accepted", "score accepted");
  r = await api("/mp/v1/scores", {
    method: "POST",
    body: { runId: "run-A-1", distance: 9999, altitude: 0, perfects: 0, coins: 0, score: 0, durationMs: 1000 },
    token: A.token,
  });
  ok(r.status === 200 && r.data.status === "duplicate", "duplicate runId → duplicate");
  r = await api("/mp/v1/scores", {
    method: "POST",
    body: { runId: "run-IMPOSSIBLE", distance: 400_000, altitude: 0, perfects: 0, coins: 0, score: 5_000_000, durationMs: 2000 },
    token: B.token,
  });
  ok(r.status === 200 && r.data.status === "quarantined", "implausible score quarantined");
  r = await api("/mp/v1/leaderboard?metric=distance&scope=global", { token: A.token });
  ok(r.status === 200 && r.data.entries.length >= 1 && r.data.entries.every((e) => e.distance <= 60_000), "board page (quarantine invisible)");
  ok(r.data.yourRank === 1, "yourRank computed");
  // Friends scope requires the friendship.
  r = await api("/mp/v1/leaderboard?metric=distance&scope=friends", { token: A.token });
  ok(r.status === 200 && r.data.entries.length >= 1, "friends scope");

  /* ---------------------------------------------------------------- ghosts */
  console.log("ghosts");
  const samples = [];
  for (let i = 0; i < 40; i++) samples.push([i * 0.1, i * 3, 40, 0.1]);
  r = await api("/mp/v1/ghosts", {
    method: "POST",
    body: { seed: "smoke-seed", track: "daily:smoke-seed", distance: 120, durationMs: 4000, samples },
    token: A.token,
  });
  ok(r.status === 200 && r.data.id, "ghost published");
  const ghostId = r.data.id;
  r = await api(`/mp/v1/ghosts/${ghostId}`, { token: A.token });
  ok(r.status === 200 && r.data.ghost.samples.length === 40, "owner fetches ghost");
  // Privacy: default replays=public? check the profile default — set friends only.
  await api("/mp/v1/me", { method: "PATCH", body: { privacy: { replays: "private" } }, token: A.token });
  r = await api(`/mp/v1/ghosts/${ghostId}`, { token: B.token });
  ok(r.status === 404, "private ghost hidden from B");
  await api("/mp/v1/me", { method: "PATCH", body: { privacy: { replays: "public" } }, token: A.token });
  // Rival: B gets a ghost near their own best (publish B's own run far away so A's is the rival).
  r = await api(`/mp/v1/ghosts/rival?seed=smoke-seed&near=110`, { token: B.token });
  ok(r.status === 200 && r.data.ghost && r.data.ghost.id === ghostId, "rival = A's ghost for B");
  r = await api(`/mp/v1/ghosts/rival?seed=smoke-seed&near=110`, { token: A.token });
  ok(r.data.ghost === null, "never your own ghost as rival");
  // Report takedown: 3 distinct reports auto-take-down.
  const r2 = await api("/mp/v1/identity/guest", { method: "POST", body: { deviceId: "smoke-d" } });
  const D = { id: r2.data.playerId, token: r2.data.token };
  for (const p of [B, D, C]) {
    await api(`/mp/v1/ghosts/${ghostId}/report`, { method: "POST", body: { reason: "suspicious" }, token: p.token });
  }
  r = await api(`/mp/v1/ghosts/${ghostId}`, { token: B.token });
  ok(r.status === 404, "ghost taken down after reports");

  /* ---------------------------------------------------------------- squads */
  console.log("squads");
  r = await api("/mp/v1/squads", { method: "POST", body: { name: "Smoke Squad", emblem: "🐦", visibility: "public" }, token: A.token });
  ok(r.status === 200 && r.data.squad.ownerId === A.id, "squad created (A owner)");
  const squadId = r.data.squad.id;
  r = await api(`/mp/v1/squads/${squadId}/join`, { method: "POST", body: {}, token: B.token });
  ok(r.status === 200 && r.data.status === "joined", "B joins public squad");
  r = await api(`/mp/v1/squads/${squadId}`, { token: B.token });
  ok(r.status === 200 && r.data.squad.members.length === 2 && r.data.goal.weekKey.length > 0, "squad view with weekly goal");
  r = await api(`/mp/v1/squads/${squadId}/shout`, { method: "POST", body: { emote: "🎉" }, token: B.token });
  ok(r.status === 200, "structured emote shout");
  r = await api(`/mp/v1/squads/${squadId}/shout`, { method: "POST", body: { emote: "🎉" }, token: B.token });
  ok(r.status === 429, "shout cooldown (anti-spam)");
  // Contribution: verified score submissions feed the squad goal. A is in
  // the squad now, so a fresh accepted run counts.
  r = await api("/mp/v1/scores", {
    method: "POST",
    body: { runId: "run-A-2", distance: 1040, altitude: 90, perfects: 6, coins: 140, score: 9000, durationMs: 62_000 },
    token: A.token,
  });
  ok(r.status === 200 && r.data.status === "accepted", "squad member run accepted");
  r = await api("/mp/v1/squads/" + squadId, { token: A.token });
  ok(r.data.goal.progress > 0, "contribution feeds weekly goal");
  // Role enforcement: B cannot appoint admins.
  r = await api(`/mp/v1/squads/${squadId}/role`, { method: "POST", body: { targetId: A.id, role: "admin" }, token: B.token });
  ok(r.status === 403, "non-owner role change → 403");

  /* ---------------------------------------------------------- tournaments */
  console.log("tournaments");
  r = await api("/mp/v1/tournaments", {
    method: "POST",
    body: {
      name: "Smoke Cup",
      metric: "distance",
      cuts: { bronze: 100, silver: 500, gold: 1000, diamond: 2000 },
      prizes: { bronze: { kind: "coins", id: "coins-b", amount: 50, label: "50 coins" } },
    },
    mod: MOD_KEY,
  });
  ok(r.status === 200 && r.data.tournament.phase === "registration", "moderator creates tournament");
  const tourId = r.data.tournament.id;
  for (const p of [A, B]) {
    r = await api(`/mp/v1/tournaments/${tourId}/register`, { method: "POST", body: {}, token: p.token });
    ok(r.status === 200, `${p.id.slice(2, 8)} registered`);
  }
  r = await api(`/mp/v1/tournaments/${tourId}/start`, { method: "POST", body: {}, mod: MOD_KEY });
  ok(r.status === 200 && r.data.tournament.phase === "active", "tournament started");
  r = await api(`/mp/v1/tournaments/${tourId}/result`, {
    method: "POST",
    body: { value: 1500, runId: "tour-A-1", distance: 1500, durationMs: 90_000 },
    token: A.token,
  });
  ok(r.status === 200 && r.data.best === 1500, "A submits 1500 (gold tier)");
  r = await api(`/mp/v1/tournaments/${tourId}/result`, {
    method: "POST",
    body: { value: 1500, runId: "tour-A-1" },
    token: A.token,
  });
  ok(r.status === 409, "duplicate tournament result rejected");
  r = await api(`/mp/v1/tournaments/${tourId}/standings`, { token: A.token });
  ok(r.status === 200 && r.data.standings[0].rank === 1 && r.data.standings[0].tier === "gold", "standings tiered");
  r = await api(`/mp/v1/tournaments/${tourId}/claim`, { method: "POST", body: {}, token: A.token });
  ok(r.status === 200 && r.data.granted === true && r.data.grant.tier === "gold", "A claims gold");
  r = await api(`/mp/v1/tournaments/${tourId}/claim`, { method: "POST", body: {}, token: A.token });
  ok(r.status === 200 && r.data.granted === false, "second claim denied (duplicate reward prevention)");
  // B posts a silver-tier result so the operator distribute has a real payout
  // (A's gold is already banked by the claim above — no double pay).
  r = await api(`/mp/v1/tournaments/${tourId}/result`, {
    method: "POST",
    body: { value: 600, runId: "tour-B-1", distance: 600, durationMs: 40_000 },
    token: B.token,
  });
  ok(r.status === 200 && r.data.best === 600, "B submits 600 (silver tier)");
  r = await api(`/mp/v1/tournaments/${tourId}/distribute`, { method: "POST", body: {}, mod: MOD_KEY });
  ok(r.status === 200 && r.data.granted === 1, "distribute pays only the unclaimed B silver");
  r = await api(`/mp/v1/tournaments/${tourId}/distribute`, { method: "POST", body: {}, mod: MOD_KEY });
  ok(r.status === 200 && r.data.granted === 0, "distribute idempotent");
  r = await api("/mp/v1/tournaments", { method: "POST", body: { name: "x" } });
  ok(r.status === 403, "create without moderator key → 403");

  /* ---------------------------------------------------------------- saves */
  console.log("saves");
  const save = JSON.stringify({ deviceId: "smoke-a", gold: 500, upgrades: [] });
  r = await api("/mp/v1/saves", { method: "PUT", body: { payload: save }, token: A.token });
  ok(r.status === 200 && r.data.version === 1, "save v1");
  r = await api("/mp/v1/saves", { method: "PUT", body: { payload: save, baseVersion: 1 }, token: A.token });
  ok(r.status === 200 && r.data.version === 2, "save v2 with baseVersion");
  r = await api("/mp/v1/saves", { method: "PUT", body: { payload: save, baseVersion: 1 }, token: A.token });
  ok(r.status === 409 && r.data.serverVersion === 2 && r.data.serverSave.version === 2, "conflict 409 with server copy");
  r = await api("/mp/v1/saves");
  ok(r.status === 401, "save read without token → 401");
  r = await api("/mp/v1/saves", { token: A.token });
  ok(r.status === 200 && r.data.save.version === 2, "save round-trip");

  /* --------------------------------------------------------- achievements */
  console.log("achievements");
  r = await api("/mp/v1/achievements/report", {
    method: "POST",
    body: { counters: { runsPlayed: 12, lifetimeDistance: 3200, lifetimeCoins: 260, bestAltitude: 120 } },
    token: A.token,
  });
  const ids = (r.data.newlyUnlocked ?? []).map((x) => x.id).sort();
  ok(ids.includes("flights_10") && ids.includes("coins_200") && ids.includes("dist_1k"), "achievements unlocked");
  r = await api("/mp/v1/achievements/report", {
    method: "POST",
    body: { counters: { runsPlayed: 5, lifetimeDistance: 3200, lifetimeCoins: 260 } },
    token: A.token,
  });
  ok(r.status === 200 && r.data.counters.runsPlayed === 12, "regressed counter rejected (kept 12)");
  r = await api("/mp/v1/achievements", { token: A.token });
  ok(r.status === 200 && r.data.progress.some((p) => p.id === "flights_10" && p.unlocked === true), "progress reflects unlocks");

  /* ------------------------------------------------------------- moderation */
  console.log("moderation");
  r = await api("/mp/v1/moderation/overview", { mod: MOD_KEY });
  ok(r.status === 200 && r.data.quarantinedScores >= 1, "overview counts quarantines");
  r = await api("/mp/v1/moderation/players/" + B.id + "/suspend", { method: "POST", body: { days: 1 }, mod: MOD_KEY });
  ok(r.status === 200, "B suspended");
  r = await api("/mp/v1/leaderboard?metric=distance&scope=global");
  ok(!r.data.entries.some((e) => e.playerId === B.id), "suspended B hidden from board");
  r = await api("/mp/v1/friends/request", { method: "POST", body: { code: A.code }, token: B.token });
  ok(r.status === 403, "suspended B cannot send requests");
  r = await api(`/mp/v1/moderation/scores/run-A-1/invalidate`, { method: "POST", body: { reason: "review" }, mod: MOD_KEY });
  ok(r.status === 200, "score rollback (run-A-1)");
  r = await api("/mp/v1/leaderboard?metric=distance&scope=global", { token: A.token });
  ok(!r.data.entries.some((e) => e.playerId === A.id && e.distance === 980), "rolled-back score gone from board");
  r = await api(`/mp/v1/moderation/players/${B.id}/restore`, { method: "POST", body: {}, mod: MOD_KEY });
  ok(r.status === 200, "B restored");
  r = await api("/mp/v1/moderation/audit", { mod: MOD_KEY });
  ok(r.status === 200 && r.data.entries.length > 0, "audit trail");
  r = await api("/mp/v1/moderation/overview");
  ok(r.status === 403, "moderation without key → 403");

  /* ------------------------------------------------------------- legacy ws */
  console.log("legacy protocol");
  const legacyCode = "ALEG1";
  const la = await wsConnect(`${WS_BASE}/mp?device=smoke-legacy-a&name=LegA&room=${legacyCode}`);
  const lw = await waitFor(la, isFrame("welcome"));
  ok(lw && lw.room === legacyCode, "legacy welcome");
  const lb = await wsConnect(`${WS_BASE}/mp?device=smoke-legacy-b&name=LegB&room=${legacyCode}`);
  await waitFor(lb, isFrame("welcome"));
  const peersA = await waitFor(la, (f) => f.type === "peers" && f.peers.length === 2);
  ok(peersA && peersA.peers.length === 2, "legacy peers frame");
  la.ws.send(JSON.stringify({ type: "ready", ready: true }));
  lb.ws.send(JSON.stringify({ type: "ready", ready: true }));
  const startL = await waitFor(la, isFrame("start"), 10_000);
  ok(startL && typeof startL.at === "number" && startL.seed, "legacy start frame (numeric at)");
  la.ws.send(JSON.stringify({ type: "state", x: 10, y: 20, r: 0.1, d: 10 }));
  lb.ws.send(JSON.stringify({ type: "state", x: 8, y: 18, r: 0.1, d: 8 }));
  const stateL = await waitFor(la, isFrame("state"), 3000);
  ok(stateL && Array.isArray(stateL.pilots) && stateL.pilots[0].length === 5, "legacy packed state frame");
  la.ws.send(JSON.stringify({ type: "finish", time: 900, d: 10 }));
  const finishL = await waitFor(la, isFrame("finish"), 8000);
  ok(finishL && finishL.place === 1, "legacy finish place");
  la.ws.close();
  lb.ws.close();

  /* ------------------------------------------------- legacy REST contract */
  console.log("legacy REST");
  r = await api("/mp/score", {
    method: "POST",
    body: { deviceId: "smoke-legacy-a", name: "LegA", distance: 1500, score: 4000, altitude: 50, perfects: 2, coins: 20 },
  });
  ok(r.status === 200 && r.data.ok === true, "POST /mp/score");
  r = await api("/mp/board?metric=distance&device=smoke-legacy-a");
  ok(r.status === 200 && r.data.entries.length >= 1 && r.data.rank >= 1, "GET /mp/board with rank");
  r = await api("/mp/session", { method: "POST", body: { deviceId: "smoke-legacy-a" } });
  ok(r.status === 200 && r.data.token.startsWith("sb1"), "POST /mp/session token");
  r = await api("/social/register", { method: "POST", body: { deviceId: "smoke-legacy-b" } });
  ok(r.status === 200 && r.data.ok === true, "POST /social/register");
  r = await api("/social/clubs?device=smoke-legacy-b");
  ok(r.status === 200 && Array.isArray(r.data.clubs), "GET /social/clubs");
  r = await api("/social/chat?club=1&device=smoke-legacy-b");
  ok(r.status === 410, "free-text chat retired (410)");

  console.log(`\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : " — all green"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exit(1);
});
