// The marks an encounter leaves (experiment E1): the game's side of render/decals.ts — one call per place something hits something. Each helper works out
// WHICH surface took it (a static, a door leaf, a piece of furniture — the last two ride the box they are on), refuses the surfaces a mark would float on
// (light-only geometry, glowing fixtures, glass-thin trims), and hands decals.add a kind, a point, a normal and a size. Nothing here draws from Math.random:
// a seeded QA run with decals on is byte for byte the run with them off (the look seed counts inside Decals).
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import type { Game } from './game';
import type { Door } from './doors';
import type { WeaponDef } from './weapons';
import * as fx from './effects';

/** What a CPU ray reported hitting, in the terms the three ray casters use: a static by index (col.raycast < 1e6), a door leaf (col.raycast ≥ 1e6), a prop part box. */
export type Surface = { box: Box; dynamic: boolean } | null;

/** col.raycast's index → the box it names (statics are the level's list = the GPU's static block; ≥ 1e6 = a door leaf, which moves) */
export function staticSurface(g: Game, index: number): Surface {
  if (index >= 1e6) { const b = g.col.dynamicBoxes[index - 1e6]; return b ? { box: b, dynamic: true } : null; }
  const b = g.col.boxes[index]; return b ? { box: b, dynamic: false } : null;
}

/** may a mark sit on this box: not light-only / ray-invisible geometry, not a glowing fixture (its light really goes when shot — a hole in the glow would not), not
 *  a sliver thinner than a centimetre on its narrow faces */
function markable(b: Box, n: Vec3): boolean {
  if (b.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow)) return false;
  if (b.emissive[0] + b.emissive[1] + b.emissive[2] > 0) return false;
  return faceHalfExtents(b, n).every(e => e > 0.006);
}
/** the two in-plane half extents of the face of b whose normal is n (world) */
function faceHalfExtents(b: Box, n: Vec3): [number, number] {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const l: Vec3 = b.rot ? n : [cs * n[0] - sn * n[2], n[1], sn * n[0] + cs * n[2]];   // (rot boxes never take marks in practice — hand props, sparks; treat n as local)
  const a = Math.abs(l[0]) >= Math.abs(l[1]) && Math.abs(l[0]) >= Math.abs(l[2]) ? 0 : Math.abs(l[1]) >= Math.abs(l[2]) ? 1 : 2;
  return a === 0 ? [b.h[1], b.h[2]] : a === 1 ? [b.h[0], b.h[2]] : [b.h[0], b.h[1]];
}

/** A round stopped in `s` at `hitP` (its face normal `n`): a bullet hole sized by the row's calibre — a pistol's chip smaller than a rifle's. Flesh, the sky and
 *  the surfaces markable() refuses leave nothing. */
export function bulletMark(g: Game, hitP: Vec3, n: Vec3, s: Surface, def: WeaponDef) {
  if (!s || !markable(s.box, n)) return;
  const mm = parseFloat(def.calibre) || 6;                       // '5.7×28 mm' → 5.7
  const rifle = def.cls !== 'pistol';
  g.decals.add('bullet', hitP, n, rifle ? 0.031 : 0.025, { param: Math.max(0.75, Math.min(1.6, mm / 6)) * (rifle ? 1.1 : 1), clampTo: s.box, attach: s.dynamic ? s.box : undefined });
}

/** The stun charge went off at `at` (combat.ts detonateStun: a hand above the resting can): the big scorch on whatever it lay on — the floor, a desk, the seat of a
 *  chair (that one rides the chair) — and weaker splashes up the statics / leaves / furniture standing within a metre, fading with distance. */
export function bangScorch(g: Game, at: Vec3) {
  if (!g.decals.enabled) return;
  const from: Vec3 = [at[0], at[1] + 0.25, at[2]]; const down: Vec3 = [0, -1, 0];
  // what it lay on: the nearer of a static / leaf under it and a prop part under it (a can that came to rest on a carton scorches the carton)
  const st = g.col.raycast(from, down, 1.5); const ph = g.props.raycast(from, down, 1.5);
  if (ph && (!st || ph.t < st.t)) {
    const [ex, ez] = faceHalfExtents(ph.box, ph.n);
    if (markable(ph.box, ph.n)) g.decals.add('scorch', v3.mad(from, down, ph.t), ph.n, Math.min(0.55, Math.max(ex, ez) * 1.15), { param: 1, attach: ph.box });
  } else if (st) {
    const s = staticSurface(g, st.index);
    if (s && markable(s.box, st.n)) g.decals.add('scorch', v3.mad(from, down, st.t), st.n, 0.62 + 0.28 * unit(g.decals.count * 7.31), { param: 1, attach: s.dynamic ? s.box : undefined });
  }
  // the splash round it: sixteen looks out level from the burst; each wall / leaf / prop face met within a metre takes ONE smaller, weaker scorch — at the
  // nearest point any look found on that box, centred a hand or two up it, fading with distance
  const eye: Vec3 = [at[0], Math.max(at[1], 0.06) + 0.06, at[2]];
  const nearest = new Map<Box, { t: number; p: Vec3; n: Vec3; s: NonNullable<Surface> }>();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2; const dir: Vec3 = [Math.cos(a), 0, Math.sin(a)];
    const sh = g.col.raycast(eye, dir, 1.0); const pp = g.props.raycast(eye, dir, 1.0);
    let t: number, n: Vec3, s: Surface;
    if (pp && (!sh || pp.t < sh.t)) { t = pp.t; n = pp.n; s = { box: pp.box, dynamic: true }; }
    else if (sh) { t = sh.t; n = sh.n; s = staticSurface(g, sh.index); }
    else continue;
    if (!s || Math.abs(n[1]) > 0.3 || !markable(s.box, n)) continue;
    const was = nearest.get(s.box); if (was && was.t <= t) continue;
    nearest.set(s.box, { t, p: v3.mad(eye, dir, t), n, s });
  }
  const placed: Vec3[] = [];
  for (const h of [...nearest.values()].sort((a, b) => a.t - b.t)) {
    if (placed.some(q => v3.dist(q, h.p) < 0.5)) continue;   // two boxes meeting at a corner right by the can: one splash does for both
    placed.push(h.p);
    const k = 1 - h.t / 1.0;
    const centre: Vec3 = [h.p[0], h.p[1] + 0.22 * k, h.p[2]];
    g.decals.add('scorch', centre, h.n, 0.22 + 0.34 * k, { param: 0.35 + 0.6 * k, attach: h.s.dynamic ? h.s.box : undefined, clampTo: h.s.dynamic ? h.s.box : undefined });
  }
}

/** A boot through the lock of leaf `d` from `from`'s side (player.ts updateKick at the impact): a rubber scuff by the lock at kicking height on THAT face, riding the
 *  leaf as it flies. */
export function kickScuff(g: Game, d: Door, from: Vec3) {
  if (!g.decals.enabled) return;
  const side = g.doors.side(d, from); const u = d.dir(); const W = d.def.width;
  const along = Math.max(W * 0.5, Math.min(W - 0.2, (from[0] - d.def.hinge[0]) * u[0] + (from[2] - d.def.hinge[1]) * u[1]));   // by the lock, on the outer half (Doors.kickSpot's own clamp)
  const n: Vec3 = [-u[1] * side, 0, u[0] * side];                                                                             // out of the leaf on the kicker's side
  const k = unit(g.decals.count * 3.77 + along);
  const y = 0.8 + 0.12 * k;
  const p: Vec3 = [d.def.hinge[0] + u[0] * along + n[0] * (d.thick / 2), y, d.def.hinge[1] + u[1] * along + n[2] * (d.thick / 2)];
  const slant = -0.25 - 0.35 * unit(k * 5.1);                                                                                  // the sole comes across and down a little
  const t: Vec3 = v3.normalize([u[0] * side, slant, u[1] * side]);
  g.decals.add('scuff', p, n, undefined, { param: 0.13 + 0.06 * k, tangent: t, attach: d.box, clampTo: d.box });
}

/** Something small and hard met `s` at `p` (the ring airfoil's clack, launcher.ts): a pale chip out of the finish. */
export function chipMark(g: Game, p: Vec3, n: Vec3, s: Surface, size = 0.013) {
  if (!s || !markable(s.box, n)) return;
  g.decals.add('chip', p, n, size, { clampTo: s.box, attach: s.dynamic ? s.box : undefined });
}

/** Panel ▸ 'spray test pattern': a five-round group and a scattering of holes on what Sam faces, a scorch at his feet with its wall splashes, a scuff on the nearest
 *  leaf, chips about — everything the shader draws, where the camera already is. Returns how many marks it left. */
export function sprayTestPattern(g: Game): number {
  const before = g.decals.count; const pc = g.player.char; const f = pc.forward();
  const chest: Vec3 = [pc.pos[0], 1.25, pc.pos[2]];
  const pistol = { calibre: '5.7', cls: 'pistol' } as unknown as WeaponDef, rifle = { calibre: '5.56', cls: 'rifle' } as unknown as WeaponDef;
  // a tight five-round group dead ahead at chest height, then a looser spray round it
  for (let i = 0; i < 23; i++) {
    const tight = i < 5; const sx = (unit(i * 1.7) - 0.5) * (tight ? 0.05 : 0.7), sy = (unit(i * 2.3 + 1) - 0.5) * (tight ? 0.05 : 0.5);
    const side: Vec3 = [-f[2], 0, f[0]];
    const dir = v3.normalize([f[0] + side[0] * sx, sy, f[2] + side[2] * sx]);
    const st = g.col.raycast(chest, dir, 30); const ph = g.props.raycast(chest, dir, st ? st.t : 30);
    if (ph) bulletMark(g, v3.mad(chest, dir, ph.t), ph.n, { box: ph.box, dynamic: true }, tight ? pistol : rifle);
    else if (st) bulletMark(g, v3.mad(chest, dir, st.t), st.n, staticSurface(g, st.index), tight ? pistol : rifle);
  }
  bangScorch(g, [pc.pos[0] + f[0] * 1.2, fx.bang.height + 0.05, pc.pos[2] + f[2] * 1.2]);
  { let best: Door | null = null, bd = 6; for (const d of g.doors.list) { const dd = v3.distXZ(d.pos, pc.pos); if (dd < bd) { bd = dd; best = d; } } if (best) kickScuff(g, best, pc.pos); }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047 + 0.3; const dir: Vec3 = [Math.cos(a), -0.05 + 0.1 * unit(i * 9.1), Math.sin(a)];
    const st = g.col.raycast(chest, v3.normalize(dir), 8); if (st) chipMark(g, v3.mad(chest, v3.normalize(dir), st.t), st.n, staticSurface(g, st.index));
  }
  return g.decals.count - before;
}

/** Panel / measurement: `n` marks of a realistic mix scattered over the interior — rays cast from random points inside the building at random walls and floors
 *  (its own counting generator: repeatable, and Math.random untouched). Returns how many it placed. */
export function sprayRandom(g: Game, n: number, seed = 1): number {
  const rnd = counter(seed); const before = g.decals.count;
  const pistol = { calibre: '9', cls: 'pistol' } as unknown as WeaponDef, rifle = { calibre: '5.45', cls: 'carbine' } as unknown as WeaponDef;
  let guard = 0;
  while (g.decals.count - before < n && guard++ < n * 12) {
    const from: Vec3 = [5 + rnd() * 30, 0.4 + rnd() * 1.6, 5 + rnd() * 18];
    const r = rnd();
    if (r < 0.08) { bangScorch(g, [from[0], fx.bang.height + 0.05, from[2]]); continue; }
    const a = rnd() * Math.PI * 2; const dir = v3.normalize([Math.cos(a), (rnd() - 0.6) * 0.5, Math.sin(a)]);
    const st = g.col.raycast(from, dir, 25); if (!st) continue;
    const p = v3.mad(from, dir, st.t), s = staticSurface(g, st.index);
    if (r < 0.2) chipMark(g, p, st.n, s); else bulletMark(g, p, st.n, s, r < 0.6 ? pistol : rifle);
  }
  return g.decals.count - before;
}

/** 0‥1 from any number (a hash, not a die) */
function unit(x: number): number { const t = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return t - Math.floor(t); }
function counter(seed: number) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
