/**
 * Where the flight postcard actually goes.
 *
 * `shareOrDownload` is a two-channel function and only one of its channels can
 * ever run in this repository:
 *
 *   • the NATIVE share sheet — `navigator.share({ files })`, the Poki path;
 *   • the TEXT channels — clipboard, and a manual-copy dialog when the
 *     clipboard is refused.
 *
 * ...plus a third, the `<a download>` file handoff, which is gated on
 * `allowDownload`. That gate is the whole subject of this file.
 *
 * WHY THE GATE IS A BUILD CONSTANT, and why the previous coverage was theatre:
 * `vite.config.ts` pins `VITE_PORTAL_TARGET` to the literal `"poki"` for every
 * `vite build` ("sunbird-poki is always the Poki portal build"), and
 * `poki-build-ids.test.ts` pins that literal so it cannot drift. So
 * `Game.shareRun` always calls `shareOrDownload(card, undefined,
 * !this.portalEnabled())` with `allowDownload === false`, the anchor is never
 * created, and an e2e spec that waited for a PNG download from the shipped
 * bundle was waiting for a build this repository cannot produce. The download
 * branch below was therefore shipped, reachable from nothing, and covered by
 * nothing. These tests give it real coverage on both sides of the gate, and pin
 * the call site so the Poki bundle cannot silently start shipping downloads
 * (portal QA flags them — the reason the parameter exists at all).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { shareOrDownload, type ShareCard } from "../Social";

/** Read a repo source file (vitest runs from the workspace root). */
function src(...parts: string[]): string {
  return readFileSync(join(process.cwd(), "src", ...parts), "utf8");
}

/** The full statement starting at `marker`, so multi-line gates are caught. */
function statement(text: string, marker: string): string {
  const at = text.indexOf(marker);
  expect(at, `expected to find ${marker}`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf(";", at);
  return text.slice(at, end === -1 ? at + 400 : end + 1);
}

/**
 * Every anchor the code under test activates, in order. Spying rather than
 * stubbing the whole method keeps the assertion on the real element the real
 * code built — `download`, `href` and all — instead of on the arguments a
 * rewrite happened to pass somewhere else.
 */
function activatedAnchors(): HTMLAnchorElement[] {
  const clicked: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
  return clicked;
}

/** The card a finished run hands to the share pipeline. */
function card(overrides: Partial<ShareCard> = {}): ShareCard {
  return { blob: new Blob(["png"], { type: "image/png" }), dataUrl: "data:image/png;base64,UExBQ0VIT0xERVI=", text: "I flew 900m in Sunbird" , ...overrides };
}

/** A clipboard that works. */
function workingClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  return { writeText: vi.fn().mockResolvedValue(undefined) };
}

/** A clipboard that refuses — the normal state inside a portal iframe. */
function refusingClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  return { writeText: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("share delivery, downloads allowed (a non-portal build)", () => {
  it("hands the player the postcard, named and carrying the card's own bytes", async () => {
    const anchors = activatedAnchors();
    vi.stubGlobal("navigator", { share: undefined, clipboard: workingClipboard() });

    expect(await shareOrDownload(card())).toBe("downloaded");

    // The player gets a real PNG file, under the documented name…
    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toBe("sunbird-flight.png");
    // …whose payload is the card that was just drawn, not a placeholder. A
    // wrong href here still produces a download; it produces the WRONG one.
    expect(anchors[0].getAttribute("href")).toBe("data:image/png;base64,UExBQ0VIT0xERVI=");
  });

  it("saves the file under the name the caller asked for", async () => {
    const anchors = activatedAnchors();
    vi.stubGlobal("navigator", { share: undefined, clipboard: workingClipboard() });

    expect(await shareOrDownload(card(), "sunset-run.png")).toBe("downloaded");
    expect(anchors[0].download).toBe("sunset-run.png");
  });

  it("still delivers the file when the clipboard is unavailable", async () => {
    // The download is the fallback for a build with no clipboard and no share
    // sheet. Letting a refused clipboard suppress it would be the same class of
    // bug as reporting a copy that never happened.
    const anchors = activatedAnchors();
    vi.stubGlobal("navigator", { share: undefined, clipboard: refusingClipboard() });

    expect(await shareOrDownload(card())).toBe("downloaded");
    expect(anchors).toHaveLength(1);
  });
});

describe("share delivery, downloads forbidden (the shipped Poki build)", () => {
  it("starts no download and never claims one happened when copying is denied", async () => {
    const anchors = activatedAnchors();
    const clipboard = refusingClipboard();
    vi.stubGlobal("navigator", { share: undefined, clipboard });

    expect(await shareOrDownload(card(), undefined, false)).toBe("unavailable");
    // "unavailable" is what makes the game open the manual-copy dialog rather
    // than toast a success. Assert the negative too: no file, no clipboard call.
    expect(anchors).toHaveLength(0);
    expect(clipboard.writeText).toHaveBeenCalledWith("I flew 900m in Sunbird");
  });

  it("reports a real copy and still starts no download", async () => {
    const anchors = activatedAnchors();
    const clipboard = workingClipboard();
    vi.stubGlobal("navigator", { share: undefined, clipboard });

    expect(await shareOrDownload(card(), undefined, false)).toBe("copied");
    expect(clipboard.writeText).toHaveBeenCalledWith("I flew 900m in Sunbird");
    expect(anchors).toHaveLength(0);
  });

  it("refuses to download even with no clipboard at all", async () => {
    const anchors = activatedAnchors();
    vi.stubGlobal("navigator", { share: undefined });

    expect(await shareOrDownload(card(), undefined, false)).toBe("unavailable");
    expect(anchors).toHaveLength(0);
  });
});

describe("share delivery, the native share sheet", () => {
  it("carries the PNG as a named file and starts no download behind it", async () => {
    const anchors = activatedAnchors();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true, clipboard: refusingClipboard() });

    expect(await shareOrDownload(card())).toBe("shared");

    const payload = share.mock.calls[0]![0] as ShareData;
    expect(payload.files).toHaveLength(1);
    expect(payload.files![0]!.name).toBe("sunbird-flight.png");
    expect(payload.files![0]!.type).toBe("image/png");
    expect(payload.text).toBe("I flew 900m in Sunbird");
    expect(anchors).toHaveLength(0);
  });

  it("falls through to the text channels when the platform cannot take files", async () => {
    const anchors = activatedAnchors();
    const share = vi.fn().mockResolvedValue(undefined);
    const clipboard = workingClipboard();
    // canShare says no: the share sheet exists but will not carry a PNG here.
    vi.stubGlobal("navigator", { share, canShare: () => false, clipboard });

    expect(await shareOrDownload(card(), undefined, false)).toBe("copied");
    expect(share).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(0);
  });
});

describe("the results screen's share call site", () => {
  it("asks the portal build flag before it is allowed to start a download", () => {
    // The download decision is a build constant in this repository, so the
    // call site is the only place the policy can be enforced. If this ever
    // stops being gated on the portal flag, the Poki zip starts initiating
    // downloads — the exact thing the parameter exists to prevent.
    const call = statement(src("game", "Game.ts"), "await shareOrDownload(card");

    expect(call).toContain("!this.portalEnabled()");
  });

  it("ships one edition, and it is the portal one", () => {
    // The premise of the assertion above. `poki-build-ids.test.ts` pins the
    // literal for the ids; this pins the consequence for the share path.
    expect(readFileSync(join(process.cwd(), "vite.config.ts"), "utf8")).toMatch(/const PORTAL = "poki";/);
  });
});

/**
 * The number a player PUBLISHES has to be the number they were credited with.
 *
 * `bird.asleep` only damps velocity, so the bird coasts for a couple of seconds
 * after the run ends, under the results card. The HUD already reads the frozen
 * `resultDistance` for that reason; the share card, the share text and the
 * challenge link did not, so a share could claim a longer flight than the
 * results card and the leaderboard submission beside it. The e2e catches the
 * symptom with a real flight; these pin the cause, so the regression is cheap
 * to see and cannot come back through a fourth call site unnoticed.
 */
describe("every surface reports the same run distance", () => {
  const game = src("game", "Game.ts");

  it("freezes the number on the results screen instead of re-reading the bird", () => {
    const accessor = statement(game, "private reportedRunDistance(");

    expect(accessor).toContain(`this.state === "gameover" ? this.resultDistance : live`);
  });

  it("builds the share card from the reported distance, not the live bird", () => {
    // A live read here is what put "I flew 870m" next to a card that said
    // 851m — the game overstating a score in the one place it is viral.
    const share = statement(game, "const dist = this.reportedRunDistance(");

    expect(share).toContain("this.lastRunDistance()");
    expect(share).not.toContain("this.bird.x");
  });

  it("encodes the same reported distance into the challenge link", () => {
    // The mark a rival is asked to beat. Quoting the coasting bird made the
    // link unsatisfiable for anyone who could see the results card.
    const challenge = statement(game, "const dist = Math.max(1, Math.round(this.reportedRunDistance(");

    expect(challenge).toContain("this.lastRunDistance()");
  });

  it("renders the results card from the same accessor", () => {
    // One home for the number. The card was the one surface already reading
    // the frozen value; leaving its expression inline is how the share path
    // drifted away from it in the first place.
    expect(statement(game, "distance: this.reportedRunDistance(")).toContain("stats.distance");
  });
});
