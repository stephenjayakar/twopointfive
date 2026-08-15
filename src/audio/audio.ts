// Audio engine: synthesized SFX with HRTF spatialization, ray-cast occlusion (low-pass + attenuation through the
// same box scene the renderer traces), a reverb send sized by the traced free path around the listener, ambience
// emitters, and the generative score. Starts on the first user gesture (browser autoplay policy).
import { Vec3, v3 } from '../math/vec';
import { StaticCollision } from '../scene/collision';
import { GameAudioLike } from '../game/audio_iface';
import { FLOOR, FloorMat, floorAt } from '../game/floor';
import { buildSfx, SfxName } from './sfx';
import { Music } from './music';
import { sysRandom } from '../math/dice';   // the mixer / the solver draw the SYSTEM die, never the simulation's seeded one under a session recording (math/dice.ts)

interface Voice { src: AudioBufferSourceNode; panner?: PannerNode; filter?: BiquadFilterNode; gain: GainNode; pos?: Vec3; end: number; loop?: boolean; /** estimated level at the listener when it started (positional one-shots): what the voice cap steals by */ level?: number; /** stolen: fading out over a few ms, no longer counted against the budget */ dying?: boolean; }

/** THE VOICE BUDGET (W8.6). The loud minute — four QRF carbines, the shift's pistols, Sam's rifle, impacts, brass, doors — asked for 40–80 positional voices alive at
 *  once, every one an HRTF panner (a pair of convolutions) behind a propagate() through the walls, most of them 30 m and three rooms away at −50 dB under the compressor.
 *  So: a positional one-shot whose level at the listener (its gain × the occlusion cut × the panner's own inverse-distance law) is under CULL_LEVEL is not played at
 *  all; at most MAX_POSITIONAL positional one-shots live at once (a newcomer louder than the quietest steals its place, a quieter one is dropped); and only the near or
 *  loud ones get the HRTF model — the far and faint are panned 'equalpower', which costs next to nothing and, that far down, sounds the same. Loops (a canister's hiss)
 *  and non-positional sounds (stings, thunder, UI) are outside all three. */
const MAX_POSITIONAL = 24;
const CULL_LEVEL = 0.0056;                    // ≈ −45 dB re a gain-1 sound at the reference distance
const HRTF_NEAR_M = 12, HRTF_LOUD_LEVEL = 0.05; // travelled under 12 m, or louder than −26 dB at the ear: worth the HRTF panner
const REF_DIST = 1.6, ROLLOFF = 1.1;          // the positional panners' distance law (inverse) — one place, so the level estimate above matches what the graph does

export class AudioEngine implements GameAudioLike {
  ctx: AudioContext | null = null;
  private sfx!: Record<SfxName, AudioBuffer>;
  private master!: GainNode; private sfxBus!: GainNode; private revSend!: GainNode; private reverb!: ConvolverNode; private revOut!: GainNode; private ambBus!: GainNode;
  music: Music | null = null;
  private voices: Voice[] = [];
  private listener: Vec3 = [0, 1.6, 0]; private camFwd: Vec3 = [0, 0, -1];
  private lastEnvT = 0;   // when the reverb environment was last re-probed
  volume = { master: 0.8, sfx: 1.0, music: 0.55, ambience: 0.6 };
  started = false; enabled = true;
  private ambience: { pos: Vec3; node: AudioBufferSourceNode; gain: GainNode; panner: PannerNode; filter: BiquadFilterNode; base: number; radius: number; f0: number }[] = [];   // f0 = the source's own low-pass (its timbre), the ceiling for the occlusion filter
  /** voices = alive now · maxVoices = the most alive at once since start · culled = positional one-shots not played (inaudible, or quieter than a full budget) · stolen = quietest
   *  voices stopped to make room · hrtf / equalpower = positional one-shots by the panner they got · occluded / routed = propagation outcomes · wet = the reverb send now */
  stats = { voices: 0, maxVoices: 0, culled: 0, stolen: 0, hrtf: 0, equalpower: 0, occluded: 0, routed: 0, wet: 0 };

  constructor(private col: StaticCollision) {}   // col.sound (propagation), col.raycast (reverb sizing) see walls, props and door leaves

  /** Must be called from a user-gesture handler. */
  start() {
    if (this.started) { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); return; }   // a context created without a qualifying gesture starts suspended: retry on the next gesture
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext; if (!AC) return;
    const ctx: AudioContext = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx; this.started = true;
    this.master = ctx.createGain(); this.master.gain.value = this.volume.master;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.volume.sfx; this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.volume.ambience; this.ambBus.connect(this.master);
    // reverb: synthetic IR (decaying filtered noise, slightly different L/R)
    this.reverb = ctx.createConvolver(); this.reverb.buffer = makeIR(ctx, 1.9, 2.8);
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0.3;
    this.revOut = ctx.createGain(); this.revOut.gain.value = 0.8;
    this.revSend.connect(this.reverb).connect(this.revOut).connect(this.master);
    this.sfx = buildSfx(ctx);
    this.music = new Music(ctx, this.master); this.music.setVolume(this.volume.music);
    this.setupAmbience();
  }

  setListener(pos: Vec3, camForward: Vec3) {
    this.listener = v3.copy(pos); this.camFwd = v3.normalize([camForward[0], 0, camForward[2]]);
    const ctx = this.ctx; if (!ctx) return;
    const L = ctx.listener; const t = ctx.currentTime;
    if (L.positionX) { L.positionX.setTargetAtTime(pos[0], t, 0.05); L.positionY.setTargetAtTime(pos[1], t, 0.05); L.positionZ.setTargetAtTime(pos[2], t, 0.05);
      L.forwardX.setTargetAtTime(this.camFwd[0], t, 0.05); L.forwardY.setTargetAtTime(0, t, 0.05); L.forwardZ.setTargetAtTime(this.camFwd[2], t, 0.05); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(pos[0], pos[1], pos[2]); L.setOrientation(this.camFwd[0], 0, this.camFwd[2], 0, 1, 0); }
  }

  private static cutoff(muffle: number) { return 20000 * Math.pow(0.045, muffle); }   // 20 kHz clear → ~900 Hz through solid mass

  play(name: string, pos: Vec3 | null, gain = 1, opts: Record<string, unknown> = {}) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    if (name === 'smokeHiss') { this.hiss(pos ?? this.listener, (opts.duration as number) ?? 15); return; }   // a synthesized loop, not a table entry — must be checked before the lookup below
    const buf = this.sfx[name as SfxName]; if (!buf) return;
    const t = ctx.currentTime;
    const rate = (opts.rate as number) ?? (0.96 + sysRandom() * 0.08);   // (drawn before any cull below, so a sound culled or not leaves Math.random where it always did)
    let v: Voice;
    if (pos) {
      // propagation FIRST — straight through air (partial occlusion from side rays softens doorway edges), or, when walled off, around the corners along the walkable
      // space: it then appears to come out of the doorway/bend, at the path's length, muffled a little (a lot if a closed door sits across that doorway); sealed off →
      // through the mass — because what it says decides whether the sound is worth a voice at all (the budget above)
      const prop = this.col.sound.propagate(pos, this.listener); const at = prop.apparent, occ = prop.muffle;
      const d = v3.dist(at, this.listener);
      const level = gain * (1 - 0.55 * occ) * (REF_DIST / (REF_DIST + ROLLOFF * (Math.max(d, REF_DIST) - REF_DIST)));   // what reaches the ear: the gain the graph applies × the panner's inverse-distance law at the apparent position
      if (level < CULL_LEVEL) { this.stats.culled++; return; }                                                             // inaudible under the mix: no voice
      let alive = 0, quiet: Voice | null = null;
      for (const w of this.voices) if (w.panner && !w.loop && !w.dying && t <= w.end) { alive++; if (!quiet || (w.level ?? 1) < (quiet.level ?? 1)) quiet = w; }
      if (alive >= MAX_POSITIONAL) {
        if (!quiet || (quiet.level ?? 1) >= level) { this.stats.culled++; return; }                                          // the budget is full of louder sounds: this one would not be missed
        try { quiet.gain.gain.setTargetAtTime(0, t, 0.012); quiet.src.stop(t + 0.06); } catch { /* already ended */ } quiet.end = t + 0.08; quiet.dying = true; this.stats.stolen++;   // else the quietest goes — a 12 ms fade, not a click; out of the budget this instant, retired by update() once stopped — and this one plays
      }
      if (prop.routed) this.stats.routed++; if (occ > 0.5) this.stats.occluded++;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      const g = ctx.createGain();
      v = { src, gain: g, end: t + buf.duration / rate + 0.1, level };
      const near = prop.pathLen < HRTF_NEAR_M || level > HRTF_LOUD_LEVEL;
      const p = ctx.createPanner(); p.panningModel = near ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = REF_DIST; p.rolloffFactor = ROLLOFF; p.maxDistance = 80;   // HRTF where it can be heard AS a place — near, or loud; the far and faint take the cheap panner
      if (near) this.stats.hrtf++; else this.stats.equalpower++;
      p.positionX.value = at[0]; p.positionY.value = at[1]; p.positionZ.value = at[2];
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = AudioEngine.cutoff(occ);
      g.gain.value = gain * (1 - 0.55 * occ);
      src.connect(f).connect(p).connect(g);
      g.connect(this.sfxBus);
      // reverb send: more when muffled / routed (you hear the room, not the source) and with distance travelled
      const send = ctx.createGain(); send.gain.value = Math.min(1, 0.25 + 0.5 * occ + prop.pathLen * 0.02);   // revSend's own gain already carries how live the room is
      g.connect(send).connect(this.revSend);
      v.panner = p; v.filter = f; v.pos = v3.copy(pos);
    } else {
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = gain;
      v = { src, gain: g, end: t + buf.duration / rate + 0.1 };
      // non-positional (stings, UI, thunder): optionally low-passed (opts.lowpass, Hz — thunder dulls with distance), leaned to a side (opts.pan −1‥1 — toward
      // the storm cell's bearing) and given some room (opts.wet 0‥1); with none of them it is the plain src → gain → bus it always was
      let node: AudioNode = src;
      if (typeof opts.lowpass === 'number') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lowpass; f.Q.value = 0.5; node.connect(f); node = f; v.filter = f; }
      if (typeof opts.pan === 'number' && typeof ctx.createStereoPanner === 'function') { const sp = ctx.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, opts.pan)); node.connect(sp); node = sp; }
      node.connect(g).connect(this.sfxBus);
      if (typeof opts.wet === 'number' && opts.wet > 0) { const send = ctx.createGain(); send.gain.value = Math.min(1, opts.wet); g.connect(send).connect(this.revSend); }
    }
    v.src.start(t);
    this.voices.push(v);
    if (this.voices.length > this.stats.maxVoices) this.stats.maxVoices = this.voices.length;
  }

  /** The rain bed (weather.ts calls this every frame with the level it wants, 0 = off): a loop of noise shaped into the hiss of rain on asphalt (a broad band
   *  round 1.4 kHz) over the drum of it on the roof and the cars (a low-passed layer), built on first use, its gain eased toward `level` × its own ceiling on the
   *  ambience bus. Nothing exists until the weather first asks; level 0 fades it out and leaves the nodes running silent (cheap) for the next shower. */
  rain(level: number) {
    const ctx = this.ctx; if (!ctx) return;
    if (!this.rainBed) {
      if (level <= 0) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 5); src.loop = true;
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
  private rainBed: { out: GainNode; level: number } | null = null;

  /** One footfall. The floor it lands on comes from the shared material map (game/floor.ts — the same map the guards' ears and the SOUND meter read; `mat` arrives
   *  resolved by the caller, floor.ts tread, so the mixer cannot disagree with them): hard finishes get the heel click, carpet and grass the soft scuff, and the
   *  sample runs a touch brighter on stone / duller on carpet. `loudness` already carries the material's share (carpet 0.6 ×, stone 1.1 × …), so it goes straight to the gain. */
  footstep(pos: Vec3, loudness: number, isPlayer: boolean, mat: FloorMat = floorAt(pos)) {
    const f = FLOOR[mat];
    this.play(f.hard ? 'footHard' : 'footSoft', pos, (isPlayer ? 0.55 : 0.7) * loudness, { rate: (0.9 + sysRandom() * 0.25) * f.rate });
  }

  private hiss(pos: Vec3, duration: number) {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 2); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.8;
    const occF = ctx.createBiquadFilter(); occF.type = 'lowpass'; occF.frequency.value = 20000;
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.rolloffFactor = 1.3; p.positionX.value = pos[0]; p.positionY.value = pos[1] + 0.1; p.positionZ.value = pos[2];
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.3); g.gain.setValueAtTime(0.5, t + Math.max(0.5, duration - 2)); g.gain.linearRampToValueAtTime(0, t + duration);
    src.connect(f).connect(occF).connect(p).connect(g).connect(this.sfxBus);
    src.start(t); src.stop(t + duration + 0.1);
    this.play('smokePop', pos, 0.9);
    this.voices.push({ src, panner: p, filter: occF, gain: g, pos: v3.copy(pos), end: t + duration + 0.2, loop: true });
  }

  private setupAmbience() {
    const ctx = this.ctx!;
    const mk = (pos: Vec3, kind: 'hum' | 'servers' | 'wind' | 'buzz', base: number, radius: number) => {
      const src = ctx.createBufferSource(); const g = ctx.createGain(); g.gain.value = 0; const f = ctx.createBiquadFilter();
      const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1; p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
      if (kind === 'servers') { src.buffer = toneNoise(ctx, 3, [118, 236, 355], 0.5); f.type = 'lowpass'; f.frequency.value = 1800; }
      else if (kind === 'hum') { src.buffer = toneNoise(ctx, 3, [50, 100, 150], 0.15); f.type = 'lowpass'; f.frequency.value = 600; }
      else if (kind === 'buzz') { src.buffer = toneNoise(ctx, 2, [100, 200, 300, 400], 0.05); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 2; }
      else { src.buffer = noiseBuffer(ctx, 4); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.5; const l = ctx.createOscillator(); l.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 250; l.connect(lg).connect(f.frequency); l.start(); }
      src.loop = true; src.connect(f).connect(p).connect(g).connect(this.ambBus); src.start();
      this.ambience.push({ pos, node: src, gain: g, panner: p, filter: f, base, radius, f0: f.frequency.value });
    };
    mk([18, 1.2, 7], 'servers', 0.5, 12);        // server room
    mk([29.5, 1.2, 13.2], 'buzz', 0.35, 7);       // vending machines
    mk([16.5, 2.8, 20.6], 'buzz', 0.15, 6);       // flickering panel ballast
    mk([8, 2.6, 18], 'hum', 0.25, 14);            // HVAC over the lobby
    mk([16, 3, 27], 'wind', 0.5, 18);             // outside, south
    mk([1.5, 3, 20], 'wind', 0.4, 14);            // outside, west
  }

  /** Per-frame housekeeping: retire voices, refresh occlusion on loops/ambience, size the reverb by tracing around the listener. */
  update(dt: number, time: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.voices = this.voices.filter(v => { if (t > v.end) { try { v.src.disconnect(); v.gain.disconnect(); } catch { /* already gone */ } return false; } return true; });
    this.stats.voices = this.voices.length;
    // environment probe (4×/s): mean free path around the listener → reverb amount; outdoor → less
    if (time - this.lastEnvT > 0.25 || this.lastEnvT === 0) {
      let sum = 0; const N = 10;
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const hit = this.col.raycast(this.listener, [Math.cos(a), 0, Math.sin(a)], 16); sum += hit ? hit.t : 16; }
      const mfp = sum / N; const outdoors = this.listener[0] < 4 || this.listener[0] > 36 || this.listener[2] < 4 || this.listener[2] > 24;
      const wet = outdoors ? 0.08 : Math.min(0.55, 0.12 + mfp * 0.045);
      this.revSend.gain.setTargetAtTime(wet, t, 0.3); this.stats.wet = wet;
      this.lastEnvT = time || 1e-3;
      // loops (canister hiss) + ambience go through the same propagation as one-shots: re-aim the panner at the apparent position, retune the low-pass
      const move = (p: PannerNode, at: Vec3, k: number) => { p.positionX.setTargetAtTime(at[0], t, k); p.positionY.setTargetAtTime(at[1], t, k); p.positionZ.setTargetAtTime(at[2], t, k); };
      for (const v of this.voices) if (v.loop && v.pos && v.filter && v.panner) { const pr = this.col.sound.propagate(v.pos, this.listener); move(v.panner, pr.apparent, 0.25); v.filter.frequency.setTargetAtTime(AudioEngine.cutoff(pr.muffle), t, 0.2); }
      for (const a of this.ambience) {
        const d = v3.dist(a.pos, this.listener); let g = a.base * Math.max(0, 1 - d / a.radius);
        if (g > 0.01) { const pr = this.col.sound.propagate(a.pos, this.listener); g *= 1 - 0.6 * pr.muffle; move(a.panner, pr.apparent, 0.4); a.filter.frequency.setTargetAtTime(Math.min(a.f0, 300 + AudioEngine.cutoff(pr.muffle)), t, 0.4); }   // (BiquadFilter.frequency.defaultValue is the spec's 350 Hz, not what we set — clamp against the authored f0)
        a.gain.gain.setTargetAtTime(g, t, 0.5);
      }
    }
    void dt;
  }

  setVolumes() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.enabled ? this.volume.master : 0, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.volume.sfx, t, 0.1); this.ambBus.gain.setTargetAtTime(this.volume.ambience, t, 0.1);
    this.music?.setVolume(this.volume.music);
  }
}

// ---- buffer helpers ----
function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = sysRandom() * 2 - 1; return b;
}
function toneNoise(ctx: BaseAudioContext, seconds: number, freqs: number[], noiseAmt: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds); const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0);
  // make it loop seamlessly: integer cycles over the buffer
  const fs = freqs.map(f => Math.round(f * seconds) / seconds);
  let lpv = 0;
  for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; let v = 0; fs.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t + k) / (k + 1); }); lpv += 0.05 * ((sysRandom() * 2 - 1) - lpv); d[i] = v * 0.3 + lpv * noiseAmt; }
  return b;
}
function makeIR(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds); const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lpv = 0; for (let i = 0; i < n; i++) { const t = i / n; lpv += 0.4 * ((sysRandom() * 2 - 1) - lpv); d[i] = lpv * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1); } }
  return b;
}
