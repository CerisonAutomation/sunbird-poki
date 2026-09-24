export const PILOT_PREFIXES = [
  "Sky", "Solar", "Storm", "Zenith", "Aero", "Vortex",
  "Thunder", "Nimbus", "Astra", "Blaze", "Nova", "Cosmic",
  "Hyper", "Sonic", "Apex", "Glide", "Horizon", "Orion",
];

export const PILOT_BIRDS = [
  "Falcon", "Eagle", "Hawk", "Phoenix", "Raven", "Swift",
  "Kestrel", "Gull", "Owl", "Osprey", "Condor", "Harrier",
  "Merlin", "Peregrine", "Plover", "Skimmer",
];

/**
 * Every other surface in the game holds a pilot name to 14 characters: both
 * rename fields are `maxlength="14"`, `savePilotName()` truncates to 14,
 * `loadPilotName()` truncates a stored name to 14, and rosters slice to it.
 */
export const PILOT_NAME_MAX = 14;

export function generatePilotName(): string {
  // Composing prefix + bird + number overshoots that budget routinely —
  // "Thunder" + "Peregrine" + 42 is 18 characters — and nothing here used to
  // check. The consequences landed on a first-run player: the generated name was
  // stored and displayed untruncated, so it rendered past the field's own limit
  // (the counter read 17/14) and confirming it silently truncated it into a
  // *different* name. Roll until one fits; the shortest combination is 8
  // characters, so this settles in a couple of attempts.
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const p = PILOT_PREFIXES[Math.floor(Math.random() * PILOT_PREFIXES.length)]!;
    const b = PILOT_BIRDS[Math.floor(Math.random() * PILOT_BIRDS.length)]!;
    const num = Math.floor(10 + Math.random() * 89);
    const name = `${p}${b}${num}`;
    if (name.length <= PILOT_NAME_MAX) return name;
  }
  // Unreachable with the current word lists, but a generated name must never
  // violate the limit the rest of the game enforces.
  return `${PILOT_PREFIXES[0]!}${PILOT_BIRDS[0]!}${Math.floor(10 + Math.random() * 89)}`.slice(0, PILOT_NAME_MAX);
}

// Basic profanity filter — pattern-based, not dictionary exhaustive.
// Blocks the most common slurs/hate-speech roots; curated names from
// generatePilotName() always pass (they use only aviation/nature vocab).
const BLOCKED = [
  /fuck/i, /shit/i, /cunt/i, /nigger/i, /nigga/i, /faggot/i, /fag(?!on)/i,
  /bitch/i, /asshole/i, /bastard/i, /retard/i, /cock(?!pit)/i,
  /dick(?!ens|son)/i, /pussy/i, /whore/i, /slut/i, /porn/i, /rape/i,
  /nazi/i, /hitler/i, /kkk/i,
];

/** Returns true when the name is acceptable to broadcast to other players. */
export function isPilotNameClean(name: string): boolean {
  const n = name.trim();
  if (n.length === 0 || n.length > PILOT_NAME_MAX) return false;
  return BLOCKED.every((re) => !re.test(n));
}
