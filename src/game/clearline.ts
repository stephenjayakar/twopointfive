// CLEAR THE LINE (CLEARLINE.on — off as shipped; `?clearline` for a visit, Tab ▸ Sandbox ▸ Line of fire, CLEARLINE=1 in the harness's environment).
//
// What it answers (rebuild/line-of-fire/fix.md has the probes' numbers): a teammate under one of Sam's orders whose shot at a man HE CAN SEE is masked by a
// friend — Sam between the gun and its man, or a mate — already holds the round and lowers the gun (roomfight.ts friendInLine / samInLine: untouched here,
// the friend's lane is exactly as wide as it was). What he did next was nothing: roomfight's own side step is handed to his script for one frame and taken back
// by the order that poses him the frame after (orders.ts re-orders every man every frame), and with a MATE in the line the runner's muzzle discipline has his
// gun down before the fire gate is ever reached, so no step is even asked for. He stood, gun down, in front of a man aiming at him.
//
// On, he does what a trained man does about a masked gun, in this order, and SAYS which:
//   STEP   the nearest spot within `reachM` he can walk straight to from which the round is clear of every friend by the fire gate's own test, clear of
//          furniture / glass / a jamb (the shot's own test), off every open doorway, a shoulder's width off every body, out of every other gun's line (a
//          mate's on his own man, Sam's along his reticle) and no nearer the man than point-blank. Beside the line, back off it, or UP LEVEL WITH THE FRIEND
//          (a corridor too narrow to step square: two guns abreast) — whichever is the shortest walk, a spot that closes on the man costing more. He walks
//          it at `pace` (under the team's walking pace: nobody runs), squared to the man, and shoots from it; the man gone, the order's own legs are his again.
//   COVER  no such spot: the nearest place a crouched chest is hidden from the man (suppression.ts coverFrom — the pinned man's own search), for `coverSecs`
//          and then for as long as the place he left is still masked, `holdMax` at most; a line that opens on the way there is taken (he plants and shoots).
//   KNEEL  neither: he goes down on a knee where he is, says the friend is in his line, and takes the step the moment the floor opens; he stays down
//          while the line he would stand back up into is still masked, `holdMax` at most.
// After `holdMax` the order's legs are his again and the rule leaves him be for `rest` s (the base behaviour): an order always ends.
// A MATE in the line is a narrower case than Sam in it (clearLineBlocked): a file, a stack, an entry put one man behind another on purpose.
// A man walking on an order (to a stack mark, in file behind Sam) is answered exactly as a planted one: the step is taken out of his walk and the walk goes on
// after. A silent squad holding its fire on a man who has not noticed it is not masked (silent.ts): nothing here runs for him. A man held short in the dark
// on a lit man (LIGHTS.litMan, roomfight.ts holdShort) takes the step but never cover or the knee: the dark he stands in is that rule's cover.
//
// CLEARLINE.inEntry false (true as shipped = all of the above everywhere): none of it for a man between the shove and his point on a door tool's order —
// the seconds a bang buys are the entry's (`entering`, which only READS doortools.ts's record of the order).
// CLEARLINE.holdBehind 2 (as shipped; 0 = all of the above, the rule as first built): no cover and no knee while the friend in his line is AHEAD OF HIM AND CLOSING ON THAT
// SAME MAN — the friend is in that fight, and a man who leaves it for cover loses the man he was about to shoot. The step is still taken; with none he
// holds behind the friend as the base does, says the friend is in his line, and has the ladder back that many seconds after the friend stops closing.
// CLEARLINE.still 2 (0 as shipped = all of the above): none of it — the step included — while the PLAYER in his line is on the move, nor for that many
// seconds after: what a mate on the move has always had (he clears the line himself). The rule is then for a player who has stood in a line.
// CLEARLINE.holdStep (true as shipped; with holdBehind): the hold behind a lead who is walking at the man stops the STEP as well — a man in file keeps his place.
// (Those two ship ON since the lost-surprise tally: as first built the switch cost the office rescue 25 of 144 runs with the defenders warned; with them 1.)
// CLEARLINE.stillFar 8 (0 as shipped; with still): `still` only while his man is farther off than this — close in he gets off the line at once.
//
// The seams: roomfight.ts asks clearLineBlocked() where it asked for its own side step (and once more for a mate in the line with the gun already down);
// orders.ts asks clearLineFeet() as it poses each man and clearLineLive() where it keeps its stuck clocks. State is a WeakMap here: nothing in a checkpoint or
// the digest, and with the switch off every export returns on its first line.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { DoorOp } from './doortools';
import type { Assignment } from './orders';
import { PACE } from './guards';
import { coverFrom } from './suppression';
import { silentHolds } from './silent';

export const CLEARLINE = {
  /** the switch (false = the build as it was, run for run) */
  on: false,
  /** s a friend has masked his shot before he moves: a breath, not a wait (roomfight's own side step asked at 0.5 s — FIGHT_SKILL.operative.line) */
  after: 0.3,
  /** m: how far a step to a clear line may be */
  reachM: 3,
  /** m/s he walks it at (never over the team's own walking pace, guards.ts PACE.max) */
  pace: 2,
  /** m: no nearer than this to anybody where he ends up, and along the way */
  bodyM: 0.6,
  /** m: the spot must clear the friend's lane by this much to spare (the lane itself is the fire gate's, untouched) */
  spareM: 0.15,
  /** nowhere to step: go to where the man cannot see him, for this many seconds / kneel where he is when there is no such place either */
  cover: true, coverSecs: 3, kneel: true,
  /** he says what he is doing (a bubble over him: 'blocked — stepping left.') */
  cue: true,
  /** s between two looks for a spot while he is still masked; s without his man in his eyes before the order's own legs are his again */
  again: 0.5, lose: 1,
  /** s at most in cover or on a knee for one masked line — then his order's legs are his again whatever is in the line, and the rule leaves him be for `rest` s
   *  (an order must end: Sam stood in a corridor for a minute does not park a man sent to a door behind a cabinet for that minute) */
  holdMax: 10, rest: 8,
  /** s on a spot he cannot shoot from after all (the man behind glass or a jamb from there) before the step is void */
  stale: 1.5,
  /** SAM AT THE LANE'S EDGE. s his shot has been masked WITHOUT A BREAK before he moves, when the only friend in the line is Sam and only by the wider lane
   *  a player on the move is owed (0.45 m standing, up to 0.95 m walking — the fire gate's, untouched): stood still where he is, the round would pass him.
   *  That line mostly opens by itself inside a quarter second. Never shorter than `after`; 0 = no such case, the rule as it was run for run. */
  afterEdge: 0,
  /** INSIDE AN ENTRY. true = the rule as it was run for run: a man is answered wherever his order has him. false = the rule STANDS DOWN for a man between
   *  the shove and his point on a door tool's order (the can in the air, the wait behind it, sent in and not yet on his point of domination — `entering`
   *  below): he holds his way through the door as the base does, and the rule has him again once he is on his point. The seconds a bang or a boot buys are
   *  the entry's: a lead stepped 2.5 m off his door on 'go' crossed a second late (rebuild/line-of-fire/fix.md, records-pair seed 21). */
  inEntry: true,
  /** BEHIND A FRIEND WHO IS CLOSING ON THE MAN, seconds (2 as shipped). 0 = the rule as first built, run for run. More = neither cover nor the knee while the friend in his line is
   *  ahead of him and walking AT that same man (0.5 m/s or more toward him, and more toward him than across the line — the number a mate 'on the move' is
   *  read by), nor for this many seconds after he was last seen doing so: the friend is in that fight and the line is his to open. He takes the step if there is one; with none he holds behind
   *  the friend, eyes on the man, as the base does, and says the friend is in his line. Cover took both men of a pair out of a corridor fight their
   *  commander was walking them into; the man lived and shot one of them walking back (rebuild/line-of-fire/fix.md, hostage rescue seed 5). At 1 the
   *  pair still left as their commander halted, a second before he stepped off the line himself, and lost a man in 5 of 144 rescues; 2 gives the halt
   *  its beat. */
  holdBehind: 2,
  /** … AND NO STEP EITHER (with `holdBehind` above 0; true as shipped). false = the hold above stops cover and the knee only, as it was run for run. true = the step as
   *  well: a man in file behind a lead who is walking at that man keeps his place in the file — he neither steps out from behind his lead nor leaves
   *  for cover; the lead is going to the man and the line is his to open. A friend CROSSING the line, or stepping off it, is not leading: for him the rule
   *  is as it was. With surprise lost the office rescue's losing runs all opened with a follower's STEP out from behind a commander walking down the
   *  corridor at the Door man, 13 m off (rebuild/line-of-fire/fix.md). */
  holdStep: true,
  /** SAM ON THE MOVE, seconds. 0 = the rule as it was run for run. More = NOTHING of this rule's (no step, no cover, no knee) while the player in his line
   *  is really getting somewhere (0.5 m/s or more of displacement, any direction — the number a MATE 'on the move' has always been read by: he clears the
   *  line himself), nor for this many seconds after he was last seen to: he holds as the base does, eyes on the man, and says Sam is in his line. The rule
   *  is then for a player who has STOOD in a line. With surprise lost the office rescue's losses all opened with a follower stepping out from behind a
   *  commander walking down the corridor at the man, and every cover in them was for a commander crossing the line (rebuild/line-of-fire/fix.md). */
  still: 0,
  /** … ONLY AT RANGE, metres (with `still` above 0). 0 = `still` at any range, as it was run for run. More = `still` only while his man is farther
   *  off than this; nearer, the rule is as first built whatever the player is doing. Close in a masked half second is the fight, so he gets off the line at
   *  once; down a long corridor a player on the move opens the line himself before a far man has lined up, and a man who breaks file there takes a gun
   *  off the corridor. 8 = aim.ts `rangeRef`: the range at and past which a man needs his whole time to line up (nearer, the target fills the sights and
   *  it goes quicker in proportion). The rule's acts in the levels it gains on are mostly 2 to 6 m from the man; in the office rescue's corridor all of
   *  them are 8 m or more (rebuild/line-of-fire/fix.md). */
  stillFar: 0,
};
export const CLEARLINE_DEFAULTS: typeof CLEARLINE = { ...CLEARLINE };
export const CLEARLINE_STATS = { blocked: 0, steps: 0, up: 0, planted: 0, covers: 0, kneels: 0, cues: 0, ended: 0, nothing: 0, behind: 0, moving: 0 };
export interface ClearNote { t: number; who: string; what: 'step' | 'cover' | 'kneel' | 'end'; by: string; at: [number, number] | null; walk: number }
export const CLEARLINE_LOG: ClearNote[] = [];

const LS = 'twopointsix.clearline';
const KEPT = ['on', 'after', 'afterEdge', 'inEntry', 'holdBehind', 'holdStep', 'still', 'stillFar', 'reachM', 'pace', 'cover', 'kneel', 'cue', 'holdMax'] as const;   // (the panel's rows)
export function saveClearLine() { try { const o: Record<string, boolean | number> = {}; for (const k of KEPT) if (CLEARLINE[k] !== CLEARLINE_DEFAULTS[k]) o[k] = CLEARLINE[k]; if (Object.keys(o).length) globalThis.localStorage?.setItem(LS, JSON.stringify(o)); else globalThis.localStorage?.removeItem(LS); } catch { /* no store */ } }
try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === typeof CLEARLINE[k]) (CLEARLINE as Record<string, unknown>)[k] = o[k]; } catch { /* no store, or not ours */ }
try { const q = new URLSearchParams(location.search); if (q.has('clearline')) CLEARLINE.on = q.get('clearline') !== '0'; } catch { /* no page (the harness) */ }
try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CLEARLINE; if (e) CLEARLINE.on = /^(1|on|true|yes)$/i.test(e); } catch { /* no process (the page) */ }

type What = 'step' | 'cover' | 'kneel';
/** what he is doing about it: where, about which man, since when; `onT` = when that man was last his (roomfight's target), `until` = a cover's end */
interface Doing { what: What; spot: Vec3; of: Guard; t0: number; onT: number; until: number; askT: number; lookT: number; from: Vec3; orderT: number;
  /** when he should be on the spot by (a walk that is going nowhere is void) · when he last had the round from where he stands */
  eta: number; goodT: number;
  /** the gate's point on the man was his HEAD (the chest is behind something chest-high): what every later look at this line is asked of too */ head: boolean }
/** `restUntil`: the rule leaves him be until then (base behaviour: his order's legs) · `tryT`: nothing was found — the next look */
interface Mem { since: number; seenT: number; saidT: number; said: string; doing: Doing | null; restUntil: number; tryT: number; /** masked without a break, on this man, since (the edge wait's clock) */ runT: number; runOf: Guard | null;
  /** when the friend in his line was last seen closing on the man (holdBehind) · where that friend stood the last time it was asked, and when */ leadT: number; leadP: [number, number, number] | null; leadOf: unknown; /** … and on which man (a lead seen on one man is not a lead on the next) */ leadFor: Guard | null }
const mem = new SideMap<Guard, Mem>('clearline.mem');
const memOf = (gd: Guard): Mem => { let M = mem.get(gd); if (!M) { M = { since: -100, seenT: -100, saidT: -100, said: '', doing: null, restUntil: -100, tryT: -100, runT: -100, runOf: null, leadT: -100, leadP: null, leadOf: null, leadFor: null }; mem.set(gd, M); } return M; };
/** what a LIVING man is doing (a man who dropped mid-step holds no spot against the others and is not on the panel) */
const liveDoing = (gd: Guard): Doing | null => (gd.state === 'dead' || !gd.script ? null : mem.get(gd)?.doing ?? null);   // (… nor a man the fight AI has: nothing of his is being walked)
const chestOf = (h: Guard): Vec3 => [h.char.pos[0], 1.2, h.char.pos[2]];
/** the point on the man this was begun on: his chest, or (the fire gate fell back to it) his head */
const aimOf = (D: Doing): Vec3 => (D.head ? D.of.char.bones.head ?? [D.of.char.pos[0], D.of.char.pos[1] + 1.6, D.of.char.pos[2]] : chestOf(D.of));
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** how far `p` is from the segment a → b in plan, and how far along it (0‥1, clamped) */
function offSeg(p: Vec3, a: Vec3, b: Vec3): [number, number] {
  const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz; const t = L2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2));
  return [Math.hypot(a[0] + dx * t - p[0], a[2] + dz * t - p[2]), t];
}
/** Sam is in this man's line ONLY by the wider lane a player on the move is owed: asked of the fire gate's own test as if Sam stood still where he is, a
 *  round from his muzzle and from his gun shoulder (the two places roomfight.ts measures from) would pass Sam and every mate */
function samAtEdge(g: Game, gd: Guard, to: Vec3): boolean {
  const c = gd.char;
  return !g.fight.friendInLine(c.muzzle, to, gd, true) && !g.fight.friendInLine(c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]), to, gd, true);
}
/** THE FRIEND IN HIS LINE LEADS ON THAT MAN (holdBehind): nearer the man than he is, and walking at him — LEAD_V m/s or more toward the man and no less
 *  toward him than across the line (a friend crossing the line clears it; one walking down it is going to the man). Read off where the friend really got
 *  to since this was last asked (twice a second while the line is masked: a walk into a wall is no walk), off the pace asked of his legs the first time.
 *  Held `secs` after it was last so: a commander who checks his stride, or halts to look, has not parked himself in the line. */
const LEAD_V = 0.5;
function leads(g: Game, gd: Guard, M: Mem, by: 'player' | Guard, tgt: Guard, to: Vec3, secs: number): boolean {
  if (M.leadOf !== by || M.leadFor !== tgt) M.leadT = -100;   // (another friend in the line, or another man: what the last was seen doing says nothing of this one)
  M.leadFor = tgt;
  const t = g.time, f = by === 'player' ? g.player.char : by.char, dx = to[0] - f.pos[0], dz = to[2] - f.pos[2], L = Math.hypot(dx, dz);
  const P = M.leadOf === by ? M.leadP : null, dt = P ? t - P[2] : 0;
  const vx = P && dt > 0.1 && dt < 1.5 ? (f.pos[0] - P[0]) / dt : f.vel[0], vz = P && dt > 0.1 && dt < 1.5 ? (f.pos[2] - P[1]) / dt : f.vel[2];
  if (!P || dt > 0.1 || dt < 0) { M.leadP = [f.pos[0], f.pos[2], t]; M.leadOf = by; }
  if (L > 0.5 && L < flat(gd.char.pos, to)) {
    const at = (vx * dx + vz * dz) / L, across = Math.abs(vx * dz - vz * dx) / L;
    if (at >= LEAD_V && at >= across) M.leadT = t;
  }
  return t - M.leadT < secs && t >= M.leadT;
}
/** THE PLAYER IS ON THE MOVE (still): LEAD_V m/s or more of real displacement, any direction, now or inside the last `secs` seconds. Read off where he
 *  really got to between two asks a tenth of a second or more apart, by any masked man (the pace asked of his legs the first time and after a gap nobody
 *  was masked in: a walk into a wall is no walk). One record a game — every man reads the same commander. */
const samAt = new SideMap<Game, { p: [number, number, number]; moveT: number }>('clearline.samAt');
function samMoves(g: Game, secs: number): boolean {
  const t = g.time, f = g.player.char, S = samAt.get(g), asked = () => Math.hypot(f.vel[0], f.vel[2]) >= LEAD_V;
  if (!S || t < S.p[2]) { samAt.set(g, { p: [f.pos[0], f.pos[2], t], moveT: asked() ? t : -100 }); return asked(); }
  const dt = t - S.p[2];
  if (dt > 0.1) { if (dt < 1.5 ? Math.hypot(f.pos[0] - S.p[0], f.pos[2] - S.p[1]) / dt >= LEAD_V : asked()) S.moveT = t; S.p = [f.pos[0], f.pos[2], t]; }
  return t - S.moveT < secs && t >= S.moveT;
}
/** the entry assignment each man was first seen on, per door order (`past`: he has been on his point since, or been sent on from it) */
const entered = new SideMap<Guard, { op: DoorOp; A: Assignment; past: boolean }>('clearline.entered');
/** IS THIS MAN BETWEEN THE SHOVE AND HIS POINT ON A DOOR TOOL'S ORDER? Read off the door tools' own record of the order (doortools.ts DoorOp: nothing of
 *  theirs is written, nothing they pick or send is changed):
 *    before the men go     the can thrown and not yet burst (toss, fuse, a threshold's pocket), the wait behind a bang or a charge, a boot thrown
 *    going in ('enter')    waiting his turn at the jamb, or sent to a point of domination he has not stood on yet
 *  Not: the walk up and the stack, a charge being set or stood off from, a threshold held, a slice from outside; a man the entry left outside (no point);
 *  a man once on his point — sent on from it to floor nobody has seen, he is searching a room, not making an entry. Asked every frame a man is posed
 *  (clearLineFeet), so the first entry assignment is always the one remembered. */
function entering(g: Game, gd: Guard): boolean {
  const A = g.orders.of(gd); if (!A) return false;
  const op = g.doorTools.ops.find(o => o.men.includes(gd) && o.mine.get(gd) === A); if (!op) return false;
  if (op.phase !== 'enter') return op.phase === 'toss' || op.phase === 'fuse' || op.phase === 'wait' || op.phase === 'pocket' || (op.phase === 'kick' && !!op.kick && !op.kick.pick && !isNaN(op.kick.t));
  if (op.queue.some(q => q.gd === gd)) return true;
  if (!op.pod.has(gd)) return false;
  let E = entered.get(gd); if (!E || E.op !== op) entered.set(gd, E = { op, A, past: false });
  if (op.onPod.has(gd) || E.A !== A) E.past = true;
  return !E.past;
}
/** every body on the floor but his own: Sam (up), every living man of any side, every living civilian (a hostage) */
function* bodies(g: Game, self: Guard): Generator<Vec3> {
  if (!g.player.down) yield g.player.char.pos;
  for (const o of g.guards) if (o !== self && o.state !== 'dead') yield o.char.pos;
  for (const o of g.civilians) if (o.state !== 'dead') yield o.char.pos;
}
/** a round from `p` at `to` is clear by the fire gate's own tests — statics, and every friend's lane with `spareM` to spare, from everywhere the gate may
 *  measure it from once he stands there: his right shoulder (0.24 m right of his feet, squared to the man) and his muzzle (ahead, about on his middle) */
function shotFrom(g: Game, gd: Guard, p: Vec3, to: Vec3): boolean {
  const dx = to[0] - p[0], dz = to[2] - p[2], L = Math.hypot(dx, dz); if (L < 0.5) return false;
  const ux = dx / L, uz = dz / L, sp = CLEARLINE.spareM;
  if (g.col.shotBlocked([p[0], 1.4, p[2]], to)) return false;
  for (const ahead of [0, 0.55]) for (const side of [-sp, SHOULDER + sp]) {
    const from: Vec3 = [p[0] + ux * ahead - uz * side, 1.4, p[2] + uz * ahead + ux * side];
    if (g.fight.friendInLine(from, to, gd)) return false;
  }
  return true;
}
/** from `p` the man at `to` is in plain view and a friend is in the gun's line (what sent him to cover, asked again of the place he left) */
function masked(g: Game, gd: Guard, p: Vec3, to: Vec3): boolean {
  const from: Vec3 = [p[0], 1.4, p[2]]; return !g.col.shotBlocked(from, to) && !!g.fight.friendInLine(from, to, gd);
}
const SHOULDER = 0.24;
const ROOM: [number, number][] = [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];
/** may he stand at `p` and shoot his man from it: floor, off a doorway, a shoulder off everybody, in nobody else's line of fire, and the round clear */
function spotOk(g: Game, gd: Guard, p: Vec3, to: Vec3): boolean {
  const K = CLEARLINE;
  const nav = g.col.nav; if (nav.isBlocked(p[0], p[2]) || g.fight.funnelOf(p)) return false;
  for (const [ox, oz] of ROOM) if (nav.isBlocked(p[0] + ox, p[2] + oz)) return false;   // room for his shoulders: a free cell's edge against a wall is not a place a man can get to
  for (const b of bodies(g, gd)) if (flat(b, p) < K.bodyM) return false;
  for (const o of g.guards) { if (o === gd) continue; const d = liveDoing(o); if (d && d.what !== 'kneel' && flat(d.spot, p) < 0.8) return false; }   // (a mate's spot: his)
  for (const o of g.civilians) { if (o.state === 'dead') continue; const [d, t] = offSeg(o.char.pos, p, to); if (d < 0.5 && t > 0.02 && t < 1) return false; }   // never a line laid across a hostage
  for (const X of g.fight.ops) {   // a mate's gun on his own man: never across it
    if (X.gd === gd || X.gd.state === 'dead' || !X.tgt || X.tgt.state === 'dead') continue;
    const [d, t] = offSeg(p, X.gd.char.pos, X.tgt.char.pos); if (d < 0.6 && t > 0.02 && t < 1) return false;
  }
  if (!g.player.down && g.player.gunInHand()) {   // … nor across Sam's, along his reticle
    const s = g.player.char.pos, a = g.aimPoint, len = flat(s, a);
    if (len > 1) { const k = Math.min(1, 15 / len), end: Vec3 = [s[0] + (a[0] - s[0]) * k, 0, s[2] + (a[2] - s[2]) * k]; const [d, t] = offSeg(p, s, end); if (d < 0.5 && t > 0.02) return false; }
  }
  return shotFrom(g, gd, p, to);
}
/** THE STEP: the cheapest spot within reach that opens the line, on a lattice laid along the line to the man (half-metre rows from a stride back to
 *  `reachM` up it; columns from a shoulder's width out) — null: there is none */
function findSpot(g: Game, gd: Guard, to: Vec3): { p: Vec3; along: number; side: number } | null {
  const K = CLEARLINE, c = gd.char.pos; const dx = to[0] - c[0], dz = to[2] - c[2], d0 = Math.hypot(dx, dz); if (d0 < 0.5) return null;
  const ux = dx / d0, uz = dz / d0;   // (side > 0 = his RIGHT as he faces the man: yaw 0 looks down +z, his right hand is at −x)
  const cands: { p: Vec3; along: number; side: number; cost: number }[] = [];
  for (let along = -1.5; along <= K.reachM + 1e-6; along += 0.5) for (const w of [0.5, 0.7, 0.9, 1.2, 1.6, 2.0, 2.5, 3.0]) for (const side of [w, -w]) {
    const walk = Math.hypot(along, side); if (walk > K.reachM + 1e-6) continue;
    const p: Vec3 = [c[0] + ux * along - uz * side, 0, c[2] + uz * along + ux * side]; const d1 = flat(p, to);
    if (d1 < Math.min(d0, 2.5)) continue;   // never to inside point-blank of him
    cands.push({ p, along, side, cost: walk + 0.5 * Math.max(0, d0 - d1) });   // (closing on the man costs: beside the line before up it)
  }
  cands.sort((a, b) => a.cost - b.cost);
  for (const q of cands) {
    if (!spotOk(g, gd, q.p, to)) continue;
    if (g.col.solidBlocked([c[0], 0.45, c[2]], [q.p[0], 0.45, q.p[2]])) continue;   // a straight walk
    let through = false; for (const b of bodies(g, gd)) { const [d, t] = offSeg(b, c, q.p); if (d < K.bodyM - 0.1 && t > 0.15) { through = true; break; } }   // … and not through anybody
    if (through) continue;
    return q;
  }
  return null;
}
function note(g: Game, gd: Guard, what: ClearNote['what'], by: string, at: Vec3 | null, walk = 0) {
  CLEARLINE_LOG.push({ t: g.time, who: gd.callsign, what, by, at: at ? [at[0], at[2]] : null, walk }); if (CLEARLINE_LOG.length > 300) CLEARLINE_LOG.splice(0, 100);
}
function cue(g: Game, gd: Guard, M: Mem, text: string) {
  if (!CLEARLINE.cue || (text === M.said && g.time - M.saidT < 6) || g.time - M.saidT < 1.2) return;
  M.saidT = g.time; M.said = text; CLEARLINE_STATS.cues++; g.say(gd, text);
}

/** his step / cover / knee is over: the order's own legs are his again; `rest` s of being left alone by the rule (0: none) */
function endIt(g: Game, gd: Guard, M: Mem, rest = 0) {
  M.doing = null; CLEARLINE_STATS.ended++; note(g, gd, 'end', '', null); if (rest > 0) M.restUntil = g.time + rest;
}
/** what he is doing about a masked shot right now, if anything — and the end of it:
 *    any    his man down, a new order from Sam, the fight over; with `inEntry` off, the can going on his door (what he began on the stack ends)
 *    step   his man out of his eyes for `lose` s; a walk that is not getting there; `stale` s on the spot without the round after all
 *    cover  its time up AND the place he left no longer masked — or `holdMax`, or hold-short's turn (in the dark on a lit man his feet are that rule's)
 *    knee   the line he would stand up into no longer masked — or `holdMax`, or hold-short's turn */
function doing(g: Game, gd: Guard): Doing | null {
  const M = mem.get(gd), D = M?.doing; if (!M || !D) return null;
  const K = CLEARLINE, op = g.fight.opOf(gd), t = g.time;
  if (!K.on || gd.state === 'dead' || !gd.script || !op || !g.fight.live || D.of.state === 'dead' || t < D.t0 || g.orders.of(gd)?.t0 !== D.orderT || (D.what !== 'step' && g.fight.short(gd)) || (!K.inEntry && entering(g, gd))) { endIt(g, gd, M); return null; }
  if (D.what === 'step') {
    if (op.tgt === D.of) D.onT = t; else if (t - D.onT > K.lose) { endIt(g, gd, M); return null; }
    if (t > D.eta && flat(gd.char.pos, D.spot) >= 0.5) { endIt(g, gd, M, 3); return null; }
    return D;
  }
  if (t - D.t0 > K.holdMax) { endIt(g, gd, M, K.rest); return null; }
  if (t >= D.until) {   // (asked twice a second: is the line he left still a friend's?)
    if (masked(g, gd, D.from, aimOf(D))) D.until = t + 0.5; else { endIt(g, gd, M); return null; }
  }
  return D;
}
/** orders.ts: this man's stuck clocks wait (he is off his mark on purpose) */
export function clearLineLive(g: Game, gd: Guard): boolean { return CLEARLINE.on && !!doing(g, gd); }
/** orders.ts, as it poses him: where his feet go while this lasts — null: as ordered */
export function clearLineFeet(g: Game, gd: Guard): { goal: Vec3; speed: number; face: number | null; strafe: boolean; crouch: boolean } | null {
  if (!CLEARLINE.on) return null;
  const D = doing(g, gd); if (!D) { if (!CLEARLINE.inEntry) entering(g, gd); return null; }   // (… asked of every posed man, every frame: `entering` remembers the assignment he first went in on)
  const K = CLEARLINE, t = g.time, p = gd.char.pos, face = v3.yawTo(p, D.of.char.pos), there = flat(p, D.spot) < 0.5;
  if (D.what !== 'kneel' && t >= D.lookT) {
    D.lookT = t + 0.2; const mine = g.fight.opOf(gd)?.tgt === D.of, to = aimOf(D);
    if (!there) {   // on his way, and the line has opened where he is (the friend moved; a gap passed on the way to cover): he plants and shoots from here — if here is a place to stand
      if (mine && spotOk(g, gd, [p[0], 0, p[2]], to)) { D.what = 'step'; D.spot = [p[0], 0, p[2]]; D.until = Infinity; D.eta = Infinity; D.goodT = t; CLEARLINE_STATS.planted++; }
    } else if (D.what === 'step') {   // on the spot: the round is his from here, or (glass, a jamb, the man has moved) it is not and the step is void
      if (!mine || shotFrom(g, gd, p, to) || g.fight.friendInLine([p[0], 1.4, p[2]], to, gd)) D.goodT = t;   // (a friend in it again is clearLineBlocked's: the next spot)
      else if (t - D.goodT > K.stale) { endIt(g, gd, memOf(gd), 3); return null; }
    }
  }
  if (D.what === 'kneel') return { goal: D.spot, speed: 0, face: null, strafe: false, crouch: true };
  return { goal: D.spot, speed: Math.min(K.pace, PACE.max), face, strafe: true, crouch: D.what === 'cover' && K.kneel && there };   // squared to the man all the way: a side step, a back-pedal
}
/** a cover spot is a place a man may stand: off a doorway, a shoulder off everybody, not a mate's own spot (suppression.ts coverFrom knows none of this rule's) */
function coverOk(g: Game, gd: Guard, p: Vec3): boolean {
  if (g.fight.funnelOf(p)) return false;
  for (const b of bodies(g, gd)) if (flat(b, p) < CLEARLINE.bodyM) return false;
  for (const o of g.guards) { if (o === gd) continue; const d = liveDoing(o); if (d && d.what !== 'kneel' && flat(d.spot, p) < 0.8) return false; }
  return true;
}
/** roomfight.ts (tickOp): this frame his shot at `tgt` — a man in his eyes, his beat run — is masked by a friend (`by`: Sam, or the mate). True: this rule has
 *  it (roomfight's own side step is not asked for). The round is held either way: that is the gate's, not this rule's. */
export function clearLineBlocked(g: Game, gd: Guard, tgt: Guard, to: Vec3, by: 'player' | Guard): boolean {
  const K = CLEARLINE; if (!K.on || !gd.script) return false;
  const A = g.orders.of(gd); if (!A) return false;   // (a man no order of Sam's poses is his drill's: its legs are not ours to take)
  if (!K.inEntry && entering(g, gd)) return false;   // (between the shove and his point: the base's answer, and his way through the door)
  const M = memOf(gd), t = g.time;
  if (t < M.restUntil) return false;   // (left alone for a while after a cover that ran its time)
  // Held short in the dark on a lit man (LIGHTS.litMan, roomfight's holdShort): standing in the dark IS his cover — a step to a clear line is still taken
  // (a metre sideways and the round goes), cover and the knee are not.
  let ladder = !g.fight.short(gd);
  // A MATE in the line is not Sam in the line: a file, a stack and an entry put one man behind another on purpose.
  //   the mate on the move                  he clears the line himself (the second man through a door is not 'masked')
  //   the mate has this man in his sights   the gun in front has the shot: nothing — the man behind is a file's second man, not a masked gun
  //   the mate has not (flash-blind, on another man)   the step; cover or the knee only for a man planted on his mark
  if (by !== 'player') {
    if (Math.hypot(by.char.vel[0], by.char.vel[2]) > 0.5) return false;
    if (g.fight.opOf(by)?.tgt === tgt && t >= by.dazzledUntil) return false;
    ladder &&= A.arrived;
  }
  CLEARLINE_STATS.blocked++;
  if (t - M.seenT > 0.5 || t < M.seenT) M.since = t;   // (masked afresh)
  if (t - M.seenT > 0.15 || t < M.seenT || M.runOf !== tgt) { M.runT = t; M.runOf = tgt; }   // (… and since when without a break, on this man: a line that keeps opening by itself is not 'masked for a second')
  M.seenT = t;
  const moves = K.still > 0 && by === 'player' && samMoves(g, K.still) && !(K.stillFar > 0 && flat(gd.char.pos, tgt.char.pos) <= K.stillFar);   // (asked every time, whatever comes of it: it is how his pace is read)
  let D = doing(g, gd);
  if (D && D.of !== tgt) { endIt(g, gd, M); D = null; }   // (another man now: what he was doing about the last is void)
  if (D) {
    if (t < D.askT) return true;
    D.askT = t + K.again;
    if (D.what === 'cover') return true;   // (on his way to cover, or in it: doing() ends it)
    if (D.what === 'step' && t <= D.eta && flat(gd.char.pos, D.spot) > 0.25 && spotOk(g, gd, D.spot, to)) return true;   // still walking to a spot that still opens it
  } else if (t - M.since < K.after || t < M.tryT) return true;
  else if (K.afterEdge > K.after && by === 'player' && t - M.runT < K.afterEdge && samAtEdge(g, gd, to)) return true;   // (Sam only at his lane's edge: the longer breath — it mostly opens by itself)
  if (silentHolds(g, gd, tgt)) return false;   // (a silent squad on a man who has not noticed it: no round is wanted, so none is masked — asked here, at a decision, not every frame: it counts)
  if (moves) {   // (the player on the move clears the line himself, as a mate does: the base's answer; the rule `still` seconds after he stops)
    if (D?.what === 'kneel') return true;   // (on a knee already: as he is — no step from it for a player on the move)
    CLEARLINE_STATS.moving++; cue(g, gd, M, "no shot — you're in my line!");
    M.tryT = t + K.again; if (D) endIt(g, gd, M); return false;
  }
  if (K.holdStep && K.holdBehind > 0 && leads(g, gd, M, by, tgt, to, K.holdBehind)) {   // (holdBehind, and the step too: in file behind a lead who is walking at that man he keeps his place)
    if (D?.what === 'kneel') return true;   // (on a knee already: as he is)
    CLEARLINE_STATS.behind++; cue(g, gd, M, by === 'player' ? "no shot — you're in my line!" : `no shot — ${by.callsign}, my line!`);
    M.tryT = t + K.again; if (D) endIt(g, gd, M); return false;
  }
  const who = by === 'player' ? 'Player' : by.callsign, c = gd.char.pos;
  const fresh = (what: What, spot: Vec3, walk: number, until: number): Doing => ({ what, spot, of: tgt, t0: t, onT: t, until, askT: t + K.again, lookT: t + 0.2, from: [c[0], 0, c[2]], orderT: A.t0, eta: t + 2 * walk / Math.max(0.5, K.pace) + 2, goodT: t,
    head: to[1] - (tgt.char.bones.chest?.[1] ?? tgt.char.pos[1] + 1.1) > 0.2 });
  const S = findSpot(g, gd, to);
  if (S) {
    const walk = Math.hypot(S.along, S.side);
    M.doing = fresh('step', S.p, walk, Infinity);
    CLEARLINE_STATS.steps++; if (S.along > Math.abs(S.side)) CLEARLINE_STATS.up++;
    note(g, gd, 'step', who, S.p, walk);
    cue(g, gd, M, S.along > Math.abs(S.side) ? 'blocked — moving up.' : -S.along > Math.abs(S.side) ? 'blocked — stepping back.' : S.side > 0 ? 'blocked — stepping right.' : 'blocked — stepping left.');
    return true;
  }
  if (D?.what === 'kneel') return true;   // (on a knee and still nowhere to go: as he is — a step whose spot no longer opens it, with no better one, goes on to cover or the knee)
  if (!ladder) { M.tryT = t + K.again; if (D) endIt(g, gd, M); return false; }
  if (g.col.shotBlocked([c[0], 1.4, c[2]], to)) { M.tryT = t + K.again; if (D) endIt(g, gd, M); return false; }   // (glass or a jamb has his round from here whatever the friend does: not masked by him — cover and the knee would end at their first look and begin again, with no `holdMax`)
  if (K.holdBehind > 0 && !K.holdStep && leads(g, gd, M, by, tgt, to, K.holdBehind)) {   // (the friend ahead of him is walking at that man: his fight too — behind him, eyes on the man, as the base stands; the ladder `holdBehind` seconds after he stops)
    CLEARLINE_STATS.behind++; cue(g, gd, M, by === 'player' ? "no shot — you're in my line!" : `no shot — ${by.callsign}, my line!`);
    M.tryT = t + K.again; if (D) endIt(g, gd, M); return false;
  }
  const cov = K.cover ? coverFrom(g, gd, tgt.char.pos) : null;
  if (cov && coverOk(g, gd, cov)) {
    const walk = flat(c, cov);
    M.doing = fresh('cover', cov, walk, t + walk / Math.max(0.5, K.pace) + K.coverSecs);
    CLEARLINE_STATS.covers++; note(g, gd, 'cover', who, cov, walk); cue(g, gd, M, 'no shot — getting off the line.');
    return true;
  }
  if (K.kneel && !g.fight.funnelOf(c)) {   // (never in a door frame: the base's answer there)
    M.doing = fresh('kneel', [c[0], 0, c[2]], 0, t + 0.5);
    CLEARLINE_STATS.kneels++; note(g, gd, 'kneel', who, null); cue(g, gd, M, by === 'player' ? "no shot — you're in my line!" : `no shot — ${by.callsign}, my line!`);
    return true;
  }
  CLEARLINE_STATS.nothing++; M.tryT = t + K.again; if (D) endIt(g, gd, M);
  return false;   // (nothing of ours to do: roomfight's own side step may have it, as before)
}
/** the panel's line */
export function clearLineSummary(g: Game): string {
  if (!CLEARLINE.on) return 'off';
  const S = CLEARLINE_STATS; const now = g.guards.filter(gd => !!liveDoing(gd)).map(gd => `${gd.callsign} ${liveDoing(gd)!.what}`);
  return `on · steps ${S.steps} (${S.up} up level) · cover ${S.covers} · knee ${S.kneels} · said ${S.cues}${now.length ? ` · now: ${now.join(', ')}` : ''}`;
}
/** what a man is doing about it this moment (the probes', the panel's) */
export function clearLineOf(g: Game, gd: Guard): { what: What; spot: Vec3; of: Guard } | null { const D = CLEARLINE.on ? doing(g, gd) : null; return D ? { what: D.what, spot: D.spot, of: D.of } : null; }
