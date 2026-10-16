// A BLAST TAKES A DOOR OFF ITS HINGES (Game.doors.blast, __doorblast; the maintainer: 'doors … can be blown off hinges').
//
// THE SEAM. Whatever sets a blast off calls ONE thing about doors: `g.doors.blast(at, tearM, who)` (doors.ts — it lands in doorBlast below). `tearM` is the
// blast's own number: the distance inside which it takes an ordinary interior leaf out of its frame (DOORBLAST.tearM is the table the callers read: a stun
// canister 0 = never, a frag 1.5 m). A charge SET ON a leaf is contact: doortools.ts blow() calls tearOff itself. A boot, a shoulder, a round, a breaching
// shotgun at the lock never come here: they leave the leaf hung (doors.ts kickIn) — but for ONE boot, the player's at a full run at the face a shut leaf opens
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
import { Vec3, v3, quat, clamp, lerp } from '../math/vec';
import { BoxFlag } from '../scene/boxes';
import type { Game } from './game';
import type { Door, DoorSlab } from './doors';
import { wandDrop } from './wand';

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
const wedged = new WeakMap<DoorSlab, number>();   // (a slab with no clear spot in reach: not searched for again for a quarter second of its own clock)
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
  d.off = true; d.angle = fly * OFF_ANGLE; d.vel = 0; d.latched = false; d.closing = false; d.passers = 0; d.quietT = 10; d.sinceBash = 10; d.creakArmed = false;
  d.slab = { p: [cx, support(d, 0), cz], v: [dx * sp, K.up, dz * sp], a, spin: back ? 0 : fly * K.spin, tip: 0, tipV: back ? 0 : K.tip, side: (back ? -fly : fly) as 1 | -1, rest: false, landed: false, who, t: 0, ang: d.angle };
  { const pl = g.player;   // Sam's hands come off it: easing it, picking its lock, keying its pad — there is no lock left to finish (a pick run on would file 'lock picked')
    if (pl.easing === d) pl.easing = null;
    if (pl.picking === d) { pl.picking = null; pl.char.anim.lockpick = false; pl.speedSm = 0; }
    if (pl.coding === d) { pl.coding = null; pl.codeT = 0; }
    if (pl.wanding?.door === d) wandDrop(pl); }   // (wand.ts: the cable was under that leaf)
  DOORBLAST_STATS.torn++; if (back) DOORBLAST_STATS.back++;
  note(g, `${d.def.name} off its hinges · k ${k.toFixed(2)} · ${back ? `no room ahead (${ahead.toFixed(2)} m): falls back` : `${ahead.toFixed(2)} m ahead`}`);
  poseSlab(d);
  g.doors.torn(d, who);
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
    b.rot = undefined; b.marks = undefined; b.h = [d.leafH[0], T / 2, d.height / 2]; b.c = [S.p[0], T / 2 + LIFT, S.p[2]];
    const tx = -uz * S.side, tz = ux * S.side;   // where its top fell
    for (const hb of d.handleBoxes) { hb.rot = undefined; hb.yaw = -S.a; hb.c = [S.p[0] + ux * lx + tx * ly, T + LIFT + 0.03, S.p[2] + uz * lx + tz * ly]; }
    return;
  }
  const q = quat.mul(quat.axisAngle([ux, 0, uz], S.side * S.tip), quat.yaw(-S.a));
  b.rot = q; b.h = d.leafH; b.c = [S.p[0], S.p[1], S.p[2]];
  for (let s = 0; s < 2; s++) { const hb = d.handleBoxes[s]; hb.rot = q; hb.yaw = -S.a; hb.c = v3.add(b.c, quat.rotate(q, [lx, ly, s === 0 ? lz : -lz])); }
}

/** CHECKPOINTS (savestate.ts): a door off its hinges is filed LYING WHERE IT COMES TO REST — a slab still in the air is run on, on a copy, to where it lands */
export interface SlabSnap { x: number; z: number; a: number; side: 1 | -1; who: number; }
export function slabSnapshot(g: Game, d: Door): SlabSnap | null {
  const S0 = d.slab; if (!d.off || !S0) return null;
  const S: DoorSlab = { ...S0, p: [S0.p[0], S0.p[1], S0.p[2]], v: [S0.v[0], S0.v[1], S0.v[2]] };
  for (let i = 0; i < 480 && !S.rest; i++) stepSlab(g, d, S, 1 / 60, true);
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return { x: r(S.p[0]), z: r(S.p[2]), a: r(S.a), side: S.side, who: S.who };
}
export function slabRestore(d: Door, s: SlabSnap, angleSign = 1) {
  const fin = (x: unknown, f = 0) => typeof x === 'number' && Number.isFinite(x) ? x : f;
  const side = s.side === -1 ? -1 : 1;
  d.off = true; d.vel = 0; d.latched = false; d.closing = false; d.locked = false; d.lockBroken = true; d.passers = 0; d.pick = 0; d.picking = false;
  d.angle = (angleSign < 0 ? -1 : 1) * OFF_ANGLE;
  d.slab = { p: [fin(s.x, d.frameCentre[0]), 0, fin(s.z, d.frameCentre[2])], v: [0, 0, 0], a: fin(s.a, d.def.closedDir), spin: 0, tip: HALF_PI, tipV: 0, side, rest: true, landed: true, who: fin(s.who, -1), t: 0, ang: d.angle };
  d.slab.p[1] = support(d, HALF_PI);
  poseSlab(d);
}

/** one line for the panel */
export function doorBlastSummary(g: Game): string {
  const off = g.doors.list.filter(d => d.off);
  return `off their hinges ▸ ${DOORBLAST.on ? '' : 'SWITCHED OFF · '}${off.length ? off.map(d => `${d.def.name}${d.slab?.rest ? '' : ' (in the air)'}`).join(' · ') : 'none'} · ${DOORBLAST_STATS.torn} torn so far`;
}
