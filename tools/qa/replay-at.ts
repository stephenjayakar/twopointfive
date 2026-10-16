// A SAVED REPLAY, READ AT ITS NOTES (src/replay/format.ts — F7 on the game page, notes put on it in /replay):
//   bun run tools/qa/replay-at.ts <replay.json[.gz]> [--note N | --at SECONDS [--spot x,z]] [--before 8] [--after 3] [--near 12] [--who NAME] [--all]
//                                                     [--rerun [--run SECONDS] [--eval probe.ts] [--force]]
// With no --note / --at: the file's head and every note. For each chosen moment: who stood near the spot and what each was doing (state, order, errand, the mark
// he was going to, the route ahead of him), how that CHANGED through the seconds before and after, what was fired / thrown / said in that window, and the smells a
// routing bug leaves in a trace (a route and no movement, a route many times the straight line, the mark changing again and again). Reads the file and nothing
// else — no game is stood up, so it reads a replay saved on any build.
// --rerun (with --note N or --at): a headless game is WALKED THROUGH THE SAME RUN to that moment off the replay's run tape (tools/qa/rerun.ts) and what each man near
// the spot is doing is read off the LIVE game (his state, order, script, errand, the mark and the route the code has for him NOW — on this checkout's code). The first
// line is how closely the walk matched the page (held against the trace on every sample it passed). --run S walks on S seconds more on the taped input and lists
// what changed; --eval probe.ts imports that module and calls its default export with { W, game, F, D, moment, report } at the moment (a thread's own questions).
// EXIT 0 read · 2 not a replay · 3 --rerun refused (no tape, another level: the words say which and what to check out) · 4 the re-run parted from the page.
import { readFileSync } from 'node:fs';
import type { ReplayFile, ManAt, ManDo } from '../../src/replay/format.ts';
import { checkReplay, decode, sampleAt, clock, doWords, errorMarks } from '../../src/replay/format.ts';
import { markJumped, orderId, STUCK_OFF, toGo, stoppedByOther, meansToWait } from './replay-dump.ts';

const argv = process.argv.slice(2), path = argv.find(a => !a.startsWith('--') && !/^-?[\d.,]+$/.test(a));
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
if (!path) { console.log('usage: bun run tools/qa/replay-at.ts <replay.json[.gz]> [--note N | --at SECONDS [--spot x,z]] [--before 8] [--after 3] [--near 12] [--who NAME] [--all]'); process.exit(2); }
let F: ReplayFile;
try { const raw = readFileSync(path); F = JSON.parse(raw[0] === 0x1f && raw[1] === 0x8b ? new TextDecoder().decode(Bun.gunzipSync(raw)) : raw.toString('utf8')); }
catch (e) { console.log(`${path}: could not be read — ${(e as Error).message}`); process.exit(2); }
{ const bad = checkReplay(F); if (bad) { console.log(`${path}: ${bad}`); process.exit(2); } }
const D = decode(F), before = Number(val('before') ?? 8), after = Number(val('after') ?? 3), near = Number(val('near') ?? 12), who = val('who')?.toLowerCase(), all = argv.includes('--all');
const pt = (p: [number, number] | number[] | undefined | null) => p ? `(${(+p[0]).toFixed(1)}, ${(+p[1]).toFixed(1)})` : '–';

// ---- the head
const fl = F.flags ?? {}, flags = [fl.godMode && 'GOD MODE ON', fl.aiEnabled === false && 'AI OFF', fl.infiniteAmmo && 'unlimited ammo', fl.playerInvisible && 'invisible'].filter(Boolean);
console.log(`\n=== replay: ${F.level.scenario || F.level.file || 'the night'} · ${clock(F.seconds)} of play · saved ${F.savedAt} (${F.why}) ===`);
console.log(`build ${F.commit ?? '?'} · page ${F.url ?? '?'} · level ${F.level.fp ?? '?'} (${F.level.boxes} boxes) · ${F.cast.length} cast · ${F.samples.length} samples at ${F.hz} Hz · ${F.events.length} events · ${F.lines.length} lines`);
for (const e of errorMarks(F)) console.log(`PAGE ERROR at ${clock(e.r)}: ${e.text}   (--at ${e.r.toFixed(1)} looks at that moment)`);
if (flags.length) console.log(`SANDBOX: ${flags.join(' · ')}   (read what the men did to him with that in mind)`);
console.log(`cast: ${F.cast.map(c => `${c.name}[${c.kind === 'player' ? 'player' : c.team}${c.pair ? ` ${c.pair}` : ''}]`).join(' ')}`);
if (!F.notes.length) console.log('notes: none'); else { console.log('notes:'); F.notes.forEach((n, i) => console.log(`  #${i + 1}  ${clock(n.r)}  ${n.pos ? pt(n.pos) : 'no spot'}  ${JSON.stringify(n.text)}`)); }

// ---- the moments asked for
interface Moment { label: string; r: number; pos: [number, number] | null; text: string; }
const moments: Moment[] = [];
if (val('at') !== undefined) { const sp = val('spot')?.split(',').map(Number); moments.push({ label: `at ${clock(Number(val('at')))}`, r: Number(val('at')), pos: sp && sp.length === 2 && sp.every(Number.isFinite) ? [sp[0], sp[1]] : null, text: '' }); }
else { const pick = val('note'); F.notes.forEach((n, i) => { if (pick === undefined || Number(pick) === i + 1) moments.push({ label: `note #${i + 1}`, r: n.r, pos: n.pos, text: n.text }); }); }

/** the fields of a man's doing whose change is worth a line */
const gist = (d: ManDo) => [d.st ?? '', d.down ?? '', d.ord ?? '', d.by ?? '', d.task ?? '', d.goal ? pt(d.goal) : '', d.foe ?? '', d.crouch ? 'c' : ''].join('|');
const routeLen = (m: ManAt) => { let len = 0, x = m.x, z = m.z; for (const p of m.do.path ?? []) { len += Math.hypot(p[0] - x, p[1] - z); x = p[0]; z = p[1]; } return len; };

for (const M of moments) {
  const r = Math.min(D.r[D.r.length - 1], Math.max(0, M.r)), s = sampleAt(D, r), q = F.samples[s], s0 = sampleAt(D, r - before), s1 = sampleAt(D, r + after);
  console.log(`\n--- ${M.label}: ${clock(r)} into the replay (game clock ${clock(q.t)}, step ${q.n})${M.pos ? ` at ${pt(M.pos)}` : ''}${M.text ? ` — ${JSON.stringify(M.text)}` : ''} ---`);
  const cam = D.cam[s]; if (cam) console.log(`his camera: looking at ${pt(cam)} turned ${Math.round(cam[2])}°, ${cam[3].toFixed(1)} m out${D.aim[s] ? ` · reticle on ${pt(D.aim[s])}` : ''}`);
  // who is in the picture: by distance to the spot (to Sam with no spot)
  const samNow = D.men[s].findIndex((m, ci) => !!m && F.cast[ci].kind === 'player'), sam = samNow >= 0 ? samNow : F.cast.map(c => c.kind).lastIndexOf('player'), centre: [number, number] | null = M.pos ?? (sam >= 0 && D.men[s][sam] ? [D.men[s][sam]!.x, D.men[s][sam]!.z] : null);
  const rows = D.men[s].map((m, ci) => ({ ci, m, d: m && centre ? Math.hypot(m.x - centre[0], m.z - centre[1]) : 0 })).filter(x => x.m) as { ci: number; m: ManAt; d: number }[];
  rows.sort((a, b) => a.d - b.d);
  const shown = rows.filter(x => who ? F.cast[x.ci].name.toLowerCase().includes(who) : all || x.d <= near || x.ci === sam);
  console.log(`${shown.length} of ${rows.length} men ${who ? `named '${who}'` : all ? '' : `within ${near} m of ${M.pos ? 'the spot' : 'the player'}`}:`);
  for (const { ci, m, d } of shown) {
    const c = F.cast[ci];
    console.log(`\n  ${c.name} [${c.kind === 'player' ? 'player' : c.team}${c.pair ? ` ${c.pair}` : ''}${c.weapon ? ` ${c.weapon}` : ''}]  ${d.toFixed(1)} m off  at ${pt([m.x, m.z])} facing ${Math.round(m.yaw)}° gun ${Math.round(m.aim)}°  ${c.kind === 'player' ? 'lit' : 'aware'} ${m.aw}%`);
    console.log(`    doing: ${doWords({ ...m.do, path: undefined }, F.cast) || '–'}`);
    if (m.do.path?.length) console.log(`    route: ${m.do.path.length} points, ${routeLen(m).toFixed(1)} m → ${m.do.path.slice(0, 10).map(pt).join(' ')}${m.do.path.length > 10 ? ' …' : ''}`);
    // ---- how it changed through the window, and where his feet went
    // (STILL WITH A ROUTE = somewhere still to go and no movement. A man standing ON his mark keeps a one-point route to his own cell: he is waiting, not
    //  stuck — replay-dump.ts's rule, said once there: under STUCK_OFF of where his feet are going he has arrived; nor is a man somebody else has stopped
    //  (held for a talk or a wait, in Sam's arm, planted on a post). A man who SAID why he stands, or whose order's own row reads a wait, means to: the
    //  line says WAITED and quotes him — the dump reader's 'waited' row, by the same test.)
    const said: string[] = [], ords: string[] = []; let stillSaid: string[] = [], stillOrds: string[] = [];
    let last = '', moved = 0, px = NaN, pz = NaN, still = 0, stillGap = 0, stillMax = 0, stillAt = 0, stillOff = 0, goals = 0, lastGoal: [number, number] | null = null, lastOrd = ''; const changes: string[] = [], seen: { r: number; g: [number, number] }[] = [];
    for (let i = s0; i <= s1; i++) {
      const a = D.men[i][ci]; if (!a) { if (last !== 'gone') { changes.push(`${clock(D.r[i])}  not on the floor`); last = 'gone'; } continue; }
      const g = gist(a.do); if (g !== last) { changes.push(`${clock(D.r[i])}  ${pt([a.x, a.z])}  ${doWords({ ...a.do, path: undefined, say: undefined, fix: undefined }, F.cast) || '–'}${a.do.path?.length ? `  [route ${a.do.path.length} pts ${routeLen(a).toFixed(1)} m]` : ''}`); last = g; }
      // (a mark that CHANGES = replay-dump.ts's own test: it jumps aside or back to a place it had, never one walk dealt its next corner — and never under
      //  'fall in', whose place follows the player by design)
      const gl = a.do.goal ?? null;
      const ord = orderId(a.do.ord), fresh = ord !== lastOrd; lastOrd = ord;   // (a new order's first mark is no change of mind)
      if (fresh || ord === 'fallIn') { seen.length = 0; lastGoal = gl; } else if (gl && !lastGoal) lastGoal = gl; else if (gl && lastGoal && (gl[0] !== lastGoal[0] || gl[1] !== lastGoal[1])) {
        while (seen.length && seen[0].r < D.r[i] - 10) seen.shift();
        if (markJumped([a.x, a.z], lastGoal, gl, seen.map(x => x.g))) goals++; seen.push({ r: D.r[i], g: lastGoal }); lastGoal = gl; }
      if (!Number.isNaN(px)) { const step = Math.hypot(a.x - px, a.z - pz), dt = D.r[i] - D.r[i - 1]; moved += step;
        if (toGo(a) > STUCK_OFF && !stoppedByOther(a.do) && a.do.st !== 'dead' && a.do.st !== 'down' && step < 0.02 * Math.max(1, dt * F.hz)) {
          if (!still) { stillGap = toGo(a); said.length = 0; ords.length = 0; }
          still += dt; if (a.do.say && !said.includes(a.do.say)) said.push(a.do.say); if (a.do.ord && !ords.includes(a.do.ord)) ords.push(a.do.ord);
          if (still >= stillMax) { stillMax = still; stillAt = D.r[i]; stillOff = stillGap; stillSaid = [...said]; stillOrds = [...ords]; }
        } else still = 0; }
      px = a.x; pz = a.z;
    }
    console.log(`    ${clock(D.r[s0])} → ${clock(D.r[s1])}: walked ${moved.toFixed(1)} m, ${changes.length} change${changes.length === 1 ? '' : 's'} of what he was doing`);
    for (const ln of changes.slice(0, 40)) console.log(`      ${ln}`); if (changes.length > 40) console.log(`      … ${changes.length - 40} more`);
    // ---- the smells
    const straight = m.do.goal ? Math.hypot(m.do.goal[0] - m.x, m.do.goal[1] - m.z) : 0, len = routeLen(m);
    if (stillMax >= 1.5) console.log(`    ${meansToWait(stillSaid, stillOrds) ? 'WAITED (he said why, or his order reads a wait)' : 'SMELL'}: held a route with ${stillOff.toFixed(1)} m still to go and did not move for ${stillMax.toFixed(1)} s (until ${clock(stillAt)})${stillSaid.length ? ` · he said ${stillSaid.slice(0, 3).map(t => JSON.stringify(t)).join(', ')}` : ''}`);
    if (m.do.path?.length && straight > 1.5 && len > 2.5 * straight) console.log(`    SMELL: the route is ${len.toFixed(1)} m for a mark ${straight.toFixed(1)} m off (${(len / straight).toFixed(1)}× the straight line)`);
    if (goals >= 5) console.log(`    SMELL: the mark he was going to changed ${goals} times in ${(D.r[s1] - D.r[s0]).toFixed(0)} s`);
    if (c.kind !== 'player' && m.do.goal && !m.do.path?.length && straight > 1 && m.do.st !== 'dead' && m.do.st !== 'down') console.log(`    SMELL: a mark ${straight.toFixed(1)} m off and no route to it`);
  }
  // ---- what happened in the window
  const evs = F.events.filter(e => e.r >= D.r[s0] && e.r <= D.r[s1]), lines = F.lines.filter(l => l.r >= D.r[s0] && l.r <= D.r[s1]);
  console.log(`\n  in the window ${clock(D.r[s0])} → ${clock(D.r[s1])}: ${evs.length} events, ${lines.length} lines`);
  const merged = [...evs.map(e => ({ r: e.r, text: `${e.k}${e.w ? ` (${e.w})` : ''} by ${e.who >= 0 ? F.cast[e.who]?.name ?? '?' : '–'} at ${pt([e.x, e.z])}${e.to ? ` → ${pt(e.to)}` : ''}${e.loud !== undefined ? ` loud ${e.loud}` : ''}` })), ...lines.map(l => ({ r: l.r, text: `${l.k}: ${l.text}` }))].sort((a, b) => a.r - b.r);
  for (const ln of merged.slice(0, 80)) console.log(`    ${clock(ln.r)}  ${ln.text}`); if (merged.length > 80) console.log(`    … ${merged.length - 80} more`);
  // ---- doors that were moving or open near the spot
  if (centre) { const dn = F.map.doors.map((d, i) => ({ d, i, st: D.doors[s][i] })).filter(x => x.st && Math.hypot(x.d.hinge[0] - centre[0], x.d.hinge[1] - centre[1]) <= near);
    if (dn.length) console.log(`  doors within ${near} m: ${dn.map(x => `${x.d.name} ${x.st.bits & 8 ? 'gone' : Math.abs(x.st.ang) < 2 ? 'shut' : `open ${Math.round(x.st.ang)}°`}${x.st.bits & 2 ? ' locked' : ''}${x.st.bits & 4 ? ' lock broken' : ''}`).join(' · ')}`); }
}
if (!moments.length && (val('note') !== undefined)) console.log(`\nno note #${val('note')} in this file`);

// ---- the re-run: a live game at the moment
let code = 0;
if (argv.includes('--rerun')) {
  const M = moments[0];
  if (!M) { console.log('\n--rerun wants a moment: --note N or --at SECONDS'); process.exit(2); }
  const { rerun, rerunWords } = await import('./rerun.ts');
  const r = Math.min(D.r[D.r.length - 1], Math.max(0, M.r)), s = sampleAt(D, r), n = F.samples[s].n, runSecs = Number(val('run') ?? 0);
  console.log(`\n=== re-run to ${M.label} (${clock(r)}, step ${n})${runSecs ? ` and ${runSecs} s on` : ''} ===`);
  const live = (g: any, gd: any): string => { const a = g.orders?.of?.(gd), sc = gd.script, goal = gd.pathGoal ?? sc?.goal;
    return [gd.state, gd.downKind, a ? `order ${a.order}: ${a.arrived ? a.there : a.going}` : '', sc ? `script${sc.phase ? ` ${sc.phase}` : ''}` : '', gd.task ? `errand ${gd.task.kind ?? gd.task}` : '', gd.hold ? 'held' : '', gd.pinned ? 'pinned' : '',
      goal ? `going to ${pt([goal[0], goal[2]])}` : '', gd.path?.length > gd.pathI ? `route ${gd.path.length - gd.pathI} pts` : 'no route'].filter(Boolean).join(' · '); };
  const centreOf = (g: any): [number, number] => M.pos ?? [g.player.char.pos[0], g.player.char.pos[2]];
  const nearMen = (g: any) => [...g.guards, ...g.civilians].filter((gd: any) => who ? String(gd.callsign).toLowerCase().includes(who) : all || Math.hypot(gd.char.pos[0] - centreOf(g)[0], gd.char.pos[2] - centreOf(g)[1]) <= near);
  const lastLine = new Map<any, string>(), changes: string[] = []; let dumped = false, at: any = null;
  const R = await rerun(F, { toN: n + Math.round(runSecs * 60), force: argv.includes('--force'), each: (W, f) => {
    if (f + 1 < n) return; const g = W.game;
    if (!dumped) { dumped = true; at = { time: g.time, men: nearMen(g).map((gd: any) => { const ln = live(g, gd); lastLine.set(gd, ln); return `  ${gd.callsign} [${gd.team}] at ${pt([gd.char.pos[0], gd.char.pos[2]])}  ${ln}${gd.path?.length > gd.pathI ? `\n      route: ${gd.path.slice(gd.pathI, gd.pathI + 10).map((p: number[]) => pt([p[0], p[2]])).join(' ')}` : ''}`; }), sam: `  Sam at ${pt([g.player.char.pos[0], g.player.char.pos[2]])}${g.player.down ? ' DOWN' : ''}${g.godMode ? ' (god mode)' : ''}` }; return; }
    for (const gd of nearMen(g)) { const ln = live(g, gd); if (ln !== lastLine.get(gd)) { lastLine.set(gd, ln); changes.push(`  +${((f + 1 - n) / 60).toFixed(2)} s  ${gd.callsign} at ${pt([gd.char.pos[0], gd.char.pos[2]])}  ${ln}`); } }
  } });
  if (R.refuse || !R.report || !R.W) { console.log(`REFUSED: ${R.refuse}`); process.exit(3); }
  for (const ln of rerunWords(R.report, F)) console.log(ln);
  if (R.report.drift) code = 4;
  if (at) { console.log(`\nthe live game at the moment (game clock ${clock(at.time)}) — ${at.men.length} men ${who ? `named '${who}'` : all ? '' : `within ${near} m`}:`); console.log(at.sam); for (const ln of at.men) console.log(ln); }
  if (runSecs) { console.log(`\nwalked on ${runSecs} s on the taped input — ${changes.length} change${changes.length === 1 ? '' : 's'}:`); for (const ln of changes.slice(0, 120)) console.log(ln); if (changes.length > 120) console.log(`  … ${changes.length - 120} more`); }
  const ev = val('eval'); if (ev) { const mod = await import(ev.startsWith('/') ? ev : `${process.cwd()}/${ev}`); await mod.default({ W: R.W, game: R.W.game, F, D, moment: M, report: R.report }); }
}
console.log('');
process.exit(code);
