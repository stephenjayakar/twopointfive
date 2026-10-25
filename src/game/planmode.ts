// PLAN MODE — a PROTOTYPE beside the orders ring (cmdring.ts `plan`; the design: rebuild/commanding/command-mode.md). OFF in the module and on both
// stands; the page raises it when asked for beside the ring (`?cmd&cmdplan`). The maintainer's words for it: an RTS's way with a squad, "for advanced
// players that requires explicitly leaving".
//
//   · SHIFT + THE RING'S KEY TOGGLES IT (where that key is free: with a menu, a Space list, a verb or the launcher's arc to back out of, it backs out).
//     While it is up the mouse is the squad's, not Sam's — he does not fire or aim — and Shift, its modifier, is not his sprint.
//   · SAM STANDS WHERE HE IS AND THE VIEW IS THE HAND'S (the maintainer, 10-20: "your player character is stuck, wasd moves the camera around … it should
//     feel like you're switching into an RTS mode temporarily"): the walk keys move the view's own point (`look`, which the follow camera is given in
//     place of him — Game.followPos; no further than where he is still on the screen, CMDRING.planNear, or as first built `planPanReachM` from him and the men), he goes on facing what he faced when the mode went up
//     (`aim`), and the view comes back to him when the mode is put down. Every other key is still his.
//     This, and the right button's hold below, is `CMDRING.planRts` (raised by the page with the mode; `?nocmdrts`, and a recording from before the
//     key, have the mode as it was first built: he walks with it up, the view is on him, a right click orders as the button goes down).
//   · THE LEFT BUTTON PICKS MEN: a click on a man (his body, or the circle at his feet) is him alone; with Shift it adds him or takes him out; a drag
//     boxes the men in it (with Shift: adds them); a click on nothing is everyone again. Everyone, a whole pair and one man are the who key's own
//     choices and are kept as that (`SquadOrders.who`); any other set is `pick`, which `recipients()` reads ahead of `who` until the who key is pressed.
//   · THE RIGHT BUTTON ORDERS, BY STARCRAFT'S RULES. A plain right click is the quick key's order on what the cursor is on — what the squad would do
//     there (autopilot.ts, asked whether or not the quick key's own switch is on) — for the picked men, and REPLACES whatever chain they were on. Shift +
//     right click ADDS that stop to the end of the chain each of them is on (men picked out of a bigger chain part from it and keep its stops; a man
//     on no chain starts one). An order goes NOW: the men walk as the chain is laid. The click is read when the button comes UP, because …
//   · … THE RIGHT BUTTON KEPT DOWN (`planHoldSecs`) IS THE RING ("long right click opens the radial menu"): the order menu up as a ring at the cursor for
//     the picked men (orders.ts ringByButton), and the button let go gives the lit wedge — its first wedge is the click's own order, chain and all; any
//     other is an order by hand. With Shift down the button never opens it: a stop added to a chain is the first wedge's (a limit of the prototype).
//   · A CHAIN PAUSES FOR THE WORD'S KEY (doortools.ts blowKey) at a door's threshold — stacked, the entry not yet given — and, when something is chained
//     after it, once that room is taken; a thing a man was sent to work is the same kind of stop. A room in the middle of a chain is so two presses: go
//     in, then move on. A stop on the floor is not a pause: they walk on. The key speaks to the chains of whoever is picked (everyone by default).
//   · AN EARLY PRESS COUNTS FOR THE NEXT PAUSE (`spent`): the key's mark comes off the plan there, and with the mode down the plan is shown for a
//     moment so it is seen to go. Only a press NOBODY ELSE TOOK is kept (planLate, behind the key's other readers): a charge to blow, men waiting
//     on the word and a plan laid for it all come first.
//   · AN ORDER GIVEN ANY OTHER WAY (the menu, the ring, the quick key) takes its men off their chains — except the way in given on the door a chain is
//     stacked on, which IS that chain's word. A right click that is refused changes nothing.
//
// WHAT IS WHOSE. A step is a place written down as planlay.ts writes one (a door by its place on the level's list, a spot, a man) and is GIVEN through
// `SquadOrders.quickFor` when its turn comes: every refusal, reason and entry choice is the order book's and the autopilot's. Nothing here moves a man.
//
// PER SEAT: the state lives with the order book (`SquadOrders.plan`); whoever's input that book reads picks and orders. STATE: PlanState, plain data —
// `planSnapshot` / `planRestore` are its pair (savestate.ts files it with the switch on); a drag in hand is not filed.
import type { Vec3 } from '../math/vec';
import type { Guard } from './game';
import type { Input } from './input';
import type { FollowCamera } from './camera';
import type { View } from '../host/hud';
import type { OrderTarget, SquadOrders } from './orders';
import type { LaidWhere } from './planlay';
import { layTarget } from './planlay';   // (these are called inside functions only: src/game is one import cycle)
import { CMDRING, ringZoom } from './cmdring';
import { WORLD } from '../scene/world';
import { backTake } from './backkey';   // (read inside planInput only)
import { DOORTOOLS } from './doortools';
import { canStand } from './player';   // (called inside down only)

export const PLAN_STATS = { toggled: 0, picked: 0, boxed: 0, given: 0, added: 0, words: 0, early: 0, struck: 0, dropped: 0, done: 0, looks: 0, waits: 0 };

/** `go`: on the way to steps[0] · `wait`: stacked on its door, the word wanted · `in`: the entry given, the room being taken · `held`: the stop is done
 *  and the word is wanted to move on. `spent`: early presses of the word's key not yet used · `t`: the game's clock when the phase began */
export interface PlanChain { who: string[]; steps: PlanStep[]; phase: 'go' | 'wait' | 'in' | 'held' | 'look'; spent: number; t: number }
/** a stop of a chain. `look` (CMDRING.planLook): the way its men face once there, a unit [x, z] — `looked`: they have been told · `wait`, `hold`
 *  (CMDRING.planWaits): the word is wanted at a door's threshold · and once the stop is done, before the next (absent: as the build had it — a
 *  threshold waits, a room taken or a thing worked holds, a spot of floor does neither). `look` phase: the men are checking that way, then walk on */
export type PlanStep = LaidWhere & { look?: [number, number]; looked?: boolean; wait?: boolean; hold?: boolean };
/** `up`: the mode · `pick`: the picked men's callsigns (null: the who key's choice) · `drag`: a box being drawn (CSS px of the view) · `showT`: the
 *  game's clock when the plan last changed under the key (it is shown a moment with the mode down) · `giving`: a chain's own order is being given now */
export interface PlanState { up: boolean; pick: string[] | null; chains: PlanChain[]; drag: { x0: number; y0: number; x1: number; y1: number } | null; showT: number; giving: boolean; /** a load put the chains back at that game time (planFresh leaves them be) */ restoredT: number;
  /** the mode up: the point on the floor the view follows in Sam's place (the walk keys move it) · the point he goes on facing · a right press in hand
   *  (the game's clock when it went down): let go it is a click, kept down it is the ring */
  look: Vec3 | null; aim: Vec3 | null; rmbT: number;
  /** (CMDRING.planLook) that right press: where it went down (CSS px), what the cursor was on, whether it has been dragged, and the point it is over now */
  rdown: { x: number; y: number; t: OrderTarget; drag: boolean; to: Vec3 } | null;
  /** (CMDRING.planKnee) he went down on a knee as the mode went up, and was standing before (null: the mode did not kneel him) · the mode just put
   *  down: where its view was and the game's clock then — the view eases back to him from there over `planBackSecs` */
  stood: boolean | null; back: { from: Vec3; t0: number } | null }
export interface PlanSnap { up: boolean; pick: string[] | null; chains: PlanChain[]; showT: number; look?: Vec3 | null; aim?: Vec3 | null; stood?: boolean | null; back?: { from: Vec3; t0: number } | null }
/** what the page draws (ui/cmdring.ts): the men's circles, the box, Sam's own mark (at the view's edge, pointing at him, once the view has left him), and
 *  each chain from its men through its stops with the key's marks still to press */
export interface PlanView {
  up: boolean; drag: PlanState['drag'];
  /** the frame round the view and every man's ring are drawn: the mode is up — or a tutorial's sky seat borrows its picture with the mode down (rails.ts planDrawn) */
  frame: boolean;
  /** the mode up and the view the hand's: where Sam stands (the view may have left him) */
  sam: Vec3 | null;
  men: { at: Vec3; tone: string | undefined; picked: boolean; /** the digit that picks him, drawn by his circle (0: none — CMDRING.planDigits off, or the mode down) */ n: number }[];
  chains: { tone: string | undefined; from: Vec3; stops: { at: Vec3; door: boolean; keys: number; now: boolean; /** the far end of its way to look (null: none) */ look: Vec3 | null }[] }[];
  key: string;
  /** a right press being dragged: from the place it went down on to the point under the cursor */
  aim: { from: Vec3; to: Vec3 } | null;
}

export function planNew(): PlanState { return { up: false, pick: null, chains: [], drag: null, showT: -1e9, giving: false, restoredT: -1, look: null, aim: null, rmbT: -1, rdown: null, stood: null, back: null }; }
const WALK = ['KeyW', 'KeyS', 'KeyD', 'KeyA'];
/** how long a stop's way to look is drawn on the floor (m) */
const LOOK_DRAWN_M = 1.6;
const v3c = (p: Vec3): Vec3 => [p[0], p[1], p[2]];
const copyChains = (a: PlanChain[]): PlanChain[] => a.map(c => ({ ...c, who: [...c.who], steps: c.steps.map(s => ({ ...s, at: [s.at[0], s.at[1], s.at[2]] as Vec3, ...(s.pick ? { pick: [s.pick[0], s.pick[1], s.pick[2]] as Vec3 } : {}), ...(s.look ? { look: [s.look[0], s.look[1]] as [number, number] } : {}) })) }));
const menOf = (S: SquadOrders, names: string[]): Guard[] => S.squad().filter(m => m.state !== 'dead' && names.includes(m.callsign));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(n => b.includes(n));

/** the men an order would go to while a set is picked (orders.ts recipients) */
export function planMen(S: SquadOrders): Guard[] | null { const p = S.plan.pick; return p ? menOf(S, p) : null; }

/** these men are the choice now: everyone, a whole pair and one man go to the who key's own state; any other set is `pick` */
function choose(S: SquadOrders, men: Guard[]): void {
  const P = S.plan, live = S.men('all'), L = live.filter(m => men.includes(m)); P.pick = null;
  if (!L.length || L.length === live.length) { S.who = 'all'; return; }
  if (L.length === 1) { S.address(L[0]); return; }
  const id = S.pairOf(L[0]);
  if (id && L.length === S.men(id).length && L.every(m => S.pairOf(m) === id)) { S.who = id; return; }
  P.pick = L.map(m => m.callsign);
}
/** THE DIGITS PICK THE MEN (CMDRING.planDigits): 1 to 4 is that man of the squad alone — the squad's own order, so a man keeps his digit when another is
 *  down — Shift + the digit puts him in the picked set or takes him out, as a Shift click does; 5 is everyone. A digit with no living man does nothing */
function pickDigit(S: SquadOrders, d: number, shift: boolean): void {
  if (d === PLAN_ALL) { PLAN_STATS.picked++; choose(S, []); return; }
  const man = S.squad()[d - 1], now = S.recipients(); if (!man || !S.men('all').includes(man)) return;
  PLAN_STATS.picked++; choose(S, !shift ? [man] : now.includes(man) ? now.filter(m => m !== man) : [...now, man]);
}
/** the digit that picks everyone (the men's own are below it) */
const PLAN_ALL = 5;
/** the digits are the mode's this tick (planInput, with the mode up and no menu or ring over it): never with the ring's key down */
const digitsFree = (input: Input): boolean => CMDRING.planDigits && !input.down(CMDRING.key);
/** WOULD planInput TAKE A DIGIT PRESSED THIS TICK AS A PICK? Asked by a tutorial's gate BEFORE the tick is read (rails.ts gate, RAILS.planDigits), which
 *  lets a digit through on this answer alone: a digit let through and not taken here would be a slot's key. So it is planInput's own road to the line
 *  that deletes the press, and no wider — the mode up and not on its way down this tick (no press of the ring's key, no back key outside a seat that holds
 *  the mode up), no menu and no ring over it, and `digitsFree` */
export function planTakesDigits(S: SquadOrders, input: Input): boolean {
  const P = S.plan, K = CMDRING;
  return K.plan && K.on && P.up && !S.menu && !S.cmdRing && digitsFree(input) && !input.pressed.has(K.key) && (seat(S) || !(input.pressed.has('Escape') || input.pressed.has('Tab')));
}
/** a left click on bare ground picks everyone, as the mode was built — not once the digits pick the men, on a tutorial mission either (its lines teach
 *  the digits now: [5] is everyone) */
export const planGroundAll = (_S: SquadOrders): boolean => !CMDRING.planDigits;
/** PICKS WAIT FOR THEIR LESSON on a tutorial mission (rails.ts locksPicks, RAILS.planDigits): until a step that teaches picking is up no digit, no click
 *  on a man and no box picks anybody — the press is still taken, so it is nobody else's — and no man's digit is drawn */
const picksLocked = (S: SquadOrders): boolean => !!S.g.rails?.locksPicks();
/** the digit drawn by a man's circle (0: none — the digits are not the mode's, or he has none) */
function digitOf(S: SquadOrders, m: Guard): number { if (!CMDRING.planDigits || picksLocked(S)) return 0; const k = S.squad().indexOf(m) + 1; return k >= 1 && k < PLAN_ALL ? k : 0; }

/** a place for a chain, off the target the cursor was on (null: a man of the other side — an order on him is given at once and never chained) */
function stepOf(S: SquadOrders, t: OrderTarget): PlanStep | null {
  if (t.kind === 'foe') return null;
  const o: PlanStep = { kind: t.kind, at: [t.at[0], 0, t.at[2]] };
  if (t.kind === 'door') o.door = S.g.doors.list.indexOf(t.door);
  if (t.kind === 'none' && t.man) o.man = t.man.callsign;
  if (t.kind === 'floor' && t.thing) { o.found = 'thing'; o.pick = [t.thing.face[0], t.thing.face[1], t.thing.face[2]]; }
  return o;
}
/** does the chain stop for the word once that step is done: a room taken or a thing worked, with something chained after it */
const stopsAfter = (s: LaidWhere) => s.kind === 'door' || s.found === 'thing';
/** THE WORD'S WAITS ARE THE PLAN'S OWN (CMDRING.planWaits; the maintainer, 10-22: "let's also make it possible to add and remove F waits in the plan.
 *  and then I think we can change the flow to be that pressing F only releases the people blocked on it"): each stop says whether the word is wanted
 *  at its threshold (`wait`, a door's) and once it is done (`hold`); a left click on a stop steps through what it can say (cycle). Unset, and with the
 *  switch off, a stop waits as the build had it. */
const waitsAt = (s: PlanStep) => s.kind === 'door' && (CMDRING.planWaits ? s.wait ?? true : true);
const holds = (s: PlanStep) => CMDRING.planWaits ? s.hold ?? stopsAfter(s) : stopsAfter(s);
/** … does the chain stop for the word once that step is done (`last`: nothing is chained after it — only a hold put there by hand stops it then) */
const holdOn = (s: PlanStep, last: boolean) => holds(s) && (!last || (CMDRING.planWaits && s.hold === true));
/** the word's marks still on a step (`i`: its place in the chain): the threshold's, and the one after it */
function keysOn(C: PlanChain, i: number): number {
  const s = C.steps[i], last = i === C.steps.length - 1;
  const thr = waitsAt(s) && (i > 0 || C.phase === 'go' || C.phase === 'wait') ? 1 : 0;
  return thr + (holdOn(s, last) ? 1 : 0);
}
const keysLeft = (C: PlanChain) => C.steps.reduce((n, _s, i) => n + keysOn(C, i), 0);

function drop(S: SquadOrders, C: PlanChain, done = false): void { const P = S.plan, i = P.chains.indexOf(C); if (i >= 0) { P.chains.splice(i, 1); if (done) PLAN_STATS.done++; else PLAN_STATS.dropped++; } }
/** those men off every chain (one with nobody left on it is gone) */
function strike(S: SquadOrders, names: string[]): void {
  const P = S.plan;
  for (const C of [...P.chains]) { const was = C.who.length; C.who = C.who.filter(n => !names.includes(n)); if (C.who.length !== was) PLAN_STATS.struck++; if (!C.who.length) drop(S, C); }
}

/** a tutorial mission that has not taught the word yet (rails.ts `word`): no entry is given by any hand of the mode — a second click on a stacked door, a wait
 *  taken off a stop, the ring by the button — until it has */
const wordLocked = (S: SquadOrders): boolean => !!S.g.rails?.locks('word');
/** those men are stacked on that stop's door already and the word is locked: an order there again would be the entry */
const stackedLocked = (S: SquadOrders, men: Guard[], st: PlanStep): boolean => { const d = st.kind === 'door' ? S.g.doors.list[st.door ?? -1] : null; return !!d && wordLocked(S) && !!S.g.doorTools.waitsOn(men, d); };
/** the chain's first step, given now: the quick key's order there for its men (refused, or its door or man gone: the chain ends — a man has said why) */
function start(S: SquadOrders, C: PlanChain): void {
  const g = S.g, st = C.steps[0], men = menOf(S, C.who), t = st ? layTarget(g, st) : null;
  if (!t || !men.length) return drop(S, C);
  if (stackedLocked(S, men, st)) { C.t = g.time; C.phase = 'wait'; return; }   // (stacked on it already, and the word not taught: an order there again is no entry)
  const r = S.quickFor(men, t); if (!r) return drop(S, C);
  C.t = g.time; C.phase = st.kind === 'door' && r === 'entry' ? 'in' : 'go';   // (already stacked on it: the order was the entry, and the threshold's pause is behind them)
}
/** a door order of the door tools' that has the chain's men on its door: the entry, under way */
const entering = (S: SquadOrders, men: Guard[], st: LaidWhere) => { const d = st.kind === 'door' ? S.g.doors.list[st.door ?? -1] : null; return !!d && S.g.doorTools.ops.some(op => op.door === d && op.men.some(m => men.includes(m))); };
/** the word at a threshold: the entry the squad picks, given (not stacked after all: they stack again, and the word is wanted again) */
function enter(S: SquadOrders, C: PlanChain): void {
  const g = S.g, st = C.steps[0], men = menOf(S, C.who), t = st ? layTarget(g, st) : null;
  if (!t || !men.length) return drop(S, C);
  if (entering(S, men, st)) { C.t = g.time; C.phase = 'in'; return; }   // (the entry is theirs already — given with the men of another chain on the same door)
  const r = S.quickFor(men, t); if (!r) { if (CMDRING.planWaits && st.wait === false) st.wait = true; if (C.phase !== 'wait') { C.phase = 'wait'; C.t = g.time; } return; }   // (refused: a man said why — they wait where they are, and the word asks again · a wait taken off this door is back on it, so its mark says so)
  C.t = g.time; C.phase = r === 'entry' ? 'in' : 'go';
}
function next(S: SquadOrders, C: PlanChain): void { C.steps.shift(); if (!C.steps.length) return drop(S, C, true); start(S, C); }
/** a pause is reached: an early press takes it at once */
function pause(S: SquadOrders, C: PlanChain, phase: 'wait' | 'held'): void {
  C.phase = phase; C.t = S.g.time;
  if (C.spent > 0) { C.spent--; if (phase === 'wait') enter(S, C); else next(S, C); }
}

/** every chain moved on as far as its men have got (once a tick, ahead of the keys) */
function tick(S: SquadOrders): void {
  const P = S.plan, g = S.g;
  if (P.pick?.length && !menOf(S, P.pick).length) P.pick = null;   // (an EMPTY pick is nobody on purpose, CMDRING.planClear: it stands)
  if (P.back && !(g.time - P.back.t0 >= 0 && g.time - P.back.t0 < CMDRING.planBackSecs)) P.back = null;   // (the view is back on him)
  if (P.up && !S.men('all').length) down(S, null);   // (nobody left to order: the mouse is Sam's)
  if (planKnee(S) && !g.player.crouch) { if (P.stood === null) P.stood = true; g.player.crouch = true; }   // (the mode up and he is not down on the knee — a restart stood a new man up, an older file: down he goes)
  for (const C of [...P.chains]) {
    const men = menOf(S, C.who), st = C.steps[0]; C.who = men.map(m => m.callsign);
    if (!men.length || !st) { drop(S, C); continue; }
    const door = st.kind === 'door' ? g.doors.list[st.door ?? -1] : null, more = C.steps.length > 1;
    if (C.phase === 'go') {
      if (door) { if (g.doorTools.waitsOn(men, door)?.set) { if (waitsAt(st) || wordLocked(S)) pause(S, C, 'wait'); else enter(S, C); } }   // (no wait put on its threshold: stacked, they go in)
      else if (g.time - C.t > 0.3 && men.every(m => { const A = S.of(m); return !A || A.arrived; }) && !(st.found === 'thing' && men.some(m => g.work.working(m)))) {   // (a thing: he is done with it — worked, or not there to work — not merely stood at it)
        const way = st.look && !st.looked ? st.look : null; let took = false; if (way) { st.looked = true; took = lookNow(S, men, way, true); }   // (a way to look, planLook: told once they stand there)
        if (holdOn(st, !more)) pause(S, C, 'held'); else if (took && more) { C.phase = 'look'; C.t = g.time; } else next(S, C); }   // (nobody could cover that way — a wall at his shoulder: nothing to wait for)
    } else if (C.phase === 'look') { if (g.time - C.t >= CMDRING.planLookSecs) { if (holdOn(st, !more)) pause(S, C, 'held'); else next(S, C); }   // (they have checked that way: on to the next stop — or a hold put on this one meanwhile)
    } else if (C.phase === 'wait') { if (entering(S, men, st)) { C.phase = 'in'; C.t = g.time; } }   // (the entry given by somebody else's hand: a tool's, a scenario's)
    else if (C.phase === 'in' && g.time - C.t > 0.5 && !g.doorTools.ops.some(op => op.men.some(m => men.includes(m)))) {
      if (door && g.doorTools.waitsOn(men, door)) { if (CMDRING.planWaits && st.wait === false) st.wait = true; C.phase = 'wait'; C.t = g.time; }   // (the entry was given up — a lock — and they are back on their marks: the threshold again, and its word)
      else if (holdOn(st, !more)) pause(S, C, 'held'); else if (more) next(S, C); else drop(S, C, true);   // (nothing after it: they hold the room, as they always did)
    }
  }
}

const chainsOf = (S: SquadOrders): PlanChain[] => { const names = S.recipients().map(m => m.callsign); return S.plan.chains.filter(c => c.who.some(n => names.includes(n))); };
/** the word's key, ahead of its every other reader: the chains of the picked men that WAIT on it move on, and the press is theirs alone */
function word(S: SquadOrders, input: Input): void {
  const P = S.plan, key = DOORTOOLS.blowKey; if (!key || !P.chains.length || !input.pressed.has(key)) return;
  const mine = chainsOf(S), waiting = mine.filter(c => c.phase === 'wait' || c.phase === 'held');
  if (waiting.length) {
    input.pressed.delete(key); P.showT = S.g.time; PLAN_STATS.words++;
    const DT = S.g.doorTools, had = CMDRING.planOne ? new Set(DT.ops) : null;
    for (const C of waiting) { if (C.phase === 'wait') enter(S, C); else next(S, C); }
    if (had) {   // (planOne: the entries this one press started go on one word, the door tools' own — nobody makes a sound until every stack is formed, and they step in together)
      const fresh = DT.ops.filter(o => !had.has(o) && !o.word && !o.onWord && !o.gate && o.phase === 'stack' && (o.kind === 'openClear' || o.kind === 'bangClear'));
      if (fresh.length > 1) DT.oneWord(fresh);
    }
    return;
  }
  // (men still walking to a door they are chained to, and nothing else the key could mean — no charge set, nobody stood waiting on it, no plan laid
  //  for it: the press is kept for that threshold, ahead of the door tools' own early word, so the mark comes off the plan)
  const g = S.g, men = S.recipients(), walking = mine.filter(c => c.phase === 'go' && c.steps[0].kind === 'door' && c.spent === 0);
  if (!walking.length || S.menu || S.lay.laid.length || g.doorTools.set.length || g.wallCharge.set.length || g.doors.list.some(d => g.doorTools.waitsOn(men, d)?.set)) return;
  input.pressed.delete(key); P.showT = g.time;
  if (CMDRING.planWaits) return;   // (the word frees only the men stood waiting on it: the press is theirs — the stack's own early word does not get it — and it is not kept for a wait to come)
  PLAN_STATS.early++;
  for (const C of walking) C.spent++;
}
/** … and BEHIND its other readers (game.ts, after the door tools' and the wall charges' own): a press nobody took — no charge to blow, no word waited
 *  on, no plan laid for it — with a pause still ahead on a chain of the picked men is kept for the next pause of each */
export function planLate(S: SquadOrders, input: Input): void {
  const P = S.plan, key = DOORTOOLS.blowKey; if (!CMDRING.plan || CMDRING.planWaits || !key || !P.chains.length || !input.pressed.has(key) || S.menu) return;
  const early = chainsOf(S).filter(c => keysLeft(c) > c.spent); if (!early.length) return;
  input.pressed.delete(key); P.showT = S.g.time; PLAN_STATS.early++;
  for (const C of early) C.spent++;
}

/** a right click on `t` (and the ring's first wedge, opened by that button): the quick key's order there for the picked men — replacing their chain, or
 *  (`add`) put on its end */
export function planOrder(S: SquadOrders, t: OrderTarget, add: boolean, look?: [number, number]): void {
  const P = S.plan, g = S.g, men = S.recipients(t); if (!men.length) { g.msg('nobody to take that order'); return; }
  let names = men.map(m => m.callsign); const st = stepOf(S, t); if (st && look) st.look = [look[0], look[1]];
  if (!st) { if (S.quickFor(men, t)) strike(S, names); return; }
  if (add) {
    // (each chain these men are on gets the stop on its end; a chain that has other men too is parted first, so the others go on as they were)
    const rest = [...names];
    for (const C of [...P.chains]) {
      const inC = C.who.filter(n => rest.includes(n)); if (!inC.length) continue;
      let T = C; if (inC.length < C.who.length) { T = { ...copyChains([C])[0], who: inC }; C.who = C.who.filter(n => !inC.includes(n)); P.chains.push(T); }
      T.steps.push({ ...st, at: [st.at[0], st.at[1], st.at[2]], ...(st.look ? { look: [st.look[0], st.look[1]] as [number, number] } : {}) }); for (const n of inC) rest.splice(rest.indexOf(n), 1);
    }
    if (rest.length < names.length) { PLAN_STATS.added++; P.showT = g.time; }
    if (!rest.length) return;
    names = rest;   // (men on no chain: the stop is theirs now — a chain of one)
  }
  // (given first: a refused order — a man has said why — leaves them on the chain they were on)
  const to = menOf(S, names); if (stackedLocked(S, to, st)) { P.showT = g.time; return; }   // (the same door again before the word is taught: they wait as they were)
  const r = S.quickFor(to, t); if (!r) return;
  strike(S, names); P.showT = g.time; PLAN_STATS.given++;
  P.chains.push({ who: names, steps: [st], phase: st.kind === 'door' && r === 'entry' ? 'in' : 'go', spent: 0, t: g.time });
}

/** those men stand where they are and cover the way `way` points from them (the order book's own 'cover', toward a point `planLookM` out) —
 *  `chain`: it is a chain's own order and takes nobody off one */
function lookNow(S: SquadOrders, men: Guard[], way: [number, number], chain: boolean): boolean {
  if (!men.length) return false; let x = 0, z = 0; for (const m of men) { x += m.char.pos[0] / men.length; z += m.char.pos[2] / men.length; }
  const ok = S.coverFor(men, [x + way[0] * CMDRING.planLookM, 0, z + way[1] * CMDRING.planLookM], chain); if (ok) PLAN_STATS.looks++; return ok;
}
/** A RIGHT PRESS DRAGGED IS AN ORDER WITH A WAY TO LOOK (CMDRING.planLook; the maintainer, 10-22: "you should be able to right click drag on a path
 *  and have them check that direction, like door kickers" · "it could be good for spreading your squad around to cover many angles. so if they're
 *  given an angle while not moving, they should probably just cover that" · "but overall we expect squad mates to be very smart on their own and not
 *  need micromanaging like this": it is there to be used, never needed). `t`: what the press went down on · `to`: the point it was let go over.
 *  Down on the floor: the click's own order there, and its stop keeps the way — the men face it once they stand there, and a chain with more stops
 *  walks on after `planLookSecs` (or at the word, with a wait put on the stop). Down on a man, on Sam or on nothing: nobody walks — the man (the
 *  picked men) cover that way from where they stand. On a door, a thing or a man of the other side, or let go too near: the plain click's order. */
function lookOrder(S: SquadOrders, t: OrderTarget, to: Vec3, add: boolean): void {
  const P = S.plan, dx = to[0] - t.at[0], dz = to[2] - t.at[2], l = Math.hypot(dx, dz);
  if (l < 0.5 || t.kind === 'door' || t.kind === 'foe' || (t.kind === 'floor' && t.thing)) return planOrder(S, t, add);
  if (t.kind === 'floor') return planOrder(S, t, add, [dx / l, dz / l]);
  const men = t.man ? [t.man] : S.recipients(t); if (!men.length) { S.g.msg('nobody to take that order'); return; }
  let mx = 0, mz = 0; for (const m of men) { mx += m.char.pos[0] / men.length; mz += m.char.pos[2] / men.length; }   // (the way is from where THEY stand to where the hand let go — the press met a man's chest, not his feet)
  const wl = Math.hypot(to[0] - mx, to[2] - mz); if (wl < 0.5) return; const way: [number, number] = [(to[0] - mx) / wl, (to[2] - mz) / wl];
  if (add) {   // (Shift, and they are on a plan: the way is the last stop's — they look there when they get there — and nobody is taken off it)
    const names = men.map(m => m.callsign), on = P.chains.filter(c => c.who.some(n => names.includes(n))); let set = false;
    for (const c of on) { const e = c.steps[c.steps.length - 1];
      if (c.steps.length === 1 && c.phase !== 'go') { if (lookNow(S, men.filter(m => c.who.includes(m.callsign)), way, true)) set = true; }   // (stood on their last stop already: they cover it now, still on the plan)
      else if (e.kind === 'floor' && e.found !== 'thing') { e.look = [way[0], way[1]]; e.looked = false; set = true; } }
    if (on.length) { if (set) { P.showT = S.g.time; PLAN_STATS.added++; } return; }
  }
  if (lookNow(S, men, way, false)) P.showT = S.g.time;
}
/** where a stop is drawn and clicked: its door, its man, Sam, or its spot */
function stopAt(S: SquadOrders, s: PlanStep): Vec3 {
  const g = S.g, d = s.kind === 'door' ? g.doors.list[s.door ?? -1] : null, m = s.kind === 'none' && s.man ? S.squad().find(x => x.callsign === s.man) : null;
  return d ? [d.frameCentre[0], 0, d.frameCentre[2]] : m ? [m.char.pos[0], 0, m.char.pos[2]] : s.kind === 'none' ? [g.player.char.pos[0], 0, g.player.char.pos[2]] : [s.at[0], 0, s.at[2]];
}
/** the stop of a chain the cursor is on (within `planStopPx`, × ringZoom, of where it is drawn; null: none) */
function stopUnder(S: SquadOrders, input: Input, cam: FollowCamera, canvas: View): { C: PlanChain; i: number } | null {
  const w = canvas.clientWidth, h = canvas.clientHeight; let best: { C: PlanChain; i: number } | null = null, bd = CMDRING.planStopPx * ringZoom(w, h);
  if (!(input.mouseX >= 0 && input.mouseY >= 0 && input.mouseX <= w && input.mouseY <= h)) return null;   // (a stop off the picture is nobody's to click)
  for (const C of S.plan.chains) C.steps.forEach((s, i) => { const [sx, sy, front] = cam.project(stopAt(S, s), w, h); if (!front) return;
    const d = Math.hypot(sx - input.mouseX, sy - input.mouseY); if (d < bd) { bd = d; best = { C, i }; } });
  return best;
}
/** a left click on a stop: its waits step on — a door with something after it: both, the threshold's alone, the one after alone, neither; a door
 *  with nothing after it: its threshold's, on and off; any other stop: a hold there, on and off. A wait taken off under men stood on it lets them go. */
function cycle(S: SquadOrders, C: PlanChain, i: number): void {
  const s = C.steps[i], last = i === C.steps.length - 1;
  if (s.kind !== 'door') s.hold = !holdOn(s, last);
  else if (last) s.wait = !waitsAt(s);
  else { const n = ((waitsAt(s) ? 0 : 2) + (holds(s) ? 0 : 1) + 1) % 4; s.wait = n < 2; s.hold = n % 2 === 0; }
  PLAN_STATS.waits++; S.plan.showT = S.g.time;
  if (i !== 0) return;
  if (C.phase === 'wait' && !waitsAt(s)) enter(S, C); else if (C.phase === 'held' && !holdOn(s, last)) next(S, C);
}

/** A TUTORIAL'S SKY SEAT HOLDS THE MODE UP (rails.ts planSeat, RAILS.skyUp): nobody of the player's is on the floor — he is parked out of the picture — so
 *  the mode has no man to kneel, to mark or to start its view on, and no key of its own takes it down */
const seat = (S: SquadOrders): boolean => !!S.g.rails?.planSeat;
/** where the view starts: on Sam — or, in that seat, on the middle of the men still up (the parked player is nowhere the picture should go) */
function home(S: SquadOrders): Vec3 {
  const p = S.g.player.char.pos, men = seat(S) ? S.men('all') : [];
  if (!men.length) return [p[0], 0, p[2]];
  const c: Vec3 = [0, 0, 0]; for (const m of men) { c[0] += m.char.pos[0] / men.length; c[2] += m.char.pos[2] / men.length; } return c;
}
/** the mode put down: the mouse is Sam's again once he lets go of it, and the choice is the who key's */
function down(S: SquadOrders, input: Input | null): void {
  const P = S.plan, g = S.g; if (!P.up) return;
  if (CMDRING.planKnee && P.look) P.back = { from: v3c(P.look), t0: g.time };   // (the view eases back to him: planLook)
  if (P.stood !== null) { if (P.stood && !g.player.dragging && canStand(g)) g.player.crouch = false; P.stood = null; }   // (… and he gets up off the knee, if he was standing before and there is room)
  P.up = false; P.drag = null; P.pick = null; if (CMDRING.wholeSquad && S.sams) S.who = 'all'; P.showT = g.time;   // (wholeSquad: the mode's pick does not outlive it)
  P.look = null; P.aim = null; P.rmbT = -1; P.rdown = null;
  if (input) { input.clicked &= ~5; input.buttons &= ~5; if (input === g.seat.input) g.seat.swallow(5); }
}
/** a memory save put back with the mode up in it (savestate.ts loadMem): the mode is not the saved moment's to bring back — it is put down as the
 *  key would, and the view is on him at once (nothing to ease back from: the picture has just changed whole). The men's chains go on as saved. */
export function planLoaded(S: SquadOrders): void { down(S, null); S.plan.back = null; }
/** … and put up: the view's point starts on Sam, and what he is facing is what he goes on facing */
function up(S: SquadOrders): void {
  const P = S.plan, g = S.g;
  P.up = true; P.drag = null; P.rmbT = -1; P.rdown = null; P.look = P.aim = null; P.back = null; P.stood = null;
  if (CMDRING.planRts) { P.look = home(S); P.aim = v3c(g.aimPoint); }
  // HE TAKES A KNEE AT THE RADIO (CMDRING.planKnee; the maintainer, 10-22: "plan mode should also show the player taking a knee and talking on the
  // radio, and then camera can decouple from them and move (up to some limit) with wasd and then gently snap back when exiting the mode"): the
  // crouch is his real one — lower to a round and to an eye, as a man on a knee is — and player.ts lowers the gun and puts his hand to the handset
  if (planKnee(S)) { P.stood = !g.player.crouch; g.player.crouch = true; }
}
/** the page's Esc (Game.escape, behind everything nearer): the mode comes down (false: it was not up, or the back key is not its way out) */
export function planEscape(S: SquadOrders): boolean { if (!S.planBack()) return false; PLAN_STATS.toggled++; down(S, S.g.seat.input); return true; }
/** Sam put somewhere else with the mode up (a restart, a fresh cast): the view starts on him again, and he faces what he faces there */
export function planHome(S: SquadOrders): void { const P = S.plan, g = S.g; if (P.up && P.look) { P.look = home(S); P.aim = v3c(g.aimPoint); P.rmbT = -1; } }
/** the walk keys move the view's point, the way they would have walked him (the camera's own basis), `planPanMps` — kept inside the box where he is still on the screen
 *  (planNear) or, as first built, within `planPanReachM` of the box he and the men stand in, so the view is never lost */
function pan(S: SquadOrders, input: Input, cam: FollowCamera, dt: number): void {
  const P = S.plan, K = CMDRING, L = P.look; if (!L) return;
  const { fwd, right } = cam.planarBasis(); let mx = 0, mz = 0;
  if (input.down(WALK[0])) { mx += fwd[0]; mz += fwd[2]; } if (input.down(WALK[1])) { mx -= fwd[0]; mz -= fwd[2]; }
  if (input.down(WALK[2])) { mx += right[0]; mz += right[2]; } if (input.down(WALK[3])) { mx -= right[0]; mz -= right[2]; }
  const l = Math.hypot(mx, mz); if (l > 1e-6) { L[0] += mx / l * K.planPanMps * dt; L[2] += mz / l * K.planPanMps * dt; }
  const p = S.g.player.char.pos;
  // (planNear: inside the box where HE is still on the screen — a room's worth, not the level's. The box is the camera's: `right` and `fwd` are the
  // screen's across and up, and it shrinks as the camera comes in, or with planNearFlat it does not. A point outside it by more than a stride of the pan is walked in, not jumped)
  if (planNear(S)) {
    const k = K.planNearFlat ? 1 : Math.min(1, cam.distance / 21), dx = L[0] - p[0], dz = L[2] - p[2], r = dx * right[0] + dz * right[2], f = dx * fwd[0] + dz * fwd[2];
    const r1 = Math.max(-K.planNearSideM * k, Math.min(K.planNearSideM * k, r)), f1 = Math.max(-Math.max(0, (K.planNearBackM + BODY_M) * k - BODY_M), Math.min(K.planNearAwayM * k, f));
    const cx = p[0] + right[0] * r1 + fwd[0] * f1, cz = p[2] + right[2] * r1 + fwd[2] * f1, out = Math.hypot(L[0] - cx, L[2] - cz), step = 2 * K.planPanMps * dt;
    if (out <= step || !(dt > 0)) { L[0] = cx; L[2] = cz; } else { L[0] += (cx - L[0]) / out * step; L[2] += (cz - L[2]) / out * step; }
    return;
  }
  const q0 = home(S);   // (the box starts on him — or, in a tutorial's seat with nobody of his on the floor, on the men alone)
  let x0 = q0[0], x1 = x0, z0 = q0[2], z1 = z0;
  for (const m of S.men('all')) { const q = m.char.pos; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
  L[0] = Math.max(x0 - K.planPanReachM, Math.min(x1 + K.planPanReachM, L[0])); L[2] = Math.max(z0 - K.planPanReachM, Math.min(z1 + K.planPanReachM, L[2]));
  // (…and in the seat never past the level's own edge, as the sky seat's view is kept: rails.ts look)
  if (seat(S)) { L[0] = Math.min(WORLD.max[0], Math.max(WORLD.min[0], L[0])); L[2] = Math.min(WORLD.max[2], Math.max(WORLD.min[2], L[2])); }
}
/** the floor his body covers up the screen at the camera's tilt, m: it does not shrink as the camera comes in, so the top edge's room is kept in metres */
const BODY_M = 1.4;
/** the view is held near him (CMDRING.planNear) — not where a tutorial frame has taken his feet: he could not walk nearer */
export function planNear(S: SquadOrders): boolean { return CMDRING.planNear && !seat(S) && !S.g.rails?.locks('move'); }
/** what the follow camera follows in Sam's place (Game.followPos; null: him) */
export function planLook(S: SquadOrders): Vec3 | null {
  const P = S.plan; if (P.up) return P.look;
  const B = P.back; if (!B) return null;   // (… the mode just put down, planKnee: a point on its way back to him, eased at both ends)
  const k = (S.g.time - B.t0) / Math.max(1e-3, CMDRING.planBackSecs); if (!(k >= 0 && k < 1)) return null;   // (tick() lets go of it)
  const e = k * k * (3 - 2 * k), p = S.g.player.char.pos; return [B.from[0] + (p[0] - B.from[0]) * e, 0, B.from[2] + (p[2] - B.from[2]) * e];
}
/** is he on a knee at the radio right now (player.ts: the gun low, the left hand at the handset) */
export function planKnee(S: SquadOrders): boolean { const pl = S.g.player; return CMDRING.planKnee && S.plan.up && !!S.plan.look && !seat(S) && !pl.down && !pl.dragging && !pl.holding && !pl.takedown && !pl.kick; }   // (never with a man in his arm, a body in tow, a boot or a takedown under way: those are their own carriage)
/** the mode taken down by the squad going (orders.ts: nobody to order, or he is down) and not by his hand: he is off the knee, nothing eased */
export function planTorn(S: SquadOrders): void { const P = S.plan, g = S.g, pl = g.player; P.rdown = null; if (P.stood === null) return; if (P.stood && !pl.down && !pl.dragging && canStand(g)) pl.crouch = false; P.stood = null; }

/** orders.ts input, once a tick with a squad on the floor and Sam up — after the who key, ahead of the ring, the menu, the plan laid for the word and
 *  the door tools: the chains move on, then the mode's own keys and buttons are read */
/** Shift + the ring's key is the mode's this frame (false: it is the key's own order, orders.ts ringFree): the mode on and Shift down — and, with
 *  CMDRING.planRun, not out of a run: a walk key down with the mode down is his sprint, and the key orders there as it does at a walk */
export function planShift(S: SquadOrders, input: Input): boolean {
  if (!CMDRING.plan || !(input.down('ShiftLeft') || input.down('ShiftRight'))) return false;
  return S.plan.up || !CMDRING.planRun || !WALK.some(k => input.down(k));
}
export function planInput(S: SquadOrders, input: Input, cam: FollowCamera, canvas: View, dt = 0): void {
  const P = S.plan, K = CMDRING;
  if (!K.plan || !K.on) { if (P.up || P.chains.length || P.pick) { down(S, input); P.chains = []; P.pick = null; } return; }
  tick(S);
  const shift = input.down('ShiftLeft') || input.down('ShiftRight'), kept = seat(S);
  // (a tutorial's seat holds the mode up — rails.ts RAILS.skyUp: it is up while there is a man to order, and the pair is nobody's key there)
  if (kept) { if (!P.up && S.men('all').length) up(S); if (planShift(S, input) && !S.cmdRing && S.backFree()) input.pressed.delete(K.key); }
  // (the toggle is the ring's key where the ring's key is free: with something for it to back out of — a menu, a Space list, a verb, the launcher's arc — it backs out, Shift or no)
  else if (planShift(S, input) && !S.cmdRing && S.backFree() && input.pressed.delete(K.key)) { PLAN_STATS.toggled++; if (P.up) down(S, input); else up(S); }
  if (!kept && P.up && K.planRun && !S.cmdRing && S.backFree() && backTake(input)) { PLAN_STATS.toggled++; down(S, input); }   // (the back key takes the mode down, once nothing nearer is up to back out of: backkey.ts)
  word(S, input);
  if (!P.up) return;
  if (input.pressed.has('Blur')) { P.drag = null; P.rmbT = -1; P.rdown = null; }
  if (S.menu || S.cmdRing) { P.drag = null; P.rmbT = -1; P.rdown = null; return; }   // (a menu or the ring is up: the buttons are its own this frame — planAfter takes what is left of them from Sam)
  if (K.planRts) pan(S, input, cam, dt);
  // (the digits pick the men — never with the ring's key down: a digit inside that press is the ring's own wedge, CMDRING.stayDigit)
  const locked = picksLocked(S);   // (a tutorial mission before its pick lesson: the digit is taken and picks nobody, and so does the left button on a man or round men)
  if (digitsFree(input)) for (let d = 1; d <= PLAN_ALL; d++) if (input.pressed.delete(`Digit${d}`) && !locked) pickDigit(S, d, shift);
  const held = (input.buttons & 1) !== 0, lmb = (input.clicked & 1) !== 0, rmb = (input.clicked & 4) !== 0, mx = input.mouseX, my = input.mouseY;
  const w = canvas.clientWidth, h = canvas.clientHeight, now = S.recipients();
  if (lmb) P.drag = { x0: mx, y0: my, x1: mx, y1: my };   // (a press is a box begun, wherever it lands: let go where it went down, it was a click)
  else if (P.drag) {
    const D = P.drag;
    if (held) { D.x1 = mx; D.y1 = my; }
    else {
      P.drag = null;
      if (Math.hypot(D.x1 - D.x0, D.y1 - D.y0) < K.planDragPx * ringZoom(w, h)) {
        const stop = K.planWaits ? stopUnder(S, input, cam, canvas) : null;
        const k = stop ? -1 : S.manAt(input, cam, canvas), man = k >= 0 ? S.squad()[k] : null;
        if (stop) { if (!wordLocked(S)) cycle(S, stop.C, stop.i); }   // (a stop of a chain: its waits, not a choice of men)
        else if (man) { if (!locked) { PLAN_STATS.picked++; choose(S, !shift ? [man] : now.includes(man) ? now.filter(m => m !== man) : [...now, man]); } }
        else if (!shift && planGroundAll(S)) choose(S, []);   // (a click on nothing: everyone — or, the digits picking the men, nothing: who was picked stays picked)
        else if (!shift && K.planClear && !locked) { if (now.length) PLAN_STATS.picked++; S.who = 'all'; P.pick = []; }   // (… or, planClear, nobody: an empty set, until a man is picked or 5 is everyone — never on a tutorial mission before its pick lesson: an order there is the whole squad's)
      } else {
        const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
        const inside = S.men('all').filter(m => { const [sx, sy, front] = cam.project(m.char.pos, w, h); return front && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
        if (inside.length && !locked) { PLAN_STATS.boxed++; choose(S, shift ? [...now, ...inside] : inside); }
      }
    }
  }
  // the right button: down, it is in hand; up, it was a click — the order, on what the cursor is on now; still down after `planHoldSecs`, it is the ring
  // (never with Shift: a stop added to a chain is the click's)
  if (!K.planRts) { if (rmb) planOrder(S, S.targetUnder(input, cam, canvas), shift); return; }   // (as it was first built: the order as the button goes down)
  if (rmb) { P.rmbT = S.g.time; const t = K.planLook ? S.targetUnder(input, cam, canvas) : null; P.rdown = t ? { x: mx, y: my, t, drag: false, to: v3c(t.at) } : null; }
  if (P.rmbT < 0) return;
  // (… dragged before the ring's wait is up, planLook: it is an order with a way to look, and the ring is not opened under it)
  const RD = P.rdown; if (RD) { if (!RD.drag && Math.hypot(mx - RD.x, my - RD.y) >= K.planLookPx * ringZoom(w, h)) RD.drag = true; if (RD.drag) RD.to = v3c(S.targetUnder(input, cam, canvas).at); }
  if (!(input.buttons & 4)) { P.rmbT = -1; P.rdown = null; if (RD?.drag) lookOrder(S, RD.t, RD.to, shift); else planOrder(S, S.targetUnder(input, cam, canvas), shift); }
  else if (!shift && !RD?.drag && S.g.time - P.rmbT >= K.planHoldSecs - 1e-6 && !(S.g.rails?.locks('ring') && S.g.rails.locks('menu'))) {   // (a tutorial mission that has taught neither the menu nor the ring: the button let go is the click)
    P.rmbT = -1; P.rdown = null; S.ringByButton(input, cam, canvas); }
}
/** … and at the END of orders.ts input, whatever in it read the frame: with the mode up the mouse is not Sam's — he neither fires nor aims — and Shift,
 *  the mode's own modifier, is not his sprint (the tick's own copy of the input, written afresh from the next record) */
export function planAfter(S: SquadOrders, input: Input): void {
  const P = S.plan; if (!P.up) return;
  input.buttons &= ~5; input.clicked &= ~5; input.keys.delete('ShiftLeft'); input.keys.delete('ShiftRight');
  // (… and he stands: the walk keys were the view's, and he faces what he faced — the cursor is out among the men)
  if (!P.look) return;   // (… not an RTS's, cmdring.ts planRts: his feet and his eyes are his own)
  for (const k of WALK) input.keys.delete(k);
  if (P.aim) S.g.aimPoint = v3c(P.aim);
}

/** An order given by hand some other way (orders.ts give — the menu, the ring, the quick key): its men are off their chains. The word itself, or a way
 *  in given on the door a chain is stacked on (a door order of the door tools' has its men by now), is that chain's own word. */
export function planGiven(S: SquadOrders, men: Guard[], id: string): void {
  const P = S.plan; if (P.giving || !P.chains.length) return;
  const names = men.map(m => m.callsign), g = S.g;
  for (const C of P.chains) {
    if (C.phase !== 'wait' || !C.who.every(n => names.includes(n))) continue;
    if (id === 'go' || entering(S, menOf(S, C.who), C.steps[0])) { C.phase = 'in'; C.t = g.time; for (const n of C.who) names.splice(names.indexOf(n), 1); }
  }
  strike(S, names);
}

/** a fresh cast (orders.ts sync): nothing is chained and nobody picked; the mode is the player's and stays as it was */
export function planFresh(S: SquadOrders): void {
  const P = S.plan, t = S.g.time; P.drag = null;
  if (P.restoredT >= 0 && t >= P.restoredT && t - P.restoredT < 0.1) return;   // (the cast a checkpoint's own restart stood up: the file's chains stand)
  P.restoredT = -1; P.chains = []; P.pick = null; P.back = null; planHome(S);
}

export function planSnapshot(S: SquadOrders): PlanSnap { const P = S.plan; return { up: P.up, pick: P.pick ? [...P.pick] : null, chains: copyChains(P.chains), showT: P.showT, look: P.look ? v3c(P.look) : null, aim: P.aim ? v3c(P.aim) : null, stood: P.stood, back: P.back ? { from: v3c(P.back.from), t0: P.back.t0 } : null }; }
export function planRestore(S: SquadOrders, s: PlanSnap | null | undefined): void {
  const P = S.plan; P.drag = null; P.giving = false; P.restoredT = -1; P.rmbT = -1; P.rdown = null; P.look = P.aim = null; P.back = s?.back ? { from: v3c(s.back.from), t0: s.back.t0 } : null; P.stood = s?.up ? s.stood ?? null : null;
  if (!s) { P.up = false; P.pick = null; P.chains = []; P.showT = -1e9; return; }
  P.restoredT = S.g.time; P.up = s.up; P.pick = s.pick ? [...s.pick] : null; P.chains = copyChains(s.chains); P.showT = s.showT;
  if (s.up && CMDRING.planRts) { P.look = s.look ? v3c(s.look) : home(S); P.aim = s.aim ? v3c(s.aim) : null; }   // (a file from before the view was the hand's: it starts on him)
}

/** the picture (null: nothing to draw — the mode down and no chain touched within `planShowSecs`). A tutorial mission's SKY SEAT is drawn as the mode up
 *  (rails.ts planDrawn, RAILS.skyPlan: `frame` — the frame, its word, every man's ring) with the mode itself down (`up` false): no pick box, no mark for the
 *  parked player */
export function planView(S: SquadOrders): PlanView | null {
  const P = S.plan, g = S.g; if (!CMDRING.plan || !CMDRING.on || !S.active || g.player.down) return null;
  const sky = !P.up && !!g.rails?.planDrawn;
  if (!P.up && !sky && !(P.chains.length && g.time - P.showT < CMDRING.planShowSecs)) return null;
  const now = S.recipients(), at = (m: Guard): Vec3 => [m.char.pos[0], 0, m.char.pos[2]];
  const chains: PlanView['chains'] = [];
  for (const C of P.chains) {
    const men = menOf(S, C.who); if (!men.length) continue;
    const from: Vec3 = [0, 0, 0]; for (const m of men) { from[0] += m.char.pos[0] / men.length; from[2] += m.char.pos[2] / men.length; }
    let spent = C.spent;
    const stops = C.steps.map((s, i) => {
      const p = stopAt(S, s);
      let keys = keysOn(C, i); const take = Math.min(keys, spent); keys -= take; spent -= take;
      return { at: p, door: s.kind === 'door' && !!g.doors.list[s.door ?? -1], keys, now: i === 0 && (C.phase === 'wait' || C.phase === 'held') && keys > 0, look: s.look ? [p[0] + s.look[0] * LOOK_DRAWN_M, 0, p[2] + s.look[1] * LOOK_DRAWN_M] as Vec3 : null };
    });
    chains.push({ tone: S.toneOf(men), from, stops });
  }
  return { up: P.up, frame: P.up || sky, drag: P.up ? P.drag : null, sam: P.up && P.look && !seat(S) ? [g.player.char.pos[0], 0, g.player.char.pos[2]] : null, men: P.up || sky ? S.men('all').map(m => ({ at: at(m), tone: S.pairOf(m) ?? undefined, picked: now.includes(m), n: P.up ? digitOf(S, m) : 0 })) : [], chains, key: DOORTOOLS.blowKey.replace(/^Key/, ''),
    aim: P.up && P.rdown?.drag ? { from: [P.rdown.t.at[0], 0, P.rdown.t.at[2]], to: [P.rdown.to[0], 0, P.rdown.to[2]] } : null };
}
