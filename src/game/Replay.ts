export type RunOptions = {
  duel?: boolean;
  challenge?: "" | "daily" | `gauntlet${number}`;
  event?: boolean;
  storm?: boolean;
  /** "Fly again" — keep the exact course so the ghost of the run that just
   *  ended is a real opponent instead of a random island. */
  replay?: boolean;
};

/**
 * Does this run need a brand-new casual world?
 *
 * A plain free flight gets fresh hills every time so no two runs look alike —
 * but a replay must reuse the course it is replaying, otherwise the recorded
 * ghost (stored per seed) can never be seen again and "race your ghost" is
 * dead weight. Explicit seeds are always honoured.
 */
export function shouldRebuildCasualWorld(run: {
  replay: boolean;
  seedMode: string;
  duel: boolean;
  challenge: string;
  event: boolean;
  storm: boolean;
  raceMode: boolean;
}): boolean {
  if (run.replay) return false;
  return (
    run.seedMode === "today" && !run.duel && !run.challenge && !run.event && !run.storm && !run.raceMode
  );
}

/** All replay entry points retain the run's rules; completed one-shot goals
 * return to the mode rather than advertising a reward that was already claimed. */
export function replayOptions(run: {
  duel: boolean; challenge: string; dailyDone: boolean; gauntletDone: number[]; event: boolean; storm: boolean;
}): RunOptions {
  if (run.duel) return { duel: true };
  if (run.challenge === "daily" && !run.dailyDone) return { challenge: "daily" };
  const stage = /^gauntlet(\d+)$/.exec(run.challenge);
  if (stage && !run.gauntletDone.includes(Number(stage[1]))) return { challenge: `gauntlet${Number(stage[1])}` };
  if (run.event) return { event: true };
  if (run.storm) return { storm: true };
  return {};
}
