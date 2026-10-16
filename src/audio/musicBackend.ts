// MusicBackend — the seam under the score (src/audio/music.ts keeps the SEQUENCING: bars, chords, the intensity mapping, which voice when; a backend owns the VOICES). Shaped like
// backend.ts's AudioBackend split: `WebAudioMusicBackend` below is today's node graph, node for node (the pad's four detuned saws → the LFO'd lowpass → its gain, the sub / drums /
// bass / texture buses, the noise buffer, the reese's waveshaper → lowpass, and one-shot voices built per note exactly as music.ts built them); a second backend
// (a native host's synth, since removed) took the same events — the structure is exact because the sequencer is the same class. Every random number a voice takes (a noise's playback rate / start offset, a
// metal hit's base pitch / partial decays / pans) is DRAWN BY THE SEQUENCER and passed in, so the page's rnd stream — and every note it decides — is byte for byte what it was.
import { sysRandom } from '../math/dice';
import type { Struck, Tuned } from './acoustic';
import { STRUCK, struckAt, tunedAt } from './acoustic';

/** the per-bus levels the sequencer eases every tick (the page: setTargetAtTime with these time constants; the native: one-pole eases in the render callback) */
export interface MusicLevels { drums: number; drumsTc: number; bass: number; bassTc: number; pad: number; padTc: number; sub: number; subTc: number; tex: number; texTc: number; }
/** a metal hit's four partials: the base pitch, and per partial the decay (s) and the pan −1‥1 the sequencer drew */
export interface MetalHit { base: number; decays: [number, number, number, number]; pans: [number, number, number, number]; }
/** the noise voice's per-note dice: playback rate (0.9‥1.1) and start offset (s) into the shared 2-s noise buffer */
export interface NoiseDice { rate: number; offset: number; }

export interface MusicBackend {
  /** the backend's clock (s): the page's AudioContext.currentTime, the native's render clock — every note is stamped against it */
  now(): number;
  setLevels(l: MusicLevels): void;
  /** the score's master (setVolume: tc 0.2; stop: to 0 over 0.3) */
  setMaster(v: number, tc: number): void;
  /** the pad's four oscillators glide to these frequencies from t over tc (the chord change) */
  padChord(t: number, freqs: [number, number, number, number], tc: number): void;
  sub(t: number, f: number, len: number): void;
  kick(t: number, v: number, click: NoiseDice): void;
  snare(t: number, v: number, tone: number, noise: NoiseDice): void;
  hat(t: number, v: number, open: boolean, noise: NoiseDice): void;
  metal(t: number, v: number, hit: MetalHit): void;
  swell(t: number, len: number): void;
  reverseNoise(t: number, len: number): void;
  reese(t: number, f: number, len: number): void;
  /** the backend let go of (the page: the master ramps to 0; the native: the synth silenced) */
  stop(): void;
}

/** the tuned voices the newer pieces play: three electric ones made here (two-operator FM: a vibraphone, an electric piano, a struck bell) and the acoustic ones
 *  of acoustic.ts (strings plucked and hammered, bars, a kettledrum) */
export type KeyKind = 'vibes' | 'rhodes' | 'bell' | Exclude<Tuned, 'bass'>;
/** the drums, cymbals and things shaken (acoustic.ts STRUCK) */
export type PercKind = Struck;
/** what is blown: a flute, a clarinet down in its dark register, a trumpet with a mute in its bell, a horn */
export type WindKind = 'flute' | 'clarinet' | 'trumpet' | 'horn';
/** how the string section plays a chord: bowed, bowed in a shiver (tremolo), or one short stroke */
export type BowKind = 'bow' | 'trem' | 'short';
/** THE VOICES OF THE NEWER PIECES (pieces.ts), beside the theme's above: an upright bass, keys and mallets, plucked strings, a bowed section, winds, a drum kit and hand
 *  drums, and the room they sit in (a generated reverb and a tempo echo). What is struck, plucked or shaken is a physical model rendered once into a buffer (acoustic.ts);
 *  what is bowed or blown is built live. A backend offers all of them or none: one without them plays the theme alone (music.ts asks `pluck` before it deals a piece).
 *  Like the theme's voices, every random number one takes is drawn by the sequencer and handed over. */
export interface PieceVoices {
  /** an upright bass note, plucked: `len` is when the finger damps it; `from` (Hz) the pitch the finger slides into the note from (0 or absent = plucked clean) */
  pluck(t: number, f: number, len: number, v: number, from?: number): void;
  /** `len`: the electric kinds die away over it; the acoustic ones ring as they ring and are damped at its end */
  keys(t: number, f: number, len: number, v: number, pan: number, kind: KeyKind): void;
  /** the string section on all of `freqs`: `attack` seconds of bow coming on (a swell), or a stroke of milliseconds */
  strings(t: number, freqs: number[], len: number, v: number, attack: number, how: BowKind): void;
  wind(t: number, f: number, len: number, v: number, kind: WindKind, breath: NoiseDice): void;
  perc(t: number, kind: PercKind, v: number, noise: NoiseDice): void;
  /** soft mallets rolled on a hung cymbal from `t`, breaking at t + len and left to ring */
  cymbalRoll(t: number, len: number, v: number): void;
  /** the pad's colour for a piece: its lowpass's centre and resonance (the theme's: 420 Hz, Q 4) */
  padTone(cutoff: number, q: number): void;
  /** the echo's time (s) for a piece's tempo */
  echo(time: number): void;
  /** the newer voices' own level beside the theme's buses (0 = let go of: the score switched off) */
  setMore(v: number, tc: number): void;
  /** these notes of `kind` will be asked for soon, several at once: make them ahead, a few at a time */
  warmTuned(kind: KeyKind, freqs: readonly number[]): void;
}

/** each hit of the kit in the mix: its level, where it sits across the room, how dull the softest stroke of it is (Hz), and how many takes of it there are */
const KIT: Record<Struck, readonly [gain: number, pan: number, dark: number, takes: number]> = {
  kick: [1, 0, 900, 2], snare: [0.8, 0.05, 1800, 3], rim: [0.5, 0.1, 3000, 2], tomLo: [0.85, 0.3, 700, 2], tomHi: [0.8, -0.2, 900, 2], hat: [0.4, -0.3, 5000, 3], hatOpen: [0.4, -0.3, 5000, 2],
  ride: [0.4, 0.35, 4000, 2], rideBell: [0.4, 0.35, 3000, 1], crash: [0.45, -0.15, 4000, 1], roll: [0.45, 0, 8000, 1], brush: [0.5, 0.05, 3000, 3], brushTap: [0.5, 0.05, 3000, 3],
  taiko: [1, 0, 500, 2], congaLo: [0.7, -0.25, 1200, 3], congaHi: [0.65, 0.25, 1500, 3], tabla: [0.8, 0.1, 800, 2], frame: [0.9, -0.1, 700, 3], wood: [0.4, 0.4, 3000, 2],
  shaker: [0.3, 0.45, 6000, 3], tamb: [0.3, -0.45, 6000, 2], gong: [0.7, 0, 1500, 1],
};
/** each plucked or struck tuned voice in the mix: its level, how dull its softest note is (Hz), and whether it stays out of the echo (it sits with the strings) */
const TUNED_MIX: Record<Exclude<Tuned, 'bass'>, readonly [gain: number, dark: number, dry: boolean]> = {
  koto: [0.8, 2600, false], harp: [0.8, 1800, false], guitar: [0.8, 1600, false], dulcimer: [0.7, 2200, false], piano: [0.9, 1100, false], pizz: [0.9, 1500, true],
  marimba: [0.8, 1500, false], kalimba: [0.7, 2000, false], celesta: [0.55, 2500, false], timp: [1, 600, true],
};
/** what is blown: its oscillators [shape, harmonic, weight, cents], how far under the note it starts, its attack and release, its vibrato (cents, Hz), its breath (weight,
 *  and where over the note it hisses) */
const WINDS: Record<WindKind, { osc: readonly (readonly [OscillatorType, number, number, number])[]; from: number; atk: number; rel: number; vib: number; vibHz: number; air: number; airAt: number }> = {
  flute: { osc: [['sine', 1, 0.8, 0], ['sine', 2.002, 0.14, 0], ['triangle', 3, 0.04, 0]], from: 0.93, atk: 0.09, rel: 0.16, vib: 14, vibHz: 5.3, air: 0.3, airAt: 2.1 },
  clarinet: { osc: [['square', 1, 0.5, 0], ['sine', 1, 0.5, 0], ['sine', 3, 0.1, 0]], from: 0.985, atk: 0.07, rel: 0.11, vib: 4, vibHz: 4.8, air: 0.07, airAt: 3 },
  trumpet: { osc: [['sawtooth', 1, 0.9, 0]], from: 0.97, atk: 0.04, rel: 0.09, vib: 16, vibHz: 5.6, air: 0.05, airAt: 4 },
  horn: { osc: [['sawtooth', 1, 0.5, -5], ['sawtooth', 1, 0.5, 4]], from: 0.99, atk: 0.07, rel: 0.25, vib: 3, vibHz: 4.5, air: 0.02, airAt: 2 },
};

export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
export function makeDrive(k: number): Float32Array<ArrayBuffer> {
  const n = 1024; const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}

/** the page's score voices: the Web Audio node graph music.ts built before the split, node for node */
export class WebAudioMusicBackend implements MusicBackend, PieceVoices {
  out: GainNode;
  private ctx: BaseAudioContext;
  private padGain: GainNode; private padFilter: BiquadFilterNode; private padOsc: OscillatorNode[] = [];
  private subGain: GainNode; private drumsGain: GainNode; private bassGain: GainNode; private texGain: GainNode;
  private noiseBuf: AudioBuffer; private shaper: WaveShaperNode; private bassFilter: BiquadFilterNode;
  constructor(ctx: BaseAudioContext, dest: AudioNode) {   // (an OfflineAudioContext too: the listening page measures a piece's levels by rendering it — src/music/main.ts)
    this.ctx = ctx;
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
  }
  now() { return this.ctx.currentTime; }
  stop() { this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); }
  setMaster(v: number, tc: number) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, tc); }
  setLevels(l: MusicLevels) {
    const now = this.ctx.currentTime;
    this.drumsGain.gain.setTargetAtTime(l.drums, now, l.drumsTc);
    this.bassGain.gain.setTargetAtTime(l.bass, now, l.bassTc);
    this.padGain.gain.setTargetAtTime(l.pad, now, l.padTc);
    this.subGain.gain.setTargetAtTime(l.sub, now, l.subTc);
    this.texGain.gain.setTargetAtTime(l.tex, now, l.texTc);
  }
  padChord(t: number, freqs: [number, number, number, number], tc: number) { this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(freqs[i], t, tc)); }

  // ---- voices ----
  sub(t: number, f: number, len: number) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.02); g.gain.setTargetAtTime(0, t + 0.05, len * 0.4);
    o.connect(g).connect(this.subGain); o.start(t); o.stop(t + len + 0.5);
  }
  kick(t: number, v: number, click: NoiseDice) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.drumsGain); o.start(t); o.stop(t + 0.3);
    const c = this.noise(t, 0.012, 3000, 'highpass', 0.25 * v, 0.7, click); void c;
  }
  snare(t: number, v: number, tone: number, noise: NoiseDice) {
    this.noise(t, 0.14, tone, 'bandpass', 0.9 * v, 1.2, noise);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g).connect(this.drumsGain); o.start(t); o.stop(t + 0.12);
  }
  hat(t: number, v: number, open: boolean, noise: NoiseDice) { this.noise(t, open ? 0.16 : 0.035, 7800, 'highpass', 0.32 * v, 0.7, noise); }
  metal(t: number, v: number, hit: MetalHit) {
    const base = hit.base;
    ([[1, 1], [1.47, 0.6], [2.09, 0.4], [2.83, 0.25]] as [number, number][]).forEach(([m, a], k) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * m;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 * v * a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + hit.decays[k]);
      const p = this.ctx.createStereoPanner(); p.pan.value = hit.pans[k];
      o.connect(g).connect(p).connect(this.texGain); o.start(t); o.stop(t + 2.4);
    });
  }
  swell(t: number, len: number) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + len);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + len * 0.9); g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(f).connect(g).connect(this.texGain); src.start(t); src.stop(t + len + 0.1);
  }
  reverseNoise(t: number, len: number) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + len); g.gain.setValueAtTime(0, t + len + 0.005);
    src.connect(f).connect(g).connect(this.drumsGain); src.start(t); src.stop(t + len + 0.05);
  }
  reese(t: number, f: number, len: number) {
    for (const det of [-14, 14]) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.detune.value = det;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.03); g.gain.setTargetAtTime(0, t + len * 0.6, len * 0.25);
      o.connect(g).connect(this.shaper); o.start(t); o.stop(t + len + 0.6);
    }
    this.bassFilter.frequency.setValueAtTime(180, t); this.bassFilter.frequency.exponentialRampToValueAtTime(900, t + len * 0.5); this.bassFilter.frequency.exponentialRampToValueAtTime(200, t + len);
  }
  // ---- the newer pieces' voices (PieceVoices). Their buses, the room and the echo are built on the first note one of them plays: a score that never deals a piece
  //      (the pieces switch off) has the node graph it always had ----
  private sp: { bus: GainNode; keys: GainNode; perc: GainNode; pluck: GainNode; strings: GainNode; delay: DelayNode } | null = null;
  private space() {
    if (this.sp) return this.sp;
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(this.out);
    // the room: under two seconds of noise dying away and darkening as it dies, a short gap in front of it, nothing under 140 Hz let in
    const n = Math.floor(ctx.sampleRate * 1.7), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const u = i / ctx.sampleRate; lp += (sysRandom() * 2 - 1 - lp) * (0.75 - 0.6 * Math.min(1, u / 1.0)); d[i] = lp * Math.exp(-u / 0.35); } }
    const room = ctx.createConvolver(); room.buffer = ir; const gap = ctx.createDelay(0.1); gap.delayTime.value = 0.018; const roomOut = ctx.createGain(); roomOut.gain.value = 0.8;
    const thin = ctx.createBiquadFilter(); thin.type = 'highpass'; thin.frequency.value = 140;
    gap.connect(thin).connect(room).connect(roomOut).connect(bus);
    // the echo: one tap fed back through a lowpass, each repeat duller than the last
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.4; const dull = ctx.createBiquadFilter(); dull.type = 'lowpass'; dull.frequency.value = 2600;
    const back = ctx.createGain(); back.gain.value = 0.5; const echoOut = ctx.createGain(); echoOut.gain.value = 0.55;
    delay.connect(dull); dull.connect(back).connect(delay); dull.connect(echoOut).connect(bus); { const g = ctx.createGain(); g.gain.value = 0.25; dull.connect(g).connect(gap); }
    const mk = (level: number, toRoom: number, toEcho: number) => {
      const b = ctx.createGain(); b.gain.value = level; b.connect(bus);
      if (toRoom) { const g = ctx.createGain(); g.gain.value = toRoom; b.connect(g).connect(gap); }
      if (toEcho) { const g = ctx.createGain(); g.gain.value = toEcho; b.connect(g).connect(delay); }
      return b;
    };
    this.warm();
    return this.sp = { bus, keys: mk(0.5, 0.4, 0.4), perc: mk(0.6, 0.24, 0), pluck: mk(0.75, 0.08, 0), strings: mk(0.45, 0.5, 0), delay };
  }
  setMore(v: number, tc: number) { if (this.sp) this.sp.bus.gain.setTargetAtTime(v, this.ctx.currentTime, tc); }
  padTone(cutoff: number, q: number) { const now = this.ctx.currentTime; this.padFilter.frequency.setTargetAtTime(cutoff, now, 1.5); this.padFilter.Q.setTargetAtTime(q, now, 1.5); }
  echo(time: number) { this.space().delay.delayTime.setTargetAtTime(Math.min(1.9, time), this.ctx.currentTime, 0.05); }
  // ---- what is struck, plucked or shaken: a buffer made once (acoustic.ts), played through a lowpass that opens with how hard it was hit ----
  private bufs = new Map<Float32Array, AudioBuffer>();
  private buf(m: { data: Float32Array; rate: number }) {
    let b = this.bufs.get(m.data);
    if (!b) { b = this.ctx.createBuffer(1, m.data.length, m.rate); b.copyToChannel(m.data as Float32Array<ArrayBuffer>, 0); this.bufs.set(m.data, b); }
    return b;
  }
  /** `bright` (0‥1): how hard it was hit — what opens the lowpass, whatever its level in the mix. `damp`: the time a hand stops it (it rings out by itself when absent) */
  private hitTo(dest: AudioNode, t: number, m: { data: Float32Array; rate: number }, v: number, bright: number, dark: number, pan: number, rate = 1, damp = 0, from = 0) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.buf(m); src.playbackRate.value = rate;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = dark + (19000 - dark) * Math.pow(Math.min(1, Math.max(0, bright)), 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); if (damp > t) g.gain.setTargetAtTime(0, damp, 0.05);
    let out: AudioNode = g; if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    src.connect(lp).connect(g); out.connect(dest); src.start(t, from); if (damp > t) src.stop(damp + 0.4);
    return { g, lp, src };
  }
  /** every hit of the kit made a few at a time while nothing else is going on, so that the first bar of a piece does not make them all in one step */
  private warm() {
    if (typeof setTimeout !== 'function') return;
    const todo: [Struck, number][] = []; for (const k of STRUCK) for (let take = 0; take < KIT[k][3]; take++) todo.push([k, take]);
    const step = () => { const n = todo.shift(); if (!n) return; struckAt(this.ctx.sampleRate, n[0], n[1]); setTimeout(step, 12); };
    setTimeout(step, 40);
  }
  private toMake: [Tuned, number][] = []; private making = false;
  warmTuned(kind: KeyKind, freqs: readonly number[]) {
    if (kind === 'vibes' || kind === 'rhodes' || kind === 'bell' || typeof setTimeout !== 'function') return;
    for (const f of freqs) this.toMake.push([kind, f]);
    if (this.making) return; this.making = true;
    const step = () => { const n = this.toMake.shift(); if (!n) { this.making = false; return; } tunedAt(this.ctx.sampleRate, n[0], n[1]); setTimeout(step, 30); };
    setTimeout(step, 200);
  }
  private lastPluck: GainNode | null = null;
  pluck(t: number, f: number, len: number, v: number, from = 0) {
    const m = tunedAt(this.ctx.sampleRate, 'bass', f);
    this.lastPluck?.gain.setTargetAtTime(0, t, 0.03);   // (one string, one finger: the note before stops as this one starts)
    const { g, lp, src } = this.hitTo(this.space().pluck, t, m, v * 1.5, 1, 420, 0, f / m.f, t + len);
    if (from > 0) { src.playbackRate.setValueAtTime(from / m.f, t); src.playbackRate.exponentialRampToValueAtTime(f / m.f, t + 0.07); }   // (the slide: the string is already sounding as the finger arrives)
    lp.Q.value = 1; lp.frequency.setValueAtTime(Math.min(2400, 700 + f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(280, f * 4), t + 0.3);   // (gut: the snap of the pluck, then the wood of the thing)
    this.lastPluck = g;
  }
  keys(t: number, f: number, len: number, v: number, pan: number, kind: KeyKind) {
    const ctx = this.ctx, s = this.space();
    if (kind !== 'vibes' && kind !== 'rhodes' && kind !== 'bell') {
      const m = tunedAt(ctx.sampleRate, kind, f), [gain, dark, dry] = TUNED_MIX[kind];
      this.hitTo(dry ? s.strings : s.keys, t, m, Math.min(1, v * 2) * gain, Math.min(1, v * 2), dark, pan, f / m.f, t + len); return;
    }
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(s.keys);
    const g = ctx.createGain(); g.connect(p);
    // two-operator FM: the modulator's depth falls away after the strike (the hammer's brightness), the carrier rings on
    const K = kind === 'vibes' ? { ratio: 4, i0: 1.1, i1: 0.03, it: 0.12, atk: 0.003, trem: 0.22 } : kind === 'rhodes' ? { ratio: 1, i0: 1.9, i1: 0.25, it: 0.35, atk: 0.004, trem: 0 } : { ratio: 3.51, i0: 1.4, i1: 0.08, it: 0.7, atk: 0.002, trem: 0 };
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * K.ratio;
    const idx = ctx.createGain(); idx.gain.setValueAtTime(K.i0 * f * K.ratio * (0.5 + 0.5 * Math.min(1, v * 2)), t); idx.gain.exponentialRampToValueAtTime(K.i1 * f * K.ratio, t + K.it);
    mod.connect(idx).connect(car.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + K.atk); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    if (K.trem) {   // (the vibraphone's motor)
      const tr = ctx.createGain(); tr.gain.value = 1 - K.trem; const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6; const d = ctx.createGain(); d.gain.value = K.trem;
      lfo.connect(d).connect(tr.gain); car.connect(tr).connect(g); lfo.start(t); lfo.stop(t + len + 0.05);
    } else car.connect(g);
    car.start(t); mod.start(t); car.stop(t + len + 0.05); mod.stop(t + len + 0.05);
  }
  /** a loop of the shared noise through a bandpass, for a bow's hair or a player's breath: its gain node, to be shaped by the caller */
  private hiss(t: number, end: number, hz: number, q: number, dest: AudioNode, from = (t * 7.31) % 1.5): GainNode {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(dest); src.start(t, from); src.stop(end);
    return g;
  }
  private peak(hz: number, q: number, db: number) { const f = this.ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = hz; f.Q.value = q; f.gain.value = db; return f; }
  strings(t: number, freqs: number[], len: number, v: number, attack: number, how: BowKind) {
    const ctx = this.ctx, s = this.space(), short = how === 'short', rel = short ? 0.09 : 0.4, hold = Math.max(attack, len), end = t + hold + rel * 6;
    // the bow: saws that open as it bites, then the box they sit on (its air, its wood, the hill of the bridge)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(short ? 3800 : how === 'trem' ? 3400 : 2600, t + attack); lp.frequency.setTargetAtTime(short ? 900 : 1300, t + attack, Math.max(0.05, len * 0.5));
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.setTargetAtTime(0, t + hold, rel);
    const body = this.peak(290, 1.6, 4), wood = this.peak(520, 2, 2.5), hill = this.peak(2800, 1.2, 5);
    lp.connect(body).connect(wood).connect(hill).connect(g);
    let vib: GainNode | null = null;
    if (len > 0.8 && how === 'bow') { const lfo = ctx.createOscillator(); lfo.frequency.value = 5.1 + (freqs[0] % 7) * 0.1; vib = ctx.createGain(); vib.gain.setValueAtTime(0, t); vib.gain.linearRampToValueAtTime(10, t + Math.min(len, attack + 0.9)); lfo.connect(vib); lfo.start(t); lfo.stop(end); }
    const trem = how === 'trem';
    freqs.forEach((f, k) => {
      // the shiver: every desk at its own speed (no two notes of the chord pulse together), each stroke brightening as it bites
      let into: AudioNode = lp;
      if (trem) { const tr = ctx.createGain(); tr.gain.value = 0.58; tr.connect(lp); into = tr;
        for (const hz of [11.2 + 1.3 * k, 13.1 + 0.9 * k]) { const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = hz; const d = ctx.createGain(); d.gain.value = 0.21; lfo.connect(d).connect(tr.gain);
          if (!k) { const b = ctx.createGain(); b.gain.value = 350; lfo.connect(b).connect(lp.frequency); } lfo.start(t); lfo.stop(end); } }
      const dets = trem ? [-13, -2, 9] : [-9, 6];
      for (const det of dets) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det + ((k * 5) % 7) - 3; if (vib) vib.connect(o.detune);
        if (short) o.frequency.value = f; else { o.frequency.setValueAtTime(f * 0.993, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); }   // (a finger finding the note)
        const og = ctx.createGain(); og.gain.value = 1 / (dets.length * freqs.length); o.connect(og).connect(into); o.start(t); o.stop(end);
      }
    });
    // the hair on the string: a hiss under every bowed note (more of it in a shiver), a bite of it at the front of a short one
    const hair = this.hiss(t, end, 3600, 0.6, hill);
    if (short) { hair.gain.setValueAtTime(0.5, t); hair.gain.exponentialRampToValueAtTime(0.02, t + 0.05); } else { hair.gain.setValueAtTime(0, t); hair.gain.linearRampToValueAtTime(trem ? 0.16 : 0.09, t + attack); }
    g.connect(s.strings);
  }
  wind(t: number, f: number, len: number, v: number, kind: WindKind, breath: NoiseDice) {
    const ctx = this.ctx, s = this.space(), W = WINDS[kind], end = t + len + W.rel * 7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + W.atk); g.gain.setTargetAtTime(0, t + Math.max(W.atk, len), W.rel); g.connect(kind === 'horn' ? s.strings : s.keys);
    const lfo = ctx.createOscillator(); lfo.frequency.value = W.vibHz; const vib = ctx.createGain(); vib.gain.setValueAtTime(0, t + 0.25); vib.gain.linearRampToValueAtTime(W.vib, t + 0.9); lfo.connect(vib); lfo.start(t); lfo.stop(end);
    // the tube: what the reed or the lips make, through the shape of the thing
    let into: AudioNode = g;
    if (kind === 'clarinet') { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9; lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(f * (3.5 + 3 * v), t + W.atk); const wood = this.peak(1500, 2, 3); lp.connect(wood).connect(g); into = lp; }
    else if (kind === 'trumpet') {   // (the mute: almost nothing but two narrow bands gets out of the bell)
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; hp.Q.value = 0.7;
      for (const [hz, q, a] of [[1500, 3.5, 1], [2900, 4, 0.7], [820, 2, 0.25]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q; const bg = ctx.createGain(); bg.gain.value = a * 2.2; hp.connect(bp).connect(bg).connect(g); }
      into = hp;
    } else if (kind === 'horn') { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(f * (2.5 + 5 * v), t + W.atk); lp.frequency.setTargetAtTime(f * 2.4, t + W.atk, Math.max(0.1, len * 0.5)); const bell = this.peak(450, 1, 3); lp.connect(bell).connect(g); into = lp; }
    for (const [type, m, a, det] of W.osc) {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = det; o.frequency.setValueAtTime(f * m * W.from, t); o.frequency.exponentialRampToValueAtTime(f * m, t + W.atk * 1.2); vib.connect(o.detune);   // (blown up into the note)
      const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(into); o.start(t); o.stop(end);
    }
    const air = this.hiss(t, end, f * W.airAt, 1.6, g, breath.offset); air.gain.setValueAtTime(0, t); air.gain.linearRampToValueAtTime(W.air * 1.6, t + 0.03); air.gain.linearRampToValueAtTime(W.air, t + 0.2);
  }
  perc(t: number, kind: PercKind, v: number, noise: NoiseDice) {
    const [gain, pan, dark, takes] = KIT[kind];
    this.hitTo(this.space().perc, t, struckAt(this.ctx.sampleRate, kind, Math.floor(noise.offset / 1.5 * takes) % takes), v * gain, v, dark, pan, 1 + (noise.rate - 1) * 0.2);
  }
  cymbalRoll(t: number, len: number, v: number) {
    const [gain, pan, dark] = KIT.roll, late = Math.max(0, len - 3);   // (the buffer breaks three seconds in: a longer roll starts late, a shorter one part way up — and comes in from nothing)
    const { g } = this.hitTo(this.space().perc, t + late, struckAt(this.ctx.sampleRate, 'roll', 0), v * gain, v, dark, pan, 1, 0, Math.max(0, 3 - len));
    if (len < 3) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * gain, t + len * 0.6); }
  }
  private noise(t: number, len: number, freq: number, type: BiquadFilterType, v: number, q: number, dice: NoiseDice) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = dice.rate;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.drumsGain); src.start(t, dice.offset); src.stop(t + len + 0.02);
    return src;
  }
}
