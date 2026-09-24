/**
 * Layout Engine — hexagonal adapter that dynamically fits HUD.
 * Zero tolerance for overlap, chaos-free, aware of pause/mute.
 */

import { computeHudLayout, type HudElement, type HudLayout } from "../domain/HudDomain";
import type { HudLayoutPort } from "../ports/HudRendererPort";

export class LayoutEngine {
  private lastLayout: HudLayout | null = null;
  private resizeUnsub: (() => void) | null = null;

  constructor(private readonly layoutPort: HudLayoutPort) {}

  start(onLayout: (layout: HudLayout) => void): void {
    const tick = () => {
      const viewport = this.layoutPort.measure();
      const controls = this.layoutPort.getControlBounds();
      const elements = this.buildElements(viewport);
      const layout = computeHudLayout(viewport, elements, controls);
      this.lastLayout = layout;
      onLayout(layout);
    };
    tick();
    this.resizeUnsub = this.layoutPort.onResize(tick);
  }

  stop(): void {
    this.resizeUnsub?.();
    this.resizeUnsub = null;
  }

  getLastLayout(): HudLayout | null {
    return this.lastLayout;
  }

  private buildElements(viewport: { width: number; height: number }): HudElement[] {
    const isNarrow = viewport.width < 400;
    const isShort = viewport.height < 500;
    return [
      { id: "topBar", zone: "header", priority: 1, minWidth: 200, minHeight: 60, visible: true, wants: { width: viewport.width - 24, height: 64 } },
      { id: "midMeta", zone: "header", priority: 2, minWidth: 100, minHeight: 24, visible: !isShort, wants: { width: viewport.width - 24, height: 28 } },
      { id: "powerStrip", zone: "topRight", priority: 1, minWidth: 80, minHeight: 32, visible: true, wants: { width: isNarrow ? 140 : 200, height: 36 } },
      { id: "powerChips", zone: "topRight", priority: 2, minWidth: 60, minHeight: 24, visible: true, wants: { width: isNarrow ? 120 : 180, height: 28 } },
      { id: "goalStrip", zone: "footer", priority: 1, minWidth: 200, minHeight: 32, visible: true, wants: { width: Math.min(340, viewport.width * 0.74), height: 48 } },
      { id: "altGauge", zone: "left", priority: 3, minWidth: 24, minHeight: 100, visible: !isNarrow, wants: { width: 32, height: 160 } },
      { id: "rosterBar", zone: "header", priority: 2, minWidth: 200, minHeight: 24, visible: true, wants: { width: Math.min(620, viewport.width - 24), height: 28 } },
      { id: "inFlightShop", zone: "footer", priority: 2, minWidth: 200, minHeight: 40, visible: true, wants: { width: Math.min(360, viewport.width - 24), height: 44 } },
    ];
  }
}
