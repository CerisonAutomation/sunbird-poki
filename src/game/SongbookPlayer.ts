import { clampSequencerTime } from "./Music";
import { TICK_MS, LOOKAHEAD, MAX_STEPS_PER_TICK } from "./audio-constants";
import {
  LOOPS_PER_SONG,
  SONGBOOK,
  arrange,
  chordForStep,
  chordCycle,
  counterTone,
  drumLanes,
  invertTune,
  graceTone,
  harmonyTone,
  mtof,
  phraseAt,
  shuffledOrder,
  songsFor,
  songsForBiome,
  stepSeconds,
  toChordTone,
  twinkleRun,
  type BiomeId,
  type Song,
  type SongRole,
} from "./Songbook";

/** Steps of closing snare roll at the end of a section's final bar. */
const FILL_STEPS = 4;

/** `MusicMode` → which rotation plays. "off" stops. */
const MODE_ROLE: Record<string, SongRole | null> = {
  off: null,
  menu: "menu",
  play: "play",
  fever: "fever",
  sleep: "sleep",
  storm: "storm",
};

/**
 * Plays the authored songs in `Songbook.ts`, as written.
 *
 * Owns its own voices (ported from the sketch these songs came from, which
 * authored them against exactly these seven timbres) and its own delay throw,
 * because a delay per song is part of the composition — the lullabies are
 * mostly their tail. Everything it makes is routed into the caller's master
 * bus and reverb send, so it mixes, mutes, ducks and disposes like the rest of
 * the game's audio.
 */
export class SongbookPlayer {
  private readonly bus: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly duck: GainNode;
  private readonly comp: DynamicsCompressorNode;
  /** Shimmer send: the per-song delay throw, plus a little room. */
  private readonly fxSend: GainNode;
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;
  private readonly wet: GainNode;
  /** Shared noise buffer — allocated once, reused for every snare and hat. */
  private readonly noiseBuf: AudioBuffer;

  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private loop = 0;
  private level = 0;
  private role: SongRole | null = null;
  /** The island being flown over; drives song choice while in flight. */
  private biome: BiomeId | null = null;
  private songIdx = 0;
  private rotation: readonly Song[] = [];
  /** Shuffled indices into `rotation`: every song once, then reshuffled. */
  private queue: number[] = [];
  private queued = 0;
  private lanes: { k: string; s: string; h: string } | null = null;
  /** Whether this song was authored with a kit at all (every lullaby is not). */
  private kit = false;
  /** Last note of the counter-line, so the next answer moves by step. */
  private counterNote = 0;
  private lastSong: Song | null = null;
  /** How many times each song has been selected this session, by title. */
  private readonly played = new Map<string, number>();
  /** True while a song is playing for the second or later time. */
  private revisit = false;
  private disposed = false;
  private night = 0;
  private intensity = 0;
  private intensityTarget = 0;

  /** Fired when the rotation moves to a new song, with its title. */
  onTrackChange: ((title: string) => void) | null = null;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    reverbSend: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.duck = ctx.createGain();
    this.duck.gain.value = 1;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 6000;
    this.filter.Q.value = 0.6;

    // A gentle limiter on the music bus: multi-voice tutti passages (pad +
    // rhodes + chip + voice + drums all at once) would sum loud enough to clip
    // on the master. Threshold at -10 dBFS, ratio 3:1, 5ms attack/80ms release
    // keeps the dynamics alive while shaving the harsh peaks.
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -10;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.08;

    this.bus.connect(this.filter);
    this.filter.connect(this.duck);
    this.duck.connect(this.comp);
    // Straight into the game's master, with no shared room: the songs carry
    // their own delay throw, and adding the hall on top was audible as a tail the
    // originals do not have.
    void reverbSend;
    this.comp.connect(destination);

    this.fxSend = ctx.createGain();
    this.delay = ctx.createDelay(1.5);
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.18;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.15;
    this.fxSend.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this.bus);

    // Pre-allocate one second of white noise. All snare and hat hits read from
    // this same buffer with a fresh envelope each time, eliminating per-hit
    // allocations that previously ran at ~6× per second at fast tempos.
    const noiseLen = Math.floor(ctx.sampleRate);
    this.noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i += 1) noiseData[i] = Math.random() * 2 - 1;
  }

  /* ------------------------------------------------------------- mixing -- */

  /** The audible level, 0..1 — the caller owns mute/music-slider arithmetic. */
  setLevel(level: number): void {
    this.level = Math.max(0, Math.min(1, level));
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(this.level, now, 0.08);
    // Silence stops the clock rather than leaving a silent sequencer running:
    // the high seas of this game are CPU-bound, and music at zero is pure cost.
    if (this.level > 0) this.start();
    else this.stop();
  }

  /** Duck under a UI sting or a toast, then recover. */
  ducked(amount = 0.45, release = 0.5): void {
    const now = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(1 - amount, now, 0.03);
    this.duck.gain.setTargetAtTime(1, now + 0.05, Math.max(0.05, release) / 3);
  }

  /** Day/night and speed shape the mix the same way the generated score does. */
  setNight(t: number): void {
    this.night = Math.max(0, Math.min(1, t));
    this.recomputeCutoff();
  }

  setIntensity(v: number): void {
    this.intensityTarget = Math.max(0, Math.min(1, v));
  }

  private recomputeCutoff(): void {
    // Wide open by day: a lowpass at the 5 kHz this started at is a real colour
    // the originals do not have. Only night closes it, which is the one game
    // behaviour the songs are expected to follow.
    const cutoff = Math.max(1800, Math.min(20000, 20000 - this.night * 11000 + this.intensity * 2000));
    this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.25);
  }

  /* ---------------------------------------------------------- selection -- */

  /**
   * Follow the game's music mode. A mode maps to a rotation, except plain
   * flight: flying plays the island you are over, which is what makes the world
   * turn over musically as you cross it.
   */
  setMode(mode: string): void {
    const role = MODE_ROLE[mode] ?? null;
    if (role === this.role) return;
    this.role = role;
    if (!role) {
      this.stop();
      return;
    }
    this.loadRotation(this.rotationFor(role));
    if (this.level > 0) this.start();
  }

  /** The island you are flying over decides the song, while flying. */
  setBiome(biome: BiomeId): void {
    if (biome === this.biome) return;
    this.biome = biome;
    // Nothing to do off-flight: the menu, results and storm rotations are about
    // the moment, not the island, so they keep playing across a border.
    if (this.role !== "play") return;
    this.loadRotation(this.rotationFor("play"));
  }

  private rotationFor(role: SongRole): readonly Song[] {
    if (role !== "play") return songsFor(role);
    // An island with no song of its own would be the one silent world on the
    // map, so fall back to the whole flight book rather than to nothing.
    const here = this.biome ? songsForBiome(this.biome) : [];
    const pool = here.length > 0 ? here : songsFor("play");
    // The signature songs get a second turn in the queue.
    //
    // Four of the thirty are the score the game is actually for — a martial 3/4
    // march, a soft D major ballad, a country shuffle, a minor lullaby — and
    // before this the player heard each of them once per thirty songs, buried in
    // a shuffle of the rest. Weighting the rotation is the difference between
    // "the game has a sound" and "the game plays music": the character is
    // foregrounded, the other twenty-six keep filling in around it, and the
    // queue stays a queue so nothing is skipped or doubled up.
    return [...pool, ...pool.filter((song) => song.signature)];
  }

  /**
   * Adopt a rotation and shuffle it.
   *
   * Playback is a queue rather than a dice roll per song, so every song in the
   * pool is heard before any repeats — a shuffle that can serve the same song
   * twice in a row reads as a bug, not as variety. Re-shuffled on every load, so
   * crossing back into an island later gives a different order.
   */
  private loadRotation(songs: readonly Song[]): void {
    this.rotation = songs;
    this.queue = shuffledOrder(songs.length);
    this.queued = 0;
    this.selectCurrent();
  }

  /** Skip to the next song in the shuffled queue, reshuffling when it runs out. */
  next(): void {
    if (this.rotation.length === 0) return;
    this.queued += 1;
    if (this.queued >= this.queue.length) {
      this.queue = shuffledOrder(this.rotation.length);
      this.queued = 0;
    }
    this.songIdx = this.queue[this.queued] ?? 0;
    // The weighted rotation holds a song twice on purpose, so a shuffle can now
    // put the two copies next to each other. Two identical stays back to back is
    // the one thing a queue is supposed to prevent, and the player reads it as a
    // stutter rather than as variety — so skip the repeat when the pool is big
    // enough to have an alternative.
    if (this.rotation.length > 1 && this.rotation[this.songIdx] === this.lastSong) {
      this.queued += 1;
      if (this.queued >= this.queue.length) {
        this.queue = shuffledOrder(this.rotation.length);
        this.queued = 0;
      }
      const alternative = this.rotation[this.queue[this.queued] ?? 0];
      if (alternative && alternative !== this.lastSong) this.songIdx = this.queue[this.queued]!;
    }
    this.selectCurrent();
  }

  private selectCurrent(): void {
    const song = this.rotation[this.songIdx] ?? SONGBOOK[0]!;
    this.lastSong = song;
    // A song the player has heard before this session develops on the way in:
    // the second hearing is not the first hearing again, which is what stops a
    // favourite that now comes round twice an evening from sounding like a
    // stuck record. The depth lives in `scheduleStep` — a repeat trades the
    // statement pass's comping and grows a second voice into it.
    const seen = this.played.get(song.title) ?? 0;
    this.played.set(song.title, seen + 1);
    this.revisit = seen > 0;
    const lanes = drumLanes(song);
    this.lanes = lanes;
    this.kit = lanes.k.includes("x") || lanes.s.includes("s");
    this.applyFx(song);
    // A new song starts at its own beginning, from whichever call site chose it.
    this.step = 0;
    this.loop = 0;
    this.counterNote = 0;
    this.onTrackChange?.(song.title);
  }

  private applyFx(song: Song): void {
    const now = this.ctx.currentTime;
    this.delay.delayTime.setTargetAtTime(song.delay, now, 0.05);
    this.wet.gain.setTargetAtTime(song.wet, now, 0.05);
    // A long delay with high feedback creates many audible repeats that blur the
    // harmony. Scale feedback inversely with delay time so lullabies (0.7s delay)
    // get ~2 ghost taps while quick-throw songs (0.2s) keep a denser shimmer.
    this.feedback.gain.setTargetAtTime(Math.min(0.22, 0.055 / song.delay), now, 0.05);
  }

  get songTitle(): string | null {
    return this.lastSong?.title ?? null;
  }

  /* -------------------------------------------------------- scheduling --- */

  private start(): void {
    if (this.timer !== null || this.disposed || !this.lastSong) return;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(0, now, 0.06);
  }

  private tick(): void {
    if (this.disposed || this.ctx.state !== "running" || !this.lastSong) return;
    this.intensity += (this.intensityTarget - this.intensity) * 0.1;
    this.recomputeCutoff();
    const now = this.ctx.currentTime;
    // A throttled tab (backgrounded, occluded, locked phone) leaves the
    // sequencer far behind; re-anchor so the missed music is skipped instead of
    // being dumped onto the audio clock as one percussive burst.
    this.nextTime = clampSequencerTime(this.nextTime, now);
    let scheduled = 0;
    while (this.nextTime < now + LOOKAHEAD && scheduled < MAX_STEPS_PER_TICK) {
      const t = Math.max(this.nextTime, now + 0.001);
      this.scheduleStep(t);
      this.advance();
      scheduled += 1;
    }
  }

  private advance(): void {
    const song = this.lastSong!;
    // Steps are evenly spaced; swing is applied as a delay on the off-step when
    // it is scheduled (see `scheduleStep`), not by stretching the grid. Keeping
    // the grid straight is what lets a swung song stay in time with the drums.
    this.nextTime += stepSeconds(song);
    this.step += 1;
    if (this.step < song.steps) return;
    this.step = 0;
    this.loop += 1;
    if (this.loop < LOOPS_PER_SONG || this.rotation.length < 2) return;
    this.loop = 0;
    this.next();
  }

  private scheduleStep(t: number): void {
    const song = this.lastSong!;
    const use = song.use;
    const stepDur = stepSeconds(song);
    const swing = this.step % 2 === 1 ? stepDur * song.swing : 0;
    const at = t + swing;
    const st = this.step;
    const base = arrange(song, this.loop, st);
    // A song heard before develops on the way in: the statement pass trades
    // which voice comps, so the second hearing is a variation rather than a
    // replay. The counter-line that normally only answers the development (see
    // below) grows into the statement too, which is the difference between one
    // voice and two in the same bar.
    const deepened = this.revisit && base.section === "a";
    const a = deepened ? { ...base, compSwap: !base.compSwap } : base;
    // A continuous counter, so the progression reaches all four chords (see
    // `chordForStep`), with the development's harmonic shift on top.
    const chord = chordForStep(song, this.loop, st, a.chordShift);
    const lanes = this.lanes ?? drumLanes(song);
    const hasKit = this.kit;

    if (a.drums === "full") {
      if (lanes.k[st] === "x") this.kick(at, 0.32);
      if (lanes.s[st] === "s") this.snare(at);
      if (lanes.h[st] === "h") this.noiseHit(at, 0.06, 0.055, 7500, "highpass");
    }
    // Closing roll into the next section: a rising snare over the last steps of
    // the section's final bar, landing on the downbeat of what follows.
    if (a.ornament && a.fill && hasKit && st >= song.steps - FILL_STEPS) {
      const rise = (st - (song.steps - FILL_STEPS) + 1) / FILL_STEPS;
      this.noiseHit(at, 0.09, 0.03 + rise * 0.05, 1900, "bandpass");
    }

    // The authored bass line plays off the kick pattern, not a fixed grid: the
    // downbeat and wherever the kick lands, which is what lets the half-time
    // songs breathe instead of pumping.
    if (a.bass && (st === 0 || lanes.k[st] === "x")) {
      this.bassVoice(mtof(chord[0]!), at, stepDur * 2.4, 0.12, song.squareBass);
    }
    // Comping. The chord lands on the downbeat and the off-beat strum answers
    // it; on alternate loops the two instruments trade rhythms, so the second
    // time through a section is a variation rather than a copy of the first.
    const offbeat = lanes.h[st] === "h" && st % 2 === 1;
    if (a.rhodes && st === 0 && !a.compSwap) {
      // A 6/8 song holds its chord across eight eighth-notes, not six: the short
      // value here was audible as the harmony dropping out mid-bar.
      const hold = stepDur * (song.steps === 12 ? 8 : 6);
      chord.slice(1).forEach((midi, i) => this.rhodes(mtof(midi), at, hold, 0.048 - i * 0.006));
    }
    if (a.uke && st === 0 && a.compSwap) {
      chord.slice(1).forEach((midi, i) => this.uke(mtof(midi), at + i * 0.012, stepDur * 1.8, 0.05));
    }
    if (a.pad && st === 0) {
      this.pad(chord.slice(1).map(mtof), at, stepDur * chordCycle(song.steps), 0.07);
    }
    if (a.uke && offbeat && !a.compSwap) {
      const tone = chord[2] ?? chord[1] ?? chord[0]!;
      this.uke(mtof(tone), at, stepDur * 1.1, 0.06);
    }
    if (a.rhodes && offbeat && a.compSwap) {
      const tone = chord[2] ?? chord[1] ?? chord[0]!;
      this.rhodes(mtof(tone), at, stepDur * 1.6, 0.04);
    }

    // A far-away answer in the quiet sections: two quick chirps, nowhere near
    // the tune's register, which is what makes a lone pad feel like a place
    // rather than a mistake.
    if (a.chirp && st === 0 && Math.random() < 0.5) this.chirp(at + stepDur * (1 + Math.random()));

    // The tune: presented differently on every pass (see `TuneView`), sung from
    // the section's phrase (the statement, or the song's written answer), thinned
    // to its on-beat notes on the closing pass, and rested for the last half of
    // the final bar so the phrase ends rather than cuts.
    const written = phraseAt(song, a.phrase, st);
    const nextWritten = phraseAt(song, a.phrase, (st + 1) % song.steps);
    const thinned = a.thinLead && st % 2 === 1;
    let midi = 0;
    if (a.lead && !a.breath && !thinned) {
      if (a.tuneView === "displaced") {
        // Half a bar late: the tune answers itself instead of repeating. The
        // displaced line is always the *statement* — an answer that arrives late
        // is still an answer to the thing that was said.
        midi = phraseAt(song, 0, (st + Math.floor(song.steps / 2)) % song.steps);
      } else {
        midi = written;
        if (midi > 0 && a.tuneView === "reharmonised") midi = toChordTone(chord, midi);
        else if (midi > 0 && a.tuneView === "inverted") midi = invertTune(chord, midi);
      }
    }
    if (midi > 0) {
      const f = mtof(midi + a.leadShift);
      // Grace note: a quiet upper neighbour a beat before the tune leaves a
      // silence — ornament, so it belongs to the developed passes and not to the
      // statement, which stays exactly as the song was written.
      if (a.ornament) {
        const grace = graceTone(chord, midi, nextWritten);
        if (grace > 0) this.chime(mtof(grace), Math.max(at - stepDur * 0.35, 0.001), 0.02);
      }
      if (a.chip) this.chip(f, at, stepDur * 1.5, 0.045);
      if (a.voice) this.voice(f, at, stepDur * 1.8, 0.05);
      if (use.rhodes && !a.chip && !a.voice) this.rhodes(f, at, stepDur * 2, 0.06);
      if (a.chime && (st % 3 === 0 || !a.voice)) this.chime(f * 2, at, 0.035);
      // The closing pass arrives in harmony: a chord tone a third below.
      const third = a.harmony ? harmonyTone(chord, midi) : 0;
      if (third > 0) this.voice(mtof(third), at, stepDur * 1.6, 0.03);
    } else if (a.section === "b" || deepened) {
      // The developed pass answers the tune in its gaps — the difference between
      // hearing a loop and hearing a piece with two voices in it. On a song the
      // player has heard before, the statement pass grows the same second voice.
      const answer = counterTone(chord, st, written, this.counterNote);
      if (answer > 0) {
        this.counterNote = answer;
        this.voice(mtof(answer), at, stepDur * 1.4, 0.032);
      }
    }

    // The whimsy run: a bell flourish up the chord's own voicing at the phrase
    // end, drawn from the harmony so it cannot clash and rotated per loop so it
    // is a different flourish each time.
    if (a.twinkle) {
      const run = twinkleRun(chord, this.loop);
      run.forEach((midi, i) => this.chime(mtof(midi), at + i * stepDur * 0.45, 0.03 * (1 - i * 0.15)));
    }
  }

  /* ------------------------------------------------------------- voices -- */
  /* Ported from the sketch, which is where these songs were written. */

  private env(g: GainNode, t: number, a: number, d: number, s: number, r: number, peak: number): void {
    g.gain.setValueAtTime(0.00008, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.00008, t + a + d + r);
  }

  private rhodes(f: number, t: number, dur: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const tine = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const tg = this.ctx.createGain();
    const fl = this.ctx.createBiquadFilter();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    // FM tine ratio: 2.75× the fundamental (not 14.1×, which pushes the modulator
    // into ultrasonic range above middle C). The tine's metallic click decays fast
    // while the carrier sine sustains, producing the bright-then-warm Rhodes shape.
    tine.type = "sine";
    tine.frequency.setValueAtTime(f * 2.75, t);
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(2200, t);
    o.connect(fl);
    fl.connect(g);
    g.connect(this.bus);
    g.connect(this.fxSend);
    tine.connect(tg);
    tg.connect(this.bus);
    this.env(g, t, 0.012, 0.16, 0.42, dur, peak);
    // Higher modulation depth (0.38×) so the tine click actually colours the tone.
    this.env(tg, t, 0.001, 0.025, 0.02, 0.06, peak * 0.38);
    o.start(t);
    tine.start(t);
    o.stop(t + dur + 0.06);
    tine.stop(t + 0.1);
  }

  private voice(f: number, t: number, dur: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const fl = this.ctx.createBiquadFilter();
    o.type = "sine";
    // Triangle at 1.003 (3 cents) is inaudible — the chorus lives in the floor
    // noise, not the tone. 1.007 (12 cents) is the sweet spot: narrow enough to
    // stay in tune, wide enough to hear the warmth. Reducing o2 to sine removes
    // the triangle's stronger harmonics that made the whistle sound nasal.
    o2.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 1.007, t);
    // Warmer lowpass — 1100 Hz vs 1400 Hz stops the whistle from turning shrill
    // in the upper register where it sits most of the time.
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(1100, t);
    o.connect(fl);
    o2.connect(fl);
    fl.connect(g);
    g.connect(this.bus);
    g.connect(this.fxSend);
    // Vibrato: a 5.5 Hz LFO, depth ±0.45% of the base frequency, delayed by
    // the note's attack+onset so it kicks in after the tone is established.
    // Without this, sustained notes are perfectly static — a real whistle or
    // voice always wavers slightly, and the LFO is what makes it feel sung.
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 5.5;
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(f * 0.0045, t + 0.12);
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    lfoG.connect(o2.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.08);
    this.env(g, t, 0.04, dur * 0.3, 0.5, dur * 0.7, peak);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.08);
    o2.stop(t + dur + 0.08);
  }

  private uke(f: number, t: number, dur: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t);
    bp.type = "bandpass";
    bp.frequency.value = f * 2;
    bp.Q.value = 3.2;
    o.connect(bp);
    bp.connect(g);
    g.connect(this.bus);
    this.env(g, t, 0.003, 0.035, 0.12, dur * 0.4, peak);
    o.start(t);
    o.stop(t + dur);
  }

  private chip(f: number, t: number, dur: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const fl = this.ctx.createBiquadFilter();
    o.type = "square";
    // Brief upward pitch sweep on attack: the note starts a minor third above its
    // target and bends down in 18ms, giving a chiptune "spring" that distinguishes
    // note starts from held tones at tempo. Without it, fast passages blur together.
    o.frequency.setValueAtTime(f * 1.19, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.018);
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(1400, t);
    o.connect(fl);
    fl.connect(g);
    g.connect(this.bus);
    g.connect(this.fxSend);
    this.env(g, t, 0.008, dur * 0.25, 0.35, dur * 0.55, peak);
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  private chime(f: number, t: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o2.type = "sine";
    o2.frequency.setValueAtTime(f * 2.004, t);
    o.connect(g);
    o2.connect(g);
    g.connect(this.bus);
    g.connect(this.fxSend);
    // Sustain was 0.28 → 0.10: the chime now sparkles and lets go instead of
    // ringing across the next chord change and muddying the harmony.
    this.env(g, t, 0.015, 0.25, 0.10, 0.75, peak);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.05);
    o2.stop(t + 1.05);
  }

  /**
   * A far-away chirp, two notes rising and falling. Deliberately well above the
   * tune's register: at that distance it reads as the world answering, which is
   * where the whimsy in these songs comes from rather than from more notes.
   */
  private chirp(t: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(2350, t);
    o.frequency.exponentialRampToValueAtTime(3650, t + 0.045);
    o.frequency.exponentialRampToValueAtTime(2700, t + 0.095);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g);
    g.connect(this.bus);
    g.connect(this.fxSend);
    o.start(t);
    o.stop(t + 0.13);
  }

  private pad(freqs: readonly number[], t: number, dur: number, peak: number): void {
    if (freqs.length === 0) return;
    // Perceptual loudness of a chord summed from n equal voices scales as
    // 1/sqrt(n), not 1/n. Dividing by freqs.length was making 4-note chords
    // play at 1/4 the intended level — the pad disappeared behind the lead.
    const gain = peak / Math.sqrt(freqs.length);
    freqs.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const fl = this.ctx.createBiquadFilter();
      o.type = i % 2 ? "triangle" : "sine";
      // Slight random detune per voice (±9 cents max): chord tones that are
      // perfectly in tune sum as a single static tone. A few cents apart gives
      // each voice its own beating rate so the chord blooms and breathes.
      const detune = (Math.random() - 0.5) * 18;
      o.frequency.setValueAtTime(f * Math.pow(2, detune / 1200), t);
      fl.type = "lowpass";
      fl.frequency.setValueAtTime(900, t);
      o.connect(fl);
      fl.connect(g);
      g.connect(this.bus);
      this.env(g, t, 0.18, dur * 0.45, 0.6, dur * 0.55, gain);
      o.start(t);
      o.stop(t + dur + 0.12);
    });
  }

  private bassVoice(f: number, t: number, dur: number, peak: number, square: boolean): void {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const fl = this.ctx.createBiquadFilter();
    o.type = square ? "square" : "triangle";
    o2.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 0.5, t);
    // Square bass cutoff raised from 580→700 Hz: the extra harmonics restore the
    // grit that defines funk/drive bass. Triangle bass stays at 360 Hz (warm).
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(square ? 700 : 360, t);
    o.connect(fl);
    o2.connect(fl);
    fl.connect(g);
    g.connect(this.bus);
    // Sustain was 0.55 — at stepDur*2.4 that meant notes bled across chord changes.
    // Dropping to 0.32 lets the kick breathe and the groove sit instead of mudding.
    this.env(g, t, 0.012, 0.1, 0.32, dur * 0.6, peak);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private kick(t: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(108, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + 0.28);
  }

  /** Snare: a tonal body thump (sine at ~200 Hz) + filtered noise crack. */
  private snare(t: number): void {
    // Body: brief pitched thump — the "crack" frequency that separates a snare
    // from a click. Without this the bandpass noise is a thin paper snap.
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(210, t);
    body.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.12, t + 0.002);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    body.connect(bg);
    bg.connect(this.bus);
    body.start(t);
    body.stop(t + 0.08);
    // Noise crack: shared buffer, fresh envelope — no per-hit allocation.
    this.noiseHit(t, 0.11, 0.095, 1900, "bandpass");
  }

  private noiseHit(t: number, dur: number, peak: number, freq: number, type: BiquadFilterType): void {
    // Read from the pre-allocated noise buffer rather than building a fresh one.
    // A GainNode envelope shapes the decay without requiring the decay to be
    // baked into the buffer samples.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(this.bus);
    src.start(t);
    src.stop(t + dur);
  }

  /* ------------------------------------------------------------ teardown */

  dispose(): void {
    this.disposed = true;
    this.stop();
    try {
      this.delay.disconnect();
      this.wet.disconnect();
      this.fxSend.disconnect();
      this.filter.disconnect();
      this.duck.disconnect();
      this.comp.disconnect();
      this.bus.disconnect();
    } catch {
      /* already torn down */
    }
  }
}
