// WHERE THE AI OPENS A DOOR FROM — a bystander for tools/qa/playthrough.ts (always on, like its Tally and EndWatch: it reads, and writes nothing the game reads;
// the run's digest is the same with it). the maintainer, 10-08: "doors could use some work too … open has to be on the handle side for AI". This logs every door a
// man of the AI opens — a teammate, a defender, the night's staff, a civilian — with where he stood as it began to move:
//   an OPENING = a leaf that stood shut (latched, or to within SHUT_RAD and still) is unlatched and moving or ajar; the OPENER = Door.lastWho (the hand the
//   door itself names: the contact that pushed or pulled it, or the id a module's own shove wrote). The player's openings (and a charge's, which the door
//   tools file under him) are counted and left out; a leaf nobody alive is named for is 'nobody'.
//   how      push · pull (it came toward him: Door.pullT) · shove (a module's keyed shove, DOORTOOLS.shove and its kin) · bash (run into) · kick (the boot: the
//            keep torn out, or a leaf flung at a kick's speed) — a KICK is not judged: it is taken from where the kick stands, by the lock
//   face     pull = the face it opens into (Doors.pullFace) · push = the other
//   along    metres from the hinge jamb down the closed leaf's line (W = the handle jamb; the handle itself is 0.14 short of it) · off = metres off the wall
//   reach    metres from his middle to the handle, on the floor
//   sweep    he stood where the leaf swings (Doors.swingOf(d).sweeps, with his body's radius) — on the pull face that is the leaf coming round through him
//   ok       AT THE HANDLE JAMB: in the handle half of the frame (along ≥ W/2) AND within REACH of the handle AND, on the pull face, out of the sweep
// and why not: 'hinge' (in the hinge half) · 'far' (out of reach) · 'sweep'. tools/qa/handle-tally.ts makes the tables.
import { frameOf } from '../../src/game/guards.ts';
import { PLAYER_ID } from '../../src/game/consts.ts';
import { DOORWAY } from '../../src/game/doors.ts';

export const HANDLE_REACH = 1.0, BODY_R = 0.34, HANDLE_IN = 0.14;
const SHUT_RAD = 0.2, STILL = 0.3, MOVING = 0.5;
export interface HandleRow { t: number; door: string; who: string; side: 'team' | 'theirs' | 'staff' | 'civilian'; doing: string; how: 'push' | 'pull' | 'shove' | 'bash' | 'kick'; face: 'pull' | 'push'; along: number; W: number; off: number; reach: number; sweep: boolean; ok: boolean; why: string }
export interface HandleOut { opens: number; player: number; nobody: number; judged: number; ok: number; kicks: number; passThrough: number; rows: HandleRow[]; stats?: Record<string, number> }

export class HandleWatch {
  rows: HandleRow[] = []; player = 0; nobody = 0;
  /** frames a leaf being pulled open (Door.pullT) had a living man of the AI inside it — the pass-through the one-way part left for the opener's spot to end:
   *  counted once per man per pull, with whether he was the opener */
  passThrough = 0; passRows: { t: number; door: string; who: string; opener: boolean }[] = [];
  private shut = new Map<any, boolean>(); private broken = new Map<any, boolean>(); private passing = new Set<string>();
  constructor(private g: any, private say: ((s: string) => void) | null = null) { for (const d of g.doors.list) { this.shut.set(d, this.isShut(d)); this.broken.set(d, !!d.lockBroken); } }
  private isShut(d: any): boolean { return d.latched || (Math.abs(d.angle) < SHUT_RAD && Math.abs(d.vel) < STILL); }
  private doingOf(m: any): string {
    const g = this.g;
    if (m.team === 'operative') { const op = g.doorTools?.ops?.find((o: any) => o.men.includes(m)); if (op) return `op:${op.kind}:${op.phase}${op.lead === m ? ':lead' : ''}`; const A = g.orders?.of?.(m); if (A) return `order:${A.order}${A.arrived ? '*' : ''}`; return m.script ? 'scripted' : String(m.state); }
    return `${m.state}${m.script ? ':scripted' : ''}${m.unit ? ':unit' : ''}`;
  }
  tick(t: number) {
    const g = this.g, all = [...(g.guards as any[]), ...((g.civilians ?? []) as any[])];
    for (const d of g.doors.list as any[]) {
      const was = this.shut.get(d)!, now = this.isShut(d), brokeNow = !!d.lockBroken && !this.broken.get(d); this.shut.set(d, now); this.broken.set(d, !!d.lockBroken);
      // the leaf coming round through a man (one-way: Door.passers while it is being pulled)
      if (d.pullT > 0 && d.passers) for (const m of all) { if (m.state === 'dead' || m.char.id < 0 || m.char.id >= 32 || !(d.passers & (1 << m.char.id))) continue;
        const k = `${d.def.name}|${m.char.id}`; if (this.passing.has(k)) continue; this.passing.add(k); this.passThrough++; const opener = d.lastWho === m.char.id;
        if (this.passRows.length < 200) this.passRows.push({ t: +t.toFixed(1), door: d.def.name, who: m.callsign, opener }); this.say?.(`   ▯ handle · ${d.def.name} comes round THROUGH ${m.callsign}${opener ? ' (its opener)' : ''}`); }
      if (!(d.pullT > 0)) for (const k of [...this.passing]) if (k.startsWith(d.def.name + '|')) this.passing.delete(k);
      if (!was || now || d.latched) continue;
      if (!((DOORWAY.oneWay ? d.vel * d.swing : Math.abs(d.vel)) >= MOVING || Math.abs(d.angle) >= SHUT_RAD)) continue;   // (… moving OPEN: a leaf standing a hair ajar that is pushed to is not an opening)
      if (d.lastWho === PLAYER_ID) { this.player++; continue; }
      const m = all.find(x => x.char.id === d.lastWho && x.state !== 'dead'); if (!m) { this.nobody++; continue; }
      const F = frameOf(d), p = m.char.pos, rx = p[0] - F.hx, rz = p[2] - F.hz, along = rx * F.ux + rz * F.uz, perp = rx * F.nx + rz * F.nz, W = F.W;
      const S = g.doors.swingOf(d), pull = g.doors.pullFace(d, p), reach = Math.hypot(along - (W - HANDLE_IN), perp), sweep = S.sweeps(p[0], p[2], BODY_R);
      const v = Math.abs(d.vel), how: HandleRow['how'] = brokeNow || v >= 8.5 ? 'kick' : d.sinceBash < 0.05 && v >= 7 ? 'bash' : d.pullT > 0 ? 'pull' : v >= 4.5 ? 'shove' : 'push';
      const why = how === 'kick' ? '' : along < W / 2 ? 'hinge' : reach > HANDLE_REACH ? 'far' : pull && sweep ? 'sweep' : '';
      const row: HandleRow = { t: +t.toFixed(1), door: d.def.name, who: m.callsign, side: m.team === 'operative' ? 'team' : m.team === 'hostile' ? 'theirs' : m.team === 'civilian' ? 'civilian' : 'staff', doing: this.doingOf(m), how, face: pull ? 'pull' : 'push',
        along: +along.toFixed(2), W: +W.toFixed(2), off: +Math.abs(perp).toFixed(2), reach: +reach.toFixed(2), sweep, ok: how !== 'kick' && !why, why };
      this.rows.push(row);
      this.say?.(`   ▯ handle · ${row.door} ${row.how} from its ${row.face} face by ${row.who} (${row.side}, ${row.doing}) · ${row.along} of ${row.W} m from the hinge, ${row.off} m off, ${row.reach} m to the handle${row.sweep ? ', in the sweep' : ''} · ${row.how === 'kick' ? 'a kick' : row.ok ? 'at the handle' : `NOT at the handle (${row.why})`}`);
    }
  }
  close(): HandleOut { const j = this.rows.filter(r => r.how !== 'kick');
    return { opens: this.rows.length + this.player + this.nobody, player: this.player, nobody: this.nobody, judged: j.length, ok: j.filter(r => r.ok).length, kicks: this.rows.length - j.length, passThrough: this.passThrough, rows: this.rows, ...(this.passRows.length ? { pass: this.passRows } : {}) } as HandleOut; }
}
