/**
 * Surprises — the "did that just happen?!" engine.
 *
 * Slot-machine psychology, but generous: rare delightful events fire during
 * ordinary flight so no two runs feel identical. Every surprise is
 * strictly positive or neutral-funny — surprises never punish, because
 * random punishment reads as unfair and breaks flow.
 *
 * Design rules:
 *  - at most ONE surprise per run window (45s cooldown) so they stay special
 *  - probability ramps with distance flown, so long runs earn more delight
 *  - all rolls go through a caller-provided RNG hook for testability
 */

export type SurpriseKind =
  | "golden-goose" // a golden goose flies past honking, drops a coin shower
  | "tailwind" // sudden friendly tailwind + slide whistle
  | "sneeze" // the bird sneezes mid-air. That's it. That's the feature.
  | "coin-comet" // a comet of coins streaks overhead
  | "photobomb" // a giant fish photobombs a jump over water
  | "encore" // the music flips to fever mode for 8s, free
  | "moonbow" // a moonbow arcs over the islands — pure delight, no strings
  | "flock-chorus"; // a V-formation of birds honks past and tips you

export type Surprise = {
  kind: SurpriseKind;
  toast: string;
  /** coins granted immediately (0 for pure-comedy events) */
  coins: number;
  /** seconds of free fever, 0 if none */
  feverSeconds: number;
};

const POOL: { kind: SurpriseKind; weight: number; toasts: string[]; coins: number; fever: number }[] = [
  {
    kind: "golden-goose",
    weight: 3,
    toasts: [
      "🦢 A golden goose honks past — it's raining coins!",
      "🦢 The golden goose approves of your form!",
      "🦢 Goose: 'Nice flying, kid. Here's rent money'",
      "🦢 That goose just Venmo'd you coins. Geese have Venmo now",
      "🦢 Golden goose says you're doing amazing sweetie! +25 coins",
    ],
    coins: 25,
    fever: 0,
  },
  {
    kind: "moonbow",
    weight: 2,
    toasts: [
      "🌈 A moonbow arcs over the islands. The sky is showing off",
      "🌈 Seven colours, zero explanation. Fly through it anyway",
      "🌈 The islands hired a lighting designer. It was the sky",
      "🌈 The sky just said 'look what I can do!' — show-off",
      "🌈 Moonbow! Even the moon is trying to impress you!",
    ],
    coins: 0,
    fever: 0,
  },
  {
    kind: "flock-chorus",
    weight: 2,
    toasts: [
      "🪿 A flock flies past in perfect V — they tip you for the show",
      "🪿 The formation team requests you keep the window seat",
      "🪿 Squad of geese salutes you with one honk each",
      "🪿 Geese: 'We practiced this V for you. You're welcome'",
      "🪿 Those geese just gave you a standing ovation. In the air!",
    ],
    coins: 10,
    fever: 0,
  },
  {
    kind: "tailwind",
    weight: 5,
    toasts: [
      "💨 Freak tailwind! The sky is on your side",
      "💨 The wind remembered it owes you one",
      "💨 The atmosphere decided to be helpful for once",
      "💨 Unexpected wind. Your feathers: impressed",
      "💨 Wind: 'I got you bro' — you: *zooms*",
      "💨 That tailwind was so strong, even your shadow sped up!",
    ],
    coins: 0,
    fever: 0,
  },
  {
    kind: "sneeze",
    weight: 4,
    toasts: [
      "🤧 The bird sneezed. Aerodynamics unaffected. Dignity: lost",
      "🤧 Achoo! Feathers everywhere",
      "🤧 Mid-flight sneeze. Zero regrets",
      "🤧 That sneeze reached Mach 0.4. Impressive",
      "🤧 Bird flu? No, just flying flu. Very contagious. Very fast",
      "🤧 That sneeze was so powerful, it added +2 speed. Science!",
    ],
    coins: 0,
    fever: 0,
  },
  {
    kind: "coin-comet",
    weight: 3,
    toasts: [
      "☄ A coin comet streaks by — grab the debris!",
      "☄ Coin comet! Someone up there likes you",
      "☄ That comet was literally made of money. You: *yoink*",
      "☄ Coin comet! The universe has a tip jar and it's for you!",
    ],
    coins: 15,
    fever: 0,
  },
  {
    kind: "photobomb",
    weight: 2,
    toasts: [
      "🐟 A fish photobombed your jump. It will tell its friends",
      "🐟 That fish has seen things",
      "🐟 Fish: 'I was just swimming here and this bird...'",
      "🐟 That fish will have a story for its fish kids tonight!",
    ],
    coins: 5,
    fever: 0,
  },
  {
    kind: "encore",
    weight: 3,
    toasts: [
      "🎶 The band plays an encore — free fever!",
      "🎶 Surprise encore! Ride the beat",
      "🎶 The DJ looked at your speed and said 'yes'",
      "🔥 Mystery heat detected. Fever granted by the universe",
      "🎶 The sky just dropped a beat. You dropped a fever!",
      "🔥 The sun said 'you're hot' and meant it literally!",
    ],
    coins: 0,
    fever: 8,
  },
];

const COOLDOWN_S = 45;
/** No surprises in the first stretch — let the player settle into the run. */
const MIN_DISTANCE_M = 320;
/**
 * First-flights are held to a stricter contract than the rest of the game: a
 * new player must meet something delightful inside ~20 seconds, or they meet
 * the menu again instead. Warm mode shortens the fuse and lowers the distance
 * gate for the opening surprise only, then hands the run back to the normal
 * rarity curve — the guarantee is about the first laugh, not about spam.
 */
const WARM_COOLDOWN_S = 6;
const WARM_MIN_DISTANCE_M = 140;

export class SurpriseEngine {
  private cooldown = 0;
  private fired = 0;
  private lastKind: SurpriseKind | null = null;
  private warm = false;

  /** @param opts.warm first-session mode: the opening surprise arrives fast. */
  reset(opts: { warm?: boolean } = {}): void {
    this.warm = Boolean(opts.warm);
    // small warm-up before the first one is possible (much shorter when warm)
    this.cooldown = this.warm ? WARM_COOLDOWN_S : 18;
    this.fired = 0;
    this.lastKind = null;
  }

  /**
   * Call once per second-ish of flight. Returns a surprise to perform, or
   * null. `rng` is injected for determinism in tests.
   */
  tick(dt: number, distance: number, airborne: boolean, rng: () => number = Math.random): Surprise | null {
    this.cooldown -= dt;
    const gate = this.warm ? WARM_MIN_DISTANCE_M : MIN_DISTANCE_M;
    if (this.cooldown > 0 || !airborne || distance < gate) return null;
    // Base 1.2%/check, ramping slightly with distance; capped so it stays rare.
    // Warm mode roughly doubles the opening odds so the first flight reliably
    // contains one surprise instead of usually containing one.
    const base = this.warm ? 0.026 : 0.012;
    const p = Math.min(this.warm ? 0.06 : 0.035, base + distance / 220_000);
    if (rng() >= p) return null;
    this.cooldown = COOLDOWN_S * (1 + this.fired * 0.5); // each one rarer than the last
    this.fired += 1;
    // The guarantee has been paid: the rest of the run uses the normal gate.
    this.warm = false;
    // Never serve the exact same surprise twice in a row — variety is the point.
    let surprise = pickSurprise(rng);
    let guard = 0;
    while (surprise.kind === this.lastKind && guard++ < 6) surprise = pickSurprise(rng);
    this.lastKind = surprise.kind;
    return surprise;
  }
}

export function pickSurprise(rng: () => number = Math.random): Surprise {
  const total = POOL.reduce((a, e) => a + e.weight, 0);
  let roll = rng() * total;
  let entry = POOL[POOL.length - 1]!;
  for (const e of POOL) {
    roll -= e.weight;
    if (roll <= 0) {
      entry = e;
      break;
    }
  }
  const toast = entry.toasts[Math.floor(rng() * entry.toasts.length)] ?? entry.toasts[0]!;
  return { kind: entry.kind, toast, coins: entry.coins, feverSeconds: entry.fever };
}

/* ------------------------------------------------------------------ */
/* Comedy flavour lines: sprinkled into ordinary moments.             */
/* ------------------------------------------------------------------ */

export const SPLASH_QUIPS = [
  "Not a crash. A very enthusiastic bath",
  "The fish gave that landing a standing ovation",
  "New skill unlocked: damp",
  "The ocean: 1 · Bird: 0",
  "That was a swan dive. You are not a swan",
  "The fish demand an apology",
  "Water landing! The geese are laughing",
  "Soggy. Judged. 6/10 for commitment",
  "The tide does not respect your personal best",
  "You've invented swimming. Reluctantly",
  "Somewhere a beach umbrella just closed in sympathy",
  "You didn't land. You filed a water report",
  "The fish have accepted your résumé",
  "Splash. The ocean is calling HR",
  "Belly-flop so clean the seagulls applauded",
  "The ocean has added you to its contacts",
  "Congratulations: you are now 80% water",
  "The bird requested a towel and a lawyer",
  // new — 2026 batch
  "Plot twist: the bird can't swim. The fish are judging",
  "Splashed so hard the mermaids filed a noise complaint",
  "The crab gave it a 9.4 for artistic interpretation",
  "Fully cooked. Like a bird nugget",
  "That's not a landing — that's a baptism",
  "The ocean politely declined your altitude",
  "Somewhere a lifeguard sighed so hard they retired",
  "The bird will not be signing autographs today",
  "Physics said no. The ocean said yes",
  "That splash echoed all the way to the leaderboard (downward)",
  "The ocean rates this flight 'wet'",
  "A whale just asked for your insurance details",
  "You have been promoted to submarine",
  "That landing came with a free fish",
  "The water was here first, honestly",
  "Seagulls are filing this under 'content'",
  "10 for entry, 0 for exit, 10 for confidence",
  "The fish formed a committee about you",
  "Splashdown confirmed. Dignity pending",
  "The pond will remember this",
];

export const SLEEP_QUIPS = [
  "The sun clocked out. So did the bird",
  "Nap time is undefeated",
  "Zzz… dreaming of thermals",
  "Filed under: birds who almost made it",
  "The horizon won this round",
  "Somewhere, a worm sighs in relief",
  "Sleep now. Revenge at sunrise",
  "The bird has left the flight simulator",
  "You flew until the sky filed for overtime",
  "The moon is covering your shift. Badly",
  "Eyelids heavier than the headwind",
  "Gravity tucked you in without asking",
  "The moon has taken over. Chaos follows",
  "Fell asleep like a professional. Fully certified",
  "The stars are just tucking you in now",
  // new — 2026 batch
  "The sun is not coming back. You've been ghosted by a star",
  "Night mode: activated. Bird mode: offline",
  "The darkness is just the sky's way of saying 'okay that's enough'",
  "Wings folded. Dreams commencing. Do not disturb",
  "The owls have taken over. You are not prepared",
  "The sun signed off. Management sends regards",
  "Bedtime: enforced by gravity",
  "The bird is buffering. Please hold",
  "Dreaming of flying. Doing it horizontally",
  "Moon: on duty. Bird: not so much",
  "The night shift begins without you",
  "You have been tucked in by physics",
  "Stars: 5. Altitude: dropping. Snoring: likely",
  "Shutdown sequence complete. See you at dawn",
  "The horizon asked you to stay. You declined, sideways",
];

export const BIG_LAUNCH_QUIPS = [
  "Local bird forgets to be flightless",
  "Cabin crew: prepare for absolutely nothing",
  "Your shadow would like you to slow down",
  "The sun did not order express delivery",
  "Next stop: probably not this island",
  "Wings: tiny. Confidence: unreasonable",
  "The hill said YEET",
  "FAA would like a word",
  "Gravity has filed a complaint",
  "That wasn't flying. That was leaving",
  "NASA called. They want notes",
  "The clouds are pressing charges",
  "Physics rage-quit",
  "Air traffic control has questions",
  "Local bird breaks sound barrier, polite about it",
  "The ground waved bye-bye",
  "That launch had a lawyer on retainer",
  "Momentum called dibs on you",
  "Gravity is checking its insurance policy",
  "That flap violated several physics bylaws",
  "The sky wasn't ready for that. Rude of you",
  "Zero to hero in one flap. The worms gasped",
  // new — 2026 batch
  "The atmosphere just filed for overtime",
  "Warning: bird is now a projectile",
  "Aeronautically illegal in seven countries",
  "The ramp peaked. So did the bird",
  "Going up. Way up. Embarrassingly up",
  "That hill was a slingshot in disguise",
  "Scientists just updated their models",
  "The birds in the distance said 'how'",
  "SkyFlight™ has entered the chat",
  "The clouds took a step back. Respect",
  "You just graduated from bird to spacecraft",
  "Control room: all nominal. All extremely nominal",
  "The hill just gave you a scholarship to the sky",
  "Tower: cleared for shenanigans",
  "Your flight path is now a rumor",
  "The birds up here are taking notes",
  "Altitude so unreasonable the clouds filed it",
  "Launch reviewed: 'unnecessary, magnificent'",
  "Gravity called. It's fine. It's used to it",
  "The horizon filed a missing-bird report",
  "That was less a jump, more a resignation from the ground",
  "The moon has you on its calendar now",
];

/** Fresh pool: fever ignites. */
export const FEVER_QUIPS = [
  "The bird has entered its villain arc",
  "Somewhere, the sun is taking notes",
  "MAXIMUM BIRB",
  "This is legally a heatwave now",
  "The clouds are just spectators at this point",
  "Molten. Fully molten",
  "The thermometer just gave up and left",
  "You're flying like you stole the wind",
  "Wings are now 100% afterburner, 0% regret",
  // new — 2026 batch
  "The bird discovered what 'fast' actually means",
  "FEVER: activated. Common sense: on vacation",
  "Sun goes brrrrr",
  "The bird is no longer asking for permission",
  "At this speed, the wind owes YOU an apology",
  "The government is watching. Jealously",
  "Feathers on fire. No notes",
  "The bird is now considered weather",
  "Heat shield? No. This IS the heat shield",
  "Local temperature: yes",
  "The sun called. It wants its act back",
  "This is not a fever. This is a lifestyle",
  "Fireflies are taking photos",
  "Speedometer just retired, happily",
  "The wind gave up and started following",
  "Combustion is temporary. Glory is forever",
  "The thermometer melted into a sundial",
];

/** Fresh pool: sky-gem pickups. */
export const GEM_QUIPS = [
  "That gem has been waiting its whole life for this",
  "Sparkly. Like a very fast disco",
  "The gem squealed. You heard nothing",
  "One more and the ocean gets jealous",
  "Polished to perfection — now it's yours",
];

/** Fresh pool: distance milestones. */
export const MILESTONE_QUIPS = [
  "The horizon just got smaller",
  "Your legs are a rumor now",
  "Distance: legally considered 'far'",
  "The map is updating its notes on you",
  "You're collecting horizon, one flap at a time",
  "Somewhere a mile marker salutes",
  "Your shadow is running late",
  "The birds in the next valley are gossiping about you",
  "A new distance record. The previous one is filing a complaint",
];

/** Rotating impact words for hard landings — short, punchy, onomatopoeic. */
export const THUD_QUIPS = [
  "THUD!",
  "THUNK!",
  "CLUNK!",
  "BONK!",
  "WHAM!",
  "CRUNCH!",
  "SPLAT!",
  "SMACK!",
  "CLONK!",
  "OOOF!",
  "BUMP!",
  "BOOF!",
  "THWACK!",
  "DONK!",
  "WHUMP!",
  "OUCH!",
  "DOOF!",
  "PLONK!",
  "KAPLOP!",
  "WHOOPS!",
  "THE GROUND WINS!",
  "THWAP!",
  "KRUNCH!",
  "DOINK!",
  "POMF!",
  "THUD, BUT PERSONAL!",
];

/** Rotating bop words for bounces (water, sunflower, balloon). */
export const BOP_QUIPS = [
  "BOP!",
  "BOING!",
  "SPROING!",
  "BOUNCE!",
  "PING!",
  "DOING!",
  "BLOOP!",
  "WHOMP!",
  "BOOP!",
  "SPRONG!",
  "HOP!",
  "WHEEE!",
  "TWANG!",
  "PLIP!",
  "BOINK!",
  "PIP!",
  "BAP!",
  "BWOMP!",
  "BLIP!",
];

/** Fresh pool: giving up mid-run. */
export const SURRENDER_QUIPS = [
  "The bird has chosen dignity. Bold move",
  "Retreat? We call it 'tactical sunshine'",
  "The sky will tell tales of your almost-flight",
  "You can't lose if you're just resting. That's the rule",
  "The worm breathes easy once more",
  "Abort mission. The sun looked at us funny",
  "The sun respects a graceful exit",
  "We'll call it a 'strategic sunset'",
  "The horizon accepts your surrender with dignity",
  // new — 2026 batch
  "Bravery: attempted. Results: pending",
  "This landing was very much on purpose",
  "The bird has opted for ground-based activities",
  "Flight postponed. Weather: internal",
  "Tactical de-altituding complete",
];

/** Deterministic quip pick so tests can pin behaviour. */
export function quip(pool: string[], n: number): string {
  return pool[Math.abs(n) % pool.length] ?? pool[0]!;
}
