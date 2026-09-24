/** Shared by split-screen rendering and touch routing. */
export function splitLayout(width: number, height: number): "vertical" | "horizontal" {
  return width / Math.max(1, height) >= 1.25 ? "vertical" : "horizontal";
}

export interface SplitView {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * WebGL's origin is bottom-left; P1 is left in landscape and top in portrait.
 * Partition physical pixels, then convert back to Three.js logical units.
 * This covers odd dimensions and fractional DPRs without gaps or overlap.
 */
export function splitViews(width: number, height: number, dpr: number): [SplitView, SplitView] {
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);
  const leftWidth = Math.floor(pixelWidth / 2);
  const bottomHeight = Math.floor(pixelHeight / 2);
  if (splitLayout(width, height) === "vertical") {
    return [
      { x: 0, y: 0, width: leftWidth / dpr, height: pixelHeight / dpr },
      { x: leftWidth / dpr, y: 0, width: (pixelWidth - leftWidth) / dpr, height: pixelHeight / dpr },
    ];
  }
  return [
    { x: 0, y: bottomHeight / dpr, width: pixelWidth / dpr, height: (pixelHeight - bottomHeight) / dpr },
    { x: 0, y: 0, width: pixelWidth / dpr, height: bottomHeight / dpr },
  ];
}
