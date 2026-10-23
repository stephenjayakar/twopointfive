// A TEAMMATE LOOKS UNDER A SHUT DOOR WITH THE OPTICAL WAND — ON THE PLAYER'S ORDER, NEVER ON HIS OWN.
//
// The maintainer, 10-16, on whether a teammate may carry the wand and look first: "a, but yeah you have to order it". So this file is ONE ORDER and
// nothing else: no teammate ever decides to use a wand, no door tool has him look first, no drill asks for it. With `WAND.mate` (wand.ts) off, with
// nobody on the floor carrying one, or with no fog of war to look into, nothing here runs past its first line and the order is not on any menu.
//
// THE ORDER (id `wandLook`): the orders menu opened on a door (X, or the middle button) lists 'look under it · wand' on a key of its own, V
// (`WAND.orderKey`: every digit of a door's menu is taken and nothing is ever on a digit above 5; V is the whistle's key, eaten only while a menu that
// lists the row is up). It is ONE man's order (`only`): the nearest of the addressed men who carries a wand and can walk to the door's face they are on;
// everybody else is left exactly as he was. Greyed with the reason where it cannot be done: nobody addressed carries one, the door is steel (no gap),
// not shut, off its hinges, or nobody can get to it.
//
// THE MAN: walks to the middle of the leaf on the men's face (the player's own kneeling spot: Doors.workSpot), kneels with the lock work's pose, and
// `WAND.feedSecs` later (`WAND.quick`: as he gets down, the first time — wand.ts wandThrough) his lens is LIVE. He keeps it there until he is told something else, the leaf moves (he steps off beside the latch jamb, gun on
// the doorway), the fight takes him (the lens comes out; fed again from the start when he is back on his knee), or he is hit.
//
// THE LENS IS HIS EYE (fogofwar.ts asks `mateWandEye` in place of his own eye: no sixth eye): the player's lens by every number (wand.ts wandLens /
// wandFov / wandPanMax), swept from one end of its arc to the other and back over `WAND.sweepSecs` on the game's clock, since nobody aims it for him. So
// while he looks, what is round HIM is fog unless another eye has it — the same price the player pays. A hostile it shows keeps the wand's '(?)' mark.
// Under 'only my own eyes' it is a device feed like a sticky camera's and still lifts the fog.
//
// Nobody notices a lens; it files no sound; no dice; nothing reads the camera. No state in a checkpoint: an order is not saved (a checkpoint is refused
// with a squad on the floor), and after a load he simply is not looking.
import { SideMap } from '../math/side';
import { Vec3, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { Input } from './input';
import type { Door } from './doors';
import type { FogEye } from './fogofwar';
import type { OrderDef, OrderTarget, SquadOrders, Assignment } from './orders';
import { doorWords } from './orders';
import { WAND, wandFits, wandLens, wandFov, wandPanMax, wandThrough } from './wand';
import { kitOf } from './kit';
import { w } from './words';   // (a leaf: the dialogue pass's one switch)

export const WAND_ORDER = 'wandLook';
/** looks ordered · lenses gone live · looks ended by the leaf moving */
export const WANDORDER_STATS = { ordered: 0, live: 0, moved: 0 };

interface Job {
  door: Door; side: 1 | -1;
  /** where he kneels, and the way he faces there */
  stand: Vec3; yaw: number;
  /** where he steps to if the leaf moves (beside the latch jamb, out of the opening), found while it was shut; null = no floor there */
  aside: { pos: Vec3; yaw: number } | null;
  /** the assignment the job was given under: another one on him = the job is over */
  A: Assignment;
  /** game time he got onto his knee at the leaf (−1: not there), when the lens went live, and the last tick that ran for him */
  t0: number; liveT: number; lastT: number;
  live: boolean;
  /** this file put the lock work's pose on him (and so takes it off) */
  knelt: boolean;
  /** he has been on his knee at this door and was taken off it (the fight, a flash): what follows is a feed — WAND.feedSecs — whatever WAND.quick says */
  again: boolean;
}
interface State { jobs: Map<Guard, Job> }
const states = new SideMap<Game, State>('wandorder.states');
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

const live = (g: Game) => WAND.on && WAND.mate && g.fogOfWar.active;
const carries = (gd: Guard) => !!kitOf(gd)?.wand;
/** the fight has him — its lease, blind, folded, or the room fight's own aim over his order (`GuardScript.over`: a scenario teammate is never 'alert', so the
 *  lease alone would miss it): his hands are the gun's, the lens is out, and it is fed again from the start once he is given back */
const fought = (g: Game, gd: Guard, A: Assignment) => A.yieldT >= 0 || g.time < gd.dazzledUntil || g.time < gd.staggerUntil || !!gd.script?.over;
/** a point half a metre off the frame on face `side` (Doors.side's sign): what Doors.workSpot is asked from to get a spot on that face */
function onFace(d: Door, side: 1 | -1): Vec3 { const u = d.dir(), c = d.frameCentre; return [c[0] - u[1] * side * 0.5, 0, c[2] + u[0] * side * 0.5]; }
function spotOn(g: Game, d: Door, side: 1 | -1) { return g.doors.workSpot(d, onFace(d, side), 0.5, d.def.width * 0.5); }

/** who of `men` takes it, and where he kneels: the nearest carrier who can walk to the door's face (the men's own, as the menu dealt it) */
function pick(g: Game, S: SquadOrders, men: Guard[], t: OrderTarget): { gd: Guard; side: 1 | -1; spot: { pos: Vec3; yaw: number } } | string {
  if (t.kind !== 'door') return 'not a door.';
  const d = t.door; if (d.off) return 'no door left.'; if (d.def.steel) return 'steel: no gap under it.'; if (!wandFits(d)) return w("it's not shut.", 'it is not shut.');
  const has = men.filter(carries); if (!has.length) return w("nobody's carrying a wand.", 'no wand on them.');
  const spot = spotOn(g, d, t.side);
  let best: Guard | null = null, bd = Infinity;
  for (const gd of has) { if (S.reach(gd, spot.pos) !== null) continue; const k = flat(gd.char.pos, spot.pos); if (k < bd) { bd = k; best = gd; } }
  return best ? { gd: best, side: t.side, spot } : "can't get to it.";
}

function lensOut(gd: Guard, J: Job) {
  if (J.knelt) { gd.char.anim.lockpick = false; J.knelt = false; J.again = true; }   // (he was on his knee and is off it: the next feed is a feed, not the quick set-up)
  J.t0 = -1; J.live = false; J.A.crouch = false;
}
/** done with it: the lens out, a word, and a plain hold — beside the latch jamb with his gun on the doorway when the leaf moved, else where he stands */
function settle(g: Game, S: SquadOrders, gd: Guard, J: Job, line: string | null, moved: boolean) {
  const st = states.get(g)!, p = gd.char.pos, d = J.door;
  lensOut(gd, J); st.jobs.delete(gd); if (line) g.say(gd, line);
  const to = moved && J.aside && S.reach(gd, J.aside.pos) === null ? J.aside : null;
  if (to) S.assign(gd, { order: 'hold', post: to.pos, face: to.yaw, watch: [d.frameCentre[0], 1.1, d.frameCentre[2]], door: d, stance: 'none', upper: 'aim', going: 'off the door', there: `holding · ${doorWords(d)}`, setLine: null });
  else S.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: gd.char.bodyYaw, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding', setLine: null });
}

function issue(g: Game, S: SquadOrders, men: Guard[], t: OrderTarget): string | void {
  const P = pick(g, S, men, t); if (typeof P === 'string' || t.kind !== 'door') return;
  const st = states.get(g); if (!st) return;
  const old = st.jobs.get(P.gd); if (old) lensOut(P.gd, old);   // (sent from one door to another on his knees: he gets up first)
  const d = t.door, gd = P.gd, words = doorWords(d);
  // (beside the latch jamb, found while the leaf is shut: its direction is the frame's only then)
  const k = g.doors.kickSpotSide(d, onFace(d, P.side)), aside = g.col.nav.isBlocked(k.pos[0], k.pos[2]) ? null : { pos: [k.pos[0], 0, k.pos[2]] as Vec3, yaw: k.yaw };
  S.assign(gd, { order: WAND_ORDER, post: [P.spot.pos[0], 0, P.spot.pos[2]], face: P.spot.yaw, door: d, stance: 'lowReady', upper: 'none', move: { stance: 'none', upper: 'aim' },
    going: `wand · ${words}`, there: `feeding the wand · ${words}`, setLine: null });
  st.jobs.set(gd, { door: d, side: P.side, stand: [P.spot.pos[0], 0, P.spot.pos[2]], yaw: P.spot.yaw, aside, A: S.of(gd)!, t0: -1, liveT: -1, lastT: g.time, live: false, knelt: false, again: false });
  WANDORDER_STATS.ordered++;
}

function tick(g: Game, S: SquadOrders, gd: Guard, A: Assignment) {
  const st = states.get(g), J = st?.jobs.get(gd); if (!J || J.A !== A) return;
  const now = g.time, d = J.door, c = gd.char;
  if (!live(g) || !carries(gd)) { settle(g, S, gd, J, null, false); return; }
  if (!wandFits(d)) { WANDORDER_STATS.moved++; settle(g, S, gd, J, J.t0 >= 0 ? "door's moving. wand's out." : "door's open.", true); return; }
  // (the fight had him, or he was blinded or folded: the lens is out, and it is fed again from the start)
  if (now - J.lastT > 0.25 || fought(g, gd, A)) lensOut(gd, J);
  J.lastT = now;
  // (the orders stopped him short — his mark moved to his feet: he never looks from there)
  if (!A.post || flat(A.post, J.stand) > 0.3) { settle(g, S, gd, J, A.there === 'stopped short' ? null : "can't get on the door.", false); return; }
  const on = A.arrived && flat(c.pos, J.stand) < 0.45 && Math.abs(wrapAngle(c.bodyYaw - J.yaw)) < 0.6 && g.doors.side(d, c.pos) === J.side
    && !fought(g, gd, A);
  if (!on) { lensOut(gd, J); return; }
  if (J.t0 < 0) J.t0 = now;
  c.anim.lockpick = true; J.knelt = true; A.crouch = true;
  if (!J.live && (J.again || !WAND.quick ? now - J.t0 >= WAND.feedSecs : wandThrough(0, now - J.t0, c.anim.crouch))) { J.live = true; J.liveT = now; WANDORDER_STATS.live++; g.say(gd, "wand's in."); }
  A.there = `${J.live ? 'looking under' : 'feeding the wand'} · ${doorWords(d)}`;
}

function row(g: Game): OrderDef {
  return {
    id: WAND_ORDER, hotKey: WAND.orderKey, label: 'look under it · wand', targets: ['door'], ack: ['on it.', 'moving.'],
    // (asked on the PLAYER's face of the door, before the orders turn a four to the face its men can reach: both faces are tried, so the one man is named
    //  either way and nobody else is taken off what he was doing)
    only: (S, men, t) => { if (t.kind !== 'door') return [];
      for (const side of [t.side, -t.side] as (1 | -1)[]) { const P = pick(g, S, men, { ...t, side }); if (typeof P !== 'string') return [P.gd]; }
      return []; },
    valid: (S, t, men) => { const P = pick(g, S, men, t); return typeof P === 'string' ? P : true; },
    issue: (S, men, t) => issue(g, S, men, t),
    tick: (S, gd, A) => tick(g, S, gd, A),
  };
}

/** game.ts, once a frame beside the other order keys (after the orders' own input, before the player's keys): keeps the row on the menus only while a
 *  living squad man carries a wand and there is a fog to look into; takes the lens out of a man the fight or another order has; and reads the row's
 *  key while a menu that lists it is up. True = the key was the order's this frame (and is eaten). */
export function wandOrderKey(g: Game, input: Input): boolean {
  const S = g.orders; let st = states.get(g);
  const want = live(g) && S.squad().some(gd => gd.state !== 'dead' && carries(gd));
  if (!st) { if (!want) return false; st = { jobs: new Map() }; states.set(g, st); }
  const listed = S.defs.some(d => d.id === WAND_ORDER);
  if (want && !listed) { const after = S.defs.findIndex(d => d.id === 'hold'); S.register(row(g), after >= 0 ? S.defs[after + 1]?.id : undefined); }
  else if (!want && listed) S.unregister(WAND_ORDER);
  if (st.jobs.size) {
    const squad = S.squad(), now = g.time;
    for (const [gd, J] of st.jobs) {
      const A = S.of(gd);
      if (gd.state === 'dead' || !squad.includes(gd) || A !== J.A) { if (J.knelt) gd.char.anim.lockpick = false; st.jobs.delete(gd); continue; }
      if (!want || !carries(gd)) { settle(g, S, gd, J, null, false); continue; }   // (the fog or the switch went off under him: the row is off the list, so its tick never runs again — a plain hold where he is)
      if ((J.knelt || J.live) && (now - J.lastT > 0.25 || fought(g, gd, J.A))) lensOut(gd, J);
    }
  }
  if (!want) return false;
  const M = S.menu, key = WAND.orderKey; if (!M || !input.hit(key)) return false;
  const i = M.rows.findIndex(d => d.id === WAND_ORDER); if (i < 0) return false;
  input.pressed.delete(key); S.pick(i); return true;
}

/** HIS LENS AS HIS EYE among the fog's (fogofwar.ts), or null while he is not looking: the player's lens by every number, swept over its arc on the
 *  game's clock */
export function mateWandEye(g: Game, gd: Guard): FogEye | null {
  const st = states.get(g); if (!st || !st.jobs.size) return null;
  const J = st.jobs.get(gd); if (!J || !J.live || !live(g)) return null;
  const now = g.time; if (gd.state === 'dead' || now - J.lastT > 0.25 || now < gd.dazzledUntil || gd.script?.over || !wandFits(J.door)) return null;
  const L = wandLens(J.door, J.side), ph = ((now - J.liveT) / Math.max(0.5, WAND.sweepSecs) + 0.25) % 1, a = L.yaw + wandPanMax() * (1 - 4 * Math.abs(ph - 0.5));
  return { id: gd.char.id, pos: L.pos, look: [Math.sin(a), 0, Math.cos(a)], at: L.pos, fov: wandFov(), near: 0, wand: true };
}
/** every teammate's live lens (fogofwar.ts under 'only my own eyes': a lens is a device feed there, like a sticky camera's) */
export function mateWandEyes(g: Game): FogEye[] {
  const st = states.get(g); if (!st || !st.jobs.size) return [];
  const out: FogEye[] = []; for (const gd of st.jobs.keys()) { const e = mateWandEye(g, gd); if (e) out.push(e); }
  return out;
}
/** who is looking under what, for the checks and the debugger */
export function wandOrderJobs(g: Game): { gd: Guard; door: Door; side: 1 | -1; live: boolean; knelt: boolean }[] {
  const st = states.get(g); return st ? [...st.jobs].map(([gd, J]) => ({ gd, door: J.door, side: J.side, live: J.live, knelt: J.knelt })) : [];
}
