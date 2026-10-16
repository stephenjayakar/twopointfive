// MARKINGS — object legibility from one or two SIGNIFIERS per object class, made of the same thing the world is made of: rectangles, in 2D, ON a box
// face (docs/review/legibility.html; the maintainer's ask 08-10: "the monitor looks great but the keyboard doesn't … cardboard boxes are hard to recognize
// … vending machine"). REPRESENTATION (agreed with the maintainer: image-style authoring, analytic rendering): a marking is a tiny PALETTE-INDEXED
// BITMAP — W × H ≤ 32 × 32 cells, 2 bits a cell (0 = transparent, 1‥3 = palette entries), each palette entry a MATERIAL (albedo — absolute or × the
// box's own — roughness, emitted radiance), never a shaded colour, so baked lighting is impossible by construction — laid on a world-space texel
// lattice anchored at the face centre (MARKING_TEXEL 2.5 cm base; `fine` = half, `coarse` = double, all nesting). The g-buffer / composite / the
// reflection pass evaluate it ANALYTICALLY (render/shaders/markings.wgsl): cell = floor(face uv ÷ texel), 2 bits fetched from the per-box table, palette
// lookup, coverage against the cell edges for anti-aliasing ONLY at cell boundaries (crisp pixel art that never shimmers under the TAAU jitter), a fade to
// the marking's own mean under about a pixel a texel (a tint at verylow, never noise), cone-averaged at reflection hits. No image files, no texture
// bindings, no sampling in any ray pass. PROCEDURAL kinds (key grids, seams + pulls, text bars, LED rows, tape, can rows) are bitmap GENERATORS below;
// HAND-DRAWN kinds (this-side-up / fragile glyphs, a label, a scribble) are ASCII-art rows ('.' 'a' 'b' 'c'). The level file stores the cells (top row
// first) — canonical, deterministic, greppable. Readable text / logos would come later as an SDF-glyph atlas add-on to this same table, not now.
//
// This file also computes each marking's per-entry COVERAGE FRACTIONS (the mean the shader fades to; area-averaged over the box, the albedo the secondary
// rays see — boxes.ts upload: GI energy right at zero ray cost) and its MEAN EMISSION (an emissive marking is a LIGHT: game.ts registers a one-sided
// rectangular emitter for it exactly like an emissive fixture box, so ReSTIR shadows, froxel beams, the bounce and the light meter all see it).
import type { Vec3 } from '../math/vec';

/** the base world-space texel (m): a key cap, a text bar, an LED are one of these (fine = half, coarse = double) */
export const MARKING_TEXEL = 0.025;
export const MAX_MARKS_PER_BOX = 4;
export const MAX_CELLS_W = 32; export const MAX_CELLS_H = 32; export const MAX_PAL = 3;
/** GPU table: vec4f rows in the tail of BoxWorld.matBuf; a record = MARK_HEAD_ROWS header rows + ceil(W·H / 48) cell rows (12 cells a float, exact small integers) */
export const MARK_HEAD_ROWS = 8; export const CELLS_PER_FLOAT = 12; export const CELLS_PER_ROW = 48;
export const MARK_TABLE_ROWS = 6144;   // 96 KB of table (the office packs ≈ 1.5k rows)
export const MARK_SLOT_SHIFT = 18; export const MARK_SLOT_MAX = (1 << 14) - 1;   // the 1-based first-record ROW in the flags word's top 14 bits

export type MarkFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export const MARK_FACES: readonly MarkFace[] = ['+x', '-x', '+y', '-y', '+z', '-z'];   // index = the g-buffer's face order (gbuffer.wgsl cubeCorner)
export type MarkRes = 'fine' | 'base' | 'coarse';
export const MARK_RES: readonly MarkRes[] = ['fine', 'base', 'coarse'];
export const RES_K: Record<MarkRes, number> = { fine: 0.5, base: 1, coarse: 2 };

/** One palette entry = a MATERIAL: `albedo` absolute linear rgb, else `mul` × the box's own albedo (absent both = the box's albedo untouched — a roughness-only
 *  or emission-only entry); `rough` (absent = the box's); `emit` = emitted radiance rgb (W/sr/m², absent = none — × the switchable's supply at runtime). */
export interface MarkPal { albedo?: Vec3; mul?: number; rough?: number; emit?: Vec3; }
export interface MarkingDef {
  face: MarkFace;
  /** texel = MARKING_TEXEL × ½ / 1 / 2; absent = base */
  res?: MarkRes;
  /** lattice coords (integers, this marking's texel) of the bitmap's BOTTOM-LEFT cell, from the face centre along the face's (u, v) axes (FACE_AXES) */
  at: [number, number];
  /** W, H in cells (1‥32) */
  size: [number, number];
  pal: MarkPal[];
  /** H rows TOP FIRST, each W chars of '.' (transparent) 'a' 'b' 'c' (pal[0‥2]) */
  cells: string[];
}
export const CELL_CHARS = '.abc';

/** Box-local (u, v, n) axes per face — u to the right and v up as seen from OUTSIDE for the vertical faces (gbuffer.wgsl cubeCorner's basis); +y: u = +x, v = −z */
export const FACE_AXES: readonly { u: Vec3; v: Vec3; n: Vec3 }[] = [
  { u: [0, 0, -1], v: [0, 1, 0], n: [1, 0, 0] }, { u: [0, 0, 1], v: [0, 1, 0], n: [-1, 0, 0] },
  { u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0] }, { u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] },
  { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }, { u: [-1, 0, 0], v: [0, 1, 0], n: [0, 0, -1] },
];
export function faceHalf(h: Vec3, f: number): { hu: number; hv: number; hn: number } {
  const ax = FACE_AXES[f]; const pick = (a: Vec3) => Math.abs(a[0]) * h[0] + Math.abs(a[1]) * h[1] + Math.abs(a[2]) * h[2];
  return { hu: pick(ax.u), hv: pick(ax.v), hn: pick(ax.n) };
}
export const faceIndex = (f: MarkFace) => MARK_FACES.indexOf(f);
export const texelOf = (m: { res?: MarkRes }, base = MARKING_TEXEL) => base * RES_K[m.res ?? 'base'];

/** One MarkingDef with only the keys it means, in canonical order (levelData KEYS.marking / KEYS.markpal) — every producer goes through here so two markings that
 *  mean the same thing are the same structure (the level identity probe compares them leaf for leaf). */
export function marking(m: MarkingDef): MarkingDef {
  const o: MarkingDef = { face: m.face, ...(m.res !== undefined && m.res !== 'base' ? { res: m.res } : {}), at: [m.at[0], m.at[1]], size: [m.size[0], m.size[1]], pal: m.pal.map(palEntry), cells: m.cells.slice() } as MarkingDef;
  return o;
}
export function palEntry(p: MarkPal): MarkPal {
  const o: MarkPal = {};
  if (p.albedo) o.albedo = [p.albedo[0], p.albedo[1], p.albedo[2]]; else if (p.mul !== undefined && p.mul !== 1) o.mul = p.mul;
  if (p.rough !== undefined) o.rough = p.rough;
  if (p.emit && (p.emit[0] > 0 || p.emit[1] > 0 || p.emit[2] > 0)) o.emit = [p.emit[0], p.emit[1], p.emit[2]];
  return o;
}
export const copyMarkings = (ms: readonly MarkingDef[] | undefined): MarkingDef[] | undefined => ms && ms.length ? ms.map(marking) : undefined;

/** every problem with a marking on a box of half extents h — levelData.ts validate calls it per marking */
export function markingErrors(m: any, h: Vec3, base = MARKING_TEXEL): string[] {
  const e: string[] = [];
  const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const isVec = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(x => isNum(x) && x >= 0);
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['must be an object'];
  const KEYS_M = ['face', 'res', 'at', 'size', 'pal', 'cells'];
  for (const k of Object.keys(m)) if (m[k] !== undefined && !KEYS_M.includes(k)) e.push(`unknown key '${k}' (allowed: ${KEYS_M.join(', ')})`);
  const f = MARK_FACES.indexOf(m.face); if (f < 0) e.push(`face must be one of ${MARK_FACES.join(' ')}`);
  if (m.res !== undefined && !MARK_RES.includes(m.res)) e.push(`res must be one of ${MARK_RES.join(' ')}`);
  const okAt = Array.isArray(m.at) && m.at.length === 2 && m.at.every((x: unknown) => Number.isInteger(x));
  const okSize = Array.isArray(m.size) && m.size.length === 2 && m.size.every((x: unknown) => Number.isInteger(x)) && m.size[0] >= 1 && m.size[0] <= MAX_CELLS_W && m.size[1] >= 1 && m.size[1] <= MAX_CELLS_H;
  if (!okAt) e.push('at must be [U0, V0] integers'); if (!okSize) e.push(`size must be [W, H] integers, 1‥${MAX_CELLS_W} × 1‥${MAX_CELLS_H}`);
  const pal = Array.isArray(m.pal) ? m.pal : null;
  if (!pal || pal.length < 1 || pal.length > MAX_PAL) e.push(`pal must be 1‥${MAX_PAL} entries`);
  else pal.forEach((p: any, k: number) => {
    if (!p || typeof p !== 'object') { e.push(`pal[${k}] must be an object`); return; }
    for (const q of Object.keys(p)) if (p[q] !== undefined && !['albedo', 'mul', 'rough', 'emit'].includes(q)) e.push(`pal[${k}]: unknown key '${q}'`);
    if (p.albedo !== undefined && !(isVec(p.albedo) && p.albedo.every((x: number) => x <= 1))) e.push(`pal[${k}].albedo must be a Vec3 in [0, 1]`);
    if (p.mul !== undefined && !(isNum(p.mul) && p.mul >= 0 && p.mul <= 4)) e.push(`pal[${k}].mul must be in [0, 4]`);
    if (p.albedo !== undefined && p.mul !== undefined) e.push(`pal[${k}]: albedo OR mul, not both`);
    if (p.rough !== undefined && !(isNum(p.rough) && p.rough >= 0 && p.rough <= 1)) e.push(`pal[${k}].rough must be in [0, 1]`);
    if (p.emit !== undefined && !isVec(p.emit)) e.push(`pal[${k}].emit must be a Vec3 ≥ 0`);
  });
  if (okSize) {
    const [W, H] = m.size;
    if (!(Array.isArray(m.cells) && m.cells.length === H && m.cells.every((r: unknown) => typeof r === 'string' && r.length === W))) e.push(`cells must be ${H} strings of ${W} characters (top row first)`);
    else { const maxIdx = pal ? pal.length : 0; for (const r of m.cells as string[]) for (const ch of r) { const i = CELL_CHARS.indexOf(ch); if (i < 0 || i > maxIdx) { e.push(`cells: character '${ch}' is not one of '${CELL_CHARS.slice(0, maxIdx + 1)}'`); break; } } }
    if (f >= 0 && okAt) {
      const t = texelOf(m, base); const { hu, hv } = faceHalf(h, f); const eps = 1e-6;
      const u0 = m.at[0] * t, v0 = m.at[1] * t, u1 = (m.at[0] + W) * t, v1 = (m.at[1] + H) * t;
      if (u0 < -hu - eps || u1 > hu + eps || v0 < -hv - eps || v1 > hv + eps) e.push(`the bitmap [${u0.toFixed(3)}, ${v0.toFixed(3)}]‥[${u1.toFixed(3)}, ${v1.toFixed(3)}] m leaves the face (±${hu.toFixed(3)} × ±${hv.toFixed(3)})`);
    }
  }
  return e;
}

// ------------------------------------------------------------------------------------------------------------------------------------ authoring: the cell canvas + generators
/** A W × H cell canvas (j = 0 is the BOTTOM row; toRows() prints top first). The procedural kinds draw into one; several shapes on one face region share one. */
export class CellCanvas {
  readonly cells: Uint8Array;
  constructor(readonly W: number, readonly H: number) { if (W < 1 || H < 1 || W > MAX_CELLS_W || H > MAX_CELLS_H) throw new Error(`CellCanvas ${W}×${H}: 1‥32 each`); this.cells = new Uint8Array(W * H); }
  set(i: number, j: number, e: number) { if (i >= 0 && j >= 0 && i < this.W && j < this.H) this.cells[j * this.W + i] = e; return this; }
  get(i: number, j: number) { return i >= 0 && j >= 0 && i < this.W && j < this.H ? this.cells[j * this.W + i] : 0; }
  /** fill the cell rect [i0, i1) × [j0, j1) with entry e */
  fill(e: number, i0 = 0, j0 = 0, i1 = this.W, j1 = this.H) { for (let j = Math.max(j0, 0); j < Math.min(j1, this.H); j++) for (let i = Math.max(i0, 0); i < Math.min(i1, this.W); i++) this.cells[j * this.W + i] = e; return this; }
  toRows(): string[] { const rows: string[] = []; for (let j = this.H - 1; j >= 0; j--) { let s = ''; for (let i = 0; i < this.W; i++) s += CELL_CHARS[this.cells[j * this.W + i]]; rows.push(s); } return rows; }
}
/** the one integer hash the generators use for ragged text / can layouts (deterministic: the level file must not depend on Math.random) */
export function mkHash(s: number, a: number, b: number): number {
  let h = (Math.imul(s >>> 0, 0x9E3779B1) ^ Math.imul((a + 0x7F4A) >>> 0, 0x85EBCA77) ^ Math.imul((b + 0x94D0) >>> 0, 0xC2B2AE3D)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x2C1B3C6D) >>> 0; h = (h ^ (h >>> 12)) >>> 0; h = Math.imul(h, 0x297A2D39) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return h >>> 0;
}
const idiv = (a: number, b: number) => Math.floor(a / b);
export const GEN = {
  /** caps (entry cap) on a deck (entry deck): cap × cap cells with `gap` between and around; keyboard = the bottom row's middle is one long bar */
  grid(c: CellCanvas, capW = 1, capH = 1, gap = 1, keyboard = false, deck = 1, cap = 2) {
    const Pu = capW + gap, Pv = capH + gap; const W = c.W, H = c.H;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const r = idiv(j, Pv); const inV = (j - r * Pv) >= gap; let inU = (i % Pu) >= gap;
      if (keyboard && r === 0) { const sL = idiv(W * 5, 16), sR = W - sL; if (i >= sL && i < sR) inU = i > sL && i < sR - 1; }
      c.set(i, j, inU && inV ? cap : deck);
    }
    return c;
  },
  /** 1-cell seams (entry seam) between `rows` × `cols` cells of the canvas (never on its edge) + a pullW × pullH pull (entry pull) in each cell's upper third */
  seams(c: CellCanvas, rows = 3, cols = 1, pullW = 3, pullH = 1, seam = 1, pull = 2) {
    const W = c.W, H = c.H;
    const jb = (k: number) => idiv(k * H + idiv(rows, 2), rows), ib = (k: number) => idiv(k * W + idiv(cols, 2), cols);
    for (let k = 1; k < rows; k++) c.fill(seam, 0, jb(k), W, jb(k) + 1);
    for (let k = 1; k < cols; k++) c.fill(seam, ib(k), 0, ib(k) + 1, H);
    if (pullW > 0 && pullH > 0) for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const j0 = r === 0 ? 0 : jb(r) + 1, j1 = r === rows - 1 ? H : jb(r + 1); const i0 = q === 0 ? 0 : ib(q) + 1, i1 = q === cols - 1 ? W : ib(q + 1);
      const cw = i1 - i0, chh = j1 - j0; const pw = Math.min(pullW, cw); const pi0 = i0 + idiv(cw - pw, 2), pj0 = j0 + idiv(chh * 2, 3);
      c.fill(pull, pi0, pj0, pi0 + pw, Math.min(pj0 + pullH, j1));
    }
    return c;
  },
  /** ragged text bars from the top: `thick` cells tall, `gap` between, a cell of margin either side, the odd paragraph break; entry ink */
  lines(c: CellCanvas, thick = 1, gap = 1, seed = 0, ink = 1) {
    const W = c.W, H = c.H; const P = thick + gap; const nBars = idiv(H + gap, P); const inner = Math.max(W - 2, 0);
    for (let r = 0; r < nBars; r++) {
      const hsh = mkHash(seed, r, 7); if (r > 0 && r < nBars - 1 && hsh % 5 === 4) continue;
      let len = 1 + idiv(inner * (5 + (hsh >>> 4) % 6), 10); if (r === nBars - 1 && nBars > 2) len = 1 + idiv(inner * 3, 10) + (hsh >>> 8) % Math.max(idiv(W, 4), 1);
      const lim = Math.min(1 + len, W - 1) + (W <= 3 ? 1 : 0); const top = H - 1 - r * P;
      c.fill(ink, 1, top - thick + 1, lim, top + 1);
    }
    return c;
  },
  /** a signature-like zigzag two thirds up + a short underline, one cell wide (entry ink) */
  scribble(c: CellCanvas, seed = 0, ink = 1) {
    const W = c.W, H = c.H; const yb = idiv(H * 3, 5), amp = 1 + (seed % 2);
    let prev = -99;
    for (let i = 1; i < W - 1; i++) {
      const t = i % 4; const y = yb + (t === 0 ? 0 : t === 2 ? 2 : 1) * amp - amp;
      if (prev > -99 && Math.abs(y - prev) > 1) c.fill(ink, i, Math.min(y, prev) + 1, i + 1, Math.max(y, prev));   // join the stroke: no gaps between diagonal neighbours two rows apart
      c.set(i, y, ink); prev = y;
    }
    c.fill(ink, 1, idiv(H, 4), 1 + idiv((W - 2) * 3, 5), idiv(H, 4) + 1);
    return c;
  },
  /** a row of `count` 1-cell dots at `pitch` along u at row j (entry dot; every dot k with hash % amberEvery === 0 → entry alt) */
  dots(c: CellCanvas, count = 3, pitch = 2, j = idiv(c.H, 2), seed = 0, amberEvery = 0, dot = 1, alt = 2) {
    for (let k = 0; k < count; k++) c.set(k * pitch, j, amberEvery > 0 && mkHash(seed, k, 3) % amberEvery === 0 ? alt : dot);
    return c;
  },
  /** the vending PRODUCT WINDOW: `cols` cans a shelf × `rows` shelves — each cell's bottom row = the rail (transparent = the machine's own dark front) with a
   *  2-cell white tag (entry back), a 1-cell backlit gap left of each can and over the top shelf (entry back), cans in entries canA / canB (2 : 1), the odd coil sold out */
  window(c: CellCanvas, cols = 4, rows = 4, seed = 0, canA = 1, canB = 2, back = 3) {
    const W = c.W, H = c.H;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const col = Math.min(idiv(i * cols, W), cols - 1), r = Math.min(idiv(j * rows, H), rows - 1);
      const i0 = idiv(col * W, cols), i1 = idiv((col + 1) * W, cols), j0 = idiv(r * H, rows), j1 = idiv((r + 1) * H, rows);
      const ci = i - i0, cj = j - j0, cw = i1 - i0, chh = j1 - j0;
      let e: number;
      if (cj === 0) e = ci >= 1 && ci <= 2 && ci < cw ? back : 0;
      else if (cj === chh - 1 && chh >= 4) e = back;
      else if (ci === 0) e = back;
      else { const hsh = mkHash(seed, col, r); e = hsh % 7 === 0 ? back : (hsh >>> 3) % 3 === 2 ? canB : canA; }
      c.set(i, j, e);
    }
    return c;
  },
  /** a 5×7 glyph (GLYPHS row masks, top first) at cell (i0, j0) = its bottom-left, × scale, entry ink */
  glyph(c: CellCanvas, g: number, i0 = 0, j0 = 0, scale = 1, ink = 1) {
    const rows = GLYPHS[g]; if (!rows) return c;
    for (let gr = 0; gr < 7; gr++) for (let gc = 0; gc < 5; gc++) if ((rows[gr] >> (4 - gc)) & 1) c.fill(ink, i0 + gc * scale, j0 + (6 - gr) * scale, i0 + (gc + 1) * scale, j0 + (7 - gr) * scale);
    return c;
  },
};
export const GLYPH_NAMES = ['this side up', 'fragile', 'keep dry', 'cross', 'mark'];
/** 5×7 pictograms, row 0 = TOP, bit 4 = leftmost column */
export const GLYPHS: readonly (readonly number[])[] = [
  [0b00100, 0b01110, 0b10101, 0b00100, 0b00100, 0b00100, 0b11111],   // arrow up over a base line: this side up
  [0b10001, 0b10001, 0b11111, 0b01110, 0b00100, 0b00100, 0b01110],   // stemmed glass: fragile
  [0b00100, 0b01110, 0b11111, 0b00100, 0b00100, 0b10100, 0b01100],   // umbrella: keep dry
  [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],   // cross (first aid)
  [0b11111, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11111],   // hollow square (a maker's mark / the company logo's frame)
];
/** Build a marking from a rect in METRES on the face (snapped INWARD onto the marking's lattice → at / size) and a painter that fills the canvas; null if the snapped rect is empty. */
export function markFromRect(face: MarkFace, res: MarkRes, rect: [number, number, number, number], pal: MarkPal[], paint: (c: CellCanvas) => void, base = MARKING_TEXEL): MarkingDef | null {
  const t = base * RES_K[res]; const eps = 1e-7;
  const U0 = Math.ceil(rect[0] / t - eps), V0 = Math.ceil(rect[1] / t - eps), U1 = Math.floor(rect[2] / t + eps), V1 = Math.floor(rect[3] / t + eps);
  const W = Math.min(U1 - U0, MAX_CELLS_W), H = Math.min(V1 - V0, MAX_CELLS_H); if (W < 1 || H < 1) return null;
  const c = new CellCanvas(W, H); paint(c);
  return marking({ face, res, at: [U0, V0], size: [W, H], pal, cells: c.toRows() });
}
/** a marking from ASCII-art rows (top first) placed with its bottom-left cell at lattice (U0, V0) */
export function markFromArt(face: MarkFace, res: MarkRes, U0: number, V0: number, rows: string[], pal: MarkPal[]): MarkingDef {
  const W = rows[0]?.length ?? 0; if (!W || rows.some(r => r.length !== W)) throw new Error('markFromArt: rows must be equal length');
  return marking({ face, res, at: [U0, V0], size: [W, rows.length], pal, cells: rows.slice() });
}

// ------------------------------------------------------------------------------------------------------------------------------------ stats + packing
export interface MarkStats {
  texel: number; W: number; H: number;
  /** coverage fraction of palette entries 1‥3 over the bitmap */
  f: [number, number, number];
  /** the entries' resolved albedos (absolute; `mul` × the base) */
  alb: [Vec3, Vec3, Vec3];
  /** mean radiance over the bitmap at gain 1 (rgb) and the bitmap's area (m²) */
  meanL: Vec3; area: number;
  /** mean albedo change over the bitmap: Σ_k f_k (albedo_k − base) */
  dAlbedo: Vec3;
  /** bit k−1 set = entry k emits */
  emask: number;
}
export function resolveAlbedo(p: MarkPal | undefined, base: Vec3): Vec3 {
  if (!p) return [base[0], base[1], base[2]];
  if (p.albedo) return [p.albedo[0], p.albedo[1], p.albedo[2]];
  const k = p.mul ?? 1; return [Math.min(base[0] * k, 1), Math.min(base[1] * k, 1), Math.min(base[2] * k, 1)];
}
export function markStats(m: MarkingDef, base: Vec3, texelBase = MARKING_TEXEL): MarkStats {
  const t = texelOf(m, texelBase); const [W, H] = m.size;
  const cnt = [0, 0, 0, 0];
  for (const r of m.cells) for (let i = 0; i < r.length; i++) cnt[CELL_CHARS.indexOf(r[i])]++;
  const n = W * H; const f: [number, number, number] = [cnt[1] / n, cnt[2] / n, cnt[3] / n];
  const alb: [Vec3, Vec3, Vec3] = [resolveAlbedo(m.pal[0], base), resolveAlbedo(m.pal[1], base), resolveAlbedo(m.pal[2], base)];
  const meanL: Vec3 = [0, 0, 0]; const dAlbedo: Vec3 = [0, 0, 0]; let emask = 0;
  for (let k = 0; k < 3; k++) {
    const p = m.pal[k]; if (!p) continue;
    if (p.emit) { emask |= 1 << k; for (let ch = 0; ch < 3; ch++) meanL[ch] += f[k] * p.emit[ch]; }
    if (p.albedo || (p.mul !== undefined && p.mul !== 1)) for (let ch = 0; ch < 3; ch++) dAlbedo[ch] += f[k] * (alb[k][ch] - base[ch]);
  }
  return { texel: t, W, H, f, alb, meanL, area: (W * t) * (H * t), dAlbedo, emask };
}
/** rows the packed record takes */
export const markRecordRows = (m: MarkingDef) => MARK_HEAD_ROWS + Math.ceil(m.size[0] * m.size[1] / CELLS_PER_ROW);
/** The GPU record at vec4 row `row` of `out` (a Float32Array of the whole table): plain floats only — every packed field a small exact integer, no bit
 *  pattern a float load could renormalise (markings.wgsl markLoad reads it back the same way):
 *    row 0: U0 V0 W H                    row 1: meta, f1 f2 f3      meta = face + 8·res + 32·last + 64·anyEmit + 128·areaLit + 256·emask + 2048·palFlags (bit k: entry k+1 changes albedo; bit 3+k: it sets roughness)
 *    rows 2‥7: entry k = (albedo.rgb, rough) then (emit.rgb, 0)     rows 8…: the cells, 12 a float (2 bits each, cell j·W + i, j from the bottom), 48 a row */
export function packMarking(out: Float32Array, row: number, m: MarkingDef, st: MarkStats, last: boolean, anyEmit: boolean, areaLit: boolean) {
  const o = row * 4; out.fill(0, o, o + markRecordRows(m) * 4);
  let palFlags = 0; for (let k = 0; k < 3; k++) { const p = m.pal[k]; if (!p) continue; if (p.albedo || (p.mul !== undefined && p.mul !== 1)) palFlags |= 1 << k; if (p.rough !== undefined) palFlags |= 8 << k; }
  const meta = faceIndex(m.face) + 8 * MARK_RES.indexOf(m.res ?? 'base') + 32 * (last ? 1 : 0) + 64 * (anyEmit ? 1 : 0) + 128 * (areaLit ? 1 : 0) + 256 * st.emask + 2048 * palFlags;
  out[o] = m.at[0]; out[o + 1] = m.at[1]; out[o + 2] = m.size[0]; out[o + 3] = m.size[1];
  out[o + 4] = meta; out[o + 5] = st.f[0]; out[o + 6] = st.f[1]; out[o + 7] = st.f[2];
  for (let k = 0; k < 3; k++) {
    const p = m.pal[k]; const b = o + 8 + k * 8; const a = st.alb[k];
    out[b] = a[0]; out[b + 1] = a[1]; out[b + 2] = a[2]; out[b + 3] = p?.rough ?? -1;
    out[b + 4] = p?.emit?.[0] ?? 0; out[b + 5] = p?.emit?.[1] ?? 0; out[b + 6] = p?.emit?.[2] ?? 0; out[b + 7] = 0;
  }
  const [W, H] = m.size; const cb = o + MARK_HEAD_ROWS * 4;
  for (let j = 0; j < H; j++) { const rowStr = m.cells[H - 1 - j]; for (let i = 0; i < W; i++) { const e = CELL_CHARS.indexOf(rowStr[i]); if (e <= 0) continue; const c = j * W + i; out[cb + Math.floor(c / CELLS_PER_FLOAT)] += e << (2 * (c % CELLS_PER_FLOAT)); } }
}
/** markings whose emission has been registered as an analytic light (game.ts): reflections then take only emitTraceK of the traced radiance, as for an area-lit fixture */
export const AREA_LIT_MARKS = new WeakSet<MarkingDef>();
export function faceAreas(h: Vec3): { areas: number[]; total: number } {
  const areas = MARK_FACES.map((_, f) => { const { hu, hv } = faceHalf(h, f); return 4 * hu * hv; });
  return { areas, total: areas.reduce((s, a) => s + a, 0) };
}
/** The albedo the SECONDARY rays should see for a marked box: its base albedo + every marking's mean change × (its area ÷ the box's total surface) — the same
 *  energy the per-pixel evaluation returns averaged over the box, at zero ray-path cost. */
export function secondaryAlbedo(base: Vec3, h: Vec3, marks: readonly MarkingDef[], texelBase = MARKING_TEXEL): Vec3 {
  const { total } = faceAreas(h); if (total <= 0) return [base[0], base[1], base[2]];
  const out: Vec3 = [base[0], base[1], base[2]];
  for (const m of marks) { const st = markStats(m, base, texelBase); const w = Math.min(st.area / total, 1); out[0] += st.dAlbedo[0] * w; out[1] += st.dAlbedo[1] * w; out[2] += st.dAlbedo[2] * w; }
  return [Math.min(Math.max(out[0], 0), 1), Math.min(Math.max(out[1], 0), 1), Math.min(Math.max(out[2], 0), 1)];
}
/** the world-space centre, half sizes and outward normal of a marking's bitmap on box (c, h, yaw) — where game.ts stands its light */
export function markWorldRect(m: MarkingDef, c: Vec3, h: Vec3, yaw: number, texelBase = MARKING_TEXEL): { centre: Vec3; n: Vec3; hu: number; hv: number } {
  const f = faceIndex(m.face); const ax = FACE_AXES[f]; const t = texelOf(m, texelBase);
  const cs = Math.cos(yaw), sn = Math.sin(yaw); const toWorld = (l: Vec3): Vec3 => [cs * l[0] + sn * l[2], l[1], -sn * l[0] + cs * l[2]];   // Box.yaw convention: +X → (cos, 0, −sin), +Z → (sin, 0, cos)
  const n = toWorld(ax.n), uW = toWorld(ax.u), vW = toWorld(ax.v); const { hn } = faceHalf(h, f);
  const uc = (m.at[0] + m.size[0] / 2) * t, vc = (m.at[1] + m.size[1] / 2) * t;
  return { centre: [c[0] + n[0] * hn + uW[0] * uc + vW[0] * vc, c[1] + n[1] * hn + uW[1] * uc + vW[1] * vc, c[2] + n[2] * hn + uW[2] * uc + vW[2] * vc], n, hu: m.size[0] * t / 2, hv: m.size[1] * t / 2 };
}
