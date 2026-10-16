// THE SNOW FIELD — a snow level's lying snow as ONE SURFACE (game/weatherKinds.ts SNOW_LOOK.on; the maintainer on his first GPU look at the pass, 10-14: 'it does
// need to feel more organic. maybe we could do it with a height map or something like that? the rectangles don't seem to work').
// The level file still says where the snow is — its ground slab, its trodden paths and ruts, the earth somebody cleared, its drifts and banks are placed boxes in
// the snow paints (tools/levels/pass.ts; scene/gwotPalette.ts SNOW_PALETTE), and every one of them is still the box a boot, a round and a ray meet. What changes
// is how they are DRAWN: this file reads those boxes once, at the level's start, and bakes them into four numbers a texel over the world's plan
// (SNOW_RES texels a metre, rgba16float):
//   r  MOUND   metres of snow standing over the ground — every SOLID snow box (a drift, a bank, a wind ridge) swallowed by one smooth hill that is at least a
//              finger over the box everywhere on its footprint and runs out to nothing round it. Drawn as a mesh (shaders/snow.wgsl vsSnow), so the boxes are
//              under it: nothing of the level is hidden, flagged or moved.
//   g  COVER   1 where snow lies on the ground, 0 where it does not — under a roof (a little is blown in under its edge), on ground somebody cleared.
//   b  PACKED  trodden / driven snow: the paths between the doors, the road.
//   a  OLD     old grey snow: wheel ruts, slops, the ring round cleared earth.
// Every edge in it is soft and wanders (value noise, seeded by position: the same level bakes the same field) — no straight line of the file survives as one.
// The g-buffer shades the ground and every snow-painted box off it (snow.wgsl snowBox / fsSnow). PICTURE ONLY: nothing in the simulation reads the field, and
// the men's light is measured as it always was. A pure function of the level; built by game.ts beside the traffic map, only on a snow level with the switch on.
import type { Level } from '../scene/level';
import type { Box } from '../scene/boxes';
import { BoxFlag } from '../scene/boxes';
import { WORLD } from '../scene/world';
import { SNOW_PALETTE } from '../scene/gwotPalette';

export const SNOW_RES = 10;           // texels per metre
/** The look's numbers (judged on software-rendered stills only — the maintainer's to move: `__snow.look` on the console, then `__snow.relook()`). Authored data. */
export const SNOW_SURF = {
  fresh: [0.76, 0.83, 0.95] as [number, number, number],     // what fresh snow sends back, in the PICTURE (the paint the simulation and the bounce read stays SNOW_PALETTE.snow)
  packed: [0.55, 0.61, 0.71] as [number, number, number],   // trodden snow: greyer, denser
  old: [0.36, 0.39, 0.44] as [number, number, number],       // old snow, slush
  relief: 2.4,          // × the surface's slopes when its normal is taken (over 1 = read from 21 m back)
  roll: 0.035,           // m: the open snow's slow swell
  ripple: 0.03,        // m: the wind's ridges across it, drawn out along the wind
  dimple: 0.014,        // m: boot and tyre marks in trodden snow
  hollowBlue: 0.5,      // how far a hollow's shade leans blue (0 = none)
  sparkle: 1,           // × the glints (0 = none)
  sparkleShare: 0.08,   // share of the surface's grains that are set to catch a lamp
  sparkleRough: 0.28,   // … and how tight a glint is
  sparkleLean: 0.06,    // … and how far such a grain leans its own way (small: its diffuse light leans with it)
  rough: 0.92,          // fresh snow's finish; trodden is a touch tighter
  pillow: 0.22,         // m from a cap's edge over which it rounds off
  capWave: 0.06,        // m: how far a cap's edge wanders in from the thing it lies on
  trackDeep: 0.08,     // m: how deep a boot's print is drawn in fresh snow (game/snowTracks.ts; deeper where a drift's skirt stands, shallower in trodden snow)
  trackRim: 0.012,      // m: the bank of pushed-up snow round a print
};

export interface SnowField {
  /** rgba16float texels, row-major from the world's min corner: (mound m, cover, packed, old) */
  data: Uint16Array; w: number; h: number;
  /** the mesh: (tx, tz) of every quad of the texel lattice with snow standing over it */
  quads: Uint32Array;
  /** the ground slab's box index (what a mesh pixel says it is: the snow lies on the ground) and how many of the level's boxes are the file's (the ground rule reads only those) */
  slab: number; statics: number;
  /** the level's snow paint, as its boxes carry it */
  paint: [number, number, number];
  wind: [number, number];
  /** the baked channels, for a check (float): index = tz × w + tx */
  mound: Float32Array; cover: Float32Array; packed: Float32Array; old: Float32Array;
  /** … and where the sky is shut (1 = under a roof, soft at its edge) and where a wall stands (1 = in its plan) */
  roof: Float32Array; wall: Uint8Array;
  /** the height the hill must clear at a texel: the top of a solid snow box standing there (0 = none) */
  hard: Float32Array;
  /** the hills as baked, kept from the first dig on (digSnowField: every dig is asked of these, so asking twice changes nothing; restoreSnowField puts them back) */
  base?: Float32Array;
  stats: { mounds: number; lays: number; bare: number; roofs: number; quads: number; maxMound: number };
}

const near = (a: readonly number[], b: readonly number[]) => Math.abs(a[0] - b[0]) < 2e-3 && Math.abs(a[1] - b[1]) < 2e-3 && Math.abs(a[2] - b[2]) < 2e-3;
/** which snow paint a box wears, by its albedo (a runtime box has no material name: gwotPalette.ts tells paints apart the same way) */
/** is this box a THIN LAY on the ground — a strip of trodden or old snow, swept earth, a mat: at the ground, a finger thick at most, not glass and not the
 *  deep snow's own paint (so never the slab). The bake's rule below and game/snowBog.ts's: one reading of the level's boxes. `bare` = it is ground somebody
 *  CLEARED (any paint that is not snow's, and not a lit thing lying on the snow) */
export function snowThinLay(b: Box): boolean { const top = b.c[1] + b.h[1]; return !(b.flags & BoxFlag.Glass) && top <= 0.03 && top > 0 && b.c[1] - b.h[1] >= -0.02 && snowPaintOf(b) !== 'snow'; }
export function snowLayBare(b: Box): boolean { return snowPaintOf(b) === null && b.emissive[0] + b.emissive[1] + b.emissive[2] <= 0; }
export function snowPaintOf(b: Box): 'snow' | 'snowPacked' | 'snowOld' | null {
  return near(b.albedo, SNOW_PALETTE.snow) ? 'snow' : near(b.albedo, SNOW_PALETTE.snowPacked) ? 'snowPacked' : near(b.albedo, SNOW_PALETTE.snowOld) ? 'snowOld' : null;
}

// position-seeded value noise (0‥1, C1) — the bake's only irregularity: the same level, the same field
function hash2(x: number, z: number): number { let h = (Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663)) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0; return ((h ^ (h >>> 15)) >>> 0) / 4294967296; }
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z); const fx = x - ix, fz = z - iz; const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** two octaves on turned axes (an edge that wanders at arm's length and again at a hand's) */
function wander(x: number, z: number, cell: number): number {
  const ax = 0.8776 * x - 0.4794 * z, az = 0.4794 * x + 0.8776 * z;
  return 0.65 * vnoise(ax / cell, az / cell) + 0.35 * vnoise(x / (cell * 0.37) + 7.3, z / (cell * 0.37) + 2.9);
}
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function toHalf(v: number): number {
  f32[0] = v; const x = u32[0]; const s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 112; let m = x & 0x7fffff;
  if (e <= 0) { if (e < -10) return s; m = (m | 0x800000) >> (1 - e); return s | ((m + 0x1000) >> 13); }
  if (e >= 31) return s | 0x7c00;
  m += 0x1000; if (m & 0x800000) { m = 0; e++; if (e >= 31) return s | 0x7c00; }
  return s | (e << 10) | (m >> 13);
}

/** `breakIt`: the check's break word — the hills are left a finger UNDER their boxes (the boxes then stand out of the surface, as rectangles) */
export function buildSnowField(level: Level, opts: { wind?: readonly [number, number]; breakIt?: boolean } = {}): SnowField | null {
  const boxes = level.boxes;
  const w = Math.round(WORLD.gridW * WORLD.gridCell * SNOW_RES), h = Math.round(WORLD.gridH * WORLD.gridCell * SNOW_RES);
  const ox = WORLD.min[0], oz = WORLD.min[2]; const N = w * h;
  // the ground: the biggest snow-painted slab whose top is the floor
  let slab = -1, slabArea = 0;
  boxes.forEach((b, i) => { if (snowPaintOf(b) === 'snow' && Math.abs(b.c[1] + b.h[1]) < 0.01 && b.h[0] * b.h[2] > slabArea) { slab = i; slabArea = b.h[0] * b.h[2]; } });
  if (slab < 0) return null;
  const cover = new Float32Array(N), packed = new Float32Array(N), old = new Float32Array(N), mound = new Float32Array(N), hard = new Float32Array(N), roof = new Float32Array(N);
  /** every texel within `pad` of box b's plan rectangle: fn(index, signed distance to the rectangle in m (inside < 0), world x, world z, the same distance asked
   *  from a point pushed a hand or two aside by a slow field — a straight side of the file comes out as a line that bends) */
  const WARP = 0.2, WARP_PAD = 0.3;
  const over = (b: Box, pad0: number, fn: (i: number, sd: number, x: number, z: number, sdw: number) => void, warp = true) => {
    const pad = pad0 + (warp ? WARP_PAD : 0);
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const ex = Math.abs(c) * b.h[0] + Math.abs(s) * b.h[2] + pad, ez = Math.abs(s) * b.h[0] + Math.abs(c) * b.h[2] + pad;
    const x0 = Math.max(0, Math.floor((b.c[0] - ex - ox) * SNOW_RES)), x1 = Math.min(w - 1, Math.ceil((b.c[0] + ex - ox) * SNOW_RES));
    const z0 = Math.max(0, Math.floor((b.c[2] - ez - oz) * SNOW_RES)), z1 = Math.min(h - 1, Math.ceil((b.c[2] + ez - oz) * SNOW_RES));
    for (let tz = z0; tz <= z1; tz++) {
      const wz = oz + (tz + 0.5) / SNOW_RES, pz = wz - b.c[2];
      for (let tx = x0; tx <= x1; tx++) {
        const wx = ox + (tx + 0.5) / SNOW_RES, px = wx - b.c[0];
        const qx = Math.abs(c * px - s * pz) - b.h[0], qz = Math.abs(s * px + c * pz) - b.h[2];   // world → box local (Box.yaw convention: local +x → (cos, 0, −sin))
        const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        if (sd > pad) continue;
        if (!warp) { fn(tz * w + tx, sd, wx, wz, sd); continue; }
        const ux = px + WARP * 2 * (vnoise(wx / 1.6 + 3.1, wz / 1.6 + 8.7) - 0.5) + 0.07 * 2 * (vnoise(wx / 0.45 + 1.3, wz / 0.45) - 0.5), uz = pz + WARP * 2 * (vnoise(wx / 1.6 + 13.9, wz / 1.6 + 0.4) - 0.5) + 0.07 * 2 * (vnoise(wx / 0.45, wz / 0.45 + 5.9) - 0.5);
        const rx = Math.abs(c * ux - s * uz) - b.h[0], rz = Math.abs(s * ux + c * uz) - b.h[2];
        fn(tz * w + tx, sd, wx, wz, Math.hypot(Math.max(rx, 0), Math.max(rz, 0)) + Math.min(Math.max(rx, rz), 0));
      }
    }
  };
  const blur = (a: Float32Array, passes: number) => {   // separable 1-2-1, edges clamped
    const t = new Float32Array(N);
    for (let p = 0; p < passes; p++) {
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) { const i = z * w + x; t[i] = (a[x > 0 ? i - 1 : i] + 2 * a[i] + a[x < w - 1 ? i + 1 : i]) * 0.25; }
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) { const i = z * w + x; a[i] = (t[z > 0 ? i - w : i] + 2 * t[i] + t[z < h - 1 ? i + w : i]) * 0.25; }
    }
  };
  const stats = { mounds: 0, lays: 0, bare: 0, roofs: 0, quads: 0, maxMound: 0 };
  // ---- 1. where the sky is shut: anything of size that stands over the ground with air under it (a roof slab, a canopy, a lorry's body)
  for (const b of boxes) {
    if (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) continue;
    if (b.c[1] - b.h[1] < 1.0 || Math.min(b.h[0], b.h[2]) < 0.25 || b.h[0] * b.h[2] < 0.15) continue;
    over(b, 0, (i, sd) => { if (sd <= 0) roof[i] = 1; }, false); stats.roofs++;
  }
  blur(roof, 6);   // (σ ≈ 0.17 m: snow is blown a hand or two in under an edge, and thins there)
  over(boxes[slab], 0, (i, sd, x, z) => { if (sd <= 0) cover[i] = 1 - sstep(0.5, 0.9, roof[i] + 0.3 * (wander(x, z, 0.9) - 0.5)); }, false);
  // ---- 2. what lies ON the ground, thin: trodden and old snow by their paint; any other paint is ground somebody cleared (the snow creeps in over its edge)
  // (cleared earth last: where a man swept the snow away there is none, trodden or old — a path's strip that crosses it is not drawn across it)
  const bare = new Float32Array(N);
  const lays = boxes.map((b, bi) => ({ b, bi, top: b.c[1] + b.h[1] })).filter(({ b, bi }) => bi !== slab && snowThinLay(b)).sort((p, q) => (snowPaintOf(p.b) ? 0 : 1) - (snowPaintOf(q.b) ? 0 : 1) || p.bi - q.bi);
  for (const { b } of lays) {
    const p = snowPaintOf(b); stats.lays++;
    if (p === 'snowPacked') over(b, 0.2, (i, _sd, x, z, sd) => { const v = 1 - sstep(-0.11, 0.07, sd + 0.2 * (wander(x, z, 0.8) - 0.5)); if (v > packed[i]) packed[i] = v; });
    else if (p === 'snowOld') over(b, 0.16, (i, _sd, x, z, sd) => { const v = 1 - sstep(-0.1, 0.06, sd + 0.12 * (wander(x, z, 0.45) - 0.5)); if (v > old[i]) old[i] = v; });
    else if (snowLayBare(b)) {
      stats.bare++; const creep = Math.min(0.45, 0.4 * Math.min(b.h[0], b.h[2]));
      over(b, 0, (i, sd0, x, z, sdw) => { const sd = Math.max(sd0, sdw); const v = sstep(0.02, 0.16, -sd - 0.03 - creep * wander(x, z, 1.1)); if (v > bare[i]) bare[i] = v; packed[i] *= 1 - v; old[i] *= 1 - v; });
    }
  }
  for (let i = 0; i < N; i++) cover[i] = Math.max(cover[i] * (1 - bare[i]), Math.max(packed[i], old[i]) * (1 - sstep(0.5, 0.9, roof[i])));   // (trodden or old snow is snow lying there, whatever it lies on)
  // ---- 3. the snow that STANDS: one hill over every solid snow box — a finger over it on its footprint (and a texel round it: the mesh's lattice may not cut a
  // corner), running out over a reach that grows with its height and wanders
  // A hill never passes a WALL: it is flooded out from its own box over the ground a man could walk from it, so a bank against a house does not come up through
  // the floor of the room behind (and nothing stands deep under a roof). Its skirt is hollow — most of the height is lost in the first third of the reach — so
  // little of the ground beside it that the simulation calls clear lies deep under the picture's snow.
  const lift = opts.breakIt ? -0.03 : 0.02;
  const wall = new Uint8Array(N), reach = new Uint8Array(N);
  for (const b of boxes) {
    if ((b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) || snowPaintOf(b)) continue;
    if (b.c[1] + b.h[1] < 0.9 || b.c[1] - b.h[1] > 0.3) continue;
    over(b, 0, (i, sd) => { if (sd <= 0) wall[i] = 1; }, false);
  }
  const seen = new Int32Array(N).fill(-1), val = new Float32Array(N), queue = new Int32Array(N), deep = new Uint8Array(N);
  boxes.forEach((b, bi) => {
    if (bi === slab || (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) || snowPaintOf(b) !== 'snow') return;
    const top = b.c[1] + b.h[1], bottom = b.c[1] - b.h[1];
    if (top < 0.03 || bottom > 0.06) return;
    stats.mounds++; const T = top + lift, pad = 1.6 / SNOW_RES, R = 0.12 + 0.8 * top;
    let qn = 0;
    const take = (i: number, d: number) => { seen[i] = bi; reach[i] = 1; deep[i] = d; if (val[i] > mound[i]) mound[i] = val[i]; queue[qn++] = i; };
    over(b, pad + R * 1.3, (i, sd, x, z, sdw) => {
      const r = R * (0.7 + 0.6 * wander(x, z, 0.45));
      const crest = T + Math.min(0.12, 0.45 * top) * wander(x, z, 1.3);   // (never lower than the box: a crest that rises and falls along a bank)
      const t = Math.max(0, 1 - (sdw - pad) / r);
      val[i] = sdw <= pad ? crest : crest * t * t * (0.35 + 0.65 * t);
      if (sd <= pad) { if (T > hard[i]) hard[i] = T; take(i, wall[i] ? 1 : 0); } else seen[i] = -2 - bi;   // (−2 − bi: this box's skirt may come here, if the ground lets it)
    });
    // out over the open ground from the box; into a wall three texels and no further, and never out of its other face (the hill ends INSIDE the wall it leans on)
    for (let qi = 0; qi < qn; qi++) {
      const i = queue[qi], x = i % w, d = deep[i];
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= N || seen[j] !== -2 - bi) continue;
        if (wall[j]) { if (d < 3) take(j, d + 1); } else if (d === 0) take(j, 0);
      }
    }
  });
  const settle = () => { for (let i = 0; i < N; i++) { if (!reach[i]) mound[i] = 0; else mound[i] *= 1 - sstep(0.8, 0.98, roof[i]); if (hard[i] > mound[i]) mound[i] = hard[i]; } };
  if (!opts.breakIt) { blur(mound, 3); settle(); blur(mound, 1); settle(); }
  // a wall's texel that touches ground the hill may not stand on carries none (the mesh would slope out of the wall's far face)
  for (let z = 1; z < h - 1; z++) for (let x = 1; x < w - 1; x++) {
    const i = z * w + x; if (!wall[i] || !(mound[i] > 0)) continue;
    let out = false;
    for (let dz = -1; dz <= 1 && !out; dz++) for (let dx = -1; dx <= 1; dx++) { const j = i + dz * w + dx; if (!wall[j] && !reach[j]) { out = true; break; } }
    if (out) deep[i] = 255;
  }
  for (let i = 0; i < N; i++) if (deep[i] === 255) mound[i] = 0;
  for (let i = 0; i < N; i++) {
    if (mound[i] < 0.004) mound[i] = 0;
    const up = sstep(0, 0.03, mound[i]);   // standing snow is fresh snow, whatever it stands on
    cover[i] = Math.max(cover[i], up); packed[i] *= 1 - up; old[i] *= 1 - up;
    if (mound[i] > stats.maxMound) stats.maxMound = mound[i];
  }
  // ---- the mesh: every lattice quad with snow standing at a corner
  const q: number[] = [];
  for (let z = 0; z < h - 1; z++) for (let x = 0; x < w - 1; x++) { const i = z * w + x; if (mound[i] > 0 || mound[i + 1] > 0 || mound[i + w] > 0 || mound[i + w + 1] > 0) q.push(x, z); }
  stats.quads = q.length / 2;
  const data = new Uint16Array(N * 4);
  for (let i = 0; i < N; i++) { data[i * 4] = toHalf(mound[i]); data[i * 4 + 1] = toHalf(cover[i]); data[i * 4 + 2] = toHalf(packed[i]); data[i * 4 + 3] = toHalf(old[i]); }
  const wd = opts.wind ?? [0.8, 0.3]; const wl = Math.hypot(wd[0], wd[1]) || 1;
  return { data, w, h, quads: new Uint32Array(q), slab, statics: boxes.length, paint: [SNOW_PALETTE.snow[0], SNOW_PALETTE.snow[1], SNOW_PALETTE.snow[2]], wind: [wd[0] / wl, wd[1] / wl], mound, cover, packed, old, roof, wall, hard, stats };
}

/** A BLAST DIGS THE STANDING SNOW OUT (game/snowBlast.ts, under SNOW_LOOK.blast). The hills are baked once; a blast that goes off in one left it standing — a
 *  charge cut a hole in a wall, the bank at its foot went with the blast (furnblast.ts FURN.mouth.snow) and its hill was still drawn across the hole. This lowers the hill round (x, z): to nothing within about `r` m, back
 *  to itself by 1.5 × r, on a ragged outline (the bake's own noise, turned by `seed`), always reckoned from the hill AS BAKED (asked twice, nothing more is dug) — but never under a snow box that still STANDS there solid (a drift,
 *  a bank nothing took: it is still what a boot meets, and the box would show through as a box): each keeps a hill of the bake's own shape, never higher
 *  than the hill as baked. `boxes` = the level's, as they are now. Returns the texels changed ([x0, z0, x1, z1], inclusive) or
 *  null when no hill stood there. The mesh is left as it is: a corner with nothing on it dives under the ground (snow.wgsl vsSnow). */
export function digSnowField(f: SnowField, boxes: readonly Box[], x: number, z: number, r: number, seed = 0): [number, number, number, number] | null {
  const ox = WORLD.min[0], oz = WORLD.min[2], R = r * 1.5 + 0.3;
  const x0 = Math.max(0, Math.floor((x - R - ox) * SNOW_RES)), x1 = Math.min(f.w - 1, Math.ceil((x + R - ox) * SNOW_RES));
  const z0 = Math.max(0, Math.floor((z - R - oz) * SNOW_RES)), z1 = Math.min(f.h - 1, Math.ceil((z + R - oz) * SNOW_RES));
  if (x1 < x0 || z1 < z0) return null;
  // what still stands solid in reach: its top (and a finger) is the floor of the dig on its footprint and a texel round it, as the bake held the hill over it
  const stand: Box[] = [];
  for (let i = 0; i < boxes.length && i < f.statics; i++) {
    const b = boxes[i]; if (i === f.slab || (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) || snowPaintOf(b) !== 'snow') continue;
    const top = b.c[1] + b.h[1]; if (top < 0.03 || b.c[1] - b.h[1] > 0.06) continue;
    const e = Math.hypot(b.h[0], b.h[2]) + R; if (Math.abs(b.c[0] - x) > e || Math.abs(b.c[2] - z) > e) continue;
    stand.push(b);
  }
  const pad = 1.6 / SNOW_RES; let any = false; const d: [number, number, number, number] = [x1, z1, x0, z0];
  const base = f.base ?? (f.base = f.mound.slice());
  for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
    const i = tz * f.w + tx, m = base[i]; if (!(m > 0) || !(f.mound[i] > 0)) continue;
    const wx = ox + (tx + 0.5) / SNOW_RES, wz = oz + (tz + 0.5) / SNOW_RES;
    const dist = Math.hypot(wx - x, wz - z) + r * 0.5 * (wander(wx + seed * 7.3, wz - seed * 3.1, 0.5) - 0.5) + r * 0.12 * (wander(wx - seed * 1.7, wz + seed * 5.9, 0.13) - 0.5);
    const k = sstep(r * 0.85, r * 1.5, dist); if (k >= 1) continue;
    // what still stands keeps a hill of its own, the bake's shape (a finger over it on its footprint, a hollow skirt running out round it on a line that
    // wanders): a flat step with a cliff at the box's edge would be the box drawn again
    let floor = 0;
    for (const b of stand) {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw), px = wx - b.c[0], pz = wz - b.c[2], qx = Math.abs(c * px - s * pz) - b.h[0], qz = Math.abs(s * px + c * pz) - b.h[2];
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0), T = b.c[1] + b.h[1] + 0.02;
      if (sd <= pad) { floor = Math.max(floor, T); continue; }
      const t = Math.max(0, 1 - (sd - pad + 0.14 * (wander(wx, wz, 0.45) - 0.5)) / ((0.12 + 0.8 * (T - 0.02)) * (0.7 + 0.6 * wander(wx, wz, 0.45))));
      floor = Math.max(floor, T * Math.min(1, t) * Math.min(1, t) * (0.35 + 0.65 * Math.min(1, t)));
    }
    let v = Math.fround(Math.max(Math.min(m, floor), m * k * k)); if (v < 0.004) v = 0;   // (fround: the hills are float32 — a dig asked again must find its own number)
    if (v >= f.mound[i]) continue;
    f.mound[i] = v; f.data[i * 4] = toHalf(v); any = true;
    if (tx < d[0]) d[0] = tx; if (tz < d[1]) d[1] = tz; if (tx > d[2]) d[2] = tx; if (tz > d[3]) d[3] = tz;
  }
  return any ? d : null;
}

/** the hills as they were baked (a restart: nothing was ever dug). True = something was put back (all of it is to be handed over again). */
export function restoreSnowField(f: SnowField): boolean {
  if (!f.base) return false;
  f.mound.set(f.base); f.base = undefined;
  for (let i = 0; i < f.mound.length; i++) f.data[i * 4] = toHalf(f.mound[i]);
  return true;
}

/** the field's four numbers at a world point (nearest texel) — for a check */
export function snowFieldAt(f: SnowField, x: number, z: number): { mound: number; cover: number; packed: number; old: number } {
  const tx = Math.max(0, Math.min(f.w - 1, Math.floor((x - WORLD.min[0]) * SNOW_RES))), tz = Math.max(0, Math.min(f.h - 1, Math.floor((z - WORLD.min[2]) * SNOW_RES))); const i = tz * f.w + tx;
  return { mound: f.mound[i], cover: f.cover[i], packed: f.packed[i], old: f.old[i] };
}

/** The uniform block snow.wgsl reads (11 vec4): the field's place, then the look's numbers. `live` false = the block of a page with no field (nothing is shaded). */
export const SNOW_CFG_FLOATS = 44;
export function snowCfgRows(f: SnowField | null, tracksPerM = 0): Float32Array {
  const o = new Float32Array(SNOW_CFG_FLOATS); const S = SNOW_SURF;
  if (!f) return o;
  o.set([WORLD.min[0], WORLD.min[2], SNOW_RES, f.slab, f.w, f.h, 1, f.statics], 0);
  o.set([S.fresh[0], S.fresh[1], S.fresh[2], S.sparkle], 8);
  o.set([S.packed[0], S.packed[1], S.packed[2], S.relief], 12);
  o.set([S.old[0], S.old[1], S.old[2], S.roll], 16);
  o.set([f.wind[0], f.wind[1], S.ripple, S.pillow], 20);
  o.set([S.hollowBlue, S.dimple, S.sparkleShare, S.sparkleRough], 24);
  o.set([f.paint[0], f.paint[1], f.paint[2], S.rough], 28);
  o.set([S.capWave, S.sparkleLean, tracksPerM > 0 ? S.trackDeep : 0, tracksPerM], 32);
  o.set([SNOW_PALETTE.snowPacked[0], SNOW_PALETTE.snowPacked[1], SNOW_PALETTE.snowPacked[2], 0], 36);   // the trodden and the old paints: how a path's or a rut's strip is known
  o.set([SNOW_PALETTE.snowOld[0], SNOW_PALETTE.snowOld[1], SNOW_PALETTE.snowOld[2], S.trackRim], 40);
  return o;
}
