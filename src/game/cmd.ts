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
// Not here yet (the plan's later steps): a second seat, a record that is validated or bounded, picks resolved without the seat's matrices.
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
