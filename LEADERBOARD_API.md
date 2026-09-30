# Sunbird Leaderboard & Multiplayer Contract

Sunbird ships with the client half of both systems fully implemented. Each one
runs in a clearly-labelled offline mode until you point it at a server.

| Feature | Env var | Without it | With it |
| --- | --- | --- | --- |
| Global leaderboard | `VITE_LEADERBOARD_URL` | On-device board, badged **"On-device board"** in the UI | Worldwide ranking, badged **"Live global"** |
| Networked rivals | `VITE_MULTIPLAYER_URL` | Mass Race field is 40 local pilots | Real players occupy slots as they join |

The UI never presents device-only data as if it were worldwide. That labelling
is deliberate and should be kept.

> **The multiplayer half of this contract ships in the parent monorepo's
> `rust/` workspace** — not in this checkout. The self-hosted
> `sunbird-server` serves the legacy WebSocket protocol on
> `GET /ws` with server-authoritative finish order.
>
> **The leaderboard half ships in [`api/`](api/board.ts)** as Vercel Functions
> (`GET /api/board`, `POST /api/score`), persisted in Upstash Redis when
> `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set (in-memory fallback for
> previews). Any host that speaks this JSON also works — see the reference
> `server/sunbird-server.mjs` for an in-process implementation.

---

## 1. Leaderboard HTTP contract

Two endpoints. Any stack that speaks this JSON works (Workers, Lambda, Express…).

`GET /health` is the deployment readiness probe. Production returns `200` only
when Upstash Redis is configured and reachable; local/preview environments
return a `memory-preview` status so they cannot be mistaken for durable storage.

### `GET /board?scope=<global|daily|friends>&metric=<distance|altitude|perfects|coins>&device=<id>`

```jsonc
{
  "entries": [
    {
      "deviceId": "d1a2b3",
      "name": "Kestrel",
      "skin": "bluejay",
      "distance": 4210,
      "altitude": 268,
      "perfects": 21,
      "coins": 143,
      "date": "2026-02-14"
    }
  ],
  "rank": 37,     // the requesting device's rank (0 if unranked)
  "total": 128401 // total ranked pilots
}
```

Return entries already sorted by the requested `metric`, best first. 50 rows is
a good page size — the client renders what it receives.

### `POST /score`

Body is the run record:

```jsonc
{
  "deviceId": "d1a2b3",
  "name": "Kestrel",
  "skin": "bluejay",
  "distance": 4210,
  "altitude": 268,
  "perfects": 21,
  "coins": 143,
  "score": 6100,
  "seed": "2026-02-14",
  "mode": "daytrip",
  "date": "2026-02-14"
}
```

Respond `200` with any body. The client posts with `keepalive` and **ignores
failures on purpose** — the local record is already saved, so a player never
loses credit for a run because of a network blip.

### Server-side notes

- **Validate before trusting.** `seed` and `mode` are included so you can
  re-simulate or sanity-bound a submission. The client is not authoritative.
- Rate-limit by `deviceId` and IP; keep only each pilot's personal best per metric.
- `name` is player-supplied. The client escapes it on render, but sanitise on
  ingest too.

---

## 2. Multiplayer transport

`MassRace` accepts any object implementing `NetTransport`:

```ts
interface NetTransport {
  readonly connected: boolean;
  send(x: number, y: number, rotation: number, distance: number): void;
  poll(): RemoteSnapshot[];   // { id, name, x, y, rotation, finished? }
}
```

Wire it with `massRace.attachTransport(myTransport)`. When a snapshot arrives
for an unknown id, a local pilot slot is promoted to `remote` so the field size
stays constant mid-race. Remote birds are rendered with a rim highlight and
marked `⇄` in the standings.

**What is honest about the current build:** with no transport configured, the
40 rivals are local pilots running the *identical* `Bird.step()` physics on the
*identical* terrain, seeded so the race is reproducible. They are not scripted
paths or position lerps — they win and lose on their own timing. They are
labelled as squadron pilots, not as people.

A minimal authoritative server should:

1. Group players into rooms of ≤ 40 sharing one `seed`.
2. Broadcast position snapshots at 10–20 Hz (the client interpolates).
3. Own the finish order — never trust a client's "I won".

---

## 3. Tournaments

Tournaments are fully client-side and need no server:

- Two cups run per ISO week, chosen deterministically from the catalogue, so
  every device on the same week sees the same pairing.
- Divisions are fixed cut-offs (bronze → diamond) on a real run metric.
- Prizes grant through the same save APIs the shop uses, so a cup-won item is
  indistinguishable from a purchased one. Double-claiming is blocked.
- Weekly reset clears results; won cosmetics are permanent.

To make cups competitive rather than solo, submit cup scores to the same
leaderboard backend and rank them server-side.

## Submission signing (v1.1)

When both sides configure a shared salt, `POST /score` requires a `sig` field:

```
sig = hex(HMAC-SHA256(salt, `${deviceId}|${distance}|${score}`))
```

- **Server:** set `LEADERBOARD_SALT` in the Vercel Function environment (or a secret store); the self-hosted TS backend uses `SUNBIRD_LEADERBOARD_SALT`.
- **Client:** set `VITE_LEADERBOARD_SALT` at build time.
- **Production is fail-closed:** with `VERCEL_ENV=production` (or
  `NODE_ENV=production` on the TS backend) and no salt configured, the
  endpoint refuses all submissions with `503 leaderboard signing not
  configured` — a live board never runs unsigned. `GET /api/health`
  reports `signing: "enabled" | "absent"` so deployments can gate on it.
- **Previews/dev without a salt stay lenient** by design: those boards are
  memory-only and never rank globally. Whenever a salt IS configured — in
  any environment — unsigned or badly-signed posts are rejected with `403`.

Honest scope: the salt ships inside the client bundle, so signing deters
casual curl-spoofing, not determined reverse-engineering. A valid signature
means "the submitter has the game file", **not** "the run happened". The
server also enforces plausibility gates regardless of signature:

- `distance > 60,000 m` → `422 implausible distance`
- `score > distance × 40 + 50,000` → `422 implausible score`

## Write quota

`POST /score` allows **30 writes per minute per IP+deviceId** and answers
`429` beyond that. When Upstash is configured the quota is a shared `INCR`
counter, so the cap holds **fleet-wide** rather than per warm edge isolate —
the previous in-memory `Map` let a client that got load-balanced across
isolates exceed it in aggregate. The counter's TTL is attached only on the
first write of a window, so continued posting cannot pin the key open, and a
missing or malformed counter response falls back to the per-isolate window
instead of either rejecting legitimate writes or admitting them uncounted
(`null` means "could not check", never "count zero").

## What is still not tamper-proof

Storage health checks and a fleet-wide write quota are in place. True
tamper-proofing still requires **replay validation** — the server
re-deriving the distance and score by re-simulating the run from its seed and
input trace, instead of believing the submitted numbers. The fixed-step sim is
already a pure function of `(seed, per-tick inputs)`, which is what makes this
possible at all.

It is not built. The obstacle is not the 1P flight: that replays cheaply. It is
the 40-pilot mass race, where `dragMult` folds in the live field through
`massRace.draftFor`, so reproducing a run needs a server-side sim of every
bird in the race, not a tape. Until that exists, treat ranked seasons as
unverified for anything above casual score-farming, and do not describe a
signed score as evidence of a genuine flight. Tracked in ROADMAP.md.
