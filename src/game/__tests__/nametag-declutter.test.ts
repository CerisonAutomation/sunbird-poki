/**
 * Rival name tags must not stack into an unreadable pile.
 *
 * Why this exists: on a 40-pilot PVP grid the flight lane rendered 40 name tags
 * in the centre 50%x50% of the screen. Measured in-browser, every one of the
 * 780 pairs overlapped and the stack painted 1834% overdraw — the pilot's own
 * bird and the bird being drafted were both unreadable, which is precisely the
 * information a PvP HUD exists to convey.
 *
 * The fix has two halves and the browser proved that either one alone is not
 * enough:
 *  - `MassRace` caps who gets a tag at all (`MAX_VISIBLE_NAME_TAGS`), picking
 *    the drafting rival and nearest rivals before any place is computed. The
 *    cap alone still produced 15/15 overlapping pairs, because six rivals can
 *    legitimately be within a few pixels of each other in world space.
 *  - `HUD` declutters in *screen* space, hiding any tag whose box overlaps one
 *    already placed this frame. Tags arrive in relevance order, so the one you
 *    are actually racing keeps the spot.
 *
 * Both halves are asserted here. The place arithmetic moved off a full 41-row
 * sort onto a per-rival ahead-count in the same edit, so it is covered too.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { HUD } from "../HUD";
import type { HudSnapshot } from "../HUD";
import { MassRace, MAX_VISIBLE_NAME_TAGS } from "../MassRace";
import type { RivalNameTag } from "../MassRace";
import { TerrainSystem } from "../TerrainSystem";

const SEED = "nametag-declutter";

/** Lateral offset that puts a rival outside the draft band but still in view. */
const OFF_DRAFT_Y = 40;

function field(rivals: number): { terrain: TerrainSystem; mr: MassRace } {
  const terrain = new TerrainSystem(SEED);
  const mr = new MassRace();
  mr.spawn(rivals, `${SEED}:pvp_sprint:${rivals}`, terrain, 0);
  return { terrain, mr };
}

describe("rival name tags: the cap", () => {
  it("tags at most MAX_VISIBLE_NAME_TAGS of a 40-pilot field", () => {
    const { terrain, mr } = field(40);
    // Deterministic layout regardless of how spawn seeds the grid: every rival
    // inside the camera window, none of them drafting (they are all far off the
    // glide axis), spread from 1m to 40m ahead.
    mr.rivals.forEach((r, i) => {
      r.bird.x = 100 + 1 + i;
      r.bird.y = 0 + OFF_DRAFT_Y;
    });

    const tags = mr.getVisibleNameTags(100, 100, 0, 0);
    expect(tags.length).toBe(MAX_VISIBLE_NAME_TAGS);

    // And they are the NEAREST ones — the cap has to pick, and picking the
    // furthest 6 would be worse than no tags at all.
    const distances = tags.map((t) => t.worldX - 100).sort((a, b) => a - b);
    expect(distances).toEqual([1, 2, 3, 4, 5, 6]);

    terrain.dispose();
  });

  it("keeps the drafting rival even when nearer rivals would fill the cap", () => {
    const { terrain, mr } = field(7);
    const [drafted, ...crowd] = mr.rivals;
    // The rival you are drafting: inside the zone, on the glide axis.
    drafted!.bird.x = 100 + mr.draftBehind / 2;
    drafted!.bird.y = 0;
    // Six rivals closer along the glide axis but well outside the lateral band,
    // so without the priority rule the draft tag would be cut last.
    crowd.forEach((r, i) => {
      r.bird.x = 101 + i;
      r.bird.y = 0 + OFF_DRAFT_Y;
    });

    const tags = mr.getVisibleNameTags(100, 100, 0, 0);
    expect(tags.length).toBe(MAX_VISIBLE_NAME_TAGS);
    expect(tags.map((t) => t.id)).toContain(drafted!.id);
    expect(tags.find((t) => t.id === drafted!.id)?.drafting).toBe(true);

    terrain.dispose();
  });

  it("ranks kept tags by counting birds ahead", () => {
      const { terrain, mr } = field(3);
      // Player at 100. One rival at 200 (ahead of the player), two at 50.
      const [a, b, c] = mr.rivals;
      a!.bird.x = 200;
      b!.bird.x = 50;
      c!.bird.x = 50;
  
      const tags = mr.getVisibleNameTags(100, 100, 0, 0);
      const placeOf = (id: string): number | undefined => tags.find((t) => t.id === id)?.place;
      // Rival `a` (200) is ahead of the player (100) and ahead of b and c (50):
      // nobody beats it, so it leads.
      expect(placeOf(a!.id)).toBe(1);
      // b and c tie at 50, both behind the player and behind `a`: the player is
      // one bird ahead of them and `a` is the other, so they are joint third.
      expect(placeOf(b!.id)).toBe(3);
      expect(placeOf(c!.id)).toBe(3);
  
      terrain.dispose();
    });
});

function tag(id: string, worldX: number, worldY: number): RivalNameTag {
  return {
    id,
    name: id,
    worldX,
    worldY,
    distance: Math.round(worldX),
    place: 1,
    remote: false,
    drafting: false,
    emote: "",
  };
}

/** A camera at the origin, matching what Game.ts passes while in flight. */
function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  cam.position.set(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

/**
 * jsdom reports `offsetWidth`/`offsetHeight` as 0 for every element, so every
 * case here runs the nominal-size fallback — the same path a real browser takes
 * while the play HUD is hidden and the tags measure zero. That is deliberate:
 * the fallback is exactly where a silent regression would hide.
 *
 * The 105px nominal is sized to the worst case, not the average: measured in a
 * browser, the pill is 46px wide at 3 characters and 103px at 14, and 14 is
 * NAME_MAX — the protocol's hard cap on a pilot name. So the fallback can
 * over-hide before the first real measurement, never under-hide. Under-sizing
 * it is the failure mode that reintroduces the stack.
 */
type LooseSnapshot = Record<string, unknown>;

/**
 * HudSnapshot is ~227 fields; a literal would have to guess the shape. This is
 * the same permissive stub hud-injection.test.ts uses — unknown reads come back
 * inert instead of throwing.
 */
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

function mount(): { hud: HUD; container: HTMLElement } {
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
  });
  hud.update(snap as unknown as HudSnapshot);
  const container = document.querySelector<HTMLElement>('[data-ref="nametags"]');
  if (!container) throw new Error("HUD did not mount a nametag container");
  return { hud, container };
}

function isHidden(el: HTMLElement): boolean {
  return el.style.display === "none";
}

describe("rival name tags: screen-space declutter", () => {
  it("hides a tag that lands on one already placed, keeping the first", () => {
    const { hud, container } = mount();
    const cam = camera();
    // Same world position, so identical screen position.
    hud.updateNameTags([tag("near", 0, 0), tag("far", 0, 0)], cam, 800, 600);

    const els = Array.from(container.querySelectorAll<HTMLElement>(".rival-nametag"));
    expect(els).toHaveLength(2);
    // Hidden, not removed: the element stays cached so re-showing next frame is
    // a style write rather than an HTML rebuild.
    expect(isHidden(els[0]!)).toBe(false);
    expect(isHidden(els[1]!)).toBe(true);
  });

  it("shows two tags that do not overlap", () => {
    const { hud, container } = mount();
    const cam = camera();
    // ~1 world unit apart at z=-3.5 is ~300px on a 600px-tall viewport, far
    // past the ~19px tag height.
    hud.updateNameTags([tag("a", 0, 0), tag("b", 0, 1)], cam, 800, 600);

    const els = Array.from(container.querySelectorAll<HTMLElement>(".rival-nametag"));
    expect(els).toHaveLength(2);
    expect(els.filter(isHidden)).toHaveLength(0);
  });

  it("reuses the same element across frames instead of rebuilding", () => {
    const { hud, container } = mount();
    const cam = camera();
    hud.updateNameTags([tag("a", 0, 0), tag("b", 0, 0)], cam, 800, 600);
    const first = container.querySelectorAll<HTMLElement>(".rival-nametag")[0]!;
    // Same tags next frame: the element identity is stable and still visible.
    hud.updateNameTags([tag("a", 0, 0), tag("b", 0, 0)], cam, 800, 600);
    const after = container.querySelectorAll<HTMLElement>(".rival-nametag")[0]!;
    expect(after).toBe(first);
    expect(isHidden(after)).toBe(false);
  });
});