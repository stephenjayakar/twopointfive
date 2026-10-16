// A script of page-bot.ts run with NO PAGE: the same scripted player over the headless harness, to see in seconds what a script does, says and asks the
// mixer for before it is recorded on the real page (sound-tapes.cjs, minutes a run). It records nothing; the page is the recorder, and its camera, canvas
// and light meter are the page's own, so a script that passes here can still part there.
//
//   TPS_PROFILE=shipped bun run tools/qa/tapes/dry.ts <name> [--seed N] [--lines] [--when sound,sound] [--info]
//   (--when = the seconds each named sound was asked for; --info = the level's doors, loose furniture and walk grid, to write a script against; exit 0 / 1, 2 = no such script)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp } from '../headless';

const ROOT = resolve(import.meta.dir, '../../..'), argv = process.argv.slice(2), has = (f: string) => argv.includes(f);
const seed = Number(argv[argv.indexOf('--seed') + 1] && argv.includes('--seed') ? argv[argv.indexOf('--seed') + 1] : 1);
const name = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--seed' && argv[i - 1] !== '--when');
const Wn: any = {}; (globalThis as any).window = Wn;
await import('./page-bot');
const page = name ? Wn.__tapeBot.pages[name] : null;
if (!page) { console.error(`no script '${name}' (there are: ${Wn.__tapeBot.names.join(' ')})`); process.exit(2); }
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const log = console.log, quiet = () => { console.log = console.error = console.warn = () => { }; }, loud = () => { console.log = log; console.error = log; console.warn = log; };
const file = /levelFile=([\w-]+\.json)/.exec(page.query)?.[1];
quiet();
const W: any = await standUp({ uploadEvery: 4, level: file ? loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) : undefined, seed });
const g = W.game; startFromQuery(g, '?' + page.query);
if (/\bnocivilians\b/.test(page.query)) { g.tune.civilians = false; (await import(`${ROOT}/src/game/civilians.ts`)).resetCivilians(g); }   // (the page reads the flag off its address at boot)
loud();
if (!g.probe) g.probe = { results: new Map() }; else if (!g.probe.results) g.probe.results = new Map();
const doorSounds: string[] = [];
{ const A = g.audio, play = A.play.bind(A); A.play = (n: string, p: any, ...rest: any[]) => { if (/^door/.test(n) && p) doorSounds.push(`${n}@${g.time.toFixed(1)}s (${p[0].toFixed(1)}, ${p[2].toFixed(1)}) guards ${g.guards.map((x: any) => `${x.char.pos[0].toFixed(1)},${x.char.pos[2].toFixed(1)}`).join(' ')}`); return play(n, p, ...rest); }; }
{ const A = g.audio, step = A.footstep.bind(A); A.footstep = (p: any, l: number, isPlayer: boolean, mat?: string) => { A.play(isPlayer ? `(step ${mat ?? ''})` : '(a step)', p, l); return step(p, l, isPlayer, mat); }; }
Object.assign(Wn, { __game: g, __input: W.input, __cam: W.cam, __audio: g.audio, __hour: { est: (p: any, id: number) => lightEstimateAt(g, p, (o: number) => o === id) },
  __runFrames: (n: number, dt: number) => { for (let i = 0; i < n; i++) W.step(dt); } });
(globalThis as any).document = { getElementById: () => W.canvas };
if (has('--info')) {
  for (const d of g.doors.list ?? []) log(`door ${String(d.def?.name ?? d.name).padEnd(16)} hinge (${d.def.hinge?.map((v: number) => v.toFixed(1)).join(', ')}) w ${d.def.width} ${d.locked ? 'LOCKED ' + (d.lockId ?? '') : ''} ${d.def.steel ? 'steel' : ''} ${d.def.exterior ? 'exterior' : ''} ${d.isClosed?.() ? '' : 'open'}`);
  for (const p of g.props.props ?? g.props.list ?? []) log(`prop ${String(p.def.kind).padEnd(10)} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) half ${p.hx.toFixed(2)} × ${p.hz.toFixed(2)}, ${p.mass} kg`);
  // the walk grid as text (# = no floor for a man's feet; c chair, b bin, k carton, p plant), one character a half metre, a ruler every five metres
  const n = g.col.nav, sym: Record<string, string> = { chair: 'c', bin: 'b', cardboard: 'k', plant: 'p' }, at = new Map<number, string>();
  for (const p of g.props.props ?? []) at.set(Math.floor(p.z / n.cell) * n.W + Math.floor(p.x / n.cell), sym[p.def.kind] ?? '?');
  for (let z = 0; z < n.H; z++) { let row = ''; for (let x = 0; x < n.W; x++) row += at.get(z * n.W + x) ?? (n.blocked[z * n.W + x] ? '#' : z % 10 === 0 && x % 10 === 0 ? '+' : '.'); if (row.includes('.')) log(`${(z * n.cell).toFixed(1).padStart(5)} ${row}`); }
  process.exit(0);
}
const doors0 = (g.doors.list ?? []).map((d: any) => d.angle);
quiet(); const r = Wn.__tapeBot.run(name); loud();
if (has('--lines')) for (const d of doorSounds) log('  ' + d);
if (has('--lines')) log(`  doors that moved: ${(g.doors.list ?? []).filter((d: any, i: number) => Math.abs(d.angle - doors0[i]) > 0.02).map((d: any) => d.def.name).join(', ') || 'none'} · civilians on the floor ${g.civilians?.length ?? 0}`);
const first = new Map<string, number>(), count = new Map<string, number>();
for (const [f, n] of r.heard) { if (!first.has(n)) first.set(n, f); count.set(n, (count.get(n) ?? 0) + 1); }
for (const l of has('--lines') || r.code ? r.lines : r.lines.slice(-4)) log('    ' + l);
{ const w = argv.indexOf('--when'), ns = w >= 0 ? (argv[w + 1] ?? '').split(',') : []; for (const n of ns) log(`  ${n}: ${r.heard.filter((h: [number, string]) => h[1] === n).map((h: [number, string]) => (h[0] / 60).toFixed(1)).join(' ') || 'never'}`); }
log([...first].map(([n, f]) => `${n}@${(f / 60).toFixed(0)}${count.get(n)! > 1 ? '×' + count.get(n) : ''}`).join(' '));
log(r.code === 0 ? `\n=== dry ${name}: ran to its end, ${r.secs} s, ${first.size} sounds ===` : `\n=== dry ${name}: FAIL — ${r.why} ===`);
process.exit(r.code);
