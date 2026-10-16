// WHICH WAY EACH TEAMMATE WALKS — a bystander for tools/qa/playthrough.ts (PT_WAYS=1), like its Tally and DefWatch: it reads, and writes nothing the game reads.
// the maintainer, 10-08, playing the one merged build: "sometimes they will (1) not all go through the door when clearing (they'll route to the room through a
// different door) and then (2) even worse they'll go through uncleared rooms to get there!" Two records of a run:
//   crossings   every doorway a teammate walks through: who, which door, his order and its door, the door order he is a man of (its door, its phase), and
//               whether anybody of the team (a teammate or Sam) had stood in the room beyond it before he did
//   smells      'otherDoor'  a man of a door order (or stacking on a door) walked through a door that is not the ordered one before he was through the ordered one —
//                            INTO the very room the order is for: the note's (1)
//               'uncleared'  a man walked into a ROOM nobody of the team had stood in, and not through the door of an entry he is a man of (a door order
//                            past its 'go'): the note's (2). Open floor (a flood past the room fight's cap) is not a room and never counts
// A ROOM is the room fight's own (roomfight.ts roomAt: the nav cells reachable without crossing a doorway cell), flooded on the Tally's books (`roomOf`).
// A man the fight has (alert, no script) is not counted for 'uncleared': where the fight takes him is the fight's.
import { crossesDoor, doorCells } from '../../src/game/guards.ts';

export interface WayRow { t: number; who: string; door: string; order: string; orderDoor: string | null; op: string | null; phase: string | null; fresh: boolean; fight: boolean; smell: 'otherDoor' | 'uncleared' | 'both' | null }
type MyRoom = { cells: Set<number>; big: boolean };

export class WaysWatch {
  rows: WayRow[] = []; otherDoor = 0; uncleared = 0; crossings = 0; entries = 0;
  private was = new Map<any, number[]>(); private been = new Set<MyRoom>(); private n = 0;
  /** per man, per door order: has he been through the ordered door yet */
  private through = new Map<any, any>();
  constructor(private g: any, private roomOf: (p: number[]) => MyRoom | null, private say: (s: string) => void) { }
  private small(r: MyRoom | null): r is MyRoom { return !!r && !r.big; }
  tick(t: number, team: any[]) {
    const g = this.g, sam = g.player.char;
    // where the team has stood (20 Hz, a body on a doorway's own cells in neither room; a crossing marks its own far room below, after it has been judged)
    if (this.n++ % 3 === 0) { const nav = g.col.nav, dc = doorCells(g);
      for (const b of [sam, ...team.filter(m => m.state !== 'dead').map(m => m.char)]) { if (dc.has(nav.idx(Math.floor(b.pos[0] / nav.cell), Math.floor(b.pos[2] / nav.cell)))) continue; const r = this.roomOf(b.pos); if (r) this.been.add(r); } }
    for (const m of team) {
      const p = m.char.pos, was = this.was.get(m); this.was.set(m, [p[0], 0, p[2]]);
      if (!was || m.state === 'dead' || Math.hypot(p[0] - was[0], p[2] - was[2]) > 1.5) continue;
      for (const d of g.doors.list) { const x = crossesDoor(was as any, p, d); if (!x) continue;
        const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), c = d.frameCentre, sg = (p[0] - c[0]) * nx + (p[2] - c[2]) * nz >= 0 ? 1 : -1;
        const far = this.roomOf([c[0] + nx * sg * 1.2, 0, c[2] + nz * sg * 1.2]), fresh = this.small(far) && !this.been.has(far);
        const A = g.orders.of(m), op = g.doorTools.ops.find((o: any) => o.men.includes(m)) ?? null, fight = !m.script && m.state === 'alert';
        const orderDoor = A?.door?.def.name ?? null, entering = !!op && op.door === d && (op.phase === 'enter' || op.phase === 'in' || op.crossed?.has(m));
        if (op && op.door === d) this.through.set(m, op);
        // (1): under a door order (or a stack) on door X, not yet through X, he walks through another door INTO the room X leads to
        let other = false; const X = op?.door ?? (A?.order === 'stack' ? A.door : null);
        if (X && X !== d && !(op && this.through.get(m) === op)) { const side = op ? op.side : A?.post ? this.sideOf(X, A.post) : 0; const beyond = side ? this.roomAcross(X, -side) : null; other = !!far && far === beyond && this.small(far); }
        const unc = fresh && !entering && !fight;
        const smell = other && unc ? 'both' : other ? 'otherDoor' : unc ? 'uncleared' : null;
        this.crossings++; if (entering && fresh) this.entries++; if (other) this.otherDoor++; if (unc) this.uncleared++;
        const row: WayRow = { t: +t.toFixed(1), who: m.callsign, door: d.def.name, order: A ? A.order : m.script ? 'scripted' : m.state, orderDoor, op: op?.door.def.name ?? null, phase: op?.phase ?? null, fresh, fight, smell };
        this.rows.push(row);
        if (smell) this.say(`   >> way · ${m.callsign} through ${d.def.name} · ${smell === 'both' ? 'another door than the ordered one, into a room nobody had been in' : smell === 'otherDoor' ? 'another door than the ordered one' : 'into a room nobody had been in'} · ${row.order}${orderDoor ? ' ' + orderDoor : ''}${op ? ` · op ${op.kind} ${row.op} (${row.phase})` : ''}${A?.going ? ` · ${A.arrived ? A.there : A.going}` : ''}`);
        if (far) this.been.add(far); } }
  }
  /** orders.ts sideOf: which face of a door a point is on · the room on that face */
  private sideOf(d: any, p: number[]): 1 | -1 { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]) >= 0 ? 1 : -1; }
  private roomAcross(d: any, side: number): MyRoom | null { const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), c = d.frameCentre; return this.roomOf([c[0] + nx * side * 1.2, 0, c[2] + nz * side * 1.2]); }
  close() { return { crossings: this.crossings, entries: this.entries, otherDoor: this.otherDoor, uncleared: this.uncleared, rows: this.rows.filter(r => r.smell) }; }
}
