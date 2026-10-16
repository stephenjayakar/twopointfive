// THE HANDLE SIDE: an AI man who opens a door first gets to its HANDLE jamb on his own face of it and works it from there. The maintainer, 10-08: "doors could
// use some work too … open has to be on the handle side for AI". Measured on the build before this file (tools/qa/handle-watch.ts over the loud levels): a man
// on foot walked at the middle of the leaf and opened it with his body wherever his path met it — and on the face a one-way leaf opens INTO (doors.ts DOORWAY:
// the pull face) that leaf then came round THROUGH him (Door.pullT: the pass-through the one-way doors left for this file to end); a stack with no floor at
// the latch jamb shoved the leaf from the hinge jamb, a leaf's length from its handle.
// Three rules, for every man of the AI on foot — the squad, the defenders, the night's staff and the QRF alike; the PLAYER is not bound by any of it:
//   PUSH  (handleGate, asked by followPath / the scripted strafe): the walk of a man whose way goes through a leaf standing in it, on the face it opens AWAY
//         from, is bent to the handle half of the frame (`pushIn` in from the latch jamb) and, a stride short, his feet are put on that line: his hand meets
//         the leaf by its handle, not by its hinge.
//   PULL  (the same gate): on the face it opens INTO he leaves his walk a few metres short, goes to a place BESIDE THE LATCH JAMB — within `reach` of the
//         handle and clear of everything the leaf sweeps (doors.swingOf(d).sweeps, with his body's radius) — turns to the handle, pulls the leaf round past
//         himself (it does not touch him: he is not where it swings) and walks on once it stands clear. One man has a door at a time; a man of his whose own
//         walk would take him into that swing meanwhile stops short of it. A door hard in a corner — no floor beside its latch jamb — is pulled at the
//         LONG REACH: from the nearest floor in front of its handle half that its leaf does not sweep (up to `farReach` from the handle: an arm and a
//         lean — a place the leaf would come round through is no place). No floor even for that: he opens it as he did before (HANDLE_STATS.noSpot).
//   TOOLS (toolSpot, asked by doortools.ts when a door order's lead is about to open the door by hand): the lead who is not at the handle — a stack filed on
//         the hinge jamb, a jamb mark out of reach, or standing where the leaf will come round — steps to the handle's place first and shoves it from there
//         (the walk the boot's own man makes to his kick spot, and the same way back onto his jamb).
//         A SQUAD DOOR ORDER'S lead, on the face the leaf opens away from (HANDLE.toolNear, nearStand): that place is in the middle of the opening, on the
//         line of every gun in the room — he steps toward the handle only as far as his arm needs and keeps his body past the latch jamb.
// A KICK is taken from where the kick already stands (by the lock: doors.ts kickSpot); a door off its hinges, one standing open, one locked against the man
// and one somebody is already swinging are nobody's to work. Nothing here runs with the one-way doors off (DOORWAY.oneWay — the harness's frozen runs), under
// a showcase (Game.touring: its men are choreographed), or with HANDLE.on off: the build as it was, digest for digest.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { Vec3, clamp, damp, approachAngle, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import { DOORWAY, type Door } from './doors';
import { frameOf, crossesDoor, teamLean } from './guards';
import { silentEase } from './silent';

export const HANDLE = {
  /** THE switch: off = the build before this file, by run digest (its rules under it, each off = that rule as it was) */
  on: true, push: true, pull: true, tools: true,
  /** metres of his walk ahead looked along for a leaf in his way; a leaf standing less open than `ajar` rad is in his way (doors.ts: under it a man on the
   *  pull face 'presses' it) */
  look: 2.6, ajar: 1.35,
  /** within this of the handle (floor metres, his middle to it) is 'at the handle' — the handle sits `handleIn` short of the latch jamb; a door in a corner
   *  is pulled from up to `farReach` */
  reach: 0.95, handleIn: 0.14, farReach: 1.5,
  /** PUSH: the line a walker goes through the opening on — metres in from the latch jamb; he squares up to it `pushOff` off the leaf and goes on to
   *  `pushThru` beyond the frame — and inside `thruAt` m of the line his feet are put ON it, `thruOff` off the leaf, before he goes through (a walk's own
   *  corner-cutting crossed the hinge half). `pushIn` 0.33 since the doors are real size (scene/doorSize.ts; 0.42 at the 1.16 m leaves): hard by the latch
   *  stop, because a man who comes to that line from the latch jamb — where he pulled the leaf from — overshoots it a hand toward the leaf, and a leaf
   *  standing square on a side wall's stop is the one thing in the opening he must not touch. A man who STANDS to shove it (a door order's lead) stands `standIn` in from the jamb, `standOff` off the leaf */
  pushIn: 0.33, pushOff: 0.85, pushThru: 0.35, standIn: 0.3, standOff: 0.6, thruAt: 1.2, thruOff: 0.75,
  /** PULL: his body's radius, and the slack kept between it and the leaf's sweep; the leaf is his once he is within `near` of his place */
  body: 0.34, slack: 0.1, near: 0.05,
  /** … he turns to the handle (this long at most), pulls (doors.ts pull), and walks on when the leaf stands `clear` rad open, has stopped, or after `wait` s; a leaf standing
   *  `clear` open on that face wants no hand. `press`: seconds a man leaning on a leaf from that face, with no walk to its handle, takes to pull it as before */
  turn: 0.35, clear: 1.05, wait: 1.1, press: 1.5,
  /** TOOLS, the face it opens AWAY from: a door order's lead standing past the latch jamb within this of the handle shoves it from where he stands, at arm's
   *  length, and does not step in front of the opening for it (his jamb mark is 1.1 m from the handle: the walk put him in the doorway for the shove and
   *  through the toss of a bang). 0 = he steps to the handle's place first, as this file first had it */
  toolPost: 0,
  /** TOOLS, the face it opens AWAY from — THE LEAD NEVER STANDS IN THE OPENING TO WORK THE HANDLE (off = he walks to the handle's place, `standIn` inside the
   *  latch jamb: in front of the opening, on the line of every gun in the room, for the shove and his first step back). On: he steps from his mark toward the
   *  handle only as far as his arm needs — to the point of that line `reach` − 0.07 from the handle (the distance this file already calls 'at the handle') —
   *  and never nearer the opening than his body (`nearBody`) past the latch jamb: a point short of that is moved out along the wall to it, still within reach.
   *  No free floor there: he works it from his mark when that is past the jamb and within `nearPost` of the handle; only then the handle's old place. */
  toolNear: false, nearBody: 0.38, nearPost: 1.3,   // (nearBody: his MIDDLE that far past the jamb — his body's radius, `body` 0.34, and 4 cm: none of him in the opening's corridor)
  /** seconds a walk to the place may take before he gives it up; seconds before he tries that door by the handle again */
  goCap: 4, rest: 2.5,
};
export const HANDLE_STATS = { bent: 0, lined: 0, pulls: 0, farPulls: 0, noSpot: 0, gaveUp: 0, held: 0, toolWalks: 0, toolNoSpot: 0, toolNears: 0, toolPosts: 0 };
export const HANDLE_DEBUG: { log: ((s: string) => void) | null } = { log: null };

interface St { door: Door; side: 1 | -1; spot: Vec3; phase: 'thru' | 'go' | 'turn' | 'wait'; t: number; seen: number; way?: Vec3[]; at?: Vec3; atT?: number }
const states = new WeakMap<Guard, St>();
/** the leaf a man has in hand (one man a door), and when each man last gave a door up */
const hands = new WeakMap<Door, Guard>();
const rested = new WeakMap<Guard, { door: Door; until: number }>();
const lined = new WeakMap<Guard, { door: Door; until: number }>();
/** a face's places: `stand` where a man works the handle from (`far`: at the long reach), `via` the two points of a walk through the opening's handle half
 *  from this face (square up, then beyond the frame) — null where the level leaves no floor for it */
interface Spot { pos: Vec3; yaw: number; pull: boolean; far?: boolean }
interface Face { stand: Spot | null; via: [Vec3, Vec3] | null }
const faces = new WeakMap<Door, { col: unknown; swing: number; at: [Face | undefined, Face | undefined] }>();

/** (not under a showcase: its men are choreographed to the frame, and no harness run plays one with the one-way doors on) */
const live = (g: Game) => HANDLE.on && DOORWAY.oneWay && !g.touring;
/** a man's place at a door is his only while he keeps coming for it: one the gate has not been asked about for half a second (his errand changed, he fell, the
 *  encounter was dealt again, the clock went back on a load) is nobody's */
const fresh = (g: Game, st: St | undefined): st is St => !!st && g.time >= st.seen && g.time - st.seen < 0.5;
const sideAt = (d: Door, p: Vec3): 1 | -1 => { const F = frameOf(d); return (p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz >= 0 ? 1 : -1; };
const offAt = (d: Door, p: Vec3): number => { const F = frameOf(d); return Math.abs((p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz); };
const ptOf = (d: Door, along: number, off: number, side: 1 | -1): Vec3 => { const F = frameOf(d); return [F.hx + F.ux * along + F.nx * side * off, 0, F.hz + F.uz * along + F.nz * side * off]; };
/** the handle, on the floor */
export const handleAt = (d: Door): Vec3 => ptOf(d, d.def.width - HANDLE.handleIn, 0, 1);
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** a wall, a sill or a pane between two floor points at shin height — the level's statics only (a leaf is what he is there to move) */
function walled(g: Game, a: Vec3, b: Vec3): boolean {
  const col = g.col as unknown as { dynamicBoxes: unknown[]; solidBlocked(a: Vec3, b: Vec3): boolean }, keep = col.dynamicBoxes; col.dynamicBoxes = [];
  try { return col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]); } finally { col.dynamicBoxes = keep; }
}
/** can a man stand at p: nothing of the level inside his body there (and, `nav`, on a cell the walkers' grid calls free) */
function stands(g: Game, p: Vec3, nav = false): boolean {
  if (nav && g.col.nav.isBlocked(p[0], p[2])) return false;
  const q: Vec3 = [p[0], 0, p[2]]; g.col.collideCircle(q, 0.3, 0.2, 1.5); return flat(p, q) < 0.02;
}
/** is `p` AT THE HANDLE of d: on the handle half of the frame, within reach of the handle, and — on the face it opens into — clear of the leaf's sweep */
export function atHandle(g: Game, d: Door, p: Vec3, reach = HANDLE.reach + 0.05): boolean {
  const F = frameOf(d), along = (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz;
  if (along < F.W / 2 || flat(p, handleAt(d)) > reach) return false;
  return !(g.doors.pullFace(d, p) && g.doors.swingOf(d).sweeps(p[0], p[2], HANDLE.body));
}
function faceOf(g: Game, d: Door, side: 1 | -1): Face {
  let C = faces.get(d); if (!C || C.col !== g.col || C.swing !== d.swing) faces.set(d, C = { col: g.col, swing: d.swing, at: [undefined, undefined] });   // (the level's floor and walls, the side it opens into: found once a face)
  return C.at[side > 0 ? 0 : 1] ??= findFace(g, d, side);
}
/** THE PLACE a man works d's handle from on face `side` (+1 = the CCW side of the closed leaf), or null where that face has none.
 *  The face it opens away from: in front of the handle, `standIn` in from the latch jamb. The face it opens into: the free floor nearest the handle that is
 *  within reach of it and clear of the sweep by his body and `slack` — beside the latch jamb, where the level leaves floor there; else the long reach. */
export function handleSpot(g: Game, d: Door, side: 1 | -1): Spot | null { return faceOf(g, d, side).stand; }
function findFace(g: Game, d: Door, side: 1 | -1): Face {
  const K = HANDLE, W = d.def.width, hd = handleAt(d), ref = ptOf(d, W - K.handleIn, 0.2, side);
  const pull = g.doors.pullFace(d, ptOf(d, W / 2, 0.5, side));
  const face = (p: Vec3) => Math.atan2(hd[0] - p[0], hd[2] - p[2]);
  const ok = (p: Vec3, nav = false) => stands(g, p, nav) && !walled(g, ref, p);
  let via: [Vec3, Vec3] | null = null;
  for (const inn of [K.pushIn, K.pushIn + 0.08, K.pushIn + 0.16]) { const a = clamp(W - inn, W / 2, W), A = ptOf(d, a, K.pushOff, side), B = ptOf(d, a, K.pushThru, -side as 1 | -1);
    if (ok(A) && stands(g, B) && !walled(g, A, B)) { via = [A, B]; break; } }
  let stand: Spot | null = null;
  if (!pull) {
    search: for (const inn of [K.standIn, K.standIn + 0.08, K.standIn + 0.16, K.standIn + 0.24]) for (const off of [K.standOff, K.standOff + 0.12]) {
      const p = ptOf(d, clamp(W - inn, W / 2, W), off, side); if (ok(p)) { stand = { pos: p, yaw: face(p), pull }; break search; } }
    return { stand, via };
  }
  const S = g.doors.swingOf(d); let best: Vec3 | null = null, bc = Infinity;
  for (let a = W - 0.5; a <= W + 0.8 + 1e-6; a += 0.1) for (let off = 0.4; off <= 1.0 + 1e-6; off += 0.05) {
    const p = ptOf(d, a, off, side), r = flat(p, hd); if (r > K.reach) continue;
    const c = r + (a < W ? 0.25 : 0);   // (beside the jamb before in front of the opening: off the line of whatever is behind the door)
    if (c >= bc || S.sweeps(p[0], p[2], K.body + K.slack) || !ok(p, true)) continue;
    best = p; bc = c; }
  if (best) return { stand: { pos: best, yaw: face(best), pull }, via };
  // a door in a corner: the nearest floor to its handle that the leaf does not sweep, in front of its handle half — the long reach
  for (let a = W / 2; a <= W + 0.4 + 1e-6; a += 0.1) for (let off = 0.5; off <= 1.8 + 1e-6; off += 0.05) {
    const p = ptOf(d, a, off, side), r = flat(p, hd); if (r > K.farReach || r >= bc) continue;
    if (S.sweeps(p[0], p[2], K.body + K.slack) || !ok(p)) continue;
    best = p; bc = r; }
  return { stand: best ? { pos: best, yaw: face(best), pull, far: true } : null, via };
}
/** the angle under which a leaf stands in a man's way (doors.ts's own 'presses' rule: short of 1.35 rad, or of 0.8 of a stop nearer than that) */
const ajarOf = (g: Game, d: Door) => Math.min(HANDLE.ajar, 0.8 * g.doors.swingOf(d).open);
/** a leaf that wants a hand from `gd` standing at `from`: in his way, on its hinges, not locked against him, and nobody's already */
function wantsHand(g: Game, gd: Guard, d: Door, from: Vec3): boolean {
  if (gd.team === 'civilian') return false;   // (the cleaner, a hostage: not the AI's men — they push and pull as they did)
  if ((d as { off?: boolean }).off) return false;   // (off its hinges: an open doorway)
  if (!d.latched && d.angle * d.swing >= (g.doors.pullFace(d, from) ? Math.min(HANDLE.clear, ajarOf(g, d)) : ajarOf(g, d))) return false;   // (open enough to walk through: from the face it opens into, once the handle half of the opening is clear of it)
  if (!d.latched && (d.pullT > 0 || d.vel * d.swing > 0.5)) return false;   // (somebody is swinging it open now)
  if (gd.team === 'operative') { const P = g.player; if (g.doors.lockedOut(d, from, P.codes.size ? new Set([...P.keys, ...P.codes]) : P.keys)) return false; }   // (locked against the team: the door tools' boot, the pick — not a hand)
  return true;
}
/** the first leaf his walk goes through within `look` metres: the door, the index of the first waypoint beyond its frame, where his walk cuts the frame */
function ahead(g: Game, gd: Guard): { d: Door; k: number; at: Vec3; dist: number } | null {
  let a = gd.char.pos, len = 0;
  for (let k = gd.pathI; k < gd.path.length && len < HANDLE.look; k++) { const b = gd.path[k], seg = flat(a, b);
    for (const d of g.doors.list) { if (Math.abs(d.frameCentre[0] - a[0]) > seg + 2 || Math.abs(d.frameCentre[2] - a[2]) > seg + 2) continue;
      const x = crossesDoor(a, b, d); if (x) { const dist = len + seg * x.t; return dist <= HANDLE.look ? { d, k, at: x.at, dist } : null; } }
    len += seg; a = b; }
  return null;
}
function release(gd: Guard, st: St, rest: boolean, g: Game) { states.delete(gd); if (hands.get(st.door) === gd) hands.delete(st.door); if (rest) rested.set(gd, { door: st.door, until: g.time + HANDLE.rest }); }
/** his hand on the leaf from the face it opens into: doors.ts pull — unlatched with its creak and brought round toward him, as his shoulder on it did before */
function pullOpen(g: Game, gd: Guard, d: Door, far: boolean) {
  g.doors.pull(d, gd.char.id, silentEase(g, gd));
  HANDLE_STATS.pulls++; if (far) HANDLE_STATS.farPulls++; HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: ${gd.callsign} pulls it from ${far ? 'the long reach' : 'the latch jamb'}`);
}
/** his walk through door A.d bent onto the handle half's line — square up at `a`, then `b` beyond the frame, then on as it went (a walk already on that
 *  line, or a man already between it and the leaf, is left: the bend is made once) */
function bend(gd: Guard, d: Door, A: { k: number }, a: Vec3, b: Vec3): boolean {
  const c = gd.char.pos;
  if (flat(c, a) < 0.3 || offAt(d, c) < offAt(d, a) - 0.05 || gd.path.slice(gd.pathI, A.k + 1).some(p => flat(p, b) < 0.2)) return false;
  const rest = gd.path.slice(A.k); while (rest.length > 1 && flat(rest[0], b) < 0.7) rest.shift();   // (the walk's own first step beyond the frame is this one)
  gd.path = [a, b, ...rest]; gd.pathI = 0; return true;
}
const halt = (gd: Guard, dt: number) => { const c = gd.char; gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0]; gd.lastPos = [c.pos[0], c.pos[1], c.pos[2]]; gd.stuckT = 0; };

/** THE GATE (the first thing followPath and the scripted strafe ask, after their own): true = this file has his feet this frame — he is on his way to a
 *  leaf's handle, or working it, or keeping out of the swing of one a man of his is working. `strafe`: his body is somebody else's to turn (the script's
 *  face, the fight's): he side-steps there and does not square up. */
export function handleGate(g: Game, gd: Guard, dt: number, speed: number, strafe = false): boolean {
  const mine = gate(g, gd, dt, speed, strafe); if (mine) feet.set(gd, g.time); return mine;
}
/** when the gate last had each man's feet (game clock) — `handleHeld`'s memory, read by nothing in this file */
const feet = new WeakMap<Guard, number>();
/** did this file have his feet this frame or the last: on his way to a leaf's handle, working it, or stood off the swing of one a man of his is working — a
 *  read for whoever counts how long a man has been 'getting nowhere' (an order's stuck clock): time spent here is a door being opened, not a man stuck */
export function handleHeld(g: Game, gd: Guard): boolean { const t = feet.get(gd); return t !== undefined && g.time >= t && g.time - t < 0.05; }
function gate(g: Game, gd: Guard, dt: number, speed: number, strafe: boolean): boolean {
  if (!live(g)) return false;
  const K = HANDLE, c = gd.char; let st = states.get(gd);
  if (st && !fresh(g, st)) { release(gd, st, false, g); st = undefined; }
  if (!st) {
    if (gd.pathI >= gd.path.length) return false;
    const A = ahead(g, gd); if (!A) return false;
    const d = A.d, side = sideAt(d, c.pos), mine = hands.get(d), pull = g.doors.pullFace(d, c.pos);
    const theirs = mine && mine !== gd && mine.state !== 'dead' ? states.get(mine) : undefined;
    if (fresh(g, theirs) && theirs.door === d) {   // a man of his has that leaf in hand: he keeps out of where it is coming round
      if (!pull || !wantsHand(g, gd, d, c.pos)) return false;
      const S = g.doors.swingOf(d), F = frameOf(d), pad = K.body + 0.1;
      if (S.sweeps(c.pos[0], c.pos[2], pad)) {   // (in it already: a step straight back off the door, where there is floor)
        const bx = c.pos[0] + F.nx * side * 0.3, bz = c.pos[2] + F.nz * side * 0.3;
        if (!g.col.nav.isBlocked(bx, bz)) { const v = Math.min(speed, 1.3); c.vel = [F.nx * side * v, 0, F.nz * side * v]; c.pos = [c.pos[0] + c.vel[0] * dt, c.pos[1], c.pos[2] + c.vel[2] * dt]; gd.speed = v; gd.lastPos = [c.pos[0], c.pos[1], c.pos[2]]; gd.stuckT = 0; HANDLE_STATS.held++; return true; }
        halt(gd, dt); HANDLE_STATS.held++; return true; }
      const wp = gd.path[gd.pathI], dx = wp[0] - c.pos[0], dz = wp[2] - c.pos[2], L = Math.hypot(dx, dz) || 1;
      if (S.sweeps(c.pos[0] + dx / L * 0.25, c.pos[2] + dz / L * 0.25, pad)) { halt(gd, dt); HANDLE_STATS.held++; return true; }
      return false; }
    const R = rested.get(gd); if (R && R.door === d && g.time < R.until) return false;
    if (pull ? !K.pull : !K.push) return false;
    const F = faceOf(g, d, side);
    const L = lined.get(gd), line = (): boolean => {   // his walk through the handle half: bent onto its line from afar, his feet put on it up close
      if (!F.via || (L && L.door === d && g.time < L.until) || offAt(d, c.pos) < 0.25) return false;
      const F0 = frameOf(d), a = (F.via[0][0] - F0.hx) * F0.ux + (F.via[0][2] - F0.hz) * F0.uz, on = ptOf(d, a, clamp(offAt(d, c.pos), K.thruOff, K.pushOff), side);
      if (A.dist < K.thruAt + 0.4 && flat(c.pos, on) < K.thruAt && !walled(g, c.pos, on)) { st = { door: d, side, spot: on, phase: 'thru', t: 0, seen: g.time }; states.set(gd, st); return true; }
      if (!walled(g, c.pos, F.via[0]) && bend(gd, d, A, F.via[0], F.via[1])) HANDLE_STATS.bent++;
      return false; };
    if (!wantsHand(g, gd, d, c.pos)) {   // (it stands open: from the face it opens into he still goes through the half its handle left — the leaf's edge stands over the other)
      if (!(pull && !d.off && !d.latched && d.angle * d.swing < K.ajar + 0.1 && gd.team !== 'civilian' && line())) return false; }   // (off its hinges: an empty frame, whatever angle the record reads)
    else if (offAt(d, c.pos) < 0.25) return false;   // (in the frame itself: he is through it already)
    else {
    if (!pull) { if (!line()) return false; }   // PUSH: his walk goes through the handle half — the leaf is met by its handle, on his way through
    else {
    const H = F.stand;
    if (!H) { HANDLE_STATS.noSpot++; rested.set(gd, { door: d, until: g.time + K.rest }); HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: no place at the handle on ${gd.callsign}'s face`); return false; }
    const way = wayTo(g, c.pos, H.pos);   // (the floor's own way there: round a corner of the frame, a pillar by the jamb)
    if (!way) { const near = walled(g, c.pos, H.pos); if (!near) HANDLE_STATS.noSpot++; rested.set(gd, { door: d, until: g.time + (near ? 0.5 : K.rest) }); return false; }   // (no way there — or not yet: round the corner first, his own walk brings him nearer, and he is asked again in half a second)
    st = { door: d, side, spot: H.pos, phase: 'go', t: 0, seen: g.time, way }; states.set(gd, st); hands.set(d, gd);
    HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: ${gd.callsign} at (${c.pos[0].toFixed(2)}, ${c.pos[2].toFixed(2)}) goes for its handle at (${H.pos[0].toFixed(2)}, ${H.pos[2].toFixed(2)}) · leaf ${(d.angle * d.swing).toFixed(2)} rad${d.latched ? ' latched' : ''}`);
    } }
    if (!st) return false;
  }
  const d = st.door; st.t += dt; st.seen = g.time;
  if (st.phase === 'thru') {   // onto the line through the handle half, then straight through
    if (speed < 0.05) { halt(gd, dt); st.t -= dt; return true; }   // (whoever moves him wants him still this frame)
    if (st.t < 2 && !stepTo(g, gd, st.spot, dt, speed, strafe, true)) return true;
    const A = ahead(g, gd), via = faceOf(g, d, st.side).via;
    if (A && A.d === d && via) { const rest = gd.path.slice(A.k); while (rest.length > 1 && flat(rest[0], via[1]) < 0.7) rest.shift(); gd.path = [via[1], ...rest]; gd.pathI = 0; HANDLE_STATS.lined++; }
    lined.set(gd, { door: d, until: g.time + 1.5 }); states.delete(gd); return false;
  }
  if (st.phase === 'go') {
    if (!wantsHand(g, gd, d, c.pos)) { release(gd, st, false, g); return false; }   // (somebody opened it meanwhile)
    if (speed < 0.05) { halt(gd, dt); st.t -= dt; return true; }   // (whoever moves him wants him still this frame: he waits where he is)
    if (!st.at || st.t - st.atT! > 0.6) { const stalled = !!st.at && flat(st.at, c.pos) < 0.08; st.at = [c.pos[0], 0, c.pos[2]]; st.atT = st.t;
      if (stalled || st.t > K.goCap || sideAt(d, c.pos) !== st.side) {   // not getting there (a man of his on it, a chair): he takes it at the long reach from where he is, if that is no place its leaf comes round through — else he gives its handle up
        const F = frameOf(d), along = (c.pos[0] - F.hx) * F.ux + (c.pos[2] - F.hz) * F.uz, hd = handleAt(d);
        const close = flat(c.pos, st.spot) < 0.3;   // (a man of his shoulder to shoulder with him at the jamb: as good as there — the leaf's edge may brush him)
        if (!(sideAt(d, c.pos) === st.side && along >= F.W / 2 && flat(c.pos, hd) <= K.farReach && !g.doors.swingOf(d).sweeps(c.pos[0], c.pos[2], close ? K.body - 0.08 : K.body + 0.05) && !walled(g, c.pos, ptOf(d, F.W - K.handleIn, 0.2, st.side)))) {
          HANDLE_STATS.gaveUp++; HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: ${gd.callsign} gives its handle up ${flat(c.pos, st.spot).toFixed(2)} m short`); release(gd, st, true, g); return false; }
        st.way = []; } }
    const way = st.way!; while (way.length > 1 && flat(c.pos, way[0]) < 0.3) way.shift();
    if (way.length > 1) { stepTo(g, gd, way[0], dt, speed, strafe, true); return true; }
    if (way.length && !stepTo(g, gd, st.spot, dt, speed, strafe)) return true;
    st.phase = 'turn'; st.t = 0;
  }
  halt(gd, dt);
  const hd = handleAt(d), yaw = Math.atan2(hd[0] - c.pos[0], hd[2] - c.pos[2]), open = d.angle * d.swing, ajar = ajarOf(g, d), far = flat(c.pos, hd) > K.reach + 0.05;
  if (st.phase === 'turn') {
    if (!wantsHand(g, gd, d, c.pos)) { release(gd, st, false, g); return false; }
    if (!strafe) c.bodyYaw = approachAngle(c.bodyYaw, yaw, 7 * dt);
    if (!strafe && st.t < K.turn && Math.abs(wrapAngle(yaw - c.bodyYaw)) > 0.6) return true;
    pullOpen(g, gd, d, far); st.phase = 'wait'; st.t = 0; return true;
  }
  // wait: the leaf comes round past him. His hand stays on it while the handle is in his reach and it would not yet carry clear of the doorway by itself (a
  // quiet hand's slow pull: doors.ts's friction, e^(−2.2 t)); he walks on — round to the front of the opening, then through — once it stands clear.
  if (!strafe) c.bodyYaw = approachAngle(c.bodyYaw, yaw, 7 * dt);
  if (open < Math.min(K.clear, ajar) && !(st.t > 0.3 && Math.abs(d.vel) < 0.4) && st.t < K.wait) {
    const u = d.dir(), hx = d.def.hinge[0] + u[0] * (d.def.width - K.handleIn), hz = d.def.hinge[1] + u[1] * (d.def.width - K.handleIn);
    if (open + Math.abs(d.vel) / 2.2 < ajar + 0.05 && (far || Math.hypot(hx - c.pos[0], hz - c.pos[2]) < K.reach + 0.1)) g.doors.pull(d, c.id, silentEase(g, gd));
    return true; }
  const A = ahead(g, gd), via = faceOf(g, d, st.side).via, clearNow = open >= Math.min(K.clear, ajar);
  if (clearNow && A && A.d === d && via) {   // … onto the line through the handle half, as any man goes through one standing open (the leaf is let go of: the next man's)
    const F0 = frameOf(d), a = (via[0][0] - F0.hx) * F0.ux + (via[0][2] - F0.hz) * F0.uz;
    if (hands.get(d) === gd) hands.delete(d);
    st.phase = 'thru'; st.t = 0; st.spot = ptOf(d, a, clamp(offAt(d, c.pos), K.thruOff, K.pushOff), st.side); return true; }
  release(gd, st, !clearNow, g); return false;
}
/** the walk from `a` to a place at a handle: straight where the floor lets a man through, else the walkers' own way round — null when that is no short way
 *  (through another door, round a wall: it is not his place to take from here) */
function wayTo(g: Game, a: Vec3, to: Vec3): Vec3[] | null {
  const nav = g.col.nav, d = flat(a, to);
  if (d < 0.5 || nav.walkable(a, to)) return [to];
  const p = nav.findPath(a, to, 1500); if (!p) return null;
  let len = 0; for (let i = 0, q = a; i < p.length; q = p[i++]) len += flat(q, p[i]);
  if (len > d * 2 + 1.5) return null;
  if (flat(p[p.length - 1], to) < 0.4) p.pop();
  return [...p, to];
}
/** a man's feet taken the last of the way onto `to` (straight at it inside a stride — he does not circle it): true once he stands on it */
function stepTo(g: Game, gd: Guard, to: Vec3, dt: number, speed: number, strafe: boolean, pass = false): boolean {
  const c = gd.char, dx = to[0] - c.pos[0], dz = to[2] - c.pos[2], dist = Math.hypot(dx, dz);
  if (dist <= (pass ? 0.08 : HANDLE.near)) return true;
  const was = gd.speed, want = speed * (pass ? clamp(dist / 0.3, 0.6, 1) : clamp(dist / 0.6, 0.3, 1));   // (`pass`: a point he walks through, not one he stops on)
  if (strafe || dist < 0.35) { gd.speed = damp(gd.speed, want, 4, dt); teamLean(g, gd, was, dt); c.vel = [dx / dist * gd.speed, 0, dz / dist * gd.speed]; }
  else { const yaw = Math.atan2(dx, dz), facing = Math.cos(wrapAngle(yaw - c.bodyYaw));
    gd.speed = damp(gd.speed, want * clamp(facing * 1.5, 0.15, 1), 4, dt); teamLean(g, gd, was, dt);
    c.bodyYaw = approachAngle(c.bodyYaw, yaw, 5.5 * dt); c.vel = [Math.sin(c.bodyYaw) * gd.speed, 0, Math.cos(c.bodyYaw) * gd.speed]; }
  const step = Math.min(dist, Math.max(gd.speed, 0.3) * dt), vl = Math.hypot(c.vel[0], c.vel[2]), ux = vl > 1e-4 ? c.vel[0] / vl : dx / dist, uz = vl > 1e-4 ? c.vel[2] / vl : dz / dist; c.pos = [c.pos[0] + ux * step, c.pos[1], c.pos[2] + uz * step];
  gd.lastPos = [c.pos[0], c.pos[1], c.pos[2]]; gd.stuckT = 0;
  return false;
}
/** the seconds a man's body must lean on a leaf, from the face it opens into, before it is pulled round as it was before (doors.ts DoorContact.hand — game.ts
 *  asks, per man, per frame; undefined = doors.ts's own beat): never, for a man on his way to a handle or standing against a leaf (he is not on his way
 *  through it); its own beat for one this file has just let go of a door without a hand on it (no place at its handle, no way to it, a walk to it given up):
 *  he opens it as before; `press` for the rest — a man moved into one by something that never asked the gate */
export function handPress(g: Game, gd: Guard): number | undefined {
  if (!live(g) || !HANDLE.pull || gd.team === 'civilian' || gd.held) return undefined;   // (a man in Sam's arm is walked at the leaf by Sam: he presses it as Sam does, he does not wait on a hand of his own)
  const R = rested.get(gd); if (R && g.time < R.until) return undefined;
  return fresh(g, states.get(gd)) || gd.speed < 0.3 ? Infinity : HANDLE.press;
}

/** TOOLS: a door order's lead (a drill's, the response's) about to open `d` by hand from `at` on face `side` — null when he is at its handle already, the
 *  rule is off, or that face has no place he can walk to from there (he opens it from where he stands, as before); else the place he works it from
 *  (`peek`: only asked — nothing counted). */
export function toolSpot(g: Game, d: Door, side: 1 | -1, at: Vec3, peek = false, order = false): { pos: Vec3; yaw: number; pull: boolean; far: boolean } | null {
  if (!live(g) || !HANDLE.tools || atHandle(g, d, at, HANDLE.reach - 0.07)) return null;
  if (order && HANDLE.toolNear && !g.doors.pullFace(d, at)) {   // (`order`: a door order's lead, whichever cast of doortools.ts gives it; a man who opens a door with no such order — a drill's own, a walker — stands as he did)
    const N = nearStand(g, d, side, at);
    if (N === 'post') { if (!peek) { HANDLE_STATS.toolPosts++; HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: a lead at (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) works it from his mark, ${flat(at, handleAt(d)).toFixed(2)} m from its handle`); } return null; }
    if (N) { const hd = handleAt(d);
      if (!peek) { HANDLE_STATS.toolNears++; HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: a lead at (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) steps ${flat(at, N).toFixed(2)} m to (${N[0].toFixed(2)}, ${N[2].toFixed(2)}), past its latch jamb`); }
      return { pos: N, yaw: Math.atan2(hd[0] - N[0], hd[2] - N[2]), pull: false, far: false }; }
  }
  if (HANDLE.toolPost > 0 && !g.doors.pullFace(d, at)) { const F = frameOf(d), along = (at[0] - F.hx) * F.ux + (at[2] - F.hz) * F.uz;   // (beside the latch jamb on the face it swings away from: nothing comes round at him, and the handle is an arm away)
    if (along >= F.W && sideAt(d, at) === side && flat(at, handleAt(d)) <= HANDLE.toolPost && offAt(d, at) <= 0.8 && !walled(g, ptOf(d, d.def.width - HANDLE.handleIn, 0.2, side), at)) return null; }
  const H = handleSpot(g, d, side);
  if (!H || !wayTo(g, at, H.pos)) { if (!peek) HANDLE_STATS.toolNoSpot++; return null; }   // (… or only by a way round: through another door, round a wall)
  if (!peek) { HANDLE_STATS.toolWalks++; HANDLE_DEBUG.log?.(`${g.time.toFixed(2)}s HANDLE ${d.def.name}: a lead at (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) is sent to its handle at (${H.pos[0].toFixed(2)}, ${H.pos[2].toFixed(2)})`); }
  return { pos: H.pos, yaw: H.yaw, pull: H.pull, far: !!H.far };
}
/** HANDLE.toolNear: where a door order's lead standing at `at`, past the handle half's middle on the face d opens AWAY from, works its handle from WITHOUT
 *  standing in the opening — the point of the line from him to the handle that is within reach of it, and where that falls short of his body's width past the
 *  latch jamb the point that far past it, as far off the wall, moved in toward the wall until the handle is in reach again; then the same along the wall at
 *  the distance off it he stands at now. The first of them a man can stand on, walk straight to and reach the handle from. None: 'post' when he can work it
 *  from where he stands (past the jamb by his body, within `nearPost` of the handle, no wall between), else null — the handle's old place (a lead filed on
 *  the hinge jamb has no place of this kind: the handle is a leaf's width from him, and the other jamb is across the opening). */
function nearStand(g: Game, d: Door, side: 1 | -1, at: Vec3): Vec3 | 'post' | null {
  const K = HANDLE, F = frameOf(d), hd = handleAt(d), R = K.reach - 0.07, ha = F.W - K.handleIn, min = F.W + K.nearBody, ref = ptOf(d, ha, 0.2, side);
  const al = (p: Vec3) => (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz, a0 = al(at), o0 = offAt(d, at), L = flat(at, hd);
  if (sideAt(d, at) !== side || a0 < F.W / 2 || L < 1e-3) return null;
  const inOff = Math.sqrt(Math.max(0, R * R - (min - ha) * (min - ha)));   // (the furthest off the wall a man `nearBody` past the jamb still has the handle in reach)
  const past = (a: number, off: number): Vec3 => a >= min ? ptOf(d, a, off, side) : ptOf(d, min, Math.min(off, inOff), side);
  const line: Vec3 = [hd[0] + (at[0] - hd[0]) * R / L, 0, hd[2] + (at[2] - hd[2]) * R / L];
  for (const p of [past(al(line), offAt(d, line)), past(ha + Math.sqrt(Math.max(0, R * R - o0 * o0)), o0)]) {
    if (flat(p, hd) > R + 0.01 || flat(p, at) < 0.05 || !stands(g, p, true) || walled(g, ref, p) || walled(g, at, p)) continue;
    return p; }
  if (a0 >= min && L <= K.nearPost && !walled(g, ref, at)) return 'post';
  return null;
}
/** … and is he ON it: the last stride of that walk taken for whoever is moving him there (their own arrival is a stride wide — and a stride short of this
 *  place can be the hinge half of the frame, or inside the swing) */
export function toolStep(g: Game, gd: Guard, pos: Vec3): boolean {
  const was = stepped.get(gd), dt = was !== undefined && g.time > was ? Math.min(g.time - was, 0.05) : 1 / 60; stepped.set(gd, g.time);   // (its callers tick without a dt of their own)
  if (flat(gd.char.pos, pos) > 0.6) return false;
  return stepTo(g, gd, pos, dt, 1.2, true);
}
const stepped = new WeakMap<Guard, number>();
/** is a SHUT leaf to be stacked on from its latch jamb, whichever jamb a man is nearer (tactics.ts's doorway drill): the rule on, the leaf shut, and the
 *  floor past that jamb free for his stack (`stack`: where he would stand) */
export function latchFirst(g: Game, d: Door, stack: Vec3): boolean { return live(g) && HANDLE.tools && d.isClosed() && !(d as { off?: boolean }).off && stands(g, stack, true) && !walled(g, handleAt(d), stack); }
