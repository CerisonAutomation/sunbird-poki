import { clamp } from "./math";

/** Monotonic, bounded challenge envelope. Biomes vary the feel inside it;
 * neither speed nor slope can grow without limit during a long flight. */
export function flightProgression(island: number): { hillScale: number; rhythmScale: number } {
  const progress = 1 - Math.exp(-Math.max(0, island) / 12);
  return { hillScale: 1 + progress * 0.32, rhythmScale: 1 + progress * 0.24 };
}

export function endlessSpeedScale(island: number, runSeconds: number): number {
  const pressure = Math.max(0, island) * 0.055 + Math.max(0, runSeconds) / 600;
  return 1 + 0.55 * (1 - Math.exp(-pressure));
}

export function terrainDifficulty(requested: number): number {
  return Number.isFinite(requested) ? clamp(requested, 0.86, 1.16) : 1;
}
