/**
 * DOM Adapter — implements HudRendererPort and HudLayoutPort for browser DOM.
 * Hexagonal: adapter talks to ports, core never touches DOM directly.
 */

import type { HudLayout, HudSnapshotDomain } from "../domain/HudDomain";
import type { HudRendererPort, HudLayoutPort } from "../ports/HudRendererPort";

export class DomHudAdapter implements HudRendererPort, HudLayoutPort {
  constructor(private readonly root: HTMLElement) {}

  render(_snapshot: HudSnapshotDomain, layout: HudLayout): void {
    // Apply layout positions to elements — dynamic fit, aware of pause/mute
    for (const [id, pos] of layout.elements) {
      const el = this.root.querySelector<HTMLElement>(`[data-hud-id="${id}"]`);
      if (!el) continue;
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.style.width = `${pos.w}px`;
      el.style.display = pos.visible ? "" : "none";
      el.setAttribute("aria-hidden", pos.visible ? "false" : "true");
    }
  }

  clear(): void {
    this.root.innerHTML = "";
  }

  setVisible(id: string, visible: boolean): void {
    const el = this.root.querySelector<HTMLElement>(`[data-hud-id="${id}"]`);
    if (el) el.style.display = visible ? "" : "none";
  }

  updateElement(id: string, html: string): void {
    const el = this.root.querySelector<HTMLElement>(`[data-hud-id="${id}"]`);
    if (el) el.innerHTML = html;
  }

  measure(): { width: number; height: number; safeTop: number; safeBottom: number } {
    const style = getComputedStyle(this.root);
    return {
      width: this.root.clientWidth || window.innerWidth,
      height: this.root.clientHeight || window.innerHeight,
      safeTop: parseInt(style.getPropertyValue("--safe-top") || "0", 10) || 12,
      safeBottom: parseInt(style.getPropertyValue("--safe-bottom") || "0", 10) || 12,
    };
  }

  getControlBounds(): { pause: { x: number; y: number; w: number; h: number }; mute: { x: number; y: number; w: number; h: number } } {
    const pause = this.root.querySelector<HTMLElement>('[data-ref="pauseBtn"]');
    const mute = this.root.querySelector<HTMLElement>('[data-ref="muteBtn"]');
    const pauseRect = pause?.getBoundingClientRect();
    const muteRect = mute?.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    return {
      pause: {
        x: pauseRect ? pauseRect.left - rootRect.left : window.innerWidth - 60,
        y: pauseRect ? pauseRect.top - rootRect.top : 12,
        w: pauseRect?.width ?? 44,
        h: pauseRect?.height ?? 44,
      },
      mute: {
        x: muteRect ? muteRect.left - rootRect.left : window.innerWidth - 112,
        y: muteRect ? muteRect.top - rootRect.top : 12,
        w: muteRect?.width ?? 44,
        h: muteRect?.height ?? 44,
      },
    };
  }

  onResize(cb: () => void): () => void {
    const obs = new ResizeObserver(cb);
    obs.observe(this.root);
    window.addEventListener("resize", cb);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", cb);
    };
  }
}
