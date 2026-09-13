// Central audio manager: looping background music + procedural sound effects,
// all routed through a single AnalyserNode so visualizers can react to the mix.
//
// Everything is lazy and gesture-gated: browsers block audio until the user
// interacts, so the AudioContext is created/resumed on the first call to
// unlock() (wired to the first pointer/key event in App).

const MUSIC_URL = "/audio/music.mp3";
// Start-screen theme; loops until the game starts, then MUSIC_URL takes over.
const OPENING_URL = "/audio/opening.mp3";
const LS_KEY = "marvinho.audio";

export type SfxName =
  | "type"        // Wordle letter entry
  | "submit"      // Wordle row submit
  | "correct"     // Wordle solved / right guess
  | "wrong"       // invalid / out of guesses
  | "tick"        // timer tick when time is low
  | "lock"        // Tetris piece landing
  | "lineclear"   // Tetris line cleared
  | "click"       // puzzle cell click (Tango/Queens/Sudoku)
  | "place"       // puzzle "commit" (queen placed / number set)
  | "spin"        // wheel spinning
  | "countdown"   // pre-game countdown beep
  | "win";        // game / match won

interface Settings {
  muted: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number;   // 0..1
}

function loadSettings(): Settings {
  const def: Settings = { muted: false, musicVolume: 0.4, sfxVolume: 0.6 };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return def;
    return { ...def, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return def;
  }
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private musicEl: HTMLAudioElement | null = null;
  private openingEl: HTMLAudioElement | null = null;
  private gameMusicEl: HTMLAudioElement | null = null;
  /** Whichever music element is currently meant to be audible (for gapless switches). */
  private currentMusicEl: HTMLAudioElement | null = null;
  /** True once music playback has actually begun (survives autoplay blocks). */
  private started = false;
  private gameMusicUrl: string | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;
  // Intro sequence: "pre" before the first unlock, "opening" while the one-shot
  // intro plays, "background" once it hands off (with a crash) to the loop.
  private phase: "pre" | "opening" | "background" = "pre";
  private settings = loadSettings();
  private listeners = new Set<() => void>();

  // --- UI subscription (for the mute/volume control) ---------------------
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private emit() {
    for (const fn of this.listeners) fn();
  }

  get muted(): boolean {
    return this.settings.muted;
  }
  get musicVolume(): number {
    return this.settings.musicVolume;
  }
  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }
  get ready(): boolean {
    return this.unlocked;
  }
  /** "pre" | "opening" | "background" — drives the landing-page intro. */
  get introPhase(): "pre" | "opening" | "background" {
    return this.phase;
  }

  private persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage may be blocked; ignore */
    }
  }

  /** Build the audio graph. Safe to call repeatedly. */
  private ensureGraph() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const musicGain = ctx.createGain();
    const sfxGain = ctx.createGain();

    // music + sfx -> master -> analyser -> destination
    musicGain.connect(master);
    sfxGain.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    master.gain.value = this.settings.muted ? 0 : 1;
    musicGain.gain.value = this.settings.musicVolume;
    sfxGain.gain.value = this.settings.sfxVolume;

    // Short white-noise buffer reused by percussive effects.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.analyserNode = analyser;
    this.musicGain = musicGain;
    this.sfxGain = sfxGain;
    this.noiseBuffer = noise;
  }

  /**
   * Resume the context and start the music. Called on page load (to autoplay
   * where the browser allows it) and on every early user gesture, so a blocked
   * autoplay attempt is simply retried until one succeeds.
   */
  unlock() {
    this.ensureGraph();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    this.startMusic();
    if (!this.unlocked) {
      this.unlocked = true;
      this.emit();
    }
  }

  private startMusic() {
    if (!this.ctx || !this.musicGain || this.started) return;

    // Build the two loops once; play attempts can retry after an autoplay block.
    if (!this.openingEl) {
      const el = new Audio(MUSIC_URL);
      el.loop = true;
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      try {
        this.ctx.createMediaElementSource(el).connect(this.musicGain);
      } catch {
        // Fallback: play the element directly (no visualizer contribution).
      }
      this.musicEl = el;

      // The opening theme loops on the start screen until the game begins.
      const opening = new Audio(OPENING_URL);
      opening.loop = true;
      opening.crossOrigin = "anonymous";
      opening.preload = "auto";
      try {
        this.ctx.createMediaElementSource(opening).connect(this.musicGain);
      } catch {
        // Fallback: element plays directly (no visualizer contribution).
      }
      this.openingEl = opening;
      opening.addEventListener("playing", () => {
        this.started = true;
        if (this.phase === "pre") {
          this.phase = "opening";
          this.emit();
        }
      });
    }

    // (Re)attempt playback. If the browser blocks autoplay it stays un-started
    // and the next unlock() (e.g. the first click/keypress) tries again.
    const current = this.phase === "background" ? this.musicEl : this.openingEl;
    this.currentMusicEl = current;
    void current?.play().then(() => { this.started = true; }).catch(() => {
      /* blocked — retried on the next unlock() */
    });
  }

  /**
   * Switch from the looping opening theme to the in-game background loop. Called
   * when the game starts; idempotent.
   */
  enterGame() {
    this.ensureGraph();
    if (this.phase === "background") return;
    this.phase = "background";
    this.emit();
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    // If a game-specific track is already playing, keep it; otherwise cross to
    // the background loop with no overlap.
    if (this.gameMusicEl && !this.gameMusicEl.paused) {
      this.fadeOutPause(this.openingEl);
      this.currentMusicEl = this.gameMusicEl;
    } else {
      this.switchMusic(this.musicEl);
    }
  }

  /**
   * Play a game-specific looping track (e.g. Tetris), ducking the idle music
   * until stopGameMusic() restores it. Routed through the same music gain, so it
   * respects volume/mute and feeds the visualizer.
   */
  startGameMusic(url: string) {
    this.ensureGraph();
    if (!this.ctx || !this.musicGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.gameMusicUrl !== url) {
      if (this.gameMusicEl && this.gameMusicEl !== this.currentMusicEl) {
        this.fadeOutPause(this.gameMusicEl);
      }
      const el = new Audio(url);
      el.loop = true;
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      try {
        const src = this.ctx.createMediaElementSource(el);
        src.connect(this.musicGain);
      } catch {
        // Fallback: element plays directly (no visualizer contribution).
      }
      this.gameMusicEl = el;
      this.gameMusicUrl = url;
    }
    // Cross to the game track (fades out the idle/opening loop first, no overlap).
    this.switchMusic(this.gameMusicEl, true);
  }

  /** Fade out the game track and resume the idle background loop (no overlap). */
  stopGameMusic() {
    if (this.unlocked) this.switchMusic(this.musicEl);
    else this.fadeOutPause(this.gameMusicEl);
  }

  // --- fade helpers ------------------------------------------------------
  private fadeTimers = new WeakMap<HTMLAudioElement, number>();

  private cancelFade(el: HTMLAudioElement) {
    const id = this.fadeTimers.get(el);
    if (id != null) {
      clearInterval(id);
      this.fadeTimers.delete(el);
    }
  }

  /**
   * Ramp an element's volume to 0 over `ms`, then pause it and restore volume.
   * `onDone` runs once the element is fully out (or immediately if it wasn't
   * playing), so callers can start the next track without any overlap.
   */
  private fadeOutPause(el: HTMLAudioElement | null, ms = 450, onDone?: () => void) {
    if (!el || el.paused) {
      onDone?.();
      return;
    }
    this.cancelFade(el);
    const startVol = el.volume;
    const steps = 15;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      el.volume = Math.max(0, startVol * (1 - i / steps));
      if (i >= steps) {
        this.cancelFade(el);
        el.pause();
        el.volume = startVol; // restore for the next play
        onDone?.();
      }
    }, Math.max(10, ms / steps));
    this.fadeTimers.set(el, id);
  }

  /**
   * Switch the audible music to `nextEl` with no overlap: fade the current track
   * fully out first, then start the next one.
   */
  private switchMusic(nextEl: HTMLAudioElement | null, resetToStart = false) {
    const prev = this.currentMusicEl;
    this.currentMusicEl = nextEl;
    const start = () => {
      if (nextEl) this.playEl(nextEl, resetToStart);
    };
    if (prev && prev !== nextEl && !prev.paused) {
      this.fadeOutPause(prev, 380, start); // old out, then new in — no overlap
    } else {
      start();
    }
  }

  /** Play/resume at full element volume, cancelling any in-flight fade. */
  private playEl(el: HTMLAudioElement | null, resetToStart = false) {
    if (!el) return;
    this.cancelFade(el);
    el.volume = 1;
    if (resetToStart) {
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    void el.play().catch(() => {
      /* likely not unlocked yet */
    });
  }

  // --- settings ----------------------------------------------------------
  toggleMute() {
    this.settings.muted = !this.settings.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    this.persist();
    this.emit();
  }

  setMusicVolume(v: number) {
    this.settings.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, this.ctx.currentTime, 0.02);
    }
    this.persist();
    this.emit();
  }

  // --- sound effects -----------------------------------------------------
  /** Fire a procedural sound effect. No-op until the context is unlocked. */
  play(name: SfxName) {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out || this.settings.muted || ctx.state !== "running") return;
    const t = ctx.currentTime;
    switch (name) {
      case "type":
        this.blip(t, 220, 0.05, "square", 0.18);
        break;
      case "click":
        this.blip(t, 340, 0.045, "triangle", 0.22);
        break;
      case "place":
        this.blip(t, 300, 0.06, "sine", 0.28);
        this.blip(t + 0.04, 520, 0.07, "sine", 0.22);
        break;
      case "submit":
        this.blip(t, 300, 0.08, "sawtooth", 0.16);
        break;
      case "tick":
        this.blip(t, 900, 0.03, "sine", 0.14);
        break;
      case "lock":
        this.thud(t);
        break;
      case "lineclear":
        // A deeper, muffled block "whump" (duller than the sweep it replaced).
        this.dullBlock(t);
        break;
      case "correct":
        this.arpeggio(t, [523.25, 659.25, 783.99], 0.09, 0.24);
        break;
      case "wrong":
        this.blip(t, 160, 0.18, "sawtooth", 0.2);
        this.blip(t, 120, 0.18, "square", 0.12);
        break;
      case "spin":
        this.sweep(t, 300, 720, 0.5, 0.12);
        break;
      case "countdown":
        this.blip(t, 660, 0.12, "sine", 0.26);
        break;
      case "win":
        this.arpeggio(t, [523.25, 659.25, 783.99, 1046.5], 0.12, 0.3);
        this.sweep(t + 0.5, 500, 1200, 0.4, 0.18);
        break;
    }
  }

  // --- synthesis primitives ---------------------------------------------
  private env(gain: GainNode, t: number, dur: number, peak: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private blip(t: number, freq: number, dur: number, type: OscillatorType, peak: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    this.env(g, t, dur, peak);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private sweep(t: number, from: number, to: number, dur: number, peak: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    this.env(g, t, dur, peak);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private thud(t: number) {
    const ctx = this.ctx!;
    // Low sine drop.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    this.env(g, t, 0.14, 0.3);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.16);
    // Noise click for "impact".
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const ng = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 800;
      this.env(ng, t, 0.06, 0.18);
      src.connect(filt).connect(ng).connect(this.sfxGain!);
      src.start(t);
      src.stop(t + 0.07);
    }
  }

  private arpeggio(t: number, freqs: number[], step: number, peak: number) {
    freqs.forEach((f, i) => this.blip(t + i * step, f, step + 0.08, "triangle", peak));
  }

  /** A deep, muffled block "whump" for Tetris line clears. */
  private dullBlock(t: number) {
    const ctx = this.ctx!;
    // Low, quick pitch drop with plenty of body.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.2);
    this.env(g, t, 0.24, 0.42);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.26);
    // Muffled noise body (heavy low-pass) — no bright click.
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const ng = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 300;
      this.env(ng, t, 0.16, 0.22);
      src.connect(filt).connect(ng).connect(this.sfxGain!);
      src.start(t);
      src.stop(t + 0.18);
    }
  }

  /**
   * A snare-style drum roll for the game wheel: rapid filtered-noise hits that
   * crescendo, capped by a cymbal-like swell. `durationMs` should roughly match
   * the spin length.
   */
  drumroll(durationMs = 1800) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted || ctx.state !== "running") return;
    const t0 = ctx.currentTime;
    const roll = Math.min(durationMs, 2600) / 1000;
    const step = 0.045;
    const n = Math.floor(roll / step);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * step;
      const grow = 0.25 + 0.75 * (i / n); // crescendo
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1900;
      filt.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14 * grow, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.9);
      src.connect(filt).connect(g).connect(this.sfxGain);
      src.start(t);
      src.stop(t + step);
    }
    // Cymbal swell to finish.
    const end = t0 + roll;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const g = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    g.gain.setValueAtTime(0.0001, end);
    g.gain.exponentialRampToValueAtTime(0.2, end + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.5);
    src.connect(hp).connect(g).connect(this.sfxGain);
    src.start(end);
    src.stop(end + 0.55);
  }
}

export const audio = new AudioManager();

/** Convenience shorthand used throughout the UI. */
export function sfx(name: SfxName) {
  audio.play(name);
}
