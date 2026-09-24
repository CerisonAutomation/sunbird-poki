/**
 * Where each mode card sends the player.
 *
 * The audit finding this module exists to kill: the "Championship & PvP
 * Circuits" cards in the modes screen all used `pick-mode`, which started a
 * solo run against the AI flock — so a menu that said PvP dropped the player
 * straight into an offline AI race, with no options and no notice. PvP now
 * routes to the PvP options (the Race Lobby: ranked/casual matchmaking,
 * private rooms, circuits, and the AI controls), and racing the AI flock is
 * its own explicit route (`ai-pvp`).
 *
 * Kept pure and separate from Game.ts so the routing is test-pinned without a
 * renderer/WebGL context.
 */
import { PVP_MODES, type ModeId } from "./Modes";

export type LaunchIntent =
  /** Offline score-chase against the clock/terrain — no field of rivals. */
  | "solo"
  /** Opens the PvP options with this circuit preselected (never auto-starts). */
  | "pvp-options"
  /** The mass-race lobby (online rooms + AI fill). */
  | "lobby"
  /** Starts an offline race against the AI flock right now. */
  | "ai-race";

/** True for the eight competitive circuits (pvp_sprint … pvp_coinrush). */
export function isPvpCircuit(modeId: string): boolean {
  return PVP_MODES.some((m) => m.id === modeId);
}

/** What clicking a mode card in the modes screen should do. */
export function launchIntentFor(modeId: string): LaunchIntent {
  if (modeId === "massrace") return "lobby";
  if (isPvpCircuit(modeId)) return "pvp-options";
  return "solo";
}

/** Resolve an id to a PvP circuit, or null when it is not one. */
export function pvpCircuitFor(modeId: string | undefined): ModeId | null {
  if (!modeId) return null;
  const found = PVP_MODES.find((m) => m.id === modeId);
  return found ? found.id : null;
}
