// MARKING DEFAULTS — the per-KIND signifiers the office's objects carry, as BITMAP GENERATORS (scene/markings.ts is the format: palette-indexed cells on a
// world-space lattice; docs/review/legibility.html grades them at follow height). Every recipe takes the box's half extents (and the odd option) and returns
// MarkingDef[] — cells + a ≤ 3-entry MATERIAL palette — so the level file (levels/office.json, written by tools/level-export.ts from officeGen.ts) carries
// them explicitly and every instance of a kind is marked identically. Procedural kinds paint a CellCanvas through markings.ts GEN (grid, seams, lines,
// dots, window); hand-drawn ones are ASCII art below ('.' transparent, 'a' 'b' 'c' the palette). Sizes count in the 2.5 cm base texel unless a recipe says
// `fine` (carton print, LEDs, clock hands, keypads). Palette entries are materials, never shaded colours: albedo (absolute, or × the box's own), roughness,
// emitted radiance — no gradient, no painted shadow, by construction.
import type { Vec3 } from '../math/vec';
import { MarkingDef, MarkFace, MarkPal, MARKING_TEXEL, CellCanvas, GEN, markFromRect, markFromArt, marking } from './markings';

export const T = MARKING_TEXEL;               // recipes count in it; a level built at another base texel passes its own (tools/level-export.ts --texel)
const F2 = 0.5;                               // fine = half a base texel
type Rect = [number, number, number, number];
const some = (ms: (MarkingDef | null)[]): MarkingDef[] => ms.filter((m): m is MarkingDef => !!m);
/** a 5 cm TAPE band along u across a face 2·hu wide, centred on v = 0: base cells (2 rows) up to 0.8 m, coarse (1 row, half a cell off centre — invisible) beyond */
const tape = (face: MarkFace, hu: number, t: number) => 2 * hu / t <= 32 ? markFromRect(face, 'base', [-hu, -t, hu, t], [P.tape], c => c.fill(1), t) : markFromRect(face, 'coarse', [-hu, 0, hu, 2 * t], [P.tape], c => c.fill(1), t);

// ---- palette accents (linear) + the shared material entries ----
export const MK = {
  tape: [0.36, 0.22, 0.1] as Vec3,            // brown packing tape: the one dark accent on a carton, glossy — a light kraft band read as nothing from 21 m
  ink: [0.16, 0.12, 0.08] as Vec3,             // carton print
  label: [0.86, 0.85, 0.8] as Vec3,            // shipping label / binder spine label / extinguisher label paper
  textGrey: [0.42, 0.42, 0.41] as Vec3,        // text bars on white paper (grey, not black: bars are words at a distance, not rules)
  markerBlue: [0.2, 0.28, 0.5] as Vec3, markerRed: [0.55, 0.16, 0.12] as Vec3, markerGreen: [0.2, 0.4, 0.25] as Vec3,   // whiteboard markers, muted
  keyDeck: [0.035, 0.035, 0.04] as Vec3, keyCap: [0.15, 0.15, 0.16] as Vec3,   // keyboard: near-black deck between caps, caps a plain mid grey (no legends — never letters)
  steel: [0.5, 0.5, 0.48] as Vec3,             // kick / push plates, coin panels
  ledGreen: [0.25, 6.0, 0.7] as Vec3, ledAmber: [6.0, 2.2, 0.2] as Vec3,   // radiance = the rack LEDs' old emissive boxes
  ledGlass: [0.02, 0.05, 0.025] as Vec3,       // what an LED is when it is dark
  screenOff: [0.02, 0.02, 0.025] as Vec3,
};
const P = { tape: { albedo: MK.tape, rough: 0.35 } as MarkPal, ink: { albedo: MK.ink } as MarkPal, label: { albedo: MK.label } as MarkPal, grey: { albedo: MK.textGrey } as MarkPal, steel: { albedo: MK.steel, rough: 0.32 } as MarkPal };

/** KEYBOARD (the headline object): one slab, cap 1 / gap 1 on the base lattice, the bottom row's middle one long bar. h = [0.2, 0.012, 0.07] → 14 × 4 texels at
 *  2.5 cm once the rect is snapped inward: seven caps a row, two rows of them, the lower one carrying the space-bar run. Caps a plain grey a good step lighter
 *  than the near-black deck (contrast reads at 21 m, hue does not), a touch glossier than the deck. */
export function keyboardMarks(h: Vec3, t = T): MarkingDef[] {
  return some([markFromRect('+y', 'base', [-(h[0] - 0.0125), -(h[2] - 0.005), h[0] - 0.0125, h[2] - 0.005], [{ albedo: MK.keyDeck, rough: 0.6 }, { albedo: MK.keyCap, rough: 0.45 }], c => GEN.grid(c, 1, 1, 1, true, 1, 2), t)]);
}
/** MONITOR SCREEN (already reads — kept subtle): two or three emissive UI bars in the upper left of a LIT screen (h = [0.25, 0.15, 0.004], face +z), a hair
 *  brighter and bluer than the screen's own glow [0.9, 1.3, 2.2]; nothing on a dark screen. */
export function monitorMarks(h: Vec3, on: boolean, t = T): MarkingDef[] {
  if (!on) return [];
  return some([markFromRect('+z', 'base', [-(h[0] - 0.03), 0, h[0] * 0.3, h[1] - 0.03], [{ albedo: [0.05, 0.06, 0.08], emit: [1.05, 1.3, 1.5], rough: 0.08 }], c => GEN.lines(c, 1, 1, 3, 1), t)]);
}
// carton print, hand drawn: the this-side-up arrows + fragile glass (11 × 8 fine cells), and a shipping label with three text bars and a 'barcode' (12 × 8 fine)
const ART_UP_FRAGILE = [
  '..a....b...b',
  '.aaa...b...b',
  'a.a.a..bbbbb',
  '..a.....bbb.',
  '..a......b..',
  '..a......b..',
  '..a.....bbb.',
  'aaaaa.......',
];
const ART_LABEL = [
  'aaaaaaaaaaaa',
  'abbbbbbb.a.a',
  'a........a.a',
  'abbbbb...a.a',
  'a........a.a',
  'abbbbbbb.a.a',
  'a...........',
  'aaaaaaaaaaaa',
];
/** CARTON of half size h (a cube, or a squat box): tape across the top along local x and 10 cm down both x faces (base lattice, glossy — the signifier that
 *  works at play distance), the this-side-up + fragile pair printed on +z and a shipping label on −z (both FINE, 1.25 cm cells: carton print wants finer
 *  detail than the tape; at follow height on the lower tiers they settle to a tint, up close / at high they read). Four markings, the per-box cap: the two
 *  side tapes share… no — the cap is four, so the −x tape gives way to the label on the small cartons' far side (see below). */
export function cartonMarks(h: Vec3, t = T): MarkingDef[] {
  const hx = h[0], hy = h[1], hz = h[2]; const down = Math.min(0.1, hy * 0.45);
  const out: (MarkingDef | null)[] = [
    tape('+y', hx, t),                                                                                // tape over the top
    markFromRect('+x', 'base', [-t, hy - down, t, hy], [P.tape], c => c.fill(1), t),                 // …and down the near x face
  ];
  const f = t * F2;
  if (hz >= 0.15 && hy >= 0.12) {   // room for print
    out.push(markFromArt('+z', 'fine', -Math.floor((hx - 0.03) / f), -Math.floor((hy - 0.02) / f), ART_UP_FRAGILE, [P.ink, P.ink]));
    out.push(markFromArt('-z', 'fine', Math.floor((hx - 0.03) / f) - 12, -Math.floor((hy - 0.03) / f), ART_LABEL, [P.label, P.grey]));
  } else {
    out.push(markFromRect('-x', 'base', [-t, hy - down, t, hy], [P.tape], c => c.fill(1), t));    // small carton: tape both sides, one arrow if it fits
    if (hz >= 0.09 && hy >= 0.1) out.push(markFromArt('+z', 'fine', -Math.floor((hx - 0.02) / f), -Math.floor((hy - 0.02) / f), ART_UP_FRAGILE.map(r => r.slice(0, 5)).slice(0, 8), [P.ink, P.ink]));
  }
  return some(out);
}
/** SHELF CARTON (a squat static box on the storage / office shelving, h ≈ [0.57, 0.15, 0.2]; long axis local x along the shelf, the aisle on local ±z):
 *  tape along the top's long seam (what the camera sees from above), the this-side-up + fragile print on both long faces (one faces the wall — cheap). */
export function shelfCartonMarks(h: Vec3, t = T): MarkingDef[] {
  const f = t * F2; const art = h[1] >= 0.12 ? ART_UP_FRAGILE : ART_UP_FRAGILE.map(r => r.slice(0, 5));
  return some([
    tape('+y', h[0], t),
    h[0] >= 0.15 && h[1] >= 0.11 ? markFromArt('+z', 'fine', -Math.floor((h[0] - 0.06) / f), -Math.floor((h[1] - 0.02) / f), art, [P.ink, P.ink]) : null,
    h[0] >= 0.15 && h[1] >= 0.11 ? markFromArt('-z', 'fine', -Math.floor((h[0] - 0.06) / f), -Math.floor((h[1] - 0.02) / f), art, [P.ink, P.ink]) : null,
  ]);
}
/** FILING CABINET body (h = [0.23, 0.66, 0.3], drawers on local −z): three drawer seams a texel dark + a 12.5 cm pull in each drawer's upper third. COARSE
 *  (5 cm cells: 1.3 m of front is 26 rows) — a seam is then 5 cm, chunky and legible from 21 m. Replaces the three NoShadow pull strips. */
export function cabinetMarks(h: Vec3, t = T): MarkingDef[] {
  return some([markFromRect('-z', 'coarse', [-(h[0] - 0.005), -(h[1] - 0.005), h[0] - 0.005, h[1] - 0.005], [{ mul: 0.45 }, { albedo: [0.2, 0.2, 0.21], rough: 0.35 }], c => GEN.seams(c, 3, 1, 3, 1, 1, 2), t)]);
}
/** LOCKER-ish / CUPBOARD front: `cols` doors as vertical seams (coarse), no pulls — a front longer than 32 cells (the break-room counter is 4.4 m) is tiled into
 *  up to four bitmaps with the door boundaries laid out over the WHOLE front */
export function cupboardMarks(h: Vec3, face: MarkFace, cols: number, t = T): MarkingDef[] {
  const hu = (face === '+x' || face === '-x' ? h[2] : h[0]) - 0.005, hv = h[1] - 0.005; const tc = 2 * t;
  const U0 = Math.ceil(-hu / tc - 1e-7), U1 = Math.floor(hu / tc + 1e-7), V0 = Math.ceil(-hv / tc - 1e-7), V1 = Math.floor(hv / tc + 1e-7);
  const W = U1 - U0, H = Math.min(V1 - V0, 32); if (W < 2 || H < 1) return [];
  const seams = new Set<number>(); for (let k = 1; k < cols; k++) seams.add(Math.floor((k * W + Math.floor(cols / 2)) / cols));
  const out: MarkingDef[] = [];
  for (let c0 = 0; c0 < W && out.length < 4; c0 += 32) {
    const w = Math.min(32, W - c0); const cv = new CellCanvas(w, H); let any = false;
    for (let i = 0; i < w; i++) if (seams.has(c0 + i)) { cv.fill(1, i, 0, i + 1, H); any = true; }
    if (any) out.push(marking({ face, res: 'coarse', at: [U0 + c0, V0], size: [w, H], pal: [{ mul: 0.4 }], cells: cv.toRows() }));
  }
  return out;
}
/** BINDER stood on a desk (h = [0.03, 0.16, 0.12]: 6 cm thick, spine on ±z): a white spine label on both ends (whichever faces the aisle). */
export function binderMarks(h: Vec3, t = T): MarkingDef[] {
  return some((['+z', '-z'] as MarkFace[]).map(f => markFromRect(f, 'base', [-h[0], h[1] * 0.15, h[0], h[1] - 0.03], [P.label], c => c.fill(1), t)));
}
/** A RUN OF BOOKS / BINDERS as one block on a shelf (the manager's east shelves, h ≈ [0.11, 0.12, 0.25‥0.33], visible face −x): vertical seams = the individual
 *  spines, a label band across their upper part. */
export function bookRunMarks(h: Vec3, face: MarkFace = '-x', t = T): MarkingDef[] {
  const cols = Math.max(2, Math.round(h[2] * 2 / 0.07));
  return some([markFromRect(face, 'base', [-(h[2] - 0.005), -(h[1] - 0.005), h[2] - 0.005, h[1] - 0.005], [{ mul: 0.45 }, P.label], c => { GEN.seams(c, 1, cols, 0, 0, 1, 1); for (let i = 0; i < c.W; i++) if (c.get(i, 0) !== 1) for (let j = Math.floor(c.H * 0.55); j < Math.floor(c.H * 0.8); j++) c.set(i, j, 2); }, t)]);
}
/** PAPERS on a desk (the two sheets of officeGen papers(): h = [0.11, 0.02, 0.15] / [0.1, 0.012, 0.14], long axis local z): grey text bars a texel tall from the
 *  top with a texel between, ragged, the odd paragraph break; `scribble` = a signature-like zigzag + underline instead (segments a cell wide, sub-pixel at
 *  follow height: for the close camera). */
export function paperMarks(h: Vec3, seed: number, scribble = false, t = T): MarkingDef[] {
  return some([markFromRect('+y', 'base', [-(h[0] - 0.01), -(h[2] - 0.02), h[0] - 0.01, h[2] - 0.02], [P.grey], c => scribble ? GEN.scribble(c, seed, 1) : GEN.lines(c, 1, 1, seed, 1), t)]);
}
/** A SHEET pinned to a board / a note (thin box facing `face`): text bars. */
export function sheetMarks(h: Vec3, face: MarkFace, seed: number, ink: Vec3 = MK.textGrey, t = T): MarkingDef[] {
  const hu = (face === '+x' || face === '-x' ? h[2] : h[0]) - 0.005, hv = h[1] - 0.01;
  return some([markFromRect(face, 'base', [-hu, -hv, hu, hv], [{ albedo: ink }], c => GEN.lines(c, 1, 1, seed, 1), t)]);
}
/** WHITEBOARD (face toward the room): marker writing in two muted colours — a block of blue lines upper left, a shorter red block right, a green scribble
 *  (somebody's diagram) low. Replaces the conference board's three stroke boxes; the sticky notes stay boxes. Bars 1 texel with 2 between (marker lines are sparse). */
export function whiteboardMarks(h: Vec3, face: MarkFace, t = T): MarkingDef[] {
  const hu = h[0], hv = h[1];
  return some([
    markFromRect(face, 'base', [-(hu - 0.15), hv * 0.05, -hu * 0.15, hv - 0.12], [{ albedo: MK.markerBlue }], c => GEN.lines(c, 1, 2, 11, 1), t),
    markFromRect(face, 'base', [hu * 0.2, -hv * 0.35, Math.min(hu - 0.2, hu * 0.2 + 0.78), hv * 0.55], [{ albedo: MK.markerRed }], c => GEN.lines(c, 1, 2, 12, 1), t),
    markFromRect(face, 'base', [-hu * 0.55, -(hv - 0.1), Math.min(hu * 0.1, -hu * 0.55 + 0.78), -hv * 0.15], [{ albedo: MK.markerGreen }], c => GEN.scribble(c, 13, 1), t),
  ]);
}
/** THE RULE for EMISSIVE markings (the maintainer's, 08-10, refined 08-12 at the workbench when the blue machine's albedo-only red wedge read black): a backlit
 *  front is ONE LAMP behind a printed film — every cell transmits it, so every entry MAY emit and cells may differ in chroma (a red wedge on a blue field), but the
 *  DOMINANT hue should carry most of the flux and redistribute LUMINANCE (the dominant hue, its light tint / white, a dark, at most a small accent), because game.ts
 *  registers ONE rectangular light per marking whose colour is the pattern's FLUX-WEIGHTED MEAN chroma (markStats): exact in the far field, a small lie only within a
 *  texel-pitch of a strongly two-toned front. A front that is genuinely half one hue and half another wants two markings (two lights). And FLUX: the light is DERIVED
 *  from the pattern (radiance × area over the rect), so what every visual path draws (the g-buffer + composite at the primary hit, traced reflection hits, the
 *  analytic highlight textured with the pattern ÷ its mean) integrates to exactly what lights the room. */
/** MACHINE 1's backlit front on canvas c (the classic red machine, in spirit): `field` everywhere but the control column's cells `cut` = [i0, j0, i1, j1)
 *  (transparent — the column's own non-emissive bitmap sits there) and a `dark` top cap row + side frame columns; over the Wc columns left of the column ONE
 *  white motif: the diagonal ribbon, three cells wide with a slight S, from the lower left of the upper two-thirds to the top right, and a stack of four white
 *  blocks of varied widths stepping up the open field along its right — the vertical wordmark, suggested, no letters. */
function ribbonField(c: CellCanvas, Wc: number, cut: Rect, field: number, white: number, dark: number) {
  c.fill(field); c.fill(0, cut[0], cut[1], cut[2], cut[3]);
  const W = c.W, H = c.H;
  c.fill(dark, 0, H - 1, W, H); c.fill(dark, 0, 0, 1, H); c.fill(dark, W - 1, 0, W, H - 0);          // top cap, side frame
  for (let j = cut[1]; j < cut[3]; j++) if (c.get(W - 1, j) === dark && cut[2] >= W - 1) c.set(W - 1, j, 0);   // (the frame does not overdraw the column)
  const i0 = 2, i1 = Wc - 2, j0 = Math.floor(H * 0.36), j1 = H - 4;                                  // the ribbon's run
  const rows: number[] = []; const path = (u: number) => { const sC = u * u * (3 - 2 * u); return j0 + (j1 - j0) * (0.65 * u + 0.35 * sC); };
  for (let i = i0; i <= i1; i++) rows.push(Math.round(path((i - i0) / Math.max(i1 - i0, 1))));
  for (let q = 0, n = 4 * (i1 - i0); q <= n; q++) { const u = q / n; const x = i0 + u * (i1 - i0), y = path(u); c.fill(white, Math.round(x - 1), Math.round(y - 1), Math.round(x - 1) + 3, Math.round(y - 1) + 3); }   // a 3 × 3 stamp walked finely along the path: a continuous band however steep
  const widths = [3, 4, 2, 3];
  for (let k = 0; k < 4; k++) {                                                                       // four blocks stacked up the open field right of the ribbon, each two clear of it
    const jb = j0 - 1 + 3 * k; let ir = i0; for (let j = jb - 1; j <= jb + 2; j++) for (let i = 0; i < Wc; i++) if (c.get(i, j) === white && i > ir) ir = i;   // the band's right edge over the block's rows ± a cell
    const ib = ir + 2; const w = Math.min(widths[k], Wc - 1 - ib); if (w < 2) break;
    c.fill(white, ib, jb, ib + w, jb + 2);
  }
}
/** MACHINE 2's backlit front (the blue one, in spirit): `field` but for the column's `cut`, the top row and the left column left transparent (the machine's
 *  near-black body is the cap and frame — this bitmap's third entry is spent on the roundel's red); in the upper third a ROUNDEL D cells across: a white ring
 *  and disc, its upper wedge `red` (emissive too since 08-12: one backlight, per-cell filters — an albedo-only wedge read black at night), a white wave band through the
 *  middle, the lower wedge the field's own blue; under it a vertical band of four white blocks (the wordmark, suggested). */
function globeField(c: CellCanvas, Wc: number, cut: Rect, field: number, white: number, red: number) {
  c.fill(field); c.fill(0, cut[0], cut[1], cut[2], cut[3]);
  const W = c.W, H = c.H;
  c.fill(0, 0, H - 1, W, H); c.fill(0, 0, 0, 1, H); for (let j = 0; j < H; j++) if (j < cut[1] || j >= cut[3]) c.set(W - 1, j, 0);   // cap + frame = the body showing through
  const D = Math.min(9, Wc - 2), R = D / 2; const cx = 1 + (Wc - 1) / 2, cy = H * 0.70;
  for (let j = 0; j < H; j++) for (let i = 1; i < Wc; i++) {
    const dx = i + 0.5 - cx, dy = j + 0.5 - cy; const d = Math.hypot(dx, dy); if (d > R + 0.5) continue;
    if (d > R - 0.75) { c.set(i, j, white); continue; }                                              // the ring
    const wave = Math.round(1.1 * Math.sin((dx / R) * Math.PI * 0.9));                              // the S through the middle
    if (dy > wave + 0.9) c.set(i, j, red); else if (dy > wave - 1.1) c.set(i, j, white); else c.set(i, j, field);
  }
  const widths = [5, 3, 4, 3]; let j = Math.floor(cy - R) - 4;
  for (let k = 0; k < 4 && j >= 2; k++, j -= 3) { const w = widths[k]; const i = Math.round(cx - w / 2); c.fill(white, Math.max(i, 1), j, Math.min(i + w, Wc - 1), j + 2); }
}
/** the CONTROL COLUMN of a vending machine (NON-emissive — it must not glow): a dark navy panel on the base lattice; the bill / coin unit (a dark-grey block near
 *  the top with a black mouth), a column of seven light-grey selection buttons each with a muted label chip to its left, the coin-return notch at the bottom.
 *  rect = [u0, v0, u1, v1] on the face, ≤ 32 base cells tall. */
function controlColumn(face: MarkFace, rect: Rect, t: number): MarkingDef | null {
  return markFromRect(face, 'base', rect, [{ albedo: [0.022, 0.026, 0.05], rough: 0.35 }, { albedo: [0.58, 0.58, 0.6], rough: 0.3 }, { albedo: [0.16, 0.16, 0.18], rough: 0.4 }], c => {
    c.fill(1);
    const W = c.W, H = c.H;
    c.fill(3, 1, H - 7, W - 1, H - 2); c.fill(1, 2, H - 5, W - 2, H - 4);                            // bill / coin unit, its mouth
    const ib = W - 4;
    for (let q = 0; q < 7; q++) { const j = H - 10 - q * 3; if (j < 5) break; c.fill(2, ib, j, ib + 2, j + 1); c.fill(3, 1, j, 3, j + 1); }   // button + label chip
    c.fill(3, 2, 1, W - 2, 4); c.fill(2, 2, 3, W - 2, 4);                                            // coin return: recess with a light lip
  }, t);
}
/** the DISPENSER's back wall (the recessed lower box's front, NON-emissive): black, a dark-grey flap bar across its upper part. */
export function dispenserMarks(h: Vec3, t = T): MarkingDef[] {
  return some([markFromRect('+z', 'coarse', [-(h[0] - 0.05), -(h[1] - 0.025), h[0] - 0.05, h[1] - 0.025], [{ albedo: [0.012, 0.012, 0.014], rough: 0.5 }, { albedo: [0.075, 0.075, 0.085], rough: 0.3 }], c => { c.fill(1); c.fill(2, 1, c.H - 2, c.W - 1, c.H - 1); }, t)]);
}
/** VENDING MACHINE 1 — the RED machine's UPPER body (h = [0.5, 0.775, 0.45], front +z; officeGen stands it on a recessed black plinth = the dispenser opening,
 *  a real recess with its own shadow). ONE emissive marking: the backlit red FIELD over the whole front on the COARSE lattice (18 × 29 with the control column's
 *  4 × 16 cut out and a black cap / frame ≈ 0.96 m² lit — the old glowing slab's area, so at the old slab's luminous intensity about its radiance too) with the
 *  white ribbon + block stack; palette = red (emissive) · white (emissive, 2.2 × the luminance, the same warm cast — ONE chroma, luminance redistributed) · black
 *  accents (not emissive); radiances × k which officeGen calibrates; game.ts registers it as the machine's one light, coloured its mean. Inset right the CONTROL
 *  COLUMN (plain albedo: it does not glow). Two markings; the sides are the red body. */
export function vendingRedMarks(h: Vec3, k: number, t = T): MarkingDef[] {
  const pal: MarkPal[] = [
    { albedo: [0.3, 0.03, 0.025], emit: [1.0 * k, 0.11 * k, 0.075 * k], rough: 0.1 },   // the backlit red field
    { albedo: [0.5, 0.45, 0.42], emit: [0.78 * k, 0.66 * k, 0.6 * k], rough: 0.1 },     // its white: ~2.2 × the field's luminance, the same warm cast
    { albedo: [0.014, 0.012, 0.012], rough: 0.4 },                                       // the black cap / frame (no emission)
  ];
  return some([
    markFromRect('+z', 'coarse', [-0.45, -0.7, 0.45, 0.75], pal, c => ribbonField(c, 14, [14, 7, 18, 23], 1, 2, 3), t),   // 18 × 29; the column's cells (u 0.25‥0.45, v −0.35‥0.45) transparent
    controlColumn('+z', [0.25, -0.35, 0.45, 0.45], t),
  ]);
}
/** VENDING MACHINE 2 — the BLUE machine's UPPER body (h = [0.42, 0.775, 0.45] near-black navy, front +z, on the same kind of plinth): its emissive FIELD (coarse,
 *  16 × 29 less the column's 4 × 16, the top row and the left column left to the dark body ≈ 0.8 m² lit) = deep blue with the ROUNDEL (white ring / band, a
 *  red upper wedge through a red filter, the field's blue below) and four white blocks under it — ONE BACKLIGHT: blue, white and red all emit, the registered
 *  light takes the flux-weighted mean chroma; calibrated to the old blue slab's
 *  luminous intensity, one light. The control column inset right (officeGen's little keypad block stands on it), a plain brand band down the room-side (+x)
 *  face. Three markings. */
export function vendingBlueMarks(h: Vec3, k: number, t = T): MarkingDef[] {
  const pal: MarkPal[] = [
    { albedo: [0.03, 0.06, 0.3], emit: [0.1 * k, 0.26 * k, 1.0 * k], rough: 0.1 },      // the deep blue field
    { albedo: [0.4, 0.44, 0.5], emit: [0.62 * k, 0.72 * k, 0.95 * k], rough: 0.1 },     // its white (a cool cast: ~2.3 × the field's luminance)
    { albedo: [0.42, 0.04, 0.035], emit: [0.9 * k, 0.075 * k, 0.06 * k], rough: 0.1 },   // the roundel's red wedge: the SAME backlight through a red filter (≈ the field's luminance) — every cell of a backlit front transmits the one lamp; the registered light's colour is the flux-weighted mean of what comes through (game.ts markStats), which a small red wedge on a blue field barely moves
  ];
  return some([
    markFromRect('+z', 'coarse', [-0.4, -0.7, 0.4, 0.75], pal, c => globeField(c, 12, [12, 7, 16, 23], 1, 2, 3), t),   // 16 × 29; the column's cells (u 0.2‥0.4, v −0.35‥0.45) transparent
    controlColumn('+z', [0.2, -0.35, 0.4, 0.45], t),
    markFromRect('+x', 'base', [-0.425, 0.05, 0.425, 0.35], [{ albedo: [0.1, 0.16, 0.5] }], c => c.fill(1), t),
  ]);
}
/** KEYPAD block (the snack machine's, h = [0.05, 0.075, 0.015], face +z): 3 × 4 keys on the fine lattice, light keys on the dark plate. */
export function keypadMarks(h: Vec3, face: MarkFace = '+z', t = T): MarkingDef[] {
  return some([markFromRect(face, 'fine', [-(h[0] - 0.005), -(h[1] - 0.005), h[0] - 0.005, h[1] - 0.005], [{ albedo: [0.05, 0.05, 0.055] }, { albedo: [0.6, 0.6, 0.58], rough: 0.4 }], c => GEN.grid(c, 1, 1, 1, false, 1, 2), t)]);
}
/** EXTINGUISHER cylinder (h = [0.07, 0.24, 0.06] red, hung on a wall, front `face`): the label band (white paper) with lines of instructions in dark red. */
export function extinguisherMarks(h: Vec3, face: MarkFace, t = T): MarkingDef[] {
  return some([markFromRect(face, 'base', [-(h[0] - 0.005), -0.05, h[0] - 0.005, 0.1], [P.label, { albedo: [0.35, 0.1, 0.08] }], c => { c.fill(1); GEN.lines(c, 1, 1, 2, 2); }, t)]);
}
/** the clean-agent CYLINDER in the server room (h = [0.13, 0.62, 0.13] red, front +z): a taller label band + lines */
export function agentCylinderMarks(h: Vec3, t = T): MarkingDef[] {
  return some([markFromRect('+z', 'base', [-0.1, 0.05, 0.1, 0.35], [P.label, { albedo: [0.35, 0.1, 0.08] }], c => { c.fill(1); GEN.lines(c, 1, 1, 4, 2); }, t)]);
}
/** EXTINGUISHER CABINET (the red box on the corridor's south wall, h = [0.15, 0.3, 0.06], front −z): a white pictogram square (hollow) and the dark handle slot. */
export function extinguisherBoxMarks(h: Vec3, face: MarkFace, t = T): MarkingDef[] {
  return some([markFromRect(face, 'base', [-0.1, -0.25, 0.1, 0.2], [P.label, { albedo: [0.25, 0.04, 0.03] }], c => { GEN.glyph(c, 4, 1, c.H - 8, 1, 1); c.fill(2, 1, 0, c.W - 1, 2); }, t)]);
}
/** SERVER RACK body (h = [0.33, 1.05, 0.5] near-black satin, front +z): the perforated door as a vent grid over the lower part (2-texel holes, 1-texel webs — barely
 *  lighter than the steel: texture of the METAL, read in the reflection more than head-on), and the LED rows (fine dots, emissive at the old nubs' radiance) where
 *  the raster-only nubs sat: `slots` = populated 4U slots (v of the LED row from the box centre, ≤ 3 fit one 32-row fine bitmap … so the LEDs go in up to
 *  three fine bitmaps of ≤ 32 rows each covering the LED column; amber = the third LED of that slot is the amber fault light). */
export function rackMarks(h: Vec3, slots: { v: number; amber: boolean }[], t = T): MarkingDef[] {
  const out: (MarkingDef | null)[] = [markFromRect('+z', 'base', [-0.15, -(h[1] - 0.15), h[0] - 0.055, h[1] * 0.35], [{ albedo: [0.05, 0.05, 0.058], rough: 0.45 }, { albedo: [0.07, 0.07, 0.08], rough: 0.4 }], c => GEN.grid(c, 2, 2, 1, false, 1, 2), t)];
  if (!slots.length) return some(out);
  // the LED column: fine cells from the lowest to the highest populated slot, split into ≤ 3 bitmaps of ≤ 32 rows; each slot = 3 dots at pitch 2 on its row
  const f = t * F2; const rows = slots.map(s => ({ j: Math.round(s.v / f), amber: s.amber })).sort((a, b) => a.j - b.j);
  const u0 = Math.round(-0.25 / f);   // the LED column's left cell (x −0.25 from the rack centre, as the old boxes)
  let k = 0;
  while (k < rows.length && out.length < 4) {
    const j0 = rows[k].j; let k1 = k; while (k1 + 1 < rows.length && rows[k1 + 1].j - j0 < 32) k1++;
    const H = rows[k1].j - j0 + 1; const c = new CellCanvas(6, H);
    for (let q = k; q <= k1; q++) { const jj = rows[q].j - j0; c.set(0, jj, 1); c.set(2, jj, 1); c.set(4, jj, rows[q].amber ? 2 : 1); }
    out.push(marking({ face: '+z', res: 'fine', at: [u0, j0], size: [6, H], pal: [{ albedo: MK.ledGlass, emit: MK.ledGreen, rough: 0.2 }, { albedo: MK.ledGlass, emit: MK.ledAmber, rough: 0.2 }], cells: c.toRows() }));
    k = k1 + 1;
  }
  return some(out);
}
/** DOOR LEAF (doors.ts: h = [w/2 − 0.01, height/2, thick/2], big faces ±z): a stainless kick plate along the bottom of both faces and a push plate at hand height by
 *  the latch edge on the +z face. Steel fire doors get neither (they are the plate). */
export function doorLeafMarks(h: Vec3, t = T): MarkingDef[] {
  const yb = -(h[1] - 0.02);
  return some([
    markFromRect('+z', 'coarse', [-(h[0] - 0.04), yb, h[0] - 0.04, yb + 0.2], [P.steel], c => c.fill(1), t),
    markFromRect('-z', 'coarse', [-(h[0] - 0.04), yb, h[0] - 0.04, yb + 0.2], [P.steel], c => c.fill(1), t),
    markFromRect('+z', 'base', [h[0] - 0.22, -0.075, h[0] - 0.1, 0.225], [P.steel], c => c.fill(1), t),
  ]);
}
/** WALL CLOCK rim box (h = [0.16, 0.16, 0.02], front `face`): the light face and two hands on the fine lattice — hour along ±u, minute down (half past). One bitmap. */
export function clockMarks(face: MarkFace, minuteUp = false, t = T): MarkingDef[] {
  return some([markFromRect(face, 'fine', [-0.125, -0.125, 0.125, 0.125], [{ albedo: [0.88, 0.88, 0.85] }, { albedo: [0.04, 0.04, 0.045] }], c => {
    c.fill(1); const cx = Math.floor(c.W / 2), cy = Math.floor(c.H / 2);
    c.fill(2, cx, cy, cx + 7, cy + 1);                                                                  // hour hand along +u
    if (minuteUp) c.fill(2, cx, cy, cx + 1, cy + 9); else c.fill(2, cx, cy - 8, cx + 1, cy + 1);      // minute hand
  }, t)]);
}
/** the LOBBY SIGN PANEL (h = [0.9, 0.4, 0.025] dark blue, front +z): the company mark — an orange square with its centre punched out — and two lines of 'name'. */
export function lobbySignMarks(t = T): MarkingDef[] {
  return some([
    markFromRect('+z', 'base', [-0.725, -0.15, -0.375, 0.2], [{ albedo: [0.85, 0.42, 0.12] }], c => { c.fill(1); c.fill(0, 4, 4, c.W - 4, c.H - 4); }, t),
    markFromRect('+z', 'base', [-0.175, -0.125, 0.75, 0.175], [{ albedo: [0.8, 0.8, 0.78] }, { albedo: [0.6, 0.62, 0.66] }], c => { c.fill(1, 0, c.H - 4, c.W, c.H); c.fill(2, 0, 1, Math.floor(c.W * 0.72), 3); }, t),
  ]);
}
/** WAYFINDING PLACARD (h = [0.5, 0.13, 0.01], both faces): a white bar and an orange square, mirrored on the back. */
export function placardMarks(t = T): MarkingDef[] {
  const paint = (c: CellCanvas) => { c.fill(1, 0, 3, Math.floor(c.W * 0.72), 6); c.fill(2, c.W - 6, 1, c.W - 1, 6); };
  const paintM = (c: CellCanvas) => { c.fill(1, c.W - Math.floor(c.W * 0.72), 3, c.W, 6); c.fill(2, 1, 1, 6, 6); };
  return some([
    markFromRect('+z', 'base', [-0.45, -0.1, 0.45, 0.1], [{ albedo: [0.8, 0.8, 0.78] }, { albedo: [0.85, 0.42, 0.12] }], paint, t),
    markFromRect('-z', 'base', [-0.45, -0.1, 0.45, 0.1], [{ albedo: [0.8, 0.8, 0.78] }, { albedo: [0.85, 0.42, 0.12] }], paintM, t),
  ]);
}
/** a plain filled RECT of one material on a face (demoted screens, plates, bands, sink insets, dark sheets…): rect in metres from the face centre */
export function plateMark(face: MarkFace, rect: Rect, pal: MarkPal, res: 'fine' | 'base' | 'coarse' = 'base', t = T): MarkingDef[] {
  return some([markFromRect(face, res, rect, [pal], c => c.fill(1), t)]);
}
/** a single LED / a short row of them (fine): u, v = the FIRST dot's centre from the face centre, count at pitch cells */
export function ledMarks(face: MarkFace, u: number, v: number, radiance: Vec3, count = 1, pitch = 2, t = T): MarkingDef[] {
  const f = t * F2; const i0 = Math.round(u / f - 0.5), j0 = Math.round(v / f - 0.5); const W = (count - 1) * pitch + 1;
  const c = new CellCanvas(W, 1); for (let k = 0; k < count; k++) c.set(k * pitch, 0, 1);
  return [marking({ face, res: 'fine', at: [i0, j0], size: [W, 1], pal: [{ albedo: MK.ledGlass, emit: radiance, rough: 0.2 }], cells: c.toRows() })];
}
/** an emissive display strip as digit-like bars (the microwave clock): rect + radiance */
export function displayMarks(face: MarkFace, rect: Rect, radiance: Vec3, t = T): MarkingDef[] {
  return some([markFromRect(face, 'fine', rect, [{ albedo: [0.02, 0.03, 0.02], emit: radiance, rough: 0.2 }], c => { for (let i = 0; i < c.W; i++) if (i % 3 !== 2) c.fill(1, i, 1, i + 1, c.H - 1); }, t)]);
}
/** the pallet stack's DECK BOARDS (block h = [0.58, 0.29, 0.5], five 10 cm boards along z at 26 cm pitch on the top): one coarse bitmap (5 cm cells) */
export function palletDeckMarks(h: Vec3, t = T): MarkingDef[] {
  return some([markFromRect('+y', 'coarse', [-h[0], -h[2], h[0], h[2]], [{ albedo: [0.5, 0.39, 0.25] }], c => { for (let b = 0; b < 5; b++) { const i0 = Math.round((0.06 + b * 0.26) / (2 * t)) - 1; c.fill(1, i0, 0, i0 + 2, c.H); } }, t)]);
}
/** FIRST-AID box front: the green cross */
export function firstAidMarks(face: MarkFace, t = T): MarkingDef[] {
  return some([markFromRect(face, 'fine', [-0.05, -0.05, 0.05, 0.05], [{ albedo: [0.1, 0.45, 0.2] }], c => GEN.glyph(c, 3, Math.floor((c.W - 5) / 2), Math.floor((c.H - 7) / 2), 1, 1), t)]);
}
/** an HVAC diffuser's face (block h, its −y face; game/wind.ts vents): the egg-crate louvre as one coarse bitmap — a 4 × 4 field of dark openings (entry 1) parted
 *  by one-cell blades of the frame's own pale metal (entry 2), inside the 3 cm rim the rect leaves of the box's face */
export function ventGrilleMarks(h: Vec3, t = T): MarkingDef[] {
  return some([markFromRect('-y', 'coarse', [-(h[0] - 0.03), -(h[2] - 0.03), h[0] - 0.03, h[2] - 0.03], [{ albedo: [0.04, 0.04, 0.045] }, { albedo: [0.66, 0.67, 0.66], rough: 0.4 }], c => { c.fill(1); GEN.seams(c, 4, 4, 0, 0, 2, 2); }, t)]);
}
