import { describe, expect, it } from "vitest";
import { POKI_BAD_WORDS, POKI_LIST_EXCEPTIONS } from "../pokiBadWords";
import { isPilotNameClean } from "../pilotNameGenerator";
import { normalizePilotName, squashPilotName } from "../pilotNameModeration";

/**
 * Poki's Requirements page, Content & community standards:
 *
 *   "Profanity filtering: for multiplayer games with username input, implement
 *    strict profanity filtering using the provided bad words list (expand it
 *    further for your games)."
 *
 * This game has username input, and those names reach other players over
 * netlib and a public leaderboard, so the requirement is load-bearing rather
 * than advisory. These tests are the evidence that it is met, and — just as
 * importantly — the evidence that meeting it did not break the name field for
 * everyone with an ordinary name.
 */
describe("Poki's mandated bad-words list", () => {
  const key = (word: string): string => squashPilotName(normalizePilotName(word));

  it("is enforced entry by entry, or excepted with a stated reason", () => {
    // An exception covers every spelling of the same word, because the merge
    // normalises both sides: excepting "ass" also excepts "a55" and "a_s_s".
    const exceptedKeys = new Set(Object.keys(POKI_LIST_EXCEPTIONS).map(key));
    const unexplained: string[] = [];
    for (const word of POKI_BAD_WORDS) {
      if (exceptedKeys.has(key(word))) continue;
      // Entries under three characters are dropped deliberately: on a key with
      // no word boundaries they match nearly everything, and each is covered
      // by a longer entry on the same list.
      if (key(word).length < 3) continue;
      if (isPilotNameClean(`${word} pilot`)) unexplained.push(word);
    }
    expect(unexplained, `unenforced and unexplained: ${unexplained.join(", ")}`).toEqual([]);
  });

  it("every exception carries a reason, and it is one of the two allowed kinds", () => {
    for (const [word, reason] of Object.entries(POKI_LIST_EXCEPTIONS)) {
      expect(POKI_BAD_WORDS, `${word} is not on the upstream list`).toContain(word);
      expect(reason.startsWith("COLLISION") || reason.startsWith("MILD"), `${word}: ${reason}`).toBe(true);
      expect(reason.length, `${word} needs a real reason`).toBeGreaterThan(8);
    }
  });

  it("keeps the exception list small — it is a delta, not a rewrite", () => {
    // If this ever grows past a seventh of the list, the filter has stopped
    // implementing Poki's requirement and started quietly ignoring it.
    expect(Object.keys(POKI_LIST_EXCEPTIONS).length).toBeLessThan(POKI_BAD_WORDS.length / 7);
  });

  it("still refuses the worst of the list in its evasion spellings", () => {
    const evasions = [
      "F.U.C.K.er", "5h1t head", "N1gg3r", "c0cksucker", "phuq you",
      "M0therfuck", "b!tch", "Wh0re", "cuntlick", "tw4t",
    ];
    for (const name of evasions) {
      expect(isPilotNameClean(name), `"${name}" got through`).toBe(false);
    }
  });
});

/**
 * The other half of the requirement, and the half that is easy to fail
 * silently. A filter is judged by what it wrongly refuses at least as much as
 * by what it catches: every false positive here is a real person being told
 * their own name is obscene, on a platform whose players are mostly children.
 *
 * This corpus is drawn from the collisions the merged list actually produces:
 * common given names and surnames, and the game's own aviation, weather and
 * nature vocabulary.
 */
describe("the merged list does not eat ordinary names", () => {
  const corpus = [
    // Given names and surnames that collide with list entries.
    "Cassandra", "Michelle", "Shelley", "Rochelle", "William", "Willow",
    "Wang Wei", "Kumar", "Kumiko", "Noble", "Nobel", "Hancock", "Cox",
    "Titania", "Brandi", "Cornelia", "Penelope", "Jose Ruiz", "Sofia",
    // Words the game itself uses, or that a pilot would pick.
    "Space Ace", "Butterfly", "Buttercup", "Bumblebee", "Cumulus", "Nimbus",
    "Muffin", "Snowball", "Fireball", "Shoreline", "Offshore", "Hoarfrost",
    "Altitude", "Latitude", "Sunlit", "Analog", "Canal Pilot", "Compass",
    "Classic", "Cockpit", "Peacock", "Woodpecker", "Cockatoo", "Assassin",
    "Passenger", "Sextant", "Essex", "Spice", "Heroine", "Basement",
    "Therapist", "Prone", "Pronto", "Luster", "Bluster", "Principal",
    "Unique", "Apollo", "Computer", "Godspeed", "Municipal",
  ];

  for (const name of corpus) {
    it(`accepts "${name}"`, () => {
      expect(isPilotNameClean(name)).toBe(true);
    });
  }
});
