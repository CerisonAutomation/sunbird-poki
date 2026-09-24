/**
 * Portal gameplay-phase event sink.
 *
 * Poki's requirements are explicit: `gameplayStart()` cannot follow another
 * `gameplayStart()`, and `gameplayStop()` cannot follow another
 * `gameplayStop()` — the Inspector flags consecutive duplicates. The game
 * state machine is edge-triggered (it fires only on playing ⇄ non-playing
 * transitions), but several code paths have historically re-sent a phase
 * (defensive resends around portal breaks, late SDK landing), which would
 * produce exactly the forbidden duplicate. Every gameplayStart/gameplayStop
 * emission therefore funnels through this sink, which records the last
 * phase that reached the portal and suppresses a repeat.
 *
 * The phase is recorded even when the adapter was not ready yet: a stop
 * that happened before the SDK landed must not be replayed when a later
 * code path "defensively" re-sends it.
 */
export type GameplayPhase = "start" | "stop";

export class GameplayEventSink {
  private last: GameplayPhase | null = null;

  constructor(private readonly emit: (phase: GameplayPhase) => void) {}

  /** Emit `phase` unless it is the same as the last phase sent to the portal. */
  send(phase: GameplayPhase): void {
    if (this.last === phase) return;
    this.last = phase;
    this.emit(phase);
  }

  get lastPhase(): GameplayPhase | null {
    return this.last;
  }
}
