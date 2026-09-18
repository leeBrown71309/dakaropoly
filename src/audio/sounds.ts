import type { SoundName } from "../game/types";

/**
 * Every sound is synthesised on the fly — no audio files anywhere.
 *
 * The palette is built so an event is recognisable with your eyes on the
 * board: money coming in is always a cash register, money going out always
 * the same dull fall, and the heavier moments (jail, bankruptcy) have their
 * own voice rather than borrowing one.
 */

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  when?: number;
  slideTo?: number;
}

interface NoiseOpts {
  dur: number;
  gain: number;
  /** Lowpass cutoff, or the centre frequency when `band` is set. */
  freq: number;
  when?: number;
  band?: boolean;
  q?: number;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  private level = 0.8;

  set volume(value: number) {
    this.level = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.level;
  }

  get volume(): number {
    return this.level;
  }

  private context(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.level;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /**
   * iOS only lets an audio context start from inside a user gesture, and the
   * sounds this game plays are fired from the event queue long after the tap
   * that caused them. Opening the context on the first touch — which
   * `installAudioUnlock` does once — is what keeps a phone from playing the
   * whole game in silence.
   */
  unlock(): void {
    this.context();
  }

  private out(): AudioNode | null {
    const ctx = this.context();
    return ctx ? (this.master ?? ctx.destination) : null;
  }

  private tone({ freq, dur, type = "sine", gain = 0.15, when = 0, slideTo }: ToneOpts): void {
    const ctx = this.context();
    const out = this.out();
    if (!ctx || !out) return;

    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise({ dur, gain, freq, when = 0, band = false, q = 1 }: NoiseOpts): void {
    const ctx = this.context();
    const out = this.out();
    if (!ctx || !out) return;

    const t0 = ctx.currentTime + when;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = band ? "bandpass" : "lowpass";
    filter.frequency.value = freq;
    filter.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(t0);
  }

  /** Inharmonic partials — the bones of anything that should sound metallic. */
  private metal(partials: number[], dur: number, gain: number, when = 0): void {
    partials.forEach((freq, i) => {
      this.tone({
        freq,
        dur: dur * (1 - i * 0.12),
        type: "square",
        gain: gain * (1 - i * 0.16),
        when,
      });
    });
  }

  play(name: SoundName): void {
    if (!this.enabled) return;

    switch (name) {
      case "dice":
        this.noise({ dur: 0.09, gain: 0.22, freq: 2400 });
        this.noise({ dur: 0.07, gain: 0.18, freq: 2400, when: 0.16 });
        this.noise({ dur: 0.12, gain: 0.26, freq: 2400, when: 0.34 });
        this.noise({ dur: 0.05, gain: 0.12, freq: 2400, when: 0.55 });
        this.tone({ freq: 190, dur: 0.1, type: "triangle", gain: 0.1, when: 0.55 });
        break;

      case "step":
        this.tone({ freq: 620, dur: 0.05, type: "square", gain: 0.04 });
        break;

      /** Money in — the drawer punch, then the bell, then the drawer landing. */
      case "register":
        this.noise({ dur: 0.05, gain: 0.2, freq: 3200 });
        this.tone({ freq: 1244, dur: 0.42, type: "sine", gain: 0.13, when: 0.03 });
        this.tone({ freq: 1661, dur: 0.38, type: "sine", gain: 0.1, when: 0.045 });
        this.tone({ freq: 2489, dur: 0.26, type: "sine", gain: 0.05, when: 0.05 });
        this.noise({ dur: 0.13, gain: 0.14, freq: 420, when: 0.24 });
        this.tone({ freq: 160, dur: 0.14, type: "triangle", gain: 0.1, when: 0.25 });
        break;

      /** Money out — a heavy fall, never a bell. */
      case "pay":
        this.tone({ freq: 392, dur: 0.16, type: "triangle", gain: 0.12, slideTo: 294 });
        this.tone({ freq: 196, dur: 0.3, type: "sine", gain: 0.11, when: 0.1, slideTo: 130 });
        this.noise({ dur: 0.18, gain: 0.08, freq: 900, when: 0.02 });
        break;

      case "coin":
        this.tone({ freq: 1046, dur: 0.08, gain: 0.1 });
        this.tone({ freq: 1568, dur: 0.13, gain: 0.08, when: 0.06 });
        break;

      case "card":
        this.noise({ dur: 0.22, gain: 0.16, freq: 2600 });
        this.tone({ freq: 520, dur: 0.12, gain: 0.07, when: 0.08 });
        break;

      /** A cell door: the bolt, the clang of the bars, the echo. */
      case "jail":
        this.noise({ dur: 0.06, gain: 0.22, freq: 1600, band: true, q: 2 });
        this.metal([196, 311, 467, 659], 0.5, 0.1, 0.05);
        this.tone({ freq: 82, dur: 0.55, type: "sine", gain: 0.16, when: 0.06 });
        this.metal([196, 311, 467], 0.34, 0.05, 0.42);
        break;

      /** Stamping a title deed: the thump of the stamp, then it is yours. */
      case "buy":
        this.noise({ dur: 0.07, gain: 0.24, freq: 700 });
        this.tone({ freq: 180, dur: 0.11, type: "triangle", gain: 0.14, when: 0.01 });
        this.tone({ freq: 587, dur: 0.14, gain: 0.09, when: 0.13 });
        this.tone({ freq: 880, dur: 0.2, gain: 0.09, when: 0.2 });
        break;

      case "build":
        this.noise({ dur: 0.07, gain: 0.2, freq: 1400 });
        this.tone({ freq: 240, dur: 0.08, type: "triangle", gain: 0.12, when: 0.02 });
        this.noise({ dur: 0.07, gain: 0.16, freq: 1400, when: 0.14 });
        this.tone({ freq: 220, dur: 0.08, type: "triangle", gain: 0.1, when: 0.16 });
        break;

      case "sell":
        this.noise({ dur: 0.1, gain: 0.14, freq: 1100 });
        this.tone({ freq: 330, dur: 0.16, type: "triangle", gain: 0.1, slideTo: 220 });
        break;

      /** Paper against a desk — the property is pledged, not lost. */
      case "mortgage":
        this.noise({ dur: 0.16, gain: 0.15, freq: 1800 });
        this.tone({ freq: 147, dur: 0.22, type: "triangle", gain: 0.11, when: 0.05 });
        break;

      case "unmortgage":
        this.tone({ freq: 523, dur: 0.1, type: "triangle", gain: 0.1 });
        this.tone({ freq: 784, dur: 0.16, gain: 0.1, when: 0.08 });
        this.noise({ dur: 0.07, gain: 0.1, freq: 2600, when: 0.02 });
        break;

      /** Two knocks of the auctioneer's hammer. */
      case "gavel":
        this.noise({ dur: 0.05, gain: 0.22, freq: 900 });
        this.tone({ freq: 210, dur: 0.09, type: "triangle", gain: 0.14 });
        this.noise({ dur: 0.05, gain: 0.2, freq: 900, when: 0.15 });
        this.tone({ freq: 190, dur: 0.11, type: "triangle", gain: 0.13, when: 0.15 });
        break;

      /** Everything sliding away. */
      case "bankrupt":
        this.tone({ freq: 330, dur: 0.7, type: "sawtooth", gain: 0.1, slideTo: 82 });
        this.tone({ freq: 247, dur: 0.75, type: "triangle", gain: 0.08, when: 0.08, slideTo: 62 });
        this.noise({ dur: 0.5, gain: 0.08, freq: 500, when: 0.1 });
        break;

      case "teleport":
        this.tone({ freq: 300, dur: 0.3, type: "sine", gain: 0.1, slideTo: 1200 });
        break;

      case "win": {
        const notes = [523, 659, 784, 1046, 1318];
        notes.forEach((freq, i) => {
          this.tone({ freq, dur: 0.28, type: "triangle", gain: 0.12, when: i * 0.14 });
        });
        this.tone({ freq: 1568, dur: 0.5, type: "triangle", gain: 0.1, when: 0.75 });
        break;
      }

      default:
        break;
    }
  }
}

export const sfx = new Sfx();

/** Opens the audio context on the first gesture, then gets out of the way. */
export function installAudioUnlock(): void {
  if (typeof window === "undefined") return;

  const unlock = () => {
    sfx.unlock();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchend", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: false });
  window.addEventListener("touchend", unlock, { once: false });
  window.addEventListener("keydown", unlock, { once: false });
}
