# Uploading Sunbird to the Poki Inspector — runbook

Rule source: <https://developers.poki.com/guide/inspector> — *"If you are
accessing the Poki Inspector directly, **open your game's folder** to upload it
to the Poki Inspector."* and <https://sdk.poki.com/sdk-documentation> — *"simply
drag and drop your game folder that contains an `index.html` file."*

The Inspector takes a **folder**, and `index.html` must sit at the **root of the
folder you select**. Every "missing index.html" report is one of the four
mistakes in the table below.

## The 60-second version

```bash
pnpm upload:poki        # builds the game, packages it, and verifies the upload shape
```

Then drag **`poki-upload/`** (the folder itself) into <https://inspector.poki.dev/>.

## Authenticating the CLI (once per machine)

@poki/cli has no `login` subcommand — it authenticates as part of `poki upload`,
and it looks for a token in this order:

| Source | Notes |
|---|---|
| `POKI_UPLOAD_TOKEN` | The supported non-interactive path. Generate an upload token in Poki for Developers. |
| `POKI_ACCESS_TOKEN` | Deprecated; the CLI warns and uses it anyway. |
| `~/.config/poki/auth.json` | Written by the browser flow. `$XDG_CONFIG_HOME/poki/auth.json` if set; `%LOCALAPPDATA%\Poki` on Windows. Mode `600`. |

With no token it prints `authentication required, opening browser...`, opens
`https://app.poki.dev/signin/?cli=http://localhost:<port>`, waits for the
local callback, then exchanges the refresh token and writes `auth.json`
(`access_token` + `refresh_token` + `ttl`). Later runs re-read that file and
refresh silently on a 401, so the browser step happens once.

Because auth is triggered by `upload`, and `createZip` runs before the auth
call while the version POST runs after it, you can complete the login **without
publishing a version** by pointing at a throwaway build dir and a game id that
is not yours — auth lands in `auth.json`, then the POST is rejected:

```bash
mkdir -p /tmp/poki-auth-probe && echo '<!doctype html>' > /tmp/poki-auth-probe/index.html
pnpm exec poki upload --game 00000000-0000-0000-0000-000000000000 \
  --build-dir /tmp/poki-auth-probe --name cli-auth-probe
# → "authentication required, opening browser..."  (approve in the browser)
# → 403 permission-denied on the bogus game id; nothing published.
```

Verify without printing the secret:

```bash
ls -l ~/.config/poki/auth.json          # -rw------- 600
node -e 'console.log(Object.keys(require(process.env.HOME+"/.config/poki/auth.json")))'
```

## What each artifact is for

| Artifact | Produced by | Use it for |
|---|---|---|
| `poki-upload/` | `pnpm build:poki` (every build) | **The Inspector, and the CLI.** Select this folder: `index.html`, `icons/`, `fonts/`, `i18n/` and nothing else. `poki.json`'s `build_dir` names it, so `pnpm poki:upload` ships exactly this tree. |
| `sunbird-poki.zip` | `pnpm build:poki` | The archive equivalent — identical `index.html`, no wrapping directory. Use it for CDN/review pipelines that take an archive. |
| `dist-poki/` | vite (before packaging) | The raw build output. **Not an upload artifact** — it is the tree the packaging step tightens up, and it lacks the `SDK-01` head tag. Never point `build_dir` at it (`ROOT-09`). |
| `sunbird-crazy.zip`, `sunbird-generic.zip` | `pnpm build:portals` | Other portals. Never upload these to Poki (web exclusivity, `REQ-51`). |

`poki-upload/` and the zips are **generated** (git-ignored). There is no
hand-maintained copy to go stale — that was the bug behind the original
"missing index.html" report (see `REBUILD_REPORT.md` §10).

## Why "missing index.html" happens

| What gets dropped on the Inspector | What the tool sees | Fix |
|---|---|---|
| A `.zip` file (the drop zone is **folder-only**) | no folder, therefore no root `index.html` | drop the folder `poki-upload/` instead |
| A GitHub **"Download ZIP"** of the repository | everything wrapped in one `sunbird-main/` directory, so the html is a level down | don't upload the repo; use `poki-upload/` |
| The **repository folder** | the source `index.html`, which loads `/src/main.ts` — not the game | don't upload the repo; use `poki-upload/` |
| A **stale** `poki-upload/` snapshot (pre-2026-09-17 it was hand-committed and never refreshed by a build) | an older build | `pnpm build:poki` regenerates the folder; `pnpm verify:upload` proves it is current |
| Any folder whose `index.html` lives in a sub-directory | no root entry document | the entry document must be at the root of the selected folder |

## Putting the artifact online (for a URL-mode pass)

The Inspector opens a folder; when you want the same build reachable as a URL —
for a browser check on another device, or for the Inspector's URL mode — serve
the artifact itself rather than a dev server:

```bash
pnpm serve:upload        # http://localhost:4174/  ← the exact upload folder
```

`scripts/serve-upload.mjs` sends no `X-Frame-Options`, a permissive
`frame-ancestors *` and CORS, so the folder can be embedded by the Inspector
(`https://inspector.poki.dev/?game=external-<host>%2F`) as well as opened
directly; `/__status` lists every path the page requested, which is the
evidence for the external-resources rule. The zip is served from the same
origin at `/sunbird-poki.zip`.

Two rules of thumb: the tunnel/preview host in front of the server decides
whether the game can be framed, so test that before relying on URL mode — and
keep the Poki build off any public host, since the submission is
Poki-exclusive (`REQ-51`).

## The gate: `pnpm verify:upload`

`scripts/verify-upload.mjs` runs the Inspector's own first check locally and is
part of `pnpm poki:preflight`, and enforced in CI by the `portals` job:

| Check | What it proves |
|---|---|
| `ROOT-01` | `index.html` exists at the root of `poki-upload/` **and** inside `sunbird-poki.zip` |
| `ROOT-02` | the zip has no wrapping directory — entries are `index.html`, `icons/`, `fonts/`, `i18n/` |
| `ROOT-03` | the folder is **fresh**: it matches the hash recorded at packaging time, matches `dist-poki/index.html`, and is byte-identical to it over its final 4 KB (a stale snapshot fails here) |
| `ROOT-04` | only uploadable files are present — no `sw.js`, `manifest.webmanifest`, sourcemaps or dotfiles, in folder or zip |
| `ROOT-05` | zip and folder ship the same `index.html` (sha256) |
| `ROOT-06` | every local reference in the shipped html resolves inside the folder |
| `ROOT-07` | no other portal's markers (SDK global, CDN URL, edition string) leaked into the folder |
| `ROOT-08` | the folder keeps Poki's own integrations — Netlib, AUDS and the SDK |
| `ROOT-09` | `poki.json` points the CLI at `poki-upload/`, so **the tree that gets uploaded is the tree that was verified** |

`ROOT-01`–`ROOT-06` were **negative-tested** on 2026-09-17: editing the folder's
tail, renaming `index.html` away, and re-zipping with a wrapping directory each
make the gate exit non-zero with the matching message. `ROOT-09` was
negative-tested on 2026-09-22 by setting `poki.json`'s `build_dir` back to
`dist-poki`, which fails it with that exact message.

`ROOT-09` exists because the two paths can silently diverge. `poki.json`'s
`build_dir` is what `poki upload` ships, and it once named `dist-poki` (vite's
raw output) while every other check looked at `poki-upload/`. The gate stayed
green and the CLI pushed a tree that carried no `SDK-01` head script tag and a
dangling `manifest.webmanifest` link. Keep the two in step: if `build_dir` ever
has to move, move this gate with it.

## After the upload

The Inspector loads the build and auto-runs its modules. Walk them in this order
(the checklist lives in `SUBMISSION_CHECKLIST.md`, the rules in
`docs/poki/08-game-dev-tools.md`):

1. **Event Log** — `gameLoadingStarted → gameLoadingFinished → gameplayStarted`,
   then the rewarded-break sequence on a continue offer (`REQ-14`, `TOOL-02`).
2. **External Resources** — expect none beyond Poki's own CDN (`REQ-53`).
3. **Image Optimization** — the thumbnail is deliberately weight-optimised
   (`THB-10`); the inlined art is already in the bundle.
4. **Scaling Tests** — 640×360 / 836×470 / 1031×580 (`REQ-13`).
5. **Mobile mode** — scan the QR, fly one run, confirm the wake lock and the
   44 px touch target (`EN-02`, `DEV-03`).
6. **Warnings** tab — the three known categories are covered by
   `pnpm audit:zips` (no external URLs, no off-platform markers).
