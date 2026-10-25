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
import { planTakesDigits } from './planmode';   // (asked inside gate() only)
import { stepLine, lessonLine, lessonTokenFaults } from './lesson';   // (called inside prompt() only: src/game is one import cycle)
import { slotSetupLeft, setupRows } from './slotsetup';   // (asked inside gate() only)
import { HANDRING } from './handring';
import { STALK } from './stalk';   // (read inside gate() only)
import { choosable, runningVerb } from './interact';   // (both read inside gate() only)
import { INTERACT_KEY } from './consts';
import { teamOfId } from './teams';   // (called inside tick() only)

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
  /** a step's `onWay.run`: those men RUN the leg ("the guys should sprint back to exfil when they're done": the mission's own order, one more reason of
   *  teampace.ts — a hurt man and a quiet one still walk). false: they walk it, as it was */
  wayRun: true,
  /** THE SKY SEAT'S PICTURE IS PLAN MODE'S ("first tutorial level should have the plan mode overlay"): its frame and its word round the view and every man
   *  ringed in his pair's colour, the men the next order goes to drawn full (planmode.ts planView, drawn by ui/cmdring.ts; needs plan mode on in the page).
   *  Picture only: the mode itself is not up, and nothing of it is taught here. false: no such picture in that seat, as it was */
  skyPlan: true,
  /** THE SKY SEAT WITH PLAN MODE UP (`rails.sky.plan`; the maintainer of the plan mode mission, 10-23: "i think having the 2nd tutorial is fine, but we
   *  should remove the player character"): the mode is up from the first tick with nobody of his on the floor, its view starts on the squad and is the
   *  walk keys' as the mode has it, and neither the pair, the back key nor Esc puts it down (planmode.ts `seat`; putting the mode up and down is another
   *  mission's lesson). false: that seat is the plain sky seat — the mode down and only drawn — and a mission that asks for a box or a right click
   *  there cannot be played */
  skyUp: true,
  /** PLAN MODE'S DIGITS ARE THE MODE'S, AND PICKS WAIT FOR THEIR LESSON (the maintainer, 10-24: "we should also remove the 'click on the ground to select
   *  everyone' in plan mode, and change the tutorial to teach using 1, 2, 3, 4, and 5 to select squad members"). Two halves, one switch:
   *  · with the mode up on a mission that gives `plan`, a digit pressed is let through the gate exactly when planInput will take it that tick
   *    (planmode.ts planTakesDigits: the page has the digits pick the men — CMDRING.planDigits — and no menu, ring or closing key is in the tick), so no
   *    such press reaches a slot. Before it every digit was a locked slot's key there, dropped, and no line could teach one;
   *  · nothing picks a man — no digit, no click on him, no box — before a step that teaches picking is up (a step whose test is `picked`; `locksPicks`,
   *    which planmode.ts asks as it asks for the word's lock), and his digit is not drawn by his circle until then. Every order before it goes to the
   *    whole squad: a stray click on a man there left one man picked, and the way back, a click on bare ground, is out of the mode. A mission that has
   *    the mode and never teaches picking (the squad mission's two plan steps) never picks.
   *  false (the module and the frozen stand; TPS_RAILDIGITS=1 raises it, the page's ?raildigits=0 puts it off): a digit is a locked slot's key and is
   *  dropped, a slot he HAS picks its man, and a click or a box picks from the mode's first tick, as the build was — a line that names a digit cannot be done */
  planDigits: false,
  /** SHIFT WITH THE COMMAND KEY ON THE MOVE: where a step gives him his feet and plan mode but not his sprint, a walk key held is no sprint's — so Shift
   *  with the command key, pressed, is the mode's there too, and the walk keys are out of that one tick (the Shift that gets through never meets a walk
   *  key to run with). false: with a walk key down the pair did nothing at all until he stood still, as it was */
  planWalk: true,
  /** THE TICK THE MODE COMES DOWN: with the mode up the gate lets through what is the mode's (Shift, both buttons, the walk keys that move its view), and
   *  the mode can come down inside that same tick, by the pair, the back key, or any other road — and then what was let through was his feet's, his
   *  sprint's and his trigger's for what was left of the tick, on a step that locks them. So right after the orders have read the tick (`afterOrders`),
   *  a mode that was up and is down takes back what only it was given. false: that tick was his (3.5 cm with a walk key on locked feet, a tick at a
   *  run on a locked sprint), and — as the first cut of `planWalk` had it — the gate guessed the pair's and the back key's tick from the keys alone and
   *  took the walk keys out of it where his sprint was locked: a recording made on that cut replays so */
  planDown: true,
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
  /** a step's mark is not drawn where a ring lies over it, the squad's or his own (ui/overlay.ts asks ui/cmdring.ts `covers`; picture only): the mark
   *  is on the spot a ring opens on, so its circle lay over the ring's middle and the digits of its inner wedges — and with the ring up there the
   *  place is found, and the line says what to press (`?markclear=0`; a knob of the frame's table like lineClear, and the frame is off on the
   *  frozen stand) */
  markClear: true,
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
  /** A CARD LANDS A BEAT AFTER WHAT WAS ON SCREEN ("we show the modals too quickly. like it should happen a beat after something happens on screen … my squad
   *  covered the gate but then seeing them shoot the bad guys got interrupted by the modal"): a card pauses the world the tick its step comes up, and a
   *  step comes up the tick the deed before it is done — the middle of whatever that deed set off. So THE STEP BEFORE A CARD SETTLES: its deed done, the
   *  lesson stays on it (lesson.ts tick asks `settles`) for `cardBeatSecs` seconds. Then the next step comes up with its card, as it always did: its
   *  keys, its cue, its checkpoint and its mark with it, nothing ahead of the card (so all of them are that beat later than the deed: THIS MOVES TICKS).
   *  Meanwhile the done step's line is what there is to watch — its own line where the step only waited for the level's script, else what its men are
   *  doing (its `after` line, when that asks for no key) — or nothing at all. What he does in the beat is the done step's: the next step counts from
   *  the tick it comes up, as every step does. The beat is the step's whether or not the page then shows the card (one read already, ?cards=0, a run
   *  with no page). TWO WORDS ARE THE CARD'S OWN: `explain.quiet` — the deed before this card sets off a fight he
   *  is there to watch (his squad sent at a gate, into a room), so the card also waits while that fight is on: a round of his own or his squad's, a
   *  blast, a door kicked in or a man going down in the last `cardQuiet` seconds, never past `cardMax` seconds from the deed; and `explain.now` — a card
   *  that must cut in, no beat at all. The fight's wait is asked for and not the rule: where he is the one shooting and the next step is his next
   *  move in that fight, a card held for his own rounds held its keys and its cue with it. OFF here and on the frozen stand, where the next step comes
   *  up the tick the deed is done, as it was (TPS_CARDBEAT=1 raises it there, with the frame); ON in the page (profile.ts; ?cardbeat=0) */
  cardBeat: false, cardBeatSecs: 1.2, cardQuiet: 2, cardMax: 9,
  /** TO THE ENEMY A SPARED MAN IS A MAN DOWN (a recorded play of the first mission, 10-24: a teammate took the round that would have killed him, went on
   *  his knee for the level's `respawn` seconds, and the defender who had shot him kept firing into him the whole time). While he is on his knee nobody
   *  of theirs is on him: the man whose foe he was comes off him as off a man he has dropped (guards.ts acquireFoe: the next enemy in his sight, else
   *  his wary look round), and nobody takes him for a new one (acquireFoe; a moving defender's stop to fight, roomfight.ts; the response's eye, qrf.ts;
   *  a colleague's man, tactics.ts; the men a defender counts for a grenade, frag.ts). The defender says nothing of it and a burst he had begun ends.
   *  Up again he is seen and fought like anybody. THIS MOVES FIGHTS on a mission with `respawn`. OFF here and on the
   *  frozen stand (TPS_SPAREDOWN=1 raises it there, with the frame); ON in the page (profile.ts; ?sparedown=0) */
  spareDown: false,
  /** A MISSION MAY TAKE THE FLAT RING (the maintainer, 10-23, of the first mission's wall charge — the ring, [5], and then a second ring of one row
   *  under a line that asked for [3]: "weird after hitting 5"). A tutorial mission's ring was the menu's pages, because its lines name their digits;
   *  one whose level says `rails.flatRing` has the ring the rest of the game has (cmdring.ts CMDRING.flat: every order of the thing on one ring, with
   *  the level's `rails.orders` its only rows), and the step's line while that ring is up is its `flatLine`. false: the pages on every tutorial
   *  mission, as built. Off here and on the frozen stand (`TPS_RAILFLAT=1`, which acts only with the frame and the flat tree up: `TPS_RAILS=1`
   *  `TPS_QRING=1 TPS_QONLY=1 TPS_RINGFLAT=1`); the page raises it (`?railflat=0` off) */
  flatRing: false,
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
  // (`stalk` has no key: it is the held left click that walks him up behind a man — stalk.ts, the gate's own line for it. THE ONE ACTION THAT IS OPEN
  //  UNLESS A STEP DENIES IT — `shuts`, below — because it rides with `use` wherever a mission names the grab's row, and a level that never says the
  //  word plays as it did. A step denies it where a man must not be gone for by hand, and keeps the interaction key)
  stalk: {},
  hands: { keys: ['KeyE', 'Digit0'] }, use: { keys: ['Space', 'ArrowUp', 'ArrowDown'] }, whistle: { keys: ['KeyV'] }, light: { keys: ['KeyL'] }, nvg: { keys: ['KeyN'] },
  order: { keys: ['KeyB'] }, ring: {}, menu: { keys: ['KeyX'], buttons: 4 }, who: { keys: ['KeyT'] }, word: { keys: ['KeyF'] }, tools: { keys: ['KeyG', 'KeyH'] }, plan: {},
  camera: {}, zoom: {},
  // (ownblow.ts: a charge his own hands set, set off from his own list — no key of its own: the row is `use`'s, and a mission that names this action or
  //  the squad's word has that row from the step that opens either)
  blow: {},
  // (a mission that hands him two loads and has him swap before he fires: the setup's load row with the right button still shut. No key of its own: the
  //  row's digit is the row's — `gate`, below — and off the setup the swap is the rifle's own key)
  load: {},
};
/** never locked: the page's own (the pause, the back key, a restart, the one-tick codes the host hands the tick) */
/** the lookout's id among the fog's eyes: no character's, and under the sticky cameras' (stickycam.ts EYE_ID, which its count starts at) */
const LOOKOUT_ID = 199, STEP_EYE_ID = 198;
/** seconds a refused tap's words stay up under the line */
const NOTE_SECS = 2.6;
/** metres from the step's mark the squad's ring may be opened and still be the step's ring (its `menuLine`) */
const MENU_M = 6;
/** a step's `after` line as its order stands: given (1), or given and waiting on his word (2) */
const said = (A: { line?: string; word?: string }, gave: number): string | undefined => gave === 2 ? A.word ?? A.line : A.line;
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
  if (Array.isArray(R.allow) && R.allow.includes('stalk')) out.push("rails.allow: 'stalk' is open unless a step denies it, so naming it in the frame's list means nothing (a step's deny takes it, a later step's allow gives it back)");
  const cues = new Set<string>();
  L.steps.forEach((T, i) => { const w = `steps[${i}] '${T.id}'`; bad(`${w}.allow`, T.allow); bad(`${w}.deny`, T.deny);
    if (T.explain && (T.explain.text.length > CARD_CHARS || (T.explain.title?.length ?? 0) > 40)) out.push(`${w}.explain: a card is a heading of at most 40 characters and at most ${CARD_CHARS} of text (it is ${T.explain.title?.length ?? 0} and ${T.explain.text.length}): a card nobody reads teaches nothing`);
    // (a card's words and the frame's other lines are written out by lessonLine as a step's line is: a move's token in one is held the same way, by what the
    //  player reads — lesson.ts lessonTokenFaults — and a card's TITLE is shown as written, so a brace in it would be shown too)
    if (T.explain) { out.push(...lessonTokenFaults(`${w}.explain.text`, T.explain.text, CARD_CHARS)); if (/[{}]/.test(T.explain.title ?? '')) out.push(`${w}.explain.title has a brace: a card's title is shown as written, a move's token goes in its text`); }
    for (const [k, l] of [['noTap', T.noTap], ['menuLine', T.menuLine], ['pageLine', T.pageLine], ['flatLine', T.flatLine], ['planLine', T.planLine], ['after.line', T.after?.line], ['after.word', T.after?.word]] as const) if (typeof l === 'string') out.push(...lessonTokenFaults(`${w}.${k}`, l, 96));
    // (a mission on the flat ring: a line that names the pages' digits has its one-ring line beside it, and a one-ring line is for such a mission only)
    if (R.flatRing && T.menuLine !== undefined && T.flatLine === undefined) out.push(`${w}.menuLine names the menu's pages and rails.flatRing gives this mission one ring: the step wants a flatLine too`);
    if (!R.flatRing && T.flatLine !== undefined) out.push(`${w}.flatLine: the lesson's rails.flatRing is not set, so no ring here is flat`);
    if (T.cue !== undefined) { if (cues.has(T.cue)) out.push(`${w}.cue '${T.cue}' is another step's too: a cue starts one beat`); cues.add(T.cue); } });
  if (R.rows !== undefined && !(Array.isArray(R.rows) && R.rows.length > 0 && R.rows.every(v => typeof v === 'string' && !!v))) out.push('rails.rows: a list of verbs, at least one (absent: every row)');
  if (R.sky && !(Array.isArray(R.sky.park) && R.sky.park.length === 3)) out.push('rails.sky.park: a Vec3 (where the player stands, out of the picture)');
  // (the seat that holds plan mode up: the mode's hands are the frame's `plan`, from the first step to the last, or the mode is up with no button and no view key)
  if (R.sky?.plan) { if (!(R.allow ?? []).includes('plan')) out.push("rails.sky.plan: the seat holds plan mode up, so rails.allow gives 'plan' (the mode's buttons and its view keys)"); L.steps.forEach((T, i) => { if (T.deny?.includes('plan')) out.push(`steps[${i}] '${T.id}'.deny: 'plan' cannot be taken away where rails.sky.plan holds the mode up`); }); }
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
  /** the game's clock at the last moment of HIS fight (RAILS.cardBeat; `fight`): a round of his own or his squad's, a blast, a door kicked in, a man going down */
  private actT = -1e9;
  /** …read off this tick's events and the men: asked every tick on a level that has a card marked `quiet` (tick), and again by `settles`, which the
   *  lesson asks before the frame's own tick. His side's rounds, not the other's: a level's staged fire and a gun nest that never stops are no fight
   *  of his to watch, and a step held for them would be held to the cap every time — what the men of the other side do to his shows as a blast or a
   *  man going down. A living man's `diedAt` is below zero and is no moment at all */
  private fight(): number { const g = this.g;
    for (const e of g.events) if (e.time > this.actT && (e.kind === 'kick' || e.kind === 'bang' || (e.kind === 'prop' && e.loud)
      || ((e.kind === 'shot' || e.kind === 'guardShot') && !!e.weapon && (e.kind === 'shot' || teamOfId(g, e.who ?? -1) === 'operative')))) this.actT = e.time;
    for (const gd of g.guards) if (gd.diedAt >= 0 && gd.diedAt > this.actT && gd.diedAt <= g.time) this.actT = gd.diedAt;
    return this.actT; }
  log: string[] = [];
  constructor(private g: Game) {}

  /** the rails record in force (null: none — the switch, no lesson live, a lesson without the record) */
  get data(): RailsData | null { if (!RAILS.on) return null; return this.g.lesson?.data?.rails ?? null; }
  get live(): boolean { return !!this.data; }
  get skyOn(): boolean { return !!this.data?.sky; }
  /** the sky seat is drawn as plan mode is, the mode itself down (RAILS.skyPlan; planmode.ts planView asks) */
  get planDrawn(): boolean { return !BREAK && RAILS.skyPlan && this.skyOn; }
  /** this mission's ring is the flat tree's (`rails.flatRing`, RAILS.flatRing; orders.ts flatRing asks, with the tree's own switches) */
  get flatRing(): boolean { return !BREAK && RAILS.flatRing && !!this.data?.flatRing; }
  /** the sky seat holds plan mode up (`rails.sky.plan`, RAILS.skyUp; planmode.ts asks: no key takes the mode down, its view starts on the squad) */
  get planSeat(): boolean { return !BREAK && RAILS.skyUp && !!this.data?.sky?.plan; }
  /** …and the mode's own view is the picture's: the mode is up with a point of its own (CMDRING.planRts; without one the seat's view and its pan stand) */
  private get seatView(): boolean { const P = this.g.orders?.plan; return this.planSeat && !!P?.up && !!P.look; }
  /** PICKS WAIT FOR THEIR LESSON (RAILS.planDigits; planmode.ts asks before a digit, a click on a man or a box picks anybody, and before it draws a man's
   *  digit): no step up to the one that is up teaches picking — its test, or a branch of it, is `picked`. Derived from the step that is up, nothing kept */
  locksPicks(): boolean {
    const S = this.lesson(); if (BREAK || !RAILS.planDigits || !S) return false;
    const asks = (t: unknown): boolean => !!t && typeof t === 'object' && ((t as { is?: unknown }).is === 'picked' || (Array.isArray((t as { of?: unknown }).of) && ((t as { of: unknown[] }).of).some(asks)));
    for (let k = 0; k <= S.i && k < S.L.steps.length; k++) if (asks(S.L.steps[k].done)) return false;
    return true;
  }
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
  /** HAS A STEP TAKEN THIS BACK (`stalk`, the one action that is open unless a step denies it): the last step up to this one that names the action
   *  denies it. An action no step names is not shut — unlike `locks`, which shuts whatever nobody gave — so a level that never says the word plays
   *  as it did. The set is derived here too, never kept. The gate below keeps the left button from the stalk on it, and stalk.ts asks it of its own
   *  gate (`free`), so the click is shut whatever else owns the button and no hint offers it */
  shuts(action: string): boolean {
    const S = this.lesson(); if (!S || BREAK) return false; let off = false;
    for (let k = 0; k <= S.i && k < S.L.steps.length; k++) { const T = S.L.steps[k]; if (T.allow?.includes(action)) off = false; if (T.deny?.includes(action)) off = true; }   // (a step's deny after its allow, as `allowed` folds them)
    return off;
  }
  /** IS THIS ACTION'S KEY KEPT OFF THE PICTURE (game/floorplan.ts waitsOnKey): the step that is up holds it shut, so the press does nothing and nothing on the
   *  floor names the key. One question for every reader that draws a key */
  hushes(action: string): boolean { return !BREAK && this.locks(action); }
  /** A MISSION THAT TEACHES THE WALL (a step of it allows `wall`) keeps a walk into one from taking it until that line. The walk has no key for the gate to
   *  drop (player.ts wallPress asks here); a mission that never names the wall leaves it as the page has it. */
  locksWall(): boolean { if (BREAK) return false; const A = this.allowed(), S = this.lesson(); return !!A && !!S && !A.has('wall') && S.L.steps.some(T => T.allow?.includes('wall')); }

  // ---------------------------------------------------------------- the page's two looks at the step (nothing under src/game reads them)
  /** THE CARD of the step that is up (its `explain`) — the step's own data and nothing else: which cards have been read is the page's to keep
   *  (ui/railcard.ts, which draws it; main.ts holds the world still under it), so nothing here is in a snapshot or a recording */
  card(): { title?: string; text: string } | null { const S = this.lesson(), T = S?.L.steps[S.i]; return BREAK || !T?.explain || this.g.lesson.over() ? null : { title: T.explain.title, text: lessonLine(T.explain.text) }; }   // (lessonLine: the card says the key the build has, as the step's line does)
  /** DOES THE STEP WHOSE DEED IS DONE STAY UP A LITTLE LONGER (RAILS.cardBeat; lesson.ts tick asks every tick from the one its deed was done on, `doneT`):
   *  only a step whose next one opens on a card, for the card's beat — and, for a card marked `quiet`, while a fight of his is still on, to the cap */
  settles(L: LessonData, i: number, doneT: number): boolean {
    const E = L.steps[i + 1]?.explain; if (BREAK || !RAILS.cardBeat || !this.live || !E || E.now) return false;
    const t = this.g.time - doneT; return t >= 0 && (t < RAILS.cardBeatSecs || (!!E.quiet && t < RAILS.cardMax && this.g.time - this.fight() < RAILS.cardQuiet));
  }
  /** THE ARROW the step's mark is drawn as (its `toward`): where it points — null: the ring */
  arrow(): Vec3 | null { const S = this.lesson(), T = S?.L.steps[S.i]; return BREAK || !T?.at || !T.toward || this.g.lesson.over() ? null : T.toward; }

  /** no teammate shows an aiming laser on this level (irlaser.ts laserOn asks) */
  noLasers(): boolean { return !BREAK && this.data?.lasers === false; }
  /** THE STEP TEACHES THE HOLD (its `noTap`): a tap of the command key gives nothing (orders.ts quickGive asks, and the tap is noted for the page) */
  tapOff(): boolean { if (!this.teachesHold()) return false; this.tapT = this.g.time; RAILS_STATS.dropped++; return true; }
  /** the step that is up teaches the hold (the squad panel's row for the tap is not offered: orders.ts) */
  teachesHold(): boolean { const S = this.lesson(); return !BREAK && !!S?.L.steps[S.i]?.noTap; }
  /** a run begun, or a checkpoint put back: what the frame keeps for the page and for one step is as at a start */
  private clean() { this.tapT = -1e9; this.wayNv = -1; this.stepLook = null; this.gaveStep = -1; this.gave = 0; this.gaveT = this.gave0 = -1e9; this.actT = -1e9; }
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
  /** this man runs the leg he is on (a step's `onWay.run`, RAILS.wayRun; teampace.ts teamTold asks): the step's order is out (`running`, said once a tick:
   *  a man of the squad is under an order to the step's mark) and he is a man of the squad sent somewhere by an order — every man of it, whichever mark
   *  the order dealt him: one order is one pace */
  runs(gd: Guard): boolean {
    if (!this.running || !gd.unit || gd.team !== 'operative' || gd.state === 'dead') return false;
    const A = this.g.orders?.of(gd); return !!A && A.order !== 'fallIn' && A.order !== 'hold';
  }
  /** the step that is up tells its men to run and its order has gone out (tick) */
  private running = false;
  /** is a man of the squad under an order to the step's mark (the step's `onWay`: its order has been given and they are walking it) */
  private onWay(S: { L: LessonData; i: number } | null): boolean {
    const T = S?.L.steps[S.i], at = T?.at; if (BREAK || !T?.onWay || !at || !(RAILS.wayM > 0)) return false;
    const O = this.g.orders; return !!O && this.squad().some(gd => { const P = O.of(gd)?.post; return !!P && Math.hypot(P[0] - at[0], P[2] - at[2]) < RAILS.wayM; });
  }

  /** does Space offer a row of this verb here (player.ts buildInteractables): the keys are locked by action, and Space is ONE key over every row in
   *  reach — so a level names the verbs its steps teach (`rails.rows`) and a thing nobody taught has no row at all. On such a level
   *  there is no row either while Space itself is locked: a prompt for a key that does nothing is a lie in the corner of the screen */
  offers(verb: string): boolean { const R = this.data?.rows; return !R || BREAK || (R.includes(verb) && !this.locks('use')); }

  /** what the gate let through this tick only because plan mode was up when the tick began, as what he may have without the mode (his own buttons, his
   *  Shift, his walk keys): set by `gate`, read and dropped by `afterOrders` in the same tick, so no snapshot between ticks ever holds one */
  private planTick: { buttons: number; shift: boolean; walk: boolean } | null = null;
  /** RIGHT AFTER THE ORDERS HAVE READ THE TICK (Game.step; RAILS.planDown): the mode was up when the gate ran and is down now — the pair, the back key,
   *  the squad no longer his to order, nobody left to order, a save loaded: whichever road — so what was the mode's goes out of the tick before his feet, his sprint or his trigger read it */
  afterOrders(input: Input) {
    const T = this.planTick; this.planTick = null; if (!T || this.g.orders?.plan.up) return;
    input.buttons &= T.buttons; input.clicked &= T.buttons;
    if (!T.shift) for (const k of ACTS.sprint.keys!) { input.keys.delete(k); input.pressed.delete(k); }
    if (!T.walk) for (const k of ACTS.move.keys!) { input.keys.delete(k); input.pressed.delete(k); }
  }
  /** THE GATE (Game.step, right after the tick's record is loaded into the seat's input): whatever the step has not unlocked is taken out of the tick */
  gate(input: Input, cam: FollowCamera, dt: number) {
    this.planTick = null;
    const A = this.allowed(); if (!A || BREAK) return;
    const keys = new Set<string>(); let buttons = 0, wheel = false;
    for (const a of A) { const act = ACTS[a]; if (!act) continue; for (const k of act.keys ?? []) keys.add(k); buttons |= act.buttons ?? 0; wheel ||= !!act.wheel; }
    const g = this.g, menuUp = !!g.orders?.menu && (A.has('menu') || A.has('ring'));
    const shift = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const enter = input.keys.has('Enter') || input.pressed.has('Enter') || input.keys.has('NumpadEnter') || input.pressed.has('NumpadEnter');   // (Shift+Enter stages the mission again: Shift rides with it)
    const handUp = A.has('use') && !!g.player.sel?.open;   // (the player's own ring or list, up: its digits and its clicks are its own)
    if (STALK.on && g.player.holstered && A.has('use') && this.offers('grab') && !this.shuts('stalk')) buttons |= 1;   // (stalk.ts: the held click is how a man is grabbed — where the mission teaches the grab and his hands are empty, the left button is that and nothing else)
    if (menuUp || handUp) buttons |= 1; if (handUp) buttons |= 4;   // (a menu or a ring that is up is worked with its own keys: the digits, the wheel, a left click on a row, V)
    // PLAN MODE IS ITS OWN ACTION (`plan`; planmode.ts): the command key with Shift opens it whether or not the key's own order has been taught, and while it
    // is up its hands are its own — Shift (a stop added, a man added), the walk keys (they move the view: he is on a knee) and both buttons (the left
    // picks men, the right orders them). None of that is his feet, his sprint or his trigger: those stay locked until a step names them
    // (only where the page HAS the mode — `?qplan=0` and the frozen stand do not, and there the key with Shift is the key's own order, which stays locked. A walk
    //  key held is a sprint's only where his feet are his: on a mission that never gives them it cannot stand between Shift and the key)
    const WALK = ACTS.move.keys!, planOn = A.has('plan') && CMDRING.plan, planUp = planOn && !!g.orders?.plan.up, walking = A.has('move') && WALK.some(k => input.keys.has(k));
    if (planUp) { if (RAILS.planDown) this.planTick = { buttons, shift: A.has('sprint') || enter, walk: A.has('move') }; buttons |= 5; if (CMDRING.planRts) for (const k of WALK) keys.add(k); }   // (the walk keys are the view's only in the mode as an RTS's: without it they are his feet)
    // (RAILS.planDigits · …and its digits, where the page has them pick the men: exactly the presses planInput will take this tick — planmode.ts
    //  planTakesDigits, its own answer, so the two cannot drift: with a menu, the ring or the ring's key up a digit is that menu's own. Only the PRESS is
    //  let through, by its own test below and not by `ok`: a digit held is nobody's. Whether the press then PICKS is planInput's to say — `locksPicks`)
    const planDigit = planUp && RAILS.planDigits && !!g.orders && planTakesDigits(g.orders, input);
    // (RAILS.planWalk · …and where his feet are his and his sprint is not, a walk key held is nobody's sprint: the pair PRESSED with the mode down is the
    //  mode's with a walk key down too, and the walk keys leave that one tick with it — planmode.ts planShift, under `planRun`, reads a walk key as a
    //  run, and a Shift that reached his feet would be one. Only on a press planInput would take: no ring up, nothing nearer for the key to back out of.
    //  The tick the mode comes DOWN is `afterOrders`'s, RAILS.planDown; without that rule it was guessed here, from the keys, as the first cut did)
    const cmdKey = input.pressed.has('KeyB') || input.keys.has('KeyB'), pair = shift && input.pressed.has('KeyB');
    const halt = RAILS.planWalk && planOn && walking && !A.has('sprint') && (RAILS.planDown ? !planUp && pair && !!g.orders && !g.orders.cmdRing && g.orders.backFree()
      : shift && (input.pressed.has('KeyB') || (planUp && (input.pressed.has('Escape') || input.pressed.has('Tab')))));
    if (halt) for (const k of WALK) { input.keys.delete(k); input.pressed.delete(k); }
    if (planOn && (planUp || ((!walking || halt) && cmdKey))) { keys.add('ShiftLeft'); keys.add('ShiftRight'); if (shift) keys.add('KeyB'); }
    // THE SETUP OF THE GUN IN HIS HANDS, up (slotsetup.ts): a row's digit is the row's there, whatever slot that digit is anywhere else, so it is let through
    // by what the ROW does and never by the slot: the selector with `mode`, the lamp with `light`, the launcher's load with `alt` (the right button fires
    // what that row loads: a lesson that opens the setup before it has taught the launcher keeps the row shut) or with `load`, the row alone, for a lesson that has him swap
    // loads before the button is his. Not on the setup's last ticks: a digit let through as a row the tick the setup shuts by
    // its clock would be the locked slot's key after all
    const setup = slotSetupLeft(g) > 0.03 ? g.player.setup : null, rows = setup ? setupRows(g.player, setup.gun) : [];
    // (a row's digit with the setup up is the ROW's, whatever else that digit is: the rifle's own key is also its load's row)
    const rowOf = (code: string) => rows.find(x => code === `Digit${x.key}`);
    // (handring.ts `early`: a digit pressed INSIDE the interaction key's hold, before the ring is up, puts it up and is its wedge at once. A hand that
    //  reads "Hold E, then 5" presses the 5 well inside that hold, and with the digit dropped here as a locked slot's the key did nothing at all. It
    //  passes only where interact.ts will take it this tick — the press armed, the key down, something to choose — so it never reaches a slot)
    const P = g.player, S = P.sel, handKey = A.has('use') && !handUp && HANDRING.on && HANDRING.early && !g.puppet && !P.down && !P.takedown && !g.orders?.cmdRing && !g.orders?.menu
      && input.keys.has(INTERACT_KEY) && (S.downT >= 0 || (input.pressed.has(INTERACT_KEY) && !P.fHeld)) && !runningVerb(g) && (!this.locks('whistle') || choosable(g.nearby));
    const ok = (code: string) => { const r = rowOf(code); if (r) return r.kind === 'load' ? A.has('alt') || A.has('load') : A.has(r.kind === 'mode' ? 'mode' : 'light');   // (the load is what the right button fires: its row opens with that button, or by its own name ahead of it)
      return FREE.test(code) || keys.has(code) || (menuUp && (DIGIT.test(code) || code === 'KeyV')) || ((handUp || handKey) && DIGIT.test(code)) || (enter && (code === 'ShiftLeft' || code === 'ShiftRight')); };
    let dropped = 0;
    // the sky seat's walk keys are the view's, never his feet's: read here, then gone from the tick
    // (…but with plan mode held up in that seat — RAILS.skyUp — they are the mode's own, which moves its view by them: planmode.ts pan)
    if (this.skyOn && !(planUp && this.seatView)) { if (A.has('pan')) this.pan(input, cam, dt); this.keep(input, cam, dt); for (const k of ACTS.move.keys!) { input.keys.delete(k); input.pressed.delete(k); } keys.delete('KeyW'); keys.delete('KeyA'); keys.delete('KeyS'); keys.delete('KeyD'); }
    for (const k of [...input.pressed]) if (!ok(k) && !(planDigit && DIGIT.test(k))) { input.pressed.delete(k); dropped++; }
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
    this.running = !BREAK && RAILS.wayRun && !!S?.L.steps[S.i]?.onWay?.run && this.onWay(S);
    if (!S) { if (this.sky.parked) this.unpark(); return; }
    if (this.run !== g.mission) { this.run = g.mission; this.answered = -1; this.back = false; this.spared.clear(); if (this.sky.parked) this.unpark(); this.sky.again = true; this.fresh = 3; this.lookout = null; this.sky.off = [0, 0, 0]; this.sky.mid = null; this.sky.midT = -1; this.log.length = 0; this.ordersSeen = g.orders?.log.length ?? 0; this.moved = false; this.clean(); this.startProgram('start'); }
    else if (this.fresh > 0) this.fresh--;
    if (this.back) { this.back = false; this.clean(); this.moved = S.i > S.L.steps.findIndex(T => T.allow?.includes('order'));   // (put back past the step that taught the order: one has been given)
      this.startProgram('checkpoint'); this.answered = -1; this.answer(S, true); }
    if (this.skyOn && !this.sky.parked) this.park(S.L.rails!);
    if (this.answered !== S.i) this.answer(S, false);
    // (RAILS.cardBeat · the last moment of HIS fight is kept up to date wherever a card ahead waits for one to go quiet: events are kept half a second)
    if (RAILS.cardBeat && S.L.steps.some((T, k) => k > S.i && T.explain?.quiet)) this.fight();
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
    // (the squad's ring is up ON THE STEP'S MARK: the line is what to press in it — on its first page `menuLine`, on a page under it `pageLine`; a flat ring, RAILS.flatRing: `flatLine`)
    const T = S.L.steps[i], M = S.i < of ? this.g.orders?.menu : null, on = !!M && (!T.at || Math.hypot(M.target.at[0] - T.at[0], M.target.at[2] - T.at[2]) < MENU_M);
    const ring = on ? (M!.flat ? T.flatLine ?? T.menuLine : M!.page === null ? T.menuLine : T.pageLine ?? T.menuLine) : undefined;
    // (RAILS.cardBeat · the step's deed is done and it settles before the next step's card: what its men are doing, or nothing — never the ask again,
    //  whatever is open, and never a line that asks for a key: a step may be done by more than the press its `after` line goes on to ask for. A step
    //  that waits out its own `settle` with no card after it keeps its line as it was: that wait is the level's, and its line is the level's to judge)
    if (S.i < of && RAILS.cardBeat && !!S.L.steps[S.i + 1]?.explain && this.g.lesson.settling) { const w = T.done?.is === 'cue' ? stepLine(T) : T.after && this.gaveStep === S.i && this.gave ? lessonLine(said(T.after, this.gave) ?? '') : ''; return { line: /\[[^\]]+\]/.test(w) ? '' : w, n: i + 1, of, watch: true }; }
    const d = this.g.time - this.tapT, note = S.i < of && T.noTap && !M && d >= 0 && d < NOTE_SECS ? lessonLine(T.noTap) : undefined;
    // (the order the step asks for has gone out: the line is what the men are doing — never the ask again while they do it; `afterSecs` on, the step asks again)
    const since = this.g.time - this.gaveT, A = S.i < of && !BREAK && this.gaveStep === S.i && this.gave && RAILS.afterSecs > 0 && since >= 0 && since < RAILS.afterSecs && this.g.time - this.gave0 < RAILS.afterMax ? T.after : undefined;
    const aft = A ? said(A, this.gave) : undefined;
    // (a step done in plan mode, and the mode is down — a checkpoint put back, the mode put away by hand: the line is what puts it up again, its `planLine`)
    const plan = S.i < of && T.planLine && !this.g.orders?.plan.up ? T.planLine : undefined;
    // (…and over a FLAT ring it is the line whatever is open: that ring's line names ONE digit, and with the order out the row on it may be the order's
    //  next half — a charge on the wall, and the wedge that set it now blows it. The pages' two lines stay as they were built)
    const flatAft = !!aft && !!M?.flat;
    const line = ring && !flatAft ? lessonLine(ring) : plan ? lessonLine(plan) : aft ? lessonLine(aft) : stepLine(T);
    // (a line that asks for nothing — what the men are doing, or a step that only waits for the level's script — is drawn as something to watch, with no
    //  ring on its place. Never a step's own line that merely names no key: 'Get out of the light' is an ask, and its mark is where to go)
    const watch = (!ring || flatAft) && !plan && (!!aft || (S.i < of && T.done?.is === 'cue')) && !/\[[^\]]+\]/.test(line);
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
  /** is this man on his knee right now, spared (nobody's target meanwhile: `railsDown`, RAILS.spareDown) */
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
    if (this.seatView) return null;   // (plan mode held up in the seat: the view is the mode's own point — planmode.ts planLook)
    const men = this.squad(), g = this.g;
    if (men.length) { const c: Vec3 = [0, 0, 0]; for (const m of men) { c[0] += m.char.pos[0] / men.length; c[2] += m.char.pos[2] / men.length; }
      const m = this.sky.mid; if (!m || this.sky.midT !== g.time) { if (!m) this.sky.mid = c; else { const dt = Math.max(0, g.time - this.sky.midT), a = 1 - Math.exp(-dt * 2.5); m[0] += (c[0] - m[0]) * a; m[2] += (c[2] - m[2]) * a; } this.sky.midT = g.time; } }
    const mid = this.sky.mid ?? g.player.char.pos, o = this.sky.off;
    return [Math.min(WORLD.max[0], Math.max(WORLD.min[0], mid[0] + o[0])), 0, Math.min(WORLD.max[2], Math.max(WORLD.min[2], mid[2] + o[2]))];
  }

  summary(): string {
    const S = this.lesson(); if (!S) return this.g.level.scenarios?.lesson?.rails ? (RAILS.on ? 'off · this level carries the record (start its mission)' : 'off · switched off') : 'off · this level carries none';
    const A = this.allowed()!;
    return `step ${Math.min(S.i + 1, S.L.steps.length)}/${S.L.steps.length} · unlocked: ${[...A].filter(a => a !== 'stalk').join(' ') || '—'}${this.shuts('stalk') ? ' · stalk shut' : ''}${this.skyOn ? ' · sky seat' : ''}${this.spared.size ? ` · spared ${this.spared.size}` : ''}`;
  }
  private note(s: string) { this.log.push(`${this.g.time.toFixed(2)} ${s}`); if (this.log.length > 80) this.log.splice(0, 40); }
}

/** combat.ts killGuard's question, safe on a Game that has no frame yet */
export function railsSpare(g: Game, gd: Guard): boolean { return !!g.rails && g.rails.spare(gd); }
/** is this man down as far as an enemy's eye goes (RAILS.spareDown): a teammate on his knee, spared. Asked by whoever picks a man to fight */
export function railsDown(g: Game, gd: Guard): boolean { return RAILS.spareDown && !BREAK && !!g.rails && g.rails.live && g.rails.isSpared(gd); }   // (live: the map is cleared at a run's start, not at a lesson's end — a man spawned under a spared man's number on a floor with no frame is nobody's)
