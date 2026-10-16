// WHAT FIGHT A PLAN MAKES — tools/qa/playthrough.ts's scripted commander played over a seed range ON ONE DEFENDER PLACEMENT, with a bystander that keeps what the
// play-through's own JSON does not: where every defender stood N seconds after first contact, and where every man (teammate or defender) fell. Two plans on the
// same placement and seeds can then be held side by side: did they make DIFFERENT fights.
//   [TPS_PROFILE=shipped] [PT_ROUTE=… PT_TOOL=… PT_FIRST=… PT_DOOR=… PT_DIRECT=1 …] bun run tools/qa/plan-fights.ts --scn compound-four --seeds 1-12 [--jobs 3]
//        [--place 0] [--at 0,30] [--cap 300] [--set '{"DIFFICULTY":{"level":"hard"}}'] [--name planA] [--json out.json]
//   bun run tools/qa/plan-fights.ts --diff a.json b.json          two plans' JSONs side by side: per room, men standing there at +N s and men fallen there
//   --place N     THE PLACEMENT every seed is played on (roomclear.ts placeDefenders(N, 1)): 0, the default = the AUTHORED one (each room's first garrison marks).
//                 playthrough.ts hands its run seed to the room clear as the placement seed too (`roomclear=<seed>`), so there every seed is another placement; here the
//                 seed moves only the dice (Math.random = seeded(0x9137 + seed × 7919), as there). `--place seed` = playthrough.ts's own behaviour (a check: the
//                 outcome then equals `playthrough.ts --seeds` run for run under TPS_PROFILE=shipped; on the frozen stand playthrough.ts as a program also
//                 writes PT_DESTR / PT_KICK / PT_POP, which an importer does not get — use the shipped profile)
//   --at 0,30     seconds after FIRST CONTACT at which the defenders' places are kept (a run that ends sooner keeps the end's, marked `short`)
//   FIRST CONTACT = the earlier of: the first loud thing (a round, a bang, a boot — playthrough's own `loudAt`) · the first defender the fight AI has alert
//   every PT_* env word and --set row is playthrough.ts's own (read its head); the levers are passed through untouched
//   exit 0 = every run ended by the scenario's rules · 1 = a run threw or stalled · 2 = bad flags
//   WHAT IS COUNTED: "teammates up X of N" and every per-room mean are over every run that was PLAYED — a run stopped by --cap ('stalled') counts, with the men it had up at
//   the cap, and the line says how many were; only an error run is left out. --diff refuses two files whose scn, placement, seeds or --at differ.
// HOW (nothing under src/ is edited, nothing the simulation reads is written): RoomClearScenario.prototype.start is wrapped to name the placement seed, and
// Game.prototype.update is wrapped to LOOK at the guards after each update. A bystander: it rolls no die and moves nobody.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

interface Spot { who: string; room: string; at: [number, number]; state: string; home: string | null }
interface Snap { after: number; t: number; short: boolean; men: Spot[] }
interface Fall { t: number; who: string; side: 'team' | 'theirs'; room: string; at: [number, number]; by: string; byAt: [number, number] | null; byRoom: string | null; kind: string }
interface FightOut { scn: string; seed: number; place: string; way: string; end: string; why: string; secs: number; team: number; of: number; theirs: number; theirsOf: number;
  contact: number | null; loud: number | null; alert: number | null; start: Spot[]; snaps: Snap[]; falls: Fall[]; rooms: [number, string][]; orders: number; refused: string[]; entries: unknown[] }

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const KNOWN = ['--scn', '--seeds', '--jobs', '--place', '--at', '--cap', '--set', '--name', '--json', '--one', '--out', '--diff'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const r1 = (x: number) => Math.round(x), mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, f1 = (x: number) => x.toFixed(1);

// ───────────────────────────────────────────── one run (a child process, as playthrough.ts runs each of its own) ─────────────────────────────────────────────
async function one(scn: string, seed: number, place: number | 'seed', ats: number[], cap: number, set: Record<string, Record<string, unknown>>): Promise<FightOut> {
  const RC: any = await import('../../src/game/roomclear.ts'), GM: any = await import('../../src/game/game.ts'), DL: any = await import('../../src/game/dialogue.ts');
  const start0 = RC.RoomClearScenario.prototype.start;
  if (place !== 'seed') RC.RoomClearScenario.prototype.start = function (this: unknown, s?: number) { return start0.call(this, s === undefined ? s : place); };   // (only a start that NAMES a seed — playthrough's — is renamed)
  let G: any = null, T0 = NaN, loud: number | null = null, alert: number | null = null, contact: number | null = null, lastT = 0, summary = '';
  const was = new Map<any, string>(), falls: Fall[] = [], snaps: Snap[] = [], start: Spot[] = [];
  const roomOf = (g: any, p: number[]): string => { const R = (g.roomClear?.structure?.rooms ?? []).find((r: any) => p[0] >= r.bounds.x0 - 0.3 && p[0] <= r.bounds.x1 + 0.3 && p[2] >= r.bounds.z0 - 0.3 && p[2] <= r.bounds.z1 + 0.3);
    if (R) return R.id; try { return String(DL.placeName(g.level, p)); } catch { return 'open'; } };
  const homeOf = (g: any, h: any): string | null => g.roomClear?.rooms?.find((r: any) => r.defenders.includes(h))?.def.id ?? null;
  const spot = (g: any, h: any): Spot => ({ who: h.callsign ?? '?', room: roomOf(g, h.char.pos), at: [r1(h.char.pos[0]), r1(h.char.pos[2])], state: h.state === 'dead' ? (h.downKind === 'wounded' ? 'wounded' : 'down') : String(h.state), home: homeOf(g, h) });
  const theirs = (g: any): any[] => g.guards.filter((x: any) => x.team === 'hostile'), ours = (g: any): any[] => g.guards.filter((x: any) => x.team === 'operative' && x.unit);
  const look = (g: any) => {
    if (!g.roomClear?.active && !g.rescue?.active && !g.nightBreach?.active) return;
    if (G !== g) { G = g; T0 = g.time; was.clear(); for (const h of theirs(g)) start.push(spot(g, h)); summary = g.roomClear?.active ? String(g.roomClear.summary()) : ''; }
    const t = g.time - T0; lastT = t;
    if (loud === null && (g.events as any[]).some(e => !e.ptNoise && (e.kind === 'shot' || e.kind === 'guardShot' || e.kind === 'bang' || e.kind === 'kick'))) loud = t;
    if (alert === null && theirs(g).some(h => h.state === 'alert')) alert = t;
    if (contact === null && (loud !== null || alert !== null)) contact = t;
    for (const m of [...theirs(g), ...ours(g)]) { const w = was.get(m); was.set(m, m.state); if (w === undefined || w === 'dead' || m.state !== 'dead') continue;
      const k = g.guards.find((x: any) => x.char.id === m.killerId), sam = m.killerId === g.player?.char?.id, kp: number[] | null = k ? k.char.pos : sam ? g.player.char.pos : null;
      falls.push({ t: +t.toFixed(1), who: m.callsign ?? '?', side: m.team === 'hostile' ? 'theirs' : 'team', room: roomOf(g, m.char.pos), at: [r1(m.char.pos[0]), r1(m.char.pos[2])], by: k?.callsign ?? (sam ? 'Sam' : m.downBy ?? '—'), byAt: kp ? [r1(kp[0]), r1(kp[2])] : null, byRoom: kp ? roomOf(g, kp) : null, kind: String(m.downKind ?? 'shot') }); }
    if (contact !== null) for (const a of ats) if (!snaps.some(s => s.after === a) && t >= contact + a) snaps.push({ after: a, t: +t.toFixed(1), short: false, men: theirs(g).map(h => spot(g, h)) });
  };
  const update0 = GM.Game.prototype.update;
  GM.Game.prototype.update = function (this: unknown, ...a: unknown[]) { const r = update0.apply(this, a); try { look(this); } catch { /* a bystander never ends a run */ } return r; };
  const PT: any = await import('./playthrough.ts');
  const r = await PT.play(scn, seed, cap, false, set);
  GM.Game.prototype.update = update0; RC.RoomClearScenario.prototype.start = start0;
  if (G) for (const a of ats) if (!snaps.some(s => s.after === a)) snaps.push({ after: a, t: +lastT.toFixed(1), short: true, men: theirs(G).map(h => spot(G, h)) });
  snaps.sort((a, b) => a.after - b.after);
  // (the play-through's clock starts a few frames after the staging: every second here is put on ITS clock, by the one moment both have — the first loud thing)
  const off = loud !== null && r.def?.loudAt != null ? loud - r.def.loudAt : 0, c = (x: number | null) => x === null ? null : +(x - off).toFixed(1);
  for (const f of falls) f.t = +(f.t - off).toFixed(1); for (const s of snaps) s.t = +(s.t - off).toFixed(1);
  const way = G?.roomClear ? `way in ${1 + (G.roomClear.way ?? 0)}` : '';
  return { scn, seed, place: summary || `placement ${place}`, way, end: r.end, why: String(r.why ?? '').split('\n')[0], secs: r.t, team: r.team, of: r.of, theirs: r.hostiles, theirsOf: r.hostilesOf,
    contact: c(contact), loud: c(loud), alert: c(alert), start, snaps, falls, rooms: r.def?.rooms ?? [], orders: r.orders, refused: r.refused ?? [], entries: (r.entries ?? []).map((e: any) => ({ door: e.door, tool: e.tool, t0: e.t0, cross: e.cross, end: e.end, lost: e.lost })) };
}

// ───────────────────────────────────────────── the tables ─────────────────────────────────────────────
interface Plan { name: string; scn: string; place: number | 'seed'; at: number[]; cap: number; set: unknown; env: Record<string, string>; runs: FightOut[] }
const snapOf = (r: FightOut, after: number) => r.snaps.find(s => s.after === after);   // (that second's own keep or none: never another second's under this one's label)
/** the runs a table counts: every run that was PLAYED. A run stopped by the time cap ('stalled') is one of them, with the men it had up at the cap; only a run that threw is left out. */
const played = (P: Plan): FightOut[] => P.runs.filter(r => r.end !== 'error');
/** per room: mean men of theirs standing there (up) at `after` s past contact · falls there per run, theirs and the team's */
function byRoom(P: Plan, after: number): Map<string, { stand: number; theirs: number; team: number }> {
  const M = new Map<string, { stand: number; theirs: number; team: number }>(), R = played(P), n = Math.max(1, R.length), row = (k: string) => { let x = M.get(k); if (!x) M.set(k, x = { stand: 0, theirs: 0, team: 0 }); return x; };
  for (const r of R) { const S = snapOf(r, after); if (S) for (const m of S.men) if (m.state !== 'down' && m.state !== 'wounded') row(m.room).stand += 1 / n;
    for (const f of r.falls) row(f.room)[f.side] += 1 / n; }
  return M;
}
function summaryOf(P: Plan): string {
  const R = P.runs, ok = played(P), capped = ok.filter(r => r.end === 'stalled').length, errs = R.length - ok.length, after = P.at[P.at.length - 1], L: string[] = [];
  const ends = [...new Set(R.map(r => r.end))].map(e => `${R.filter(r => r.end === e).length} ${e}`).join(', ');
  L.push(`${P.name} · ${P.scn} · placement ${P.place} · ${R.length} runs: ${ends} · ${R[0]?.place ?? ''} · ${R[0]?.way ?? ''}`);
  L.push(`teammates up ${f1(mean(ok.map(r => r.team)))} of ${R[0]?.of ?? 0} (total ${ok.reduce((a, r) => a + r.team, 0)}/${ok.reduce((a, r) => a + r.of, 0)} over ${ok.length} runs${capped ? `, ${capped} of them stopped by the ${P.cap} s cap and counted with the men up at the cap` : ''}${errs ? `, ${errs} error run${errs > 1 ? 's' : ''} left out` : ''}) · theirs up at the end ${f1(mean(ok.map(r => r.theirs)))} of ${R[0]?.theirsOf ?? 0} · ${Math.round(mean(ok.map(r => r.secs)))} s a run · first contact at ${f1(mean(ok.filter(r => r.contact !== null).map(r => r.contact as number)))} s (loud ${f1(mean(ok.filter(r => r.loud !== null).map(r => r.loud as number)))})`);
  const M = [...byRoom(P, after)].sort((a, b) => b[1].stand + b[1].theirs + b[1].team - (a[1].stand + a[1].theirs + a[1].team));
  L.push(`theirs standing at contact + ${after} s, mean per run: ${M.filter(m => m[1].stand >= 0.05).map(m => `${m[0]} ${f1(m[1].stand)}`).join(' · ') || 'nobody'}`);
  L.push(`theirs fell, per run: ${M.filter(m => m[1].theirs >= 0.05).map(m => `${m[0]} ${f1(m[1].theirs)}`).join(' · ') || 'nobody'}`);
  L.push(`team fell, per run: ${M.filter(m => m[1].team >= 0.05).map(m => `${m[0]} ${f1(m[1].team)}`).join(' · ') || 'nobody'}`);
  const who = new Map<string, number>(); for (const r of R) for (const f of r.falls) if (f.side === 'team') who.set(`${f.by}${f.byRoom ? ` from ${f.byRoom}` : ''}`, (who.get(`${f.by}${f.byRoom ? ` from ${f.byRoom}` : ''}`) ?? 0) + 1);
  L.push(`team's killers (falls over all runs): ${[...who].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}`);
  const first = new Map<string, number>(); for (const r of R) { const e = (r.entries as { door: string; tool: string }[])[0]; if (e) first.set(`${e.door}/${e.tool}`, (first.get(`${e.door}/${e.tool}`) ?? 0) + 1); }
  L.push(`first door / tool: ${[...first].map(([k, v]) => `${k} ×${v}`).join(' · ') || 'none'} · orders refused ${R.reduce((a, r) => a + r.refused.length, 0)}`);
  const places = [...new Set(ok.map(r => r.place))]; if (places.length > 1) L.push(`NOT ONE PLACEMENT: ${places.length} different placements over the runs — ${places.map(p => `${ok.filter(r => r.place === p).map(r => r.seed).join(',')}: ${p.slice(0, 60)}`).join(' | ')}`);
  const bad = R.filter(r => r.end === 'error' || r.end === 'stalled'); if (bad.length) L.push(`did not end: ${bad.map(r => `${r.seed} ${r.end} — ${r.why.slice(0, 80)}`).join(' | ')}`);
  return L.join('\n');
}
/** why two plans' files cannot be held side by side (null = they can): the same scenario, placement, seeds and kept seconds, or the table would compare two different things */
function unlike(A: Plan, B: Plan): string | null {
  const seeds = (P: Plan) => P.runs.map(r => r.seed).sort((a, b) => a - b).join(','), W: string[] = [];
  if (A.scn !== B.scn) W.push(`scn ${A.scn} / ${B.scn}`);
  if (String(A.place) !== String(B.place)) W.push(`placement ${A.place} / ${B.place}`);
  if (seeds(A) !== seeds(B)) W.push(`seeds ${seeds(A)} / ${seeds(B)}`);
  if (A.at.join(',') !== B.at.join(',')) W.push(`--at ${A.at.join(',')} / ${B.at.join(',')}`);
  return W.length ? W.join(' · ') : null;
}
function diff(A: Plan, B: Plan): string {
  const after = A.at[A.at.length - 1], a = byRoom(A, after), b = byRoom(B, after), keys = [...new Set([...a.keys(), ...b.keys()])], z = { stand: 0, theirs: 0, team: 0 };
  const rows = keys.map(k => ({ k, a: a.get(k) ?? z, b: b.get(k) ?? z })).sort((x, y) => Math.abs(y.a.stand - y.b.stand) + Math.abs(y.a.theirs - y.b.theirs) + Math.abs(y.a.team - y.b.team) - (Math.abs(x.a.stand - x.b.stand) + Math.abs(x.a.theirs - x.b.theirs) + Math.abs(x.a.team - x.b.team)));
  const d = (f: 'stand' | 'theirs' | 'team') => rows.reduce((s, r) => s + Math.abs(r.a[f] - r.b[f]), 0) / 2;   // (men who stood / fell somewhere else, per run: half the L1 distance)
  const L = [`${A.name} (${played(A).length} runs) against ${B.name} (${played(B).length} runs) · mean men per run, by room · A → B`,
    `${'room'.padEnd(18)}${`standing +${after} s`.padEnd(18)}${'theirs fell'.padEnd(16)}team fell`];
  for (const r of rows.slice(0, 14)) L.push(`${r.k.slice(0, 17).padEnd(18)}${`${f1(r.a.stand)} → ${f1(r.b.stand)}`.padEnd(18)}${`${f1(r.a.theirs)} → ${f1(r.b.theirs)}`.padEnd(16)}${f1(r.a.team)} → ${f1(r.b.team)}`);
  L.push(`men per run somewhere else: standing ${f1(d('stand'))} · theirs fallen ${f1(d('theirs'))} · team fallen ${f1(d('team'))}   (0 = the same fight by room; the seeds' own scatter is read by splitting one plan's seeds in two)`);
  return L.join('\n');
}

// ───────────────────────────────────────────── main ─────────────────────────────────────────────
if (import.meta.main) {
  if (argv[0] === '--diff') { const [fa, fb] = [argv[1], argv[2]]; if (!fa || !fb) { console.error('--diff a.json b.json'); process.exit(2); } const A: Plan = JSON.parse(readFileSync(fa, 'utf8')), B: Plan = JSON.parse(readFileSync(fb, 'utf8')), why = unlike(A, B);
    if (why) { console.error(`--diff: these two files are not the same fight asked twice, so no table — ${why}`); process.exit(2); }
    console.log(diff(A, B)); process.exit(0); }
  const cap = Number(flag('--cap') ?? 300), set = JSON.parse(flag('--set') ?? '{}'), placeArg = flag('--place') ?? '0', place: number | 'seed' = placeArg === 'seed' ? 'seed' : Number(placeArg);
  const ats = (flag('--at') ?? '0,30').split(',').map(Number).sort((a, b) => a - b);
  if (place !== 'seed' && !Number.isInteger(place) || ats.some(a => !(a >= 0))) { console.error('--place N | seed · --at seconds,seconds'); process.exit(2); }
  if (flag('--one')) { const [scn, seed] = flag('--one')!.split(':'); const out = flag('--out'); const r = await one(scn, Number(seed), place, ats, cap, set); if (out) writeFileSync(out, JSON.stringify(r)); else console.log(JSON.stringify(r, null, 1)); process.exit(0); }
  const scn = flag('--scn'); if (!scn || scn.includes(',')) { console.error('--scn <one scenario id> (tools/qa/playthrough.ts lists them on an unknown id)'); process.exit(2); }
  const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } if (!/^\d+$/.test(p)) { console.error(`--seeds ${s}: '${p}' is not a seed (1,2,3 or 1-12)`); process.exit(2); } return [Number(p)]; });
  const seeds = seedsOf(flag('--seeds') ?? '1-6'), jobs = Math.max(1, Number(flag('--jobs') ?? 3)), runs: FightOut[] = []; let next = 0; const t0 = Date.now();
  const worker = async () => { for (;;) { const seed = seeds[next++]; if (seed === undefined) return;
    const file = resolve(tmpdir(), `plan-fights-${process.pid}-${seed}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${scn}:${seed}`, '--out', file, '--cap', String(cap), '--set', JSON.stringify(set), '--place', String(place), '--at', ats.join(',')], { stdout: 'ignore', stderr: 'pipe' });
    const errText = await new Response(pr.stderr).text(); await pr.exited;
    let r: FightOut; try { r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); } catch { r = { scn, seed, place: '', way: '', end: 'error', why: `the run left no result — ${errText.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`, secs: 0, team: 0, of: 0, theirs: 0, theirsOf: 0, contact: null, loud: null, alert: null, start: [], snaps: [], falls: [], rooms: [], orders: 0, refused: [], entries: [] }; }
    runs.push(r); console.error(`  ${scn}:${seed} ${r.end} ${r.secs} s · team ${r.team}/${r.of} · theirs ${r.theirs}/${r.theirsOf} up · contact ${r.contact ?? '—'} s${r.end === 'error' ? ` — ${r.why}` : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => a.seed - b.seed);
  const env: Record<string, string> = {}; for (const [k, v] of Object.entries(process.env)) if (v !== undefined && /^(PT_|TPS_|GLASS|QA_|SQUADS$|CUTBOXES$|ONEWAY$)/.test(k)) env[k] = v;
  const P: Plan = { name: flag('--name') ?? 'plan', scn, place, at: ats, cap, set, env, runs };
  console.log(summaryOf(P)); console.log(`${runs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify(P));
  process.exit(runs.some(r => r.end === 'error' || r.end === 'stalled') || new Set(played(P).map(r => r.place)).size > 1 ? 1 : 0);
}
