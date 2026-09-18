type ToneOpts = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  when?: number;
  slideTo?: number;
};

class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  private context(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone({ freq, dur, type = "sine", gain = 0.15, when = 0, slideTo }: ToneOpts): void {
    const ctx = this.context();
    if (!ctx) return;
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
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, gain: number, filterFreq: number, when = 0): void {
    const ctx = this.context();
    if (!ctx) return;
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
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
  }

  play(name: string): void {
    if (!this.enabled) return;
    switch (name) {
      case "dice":
        this.noise(0.09, 0.22, 2400, 0);
        this.noise(0.07, 0.18, 2400, 0.16);
        this.noise(0.12, 0.26, 2400, 0.34);
        this.noise(0.05, 0.12, 2400, 0.55);
        this.tone({ freq: 190, dur: 0.1, type: "triangle", gain: 0.1, when: 0.55 });
        break;
      case "step":
        this.tone({ freq: 640, dur: 0.06, type: "square", gain: 0.05 });
        break;
      case "coin":
        this.tone({ freq: 880, dur: 0.09, gain: 0.12 });
        this.tone({ freq: 1318, dur: 0.14, gain: 0.1, when: 0.07 });
        break;
      case "cash":
        for (let i = 0; i < 5; i++) {
          this.tone({ freq: 880 + i * 40, dur: 0.07, gain: 0.09, when: i * 0.055 });
        }
        this.tone({ freq: 1760, dur: 0.16, gain: 0.1, when: 0.28 });
        break;
      case "pay":
        this.tone({ freq: 220, dur: 0.18, type: "sawtooth", gain: 0.09, slideTo: 130 });
        break;
      case "card":
        this.noise(0.22, 0.16, 2600, 0);
        this.tone({ freq: 520, dur: 0.12, gain: 0.07, when: 0.08 });
        break;
      case "jail":
        this.tone({ freq: 110, dur: 0.3, type: "square", gain: 0.14 });
        this.noise(0.25, 0.2, 900, 0.05);
        this.tone({ freq: 90, dur: 0.28, type: "square", gain: 0.12, when: 0.22 });
        break;
      case "buy":
        this.tone({ freq: 330, dur: 0.12, type: "triangle", gain: 0.13 });
        this.tone({ freq: 660, dur: 0.14, gain: 0.1, when: 0.09 });
        this.tone({ freq: 990, dur: 0.16, gain: 0.09, when: 0.18 });
        break;
      case "build":
        this.noise(0.08, 0.2, 1400, 0);
        this.tone({ freq: 240, dur: 0.08, type: "triangle", gain: 0.12, when: 0.02 });
        this.noise(0.08, 0.16, 1400, 0.14);
        break;
      case "buzzer":
        this.tone({ freq: 140, dur: 0.24, type: "sawtooth", gain: 0.12 });
        break;
      case "teleport":
        this.tone({ freq: 300, dur: 0.3, type: "sine", gain: 0.1, slideTo: 1200 });
        break;
      case "win": {
        const notes = [523, 659, 784, 1046, 1318];
        notes.forEach((f, i) => {
          this.tone({ freq: f, dur: 0.28, type: "triangle", gain: 0.12, when: i * 0.14 });
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
