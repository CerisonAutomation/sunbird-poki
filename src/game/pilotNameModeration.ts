import { RESERVED_PILOT_NAMES } from "./edition";
/**
 * Pilot-name moderation.
 *
 * Poki's external-resources policy forbids *chat systems* ("Chat systems aren't
 * allowed") and personal-data collection ("Games must not collect personal
 * information", "no email-based logins"), and suggests emoji as the alternative
 * for player expression. It does **not** forbid a player-chosen display name,
 * and it sets no filtering requirement of its own — so the duties that remain
 * are ours: the name is broadcast to other real people (netlib rosters, in-world
 * name tags, squad) and persisted on a public leaderboard, and every upload goes
 * through Poki's content-moderation check. An unfiltered text field feeding a
 * *public, persistent* surface is the thing that gets a build bounced.
 *
 * So this filter is deliberately conservative in four stages:
 *
 *   1. SHAPE — letters/digits/space/_/./- only, 3..14 characters, at least two
 *      letters, and no contact details (email, URL, @handle, long digit runs).
 *      This mirrors `savePilotName()`, which strips every other character, so a
 *      name that passes here cannot be silently rewritten into a different one
 *      by storage.
 *   2. NORMALISE — NFKD + diacritic strip, zero-width/control removal, fullwidth
 *      folding, homoglyph folding (Cyrillic/Greek lookalikes), leetspeak
 *      folding, and a *squashed* key with all separators removed. "f.u.c.k",
 *      "f u c k", "fück" and "fυck" all collapse to one key, so the blocklist
 *      never has to enumerate evasion spellings.
 *   3. MATCH — the blocklist runs against the squashed key.
 *   4. ALLOWLIST COVER — a hit that sits inside a known-safe word is not a hit.
 *      Without this the filter fails the Scunthorpe test: "classic" contains
 *      "ass", "cockpit" contains "cock", "assassin" contains "ass", and every
 *      one of those is a name a player would legitimately want.
 *
 * The word lists are aviation/nature vocabulary, so generated call signs always
 * pass; `pilot-name-moderation.test.ts` drives both the evasion and the
 * false-positive cases, and `pilot-name-generator.test.ts` proves the generator
 * never trips the filter.
 */

export const PILOT_NAME_MIN = 3;

/** Hard profanity, sexual terms and hate speech — the categories a platform
 * moderation check actually action. Stored pre-normalised (lowercase, no
 * separators) because they are matched against the squashed key. */
const BLOCKED = [
  // hate / slurs
  "nigger", "nigga", "nigg", "faggot", "fagot", "fag", "dyke", "tranny",
  "retard", "spastic", "chink", "kike", "wetback", "gook", "coon", "raghead",
  "nazi", "hitler", "kkk", "whitepower", "heilhitler",
  // hard profanity
  "fuck", "fuk", "fck", "phuck", "shit", "sht", "shyt", "cunt", "kunt", "bitch",
  "bastard", "asshole", "arsehole", "dumbass", "jackass", "bollocks",
  "piss", "wank", "twat", "prick", "bellend", "dipshit", "bullshit",
  // sexual
  "pussy", "penis", "vagina", "dick", "cock", "tits", "titty", "boobs",
  "whore", "slut", "skank", "rape", "pedo", "paedo", "molest", "porn",
  "hentai", "nude", "nudes", "sexcam",
  // more slurs, same categories
  // "wop" is deliberately absent: it collides with "swoop" and "whoop", which
  // are call signs players actually pick in a flying game.
  "spic", "beaner", "paki", "dago", "jigaboo", "shemale", "trannie",
  "porchmonkey", "towelhead", "cameljockey", "kaffir", "gook",
  // more sexual
  "blowjob", "handjob", "cumming", "jizz", "semen", "dildo", "milf", "gilf",
  "loli", "shota", "ecchi", "yiff", "bdsm", "bondage", "fetish", "orgasm",
  "orgy", "nympho", "sex", "sexvideo",
  // self-harm — the category a platform is most sensitive about. ("kys" and
  // "kms" are deliberately absent: on a key with no word boundaries they fire on
  // the game's own vocabulary — "SkySwift" contains "kys".)
  "suicide", "selfharm", "proana", "thinspo", "anorex", "bulimi",
  // drug / violence-adjacent
  "meth", "heroin", "cocaine", "cannabis", "marijuana", "fentanyl", "opioid",
  "mdma", "ecstasy", "ketamine", "xanax", "adderall", "weed", "crack",
  "terrorist", "jihad", "rapist", "incest", "bestiality", "necrophil",
];

/**
 * Words that legitimately contain a blocked substring. A blocklist hit is
 * discarded when it falls inside one of these (see stage 4 above). Kept as
 * whole words on the squashed key, so "classic" protects "ass" but "class" +
 * "ass" as two names still does not.
 */
const SAFE_WORDS = [
  // …contain "ass"
  "assassin", "assassins", "assess", "asset", "assets", "assign", "assist",
  "assist", "associate", "assorted", "assume", "assurance", "bass", "brass",
  "bypass", "canvass", "cassette", "cassidy", "class", "classic", "classy",
  "compass", "embassy", "glass", "grass", "harass", "mass", "massive",
  "pass", "passage", "passenger", "passion", "passive", "password", "sass",
  // …contain "cock"
  "cockpit", "cockatoo", "cockerel", "hancock", "peacock", "shuttlecock",
  "woodcock",
  // …contain "dick"
  "dickens", "dickson", "dickinson",
  // …contain "fag" / "tit" / "piss" / "meth" / "coon"
  "fagan", "fagen", "constitution", "institution", "substitute", "attitude",
  "latitude", "altitude", "multitude", "gratitude", "solitude", "plenitude",
  "epitome", "raccoon", "tycoon", "cocoon", "methane", "method", "methodist",
  "prissy", "crisp", "cockade", "cockle", "peacock",
  // aviation / nature vocabulary the generator draws from
  "kestrel", "skimmer", "plover", "osprey", "harrier", "merlin", "condor",
  "peregrine", "phoenix", "raven", "falcon", "eagle", "hawk", "swift", "gull",
  "solar", "storm", "zenith", "aero", "vortex", "thunder", "nimbus", "astra",
  "blaze", "nova", "cosmic", "hyper", "sonic", "apex", "glide", "horizon",
  "orion",
  // …contain "sex" — English places and surnames, and a sextant is an instrument
  "essex", "sussex", "middlesex", "sexton", "sextant", "unisex",
  // …contain "weed" / "crack"
  "seaweed", "tumbleweed", "duckweed", "milkweed", "ragweed",
  "crackle", "nutcracker", "wisecrack",
  // …contain "spic"
  "spice", "spicy", "auspicious", "conspicuous", "perspicacious", "spicule",
  // …contain "heroin"
  "heroine",
  // …contain "paki"
  "pakistan", "pakistani",
  // …contain "semen" / "rapist" / "milf" — the classic Scunthorpe traps
  "basement", "debasement", "therapist", "milford",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t",
  "8": "b", "9": "g", "!": "i", "|": "i", "@": "a", "$": "s", "+": "t",
};

/** Latin lookalikes NFKD does not fold. Cyrillic and Greek supply most of them,
 * but dotless ı (U+0131) and a few Nordic/edge Latin letters are used in the
 * same way and survive normalisation untouched, so "nıgger" would otherwise
 * read as a clean word. */
const HOMOGLYPH: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i", ѕ: "s",
  ј: "j", ԁ: "d", һ: "h", к: "k", м: "m", н: "h", т: "t", в: "b", ν: "v",
  ρ: "p", ο: "o", α: "a", ε: "e", ι: "i", κ: "k", μ: "u", τ: "t", υ: "u",
  χ: "x", η: "n", θ: "o", ı: "i", ł: "l", ø: "o", đ: "d", ħ: "h", ŧ: "t",
  ĸ: "k", ſ: "s", ɡ: "g", ɩ: "i",
};

/** Multi-character folds, applied before the single-character map. */
const DIGRAPHS: [RegExp, string][] = [
  [/ß/g, "ss"], [/æ/g, "ae"], [/œ/g, "oe"], [/þ/g, "th"], [/ð/g, "d"],
];

/**
 * Names that claim to be somebody: the platform, the game, or its staff. Matched
 * against the WHOLE squashed key (with trailing digits ignored), so "poki" and
 * "poki42" are refused but "Pokifan" is not — impersonation is the problem, not
 * enthusiasm.
 */
const RESERVED = [
  "admin", "administrator", "moderator", "official", "staff", "support",
  "developer",
];

/** What `savePilotName()` keeps. Anything else is stripped before storage. */
const ALLOWED_CHARS = /^[\p{L}\p{N} _.-]+$/u;

/** Contact details players must not be able to publish through a name. */
const CONTACT = [/@/, /https?:/i, /www\./i, /\b\d{7,}\b/, /\p{L}\.\p{L}\.\p{L}/u];

/** Fold a raw name into the key the blocklist is matched against.
 *
 *  `leet` is off for the reserved-name check: folding digits into letters turns
 *  "Poki42" into "pokia2", which no longer looks like the name it is claiming. */
export function normalizePilotName(raw: string, leet = true): string {
  let s = raw.normalize("NFKD");
  // Strip combining marks (é → e) and any zero-width/control characters, which
  // are the cheapest way to break a naive substring filter.
  s = s.replace(/\p{M}+/gu, "").replace(/[\p{Cc}\p{Cf}\u200B-\u200D\uFEFF]/gu, "");
  s = s.toLowerCase();
  for (const [re, to] of DIGRAPHS) s = s.replace(re, to);
  let out = "";
  for (const ch of s) {
    const folded = HOMOGLYPH[ch] ?? (leet ? LEET[ch] : undefined) ?? ch;
    // NFKD already decomposed fullwidth forms to ASCII; keep the rest.
    out += folded;
  }
  // Collapse stretched characters ("fuuuuck") but leave doubles alone so that
  // legitimate names ("Gull") survive.
  return out.replace(/(.)\1{2,}/g, "$1");
}

/** The separator-free key: "f.u.c.k" and "f u c k" both become "fuck". */
export function squashPilotName(normalized: string): string {
  return normalized.replace(/[^a-z0-9]/g, "");
}

/**
 * A second key for spellings that are not leetspeak but sound the same:
 * "ph" → "f", "q" → "k", "x" → "ck", "ck" → "k", doubled consonants collapsed.
 * It is what catches "fuxk", "fuq" and "phuk" without a blocklist entry per
 * spelling — and it is only ever matched against that same list, which is why
 * the folds can be this blunt without turning into false positives.
 */
export function phoneticPilotName(key: string): string {
  return key
    .replace(/ph/g, "f")
    .replace(/q/g, "k")
    .replace(/x/g, "ck")
    .replace(/ck/g, "k")
    // "y" is deliberately NOT folded to "i": it is the obvious vowel
    // substitution, and it turns "SkyKestrel" into "skikestrel", which contains
    // "kike" — i.e. it refuses the game's own sky vocabulary. Spellings that need
    // it are listed instead, which costs one line and breaks nothing.
    .replace(/([bcdfgklmnprstvz])\1+/g, "$1");
}

/**
 * The name reduced to letters, for reserved-name checks. Digits and separators
 * go, and leet folding is skipped, so "Poki42", "P0ki" and "P-o-k-i" all still
 * read as a claim to be Poki.
 */
export function lettersOnlyPilotName(raw: string, leet = false): string {
  return normalizePilotName(raw, leet).replace(/[^a-z]/g, "");
}

/** Keys the blocklist is matched against, in order. */
function keysFor(name: string): string[] {
  const key = squashPilotName(normalizePilotName(name));
  return [key, phoneticPilotName(key)];
}

/** True when [start,end) of `key` falls inside an allowlisted safe word. */
function coveredBySafeWord(key: string, start: number, end: number, list: string[] = SAFE_WORDS): boolean {
  for (const safe of list) {
    let at = key.indexOf(safe);
    while (at !== -1) {
      if (start >= at && end <= at + safe.length) return true;
      at = key.indexOf(safe, at + 1);
    }
  }
  return false;
}

function blockedHitIn(key: string, foldSafeWords: boolean): string | null {
  const safe = foldSafeWords ? SAFE_WORDS.map(phoneticPilotName) : SAFE_WORDS;
  for (const term of BLOCKED) {
    let at = key.indexOf(term);
    while (at !== -1) {
      if (!coveredBySafeWord(key, at, at + term.length, safe)) return term;
      at = key.indexOf(term, at + 1);
    }
  }
  return null;
}

/** The first blocked term any of the name's keys exposes. */
function firstBlockedHit(name: string): string | null {
  const keys = keysFor(name);
  for (let i = 0; i < keys.length; i += 1) {
    // The folded key is matched against the folded covers, so a safe word that
    // folds into a blocked one is still recognised as safe.
    const hit = blockedHitIn(keys[i]!, i > 0);
    if (hit) return hit;
  }
  return null;
}

/** True when the name is claiming to be the platform, the game, or its staff. */
function isReserved(raw: string, extra: readonly string[]): boolean {
  // Both readings, because the two folds each hide a different spelling: without
  // leet folding "Poki42" still reads as "poki", and with it "P0ki" does. Either
  // one alone lets the other through.
  const list = [...RESERVED, ...extra];
  return (
    list.includes(lettersOnlyPilotName(raw, false)) ||
    list.includes(lettersOnlyPilotName(raw, true))
  );
}

export type PilotNameVerdict =
  | { ok: true }
  | { ok: false; reason: "shape" | "contact" | "language" };

/**
 * Full verdict, with the failing stage, so the UI can say something more useful
 * than "not allowed".
 */
export function moderatePilotName(
  raw: string,
  reserved: readonly string[] = RESERVED_PILOT_NAMES,
): PilotNameVerdict {
  const name = raw.trim();
  if (name.length < PILOT_NAME_MIN || name.length > 14) return { ok: false, reason: "shape" };
  // Contact details first, so an "@handle" or a URL reports the honest reason
  // rather than a charset complaint.
  if (CONTACT.some((re) => re.test(name))) return { ok: false, reason: "contact" };
  if (!ALLOWED_CHARS.test(name)) return { ok: false, reason: "shape" };
  // At least two letters: digits-and-punctuation-only names are not call signs.
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return { ok: false, reason: "shape" };
  if (firstBlockedHit(name)) return { ok: false, reason: "language" };
  if (isReserved(name, reserved)) return { ok: false, reason: "language" };
  return { ok: true };
}

/** Returns true when the name is acceptable to broadcast to other players. */
export function isPilotNameClean(name: string): boolean {
  return moderatePilotName(name).ok;
}

/** Player-facing copy for a rejection, so the message matches the reason
 * instead of one generic "not allowed" for three different problems. */
export function pilotNameRejection(reason: "shape" | "contact" | "language"): string {
  switch (reason) {
    case "contact":
      return "Call signs can't carry links or contact details";
    case "language":
      return "That call sign isn't allowed — try a different one";
    default:
      return `Call signs are ${PILOT_NAME_MIN}–14 letters, numbers, spaces or _ . -`;
  }
}
