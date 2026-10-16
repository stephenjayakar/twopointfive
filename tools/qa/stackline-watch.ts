// A BYSTANDER FOR THE PLAY-THROUGH (PT_STACKLINE=1): how long is a man in the door's line while he walks up to stack on it — and is he shot there?
// A WALK = a teammate under an order that sends him to a mark on a door without going through it (Assignment.shy === Assignment.door: 'stack up', and the
// door tools' own marks before the door goes), from the frame the order has him to the frame he is first on his mark (or dies, or is told something else).
// THE DOOR'S LINE, asked of the level and not of any rule: the floor beyond the door (nav cells on its far face inside FAR metres of the frame, 0.25 m² each)
// that has a straight line to him THROUGH THE OPENING at chest height. Twice a tenth of a second:
//   now   with the leaves where they stand (a shut leaf hides him: what a man inside can shoot at this frame)
//   geo   with every leaf taken away (what a man inside could shoot the moment the door stood open — a defender can pull it)
// Per walk: seconds, metres, seconds with ≥ MIN_CELLS cells on him (now / geo), the sum cells × 0.25 m² × seconds (now / geo: 'square metres of their floor
// that had him, second by second'), whether he crossed the front of the opening. Per stack (the men one order sent to one door): seconds until every living
// man of it was first on his mark, or how it ended before that. Per death of a man on such an order: walking or on his mark, the order he was under (a 'stack', or a door tool's own mark once the tool is given — the threshold's holders and slicers are the team's own doing), the leaf as he dropped and when the order took him, whether the round's line
// crossed the opening, where both stood. Reads positions, orders, doors and the collision grid; the leaves are lifted off the collision list and put back
// inside one call, with nothing of the game run in between. Every run's JSON carries `stackline`; with --trace each walk as it ends.
import { frameOf, crossesDoor } from '../../src/game/guards';
import { sideOf } from '../../src/game/orders';

export interface WalkOut { who: string; door: string; order: string; t0: number; secs: number; m: number; /** seconds in the line, m²·s of it: leaves as they stood · every leaf away */ now: number; nowM2s: number; geo: number; geoM2s: number;
  /** he walked across the front of the opening (inside its span, within CROSS_M of the frame) · the leaf stood open (or was off) for some of the walk */ crossed: boolean; open: boolean; end: 'on' | 'dead' | 'told' | 'run' }
export interface StackOut { door: string; order: string; t0: number; men: number; /** seconds until every living man of it was first on his mark (null: never) */ formed: number | null; end: 'formed' | 'told' | 'run'; secs: number }
export interface LineDeath { t: number; who: string; by: string | null; door: string; phase: 'walk' | 'stacked'; /** the order he was under · the leaf as he dropped · the leaf when that order took him */ order: string; leaf: 'open' | 'ajar' | 'shut' | 'off'; leaf0: 'open' | 'ajar' | 'shut' | 'off'; /** the killer stood beyond the door · the line between them crossed its opening */ beyond: boolean; through: boolean;
  /** cells of the far floor on him as he dropped (now) · metres from the frame line, along the frame from the hinge, to his mark */ cells: number; depth: number; along: number; toMark: number; at: [number, number]; kAt: [number, number] | null }
export interface StackLineOut { walks: WalkOut[]; stacks: StackOut[]; deaths: LineDeath[] }

const FAR = 7, EYE = 1.2, STEP = 0.1, MIN_CELLS = 3, CROSS_M = 2.5, CELL_M2 = 0.25;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const r1 = (x: number) => +x.toFixed(1), r2 = (x: number) => +x.toFixed(2);

/** the floor beyond `d` from the face `side` stands on: nav cells inside FAR of the frame */
export function farFloor(g: any, d: any, side: 1 | -1): number[][] {
  const L: number[][] = [], nav = g.col.nav, c = d.frameCentre, n = Math.ceil(FAR / nav.cell), cx = Math.floor(c[0] / nav.cell), cz = Math.floor(c[2] / nav.cell);
  for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) { const q = [(cx + dx + 0.5) * nav.cell, 0, (cz + dz + 0.5) * nav.cell];
    if (flat(q, c) > FAR || nav.isBlocked(q[0], q[2]) || sideOf(d, q as any) === side) continue; L.push(q); }
  return L;
}
/** cells of that floor with a line to `p` through the opening at chest height: [leaves as they stand, every leaf away] — the leaves are lifted off the
 *  collision list and put back inside this call */
export function cellsOnLine(g: any, d: any, far: number[][], p: number[]): [number, number] {
  const col = g.col, P: any = [p[0], EYE, p[2]]; let now = 0, geo = 0; const thru: number[][] = [];
  for (const q of far) if (crossesDoor(q as any, p as any, d)) thru.push(q);
  if (!thru.length) return [0, 0];
  for (const q of thru) if (!col.segmentBlocked([q[0], EYE, q[2]], P)) now++;
  const dyn = col.dynamicBoxes; col.dynamicBoxes = [];
  try { for (const q of thru) if (!col.segmentBlocked([q[0], EYE, q[2]], P)) geo++; } finally { col.dynamicBoxes = dyn; }
  return [now, geo];
}
export const LINE_CELL_M2 = CELL_M2, LINE_MIN_CELLS = MIN_CELLS;

interface Walk { gd: any; A: any; door: any; side: 1 | -1; t0: number; last: number[]; m: number; secs: number; now: number; nowM2s: number; geo: number; geoM2s: number; crossed: boolean; open: boolean; acc: number; cells: number }
interface Stack { key: string; door: any; order: string; t0: number; men: Set<any>; formed: number | null }

export class StackLineWatch {
  private walks = new Map<any, Walk>(); private stacks = new Map<string, Stack>(); private was = new Map<any, string>(); private far = new Map<string, number[][]>(); private lastA = new Map<any, { A: any; leaf0: LineDeath['leaf'] }>(); private done = new WeakSet<any>();
  private out_: StackLineOut = { walks: [], stacks: [], deaths: [] }; private lastT = -1;
  constructor(private g: any, private say: ((s: string) => void) | null = null) {
    const up = g.update; g.update = (...a: unknown[]) => { const r = up.apply(g, a); this.tick(); return r; };   // (after the game's own frame: a bystander)
  }
  private team(): any[] { return this.g.guards.filter((x: any) => !!x.unit && x.team === 'operative'); }
  private leaf(d: any): LineDeath['leaf'] { return d.off ? 'off' : d.latched || Math.abs(d.angle) < 0.08 ? 'shut' : Math.abs(d.angle) < 0.6 ? 'ajar' : 'open'; }
  private cellsOn(d: any, side: 1 | -1, p: number[]): [number, number] { const key = `${d.def.name}:${side}`; let L = this.far.get(key); if (!L) this.far.set(key, L = farFloor(this.g, d, side)); return cellsOnLine(this.g, d, L, p); }
  private close(w: Walk, end: WalkOut['end']) {
    this.walks.delete(w.gd);
    const o: WalkOut = { who: w.gd.callsign, door: w.door.def.name, order: w.A.order, t0: r1(w.t0), secs: r1(w.secs), m: r1(w.m), now: r1(w.now), nowM2s: r1(w.nowM2s), geo: r1(w.geo), geoM2s: r1(w.geoM2s), crossed: w.crossed, open: w.open, end };
    this.out_.walks.push(o);
    this.say?.(`   ⇢ ${o.who} to ${o.door} (${o.order}): ${o.secs} s, ${o.m} m · in its line ${o.now} s (${o.nowM2s} m²·s), leaves away ${o.geo} s (${o.geoM2s} m²·s)${o.crossed ? ' · crossed the opening' : ''}${o.open ? ' · leaf open' : ''} · ${end}`);
  }
  tick() {
    const g = this.g, t: number = g.time, O = g.orders; if (t === this.lastT) return; const dt = this.lastT < 0 ? 0 : t - this.lastT; this.lastT = t;
    for (const gd of this.team()) {
      const was = this.was.get(gd), dead = gd.state === 'dead'; this.was.set(gd, gd.state);
      const A = dead ? null : O.of(gd), up = !!A && !!A.post && !!A.door && A.shy === A.door;
      let w = this.walks.get(gd);
      if (dead && was !== undefined && was !== 'dead') {
        const L0 = this.lastA.get(gd), A0 = w ? w.A : L0?.A ?? null, d = w ? w.door : A0 && A0.door && A0.shy === A0.door ? A0.door : null;
        if (d && A0) { const p = gd.char.pos, side = w ? w.side : sideOf(d, A0.post), k = g.guards.find((x: any) => x.char.id === gd.killerId), F = frameOf(d), rx = p[0] - F.hx, rz = p[2] - F.hz;
          const X = k ? crossesDoor(k.char.pos, p, d) : null;
          this.out_.deaths.push({ t: r1(t), who: gd.callsign, by: k?.callsign ?? null, door: d.def.name, phase: w ? 'walk' : 'stacked', order: A0.order, leaf: this.leaf(d), leaf0: L0 && L0.A.door === d ? L0.leaf0 : this.leaf(d), beyond: !!k && sideOf(d, k.char.pos) !== side, through: !!X,
            cells: this.cellsOn(d, side, p)[0], depth: r2(Math.abs(rx * F.nx + rz * F.nz)), along: r2(rx * F.ux + rz * F.uz), toMark: r1(flat(p, A0.post)), at: [r1(p[0]), r1(p[2])], kAt: k ? [r1(k.char.pos[0]), r1(k.char.pos[2])] : null });
          const D = this.out_.deaths[this.out_.deaths.length - 1];
          this.say?.(`   ⇢ ${D.who} lost ${D.phase === 'walk' ? 'walking up to' : 'on his mark at'} ${D.door} (${D.order}) · leaf ${D.leaf}, ${D.leaf0} when the order took him · killer ${D.beyond ? 'beyond it' : 'on his own face'}${D.through ? ', through the opening' : ''} · ${D.cells} cells of their floor on him · ${D.depth} m off the frame, ${D.along} m along it, ${D.toMark} m short of his mark`); }
        if (w) this.close(w, 'dead');
        continue;
      }
      if (dead) continue;
      { const L0 = this.lastA.get(gd); if (!up) this.lastA.delete(gd); else if (!L0 || L0.A.order !== A.order || L0.A.door !== A.door) this.lastA.set(gd, { A, leaf0: this.leaf(A.door) }); else L0.A = A; }   // (the leaf WHEN THE ORDER TOOK HIM: kept while the order and the door are the same — the door tools hand a man a fresh assignment at every stage)
      if (w && (w.A !== A || !up)) { this.close(w, 'told'); w = undefined; }
      if (!w && up && !A.arrived && !this.done.has(A)) {
        const p = gd.char.pos; w = { gd, A, door: A.door, side: sideOf(A.door, A.post), t0: t, last: [p[0], 0, p[2]], m: 0, secs: 0, now: 0, nowM2s: 0, geo: 0, geoM2s: 0, crossed: false, open: false, acc: 0, cells: 0 };
        this.walks.set(gd, w);
        const key = `${A.door.def.name}:${A.group}`; let S = this.stacks.get(key); if (!S) this.stacks.set(key, S = { key, door: A.door, order: A.order, t0: t, men: new Set(), formed: null }); S.men.add(gd);
      }
      if (!w) continue;
      if (A.arrived) { this.done.add(A); this.close(w, 'on'); continue; }
      const p = gd.char.pos; w.secs += dt; w.m += flat(p, w.last); w.last = [p[0], 0, p[2]]; w.acc += dt;
      const lf = this.leaf(w.door); if (lf === 'open' || lf === 'off') w.open = true;
      const F = frameOf(w.door), rx = p[0] - F.hx, rz = p[2] - F.hz, al = rx * F.ux + rz * F.uz, dp = Math.abs(rx * F.nx + rz * F.nz); if (al > 0 && al < F.W && dp < CROSS_M) w.crossed = true;
      if (w.acc >= STEP) { const [now, geo] = this.cellsOn(w.door, w.side, p), s = w.acc; w.acc = 0;
        if (now >= MIN_CELLS) { w.now += s; w.nowM2s += now * CELL_M2 * s; } if (geo >= MIN_CELLS) { w.geo += s; w.geoM2s += geo * CELL_M2 * s; } }
    }
    for (const S of [...this.stacks.values()]) {
      const men = [...S.men].filter(m => m.state !== 'dead'), mine = men.filter(m => { const A = O.of(m); return !!A && A.door === S.door && `${S.door.def.name}:${A.group}` === S.key; });
      if (S.formed === null && mine.length && mine.length === men.length && mine.every(m => O.of(m).arrived)) S.formed = t - S.t0;
      if (!mine.length) { this.stacks.delete(S.key); this.out_.stacks.push({ door: S.door.def.name, order: S.order, t0: r1(S.t0), men: S.men.size, formed: S.formed === null ? null : r1(S.formed), end: S.formed === null ? 'told' : 'formed', secs: r1(t - S.t0) }); }
    }
  }
  out(): StackLineOut {
    for (const w of [...this.walks.values()]) this.close(w, 'run');
    for (const S of this.stacks.values()) this.out_.stacks.push({ door: S.door.def.name, order: S.order, t0: r1(S.t0), men: S.men.size, formed: S.formed === null ? null : r1(S.formed), end: S.formed === null ? 'run' : 'formed', secs: r1(this.g.time - S.t0) });
    this.stacks.clear();
    return this.out_;
  }
}
