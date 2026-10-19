// OFF THE LINE OF HIS FIRE (FIRELINE.on). The maintainer's card, after friendly fire came in: "Teammates never walk into your line of fire" — "a teammate
// about to cross your line while you are firing waits a beat short of it and crosses when you stop."
//
// Friendly fire (friendlyfire.ts) made a round of Sam's side a round to the men of Sam's side, and gave a teammate the care not to PRESS with a friend where
// his round could go. Nothing gave him the other half of that care: an order walked him across the lane the player was shooting down, and the round found him.
// On, a teammate WALKING on an order (to a mark, in the file behind Sam, falling in) whose next steps would take him into the lane of the player's fire stops
// `shortM` short of it and goes on when the fire stops:
//   firing    a gun in the player's hands and a round out of it inside the last `fireS` (one careless shot is a second's wait, a string is as long as it lasts —
//             through a magazine changed in the middle of it and `reloadS` after; slow aimed fire is a string too: `paceS`, `paceK`). Rounds are counted off
//             the gun itself, once a frame (fireLineTick): a launcher's load or a thrown thing is no round
//   the lane  the round's own, as friendlyfire.ts friendInCone reasons about a teammate's: from the player's back along the gun's heading, a body (`FRIENDLYFIRE.bodyM`)
//             and `clearM` either side, widening by the share of its spread a round can be thrown (`FRIENDLYFIRE.coneK` × `spread`, the widest his hands give a
//             string on the move), as far as a round flies — through what it pierces, nothing solid between
//   the wait  where he stands, the order's own goal kept, at no speed, saying so once; `maxS` at most. After that he looks (every `againS`) for a way to his
//             place that keeps out of the lane, goes through no doorway and is no more than `wayMoreM` longer — behind the player, as a rule — and walks it
//             at the order's own pace; with none he waits on.
//             The fire stopped, or the gun swung off his way: the order's own legs, at once. A lane that comes back inside `lapseS` (the gap before a
//             second slow round) is the same wait: nothing said twice, the ceiling's clock kept — and if it comes back with him already walking in it, he
//             walks on out. A man waiting whom the gun swings ONTO stands as he stood, where the player can see him, to the ceiling.
// What it never does, by the card ("Left out: any change to your aim, to auto aim or to the enemies"): no round is stopped, bent or passed; the player's gun
// is not touched; a man ALREADY in the lane when the fire starts is not moved (he walks on out of it, as he would have); a hold is not a shove — careless fire
// still hits. And never: a man with a fight of his own (a man in his sight, on his gun, or just lost), a man past the stack on a door order (the count is the
// entry's), a man on a wall charge (its stand-off and its entry are the charge's), a man in a doorway (he is committed through it), a man stepping out of Sam's own way or mid-crossing for the silent squad, a man who would be
// left standing where an enemy he knows of has a line to him (his own picture, picture.ts), a show's cast. And not at all with friendly fire off (`FRIENDLYFIRE.on`: the
// player's round is then no round to his own men, and there is nothing to keep out of). Nobody runs: the way round is walked at the pace the order gave him.
//
// The seam is orders.ts, where every ordered man's feet are posed each frame: fireLineTick() before the men, fireLineFeet() just before each pose, fireLineLive() where the order keeps its
// stuck clocks (a man waiting on purpose is not a man who cannot get through). The room fight's own lane (roomfight.ts friendInLine / holdShort / sideStep —
// a TEAMMATE's shot masked by a friend) and clearline.ts (his step off that line) are other rules and are not read or changed here.
//
// ON in the page (`?nofireline` = as it was), OFF in the module and on the frozen harness stand (`TPS_FIRELINE=1`): a FROZEN_HOLDS row, in the knob registry
// and a journal's tables; a recording from before the table replays with it off. State: two named side tables (a man's wait and his way round; when the
// player's fire was last live), in a rollback snapshot and in no checkpoint — a load in the middle of a wait begins it afresh.
// No dice, no clock but the game's. (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import type { Vec3 } from '../math/vec';
import type { Game, Guard, Player } from './game';
import { FRIENDLYFIRE, ffBody, ffLive, ffSide } from './friendlyfire';
import { shotEnergy, roundEnergy } from './glasspen';
import { wallPenLive, thinLine } from './wallpen';
import { inOpening } from './doorway';
import { PICTURE, exposedAt } from './picture';

export const FIRELINE = {
  /** the switch (false = the build as it was, run for run) */
  on: false,
  /** s: the player is firing while a round left his gun inside this long — and through a reload begun while he was, and `reloadS` after it (a magazine
   *  changed in the middle of a string is the string) */
  fireS: 1.0, reloadS: 0.7,
  /** slow aimed fire is fire too: two rounds inside `paceS` of each other, and the lane outlasts the last of them by `paceK` × the gap between them (at most
   *  `paceS`) — a round every second and a bit is one string, not a string of chances to cross */
  paceS: 2.5, paceK: 1.5,
  /** s: a lane that comes back this soon after it lapsed on a waiting man is the same wait (no second word; the ceiling's clock kept) */
  lapseS: 2.5,
  /** the widest a round of his is thrown (combat.ts fireWeapon's `spread`): the rifle on the move, a string's growth and the aim model's cone on top */
  spread: 0.06,
  /** m: room either side of the round's lane on top of a body's (FRIENDLYFIRE.bodyM) — he stops clear of it, not on its edge */
  clearM: 0.25,
  /** m: he stops when his way enters the lane inside this far of walking (`keepM` more once he is waiting: no dithering on the edge) */
  shortM: 1.4, keepM: 0.4,
  /** m: …and, however shallow his way comes at it, before his next step is this near the lane's side (`lookM`: as far up his way as the lane is looked for) */
  gapM: 1.0, lookM: 6,
  /** he says so once, `cueS` into the wait (a man who stops for no reason he gives reads as stuck; a stop that short is not worth a word) */
  cue: true, cueS: 0.35,
  /** s: the longest he waits before he looks for a way round, and how often he looks again */
  maxS: 4, againS: 2,
  /** m: a way round may be this much longer than the way across; the floor this near the lane is dear to the search for one (over half a nav cell's diagonal: a corner cut between two cells clear of it stays out of the lane) */
  wayMoreM: 10, berthM: 0.4,
  /** m: a way round is asked of a lane this much wider than the one a wait keeps off (a walker cuts his corners), and — once he is on it — of the round's own lane, `clearM` narrower (the gun sways) */
  edgeM: 0.15,
  /** m: the lane's length at most */
  reachM: 40,
};
/** counted, read by nothing in the game: waits begun, their seconds, the words said, ways round taken, looks that found none, frames a wait was not begun or kept for a fight of his own / for an enemy's line */
export const FIRELINE_STATS = { holds: 0, heldS: 0, cues: 0, ways: 0, noWay: 0, fight: 0, enemy: 0 };

interface St { /** when the wait began */ since: number; /** the last frame the rule had his feet */ t: number; /** the way round, corner by corner (the goal object handed to the pose is `way[0]`) */ way: Vec3[] | null; /** when a way round was last looked for */ lookT: number;
  /** when the lane lapsed with him waiting (he walks on; a lane back inside `lapseS` is the same wait), -1 = held */ goT: number; /** he has said so */ said: boolean }
const states = new SideMap<Guard, St>('fireline.states');
/** per player: the gun his rounds are counted on and its count, when the last round left it and the gap before that one, the last frame his fire was live, and
 *  the last frame a reload was what kept it so */
interface Fired { gun: string; shots: number; roundT: number; gap: number; liveT: number; relT: number }
const fired = new SideMap<Player, Fired>('fireline.fired');

/** is the rule running: on, and a round of the player's is a round to his own men (friendlyfire.ts: with that off, or a show on the stage, there is nothing to keep out of) */
function live(g: Game): boolean { return FIRELINE.on && ffLive(g); }

/** orders.ts, once a frame before it poses the men: is the player FIRING — by the rounds counted off the gun in his hands (never a launcher's load or a thrown
 *  thing: those leave no round), through a reload begun while he was, and the beat after it */
export function fireLineTick(g: Game): void {
  const K = FIRELINE; if (!K.on) return;
  const pl = g.player, gun = pl.gunInHand(), t = g.time; if (!gun) return;
  let F = fired.get(pl);
  if (!F || F.gun !== gun.def.id || gun.shotsFired < F.shots || t < Math.max(F.liveT, F.roundT)) { fired.set(pl, { gun: gun.def.id, shots: gun.shotsFired, roundT: -1e9, gap: 1e9, liveT: -1e9, relT: -1e9 }); return; }   // (another gun in his hands, or a load: counted afresh)
  if (gun.shotsFired > F.shots) { F.gap = t - F.roundT; F.roundT = t; F.shots = gun.shotsFired; }
  if (pl.down || pl.sprinting) return;
  const since = t - F.roundT;
  let on = since < Math.max(K.fireS, F.gap < K.paceS ? Math.min(K.paceS, F.gap * K.paceK) : 0);
  if (!on && gun.reloading && t - F.liveT < 0.1) { on = true; F.relT = t; }   // (the magazine out of a gun that was firing a moment ago)
  if (on || t - F.relT < K.reloadS) F.liveT = t;   // (…and the beat after it goes back in)
}

interface Lane { m: Vec3; dx: number; dz: number; /** how far behind the muzzle the lane begins: at the player's own back (nobody walks between him and his muzzle) */ back: number; k: number; half: number; energy: number | undefined; thin: number }
/** the lane of the player's fire this frame, or null: he is not firing */
function laneOf(g: Game): Lane | null {
  const K = FIRELINE, pl = g.player, c = pl.char, gun = pl.gunInHand(), F = fired.get(pl);
  if (!gun || !F || Math.abs(g.time - F.liveT) > 1e-6) return null;
  const dx = Math.sin(c.aimYaw), dz = Math.cos(c.aimYaw);
  return { m: c.muzzle, dx, dz, back: Math.min(0, (c.pos[0] - c.muzzle[0]) * dx + (c.pos[2] - c.muzzle[2]) * dz) - 0.35, k: FRIENDLYFIRE.coneK * K.spread, half: FRIENDLYFIRE.bodyM + K.clearM,
    energy: shotEnergy(g, c, gun.def), thin: wallPenLive(g) ? roundEnergy(gun.def) : -1 };
}
/** is this point of floor inside the lane by its shape alone (no wall asked) */
function inShape(L: Lane, x: number, z: number, more = 0): boolean {
  const rx = x - L.m[0], rz = z - L.m[2], a = rx * L.dx + rz * L.dz;
  return a > L.back - more && a < FIRELINE.reachM && Math.abs(rx * L.dz - rz * L.dx) <= L.half + more + Math.max(0, a) * L.k;
}
/** …and would a round reach a man standing there: his chest, or either edge of his column as the line sees it (friendlyfire.ts's own question of a friend) */
function inLane(g: Game, L: Lane, x: number, z: number, more = 0): boolean {
  if (!inShape(L, x, z, more)) return false;
  const reaches = (p: Vec3) => !g.col.shotBlocked(L.m, p, 0.02, L.energy) || (L.thin >= 0 && thinLine(g, L.m, p, L.thin) !== null);
  return reaches([x, 1.2, z]) || reaches([x + L.dz * 0.25, 1.2, z - L.dx * 0.25]) || reaches([x - L.dz * 0.25, 1.2, z + L.dx * 0.25]);
}
/** how far along the polyline `from` → `pts` (at most `far` of it) the walk first stands where `hit` says; Infinity = nowhere */
function along(from: Vec3, pts: readonly Vec3[], far: number, hit: (x: number, z: number) => boolean): number {
  let ax = from[0], az = from[2], gone = 0;
  for (const b of pts) {
    const len = Math.hypot(b[0] - ax, b[2] - az); if (len < 1e-3) continue;
    const n = Math.max(1, Math.ceil(len / 0.2));
    for (let i = 1; i <= n; i++) { const u = i / n, s = gone + len * u; if (s > far) return Infinity; if (hit(ax + (b[0] - ax) * u, az + (b[2] - az) * u)) return s; }
    gone += len; ax = b[0]; az = b[2];
  }
  return Infinity;
}
/** …where it first comes into the lane */
function crossAt(g: Game, L: Lane, from: Vec3, pts: readonly Vec3[], far: number, more = 0): number { return along(from, pts, far, (x, z) => inLane(g, L, x, z, more)); }
/** …where it first stands in a doorway */
function doorAt(g: Game, from: Vec3, pts: readonly Vec3[], far: number): number { return along(from, pts, far, (x, z) => inDoorway(g, x, z)); }
function inDoorway(g: Game, x: number, z: number): boolean {
  let q: Vec3 | null = null;
  for (const d of g.doors.list) { if (Math.hypot(x - d.frameCentre[0], z - d.frameCentre[2]) > d.def.width + 1) continue; if (inOpening(d, q ??= [x, 0, z])) return true; }
  return false;
}
/** the corners of the walk he is on to `goal`: the runner's own path while it is for that goal; with none yet (an order's first frame), the straight leg if
 *  it is a short one — else null: nothing is known of his way until the runner has planned it */
function walkOf(gd: Guard, goal: Vec3): Vec3[] | null {
  const pg = gd.pathGoal, p = gd.char.pos;
  if (pg && Math.hypot(pg[0] - goal[0], pg[2] - goal[2]) < 0.75 && gd.path.length > gd.pathI) return [...gd.path.slice(gd.pathI), goal];
  return Math.hypot(goal[0] - p[0], goal[2] - p[2]) <= 2 ? [goal] : null;
}
/** would waiting leave him standing in an enemy's line, AS FAR AS HE KNOWS (picture.ts: the heaviest idea he has of an enemy with a line to where he stands;
 *  with that switch off, a living enemy in his own sight right now) — what the picture shows the player, never a man nobody on the squad has seen */
function inEnemyLine(g: Game, gd: Guard): boolean { return PICTURE.on ? exposedAt(g, gd, gd.char.pos) > 0 : g.fight.contact(gd); }
/** a way to `goal` that keeps out of the lane, no more than `wayMoreM` longer than the way across — or null */
function wayRound(g: Game, gd: Guard, L: Lane, goal: Vec3): Vec3[] | null {
  const K = FIRELINE, nav = g.col.nav, cs = nav.cell, p = gd.char.pos;
  const len = (pts: readonly Vec3[]) => { let s = 0, a: Vec3 = p; for (const b of pts) { s += Math.hypot(b[0] - a[0], b[2] - a[2]); a = b; } return s; };
  const path = nav.findPath(p, goal, 2500, (ix, iz) => inShape(L, (ix + 0.5) * cs, (iz + 0.5) * cs, K.berthM) ? 40 : 1); if (!path?.length) return null;
  const way = [...path.map((q): Vec3 => [q[0], 0, q[2]]), goal];
  if (crossAt(g, L, p, way, Infinity, K.edgeM) < Infinity) return null;   // (the search only made the lane dear, and smooths its corners: the way it gives is walked along and asked)
  if (doorAt(g, p, way, Infinity) < Infinity) return null;   // (never through a doorway: the order's own routing knows which doors are his — locked, uncleared, the one he stacks on — and this does not)
  if (len(way) > len(walkOf(gd, goal) ?? [goal]) + K.wayMoreM) return null;
  return way;
}
function end(gd: Guard, st: St | undefined): null { if (st) states.delete(gd); return null; }
/** he stands: the wait's seconds counted as they pass */
function hold(g: Game, st: St): { speed: number } { FIRELINE_STATS.heldS += Math.min(0.1, Math.max(0, g.time - st.t)); st.t = g.time; return { speed: 0 }; }

/** orders.ts, as it poses a man on his order: his feet while the player fires down a lane his walk would cross — `speed` 0 = wait where he stands (the order's
 *  own goal kept), `goal` = the next corner of a way round (the same object until he is on it). Null: the order's own legs. `goal` = where the order is about
 *  to send him (null: it is keeping him where he stands); `mine` = something that comes first has his feet (out of Sam's own way, the silent squad's crossing). */
export function fireLineFeet(g: Game, gd: Guard, goal: Vec3 | null, speed: number, mine: boolean): { goal?: Vec3; speed: number } | null {
  const K = FIRELINE; let st = states.get(gd);
  if (!K.on) return null;
  if (st && (g.time < st.t || g.time - st.t > 0.25)) { states.delete(gd); st = undefined; }   // (a wait from before a load, or one the pose stopped asking about: gone)
  if (!live(g) || mine || !goal || !ffSide(gd) || !ffBody(gd) || gd.held) return end(gd, st);
  const L = laneOf(g);
  if (!L) {   // (the fire has stopped — or lapsed between two slow rounds: he walks on, and for `lapseS` a lane that comes back is the same wait)
    if (!st || st.way) return end(gd, st);
    if (st.goT < 0) st.goT = g.time;
    if (g.time - st.goT > K.lapseS) return end(gd, st);
    st.t = g.time; return null;
  }
  const p = gd.char.pos;
  if (g.fight.busy(gd, 1)) { FIRELINE_STATS.fight++; return end(gd, st); }   // (a fight of his own: a man on his gun, turning to one, or just lost)
  if (g.doorTools.ops.some(o => o.phase !== 'stack' && o.men.includes(gd))) return end(gd, st);   // (past the stack on a door order: the count is the entry's)
  if (g.wallCharge?.ops.some(o => o.men.includes(gd))) return end(gd, st);   // (on a wall charge: the stand-off and the entry are the charge's)
  if (inDoorway(g, p[0], p[2])) return end(gd, st);   // (committed through a doorway: he does not stop in the frame)
  if (st?.way && Math.hypot(st.way[st.way.length - 1][0] - goal[0], st.way[st.way.length - 1][2] - goal[2]) > 0.75) { states.delete(gd); st = undefined; }   // (the way round was to a place the order no longer sends him: asked afresh, of the new one)
  if (inLane(g, L, p[0], p[2], st?.way ? -K.clearM : 0)) {
    // already in it: not moved by this rule (a man who had walked on in a lapse walks out the far side). One thing else: a man WAITING whom the gun swings
    // onto stands as he stood, where the player can see him, to the wait's ceiling — unless an enemy he knows of has a line to him there
    if (!st || st.way || st.goT >= 0 || g.time - st.since >= K.maxS || inEnemyLine(g, gd)) return end(gd, st);
    return hold(g, st);
  }
  if (st?.way) {   // (on a way round: the next corner, while what is left of it keeps out of the lane)
    while (st.way.length > 1 && Math.hypot(st.way[0][0] - p[0], st.way[0][2] - p[2]) < 0.6) st.way.shift();
    if (st.way.length > 1 && crossAt(g, L, p, st.way, K.shortM, -K.clearM) === Infinity) { st.t = g.time; return { goal: st.way[0], speed }; }   // (asked of the round's own lane, without the room a wait keeps: a way that skirts the edge is not dropped for the gun's sway)
    states.delete(gd); st = undefined;   // (round it — the order's own last leg — or the lane has moved onto the way: asked afresh)
  }
  // does his way come into the lane — inside `shortM` of walking (and, a doorway between him and it, that far beyond the frame: he waits in the room, not
  // a step out of it), or, coming at it on the slant, with his next step inside `gapM` of its side
  const walk = walkOf(gd, goal) ?? (st ? [goal] : null); if (!walk) return null;
  const keep = st ? K.keepM : 0, door = doorAt(g, p, walk, 1.0);
  let near = crossAt(g, L, p, walk, K.shortM + keep + (door < Infinity ? door + 0.9 : 0)) < Infinity;
  if (!near && crossAt(g, L, p, walk, 0.35 + keep, K.gapM) < Infinity) near = crossAt(g, L, p, walk, K.lookM) < Infinity;
  if (!near) return end(gd, st);
  if (inEnemyLine(g, gd)) { FIRELINE_STATS.enemy++; return end(gd, st); }   // (never left standing in an enemy's line)
  if (!st) { states.set(gd, st = { since: g.time, t: g.time, way: null, lookT: -1e9, goT: -1, said: false }); FIRELINE_STATS.holds++; }
  st.goT = -1;
  if (!st.said && g.time - st.since >= K.cueS) { st.said = true; if (K.cue) { g.say(gd, 'your line — holding.'); FIRELINE_STATS.cues++; } }
  // the ceiling: then a look for a way round, and again every `againS` (the men of a squad that stopped together do not all look on one frame)
  if (g.time - st.since >= K.maxS + (g.guards.indexOf(gd) & 3) * 0.3 && g.time - st.lookT >= K.againS) {
    st.lookT = g.time; const way = wayRound(g, gd, L, goal);
    if (way) { FIRELINE_STATS.ways++; st.way = way; st.t = g.time; return { goal: way[0], speed }; }
    FIRELINE_STATS.noWay++;
  }
  return hold(g, st);
}
/** orders.ts, where it keeps the clocks that would call a standing man stuck: is this rule holding him where he stands (false with the switch off; a man on
 *  his way round is walking, and the order's own clocks say if he stops getting anywhere) */
export function fireLineLive(g: Game, gd: Guard): boolean {
  if (!FIRELINE.on) return false; const st = states.get(gd); return !!st && !st.way && st.goT < 0 && g.time >= st.t && g.time - st.t <= 0.25;
}
