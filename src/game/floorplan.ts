// THE SQUAD AND THE PLAN, DRAWN ON THE FLOOR — what the page shows of OUR OWN men's orders, as marks on the ground.
//
// The maintainer (10-13): "it would be good to have the squad move to do a throw (and maybe visualize who's doing it and the path on the ground?)" — and the
// Door Kickers 2 focus list's item 6: "mark() is null once the menu closes; four placed men are four lines of text. Done looks like: cover the top-left
// corner: you still know each man's mark, sector and which door waits on F. Our men only."
//
// THIS FILE ONLY READS THE GAME. `floorPlan(g)` turns the squad's orders as they stand (orders.ts Assignment, each man's own nav path) into a short list of
// things for the overlay to draw (ui/planfloor.ts); nothing here moves a man, writes a field the simulation reads, rolls a die, or looks at a camera, a canvas
// or a pixel — it is built from the orders alone, so a second player would be handed the same marks. Only men of the player's own squad are ever listed
// (`SquadOrders.squad()`): nothing about a man of another side, seen or not.
//
// WHAT IS LISTED, per living man who has a MARK (a follower in the file behind the player has none: he is drawn by standing there):
//   · on his way: the WAY he will walk — his own nav path from his feet where it is this order's, else the nav grid's (asked at most every PLAN.reaskSecs),
//     on through the corners of a way round (`Assignment.via`) to the mark — the mark itself, and what he will watch from it;
//   · on his mark: the mark, and the way his gun really points now (the unasked cover, a fitted watch and the rear watch all end up in his aim: the fan is
//     what he is doing, not what the order first said);
//   · taken off his order by the fight (`yieldT`): the mark alone, as his to come back to; on a man while still under the order: all of it, dim.
// `doors` = everything WAITING ON THE PLAYER'S KEY, read off its owners' own books by their own rule for the press (`waitsOnKey`: doortools.ts `waiting4` /
// `thresholdHeld` / `set` / `input`, wallcharge.ts `set` / `input`, the room clear drill's 'set' — repeated here as a reader; if a rule moves, `plan-check`'s
// word lines say so): a threshold held, a charge set on a door or a wall, the drill stacked, and for the four a tool given 'on my word', a charge being set,
// a pair on a plain stack. The overlay lays a bar across the doorway (along the wall's foot) with the key on the one the key would send NOW.
// `age` = seconds since his order came: the overlay draws an order just given at full strength (who + the way), then lets it sink back.
// With the menu up, `who` = the men its orders go to (a ring at each one's feet, before anything is given).
//
// A TEAMMATE'S THROW (`throws`, PLAN.throws): squadthrow.ts's thrower is walked like any man (who, way and mark come out of the above); the arc and where
// the thing comes to rest are READ from that module's own reader, `squadThrowPlans(g)` — never worked out here — one entry per throw from the order until
// the thing leaves his hand, plus the throw page's highlighted row as a `preview` (who would throw, his walk, the arc: before anything is given). While
// this draws them the neighbour's own stopgap picture (ui/squadthrowviz.ts, SQUADTHROW.draw) stands down: it asks `planDrawsThrows()`.
//
// NOTHING OF AN ENEMY: a mark, a way or a watched point that an order took FROM a man of another side (`Assignment.foe`: the quiet pair's 'take him' /
// 'watch him' put the mark behind him and the watch on him, live) is listed only while the team's fog has him seen, and its watch never; a watched point is
// listed only where it is the order's own door, the room fit's, or the point the player himself gave (cover / move / hold) — a door tool's 'threat first'
// writes a sensed place there. A man the fight has (`yieldT`, or the room fight's own point on his script) is drawn dim: that he is fighting is on his body.
//
// A SECOND PLAYER: `men` are the squad's and would be the same for both; `who` (the open menu's men) and a door's `now` (the men orders go to, who is
// nearest a set charge, who is down) are the SEAT's — today the one player's, read off `g.orders` and `g.player` at the two marked places.
//
// PLAN.on: on on every stand (it is picture only: with nobody asking `floorPlan` nothing runs; asked, a run's digest is the same — tools/qa/plan-check.ts);
// `?noplan` in the page = nothing drawn, the HUD as it was. The one piece of state is a WeakMap of nav legs kept between asks, picture only, in no checkpoint.
import { SideMap } from '../math/side';
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Assignment, Tone } from './orders';
import type { Door } from './doors';
import type { SetCharge } from './doortools';
import { DOORTOOLS } from './doortools';   // (both read inside functions only: src/game is one import cycle)
import { wallPt } from './wallcharge';
import { squadThrowPlans } from './squadthrow';
import { FRAG } from './frag';
import { AUTOPILOT, showSecsOf } from './autopilot';   // (read inside floorPlan only)
import { PLANLAY, layMen, layPoint, layKey, layPending } from './planlay';   // (the same)

export const PLAN = {
  on: true,
  /** the parts, each off = that part not drawn */
  paths: true, marks: true, sectors: true, who: true, tags: true, word: true, throws: true,
  /** the men's ways, marks, tags and fans only while the order menu is up — his word 10-13: 'they should only show when you're in the mode after pressing x. in
   *  normal gameplay they shouldn't show up'. Outside it stay: an order just GIVEN (the order book's own log, not a module's re-assign), fading out inside
   *  `freshSecs`; whatever waits on the key; a teammate's ordered throw until it leaves his hand. false = all of it for as long as the orders stand, as before */
  menuOnly: true,
  /** THE KEY ON A DOOR SAYS WHETHER IT IS LIVE (the maintainer, 10-22: "need some indicator on the F on the door when it's queued vs live. maybe black
   *  background to lighting up to yellow background"): the key's cap is drawn on every door that waits on it — DARK while its men are still on their
   *  way to it (queued: the press is kept, or sends men who are not set) or while the press would not send it, LIT in their colour once every man of
   *  it stands on his place and the press sends them now (PlanDoor.ready). false: the cap only on the door the key would send now, on its plate,
   *  the same whether or not its men are there. Picture only */
  keyLit: true,
  /** seconds an order just given is drawn at full strength — its men ringed, its ways bright */
  freshSecs: 2.5,
  /** how strong a way is drawn after that, while he still walks it · a mark and a fan under a man who stands */
  walkDim: 0.6, restDim: 0.45,
  /** a mark's ring, metres · a fan's reach, metres, and half angle, degrees · a sight line to what he watches is drawn out to this far, metres */
  ringM: 0.3, sectorM: 1.6, sectorDeg: 24, sightM: 14,
  /** the nav grid is asked for a leg his own path does not cover at most this often, seconds */
  reaskSecs: 0.5,
  /** the quiet pair's man waiting on the mark: his bar is this far ahead of his feet, metres */
  pairBarM: 0.55,
};

export interface PlanMan {
  gd: Guard;
  /** two characters for his mark ('R1', 'B2') */
  tag: string;
  /** his element's colour — null: a squad with no pairs (the HUD's own green) */
  tone: Tone | null;
  /** seconds since the order came */
  age: number;
  /** the way he will walk, his feet first and the mark last — empty: he is on it, the fight has taken him off his order, or the floor has no way */
  path: Vec3[];
  mark: Vec3;
  /** he stands on his mark */
  there: boolean;
  /** the fight has him: drawn dim */
  held: boolean;
  /** the fan from the mark: the yaw he watches (walking: will watch) — null: none */
  aim: number | null;
  /** the point he watches, where the order names one and (standing) his gun is really on it — null: none */
  watch: Vec3 | null;
  /** … and that point is his order's door */
  onDoor: boolean;
}
export interface PlanWho { gd: Guard; at: Vec3; tone: Tone | null }
/** something waiting on the player's key: a doorway's two jambs on the floor (a wall charge: a stretch of its wall's foot), whose it is, the key that sends
 *  it (null: no key does — the word is a menu row), and whether that key pressed NOW would send THIS one */
export interface PlanDoor { door: Door | null; a: Vec3; b: Vec3; tone: Tone | null; key: string | null; now: boolean; /** every man of it stands on his place (PLAN.keyLit: the key's cap is lit only then) */ ready: boolean; why: 'stack' | 'tool' | 'charge' | 'thr' | 'drill' | 'wall' | 'pair' }
/** a teammate's throw, ordered or (the throw page up) only offered: who, the floor he throws from, his way there where no `men` entry already carries it,
 *  the arc in the air and on along the floor to where the thing comes to rest (one line, ending in that ring), and the radius to draw round that (a frag's lethal reach; 0: none) */
export interface PlanThrow { gd: Guard; tag: string; tone: Tone | null; kind: 'frag' | 'stun'; preview: boolean; from: Vec3; walk: Vec3[]; arc: Vec3[]; land: Vec3; reach: number }
/** `you`: the feet of the one whose order menu is up (the SEAT's own man: ringed gold, the element the whole squad answers to), null with no menu */
/** an order LAID for the word (planlay.ts), nobody moving yet: its men's feet and the way each would walk to it, the door's two jambs or the spot, the
 *  key that sends the plan, and how strongly to draw it (1 in the order mode; with the menu down, an order just laid, going out with its age) */
export interface PlanLaid { tone: Tone | null; feet: Vec3[]; ways: Vec3[][]; at: Vec3 | null; a: Vec3 | null; b: Vec3 | null; key: string; k: number }
export interface FloorPlan { men: PlanMan[]; who: PlanWho[]; you: Vec3 | null; doors: PlanDoor[]; throws: PlanThrow[]; laid: PlanLaid[]; /** the SEAT is reading the plan (its order menu is up, or `PLAN.menuOnly` is off): false = `men` holds only orders just given, to be faded out with their age */ mode: boolean }
/** HOW A DOOR'S KEY CAP IS DRAWN (ui/planfloor.ts): 'none' no cap · 'plate' on its plate (PLAN.keyLit off: only the door the key would send now) ·
 *  'dark' it waits on the key, and its men are still on their way or the press would not send it · 'lit' they stand there and the press sends them */
export function capOf(dr: PlanDoor): 'none' | 'plate' | 'dark' | 'lit' {
  if (!dr.key) return 'none';
  if (!PLAN.keyLit) return dr.now ? 'plate' : 'none';
  return dr.now && dr.ready ? 'lit' : 'dark';
}
/** this module draws the squad's throws (so the neighbour's stopgap picture does not) */
export function planDrawsThrows(): boolean { return PLAN.on && PLAN.throws; }

const flat = v3.distXZ, yawTo = v3.yawTo;
const NUM: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6' };
/** 'Red Two' → 'R2', 'Blue One' → 'B1', 'Kestrel' → 'K' */
export function planTag(callsign: string): string {
  const w = callsign.trim().split(/\s+/); if (!w[0]) return '';
  return (w[0][0].toUpperCase() + w.slice(1).map(x => NUM[x.toLowerCase()] ?? x[0].toUpperCase()).join('')).slice(0, 3);
}

interface Leg { key: string; t: number; pts: Vec3[] | null; /** where the leg was asked from */ from: Vec3 }
const legs = new SideMap<Guard, Leg[]>('floorplan.legs');   // picture only (see the head): the nav grid's answer for a leg, kept PLAN.reaskSecs
function leg(g: Game, gd: Guard, k: number, a: Vec3, b: Vec3, iters = 3000): Vec3[] | null {
  let L = legs.get(gd); if (!L) legs.set(gd, L = []);
  const key = `${b[0].toFixed(1)},${b[2].toFixed(1)}`, c = L[k], dt = c ? g.time - c.t : -1;
  if (c && c.key === key && dt >= 0 && dt < PLAN.reaskSecs) return c.pts;   // (dt < 0: the clock went back on a load)
  const pts = g.col.nav.findPath(a, b, iters);   // (null: the floor has no way — nothing is drawn, never a line through a wall)
  L[k] = { key, t: g.time, pts, from: [a[0], 0, a[2]] }; return pts;
}

/** the way an order walks a man from where he stands to his mark: his feet, then every corner, then the mark — empty where the floor has none */
function wayOf(g: Game, gd: Guard, A: Assignment, mark: Vec3): Vec3[] {
  const p = gd.char.pos, stops: Vec3[] = A.via.length ? [...A.via, mark] : [mark];
  const out: Vec3[] = [[p[0], 0, p[2]]];
  const add = (q: Vec3) => { const l = out[out.length - 1]; if (flat(l, q) > 0.05) out.push([q[0], 0, q[2]]); };
  // his own path, where it is this order's and runs all the way (a one-point side step to get unstuck is not his way)
  const P = gd.path, own = !!gd.pathGoal && gd.pathI < P.length && (flat(gd.pathGoal, stops[0]) < 0.9 || flat(gd.pathGoal, A.goal) < 0.9) && flat(P[P.length - 1], gd.pathGoal) < 1.2;
  if (own) for (let i = gd.pathI; i < P.length; i++) add(P[i]);
  else {
    const pts = leg(g, gd, 0, p, stops[0]); if (!pts) return [];
    // an answer kept from a stride ago starts behind him: from the end of the leg he is nearest on — looked for over its first two metres only, never 'the
    // corner nearest him' of its first six (a way that doubles back passes near him again further on: the corners between were skipped and the line cut
    // the wall; attention.ts attentionWay draws a guard's thread the same way)
    let k = 0, best = Infinity, arc = 0, a = legs.get(gd)![0].from;
    for (let i = 0; i < pts.length && arc <= 2; i++) { const b = pts[i], dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz, u = l2 > 1e-9 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2)) : 0, d = Math.hypot(p[0] - a[0] - dx * u, p[2] - a[2] - dz * u); if (d < best - 1e-6) { best = d; k = i; } arc += Math.sqrt(l2); a = b; }
    for (let i = k < pts.length - 1 && flat(p, pts[k]) < 0.3 ? k + 1 : k; i < pts.length; i++) add(pts[i]);
  }
  add(stops[0]);
  for (let k = 1; k < stops.length; k++) { const pts = leg(g, gd, k, stops[k - 1], stops[k]); if (!pts) return []; for (const q of pts) add(q); add(stops[k]); }
  return out;
}

/** a doorway's two jambs on the floor */
const jambs = (door: Door): [Vec3, Vec3] => { const d = door.def, cx = Math.cos(d.closedDir), cz = Math.sin(d.closedDir); return [[d.hinge[0], 0, d.hinge[1]], [d.hinge[0] + cx * d.width, 0, d.hinge[1] + cz * d.width]]; };
/** one colour for some men: their pair's where they share one, else the whole squad's */
const toneFor = (g: Game, men: Guard[], toneOf: (gd: Guard) => Tone | null): Tone | null => { const t = new Set(men.map(toneOf)); return t.size === 1 ? [...t][0] : g.orders.paired ? 'gold' : null; };
const keyCap = (code: string) => code.replace(/^Key|^Digit/, '');
const angDiff = (a: number, b: number) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };

/** What waits on the player's key (the head's `doors`), and for each whether the key pressed now would send it — the door tools', the wall charge's and the
 *  drill's own rules for the press, repeated as a reader (wallcharge.ts `input` has it first: the nearest set charge, a door's if that is nearer; then
 *  doortools.ts `input`: the word to whatever of the addressed men's is waiting, else the nearest free set charge; the pair's word takes its set charges too). */
function waitsOnKey(g: Game, out: FloorPlan, toneOf: (gd: Guard) => Tone | null) {
  const S = g.orders, T = g.doorTools, WC = g.wallCharge, NB = g.nightBreach, RS = g.rescue, big = S.big, alive = (m: Guard) => m.state !== 'dead';
  const sam = g.player.char.pos, up = !g.player.down, addr = new Set(T.wordMen());   // (the SEAT's: see the head · the men the word's key reads, doortools.ts wordMen: the orders' own, and — the squad's only keys, cmdring.ts — whoever waits when none of those do)
  const F = keyCap(DOORTOOLS.blowKey), wordKey = !big || DOORTOOLS.wordOnKey;
  type Why = PlanDoor['why'];
  const RANK: Record<Why, number> = { stack: 0, pair: 0, tool: 1, thr: 2, drill: 2, charge: 3, wall: 3 };
  interface Wait { men: Set<Guard>; why: Why; /** something here of the addressed men's goes on the word */ word: boolean; set: SetCharge | null; drill: boolean; /** the rescue's entry, held for its second word */ gate: boolean }
  const by = new Map<Door, Wait>();
  const put = (door: Door, men: Guard[], why: Why, word: boolean): Wait => {
    let e = by.get(door); if (!e) by.set(door, e = { men: new Set(), why, word: false, set: null, drill: false, gate: false });
    for (const m of men) e.men.add(m); if (RANK[why] > RANK[e.why]) e.why = why; if (word) e.word = true; return e;
  };
  for (const op of T.ops) {
    if (op.word) continue;
    const held = !!op.thr && op.phase === 'thr';
    if (held || (big && (op.onWord || op.phase === 'held' || op.phase === 'armed' || op.phase === 'standoff' || op.phase === 'place'))) { const men = op.men.filter(alive); put(op.door, men, held ? 'thr' : op.kind === 'charge' ? 'charge' : 'tool', men.some(m => addr.has(m))); }
  }
  if (big) for (const gd of S.squad()) { const A = S.of(gd); if (alive(gd) && A && A.order === 'stack' && A.door && A.post && A.there.startsWith('stacked')) put(A.door, [gd], 'stack', addr.has(gd)); }
  else { for (const x of T.stackWaits(S.squad())) for (const gd of x.men) put(x.stack, [gd], 'stack', false);   // (DOORTOOLS.wordSmall: one or two teammates on a plain stack wait on the key too —
    for (const x of T.stackWaits([...addr])) for (const gd of x.men) put(x.stack, [gd], 'stack', true); }   // the key's own list, asked as the key asks it: the addressed men's)
  // (ownblow.ts: a charge of his own that the squad is not at waits on HIS key, not this one — no bar, and it is nothing to the press: keyIs on each tool)
  const tSet = T.set.filter(c => T.keyIs(c)), wSet = WC.set.filter(c => WC.keyIs(c));
  for (const c of tSet) put(c.door, S.squad().filter(m => alive(m) && m.callsign === c.by), 'charge', false).set = c;
  if (NB.state === 'set') { const d = NB.drill?.door; if (d) put(d, NB.drillOps.filter(alive), 'drill', false).drill = true; }   // (the room clear's own drill, stacked: its second F)
  // the rescue's entry on the hostage room, stacking or stacked and held for the second word (rescue.ts orderDoor: its own reading of the key, the LAST of them)
  const entry = RS.active && !RS.result && RS.entry && !RS.entry.gate.go ? RS.entry : null;
  if (entry) for (const e of entry.ops) if (e.ended === null) put(e.op.door, e.op.men.filter(alive), 'stack', false).gate = true;
  // the quiet pair's mark (pairorders.ts input: the FIRST reader of the key — while a man waits on it the press is his and gets no further): a bar a step
  // ahead of each man who waits, across his gun's line. His own feet and gun: nothing of the man he waits on
  const marked = g.pair.waiting(), pairFirst = up && marked.length > 0;
  for (const [gd] of marked) {
    const p = gd.char.pos, y = gd.char.aimYaw, fx = Math.sin(y), fz = Math.cos(y), cx = p[0] + fx * PLAN.pairBarM, cz = p[2] + fz * PLAN.pairBarM;
    out.doors.push({ door: null, a: [cx - fz * 0.3, 0, cz + fx * 0.3], b: [cx + fz * 0.3, 0, cz - fx * 0.3], tone: toneOf(gd), key: 'F', now: pairFirst, ready: true, why: 'pair' });
  }
  if (!by.size && !wSet.length) return;
  const free = tSet.filter(c => !T.ops.some(o => o.kind === 'charge' && o.door === c.door && !!o.word && isNaN(o.word.go1)));   // (not on a word already given)
  const nearSet = free.length ? free.reduce((a, b) => (flat(b.door.frameCentre, sam) < flat(a.door.frameCentre, sam) ? b : a)) : null;
  const wall = wSet.length ? WC.nearest(c => WC.keyIs(c)) : null, wallD = wall ? flat(wallPt(wall.wall, 0, 0), sam) : Infinity;
  const wallFirst = !!wall && !tSet.some(x => flat(x.door.frameCentre, sam) < wallD);
  const reaches = up && !pairFirst && (!wallFirst || !tSet.length);   // the press gets as far as the door tools
  const anyWord = wordKey && [...by.values()].some(e => e.word);
  const rowKey = !!S.menu && S.menu.rows.some(d => d.hotKey === DOORTOOLS.blowKey);   // a menu up with a row on the key: the key IS that row (the door tools' rule, the wall charge's too)
  const early = big && T.ops.some(op => (op.thr?.first === 'can' || op.thr?.first === 'burst') && op.men.some(m => addr.has(m)));   // (doortools.ts wordEarly has the press)
  const last = reaches && !anyWord && !early && !rowKey && !S.menu?.wordRow && !tSet.length && !wSet.length;   // … and past them all, to the rescue
  const tone = (men: Guard[]): Tone | null => toneFor(g, men, toneOf);
  const set = (men: Guard[]) => men.every(m => { const A = S.of(m); return !alive(m) || !A || (A.yieldT < 0 && (A.arrived || !A.post || flat(m.char.pos, A.post) < 0.5)); });   // (every man of it on his place — his feet there: a gun still coming round does not put the cap out — none taken off it by a fight)
  const drillNow = anyWord ? NB.drillOps.some(m => addr.has(m)) : !tSet.length && !wSet.length;   // (the drill reads the key after them: a word to its own men leaves it the press; a set charge, or a word to others, does not)
  for (const [door, e] of by) {
    const [ja, jb] = jambs(door);
    let now = false;
    if (reaches) {
      if ((e.word && wordKey) || (e.gate && last) || (e.drill && drillNow)) now = true;
      else if (e.set && free.includes(e.set)) now = big ? !anyWord && e.set === nearSet : anyWord || e.set === nearSet;
    }
    out.doors.push({ door, a: ja, b: jb, tone: tone([...e.men]), key: wordKey || e.set || e.drill || e.gate ? F : null, now, ready: set([...e.men]), why: e.why });
  }
  for (const c of wSet) out.doors.push({ door: null, a: wallPt(c.wall, -0.4, 0.03), b: wallPt(c.wall, 0.4, 0.03), tone: tone(S.squad().filter(m => alive(m) && m.callsign === c.by)), key: F, now: up && !pairFirst && !rowKey && wallFirst && c === wall, ready: true, why: 'wall' });
}

/** The squad's plan as it stands this frame, for the overlay. Empty with the switch off, with no squad on the floor, and under any show. */
export function floorPlan(g: Game): FloorPlan {
  const out: FloorPlan = { men: [], who: [], you: null, doors: [], throws: [], laid: [], mode: true };
  const S = g.orders; if (!PLAN.on || !S.active) return out;
  // outside the order mode: only what the order book was just told (its log: who, when) — a module's own re-assign of a man stamps him anew and is not that
  const mode = out.mode = !PLAN.menuOnly || !!S.menu, given = new Map<string, number>();   // (the SEAT's menu: see the head)
  // (autopilot.ts: a row the quick key gave is drawn for its own, longer, time — `slow` = how much slower such a man's picture ages —, and the squad's own
  // change of plan, SquadOrders.shows, as one of those. The NEWEST thing that names a man is the one he is drawn by, and it alone: with that switch off no
  // row is stamped, `shows` is empty and this is the line it was)
  const slow = new Map<string, number>();
  if (!mode) {
    const far = Math.max(PLAN.freshSecs, AUTOPILOT.on ? AUTOPILOT.showSecs : 0), last = new Map<string, { t: number; secs: number }>();
    const note = (c: string, t: number, secs: number) => { const e = last.get(c); if (!e || t > e.t) last.set(c, { t, secs }); };
    for (let i = S.log.length - 1; i >= 0 && g.time - S.log[i].t < far && S.log[i].t <= g.time; i--) for (const c of S.log[i].who) note(c, S.log[i].t, showSecsOf(S.log[i], PLAN.freshSecs));
    if (AUTOPILOT.on) for (let i = S.shows.length - 1; i >= 0 && g.time - S.shows[i].t < far && S.shows[i].t <= g.time; i--) for (const c of S.shows[i].who) note(c, S.shows[i].t, showSecsOf({ auto: true }, PLAN.freshSecs));
    for (const [c, e] of last) if (g.time - e.t < e.secs) { given.set(c, e.t); if (e.secs !== PLAN.freshSecs) slow.set(c, PLAN.freshSecs / e.secs); }
  }
  const toneOf = (gd: Guard): Tone | null => (S.paired ? S.pairOf(gd) : null);
  for (const gd of S.squad()) {
    if (gd.state === 'dead') continue;
    const A = S.of(gd); if (!A || !A.post) continue;
    let age = Math.max(0, g.time - A.t0);
    if (!mode) { const t = given.get(gd.callsign); if (t === undefined || A.t0 < t - 0.02) continue; age = Math.max(age, g.time - t) * (slow.get(gd.callsign) ?? 1); }   // (his since that order — a door tool hands him his mark a beat after it — and aged from the order)
    if (A.foe && !g.fogOfWar.seen(A.foe)) continue;   // (a mark taken from a man the team cannot see would walk the picture to him)
    // a step off the mark that the order's own goal names (the unasked cover's step to a line through an open door): that is where he will stand
    const at = A.via.length === 0 && A.goal && flat(A.goal, A.post) > 0.05 ? A.goal : A.post, mark: Vec3 = [at[0], 0, at[2]];
    const off = A.yieldT >= 0, held = off || !!gd.script?.over;
    const there = !off && flat(gd.char.pos, mark) < 0.45, walking = !off && !there;
    const raw = A.watch ?? A.fit?.watch ?? null, onDoor = !!raw && !!A.door && flat(raw, A.door.frameCentre) < 1.5;
    const told = raw && !A.foe && (onDoor || raw === A.fit?.watch || A.order === 'cover' || A.order === 'move' || A.order === 'hold') ? raw : null;
    let aim: number | null = null, watch: Vec3 | null = null;
    if (there) { aim = gd.char.aimYaw; if (told && angDiff(yawTo(gd.char.pos, told), aim) < 0.4) watch = told; }
    else if (walking) { if (told && flat(mark, told) > 0.3) { aim = yawTo(mark, told); watch = told; } else if (!A.foe) aim = A.fit?.face ?? A.face; }
    if (watch && flat(mark, watch) > PLAN.sightM) watch = null;
    out.men.push({ gd, tag: planTag(gd.callsign), tone: toneOf(gd), age, path: walking && PLAN.paths ? wayOf(g, gd, A, mark) : [], mark, there, held, aim: PLAN.sectors ? aim : null, watch: PLAN.sectors ? watch : null, onDoor: !!watch && onDoor });
  }
  if (PLAN.word) waitsOnKey(g, out, toneOf);
  // a plan laid for the word (planlay.ts): in the order mode all of it; with the menu down an order just laid, going out as an order just given does —
  // and while one waits the key is the plan's, so nothing else is marked as what the key would send now
  if (layPending(g)) {
    for (const d of out.doors) d.now = false;
    const F = keyCap(layKey());
    for (const o of S.lay.laid) {
      const age = g.time - o.t, k = mode ? 1 : age >= 0 && age < PLAN.freshSecs ? Math.min(1, (1 - age / PLAN.freshSecs) / 0.4) : 0; if (k <= 0) continue;
      const men = layMen(g, o); if (!men.length) continue;
      const at = layPoint(g, o), door = o.kind === 'door' ? g.doors.list[o.door ?? -1] : null;
      const L: PlanLaid = { tone: toneFor(g, men, toneOf), feet: men.map((m): Vec3 => [m.char.pos[0], 0, m.char.pos[2]]), ways: [], at, a: null, b: null, key: F, k };
      if (door) [L.a, L.b] = jambs(door);
      if (at && PLAN.paths) for (const m of men) { const pts = leg(g, m, 9, m.char.pos, at, 20000); if (pts) L.ways.push([[m.char.pos[0], 0, m.char.pos[2]], ...pts.map((q): Vec3 => [q[0], 0, q[2]]), at]); }
      out.laid.push(L);
    }
  }
  if (PLAN.throws) {
    const ours = new Set(S.squad());
    for (const T of squadThrowPlans(g)) {
      if (!ours.has(T.gd) || T.gd.state === 'dead' || T.points.length < 2) continue;
      const walked = !T.preview && out.men.some(m => m.gd === T.gd && m.path.length > 1);   // (ordered: his way is already his order's, above)
      out.throws.push({ gd: T.gd, tag: planTag(T.gd.callsign), tone: toneOf(T.gd), kind: T.kind, preview: !!T.preview, from: [T.from[0], 0, T.from[2]],
        walk: !walked && PLAN.paths && T.walk && T.walk.length > 1 ? T.walk.map((q): Vec3 => [q[0], 0, q[2]]) : [], arc: flat(T.points[T.points.length - 1], T.land) > 0.1 ? [...T.points, [T.land[0], 0, T.land[2]]] : T.points, land: [T.land[0], 0, T.land[2]], reach: T.kind === 'frag' ? FRAG.lethalM : 0 });
    }
  }
  const M = S.menu;   // (the SEAT's: see the head)
  if (M && PLAN.who) for (const gd of M.men) if (gd.state !== 'dead') out.who.push({ gd, at: [gd.char.pos[0], 0, gd.char.pos[2]], tone: toneOf(gd) });
  if (M && PLAN.who && !g.player.down) { const p = g.player.char.pos; out.you = [p[0], 0, p[2]]; }   // (the SEAT's own man)
  return out;
}

/** one line for the console and the panel */
export function planSummary(g: Game): string {
  if (!PLAN.on) return 'off';
  const P = floorPlan(g); if (!P.men.length && !P.who.length && !P.you && !P.doors.length && !P.throws.length && !P.laid.length) return 'nothing to draw';
  return `${P.men.filter(m => m.path.length).length} on their way · ${P.men.filter(m => m.there).length} on a mark${P.who.length ? ` · menu: ${P.who.length} ringed` : ''}${P.doors.length ? ` · ${P.doors.length} on the key` : ''}${P.throws.length ? ` · ${P.throws.length} throw${P.throws.length > 1 ? 's' : ''}${P.throws.every(t => t.preview) ? ' offered' : ''}` : ''}${P.laid.length ? ` · ${P.laid.length} laid` : ''}`;
}
