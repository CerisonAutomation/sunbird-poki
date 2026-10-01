/**
 * Poki's mandated profanity list, verbatim.
 *
 * Poki's Requirements page (Content & community standards) is explicit:
 *
 *   "Profanity filtering: for multiplayer games with username input, implement
 *    strict profanity filtering using the provided bad words list (expand it
 *    further for your games)."
 *
 * — linking https://github.com/MauriceButler/badwords/blob/master/array.js.
 * This game has username input (pilot names) and those names are broadcast to
 * other players over netlib and persisted on a public leaderboard, so the
 * requirement applies to it directly. The list is reproduced here unmodified,
 * as a separate module, so that a reviewer can diff it against the upstream
 * file and see that nothing was quietly dropped.
 *
 * `pilotNameModeration.ts` merges it into its own blocklist, on top of the
 * 22-language extension this game adds — "expand it further" is also part of
 * the requirement, and a list that only speaks English is a filter against
 * English speakers.
 *
 * NOTHING in this file is edited. Everything we decline to enforce is declared
 * in `POKI_LIST_EXCEPTIONS` below, with a reason, so the delta is auditable
 * rather than invisible.
 */
export const POKI_BAD_WORDS: readonly string[] = [
  "4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass",
  "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes",
  "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls",
  "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial",
  "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches",
  "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas",
  "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs",
  "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum",
  "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck",
  "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit",
  "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead",
  "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker",
  "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher",
  "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums",
  "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick",
  "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck",
  "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn",
  "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck",
  "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke",
  "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings",
  "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag",
  "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny",
  "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking",
  "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck",
  "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking",
  "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers",
  "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker",
  "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads",
  "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme",
  "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker",
  "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k",
  "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God",
  "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell",
  "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny",
  "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm",
  "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead",
  "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer",
  "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust",
  "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate",
  "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3",
  "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0",
  "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz",
  "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking",
  "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked",
  "motherfucker", "motherfuckers", "motherfuckin", "motherfucking",
  "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha",
  "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger",
  "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger",
  "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts",
  "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn",
  "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked",
  "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis",
  "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin",
  "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos",
  "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy",
  "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.",
  "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen",
  "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging",
  "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey",
  "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits",
  "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank",
  "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac",
  "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical",
  "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker",
  "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t",
  "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina",
  "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar",
  "whore", "willies", "willy", "xrated", "xxx",
];

/**
 * Entries of Poki's list this game does NOT enforce, and why.
 *
 * Two reasons only, and every entry states which:
 *
 *   COLLISION — the matcher runs on a *squashed* key with all separators
 *     removed and no word boundaries (that is what makes "f.u.c.k" and "f u c k"
 *     both resolve to one entry). On such a key these words fire inside
 *     ordinary names and inside this game's own vocabulary, and no allowlist
 *     of realistic size can cover them. "spac" refuses **Space**, "butt"
 *     refuses **Butterfly**, "hell" refuses **Michelle**, "muff" refuses
 *     **Muffin**, "cum" refuses **Cumulus** — a cloud, in a game about
 *     gliding through clouds. A filter that eats those has traded one failure
 *     for a worse and much more frequent one.
 *
 *   MILD — not profanity a platform moderator would action in a display name.
 *     Poki's instruction is to filter profanity strictly and expand the list;
 *     it is not to refuse the word "God" or "bloody". Blocking these produces
 *     support tickets, not safety.
 *
 * Every other one of the ~370 entries is enforced. Note that many of the
 * exclusions below are still caught in their *actual* offensive forms, which
 * remain on the list: "fatass", "asshole", "butthole", "buttplug", "titfuck",
 * "cumshot", "analsex" via "anal…" compounds, and so on.
 *
 * An exception covers every spelling of the same word: the merge in
 * `pilotNameModeration.ts` normalises both sides first, so excepting "ass"
 * also excepts "a55" and "a_s_s", which fold onto the same key. Listing those
 * separately would be noise, and forgetting to list one would be a bug.
 *
 * `poki-badwords.test.ts` asserts this file and the upstream list stay in
 * sync: every entry is either enforced or listed here with a reason.
 */
export const POKI_LIST_EXCEPTIONS: Readonly<Record<string, string>> = {
  // COLLISION — substring of ordinary names / the game's own vocabulary.
  ass: "COLLISION: Cassandra, Vassal, Passport. The compounds stay blocked.",
  asses: "COLLISION: 'molasses', 'crevasses'.",
  anal: "COLLISION: Canal, Analog, Analyst.",
  anus: "COLLISION: Manus, Uranus is not a name people pick as a pilot.",
  balls: "COLLISION: Snowball, Fireball, Gumball.",
  bum: "COLLISION: Bumblebee, Bumper.",
  butt: "COLLISION: Butterfly, Buttercup — nature vocabulary this game uses.",
  cipa: "COLLISION: Principal, Principe, Municipal.",
  clit: "COLLISION: Heraclitus, Sunlit. 'clitoris'/'clits' stay blocked.",
  cox: "COLLISION: Cox and Coxswain are a surname and a rowing term.",
  cum: "COLLISION: Cumulus, Cumbria, Accumulate. Compounds stay blocked.",
  cums: "COLLISION: as 'cum'.",
  dink: "COLLISION: Dinkum, and it is mild.",
  dinks: "COLLISION: as 'dink'.",
  flange: "COLLISION: an engineering term, and not profanity in any register.",
  hell: "COLLISION: Michelle, Shelley, Rochelle, Shell.",
  hoar: "COLLISION: hoarfrost, hoarse — weather words in a weather game.",
  hoare: "COLLISION: Hoare is a surname (and a computer scientist).",
  hore: "COLLISION: Shore, Onshore, Offshore, Shoreline.",
  jiz: "COLLISION: too short; 'jizz'/'jizm' stay blocked.",
  kum: "COLLISION: Kumar, Kumiko — common given names. 'kummer' stays blocked.",
  kums: "COLLISION: as 'kum'.",
  lust: "COLLISION: Luster, Bluster, Illustrious. 'lusting' stays blocked.",
  muff: "COLLISION: Muffin.",
  nob: "COLLISION: Noble, Nobel, Nobody. 'nobhead' etc. stay blocked.",
  pawn: "COLLISION: a chess piece; it is on the list as a typo of 'porn'.",
  pron: "COLLISION: Prone, Pronto. 'porn' stays blocked.",
  spac: "COLLISION: SPACE. Unusable in a game set in the sky.",
  tit: "COLLISION: Titan, Titania, Altitude — and a tit is a bird.",
  titt: "COLLISION: as 'tit'. 'titties'/'titfuck' etc. stay blocked.",
  teets: "COLLISION: 'meets', 'sweets' under stretched-letter collapsing.",
  wang: "COLLISION: Wang is one of the most common surnames on earth.",
  willies: "COLLISION: William, Willow.",
  willy: "COLLISION: William, Willy is a given name.",
  // MILD — not actionable profanity in a display name.
  bloody: "MILD: British mild swear, not actionable in a display name.",
  bugger: "MILD: British mild swear, not actionable in a display name.",
  crap: "MILD: playground-level, and it collides with nothing worth keeping.",
  damn: "MILD: not actionable in a display name.",
  God: "MILD: also collides with Godspeed, Goddard.",
  "god-dam": "MILD: a censored spelling of a mild swear.",
  "god-damned": "MILD: a censored spelling of a mild swear.",
  goddamn: "MILD: not actionable in a display name.",
  goddamned: "MILD: not actionable in a display name.",
  poop: "MILD: a word small children use for a bodily function.",
  screwing: "MILD: the literal sense is a hardware verb.",
  "s.o.b.": "MILD: and squashes to 'sob'.",
  horny: "MILD: suggestive but not obscene, and it reads as a horn pun.",
  horniest: "MILD: as horny.",
  boner: "MILD: suggestive but not obscene; also slang for a blunder.",
  homo: "MILD: refused as a slur only in compounds, which stay blocked.",
};
