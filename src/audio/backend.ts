// AudioBackend — the seam under the mixer: what plays a buffer, moves a voice, sets a bus. src/audio/audio.ts's AudioEngine keeps everything
// that is the GAME's — the voice budget (cull / steal), the propagation through the walls (col.sound.propagate), the ambience emitters' placement and levels, the reverb sized by
// the traced free path, the footstep material — and drives one of these: `WebAudioBackend` (src/audio/webaudio.ts: today's graph, node for node) in the browser; the seam was cut for a native
// host that has since been removed. Types only + the buffer stand-in the SFX synth renders into.
import type { Vec3 } from '../math/vec';

/** an audio buffer as the SFX synth (sfx.ts buildSfx) writes it and a backend loads it — a real AudioBuffer satisfies this; `sfxContext()` below makes plain Float32Array ones */
export interface SfxBuffer { readonly sampleRate: number; readonly length: number; readonly duration: number; readonly numberOfChannels: number; getChannelData(channel: number): Float32Array; }
/** what buildSfx and the buffer helpers need of a context: the rate and a buffer factory — a BaseAudioContext is one, sfxContext(sr) another */
export interface SfxContext { readonly sampleRate: number; createBuffer(channels: number, length: number, sampleRate: number): SfxBuffer; }
/** the stand-in context: plain buffers, for a host without Web Audio (the native backend loads the Float32Arrays; the QA harness never needs one) */
export function sfxContext(sampleRate = 48000): SfxContext {
  return { sampleRate, createBuffer(channels, length, sr) { const ch: Float32Array[] = []; for (let c = 0; c < channels; c++) ch.push(new Float32Array(length)); return { sampleRate: sr, length, duration: length / sr, numberOfChannels: channels, getChannelData: (c) => ch[c] }; } };
}

export type BusName = 'master' | 'sfx' | 'ambience';
/** an opaque voice the backend hands back (the WebAudio one: its node bundle) */
export type BackendVoice = object;

/** one voice as the mixer asks for it — the whole graph shape a WebAudio voice takes today is expressible here: [tone filter (+ LFO)] → [occlusion low-pass] → [panner | stereo pan] →
 *  gain [→ reverb send] → bus */
export interface PlayOpts {
  /** the loaded buffer's id */
  buffer: string;
  /** positional (a spatial panner at pos) or not (null: stings, UI, thunder — straight to the bus, optionally panned) */
  pos: Vec3 | null;
  gain: number; rate: number; loop?: boolean;
  /** with `loop`: the stretch of the buffer that repeats, in seconds (absent = all of it) — a voice that starts at the buffer's head and then holds its middle */
  loopAt?: { start: number; end: number };
  /** with `loop`: the source is stopped by itself this many seconds on, whatever becomes of its owner (absent = it loops until stopped) */
  maxSecs?: number;
  bus: 'sfx' | 'ambience';
  /** positional: the HRTF model (near / loud) vs the cheap equal-power pan; absent = HRTF */
  hrtf?: boolean;
  /** positional: the panner's inverse-distance law {ref, rolloff, max?} — one-shots (1.6, 1.1, 80), the canister hiss (1.2, 1.3), ambience (2, 1) */
  distance?: { ref: number; rolloff: number; max?: number };
  /** the voice's own tone filter (ambience timbre, the hiss's band): before the occlusion filter / panner */
  filter?: { type: 'lowpass' | 'bandpass'; freq: number; Q?: number };
  /** an occlusion low-pass at this cutoff (Hz) — one-shots: AudioEngine.cutoff(muffle); the hiss: 20 kHz then retuned; a non-positional `lowpass` opt (thunder) with Q 0.5 */
  cutoffHz?: number; cutoffQ?: number;
  /** reverb send gain (absent / 0 = no send node) */
  send?: number;
  /** non-positional: a stereo lean −1‥1 (toward the storm cell) */
  pan?: number;
  /** an LFO on the tone filter's frequency: the wind ambience's slow wobble */
  wobble?: { rateHz: number; depthHz: number };
  /** the canister hiss's gain envelope: 0 → peak over `rise` s, held until `hold`, back to 0 at `end` (all from now); the source is stopped at end + 0.1 */
  envelope?: { peak: number; rise: number; hold: number; end: number };
}

export interface AudioBackend {
  readonly sampleRate: number;
  /** the backend clock in seconds (AudioContext.currentTime) — the mixer stamps voice ends against it */
  now(): number;
  /** the buffer factory the SFX synth renders into (the real context in the browser: nothing copied twice) */
  readonly sfxContext: SfxContext;
  loadBuffer(id: string, buf: SfxBuffer): void;
  duration(id: string): number;
  play(o: PlayOpts): BackendVoice | null;
  /** re-aim / retune / re-level a live voice, eased over `tc` s (setTargetAtTime): loops re-aimed at their apparent position, retuned to the occlusion cutoff, ambience levels */
  setVoice(v: BackendVoice, patch: { pos?: Vec3; cutoffHz?: number; gain?: number; rate?: number }, tc: number): void;
  /** the voice budget stealing a voice: gain to 0 over `fadeMs`, the source stopped shortly after */
  stop(v: BackendVoice, fadeMs: number): void;
  /** a finished voice let go of (its nodes disconnected) */
  release(v: BackendVoice): void;
  setListener(pos: Vec3, fwd: Vec3): void;
  setBus(name: BusName, gain: number, tc: number): void;
  /** the reverb send's level (the mixer sizes it by the traced free path round the listener) */
  setReverb(wet: number, tc: number): void;
  /** the rain bed (a shaped noise loop on the ambience bus, built on first use; 0 fades it out) */
  rainLevel(level: number): void;
  /** the browser-only hook the score takes (audio/music.ts's sequencer over musicBackend.ts's WebAudioMusicBackend — the node graph): the context + the master node */
  readonly webAudio?: { ctx: AudioContext; master: AudioNode };
  /** a backend without Web Audio may offer the score's voices itself (musicBackend.ts MusicBackend — the native host's synth); absent = the music stays silent there */
  music?(): import('./musicBackend').MusicBackend | null;
}
