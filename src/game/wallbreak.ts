// WALL BREAKING — the destruction engine for what a loud fight does to the LEVEL ITSELF: interior partition walls and cover come apart under rounds and blasts
// ("walls and cover break apart in a firefight"). It hangs off the destruction lane (game/destruction.ts: `g.destr.walls`), behind THE ONE SWITCH of the
// destruction goal (game/destructionSwitch.ts DESTRUCTION.on — off in the module, the page raises it; off = the one build by digest), the lane's knob
// (`tune.chaos` 0 = nothing here ever runs) and its own `tune.wallBreak` (default on; off = the lane before this).
//
// WHAT BREAKS (found by SHAPE once at construction, like the lane's paper and clutter — the runtime Box carries no material key):
//   WALL   an interior partition: a floor-standing, full-height (top ≥ 2.2 m), thin (≤ 17 cm), unrotated static in the 'wall' paint with ceiling over both of its
//          faces. Cut into 0.5 m COLUMNS of two cells: the SILL (floor → 0.7 m) and the UPPER (0.7 m → top).
//            · sustained FIRE into a column knocks its upper out — a PORT: rounds, eyes and sound pass over the sill, feet do not;
//            · fire kept on a sill whose upper is gone takes the sill too; a BLAST opens whole columns — a HOLE a man walks through (≥ 3 columns = 1.5 m wide
//              when a charge goes off against the wall).
//   COVER  floor-standing wood / cardboard / fabric-partition / low plaster furniture big enough to stand behind (crates, pallets, desk panels, shelving, low
//          partitions). Cut into ~0.5 m plan cells; a cell that has taken its rounds is GONE top to bottom (chewed from the shooter's side inward), a blast takes
//          every cell it reaches. What stood on it falls (the lane's own knock-offs for clutter and paper, a rigid chunk for the rest).
//   Thick / concrete / outer walls, metal and anything that lights or carries a fixture only SCAR (the lane's marks, as before) — but for the ONE wall a breaching
//   charge is set on (`adopt`, BlastOpts.breach — wallcharge.ts WALLCHARGE.outer: an outer wall): that wall is taken on as a HARD wall on the frame its charge
//   goes, opened by that blast alone (a hole of minHole columns, no ports) and by nothing after it; rounds still only scar it. DOORS and GLASS are not this
//   module's: a blast reaches the doors through Destruction.blast's call list (g.doors.blast, then the wall is judged) and anyone else through destr.onBlast (the
//   glass hears a charge off its own 'bang' event as it always did); their state is their own, and
//   they may file their own rows in the feed (`walls.note`).
//
// ONE MODEL. A broken thing is broken for everyone because it is broken in the ONE place every question is asked of: the level's static boxes. The authored box
// is hidden (NoPrimary | NoShadow — the flags every ray, the raster and every CPU query already honour at query time) and what still stands is rebuilt as PIECES:
// plain static boxes APPENDED to the level's list (StaticCollision.addStatic + BoxWorld.addStatic, registered in the authored box's cells), greedy-merged from
// the closed cells, re-shaped in place as more goes. So rounds (col.raycast), sight (segmentBlocked), sound / reach (solidBlocked + SoundPaths, its route cache
// dropped), feet (collideCircle), the trace grid and raster (BoxWorld.upload re-packs changed statics), the smoke solver's obstacles and the lights' reach masks
// (Game.reachChanged: only the cells behind the opening are decided again, a few lights a frame) all read the same boxes. The NAV GRID is re-baked over the changed footprint with the constructor's own
// statement (NavGrid.rebake) and the cells that became floor are handed to the AI.
//
// THE AI IS TOLD: `walls.serial` goes up with every change and `walls.changes` (a ring of LevelChange rows: kind hole | port | cover | door | reset, where, the nav
// cells that opened, whether a man fits through, whose doing) says what; `walls.onChange(fn)` calls back on the frame; `walls.since(serial)` reads the tail.
//
// A ROUND NEVER GOES ON PAST WHAT IT HIT here: the one place a round is stopped stays combat.ts fireWeapon's `g.col.raycast` — an opened cell is simply not there
// for the NEXT round's ray. Nothing in this module continues, splits or re-fires a round (no second round loop to keep in step with the glass goal's).
//
// BOUNDED: ≤ WALLS.maxPieces appended statics (a change that would need more is REFUSED — the round only scars — and counted), the lane's debris pool for what
// falls, ≤ WALLS.maxChanges rows. DETERMINISTIC: no Math.random, every choice hashes the module's own counter. RESET with the level (Destruction.reset): authored
// boxes back as they were, appended statics cut off, nav re-baked. CHECKPOINTS carry it: savestate.ts files `snapshot()` and re-applies it after the restart; the
// level fingerprint is taken over the AUTHORED statics only.
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { WORLD } from '../scene/world';
import type { Game } from './game';
import type { WeaponDef } from './weapons';
import type { Destruction } from './destruction';
import { gpuFx, paletteName, surfOf, type Surf } from './particleFx';
import { hash01 } from './debris';
import { NOBODY_ID } from './consts';
import { DESTRUCTION } from './destructionSwitch';
import { cutBoxesOn } from '../scene/cut';
import type { ShedBudget } from './breakTable';
import { WallWear } from './wallwear';
import { messOpened } from './floormess';
import { leafRound } from './doorblast';

// ------------------------------------------------------------------ knobs
export const WALLS = {
  /** what counts as a partition wall */
  wallMaxThick: 0.17, wallMinTop: 2.2, wallMinLen: 0.5,
  /** m: a wall column / a cover cell (the nearest whole division of the box) */
  col: 0.5,
  /** m: what stands of a column after a port */
  sill: 0.7,
  /** rifle rounds into ONE cell at chaos 0.5 before it goes (a pistol round counts pistolK); × sillK for a wall's sill */
  tough: { drywall: 6, wood: 9, cardboard: 3, fabric: 4 } as Record<string, number>,
  sillK: 1.5, pistolK: 0.5,
  /** cover: tall enough to matter, big enough to stand behind */
  coverMinTop: 0.45, coverMinLen: 0.4, coverMaxCells: 48,
  /** a blast of radius R (× power): columns within holeK·R go whole, within portK·R lose their upper; cover cells within coverK·R go; a hole is widened to minHole
   *  columns when the charge lay within contactM of the wall (a man must fit); doorK·R is the tear distance handed to the doors' own g.doors.blast */
  blast: { radius: 2.2, holeK: 0.45, portK: 0.8, coverK: 0.7, doorK: 0.6, minHole: 3, contactM: 0.8 },
  /** caps */
  maxPieces: 512, maxChanges: 256, chunksPerCell: 2, chunksPerBlast: 10, fallMaxVol: 0.5, fallsPerChange: 48,
  /** what counts as a BOARD hung on a wall for a charge set on it (`hungAt`): no deeper off the face than `deep`, at least `long` along the wall and `tall` (m) */
  hung: { deep: 0.1, long: 0.5, tall: 0.3 },
};
export const WALLS_DEFAULTS = JSON.parse(JSON.stringify(WALLS)) as typeof WALLS;
/** the switch as the engine reads it: THE ONE SWITCH on (destructionSwitch.ts) AND tune.wallBreak not put off, outside the showcases (chaos > 0 is the caller's test) */
export function wallBreakOn(g: Game): boolean { return DESTRUCTION.on && g.tune.wallBreak !== false && (g.destr?.showChaos ?? null) === null; }   // (never under a showcase's own chaos: a scripted show keeps the level it was walked on)

// ------------------------------------------------------------------ types
export type LevelChangeKind = 'hole' | 'port' | 'cover' | 'door' | 'reset';
/** One row of the change feed — what the AI reads to learn the level is not the level it planned on. */
export interface LevelChange {
  serial: number;
  /** game time */
  t: number;
  /** hole = a wall opened floor to top somewhere (feet may pass — see `walkable`) · port = a wall's upper knocked out (rounds / eyes / sound pass, feet do not) ·
   *  cover = a piece of cover lost cells (`dead` = all of it) · door = a doorway changed for good (filed by the doors' own code through `walls.note` — nothing in
   *  this module makes one) · reset = the level put back, or a checkpoint's state applied (re-read everything) */
  kind: LevelChangeKind;
  cause: 'fire' | 'blast' | 'collapse' | 'load' | 'reset';
  /** the authored static's index (walls / cover), the door's index in g.doors.list (door), −1 (reset) */
  id: number;
  /** door name for a door row */
  name?: string;
  /** world centre of what opened, and its XZ bounds [x0, z0, x1, z1] */
  pos: Vec3; rect: [number, number, number, number];
  /** nav cells (g.col.nav.idx) that became floor with this change */
  opened: number[];
  /** a man can now go where it stood (some nav cell opened) */
  walkable: boolean;
  /** eyes and rounds pass where they did not */
  sight: boolean;
  /** nothing of it stands any more */
  dead: boolean;
  /** whose doing (character id; NOBODY_ID = no one's) */
  who: number;
}
export interface BlastOpts {
  /** m: what the blast breaks within (default WALLS.blast.radius 2.2) */
  radius?: number;
  /** × the radius for breaking (default 1) */
  power?: number;
  /** character id of whoever set it off (default nobody) */
  who?: number;
  /** also run the lane's old bang() chaos — dust, tiles, clutter, papers (default true) */
  chaos?: boolean;
  /** A BREACHING CHARGE SET ON A HARD WALL: the authored static it is on (one WallBreak.adopt took on). This blast, lying against it, opens a hole of
   *  WALLS.blast.minHole columns in it at the charge; without it no blast opens a hard wall. Absent = every blast as it was */
  breach?: number;
  /** A CHARGE SET ON WHAT HANGS ON A WALL (wallcharge.ts WALLCHARGE.hung): the authored wall static the charge is set on, and how far round the charge counts
   *  as under it (m, on the plan). Lying against that wall the blast opens it AT THE CHARGE whatever stands on its face (a sign, a set, a board: the hole of
   *  WALLS.blast.minHole columns, as a hard wall's); the BOARDS hung on that face there (`hungAt`) shield nothing from this blast at all, and once the wall
   *  holes they go with it, in pieces. Absent = every blast as it was */
  hung?: { wall: number; r: number };
}
/** One wall or cover piece a blast WOULD open (`WallBreak.wouldOpen`, `Destruction.wallsFor`): see `wouldOpen`. */
export interface WallOpening { id: number; kind: 'wall' | 'cover'; standing: Box[]; left: Box[]; cells: number; hole: boolean }
/** what a blast did: walls holed / ported, cover pieces that lost cells, door leaves the doors' code took off, panes the glass code changed, nav cells that became
 *  floor, and the feed's serial after it */
export interface BlastResult { walls: number; cover: number; doors: number; panes: number; opened: number; serial: number }
/** what Destruction.onBlast subscribers are handed, BEFORE the walls are judged (the doors go first; a leaf torn off on this frame is by then a slab lying at its frame, not a standing leaf): where, the breaking
 *  radius in metres (radius × power as resolved), the caller's raw opts, whose doing */
export interface BlastEvent { at: Vec3; radius: number; power: number; who: number; /** the result being built: a subscriber adds what it took (res.doors, res.panes) */ res: BlastResult }

type BKind = 'wall' | 'cover';
interface Breakable {
  /** static index of the authored box */
  id: number; kind: BKind; surf: Surf; box: Box; flags0: number;
  nx: number; ny: number; nz: number;
  /** local y of the band boundaries (ny + 1) */
  yb: number[];
  /** per cell: 1 = gone; damage taken */
  open: Uint8Array; dmg: Float32Array;
  /** appended statics standing in for it (indices into the level's list), how many are in use */
  slots: number[]; live: number;
  nOpen: number;
  /** a wall taken on for a breaching charge (adopt): rounds only scar it, and no blast opens it but the one that names it (BlastOpts.breach) */
  hard?: boolean;
}
/** what a checkpoint keeps (savestate.ts): only what is not pristine */
export interface WallsSave { v: 1; b: [id: number, open: string, dmg: number[], /** 1 = a hard wall (adopt): taken on again when the file is applied */ hard?: 1][]; /** the boards a charge set on them took with the wall, beyond what the open cells say (BlastOpts.hung): each authored static with its wall's, ascending — absent when none */ h?: [board: number, wall: number][] }

export const WALL_STATS = { rounds: 0, ports: 0, holes: 0, coverCells: 0, coverDead: 0, blasts: 0, refused: 0, falls: 0, floating: 0, chunks: 0, chunksDemoted: 0, navOpened: 0 };
export const WALL_LOG: string[] = [];

const HIDE = BoxFlag.NoPrimary | BoxFlag.NoShadow;
interface AABB { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
function aabbOf(b: Box): AABB {
  const cs = Math.abs(Math.cos(b.yaw)), sn = Math.abs(Math.sin(b.yaw)); const ex = cs * b.h[0] + sn * b.h[2], ez = sn * b.h[0] + cs * b.h[2];
  return { x0: b.c[0] - ex, x1: b.c[0] + ex, y0: b.c[1] - b.h[1], y1: b.c[1] + b.h[1], z0: b.c[2] - ez, z1: b.c[2] + ez };
}
const overlapXZ = (a: AABB, b: AABB, eps = 0.01) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > eps && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > eps;

export class WallBreak {
  /** statics the level was authored with: indices below this never move; everything from here up is a piece */
  readonly authored: number;
  /** the change feed */
  serial = 0; changes: LevelChange[] = [];
  private listeners: ((c: LevelChange) => void)[] = [];
  private list: Breakable[] = []; private owner = new Map<number, Breakable>();
  /** statics this module hid because what held them went (index → flags before) */
  private hidden = new Map<number, number>();
  private counter = 1; private dirty = false;
  private scratch = new Int32Array(96); private scratch2 = new Int32Array(96);
  private fixtureBoxes = new Set<number>();
  /** authored statics that are drawn but stop nothing (papers, sheets, placards: NoShadow) — the grid never returns them, so what stands on / hangs from a broken thing is looked for here too */
  private ghosts: number[] = [];
  /** LOOK ONLY (wallwear.ts): what a cell shows while it is being shot — marks that grow with its count, on both faces of a thin wall */
  readonly wear = new WallWear();

  constructor(private g: Game, private destr: Destruction) {
    this.authored = g.col.boxes.length;
    this.index();
  }

  // ---------------------------------------------------------------- index
  private index() {
    const g = this.g, boxes = g.col.boxes;
    for (const t of g.targets) for (const bi of t.boxes) this.fixtureBoxes.add(bi);
    for (const l of g.level.lights) { const fb = (l as { fixtureBox?: number }).fixtureBox; if (fb !== undefined && fb >= 0) this.fixtureBoxes.add(fb); }
    const interior = g.reachInterior; const W = WORLD.gridW, H = WORLD.gridH;
    const roofed = (x: number, z: number) => { if (!interior) return true; const cx = Math.floor(x - WORLD.min[0]), cz = Math.floor(z - WORLD.min[2]); return cx >= 0 && cz >= 0 && cx < W && cz < H && interior[cz * W + cx] === 1; };
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if ((b.flags & (BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass | BoxFlag.Dynamic)) === BoxFlag.NoShadow && b.c[1] - b.h[1] > 0.06 && b.c[0] > WORLD.min[0] && b.c[0] < WORLD.max[0] && b.c[2] > WORLD.min[2] && b.c[2] < WORLD.max[2]) this.ghosts.push(i);
      if (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Dynamic)) continue;
      if (b.rot || b.emissive[0] + b.emissive[1] + b.emissive[2] > 0 || this.fixtureBoxes.has(i) || this.destr.itemOf(i)) continue;
      if (b.c[0] < WORLD.min[0] || b.c[0] > WORLD.max[0] || b.c[2] < WORLD.min[2] || b.c[2] > WORLD.max[2]) continue;
      const name = paletteName(b.albedo); if (!name) continue;
      const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1]; const sx = b.h[0] * 2, sz = b.h[2] * 2; const thin = Math.min(sx, sz), long = Math.max(sx, sz);
      const part = name === 'partRed' || name === 'partBlue' || name === 'partTan';
      let kind: BKind | null = null; let surf: Surf = 'drywall';
      if (y0 <= 0.1 && y1 >= WALLS.wallMinTop && (name === 'wall' || part)) {
        // full height in the wall paints: a partition if it is thin and has ceiling over both faces — else structure (scars only)
        if (thin > WALLS.wallMaxThick || long < WALLS.wallMinLen || Math.abs(Math.sin(b.yaw)) > 1e-6) continue;
        const alongX = sx >= sz; let in2 = 0, n = 0;
        for (const u of [-0.6, 0, 0.6]) { const px = b.c[0] + (alongX ? u * b.h[0] : 0), pz = b.c[2] + (alongX ? 0 : u * b.h[2]); n++; if (roofed(px + (alongX ? 0 : 0.6), pz + (alongX ? 0.6 : 0)) && roofed(px - (alongX ? 0 : 0.6), pz - (alongX ? 0.6 : 0))) in2++; }
        if (in2 * 2 <= n) continue;
        kind = 'wall';
      } else if (y0 <= 0.25 && y1 >= WALLS.coverMinTop && long >= WALLS.coverMinLen && thin >= 0.03) {
        if (name === 'wood' || name === 'woodDark') surf = 'wood'; else if (name === 'cardboard') surf = 'cardboard'; else if (part && thin <= 0.13) surf = 'fabric'; else if (name === 'wall' && y1 < WALLS.wallMinTop) surf = 'drywall'; else continue;
        kind = 'cover';
      }
      if (!kind) continue;
      let nx = 1, ny = 1, nz = 1; const yb: number[] = [-b.h[1], b.h[1]];
      const div = (len: number) => Math.max(1, Math.round(len / WALLS.col));
      if (kind === 'wall') { if (sx >= sz) nx = Math.min(32, div(sx)); else nz = Math.min(32, div(sz)); ny = 2; yb.splice(1, 0, -b.h[1] + (WALLS.sill - y0)); }
      else if (b.round !== true) { nx = div(sx); nz = div(sz); while (nx * nz > WALLS.coverMaxCells) { if (nx >= nz) nx--; else nz--; } }   // (ROUND THINGS, scene/round.ts: a round thing is one cell — it goes whole, for its pieces would be cut from the box round it)
      const n = nx * ny * nz;
      const B: Breakable = { id: i, kind, surf, box: b, flags0: b.flags, nx, ny, nz, yb, open: new Uint8Array(n), dmg: new Float32Array(n), slots: [], live: 0, nOpen: 0 };
      this.list.push(B); this.owner.set(i, B);
    }
  }
  /** counts for the panel / probes */
  inventory() { let walls = 0, cover = 0, wallM = 0; for (const B of this.list) { if (B.kind === 'wall') { walls++; wallM += Math.max(B.box.h[0], B.box.h[2]) * 2; } else cover++; } return { walls, cover, wallM, pieces: this.g.col.boxes.length - this.authored, hidden: this.hidden.size, touched: this.list.filter(B => B.nOpen > 0).length }; }
  /** the breakable a static index belongs to (an authored box or one of its pieces): kind + authored id, or null — what a round met */
  /** THE NAV CELLS A BREACH IN A HARD WALL OPENED (adopt): a doorway with no door between a building and the open — the room fight's rooms stop at them as they
   *  stop at a door's (roomfight.ts roomAt), so a held room stays that room and the yard stays the yard. Empty until an outer wall is breached; cleared by reset. */
  readonly shellGaps = new Set<number>();
  breakableAt(index: number): { id: number; kind: BKind; surf: Surf; open: number; cells: number; hard?: boolean } | null { const B = this.owner.get(index); return B ? { id: B.id, kind: B.kind, surf: B.surf, open: B.nOpen, cells: B.open.length, ...(B.hard ? { hard: true } : null) } : null; }
  /** A BREACHING CHARGE'S WALL. Could authored static `index` be taken on as a hard wall (adopt)? The engine's own test, by shape as index() reads a partition
   *  but for its thickness, its paint and what is over it (the caller's rule — wallcharge.ts says which walls a charge cuts): a plain solid static standing on the
   *  floor to wallMinTop or higher, unrotated, at least one column long, that lights nothing, carries no fixture and is nobody's already. */
  adoptable(index: number): boolean {
    const b = this.g.col.boxes[index]; if (!b || index < 0 || index >= this.authored || this.owner.has(index) || this.hidden.has(index)) return false;
    if (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Dynamic)) return false;
    if (b.rot || Math.abs(Math.sin(b.yaw)) > 1e-6 || b.emissive[0] + b.emissive[1] + b.emissive[2] > 0 || this.fixtureBoxes.has(index) || this.destr.itemOf(index)) return false;
    if (b.c[0] < WORLD.min[0] || b.c[0] > WORLD.max[0] || b.c[2] < WORLD.min[2] || b.c[2] > WORLD.max[2]) return false;   // (index's own bound)
    return b.c[1] - b.h[1] <= 0.1 && b.c[1] + b.h[1] >= WALLS.wallMinTop && Math.max(b.h[0], b.h[2]) * 2 >= WALLS.wallMinLen;
  }
  /** … and take it on: from here static `index` is a wall of this engine's, cut in WALLS.col columns of a sill and an upper like a partition (no cap on their
   *  number: an outer wall runs the building's length), HARD (Breakable.hard). Called by the charge on the frame it goes off, so a level nobody has charged holds
   *  no hard wall and every list this module keeps is the level's own; reset() lets it go again. true = it is one (now, or since an earlier charge). */
  /** the columns a hard wall is cut into along its length (adopt; a checkpoint's row is 2 × this long: check) */
  private hardCols(b: Box): number { return Math.min(32, Math.max(1, Math.floor(Math.max(b.h[0], b.h[2]) * 2 / WALLS.col + 1e-6))); }   // (columns never narrower than WALLS.col; index's own cap: a wall past 16 m has wider ones)
  adopt(index: number): boolean {
    const had = this.owner.get(index); if (had) return had.id === index && had.kind === 'wall' && !!had.hard;
    if (!this.adoptable(index)) return false;
    const b = this.g.col.boxes[index], sx = b.h[0] * 2, sz = b.h[2] * 2, cols = this.hardCols(b);
    const nx = sx >= sz ? cols : 1, nz = sx >= sz ? 1 : cols, n = nx * 2 * nz;
    const B: Breakable = { id: index, kind: 'wall', surf: surfOf(b.albedo), box: b, flags0: b.flags, nx, ny: 2, nz, yb: [-b.h[1], -b.h[1] + (WALLS.sill - (b.c[1] - b.h[1])), b.h[1]], open: new Uint8Array(n), dmg: new Float32Array(n), slots: [], live: 0, nOpen: 0, hard: true };
    this.list.push(B); this.owner.set(index, B);
    return true;
  }
  /** what the cell a round stopping in static `index` at `hitP` (travelling `dir`) would count on still wants before it gives, in round()'s own weighted units
   *  (a rifle round at chaos 0.5 = 1) — null: not a breakable, a door leaf, or that cell already gone. Reads only: the AI asks it before it spends rounds on a
   *  piece (coverfire.ts). The cell is found exactly as round() finds it, the sill-under-a-standing-upper rule included. */
  workLeft(index: number, hitP: Vec3, dir: Vec3, through = 0): number | null {
    const B = index < 1e6 ? this.owner.get(index) : undefined; if (!B || B.hard) return null;   // (a hard wall is nothing rounds work on)
    const cell = (ix: number, iy: number, iz: number): [number, number | null] => {
      if (B.kind === 'wall' && iy === 0 && !B.open[this.ci(B, ix, 1, iz)]) iy = 1;
      const c = this.ci(B, ix, iy, iz);
      return [c, B.open[c] ? null : Math.max(0, (WALLS.tough[B.surf] ?? 8) * (B.kind === 'wall' && iy === 0 ? WALLS.sillK : 1) - B.dmg[c])];
    };
    const [c0, first] = cell(...this.cellAt(B, v3.mad(hitP, dir, 0.02), this.g.col.boxes[index])); if (first === null || through <= 0) return first;
    // `through` m: plus every further standing cell of this breakable the line crosses within that far (a stack several cells deep is that many cells' work to a
    // man behind it; cells beyond where he is are none of it)
    let sum = first; const seen = new Set([c0]), h = B.box.h;
    for (let s = 0.1; s < through; s += 0.1) {
      const p = v3.mad(hitP, dir, s), l = this.toLocal(B, p); if (Math.abs(l[0]) > h[0] || Math.abs(l[1]) > h[1] || Math.abs(l[2]) > h[2]) break;
      const [c, left] = cell(...this.cellAt(B, p)); if (!seen.has(c)) { seen.add(c); if (left !== null) sum += left; }
    }
    return sum;
  }
  /** every breakable (authored index, kind, box, cells open / total) — the panel, the probes, the AI part */
  all(): { id: number; kind: BKind; surf: Surf; box: Box; open: number; cells: number }[] { return this.list.map(B => ({ id: B.id, kind: B.kind, surf: B.surf, box: B.box, open: B.nOpen, cells: B.open.length })); }

  // ---------------------------------------------------------------- geometry
  private hash(): number { return hash01(this.counter++ * 2654435761); }
  private toLocal(B: Breakable, p: Vec3): Vec3 { const b = B.box; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const px = p[0] - b.c[0], pz = p[2] - b.c[2]; return [cs * px - sn * pz, p[1] - b.c[1], sn * px + cs * pz]; }
  private toWorld(B: Breakable, l: Vec3): Vec3 { const b = B.box; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return [b.c[0] + cs * l[0] + sn * l[2], b.c[1] + l[1], b.c[2] - sn * l[0] + cs * l[2]]; }
  private ci(B: Breakable, ix: number, iy: number, iz: number) { return (iy * B.nz + iz) * B.nx + ix; }
  private xb(B: Breakable, ix: number) { return -B.box.h[0] + 2 * B.box.h[0] * ix / B.nx; }
  private zb(B: Breakable, iz: number) { return -B.box.h[2] + 2 * B.box.h[2] * iz / B.nz; }
  /** the cell holding world point p — clamped into the static `inside` when given (the piece a round stopped in: a hit on a piece's very edge or corner must
   *  count on a cell of THAT piece, never on the open cell beside it) */
  private cellAt(B: Breakable, p: Vec3, inside?: Box): [number, number, number] {
    const l = this.toLocal(B, p); const b = B.box; const cl = (v: number, n: number) => Math.max(0, Math.min(n - 1, v));
    if (inside && inside !== b) { const c = this.toLocal(B, inside.c); for (let k = 0; k < 3; k++) { const m = Math.min(0.01, inside.h[k] * 0.5); l[k] = Math.max(c[k] - inside.h[k] + m, Math.min(c[k] + inside.h[k] - m, l[k])); } }
    const ix = cl(Math.floor((l[0] + b.h[0]) / (2 * b.h[0]) * B.nx), B.nx), iz = cl(Math.floor((l[2] + b.h[2]) / (2 * b.h[2]) * B.nz), B.nz);
    let iy = 0; for (let k = 1; k < B.ny; k++) if (l[1] >= B.yb[k]) iy = k;
    return [ix, iy, iz];
  }
  /** world centre of a cell */
  private cellCentre(B: Breakable, ix: number, iy: number, iz: number): Vec3 { return this.toWorld(B, [(this.xb(B, ix) + this.xb(B, ix + 1)) / 2, (B.yb[iy] + B.yb[iy + 1]) / 2, (this.zb(B, iz) + this.zb(B, iz + 1)) / 2]); }
  /** the cell as a world box (for the chunk it sheds) */
  private cellBox(B: Breakable, ix: number, iy: number, iz: number): Box {
    const hx = (this.xb(B, ix + 1) - this.xb(B, ix)) / 2, hy = (B.yb[iy + 1] - B.yb[iy]) / 2, hz = (this.zb(B, iz + 1) - this.zb(B, iz)) / 2;
    return makeBox({ c: this.cellCentre(B, ix, iy, iz), h: [hx, hy, hz], yaw: B.box.yaw, albedo: v3.copy(B.box.albedo) });
  }
  /** greedy boxes over the closed cells (y first: an untouched wall column stays ONE floor-to-top piece, which is what the reach masks' wall raster counts) */
  /** the world centre and half-extents of one rect of `pieces()`: what `rebuild` stands up and what `wouldOpen` forecasts, from one place so they cannot part */
  private rectBox(B: Breakable, [x0, x1, y0, y1, z0, z1]: [number, number, number, number, number, number]): { c: Vec3; h: Vec3 } {
    const lx0 = this.xb(B, x0), lx1 = this.xb(B, x1 + 1), ly0 = B.yb[y0], ly1 = B.yb[y1 + 1], lz0 = this.zb(B, z0), lz1 = this.zb(B, z1 + 1);
    return { c: this.toWorld(B, [(lx0 + lx1) / 2, (ly0 + ly1) / 2, (lz0 + lz1) / 2]), h: [(lx1 - lx0) / 2, (ly1 - ly0) / 2, (lz1 - lz0) / 2] };
  }
  private pieces(B: Breakable, open: Uint8Array = B.open): [number, number, number, number, number, number][] {
    const { nx, ny, nz } = B; const used = new Uint8Array(nx * ny * nz); const out: [number, number, number, number, number, number][] = [];
    const free = (ix: number, iy: number, iz: number) => { const c = this.ci(B, ix, iy, iz); return !open[c] && !used[c]; };
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
      if (!free(ix, iy, iz)) continue;
      let y1 = iy; while (y1 + 1 < ny && free(ix, y1 + 1, iz)) y1++;
      let x1 = ix; grow: while (x1 + 1 < nx) { for (let y = iy; y <= y1; y++) if (!free(x1 + 1, y, iz)) break grow; if (iy > 0 && free(x1 + 1, iy - 1, iz)) break; if (y1 + 1 < ny && free(x1 + 1, y1 + 1, iz)) break; x1++; }
      let z1 = iz; growz: while (z1 + 1 < nz) { for (let x = ix; x <= x1; x++) for (let y = iy; y <= y1; y++) if (!free(x, y, z1 + 1)) break growz; for (let x = ix; x <= x1; x++) { if (iy > 0 && free(x, iy - 1, z1 + 1)) break growz; if (y1 + 1 < ny && free(x, y1 + 1, z1 + 1)) break growz; } z1++; }
      for (let z = iz; z <= z1; z++) for (let x = ix; x <= x1; x++) for (let y = iy; y <= y1; y++) used[this.ci(B, x, y, z)] = 1;
      out.push([ix, x1, iy, y1, iz, z1]);
    }
    return out;
  }
  /** Rebuild B's standing pieces from its cells. false = it would take more appended statics than the cap allows (nothing changed). */
  private rebuild(B: Breakable): boolean {
    const g = this.g; const world = g.engine.world;
    if (B.nOpen === 0) { B.box.flags = B.flags0; for (let k = 0; k < B.live; k++) g.col.boxes[B.slots[k]].flags |= HIDE; B.live = 0; this.bump(); return true; }
    const rects = B.nOpen === B.open.length ? [] : this.pieces(B);
    const studs = this.destr.breaks.studs(B);   // (the cut switch: the metal uprights a shot-through partition keeps — none with it off)
    const need = rects.length + studs.length - B.slots.length;
    if (need > 0 && (g.col.boxes.length - this.authored + need > WALLS.maxPieces || world.statics.length + need > world.maxBoxes - 768)) return false;
    for (let k = 0; k < rects.length; k++) {
      const { c, h } = this.rectBox(B, rects[k]);
      const cut = this.destr.breaks.ragged(B, rects[k], h);   // (the cut switch: a ragged end where the piece looks into the opening — undefined with it off)
      if (k < B.slots.length) { const p = g.col.boxes[B.slots[k]]; p.c = c; p.h = h; p.flags = B.flags0; if (cut || p.cut) { p.cut = cut; p.cutCore = cut ? this.destr.breaks.endCore(B.surf, B.box.albedo) : undefined; } if (p.name === 'stud') { p.name = 'piece'; p.albedo = v3.copy(B.box.albedo); p.rough = B.box.rough; p.metal = B.box.metal; } }
      else {
        const p = makeBox({ c, h, yaw: B.box.yaw, albedo: v3.copy(B.box.albedo), flags: B.flags0, name: 'piece', rough: B.box.rough, metal: B.box.metal, aniso: B.box.aniso }); if (cut) { p.cut = cut; p.cutCore = this.destr.breaks.endCore(B.surf, B.box.albedo); }
        const i = g.col.addStatic(p, B.box); world.addStatic(p); B.slots.push(i); this.owner.set(i, B);
      }
    }
    for (let j = 0; j < studs.length; j++) {   // each stud is one more stand-in after the pieces (a slot is a piece one rebuild and a stud the next: its paint goes with its job)
      const k = rects.length + j; const c = this.toWorld(B, studs[j].c), h = studs[j].h; let p: Box;
      if (k < B.slots.length) { p = g.col.boxes[B.slots[k]]; p.c = c; p.h = h; p.flags = B.flags0; if (p.cut) { p.cut = undefined; p.cutCore = undefined; } }
      else { p = makeBox({ c, h, yaw: B.box.yaw, flags: B.flags0 }); const i = g.col.addStatic(p, B.box); world.addStatic(p); B.slots.push(i); this.owner.set(i, B); }
      p.name = 'stud'; p.flags |= BoxFlag.Thin;   // (a bare stud, 4 cm across in an opened wall: the fog of war's eye goes round it — scene/thin.ts, FOG.thin — and, under FOG.mates, a teammate's own; read by nothing else)
      p.albedo = v3.copy(studs[j].albedo); p.rough = studs[j].rough; p.metal = studs[j].metal;
    }
    for (let k = rects.length + studs.length; k < B.slots.length; k++) g.col.boxes[B.slots[k]].flags |= HIDE;
    B.live = rects.length + studs.length; B.box.flags = B.flags0 | HIDE; this.bump();
    return true;
  }
  /** the picture's static tables are stale (BoxWorld re-packs by itself on the page; the native host's static serial reads this) */
  private bump() { const w = this.g.engine.world as { geomSerial?: number }; w.geomSerial = (w.geomSerial ?? 0) + 1; }

  // ---------------------------------------------------------------- opening cells
  /** Open `cells` of B (already-open ones ignored). Returns the change row, or null when nothing opened / the piece cap refused it. */
  private openCells(B: Breakable, cells: number[], cause: LevelChange['cause'], who: number, dir: Vec3 | null, quiet = false, budget: ShedBudget = { chunks: WALLS.chunksPerCell }): LevelChange | null {
    const g = this.g; const fresh: number[] = []; for (const c of cells) if (!B.open[c] && !fresh.includes(c)) fresh.push(c);
    if (!fresh.length) return null;
    for (const c of fresh) B.open[c] = 1; B.nOpen += fresh.length;
    if (!this.rebuild(B)) { for (const c of fresh) B.open[c] = 0; B.nOpen -= fresh.length; WALL_STATS.refused++; return null; }
    this.dirty = true;
    // what opened: bounds, kind
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; const pos: Vec3 = [0, 0, 0]; let sill = false;
    for (const c of fresh) {
      const ix = c % B.nx, iz = Math.floor(c / B.nx) % B.nz, iy = Math.floor(c / (B.nx * B.nz));
      const cb = this.cellBox(B, ix, iy, iz); const a = aabbOf(cb);
      x0 = Math.min(x0, a.x0); z0 = Math.min(z0, a.z0); x1 = Math.max(x1, a.x1); z1 = Math.max(z1, a.z1); pos[0] += cb.c[0]; pos[1] += cb.c[1]; pos[2] += cb.c[2];
      if (iy === 0) sill = true;
      if (!quiet) this.shed(B, cb, dir, who, budget);
    }
    pos[0] /= fresh.length; pos[1] /= fresh.length; pos[2] /= fresh.length;
    const dead = B.nOpen === B.open.length;
    const kind: LevelChangeKind = B.kind === 'cover' ? 'cover' : sill ? 'hole' : 'port';
    if (B.kind === 'cover') { WALL_STATS.coverCells += fresh.length; if (dead) WALL_STATS.coverDead++; } else if (sill) WALL_STATS.holes++; else WALL_STATS.ports++;
    // what stood on it / hung from it
    const rects: [number, number, number, number][] = [[x0, z0, x1, z1]];
    this.settle(B, { x0, x1, z0, z1, y0: 0, y1: 0 }, dir, who, quiet, rects);
    // one model: the routes sound took, the smoke's obstacles, the nav cells, the lights' reach
    g.col.sound.invalidate();
    g.smoke.obstaclesChanged?.(pos, Math.hypot(x1 - x0, z1 - z0) / 2 + 1.5);
    const opened: number[] = [];
    for (const r of rects) { const ch = g.col.nav.rebake(r[0], r[1], r[2], r[3]); for (let k = 0; k < ch.length; k += 2) if (ch[k + 1] === 0) opened.push(ch[k]); }
    if (B.kind === 'wall') g.reachChanged([x0, z0, x1, z1]);
    if (B.hard) for (const c of opened) this.shellGaps.add(c);
    WALL_STATS.navOpened += opened.length;
    this.destr.edgeLook.opened(B, fresh, cause, dir, quiet);   // (picture only: edgeLook.ts)
    if (!quiet && (cause === 'fire' || cause === 'collapse')) messOpened(g, [x0, z0, x1, z1]);   // (picture only: floormess.ts — a blast lays its own, wider)
    const row = this.note({ kind, cause, id: B.id, pos, rect: [x0, z0, x1, z1], opened, walkable: opened.length > 0, sight: true, dead, who });
    WALL_LOG.push(`${g.time.toFixed(2)} ${kind} ${cause} #${B.id} cells ${fresh.length} (${B.nOpen}/${B.open.length}) nav+${opened.length}${dead ? ' DEAD' : ''}`); if (WALL_LOG.length > 200) WALL_LOG.splice(0, 100);
    return row;
  }
  /** the flags authored static `i` was loaded with, if this module has changed them (a holed box, a thing hidden with what it hung from); else undefined */
  flags0(i: number): number | undefined { const f = this.hidden.get(i); if (f !== undefined) return f; const B = this.owner.get(i); return B && B.id === i ? B.flags0 : undefined; }
  /** FURNITURE UNDER A BLAST (game/furnblast.ts): the cover piece `id` goes WHOLE — every cell of it still standing opened down the same road as a blast's (pieces,
   *  what stood on it, re-bake, its row in the feed). null = not a cover piece / nothing of it left / the piece cap refused. */
  raze(id: number, who: number, dir: Vec3 | null, budget = { chunks: WALLS.chunksPerCell }): LevelChange | null { return this.razeIn(id, null, who, dir, budget); }
  /** … or, WHAT STANDS IN THE MOUTH OF A BLOWN HOLE (furnblast.ts mouth()), only the cells of it standing over the plan rectangle `r` [x0, z0, x1, z1]: a long
   *  half wall loses the stretch in the hole's way and keeps the rest. */
  razeIn(id: number, r: [number, number, number, number] | null, who: number, dir: Vec3 | null, budget = { chunks: WALLS.chunksPerCell }): LevelChange | null {
    const B = this.owner.get(id); if (!B || B.kind !== 'cover') return null;
    const cells: number[] = []; const zone = r ? { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: 0, y1: 0 } : null;
    for (let c = 0; c < B.open.length; c++) {
      if (B.open[c]) continue;
      if (zone) { const ix = c % B.nx, iz = Math.floor(c / B.nx) % B.nz, iy = Math.floor(c / (B.nx * B.nz)); if (!overlapXZ(aabbOf(this.cellBox(B, ix, iy, iz)), zone)) continue; }
      cells.push(c);
    }
    return cells.length ? this.openCells(B, cells, 'blast', who, dir, false, budget) : null;
  }
  /** The stretch of the wall `id` that stands open FROM THE FLOOR UP inside the plan rectangle `r` (a 'hole' row's rect also bounds the columns that only lost
   *  their upper halves): the plan bounds of those columns, or null — where a body can go through. */
  sillOpenIn(id: number, r: [number, number, number, number]): [number, number, number, number] | null {
    const B = this.owner.get(id); if (!B || B.kind !== 'wall') return null;
    const zone = { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: 0, y1: 0 }; let out: [number, number, number, number] | null = null;
    for (let iz = 0; iz < B.nz; iz++) for (let ix = 0; ix < B.nx; ix++) {
      let open = true; for (let iy = 0; iy < B.ny && open; iy++) open = B.open[this.ci(B, ix, iy, iz)] === 1; if (!open) continue;
      const a = aabbOf(this.cellBox(B, ix, 0, iz)); if (!overlapXZ(a, zone)) continue;
      out = out ? [Math.min(out[0], a.x0), Math.min(out[1], a.z0), Math.max(out[2], a.x1), Math.max(out[3], a.z1)] : [a.x0, a.z0, a.x1, a.z1];
    }
    return out;
  }
  /** File a row in the feed (serial and time stamped here, listeners called). This module's own changes come through it; the doors' and the glass's code may call
   *  it for theirs (kind 'door', or their own rect with sight / walkable set) so the AI reads ONE feed. */
  note(c: Omit<LevelChange, 'serial' | 't'>): LevelChange {
    const row: LevelChange = { serial: ++this.serial, t: this.g.time, ...c };
    this.changes.push(row); if (this.changes.length > WALLS.maxChanges) this.changes.splice(0, this.changes.length - WALLS.maxChanges);
    for (const fn of this.listeners) fn(row);
    return row;
  }
  /** call back on every change, on the frame it happens; returns the unsubscribe */
  onChange(fn: (c: LevelChange) => void): () => void { this.listeners.push(fn); return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); }; }
  /** the rows after `serial` (null = the ring has already dropped some of them: re-read the level) */
  since(serial: number): LevelChange[] | null { if (serial >= this.serial) return []; const first = this.changes.length ? this.changes[0].serial : this.serial + 1; if (serial + 1 < first) return null; return this.changes.filter(c => c.serial > serial); }

  /** what a broken cell throws: a slab or two of it as rigid debris (the lane's pool; a refusal = a chip burst), dust into the solver */
  private shed(B: Breakable, cell: Box, dir: Vec3 | null, who: number, budget: ShedBudget) {
    if (cutBoxesOn()) { const r = this.destr.breaks.shedCell(B.surf, cell, dir, who, budget, B.hard ? 'blockwork' : undefined); WALL_STATS.chunks += r.thrown; WALL_STATS.chunksDemoted += r.refused; return; }   // the cut switch: this cell's pieces, chips and fines by its material's row (game/breakTable.ts)
    const g = this.g; const P = gpuFx(g);
    const thinAxis = cell.h[0] <= cell.h[2] ? 0 : 2; const t = Math.min(cell.h[thinAxis], 0.06);
    const out: Vec3 = dir ? v3.normalize([dir[0], 0, dir[2]]) : [0, 0, 0];
    const n = Math.min(budget.chunks, WALLS.chunksPerCell);
    for (let k = 0; k < n; k++) {
      const s = 0.08 + 0.1 * this.hash(); const h: Vec3 = [s, s * (0.6 + 0.6 * this.hash()), s]; h[thinAxis] = Math.max(0.015, t);
      const c: Vec3 = [cell.c[0] + (this.hash() - 0.5) * cell.h[0], cell.c[1] + (this.hash() - 0.3) * cell.h[1], cell.c[2] + (this.hash() - 0.5) * cell.h[2]];
      const sp = 1.2 + 2.2 * this.hash(); const v: Vec3 = [out[0] * sp + (this.hash() - 0.5) * 0.8, 0.6 + 1.4 * this.hash(), out[2] * sp + (this.hash() - 0.5) * 0.8];
      const w: Vec3 = [(this.hash() - 0.5) * 9, (this.hash() - 0.5) * 5, (this.hash() - 0.5) * 9];
      const got = this.destr.debris.spawn('chunk', makeBox({ c, h, yaw: cell.yaw, albedo: v3.copy(cell.albedo) }), v, w, who);
      budget.chunks--;
      if (got) WALL_STATS.chunks++; else { WALL_STATS.chunksDemoted++; if (P) P.emit('debris', c, v3.normalize(v), 6, { speed: 2.2, speedJit: 0.7, spread: 1.0, life: 16, lifeJit: 0.3, size: 0.012, sizeJit: 0.6, color: v3.copy(cell.albedo), owner: who }); }
    }
    if (P) P.emit('debris', cell.c, dir ? v3.normalize(v3.add(out, [0, 0.5, 0])) : [0, 1, 0], 10, { speed: 2.4, speedJit: 0.7, spread: 1.2, life: 18, lifeJit: 0.3, size: B.surf === 'wood' ? 0.006 : 0.009, sizeJit: 0.6, aspect: B.surf === 'wood' ? 3 : 1, color: v3.lerp(cell.albedo, [0.86, 0.85, 0.82], B.surf === 'drywall' ? 0.5 : 0.1), owner: who });
    this.destr.cellDust(cell.c, dir ? v3.scale(out, 1) : [0, 1, 0], 1.4, B.surf);   // (a hole is six cells in one frame: what the frame's puff cap holds back waits in the lane's dust queue — destruction.ts)
  }

  // ---------------------------------------------------------------- what stood on it / hung on it
  /** what `a` (static j) rests on: the AABBs of whatever stands with its top just under a's bottom over some of its footprint. `extra` = a thing to count as still
   *  standing (the before-test of something that has just gone). */
  private restsOn(j: number, a: AABB, extra?: AABB): AABB[] {
    const g = this.g; const mine = this.owner.get(j); const out: AABB[] = [];
    const under = (b: AABB) => b.y1 >= a.y0 - 0.06 && b.y1 <= a.y0 + 0.04 && (b.y0 + b.y1) / 2 < a.y0 + 0.01 && overlapXZ(a, b);   // (its top at a's bottom AND its middle below it: a sheet lying ON a thin thing is not under it)
    const n = g.col.gather(a.x0, a.z0, a.x1, a.z1, a.y0 - 0.5, a.y0 + 0.05, this.scratch2);
    for (let k = 0; k < n; k++) { const i = this.scratch2[k]; if (i === j || (mine && this.owner.get(i) === mine)) continue; const b = aabbOf(g.col.boxes[i]); if (under(b)) out.push(b); }
    for (const i of this.ghosts) { if (i === j) continue; const o = g.col.boxes[i]; if (o.flags & BoxFlag.NoPrimary) continue; if (Math.abs(o.c[0] - (a.x0 + a.x1) / 2) > 3 || Math.abs(o.c[2] - (a.z0 + a.z1) / 2) > 3) continue; const b = aabbOf(o); if (under(b)) out.push(b); }
    if (extra && under(extra)) out.push(extra);
    return out;
  }
  /** Is static j (bounds a) held up? On the floor: yes. Resting on things: only while they carry it — something under its middle, or something either side of it
   *  along its length (a desk top on ONE side panel comes down). Resting on nothing: it hangs on what it touches (a modesty panel between two side panels, a lamp
   *  under a roof) — a thing that stands on the floor, rests on something itself, or is a roof. */
  private held(j: number, a: AABB, extra?: AABB): boolean {
    if (a.y0 <= 0.06) return true;
    const rest = this.restsOn(j, a, extra);
    if (rest.length) {
      const alongX = a.x1 - a.x0 >= a.z1 - a.z0; const c = alongX ? (a.x0 + a.x1) / 2 : (a.z0 + a.z1) / 2; let lo = 1e9, hi = -1e9;
      for (const b of rest) { lo = Math.min(lo, alongX ? b.x0 : b.z0); hi = Math.max(hi, alongX ? b.x1 : b.z1); }
      return lo < c - 0.02 && hi > c + 0.02;
    }
    const g = this.g; const mine = this.owner.get(j); const e = 0.04;
    const touches = (b: AABB) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > -e && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > -e && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > -e;
    if (extra && touches(extra)) return true;
    const n = g.col.gather(a.x0 - e, a.z0 - e, a.x1 + e, a.z1 + e, a.y0 - e, a.y1 + e, this.scratch2); const cand: number[] = []; for (let k = 0; k < n; k++) cand.push(this.scratch2[k]);
    for (const i of cand) {
      if (i === j || (mine && this.owner.get(i) === mine)) continue; const b = aabbOf(g.col.boxes[i]); if (!touches(b)) continue;
      if (b.y0 <= 0.06 || (b.x1 - b.x0) * (b.z1 - b.z0) > 6 || this.restsOn(i, b).length) return true;
    }
    return false;
  }
  /** authored statics touching `a` — the solid ones through the grid, the drawn-only ones (papers, sheets) from the list made at load, and the authored boxes of
   *  breakables already part gone (hidden: their pieces stand for them) — in index order */
  private near(a: AABB): number[] {
    const g = this.g; const e = 0.05; const out = new Set<number>();
    const touches = (b: AABB) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > -e && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > -e && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > -e;
    const n = g.col.gather(a.x0 - e, a.z0 - e, a.x1 + e, a.z1 + e, a.y0 - e, a.y1 + e, this.scratch);
    for (let k = 0; k < n; k++) { const i = this.scratch[k]; if (i < this.authored && touches(aabbOf(g.col.boxes[i]))) out.add(i); }
    for (const i of this.ghosts) { const o = g.col.boxes[i]; if (o.flags & BoxFlag.NoPrimary) continue; if (Math.abs(o.c[0] - (a.x0 + a.x1) / 2) > 4 || Math.abs(o.c[2] - (a.z0 + a.z1) / 2) > 4) continue; if (touches(aabbOf(o))) out.add(i); }
    for (const C of this.list) if (C.kind === 'cover' && C.nOpen > 0 && C.nOpen < C.open.length && touches(aabbOf(C.box))) out.add(C.id);
    return [...out].sort((x, y) => x - y);
  }
  /** After cells of B opened: whatever B held up and nothing holds now comes down — what stood on it (a desk top on its side panels, a carton on a crate, a mug,
   *  a paper stack), what hung between it and its neighbours, and whatever those held in turn; on a wall, what was mounted on the stretch that opened. Only things
   *  B (or a thing that just fell) was holding are ever judged: something the level left floating stays where it is. Bounded by WALLS.fallsPerChange. */
  private settle(B: Breakable, rect: AABB, dir: Vec3 | null, who: number, quiet: boolean, rects: [number, number, number, number][]) {
    const queue: AABB[] = [];
    if (B.kind === 'wall') this.hangers(B, rect, dir, who, quiet, queue, rects); else queue.push(aabbOf(B.box));
    this.drop(B, queue, dir, who, quiet, rects);
  }
  /** …whatever the things in `queue` were holding, and what those held in turn (never B itself) */
  private drop(B: Breakable | null, queue: AABB[], dir: Vec3 | null, who: number, quiet: boolean, rects: [number, number, number, number][]) {
    const g = this.g; let falls = 0; const seen = new Set<number>();
    while (queue.length && falls < WALLS.fallsPerChange) {
      const gone = queue.shift()!;
      for (const j of this.near(gone)) {
        if (seen.has(j)) continue;
        const C = this.owner.get(j); if ((C && C === B) || (C && C.nOpen === C.open.length)) continue;
        const b = g.col.boxes[j]; if (b.flags & BoxFlag.Glass) continue; if (!C && (b.flags & BoxFlag.NoPrimary)) continue;   // (already gone)
        const a = aabbOf(b); if (a.y0 <= 0.06 || (a.x1 - a.x0) * (a.z1 - a.z0) > 6) continue;
        if (!this.held(j, a, gone) || this.held(j, a)) continue;   // was it held with that thing standing, and is it not now?
        seen.add(j);
        if (this.fall(j, a, dir, who, quiet, rects)) { falls++; queue.push(a); }
      }
    }
  }
  /** WHAT A CHARGE AT `at` ON THE WALL `wall` IS SET ON (BlastOpts.hung): the BOARDS that hang on that face of it — a notice board, a map, a whiteboard: an
   *  authored static off the floor against the face (`hangers`' own test), thin and broad (WALLS.hung) — within `r` of the charge on the plan and standing
   *  anywhere between the charge and the blast's eye over it. Never a thing with a road of its own: the lane's destructibles (a set, a stack), a light's or a
   *  fixture's box, the breaker; never a tilted box (the pieces are cut square to the wall). Ascending; [] for a wall this engine does not own. Pure: the level as it stands, nothing drawn, nothing written. */
  hungAt(wall: number, at: Vec3, r: number): number[] {
    const g = this.g, B = this.owner.get(wall); if (!B || B.kind !== 'wall') return [];
    const K = WALLS.hung, wa = aabbOf(B.box), alongX = B.nx > 1 || B.box.h[0] >= B.box.h[2], side = (alongX ? at[2] - B.box.c[2] : at[0] - B.box.c[0]) >= 0 ? 1 : -1;
    const n = g.col.gather(at[0] - r - 0.4, at[2] - r - 0.4, at[0] + r + 0.4, at[2] + r + 0.4, 0.25, wa.y1, this.scratch); const out: number[] = [];
    for (let k = 0; k < n; k++) {
      const j = this.scratch[k]; if (!this.boardLike(j)) continue;
      const b = g.col.boxes[j]; if (b.flags & BoxFlag.NoPrimary) continue;
      const a = aabbOf(b); if (a.y0 > at[1] + 0.35 || a.y1 < at[1] - 0.05) continue;
      if ((alongX ? a.z1 - a.z0 : a.x1 - a.x0) > K.deep || (alongX ? a.x1 - a.x0 : a.z1 - a.z0) < K.long) continue;
      const gap = side > 0 ? (alongX ? a.z0 - wa.z1 : a.x0 - wa.x1) : (alongX ? wa.z0 - a.z1 : wa.x0 - a.x1); if (gap > 0.08 || gap < -0.02) continue;   // (on THIS face: the charge's)
      if (Math.min(alongX ? a.x1 : a.z1, alongX ? wa.x1 : wa.z1) - Math.max(alongX ? a.x0 : a.z0, alongX ? wa.x0 : wa.z0) < 0.05) continue;
      if (Math.hypot(Math.max(a.x0 - at[0], 0, at[0] - a.x1), Math.max(a.z0 - at[2], 0, at[2] - a.z1)) > r) continue;
      out.push(j);
    }
    return out.sort((p, q) => p - q);
  }
  /** could authored static `j` be a board hung on a wall at all, by what it was AUTHORED as (asked of a blast and of a checkpoint alike)? */
  private boardLike(j: number): boolean {
    const g = this.g, b = g.col.boxes[j]; if (!b || j < 0 || j >= this.authored || this.owner.has(j) || b.rot) return false;
    const f0 = this.destr.flags0(j) ?? (this.destr.furn.broken(j) ? b.flags & ~HIDE : b.flags);   // (as authored: one that a blast has since hidden is a board still)
    if (f0 & (BoxFlag.Glass | BoxFlag.NoShadow) || this.fixtureBoxes.has(j) || this.destr.itemOf(j) || (g.level.breaker?.boxes ?? []).includes(j)) return false;
    const a = aabbOf(b), K = WALLS.hung, dx = a.x1 - a.x0, dz = a.z1 - a.z0; return a.y0 >= 0.25 && a.y1 - a.y0 >= K.tall && Math.min(dx, dz) <= K.deep && Math.max(dx, dz) >= K.long;
  }
  /** the blast in hand's `hung` set, only while WallBreak.blast runs: where the charge is, the way off the wall's face towards it (unit, level), its boards */
  private hungNow: { wall: number; at: Vec3; n: Vec3; set: number[] } | null = null;
  /** the boards a charge took that the open cells alone would not put down again (a long board, a hole under its end), each with its wall: what a checkpoint
   *  keeps as `h` */
  private hungGone = new Map<number, number>();
  /** things mounted on the stretch of wall B that opened (boards, sets, shelves, switches: off the floor, shallow, against a broad face): down once half of
   *  the cells behind them are gone */
  private hangers(B: Breakable, rect: AABB, dir: Vec3 | null, who: number, quiet: boolean, queue: AABB[], rects: [number, number, number, number][]) {
    const g = this.g; const wa = aabbOf(B.box); const alongX = B.nx > 1 || B.box.h[0] >= B.box.h[2];
    const n = g.col.gather(rect.x0 - 0.3, rect.z0 - 0.3, rect.x1 + 0.3, rect.z1 + 0.3, 0.25, wa.y1, this.scratch);
    const cand: number[] = []; for (let k = 0; k < n; k++) cand.push(this.scratch[k]);
    for (const j of this.ghosts) { const o = g.col.boxes[j]; if (!(o.flags & BoxFlag.NoPrimary) && o.c[0] > rect.x0 - 2 && o.c[0] < rect.x1 + 2 && o.c[2] > rect.z0 - 2 && o.c[2] < rect.z1 + 2) cand.push(j); }
    cand.sort((a, b) => a - b);
    for (const j of cand) {
      if (this.owner.has(j)) continue; const b = g.col.boxes[j]; if (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary)) continue;
      const a = aabbOf(b); if (a.y0 < 0.25) continue;
      if (Math.min(a.x1, rect.x1 + 0.3) - Math.max(a.x0, rect.x0 - 0.3) < 0 || Math.min(a.z1, rect.z1 + 0.3) - Math.max(a.z0, rect.z0 - 0.3) < 0) continue;
      const depth = alongX ? a.z1 - a.z0 : a.x1 - a.x0; if (depth > 0.4) continue;
      const gap = alongX ? Math.max(a.z0 - wa.z1, wa.z0 - a.z1) : Math.max(a.x0 - wa.x1, wa.x0 - a.x1); if (gap > 0.08) continue;
      const l0 = alongX ? a.x0 : a.z0, l1 = alongX ? a.x1 : a.z1, w0 = alongX ? wa.x0 : wa.z0, w1 = alongX ? wa.x1 : wa.z1;
      if (Math.min(l1, w1) - Math.max(l0, w0) < 0.05) continue;
      // the cells behind it
      const N = alongX ? B.nx : B.nz; let tot = 0, gone = 0, sill = 0;
      for (let k = 0; k < N; k++) {
        const c0 = w0 + (w1 - w0) * k / N, c1 = w0 + (w1 - w0) * (k + 1) / N; if (Math.min(c1, l1) - Math.max(c0, l0) <= 0.01) continue;
        { let up = 0; for (let iy = 0; iy < B.ny; iy++) if (B.open[this.ci(B, alongX ? k : 0, iy, alongX ? 0 : k)]) up++; if (up === B.ny) sill++; }   // (a column open floor to top)
        for (let iy = 0; iy < B.ny; iy++) { const y0 = B.box.c[1] + B.yb[iy], y1 = B.box.c[1] + B.yb[iy + 1]; if (Math.min(y1, a.y1) - Math.max(y0, a.y0) <= 0.01) continue; tot++; if (B.open[this.ci(B, alongX ? k : 0, iy, alongX ? 0 : k)]) gone++; }
      }
      // (THE CHARGE'S BOARD GOES WITH ITS WALL — BlastOpts.hung: once a column behind it is open from the floor up it does not hang on across the hole, whatever
      //  share of it the hole is under and whatever stands beneath it; the checkpoint is told, for the cells alone would not put it down again)
      const mine = !quiet && sill > 0 && this.hungNow?.wall === B.id && this.hungNow.set.includes(j); let forced = false;
      if (!tot || gone * 2 < tot) { if (!mine) continue; forced = true; }
      if (this.restsOn(j, a).length) { if (!mine) continue; forced = true; }   // (standing on something after all — a cabinet top under it)
      if (this.fall(j, a, dir, who, quiet, rects)) { queue.push(a); if (forced) this.hungGone.set(j, B.id); }   // (all of it, not its top alone: a set's lit screen is fixed to the FACE of its housing)
    }
  }
  /** static j has nothing left to stand on / hang from. true = it is gone from where it was. */
  private fall(j: number, a: AABB, dir: Vec3 | null, who: number, quiet: boolean, rects: [number, number, number, number][]): boolean {
    const g = this.g; const b = g.col.boxes[j]; const d: Vec3 = dir ? v3.normalize([dir[0], 0.2, dir[2]]) : [0, -1, 0];
    const C = this.owner.get(j);
    if (C) {   // cover that stood on it: all of it goes
      const cells: number[] = []; for (let c = 0; c < C.open.length; c++) if (!C.open[c]) cells.push(c);
      return !!this.openCells(C, cells, quiet ? 'load' : 'collapse', who, dir, quiet, { chunks: 2 });
    }
    WALL_STATS.falls++;
    if (this.destr.itemOf(j)) { this.destr.dropItem(j, d, who, quiet); rects.push([a.x0, a.z0, a.x1, a.z1]); return true; }
    const vol = b.h[0] * b.h[1] * b.h[2] * 8;
    if (vol > WALLS.fallMaxVol) { WALL_STATS.floating++; return false; }   // too big to throw about: it stays (counted — a level fix)
    if (this.fixtureBoxes.has(j) && !quiet) this.destr.breakFixtureBox(j);   // (a load: the fixtures' own slice says which are dead — no second break, no sound)
    this.hidden.set(j, b.flags); b.flags |= HIDE; this.bump();
    g.smoke.obstaclesChanged?.(b.c, Math.hypot(b.h[0], b.h[1], b.h[2]) + 0.6);
    rects.push([a.x0, a.z0, a.x1, a.z1]);
    const H = !quiet && this.hungNow?.set.includes(j) ? this.hungNow : null;
    if (H) this.destr.furn.hungGoes(b, H.at, H.n, who);   // (what the charge was set on: in pieces, not let down whole)
    else if (!quiet) {
      const v: Vec3 = [d[0] * 0.8 + (this.hash() - 0.5) * 0.4, 0.2, d[2] * 0.8 + (this.hash() - 0.5) * 0.4]; const w: Vec3 = [(this.hash() - 0.5) * 3, (this.hash() - 0.5) * 2, (this.hash() - 0.5) * 3];
      const got = this.destr.debris.spawn('chunk', b, v, w, who);
      if (got) WALL_STATS.chunks++; else { WALL_STATS.chunksDemoted++; const P = gpuFx(g); if (P) P.emit('debris', b.c, [0, 1, 0], 8, { speed: 1.8, speedJit: 0.7, spread: 1.2, life: 16, lifeJit: 0.3, size: 0.012, sizeJit: 0.6, color: v3.copy(b.albedo), owner: who }); }
    }
    return true;
  }

  // ---------------------------------------------------------------- the sites
  /** A round stopped in static `index` (as col.raycast reports it; ≥ 1e6 = a door leaf) at `hitP` travelling `dir`. Destruction.round calls it (chaos > 0). */
  round(who: number, hitP: Vec3, dir: Vec3, index: number, def: WeaponDef, chaos: number) {
    const g = this.g; if (!wallBreakOn(g)) return;
    const w = (def.cls === 'pistol' ? WALLS.pistolK : 1) * chaos * 2;
    if (index >= 1e6) { leafRound(g, index, who, hitP, dir, w); return; }   // a door leaf: the doors' own (doorblast.ts DOORSHOT — the same weight a cell here takes)
    const B = this.owner.get(index); if (!B || B.hard) return;   // (a hard wall — one a breaching charge was set on — scars like the structure it is)
    WALL_STATS.rounds++;
    let [ix, iy, iz] = this.cellAt(B, v3.mad(hitP, dir, 0.02), g.col.boxes[index]);
    const cHit = this.ci(B, ix, iy, iz);   // (the cell the round met — wallwear keys its marks by it)
    if (B.kind === 'wall' && iy === 0 && !B.open[this.ci(B, ix, 1, iz)]) iy = 1;   // a sill never goes from under a standing upper: the round's work is the column's
    const c = this.ci(B, ix, iy, iz); if (B.open[c]) return;
    B.dmg[c] += w; this.dirty = true;
    const tough = (WALLS.tough[B.surf] ?? 8) * (B.kind === 'wall' && iy === 0 ? WALLS.sillK : 1);
    try { this.wear.round(g, B.box, B.surf, B.id * 4096 + cHit, B.id * 4096 + c, B.dmg[c] / tough, hitP, dir); } catch (e) { this.wear.on = false; console.error('wall wear switched off:', e); }   // (look only: reads the count; the picture never costs play a cell)
    if (B.dmg[c] >= tough) this.openCells(B, [c], 'fire', who, dir);
  }
  /** THE PLAN of a blast at `at`: which cells of which breakables it opens, nearest first. PURE — it reads the level as it stands when asked (the real blast asks
   *  after its doors have gone: a leaf torn off by then lies as a slab at its frame) and writes nothing: `blast()` opens what it lists, `wouldOpen()` only reports it. */
  private planBlast(at: Vec3, opts: BlastOpts, R: number, hung: number[] = opts.hung ? this.hungAt(opts.hung.wall, at, opts.hung.r) : []): { B: Breakable; cells: number[]; d: number }[] {
    if (!hung.length) return this.planOf(at, opts, R);
    // (the boards the charge is set on stand in no line of the plan: hidden as the engine hides a static — the flags every ray reads when it is asked — and put back)
    const boxes = this.g.col.boxes, was = hung.map(j => boxes[j].flags); for (const j of hung) boxes[j].flags |= HIDE;
    try { return this.planOf(at, opts, R); } finally { hung.forEach((j, k) => { boxes[j].flags = was[k]; }); }
  }
  private planOf(at: Vec3, opts: BlastOpts, R: number): { B: Breakable; cells: number[]; d: number }[] {
    const g = this.g; const K = WALLS.blast;
    const eye: Vec3 = [at[0], Math.max(0.3, Math.min(at[1] + 0.3, WORLD.ceilingY - 0.3)), at[2]];
    const exposed = (B: Breakable, p: Vec3): boolean => {
      const d = v3.sub(p, eye); const L = v3.len(d); if (L < 0.05) return true;
      const hit = g.col.raycast(eye, v3.scale(d, 1 / L), L); return !hit || this.owner.get(hit.index) === B || hit.t >= L - 0.02;
    };
    const plan: { B: Breakable; cells: number[]; d: number }[] = [];
    for (const B of this.list) {
      if (B.nOpen === B.open.length) continue;
      const a = aabbOf(B.box); const dx = Math.max(a.x0 - at[0], 0, at[0] - a.x1), dz = Math.max(a.z0 - at[2], 0, at[2] - a.z1); const dB = Math.hypot(dx, dz); if (dB > R) continue;
      const cells: number[] = [];
      if (B.hard) {   // a hard wall: only the charge set on it opens it, and only its hole — minHole columns at the charge, sill and upper, no ports beside it
        if (opts.breach !== B.id || dB > K.contactM) continue;
        const alongX = B.nx > 1 || B.box.h[0] >= B.box.h[2]; const N = alongX ? B.nx : B.nz, colW = 2 * (alongX ? B.box.h[0] : B.box.h[2]) / N, n = Math.min(N, Math.max(1, Math.ceil(K.minHole * WALLS.col / colW - 1e-6)));   // (never narrower than minHole half-metre columns: a hard wall's columns are that or wider)
        const u = (alongX ? (at[0] - a.x0) / (a.x1 - a.x0) : (at[2] - a.z0) / (a.z1 - a.z0)) * N;   // the charge's place along it, in columns
        const lo = Math.max(0, Math.min(N - n, Math.round(u - n / 2)));
        for (let k = lo; k < lo + n; k++) for (const iy of [1, 0]) cells.push(this.ci(B, alongX ? k : 0, iy, alongX ? 0 : k));
      } else if (B.kind === 'wall') {
        const alongX = B.nx > 1 || B.box.h[0] >= B.box.h[2]; const N = alongX ? B.nx : B.nz; const full: number[] = []; let nearest = -1, nd = 1e9;
        for (let k = 0; k < N; k++) {
          const ix = alongX ? k : 0, iz = alongX ? 0 : k; const p = this.cellCentre(B, ix, 1, iz); const d = Math.hypot(p[0] - at[0], p[2] - at[2]);
          if (d < nd) { nd = d; nearest = k; }
          if (d > R * K.portK) continue;
          const aim: Vec3 = [p[0], Math.min(Math.max(eye[1], 0.9), B.box.c[1] + B.box.h[1] - 0.1), p[2]];
          if (!exposed(B, aim)) continue;
          cells.push(this.ci(B, ix, 1, iz)); if (d <= R * K.holeK) { cells.push(this.ci(B, ix, 0, iz)); full.push(k); }
        }
        // THE CHARGE'S OWN WALL (BlastOpts.hung) goes at the charge whatever stands on its face between them — a sign, a set: the column it lies against
        if (opts.hung && dB <= K.contactM && nearest >= 0 && !full.includes(nearest) && this.owner.get(opts.hung.wall) === B) {
          full.push(nearest); for (const iy of [1, 0]) { const c = this.ci(B, alongX ? nearest : 0, iy, alongX ? 0 : nearest); if (!cells.includes(c)) cells.push(c); } }
        // a charge against the wall makes a hole a man fits through: widen to minHole columns round the nearest
        if (full.length && dB <= K.contactM && N > full.length) {
          let lo = full.reduce((best, k) => Math.abs(k - nearest) < Math.abs(best - nearest) ? k : best, full[0]), hi = lo;   // (the run of holed columns nearest the charge: nothing between two separate runs is filled in)
          while (full.includes(lo - 1)) lo--; while (full.includes(hi + 1)) hi++;
          while (hi - lo + 1 < Math.min(K.minHole, N)) { const cl = lo > 0 ? Math.abs(lo - 1 - nearest) : 1e9, ch = hi < N - 1 ? Math.abs(hi + 1 - nearest) : 1e9; if (cl <= ch) lo--; else hi++; }
          for (let k = lo; k <= hi; k++) { const ix = alongX ? k : 0, iz = alongX ? 0 : k; for (const iy of [0, 1]) { const c = this.ci(B, ix, iy, iz); if (!cells.includes(c)) cells.push(c); } }
        }
      } else {
        for (let iz = 0; iz < B.nz; iz++) for (let ix = 0; ix < B.nx; ix++) {
          const p = this.cellCentre(B, ix, 0, iz); if (Math.hypot(p[0] - at[0], p[2] - at[2]) > R * K.coverK) continue;
          if (exposed(B, p)) cells.push(this.ci(B, ix, 0, iz));
        }
      }
      if (cells.length) plan.push({ B, cells, d: dB });
    }
    plan.sort((a, b) => a.d - b.d || a.B.id - b.B.id);
    return plan;
  }

  /** READ ONLY: what a blast at `at` WOULD open, asked before it goes off — the walls' twin of `Destruction.doorsFor` (a reader of "is he in cover from this
   *  grenade" can ask both). Each row is one wall or cover piece the blast's own plan opens cells of: `standing` = the static boxes that stand for it NOW (the
   *  authored box, or its pieces — bare studs among them — once holed), `left` = fresh boxes for what would still stand of it AFTER (never added to the world:
   *  the caller hands the rows to `Destruction.withWallsOpen`), `cells` = how many cells go, `hole` = a WALL loses a cell of its bottom row (open from the floor
   *  up there, not only a port over a sill; always false for cover: a gap in cover is not a way through a wall).
   *  It is the blast's own plan (`planBlast`), read with the level as it stands: on the frame it is asked the real blast opens these cells of these walls —
   *  less where the real one is refused by the piece cap, and it can differ beside a door the same burst tears off (the blast takes doors first, and its wall
   *  pass meets that leaf as a slab lying at the frame where this read met it standing). NOT in `left`: bare studs and ragged cut ends (the cut switch's
   *  picture: a listed wall is read with no studs at all, so a line through a stud bay reads open), and whatever the opening then lets fall (`settle`).
   *  A hard (outer) wall is listed only for THE charge set on it (`opts.breach`), as in the blast. No stats, no serial, no dice; [] with the engine off. */
  wouldOpen(at: Vec3, opts: BlastOpts = {}): WallOpening[] {
    const g = this.g; if (!wallBreakOn(g)) return [];
    const R = (opts.radius ?? WALLS.blast.radius) * (opts.power ?? 1); if (!(R > 0)) return [];
    const out: WallOpening[] = [];
    for (const { B, cells } of this.planBlast(at, opts, R)) {
      const open = B.open.slice(); let n = 0, hole = false;
      for (const c of cells) if (!open[c]) { open[c] = 1; n++; if (B.kind === 'wall' && c < B.nx * B.nz) hole = true; }
      if (!n) continue;
      const standing = B.nOpen === 0 ? [B.box] : B.slots.slice(0, B.live).map(i => g.col.boxes[i]);
      const left: Box[] = [];
      if (B.nOpen + n < open.length) for (const rect of this.pieces(B, open)) {
        const { c, h } = this.rectBox(B, rect);
        left.push(makeBox({ c, h, yaw: B.box.yaw, albedo: B.box.albedo, flags: B.flags0, name: 'piece' }));
      }
      out.push({ id: B.id, kind: B.kind, standing, left, cells: n, hole });
    }
    return out;
  }

  /** THE BLAST (Destruction.blast is the entry point every charge and grenade calls): open what it reaches. Two passes — everything is judged against the level as
   *  it stood when it went off (a crate shields the crate behind it), then opened. */
  blast(at: Vec3, opts: BlastOpts = {}): BlastResult { try { return this.blastOf(at, opts); } finally { this.hungNow = null; } }
  private blastOf(at: Vec3, opts: BlastOpts): BlastResult {
    const g = this.g; const res: BlastResult = { walls: 0, cover: 0, doors: 0, panes: 0, opened: 0, serial: this.serial };
    if (!wallBreakOn(g)) return res;
    const K = WALLS.blast; const R = (opts.radius ?? K.radius) * (opts.power ?? 1); const who = opts.who || NOBODY_ID; if (!(R > 0)) return res;
    WALL_STATS.blasts++;
    const HB = opts.hung ? this.owner.get(opts.hung.wall) : undefined, hung = HB && opts.hung ? this.hungAt(opts.hung.wall, at, opts.hung.r) : [];
    const ax = !!HB && (HB.nx > 1 || HB.box.h[0] >= HB.box.h[2]);
    this.hungNow = HB && hung.length ? { wall: HB.id, at: v3.copy(at), n: ax ? [0, 0, at[2] >= HB.box.c[2] ? 1 : -1] : [at[0] >= HB.box.c[0] ? 1 : -1, 0, 0], set: hung } : null;   // (read by hangers() and fall() until this blast is done)
    const plan = this.planBlast(at, opts, R, hung);
    const cutOn = cutBoxesOn(); const share = cutOn ? this.destr.breaks.share() : null;
    const budget: ShedBudget = share ? { chunks: share.thrown, heap: share.heap, from: at } : { chunks: WALLS.chunksPerBlast };
    for (const { B, cells } of plan) {
      const B0 = B.nOpen; const dir = v3.sub(B.box.c, at); dir[1] = 0;
      if (B.hard) { const ax = B.nx > 1 || B.box.h[0] >= B.box.h[2]; dir[ax ? 0 : 2] = 0; }   // (a long wall's middle may lie well along it from the charge: what it throws leaves through its far face)
      const fresh = cells.filter(c => !B.open[c]);
      if (cutOn) {   // (the cut switch: the share is dealt round the opening, nearest the charge first — not spent on the first cells in index order)
        const d2 = (c: number) => { const p = this.cellBox(B, c % B.nx, Math.floor(c / (B.nx * B.nz)), Math.floor(c / B.nx) % B.nz).c; return (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2 + (p[2] - at[2]) ** 2; };
        const key = new Map(fresh.map(c => [c, d2(c)])); fresh.sort((a, b) => key.get(a)! - key.get(b)! || a - b); budget.per = fresh.length * 2 > budget.chunks ? 1 : 2;
      }
      const row = this.openCells(B, fresh, 'blast', who, v3.len(dir) > 0.05 ? v3.normalize(dir) : [0, 0, 1], false, budget);
      if (!row || B.nOpen === B0) continue;
      if (B.kind === 'wall') res.walls++; else res.cover++;
      res.opened += row.opened.length;
      if (cutOn && row.kind === 'hole') {   // (the cut switch: a few slabs dealt at rest at the foot of the HOLE — the sills that went, not the ports beside them — on the far side)
        const mid: Vec3 = [0, 0, 0]; let w = 0, k = 0;
        for (const c of fresh) if (c < B.nx * B.nz) { const cb = this.cellBox(B, c % B.nx, 0, Math.floor(c / B.nx) % B.nz); mid[0] += cb.c[0]; mid[2] += cb.c[2]; w += Math.max(cb.h[0], cb.h[2]); k++; }
        if (k) this.destr.breaks.heap(B.surf, B.box, [mid[0] / k, 0, mid[2] / k], at, w, who, budget, B.hard ? 'blockwork' : undefined);
      }
    }
    res.serial = this.serial;
    return res;
  }

  // ---------------------------------------------------------------- reset / checkpoints
  /** The level put back (Destruction.reset): authored boxes as they were, every appended static cut off, the nav grid re-baked. Nothing at all when nothing broke. */
  reset(silent = false) {
    const g = this.g; this.counter = 1; this.wear.reset(); this.hungNow = null; this.hungGone.clear();
    const letGo = () => { this.shellGaps.clear(); if (this.list.some(B => B.hard)) { for (const B of this.list) if (B.hard) this.owner.delete(B.id); this.list = this.list.filter(B => !B.hard); } };   // (a hard wall is the run's, not the level's: adopt)
    if (!this.dirty && g.col.boxes.length === this.authored) { letGo(); return; }
    for (const [i, f] of this.hidden) g.col.boxes[i].flags = f; this.hidden.clear();
    let any = false;
    for (const B of this.list) { if (B.nOpen || B.slots.length) any = true; B.box.flags = B.flags0; B.open.fill(0); B.dmg.fill(0); B.nOpen = 0; B.slots.length = 0; B.live = 0; }
    for (const i of [...this.owner.keys()]) if (i >= this.authored) this.owner.delete(i);
    letGo();
    g.col.truncateStatics(this.authored);
    const world = g.engine.world; if (world.statics.length > this.authored) { world.statics.length = this.authored; world.staticsDirty = true; }
    this.dirty = false; this.bump();
    if (!any) return;
    g.col.nav.rebake(WORLD.min[0], WORLD.min[2], WORLD.max[0], WORLD.max[2]); g.col.sound.invalidate();
    g.smoke.obstaclesChanged?.([(WORLD.min[0] + WORLD.max[0]) / 2, 1, (WORLD.min[2] + WORLD.max[2]) / 2], 60);
    g.reachChanged(null);
    if (!silent) this.note({ kind: 'reset', cause: 'reset', id: -1, pos: [0, 0, 0], rect: [WORLD.min[0], WORLD.min[2], WORLD.max[0], WORLD.max[2]], opened: [], walkable: false, sight: false, dead: false, who: NOBODY_ID });
  }
  /** what a checkpoint keeps (undefined = the level stands as authored) */
  snapshot(): WallsSave | undefined {
    const b: WallsSave['b'] = [];
    for (const B of this.list) {
      let any = B.nOpen > 0; if (!any) for (let c = 0; c < B.dmg.length; c++) if (B.dmg[c] > 0) { any = true; break; }
      if (!any) continue;
      let open = ''; for (let c = 0; c < B.open.length; c++) open += B.open[c] ? '1' : '0';
      const row: WallsSave['b'][number] = [B.id, open, Array.from(B.dmg, x => Math.round(x * 100) / 100)]; if (B.hard) row.push(1);
      b.push(row);
    }
    const h = [...this.hungGone].sort((p, q) => p[0] - q[0]);
    return b.length ? (h.length ? { v: 1, b, h } : { v: 1, b }) : undefined;
  }
  /** can this file's slice be applied to this level (savestate.ts canLoad)? null = yes */
  check(s: WallsSave | undefined): string | null {
    if (!s) return null; if (s.v !== 1 || !Array.isArray(s.b)) return 'walls: unknown slice';
    for (const [id, open, , hard] of s.b) { const B = this.owner.get(id);
      if (hard && !B) { const b = this.g.col.boxes[id]; if (!this.adoptable(id) || open.length !== 2 * this.hardCols(b)) return `walls: hard wall ${id} is not this level's`; continue; }   // (taken on when the file is applied: restore)
      if (!B || B.id !== id || open.length !== B.open.length) return `walls: breakable ${id} is not this level's`; }
    if (s.h !== undefined) { if (!Array.isArray(s.h)) return 'walls: unknown slice';
      for (const r of s.h) { const [j, w] = Array.isArray(r) ? r : [NaN, NaN]; const W = this.owner.get(w), wall = (W && W.id === w && W.kind === 'wall') || s.b.some(x => x[0] === w && x[3] === 1);
        if (!Number.isInteger(j) || !wall || !this.boardLike(j)) return `walls: static ${j} is not a board on a wall of this level's`; } }
    return null;
  }
  /** Apply a checkpoint's slice on the freshly reset level: the same cells open, silently (no debris, no dust, no blame), what stood on them gone, ONE 'reset' row
   *  (cause 'load') telling the AI to re-read. */
  restore(s: WallsSave | undefined) {
    if (!s) return;
    const listeners = this.listeners; this.listeners = [];
    try {
      for (const [id, open, dmg, hard] of s.b) {
        if (hard) this.adopt(id);
        const B = this.owner.get(id); if (!B || B.id !== id) continue;
        for (let c = 0; c < B.dmg.length; c++) B.dmg[c] = dmg[c] ?? 0;
        const cells: number[] = []; for (let c = 0; c < B.open.length; c++) if (open[c] === '1') cells.push(c);
        if (cells.length) this.openCells(B, cells, 'load', NOBODY_ID, null, true); else this.dirty = true;
      }
      for (const [j, w] of s.h ?? []) {   // (the boards a charge took with its wall, where the cells above did not already put them down — and what hung on them)
        const b = this.g.col.boxes[j], B = this.owner.get(w); this.hungGone.set(j, w); if (!b || b.flags & BoxFlag.NoPrimary) continue; const a = aabbOf(b), rects: [number, number, number, number][] = [];
        if (!this.fall(j, a, null, NOBODY_ID, true, rects)) continue; this.drop(null, [a], null, NOBODY_ID, true, rects);
        for (const r of rects) { const ch = this.g.col.nav.rebake(r[0], r[1], r[2], r[3]); if (B?.hard) for (let k = 0; k < ch.length; k += 2) if (ch[k + 1] === 0) this.shellGaps.add(ch[k]); }
      }
    } finally { this.listeners = listeners; }
    // the rows the silent pass filed are folded into one
    this.changes = this.changes.filter(c => c.cause !== 'load');
    this.note({ kind: 'reset', cause: 'load', id: -1, pos: [0, 0, 0], rect: [WORLD.min[0], WORLD.min[2], WORLD.max[0], WORLD.max[2]], opened: [], walkable: false, sight: false, dead: false, who: NOBODY_ID });
  }

  summary(): string { const v = this.inventory(); const s = WALL_STATS; return `walls ${v.walls} (${v.wallM.toFixed(0)} m) · cover ${v.cover} · touched ${v.touched} · pieces ${v.pieces}/${WALLS.maxPieces} · ports ${s.ports} holes ${s.holes} cover cells ${s.coverCells} (${s.coverDead} gone) · refused ${s.refused} · serial ${this.serial}`; }
}
