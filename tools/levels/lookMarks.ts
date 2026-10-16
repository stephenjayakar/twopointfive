// PAINT ON THE GROUND for a level's look file (tools/levels/gwotSkin.ts `dress`): lines, outlines, hazard bands, tiles, tally bars, digits and letters — every
// one of them flat decals laid through the skin's own `T.flat`, so the skin's rule holds by construction (NoShadow, starting at the floor: nothing a man, a
// round or a ray meets). A level's signature marks are built from these; which family a level uses is its own look file's business.
import type { Vec3 } from '../../src/math/vec';
import type { SkinTools } from './gwotSkin';

/** 3 × 5 glyphs, rows top to bottom, a bit per column (4 = left) */
const FONT: Record<string, number[]> = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7],
  '7': [7, 1, 1, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7], A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [7, 4, 4, 4, 7], N: [5, 7, 7, 5, 5], S: [7, 4, 7, 1, 7],
};

export function lookMarks(T: SkinTools) {
  /** a height of its own for every mark laid, so two that cross never share a plane (0.0118‥0.0138: over the skin's wear, under a rug) */
  let n = 0; const lift = () => 0.0118 + (n++ % 100) * 0.00002;
  /** a straight painted line from (x0, z0) to (x1, z1), `w` wide */
  const seg = (x0: number, z0: number, x1: number, z1: number, w: number, col: Vec3) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.02) return;
    T.flat((x0 + x1) / 2, (z0 + z1) / 2, L, w, col, -Math.atan2(dz, dx), lift());
  };
  /** a line through several points (square joints: each stretch runs half a width past its ends) */
  const path = (pts: [number, number][], w: number, col: Vec3) => {
    for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L * w / 2, uz = (bz - az) / L * w / 2;
      seg(ax - ux, az - uz, bx + ux, bz + uz, w, col); }
  };
  /** a broken line: dashes `dash` long with `gap` between */
  const dashed = (x0: number, z0: number, x1: number, z1: number, w: number, col: Vec3, dash = 0.6, gap = 0.4) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (let s = 0; s < L; s += dash + gap) { const e = Math.min(L, s + dash); seg(x0 + ux * s, z0 + uz * s, x0 + ux * e, z0 + uz * e, w, col); }
  };
  /** the outline of an axis-aligned rectangle, lines `t` wide; `open` leaves sides out ('n' = the −z side, 's', 'w' = −x, 'e') */
  const outline = (x0: number, z0: number, x1: number, z1: number, t: number, col: Vec3, open = '') => {
    if (!open.includes('n')) seg(x0, z0 + t / 2, x1, z0 + t / 2, t, col); if (!open.includes('s')) seg(x0, z1 - t / 2, x1, z1 - t / 2, t, col);
    if (!open.includes('w')) seg(x0 + t / 2, z0, x0 + t / 2, z1, t, col); if (!open.includes('e')) seg(x1 - t / 2, z0, x1 - t / 2, z1, t, col);
  };
  /** a filled rectangle */
  const fill = (x0: number, z0: number, x1: number, z1: number, col: Vec3) => { T.flat((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, col, 0, lift()); };
  /** a HAZARD BAND: blocks of `a` and `b` alternating along the longer side of the rectangle */
  const hazard = (x0: number, z0: number, x1: number, z1: number, a: Vec3, b: Vec3, block = 0.3) => {
    const alongX = x1 - x0 >= z1 - z0, L = alongX ? x1 - x0 : z1 - z0, k = Math.max(2, Math.round(L / block)), d = L / k;
    for (let i = 0; i < k; i++) { const s = (alongX ? x0 : z0) + i * d; if (alongX) fill(s, z0, s + d, z1, i % 2 ? b : a); else fill(x0, s, x1, s + d, i % 2 ? b : a); }
  };
  /** TILES: every other `cell` of the rectangle in `col` (the floor's own colour is the other tile); `skip(x, z)` leaves a tile out */
  const checker = (x0: number, z0: number, x1: number, z1: number, cell: number, col: Vec3, skip?: (x: number, z: number) => boolean) => {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell)), cx = (x1 - x0) / nx, cz = (z1 - z0) / nz, y = lift();
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { if ((i + j) % 2) continue; const x = x0 + (i + 0.5) * cx, z = z0 + (j + 0.5) * cz; if (skip?.(x, z)) continue; T.flat(x, z, cx, cz, col, 0, y); }
  };
  /** a DIGIT or LETTER `h` tall (3 : 5), its middle at (x, z), its top toward −z turned by `yaw` (radians, the box's own sense); runs of lit cells are one decal */
  const glyph = (ch: string, x: number, z: number, h: number, col: Vec3, yaw = 0) => {
    const rows = FONT[ch]; if (!rows) throw new Error(`lookMarks: no glyph '${ch}'`); const px = h / 5, c = Math.cos(yaw), s = Math.sin(yaw), y = lift();
    rows.forEach((bits, r) => { for (let k = 0; k < 3;) { if (!(bits & (4 >> k))) { k++; continue; } let e = k; while (e < 3 && bits & (4 >> e)) e++;
      const lx = ((k + e) / 2 - 1.5) * px, lz = (r - 2) * px; T.flat(x + c * lx + s * lz, z - s * lx + c * lz, (e - k) * px, px, col, yaw, y); k = e; } });
  };
  /** a word of glyphs, centred on (x, z) */
  const word = (text: string, x: number, z: number, h: number, col: Vec3, yaw = 0) => {
    const adv = h * 0.8, c = Math.cos(yaw), s = Math.sin(yaw); [...text].forEach((ch, i) => { const lx = (i - (text.length - 1) / 2) * adv; if (ch !== ' ') glyph(ch, x + c * lx, z - s * lx, h, col, yaw); });
  };
  /** TALLY BARS: n short strokes side by side (a room's number that reads at any size) */
  const tally = (x: number, z: number, count: number, col: Vec3, alongX = true, len = 0.5, w = 0.09, gap = 0.2) => {
    for (let i = 0; i < count; i++) { const o = (i - (count - 1) / 2) * gap; if (alongX) seg(x + o, z - len / 2, x + o, z + len / 2, w, col); else seg(x - len / 2, z + o, x + len / 2, z + o, w, col); }
  };
  return { seg, path, dashed, outline, fill, hazard, checker, glyph, word, tally };
}
export type LookMarks = ReturnType<typeof lookMarks>;
