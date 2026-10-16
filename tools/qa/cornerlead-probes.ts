// The 'cornerlead' family: A SHOT DOES NOT COST A MAN HIS CORNER, AND THE MAN WHO HAS SEEN MOST OF THE ROOM GOES IN FIRST (the maintainer, 10-05: teammates
// "need to check their corners"; the footage — Ready or Not, 7:45: the first two men 'are allowed to take a shot at that threat and then immediately collapse
// their corner'; Door Kickers: 'i'm going to lead with this man because he's already seen most of the room'). Counted headless, on every door of every room a
// defender holds in every scenario on the start card, from bang-tally.ts's own staging (the room HOT, the team a few steps outside):
//   bun run tools/qa/cornerlead-probes.ts [--seeds 1-4] [--jobs 3] [--scn id,id] [--tools open,bang,thr] [--arms before,after] [--json out.json] [--md]
//   bun run tools/qa/cornerlead-probes.ts trace <scenario>:<door>:<tool>:<seed>:<arm>      one run with its timeline (CL_WATCH='Blue Two' adds that man's
//                                                                                           muzzle and chest against his owed corner at 10 Hz)
//   bun run tools/qa/probes.ts cornerlead | cornerlead-corners | cornerlead-lead             the gate's two verdicts (a fixed handful of doors)
// TOOLS: open = 'open and clear' · bang = 'bang and clear' · thr = worked from the threshold, then the step in. ARMS: before = DOORTOOLS.cornerOwed, collapse,
// cornerTurn and leadSeen all off (the entry as it was; the seen-floor record is kept all the same — DoorTools.seenWatch — so the same question can be asked of it) ·
// after = the build as it ships.
// CORNERS, per man through the frame with corners dealt (doortools.ts cornersOf: the near and the deep corner of his own side): whether the room fight had
// his muzzle on a man while a corner was still owed ('fought'), whether he FIRED ON THE WAY IN (a round between the entry's go and cornerCap a
// corner after he crossed — the men counted: one window for both arms), and for each of his corners how the entry left it — LOOKED (his own muzzle within
// DOORTOOLS.cornerRad of its bearing for cornerSecs: this file's own count, whatever the game thought), REACHED (he walked to it), or GIVEN UP (the corner
// step moved on with neither) — and whether his muzzle, or anybody's, was ever on it before the entry was over. Men who fell before their corners were done
// are counted apart. COLLAPSE: from the moment a man he shot drops with a corner still owed, the seconds until his muzzle is on that corner.
// LEAD, per entry, at the moment they go: who is first through, how much of the room's floor each man at the frame has seen (floorseen.ts), and whether a man
// at the frame had seen DOORTOOLS.leadSeenMin cells more than the man who went first.
// THE HARNESS HAS NO GPU: sight is the CPU's direct-light estimate; nothing here is drawn.
import { readFileSync, writeFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { stage, discover, setKnobs } from './bang-tally.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const DTM: any = await import(`${ROOT}/src/game/doortools.ts`);
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);

const DT = 1 / 60;
type Tool = 'open' | 'bang' | 'thr';
type Arm = 'before' | 'after';
interface Spec { scn: string; door: string; room: string; tool: Tool; seed: number; arm: Arm }
type How = 'looked' | 'reached' | 'gave up' | 'pending';
interface ManRow { who: string; fought: boolean; fired: boolean; died: boolean; corners: { how: How; own: boolean; any: boolean }[]; collapse: (number | null)[] }
interface LeadRow { first: string; lead: string; threw: string | null; seen: Record<string, number>; at: string[]; firstN: number; bestN: number; best: string; less: boolean; lessButThrew: boolean }
interface Out extends Spec { note: string; men: ManRow[]; lead: LeadRow | null; lost: number; team: number; down: number; of: number; held: boolean; secs: number }
const OFF = { DOORTOOLS: { cornerOwed: false, collapse: false, cornerTurn: false, leadSeen: false } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const quiet = async <T>(on: boolean, fn: () => T | Promise<T>): Promise<T> => { if (!on) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function run(X: Spec, verbose = false): Promise<Out> {
  setKnobs(X.arm === 'before' ? OFF : {});
  const S = await quiet(!verbose, () => stage(X.scn, X.seed)); const { g, step } = S; const O = g.orders, D = g.doorTools, nav = g.col.nav, K = DTM.DOORTOOLS;
  D.seenWatch = true;
  const out: Out = { ...X, note: '', men: [], lead: null, lost: 0, team: 0, down: 0, of: 0, held: false, secs: NaN };
  const mine = S.defs.filter((d: any) => S.roomKey(d.room) === X.room); if (!mine.length) { out.note = 'no defender dealt to this room on this seed'; return out; }
  const room = mine[0].room, ent = room.entries.find((e: any) => e.door.def.name === X.door); if (!ent) { out.note = 'door is not an entry of the room'; return out; }
  const d = ent.door, ox = ent.out[0], oz = ent.out[1], lx = -oz, lz = ox;
  const men: any[] = mine.map((m: any) => m.gd); out.of = men.length;
  // ---- bang-tally.ts's staging, as it stages it: the team a few steps outside off the line of the opening, anybody else with a line to them off the floor,
  // then a loud noise at the door four seconds before the order (the room is HOT: its men are on the door)
  const free = (p: number[]): number[] | null => { const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; };
  const outPt = (back: number, lat: number): number[] => [ent.at[0] + ox * back + lx * lat, 0, ent.at[2] + oz * back + lz * lat];
  const gate = outPt(0.7, 0);
  const clearTo = (p: number[]) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'); out.team = team.length;
  const spots: number[][] = [];
  for (const back of [3.2, 4.2, 2.4, 5.2, 6.2]) for (const lat of [1.1, -1.1, 0.4, -0.4, 1.9, -1.9]) { const p = free(outPt(back, lat)); if (p && clearTo(p) && flat(p, ent.at) > 1.8 && !spots.some(s => flat(s, p) < 0.8)) spots.push(p); }
  if (spots.length < team.length + 1) { out.note = `no floor outside for the team (${spots.length} spots)`; return out; }
  team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(-ox, -oz); });
  await quiet(!verbose, () => g.teleportPlayer(spots[team.length] as any));
  for (const x of g.guards) { if (x.state === 'dead' || x.team !== 'hostile' || men.includes(x)) continue;
    const c = [x.char.pos[0], 1.5, x.char.pos[2]]; if ([...spots.slice(0, team.length + 1), gate].some(p => !g.col.solidBlocked(c as any, [p[0], 1.3, p[2]]))) await quiet(!verbose, () => CBM.killGuard(g, x, [0, 0, 1], true)); }
  step(10);
  g.events.push({ kind: 'bang', pos: [gate[0], 0.3, gate[2]], time: g.time, loud: true });
  step(240);
  if (team.some(x => x.state === 'dead')) { out.note = 'a man lost before the order'; return out; }
  // ---- the watchers
  const t0 = g.time; const log: string[] = []; const T = (s: string) => { if (verbose) log.push(`${(g.time - t0).toFixed(2).padStart(6)}  ${s}`); };
  const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
  const onPt = (x: any, pt: number[]) => Math.abs(wrap(x.char.aimYaw - yawTo(x.char.pos, pt))) < K.cornerRad;   // (the entry's own sense of 'on the corner': the muzzle's bearing)
  const LOOK = K.cornerSecs - 1.5 * DT;   // (this watcher runs after the frame's step: a frame behind the game's own count)
  interface Rec { gd: any; op: any; pts: number[][]; i: number; row: ManRow; run: Map<any, number[]>; downAt: number; downK: number; tx: number }
  const recs = new Map<any, Rec>(); const seenEv = new Set<any>(g.events); const was = new Map<any, string>(g.guards.map((x: any) => [x, x.state])); const ledOps = new Set<any>();
  let lastDown = NaN;
  // FIRED: a round of his between the entry's GO and the last moment the old entry would still have owed him a corner (cornerCap a corner after he crossed) —
  // one window for both arms, whatever the corner step has made of his corners by then (a round from the doorway on the way in counts: that is the threat met)
  const shots = new Map<any, number[]>(); const goT = new Map<any, number>();
  const along = (p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
  const watch = () => {
    const t = g.time;
    // who goes first, and what each man at the frame had seen of the room
    for (const op of D.ops) { if (op.door !== d || op.phase !== 'enter' || ledOps.has(op) || !op.queue.length) continue; ledOps.add(op);
      const q = [...op.queue].sort((a: any, b: any) => a.at - b.at), first = q[0].gd, rm = g.fight.roomAt(q[0].pod.pos); if (!rm || !D.seen) continue;
      const n = (m: any): number => D.seen.count(m, rm.cells, t - K.leadSeenSecs), W = d.def.width;
      const where = (m: any) => op.post.get(m)?.pos ?? m.char.pos, hi = (m: any) => along(where(m)) > W / 2, near = (m: any) => flat(where(m), d.frameCentre);
      const all: any[] = [...new Set([...op.men, ...q.map((x: any) => x.gd)])].filter((m: any) => m.state !== 'dead');
      const at: any[] = op.thr ? op.thr.jamb.filter((m: any) => m.state !== 'dead') : [true, false].map(s => all.filter(m => hi(m) === s).sort((a, b) => near(a) - near(b))[0]).filter(Boolean);
      if (!at.includes(first)) at.push(first);
      const seen: Record<string, number> = {}; for (const m of all) seen[m.callsign] = n(m);
      const others = at.filter(m => m !== first), best = [...others].sort((a, b) => n(b) - n(a))[0] ?? first, clean = others.filter(m => m !== op.threw), bestClean = [...clean].sort((a, b) => n(b) - n(a))[0];
      const by = Math.max(1, K.leadSeenMin), less = !!bestClean && n(bestClean) >= n(first) + by, lessAny = n(best) >= n(first) + by;   // (the game's own margin: a tie is the lead's)
      out.lead = { first: first.callsign, lead: op.lead.callsign, threw: op.threw?.callsign ?? null, seen, at: at.map(m => m.callsign), firstN: n(first), bestN: Math.max(n(first), ...others.map(n)), best: (lessAny ? best : first).callsign, less, lessButThrew: lessAny && !less };
      T(`GO · first ${first.callsign} (lead ${op.lead.callsign}${op.threw ? `, can by ${op.threw.callsign}` : ''}) · seen of the room's ${rm.cells.size} cells: ${all.map(m => `${m.callsign} ${n(m)}${at.includes(m) ? '*' : ''}`).join(', ')}`); }
    // the corners
    for (const op of D.ops) { if (op.phase !== 'enter') continue; if (!goT.has(op)) goT.set(op, t);
      for (const gd of op.men) { const C = op.corner.get(gd); if (!C || !C.pts.length || op.crossed.get(gd) === undefined) continue;
        let R = recs.get(gd); if (!R) { R = { gd, op, pts: C.pts, i: C.i, row: { who: gd.callsign, fought: false, fired: false, died: false, corners: C.pts.map(() => ({ how: 'pending' as How, own: false, any: false })), collapse: [] }, run: new Map(), downAt: NaN, downK: 0, tx: t }; recs.set(gd, R); T(`${gd.callsign} through the frame · ${C.pts.length} corners`); }
        if (R.op !== op) continue;
        const owed = C.i < R.pts.length;
        if (verbose && process.env.CL_WATCH === gd.callsign && owed && Math.round((t - t0) * 60) % 6 === 0) T(`   ${gd.callsign} c${C.i + 1} off ${wrap(gd.char.aimYaw - yawTo(gd.char.pos, R.pts[C.i])).toFixed(2)} rad · ${flat(gd.char.pos, R.pts[C.i]).toFixed(1)} m · over ${gd.script?.over ? (gd.script.over.walk ? 'walk' : 'yes') : 'no'} · fight ${(C.fight ?? 0).toFixed(2)} · state ${gd.state} · chest ${wrap(gd.char.bodyYaw - yawTo(gd.char.pos, R.pts[C.i])).toFixed(2)} rad off it`);
        if (gd.state === 'dead') { if (owed) R.row.died = true; continue; }
        if (owed && gd.script?.over) { if (!R.row.fought) T(`${gd.callsign} is on a man with corner ${C.i + 1} owed`); R.row.fought = true; }
        for (const x of team) { if (x.state === 'dead') continue; let L = R.run.get(x); if (!L) R.run.set(x, L = R.pts.map(() => 0));
          for (let k = 0; k < R.pts.length; k++) { L[k] = onPt(x, R.pts[k]) ? L[k] + DT : 0; if (L[k] >= LOOK) { R.row.corners[k].any = true; if (x === gd && !R.row.corners[k].own) { R.row.corners[k].own = true; T(`${gd.callsign}'s muzzle on his corner ${k + 1}`); } } } }
        if (!isNaN(R.downAt) && (!owed || C.i !== R.downK)) { R.row.collapse.push(null); R.downAt = NaN; }   // (the corner he owed when his man dropped went by another way)
        if (!isNaN(R.downAt) && Math.abs(wrap(gd.char.aimYaw - yawTo(gd.char.pos, R.pts[R.downK]))) < K.cornerRad) { R.row.collapse.push(+(t - R.downAt).toFixed(2)); T(`${gd.callsign} on his corner ${(t - R.downAt).toFixed(2)} s after his man dropped`); R.downAt = NaN; }
        while (R.i < C.i && R.i < R.pts.length) { const c = R.row.corners[R.i]; c.how = c.own ? 'looked' : flat(gd.char.pos, R.pts[R.i]) < 1.1 ? 'reached' : 'gave up'; T(`${gd.callsign} corner ${R.i + 1}: ${c.how}`); R.i++; } } }
    for (const e of g.events) { if (seenEv.has(e)) continue; seenEv.add(e);
      if (e.kind === 'guardShot') { const w = team.find(x => x.char.id === e.who); if (w) { let L = shots.get(w); if (!L) shots.set(w, L = []); L.push(t); } if (verbose) { const s = g.guards.find((x: any) => x.char.id === e.who); if (s) T(`${s.callsign} fires`); } } }
    for (const x of g.guards) { const st = was.get(x); if (st !== 'dead' && x.state === 'dead') { T(`DOWN ${x.callsign} (${x.team})`); if (men.includes(x)) lastDown = t - t0;
        if (x.team === 'hostile') for (const R of recs.values()) if (R.gd.char.id === x.killerId && R.gd.state !== 'dead' && R.i < R.pts.length && isNaN(R.downAt)) { R.downAt = t; R.downK = R.i; } }
      was.set(x, x.state); }
  };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { step(); watch(); } };
  const target = O.targetAt(d.frameCentre);
  if (X.tool === 'thr') { const r = D.order('threshold', team, d, O.big ? O.sideFor(d, team, target.side) : target.side); if (typeof r === 'string') { out.note = `refused: ${r}`; return out; } }
  else { const why = O.give(X.tool === 'bang' ? 'bangClear' : 'openClear', target, 'all'); if (why) { out.note = `refused: ${why}`; return out; } }
  const alive = () => team.some(x => x.state !== 'dead'), roomUp = () => men.some(x => x.state !== 'dead');
  let idle = 0;
  for (let i = 0; i < 60 * 60 && alive() && (roomUp() || D.ops.length); i++) { tick(); if (!D.ops.length) { if (++idle > 60 * 8) break; } else idle = 0; }
  tick(60 * 2);
  for (const R of recs.values()) { if (!isNaN(R.downAt)) R.row.collapse.push(null); const g0 = goT.get(R.op) ?? R.tx, g1 = R.tx + K.cornerCap * R.pts.length;
    R.row.fired = (shots.get(R.gd) ?? []).some(x => x >= g0 - DT && x <= g1); out.men.push(R.row); }
  out.lost = team.filter(x => x.state === 'dead').length; out.down = men.filter(x => x.state === 'dead').length; out.secs = out.down === out.of && alive() ? lastDown : NaN;
  out.held = (out.down === out.of && alive()) || (alive() && !D.ops.length && !men.some(x => x.state !== 'dead' && g.fight.roomAt(x.char.pos) === room));
  if (verbose) { console.log(`${X.scn} · ${X.door} · ${X.tool} · seed ${X.seed} · ${X.arm}`); for (const l of log) console.log(l); for (const op of [...D.done, ...D.ops]) for (const b of op.beats ?? []) if (/^first:/.test(b.what)) console.log(`   beat ${b.what}`); }
  return out;
}

// ───────────────────────────────────────────────────────────── the counts ─────────────────────────────────────────────────────────────
export interface Tally {
  runs: number; lost: number; team: number; down: number; of: number; held: number;
  entries: number; fought: number; fired: number; fell: number;
  /** `fought`: men the room fight had on a man with a corner owed (in the old entry that includes the half second on a dead man's spot) · `fired`: men who
   *  FIRED ON THE WAY IN — the men counted. Their corners (those who lived): dealt · the corner step gave up with no muzzle of his on it and him not there ·
   *  never his muzzle by the end · never anybody's */
  fc: number; fGave: number; fNotOwn: number; fNotAny: number;
  /** the same for the men who did not fire */
  qc: number; qGave: number; qNotOwn: number; qNotAny: number;
  collapse: number[]; collapseNever: number;
  leads: number; less: number; lessButThrew: number; notLead: number; firstN: number; bestN: number;
}
export function tally(rs: Out[]): Tally {
  const T: Tally = { runs: 0, lost: 0, team: 0, down: 0, of: 0, held: 0, entries: 0, fought: 0, fired: 0, fell: 0, fc: 0, fGave: 0, fNotOwn: 0, fNotAny: 0, qc: 0, qGave: 0, qNotOwn: 0, qNotAny: 0, collapse: [], collapseNever: 0, leads: 0, less: 0, lessButThrew: 0, notLead: 0, firstN: 0, bestN: 0 };
  for (const r of rs) { if (r.note) continue; T.runs++; T.lost += r.lost; T.team += r.team; T.down += r.down; T.of += r.of; if (r.held) T.held++;
    for (const m of r.men) { T.entries++; if (m.died) { T.fell++; continue; }
      for (const c of m.collapse) if (c === null) T.collapseNever++; else T.collapse.push(c);
      if (m.fought) T.fought++; if (m.fired) T.fired++;
      for (const c of m.corners) { const gave = c.how === 'gave up' || (c.how === 'pending' && !c.own), notOwn = !c.own && c.how !== 'reached', notAny = !c.any && c.how !== 'reached';
        if (m.fired) { T.fc++; if (gave) T.fGave++; if (notOwn) T.fNotOwn++; if (notAny) T.fNotAny++; } else { T.qc++; if (gave) T.qGave++; if (notOwn) T.qNotOwn++; if (notAny) T.qNotAny++; } } }
    if (r.lead) { T.leads++; if (r.lead.less) T.less++; if (r.lead.lessButThrew) T.lessButThrew++; if (r.lead.first !== r.lead.lead) T.notLead++; T.firstN += r.lead.firstN; T.bestN += r.lead.bestN; } }
  return T;
}
const med = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const pct = (n: number, dn: number) => (dn ? `${Math.round(100 * n / dn)} %` : '—');
export function cornerLine(T: Tally): string { return `${T.fired} of ${T.entries} men through the frame fired on the way in (${T.fought} had a gun on a man with a corner owed; ${T.fell} more fell first) · of their ${T.fc} corners: ${T.fGave} given up unlooked, ${T.fNotOwn} never under his own muzzle, ${T.fNotAny} never under anybody's · the men who did not fire: ${T.qGave} of ${T.qc} given up, ${T.qNotOwn} never his own, ${T.qNotAny} never anybody's · man down to muzzle on the corner: median ${f2(med(T.collapse))} s over ${T.collapse.length} (${T.collapseNever} never got there)`; }
export function leadLine(T: Tally): string { return `${T.leads} entries · ${T.less} led by a man who had seen ${Math.max(1, DTM.DOORTOOLS.leadSeenMin)}+ cells less of the room than another man at the frame (${T.lessButThrew} more where the one who had seen more had just thrown the can) · ${T.notLead} led by somebody other than the lead · the first man had seen ${T.leads ? (T.firstN / T.leads).toFixed(1) : '—'} cells on average, the best-placed man at the frame ${T.leads ? (T.bestN / T.leads).toFixed(1) : '—'}`; }
function report(rs: Out[], md: boolean): string[] {
  const tools = [...new Set(rs.map(r => r.tool))], arms = [...new Set(rs.map(r => r.arm))].sort((a, b) => (a === 'before' ? -1 : 1) - (b === 'before' ? -1 : 1));
  const table = (h: string[], b: string[][]) => md ? [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`, ...b.map(r => `| ${r.join(' | ')} |`)] : (() => { const w = h.map((x, i) => Math.max(x.length, ...b.map(r => r[i].length))); return [h, ...b].map(r => r.map((c, i) => c.padEnd(w[i])).join('  ')); })();
  const groups: [string, (r: Out) => boolean][] = [...tools.map(t => [t === 'open' ? 'open and clear' : t === 'bang' ? 'bang and clear' : 'threshold, then step in', (r: Out) => r.tool === t] as [string, (r: Out) => boolean]), ['all', () => true]];
  const A: string[][] = [], B: string[][] = [], C: string[][] = [];
  for (const [name, f] of groups) for (const arm of arms) { const T = tally(rs.filter(r => f(r) && r.arm === arm)); if (!T.runs) continue;
    A.push([name, arm, String(T.runs), `${T.fired} of ${T.entries}`, String(T.fc), `${T.fGave} (${pct(T.fGave, T.fc)})`, `${T.fNotOwn} (${pct(T.fNotOwn, T.fc)})`, `${T.fNotAny} (${pct(T.fNotAny, T.fc)})`, `${T.qGave} of ${T.qc}`, `${T.qNotOwn} of ${T.qc}`, `${f2(med(T.collapse))} (${T.collapse.length}; ${T.collapseNever} never)`]);
    B.push([name, arm, String(T.leads), String(T.less), String(T.lessButThrew), String(T.notLead), T.leads ? (T.firstN / T.leads).toFixed(1) : '—', T.leads ? (T.bestN / T.leads).toFixed(1) : '—']);
    C.push([name, arm, String(T.runs), `${T.lost}/${T.team}`, `${T.down}/${T.of}`, `${T.held}/${T.runs}`]); }
  const skipped = rs.filter(r => r.note).length;
  return ['CORNERS', ...table(['tool', 'arm', 'runs', 'men who fired on the way in', 'their corners', 'given up unlooked', 'never under his own muzzle', "never under anybody's", 'the other men: given up', 'the other men: never his own', 'man down → muzzle on corner, median s (n)'], A), '',
    'WHO GOES FIRST', ...table(['tool', 'arm', 'entries', `led by a man who had seen ${Math.max(1, DTM.DOORTOOLS.leadSeenMin)}+ cells less than another at the frame`, 'the same, where that other had just thrown the can', 'led by other than the lead', 'cells seen, first man (mean)', 'cells seen, best man at the frame (mean)'], B), '',
    'THE ROOMS', ...table(['tool', 'arm', 'runs', 'team lost', "room's men down", 'room taken or emptied'], C), ...(skipped ? ['', `(${skipped} runs not counted: no defender dealt to the room on that seed, no floor outside the door, a man lost before the order, or the order refused)`] : [])];
}

// ───────────────────────────────────────────────────────────── the gate's two verdicts ─────────────────────────────────────────────────────────────
// A fixed handful of doors, both arms, in this process (~2 minutes): enough that the old entry shows what it gave up and the rule can be seen to act. The full
// count is the command line's.
const GATE: [string, Tool][] = [['night-breach', 'open'], ['room-clear-four', 'open'], ['depot-four', 'open'], ['records-pair', 'thr'], ['room-clear-four', 'thr'], ['depot-four', 'thr']];
let gateRuns: Out[] | null = null;
async function gate(): Promise<Out[]> {
  if (gateRuns) return gateRuns; const rs: Out[] = [];
  const seeds = (process.env.CORNERLEAD_SEEDS ?? '1,2').split(',').map(Number);
  for (const [scn, tool] of GATE) { const ds = (await quiet(true, () => discover(scn))).slice(0, 2);
    for (const x of ds) for (const seed of seeds) for (const arm of ['before', 'after'] as Arm[]) { try { rs.push(await run({ scn, door: x.door, room: x.room, tool, seed, arm })); } catch (e) { rs.push({ scn, door: x.door, room: x.room, tool, seed, arm, note: `threw ${e instanceof Error ? e.message : e}`, men: [], lead: null, lost: 0, team: 0, down: 0, of: 0, held: false, secs: NaN }); } } }
  setKnobs({}); return gateRuns = rs;
}
function family(title: string) { console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } }; }
export async function cornerleadCorners(): Promise<boolean> {
  const F = family('cornerlead-corners: a man who shoots a mid-room threat still finishes his corners');
  try { const rs = await gate(), threw = rs.filter(r => /^threw/.test(r.note)); const B = tally(rs.filter(r => r.arm === 'before')), A = tally(rs.filter(r => r.arm === 'after'));
    F.verdict(!threw.length && A.runs > 0 && B.runs > 0, 'the stagings ran', `${B.runs} runs before, ${A.runs} after${threw.length ? ` · ${threw.length} threw: ${threw[0].note}` : ''}`);
    F.verdict(B.fired > 0 && A.fired > 0 && B.fGave > 0, 'not vacuous: men shot on the way in, and as it was some of their corners went unlooked', `before ${B.fired} of ${B.entries} men through the frame fired (${B.fGave} of their ${B.fc} corners given up), after ${A.fired} of ${A.entries}`);
    F.verdict(A.fGave * B.fc < B.fGave * A.fc || A.fGave === 0, 'fewer of their corners are given up unlooked', `BEFORE (cornerOwed, collapse off) — ${cornerLine(B)}\n    AFTER (as shipped) — ${cornerLine(A)}`);
    F.verdict(A.fNotOwn * B.fc <= B.fNotOwn * A.fc, "and no more of them end the entry never having had his own muzzle on them", `before ${B.fNotOwn} of ${B.fc} (${pct(B.fNotOwn, B.fc)}), after ${A.fNotOwn} of ${A.fc} (${pct(A.fNotOwn, A.fc)})`);
  } catch (e) { F.verdict(false, 'the probe threw', e instanceof Error ? e.stack ?? e.message : String(e)); }
  return F.done();
}
export async function cornerleadLead(): Promise<boolean> {
  const F = family('cornerlead-lead: the man who has seen most of the room goes in first');
  try { const rs = await gate(); const B = tally(rs.filter(r => r.arm === 'before')), A = tally(rs.filter(r => r.arm === 'after'));
    F.verdict(B.leads > 0 && A.leads > 0, 'entries were counted', `before ${B.leads}, after ${A.leads}`);
    F.verdict(B.less > 0, 'not vacuous: as it was, entries are led by a man who had seen less of the room than another at the frame', `BEFORE (leadSeen off) — ${leadLine(B)}`);
    F.verdict(A.less === 0, 'with the rule, none is', `AFTER (as shipped) — ${leadLine(A)}`);
    F.verdict(B.notLead === 0, 'and with it off the lead is first, as he was', `before: ${B.notLead} of ${B.leads} entries led by somebody else · after: ${A.notLead} of ${A.leads}`);
  } catch (e) { F.verdict(false, 'the probe threw', e instanceof Error ? e.stack ?? e.message : String(e)); }
  return F.done();
}

// ───────────────────────────────────────────────────────────── the command line ─────────────────────────────────────────────────────────────
function parseSeeds(s: string): number[] { const out: number[] = []; for (const part of s.split(',')) { const m = part.match(/^(\d+)-(\d+)$/); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else if (/^\d+$/.test(part)) out.push(+part); else throw new Error(`bad seeds '${s}'`); } return out; }
if (import.meta.main) {
  const argv = process.argv.slice(2); const mode = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'run';
  const flag = (k: string) => { const i = argv.indexOf(`--${k}`); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const bool = (k: string) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
  try {
    if (mode === 'worker') { const specs: Spec[] = JSON.parse(readFileSync(argv[0], 'utf8'));
      for (const X of specs) { let r: Out; try { r = await run(X); } catch (e) { r = { ...X, note: `threw ${e instanceof Error ? e.message : e}`, men: [], lead: null, lost: 0, team: 0, down: 0, of: 0, held: false, secs: NaN }; } process.stdout.write(`@@${JSON.stringify(r)}\n`); } process.exit(0); }
    if (mode === 'trace') { const [scn, door, tool, seed, arm, room] = argv[0].split(':'); const ds = (await discover(scn)).filter(x => x.door === door && (!room || x.room === room));
      if (!ds.length) throw new Error(`no such door in ${scn}: ${(await discover(scn)).map(x => x.door).join(', ')}`);
      const r = await run({ scn, door, room: ds[0].room, tool: tool as Tool, seed: +seed, arm: (arm ?? 'after') as Arm }, true); console.log(JSON.stringify(r)); process.exit(0); }
    const seeds = parseSeeds(flag('seeds') ?? '1-4'), jobs = +(flag('jobs') ?? 3), md = bool('md'), json = flag('json');
    const only = flag('scn')?.split(','), tools = (flag('tools') ?? 'open,bang,thr').split(',') as Tool[], arms = (flag('arms') ?? 'before,after').split(',') as Arm[];
    if (argv.length) throw new Error(`unknown flag ${argv.join(' ')} (have --seeds --jobs --scn --tools --arms --json --md)`);
    const specs: Spec[] = [];
    for (const E of SCENARIOS as any[]) { if (only && !only.includes(E.id)) continue;
      for (const x of await discover(E.id)) for (const tool of tools) for (const seed of seeds) for (const arm of arms) specs.push({ scn: E.id, door: x.door, room: x.room, tool, seed, arm }); }
    console.error(`cornerlead: ${specs.length} runs over ${jobs} jobs…`);
    const chunks: Spec[][] = Array.from({ length: jobs }, () => []); specs.forEach((s, i) => chunks[i % jobs].push(s));
    const tmp = process.env.TMPDIR ?? '/tmp'; const results: Out[] = [];
    await Promise.all(chunks.map(async (chunk, i) => { if (!chunk.length) return; const file = `${tmp}/cornerlead-${process.pid}-${i}.json`; writeFileSync(file, JSON.stringify(chunk));
      const p = Bun.spawn(['bun', 'run', import.meta.path, 'worker', file], { stdout: 'pipe', stderr: 'ignore' });
      const text = await new Response(p.stdout).text(); await p.exited;
      for (const line of text.split('\n')) if (line.startsWith('@@')) results.push(JSON.parse(line.slice(2))); }));
    if (results.length !== specs.length) console.error(`cornerlead: ${specs.length - results.length} runs gave no result (a worker died)`);
    if (json) writeFileSync(json, JSON.stringify({ seeds, results }, null, 1));
    for (const l of report(results, md)) console.log(l);
    process.exit(results.length === specs.length ? 0 : 1);
  } catch (e) { console.error(e instanceof Error ? e.stack ?? e.message : String(e)); process.exit(2); }
}
