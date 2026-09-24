# Game thumbnail — extracted rules

Source: <https://developers.poki.com/guide/thumbnail>

The thumbnail is the game's store window: on the web it is frequently the only
thing a player sees before deciding to click.

## Impact

| ID | Kind | Rule |
|---|---|---|
| `THB-01` | requirement | **A high-quality thumbnail is essential for attracting players on the web.** |
| `THB-02` | requirement | **It must accurately reflect the game's content** — a store window that sets clear expectations. Misleading visuals hurt conversion rates and playtime. |
| `THB-03` | recommendation | **Embrace simplicity:** focus on a single clear foreground object, such as the main character or a key gameplay element. |
| `THB-04` | recommendation | **Keep it together:** for games that are part of a series, keep visual consistency across thumbnails so players recognise related titles. |

## Platform requirements

| ID | Kind | Rule |
|---|---|---|
| `THB-05` | requirement | **Deliver full-bleed square images, minimum 628 × 628 px.** |
| `THB-06` | requirement | **Do not cut corners** — rounded corners are applied automatically by the platform via an image mask; baked-in rounding, borders or letterboxing are wrong. |
| `THB-07` | requirement | **Details and typography must stay legible when scaled down** to the smallest tile sizes. |
| `THB-08` | requirement | **High contrast is vital** so the image stands out; avoid colour families close to the Poki Playground background **`#83FFE7`**, or the thumbnail blends into the page. |

## Submission-time extras (platform workflow)

These are not statements from this page but are required by the submission
workflow as captured in the earlier compliance pass
(`../audits/POKI_COMPLIANCE_AUDIT.md` §"Remaining human/submission actions"):

| ID | Kind | Rule |
|---|---|---|
| `THB-09` | requirement | A static thumbnail is required for the player-fit test; an **animated thumbnail (a 3–5 s gameplay loop shown on hover)** is required before global release. Recording it is a submission action, not a build artifact — the build must only be ready for it (the game is fully playable when embedded and captured). |
| `THB-10` | recommendation | Keep the delivered image weight sane: the Inspector warns about heavy images, so source PNGs should be optimised before upload. |

## How Sunbird applies this page

| Rule | Implementation |
|---|---|
| `THB-01`, `THB-02` | `assets/submission/sunbird-thumbnail-1024.png` is rendered from the game's own palette and dives: sky gradient, sun, island ridges and the bird in a mid-dive pose — the pose a player sees in the first five seconds. |
| `THB-03` | One foreground subject (the bird) against a two-layer background; no clutter, no screenshot chrome. |
| `THB-04` | A single hero pose and palette are used across icon sizes, the store card and the video frame, so the family reads as one series. |
| `THB-05` | 1024 × 1024 (≥ 628), square, full-bleed. |
| `THB-06` | No rounding, border or letterboxing is baked in; the platform mask does the rounding. |
| `THB-07` | Composition is checked at 628 px and at 128 px: the bird silhouette keeps ≥ 60 % of its contrast against the sky at both sizes (gate: `scripts/verify-thumbnail.mjs`). |
| `THB-08` | Measured against the playground colour: the shipped thumbnail's mean colour is far from `#83FFE7` in both hue family and contrast; the gate fails a thumbnail whose dominant colour is within a small distance of it. |
| `THB-09`, `THB-10` | The game is embed-safe and capture-ready (no fullscreen requirement, no scroll hijack, fixed 16:9/portrait canvas); the static deliverable ships today and the animated capture is listed as a submission step. |

### Gate

```bash
pnpm verify:thumbnail    # PNG structure + every THB-05..THB-08 rule, exits non-zero on violation
```

The gate is also invoked by `pnpm poki:audit` as rule `THB-05`…`THB-08` so a
regenerated thumbnail can never silently violate the spec.
