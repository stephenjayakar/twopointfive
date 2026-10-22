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
//   · THE HOLD IS ITS OWN LINE (a step's `noTap`, `menuLine`): while a step teaches the command key held, a tap of it gives no order and a few words come up
//     under the line; with the ring up the line is what to press in it. A step's `eye` is one more lookout for the fog while it is up (the squad's own charge
//     on a wall, which its men stand with their backs to); a step's `onWay` hands the view back to the squad once its order is given.
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
import { CMDRING } from './cmdring';   // (read inside gate() only: src/game is one import cycle)
import { stepLine, lessonLine } from './lesson';   // (called inside prompt() only: src/game is one import cycle)
import { slotSetupLeft, setupRows } from './slotsetup';   // (asked inside gate() only)
import { HANDRING } from './handring';
import { choosable, runningVerb } from './interact';   // (both read inside gate() only)
import { INTERACT_KEY } from './consts';

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
  /** a step's `onWay`: a man of the squad under an order whose mark is within this many metres of the step's own is on his way to it (0: never) */
  wayM: 6,
  /** a step's `after`: seconds its line stands in for the step's own once the order it asks for has gone out and its men stand where it sent them (while one
   *  is still walking the line stays) — then the step asks again: the men could not do it, or it was the wrong place, and a line that only ever says 'they
   *  are on it' is a player left waiting. 0: never shown */
  afterSecs: 8,
  /** …and however long they walk, the step asks again this many seconds after the order went out (men who cannot get there never arrive) */
  afterMax: 45,
  /** Shift with the command key while the plan is not unlocked IS the command key (Shift + the key is the plan's: before, the press was thrown away —
   *  and a Shift left down by a system shortcut, or a sprinting finger, made the key dead with its row still offered on the squad's panel) */
  shiftTap: true,
  /** the big line goes to the bottom edge from over the player and his teammates where they stand under it (ui/railclear.ts; picture only) */
  lineClear: true,
  /** a step's own eye is never the one the fog of war has no place for: with the places full (four men up and the seat's lookout) it takes the last
   *  (fogofwar.ts update; before, it was the one dropped, and the squad's own wall charge went off unseen) */
  eyeFirst: true,
  /** THE FRAME'S EYES ARE THE PLAYER'S VIEW, NOT THE SQUAD'S KNOWLEDGE (fogofwar.ts update): the seat's lookout and a step's eye light the floor they look at
   *  and put a man there in the picture — drawn, as a man the squad is shooting at is — and are no answer to the fog's seen() or sighting(), which the
   *  squad's own choices read (the entry on a door: autopilot.ts contactBehind; the rescue's flow; the plan's marks; a charge's known men). The team's
   *  own eyes answer those exactly as on a level with no frame, the one a step's eye takes the picture's last place from included. false: a frame's eye is
   *  one more of the team's (as it was: with a step's lookout in a hall the squad then entered, the stack at its door threw its last can at a man nobody
   *  of the team had seen, and went in three seconds after the pair at the back) */
  eyeView: true,
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
  // (ownblow.ts: a charge his own hands set, set off from his own list — no key of its own: the row is `use`'s, and a mission that names this action or
  //  the squad's word has that row from the step that opens either)
  blow: {},
};
/** never locked: the page's own (the pause, the back key, a restart, the one-tick codes the host hands the tick) */
/** the lookout's id among the fog's eyes: no character's, and under the sticky cameras' (stickycam.ts EYE_ID, which its count starts at) */
const LOOKOUT_ID = 199, STEP_EYE_ID = 198;
/** seconds a refused tap's words stay up under the line */
const NOTE_SECS = 2.6;
/** metres from the step's mark the squad's ring may be opened and still be the step's ring (its `menuLine`) */
const MENU_M = 6;
/** the most a step's card may say (its `explain.text`): three short sentences */
const CARD_CHARS = 260;
function lookoutEye(id: number, e: { at: Vec3; yaw: number; fov?: number }): FogEye { return { id, pos: e.at, look: [Math.sin(e.yaw), 0, Math.cos(e.yaw)], at: e.at, fov: e.fov ?? 120, near: 0 }; }
const FREE = /^(Escape|Tab|Enter|NumpadEnter|Blur|Paused|F\d{1,2}|BracketLeft|BracketRight)$/;
const DIGIT = /^Digit[1-5]$/;
export const RAILS_ACTIONS: readonly string[] = Object.keys(ACTS);

/** A ROWS LIST THAT TAKES AN ACT BACK OUT OF HIS HANDS (`rails.rows`): a list names the verbs a mission teaches, and every other row is withheld — the act that
 *  puts a listed one back among them. He opens a door with the taught row and nothing in reach shuts it (the maintainer on the stealth mission: "nothing
 *  in reach to close the door?"). Each pair here is [an act, the act that undoes it]; `rowsWithheld` says which a list names without its other half. Notes,
 *  not faults: a mission may mean it (a door that must stand open), and a row added beside a taught one can take Space's tap from it — the list is its
 *  author's to mend. tools/qa/lesson-check.ts prints them */
const UNDO: readonly (readonly [string, string, string])[] = [['push', 'pull', 'a door he opens cannot be shut'], ['ease', 'pull', 'a door he eases open cannot be shut'],
  ['drag', 'drop', 'a body he drags cannot be let go'], ['lightsOff', 'lightsOn', 'a room\'s lights he puts out cannot be put on'], ['breakerOff', 'breakerOn', 'the mains he cuts cannot be put back']];
export function rowsWithheld(L: LessonData | null | undefined): string[] {
  const R = L?.rails?.rows; if (!Array.isArray(R)) return [];
  return UNDO.filter(([a, b]) => R.includes(a) && !R.includes(b)).map(([a, b, why]) => `rails.rows names '${a}' and not '${b}': ${why}`);
}
/** what is wrong with a lesson block's rails keys (lesson.ts checkLesson adds these to its own) */
export function railsFaults(L: LessonData): string[] {
  const out: string[] = [], R = L.rails; if (!R) { L.steps.forEach((T, i) => { if (T.allow || T.deny || T.cue || T.checkpoint || T.fog !== undefined || T.noTap || T.eye || T.onWay || T.explain || T.toward || T.after) out.push(`steps[${i}] '${T.id}' carries rails keys and the lesson has no rails record`); }); return out; }
  const bad = (w: string, a: unknown) => { if (a === undefined) return; if (!Array.isArray(a)) { out.push(`${w}: a list of actions`); return; } for (const x of a) if (!ACTS[x as string]) out.push(`${w}: no action '${String(x)}' (${RAILS_ACTIONS.join(', ')})`); };
  bad('rails.allow', R.allow);
  const cues = new Set<string>();
  L.steps.forEach((T, i) => { const w = `steps[${i}] '${T.id}'`; bad(`${w}.allow`, T.allow); bad(`${w}.deny`, T.deny);
    if (T.explain && (T.explain.text.length > CARD_CHARS || (T.explain.title?.length ?? 0) > 40)) out.push(`${w}.explain: a card is a heading of at most 40 characters and at most ${CARD_CHARS} of text (it is ${T.explain.title?.length ?? 0} and ${T.explain.text.length}): a card nobody reads teaches nothing`);
    if (T.cue !== undefined) { if (cues.has(T.cue)) out.push(`${w}.cue '${T.cue}' is another step's too: a cue starts one beat`); cues.add(T.cue); } });
  if (R.rows !== undefined && !(Array.isArray(R.rows) && R.rows.length > 0 && R.rows.every(v => typeof v === 'string' && !!v))) out.push('rails.rows: a list of verbs, at least one (absent: every row)');
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
  /** the game's clock at the last tap of the command key a step refused (noTap): its words are up for NOTE_SECS after it — the page's, nothing reads it back */
  private tapT = -1e9;
  /** has an order moved the squad off the spot the seat parked it on, this run (the knee behind the trucks is kept until one has) */
  private moved = false;
  /** the step whose `onWay` has put night vision up, once (the key is the player's again after it) */
  private wayNv = -1;
  /** the step whose `after` line is up · 1 its order has gone out, 2 the word after it · the game's clock then (prompt(): the page's, nothing reads it back) */
  private gaveStep = -1; private gave = 0; private gaveT = -1e9; private gave0 = -1e9;
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
  /** A MISSION THAT TEACHES THE WALL (a step of it allows `wall`) keeps a walk into one from taking it until that line. The walk has no key for the gate to
   *  drop (player.ts wallPress asks here); a mission that never names the wall leaves it as the page has it. */
  locksWall(): boolean { if (BREAK) return false; const A = this.allowed(), S = this.lesson(); return !!A && !!S && !A.has('wall') && S.L.steps.some(T => T.allow?.includes('wall')); }

  // ---------------------------------------------------------------- the page's two looks at the step (nothing under src/game reads them)
  /** THE CARD of the step that is up (its `explain`) — the step's own data and nothing else: which cards have been read is the page's to keep
   *  (ui/railcard.ts, which draws it; main.ts holds the world still under it), so nothing here is in a snapshot or a recording */
  card(): { title?: string; text: string } | null { const S = this.lesson(), T = S?.L.steps[S.i]; return BREAK || !T?.explain || this.g.lesson.over() ? null : T.explain; }
  /** THE ARROW the step's mark is drawn as (its `toward`): where it points — null: the ring */
  arrow(): Vec3 | null { const S = this.lesson(), T = S?.L.steps[S.i]; return BREAK || !T?.at || !T.toward || this.g.lesson.over() ? null : T.toward; }

  /** no teammate shows an aiming laser on this level (irlaser.ts laserOn asks) */
  noLasers(): boolean { return !BREAK && this.data?.lasers === false; }
  /** THE STEP TEACHES THE HOLD (its `noTap`): a tap of the command key gives nothing (orders.ts quickGive asks, and the tap is noted for the page) */
  tapOff(): boolean { if (!this.teachesHold()) return false; this.tapT = this.g.time; RAILS_STATS.dropped++; return true; }
  /** the step that is up teaches the hold (the squad panel's row for the tap is not offered: orders.ts) */
  teachesHold(): boolean { const S = this.lesson(); return !BREAK && !!S?.L.steps[S.i]?.noTap; }
  /** a run begun, or a checkpoint put back: what the frame keeps for the page and for one step is as at a start */
  private clean() { this.tapT = -1e9; this.wayNv = -1; this.stepLook = null; this.gaveStep = -1; this.gave = 0; this.gaveT = this.gave0 = -1e9; }
  /** an order went out (the tick's own read of the order book): on a step with an `after` line, what the men are doing now is the line for a while */
  private noteGiven(o: string) {
    const S = this.lesson(), A = S?.L.steps[S.i]?.after; if (!S || !A) return;
    if (this.gaveStep !== S.i) { this.gaveStep = S.i; this.gave = 0; }
    if (o === 'go') { if (A.word) { this.gave = 2; this.gaveT = this.gave0 = this.g.time; } return; }
    if (!A.line || (A.on && !A.on.includes(o))) return;
    // (…and it was pointed at the step's place: an order to somewhere else is not the step being done, and its line and ring stay)
    const at = S.L.steps[S.i].at, O = this.g.orders;
    if (at && RAILS.wayM > 0 && !(O && this.squad().some(gd => { const P = O.of(gd)?.post; return !!P && Math.hypot(P[0] - at[0], P[2] - at[2]) < RAILS.wayM; }))) return;
    this.gave = 1; this.gaveT = this.gave0 = this.g.time;
  }
  /** is a man of the squad under an order to the step's mark (the step's `onWay`: its order has been given and they are walking it) */
  private onWay(S: { L: LessonData; i: number } | null): boolean {
    const T = S?.L.steps[S.i], at = T?.at; if (BREAK || !T?.onWay || !at || !(RAILS.wayM > 0)) return false;
    const O = this.g.orders; return !!O && this.squad().some(gd => { const P = O.of(gd)?.post; return !!P && Math.hypot(P[0] - at[0], P[2] - at[2]) < RAILS.wayM; });
  }

  /** does Space offer a row of this verb here (player.ts buildInteractables): the keys are locked by action, and Space is ONE key over every row in
   *  reach — so a level names the verbs its steps teach (`rails.rows`) and a thing nobody taught has no row at all. On such a level
   *  there is no row either while Space itself is locked: a prompt for a key that does nothing is a lie in the corner of the screen */
  offers(verb: string): boolean { const R = this.data?.rows; return !R || BREAK || (R.includes(verb) && !this.locks('use')); }

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
    // PLAN MODE IS ITS OWN ACTION (`plan`; planmode.ts): the command key with Shift opens it whether or not the key's own order has been taught, and while it
    // is up its hands are its own — Shift (a stop added, a man added), the walk keys (they move the view: he is on a knee) and both buttons (the left
    // picks men, the right orders them). None of that is his feet, his sprint or his trigger: those stay locked until a step names them
    // (only where the page HAS the mode — `?qplan=0` and the frozen stand do not, and there the key with Shift is the key's own order, which stays locked. A walk
    //  key held is a sprint's only where his feet are his: on a mission that never gives them it cannot stand between Shift and the key)
    const WALK = ACTS.move.keys!, planOn = A.has('plan') && CMDRING.plan, planUp = planOn && !!g.orders?.plan.up, walking = A.has('move') && WALK.some(k => input.keys.has(k));
    if (planUp) { buttons |= 5; if (CMDRING.planRts) for (const k of WALK) keys.add(k); }   // (the walk keys are the view's only in the mode as an RTS's: without it they are his feet)
    if (planOn && (planUp || (!walking && (input.pressed.has('KeyB') || input.keys.has('KeyB'))))) { keys.add('ShiftLeft'); keys.add('ShiftRight'); if (shift) keys.add('KeyB'); }
    // THE SETUP OF THE GUN IN HIS HANDS, up (slotsetup.ts): a row's digit is the row's there, whatever slot that digit is anywhere else, so it is let through
    // by what the ROW does and never by the slot: the selector with `mode`, the lamp with `light`, the launcher's load with `alt` (the right button fires
    // what that row loads: a lesson that opens the setup before it has taught the launcher keeps the row shut). Not on the setup's last ticks: a digit let through as a row the tick the setup shuts by
    // its clock would be the locked slot's key after all
    const setup = slotSetupLeft(g) > 0.03 ? g.player.setup : null, rows = setup ? setupRows(g.player, setup.gun) : [];
    // (a row's digit with the setup up is the ROW's, whatever else that digit is: the rifle's own key is also its load's row)
    const rowOf = (code: string) => rows.find(x => code === `Digit${x.key}`);
    // (handring.ts `early`: a digit pressed INSIDE the interaction key's hold, before the ring is up, puts it up and is its wedge at once. A hand that
    //  reads "Hold E, then 5" presses the 5 well inside that hold, and with the digit dropped here as a locked slot's the key did nothing at all. It
    //  passes only where interact.ts will take it this tick — the press armed, the key down, something to choose — so it never reaches a slot)
    const P = g.player, S = P.sel, handKey = A.has('use') && !handUp && HANDRING.on && HANDRING.early && !g.puppet && !P.down && !P.takedown && !g.orders?.cmdRing && !g.orders?.menu
      && input.keys.has(INTERACT_KEY) && (S.downT >= 0 || (input.pressed.has(INTERACT_KEY) && !P.fHeld)) && !runningVerb(g) && (!this.locks('whistle') || choosable(g.nearby));
    const ok = (code: string) => { const r = rowOf(code); if (r) return A.has(r.kind === 'mode' ? 'mode' : r.kind === 'light' ? 'light' : 'alt');   // (the load is what the right button fires: its row opens with that button)
      return FREE.test(code) || keys.has(code) || (menuUp && (DIGIT.test(code) || code === 'KeyV')) || ((handUp || handKey) && DIGIT.test(code)) || (enter && (code === 'ShiftLeft' || code === 'ShiftRight')); };
    let dropped = 0;
    // the sky seat's walk keys are the view's, never his feet's: read here, then gone from the tick
    if (this.skyOn) { if (A.has('pan')) this.pan(input, cam, dt); this.keep(input, cam, dt); for (const k of ACTS.move.keys!) { input.keys.delete(k); input.pressed.delete(k); } keys.delete('KeyW'); keys.delete('KeyA'); keys.delete('KeyS'); keys.delete('KeyD'); }
    for (const k of [...input.pressed]) if (!ok(k)) { input.pressed.delete(k); dropped++; }
    for (const k of [...input.keys]) if (!ok(k)) input.keys.delete(k);
    // the command key held is the ring, and with Shift the plan: each its own action over `order`
    if (keys.has('KeyB')) {
      if (shift && !A.has('plan')) {
        // (the plan is not unlocked: Shift with the key is the key — Shift is out of the tick while the key is in it, so nothing reads the pair as the plan's)
        // …unless the Shift is his sprint's (a walk key down on a step that lets him run): then the pair is no plan anyway (planmode.ts planShift, `planRun`)
        const running = A.has('sprint') && ACTS.move.keys!.some(k => input.keys.has(k));
        if (RAILS.shiftTap && !running) { if (input.pressed.has('KeyB') || input.keys.has('KeyB')) { input.keys.delete('ShiftLeft'); input.keys.delete('ShiftRight'); } }
        else if (!RAILS.shiftTap || !CMDRING.planRun) { if (input.pressed.delete('KeyB')) dropped++; input.keys.delete('KeyB'); }
      }
      if (!A.has('ring') && !input.pressed.has('KeyB')) input.keys.delete('KeyB');   // (a press is a tap: the key is let go the tick after it went down)
    }
    if (input.clicked & ~buttons) dropped++;
    input.buttons &= buttons; input.clicked &= buttons;
    if (!wheel && !menuUp && !handUp) input.wheel = 0;
    RAILS_STATS.dropped += dropped;
    // (a word that sends nobody — the charge on the wall goes at once and no order is logged for it — is still the step's word given)
    if (input.pressed.has('KeyF')) { const S = this.lesson(), W = S?.L.steps[S.i]?.after; if (W?.word && !W.line) this.noteGiven('go'); }
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
  /** the sky seat's lookout (fogofwar.ts update: one more eye of the picture's, and of the team's only with RAILS.eyeView off): null without one */
  eye(): FogEye | null {
    const e = this.data?.sky?.eye; if (!e) return null;
    return this.lookout ??= lookoutEye(LOOKOUT_ID, e);
  }
  private lookout: FogEye | null = null;
  /** the step's eye has a place in the fog's list whatever else is in it (RAILS.eyeFirst) */
  get eyeFirst(): boolean { return RAILS.eyeFirst; }
  /** the frame's eyes are the picture's alone (RAILS.eyeView) */
  get eyeView(): boolean { return RAILS.eyeView && !BREAK; }
  /** the step's own lookout (its `eye`), for as long as the step is up: null without one */
  stepEye(): FogEye | null {
    const S = this.lesson(), e = S?.L.steps[S.i]?.eye; if (!e || BREAK) return null;
    if (this.stepLook?.i !== S!.i) this.stepLook = { i: S!.i, eye: lookoutEye(STEP_EYE_ID, e) };
    return this.stepLook.eye;
  }
  private stepLook: { i: number; eye: FogEye } | null = null;

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
    if (this.run !== g.mission) { this.run = g.mission; this.answered = -1; this.back = false; this.spared.clear(); if (this.sky.parked) this.unpark(); this.sky.again = true; this.fresh = 3; this.lookout = null; this.sky.off = [0, 0, 0]; this.sky.mid = null; this.sky.midT = -1; this.log.length = 0; this.ordersSeen = g.orders?.log.length ?? 0; this.moved = false; this.clean(); this.startProgram('start'); }
    else if (this.fresh > 0) this.fresh--;
    if (this.back) { this.back = false; this.clean(); this.moved = S.i > S.L.steps.findIndex(T => T.allow?.includes('order'));   // (put back past the step that taught the order: one has been given)
      this.startProgram('checkpoint'); this.answered = -1; this.answer(S, true); }
    if (this.skyOn && !this.sky.parked) this.park(S.L.rails!);
    if (this.answered !== S.i) this.answer(S, false);
    // every order the player gives is told to the level's program (a beat waits on it: c.on('signal', 'order:move'))
    { const L = g.orders?.log; if (L) { if (L.length < this.ordersSeen) this.ordersSeen = L.length; for (; this.ordersSeen < L.length; this.ordersSeen++) { const o = L[this.ordersSeen].order; if (!(this.skyOn && o === 'fallIn')) { this.moved = true; this.noteGiven(o); g.director?.signal(`order:${o}`); } } } }
    // (…and while a man is still on his way under it, the step's `after` line stays: its seconds count from the last of them standing where he was sent)
    if (this.gave && this.gaveStep === S.i && g.orders && this.squad().some(gd => { const o = g.orders!.of(gd); return !!o && o.order !== 'hold' && o.order !== 'fallIn' && !o.arrived; })) this.gaveT = g.time;
    // (the sky seat: there is nobody to fall in on — the command key on nothing, or on a man, would walk the squad off to the parked player. Such a man holds where he is)
    if (this.skyOn && g.orders) for (const gd of this.squad()) if (g.orders.of(gd)?.order === 'fallIn') this.holdHere(gd, !!S.L.rails!.sky!.low && !this.moved);   // (still on its knee behind the trucks if no order has moved it yet)
    if (S.L.steps[S.i]?.onWay?.nv === false && this.wayNv !== S.i && this.onWay(S)) { this.wayNv = S.i; if (g.player.nv) { g.player.nv = false; this.note('on the way out: night vision up'); } }   // (once: the key is his again after it)
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
  prompt(): { line: string; n: number; of: number; note?: string; watch?: boolean } | null {
    const S = this.lesson(), of = S?.L.steps.length ?? 0; if (!S || !of) return null;
    // (every step done and the mission not yet over — the last metre to an exit, the last man of a fight: the last line stays up until the mission's own
    //  end. The small row it would fall back to is the one a tutorial mission never shows)
    if (S.i >= of ? BREAK || this.g.lesson.over() : !this.g.lesson.objective()) return null;
    const i = Math.min(S.i, of - 1);
    // (the squad's ring is up ON THE STEP'S MARK: the line is what to press in it — on its first page `menuLine`, on a page under it `pageLine`)
    const T = S.L.steps[i], M = S.i < of ? this.g.orders?.menu : null, on = !!M && (!T.at || Math.hypot(M.target.at[0] - T.at[0], M.target.at[2] - T.at[2]) < MENU_M);
    const ring = on ? (M!.page === null ? T.menuLine : T.pageLine ?? T.menuLine) : undefined;
    const d = this.g.time - this.tapT, note = S.i < of && T.noTap && !M && d >= 0 && d < NOTE_SECS ? lessonLine(T.noTap) : undefined;
    // (the order the step asks for has gone out: the line is what the men are doing — never the ask again while they do it; `afterSecs` on, the step asks again)
    const since = this.g.time - this.gaveT, A = S.i < of && !BREAK && this.gaveStep === S.i && this.gave && RAILS.afterSecs > 0 && since >= 0 && since < RAILS.afterSecs && this.g.time - this.gave0 < RAILS.afterMax ? T.after : undefined;
    const aft = A ? (this.gave === 2 ? A.word ?? A.line : A.line) : undefined;
    // (a step done in plan mode, and the mode is down — a checkpoint put back, the mode put away by hand: the line is what puts it up again, its `planLine`)
    const plan = S.i < of && T.planLine && !this.g.orders?.plan.up ? T.planLine : undefined;
    const line = ring ? lessonLine(ring) : plan ? lessonLine(plan) : aft ? lessonLine(aft) : stepLine(T);
    // (a line that asks for nothing — what the men are doing, or a step that only waits for the level's script — is drawn as something to watch, with no
    //  ring on its place. Never a step's own line that merely names no key: 'Get out of the light' is an ask, and its mark is where to go)
    const watch = !ring && !plan && (!!aft || (S.i < of && T.done?.is === 'cue')) && !/\[[^\]]+\]/.test(line);
    return { line, n: i + 1, of, ...(note ? { note } : null), ...(watch ? { watch: true } : null) };   // (lesson.ts: the step's line as the keys stand — a ring for his own actions, a gun's setup)
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
  /** where your own men stand, for the big line to keep clear of (ui/railclear.ts): the player when he is on the floor, and every living teammate */
  lineMen(): { pos: Vec3; bones: { head?: Vec3 } }[] {
    const out: { pos: Vec3; bones: { head?: Vec3 } }[] = []; if (BREAK || !RAILS.lineClear || !this.live) return out;
    for (const gd of this.g.guards) if (gd.unit && gd.team === 'operative' && gd.state !== 'dead') out.push(gd.char);
    if (!this.skyOn) out.push(this.g.player.char);
    return out;
  }
  private squad(): Guard[] { return this.g.guards.filter(x => x.unit && x.team === 'operative' && x.state !== 'dead'); }
  private park(R: RailsData) {
    const g = this.g; this.sky.parked = true; this.sky.was = { invisible: g.playerInvisible };
    g.playerInvisible = true; g.teleportPlayer(R.sky!.park);
    // (a squad with no order falls in on Sam: on the parked man, out of the picture. In this seat it holds where the mission stood it until its first order)
    for (const gd of this.squad()) this.holdHere(gd, !!R.sky!.low);
    this.note(`sky seat: the player parked at (${R.sky!.park[0]}, ${R.sky!.park[2]})`);
  }
  private holdHere(gd: Guard, low = false) { const p = gd.char.pos; this.g.orders?.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding', ...(low ? { crouch: true } : null) }); }
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
    if (this.onWay(S)) {   // (the step's order is given: the view goes back to the squad, which it rides to the mark)
      const o = this.sky.off, d = Math.hypot(o[0], o[2]); if (d < 1e-3) return; const k = Math.max(0, 1 - RAILS.keepSpeed * (cam.distance / 21) * dt / d); o[0] *= k; o[2] *= k; return; }
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
