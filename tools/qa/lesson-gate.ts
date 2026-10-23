// LESSON-GATE: the Training group's whole check in one verdict. For every level of scene/scenarioList.ts TRAINING_MISSIONS:
//   · tools/levels/export.ts <level> --check     the file is its generator's · tools/qa/level-lint.ts on it
//   · tools/qa/lesson-check.ts <level>            the block against its file, its floor and the list
//   · tools/qa/lesson-run.ts <level> --digest     the scripted player does every step and the run ends (in the arm the lesson's script declares)
//   · the same with --nolesson                    the same keys with the lesson switched off: the run's digest word must be the same word
//   · TPS_PROFILE=shipped lesson-run, FOUR dice   the game as the PAGE opens it (src/host/profile.ts): seeds 1 and 2 with six seconds of reading before each step, seeds 3 and 4 at the
//                                                 script's own pace — still every step, still the end, on all four (one seed hid a fight the pair lost on three dice in eight)
//   bun run tools/qa/lesson-gate.ts [name …] [--jobs 2]      (no name: the Training levels. A tutorial mission is gated by name: tut-squad)
// One PASS / FAIL line per level and check; exit 0 = all pass, 1 = any FAIL.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { TRAINING_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const argv = process.argv.slice(2), ji = argv.indexOf('--jobs'), jn = ji >= 0 ? Number(argv[ji + 1]) : 2;
if (!Number.isInteger(jn) || jn < 1) { console.error('usage: bun run tools/qa/lesson-gate.ts [name …] [--jobs N]   (N: a whole number, 1 or more)'); process.exit(2); }
const jobs = jn;
const PACE = 6;   // seconds a person spends on a line before he acts — the scripted player's half second on the frozen stand never met the net's radio check, a door with no closer or a guard's next lap
const SHIPPED: [number, number][] = [[1, PACE], [2, PACE], [3, 0], [4, 0]];   // (seed, seconds read a line; 0 = the script's own pace) on the shipped stand
const asked = argv.filter((a, i) => !a.startsWith('--') && i !== ji + 1 || (ji < 0 && !a.startsWith('--'))).map(a => a.replace(/\.json$/, ''));
const names: string[] = asked.length ? asked : [...new Set((TRAINING_MISSIONS as any[]).map(e => String(e.level).replace(/\.json$/, '')))];
const run = async (args: string[], env?: Record<string, string>): Promise<{ code: number; out: string }> => { const p = Bun.spawn(['bun', 'run', ...args], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...env } }); const out = await new Response(p.stdout).text(); const code = await p.exited; return { code, out }; };
let fails = 0; const lines: string[] = [];
const verdict = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`); };
const last = (s: string, re: RegExp) => s.split('\n').filter(l => re.test(l)).pop() ?? '';
// (a tutorial mission, asked for by name: its level carries a script — levels/<name>.script.ts — and its lesson is live only on the frame, game/rails.ts,
//  which the frozen stand holds off: every frozen run of it here is given TPS_RAILS=1)
const scripted = (name: string) => existsSync(resolve(ROOT, 'levels', `${name}.script.ts`));
// (…and a mission whose steps allow `plan` is played in plan mode, which the frozen stand holds off too: its frozen runs are given the mode's own words)
const PLAN_WORDS = { TPS_QRING: '1', TPS_QPLAN: '1', TPS_PLANLOOK: '1', TPS_PLANWAITS: '1', TPS_PLANKNEE: '1' };
const plans = (name: string): boolean => { try { return (JSON.parse(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')).scenarios?.lesson?.steps ?? []).some((t: { allow?: string[] }) => t.allow?.includes('plan')); } catch { return false; } };
// (…and its row's own hour and weather — game/rowset.ts, held off there as well: without the word the frozen run of a mission laid by day was played at night)
const frame = (name: string): Record<string, string> | undefined => scripted(name) ? { TPS_RAILS: '1', TPS_ROWSET: '1', ...(plans(name) ? PLAN_WORDS : null) } : undefined;
async function one(name: string) {
  const [fresh, lint] = await Promise.all([run(['tools/levels/export.ts', name, '--check']), run(['tools/qa/level-lint.ts', `levels/${name}.json`])]);
  verdict(fresh.code === 0, `${name}: the level file is its generator's`, fresh.code === 0 ? '' : last(fresh.out, /\S/).trim());
  verdict(lint.code === 0, `${name}: level-lint`, last(lint.out, /=== level-lint .*(PASS|FAIL)/).replace(/=/g, '').trim());
  // (a level with a script is not run with its lesson off: that is another mission by design, see below)
  const [chk, on, off] = await Promise.all([run(['tools/qa/lesson-check.ts', name]), run(['tools/qa/lesson-run.ts', name, '--digest'], frame(name)), scripted(name) ? Promise.resolve({ code: 0, out: '' }) : run(['tools/qa/lesson-run.ts', name, '--digest', '--nolesson'])]);
  verdict(chk.code === 0, `${name}: lesson-check`, last(chk.out, /===/).replace(/=/g, '').trim());
  verdict(on.code === 0, `${name}: the scripted player does every step and the run ends`, last(on.out, /steps ·|FAIL/).trim());
  const ship = await Promise.all(SHIPPED.map(([seed, pace]) => run(['tools/qa/lesson-run.ts', name, '--seed', String(seed), ...(pace ? ['--pace', String(pace)] : [])], { TPS_PROFILE: 'shipped' })));
  const lost = ship.map((r, i) => r.code === 0 ? '' : `seed ${SHIPPED[i][0]}${SHIPPED[i][1] ? ` at ${SHIPPED[i][1]} s a line` : ''}: ${last(r.out, /steps ·|FAIL/).trim()}`).filter(Boolean);
  verdict(!lost.length, `${name}: as the page ships, on ${SHIPPED.length} dice (two reading each line for ${PACE} s), the player gets through`, lost.length ? lost.join(' · ') : last(ship[0].out, /steps ·|FAIL/).trim());
  const d = (r: { out: string }) => /digest ([0-9a-f]{8}) over (\d+) frames/.exec(r.out);
  const a = d(on), b = d(off);
  // (a level with a script — levels/<name>.script.ts — is not read-only under its lesson: the lesson starts the script's program and sends it its cues, so
  // the lesson off is that level with nothing staged, another run by design. Said, not compared.)
  if (scripted(name)) lines.push(`  NOTE  ${name}: its lesson drives a level script: the lesson off is not the same run, is not held to be, and was not run (on ${a?.[1] ?? '—'})`);
  else verdict(off.code === 0 && !!a && !!b && a[1] === b[1] && a[2] === b[2], `${name}: the same keys with the lesson off play the same run`, `on ${a?.[1] ?? '—'} · off ${b?.[1] ?? '—'} over ${a?.[2] ?? '?'} frames`);
}
for (let i = 0; i < names.length; i += jobs) await Promise.all(names.slice(i, i + jobs).map(one));
console.log(`=== lesson-gate: ${names.length} level(s) ===`); for (const l of lines) console.log(l);
if (!lines.length) { console.log('\n=== lesson-gate: NO VERDICT (nothing was checked) ==='); process.exit(1); }
console.log(fails ? `\n=== lesson-gate: ${fails} FAIL ===` : `\n=== lesson-gate: ALL PASS (${lines.length} checks) ===`);
process.exit(fails ? 1 : 0);
