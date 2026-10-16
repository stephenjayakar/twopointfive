// THROUGH A FRIEND, A JAMB OR A DOOR LEAF — a bystander for tools/qa/playthrough.ts (PT_PATHS=1), like its Tally and ways-watch.ts: it reads, and writes
// nothing the game reads (PT_DIGEST agrees with it on and off). The cast goal's night clip caught a man of a room entry standing through an open door leaf
// (rebuild/cast-faces-and-moves/clips/finding-door-leaf-22.5s.jpg); this counts that, and its two cousins, on every frame of every ROOM ENTRY of a run.
//
// AN ENTRY FRAME, for a man: he is a man of a door order (doortools.ts DoorOp) whose leaf has been opened (openT set), until the order ends — and `PATHS.after`
// seconds past its end (the walk onto his point). A man the fight has (alert, no script) is still counted: where he stands is where he is drawn.
//   leaf     his centre within `PATHS.leaf` of a door leaf's centre line (his trunk is in it — the contact model keeps a man 0.365 m off a leaf it can move
//            or that can move him), or the leaf's line swept across his centre inside its span between two frames ('swept': it went through him)
//   friend   his centre within `PATHS.friend` of another living teammate's or Sam's: two trunks in one place whichever way they face (the colleagues' shove
//            starts at 0.6 m and settles a pair somewhere under it)
//   near     two living teammates' centres within `PATHS.near` of each other for longer than `PATHS.nearSecs`: two bodies drawn on one spot. Each pair once, under the first man's name; a brush shorter than that is nothing. A LIVING defender that near counts
//            the same
//   body     the same against a defender who is DOWN (where he fell: the cast goal's still of 'two men merged' at 23.3 s is a teammate walking onto the
//            man he has just shot). Counted and listed, a count of its own: stepping round the fallen is nobody's rule yet
//   jamb     a circle of `PATHS.jamb` round his centre is inside a static between shin and shoulder (the frame, a wall, furniture)
//   rifle    his body is clear of the leaf, but the line from his chest to his long gun's muzzle crosses it inside its span and the muzzle stands more than
//            `PATHS.poke` beyond its line: the barrel (or the arms that hold it) is drawn through the door
//   light    the same for the weapon light's lens while it burns (it rides the gun a hand short of the muzzle): the beam starts on the leaf's far side
// A SPELL is a run of such frames by one man against one thing (a gap under 0.25 s does not end it); the run's numbers are spells, frames and the worst depth.
// ORDER AND SPACING: every crossing of the ordered door's frame line by a man of its order — the second he crossed, the gap to the man before him (seconds, and
// the metres between them as he crossed), his `turn` in the order dealt (the order's own queue as the entry dealt it, kept here from the frame it is
// first seen; -1 = it was never read for him) and two readings of "out of turn":
//   jumped   a man DEALT AHEAD OF HIM is still on the stack's side of the frame line (a lead held at the frame whom the walk lets the next man past
//            reads here too: the run's late / taken counts say when that is the cause)
//   far      a man who stood half a metre nearer the frame at the go is still outside — 'own' when that man stood at his own jamb (his file's back man
//            was dealt before its front man), 'other' when he stood at the other jamb (from a stack split unevenly round a door the two sides go in
//            turn about and the deal itself sends the far side's man second: the deal's order, listed by doorpath-file and not failed)
// `rec` (PT_PATHS=rec): every man's place, every leaf's angle, at 20 Hz over each entry — what tools/qa/entry-strip.ts draws.
import { frameOf } from '../../src/game/guards.ts';

export const PATHS = { leaf: 0.2, friend: 0.3, near: 0.45, nearSecs: 0.3, jamb: 0.2, poke: 0.04, after: 3, gap: 0.25 };
export type PathKind = 'leaf' | 'friend' | 'near' | 'body' | 'jamb' | 'rifle' | 'light';
export interface PathSpell { kind: PathKind; who: string; what: string; t0: number; t1: number; frames: number; worst: number; swept: boolean; door: string; phase: string;
  /** how far the man walked while it lasted, m (a gun through a leaf: was he on his way past it, or standing by it?) */ moved?: number }
export interface CrossRow { t: number; door: string; who: string; n: number; gapS: number | null; gapM: number | null; turn: number; jumped: boolean; far: 'own' | 'other' | null }
export interface RecFrame { t: number; men: { who: string; x: number; z: number; yaw: number; up: boolean; mz?: [number, number]; low?: boolean; ov?: boolean; ai?: boolean }[]; sam: [number, number]; foes: [number, number, boolean][]; doors: [string, number][]; door: string; phase: string }
export interface PathsOut { entries: number; frames: number; spells: PathSpell[]; leaf: number; friend: number; jamb: number; swept: number; leafFrames: number; friendFrames: number; jambFrames: number; rifle: number; light: number; rifleFrames: number; lightFrames: number; near: number; nearFrames: number; body: number; bodyFrames: number; cross: CrossRow[]; jumped: number; close: number; rec?: RecFrame[];
  /** with `rec`: every door (hinge, closed direction, width) and every static that stands between shin and shoulder — [cx, cz, hx, hz, yaw, top] */
  meta?: { doors: Record<string, { hinge: [number, number]; dir: number; w: number }>; boxes: number[][] } }

const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** a man's centre against a leaf as it stands: how far along it (m from the hinge), which face (signed metres off its line), the distance to its segment */
function leafGeom(d: any, p: number[]) { const [hx, hz] = d.def.hinge, u = d.dir(), W = d.def.width, px = p[0] - hx, pz = p[2] - hz, along = px * u[0] + pz * u[1], perp = u[0] * pz - u[1] * px, t = Math.max(0, Math.min(W, along)); return { along, perp, dist: Math.hypot(px - u[0] * t, pz - u[1] * t), W }; }

export class PathsWatch {
  private open = new Map<string, PathSpell>(); private spells: PathSpell[] = []; private frames = 0; private ops = new Set<any>();
  /** per man: the op he was last a man of and when it was last seen (the tail after its end) · his side of each leaf last frame */
  private last = new Map<any, { op: any; t: number; door: any; phase: string }>(); private side = new Map<any, Map<any, { perp: number; along: number }>>();
  private cross: CrossRow[] = []; private crossed = new Map<any, { n: number; t: number; who: any }>(); private offAtGo = new Map<any, Map<any, [off: number, jamb: number]>>(); private was = new Map<any, number[]>();
  /** per order: its men in the order dealt — its queue on the frame it is first seen (the entry deals it once and only takes men off its head) */
  private dealt = new Map<any, any[]>();
  rec: RecFrame[] | null; private n = 0; private at = new WeakMap<PathSpell, [number, number]>(); private nears = new Map<string, PathSpell>();
  constructor(private g: any, private say: (s: string) => void, rec = false) { this.rec = rec ? [] : null; }
  private hit(t: number, kind: PathKind, m: any, what: string, depth: number, swept: boolean, door: string, phase: string) {
    const key = `${kind}|${m.callsign}|${what}`; let S = this.open.get(key);
    if (S && t - S.t1 > PATHS.gap) { this.open.delete(key); S = undefined; }
    if (!S) { S = { kind, who: m.callsign, what, t0: +t.toFixed(2), t1: t, frames: 0, worst: depth, swept: false, door, phase }; this.open.set(key, S); this.spells.push(S);
      this.say(`   >> path · ${m.callsign} ${kind === 'leaf' ? `in the leaf of ${what}` : kind === 'rifle' ? `rifle through the leaf of ${what}` : kind === 'light' ? `weapon light through the leaf of ${what}` : kind === 'friend' ? `through ${what}` : `in a static (${what})`} · ${door} (${phase})`); }
    { const q = m.char.pos, o = this.at.get(S); if (o) S.moved = +((S.moved ?? 0) + Math.hypot(q[0] - o[0], q[2] - o[1])).toFixed(3); else S.moved = 0; this.at.set(S, [q[0], q[2]]); }
    S.t1 = t; S.frames++; S.worst = Math.max(S.worst, depth); if (swept && !S.swept) { S.swept = true; this.say(`   >> path · the leaf of ${what} swept through ${m.callsign}`); }
  }
  /** two teammates on one spot: a spell of its own, filed (and said) only once it has lasted longer than `nearSecs` */
  private nearHit(t: number, m: any, o: any, dd: number, door: string, phase: string, kind: 'near' | 'body' = 'near') {
    const other = o.callsign ?? `defender ${o.char.id}`, key = `${kind}|${m.callsign}+${other}`, need = Math.round(PATHS.nearSecs * 60); let S = this.nears.get(key);
    if (S && t - S.t1 > PATHS.gap) { this.nears.delete(key); S = undefined; }
    if (!S) { S = { kind, who: m.callsign, what: other, t0: +t.toFixed(2), t1: t, frames: 0, worst: 0, swept: false, door, phase }; this.nears.set(key, S); }
    S.t1 = t; S.frames++; S.worst = Math.max(S.worst, PATHS.near - dd);
    if (S.frames === need + 1) { this.spells.push(S); this.say(`   >> path · ${m.callsign} ${kind === 'body' ? 'stands on the fallen' : 'and'} ${other} ${kind === 'body' ? '' : 'on one spot '}(${dd.toFixed(2)} m apart for over ${PATHS.nearSecs} s) · ${door} (${phase})`); }
  }
  tick(t: number, team: any[]) {
    const g = this.g, D = g.doorTools, sam = g.player.char;
    for (const op of D.ops as any[]) { if (Number.isNaN(op.openT)) continue; if (!this.ops.has(op)) this.ops.add(op);
      for (const m of op.men) this.last.set(m, { op, t, door: op.door, phase: op.phase });
      if (!this.offAtGo.has(op) && (op.phase === 'enter' || op.queue?.length)) { const M = new Map<any, [number, number]>(), F = frameOf(op.door);
        for (const m of op.men) { const al = (m.char.pos[0] - F.hx) * F.ux + (m.char.pos[2] - F.hz) * F.uz - F.W / 2; M.set(m, [flat(m.char.pos, op.door.frameCentre), Math.abs(al) < 0.3 ? 0 : Math.sign(al)]); }   // (which jamb he stood at: 0 = square in front of the opening)
        this.offAtGo.set(op, M); }
      if (!this.dealt.has(op) && op.queue?.length) this.dealt.set(op, op.queue.map((q: any) => q.gd)); }
    let any: { door: any; phase: string } | null = null;
    for (const m of team) {
      const p = m.char.pos, L = this.last.get(m), was = this.was.get(m); this.was.set(m, [p[0], 0, p[2]]);
      if (m.state === 'dead' || !L || t - L.t > PATHS.after) { this.side.delete(m); continue; }
      const door = L.door.def.name, phase = t - L.t > 1e-6 ? 'after' : L.phase; any ??= { door: L.door, phase }; this.frames++;
      // the frame line of his order's door: order and spacing
      if (was && this.crossed.get(m)?.who !== L.op) { const F = frameOf(L.door), da = (was[0] - F.hx) * F.nx + (was[2] - F.hz) * F.nz, db = (p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz, al = (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz;
        if (da * L.op.side > 0 && db * L.op.side <= 0 && al > -0.3 && al < F.W + 0.3) { const prev = [...this.crossed.entries()].filter(([, c]) => c.who === L.op).sort((a, b) => b[1].t - a[1].t)[0];
          const n = [...this.crossed.values()].filter(c => c.who === L.op).length + 1, off = this.offAtGo.get(L.op);
          const out = (o: any) => o !== m && o.state !== 'dead' && L.op.men.includes(o) && this.crossed.get(o)?.who !== L.op && ((o.char.pos[0] - F.hx) * F.nx + (o.char.pos[2] - F.hz) * F.nz) * L.op.side > 0;   // (still on the stack's side of the line)
          const mine = off?.get(m), near = off && mine ? [...off].filter(([o, [d]]) => out(o) && d < mine[0] - 0.5) : [];   // (men who stood half a metre nearer the frame at the go and are still outside)
          const far = !near.length ? null : near.some(([, [, jamb]]) => jamb * mine![1] >= 0) ? 'own' : 'other';
          const order = this.dealt.get(L.op) ?? [], turn = order.indexOf(m), jumped = order.slice(0, Math.max(0, turn)).some(out);
          this.crossed.set(m, { n, t, who: L.op });
          this.cross.push({ t: +t.toFixed(2), door, who: m.callsign, n, gapS: prev ? +(t - prev[1].t).toFixed(2) : null, gapM: prev && prev[0].state !== 'dead' ? +flat(p, prev[0].char.pos).toFixed(2) : null, turn, jumped, far }); } }
      // leaves (every door's: the next room's leaf stands in his way as well as his own)
      let S = this.side.get(m); if (!S) { S = new Map(); this.side.set(m, S); }
      for (const d of g.doors.list) { if ((d as any).off === true) { S.delete(d); continue; }   // (a door blown off its hinges, in a build with that rule: no leaf in the frame to be in — doorpath.ts `gone`)
        const G = leafGeom(d, p); if (G.along < -0.6 || G.along > G.W + 0.6 || Math.abs(G.perp) > 1) { S.delete(d); continue; }
        const b = S.get(d); S.set(d, { perp: G.perp, along: G.along });
        const swept = !!b && b.perp * G.perp < 0 && Math.min(b.along, G.along) > 0.1 && Math.max(b.along, G.along) < G.W - 0.02 && Math.abs(b.perp) + Math.abs(G.perp) < 0.5;
        if (G.dist < PATHS.leaf || swept) { this.hit(t, 'leaf', m, d.def.name, PATHS.leaf - G.dist, swept, door, phase); continue; }
        // his gun and its light: the body is clear — is the thing in his hands on the leaf's far side?
        const c = m.char, through = (q: number[] | undefined) => { if (!q) return 0; const Q = leafGeom(d, q); if (Q.perp * G.perp >= 0 || Math.abs(Q.perp) < PATHS.poke) return 0;
          const k = Math.abs(G.perp) / (Math.abs(G.perp) + Math.abs(Q.perp)), at = G.along + (Q.along - G.along) * k; return at > 0 && at < G.W ? Math.abs(Q.perp) : 0; };
        if (c.anim?.longGun && c.bones?.handR) { const r = through(c.muzzle); if (r) this.hit(t, 'rifle', m, d.def.name, r, false, door, phase); }
        if (m.flashlight?.enabled && c.bones?.handR) { const r = through(m.flashlight.pos); if (r) this.hit(t, 'light', m, d.def.name, r, false, door, phase); } }
      // friends
      for (const o of [...team, null]) { const c = o ? o.char : sam; if (o === m || (o && o.state === 'dead') || (!o && g.player.down)) continue; const dd = flat(p, c.pos);
        if (dd < PATHS.friend) this.hit(t, 'friend', m, o ? o.callsign : 'Sam', PATHS.friend - dd, false, door, phase);
        if (o && dd < PATHS.near && m.callsign < o.callsign) this.nearHit(t, m, o, dd, door, phase); }
      for (const h of g.guards as any[]) { if (h.team !== 'hostile') continue; const dd = flat(p, h.char.pos); if (dd < PATHS.near) this.nearHit(t, m, h, dd, door, phase, h.state === 'dead' ? 'body' : 'near'); }
      // statics
      { const q: [number, number, number] = [p[0], p[1], p[2]]; if (g.col.collideCircle(q, PATHS.jamb, 0.2, 1.5, 3)) { const moved = Math.hypot(q[0] - p[0], q[2] - p[2]); if (moved > 0.01) this.hit(t, 'jamb', m, `${p[0].toFixed(1)},${p[2].toFixed(1)}`, moved, false, door, phase); } }
    }
    if (this.rec && any && this.n++ % 3 === 0) this.rec.push({ t: +t.toFixed(2), men: team.map(m => ({ who: m.callsign, x: +m.char.pos[0].toFixed(3), z: +m.char.pos[2].toFixed(3), yaw: +m.char.aimYaw.toFixed(2), up: m.state !== 'dead', ...(m.char.muzzle ? { mz: [+m.char.muzzle[0].toFixed(3), +m.char.muzzle[2].toFixed(3)] as [number, number] } : {}), ...(m.muzzleDown ? { low: true } : {}), ...(m.script?.over ? { ov: true } : {}), ...(m.script ? {} : { ai: true }) })), sam: [+sam.pos[0].toFixed(2), +sam.pos[2].toFixed(2)],
      foes: g.guards.filter((x: any) => x.team === 'hostile').map((x: any) => [+x.char.pos[0].toFixed(2), +x.char.pos[2].toFixed(2), x.state !== 'dead'] as [number, number, boolean]), doors: g.doors.list.map((d: any) => [d.def.name, +d.angle.toFixed(3)] as [string, number]), door: any.door.def.name, phase: any.phase });
  }
  private meta() { const g = this.g, doors: Record<string, { hinge: [number, number]; dir: number; w: number }> = {}; for (const d of g.doors.list) doors[d.def.name] = { hinge: [d.def.hinge[0], d.def.hinge[1]], dir: d.def.closedDir, w: d.def.width };
    const r = (n: number) => +n.toFixed(3), boxes: number[][] = [];
    for (const b of g.engine.world.statics as any[]) { if (b.flags & 2 /* NoShadow: nothing a man meets */ || b.c[1] - b.h[1] > 1.4 || b.c[1] + b.h[1] < 0.35 || b.rot) continue; boxes.push([r(b.c[0]), r(b.c[2]), r(b.h[0]), r(b.h[2]), r(b.yaw), r(b.c[1] + b.h[1])]); }
    return { doors, boxes }; }
  close(): PathsOut {
    const S = this.spells.map(s => ({ ...s, t1: +s.t1.toFixed(2), worst: +s.worst.toFixed(3) })), of = (k: PathKind) => S.filter(s => s.kind === k), fr = (k: PathKind) => of(k).reduce((a, s) => a + s.frames, 0);
    return { entries: this.ops.size, frames: this.frames, spells: S, leaf: of('leaf').length, friend: of('friend').length, jamb: of('jamb').length, swept: S.filter(s => s.swept).length, leafFrames: fr('leaf'), friendFrames: fr('friend'), jambFrames: fr('jamb'), rifle: of('rifle').length, light: of('light').length, rifleFrames: fr('rifle'), lightFrames: fr('light'), near: of('near').length, nearFrames: fr('near'), body: of('body').length, bodyFrames: fr('body'),
      cross: this.cross, jumped: this.cross.filter(c => c.jumped).length, close: this.cross.filter(c => c.gapM !== null && c.gapM < 0.6).length, ...(this.rec ? { rec: this.rec, meta: this.meta() } : {}) };
  }
}
