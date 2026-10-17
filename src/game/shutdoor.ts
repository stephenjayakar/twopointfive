// SHUT THAT DOOR — one teammate shuts an open door, on Sam's word and never by himself.
//
// Doors stay where they are left (doors.ts DOORSTAY) and a door left open behind the squad is a lane. The maintainer, asked 10-08 whether teammates should shut
// doors behind the squad, picked "On order": "A shut that door row goes on the door menu and teammates shut one only when told."
//
// THE ROW: on the door's TOOLS page (X, 5) it STANDS IN for 'breach with a charge' on that row's digit (3) while the leaf stands open — the door tools' own
// line for open (K.open = doortools.ts isOpen), where the charge's row had nothing to offer but "it's open." — and no charge is on it (orders.ts
// OrderDef.standsIn). X, 5, 3: no new digit, no held key, the page keeps its shape. Greyed with its reason, never gone, when it cannot be done: the leaf is
// off its hinges, nobody has a place to shut it from, a body or a man is in its swing, an enemy is in sight through it.
// THE MAN: of the men the order is addressed to, the one with the shortest walk to a place he can shut it from (`only`: the rest keep the orders they
// have, without a word). The place is beside the door's LATCH JAMB, within reach of where its handle comes to and clear of the floor the leaf crosses on
// its way shut. WHICH FACE of the door: a man in Sam's file shuts it from SAM'S face (the door is shut behind the squad — from the far face he would shut
// himself out and open it again coming back to the file); a man posted somewhere shuts it from his own face (he is not sent through a doorway to shut it
// behind himself); the other face only where that one has no place, or a way four metres shorter (K.cross). He walks there at the team's pace (the order
// runner's: guards.ts PACE, silent.ts under it), gun on the doorway, turns to the handle, and the leaf is walked to at a hand's speed (doors.ts pullTo: the
// sprung close its latch catches — a keyed door's bolt goes home with it, by the door's own rule). He says so in a word, then goes back into the file if
// 'fall in' is what he was taken from, else he holds by the door.
// QUIET: doors.ts has no quieter close than pullTo — it never slams, and its latch is a click at level 0.16 (a tick inside six metres), for Sam's own
// hand too. A silent squad's man shuts it the same way and says his word over the net (silent.ts hush).
// Nothing here runs unless the order is given or its row is on an open menu: no tick of the game's, no knob, no state but a WeakMap entry per man under it.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Assignment, OrderDef, SquadOrders } from './orders';
import { doorWords, sideOf } from './orders';
import { frameOf, crossesDoor } from './guards';
import { isHostile } from './teams';
import { civiliansShown } from './civilians';
import { RAG } from './ragdoll';

export const SHUT_ID = 'shutDoor';
/** the row it stands in for on the door tools' page (doortools.ts) */
const STOOD = 'charge';
const K = {
  /** a leaf standing at this angle (rad) or wider, unlatched, is a door that stands open: doortools.ts isOpen's own line (below it the charge's row is the
   *  one on the digit, as it was) */
  open: 0.6,
  /** a living body's reach against a leaf (the door contact's own radius and half a leaf) · the slack kept past it for the place he is sent to · the reach
   *  to the handle from beside the jamb, and at the long reach (a door in a corner) — handleside.ts's numbers for the hand that opens one */
  body: 0.37, slack: 0.1, reach: 0.95, farReach: 1.5, handleIn: 0.14,
  /** metres added to a walk that ends on the other face from the one he should shut it from */
  cross: 4,
  /** seconds: the walk's cap · the last strides onto his place · waiting on a swing somebody stands in · waiting on the leaf once pulled · between two pulls of a leaf that stopped short */
  goCap: 25, settle: 1.5, blockedCap: 4, latchCap: 6, again: 0.8,
  /** his hand stays on the leaf down to this angle (rad), walking it to at pullTo's own speed, and lets it go there: from 0.22 the door's sprung close
   *  lands it on the frame without swinging through (the critically damped case of doors.ts's closing spring at 1.2 rad/s) — about a second and a half
   *  for a leaf stood wide, where one pull and the spring alone take five */
  handTo: 0.22,
};
export const SHUTDOOR_STATS = { given: 0, shut: 0, gaveUp: 0, toFile: 0, stayed: 0 };
/** what happened, newest last (QA) */
export const SHUTDOOR_LOG: { t: number; who: string; door: string; what: string }[] = [];

interface Spot { pos: Vec3; yaw: number; side: 1 | -1; far: boolean }
interface Job { door: Door; spot: Spot; back: boolean; phase: 'go' | 'shut' | 'wait'; t0: number; t: number; pulls: number; moved: number; near?: number }
const jobs = new SideMap<Guard, Job>('shutdoor.jobs');
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ptOf = (d: Door, along: number, off: number, side: 1 | -1): Vec3 => { const F = frameOf(d); return [F.hx + F.ux * along + F.nx * side * off, 0, F.hz + F.uz * along + F.nz * side * off]; };
const handleOf = (d: Door): Vec3 => ptOf(d, d.def.width - K.handleIn, 0, 1);
const note = (g: Game, gd: Guard, d: Door, what: string) => { SHUTDOOR_LOG.push({ t: g.time, who: gd.callsign, door: d.def.name, what }); if (SHUTDOOR_LOG.length > 200) SHUTDOOR_LOG.splice(0, 50); };

/** does d stand open (off its hinges it reads wide open: its row is there, greyed) */
const standsOpen = (d: Door) => !d.latched && Math.abs(d.angle) >= K.open;
/** THE FLOOR THE LEAF CROSSES ON ITS WAY SHUT from where it stands now: the sector about its hinge between the frame and the leaf, and the frame's own
 *  line — with `pad` m of slack (a body's radius). Whichever side it stands open on (the one-way doors off, a leaf may stand on either). */
function inShutSwing(d: Door, x: number, z: number, pad = 0): boolean {
  const F = frameOf(d), px = x - F.hx, pz = z - F.hz, r = Math.hypot(px, pz); if (r > F.W + pad) return false;
  const along = px * F.ux + pz * F.uz, t = Math.max(0, Math.min(F.W, along));
  if (Math.hypot(px - F.ux * t, pz - F.uz * t) <= pad) return true;   // on the frame's line: where the leaf comes to
  const th = wrapAngle(Math.atan2(pz, px) - d.def.closedDir) * (Math.sign(d.angle) || 1);
  return th >= 0 && th <= Math.abs(d.angle);
}
/** a wall, a sill or a pane between two floor points at shin height — the level's statics only */
function walled(g: Game, a: Vec3, b: Vec3): boolean {
  const col = g.col, keep = col.dynamicBoxes; col.dynamicBoxes = [];
  try { return col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]); } finally { col.dynamicBoxes = keep; }
}
/** can a man stand at p: on a cell the walkers' grid calls free, with nothing of the level inside his body */
function stands(g: Game, p: Vec3): boolean {
  if (g.col.nav.isBlocked(p[0], p[2])) return false;
  const q: Vec3 = [p[0], 0, p[2]]; g.col.collideCircle(q, 0.3, 0.2, 1.5); return flat(p, q) < 0.02;
}
/** THE PLACE d is shut from on face `side` (+1 = the CCW side of the closed leaf — orders.ts sideOf), as it stands now: the free floor nearest where its
 *  handle comes to, within reach of it and clear of the leaf's way shut by his body and the slack — beside the latch jamb before in front of the opening
 *  (off the line of whatever is beyond the door); a door in a corner: the nearest floor in front of its handle half, at the long reach. Null: none. */
export function shutSpot(g: Game, d: Door, side: 1 | -1): Spot | null {
  const W = d.def.width, hd = handleOf(d), ref = ptOf(d, W - K.handleIn, 0.2, side), pad = K.body + K.slack;
  const ok = (p: Vec3) => !inShutSwing(d, p[0], p[2], pad) && stands(g, p) && !walled(g, ref, p);
  const face = (p: Vec3) => Math.atan2(hd[0] - p[0], hd[2] - p[2]);
  let best: Vec3 | null = null, bc = Infinity;
  for (let a = W - 0.5; a <= W + 0.8 + 1e-6; a += 0.1) for (let off = 0.4; off <= 1.0 + 1e-6; off += 0.05) {
    const p = ptOf(d, a, off, side), r = flat(p, hd); if (r > K.reach) continue;
    const c = r + (a < W ? 0.25 : 0); if (c >= bc || !ok(p)) continue;
    best = p; bc = c; }
  if (best) return { pos: best, yaw: face(best), side, far: false };
  for (let a = W / 2; a <= W + 0.4 + 1e-6; a += 0.1) for (let off = 0.5; off <= 1.8 + 1e-6; off += 0.05) {
    const p = ptOf(d, a, off, side), r = flat(p, hd); if (r > K.farReach || r >= bc || !ok(p)) continue;
    best = p; bc = r; }
  return best ? { pos: best, yaw: face(best), side, far: true } : null;
}
/** both faces' places for the leaf as it stands — kept for the frame (the menu, `only`, `valid` and `issue` all ask) */
function spotsOf(g: Game, d: Door): (Spot | null)[] {
  const key = `${g.time}|${d.def.name}|${d.angle.toFixed(3)}`, hit = spotted.get(g); if (hit && hit.key === key) return hit.spots;
  const spots = [shutSpot(g, d, 1), shutSpot(g, d, -1)]; spotted.set(g, { key, spots }); return spots;
}
const spotted = new SideMap<Game, { key: string; spots: (Spot | null)[] }>('shutdoor.spotted');
/** the length of his walk to p by the walkers' grid (Infinity: no way) — the plain way: the order runner may take him a longer one round a kept-off room */
function walk(g: Game, gd: Guard, p: Vec3): number {
  const at = gd.char.pos; if (flat(at, p) < 0.5) return flat(at, p);
  const path = g.col.nav.findPath(at, p); if (!path) return Infinity;
  let L = 0, q: Vec3 = at; for (const w of path) { L += flat(q, w); q = w; } return L + flat(q, p);
}
/** was he taken from Sam's file (or from another door of this order's, taken from the file for that one) */
const fromFile = (S: SquadOrders, gd: Guard): boolean => { const A = S.of(gd); return !!A && (A.post === null || (A.order === SHUT_ID && !!jobs.get(gd)?.back)); };
/** WHO SHUTS IT, FROM WHERE: of `men`, the one with the shortest walk to a place it can be shut from — a man of the file from Sam's face of the door, a
 *  posted man from his own, before the other face (K.cross) — or why none of them can. */
function plan(S: SquadOrders, g: Game, d: Door, men: Guard[]): { gd: Guard; spot: Spot } | string {
  const spots = spotsOf(g, d); if (!spots[0] && !spots[1]) return 'no place to shut it from.';
  let out: { gd: Guard; spot: Spot } | null = null, bc = Infinity, why: string | null = null; const sam = sideOf(d, g.player.char.pos);
  for (const gd of men) { const want = fromFile(S, gd) ? sam : sideOf(d, gd.char.pos);
    for (const spot of spots) { if (!spot) continue;
      const c = walk(g, gd, spot.pos) + (spot.side === want ? 0 : K.cross); if (c >= bc) continue;
      const w = S.reach(gd, spot.pos); if (w) { why ??= w; continue; }   // (a door locked against the team on the way: not his walk)
      out = { gd, spot }; bc = c; } }
  return out ?? why ?? "can't get there.";
}

/** who or what is in the leaf's way shut (null: nothing) — Sam, a living man but `but`, a body lying there. `seen`: the menu's question — an enemy the
 *  picture does not show is not given away by a greyed row (the leaf itself meets him all the same: the tick asks without it) */
function inTheWay(g: Game, d: Door, but: Guard | null, seen = false): string | null {
  const P = g.player; if (!P.down && inShutSwing(d, P.char.pos[0], P.char.pos[2], K.body)) return "you're in its way.";
  const body = (c: Guard['char']) => { const rag = c.ragdoll; if (!rag || flat(c.pos, d.frameCentre) > 4) return false;
    return [RAG.pelvis, RAG.spine, RAG.head, RAG.kneeL, RAG.kneeR, RAG.ankL, RAG.ankR].some(i => { const p = rag.point(i); return inShutSwing(d, p[0], p[2], rag.radius(i)); }); };   // (the particles of a body a leaf feels: game.ts's own list)
  for (const m of [...g.guards, ...civiliansShown(g)]) { if (m === but) continue;
    if (m.state === 'dead') { if (body(m.char)) return "a body's in its way."; continue; }
    if (!inShutSwing(d, m.char.pos[0], m.char.pos[2], K.body) || (seen && m.team !== 'operative' && !g.fogOfWar.drawn(m))) continue;
    return m.team === 'operative' ? `${m.callsign} is in its way.` : "somebody's in its way."; }
  return P.down && body(P.char) ? "a body's in its way." : null;
}
/** an enemy somebody of the team has in sight right now THROUGH that doorway (the room fight's own meters — nobody is seen who is not seen; Sam: a clear
 *  line of his own to a man the picture shows) */
function contactThrough(g: Game, d: Door): boolean {
  const sam = g.player;
  for (const h of g.guards) { if (h.state === 'dead' || !isHostile('operative', h.team)) continue;
    for (const m of g.fight.seenBy(h)) if (crossesDoor(m.char.pos, h.char.pos, d)) return true;
    if (!sam.down && crossesDoor(sam.char.pos, h.char.pos, d) && flat(sam.char.pos, h.char.pos) < 30 && g.fogOfWar.drawn(h)
      && !g.col.segmentBlocked([sam.char.pos[0], 1.5, sam.char.pos[2]], [h.char.pos[0], 1.2, h.char.pos[2]])) return true; }
  return false;
}
/** why these men cannot shut that door (null: one of them can) — the row's `valid` */
function whyNotShut(S: SquadOrders, g: Game, d: Door, men: Guard[]): string | null {
  if (d.off) return "it's off its hinges.";
  if (d.latched) return "it's shut.";
  if (!standsOpen(d)) return "it's all but shut.";
  if (contactThrough(g, d)) return 'contact through that door.';
  const P = plan(S, g, d, men); if (typeof P === 'string') return P;
  return inTheWay(g, d, P.gd, true);
}

/** he is sent to a place of the door's (the order given; the leaf moved while he walked) */
function send(S: SquadOrders, gd: Guard, d: Door, spot: Spot) {
  const name = doorWords(d);
  S.assign(gd, { order: SHUT_ID, post: spot.pos, face: spot.yaw, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], door: d, stance: 'none', upper: 'aim', going: `shutting · ${name}`, there: `at · ${name}` });
}
/** his hand on it: the leaf is pulled to (doors.ts pullTo — the sprung close its latch catches). A hand is a touch: a leaf somebody propped (the closer held
 *  off: Door.quietT far below zero, which the latch waits on) is let go of. */
function pull(g: Game, d: Door, gd: Guard) { if (d.quietT < 0) d.quietT = 0; g.doors.pullTo(d, gd.char.id); }
/** his order is over: back into the file if that is where he was taken from (its last place: the runner closes the file up), else he holds where he
 *  stands, by the door */
function finish(S: SquadOrders, gd: Guard, J: Job | undefined) {
  jobs.delete(gd); const p = gd.char.pos;
  if (J?.back) { S.assign(gd, { order: 'fallIn', post: null, follow: 99, face: null, going: 'falling in', there: 'with you' }); SHUTDOOR_STATS.toFile++; return; }
  S.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: gd.char.bodyYaw, going: 'holding', there: J ? `holding · by ${doorWords(J.door)}` : 'holding' }); SHUTDOOR_STATS.stayed++;
}
/** the order's stages, once a frame for its man before he is posed (OrderDef.tick) */
function tick(S: SquadOrders, g: Game, gd: Guard, A: Assignment) {
  const J = jobs.get(gd); if (!J || A.door !== J.door) { finish(S, gd, undefined); return; }   // (a guard: the order's issue sets both)
  const d = J.door, p = gd.char.pos, t = g.time;
  const end = (line: string | null, what: string, shut = false) => { if (line) g.say(gd, line); note(g, gd, d, what); if (shut) SHUTDOOR_STATS.shut++; else SHUTDOOR_STATS.gaveUp++; finish(S, gd, J); };
  if (d.off) { end("door's gone.", 'off its hinges'); return; }
  if (d.latched) { end(J.phase === 'go' ? "it's shut." : "door's shut.", J.phase === 'go' ? 'shut before he got there' : `shut · ${(t - J.t0).toFixed(1)} s`, true); return; }
  const clearOf = () => !inShutSwing(d, p[0], p[2], K.body);
  if (J.phase === 'go') {
    const stopped = !A.post || flat(A.post, J.spot.pos) > 0.05;   // (the runner has called his walk off and told Sam so — somebody stands on his place, the way is shut: orders.ts's stuck rule)
    const there = !stopped && flat(p, J.spot.pos) < 0.4;
    if (!stopped && !there && t - J.t0 <= K.goCap) return;
    if (there && !clearOf() && t - (J.near ??= t) < K.settle) return;   // (the last strides to his place, out of the leaf's way)
    if (!(there && clearOf())) {
      // at his place and in the leaf's way: it was moved while he walked — the place for the leaf as it stands now, once or twice
      const now = there && J.moved < 2 ? shutSpot(g, d, J.spot.side) : null;
      if (now && flat(now.pos, J.spot.pos) > 0.3) { J.moved++; J.spot = now; J.near = undefined; send(S, gd, d, now); note(g, gd, d, `the leaf moved: sent on to (${now.pos[0].toFixed(2)}, ${now.pos[2].toFixed(2)})`); return; }
      // else from where he stands, if that is a place to shut it from
      const ok = sideOf(d, p) === J.spot.side && flat(p, handleOf(d)) <= K.farReach && clearOf() && !walled(g, p, ptOf(d, d.def.width - K.handleIn, 0.2, J.spot.side));
      if (!ok) { end(stopped ? null : "can't get to it.", stopped ? 'stopped short of his place' : there ? 'no place clear of the leaf as it stands now' : 'never got to his place'); return; } }
    J.phase = 'shut'; J.t = t;
  }
  const hd = handleOf(d); A.face = Math.atan2(hd[0] - p[0], hd[2] - p[2]); A.watch = null;   // squared up to the handle, the gun off the leaf that is coming
  if (J.phase === 'shut') {
    const way = inTheWay(g, d, gd);
    if (way || !clearOf()) { if (t - J.t > K.blockedCap) end("can't shut it.", way ?? 'in its swing himself'); return; }
    if (Math.abs(wrapAngle(gd.char.bodyYaw - A.face)) > 0.6 && t - J.t < 0.5) return;
    pull(g, d, gd); J.pulls++; J.phase = 'wait'; J.t = t; note(g, gd, d, `pulls it to from ${J.spot.side === (Math.sign(d.angle) || 1) ? "the leaf's face" : 'the other face'}${J.spot.far ? ', at the long reach' : ''}`);
    return;
  }
  // wait: the leaf comes to and the latch catches it. One that somebody stopped is pulled again, a few times, while its way is clear
  if (t - J.t > K.latchCap) { end("it won't shut.", 'the leaf never latched'); return; }
  if (!d.closing) { if (t - J.t > K.again && J.pulls < 4 && !inTheWay(g, d, gd) && clearOf()) { pull(g, d, gd); J.pulls++; J.t = t; } }
  else if (Math.abs(d.angle) > K.handTo && !inTheWay(g, d, gd)) pull(g, d, gd);   // (never against a body it has come to rest on: the leaf settles there, as it does for anybody)
}

/** The row, on the door tools' page in the charge's place while the door stands open (Game's constructor, after the door tools have registered theirs). */
export function registerShutDoor(g: Game) {
  const def: OrderDef = { id: SHUT_ID, label: 'shut that door', targets: ['door'], ack: ['shutting it.', 'got the door.'],
    standsIn: { for: STOOD, when: (_S, t) => t.kind === 'door' && standsOpen(t.door) && !g.doorTools.chargeOn(t.door) },
    // (where nobody can, the men as addressed go on to `valid`, which says why)
    only: (S, men, t) => { if (t.kind !== 'door' || t.door.off || !standsOpen(t.door)) return men; const P = plan(S, g, t.door, men); return typeof P === 'string' ? men : [P.gd]; },
    valid: (S, t, men) => t.kind === 'door' ? whyNotShut(S, g, t.door, men) ?? true : false,
    issue: (S, men, t) => {
      if (t.kind !== 'door') return 'no door';
      const P = plan(S, g, t.door, men); if (typeof P === 'string') return P;
      const { gd, spot } = P, d = t.door, back = fromFile(S, gd);
      send(S, gd, d, spot);
      jobs.set(gd, { door: d, spot, back, phase: 'go', t0: g.time, t: g.time, pulls: 0, moved: 0 }); SHUTDOOR_STATS.given++;
      note(g, gd, d, `sent to (${spot.pos[0].toFixed(2)}, ${spot.pos[2].toFixed(2)}) on its ${spot.side > 0 ? '+' : '−'} face${back ? ' · from the file' : ''}`);
    },
    tick: (S, gd, A) => tick(S, g, gd, A) };
  g.orders.register(def);
}
