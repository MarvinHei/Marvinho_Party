// Central audio manager: looping background music + procedural sound effects,
// all routed through a single AnalyserNode so visualizers can react to the mix.
//
// Everything is lazy and gesture-gated: browsers block audio until the user
// interacts, so the AudioContext is created/resumed on the first call to
// unlock() (wired to the first pointer/key event in App).

const MUSIC_URL = "/audio/music.mp3";
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
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;
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

  /** Call from the first user gesture: resume context + start the music loop. */
  unlock() {
    this.ensureGraph();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.unlocked) {
      this.startMusic();
      this.unlocked = true;
      this.emit();
    }
  }

  private startMusic() {
    if (!this.ctx || !this.musicGain || this.musicEl) return;
    const el = new Audio(MUSIC_URL);
    el.loop = true;
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    try {
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.musicGain);
    } catch {
      // Fallback: play the element directly (no visualizer contribution).
    }
    this.musicEl = el;
    void el.play().catch(() => {
      /* will retry on next unlock() */
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
        this.sweep(t, 400, 1100, 0.22, 0.22);
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
}

export const audio = new AudioManager();

/** Convenience shorthand used throughout the UI. */
export function sfx(name: SfxName) {
  audio.play(name);
}
