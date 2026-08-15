// CPU-side spatial helpers over the static boxes: circle push-out, line-of-sight, nav grid + A*.
import { Vec3, v3, quat } from '../math/vec';
import { Box, BoxFlag, rayBox } from './boxes';
import { WORLD } from './world';

/** The parameter interval [t0, t1] over which the LINE a + t·rd (rd unit) lies inside box b — t0 may be negative, behind a — or null if the line misses it; and `depth`:
 *  how far INSIDE the box the origin a sits (its least distance to a face plane; ≤ 0 = on the surface or outside). This is the whole slab picture segmentBlocked judges
 *  a static by, where rayBox() only ever reports an ENTRY ahead of the origin and answers null from inside (boxes.ts: the rule the cursor's pick and every emitter
 *  embedded in its own fixture lean on) — which let a segment born ON a wall's face, or a hair inside it, run clean through that wall (W8.3). */
function lineBox(a: Vec3, rd: Vec3, b: Box): { t0: number; t1: number; depth: number } | null {
  let ox: number, oy: number, oz: number, dx: number, dy: number, dz: number;
  if (b.rot) { const qi = quat.conj(b.rot); const o = quat.rotate(qi, v3.sub(a, b.c)); const d = quat.rotate(qi, rd); ox = o[0]; oy = o[1]; oz = o[2]; dx = d[0]; dy = d[1]; dz = d[2]; }
  else {
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const px = a[0] - b.c[0], pz = a[2] - b.c[2];
    ox = cs * px - sn * pz; oy = a[1] - b.c[1]; oz = sn * px + cs * pz;                 // world → box local (Rᵀ), rayBox's own convention
    dx = cs * rd[0] - sn * rd[2]; dy = rd[1]; dz = sn * rd[0] + cs * rd[2];
  }
  const h = b.h; let t0 = -Infinity, t1 = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let ax = 0; ax < 3; ax++) {
    if (Math.abs(d[ax]) < 1e-12) { if (Math.abs(o[ax]) > h[ax]) return null; continue; }   // parallel to this pair of faces: inside the slab for every t, or never
    let ta = (-h[ax] - o[ax]) / d[ax], tb = (h[ax] - o[ax]) / d[ax]; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return { t0, t1, depth: Math.min(h[0] - Math.abs(ox), h[1] - Math.abs(oy), h[2] - Math.abs(oz)) };
}

export class StaticCollision {
  private cells: number[][];        // per 1m cell: static box indices whose footprint overlaps and that matter for movement
  private W = WORLD.gridW; private H = WORLD.gridH; private cs = WORLD.gridCell;
  nav!: NavGrid;
  /** shared sound-propagation policy (audio engine + guard hearing) */
  sound!: SoundPaths;

  constructor(public boxes: Box[]) {
    this.cells = Array.from({ length: this.W * this.H }, () => []);
    boxes.forEach((b, i) => {
      if (b.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic)) return;
      const cs = Math.abs(Math.cos(b.yaw)), sn = Math.abs(Math.sin(b.yaw));
      const ex = cs * b.h[0] + sn * b.h[2], ez = sn * b.h[0] + cs * b.h[2];
      const x0 = Math.max(0, Math.floor((b.c[0] - ex) / this.cs)), x1 = Math.min(this.W - 1, Math.floor((b.c[0] + ex) / this.cs));
      const z0 = Math.max(0, Math.floor((b.c[2] - ez) / this.cs)), z1 = Math.min(this.H - 1, Math.floor((b.c[2] + ez) / this.cs));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.cells[z * this.W + x].push(i);
    });
    this.stamp = new Int32Array(boxes.length);
    this.nav = new NavGrid(this); this.sound = new SoundPaths(this);
  }

  /** De-duplication of box indices met in more than one grid cell during ONE query (gather / collideCircle / segmentBlocked / raycast): a box counts as seen when
   *  stamp[bi] === the query's id. One array for the object's life instead of a Set per call — these run hundreds of times a frame (every guard's eyes, every sound,
   *  every prop substep). The queries never nest (none calls another that stamps), so one counter serves them all; only indices baked into `cells` are ever stamped,
   *  and those are < the length the array was sized with. */
  private stamp: Int32Array; private stampId = 0;
  /** Indices of the movement-relevant static boxes whose grid cells overlap the XZ rectangle [x0,x1]×[z0,z1] and whose vertical span overlaps
   *  [y0, y1], written once each into `out` (no allocation — the prop solver calls this per body per substep). Returns the count (capped at out.length). */
  gather(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, out: Int32Array): number {
    const id = ++this.stampId; let n = 0;
    const cx0 = Math.max(0, Math.floor(x0 / this.cs)), cx1 = Math.min(this.W - 1, Math.floor(x1 / this.cs));
    const cz0 = Math.max(0, Math.floor(z0 / this.cs)), cz1 = Math.min(this.H - 1, Math.floor(z1 / this.cs));
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
      const cell = this.cells[z * this.W + x];
      for (let k = 0; k < cell.length; k++) {
        const bi = cell[k]; if (this.stamp[bi] === id) continue; this.stamp[bi] = id;
        const b = this.boxes[bi]; if (b.c[1] + b.h[1] < y0 || b.c[1] - b.h[1] > y1 || (b.flags & BoxFlag.NoShadow)) continue;   // (NoShadow at QUERY time: a static the destruction lane has knocked off its desk — flags raised at runtime; nothing baked into the cells carries it)
        if (this.glassWalkable && (b.flags & BoxFlag.Glass) && this.glassWalkable(bi)) continue;   // (GLASS BREAKING: a pane open along a walker's whole height is no obstacle to a shoved chair either — the movement rule, glassbreak.ts walkable)
        if (n < out.length) out[n++] = bi;
      }
    }
    return n;
  }

  /** Push a circle (XZ) of radius r out of static boxes overlapping the vertical span [y0, y1]. Mutates p. */
  collideCircle(p: Vec3, r: number, y0: number, y1: number, iterations = 3): boolean {
    let touched = false;
    for (let it = 0; it < iterations; it++) {
      let any = false;
      const x0 = Math.max(0, Math.floor((p[0] - r) / this.cs)), x1 = Math.min(this.W - 1, Math.floor((p[0] + r) / this.cs));
      const z0 = Math.max(0, Math.floor((p[2] - r) / this.cs)), z1 = Math.min(this.H - 1, Math.floor((p[2] + r) / this.cs));
      const id = ++this.stampId;   // (a fresh id per iteration: a box pushed out of in pass 0 must be looked at again in pass 1)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (const bi of this.cells[z * this.W + x]) {
        if (this.stamp[bi] === id) continue; this.stamp[bi] = id;
        const b = this.boxes[bi];
        if (b.c[1] + b.h[1] < y0 || b.c[1] - b.h[1] > y1 || (b.flags & BoxFlag.NoShadow)) continue;   // (a runtime-hidden static: see gather)
        if (this.glassWalkable && (b.flags & BoxFlag.Glass) && this.glassWalkable(bi)) continue;   // (GLASS BREAKING: a pane whose cells along a walker's height have ALL fallen out is walked through — glassbreak.ts walkable; the nav grid is NOT rebaked)
        // circle center in box local space
        const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
        const dx = p[0] - b.c[0], dz = p[2] - b.c[2];
        const lx = c * dx - s * dz, lz = s * dx + c * dz;
        const qx = Math.max(-b.h[0], Math.min(b.h[0], lx)), qz = Math.max(-b.h[2], Math.min(b.h[2], lz));
        let ddx = lx - qx, ddz = lz - qz; let d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r) continue;
        let nx: number, nz: number, pen: number;
        if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ddx / d; nz = ddz / d; pen = r - d; }
        else {
          // center inside the rectangle: push out along the axis of least penetration
          const px = b.h[0] - Math.abs(lx), pz = b.h[2] - Math.abs(lz);
          if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; pen = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; pen = pz + r; }
        }
        // back to world
        const wx = c * nx + s * nz, wz = -s * nx + c * nz;
        p[0] += wx * pen; p[2] += wz * pen; any = true; touched = true;
      }
      if (!any) break;
    }
    return touched;
  }

  /** Keep a circle of radius r on the world's floor rectangle (WORLD.min / max in XZ — the ground slab simply ends there: no kerb, no wall). Guards are held inside
   *  by the nav grid, which stops at the same edge; a body moved by hand (the player) needs this. Mutates p; true if it had to move it. */
  clampToWorld(p: Vec3, r: number): boolean {
    const x = Math.min(WORLD.max[0] - r, Math.max(WORLD.min[0] + r, p[0])), z = Math.min(WORLD.max[2] - r, Math.max(WORLD.min[2] + r, p[2]));
    const moved = x !== p[0] || z !== p[2]; p[0] = x; p[2] = z; return moved;
  }

  /** GLASS BREAKING (game/glassbreak.ts): is the point p on glass static bi inside a cell that has FALLEN OUT? null = panes never open (the game as it was).
   *  raycast lets a round through such a point (on to whatever stands beyond) and the solid segment test lets sound / a step / a line of fire through it. */
  glassOpen: ((bi: number, p: Vec3) => boolean) | null = null;
  /** GLASS BREAKING: is glass static bi open along a walker's WHOLE height (every cell reaching below WALK_CLEAR_H gone)? Movement (collideCircle) and the props'
   *  gather then ignore it — the one movement rule, chosen so a man's capsule and solidBlocked never disagree about a pane he could step through; a pane holed only
   *  at head height stays the wall it was to his feet. null = never. (The nav grid is baked once at construction and is NOT rebaked: A* still routes round the frame.) */
  glassWalkable: ((bi: number) => boolean) | null = null;

  /** Extra oriented boxes (door leaves) that block sight / sound / projectiles but are not part of the baked grid.
   *  Character movement (collideCircle) and the nav bake deliberately ignore them — doors have their own contact model. */
  dynamicBoxes: Box[] = [];

  /** True if the segment a→b crosses one of the dynamic occluders (door leaves) — statics ignored. With `needFlags`, only occluders carrying those flag bits count. */
  segmentBlockedDynamic(a: Vec3, b: Vec3, needFlags = 0): boolean {
    const d = v3.sub(b, a); const len = v3.len(d); if (len < 1e-4) return false; const rd = v3.scale(d, 1 / len);
    for (const db of this.dynamicBoxes) { if ((db.flags & needFlags) !== needFlags) continue; const hit = rayBox(a, rd, db, len); if (hit && hit.t >= 0) return true; }
    return false;
  }

  /** True if the segment a→b is blocked by a static box or a dynamic occluder (ignores NoShadow decals). `through` = flags of statics the segment PASSES: by default
   *  glass (BoxFlag.Glass) — this is the floor's line-of-SIGHT test (eyes, torch cones, the light between a man and a lamp, the dazzle), and a pane is nothing to any
   *  of those; pass 0 for the SOLID question (sound, a step, a lunge, an arm's reach: SoundPaths and the movement / reach gates do). Panes never break unless glass breaking is on (a round
   *  stars the glass and stops in it), so both answers hold for the whole encounter. One model: they see you through the conference-room glass and do not hear
   *  you through it.
   *  A static counts when the segment runs INSIDE it beyond the first `shrink` and enters it before the last `shrink` (lineBox's slab interval: t1 > shrink and
   *  t0 < len − shrink) — so a segment that merely starts or ends on a surface (an eye at a wall, a body on the floor, a lamp on its panel) is not blocked by that
   *  surface, but one BORN ON A FACE AND HEADING IN (an impact's sound on the wall it struck, a listener behind it) meets the wall's full thickness and is: the old
   *  entry-distance test (rayBox: t > shrink, and null from inside) let 288 of 318 such segments over the office's wall faces straight through, and made a→b and
   *  b→a disagree for every one of them. The one exemption kept from that rule, on purpose: a box the ORIGIN is embedded in deeper than `shrink` is skipped — a light
   *  inside its fixture's housing, a fixture box asked from its own centre which side is open (game.ts area lights) — it is not in the way of what it emits. (The
   *  END has no such exemption: a target buried in a box is behind that box's face, as it always was — the one asymmetry left, and only for endpoints inside solids.) */
  segmentBlocked(a: Vec3, b: Vec3, shrink = 0.02, through: number = BoxFlag.Glass): boolean {
    const d = v3.sub(b, a); const len = v3.len(d); if (len < 1e-4) return false;
    const rd = v3.scale(d, 1 / len);
    if (this.segmentBlockedDynamic(a, b)) return true;
    // walk grid cells along the segment (coarse: sample every 0.5 m, collect candidate boxes)
    const id = ++this.stampId; const steps = Math.ceil(len / 0.5) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * len; const x = Math.floor((a[0] + rd[0] * t) / this.cs), z = Math.floor((a[2] + rd[2] * t) / this.cs);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx, cz = z + dz; if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) continue;
        const cell = this.cells[cz * this.W + cx];
        for (let k = 0; k < cell.length; k++) {
          const bi = cell[k]; if (this.stamp[bi] === id) continue; this.stamp[bi] = id;
          if (this.boxes[bi].flags & (through | BoxFlag.NoShadow)) continue;   // (+ NoShadow: a static hidden at runtime by the destruction lane is nothing to sight or sound either)
          const s = lineBox(a, rd, this.boxes[bi]); if (!s) continue;
          if (s.depth > shrink) continue;                        // the origin is EMBEDDED in this box: not an occluder of its own contents (see above)
          if (s.t1 > shrink && s.t0 < len - shrink) {              // inside it past the first `shrink`, entered before the last: in the way …
            if (this.glassOpen && (this.boxes[bi].flags & BoxFlag.Glass) && this.glassOpen(bi, v3.mad(a, rd, Math.max(0, s.t0)))) continue;   // … unless it is a pane crossed where a cell has fallen out (GLASS BREAKING: sound, a step, a line of fire through the hole)
            return true;
          }
        }
      }
    }
    return false;
  }
  /** segmentBlocked with nothing passed through: the SOLID test (sound, movement, reach) — an intact pane blocks it. */
  solidBlocked(a: Vec3, b: Vec3, shrink = 0.02): boolean { return this.segmentBlocked(a, b, shrink, 0); }
  /** The line of FIRE a→b: is there anything a round would stop in — every static (a glass pane included: the round stars it and is spent in it, combat.ts
   *  fireWeapon → raycast) and every leaf. Loose furniture is not asked (concealment, not cover: fireWeapon lets the round through to whoever stands behind it).
   *  Today that is exactly the solid walk; it is named apart because it is a different QUESTION from a step or a sound's straight run — the guards' 'can I hit
   *  him from here' (guards.ts clearShot, the tactics' cover points) must never again be answered by the line of SIGHT, which passes glass: a man who sees Sam
   *  through the conference glazing planted on that line and put round after round into the pane. */
  shotBlocked(a: Vec3, b: Vec3, shrink = 0.02): boolean { return this.segmentBlocked(a, b, shrink, 0); }

  /** Closest static hit along a ray (t, box index) or null. Solid: an intact glass pane IS hit (a round, a canister, a spark, a shin all meet it); a broken one is not. */
  raycast(ro: Vec3, rd: Vec3, tmax: number): { t: number; index: number; n: Vec3 } | null {
    let best = tmax, bi = -1; let bn: Vec3 = [0, 1, 0];
    this.dynamicBoxes.forEach((db, i) => { const hit = rayBox(ro, rd, db, best); if (hit && hit.t < best) { best = hit.t; bi = 1e6 + i; bn = hit.n; } });   // index ≥ 1e6: dynamic occluder
    const id = ++this.stampId; const steps = Math.ceil(tmax / 0.5) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * tmax; if (t > best + 1.5) break;
      const x = Math.floor((ro[0] + rd[0] * t) / this.cs), z = Math.floor((ro[2] + rd[2] * t) / this.cs);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx, cz = z + dz; if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) continue;
        const cell = this.cells[cz * this.W + cx];
        for (let k = 0; k < cell.length; k++) {
          const b = cell[k]; if (this.stamp[b] === id) continue; this.stamp[b] = id;
          if (this.boxes[b].flags & BoxFlag.NoShadow) continue;   // (a runtime-hidden static: see gather)
          const hit = rayBox(ro, rd, this.boxes[b], best); if (hit && hit.t < best) { if (this.glassOpen && (this.boxes[b].flags & BoxFlag.Glass) && this.glassOpen(b, v3.mad(ro, rd, hit.t))) continue; best = hit.t; bi = b; bn = hit.n; }   // (GLASS BREAKING: a round through the missing part of a pane flies on to what stands beyond) (rayBox answers null from INSIDE a box — boxes.ts: a round or a spark born inside a static leaves it freely, by that rule)
        }
      }
    }
    return bi >= 0 ? { t: best, index: bi, n: bn } : null;
  }
}

/** How a sound at `src` reaches a listener at `dst`. One policy for both the audio engine (apparent direction,
 *  distance, muffling) and the guards' hearing:
 *  - direct: unobstructed straight line (a jamb grazing one side ray muffles it a touch);
 *  - routed: walled off, but the walkable space (nav grid) connects them — it arrives from the first bend/doorway,
 *    at the path's length, muffled a little, or a lot if a closed door leaf sits across that route;
 *  - sealed / too far to search: a dull remnant through the mass.
 *  All fields are defined in every case, so consumers just read them. */
export interface Propagation {
  direct: boolean; routed: boolean;
  pathLen: number;      // metres travelled (always finite: straight, path length, or a padded straight distance when sealed)
  via: Vec3;            // the last point of the route still in sight of the listener — the doorway / corner it comes through (the source itself unless routed)
  apparent: Vec3;       // where it seems to come from: through `via`, pushed out to the travelled distance (the source itself unless routed)
  muffle: number;       // 0 clear .. 1 through solid mass → drives low-pass / gain
  carry: number;        // 0..1 multiplier on how far it is heard (AI hearing radii)
}
export class SoundPaths {
  private cache = new Map<string, { t: number; r: Propagation }>(); private now = 0;
  constructor(private col: StaticCollision) {}
  tick(time: number) { this.now = time; if (this.cache.size > 512) this.cache.clear(); }
  propagate(src: Vec3, dst: Vec3): Propagation {
    const a: Vec3 = [src[0], Math.max(src[1], 0.9), src[2]], b: Vec3 = [dst[0], Math.max(dst[1], 0.9), dst[2]];
    const straight = v3.dist(a, b);
    // (solidBlocked throughout: sound does not pass a glass pane — it goes round through the door like round any wall, or through the opening once the pane is broken)
    if (!this.col.solidBlocked(a, b)) {
      // clear line; rays offset half a metre sideways catch a jamb / corner partly in the way and soften the transition at doorways
      let graze = 0;
      if (straight > 1) { const d = v3.sub(b, a); const side = v3.normalize([-d[2], 0, d[0]]); if (this.col.solidBlocked(v3.mad(a, side, 0.5), b)) graze += 0.1; if (this.col.solidBlocked(v3.mad(a, side, -0.5), b)) graze += 0.1; }
      return { direct: true, routed: false, pathLen: straight, via: v3.copy(src), apparent: v3.copy(src), muffle: graze, carry: 1 };
    }
    // blocked at chest height but clear at 2 m: a counter, cubicle partition or cabinet is in the way, not a wall — sound goes
    // straight over the top, barely dulled (without this, a step behind the reception desk 'routed' 9 m around and read as silence)
    const a2: Vec3 = [src[0], 2.0, src[2]], b2: Vec3 = [dst[0], 2.0, dst[2]];
    if (!this.col.solidBlocked(a2, b2)) return { direct: true, routed: false, pathLen: straight, via: v3.copy(src), apparent: v3.copy(src), muffle: 0.15, carry: 0.9 };
    const sealed = (): Propagation => ({ direct: false, routed: false, pathLen: straight * 1.5, via: v3.copy(src), apparent: v3.copy(src), muffle: 1, carry: 0.25 });
    if (straight > 28) return sealed();                    // far and walled off: not worth a search
    const nav = this.col.nav; const cs = nav.cell;
    const key = `${Math.floor(src[0] / cs)},${Math.floor(src[2] / cs)}>${Math.floor(dst[0] / cs)},${Math.floor(dst[2] / cs)}`;
    const hit = this.cache.get(key); if (hit && Math.abs(this.now - hit.t) < 0.5) return hit.r;
    const path = nav.findPath(dst, src, 6000);            // listener → source: the first legs tell us where it comes from
    let r: Propagation;
    if (!path || !path.length) r = sealed();
    else {
      let L = 0; let prev: Vec3 = [dst[0], 0, dst[2]];
      let via: Vec3 = [path[0][0], 1.0, path[0][2]];                                  // farthest waypoint the listener can still see: the corner / doorway it spills out of
      let doorInWay = false; let pa: Vec3 = [dst[0], 1.0, dst[2]]; let sightLost = false;
      for (const q of path) {
        L += v3.distXZ(q, prev); prev = q;
        const pb: Vec3 = [q[0], 1.0, q[2]];
        if (!sightLost) { if (!this.col.solidBlocked(b, pb)) via = pb; else sightLost = true; }   // ('sight' here is the sound's straight run to the listener: a pane in the way means it has not spilled out yet)
        if (!doorInWay && this.col.segmentBlockedDynamic(pa, pb, BoxFlag.SoundSeal)) doorInWay = true;
        pa = pb;
      }
      const lastLeg = v3.distXZ(src, prev); L += lastLeg; L = Math.max(L, straight);
      // the last leg stops short of the source so a sound emitted at a door leaf (creak, slam) is not muffled by its own leaf
      const s1: Vec3 = [src[0], 1.0, src[2]]; const end: Vec3 = lastLeg > 0.3 ? v3.mad(s1, v3.normalize(v3.sub(pa, s1)), 0.25) : pa;
      if (!doorInWay && this.col.segmentBlockedDynamic(pa, end, BoxFlag.SoundSeal)) doorInWay = true;   // a (near-)closed leaf across any leg muffles it a lot
      const dir = v3.normalize([via[0] - dst[0], 0, via[2] - dst[2]]);
      const muffle = doorInWay ? 0.85 : 0.35;
      r = { direct: false, routed: true, pathLen: L, via, apparent: [dst[0] + dir[0] * L, src[1], dst[2] + dir[2] * L], muffle, carry: 1 - muffle * 0.8 };
    }
    this.cache.set(key, { t: this.now, r }); return r;
  }
}

/** 2D navigation grid (0.5 m) over the level for guard path finding. */
export class NavGrid {
  cell = 0.5; W: number; H: number; blocked: Uint8Array;
  constructor(private col: StaticCollision) {
    this.W = Math.round(WORLD.gridW * WORLD.gridCell / this.cell); this.H = Math.round(WORLD.gridH * WORLD.gridCell / this.cell);
    this.blocked = new Uint8Array(this.W * this.H);
    const p: Vec3 = [0, 0, 0];
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) {
      p[0] = (x + 0.5) * this.cell; p[1] = 0; p[2] = (z + 0.5) * this.cell;
      const q: Vec3 = [p[0], 0, p[2]];
      // blocked if a guard-sized circle at the cell center overlaps geometry between knee and shoulder height
      // clearance must be >= the guards' movement collision radius (0.3) or steering can dead-lock on prop corners the grid calls free
      if (col.collideCircle(q, 0.34, 0.25, 1.5, 1)) { const moved = v3.distXZ(q, p); if (moved > 0.005) this.blocked[z * this.W + x] = 1; }
    }
  }
  idx(x: number, z: number) { return z * this.W + x; }
  isBlocked(wx: number, wz: number) { const x = Math.floor(wx / this.cell), z = Math.floor(wz / this.cell); if (x < 0 || z < 0 || x >= this.W || z >= this.H) return true; return this.blocked[this.idx(x, z)] === 1; }

  /** A* from a to b (world coords). Returns world-space waypoints (cell centers), smoothed by greedy line-of-walk.
   *  `penalty` (optional): a cost MULTIPLIER for stepping INTO cell (ix, iz) — 1 = plain floor, 6 = six times dearer to walk through, 20 = all but a wall
   *  (values under 1 are read as 1, so the straight-line heuristic stays admissible). It bends the route round places a man has reason to avoid without
   *  forbidding them: a doorway his side has just seen become a kill zone, the corridor a colleague is already pressing up (game/tactics.ts — the k-th
   *  alternative route is simply A* again with the earlier routes' cells made dear). The smoothing then never straightens a leg back ACROSS dear cells the
   *  search walked round (a merge is only taken if it crosses no more penalised cells than the raw cells it replaces). Absent, nothing here differs by one
   *  instruction from the search it always was. */
  findPath(a: Vec3, b: Vec3, maxIter = 6000, penalty?: (ix: number, iz: number) => number): Vec3[] | null {
    const W = this.W, H = this.H;
    const sx = clampi(Math.floor(a[0] / this.cell), 0, W - 1), sz = clampi(Math.floor(a[2] / this.cell), 0, H - 1);
    let gx = clampi(Math.floor(b[0] / this.cell), 0, W - 1), gz = clampi(Math.floor(b[2] / this.cell), 0, H - 1);
    if (this.blocked[this.idx(gx, gz)]) { const alt = this.nearestFree(gx, gz, b[0], b[2]); if (!alt) return null; gx = alt[0]; gz = alt[1]; }   // (a goal by a wall resolves to ITS side of the wall — see nearestFree)
    const start = this.idx(sx, sz), goal = this.idx(gx, gz);
    if (start === goal) return [[(gx + 0.5) * this.cell, 0, (gz + 0.5) * this.cell]];
    const gScore = new Float32Array(W * H).fill(Infinity); const came = new Int32Array(W * H).fill(-1); const closed = new Uint8Array(W * H);
    const open: number[] = []; const f = new Float32Array(W * H).fill(Infinity);
    const hfun = (i: number) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    gScore[start] = 0; f[start] = hfun(start); open.push(start);
    let iter = 0;
    while (open.length && iter++ < maxIter) {
      // pop min f (linear scan; grids are small)
      let mi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[mi]]) mi = i;
      const cur = open[mi]; open[mi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const ni = this.idx(nx, nz); if (this.blocked[ni] || closed[ni]) continue;
        if (dx && dz && (this.blocked[this.idx(cx + dx, cz)] || this.blocked[this.idx(cx, cz + dz)])) continue; // no corner cutting
        const step = dx && dz ? Math.SQRT2 : 1;
        const ng = gScore[cur] + (penalty ? step * Math.max(1, penalty(nx, nz)) : step);
        if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; f[ni] = ng + hfun(ni); open.push(ni); }
      }
    }
    if (came[goal] < 0) return null;
    const cells: number[] = []; for (let c = goal; c >= 0 && c !== start; c = came[c]) cells.push(c); cells.reverse();
    const pts: Vec3[] = cells.map(c => [((c % W) + 0.5) * this.cell, 0, (((c / W) | 0) + 0.5) * this.cell]);
    // greedy smoothing
    const dear = penalty ? cells.map(c => penalty(c % W, (c / W) | 0) > 1) : null;   // (with a penalty: which raw cells the search paid extra for — a merged leg may not cross more dear cells than the ones it stands in for)
    const out: Vec3[] = []; let anchor: Vec3 = [a[0], 0, a[2]]; let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      for (; j > i; j--) if (this.walkable(anchor, pts[j]) && (!dear || this.dearAlong(anchor, pts[j], penalty!) <= countTrue(dear, i, j))) break;
      out.push(pts[j]); anchor = pts[j]; i = j + 1;
    }
    return out;
  }
  /** distinct cells along the straight leg a → b (sampled at half a cell) whose penalty is above plain floor — the smoothing's guard against cutting back across them */
  private dearAlong(a: Vec3, b: Vec3, penalty: (ix: number, iz: number) => number): number {
    const dx = b[0] - a[0], dz = b[2] - a[2]; const n = Math.ceil(Math.hypot(dx, dz) / (this.cell * 0.5)) + 1;
    let last = -1, count = 0;
    for (let k = 0; k <= n; k++) {
      const t = k / n; const ix = Math.floor((a[0] + dx * t) / this.cell), iz = Math.floor((a[2] + dz * t) / this.cell); const i = this.idx(ix, iz);
      if (i === last) continue; last = i;
      if (ix >= 0 && iz >= 0 && ix < this.W && iz < this.H && penalty(ix, iz) > 1) count++;
    }
    return count;
  }

  /** The free cell nearest (by ring) to the blocked cell (gx, gz). With the world point (wx, wz) that asked: among the free cells of the winning ring (and, failing
   *  that, the next), the first one the point reaches in a STRAIGHT clear line at waist height — its own side of whatever wall or partition put it in the blocked band.
   *  A sound made a hand off a wall (its cell is in the 0.34 m clearance band the bake blocks along every wall) used to resolve to whichever free cell the ring met
   *  first in scan order: 36 of 202 such points over the office landed in the room BEHIND the wall, and the guards' hearing then measured its path — and heard it
   *  come — from the wrong room; a man's goal by a wall could send him round into the next office the same way. No clear candidate in those two rings (a point buried
   *  in a solid has no side) = the ring order's first, exactly as before. */
  private nearestFree(gx: number, gz: number, wx?: number, wz?: number): [number, number] | null {
    let fallback: [number, number] | null = null; let extra = 1;   // rings searched past the winning one for a same-side cell
    const from: Vec3 | null = wx === undefined || wz === undefined ? null : [wx, 1.0, wz];
    for (let r = 1; r < 8; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const x = gx + dx, z = gz + dz;
        if (x < 0 || z < 0 || x >= this.W || z >= this.H || this.blocked[this.idx(x, z)]) continue;
        if (!from) return [x, z];
        fallback ??= [x, z];
        if (!this.col.solidBlocked(from, [(x + 0.5) * this.cell, 1.0, (z + 0.5) * this.cell])) return [x, z];
      }
      if (fallback && extra-- <= 0) return fallback;
    }
    return fallback;
  }
  /** Centre of the walkable cell nearest (by ring) to a world point — the point's own cell if it is free — or null if nothing within ~3.5 m is. What a body put
   *  down by hand (a teleport) stands on when the asked-for spot is inside something; unlike findPath(p, p) it does not need a way OUT of the blocked cell. */
  nearestFreePoint(wx: number, wz: number): Vec3 | null {
    const x = clampi(Math.floor(wx / this.cell), 0, this.W - 1), z = clampi(Math.floor(wz / this.cell), 0, this.H - 1);
    const c = this.blocked[this.idx(x, z)] ? this.nearestFree(x, z, wx, wz) : [x, z] as [number, number];
    return c ? [(c[0] + 0.5) * this.cell, 0, (c[1] + 0.5) * this.cell] : null;
  }

  /** Conservative straight-line walkability (samples cells along the segment with the agent radius). */
  walkable(a: Vec3, b: Vec3): boolean {
    const dx = b[0] - a[0], dz = b[2] - a[2]; const len = Math.hypot(dx, dz); const n = Math.ceil(len / (this.cell * 0.5)) + 1;
    const px = -dz / (len || 1) * 0.22, pz = dx / (len || 1) * 0.22;
    for (let i = 0; i <= n; i++) {
      const t = i / n; const x = a[0] + dx * t, z = a[2] + dz * t;
      if (this.isBlocked(x, z) || this.isBlocked(x + px, z + pz) || this.isBlocked(x - px, z - pz)) return false;
    }
    return true;
  }
}

function clampi(x: number, a: number, b: number) { return x < a ? a : x > b ? b : x; }
/** how many of flags[i‥j] are set (findPath's smoothing: the dear raw cells a merged leg would replace) */
function countTrue(flags: boolean[], i: number, j: number): number { let n = 0; for (let k = i; k <= j; k++) if (flags[k]) n++; return n; }
