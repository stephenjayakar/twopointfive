// SAME GAME ON TWO ENGINES, AND ON TWO MACHINES: does a scripted run come out the same to the bit under bun (JavaScriptCore) and under node (V8, the engine Chrome
// runs the page on) — and on THIS machine as on the one that filed a reference? A server and a client that are to agree from inputs alone (and a page and the
// headless harness) must compute one game; the game's own maths (src/math/exact.ts, on as shipped) is what makes them. Not game code: it reads.
//   bun run tools/qa/coop-check.ts                 the runs below on the shipped stand, each under bun AND under node at this commit: the two must agree to the bit
//   COOP_BREAK=1 bun run tools/qa/coop-check.ts    the red path: both engines on their own sin and cos (TPS_EXACT=0) — the runs must then DIFFER
//   bun run tools/qa/coop-check.ts --runs a:1,b:2  other runs (tools/qa/playthrough.ts's scenarios)
//   bun run tools/qa/coop-check.ts --ref           against tools/qa/fixtures/coop-reference.json instead (another MACHINE's run of the same commit: file it there
//                                                  with --write, carry the file over; any change to how the game plays moves every run, so a kept file goes stale)
//   bun run tools/qa/coop-check.ts --write         file that reference from this machine
// Under node, one run and (if a reference is there) its verdict against it:
//   node --no-warnings --import ./tools/qa/framecost-v8.mjs tools/qa/coop-check.ts --one <scn> <seed>
// WHAT IS COMPARED, per run, strictest first:
//   bits     a hash of the RAW float64 bits of what moves (the clock, every character's place / velocity / facing, awareness, doors, props, items, debris, the event
//            serial) after every Game.update, chained, kept every half second — the first half second that differs is named. No rounding: a last-place difference shows.
//   digest   the game's own digest (game/digest.ts: rounded to the mm / the hundredth) every half second, folded over the run (playthrough.ts PT_DIGEST)
//   outcome  how the run ended, who was standing, how many frames it took
// EXIT: 0 = every run identical to the bit · 1 = something differs (per run: 'bits' alone = the two sides' arithmetic differs in the last place and nothing came
// of it; 'digest' = they drifted apart by more than the digest rounds away; 'outcome' = they played a different game) · 2 = no node / no reference, or a run did not finish.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const REF = new URL('./fixtures/coop-reference.json', import.meta.url);
const RUNS = ['night-breach:1', 'records-pair:1', 'hostage-rescue:1', 'room-clear-four:1'];
type Row = { scn: string; seed: number; frames: number; draws: number; end: string; team: string; hostiles: string; digest: string; bits: string };
type Ref = { note: string; engine: string; platform: string; runs: Row[] };
const engineName = (): string => { const B = (globalThis as { Bun?: { version: string } }).Bun; return B ? `bun ${B.version} (JavaScriptCore)` : `node ${process.version} (V8 ${process.versions.v8})`; };
const platformName = (): string => `${process.platform} ${process.arch}`;

/** one run in THIS process: the scripted play-through with the bit hash taken after every update */
async function one(scn: string, seed: number): Promise<Row> {
  process.env.TPS_PROFILE ??= 'shipped'; process.env.PT_DIGEST ??= '1';
  let draws = 0;   // how much of the seeded stream the run drew (whatever die the harness installs is wrapped as it is installed)
  { let cur = Math.random; Object.defineProperty(Math, 'random', { configurable: true, get() { return cur; }, set(f: () => number) { const w = () => { draws++; return f(); }; Object.assign(w, f); cur = w; } }); }
  const { Game } = await import('../../src/game/game.ts');
  const PT = await import('./playthrough.ts');
  const { rawBits, RAW_BITS_SEED } = await import('../../src/game/digest.ts');
  let h: number = RAW_BITS_SEED;   // chained over the whole run: a difference at any frame stays in every later half second's word (game/digest.ts rawBits)
  const walk = (g: unknown) => { h = rawBits(g as never, h); };
  const bits: string[] = []; let frames = 0;
  const update = Game.prototype.update;
  Game.prototype.update = function (this: unknown, ...a: unknown[]) { const r = (update as (...x: unknown[]) => unknown).apply(this, a); walk(this); if (++frames % 30 === 0) bits.push(h.toString(36)); return r; } as typeof update;
  const r = await PT.play(scn, seed, 300, false, {}) as any;
  return { scn, seed, frames, draws, end: String(r.end), team: `${r.team}/${r.of}`, hostiles: `${r.hostiles}/${r.hostilesOf}`, digest: String(r.digest), bits: bits.join(',') };
}

const MARK = 'COOP-RUN ';
const args = process.argv.slice(2);
/** one run against the reference's: the verdict line, and whether it is identical to the bit */
function judge(r: Row, q: Row, other = 'reference'): { same: boolean; line: string } {
  const a = r.bits.split(','), b = q.bits.split(',');
  let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++;
  const sameBits = r.bits === q.bits && r.frames === q.frames, sameDigest = r.digest === q.digest;
  const sameOutcome = r.end === q.end && r.team === q.team && r.hostiles === q.hostiles && r.frames === q.frames;
  const head = `${r.scn}:${r.seed}: ${r.frames} frames (${(r.frames / 60).toFixed(1)} s) · ${r.end} · team ${r.team} · hostiles ${r.hostiles}`;
  if (sameBits && sameDigest && sameOutcome) return { same: true, line: `- PASS — ${head} · identical to the bit, every half second` };
  const what = !sameOutcome ? `OUTCOME differs (${other}: ${q.frames} frames · ${q.end} · team ${q.team} · hostiles ${q.hostiles})` : !sameDigest ? 'same outcome, the DIGEST differs (apart by more than its rounding)' : 'same outcome, same digest, the BITS differ (last-place arithmetic only)';
  return { same: false, line: `- FAIL — ${head} · ${what} · bits first differ in the half second ending at ${((k + 1) / 2).toFixed(1)} s` };
}
const readRef = (): Ref | null => existsSync(REF) ? JSON.parse(readFileSync(REF, 'utf8')) as Ref : null;

if (args[0] === '--one') {   // the child: one run, one line for the runner — and, by hand (node), its verdict against the reference
  const row = await one(args[1], Number(args[2]));
  console.log(MARK + JSON.stringify({ engine: engineName(), platform: platformName(), row }));
  const ref = readRef(), q = ref?.runs.find(x => x.scn === row.scn && x.seed === row.seed);
  if (ref && q) { const v = judge(row, q); console.log(`${engineName()} · ${platformName()} against the reference filed on ${ref.engine} · ${ref.platform}\n${v.line}`); process.exit(v.same ? 0 : 1); }
  process.exit(0);
}

const B = (globalThis as { Bun?: { spawn: (cmd: string[], o: object) => { stdout: ReadableStream; stderr: ReadableStream; exited: Promise<number> } } }).Bun;
if (!B) { console.error('coop-check: the runner wants bun (it starts the children); under node use --one <scn> <seed> for a single row'); process.exit(2); }
const at = args.indexOf('--runs');
const runs = (at >= 0 && args[at + 1] ? args[at + 1].split(',') : RUNS).map(s => { const [scn, seed] = s.split(':'); return { scn, seed: Number(seed ?? 1) }; });
const write = args.includes('--write'), byRef = write || args.includes('--ref'), BREAK = process.env.COOP_BREAK === '1';
if (byRef && !write && !existsSync(REF)) { console.error(`coop-check: no reference at ${REF.pathname} (file one with --write)`); process.exit(2); }
const HERE = new URL(import.meta.url).pathname, ROOT = new URL('../..', import.meta.url).pathname;
const childEnv = { ...process.env, TPS_PROFILE: 'shipped', PT_DIGEST: '1', ...(BREAK ? { TPS_EXACT: '0' } : {}) } as Record<string, string>;
/** one run in a child of its own (play() keeps module state, and a run is a fresh process on every engine and machine); null = it did not finish, said */
async function runOne(engine: 'bun' | 'node', scn: string, seed: number): Promise<Row | null> {
  const cmd = engine === 'bun' ? [process.execPath, 'run', HERE, '--one', scn, String(seed)] : ['node', '--no-warnings', '--import', './tools/qa/framecost-v8.mjs', 'tools/qa/coop-check.ts', '--one', scn, String(seed)];
  let p; try { p = B!.spawn(cmd, { stdout: 'pipe', stderr: 'pipe', cwd: ROOT, env: childEnv }); } catch (e) { console.log(`- FAIL — ${scn}:${seed}: ${engine} could not be started (${(e as Error).message})`); return null; }
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  const line = out.split('\n').find(l => l.startsWith(MARK));
  if (!line) { console.log(`- FAIL — ${scn}:${seed}: the ${engine} run did not finish (exit ${code}) ${err.trim().split('\n').slice(-2).join(' / ')}`); return null; }
  return JSON.parse(line.slice(MARK.length)).row as Row;
}
/** at most `n` of the jobs at once (a run is a busy process: one a core) */
async function pool<T>(jobs: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (next < jobs.length) { const k = next++; out[k] = await jobs[k](); } }));
  return out;
}
const CORES = Math.max(1, Math.floor(Number(process.env.COOP_JOBS ?? 4)) || 4);   // (COOP_JOBS=1 = one run at a time; a word that is no number = 4)

if (!byRef) {   // ---- two engines, this commit, this machine
  console.log(`=== coop-check: ${runs.length} scripted run(s), each under bun (JavaScriptCore) and under node (V8) · ${platformName()}${BREAK ? ' · COOP_BREAK: the engines on their own sin and cos' : ''} ===`);
  const rows = await pool(runs.flatMap(({ scn, seed }) => [() => runOne('bun', scn, seed), () => runOne('node', scn, seed)]), CORES);
  if (rows.length !== runs.length * 2 || [...rows].some(r => !r)) process.exit(2);
  let differ = 0;
  for (let i = 0; i < runs.length; i++) { const v = judge(rows[2 * i] as Row, rows[2 * i + 1] as Row, 'node'); if (!v.same) differ++; console.log(v.line + (v.same ? '' : ' (bun first, node in brackets)')); }
  console.log(differ ? `=== coop-check: ${differ} of ${runs.length} run(s) DIFFER between the two engines ===` : `=== coop-check: ALL PASS (${runs.length} runs identical to the bit on both engines) ===`);
  process.exit(differ ? 1 : 0);
}

console.log(`=== coop-check: ${runs.length} scripted run(s) on ${engineName()} · ${platformName()} ===`);
const rows: (Row | null)[] = await pool(runs.map(({ scn, seed }) => () => runOne('bun', scn, seed)), CORES);
if (rows.some(r => !r)) process.exit(2);
const got = rows as Row[];

if (write) {
  const ref: Ref = { note: 'tools/qa/coop-check.ts --write: the scripted runs on the shipped stand as this machine plays them (bits = a chained hash of the raw float64 state, one word per half second)', engine: engineName(), platform: platformName(), runs: got };
  writeFileSync(REF, JSON.stringify(ref, null, 1) + '\n');
  for (const r of got) console.log(`- filed ${r.scn}:${r.seed}: ${r.frames} frames (${(r.frames / 60).toFixed(1)} s) · ${r.end} · team ${r.team} · hostiles ${r.hostiles} · ${r.draws} dice · digest ${r.digest}`);
  console.log(`=== coop-check: reference filed (${got.length} runs) ===`);
  process.exit(0);
}

const ref = readRef()!;
console.log(`    against the reference filed on ${ref.engine} · ${ref.platform}`);
let differ = 0, compared = 0;
for (const r of got) {
  const q = ref.runs.find(x => x.scn === r.scn && x.seed === r.seed);
  if (!q) { console.log(`- SKIP — ${r.scn}:${r.seed}: not in the reference`); continue; }
  compared++;
  const v = judge(r, q); if (!v.same) differ++;
  console.log(v.line);
}
if (!compared) { console.log('=== coop-check: NO VERDICT (none of these runs is in the reference) ==='); process.exit(2); }
console.log(differ ? `=== coop-check: ${differ} of ${compared} run(s) DIFFER from the reference ===` : `=== coop-check: ALL PASS (${compared} runs identical to the bit) ===`);
process.exit(differ ? 1 : 0);
