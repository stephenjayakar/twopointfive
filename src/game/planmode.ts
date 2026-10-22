// PLAN MODE — a PROTOTYPE beside the orders ring (cmdring.ts `plan`; the design: rebuild/commanding/command-mode.md). OFF in the module and on both
// stands; the page raises it when asked for beside the ring (`?cmd&cmdplan`). The maintainer's words for it: an RTS's way with a squad, "for advanced
// players that requires explicitly leaving".
//
//   · SHIFT + THE RING'S KEY TOGGLES IT (where that key is free: with a menu, a Space list, a verb or the launcher's arc to back out of, it backs out).
//     While it is up the mouse is the squad's, not Sam's — he does not fire or aim — and Shift, its modifier, is not his sprint.
//   · SAM STANDS WHERE HE IS AND THE VIEW IS THE HAND'S (the maintainer, 10-20: "your player character is stuck, wasd moves the camera around … it should
//     feel like you're switching into an RTS mode temporarily"): the walk keys move the view's own point (`look`, which the follow camera is given in
//     place of him — Game.followPos; no further than `planPanReachM` from him and the men), he goes on facing what he faced when the mode went up
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
import { backTake } from './backkey';   // (read inside planInput only)
import { DOORTOOLS } from './doortools';

export const PLAN_STATS = { toggled: 0, picked: 0, boxed: 0, given: 0, added: 0, words: 0, early: 0, struck: 0, dropped: 0, done: 0 };

/** `go`: on the way to steps[0] · `wait`: stacked on its door, the word wanted · `in`: the entry given, the room being taken · `held`: the stop is done
 *  and the word is wanted to move on. `spent`: early presses of the word's key not yet used · `t`: the game's clock when the phase began */
export interface PlanChain { who: string[]; steps: LaidWhere[]; phase: 'go' | 'wait' | 'in' | 'held'; spent: number; t: number }
/** `up`: the mode · `pick`: the picked men's callsigns (null: the who key's choice) · `drag`: a box being drawn (CSS px of the view) · `showT`: the
 *  game's clock when the plan last changed under the key (it is shown a moment with the mode down) · `giving`: a chain's own order is being given now */
export interface PlanState { up: boolean; pick: string[] | null; chains: PlanChain[]; drag: { x0: number; y0: number; x1: number; y1: number } | null; showT: number; giving: boolean; /** a load put the chains back at that game time (planFresh leaves them be) */ restoredT: number;
  /** the mode up: the point on the floor the view follows in Sam's place (the walk keys move it) · the point he goes on facing · a right press in hand
   *  (the game's clock when it went down): let go it is a click, kept down it is the ring */
  look: Vec3 | null; aim: Vec3 | null; rmbT: number }
export interface PlanSnap { up: boolean; pick: string[] | null; chains: PlanChain[]; showT: number; look?: Vec3 | null; aim?: Vec3 | null }
/** what the page draws (ui/cmdring.ts): the men's circles, the box, Sam's own mark (at the view's edge, pointing at him, once the view has left him), and
 *  each chain from its men through its stops with the key's marks still to press */
export interface PlanView {
  up: boolean; drag: PlanState['drag'];
  /** the mode up and the view the hand's: where Sam stands (the view may have left him) */
  sam: Vec3 | null;
  men: { at: Vec3; tone: string | undefined; picked: boolean }[];
  chains: { tone: string | undefined; from: Vec3; stops: { at: Vec3; door: boolean; keys: number; now: boolean }[] }[];
  key: string;
}

export function planNew(): PlanState { return { up: false, pick: null, chains: [], drag: null, showT: -1e9, giving: false, restoredT: -1, look: null, aim: null, rmbT: -1 }; }
const WALK = ['KeyW', 'KeyS', 'KeyD', 'KeyA'];
const v3c = (p: Vec3): Vec3 => [p[0], p[1], p[2]];
const copyChains = (a: PlanChain[]): PlanChain[] => a.map(c => ({ ...c, who: [...c.who], steps: c.steps.map(s => ({ ...s, at: [s.at[0], s.at[1], s.at[2]] as Vec3, ...(s.pick ? { pick: [s.pick[0], s.pick[1], s.pick[2]] as Vec3 } : {}) })) }));
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

/** a place for a chain, off the target the cursor was on (null: a man of the other side — an order on him is given at once and never chained) */
function stepOf(S: SquadOrders, t: OrderTarget): LaidWhere | null {
  if (t.kind === 'foe') return null;
  const o: LaidWhere = { kind: t.kind, at: [t.at[0], 0, t.at[2]] };
  if (t.kind === 'door') o.door = S.g.doors.list.indexOf(t.door);
  if (t.kind === 'none' && t.man) o.man = t.man.callsign;
  if (t.kind === 'floor' && t.thing) { o.found = 'thing'; o.pick = [t.thing.face[0], t.thing.face[1], t.thing.face[2]]; }
  return o;
}
/** does the chain stop for the word once that step is done: a room taken or a thing worked, with something chained after it */
const stopsAfter = (s: LaidWhere) => s.kind === 'door' || s.found === 'thing';
/** the word's marks still on a step (`i`: its place in the chain): the threshold's, and the one after it */
function keysOn(C: PlanChain, i: number): number {
  const s = C.steps[i], last = i === C.steps.length - 1;
  const thr = s.kind === 'door' && (i > 0 || C.phase === 'go' || C.phase === 'wait') ? 1 : 0;
  return thr + (stopsAfter(s) && !last ? 1 : 0);
}
const keysLeft = (C: PlanChain) => C.steps.reduce((n, _s, i) => n + keysOn(C, i), 0);

function drop(S: SquadOrders, C: PlanChain, done = false): void { const P = S.plan, i = P.chains.indexOf(C); if (i >= 0) { P.chains.splice(i, 1); if (done) PLAN_STATS.done++; else PLAN_STATS.dropped++; } }
/** those men off every chain (one with nobody left on it is gone) */
function strike(S: SquadOrders, names: string[]): void {
  const P = S.plan;
  for (const C of [...P.chains]) { const was = C.who.length; C.who = C.who.filter(n => !names.includes(n)); if (C.who.length !== was) PLAN_STATS.struck++; if (!C.who.length) drop(S, C); }
}

/** the chain's first step, given now: the quick key's order there for its men (refused, or its door or man gone: the chain ends — a man has said why) */
function start(S: SquadOrders, C: PlanChain): void {
  const g = S.g, st = C.steps[0], men = menOf(S, C.who), t = st ? layTarget(g, st) : null;
  if (!t || !men.length) return drop(S, C);
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
  const r = S.quickFor(men, t); if (!r) return;   // (refused: a man said why — they wait where they are)
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
  if (P.pick && !menOf(S, P.pick).length) P.pick = null;
  if (P.up && !S.men('all').length) down(S, null);   // (nobody left to order: the mouse is Sam's)
  for (const C of [...P.chains]) {
    const men = menOf(S, C.who), st = C.steps[0]; C.who = men.map(m => m.callsign);
    if (!men.length || !st) { drop(S, C); continue; }
    const door = st.kind === 'door' ? g.doors.list[st.door ?? -1] : null, more = C.steps.length > 1;
    if (C.phase === 'go') {
      if (door) { if (g.doorTools.waitsOn(men, door)?.set) pause(S, C, 'wait'); }
      else if (g.time - C.t > 0.3 && men.every(m => { const A = S.of(m); return !A || A.arrived; }) && !(st.found === 'thing' && men.some(m => g.work.working(m)))) {   // (a thing: he is done with it — worked, or not there to work — not merely stood at it)
        if (st.found === 'thing' && more) pause(S, C, 'held'); else next(S, C); }
    } else if (C.phase === 'wait') { if (entering(S, men, st)) { C.phase = 'in'; C.t = g.time; } }   // (the entry given by somebody else's hand: a tool's, a scenario's)
    else if (C.phase === 'in' && g.time - C.t > 0.5 && !g.doorTools.ops.some(op => op.men.some(m => men.includes(m)))) {
      if (door && g.doorTools.waitsOn(men, door)) { C.phase = 'wait'; C.t = g.time; }   // (the entry was given up — a lock — and they are back on their marks: the threshold again, and its word)
      else if (more) pause(S, C, 'held'); else drop(S, C, true);   // (nothing after it: they hold the room, as they always did)
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
    for (const C of waiting) { if (C.phase === 'wait') enter(S, C); else next(S, C); }
    return;
  }
  // (men still walking to a door they are chained to, and nothing else the key could mean — no charge set, nobody stood waiting on it, no plan laid
  //  for it: the press is kept for that threshold, ahead of the door tools' own early word, so the mark comes off the plan)
  const g = S.g, men = S.recipients(), walking = mine.filter(c => c.phase === 'go' && c.steps[0].kind === 'door' && c.spent === 0);
  if (!walking.length || S.menu || S.lay.laid.length || g.doorTools.set.length || g.wallCharge.set.length || g.doors.list.some(d => g.doorTools.waitsOn(men, d)?.set)) return;
  input.pressed.delete(key); P.showT = g.time; PLAN_STATS.early++;
  for (const C of walking) C.spent++;
}
/** … and BEHIND its other readers (game.ts, after the door tools' and the wall charges' own): a press nobody took — no charge to blow, no word waited
 *  on, no plan laid for it — with a pause still ahead on a chain of the picked men is kept for the next pause of each */
export function planLate(S: SquadOrders, input: Input): void {
  const P = S.plan, key = DOORTOOLS.blowKey; if (!CMDRING.plan || !key || !P.chains.length || !input.pressed.has(key) || S.menu) return;
  const early = chainsOf(S).filter(c => keysLeft(c) > c.spent); if (!early.length) return;
  input.pressed.delete(key); P.showT = S.g.time; PLAN_STATS.early++;
  for (const C of early) C.spent++;
}

/** a right click on `t` (and the ring's first wedge, opened by that button): the quick key's order there for the picked men — replacing their chain, or
 *  (`add`) put on its end */
export function planOrder(S: SquadOrders, t: OrderTarget, add: boolean): void {
  const P = S.plan, g = S.g, men = S.recipients(t); if (!men.length) { g.msg('nobody to take that order'); return; }
  let names = men.map(m => m.callsign); const st = stepOf(S, t);
  if (!st) { if (S.quickFor(men, t)) strike(S, names); return; }
  if (add) {
    // (each chain these men are on gets the stop on its end; a chain that has other men too is parted first, so the others go on as they were)
    const rest = [...names];
    for (const C of [...P.chains]) {
      const inC = C.who.filter(n => rest.includes(n)); if (!inC.length) continue;
      let T = C; if (inC.length < C.who.length) { T = { ...copyChains([C])[0], who: inC }; C.who = C.who.filter(n => !inC.includes(n)); P.chains.push(T); }
      T.steps.push({ ...st, at: [st.at[0], st.at[1], st.at[2]] }); for (const n of inC) rest.splice(rest.indexOf(n), 1);
    }
    if (rest.length < names.length) { PLAN_STATS.added++; P.showT = g.time; }
    if (!rest.length) return;
    names = rest;   // (men on no chain: the stop is theirs now — a chain of one)
  }
  // (given first: a refused order — a man has said why — leaves them on the chain they were on)
  const to = menOf(S, names), r = S.quickFor(to, t); if (!r) return;
  strike(S, names); P.showT = g.time; PLAN_STATS.given++;
  P.chains.push({ who: names, steps: [st], phase: st.kind === 'door' && r === 'entry' ? 'in' : 'go', spent: 0, t: g.time });
}

/** the mode put down: the mouse is Sam's again once he lets go of it, and the choice is the who key's */
function down(S: SquadOrders, input: Input | null): void {
  const P = S.plan, g = S.g; if (!P.up) return;
  P.up = false; P.drag = null; P.pick = null; P.showT = g.time; P.look = null; P.aim = null; P.rmbT = -1;
  if (input) { input.clicked &= ~5; input.buttons &= ~5; if (input === g.seat.input) g.seat.swallow(5); }
}
/** … and put up: the view's point starts on Sam, and what he is facing is what he goes on facing */
function up(S: SquadOrders): void {
  const P = S.plan, g = S.g, p = g.player.char.pos;
  P.up = true; P.drag = null; P.rmbT = -1; P.look = P.aim = null;
  if (CMDRING.planRts) { P.look = [p[0], 0, p[2]]; P.aim = v3c(g.aimPoint); }
}
/** Sam put somewhere else with the mode up (a restart, a fresh cast): the view starts on him again, and he faces what he faces there */
export function planHome(S: SquadOrders): void { const P = S.plan, g = S.g, p = g.player.char.pos; if (P.up && P.look) { P.look = [p[0], 0, p[2]]; P.aim = v3c(g.aimPoint); P.rmbT = -1; } }
/** the walk keys move the view's point, the way they would have walked him (the camera's own basis), `planPanMps` — kept within `planPanReachM` of the
 *  box he and the men stand in, so the view is never lost */
function pan(S: SquadOrders, input: Input, cam: FollowCamera, dt: number): void {
  const P = S.plan, K = CMDRING, L = P.look; if (!L) return;
  const { fwd, right } = cam.planarBasis(); let mx = 0, mz = 0;
  if (input.down(WALK[0])) { mx += fwd[0]; mz += fwd[2]; } if (input.down(WALK[1])) { mx -= fwd[0]; mz -= fwd[2]; }
  if (input.down(WALK[2])) { mx += right[0]; mz += right[2]; } if (input.down(WALK[3])) { mx -= right[0]; mz -= right[2]; }
  const l = Math.hypot(mx, mz); if (l > 1e-6) { L[0] += mx / l * K.planPanMps * dt; L[2] += mz / l * K.planPanMps * dt; }
  const p = S.g.player.char.pos; let x0 = p[0], x1 = p[0], z0 = p[2], z1 = p[2];
  for (const m of S.men('all')) { const q = m.char.pos; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
  L[0] = Math.max(x0 - K.planPanReachM, Math.min(x1 + K.planPanReachM, L[0])); L[2] = Math.max(z0 - K.planPanReachM, Math.min(z1 + K.planPanReachM, L[2]));
}
/** what the follow camera follows in Sam's place (Game.followPos; null: him) */
export function planLook(S: SquadOrders): Vec3 | null { const P = S.plan; return P.up ? P.look : null; }

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
  const shift = input.down('ShiftLeft') || input.down('ShiftRight');
  // (the toggle is the ring's key where the ring's key is free: with something for it to back out of — a menu, a Space list, a verb, the launcher's arc — it backs out, Shift or no)
  if (planShift(S, input) && !S.cmdRing && S.backFree() && input.pressed.delete(K.key)) { PLAN_STATS.toggled++; if (P.up) down(S, input); else up(S); }
  if (P.up && K.planRun && !S.menu && !S.cmdRing && backTake(input)) { PLAN_STATS.toggled++; down(S, input); }   // (the back key takes the mode down, once nothing nearer is up to back out of: backkey.ts)
  word(S, input);
  if (!P.up) return;
  if (input.pressed.has('Blur')) { P.drag = null; P.rmbT = -1; }
  if (S.menu || S.cmdRing) { P.drag = null; P.rmbT = -1; return; }   // (a menu or the ring is up: the buttons are its own this frame — planAfter takes what is left of them from Sam)
  if (K.planRts) pan(S, input, cam, dt);
  const held = (input.buttons & 1) !== 0, lmb = (input.clicked & 1) !== 0, rmb = (input.clicked & 4) !== 0, mx = input.mouseX, my = input.mouseY;
  const w = canvas.clientWidth, h = canvas.clientHeight, now = S.recipients();
  if (lmb) P.drag = { x0: mx, y0: my, x1: mx, y1: my };   // (a press is a box begun, wherever it lands: let go where it went down, it was a click)
  else if (P.drag) {
    const D = P.drag;
    if (held) { D.x1 = mx; D.y1 = my; }
    else {
      P.drag = null;
      if (Math.hypot(D.x1 - D.x0, D.y1 - D.y0) < K.planDragPx * ringZoom(w, h)) {
        const k = S.manAt(input, cam, canvas), man = k >= 0 ? S.squad()[k] : null;
        if (man) { PLAN_STATS.picked++; choose(S, !shift ? [man] : now.includes(man) ? now.filter(m => m !== man) : [...now, man]); }
        else if (!shift) choose(S, []);   // (a click on nothing: everyone)
      } else {
        const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
        const inside = S.men('all').filter(m => { const [sx, sy, front] = cam.project(m.char.pos, w, h); return front && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
        if (inside.length) { PLAN_STATS.boxed++; choose(S, shift ? [...now, ...inside] : inside); }
      }
    }
  }
  // the right button: down, it is in hand; up, it was a click — the order, on what the cursor is on now; still down after `planHoldSecs`, it is the ring
  // (never with Shift: a stop added to a chain is the click's)
  if (!K.planRts) { if (rmb) planOrder(S, S.targetUnder(input, cam, canvas), shift); return; }   // (as it was first built: the order as the button goes down)
  if (rmb) P.rmbT = S.g.time;
  if (P.rmbT < 0) return;
  if (!(input.buttons & 4)) { P.rmbT = -1; planOrder(S, S.targetUnder(input, cam, canvas), shift); }
  else if (!shift && S.g.time - P.rmbT >= K.planHoldSecs - 1e-6) { P.rmbT = -1; S.ringByButton(input, cam, canvas); }
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
  P.restoredT = -1; P.chains = []; P.pick = null; planHome(S);
}

export function planSnapshot(S: SquadOrders): PlanSnap { const P = S.plan; return { up: P.up, pick: P.pick ? [...P.pick] : null, chains: copyChains(P.chains), showT: P.showT, look: P.look ? v3c(P.look) : null, aim: P.aim ? v3c(P.aim) : null }; }
export function planRestore(S: SquadOrders, s: PlanSnap | null | undefined): void {
  const P = S.plan; P.drag = null; P.giving = false; P.restoredT = -1; P.rmbT = -1; P.look = P.aim = null;
  if (!s) { P.up = false; P.pick = null; P.chains = []; P.showT = -1e9; return; }
  P.restoredT = S.g.time; P.up = s.up; P.pick = s.pick ? [...s.pick] : null; P.chains = copyChains(s.chains); P.showT = s.showT;
  if (s.up && CMDRING.planRts) { const p = S.g.player.char.pos; P.look = s.look ? v3c(s.look) : [p[0], 0, p[2]]; P.aim = s.aim ? v3c(s.aim) : null; }   // (a file from before the view was the hand's: it starts on him)
}

/** the picture (null: nothing to draw — the mode down and no chain touched within `planShowSecs`) */
export function planView(S: SquadOrders): PlanView | null {
  const P = S.plan, g = S.g; if (!CMDRING.plan || !CMDRING.on || !S.active || g.player.down) return null;
  if (!P.up && !(P.chains.length && g.time - P.showT < CMDRING.planShowSecs)) return null;
  const now = S.recipients(), at = (m: Guard): Vec3 => [m.char.pos[0], 0, m.char.pos[2]];
  const chains: PlanView['chains'] = [];
  for (const C of P.chains) {
    const men = menOf(S, C.who); if (!men.length) continue;
    const from: Vec3 = [0, 0, 0]; for (const m of men) { from[0] += m.char.pos[0] / men.length; from[2] += m.char.pos[2] / men.length; }
    let spent = C.spent;
    const stops = C.steps.map((s, i) => {
      const d = s.kind === 'door' ? g.doors.list[s.door ?? -1] : null, m = s.kind === 'none' && s.man ? S.squad().find(x => x.callsign === s.man) : null;
      const p: Vec3 = d ? [d.frameCentre[0], 0, d.frameCentre[2]] : m ? at(m) : s.kind === 'none' ? [g.player.char.pos[0], 0, g.player.char.pos[2]] : [s.at[0], 0, s.at[2]];
      let keys = keysOn(C, i); const take = Math.min(keys, spent); keys -= take; spent -= take;
      return { at: p, door: !!d, keys, now: i === 0 && (C.phase === 'wait' || C.phase === 'held') && keys > 0 };
    });
    chains.push({ tone: S.toneOf(men), from, stops });
  }
  return { up: P.up, drag: P.up ? P.drag : null, sam: P.up && P.look ? [g.player.char.pos[0], 0, g.player.char.pos[2]] : null, men: P.up ? S.men('all').map(m => ({ at: at(m), tone: S.pairOf(m) ?? undefined, picked: now.includes(m) })) : [], chains, key: DOORTOOLS.blowKey.replace(/^Key/, '') };
}
