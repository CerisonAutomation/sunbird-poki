/** Equal flight equipment for live rooms and ranked practice. Local casual
 * practice / duels retain their existing loadout rules; rewards stay separate. */
export function equalizedRace(mode: string, ranked: boolean, local: boolean, duel: boolean): boolean {
  return mode === "massrace" && !duel && (ranked || !local);
}
