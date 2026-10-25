// THE WALK OVER A RUN TAPE (src/game/runtape.ts writes one, format.ts RunTape is its shape): the row cursors that turn the tape's streams into what ONE STEP
// is handed — its dt, the view's size, the camera's nine numbers, the player's input, the sensor answers — and the rows done to the game from outside a step.
// Two hosts walk a tape, and both walk it through this file so they cannot drift: the engine replay on the page (engineplay.ts) and the headless re-run
// (tools/qa/rerun.ts). Each host keeps its own stand-up, its own stepping and what it does between two steps; nothing of the game is imported here.
//
//   for (const [kind, data] of walk.outside()) …the host applies a restart / flags / tune / table / kit / pose / posein row (the last two: game/runtape.ts tapePoses)…
//   const dt = walk.step(view, input);  walk.layCamera(camera);   …the tape's camera for this step, its matrices as the page's step read them…
//   game.update(dt, input, cam, view); walk.done();
//
// `game.sensors.read = key => walk.read(key)` serves the tape's answers: inside a step the k-th read of a key gets the tape's k-th value for it, a read the
// tape never made there gets the key's last value and is counted (`unjournaled`); outside a step every read is the last value.
import type { RunTape, TapeVal } from './format';
import { tapeNum } from './format';

/** the view's four sizes a step reads (a canvas, or a stand-in for one) */
export interface WalkView { clientWidth: number; clientHeight: number; width: number; height: number }
/** the camera a step is handed (game/camera.ts FollowCamera is one) */
export interface WalkCamera { target: [number, number, number]; yaw: number; pitch: number; distance: number; aspect: number; fov: number; aimLead: number; rebuild(): void;
  viewProj: { [i: number]: number }; invViewProj: { [i: number]: number }; pos: { [i: number]: number }; forward: { [i: number]: number } }
/** the input a step reads (game/input.ts Input has these) */
export interface WalkInput { keys: Set<string>; pressed: Set<string>; clicked: number; buttons: number; mouseX: number; mouseY: number; wheel: number }

const ctrlHeld = (k: readonly string[]) => k.includes('ControlLeft') || k.includes('ControlRight');

export class TapeWalk {
  /** steps taken = the next step to take */
  f = 0;
  /** the camera as of the last step taken: target x y z · yaw · pitch · distance · aspect · fov · aim lead */
  cam: number[];
  /** the yaw the page's view matrices were BUILT with at the last step taken. Mostly `cam[3]`. A tape that keeps its lens rows (format.ts RunTape.lens) SAYS where it
   *  was not. A tape from before them is guessed at: not `cam[3]` on a step the yaw changed on with Control held then or the step before (the player orbits, Ctrl +
   *  the mouse; the key can be up by an orbit's last frame, and a yaw a tool or a show's pin turns comes with its matrices rebuilt): the host writes the camera's
   *  yaw before the game's step and rebuilds its matrices only after it (camera.ts update), so that step was handed the new yaw beside matrices of the yaw before —
   *  and the cursor's ray, read off those matrices, is the old view's. */
  lensYaw: number;
  /** the view matrices and eye of the step being taken, where the tape kept them whole (they were not what the pose builds with any yaw it knew) — else null */
  lens: number[] | null = null;
  /** sensor reads made inside a step that the tape had not made there */
  unjournaled = 0;
  /** called with every value served off the tape (a probe's hook) */
  served: ((v: number | undefined) => void) | null = null;
  private camI = 0; private viewI = 0; private inI = 0; private rowI = 0; private xI = 0; private dtI = 0; private lensI = 0; private dtLeft: number;
  private keys: string[] = []; private buttons = 0; private mouse: [number, number];
  private vals: TapeVal[] = []; private posOf = new Map<number, number[]>(); private used = new Map<number, number>(); private last = new Map<string, number | undefined>();
  private keyIdx = new Map<string, number>(); private live = false; private f32: boolean;

  /** `cam` / `mouse`: what the host's camera and cursor read before the tape's first row says otherwise */
  constructor(readonly tape: RunTape, init: { cam?: ArrayLike<number>; mouse?: [number, number] } = {}) {
    this.cam = Array.from(init.cam ?? [10, 0, 15, 0, 0, 21, 16 / 9, 0.5, 0.18]); this.mouse = init.mouse ? [init.mouse[0], init.mouse[1]] : [0, 0];
    this.lensYaw = this.cam[3]; this.f32 = !!tape.sens.f32; tape.sens.keys.forEach((k, i) => this.keyIdx.set(k, i)); this.dtLeft = tape.dt[0]?.[0] ?? 0;
  }

  private camRow(into: number[], r: TapeVal[]): void { const mask = r[1] as number; let j = 2; for (let i = 0; i < 9; i++) if (mask & (1 << i)) into[i] = tapeNum(r[j++]) as number; }

  /** the rows done to the game from outside a step that are due before the next one (each handed over once) */
  outside(): RunTape['x'] { const T = this.tape, i0 = this.xI; while (this.xI < T.x.length && T.x[this.xI][0] <= this.f) this.xI++; return T.x.slice(i0, this.xI); }

  /** the next step's inputs: the view's size and the player's input written into what the host hands the game, `cam` brought up to this step, the sensor
   *  answers of this step made ready. Returns the step's dt. Follow the game's update with `done()`. */
  step(view: WalkView, I: WalkInput): number {
    const T = this.tape, f = this.f;
    while (this.dtLeft <= 0 && this.dtI + 1 < T.dt.length) { this.dtI++; this.dtLeft = T.dt[this.dtI][0]; }
    const dt = T.dt[this.dtI]?.[1] ?? 1 / 60; this.dtLeft--;
    for (; this.viewI < T.view.length && T.view[this.viewI][0] <= f; this.viewI++) { const r = T.view[this.viewI]; view.clientWidth = r[1]; view.clientHeight = r[2]; view.width = r[3]; view.height = r[4]; }
    const yaw0 = this.cam[3], keys0 = this.keys;
    for (; this.camI < T.cam.length && (T.cam[this.camI][0] as number) <= f; this.camI++) this.camRow(this.cam, T.cam[this.camI]);
    let rec: RunTape['input'][number][1] | null = null; for (; this.inI < T.input.length && T.input[this.inI][0] <= f; this.inI++) if (T.input[this.inI][0] === f) rec = T.input[this.inI][1];
    if (rec?.k) this.keys = rec.k; if (rec?.b !== undefined) this.buttons = rec.b; if (rec?.m) this.mouse = [rec.m[0], rec.m[1]];
    { const Ls = T.lens; this.lens = null;
      if (!Ls) this.lensYaw = this.cam[3] !== yaw0 && (ctrlHeld(this.keys) || ctrlHeld(keys0)) ? yaw0 : this.cam[3];   // (a tape from before the lens rows — an orbit: the matrices lag a step)
      else { this.lensYaw = this.cam[3];
        for (; this.lensI < Ls.length && (Ls[this.lensI][0] as number) <= f; this.lensI++) { const r = Ls[this.lensI]; if (r[0] !== f) continue;
          if (r.length === 2) this.lensYaw = tapeNum(r[1]) as number;
          else { const a = new Array<number>(38); for (let i = 0; i < 38; i++) a[i] = tapeNum(r[i + 1]) as number; this.lens = a; } } } }
    I.keys.clear(); for (const k of this.keys) I.keys.add(k); I.pressed.clear(); for (const k of rec?.p ?? []) I.pressed.add(k);
    I.clicked = rec?.c ?? 0; I.buttons = this.buttons; I.mouseX = this.mouse[0]; I.mouseY = this.mouse[1]; I.wheel = rec?.w ?? 0;
    for (; this.rowI < T.sens.rows.length && T.sens.rows[this.rowI][0] <= f; this.rowI++) { const [, s, v] = T.sens.rows[this.rowI];
      if (s) { this.vals = v.slice(); this.posOf = new Map(); s.forEach((ki, i) => { const a = this.posOf.get(ki); if (a) a.push(i); else this.posOf.set(ki, [i]); }); }
      else for (let i = 0; i < v.length; i += 2) this.vals[v[i] as number] = v[i + 1]; }
    this.used.clear(); this.live = true;
    return dt;
  }
  /** THE CAMERA THE STEP JUST BEGUN IS HANDED, laid on the host's: the tape's nine numbers, its matrices built as the page's were (with `lensYaw`, then the step's own
   *  matrices over them where the tape kept those) — both hosts call this and nothing else, so they cannot lay it two ways. The look-at is a fresh array. */
  layCamera(c: WalkCamera): void {
    const p = this.cam, L = this.lens;
    c.target = [p[0], p[1], p[2]]; c.yaw = this.lensYaw; c.pitch = p[4]; c.distance = p[5]; c.aspect = p[6]; c.fov = p[7]; c.aimLead = p[8]; c.rebuild(); c.yaw = p[3];
    if (L) { for (let i = 0; i < 16; i++) { c.viewProj[i] = L[i]; c.invViewProj[i] = L[16 + i]; } for (let i = 0; i < 3; i++) { c.pos[i] = L[32 + i]; c.forward[i] = L[35 + i]; } }
  }
  /** the step's update has run: reads are outside a step again, and the walk is one step on */
  done(): void { this.live = false; this.f++; }
  /** the step's update threw: reads are outside a step again, the walk has not moved on */
  failed(): void { this.live = false; }

  /** the tape's answer to a sensor read */
  read(key: string): number | undefined {
    if (!this.live) return this.last.get(key);
    const ki = this.keyIdx.get(key), at = ki === undefined ? undefined : this.posOf.get(ki), u = ki === undefined ? 0 : this.used.get(ki) ?? 0;
    if (ki === undefined || !at || u >= at.length) { this.unjournaled++; return this.last.get(key); }
    this.used.set(ki, u + 1); const v = tapeNum(this.vals[at[u]], this.f32); this.last.set(key, v); this.served?.(v); return v;
  }

  /** the camera the NEXT step will be handed (= the one the recording drew the step just taken with), without moving the walk */
  camNext(): number[] { const c = this.cam.slice(), T = this.tape; for (let i = this.camI; i < T.cam.length && (T.cam[i][0] as number) <= this.f; i++) this.camRow(c, T.cam[i]); return c; }
}
