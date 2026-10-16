// FLOOR MESS — what a blast and a broken thing LEAVE once the dust has gone out of the air ("maybe we've just blown up too much stuff but the office floor looks
// too clean"). The pall (destruction.ts CHAOS.pall) thins in seconds, the chips are particles that live eighteen, and the debris pool gives a resting chunk's
// slot to the next one thrown: after a long fight the floor was the floor it started as. With CHAOS.mess.on the room keeps the record:
//   FILM     where a burst's pall stood, a pale film of settled dust and grit on the floor, the soot rayed out of its middle — a HEART at the burst and LOBES
//            round it, each one fitted to the room: none is laid across something standing between it and the burst, and each reaches only as far as the
//            nearest thing standing between waist and head height (so the dust goes out through a doorway or the hole the blast made as a lobe of its
//            own, never under a wall that held). The desk tops standing in a film take their own; the soot is the heart's alone. A wall charge lays one each side it reached; a wall or a piece of cover that gives under fire a small one at its foot.
//   RUBBLE   a chunk the pool takes for its slot leaves the crushed mark of itself where it lay: pale grit for plaster and masonry, splinters for wood, card
//            and cloth, a smear for the rest.
// EVERY ONE of them is a decal laid only for the picture (lookDecals.ts): no ray, foot, eye, ear or die knows it, the digest does not count it, a full ring
// drops it before any mark play laid, and a checkpoint carries it like any decal. Nothing here keeps state of its own (a film that is "already there" is read
// off the decal list), draws from the game's die, or reads the wall clock: where a mark goes and how it looks is a hash of where it is.
// (src/game is one import cycle: CHAOS is read inside the calls only.)
import { Vec3, quat } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import type { Game } from './game';
import type { Chunk } from './debris';
import { hash01 } from './debris';
import { lookDecal } from './lookDecals';
import { CHAOS, chaosOf } from './destruction';
import { DESTRUCTION } from './destructionSwitch';

/** the looks the 'damage' kind draws for these marks (render/shaders/decals.wgsl damageMark: floor(param); 0‥2 are the dent / shred / crack, 3‥5 the wall wear) */
export const MESS_LOOK = { film: 6, grit: 7, splinter: 8 };
/** a tool's counters (nothing in the game reads them): films laid on a floor · on a top · rubble marks · left out as one with a mark already there · left out
 *  behind something standing or with no room · refused by a ring full of play's own marks */
export const MESS_STATS = { films: 0, tops: 0, rubble: 0, crowded: 0, shut: 0, full: 0 };
const DIRS: [number, number][] = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
const UP: Vec3 = [0, 1, 0], DOWN: Vec3 = [0, -1, 0];

interface Spread { core: number; lobes: number; reach: number; lobe: number; strength: number }

function on(g: Game): boolean { return CHAOS.mess.on && DESTRUCTION.on && g.decals.enabled && g.destr.showChaos === null && chaosOf(g) > 0; }
/** 0‥1 off a place and a number: the same mark in the same place every run */
function H(x: number, z: number, k: number): number { return hash01(Math.imul(Math.round(x * 64), 73856093) ^ Math.imul(Math.round(z * 64), 19349663) ^ Math.imul(k + 1, 2654435761)); }
function lookOf(d: { kind: string; param: number }): number { return d.kind === 'damage' ? Math.floor(d.param) : -1; }
/** may a top take a film: lit geometry that is not a glowing fixture */
function takes(b: Box): boolean { return !(b.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow)) && b.emissive[0] + b.emissive[1] + b.emissive[2] <= 0; }

const near = new Int32Array(192);
/** how far a film centred here may reach: to the nearest thing STANDING — any static whose span meets the band from waist to head height (a wall, a pane, a
 *  cabinet, a half wall; not a desk, not a sill, not a door's header) — measured to the box itself, not along a few rays (a film abreast of a doorway stops at
 *  its jambs), and `want` at most. 0 = the centre is inside one. */
function fit(g: Game, x: number, z: number, want: number): number {
  const K = CHAOS.mess; let r = want; const n = g.col.gather(x - want, z - want, x + want, z + want, K.standY, K.clearY, near);
  for (let k = 0; k < n; k++) {
    const b = g.col.boxes[near[k]]; if (!b || b.rot) continue;
    const dx = x - b.c[0], dz = z - b.c[2], cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const ex = Math.abs(cs * dx - sn * dz) - b.h[0], ez = Math.abs(sn * dx + cs * dz) - b.h[2];
    if (ex <= 0 && ez <= 0) return 0;
    r = Math.min(r, Math.hypot(Math.max(0, ex), Math.max(0, ez)) + K.under);
  }
  return r;
}

/** ONE film: on the floor at (x, z) reaching `want` at most, and on the tops that stand in it. `k` tells this patch from its burst's others; `heart` = the
 *  burst's own middle (the one film that carries the soot). */
function patch(g: Game, x: number, z: number, want: number, strength: number, k: number, heart = false): boolean {
  const K = CHAOS.mess, D = g.decals, r = fit(g, x, z, want);
  if (r < K.minRadius) { MESS_STATS.shut++; return false; }
  const lay = (y: number, rad: number, s: number, box: Box | null, top: boolean): boolean => {
    for (const d of D.list) if (lookOf(d) === MESS_LOOK.film && Math.abs(d.pos[1] - y) < 0.04 && Math.hypot(d.pos[0] - x, d.pos[2] - z) < K.crowd * Math.min(rad, d.radius)) { MESS_STATS.crowded++; return false; }
    const a = H(x, z, k + 31) * Math.PI * 2, seed = (Math.floor(H(x, z, k) * 2048) & 0x7ff) | (heart && !top ? 0x800 : 0);   // (the look seed's top bit: decals.wgsl draws the soot on a heart alone)
    const m = lookDecal(D.add('damage', [x, y, z], UP, rad, { param: MESS_LOOK.film + Math.min(0.999, Math.max(0.05, s)), look: true, seed, tangent: [Math.cos(a), 0, Math.sin(a)], attach: box ?? undefined }));
    if (!m) { MESS_STATS.full++; return false; }
    if (top) MESS_STATS.tops++; else MESS_STATS.films++;
    return true;
  };
  const laid = lay(0, r, strength, null, false);   // (the level's floor: a rug lying on it is inside the mark's own plane tolerance)
  // the tops that stand in it (desks, counters, crates — statics): a mark's plane takes every surface at its height, so ONE film a height dusts every top of
  // that height inside the reach; the nearest three heights
  const n = g.col.gather(x - r, z - r, x + r, z + r, K.top.lo, K.top.hi, near), hs: { y: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const b = g.col.boxes[near[i]]; if (!b || b.rot || !takes(b) || Math.min(b.h[0], b.h[2]) < 0.12) continue;
    const y = b.c[1] + b.h[1], d = Math.hypot(b.c[0] - x, b.c[2] - z) - Math.max(b.h[0], b.h[2]); if (y < K.top.lo || y > K.top.hi || d > r * 0.8) continue;
    const q = Math.round(y * 50) / 50, at = hs.find(h => Math.abs(h.y - q) < 0.03); if (at) at.d = Math.min(at.d, d); else hs.push({ y: q, d });
  }
  hs.sort((a, b) => a.d - b.d || a.y - b.y);
  for (const h of hs.slice(0, 3)) lay(h.y, r, strength * K.top.strength, null, true);
  // …and the prop standing under its middle (a prop's rides the prop)
  const ph = g.props.raycast([x, K.clearY, z], DOWN, K.clearY - K.top.lo);
  if (ph && ph.n[1] > 0.9 && takes(ph.box)) { const y = K.clearY - ph.t, half = Math.max(ph.box.h[0], ph.box.h[2]); if (y <= K.top.hi && half > 0.15) lay(y, Math.min(r, half * 1.15), strength * K.top.strength, ph.box, true); }
  return laid;
}

/** A HEART and its LOBES round (x, z). `face` (a unit x, z) turns the lobes into a fan that way — a charge's side of its wall — else they ring it. */
function spread(g: Game, x: number, z: number, S: Spread, size: number, face: [number, number] | null) {
  const K = CHAOS.mess;
  // a heart hard against something standing moves off it first (a 40 mm bursts a hand off the wall it met): half its reach of room, where there is room
  let cx = x, cz = z; const room = S.core * size * 0.5;
  for (let round = 0; round < 2; round++) for (const w of DIRS) {
    const hit = g.col.raycast([cx, K.clearY, cz], [w[0], 0, w[1]], room); if (!hit) continue;
    const nx = cx - w[0] * (room - hit.t), nz = cz - w[1] * (room - hit.t);
    if (!g.col.solidBlocked([cx, K.clearY, cz], [nx, K.clearY, nz])) { cx = nx; cz = nz; }
  }
  patch(g, cx, cz, S.core * size, S.strength, 0, true);
  const a0 = face ? Math.atan2(face[0], face[1]) : H(x, z, 97) * Math.PI * 2, arc = face ? Math.PI * 0.9 : Math.PI * 2;
  for (let k = 0; k < S.lobes; k++) {
    const j = H(x, z, k * 2 + 1), j2 = H(x, z, k * 2 + 2);
    const a = a0 + (face ? ((k + 0.5) / S.lobes - 0.5) * arc : k * arc / S.lobes) + (j - 0.5) * 0.6 * arc / S.lobes, d = S.reach * size * (0.75 + 0.5 * j2);
    const px = cx + Math.sin(a) * d, pz = cz + Math.cos(a) * d;
    if (g.col.solidBlocked([cx, K.clearY, cz], [px, K.clearY, pz]) || g.col.solidBlocked([cx, K.standY, cz], [px, K.standY, pz])) { MESS_STATS.shut++; continue; }   // (something stands between: the dust did not go there)
    patch(g, px, pz, S.lobe * size * (0.8 + 0.4 * j), S.strength * (0.6 + 0.3 * j2), k + 1);
  }
}

/** A BURST went off at `at` (destruction.ts blast, with the lane's chaos: the hand grenade, the 40 mm, a bomb); `size` 1 = the hand grenade's. */
export function messBurst(g: Game, at: Vec3, size = 1) {
  if (!on(g) || at[1] > CHAOS.mess.roofY) return;   // (a burst on a roof leaves the room under it alone)
  spread(g, at[0], at[2], CHAOS.mess.burst, Math.max(0.6, Math.min(1.6, size)), null);
}

/** A WALL CHARGE went off (wallcharge.ts blow): `p` on the wall's face at the charge, `n` off that face toward the charge's side, the wall `thick` m, `through`
 *  whether it opened a way (the far side's film goes only then). */
export function messWall(g: Game, p: Vec3, n: Vec3, thick: number, through: boolean) {
  if (!on(g)) return; const W = CHAOS.mess.wall;
  spread(g, p[0] + n[0] * W.out, p[2] + n[2] * W.out, W.near, 1, [n[0], n[2]]);
  if (through) spread(g, p[0] - n[0] * (thick + W.out), p[2] - n[2] * (thick + W.out), W.far, 1, [-n[0], -n[2]]);
}

/** A wall or a piece of cover OPENED over `rect` (x0, z0, x1, z1) for a reason that is not a blast's (wallbreak.ts openCells: fire, a fall): a small film at
 *  its foot, each side of its long line. */
export function messOpened(g: Game, rect: [number, number, number, number]) {
  if (!on(g)) return; const F = CHAOS.mess.foot;
  const [x0, z0, x1, z1] = rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = x1 - x0 >= z1 - z0, len = alongX ? x1 - x0 : z1 - z0, half = (alongX ? z1 - z0 : x1 - x0) / 2;
  for (const s of [1, -1]) patch(g, cx + (alongX ? 0 : s * (half + F.out)), cz + (alongX ? s * (half + F.out) : 0), F.radius + F.perMetre * len, F.strength, s > 0 ? 3 : 4);
}

/** The debris pool took a resting chunk's slot (breakTable.ts evicted): the crushed mark of it where it lay. */
export function messEvicted(g: Game, c: Chunk) {
  if (!on(g) || c.glass) return; const K = CHAOS.mess, R = K.rubble, D = g.decals, b = c.box;
  const long = Math.max(b.h[0], b.h[1], b.h[2]); if (long < R.least) return;
  const x = b.c[0], z = b.c[2], rad = Math.max(R.min, Math.min(R.max, long * R.grow));
  // what it lay on: the level under it (a chunk on a desk marks the desk), a prop's top rides the prop
  const from: Vec3 = [x, b.c[1] + 0.02, z], st = g.col.raycast(from, DOWN, b.c[1] + 0.3), ph = g.props.raycast(from, DOWN, b.c[1] + 0.3);
  let y = 0, box: Box | null = null;
  if (ph && (!st || ph.t < st.t)) { if (ph.n[1] < 0.9 || !takes(ph.box)) return; y = from[1] - ph.t; box = ph.box; }
  else if (st && st.index < 1e6 && st.n[1] > 0.9) y = from[1] - st.t;
  else if (b.c[1] > 0.6) return;   // (nothing under it that a look down finds, and it is not on the floor: no mark in the air)
  if (y > b.c[1] + 0.02 || b.c[1] - y > long + 0.25) return;
  const want = c.mat?.mat ?? c.kind, look = want === 'wood' || want === 'cardboard' || want === 'fabric' || want === 'paper' || want === 'carpet' || want === 'plant' ? MESS_LOOK.splinter : MESS_LOOK.grit;
  for (const d of D.list) { const l = lookOf(d); if ((l === MESS_LOOK.grit || l === MESS_LOOK.splinter) && Math.abs(d.pos[1] - y) < 0.04 && Math.hypot(d.pos[0] - x, d.pos[2] - z) < R.crowd * Math.min(rad, d.radius)) { MESS_STATS.crowded++; return; } }
  // long along the way the piece lay: its longest axis as it came to rest (a chunk's pose is its `rot`), laid flat
  const il = b.h[0] >= b.h[1] && b.h[0] >= b.h[2] ? 0 : b.h[1] >= b.h[2] ? 1 : 2, ax: Vec3 = [il === 0 ? 1 : 0, il === 1 ? 1 : 0, il === 2 ? 1 : 0];
  const wa: Vec3 = b.rot ? quat.rotate(b.rot, ax) : [Math.cos(b.yaw) * ax[0] + Math.sin(b.yaw) * ax[2], ax[1], -Math.sin(b.yaw) * ax[0] + Math.cos(b.yaw) * ax[2]];
  const size = Math.min(1, long / 0.3), tangent: Vec3 = Math.hypot(wa[0], wa[2]) > 0.2 ? [wa[0], 0, wa[2]] : [1, 0, 0];
  const m = lookDecal(D.add('damage', [x, y, z], UP, rad, { param: look + Math.min(0.999, R.strength * (0.6 + 0.4 * size)), look: true, seed: Math.floor(H(x, z, 7) * 4096), tangent, attach: box ?? undefined }));
  if (!m) { MESS_STATS.full++; return; }
  MESS_STATS.rubble++;
}
