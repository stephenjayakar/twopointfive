// A FRIEND IN THE LINE OF FIRE — a bystander for tools/qa/playthrough.ts (PT_LINE=1), like its Tally, DefWatch and ways-watch.ts: it reads, and writes nothing
// the game reads (no dice drawn, nothing ordered; with it on a run's PT_DIGEST is the run's without it).
// The question (rebuild/line-of-fire): how often does a teammate with a man to shoot have his round or his gun held for a friend standing in the line, for how
// long, who the friend is (the scripted commander, a mate, somebody else of his side — a hostage), what each of them was doing, and what it cost him.
//
// A BLOCKED FRAME, per living teammate who is not blinded, staggered or held:
//   his man     the hostile his muzzle is on (roomfight.ts Op.tgt) — or, for a man the fight AI has (no script), his foe — alive and IN HIS SIGHT this moment
//               (the room fight's own meter: a real sighting inside the last 0.3 s)
//   a round     there is a shot at that man past the level (guards.ts clearShot at his chest, else his head — the fire gate's own order): furniture, a jamb or
//               a pane in the line is somebody else's question and is not counted here
//   a friend    the game's own tests say one is in the line: the fire gate (roomfight.ts friendInLine, this frame's muzzle → the point the round would go to),
//               the carry (the same from the gun shoulder to his chest: what lowers the gun for the player), or the script runner's / the fight AI's muzzle
//               discipline (guards.ts colleagueInLine); a gun still down on the discipline's own 0.2 s after the line cleared stays counted to the same friend
// `engaged` = the first two; `blocked` = all three; `ready` = blocked AND past his reaction beat and not reloading (only a friend is keeping the round in).
// AN EPISODE = one teammate's blocked frames with no gap over GAP seconds. Each carries the split the page wants (seconds of it):
//   by whom              Sam (the commander) · a mate (an operative unit) · other (anybody else of his side: a hostage)
//   the commander        still (under 0.3 m/s) or moving; what the driver had him doing — 'post' (stood where his errand put him), 'walk' (walking his errand),
//                        'off' (stepping out of a man's fire: playthrough.ts offLine); and, stood at his post in the line, whether the driver's own rule saw
//                        him in it and had a free spot to step to (`samFree` — it should have moved him), saw him in it with a wall on both sides (`samBoxed`),
//                        or did not see him in it at all (`samUnseen`: the game's lane is wider than the driver's 0.9 m, or its line is another line)
//   the teammate         walking on an order (a script goal not arrived at: the side step's own exclusion — `walk`), on a step the room fight itself ordered
//                        (`step`: round a friend, off a doorway), planted but moving over 0.3 m/s (`drift`),
//                        or planted and still (`still`: the only case roomfight.ts sideStep works in); his order's name and the door order's phase at the start
//   what the game did    a side step round the friend (`stepOk`) and the let-go for a man shooting from elsewhere (`letGo`) — both read off the room
//                        fight's own notes —, a side-step try that found no spot (`stepNo`: it bars itself a second),
//                        feet held short in the dark for Sam (`short`), the fight AI's own line step (`aiStep`); seconds with the gun lowered (`low`)
//   the threat           seconds its muzzle was on him (inside 0.35 rad: the room fight's own `onUs`), seconds he was its foe; rounds that passed inside
//                        NEAR m of him while blocked and in the AFTER seconds after (`shotsAt`, and `shotsBy`: by the masked man himself)
//   the geometry         seconds the friend's body was really in the way (`tight`: inside 0.35 m of the muzzle → man line, between them) and seconds he stood
//                        PAST the man (`past`); the rest is the game's lane being wider than a body (0.45 m, to 0.95 for a man on the move)
//   another man          seconds he had another hostile in his sight with a round at him and no friend in THAT line (`alt`: he was held on a masked man
//                        with an open one to shoot)
//   what happened        `out`: 'ok' · 'killed' (while blocked) · 'killedAfter' (inside AFTER s of it); `by` the killer, `byThreat` it was the masked man;
//                        `end`: why the stretch ended — dead · threatDown · lostSight · noShot · letGo · switched · clear (the same man, the line open) ·
//                        blind · runEnd; metres he and the friend each moved over it; his rounds in the AFTER s after; whether the masked man was dropped
//                        inside that, and by whom
// A hit is a kill in this game (combat.ts: a round that finds a man drops him), so there is no 'hit, not killed'; `shotsAt` is the near-miss count.
// THE RUN'S OWN TOTALS (man-seconds): up · engaged · blocked (by Sam / mate / other) · ready; and every teammate's death filed as 'blocked' (a blocked frame
// inside GAP s before it), 'after' (inside AFTER s of one), 'engaged' (he had his man and an open line), 'none'.
import { clearShot, colleagueInLine } from '../../src/game/guards.ts';

export const LINE_GAP = 0.3, LINE_AFTER = 3, LINE_NEAR = 1.0;
export interface LineEp {
  who: string; t: number; secs: number; ready: number; at: [number, number]; threat: string; threatAt: [number, number]; d: number;
  friend: string; kind: 'Sam' | 'mate' | 'other'; friendAt: [number, number]; along: number; side: number;
  bySam: number; byMate: number; byOther: number;
  samStill: number; samPost: number; samWalk: number; samOff: number; samFree: number; samBoxed: number; samUnseen: number; mateStill: number; mateWalk: number;
  walk: number; step: number; drift: number; still: number; order: string; door: string | null; scripted: boolean;
  stepOk: number; stepNo: number; letGo: number; short: number; aiStep: number; low: number; held: number;
  onMe: number; foeMe: number; shotsAt: number; shotsBy: number; alt: number; tight: number; past: number;
  out: 'ok' | 'killed' | 'killedAfter'; by: string | null; byThreat: boolean; killT: number | null; end: string; moved: number; friendMoved: number; roundsAfter: number; threatDown: string | null;
}
/** a teammate's death. `cls` as the head has it · `blk` the seconds of his last LINE_AFTER he was blocked (`blkSam` / `blkMate` of them: by whom), `open` the
 *  seconds of them he had his man and an open line · `last` which of the three his last living frame was · that frame: `feet` (walk = on an order's leg · still · drift), `low` gun lowered, `order`,
 *  `tgt` the man he was on, `onKiller` that man was his killer */
export interface LineDeath { t: number; who: string; by: string; cls: 'blocked' | 'after' | 'engaged' | 'none'; friend: string | null; kind: string | null; byThreat: boolean; ago: number | null; at: [number, number]; byAt: [number, number] | null;
  blk: number; blkSam: number; blkMate: number; open: number; last: 'blocked' | 'open' | 'none'; feet: string; low: boolean; order: string; tgt: string | null; onKiller: boolean }
export interface LineOut { up: number; engaged: number; blocked: number; ready: number; bySam: number; byMate: number; byOther: number; rounds: number; eps: LineEp[]; deaths: LineDeath[]; gameHeld: number; gameStepped: number }

interface Open { row: LineEp; last: number; threat: any; friend: any; p0: number[]; f0: number[]; fMoved: number; fLast: number[]; rounds0: number; sums: Map<string, number> }
interface Man { ring: Uint8Array; ri: number; snap: { feet: string; low: boolean; order: string; tgt: any }; was: string; ep: Open | null; lastClosed: Open | null; evStep: number; evLetGo: number; engaged: boolean; stepUntil: number; pass: any; held: number; lineSide: number; rounds: number; lastFriend: any }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const xz = (p: number[]): [number, number] => [+p[0].toFixed(1), +p[2].toFixed(1)];
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a <= 0) a += 2 * Math.PI; return a - Math.PI; };
const r2 = (x: number) => +x.toFixed(2);

export class LineWatch {
  private men = new Map<any, Man>(); private seenEv = new WeakSet<object>();
  private out: LineOut = { up: 0, engaged: 0, blocked: 0, ready: 0, bySam: 0, byMate: 0, byOther: 0, rounds: 0, eps: [], deaths: [], gameHeld: 0, gameStepped: 0 };
  /** episodes closed inside the last LINE_AFTER seconds: what happens to the man after one is still theirs */
  private tail: { m: any; E: Open; t1: number }[] = [];
  constructor(private g: any, private say: (s: string) => void = () => { }) { }

  /** the room fight's own notes since last frame (its log is trimmed from the front: the last note read is found again by identity) */
  private logLast: any = null;
  private notes(team: any[]) {
    const L = this.g.fight?.log as { who: string; what: string }[] | undefined; if (!L || !L.length) { this.logLast = null; return; }
    let i = this.logLast ? L.lastIndexOf(this.logLast) + 1 : 0;
    for (; i < L.length; i++) { const n = L[i], m = team.find(x => x.callsign === n.who), S = m && this.men.get(m); if (!S) continue;
      if (n.what.startsWith('steps round a friend')) S.evStep++; else if (n.what.startsWith('lets ') && n.what.includes('a friend in the line')) S.evLetGo++; }
    this.logLast = L[L.length - 1];
  }
  private kindOf(f: any): 'Sam' | 'mate' | 'other' { return f === 'player' ? 'Sam' : f.team === 'operative' && f.unit ? 'mate' : 'other'; }
  private charOf(f: any): any { return f === 'player' ? this.g.player.char : f.char; }
  /** the man this teammate is on, in his sight now — and the room fight's record of him (null: the fight AI's man) */
  private threatOf(m: any, t: number): { h: any; O: any } | null {
    const g = this.g, O = g.fight?.opOf?.(m) ?? null;
    if (m.script) { const h = O?.tgt; if (!h || h.state === 'dead') return null; const M = O.meters.get(h); return M && t - M.seenT < 0.3 ? { h, O } : null; }
    const h = m.foe; if (m.state !== 'alert' || !h || h === 'player' || h.state === 'dead' || t - m.lastSeenT > 0.3) return null;
    return { h, O };
  }
  /** a friend in this teammate's line to that man, by the game's own tests (see the head) — null: the line is open */
  private friendIn(m: any, h: any): { f: any; to: number[] } | null {
    const g = this.g, c = m.char, hc = h.char, p = c.pos; const chest = hc.bones.chest ?? [hc.pos[0], hc.pos[1] + 1.1, hc.pos[2]];
    let to: number[] | null = null;
    if (clearShot(g, c, chest)) to = chest; else { const head = hc.bones.head ?? [hc.pos[0], hc.pos[1] + 1.6, hc.pos[2]]; if (clearShot(g, c, head)) to = head; }
    if (!to) return null;
    const carry = g.fight.friendInLine(c.bones.upperArmR ?? [p[0], p[1] + 1.4, p[2]], chest, m);   // (roomfight.ts samInLine: the carry line lowers the gun for the PLAYER alone — a mate there is the discipline's question, asked next)
    const f = g.fight.friendInLine(c.muzzle, to, m) ?? (carry === 'player' ? carry : null) ?? colleagueInLine(g, m, chest as any);
    return { f: f ?? null, to };
  }
  /** the driver's own test of the commander against the line a → b (playthrough.ts offLine): 'unseen' = it does not see him in it · 'free' = it does, with a
   *  spot to step to · 'boxed' = it does, with a wall both sides */
  private samCase(a: number[], b: number[]): 'unseen' | 'free' | 'boxed' {
    const g = this.g, p = g.player.char.pos; const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L;
    const sx = p[0] - a[0], sz = p[2] - a[2], along = sx * fx + sz * fz, side = sx * fz - sz * fx;
    if (along < 0.1 || along > L + 0.5 || Math.abs(side) > 0.9) return 'unseen';
    for (const k of [1, -1]) { const q = [a[0] + fx * along + fz * k * 1.3, 0, a[2] + fz * along - fx * k * 1.3]; if (!g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) return 'free'; }
    return 'boxed';
  }
  private shut(m: any, S: Man, t: number, end: string) {
    const E = S.ep; if (!E) return; S.ep = null; const r = E.row;
    r.end = end; r.moved = r2(flat(E.p0, m.char.pos)); r.friendMoved = r2(E.fMoved); E.rounds0 = this.g.fight?.opOf?.(m)?.rounds ?? 0;
    this.tail.push({ m, E, t1: t }); S.lastClosed = E;
  }
  private finish(E: Open) {
    const r = E.row; let bestK = '', bs = -1; for (const [k, v] of E.sums) if (v > bs) { bs = v; bestK = k; }   // (the friend named is the one in the line longest)
    if (bestK) { const [kind, name] = bestK.split('|'); r.kind = kind as LineEp['kind']; r.friend = name; }
    for (const k of ['secs', 'ready', 'bySam', 'byMate', 'byOther', 'samStill', 'samPost', 'samWalk', 'samOff', 'samFree', 'samBoxed', 'samUnseen', 'mateStill', 'mateWalk', 'walk', 'step', 'short', 'drift', 'still', 'low', 'held', 'onMe', 'foeMe', 'alt', 'tight', 'past'] as const) (r as any)[k] = r2((r as any)[k]);
    this.out.eps.push(r);
    if (r.secs >= 0.5 || r.out !== 'ok') this.say(`   || line · ${r.who} (${r.at}) on ${r.threat} (${r.threatAt}) ${r.d} m · ${r.friend} in it ${r.secs} s (${r.ready} ready) · ${r.walk > r.still + r.drift ? 'walking on ' + r.order : 'planted, ' + r.order} · ${r.out}${r.by ? ' by ' + r.by : ''} · ended ${r.end}`);
  }

  /** once a frame, after the game's step. `drive`: what the driver has the commander doing this frame */
  tick(t: number, team: any[], drive: 'post' | 'walk' | 'off', dt = 1 / 60) {
    const g = this.g, sam = g.player.char, samV = Math.hypot(sam.vel[0], sam.vel[2]);
    this.notes(team);
    // hostile rounds of this frame: who fired, the segment flown
    const shots: { who: number; from: number[]; to: number[] }[] = [];
    for (const e of g.events) { if (this.seenEv.has(e)) continue; this.seenEv.add(e); if (e.kind !== 'guardShot' || !e.from || !e.to) continue; const w = g.guards.find((x: any) => x.char.id === e.who); if (w && w.team === 'hostile') shots.push({ who: e.who, from: e.from, to: e.to }); }   // (combat.ts files every AI round as a guardShot: theirs alone are rounds AT the team)
    const near = (p: number[], s: { from: number[]; to: number[] }) => { const dx = s.to[0] - s.from[0], dz = s.to[2] - s.from[2], L2 = dx * dx + dz * dz || 1; const k = Math.max(0, Math.min(1, ((p[0] - s.from[0]) * dx + (p[2] - s.from[2]) * dz) / L2)); return Math.hypot(s.from[0] + dx * k - p[0], s.from[2] + dz * k - p[2]) < LINE_NEAR; };
    for (const m of team) {
      let S = this.men.get(m); const c = m.char, p = c.pos, O = g.fight?.opOf?.(m) ?? null;
      if (!S) this.men.set(m, S = { ring: new Uint8Array(Math.round(LINE_AFTER * 60)), ri: 0, snap: { feet: 'still', low: false, order: '', tgt: null }, was: m.state, ep: null, lastClosed: null, evStep: 0, evLetGo: 0, engaged: false, stepUntil: O?.stepUntil ?? 0, pass: O?.pass ?? null, held: O?.heldForFriend ?? 0, lineSide: 0, rounds: O?.rounds ?? 0, lastFriend: null });
      if (m.state === 'dead') {
        if (S.was !== 'dead') {
          const k = g.guards.find((x: any) => x.char.id === m.killerId) ?? null, E = S.ep, last = E ?? S.lastClosed;
          const ago = E ? 0 : last ? t - last.last : null;
          const cls: LineDeath['cls'] = E ? 'blocked' : ago !== null && ago <= LINE_AFTER ? 'after' : S.engaged ? 'engaged' : 'none';
          const byThreat = !!last && (cls === 'blocked' || cls === 'after') && !!k && last.threat === k;
          if (last && (cls === 'blocked' || cls === 'after')) { last.row.out = cls === 'blocked' ? 'killed' : 'killedAfter'; last.row.by = k?.callsign ?? '?'; last.row.byThreat = byThreat; last.row.killT = +t.toFixed(1); }
          this.out.deaths.push({ t: +t.toFixed(1), who: m.callsign, by: k?.callsign ?? '?', cls, ...(() => { if (!last || (cls !== 'blocked' && cls !== 'after')) return { friend: null, kind: null }; let bk = `${last.row.kind}|${last.row.friend}`, bs = -1; for (const [k2, v] of last.sums) if (v > bs) { bs = v; bk = k2; } const [kind, friend] = bk.split('|'); return { friend, kind }; })(), byThreat, ago: ago === null ? null : r2(ago), at: xz(p), byAt: k ? xz(k.char.pos) : null,
            ...(() => { let b = 0, bs = 0, bm = 0, o = 0; for (const v of S!.ring) { if (v >= 2) b++; if (v === 2) bs++; if (v === 3) bm++; if (v === 1) o++; } const lv = S!.ring[(S!.ri + S!.ring.length - 1) % S!.ring.length]; return { blk: r2(b / 60), blkSam: r2(bs / 60), blkMate: r2(bm / 60), open: r2(o / 60), last: (lv >= 2 ? 'blocked' : lv === 1 ? 'open' : 'none') as LineDeath['last'] }; })(),
            feet: S.snap.feet, low: S.snap.low, order: S.snap.order, tgt: S.snap.tgt?.callsign ?? null, onKiller: !!k && S.snap.tgt === k });
          this.shut(m, S, t, 'dead');
        }
        S.was = m.state; continue;
      }
      S.was = m.state; this.out.up += dt;
      { const s0 = m.script, v0 = Math.hypot(c.vel[0], c.vel[2]), A0 = g.orders.of(m); S.snap = { feet: s0 && O?.step && s0.goal === O.step.mine ? 'step' : s0 && s0.goal && !s0.arrived ? 'walk' : v0 > 0.3 ? 'drift' : 'still', low: !!m.muzzleDown, order: A0 ? `${A0.order}${A0.arrived ? ' (on his mark)' : ''}` : m.script ? 'scripted' : `no order, ${m.state}`, tgt: O?.tgt ?? (!m.script && m.foe && m.foe !== 'player' ? m.foe : null) }; }
      // the game's own moves since last frame (read off its records, nothing asked of it)
      let stepOk = S.evStep, stepNo = 0, letGo = S.evLetGo, aiStep = 0; S.evStep = S.evLetGo = 0;
      if (O) { const d = O.stepUntil - S.stepUntil; if (d > 0.05 && !stepOk && Math.abs(O.stepUntil - g.time - 1) < 0.06) stepNo = 1;   // (sideStep's own 'no spot from here': it bars itself for a second and leaves no note; a doorway step bars 1.5 s, its miss 0.5) S.stepUntil = O.stepUntil;
        S.pass = O.pass; this.out.rounds += O.rounds - S.rounds; S.rounds = O.rounds; }
      if (!m.script && (m.lineSide ?? 0) !== 0 && S.lineSide === 0) aiStep = 1; S.lineSide = m.lineSide ?? 0;
      const heldNow = O ? O.heldForFriend - S.held : 0; if (O) S.held = O.heldForFriend;
      const blind = g.time < m.dazzledUntil || g.time < m.staggerUntil || !!m.held;
      const T = blind ? null : this.threatOf(m, g.time), FI = T ? this.friendIn(m, T.h) : null;
      S.engaged = !!FI;
      let f = FI?.f ?? null;
      if (FI && !f && m.muzzleDown && S.ep && S.lastFriend && S.ep.threat === T!.h) f = S.lastFriend;   // (the discipline's own beat before the gun comes back up: still his friend's doing)
      if (FI) this.out.engaged += dt;
      if (!T || !FI || !f) { S.ring[S.ri] = FI ? 1 : 0; S.ri = (S.ri + 1) % S.ring.length;
        if (S.ep && t - S.ep.last > LINE_GAP) { const E = S.ep;
          const end = blind ? 'blind' : E.threat.state === 'dead' ? 'threatDown' : letGo || (O?.pass && O.pass.h === E.threat && !O.pass.noShot) ? 'letGo' : !T ? 'lostSight' : T.h !== E.threat ? 'switched' : !FI ? 'noShot' : 'clear';
          this.shut(m, S, t, end); }
        else if (S.ep) { S.ep.row.letGo += letGo; S.ep.row.stepOk += stepOk; }
        else if (S.lastClosed && t - S.lastClosed.last < 1) { S.lastClosed.row.letGo += letGo; S.lastClosed.row.stepOk += stepOk; }
        continue;
      }
      const h = T.h, hc = h.char, fc = this.charOf(f), kind = this.kindOf(f), name = f === 'player' ? 'Sam' : f.callsign;
      S.lastFriend = f; S.ring[S.ri] = kind === 'Sam' ? 2 : kind === 'mate' ? 3 : 4; S.ri = (S.ri + 1) % S.ring.length;
      if (S.ep && S.ep.threat !== h) this.shut(m, S, t, 'switched');   // (a stretch is on one man)
      if (!S.ep) {
        const A = g.orders.of(m), dOp = g.doorTools?.ops?.find((o: any) => o.men.includes(m)) ?? null;
        const a = c.pos, b = hc.pos, dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, fp = fc.pos, sx = fp[0] - a[0], sz = fp[2] - a[2];
        S.ep = { last: t, threat: h, friend: f, p0: [p[0], 0, p[2]], f0: [fp[0], 0, fp[2]], fLast: [fp[0], 0, fp[2]], fMoved: 0, rounds0: O?.rounds ?? 0, sums: new Map(),
          row: { who: m.callsign, t: +t.toFixed(2), secs: 0, ready: 0, at: xz(p), threat: h.callsign, threatAt: xz(hc.pos), d: +L.toFixed(1), friend: name, kind, friendAt: xz(fp), along: r2((sx * dx + sz * dz) / L), side: r2(Math.abs(sx * dz - sz * dx) / L),
            bySam: 0, byMate: 0, byOther: 0, samStill: 0, samPost: 0, samWalk: 0, samOff: 0, samFree: 0, samBoxed: 0, samUnseen: 0, mateStill: 0, mateWalk: 0, walk: 0, step: 0, drift: 0, still: 0,
            order: A ? `${A.order}${A.arrived ? ' (on his mark)' : ''}` : m.script ? 'scripted' : `no order, ${m.state}`, door: dOp?.phase ?? null, scripted: !!m.script,
            stepOk: 0, stepNo: 0, letGo: 0, short: 0, aiStep: 0, low: 0, held: 0, onMe: 0, foeMe: 0, shotsAt: 0, shotsBy: 0, alt: 0, tight: 0, past: 0, out: 'ok', by: null, byThreat: false, killT: null, end: '', moved: 0, friendMoved: 0, roundsAfter: 0, threatDown: null } };
      }
      const E = S.ep, r = E.row; E.last = t; r.secs += dt; this.out.blocked += dt;
      const key = `${kind}|${name}`; E.sums.set(key, (E.sums.get(key) ?? 0) + dt);
      if (f === E.friend) { E.fMoved += flat(E.fLast, fc.pos); E.fLast = [fc.pos[0], 0, fc.pos[2]]; }
      const ready = !O || !m.script || (g.time >= O.readyAt && g.time >= O.reloadUntil); if (ready) { r.ready += dt; this.out.ready += dt; }
      if (kind === 'Sam') { r.bySam += dt; this.out.bySam += dt; if (samV < 0.3) r.samStill += dt;
        if (drive === 'post') { r.samPost += dt; const k = this.samCase(c.pos, hc.pos); if (k === 'free') r.samFree += dt; else if (k === 'boxed') r.samBoxed += dt; else r.samUnseen += dt; } else if (drive === 'walk') r.samWalk += dt; else r.samOff += dt; }
      else { if (kind === 'mate') { r.byMate += dt; this.out.byMate += dt; } else { r.byOther += dt; this.out.byOther += dt; }
        if (Math.hypot(fc.vel[0], fc.vel[2]) < 0.3) r.mateStill += dt; const fs = f.script; if (fs && fs.goal && !fs.arrived) r.mateWalk += dt; }
      const s = m.script, speed = Math.hypot(c.vel[0], c.vel[2]);
      if (s && O?.step && s.goal === O.step.mine) r.step += dt; else if (s && s.goal && !s.arrived) r.walk += dt; else if (speed > 0.3) r.drift += dt; else r.still += dt;
      r.stepOk += stepOk; r.stepNo += stepNo; r.letGo += letGo; r.aiStep += aiStep; if (g.fight?.short?.(m)) r.short += dt;
      if (m.muzzleDown) r.low += dt; r.held += heldNow * dt;
      if (Math.abs(wrap(Math.atan2(p[0] - hc.pos[0], p[2] - hc.pos[2]) - hc.aimYaw)) < 0.35) r.onMe += dt;
      if (h.foe === m) r.foeMe += dt;
      { const a = c.muzzle, b = FI.to, dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz || 1, hp = fc.bones.hips ?? fc.pos, tr = ((hp[0] - a[0]) * dx + (hp[2] - a[2]) * dz) / L2;   // the friend's body against the round's own line: past the man, or really in the way (inside 0.35 m of it between gun and man)
        if (tr > 1) r.past += dt; else if (tr > 0 && Math.hypot(a[0] + dx * tr - hp[0], a[2] + dz * tr - hp[2]) < 0.35) r.tight += dt; }
      // another man he could be shooting: in his sight, a round at him, nobody in that line
      if (O && m.script) for (const [x, M] of O.meters as Map<any, any>) { if (x === h || x.state === 'dead' || g.time - M.seenT > 0.3) continue; const X = this.friendIn(m, x); if (X && !X.f) { r.alt += dt; break; } }
    }
    // rounds near a man in a stretch, or inside the seconds after it; what he and his man come to in those seconds
    for (const sh of shots) for (const [m, S] of this.men) { if (m.state === 'dead') continue; let E = S.ep; if (!E) for (let i = this.tail.length - 1; i >= 0 && !E; i--) if (this.tail[i].m === m) E = this.tail[i].E;   // (his newest stretch)
      if (!E || !near(m.char.pos, sh)) continue; E.row.shotsAt++; if (sh.who === E.threat.char.id) E.row.shotsBy++; }
    for (let i = this.tail.length - 1; i >= 0; i--) { const X = this.tail[i], E = X.E, O = g.fight?.opOf?.(X.m);
      if (!E.row.threatDown && E.threat.state === 'dead') { const k = g.guards.find((x: any) => x.char.id === E.threat.killerId); E.row.threatDown = k ? (k === X.m ? 'him' : k.callsign) : '?'; }
      if (t - X.t1 > LINE_AFTER || X.m.state === 'dead') { E.row.roundsAfter = O ? Math.max(0, O.rounds - E.rounds0) : 0; this.finish(E); this.tail.splice(i, 1); } }
  }
  close(t: number): LineOut {
    for (const [m, S] of this.men) if (S.ep) this.shut(m, S, t, 'runEnd');
    for (const X of this.tail) { const O = this.g.fight?.opOf?.(X.m); X.E.row.roundsAfter = O ? Math.max(0, O.rounds - X.E.rounds0) : 0; this.finish(X.E); } this.tail = [];
    const o = this.out; for (const k of ['up', 'engaged', 'blocked', 'ready', 'bySam', 'byMate', 'byOther'] as const) o[k] = r2(o[k]);
    o.gameHeld = this.g.fight?.stats?.heldForFriend ?? 0; o.gameStepped = this.g.fight?.stats?.stepped ?? 0; o.eps.sort((a, b) => a.t - b.t);
    return o;
  }
}
