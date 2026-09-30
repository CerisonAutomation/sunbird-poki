import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Bird, disposeSharedBirdGeometry } from "../Bird";

/**
 * A bird is about twenty meshes, and `MassRace` builds up to forty rivals.
 * Every mesh used to allocate its own `SphereGeometry`/`ConeGeometry`, so a
 * full race uploaded on the order of 800 buffer geometries to the GPU —
 * every one a duplicate of a geometry already resident, differing only in the
 * `mesh.scale` applied afterwards.
 *
 * Poki's technical bar is a solid 30 fps minimum and a 60 fps target on
 * mid-range phones from the last three years. This is the kind of waste that
 * is invisible on a desktop and decides whether a phone holds frame.
 */
const geometriesOf = (bird: Bird): THREE.BufferGeometry[] => {
  const out: THREE.BufferGeometry[] = [];
  bird.root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o.geometry);
  });
  return out;
};

describe("bird geometry is shared, not duplicated per bird", () => {
  it("two birds draw the same geometry objects", () => {
    const a = new Bird();
    const b = new Bird();
    const ga = geometriesOf(a);
    const gb = geometriesOf(b);

    expect(ga.length).toBeGreaterThan(10); // it really is a many-mesh bird
    expect(gb.length).toBe(ga.length);
    for (let i = 0; i < ga.length; i += 1) {
      expect(gb[i], `mesh ${i} allocated a second copy of its geometry`).toBe(ga[i]);
    }
    a.dispose();
    b.dispose();
  });

  it("a whole race costs a fixed number of geometries, not one set per rival", () => {
    disposeSharedBirdGeometry();
    const flock = Array.from({ length: 40 }, () => new Bird());
    const unique = new Set<THREE.BufferGeometry>();
    for (const bird of flock) for (const geo of geometriesOf(bird)) unique.add(geo);
    // Forty birds, one small pool of shapes between them.
    expect(unique.size).toBeLessThan(25);
    for (const bird of flock) bird.dispose();
    disposeSharedBirdGeometry();
  });

  it("disposing one bird does not blank the others", () => {
    // The trap this replaced: `dispose()` walked the tree calling
    // `geometry.dispose()` on everything, which was only safe while every
    // bird owned a private copy. With sharing, one rival leaving the race
    // would have emptied every other rival's buffers.
    const keep = new Bird();
    const leaving = new Bird();
    const before = geometriesOf(keep).map((g) => g.attributes.position?.count ?? 0);
    leaving.dispose();
    const after = geometriesOf(keep).map((g) => g.attributes.position?.count ?? 0);
    expect(after).toEqual(before);
    expect(after.every((n) => n > 0)).toBe(true);
    keep.dispose();
  });
});

/**
 * The other half of the same frame budget: the shadow map.
 */
describe("rivals stay out of the shadow pass", () => {
  const casters = (bird: Bird): number => {
    let n = 0;
    bird.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.castShadow) n += 1;
    });
    return n;
  };

  it("the player's bird casts real shadows", () => {
    const player = new Bird();
    expect(casters(player)).toBeGreaterThan(5);
    player.dispose();
  });

  it("a bird told to stop casting stops entirely", () => {
    const rival = new Bird();
    rival.setShadowCasting(false);
    expect(casters(rival)).toBe(0);
    // …and it is reversible, so a rival promoted to the camera's focus can
    // get its shadows back without being rebuilt.
    rival.setShadowCasting(true);
    expect(casters(rival)).toBeGreaterThan(5);
    rival.dispose();
  });

  it("a 40-rival field adds nothing to the depth pass", () => {
    const flock = Array.from({ length: 40 }, () => {
      const b = new Bird();
      b.setShadowCasting(false);
      return b;
    });
    const total = flock.reduce((sum, b) => sum + casters(b), 0);
    expect(total).toBe(0);
    for (const b of flock) b.dispose();
  });
});
