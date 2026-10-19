// THE GWOT KIT — the default look's building blocks (scene/look.ts): a dusty 2010s compound — mud-brick and cement render, packed earth and gravel, rugs,
// floor cushions and cots, oil drums, jerry cans, sandbags, a generator, a pickup — built the OFFICE KIT's way: boxes, a finish per material, markings on
// faces. Flat colour, no gradients, no baked light (the markings' palette entries are materials, so that holds by construction).
// It ADDS to a kit, it replaces nothing: `gwotKit(host)` takes the few things it needs from whichever kit a generator builds with — `gwotOfOffice(K)` for
// officeGen.ts officeKit() (the closure kit every scenario level uses), `gwotOfKit(k, LK)` for levelKit.ts's LevelKit — and every call appends boxes / props /
// lights to THAT kit's lists, in call order. No existing kit call builds anything different because this file exists.
// THE GUIDE (palette, every piece with its footprint and what it is to a man — cover, walk-over or decal —, a worked example) is
// rebuild/play-style-levels/look/read-first.md; tools/levels/gwot-yard.ts is the showroom that lays every piece out once.
//
// WHAT A PIECE IS TO THE SIMULATION (scene/collision.ts): a static box blocks feet and the nav grid only where it stands between y 0.2 and 1.5, so
//   · COVER / OBSTACLE = a plain static (drums, sandbags, crates, cots, the pickup): feet, sight, rounds and sound all meet it;
//   · WALK-OVER        = a plain static whose top is ≤ 0.19 m (floor cushions, a concrete pad, rubble): lit, shadowed, seen by every ray, never in the way;
//   · DECAL            = a NoShadow box (rugs, ground patches, the damp foot of a wall, a painted dado, washing on a line, overhead wires): drawn and lit,
//                        invisible to every ray and every collision query — it can be added to a finished level without moving one digest;
//   · PROP             = a pushable body (scene/level.ts PropKind — only 'chair' | 'cardboard' | 'bin' | 'plant' exist): plastic chairs, jerry cans, gas
//                        bottles, dry bushes. Props never block sight, sound or the nav grid.
// Conventions: positions are the piece's CENTRE on the floor; `yaw` is Box.yaw (local +X → world (cos yaw, −sin yaw), local +Z → (sin yaw, cos yaw)); a
// piece with a front faces local −Z unless its line says otherwise; vehicles point +X.
import type { Vec3 } from '../math/vec';
import { Box, BoxFlag } from './boxes';
import { WORLD } from './world';
import type { Level, LightDef, PropKind, PropPart, PropDef } from './level';
import { MarkingDef, MarkFace, MarkRes, MarkPal, MARKING_TEXEL, RES_K, CellCanvas, marking, mkHash, faceHalf, faceIndex } from './markings';

const H = WORLD.ceilingY;

import { GWOT_PALETTE, GWOT_FINISH, ROUGH_CLOTH, gwotAs, type GwotMat, type GwotSim } from './gwotPalette';
export { GWOT_PALETTE, GWOT_FINISH, GWOT_MATERIALS, GWOT_SURFACE, GWOT_SIM, gwotAs, gwotSimOf, type GwotMat, type GwotSim } from './gwotPalette';

/** one opening in a wall (officeGen.ts / levelKit.ts Opening, field for field) */
export type GwotOpening = { a: number; b: number; y0?: number; y1?: number; mullions?: number; glass?: 'bay' | 'whole'; tint?: Vec3 };
/** what the kit needs of the kit it adds to */
export interface GwotHost {
  add(b: Partial<Box> & { c: Vec3; h: Vec3 }): number;
  prop(kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: PropPart[], half?: [number, number]): PropDef;
  wallX(z: number, x0: number, x1: number, t: number, albedo: Vec3, openings?: GwotOpening[], extra?: Partial<Box>, height?: number): void;
  wallZ(x: number, z0: number, z1: number, t: number, albedo: Vec3, openings?: GwotOpening[], extra?: Partial<Box>, height?: number): void;
  lights: LightDef[]; switchables: Level['switchables'];
  /** markings on (the kit's own switch) and its base texel */
  marks: boolean; texel: number;
}
/** the host of an officeGen.ts officeKit() */
export function gwotOfOffice(K: { add: GwotHost['add']; prop: GwotHost['prop']; wallX: GwotHost['wallX']; wallZ: GwotHost['wallZ']; lights: LightDef[]; switchables: Level['switchables']; MARKS: boolean; TX: number }): GwotHost {
  return { add: K.add, prop: K.prop, wallX: K.wallX, wallZ: K.wallZ, lights: K.lights, switchables: K.switchables, marks: K.MARKS, texel: K.TX };
}

type Mat = { albedo: Vec3; rough: number; metal?: boolean };
const matOf = (n: GwotMat): Mat => ({ albedo: GWOT_PALETTE[n], rough: GWOT_FINISH[n]?.rough ?? ROUGH_CLOTH, ...(GWOT_FINISH[n]?.metal ? { metal: true } : {}) });
const palOf = (n: GwotMat): MarkPal => ({ albedo: GWOT_PALETTE[n], rough: GWOT_FINISH[n]?.rough ?? ROUGH_CLOTH });
const frameAt = (x: number, z: number, yaw: number) => { const cs = Math.cos(yaw), sn = Math.sin(yaw); return (lx: number, ly: number, lz: number): Vec3 => [x + cs * lx + sn * lz, ly, z - sn * lx + cs * lz]; };
const DECAL = BoxFlag.NoShadow;

/** MARKINGS OVER A WHOLE FACE: f(i, j, W, H) → 0 (the box's own paint) | 1‥3 (pal entry) for every cell of the face's lattice at `res`, i left → right and j
 *  bottom → top as seen from outside (+y: i along +x, j along −z), cut into ≤ `maxTiles` bitmaps of ≤ 32 × 32 cells (a face over 64 cells a side keeps its
 *  middle 64). `inset` = a margin in metres left unmarked round the face. Empty tiles are dropped. */
export function tileMarks(face: MarkFace, res: MarkRes, hu: number, hv: number, pal: MarkPal[], f: (i: number, j: number, W: number, H: number) => number, base = MARKING_TEXEL, inset = 0, maxTiles = 4): MarkingDef[] {
  const t = base * RES_K[res], eps = 1e-7;
  let U0 = Math.ceil(-(hu - inset) / t - eps), U1 = Math.floor((hu - inset) / t + eps), V0 = Math.ceil(-(hv - inset) / t - eps), V1 = Math.floor((hv - inset) / t + eps);
  let nu = U1 - U0 > 32 ? 2 : 1, nv = V1 - V0 > 32 ? 2 : 1;
  while (nu * nv > maxTiles) { if (nv > 1) nv = 1; else nu = 1; }
  const crop = (a: number, b: number, n: number): [number, number] => { const lim = 32 * n; return b - a > lim ? [a + Math.floor((b - a - lim) / 2), a + Math.floor((b - a - lim) / 2) + lim] : [a, b]; };
  [U0, U1] = crop(U0, U1, nu); [V0, V1] = crop(V0, V1, nv);
  const W = U1 - U0, Hc = V1 - V0; if (W < 1 || Hc < 1) return [];
  const out: MarkingDef[] = [];
  for (let b = 0; b < nv; b++) for (let a = 0; a < nu; a++) {
    const i0 = a === 0 ? 0 : Math.ceil(W / 2), i1 = nu === 1 || a === 1 ? W : Math.ceil(W / 2), j0 = b === 0 ? 0 : Math.ceil(Hc / 2), j1 = nv === 1 || b === 1 ? Hc : Math.ceil(Hc / 2);
    if (i1 - i0 < 1 || j1 - j0 < 1) continue;
    const cv = new CellCanvas(i1 - i0, j1 - j0); let any = false;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const e = f(i, j, W, Hc) | 0; if (e > 0) { cv.set(i - i0, j - j0, Math.min(e, pal.length)); any = true; } }
    if (any) out.push(marking({ face, res, at: [U0 + i0, V0 + j0], size: [i1 - i0, j1 - j0], pal, cells: cv.toRows() }));
  }
  return out;
}

export type RugStyle = 'afghan' | 'baluch' | 'kilim' | 'mat' | 'felt';
const RUGS: Record<RugStyle, { base: GwotMat; pal: [GwotMat, GwotMat] }> = {
  afghan: { base: 'rugRed', pal: ['rugNavy', 'rugCream'] }, baluch: { base: 'rugMadder', pal: ['rugNavy', 'rugCream'] }, kilim: { base: 'rugCream', pal: ['rugOchre', 'blanketBrown'] },   // (never red + white + navy in stripes: from above that is a flag)
  mat: { base: 'rugGreen', pal: ['rugCream', 'rugRed'] }, felt: { base: 'blanketGrey', pal: ['blanketBrown', 'rugCream'] },
};
/** a rug's cell: 0 = the field, 1 / 2 = the style's two other yarns */
function rugCell(style: RugStyle, i: number, j: number, W: number, Hc: number): number {
  const e = Math.min(i, W - 1 - i, j, Hc - 1 - j);
  if (style === 'kilim') { if (e === 0) return 1; const b = Math.floor(j / 3) % 4; return b === 1 ? 1 : b === 3 ? 2 : 0; }
  if (style === 'mat') { if (e === 0) return 2; if (e === 1) return 0; return ((i >> 1) + (j >> 1)) % 2 ? 1 : 0; }
  if (style === 'felt') return e === 1 ? 1 : (j < 4 || j >= Hc - 4) && e > 1 && (j % 2 === 0) ? 2 : 0;
  if (e === 0 || e === 2) return 1; if (e === 1) return 2; if (e < 5) return 0;         // navy · cream · navy border, a clear band inside it
  const P = 8, ci = i - (W - 1) / 2, cj = j - (Hc - 1) / 2;                               // guls on an 8-cell lattice centred on the rug
  const gi = Math.abs((((ci % P) + P + P / 2) % P) - P / 2), gj = Math.abs((((cj % P) + P + P / 2) % P) - P / 2), d = gi + gj;
  if (style === 'baluch') return d === 0 ? 2 : d <= 1.5 ? 1 : 0;                           // (a baluch's guls are small and close on a dark field)
  return d <= 1 ? 2 : d <= 3 ? 1 : 0;
}

export type WallKind = 'mud' | 'mudLight' | 'render' | 'whitewash' | 'block';
export type Paint = 'paintBlue' | 'paintGreen' | 'paintRust' | 'paintCream';
/** shell and partition thickness — the two the kits' door frames know (levelKit WALL_EXT / WALL_INT) */
export const GW_SHELL = 0.24, GW_PART = 0.12;

/** THE KIT over a host. Every function appends to the host's lists. */
export function gwotKit(host: GwotHost) {
  const TX = host.texel;
  const M = Object.fromEntries((Object.keys(GWOT_PALETTE) as GwotMat[]).map(n => [n, matOf(n)])) as Record<GwotMat, Mat>;
  /** the paint `m` standing for something else to rounds and blasts (gwotPalette.ts gwotAs): `b(…, G.as('mud', 'wall'))` */
  const as = (m: GwotMat, sim: GwotSim): Mat => ({ ...M[m], albedo: gwotAs(m, sim) });
  type CellFn = (i: number, j: number, W: number, Hc: number) => number;
  /** one face's markings, not yet cut to a box: resolved against the box's own half extents when the box is added (so a bitmap can never leave its face) */
  type Art = { f: MarkFace; res: MarkRes; pal: MarkPal[]; fn: CellFn; inset: number; max: number };
  const face = (f: MarkFace, res: MarkRes, pal: MarkPal[], fn: CellFn, inset = 0, max = 4): Art[] => [{ f, res, pal, fn, inset, max }];
  const marksOf = (h: Vec3, arts: Art[] | undefined): { marks?: MarkingDef[] } => {
    if (!host.marks || !arts || !arts.length) return {};
    const ms = arts.flatMap(a => { const { hu, hv } = faceHalf(h, faceIndex(a.f)); return tileMarks(a.f, a.res, hu, hv, a.pal, a.fn, TX, a.inset, a.max); }).slice(0, 4);
    return ms.length ? { marks: ms } : {};
  };
  const mk = (arts: Art[]): { art: Art[] } => ({ art: arts });
  type Extra = Partial<Box> & { art?: Art[] };
  /** a piece's local frame: b(lx, lz, y0, y1, hx, hz, mat, extra?, dyaw?) adds one box of it */
  const piece = (x: number, z: number, yaw: number) => {
    const at = frameAt(x, z, yaw);
    return (lx: number, lz: number, y0: number, y1: number, hx: number, hz: number, m: Mat, extra: Extra = {}, dyaw = 0) => {
      const { art, ...rest } = extra, h: Vec3 = [hx, (y1 - y0) / 2, hz];
      return host.add({ c: at(lx, (y0 + y1) / 2, lz), h, yaw: yaw + dyaw, albedo: m.albedo, rough: m.rough, ...(m.metal ? { metal: true } : {}), ...marksOf(h, art), ...rest });
    };
  };
  type Put = ReturnType<typeof piece>;
  /** a round thing as two squares 45° apart (the second a hair lower so the tops never fight): radius r */
  const round = (b: Put, lx: number, lz: number, y0: number, y1: number, r: number, m: Mat, extra: Extra = {}, extra2: Extra = extra) => {
    if (r < 0.2) { const s = r * 0.93; b(lx, lz, y0, y1, s, s, m, extra); b(lx, lz, y0, y1 - 0.004, s, s, m, extra2, Math.PI / 4); return; }   // (small: two squares, 45° apart)
    // an OCTAGON: four slabs through the centre, 45° apart, each as wide as the round and tan 22.5° as deep — their union is the regular octagon exactly
    // (seen from above a drum is round; two squares read as a cog). Tops stepped 2 mm so no two are coplanar.
    const a = r * 0.96, t = a * 0.4142;
    for (let k = 0; k < 4; k++) b(lx, lz, y0, y1 - 0.002 * k, a, t, m, k === 0 ? extra : extra2, k * Math.PI / 4);
  };
  const h01 = (s: number, a: number, b = 0) => mkHash(s, a, b) / 4294967296;
  const seedOf = (x: number, z: number) => (Math.round(x * 100) * 73856093 ^ Math.round(z * 100) * 19349663) >>> 0;

  // ---------------------------------------------------------------- walls ----
  /** a SHELL wall along X at fixed z (0.24 thick: mud-brick, render, whitewash, bare block); openings as the kits' own (doors 0‥2.2, windows 0.9‥2.4) */
  const wallX = (z: number, x0: number, x1: number, kind: WallKind = 'mud', openings: GwotOpening[] = [], height = H) => host.wallX(z, x0, x1, GW_SHELL, gwotAs(kind, 'concrete'), openings, { rough: M[kind].rough }, height);
  const wallZ = (x: number, z0: number, z1: number, kind: WallKind = 'mud', openings: GwotOpening[] = [], height = H) => host.wallZ(x, z0, z1, GW_SHELL, gwotAs(kind, 'concrete'), openings, { rough: M[kind].rough }, height);
  /** an interior PARTITION (0.12 thick) */
  const partX = (z: number, x0: number, x1: number, kind: WallKind = 'mudLight', openings: GwotOpening[] = [], height = H) => host.wallX(z, x0, x1, GW_PART, gwotAs(kind, 'wall'), openings, { rough: M[kind].rough }, height);
  const partZ = (x: number, z0: number, z1: number, kind: WallKind = 'mudLight', openings: GwotOpening[] = [], height = H) => host.wallZ(x, z0, z1, GW_PART, gwotAs(kind, 'wall'), openings, { rough: M[kind].rough }, height);
  /** the solid runs of a wall between the openings that reach its top */
  const runs = (a: number, b: number, openings: GwotOpening[], height: number): [number, number][] => {
    const out: [number, number][] = []; let cur = a;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) { if ((o.y1 ?? 2.2) < height) continue; if (o.a > cur) out.push([cur, o.a]); cur = Math.max(cur, o.b); }
    if (b > cur) out.push([cur, b]); return out;
  };
  /** a COMPOUND (yard) wall along X: the shell wall to `height` (2.4: over a man, under the roofs) with a paler coping course overhanging it, open to the sky */
  const yardWallX = (z: number, x0: number, x1: number, kind: WallKind = 'mud', openings: GwotOpening[] = [], height = 2.4) => {
    wallX(z, x0, x1, kind, openings, height);
    for (const [a, b] of runs(x0, x1, openings, height)) host.add({ c: [(a + b) / 2, height + 0.035, z], h: [(b - a) / 2, 0.035, GW_SHELL / 2 + 0.03], albedo: M.mudLight.albedo, rough: M.mudLight.rough });
  };
  const yardWallZ = (x: number, z0: number, z1: number, kind: WallKind = 'mud', openings: GwotOpening[] = [], height = 2.4) => {
    wallZ(x, z0, z1, kind, openings, height);
    for (const [a, b] of runs(z0, z1, openings, height)) host.add({ c: [x, height + 0.035, (a + b) / 2], h: [GW_SHELL / 2 + 0.03, 0.035, (b - a) / 2], albedo: M.mudLight.albedo, rough: M.mudLight.rough });
  };
  /** a buttress PIER on a wall line (0.44 square, capped) — the rhythm of a long mud wall, and a corner to stand behind */
  const pier = (x: number, z: number, height = 2.4, kind: WallKind = 'mud') => { const b = piece(x, z, 0); b(0, 0, 0, height + 0.04, 0.22, 0.22, M[kind]); b(0, 0, height + 0.04, height + 0.12, 0.26, 0.26, M.mudLight); };
  /** DECAL: a band on a wall face from the floor to `top` — the damp, darker foot of a mud wall (default), or a painted DADO (`mat` a paint, top 1.1). `axis` 'x' =
   *  the wall runs along X at `line`; a‥b along it; `side` ±1 = which face (toward +z / +x is +1); `t` = that wall's thickness */
  const skirt = (axis: 'x' | 'z', line: number, a: number, b: number, side: 1 | -1, mat: GwotMat = 'mudDark', top = 0.38, t = GW_SHELL) => {
    const off = line + side * (t / 2 + 0.004), m = M[mat];
    host.add({ c: axis === 'x' ? [(a + b) / 2, top / 2, off] : [off, top / 2, (a + b) / 2], h: axis === 'x' ? [Math.abs(b - a) / 2, top / 2, 0.004] : [0.004, top / 2, Math.abs(b - a) / 2], albedo: m.albedo, rough: m.rough, flags: DECAL });
  };
  const dado = (axis: 'x' | 'z', line: number, a: number, b: number, side: 1 | -1, paint: Paint = 'paintBlue', t = GW_SHELL) => skirt(axis, line, a, b, side, paint, 1.1, t);
  /** DECAL: a small rug / cloth hung flat on a wall face, its middle at `at` along the wall, 1.2‥2.0 m up */
  const wallHanging = (axis: 'x' | 'z', line: number, at: number, side: 1 | -1, style: RugStyle = 'baluch', w = 1.2, hgt = 0.8, t = GW_SHELL) => {
    const off = line + side * (t / 2 + 0.006), R = RUGS[style], m = M[R.base]; const f: MarkFace = axis === 'x' ? (side > 0 ? '+z' : '-z') : (side > 0 ? '+x' : '-x');
    const hh: Vec3 = axis === 'x' ? [w / 2, hgt / 2, 0.006] : [0.006, hgt / 2, w / 2];
    host.add({ c: axis === 'x' ? [at, 1.6, off] : [off, 1.6, at], h: hh, albedo: m.albedo, rough: m.rough, flags: DECAL,
      ...marksOf(hh, face(f, 'coarse', [palOf(R.pal[0]), palOf(R.pal[1])], (i, j, W, Hc) => rugCell(style, i, j, W, Hc))) });
  };
  /** a sheet-metal GATE in an opening `width` wide centred at (x, z) of a wall along `axis`: two capped posts and two painted leaves standing open by `openDeg`
   *  toward `side` (static: a gate that is open tonight). The wall's opening is the caller's (a‥b = centre ∓ width / 2, y1 ≥ the wall's height). */
  const gate = (x: number, z: number, axis: 'x' | 'z', width = 3.0, side: 1 | -1 = 1, paint: Paint = 'paintBlue', openDeg = 78, height = 2.4) => {
    const base = axis === 'x' ? 0 : Math.PI / 2, b = piece(x, z, base), lw = width / 2 - 0.04, a = openDeg * Math.PI / 180;
    const pal = [{ mul: 0.55 } as MarkPal, palOf('paintCream')];
    const leafArt = (i: number, j: number, W: number, Hc: number) => {
      const e = Math.min(i, W - 1 - i, j, Hc - 1 - j), rail = Math.floor(Hc * 0.45);
      if (e === 1 || j === rail) return 1;
      if (e < 3) return 0;
      if (j > rail + 1) return (i % 4) === 1 ? 2 : 0;                                    // the upper panel: upright bars
      const ci = Math.abs(i - (W - 1) / 2), cj = Math.abs(j - (rail - 1) / 2), d = ci + cj; return d > 4.4 && d <= 5.6 ? 2 : 0;   // the lower: a diamond
    };
    for (const s of [-1, 1] as const) {
      const px = s * (width / 2 + 0.17);
      b(px, 0, 0, height + 0.1, 0.17, 0.17, M.render); b(px, 0, height + 0.1, height + 0.18, 0.2, 0.2, M.mudLight);
      // the leaf: hinged at the post's inner face, swung by a toward `side` (local +z · side)
      const hx = s * width / 2, cx = hx - s * Math.cos(a) * lw / 2, cz = side * Math.sin(a) * lw / 2, dy = s * side * a;
      b(cx, cz, 0.06, 2.1, lw / 2, 0.02, M[paint], mk([...face('+z', 'coarse', pal, leafArt, 0, 2), ...face('-z', 'coarse', pal, leafArt, 0, 2)]), dy);
    }
  };

  // --------------------------------------------------------------- ground ----
  /** a GROUND finish over a rectangle (a thin solid slab like the kits' floor finishes: feet, rounds and light land on it): dust | dirt | gravel | mudFloor | slab */
  const ground = (x0: number, z0: number, x1: number, z1: number, mat: GwotMat = 'dust', y = 0.004) =>
    host.add({ c: [(x0 + x1) / 2, y / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, y / 2, Math.abs(z1 - z0) / 2], albedo: M[mat].albedo, rough: M[mat].rough });
  /** DECAL: a patch on the ground — a damp spot, an oil stain, a drift of dust, a scatter of gravel (w × d, any yaw) */
  const patch = (x: number, z: number, w: number, d: number, mat: GwotMat = 'damp', yaw = 0, y = 0.012) =>
    host.add({ c: [x, y, z], h: [w / 2, 0.003, d / 2], yaw, albedo: M[mat].albedo, rough: M[mat].rough, flags: DECAL });
  /** DECAL: a vehicle's two wheel RUTS from (x0, z0) to (x1, z1), 1.5 m apart */
  const ruts = (x0: number, z0: number, x1: number, z1: number, mat: GwotMat = 'dirt') => {
    const L = Math.hypot(x1 - x0, z1 - z0) || 1, yaw = Math.atan2(-(z1 - z0), x1 - x0), b = piece((x0 + x1) / 2, (z0 + z1) / 2, yaw);
    for (const s of [-0.75, 0.75]) b(0, s, 0.008, 0.014, L / 2, 0.16, M[mat], { flags: DECAL });
  };
  /** WALK-OVER: a scatter of rubble / field stones within r of (x, z) — n small blocks under 0.19 m (lit and shadowed; nobody trips on them) */
  const rubble = (x: number, z: number, r = 0.8, n = 7, mat: GwotMat = 'mud') => {
    const s = seedOf(x, z);
    for (let k = 0; k < n; k++) {
      const a = h01(s, k, 1) * Math.PI * 2, d = Math.sqrt(h01(s, k, 2)) * r, w = 0.07 + h01(s, k, 3) * 0.13, hgt = 0.05 + h01(s, k, 4) * 0.12, m = h01(s, k, 5) < 0.3 ? M.mudDark : M[mat];
      host.add({ c: [x + Math.cos(a) * d, hgt / 2, z + Math.sin(a) * d], h: [w, hgt / 2, w * (0.6 + h01(s, k, 6) * 0.6)], yaw: h01(s, k, 7) * Math.PI, albedo: m.albedo, rough: m.rough });
    }
  };

  // ---------------------------------------------------------------- cloth ----
  /** DECAL: a patterned RUG, w along local x × d along local z (each ≤ 3.2 m for the whole pattern; snapped to 10 cm): 'afghan' red field with navy guls,
   *  'baluch' navy with red, 'kilim' striped cream, 'mat' a woven plastic mat, 'felt' a grey namad */
  const rug = (x: number, z: number, w: number, d: number, style: RugStyle = 'afghan', yaw = 0) => {
    const W = Math.max(0.2, Math.round(w * 10) / 10), D = Math.max(0.2, Math.round(d * 10) / 10), R = RUGS[style], m = M[R.base];
    const hh: Vec3 = [W / 2, 0.006, D / 2];
    return host.add({ c: [x, 0.018, z], h: hh, yaw, albedo: m.albedo, rough: m.rough, flags: DECAL,
      ...marksOf(hh, face('+y', 'coarse', [palOf(R.pal[0]), palOf(R.pal[1])], (i, j, Wc, Hc) => rugCell(style, i, j, Wc, Hc))) });
  };
  /** WALK-OVER: a floor mattress (toshak) `len` long by 0.7 with two flat cushions on it — what a guest room is lined with; all of it under 0.19 m */
  const toshak = (x: number, z: number, len = 1.9, yaw = 0, cover: GwotMat = 'rugRed', cushion: GwotMat = 'rugNavy') => {
    const b = piece(x, z, yaw), stripe = [palOf('rugCream')];
    b(0, 0, 0, 0.1, len / 2, 0.35, M[cover], mk(face('+y', 'coarse', stripe, (i, j, W, Hc) => j === 1 || j === Hc - 2 ? 1 : 0)));
    for (const s of [-1, 1]) b(s * (len / 2 - 0.36), 0.12, 0.1, 0.185, 0.3, 0.2, M[cushion], mk(face('+y', 'coarse', stripe, (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) === 1 ? 1 : 0)));
  };
  /** COVER (knee high): a steel-framed army COT, 1.9 × 0.7, the canvas at 0.42 m; `made` = a folded blanket and a pillow on it. Head toward local +X. */
  const cot = (x: number, z: number, yaw = 0, made = true, blanket: GwotMat = 'blanketGrey') => {
    const b = piece(x, z, yaw);
    for (const lx of [-0.8, 0, 0.8]) b(lx, 0, 0, 0.38, 0.02, 0.34, M.galv);
    b(0, 0, 0.38, 0.42, 0.95, 0.35, M.canvas);
    if (made) { b(-0.25, 0, 0.42, 0.47, 0.62, 0.33, M[blanket], mk(face('+y', 'coarse', [{ mul: 0.6 }], (i, j, W) => i === W - 3 || i === W - 5 ? 1 : 0))); b(0.72, 0, 0.42, 0.5, 0.17, 0.24, M.sack); }
  };
  /** COVER (knee high): a CHARPOY — the rope bed: four turned legs, a poplar frame 1.9 × 0.9, the woven top, a quilt folded at the foot */
  const charpoy = (x: number, z: number, yaw = 0, quilt: GwotMat | null = 'rugRed') => {
    const b = piece(x, z, yaw);
    for (const lx of [-0.9, 0.9]) for (const lz of [-0.4, 0.4]) b(lx, lz, 0, 0.5, 0.04, 0.04, M.woodGrey);
    b(0, 0, 0.36, 0.44, 0.95, 0.45, M.poplar, mk(face('+y', 'coarse', [palOf('straw'), { mul: 0.7 }], (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) < 1 ? 0 : (i + j) % 2 ? 1 : 2)));
    if (quilt) b(-0.62, 0, 0.44, 0.52, 0.26, 0.4, M[quilt], mk(face('+y', 'coarse', [palOf('rugCream')], (i, j) => j % 3 === 1 ? 1 : 0)));
  };
  /** DECAL: washing on a LINE between two posts (the posts are thin statics; the line and the cloths are decals at 1.3‥1.95 m) */
  const washLine = (x0: number, z0: number, x1: number, z1: number, n = 4, posts = true) => {
    const L = Math.hypot(x1 - x0, z1 - z0) || 1, yaw = Math.atan2(-(z1 - z0), x1 - x0), b = piece((x0 + x1) / 2, (z0 + z1) / 2, yaw), s = seedOf(x0 + x1, z0 + z1);
    if (posts) for (const e of [-1, 1]) b(e * L / 2, 0, 0, 2.0, 0.03, 0.03, M.woodGrey);   // (posts = false: strung between two walls — then every box of it is a decal)
    b(0, 0, 1.94, 1.95, L / 2, 0.004, M.iron, { flags: DECAL });
    const cols: GwotMat[] = ['rugCream', 'paintBlue', 'whitewash', 'rugOchre', 'blanketBrown', 'paintGreen'];
    for (let k = 0; k < n; k++) { const u = -L / 2 + (k + 0.5 + (h01(s, k, 1) - 0.5) * 0.4) * L / n, w = 0.22 + h01(s, k, 2) * 0.2, drop = 0.45 + h01(s, k, 3) * 0.35; b(u, 0, 1.94 - drop, 1.94, w, 0.006, M[cols[mkHash(s, k, 4) % cols.length]], { flags: DECAL }); }
  };

  // ------------------------------------------------------------ furniture ----
  /** COVER (shin high): a LOW TABLE 1.0 × 0.6 × 0.3 with a tea tray, a pot and two glasses */
  const lowTable = (x: number, z: number, yaw = 0, tea = true) => {
    const b = piece(x, z, yaw);
    b(0, 0, 0.26, 0.3, 0.5, 0.3, M.poplar); for (const s of [-1, 1]) b(s * 0.42, 0, 0, 0.26, 0.03, 0.26, M.poplar);
    if (tea) { b(0.1, 0, 0.3, 0.312, 0.2, 0.14, M.tin); b(0.2, 0.02, 0.312, 0.43, 0.05, 0.05, M.iron); b(0.02, -0.05, 0.312, 0.37, 0.022, 0.022, M.whitewash); b(0.04, 0.07, 0.312, 0.37, 0.022, 0.022, M.whitewash); }
  };
  /** COVER: a plain TABLE w × d at 0.75 m on four legs (plywood on a timber frame — the FOB's desk, a kitchen table) */
  const table = (x: number, z: number, w = 1.6, d = 0.75, yaw = 0, top: GwotMat = 'ply') => {
    const b = piece(x, z, yaw);
    b(0, 0, 0.71, 0.75, w / 2, d / 2, M[top]); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(sx * (w / 2 - 0.06), sz * (d / 2 - 0.06), 0, 0.71, 0.03, 0.03, M.woodGrey);
  };
  /** PROP (chair): a moulded PLASTIC CHAIR — seat, back, two arms, four splayed legs; the sitter faces local −Z */
  const plasticChair = (x: number, z: number, yaw = 0, colour: GwotMat = 'plasticWhite') => {
    const a = M[colour].albedo;
    return host.prop('chair', x, z, yaw, 3, [
      { off: [0, 0.42, 0], h: [0.22, 0.02, 0.22], yaw: 0, albedo: a }, { off: [0, 0.63, 0.215], h: [0.21, 0.19, 0.015], yaw: 0, albedo: a },
      { off: [-0.225, 0.62, 0.02], h: [0.02, 0.012, 0.2], yaw: 0, albedo: a }, { off: [0.225, 0.62, 0.02], h: [0.02, 0.012, 0.2], yaw: 0, albedo: a },
      { off: [-0.2, 0.2, -0.2], h: [0.02, 0.2, 0.02], yaw: 0, albedo: a }, { off: [0.2, 0.2, -0.2], h: [0.02, 0.2, 0.02], yaw: 0, albedo: a },
      { off: [-0.2, 0.2, 0.2], h: [0.02, 0.2, 0.02], yaw: 0, albedo: a }, { off: [0.2, 0.2, 0.2], h: [0.02, 0.2, 0.02], yaw: 0, albedo: a },
    ]);
  };
  /** PROP (chair): the OFFICE chair's own five boxes in other paint — same footprint, mass and shape, so a finished level can swap its chairs' look and
   *  keep every run as it was (the pedestal reads as a plastic stool's foot) */
  const chairAs = (x: number, z: number, yaw: number, seat: GwotMat = 'plasticWhite', foot: GwotMat = seat) => {
    const a = M[seat].albedo, f = M[foot].albedo;
    return host.prop('chair', x, z, yaw, 12, [
      { off: [0, 0.46, 0], h: [0.24, 0.04, 0.24], yaw: 0, albedo: a }, { off: [0, 0.8, 0.22], h: [0.23, 0.3, 0.035], yaw: 0, albedo: a },
      { off: [0, 0.22, 0], h: [0.04, 0.22, 0.04], yaw: 0, albedo: f }, { off: [0, 0.03, 0], h: [0.25, 0.03, 0.05], yaw: 0, albedo: f }, { off: [0, 0.03, 0], h: [0.05, 0.03, 0.25], yaw: 0, albedo: f },
    ]);
  };
  /** COVER (knee high): a painted tin TRUNK 0.8 × 0.45 × 0.4 with strap bands and a hasp */
  const trunk = (x: number, z: number, yaw = 0, paint: Paint = 'paintGreen') => {
    const b = piece(x, z, yaw), band = [{ mul: 0.5 } as MarkPal, palOf('tin')];
    b(0, 0, 0, 0.4, 0.4, 0.225, M[paint], mk([
      ...face('+y', 'base', band, (i, j, W, Hc) => i === 5 || i === W - 6 ? 1 : Math.min(i, W - 1 - i, j, Hc - 1 - j) === 0 ? 1 : 0),
      ...face('-z', 'base', band, (i, j, W, Hc) => j === Hc - 4 ? 1 : (i === 5 || i === W - 6) ? 1 : Math.abs(i - (W - 1) / 2) < 1.6 && j >= Hc - 7 && j < Hc - 4 ? 2 : 0),
    ]));
  };
  /** COVER: a cast-iron STOVE (bukhari) with its flue to the roof — the winter corner of a room */
  const stove = (x: number, z: number) => {
    const b = piece(x, z, 0);
    round(b, 0, 0, 0.08, 0.62, 0.21, M.rust); for (const s of [-1, 1]) b(s * 0.13, 0, 0, 0.08, 0.02, 0.15, M.iron);
    b(0, 0, 0.62, 0.64, 0.12, 0.12, M.iron); b(0.1, 0, 0.64, H, 0.05, 0.05, M.tin);
  };
  /** COVER: a clay bread OVEN (tandoor), a mud drum 0.9 across and 0.55 high with a black mouth */
  const tandoor = (x: number, z: number) => {
    const b = piece(x, z, 0), mouth = mk(face('+y', 'coarse', [palOf('plasticBlack')], (i, j, W, Hc) => Math.hypot(i - (W - 1) / 2, j - (Hc - 1) / 2) < 4.4 ? 1 : 0));
    round(b, 0, 0, 0, 0.55, 0.45, M.mudDark, mouth, {}); patch(x, z, 1.5, 1.4, 'damp', 0.4);   // (fired clay darker than the wall it stands by; soot and ash round its foot)
  };

  // ------------------------------------------------------- stores & cover ----
  /** COVER: an OIL DRUM (0.58 across, 0.88 high) standing; ribs round it, a bung on the lid */
  const drum = (x: number, z: number, colour: GwotMat = 'drumBlue', yaw = 0) => {
    const b = piece(x, z, yaw), s = 0.29 * 0.93, rib = [{ mul: 0.62 } as MarkPal];
    const ribs = (f: MarkFace) => face(f, 'coarse', rib, (i, j, W, Hc) => j === Math.floor(Hc / 3) || j === Math.floor(2 * Hc / 3) ? 1 : 0, 0, 1);
    const sides = mk([...ribs('+x'), ...ribs('-x'), ...ribs('+z'), ...ribs('-z')]);
    const lid = mk([...face('+y', 'base', [{ mul: 0.55 } as MarkPal, palOf('tin')], (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) === 1 ? 1 : i === W - 6 && j === Hc - 6 ? 2 : 0, 0, 1), ...ribs('+x'), ...ribs('-x'), ...ribs('+z')]);
    round(b, 0, 0, 0, 0.88, 0.29, M[colour], lid, sides);
  };
  /** a group of drums: n standing in a tight cluster from (x, z), colours dealt by position */
  const drums = (x: number, z: number, n = 3, yaw = 0) => {
    const at = frameAt(x, z, yaw), cols: GwotMat[] = ['drumBlue', 'rust', 'drumRed', 'olive'], s = seedOf(x, z);
    const spots: [number, number][] = [[0, 0], [0.64, 0.06], [0.3, 0.6], [-0.36, 0.56], [0.94, 0.62], [1.28, 0.04]];
    for (let k = 0; k < Math.min(n, spots.length); k++) { const p = at(spots[k][0], 0, spots[k][1]); drum(p[0], p[2], cols[mkHash(s, k, 1) % cols.length], h01(s, k, 2) * 0.7); }
  };
  /** COVER (to the chest lying, the knee standing): a drum on its SIDE, chocked */
  const drumDown = (x: number, z: number, yaw = 0, colour: GwotMat = 'rust') => {
    const b = piece(x, z, yaw);
    b(0, 0, 0.02, 0.58, 0.44, 0.27, M[colour], mk(face('+y', 'coarse', [{ mul: 0.62 }], (i, j, W) => i === Math.floor(W / 3) || i === Math.floor(2 * W / 3) ? 1 : 0)));
    b(0, 0, 0.1, 0.5, 0.445, 0.29, M[colour]); for (const s of [-1, 1]) b(s * 0.25, 0.3, 0, 0.08, 0.08, 0.05, M.woodGrey);
  };
  /** PROP (bin): a JERRY CAN, 20 l — olive steel, or the yellow / blue plastic ones that carry everything */
  const jerryCan = (x: number, z: number, yaw = 0, colour: GwotMat = 'olive') => {
    const a = M[colour].albedo, hs: Vec3 = [0.17, 0.2, 0.08];
    const cross = marksOf(hs, face('+z', 'base', [{ mul: 0.62 }], (i, j, W, Hc) => { const u = (i + 0.5) / W, v = (j + 0.5) / Hc; return Math.abs(u - v) < 0.09 || Math.abs(u + v - 1) < 0.09 ? 1 : 0; }, 0.02, 1)).marks ?? [];
    return host.prop('bin', x, z, yaw, 6, [
      { off: [0, 0.2, 0], h: hs, yaw: 0, albedo: a, ...(cross.length ? { marks: [...cross, ...cross.map(m => marking({ ...m, face: '-z' }))] } : {}) },
      { off: [-0.02, 0.425, 0], h: [0.1, 0.025, 0.03], yaw: 0, albedo: a }, { off: [0.13, 0.42, 0], h: [0.03, 0.03, 0.03], yaw: 0, albedo: GWOT_PALETTE.iron },
    ], [0.17, 0.1]);
  };
  /** PROP (bin): a GAS BOTTLE (LPG), 0.3 across with its collar */
  const gasBottle = (x: number, z: number, colour: GwotMat = 'drumRed') => {
    const a = M[colour].albedo;
    return host.prop('bin', x, z, 0, 14, [
      { off: [0, 0.26, 0], h: [0.14, 0.26, 0.14], yaw: 0, albedo: a }, { off: [0, 0.26, 0], h: [0.14, 0.258, 0.14], yaw: Math.PI / 4, albedo: a },
      { off: [0, 0.57, 0], h: [0.08, 0.05, 0.08], yaw: 0, albedo: GWOT_PALETTE.iron },
    ], [0.15, 0.15]);
  };
  /** COVER: wooden AMMUNITION CRATES, 0.9 × 0.4 × 0.3 each, n stacked (1 = shin, 3 = a waist-high rest): olive, battens across the lid, a stencil block */
  const crates = (x: number, z: number, yaw = 0, n = 2, colour: GwotMat = 'olive') => {
    const s = seedOf(x, z), pal = [{ mul: 0.6 } as MarkPal, palOf('stencil')];
    for (let k = 0; k < n; k++) {
      const b = piece(x + (h01(s, k, 1) - 0.5) * 0.05, z + (h01(s, k, 2) - 0.5) * 0.05, yaw + (h01(s, k, 3) - 0.5) * 0.14);
      b(0, 0, k * 0.3, k * 0.3 + 0.3, 0.45, 0.2, M[colour], mk([
        ...(k === n - 1 ? face('+y', 'base', pal, (i, j, W, Hc) => i === 4 || i === 5 || i === W - 5 || i === W - 6 ? 1 : j >= 3 && j <= 5 && i >= 12 && i < 24 && i % 4 !== 3 ? 2 : 0) : []),
        ...face('-z', 'base', pal, (i, j, W, Hc) => i === 4 || i === 5 || i === W - 5 || i === W - 6 ? 1 : j >= 4 && j <= 7 && i >= 10 && i < 26 && i % 4 !== 3 ? 2 : j === 0 ? 1 : 0),
        ...face('+z', 'base', pal, (i, j, W) => i === 4 || i === 5 || i === W - 5 || i === W - 6 ? 1 : j === 0 ? 1 : 0),
      ]));
    }
  };
  /** COVER: a pile of grain / flour SACKS, n layers of 0.2 m (3 = a kneeling man's cover) */
  const sacks = (x: number, z: number, yaw = 0, n = 3) => {
    const s = seedOf(x, z), band = [palOf('paintBlue'), { mul: 0.72 } as MarkPal];
    for (let k = 0; k < n; k++) {
      const turn = k % 2 ? Math.PI / 2 : 0, b = piece(x + (h01(s, k, 1) - 0.5) * 0.1, z + (h01(s, k, 2) - 0.5) * 0.1, yaw + turn + (h01(s, k, 3) - 0.5) * 0.2);
      for (const side of [-1, 1]) b(0, side * 0.235, k * 0.2, k * 0.2 + 0.2, 0.38, 0.225, M.sack, mk(face('+y', 'coarse', band, (i, j, W, Hc) => i === 3 || i === 4 ? 1 : i === W - 1 || j === 0 || j === Hc - 1 ? 2 : 0)));
    }
  };
  /** COVER: a SANDBAG wall, `len` along local x, `courses` of 0.2 m (4 = 0.8 m, a crouched man's cover; 6 = 1.2; 7+ blocks a standing man's sight), 0.5 thick,
   *  laid in bond; long runs are cut into ≤ 1.6 m lengths */
  const sandbags = (x: number, z: number, len: number, yaw = 0, courses = 4) => {
    const b = piece(x, z, yaw), seam = [{ mul: 0.62 } as MarkPal], nseg = Math.max(1, Math.ceil(len / 1.6)), seg = len / nseg;
    for (let c = 0; c < courses; c++) {
      const hz = 0.25 - c * 0.012, bond = c % 2 ? 6 : 0, top = c === courses - 1;
      for (let k = 0; k < nseg; k++) {
        const lx = -len / 2 + (k + 0.5) * seg, i0 = Math.round(k * seg / 0.05);
        const side = (f: MarkFace) => face(f, 'coarse', seam, (i, j, W, Hc) => (i + i0 + bond) % 12 === 0 || j === 0 ? 1 : 0, 0, 1);
        b(lx, 0, c * 0.2, c * 0.2 + 0.2, seg / 2 - (top ? 0.03 : 0), hz, M.sandbag, mk([
          ...(top ? face('+y', 'coarse', seam, (i, j, W, Hc) => (i + i0 + bond) % 12 === 0 || j === Math.floor(Hc / 2) ? 1 : 0, 0, 1) : []), ...side('+z'), ...side('-z')]));
      }
    }
  };
  /** COVER (full): HESCO bastions — n wire-and-liner cells of 1.1 m, 1.37 high, filled with earth, in a row along local x */
  const hesco = (x: number, z: number, n = 2, yaw = 0) => {
    const b = piece(x, z, yaw), mesh = [{ mul: 0.6 } as MarkPal], grid = (f: MarkFace) => face(f, 'coarse', mesh, (i, j) => i % 4 === 0 || j % 4 === 0 ? 1 : 0, 0, 1);
    for (let k = 0; k < n; k++) { const lx = (k - (n - 1) / 2) * 1.1; b(lx, 0, 0, 1.37, 0.545, 0.55, M.hesco, mk([...grid('+z'), ...grid('-z'), ...grid('+x'), ...grid('-x')])); b(lx, 0, 1.37, 1.41, 0.47, 0.47, M.dirt); }
  };
  /** COVER (crouch): JERSEY barriers — n precast 2 m lengths, 0.81 high, in a row along local x */
  const jersey = (x: number, z: number, n = 1, yaw = 0) => {
    const b = piece(x, z, yaw);
    for (let k = 0; k < n; k++) { const lx = (k - (n - 1) / 2) * 2.02; b(lx, 0, 0, 0.3, 1.0, 0.3, M.tWall); b(lx, 0, 0.3, 0.81, 1.0, 0.13, M.tWall, mk(face('+y', 'base', [{ mul: 0.7 }], (i, j, W) => i === 6 || i === W - 7 ? 1 : 0))); }
  };
  /** COVER (full): T-WALLS — n precast blast-wall segments 1.2 m wide and `height` tall, each on its foot, in a row along local x */
  const tWall = (x: number, z: number, n = 3, yaw = 0, height = 2.9) => {
    const b = piece(x, z, yaw);
    for (let k = 0; k < n; k++) { const lx = (k - (n - 1) / 2) * 1.2; b(lx, 0, 0, 0.18, 0.59, 0.42, M.tWall); b(lx, 0, 0.18, height, 0.59, 0.13, M.tWall); }
  };
  /** COVER (waist): a stack of TYRES, n high (0.2 m each) */
  const tyres = (x: number, z: number, n = 3) => {
    const b = piece(x, z, 0), s = seedOf(x, z), hole = mk(face('+y', 'base', [palOf('plasticBlack')], (i, j, W, Hc) => Math.hypot(i - (W - 1) / 2, j - (Hc - 1) / 2) < 5 ? 1 : 0, 0, 1));
    for (let k = 0; k < n; k++) round(b, (h01(s, k, 1) - 0.5) * 0.06, (h01(s, k, 2) - 0.5) * 0.06, k * 0.2, k * 0.2 + 0.2, 0.33, M.rubber, k === n - 1 ? hole : {}, {});
  };
  /** COVER (knee): a stack of concrete BLOCKS 0.8 × 0.4 × 0.4, cores up */
  const blocks = (x: number, z: number, yaw = 0, layers = 2) => {
    const b = piece(x, z, yaw), pal = [{ mul: 0.45 } as MarkPal, { mul: 0.75 } as MarkPal];
    b(0, 0, 0, layers * 0.2, 0.4, 0.2, M.block, mk([
      ...face('+y', 'base', pal, (i, j, W, Hc) => i === W / 2 - 1 || i === W / 2 || j === Hc / 2 - 1 || j === Hc / 2 ? 2 : ((i % (W / 2)) > 3 && (i % (W / 2)) < W / 2 - 4 && (j % (Hc / 2)) > 1 && (j % (Hc / 2)) < Hc / 2 - 2 && (i % (W / 4)) > 1 && (i % (W / 4)) < W / 4 - 1) ? 1 : 0),
      ...face('-z', 'base', pal, (i, j, W) => i === W / 2 || j % 8 === 0 ? 2 : 0), ...face('+z', 'base', pal, (i, j, W) => i === W / 2 || j % 8 === 0 ? 2 : 0),
    ]));
  };
  /** COVER (knee): a WOOD PILE — split poplar, three layers */
  const woodPile = (x: number, z: number, yaw = 0, len = 1.4) => {
    const b = piece(x, z, yaw), s = seedOf(x, z), ends = (f: MarkFace, hz: number) => face(f, 'base', [{ mul: 0.55 }], (i) => i % 5 === 4 ? 1 : 0, 0, 1);
    for (let k = 0; k < 3; k++) { const hz = 0.3 - k * 0.07; b((h01(s, k, 1) - 0.5) * 0.12, 0, k * 0.14, k * 0.14 + 0.14, len / 2 - h01(s, k, 2) * 0.08, hz, M.woodGrey, mk([...ends('+x', hz), ...ends('-x', hz), ...face('+y', 'coarse', [{ mul: 0.6 }], (i, j) => j % 3 === 2 ? 1 : 0, 0, 1)])); }
  };

  // --------------------------------------------------- machines & vehicles ----
  /** COVER (waist): a diesel GENERATOR on its skid, 1.5 × 0.75 × 1.0: louvred sides, a control panel on local −Z, the exhaust stack */
  const generator = (x: number, z: number, yaw = 0, colour: GwotMat = 'genYellow') => {
    const b = piece(x, z, yaw), dark = [{ mul: 0.35 } as MarkPal, palOf('plasticBlack'), palOf('tin')];
    b(0, 0, 0, 0.1, 0.8, 0.4, M.iron);
    b(0, 0, 0.1, 1.0, 0.75, 0.375, M[colour], mk([
      ...face('+x', 'coarse', dark, (i, j, W, Hc) => i > 0 && i < W - 1 && j > 2 && j < Hc - 2 && j % 2 === 1 ? 1 : 0, 0, 1),
      ...face('-x', 'coarse', dark, (i, j, W, Hc) => i > 0 && i < W - 1 && j > 2 && j < Hc - 2 && j % 2 === 1 ? 1 : 0, 0, 1),
      ...face('-z', 'coarse', dark, (i, j, W, Hc) => i >= 3 && i < 12 && j >= Hc - 9 && j < Hc - 2 ? ((i === 5 || i === 8) && (j === Hc - 4 || j === Hc - 7) ? 3 : 2) : i >= 15 && i < W - 2 && j > 2 && j < Hc - 2 && j % 2 === 1 ? 1 : 0, 0, 1),
      ...face('+y', 'coarse', dark, (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) === 1 ? 1 : 0, 0, 1),
    ]));
    b(0.5, 0.15, 1.0, 1.32, 0.045, 0.045, M.rust); b(-0.35, 0, 1.0, 1.04, 0.12, 0.12, M.iron);
  };
  /** COVER (full): a WATER TANK — a 1 000 l plastic tank on a mud-brick plinth (`plinth` m high; 0 = on the ground) */
  const waterTank = (x: number, z: number, colour: GwotMat = 'plasticBlue', plinth = 1.1) => {
    const b = piece(x, z, 0), rib = [{ mul: 0.7 } as MarkPal], s = 0.56 * 0.93;
    const ribs = (f: MarkFace) => face(f, 'coarse', rib, (i, j) => j % 5 === 2 ? 1 : 0, 0, 1);
    if (plinth > 0) b(0, 0, 0, plinth, 0.66, 0.66, M.mud);
    round(b, 0, 0, plinth, plinth + 1.1, 0.56, M[colour], mk([...ribs('+x'), ...ribs('-x'), ...ribs('+z'), ...ribs('-z')]), mk([...ribs('+x'), ...ribs('-x'), ...ribs('+z'), ...ribs('-z')]));
    b(0, 0, plinth + 1.1, plinth + 1.16, 0.18, 0.18, M.plasticBlack); if (plinth > 0) b(0.6, 0.2, 0, plinth + 0.5, 0.02, 0.02, M.galv);
  };
  /** COVER: a hand PUMP on its concrete pad (the pad a walk-over) with a bucket */
  const pump = (x: number, z: number, yaw = 0) => {
    const b = piece(x, z, yaw);
    b(0, 0, 0, 0.1, 0.7, 0.7, M.block); patch(x, z, 2.8, 2.4, 'damp', yaw + 0.3); patch(x + 0.3, z - 0.2, 1.7, 1.3, 'damp', yaw - 0.5, 0.013);
    b(0, 0, 0.1, 0.95, 0.06, 0.06, M.paintGreen); b(0, 0, 0.95, 1.08, 0.08, 0.08, M.paintGreen); b(-0.32, 0, 1.02, 1.06, 0.3, 0.02, M.iron); b(0.17, 0, 0.66, 0.72, 0.12, 0.03, M.paintGreen);
    b(0.34, 0.05, 0.1, 0.36, 0.13, 0.13, M.plasticBlue);
  };
  /** COVER (full height at the cab): a PICKUP, 5.0 × 1.8, nose toward local +X: cab, open bed, tailgate. `load`: what rides in the bed; `mount`: a pedestal
   *  gun in the bed (the "technical") */
  const pickup = (x: number, z: number, yaw = 0, body: GwotMat = 'truckWhite', opts: { load?: 'none' | 'drums' | 'sacks' | 'crates'; mount?: boolean } = {}) => {
    const b = piece(x, z, yaw), P = M[body];
    for (const sx of [-1.5, 1.52]) for (const sz of [-1, 1]) b(sx, sz * 0.78, 0, 0.74, 0.37, 0.13, M.rubber);
    b(0, 0, 0.3, 0.8, 2.45, 0.86, P);                                                       // the body tub, sill to waistline
    b(2.47, 0, 0.36, 0.58, 0.05, 0.88, M.plasticBlack); b(-2.47, 0, 0.36, 0.58, 0.05, 0.88, M.plasticBlack);   // bumpers
    b(1.75, 0, 0.8, 1.0, 0.7, 0.84, P, mk(face('+y', 'coarse', [{ mul: 0.8 }], (i, j, W, Hc) => (j === 5 || j === Hc - 6) && i > 1 ? 1 : 0, 0, 1)));   // bonnet
    b(0.38, 0, 0.8, 1.08, 0.7, 0.86, P); b(0.38, 0, 1.08, 1.5, 0.64, 0.8, M.glassDark); b(0.36, 0, 1.5, 1.58, 0.6, 0.78, P);   // the cab: doors, glass, roof
    b(-1.42, 0, 0.8, 0.83, 1.0, 0.76, M.plasticBlack, mk(face('+y', 'coarse', [{ mul: 1.9 }], (i, j) => j % 3 === 1 ? 1 : 0, 0, 2)));   // the bed liner, ribbed
    for (const sz of [-1, 1]) b(-1.42, sz * 0.83, 0.8, 1.18, 1.03, 0.03, P);                 // bed sides
    b(-2.42, 0, 0.8, 1.18, 0.03, 0.86, P); b(-0.36, 0, 0.8, 1.18, 0.03, 0.86, P);           // tailgate, the bed's front wall
    for (const sz of [-1, 1]) { b(2.43, sz * 0.66, 0.62, 0.76, 0.03, 0.16, M.plasticWhite); b(-2.43, sz * 0.72, 0.62, 0.78, 0.03, 0.1, M.truckRed); }
    const at = frameAt(x, z, yaw);
    if (opts.mount) { b(-1.3, 0, 0.83, 1.5, 0.05, 0.05, M.iron); b(-1.05, 0, 1.5, 1.62, 0.7, 0.05, M.iron); b(-1.3, 0.16, 1.44, 1.6, 0.12, 0.09, M.olive); b(-1.75, 0, 1.46, 1.58, 0.05, 0.2, M.iron); }
    else if (opts.load === 'drums') { for (const [lx, lz] of [[-0.85, -0.36], [-0.85, 0.36], [-1.5, 0]] as const) { const p = at(lx, 0, lz); const d = piece(p[0], p[2], yaw); round(d, 0, 0, 0.83, 1.71, 0.29, lx < -1 ? M.rust : M.drumBlue); } }
    else if (opts.load === 'sacks') { for (const [lx, lz, y] of [[-0.9, -0.3, 0], [-0.9, 0.32, 0], [-1.7, 0, 0], [-1.2, 0.02, 0.2]] as const) b(lx, lz, 0.83 + y, 1.03 + y, 0.38, 0.25, M.sack); }
    else if (opts.load === 'crates') { b(-1.0, -0.3, 0.83, 1.13, 0.45, 0.2, M.olive); b(-1.0, 0.3, 0.83, 1.13, 0.45, 0.2, M.olive); b(-1.9, 0, 0.83, 1.13, 0.2, 0.45, M.coyote); }
  };
  /** COVER (head high): a PANEL VAN 4.9 × 1.8 × 1.95, nose toward local +X, its two back doors standing open on the load bay (the spot a stride behind them is
   *  local (−3.2, 0): where a man is put in) */
  const van = (x: number, z: number, yaw = 0, body: GwotMat = 'truckWhite') => {
    const b = piece(x, z, yaw), P = M[body];
    for (const sx of [-1.45, 1.5]) for (const sz of [-1, 1]) b(sx, sz * 0.8, 0, 0.74, 0.37, 0.13, M.rubber);
    b(0, 0, 0.3, 0.86, 2.4, 0.9, P);                                                        // the body, sill to waistline
    b(2.43, 0, 0.36, 0.58, 0.05, 0.9, M.plasticBlack); b(-2.43, 0, 0.3, 0.44, 0.05, 0.9, M.plasticBlack);   // bumper, the rear step
    b(2.0, 0, 0.86, 1.06, 0.4, 0.86, P);                                                    // bonnet
    b(1.3, 0, 0.86, 1.1, 0.4, 0.9, P); b(1.3, 0, 1.1, 1.62, 0.36, 0.84, M.glassDark); b(1.22, 0, 1.62, 1.95, 0.34, 0.86, P);   // the cab: doors, glass, the roof's brow
    b(-0.5, 0, 0.86, 1.95, 1.4, 0.9, P);                                                    // the load box
    for (const sz of [-1, 1]) b(-2.15, sz * 0.87, 0.86, 1.95, 0.25, 0.03, P);               // the open bay: its sides, roof, the dark inside
    b(-2.15, 0, 1.89, 1.95, 0.25, 0.9, P); b(-1.89, 0, 0.86, 1.89, 0.02, 0.84, M.plasticBlack); b(-2.15, 0, 0.86, 0.88, 0.25, 0.84, M.plasticBlack);
    for (const sz of [-1, 1]) b(-2.77, sz * 1.1, 0.5, 1.9, 0.42, 0.025, P, {}, sz * 0.5);   // the two back doors, swung out
    for (const sz of [-1, 1]) { b(2.43, sz * 0.66, 0.62, 0.76, 0.03, 0.16, M.plasticWhite); b(-2.41, sz * 0.86, 0.9, 1.2, 0.02, 0.04, M.truckRed); }
  };
  /** COVER (waist, thin): a small MOTORBIKE on its stand, nose toward local +X */
  const motorbike = (x: number, z: number, yaw = 0, tank: GwotMat = 'truckRed') => {
    const b = piece(x, z, yaw);
    b(0.66, 0, 0, 0.6, 0.3, 0.05, M.rubber); b(-0.62, 0, 0, 0.6, 0.3, 0.05, M.rubber);
    b(0.02, 0, 0.26, 0.56, 0.2, 0.12, M.iron); b(0.18, 0, 0.56, 0.84, 0.24, 0.12, M[tank]); b(-0.36, 0, 0.62, 0.8, 0.34, 0.11, M.plasticBlack);
    b(0.6, 0, 0.6, 1.02, 0.03, 0.03, M.galv); b(0.56, 0, 1.0, 1.04, 0.02, 0.32, M.iron); b(0.74, 0, 0.78, 0.94, 0.05, 0.07, M.iron);
    b(-0.84, 0, 0.66, 0.7, 0.16, 0.13, M.iron); b(-0.4, 0.16, 0.28, 0.36, 0.42, 0.035, M.iron);   // (nothing pale on it: from above a bike is two black wheels in line and one tank of colour)
  };
  /** COVER (waist): a flat HANDCART (karachi) 1.7 × 0.95 on two wheels, shafts toward local +X; `load`: sacks, produce crates or nothing */
  const handcart = (x: number, z: number, yaw = 0, load: 'none' | 'sacks' | 'produce' = 'none') => {
    const b = piece(x, z, yaw), s = seedOf(x, z), prod: GwotMat[] = ['prodOrange', 'prodGreen', 'prodRed', 'prodYellow'];
    for (const sz of [-1, 1]) { b(-0.1, sz * 0.52, 0, 0.66, 0.33, 0.035, M.rubber); b(1.25, sz * 0.36, 0.52, 0.57, 0.42, 0.02, M.woodGrey); }
    b(0, 0, 0.5, 0.57, 0.85, 0.47, M.poplar, mk(face('+y', 'coarse', [{ mul: 0.6 }], (i, j) => j % 4 === 3 ? 1 : 0, 0, 2))); b(0.7, 0, 0, 0.5, 0.03, 0.03, M.woodGrey);
    if (load === 'sacks') { b(-0.3, -0.1, 0.57, 0.77, 0.38, 0.25, M.sack); b(0.35, 0.12, 0.57, 0.77, 0.38, 0.25, M.sack); b(0, 0, 0.77, 0.97, 0.38, 0.25, M.sack, {}, 0.4); }
    if (load === 'produce') for (let k = 0; k < 6; k++) b(-0.56 + (k % 3) * 0.56, k < 3 ? -0.22 : 0.22, 0.57, 0.71, 0.25, 0.19, M.ply, mk(face('+y', 'base', [palOf(prod[mkHash(s, k, 1) % 4])], (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) >= 1 ? 1 : 0, 0, 1)));
  };
  /** COVER (waist at the counter): a MARKET STALL `w` wide: a skirted counter of produce trays on local −Z, the keeper's striped awning on four poles behind it */
  const stall = (x: number, z: number, yaw = 0, w = 2.2, awning: GwotMat = 'tarpBlue') => {
    const b = piece(x, z, yaw), s = seedOf(x, z), prod: GwotMat[] = ['prodOrange', 'prodGreen', 'prodRed', 'prodYellow'], n = Math.max(2, Math.round(w / 0.55));
    b(0, -0.45, 0, 0.8, w / 2, 0.4, M.canvas); b(0, -0.45, 0.8, 0.84, w / 2 + 0.04, 0.44, M.poplar);
    for (let k = 0; k < n; k++) for (const row of [0, 1]) b(-w / 2 + (k + 0.5) * w / n, -0.64 + row * 0.38, 0.84, 0.94, w / n / 2 - 0.03, 0.17, M.ply, mk(face('+y', 'base', [palOf(prod[mkHash(s, k, row) % 4])], (i, j, W, Hc) => Math.min(i, W - 1 - i, j, Hc - 1 - j) >= 1 ? 1 : 0, 0, 1)));
    for (const sx of [-1, 1]) for (const lz of [0.02, 1.1]) b(sx * (w / 2 + 0.02), lz, 0, 2.15, 0.025, 0.025, M.woodGrey);
    b(0, 0.56, 2.15, 2.18, w / 2 + 0.15, 0.68, M[awning], mk(face('+y', 'coarse', [palOf('whitewash')], (i) => (i >> 2) % 2 ? 1 : 0, 0, 2)));
  };
  /** COVER (full): a 20 ft shipping CONTAINER 6.06 × 2.44 × 2.59, its doors on local +X */
  const container = (x: number, z: number, yaw = 0, colour: GwotMat = 'paintRust') => {
    const b = piece(x, z, yaw), rib = [{ mul: 0.72 } as MarkPal];
    b(0, 0, 0, 2.59, 3.03, 1.22, M[colour], mk([...face('+z', 'coarse', rib, (i) => i % 3 === 0 ? 1 : 0, 0.1, 2), ...face('-z', 'coarse', rib, (i) => i % 3 === 0 ? 1 : 0, 0.1, 2)]));
    for (const lz of [-0.7, -0.25, 0.25, 0.7]) b(3.04, lz, 0.1, 2.5, 0.012, 0.02, M.galv);
    b(3.04, 0, 0.05, 2.54, 0.008, 0.012, M.iron);
  };
  /** a SATELLITE DISH on a pole (thin: no cover) — the one modern thing on every roofline, here stood in the yard */
  const satDish = (x: number, z: number, yaw = 0, height = 1.6) => { const b = piece(x, z, yaw); b(0, 0, 0, height, 0.03, 0.03, M.galv); b(0, -0.08, height - 0.1, height + 0.6, 0.36, 0.025, M.tin); b(0, -0.3, height + 0.2, height + 0.24, 0.02, 0.2, M.iron); };
  /** PROP (plant): a dry BUSH (camelthorn / scrub), scale s */
  const bush = (x: number, z: number, s = 1) => host.prop('plant', x, z, 0, 3 * Math.pow(s, 3), [
    { off: [0, 0.22 * s, 0], h: [0.3 * s, 0.22 * s, 0.3 * s], yaw: 0.5, albedo: GWOT_PALETTE.scrub }, { off: [0.05 * s, 0.42 * s, -0.04 * s], h: [0.2 * s, 0.16 * s, 0.2 * s], yaw: 0.1, albedo: GWOT_PALETTE.straw },
  ], [0.3 * s, 0.3 * s]);

  // --------------------------------------------------------------- lights ----
  /** DECAL: overhead WIRE from (x0, z0) at y0 to (x1, z1) (level: the sag is not drawn) */
  const wire = (x0: number, z0: number, x1: number, z1: number, y = 2.7) => { const L = Math.hypot(x1 - x0, z1 - z0) || 1; host.add({ c: [(x0 + x1) / 2, y, (z0 + z1) / 2], h: [L / 2, 0.006, 0.006], yaw: Math.atan2(-(z1 - z0), x1 - x0), ...M.plasticBlack, flags: DECAL }); };
  /** a bare BULB on its flex under a roof: a warm point light on the mains (group = the room's lighting group) */
  const bulb = (x: number, z: number, name: string, group: string, on = true, intensity = 26) => {
    host.add({ c: [x, 2.7, z], h: [0.005, 0.3, 0.005], ...M.plasticBlack, flags: DECAL });
    const fb = host.add({ c: [x, 2.36, z], h: [0.04, 0.05, 0.04], ...M.plasticWhite, emissive: on ? [30, 21, 11] : [0, 0, 0], flags: DECAL });
    host.lights.push({ kind: 'point', pos: [x, 2.33, z], dir: [0, -1, 0], color: [1.0, 0.68, 0.4], intensity, range: 7, innerDeg: 0, outerDeg: 180, name, group, enabled: on, volumetric: 0.25, fixtureBox: fb, radius: 0.06 });
  };
  /** a hurricane LANTERN standing on something `baseY` high (0 = the floor; a low table 0.3, a table 0.75): a small warm light, its own fuel (not the mains) */
  const lantern = (x: number, z: number, name: string, group: string, baseY = 0, on = true) => {
    host.add({ c: [x, baseY + 0.03, z], h: [0.07, 0.03, 0.07], ...M.paintBlue });
    const fb = host.add({ c: [x, baseY + 0.15, z], h: [0.045, 0.09, 0.045], ...M.plasticWhite, emissive: on ? [9, 5.3, 2] : [0, 0, 0], flags: DECAL });
    host.add({ c: [x, baseY + 0.265, z], h: [0.055, 0.025, 0.055], ...M.paintBlue, flags: DECAL });
    host.lights.push({ kind: 'point', pos: [x, baseY + 0.3, z], dir: [0, -1, 0], color: [1.0, 0.6, 0.28], intensity: 4.5, range: 5.5, innerDeg: 0, outerDeg: 180, name, group, enabled: on, volumetric: 0.3, fixtureBox: fb, radius: 0.05, mains: false });
  };
  /** a bare fluorescent TUBE under a roof (light-only, like the kits' ceiling panels — the camera looks through the roof): a switchable in `group` */
  const tube = (x: number, z: number, alongX: boolean, group: string, on = true, flicker = false) => {
    const radiance: Vec3 = [30, 31, 30];
    const bi = host.add({ c: [x, H - 0.03, z], h: alongX ? [0.6, 0.02, 0.05] : [0.05, 0.02, 0.6], ...M.plasticWhite, emissive: on ? radiance : [0, 0, 0], flags: BoxFlag.NoPrimary });
    host.switchables.push({ name: `tube_${group}_${host.switchables.length}`, boxes: [bi], group, on, baseEmissive: radiance, flicker });
    return bi;
  };
  /** a work FLOODLIGHT on a pole `height` tall at (x, z), thrown along `dir` (an XZ direction): white, wide, off the yard's own supply (group 'exterior') */
  const floodLight = (x: number, z: number, dir: [number, number], name: string, on = true, height = 3.4, mains = false) => {
    const l = Math.hypot(dir[0], dir[1]) || 1, dx = dir[0] / l, dz = dir[1] / l, yaw = Math.atan2(dx, dz);
    host.add({ c: [x, height / 2, z], h: [0.04, height / 2, 0.04], ...M.galv });
    host.add({ c: [x + dx * 0.1, height + 0.02, z + dz * 0.1], h: [0.16, 0.1, 0.07], yaw, ...M.plasticBlack });
    const fb = host.add({ c: [x + dx * 0.175, height + 0.02, z + dz * 0.175], h: [0.13, 0.08, 0.008], yaw, ...M.plasticWhite, emissive: on ? [60, 62, 64] : [0, 0, 0], flags: DECAL });
    host.lights.push({ kind: 'spot', pos: [x + dx * 0.2, height, z + dz * 0.2], dir: [dx * 0.8, -0.6, dz * 0.8], color: [0.92, 0.96, 1.0], intensity: 210, range: 20, innerDeg: 38, outerDeg: 70, name, group: 'exterior', enabled: on, volumetric: 0.14, fixtureBox: fb, radius: 0.14, mains, broad: true });
  };

  return {
    M, mk, face, marksOf, piece,
    // walls
    as, wallX, wallZ, partX, partZ, yardWallX, yardWallZ, pier, skirt, dado, wallHanging, gate,
    // ground
    ground, patch, ruts, rubble,
    // cloth & beds
    rug, toshak, cot, charpoy, washLine,
    // furniture
    lowTable, table, plasticChair, chairAs, trunk, stove, tandoor,
    // stores & cover
    drum, drums, drumDown, jerryCan, gasBottle, crates, sacks, sandbags, hesco, jersey, tWall, tyres, blocks, woodPile,
    // machines & vehicles
    generator, waterTank, pump, pickup, van, motorbike, handcart, stall, container, satDish, bush,
    // lights
    wire, bulb, lantern, tube, floodLight,
  };
}
export type GwotKit = ReturnType<typeof gwotKit>;

/** the host of a levelKit.ts LevelKit (the functional kit): `gwotKit(gwotOfKit(k, LK))` with `import * as LK from './levelKit'` */
export function gwotOfKit<K extends { lights: LightDef[]; switchables: Level['switchables']; marks: boolean; texel: number }>(k: K, LK: {
  add(k: K, b: Partial<Box> & { c: Vec3; h: Vec3 }): number;
  prop(k: K, kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: PropPart[], half?: [number, number]): PropDef;
  wallX(k: K, z: number, x0: number, x1: number, t: number, albedo: Vec3, openings?: GwotOpening[], extra?: Partial<Box>, height?: number): void;
  wallZ(k: K, x: number, z0: number, z1: number, t: number, albedo: Vec3, openings?: GwotOpening[], extra?: Partial<Box>, height?: number): void;
}): GwotHost {
  return { add: b => LK.add(k, b), prop: (kind, x, z, yaw, mass, parts, half) => LK.prop(k, kind, x, z, yaw, mass, parts, half), wallX: (...a) => LK.wallX(k, ...a), wallZ: (...a) => LK.wallZ(k, ...a),
    lights: k.lights, switchables: k.switchables, marks: k.marks, texel: k.texel };
}
