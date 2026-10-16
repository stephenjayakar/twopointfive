// THE BARRACKS' THREE FAULTS, counted off run files — the checks for rebuild/missions/faults.md B1 (fixed), B2 (named, not fixed) and B3 (its rule ships off).
//   B1  a stack or an entry on a door is REFUSED 'no room on that door' (the mess hall's north door h_n fills the end of a 2.3 m gallery: one jamb for one
//       man, no wall to file along; three or four men had no marks, so the order and its door tools were refused and the team went round by another door)
//   B2  the north wing's end room: a man left standing IN THE n4b DOORWAY (a point of domination of the gallery entry by n_end fell on its threshold), and,
//       inside the day room, a man on his point with a MATE DOWN HIS MUZZLE (n4b stands 0.9 m off the room's east wall: no floor to that hand of it, so two of
//       the four points fall one behind the other down the line of the door)
//   B3  the way in behind the first door: the player, walking in behind the squad through s34, is STOPPED BY A TEAMMATE whose point is in the opening
//   bun run tools/qa/barracks-check.ts [--fault B1|B2|B3|all] [--seeds 1-6] [--hour midday] [--set '{"ORDERS":{"hallFile":false}}'] [--cap 420] [--jobs 4]
//                                      [--static] [--root <checkout>]
//   bun run tools/qa/barracks-check.ts [--fault …] --from a.json[,b.json]      count run files already played (tools/qa/ships.ts --scn barracks-four --json)
// What it does: plays the barracks' four against eleven as the page ships it (tools/qa/ships.ts) for --seeds, or reads --from, and counts each fault's rows in
// the runs' `refused` and `smells` (tools/qa/playthrough.ts's watcher). Where a door or a room stands is read from levels/barracks.json, not typed here.
// FIRST, whatever else is asked, THE MARKS THEMSELVES (a few seconds, no run): the staged level is asked what the squad's own rules deal —
//   B1  every door across a gallery, both faces: marks for three and for four men to stack on (orders.ts stackPosts) — a mark for each man, each on
//       floor, no two within 0.65 m
//   B2  the four points of an entry by n4b from the gallery: two to each hand of the door (none down its line); and no point of the gallery entry by n_end
//       within 0.45 m of the middle of n4b's frame
//   B3  the points of the entry by s34 into bunks 5: none in the mouth of s34 itself (inside its funnel, within 1.8 m of the frame)
//   --static   only that (no runs played, no run file read)
//   --root     the checkout to ask and to play (default: this one) — a base checkout that has no copy of this file can be checked from here
//   --set    passed to ships.ts (a rule's own switch off = the fault as it was: the check is then expected to FAIL, which is the proof that it can)
//   B3's RULE SHIPS OFF (entrypoints.ts ENTRY.offMouth says why), so as shipped B3 is still a fault and this check says so: `--fault B1` is the check
//   of what is on, and `--fault B3 --set '{"ENTRY":{"offMouth":true}}'` is the proof of the rule behind its switch.
//   B2 IS NOT FIXED: the level change that passed it (the day room's east door moved west) cost the scripted squad runs and was taken back
//   (tools/levels/barracks.ts, the day room's note), so `--fault B2` fails as on the base and stays here as the check a later fix has to pass
// Each fault's verdict needs the runs to have LOOKED: B1 a door order on h_n (given or refused), B2 an entry by n_end or a day room door,
// B3 an entry by s34. Printed beside, not judged: the teammates lost at or after the day room's doors.
// exit 0 = no row of the asked fault(s) and every one looked at · 1 = a row, a run that did not play, or NO VERDICT (looked at nothing) · 2 = bad flags
import { resolve } from 'node:path';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const FLAGS = ['--fault', '--seeds', '--hour', '--set', '--cap', '--jobs', '--from', '--root'];
for (let i = 0; i < argv.length; i++) { if (FLAGS.includes(argv[i])) { i++; continue; } if (argv[i] === '--static') continue; console.error(`unknown argument ${argv[i]} (${FLAGS.join(' ')})`); process.exit(2); }
const ROOT = resolve(flag('--root') ?? resolve(import.meta.dir, '../..')), STATIC = argv.includes('--static');
const which = (flag('--fault') ?? 'all').toUpperCase(), faults = which === 'ALL' ? ['B1', 'B2', 'B3'] : [which];
if (faults.some(f => !['B1', 'B2', 'B3'].includes(f))) { console.error('bad --fault (B1 B2 B3 all)'); process.exit(2); }

interface Smell { kind: string; t: number; who: string; at: string; detail: string }
interface Run { scn: string; seed: number; end: string; t: number; team: number; of: number; refused: string[]; smells: Smell[]; entries?: { door: string; tool: string }[]; losses?: { who: string; door?: string; at?: string }[]; hour?: string }

// ---- where things stand, off the level file
const L = JSON.parse(readFileSync(resolve(ROOT, 'levels/barracks.json'), 'utf8'));
const doorAt = (id: string): [number, number] => { const d = L.doors.find((x: any) => x.id === id); if (!d) throw new Error(`levels/barracks.json has no door '${id}'`); return [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2]; };
const day = L.scenarios.roomClear.rooms.find((r: any) => r.id === 'day').bounds as { x0: number; x1: number; z0: number; z1: number };
const N4B = doorAt('n4b'), S34 = doorAt('s34');
const xz = (s: string): [number, number] => { const m = /\(([-\d.]+), ([-\d.]+)\)/.exec(s); return m ? [+m[1], +m[2]] : [NaN, NaN]; };
const near = (s: string, p: [number, number], r: number) => { const q = xz(s); return Math.hypot(q[0] - p[0], q[1] - p[1]) < r; };
const inDay = (s: string) => { const q = xz(s); return q[0] > day.x0 && q[0] < day.x1 && q[1] > day.z0 && q[1] < day.z1; };
const onMark = (s: Smell) => /(bangClear|openClear) \(on his mark\)/.test(s.detail) && !/fighting/.test(s.detail);   // (a man standing where the entry put him — not a fight's own moment, which is the line of fire rule's)
/** the doors that stand ACROSS a gallery (their wall is a cross wall of one): a hallway's stack */
const ACROSS = ['h_n', 'h_s', 'ng_w', 'ng_e', 'sg_w', 'sg_e', 'n_end', 's_end'];

// ---- the marks themselves: the staged level asked what the rules deal
let failed = false;
{
  const { stage } = await import(`${ROOT}/tools/qa/bang-tally.ts`);
  const TABLES: Record<string, any> = { ORDERS: (await import(`${ROOT}/src/game/orders.ts`)).ORDERS, ENTRY: (await import(`${ROOT}/src/game/entrypoints.ts`)).ENTRY };
  const log = console.log; console.log = () => {}; let S: any; try { S = await stage('barracks-four', 1); } finally { console.log = log; }
  for (const [t, row] of Object.entries(JSON.parse(flag('--set') ?? '{}') as Record<string, Record<string, unknown>>)) { if (!TABLES[t]) continue;   // (a table the marks do not read: the runs' own --set takes it, and refuses one it does not know)
      for (const k of Object.keys(row)) if (!(k in TABLES[t])) { console.error(`--set: no knob '${t}.${k}'`); process.exit(2); }
      Object.assign(TABLES[t], row); }   // (after the stage: it resets the knobs)
  const g = S.g, men = g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead').slice(0, 4), door = (id: string) => g.doors.list.find((d: any) => d.def.name === id);
  const fr = (d: any, p: number[]) => { const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), rx = p[0] - d.frameCentre[0], rz = p[2] - d.frameCentre[2]; return [rx * ux + rz * uz, Math.abs(-rx * uz + rz * ux)]; };   // [along the door from its middle, off its wall]
  const at = (P: any[]) => P.map(q => `(${q.pos[0].toFixed(2)}, ${q.pos[2].toFixed(2)})`).join(' ');
  console.log(`barracks-check · the marks · ${ROOT}${flag('--set') ? ` · --set ${flag('--set')}` : ''}`);
  if (men.length < 4) { failed = true; console.log(`- FAIL — the staged barracks has ${men.length} teammates, not four`); }
  else {
    if (faults.includes('B1')) { const no: string[] = []; let faces = 0;
      for (const id of ACROSS) for (const side of [1, -1]) for (const n of [3, 4]) { faces++; const P: any[] | null = g.orders.stackPosts(door(id), side, men.slice(0, n)), tag = `${id}${side > 0 ? '+' : '-'} ${n} men`;
        if (!P) no.push(tag);
        else if (P.length !== n) no.push(`${tag}: ${P.length} marks`);
        else if (P.some(q => g.col.nav.isBlocked(q.pos[0], q.pos[2]))) no.push(`${tag}: a mark off the floor ${at(P)}`);
        else if (P.some((q, i) => P.some((o, j) => j > i && Math.hypot(q.pos[0] - o.pos[0], q.pos[2] - o.pos[2]) < 0.65))) no.push(`${tag}: two marks on one place ${at(P)}`); }
      console.log(no.length ? `- FAIL — B1 marks: no room (or bad marks) to stack on ${no.length} of ${faces} (door face, men): ${no.join(' · ')}` : `- PASS — B1 marks: three and four men have marks on both faces of every door across a gallery (${faces} asked: ${ACROSS.join(' ')})`); if (no.length) failed = true; }
    if (faults.includes('B2')) { const d = door('n4b'), inDayP = (q: any) => q.pos[0] > day.x0 && q.pos[0] < day.x1 && q.pos[2] > day.z0 && q.pos[2] < day.z1;
      const side = [1, -1].find(sd => g.doorTools.pods(d, sd, 4).every(inDayP)), P: any[] = side ? g.doorTools.pods(d, side, 4) : [];
      const hand = (sg: number) => P.filter(q => fr(d, q.pos)[0] * sg > 0.5).length, ok = P.length === 4 && hand(1) >= 2 && hand(-1) >= 2;
      console.log(`- ${ok ? 'PASS' : 'FAIL'} — B2 marks: the entry by n4b from the gallery puts ${hand(1)} and ${hand(-1)} of its ${P.length} points to the two hands of the door (wanted: 2 and 2, none down its line) · ${at(P)}`); if (!ok) failed = true;
      const e = door('n_end'), G = [1, -1].map(sd => g.doorTools.pods(e, sd, 4) as any[]).find(Q => Q.length && Q.every(q => q.pos[0] < e.frameCentre[0])) ?? [], on = G.filter(q => Math.hypot(q.pos[0] - d.frameCentre[0], q.pos[2] - d.frameCentre[2]) < 0.45);
      const ok2 = G.length > 0 && !on.length;
      console.log(`- ${ok2 ? 'PASS' : 'FAIL'} — B2 marks: the gallery entry by n_end puts ${on.length} of its ${G.length} points in the n4b doorway (within 0.45 m of its frame's middle) · ${at(G)}`); if (!ok2) failed = true; }
    if (faults.includes('B3')) { const d = door('s34'), W = d.def.width;
      const side = [1, -1].find(sd => (g.doorTools.pods(d, sd, 4) as any[]).every(q => q.pos[0] < d.frameCentre[0])), P: any[] = side ? g.doorTools.pods(d, side, 4) : [];
      const mouth = P.filter(q => { const [a, b] = fr(d, q.pos); return Math.abs(a) < W / 2 + 0.3 && b < 1.8; }), ok = P.length > 0 && !mouth.length;
      console.log(`- ${ok ? 'PASS' : 'FAIL'} — B3 marks: the entry by s34 into bunks 5 puts ${mouth.length} of its ${P.length} points in the mouth of s34 (in its funnel, within 1.8 m of the frame)${mouth.length ? ` · ${at(mouth)}` : ''} · ${at(P)}`); if (!ok) failed = true; }
  }
  if (STATIC) process.exit(failed ? 1 : 0);
}

// ---- the runs
let runs: Run[] = [], label = '';
const from = flag('--from');
if (from) { for (const f of from.split(',')) { const J = JSON.parse(readFileSync(f, 'utf8')); runs.push(...((J.runs ?? J) as Run[]).filter(r => r.scn === 'barracks-four')); } label = `${from}`; }
else {
  const seeds = flag('--seeds') ?? '1-6', out = resolve(mkdtempSync(resolve(tmpdir(), 'barracks-check-')), 'runs.json'), set = flag('--set');
  const pr = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/ships.ts'), '--partial', '--scn', 'barracks-four', '--seeds', seeds, '--jobs', flag('--jobs') ?? '4', '--cap', flag('--cap') ?? '420', '--json', out, ...(set ? ['--set', set] : [])],
    { stdout: 'ignore', stderr: 'ignore', env: { ...process.env, ...(flag('--hour') ? { PT_HOUR: flag('--hour')! } : {}) } });
  await pr.exited;
  try { runs = (JSON.parse(readFileSync(out, 'utf8')).runs as Run[]).filter(r => r.scn === 'barracks-four'); } catch { runs = []; }
  label = `seeds ${seeds}${flag('--hour') ? ` · ${flag('--hour')}` : ''}${set ? ` · --set ${set}` : ''}`;
}
console.log(`barracks-check · ${runs.length} runs · ${label}`);
const played = runs.filter(r => ['taken', 'wiped'].includes(r.end));   // (a stalled run — the squad wedged somewhere — did not play to an end)
if (!runs.length || played.length < runs.length) { failed = true; console.log(`- FAIL — ${runs.length - played.length} of ${runs.length} runs did not play to an end${runs.length ? '' : ' (no run file)'}`); }
const won = runs.filter(r => r.end === 'taken').length, up = runs.reduce((a, r) => a + r.team, 0);
console.log(`  taken ${won} of ${runs.length} · teammates up at the end ${runs.length ? (up / runs.length).toFixed(2) : '-'} of 4 (a look, not a tally: a rate needs seeds 1-144 paired)`);

const verdict = (id: string, what: string, looked: number, lookedAt: string, rows: number, inRuns: number, detail: string[]) => {
  const head = `${id} ${what}`;
  if (!looked) { failed = true; console.log(`- NO VERDICT — ${head}: no run had ${lookedAt}: the check looked at nothing`); return; }
  if (rows) { failed = true; console.log(`- FAIL — ${head}: ${rows} rows in ${inRuns} of ${runs.length} runs (${looked} runs had ${lookedAt})`); for (const d of detail.slice(0, 6)) console.log(`    ${d}`); if (detail.length > 6) console.log(`    … ${detail.length - 6} more`); }
  else console.log(`- PASS — ${head}: 0 rows in ${runs.length} runs (${looked} runs had ${lookedAt})`);
};

if (faults.includes('B1')) {
  const rows: string[] = [], by = new Map<string, number>(); let inRuns = 0, looked = 0, orders = 0;
  for (const r of runs) { const no = r.refused.filter(x => /no room/.test(x)); if (no.length) inRuns++;
    for (const x of no) { const d = /^\S+ (\S+):/.exec(x)?.[1] ?? '?'; by.set(d, (by.get(d) ?? 0) + 1); rows.push(`seed ${r.seed}: ${x}`); }
    const n = (r.entries ?? []).filter(e => ACROSS.includes(e.door)).length; orders += n;
    if ((r.entries ?? []).some(e => e.door === 'h_n') || r.refused.some(x => x.includes(' h_n:'))) looked++; }
  verdict('B1', 'no order refused for want of room on a door', looked, 'a door order on the mess hall\'s north door h_n', rows.length, inRuns, rows);
  console.log(`    refused 'no room' by door: ${[...by].map(([d, n]) => `${d} ${n}`).join(' · ') || 'none'} · entries made by a door across a gallery: ${orders} (h_n ${runs.reduce((a, r) => a + (r.entries ?? []).filter(e => e.door === 'h_n').length, 0)}, h_s ${runs.reduce((a, r) => a + (r.entries ?? []).filter(e => e.door === 'h_s').length, 0)})`);
}
if (faults.includes('B2')) {
  const rows: string[] = []; let inRuns = 0, looked = 0, door = 0, wall = 0, muzzle = 0, lost = 0;
  for (const r of runs) { let any = false;
    if ((r.entries ?? []).some(e => ['n_end', 'n4a', 'n4b'].includes(e.door))) looked++;
    for (const s of r.smells) {
      if (s.kind === 'doorway' && /in the n4b doorway/.test(s.detail)) { door++; any = true; rows.push(`seed ${r.seed} ${s.t} s: ${s.who} ${s.at} ${s.detail}`); }
      else if (s.kind === 'wall' && near(s.at, N4B, 0.8)) { wall++; any = true; rows.push(`seed ${r.seed} ${s.t} s: ${s.who} ${s.at} ${s.detail} (on n4b's threshold)`); }
      else if (s.kind === 'flag' && inDay(s.at) && onMark(s)) { muzzle++; any = true; rows.push(`seed ${r.seed} ${s.t} s: ${s.who} ${s.at} ${s.detail}`); } }
    lost += (r.losses ?? []).filter(l => ['n4a', 'n4b'].includes(l.door ?? '')).length;
    if (any) inRuns++; }
  verdict('B2', 'nobody left in the n4b doorway, nobody on his point in the day room with a mate down his muzzle', looked, 'an entry by n_end, n4a or n4b', rows.length, inRuns, rows);
  console.log(`    in the n4b doorway ${door} · chest on a wall on its threshold ${wall} · a mate down his muzzle on his point in the day room ${muzzle} · teammates lost under an order on n4a / n4b: ${lost} (printed, not judged)`);
}
if (faults.includes('B3')) {
  const rows: string[] = []; let inRuns = 0, looked = 0;
  for (const r of runs) { let any = false;
    if ((r.entries ?? []).some(e => e.door === 's34')) looked++;
    for (const s of r.smells) if (s.kind === 'block' && near(s.at, S34, 1.5) && /(bangClear|openClear) \(on his mark\)/.test(s.detail)) { any = true; rows.push(`seed ${r.seed} ${s.t} s: ${s.who} ${s.at} ${s.detail}`); }
    if (any) inRuns++; }
  verdict('B3', 'the player walks in through s34 behind the squad without a teammate on his point stopping him', looked, 'an entry by s34', rows.length, inRuns, rows);
}
process.exit(failed ? 1 : 0);
