// Per-light REACH masks: for a static light, which 1 m grid cells of the level it can possibly light — and roughly how much of each —
// decided once on the CPU from the level's full-height walls (2D visibility over the XZ plane), 2 bits a cell. The direct pass skips a
// light at a pixel whose cell it cannot reach (exactly as if evalLight had returned !ok there) and RANKS the rest for its leader slots by
// score × how much of the cell the light sees, so a panel glimpsed through a far doorway no longer outranks the room's own lamp; the
// secondary-vertex loop (directIrradiance) takes the skip.
//
// Why: lights are SCORED unshadowed. In a dark room next to lit ones (the break room with its panels off, beside the cubicle floor and
// the corridor), bright ceiling panels behind the walls out-score the room's own dim fixtures, take the per-pixel leader slots, and push
// the local lights into the one-ray importance-sampled tail — whose pick then usually lands on a walled-off panel (visibility 0), so
// whole regions of floor lose a perfectly visible light, with hard contours where the leader set changes (08-08: red / blue vending
// fronts drawing hard arcs across the break-room floor). A light that provably cannot reach the cell never enters the contest.
//
// What the mask guarantees, and what it does not. Every modelling choice errs toward "reaches" — a false "reaches" only costs what it
// costs today (a score and maybe a ray):
//  * only FULL-HEIGHT static occluders count as walls (bottom ≤ WALL_Y0 and top within 10 cm of the ceiling, shadow-casting, unrotated):
//    furniture, counters, cubicle partitions, sills, headers, door jambs and stops, glazing openings and every door leaf (dynamic) are open ground;
//  * every light not registered by the level build (torches, muzzle flashes, the rail light, dropped torches…) and the moon carry an
//    all-ones mask; the street lamps above the roof line get one over the INTERIOR cells only (they enter the building through its openings,
//    but outdoors they overfly walls a 2D raster would say block them);
//  * the light looks out from several source points (its own position and points pushed out along its facing / around it), the start
//    and end sub-cells of every sight line are ignored (a fixture mounted on a wall sits inside that wall's sub-cell column), and a sight
//    line threading the shared corner of two diagonal wall sub-cells slips through.
// But the receiving cell is SAMPLED, not covered: five looks per 1 m cell (its centre and four corner sub-cells, SUBS, on the 1/16 m
// raster), reached if ANY look sees ANY source point. A light that gets into a cell only across a strip lying between those five points
// is level 0 there — dropped outright by direct / directIrradiance / gloss, a hard cut at that cell's edge. The review (docs/internal/
// review-2026-08-08.md #17) counted 36 such cells over lights × cells with an exact 3D raycast, nearly all dim ceiling panels two doorways
// off (worst ~40 % of the local unshadowed score at three cells by panel_cubicles_11; the beacons 13–18 % of theirs in a blackout). The
// one-cell dilation ring (REACH_OPTS.ring) keeps every one of them at level 1 — but on this level 47 % of each mask's footprint was then
// ring-only 'maybe' cells, a far light pickable in one cell and known-dark in the next, which drew the server racks' green halo as arcs on
// the break-room wall (commit 1170839); so the ring is OFF by default: a deliberate trade of a few dim far-panel slivers for no cell-edge
// arcs. Turning it back on wants the consumer side changed first (level 1 = tail-only, never a leader, in direct.wgsl).
import { WORLD } from '../scene/world';
import { BoxFlag, type Box } from '../scene/boxes';
import { cutConfig } from '../scene/cut';
import type { Vec3 } from '../math/vec';

export const REACH_ROW_WORDS = Math.ceil((WORLD.gridW * WORLD.gridH) / 16);   // u32 words per light: 2 bits per cell (0 = cannot reach · 1..3 = reaches, seen from roughly ¼ · ½+ · all of the cell's looks) → 40 × 28 cells = 70 words
const FINE = 1 / 16;                                                           // sub-cell size for the wall raster / sight lines (6.25 cm: a 12 cm partition stays ~one sub-cell thick instead of swelling to half a metre and pinching every doorway's fan — the review's measured misses at 0.25 m)
const FW = Math.round((WORLD.max[0] - WORLD.min[0]) / FINE), FH = Math.round((WORLD.max[2] - WORLD.min[2]) / FINE);
const SUB = Math.round(WORLD.gridCell / FINE);                                 // sub-cells per grid cell per axis (4)
const WALL_Y0 = 0.45, WALL_Y1 = WORLD.ceilingY - 0.1;                         // an occluder spanning at least this band of heights is a wall to every interior light path (to the ceiling: door jambs, stops and 2.2 m uprights are NOT — light passes over them under the slab)
const SUBS: [number, number][] = [[8, 8], [1, 1], [14, 1], [1, 14], [14, 14]];   // sub-cells looked at per 1 m cell (of the 16 × 16): centre and the four corners — a sample, not a cover: light reaching only a strip between them is missed (header; the ring, when on, catches those as level 1)

/** All-threes row: the mask of a light that may reach anywhere, at full weight (dynamic lights, the moon). */
export const REACH_ALL = (() => { const a = new Uint32Array(REACH_ROW_WORDS); a.fill(0xffffffff); return a; })();

/** A doorway for the raster: the gap runs from `hinge` for `width` metres along `closedDir` (the yaw of the shut leaf, as doors.ts has it). */
export interface ReachDoor { hinge: [number, number]; closedDir: number; width: number }

/** Full-height wall raster over the fine grid: 1 = a wall covers (any part of) this sub-cell, 2 = a doorway's gap (open ground, but light
 *  that only arrives through it is down-ranked: the leaf may well be shut, and even open it is a sliver of the emitter). Built once. */
export function buildWallRaster(statics: Box[], doors: ReachDoor[] = []): Uint8Array {
  const solid = new Uint8Array(FW * FH);
  for (const d of doors) {   // gaps first, walls after (a jamb post inside the gap's end sub-cell stays a wall)
    const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir);   // the shut leaf runs from the hinge along [cos, sin] (doors.ts / level.ts convention)
    for (let s = 0.03; s < d.width; s += FINE / 2) for (let across = -0.16; across <= 0.16; across += FINE / 2) {   // ± the wall's thickness across the gap
      const x = Math.floor((d.hinge[0] + ux * s - uz * across - WORLD.min[0]) / FINE), z = Math.floor((d.hinge[1] + uz * s + ux * across - WORLD.min[2]) / FINE);
      if (x >= 0 && z >= 0 && x < FW && z < FH) solid[z * FW + x] = 2;
    }
  }
  for (const b of statics) {
    if (b.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic | BoxFlag.Glass)) continue;  // invisible to rays / moving / a glass pane (light passes it): open ground
    if (b.cut !== undefined && b.cut.length > 0 && cutConfig.on) continue;        // CUT BOXES (scene/cut.ts): part of it is cut away and rays pass there — open ground, the safe direction (a ray decides)
    if (b.rot || Math.abs(Math.sin(b.yaw ?? 0)) > 1e-6) continue;                  // rotated / yawed (the Rot GPU bit is synthesized at upload, not on Box.flags): its unrotated box would block where it isn't — open ground, the safe direction
    const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1];
    if (y0 > WALL_Y0 || y1 < WALL_Y1) continue;                                    // not floor-to-head-height: light passes over or under it somewhere
    const x0 = Math.floor((b.c[0] - b.h[0] - WORLD.min[0]) / FINE), x1 = Math.floor((b.c[0] + b.h[0] - WORLD.min[0] - 1e-6) / FINE);
    const z0 = Math.floor((b.c[2] - b.h[2] - WORLD.min[2]) / FINE), z1 = Math.floor((b.c[2] + b.h[2] - WORLD.min[2] - 1e-6) / FINE);
    for (let z = Math.max(0, z0); z <= Math.min(FH - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(FW - 1, x1); x++) solid[z * FW + x] = 1;
  }
  return solid;
}

/** How many samples a sight line may step from a sub-cell without missing anything: 1 on and beside a wall or a doorway's gap, more the farther the nearest one is
 *  (the Chebyshev distance d to it in sub-cells, two chamfer passes — exact for that metric; a line advances at most 0.8 sub-cell a sample on either axis, so the
 *  next ceil(1.25 (d - 1)) - 1 samples land within d - 1 sub-cells of this one: all open ground, which a sight line reads and forgets). Kept per raster. */
const JUMPS = new WeakMap<Uint8Array, Uint8Array>();
function jumpsOf(solid: Uint8Array): Uint8Array {
  let j = JUMPS.get(solid); if (j) return j;
  const d = new Uint8Array(FW * FH); const CAP = 200;
  for (let z = 0; z < FH; z++) for (let x = 0, i = z * FW; x < FW; x++, i++) {
    if (solid[i]) { d[i] = 0; continue; }
    let m = CAP;
    if (x > 0 && d[i - 1] < m) m = d[i - 1];
    if (z > 0) { if (d[i - FW] < m) m = d[i - FW]; if (x > 0 && d[i - FW - 1] < m) m = d[i - FW - 1]; if (x < FW - 1 && d[i - FW + 1] < m) m = d[i - FW + 1]; }
    d[i] = m < CAP ? m + 1 : CAP;
  }
  for (let z = FH - 1; z >= 0; z--) for (let x = FW - 1, i = z * FW + x; x >= 0; x--, i--) {
    let m = d[i]; if (!m) continue;
    if (x < FW - 1 && d[i + 1] + 1 < m) m = d[i + 1] + 1;
    if (z < FH - 1) { if (d[i + FW] + 1 < m) m = d[i + FW] + 1; if (x < FW - 1 && d[i + FW + 1] + 1 < m) m = d[i + FW + 1] + 1; if (x > 0 && d[i + FW - 1] + 1 < m) m = d[i + FW - 1] + 1; }
    d[i] = m;
  }
  j = d; for (let i = 0; i < j.length; i++) j[i] = d[i] >= 2 ? Math.ceil(1.25 * (d[i] - 1)) : 1;   // (in place: 200 sub-cells → 249 samples, inside a byte)
  JUMPS.set(solid, j); REACH_WORK.fields++; return j;
}
/** What differs between two wall rasters: the box of sub-cells that changed (null = none), for ReachOnly.boxes. Where walls only OPENED, the old raster's jumps
 *  are still safe on the new one (every distance only grew), so they are handed over instead of being worked out again. */
export function wallRasterDiff(prev: Uint8Array, next: Uint8Array): [number, number, number, number] | null {
  if (prev.length !== next.length) return [0, 0, FW - 1, FH - 1];
  let x0 = FW, z0 = FH, x1 = -1, z1 = -1, closed = false;
  for (let z = 0, i = 0; z < FH; z++) for (let x = 0; x < FW; x++, i++) {
    if (prev[i] === next[i]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    if (next[i] && !prev[i]) closed = true;
  }
  if (x1 < 0) return null;
  const j = JUMPS.get(prev); if (j && !closed) JUMPS.set(next, j);
  return [x0, z0, x1, z1];
}

/** 2D line of sight over the fine raster from the centre of sub-cell (ax, az) to the centre of (bx, bz), ignoring both end sub-cells.
 *  Sampled 1¼ times per sub-cell rather than an exact supercover walk: a sight line that threads the shared corner of two
 *  diagonal wall cells may slip through — that only ever ADDS reach, the safe direction. Samples known to fall on open ground are not taken (`jump`, jumpsOf). */
function sightLine(solid: Uint8Array, jump: Uint8Array, ax: number, az: number, bx: number, bz: number): 0 | 1 | 2 {   // 0 blocked · 2 clear · 1 clear but through a doorway's gap
  const dx = bx - ax, dz = bz - az; const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * 1.25);   // 1¼ looks per sub-cell along the major axis: at 1/16 m the thinnest wall (12 cm) covers two to three sub-cells, so nothing is stepped over; corner-threading slips only ADD reach
  let viaDoor = false, steps = 0;
  for (let s = 1; s < n;) {
    const t = s / n; const x = Math.floor(ax + 0.5 + dx * t), z = Math.floor(az + 0.5 + dz * t); const i = z * FW + x;
    s += jump[i]; steps++;
    if ((x === ax && z === az) || (x === bx && z === bz)) continue;
    const v = solid[i];
    if (v === 1) { REACH_WORK.steps += steps; return 0; }
    if (v === 2) viaDoor = true;
  }
  REACH_WORK.steps += steps;
  return viaDoor ? 1 : 2;
}
/** does the segment between the centres of sub-cells (ax, az) and (bx, bz) touch the box of sub-cells `b` [x0, z0, x1, z1]? (every sample of that sight line, and
 *  its far end, lies on the segment — so a line this says no to reads none of the box's sub-cells) */
function lineTouchesBox(ax: number, az: number, bx: number, bz: number, b: readonly [number, number, number, number]): boolean {
  let t0 = 0, t1 = 1; const E = 1e-6;
  for (let k = 0; k < 2; k++) {
    const o = (k ? az : ax) + 0.5, d = k ? bz - az : bx - ax, lo = (k ? b[1] : b[0]) - E, hi = (k ? b[3] : b[2]) + 1 + E;
    if (d === 0) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const t = a; a = c; c = t; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return false;
  }
  return true;
}

/** The reach mask of a light at `pos` facing `dir` (kind 3 / 1: its normal / axis; anything else: pass [0,0,0]) over the level's cells. */
/** Cells under the ceiling slab (the building's interior footprint), from the level's ceiling-height statics: a light above the roof line is masked only
 *  over these — outdoors it overflies walls the 2D raster would say block it (the review's van roof under the east lamp). */
export function buildInteriorCells(statics: Box[]): Uint8Array {
  const W = WORLD.gridW, H = WORLD.gridH; const inside = new Uint8Array(W * H);
  for (const b of statics) {
    const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1];
    if (!(y0 >= WORLD.ceilingY - 0.25 && y1 <= WORLD.ceilingY + 0.45) || b.h[0] < 0.45 || b.h[2] < 0.45) continue;   // a ceiling / roof slab piece (NoPrimary panels sit just under it and are smaller)
    const x0 = Math.max(0, Math.floor(b.c[0] - b.h[0] - WORLD.min[0])), x1 = Math.min(W - 1, Math.floor(b.c[0] + b.h[0] - WORLD.min[0] - 1e-6));
    const z0 = Math.max(0, Math.floor(b.c[2] - b.h[2] - WORLD.min[2])), z1 = Math.min(H - 1, Math.floor(b.c[2] + b.h[2] - WORLD.min[2] - 1e-6));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) inside[z * W + x] = 1;
  }
  return inside;
}

/** build options (see the level rules below): `ring` = the one-cell dilation of level 1 around every reached cell */
export const REACH_OPTS = { ring: false };   // the ring is OFF, a deliberate trade (header): on, it keeps the few cells the five looks miss (36 dim far-panel slivers by the review's 3D count) at level 1, but 'maybe' cells were 47 % of the masks' footprint and made far lights pickable in one cell and known-dark in the next — arcs on the break-room wall outlining the server racks' halo (1170839). Kept for A/B.
/** does the XZ segment a → b pass within `pad` of the rect [x0, z0, x1, z1]? (slab test on the padded rect; an end inside it counts) */
export function segNearRect(ax: number, az: number, bx: number, bz: number, r: readonly [number, number, number, number], pad: number): boolean {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (let k = 0; k < 2; k++) {
    const o = k ? az : ax, d = k ? dz : dx, lo = (k ? r[1] : r[0]) - pad, hi = (k ? r[3] : r[2]) + pad;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false;
  }
  return true;
}
/** A change limited to some rects of the level (a wall opened there): only the cells whose line to the light passes those rects are decided again, every other
 *  cell keeps its level from `prev` (game.ts reachTick — a whole mask is ~10 ms of sight lines, the cells behind one hole a few dozen). */
/** cells decided by sight lines since the module loaded, and the samples those lines took — the unit of the work (game.ts reachTick paces itself by the steps: a
 *  count, not a clock; a cell is anything from five short lines to twenty-five long ones) */
export const REACH_WORK = { cells: 0, steps: 0, fields: 0 };   // fields: jump fields worked out (one a raster, none for a raster whose walls only opened)
/** How game.ts reachTick paces the masks decided again after a wall changes. `steps` = sight-line steps a frame, a mask too big for one frame's share carried on the
 *  next (60000: over 31 staged blasts on five levels no blast's masks land later than they did a mask at a time; at 40000 five did, by up to ten frames).
 *  `whole` (the page's ?reachpace=old) = the pace before the shares: every mask in one go, one light a frame at least and more until `wholeCells` cells are
 *  decided — fewer, longer ticks. The masks end as the same bits either way; only the frame each lands on differs. */
export const REACH_PACE = { steps: 60000, whole: false, wholeCells: 60 };
export interface ReachOnly { prev: Uint32Array; rects: readonly (readonly [number, number, number, number])[]; /** cells farther than this from the light keep their level too (past its range it lights nothing) */ maxDist?: number;
  /** the wall raster's changed sub-cells, as boxes (wallRasterDiff): given these, a cell is decided again only if one of its OWN sight lines touches one — the same
   *  masks as with `rects` alone (a line that reads no changed sub-cell answers as it did), from far fewer cells when the light stands near the hole */
  boxes?: readonly (readonly [number, number, number, number])[] }
/** the source points every cell of a mask was decided from (reachMaskFor), where that is one set */
const SOURCES = new WeakMap<Uint32Array, string>();
/** was every cell of this mask decided from one set of source points? (then, inside the light's range, it equals a whole re-derive from them on the raster it was last
 *  decided against; in the half metre between the range the game queues a light by and ReachOnly.maxDist a cell may hold an older level — floor the light does not light) */
export function reachOneSource(mask: Uint32Array): boolean { return SOURCES.has(mask); }
/** A mask decided over several calls (reachMaskSome): cells until `budget` sight-line steps are spent each call, where it stood kept in `st` — its source points too, so a light that turns
 *  between calls is still one mask from one set. The caller drops `st` if the raster or the ReachOnly changes under it. */
export interface ReachJob { budget: number; st?: { ci: number; src: [number, number][]; seen: Uint8Array; door: Uint8Array; tried: Uint8Array; centre: Uint8Array; keep: Uint8Array | null } }
export function reachMaskFor(solid: Uint8Array, pos: Vec3, dir: Vec3, radius = 0, interior: Uint8Array | null = null, only?: ReachOnly): Uint32Array {
  return derive(solid, pos, dir, radius, interior, only, null)!;
}
/** reachMaskFor a slice at a time: null until the last cell is decided, then the mask — the same one reachMaskFor returns in one go. */
export function reachMaskSome(solid: Uint8Array, pos: Vec3, dir: Vec3, radius: number, interior: Uint8Array | null, only: ReachOnly | undefined, job: ReachJob): Uint32Array | null {
  return derive(solid, pos, dir, radius, interior, only, job);
}
function derive(solid: Uint8Array, pos: Vec3, dir: Vec3, radius: number, interior: Uint8Array | null, only: ReachOnly | undefined, job: ReachJob | null): Uint32Array | null {
  const mask = new Uint32Array(REACH_ROW_WORDS);
  const onlyPad = 0.75 + Math.max(0.6, radius) + 0.1;   // half a cell's diagonal + the spread of the source points
  const boxRect: [number, number, number, number] = [0, 0, 0, 0];
  const kept = (cx: number, cz: number): boolean => {
    if (!only) return false;
    const x = WORLD.min[0] + (cx + 0.5) * WORLD.gridCell, z = WORLD.min[2] + (cz + 0.5) * WORLD.gridCell;
    if (only.maxDist !== undefined && Math.hypot(x - pos[0], z - pos[2]) > only.maxDist) return true;
    if (lineByLine) {   // line by line: the cell stands unless one of its own sight lines (or looked-at sub-cells: a line's far end) touches a changed sub-cell
      for (const b of only.boxes!) {
        // (first the one wide test the rects' wedge makes — light to cell centre, padded by the sources' spread and the cell's half diagonal: clear of that, every line is)
        boxRect[0] = WORLD.min[0] + b[0] * FINE; boxRect[1] = WORLD.min[2] + b[1] * FINE; boxRect[2] = WORLD.min[0] + (b[2] + 1) * FINE; boxRect[3] = WORLD.min[2] + (b[3] + 1) * FINE;
        if (!segNearRect(pos[0], pos[2], x, z, boxRect, onlyPad)) continue;
        for (let si = 0; si < SUBS.length; si++) { const fx = cx * SUB + SUBS[si][0], fz = cz * SUB + SUBS[si][1];
          for (let k = 0; k < srcCells.length; k++) if (lineTouchesBox(srcCells[k][0], srcCells[k][1], fx, fz, b)) return false; }
      }
      return true;
    }
    for (const r of only.rects) if (segNearRect(pos[0], pos[2], x, z, r, onlyPad)) return false;
    return true;
  };
  const aboveRoof = pos[1] > WORLD.ceilingY;   // a street lamp: only the cells under the ceiling slab are decided by the raster, everything outdoors is level 3
  // source points — the emitter is an AREA, and every point of it can shine through a distant doorway, so the sight lines start from a
  // spread of points, not one: the light itself; for a light with a horizontal facing (wall fixtures, screens, spots) two points 0.3 /
  // 0.6 m out along it (clear of the sub-cell column of the wall it hangs on) and two at ± its radius along its horizontal tangent; for
  // lights facing straight down / up (ceiling panels) or with no facing, a ring of four points max(0.55, radius) around it. A source that
  // falls inside a wall is simply blind (adds nothing); one that falls beyond a thin partition only ever ADDS reach (the safe direction).
  const src: [number, number][] = [[pos[0], pos[2]]];
  const hx = dir[0], hz = dir[2]; const hl = Math.hypot(hx, hz);
  if (hl > 0.3) {
    for (const d of [0.3, 0.6]) src.push([pos[0] + hx / hl * d, pos[2] + hz / hl * d]);
    if (radius > 0.12) { const tx = -hz / hl, tz = hx / hl; for (const s of [-radius, radius]) src.push([pos[0] + tx * s + hx / hl * 0.1, pos[2] + tz * s + hz / hl * 0.1]); }
  } else { const rr = Math.max(0.55, radius); for (const [ox, oz] of [[rr, 0], [-rr, 0], [0, rr], [0, -rr]]) src.push([pos[0] + ox, pos[2] + oz]); }
  const srcCells = job?.st ? job.st.src : src.map(([x, z]) => [Math.floor((x - WORLD.min[0]) / FINE), Math.floor((z - WORLD.min[2]) / FINE)] as [number, number])
    .filter(([x, z]) => x >= 0 && z >= 0 && x < FW && z < FH);
  // the line-by-line wedge needs `prev` to have been decided, every cell of it, from these same source points (a beacon's spot turns: its facing, and so its
  // sources, are another set each time — it takes the rects' wedge, as before)
  const srcKey = srcCells.join(';') + (aboveRoof ? '^' : ''); const lineByLine = !!only && !!only.boxes && SOURCES.get(only.prev) === srcKey;
  const W = WORLD.gridW, H = WORLD.gridH;
  // per cell: how many of its looked-at sub-cells see any source (0..SUBS.length) — the reach bit AND a coarse 'how much of the cell'
  const jump = jumpsOf(solid);
  const st = job?.st ?? { ci: 0, src: srcCells, seen: new Uint8Array(W * H), door: new Uint8Array(W * H), tried: new Uint8Array(W * H), centre: new Uint8Array(W * H), keep: only ? new Uint8Array(W * H) : null };
  const { seen, door, tried, centre, keep } = st; const work0 = REACH_WORK.steps;   // per cell: looks in the clear / only via a doorway / looks attempted at all (sub-cells inside a wall are not attempted) / the CENTRE look sees the light's own point in the clear
  for (let ci = st.ci; ci < W * H; ci++) {
    const cx = ci % W, cz = (ci - cx) / W;
    if (keep && kept(cx, cz)) { keep[ci] = 1; continue; }
    if (job && REACH_WORK.steps - work0 >= job.budget) { st.ci = ci; job.st = st; return null; }   // this call's share is done: the rest next time
    REACH_WORK.cells++;
    let n = 0, nd = 0, nt = 0, cen = 0;
    for (let si = 0; si < SUBS.length; si++) {               // five looks per cell (centre, four corners) — what they miss stays missed unless REACH_OPTS.ring is on (header)
      const [i, j] = SUBS[si];
      const fx = cx * SUB + i, fz = cz * SUB + j;
      if (solid[fz * FW + fx] === 1) continue;                 // inside a wall: nothing to light there (and the end-cell rule must not let a wall's far face count) — NOT a failed look
      nt++;
      let best = 0;
      for (let k = 0; k < srcCells.length; k++) { const [sx, sz] = srcCells[k]; const v = sightLine(solid, jump, sx, sz, fx, fz); if (v > best) { best = v; } if (si === 0 && k === 0 && v === 2) cen = 1; if (best === 2) break; }
      if (best === 2) n++; else if (best === 1) nd++;
    }
    seen[cz * W + cx] = n; door[cz * W + cx] = nd; tried[cz * W + cx] = nt; centre[cz * W + cx] = cen;
  }
  // level per cell, of the looks that COULD be made (a cell half inside a wall recess is judged on its open half — the old rule counted the buried corners as
  // misses and demoted a room's own lights to 'some' along its walls, which the estimator ranks at 0.6: a blob on the break-room floor by the west door):
  // 3 = the centre sees the light itself in the clear, or most looks do (≥ 70 %); 2 = some (≥ 35 %); 1 = a sliver, or only through a doorway (or, with
  // REACH_OPTS.ring, only a neighbour does); 0 = nothing; then pack 2 bits per cell
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const n = seen[cz * W + cx], nt = tried[cz * W + cx];
    const frac = nt > 0 ? n / nt : 0;
    let lv = centre[cz * W + cx] || (n >= 2 && frac >= 0.7) ? 3 : n >= 1 && frac >= 0.35 ? 2 : n >= 1 || door[cz * W + cx] ? 1 : 0;
    if (aboveRoof && !(interior && interior[cz * W + cx])) lv = 3;   // outdoors under a lamp that overflies the walls
    if (!lv && REACH_OPTS.ring) { for (let dz = -1; dz <= 1 && !lv; dz++) for (let dx = -1; dx <= 1 && !lv; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < W && z < H && (seen[z * W + x] || door[z * W + x])) lv = 1; } }
    if (keep && keep[cz * W + cx]) lv = (only!.prev[(cz * W + cx) >> 4] >>> (((cz * W + cx) & 15) * 2)) & 3;
    if (lv) { const ci = cz * W + cx; mask[ci >> 4] |= lv << ((ci & 15) * 2); }
  }
  if (!only || lineByLine) SOURCES.set(mask, srcKey);
  if (job) job.st = undefined;
  return mask;
}

/** Reach mask of a DIRECTIONAL light (the moon; the breach's sun): every cell NOT under the ceiling slab reaches at full weight; a cell under it reaches (level 3)
 *  iff one of its looks — the five sub-cell points of SUBS at floor, desk and head height — has an unblocked 3D path toward the light through the level's
 *  statics (`blocked(from, dirToLight, dist)` is the caller's raycast: the window strips, the fire exit, the lobby's glazing), else 0. Only the ReSTIR estimator
 *  consumes it (lights.ts LightSet.dirMasks): scored unshadowed everywhere, the moon out-draws a dim desk lamp for the fresh candidate on every indoor floor and the
 *  ray then dies in the ceiling — wasted rays, a penumbra hint everywhere, and torch light indoors starving for fresh samples under a daytime sun. Errs toward
 *  'reaches' like the rest (three heights, five points; a strip between them stays dark — the moon through a 10 cm slit). ~1700 cells × ≤ 15 rays, once. */
export function reachMaskForDirectional(dirToLight: Vec3, interior: Uint8Array, blocked: (from: Vec3, dir: Vec3, dist: number) => boolean, only?: ReachOnly): Uint32Array {
  const mask = new Uint32Array(REACH_ROW_WORDS);
  const W = WORLD.gridW, H = WORLD.gridH;
  const heights = [0.05, 0.8, 1.7];
  const up = dirToLight[1];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const ci = cz * W + cx;
    let lv = 0;
    if (!interior[ci]) lv = 3;
    else if (only && !only.rects.some(r => { const x = WORLD.min[0] + (cx + 0.5) * WORLD.gridCell, z = WORLD.min[2] + (cz + 0.5) * WORLD.gridCell, d = up > 0.05 ? Math.min(60, (WORLD.ceilingY + 1.5) / up) : 60;
      return segNearRect(x, z, x + dirToLight[0] * d, z + dirToLight[2] * d, r, 0.85); })) lv = (only.prev[ci >> 4] >>> ((ci & 15) * 2)) & 3;   // its rays toward the light pass none of the changed rects
    else {
      REACH_WORK.cells++;
      out: for (const [i, j] of SUBS) for (const y of heights) {
        const from: Vec3 = [WORLD.min[0] + (cx * SUB + i + 0.5) * FINE, y, WORLD.min[2] + (cz * SUB + j + 0.5) * FINE];
        const dist = up > 0.05 ? Math.min(60, (WORLD.ceilingY + 1.5 - y) / up) : 60;   // nothing static stands above the roof line: once the ray is a metre over the slab it is in the clear
        if (!blocked(from, dirToLight, dist)) { lv = 3; break out; }
      }
    }
    if (lv) mask[ci >> 4] |= lv << ((ci & 15) * 2);
  }
  return mask;
}

/** Level 0..3 of cell ci in a mask (0 = cannot reach). */
export function reachLevel(mask: Uint32Array, ci: number): number { return (mask[ci >> 4] >>> ((ci & 15) * 2)) & 3; }

/** Fraction of the level's cells a mask reaches at all (for the panel / logs). */
export function reachFraction(mask: Uint32Array): number {
  let n = 0; for (let ci = 0; ci < WORLD.gridW * WORLD.gridH; ci++) if (reachLevel(mask, ci)) n++;
  return n / (WORLD.gridW * WORLD.gridH);
}
