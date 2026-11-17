// ============================================================
// NABER — procedural audio. No samples, no downloads.
// ============================================================
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.delay = null;
    this.noiseBuf = null;
    this.ready = false;
    this.muted = false;
    this.musicOn = false;
    this.intensity = 0;
    this.step = 0;
    this.nextNote = 0;
    this.pad = null;
  }

  init() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.62;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    // echo send for chimes
    this.delay = ctx.createDelay(0.8);
    this.delay.delayTime.value = 0.26;
    const fb = ctx.createGain(); fb.gain.value = 0.26;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    this.delay.connect(lp).connect(fb).connect(this.delay);
    lp.connect(wet).connect(this.master);

    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.ready = true;
    this.buildPad();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 0.62, this.ctx.currentTime, 0.05);
    }
  }

  // ---------- primitives ----------
  tone({ freq = 440, dur = 0.3, type = 'sine', gain = 0.2, slide = 0, when = 0, attack = 0.005, filter = 0, send = 0, detune = 0 }) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(this.sfxBus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.delay); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.3, gain = 0.15, when = 0, hp = 200, lp = 5000, sweep = 0, send = 0 }) {
    if (!this.ready || this.muted || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(lp, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, lp + sweep), t + dur);
    f.Q.value = 0.9;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hpf).connect(f).connect(g).connect(this.sfxBus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.delay); }
    src.start(t); src.stop(t + dur + 0.05);
  }

  // ---------- game sounds ----------
  ui() {
    this.tone({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.055, slide: 140, send: 0.15 });
  }

  attach() {
    this.noise({ dur: 0.16, gain: 0.06, hp: 700, lp: 1400, sweep: 2400, send: 0.12 });
    this.tone({ freq: 190, dur: 0.18, type: 'triangle', gain: 0.075, slide: 320 });
  }

  release() {
    this.noise({ dur: 0.28, gain: 0.075, hp: 240, lp: 5200, sweep: -3600, send: 0.1 });
    this.tone({ freq: 320, dur: 0.15, type: 'sine', gain: 0.04, slide: -120 });
  }

  pickup(step = 0) {
    const note = 64 + PENTA[step % PENTA.length];
    const f = midi(note);
    this.tone({ freq: f, dur: 0.4, type: 'triangle', gain: 0.12, send: 0.5, slide: 8 });
    this.tone({ freq: f * 2, dur: 0.25, type: 'sine', gain: 0.05, send: 0.4 });
    this.tone({ freq: f * 1.5, dur: 0.3, type: 'sine', gain: 0.03, send: 0.6, when: 0.015 });
  }

  surgePickup() {
    const chord = [0, 4, 7, 12, 16];
    chord.forEach((n, i) => this.tone({ freq: midi(64 + n), dur: 0.9, type: 'triangle', gain: 0.09, when: i * 0.045, send: 0.5 }));
    this.noise({ dur: 0.6, gain: 0.08, hp: 400, lp: 300, sweep: 6000, send: 0.3 });
  }

  hurt() {
    this.tone({ freq: 130, dur: 0.5, type: 'sawtooth', gain: 0.13, slide: -80, filter: 700 });
    this.tone({ freq: 62, dur: 0.7, type: 'sine', gain: 0.22, slide: -30 });
    this.noise({ dur: 0.4, gain: 0.16, hp: 120, lp: 900, sweep: -600 });
  }

  pop() {
    this.tone({ freq: 480, dur: 0.16, type: 'square', gain: 0.05, slide: -360, filter: 1800 });
    this.noise({ dur: 0.18, gain: 0.08, hp: 600, lp: 2400, sweep: -1400 });
  }

  waveClear() {
    [60, 64, 67, 71, 74, 79].forEach((n, i) => {
      this.tone({ freq: midi(n), dur: 0.75, type: 'triangle', gain: 0.085, when: i * 0.075, send: 0.55 });
    });
    this.noise({ dur: 0.9, gain: 0.06, hp: 700, lp: 800, sweep: 7000, send: 0.35 });
  }

  victory() {
    const seq = [60, 64, 67, 71, 74, 79, 83, 86];
    seq.forEach((n, i) => {
      this.tone({ freq: midi(n), dur: 1.4, type: 'triangle', gain: 0.09, when: i * 0.11, send: 0.6 });
      this.tone({ freq: midi(n - 12), dur: 1.2, type: 'sine', gain: 0.05, when: i * 0.11 });
    });
    [48, 55, 60, 64].forEach((n, i) => this.tone({ freq: midi(n), dur: 3.4, type: 'sawtooth', gain: 0.025, when: i * 0.02, filter: 800 }));
  }

  gameOver() {
    this.tone({ freq: 180, dur: 2.4, type: 'sawtooth', gain: 0.08, slide: -130, filter: 550 });
    this.tone({ freq: 90, dur: 2.8, type: 'sine', gain: 0.16, slide: -55 });
    this.noise({ dur: 1.6, gain: 0.09, hp: 80, lp: 1200, sweep: -1000, send: 0.3 });
  }

  warn() {
    this.tone({ freq: 880, dur: 0.09, type: 'square', gain: 0.02, send: 0.2 });
  }

  // ---------- ambient score ----------
  buildPad() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.0;
    bus.connect(this.musicBus);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.6;
    filter.connect(bus);
    const oscs = [];
    [55, 82.41, 110, 164.81].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.3 : 0.12;
      o.connect(g).connect(filter);
      o.start();
      oscs.push(o);
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.pad = { bus, filter, oscs, lfo };
    if (this.musicOn) bus.gain.setTargetAtTime(0.2, ctx.currentTime, 2.2);
  }

  startMusic() {
    if (!this.ready) return;
    this.musicOn = true;
    this.nextNote = this.ctx.currentTime + 0.4;
    if (this.pad) this.pad.bus.gain.setTargetAtTime(0.17, this.ctx.currentTime, 2.5);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.pad) this.pad.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 1.2);
  }

  duck(on) {
    if (!this.pad || !this.ready) return;
    this.pad.bus.gain.setTargetAtTime(on ? 0.03 : 0.17, this.ctx.currentTime, 0.8);
  }

  tick(intensity = 0) {
    if (!this.ready || !this.musicOn || this.ctx.state !== 'running') return;
    this.intensity += (intensity - this.intensity) * 0.04;
    if (this.pad) {
      const f = 330 + this.intensity * 520;
      this.pad.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 1.6);
    }
    const now = this.ctx.currentTime;
    const interval = 0.46 - this.intensity * 0.13;
    while (this.nextNote < now + 0.24) {
      if (this.nextNote < now) this.nextNote = now + 0.05;
      const t = this.nextNote;
      const s = this.step++;
      // sparse generative arp, rests included
      if (Math.random() < 0.62 + this.intensity * 0.16) {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
        const deg = scale[Math.floor(Math.random() * scale.length)];
        const oct = Math.random() < 0.14 ? 12 : 0;
        const freq = midi(57 + deg + oct);
        this.musicNote(freq, t, 0.3, 0.032);
      }
      if (s % 8 === 0) this.musicNote(midi(45 + (Math.random() < 0.4 ? 3 : 0)), t, 0.9, 0.028);
      this.nextNote += interval;
    }
  }

  musicNote(freq, t, dur, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 4);
    const d = ctx.createGain(); d.gain.value = 0.5;
    o.connect(g).connect(this.pad ? this.pad.filter : this.musicBus);
    if (this.pad) g.connect(d).connect(this.musicBus);
    o.start(t); o.stop(t + dur * 4 + 0.1);
  }
}
