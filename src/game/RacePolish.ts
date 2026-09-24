export type LinkQuality = "unknown" | "good" | "fair" | "poor";

export function gradeStateCadence(intervalSeconds: readonly number[]): LinkQuality {
  if (intervalSeconds.length < 3) return "unknown";
  const recent = intervalSeconds.slice(-12).filter((n) => Number.isFinite(n) && n > 0);
  if (recent.length < 3) return "unknown";
  const average = recent.reduce((sum, n) => sum + n, 0) / recent.length;
  if (average <= 0.095) return "good";
  if (average <= 0.18) return "fair";
  return "poor";
}

export function photoFinishMessage(won: boolean, rivalName: string, marginMetres: number): string {
  const safeName = rivalName.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() || "your rival";
  const margin = Math.max(0, Math.abs(marginMetres));
  const shown = margin < 1 ? `${Math.max(0.1, Math.round(margin * 10) / 10).toFixed(1)} m` : `${Math.round(margin)} m`;
  return won
    ? `Photo finish — you edged ${safeName} by ${shown}`
    : `Photo finish — ${safeName} pipped you by ${shown}`;
}
