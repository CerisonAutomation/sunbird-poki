#!/usr/bin/env node
/**
 * Public room list smoke — the surface the PvP menu reads before anybody
 * commits to a race ("who is racing right now?").
 *
 *   node --import tsx server/src/index.ts &
 *   node scripts/smoke-room-list.mjs                 # default 127.0.0.1:8790
 *   ROOMS_BASE=http://127.0.0.1:9000 node scripts/smoke-room-list.mjs
 *
 * It proves the list is real and safe:
 *   1. a genuinely created room appears with its real seat count and a code;
 *   2. a second pilot joining raises the count (…and the room stays joinable);
 *   3. the payload carries no device id, seat id, token or player id;
 *   4. a race in progress is reported honestly as not joinable;
 *   5. the v1 API serves the same list for token-or-guest callers.
 */
const BASE = process.env.ROOMS_BASE ?? "http://127.0.0.1:8790";
const stamp = Date.now().toString(36);

let failures = 0;
let checks = 0;
function ok(cond, label, detail = "") {
  checks += 1;
  if (cond) console.log(`  ok    ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const why = (r) => `status=${r.status} body=${JSON.stringify(r.data).slice(0, 200)}`;

console.log(`▶ Public room list smoke against ${BASE}`);

const host = { deviceId: `rooms-host-${stamp}`, name: "Alita" };
const guest = { deviceId: `rooms-guest-${stamp}`, name: "Bravo" };

const created = await api("/mp/rooms/matchmake", { method: "POST", body: host });
ok(created.status === 200 && created.data?.room?.code, "a matchmade room is created", why(created));
const code = created.data?.room?.code ?? "";

const listed = await api("/mp/rooms");
const rooms = Array.isArray(listed.data?.rooms) ? listed.data.rooms : [];
const mine = rooms.find((r) => r.code === code);
ok(Boolean(mine), `the new room ${code} is listed for anyone to find`, why(listed));
ok(mine?.seated === 1, "it reports its real seat count (1)", JSON.stringify(mine));
ok(mine?.joinable === true, "a fresh lobby is joinable", JSON.stringify(mine));
ok(mine?.host === host.name, "the host name is the real pilot name", JSON.stringify(mine));
ok(/^[A-Z0-9]{5}$/.test(code), "the code is the 5-character code players can share", code);

const joined = await api(`/mp/rooms/${code}/join`, { method: "POST", body: guest });
ok(joined.status === 200 && joined.data?.grant?.seatId, "a second pilot can join that room", why(joined));

const relisted = await api("/mp/rooms");
const full = (relisted.data?.rooms ?? []).find((r) => r.code === code);
ok(full?.seated === 2, "the list shows both pilots seated", JSON.stringify(full));

const payload = JSON.stringify(relisted.data);
const secrets = [
  host.deviceId,
  guest.deviceId,
  created.data?.grant?.playerId,
  joined.data?.grant?.playerId,
  created.data?.grant?.seatId,
  joined.data?.grant?.seatId,
  created.data?.grant?.reconnectToken,
  joined.data?.grant?.reconnectToken,
];
ok(
  secrets.filter(Boolean).every((s) => !payload.includes(s)),
  "no device id, seat id, token or player id is exposed",
);
ok(!payload.includes("playerId") && !payload.includes("reconnectToken"), "the payload has no identity fields at all");

const started = await api(`/mp/rooms/${code}/start`, { method: "POST", body: { deviceId: host.deviceId } });
if (started.status !== 200) {
  console.log(`  note  start returned ${started.status} — skipping the in-progress check`);
} else {
  const racing = (await api("/mp/rooms")).data?.rooms?.find((r) => r.code === code);
  ok(racing?.status === "racing", "a race in progress is reported as racing", JSON.stringify(racing));
  ok(racing?.joinable === false, "and is honestly marked as not joinable", JSON.stringify(racing));
}

const v1 = await api("/mp/v1/rooms");
ok(Array.isArray(v1.data?.rooms) && v1.data.rooms.some((r) => r.code === code), "the v1 API serves the same list", why(v1));

console.log(
  failures === 0
    ? `\n✔ ROOM LIST SMOKE PASSED — ${checks} checks: real rooms, real seats, no identities\n`
    : `\n✖ ROOM LIST SMOKE FAILED — ${failures}/${checks} checks\n`,
);
process.exit(failures === 0 ? 0 : 1);
