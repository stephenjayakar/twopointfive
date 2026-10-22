// RAILS: a tutorial mission's frame over a lesson (lesson.ts). The maintainer, of a better tutorial: "we want progressive disclosure … and also really
// want them to be on rails and hard to get lost", "has to be very linear and obvious what to do … also disable all features that player isn't supposed to
// do", and of its checkpoints: "we should also very intentionally curate checkpoints".
//
// A level's `scenarios.lesson` block carries a `rails` record (scene/scenarios.ts RailsData) and its steps a few more keys; a level without the record is
// the lesson it always was, and every entry point here returns on its first line. With the record, and the switch on:
//   · LOCKED ACTIONS. What the player can do is a set of ACTIONS (ACTS below: `move`, `order`, `word`, `fire` …): `rails.allow` from the first step, plus
//     each step's own `allow` from the moment it comes up, less its `deny`. A key, a button or the wheel of an action not in the set is taken out of the
//     tick's input before anything reads it (Game.step, right after the record is loaded: the record itself, the tape and a replay keep what was pressed;
//     the gate is a function of the game's state, so a replay drops what the run dropped). The page's own keys (pause, the back key, Enter) are never locked.
//     The game asks for fixed key CODES and a rebind happens at the keyboard (host/keymap.ts), so the lock follows whatever key a row is on.
//   · THE SET IS DERIVED, never kept: the step that is up says it all, so a checkpoint put back or a snapshot holds nothing of it.
//   · A CUE. A step's `cue` is sent to the level's script (director.ts, its play program 'tutorial') as the signal `lesson:<cue>` the tick the step
//     comes up; the lesson test `{ is: 'cue', name }` is true once the program has raised `done:<name>`. The program is started here when the run
//     starts, after a restart, and after a checkpoint is put back (with that checkpoint's own cue sent again: a beat starts clean from its cue).
//     Every order the player gives reaches the program too, as the signal `order:<id>`.
//   · AUTHORED CHECKPOINTS. A step's `checkpoint` asks for one save the tick it comes up (savestate.ts Checkpoints.keep: kept in memory, whatever is on
//     the floor), and on a rails level those are the only saves: the every-step request and the floor's own triggers stand down.
//   · NOBODY IS LOST. `rails.respawn` seconds: a teammate who would have gone down is on a knee for that long and then up again (railsSpare, asked by
//     combat.ts killGuard) — by behaviour, no hit points.
//   · FOG BY THE STEP. `rails.fog` / a step's `fog`: the fog of war as the newest step that says so has it.
//   · THE SKY SEAT (`rails.sky`): nobody on the floor is the player. He is parked out of the picture and out of every sense, the view rides the squad
//     and the walk keys (action `pan`) shift it about them; the seat's own rows on the HUD are the page's to hide (Rails.skyOn).
// THE PROMPT: `prompt()` is the one line the page draws big (ui/overlay.ts) in place of the small objective row.
// The switch `RAILS.on`: ON in the page (`?rails=0` = a rails level is its mission alone: no lesson, nothing locked, no cues — lesson.ts `data`), OFF here and
// on the frozen stand (`TPS_RAILS=1`). No shipped level but the tutorial group's carries the record, so no other run moves either way.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import type { Game, Guard } from './game';
import type { LessonData, LessonStep, RailsData } from '../scene/scenarios';
import type { Vec3 } from '../math/vec';
import type { Input } from './input';
import type { FogEye } from './fogofwar';
import type { FollowCamera } from './camera';
import { WORLD } from '../scene/world';

export const RAILS = { on: false,
  /** the sky seat: metres a second the walk keys shift the view at the default zoom, and how far from the squad it may go */
  panSpeed: 11, panReach: 16,
  /** the cursor this near (px) the step's mark on the screen is ON the mark's place, whatever stands between the eye and it (orders.ts targetUnder) */
  snapPx: 40,
  /** the sky seat keeps the step's mark in the picture: with no walk key held, a view shifted so that the mark is further from its middle than `keep` of the
   *  camera's distance is eased back (m/s at the default zoom) until it is not — a ring off the screen, or under the squad's panel, is a player lost.
   *  The kept ground is an oval, not a round: `keep` of the distance to either side (short of the squad's panel on the left), `keepDeep` of that reach up and
   *  down the screen, with its middle `keepUp` of the reach up the screen from the view's own (the step's line sits low in the middle: a ring behind it,
   *  or behind the panel, is a ring nobody sees) */
  keep: 0.21, keepSpeed: 9, keepDeep: 0.79, keepUp: 0.39,
  /** seconds a spared teammate is given when the level names none */
  spareSecs: 6 };
export const RAILS_STATS = { dropped: 0, cues: 0, starts: 0, kept: 0, putBack: 0, spared: 0 };

/** `RAILS_BREAK=1` (the check's): the gate lets everything through — nothing is locked */
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RAILS_BREAK ?? '') === '1'; } catch { return false; } })();
/** an action → the key codes it owns (the game's own codes: host/keymap.ts moves keys, never codes), its mouse buttons (bits of Input.buttons) and the wheel */
interface Act { keys?: string[]; buttons?: number; wheel?: boolean }
const ACTS: Record<string, Act> = {
  move: { keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'] }, pan: { keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'] },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'] }, crouch: { keys: ['KeyC'] }, wall: { keys: ['KeyQ'] }, pace: { wheel: true },
  aim: {}, fire: { buttons: 1 }, alt: { buttons: 4 }, reload: { keys: ['KeyR'] }, mode: { keys: ['KeyZ'] },
  'slot:pistol': { keys: ['Digit1'] }, 'slot:rifle': { keys: ['Digit2'] }, 'slot:smoke': { keys: ['Digit3'] }, 'slot:flash': { keys: ['Digit4'] }, 'slot:frag': { keys: ['Digit5'] },
  // (codes, as everywhere here: the hands' own slot is 'Digit0' whatever key the board gives it — handslot.ts; the whistle's code has no key on the page
  //  while the player's own ring is on — handring.ts: there it is the ring's last wedge, and the ring is `use`'s, worked with its digits and a click)
  hands: { keys: ['KeyE', 'Digit0'] }, use: { keys: ['Space', 'ArrowUp', 'ArrowDown'] }, whistle: { keys: ['KeyV'] }, light: { keys: ['KeyL'] }, nvg: { keys: ['KeyN'] },
  order: { keys: ['KeyB'] }, ring: {}, menu: { keys: ['KeyX'], buttons: 4 }, who: { keys: ['KeyT'] }, word: { keys: ['KeyF'] }, tools: { keys: ['KeyG', 'KeyH'] }, plan: {},
  camera: {}, zoom: {},
};
/** never locked: the page's own (the pause, the back key, a restart, the one-tick codes the host hands the tick) */
/** the lookout's id among the fog's eyes: no character's, and under the sticky cameras' (stickycam.ts EYE_ID, which its count starts at) */
const LOOKOUT_ID = 199;
const FREE = /^(Escape|Tab|Enter|NumpadEnter|Blur|Paused|F\d{1,2}|BracketLeft|BracketRight)$/;
const DIGIT = /^Digit[1-5]$/;
export const RAILS_ACTIONS: readonly string[] = Object.keys(ACTS);

/** what is wrong with a lesson block's rails keys (lesson.ts checkLesson adds these to its own) */
export function railsFaults(L: LessonData): string[] {
  const out: string[] = [], R = L.rails; if (!R) { L.steps.forEach((T, i) => { if (T.allow || T.deny || T.cue || T.checkpoint || T.fog !== undefined) out.push(`steps[${i}] '${T.id}' carries rails keys and the lesson has no rails record`); }); return out; }
  const bad = (w: string, a: unknown) => { if (a === undefined) return; if (!Array.isArray(a)) { out.push(`${w}: a list of actions`); return; } for (const x of a) if (!ACTS[x as string]) out.push(`${w}: no action '${String(x)}' (${RAILS_ACTIONS.join(', ')})`); };
  bad('rails.allow', R.allow);
  const cues = new Set<string>();
  L.steps.forEach((T, i) => { const w = `steps[${i}] '${T.id}'`; bad(`${w}.allow`, T.allow); bad(`${w}.deny`, T.deny);
    if (T.cue !== undefined) { if (cues.has(T.cue)) out.push(`${w}.cue '${T.cue}' is another step's too: a cue starts one beat`); cues.add(T.cue); } });
  if (R.sky && !(Array.isArray(R.sky.park) && R.sky.park.length === 3)) out.push('rails.sky.park: a Vec3 (where the player stands, out of the picture)');
  if (R.orders !== undefined && !(Array.isArray(R.orders) && R.orders.length > 0 && R.orders.every(x => typeof x === 'string'))) out.push('rails.orders: a list of order ids (at least one)');
  if (R.sky?.eye && !(Array.isArray(R.sky.eye.at) && R.sky.eye.at.length === 3 && typeof R.sky.eye.yaw === 'number' && (R.sky.eye.fov === undefined || (R.sky.eye.fov > 0 && R.sky.eye.fov <= 360)))) out.push('rails.sky.eye: { at: a Vec3, yaw: radians, fov?: degrees up to 360 }');
  return out;
}

export class Rails {
  /** the Mission this pass belongs to (a fresh one — restartEncounter — starts the frame over) */
  private run: object | null = null;
  /** the step whose cue, checkpoint and fog were last answered (-1: none yet) */
  private answered = -1;
  /** a checkpoint was put back this tick or the last (savestate.ts): the program is started again and the step's cue sent again */
  private back = false;
  /** how many rows of the orders' log have been passed to the level's program (each as the signal `order:<id>`) */
  private ordersSeen = 0;
  /** the sky seat: the view's own shift about the squad, the eased point it rides, and whether the player has been parked for this run */
  private sky = { off: [0, 0, 0] as Vec3, mid: null as Vec3 | null, midT: -1, parked: false, was: null as { invisible: boolean } | null, view: null as { yaw: number; pitch: number; dist: number } | null, again: false };
  /** teammates spared a down: the game's clock each is back on his feet at, by character id */
  spared = new Map<number, number>();
  log: string[] = [];
  constructor(private g: Game) {}

  /** the rails record in force (null: none — the switch, no lesson live, a lesson without the record) */
  get data(): RailsData | null { if (!RAILS.on) return null; return this.g.lesson?.data?.rails ?? null; }
  get live(): boolean { return !!this.data; }
  get skyOn(): boolean { return !!this.data?.sky; }
  private lesson(): { L: LessonData; i: number } | null { const L = this.g.lesson?.data; return L?.rails && RAILS.on ? { L, i: Math.min(this.g.lesson.index, L.steps.length) } : null; }

  /** the actions that work now: the record's, each step's own from the moment it came up, less what a step took away — derived from the step that is up */
  allowed(): Set<string> | null {
    const S = this.lesson(); if (!S) return null;
    const set = new Set<string>(S.L.rails!.allow);
    for (let k = 0; k <= S.i && k < S.L.steps.length; k++) { const T = S.L.steps[k]; for (const a of T.allow ?? []) set.add(a); for (const a of T.deny ?? []) set.delete(a); }
    return set;
  }
  /** is this action locked right now (the host asks for `camera` and `zoom`, which it turns itself — host/loop.ts) */
  locks(action: string): boolean { const A = this.allowed(); return !!A && !A.has(action); }

  /** THE GATE (Game.step, right after the tick's record is loaded into the seat's input): whatever the step has not unlocked is taken out of the tick */
  gate(input: Input, cam: FollowCamera, dt: number) {
    const A = this.allowed(); if (!A || BREAK) return;
    const keys = new Set<string>(); let buttons = 0, wheel = false;
    for (const a of A) { const act = ACTS[a]; if (!act) continue; for (const k of act.keys ?? []) keys.add(k); buttons |= act.buttons ?? 0; wheel ||= !!act.wheel; }
    const g = this.g, menuUp = !!g.orders?.menu && (A.has('menu') || A.has('ring'));
    const shift = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const enter = input.keys.has('Enter') || input.pressed.has('Enter') || input.keys.has('NumpadEnter') || input.pressed.has('NumpadEnter');   // (Shift+Enter stages the mission again: Shift rides with it)
    const handUp = A.has('use') && !!g.player.sel?.open;   // (the player's own ring or list, up: its digits and its clicks are its own)
    if (menuUp || handUp) buttons |= 1; if (handUp) buttons |= 4;   // (a menu or a ring that is up is worked with its own keys: the digits, the wheel, a left click on a row, V)
    const ok = (code: string) => FREE.test(code) || keys.has(code) || (menuUp && (DIGIT.test(code) || code === 'KeyV')) || (handUp && DIGIT.test(code)) || (enter && (code === 'ShiftLeft' || code === 'ShiftRight'));
    let dropped = 0;
    // the sky seat's walk keys are the view's, never his feet's: read here, then gone from the tick
    if (this.skyOn) { if (A.has('pan')) this.pan(input, cam, dt); this.keep(input, cam, dt); for (const k of ACTS.move.keys!) { input.keys.delete(k); input.pressed.delete(k); } keys.delete('KeyW'); keys.delete('KeyA'); keys.delete('KeyS'); keys.delete('KeyD'); }
    for (const k of [...input.pressed]) if (!ok(k)) { input.pressed.delete(k); dropped++; }
    for (const k of [...input.keys]) if (!ok(k)) input.keys.delete(k);
    // the command key held is the ring, and with Shift the plan: each its own action over `order`
    if (keys.has('KeyB')) {
      if (shift && !A.has('plan')) { if (input.pressed.delete('KeyB')) dropped++; input.keys.delete('KeyB'); }
      else if (!A.has('ring') && !input.pressed.has('KeyB')) input.keys.delete('KeyB');   // (a press is a tap: the key is let go the tick after it went down)
    }
    if (input.clicked & ~buttons) dropped++;
    input.buttons &= buttons; input.clicked &= buttons;
    if (!wheel && !menuUp && !handUp) input.wheel = 0;
    RAILS_STATS.dropped += dropped;
  }

  /** the step's mark under the cursor (orders.ts targetUnder): the place itself, so an order pointed at the ring on the screen is an order on the door, the
   *  wall or the thing the ring is on, even where a wall stands between the eye and it. Null: no mark, or the cursor is not on it */
  markUnder(input: Input, cam: FollowCamera, canvas: { clientWidth: number; clientHeight: number }): Vec3 | null {
    const S = this.lesson(); if (!S || BREAK) return null; const at = S.L.steps[S.i]?.at; if (!at) return null;
    const [sx, sy, front] = cam.project(at, canvas.clientWidth, canvas.clientHeight); if (!front) return null;
    return RAILS.snapPx > 0 && Math.hypot(input.mouseX - sx, input.mouseY - sy) <= RAILS.snapPx ? at : null;
  }

  /** THE MENU'S ROWS on a tutorial mission (orders.ts rowsFor): only the orders the level names — a row nobody taught is not on the ring */
  orderRows<T extends { id: string }>(rows: T[]): T[] { const L = this.live && !BREAK ? this.data?.orders : undefined; return L ? rows.filter(d => L.includes(d.id)) : rows; }
  /** the sky seat's lookout (fogofwar.ts update: one more of the team's eyes): null without one */
  eye(): FogEye | null {
    const e = this.data?.sky?.eye; if (!e) return null;
    return this.lookout ??= { id: LOOKOUT_ID, pos: e.at, look: [Math.sin(e.yaw), 0, Math.cos(e.yaw)], at: e.at, fov: e.fov ?? 120, near: 0 };
  }
  private lookout: FogEye | null = null;

  /** between ticks, with the HOST's camera (game.ts update): the mission again opens on the view the first run opened on. A view left zoomed all the way out
   *  could not do the step that asks for a zoom. The view is the host's, so it is set there and reaches the game in the next tick's record like any turn of it */
  /** ticks left of a run's opening, in which the view may be set back under the step (lesson.ts: a view test starts from the view after them) */
  fresh = 0;
  hostView(cam: FollowCamera) {
    if (!this.skyOn || !this.sky.parked) return;
    const V = this.sky.view; if (!V) this.sky.view = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.desiredDistance }; else if (this.sky.again) { cam.yaw = V.yaw; cam.pitch = V.pitch; cam.distance = cam.desiredDistance = V.dist; }
    this.sky.again = false;
  }

  /** once a tick (game.ts, right after lesson.tick): the run's start, the step that came up answered, the spared men stood up */
  tick(dt: number) {
    const S = this.lesson(), g = this.g;
    if (!S) { if (this.sky.parked) this.unpark(); return; }
    if (this.run !== g.mission) { this.run = g.mission; this.answered = -1; this.back = false; this.spared.clear(); if (this.sky.parked) this.unpark(); this.sky.again = true; this.fresh = 3; this.lookout = null; this.sky.off = [0, 0, 0]; this.sky.mid = null; this.sky.midT = -1; this.log.length = 0; this.ordersSeen = g.orders?.log.length ?? 0; this.startProgram('start'); }
    else if (this.fresh > 0) this.fresh--;
    if (this.back) { this.back = false; this.startProgram('checkpoint'); this.answered = -1; this.answer(S, true); }
    if (this.skyOn && !this.sky.parked) this.park(S.L.rails!);
    if (this.answered !== S.i) this.answer(S, false);
    // every order the player gives is told to the level's program (a beat waits on it: c.on('signal', 'order:move'))
    { const L = g.orders?.log; if (L) { if (L.length < this.ordersSeen) this.ordersSeen = L.length; for (; this.ordersSeen < L.length; this.ordersSeen++) { const o = L[this.ordersSeen].order; if (!(this.skyOn && o === 'fallIn')) g.director?.signal(`order:${o}`); } } }
    // (the sky seat: there is nobody to fall in on — the command key on nothing, or on a man, would walk the squad off to the parked player. Such a man holds where he is)
    if (this.skyOn && g.orders) for (const gd of this.squad()) if (g.orders.of(gd)?.order === 'fallIn') this.holdHere(gd);
    for (const [id, t] of this.spared) if (g.time >= t) { this.spared.delete(id); const gd = g.guards.find(x => x.char.id === id); if (gd && gd.state !== 'dead') this.note(`${gd.callsign} is up again`); }
    void dt;
  }
  /** the step that is up, answered once: its cue to the script, its checkpoint asked for, its fog laid on (and every earlier step's, on a fresh start or a put-back) */
  private answer(S: { L: LessonData; i: number }, again: boolean) {
    const g = this.g, T: LessonStep | undefined = S.L.steps[S.i];
    this.answered = S.i;
    { let fog = S.L.rails!.fog; for (let k = 0; k <= S.i && k < S.L.steps.length; k++) if (S.L.steps[k].fog !== undefined) fog = S.L.steps[k].fog; if (fog !== undefined && g.fogOfWar.on !== fog) { g.fogOfWar.on = fog; this.note(`fog ${fog ? 'on' : 'off'}`); } }
    if (!T) return;
    if (T.cue) { g.director?.signal(`lesson:${T.cue}`); RAILS_STATS.cues++; this.note(`cue '${T.cue}'${again ? ' (again)' : ''}`); }
    if (T.checkpoint && !again) { g.saves.keep(T.checkpoint); RAILS_STATS.kept++; this.note(`checkpoint asked: ${T.checkpoint}`); }
  }
  private startProgram(why: string) {
    const D = this.g.director; if (!D?.programs.includes('tutorial')) return;
    if (D.run && !D.run.ended) D.stop(false);
    const no = D.start('tutorial'); RAILS_STATS.starts++; this.note(no ? `the level's program did not start (${why}): ${no}` : `the level's program started (${why})`);
  }
  /** a checkpoint of this run was put back (savestate.ts loadMem, after every object is as it stood): the program's beats are functions half run, which no
   *  snapshot holds — it is started again, and the step's cue sent again, on the next tick */
  putBack() { if (!this.live) return; this.back = true; RAILS_STATS.putBack++; }
  /** an authored checkpoint was just taken with the program stopped for it (savestate.ts): started again on the next tick, the step's cue with it */
  resume() { if (this.live) this.back = true; }

  /** has the level's program said this beat has played out (the lesson test `cue`) */
  cued(name: string): boolean { return !!this.g.director?.signalled(`done:${name}`); }

  /** the scenario under the lesson asks (roomclear.ts): is the mission still on its steps (it may not end as taken yet), and has its last step just gone by */
  holdsEnd(): boolean { const S = this.lesson(); return !!S && S.i < S.L.steps.length; }
  endsNow(): boolean { const S = this.lesson(); return !!S && S.i >= S.L.steps.length; }

  // ---------------------------------------------------------------- the prompt
  /** the one line on screen (null: no rails, every step done, the run over) */
  prompt(): { line: string; n: number; of: number } | null {
    const S = this.lesson(), of = S?.L.steps.length ?? 0; if (!S || !of) return null;
    // (every step done and the mission not yet over — the last metre to an exit, the last man of a fight: the last line stays up until the mission's own
    //  end. The small row it would fall back to is the one a tutorial mission never shows)
    if (S.i >= of ? BREAK || this.g.lesson.over() : !this.g.lesson.objective()) return null;
    const i = Math.min(S.i, of - 1);
    return { line: S.L.steps[i].line, n: i + 1, of };
  }

  // ---------------------------------------------------------------- nobody is lost
  /** combat.ts killGuard asks before a man goes down: a teammate on a rails level with `respawn` is on a knee instead, and up again after it */
  spare(gd: Guard): boolean {
    const D = this.data; if (!D || D.respawn === undefined || !gd.unit || gd.team !== 'operative' || gd.state === 'dead') return false;
    const g = this.g, until = this.spared.get(gd.char.id);
    if (until !== undefined && g.time < until) return true;   // (already down on his knee: nothing more happens to him)
    const t = g.time + (D.respawn > 0 ? D.respawn : RAILS.spareSecs);
    this.spared.set(gd.char.id, t); gd.staggerUntil = Math.max(gd.staggerUntil, t); gd.doorDownUntil = Math.max(gd.doorDownUntil, t);
    RAILS_STATS.spared++; this.note(`${gd.callsign} spared a down: up at ${t.toFixed(1)}`);
    return true;
  }
  /** is this man on his knee right now, spared (nobody's target meanwhile) */
  isSpared(gd: Guard): boolean { const t = this.spared.get(gd.char.id); return t !== undefined && this.g.time < t; }

  // ---------------------------------------------------------------- the sky seat
  private squad(): Guard[] { return this.g.guards.filter(x => x.unit && x.team === 'operative' && x.state !== 'dead'); }
  private park(R: RailsData) {
    const g = this.g; this.sky.parked = true; this.sky.was = { invisible: g.playerInvisible };
    g.playerInvisible = true; g.teleportPlayer(R.sky!.park);
    // (a squad with no order falls in on Sam: on the parked man, out of the picture. In this seat it holds where the mission stood it until its first order)
    for (const gd of this.squad()) this.holdHere(gd);
    this.note(`sky seat: the player parked at (${R.sky!.park[0]}, ${R.sky!.park[2]})`);
  }
  private holdHere(gd: Guard) { const p = gd.char.pos; this.g.orders?.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding' }); }
  private unpark() { const g = this.g; this.sky.parked = false; if (this.sky.was) { g.playerInvisible = this.sky.was.invisible; this.sky.was = null; } }
  /** the walk keys shift the view about the squad, by the way the seat looks */
  private pan(input: Input, cam: FollowCamera, dt: number) {
    const f = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0), r = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
    if (!f && !r) return;
    const B = cam.planarBasis(), k = RAILS.panSpeed * (cam.distance / 21) * dt / Math.hypot(f, r), o = this.sky.off;
    o[0] += (B.fwd[0] * f + B.right[0] * r) * k; o[2] += (B.fwd[2] * f + B.right[2] * r) * k;
    const d = Math.hypot(o[0], o[2]), max = this.data?.sky?.reach ?? RAILS.panReach; if (d > max) { o[0] *= max / d; o[2] *= max / d; }
  }
  /** THE MARK STAYS IN THE PICTURE (RAILS.keep): the hand's shift is eased toward the step's mark while it is out past the kept oval and no walk key is down */
  private keep(input: Input, cam: FollowCamera, dt: number) {
    if (BREAK || !RAILS.keep || ACTS.move.keys!.some(k => input.keys.has(k))) return;
    const S = this.lesson(), at = S?.L.steps[S.i]?.at, v = at ? this.look() : null; if (!at || !v) return;
    const B = cam.planarBasis(), Rx = RAILS.keep * cam.distance, Rf = Rx * RAILS.keepDeep, dx = at[0] - v[0], dz = at[2] - v[2];
    const r = dx * B.right[0] + dz * B.right[2], f = dx * B.fwd[0] + dz * B.fwd[2] - Rx * RAILS.keepUp, e = Math.hypot(r / Rx, f / Rf); if (e <= 1) return;
    // (the shift that brings the mark to the oval's edge, along the line from the oval's middle to it)
    const sr = r * (1 - 1 / e), sf = f * (1 - 1 / e), k = Math.min(1, RAILS.keepSpeed * (cam.distance / 21) * dt / Math.hypot(sr, sf)), o = this.sky.off;
    o[0] += (B.right[0] * sr + B.fwd[0] * sf) * k; o[2] += (B.right[2] * sr + B.fwd[2] * sf) * k;
    const d = Math.hypot(o[0], o[2]), max = this.data?.sky?.reach ?? RAILS.panReach; if (d > max) { o[0] *= max / d; o[2] *= max / d; }   // (never past the walk keys' own reach: the next press of one would snap it back)
  }
  /** how far the view has been shifted off the squad, metres (the lesson test `view`) */
  panned(): number { return Math.hypot(this.sky.off[0], this.sky.off[2]); }
  /** where the view looks in the sky seat (Game.followPos; null: not that seat): the middle of the men still up, eased, plus the hand's own shift */
  look(): Vec3 | null {
    if (!this.skyOn) return null;
    const men = this.squad(), g = this.g;
    if (men.length) { const c: Vec3 = [0, 0, 0]; for (const m of men) { c[0] += m.char.pos[0] / men.length; c[2] += m.char.pos[2] / men.length; }
      const m = this.sky.mid; if (!m || this.sky.midT !== g.time) { if (!m) this.sky.mid = c; else { const dt = Math.max(0, g.time - this.sky.midT), a = 1 - Math.exp(-dt * 2.5); m[0] += (c[0] - m[0]) * a; m[2] += (c[2] - m[2]) * a; } this.sky.midT = g.time; } }
    const mid = this.sky.mid ?? g.player.char.pos, o = this.sky.off;
    return [Math.min(WORLD.max[0], Math.max(WORLD.min[0], mid[0] + o[0])), 0, Math.min(WORLD.max[2], Math.max(WORLD.min[2], mid[2] + o[2]))];
  }

  summary(): string {
    const S = this.lesson(); if (!S) return this.g.level.scenarios?.lesson?.rails ? (RAILS.on ? 'off · this level carries the record (start its mission)' : 'off · switched off') : 'off · this level carries none';
    const A = this.allowed()!;
    return `step ${Math.min(S.i + 1, S.L.steps.length)}/${S.L.steps.length} · unlocked: ${[...A].join(' ') || '—'}${this.skyOn ? ' · sky seat' : ''}${this.spared.size ? ` · spared ${this.spared.size}` : ''}`;
  }
  private note(s: string) { this.log.push(`${this.g.time.toFixed(2)} ${s}`); if (this.log.length > 80) this.log.splice(0, 40); }
}

/** combat.ts killGuard's question, safe on a Game that has no frame yet */
export function railsSpare(g: Game, gd: Guard): boolean { return !!g.rails && g.rails.spare(gd); }
