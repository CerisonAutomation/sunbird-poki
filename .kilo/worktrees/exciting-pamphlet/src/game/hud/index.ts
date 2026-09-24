/**
 * HUD Hexagonal Module — barrel export
 * Domain is pure, ports are abstractions, adapters are implementations.
 * Chaos-free, zero tolerance for overlap, dynamically fits.
 */

export * from "./domain/HudDomain";
export * from "./ports/HudRendererPort";
export * from "./layout/LayoutEngine";
export * from "./components/InFlightShop";
export * from "./adapters/DomHudAdapter";

// Game-changing: in-flight shop is now a first-class domain, not an afterthought
export const HUD_VERSION = "2.0-hexagonal";
