// THE PLAYER'S INPUT AS PLAIN DATA (engine groundwork for two-player co-op; nothing here is networked). What a player does in one game tick is ONE record — a PlayerCmd:
// the keys held and the keys that went down, the mouse buttons, the wheel, the cursor, and how his seat looks at the world (its view as numbers). Game.update, which the
// page, the harness and a replay call with the live Input / camera / canvas, SAMPLES that record (sampleCmd) and hands it to Game.step, and from there on the simulation
// reads the record and nothing else of the host: no Input object the DOM writes into, no camera the frame loop is still easing, no canvas. A record is plain data (cmdText / cmdFromText: JSON, to the bit): it can be
// kept, sent, and played back with no camera at all (tools/qa/cmd-check.ts plays a run back from its records alone and gets the same game).
//   WHY THE SEAT'S VIEW RIDES THE RECORD: the reticle's snaps are measured in the seat's own pixels (aim.ts SNAP_PX, the light snap, the squad menu's cursor), the walk keys
//   are relative to the way the seat looks, and a line is a bubble or a log row by whether the seat can see the man. So the record carries the view as data (two matrices,
//   the pose, the view's size) and the GAME does the picking from it: a client says where it looks from, never what it hit.
//   HOW THE GAME READS IT: Seat (one per Game today: `Game.seat`) keeps an Input and a FollowCamera of the game's OWN and loads each record into them, so the player's code
//   (player.ts, orders.ts, interact.ts, …) reads `input.hit(…)` / `cam.ray(…)` exactly as it always did — off the record. What the step hands back for the seat's camera
//   (the wall peek's nudge, a blast's kick, a scenario's opening cut — takeCut) is left on the seat's lens and copied to the host's camera by Game.update.
//   A RECORD FROM ANYONE (`CMDCHECK.on`, checkCmd below): before a tick reads its record the record is made one an honest seat could have sent — the right shape, finite
//   numbers inside bounds, key codes that look like key codes, no more of anything than a tick can hold; and for a seat the game does not trust (`Seat.remote`:
//   nobody today) the eye and the two matrices are WORKED OUT AGAIN from the look-at, the angles and the lens instead of believed, the look-at held near the seat's
//   own man. An honest record comes through unchanged to the bit (cmdcheck-check.ts holds that); what was put right is counted on the seat.
// Not here yet (the plan's later steps): a second seat (`Game.seats` is a list of one), picks resolved without the seat's view at all.
import type { Vec3 } from '../math/vec';
import type { View } from '../host/hud';
import { Input } from './input';
import { FollowCamera } from './camera';
import type { Game } from './game';

/** one player's input for one game tick: plain numbers and strings, nothing else */
export interface PlayerCmd {
  /** key codes held, and those that went down this tick (the one-tick edges; 'Blur' among them) */
  keys: string[]; pressed: string[];
  /** mouse buttons held / gone down this tick (bits 1 << MouseEvent.button), and the plain wheel's travel */
  buttons: number; clicked: number; wheel: number;
  /** the cursor in the seat's own view (CSS px), and that view's size: CSS px, then backing-store px */
  mx: number; my: number; w: number; h: number; pw: number; ph: number;
  /** how the seat looks at the world as this tick begins: view-projection and its inverse (column-major, as the camera keeps them) and the pose they were built from */
  view: { vp: number[]; ivp: number[]; pos: Vec3; forward: Vec3; target: Vec3; yaw: number; pitch: number; distance: number; fov: number; aspect: number;
    /** how far the seat's camera leads toward the aim point (FollowCamera.aimLead: a panel slider) — a tick may ask how the lens will follow */
    aimLead: number };
}

/** the record for this tick, sampled from the host's live input, camera and view. Game.update calls it once, after the journal and a showcase's injected keys.
 *  (A showcase puppet AIMS by moving the cursor: done here, on the host's input, so the HUD's reticle follows — updateAim finds the cursor already there.) */
export function sampleCmd(g: Game, input: Input, cam: FollowCamera, canvas: View, into: PlayerCmd | null = null): PlayerCmd {
  if (g.puppet?.aim) {
    const [sx, sy, front] = cam.project(g.puppet.aim, canvas.clientWidth, canvas.clientHeight, Infinity, 1e-3);
    if (front) { input.mouseX = sx; input.mouseY = sy; }
  }
  const c = into ?? { keys: [], pressed: [], buttons: 0, clicked: 0, wheel: 0, mx: 0, my: 0, w: 0, h: 0, pw: 0, ph: 0,
    view: { vp: new Array<number>(16).fill(0), ivp: new Array<number>(16).fill(0), pos: [0, 0, 0], forward: [0, 0, 0], target: [0, 0, 0], yaw: 0, pitch: 0, distance: 0, fov: 0, aspect: 0, aimLead: 0 } };
  const v = c.view;   // (`into` = last tick's record refilled in place: nothing is allocated on the frame's path)
  c.keys.length = 0; for (const k of input.keys) c.keys.push(k);
  c.pressed.length = 0; for (const k of input.pressed) c.pressed.push(k);
  c.buttons = input.buttons; c.clicked = input.clicked; c.wheel = input.wheel; c.mx = input.mouseX; c.my = input.mouseY;
  c.w = canvas.clientWidth; c.h = canvas.clientHeight; c.pw = canvas.width; c.ph = canvas.height;
  for (let i = 0; i < 16; i++) { v.vp[i] = cam.viewProj[i]; v.ivp[i] = cam.invViewProj[i]; }
  for (let i = 0; i < 3; i++) { v.pos[i] = cam.pos[i]; v.forward[i] = cam.forward[i]; v.target[i] = cam.target[i]; }
  v.yaw = cam.yaw; v.pitch = cam.pitch; v.distance = cam.distance; v.fov = cam.fov; v.aspect = cam.aspect; v.aimLead = cam.aimLead;
  return c;
}

/** a record as text and back, to the bit. Plain JSON would do but for three values it cannot carry — a negative zero (a camera square to an axis has them in its matrices
 *  and its forward), NaN and the infinities — which ride as the strings '-0' / 'nan' / 'inf' / '-inf' (no key code is spelt like one). */
export function cmdText(c: PlayerCmd): string {
  return JSON.stringify(c, (_k, x) => typeof x !== 'number' || (Number.isFinite(x) && !Object.is(x, -0)) ? x : x !== x ? 'nan' : x === 0 ? '-0' : x > 0 ? 'inf' : '-inf');
}
export function cmdFromText(t: string): PlayerCmd {
  return JSON.parse(t, (_k, x) => x === '-0' ? -0 : x === 'nan' ? NaN : x === 'inf' ? Infinity : x === '-inf' ? -Infinity : x) as PlayerCmd;
}

/** A RECORD FROM ANYONE (see the head). ON in the page (`?nocmdcheck` = a record is believed as it comes, as before), OFF on the frozen stand (`TPS_CMDCHECK=1`).
 *  The bounds are wide on purpose: they keep a record sane, they do not referee it. What referees holds only for a seat marked `remote` (nobody today: a showcase
 *  and a script pin the one local camera wherever they like, and the page's own matrices may be a step behind its pose): `reach`, how far from its own man the
 *  seat's look-at may be (its eye no further from the look-at than twice that), and the view WORKED OUT AGAIN from the look-at, the angles, the distance and the lens. */
export const CMDCHECK = { on: false, keys: 24, keyLen: 24, span: 16384, wheel: 4096, far: 1e4, distMin: 0.05, distMax: 2000, fovMin: 0.02, fovMax: 3, aspectMin: 0.05, aspectMax: 20, reach: 80,
  /** the steepest a rebuilt view looks down or up (rad): straight down has no up to build a view from */
  steep: 1.5 };
const KEY_CODE = /^[A-Za-z0-9]+$/;
let checkLens: FollowCamera | null = null;
/** `raw` made a record an honest seat could have sent, IN PLACE where it is an object (a fresh neutral record where it is not); `fixed` = how many things were
 *  put right (0 = it came through untouched, to the bit). `near` = the record is a REMOTE seat's and this is its own man: the look-at is held within
 *  CMDCHECK.reach metres of him and the eye, the forward and both matrices are the game's own working from the pose (camera.ts rebuild) — what the record said
 *  of them is never read. A local seat's matrices are the host camera's and are kept as they come while they are whole numbers. Never throws: a record that
 *  cannot be written or read (frozen, an accessor that throws — nothing JSON gives) is answered with a neutral one. */
export function checkCmd(raw: unknown, near: Vec3 | null = null): { cmd: PlayerCmd; fixed: number } {
  try { return checkCmdIn(raw, near); } catch { const r = checkCmdIn(null, near); return r; }
}
function checkCmdIn(raw: unknown, near: Vec3 | null): { cmd: PlayerCmd; fixed: number } {
  const L = CMDCHECK; let fixed = 0;
  const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
  const c = (obj(raw) ? raw : (fixed++, {})) as Record<string, unknown>;
  const num = (o: Record<string, unknown> | unknown[], k: string | number, lo: number, hi: number, dflt: number): number => {
    const x = (o as Record<string | number, unknown>)[k]; const y = typeof x === 'number' && x === x ? (x < lo ? lo : x > hi ? hi : x) : dflt;
    if (!Object.is(x, y)) { (o as Record<string | number, unknown>)[k] = y; fixed++; } return y; };
  const codes = (k: string) => { const a = c[k];
    if (!Array.isArray(a)) { c[k] = []; fixed++; return; }
    let w = 0; const n = Math.min(a.length, L.keys * 4);
    for (let i = 0; i < n && w < L.keys; i++) { const s = a[i]; if (typeof s === 'string' && s.length <= L.keyLen && KEY_CODE.test(s)) a[w++] = s; }
    if (a.length !== w) { a.length = w; fixed++; } };
  const bits = (k: string) => { const x = c[k], y = typeof x === 'number' && x === x ? (x & 31) : 0; if (!Object.is(x, y)) { c[k] = y; fixed++; } };
  const vec = (o: Record<string, unknown>, k: string, n: number, lo: number, hi: number, dflt: number): number[] => {
    let a = o[k]; if (!Array.isArray(a) || a.length !== n) { a = o[k] = new Array<number>(n).fill(dflt); fixed++; }
    for (let i = 0; i < n; i++) num(a as unknown[], i, lo, hi, dflt); return a as number[]; };
  codes('keys'); codes('pressed'); bits('buttons'); bits('clicked'); num(c, 'wheel', -L.wheel, L.wheel, 0);
  const w = num(c, 'w', 1, L.span, 1280), h = num(c, 'h', 1, L.span, 720); num(c, 'pw', 1, L.span, w); num(c, 'ph', 1, L.span, h);
  num(c, 'mx', -L.span, 2 * L.span, w / 2); num(c, 'my', -L.span, 2 * L.span, h / 2);
  if (!obj(c.view)) { c.view = {}; fixed++; }
  const v = c.view as Record<string, unknown>;
  const pos = vec(v, 'pos', 3, -L.far, L.far, 0), target = vec(v, 'target', 3, -L.far, L.far, 0), fwd = vec(v, 'forward', 3, -1, 1, 0);
  const yaw = num(v, 'yaw', -1e4, 1e4, 0), pitch = num(v, 'pitch', -Math.PI, Math.PI, 0.96); let dist = num(v, 'distance', L.distMin, L.distMax, 21);
  const fov = num(v, 'fov', L.fovMin, L.fovMax, 0.6), aspect = num(v, 'aspect', L.aspectMin, L.aspectMax, w / h); num(v, 'aimLead', 0, 1, 0);
  const mats = (k: string): number[] => { let a = v[k]; if (!Array.isArray(a) || a.length !== 16) { a = v[k] = new Array<number>(16).fill(NaN); fixed++; } return a as number[]; };
  const vp = mats('vp'), ivp = mats('ivp');
  let whole = true; for (let i = 0; i < 16; i++) if (!Number.isFinite(vp[i]) || !Number.isFinite(ivp[i])) whole = false;
  if (near && L.reach > 0) {   // a remote seat looks at its own man's surroundings: the look-at is pulled back inside `reach`
    const dx = target[0] - near[0], dy = target[1] - near[1], dz = target[2] - near[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > L.reach) { const k = L.reach / d; target[0] = near[0] + dx * k; target[1] = near[1] + dy * k; target[2] = near[2] + dz * k; fixed++; }
    if (dist > 2 * L.reach) { dist = v.distance = 2 * L.reach; fixed++; }   // … and the eye no further from it than twice that
  }
  if (near || !whole) {
    // the view from the pose, as the camera works it out (camera.ts rebuild: the same working a re-run does from the tape's pose) — a remote seat's always, a local
    // one's only when its matrices are not numbers. The pose is the look-at, the two angles and the distance; the pitch is held off straight down.
    const S = checkLens ??= new FollowCamera();
    const p = pitch > L.steep ? L.steep : pitch < -L.steep ? -L.steep : pitch; if (p !== pitch) { v.pitch = p; fixed++; }
    S.target[0] = target[0]; S.target[1] = target[1]; S.target[2] = target[2]; S.yaw = yaw; S.pitch = p; S.distance = dist; S.fov = fov; S.aspect = aspect; S.rebuild();
    const put = (a: number[], m: ArrayLike<number>, n: number) => { let off = false; for (let i = 0; i < n; i++) if (!Object.is(a[i], m[i])) { a[i] = m[i]; off = true; } if (off) fixed++; };
    put(pos, S.pos, 3); put(fwd, S.forward, 3); put(vp, S.viewProj, 16); put(ivp, S.invViewProj, 16);
  }
  return { cmd: c as unknown as PlayerCmd, fixed };
}

/** a player's seat inside the Game: the record of the tick, loaded into an Input and a camera of the game's own for the code that reads them */
export class Seat {
  /** the tick's keys / buttons / cursor (a detached Input: nothing but load() and the tick's own code writes it) */
  readonly input = Input.detached();
  /** the tick's view (a camera nobody eases or rebuilds: its matrices and pose are the record's, to the bit). `peekOffset` and `kick` are the step's OUTPUT for the seat's camera */
  readonly cam = new FollowCamera();
  /** the tick's view size */
  readonly canvas: View = { clientWidth: 0, clientHeight: 0, width: 0, height: 0 };
  /** the last record loaded (null before the first tick) */
  cmd: PlayerCmd | null = null;
  /** this seat's records come from somewhere the game does not trust (nobody today): its look-at is held near its own man (checkCmd `near`) */
  remote = false;
  /** things put right in this seat's records so far, and the records that needed any (checkCmd under CMDCHECK.on): an honest seat keeps both at 0 */
  fixed = 0; fixedCmds = 0;
  /** buttons the game has swallowed until they are let go (swallow) */
  private mask = 0;

  load(c: PlayerCmd): void {
    this.cmd = c;
    const i = this.input, cam = this.cam, cv = this.canvas, v = c.view;
    i.keys.clear(); for (const k of c.keys) i.keys.add(k);
    i.pressed.clear(); for (const k of c.pressed) i.pressed.add(k);
    this.mask &= c.buttons & ~c.clicked;   // (let go, or pressed afresh since the last record: the swallow is over)
    i.buttons = c.buttons & ~this.mask; i.clicked = c.clicked; i.wheel = c.wheel; i.mouseX = c.mx; i.mouseY = c.my;
    cv.clientWidth = c.w; cv.clientHeight = c.h; cv.width = c.pw; cv.height = c.ph;
    cam.viewProj.set(v.vp); cam.invViewProj.set(v.ivp);
    for (let k = 0; k < 3; k++) { cam.pos[k] = v.pos[k]; cam.forward[k] = v.forward[k]; cam.target[k] = v.target[k]; }
    cam.yaw = v.yaw; cam.pitch = v.pitch; cam.distance = v.distance; cam.fov = v.fov; cam.aspect = v.aspect; cam.aimLead = v.aimLead;
  }
  /** the game took these held buttons for something of its own (the order menu's click that gives a row): they read as up until the player lets go */
  swallow(bits: number): void { this.mask |= bits; this.input.buttons &= ~bits; }
  /** OUTPUT: a tick CUT the seat's camera (a scenario's opening: nightbreach.ts / rescue.ts write `target` and `desired` afresh on the lens they are handed) → the look-at to
   *  snap the host's camera to, once; null = no cut since the last call. It waits here until somebody takes it (a game stepped from records has nobody). */
  takeCut(): Vec3 | null { const cam = this.cam; if (cam.desired === this.mark) return null; this.mark = cam.desired; return cam.desired; }   // (`desired` = the cut's own copy: the next record's load overwrites `target`)
  private mark: Vec3 = this.cam.desired;
}
