// FURNITURE UNDER A BLAST — "i'd expect the blast to upset all the furniture and have them break apart" (the maintainer, at the warehouse office's wall entry: a
// desk, a chair and two cabinets stood untouched a metre from the hole). A wall charge, a door charge or a frag grenade now reaches the furniture round it:
//
//   PUSHABLE furniture (props.ts: chairs, cartons, bins, plants) in reach is THROWN away from the blast and spun, harder the nearer, through the props' own solver
//   (applyImpulse: it slides, hits things, is heard like any shoved prop); one right beside the charge comes APART — the prop leaves the level, its parts fly as
//   rigid debris.
//   FIXED furniture (the level's statics: desks, cabinets, shelves, benches, lockers) close to the blast breaks: inside the SHATTER band every part is split and
//   thrown, further out (the APART band) wooden parts come away as planks and a metal cabinet goes over whole — by MATERIAL, through one data table (FURN_BREAK:
//   what a part splits into, how its pieces fly, what they are heard doing). What stood on it (monitor, papers, mugs, binders — the lane's own destructibles
//   through destr.dropItem, the rest as chunks) goes with it.
//
// REACH AND LINE OF BLAST DECIDE, NOTHING ELSE (no hit points): a thing is touched only when the blast point — or the MOUTH of a hole this very blast opened in a
// wall — has a clear line to it; a wall that held shields what is behind it. Other furniture is no shield (the pressure goes round a desk), chunky cover is.
// A STUN GRENADE DOES NONE OF THIS: only the three callers below reach this module; detonateStun's own canister never does.
//
// ONE MODEL: a broken static is hidden the way the lane hides everything (flags |= NoPrimary | NoShadow: the picture, every ray, sight, rounds, sound and feet
// drop it at query time), the nav cells under it re-baked, the sound routes and the smoke's obstacles told, and ONE row filed in the walls' change feed (kind
// 'cover', cause 'blast') so the AI reads it where it reads every other change. Cover pieces among the furniture (a desk's side panels) go through the wall
// engine's own road (WallBreak.raze). The pieces are the lane's rigid debris: they fly, land, are heard (a 'prop' event blamed on the thrower) and stay; like all
// debris they hurt nobody and stop nothing.
//
// BOUNDED: ≤ FURN.chunksPerBlast pieces a blast, a fixed count (nearest furniture first; a piece of furniture the count runs out BEFORE is left STANDING, one it
// runs out inside finishes as chips), the pool's own cap + evict / refuse rule under that (a refusal = a chip burst) — so WHAT breaks is the same on every
// quality tier and only chunk-or-chips follows the pool. DETERMINISTIC: its own counter through hash01, never Math.random, no wall clock. RESTORED on a restart
// (reset(): flags back, the props back in the list, nav re-baked). INERT with THE ONE SWITCH off, at chaos 0, under the tour or a showcase's own chaos, and with
// FURNBLAST.on false (`?nofurnblast` on the page, PT_FURN=0 under the playthrough harness): the build exactly as it was.
//
// CHECKPOINTS carry what broke (snapshot / check / restore at the foot of the class; savestate.ts files the slice `furn` beside the walls' and re-applies it after
// the restart, after the walls'): the statics a blast took and the props that came apart are gone again after a load, silently; the pieces on the floor are not
// filed (no debris is). Nothing broke = no slice, so such a file is byte for byte what it was; a file from before the slice loads as it did (the furniture whole).
//
// Callers: Destruction.blast (the wall charge and the frag — after the walls, so the hole is already open), combat.ts detonateStun for a BORROWED charge (the
// door charge; the wall charge's own borrowed bang lands in the same frame at the same place and is merged).
import { Vec3, v3, quat, lerp } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { WORLD } from '../scene/world';
import type { Game } from './game';
import type { Destruction } from './destruction';
import type { Prop } from './props';
import { gpuFx, paletteName, paintStandsFor, surfOf, type Surf } from './particleFx';
import { hash01 } from './debris';
import { NOBODY_ID } from './consts';
import { cutBoxesOn } from '../scene/cut';
import { BREAKS } from './breakTable';
import { FURNBLAST, BLAST_PACE, DESTRUCTION } from './destructionSwitch';   // the knob: FURNBLAST.on (default on; inert unless THE ONE SWITCH of the destruction goal is on too)
import { snowPaintOf } from '../render/snowField';

export type BlastSource = 'wall' | 'door' | 'frag';
/** what a breaching charge is to the furniture, by its breaking radius: a wall's, or by its small radius a door's (destruction.ts blast; wallcharge.ts asks ahead) */
export const chargeSource = (radius: number): BlastSource => radius >= 1.5 ? 'wall' : 'door';
/** the piece of furniture a blast would break first (Furniture.firstToGo): the group's id, where the blast is, its shatter band */
export interface BlastFirst { group: number; at: Vec3; shatterM: number }

export const FURN = {
  /** every reach below × this, by what went off */
  k: { wall: 1, door: 0.7, frag: 0.6 } as Record<BlastSource, number>,
  /** how hard the pieces of a thing right by it are flung (× their speed; 1 = a hard shove, about 5 m/s at the charge): a wall charge reads as a blast */
  fling: { wall: 1.6, door: 1.2, frag: 1.2 } as Record<BlastSource, number>,
  /** fixed furniture: split and thrown inside shatterM, comes apart / goes over inside apartM (metres from the blast to the nearest point of it) */
  shatterM: 1.6, apartM: 4.0,
  /** pushable furniture: thrown inside throwM (m/s at the charge, falling off linearly), comes apart inside propBreakM */
  throwM: 5.5, throwV: 6, propBreakM: 1.5,
  /** rigid chunks one blast may make (the pool's own cap still rules under it) */
  chunksPerBlast: 36,
  /** a hole this blast opened lets it through: the second origin stands this far past the wall */
  mouthM: 0.45,
  /** two calls in one frame within this of each other are one blast (the wall charge's borrowed bang) */
  mergeM: 1.5,
  /** A HOLE A BLAST OPENS CAN BE WALKED THROUGH (mouth(); `on`: raised by the page — src/host/profile.ts pageSwitches, ?holeclear=0 — off here and on the frozen
   *  stand, TPS_HOLECLEAR=1): what stands in a body's way in either mouth of the hole — the stretch of the wall open from the floor up, `depth` m out from each
   *  face — goes with the blast, WHOEVER OWNS IT: a cover piece the wall shielded from the burst (the stretch of it in the way), a piece of furniture too heavy
   *  for the bands above, a thing under a roof that neither engine lists (a counter in white, shelving on legs, a board on the wall), and what rests on them.
   *  Never: anything taller than `top` or heavier than `vol` m³, a structure paint other than white, a post (a door frame's jamb), a light's or a fixture's box
   *  or what carries one, the mission's own thing, the breaker. `chunks` = rigid pieces a blast's mouths may make on top of the blast's own (out of pieces a
   *  thing still goes, as chips). A thing the engines do not list goes WHOLE (a long counter for a short hole). off = whatever stood by the wall stands in it.
   *  `snow` (raised by the page — pageSwitches, ?holesnow=0 — off here and on the frozen stand, TPS_HOLESNOW=1; acts only with `on`): LYING SNOW IN A MOUTH GOES
   *  TOO — a bank against the wall's foot on a snow level (a box in a snow paint, which reads as the ground to a blast and so as structure here; the pass keeps
   *  every bank over 0.2 m clear of its doors because it stops feet, and a charge makes a door anywhere). The maintainer, 10-15, of a wall charge on the pass:
   *  "couldn't path through a hole from a wall breach" — two banks at the foot stopped him, the walk grid and the charge's own 'is it a hole' ray ("it held").
   *  off = a bank stands in the hole it was blown under. PICTURE: the snow field (render/snowField.ts) is baked at the level's start and still draws its hill. */
  mouth: { on: false, depth: 0.9, top: 2.3, vol: 3.0, chunks: 12, snow: false },
  /** WHAT HUNG ON THE WALL UNDER A CHARGE (hungGoes; wallcharge.ts WALLCHARGE.hung is its switch): cut into slabs `len` m long (at most `max`) by `strips`; the
   *  slabs within `underM` of the charge along the wall are driven through the hole at `through` m/s (lo, hi), the rest torn off into the room at `back` m/s
   *  and along the wall at up to `side` m/s, `up` m/s off the floor, tumbling (`spin`, as throwPiece's); a long slab counts as under the charge only with its middle within `holeM` of it; `chunks` = rigid pieces one thing may make (past it,
   *  splinters); `chips` = splinters thrown back into the room and through, at `chipV` m/s. */
  hung: { len: 0.32, max: 4, strips: 2, underM: 0.3, through: [7, 11], back: [3.5, 7], side: 4.5, up: [1.6, 3.0], spin: 24, chunks: 8, chips: [40, 24], chipV: [5, 7], holeM: 0.5 },
  /** what counts as a piece of furniture standing on the floor (top / long side in m, volume in m³; heavier than apartMaxVol only breaks in the shatter band) … */
  root: { minTop: 0.3, maxTop: 2.0, maxLong: 2.6, maxVol: 0.7, apartMaxVol: 0.6 },
  /** … and as a thing standing on / fixed to one */
  rider: { maxTop: 2.3, maxVol: 0.3 },
  /** boxes nearer than this are joined */
  touch: 0.04,
  /** a run of joined furniture longer than this (a row of desks) breaks part by part, not as one */
  rowM: 3.6,
};
/** HOW A PART COMES APART, BY MATERIAL — one plain row a class of material (data only: the later cut-pieces goal can read this table as it stands). Per band
 *  (`shatter` close in, `apart` further out): a part is cut along its longest side into round(L ÷ len) pieces (at most `max`) and across its second side into
 *  `strips` (only where that side is ≥ 0.3 m) — wood goes to long slats, board to slabs, sheet metal to a couple of plates and, further out, over whole; `uneven`
 *  0‥1 moves each cut off the even split; `fly` / `spin` scale how its pieces are thrown and tumble; `land` = what a piece is heard doing (debris.ts: the 'prop'
 *  hearing level and the sounds). */
export type BreakClass = 'wood' | 'board' | 'metal' | 'hard' | 'soft';
export interface BreakRow { shatter: { len: number; max: number; strips: number }; apart: { len: number; max: number; strips: number }; uneven: number; fly: number; spin: number; land: { level: number; sfx: { name: string; rate: number; gain: number }[] } }
export const FURN_BREAK: Record<BreakClass, BreakRow> = {
  wood:  { shatter: { len: 0.9, max: 2, strips: 3 }, apart: { len: 1.2, max: 2, strips: 2 }, uneven: 0.6, fly: 1.0, spin: 1.0, land: { level: 0.25, sfx: [{ name: 'propThud', rate: 1.15, gain: 0.5 }] } },
  board: { shatter: { len: 0.45, max: 3, strips: 2 }, apart: { len: 9, max: 1, strips: 1 }, uneven: 0.4, fly: 1.1, spin: 1.2, land: { level: 0.15, sfx: [{ name: 'propThud', rate: 1.5, gain: 0.3 }] } },
  metal: { shatter: { len: 0.7, max: 2, strips: 1 }, apart: { len: 9, max: 1, strips: 1 }, uneven: 0.5, fly: 0.8, spin: 0.7, land: { level: 0.45, sfx: [{ name: 'propThud', rate: 0.7, gain: 0.9 }, { name: 'magDrop', rate: 0.5, gain: 0.4 }] } },
  hard:  { shatter: { len: 0.4, max: 3, strips: 2 }, apart: { len: 0.8, max: 2, strips: 1 }, uneven: 0.5, fly: 1.0, spin: 1.0, land: { level: 0.2, sfx: [{ name: 'propThud', rate: 1.3, gain: 0.4 }] } },
  soft:  { shatter: { len: 9, max: 1, strips: 1 }, apart: { len: 9, max: 1, strips: 1 }, uneven: 0, fly: 1.2, spin: 1.3, land: { level: 0.1, sfx: [{ name: 'propThud', rate: 0.9, gain: 0.3 }] } },
};
/** PAINTED AS ONE in a plain grey — no hue to speak of, neither the dark of a rack / a screen's housing nor white — that no other material's palette claims: a
 *  steel cabinet (`steel()` below). Read off the paint the box's paint stands for (particleFx.ts paintStandsFor). */
export function steelGrey(albedo: Vec3): boolean {
  const a = paintStandsFor(albedo), hi = Math.max(a[0], a[1], a[2]), lo = Math.min(a[0], a[1], a[2]); const named = paletteName(albedo);
  return !((named && named !== 'metal') || hi - lo > STEEL_GREY.chroma || hi < STEEL_GREY.value[0] || hi > STEEL_GREY.value[1]);
}
/** which row a box is: by its paint's name where it has one (an unnamed paint on a piece of furniture is a steel cabinet, a locker, a machine) */
export function breakClassOf(albedo: Vec3): BreakClass {
  const name = paletteName(albedo); if (!name) return 'metal';
  if (name === 'wood' || name === 'woodDark') return 'wood'; if (name === 'cardboard') return 'board'; if (name === 'metal' || name === 'red') return 'metal';
  if (name === 'chair' || name === 'plant') return 'soft';
  return 'hard';
}
/** A checkpoint's slice (savestate.ts `furn`): `s` = the statics of furniture a blast took, `p` = the ids of the props that came apart. Absent = none. */
/** `m` = statics the mouth rule took that are in neither engine's index (absent when none: a file without one is byte for byte the slice as it was) */
export interface FurnSave { v: 1; s: number[]; p: number[]; m?: number[] }
export const FURN_STATS = { blasts: 0, merged: 0, groups: 0, shielded: 0, statics: 0, razed: 0, items: 0, chunks: 0, demoted: 0, left: 0, propsThrown: 0, propsBroken: 0, propsShielded: 0, navOpened: 0, mouth: 0, mouthLeft: 0 };
export const FURN_LOG: string[] = [];

/** paints that are the building, never furniture */
const STRUCT = new Set(['carpet', 'carpetBlue', 'carpetRed', 'lino', 'stone', 'asphalt', 'grass', 'wall', 'wallDark', 'concrete', 'ceiling', 'white', 'glassFrame', 'glass', 'glassExt', 'partRed', 'partBlue', 'partTan']);
const HIDE = BoxFlag.NoPrimary | BoxFlag.NoShadow;
/** a steel box this far through on every side (m) is a CARCASS — sheet on a frame (a cabinet, a locker) — to the cut pieces; thinner steel is a plate already */
const STEEL_CARCASS_M = 0.25;
/** a carcass beside the charge is torn into its five sheets only while the blast still has this many chunks to give (else it loses its door and goes as it would
 *  further out: two pieces, what the row's own cut made of it — a small charge's budget is not spent on one cabinet) */
const STEEL_SHEETS_ROOM = 16;
/** one part of a steel carcass on its way: a torn-off sheet, or (`open`) the carcass itself, open on that face of its own frame */
interface SteelPart { box: Box; open?: { axis: 0 | 2; sign: 1 | -1 }; seed?: number }
/** … no side longer than this (m), and painted a plain mid grey: at most this much between its colour's channels, its brightest inside this range */
const STEEL_CARCASS_MOST = 2.2, STEEL_GREY = { chroma: 0.07, value: [0.3, 0.8] as [number, number] };
interface AABB { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
function aabbOf(b: Box): AABB {
  const cs = Math.abs(Math.cos(b.yaw)), sn = Math.abs(Math.sin(b.yaw)); const ex = cs * b.h[0] + sn * b.h[2], ez = sn * b.h[0] + cs * b.h[2];
  return { x0: b.c[0] - ex, x1: b.c[0] + ex, y0: b.c[1] - b.h[1], y1: b.c[1] + b.h[1], z0: b.c[2] - ez, z1: b.c[2] + ez };
}
const distXZ = (p: Vec3, a: AABB) => Math.hypot(Math.max(a.x0 - p[0], 0, p[0] - a.x1), Math.max(a.z0 - p[2], 0, p[2] - a.z1));
const volOf = (b: Box) => b.h[0] * b.h[1] * b.h[2] * 8;

interface Member { i: number; a: AABB; root: boolean; ghost: boolean; nb: Member[]; sup: Member[]; group: Group | null }
interface Group { id: number; members: Member[]; a: AABB; heavy: number; surf: Surf }

/** two plan rectangles overlap by more than a centimetre */
const overPlan = (a: { x0: number; z0: number; x1: number; z1: number }, q: { x0: number; z0: number; x1: number; z1: number }) => a.x0 < q.x1 - 0.01 && a.x1 > q.x0 + 0.01 && a.z0 < q.z1 - 0.01 && a.z1 > q.z0 + 0.01;
const NONE_DONE = { has: (_j: number) => false };
export class Furniture {
  private groups: Group[] | null = null;
  private memberAt = new Map<number, Member>();
  private hidden = new Map<number, number>();
  private goneProps = 0;
  /** every static of a piece of furniture a blast took (this module's own hides AND the lane's items that went with it; a cover panel is the wall engine's to remember): what a checkpoint files */
  private gone = new Set<number>();
  /** statics the mouth rule took that are no member of the index (a checkpoint's `m`) */
  private goneMouth = new Set<number>();
  /** what the mouth rule never takes (made with the index): the breaker's, the light targets' and the fixtures' boxes · the faces the mission's things are taken from */
  private kept = new Set<number>(); private fronts: Vec3[] = [];
  private counter = 1;
  private last: { t: number; at: Vec3; k: number } | null = null;

  constructor(private g: Game, private destr: Destruction) {}

  private hash(): number { return hash01(this.counter++ * 2654435761); }

  // ---------------------------------------------------------------- what the level's furniture is (found once, by shape, on the first blast)
  private index(): Group[] {
    if (this.groups) return this.groups;
    const g = this.g, boxes = g.col.boxes, walls = this.destr.walls, R = FURN.root, Rd = FURN.rider;
    const fixture = new Set<number>(); for (const t of g.targets) for (const bi of t.boxes) fixture.add(bi);
    for (const l of g.level.lights) { const fb = (l as { fixtureBox?: number }).fixtureBox; if (fb !== undefined && fb >= 0) fixture.add(fb); }
    this.kept = new Set([...fixture, ...(g.level.breaker?.boxes ?? [])]); this.fronts = [];
    if (g.level.mission?.rack?.front) this.fronts.push(g.level.mission.rack.front); for (const sp of g.level.scenarios?.quiet?.spots ?? []) if (sp.front) this.fronts.push(sp.front);
    const interior = g.reachInterior; const W = WORLD.gridW, H = WORLD.gridH;
    const roofed = (x: number, z: number) => { if (!interior) return true; const cx = Math.floor(x - WORLD.min[0]), cz = Math.floor(z - WORLD.min[2]); return cx >= 0 && cz >= 0 && cx < W && cz < H && interior[cz * W + cx] === 1; };
    const cand: Member[] = []; const n = Math.min(boxes.length, walls.authored);
    const others: AABB[] = [];   // every authored static that is NOT furniture: what may be resting on a piece of it (see the load rule below)
    for (let i = 0; i < n; i++) {
      const b = boxes[i];
      // by the flags the level was AUTHORED with, not as it stands: the index is made at the first blast, and by then rounds or that very blast may have hidden
      // things — a part missed here would be lost to every later encounter, and the index would depend on when it was made
      const f0 = this.hidden.get(i) ?? this.destr.flags0(i) ?? b.flags;
      if (f0 & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.Dynamic)) continue;
      const a = aabbOf(b);
      if (b.c[0] < WORLD.min[0] || b.c[0] > WORLD.max[0] || b.c[2] < WORLD.min[2] || b.c[2] > WORLD.max[2] || !roofed(b.c[0], b.c[2])) { others.push(a); continue; }
      const vol = volOf(b), long = Math.max(b.h[0], b.h[2]) * 2; const ghost = (f0 & BoxFlag.NoShadow) !== 0;
      const br = walls.breakableAt(i); if (br && br.kind === 'wall') { others.push(a); continue; }
      const name = paletteName(b.albedo); const lit = b.emissive[0] + b.emissive[1] + b.emissive[2] > 0;
      let root = false;
      if (!ghost && !b.rot && !lit && !fixture.has(i) && !this.destr.itemOf(i) && a.y0 <= 0.25 && a.y1 >= R.minTop && a.y1 <= R.maxTop && long <= R.maxLong && vol <= R.maxVol) {
        if (br) root = (name === 'wood' || name === 'woodDark' || name === 'cardboard') && (Math.min(b.h[0], b.h[2]) * 2 <= 0.12 || vol <= 0.25);   // (a desk's panel, a small carton — a crate that is real cover stays the wall engine's alone)
        else root = !(name && STRUCT.has(name));
      }
      if (!root && !(a.y0 > 0.06 && a.y1 <= Rd.maxTop && vol <= Rd.maxVol && long <= R.maxLong && !br)) { if (!ghost) others.push(a); continue; }
      cand.push({ i, a, root, ghost, nb: [], sup: [], group: null });
    }
    // joined = touching (a sweep along x keeps the pair test small)
    cand.sort((p, q) => p.a.x0 - q.a.x0 || p.i - q.i); const e = FURN.touch;
    const parent = cand.map((_, k) => k); const find = (k: number): number => { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
    for (let p = 0; p < cand.length; p++) {
      const A = cand[p].a;
      for (let q = p + 1; q < cand.length && cand[q].a.x0 <= A.x1 + e; q++) {
        const B = cand[q].a;
        if (B.z0 > A.z1 + e || A.z0 > B.z1 + e || B.y0 > A.y1 + e || A.y0 > B.y1 + e) continue;
        cand[p].nb.push(cand[q]); cand[q].nb.push(cand[p]);
        if (cand[p].a.y0 < cand[q].a.y0 - 0.005) cand[q].sup.push(cand[p]); else if (cand[q].a.y0 < cand[p].a.y0 - 0.005) cand[p].sup.push(cand[q]);
        const rp = find(p), rq = find(q); if (rp !== rq) parent[Math.max(rp, rq)] = Math.min(rp, rq);
      }
    }
    const byRoot = new Map<number, Member[]>(); for (let k = 0; k < cand.length; k++) { const r = find(k); let L = byRoot.get(r); if (!L) byRoot.set(r, L = []); L.push(cand[k]); }
    const out: Group[] = [];
    for (const L of byRoot.values()) {
      if (!L.some(m => m.root)) continue;   // (nothing of it stands on the floor: a shelf on a wall, a sign — not furniture)
      L.sort((p, q) => p.i - q.i);
      const a: AABB = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 }; let heavy = 0; let big: Member | null = null;
      for (const m of L) { a.x0 = Math.min(a.x0, m.a.x0); a.x1 = Math.max(a.x1, m.a.x1); a.y0 = Math.min(a.y0, m.a.y0); a.y1 = Math.max(a.y1, m.a.y1); a.z0 = Math.min(a.z0, m.a.z0); a.z1 = Math.max(a.z1, m.a.z1); if (m.root) { const v = volOf(boxes[m.i]); if (v > heavy) { heavy = v; big = m; } } }
      // THE LOAD RULE: something that is not furniture stands ON it (a table top too big to be a rider, a machine's body on its plinth, a crate of real cover on a
      // cabinet) — breaking what is under it would leave that in the air, so the whole thing is left to stand
      if (others.some(o => o.x0 < a.x1 - 0.01 && o.x1 > a.x0 + 0.01 && o.z0 < a.z1 - 0.01 && o.z1 > a.z0 + 0.01 && L.some(m => Math.abs(o.y0 - m.a.y1) <= e && o.x0 < m.a.x1 - 0.01 && o.x1 > m.a.x0 + 0.01 && o.z0 < m.a.z1 - 0.01 && o.z1 > m.a.z0 + 0.01))) continue;
      const G: Group = { id: L[0].i, members: L, a, heavy, surf: surfOf(boxes[(big ?? L[0]).i].albedo) };
      for (const m of L) { m.group = G; this.memberAt.set(m.i, m); }
      out.push(G);
    }
    out.sort((p, q) => p.id - q.id);
    return this.groups = out;
  }
  /** BLAST_PACE: the index made AHEAD of the blast (wallcharge.ts, as a wall charge is set) — the same index whenever it is made (see index()), and its
   *  millisecond or two off the frame the wall goes on */
  warm() { if (BLAST_PACE.on && FURNBLAST.on && DESTRUCTION.on) this.index(); }
  /** counts for the panel / probes; `list` = every group (id = its lowest static index) with its bounds and members */
  inventory() { const G = this.index(); return { groups: G.length, members: G.reduce((s, x) => s + x.members.length, 0), hidden: this.hidden.size, goneProps: this.goneProps, list: G.map(x => ({ id: x.id, members: x.members.map(m => m.i), a: x.a, heavy: x.heavy, surf: x.surf })) }; }
  /** does this part still stand (a cover panel: while any cell of it does) */
  private stands(m: Member): boolean { const br = this.destr.walls.breakableAt(m.i); return br ? br.open < br.cells : !(this.g.col.boxes[m.i].flags & BoxFlag.NoPrimary); }
  /** WHAT A BLAST WOULD TAKE FIRST — asked BEFORE it goes off, reading only (nothing breaks, nothing is counted, no hash is drawn; the index is the same
   *  whenever it is first made). fixed() breaks the pieces of furniture in reach nearest first out of ONE budget of pieces, and a piece the budget runs out
   *  on stands; so the only piece a caller can be PROMISED is the first: the standing piece nearest `at` among those fixed() would consider (its reach and
   *  its weight rule; a nearer piece the blast has no line to still counts as nearer — the safe side). null = no promise (the switches, a showcase, nothing
   *  in reach). wallcharge.ts asks, for the floor behind a wall: a cot against the far face is gone with the wall. */
  firstToGo(at: Vec3, src: BlastSource): BlastFirst | null {
    if (!FURNBLAST.on || !DESTRUCTION.on || this.destr.showChaos !== null) return null;
    const k = FURN.k[src] ?? 1; if (!(k > 0)) return null; const apartM = FURN.apartM * k, shatterM = FURN.shatterM * k;
    let best: Group | null = null, bd = Infinity;
    for (const G of this.index()) {
      const d = distXZ(at, G.a); if (d > apartM || (d > shatterM && G.heavy > FURN.root.apartMaxVol)) continue;
      if (d < bd && G.members.some(m => this.stands(m))) { best = G; bd = d; }   // (the index is in id order: of two as near, the lower id, as fixed()'s sort has it)
    }
    return best ? { group: best.id, at: v3.copy(at), shatterM } : null;
  }
  /** …and is static `i` part of it, taken off the floor by that blast: a part that still stands of the piece `first` names, the piece in the SHATTER band
   *  (fixed() breaks further out too; the promise keeps to the band) with a line of blast from one of `origins` (the caller's: the far mouth of the hole it
   *  is about to open); of a LONG run the floor-standing parts themselves in the band and in the line, and what those hold up (rowTake). Never a cover panel (the wall engine's: it may leave
   *  cells standing). */
  wouldTake(first: BlastFirst, i: number, origins: Vec3[]): boolean {
    const m = this.memberAt.get(i), G = m?.group; if (!m || !G || G.id !== first.group || !this.stands(m) || this.destr.walls.breakableAt(i)) return false;
    if (Math.max(G.a.x1 - G.a.x0, G.a.z1 - G.a.z0) > FURN.rowM) return this.rowTake(first, G, origins).has(m);
    return distXZ(first.at, G.a) <= first.shatterM && this.exposedBox(origins, G.a);
  }
  /** of a LONG run, the parts wouldTake() can promise: fixed()'s own rule for a row (rowFall) with the reach kept to the shatter band. A subset of what
   *  fixed() takes (its reach is longer, its origins more), so a promise. A lived-in room's cot is such a run: the bedding and the locker dealt onto and
   *  beside it are one piece with it, and its mattress goes with the frame under it. ONE answer kept, for the caller's run of questions about one piece from
   *  one mouth on one frame (wallcharge.ts asks about every part in a cell's way): kept by the identity of what it was asked with, so never across frames. */
  private rowTake(first: BlastFirst, G: Group, origins: Vec3[]): Set<Member> {
    const K = this.rowKept; if (K && K.t === this.g.time && K.first === first && K.origins === origins && K.G === G) return K.gone;
    const gone = this.rowFall(G.members.filter(m => this.stands(m) && !this.destr.walls.breakableAt(m.i)), first.at, first.shatterM, origins);
    this.rowKept = { t: this.g.time, first, origins, G, gone }; return gone;
  }
  private rowKept: { t: number; first: BlastFirst; origins: Vec3[]; G: Group; gone: Set<Member> } | null = null;
  /** A LONG RUN UNDER A BLAST: of the parts that stand, the floor-standing ones within `reach` of it with a line from one of `origins`, then whatever those
   *  were holding up (a part whose every standing support is going; with no support of its own, one whose neighbour goes) */
  private rowFall(standing: Member[], at: Vec3, reach: number, origins: Vec3[]): Set<Member> {
    const gone = new Set<Member>(); for (const m of standing) if (m.root && distXZ(at, m.a) <= reach && this.exposedBox(origins, m.a)) gone.add(m);
    for (let pass = 0, more = gone.size > 0; more && pass < 8; pass++) {
      more = false;
      for (const m of standing) {
        if (gone.has(m) || m.root) continue;
        const held = m.sup.length ? m.sup.some(s => !gone.has(s) && this.stands(s)) : !m.nb.some(s => gone.has(s));
        if (!held) { gone.add(m); more = true; }
      }
    }
    return gone;
  }
  /** is static `i` one this module has broken (hidden until the level resets) */
  broken(i: number): boolean { return this.hidden.has(i); }

  // ---------------------------------------------------------------- line of blast
  /** a clear line from `o` to `p`: furniture (and the pieces of a chewed cover panel that belongs to it) is no shield, anything else is */
  private clear(o: Vec3, p: Vec3): boolean {
    const g = this.g; const d = v3.sub(p, o); const L = v3.len(d); if (L < 0.05) return true; const rd = v3.scale(d, 1 / L);
    let t0 = 0;
    for (let step = 0; step < 12; step++) {
      const ro: Vec3 = [o[0] + rd[0] * t0, o[1] + rd[1] * t0, o[2] + rd[2] * t0];
      const hit = g.col.raycast(ro, rd, L - t0); if (!hit || hit.t >= L - t0 - 0.03) return true;
      if (hit.index >= 1e6) return false;   // a door leaf
      const id = this.memberAt.has(hit.index) ? hit.index : this.destr.walls.breakableAt(hit.index)?.id ?? -1;
      if (!this.memberAt.has(id)) return false;
      t0 += hit.t + 0.005;   // (just inside it: a box the ray starts in is not met again, and a thin part flush to a wall must not carry the ray into the wall)
    }
    return false;
  }
  private exposedBox(origins: Vec3[], a: AABB): boolean {
    const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2;
    for (const o of origins) {
      const near: Vec3 = [Math.max(a.x0, Math.min(o[0], a.x1)), Math.max(a.y0 + 0.05, Math.min(o[1], a.y1 - 0.02)), Math.max(a.z0, Math.min(o[2], a.z1))];
      if (this.clear(o, [cx, (a.y0 + a.y1) / 2, cz]) || this.clear(o, [cx, a.y1 + 0.05, cz]) || this.clear(o, near)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the blast
  /** A charge went off at `at` (see the head): throws / breaks what it reaches. `chaos` is the caller's chaosOf (> 0). */
  /** this blast's FURN.fling (set at the head of blast()) */
  private fling = 1;
  blast(at: Vec3, src: BlastSource, who: number, chaos: number) {
    const g = this.g; if (!FURNBLAST.on || !(chaos > 0) || this.destr.showChaos !== null) return;
    const k = FURN.k[src] ?? 1; if (!(k > 0)) return;
    const L = this.last; if (L && L.t === g.time && Math.hypot(at[0] - L.at[0], at[2] - L.at[2]) <= FURN.mergeM && k <= L.k) { FURN_STATS.merged++; return; }
    this.last = { t: g.time, at: v3.copy(at), k }; FURN_STATS.blasts++; this.fling = FURN.fling[src] ?? 1;
    who = who || NOBODY_ID;
    // where it blows FROM: the charge, and the far mouth of every hole this blast has just opened
    const mouths: [number, number, number, number][] = [];
    const origins: Vec3[] = [[at[0], Math.max(0.3, Math.min(at[1] + 0.3, WORLD.ceilingY - 0.3)), at[2]]];
    for (const c of this.destr.walls.changes) {
      if (c.t !== g.time || c.kind !== 'hole' || c.cause !== 'blast' || Math.hypot(c.pos[0] - at[0], c.pos[2] - at[2]) > 3) continue;
      const ax = c.rect[2] - c.rect[0] < c.rect[3] - c.rect[1] ? 0 : 2; const s = c.pos[ax] - at[ax] >= 0 ? 1 : -1;
      const m: Vec3 = [c.pos[0], 1.0, c.pos[2]]; m[ax] = (s > 0 ? Math.max(c.rect[ax === 0 ? 2 : 3], c.pos[ax]) : Math.min(c.rect[ax === 0 ? 0 : 1], c.pos[ax])) + s * FURN.mouthM;
      origins.push(m);
      if (FURN.mouth.on) {   // both mouths of the hole: the stretch open from the floor up, `depth` out from either face
        const r = this.destr.walls.sillOpenIn(c.id, c.rect); if (r) { const lo = ax === 0 ? 0 : 1; r[lo] -= FURN.mouth.depth; r[lo + 2] += FURN.mouth.depth; mouths.push(r); }
      }
    }
    const budget = { chunks: FURN.chunksPerBlast };   // (a FIXED count: what breaks — and so what is still cover, what the feet meet — never depends on the quality tier's pool; the pool only decides chunk or chips)
    this.fixed(at, k, who, origins, budget);
    this.pushable(at, k, who, origins, budget);
    const mb = { chunks: FURN.mouth.chunks }; for (const r of mouths) this.mouth(at, who, r, mb);
    FURN_LOG.push(`${g.time.toFixed(2)} ${src} at ${at[0].toFixed(1)},${at[2].toFixed(1)} origins ${origins.length} · groups ${FURN_STATS.groups} statics ${FURN_STATS.statics} props ${FURN_STATS.propsThrown}/${FURN_STATS.propsBroken} chunks ${FURN_STATS.chunks} (totals)`); if (FURN_LOG.length > 200) FURN_LOG.splice(0, 100);
  }

  /** the level's fixed furniture: judged whole against the level as it stands (the hole open, nothing of this blast's furniture gone yet), then broken nearest first */
  private fixed(at: Vec3, k: number, who: number, origins: Vec3[], budget: { chunks: number }) {
    const g = this.g; const apartM = FURN.apartM * k, shatterM = FURN.shatterM * k;
    const plan: { G: Group; d: number; fall: Member[] }[] = [];
    for (const G of this.index()) {
      const d = distXZ(at, G.a); if (d > apartM) continue;
      if (d > shatterM && G.heavy > FURN.root.apartMaxVol) continue;
      const row = Math.max(G.a.x1 - G.a.x0, G.a.z1 - G.a.z0) > FURN.rowM;
      const standing = G.members.filter(m => this.stands(m)); if (!standing.length) continue;
      let fall: Member[];
      if (!row) { if (!this.exposedBox(origins, G.a)) { FURN_STATS.shielded++; continue; } fall = standing; }
      else {
        // a long run: the parts in reach with a line to them, then whatever those were holding up
        const gone = this.rowFall(standing, at, apartM, origins);
        if (!gone.size) { FURN_STATS.shielded++; continue; }
        fall = standing.filter(m => gone.has(m));
      }
      plan.push({ G, d, fall });
    }
    plan.sort((p, q) => p.d - q.d || p.G.id - q.G.id);
    for (const { G, fall } of plan) {
      if (budget.chunks <= 0) { FURN_STATS.left++; continue; }   // (out of pieces: it stands — never a thing that just vanishes)
      FURN_STATS.groups++;
      const r: AABB = { x0: 1e9, x1: -1e9, y0: 0, y1: 0, z0: 1e9, z1: -1e9 }; let solid = 0;
      fall.sort((p, q) => q.a.y0 - p.a.y0 || p.i - q.i);   // what stands on it first, top down
      for (const m of fall) {
        if (!this.stands(m)) continue;   // (went with something broken a moment ago: a monitor's screen with its housing, a top with the panel under it)
        const dm = distXZ(at, m.a); const mode = dm <= shatterM ? 'shatter' : 'apart'; const kk = Math.max(0, 1 - dm / apartM);
        if (this.breakStatic(m, at, mode, kk, who, budget)) { solid++; r.x0 = Math.min(r.x0, m.a.x0); r.x1 = Math.max(r.x1, m.a.x1); r.z0 = Math.min(r.z0, m.a.z0); r.z1 = Math.max(r.z1, m.a.z1); }
      }
      // what a checkpoint files of it: every part of it that no longer stands — also what a bang or rounds had already knocked off it (the lane's items are in no
      // checkpoint themselves: left out, a load would stand them back in the air over a desk that stays gone)
      for (const m of G.members) if (!this.stands(m) && !this.destr.walls.breakableAt(m.i)) this.gone.add(m.i);
      const c: Vec3 = [(G.a.x0 + G.a.x1) / 2, (G.a.y0 + G.a.y1) / 2, (G.a.z0 + G.a.z1) / 2];
      this.destr.cellDust(c, [0, 1, 0], 1.2, G.surf);
      if (!solid) continue;
      // one model: sound's routes, the smoke's obstacles, the nav cells — and the AI's feed
      g.col.sound.invalidate(); g.smoke.obstaclesChanged?.(c, Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2 + 1.5);
      const opened: number[] = []; const ch = g.col.nav.rebake(r.x0, r.z0, r.x1, r.z1); for (let n = 0; n < ch.length; n += 2) if (ch[n + 1] === 0) opened.push(ch[n]);
      FURN_STATS.navOpened += opened.length; this.bump();
      this.destr.walls.note({ kind: 'cover', cause: 'blast', id: G.id, pos: c, rect: [r.x0, r.z0, r.x1, r.z1], opened, walkable: opened.length > 0, sight: true, dead: !G.members.some(m => this.stands(m)), who });
    }
  }

  /** One static of a piece of furniture goes. true = this module hid a SOLID box itself (the caller re-bakes under it). */
  private breakStatic(m: Member, at: Vec3, mode: 'shatter' | 'apart', kk: number, who: number, budget: { chunks: number }): boolean {
    const g = this.g, b = g.col.boxes[m.i]; const dir = this.away(at, b.c);
    if (this.destr.itemOf(m.i)) {   // the lane's own destructible (a stack scatters, a screen dies and its housing goes, clutter drops): its road, plus the blast's shove
      const had = new Set(this.destr.debris.list); this.destr.dropItem(m.i, dir, who); FURN_STATS.items++;
      const sp = (1 + 3 * kk) * this.fling; for (const c of this.destr.debris.list) if (!had.has(c)) { c.v[0] += dir[0] * sp; c.v[1] += 0.6 + 1.2 * kk; c.v[2] += dir[2] * sp; budget.chunks--; }
      return false;
    }
    const br = this.destr.walls.breakableAt(m.i);
    if (br) { if (this.destr.walls.raze(br.id, who, dir, budget)) FURN_STATS.razed++; return false; }   // a cover panel: the wall engine's road (its own pieces, re-bake and feed row)
    this.hidden.set(m.i, b.flags); b.flags |= HIDE; FURN_STATS.statics++;
    this.destr.breakFixtureBox(m.i);
    if (m.ghost) return false;   // (a drawn-only sheet / placard: it just goes)
    if (FURN.mouth.snow && snowPaintOf(b) !== null) {   // lying snow: a spray from where the blast met it, never rigid pieces (a bank 15 m long cut in a dozen would be slabs metres long, tumbling)
      const a = aabbOf(b), near: Vec3 = [Math.min(a.x1, Math.max(a.x0, at[0])), b.c[1], Math.min(a.z1, Math.max(a.z0, at[2]))]; this.chips(near, [dir[0], 0.9, dir[2]], b, who, 36); return true; }
    const cls = breakClassOf(b.albedo), row = FURN_BREAK[cls];
    const steel = cls === 'metal' && cutBoxesOn() ? this.steel(b, mode === 'shatter' && budget.chunks < STEEL_SHEETS_ROOM ? 'apart' : mode, dir, m.i) : null;   // (a cabinet, a locker: sheet steel on a frame — never with the cut switch off)
    if (steel) for (const p of steel) this.throwPiece(p.box, at, mode, kk, row, who, budget, b, p);
    else for (const f of this.fragments(b, row, mode)) this.throwPiece(f, at, mode, kk, row, who, budget, b);
    this.chips(b.c, [dir[0], 0.6, dir[2]], b, who, mode === 'shatter' ? 12 : 5);
    return true;
  }
  /** One piece on its way: thrown away from the blast (hard and tumbling in the shatter band; pushed over further out), as a chunk of the lane's rigid debris while
   *  the budget and the pool allow, else as a burst of chips. */
  private throwPiece(f: Box, at: Vec3, mode: 'shatter' | 'apart', kk: number, row: BreakRow, who: number, budget: { chunks: number }, of: Box, steel?: SteelPart) {
    const fd = this.away(at, f.c); const h1 = this.hash(), h2 = this.hash(), h3 = this.hash();
    let v: Vec3, w: Vec3;
    if (mode === 'shatter') { const sp = (2.4 + 3.2 * kk) * (0.7 + 0.6 * h1) * row.fly * this.fling, sn = row.spin; v = [fd[0] * sp + (h2 - 0.5) * 1.2, (1.0 + 2.6 * kk * h3) * (0.5 + 0.5 * this.fling), fd[2] * sp + (h3 - 0.5) * 1.2]; w = [(h1 - 0.5) * 14 * sn, (h2 - 0.5) * 8 * sn, (h3 - 0.5) * 14 * sn]; }
    else {   // (goes over AWAY from the blast: the turn is about the floor axis across its line)
      const sp = (0.7 + 1.5 * kk) * (0.7 + 0.6 * h1) * row.fly * (0.5 + 0.5 * this.fling); const tip = (1.6 + 2.6 * kk) * row.spin; v = [fd[0] * sp, 0.3 + 0.8 * h2, fd[2] * sp]; w = [fd[2] * tip + (h3 - 0.5), (h1 - 0.5) * 1.5, -fd[0] * tip + (h2 - 0.5)];
      // a TALL piece (a cabinet, an upright) starts already past its balance point: the debris lays a chunk on the face nearest down at its first floor touch, and one
      // that starts upright on the floor would be stood straight back up
      const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw); const along = f.h[0] * Math.abs(fd[0] * cs - fd[2] * sn) + f.h[2] * Math.abs(fd[0] * sn + fd[2] * cs);
      if (f.h[1] >= 0.3 && f.h[1] > 1.2 * along) {
        const th = 0.95, s2 = Math.sin(th / 2); f.rot = quat.mul([fd[2] * s2, 0, -fd[0] * s2, Math.cos(th / 2)], quat.yaw(f.yaw));
        f.c[1] = Math.max(f.c[1] - f.h[1] + along * Math.sin(th) + f.h[1] * Math.cos(th) + 0.01, 0.02); f.c[0] += fd[0] * f.h[1] * 0.5; f.c[2] += fd[2] * f.h[1] * 0.5;
      }
    }
    const got = budget.chunks > 0 ? this.destr.debris.spawn('chunk', f, v, w, who) : null; budget.chunks--;
    if (got && !steel) { got.level = row.land.level; got.sfx = row.land.sfx; }
    if (got) { FURN_STATS.chunks++;
      if (steel?.open) this.destr.breaks.carcass(got, steel.open.axis, steel.open.sign, steel.seed); else if (steel) this.destr.breaks.sheet(got); else this.destr.breaks.dress(got);
      if (steel) { got.level = row.land.level; got.sfx = row.land.sfx; }   // (after the table took it for steel: one landing, whatever its paint read as)
    } else { FURN_STATS.demoted++; this.chips(f.c, v, of, who, 14); }
  }
  /** WHAT HUNG ON THE WALL UNDER A CHARGE GOES (wallbreak.ts fall() calls it for a board of the blast's `hung` set, hidden by the caller;
   *  `n` = the way off the wall's face towards the charge): not let down whole — cut into slabs (FURN.hung), the ones under the charge driven through the hole
   *  with the wall, the rest torn off into the room and along the wall, tumbling, with its splinters both ways. A board is a board whatever its paint reads as
   *  (the `board` row; `wood` where the paint is wood). The slabs are the lane's rigid debris — heard landing, in the way of a prop — and like all of it
   *  nothing a checkpoint keeps; where the pool is full a slab goes as splinters (the quality tier's pool decides chunk or chips, as for every piece). */
  hungGoes(b: Box, at: Vec3, n: Vec3, who: number) {
    const K = FURN.hung, base = FURN_BREAK[breakClassOf(b.albedo) === 'wood' ? 'wood' : 'board'], row: BreakRow = { ...base, shatter: { len: K.len, max: K.max, strips: K.strips } };
    const t: Vec3 = [-n[2], 0, n[0]]; let left = K.chunks;
    for (const f of this.fragments(b, row, 'shatter')) {
      const s = (f.c[0] - at[0]) * t[0] + (f.c[2] - at[2]) * t[2], h1 = this.hash(), h2 = this.hash(), h3 = this.hash(); let v: Vec3;
      const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw), half = f.h[0] * Math.abs(t[0] * cs - t[2] * sn) + f.h[2] * Math.abs(t[0] * sn + t[2] * cs);
      if (Math.abs(s) <= Math.max(K.underM, Math.min(half, K.holeM))) {   // (under the charge: within underM of it, or the slab it lies on while that fits the hole)
        const sp = lerp(K.through[0], K.through[1], h1), j = (h2 - 0.5) * 1.2; v = [-n[0] * sp + t[0] * j, 0.3 + 0.9 * h3, -n[2] * sp + t[2] * j]; }
      else { const out = lerp(K.back[0], K.back[1], h1), along = Math.sign(s) * K.side * (0.35 + 0.65 * h2); v = [n[0] * out + t[0] * along, lerp(K.up[0], K.up[1], h3), n[2] * out + t[2] * along]; }
      const w: Vec3 = [(h1 - 0.5) * K.spin * base.spin, (h2 - 0.5) * 0.6 * K.spin * base.spin, (h3 - 0.5) * K.spin * base.spin];
      const got = left-- > 0 ? this.destr.debris.spawn('chunk', f, v, w, who) : null;
      if (got) { FURN_STATS.chunks++; got.level = base.land.level; got.sfx = base.land.sfx; this.destr.breaks.dress(got); } else { FURN_STATS.demoted++; this.chips(f.c, v, b, who, 14); }
    }
    const P = gpuFx(this.g); if (!P) return;
    const burst = (d: Vec3, k: number) => P.emit('debris', b.c, v3.normalize(d), K.chips[k], { speed: K.chipV[k], speedJit: 0.7, spread: 1.1, life: 18, lifeJit: 0.3, size: 0.006, sizeJit: 0.6, aspect: 3, color: v3.copy(b.albedo), owner: who });
    burst([n[0], 0.5, n[2]], 0); burst([-n[0], 0.3, -n[2]], 1);   // (splinters back into the room, and through)
  }
  /** A STEEL CARCASS (a cabinet, a locker: a steel box at least `STEEL_CARCASS_M` through on every side) is sheet on a frame, and comes apart as that — not as
   *  the solid block the row's lengths would saw it into. Beside the charge it is torn into its SHEETS (door, back, two sides, top), each thrown by itself; further
   *  out the sheet on the broad face that looks at the blast is torn off and the carcass goes over whole, open on that face. null = not a carcass (the row's
   *  own cut). Only asked with the cut switch on: the table shapes each part (breakTable.ts `sheet` / `carcass`). Draws nothing from this module's stream. */
  private steel(b: Box, mode: 'shatter' | 'apart', dir: Vec3, seed: number): SteelPart[] | null {
    if (b.rot || Math.min(b.h[0], b.h[1], b.h[2]) * 2 < STEEL_CARCASS_M || Math.max(b.h[0], b.h[1], b.h[2]) * 2 > STEEL_CARCASS_MOST) return null;
    // … and PAINTED AS ONE: a plain grey — no hue to speak of, neither the dark of a rack / a screen's housing nor white — that no other material's palette claims.
    // (The break class 'metal' is also where every unnamed and every red paint lands: a vending machine, a coloured crate, a dark rack keep the row's own cut.)
    if (!steelGrey(b.albedo)) return null;
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const t = BREAKS.steel.sheet;
    const deep: 0 | 2 = b.h[0] <= b.h[2] ? 0 : 2, wide: 0 | 2 = deep === 0 ? 2 : 0;   // the door is on a broad upright face
    const ax: Vec3 = deep === 0 ? [cs, 0, -sn] : [sn, 0, cs]; const sign: 1 | -1 = ax[0] * dir[0] + ax[2] * dir[2] > 0 ? -1 : 1;   // (the broad face that LOOKS AT the blast is the sheet torn off: the carcass goes over away from it, so its open side ends up or sideways — seen — never under it)
    const part = (l: Vec3, h: Vec3): Box => makeBox({ c: [b.c[0] + cs * l[0] + sn * l[2], b.c[1] + l[1], b.c[2] - sn * l[0] + cs * l[2]], h, yaw: b.yaw, albedo: v3.copy(b.albedo) });
    const on = (a: 0 | 1 | 2, s: number, shy: number): SteelPart => { const l: Vec3 = [0, 0, 0], h: Vec3 = [b.h[0] - shy, b.h[1] - shy, b.h[2] - shy]; l[a] = s * (b.h[a] - t); h[a] = t; return { box: part(l, h) }; };
    if (mode === 'apart') { const door = on(deep, sign, 0.012); door.box.c[0] += ax[0] * sign * 0.03; door.box.c[2] += ax[2] * sign * 0.03; return [{ box: part([0, 0, 0], [b.h[0], b.h[1], b.h[2]]), open: { axis: deep, sign }, seed }, door]; }
    return [on(deep, sign, 0.012), on(deep, -sign, 0), on(wide, 1, 2 * t), on(wide, -1, 2 * t), on(1, 1, 2 * t)];
  }
  /** `b` cut into the boxes it flies as, by its material's row (FURN_BREAK): along its longest side, and into strips across its second */
  private fragments(b: Box, row: BreakRow, mode: 'shatter' | 'apart'): Box[] {
    const ax = [0, 1, 2].sort((p, q) => b.h[q] - b.h[p] || p - q); const L1 = b.h[ax[0]] * 2, L2 = b.h[ax[1]] * 2; const R = row[mode];
    const n1 = Math.max(1, Math.min(R.max, Math.round(L1 / R.len))), n2 = L2 >= 0.3 ? Math.max(1, R.strips) : 1;
    const cuts = (n: number): number[] => { const c = [-1]; for (let j = 1; j < n; j++) c.push(-1 + 2 * (j + (this.hash() - 0.5) * row.uneven) / n); c.push(1); return c; };
    const c1 = cuts(n1), c2 = cuts(n2); const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const out: Box[] = [];
    for (let p = 0; p < n1; p++) for (let q = 0; q < n2; q++) {
      const l: Vec3 = [0, 0, 0], h: Vec3 = [b.h[0], b.h[1], b.h[2]];
      l[ax[0]] = b.h[ax[0]] * (c1[p] + c1[p + 1]) / 2; h[ax[0]] = b.h[ax[0]] * (c1[p + 1] - c1[p]) / 2;
      l[ax[1]] = b.h[ax[1]] * (c2[q] + c2[q + 1]) / 2; h[ax[1]] = b.h[ax[1]] * (c2[q + 1] - c2[q]) / 2;
      out.push(makeBox({ c: [b.c[0] + cs * l[0] + sn * l[2], b.c[1] + l[1], b.c[2] - sn * l[0] + cs * l[2]], h, yaw: b.yaw, albedo: v3.copy(b.albedo) }));
    }
    return out;
  }

  /** the props: thrown and spun through their own solver; one beside the charge comes apart */
  private pushable(at: Vec3, k: number, who: number, origins: Vec3[], budget: { chunks: number }) {
    const g = this.g; const throwM = FURN.throwM * k, breakM = FURN.propBreakM * k;
    for (const p of [...g.props.props]) {
      const d = Math.max(0, Math.hypot(p.x - at[0], p.z - at[2]) - p.radius * 0.5); if (d > throwM) continue;
      const mid: Vec3 = [p.x, Math.min(0.6, p.height * 0.6), p.z], top: Vec3 = [p.x, p.height + 0.05, p.z];
      if (!origins.some(o => this.clear(o, mid) || this.clear(o, top))) { FURN_STATS.propsShielded++; continue; }
      const dir = this.away(at, [p.x, 0, p.z]); const fall = 1 - d / throwM;
      if (d <= breakM && budget.chunks > 0) { this.breakProp(p, at, fall, who, budget); continue; }
      const dv = FURN.throwV * fall * Math.max(0.6, Math.min(1.4, Math.sqrt(12 / p.mass)));
      const side = (this.hash() - 0.5) * 1.6 * p.radius;   // off-centre: it spins as it goes
      g.props.applyImpulse(p, [p.x - dir[2] * side, 0, p.z + dir[0] * side], [dir[0] * dv * p.mass, 0, dir[2] * dv * p.mass], who);
      FURN_STATS.propsThrown++;
    }
  }
  private breakProp(p: Prop, at: Vec3, fall: number, who: number, budget: { chunks: number }) {
    const g = this.g;
    for (const b of p.boxes) this.throwPiece(makeBox({ c: v3.copy(b.c), h: v3.copy(b.h), yaw: b.yaw, albedo: v3.copy(b.albedo) }), at, 'shatter', fall, FURN_BREAK[breakClassOf(b.albedo)], who, budget, b);   // (its parts are already its pieces: each thrown whole)
    for (const c of this.destr.debris.list) if (c.on === p) { c.on = null; c.rest = false; c.stillT = 0; }   // what lay on it falls
    for (const it of g.items.items) if (it.on === p) { it.on = null; it.settled = false; it.vel = [0, 0, 0]; }   // (a can, a dropped magazine: its own rule only looks again when the prop MOVES)
    g.props.remove(p); this.goneProps++; FURN_STATS.propsBroken++;
    g.col.sound.invalidate();
  }

  /** under a roof? (the index's own test: the furniture is the inside's) */
  private roofed(x: number, z: number): boolean { const I = this.g.reachInterior; if (!I) return true; const cx = Math.floor(x - WORLD.min[0]), cz = Math.floor(z - WORLD.min[2]); return cx >= 0 && cz >= 0 && cx < WORLD.gridW && cz < WORLD.gridH && I[cz * WORLD.gridW + cx] === 1; }
  /** may the mouth rule take the static `i` at all, by what it was AUTHORED as (asked of a blast and of a checkpoint alike)? */
  private mouthOk(i: number, saved = false): boolean {
    const b = this.g.col.boxes[i]; if (!b || b.rot || this.kept.has(i) || this.destr.walls.breakableAt(i)) return false;
    if ((this.hidden.get(i) ?? b.flags) & (BoxFlag.Glass | BoxFlag.Dynamic) || (!this.hidden.has(i) && this.destr.flags0(i) === undefined && b.flags & BoxFlag.NoPrimary && !this.destr.itemOf(i))) return false;
    const a = aabbOf(b); return a.y1 <= FURN.mouth.top && (volOf(b) <= FURN.mouth.vol || ((FURN.mouth.snow || saved) && snowPaintOf(b) !== null)) &&   // (a long bank of lying snow is no heavy thing: the size bar is the furniture's — `saved`: a checkpoint's, taken under the switch whatever it says now)
       !this.fronts.some(f => f[0] > a.x0 - 0.3 && f[0] < a.x1 + 0.3 && f[2] > a.z0 - 0.3 && f[2] < a.z1 + 0.3);
  }
  /** everything resting on `seed`, layer by layer (drawn-only sheets too), passing over what `done` already holds; null = something up there is not the mouth
   *  rule's to take */
  private mouthStack(seed: AABB[], done: { has(j: number): boolean }, n: number): number[] | null {
    const boxes = this.g.col.boxes, walls = this.destr.walls; const out: number[] = []; let layer = seed;
    for (let d = 0; d < 16 && layer.length; d++) {
      const next: AABB[] = [];
      for (let j = 0; j < n; j++) {
        const o = boxes[j], y0 = o.c[1] - o.h[1]; if (o.flags & BoxFlag.NoPrimary || done.has(j) || out.includes(j) || !layer.some(t => Math.abs(y0 - t.y1) <= FURN.touch)) continue;
        const q = aabbOf(o); if (!layer.some(t => Math.abs(q.y0 - t.y1) <= FURN.touch && overPlan(q, t)) || walls.breakableAt(j)) continue;
        if (!this.mouthOk(j)) { if (o.flags & BoxFlag.NoShadow && !this.kept.has(j)) continue; return null; }   // (a drawn-only thing too tall to take — a flue up to the duct — stays where it hangs; a lamp's own card keeps what carries it)
        out.push(j); next.push(q);
      }
      layer = next;
    }
    return out;
  }
  /** is the standing static `i` the mouth rule's to take as a THING (mouthOk is asked beside it)? One of the index's, or — not the index's — under a roof,
   *  and a structure paint is structure — but for white, which is counters and appliances too — and a tall thin thing is a post. */
  private mouthMine(i: number, b: Box, a: AABB): boolean {
    if (this.memberAt.has(i)) return true;
    if (FURN.mouth.snow && snowPaintOf(b) !== null) return true;   // (lying snow banked at the wall's foot, under a roof or not: the blast that opens the wall throws it — mouthOk's size bars still stand)
    const name = paletteName(b.albedo), post = Math.min(b.h[0], b.h[2]) < 0.1 && a.y1 > 1.5 && a.y1 - a.y0 > 1.0;   // (tall in itself: a binder on a top shelf is thin and high up, and no post)
    return !post && this.roofed(b.c[0], b.c[2]) && (!name || !STRUCT.has(name) || (name === 'white' && a.y1 <= 2.0));
  }
  /** WOULD mouth() TAKE THE STATIC `i` from `r`, the two mouths of a hole not blown yet? Its own tests, reading only (wallcharge.ts asks before it promises
   *  floor behind a wall — the furniture index is not the whole of what a blown hole clears: a cot a hair over the index's size bar goes with the wall all
   *  the same). True = it stands in the zone in a body's way and is the rule's to take with all that rests on it, or it rests on such a thing. The safe side throughout:
   *  nothing is said of the wall engine's cover (how much of a panel razeIn takes is the blast's to say), and never
   *  where the rule would not run (the switches, a showcase). Whether a thing is takeable does not hang on the zone, so that half is kept for the frame. */
  mouthWouldTake(i: number, r: [number, number, number, number], depth = 0): boolean {
    if (!FURN.mouth.on || !FURNBLAST.on || !DESTRUCTION.on || this.destr.showChaos !== null) return false;
    const g = this.g, boxes = g.col.boxes, walls = this.destr.walls, n = Math.min(boxes.length, walls.authored), b = boxes[i]; if (!b || i >= n) return false;
    const M = this.mouthMemo, serial = (g.engine.world as { geomSerial?: number }).geomSerial ?? 0; if (M.t !== g.time || M.serial !== serial) { M.t = g.time; M.serial = serial; M.can.clear(); M.under.clear(); }
    const a = aabbOf(b);
    if (overPlan(a, { x0: r[0], z0: r[1], x1: r[2], z1: r[3] })) {   // as a thing in the zone itself
      let can = M.can.get(i);
      if (can === undefined) {
        this.index();
        can = !(a.y0 >= 1.7 || a.y1 <= 0.2 || walls.breakableAt(i) || b.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow)) && this.mouthMine(i, b, a) && this.mouthOk(i) && this.mouthStack([a], NONE_DONE, n) !== null;
        M.can.set(i, can);
      }
      if (can) return true;
    }
    // …or with the thing it rests on (mouthStack's own test of 'rests on': a blanket on a cot, whatever its paint)
    if (depth >= 4 || walls.breakableAt(i) || !this.mouthOk(i)) return false;
    let under = M.under.get(i);
    if (!under) { under = []; for (let j = 0; j < n; j++) { const o = boxes[j]; if (j === i || o.flags & BoxFlag.NoPrimary || Math.abs(a.y0 - (o.c[1] + o.h[1])) > FURN.touch) continue; if (overPlan(a, aabbOf(o))) under.push(j); } M.under.set(i, under); }
    return under.some(j => this.mouthWouldTake(j, r, depth + 1));
  }
  private mouthMemo = { t: -1, serial: -1, can: new Map<number, boolean>(), under: new Map<number, number[]>() };
  /** A HOLE A BLAST OPENS CAN BE WALKED THROUGH (FURN.mouth): after the furniture's own bands have had their say, whatever still stands in a body's way over `r` —
   *  the hole's two mouths — goes. Beyond the wall it stood between the burst and all of it, so the wall engine's cover rule (judged from the burst) and the
   *  furniture's size bars (written for what a blast throws across a room) both leave things there; on the burst's own side they leave what neither lists. The
   *  hole was then a window. A thing goes WITH everything resting on it, or — one of those being a thing this rule never takes (a lamp, a rack) — not at all;
   *  and what rests on a thing ANOTHER rule has already taken from the zone (a shelf the wall engine dropped, its binders left in the air) goes the same way. */
  private mouth(at: Vec3, who: number, r: [number, number, number, number], budget: { chunks: number }) {
    const g = this.g, boxes = g.col.boxes, walls = this.destr.walls; this.index();
    const n = Math.min(boxes.length, walls.authored); const zone = { x0: r[0], z0: r[1], x1: r[2], z1: r[3] };
    const done = new Set<number>(); const hid: number[] = [];
    const stack = (seed: AABB[]) => this.mouthStack(seed, done, n);
    const snowy = new Set<number>();   // (lying snow among what was hidden: the feed's row counts it by its stretch at the hole, not by its length along the wall)
    const take = (i: number) => {
      const b = boxes[i]; done.add(i); const m = this.memberAt.get(i) ?? { i, a: aabbOf(b), root: true, ghost: (b.flags & BoxFlag.NoShadow) !== 0, nb: [], sup: [], group: null };
      if (this.breakStatic(m, at, 'shatter', 0.6, who, budget)) { hid.push(i); if (FURN.mouth.snow && snowPaintOf(b) !== null) snowy.add(i); }
      (this.memberAt.has(i) ? this.gone : this.goneMouth).add(i); FURN_STATS.mouth++;
    };
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, hx = (r[2] - r[0]) / 2, hz = (r[3] - r[1]) / 2; const razed: AABB[] = [];
    for (let i = 0; i < n; i++) {
      const b = boxes[i], reach = Math.max(b.h[0], b.h[2]) * 1.42; if (Math.abs(b.c[0] - cx) > hx + reach || Math.abs(b.c[2] - cz) > hz + reach || done.has(i)) continue;
      const a = aabbOf(b); if (!overPlan(a, zone) || a.y0 >= 1.7 || a.y1 <= 0.2) continue;   // (in a walking body's way: on the floor, on legs or on a wall)
      const br = walls.breakableAt(i);
      if (br) {   // the wall engine's cover: the stretch of it in the way (a wall proper is the blast's own business)
        if (br.kind !== 'cover' || br.id !== i || br.open >= br.cells) continue;
        const row = walls.razeIn(i, r, who, this.away(at, b.c), budget);
        if (row) { FURN_STATS.mouth++; FURN_STATS.razed++; razed.push({ x0: Math.max(a.x0, row.rect[0]), z0: Math.max(a.z0, row.rect[1]), x1: Math.min(a.x1, row.rect[2]), z1: Math.min(a.z1, row.rect[3]), y0: a.y0, y1: a.y1 }); }
        continue;
      }
      if (b.flags & BoxFlag.NoPrimary && (this.hidden.has(i) || this.destr.flags0(i) !== undefined)) {   // gone already, by this blast's bands or the wall engine's fall (which is capped): what it carried hangs in the hole, and goes
        const up = stack([a]); if (up) for (const j of up) take(j); else FURN_STATS.mouthLeft++;
        continue;
      }
      if (b.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow)) continue;   // (drawn only, or authored unseen: nothing a body meets)
      const up = this.mouthMine(i, b, a) && this.mouthOk(i) ? stack([a]) : null;
      if (!up) { FURN_STATS.mouthLeft++; continue; }
      take(i); for (const j of up) take(j);
    }
    if (razed.length) { const up = stack(razed); if (up) for (const j of up) take(j); else FURN_STATS.mouthLeft++; }   // (what stood on the razed stretch: a chest's top)
    if (!hid.length) return;
    const q = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; for (const i of hid) { const a = aabbOf(boxes[i]); q.x0 = Math.min(q.x0, a.x0); q.x1 = Math.max(q.x1, a.x1); q.z0 = Math.min(q.z0, a.z0); q.z1 = Math.max(q.z1, a.z1); }
    const c: Vec3 = [(q.x0 + q.x1) / 2, 0.6, (q.z0 + q.z1) / 2];
    g.col.sound.invalidate(); g.smoke.obstaclesChanged?.(c, Math.hypot(q.x1 - q.x0, q.z1 - q.z0) / 2 + 1.5);
    const opened: number[] = []; const ch = g.col.nav.rebake(q.x0, q.z0, q.x1, q.z1); for (let k = 0; k < ch.length; k += 2) if (ch[k + 1] === 0) opened.push(ch[k]);
    FURN_STATS.navOpened += opened.length; this.bump();
    let rect: [number, number, number, number] = [q.x0, q.z0, q.x1, q.z1], pos = c;
    if (snowy.size) { const n = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; for (const i of hid) { const a = aabbOf(boxes[i]), sn = snowy.has(i); n.x0 = Math.min(n.x0, sn ? Math.max(a.x0, zone.x0) : a.x0); n.x1 = Math.max(n.x1, sn ? Math.min(a.x1, zone.x1) : a.x1); n.z0 = Math.min(n.z0, sn ? Math.max(a.z0, zone.z0) : a.z0); n.z1 = Math.max(n.z1, sn ? Math.min(a.z1, zone.z1) : a.z1); }
      if (n.x1 >= n.x0 && n.z1 >= n.z0) { rect = [n.x0, n.z0, n.x1, n.z1]; pos = [(n.x0 + n.x1) / 2, 0.6, (n.z0 + n.z1) / 2]; } }
    walls.note({ kind: 'cover', cause: 'blast', id: hid[0], pos, rect, opened, walkable: opened.length > 0, sight: true, dead: true, who });
  }
  private away(at: Vec3, p: Vec3): Vec3 { const dx = p[0] - at[0], dz = p[2] - at[2]; const L = Math.hypot(dx, dz); if (L > 0.05) return [dx / L, 0, dz / L]; const a = this.hash() * Math.PI * 2; return [Math.cos(a), 0, Math.sin(a)]; }
  private chips(c: Vec3, v: Vec3, b: Box, who: number, n: number) { const P = gpuFx(this.g); if (!P) return; const wood = surfOf(b.albedo) === 'wood'; P.emit('debris', c, v3.normalize([v[0], Math.max(0.3, v[1]), v[2]]), n, { speed: 2.4, speedJit: 0.7, spread: 1.1, life: 18, lifeJit: 0.3, size: wood ? 0.006 : 0.01, sizeJit: 0.6, aspect: wood ? 3 : 1, color: v3.copy(b.albedo), owner: who }); }
  private bump() { const w = this.g.engine.world as { geomSerial?: number }; w.geomSerial = (w.geomSerial ?? 0) + 1; }

  /** Level reset (Destruction.reset, after the walls'): every static this module hid back as authored and the level's nav / sound / smoke told; nothing at all when it broke nothing. (The props it took out of the list come back with PropSystem.reset.) */
  reset() {
    const g = this.g; this.counter = 1; this.last = null; this.goneProps = 0; this.gone.clear(); this.goneMouth.clear();
    if (!this.hidden.size) return;
    for (const [i, f] of this.hidden) g.col.boxes[i].flags = f; this.hidden.clear(); this.bump();
    g.col.nav.rebake(WORLD.min[0], WORLD.min[2], WORLD.max[0], WORLD.max[2]); g.col.sound.invalidate();
    g.smoke.obstaclesChanged?.([(WORLD.min[0] + WORLD.max[0]) / 2, 1, (WORLD.min[2] + WORLD.max[2]) / 2], 60);
    // the AI was told of every piece that went (a 'cover' row each): it is told the level is back too, unless the walls' own reset has just said so
    this.noteReset('reset');
  }
  // ---------------------------------------------------------------- checkpoints (savestate.ts files snapshot() beside the walls' slice and re-applies it after the restart)
  /** What a blast took of the furniture, for a checkpoint: the statics (ascending) and the props that came apart (their ids). undefined = nothing broke — the file
   *  is then byte for byte what it was before this slice existed. The pieces on the floor are not filed (no debris is, the walls' rubble included). */
  snapshot(): FurnSave | undefined {
    const g = this.g; const s = [...this.gone].sort((p, q) => p - q); const p = g.props.props.length === g.props.all.length ? [] : g.props.all.filter(x => !g.props.props.includes(x)).map(x => x.id);
    const m = [...this.goneMouth].sort((p, q) => p - q);
    return s.length || p.length || m.length ? (m.length ? { v: 1, s, p, m } : { v: 1, s, p }) : undefined;
  }
  /** can this file's slice be applied to this level (savestate.ts canLoad)? null = yes */
  check(s: FurnSave | undefined): string | null {
    if (!s) return null; if (s.v !== 1 || !Array.isArray(s.s) || !Array.isArray(s.p)) return 'furniture: unknown slice';
    const g = this.g; this.index();   // (the level's furniture, by the flags it was authored with: the same answer whenever it is asked)
    for (const i of s.s) if (!Number.isInteger(i) || !this.memberAt.has(i) || this.destr.walls.breakableAt(i)) return `furniture: static ${i} is not a piece of this level's furniture`;
    for (const id of s.p) if (!Number.isInteger(id) || id < 0 || id >= g.props.all.length) return `furniture: prop ${id} is not this level's`;
    if (s.m !== undefined) { if (!Array.isArray(s.m)) return 'furniture: unknown slice'; for (const i of s.m) if (!Number.isInteger(i) || i < 0 || i >= Math.min(g.col.boxes.length, this.destr.walls.authored) || !this.mouthOk(i, true)) return `furniture: static ${i} is not this level's to take`; }
    return null;
  }
  /** Apply a checkpoint's slice on the freshly reset level, after the walls' own: the same statics gone again, silently (no pieces, no dust, no sound, no blame),
   *  the props that came apart out of the level again, the nav grid re-baked under what went, and ONE 'reset' row (cause 'load') unless the walls have just filed it. */
  restore(s: FurnSave | undefined) {
    if (!s) return;
    const g = this.g, boxes = g.col.boxes; const r = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; let any = false;
    const mouth = new Set(s.m ?? []);
    for (const i of [...s.s, ...mouth]) {
      const b = boxes[i]; if (!b) continue; (mouth.has(i) ? this.goneMouth : this.gone).add(i);
      if (this.destr.itemOf(i)) { this.destr.dropItem(i, [0, 0, 1], NOBODY_ID, true); any = true; continue; }   // (the lane's own thing: its quiet road — a lit screen's light goes with it)
      if (b.flags & BoxFlag.NoPrimary) continue;   // (already gone: it hung from a cover panel the walls' slice has just re-opened)
      this.hidden.set(i, b.flags); b.flags |= HIDE; any = true;
      const a = aabbOf(b); r.x0 = Math.min(r.x0, a.x0); r.x1 = Math.max(r.x1, a.x1); r.z0 = Math.min(r.z0, a.z0); r.z1 = Math.max(r.z1, a.z1);
    }
    for (const id of s.p) { const p = g.props.all[id]; if (p && g.props.props.includes(p)) { g.props.remove(p); this.goneProps++; any = true; } }
    if (!any) return;
    this.bump(); g.col.sound.invalidate();
    if (r.x1 >= r.x0) { g.col.nav.rebake(r.x0, r.z0, r.x1, r.z1); g.smoke.obstaclesChanged?.([(r.x0 + r.x1) / 2, 1, (r.z0 + r.z1) / 2], Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2 + 1.5); }
    this.noteReset('load');   // (the restart's own 'reset' row was filed with the level whole: the feed's last word is this one)
  }
  /** one 'reset' row in the walls' change feed (the AI re-reads the level), unless its last row already says exactly that at this instant */
  private noteReset(cause: 'reset' | 'load') {
    const W = this.destr.walls, last = W.changes[W.changes.length - 1];
    if (!last || last.kind !== 'reset' || last.t !== this.g.time || (cause === 'load' && last.cause !== 'load')) W.note({ kind: 'reset', cause, id: -1, pos: [0, 0, 0], rect: [WORLD.min[0], WORLD.min[2], WORLD.max[0], WORLD.max[2]], opened: [], walkable: false, sight: false, dead: false, who: NOBODY_ID });
  }
  summary(): string { const s = FURN_STATS; return `furniture ${FURNBLAST.on ? 'on' : 'off'} · ${s.blasts} blasts · ${s.groups} broken (${s.statics} statics, ${s.razed} panels, ${s.items} things on them) · props ${s.propsThrown} thrown ${s.propsBroken} broken · chunks ${s.chunks} (+${s.demoted} as chips) · shielded ${s.shielded + s.propsShielded}`; }
}
