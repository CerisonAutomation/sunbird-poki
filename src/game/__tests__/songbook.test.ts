import { describe, expect, it } from "vitest";
import { BIOMES } from "../Biomes";
import {
  LOOPS_PER_SONG,
  SONGBOOK,
  arrange,
  chordAt,
  chordCycle,
  chordForStep,
  counterTone,
  drumLanes,
  graceTone,
  harmonyTone,
  parseNote,
  songsFor,
  songsForBiome,
  invertTune,
  shuffledOrder,
  stepSeconds,
  toChordTone,
  twinkleRun,
  type SongRole,
} from "../Songbook";

/** Every rotation `Game.setMusicMode` can ask for, plus their mode names. */
const ROLES: readonly SongRole[] = ["menu", "play", "fever", "sleep", "storm"];

describe("songbook: the note parser", () => {
  it("reads the sketch's note names as MIDI, with middle C at C4", () => {
    expect(parseNote("C4")).toBe(60);
    expect(parseNote("A4")).toBe(69);
    expect(parseNote("C2")).toBe(36);
    // Accidentals, both spellings the songs use.
    expect(parseNote("Bb3")).toBe(58);
    expect(parseNote("A#3")).toBe(58);
    expect(parseNote("C#4")).toBe(61);
    expect(parseNote("Db4")).toBe(61);
  });

  it("refuses a name it cannot read, returning NaN rather than crashing mid-song", () => {
    expect(parseNote("H4")).toBeNaN();
    expect(parseNote("C")).toBeNaN();
    expect(parseNote("Cb")).toBeNaN();
    expect(parseNote("")).toBeNaN();
    expect(parseNote("C4x")).toBeNaN();
  });
});

describe("songbook: meter and time", () => {
  it("derives step length from the song's own meter", () => {
    const at = (bpm: number, steps: number): number =>
      stepSeconds({ bpm, steps } as Parameters<typeof stepSeconds>[0]);
    // 16 steps to the bar = sixteenths; 12 = eighths; 7 and 10 = halves.
    expect(at(120, 16)).toBeCloseTo(0.125, 6);
    expect(at(120, 12)).toBeCloseTo(1 / 6, 6);
    expect(at(120, 7)).toBeCloseTo(0.25, 6);
    expect(at(120, 10)).toBeCloseTo(0.2, 6);
  });

  it("changes chord at the meter's own rate, not a fixed 8 steps", () => {
    expect(chordCycle(16)).toBe(8);
    expect(chordCycle(12)).toBe(8);
    // A 7/8 bar is one chord; halving it would change chord mid-bar.
    expect(chordCycle(7)).toBe(7);
    expect(chordCycle(10)).toBe(10);
  });

  it("walks the four chords and wraps", () => {
    const song = SONGBOOK[0]!;
    const roots = [0, 8, 16, 24, 32].map((step) => chordAt(song, step)[0]);
    expect(roots.slice(0, 4)).toEqual(song.bars.map((b) => b[0]));
    expect(roots[4], "the fourth bar wraps back to the first chord").toBe(song.bars[0]![0]);
  });

  it("reaches every one of its chords over a pass — the whole progression, not half", () => {
    // This is the bug that made the ported songs not sound like the originals:
    // the chord was driven from the step *within a bar*, so the counter only ever
    // reached 1 and chords three and four never played. The tune was right and
    // the harmony underneath it was missing its second half.
    for (const song of SONGBOOK) {
      // Keyed on the whole chord, not the bass note: two bars can share a root
      // and differ in quality (Star Bumper's F major and F minor both sit on F).
      const heard = new Set<string>();
      // Measured over one full stay, which is the claim that matters: inside the
      // time the player is on this song, they hear its whole progression. (The
      // pass count differs by meter — a 12-step song changes chord every 8 steps,
      // so its four chords need 32 steps, more than two of its bars.)
      for (let loop = 0; loop < LOOPS_PER_SONG; loop += 1) {
        for (let step = 0; step < song.steps; step += 1) heard.add(chordForStep(song, loop, step).join());
      }
      const written = new Set(song.bars.map((b) => b.join())).size;
      expect(
        heard.size,
        `${song.title} plays only ${heard.size} of its ${written} chords`,
      ).toBe(written);
    }
  });

  it("shifts the developed pass onto the song's own chords, never a foreign one", () => {
    for (const song of SONGBOOK) {
      for (const step of [0, 3, 7]) {
        expect(song.bars, `${song.title} shifted onto a chord it never wrote`).toContain(
          chordForStep(song, 2, step, 1),
        );
      }
    }
  });
});

describe("songbook: the songs themselves", () => {
  it("has a rotation for every mode the game asks for", () => {
    for (const role of ROLES) {
      expect(songsFor(role).length, `no songs for the ${role} rotation`).toBeGreaterThan(0);
    }
  });

  it("keeps every title unique — the HUD shows the title as 'now playing'", () => {
    const titles = SONGBOOK.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("is playable as written: bars, a lead line, and a real tempo", () => {
    for (const song of SONGBOOK) {
      expect(song.bars.length, `${song.title} needs chords`).toBe(4);
      for (const chord of song.bars) {
        expect(chord.length, `${song.title} chord needs a root`).toBeGreaterThanOrEqual(3);
        // The first entry is the bass root: the bass voice plays chord[0], so a
        // chord whose root was not the lowest note would invert the bass line.
        expect(chord[0], `${song.title} chord root must be the lowest tone`).toBeLessThanOrEqual(
          Math.min(...chord.slice(1)),
        );
      }
      expect(song.lead.length, `${song.title} lead must cover its bar`).toBe(song.steps);
      expect(song.bpm).toBeGreaterThanOrEqual(40);
      expect(song.bpm).toBeLessThanOrEqual(120);
      expect([7, 10, 12, 16]).toContain(song.steps);
      // A song with no voices is a silent track, which would present as a bug
      // in the mix rather than as a data error.
      expect(Object.values(song.use).some(Boolean), `${song.title} uses no voices`).toBe(true);
    }
  });

  it("pads its drum lanes to the bar, so a short pattern cannot go silent early", () => {
    for (const song of SONGBOOK) {
      const lanes = drumLanes(song);
      for (const lane of [lanes.k, lanes.s, lanes.h]) {
        expect(lane.length, `${song.title} drum lane too short`).toBeGreaterThanOrEqual(song.steps);
      }
    }
    // The 7-step songs author only one bar of pattern; the rest is silence,
    // which is what the pad is for.
    const waltz = SONGBOOK.find((s) => s.title === "Glass Waltz")!;
    expect(drumLanes(waltz).k.slice(0, 12)).toBe("x     x     ");
  });

  it("keeps the two things players complained about out of the sleep rotation", () => {
    // "Annoying and repetitive" was a section overstaying; the lullabies are the
    // rotation that plays on the results screen, so they must be several, so the
    // arrangement can turn over inside one sitting.
    expect(songsFor("sleep").length).toBeGreaterThanOrEqual(3);
    expect(songsFor("play").length).toBeGreaterThanOrEqual(4);
  });
});

describe("songbook: the form, which is what stops it being a loop", () => {
  const kitSong = SONGBOOK.find((s) => s.role === "play")!;
  const lullaby = SONGBOOK.find((s) => s.role === "sleep")!;
  const sectionAt = (song: typeof kitSong, loop: number): string => arrange(song, loop, 0).section;

  it("opens, states, develops, breaks down, and closes — in that order", () => {
    expect(sectionAt(kitSong, 0)).toBe("intro");
    expect(sectionAt(kitSong, 1)).toBe("a");
    expect(sectionAt(kitSong, 2)).toBe("b");
    expect(sectionAt(kitSong, 3)).toBe("break");
    expect(sectionAt(kitSong, 4)).toBe("final");
    // …and then the rotation moves on rather than looping the whole form.
    expect(LOOPS_PER_SONG).toBe(5);
  });

  it("presents the tune differently on every pass", () => {
    // This is the fix for "the songs are super repetitive". Varying only the
    // layers left the same bar running under the same chords, which a listener
    // hears as a loop however many instruments come and go — so each pass has to
    // change the tune itself.
    const views = Array.from({ length: LOOPS_PER_SONG }, (_, loop) => arrange(kitSong, loop, 0).tuneView);
    expect(views[0], "the opening states the tune as written").toBe("plain");
    expect(views[1]).toBe("plain");
    expect(new Set(views).size, `only ${new Set(views).size} of ${LOOPS_PER_SONG} passes differ`).toBeGreaterThanOrEqual(4);
    expect(views).toContain("displaced");
    expect(views).toContain("reharmonised");
    expect(views).toContain("inverted");
  });

  it("moves the harmony in the developed pass, using the song's own chords", () => {
    expect(arrange(kitSong, 2, 0).chordShift, "a development that never changes chord is not a development").toBe(1);
    expect(arrange(kitSong, 1, 0).chordShift).toBe(0);
    expect(arrange(kitSong, 4, 0).chordShift).toBe(0);
    // Rotating by exactly one chord keeps every chord the song's own.
    const shifted = chordAt(kitSong, 0 + chordCycle(kitSong.steps));
    expect(kitSong.bars).toContain(shifted);
  });

  it("colours the developed pass with bells, without transposing the tune", () => {
    // The old development was "the same tune an octave up", which is the same
    // music louder. The bells stay; the octave lift is gone.
    expect(arrange(kitSong, 2, 0).chime).toBe(true);
    expect(arrange(kitSong, 2, 0).leadShift).toBe(0);
  });

  it("re-colours a tune note onto the chord, never off it", () => {
    const chord = [60, 64, 67]; // C E G
    expect(chord.map((m) => m % 12)).toContain(toChordTone(chord, 65) % 12);
    expect(toChordTone(chord, 60)).toBe(60);
    // The nearest tone wins, in whichever octave is closest.
    expect(toChordTone(chord, 71), 'the nearest tone wins, even upwards').toBe(72);
    expect(toChordTone(chord, 73)).toBe(72);
  });

  it("inverts the tune onto chord tones, so the mirror cannot go out of key", () => {
    const chord = [60, 64, 67];
    for (const midi of [64, 67, 72, 76]) {
      const inverted = invertTune(chord, midi);
      expect(chord.map((m) => m % 12), `inverting ${midi} left the chord`).toContain(inverted % 12);
    }
    // Mirrored: a note above the centre lands below it.
    const centre = 64 + 12;
    expect(invertTune(chord, centre + 5)).toBeLessThan(centre);
  });

  it("earns the word 'developed': the sections are actually different", () => {
    // The source sketch plays one arrangement forever. If every loop produced
    // the same layers, this feature would be a longer loop, not a form.
    const signatures = new Set(
      Array.from({ length: LOOPS_PER_SONG }, (_, loop) => JSON.stringify(arrange(kitSong, loop, 0))),
    );
    expect(signatures.size, "the form must not repeat an arrangement verbatim").toBeGreaterThanOrEqual(4);
  });

  it("starts with the tune and no kit, so the entry is an opening not a drop", () => {
    const intro = arrange(kitSong, 0, 0);
    expect(intro.drums).toBe("none");
    expect(intro.lead).toBe(true);
    expect(intro.uke, "the off-beat strum arrives with the kit, not before it").toBe(false);
    // Sparser, not different: the intro drops layers, and must keep the ones the
    // song's own palette has. Counting them is how that stays honest.
    const layers = (a: ReturnType<typeof arrange>): number =>
      [a.bass, a.pad, a.rhodes, a.drums !== "none", a.uke, a.chime, a.voice, a.chip].filter(Boolean).length;
    expect(layers(intro)).toBeLessThan(layers(arrange(kitSong, 1, 0)));
  });

  it("never asks for a tune it has no voice to sing", () => {
    // The bug this catches: an arrangement that opens the lead but forgets to
    // enable any lead voice. That is silence, not quiet — and it lands hardest
    // on the one song whose only voice is the bell.
    for (const song of SONGBOOK) {
      for (let loop = 0; loop < LOOPS_PER_SONG; loop += 1) {
        for (const step of [0, 1, Math.floor(song.steps / 2)]) {
          const a = arrange(song, loop, step);
          if (!a.lead) continue;
          expect(
            a.chip || a.voice || a.chime || song.use.rhodes,
            `${song.title} loop ${loop} step ${step} opens the lead with no voice behind it`,
          ).toBe(true);
        }
      }
    }
  });

  it("keeps a bell-only song's bells in the thin sections", () => {
    const box = SONGBOOK.find((s) => s.title === "Music Box")!;
    expect(arrange(box, 0, 0).chime, "the opening must not silence the melody").toBe(true);
    expect(arrange(box, 5, 0).chime, "nor the breakdown").toBe(true);
  });

  it("never leaves a whole bar of a song silent", () => {
    // A section that schedules nothing at all presents as a broken player
    // rather than as a rest, so every step must have *something* sounding.
    for (const song of SONGBOOK) {
      for (let loop = 0; loop < LOOPS_PER_SONG; loop += 1) {
        const layers = new Set<string>();
        for (let step = 0; step < song.steps; step += 1) {
          const a = arrange(song, loop, step);
          if (a.bass) layers.add("bass");
          if (a.pad) layers.add("pad");
          if (a.rhodes) layers.add("rhodes");
          if (a.uke) layers.add("uke");
          if (a.drums !== "none") layers.add("drums");
          if (a.lead) layers.add("lead");
        }
        expect(layers.size, `${song.title} loop ${loop} is entirely empty`).toBeGreaterThan(0);
      }
    }
  });

  it("drops the kit for the breakdown, and holds the tune rather than the screen", () => {
    const brk = arrange(kitSong, 3, 0);
    expect(brk.drums).toBe("none");
    // A sung song rests its tune here; a song that never had a kit (every
    // lullaby) keeps singing, because silence would read as a broken player.
    expect(brk.lead).toBe(false);
    expect(arrange(lullaby, 3, 0).lead).toBe(true);
    expect(arrange(lullaby, 3, 0).pad).toBe(true);
  });

  it("fills into the next section, and rests the phrase at the very end", () => {
    const steps = kitSong.steps;
    expect(arrange(kitSong, 1, 0).fill, "a fill at the top of a bar is noise").toBe(false);
    expect(arrange(kitSong, 1, steps - 1).fill, "the statement pass is verbatim — no fill").toBe(false);
    expect(arrange(kitSong, 2, steps - 1).fill).toBe(true);
    // The closing pass thins to the on-beat notes and breathes for the last
    // half of its final bar, so the phrase ends instead of being cut off.
    const end = arrange(kitSong, LOOPS_PER_SONG - 1, steps - 1);
    expect(end.breath).toBe(true);
    expect(end.thinLead).toBe(true);
    expect(arrange(kitSong, LOOPS_PER_SONG - 1, 0).breath).toBe(false);
  });
});

describe("songbook: the answering line", () => {
  const chord = [60, 64, 67, 71];

  it("stays out of the way while the tune is speaking", () => {
    expect(counterTone(chord, 1, 72, 64)).toBe(0);
  });

  it("answers on the off-beats only, from the chord's own tones", () => {
    expect(counterTone(chord, 0, 0, 64), "an answer on the beat fights the tune").toBe(0);
    const answer = counterTone(chord, 1, 0, 64);
    expect(chord.slice(1).map((m) => m + 12)).toContain(answer);
  });

  it("moves by the smallest step from its last note, so it reads as a line", () => {
    expect(counterTone(chord, 1, 0, 64 + 12)).toBe(76);
    expect(counterTone(chord, 1, 0, 83)).toBe(83);
  });
});

describe("songbook: every song is its own song", () => {
  const duplicates = (key: (s: (typeof SONGBOOK)[number]) => string): string[] => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const song of SONGBOOK) {
      const k = key(song);
      const first = seen.get(k);
      if (first) dupes.push(`${first} == ${song.title}`);
      else seen.set(k, song.title);
    }
    return dupes;
  };

  it("gives every song its own chord progression", () => {
    expect(duplicates((s) => s.bars.map((b) => b.join("-")).join("|"))).toEqual([]);
  });

  it("gives every song its own melody", () => {
    expect(duplicates((s) => s.lead.join(","))).toEqual([]);
  });

  it("gives every song its own tempo", () => {
    // Thirty songs over 44–100 BPM, and no two the same. A shared tempo is how
    // two different tunes still read as one track on a short listen, which is the
    // complaint this answers; the pairs that collided were nudged by a beat or
    // two, so nothing changed character. The source sketch had five of them.
    expect(duplicates((s) => String(s.bpm))).toEqual([]);
  });

  it("keeps the tempo spread wide enough to be worth having", () => {
    const bpms = SONGBOOK.map((s) => s.bpm);
    expect(Math.min(...bpms)).toBeLessThanOrEqual(46);
    expect(Math.max(...bpms)).toBeGreaterThanOrEqual(98);
  });
});

describe("songbook: an island each", () => {
  it("carries the whole sketch — thirty songs, not a shortlist", () => {
    expect(SONGBOOK.length).toBe(30);
  });

  it("leaves no island without music", () => {
    // A biome with no song of its own would be the one silent world on the map,
    // and the player would hear the previous island's song for the whole cross —
    // the exact thing "a song per island" is meant to fix.
    for (const biome of BIOMES) {
      expect(songsForBiome(biome.id).length, `${biome.name} has no song`).toBeGreaterThan(0);
    }
  });

  it("keeps the moment-songs out of the island rotations", () => {
    // The menu and lullaby books belong to a moment, not a place: a 46 BPM 6/8
    // under a flight would read as the game stalling.
    for (const song of SONGBOOK.filter((s) => s.role !== "play")) {
      for (const island of song.biomes) {
        expect(songsForBiome(island), `${song.title} must not play as flight music`).not.toContain(song);
      }
    }
    // And a flight song is in every rotation it claims, so no island it names
    // can be missing it.
    for (const song of SONGBOOK.filter((s) => s.role === "play")) {
      for (const island of song.biomes) {
        expect(songsForBiome(island), `${song.title} claims ${island} but is not in it`).toContain(song);
      }
    }
  });

  it("gives every island a pool deep enough to shuffle", () => {
    // With one song per island, "random" would mean hearing the same tune every
    // crossing — which is the repetition this whole pass exists to remove.
    for (const biome of BIOMES) {
      expect(songsForBiome(biome.id).length, `${biome.name} is too thin to shuffle`).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives the odd meters to the islands that suit them", () => {
    // 5/4 and 7/8 are a feature over the canyon and the aurora, and a stumble
    // anywhere else.
    const arp = SONGBOOK.find((s) => s.title === "Keypad Arp")!;
    const wail = SONGBOOK.find((s) => s.title === "Wailing 7")!;
    expect(arp.steps).toBe(10);
    expect(wail.steps).toBe(7);
    expect(arp.biomes).toContain("aurora");
    expect(wail.role).toBe("storm");
  });
});

describe("songbook: whimsy, and not repeating itself", () => {
  const song = SONGBOOK.find((s) => s.role === "play")!;

  it("trades the comping rhythm between loops instead of repeating it", () => {
    expect(arrange(song, 1, 0).compSwap).toBe(false);
    expect(arrange(song, 2, 0).compSwap).toBe(true);
    // Never in the intro or the breakdown: those are the sections that have to
    // sound the same each time, because they are the ones that reset the ear.
    expect(arrange(song, 0, 0).compSwap).toBe(false);
    expect(arrange(song, 5, 0).compSwap).toBe(false);
  });

  it("puts the bell flourish at phrase ends only", () => {
    const steps = song.steps;
    expect(arrange(song, 2, steps - 1).twinkle).toBe(true);
    expect(arrange(song, 2, 0).twinkle, "a flourish at the top of a bar is noise").toBe(false);
    expect(arrange(song, 1, steps - 1).twinkle, "not while the tune is still stating itself").toBe(false);
  });

  it("saves the harmony for the closing pass", () => {
    expect(arrange(song, LOOPS_PER_SONG - 1, 0).harmony).toBe(true);
    expect(arrange(song, 1, 0).harmony).toBe(false);
    expect(arrange(song, 3, 0).harmony).toBe(false);
  });

  it("answers with birdsong only in the held-breath section", () => {
    expect(arrange(song, 3, 0).chirp).toBe(true);
    expect(arrange(song, 1, 0).chirp).toBe(false);
  });

  it("builds the flourish from the chord, so it cannot clash", () => {
    const minor = [57, 60, 63, 67]; // A minor: a stock major run would fight this
    for (let loop = 0; loop < LOOPS_PER_SONG; loop += 1) {
      const run = twinkleRun(minor, loop);
      expect(run.length).toBe(4);
      // Every note is a chord tone two octaves up, plus the closing leap.
      for (const note of run.slice(0, 3)) expect(minor.map((m) => m + 24)).toContain(note);
      expect(run[3]! - run[2]!).toBe(4);
    }
    // Rotated by loop, so it is a different flourish each time.
    expect(twinkleRun(minor, 0)).not.toEqual(twinkleRun(minor, 1));
  });

  it("places a grace note only where the tune is about to leave a silence", () => {
    const chord = [60, 64, 67];
    expect(graceTone(chord, 64, 0), "a rest follows, so it earns a grace note").toBeGreaterThan(0);
    expect(graceTone(chord, 64, 67), "the tune continues, so it must not").toBe(0);
    expect(graceTone(chord, 0, 0), "there is no note to grace").toBe(0);
  });

  it("harmonises below the tune, with the nearest chord tone it has", () => {
    const chord = [60, 64, 67, 71]; // C E G B
    const third = harmonyTone(chord, 72); // a C5 tune: the B is not a harmony, the G is
    expect(third).toBe(67);
    expect(third, "a harmony above the tune is not a harmony").toBeLessThan(72);
    expect(chord.map((m) => m % 12)).toContain(third % 12);
    // Taken in the tune's own octave, so the interval stays a third and does not
    // stretch into a ninth as the melody climbs.
    expect(harmonyTone([60, 64, 67], 76)).toBe(72);
    // Nothing sits below the chord's root, so the lowest note gets no harmony.
    expect(harmonyTone(chord, 60)).toBe(0);
    expect(harmonyTone(chord, 0)).toBe(0);
  });
});

describe("songbook: random playback", () => {
  it("plays every song in the pool once per shuffle, not a dice roll per song", () => {
    // A queue, so nothing is missed and nothing repeats until the pool is spent.
    for (const n of [1, 2, 5, 30]) {
      const order = shuffledOrder(n);
      expect(order.length).toBe(n);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("actually reorders — a fixed order is not a shuffle", () => {
    const straight = Array.from({ length: 30 }, (_, i) => i);
    expect(shuffledOrder(30)).not.toEqual(straight);
    // A different stream gives a different opener, which is what makes two
    // flights over the same island two different flights.
    expect(shuffledOrder(30, () => 0)[0]).not.toBe(shuffledOrder(30, () => 0.999)[0]);
    // Same stream, same order: the shuffle is injectable, so this is testable.
    expect(shuffledOrder(8, () => 0.5)).toEqual(shuffledOrder(8, () => 0.5));
  });
});

describe("songbook: verbatim where it should be", () => {
  const kitSong = SONGBOOK.find((s) => s.role === "play")!;

  it("keeps the statement pass free of ornaments", () => {
    // "Make it sound like the HTML" and "improve it" are only compatible if the
    // two live in different passes: the statement is the song as written, and
    // everything additive happens in the development and the close.
    for (const song of SONGBOOK) {
      expect(arrange(song, 1, 0).ornament, `${song.title} ornaments its statement`).toBe(false);
      expect(arrange(song, 1, song.steps - 1).twinkle).toBe(false);
      expect(arrange(song, 1, 0).harmony).toBe(false);
      expect(arrange(song, 1, 0).leadShift).toBe(0);
      expect(arrange(song, 1, 0).tuneView).toBe("plain");
    }
    expect(arrange(kitSong, 2, 0).ornament).toBe(true);
    expect(arrange(kitSong, LOOPS_PER_SONG - 1, 0).ornament).toBe(true);
  });

  it("keeps the sketch's own velocities and drum synthesis, to the digit", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const player = fs.readFileSync(join(process.cwd(), "src", "game", "SongbookPlayer.ts"), "utf8");

    // The sketch's numbers, verbatim. A random per-hit velocity is a different
    // instrument, not a livelier one, and it is the first thing that stops a
    // port sounding like the thing it came from.
    expect(player).toContain("this.kick(at, 0.26)");
    expect(player).toContain('this.noiseHit(at, 0.11, 0.08, 1700, "bandpass")');
    expect(player).toContain('this.noiseHit(at, 0.04, 0.04, 7500, "highpass")');
    expect(player).toContain("stepDur * 2.4, 0.12, song.squareBass");
    expect(player).toContain("0.048 - i * 0.006");
    expect(player).toContain("this.uke(mtof(tone), at, stepDur * 1.1, 0.06)");
    expect(player).toContain("this.chip(f, at, stepDur * 1.5, 0.045)");
    expect(player).toContain("this.voice(f, at, stepDur * 1.8, 0.05)");
    expect(player).toContain("this.chime(f * 2, at, 0.035)");
    expect(player, "no velocity jitter").not.toMatch(/hum\(/);
    // The drum's decay lives in the samples, as the sketch builds it.
    expect(player).toContain("(Math.random() * 2 - 1) * (1 - i / n)");
    // The chord hold is the sketch's meter-dependent value, not a constant.
    expect(player).toContain("stepDur * (song.steps === 12 ? 8 : 6)");
  });
});

describe("songbook: the wiring that fails silently", () => {
  // These are seams where a missing line produces no error, no failed request
  // and no test failure anywhere else — the music just never plays, or leaks.
  it("is constructed, muted with the music setting, and disposed", async () => {
    const fs = await import("node:fs");
    const join = (await import("node:path")).join;
    const src = fs.readFileSync(join(process.cwd(), "src", "game", "Audio.ts"), "utf8");

    expect(src).toContain("new SongbookPlayer(");
    // Gated by the music setting, not by MUSIC_DISABLED: the complaint that
    // silenced the generated score is not a reason to silence these songs.
    expect(src).toContain("private songbookLevel()");
    expect(src).toContain("this.songbook?.setLevel(this.songbookLevel())");
    // The mode is what selects a rotation; without this the player hears
    // whatever song was picked at construction, forever.
    expect(src).toContain("this.songbook?.setMode(mode)");
    expect(src).toContain("this.songbook?.setNight(1 - daylight)");
    expect(src).toContain("this.songbook?.ducked(amount, release)");
    // dispose() is hand-enumerated: a missing line leaks the sequencer and its
    // interval for the lifetime of the page.
    // The progression must be driven from a CONTINUOUS counter. Calling
    // `chordAt` with the step within a bar is precisely the bug that dropped
    // half of every song's harmony, and it is invisible in the data — so the
    // player is pinned to the helper that carries the pass number.
    const player = fs.readFileSync(join(process.cwd(), "src", "game", "SongbookPlayer.ts"), "utf8");
    expect(player, "the player must take the chord from the running counter").toContain("chordForStep(");
    expect(
      player,
      "chordAt indexes absolute steps and must not be fed a bar-local one",
    ).not.toMatch(/chordAt\(/);
    expect(src).toContain("this.songbook?.dispose()");
    expect(src).toContain("this.songbook = null;");
  });
});
