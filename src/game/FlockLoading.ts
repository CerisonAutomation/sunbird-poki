import { sunSVG, sunbirdSVG } from "./Sunbird";

/** The same artwork as the menu and first-load shell, never a substitute icon.
 * Callers provide a real status label outside this decorative mark. */
export function flockLoadingMark(): string {
  return `<span class="flock-loading" aria-hidden="true">${sunSVG({ size: 64 })}<span class="flock-loading-bird">${sunbirdSVG({ width: 30, animateWings: true })}</span></span>`;
}
