// WHO CROWDS A DOORWAY — a bystander for tools/qa/playthrough.ts (always on, like its Tally and EndWatch: it reads, and writes nothing the game reads; the run's
// digest is the same with it). the maintainer, 10-08: "doors could use some work too … AI does a better job not crowding". Nobody had measured what he saw, so this
// counts it, for BOTH sides (the squad: team 'operative' units · the defenders: team 'hostile'), every frame, per door:
//   open2      seconds with two or more men of one side inside the OPENING at once (the frame's own strip: the leaf's span, ± OPEN_HALF either face) —
//              'one at a time' broken; `open2Max` the most at once
//   openStand  man-seconds STANDING in the opening (a man who has not moved STAND_M in STAND_SECS) · `block`: … while a man of his own side within BLOCK_M has
//              a path through this very door (he is in somebody's way) · `blockEvents`: such stands, counted once each
//   sweepStand man-seconds standing where the leaf swings (inside its arc between its stops, off the opening's strip)
//   openHeld / sweepHeld   the part of those two stood by a man put there and told to stay (pinned / hold, no script): a post, not a choice of his feet
//   sweepShut  the part of sweepStand at a leaf standing latched
//   contact    pair-seconds of two men of one side inside each other's bodies' push (guards.ts collideGuard: centres under 0.6 m — a SHOVE every frame it lasts)
//              with either of them within NEAR_M of the doorway's middle · `contactOpen`: … with one of the two IN the opening (pushed through, or pushing) ·
//              `shoves`: contacts counted once each
//   wait       seconds with two or more men of one side standing by the door on ONE face of it, off the opening (waiting at it: a stack, a queue) · `waitMin`:
//              their closest spacing, averaged over those seconds · `waitClose`: the seconds it was under CLOSE_M
//   near       man-seconds by a door at all (the box the waiting is looked for in) · `contactAll`: pair-seconds of contact ANYWHERE on the floor, doors or not ·
//              `cross`: walks through a frame — what to hold the rest against
// and `where`: the same seconds by door, and `doing`: by what the men were under (the squad: the door order's phase, else the order; the defenders: state,
// script or not) — the place to look. tools/qa/door-tally.ts makes the tables.
import { frameOf, crossesDoor } from '../../src/game/guards.ts';

const DT = 1 / 60, OPEN_HALF = 0.45, STAND_M = 0.2, STAND_SECS = 0.75, BLOCK_M = 2.5, NEAR_M = 2.5, NEAR_ALONG = 2.0, NEAR_PERP = 3.0, CLOSE_M = 0.75, TOUCH_M = 0.6;
export interface DoorSide { open2: number; open2Max: number; openStand: number; block: number; blockEvents: number; sweepStand: number; contact: number; contactOpen: number; shoves: number; wait: number; waitMinSum: number; waitClose: number; cross: number; near: number; contactAll: number; openHeld: number; sweepHeld: number; sweepShut: number }
const zero = (): DoorSide => ({ open2: 0, open2Max: 0, openStand: 0, block: 0, blockEvents: 0, sweepStand: 0, contact: 0, contactOpen: 0, shoves: 0, wait: 0, waitMinSum: 0, waitClose: 0, cross: 0, near: 0, contactAll: 0, openHeld: 0, sweepHeld: 0, sweepShut: 0 });
type Side = 'team' | 'theirs';
interface Geo { d: any; F: ReturnType<typeof frameOf>; minA: number; maxA: number }
interface Man { anchor: [number, number]; since: number; was: [number, number]; blocking: any }

export class DoorWatch {
  sides: Record<Side, DoorSide> = { team: zero(), theirs: zero() };
  where: Record<string, Record<string, number>> = {}; doing: Record<string, Record<string, number>> = {};
  /** the worst moments, for a trace: [t, side, door, what] (capped) */
  rows: [number, Side, string, string][] = [];
  private geo: Geo[]; private men = new Map<any, Man>(); private touching = new Set<string>(); private lastRow = new Map<string, number>();
  constructor(private g: any, private say: ((s: string) => void) | null = null) {
    this.geo = g.doors.list.map((d: any) => ({ d, F: frameOf(d), minA: d.minA ?? -1.92, maxA: d.maxA ?? 1.92 }));
  }
  private bump(tab: Record<string, Record<string, number>>, key: string, col: string, v: number) { const r = tab[key] ??= {}; r[col] = (r[col] ?? 0) + v; }
  private doingOf(m: any): string {
    const g = this.g;
    if (m.team === 'operative') { const op = g.doorTools?.ops?.find((o: any) => o.men.includes(m)); if (op) return `op:${op.kind}:${op.phase}`; const A = g.orders?.of?.(m); if (A) return `order:${A.order}${A.arrived ? '*' : ''}`; return m.script ? 'scripted' : String(m.state); }
    return `${m.state}${m.script ? ':scripted' : ''}${!m.script && (m.pinned || m.hold) ? ':held' : ''}`;
  }
  private note(t: number, side: Side, door: string, what: string) { const k = `${side}|${door}|${what.split(' ')[0]}`; if (t - (this.lastRow.get(k) ?? -100) < 3) return; this.lastRow.set(k, t); if (this.rows.length < 200) this.rows.push([+t.toFixed(1), side, door, what]); this.say?.(`   ▯ door · ${side} · ${door} · ${what}`); }
  tick(t: number) {
    const g = this.g, all = (g.guards as any[]).filter(m => m.state !== 'dead' && (m.team === 'hostile' || (m.team === 'operative' && m.unit)));
    // who is standing (per man: an anchor he has not left by STAND_M for STAND_SECS)
    for (const m of all) { const p = m.char.pos; let M = this.men.get(m); if (!M) this.men.set(m, M = { anchor: [p[0], p[2]], since: t, was: [p[0], p[2]], blocking: null });
      if (Math.hypot(p[0] - M.anchor[0], p[2] - M.anchor[1]) > STAND_M) { M.anchor = [p[0], p[2]]; M.since = t; } }
    const standing = (m: any) => t - this.men.get(m)!.since >= STAND_SECS;
    const touchNow = new Set<string>();
    for (const side of ['team', 'theirs'] as Side[]) {
      const S = this.sides[side], men = all.filter(m => (m.team === 'operative') === (side === 'team')); if (!men.length) continue;
      for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) if (Math.hypot(men[i].char.pos[0] - men[j].char.pos[0], men[i].char.pos[2] - men[j].char.pos[2]) < TOUCH_M) S.contactAll += DT;
      const nearAny = new Set<any>();
      for (const G of this.geo) { const F = G.F, name = G.d.def.name as string, cx = F.hx + F.ux * F.W / 2, cz = F.hz + F.uz * F.W / 2;
        const here: { m: any; along: number; perp: number; open: boolean; sweep: boolean; near: boolean }[] = [];
        for (const m of men) { const p = m.char.pos, rx = p[0] - F.hx, rz = p[2] - F.hz; if (Math.abs(rx) > 6 || Math.abs(rz) > 6) continue;
          const along = rx * F.ux + rz * F.uz, perp = rx * F.nx + rz * F.nz;
          const open = along >= -0.05 && along <= F.W + 0.05 && Math.abs(perp) <= OPEN_HALF;
          const a = Math.atan2(perp, along), sweep = !open && Math.hypot(rx, rz) <= F.W + 0.2 && a >= G.minA && a <= G.maxA && Math.abs(a) > 0.05;
          const near = Math.abs(along - F.W / 2) <= NEAR_ALONG && Math.abs(perp) <= NEAR_PERP;
          if (open || sweep || near) { here.push({ m, along, perp, open, sweep, near }); nearAny.add(m); } }
        if (!here.length) continue;
        // through it (a crossing of the frame line, either way)
        for (const h of here) { const M = this.men.get(h.m)!, p = h.m.char.pos; if (Math.hypot(p[0] - M.was[0], p[2] - M.was[1]) < 1.5 && crossesDoor([M.was[0], 0, M.was[1]] as any, p, G.d)) S.cross++; }
        // one at a time
        const inOpen = here.filter(h => h.open);
        if (inOpen.length >= 2) { S.open2 += DT; S.open2Max = Math.max(S.open2Max, inOpen.length); this.bump(this.where, `${side}|${name}`, 'open2', DT); for (const h of inOpen) this.bump(this.doing, `${side}|${this.doingOf(h.m)}`, 'open2', DT / inOpen.length); this.note(t, side, name, `open2 ${inOpen.map(h => `${h.m.callsign} (${this.doingOf(h.m)})`).join(' + ')}`); }
        // standing in the opening / in the leaf's swing — and in whose way
        for (const h of here) { if (!(h.open || h.sweep) || !standing(h.m)) { if (this.men.get(h.m)!.blocking === G.d) this.men.get(h.m)!.blocking = null; continue; }
          const col = h.open ? 'openStand' : 'sweepStand'; S[col] += DT; if (!h.m.script && (h.m.pinned || h.m.hold)) S[h.open ? 'openHeld' : 'sweepHeld'] += DT; if (!h.open && G.d.latched) S.sweepShut += DT; this.note(t, side, name, `${col} ${h.m.callsign} (${this.doingOf(h.m)}) at ${h.m.char.pos[0].toFixed(1)},${h.m.char.pos[2].toFixed(1)} leaf ${G.d.angle.toFixed(2)}${G.d.latched ? ' shut' : ''}`); this.bump(this.where, `${side}|${name}`, col, DT); this.bump(this.doing, `${side}|${this.doingOf(h.m)}`, col, DT);
          if (!h.open) continue;
          const p = h.m.char.pos, wants = men.find(o => o !== h.m && Math.hypot(o.char.pos[0] - p[0], o.char.pos[2] - p[2]) <= BLOCK_M && this.pathThrough(o, G.d));
          const M = this.men.get(h.m)!;
          if (wants) { S.block += DT; this.bump(this.where, `${side}|${name}`, 'block', DT); this.bump(this.doing, `${side}|${this.doingOf(h.m)}`, 'block', DT);
            if (M.blocking !== G.d) { M.blocking = G.d; S.blockEvents++; this.note(t, side, name, `block ${h.m.callsign} (${this.doingOf(h.m)}) stands in the opening, ${wants.callsign} (${this.doingOf(wants)}) wants through`); } }
          else if (M.blocking === G.d) M.blocking = null; }
        // bodies in contact by the door
        for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) { const a = here[i], b = here[j], pa = a.m.char.pos, pb = b.m.char.pos;
          if (Math.hypot(pa[0] - pb[0], pa[2] - pb[2]) >= TOUCH_M) continue;
          if (Math.hypot(pa[0] - cx, pa[2] - cz) > NEAR_M && Math.hypot(pb[0] - cx, pb[2] - cz) > NEAR_M) continue;
          this.bump(this.where, `${side}|${name}`, 'contact', DT); if (a.open || b.open) { S.contactOpen += DT; this.bump(this.where, `${side}|${name}`, 'contactOpen', DT); }
          const key = `${a.m.char.id}|${b.m.char.id}`; if (touchNow.has(key)) continue; touchNow.add(key);   // (a pair by two doors at once is one pair)
          S.contact += DT; this.bump(this.doing, `${side}|${this.doingOf(a.m)}`, 'contact', DT / 2); this.bump(this.doing, `${side}|${this.doingOf(b.m)}`, 'contact', DT / 2);
          if (!this.touching.has(key)) { S.shoves++; this.note(t, side, name, `shove ${a.m.callsign} (${this.doingOf(a.m)}) × ${b.m.callsign} (${this.doingOf(b.m)})${a.open || b.open ? ' in the opening' : ''}`); } }
        // waiting at it: two or more standing on one face, off the opening
        for (const face of [1, -1]) { const w = here.filter(h => h.near && !h.open && (h.perp >= 0 ? 1 : -1) === face && standing(h.m)); if (w.length < 2) continue;
          let min = 1e9; for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) min = Math.min(min, Math.hypot(w[i].m.char.pos[0] - w[j].m.char.pos[0], w[i].m.char.pos[2] - w[j].m.char.pos[2]));
          S.wait += DT; S.waitMinSum += min * DT; if (min < CLOSE_M) { S.waitClose += DT; this.bump(this.where, `${side}|${name}`, 'waitClose', DT); for (const h of w) this.bump(this.doing, `${side}|${this.doingOf(h.m)}`, 'waitClose', DT / w.length); } }
      }
      S.near += nearAny.size * DT;
    }
    this.touching = touchNow;
    for (const m of all) { const M = this.men.get(m)!; M.was = [m.char.pos[0], m.char.pos[2]]; }
  }
  /** does his path (from where he stands) run through this door's frame */
  private pathThrough(m: any, d: any): boolean { const path = m.path as number[][] | undefined; if (!path || !(m.pathI < path.length)) return false; let prev = m.char.pos; for (let i = m.pathI; i < path.length; i++) { if (crossesDoor(prev, path[i] as any, d)) return true; prev = path[i]; } return false; }
  close() {
    const r = (S: DoorSide) => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, +(+v).toFixed(2)])) as unknown as DoorSide;
    const rt = (T: Record<string, Record<string, number>>) => Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([c, x]) => [c, +x.toFixed(2)]))]));
    return { team: r(this.sides.team), theirs: r(this.sides.theirs), where: rt(this.where), doing: rt(this.doing), rows: this.rows };
  }
}
