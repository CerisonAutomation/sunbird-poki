/**
 * Hexagonal Port: Input — abstracts keyboard/touch/gamepad.
 */
export type HudAction = {
  type: "pause" | "mute" | "buyPowerup" | "openShop" | "emote";
  payload?: string;
};

export interface HudInputPort {
  onAction(cb: (action: HudAction) => void): () => void;
}
