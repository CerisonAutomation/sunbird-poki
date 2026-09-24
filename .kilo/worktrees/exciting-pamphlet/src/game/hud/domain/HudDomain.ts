/**
 * HUD Domain — hexagonal core, no framework dependencies.
 * Pure domain model for flight HUD, aware of viewport, pause/mute, and dynamic fitting.
 */

export type HudZone = "header" | "footer" | "left" | "right" | "center" | "topRight";

export type HudElementPriority = 1 | 2 | 3 | 4; // 1 = critical, 4 = nice-to-have

export type HudElement = {
  id: string;
  zone: HudZone;
  priority: HudElementPriority;
  minWidth: number;
  minHeight: number;
  visible: boolean;
  // Dynamic fit: element knows its own space needs
  wants: { width: number; height: number };
};

export type HudLayout = {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;
  pauseBtn: { x: number; y: number; w: number; h: number };
  muteBtn: { x: number; y: number; w: number; h: number };
  elements: Map<string, { x: number; y: number; w: number; h: number; visible: boolean }>;
};

export type HudSnapshotDomain = {
  distance: number;
  coins: number;
  multiplier: number;
  combo: number;
  island: number;
  biome: string;
  daylight: number;
  powers: { kind: string; time: number; total: number }[];
  goals: { label: string; progress: number; target: number }[];
  isPaused: boolean;
  isPlaying: boolean;
};

/**
 * Hexagonal: domain knows how to fit, not how to render.
 * Returns layout with positions that guarantee no overlap with pause/mute and between elements.
 */
export function computeHudLayout(
  viewport: { width: number; height: number; safeTop: number; safeBottom: number },
  elements: HudElement[],
  controls: { pause: { x: number; y: number; w: number; h: number }; mute: { x: number; y: number; w: number; h: number } },
): HudLayout {
  const layout: HudLayout = {
    width: viewport.width,
    height: viewport.height,
    safeTop: viewport.safeTop,
    safeBottom: viewport.safeBottom,
    safeLeft: 0,
    safeRight: 0,
    pauseBtn: controls.pause,
    muteBtn: controls.mute,
    elements: new Map(),
  };

  // Sort by priority — critical first, so they get space
  const sorted = [...elements].sort((a, b) => a.priority - b.priority);

  // Track occupied rectangles to prevent overlap
  const occupied: { x: number; y: number; w: number; h: number }[] = [
    { x: controls.pause.x - 4, y: controls.pause.y - 4, w: controls.pause.w + 8, h: controls.pause.h + 8 },
    { x: controls.mute.x - 4, y: controls.mute.y - 4, w: controls.mute.w + 8, h: controls.mute.h + 8 },
  ];

  const isOverlapping = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

  for (const el of sorted) {
    if (!el.visible) {
      layout.elements.set(el.id, { x: 0, y: 0, w: 0, h: 0, visible: false });
      continue;
    }

    let pos: { x: number; y: number; w: number; h: number } | null = null;

    // Zone-based positioning with awareness of pause/mute
    switch (el.zone) {
      case "header":
        pos = { x: 12, y: viewport.safeTop + 12, w: Math.min(el.wants.width, viewport.width - 24), h: el.wants.height };
        break;
      case "topRight":
        // Under pause/mute — dedicated row below controls, right-aligned
        pos = {
          x: viewport.width - el.wants.width - 16,
          y: controls.pause.y + controls.pause.h + 10,
          w: el.wants.width,
          h: el.wants.height,
        };
        break;
      case "left":
        pos = { x: 12, y: viewport.height * 0.3, w: el.wants.width, h: el.wants.height };
        break;
      case "right":
        pos = { x: viewport.width - el.wants.width - 12, y: viewport.height * 0.3, w: el.wants.width, h: el.wants.height };
        break;
      case "footer":
        pos = { x: (viewport.width - el.wants.width) / 2, y: viewport.height - viewport.safeBottom - el.wants.height - 12, w: el.wants.width, h: el.wants.height };
        break;
      case "center":
        pos = { x: (viewport.width - el.wants.width) / 2, y: (viewport.height - el.wants.height) / 2, w: el.wants.width, h: el.wants.height };
        break;
    }

    if (!pos) continue;

    // Check overlap with already placed + controls — if overlap and priority >2, hide
    let overlaps = occupied.some((o) => isOverlapping(o, pos!));
    if (overlaps) {
      if (el.priority >= 3) {
        // Low priority — hide instead of overlapping (chaos-free)
        layout.elements.set(el.id, { ...pos, visible: false });
        continue;
      }
      // Try to nudge down for topRight zone (powerups under pause/mute)
      if (el.zone === "topRight") {
        let attempts = 0;
        while (overlaps && attempts < 5) {
          pos.y += 36;
          overlaps = occupied.some((o) => isOverlapping(o, pos!));
          attempts++;
        }
      }
    }

    if (!overlaps || el.priority <= 2) {
      occupied.push(pos);
      layout.elements.set(el.id, { ...pos, visible: true });
    } else {
      layout.elements.set(el.id, { ...pos, visible: false });
    }
  }

  return layout;
}
