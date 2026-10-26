/**
 * The device tier reaches the world builders.
 *
 * `deviceProfile.tier` was read in exactly four places and every one of them
 * was DPR or shadow work, so it never reached `new TerrainSystem(...)` or
 * `new Collectibles(...)`. Both builders take a third argument that defaults
 * to `"high"`, so a phone the probe measured as *lite* still got the high
 * budget — more chunks, denser columns, every decoration, the full coin pool —
 * and the lite branches in both constructors were unreachable code.
 *
 * Two things are pinned here because either can rot alone:
 *
 *   1. the translation — `worldTierFor` — which moves `lite` and *only*
 *      `lite`. A phone that is not lite must see byte-identical world, so a
 *      change here is a budget decision, not a refactor.
 *   2. the wiring — that the construction sites in `Game.ts` pass that
 *      translation at all. A correct helper nobody calls is precisely the bug
 *      this file exists to prevent, and it is invisible in a unit test of the
 *      helper, so the wiring is asserted at the source.
 *
 * The runtime section below is a GREEN CONTROL: it passes against the old
 * builders too, because it only proves the two budgets genuinely differ. If
 * the two ever stopped differing, the whole premise of threading the tier
 * would be void and that section would catch it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstancedMesh } from "three";

import { Collectibles } from "../Collectibles";
import { TerrainSystem } from "../TerrainSystem";
import { worldTierFor } from "../../sdk/device-report";

/** Every `new TerrainSystem(` / `new Collectibles(` in non-test src, with the
 *  text of its argument list. Single-line, so the greedy match runs to the
 *  statement's own closing paren. */
function constructions(file: string): { ctor: string; args: string }[] {
  const src = readFileSync(file, "utf8");
  const out: { ctor: string; args: string }[] = [];
  for (const line of src.split("\n")) {
    const m = /new\s+(TerrainSystem|Collectibles)\s*\((.*)\);/.exec(line);
    if (m) out.push({ ctor: m[1], args: m[2] });
  }
  return out;
}

function nonTestSourceFiles(): string[] {
  const root = join(process.cwd(), "src", "game");
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".ts"))
    .map((d) => join(root, d.name));
}

const TIER_ARG = "worldTierFor(this.deviceProfile.tier)";

describe("the world-builder tier is a translation, not a rename", () => {
  it("sends a measured-lite device to the lite budget", () => {
    expect(worldTierFor("lite")).toBe("lite");
  });

  it("leaves a high device on the budget it already had", () => {
    expect(worldTierFor("high")).toBe("high");
  });

  it("leaves a standard device on the budget it already had", () => {
    // `standard` has no builder equivalent. Mapping it to the builders' `mid`
    // would shrink the world on every ordinary desktop and mid phone as a
    // side effect of connecting a wire — a budget change that has to be
    // measured on a device, not inferred here.
    expect(worldTierFor("standard")).toBe("high");
  });
});

describe("the two world budgets genuinely differ, so the wire carries weight", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect() {}, beginPath() {}, arc() {}, fill() {},
      createRadialGradient: () => ({ addColorStop() {} }),
    } as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => vi.restoreAllMocks());

  /** Chunk groups registered after one `update` (far meshes aside). */
  function chunkGroups(tier: "lite" | "high"): number {
    const terrain = new TerrainSystem("tier-probe", tier);
    terrain.update(64);
    const chunks = terrain.group.children.filter((c) => c.type === "Group").length;
    terrain.dispose();
    return chunks;
  }

  /** Reserved coin instances, from the instanced mesh's own capacity. */
  function coinCapacity(tier: "lite" | "high"): number {
    const collect = new Collectibles(4242, "tier-probe", tier);
    const coinMesh = collect.group.children.find(
      (c): c is InstancedMesh => c instanceof InstancedMesh && c.count === 0 && c.instanceMatrix.array.length > 0,
    ) as InstancedMesh;
    const capacity = coinMesh.instanceMatrix.array.length / 16;
    collect.dispose();
    return capacity;
  }

  it("gives a lite terrain fewer chunks than a high one", () => {
    expect(chunkGroups("lite")).toBeLessThan(chunkGroups("high"));
  });

  it("gives lite collectibles a smaller coin pool than high ones", () => {
    expect(coinCapacity("lite")).toBeLessThan(coinCapacity("high"));
  });
});

describe("Game.ts hands both builders the device tier", () => {
  const sites = constructions(join(process.cwd(), "src", "game", "Game.ts"));

  it("found the construction sites rather than matching none of them", () => {
    // A vacuous pass: if the scanner's shape ever stops matching the source,
    // every assertion below would be green while asserting nothing.
    expect(sites.map((s) => s.ctor).sort()).toEqual(["Collectibles", "Collectibles", "TerrainSystem", "TerrainSystem"]);
  });

  it("passes the tier to every TerrainSystem it builds", () => {
    for (const site of sites.filter((s) => s.ctor === "TerrainSystem")) {
      expect(site.args).toContain(TIER_ARG);
    }
  });

  it("passes the tier to every Collectibles pool it builds", () => {
    for (const site of sites.filter((s) => s.ctor === "Collectibles")) {
      expect(site.args).toContain(TIER_ARG);
    }
  });

  it("reads the tier off the device profile, never a literal", () => {
    // A hardcoded "lite" here would pass the two tests above and would ship
    // the lite world to everybody.
    expect(sites.some((s) => /worldTierFor\(\s*"(lite|mid|high)"\s*\)/.test(s.args))).toBe(false);
  });
});

describe("no other module quietly builds a world off the default tier", () => {
  /**
   * The one site that is still on the builders' `high` default: the
   * split-screen versus race builds a separate collectible pool per player,
   * and threading the tier there is a decision about that mode's budget, not
   * a wire to reconnect. It is listed rather than fixed so that the list is
   * honest, and so a NEW un-tiered call site fails this test.
   */
  const KNOWN_UNTIERED: Record<string, number> = { "Racer.ts": 1 };

  it("reports every construction site that passes no tier", () => {
    const untiered: Record<string, number> = {};
    for (const file of nonTestSourceFiles()) {
      if (file.endsWith("Game.ts")) continue;
      const short = file.slice(file.lastIndexOf("/") + 1);
      const n = constructions(file).filter((s) => !s.args.includes("worldTierFor(")).length;
      if (n > 0) untiered[short] = n;
    }
    expect(untiered).toEqual(KNOWN_UNTIERED);
  });
});
