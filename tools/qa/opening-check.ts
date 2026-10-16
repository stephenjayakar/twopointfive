// THE NIGHT'S FIRST SECONDS ARE FAIR — the check behind src/game/opening.ts (`OPENING.on`).
// The fault it holds shut (the missions goal's S1): the office stood Kowalski on his route's first waypoint, a stride from the one arch out of the lobby and
// four metres by walking from Sam's spawn, for his first 2.5 s — a player who pressed W as the card closed was heard at 2.6 s, seen at 3.0 and down at 4.1.
//   bun run tools/qa/opening-check.ts [--seeds 1-3] [--off] [--level kit-yard.json]
// What it does, on the game stood AS THE PAGE SHIPS IT (tools/qa/solo-night.ts's stand: the opening on):
//   1. the stand: every man of the shift starts at least NEAR_M (8) metres BY WALKING from the player's spawn (the nav grid's own path) — as the game is
//      first stood up, after a restart (restartEncounter), and after an encounter made under a show's flags is handed back (the flags dropped, a frame run)
//   2. the walk: solo-night.ts's `walk` plan — upright, the default pace, the shortest way to the objective, W from the first frame — is played per seed:
//      nobody of the shift is suspicious, searching or alert, and Sam is not hit, inside the first FAIR_SECS (5) seconds
//   --off  the same with the rule off (TPS_OPENING=0): the fault as it was — the check is expected to FAIL (exit 1), which is the proof that it can
// exit 0 = both hold on every seed · 1 = one does not, a run errored, or the level stands no shift at all (NO VERDICT: the check looked at nothing) · 2 = bad flags
import { resolve } from 'node:path';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--seeds', '--off', '--level', '--stand'].includes(a)) { console.error(`unknown flag ${a} (--seeds --off --level)`); process.exit(2); }
const off = argv.includes('--off'), levelFile = flag('--level') ?? null;
const seeds = (flag('--seeds') ?? '1-3').split(',').flatMap(s => { const m = /^(\d+)-(\d+)$/.exec(s); if (!m) return [Number(s)]; const out: number[] = []; for (let k = +m[1]; k <= +m[2]; k++) out.push(k); return out; });
if (!seeds.length || seeds.some(s => !Number.isFinite(s))) { console.error('bad --seeds'); process.exit(2); }
const NEAR_M = 8, FAIR_SECS = 5;
const env = { ...process.env, TPS_OPENING: off ? '0' : '1' };

if (argv.includes('--stand')) {   // a child: the stand's own numbers as JSON on stdout (its own process, so the switch is read before any game module loads)
  const { standUp, ROOT } = await import('./headless.ts');
  const log = console.log; console.log = console.error = console.warn = () => { };
  let level: unknown;
  if (levelFile) { const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); level = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', levelFile), 'utf8'))); }
  const W: any = await standUp({ uploadEvery: 4, ...(level ? { level } : {}) }); const g = W.game, nav = g.col.nav, spawn = g.level.playerSpawn;
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const read = (when: string) => g.guards.filter((x: any) => !x.unit && x.team === 'guard').map((x: any) => { const p = x.char.pos, path = nav.findPath(spawn, p, 8000); let L = Infinity; if (path) { L = 0; let at = spawn; for (const w of path) { L += flat(at, w); at = w; } L += flat(at, p); }
    return { when, who: x.callsign, at: [+p[0].toFixed(1), +p[2].toFixed(1)], walk: Number.isFinite(L) ? +L.toFixed(1) : null, wp: x.wp }; });
  const men = read('stood up');
  for (let i = 0; i < 90; i++) W.step(1 / 60); g.restartEncounter(); men.push(...read('after a restart'));
  { const q = g.quietUtility, tr = g.touring; g.quietUtility = g.touring = true; g.restartEncounter(); for (let i = 0; i < 30; i++) W.step(1 / 60);   // a show's own encounter: its men on their marks while it runs
    g.restartEncounter(); g.quietUtility = q; g.touring = tr; W.step(1 / 60); men.push(...read('handed back by a show')); }   // (… and the fresh one it leaves, the flags dropped after, one frame run — director.ts exitShow's order without its own call)
  console.log = log; console.log(JSON.stringify({ spawn: [spawn[0], spawn[2]], men })); process.exit(0);
}

let failed = false, checks = 0;
const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
// 1. the stand
{ const pr = Bun.spawn(['bun', 'run', import.meta.path, '--stand', ...(levelFile ? ['--level', levelFile] : [])], { stdout: 'pipe', stderr: 'pipe', env });
  const text = await new Response(pr.stdout).text(); await pr.exited;
  let S: { spawn: number[]; men: { when: string; who: string; at: number[]; walk: number | null; wp: number }[] } | null = null; try { S = JSON.parse(text.trim().split('\n').pop()!); } catch { /* */ }
  if (!S) { failed = true; console.log(`- FAIL — the game did not stand up (${(await new Response(pr.stderr).text()).trim().split('\n').pop()?.slice(0, 200)})`); }
  else if (!S.men.length) { console.log('=== opening-check: NO VERDICT (this level stands no shift: there is nobody to start clear of the spawn) ==='); process.exit(1); }
  else for (const m of S.men) line(m.walk === null || m.walk >= NEAR_M, `${m.when}: ${m.who} starts the night at (${m.at[0]}, ${m.at[1]}), ${m.walk === null ? 'no way' : m.walk + ' m'} by walking from the spawn (${S.spawn[0]}, ${S.spawn[1]}) — the bar is ${NEAR_M} m`); }
// 2. the walk
const dir = mkdtempSync(resolve(tmpdir(), 'opening-check-'));
for (const seed of seeds) {
  const f = resolve(dir, `walk-${seed}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'solo-night.ts'), '--one', `walk:${seed}`, '--outfile', f, '--cap', '40', ...(levelFile ? ['--level', levelFile] : [])], { stdout: 'ignore', stderr: 'ignore', env }); await pr.exited;
  let r: any = null; try { r = JSON.parse(readFileSync(f, 'utf8')); } catch { /* */ }
  if (!r || r.end === 'error' || r.end === 'stalled') { failed = true; console.log(`- FAIL — walk:${seed} did not play (${r ? `${r.end}: ${r.why.split('\n')[0]}` : 'no result file'})`); continue; }
  let first = Infinity, who = ''; for (const [name, f1] of Object.entries(r.firsts as Record<string, Record<string, number>>)) for (const [state, t] of Object.entries(f1)) if (state !== 'patrol' && state !== 'dead' && t < first) { first = t; who = `${name} ${state}`; }
  const hit = r.downAt ?? Infinity;
  line(first >= FAIR_SECS && hit >= FAIR_SECS, `walk:${seed} — first of the shift onto him: ${Number.isFinite(first) ? `${who} at ${first.toFixed(1)} s` : 'nobody'}${Number.isFinite(hit) ? ` · Sam down at ${hit.toFixed(1)} s` : ''} (ended ${r.end} at ${r.t} s) — the bar is ${FAIR_SECS} s`);
}
rmSync(dir, { recursive: true, force: true });
if (!checks) { console.log('=== opening-check: NO VERDICT (nothing was looked at) ==='); process.exit(1); }
console.log(failed ? `=== opening-check: FAILED${off ? ' (the rule is off: expected)' : ''} ===` : '=== opening-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
