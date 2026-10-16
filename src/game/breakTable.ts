// THE BREAK TABLE: one row per material says what a thing made of it does when it breaks, at every size — the big pieces (rigid chunks in the debris pool,
// shaped as CUT BOXES: scene/cut.ts), the small debris (GPU chips), the fines (dust particles, a solver puff) — and what the stuff still standing shows at
// its broken end. Walls and cover (game/wallbreak.ts), whatever the destruction lane knocks loose (game/destruction.ts → the pool, game/debris.ts) and the pool's
// own overflow all read the SAME row, so a plasterboard partition sheds slabs with broken outlines, a crate snaps into boards and splinter strips, a fabric panel
// tears on one long diagonal, and each of them crumbles into chips of its own colour when the pool needs its slot.
//
// THE RULES (rebuild/cut-pieces/control-scales.md §5 is the sheet this was built from):
//   · no hit points: a piece carries a generation (0 or 1) and nothing else. It breaks ONCE more only when one single event is strong enough — a landing faster
//     than its row's speed, or an impulse kick above its row's kick. Two weak events never add up;
//   · deterministic: every plane, count and size comes off this module's own hash counter (or the piece's serial counted from the pool's last clear — rel() below, off Debris.serial0 — so a
//     restarted or loaded encounter breaks as a fresh game does), never Math.random;
//   · the budget is the pool's: nothing here spawns outside Debris.spawnRaw, a refused piece becomes chips, an evicted one crumbles where it lay, and while more
//     than half the pool is moving nothing breaks a second time — it goes straight to particles (the mayhem rule);
//   · feet meet the uncut box, eyes and rounds the cut one (the cut contract) — so what STANDS is only ever bitten ≤ `bite` at an open end.
//
// THE SWITCH: every entry point returns on its first line unless cutBoxesOn() (scene/cut.ts: ?cutboxes) — off, the pool, the walls and the digests are the base
// build's, statement for statement. Nothing at module level uses another game module (the import cycle: tables are literals, the rest runs inside functions).
import { Vec3, v3, quat } from '../math/vec';
import { Box, makeBox, MKEY } from '../scene/boxes';
import { CutPlane, MAX_CUT_PLANES, cutBoxesOn, cutPrism, cutRecord, cutFit, cutThrough, cutToWorld, cutVerts } from '../scene/cut';
import type { Game } from './game';
import type { Chunk, ChunkKind, Debris } from './debris';
import { hash01, supportAlong } from './debris';
import { gpuFx, surfOf, emitDust, PFX, type Surf } from './particleFx';
import { NOBODY_ID } from './consts';
import { messEvicted } from './floormess';
import { EVICT } from './destructionSwitch';   // (the eviction pop's fix: a leaf module, no imports of its own)

export type Mat = 'plasterboard' | 'masonry' | 'blockwork' | 'wood' | 'metal' | 'glass' | 'glassTough' | 'glassLam' | 'screen' | 'fabric' | 'paper' | 'cardboard' | 'tile' | 'plastic' | 'carpet' | 'plant';
/** the piece shapes (§5.3): each is ONE box with a cut record. 'panel' = the uncut box */
export type Shape = 'slab' | 'wedge' | 'snapped' | 'strip' | 'lump' | 'panel';
/** how a piece breaks a second time: across its length (two slabs), along it (two strips), on its diagonal (two wedges) */
export type Split = 'across' | 'along' | 'diag';

export interface BreakRow {
  /** the stuff inside (what a broken edge shows); null = its own paint, lightened by `pale` */
  core: Vec3 | null; pale?: number;
  /** BIG, level A — what one broken half-metre cell throws at the full pool: its shapes in order, the pieces' half thickness (m), the long side's range (m), the
   *  short side as a share of the long, and how many corners / edges a slab loses */
  cell: Shape[]; thick: number; span: [number, number]; slim: [number, number]; tears: [number, number];
  /** what still stands: the open end's planes, degrees off square, and how deep they may bite (m); `grain` = the plane runs with the piece's long side. null = square */
  ragged: { deg: [number, number]; bite: number; grain?: boolean } | null;
  /** BIG, level B — one strong event (landing speed ≥ land m/s, or an impulse kick ≥ kick m/s; Infinity = never by that) breaks it once more: how, the chips it
   *  adds, and the share of pieces (by hash) that do. null = never */
  again: { land: number; kick: number; how: Split; chips: number; chance?: number } | null;
  /** SMALL — chips per broken cell: how many, their size range (m), their aspect range */
  small: { n: number; size: [number, number]; aspect: [number, number] };
  /** FINES — dust particles per cell, sparks per cell, the solver puff's scale per cell (0 = none) */
  dust: number; sparks: number; puff: number;
  /** the share of its landing speed a piece comes back with; the hearing level of its landing (0 = its kind's) */
  rest: number; level: number;
  /** MARK — the pale chip a piece knocks out of the floor where it breaks again (radius, m; 0 = none: the round's own marks, the blast's scorch and the walls'
   *  wear are other modules' — game/marks.ts, the wall look) */
  mark: number;
}
const NEVER = Infinity;
/** THE TABLE. Rows whose pieces another module makes (glass → game/shards.ts, paper → the sheet particles) are here so every material has ONE row to read:
 *  their big-piece columns are empty on purpose. */
export const BREAK: Record<Mat, BreakRow> = {
  plasterboard: { core: [0.92, 0.91, 0.88], cell: ['slab', 'wedge'], thick: 0.015, span: [0.15, 0.7], slim: [0.35, 0.8], tears: [2, 3], ragged: { deg: [8, 25], bite: 0.12 },
                  again: { land: 6.5, kick: 0.7, how: 'across', chips: 4 }, small: { n: 18, size: [0.01, 0.035], aspect: [1, 1.6] }, dust: 6, sparks: 0, puff: 1.4, rest: 0.1, level: 0, mark: 0.03 },
  masonry:      { core: [0.6, 0.59, 0.57], cell: [], thick: 0.03, span: [0.1, 0.2], slim: [0.6, 1], tears: [2, 3], ragged: null,
                  again: null, small: { n: 16, size: [0.008, 0.02], aspect: [1, 1] }, dust: 5, sparks: 5, puff: 1, rest: 0.1, level: 0, mark: 0.02 },
  // (an OUTER wall a breaching charge has opened — wallbreak.ts adopt, the one caller that names this row: no Surf maps to it, so nothing else in the level reads it)
  blockwork:    { core: [0.6, 0.59, 0.57], cell: ['lump', 'slab'], thick: 0.05, span: [0.16, 0.4], slim: [0.55, 0.95], tears: [2, 3], ragged: null,
                  again: null, small: { n: 20, size: [0.01, 0.035], aspect: [1, 1.4] }, dust: 8, sparks: 3, puff: 1.8, rest: 0.08, level: 0, mark: 0.03 },
  wood:         { core: [0.78, 0.63, 0.42], cell: ['snapped', 'strip'], thick: 0.011, span: [0.3, 0.6], slim: [0.16, 0.33], tears: [1, 2], ragged: { deg: [8, 25], bite: 0.12, grain: true },
                  again: { land: NEVER, kick: 0.85, how: 'along', chips: 4 }, small: { n: 18, size: [0.006, 0.014], aspect: [3, 6] }, dust: 3, sparks: 0, puff: 0, rest: 0.25, level: 0, mark: 0.014 },
  metal:        { core: null, cell: ['panel'], thick: 0.004, span: [0.3, 0.48], slim: [0.6, 1], tears: [0, 0], ragged: null,
                  again: null, small: { n: 2, size: [0.006, 0.012], aspect: [1, 2] }, dust: 0, sparks: 16, puff: 0, rest: 0.35, level: 0.5, mark: 0 },
  glass:        { core: null, cell: [], thick: 0.003, span: [0.1, 0.3], slim: [0.4, 1], tears: [0, 0], ragged: null, again: null, small: { n: 0, size: [0.01, 0.04], aspect: [1, 2] }, dust: 0, sparks: 0, puff: 0, rest: 0.22, level: 0, mark: 0 },
  glassTough:   { core: null, cell: [], thick: 0.003, span: [0.1, 0.3], slim: [0.4, 1], tears: [0, 0], ragged: null, again: null, small: { n: 0, size: [0.005, 0.01], aspect: [1, 1] }, dust: 0, sparks: 0, puff: 0, rest: 0.22, level: 0, mark: 0 },
  glassLam:     { core: null, cell: [], thick: 0.003, span: [0.1, 0.3], slim: [0.4, 1], tears: [0, 0], ragged: null, again: null, small: { n: 0, size: [0.005, 0.01], aspect: [1, 1] }, dust: 0, sparks: 0, puff: 0, rest: 0.22, level: 0, mark: 0 },
  screen:       { core: [0.09, 0.09, 0.1], cell: ['wedge', 'wedge'], thick: 0.02, span: [0.15, 0.3], slim: [0.5, 0.9], tears: [1, 2], ragged: null,
                  again: { land: 5, kick: NEVER, how: 'diag', chips: 5 }, small: { n: 14, size: [0.006, 0.014], aspect: [1, 2] }, dust: 0, sparks: 6, puff: 0, rest: 0.22, level: 0, mark: 0 },
  fabric:       { core: null, pale: 0.35, cell: ['wedge', 'wedge'], thick: 0.012, span: [0.3, 0.5], slim: [0.6, 1], tears: [1, 1], ragged: { deg: [8, 15], bite: 0.08 },
                  again: null, small: { n: 5, size: [0.01, 0.02], aspect: [1, 1] }, dust: 3, sparks: 0, puff: 0, rest: 0.1, level: 0, mark: 0 },
  paper:        { core: null, cell: [], thick: 0.001, span: [0.2, 0.3], slim: [0.7, 0.7], tears: [0, 0], ragged: null, again: null, small: { n: 0, size: [0.01, 0.02], aspect: [1, 1] }, dust: 0, sparks: 0, puff: 0, rest: 0.1, level: 0, mark: 0 },
  cardboard:    { core: [0.66, 0.54, 0.38], cell: ['slab', 'slab'], thick: 0.015, span: [0.2, 0.4], slim: [0.55, 1], tears: [1, 1], ragged: { deg: [8, 15], bite: 0.12 },
                  again: null, small: { n: 8, size: [0.008, 0.02], aspect: [1, 2] }, dust: 3, sparks: 0, puff: 0, rest: 0.1, level: 0, mark: 0 },
  tile:         { core: [0.9, 0.89, 0.86], cell: [], thick: 0.0075, span: [0.3, 0.58], slim: [0.6, 1], tears: [1, 2], ragged: null,
                  again: { land: 5, kick: NEVER, how: 'across', chips: 6 }, small: { n: 6, size: [0.009, 0.022], aspect: [1, 1.6] }, dust: 4, sparks: 0, puff: 1, rest: 0.1, level: 0, mark: 0.03 },
  plastic:      { core: null, pale: 0.25, cell: ['wedge', 'wedge'], thick: 0.01, span: [0.08, 0.2], slim: [0.5, 1], tears: [1, 2], ragged: null,
                  again: { land: 5, kick: NEVER, how: 'diag', chips: 8 }, small: { n: 8, size: [0.006, 0.014], aspect: [1, 2] }, dust: 0, sparks: 0, puff: 0, rest: 0.22, level: 0, mark: 0 },
  carpet:       { core: null, cell: [], thick: 0.005, span: [0.1, 0.2], slim: [0.6, 1], tears: [0, 0], ragged: null, again: null, small: { n: 4, size: [0.008, 0.016], aspect: [1, 3] }, dust: 4, sparks: 0, puff: 0, rest: 0.1, level: 0, mark: 0 },
  plant:        { core: [0.62, 0.36, 0.24], cell: ['wedge', 'wedge'], thick: 0.02, span: [0.1, 0.25], slim: [0.6, 1], tears: [1, 2], ragged: null,
                  again: { land: NEVER, kick: 0.85, how: 'diag', chips: 6 }, small: { n: 16, size: [0.008, 0.018], aspect: [1, 2.5] }, dust: 2, sparks: 0, puff: 0, rest: 0.1, level: 0, mark: 0.02 },
};
/** the knobs that are not a material's: the rigid pool's shares for ONE blast by pool size (thrown wall / cover pieces, heap slabs dealt at rest at the wall foot,
 *  furniture pieces), the chips a cell throws instead when the small pool cuts its slabs, what a refused / evicted piece leaves, the china rule */
export const BREAKS = {
  share: { big: { thrown: 5, heap: 5, furniture: 8 }, small: { thrown: 4, heap: 1, furniture: 4 } },
  smallPoolChipK: 20 / 14,
  refuseChips: [6, 8] as [number, number], crumbleChips: [4, 6] as [number, number],
  /** THE EVICTION POP's two answers (both ride the cut switch; off = the pool's oldest piece gone into `crumbleChips` in a ball, as it was): the slot a spawn over
   *  the cap takes is the SMALLEST resting piece's (its longest half extent; ties the oldest) — a mug's worth goes before a door-sized plank; and what an evicted
   *  piece leaves is sized to it: `sizedChips` from a piece of `sizedSpan`[0] m (longest half extent) up to one of [1], born ALONG the box, its row's dust once */
  sizedChips: [4, 14] as [number, number], sizedSpan: [0.05, 0.5] as [number, number],
  /** a small thing of the plastic row (a mug: nothing over 6 cm) landing this fast is gone into its particles */
  chinaLand: 3.5, chinaMax: 0.06,
  /** how far a thrown piece's paint is taken toward its core colour (the renderer draws a cut face in the box's own colour: until a cut face has its own, the whole
   *  piece is tinted), and its chips */
  coreTint: 0.3, chipTint: 0.5,
  /** the heap: slab size range (m), how far out from the wall foot it is dealt (m), each slab's tip off flat (rad) so overlapping slabs do not lie in one plane */
  heap: { span: [0.15, 0.55] as [number, number], out: [0, 0.7] as [number, number], tip: [0.07, 0.24] as [number, number] },
  /** what stands keeps to the planes it needs */
  maxStandingPlanes: 4,
  /** a ragged end's turn ACROSS the piece (through a wall's thickness): steep, because from above that is the side of the end that is seen */
  acrossDeg: [35, 55] as [number, number],
  /** beside a system that dresses a blown wall for the picture (`Breaks.look`): its edge plates are the wall's ragged ends, its rubble is the heap at the hole's foot.
   *  False = this table's own under them as well (two sets: only for an A/B) */
  lookEdges: true, lookHeap: true,
  /** a loose fragment under this longest half-extent keeps its plain box (at the game's camera a 12 cm flake is a few pixels: an outline there is cut records for nothing) */
  looseMin: 0.08,
  /** the KINKED metal panel (the one "bent" a cut box can draw: two halves of one plate meeting on a fold): the angle between the halves (deg), how far the fold
   *  may turn off square (deg) and sit off the middle (share of the half length), the shortest plate that kinks (half length, m), and the gap between two (s: one a blast) */
  kink: { deg: [25, 42] as [number, number], skew: 20, off: 0.4, minLong: 0.2, gapSecs: 0.5 },
  /** ABOVE HEAD HEIGHT (m over the wall's foot) a standing wall's open end is torn back: `planes` planes an end on top of the piece's own, the notch `deep` m
   *  at the wall's top (never more than `mostOfWidth` of the piece), each plane turned `across` degrees over the wall's thickness; only where at least
   *  `minRoom` m of wall stands above head height. Nothing below it changes: what a body can walk into is the piece as it was. OFF (`on`): judged in stills it
   *  read as a designed bevel, not a tear, so standing wall ends ship clean; the knob keeps it for a next try. */
  head: { on: false, from: 1.9, deep: [0.2, 0.3] as [number, number], planes: 2, across: [14, 32] as [number, number], minRoom: 0.3, mostOfWidth: 0.45 },
  /** FURNITURE'S STEEL (furnblast.ts hands a cabinet over as what it is — sheet steel on a frame — not as the block its paint reads as): the sheet's half thickness
   *  (m); the shallow fold every torn-off sheet carries (deg between its halves); a carcass that goes over whole is DENTED along `dents` of its edges, each a
   *  crease `dent` m deep at one end running out toward the other, never deeper than `dentMost` of the side it bites; and stands OPEN where its door was: that face's
   *  frame `rim` m wide stands `lip` m back from the dark panel it holds (the paint × `inside`) */
  steel: { sheet: 0.008, kink: [9, 24] as [number, number], dents: [3, 5] as [number, number], dent: [0.025, 0.06] as [number, number], dentMost: 0.14, rim: 0.035, lip: 0.004, inside: 0.16 },
  /** the uprights a plasterboard partition keeps where fire has opened a run of it above a standing sill (one static stand-in each): half width along the wall
   *  (m), its depth as a share of the wall's, its metal */
  stud: { half: 0.02, depthK: 0.7, foot: 0.13, albedo: [0.56, 0.57, 0.6] as Vec3, rough: 0.35, metal: true },
};
export const BREAK_STATS = { shaped: 0, plain: 0, refused: 0, again: 0, mayhem: 0, china: 0, crumbled: 0, heap: 0, ragged: 0, planes: 0, dropped: 0, chips: 0, dressed: 0, kinked: 0, loose: 0, sheets: 0, carcasses: 0, notched: 0 };

const SURF_MAT: Record<Surf, Mat> = { metal: 'metal', plastic: 'plastic', glass: 'screen', wood: 'wood', cardboard: 'cardboard', drywall: 'plasterboard', concrete: 'masonry', carpet: 'carpet', fabric: 'fabric', foliage: 'plant' };
export const matOfSurf = (s: Surf): Mat => SURF_MAT[s];
/** the row a pool chunk reads: by what the destruction lane already knows the thing is (a tile, a housing, clutter), else by its paint */
export function matOf(kind: ChunkKind, albedo: Vec3): Mat {
  if (kind === 'shard') return 'glass';
  if (kind === 'tile') return 'tile';
  if (kind === 'housing') return 'screen';
  if (kind === 'binder') return 'plastic';
  const s = surfOf(albedo);
  if (kind === 'clutter') return s === 'foliage' ? 'plant' : 'plastic';   // (desk clutter is painted 'black', which the paint table reads as metal: it is plastic and china)
  return SURF_MAT[s];
}
/** what a piece carries (Chunk.mat): its row, its generation (0 = as it left the thing, 1 = broke once: never again), its paint before the core tint, `fixed` = never
 *  breaks whatever happens (a binder, a cushion) */
export interface BreakMeta { mat: Mat; gen: 0 | 1; paint: Vec3; fixed?: boolean }
export const coreOf = (row: BreakRow, paint: Vec3): Vec3 => row.core ?? v3.lerp(paint, [1, 1, 1], row.pale ?? 0);
/** the colour a piece's CUT faces show (Box.cutCore: the inside of the material — gypsum under paint, raw wood under a finish); undefined = the box's own colour
 *  (metal and glass are the same stuff all the way through) */
export const faceCore = (row: BreakRow, paint: Vec3): Vec3 | undefined => row.core ? v3.copy(row.core) : row.pale ? v3.lerp(paint, [1, 1, 1], row.pale) : undefined;

const lerp = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;
const RAD = Math.PI / 180;
type P2 = [number, number];

// ---------------------------------------------------------------- the shapes (pure: an outline in (l, s) = along the long side, across it; r = a 0‥1 hash stream)
/** SLAB: the rectangle ±L × ±S with `tears` of its corners taken off at 15‥60° (3 to 7 sides) */
export function slabOutline(L: number, S: number, tears: number, r: () => number): P2[] {
  const corner: P2[] = [[-L, -S], [L, -S], [L, S], [-L, S]];
  const pick = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pick[i]; pick[i] = pick[j]; pick[j] = t; }
  const nT = Math.max(0, Math.min(4, tears)); const off = new Set(pick.slice(0, nT)); const big = nT ? pick[0] : -1;
  // how far along each of a corner's two edges its break starts (a along the long edge, b along the short): the cut 15‥60° off the long edge. ONE tear is the long
  // one — 50‥85 % of its long edge, up to 80 % of the short — so a slab is a broken shape, not a rectangle with its corners clipped; the others stay ≤ 45 % of an
  // edge and give way to it where they share an edge (≥ a fifth of what the long tear left, or the corner stays square)
  const A = [0, 0, 0, 0], Bv = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    if (!off.has(k)) continue;
    const ang = (15 + 45 * r()) * RAD; const long = k === big; let a = (long ? 0.5 + 0.35 * r() : 0.18 + 0.27 * r()) * 2 * L, b = a * Math.tan(ang); const cap = (long ? 1.6 : 0.9) * S;
    if (b > cap) { b = cap; if (!long) a = Math.max(0.12 * 2 * L, Math.min(0.9 * L, b / Math.tan(ang))); }
    A[k] = a; Bv[k] = b;
  }
  if (big >= 0) { const kl = big ^ 1, ks = 3 - big;   // the corner at the other end of its long edge, and of its short edge
    if (off.has(kl)) { const most = (2 * L - A[big]) * 0.8; if (most < 0.06 * 2 * L) off.delete(kl); else if (A[kl] > most) { Bv[kl] *= most / A[kl]; A[kl] = most; } }
    if (off.has(ks)) { const most = (2 * S - Bv[big]) * 0.8; if (most < 0.06 * 2 * S) off.delete(ks); else if (Bv[ks] > most) { A[ks] *= most / Bv[ks]; Bv[ks] = most; } } }
  const out: P2[] = [];
  for (let k = 0; k < 4; k++) {
    const c = corner[k];
    if (!off.has(k)) { out.push(c); continue; }
    const pl: P2 = [c[0] - Math.sign(c[0]) * A[k], c[1]], ps: P2 = [c[0], c[1] - Math.sign(c[1]) * Bv[k]];
    // keep the winding: corners run (−,−) (+,−) (+,+) (−,+); at corners 0 and 2 the walk arrives along s and leaves along l
    if (k === 0 || k === 2) { out.push(ps, pl); } else { out.push(pl, ps); }
  }
  return out;
}
/** WEDGE: the rectangle ±L × ±S cut by ONE line near a diagonal — turned ≤ 15° off it, through a point near the middle — and the half on one side kept (3 to 5
 *  sides). `flip` keeps the other half: two wedges off the same draws are the two halves of one panel. */
export function wedgeOutline(L: number, S: number, r: () => number, flip = false): P2[] {
  const which = r() < 0.5 ? 1 : -1, turn = (r() * 2 - 1) * 15 * RAD, o = (r() - 0.5) * 0.3;
  const a = Math.atan2(which * S, L) + turn; const nx = -Math.sin(a), ny = Math.cos(a);   // the line runs along (cos a, sin a); (nx, ny) is its normal
  const d = (nx * L * o + ny * S * o) * (flip ? -1 : 1), sx = flip ? -nx : nx, sy = flip ? -ny : ny;
  const rect: P2[] = [[-L, -S], [L, -S], [L, S], [-L, S]]; const out: P2[] = [];
  for (let k = 0; k < 4; k++) {   // the rectangle clipped to sx·u + sy·v ≤ d
    const p = rect[k], q = rect[(k + 1) % 4]; const fp = sx * p[0] + sy * p[1] - d, fq = sx * q[0] + sy * q[1] - d;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
/** SNAPPED END: a long piece whose +l end is broken to a point by 1 or 2 planes 20‥40° off square (the −l end too, one time in three) */
export function snappedOutline(L: number, S: number, r: () => number): P2[] {
  const end = (sign: number): P2[] => {
    const a1 = (20 + 20 * r()) * RAD, two = r() < 0.55;
    if (!two) { const run = Math.min(2 * S * Math.tan(a1), 0.8 * L); const up = r() < 0.5; return up ? [[sign * (L - run), -S], [sign * L, S]] : [[sign * L, -S], [sign * (L - run), S]]; }
    const s0 = (r() - 0.5) * S, a2 = (20 + 20 * r()) * RAD;
    return [[sign * (L - Math.min((s0 + S) * Math.tan(a1), 0.8 * L)), -S], [sign * L, s0], [sign * (L - Math.min((S - s0) * Math.tan(a2), 0.8 * L)), S]];
  };
  const hi = end(1), lo = r() < 0.33 ? end(-1) : [[-L, -S] as P2, [-L, S] as P2];
  return [...hi, ...lo.reverse()];   // (+l end bottom → top, then the −l end top → bottom: one loop)
}
/** STRIP: a long splinter — both long sides close toward the +l end, each within 8° of the long axis */
export function stripOutline(L: number, S: number, r: () => number): P2[] {
  const most = 2 * L * Math.tan(8 * RAD);
  const t0 = Math.min(S * (0.55 + 0.4 * r()), most), t1 = Math.min(S * (0.55 + 0.4 * r()), most);
  return [[-L, -S], [L, -S + t0], [L, S - t1], [-L, S]];
}
/** the outline of `shape` in the piece's own (l, s) */
function outlineOf(shape: Shape, L: number, S: number, row: BreakRow, r: () => number, flip: boolean): P2[] {
  if (shape === 'wedge') return wedgeOutline(L, S, r, flip);
  if (shape === 'snapped') return snappedOutline(L, S, r);
  if (shape === 'strip') return stripOutline(L, S, r);
  if (shape === 'panel') return [[-L, -S], [L, -S], [L, S], [-L, S]];
  return slabOutline(L, S, shape === 'lump' ? 3 + Math.floor(r() * 2) : Math.round(lerp(row.tears, r())), r);
}
export interface Shaped { off: Vec3; h: Vec3; cut: CutPlane[] | undefined }
/** `shape` as a fitted cut box: the outline extruded across `thin` (0 x / 1 y / 2 z; the long side along the first of the other two axes when `longFirst`), a LUMP
 *  with 1‥3 of its top edges bevelled as well. null = nothing left (never for the shapes above; the caller falls back to the plain box). */
export function shapeBox(shape: Shape, thin: 0 | 1 | 2, halfT: number, L: number, S: number, longFirst: boolean, row: BreakRow, r: () => number, flip = false): Shaped | null {
  const o = outlineOf(shape, L, S, row, r, flip);
  const poly: P2[] = o.map(p => longFirst ? [p[0], p[1]] : [p[1], p[0]]);
  const pr = cutPrism(thin, halfT, poly); if (pr.empty) return null;
  BREAK_STATS.dropped += pr.dropped;
  if (shape !== 'lump') return { off: pr.off, h: pr.h, cut: pr.cut };
  const ua = (thin + 1) % 3, va = (thin + 2) % 3; const extra: CutPlane[] = [];
  // a corner 15‥35 % deep off the top or the bottom face — BROKEN, not planed: the plane across it, then one or two more through the same ground that lean
  // toward one axis each (a ridge runs across what would have been one flat facet). The first plane of every corner goes in before any second: the 8-plane
  // limit takes facets, never a whole corner
  const more: CutPlane[] = [];
  for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
    const su = r() < 0.5 ? -1 : 1, sv = r() < 0.5 ? -1 : 1, st = r() < 0.5 ? -1 : 1, deep = 0.15 + 0.2 * r();
    const n3: Vec3 = [0, 0, 0]; n3[ua] = su / pr.h[ua]; n3[va] = sv / pr.h[va]; n3[thin] = st / pr.h[thin];
    const at: Vec3 = [0, 0, 0]; at[ua] = su * pr.h[ua] * (1 - deep); at[va] = sv * pr.h[va] * (1 - deep); at[thin] = st * pr.h[thin] * (1 - deep);
    extra.push(cutThrough(at, n3));
    for (let j = 0, facets = 1 + Math.floor(r() * 2), first = Math.floor(r() * 3); j < facets; j++) {
      const lean = [ua, va, thin][(first + j) % 3], m3: Vec3 = [n3[0] * 0.45, n3[1] * 0.45, n3[2] * 0.45]; m3[lean] = n3[lean] * (1.5 + 0.9 * r());
      const back = 0.04 + 0.1 * r(), p3: Vec3 = [at[0], at[1], at[2]]; p3[lean] += Math.sign(n3[lean]) * pr.h[lean] * deep * back * 2;
      more.push(cutThrough(p3, m3));
    }
  }
  const room = Math.max(0, MAX_CUT_PLANES - (pr.cut?.length ?? 0) - extra.length); extra.push(...more.slice(0, room));
  const rr = cutRecord(pr.h, [...(pr.cut ?? []), ...extra]); if (rr.empty) return { off: pr.off, h: pr.h, cut: pr.cut };
  BREAK_STATS.dropped += rr.dropped;
  const f = cutFit(pr.h, rr.cut); return { off: [pr.off[0] + f.off[0], pr.off[1] + f.off[1], pr.off[2] + f.off[2]], h: f.h, cut: f.cut };
}

/** an open face of a standing piece (wallbreak.ts rebuild → `ragged`): the face's axis and side, the lateral axes a plane may lean along (first = preferred), a
 *  stable seed, and — when only the part of the face ABOVE local height `lo` is open (a full-height column beside a port) — that height */
export interface OpenFace { axis: 0 | 1 | 2; sign: 1 | -1; lat: (0 | 1 | 2)[]; seed: number; lo?: number;
  /** an upright end only: the piece's own height above which NOBODY WALKS (head height) — from there up the end may be torn back far past the bite (`BREAKS.head`) */
  head?: number }
/** RAGGED END: the planes for a standing piece's open faces — each 1 or 2 planes `deg` off square, pivoted so the far corner is bitten ≤ `bite` and the rest of the
 *  face stays (the uncut box is still the piece: the cut record is NOT fitted — feet, the nav grid and the cell rebuild keep the box they know). */
export function raggedCut(row: BreakRow, h: Vec3, faces: readonly OpenFace[]): CutPlane[] | undefined {
  const R = row.ragged; if (!R || !faces.length) return undefined;
  const planes: CutPlane[] = [], head: CutPlane[] = [];
  const perFace = Math.max(1, Math.floor(BREAKS.maxStandingPlanes / faces.length));
  for (const f of faces) {
    if (planes.length >= BREAKS.maxStandingPlanes) break;
    const s = (j: number) => hash01(f.seed * 31 + j); let mine = 0;
    const push = (l: 0 | 1 | 2, side: number, th: number, bite: number) => {
      if (mine >= perFace || planes.length >= BREAKS.maxStandingPlanes || !(bite > 0.004)) return;
      const n: Vec3 = [0, 0, 0]; n[f.axis] = f.sign * Math.cos(th); n[l] = side * Math.sin(th);
      planes.push({ n, d: Math.cos(th) * (h[f.axis] - bite) + Math.sin(th) * h[l] }); mine++;
    };
    // ABOVE HEAD HEIGHT nobody walks into the wall: there the end is TORN BACK, a notch `BREAKS.head.deep` at the wall's top in two planes — a long one from head
    // height up and a steeper one from higher that takes over toward the top — each turned across the wall's thickness its own way, so the end is a different
    // line on each face of the wall. Neither takes anything below head height on either face, nor a side of the box back: feet, nav and the cell rebuild keep the
    // box they know (the bite's rule, untouched below). They ride ON TOP of the piece's own planes (≤ `BREAKS.maxStandingPlanes`), `head.planes` an end.
    if (BREAKS.head.on && f.head !== undefined && f.axis !== 1 && !R.grain) { const HD = BREAKS.head, y0 = Math.max(f.head, f.lo ?? -h[1]), room = h[1] - y0;
      const o = ([0, 2] as const).find(a => a !== f.axis)!;
      if (room >= HD.minRoom) { const deep = Math.min(lerp(HD.deep, s(20)), 2 * h[f.axis] * HD.mostOfWidth);
        for (let k = 0; k < HD.planes && planes.length + head.length < MAX_CUT_PLANES; k++) {
          const ys = y0 + room * (k === 0 ? 0.12 * s(21) : 0.38 + 0.3 * s(22 + k)), D = deep * (k === 0 ? 0.4 + 0.25 * s(23) : 1 - 0.2 * (k - 1)), H = h[1] - ys;
          const so = s(24 + k) < 0.5 ? -1 : 1, sk = Math.tan(lerp(HD.across, s(27 + k)) * RAD) * (k % 2 ? -1 : 1);
          const L = Math.hypot(H, D), n: Vec3 = [0, 0, 0]; n[f.axis] = f.sign * H / L; n[1] = D / L; n[o] = so * sk;
          const m = Math.hypot(n[0], n[1], n[2]); n[0] /= m; n[1] /= m; n[2] /= m;
          const at: Vec3 = [0, 0, 0]; at[f.axis] = f.sign * h[f.axis]; at[1] = ys; at[o] = so * Math.sign(sk) * h[o];   // (through the face at `ys` on the wall face it leans to: higher everywhere else)
          head.push({ n, d: n[0] * at[0] + n[1] * at[1] + n[2] * at[2] });
        } } }
    const full = R.bite * (0.55 + 0.45 * s(3));   // the deepest this end is bitten, at its far corner
    if (R.grain) {   // along the grain: one plane with the piece's long side, as a board splits
      const l = f.lo !== undefined ? 1 : [...f.lat].sort((a, b) => h[b] - h[a])[0]; const th = lerp(R.deg, s(1)) * RAD;
      const room = f.lo !== undefined ? h[l] - f.lo : 2 * h[l];
      push(l, f.lo !== undefined ? 1 : s(2) < 0.5 ? -1 : 1, th, Math.min(full, room * Math.tan(th) * 0.9));
      continue;
    }
    // (1) THE LEAN: the whole end (what is open of it) leaves square by a shallow plane over most of its length — up a wall's end, along a sill's top — so the
    // end is nowhere a ruled line; (2) a steeper break `deg` off square at the same corner, or the opposite corner knocked off (a blunt point);
    // (3) the end turned across the piece's other side as well, steeply (`BREAKS.acrossDeg`) — dealt second
    const l = f.lat[0], room = f.lo !== undefined ? h[l] - f.lo : 2 * h[l];
    const side = f.lo !== undefined ? 1 : s(2) < (l === 1 ? 0.7 : 0.5) ? 1 : -1;   // (a wall's end loses its TOP corner more often than its foot: the top is what is seen)
    const cover = 0.75 + 0.2 * s(5), b1 = full * (0.45 + 0.3 * s(4)), th1 = Math.atan(b1 / Math.max(0.05, room * cover));
    push(l, side, th1, b1);
    const o = f.lat.find(a => a !== l);   // (before the second lean: with two open ends a piece has two planes an end, and the turn across it is the one seen from above)
    if (o !== undefined && f.lo === undefined) { const th3 = lerp(BREAKS.acrossDeg, s(7)) * RAD; push(o, s(8) < 0.5 ? -1 : 1, th3, Math.min(full, 2 * h[o] * Math.tan(th3) * 0.9)); }
    const th2 = lerp(R.deg, s(1)) * RAD;   // (the opposite corner stops short of the lean, so a little of the square end is nearly always left)
    if (f.lo === undefined && s(6) < 0.5) push(l, -side, th2, Math.min(full * 0.8, room * (1 - cover) * 0.8 * Math.tan(th2)));
    else push(l, side, th2, Math.min(full, room * Math.tan(th2) * 0.9));
  }
  if (head.length) { BREAK_STATS.notched += head.length; planes.push(...head); }
  if (!planes.length) return undefined;
  const rr = cutRecord(h, planes); if (rr.empty) return undefined;
  return rr.cut;
}

/** the horizontal unit normal of a wall-like box (across its thin side) on the side `toward` points to, with `keep` of `toward` itself mixed back in (0 = square
 *  to the wall); `toward` running ALONG the wall (no side to pick) = `toward` as given */
function wallNormal(b: Box, toward: Vec3, keep = 0): Vec3 {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const n: Vec3 = b.h[0] <= b.h[2] ? [cs, 0, -sn] : [sn, 0, cs];
  const raw = n[0] * toward[0] + n[2] * toward[2]; const len = Math.hypot(toward[0], toward[2]);   // (the side by the RAW distance across the wall: a charge on the face, two metres along from the wall's middle, is still on one side of it)
  if (len < 1e-6) return [n[0], 0, n[2]];
  const t: Vec3 = [toward[0] / len, 0, toward[2] / len];
  // (in the wall's own plane — a charge on the end of a T-junction's stem: no side is away from it, so the cells take sides by where they are)
  const s = Math.abs(raw) < 0.01 && Math.abs(raw) < 0.08 * len ? (Math.floor((b.c[0] + b.c[2]) * 4 + b.c[1] * 2) & 1 ? 1 : -1) : raw < 0 ? -1 : 1; return v3.normalize([n[0] * s + t[0] * keep, 0, n[2] * s + t[2] * keep]);
}

/** the cells of a breakable as wallbreak.ts keeps them (its Breakable, structurally) */
/** what one blast (or one round) may still throw: rigid pieces, and — a blast — heap slabs, the point it went off at, pieces a cell (1 = deal them round the opening) */
export interface ShedBudget { chunks: number; heap?: number; from?: Vec3; per?: number }
export interface CellGrid { id: number; surf: Surf; nx: number; ny: number; nz: number; yb: number[]; open: Uint8Array; nOpen?: number; box: Box }

export class Breaks {
  private counter = 1;
  private queue: Chunk[] = [];
  constructor(private g: Game, private debris: Debris) {}
  private hash = (): number => hash01(this.counter++ * 2246822519);
  reset() { this.counter = 1; this.queue.length = 0; this.kinkT = -1e9; }
  private small(): boolean { return this.debris.cap() < 64; }
  /** a chunk's serial counted from the pool's last clear(): 1, 2, … in every encounter = a fresh game's own serials, so a restarted or loaded encounter breaks its pieces again as a
   *  fresh game does (the pool's `serial` itself runs on across restarts: motion keys stay unique) */
  private rel(c: Chunk): number { return c.serial - this.debris.serial0 + 1; }
  /** the rigid pool's share of one blast for thrown wall / cover pieces, heap slabs, furniture pieces */
  share(): { thrown: number; heap: number; furniture: number } {
    const s = this.small() ? BREAKS.share.small : BREAKS.share.big;
    return this.look?.on && BREAKS.lookHeap ? { thrown: s.thrown + s.heap, heap: 0, furniture: s.furniture } : s;   // (somebody's rubble is the heap: its part is thrown)
  }
  /** THE LOAD NUMBER (probes, the panel): pieces moving + particle records waiting to be born */
  load(): number { const P = gpuFx(this.g) as unknown as { queue?: unknown[] } | null; return this.debris.moving + (P?.queue?.length ?? 0); }

  // ---------------------------------------------------------------- the pool's hooks (game/debris.ts calls them; each is nothing with the switch off)
  /** every chunk the pool takes: its row by what it is, its row's bounce and landing level */
  born(c: Chunk) {
    if (!cutBoxesOn() || c.kind === 'shard') return;
    this.tag(c, matOf(c.kind, c.box.albedo), 0, c.box.albedo, c.kind === 'binder');
  }
  private tag(c: Chunk, mat: Mat, gen: 0 | 1, paint: Vec3, fixed = false) {
    const row = BREAK[mat]; c.mat = { mat, gen, paint: v3.copy(paint) }; if (fixed) c.mat.fixed = true;
    c.contact = { keepFloor: 0.55, keepWall: 0.8, rest: row.rest }; if (row.level > 0) c.level = row.level;
  }
  /** a piece's first hard touch (m/s along the surface normal): over its row's speed it breaks once more — queued, done in tick() (the pool is mid-step) */
  landed(c: Chunk, speed: number) {
    if (!cutBoxesOn()) return; const m = c.mat; if (!m || m.gen > 0 || m.fixed) return;
    const a = BREAK[m.mat].again;
    const china = m.mat === 'plastic' && speed >= BREAKS.chinaLand && Math.max(c.box.h[0], c.box.h[1], c.box.h[2]) <= BREAKS.chinaMax;
    if (!china && (!a || speed < a.land || (a.chance !== undefined && hash01(this.rel(c) * 7919 + 13) >= a.chance))) return;
    if (!this.queue.includes(c)) this.queue.push(c);
  }
  /** an impulse's kick on a piece (m/s): over its row's kick it breaks once more */
  kicked(c: Chunk, kick: number) {
    if (!cutBoxesOn()) return; const m = c.mat; if (!m || m.gen > 0 || m.fixed) return;
    const a = BREAK[m.mat].again; if (!a || kick < a.kick) return;
    if (!this.queue.includes(c)) this.queue.push(c);
  }
  /** the pool took a resting piece's slot: it crumbles into a few chips of its own material where it lay (glass: game/shards.ts's own crumble, when it has one) */
  evicted(c: Chunk) {
    messEvicted(this.g, c);   // (picture only: the mark it leaves where it lay — floormess.ts CHAOS.mess, nothing with the rule off)
    if (!cutBoxesOn()) return;
    if (c.glass) { (this.g as unknown as { shards?: { evicted?(c: Chunk): void } }).shards?.evicted?.(c); return; }
    if (EVICT.on) this.dissolve(c); else this.crumble(c, BREAKS.crumbleChips, 0.35);
  }
  /** the slot a spawn over the cap takes (Debris.spawnRaw; `ok` = the pool's own test of what may go): the smallest such piece, the oldest among equals */
  pick(list: readonly Chunk[], ok: (c: Chunk) => boolean): number {
    if (!cutBoxesOn() || !EVICT.on) return list.findIndex(ok);
    let bi = -1, br = Infinity;
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (!ok(c) || c.age <= 0) continue; const r = Math.max(c.box.h[0], c.box.h[1], c.box.h[2]); if (r < br) { br = r; bi = i; } }   // (not a piece dealt this very frame: a heap's slabs would take each other's slots)
    return bi >= 0 ? bi : list.findIndex(ok);
  }
  /** an EVICTED piece gone where it lay, by its size: a mug's four chips up to a plank's fourteen, born at stations along the box's own long axis (its second
   *  extent their scatter) — the shape it had, not a ball at its middle — and its row's dust once, by its size (no sparks: nothing struck it) */
  private dissolve(c: Chunk) {
    const P = gpuFx(this.g); BREAK_STATS.crumbled++; if (!P) return;
    const m = c.mat ?? { mat: matOf(c.kind, c.box.albedo), gen: 0 as const, paint: c.box.albedo }; const row = BREAK[m.mat]; const b = c.box, h = b.h;
    const il = h[0] >= h[1] && h[0] >= h[2] ? 0 : h[1] >= h[2] ? 1 : 2; const r = h[il]; const mid = Math.max(...[0, 1, 2].filter(i => i !== il).map(i => h[i]));
    const [n0, n1] = BREAKS.sizedChips, [s0, s1] = BREAKS.sizedSpan; const n = Math.round(n0 + (n1 - n0) * Math.max(0, Math.min(1, (r - s0) / Math.max(1e-3, s1 - s0))));
    const ax = quat.rotate(b.rot ?? quat.yaw(b.yaw), il === 0 ? [1, 0, 0] : il === 1 ? [0, 1, 0] : [0, 0, 1]);
    const S = row.small; const color = this.tint(row, m.paint, BREAKS.chipTint); const sizeK = Math.max(1, Math.min(2.2, r / 0.08));
    const st = Math.max(1, Math.min(3, Math.round(r / 0.14))); const jit = Math.max(0.02, Math.min(0.14, mid));   // stations along it: one for a mug, three for a plank
    for (let i = 0, left = n; i < st; i++) {
      const k = Math.round(left / (st - i)); left -= k; if (k <= 0) continue;
      const t = st === 1 ? 0 : (i / (st - 1) - 0.5) * 1.3; const u = st === 1 ? 0.5 : i / (st - 1);   // (…the big long chips toward one end, the small squat ones the other)
      P.emit('debris', [b.c[0] + ax[0] * r * t, b.c[1] + ax[1] * r * t, b.c[2] + ax[2] * r * t], [0, 1, 0], k, { speed: 0.35 * (1.15 - 0.3 * u), speedJit: 0.7, spread: 1.1, life: 17, lifeJit: 0.3, size: lerp(S.size, 0.25 + 0.6 * u) * sizeK, sizeJit: 0.3, aspect: lerp(S.aspect, 0.25 + 0.6 * u), posJit: jit, color, owner: c.who });
    }
    BREAK_STATS.chips += n;
    if (row.dust > 0) emitDust(P, b.c, [0, 1, 0], Math.max(1, Math.round(row.dust * Math.max(0.5, Math.min(1.5, r / 0.25)))), { shape: 'puff', speed: PFX.dustSpeed * 0.6, speedJit: 0.5, lift: 0.05, life: PFX.dustLife, lifeJit: 0.3, size: PFX.dustSize, sizeJit: 0.35, posJit: Math.max(0.08, Math.min(0.3, r * 0.6)), color: v3.lerp(this.tint(row, m.paint, 0.6), [0.8, 0.79, 0.76], 0.4) });
  }
  /** after the pool's step (Destruction.update): the breaks queued this frame */
  tick() {
    if (!this.queue.length) return;
    const q = this.queue; this.queue = [];
    if (!cutBoxesOn()) return;
    for (const c of q) this.breakAgain(c);
  }

  // ---------------------------------------------------------------- small and fine
  private tint(row: BreakRow, paint: Vec3, k: number): Vec3 { return v3.lerp(paint, coreOf(row, paint), k); }
  /** `n` chips of the row's small debris at `at` */
  private chips(row: BreakRow, paint: Vec3, at: Vec3, dir: Vec3, n: number, speed: number, posJit: number, who: number, sizeK = 1) {
    const P = gpuFx(this.g); if (!P || n <= 0) return;
    const S = row.small; const color = this.tint(row, paint, BREAKS.chipTint);
    // two records over the row's ranges — many small squat ones, fewer big long ones — so a burst is not n copies of its mean chip (the births are the same n)
    const big = n >= 4 && (S.aspect[1] > S.aspect[0] || S.size[1] > S.size[0]) ? Math.floor(n / 3) : 0;
    const one = (k: number, t: number) => { if (k > 0) P.emit('debris', at, dir, k, { speed: speed * (1.15 - 0.3 * t), speedJit: 0.7, spread: 1.1, life: 17, lifeJit: 0.3, size: lerp(S.size, t) * sizeK, sizeJit: 0.3, aspect: lerp(S.aspect, t), posJit, color, owner: who }); };
    if (big) { one(n - big, 0.25); one(big, 0.85); } else one(n, 0.5);
    BREAK_STATS.chips += n;
  }
  private fines(row: BreakRow, paint: Vec3, at: Vec3, dir: Vec3, k = 1) {
    const P = gpuFx(this.g); if (!P) return;
    if (row.dust > 0) emitDust(P, at, dir, Math.round(row.dust * k), { shape: 'puff', speed: PFX.dustSpeed, speedJit: 0.5, lift: 0.05, life: PFX.dustLife, lifeJit: 0.3, size: PFX.dustSize, sizeJit: 0.35, posJit: 0.08, vadd: v3.scale(dir, 0.45), color: v3.lerp(this.tint(row, paint, 0.6), [0.8, 0.79, 0.76], 0.4) });
    if (row.sparks > 0) P.emit('spark', at, dir, Math.round(row.sparks * k), { speed: 4, speedJit: 0.6, spread: PFX.sparkSpread, life: PFX.sparkLife, lifeJit: 0.4, size: PFX.sparkSize });
  }
  /** a piece gone into particles of its own material where it is (an eviction, the mayhem rule, china) */
  private crumble(c: Chunk, count: [number, number], speed: number) {
    const m = c.mat ?? { mat: matOf(c.kind, c.box.albedo), gen: 0 as const, paint: c.box.albedo }; const row = BREAK[m.mat];
    const n = count[0] + Math.floor(hash01(this.rel(c) * 577 + 3) * (count[1] - count[0] + 1));
    const r = Math.max(c.box.h[0], c.box.h[1], c.box.h[2]);
    this.chips(row, m.paint, c.box.c, [0, 1, 0], n, speed, r * 0.6, c.who, Math.max(1, Math.min(2.2, r / 0.08)));
    BREAK_STATS.crumbled++;
  }
  /** a piece the pool refused (everything in it is still moving): a burst of chips of its material */
  private refuse(row: BreakRow, paint: Vec3, at: Vec3, v: Vec3, who: number) {
    this.chips(row, paint, at, v3.normalize(v), BREAKS.refuseChips[0] + Math.floor(this.hash() * (BREAKS.refuseChips[1] - BREAKS.refuseChips[0] + 1)), 2.2, 0.05, who, 1.3);
    BREAK_STATS.refused++;
  }

  // ---------------------------------------------------------------- level B
  private breakAgain(c: Chunk) {
    const D = this.debris; const i = D.list.indexOf(c); const m = c.mat; if (i < 0 || !m || m.gen > 0) return;
    const row = BREAK[m.mat]; const a = row.again; const b = c.box;
    const gone = !a || (m.mat === 'plastic' && Math.max(b.h[0], b.h[1], b.h[2]) <= BREAKS.chinaMax);
    if (gone || D.moving > D.cap() / 2) {   // china, or the mayhem rule: straight into its particles, and its slot is free
      D.list.splice(i, 1); this.crumble(c, [a ? a.chips + 4 : 8, a ? a.chips + 6 : 10], 1.2);
      if (gone) BREAK_STATS.china++; else BREAK_STATS.mayhem++;
      return;
    }
    // one plane through the piece: across its length, along it, or on its diagonal
    const h = b.h; const thin = (h[0] <= h[1] && h[0] <= h[2] ? 0 : h[1] <= h[2] ? 1 : 2) as 0 | 1 | 2; const ua = (thin + 1) % 3, va = (thin + 2) % 3;
    const lg = h[ua] >= h[va] ? ua : va, sh = lg === ua ? va : ua; const rel = this.rel(c); const r = (j: number) => hash01(rel * 1013 + j * 37 + 5);
    const n: Vec3 = [0, 0, 0], at: Vec3 = [0, 0, 0];
    if (a.how === 'across') { const t = (8 + 20 * r(1)) * RAD * (r(2) < 0.5 ? -1 : 1); n[lg] = Math.cos(t); n[sh] = Math.sin(t); at[lg] = (r(3) - 0.5) * 0.4 * h[lg]; }
    else if (a.how === 'along') { const t = 7 * RAD * (r(1) * 2 - 1); n[sh] = Math.cos(t); n[lg] = Math.sin(t); at[sh] = (r(3) - 0.5) * 0.3 * h[sh]; }
    else { const t = 12 * RAD * (r(1) * 2 - 1), d = Math.atan2(h[lg], h[sh]) * (r(2) < 0.5 ? -1 : 1) + t; n[lg] = Math.cos(d); n[sh] = Math.sin(d); }
    const base = b.cut ?? [];
    const halves = [cutRecord(h, [...base, cutThrough(at, n)]), cutRecord(h, [...base, cutThrough(at, [-n[0], -n[1], -n[2]])])];
    if (halves[0].empty || halves[1].empty) return;   // (the plane missed what is left of it: it stays one piece)
    D.list.splice(i, 1);
    const rot = b.rot ?? quat.yaw(b.yaw); const nw = quat.rotate(rot, n);
    for (let k = 0; k < 2; k++) {
      const f = cutFit(h, halves[k].cut); const w = cutToWorld(f.off, b.yaw, b.rot); const sgn = k === 0 ? -1 : 1;
      const box = makeBox({ c: [b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2]], h: f.h, yaw: b.yaw, rot: [rot[0], rot[1], rot[2], rot[3]], albedo: v3.copy(b.albedo) });
      const sep = 0.35 + 0.5 * r(10 + k);
      const v: Vec3 = [c.v[0] + nw[0] * sgn * sep, Math.max(c.v[1], 0) + 0.3 + 0.5 * r(12 + k), c.v[2] + nw[2] * sgn * sep];
      const wv: Vec3 = [c.w[0] + (r(14 + k) - 0.5) * 5, c.w[1] + (r(16 + k) - 0.5) * 3, c.w[2] + (r(18 + k) - 0.5) * 5];
      const got = D.spawnRaw('chunk', box, v, wv, c.who);
      if (!got) { this.refuse(row, m.paint, box.c, v, c.who); continue; }
      got.box.cut = f.cut; if (f.cut) got.box.cutCore = faceCore(row, m.paint); got.box.rough = b.rough; got.box.metal = b.metal;
      this.tag(got, m.mat, 1, m.paint); got.sounded = true; got.age = Math.max(c.age, 1e-3); got.sfx = c.sfx; got.level = c.level;
      BREAK_STATS.planes += f.cut?.length ?? 0;
    }
    this.chips(row, m.paint, b.c, [0, 1, 0], a.chips, 1.6, Math.max(h[lg], 0.04) * 0.5, c.who);
    this.fines(row, m.paint, b.c, [0, 1, 0], 0.5);
    if (row.puff > 0 && m.mat === 'tile') this.g.destr.cellDust(b.c, [0, 1, 0], row.puff, 'drywall');
    if (row.mark > 0 && c.box.c[1] - supportAlong(b, [0, 1, 0]) < 0.06) this.g.decals.add('chip', [b.c[0], b.c[1] - supportAlong(b, [0, 1, 0]) + 0.002, b.c[2]], [0, 1, 0], row.mark * (0.7 + 0.6 * r(20)));   // (on the floor only: a desk top keeps its finish)
    BREAK_STATS.again++;
  }

  // ---------------------------------------------------------------- furniture: a plain piece takes its row's outline
  /** A PLAIN PIECE somebody else cut out of a thing (the furniture breaker's slats, slabs and plates) takes its row's broken outline where it is: a wooden slat a
   *  snapped end (a slim one a splinter's taper), board / tile / plastic a slab's torn corners, a blocky piece a lump's knocked corners; a cushion and the rows with
   *  no pieces stay whole; sheet metal stays a whole plate — it bends, it does not break — and the first big plate of a blast comes off KINKED. The piece is only
   *  made smaller inside the box it had (fitted), so whoever placed it placed it right — bar the kinked plate, whose box grows across its thin side by the fold's rise. Nothing with the switch off. */
  dress(c: Chunk) {
    if (!cutBoxesOn() || c.kind !== 'chunk' || c.box.cut || c.mate || !c.mat) return;
    const m = c.mat.mat, row = BREAK[m], b = c.box, h = b.h;
    const ax = ([0, 1, 2] as (0 | 1 | 2)[]).sort((i, j) => h[i] - h[j]); const thin = ax[0], mid = ax[1], long = ax[2];
    if (h[long] < 0.04) return;   // a crumb: nothing to show
    if (m === 'metal') { this.kink(c, thin, mid, long); return; }
    const sb = this.outline(m, row, h, thin, mid, long, this.hash);
    if (!sb || !sb.cut) { BREAK_STATS.plain++; return; }
    const o = quat.rotate(b.rot ?? quat.yaw(b.yaw), sb.off);
    b.c = [b.c[0] + o[0], b.c[1] + o[1], b.c[2] + o[2]]; b.h = sb.h; b.cut = sb.cut; b.cutCore = faceCore(row, c.mat.paint); b.albedo = this.tint(row, c.mat.paint, BREAKS.coreTint);
    BREAK_STATS.dressed++; BREAK_STATS.planes += sb.cut.length;
  }
  /** the outline row `m` gives a plain piece of these proportions (null = it stays whole: a cushion, a row with no pieces) */
  private outline(m: Mat, row: BreakRow, h: Vec3, thin: 0 | 1 | 2, mid: 0 | 1 | 2, long: 0 | 1 | 2, hash: () => number) {
    if (!row.cell.length || (m === 'fabric' && h[thin] > 0.35 * h[mid])) return null;   // (a cushion never breaks)
    const shape: Shape = h[thin] > 0.6 * h[mid] && h[long] < 2.5 * h[mid] ? 'lump' : m === 'wood' && h[long] >= 2.5 * h[mid] ? (h[mid] < 0.035 ? 'strip' : 'snapped') : 'slab';
    return shapeBox(shape, thin, h[thin], h[long], h[mid], (thin + 1) % 3 === long, row, hash);
  }

  // ---------------------------------------------------------------- beside a look-only system
  /** THE SEAM WITH A SYSTEM THAT DRESSES A BLOWN WALL FOR THE PICTURE (the look goal's edge plates and rubble; it hands its own table here, `on` read live). Under the
   *  cut switch nothing is then made twice: a WALL's standing pieces keep square ends under its edge plates (`BREAKS.lookEdges`; cover has no plates and keeps its
   *  ragged ends) and the heap at a hole's foot is its rubble, not a second set of slabs (`BREAKS.lookHeap`) — its fragments take their outlines from this table
   *  through `shapeLoose`. Null = nobody else: everything here as it was. */
  look: { on: boolean } | null = null;
  /** A LOOSE BOX somebody else owns and moves (a look-only fragment: not in the pool, no row of its own) takes the outline its material's row gives a piece of its
   *  proportions: made smaller inside the box it had, then set down so its lowest corner is where the box's was. KEYED — the same key gives the same outline and
   *  nothing of the table's own stream is drawn, so a look that comes and goes moves no piece of the pool's. False = left whole (the switch off, a crumb, sheet
   *  metal, a cushion, a row with no pieces). The caller re-reads `b.c` (its rest point moved with the fit). */
  shapeLoose(b: Box, surf: string, key: number): boolean {
    if (!cutBoxesOn() || b.cut) return false;
    const m = SURF_MAT[surf as Surf]; if (!m || m === 'metal') return false; const row = BREAK[m], h = b.h;
    const ax = ([0, 1, 2] as (0 | 1 | 2)[]).sort((i, j) => h[i] - h[j]); if (h[ax[2]] < BREAKS.looseMin) return false;
    let n = 0; const sb = this.outline(m, row, h, ax[0], ax[1], ax[2], () => hash01(Math.imul(key | 0, 40503) + 977 * n++ + 11));
    if (!sb || !sb.cut) return false;
    const rot = b.rot ?? quat.yaw(b.yaw); const o = quat.rotate(rot, sb.off);
    let low0 = 0, low1 = Infinity;   // lowest point of the box it was, and of what is left of it, off the old centre
    for (let k = 0; k < 8; k++) low0 = Math.min(low0, quat.rotate(rot, [k & 1 ? h[0] : -h[0], k & 2 ? h[1] : -h[1], k & 4 ? h[2] : -h[2]])[1]);
    for (const v of cutVerts(sb.h, sb.cut)) low1 = Math.min(low1, quat.rotate(rot, v)[1] + o[1]);
    b.c = [b.c[0] + o[0], b.c[1] + o[1] + (Number.isFinite(low1) ? low0 - low1 : 0), b.c[2] + o[2]]; b.h = sb.h; b.cut = sb.cut; b.cutCore = faceCore(row, b.albedo);
    BREAK_STATS.loose++; BREAK_STATS.planes += sb.cut.length;
    return true;
  }
  /** what a piece IS, from whoever knows better than its paint (the furniture breaker: an unnamed grey is a steel cabinet, which the paint table reads as board) */
  retag(c: Chunk, mat: Mat) { if (!cutBoxesOn() || !c.mat || c.mat.mat === mat) return; this.tag(c, mat, c.mat.gen, c.mat.paint, c.mat.fixed); }
  /** A STEEL SHEET torn off a piece of furniture (a cabinet's door, a side): bent sheet, so it carries a shallow fold — every one of them, each its own (the
   *  one-a-blast rule is for the plates the pool meets by chance). Nothing with the switch off. */
  sheet(c: Chunk) {
    if (!cutBoxesOn() || c.kind !== 'chunk' || c.box.cut || c.mate || !c.mat) return;
    this.retag(c, 'metal'); const h = c.box.h;
    const ax = ([0, 1, 2] as (0 | 1 | 2)[]).sort((i, j) => h[i] - h[j]);
    if (this.kink(c, ax[0], ax[1], ax[2], BREAKS.steel.kink, true)) BREAK_STATS.sheets++;
  }
  /** A STEEL CARCASS that goes over whole (a cabinet with its door torn off): the box stays the box the pool and the floor know — but it is DENTED, a few creases
   *  along its edges that run out toward one end (never one big corner plane: that reads as a planed block), and it stands OPEN on the face its door came off
   *  (`axis`, `sign` in its own frame): that face is drawn a hair back inside a frame of its own steel, dark — the inside of a cabinet (the chunk's second drawn
   *  box, as the kinked plate's). A box cannot be hollow: the dark face stands `lip` PROUD of the frame round it, not behind it — at these sizes a dark opening in a
   *  rim either way. Seeded by the caller (`seed`: the furniture's own static, so a restart dents it the same): none of the table's stream is drawn. */
  carcass(c: Chunk, axis: 0 | 1 | 2, sign: 1 | -1, seed = 0) {
    if (!cutBoxesOn() || c.kind !== 'chunk' || c.box.cut || c.mate || !c.mat) return;
    this.retag(c, 'metal'); const b = c.box, h = b.h, S = BREAKS.steel; const r = (j: number) => hash01(Math.imul(seed + 1, 2749) + j * 61 + 7);
    const dents: CutPlane[] = [], deeper: CutPlane[] = [];
    for (let k = 0, n = S.dents[0] + Math.floor(r(0) * (S.dents[1] - S.dents[0] + 1)); k < n; k++) {
      // one edge of the box (along e, at the corner su, sv of the other two axes): a crease `deep` at one end of it, running out to nothing toward the other
      const e = Math.floor(r(10 + k) * 3) % 3, u = (e + 1) % 3, v = (e + 2) % 3, su = r(20 + k) < 0.5 ? -1 : 1, sv = r(30 + k) < 0.5 ? -1 : 1, se = r(40 + k) < 0.5 ? -1 : 1;
      const deep = Math.min(lerp(S.dent, r(50 + k)), S.dentMost * 2 * Math.min(h[u], h[v])), lean = 0.6 + r(60 + k);   // (lean: how the crease splits between its two faces)
      const n3: Vec3 = [0, 0, 0]; n3[u] = su; n3[v] = sv * lean; n3[e] = se * deep * (0.7 + 0.5 * r(70 + k)) / Math.max(h[e], 0.05);
      const at: Vec3 = [0, 0, 0]; at[u] = su * (h[u] - deep * 0.5); at[v] = sv * h[v]; at[e] = 0;
      const p = cutThrough(at, n3); dents.push(p); deeper.push({ n: p.n, d: p.d - 0.004 });
    }
    const lat = ([0, 1, 2] as (0 | 1 | 2)[]).filter(a => a !== axis); const face: Vec3 = [0, 0, 0]; face[axis] = sign;
    const inner: CutPlane[] = [{ n: [-face[0], -face[1], -face[2]], d: h[axis] - S.rim }];
    for (const a of lat) for (const sg of [-1, 1]) { const n3: Vec3 = [0, 0, 0]; n3[a] = sg; inner.push({ n: n3, d: h[a] - S.rim }); }
    const shell = cutRecord(h, [{ n: face, d: h[axis] - S.lip }, ...dents]), dark = cutRecord(h, [...inner, ...deeper]);
    if (shell.empty || dark.empty || !shell.cut || !dark.cut) return;
    b.cut = shell.cut;
    c.mate = makeBox({ c: b.c, h: [h[0], h[1], h[2]], yaw: b.yaw, rot: b.rot, albedo: v3.scale(b.albedo, S.inside), flags: b.flags, name: 'debris', mkey: MKEY.debris + ((c.serial + 32768) & 65535) });
    c.mate.cut = dark.cut; c.mate.rough = 1; c.mate.metal = false;
    BREAK_STATS.carcasses++; BREAK_STATS.planes += shell.cut.length + dark.cut.length;
  }
  private kinkT = -1e9;
  /** the KINKED PANEL: the plate becomes two cut boxes in ONE thicker box — each half a slanted plate from the fold to its end — so the pool, the floor and the
   *  feet meet the bound of the bent thing (it rests on its ridge or on its two ends, as a bent sheet does) and the picture and the rays meet the two halves. */
  private kink(c: Chunk, thin: 0 | 1 | 2, mid: 0 | 1 | 2, long: 0 | 1 | 2, deg: readonly [number, number] = BREAKS.kink.deg, every = false): boolean {
    const b = c.box, h = b.h, K = BREAKS.kink;
    if (h[thin] > 0.25 * h[mid] || h[long] < K.minLong || (!every && Math.abs(this.g.time - this.kinkT) < K.gapSecs)) return false;   // plates only; one a blast (a torn-off sheet: every one)
    if (!every) this.kinkT = this.g.time;
    const alpha = lerp(deg, this.hash()) / 2 * RAD, phi = (this.hash() * 2 - 1) * K.skew * RAD, u0 = (this.hash() - 0.5) * K.off * h[long];
    const f: Vec3 = [0, 0, 0]; f[long] = Math.cos(phi); f[mid] = Math.sin(phi);   // across the fold, in the plate's plane
    let sMax = 0; for (const sl of [-1, 1]) for (const sm of [-1, 1]) sMax = Math.max(sMax, Math.abs(f[long] * sl * h[long] + f[mid] * sm * h[mid] - u0));
    const ta = Math.tan(alpha), tau = h[thin] / Math.cos(alpha), tc = sMax * ta / 2, len = Math.hypot(1, ta);
    const H: Vec3 = [h[0], h[1], h[2]]; H[thin] = tc + tau;
    const half = (sg: 1 | -1): CutPlane[] | undefined => {   // the side sg·s ≥ 0 of the fold (s = f·p − u0), its mid-surface t = tc − sg·s·tan α
      const nt: Vec3 = [f[0] * sg * ta / len, f[1] * sg * ta / len, f[2] * sg * ta / len]; nt[thin] = 1 / len;
      return cutRecord(H, [{ n: [-sg * f[0], -sg * f[1], -sg * f[2]], d: -sg * u0 }, { n: nt, d: (tc + tau + sg * ta * u0) / len }, { n: [-nt[0], -nt[1], -nt[2]], d: -(tc - tau + sg * ta * u0) / len }]).cut;
    };
    const c0 = half(1), c1 = half(-1); if (!c0 || !c1) return false;
    b.h = H; b.cut = c0;
    c.mate = makeBox({ c: b.c, h: [H[0], H[1], H[2]], yaw: b.yaw, rot: b.rot, albedo: v3.copy(b.albedo), flags: b.flags, name: 'debris', mkey: MKEY.debris + ((c.serial + 32768) & 65535) });
    c.mate.cut = c1; c.mate.rough = b.rough; c.mate.metal = b.metal;
    BREAK_STATS.kinked++; BREAK_STATS.planes += c0.length + c1.length;
    return true;
  }

  // ---------------------------------------------------------------- level A: a broken cell of a wall / of cover
  /** What a broken cell throws (wallbreak.ts shed under the switch): its row's shapes as cut boxes while `budget` lasts, its chips, its fines. `cell` = the cell as
   *  a world box (its paint on it), `dir` = away from what broke it (null = straight down: it fell). `as`: the row to read instead of the surface's own. */
  shedCell(surf: Surf, cell: Box, dir: Vec3 | null, who: number, budget: ShedBudget, as?: Mat): { thrown: number; refused: number } {
    const g = this.g; const mat = as ?? SURF_MAT[surf], row = BREAK[mat]; const res = { thrown: 0, refused: 0 };
    const flat = cell.h[0] < cell.h[2] * 0.6 ? 0 : cell.h[2] < cell.h[0] * 0.6 ? 2 : -1;   // a wall's cell is thin across the wall; a crate's is a block
    const away: Vec3 | null = budget.from ? [cell.c[0] - budget.from[0], 0, cell.c[2] - budget.from[2]] : dir;   // (a blast: away from the charge at THIS cell, not at the wall's middle)
    const out: Vec3 = !away ? [0, 0, 0] : flat >= 0 ? wallNormal(cell, away, 0.3) : v3.normalize([away[0], 0, away[2]]);   // a wall's pieces leave through its face, away from what broke it
    const n = Math.min(Math.max(0, budget.chunks), row.cell.length, budget.per ?? row.cell.length); const k0 = n < row.cell.length && row.cell.length > 1 && this.hash() < 0.5 ? 1 : 0;   // (one piece a cell: either of the row's two)
    const paint = cell.albedo, tinted = this.tint(row, paint, BREAKS.coreTint);
    type Twin = { seed: number; thin: 0 | 2; vert: boolean; L: number; S: number }; let twin = null as Twin | null;   // two wedges of one cell are the two halves of one panel: the second replays the first's draws
    for (let k = 0; k < n; k++) {
      const shape = row.cell[(k + k0) % row.cell.length]; const second: boolean = shape === 'wedge' && twin !== null;
      const thin: 0 | 2 = second ? twin!.thin : (flat >= 0 ? flat : this.hash() < 0.5 ? 0 : 2) as 0 | 2;
      // the piece's long side: up the wall or along it by hash; no longer than the cell is that way
      const along = (thin === 0 ? 2 : 0) as 0 | 2; const vert: boolean = second ? twin!.vert : this.hash() < 0.5 || (flat >= 0 && (shape === 'snapped' || shape === 'strip'));   // (a wall's boards run up it; a crate's lie either way)
      const room = vert ? cell.h[1] : cell.h[along], cross = vert ? cell.h[along] : cell.h[1];
      const L: number = second ? twin!.L : Math.min(lerp(row.span, this.hash() ** 2) / 2, Math.max(0.05, room)), S: number = second ? twin!.S : Math.min(L * lerp(row.slim, this.hash()) * (shape === 'strip' ? 0.45 : 1), Math.max(0.02, cross));
      const halfT = Math.max(0.004, Math.min(row.thick, cell.h[thin]));
      // (u, v) of a prism across `thin` = the next two axes in order: thin x → (y, z), thin z → (x, y)
      const longFirst = thin === 0 ? vert : !vert;
      if (shape === 'wedge' && !twin) twin = { seed: Math.floor(this.hash() * 0x3fffffff), thin, vert, L, S };
      const ws = twin ? twin.seed : 0; let wi = 0;
      const sb = shapeBox(shape, thin, halfT, L, S, longFirst, row, shape === 'wedge' ? () => hash01(ws + (wi++) * 7919) : this.hash, second); if (second) twin = null;
      const c: Vec3 = [cell.c[0] + (this.hash() - 0.5) * cell.h[0], cell.c[1] + (this.hash() - 0.3) * cell.h[1], cell.c[2] + (this.hash() - 0.5) * cell.h[2]];
      const sp = 1.2 + 2.2 * this.hash(); const v: Vec3 = [out[0] * sp + (this.hash() - 0.5) * 0.8, 0.6 + 1.4 * this.hash(), out[2] * sp + (this.hash() - 0.5) * 0.8];
      const w: Vec3 = [(this.hash() - 0.5) * 9, (this.hash() - 0.5) * 5, (this.hash() - 0.5) * 9];
      const h: Vec3 = sb ? sb.h : (() => { const hh: Vec3 = [S, S, S]; hh[thin] = halfT; hh[vert ? 1 : along] = L; return hh; })();
      const got = this.debris.spawn('chunk', makeBox({ c, h, yaw: cell.yaw, albedo: v3.copy(tinted) }), v, w, who);
      budget.chunks--;
      if (!got) { this.refuse(row, paint, c, v, who); res.refused++; continue; }
      got.box.cut = sb?.cut; if (sb?.cut) got.box.cutCore = faceCore(row, paint); got.box.rough = cell.rough; got.box.metal = cell.metal;
      this.tag(got, mat, 0, paint); res.thrown++;
      if (sb?.cut) { BREAK_STATS.shaped++; BREAK_STATS.planes += sb.cut.length; } else BREAK_STATS.plain++;
    }
    const chipN = Math.round(row.small.n * (this.small() ? BREAKS.smallPoolChipK : 1));
    this.chips(row, paint, cell.c, dir ? v3.normalize(v3.add(out, [0, 0.5, 0])) : [0, 1, 0], chipN, 2.4, Math.max(cell.h[0], cell.h[2]) * 0.6, who);
    this.fines(row, paint, cell.c, dir ? out : [0, 1, 0]);
    if (row.puff > 0) g.destr.cellDust(cell.c, dir ? out : [0, 1, 0], row.puff, surf);   // (a hole is six cells in one frame: what the frame's puff cap holds back waits in the lane's dust queue)
    return res;
  }

  /** THE HEAP: a blast that holed a wall leaves a few slabs of it dealt AT REST at the wall's foot on the far side — overlapping, each tipped a little off flat
   *  with an edge on the floor (pool pieces cannot rest on each other: a pile is dealt, not simulated). `at` = the hole's middle, `from` = the charge (the heap lies on the wall's other side),
   *  `halfW` = half the hole's width along the wall. Pieces of the pool like any other: a later blast kicks them, the pool's eviction crumbles them. */
  heap(surf: Surf, wall: Box, at: Vec3, from: Vec3, halfW: number, who: number = NOBODY_ID, budget?: ShedBudget, as?: Mat): number {
    if (!cutBoxesOn()) return 0;
    const g = this.g; const mat = as ?? SURF_MAT[surf], row = BREAK[mat]; if (!row.cell.length) return 0;
    if (this.look?.on && BREAKS.lookHeap) return 0;   // (somebody's rubble already lies there, cut by this table: not a second set)
    const paint = wall.albedo; const o = wallNormal(wall, [at[0] - from[0], 0, at[2] - from[2]]); const lat: Vec3 = [-o[2], 0, o[0]]; const K = BREAKS.heap; let dealt = 0;
    const face = Math.min(wall.h[0], wall.h[2]);
    const tinted = this.tint(row, paint, BREAKS.coreTint);
    for (let k = 0, n = Math.min(this.share().heap, budget?.heap ?? 99); k < n; k++) {   // (the share is a BLAST's: two walls holed by one charge split it)
      const shape: Shape = mat === 'wood' ? 'snapped' : 'slab';   // (only walls are holed, and those are board; a wooden one would leave boards)
      const L = lerp(K.span, this.hash()) / 2, S = L * lerp(row.slim, this.hash());
      const sb = shapeBox(shape, 1, Math.max(0.004, row.thick), L, S, this.hash() < 0.5, row, this.hash); if (!sb) continue;
      const d = face + lerp(K.out, this.hash()), s = (this.hash() - 0.5) * 2 * Math.max(0.15, halfW) * 0.8;
      const x = at[0] + o[0] * d + lat[0] * s, z = at[2] + o[2] * d + lat[2] * s;
      const yaw = this.hash() * Math.PI * 2, tipA = this.hash() * Math.PI * 2, tip = lerp(K.tip, this.hash());
      const rot = quat.normalize(quat.mul(quat.axisAngle([Math.cos(tipA), 0, Math.sin(tipA)], tip), quat.yaw(yaw)));
      const box = makeBox({ c: [x, 0, z], h: sb.h, yaw, rot, albedo: v3.copy(tinted) });
      // the floor (or the low thing) under it; a spot the hole cannot see along the floor (something solid stands there) is skipped
      const from: Vec3 = [x, 0.5, z]; const st = g.col.raycast(from, [0, -1, 0], 0.6); const ph = g.props.raycast(from, [0, -1, 0], st ? st.t : 0.6);
      const t = ph ? ph.t : st ? st.t : 0.5; if (t < 0.03 || g.col.solidBlocked([at[0], 0.25, at[2]], [x, 0.25, z])) continue;
      if (g.props.raycast([x, 1.7, z], [0, -1, 0], 1.15)) continue;   // (a tall pushable thing stands there: a ray from inside it would have found nothing)
      let low = 0; for (const v of cutVerts(sb.h, sb.cut)) low = Math.min(low, quat.rotate(rot, v)[1]);   // (its lowest CUT corner: a slab tipped onto a torn-off corner still touches)
      box.c[1] = from[1] - t - low + 0.0015; if (budget && budget.heap !== undefined) budget.heap--;
      const got = this.debris.spawnRaw('chunk', box, [0, 0, 0], [0, 0, 0], who); if (!got) { this.refuse(row, paint, box.c, [0, 0.5, 0], who); continue; }
      got.box.cut = sb.cut; if (sb.cut) got.box.cutCore = faceCore(row, paint); got.box.rough = wall.rough; got.box.metal = wall.metal; this.tag(got, mat, 0, paint); got.rest = true; got.sounded = true; if (ph) { got.on = ph.prop; got.onPose = NaN; }
      dealt++; BREAK_STATS.heap++; if (sb.cut) { BREAK_STATS.shaped++; BREAK_STATS.planes += sb.cut.length; } else BREAK_STATS.plain++;
    }
    return dealt;
  }

  // ---------------------------------------------------------------- what still stands
  /** the colour a standing piece's ragged end shows (wallbreak.rebuild sets it beside the cut) */
  endCore(surf: string, paint: Vec3): Vec3 | undefined { const m = SURF_MAT[surf as Surf]; return m ? faceCore(BREAK[m], paint) : undefined; }
  /** The cut record of a standing piece of breakable `B` — the cell rectangle `rect` ([x0, x1, y0, y1, z0, z1], inclusive), half extents `h` — from the faces that
   *  look into opened cells: a RAGGED END each (undefined = square, as it was). Seeded off the breakable and the cell line the face sits on, so the same end keeps
   *  the same break across rebuilds and a checkpoint's reload. The caller assigns the array (a fresh one each time: the static's pack compares identity). */
  ragged(B: CellGrid, rect: readonly number[], h: Vec3): CutPlane[] | undefined {
    if (!cutBoxesOn()) return undefined;
    const row = BREAK[SURF_MAT[B.surf]]; if (!row.ragged) return undefined;
    const [x0, x1, y0, y1, z0, z1] = rect; const { nx, ny, nz } = B;
    const open = (ix: number, iy: number, iz: number) => B.open[(iy * nz + iz) * nx + ix] === 1;
    const faces: OpenFace[] = [];
    const wallLike = ny > 1; const thin = (B.box.h[0] <= B.box.h[2] ? 0 : 2) as 0 | 2;
    if (wallLike && this.look?.on && BREAKS.lookEdges) return undefined;   // (a wall's edges are dressed by somebody's plates, which stand in the standing piece: it stays square under them)
    for (const axis of [0, 2] as const) for (const sign of [-1, 1] as const) {
      const N = axis === 0 ? nx : nz; const i = sign < 0 ? (axis === 0 ? x0 : z0) - 1 : (axis === 0 ? x1 : z1) + 1; if (i < 0 || i >= N) continue;   // (the breakable's own end: its authored face)
      let all = true, upper = true, any = false;
      for (let iy = y0; iy <= y1; iy++) for (let j = axis === 0 ? z0 : x0, j1 = axis === 0 ? z1 : x1; j <= j1; j++) {
        const o = axis === 0 ? open(i, iy, j) : open(j, iy, i);
        if (o) any = true; else { all = false; if (iy > 0) upper = false; }
      }
      if (!any) continue;
      const other = (axis === 0 ? 2 : 0) as 0 | 2; const seed = B.id * 7349 + axis * 131 + (sign > 0 ? 17 : 0) + i * 977;
      const head = wallLike && y1 === ny - 1 ? Math.max(0, B.box.c[1] - B.box.h[1]) + BREAKS.head.from - B.box.c[1] - (B.yb[y0] + B.yb[y1 + 1]) / 2 : undefined;   // (a piece that reaches the wall's top: head height in its own frame)
      if (all) faces.push({ axis, sign, lat: [1, other], seed, head });   // (up the piece first, then across it)
      else if (wallLike && upper && y0 === 0 && y1 > 0) faces.push({ axis, sign, lat: [1], seed, head, lo: B.yb[1] - (B.yb[y0] + B.yb[y1 + 1]) / 2 });   // a full-height column beside a port: only what is above the sill line
    }
    if (y1 < ny - 1) {   // a sill under opened uppers: its top is the broken edge
      let all = true; for (let iz = z0; iz <= z1 && all; iz++) for (let ix = x0; ix <= x1; ix++) if (!open(ix, y1 + 1, iz)) { all = false; break; }
      if (all) faces.push({ axis: 1, sign: 1, lat: thin === 0 ? [2, 0] : [0, 2], seed: B.id * 7349 + 5003 + (thin === 0 ? z0 : x0) * 977 });
    }
    const cut = raggedCut(row, h, faces);
    if (cut) { BREAK_STATS.ragged++; }
    return cut;
  }

  /** THE STUDS of a holed plasterboard partition: one thin metal upright on every column line that has an OPEN upper cell on both sides and a STANDING sill on
   *  both sides — a port more than one column wide keeps its framing, a hole (the sill gone) does not. Read off the cells alone (not off what opened them), so
   *  a checkpoint's reload stands the same studs. Local centres (the breakable's frame) + half extents; [] with the switch off or for any other material. */
  studs(B: CellGrid): { c: Vec3; h: Vec3; albedo: Vec3; rough: number; metal: boolean }[] {
    if (!cutBoxesOn() || B.ny < 2 || SURF_MAT[B.surf] !== 'plasterboard' || B.nOpen === 0) return [];
    const K = BREAKS.stud; const alongX = B.nx > 1 || B.nz === 1 && B.box.h[0] >= B.box.h[2]; const N = alongX ? B.nx : B.nz; const out: { c: Vec3; h: Vec3; albedo: Vec3; rough: number; metal: boolean }[] = [];
    const open = (k: number, iy: number) => B.open[alongX ? (iy * B.nz) * B.nx + k : (iy * B.nz + k) * B.nx] === 1;
    const L = alongX ? B.box.h[0] : B.box.h[2], T = alongX ? B.box.h[2] : B.box.h[0]; const y0 = B.yb[1], y1 = B.yb[B.ny];
    for (let k = 0; k + 1 < N; k++) {
      if (!open(k, 1) || !open(k + 1, 1) || open(k, 0) || open(k + 1, 0)) continue;
      const u = -L + 2 * L * (k + 1) / N; const yl = y0 - K.foot; const c: Vec3 = alongX ? [u, (yl + y1) / 2, 0] : [0, (yl + y1) / 2, u];   // (its foot runs down into the sill: a ragged sill top never leaves it hanging)
      const h: Vec3 = alongX ? [K.half, (y1 - yl) / 2, T * K.depthK] : [T * K.depthK, (y1 - yl) / 2, K.half];
      out.push({ c, h, albedo: K.albedo, rough: K.rough, metal: K.metal });
    }
    return out;
  }

  summary(): string { const s = BREAK_STATS; return `breaks: shaped ${s.shaped} (${s.planes} planes, ${s.dropped} dropped) · plain ${s.plain} · heap ${s.heap} · again ${s.again} · crumbled ${s.crumbled} · refused ${s.refused} · mayhem ${s.mayhem} · ragged ends ${s.ragged} · load ${this.load()}`; }
}
