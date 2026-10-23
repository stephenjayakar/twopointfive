// Audio engine: synthesized SFX with HRTF spatialization, ray-cast occlusion (low-pass + attenuation through the
// same box scene the renderer traces), a reverb send sized by the traced free path around the listener, ambience
// emitters, and the generative score. Starts on the first user gesture (browser autoplay policy).
// Since the native-engine seams the GRAPH lives behind an AudioBackend (src/audio/backend.ts): WebAudioBackend (src/audio/webaudio.ts) is
// today's node graph, node for node; a native host hands another. What stays HERE is the game's half — the voice budget, the propagation through the walls, the ambience emitters'
// placement and levels, the reverb sized by the traced free path, the footstep material — exactly as it was.
import { Vec3, v3 } from '../math/vec';
import { StaticCollision } from '../scene/collision';
import { GameAudioLike } from '../game/audio_iface';
import { FLOOR, FloorMat, floorAt } from '../game/floor';
import { buildSfx, buildSfxLater, ROLL_LOOP, FIRE_LOOP, SfxName } from './sfx';
import { buildSfxWas, wasInGame, wasOnly, WAS_IN_GAME } from './sfxWas';
import { Music, WebAudioMusicBackend } from './music';
import { sysRandom } from '../math/dice';   // the mixer / the solver draw the SYSTEM die, never the simulation's seeded one under a session recording (math/dice.ts)
import type { AudioBackend, BackendVoice, SfxBuffer, SfxContext } from './backend';
import { WebAudioBackend, noiseBuffer } from './webaudio';
import { sfxContext } from './backend';
import { AMBIENCE_DISTANCE, AMBIENCE_OFFICE, AmbienceKind, HISS, ambienceLoop } from './loops';
import { MAX_DIST, REF_DIST, ROLLOFF, VOLUME_DEFAULTS, cutoffOf, distanceGain, hrtfFor, occludedGain, sendOf } from './mixlaw';

interface Voice { v: BackendVoice; positional: boolean; /** made by `again()`: the lanes' re-listen, faded apart from the tape's own voices */ again?: boolean; pos?: Vec3; end: number; loop?: boolean; /** estimated level at the listener when it started (positional one-shots): what the voice cap steals by */ level?: number; /** stolen: fading out over a few ms, no longer counted against the budget */ dying?: boolean;
  /** a voice that FOLLOWS a thing for as long as that thing makes its sound (`follow()`): asked every update where it is and how hard it goes */ follow?: Follow; }
/** What a followed voice is asked each update: where the thing is, how hard it goes (0‥1: level and pitch ride it) and the game's own clock (a clock that stands still —
 *  a pause, a frozen card — is a thing that makes no sound). null = it has stopped, or is gone: the voice fades out and is let go. */
export type FollowSrc = () => { pos: Vec3; k: number; t: number } | null;
interface Follow { src: FollowSrc; name: string; gain: number; rate: number; occ: number; lastT: number; /** the mixer's clock when the game's last moved */ seen: number; }
/** the stretch of a followed voice's buffer that repeats while it is held (seconds; a take shorter than the stretch loops whole) */
const FOLLOW_LOOPS: Record<string, { start: number; end: number }> = { chairRoll: ROLL_LOOP, fireBed: FIRE_LOOP };
const MAX_FOLLOW = 4, FOLLOW_SECS = 45, FOLLOW_FADE_MS = 140;   // followed voices at once · the longest one is held · its fade when the thing stops


/** THE VOICE BUDGET (W8.6). The loud minute — four QRF carbines, the shift's pistols, Sam's rifle, impacts, brass, doors — asked for 40–80 positional voices alive at
 *  once, every one an HRTF panner (a pair of convolutions) behind a propagate() through the walls, most of them 30 m and three rooms away at −50 dB under the compressor.
 *  So: a positional one-shot whose level at the listener (its gain × the occlusion cut × the panner's own inverse-distance law) is under CULL_LEVEL is not played at
 *  all; at most MAX_POSITIONAL positional one-shots live at once (a newcomer louder than the quietest steals its place, a quieter one is dropped); and only the near or
 *  loud ones get the HRTF model — the far and faint are panned 'equalpower', which costs next to nothing and, that far down, sounds the same. Loops (a canister's hiss)
 *  and non-positional sounds (stings, thunder, UI) are outside all three. */
/** a followed voice by how hard its thing goes (k 0‥1): quieter and lower as it slows, so a chair coasting to rest winds down instead of cutting off */
const followGain = (k: number) => { const c = Math.min(1, Math.max(0, k)); return Math.min(1, c / 0.08) * (0.3 + 0.7 * c); },   // (nothing at rest: a thing that is not moving makes no sound, whatever its owner says)
  followRate = (k: number) => 0.8 + 0.3 * Math.min(1, Math.max(0, k));
const MAX_POSITIONAL = 24;
const CULL_LEVEL = 0.0056;                    // ≈ −45 dB re a gain-1 sound at the reference distance

export { VOLUME_DEFAULTS };   // (audio/mixlaw.ts: the levels a fresh page has, and the law for one positional voice — the listening page reads the same)

/** which table of effects the mixer loads, read once when the audio starts. As shipped: the redone table (audio/sfx.ts) with the voices the maintainer picked as
 *  BETTER BEFORE laid over it from the old one (audio/sfxWas.ts `WAS_IN_GAME`: his votes of 10-12 — the redone ones stay in sfx.ts, on the listening page, as 'after').
 *  `was` = all of the old table (the page's `?oldsounds`), `redone` = all of the redone one (`?newsounds`) — for hearing either whole in play. The mixer's ears
 *  only: nothing the game hears with reads it. */
export const SFX_TABLE = { was: false, redone: false };
/** the table the game plays (a voice added since the old table was frozen keeps its own) */
export function gameSfx(ctx: SfxContext): Record<SfxName, SfxBuffer> {
  const t = buildSfx(ctx);
  return SFX_TABLE.was ? { ...t, ...buildSfxWas(ctx) } : SFX_TABLE.redone ? t : { ...t, ...wasInGame(ctx) };
}

/** THE SOUNDS ARE MADE BEFORE THE FIRST CLICK, ONE AT A TIME. The mixer may not start until the visitor clicks or presses a key, and it used to synthesise its
 *  whole table inside that first click: eighty voices, most of a second with the page stopped — heard as a hitch just as the sound comes in (a play test,
 *  10-19: "a hitch in the audio right when it gets started"). Now the page asks for the table as soon as it is up (`warmSfx`), a voice at a time in the browser's
 *  idle moments while the shaders compile; the first click then only hands the mixer what is made. A voice asked for before its turn is made on the spot, the
 *  rest carry on in idle moments. The samples are the same ones (each voice has its own seed: sfx.ts `lazy`), and the voices the old table gives the game
 *  (sfxWas.ts WAS_IN_GAME) are no longer made twice. `?sfxwarm=0` = the whole table inside the first click, as it was.
 *  THE RATE: a page cannot ask what its output runs at before the click, so the warm-up makes the table at the rate the mixer last started at in this browser
 *  (`rateKey`, written at every start), `rate` on a first visit. Where the guess is wrong, what was made is dropped at the click and the table is made at the
 *  device's rate the same way, a voice at a time — that page's first sounds each pay for their own making, and the next page guesses right.
 *  ONE MIXER: the warm-up feeds the first mixer that starts; another on the same page makes its own table whole, as it was. */
export const SFX_WARM = { on: true, rate: 48000, rateKey: 'twopointsix.sfxRate' };
try { if (new URLSearchParams(location.search).get('sfxwarm') === '0') SFX_WARM.on = false; } catch { /* no page (the harness) */ }
/** gameSfx's table, no voice rendered: name → the call that renders it (the same samples; a WAS_IN_GAME voice is the old table's and the redone one is never made) */
export function gameSfxLater(ctx: SfxContext): Map<string, () => SfxBuffer> {
  const t: Map<string, () => SfxBuffer> = buildSfxLater(ctx);
  if (!SFX_TABLE.redone) for (const n of WAS_IN_GAME) { const redone = t.get(n); let b: SfxBuffer | null = null; t.set(n, () => b ??= (wasOnly(ctx, [n])[n] as SfxBuffer | undefined) ?? redone!()); }
  return t;
}
/** when the page has a moment: the browser's idle callback where there is one (a slice between frames, or all of a quiet stretch — `left` = the ms it has, and
 *  half a second gone by with no such moment is one anyway), a short timer where not */
type Idle = { didTimeout: boolean; timeRemaining(): number };
const whenIdle = (fn: (left: number) => void) => { const ric = (globalThis as { requestIdleCallback?: (f: (d: Idle) => void, o?: { timeout: number }) => number }).requestIdleCallback; if (ric) ric(d => fn(d.didTimeout ? Infinity : d.timeRemaining()), { timeout: 500 }); else setTimeout(() => fn(Infinity), 16); };
/** the warm-up's state: the calls still to make (null = not begun), the voices made and not yet handed over, the mixer's loader once one has started */
const warm = { rate: 0, later: null as Map<string, () => SfxBuffer> | null, made: new Map<string, SfxBuffer>(), sink: null as ((name: string, buf: SfxBuffer) => void) | null, pumping: false, slices: 0, longest: 0, total: 0 };
function warmOne(name: string): void {
  const job = warm.later?.get(name); if (!job) return;
  warm.later!.delete(name);
  const t = performance.now(); const buf = job(); const ms = performance.now() - t; warm.longest = Math.max(warm.longest, ms); warm.total += ms; warm.slices++;
  if (warm.sink) warm.sink(name, buf); else warm.made.set(name, buf);
}
function warmPump(): void {
  if (warm.pumping || !warm.later?.size) return;
  warm.pumping = true;
  // one voice a moment, and only in a moment long enough for the usual one (a frame's few spare ms pass it by: the picture is not made to wait for a sound)
  whenIdle(left => { warm.pumping = false; const next = warm.later?.keys().next(); if (next && !next.done && left >= Math.min(12, warm.slices ? warm.total / warm.slices : 4)) warmOne(next.value); warmPump(); });
}
/** the page, once, as soon as it is up: start making the table (nothing under ?sfxwarm=0, or once a mixer has started) */
export function warmSfx(rate = lastRate()): void {
  if (!SFX_WARM.on || SFX_TABLE.was || warm.later || warm.sink) return;
  warm.rate = rate; warm.later = gameSfxLater(sfxContext(rate)); warmPump();
}
/** the rate the mixer last started at in this browser, SFX_WARM.rate where none is kept */
function lastRate(): number { try { const v = Number(localStorage.getItem(SFX_WARM.rateKey)); if (v >= 8000 && v <= 384000) return v; } catch { /* no store */ } return SFX_WARM.rate; }
/** a check's: the warm-up as on a page just opened (a mixer it fed keeps what it has and gets no more) */
export function warmReset(): void { warm.rate = 0; warm.later = null; warm.made.clear(); warm.sink = null; warm.slices = 0; warm.longest = 0; warm.total = 0; }
/** how the warm-up stands (the page check reads it): voices still to make, made and waiting, slices run, the longest one in ms */
export const warmState = () => ({ left: warm.later?.size ?? 0, waiting: warm.made.size, slices: warm.slices, longest: warm.longest, rate: warm.rate, live: !!warm.sink });

/** one sound as the game asked the mixer for it: `dur` = seconds as played (the buffer's length over its rate), `heard` 2 = played, 1 = asked and culled (inaudible, or under a full
 *  budget), 0 = the mixer was off (a muted page, a replay's undrawn seek) */
export interface SoundAsk { name: string; gain: number; dur: number; heard: 0 | 1 | 2; mix?: SoundMix }
/** how one voice was mixed, BEFORE the page's trim (`trims`) — kept by the lanes so `again()` can play that moment once more under whatever is picked now. `rel` = where
 *  it seemed to come from, in the listener's own frame (right, up, ahead; absent = a sound with no place), `gain` after occlusion, `cut` the low-pass in Hz. */
export interface SoundMix { rel?: [number, number, number]; gain: number; rate: number; cut?: number; send?: number; hrtf?: boolean; pan?: number }
/** what the page lays over ONE sound for the mixer's ears: another loaded buffer (`loadTake`), pitch, level, a low-pass in Hz. The game hears with none of it. */
export interface SoundTrim { take?: string; rate?: number; gain?: number; tone?: number }

export class AudioEngine implements GameAudioLike {
  /** the graph (null until start()): the Web Audio one on the page, another host's otherwise */
  backend: AudioBackend | null = null;
  /** the Web Audio context while the backend is the browser's (what the page's hooks / tests looked at) */
  get ctx(): AudioContext | null { return this.backend?.webAudio?.ctx ?? null; }
  music: Music | null = null;
  /** the main menu is up (main.ts says so every frame, from before the first gesture makes the score): the score plays the theme alone there (music.ts `menu`) */
  get scoreMenu() { return this.menuUp; }
  set scoreMenu(v: boolean) { this.menuUp = v; if (this.music) this.music.menu = v; }
  private menuUp = false;
  /** the level's own music, as PIECE_NAMES indices (audio/setlist.ts; main.ts says it once at boot, before the first gesture makes the score): music.ts `setlist` */
  get scoreSet() { return this.levelSet; }
  set scoreSet(v: readonly number[] | null) { this.levelSet = v; if (this.music) this.music.setlist = v; }
  private levelSet: readonly number[] | null = null;
  private voices: Voice[] = [];
  private listener: Vec3 = [0, 1.6, 0]; private camFwd: Vec3 = [0, 0, -1];
  private lastEnvT = 0;   // when the reverb environment was last re-probed
  volume = { ...VOLUME_DEFAULTS };
  started = false; enabled = true;
  /** told of every sound asked for (the replay's sound lanes: src/replay/soundlanes.ts); null = nobody listens, nothing is built */
  tap: ((a: SoundAsk) => void) | null = null;
  /** per sound name, what plays in its place / how (the replay page's picks); empty = the table as loaded */
  trims = new Map<string, SoundTrim>();
  private ambience: { pos: Vec3; v: BackendVoice; base: number; radius: number; f0: number }[] = [];   // f0 = the source's own low-pass (its timbre), the ceiling for the occlusion filter
  /** voices = alive now · maxVoices = the most alive at once since start · culled = positional one-shots not played (inaudible, or quieter than a full budget) · stolen = quietest
   *  voices stopped to make room · hrtf / equalpower = positional one-shots by the panner they got · occluded / routed = propagation outcomes · wet = the reverb send now */
  stats = { voices: 0, maxVoices: 0, culled: 0, stolen: 0, hrtf: 0, equalpower: 0, occluded: 0, routed: 0, wet: 0 };

  /** col.sound (propagation), col.raycast (reverb sizing) see walls, props and door leaves; `makeBackend` = the host's graph (default: Web Audio off the page's AudioContext) */
  constructor(private col: StaticCollision, private makeBackend: (volume: { master: number; sfx: number; ambience: number }) => AudioBackend | null = v => WebAudioBackend.create(v)) {}

  /** Must be called from a user-gesture handler. */
  start() {
    if (this.started) { (this.backend as { resume?: () => void } | null)?.resume?.(); return; }   // a context created without a qualifying gesture starts suspended: retry on the next gesture
    const b = this.makeBackend(this.volume); if (!b) return;
    this.backend = b; this.started = true;
    // a hidden tab draws no frame, so nobody would turn a followed voice down as its thing comes to rest: it is silent until the page is back
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) for (const v of this.voices) if (v.follow && !v.dying) b.setVoice(v.v, { gain: 0 }, 0.05); });
    try { localStorage.setItem(SFX_WARM.rateKey, String(b.sfxContext.sampleRate)); } catch { /* no store: the next page guesses SFX_WARM.rate */ }
    if (SFX_WARM.on && !SFX_TABLE.was && !warm.sink) {   // the table a voice at a time (SFX_WARM): what is made already goes in now, the rest as it is made or asked for
      if (warm.later && warm.rate !== b.sfxContext.sampleRate) { warm.later = null; warm.made.clear(); }   // (made for another rate than this device's: not what it would play)
      if (!warm.later && !warm.made.size) { warm.rate = b.sfxContext.sampleRate; warm.later = gameSfxLater(b.sfxContext); }
      for (const [n, buf] of warm.made) b.loadBuffer(n, buf);
      warm.made.clear(); warm.sink = (n, buf) => b.loadBuffer(n, buf); warmPump();
    } else {
      const sfx = gameSfx(b.sfxContext);
      for (const n of Object.keys(sfx) as SfxName[]) b.loadBuffer(n, sfx[n]);
    }
    { const mb = b.webAudio ? new WebAudioMusicBackend(b.webAudio.ctx, b.webAudio.master) : b.music?.() ?? null; if (mb) { this.music = new Music(mb); this.music.menu = this.menuUp; this.music.setlist = this.levelSet; this.music.setVolume(this.volume.music); } }   // the score: its sequencer over the page's Web Audio voices, or the backend's own MusicBackend (the native synth) — silent on a host with neither
    this.setupAmbience();
  }

  /** another take of `name` under an id of its own (`name@take`), for a trim to point at; '' before the mixer has started */
  loadTake(name: string, take: string, buf: SfxBuffer): string {
    const b = this.backend; if (!b) return '';
    const id = `${name}@${take}`; b.loadBuffer(id, buf); return id;
  }

  setListener(pos: Vec3, camForward: Vec3) {
    this.listener = v3.copy(pos); this.camFwd = v3.normalize([camForward[0], 0, camForward[2]]);
    this.backend?.setListener(pos, this.camFwd);
  }

  play(name: string, pos: Vec3 | null, gain = 1, opts: Record<string, unknown> = {}) {
    const b = this.backend, tap = this.tap;
    if (b && (this.enabled || tap)) warmOne(name);   // (SFX_WARM: a voice asked for before its turn is made now — where it will be played, or its length told)
    if (!b || !this.enabled) {   // (the mixer is off: the lanes are still told what was asked for — of a name the table holds, where there is a table to ask, as below)
      if (tap) { const dur = name === 'smokeHiss' ? (opts.duration as number) ?? 15 : b ? b.duration(name) : 0; if (!b || dur) tap({ name, gain, dur, heard: 0 }); }
      return;
    }
    if (name === 'smokeHiss') { const secs = (opts.duration as number) ?? 15; this.hiss(pos ?? this.listener, secs); tap?.({ name, gain, dur: secs, heard: 2 }); return; }   // a synthesized loop, not a table entry — must be checked before the lookup below
    if (typeof opts.follow === 'function') { this.follow(name, pos ?? this.listener, gain, opts.follow as FollowSrc, opts.rate as number | undefined); return; }
    const trim = this.trims.size ? this.trims.get(name) : undefined;
    const buffer = trim?.take && b.duration(trim.take) ? trim.take : name;
    const dur = b.duration(buffer); if (!dur) return;
    const t = b.now();
    let rate = (opts.rate as number) ?? (0.96 + sysRandom() * 0.08);   // (drawn before any cull below, so a sound culled or not leaves Math.random where it always did)
    const filter = trim?.tone ? { type: 'lowpass' as const, freq: trim.tone } : undefined;
    const gain0 = gain, rate0 = rate;   // (as asked, before the page's trim: what `SoundAsk.mix` carries)
    if (trim) { rate *= trim.rate ?? 1; gain *= trim.gain ?? 1; }
    const ask: SoundAsk | null = tap ? { name, gain, dur: dur / rate, heard: 1 } : null;
    const told = (heard: 0 | 1 | 2) => { if (ask) { ask.heard = heard; tap!(ask); } };
    let v: Voice;
    if (pos) {
      // propagation FIRST — straight through air (partial occlusion from side rays softens doorway edges), or, when walled off, around the corners along the walkable
      // space: it then appears to come out of the doorway/bend, at the path's length, muffled a little (a lot if a closed door sits across that doorway); sealed off →
      // through the mass — because what it says decides whether the sound is worth a voice at all (the budget above)
      const prop = this.col.sound.propagate(pos, this.listener); const at = prop.apparent, occ = prop.muffle;
      const d = v3.dist(at, this.listener);
      const level = occludedGain(gain, occ) * distanceGain(d);   // what reaches the ear: the gain the graph applies × the panner's inverse-distance law at the apparent position
      if ((trim ? occludedGain(gain0, occ) * distanceGain(d) : level) < CULL_LEVEL) { this.stats.culled++; told(1); return; }   // (judged as ASKED: a level dial turned down on a replay page still leaves the lanes a voice to hear again)                                                             // inaudible under the mix: no voice
      let alive = 0, quiet: Voice | null = null;
      for (const w of this.voices) if (w.positional && !w.loop && !w.dying && t <= w.end) { alive++; if (!quiet || (w.level ?? 1) < (quiet.level ?? 1)) quiet = w; }
      if (alive >= MAX_POSITIONAL) {
        if (!quiet || (quiet.level ?? 1) >= level) { this.stats.culled++; told(1); return; }                                          // the budget is full of louder sounds: this one would not be missed
        b.stop(quiet.v, 12); quiet.end = t + 0.08; quiet.dying = true; this.stats.stolen++;   // else the quietest goes — a 12 ms fade, not a click; out of the budget this instant, retired by update() once stopped — and this one plays
      }
      if (prop.routed) this.stats.routed++; if (occ > 0.5) this.stats.occluded++;
      const near = hrtfFor(prop.pathLen, level);   // HRTF where it can be heard AS a place — near, or loud; the far and faint take the cheap panner
      if (near) this.stats.hrtf++; else this.stats.equalpower++;
      // the graph: [occlusion low-pass] → panner at the APPARENT position → gain → the sfx bus, + a reverb send: more when muffled / routed (you hear the room, not the source) and with distance travelled
      const bv = b.play({ buffer, pos: at, gain: occludedGain(gain, occ), rate, bus: 'sfx', filter, hrtf: near, distance: { ref: REF_DIST, rolloff: ROLLOFF, max: MAX_DIST }, cutoffHz: cutoffOf(occ), send: sendOf(occ, prop.pathLen) });   // (revSend's own gain already carries how live the room is)
      if (!bv) { told(1); return; }
      v = { v: bv, positional: true, pos: v3.copy(pos), end: t + dur / rate + 0.1, level };
      if (ask) { const L = this.listener, f = this.camFwd, dx = at[0] - L[0], dz = at[2] - L[2];
        ask.mix = { rel: [dz * f[0] - dx * f[2], at[1] - L[1], dx * f[0] + dz * f[2]], gain: occludedGain(gain0, occ), rate: rate0, cut: cutoffOf(occ), send: sendOf(occ, prop.pathLen), hrtf: near }; }
    } else {
      // non-positional (stings, UI, thunder): optionally low-passed (opts.lowpass, Hz — thunder dulls with distance), leaned to a side (opts.pan −1‥1 — toward
      // the storm cell's bearing) and given some room (opts.wet 0‥1); with none of them it is the plain src → gain → bus it always was
      const bv = b.play({ buffer, pos: null, gain, rate, bus: 'sfx', filter, cutoffHz: typeof opts.lowpass === 'number' ? opts.lowpass : undefined, cutoffQ: typeof opts.lowpass === 'number' ? 0.5 : undefined,
        pan: typeof opts.pan === 'number' ? opts.pan : undefined, send: typeof opts.wet === 'number' && opts.wet > 0 ? opts.wet : undefined });
      if (!bv) { told(1); return; }
      v = { v: bv, positional: false, end: t + dur / rate + 0.1 };
      if (ask) ask.mix = { gain: gain0, rate: rate0, cut: typeof opts.lowpass === 'number' ? opts.lowpass : undefined, pan: typeof opts.pan === 'number' ? opts.pan : undefined, send: typeof opts.wet === 'number' && opts.wet > 0 ? opts.wet : undefined };
    }
    this.voices.push(v);
    if (this.voices.length > this.stats.maxVoices) this.stats.maxVoices = this.voices.length;
    told(2);
  }

  /** One voice the lanes kept (`SoundAsk.mix`), played once more as it was mixed then — the same place from the listener, as muffled, as far — under what the page
   *  lays over that sound NOW (`trims`: the take, pitch, tone, level). The replay page's "hear that again": it asks nothing of the level, tells no tap, draws no die,
   *  takes no place in the positional budget, and plays whether the mixer is switched on or not (`enabled`). False = nothing was played. */
  again(name: string, m: SoundMix): boolean {
    const b = this.backend; if (!b) return false;
    warmOne(name);
    const trim = this.trims.get(name);
    const buffer = trim?.take && b.duration(trim.take) ? trim.take : name;
    const dur = b.duration(buffer); if (!dur) return false;
    const rate = m.rate * (trim?.rate ?? 1), gain = m.gain * (trim?.gain ?? 1);
    const filter = trim?.tone ? { type: 'lowpass' as const, freq: trim.tone } : undefined;
    let bv: BackendVoice | null;
    if (m.rel) { const L = this.listener, f = this.camFwd, [r, u, a] = m.rel;
      bv = b.play({ buffer, pos: [L[0] - f[2] * r + f[0] * a, L[1] + u, L[2] + f[0] * r + f[2] * a], gain, rate, bus: 'sfx', filter, hrtf: m.hrtf, distance: { ref: REF_DIST, rolloff: ROLLOFF, max: MAX_DIST }, cutoffHz: m.cut, send: m.send });
    } else bv = b.play({ buffer, pos: null, gain, rate, bus: 'sfx', filter, cutoffHz: m.cut, cutoffQ: m.cut !== undefined ? 0.5 : undefined, pan: m.pan, send: m.send });
    if (!bv) return false;
    this.voices.push({ v: bv, positional: false, again: true, end: b.now() + dur / rate + 0.1 });   // (not `positional`: never counted in play()'s budget nor stolen by it)
    return true;
  }
  /** every voice that is not a loop, faded out now (the lanes' re-listen starting over or being called off); `again` = only the voices `again()` made (the tape
   *  plays on under a stretch still ringing: its own new voices stay). A voice is let go only once the fade has run out: the backend's stop is a time constant. */
  hush(ms = 30, again = false) { const b = this.backend; if (!b) return; const t = b.now(); for (const v of this.voices) if (!v.loop && !v.dying && t <= v.end && (!again || v.again)) { b.stop(v.v, ms); v.end = t + 5 * ms / 1000 + 0.02; v.dying = true; } }

  /** The rain bed (weather.ts calls this every frame with the level it wants, 0 = off): a loop of noise shaped into the hiss of rain on asphalt over the drum of it on
   *  the roof and the cars, built by the backend on first use, its gain eased toward `level` × its own ceiling on the ambience bus (src/audio/webaudio.ts rainLevel). */
  rain(level: number) { this.backend?.rainLevel(level); }

  /** One footfall. The floor it lands on comes from the shared material map (game/floor.ts — the same map the guards' ears and the SOUND meter read; `mat` arrives
   *  resolved by the caller, floor.ts tread, so the mixer cannot disagree with them): hard finishes get the heel click, carpet and grass the soft scuff, and the
   *  sample runs a touch brighter on stone / duller on carpet. `loudness` already carries the material's share (carpet 0.6 ×, stone 1.1 × …), so it goes straight to the gain. */
  footstep(pos: Vec3, loudness: number, isPlayer: boolean, mat: FloorMat = floorAt(pos)) {
    const f = FLOOR[mat];
    this.play(f.hard ? 'footHard' : 'footSoft', pos, (isPlayer ? 0.55 : 0.7) * loudness, { rate: (0.9 + sysRandom() * 0.25) * f.rate });
  }

  /** A followed voice let go: faded out, kept in the list (and in the cap's count) until the fade is done. */
  private unfollow(v: Voice, t: number) { this.backend!.stop(v.v, FOLLOW_FADE_MS); v.dying = true; v.end = Math.min(v.end, t + 6 * FOLLOW_FADE_MS / 1000); }
  /** A sound that lasts as long as its thing does (a chair rolling on its castors: game.ts rollTick): ONE looping voice, started at the buffer's head and then held on
   *  the buffer's loop stretch. `update()` asks `src` every frame for the thing's place and how hard it goes: level and pitch follow per frame, the panner and the
   *  low-pass with the other loops' (four times a second; its reverb send is the start's), and it is faded out when `src` answers null. Outside the one-shots' budget:
   *  at most MAX_FOLLOW alive (a nearer newcomer takes the farthest one's place, any other is not voiced) and two more still fading. It cannot run on: stopped when
   *  its time is up, silent while the page is hidden, and its source carries a hard end of its own. Told to the tap ONCE, at its start, with the mix it started
   *  under — so a lane's 'again' plays the buffer through once, which is why the buffer comes up and dies away at its ends. */
  private follow(name: string, pos: Vec3, gain: number, src: FollowSrc, rate0?: number) {
    const b = this.backend!, tap = this.tap, t = b.now();
    const trim = this.trims.size ? this.trims.get(name) : undefined;
    const buffer = trim?.take && b.duration(trim.take) ? trim.take : name;
    const dur = b.duration(buffer); if (!dur) return;
    const rate = rate0 ?? (0.96 + sysRandom() * 0.08);
    // the cap counts the voices still fading out too (a churn of starts and ends is bounded), and a full house gives its FARTHEST voice to a nearer newcomer
    let alive = 0, all = 0, far: Voice | null = null, farD = -1;
    for (const w of this.voices) if (w.follow) { all++; if (!w.dying) { alive++; const d = v3.dist(w.pos!, this.listener); if (d > farD) { farD = d; far = w; } } }
    const s = src(), full = alive >= MAX_FOLLOW;
    if (full && far && all < MAX_FOLLOW + 2 && s && v3.dist(pos, this.listener) < farD) this.unfollow(far, t);
    else if (full || all >= MAX_FOLLOW + 2 || !s) { this.stats.culled++; tap?.({ name, gain, dur: dur / rate, heard: 1 }); return; }
    const prop = this.col.sound.propagate(pos, this.listener), at = prop.apparent, occ = prop.muffle;
    const lp = FOLLOW_LOOPS[name], near = hrtfFor(prop.pathLen, occludedGain(gain, occ) * distanceGain(v3.dist(at, this.listener)));
    const bv = b.play({ buffer, pos: at, gain: 0, rate: rate * (trim?.rate ?? 1) * followRate(s.k), loop: true, loopAt: lp && dur >= lp.end ? lp : undefined, maxSecs: FOLLOW_SECS + 2, bus: 'sfx', hrtf: near,
      filter: trim?.tone ? { type: 'lowpass', freq: trim.tone } : undefined, distance: { ref: REF_DIST, rolloff: ROLLOFF, max: MAX_DIST }, cutoffHz: cutoffOf(occ), send: sendOf(occ, prop.pathLen) });
    if (!bv) { tap?.({ name, gain, dur: dur / rate, heard: 1 }); return; }
    this.voices.push({ v: bv, positional: true, pos: v3.copy(pos), end: t + FOLLOW_SECS, loop: true, follow: { src, name, gain, rate, occ, lastT: s.t, seen: t } });
    if (this.voices.length > this.stats.maxVoices) this.stats.maxVoices = this.voices.length;
    if (tap) { const L = this.listener, f = this.camFwd, dx = at[0] - L[0], dz = at[2] - L[2];
      tap({ name, gain, dur: dur / rate, heard: 2, mix: { rel: [dz * f[0] - dx * f[2], at[1] - L[1], dx * f[0] + dz * f[2]], gain: occludedGain(gain, occ), rate, cut: cutoffOf(occ), send: sendOf(occ, prop.pathLen), hrtf: near } }); }
  }

  private hiss(pos: Vec3, duration: number) {
    const b = this.backend!; const t = b.now();
    b.loadBuffer('smokeHissNoise', noiseBuffer(b.sfxContext, HISS.seconds));   // (a fresh 2 s noise loop per hiss, as ever)
    const bv = b.play({ buffer: 'smokeHissNoise', pos: [pos[0], pos[1] + 0.1, pos[2]], gain: 0, rate: 1, loop: true, bus: 'sfx', distance: HISS.distance,
      filter: HISS.filter, cutoffHz: 20000, envelope: { peak: HISS.peak, rise: HISS.rise, hold: Math.max(0.5, duration - HISS.tail), end: duration } });   // band → occlusion low-pass (retuned in update) → HRTF panner → the envelope
    this.play('smokePop', pos, HISS.pop);
    if (bv) this.voices.push({ v: bv, positional: true, pos: v3.copy(pos), end: t + duration + 0.2, loop: true });
  }

  private setupAmbience() {
    const b = this.backend!; const sc = b.sfxContext;
    const mk = (pos: Vec3, kind: AmbienceKind, base: number, radius: number) => {
      const id = `amb:${kind}:${this.ambience.length}`;
      const { buffer, filter, wobble } = ambienceLoop(sc, kind);   // (audio/loops.ts: what each hum is made of — the listening page plays the same)
      b.loadBuffer(id, buffer);
      const v = b.play({ buffer: id, pos, gain: 0, rate: 1, loop: true, bus: 'ambience', distance: AMBIENCE_DISTANCE, filter, wobble });
      if (v) this.ambience.push({ pos, v, base, radius, f0: filter.freq });
    };
    for (const e of AMBIENCE_OFFICE) mk(e.pos, e.kind, e.base, e.radius);
  }

  /** Per-frame housekeeping: retire voices, refresh occlusion on loops/ambience, size the reverb by tracing around the listener. */
  update(dt: number, time: number) {
    const b = this.backend; if (!b) return;
    const t = b.now();
    this.voices = this.voices.filter(v => { if (t > v.end) { if (v.follow && !v.dying) b.stop(v.v, 20); b.release(v.v); return false; } return true; });   // (a followed loop that outlives its time — a tab hidden for a minute — is STOPPED, not just let go of: a looping source runs on)
    this.stats.voices = this.voices.length;
    // followed voices (a rolling chair), every frame: where the thing is now and how hard it goes → the voice's level and pitch; stopped, gone, or held too long → faded
    // out and let go; the game's clock standing still (a pause) → silent until it runs again. (Its panner and low-pass are re-aimed with the other loops', below.)
    for (const v of this.voices) { const f = v.follow; if (!f || v.dying) continue;
      const s = t > v.end - 1 ? null : f.src();
      if (!s) { this.unfollow(v, t); continue; }
      if (s.t !== f.lastT) { f.lastT = s.t; f.seen = t; }
      const vp = v.pos!; vp[0] = s.pos[0]; vp[1] = s.pos[1]; vp[2] = s.pos[2];
      const trim = this.trims.size ? this.trims.get(f.name) : undefined;
      b.setVoice(v.v, { gain: t - f.seen > 0.2 ? 0 : occludedGain(f.gain * (trim?.gain ?? 1), f.occ) * followGain(s.k), rate: f.rate * (trim?.rate ?? 1) * followRate(s.k) }, 0.07);
    }
    // environment probe (4×/s): mean free path around the listener → reverb amount; outdoor → less
    if (time - this.lastEnvT > 0.25 || this.lastEnvT === 0) {
      let sum = 0; const N = 10;
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const hit = this.col.raycast(this.listener, [Math.cos(a), 0, Math.sin(a)], 16); sum += hit ? hit.t : 16; }
      const mfp = sum / N; const outdoors = this.listener[0] < 4 || this.listener[0] > 36 || this.listener[2] < 4 || this.listener[2] > 24;
      const wet = outdoors ? 0.08 : Math.min(0.55, 0.12 + mfp * 0.045);
      b.setReverb(wet, 0.3); this.stats.wet = wet;
      this.lastEnvT = time || 1e-3;
      // loops (canister hiss) + ambience go through the same propagation as one-shots: re-aim the panner at the apparent position, retune the low-pass
      for (const v of this.voices) if (v.loop && v.pos && v.positional && !v.dying) { const pr = this.col.sound.propagate(v.pos, this.listener); b.setVoice(v.v, { pos: pr.apparent }, 0.25); b.setVoice(v.v, { cutoffHz: cutoffOf(pr.muffle) }, 0.2); if (v.follow) v.follow.occ = pr.muffle; }
      for (const a of this.ambience) {
        const d = v3.dist(a.pos, this.listener); let g = a.base * Math.max(0, 1 - d / a.radius);
        if (g > 0.01) { const pr = this.col.sound.propagate(a.pos, this.listener); g *= 1 - 0.6 * pr.muffle; b.setVoice(a.v, { pos: pr.apparent, cutoffHz: Math.min(a.f0, 300 + cutoffOf(pr.muffle)) }, 0.4); }   // (BiquadFilter.frequency.defaultValue is the spec's 350 Hz, not what we set — clamp against the authored f0)
        b.setVoice(a.v, { gain: g }, 0.5);
      }
    }
    void dt;
  }

  setVolumes() {
    const b = this.backend; if (!b) return;
    b.setBus('master', this.enabled ? this.volume.master : 0, 0.1);
    b.setBus('sfx', this.volume.sfx, 0.1); b.setBus('ambience', this.volume.ambience, 0.1);
    this.music?.setVolume(this.volume.music);
  }
}
