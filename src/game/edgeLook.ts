// EDGE LOOK — what a broken wall LOOKS like where it broke (the destruction goal's look pass: "a breach has ragged edges, rubble and scorch"). wallbreak.ts opens
// whole 0.5 m columns, so a hole or a port is drawn as a razor-straight, full-height cut with nothing at its foot. This module dresses that cut and changes
// NOTHING ELSE: the hole's real shape — the statics every ray, foot, sound path, nav cell, reach mask and smoke obstacle reads — is exactly wallbreak's.
//
// WHAT IS DRAWN (all of it `Dynamic` boxes keyed MKEY.look, handed to the frame's dynamic list like the moths: rasterised and lit, never in the collision
// lists, the nav grid, the reach masks or the smoke's obstacles — a round, an eye and a boot pass through every piece — and never met by the CPU's world ray
// (BoxWorld.raycast passes the key: the cursor's aim, an order's point, a laser's dot and a tripwire's beam land behind it, where the round goes). `NoShadow`
// as well, so no ray of light meets them either — but for the pieces that cast the shadow they draw under the cut switch: the full-thickness edge coat, the
// lintel, and the loose fragments 30 cm long and up that lie in no tripwire's line):
//   EDGES    every straight cut between a standing part and an open one (a port's two sides, a hole's sides low and high, the top of the sill a port leaves)
//            becomes ONE BROKEN LINE: control points standing far, near, far out of the cut, each stretch between two of them a plate of the wall's own sheet
//            whose outer side is that stretch and whose body runs back into the standing wall. A second, paler and thinner coat (the core) stands proud of the
//            paint here and there. On a HOLE the line reaches further in toward the top, so the gap narrows overhead: a breach under a ragged arch, not a slot.
//   LINTEL   an opening in a wall whose upper cell is at least 1.1 m tall need not run to the wall top: a band of the wall's own sheet is left across it (a
//            ragged underside) — picture only like the rest: a round, an eye and a thrown can still pass where it hangs, the opening's real top is the wall's.
//   HEADER   without a lintel: what still hangs from the wall top over a port, in uneven lengths; the TOP TRACK of the partition (a thin grey rail) straight
//            across a port, snapped and hanging from either side over a hole; a STUD left standing in a port fire chewed, bent stubs by the sides of a hole.
//   RUBBLE   board fragments at the wall's foot in the wall's own colours (paint, core, backing paper), most of them on the side the round / the blast drove
//            them to. On the frame it happens they fall from the cell that went (a short analytic arc — no contact, no sound, no event); on a checkpoint's load
//            they simply lie there.
//   SCORCH   round a BLAST's gap: soot on both faces of the wall about the opening and on the floor at its foot (four 'scorch' decals a blast-holed wall — the
//            decal ring is picture only), and the rubble a blast throws is sooted.
//
// THE RULE IT KEEPS (the look pass's hard rule): no value is taken from the lane's hash counters (every choice here hashes the breakable's index and the
// piece's own place — a look that drew from wallbreak's or destruction's counter would shift every later choice of theirs); nothing goes into the lane's debris
// pool (a chunk landing there is HEARD); no rate cap, puff or event is touched; col.raycast is READ (where rubble may come to rest) and nothing is written.
// Everything is rebuilt from wallbreak's own cells, so a reset drops it, and a checkpoint's load re-derives it (rubble at rest) — nothing here is saved but the soot's four marks, which ride the decal ring's slice.
// BOUNDED: ≤ EDGE.maxDecor standing pieces, ≤ EDGE.maxRubble fragments (the oldest go first), and both together never past what the frame's box budget has
// left. It rides the destruction switch: wallbreak calls `opened` only when a wall really opened.
import { Vec3, v3, quat, Quat } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import { cutBoxesOn } from '../scene/cut';
import { WORLD } from '../scene/world';
import type { Game } from './game';
import { hash01 } from './debris';
import type { Chunk, FootBook, FootMan, FootKnobs } from './debris';
import { lookDecal } from './lookDecals';

export const EDGE = {
  on: true,
  /** caps: standing pieces (shards, headers, rails, studs) over the whole level, per breakable, and rubble fragments */
  maxDecor: 480, perWall: 150, maxRubble: 520,
  /** the frame's box list must keep this many rows free after ours (BoxWorld throws past WORLD.maxBoxes) */
  boxSlack: 160,
  /** m: how far a shard's corner stands into a port / low in a hole / at the top of a hole; × the open run's width as the bound */
  portOut: 0.25, holeOut: 0.12, holeTop: 0.6, sillHole: 0.26, sillPort: 0.14, runK: 0.27,
  /** m: how deep the lintel left over a port / a hole hangs from the wall top (× 0.75‥1.25, ≤ 0.3 of the upper cell; under a ceiling at least lintelCut, to 7 cm more), and how many ports in one keep one */
  lintelPort: 0.42, lintelHole: 0.44, lintelOdds: 0.85, lintelCut: 0.52,
  /** fragments per opened upper cell / sill cell / cover cell; cells shed a frame from the frame after a wall is dressed (0 = everything on the frame it opens) */
  perUpper: 9, perSill: 6, perCover: 2, spread: 4,
  /** m: how far from the wall line rubble comes to rest (fire / blast) */
  throwFire: 0.8, throwBlast: 0.9,
  /** a BLAST's rubble: × the fragments a cell sheds, the share of them that are chunks of wall (the rest board flakes), the share of chunks that are big slabs
   *  and how much bigger, the share flung well into the room (to throwBlast × 1.2‥2.8), how far the heap on the charge's own face spreads against the far one,
   *  and how much thicker a blast's flakes lie than a round's */
  blast: { more: 2, lumps: 0.62, slabs: 0.3, slabK: 1.7, flung: 0.1, nearK: 0.7, flakeK: 2 },
  /** THE CUT SWITCH, a blast's heap at a wall's foot (nothing of it with the switch off): the share of fragments that are big SLABS of the wall's sheet (half
   *  length m; never thicker than `slabT`), the share of chunks made SMALL (× that), each piece's own tone (albedo down by up to `tone`), and its broken faces:
   *  up to `corePaper` of the facing paper's brown in the core colour, down by up to `coreTone`, and sooted with the piece */
  cutHeap: { slabs: 0.07, slab: [0.15, 0.34] as [number, number], slabT: 0.03, smalls: 0.42, small: [0.35, 0.6] as [number, number], tone: 0.22, corePaper: 0.45, coreTone: 0.3 },
  /** scorch round a blast's gap: radius past the gap's half width on the blast face / the far face, and on the floor; soot 0‥1 (the floor's: wide and thin, × sootFloor);
   *  rim = the radius of the marks laid ON the cut at each end of the open sills and of the open uppers (0 = none: the two discs alone, whose dense part falls in the hole), × sootRim */
  scorch: { near: 1.3, far: 1.0, floor: 1.3, sootNear: 1, sootFar: 0.75, sootFloor: 0.5, rim: 0.95, sootRim: 0.85 },
  /** the soot as marks in the decal ring per wall a charge HOLES — four, and the rim's (true), or only as darkened edge pieces and rubble (false). The ring is picture only, and
   *  all are TAGGED (lookDecals.ts) so game/digest.ts, which counts the ring, counts only the marks play lays: a run's digest is its base's either way.
   *  Like any mark they ride a checkpoint's decal slice (savestate.ts files the tag and puts it back) and advance the ring's look seeds; in a full ring they go
   *  before any mark play laid and never push one out (render/decals.ts `look`), so the untagged count is the base's past 512 marks too. */
  scorchDecals: true,
};
export const EDGE_STATS = { decor: 0, rubble: 0, flying: 0, scorch: 0, shed: 0, capped: 0, rebuilds: 0 };

/** what this module reads of wallbreak's Breakable (handed over by its one hook — nothing here writes to it) */
export interface BreakLike { id: number; kind: 'wall' | 'cover'; surf: string; box: Box; nx: number; ny: number; nz: number; yb: number[]; open: Uint8Array }

const MKEY_LOOK = MKEY.look;   // (scene/boxes.ts MKEY: a resting piece keeps its motion history when the dynamic list shifts under it — and the key is what keeps every piece out of the CPU's world ray)
const STEEL: Vec3 = [0.5, 0.52, 0.54], CORE: Vec3 = [0.8, 0.79, 0.75], PAPER: Vec3 = [0.52, 0.47, 0.39];
const UP: Vec3 = [0, 1, 0];
interface Rubble { box: Box; t: number; T: number; p0: Vec3; p1: Vec3; vy: number; q0: Quat; q1: Quat; /** kicked rubble only (feet below): its record for the boots, made when a man first comes near it at rest */ foot?: Chunk }
/** the wall's own frame: u along it, y up (world), v across it */
interface Frame { b: Box; alongX: boolean; cs: number; sn: number; T: number; L: number; N: number; w: number; y0: number; yTop: number; ySill: number; along: Vec3; nrm: Vec3 }

export class EdgeLook {
  private decor = new Map<number, Box[]>(); private dirty = new Map<number, BreakLike>();
  private rubble: Rubble[] = []; private flying = 0; private serial = 0; private room = 1e9;
  /** walls a charge opened: where along the wall (u, half width) — the edge pieces there are sooted. Not saved: a load re-derives the pieces clean */
  private blasted = new Map<number, [number, number][]>();
  constructor(private g: Game) {}

  // ---------------------------------------------------------------- the hook (wallbreak.ts openCells)
  /** Cells `fresh` of B have just opened (cause as the feed files it; `dir` = the way the round travelled / from the blast to the wall, null on a load; quiet =
   *  a checkpoint being applied: nothing flies, nothing is scorched again). */
  opened(B: BreakLike, fresh: number[], cause: string, dir: Vec3 | null, quiet: boolean) {
    if (!EDGE.on) return;
    try { this.dress(B, fresh, cause, dir, quiet); } catch (e) { this.fail(e); }   // (the picture never costs play a frame: wallbreak's own work goes on)
  }
  private fail(e: unknown) { EDGE.on = false; this.clear(); console.error('edge look switched off:', e); }
  /** THE FRAME A WALL GOES is the lane's dearest (reactions, sight tests, the reach masks): of the look only the soot's record and its marks land on it.
   *  The wall is dressed on the next frame and its rubble shed `EDGE.spread` cells a frame after that. A checkpoint being applied does it all at once. */
  private dress(B: BreakLike, fresh: number[], cause: string, dir: Vec3 | null, quiet: boolean) {
    if (B.kind === 'wall') this.dirty.set(B.id, B);
    const F = B.kind === 'wall' ? this.frame(B) : null; const blast = cause === 'blast';
    if (quiet || EDGE.spread <= 0) { for (const c of fresh) this.shed(B, F, c, dir, quiet, blast); this.cap(); }
    else { const d = dir ? v3.copy(dir) : null; for (const c of fresh) this.todo.push({ B, F, c, dir: d, blast }); this.held = true; }
    if (F && blast && !quiet) this.scorch(B, F, fresh, dir);
  }
  private cap() {
    while (this.rubble.length > EDGE.maxRubble) { const r = this.rubble.shift()!; if (r.t < r.T) this.flying--; EDGE_STATS.capped++; }
    EDGE_STATS.rubble = this.rubble.length;
  }
  private todo: { B: BreakLike; F: Frame | null; c: number; dir: Vec3 | null; blast: boolean }[] = []; private held = false;
  /** the level put back (Destruction.reset) */
  clear() { this.decor.clear(); this.dirty.clear(); this.blasted.clear(); this.todo.length = 0; this.held = false; this.rubble.length = 0; this.flying = 0; this.serial = 0; this.footBook = { shoves: 0, stats: { kicked: 0, offMan: 0, walled: 0, gaveUp: 0 } }; EDGE_STATS.decor = EDGE_STATS.rubble = EDGE_STATS.flying = 0; }

  // ---------------------------------------------------------------- per frame
  update(dt: number) {
    // what the frame's box list can still take: last frame's dynamics less ours (g.dynBoxes still holds last frame's list here — the PICTURE's under fog of war, which
    // can be longer than the game's own count by the things it remembers: the larger of the two is budgeted by)
    const world = this.g.engine.world as { maxBoxes?: number; statics?: unknown[] } | undefined;
    if (world && typeof world.maxBoxes === 'number' && Array.isArray(world.statics)) this.room = world.maxBoxes - world.statics.length - Math.max(0, Math.max(this.g.dynRaw, this.g.dynBoxes.length) - this.last) - EDGE.boxSlack;
    if (!this.held) try {
      if (this.dirty.size) this.flush();
      else if (this.todo.length) { for (const q of this.todo.splice(0, Math.max(1, EDGE.spread | 0))) this.shed(q.B, q.F, q.c, q.dir, false, q.blast); this.cap(); }
    } catch (e) { this.fail(e); }
    if (!this.flying) return;
    let fl = 0;
    for (const r of this.rubble) {
      if (r.t >= r.T) continue;
      r.t = Math.min(r.T, r.t + dt); const s = r.t / r.T, b = r.box;
      b.c[0] = r.p0[0] + (r.p1[0] - r.p0[0]) * s; b.c[2] = r.p0[2] + (r.p1[2] - r.p0[2]) * s; b.c[1] = s >= 1 ? r.p1[1] : Math.max(r.p1[1], r.p0[1] + r.vy * r.t - 4.9 * r.t * r.t);
      b.rot = s >= 1 ? r.q1 : quat.slerp(r.q0, r.q1, s * s);
      if (s < 1) fl++;
    }
    this.flying = fl; EDGE_STATS.flying = fl;
  }
  private last = 0;
  /** KICKED RUBBLE (game/destruction.ts, once a frame while RUBBLE.on — off, never called and nothing here differs): the fragments AT REST are shoved by the men's
   *  feet exactly as the pool's pieces are (Debris.feet over records of our own boxes, Debris.footStep sliding them: the floor they lie on, the walls, the
   *  furniture). Picture only, as everything here: no slot, no event, no sound but the boots' scuff; a fragment high on the heap, or a slab heavier than a boot
   *  shifts, lies where it fell. A record is made the first time a man comes within a stride and a half of a fragment at rest. */
  /** the boots' books for our fragments (Debris.feet's FootBook): our own shove count and counts, so the pool's pieces draw what they would with this look off */
  footBook: FootBook = { shoves: 0, stats: { kicked: 0, offMan: 0, walled: 0, gaveUp: 0 } };
  feet(men: readonly FootMan[], K: FootKnobs, dt: number) {
    if (!this.rubble.length) return;
    const D = this.g.destr.debris; const list: Chunk[] = [];
    for (const r of this.rubble) {
      if (r.t < r.T) continue;
      if (!r.foot) { const c = r.box.c; let near = false; for (const m of men) if (Math.abs(m.pos[0] - c[0]) < 1.5 && Math.abs(m.pos[2] - c[2]) < 1.5) { near = true; break; } if (!near) continue; r.foot = D.loose(r.box, 0.0007 * (((r.box.mkey ?? 0) & 0x7fffff) % 11)); }   // (its own height once a boot lays it flat: as shed the heap's flakes are staggered, so no two overlapping tops lie in one plane)
      list.push(r.foot);
    }
    if (!list.length) return;
    D.feet(men, K, list, this.footBook);
    for (const c of list) { const slid = !c.rest; D.footStep(c, dt);
      // a slab that casts a shadow and was slid to a tripwire's beam casts none from here on (shed()'s rule, kept true under the boots: a beam ends at the first shadow caster)
      if (slid && !(c.box.flags & BoxFlag.NoShadow) && this.inBeam(c.box.c, Math.max(c.box.h[0], c.box.h[2]))) c.box.flags |= BoxFlag.NoShadow; }
  }
  private flush() { if (!this.dirty.size) return; for (const B of this.dirty.values()) this.rebuild(B); this.dirty.clear(); let n = 0; for (const l of this.decor.values()) n += l.length; EDGE_STATS.decor = n; }
  /** our pieces into the frame's dynamic list (after the lane's debris) */
  boxes(out: Box[]) {
    if (this.held) this.held = false; else try { this.flush(); } catch (e) { this.fail(e); }   // (a wall that opened this frame is dressed on the next: `dress`)
    let room = this.room, n = 0;
    for (const l of this.decor.values()) for (const b of l) { if (n >= room) break; out.push(b); n++; }
    for (let i = this.rubble.length - 1; i >= 0 && n < room; i--) { out.push(this.rubble[i].box); n++; }   // (newest first: what a short frame drops is the oldest litter)
    this.last = n;
  }

  // ---------------------------------------------------------------- geometry
  private frame(B: BreakLike): Frame {
    const b = B.box; const alongX = B.nx > 1 || b.h[0] >= b.h[2]; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const N = alongX ? B.nx : B.nz, L = 2 * (alongX ? b.h[0] : b.h[2]);
    return { b, alongX, cs, sn, T: alongX ? b.h[2] : b.h[0], L, N, w: L / N, y0: b.c[1] - b.h[1], yTop: b.c[1] + b.h[1], ySill: b.c[1] + B.yb[1],
      along: alongX ? [cs, 0, -sn] : [sn, 0, cs], nrm: alongX ? [sn, 0, cs] : [cs, 0, -sn] };
  }
  private at(F: Frame, u: number, y: number, v: number): Vec3 { return [F.b.c[0] + F.along[0] * u + F.nrm[0] * v, y, F.b.c[2] + F.along[2] * u + F.nrm[2] * v]; }
  /** a plate in the wall's plane: half extents a (along its own long axis) × hb × ht (through the wall), turned `th` in the plane, centred (u, y), v across */
  private plate(F: Frame, u: number, y: number, v: number, a: number, hb: number, ht: number, th: number, albedo: Vec3, key: number, solid = false): Box {
    const c = Math.cos(th), s = Math.sin(th);
    const e1: Vec3 = [F.along[0] * c, s, F.along[2] * c], e2: Vec3 = [-F.along[0] * s, c, -F.along[2] * s], e3 = v3.cross(e1, e2);
    return makeBox({ c: this.at(F, u, y, v), h: [a, hb, ht], yaw: F.b.yaw, rot: quat.fromBasis(e1, e2, e3), albedo, flags: BoxFlag.Dynamic | (solid ? 0 : BoxFlag.NoShadow), name: 'edge', mkey: MKEY_LOOK + (key & 0x7fffff), rough: F.b.rough });
  }

  // ---------------------------------------------------------------- the standing pieces of one wall
  private rebuild(B: BreakLike) {
    EDGE_STATS.rebuilds++;
    const F = this.frame(B); const out: Box[] = []; const { N, w, T } = F;
    const cap = EDGE.perWall;
    const real = cutBoxesOn();   // the cut switch: the full-thickness coat and the lintel cast the shadow they draw (the standing piece under them stays square: breakTable.ts)
    const open = (k: number, iy: number) => k >= 0 && k < N && B.open[(iy * B.nz + (F.alongX ? 0 : k)) * B.nx + (F.alongX ? k : 0)] === 1;
    const gone = (k: number, iy: number) => k < 0 || k >= N || open(k, iy);   // (nothing of THIS wall to bury a plate in: open, or past the wall's end)
    const edgeU = (k: number) => -F.L / 2 + w * k;   // the boundary on the low side of column k
    const H = (a: number, b2: number, c = 0) => hash01(Math.imul(B.id + 1, 73856093) ^ Math.imul(a + 7, 19349663) ^ Math.imul(b2 + 3, 83492791) ^ Math.imul(c + 11, 2654435761));
    const paint = B.box.albedo, core = v3.lerp(paint, CORE, 0.82); let key = (B.id & 0x3fff) << 9;
    const push = (b: Box | null) => { if (b && out.length < cap) out.push(b); else if (b) EDGE_STATS.capped++; };
    const FRAME: Vec3 = B.surf === 'wood' ? v3.scale(paint, 0.8) : STEEL;   // what the wall is framed with
    const bl = this.blasted.get(B.id);   // (a charge's gap: what stands round it is sooted, heaviest at the gap)
    const tone = (c: Vec3, u: number): Vec3 => { if (!bl) return c; let x = 1; for (const [uc, half] of bl) x = Math.min(x, Math.max(0, (Math.abs(u - uc) - half * 0.5) / (half * 0.5 + (EDGE.scorch.rim || 0.9)))); return x >= 1 ? c : v3.scale(c, 0.4 + 0.6 * x * x * (3 - 2 * x)); };
    // A RAGGED EDGE as one broken line: control points standing d out of the straight cut (far, near, far … so it never settles into a zip), each stretch between two
    // of them ONE plate whose outer side is that stretch and whose body runs back into the standing wall where nothing sees it. (ax, ay) → (bx, by) = the cut in the
    // wall's plane (u along, y up), (nx, ny) = unit normal into the opening, reach(0‥1) = how far a point may stand out, bury = standing wall behind the cut,
    // pastA / pastB = how much standing wall lies past each end for a plate's body to lean into (0 = none: the wall's top, its end, an open neighbour). Two
    // coats: the painted face, and a paler core proud of it here and there
    const ragged = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, reach: (t: number) => number, bury: number, pastA: number, pastB: number, tag: number) => {
      const len = Math.hypot(bx - ax, by - ay); if (len < 0.12) return; const ex = (bx - ax) / len, ey = (by - ay) / len;
      for (let coat = 0; coat < 2; coat++) {
        const ts: number[] = [0], ds: number[] = []; const st0 = coat ? 0.2 : 0.24, st1 = coat ? 0.32 : 0.34;
        for (let t = 0, i = 0; i < 14; i++) { const st = st0 + st1 * H(tag, i, 30 + coat); if (len - t - st < st0 * 0.7) break; t += st; ts.push(t); }
        ts.push(len);
        const par = H(tag, 99, coat) < 0.5 ? 0 : 1;
        for (let j = 0; j < ts.length; j++) {
          const r = Math.min(reach(ts[j] / len), bury * 0.8) * (coat ? 1.12 : 1) + (coat ? 0.012 : 0);
          ds.push(Math.max(0.012, r * ((j + par) % 2 === 0 ? 0.55 + 0.5 * H(tag, j, 40 + coat) : 0.04 + 0.3 * H(tag, j, 50 + coat))));
        }
        // a plate's body leans past the end of its stretch that stands further out: by a hard end that lean has to fit in what is left of the edge
        for (let pass = 0; pass < 2; pass++) for (let j = 0; j + 1 < ts.length; j++) {
          const dt = ts[j + 1] - ts[j], up = ds[j + 1] > ds[j], room = up ? len - ts[j + 1] + pastB : ts[j] + pastA;
          const dmax = Math.max(ds[j], ds[j + 1]), dmin = Math.min(ds[j], ds[j + 1]), most = room * dt / (dmax + 0.015);
          if (dmax - dmin > most) { if (up) ds[j + 1] = dmin + most; else ds[j] = dmin + most; }
        }
        for (let j = 0; j + 1 < ts.length; j++) {
          const dt = ts[j + 1] - ts[j], dd = ds[j + 1] - ds[j], ls = Math.hypot(dt, dd), dmax = Math.max(ds[j], ds[j + 1]);
          const gx = (ex * dt + nx * dd) / ls, gy = (ey * dt + ny * dd) / ls, mx = -(nx * dt - ex * dd) / ls, my = -(ny * dt - ey * dd) / ls;   // along the stretch; into the wall
          const D = (dmax + 0.015) * ls / dt, e0 = j === 0 && pastA <= 0 ? 0 : 0.012, e1 = j + 2 === ts.length && pastB <= 0 ? 0 : 0.012;
          const cu = ax + ex * (ts[j] + dt / 2) + nx * (ds[j] + dd / 2) + gx * (e1 - e0) / 2 + mx * D / 2, cy = ay + ey * (ts[j] + dt / 2) + ny * (ds[j] + dd / 2) + gy * (e1 - e0) / 2 + my * D / 2;
          push(this.plate(F, cu, cy, 0, (ls + e0 + e1) / 2, D / 2, (coat ? T * 0.5 : T - 0.003) - 0.0007 * (j % 3), Math.atan2(gy, gx), tone(coat ? core : paint, cu), key++, real && !coat));
        }
      }
    };
    /** standing wall of this level past column j going `s` (m, a little short of it; 0 = open there, or the wall's end) */
    const past = (j: number, s: number, iy: number) => { let n = 0; for (; !gone(j, iy) && n < 2; j += s) n++; return n * w * 0.88; };
    /** standing wall behind an edge at level iy, from column ke away from the opening (m, a little short of it) */
    const behind = (ke: number, s: number, iy: number) => { let n = 0; for (let j = ke; j >= 0 && j < N && !open(j, iy) && n < 2; j -= s) n++; return Math.min(0.85, n * w * 0.88); };
    const top = F.yTop - 0.004, span = F.yTop - F.ySill;
    // runs of open SILL cells: the lower sides of a hole, and a bent stub of the frame by each (first: what a cap drops is then the fringe of the last run, never a hole's whole foot)
    for (let k = 0; k < N; k++) {
      if (!open(k, 0) || open(k - 1, 0)) continue;
      let k1 = k; while (open(k1 + 1, 0)) k1++;
      const ua = edgeU(k), ub = edgeU(k1 + 1), runW = ub - ua;
      for (const [ke, ue, s] of [[k - 1, ua, 1], [k1 + 1, ub, -1]] as [number, number, number][]) {
        if (ke < 0 || ke >= N) continue;
        const r = Math.min(EDGE.holeOut * 1.5, runW * EDGE.runK * 0.6);
        ragged(ue, F.y0, ue, F.ySill, s, 0, () => r, behind(ke, s, 0), 9, open(ke, 1) ? 0 : 0.9, ke * 8 + (s > 0 ? 3 : 4));
        if (H(ke, 160, s + 2) < 0.7) { const hgt = 0.16 + 0.3 * H(ke, 161, s + 2), th = s * (0.25 + 0.5 * H(ke, 162, s + 2)), ub2 = ue + s * (0.02 + 0.06 * H(ke, 163, s + 2));
          push(this.plate(F, ub2 + Math.sin(th) * hgt / 2, Math.max(F.y0, 0) + Math.cos(th) * hgt / 2, (H(ke, 164) - 0.5) * T, 0.018, hgt / 2, 0.018, -th, FRAME, key++)); }
      }
    }
    // runs of open UPPER cells (a port, or the upper half of a hole)
    for (let k = 0; k < N; k++) {
      if (!open(k, 1) || open(k - 1, 1)) continue;
      let k1 = k; while (open(k1 + 1, 1)) k1++;
      const ua = edgeU(k), ub = edgeU(k1 + 1), runW = ub - ua; let holes = 0; for (let j = k; j <= k1; j++) if (open(j, 0)) holes++;
      const isHole = holes > 0, wide = runW * EDGE.runK;
      // THE LINTEL: the top of the wall still spans the opening (a band of its sheet, torn along its underside), so a port reads as a hole IN the wall and a
      // breach as a gap under what is left overhead — not a slot ruled to the wall top. Like everything here it is picture: a round or an eye at that height
      // passes through it. Not on a low wall, and one port in a few is left open to the top
      // (a wall top flush under the ceiling is drawn as a SECTION CUT, flat and pale, and only for a box that reaches half a metre down from it — gbuffer.wgsl; a
      // shallower lintel there showed its top as a black bar across the pale cut, so under the ceiling it hangs that deep)
      const flush = span >= 1.3 && top >= WORLD.ceilingY - 0.03;   // under the ceiling only a deep lintel reads from above: a bare rail up there is a dark bar
      let lin = span >= 1.1 && (isHole || flush || H(k, 170) < EDGE.lintelOdds) ? Math.min(span * 0.3, (isHole ? EDGE.lintelHole : EDGE.lintelPort) * (0.75 + 0.5 * H(k, 171))) : 0;
      if (flush) lin = Math.max(lin, EDGE.lintelCut + 0.07 * H(k, 172));
      const yL = F.yTop - lin;
      if (lin) {
        for (let j = k; j <= k1; j++) { const xa = j === k && !gone(j - 1, 1) ? 0.02 : 0, xb = j === k1 && !gone(j + 1, 1) ? 0.02 : 0, uc = edgeU(j) + w / 2;
          push(this.plate(F, uc + (xb - xa) / 2, (yL + top) / 2, 0, (w + xa + xb) / 2, (top - yL) / 2, T - 0.0035, 0, tone(paint, uc), key++, real)); }
        const r = Math.min(isHole ? EDGE.sillHole : EDGE.sillPort, lin * 0.7);
        ragged(ua, yL, ub, yL, 0, -1, () => r, lin, past(k - 1, -1, 1), past(k1 + 1, 1, 1), k * 8 + 6);
      }
      // the two sides (only against a standing column of this wall: a run that reaches the wall's end meets whatever the level put there). A hole's upper corners
      // are left hanging in: it reads as a breach with a ragged arch, not a slot cut to the wall top
      for (const [ke, ue, s] of [[k - 1, ua, 1], [k1 + 1, ub, -1]] as [number, number, number][]) {
        if (ke < 0 || ke >= N) continue;
        const lo = Math.min(isHole ? EDGE.holeOut : EDGE.portOut * 0.7, wide), hi = Math.min(isHole ? EDGE.holeTop : EDGE.portOut * 1.3, wide);
        ragged(ue, F.ySill, ue, lin ? yL + lin * 0.5 : top, s, 0, t => lo + (hi - lo) * Math.pow(Math.max(0, t - 0.3) / 0.7, 1.5), behind(ke, s, 1), open(ke, 0) ? 0 : 0.6, 0, ke * 8 + (s > 0 ? 1 : 2));
      }
      // the torn tops of the sills left under it, run by run
      for (let j = k; j <= k1; j++) {
        if (open(j, 0) || (j > k && !open(j - 1, 0))) continue;
        let j1 = j; while (j1 < k1 && !open(j1 + 1, 0)) j1++;
        const r = Math.min(isHole ? EDGE.sillHole : EDGE.sillPort, span * 0.3);
        ragged(edgeU(j), F.ySill, edgeU(j1 + 1), F.ySill, 0, 1, () => r, 0.6, past(j - 1, -1, 0), past(j1 + 1, 1, 0), j * 8 + 5);
      }
      // with no lintel, the top track: straight across a port, snapped and hanging from either side over a hole
      const ty = F.yTop - 0.022, tt = Math.min(T * 0.6, 0.022);
      if (lin) { /* (inside the lintel) */ } else if (!isHole) { const xa = k > 0 ? 0.03 : 0, xb = k1 < N - 1 ? 0.03 : 0; push(this.plate(F, (ua + ub + xb - xa) / 2, ty, 0, (runW + xa + xb) / 2, 0.018, tt, 0, tone(FRAME, (ua + ub) / 2), key++)); }
      else for (const [ke, ue, s] of [[k - 1, ua, 1], [k1 + 1, ub, -1]] as [number, number, number][]) {
        if (ke < 0 || ke >= N) continue;
        const len = Math.min(0.7, runW * (0.2 + 0.2 * H(ke, 31, s + 2))), phi = 0.3 + 0.7 * H(ke, 32, s + 2);
        push(this.plate(F, ue + s * (len / 2) * Math.cos(phi), ty - (len / 2) * Math.sin(phi), (H(ke, 33) - 0.5) * T * 0.6, len / 2, 0.016, tt, -s * phi, tone(FRAME, ue), key++));
      }
      // per column of a port: what still hangs from the top, a stud fire left standing
      for (let j = k; j <= k1; j++) {
        if (open(j, 0)) continue;
        const u0 = edgeU(j);
        if (!isHole && !lin) for (let i = 0, u = u0 + 0.02 + 0.12 * H(j, 39); u < u0 + w - 0.06 && i < 3; i++) {   // (uneven lengths of board, square to the top so nothing shows above it)
          const ww = Math.min(u0 + w - u, 0.09 + 0.17 * H(j, 40 + i)), d = 0.04 + 0.5 * Math.pow(H(j, 50 + i), 2.2);
          push(this.plate(F, u + ww / 2, top - d / 2, 0, ww / 2, d / 2, (H(j, 70 + i) < 0.65 ? T - 0.004 : T * 0.5) - 0.0007 * i, 0, H(j, 70 + i) < 0.65 ? paint : core, key++));
          u += ww * (0.9 + 1.3 * H(j, 80 + i));
        }
        if (H(j, 150) < (isHole ? 0.3 : 0.55)) {   // a stud: whole, or snapped with its top hanging
          const us = u0 + w * (0.25 + 0.5 * H(j, 151)), snap = isHole || H(j, 152) < 0.5, hs = 0.018;
          if (!snap) push(this.plate(F, us, (F.ySill + F.yTop) / 2, 0, hs, span / 2, hs, (H(j, 153) - 0.5) * 0.06, FRAME, key++));
          else { const lo = span * (0.2 + 0.25 * H(j, 154)), hi = span * (0.1 + 0.16 * H(j, 155)), t1 = (H(j, 156) - 0.5) * 0.5, t2 = (H(j, 157) - 0.5) * 0.6;
            push(this.plate(F, us - Math.sin(t1) * lo / 2, F.ySill + Math.cos(t1) * lo / 2 - 0.01, 0, hs, lo / 2, hs, t1, FRAME, key++));
            if (!isHole) push(this.plate(F, us + Math.sin(t2) * hi / 2, yL - Math.cos(t2) * hi / 2 + (lin ? 0.02 : -0.03), 0, hs, hi / 2, hs, t2, FRAME, key++)); }
        }
      }
    }
    this.decor.delete(B.id); if (out.length) this.decor.set(B.id, out);   // (re-set = the newest: over the level's cap it is the wall dressed longest ago that goes bare)
    let total = 0; for (const l of this.decor.values()) total += l.length;
    for (const [id, l] of this.decor) { if (total <= EDGE.maxDecor) break; if (id === B.id) continue; total -= l.length; EDGE_STATS.capped += l.length; this.decor.delete(id); }
  }

  // ---------------------------------------------------------------- rubble
  /** what one opened cell leaves at the foot: fragments at rest positions hashed off the cell, flying there from the cell unless quiet */
  /** does a fragment at `p` (reach `r`) lie in a tripwire's beam? A beam ends at the first thing that casts a shadow (devices.ts): a look-only slab must never be
   *  that, so one lying in a beam keeps `NoShadow` (it casts none; the sensor is as it was). (The world's ray passes MKEY.look since, so the beam would not end on
   *  one either way: what this still decides is only that a slab in a beam's line casts no shadow.) */
  private inBeam(p: Vec3, r: number): boolean {
    for (const l of this.g.devices?.lasers ?? []) { const f = l.def.from, t = Math.max(0, Math.min(l.len, (p[0] - f[0]) * l.dir[0] + (p[1] - f[1]) * l.dir[1] + (p[2] - f[2]) * l.dir[2]));
      if (Math.hypot(p[0] - f[0] - l.dir[0] * t, p[1] - f[1] - l.dir[1] * t, p[2] - f[2] - l.dir[2] * t) < r + 0.12) return true; }
    return false;
  }
  private shed(B: BreakLike, F: Frame | null, c: number, dir: Vec3 | null, quiet: boolean, blast: boolean) {
    const g = this.g, b = B.box; const ix = c % B.nx, iz = Math.floor(c / B.nx) % B.nz, iy = Math.floor(c / (B.nx * B.nz));
    const H = (a: number, k = 0) => hash01(Math.imul(B.id + 1, 73856093) ^ Math.imul(c + 5, 19349663) ^ Math.imul(a + 3, 83492791) ^ Math.imul(k + 17, 2654435761));
    const floor = Math.max(0, b.c[1] - b.h[1]);
    let n: number, centre: Vec3, half: number, nrm: Vec3, along: Vec3, yLo: number, yHi: number;
    if (F) {
      const k = F.alongX ? ix : iz, u = -F.L / 2 + F.w * (k + 0.5);
      n = Math.round((iy ? EDGE.perUpper : EDGE.perSill) * (blast ? EDGE.blast.more : 1)); centre = this.at(F, u, 0, 0); half = F.w / 2; nrm = F.nrm; along = F.along; yLo = iy ? F.ySill : F.y0; yHi = iy ? F.yTop : F.ySill;
    } else {   // cover: a plan cell, top to bottom; thrown the way the round went
      const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), lx = -b.h[0] + 2 * b.h[0] * (ix + 0.5) / B.nx, lz = -b.h[2] + 2 * b.h[2] * (iz + 0.5) / B.nz;
      n = EDGE.perCover; centre = [b.c[0] + cs * lx + sn * lz, 0, b.c[2] - sn * lx + cs * lz]; half = Math.min(b.h[0] / B.nx, b.h[2] / B.nz);
      const d: Vec3 = dir && Math.hypot(dir[0], dir[2]) > 0.05 ? v3.normalize([dir[0], 0, dir[2]]) : [Math.cos(H(1) * 6.283), 0, Math.sin(H(1) * 6.283)];
      nrm = d; along = [-d[2], 0, d[0]]; yLo = b.c[1] - b.h[1]; yHi = b.c[1] + b.h[1];
    }
    const far = dir ? (v3.dot(dir, nrm) >= 0 ? 1 : -1) : (H(2) < 0.5 ? 1 : -1);
    const paint = b.albedo, wood = B.surf === 'wood', soft = B.surf === 'cardboard' || B.surf === 'fabric';
    const reach = blast ? EDGE.throwBlast : EDGE.throwFire;
    const sillUp = !!F && iy === 1 && B.open[c - B.nx * B.nz] === 0;
    const cut = cutBoxesOn();
    for (let i = 0; i < n; i++) {
      const side = F ? (H(10, i) < (blast ? 0.6 : 0.78) ? far : -far) : 1;
      const flung = blast && H(28, i) < EDGE.blast.flung;   // (a few go well into the room; the rest heap at the wall's foot, tighter than a round's scatter)
      let d = (F ? F.T : half) + 0.04 + (flung ? reach * (1.2 + 1.6 * H(11, i)) : reach * Math.pow(H(11, i), blast ? 2.6 : 2)) * (side === far ? 1 : blast ? EDGE.blast.nearK : 0.45);
      const u = (H(12, i) - 0.5) * (2 * half + (blast ? 0.5 : 0.25));
      const rd = v3.scale(nrm, side), off = sillUp ? F!.T + 0.02 : 0;   // (over a sill still standing the bits lie at its foot, either side — not inside it)
      const from: Vec3 = [centre[0] + along[0] * u + rd[0] * off, floor + 0.12, centre[2] + along[2] * u + rd[2] * off]; d = Math.max(0.03, d - off);
      const hit = g.col.raycast(from, rd, d + 0.14); if (hit) d = Math.max(0.03, hit.t - 0.14) * (0.5 + 0.5 * H(13, i));   // (a READ: rubble stops short of whatever stands there)
      // the fragment: a board flake lying nearly flat (a splinter off wood), now and then a lump
      const lump = H(14, i) < (blast ? EDGE.blast.lumps : 0.34); let hx = 0.022 + 0.085 * H(15, i) * H(15, i), hz = 0.018 + 0.055 * H(16, i), hy = F ? Math.min(0.011, Math.max(0.005, F.T * 0.18)) : 0.008;
      if (wood) { hx = 0.06 + 0.12 * H(15, i); hz = 0.008 + 0.012 * H(16, i); hy = 0.006; } else if (lump) { hx = (0.018 + 0.03 * H(15, i)) * (blast ? 2.5 * (H(29, i) < EDGE.blast.slabs ? EDGE.blast.slabK : 1) : 1); hz = hx * (0.6 + 0.5 * H(16, i)); hy = hx * (0.5 + 0.4 * H(17, i)); if (blast && F) hy = Math.min(hy, Math.max(F.T, 0.04)); }   // (a blast's chunk is a piece of the wall: never thicker than it)
      else if (blast) hy *= EDGE.blast.flakeK;
      // THE CUT SWITCH, a blast's heap off a wall: not one size of stone. A few big SLABS of the wall's own sheet lying flat (their outline torn by the table),
      // and of the chunks a good share much smaller — so the heap has something large in it and a lot of small stuff round it
      const C = EDGE.cutHeap; let slab = false;
      if (cut && blast && F && !wood && !soft) { const cls = H(33, i);
        if (cls < C.slabs) { slab = true; hx = C.slab[0] + (C.slab[1] - C.slab[0]) * H(15, i); hz = hx * (0.45 + 0.5 * H(16, i)); hy = Math.min(C.slabT, Math.max(0.012, F.T * 0.45)); }
        else if (lump && cls > 1 - C.smalls) { const k = C.small[0] + (C.small[1] - C.small[0]) * H(34, i); hx *= k; hz *= k; hy *= k; } }
      if (blast && !lump && H(17, i) < 0.2) { hx *= 1.5; hz *= 1.4; }
      const tilt = slab ? (H(18, i) - 0.5) * 0.16 : lump || d > 0.5 ? (H(18, i) - 0.5) * 0.3 : (H(18, i) - 0.5) * 0.9 * (1 - d / 0.5), yawQ = quat.yaw(H(19, i) * 6.283);
      const q1 = quat.normalize(quat.mul(yawQ, quat.axisAngle([1, 0, 0], tilt)));
      const px = from[0] + rd[0] * d, pz = from[2] + rd[2] * d;
      const dn = g.col.raycast([px, floor + 0.3, pz], [0, -1, 0], floor + 0.35), ground = dn ? floor + 0.3 - dn.t : 0;   // (a READ: the floor it lands on — cover on legs sheds onto the ground beside it)
      const y1 = ground + hy + Math.abs(Math.sin(tilt)) * hz + 0.002 + 0.0012 * ((this.serial + i) % 7);
      const p1: Vec3 = [px, y1, pz];
      const tone = H(20, i); let col: Vec3 = F ? (tone < 0.45 ? v3.copy(paint) : tone < 0.8 ? v3.lerp(paint, CORE, 0.82) : tone < 0.92 ? v3.copy(PAPER) : v3.scale(paint, 0.55)) : v3.scale(paint, soft ? 0.75 + 0.3 * tone : 0.7 + 0.45 * tone);
      const soot = blast ? (d < 0.7 ? 0.4 + 0.5 * H(21, i) : 0.75 + 0.25 * H(21, i)) : 1;
      if (blast) col = v3.scale(col, soot);
      if (cut && blast && F) col = v3.scale(col, 1 - C.tone * H(35, i));   // (each piece its own tone inside the material)
      const box = makeBox({ c: v3.copy(p1), h: [hx, hy, hz], rot: q1, albedo: col, flags: BoxFlag.Dynamic | BoxFlag.NoShadow, name: 'rubble', mkey: MKEY_LOOK + 0x800000 + (this.serial++ & 0x7fffff) });
      if (cut && g.destr.breaks.shapeLoose(box, B.surf, (B.id * 4096 + c) * 32 + i)) { p1[0] = box.c[0]; p1[1] = box.c[1]; p1[2] = box.c[2]; if (Math.max(hx, hz) >= 0.15 && !this.inBeam(p1, Math.max(hx, hz))) box.flags &= ~BoxFlag.NoShadow;
        // its broken faces: the material's core — but sooted with the piece, a little of the paper's brown in some, no two the same white
        if (blast && F && box.cutCore) box.cutCore = v3.scale(v3.lerp(box.cutCore, PAPER, C.corePaper * H(36, i)), soot * (1 - C.coreTone * H(37, i))); }   // the cut switch: its outline by its material's row (breakTable.ts); a big piece casts its shadow
      const r: Rubble = { box, t: 1, T: 1, p0: p1, p1, vy: 0, q0: q1, q1 };
      if (!quiet) {   // from the cell that went, down a short arc — more of a shove from a blast
        const yS = yLo + (yHi - yLo) * (0.15 + 0.75 * H(22, i)), uS = u * 0.6;
        r.p0 = [centre[0] + along[0] * uS, yS, centre[2] + along[2] * uS];
        const up = (blast ? 1.6 : 0.5) * H(23, i); r.T = (up + Math.sqrt(up * up + 19.6 * Math.max(0.02, yS - y1))) / 9.8 + 0.03 * i * (blast ? 0.3 : 1); r.vy = (y1 - yS + 4.9 * r.T * r.T) / r.T; r.t = 0;
        r.q0 = quat.normalize(quat.mul(quat.axisAngle(v3.normalize([H(24, i) - 0.5, H(25, i) - 0.5, H(26, i) - 0.5]), 2 + 5 * H(27, i)), q1));
        box.c = v3.copy(r.p0); box.rot = r.q0; this.flying++;
      }
      this.rubble.push(r); EDGE_STATS.shed++;
    }
  }

  // ---------------------------------------------------------------- scorch
  /** soot round a blast's gap: both faces of the wall about the opening (the blast's face heavier), the floor at its foot either side */
  private scorch(B: BreakLike, F: Frame, fresh: number[], dir: Vec3 | null) {
    let k0 = 1e9, k1 = -1; const per = B.nx * B.nz;   // (the gap = the sills the charge took: a wall it only ported further off is not its seat)
    for (const c of fresh) { if (c >= per) continue; const k = F.alongX ? c % B.nx : Math.floor(c / B.nx) % B.nz; k0 = Math.min(k0, k); k1 = Math.max(k1, k); }
    if (k1 < 0) return;
    const ua = -F.L / 2 + F.w * k0, ub = -F.L / 2 + F.w * (k1 + 1), uc = (ua + ub) / 2, half = (ub - ua) / 2; const S = EDGE.scorch;
    const bl = this.blasted.get(B.id); if (bl) bl.push([uc, half]); else this.blasted.set(B.id, [[uc, half]]);
    const D = this.g.decals; if (!EDGE.scorchDecals || !dir || !D || !D.enabled) return;
    const far = v3.dot(dir, F.nrm) >= 0 ? 1 : -1; const floor = Math.max(0, F.y0), yc = floor + Math.min(1.05, (F.yTop - floor) * 0.45);
    lookDecal(D.add('scorch', this.at(F, uc, yc, -far * F.T), v3.scale(F.nrm, -far), half + S.near, { param: S.sootNear, look: true }));
    lookDecal(D.add('scorch', this.at(F, uc, yc, far * F.T), v3.scale(F.nrm, far), half + S.far, { param: S.sootFar, look: true }));
    lookDecal(D.add('scorch', this.at(F, uc, floor, -far * (F.T + 0.4)), UP, half * 0.5 + S.floor, { param: S.sootNear * S.sootFloor, look: true }));
    lookDecal(D.add('scorch', this.at(F, uc, floor, far * (F.T + 0.35)), UP, half * 0.4 + S.floor * 0.7, { param: S.sootFar * S.sootFloor, look: true }));
    EDGE_STATS.scorch += 4;
    // THE RIM: the discs above are densest where the wall has gone, so what still stands round the opening gets its own, centred ON the cut (dense where the wall
    // begins, gone within a stride of it). A charge takes the uppers wider than the sills, so the two rows are measured apart, off the wall as it now stands: the
    // ends of the open run of uppers (two marks up each), and the ends of the open run of sills (one each, low — it also soots the shoulder left under the uppers)
    if (S.rim <= 0) return;
    const gone = (k: number, iy: number) => k >= 0 && k < F.N && B.open[(iy * B.nz + (F.alongX ? 0 : k)) * B.nx + (F.alongX ? k : 0)] === 1;
    const run = (iy: number): [number, number] => { let a = k0, b = k1; while (gone(a - 1, iy)) a--; while (gone(b + 1, iy)) b++; return [a, b]; };
    const cut = (k: number) => -F.L / 2 + F.w * k, spots: [number, number][] = [], sill = F.ySill - floor, up = F.yTop - F.ySill;
    const ends = ([a, b]: [number, number], ys: number[]) => { if (a > 0) for (const y of ys) spots.push([cut(a), y]); if (b < F.N - 1) for (const y of ys) spots.push([cut(b + 1), y]); };
    ends(run(0), [floor + sill * 0.6]);
    if (B.ny > 1 && gone(k0, 1)) ends(run(1), up >= 1.8 ? [F.ySill + up * 0.3, F.ySill + up * 0.8] : [F.ySill + up * 0.5]);
    spots.forEach(([u, y], i) => { for (const s of [-far, far]) {
      const h = hash01(Math.imul(B.id + 1, 73856093) ^ Math.imul(i * 2 + (s > 0 ? 1 : 0) + 31, 19349663) ^ Math.imul(k0 + 3, 83492791));
      if (lookDecal(D.add('scorch', this.at(F, u, y, s * F.T), v3.scale(F.nrm, s), S.rim * (0.85 + 0.3 * h), { param: (s === far ? S.sootFar : S.sootNear) * S.sootRim, look: true }))) EDGE_STATS.scorch++;
    } });
  }

  summary(): string { const s = EDGE_STATS; return `edge look ${EDGE.on ? 'on' : 'off'} · standing ${s.decor}/${EDGE.maxDecor} · rubble ${s.rubble}/${EDGE.maxRubble} (${s.flying} falling) · scorch decals ${s.scorch} · capped ${s.capped}`; }
}
