// WebAudioBackend — today's audio graph, node for node, behind the AudioBackend seam (src/audio/backend.ts): master → compressor → destination, an sfx and an ambience bus, a synthetic
// convolver reverb behind a send, one node bundle per voice ([tone filter (+ LFO)] → [occlusion low-pass] → [HRTF / equal-power panner | stereo pan] → gain [→ send] → bus), the
// rain bed. Everything that decides WHAT plays — the voice budget, propagation, ambience placement, reverb sizing — stays in src/audio/audio.ts; this file only builds nodes.
// Draws the SYSTEM die (math/dice.ts sysRandom) for its noise / IR buffers, never the simulation's seeded one.
import type { Vec3 } from '../math/vec';
import type { AudioBackend, BackendVoice, BusName, PlayOpts, SfxBuffer, SfxContext } from './backend';
import { sysRandom } from '../math/dice';

interface WaVoice { src: AudioBufferSourceNode; gain: GainNode; tone?: BiquadFilterNode; occ?: BiquadFilterNode; panner?: PannerNode; }

/** the master chain: a gain at `level` → the compressor → the context's destination; returns the gain (what every bus feeds). Here so a page that plays or MEASURES something
 *  through 'the game's master chain' (the score's listening page, an OfflineAudioContext) builds this one and not a copy of its numbers. */
export function masterChain(ctx: BaseAudioContext, level: number): GainNode {
  const master = ctx.createGain(); master.gain.value = level;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  return master;
}

export class WebAudioBackend implements AudioBackend {
  readonly ctx: AudioContext;
  readonly master: GainNode; private readonly sfxBus: GainNode; private readonly ambBus: GainNode;
  private readonly revSend: GainNode; private readonly reverb: ConvolverNode; private readonly revOut: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private rainBed: { out: GainNode; level: number } | null = null;
  readonly webAudio: { ctx: AudioContext; master: AudioNode };

  /** null when the page has no AudioContext (a Web Audio-less host: the mixer then stays silent, as before) */
  static create(volume: { master: number; sfx: number; ambience: number }): WebAudioBackend | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext; if (!AC) return null;
    return new WebAudioBackend(new AC({ latencyHint: 'interactive' }) as AudioContext, volume);
  }
  constructor(ctx: AudioContext, volume: { master: number; sfx: number; ambience: number }) {
    this.ctx = ctx;
    this.master = masterChain(ctx, volume.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = volume.sfx; this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = volume.ambience; this.ambBus.connect(this.master);
    // reverb: synthetic IR (decaying filtered noise, slightly different L/R)
    this.reverb = ctx.createConvolver(); this.reverb.buffer = makeIR(ctx, 1.9, 2.8) as AudioBuffer;   // (rendered into this context: an AudioBuffer)
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0.3;
    this.revOut = ctx.createGain(); this.revOut.gain.value = 0.8;
    this.revSend.connect(this.reverb).connect(this.revOut).connect(this.master);
    this.webAudio = { ctx, master: this.master };
  }

  get sampleRate() { return this.ctx.sampleRate; }
  now() { return this.ctx.currentTime; }
  get sfxContext(): SfxContext { return this.ctx; }
  /** a context still suspended (created off a gesture that did not qualify): resume on the next one */
  resume() { if (this.ctx.state === 'suspended') void this.ctx.resume(); }

  loadBuffer(id: string, buf: SfxBuffer): void {
    if (buf instanceof AudioBuffer) { this.buffers.set(id, buf); return; }   // (rendered into this very context: nothing to copy)
    const b = this.ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) b.getChannelData(c).set(buf.getChannelData(c));
    this.buffers.set(id, b);
  }
  duration(id: string): number { return this.buffers.get(id)?.duration ?? 0; }

  private bus(name: 'sfx' | 'ambience'): GainNode { return name === 'ambience' ? this.ambBus : this.sfxBus; }

  play(o: PlayOpts): BackendVoice | null {
    const ctx = this.ctx; const buf = this.buffers.get(o.buffer); if (!buf) return null;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate; if (o.loop) { src.loop = true; if (o.loopAt) { src.loopStart = o.loopAt.start; src.loopEnd = o.loopAt.end; } }
    const g = ctx.createGain();
    const v: WaVoice = { src, gain: g };
    let node: AudioNode = src;
    if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filter.type; f.frequency.value = o.filter.freq; if (o.filter.Q !== undefined) f.Q.value = o.filter.Q; node.connect(f); node = f; v.tone = f;
      if (o.wobble) { const l = ctx.createOscillator(); l.frequency.value = o.wobble.rateHz; const lg = ctx.createGain(); lg.gain.value = o.wobble.depthHz; l.connect(lg).connect(f.frequency); l.start(); } }
    if (o.cutoffHz !== undefined) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cutoffHz; if (o.cutoffQ !== undefined) f.Q.value = o.cutoffQ; node.connect(f); node = f; v.occ = f; }
    if (o.pos) {
      const p = ctx.createPanner(); p.panningModel = o.hrtf === false ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse';
      const d = o.distance; if (d) { p.refDistance = d.ref; p.rolloffFactor = d.rolloff; if (d.max !== undefined) p.maxDistance = d.max; }
      p.positionX.value = o.pos[0]; p.positionY.value = o.pos[1]; p.positionZ.value = o.pos[2];
      node.connect(p); node = p; v.panner = p;
    } else if (typeof o.pan === 'number' && typeof ctx.createStereoPanner === 'function') { const sp = ctx.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, o.pan)); node.connect(sp); node = sp; }
    if (o.envelope) { const e = o.envelope; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(e.peak, t + e.rise); g.gain.setValueAtTime(e.peak, t + e.hold); g.gain.linearRampToValueAtTime(0, t + e.end); }
    else g.gain.value = o.gain;
    node.connect(g).connect(this.bus(o.bus));
    if (o.send !== undefined && o.send > 0) { const send = ctx.createGain(); send.gain.value = Math.min(1, o.send); g.connect(send).connect(this.revSend); }
    src.start(t); if (o.envelope) src.stop(t + o.envelope.end + 0.1); else if (o.loop && o.maxSecs) src.stop(t + o.maxSecs);
    return v;
  }
  setVoice(bv: BackendVoice, patch: { pos?: Vec3; cutoffHz?: number; gain?: number; rate?: number }, tc: number): void {
    const v = bv as WaVoice; const t = this.ctx.currentTime;
    if (patch.pos && v.panner) { v.panner.positionX.setTargetAtTime(patch.pos[0], t, tc); v.panner.positionY.setTargetAtTime(patch.pos[1], t, tc); v.panner.positionZ.setTargetAtTime(patch.pos[2], t, tc); }
    if (patch.cutoffHz !== undefined) { const f = v.occ ?? v.tone; if (f) f.frequency.setTargetAtTime(patch.cutoffHz, t, tc); }
    if (patch.gain !== undefined) v.gain.gain.setTargetAtTime(patch.gain, t, tc);
    if (patch.rate !== undefined) v.src.playbackRate.setTargetAtTime(patch.rate, t, tc);
  }
  stop(bv: BackendVoice, fadeMs: number): void {
    const v = bv as WaVoice; const t = this.ctx.currentTime;
    try { v.gain.gain.setTargetAtTime(0, t, fadeMs / 1000); v.src.stop(t + 5 * fadeMs / 1000); } catch { /* already ended */ }
  }
  release(bv: BackendVoice): void { const v = bv as WaVoice; try { v.src.disconnect(); v.gain.disconnect(); } catch { /* already gone */ } }

  setListener(pos: Vec3, fwd: Vec3): void {
    const L = this.ctx.listener; const t = this.ctx.currentTime;
    if (L.positionX) { L.positionX.setTargetAtTime(pos[0], t, 0.05); L.positionY.setTargetAtTime(pos[1], t, 0.05); L.positionZ.setTargetAtTime(pos[2], t, 0.05);
      L.forwardX.setTargetAtTime(fwd[0], t, 0.05); L.forwardY.setTargetAtTime(0, t, 0.05); L.forwardZ.setTargetAtTime(fwd[2], t, 0.05); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(pos[0], pos[1], pos[2]); L.setOrientation(fwd[0], 0, fwd[2], 0, 1, 0); }
  }
  setBus(name: BusName, gain: number, tc: number): void {
    const n = name === 'master' ? this.master : name === 'sfx' ? this.sfxBus : this.ambBus;
    n.gain.setTargetAtTime(gain, this.ctx.currentTime, tc);
  }
  setReverb(wet: number, tc: number): void { this.revSend.gain.setTargetAtTime(wet, this.ctx.currentTime, tc); }

  /** The rain bed: a loop of noise shaped into the hiss of rain on asphalt (a broad band round 1.4 kHz) over the drum of it on the roof and the cars (a low-passed layer),
   *  built on first use, its gain eased toward `level` × its own ceiling on the ambience bus. Nothing exists until the weather first asks; 0 fades it out and leaves the
   *  nodes running silent (cheap) for the next shower. */
  rainLevel(level: number): void {
    const ctx = this.ctx;
    if (!this.rainBed) {
      if (level <= 0) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 5) as AudioBuffer; src.loop = true;
      const hiss = ctx.createBiquadFilter(); hiss.type = 'bandpass'; hiss.frequency.value = 1400; hiss.Q.value = 0.45;
      const drum = ctx.createBiquadFilter(); drum.type = 'lowpass'; drum.frequency.value = 320; drum.Q.value = 0.7;
      const gh = ctx.createGain(); gh.gain.value = 0.55; const gd = ctx.createGain(); gd.gain.value = 0.9;
      const out = ctx.createGain(); out.gain.value = 0;
      src.connect(hiss).connect(gh).connect(out); src.connect(drum).connect(gd).connect(out); out.connect(this.ambBus);
      // a slow wobble on the hiss band so the loop never sits still (gusts)
      const l = ctx.createOscillator(); l.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 350; l.connect(lg).connect(hiss.frequency); l.start();
      src.start();
      this.rainBed = { out, level: -1 };
    }
    const lv = Math.max(0, Math.min(1, level));
    if (Math.abs(lv - this.rainBed.level) < 0.004) return;
    this.rainBed.level = lv;
    this.rainBed.out.gain.setTargetAtTime(lv * 0.42, ctx.currentTime, lv > 0 ? 0.8 : 1.5);
  }
}

// ---- buffer helpers (over the SfxContext stand-in, so a Web Audio-less host renders the same samples) ----
export function noiseBuffer(ctx: SfxContext, seconds: number): SfxBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = sysRandom() * 2 - 1; return b;
}
export function toneNoise(ctx: SfxContext, seconds: number, freqs: number[], noiseAmt: number): SfxBuffer {
  const n = Math.floor(ctx.sampleRate * seconds); const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0);
  // make it loop seamlessly: integer cycles over the buffer
  const fs = freqs.map(f => Math.round(f * seconds) / seconds);
  let lpv = 0;
  for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; let v = 0; fs.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t + k) / (k + 1); }); lpv += 0.05 * ((sysRandom() * 2 - 1) - lpv); d[i] = v * 0.3 + lpv * noiseAmt; }
  return b;
}
export function makeIR(ctx: SfxContext, seconds: number, decay: number): SfxBuffer {
  const n = Math.floor(ctx.sampleRate * seconds); const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lpv = 0; for (let i = 0; i < n; i++) { const t = i / n; lpv += 0.4 * ((sysRandom() * 2 - 1) - lpv); d[i] = lpv * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1); } }
  return b;
}
