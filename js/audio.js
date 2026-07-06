// TAP THE MAPLE — procedural Web Audio sound effects. No external assets.

const LS_MUTE = 'ttm-muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem(LS_MUTE) === '1';
    this._noiseBuf = null;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(LS_MUTE, m ? '1' : '0');
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.value = m ? 0 : 0.9;
    }
  }

  get t() { return this.ctx.currentTime; }

  _noise(dur, { type = 'lowpass', freq = 1000, q = 1, gain = 0.5, sweepTo = null, attack = 0.002, delay = 0 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const start = this.t + delay;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, start); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(start, Math.random());
    src.stop(start + dur + 0.05);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.3, slideTo = null, attack = 0.003, delay = 0 } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    const start = this.t + delay;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  ready() { return !!this.ctx && !this.muted; }

  // Spile leaves your hand: short air whoosh
  whoosh() {
    if (!this.ready()) return;
    this._noise(0.12, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.22, sweepTo: 3200, attack: 0.01 });
  }

  // Spile bites the log: deep THUNK + wood knock
  thunk() {
    if (!this.ready()) return;
    const v = 0.92 + Math.random() * 0.16;
    this._tone(105 * v, 0.1, { type: 'sine', gain: 0.55, slideTo: 42 });
    this._noise(0.06, { type: 'lowpass', freq: 900 * v, gain: 0.4 });
    this._noise(0.03, { type: 'bandpass', freq: 2400 * v, q: 1.4, gain: 0.14 });
  }

  // Metal-on-metal fail: harsh clink + wobble
  clink() {
    if (!this.ready()) return;
    for (const f of [2793, 3520, 4186]) {
      this._tone(f * (0.98 + Math.random() * 0.04), 0.22, { type: 'square', gain: 0.07, attack: 0.001 });
    }
    this._noise(0.1, { type: 'highpass', freq: 3800, gain: 0.22, attack: 0.001 });
    this._tone(160, 0.4, { type: 'sawtooth', gain: 0.22, slideTo: 55, delay: 0.05 });
  }

  // Sap drop caught: bucket ding
  ding() {
    if (!this.ready()) return;
    this._tone(1567.98, 0.4, { type: 'sine', gain: 0.16, attack: 0.001 });
    this._tone(2093, 0.28, { type: 'sine', gain: 0.09, delay: 0.03, attack: 0.001 });
    this._tone(1567.98 * 2.76, 0.15, { type: 'sine', gain: 0.04, attack: 0.001 });
  }

  // Level cleared: log splits open
  crack() {
    if (!this.ready()) return;
    this._noise(0.09, { type: 'lowpass', freq: 1400, gain: 0.5, attack: 0.001 });
    this._noise(0.25, { type: 'bandpass', freq: 500, q: 1, gain: 0.3, sweepTo: 150, delay: 0.04 });
    this._tone(70, 0.3, { type: 'sine', gain: 0.4, slideTo: 35 });
    // little victory chirp
    [660, 880].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', gain: 0.1, delay: 0.12 + i * 0.08 }));
  }

  // Boss log incoming: low ominous horn
  boss() {
    if (!this.ready()) return;
    this._tone(98, 0.7, { type: 'sawtooth', gain: 0.18 });
    this._tone(147, 0.7, { type: 'sawtooth', gain: 0.12, delay: 0.05 });
    this._noise(0.7, { type: 'lowpass', freq: 300, gain: 0.14, attack: 0.1 });
  }

  // Boss beaten: maple fanfare
  fanfare() {
    if (!this.ready()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this._tone(f, 0.3, { type: 'triangle', gain: 0.13, delay: i * 0.09 }));
  }

  // Run over: sad wilt
  gameover() {
    if (!this.ready()) return;
    this._tone(220, 0.5, { type: 'sawtooth', gain: 0.14, slideTo: 110, delay: 0.15 });
    this._tone(224, 0.5, { type: 'sawtooth', gain: 0.14, slideTo: 108, delay: 0.15 });
  }

  // UI blip
  click() {
    if (!this.ready()) return;
    this._tone(660, 0.07, { type: 'square', gain: 0.07, slideTo: 940 });
  }
}

export const sound = new SoundEngine();
