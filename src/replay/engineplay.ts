// THE ENGINE REPLAY: a saved replay (F7) played back on the GAME PAGE itself — the real renderer, the real mixer — by walking this page's own game through the
// file's RUN TAPE (game/runtape.ts: the die, the page's query, the knob tables, then per step the dt, the player's input, the camera and every value the game read
// off the GPU). The 2D viewer (replay.html, src/replay/viewer.ts) draws the file's TRACE and jumps anywhere at once; this one runs the simulation again, in a
// straight line, so what is on screen and in the speakers is the game. Notes typed here are the file's own notes (format.ts ReplayNote, kept on the shelf row): the
// 2D viewer shows them and the other way round.
//
//   /?playtape=<shelf id>            a replay on this browser's shelf (F7 puts them there; the 2D viewer's and this page's ids are the same)
//   /?playtape=<path or url>         a replay file served beside the page (.json or .json.gz) — the shipped sound tours, tapes/…
//   &at=<step>                       start there (run forward unseen and unheard to that step first)
//
// HOW IT STANDS THE GAME: the page is first sent to the TAPE'S OWN QUERY (`recipe.search`: level, mission, squad, hour, weather, every switch the visit had) with
// its seed, so the boot is the recording's boot; then the tape's knob tables and kit cards are laid over whatever this machine keeps, before the level is loaded,
// before and after the game is stood, round the mission's staging and once more at the first step (tools/qa/rerun.ts does the same headless: keep the two in step; the WALK over the tape's rows is one file
// both take, tapewalk.ts).
// While it plays nothing but the tape reaches the simulation: the game is handed an input and a camera OF THE TAPE'S (never the page's keyboard, mouse or view
// size), and `Game.sensors.read` answers from the tape (the GPU is still asked, and not listened to). The picture is drawn through the page's own camera on the
// tape's pose with the window's own aspect.
//
// THE PICTURE'S CAMERA CAN BE TAKEN OFF THE PLAYER'S VIEW, paused or playing (`free`): a drag on the picture moves it over the floor, a right drag (or Shift +
// drag) turns and tilts it, Ctrl + the mouse — moved or dragged — turns it as Ctrl does in play (host/loop.ts: 0.006 rad a pixel, no tilt), the wheel zooms, W A S D slide it; turned or zoomed only it still follows the recorded look-at point, once moved it stays where it was put. The
// bar's 'Player view' (C) is the recording's camera again. Only the page's camera moves: the game is still handed the tape's camera every step, so the run it
// plays is the same run (the page check holds the men's places with the camera thrown about). A click that did not drag is still a note at that spot. A seek
// backwards (a page load) keeps the camera where it was put.
//
// THE FOG OF WAR CAN BE TAKEN OFF THE PICTURE (the bar's 'Fog', F; drawn as recorded until asked; only on a tape played under the fog): Game.fogLift / fogBack
// round each draw hand the renderer everybody and everything, and the HUD an open floor — between two steps, so the run is the same run (the men's places hold).
//
// NIGHT VISION IS THE VIEWER'S TO FLIP (the bar's 'NV', V; the replay opens with the goggles as the run had them, and every press flips the picture — a press that
// lands back on what the run has is 'as played' again and follows the tape from then on): the PICTURE's tube only (`settings.nvAmount`, eased here on the wall's
// clock so it works paused) and, through Game.fogLift's second argument, the infrared lines a tube shows — the run's own lasers of men whose goggles are down,
// added or left out for this draw. The player's goggles, his kit strip's word and everything a step reads (`Player.nv / nvAmount`) are the tape's, untouched.
//
// THE BAR IS A TIMELINE AND THE CORNER HAS A MAP (minimap.ts draws both). The line carries what the file's trace says happened when — rounds, blasts, orders,
// restarts, page errors, the notes — and is dragged to scrub: the seek is made when the button comes up (forward = run there unseen; back = the page again from
// that step, so it costs a boot). The map in the bottom right is the floor from the file with the men and doors of the game AS IT IS PLAYING HERE (not the
// trace's: a run that has parted from its recording shows where its men really are), the picture's camera, and the trace's rounds of the last second; a click (M)
// opens it large with names, and a click on the large one sends the picture's camera to that spot of the floor.
//
// DOES IT MATCH: after every step the men's places are held against the file's trace (the sample taken at that step), as rerun.ts holds them; the bar says the
// moment they part by more than `TOL` and goes on playing. What cannot match: a run with a showcase or the attract reel in it (they move the game outside a
// step), a tape from another build of the game or the level, a boot switch this machine pins from its own store (cut boxes, the glass fracture const).
// AFTER A SEEK the smoke in the air and the particles are not the recording's (they are stepped per drawn frame; a seek draws nothing): picture only.
//
// Nothing here is read by the game: no table, no knob, no state a step reads. The page without ?playtape never calls into this file past `tapeFromUrl`'s first line.
import type { ReplayFile, ReplayNote, RunTape, Decoded } from './format';
import { PLAYER_NAME, TAPE_SHIELD, backToGame, checkReplay, clock, decode, downloadReplay, isErrorMark, sampleAt, tapeShield } from './format';
import type { LineMark, MapFit, MapMan, MapScene } from './minimap';
import { drawFloor, drawLine, drawScene, mapFit, mapSize, mapToWorld, MAP_RING } from './minimap';
import { TapeWalk } from './tapewalk';
import { shelfGet, shelfList, shelfNotes, shelfPut } from './shelf';
import { viewerUrl, VISIT_FLAGS } from '../ui/replaykey';
import { TEXT_EVENT, rectZoom, textZoom } from '../ui/textsize';
import { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { clamp, DEG } from '../math/vec';
import { Input } from '../game/input';
import type { Game } from '../game/game';
import type { LoopCtx } from '../host/loop';
import type { Tween, TweenCam } from '../host/tween';
import { ctrlTurn as playTurn } from '../host/findme';
import * as J from '../game/journal';
import * as K from '../game/knobs';
import * as Kt from '../game/kit';
import { EXACT } from '../math/exact';
import { SENSE } from '../game/sense';
import { CMDCHECK } from '../game/cmd';
import { carLampsTape } from '../game/carlamps';
import { roundTape } from '../scene/round';
import { rowsetTape } from '../game/rowset';
import { memoryStore } from '../game/savestate';
import { tapePoses } from '../game/runtape';
import { resetCivilians } from '../game/civilians';

/** the URL's key */
export const PLAYTAPE = 'playtape';
/** metres a man may stand from his traced place before the run is said to have parted (rerun.ts's own) */
const TOL = 0.15;
/** steps run and not drawn in one frame at most (a slow display plays slow, it does not spiral) · milliseconds of a frame a seek may take */
const BURST = 6, SEEK_MS = 14;
/** THE PACES A REPLAY PLAYS AT, slow motion first. A pace is how fast the tape's steps are fed to the game and nothing else: a step is
 *  the recorded step whatever the pace — its inputs, its length, its sounds and what it is compared with — so slow motion is each recorded step held for longer,
 *  not a finer run (under 1× the PICTURE is drawn between the last two steps: slowBlend below). `replay.html`'s list is the same five (`probes.ts cardreplay` holds the two together). */
export const TAPE_SPEEDS = [0.25, 0.5, 1, 2, 4];
export const speedName = (s: number): string => s === 0.25 ? '¼×' : s === 0.5 ? '½×' : `${s}×`;
/** One pace slower (`dir` < 0) or faster than `s`; the ends hold, and a pace off the list counts as 1×. */
export const speedStep = (s: number, dir: number): number => { const i = TAPE_SPEEDS.indexOf(s); return TAPE_SPEEDS[clamp((i < 0 ? TAPE_SPEEDS.indexOf(1) : i) + Math.sign(dir), 0, TAPE_SPEEDS.length - 1)]; };
/** ONE FRAME'S STEPS: `wall` seconds of the display at `speed`, on top of the time already `owed`, from step `f` of a tape whose step n starts at `tAt[n]` → how
 *  many steps this frame runs and the time still owed after them. A frame runs no more than BURST × speed steps (a slow display plays slow, it does not spiral),
 *  and one that hits that cap owes nothing after it. */
export function paceFrame(owed: number, wall: number, speed: number, f: number, ticks: number, tAt: ArrayLike<number>): { n: number; owed: number } {
  owed += wall * speed; let n = 0;
  while (n < BURST * speed && f + n < ticks && owed >= tAt[f + n + 1] - tAt[f + n]) { owed -= tAt[f + n + 1] - tAt[f + n]; n++; }
  if (n >= BURST * speed) owed = 0;
  return { n, owed };
}
/** UNDER 1× A STEP LASTS SEVERAL FRAMES OF THE DISPLAY, and the picture is drawn BETWEEN the tape's last two steps (the page's own drawing between ticks,
 *  host/tween.ts) instead of standing until the next: the men, what they carry, doors, lights and the recorded camera move on every frame. Only the picture:
 *  the steps a slow replay runs are the steps a fast one runs, in order. HOW FAR A SLOW FRAME STANDS BETWEEN THE TWO: the time owed the next step ÷ that step's
 *  length, 0 (the step before the last) up to, never at, 1 (the last). A frame drawn right after a step starts from the step before it, so the picture moves
 *  on from where the frame before left it and never jumps ahead: it reaches a step as the next one runs, whatever the two steps' lengths (on a tape of uneven
 *  steps — one from before the fixed step — a step's movement is so shown over the NEXT step's length: unbroken, a little off the pace). */
export function slowBlend(owed: number, next: number): number { const a = next > 0 && !SLOMO_BREAK ? owed / next : 1; return a >= 1 ? 1 - 1e-6 : a > 0 ? a : 0; }
/** THE VIEW'S TURN FOR `dx` PIXELS OF THE MOUSE UNDER CTRL (rad): what the same hand does in play, by the same function (host/findme.ts ctrlTurn: 0.006 a pixel, the way round the viewer
 *  picked in Options > Game, 'Turn direction'). The viewer's own setting, not the recording's: a tape's view is the tape's. */
export function ctrlTurn(dx: number): number { return TURN_BREAK ? dx * 0.006 : playTurn(dx); }
/** a check's break word, said as `NAME=1` in front of a headless tool (never on a page: there is no process there) */
const said = (name: string): boolean => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] ?? '') === '1'; } catch { return false; } };
/** `REPLAYTURN_BREAK=1` (tools/qa/replayturn-check.ts's): the replay's Ctrl turn does not ask the row */
const TURN_BREAK = said('REPLAYTURN_BREAK');
/** `SLOMO_BREAK=1` (tools/qa/slomo-check.ts's): a slow frame stands on the last step, as every frame did before the picture was drawn between them */
const SLOMO_BREAK = said('SLOMO_BREAK');
/** the free camera: the keys that slide it · its tilt and zoom limits · metres it may be taken from the recorded look-at point · pixels a press may travel and still be a click · where a seek backwards keeps it */
const FLY = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']), PITCH_MIN = 12 * DEG, PITCH_MAX = 89 * DEG, DIST_MIN = 3, DIST_MAX = 60, FAR_M = 80, DRAG_PX = 5, CAM_KEEP = 'twopointsix.tapecam', SHOT_S = 1;
/** a framing of the picture: look-at, yaw, pitch, distance (FollowCamera.pin's own shape) */
export interface TapeView { look: Vec3; yaw: number; pitch: number; dist: number }
/** keys of the tape's query that are this visit's and not the run's (the tape's seed is said by its recipe) */
const NOT_THE_RUNS = ['paused', 'mute', 'quality', 'seed', 'pick', 'loadout', 'noreplay', 'hud', 'oldsounds', 'newsounds', 'onetheme', 'shuffle', 'soundlanes', PLAYTAPE, 'at'];
/** …and the ones this visit keeps from its own address: ui/replaykey.ts VISIT_FLAGS (the end card's Replay hands the same ones on to the tab it opens) */

type Plain = Record<string, unknown>;
const plain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v);
/** rerun.ts `put`: a tape's table laid over the live one — only keys the table has, nulls written, deep */
const put = (dst: Plain, src: Plain): void => { for (const k of Object.keys(src)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype' || !(k in dst)) continue; const a = dst[k], b = src[k];
  if (plain(a) && plain(b)) put(a, b); else if (typeof a === typeof b || a === null || b === null) dst[k] = b !== null && typeof b === 'object' ? JSON.parse(JSON.stringify(b)) : b; } };

async function textOf(buf: Uint8Array): Promise<string> {
  if (buf[0] === 0x1f && buf[1] === 0x8b) return await new Response(new Blob([buf as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return new TextDecoder().decode(buf);
}

/** what the page hands over once it stands (main.ts) */
export interface TapeHost {
  game: Game; canvas: HTMLCanvasElement; cam: FollowCamera; input: Input; loop: LoopCtx;
  engine: { settings: Record<string, unknown>; world: { upload(between?: boolean): void }; lights: { update(dt: number, t: number): void }; particles?: { clear(): void } | null; resetTaa?(why?: string): void };
  smoke: { update(dt: number): void; emitters: { kind: string }[]; params?: Record<string, unknown> } | null;
  audio: { enabled: boolean; started: boolean; start(): void; setVolumes(): void };
  /** the page's own lines round a step (main.ts step(): the stress row's men, the look's tidy) */
  pre?: () => void;
  fingerprint?: () => string;
}
export interface TapeState { f: number; ticks: number; playing: boolean; ended: boolean; seeking: boolean; speed: number; compared: number; unjournaled: number;
  free: boolean; /** is the fog of war on the picture (false = taken off by the viewer) */ fog: boolean; /** the viewer's own night vision: true / false = held on / off, null = as the run had it */ nv: boolean | null; /** does the picture show the tube */ tube: boolean; map: boolean; drift: { f: number; who: string; metres: number } | null; worst: { f: number; who: string; metres: number } | null; notes: number; id: number | null; fp: 'same' | 'differs' | 'unknown'; refuse: string }

/** main()'s first question. null = no tape asked for; 'moved' = the page is on its way to the tape's own query (stop booting); else the player, or a refusal the
 *  page shows (`refuse` set: the game boots as itself behind the words). */
export async function tapeFromUrl(q: URLSearchParams): Promise<TapePlay | 'moved' | null> {
  const v = q.get(PLAYTAPE); if (v === null) return null;
  let F: ReplayFile | null = null, id: number | null = null, why = '', seen: ReplayNote[] = [];   // (seen: the notes the shelf's row held when this page read it)
  try {
    if (/^\d+$/.test(v)) { id = Number(v); F = await shelfGet(id); if (!F) why = 'That replay is no longer on this browser’s shelf.'; else seen = F.notes ?? []; }
    else {
      const rs = await fetch(new URL(v, document.baseURI).href); if (!rs.ok) why = `Could not fetch ${v} (${rs.status}).`;
      else { F = JSON.parse(await textOf(new Uint8Array(await rs.arrayBuffer()))) as ReplayFile;
        const have = (await shelfList()).find(r => r.savedAt === F!.savedAt && r.seconds === F!.seconds);   // (already on the shelf — a note was typed on it here or in the 2D viewer: its notes)
        if (have) { id = have.id; const kept = (await shelfGet(id))?.notes ?? [], ids = new Set(kept.map(n => n.id)); seen = kept; F.notes = [...kept, ...(F.notes ?? []).filter(n => !ids.has(n.id))].sort((a, b) => a.r - b.r || a.n - b.n); } }
    }
  } catch (e) { why = `Could not read ${v}: ${(e as Error).message}`; }
  if (F && !why) why = checkReplay(F);
  if (F && !why) { const T = F.rerun; if (!T) why = 'This replay has no run tape (saved by an older build, or with the tape off): the map viewer plays it.'; else if ('dead' in T) why = `This replay’s run tape ended early (${T.dead}): the map viewer plays it.`; else if (tapeShield(T)) why = `${TAPE_SHIELD}: the map viewer plays it.`; }
  if (!F || why) return new TapePlay(F, id, v, why || 'No replay.');
  const tape = F.rerun as RunTape, want = tapeSearch(tape, q, v);
  if (new URLSearchParams(location.search).toString() !== new URLSearchParams(want).toString()) { location.replace(location.pathname + want + location.hash); return 'moved'; }
  const P = new TapePlay(F, id, v, ''); for (const n of seen) P.onShelf.add(n.id); return P;
}
/** the tape's own query, with this visit's keys: what the page must be booted on to be the recording's page */
export function tapeSearch(tape: RunTape, now: URLSearchParams, v: string): string {
  const out = new URLSearchParams();
  for (const [k, val] of new URLSearchParams(tape.recipe.search ?? '')) if (!NOT_THE_RUNS.includes(k) && !VISIT_FLAGS.includes(k)) out.append(k, val);   // (a visit's word is never the run's, whichever list a goal put it on: a tape recorded under one does not put it on the page that replays it)
  out.set('seed', tape.recipe.seed === null || tape.recipe.seed === undefined ? 'off' : String(tape.recipe.seed));
  out.set('noreplay', '');   // (no tape of a tape: the page's own buffer stays off, and nothing else takes Game.sensors.read)
  for (const k of VISIT_FLAGS) if (now.has(k)) out.set(k, now.get(k) ?? '');
  out.set(PLAYTAPE, v); if (now.has('at')) out.set('at', now.get('at') ?? '');
  return '?' + out.toString();
}

export class TapePlay {
  readonly tape: RunTape | null; readonly D: Decoded | null;
  /** steps run so far = the next step to run */
  f = 0; playing = false; ended = false; speed = 1; seekTo = -1;
  /** the first step is owed to the still the page opens on (set where the tape attaches; never under the harness's `paused`) */
  private poster = false;
  private host: TapeHost | null = null;
  private simInput = Input.detached(); private simCam = new FollowCamera(); private simView = { clientWidth: 1280, clientHeight: 720, width: 1280, height: 720 };
  /** the tape's row cursors and its sensor answers: tapewalk.ts, the walk tools/qa/rerun.ts takes too */
  private walk: TapeWalk | null = null;
  private poses: ReturnType<typeof tapePoses> | null = null;
  private byN = new Map<number, number>(); private tAt: Float64Array = new Float64Array(1); private simTime = 0; private owed = 0; private first = true;
  private compared = 0; private drift: TapeState['drift'] = null; private worst: TapeState['worst'] = null; private fp: TapeState['fp'] = 'unknown';
  private ui: { bar: HTMLElement; play: HTMLButtonElement; time: HTMLElement; line: HTMLElement; fill: HTMLElement; parted: HTMLElement; ticks: HTMLElement; speed: HTMLButtonElement; slow: HTMLButtonElement; fast: HTMLButtonElement; view: HTMLButtonElement; fog: HTMLButtonElement; nv: HTMLButtonElement; note: HTMLButtonElement; map: HTMLAnchorElement | null; say: HTMLElement; big: HTMLElement; box: HTMLElement; field: HTMLInputElement; marks: HTMLCanvasElement; ghost: HTMLElement; mini: HTMLCanvasElement; modal: HTMLElement; large: HTMLCanvasElement } | null = null;
  /** the map's floor, drawn once a size · the trace sample the run last stood on (its clock is the rounds' clock) · the cast's names by character id */
  private floors = new Map<HTMLCanvasElement, { c: HTMLCanvasElement; W: number; H: number; dpr: number; fit: MapFit }>(); private lastSi = -1; private names = new Map<number, string>();
  private noting: { pos: [number, number] | null; f: number; was: boolean } | null = null; private audioWas: boolean | null = null;
  /** THE PICTURE'S CAMERA OFF THE PLAYER'S VIEW (null = the recording's own camera). `look` null = turned / zoomed only: it still follows the recorded look-at point */
  private free: { look: Vec3 | null; yaw: number; pitch: number; dist: number } | null = null;
  private drag: { id: number; x: number; y: number; u: number; v: number; turn: boolean; /** Ctrl's turn: no tilt, as in play */ level: boolean; /** begun under Ctrl: it turns the way Ctrl turns (ctrlTurn) */ ctrl: boolean; left: boolean; moved: boolean; from: TapeView & { fov: number }; grab: Vec3 | null } | null = null;
  private dragged = false; private nofog = false; /** the viewer's night vision (null = the run's), the tube as drawn 0‥1, and whether the picture is on the run's own value frame for frame */ private nvView: boolean | null = null; private nvK = 0; private nvTrack = true; private held = new Set<string>(); private scratch = new FollowCamera();

  constructor(readonly F: ReplayFile | null, public id: number | null, readonly src: string, readonly refuse: string) {
    const T = F?.rerun; this.tape = !refuse && T && !('dead' in T) ? T : null; this.D = this.tape && F ? decode(F) : null;
    if (refuse) { this.refusal(); return; }
    const tape = this.tape!;
    this.walk = new TapeWalk(tape); F!.samples.forEach((s, i) => this.byN.set(s.n, i));
    this.tAt = new Float64Array(tape.ticks + 1); { let f = 0, t = 0; for (const [n, dt] of tape.dt) for (let i = 0; i < n && f < tape.ticks; i++) { t += dt; this.tAt[++f] = t; } const d = tape.dt[tape.dt.length - 1]?.[1] ?? 1 / 60; while (f < tape.ticks) { t += d; this.tAt[++f] = t; } }
    // the keys are this page's while a tape plays: the game's own hotkeys, the pause card's Esc and the title never see them (a capture listener made before theirs)
    window.addEventListener('keydown', e => this.key(e), true);
    window.addEventListener('keyup', e => { this.held.delete(e.code); }, true); window.addEventListener('blur', () => this.held.clear());
  }

  // ------------------------------------------------------------------------------------------------------------------------ standing the game as the tape's
  /** the tape's knob tables and kit cards over this machine's (rerun.ts `tables` / `kitOf`) — asked several times through the boot, each a plain overwrite */
  tables(): void {
    const rc = this.tape?.recipe; if (!rc) return;
    const kn = rc.knobs as { tables?: Plain } | null, src: Plain = { ...(kn?.tables ?? {}), ...(rc.tables ?? {}) }, into = (rc.tables ? K.knobsPlayed() : J.knobTables()) as Record<string, Plain>;
    for (const [name, Tb] of Object.entries(into)) { const t = src[name]; if (plain(t)) { if (rc.tables) put(Tb, t); else K.assignDeep(Tb, t); } }
    if (!plain(src.EXACT)) EXACT.on = false;   // (a tape from before the game's own maths was recorded on the engine's functions: said here, BEFORE the level and the game are built on them — math/exact.ts)
    if (!plain(src.SENSE)) SENSE.cpu = false;  // (… and one from before these keys was played on the renderer's senses, its records believed as they came)
    if (!plain(src.CMDCHECK)) CMDCHECK.on = false;
    rowsetTape(src);   // (… and one from before a row had an hour and weather of its own: main.ts lays them on its query before the game exists — game/rowset.ts)
    roundTape(src);   // (… and one from before round things were round: the level's boxes are read as it is stood up — scene/round.ts)
    carLampsTape(src);   // (… and one from before a vehicle's lamps were light targets: the Game reads that switch as it is built — game/carlamps.ts)
    this.kitOf(rc.kit);
  }
  private kitOf(k: unknown): void {
    const c = k as { on?: boolean; members?: unknown[]; own?: unknown; stealth?: unknown } | undefined; if (!c || !Array.isArray(c.members)) return;
    Kt.kitMission(null);   // (kit.ts KITDEAL.stealth: FIRST — a stealth card standing first in the table goes back to its own place before the tape's cards are written, or this machine's loud card would land over the tape's)
    Kt.kitOwn(c.own === true); Kt.KIT.on = c.on !== false; const cards = Array.from({ length: Kt.KIT_MEMBERS }, (_, i) => Kt.kitSanitize(i, c.members![i])); Kt.KIT.members.length = 0; Kt.KIT.members.push(...cards); Kt.kitStealthSet(c.stealth);   // (…and the stealth card the tape's run wore, or none — never this machine's)
  }
  /** what the simulation reads off the ENGINE, as the recording's engine had it (journal.ts EnvSnap) — before the game is built, and again every step (a quality preset rewrites the debris cap) */
  env(settings: Record<string, unknown>): void { const e = this.tape?.recipe.env; if (e) J.applyEnvSettings(settings as never, e as never); }
  /** the game has just been stood: its tune, flags and tables, the fixtures' own stagger */
  stood(g: Game): void {
    const rc = this.tape?.recipe; if (!rc) return;
    const civ = !!g.tune.civilians;
    if (rc.knobs) J.applyKnobs(g, rc.knobs as never); this.tables(); if (rc.env) J.applyEnvGame(g, rc.env as never);
    if (!!g.tune.civilians !== civ) resetCivilians(g);   // (the game was built on this machine's kept switch: the floor's civilians are the tape's switch's)
    g.saves.store = memoryStore();   // (a replay's autosaves are the replay's: this browser's own checkpoints are not written over)
    this.poses = tapePoses(g);
    this.fl = (rc.knobs as { flags?: Plain } | null)?.flags ?? null;
  }
  /** THE SANDBOX FLAGS THE COMING STEP RUNS UNDER, as the tape has them: the recipe's, then each 'flags' row's. Written to the game before EVERY step, not only
   *  on the row — a page that writes them itself on each frame (the sneak lab and the fire lab: its own panel's, for the scenario the ADDRESS names) would
   *  have the last word from the frame after the row on, and a scenario picked on the panel while recording replayed with nobody noticing him. */
  private fl: Plain | null = null;
  private flags(g: Game, fl: Plain): void { g.godMode = !!fl.godMode; g.aiEnabled = fl.aiEnabled !== false; g.infiniteAmmo = !!fl.infiniteAmmo; g.playerInvisible = !!fl.playerInvisible; }

  /** the page stands and its hooks are up: take the frame */
  attach(h: TapeHost): void {
    // (a seek back that kept a thrown camera lands with no big play button over the picture: it would take every press meant for the camera)
    this.host = h; if (!this.tape) return;
    const g = h.game, me = this;
    g.fogOfWar.viewer = true;   // (the picture may be asked for without the fog: fogSet)
    g.fogOfWar.pageLook();      // (…and is drawn under this page's fog look — colour kept, the soft edge — not the look the tape was recorded under: picture only)
    try { this.fp = h.fingerprint && this.F?.level.fp ? (h.fingerprint() === this.F.level.fp ? 'same' : 'differs') : 'unknown'; } catch { /* */ }
    const c = (this.tape.recipe.env as { canister?: Plain } | null)?.canister; if (c && h.smoke?.params) Object.assign(h.smoke.params, c);
    const walk = this.walk!; g.sensors.read = (key: string): number | undefined => walk.read(key);   // (the tape's answer for this step's k-th read of the key; a read the tape never made = the last value, counted)
    this.build();
    try { const k = sessionStorage.getItem(CAM_KEEP); sessionStorage.removeItem(CAM_KEEP); const o = k ? JSON.parse(k) as { src: string; free?: Partial<TapeView>; nofog?: boolean; nv?: boolean; speed?: number } : null; if (o && o.src === this.src) { if (o.nofog) this.nofog = true; if (typeof o.speed === 'number') this.speedSet(o.speed); if (typeof o.nv === 'boolean') { this.nvView = o.nv; this.nvK = o.nv ? 1 : 0; this.nvTrack = false; } if (o.free) { this.camSet(o.free); if (new URLSearchParams(location.search).has('at')) this.ui?.big.remove(); } } } catch { /* no store, or not ours: the recording's camera */ }
    const at = Number(new URLSearchParams(location.search).get('at')); if (Number.isFinite(at) && at > 0) this.seekTo = Math.min(this.tape.ticks, Math.floor(at));
    this.poster = !new URLSearchParams(location.search).has('paused');
    (window as unknown as { __tape: unknown }).__tape = { play: () => this.play(), pause: () => this.pause(), run: (n: number, draw = true) => this.run(n, draw), seek: (f: number) => this.seek(f), note: (text: string, pos: [number, number] | null = null) => this.addNote(text, pos, this.f),
      cam: (p: Partial<TapeView> | null) => this.camSet(p), get view() { return me.view(); }, map: (open?: boolean) => this.mapOpen(open), fog: (on?: boolean) => this.fogSet(on), nv: (on?: boolean | null) => this.nvSet(on), speed: (to: number) => this.speedSet(to),
      get state() { return me.state(); }, get file() { return me.F; }, get notes() { return me.F?.notes ?? []; } };
  }
  state(): TapeState { return { f: this.f, ticks: this.tape?.ticks ?? 0, playing: this.playing, ended: this.ended, seeking: this.seekTo > this.f, speed: this.speed, compared: this.compared, unjournaled: this.walk?.unjournaled ?? 0, free: !!this.free, fog: !this.nofog, nv: this.nvView, tube: this.tube(), map: !!this.ui && !this.ui.modal.hidden, drift: this.drift, worst: this.worst, notes: this.F?.notes.length ?? 0, id: this.id, fp: this.fp, refuse: this.refuse }; }

  // ------------------------------------------------------------------------------------------------------------------------ one step of the tape
  /** the length of the last step run (s): a slow frame's picture is that much of it behind the game's clock */
  private lastDt = 0;
  private stepOne(played = false): number {
    const h = this.host!, g = h.game, T = this.tape!, W = this.walk!, f = this.f, I = this.simInput, cam = this.simCam, cv = this.simView;
    if (this.first) { this.first = false; const rc = T.recipe, kn = rc.knobs as { tune?: Plain } | null; this.tables(); g.fogOfWar.pageLook(); if (kn?.tune) K.assignDeep(g.tune as never, kn.tune); }   // (the last word over what the boot wrote after the staging: this machine's sandbox row, its kept feel rows)
    for (const [, kind, data] of W.outside()) {
      if (kind === 'restart') g.restartEncounter();
      else if (this.poses?.row(f, kind, data)) { /* where the player was put from outside a step, or by a restart inside the coming one: runtape.ts, as tools/qa/rerun.ts does it */ }
      else if (kind === 'flags') this.fl = data as Plain;
      else if (kind === 'tune') K.assignDeep(g.tune as never, data as Plain);
      else if (kind === 'table') { const [name, src] = data as [string, unknown]; const Tb = (K.knobsPlayed() as Record<string, Plain>)[name]; if (Tb && plain(src)) put(Tb, src); if (name === 'FOG') g.fogOfWar.pageLook(); }
      else if (kind === 'kit') this.kitOf(data); }
    if (this.fl) this.flags(g, this.fl);
    h.pre?.(); this.env(h.engine.settings);
    const tw = played ? this.slow() : null; if (tw?.stale) this.blendEnd(tw);   // (a slow replay's first step: what stands before it is what its picture is drawn FROM)
    const dt = W.step(cv, I);
    W.layCamera(cam);   // (tapewalk.ts: the pose, and the matrices the page's step read, as tools/qa/rerun.ts lays them)
    try { g.update(dt, I, cam, cv as unknown as HTMLCanvasElement); } catch (e) { W.failed(); throw e; }
    W.done();
    if (g.mission.debrief) g.mission.debrief = false;   // (the page's own line after a step: the end card's flag is taken — the card itself is not opened over a replay)
    this.simTime += dt; h.engine.lights.update(dt, this.simTime); this.f = f + 1; this.lastDt = dt;
    if (tw) this.blendEnd(tw); else { const lt = h.loop.tween; if (lt && !lt.stale) lt.rest(); }   // (a step no slow frame will draw between — a seek, a script's, a faster pace — ends the blend: nothing is ever drawn across it)
    this.hold(f + 1); return dt;
  }
  /** the men's places against the trace's sample of this step (rerun.ts's compare) */
  private hold(n: number): void {
    const si = this.byN.get(n), F = this.F!, D = this.D!, g = this.host!.game; if (si === undefined) return;
    this.compared++; this.lastSi = si;
    D.men[si].forEach((m, ci) => { if (!m) return; const c = F.cast[ci]; let p: ArrayLike<number> | null = null;
      if (c.kind === 'player') p = g.player.char.pos; else { const gd = g.guards.find(x => x.char.id === c.id) ?? g.civilians.find(x => x.char.id === c.id); p = gd ? gd.char.pos : null; }
      const d = p ? Math.hypot(p[0] - m.x, p[2] - m.z) : Infinity, row = { f: n, who: c.name, metres: d };
      if (p && (!this.worst || d > this.worst.metres)) this.worst = row; if (!this.drift && d > TOL) this.drift = row; });
  }

  /** AFTER A STEP THAT IS NOT DRAWN: what the page does between an update and the next — the HUD's one write to the game, and THE WORLD PACKED. The cursor's ray
   *  (BoxWorld.raycast) walks the box list as last packed, and only a draw packs it: a step played without its draw would aim through the boxes of an older
   *  frame and part from a recording made on a page that drew every one (the fixed step's betweenTicks, host/loop.ts, is the same two lines). */
  private between(): void { const h = this.host; if (!h) return; J.hudExpireBubbles(h.game); h.engine.world.upload(true); }

  // ------------------------------------------------------------------------------------------------------------------------ the frame (main.ts step() hands it over)
  /** one frame of the page: as many tape steps as its time asks for, then the picture, the mixer and the HUD — host/loop.ts stepFrame's second half, on the tape's camera */
  frame(wallDt: number): void {
    const h = this.host; if (!h) return; const L = h.loop, g = h.game, T = this.tape;
    let simDt = 0; const t0 = performance.now();
    // THE STILL A REPLAY OPENS ON HAS ITS MEN IN IT: nobody is drawn before a step has run (the men are a step's boxes), so a page a person opened runs the tape's
    // first step — heard and compared like any other — and stands on it under its play button. Not with `at` (the seek's own still) and not under `paused`: a page
    // the harness drives stands on step 0, as every tool's step counts expect.
    if (T && this.poster) { this.poster = false; if (this.f === 0 && this.seekTo < 0 && !this.playing && !this.ended && T.ticks > 0) simDt += this.stepOne(); }
    if (T && !this.ended) {
      if (this.seekTo > this.f) {   // a seek: forward unseen and unheard, a slice of it a frame so the page stays alive
        if (this.audioWas === null) { this.audioWas = h.audio.enabled; h.audio.enabled = false; h.audio.setVolumes(); }
        while (this.f < this.seekTo && this.f < T.ticks && performance.now() - t0 < SEEK_MS) { const dt = this.stepOne(); h.smoke?.update(dt); this.between(); }
        if (this.f >= this.seekTo || this.f >= T.ticks) this.seekDone();
      } else if (this.playing) {
        const P = paceFrame(this.owed, wallDt, this.speed, this.f, T.ticks, this.tAt); this.owed = P.owed;
        for (let n = 0; n < P.n; n++) { if (n) this.between(); simDt += this.stepOne(true); }
      }
      if (this.f >= T.ticks && !this.ended) { this.ended = true; this.playing = false; this.seekDone(); }
    }
    L.updateMs = performance.now() - t0; L.time = this.simTime; this.fly(wallDt);
    if (h.canvas.clientWidth > 0 && h.canvas.clientHeight > 0) this.draw(simDt, wallDt); else if (simDt > 0) this.between();
    h.input.endFrame(); this.paint();
  }
  private seekDone(): void {
    const h = this.host!; this.seekTo = -1; if (this.audioWas === null) return;
    h.audio.enabled = this.audioWas; h.audio.setVolumes(); this.audioWas = null;
    if (h.smoke) h.smoke.emitters = h.smoke.emitters.filter(e => e.kind === 'canister'); h.engine.particles?.clear(); h.engine.resetTaa?.('seek');   // (a seek's tidy: queues built up unseen would all land on the first drawn frame)
  }
  /** the fog of war on the picture (`on` absent = the other way): the viewer's, never the run's → is it on */
  private fogSet(on = this.nofog): boolean { if (!this.host?.game.fogOfWar.active) return !this.nofog; this.nofog = !on; this.paint(); return on; }
  /** does the picture show the tube: the viewer's word, else the run's goggles */
  private tube(): boolean { return this.nvView ?? ((this.host?.game.player.nvAmount ?? 0) > 0.5); }
  /** night vision on the picture (`on` absent = a press: the picture flips, and a flip that lands on what the run has is 'as played' again; null = as played): the
   *  viewer's, never the run's → does the picture show the tube */
  private nvSet(on?: boolean | null): boolean {
    const g = this.host?.game; if (!g) return false; const run = g.player.nvAmount > 0.5;
    if (on === undefined) { const next = !this.tube(); this.nvView = next === run ? null : next; } else this.nvView = on;
    this.nvTrack = false; this.paint(); return this.tube();
  }
  private draw(dt: number, wall = dt): void {
    const h = this.host!, L = h.loop, g = h.game, cam = h.cam;
    // the picture's camera: the tape's pose for the NEXT step (= the camera the recording drew this step with), the window's own aspect (engine.render sets it)
    // …or wherever the viewer has put it (`free`): the page's camera only — the game's own was laid from the tape in stepOne and is never this one
    // A SLOW REPLAY IS DRAWN BETWEEN ITS STEPS (slowBlend above): this frame's place between the last two, the recorded camera's too, and the picture's own clocks
    // (the smoke, the particles, the shaders' time) run on the frame's share of the pace instead of standing for the frames a step lasts. The mixer keeps the
    // steps' clock. A replay that STANDS — paused, a note being typed, at its end — rests ON its step, as a script's steps (`run`) and a seek do: the picture is
    // then what a note is stamped with, what a click on the floor reads and what the map shows. Playing on, the picture starts from that step: it never steps back.
    const T = this.tape, tw = this.playing ? this.slow() : null, blent = !!tw && !tw.stale, a = blent && tw!.have >= 2 && T && this.f < T.ticks ? slowBlend(this.owed, this.tAt[this.f + 1] - this.tAt[this.f]) : 1;
    if (!tw) { const lt = L.tween; if (lt && !lt.stale) lt.rest(); }   // (standing, or the pace is up again: the men's palette on the GPU is the last step's)
    const pdt = blent ? wall * this.speed : dt, tPic = a < 1 ? L.time - (1 - a) * this.lastDt : L.time;
    const v = this.view(a < 1 ? tw!.camAt(a) : null);
    cam.pin = { look: v.look, yaw: v.yaw, pitch: v.pitch, dist: v.dist }; cam.fov = v.fov; cam.kick = this.simCam.kick;
    // the tube: the run's own value frame for frame until the viewer asks otherwise; then eased on the wall's clock (paused too), and back onto the run's
    const want = this.nvView, to = want === null ? g.player.nvAmount : want ? 1 : 0;
    if (want === null && this.nvTrack) this.nvK = to;
    else { this.nvK += (to - this.nvK) * (1 - Math.exp(-(to > this.nvK ? 5 : 9) * wall)); if (want === null && Math.abs(to - this.nvK) < 0.02) { this.nvK = to; this.nvTrack = true; } }
    const tube = want === null && this.nvTrack ? null : this.nvK > 0.5;
    L.host.settings.nvAmount = this.nvK; L.host.settings.hitFlash = g.player.hitFlash;
    if (L.audio) { const p = g.player.char.pos; L.audio.setListener([p[0], p[1] + 1.6, p[2]], cam.forward); L.audio.update(dt, L.time); }
    L.smoke?.update(pdt);
    cam.update(dt, g.followPos(), null);
    L.hud?.setCaption('', ''); L.hud?.setTimeline(null, () => { /* */ });
    cam.kickIn();
    try { g.fogLift(this.nofog, tube, g.viewPx(cam, h.canvas));   // (the fog taken off the picture and its HUD, the infrared lines the viewer's tube shows or does not, and laser lines / tracers re-fit to THIS picture's pixel — the step sized them for the recording's view — for this draw only; Game.fogBack puts the step's own lists back)
      if (blent) { try { tw!.pose(a); L.render(cam, tPic, pdt, L.present()); } finally { tw!.unpose(); } }   // (the blend hangs on the drawn things for the render alone: the HUD below, and the next step, read the game's own)
      else L.render(cam, L.time, pdt, L.present());
      L.hud?.update(g, cam, h.canvas); L.bubbles?.update(g, cam, h.canvas); }
    finally { g.fogBack(); cam.kickOut(); }
    this.mapDraw();
  }
  // ------------------------------------------------------------------------------------------------------------------------ the picture's camera, off the player's view
  /** the framing the next drawn frame takes: the recording's, or the viewer's own */
  private view(between: TweenCam | null = null): TapeView & { fov: number } {
    const c = this.walk?.camNext() ?? [10, 0, 15, 0, 0, 21, 16 / 9, 0.5, 0.18], F = this.free, B = between, at: Vec3 = B ? [B.target[0], B.target[1], B.target[2]] : [c[0], c[1], c[2]];
    return F ? { look: F.look ? [F.look[0], F.look[1], F.look[2]] : at, yaw: F.yaw, pitch: F.pitch, dist: F.dist, fov: c[7] } : { look: at, yaw: B ? B.yaw : c[3], pitch: B ? B.pitch : c[4], dist: B ? B.distance : c[5], fov: c[7] };
  }
  /** the recorded camera as the next drawn frame would take it: one end of a slow frame's blend (tween.ts capture) */
  private camPose(): TweenCam | null { const c = this.walk?.camNext(); return c ? { target: [c[0], c[1], c[2]], yaw: c[3], pitch: c[4], distance: c[5] } : null; }
  /** one end of a slow frame's blend: what stands now AS THE PICTURE SHOWS IT — with the fog off the picture, the men and things the fog leaves out too (they
   *  are drawn, so they are drawn between the steps like everybody else). Between two steps, as a draw's own lift is. */
  private blendEnd(tw: Tween): void {
    const g = this.host!.game;
    if (this.nofog && g.fogOfWar.active) { g.fogLift(true); try { tw.capture(this.camPose()); } finally { g.fogBack(); } } else tw.capture(this.camPose());
  }
  /** the page's drawing between ticks, when this replay plays slow enough to need it — null = every frame draws the last step as it is (a pace of 1 or more, a seek
   *  under way). Not the page's own switch (TWEEN.on): that is the recording's word for its own frames, and a slow replay's frames are the viewer's. */
  private slow(): Tween | null { const tw = this.host?.loop.tween; return tw && this.speed < 1 && this.seekTo < 0 ? tw : null; }
  /** take the camera from the recording, as it stands this frame */
  private take(): NonNullable<TapePlay['free']> { if (!this.free) { const v = this.view(); this.free = { look: null, yaw: v.yaw, pitch: v.pitch, dist: v.dist }; this.paint(); } return this.free; }
  /** a look-at point kept within reach of the recorded one (a camera flung off the level is a lost camera) */
  private near(p: Vec3): Vec3 { const c = this.walk?.camNext(); if (!c) return p; const dx = p[0] - c[0], dz = p[2] - c[2], d = Math.hypot(dx, dz), k = d > FAR_M ? FAR_M / d : 1; return [c[0] + dx * k, p[1], c[2] + dz * k]; }
  /** the floor point under a spot of the picture, were the camera framed so (the page's own camera is not touched between frames: its last matrices are the motion vectors' 'previous') */
  private floorAt(v: TapeView & { fov: number }, s: number, t: number): Vec3 | null {
    const C = this.scratch; C.target = v.look; C.yaw = v.yaw; C.pitch = v.pitch; C.distance = v.dist; C.fov = v.fov; C.aspect = this.host?.cam.aspect ?? C.aspect; C.rebuild();
    return C.groundPoint(s, t, v.look[1]);
  }
  /** scripts and the bar: null = the player's view again; else the fields given, over the framing as it stands (a `look` given = it stays there) */
  private camSet(p: Partial<TapeView> | null): TapeView {
    const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
    if (p === null) { const D = this.drag; if (D) { this.drag = null; if (D.moved) { this.dragged = D.left; if (this.host) this.host.canvas.style.cursor = ''; } }   // (a drag under way ends here: its next move would take the camera straight back)
      if (this.free) { this.free = null; this.paint(); } }
    else if (p && typeof p === 'object') { const F = this.take();
      if (num(p.yaw)) F.yaw = p.yaw; if (num(p.pitch)) F.pitch = clamp(p.pitch, PITCH_MIN, PITCH_MAX); if (num(p.dist)) F.dist = clamp(p.dist, DIST_MIN, DIST_MAX);
      if (Array.isArray(p.look) && num(p.look[0]) && num(p.look[1]) && num(p.look[2])) F.look = this.near([p.look[0], p.look[1], p.look[2]]); }
    const v = this.view(); return { look: v.look, yaw: v.yaw, pitch: v.pitch, dist: v.dist };
  }
  /** W A S D: the look-at point slid over the floor on the picture's own bearings, on the wall's clock (so it moves while paused), faster from higher up */
  private fly(dt: number): void {
    const k = this.held; if (!k.size || !this.tape || this.noting) return;
    const x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), z = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0); if (!x && !z) return;
    const v = this.view(), s = v.dist * 0.6 * Math.min(Math.max(dt, 0), 0.1) / Math.hypot(x, z), sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    this.take().look = this.near([v.look[0] + (-sy * z + cy * x) * s, v.look[1], v.look[2] + (-cy * z - sy * x) * s]);
  }
  /** the mouse on the picture: a press that travels is the camera's (left = the floor under the cursor comes with it · right, middle or Shift = turn and tilt · Ctrl = turn), one that does not is a note's click */
  private mouse(cv: HTMLCanvasElement): void {
    const uv = (e: MouseEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)]; };
    cv.addEventListener('pointerdown', e => { this.dragged = false; if (!this.tape || this.noting || e.button > 2) return; const [u, v] = uv(e);
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, u, v, turn: e.button !== 0 || e.shiftKey || e.ctrlKey, level: e.ctrlKey && !e.shiftKey, ctrl: e.ctrlKey, left: e.button === 0, moved: false, from: this.view(), grab: null }; });
    const up = (e: PointerEvent): void => { const D = this.drag; if (!D || e.pointerId !== D.id) return; this.drag = null; if (D.moved) { this.dragged = D.left; try { cv.releasePointerCapture(D.id); } catch { /* */ } cv.style.cursor = ''; } };
    cv.addEventListener('pointermove', e => { const D = this.drag;
      if (!D) { if (e.ctrlKey && !e.buttons && e.movementX && this.tape && !this.noting) this.take().yaw += ctrlTurn(e.movementX); return; }   // (Ctrl + the mouse with no button turns the view, as it orbits the camera in play: game/input.ts orbitDX × host/loop.ts's 0.006, the way round his 'Turn direction' row says)
      if (e.pointerId !== D.id) return; if (!e.buttons) { up(e); return; }   // (no button down: the press ended somewhere this canvas did not hear of)
      const dx = e.clientX - D.x, dy = e.clientY - D.y;
      if (!D.moved) { if (Math.hypot(dx, dy) < DRAG_PX) return; D.moved = true; D.from = this.view(); D.grab = D.turn ? null : this.floorAt(D.from, D.u, D.v); try { cv.setPointerCapture(D.id); } catch { /* */ } cv.style.cursor = 'grabbing'; }
      const F = this.take();
      if (D.turn) { F.yaw = D.from.yaw + (D.ctrl ? ctrlTurn(dx) : dx * 0.006); if (!D.level) F.pitch = clamp(D.from.pitch + dy * 0.005, PITCH_MIN, PITCH_MAX); }
      else { const [u, v] = uv(e), q = D.grab && this.floorAt(D.from, u, v); if (D.grab && q) F.look = this.near([D.from.look[0] + D.grab[0] - q[0], D.from.look[1], D.from.look[2] + D.grab[2] - q[2]]); } });
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { if (!this.tape || this.noting || !e.deltaY) return; const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);   // (a wheel that counts lines or pages, as pixels)
      const F = this.take(); F.dist = clamp(F.dist * Math.exp(clamp(px, -400, 400) * 0.0012), DIST_MIN, DIST_MAX);
      const D = this.drag; if (D?.moved) { D.x = e.clientX; D.y = e.clientY; [D.u, D.v] = uv(e); D.from = this.view(); D.grab = D.turn ? null : this.floorAt(D.from, D.u, D.v); } }, { passive: true });
  }

  /** scripts: n steps now, exactly, and one drawn frame after them */
  run(n: number, draw = true): TapeState {
    const h = this.host, T = this.tape; if (!h || !T) return this.state();
    let dt = 0; for (let i = 0; i < n && this.f < T.ticks; i++) { if (i) this.between(); dt += this.stepOne(); } dt = Math.min(dt, 0.25);
    if (this.f >= T.ticks) { this.ended = true; this.playing = false; }
    h.loop.time = this.simTime; if (draw && h.canvas.clientWidth > 0 && h.canvas.clientHeight > 0) this.draw(dt); else this.between();
    this.paint(); return this.state();
  }
  /** The pace the tape plays at from here on: one of `TAPE_SPEEDS`, anything else is not taken. Nothing a step reads. */
  speedSet(to: number): number { if (TAPE_SPEEDS.includes(to) && to !== this.speed) { this.speed = to; this.paint(); } return this.speed; }
  play(): void { if (this.ended) { this.again(0); return; } if (!this.tape) return; this.host?.audio.start(); this.playing = true; this.ui?.big.remove(); this.paint(); }
  pause(): void { this.playing = false; this.paint(); }
  /** forward = run there unseen; back = the page again from that step (a run cannot be un-played) */
  seek(f: number): void { if (!this.tape) return; f = Math.max(0, Math.min(this.tape.ticks, Math.floor(f))); if (f > this.f) { this.seekTo = f; this.ui?.big.remove(); } else if (f < this.f) this.again(f); }
  private again(f: number): void { const q = new URLSearchParams(location.search); if (f > 0) q.set('at', String(f)); else q.delete('at'); this.playing = false; try { if (this.free || this.nofog || this.nvView !== null || this.speed !== 1) sessionStorage.setItem(CAM_KEEP, JSON.stringify({ src: this.src, free: this.free ?? undefined, nofog: this.nofog, nv: this.nvView ?? undefined, speed: this.speed })); } catch { /* */ } void this.saving.finally(() => location.replace(location.pathname + '?' + q.toString())); }   // (a note still on its way to the shelf is kept first)

  // ------------------------------------------------------------------------------------------------------------------------ notes (the file's own: the 2D viewer shows them)
  private saving: Promise<unknown> = Promise.resolve(); private shelving: Promise<number | null> | null = null; private unkept = false;
  /** the file's row on this browser's shelf, made once (two asks at once share the one put) */
  /** THE WAYS OFF THIS PAGE STAY IN THIS WINDOW (the maintainer, 10-15: "replays should just play in the current window, not open a new tab"). The map viewer
   *  on this replay: a note being typed is kept, and one on its way to the shelf lands, before the page goes. */
  private toMap(): void { if (this.noting) this.noteClose(true); void this.saving.catch(() => { /* */ }).then(() => this.shelve()).then(id => { if (id !== null) location.assign(viewerUrl(id)); }); }
  /** …and the game he came from (format.ts backToGame, on leaveFor's mark): the game's own entry in this window's history when it is still there, else the
   *  address he left, else this page with no tape under this visit's words (a replay opened from a link or the shelf came from no game). One press, one going. */
  private toGame(): void {
    if (this.noting) this.noteClose(true);
    if (this.going) return; this.going = true; setTimeout(() => { this.going = false; }, 4000);
    const now = new URLSearchParams(location.search), keep = new URLSearchParams(); for (const k of VISIT_FLAGS) if (k !== 'paused' && now.has(k)) keep.set(k, now.get(k) ?? '');
    const words = keep.toString(), home = location.origin + location.pathname + (words ? `?${words}` : '');   // (the replay page IS the game's page, on a tape)
    void this.saving.catch(() => { /* */ }).then(() => backToGame(this.id, home));
  }
  private going = false;
  private shelve(): Promise<number | null> {
    if (this.id !== null || !this.F) return Promise.resolve(this.id);
    return this.shelving ??= (async () => {
      const have = (await shelfList()).find(r => r.savedAt === this.F!.savedAt && r.seconds === this.F!.seconds);
      this.id = have ? have.id : await shelfPut(this.F!); if (!have && this.id !== null) for (const n of this.F!.notes) this.onShelf.add(n.id); return this.id;
    })().catch(() => null).finally(() => { if (this.id === null) this.shelving = null; });
  }
  async addNote(text: string, pos: [number, number] | null, f: number): Promise<ReplayNote | null> {
    const F = this.F, D = this.D; if (!F || !D || !text.trim()) return null;
    let si = 0; for (let lo = 0, hi = F.samples.length - 1; lo <= hi;) { const mid = (lo + hi) >> 1; if (F.samples[mid].n <= f) { si = mid; lo = mid + 1; } else hi = mid - 1; }   // the last sample at or before the step (the first, before the trace begins)
    const q = F.samples[si];
    const n: ReplayNote = { id: `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, r: Math.round((q?.r ?? 0) * 1000) / 1000, t: q?.t ?? 0, n: f, pos: pos ? [Math.round(pos[0] * 100) / 100, Math.round(pos[1] * 100) / 100] : null, text: text.trim(), at: new Date().toISOString() };
    F.notes.push(n); F.notes.sort((a, b) => a.r - b.r || a.n - b.n);
    const keep = (async () => { const id = await this.shelve(); if (id === null) return false; await this.takeIn(id); const out = F.notes.filter(x => x.text.trim()), ok = await shelfNotes(id, out); if (ok) for (const x of out) this.onShelf.add(x.id); return ok; })().catch(() => false);   // (the shelf's row is written whole: what the map viewer's tab typed since is taken in first, not written over)
    this.saving = Promise.all([this.saving, keep]); this.unkept = !(await keep);   // (no shelf in this browser: the note lasts as long as the page, and the bar says so)
    this.ticks(); this.paint(); return n;
  }
  /** the ids of the notes this page has SEEN on the shelf's row (read there, or written there by this page): one of them that the row no longer holds was
   *  deleted in the map viewer's tab, and is not brought back; a note never seen there is this page's own, not written yet */
  readonly onShelf = new Set<string>();
  /** the shelf's row as it stands taken into the page's list: what the map viewer's tab typed since this page read it comes in, what it deleted goes, the
   *  shelf's copy of a note stands (as when the page opened), and a note of this page's the shelf has not got yet stays */
  private async takeIn(id: number): Promise<void> {
    const F = this.F, row = await shelfGet(id).catch(() => null); if (!F || !row) return;   // (a row that cannot be read changes nothing here)
    const kept = row.notes ?? [], ids = new Set(kept.map(n => n.id));
    F.notes = [...kept, ...F.notes.filter(n => !ids.has(n.id) && !this.onShelf.has(n.id))].sort((a, b) => a.r - b.r || a.n - b.n);
    for (const n of kept) this.onShelf.add(n.id);
  }
  /** the replay out of the page as one file, its notes in it (the bar's Save; the map viewer's 'Download with notes' is the same file): words still in the
   *  note box are kept first, and the shelf's row is taken in (`takeIn`: notes typed or deleted in the map viewer's tab since). The name it went out under. */
  private async saveFile(): Promise<string | null> {
    const F = this.F; if (!F) return null; if (this.noting) this.noteClose(true);
    await this.saving.catch(() => { /* */ });
    if (this.id !== null) { await this.takeIn(this.id); this.ticks(); this.paint(); }
    return downloadReplay(F);
  }
  private noteOpen(pos: [number, number] | null): void {
    const u = this.ui; if (!u || !this.tape || this.noting) return;
    this.mapOpen(false);
    this.noting = { pos, f: this.f, was: this.playing }; this.playing = false; u.box.hidden = false; u.field.value = ''; u.field.placeholder = pos ? `note at ${clock(this.tAt[this.f])} · this spot` : `note at ${clock(this.tAt[this.f])}`; u.field.focus(); this.paint();
  }
  private noteClose(keep: boolean): void {
    const u = this.ui, N = this.noting; if (!u || !N) return;
    this.noting = null; u.box.hidden = true; u.field.blur(); if (keep) void this.addNote(u.field.value, N.pos, N.f); if (N.was) this.play(); else this.paint();
  }

  // ------------------------------------------------------------------------------------------------------------------------ the bar
  private key(e: KeyboardEvent): void {
    if (e.target === this.ui?.field) { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.noteClose(true); } else if (e.code === 'Escape') { e.preventDefault(); this.noteClose(false); } e.stopImmediatePropagation(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) this.held.clear();   // (a key let go under Cmd sends no keyup on a Mac: no slide outlives a chord)
    if (e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/.test(e.code)) return;
    // (the game's own hidden key sink — game/input.ts: a framed page focuses it on a press of the picture — is not a field somebody types in)
    const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || (t.tagName === 'TEXTAREA' && t.getAttribute('aria-label') !== 'game input'))) return;
    e.stopImmediatePropagation(); if (!this.tape || !this.ui) return;   // (before the page stands the keys do nothing)
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { if (this.playing) this.pause(); else this.play(); } }
    else if (e.code === 'KeyN' && !e.repeat) { e.preventDefault(); this.noteOpen(null); }
    else if (FLY.has(e.code)) this.held.add(e.code);
    else if (e.code === 'KeyC' && !e.repeat) this.camSet(null);
    else if (e.code === 'KeyM' && !e.repeat) this.mapOpen();
    else if (e.code === 'KeyF' && !e.repeat) { this.fogSet(); }
    else if (e.code === 'KeyV' && !e.repeat) { this.nvSet(); }
    // (the pace by the CHARACTER the key types, not where the key sits: `-` and `+` are other keys on other keyboards; `=` and `_` are the same two unshifted / shifted on this one)
    else if ((e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') && !e.repeat) this.speedSet(speedStep(this.speed, -1));
    else if ((e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') && !e.repeat) this.speedSet(speedStep(this.speed, 1));
    else if (e.code === 'Escape' && !this.ui.modal.hidden) { e.preventDefault(); this.mapOpen(false); }
    else if (e.code === 'ArrowRight' && !e.repeat) { let f = this.f; const to = this.tAt[this.f] + 10; while (f < this.tape.ticks && this.tAt[f] < to) f++; this.seek(f); }
    else if (e.code === 'ArrowLeft' && !e.repeat) { let f = this.f; const to = this.tAt[this.f] - 10; while (f > 0 && this.tAt[f] > to) f--; this.seek(f); }
  }
  private build(): void {
    if (typeof document === 'undefined' || !this.tape) return; const T = this.tape, F = this.F!;
    const css = document.createElement('style'); css.textContent = `
#tapebar{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--h-field,rgb(21,19,16));border-top:1px solid rgba(233,226,214,.14);color:#e9e2d6;font:12px/1.2 var(--m-head,system-ui),system-ui,sans-serif;letter-spacing:.04em;user-select:none}
#tapebar button,#tapebar a{all:unset;cursor:pointer;padding:5px 9px;border:1px solid rgba(233,226,214,.28);border-radius:3px;color:inherit;text-transform:uppercase}
#tapebar button:hover,#tapebar a:hover{border-color:var(--m-accent,#e8833a);color:var(--m-accent,#e8833a)}
#tapebar [hidden]{display:none}
#tapebar .seg{display:flex;border:1px solid rgba(233,226,214,.28);border-radius:3px;overflow:hidden}
#tapebar .seg button{border:0;border-left:1px solid rgba(233,226,214,.28);border-radius:0;color:rgba(233,226,214,.45)}
#tapebar .seg button:first-child{border-left:0}
#tapebar .seg button:hover{color:var(--m-accent,#e8833a)}
#tapebar .seg button.on{color:var(--m-accent,#e8833a);background:rgba(232,131,58,.16);box-shadow:inset 0 -2px 0 var(--m-accent,#e8833a)}
#tapebar .pace button{min-width:.8em;text-align:center;color:inherit}
#tapebar .pace .x{min-width:1.7em;font-variant-numeric:tabular-nums}
#tapebar .pace button.end{color:rgba(233,226,214,.25);cursor:default}
#tapebar .gap{width:1px;align-self:stretch;margin:2px 2px;background:rgba(233,226,214,.14)}
#tapebar .pp{min-width:1.2em;text-align:center}
#tapebar .save{min-width:5.4em;text-align:center}
#tapebar .time{font-variant-numeric:tabular-nums;min-width:8.5em;text-align:center}
#tapebar .line{position:relative;flex:1;height:28px;cursor:pointer;touch-action:none}
#tapebar .line canvas{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
#tapebar .fill{position:absolute;left:0;top:0;height:100%;min-width:2px;border-right:2px solid var(--h-hi,#f0e9d9);border-bottom:2px solid var(--m-accent,#e8833a);box-sizing:border-box;pointer-events:none}
#tapebar .fill::after{content:'';position:absolute;right:-5px;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--h-hi,#f0e9d9)}
#tapebar .tk{position:absolute;top:-6px;transform:translateX(-50%);min-width:13px;height:13px;padding:0 2px;box-sizing:border-box;border-radius:7px;background:#f2cf6b;color:var(--h-on,#140d05);font:700 9px/13px system-ui,sans-serif;text-align:center;letter-spacing:0}
#tapebar .tk::after{content:'';position:absolute;left:50%;top:13px;width:1px;height:21px;background:#f2cf6b;opacity:.55}
#tapebar .parted{position:absolute;top:0;width:0;height:100%;margin-left:-1px;border-left:2px dashed #ffb35c;pointer-events:none}
#tapebar .ghost{position:absolute;top:0;width:1px;height:100%;background:rgba(233,226,214,.7);pointer-events:none}
#tapebar .ghost::after{content:attr(data-t);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);padding:2px 6px;border-radius:2px;background:var(--h-field,rgb(21,19,16));font-variant-numeric:tabular-nums;white-space:nowrap}
#tapemap{position:fixed;right:12px;top:12px;z-index:70;border:1px solid rgb(72,73,70);border-radius:3px;background:var(--h-base,#0c0b09);cursor:pointer}
#tapemap:hover{border-color:var(--m-accent,#e8833a)}
#tapemapbig{position:fixed;left:0;right:0;top:0;bottom:44px;z-index:72;display:grid;place-items:center;background:var(--h-base,#0c0b09);cursor:pointer}
#tapemapbig[hidden]{display:none}
#tapemapbig canvas{border:1px solid rgb(72,73,70);border-radius:3px;background:var(--h-base,#0c0b09);cursor:crosshair}
#tapebar .say{min-width:0;white-space:nowrap;opacity:.8}
#tapebar .say:empty,#tapebar .say.ok{display:none}
body:has(#panel:not(.hidden)) #tapemap{right:calc(380px * var(--tz, 1) + 12px)}
body.taping #equip{bottom:calc(86px + (var(--tape-h,44px) + var(--sndl-h,0px)) / var(--tz, 1))}
body.taping #meters{bottom:calc(16px + (var(--tape-h,44px) + var(--sndl-h,0px)) / var(--tz, 1))}
body.tapetight #equip,body.tapetight #meters{visibility:hidden}
body.taping #log{bottom:calc(44px + (var(--tape-h,44px) + var(--sndl-h,0px)) / var(--tz, 1))}
body.taping #checkpoint,body.taping #journal{right:calc((var(--tape-map,236px) + 26px) / var(--tz, 1))}
body.taping #replaytag{right:calc((var(--tape-map,236px) + 26px) / var(--tz, 1)) !important}
#tapebar .say.off{color:#ffb35c;opacity:1}
#tapebig{position:fixed;left:0;right:0;top:0;bottom:calc((var(--tape-h,44px) + var(--sndl-h,0px)) / var(--tz, 1));z-index:69;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#e9e2d6;font:14px var(--m-head,system-ui),system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
#tapebig b{display:grid;place-items:center;width:84px;height:84px;border:2px solid var(--m-accent,#e8833a);border-radius:50%;font-size:34px;color:var(--m-accent,#e8833a);padding-left:6px;box-sizing:border-box;background:var(--h-field,rgb(21,19,16))}
#tapebig span{padding:5px 12px;border-radius:3px;background:var(--h-field,rgb(21,19,16))}
#tapenote{position:fixed;left:50%;bottom:calc((var(--tape-h,44px) + var(--sndl-h,0px)) / var(--tz, 1) + 10px);transform:translateX(-50%);z-index:71;width:min(560px,calc(100vw / var(--tz, 1) - 32px))}
#tapenote input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--m-accent,#e8833a);border-radius:3px;background:var(--h-field,rgb(21,19,16));color:#e9e2d6;font:14px system-ui,sans-serif;outline:none}`;
    document.head.append(css);
    const el = <K2 extends keyof HTMLElementTagNameMap>(tag: K2, cls = '', text = ''): HTMLElementTagNameMap[K2] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    const bar = el('div'); bar.id = 'tapebar';
    const play = el('button', 'pp', '▶'); play.title = 'Space'; play.onclick = () => { if (this.playing) this.pause(); else this.play(); };
    const time = el('span', 'time'); const line = el('div', 'line'), marks = el('canvas'), fill = el('div', 'fill'), ticks = el('div'), ghost = el('div', 'ghost'), parted = el('div', 'parted'); ghost.hidden = true; parted.hidden = true; line.append(marks, parted, fill, ticks, ghost);
    // the line is dragged to scrub: a ghost playhead with its time follows the pointer, and the seek is made when the button comes up (a seek back is a page load)
    { const at = (e: MouseEvent): number => { const r = line.getBoundingClientRect(); return clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1); };
      const show = (e: MouseEvent): void => { const k = at(e); ghost.hidden = false; ghost.style.left = `${100 * k}%`; ghost.dataset.t = clock(this.tAt[T.ticks] * k); };
      const go = (e: MouseEvent): void => { const to = this.tAt[T.ticks] * at(e); let f = 0; while (f < T.ticks && this.tAt[f] < to) f++; this.seek(f); };
      let scrub = -1, done = false;
      line.addEventListener('pointerdown', e => { if (e.button !== 0) return; scrub = e.pointerId; done = false; try { line.setPointerCapture(e.pointerId); } catch { /* */ } show(e); });
      line.addEventListener('pointermove', e => { if (scrub >= 0 && e.pointerId === scrub && !e.buttons) { scrub = -1; ghost.hidden = true; return; } show(e); });
      line.addEventListener('pointerleave', () => { if (scrub < 0) ghost.hidden = true; });
      const end = (e: PointerEvent, seek: boolean): void => { if (e.pointerId !== scrub) return; scrub = -1; try { line.releasePointerCapture(e.pointerId); } catch { /* */ } ghost.hidden = true; if (seek) { done = true; go(e); setTimeout(() => { done = false; }, 0); } };
      line.addEventListener('pointerup', e => end(e, true)); line.addEventListener('pointercancel', e => end(e, false));
      line.onclick = e => { if (done) { done = false; return; } go(e); }; }   // (a click with no press before it — a script's — seeks too)
    // the pace: slower · what it is now (lit off 1×; a click is 1× again) · faster
    const speed = el('button', 'x', '1×'), slow = el('button', '', '−'), fast = el('button', '', '+'), pace = el('div', 'seg pace'); pace.append(slow, speed, fast);
    slow.title = '-'; fast.title = '+';   // (each lets go of the keyboard once pressed: Enter on a button that kept it would press it again)
    slow.onclick = () => { slow.blur(); this.speedSet(speedStep(this.speed, -1)); }; fast.onclick = () => { fast.blur(); this.speedSet(speedStep(this.speed, 1)); }; speed.onclick = () => { speed.blur(); this.speedSet(1); };
    const note = el('button', '', 'Note'); note.title = 'N — or click the picture'; note.onclick = () => this.noteOpen(null);
    const save = el('button', 'save', 'Save ↓'); save.title = 'download this replay, your notes in it'; save.onclick = () => { save.blur(); void this.saveFile().then(name => { if (!name) return; save.textContent = 'Saved ✓'; setTimeout(() => { save.textContent = 'Save ↓'; }, 2500); }, () => { /* */ }); };
    let map: HTMLAnchorElement | null = null;
    if (!document.querySelector('meta[name="tps-one-page"]')) { map = el('a', '', 'Map'); map.title = 'the same replay in the map viewer'; map.onclick = e => { e.preventDefault(); this.toMap(); }; }
    const back = el('button', '', '‹ Game'); back.title = 'back to the game'; back.onclick = () => this.toGame();
    const view = el('button', '', 'Player view'); view.title = 'C'; view.onclick = () => this.camSet(null);
    const fog = el('button', '', 'Fog'); fog.title = 'F'; fog.hidden = true; fog.onclick = () => this.fogSet();
    const nv = el('button', '', 'NV'); nv.title = 'V'; nv.onclick = () => this.nvSet();
    // three groups, left to right: the run (play, pace, clock, the line) · what the picture shows (lit = on) · what leaves a mark or the page
    const say = el('span', 'say'), seg = el('div', 'seg'); seg.append(view, fog, nv); bar.append(back, el('i', 'gap'), play, pace, time, line, seg, el('i', 'gap'), note, save, ...(map ? [map] : []), say);
    const big = el('div'); big.id = 'tapebig'; big.append(el('b', '', '▶'), el('span', '', `${F.level.scenario || F.level.file || 'the night'} · ${clock(this.tAt[T.ticks])}`)); big.onclick = () => this.play();
    const box = el('div'); box.id = 'tapenote'; box.hidden = true; const field = el('input'); field.type = 'text'; field.maxLength = 400; box.append(field);
    const mini = el('canvas'); mini.id = 'tapemap'; mini.title = 'M'; { const [w, h2] = mapSize(F.map.bounds, 236, 176, 6); mini.style.width = `${w}px`; mini.style.height = `${h2}px`; document.documentElement.style.setProperty('--tape-map', `${w}px`); } mini.onclick = () => this.mapOpen(true);
    const modal = el('div'); modal.id = 'tapemapbig'; modal.hidden = true; const large = el('canvas'); modal.append(large);
    modal.onclick = e => { if (e.target === large) { const L = this.floors.get(large), r = large.getBoundingClientRect(); if (L) { const [x, z] = mapToWorld(L.fit, e.clientX - r.left - large.clientLeft, e.clientY - r.top - large.clientTop); this.camSet({ look: [x, this.view().look[1], z] }); } } this.mapOpen(false); };
    for (const c of F.cast) this.names.set(c.id, c.kind === 'player' ? PLAYER_NAME : c.name);
    document.body.append(bar, big, box, mini, modal); document.body.classList.add('taping');   // (the game's own kit, meters and radio lines stand clear of the bar while a tape has the page)
    window.addEventListener('resize', () => this.lay()); window.addEventListener(TEXT_EVENT, () => this.lay());   // (the text size stepped under a replay: the bar is taller or shorter in the window)
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => this.lay()); ro.observe(bar); ro.observe(line); }
    for (const e of [bar, big, box, mini, modal]) for (const ev of ['mousedown', 'pointerdown', 'contextmenu', 'wheel']) e.addEventListener(ev, x => x.stopPropagation());
    // a click on the picture = a note at that spot of the floor
    const h = this.host!; this.mouse(h.canvas);
    h.canvas.addEventListener('click', e => { if (this.dragged) { this.dragged = false; return; } if (this.noting || !this.tape) return; const r = h.canvas.getBoundingClientRect(); const p = h.cam.groundPoint((e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)); this.noteOpen(p ? [p[0], p[2]] : null); });
    this.ui = { bar, play, time, line, fill, parted, ticks, speed, slow, fast, view, fog, nv, note, map, say, big, box, field, marks, ghost, mini, modal, large };
    this.ticks(); this.lay(); this.paint();
  }
  /** a moment of the file's TRACE (seconds from its start) on the tape's clock: the sample at or before it gives the step, the rest is counted on */
  private tapeT(r: number): number {
    const D = this.D, F = this.F, T = this.tape; if (!D || !F || !T || !F.samples.length) return 0;
    const i = sampleAt(D, r); return this.tAt[clamp(F.samples[i].n, 0, T.ticks)] + Math.max(0, r - D.r[i]);
  }
  /** the trace's clock where the run stands (−∞ before the trace's first sample: a tape can start before the file's five minutes do) */
  private traceNow(): number {
    const D = this.D, F = this.F, T = this.tape; if (!D || !F || !T || this.lastSi < 0) return -Infinity;
    return D.r[this.lastSi] + Math.max(0, this.tAt[Math.min(this.f, T.ticks)] - this.tAt[clamp(F.samples[this.lastSi].n, 0, T.ticks)]);
  }
  /** the line's marks: what the trace says happened when (the 2D viewer's timeline, on this bar) */
  private lineDraw(): void {
    const u = this.ui, F = this.F, T = this.tape; if (!u || !F || !T) return; const W = u.line.clientWidth, H = u.line.clientHeight; if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1) * textZoom(), end = this.tAt[T.ticks] || 1, at = (r: number): number => clamp(this.tapeT(r) / end, 0, 1), M: LineMark[] = [];   // (a canvas drawn inside a zoomed layer: ui/textsize.ts)
    for (const e of F.events) M.push({ at: at(e.r), kind: e.k === 'bang' || e.k === 'frag' ? 'blast' : e.k === 'shot' ? 'shot' : e.k === 'guardShot' ? 'guardShot' : 'other' });
    for (const l of F.lines) { if (l.k === 'order') M.push({ at: at(l.r), kind: 'order' }); else if (l.k === 'mark') M.push({ at: at(l.r), kind: isErrorMark(l) ? 'error' : 'mark' }); }
    // (the trace holds the file's last minutes only: the stretch of the tape it covers is drawn solid, the rest hatched — a run walked with no marks to show)
    const D = this.D, kept: [number, number] | null = D && F.samples.length ? [at(D.r[0]), at(D.r[F.samples.length - 1])] : null;
    u.marks.width = Math.round(W * dpr); u.marks.height = Math.round(H * dpr); const ctx = u.marks.getContext('2d'); if (ctx) drawLine(ctx, W, H, dpr, M, kept);
  }
  /** the map, large or put away (no argument = the other way) */
  private mapOpen(open?: boolean): boolean {
    const u = this.ui; if (!u || !this.F) return false; const on = open ?? !!u.modal.hidden; if (on === !u.modal.hidden) return on;
    u.modal.hidden = !on; if (on) { this.lay(); this.mapDraw(); } return on;
  }
  /** what hangs on the window's size: the bar's height is told to the page (the HUD and the note box stand on it), the large map fills what is left, the line's marks are redrawn; the small map is in the top corner, clear of the bar and of whatever stands on it */
  private lay(): void {
    // (THE BAR IS ONE OF THE TEXT SIZE'S LAYERS — ui/textsize.ts — and what the page is told of it is in the WINDOW's pixels: the HUD's rules and the large map
    //  read `--tape-h` that way, and the sound lanes' dock, which is no layer, measures the bar the same way itself (soundlanes.ts paint()). A rectangle measured off a zoomed element is the window's on an engine that answers so, the
    //  layer's own on one that does not: either way × textZoom() / rectZoom() is the window's.)
    const u = this.ui, F = this.F; if (!u || !F) return; const bh = Math.round(u.bar.getBoundingClientRect().height * textZoom() / rectZoom()) || 44;
    document.documentElement.style.setProperty('--tape-h', `${bh}px`); u.modal.style.bottom = `${bh}px`;
    if (!u.modal.hidden) { const [w, h] = mapSize(F.map.bounds, window.innerWidth * 0.92, (window.innerHeight - bh) * 0.92, 26); u.large.style.width = `${w}px`; u.large.style.height = `${h}px`; }
    this.lineDraw();
  }
  /** what the map shows this frame: the game as it stands on this page, the picture's camera, the trace's rounds of the last second, the notes with a spot */
  private scene(): MapScene {
    const g = this.host!.game, F = this.F!, men: MapMan[] = [], v = this.view(), now = this.traceNow(), pl = g.player;
    men.push({ x: pl.char.pos[0], z: pl.char.pos[2], aim: pl.char.aimYaw, team: 'player', kind: 'player', down: !!pl.down, name: this.names.get(pl.char.id) ?? '', ring: null });
    for (const gd of g.guards) men.push({ x: gd.char.pos[0], z: gd.char.pos[2], aim: gd.char.aimYaw, team: gd.team, kind: 'man', down: gd.state === 'dead', name: this.names.get(gd.char.id) ?? '', ring: gd.team !== 'operative' ? MAP_RING[gd.state] ?? null : null });
    for (const gd of g.civilians) men.push({ x: gd.char.pos[0], z: gd.char.pos[2], aim: gd.char.aimYaw, team: 'civilian', kind: 'civ', down: gd.state === 'dead', name: this.names.get(gd.char.id) ?? '', ring: null });
    const doors = g.doors.list.map(d => { const [ux, uz] = d.dir(); return { hx: d.def.hinge[0], hz: d.def.hinge[1], ux, uz, width: d.def.width, locked: d.locked, broken: d.lockBroken, off: d.off }; });
    const shots: MapScene['shots'] = [], E = F.events;
    if (Number.isFinite(now)) { let lo = 0, hi = E.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (E[mid].r < now - SHOT_S) lo = mid + 1; else hi = mid; }
      for (let i = lo; i < E.length && E[i].r <= now; i++) { const e = E[i]; if (e.k === 'shot' || e.k === 'guardShot' || e.k === 'bang' || e.k === 'frag') shots.push({ x: e.x, z: e.z, to: e.to ?? null, kind: e.k, age: (now - e.r) / SHOT_S }); } }
    const notes: MapScene['notes'] = []; F.notes.forEach((n, i) => { if (n.pos) notes.push({ x: n.pos[0], z: n.pos[1], i: i + 1 }); });
    return { men, doors, shots, notes, cam: { x: v.look[0], z: v.look[2], fx: -Math.sin(v.yaw), fz: -Math.cos(v.yaw) } };
  }
  private mapDraw(): void {
    const u = this.ui, F = this.F; if (!u || !F || !this.host || !this.tape) return;
    let S: MapScene | null = null;
    for (const [cv, big] of [[u.mini, false], [u.large, true]] as const) {
      if (big && u.modal.hidden) continue; const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) continue;
      const dpr = Math.min(2, window.devicePixelRatio || 1); let L = this.floors.get(cv);
      if (!L || L.W !== W || L.H !== H || L.dpr !== dpr) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
        const fit = mapFit(F.map.bounds, W, H, big ? 26 : 6), fx = c.getContext('2d'); if (fx) drawFloor(fx, W, H, dpr, F.map, fit); L = { c, W, H, dpr, fit }; this.floors.set(cv, L);
      }
      const ctx = cv.getContext('2d'); if (!ctx) continue; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(L.c, 0, 0);
      drawScene(ctx, L.dpr, S ??= this.scene(), L.fit, big);
    }
  }
  private ticks(): void {
    const u = this.ui, T = this.tape; if (!u || !T || !this.F) return; u.ticks.textContent = ''; const end = this.tAt[T.ticks] || 1;
    for (const n of this.F.notes) { const d = document.createElement('div'); d.className = 'tk'; d.textContent = String(u.ticks.childElementCount + 1); d.style.left = `${100 * this.tAt[Math.max(0, Math.min(T.ticks, n.n))] / end}%`; d.title = n.text; u.ticks.append(d); }
  }
  private painted = ''; private tight = false;
  /** the game's kit and meters stand on the bar and on whatever stands on it; where that would push them into the orders panel they are not drawn (hidden, not removed: the test reads the same either way) */
  private hudRoom(): void {
    const kit = document.getElementById('equip'), top = document.getElementById('lcol'); if (!kit || !top) return;
    const tight = kit.getBoundingClientRect().top < top.getBoundingClientRect().bottom + 6;
    if (tight !== this.tight) { this.tight = tight; document.body.classList.toggle('tapetight', tight); }
  }
  private paint(): void {
    this.hudRoom();
    const u = this.ui, T = this.tape; if (!u || !T) return; const end = this.tAt[T.ticks] || 1, now = this.tAt[Math.min(this.f, T.ticks)];
    const seeking = this.seekTo > this.f, d = this.drift, fogged = !!this.host?.game.fogOfWar.active;   // (the switch is on the bar only while the run is under the fog)
    const said = seeking ? '…' : this.unkept ? 'note not kept: no shelf in this browser' : d ? `off the recording from ${clock(this.tAt[Math.min(d.f, T.ticks)])}` : this.compared ? 'as recorded' : '';
    const sig = `${this.playing}|${this.ended}|${Math.round(now * 10)}|${this.speed}|${said}|${!!this.free}|${this.nofog}|${fogged}|${this.nvView}|${this.tube()}`; if (sig === this.painted) return; this.painted = sig;
    u.play.textContent = this.ended ? '↺' : this.playing ? '❚❚' : '▶'; u.time.textContent = `${clock(now)} / ${clock(end)}`; u.fill.style.width = `${100 * now / end}%`; u.speed.textContent = speedName(this.speed); u.speed.classList.toggle('on', this.speed !== 1); u.slow.classList.toggle('end', this.speed <= TAPE_SPEEDS[0]); u.fast.classList.toggle('end', this.speed >= TAPE_SPEEDS[TAPE_SPEEDS.length - 1]); u.view.classList.toggle('on', !this.free); u.fog.hidden = !fogged; u.fog.classList.toggle('off', this.nofog); u.fog.classList.toggle('on', !this.nofog); u.nv.classList.toggle('on', this.tube());
    u.parted.hidden = !d; if (d) u.parted.style.left = `${100 * this.tAt[Math.min(d.f, T.ticks)] / end}%`;
    u.say.textContent = said; u.say.className = seeking ? 'say' : d || this.unkept ? 'say off' : 'say ok'; u.say.title = d ? `${d.who} stood ${Number.isFinite(d.metres) ? d.metres.toFixed(2) + ' m' : 'nowhere'} from where the recording had him (step ${d.f})` : '';
  }
  private refusal(): void {
    if (typeof document === 'undefined') return;
    const d = document.createElement('div'); d.id = 'taperefuse'; d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:80;max-width:min(640px,calc(100vw / var(--tz, 1) - 32px));padding:12px 16px;background:var(--h-field,rgb(21,19,16));color:#e9e2d6;border:1px solid #e8833a;border-radius:3px;font:14px/1.4 system-ui,sans-serif';
    d.textContent = this.refuse + ' ';
    if (this.id !== null && !document.querySelector('meta[name="tps-one-page"]')) { const a = document.createElement('a'); a.textContent = 'Open the map'; a.href = viewerUrl(this.id); a.style.color = '#e8833a'; d.append(a); }
    const put2 = () => document.body.append(d); if (document.body) put2(); else window.addEventListener('DOMContentLoaded', put2);
  }
}
