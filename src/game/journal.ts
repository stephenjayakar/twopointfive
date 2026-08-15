// The SESSION JOURNAL (the designer, 08-13: "could we make a record mode that journals all of the reads from the GPU for replay later? then we could have those
// scenarios for a strict mode QA of the deterministic stuff"). The simulation is deterministic GIVEN ITS INPUTS; this files the inputs. A recording is:
//
//   frame 0   a CHECKPOINT (savestate.ts saveState, kind 'harness') of the moment F10 went down — and the running game re-entered through loadState on the spot,
//             so the recorded game and any replay start from the same bytes by the same road (the checkpoints' identity claim, probes.ts checkpoint-identity:
//             load-into-the-same-game ≡ load-into-a-fresh-game); smoke in the air is dropped as on any load, a conversation is cut short, a searcher re-deals;
//   seed      Math.random ← mulberry32(seed) from that frame to the stop (the game's dice: barks, spread, reaction jitter — math/dice.ts simDie); the mixer and
//             the smoke solver draw the SYSTEM die (dice.ts sysRandom) so nothing but the simulation takes from the seeded stream — headless there is neither;
//   env       what the simulation reads off the ENGINE rather than the Game (the debris cap of the quality tier, the emissive scale, the torch bezel radius, whether
//             GPU particles are attached, the marking lights, the canister row) and the construction-time dice a checkpoint does not hold (the fixtures' restrike
//             stagger) — a replay stands its engine stand-in up to match;
//   knobs     Game.tune, the sandbox flags and every module knob table (AIM, NEEDS, WHISTLE …: kept per machine, so the designer's are not the harness's);
//   per frame dt exactly as Game.update got it · the canvas size · the CAMERA as the update read it (look-at, yaw, pitch, distance, aspect, fov: an input like the
//             mouse — the aim ray, WASD's basis, who is 'on screen' for a bubble all hang on it — so a follow-camera tweak invalidates no recording) · the input
//             (keys held, keys pressed, buttons, clicks, cursor, wheel) · every SENSOR value delivered (sensors.ts: the light meters, the smoke sight lines — the
//             GPU's part, journaled as consumed) — each stream delta-coded, so a still scene costs a dt a frame;
//   digests   digestGame (digest.ts) after every JOURNAL_DIGEST_EVERY-th update and after the last: a replay compares its own and names the field that differs.
//
// tools/qa/replay.ts plays a file back on the headless harness (fresh Game → loadState → seed → the frames fed through the synthetic input path with the sensors in
// replay mode) and exits 0 only if every digest agreed and no sensor read diverged: a REFACTOR must replay every session in tools/qa/sessions/ identically; an
// intended gameplay change is expected to diverge (re-record). This module is UI-free (main.ts owns F10, the HUD tag and the download: ui/sessionrec.ts); the
// recorder runs headless too (tools/qa/journal-probes.ts records its own fixture).
//
// NOT captured, by decision: the Tab panel's live edits mid-recording (hands off it while REC is up), module tables not in KNOB_TABLES, a level other than the
// one the replay builds (the file's fingerprint refuses it), the smoke solver's CPU-side facts (inSmokeDomain / budget — read only to decide whether to emit MORE
// smoke, never by the simulation), a lightning stroke's light alive across frame 0 (a fifth of a second, once a storm-minute).
import type { Game } from './game';
import type { Input } from './input';
import type { FollowCamera } from './camera';
import { saveState, loadState, canSave, levelFingerprint, CKPT } from './savestate';
import type { SaveState } from './savestate';
import type { SensorJournal } from './sensors';
import { digestGame } from './digest';
import { simDie } from '../math/dice';
import type { SimDie } from '../math/dice';
import type { GameDigest } from './digest';
import { AIM, TRAINED } from './aim';
import { AI_TUNE, BODY_LIGHT, GUARD_EYE } from './guards';
import { NEEDS } from './needs';
import { WHISTLE } from './whistle';
import { WET } from './wet';
import { WIND } from './wind';
import { CIV } from './civilians';
import { CHAOS } from './destruction';
import { RING } from './launcher';
import { LAUNCHER } from './weapons';
import { GLASS } from './glass';
import { GLASSBREAK } from './glassbreak';
import { TALK_TUNE } from './dialogue';
import { HOLD } from './character';
import { SUPPRESSION } from './suppression';
import { RIFLE_SPREAD } from './player';
import { OVERHEAR } from './devices';
import { SCORE, BADGE } from './chronicle';

export const JOURNAL_VERSION = 1;
/** a digest after every this-many-th update (and after the last) */
export const JOURNAL_DIGEST_EVERY = 120;
/** a recording asked for while it cannot start (Sam mid-action, a can in the air, a body falling) waits this many frames for the moment, then gives up with the reason */
export const JOURNAL_PENDING_FRAMES = 60 * 8;
/** the longest recording (frames): twenty minutes at sixty */
export const JOURNAL_MAX_FRAMES = 60 * 60 * 20;

/** the module knob tables a recording carries and a replay applies (kept per machine or flipped on the panel: the designer's values are not the harness's) */
/** the knob tables a recording captures — LAZY: journal.ts sits on the game.ts ↔ guards.ts import cycle, and the browser bundle hoists module bindings, so an eager object
 *  literal here captured `undefined` for tables whose module had not initialised yet (the recorder threw on its first page frame; headless import order hid it) */
export function knobTables(): Record<string, object> {
  const all: Record<string, object | undefined> = { AIM, TRAINED, AI_TUNE, BODY_LIGHT, GUARD_EYE, NEEDS, WHISTLE, WET, WIND, CIV, CHAOS, RING, LAUNCHER, GLASS, GLASSBREAK, TALK_TUNE, HOLD, SUPPRESSION, RIFLE_SPREAD, OVERHEAR, SCORE, BADGE, CKPT };   // (GLASSBREAK: rounds, sound and men pass through its holes — gameplay; the dust table is presentation and stays out)
  const out: Record<string, object> = {}; for (const [k, T] of Object.entries(all)) if (T && typeof T === 'object') out[k] = T; return out;
}

// ================================================================================================================================ the file
/** one frame's input as filed: k = the keys held (the whole set, only when it changed), p = keys pressed this frame, c = mouse buttons clicked this frame (bits),
 *  b = buttons held (on change), m = the cursor in CSS px (on change), w = wheel travel (when non-zero) — absent = unchanged (k / b / m) or nothing (p / c / w) */
export interface InputRec { k?: string[]; p?: string[]; c?: number; b?: number; m?: [number, number]; w?: number; }
/** the engine-side facts the simulation reads (see the head) + the fixtures' restrike stagger by target name */
export interface EnvSnap { debrisCap: number; emissiveScale: number; flashlightRadius: number; markings: boolean; particlesOn: boolean;
  /** recorded under the game page's HUD (main.ts): its speech bubbles null an expired `bubble` after each update (hudExpireBubbles) — a replay of such a file does the same; a headless recording has no HUD */
  hud: boolean;
  canister: { canisterDuration: number; canisterDensity: number; canisterRadius: number; canisterTemp: number; canisterSpeed: number } | null; stagger: Record<string, number>; }
export interface KnobsSnap { tune: Record<string, unknown>; flags: { godMode: boolean; aiEnabled: boolean; infiniteAmmo: boolean; playerInvisible: boolean; fn2000: boolean; autosave: boolean }; tables: Record<string, unknown>; }
/** the whole session (JSON): see the head for what each block is */
export interface SessionFile {
  v: number; game: 'twopointsix'; recordedAt: string; commit?: string; note?: string;
  seed: number; level: SaveState['level']; save: SaveState; env: EnvSnap; knobs: KnobsSnap;
  frames: number;
  /** dt per frame, run-length coded: [count, dt] pairs */
  dt: [number, number][];
  /** the canvas: [f, clientWidth, clientHeight, width, height] on change */
  view: number[][];
  /** the camera as Game.update read it: [f, mask, values…] on change — mask bits 0‥7 = look-at x / y / z, yaw, pitch, distance, aspect, fov */
  cam: number[][];
  /** [f, InputRec] for every frame on which anything was pressed / clicked / moved / changed */
  input: [number, InputRec][];
  sensors: SensorJournal;
  /** [f, digest] after the update of frame f */
  digests: [number, GameDigest][];
  meta: { seconds: number; stopped: string; bytesPerFrame?: number; userAgent?: string };
}
export type JournalState = 'idle' | 'pending' | 'recording';
type View = { clientWidth: number; clientHeight: number; width: number; height: number };

// ================================================================================================================================ env / knobs (both directions)
export function envSnapshot(g: Game): EnvSnap {
  const S = g.engine.settings as unknown as Record<string, unknown>; const num = (k: string, d: number) => typeof S[k] === 'number' && Number.isFinite(S[k] as number) ? S[k] as number : d;
  const E = g.engine as unknown as { particles?: unknown; settings: { gpuParticles?: boolean } };
  const P = (g.smoke as { params?: Record<string, number> }).params;
  const stagger: Record<string, number> = {}; for (const t of g.targets) stagger[t.name] = t.stagger;
  return { debrisCap: num('debrisCap', 64), emissiveScale: num('emissiveScale', 1), flashlightRadius: num('flashlightRadius', 0.07), markings: S.markings !== false, particlesOn: !!(E.particles && E.settings.gpuParticles), hud: false,
    canister: P ? { canisterDuration: P.canisterDuration, canisterDensity: P.canisterDensity, canisterRadius: P.canisterRadius, canisterTemp: P.canisterTemp, canisterSpeed: P.canisterSpeed } : null, stagger };
}
/** the settings half of an env, onto an engine's settings BEFORE the Game is built on it (the marking lights are registered in the constructor) */
export function applyEnvSettings(settings: Record<string, unknown>, env: EnvSnap): void { settings.debrisCap = env.debrisCap; settings.emissiveScale = env.emissiveScale; settings.flashlightRadius = env.flashlightRadius; settings.markings = env.markings; }
/** the game half of an env, AFTER the checkpoint is loaded: the fixtures' restrike stagger */
export function applyEnvGame(g: Game, env: EnvSnap): void { for (const t of g.targets) { const s = env.stagger[t.name]; if (typeof s === 'number' && Number.isFinite(s)) t.stagger = s; } }
export function knobsSnapshot(g: Game): KnobsSnap {
  const tables: Record<string, unknown> = {}; for (const [k, T] of Object.entries(knobTables())) tables[k] = JSON.parse(JSON.stringify(T));
  return { tune: JSON.parse(JSON.stringify(g.tune)), flags: { godMode: g.godMode, aiEnabled: g.aiEnabled, infiniteAmmo: g.infiniteAmmo, playerInvisible: g.playerInvisible, fn2000: g.fn2000, autosave: !!g.saves?.enabled }, tables };   // (autosave: the controller writes chronicle rows — state, even if the digest leaves them out)
}
export function applyKnobs(g: Game, k: KnobsSnap): void {
  assignDeep(g.tune as unknown as Record<string, unknown>, k.tune);
  g.godMode = !!k.flags.godMode; g.aiEnabled = k.flags.aiEnabled !== false; g.infiniteAmmo = !!k.flags.infiniteAmmo; g.playerInvisible = !!k.flags.playerInvisible; if (typeof k.flags.fn2000 === 'boolean' && g.fn2000 !== k.flags.fn2000) g.setLoadout(k.flags.fn2000);
  if (g.saves && typeof k.flags.autosave === 'boolean') g.saves.enabled = k.flags.autosave;   // (the field, not setEnabled: nothing to persist on a replay's machine)
  for (const [name, T] of Object.entries(knobTables())) { const src = k.tables[name]; if (src && typeof src === 'object') assignDeep(T as Record<string, unknown>, src as Record<string, unknown>); }
}
/** dst ← src over the keys dst already has, type for type (an object recursed into, a number / boolean / string / array copied): a knob renamed since the recording is let be */
function assignDeep(dst: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const k of Object.keys(src)) {
    if (!(k in dst)) continue; const a = dst[k], b = src[k];
    if (a !== null && typeof a === 'object' && !Array.isArray(a) && b !== null && typeof b === 'object' && !Array.isArray(b)) assignDeep(a as Record<string, unknown>, b as Record<string, unknown>);
    else if (typeof a === typeof b || a === null) dst[k] = b !== null && typeof b === 'object' ? JSON.parse(JSON.stringify(b)) : b;
  }
}

// ================================================================================================================================ RECORD
export interface RecordOpts { seed?: number; note?: string; commit?: string; userAgent?: string; /** the page's HUD runs over this game (see EnvSnap.hud) */ hud?: boolean; }
/** The recorder the Game owns (`g.journal`). request() → 'pending'; the top of the next Game.update that may (canSave, no flash light in the set) takes the
 *  checkpoint, re-enters it, seeds the dice, puts the sensors into record and files frame 0; every update after is a frame until stop() hands back the file. */
export class SessionRecorder {
  state: JournalState = 'idle';
  /** pending: why it has not started yet; idle after a give-up / a stop: why */
  why = '';
  frame = 0;
  private opts: RecordOpts = {}; private pendingLeft = 0;
  private save: SaveState | null = null; private env: EnvSnap | null = null; private knobs: KnobsSnap | null = null; private seed = 0; private t0 = 0; private startedAt = '';
  private die: SimDie | null = null;
  private dts: [number, number][] = []; private views: number[][] = []; private cams: number[][] = []; private inputs: [number, InputRec][] = []; private digests: [number, GameDigest][] = [];
  private lastView = [NaN, NaN, NaN, NaN]; private lastCam = new Array<number>(8).fill(NaN); private lastKeys = '\n'; private lastButtons = NaN; private lastMouse = [NaN, NaN];
  private inUpdate = false;
  /** a running estimate of the streams' JSON size (the HUD's byte count; the sensors keep their own) */
  private bytes = 0;
  /** a stop asked for between frames: taken at the end of the next update, where the closing digest is the state a replay will compare (see stop) */
  private stopAfterNext: string | null = null;
  /** the last file made (stop) — kept for the console / a re-download */
  last: SessionFile | null = null;
  /** called when a recording stops for any reason with the file (main.ts downloads it), or with null and the reason when a pending request gave up */
  onStop: ((f: SessionFile | null, why: string) => void) | null = null;
  constructor(private g: Game) {}

  get recording() { return this.state === 'recording'; }
  get stopping() { return this.stopAfterNext !== null; }
  /** ask for a recording: it starts at the top of the next update that may (see canStart); false if one is already asked for / under way */
  request(opts: RecordOpts = {}): boolean { if (this.state !== 'idle') { return false; } this.opts = opts; this.state = 'pending'; this.pendingLeft = JOURNAL_PENDING_FRAMES; this.why = canStart(this.g) ?? ''; return true; }
  /** Give up a pending request / stop a recording. Between frames (F10 arrives before the frame's update) the stop is DEFERRED to the end of the next update and
   *  the file arrives through onStop then — the closing digest must be the state straight after an update, which is what a replay compares (the HUD nulls an
   *  expired speech bubble after the update, for one); `immediate` finalises now, for a caller that knows nothing has touched the game since the last update
   *  (the headless recorder), or a second F10 that will not wait. Returns the file when it was made here and now. */
  stop(why = 'stopped', immediate = false): SessionFile | null {
    if (this.state === 'pending') { this.state = 'idle'; this.why = why; return null; }
    if (this.state !== 'recording') return null;
    if (!immediate && !this.inUpdate) { this.stopAfterNext ??= why; return null; }
    return this.finish(why);
  }
  private finish(why: string): SessionFile {
    const g = this.g; this.stopAfterNext = null;
    if (this.inUpdate) { g.sensors.endFrame(); this.frame++; this.inUpdate = false; }   // (stopped from inside a frame — a hook, the cap: that frame is in the file whole)
    if (!this.digests.length || this.digests[this.digests.length - 1][0] !== this.frame - 1) this.digests.push([this.frame - 1, digestGame(g, true)]);
    const sensors = g.sensors.journal(); g.sensors.live();
    if (this.die) { if (Math.random === this.die && this.die.sys) Math.random = this.die.sys; this.die = null; }   // (the die it displaced goes back — unless somebody has since put their own in, which stays)
    const seconds = this.dts.reduce((s, [n, dt]) => s + n * dt, 0);
    const file: SessionFile = { v: JOURNAL_VERSION, game: 'twopointsix', recordedAt: this.startedAt, commit: this.opts.commit, note: this.opts.note, seed: this.seed, level: levelFingerprint(g), save: this.save!, env: this.env!, knobs: this.knobs!,
      frames: this.frame, dt: this.dts, view: this.views, cam: this.cams, input: this.inputs, sensors, digests: this.digests, meta: { seconds: +seconds.toFixed(2), stopped: why, userAgent: this.opts.userAgent } };
    this.state = 'idle'; this.why = why; this.last = file;
    try { this.onStop?.(file, why); } catch { /* the page's problem */ }
    return file;
  }

  /** Game.update's first statement: start if pending and allowed, then file this frame's dt / view / camera / input and open the sensors' frame */
  frameStart(dt: number, input: Input, cam: FollowCamera, view: View): void {
    if (this.state === 'idle') return;
    const g = this.g;
    if (this.state === 'pending') {
      const why = canStart(g);
      if (why) { this.why = why; if (--this.pendingLeft <= 0) { this.state = 'idle'; this.why = `gave up: ${why}`; try { this.onStop?.(null, this.why); } catch { /* */ } } return; }
      this.begin();
    }
    if (this.frame >= JOURNAL_MAX_FRAMES) { this.finish('cap'); return; }
    const f = this.frame; this.inUpdate = true;
    // dt (run-length)
    const L = this.dts[this.dts.length - 1]; if (L && L[1] === dt) L[0]++; else { this.dts.push([1, dt]); this.bytes += 26; }
    // canvas
    const vw = [view.clientWidth, view.clientHeight, view.width, view.height]; if (vw.some((x, i) => x !== this.lastView[i])) { this.views.push([f, ...vw]); this.lastView = vw; this.bytes += 28; }
    // camera as this update will read it
    const cv = [cam.target[0], cam.target[1], cam.target[2], cam.yaw, cam.pitch, cam.distance, cam.aspect, cam.fov]; let mask = 0; const vals: number[] = [];
    cv.forEach((x, i) => { if (!Object.is(x, this.lastCam[i])) { mask |= 1 << i; vals.push(x); this.lastCam[i] = x; } });
    if (mask) { this.cams.push([f, mask, ...vals]); this.bytes += 10 + vals.length * 19; }
    // input
    const rec: InputRec = {}; let any = false;
    const keys = [...input.keys].sort(); const kj = keys.join('|'); if (kj !== this.lastKeys) { rec.k = keys; this.lastKeys = kj; any = true; }
    if (input.pressed.size) { rec.p = [...input.pressed].sort(); any = true; }
    if (input.clicked) { rec.c = input.clicked; any = true; }
    if (input.buttons !== this.lastButtons) { rec.b = input.buttons; this.lastButtons = input.buttons; any = true; }
    if (input.mouseX !== this.lastMouse[0] || input.mouseY !== this.lastMouse[1]) { rec.m = [input.mouseX, input.mouseY]; this.lastMouse = [input.mouseX, input.mouseY]; any = true; }
    if (input.wheel) { rec.w = input.wheel; any = true; }
    if (any) { this.inputs.push([f, rec]); this.bytes += 12 + (rec.k ? 10 + rec.k.length * 8 : 0) + (rec.p ? 8 + rec.p.length * 8 : 0) + (rec.m ? 40 : 0) + (rec.c !== undefined ? 6 : 0) + (rec.b !== undefined ? 6 : 0) + (rec.w !== undefined ? 10 : 0); }
    g.sensors.beginFrame();
  }
  /** Game.update's last statement: close the sensors' frame, digest on the beat, count the frame */
  frameEnd(): void {
    if (this.state !== 'recording' || !this.inUpdate) return;
    this.inUpdate = false; this.g.sensors.endFrame();
    if ((this.frame + 1) % JOURNAL_DIGEST_EVERY === 0) { this.digests.push([this.frame, digestGame(this.g, true)]); this.bytes += 3000; }
    this.frame++;
    if (this.stopAfterNext !== null) this.finish(this.stopAfterNext);
  }
  private begin(): void {
    const g = this.g;
    this.save = saveState(g, { label: 'session journal', kind: 'harness' });
    loadState(g, JSON.parse(JSON.stringify(this.save)) as SaveState);   // (a copy: loadState keeps nothing of it, but the file must be the bytes as SAVED, untouched by anything a load might normalise in place)
    this.env = envSnapshot(g); this.env.hud = !!this.opts.hud; this.knobs = knobsSnapshot(g);
    this.seed = (this.opts.seed ?? ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0)) >>> 0;
    this.die = simDie(this.seed, Math.random); Math.random = this.die;   // the simulation's dice from frame 0: seeded, the displaced die on .sys for the mixer / the solver (dice.ts sysRandom) and for the stop
    g.sensors.record();
    this.frame = 0; this.dts = []; this.views = []; this.cams = []; this.inputs = []; this.digests = []; this.bytes = 0;
    this.lastView = [NaN, NaN, NaN, NaN]; this.lastCam.fill(NaN); this.lastKeys = '\n'; this.lastButtons = NaN; this.lastMouse = [NaN, NaN];
    this.startedAt = new Date().toISOString(); this.t0 = g.time; this.state = 'recording'; this.why = '';
  }
  /** the HUD's tag while pending / recording ('' when idle): 'REC f=1234 · 38 KB' */
  hudText(): string {
    if (this.state === 'pending') return `REC waits: ${this.why || '…'}`;
    if (this.state !== 'recording') return '';
    return `REC f=${this.frame} · ${(this.approxBytes() / 1024).toFixed(0)} KB${this.stopAfterNext !== null ? ' · stopping' : ''}`;
  }
  /** the file's size so far, roughly (the sensors' own estimate + the streams here) */
  approxBytes(): number { return 38000 + this.bytes + this.g.sensors.approxBytes(); }   // (the checkpoint + env + knobs ≈ 38 KB, then the streams)
  summary(): string { return this.state === 'idle' ? `journal idle${this.why ? ` (${this.why})` : ''}${this.last ? ` · last: ${this.last.frames} frames / ${this.last.meta.seconds} s` : ''}` : this.state === 'pending' ? `journal pending — ${this.why}` : `journal RECORDING · frame ${this.frame} · ${(this.g.time - this.t0).toFixed(1)} s · seed ${this.seed} · ≈ ${(this.approxBytes() / 1024).toFixed(0)} KB · ${this.g.sensors.summary()}`; }
}
/** why a recording cannot start on this frame (null = it can): the checkpoint's own refusals (a show, daylight, a unit, Sam down / mid-action, a thing in the air, a
 *  body falling — savestate.ts canSave, unforced) plus a flash light alive in the set (a muzzle flash, a stroke: gone in a frame or two, and not in a checkpoint) */
export function canStart(g: Game): string | null {
  const why = canSave(g, false); if (why) return why;
  if (g.engine.lights.lights.some(l => l.ttl >= 0 || l.transient)) return 'a flash is still lit';
  return null;
}

/** The HUD's one write to the game (ui/bubbles.ts, after each frame's update on the game page): a speech bubble past its duration is nulled on its speaker — every
 *  reader in the game guards on the clock anyway, but the field is state (a checkpoint files it, the digest prints it, needs.ts reads its tail). Here so the page's
 *  bubbles and a REPLAY of a page recording (tools/qa/replay.ts, env.hud) make the very same write at the very same point; the headless harness never calls it. */
export function hudExpireBubbles(game: Game): void {
  const speakers = game.civilians.length ? [...game.guards, ...game.civilians] : game.guards;
  for (const s of speakers) { const b = s.bubble; if (!b || s.state === 'dead' || (s.civ && s.civ.state === 'gone')) continue; if (game.time - b.t > b.dur) s.bubble = null; }
  const pl = game.player, sb = pl.bubble; if (sb && !pl.down && game.time - sb.t > sb.dur) pl.bubble = null;
}

// ================================================================================================================================ REPLAY (the reading side of the streams)
/** Walks a file's per-frame streams: applyFrame(f, input, cam, view) puts frame f's dt / canvas / camera / input in place and returns dt. Frames in order only. */
export class SessionPlayer {
  private dtI = 0; private dtLeft = 0; private viewI = 0; private camI = 0; private inputI = 0;
  private buttons = 0; private mouse: [number, number] = [0, 0]; private keys: string[] = [];
  constructor(readonly file: SessionFile) { this.dtLeft = file.dt.length ? file.dt[0][0] : 0; }
  get frames() { return this.file.frames; }
  applyFrame(f: number, input: Input, cam: FollowCamera, view: View): number {
    const F = this.file;
    // dt
    while (this.dtLeft <= 0 && this.dtI + 1 < F.dt.length) { this.dtI++; this.dtLeft = F.dt[this.dtI][0]; }
    const dt = F.dt[this.dtI]?.[1] ?? 1 / 60; this.dtLeft--;
    // canvas
    while (this.viewI < F.view.length && F.view[this.viewI][0] <= f) { const r = F.view[this.viewI++]; view.clientWidth = r[1]; view.clientHeight = r[2]; view.width = r[3]; view.height = r[4]; }
    // camera
    let camTouched = false;
    while (this.camI < F.cam.length && F.cam[this.camI][0] <= f) {
      const r = F.cam[this.camI++]; const mask = r[1]; let j = 2; camTouched = true;
      for (let i = 0; i < 8; i++) if (mask & (1 << i)) { const x = r[j++]; if (i < 3) cam.target[i] = x; else if (i === 3) cam.yaw = x; else if (i === 4) cam.pitch = x; else if (i === 5) cam.distance = x; else if (i === 6) cam.aspect = x; else cam.fov = x; }
    }
    if (camTouched) cam.rebuild();
    // input: this frame's record if there is one; the edge sets are this frame's alone either way
    let rec: InputRec | null = null;
    while (this.inputI < F.input.length && F.input[this.inputI][0] <= f) { const [rf, r] = F.input[this.inputI++]; if (rf === f) rec = r; }
    if (rec?.k) this.keys = rec.k; if (rec?.b !== undefined) this.buttons = rec.b; if (rec?.m) this.mouse = [rec.m[0], rec.m[1]];
    input.keys.clear(); for (const k of this.keys) input.keys.add(k);
    input.pressed.clear(); for (const k of rec?.p ?? []) input.pressed.add(k);
    input.clicked = rec?.c ?? 0; input.buttons = this.buttons; input.mouseX = this.mouse[0]; input.mouseY = this.mouse[1]; input.wheel = rec?.w ?? 0;
    return dt;
  }
  /** the digests by frame, for the comparison after each update */
  digestAt(f: number): GameDigest | null { const d = this.digestMap ??= new Map(this.file.digests.map(([k, v]) => [k, v])); return d.get(f) ?? null; }
  private digestMap: Map<number, GameDigest> | null = null;
}

/** a file's sanity, in words ('' = fine): version, the blocks present, the streams' shapes */
export function checkSessionFile(F: Partial<SessionFile> | null | undefined): string {
  if (!F || typeof F !== 'object') return 'not an object';
  if (F.game !== 'twopointsix') return `not a twopointsix session (game ${JSON.stringify(F.game)})`;
  if (F.v !== JOURNAL_VERSION) return `version ${F.v} (this build reads ${JOURNAL_VERSION})`;
  if (!F.save || typeof F.save !== 'object') return 'no checkpoint (save)';
  if (typeof F.seed !== 'number' || typeof F.frames !== 'number' || F.frames < 0) return 'seed / frames missing';
  for (const k of ['dt', 'view', 'cam', 'input', 'digests'] as const) if (!Array.isArray(F[k])) return `stream '${k}' missing`;
  if (!F.sensors || !Array.isArray(F.sensors.keys) || !Array.isArray(F.sensors.recs)) return 'sensors block missing';
  if (!F.env || !F.knobs) return 'env / knobs missing';
  const n = (F.dt as [number, number][]).reduce((s, r) => s + (r[0] | 0), 0); if (n !== F.frames) return `dt runs cover ${n} frames, the file says ${F.frames}`;
  return '';
}
