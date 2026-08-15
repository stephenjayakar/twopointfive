// GLASS BREAKING (docs/internal/glassbreak.md; ported from the physics showcase's pphys/glassbreak.ts — docs/research/destruction-survey.md G1/G2/G3/G5): panes come apart CELL BY
// CELL where the rounds landed, and the cells that fall become RIGID SHARDS in the debris pool with a garnish of glass chips (the designer: "glass should stay rigid bodies and
// fall out. then we emit small glass particles in addition to that"). Behind ONE switch, `tune.glassBreak` (default OFF, kept per machine with its knobs: `twopointsix.glassbreak`;
// Tab ▸ Destruction ▸ Glass): off — or chaos 0, or the tour (destruction.ts chaosOf) — = every entry point returns on its first line and a pane is exactly what glass.ts says it is
// (a round stars it and stops in it, for ever). The renderer's half is a COMPILE-TIME const (`GLASS_BREAK` in the scene prelude, render/frame.ts glassBreakConfig, raised by main.ts
// at boot from the persisted switch — a page reload applies a change): with it false the shaders are main's programs.
//
//   • Per pane (created on its first hit): an IMPACT LIST (≤ maxImpacts; a hit within mergeR of an old one merges into it, energy adding), each impact a Voronoi SITE on the
//     pane's face in local (u along the pane, v up) metres. The cells are the Voronoi cells of the sites clipped to the pane's rectangle (cellsOf: Sutherland–Hodgman against
//     every bisector, each edge tagged with the neighbour or the frame side that made it) — so the crack network the composite draws (common.wgsl gbCell: the distance to the
//     nearest bisector) and the pieces that fall are the same partition, and both follow from where the rounds went (real glass: a later impact's cracks terminate at the
//     earlier ones — which is what a Voronoi of the impacts reads as).
//   • SUPPORT (Source's func_breakable_surf, generalised from its 12-inch panels to these cells): a cell is held by the frame sides it touches (bottom 1.3, sides 1.0, top 0.9,
//     × the share of its perimeter on them) and by its intact neighbours (0.9 × their support × the shared edge's share); a few Gauss–Seidel sweeps every `think` seconds; a
//     cell under `dropSupport` falls — so a tongue of glass left between two shot-out clusters follows a beat later, and a cell hanging off one short edge goes.
//   • TYPE decides the failure (one parameter): 'annealed' (interior partitions) — nothing falls before failHits.annealed hits, then every hit drops the cell it lands in (+ the
//     support pass); 'tempered' (exterior glazing) — holds to failHits.tempered then DICES: every cell at once, mostly as chip particles + a few rigid crumbs; 'laminated' (the
//     manager's sidelight, the clerestory strips) — cracks, never opens. A stun charge within blastM seeds impacts toward its nearest point (the first two where glass.ts
//     crackNear puts its stars) and fails what it reaches (blast()).
//   • A dropped cell = 1‥3 thin boxes covering its polygon (debris.ts Chunk kind 'shard': pale glass albedo, rough 0.05 so the RT reflections glint on them, a tinkle on
//     landing, blamed on the shooter) thrown gently OUT along the blow + a burst of pale chips ('debris' particles) ∝ its area; the pool's cap / eviction / refusal rules bound
//     it (a refused shard is all chips; a blasted pane can queue enough shards to evict every RESTING tile / housing of destruction's — the one pool, by design). The HOLE is real
//     to every consumer: the renderer's glassTrace / glassTransmit pass dropped cells (view, mirror, light — the cell table this module fills through world.glassCellFill),
//     StaticCollision.raycast / segmentBlocked ask openAt() so rounds, sound, a step test and a line of fire pass, and a pane more than a quarter open on an exterior wall
//     registers a GUST source with the wind (wind.ts 'glass') ∝ its open area — the storm comes in through the missing glass.
//   • MOVEMENT (the review's gap, closed by one rule): a pane stays the obstacle it was to a walker's capsule (collision.ts collideCircle) and to shoved furniture (gather)
//     until EVERY cell of it that reaches below WALK_CLEAR_H has fallen — then it is walked through (`walkable`, cached per pane on each drop). So a man's feet and the solid
//     segment test never disagree about a pane he could pass: holed at head height only = still a wall to both his shins and (below the hole) to solidBlocked. The nav grid is
//     NOT rebaked (A* keeps routing round the frame; a man pushed through the opening by the fight walks it fine).
//   • Once any cell has fallen the site set is FROZEN (a later impact counts on the cell it lands in — its nearest site — instead of adding one): the partition, openAt(), the
//     GPU cell table and the drawn cracks all derive from the current sites, so a new site beside a hole would re-cut it and glass would re-form where shards already lie.
//   • Bounded: ≤ maxImpacts sites a pane (the 17th merges into the nearest), ≤ shardsPerFrame rigid spawns a frame (the rest wait a think), the debris pool's cap;
//     deterministic: every choice hashes the pane index, the impact point (glass.ts hitSeed) or a serial — never Math.random. reset() = every pane whole (resetLevelState; a
//     checkpoint load is a restart, so holes are never saved — and no static is ever appended, so savestate's levelFingerprint is untouched).
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import type { Game } from './game';
import { hitSeed, glassHit } from './glass';
import { hash01 } from './debris';
import { chaosOf } from './destruction';
import { gpuFx } from './particleFx';
import { BUILDING } from './floor';
import { WIND, WIND_FIELD, type WindSource } from './wind';
import { INTERIOR as WEATHER_INTERIOR } from './weather';

export type GlassType = 'annealed' | 'tempered' | 'laminated';
/** the knobs (Tab ▸ Destruction ▸ Glass edits failHits / dropSupport / blastM live; kept per machine with the switch by saveGlassBreak) */
export const GLASSBREAK = {
  maxImpacts: 16, mergeR: 0.1,
  failHits: { annealed: 3, tempered: 5, laminated: 1e9 } as Record<GlassType, number>,
  dropSupport: 0.28, think: 0.28,
  frameW: { bottom: 1.3, side: 1.0, top: 0.9 }, neighbourW: 0.9,
  blastM: 2.6, blastImpacts: 5,
  shardsPerFrame: 6, shardOut: 0.7, shardSpin: 5, chipsPerM2: 90, chipsMin: 8,
  shardAlbedo: [0.72, 0.8, 0.82] as Vec3, chipColor: [0.8, 0.88, 0.9] as Vec3,
  diceChipsPerM2: 260, diceCrumbs: 6,
  gustSpeedK: 0.6,
  /** the first cell to fall out of a pane is LOCAL to the blow: if the Voronoi cell under it is bigger than cellMaxM2 (one or two impacts on a big sheet = a cell the size of the sheet),
   *  ringSites crack-tip sites are put on a ring of ringR metres (hashed ±20 %) round the impact first — the radial cracks' reach — so a hand-sized polygon drops and the rest of the sheet
   *  stands as wedges off the hole (each a cell a later round can take). Ring sites carry no energy: no star, no radials drawn from them */
  cellMaxM2: 0.3, ringSites: 6, ringR: 0.34,
  /** a pane is walked through once every cell reaching below this height (m above the floor) has fallen (the movement rule above) */
  walkClearH: 1.9,
};
export const GLASSBREAK_DEFAULTS = { failHits: { ...GLASSBREAK.failHits }, dropSupport: GLASSBREAK.dropSupport, blastM: GLASSBREAK.blastM };
const LS_KEY = 'twopointsix.glassbreak';
type GbTune = { glassBreak?: boolean };
/** the persisted switch alone (main.ts reads it BEFORE the Engine builds a pipeline, to raise the prelude const) */
export function glassBreakPersisted(): boolean { try { const raw = localStorage.getItem(LS_KEY); if (!raw) return false; return JSON.parse(raw)?.on === true; } catch { return false; } }
/** Game constructor: the switch + knobs kept per machine */
export function loadGlassBreak(tune: GbTune) {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return; const o = JSON.parse(raw);
    if (typeof o.on === 'boolean') tune.glassBreak = o.on;
    const F = o.failHits; if (F) for (const k of ['annealed', 'tempered'] as const) if (typeof F[k] === 'number' && isFinite(F[k])) GLASSBREAK.failHits[k] = Math.max(1, Math.min(20, Math.round(F[k])));
    if (typeof o.dropSupport === 'number' && isFinite(o.dropSupport)) GLASSBREAK.dropSupport = Math.max(0, Math.min(1, o.dropSupport));
    if (typeof o.blastM === 'number' && isFinite(o.blastM)) GLASSBREAK.blastM = Math.max(0, Math.min(6, o.blastM));
  } catch { /* no storage / bad JSON: defaults */ }
}
export function saveGlassBreak(g: Game) { try { localStorage.setItem(LS_KEY, JSON.stringify({ on: !!(g.tune as GbTune).glassBreak, failHits: { annealed: GLASSBREAK.failHits.annealed, tempered: GLASSBREAK.failHits.tempered }, dropSupport: GLASSBREAK.dropSupport, blastM: GLASSBREAK.blastM })); } catch { /* */ } }
/** the one gate every entry point takes first: the switch on AND destruction's contract (chaos 0 / the tour = the game byte for byte) */
export function glassBreakLive(g: Game): boolean { return !!(g.tune as GbTune).glassBreak && chaosOf(g) > 0; }

interface Impact { u: number; v: number; e: number; seed: number; t: number; hits: number }
interface Cell { i: number; pts: [number, number][]; tags: (number | string)[]; area: number; cen: [number, number]; perim: number; frame: Record<string, number>; nb: Map<number, number>; vMin: number; }
export interface PaneState {
  bi: number; box: Box; type: GlassType; uAxis: 0 | 2; hu: number; hv: number; ht: number; exterior: boolean;
  impacts: Impact[]; dropped: number; hits: number; damage: number;
  cells: Cell[] | null; support: number[]; nextThink: number; pending: number[]; lastDir: Vec3; lastWho: number;
  /** every cell reaching below walkClearH has fallen: movement passes (the rule above) */
  walkable: boolean;
  log: string[];
}
export const GB_STATS = { panes: 0, impacts: 0, dropped: 0, shards: 0, chips: 0, refused: 0, diced: 0, blasts: 0, thinks: 0 };

export class GlassBreak {
  panes = new Map<number, PaneState>();
  log: string[] = [];
  private shardsThisFrame = 0;
  constructor(private g: Game) {
    g.engine.world.glassCellFill = (bi, dst, off) => this.fill(bi, dst, off);
    g.col.glassOpen = (bi, p) => this.openAt(bi, p);
    g.engine.world.glassOpen = (bi, p) => glassBreakLive(g) && this.openAt(bi, p);   // the aim ray too (BoxWorld.raycast: reticle / arm / throw arc pass through a hole — W4G.10); inert with the switch off like everything else
    g.col.glassWalkable = (bi) => this.walkable(bi);
  }
  private note(s: string) { this.log.push(`${this.g.time.toFixed(1)}s ${s}`); if (this.log.length > 60) this.log.shift(); }

  // ---------------------------------------------------------------- pane geometry
  private static onFacade(b: Box): boolean { return Math.abs(b.c[0] - BUILDING.x0) < 0.2 || Math.abs(b.c[0] - BUILDING.x1) < 0.2 || Math.abs(b.c[2] - BUILDING.z0) < 0.2 || Math.abs(b.c[2] - BUILDING.z1) < 0.2; }   // TODO(LevelData): the facade rectangle is floor.ts's BUILDING; a second level wants the pane's type / exterior authored
  typeOf(b: Box): GlassType {
    if (GlassBreak.onFacade(b)) return b.h[1] < 0.4 ? 'laminated' : 'tempered';   // clerestory strips hold; the frontage and the windows are safety glass
    return Math.max(b.h[0], b.h[2]) < 0.35 ? 'laminated' : 'annealed';   // the manager's narrow sidelight holds; the conference partition is plain float glass
  }
  private stateOf(bi: number): PaneState | null {
    let st = this.panes.get(bi); if (st) return st;
    const b = this.g.level.boxes[bi]; if (!b || !(b.flags & BoxFlag.Glass) || Math.min(b.h[0], b.h[2]) > 0.05) return null;   // (a Glass box thicker than a sheet — solid glass — never comes apart)
    const uAxis: 0 | 2 = b.h[0] >= b.h[2] ? 0 : 2; const type = this.typeOf(b);
    st = { bi, box: b, type, uAxis, hu: b.h[uAxis], hv: b.h[1], ht: Math.min(b.h[0], b.h[2]), exterior: type !== 'annealed' && GlassBreak.onFacade(b),
      impacts: [], dropped: 0, hits: 0, damage: 0, cells: null, support: [], nextThink: 0, pending: [], lastDir: [0, 0, 1], lastWho: 0, walkable: false, log: [] };
    this.panes.set(bi, st); GB_STATS.panes++;
    return st;
  }
  /** world point → pane-local (u, v) (collision.ts lineBox's frame: local = Rᵀ·(X − c)) */
  toUV(st: PaneState, X: Vec3): [number, number] {
    const b = st.box; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const px = X[0] - b.c[0], pz = X[2] - b.c[2];
    const lx = cs * px - sn * pz, lz = sn * px + cs * pz;
    return [st.uAxis === 0 ? lx : lz, X[1] - b.c[1]];
  }
  /** pane-local (u, v, w across the thickness) → world */
  toWorld(st: PaneState, u: number, v: number, w = 0): Vec3 {
    const b = st.box; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const lx = st.uAxis === 0 ? u : w, lz = st.uAxis === 0 ? w : u;
    return [b.c[0] + cs * lx + sn * lz, b.c[1] + v, b.c[2] - sn * lx + cs * lz];
  }
  normalOf(st: PaneState): Vec3 { const b = st.box; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return st.uAxis === 0 ? [sn, 0, cs] : [cs, 0, -sn]; }

  // ---------------------------------------------------------------- Voronoi cells of the impacts, clipped to the pane
  private cellsOf(st: PaneState): Cell[] {
    const P = st.impacts; const out: Cell[] = [];
    for (let i = 0; i < P.length; i++) {
      let pts: [number, number][] = [[-st.hu, -st.hv], [st.hu, -st.hv], [st.hu, st.hv], [-st.hu, st.hv]];
      let tags: (number | string)[] = ['bottom', 'right', 'top', 'left'];   // tags[k] = what made the edge pts[k] → pts[k+1]
      for (let j = 0; j < P.length && pts.length >= 3; j++) {
        if (j === i) continue;
        const nx = P[j].u - P[i].u, ny = P[j].v - P[i].v; const d = (P[j].u * P[j].u + P[j].v * P[j].v - P[i].u * P[i].u - P[i].v * P[i].v) / 2;   // keep n·x ≤ d (nearer i than j)
        const inside = (p: [number, number]) => nx * p[0] + ny * p[1] <= d + 1e-9;
        const np: [number, number][] = []; const nIn: (number | string)[] = [];   // nIn[k] = tag of the edge ARRIVING at np[k]
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k], b = pts[(k + 1) % pts.length], t = tags[k]; const ain = inside(a), bin = inside(b);
          if (ain && bin) { np.push(b); nIn.push(t); }
          else if (ain && !bin) { np.push(isect(a, b, nx, ny, d)); nIn.push(t); }
          else if (!ain && bin) { np.push(isect(a, b, nx, ny, d)); nIn.push(j); np.push(b); nIn.push(t); }
        }
        pts = np; tags = nIn.map((_, k) => nIn[(k + 1) % nIn.length]);   // outgoing tag of np[k] = the tag arriving at np[k+1]
      }
      if (pts.length < 3) { out.push({ i, pts: [], tags: [], area: 0, cen: [P[i].u, P[i].v], perim: 0, frame: {}, nb: new Map(), vMin: P[i].v }); continue; }
      let area = 0, cx = 0, cy = 0, perim = 0, vMin = Infinity; const frame: Record<string, number> = {}; const nb = new Map<number, number>();
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length]; const cr = a[0] * b[1] - b[0] * a[1]; area += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]); perim += len; const t = tags[k]; vMin = Math.min(vMin, a[1]);
        if (typeof t === 'string') frame[t] = (frame[t] ?? 0) + len; else nb.set(t, (nb.get(t) ?? 0) + len);
      }
      area /= 2; const cen: [number, number] = Math.abs(area) > 1e-9 ? [cx / (6 * area), cy / (6 * area)] : [P[i].u, P[i].v];
      out.push({ i, pts, tags, area: Math.abs(area), cen, perim, frame, nb, vMin });
    }
    return out;
  }
  private supportPass(st: PaneState): number[] {
    const cells = st.cells ?? (st.cells = this.cellsOf(st)); const W = GLASSBREAK.frameW;
    const S: number[] = cells.map(c => ((st.dropped >> c.i) & 1) ? 0 : 1);
    for (let it = 0; it < 6; it++) for (const c of cells) {
      if ((st.dropped >> c.i) & 1 || c.perim <= 0) { S[c.i] = 0; continue; }
      let s = ((c.frame.bottom ?? 0) * W.bottom + ((c.frame.left ?? 0) + (c.frame.right ?? 0)) * W.side + (c.frame.top ?? 0) * W.top) / c.perim * 2.2;
      for (const [j, len] of c.nb) if (!((st.dropped >> j) & 1)) s += GLASSBREAK.neighbourW * S[j] * (len / c.perim) * 1.6;
      S[c.i] = Math.min(1.5, s);
    }
    return S;
  }

  // ---------------------------------------------------------------- stimuli
  /** a round (or anything glass.ts glassHit was told about) met pane `bi` at X flying `dir`: the impact filed, and — by type and count — a cell may go */
  hit(bi: number, X: Vec3, dir: Vec3 | null, who: number, energy = 1) {
    if (!glassBreakLive(this.g)) return;   // the switch off, chaos 0, or the tour = the game byte for byte: glass.ts's star and noise are all that happens
    const st = this.stateOf(bi); if (!st) return;
    const [u, v] = this.toUV(st, X); const seed = hitSeed(bi, X);
    let idx: number;
    // ONCE ANY CELL HAS FALLEN THE SITE SET IS FROZEN: a new site would re-cut the Voronoi under the dropped mask (openAt, the GPU cell table, gbCracks all read the current
    // sites) and glass would re-form in part of the hole with its shards already on the floor — so a later impact counts on the cell it landed in (= its nearest site)
    if (st.dropped !== 0) idx = nearestSite(st, u, v);
    else {
      idx = st.impacts.findIndex(p => Math.hypot(p.u - u, p.v - v) < GLASSBREAK.mergeR);
      if (idx < 0 && st.impacts.length >= Math.min(16, GLASSBREAK.maxImpacts)) idx = nearestSite(st, u, v);
    }
    if (idx >= 0 && this.openCell(st, idx)) return;   // (a round through a hole files nothing — no hit, no damage, no threshold: raycast should not have found the pane; belt and braces)
    st.hits++; st.damage = Math.min(1, st.damage + 0.12 * energy); st.lastWho = who; if (dir && v3.len(dir) > 1e-6) st.lastDir = v3.normalize(dir);
    GB_STATS.impacts++;
    if (idx >= 0) { const p = st.impacts[idx]; p.e += energy; p.hits++; }
    else { st.impacts.push({ u: Math.max(-st.hu * 0.98, Math.min(st.hu * 0.98, u)), v: Math.max(-st.hv * 0.98, Math.min(st.hv * 0.98, v)), e: energy, seed, t: this.g.time, hits: 1 }); idx = st.impacts.length - 1; st.cells = null; }
    const fail = GLASSBREAK.failHits[st.type];
    if (st.type === 'tempered' && st.hits >= fail) this.dice(st, 'hits');
    else if (st.type === 'annealed' && st.hits >= fail) { idx = this.localise(st, idx); this.queueDrop(st, idx, 'hit'); st.nextThink = this.g.time + GLASSBREAK.think; }
    else if (st.type === 'annealed' && st.impacts[idx].hits >= 2) { idx = this.localise(st, idx); this.queueDrop(st, idx, 'hit twice'); st.nextThink = this.g.time + GLASSBREAK.think; }   // the same spot twice goes through before the pane as a whole gives
  }
  /** a stun charge at `at`: every sheet within blastM takes blastImpacts seeded toward its nearest point — the first crackNear's stars, drawn off the same seed and mapping so the
   *  drawn stars sit on Voronoi sites; annealed panes lose the cells the blast reaches, tempered ones dice, laminated star */
  blast(at: Vec3, who: number) {
    if (!glassBreakLive(this.g)) return;   // (as hit(): nothing with the switch off / at chaos 0 / under the tour)
    GB_STATS.blasts++;
    for (const bi of this.g.engine.world.glassStatics) {
      const b = this.g.level.boxes[bi]; if (!b) continue;
      const q = nearestOn(b, at); const d = v3.dist(q, at); if (d > GLASSBREAK.blastM) continue;   // (the range test BEFORE any state is made: a far pane is not 'touched')
      const st = this.stateOf(bi); if (!st) continue;
      let s = hitSeed(bi, at); const k = 1 - d / GLASSBREAK.blastM;
      for (let n = 0; n < GLASSBREAK.blastImpacts; n++) {
        s = (Math.imul(s ^ (s >>> 15), 0x2C1B3C6D) + 0x297A2D39) >>> 0;
        const fu = ((s & 0xffff) / 65535) * 2 - 1, fv = ((s >>> 16) / 65535) * 2 - 1;
        const anywhere = this.toWorld(st, fu * 0.9 * st.hu, fv * 0.9 * st.hv);   // glass.ts crackNear's construction: a point on the face inside its frame by a tenth, pulled a third of the way toward where the blast was nearest
        this.hit(bi, v3.lerp(anywhere, q, 0.35), v3.sub(q, at), who, 0.6 + k);
      }
      st.lastDir = d > 1e-6 ? v3.normalize(v3.sub(q, at)) : this.normalOf(st);
      if (st.type === 'tempered' && k > 0.25) this.dice(st, 'blast');
      else if (st.type === 'annealed' && k > 0.3) { const cells = st.cells ?? (st.cells = this.cellsOf(st)); const reach = 1.0 * k + 0.15; for (const c of cells) { const w = this.toWorld(st, c.cen[0], c.cen[1]); if (v3.dist(w, q) < reach) this.queueDrop(st, c.i, 'blast'); } st.nextThink = this.g.time + 0.05; }
    }
  }
  /** Before the FIRST cell of a pane is queued to fall: if the cell under impact `idx` is bigger than cellMaxM2 (few sites on a big sheet), seed ringSites zero-energy sites on a hashed
   *  ring round the impact (the crack tips) so the piece that goes is local to the blow. Only while nothing has fallen (the frozen-site rule) and the list has room. Returns idx. */
  private localise(st: PaneState, idx: number): number {
    if (st.dropped !== 0 || st.pending.length) return idx;
    const cells = st.cells ?? (st.cells = this.cellsOf(st)); const c = cells.find(x => x.i === idx);
    if (!c || c.area <= GLASSBREAK.cellMaxM2) return idx;
    const p = st.impacts[idx]; const K = Math.max(3, GLASSBREAK.ringSites - 1 + ((p.seed >>> 11) % 3)); let added = 0;   // 5, 6 or 7 tips off the impact's seed — an irregular polygon, not a stamped hexagon
    for (let k = 0; k < K && st.impacts.length < Math.min(16, GLASSBREAK.maxImpacts); k++) {
      const h1 = hash01(p.seed ^ (k * 0x9E3779B1)), h2 = hash01((p.seed + 0x51ED27) ^ (k * 0x85EBCA77));
      const ang = (k + 0.8 * (h1 - 0.5)) / K * Math.PI * 2 + (p.seed & 1023) / 1023 * Math.PI, r = GLASSBREAK.ringR * (0.65 + 0.7 * h2);   // each tip's bearing jittered by most of a step and its reach by ±35 %
      const u = Math.max(-st.hu * 0.98, Math.min(st.hu * 0.98, p.u + Math.cos(ang) * r)), v = Math.max(-st.hv * 0.98, Math.min(st.hv * 0.98, p.v + Math.sin(ang) * r));
      if (st.impacts.some(q => Math.hypot(q.u - u, q.v - v) < GLASSBREAK.mergeR)) continue;
      st.impacts.push({ u, v, e: 0, seed: (p.seed ^ (0xC2B2AE3D * (k + 1))) >>> 0, t: this.g.time, hits: 0 }); added++;
    }
    if (added) { st.cells = null; st.log.push(`ring of ${added} crack tips round impact ${idx}`); if (st.log.length > 16) st.log.shift(); }
    return idx;
  }
  private queueDrop(st: PaneState, i: number, why: string) { if ((st.dropped >> i) & 1 || st.pending.includes(i) || st.type === 'laminated') return; st.pending.push(i); st.log.push(`cell ${i} ${why}`); if (st.log.length > 16) st.log.shift(); }
  private dice(st: PaneState, why: string) {
    if (st.dropped === (1 << st.impacts.length) - 1 && st.impacts.length > 0) return;
    // a tempered pane needs sites everywhere to come apart everywhere: pad the impact list with a hashed lattice, then every cell goes at once — mostly as chips
    // (a tempered pane never loses a cell before it dices, so the padding always runs; the `dropped === 0` guard keeps the frozen-partition rule whole)
    let s = hitSeed(st.bi, st.box.c);
    while (st.dropped === 0 && st.impacts.length < Math.min(16, GLASSBREAK.maxImpacts)) { s = (Math.imul(s ^ (s >>> 15), 0x2C1B3C6D) + 0x297A2D39) >>> 0; const fu = ((s & 0xffff) / 65535) * 2 - 1, fv = ((s >>> 16) / 65535) * 2 - 1; st.impacts.push({ u: fu * st.hu * 0.95, v: fv * st.hv * 0.95, e: 0.5, seed: s, t: this.g.time, hits: 0 }); }
    st.cells = this.cellsOf(st); GB_STATS.diced++; this.note(`pane ${st.bi} DICES (${why})`);
    for (const c of st.cells) this.dropCell(st, c, true);
    st.pending.length = 0;
  }
  private openCell(st: PaneState, i: number): boolean { return ((st.dropped >> i) & 1) === 1; }

  // ---------------------------------------------------------------- per frame
  update(_dt: number) {
    this.shardsThisFrame = 0;
    if (this.gusts.size || this.gustDirty) { this.updateGusts(); this.gustDirty = this.gusts.size > 0; }
    if (!glassBreakLive(this.g)) return;   // (as hit / blast: a pane still shedding a tongue when the tour starts, the switch goes off or chaos drops to 0 sheds nothing more and files no noise — wave-4 review)
    this.eventsThisFrame.clear();
    for (const st of this.panes.values()) {
      if (!st.pending.length && st.nextThink <= 0) continue;
      if (this.g.time < st.nextThink) continue;
      st.nextThink = 0; GB_STATS.thinks++;
      const cells = st.cells ?? (st.cells = this.cellsOf(st));
      // the queued cells first (this frame's budget of rigid spawns; the rest wait a think), then the support pass over what is left
      while (st.pending.length && this.shardsThisFrame < GLASSBREAK.shardsPerFrame) { const i = st.pending.shift()!; const c = cells.find(x => x.i === i); if (c && !this.openCell(st, i)) this.dropCell(st, c, false); }
      if (st.pending.length) { st.nextThink = this.g.time + 0.05; continue; }
      if (st.type === 'laminated' || st.dropped === 0) continue;
      st.support = this.supportPass(st);
      let fell = 0;
      for (const c of cells) if (!this.openCell(st, c.i) && st.support[c.i] < GLASSBREAK.dropSupport && c.area > 1e-4) { st.pending.push(c.i); fell++; st.log.push(`cell ${c.i} unsupported (${st.support[c.i].toFixed(2)})`); if (st.log.length > 16) st.log.shift(); }
      if (fell) st.nextThink = this.g.time + GLASSBREAK.think;   // the tongue follows a beat later
    }
  }
  private dropCell(st: PaneState, c: Cell, dicing: boolean) {
    if (this.openCell(st, c.i)) return;
    st.dropped |= 1 << c.i; GB_STATS.dropped++;   // (cells stay: the polygon partition does not change when one falls — the site set is frozen from here on)
    st.walkable = this.walkableNow(st);
    const g = this.g; const n = this.normalOf(st); const outSign = v3.dot(n, st.lastDir) >= 0 ? 1 : -1;   // fall out on the side the blow was going
    const cw = this.toWorld(st, c.cen[0], c.cen[1]);
    // rigid shards: 1‥3 thin boxes over the polygon (a diced pane: crumbs for the biggest cells only)
    const P = gpuFx(g);
    const nSh = dicing ? (c.area > 0.04 && this.shardsThisFrame < GLASSBREAK.diceCrumbs ? 1 : 0) : Math.max(1, Math.min(3, Math.round(c.area / 0.07)));
    for (let k = 0; k < nSh; k++) {
      const h1 = hash01(st.bi * 7919 + c.i * 131 + k * 17), h2 = hash01(st.bi * 104729 + c.i * 193 + k * 29), h3 = hash01(c.i * 7 + k * 3 + st.bi);
      const vtx = c.pts[k % Math.max(1, c.pts.length)] ?? c.cen;
      const pu = c.cen[0] * (nSh === 1 ? 1 : 0.6) + vtx[0] * (nSh === 1 ? 0 : 0.4), pv = c.cen[1] * (nSh === 1 ? 1 : 0.6) + vtx[1] * (nSh === 1 ? 0 : 0.4);
      const side = Math.sqrt(c.area / nSh) * (dicing ? 0.35 : 0.92); const su = side * (0.8 + 0.4 * h1), sv = side * (0.8 + 0.4 * h2);
      const hh: Vec3 = st.uAxis === 0 ? [su / 2, sv / 2, Math.max(0.006, st.ht)] : [Math.max(0.006, st.ht), sv / 2, su / 2];
      const box = makeBox({ c: this.toWorld(st, pu, pv, outSign * 0.02), h: hh, yaw: st.box.yaw, albedo: v3.copy(GLASSBREAK.shardAlbedo), flags: BoxFlag.Dynamic });
      const vel: Vec3 = v3.add(v3.scale(n, outSign * GLASSBREAK.shardOut * (0.4 + h3)), [0, -0.2 - 0.6 * h1, 0]);
      const w: Vec3 = [(h1 - 0.5) * GLASSBREAK.shardSpin, (h2 - 0.5) * 2, (h3 - 0.5) * GLASSBREAK.shardSpin];
      const ch = g.destr.debris.spawn('shard', box, vel, w, st.lastWho);
      if (ch) { ch.box.rough = 0.05; this.shardsThisFrame++; GB_STATS.shards++; } else { GB_STATS.refused++; }
    }
    // chips: pale specks thrown out and down from across the cell (GPU particles; nothing with them off / headless)
    if (P) { const nChips = Math.round(Math.max(GLASSBREAK.chipsMin, c.area * (dicing ? GLASSBREAK.diceChipsPerM2 : GLASSBREAK.chipsPerM2))); P.emit('debris', cw, v3.scale(n, outSign), nChips, { shape: 'cone', speed: 1.1, speedJit: 0.8, spread: 1.2, life: 30, lifeJit: 0.4, size: dicing ? 0.012 : 0.008, sizeJit: 0.6, aspect: 1.4, posJit: Math.sqrt(c.area) * 0.45, color: v3.copy(GLASSBREAK.chipColor) }); GB_STATS.chips += nChips; }
    if (!this.eventsThisFrame.has(st.bi)) {   // ONE crack sound and ONE hearing event per pane per frame: a diced window is sixteen cells in a frame, and every event costs every man a propagation (wave-4 review)
      this.eventsThisFrame.add(st.bi);
      g.audio.play('glassCrack', cw, dicing ? 1.0 : 0.75, { rate: dicing ? 0.7 : 1.25 + 0.3 * hash01(c.i + st.bi) });
      g.events.push({ kind: 'glass', pos: [cw[0], 0, cw[2]], time: g.time, loud: true, level: 1.0, who: st.lastWho });
    }
    if (st.exterior) this.gustDirty = true;
  }
  /** the movement rule: every cell of the (frozen) partition that reaches below walkClearH above the floor has fallen */
  private walkableNow(st: PaneState): boolean {
    if (st.dropped === 0) return false;
    const cells = st.cells ?? (st.cells = this.cellsOf(st)); const vClear = GLASSBREAK.walkClearH - st.box.c[1];   // pane-local v of the clearance height
    for (const c of cells) if (c.pts.length >= 3 && c.area > 1e-4 && c.vMin < vClear && !this.openCell(st, c.i)) return false;
    return true;
  }
  gustDirty = false;
  /** GUSTS through shot-out exterior panes: one wind source per pane more than a quarter open (a jet along the inward normal like an open door's, wind.ts 'glass'), its speed each
   *  frame = the storm at that face × the open share — the particles (papers by the window) and the smoke solver read the one field */
  private gusts = new Map<number, WindSource>();
  /** panes that have already sounded / filed their hearing event this frame (dropCell) */
  private eventsThisFrame = new Set<number>();
  private updateGusts() {
    const g = this.g; const swv = g.wind.stormWind();   // wind.ts's ONE storm test (weather on, night, WIND.storm, the storm or rain actually running): a dead calm or the daylight breach blows nothing through a hole (wave-4 review)
    const sw = swv ? [swv[0], swv[2]] : null;
    const stormSpeed = sw ? Math.hypot(sw[0], sw[1]) : 0;
    for (const st of this.panes.values()) {
      if (!st.exterior) continue;
      const open = this.openFraction(st.bi);
      let src = this.gusts.get(st.bi);
      if (open < 0.25 || stormSpeed < 0.05) { if (src) src.base = 0; continue; }
      if (!src) {
        const n = this.normalOf(st); const c = st.box.c; const I = WEATHER_INTERIOR;
        const inside = (p: Vec3) => p[0] > I[0] && p[0] < I[2] && p[2] > I[1] && p[2] < I[3];
        const inward: Vec3 = inside(v3.mad(c, n, 0.5)) ? n : v3.scale(n, -1);
        const reach = WIND.doorReach, dMax = WIND_FIELD.cutK * reach, tanSpread = Math.tan(WIND.doorSpreadDeg * Math.PI / 180), r0 = st.hu * 0.7;
        const pos: Vec3 = [c[0] - inward[0] * 0.15, c[1], c[2] - inward[2] * 0.15];
        src = { kind: 'jet', why: 'glass', name: `glass:${st.bi}`, pos, dir: inward, speed: 0, base: 0, on: 1, gust: 1, reach, tanSpread, r0, dMax, bound: { c: v3.mad(pos, inward, dMax / 2), r: Math.hypot(dMax / 2, r0 + dMax * tanSpread) + 0.3 }, seed: (0x61A55 ^ (st.bi * 2654435761)) >>> 0 } as WindSource;
        g.wind.all.push(src); this.gusts.set(st.bi, src); this.note(`gust source through pane ${st.bi}`);
      }
      const facing = Math.max(0, (sw![0] * src.dir[0] + sw![1] * src.dir[2]) / Math.max(1e-3, stormSpeed));
      src.base = stormSpeed * WIND.doorK * open * (0.35 + 0.65 * facing) * GLASSBREAK.gustSpeedK / 0.6;
    }
  }

  // ---------------------------------------------------------------- queries
  /** is world point X (on / near pane bi) inside a cell that has fallen out? (StaticCollision's raycast / segmentBlocked ask this to let rounds, sound and a step test through the hole;
   *  the same nearest-site rule common.wgsl glassCellOpen runs on the GPU table) */
  openAt(bi: number, X: Vec3): boolean {
    const st = this.panes.get(bi); if (!st || st.dropped === 0) return false;
    const [u, v] = this.toUV(st, X); const best = nearestSite(st, u, v);
    return best >= 0 && ((st.dropped >> best) & 1) === 1;
  }
  /** the movement rule's answer for pane bi (false for a pane never hit) */
  walkable(bi: number): boolean { return this.panes.get(bi)?.walkable === true; }
  /** open fraction of pane bi (0 = whole) — by cell area */
  openFraction(bi: number): number { const st = this.panes.get(bi); if (!st || st.dropped === 0) return 0; const cells = st.cells ?? (st.cells = this.cellsOf(st)); let a = 0; for (const c of cells) if ((st.dropped >> c.i) & 1) a += c.area; return Math.min(1, a / (4 * st.hu * st.hv)); }
  /** the cell table rows for the renderer (boxes.ts packGlass → common.wgsl gbHeader / gbSite / gbEnergy) */
  fill(bi: number, dst: Float32Array, off: number): boolean {
    const st = this.panes.get(bi); if (!st || st.impacts.length === 0) return false;
    dst[off] = st.impacts.length; dst[off + 1] = st.dropped >>> 0; dst[off + 2] = st.uAxis === 0 ? 0 : 1; dst[off + 3] = st.damage;
    dst[off + 4] = st.hu; dst[off + 5] = st.hv; dst[off + 6] = st.type === 'laminated' ? 2 : st.type === 'tempered' ? 1 : 0; dst[off + 7] = 0;
    for (let i = 0; i < st.impacts.length; i++) { const p = st.impacts[i]; dst[off + 8 + i * 2] = p.u; dst[off + 9 + i * 2] = p.v; dst[off + 40 + i] = Math.min(4, p.e); }
    return true;
  }
  /** the panel's 'break test': star AND hole the pane on Sam's line to the cursor (3 hits at the aim point through glass.ts glassHit, as three rounds in one spot would) — returns the pane or −1 */
  breakTest(): number {
    const g = this.g; const aim = g.aimPoint; const from: Vec3 = v3.add(g.player.char.pos, [0, 1.3, 0]);
    const d = v3.sub(aim, from); const L = v3.len(d); if (L < 1e-3) return -1;
    const rd = v3.scale(d, 1 / L); const h = g.col.raycast(from, rd, L + 6);
    if (!h || h.index >= 1e6) return -1;
    const b = g.level.boxes[h.index]; if (!b || !(b.flags & BoxFlag.Glass) || Math.min(b.h[0], b.h[2]) > 0.05) return -1;
    const X = v3.mad(from, rd, h.t);
    for (let k = 0; k < 3; k++) glassHit(g, h.index, X, rd, 0, 'hand');   // through glass.ts (the star, the crack heard) → hit() here, exactly a round's path
    return h.index;
  }
  summary(): string { const T = this.g.tune as GbTune; let s = `glass breaking ${T.glassBreak ? (glassBreakLive(this.g) ? 'ON' : 'on — but inert (chaos 0 / the tour)') : 'off'} ▸ ${this.panes.size} panes touched · ${GB_STATS.impacts} impacts · ${GB_STATS.dropped} cells out · ${GB_STATS.shards} shards (${GB_STATS.refused} refused) · ${GB_STATS.chips} chips · diced ${GB_STATS.diced}`; for (const st of this.panes.values()) if (st.dropped) s += ` | pane ${st.bi} ${st.type} ${Math.round(100 * this.openFraction(st.bi))}% open${st.walkable ? ' (walkable)' : ''}`; return s; }
  reset() { this.panes.clear(); for (const src of this.gusts.values()) { const i = this.g.wind.all.indexOf(src); if (i >= 0) this.g.wind.all.splice(i, 1); } this.gusts.clear(); this.gustDirty = false; }
}
/** the site whose Voronoi cell holds pane-local (u, v) (−1 for a pane with no impacts) */
function nearestSite(st: PaneState, u: number, v: number): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < st.impacts.length; i++) { const p = st.impacts[i]; const d = (p.u - u) ** 2 + (p.v - v) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
function isect(a: [number, number], b: [number, number], nx: number, ny: number, d: number): [number, number] {
  const da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d; const t = da / (da - db);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function nearestOn(b: Box, p: Vec3): Vec3 {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const px = p[0] - b.c[0], pz = p[2] - b.c[2];
  const lx = Math.max(-b.h[0], Math.min(b.h[0], cs * px - sn * pz)), lz = Math.max(-b.h[2], Math.min(b.h[2], sn * px + cs * pz)), ly = Math.max(-b.h[1], Math.min(b.h[1], p[1] - b.c[1]));
  return [b.c[0] + cs * lx + sn * lz, b.c[1] + ly, b.c[2] - sn * lx + cs * lz];
}
