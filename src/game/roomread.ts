// THE ROOM READ — one stateless answer to "what is the space round this point, and what leads out of it": the floor a man standing there shares with it, every
// WAY out of that floor (a door, a leafless gap, the mouth of a passage: cover.ts's own openings, nothing authored), which side of each way the space lies on,
// and whether the floor beyond it is ground the team already knows (cleared.ts). Two things read it and neither owns the facts: where the men stand and what
// each watches when Sam sends them to a spot (roomfit.ts), and the squad clearing a room it was sent into.
//
//   THE SPACE   the nav cells walked to from the point without crossing a door's frame, a gap's line or a passage's mouth, no further than `reach` metres of
//               walking. Finer than cleared.ts's room (which runs on through every leafless doorway): the office behind a doorway with no leaf is its own
//               space, and the doorway is a way out of it. Open ground has a space too: what is in reach.
//   A WAY       an opening whose line borders that floor. `inN` points from it INTO the space; `beyond` is a stride past it on the other face; `far` /
//               `farKnown` are cleared.ts's room there and whether one of the team has stood in it (open floor counts as known: cleared.ts's own rule);
//               `shut` / `locked` are the leaf's, as they stand now.
// PURE: it writes nothing, keeps nothing, draws no dice, moves nobody — the same answer for the same level, door states and known rooms, whoever asks and
// however often. (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import type { Vec3 } from '../math/vec';
import type { Game } from './game';
import type { Opening } from './cover';
import { doorCells } from './guards';

/** One way out of a space. */
export interface RoomWay {
  o: Opening;
  /** the unit line through the opening, pointing INTO the space that was asked about */
  inN: [number, number];
  /** a stride past it, on the face away from the space (floor height) */
  beyond: Vec3;
  /** cleared.ts's room on that far face (0: open floor, a doorway, none) · has the team stood on that floor (open floor: yes) */
  far: number; farKnown: boolean;
  /** a leaf stands shut in it · … and is locked against Sam's ring */
  shut: boolean; locked: boolean;
  /** metres from the point asked about, in plan */
  dist: number;
}
/** The space round a point. `cells`: its nav cells (indices), nearest first by walking · `steps`: how many cells of walking each is from the point. */
export interface RoomRead { at: Vec3; room: number; known: boolean; cells: number[]; steps: Map<number, number>; ways: RoomWay[] }

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** The space round `p` and its ways out. `reach`: metres of walking the space is followed for · `hint`: with `p` itself on a frame or a gap's line, the
 *  space is the one on this point's side of it (whoever asks says whose side: the man who gave the order, the man who stands there) · `ring`: the keys a
 *  locked leaf is judged against (default: the team's — Sam's ring and the codes he knows, orders.ts route()'s own rule). */
export function roomRead(g: Game, p: Vec3, reach = 9, hint: Vec3 = p, ring?: ReadonlySet<string>): RoomRead {
  const nav = g.col.nav, W = nav.W, H = nav.H, cs = nav.cell, C = g.cleared, dc = doorCells(g), opens = g.cover.ready();
  // the cells of every leafless opening's own line, near enough to matter: the space stops at them as it stops at a door's frame
  const lineOf = new Map<number, Opening>();
  for (const o of opens) {
    if (o.door || flat(o.at, p) > reach + 3) continue;
    const tx = -o.n[1], tz = o.n[0], w = Math.max(0, o.half - 0.34), k = Math.ceil(w / cs) + 1;
    for (let a = -k; a <= k; a++) { const x = o.at[0] + tx * a * cs * 0.5, z = o.at[2] + tz * a * cs * 0.5; if (Math.abs(a * cs * 0.5) > w + 1e-6 || nav.isBlocked(x, z)) continue;
      lineOf.set(nav.idx(Math.floor(x / cs), Math.floor(z / cs)), o); }
  }
  const free = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && nav.blocked[nav.idx(x, z)] !== 1;
  const inner = (i: number) => !dc.has(i) && !lineOf.has(i);
  // where the walk starts: the point's own cell, else (it is a wall's, a frame's, a line's) the free cell by it nearest the hint
  let sx = Math.floor(p[0] / cs), sz = Math.floor(p[2] / cs);
  if (!free(sx, sz) || !inner(nav.idx(sx, sz))) { let best = -1, bd = Infinity;
    for (let r = 1; r <= 3 && best < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = sx + dx, z = sz + dz; if (!free(x, z) || !inner(nav.idx(x, z))) continue;
      const d = Math.hypot((x + 0.5) * cs - hint[0], (z + 0.5) * cs - hint[2]) + 2 * Math.hypot((x + 0.5) * cs - p[0], (z + 0.5) * cs - p[2]); if (d < bd) { bd = d; best = nav.idx(x, z); } }
    if (best < 0) return { at: [p[0], 0, p[2]], room: C.roomAt(p), known: C.knownAt(p), cells: [], steps: new Map(), ways: [] };
    sx = best % W; sz = (best / W) | 0; }
  const max = Math.ceil(reach / cs), steps = new Map<number, number>(), cells: number[] = [nav.idx(sx, sz)], edge = new Map<Opening, number>();   // (edge: the space's cell by each way's line, the first met)
  steps.set(cells[0], 0);
  for (let qi = 0; qi < cells.length; qi++) { const c = cells[qi], x = c % W, z = (c / W) | 0, s = steps.get(c)!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!free(nx, nz)) continue; const n = nav.idx(nx, nz);
      const d = dc.get(n), o = d ? opens.find(q => q.door === d) : lineOf.get(n);
      if (o) { if (!edge.has(o)) edge.set(o, c); continue; }
      if (s >= max || steps.has(n)) continue; steps.set(n, s + 1); cells.push(n); } }
  if (!ring) { const P = g.player; ring = P.codes.size ? new Set([...P.keys, ...P.codes]) : P.keys; }
  const ways: RoomWay[] = [];
  for (const [o, c] of edge) {
    const ex = (c % W + 0.5) * cs, ez = (((c / W) | 0) + 0.5) * cs, s = (ex - o.at[0]) * o.n[0] + (ez - o.at[2]) * o.n[1] >= 0 ? 1 : -1;
    const inN: [number, number] = [o.n[0] * s, o.n[1] * s], beyond: Vec3 = [o.at[0] - inN[0], 0, o.at[2] - inN[1]], d = o.door;
    const far = d ? C.roomBy(d, sideSign(d, beyond)) : C.roomAt(beyond);
    const shut = !!d && !d.off && (d.latched || Math.abs(d.angle) < 0.2);
    ways.push({ o, inN, beyond, far, farKnown: d ? C.isKnown(far) : C.knownAt(beyond), shut, locked: shut && !!d && d.locked && d.latched && g.doors.lockedOut(d, [ex, 0, ez], ring), dist: flat(o.at, p) });
  }
  ways.sort((a, b) => a.dist - b.dist || (a.o.id < b.o.id ? -1 : 1));
  return { at: [(sx + 0.5) * cs, 0, (sz + 0.5) * cs], room: C.roomAt(p), known: C.knownAt(p), cells, steps, ways };
}
/** which face of a door a point is on, in orders.ts sideOf's sign (kept here: that module's own is built on this one's reads) */
function sideSign(d: { def: { closedDir: number; hinge: [number, number] | number[] } }, p: Vec3): 1 | -1 { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]) >= 0 ? 1 : -1; }
