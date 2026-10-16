// CLEARED ROOMS (Game.cleared, __game.cleared) — which rooms the team has been in, for the WAY a teammate walks to where an order sends him.
// the maintainer, 10-08, playing the warehouse with the four: "sometimes they will (1) not all go through the door when clearing (they'll route to the room through
// a different door) and then (2) even worse they'll go through uncleared rooms to get there!" Every ordered walk was the nav grid's SHORTEST way, and the
// squad of four stacked on whichever face of a door its men could walk to soonest (orders.ts sideFor) — with doors standing open after a fight, that was
// often the face INSIDE the room the order was for, reached through its other door, or a short cut through a room next to it.
//
//   A ROOM       the room fight's own (roomfight.ts roomAt): the nav cells reachable from one another without crossing a doorway cell — flooded here on this
//                module's own books (the room fight's ids and merges depend on the order rooms are asked for; nothing here touches them). A flood past
//                ROOM_MAX_CELLS is open floor, not a room: never 'uncleared'. Nothing authored: a new level has its rooms for nothing.
//   KNOWN        one of the team — a teammate, or Sam — has STOOD in it this encounter (asked four times a second; a man in a doorway is in neither room).
//                Where Sam walks is his own call, and what he has walked through his men will walk through. Kept for the encounter (Game.resetGuards
//                forgets it; a checkpoint does not carry it: after a load the rooms the team stands in are known and the rest are learnt again).
//   THE RULE     orders.ts asks three things of it, each one switch (ORDERS.cleared / knownFace / ownDoor), each off = the build as it was:
//                · route(): a walk to a mark is priced with every cell of a room that is not known `ORDERS.clearedDear` times dearer — he goes ROUND by known
//                  floor where there is a way round. The room his mark is in and the room he stands in are never dear (the first is the order itself). With
//                  no way round he goes through, as before: an order is never refused for it.
//                · sideFor(): a door order is stacked on the face whose floor is KNOWN when the other face's is not, whatever the men's walks come to.
//                · the entry (doortools.ts): a man sent to his point inside goes THROUGH THE ORDERED DOOR — one who is not at it when the word comes (the fight
//                  had him, he was late to the stack) is walked to its mouth by known floor first, never in by the room's other door.
// With no operative on the floor nothing here runs. (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import type { Vec3 } from '../math/vec';
import type { Game } from './game';
import type { Door } from './doors';
import { doorCells } from './guards';

const ROOM_MAX_CELLS = 2400;   // roomfight.ts's own cap: past this a flood is open floor

export class ClearedRooms {
  /** nav cell → room number (1‥; 0 = a doorway, a wall, open floor, floor no door leads to) · per room: known · its cell count */
  private roomOfCell: Uint16Array | null = null; private knownRoom: Uint8Array = new Uint8Array(1); private sizes: number[] = [0];
  private last = -1; private builtFor: unknown = null;
  /** per door: the cell its floor on the + face and on the − face was flooded from (−1: no floor there) */
  private seeds = new Map<Door, [number, number]>();
  /** how often an order's walk went round an uncleared room · went through one for want of a way round · an order given was stacked on the known face over
   *  the nearer one · a man was walked to the ordered door's mouth instead of in by another (orders given and walks begun: a menu's questions are not counted) */
  stats = { round: 0, through: 0, face: 0, mouth: 0 };
  constructor(private g: Game) { }
  /** nothing known (a restart: Game.resetGuards) */
  reset() { this.knownRoom.fill(0); this.known = 0; this.last = -1; this.stats = { round: 0, through: 0, face: 0, mouth: 0 }; }

  /** the rooms of the level: a flood from the floor on either face of every door (a room no door leads to is nobody's to clear) */
  private build(): Uint16Array {
    const g = this.g, nav = g.col.nav; if (this.roomOfCell && this.builtFor === nav) return this.roomOfCell;
    const W = nav.W, H = nav.H, cs = nav.cell, dc = doorCells(g), M = new Uint16Array(W * H), seen = new Uint8Array(W * H); this.sizes = [0];
    const free = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && nav.blocked[nav.idx(x, z)] !== 1 && !dc.has(nav.idx(x, z));
    this.seeds.clear();
    for (const d of g.doors.list) { const pair: [number, number] = [-1, -1]; this.seeds.set(d, pair); for (const b of [1.0, -1.0]) {
      const th = d.def.closedDir, c = d.frameCentre; let sx = Math.floor((c[0] - Math.sin(th) * b) / cs), sz = Math.floor((c[2] + Math.cos(th) * b) / cs);
      if (!free(sx, sz)) { let found = false; for (let r = 1; r <= 2 && !found; r++) for (let dz = -r; dz <= r && !found; dz++) for (let dx = -r; dx <= r && !found; dx++) { const x = sx + dx, z = sz + dz; if (free(x, z) && ((x + 0.5) * cs - c[0]) * -Math.sin(th) * b + ((z + 0.5) * cs - c[2]) * Math.cos(th) * b > 0) { sx = x; sz = z; found = true; } } if (!found) continue; }
      const s0 = nav.idx(sx, sz); pair[b > 0 ? 0 : 1] = s0; if (seen[s0]) continue;
      const q = [s0]; seen[s0] = 1;
      for (let qi = 0; qi < q.length; qi++) {   // (filled to its end, whatever its size: a fill cut short would leave a pocket the next door floods as a room of its own)
        const cc = q[qi], x = cc % W, z = (cc / W) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!free(nx, nz)) continue; const n = nav.idx(nx, nz); if (!seen[n]) { seen[n] = 1; q.push(n); } } }
      if (q.length > ROOM_MAX_CELLS) continue;   // (open floor: its cells stay 0)
      const id = this.sizes.length; this.sizes.push(q.length); for (const cc of q) M[cc] = id;
    } }
    this.knownRoom = new Uint8Array(this.sizes.length); this.known = 0; this.roomOfCell = M; this.builtFor = nav; return M;
  }
  /** the room `p` stands in (0: none — a doorway, open floor) */
  roomAt(p: Vec3): number { const nav = this.g.col.nav, M = this.build(), x = Math.floor(p[0] / nav.cell), z = Math.floor(p[2] / nav.cell); return x < 0 || z < 0 || x >= nav.W || z >= nav.H ? 0 : M[nav.idx(x, z)]; }
  /** has the team been in the room `p` stands in (open floor and doorways: yes) */
  knownAt(p: Vec3): boolean { const r = this.roomAt(p); return !r || !!this.knownRoom[r]; }
  /** the room on a door's `side` face (orders.ts sideOf's sign), by the very cell its floor was flooded from — 0: open floor, or no floor on that face */
  roomBy(d: Door, side: 1 | -1): number { const M = this.build(), s = this.seeds.get(d)?.[side > 0 ? 0 : 1] ?? -1; return s < 0 ? 0 : M[s]; }
  /** is there floor at all on that face of the door */
  hasFloor(d: Door, side: 1 | -1): boolean { this.build(); return (this.seeds.get(d)?.[side > 0 ? 0 : 1] ?? -1) >= 0; }
  /** the room a mark is in — a mark on a cell that is no room's (a doorway, a wall's cell) is in every room a cell away */
  private roomsOf(p: Vec3): number[] {
    const r = this.roomAt(p); if (r) return [r];
    const nav = this.g.col.nav, M = this.build(), x = Math.floor(p[0] / nav.cell), z = Math.floor(p[2] / nav.cell), out: number[] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= nav.W || nz >= nav.H) continue; const q = M[nav.idx(nx, nz)]; if (q && !out.includes(q)) out.push(q); }
    return out;
  }
  isKnown(room: number): boolean { return !room || !!this.knownRoom[room]; }
  /** one of ours stands at `p` */
  mark(p: Vec3) { const r = this.roomAt(p); if (r && !this.knownRoom[r]) { this.knownRoom[r] = 1; this.known++; } }
  /** how many rooms are known (it only grows inside an encounter: a cheap 'has what is known changed') */
  known = 0;
  /** four times a second: where the team stands is known ground */
  tick() {
    const g = this.g; if (!g.orders.active) return;
    if (this.last >= 0 && Math.abs(g.time - this.last) < 0.25) return; this.last = g.time;
    for (const gd of g.orders.squad()) if (gd.state !== 'dead') this.mark(gd.char.pos);
    if (!g.player.down) this.mark(g.player.char.pos);
  }
  /** A WALK'S PRICE LIST: nav.findPath's `penalty` for a walk from `from` to `to` — every cell of a room nobody of the team has been in is `dear` times a
   *  cell of known floor, bar the room he stands in and the room his mark is in; `also`: rooms dear whatever is known of them (the room an entry is FOR,
   *  on the walk to its door's mouth). Null: nothing on this floor is dear for this walk. */
  dearFor(from: Vec3, to: Vec3, dear: number, also: number[] = []): ((ix: number, iz: number) => number) | null {
    const nav = this.g.col.nav, M = this.build(), K = this.knownRoom, a = this.roomAt(from), b = this.roomsOf(to);
    let some = also.some(r => r > 0); if (!some) for (let i = 1; i < K.length; i++) if (!K[i] && i !== a && !b.includes(i)) { some = true; break; }
    if (!some) return null;
    return (ix, iz) => { const r = M[nav.idx(ix, iz)]; return r && (also.includes(r) || (!K[r] && r !== a && !b.includes(r))) ? dear : 1; };
  }
  /** … one room alone dear (ORDERS.cleared off, the walk to an ordered door's mouth) */
  dearOnly(room: number, dear: number): (ix: number, iz: number) => number { const nav = this.g.col.nav, M = this.build(); return (ix, iz) => M[nav.idx(ix, iz)] === room ? dear : 1; }
  /** metres of a path (from `from`, by its corners) that lie on cells `pen` prices dear */
  dearAlong(from: Vec3, path: Vec3[], pen: (ix: number, iz: number) => number): number {
    const nav = this.g.col.nav; let m = 0, a = from;
    for (const b of path) { const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(L / 0.25));
      for (let i = 1; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[2] + (b[2] - a[2]) * i / n; if (pen(Math.floor(x / nav.cell), Math.floor(z / nav.cell)) > 1) m += L / n; }
      a = b; }
    return m;
  }
  summary(): string { this.build(); const k = this.known, S = this.stats; return `cleared rooms: ${k} of ${this.sizes.length - 1} known · routes ${S.round} round, ${S.through} through for want of a way · ${S.face} stacks on the known face · ${S.mouth} walked to the ordered door`; }
}
