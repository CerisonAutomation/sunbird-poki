/**
 * Season identity helpers, dependency-free so SaveData can use them
 * without importing SeasonPass (which imports SaveData types — a cycle).
 */

export function seasonId(date = new Date()): string {
  // Local calendar month, matching monthKey/weekBounds gameplay windows.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function seasonLabel(id: string): string {
  const [y, m] = id.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // A malformed id must round-trip untouched rather than render an
  // `undefined`/`NaN` month (e.g. "2026-13" → "undefined 2026").
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return id;
  return `${months[m - 1]} ${y}`;
}
