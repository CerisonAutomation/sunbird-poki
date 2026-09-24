const COIN_SCALE = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32, 2637.02, 3135.96, 3520.0];

import { GLOCK_PARTIALS, Music, type BiomeMusicStyle, type MusicMode } from "./Music";
import { SongbookPlayer } from "./SongbookPlayer";
import type { BiomeId } from "./Songbook";

/**
 * Background music is silenced at the source, independent of the `musicOn`
 * setting and Music.ts's own content — direct player feedback on a live
 * build was strongly negative and asked for it gone outright. SFX are
 * unaffected. The `Music` engine below still runs (mode/track/biome keep
 * being tracked) so re-enabling later is a one-line flip, not a rebuild.
 */
const MUSIC_DISABLED = true;

/**
 * The authored songs in `Songbook.ts` ARE the game's music, and they are what
 * `musicOn` switches. They are gated separately from `MUSIC_DISABLED` on
 * purpose: what players asked to be rid of was the *generated* score — one
 * tempo, one meter, one drum feel for thirty tracks — not the idea of music.
 * The songbook is hand-written, so it answers the complaint rather than
 * repeating it, and the two players are never audible at once (the generated
 * engine stays at zero).
 */
const SONGBOOK_ENABLED = true;

/**
 * Master audio graph:
 *   sfx ──┐
 *   music ┼─► reverb send ─► convolver ─┐
 *         └───────────────────────────► compressor ─► destination
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private whooshGain: GainNode | null = null;
  private whooshFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private music: Music | null = null;
  private songbook: SongbookPlayer | null = null;
  private muted = false;
  private musicOn = true;
  private musicVol = 0.8;
  private sfxVol = 0.9;
  private adMuted = false;
  private hiddenMuted = false;
  private portalMuted = false;
  private started = false;
  private pendingMode: MusicMode = "off";
  private pendingBiome: BiomeMusicStyle = "bright";
  private pendingTrack: number | "shuffle" = "shuffle";
  private onTrackChange: ((name: string) => void) | null = null;
  /** Prevent dense pickup/event bursts from spawning unbounded WebAudio voices.
   *  Shared by every one-shot source (oscillator tones AND noise bursts), so a
   *  boost + storm + fever + landing on the same frame cannot stack voices. */
  private activeOneShots = 0;
  private readonly maxOneShots = 28;

  /** Last value actually written to each continuously-modulated param. */
  private lastWhooshGain = -1;
  private lastWhooshFreq = -1;
  private lastWindGain = -1;

  // Ascending musical coin streak tracker
  private coinStreak = 0;
  private lastCoinTime = 0;

  private unlockListener: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const unlock = () => {
        void this.resume();
        this.removeUnlockListeners();
      };
      this.unlockListener = unlock;
      window.addEventListener("pointerdown", unlock, { passive: true });
      window.addEventListener("touchstart", unlock, { passive: true });
      window.addEventListener("keydown", unlock, { passive: true });
    }
  }

  private removeUnlockListeners(): void {
    if (!this.unlockListener || typeof window === "undefined") return;
    window.removeEventListener("pointerdown", this.unlockListener);
    window.removeEventListener("touchstart", this.unlockListener);
    window.removeEventListener("keydown", this.unlockListener);
    this.unlockListener = null;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    // Balanced buffering avoids audio-thread underruns on mobile Safari,
    // Android WebView and low-power portal devices while keeping UI cues
    // responsive enough for a flight game.
    // A slightly larger output buffer trades a few ms of latency for far fewer
    // audio-thread underruns on mobile Safari, Android WebView and low-power
    // portal devices — underruns are heard as crackle. "playback" is the
    // largest hint the API offers; fall back if a browser rejects it.
    try {
      this.ctx = new AC({ latencyHint: "playback" });
    } catch {
      this.ctx = new AC({ latencyHint: "balanced" });
    }

    const comp = this.ctx.createDynamicsCompressor();
    // Leave real headroom before the compressor. Mobile speakers expose
    // inter-sample peaks quickly as crackle when many synth voices land on the
    // same frame. A quiet post-compressor ceiling keeps the final mix below
    // 0 dBFS on Safari, Chrome Android and embedded portal webviews.
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 8;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;
    const output = this.ctx.createGain();
    output.gain.value = 0.68;
    comp.connect(output);
    output.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.72;
    this.master.connect(comp);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.muted ? 0 : 0.5 * this.sfxVol;
    this.sfxBus.connect(this.master);

    // Pre-allocate noise buffer for reuse (avoids per-call allocation)
    const noiseLen = Math.floor(this.ctx.sampleRate * 1);
    this.noiseBuffer = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const noiseData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);

    const convolver = this.ctx.createConvolver();
    const mobile = window.innerWidth < 700;
    // Shorter impulse/less wet signal on phones avoids convolution spikes while
    // keeping event stingers spacious on desktop.
    convolver.buffer = this.makeImpulse(mobile ? 0.9 : 1.8, mobile ? 1.8 : 2.3);
    const wet = this.ctx.createGain();
    wet.gain.value = mobile ? 0.1 : 0.18;
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(convolver);
    convolver.connect(wet);
    wet.connect(this.master);

    if (SONGBOOK_ENABLED) {
      this.songbook = new SongbookPlayer(this.ctx, this.master, this.reverbSend);
      this.songbook.setMode(this.pendingMode);
      this.songbook.setLevel(this.songbookLevel());
      if (this.onTrackChange) this.songbook.onTrackChange = this.onTrackChange;
    }

    if (!MUSIC_DISABLED) {
      this.music = new Music(this.ctx, this.master, this.reverbSend);
      this.music.setLevel(this.musicOn && !this.muted ? 0.5 * this.musicVol : 0);
      this.music.setBiome(this.pendingBiome);
      this.music.setMode(this.pendingMode);
      this.music.setTrack(this.pendingTrack);
      if (this.onTrackChange) this.music.onTrackChange = this.onTrackChange;
    } else {
      this.music = null;
    }

    this.buildWhoosh();
    this.buildWind();
    return this.ctx;
  }

  async resume(): Promise<void> {
    this.removeUnlockListeners();
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this.started = true;
  }

  /** Suspend an already-created context when the tab is backgrounded. */
  async suspend(): Promise<void> {
    if (!this.ctx || this.ctx.state !== "running") return;
    try {
      await this.ctx.suspend();
    } catch {
      /* Some embedded WebViews do not expose suspend; master mute still applies. */
    }
  }

  /** Resume only an existing context; never create audio outside a user gesture. */
  async resumeExisting(): Promise<void> {
    if (!this.ctx || this.ctx.state !== "suspended") return;
    try {
      await this.ctx.resume();
    } catch {
      /* A later user gesture will retry through resume(). */
    }
  }

  dispose(): void {
    this.removeUnlockListeners();
    this.music?.dispose();
    this.songbook?.dispose();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.noiseBuffer = null;
    this.master = null;
    this.sfxBus = null;
    this.reverbSend = null;
    this.whooshGain = null;
    this.whooshFilter = null;
    this.windGain = null;
    this.music = null;
    this.songbook = null;
    this.activeOneShots = 0;
  }

  /* ---------- volume & state ---------- */

  /**
   * The songbook's level, in one place. Portal/ad/hidden mutes are not here:
   * those act on the master bus, which the songbook is routed through, so they
   * silence it exactly as they silence SFX.
   */
  private songbookLevel(): number {
    return SONGBOOK_ENABLED && this.musicOn && !this.muted ? 0.5 * this.musicVol : 0;
  }

  setVolumes(musicVol: number, sfxVol: number): void {
    this.musicVol = Math.max(0, Math.min(1, musicVol));
    this.sfxVol = Math.max(0, Math.min(1, sfxVol));
    if (this.music) this.music.setLevel(MUSIC_DISABLED ? 0 : this.musicOn && !this.muted ? 0.5 * this.musicVol : 0);
    this.songbook?.setLevel(this.songbookLevel());
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : 0.5 * this.sfxVol, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.music?.setLevel(MUSIC_DISABLED ? 0 : this.musicOn && !m ? 0.5 * this.musicVol : 0);
    this.songbook?.setLevel(this.songbookLevel());
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(m ? 0 : 0.5 * this.sfxVol, this.ctx.currentTime, 0.05);
    }
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    this.music?.setLevel(MUSIC_DISABLED ? 0 : on && !this.muted ? 0.5 * this.musicVol : 0);
    this.songbook?.setLevel(this.songbookLevel());
  }

  /** Portal SDKs require that audio is silent while an ad has focus. */
  setAdMuted(muted: boolean): void {
    this.adMuted = muted;
    this.applyMasterMute();
  }

  /** A hidden tab must be a silent tab — portal QA checks this explicitly. */
  setHiddenMuted(muted: boolean): void {
    this.hiddenMuted = muted;
    this.applyMasterMute();
  }

  /**
   * Portal-level mute (CrazyGames `muteAudio` setting). Lives on the master
   * bus alongside the ad/hidden mutes, so it takes priority over the in-game
   * audio toggle — as the portal requires — without disturbing saved settings.
   */
  setPortalMuted(muted: boolean): void {
    this.portalMuted = muted;
    this.applyMasterMute();
  }

  private applyMasterMute(): void {
    if (!this.master || !this.ctx) return;
    const silent = this.adMuted || this.hiddenMuted || this.portalMuted;
    this.master.gain.setTargetAtTime(silent ? 0 : 0.72, this.ctx.currentTime, silent ? 0.01 : 0.08);
  }

  setMusicMode(mode: MusicMode): void {
    this.pendingMode = mode;
    this.music?.setMode(mode);
    this.songbook?.setMode(mode);
  }

  setBiome(style: BiomeMusicStyle, biomeId?: string): void {
    if (style === this.pendingBiome && !biomeId) return;
    this.pendingBiome = style;
    this.music?.setBiome(style);
    // The songbook keys off the island, not the style: two worlds that share a
    // musical colour are still two different places to fly.
    if (biomeId) this.songbook?.setBiome(biomeId as BiomeId);
  }

  /** Pin a track (0..9) or "shuffle" — persists via Settings. */
  setMusicTrack(sel: number | "shuffle"): void {
    this.pendingTrack = sel;
    this.music?.setTrack(sel);
  }

  setOnTrackChange(cb: (name: string) => void): void {
    this.onTrackChange = cb;
    if (this.music) this.music.onTrackChange = cb;
    if (this.songbook) this.songbook.onTrackChange = cb;
  }

  /** 0..1 — adaptive music intensity (speed/altitude/fever/danger/combos). */
  setMusicIntensity(v: number): void {
    this.music?.setIntensity(v);
    this.songbook?.setIntensity(v);
  }

  duckMusic(amount = 0.4, release = 0.5): void {
    this.music?.duck(amount, release);
    this.songbook?.ducked(amount, release);
  }

  update(
    dt: number,
    speed: number,
    diving: boolean,
    grounded: boolean,
    fever: boolean,
    daylight: number,
    playing: boolean,
    windStrength = 0,
  ): void {
    if (!this.ctx || !this.whooshGain || !this.whooshFilter || !this.windGain || this.adMuted) return;
    // Rushing air when carving down slopes OR slicing down through the sky in a dive.
    const activeRush = playing && ((grounded && speed > 8) || (diving && speed > 10));
    const whoosh = activeRush
      ? Math.min(0.32, (speed / 90) * (diving ? 0.26 : 0.12) * (fever ? 1.35 : 1))
      : 0.0008;
    // Only write a parameter when it has actually moved, and clear the pending
    // ramp first. The old code called setTargetAtTime on three params on EVERY
    // animation frame (~180 automation events/second, forever). That grows the
    // automation timeline without bound and is a known cause of crackle and
    // buffer underruns on WebViews.
    this.lastWhooshGain = this.smoothParam(
      this.whooshGain.gain,
      this.muted ? 0 : whoosh * this.sfxVol,
      0.05,
      this.lastWhooshGain,
      0.0015,
    );
    this.lastWhooshFreq = this.smoothParam(
      this.whooshFilter.frequency,
      280 + speed * 18 + (diving ? 220 : 0),
      0.08,
      this.lastWhooshFreq,
      6,
    );

    const air = playing && !grounded ? Math.min(0.18, speed / 550) : 0;
    const wind = this.muted ? 0 : (air + windStrength * 0.18) * this.sfxVol;
    this.lastWindGain = this.smoothParam(this.windGain.gain, wind, 0.12, this.lastWindGain, 0.0015);

    this.music?.setNight(1 - daylight);
    this.songbook?.setNight(1 - daylight);
    void dt;
  }

  /**
   * Write a smoothed AudioParam only when the value actually changed, clearing
   * any stale automation first so an old ramp cannot fight the new one. Returns
   * the value now being targeted, for the caller to remember.
   */
  private smoothParam(
    param: AudioParam,
    value: number,
    timeConstant: number,
    previous: number,
    epsilon: number,
  ): number {
    if (Math.abs(value - previous) < epsilon) return previous;
    const t = this.ctx!.currentTime;
    // Each param here has exactly one driver, so cancelling outright is safe
    // and cheaper than cancelAndHoldAtTime (which older Safari lacks).
    param.cancelScheduledValues(t);
    param.setTargetAtTime(value, t, timeConstant);
    return value;
  }

  /* ---------- one-shots with juicy feedback ---------- */

  /** Tactile aerodynamic tuck cue when initiating a dive. */
  diveCue(): void {
    this.noiseBurst(0.12, 600, 0.05);
    this.tone(280, 0.09, "sine", 0.03, 140);
  }

  chirp(): void {
    this.tone(440, 0.14, "sine", 0.16, 980);
    this.tone(660, 0.1, "triangle", 0.06, 1240);
  }

  /**
   * Ascending musical coin chime!
   * Rapid coin collections ascend a soaring pentatonic scale (C6 -> A7)
   * with overtone sparkle and resonant bell harmony on streaks of 5+.
   */
  ding(gem = false): void {
    const now = performance.now();
    if (now - this.lastCoinTime > 1500) {
      this.coinStreak = 0;
    }
    this.coinStreak++;
    this.lastCoinTime = now;

    // Pentatonic scale: C6, D6, E6, G6, A6, C7, D7, E7, G7, A7
    const pitch = COIN_SCALE[Math.min(this.coinStreak - 1, COIN_SCALE.length - 1)]!;
    const freq = gem ? pitch * 1.5 : pitch;

    this.tone(freq, 0.12, "sine", 0.14, freq * 1.04);
    this.tone(freq * 2, 0.08, "triangle", 0.06);

    if (this.coinStreak >= 5 || gem) {
      this.tone(freq * 1.5, 0.22, "sine", 0.08);
    }
  }

  perfect(): void {
    this.tone(523.25, 0.18, "sine", 0.14, 523.25);
    this.tone(659.25, 0.2, "sine", 0.12, 659.25);
    this.tone(783.99, 0.24, "sine", 0.12, 783.99);
    this.tone(1046.5, 0.28, "triangle", 0.08, 1046.5);
    this.music?.sidechainPump(0.3, 0.15);
  }

  /**
   * Moon Prism Power — Sailor Moon transformation sequence.
   *
   * Three acts, timed like the anime:
   *   0.00s  Sparkle run: chromatic ascending glitter (the ribbon-spin sound)
   *   0.18s  Power chord stab: sawtooth triad hit with reverb swell
   *   0.38s  Choir swell: detuned sines fade in on the held chord (the "ahhhh")
   *   0.55s  Beat drop + glissando: music snaps to fever mode triumphantly
   *
   * All synthesized — no samples, no files.
   */
  feverOn(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const bus = this.sfxBus;

    // ── Act 1: dreamy sparkle ribbon ──────────────────────────────────────
    // Slow, floaty ascending shimmer — not a fast zip, a gentle magical bloom
    const sparkNotes = [784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136, 3520];
    sparkNotes.forEach((freq, i) => {
      const t = now + i * 0.030; // slower spacing = dreamier
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      // gentle pitch wobble on each sparkle — like a music box key
      lfo.frequency.value = 4.5 + i * 0.3;
      lfoG.gain.value = freq * 0.006;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.025);  // soft attack
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); // long tail
      o.connect(g); g.connect(bus);
      o.start(t); lfo.start(t); o.stop(t + 0.22); lfo.stop(t + 0.22);
    });

    // ── Act 2: magical harp chord ──────────────────────────────────────────
    // Triangle waves arpeggiated slowly up — like a harp sweep in a dream
    const harp = now + 0.30;
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      const t = harp + i * 0.045;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 0.6);
    });

    // ── Act 3: dreamy choir swell "ahhhhh" ────────────────────────────────
    // 8 very gently detuned sines with a very slow attack — floats in like mist
    const choir = now + 0.55;
    [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      const detune = (i % 4 - 1.5) * 0.005;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq * (1 + detune);
      const peak = 0.055 - i * 0.004;
      g.gain.setValueAtTime(0.0001, choir);
      g.gain.exponentialRampToValueAtTime(peak, choir + 0.40); // very slow bloom
      g.gain.setValueAtTime(peak, choir + 0.80);
      g.gain.exponentialRampToValueAtTime(0.0001, choir + 1.40);
      o.connect(g); g.connect(bus);
      o.start(choir); o.stop(choir + 1.5);
    });

    // ── Final glow: gentle glissando, no hard drop ────────────────────────
    setTimeout(() => {
      this.music?.triggerViralGlissando();
      this.music?.sidechainPump(0.18, 0.30); // soft pump, not a slam
    }, 800);
  }

  triggerBeatDrop(intensityMult?: number): void {
    this.music?.triggerBeatDrop(intensityMult);
  }

  triggerViralGlissando(): void {
    this.music?.triggerViralGlissando();
  }

  sidechainPump(duckAmount?: number, duration?: number): void {
    this.music?.sidechainPump(duckAmount, duration);
  }

  splash(): void {
    this.noiseBurst(0.28, 900, 0.14);
    this.tone(180, 0.2, "sine", 0.09, 70);
  }

  sleep(): void {
    // A real sting, not a shrug: falling minor line over a low drone.
    this.tone(392, 0.4, "sine", 0.1, 196);
    this.tone(329.63, 0.55, "triangle", 0.07, 164.81);
    this.tone(98, 1.4, "sine", 0.07, 92);
    this.tone(311.13, 0.8, "sine", 0.05, 155.56);
  }

  island(): void {
    this.tone(523.25, 0.15, "sine", 0.1, 659.25);
    this.tone(659.25, 0.18, "sine", 0.09, 783.99);
    this.tone(783.99, 0.22, "sine", 0.1, 1046.5);
    this.tone(1046.5, 0.35, "triangle", 0.09, 1318.5);
  }

  cloud(): void {
    this.tone(783.99, 0.14, "sine", 0.1, 1046.5);
    this.tone(1174.66, 0.1, "triangle", 0.05);
  }

  land(impact: number): void {
    const a = Math.min(0.12, impact * 0.014);
    if (a < 0.02) return;
    this.noiseBurst(0.08, 420, a);
  }

  zenith(): void {
    this.tone(880, 0.5, "sine", 0.09, 1760);
    this.tone(1320, 0.6, "triangle", 0.05, 1320);
    this.tone(660, 0.4, "sine", 0.06, 990);
  }

  powerup(): void {
    this.tone(659.25, 0.1, "square", 0.05, 987.77);
    this.tone(987.77, 0.14, "square", 0.05, 1318.5);
  }

  shield(): void {
    this.tone(320, 0.25, "sine", 0.12, 640);
    this.noiseBurst(0.16, 1300, 0.07);
  }

  /** Coin magnet: a bright swirling shimmer as loose change flies your way. */
  magnetOn(): void {
    this.tone(1046.5, 0.1, "sine", 0.08, 1567.98);
    this.tone(1567.98, 0.16, "triangle", 0.07, 2093);
    this.noiseBurst(0.14, 2400, 0.04);
  }

  /** Rocket boost: a low whoosh rising into a bright flare. */
  boost(): void {
    this.tone(110, 0.32, "sawtooth", 0.09, 660);
    this.noiseBurst(0.3, 1200, 0.1);
    this.tone(440, 0.16, "square", 0.05, 880);
  }

  purchase(): void {
    this.tone(523.25, 0.1, "triangle", 0.09, 659.25);
    this.tone(783.99, 0.2, "triangle", 0.09, 1046.5);
    this.tone(1046.5, 0.32, "sine", 0.07);
  }

  thermal(): void {
    this.tone(329.63, 0.5, "sine", 0.06, 659.25);
    this.tone(493.88, 0.4, "triangle", 0.04, 987.77);
  }

  gust(): void {
    this.noiseBurst(0.6, 750, 0.06);
  }

  storm(): void {
    this.noiseBurst(0.35, 320, 0.12);
    this.tone(90, 0.3, "sine", 0.09, 50);
  }

  /** Distance milestone: rising fourth — "you're getting somewhere". */
  milestone(): void {
    this.tone(783.99, 0.14, "sine", 0.1, 830);
    this.tone(1046.5, 0.3, "triangle", 0.09, 1108);
  }

  /** Golden Hour begins: warm brass-ish swell, the day's last light. */
  goldenHour(): void {
    this.tone(392, 0.7, "sawtooth", 0.035, 396);
    this.tone(493.88, 0.7, "sawtooth", 0.03, 498);
    this.tone(587.33, 0.9, "triangle", 0.06, 592);
    this.tone(783.99, 1.1, "sine", 0.07, 790);
  }

  /** Rival mark beaten mid-run: two-note gloat. */
  rivalDown(): void {
    this.tone(659.25, 0.12, "square", 0.05, 690);
    this.tone(987.77, 0.35, "triangle", 0.09, 1046);
  }

  butter(): void {
    this.tone(1046.5, 0.08, "sine", 0.07, 1318.5);
    this.tone(1318.5, 0.12, "sine", 0.06, 1567.98);
  }

  /** Comedy honk — a squeezed rubber-duck blast for silly moments. */
  honk(): void {
    this.tone(196, 0.16, "square", 0.1, 175);
    this.tone(392, 0.12, "sawtooth", 0.05, 330);
    this.noiseBurst(0.05, 1800, 0.03);
  }

  /** Tiny sneeze: inhale chirp then a fast descending "choo". */
  sneeze(): void {
    this.tone(880, 0.09, "sine", 0.06, 1320);
    this.tone(660, 0.16, "triangle", 0.09, 220);
    this.noiseBurst(0.12, 2400, 0.06);
  }

  /** Cartoon boing for springy surprises. */
  boing(): void {
    this.tone(220, 0.28, "sine", 0.12, 660);
    this.tone(330, 0.22, "triangle", 0.06, 880);
  }

  /** Ring chains climb through a bounded major pentatonic chord, not a
   * full fanfare on every gate. Two short tones leave timing sounds audible. */
  ringPass(chain: number): void {
    const pitch = COIN_SCALE[Math.min(4, Math.max(0, Math.floor(chain) - 1))]! / 2;
    this.tone(pitch, 0.10, "sine", 0.09, pitch * 1.25);
    this.tone(pitch * 1.5, 0.09, "triangle", 0.04);
  }

  /** A soft brush/whistle distinguishes a ridge skim from a butter landing. */
  ridgeSkim(): void {
    this.noiseBurst(0.08, 2200, 0.025);
    this.tone(784, 0.10, "sine", 0.055, 1046.5);
  }

  /** Balloon bounce: a taut rubber pop + a springy upward slide. */
  balloon(): void {
    this.noiseBurst(0.06, 2600, 0.16);
    this.tone(220, 0.1, "sine", 0.12, 260);
    this.tone(392, 0.2, "sine", 0.1, 660);
    this.tone(523.25, 0.22, "triangle", 0.08, 880);
  }

  /** Short triumphant fanfare for surprise windfalls. */
  fanfare(): void {
    this.tone(523.25, 0.12, "square", 0.06, 523.25);
    this.tone(659.25, 0.12, "square", 0.06, 659.25);
    this.tone(783.99, 0.16, "square", 0.07, 783.99);
    this.tone(1046.5, 0.4, "triangle", 0.1, 1046.5);
    this.tone(1318.5, 0.3, "sine", 0.05, 1318.5);
  }

  /** Woozy slide-whistle drop — plays when something absurd happens. */
  slideWhistle(): void {
    this.tone(1400, 0.45, "sine", 0.08, 300);
  }

  launchWhoosh(rating: string, speed: number): void {
    const speedRatio = Math.min(1.5, Math.max(0.4, speed / 55));
    const baseFreq = rating === "perfect" ? 784 : rating === "great" ? 587 : 440;
    this.tone(baseFreq, 0.18, "sine", 0.12 * speedRatio, baseFreq * 1.6);
    this.noiseBurst(0.2, 800 + speed * 12, 0.07 * speedRatio);
  }

  /** Momentum building: a short low-to-high rubbery scoop, once per big drop. */
  runup(): void {
    this.tone(130.81, 0.32, "triangle", 0.07, 261.63);
    this.noiseBurst(0.18, 650, 0.035);
  }

  /** A wider upward whistle for the island-transfer ramp. */
  rampLaunch(speed: number): void {
    this.tone(392, 0.30, "sine", 0.09, 1174.66);
    this.tone(587.33, 0.24, "triangle", 0.045, 1567.98);
    this.noiseBurst(0.2, 800 + Math.min(128, speed) * 10, 0.045);
  }

  /** A quiet apex bell tells the player the climb has become a descent. */
  apexChime(): void {
    this.tone(1046.5, 0.32, "sine", 0.045);
    this.tone(1567.98, 0.4, "sine", 0.025);
  }

  countdownBeep(isGo = false): void {
    if (isGo) {
      // "GO!" — bright ascending major triad + sub-bass punch + sidechain
      this.tone(523.25, 0.06, "square",   0.07, 1046.5);   // C5 → C6
      this.tone(659.25, 0.09, "square",   0.07, 1318.5);   // E5 → E6
      this.tone(783.99, 0.12, "square",   0.07, 1567.98);  // G5 → G6
      this.tone(1046.5, 0.45, "sine",     0.18, 1046.5);   // C6 ring
      this.tone(1567.98, 0.35, "triangle", 0.10);          // G6 shimmer
      this.music?.triggerBeatDrop(0.65);
      this.music?.sidechainPump(0.48, 0.18);
    } else {
      // Tick — punchy staccato double-tone, much more audible than a plain beep
      this.tone(880,  0.07, "square",   0.11);
      this.tone(1320, 0.05, "triangle", 0.055);
    }
  }

  /** Feather-soft UI tick for screen navigation — barely there, very tactile. */
  uiTick(): void {
    this.tone(2093, 0.035, "sine", 0.028, 1567.98);
  }

  /** Weekly-event stinger: a rising two-note "something special" cue. */
  eventStinger(): void {
    this.tone(392, 0.14, "triangle", 0.08, 523.25);
    this.tone(587.33, 0.2, "sine", 0.09, 783.99);
    this.tone(1174.66, 0.26, "sine", 0.05);
  }

  /** Campaign chapter-complete fanfare — bigger than the windfall fanfare. */
  chapterFanfare(): void {
    this.tone(392, 0.14, "square", 0.06);
    this.tone(523.25, 0.14, "square", 0.06, 523.25);
    this.tone(659.25, 0.18, "square", 0.07);
    this.tone(783.99, 0.3, "triangle", 0.1, 830);
    this.tone(1046.5, 0.5, "sine", 0.09, 1046.5);
    this.tone(1568, 0.35, "sine", 0.04);
    this.noiseBurst(0.08, 3200, 0.03);
  }

  eggHatch(): void {
    this.noiseBurst(0.06, 1400, 0.14);
    this.tone(587.33, 0.12, "triangle", 0.08, 880);
    this.tone(880, 0.16, "sine", 0.1, 1174.66);
    this.tone(1174.66, 0.28, "sine", 0.12);
  }

  /** Achievement/trophy unlock: a rising triad into a real glockenspiel bell
   *  strike (same bar-partial synthesis as the score's lead, see `bell()`) —
   *  a distinct timbre so a trophy never gets mistaken for a generic fanfare. */
  trophy(): void {
    this.tone(523.25, 0.1, "triangle", 0.07, 659.25);
    this.tone(659.25, 0.12, "triangle", 0.07, 783.99);
    this.bell(1046.5, 0.55, 0.6);
  }

  /** New personal best: a rising major run into a shimmering bell top —
   *  bigger than milestone(), brighter than fanfare(), reserved for a
   *  genuine record so the moment actually lands. */
  personalBest(): void {
    this.tone(587.33, 0.12, "triangle", 0.08, 698.46);
    this.tone(739.99, 0.14, "triangle", 0.08, 880);
    this.tone(987.77, 0.18, "sine", 0.09, 1174.66);
    this.bell(1567.98, 0.45, 0.5);
    this.noiseBurst(0.12, 4200, 0.03);
  }

  /* ---------- synth primitives ---------- */

  /**
   * Triangular-distributed jitter centered on 0 (two averaged draws land near
   * the middle far more often than the edges, per standard game-audio
   * humanization practice — a single uniform draw feels twitchier). Used to
   * give repeated one-shots a few cents of natural detune instead of firing
   * bit-identical oscillators on every repeat, which is what makes a rapid
   * pickup streak read as a machine gun instead of a chime.
   */
  private humanize(spread: number): number {
    return (Math.random() + Math.random() - 1) * spread;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
    if (!this.ctx || !this.sfxBus || !this.reverbSend || this.muted || this.sfxVol <= 0 || this.adMuted || this.hiddenMuted || this.portalMuted || !this.started) return;
    if (this.activeOneShots >= this.maxOneShots) return;
    this.activeOneShots++;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    // Click-free envelope: a ~5 ms rise, then exponential decay. A touch of
    // gain humanization (±6%) alongside the detune above — same rationale.
    const effGain = Math.max(0.0001, gain * this.sfxVol * 0.78 * (1 + this.humanize(0.06)));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(effGain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.sfxBus);
    const send = this.ctx.createGain();
    send.gain.value = 0.35;
    g.connect(send);
    send.connect(this.reverbSend);

    let ended = 0;
    const voices = dur < 0.12 ? 1 : 2;
    const voice = (detune: number, vol: number): void => {
      const o = this.ctx!.createOscillator();
      o.type = type;
      // A few cents of humanized detune on top of the chorus offset — see
      // `humanize()` — so the same cue fired twice in a row isn't bit-for-bit
      // identical. Imperceptible as mistuning, audible as "not a loop".
      o.detune.value = detune + this.humanize(5);
      const vg = this.ctx!.createGain();
      vg.gain.value = vol;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
      o.connect(vg);
      vg.connect(g);
      o.start();
      o.stop(t + dur + 0.03);
      o.addEventListener("ended", () => {
        o.disconnect();
        vg.disconnect();
        ended++;
        if (ended === voices) {
          g.disconnect();
          send.disconnect();
          this.activeOneShots = Math.max(0, this.activeOneShots - 1);
        }
      });
    };
    // Longer accents get a chorus; short ticks use one oscillator/gain pair.
    // Preserve the envelope while avoiding a doubled node graph for tiny cues.
    voice(0, voices === 1 ? 1 : 0.8);
    if (voices === 2) voice(6, 0.4);
  }

  private noiseBurst(dur: number, freq: number, gain: number): void {
    if (!this.ctx || !this.sfxBus || this.muted || this.sfxVol <= 0 || this.adMuted || this.hiddenMuted || this.portalMuted || !this.started) return;
    if (this.activeOneShots >= this.maxOneShots) return;
    this.activeOneShots++;
    const len = Math.floor(this.ctx.sampleRate * dur);
    // Reuse pre-allocated noise buffer when duration fits, otherwise create new
    if (!this.noiseBuffer || len > this.noiseBuffer.length) {
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const buffer = this.noiseBuffer;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    // Same humanization as tone(): a few percent of filter/gain jitter keeps
    // repeated bursts (coin lands, wing flaps) from sounding stamped-out.
    filter.frequency.value = freq * (1 + this.humanize(0.05));
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    const effGain = Math.max(0.0001, gain * this.sfxVol * 0.72 * (1 + this.humanize(0.06)));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(effGain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.03);
    src.addEventListener("ended", () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      this.activeOneShots = Math.max(0, this.activeOneShots - 1);
    });
  }

  /**
   * A real glockenspiel bell strike for one-shot stingers (trophy, personal
   * best): additive synthesis over the same inharmonic bar-partial ratio set
   * (`GLOCK_PARTIALS`) the music engine's lead voice uses, instead of one more
   * plain oscillator tone. `decayScale` shrinks the partials' natural ring
   * (1.9s at 1.0) to a one-shot-appropriate length.
   */
  private bell(freq: number, gain: number, decayScale = 1): void {
    if (!this.ctx || !this.sfxBus || !this.reverbSend || this.muted || this.sfxVol <= 0 || this.adMuted || this.hiddenMuted || this.portalMuted || !this.started) return;
    if (this.activeOneShots >= this.maxOneShots) return;
    this.activeOneShots++;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = 1;
    out.connect(this.sfxBus);
    const send = this.ctx.createGain();
    send.gain.value = 0.4;
    out.connect(send);
    send.connect(this.reverbSend);

    const peak = gain * this.sfxVol;
    let ended = 0;
    for (const p of GLOCK_PARTIALS) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq * p.ratio;
      o.detune.value = this.humanize(4);
      const decay = Math.max(0.05, p.decay * decayScale);
      const amp = Math.max(0.0001, peak * p.amp);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp, t + 0.0025);
      og.gain.exponentialRampToValueAtTime(amp * 0.35, t + decay * 0.35);
      og.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(og);
      og.connect(out);
      o.start(t);
      o.stop(t + decay + 0.05);
      o.addEventListener("ended", () => {
        o.disconnect();
        og.disconnect();
        ended++;
        if (ended === GLOCK_PARTIALS.length) {
          out.disconnect();
          send.disconnect();
          this.activeOneShots = Math.max(0, this.activeOneShots - 1);
        }
      });
    }
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        d[i] = (Math.random() * 2 - 1) * env * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  private buildWhoosh(): void {
    if (!this.ctx || !this.sfxBus) return;
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start();
    this.whooshFilter = filter;
    this.whooshGain = g;
  }

  private buildWind(): void {
    if (!this.ctx || !this.sfxBus) return;
    const len = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let a = 0;
    let b = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      a = 0.997 * a + 0.003 * white;
      b = 0.95 * b + 0.05 * white;
      data[i] = (a * 6 + b * 0.6) * 0.8;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start();
    this.windGain = g;
  }
}
