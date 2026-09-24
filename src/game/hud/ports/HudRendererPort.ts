/**
 * Hexagonal Port: HUD Renderer — abstraction over DOM/Canvas rendering.
 * Core domain talks to this port, adapters implement it.
 */
import type { HudLayout, HudSnapshotDomain } from "../domain/HudDomain";

export interface HudRendererPort {
  render(snapshot: HudSnapshotDomain, layout: HudLayout): void;
  clear(): void;
  setVisible(id: string, visible: boolean): void;
  updateElement(id: string, html: string): void;
}

export interface HudLayoutPort {
  measure(): { width: number; height: number; safeTop: number; safeBottom: number };
  getControlBounds(): {
    pause: { x: number; y: number; w: number; h: number };
    mute: { x: number; y: number; w: number; h: number };
  };
  onResize(cb: () => void): () => void;
}

export interface HudInputPort {
  onAction(cb: (action: string, id: string) => void): () => void;
  onPause(): void;
  onMute(): void;
}
