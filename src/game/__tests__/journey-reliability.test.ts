import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenHistory } from "../ScreenHistory";
import { copyText, shareText } from "../Clipboard";
import { replayOptions, shouldRebuildCasualWorld } from "../Replay";
import { shareOrDownload } from "../Social";
import { hiddenByDisclosure } from "../Disclosure";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ""; });

describe("nested navigation", () => {
  it("goes back through the actual journey without duplicate refresh entries", () => {
    const history = new ScreenHistory<string>("main");
    for (const screen of ["live", "shop", "shop", "paywall", "checkout"]) history.visit(screen);
    expect(history.back()).toBe("paywall");
    history.visit("paywall");
    expect(history.back()).toBe("shop");
    expect(history.back()).toBe("live");
    expect(history.back()).toBe("main");
  });
  it("trims explicit parent navigation and resets at Home", () => {
    const history = new ScreenHistory<string>("main");
    for (const screen of ["shop", "paywall", "checkout", "paywall"]) history.visit(screen);
    expect(history.back()).toBe("shop");
    history.visit("main");
    expect(history.back()).toBe("main");
  });
});

describe("honest sharing", () => {
  it("reports success only after clipboard acknowledgement", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("code")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("code");
    expect(await shareText("code", false)).toBe("copied");
  });
  it("handles absent and denied clipboard APIs without rejecting", async () => {
    vi.stubGlobal("navigator", {});
    expect(await shareText("code", false)).toBe("unavailable");
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await copyText("code")).toBe(false);
  });
  it("does nothing after native share cancellation", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("Dismissed", "AbortError")), clipboard: { writeText } });
    expect(await shareText("code", true)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("falls back only for failed/unsupported sharing, not cancellation", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new Error("unsupported")), clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await shareText("code", true)).toBe("copied");
  });
  it("does not fabricate a portal image-share success when copying is denied", async () => {
    vi.stubGlobal("navigator", {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(await shareOrDownload({ blob: null, dataUrl: "data:image/png,", text: "code" }, undefined, false)).toBe("unavailable");
    expect(click).not.toHaveBeenCalled();
  });
  it("does not download or copy an image after the share sheet is cancelled", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new DOMException("Dismissed", "AbortError")), clipboard: { writeText } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(await shareOrDownload({ blob: new Blob(["image"]), dataUrl: "data:image/png,", text: "code" })).toBe("cancelled");
    expect(click).not.toHaveBeenCalled(); expect(writeText).not.toHaveBeenCalled();
  });
});

describe("replay rules", () => {
  const base = { duel: false, challenge: "", dailyDone: false, gauntletDone: [] as number[], event: false, storm: false };
  it.each([
    [{ challenge: "daily" }, { challenge: "daily" }],
    [{ challenge: "daily", dailyDone: true }, {}],
    [{ challenge: "gauntlet2" }, { challenge: "gauntlet2" }],
    [{ challenge: "gauntlet2", gauntletDone: [2] }, {}],
    [{ duel: true }, { duel: true }],
    [{ event: true }, { event: true }],
    [{ storm: true }, { storm: true }],
  ])("retains unfinished run configuration %j", (run, expected) => {
    expect(replayOptions({ ...base, ...run })).toEqual(expected);
  });
});

describe("replay keeps the course (so the ghost is a real opponent)", () => {
  const base = {
    replay: false,
    seedMode: "today",
    duel: false,
    challenge: "",
    event: false,
    storm: false,
    raceMode: false,
  };
  it("a replay never rebuilds the world — the same hills come back", () => {
    expect(shouldRebuildCasualWorld({ ...base, replay: true })).toBe(false);
    expect(shouldRebuildCasualWorld({ ...base })).toBe(true);
  });
  it("fixed-seed runs, races and events keep their course with or without replay", () => {
    for (const run of [
      { seedMode: "yesterday" },
      { duel: true },
      { challenge: "daily" },
      { event: true },
      { storm: true },
      { raceMode: true },
    ]) {
      expect(shouldRebuildCasualWorld({ ...base, ...run })).toBe(false);
      expect(shouldRebuildCasualWorld({ ...base, ...run, replay: true })).toBe(false);
    }
  });
});

it("excludes a nested summary hidden by a closed outer disclosure", () => {
  document.body.innerHTML = '<details><summary>Outer</summary><details><summary>Inner</summary><button>Action</button></details></details>';
  const summaries = document.querySelectorAll("summary");
  expect(hiddenByDisclosure(summaries[0]!)).toBe(false);
  expect(hiddenByDisclosure(summaries[1]!)).toBe(true);
  document.querySelector("details")!.open = true;
  expect(hiddenByDisclosure(summaries[1]!)).toBe(false);
  expect(hiddenByDisclosure(document.querySelector("button")!)).toBe(true);
});
