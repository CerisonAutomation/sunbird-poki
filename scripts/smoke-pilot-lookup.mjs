#!/usr/bin/env node
/**
 * Pilot Lookup end-to-end smoke — the exact routes the game's Pilot Lookup
 * panel calls (`/social/*`), against a real room server.
 *
 *   node --import tsx server/src/index.ts &
 *   node scripts/smoke-pilot-lookup.mjs            # default 127.0.0.1:8790
 *   LOOKUP_BASE=http://127.0.0.1:9000 node scripts/smoke-pilot-lookup.mjs
 *
 * It proves the panel is honest AND useful:
 *   1. an unknown code is a hard 404 — never an invented pilot;
 *   2. a real code resolves to the real pilot (name, code, presence, best);
 *   3. a wingman request shows up as pending for BOTH pilots;
 *   4. accepting it turns both into wingmen, with presence + best distance;
 *   5. a second add is reported as "already wingmen", not a new request.
 */
const BASE = process.env.LOOKUP_BASE ?? "http://127.0.0.1:8790";
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

/** Failure details always carry the HTTP status, so a red run is diagnosable. */
const why = (r) => `status=${r.status} body=${JSON.stringify(r.data).slice(0, 180)}`;

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
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

/** The client's device-scoped auth: the device id IS the credential (query
 *  parameter, because the browser WebSocket API cannot set headers). */
const dev = (id) => `?device=${encodeURIComponent(id)}`;

async function register(id, name) {
  // Guests start as "Sunbird Pilot"; the name is what the directory shows, so
  // the smoke sets a real one the same way the client does (session → PATCH).
  const r = await api("/social/register", { method: "POST", body: { deviceId: id, name } });
  if (r.status !== 200 || !r.data?.code) throw new Error(`register failed for ${id}: ${r.status}`);
  const session = await api("/mp/session", { method: "POST", body: { deviceId: id } });
  if (!session.data?.token) throw new Error(`session failed for ${id}: ${session.status}`);
  const named = await api("/mp/v1/me", {
    method: "PATCH",
    body: { displayName: name },
    token: session.data.token,
  });
  if (named.status !== 200) throw new Error(`rename failed for ${id}: ${named.status}`);
  return { device: id, code: r.data.code, name, token: session.data.token };
}

const A = await register(`lookup-a-${stamp}`, "Alita");
const B = await register(`lookup-b-${stamp}`, "Bravo");

console.log(`▶ Pilot lookup smoke — ${BASE}`);

// 1. Unknown code: a hard 404, no filler pilot.
const missing = await api(`/social/players/SUN-ZZZZZZ${dev(A.device)}`);
ok(
  missing.status === 404 && typeof missing.data?.error === "string" && !/no route/i.test(missing.data.error),
  "unknown code → 404 from the directory (no invented pilot)",
  why(missing),
);

// 2. Real code: the real pilot, with directory data.
const found = await api(`/social/players/${B.code}${dev(A.device)}`);
ok(found.status === 200, `lookup ${B.code} → 200`, why(found));
ok(found.data?.pilot?.name === "Bravo", "lookup returns the real display name", why(found));
ok(found.data?.pilot?.code === B.code, "lookup echoes the pilot's own code");
ok(typeof found.data?.pilot?.online === "boolean", "lookup reports real presence");
ok(typeof found.data?.pilot?.bestDistance === "number", "lookup reports a real best distance");
ok(found.data?.pilot?.friend === false, "new pilots are not wingmen yet");

// 3. Request, then both sides see it pending.
const add = await api("/social/friends/add", { method: "POST", body: { deviceId: A.device, code: B.code } });
ok(add.status === 200 && add.data?.status === "requested", "add returns 'requested', not 'added'", why(add));
ok(add.data?.friend?.name === "Bravo", "the request carries the real pilot name", why(add));

const outA = await api(`/social/friends/requests${dev(A.device)}`);
const inB = await api(`/social/friends/requests${dev(B.device)}`);
ok(outA.data?.outgoing?.length === 1 && outA.data.outgoing[0].name === "Bravo", "sender sees one outgoing request", why(outA));
ok(inB.data?.incoming?.length === 1 && inB.data.incoming[0].name === "Alita", "recipient sees one incoming request", why(inB));
const requestId = inB.data?.incoming?.[0]?.requestId;

// 4. Accept: both are wingmen, with real data.
const accept = await api("/social/friends/respond", { method: "POST", body: { deviceId: B.device, requestId, accept: true } });
ok(accept.status === 200 && accept.data?.status !== "pending", "accept succeeds", why(accept));

const profileA = await api(`/social/profile${dev(A.device)}`);
const profileB = await api(`/social/profile${dev(B.device)}`);
ok(profileA.data?.friends?.some((f) => f.name === "Bravo"), "sender's wingmen list contains the real pilot", why(profileA));
ok(profileB.data?.friends?.some((f) => f.name === "Alita"), "recipient's wingmen list contains the real pilot", why(profileB));
const wing = profileA.data?.friends?.find((f) => f.name === "Bravo");
ok(wing?.code === B.code, "wingman row keeps the verified code");
ok(typeof wing?.online === "boolean", "wingman row carries presence");

const again = await api("/social/friends/add", { method: "POST", body: { deviceId: A.device, code: B.code } });
ok(again.data?.status === "friends", "re-adding an existing wingman says so", why(again));

console.log(failures === 0 ? `\n✔ PILOT LOOKUP SMOKE PASSED (${checks} checks)` : `\n✖ PILOT LOOKUP SMOKE FAILED (${failures}/${checks})`);
process.exit(failures === 0 ? 0 : 1);
