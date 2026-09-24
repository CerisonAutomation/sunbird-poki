/**
 * The pilot name is broadcast to other players, so what surface edits it is a
 * platform-policy question, not a styling one.
 *
 *  • Direct/web build: free-text field + Save (its own surfaces, its own risk).
 *  • Portal builds (edition CUSTOM_PILOT_NAMES = false): the generated name is
 *    shown read-only with a 🎲 roll, because Poki's content & player-safety
 *    policy allows no unmoderated player-authored text and its external
 *    resources policy forbids collecting personal data.
 *
 * This drives the real renderer (`HUD.update` → `renderStatic` → `renderBoard`)
 * in jsdom rather than asserting on source text, so a rewrite that reintroduces
 * an input into the portal board page fails here even if the edition flag is
 * still correct. The bundle-level half of the gate lives in
 * scripts/portal-markers.mjs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HudSnapshot } from "../HUD";

/**
 * A snapshot stand-in: the HUD reads far more fields than the board page
 * needs, so anything unlisted answers as an empty value of whatever shape is
 * asked for (string "", list [], callable, nested object).
 */
type LooseSnapshot = Record<string, unknown>;

function snapshotStub(): LooseSnapshot {
  const target = function () {} as unknown as LooseSnapshot;
  return new Proxy(target, {
    get(t, prop, recv) {
      if (Reflect.has(t, prop)) return Reflect.get(t, prop, recv);
      if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "length") return 0;
      if (prop === "then") return undefined;
      if (["map", "slice", "filter", "join", "flatMap"].includes(String(prop))) return () => [];
      return snapshotStub();
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value);
    },
  });
}

async function renderBoardPage(): Promise<HTMLElement> {
  const { HUD } = await import("../HUD");
  const hud = new HUD(document.body);
  const snap = snapshotStub();
  Object.assign(snap, {
    state: "menu",
    screen: "board",
    pilotName: "Skywing",
    version: 1,
    settings: { reduceMotion: false },
  });
  hud.update(snap as unknown as HudSnapshot);
  const root = document.querySelector<HTMLElement>(".hud-root")!;
  expect(root.querySelector(".pilot-name-row")).not.toBeNull();
  return root;
}

async function renderNameEntryPage(): Promise<HTMLElement> {
  const { HUD } = await import("../HUD");
  const hud = new HUD(document.body);
  const snap = snapshotStub();
  Object.assign(snap, {
    state: "menu",
    screen: "nameEntry",
    pilotName: "Skywing",
    version: 1,
    settings: { reduceMotion: false },
  });
  hud.update(snap as unknown as HudSnapshot);
  const root = document.querySelector<HTMLElement>(".hud-root")!;
  expect(root.querySelector(".name-entry-form")).not.toBeNull();
  return root;
}

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("../edition");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("leaderboard pilot-name row", () => {
  it("direct build offers a free-text name field", async () => {
    const root = await renderBoardPage();

    const input = root.querySelector<HTMLInputElement>('[data-ref="pilotName"]');
    expect(input).not.toBeNull();
    expect(input!.value).toBe("Skywing");
    expect(root.querySelector('[data-action="rename-pilot"]')).not.toBeNull();
    expect(root.querySelector('[data-action="autogen-pilot"]')).not.toBeNull();
    expect(root.querySelector(".pilot-name-readonly")).toBeNull();
  });

  it("portal editions show the generated name read-only, with a roll instead of a keyboard", async () => {
    vi.doMock("../edition", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../edition")>()),
      CUSTOM_PILOT_NAMES: false,
    }));

    const root = await renderBoardPage();

    // No typing surface, no free-text save path.
    expect(root.querySelector('[data-ref="pilotName"]')).toBeNull();
    expect(root.querySelector("input")).toBeNull();
    expect(root.querySelector('[data-action="rename-pilot"]')).toBeNull();
    // The name is still visible and still labelled, and the curated reroll
    // remains one tap away.
    const plate = root.querySelector<HTMLElement>(".pilot-name-readonly");
    expect(plate).not.toBeNull();
    expect(plate!.textContent).toBe("Skywing");
    expect(plate!.getAttribute("aria-label")).toBe("Pilot name");
    expect(root.querySelector('[data-action="autogen-pilot"]')).not.toBeNull();
  });
});

/**
 * The first-run welcome screen is the first name surface a player ever sees, and
 * it obeys the same edition split. It is tested separately from the board row
 * because it broke separately: the board row was gated correctly while this
 * screen shipped a free-text input into the portal bundle, which is what the
 * ROOT-07 upload gate was catching.
 */
describe("first-run welcome screen", () => {
  it("direct build pre-fills the field, so the primary CTA is not a dead end", async () => {
    const root = await renderNameEntryPage();

    const input = root.querySelector<HTMLInputElement>('[data-ref="pilotNameInput"]');
    expect(input).not.toBeNull();
    // Boot pre-filled this with setValue() immediately after setScreen(), but the
    // screen renders on the next HUD push, so the ref did not exist yet and the
    // call was a silent no-op. The field came up empty and "Let's Fly" — under
    // copy saying "We picked a name for you" — only toasted a warning, leaving a
    // first-run player no way past the screen unless they found the dice.
    expect(input!.value).toBe("Skywing");
    expect(input!.getAttribute("maxlength")).toBe("14");
    // The counter is decorative but must not lie: it was a hardcoded 0/14.
    expect(root.querySelector(".name-char-count span")!.textContent).toBe("7");
    expect(root.querySelector('[data-action="randomize-pilot-name"]')).not.toBeNull();
    expect(root.querySelector('[data-action="confirm-pilot-name"]')).not.toBeNull();
  });

  it("portal editions get the curated name and a dice, with no typing surface", async () => {
    vi.doMock("../edition", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../edition")>()),
      CUSTOM_PILOT_NAMES: false,
    }));

    const root = await renderNameEntryPage();

    expect(root.querySelector("input")).toBeNull();
    expect(root.querySelector('[data-ref="pilotNameInput"]')).toBeNull();
    // A <label for=…> pointing at an input that is not in the bundle would be an
    // accessibility defect, so the portal variant captions with a plain span.
    expect(root.querySelector('label[for="pilot-name-input"]')).toBeNull();

    const plate = root.querySelector<HTMLElement>(".name-entry-plate");
    expect(plate).not.toBeNull();
    expect(plate!.textContent).toBe("Skywing");
    expect(plate!.getAttribute("aria-label")).toBe("Pilot name");

    // Both the dice and the exit survive, so the screen cannot trap anyone:
    // "Let's Fly" reads the field, and with no field it would have warned forever.
    expect(root.querySelector('[data-action="randomize-pilot-name"]')).not.toBeNull();
    expect(root.querySelector('[data-action="confirm-pilot-name"]')).not.toBeNull();
  });
});
