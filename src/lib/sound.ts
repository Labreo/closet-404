'use client';

/**
 * Zero-asset foley built from the Web Audio API: shelf ticks, a case sliding out,
 * and a low room tone with candle crackle. Starts only after a user gesture.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambience: AudioNode[] = [];
  private lastTick = 0;
  muted = false;

  start(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.startAmbience();
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  private noiseBurst(duration: number, freq: number, q: number, gain: number, when = 0): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration + 0.02);
  }

  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine', when = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Plastic tick when the flashlight sweeps across a spine. */
  tick(): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastTick < 45) return;
    this.lastTick = now;
    this.noiseBurst(0.02, 3200, 2.5, 0.12);
    this.tone(820, 0.03, 0.03, 'triangle');
  }

  /** Case dragged off the shelf. */
  pull(): void {
    this.noiseBurst(0.22, 900, 0.8, 0.12);
    this.noiseBurst(0.05, 2400, 3, 0.15, 0.2);
    this.tone(180, 0.12, 0.06, 'triangle', 0.2);
  }

  /** Case slotted back. */
  putBack(): void {
    this.noiseBurst(0.16, 1100, 0.8, 0.1);
    this.noiseBurst(0.04, 1600, 3, 0.2, 0.15);
    this.tone(140, 0.1, 0.08, 'triangle', 0.15);
  }

  /** Soft chime when search lights up matching spines. */
  chime(): void {
    [0, 0.09, 0.18].forEach((when, i) => this.tone([660, 880, 1320][i], 0.9, 0.035, 'sine', when));
  }

  private startAmbience(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const ctx = this.ctx;
    // Room tone: very low filtered noise.
    const room = ctx.createBufferSource();
    room.buffer = this.noise;
    room.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 180;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.05;
    room.connect(low).connect(roomGain).connect(this.master);
    room.start();
    // Mains hum from the old CRT in the corner.
    const hum = ctx.createOscillator();
    hum.frequency.value = 60;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.006;
    hum.connect(humGain).connect(this.master);
    hum.start();
    this.ambience.push(room, hum);
    this.scheduleCrackle();
  }

  private scheduleCrackle(): void {
    if (!this.ctx) return;
    window.setTimeout(() => {
      if (!this.muted) this.noiseBurst(0.012 + Math.random() * 0.02, 4000 + Math.random() * 3000, 4, 0.02 + Math.random() * 0.03);
      this.scheduleCrackle();
    }, 120 + Math.random() * 900);
  }
}

export const sound = new SoundEngine();
