// ---------------------------------------------------------------------------
// All sound is synthesised in the browser with the Web Audio API — no .mp3s.
// A detuned saw "engine" tracks RPM, filtered noise makes tyre scrub, and a
// small arpeggiator plays the synthwave soundtrack.
// ---------------------------------------------------------------------------
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.beat = 0;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 4;
    this.comp.connect(this.master);

    // noise buffer first — engine + tyres + drums all read from it
    this._buildNoiseBuffer();

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.comp);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.comp);

    this._buildEngine();
    this._buildTyres();

    this.nextNoteTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.scheduler = setInterval(() => this._scheduleMusic(), 60);

    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _buildNoiseBuffer() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  _buildEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 6;
    this.engineGain.connect(this.engineFilter);
    this.engineFilter.connect(this.sfxGain);

    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscA.frequency.value = 60;
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'square';
    this.oscB.frequency.value = 90;
    this.oscB.detune.value = 7;

    const gainB = ctx.createGain();
    gainB.gain.value = 0.32;
    this.oscA.connect(this.engineGain);
    this.oscB.connect(gainB);
    gainB.connect(this.engineGain);

    this.oscA.start();
    this.oscB.start();
  }

  _buildTyres() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer || ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 1.4;
    this.tyreGain = ctx.createGain();
    this.tyreGain.gain.value = 0;
    src.connect(bp);
    bp.connect(this.tyreGain);
    this.tyreGain.connect(this.sfxGain);
    src.start();
    this.tyreFilter = bp;
  }

  // RPM-ish engine tone
  updateEngine({ speedKmh, throttle, drifting, boost }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const norm = Math.min(speedKmh / 240, 1);
    const gear = Math.min(4, Math.floor(norm * 5));
    const inGear = norm * 5 - gear; // 0..1 within gear
    const rpm = 0.22 + inGear * 0.78;
    const base = 48 + rpm * 118 + gear * 6;

    this.oscA.frequency.setTargetAtTime(base, t, 0.08);
    this.oscB.frequency.setTargetAtTime(base * 1.51, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(
      380 + rpm * 1900 + (throttle ? 700 : 0) + (boost ? 900 : 0),
      t,
      0.12
    );
    this.engineGain.gain.setTargetAtTime(0.055 + (throttle ? 0.075 : 0.02) + norm * 0.05, t, 0.12);

    this.tyreGain.gain.setTargetAtTime(drifting ? 0.16 : 0.0, t, 0.08);
    this.tyreFilter.frequency.setTargetAtTime(1200 + norm * 1800, t, 0.1);
  }

  _scheduleMusic() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const lookahead = 0.25;
    // 110 BPM, 16th notes
    const spb = 60 / 112 / 4;
    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      this._playStep(this.step, this.nextNoteTime, spb);
      this.step = (this.step + 1) % 32;
      this.nextNoteTime += spb;
    }
  }

  _playStep(step, time, spb) {
    const ctx = this.ctx;
    // A minor synthwave: Am - F - C - G
    const prog = [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
    ];
    const bar = Math.floor(step / 8) % 4;
    const chord = prog[bar];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    // kick on every 4th step
    if (step % 8 === 0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(46, time + 0.16);
      g.gain.setValueAtTime(0.9, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.3);
    }
    // snare / clap on the backbeat
    if (step % 8 === 4) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const g = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1400;
      g.gain.setValueAtTime(0.32, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.musicGain);
      src.start(time);
      src.stop(time + 0.2);
    }
    // hats on odd 8ths
    if (step % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const g = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      g.gain.setValueAtTime(0.07, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.musicGain);
      src.start(time);
      src.stop(time + 0.06);
    }
    // bass on 8ths
    if (step % 2 === 0) {
      const note = chord[0] - 24;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = mtof(note);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(420, time);
      f.frequency.exponentialRampToValueAtTime(160, time + spb * 2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.26, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + spb * 1.9);
      osc.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + spb * 2);
    }
    // arp lead
    const arpPattern = [0, 1, 2, 1, 2, 0, 1, 2];
    const n = chord[arpPattern[step % 8]] + 12;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = mtof(n);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.1, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + spb * 1.4);
    const dly = ctx.createDelay();
    dly.delayTime.value = spb * 2;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    osc.connect(g);
    g.connect(this.musicGain);
    g.connect(dly);
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + spb * 2);
  }

  pickup(pitch = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [0, 7, 12].forEach((semi, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 660 * Math.pow(2, (semi + pitch) / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * 0.055 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.055 + 0.26);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.3);
    });
  }

  crash(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.42);

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.32 * intensity, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(og);
    og.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.34);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}
