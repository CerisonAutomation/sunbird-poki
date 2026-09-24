/**
 * Network-supplied names must reach the screen as text, never as markup.
 *
 * Why this exists: the HUD builds every screen by concatenating strings into
 * `innerHTML` (14 sinks). What keeps that safe is a *per-call-site*
 * `escapeHtml()` — the discipline is real (94 escapes today, and every
 * network-name sink found in the tree uses one), but nothing in the suite
 * proved it. So the next name sink added without the wrapper would pass all
 * 1,600+ tests and ship script execution into a portal iframe.
 *
 * These three surfaces are the ones a stranger controls:
 *  - the room roster (leader name + room code) — server/host supplied;
 *  - the live standings rows — other players' names;
 *  - P2P rival name tags — worst case, pure WebRTC with no server-side name
 *    validation at all, so the payload is exactly what the peer chose.
 *
 * jsdom does not fetch images, so an `onerror` may never fire here; the
 * assertion is therefore on the DOM (no live element was parsed) plus a
 * canary global, and on the name still being *readable* as text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import type { HudSnapshot } from "../HUD";
import { sunbirdSVG } from "../Sunbird";
import type { RivalNameTag, RosterBird, Standing } from "../MassRace";

type LooseSnapshot = Record<string, unknown>;

const IMG_PAYLOAD = `<img src=x onerror="window.__sunbirdPwned = 1">`;
const SCRIPT_PAYLOAD = `<script>window.__sunbirdPwned = 2;<\/script>`;
/**
 * The payloads that actually matter for an *attribute* sink. Several name sinks
 * render into `title="…"`/`aria-label="…"`, where a bare `<img>` is inert text:
 * the attack is closing the quote first, then either smuggling a handler onto
 * the real element or breaking out of the tag entirely.
 */
const HANDLER_PAYLOAD = `" onmouseover="window.__sunbirdPwned = 3`;
const BREAKOUT_PAYLOAD = `"><img src=x onerror="window.__sunbirdPwned = 4">`;
const LIVE_MARKUP = "img, script, iframe, object, embed";

function snapshotStub(): LooseSnapshot {
  const target = function () {} as unknown as LooseSnapshot;
  return new Proxy(target, {
    get(t, prop, recv) {
      if (Reflect.has(t, prop)) return Reflect.get(t, prop, recv);
      if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") return () => "";
      if (prop === Symbol.iterator) return function* () {};
      if (prop === "length") return 0;
      if (prop === "then") return undefined;
      if (["map", "slice", "filter", "flatMap"].includes(String(prop))) return () => [];
      if (["join"].includes(String(prop))) return () => "";
      if (["find", "findIndex"].includes(String(prop))) return () => undefined;
      return snapshotStub();
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value);
    },
  });
}

async function mount(overrides: Record<string, unknown> = {}) {
  const { HUD } = await import("../HUD");
  const hud = new HUD(document.body);
  const snap = snapshotStub();
  Object.assign(snap, {
    state: "playing",
    screen: "main",
    version: 1,
    race: null,
    versus: false,
    p1Stats: null,
    p2Stats: null,
    settings: { reduceMotion: false },
    ...overrides,
  });
  hud.update(snap as unknown as HudSnapshot);
  const root = document.querySelector<HTMLElement>(".hud-root");
  if (!root) throw new Error("HUD did not mount a .hud-root");
  return { hud, root };
}

function hostileRoster(name: string): RosterBird[] {
  return [
    { id: "leader", name, hue: 200, progress: 0.8, place: 1, you: false, remote: true, ghost: false, finished: false, emote: "" },
    { id: "you", name: "You", hue: 40, progress: 0.4, place: 2, you: true, remote: false, ghost: false, finished: false, emote: "" },
  ];
}

function hostileStandings(name: string): Standing[] {
  return [
    { id: "r1", name, distance: 800, kind: "remote", place: 1, you: false, finished: false },
    { id: "you", name: "You", distance: 400, kind: "you", place: 2, you: true, finished: false },
  ];
}

/**
 * Nothing live was parsed, nothing executed, and the name is still readable.
 *
 * Deliberately NOT `expect(root.innerHTML).not.toContain("<img")`: HTML
 * attribute serialisation escapes only `&`, `"` and nbsp, so a correctly
 * escaped name rendered into `title="…"` comes back out of `innerHTML` with a
 * literal `<` in it — inert, but it fails a naive substring check (that false
 * positive is how this helper got its two structural assertions instead).
 */
function expectTextOnly(root: HTMLElement, payload: string): void {
  // 1. No element was ever created from the payload.
  expect(root.querySelectorAll(LIVE_MARKUP).length).toBe(0);
  // 2. No inline handler anywhere — catches a quote breakout out of a
  //    title/aria-label attribute, which is the subtler injection path.
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      expect(attr.name.toLowerCase().startsWith("on"), `${el.tagName} gained ${attr.name}`).toBe(false);
    }
  }
  // 3. Nothing ran.
  expect((globalThis as { __sunbirdPwned?: number }).__sunbirdPwned).toBeUndefined();
  // 4. The player can still read the name.
  expect(root.textContent ?? "").toContain(payload.slice(0, 12));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  // The roster and standings rebuilds are throttled (150ms / 200ms); land the
  // clock well past both so a first render is never skipped.
  vi.spyOn(performance, "now").mockReturnValue(60_000);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("HUD markup injection", () => {
  it("renders a hostile room-roster leader name as text", async () => {
    const { root } = await mount({ roster: hostileRoster(IMG_PAYLOAD) });
    expectTextOnly(root, IMG_PAYLOAD);
  });

  it("renders a hostile room code as text", async () => {
    const { root } = await mount({ roster: hostileRoster("Host"), roomCode: SCRIPT_PAYLOAD });
    expectTextOnly(root, SCRIPT_PAYLOAD);
  });

  it("renders hostile live-standings names as text", async () => {
    const { root } = await mount({ standings: hostileStandings(IMG_PAYLOAD) });
    expectTextOnly(root, IMG_PAYLOAD);
  });

  it("cannot smuggle a handler onto the roster through a quoted name", async () => {
    const { root } = await mount({ roster: hostileRoster(HANDLER_PAYLOAD) });
    expectTextOnly(root, HANDLER_PAYLOAD);
  });

  it("cannot break out of the roster row's title attribute", async () => {
    const { root } = await mount({ roster: hostileRoster(BREAKOUT_PAYLOAD) });
    expect(root.querySelectorAll(LIVE_MARKUP).length).toBe(0);
    expect((globalThis as { __sunbirdPwned?: number }).__sunbirdPwned).toBeUndefined();
  });

  it("cannot break out of a live-standings row either", async () => {
    const { root } = await mount({ standings: hostileStandings(BREAKOUT_PAYLOAD) });
    expect(root.querySelectorAll(LIVE_MARKUP).length).toBe(0);
    expect((globalThis as { __sunbirdPwned?: number }).__sunbirdPwned).toBeUndefined();
  });

  it("renders hostile leaderboard names on the home strip as text", async () => {
    const { root } = await mount({
      state: "menu",
      screen: "main",
      homeBoard: [
        { name: IMG_PAYLOAD, value: "1,200 m", you: false },
        { name: BREAKOUT_PAYLOAD, value: "900 m", you: true },
      ],
    });
    expect(root.querySelectorAll(LIVE_MARKUP).length).toBe(0);
    for (const el of Array.from(root.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith("on"), `${el.tagName} gained ${attr.name}`).toBe(false);
      }
    }
    expect((globalThis as { __sunbirdPwned?: number }).__sunbirdPwned).toBeUndefined();
    expect(root.textContent ?? "").toContain("<img src=x");
  });

  it("keeps a hostile duel-foe name inert inside the inline SVG title", () => {
    // `sunbirdSVG()` is the roster/lobby/duel bird, and its `title` is fed
    // straight from network names (HUD.ts passes `s.duelFoe.name`). SVG
    // `<title>` is a text node inside an innerHTML sink, escaped by Sunbird's
    // own `escapeText` — a second, separate escaper from HUD's.
    const host = document.createElement("div");
    host.innerHTML = sunbirdSVG({ title: BREAKOUT_PAYLOAD });
    expect(host.querySelectorAll("img, script, iframe, object, embed").length).toBe(0);
    expect(host.innerHTML).not.toContain("<img src=x");
    for (const el of Array.from(host.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith("on"), `${el.tagName} gained ${attr.name}`).toBe(false);
      }
    }
    expect(host.textContent ?? "").toContain("<img src=x");
  });

  it("renders a hostile P2P rival name tag as text", async () => {
    const { hud, root } = await mount();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, 0);
    camera.updateMatrixWorld();
    const tag: RivalNameTag = {
      id: "peer",
      name: IMG_PAYLOAD,
      worldX: 0,
      worldY: 0,
      distance: 12,
      place: 2,
      remote: true,
      drafting: false,
      emote: SCRIPT_PAYLOAD,
    };
    hud.updateNameTags([tag], camera, 800, 600);
    expectTextOnly(root, IMG_PAYLOAD);
  });
});
