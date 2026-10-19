// A BLAST TAKES A DOOR OFF ITS HINGES (Game.doors.blast, __doorblast; the maintainer: 'doors … can be blown off hinges').
//
// THE SEAM. Whatever sets a blast off calls ONE thing about doors: `g.doors.blast(at, tearM, who)` (doors.ts — it lands in doorBlast below). `tearM` is the
// blast's own number: the distance inside which it takes an ordinary interior leaf out of its frame (DOORBLAST.tearM is the table the callers read: a stun
// canister 0 = never, a frag 1.5 m). A charge SET ON a leaf is contact: doortools.ts blow() calls tearOff itself. A boot, a shoulder, a breaching
// shotgun at the lock never come here: they leave the leaf hung (doors.ts kickIn; rounds enough take a wooden one apart their own way: DOORSHOT below) — but for ONE boot, the player's at a full run at the face a shut leaf opens
// toward (sprintdoor.ts; player.ts updateKick calls tearOff): the leaf can only go where that boot sends it by leaving its frame. Steel doors do not come off.
//
// WHAT COMING OFF IS. Door.off: the leaf's own box becomes a loose SLAB — it leaves the frame away from the blast, its foot dragging, topples top-first (or, with
// no room ahead to lie in, goes flat to the far wall and falls back through its own doorway), slams flat and lies there: an ordinary 5 cm box on the floor. ONE
// MODEL: that box is still the one in the collision layer's dynamic list, so sight, shots and the sound walk find nothing in the frame and a slab under their
// lines; its SoundSeal bit is gone, so the mixer, the hearing model and the smoke bake read an open doorway; and to every reader of a door's STATE it is a door
// standing wide open, unlatched, its lock gone for good (doors.ts: angle ±OFF_ANGLE) — so the AI walks it as the open doorway it is, nobody is sent to open it,
// and no verb (use / ease / pull to / kick / pick, the lockdown's tidy-up, a defender shutting himself in) moves it. Door.reset() hangs it again, so a restart, a
// scenario's own staging and a checkpoint's clean slate all put it back; a checkpoint files it lying where it came (or would come) to rest.
//
// What it does NOT do (each a call left on the notes page): the slab hurts nobody, and furniture never feels it — flying or lying (game.ts hands the props
// the hung leaves only: a chair rolls over the slab); a blast outside tearM does nothing to a leaf at all; the slab loses its kick plates when it lands
// (markings want an upright face) and the marks rounds left on it do not ride it down; a checkpoint taken while it flies files it already lying where it
// will stop, so the load never hears it land.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3, quat, clamp, lerp } from '../math/vec';
import { BoxFlag } from '../scene/boxes';
import type { Game } from './game';
import type { Door, DoorSlab } from './doors';
import { wandDrop } from './wand';
import { WALLS } from './wallbreak';
import { FURN_BREAK } from './furnblast';
import { hash01 } from './debris';
import { gpuFx } from './particleFx';
import { civiliansShown } from './civilians';

/** the angle a door off its hinges reads as (doors.ts Door.off): wide open, whatever its own swing limits were */
export const OFF_ANGLE = Math.PI / 2;   // (doors.ts Doors.update holds an off door at ±this, whatever is written onto it)
const HALF_PI = OFF_ANGLE;

export const DOORBLAST = {
  /** THE SWITCH (Tab ▸ Sandbox ▸ Player, doors & props; ?nooffhinges): off = no blast ever takes a leaf — Doors.blast answers [] and a set charge flings the
   *  leaf in off a broken keep as it did (the build before this, by run digest) */
  on: true,
  /** metres inside which each kind of blast takes an ordinary leaf off (what its caller hands Doors.blast): `stun` is what combat.ts detonateStun hands it —
   *  0, a stun canister takes no door; `frag` (about a stride and a half) is the panel's test blast and a guess for whoever throws one — the gear and
   *  destruction goals own those callers and may hand any number of their own */
  tearM: { stun: 0, frag: 1.5 },
  /** how hard a charge set on the leaf throws it, 0‥1 of `speed` */
  chargeK: 0.55,
  /** the radius (m) a set charge hands the destruction goal's blast entry point (`g.destr.blast`, where the build carries one: a build without it calls nothing):
   *  SMALL on purpose — a charge shaped for the leaf reaches what leans on the frame and whoever listens to a blast, and takes no hole out of the wall beside the
   *  door (that would be a wall charge: the destruction page's open call). 0 = the charge calls nobody */
  chargeR: 0.8,
  /** m/s the slab leaves at: at the very edge of tearM … hard against the blast */
  speed: [3.2, 6.5] as [number, number],
  /** its hop off the sill (m/s up), the rate its top starts over at (rad/s) and the turn the tearing hinge side gives it (rad/s) */
  up: 0.9, tip: 2.4, spin: 1.3,
  /** m/s² its dragging foot takes off it while it topples · the share of its speed a slab keeps through the slam flat · m/s² sliding flat · share kept off a wall */
  scrape: 4, slam: 0.4, slide: 12, bounce: 0.15,
  /** free floor ahead (m beyond the leaf's own height) it needs to topple forward; with less it goes to the far wall and falls back through its doorway */
  room: 0.6,
  /** how loud the slab landing is (a 'door' noise at the slab, blamed on whoever set the blast off) */
  landLevel: 0.9,
};
/** (nudged / nudgeMax: slabs their resting place moved clear of a static, and the furthest; laid: the ones laid through their own doorway for want of any spot) */
export const DOORBLAST_STATS = { blasts: 0, torn: 0, landed: 0, back: 0, nudged: 0, nudgeMax: 0, laid: 0 };
export const DOORBLAST_LOG: string[] = [];
const note = (g: Game, s: string) => { DOORBLAST_LOG.push(`${g.time.toFixed(2)}s ${s}`); if (DOORBLAST_LOG.length > 200) DOORBLAST_LOG.shift(); };

/** GUNFIRE SPLINTERS A WOODEN LEAF APART (the maintainer, 10-19: 'doors should splinter apart on sustained gunfire (at least no slower than drywall)').
 *  THE COUNT is the wall engine's own: wallbreak.ts WallBreak.round hands every round that met a leaf to `leafRound` with the weight a wall's cell would
 *  have taken for it (a rifle round 1 at chaos 0.5, a pistol round WALLS.pistolK of that; of a shotgun's pellets the ones the walls are handed), and the
 *  leaf stands `leafTough()` of it — plasterboard's own number, or wood's if that were ever less — ONE count for the whole leaf, wherever on it and on
 *  whichever face the rounds land, so a door never asks for more rounds than the same aim at drywall, and gives whole where drywall keeps its sill. A
 *  round that goes on through (wallpen.ts) counts as one that stops; so does one fired with the gun pressed through the leaf (combat.ts wallAcrossArm).
 *  Past half its toll the leaf sheds splinters with every round. Then it goes IN PIECES, by the destruction's own gradient: strips along the grain cut
 *  to uneven lengths and thrown the way the round was going as rigid debris (the pool's own cap: what it refuses goes as splinters), each TAGGED WOOD and
 *  dressed by the break table (breakTable.ts retag + dress: a snapped end, a splinter's taper, a board's torn corners — a door's paint would otherwise
 *  read as masonry or sheet metal), then slivers, then dust-fine splinters; where the cuts fall goes by where the last round struck, so no two doors break alike. What is left is
 *  the LOCK RAIL lying by the frame with the handles on it — the leaf's own box, so to every reader this is a door off its hinges (Door.off: an open
 *  doorway to sight, shots, sound, smoke, the AI and every door order; reset() hangs it; a checkpoint files the rail where it lies and a leaf's count
 *  while it hangs). A steel door never does; nor does a leaf already off. Lives only where walls break (wallBreakOn: the destruction switch, never
 *  under a showcase). */
export const DOORSHOT = {
  /** THE SWITCH (Tab ▸ Player & weapons ▸ Player, doors & props; ?doorshot=0): off = no round ever does more than mark a leaf, as it was */
  on: false,
  /** the pieces: strips across the leaf × lengths up it, how uneven the cuts are (0‥1), and how many go as rigid pieces (past it, splinters) */
  strips: 4, lengths: 3, uneven: 0.6, chunks: 11,
  /** m/s a piece leaves at along the round's way (lo, hi) · across it (±) · up (lo, hi) · its tumble (rad/s) */
  fly: [1.0, 3.2], side: 1.1, up: [0.2, 1.8], spin: 9,
  /** every piece leaves already going over, its top the way the round went: tipped this far (rad: lo, hi) and toppling at this rate (rad/s: lo, hi) — a
   *  plank let go dead upright comes down on its end and the debris solver, rightly, lets it stand there */
  tilt: [0.15, 0.45], topple: [2, 5],
  /** splinters thrown on through, and back toward the gun, when it goes, at these m/s · the most a round sheds from a leaf past half its toll */
  chips: [60, 24], chipV: [4, 2.5], shed: 8,
  /** the middle of the gradient: finger-long slivers thrown on through when it goes (how many, m/s) */
  slivers: [22, 3.2],
  /** how loud the leaf going is — a 'kick' at the door, blamed on whoever fired the round: the door's own crack and dust, and to the floor's ears a door
   *  going in (guards.ts hearingCheck answers a kick floor-wide; the debrief files 'a door kicked in'), however quiet the gun was */
  level: 0.8,
};
export const DOORSHOT_STATS = { rounds: 0, splintered: 0, chunks: 0, demoted: 0 };

/** the lift that keeps the resting slab's underside off the floor plane (no z-fight, and a ray along the floor is not born inside it) */
const LIFT = 0.005;
/** the slab's centre height with its foot (or its face) on the floor at this much tip */
const support = (d: Door, tip: number) => (d.height / 2) * Math.cos(tip) + (d.thick / 2) * Math.sin(tip) + LIFT;
/** its half extent along the horizontal unit direction (ex, ez) */
function reachAlong(d: Door, S: DoorSlab, ex: number, ez: number): number {
  const ux = Math.cos(S.a), uz = Math.sin(S.a);
  return Math.abs(ex * ux + ez * uz) * d.leafH[0] + Math.abs(-ex * uz + ez * ux) * acrossOf(d, S.tip);
}
/** the nearest static (or other door's leaf) along a horizontal ray — the slab's own box is out of the list while it is stepped (withoutLeaf) */
function hitAt(g: Game, x: number, y: number, z: number, ex: number, ez: number, tmax: number): { t: number; n: Vec3 } | null {
  return g.col.raycast([x, y, z], [ex, 0, ez], tmax);
}
function withoutLeaf<T>(g: Game, d: Door, fn: () => T): T {
  const all = g.col.dynamicBoxes; g.col.dynamicBoxes = all.filter(b => b !== d.box);
  try { return fn(); } finally { g.col.dynamicBoxes = all; }
}

/** the slab's reach across its own line at this much tip */
const acrossOf = (d: Door, tip: number) => (d.height / 2) * Math.sin(tip) + (d.thick / 2) * Math.cos(tip);
const OV = new Int32Array(512);
/** does a floor rectangle — centre (x, z), heading a, half extents hu along it × hn across — cut into a static standing in the heights [y0, y1]? Exact in plan
 *  (the two rectangles' separating axes; statics that tilt are taken by their heading), a centimetre of touching allowed */
function overlaps(g: Game, x: number, z: number, a: number, hu: number, hn: number, y0: number, y1: number): boolean {
  const ux = Math.cos(a), uz = Math.sin(a), su = hu - 0.012, sn = hn - 0.012;
  const ex = Math.abs(ux) * hu + Math.abs(uz) * hn, ez = Math.abs(uz) * hu + Math.abs(ux) * hn;
  const n = g.col.gather(x - ex, z - ez, x + ex, z + ez, y0, y1, OV);
  for (let i = 0; i < n; i++) {
    const b = g.col.boxes[OV[i]], bx = Math.cos(b.yaw), bz = -Math.sin(b.yaw), dx = b.c[0] - x, dz = b.c[2] - z, c = Math.abs(ux * bx + uz * bz), s = Math.abs(ux * bz - uz * bx);
    if (Math.abs(dx * ux + dz * uz) > su + b.h[0] * c + b.h[2] * s) continue;
    if (Math.abs(-dx * uz + dz * ux) > sn + b.h[0] * s + b.h[2] * c) continue;
    if (Math.abs(dx * bx + dz * bz) > b.h[0] + su * c + sn * s) continue;
    if (Math.abs(-dx * bz + dz * bx) > b.h[2] + su * s + sn * c) continue;
    return true;
  }
  return false;
}
/** the nearest spot within maxR where that rectangle stands clear (rings of sixteen bearings, nearest first); null = none */
function freeSpot(g: Game, x: number, z: number, a: number, hu: number, hn: number, y0: number, y1: number, maxR: number): [number, number] | null {
  for (let r = 0.03; r <= maxR + 1e-9; r += r < 0.3 ? 0.03 : 0.06) for (let i = 0; i < 16; i++) {
    const th = a + i * Math.PI / 8, px = x + Math.cos(th) * r, pz = z + Math.sin(th) * r;
    if (!overlaps(g, px, pz, a, hu, hn, y0, y1)) return [px, pz];
  }
  return null;
}
/** in the air, once it is out of its frame: a slab that has come to cut into a static (a corner its rays passed either side of, a wall its toppling reached)
 *  is moved to the nearest clear spot and loses what speed it had into the thing */
const wedged = new SideMap<DoorSlab, number>('doorblast.wedged');   // (a slab with no clear spot in reach: not searched for again for a quarter second of its own clock)
function unstick(g: Game, d: Door, S: DoorSlab) {
  const hu = d.leafH[0], hn = acrossOf(d, S.tip), y0 = 0.06, y1 = Math.max(0.3, 2 * S.p[1] - 0.06);
  if (S.t < (wedged.get(S) ?? 0) || !overlaps(g, S.p[0], S.p[2], S.a, hu, hn, y0, y1)) return;
  const to = freeSpot(g, S.p[0], S.p[2], S.a, hu, hn, y0, y1, 0.45); if (!to) { wedged.set(S, S.t + 0.25); return; }
  const sx = to[0] - S.p[0], sz = to[1] - S.p[2], l = Math.hypot(sx, sz) || 1, vn = (S.v[0] * sx + S.v[2] * sz) / l;
  if (vn < 0) { S.v[0] -= vn * sx / l; S.v[2] -= vn * sz / l; }
  S.p[0] = to[0]; S.p[2] = to[1]; S.spin *= 0.3;
}
/** AT REST it lies clear of every static, whatever the flight did: where it stopped if that is clear; else the nearest clear spot, as it lies or turned a
 *  little; else laid through its own doorway (the one rectangle of floor a door's width is known to fit) */
function settle(g: Game, d: Door, S: DoorSlab, quiet: boolean) {
  const hu = d.leafH[0], hn = d.height / 2, y0 = 0.06, y1 = 0.3;
  if (!overlaps(g, S.p[0], S.p[2], S.a, hu, hn, y0, y1)) return;
  const T = quiet ? { nudged: 0, nudgeMax: 0, laid: 0 } : DOORBLAST_STATS; T.nudged++;
  for (const da of [0, 0.2, -0.2, 0.45, -0.45, HALF_PI]) { const to = freeSpot(g, S.p[0], S.p[2], S.a + da, hu, hn, y0, y1, da ? 0.9 : 1.2); if (to) { T.nudgeMax = Math.max(T.nudgeMax, Math.hypot(to[0] - S.p[0], to[1] - S.p[2])); S.p[0] = to[0]; S.p[2] = to[1]; S.a += da; return; } }
  const a = d.def.closedDir, [fx, , fz] = d.frameCentre;
  const to = overlaps(g, fx, fz, a, hu, hn, y0, y1) ? freeSpot(g, fx, fz, a, hu, hn, y0, y1, 1.5) : [fx, fz];
  if (to) { S.p[0] = to[0]; S.p[2] = to[1]; S.a = a; T.laid++; }
}

/** THE DOORS' SIDE OF A BLAST (doors.ts Doors.blast is this): every leaf within `tearM` of `at` that the blast reaches by a line no wall is in comes off. */
export function doorBlast(g: Game, at: Vec3, tearM: number, who: number): Door[] {
  const out: Door[] = []; if (!DOORBLAST.on || !(tearM > 0)) return out;
  DOORBLAST_STATS.blasts++;
  for (const { d, k } of doorBlastReach(g, at, tearM)) if (tearOff(g, d, at, who, k)) out.push(d);
  return out;
}
/** THE LEAVES a blast at `at` tearing within `tearM` takes off, each with its strength there (1 on the leaf → 0 at the reach) — the rule doorBlast applies, asked
 *  without touching anything: also what a man reckoning his cover from a burst that has not gone off yet is told (destruction.ts doorsFor → frag.ts). */
export function doorBlastReach(g: Game, at: Vec3, tearM: number): { d: Door; k: number }[] {
  const out: { d: Door; k: number }[] = []; if (!DOORBLAST.on || !(tearM > 0)) return out;
  for (const d of g.doors.list) {
    if (d.off || d.def.steel) continue;
    const [hx, hz] = d.def.hinge, W = d.def.width, px = at[0] - hx, pz = at[2] - hz;
    if (px * px + pz * pz > (W + tearM + 0.1) ** 2) continue;
    const u = d.dir(), t = clamp(px * u[0] + pz * u[1], 0, W), y = clamp(at[1], 0.05, d.height);
    const dist = Math.max(0, Math.hypot(px - u[0] * t, at[1] - y, pz - u[1] * t) - d.thick / 2);   // to the leaf where it stands, face to blast
    if (dist > tearM || !reaches(g, d, at)) continue;
    out.push({ d, k: 1 - dist / tearM });
  }
  return out;
}
/** has the blast a line to the leaf that no wall is in (the leaves themselves are not walls to it: the level's statics alone, glass included) */
function reaches(g: Game, d: Door, at: Vec3): boolean {
  const [hx, hz] = d.def.hinge, W = d.def.width, u = d.dir();
  const s = u[0] * (at[2] - hz) - u[1] * (at[0] - hx) >= 0 ? 1 : -1, off = d.thick / 2 + 0.08;   // the blast's face of it, and a point a hand off that face
  const from: Vec3 = [at[0], Math.max(at[1], 0.15), at[2]];
  const all = g.col.dynamicBoxes; g.col.dynamicBoxes = [];
  try {
    for (const f of [0.5, 0.85, 0.15]) for (const y of [1.0, 0.3, 1.8]) {
      const p: Vec3 = [hx + u[0] * W * f - u[1] * off * s, Math.min(y, d.height - 0.1), hz + u[1] * W * f + u[0] * off * s];
      if (v3.dist(from, p) < 0.12 || !g.col.solidBlocked(from, p)) return true;
    }
  } finally { g.col.dynamicBoxes = all; }
  return false;
}

/** Sam's hands come off a leaf that has left its frame: easing it, picking its lock, keying its pad — there is no lock left to finish (a pick run on would
 *  file 'lock picked') */
function handsOff(g: Game, d: Door) {
  const pl = g.player;
  if (pl.easing === d) pl.easing = null;
  if (pl.picking === d) { pl.picking = null; pl.char.anim.lockpick = false; pl.speedSm = 0; }
  if (pl.coding === d) { pl.coding = null; pl.codeT = 0; }
  if (pl.wanding?.door === d) wandDrop(pl);   // (wand.ts: the cable was under that leaf)
}

/** THE LEAF COMES OFF: out of its frame away from `from` (where the blast was), thrown `k` (0‥1) of DOORBLAST.speed; `who` is blamed for the crack of it and for
 *  the slam when it lands. False (and nothing done) with the switch off, for a steel door, and for one already off. */
export function tearOff(g: Game, d: Door, from: Vec3, who: number, k = 1): boolean {
  const K = DOORBLAST; if (!K.on || d.off || d.def.steel) return false;
  const [hx, hz] = d.def.hinge, W = d.def.width, a = d.def.closedDir + d.angle, ux = Math.cos(a), uz = Math.sin(a);
  const cx = hx + ux * (W * 0.5 + 0.01), cz = hz + uz * (W * 0.5 + 0.01);
  const face = ux * (from[2] - hz) - uz * (from[0] - hx) >= 0 ? 1 : -1;      // the face the blast is on (+1: the CCW side, doors.ts side())
  const fly = -face as 1 | -1, nx = -uz * fly, nz = ux * fly;                 // … and the normal it leaves along
  // the frame lets go: the keep and the hinges out of the jamb — heard, and drawn, as a boot through the lock is (the leaf still in its frame for the handler)
  if (!d.lockBroken) d.noticed = false;
  d.locked = false; d.lockBroken = true; d.pick = 0; d.picking = false; d.rattleT = 0; d.lastWho = who;
  g.doors.sound(d, 'kick', d.pos, who, 1.0);
  // room to lie in ahead? (three rays at shin height off the leaf's own line)
  let ahead = 9;
  withoutLeaf(g, d, () => { for (const f of [0, -0.4, 0.4]) { const h = hitAt(g, cx + ux * W * f + nx * 0.06, 0.2, cz + uz * W * f + nz * 0.06, nx, nz, 9); if (h) ahead = Math.min(ahead, h.t + 0.06); } });
  const back = ahead < d.height + K.room;
  let dx = nx, dz = nz;
  if (!back) { const rx = cx - from[0], rz = cz - from[2], rl = Math.hypot(rx, rz); if (rl > 0.05) { dx += 0.35 * rx / rl; dz += 0.35 * rz / rl; const l = Math.hypot(dx, dz); dx /= l; dz /= l; } }   // a little of the blast's own bearing
  const sp = lerp(K.speed[0], K.speed[1], clamp(k, 0, 1)) * (back ? 0.7 : 1);
  d.off = true; d.angle = fly * OFF_ANGLE; d.vel = 0; d.latched = false; d.closing = false; d.passers = 0; d.quietT = 10; d.sinceBash = 10; d.creakArmed = false; d.shot = 0;
  d.slab = { p: [cx, support(d, 0), cz], v: [dx * sp, K.up, dz * sp], a, spin: back ? 0 : fly * K.spin, tip: 0, tipV: back ? 0 : K.tip, side: (back ? -fly : fly) as 1 | -1, rest: false, landed: false, who, t: 0, ang: d.angle };
  handsOff(g, d);
  DOORBLAST_STATS.torn++; if (back) DOORBLAST_STATS.back++;
  note(g, `${d.def.name} off its hinges · k ${k.toFixed(2)} · ${back ? `no room ahead (${ahead.toFixed(2)} m): falls back` : `${ahead.toFixed(2)} m ahead`}`);
  poseSlab(d);
  g.doors.torn(d, who);
  return true;
}

/** the rounds' work a leaf stands, in the wall engine's unit (WALLS.tough: rifle rounds into one cell at chaos 0.5): never more than plasterboard's */
export function leafTough(): number { return Math.min(WALLS.tough.drywall ?? 6, WALLS.tough.wood ?? 9); }

/** A ROUND MET A LEAF (DOORSHOT): dynamic box `index − 1e6`, at `hitP`, going `dir`, worth `w` of a wall cell's toll — WallBreak.round calls it for every
 *  round that stopped in, or went on through, a door leaf. Nothing with the switch off, for a steel door, for one off its hinges (its box is the rail). */
export function leafRound(g: Game, index: number, who: number, hitP: Vec3, dir: Vec3, w: number) {
  const K = DOORSHOT; if (!K.on) return;
  const b = g.col.dynamicBoxes[index - 1e6]; if (!b) return;
  const d = g.doors.list.find(x => x.box === b); if (!d || d.off || d.def.steel) return;
  d.shot += w; DOORSHOT_STATS.rounds++;
  const share = d.shot / leafTough();
  if (share >= 1) { splinter(g, d, dir, who, hitP); return; }
  if (share > 0.5) { const P = gpuFx(g), l = Math.hypot(dir[0], dir[1], dir[2]) || 1;   // (past half its toll: every round takes splinters out of its far face)
    if (P) P.emit('debris', [hitP[0] + dir[0] / l * (d.thick + 0.02), hitP[1], hitP[2] + dir[2] / l * (d.thick + 0.02)], [dir[0] / l, dir[1] / l, dir[2] / l], Math.round(K.shed * Math.min(1, share)), { speed: K.chipV[1], speedJit: 0.7, spread: 0.9, life: 16, lifeJit: 0.3, size: 0.006, sizeJit: 0.6, aspect: 3, color: v3.copy(d.box.albedo), owner: who }); }
}

/** THE LEAF GOES IN PIECES, the way a round travelling `dir` sends it; `who` is blamed for the crack of it and for what its pieces hit. False (and nothing
 *  done) with the switch off, for a steel door, and for one already off. `at`: where the round struck (the cuts fall by it; absent: by the door alone). */
export function splinter(g: Game, d: Door, dir: Vec3, who: number, at?: Vec3): boolean {
  const K = DOORSHOT; if (!K.on || d.off || d.def.steel) return false;
  const [hx, hz] = d.def.hinge, W = d.def.width, H = d.height, T = d.thick, a = d.def.closedDir + d.angle, ux = Math.cos(a), uz = Math.sin(a);
  const cx = hx + ux * (W * 0.5 + 0.01), cz = hz + uz * (W * 0.5 + 0.01), hw = d.leafH[0], albedo = d.box.albedo, yaw = d.box.yaw;
  const fly = (dir[2] * ux - dir[0] * uz >= 0 ? 1 : -1) as 1 | -1, nx = -uz * fly, nz = ux * fly;   // the face the round left by (+1: the CCW side) and the normal out of it
  let dx = dir[0], dz = dir[2]; { const l = Math.hypot(dx, dz); if (l < 0.2) { dx = nx; dz = nz; } else { dx = 0.6 * dx / l + 0.4 * nx; dz = 0.6 * dz / l + 0.4 * nz; const m = Math.hypot(dx, dz); dx /= m; dz /= m; } }   // (a round that ran along the leaf still sends it off its face)
  // the frame lets go, as for a leaf torn off (tearOff): the lock is matchwood
  if (!d.lockBroken) d.noticed = false;
  d.locked = false; d.lockBroken = true; d.pick = 0; d.picking = false; d.rattleT = 0; d.lastWho = who;
  g.doors.sound(d, 'kick', d.pos, who, K.level);
  // the cuts: strips along the grain (across the leaf), each to uneven lengths; the piece the handles are on is the lock rail and stays the leaf's own box
  const struck = at ? Math.floor(((at[0] - hx) * ux + (at[2] - hz) * uz) * 16) * 7 + Math.floor(at[1] * 16) * 31 : 0;
  const seed = g.doors.list.indexOf(d) * 977 + 131 + struck, R = (k: number) => hash01((seed + k) * 2654435761);
  const cuts = (n: number, salt: number): number[] => { const c = [-1]; for (let j = 1; j < n; j++) c.push(-1 + 2 * (j + (R(salt + j) - 0.5) * K.uneven) / n); c.push(1); return c; };
  const xs = cuts(Math.max(1, K.strips), 10), handleX = (W - 0.14) - (W * 0.5 + 0.01), handleY = 1.0 - (H / 2 + 0.01);
  let left = K.chunks, rail: [number, number, number, number] | null = null, railX = 0, k = 100; const P = gpuFx(g), land = FURN_BREAK.wood.land;
  for (let i = 0; i + 1 < xs.length; i++) {
    const ys = cuts(Math.max(1, K.lengths), 20 + i * 8), lx = (xs[i] + xs[i + 1]) / 2 * hw, sw = (xs[i + 1] - xs[i]) / 2 * hw;
    for (let j = 0; j + 1 < ys.length; j++) {
      const ly = (ys[j] + ys[j + 1]) / 2 * H / 2, sl = (ys[j + 1] - ys[j]) / 2 * H / 2;
      if (!rail && Math.abs(handleX - lx) <= sw && Math.abs(handleY - ly) <= sl) { const mx = Math.max(0, sw - 0.065), my = Math.max(0, sl - 0.03); rail = [sw, sl, clamp(handleX - lx, -mx, mx), clamp(handleY - ly, -my, my)]; railX = lx; continue; }   // (the levers whole on the piece, not hanging off its cut edge)
      const r1 = R(k++), r2 = R(k++), r3 = R(k++), sp = lerp(K.fly[0], K.fly[1], r1); let sd = (r2 - 0.5) * 2 * K.side;
      if (sd * lx > 0 && Math.abs(lx) > hw * 0.4) sd *= -0.5;   // (a piece by a jamb goes in toward the opening, not into the frame beside it)
      const top = fly * lerp(K.topple[0], K.topple[1], r2);   // (about the leaf's width axis: its top the way the round left)
      const f = { ...d.box, c: [cx + ux * lx, H / 2 + 0.01 + ly, cz + uz * lx] as Vec3, h: [sw, sl, T / 2] as Vec3, yaw, rot: quat.mul(quat.axisAngle([ux, 0, uz], fly * lerp(K.tilt[0], K.tilt[1], r3)), quat.yaw(yaw)), marks: undefined };
      const v: Vec3 = [dx * sp + ux * sd, lerp(K.up[0], K.up[1], r3), dz * sp + uz * sd], w: Vec3 = [(r1 - 0.5) * K.spin + ux * top, (r2 - 0.5) * 0.6 * K.spin, (r3 - 0.5) * K.spin + uz * top];
      const got = left-- > 0 ? g.destr?.debris.spawn('chunk', f, v, w, who) ?? null : null;
      if (got) { DOORSHOT_STATS.chunks++; got.level = land.level; got.sfx = land.sfx; g.destr.breaks.retag(got, 'wood'); g.destr.breaks.dress(got); }   // (wood whatever its paint: a snapped end, not a clean rectangle)
      else { DOORSHOT_STATS.demoted++; if (P) P.emit('debris', f.c, v3.normalize([v[0], Math.max(0.3, v[1]), v[2]]), 14, { speed: 2.4, speedJit: 0.7, spread: 1.1, life: 18, lifeJit: 0.3, size: 0.006, sizeJit: 0.6, aspect: 3, color: v3.copy(albedo), owner: who }); }
    }
  }
  if (P) P.emit('debris', [cx, H * 0.5, cz], v3.normalize([dx, 0.3, dz]), K.slivers[0], { speed: K.slivers[1], speedJit: 0.6, spread: 0.9, life: 20, lifeJit: 0.3, size: 0.028, sizeJit: 0.5, aspect: 5, color: v3.copy(albedo), owner: who });
  if (P) for (const [s, n, sp] of [[1, K.chips[0], K.chipV[0]], [-1, K.chips[1], K.chipV[1]]]) P.emit('debris', [cx, H * 0.55, cz], v3.normalize([dx * s, 0.25, dz * s]), n, { speed: sp, speedJit: 0.7, spread: 1.1, life: 18, lifeJit: 0.3, size: 0.006, sizeJit: 0.6, aspect: 3, color: v3.copy(albedo), owner: who });
  // what is left: the lock rail, lying where it dropped a little the round's way — clear of every static, or laid in its own doorway
  const bits: [number, number, number, number] = rail ?? [hw / Math.max(1, K.strips), H / 2 / Math.max(1, K.lengths), 0, 0], y0 = 0.06, y1 = 0.3; let ra = a + (R(7) - 0.5) * 0.8;
  let px = cx + ux * railX + dx * 0.3, pz = cz + uz * railX + dz * 0.3;
  if (overlaps(g, px, pz, ra, bits[0], bits[1], y0, y1)) { const to = freeSpot(g, px, pz, ra, bits[0], bits[1], y0, y1, 0.9); if (to) { px = to[0]; pz = to[1]; } else { [px, , pz] = d.frameCentre; ra = d.def.closedDir; } }
  d.off = true; d.angle = fly * OFF_ANGLE; d.vel = 0; d.latched = false; d.closing = false; d.passers = 0; d.quietT = 10; d.sinceBash = 10; d.creakArmed = false; d.shot = 0;
  d.slab = { p: [px, T / 2 + LIFT, pz], v: [0, 0, 0], a: ra, spin: 0, tip: HALF_PI, tipV: 0, side: fly, rest: true, landed: true, who, t: 0, ang: d.angle, bits };
  handsOff(g, d);
  DOORSHOT_STATS.splintered++;
  note(g, `${d.def.name} splintered by gunfire · ${DOORSHOT_STATS.chunks} pieces so far`);
  poseSlab(d);
  // a body asleep against the leaf slides down now that it is gone (a sleeping ragdoll never looks; game.ts updateDoors wakes them only for a leaf that moved in its own step)
  for (const ch of [g.player.char, ...g.guards.map(o => o.char), ...civiliansShown(g).map(o => o.char)]) { const rag = ch.ragdoll; if (!rag?.sleeping) continue; const h = ch.bones.hips ?? ch.pos; if (Math.hypot(h[0] - hx, h[2] - hz) < W + 1.2 || Math.hypot(h[0] - px, h[2] - pz) < bits[1] + 0.8) rag.wake(); }
  g.doors.torn(d, who, 'fire');
  return true;
}

/** Once a frame (Game.updateDoors, after Doors.update): every loose slab still moving is stepped and posed. */
export function doorSlabs(g: Game, dt: number) {
  for (const d of g.doors.list) { const S = d.slab; if (!d.off || !S || S.rest) continue; stepSlab(g, d, S, dt, false); poseSlab(d); }
}

/** the slab's rigid-ish flight: a plank with its foot on the floor — it translates, drags, topples about its foot onto the face `side` names, slams flat,
 *  slides out; walls stop it dead (a swept ray along its travel, then a push-out along its own two floor axes as toppling lengthens it) */
function stepSlab(g: Game, d: Door, S: DoorSlab, dt: number, quiet: boolean) {
  const K = DOORBLAST, n = Math.max(1, Math.ceil(dt * 120)), h = dt / n, G = 9.8;
  withoutLeaf(g, d, () => {
    for (let i = 0; i < n && !S.rest; i++) {
      S.t += h;
      const flat = S.tip >= HALF_PI;
      if (!flat && (S.tipV > 0 || S.tip > 0)) { S.tipV += (1.5 * G / d.height) * Math.sin(Math.max(S.tip, 0.05)) * h; S.tip = Math.min(HALF_PI, S.tip + S.tipV * h); }
      // up and down: ballistic, never below what its tip stands it at
      const sup = support(d, S.tip); S.v[1] -= G * h; S.p[1] += S.v[1] * h;
      const down = S.p[1] <= sup; if (down) { S.p[1] = sup; if (S.v[1] < 0) S.v[1] = 0; }
      // along the floor
      let sp = Math.hypot(S.v[0], S.v[2]);
      if (sp > 1e-5) { const ns = down ? Math.max(0, sp - (flat ? K.slide : K.scrape) * h) : sp; S.v[0] *= ns / sp; S.v[2] *= ns / sp; sp = ns; }
      S.a += S.spin * h; if (down) S.spin *= Math.exp(-(flat ? 14 : 1.5) * h);
      let hitWall = false;
      if (sp > 1e-5) {
        const ex = S.v[0] / sp, ez = S.v[2] / sp, len = sp * h, he = reachAlong(d, S, ex, ez);
        let adv = len, N: Vec3 | null = null;
        for (const y of [0.2, clamp(S.p[1], 0.4, 1.3)]) { const H = hitAt(g, S.p[0], y, S.p[2], ex, ez, len + he + 0.02); if (H && H.t - he - 0.01 < adv) { adv = Math.max(0, H.t - he - 0.01); N = H.n; } }
        S.p[0] += ex * adv; S.p[2] += ez * adv;
        if (N) { const nl = Math.hypot(N[0], N[2]) || 1, wx = N[0] / nl, wz = N[2] / nl, vn = S.v[0] * wx + S.v[2] * wz; if (vn < 0) { S.v[0] -= (1 + K.bounce) * vn * wx; S.v[2] -= (1 + K.bounce) * vn * wz; } S.spin *= 0.3; hitWall = true; }
      }
      if (S.tipV === 0 && S.tip === 0 && (hitWall || sp < 0.4)) S.tipV = K.tip;   // (no room ahead: flat to the far wall first — now it comes back down)
      pushOut(g, d, S);
      if (S.t > 0.15) unstick(g, d, S);
      if ((S.tip >= HALF_PI || S.t > 6) && !S.landed) {   // flat: the slam (the six-second cap lands it too — nothing a wall can do keeps it in the air)
        S.tip = HALF_PI; S.landed = true; S.p[1] = support(d, HALF_PI); settle(g, d, S, quiet); S.v[0] *= K.slam; S.v[2] *= K.slam; if (S.v[1] > 0) S.v[1] = 0;
        if (!quiet) { DOORBLAST_STATS.landed++; g.doors.sound(d, 'bang', [S.p[0], 0.1, S.p[2]], S.who, K.landLevel); }
      }
      if (S.landed && ((Math.hypot(S.v[0], S.v[2]) < 0.05 && Math.abs(S.spin) < 0.08) || S.t > 6)) {
        S.rest = true; S.v = [0, 0, 0]; S.spin = 0; S.p[1] = support(d, HALF_PI); settle(g, d, S, quiet);
        if (!quiet) note(g, `${d.def.name} slab at rest (${S.p[0].toFixed(2)}, ${S.p[2].toFixed(2)}) after ${S.t.toFixed(2)} s`);
      }
    }
  });
}
/** keep the slab's floor rectangle out of the statics as toppling (and its spin) lengthen it: along each of its two floor axes, both ways, from its centre line
 *  and from either side of it — what a ray finds nearer than the slab reaches moves the slab back by the difference */
function pushOut(g: Game, d: Door, S: DoorSlab) {
  const ux = Math.cos(S.a), uz = Math.sin(S.a), nx = -uz, nz = ux, hu = d.leafH[0], hn = acrossOf(d, S.tip);
  const ym = clamp(S.p[1], 0.4, 1.3);
  for (let pass = 0; pass < 2; pass++) for (const [ex, ez, he, sx, sz, hs] of [[nx, nz, hn, ux, uz, hu], [-nx, -nz, hn, ux, uz, hu], [ux, uz, hu, nx, nz, hn], [-ux, -uz, hu, nx, nz, hn]] as const) {
    let pen = 0;
    for (const f of [0, -0.8, 0.8]) for (const y of f === 0 ? [0.2, ym] : [0.2]) {
      const H = hitAt(g, S.p[0] + sx * hs * f, y, S.p[2] + sz * hs * f, ex, ez, he + 0.02); if (H && he - H.t > pen) pen = he - H.t;
    }
    if (pen > 0) { S.p[0] -= ex * (pen + 0.002); S.p[2] -= ez * (pen + 0.002); const vn = S.v[0] * ex + S.v[2] * ez; if (vn > 0) { S.v[0] -= vn * ex; S.v[2] -= vn * ez; } }
  }
}

/** the slab's box (and the two handles on it) where the slab is: tilted by a quaternion while it topples; from the slam on an ordinary yaw-only box lying flat, so
 *  every yaw-only reader of the collision layer's dynamic list (bodies, the smoke bake) has it as what it is */
export function poseSlab(d: Door) {
  const S = d.slab; if (!S) return; const b = d.box, W = d.def.width, T = d.thick;
  const ux = Math.cos(S.a), uz = Math.sin(S.a), lx = (W - 0.14) - (W * 0.5 + 0.01), ly = 1.0 - (d.height / 2 + 0.01), lz = T / 2 + 0.03;
  b.flags &= ~BoxFlag.SoundSeal; b.yaw = -S.a;
  if (S.landed) {   // (flat — sliding out or at rest)
    const hw = S.bits ? S.bits[0] : d.leafH[0], hl = S.bits ? S.bits[1] : d.height / 2;   // (bits: the lock rail of a leaf gunfire splintered — DOORSHOT)
    b.rot = undefined; b.marks = undefined; b.h = [hw, T / 2, hl]; b.c = [S.p[0], T / 2 + LIFT, S.p[2]];
    const tx = -uz * S.side, tz = ux * S.side;   // where its top fell
    const kx = S.bits ? S.bits[2] : lx, ky = S.bits ? S.bits[3] : ly;   // (the handles stay where they are screwed to the piece)
    for (const hb of d.handleBoxes) { hb.rot = undefined; hb.yaw = -S.a; hb.c = [S.p[0] + ux * kx + tx * ky, T + LIFT + 0.03, S.p[2] + uz * kx + tz * ky]; }
    return;
  }
  const q = quat.mul(quat.axisAngle([ux, 0, uz], S.side * S.tip), quat.yaw(-S.a));
  b.rot = q; b.h = d.leafH; b.c = [S.p[0], S.p[1], S.p[2]];
  for (let s = 0; s < 2; s++) { const hb = d.handleBoxes[s]; hb.rot = q; hb.yaw = -S.a; hb.c = v3.add(b.c, quat.rotate(q, [lx, ly, s === 0 ? lz : -lz])); }
}

/** CHECKPOINTS (savestate.ts): a door off its hinges is filed LYING WHERE IT COMES TO REST — a slab still in the air is run on, on a copy, to where it lands */
export interface SlabSnap { x: number; z: number; a: number; side: 1 | -1; who: number; /** DOORSHOT: the lock rail of a leaf that went in pieces — its half width and half length, and where on it the handles are (absent: the whole leaf) */ bits?: [number, number, number, number]; }
export function slabSnapshot(g: Game, d: Door): SlabSnap | null {
  const S0 = d.slab; if (!d.off || !S0) return null;
  const S: DoorSlab = { ...S0, p: [S0.p[0], S0.p[1], S0.p[2]], v: [S0.v[0], S0.v[1], S0.v[2]] };
  for (let i = 0; i < 480 && !S.rest; i++) stepSlab(g, d, S, 1 / 60, true);
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return { x: r(S.p[0]), z: r(S.p[2]), a: r(S.a), side: S.side, who: S.who, ...(S.bits ? { bits: [r(S.bits[0]), r(S.bits[1]), r(S.bits[2]), r(S.bits[3])] as [number, number, number, number] } : {}) };
}
export function slabRestore(d: Door, s: SlabSnap, angleSign = 1) {
  const fin = (x: unknown, f = 0) => typeof x === 'number' && Number.isFinite(x) ? x : f;
  const side = s.side === -1 ? -1 : 1;
  d.off = true; d.vel = 0; d.latched = false; d.closing = false; d.locked = false; d.lockBroken = true; d.passers = 0; d.pick = 0; d.picking = false;
  d.angle = (angleSign < 0 ? -1 : 1) * OFF_ANGLE;
  d.slab = { p: [fin(s.x, d.frameCentre[0]), 0, fin(s.z, d.frameCentre[2])], v: [0, 0, 0], a: fin(s.a, d.def.closedDir), spin: 0, tip: HALF_PI, tipV: 0, side, rest: true, landed: true, who: fin(s.who, -1), t: 0, ang: d.angle };
  d.slab.p[1] = support(d, HALF_PI);
  if (Array.isArray(s.bits) && fin(s.bits[0]) > 0 && fin(s.bits[1]) > 0) { const bw = Math.min(d.leafH[0], fin(s.bits[0])), bl = Math.min(d.height / 2, fin(s.bits[1])); const mx = Math.max(0, bw - 0.065), my = Math.max(0, bl - 0.03); d.slab.bits = [bw, bl, clamp(fin(s.bits[2]), -mx, mx), clamp(fin(s.bits[3]), -my, my)]; }
  poseSlab(d);
}

/** one line for the panel */
export function doorBlastSummary(g: Game): string {
  const off = g.doors.list.filter(d => d.off);
  return `off their hinges ▸ ${DOORBLAST.on ? '' : 'SWITCHED OFF · '}${off.length ? off.map(d => `${d.def.name}${d.slab?.rest ? '' : ' (in the air)'}`).join(' · ') : 'none'} · ${DOORBLAST_STATS.torn} torn so far`;
}
