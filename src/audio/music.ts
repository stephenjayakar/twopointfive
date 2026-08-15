// Generative score: dark drones + sub pulses at rest, glitchy synthesized breakbeats and a distorted reese bass
// as guard alertness rises. Everything is synthesized live with WebAudio nodes; a look-ahead scheduler sequences it.

import { sysRandom } from '../math/dice';   // the score's noise bed is not the simulation's dice (math/dice.ts)
export class Music {
  out: GainNode;
  intensity = 0;            // target 0..1 (0 = undetected, ~0.5 = suspicious, 1 = firefight)
  private cur = 0;
  private ctx: AudioContext;
  private bpm = 87; private step = 0; private nextT = 0; private timer: number | null = null;
  private bar = 0;
  private padGain: GainNode; private padFilter: BiquadFilterNode; private padOsc: OscillatorNode[] = [];
  private subGain: GainNode; private drumsGain: GainNode; private bassGain: GainNode; private texGain: GainNode;
  private noiseBuf: AudioBuffer; private shaper: WaveShaperNode; private bassFilter: BiquadFilterNode;
  private roots = [38, 38, 34, 41, 38, 36, 34, 33];   // D2 D2 Bb1 F2 | D2 C2 Bb1 A1 — brooding minor movement
  private chordI = 0;
  enabled = true;
  /** times the sequencer found itself more than 50 ms behind the clock and jumped to now instead of playing the backlog (W8.8 — a throttled background tab, a long
   *  main-thread stall: the old catch-up loop scheduled every missed sixteenth at once, a burst of two seconds of drums in one 25 ms tick) */
  resyncs = 0;
  private rnd: () => number;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    let s = 0x9e3779b9; this.rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    this.out = ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(dest);
    // shared noise buffer
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    { const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = sysRandom() * 2 - 1; }
    // pad: 3 detuned saws → lowpass with slow LFO → gain
    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 420; this.padFilter.Q.value = 4;
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.0;
    this.padFilter.connect(this.padGain).connect(this.out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lfoG = ctx.createGain(); lfoG.gain.value = 260; lfo.connect(lfoG).connect(this.padFilter.frequency); lfo.start();
    for (const det of [-9, 0, 7, 1200 - 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(38); o.detune.value = det; const g = ctx.createGain(); g.gain.value = det > 1000 ? 0.08 : 0.16; o.connect(g).connect(this.padFilter); o.start(); this.padOsc.push(o); }
    this.padGain.gain.setTargetAtTime(0.5, ctx.currentTime, 3);
    // buses
    this.subGain = ctx.createGain(); this.subGain.gain.value = 0.5; this.subGain.connect(this.out);
    this.drumsGain = ctx.createGain(); this.drumsGain.gain.value = 0; this.drumsGain.connect(this.out);
    this.texGain = ctx.createGain(); this.texGain.gain.value = 0.35; this.texGain.connect(this.out);
    this.shaper = ctx.createWaveShaper(); this.shaper.curve = makeDrive(5); this.shaper.oversample = '2x';
    this.bassFilter = ctx.createBiquadFilter(); this.bassFilter.type = 'lowpass'; this.bassFilter.frequency.value = 300; this.bassFilter.Q.value = 6;
    this.bassGain = ctx.createGain(); this.bassGain.gain.value = 0;
    this.shaper.connect(this.bassFilter).connect(this.bassGain).connect(this.out);
    this.nextT = ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); }
  setVolume(v: number) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); }

  private schedule() {
    const ctx = this.ctx; const spb = 60 / this.bpm / 4;   // 16th note
    // smooth intensity
    this.cur += (this.intensity - this.cur) * 0.04;
    const x = this.enabled ? this.cur : 0;
    this.drumsGain.gain.setTargetAtTime(x < 0.25 ? 0 : Math.min(1, (x - 0.25) / 0.5) * 0.9, ctx.currentTime, 0.4);
    this.bassGain.gain.setTargetAtTime(x < 0.6 ? 0 : (x - 0.6) / 0.4 * 0.42, ctx.currentTime, 0.6);
    this.padGain.gain.setTargetAtTime(this.enabled ? 0.5 - x * 0.2 : 0, ctx.currentTime, 1.5);
    this.subGain.gain.setTargetAtTime(this.enabled ? 0.45 + x * 0.25 : 0, ctx.currentTime, 0.8);
    this.texGain.gain.setTargetAtTime(this.enabled ? 0.35 : 0, ctx.currentTime, 0.8);
    // Fallen behind the clock (the timer was throttled in a background tab, or the main thread stalled): the sixteenths we missed are gone — pick the phrase up from NOW.
    // Scheduling them all "at" times already past plays every one of them this instant: the machine-gun burst of drums on coming back to the tab.
    if (this.nextT < ctx.currentTime - 0.05) { this.nextT = ctx.currentTime + 0.05; this.resyncs++; }
    while (this.nextT < ctx.currentTime + 0.12) {
      this.tick(this.step, this.nextT, spb, x);
      this.step++; if (this.step % 16 === 0) this.bar++;
      // subtle swing on odd 16ths
      this.nextT += spb * (this.step % 2 === 1 ? 1.08 : 0.92);
    }
  }

  private tick(step: number, t: number, spb: number, x: number) {
    const s16 = step % 16; const bar = this.bar;
    // chord movement every 2 bars
    if (s16 === 0 && bar % 2 === 0) {
      this.chordI = (this.chordI + 1) % this.roots.length; const root = this.roots[this.chordI];
      this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(midi(root + (i === 3 ? 19 : i === 2 ? 7 : 0)), t, 0.8));
    }
    const root = this.roots[this.chordI];
    // sub pulse: on 1 and the "and" of 3, longer when calm
    if (s16 === 0 || (s16 === 10 && this.rnd() < 0.6 + x * 0.3)) this.sub(t, midi(root - 12), x > 0.6 ? 0.35 : 0.7);
    // texture: sparse metallic / granular hits when calm, radio-ish blips
    if (this.rnd() < (s16 % 4 === 2 ? 0.1 : 0.03)) this.metal(t, 0.15 + this.rnd() * 0.2);
    if (x < 0.3 && s16 === 12 && bar % 4 === 3) this.swell(t, spb * 8);
    if (x < 0.25) return;
    // ---- breakbeat (synth kit). Two-bar phrase with probabilistic ghost notes and end-of-phrase stutters.
    const dens = Math.min(1, (x - 0.25) / 0.6);
    const kick = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0][s16] || (this.rnd() < 0.08 * dens ? 1 : 0);
    const snare = (s16 === 4 || s16 === 12) ? 1 : (this.rnd() < 0.12 * dens && s16 % 2 === 1 ? 0.35 : 0);
    const hat = s16 % 2 === 0 ? 0.5 : (this.rnd() < 0.55 * dens ? 0.28 : 0);
    if (kick) this.kick(t, kick === 1 ? 1 : 0.6);
    if (snare) this.snare(t, snare);
    if (hat) this.hat(t, hat, this.rnd() < 0.1);
    // phrase-end glitch: 1/32 or 1/48 snare rolls, reversed noise
    if (bar % 2 === 1 && s16 >= 12 && this.rnd() < 0.5 * dens) { const n = this.rnd() < 0.5 ? 2 : 3; for (let k = 1; k < n; k++) this.snare(t + (spb / n) * k, 0.3 + 0.15 * k, 1800 + 900 * k); }
    if (s16 === 15 && bar % 4 === 3 && this.rnd() < 0.7) this.reverseNoise(t + spb * 0.2, spb * 0.8);
    // reese bass line when things kick off
    if (x > 0.6 && (s16 === 0 || s16 === 3 || s16 === 8 || (s16 === 11 && this.rnd() < 0.6) || (s16 === 14 && this.rnd() < 0.4))) {
      const nn = root - 12 + [0, 0, 0, 3, -2, 5, 0, 7][Math.floor(this.rnd() * 8)];
      this.reese(t, midi(nn), spb * (s16 === 0 ? 2.8 : 1.6));
    }
  }

  // ---- voices ----
  private sub(t: number, f: number, len: number) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.02); g.gain.setTargetAtTime(0, t + 0.05, len * 0.4);
    o.connect(g).connect(this.subGain); o.start(t); o.stop(t + len + 0.5);
  }
  private kick(t: number, v: number) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.drumsGain); o.start(t); o.stop(t + 0.3);
    const c = this.noise(t, 0.012, 3000, 'highpass', 0.25 * v); void c;
  }
  private snare(t: number, v: number, tone = 1900) {
    this.noise(t, 0.14, tone, 'bandpass', 0.9 * v, 1.2);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g).connect(this.drumsGain); o.start(t); o.stop(t + 0.12);
  }
  private hat(t: number, v: number, open: boolean) { this.noise(t, open ? 0.16 : 0.035, 7800, 'highpass', 0.32 * v); }
  private metal(t: number, v: number) {
    const base = 700 + this.rnd() * 2200;
    for (const [m, a] of [[1, 1], [1.47, 0.6], [2.09, 0.4], [2.83, 0.25]] as [number, number][]) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * m;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 * v * a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.2 + this.rnd());
      const p = this.ctx.createStereoPanner(); p.pan.value = this.rnd() * 1.6 - 0.8;
      o.connect(g).connect(p).connect(this.texGain); o.start(t); o.stop(t + 2.4);
    }
  }
  private swell(t: number, len: number) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + len);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + len * 0.9); g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(f).connect(g).connect(this.texGain); src.start(t); src.stop(t + len + 0.1);
  }
  private reverseNoise(t: number, len: number) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + len); g.gain.setValueAtTime(0, t + len + 0.005);
    src.connect(f).connect(g).connect(this.drumsGain); src.start(t); src.stop(t + len + 0.05);
  }
  private reese(t: number, f: number, len: number) {
    for (const det of [-14, 14]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.detune.value = det;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.03); g.gain.setTargetAtTime(0, t + len * 0.6, len * 0.25);
      o.connect(g).connect(this.shaper); o.start(t); o.stop(t + len + 0.6);
    }
    this.bassFilter.frequency.setValueAtTime(180, t); this.bassFilter.frequency.exponentialRampToValueAtTime(900, t + len * 0.5); this.bassFilter.frequency.exponentialRampToValueAtTime(200, t + len);
  }
  private noise(t: number, len: number, freq: number, type: BiquadFilterType, v: number, q = 0.7) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.9 + this.rnd() * 0.2;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.drumsGain); src.start(t, this.rnd() * 1.5); src.stop(t + len + 0.02);
    return src;
  }
}

export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
export function makeDrive(k: number): Float32Array<ArrayBuffer> {
  const n = 1024; const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
