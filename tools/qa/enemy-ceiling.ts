// THE ENEMY CEILING, THE SIMULATION'S HALF — what one frame of the game costs on the CPU with N enemies alive beside Sam and his teammates, N rising past what a
// renderer could draw today (rebuild/enemy-squads/ceiling.md is the page these tables go into). Headless: no GPU, no picture — the frame RATE on a real machine
// is not this tool's to say (the page's `?extra=N` / Tab ▸ Sandbox ▸ Stress is the way to see that).
//   bun run tools/qa/enemy-ceiling.ts [--scn block-four] [--enemies 8,11,16,24,32] [--seeds 1-3] [--secs 30] [--modes idle,fight] [--hard] [--json out.json]
//
// THE FLOOR: the scenario as its start-card row stages it (default The block: Sam + the four + its eight defenders), then game/stress.ts standExtra for the men
// past the scenario's own — the same hook the page's flag uses, here handed tools/qa/uncapped.ts's spawner so 24 and 32 stand where the game would refuse.
// TWO STATES, each timed over --secs of game time at 60 Hz after a warm-up:
//   idle    staged and waiting: nobody has heard anything (what a level full of men costs before the first door)
//   fight   EVERYBODY in the fight at once and nobody able to die (guards.ts engage on both sides, every man's Guard.god): N enemies and the team alert, hunting,
//           firing real rounds for the whole window. That is the worst a count can cost — in play men fall and most of a level has not heard yet — and it is the
//           one state where 'N alive in a fight' stays N.
// PER FRAME: `update` = Game.update (the whole simulation: AI, senses, paths, rounds, animation, ragdolls, the box list) · `upload` = the light set's and the
// box world's CPU packing that follows it in every frame (headless.ts step) · frame = both. Mean, median, p95, p99, worst — the worst frames are path searches.
// The harness's senses: no light meter and no smoke (guards.ts's own direct-light estimate; clear air), so a GPU page pays the same CPU and reads more of it.
// TIMINGS ARE THIS MACHINE'S. Quote ratios across rows, and the row a run shares with the page: the read-out's CPU step on the same floor.
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { uncap, spawnPast } from './uncapped.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { engage } = await import(`${ROOT}/src/game/guards.ts`);
const { standExtra } = await import(`${ROOT}/src/game/stress.ts`);
const { setDifficulty, difficultyNow } = await import(`${ROOT}/src/game/difficulty.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }
const pct = (a: Float64Array, p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
function stat(xs: number[]) { const a = Float64Array.from(xs).sort(); return { mean: xs.reduce((s, x) => s + x, 0) / xs.length, p50: pct(a, 0.5), p95: pct(a, 0.95), p99: pct(a, 0.99), max: a[a.length - 1] }; }

export interface Row { scn: string; mode: string; seed: number; asked: number; enemies: number; team: number; chars: number; lights: number; boxes: number; frames: number; alertEnd: number; rounds: number;
  update: ReturnType<typeof stat>; upload: ReturnType<typeof stat>; frame: ReturnType<typeof stat>; note: string }

/** one floor, one state, timed. `enemies` = how many to have alive (the scenario's own plus extras; fewer than its own is not offered) */
export async function measure(scn: string, enemies: number, seed: number, mode: 'idle' | 'fight', secs: number): Promise<Row> {
  const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) throw new Error(`no scenario '${scn}' — ${SCENARIOS.map((e: any) => e.id).join(', ')}`);
  Math.random = seeded(0x9137 + seed * 7919);
  const W: any = await quiet(() => standUp({ uploadEvery: 1, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game;
  uncap(W);
  g.godMode = true; g.tune.chaos = 0.5;   // (the page's default chaos, as playthrough.ts runs it)
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(q))); if (why) throw new Error(`start refused — ${why}`);
  const own = g.guards.filter((x: any) => x.team === 'hostile').length; let note = '';
  if (enemies < own) throw new Error(`${scn} stages ${own} enemies of its own: ask for ${own} or more`);
  if (enemies > own) { const r = await quiet(() => standExtra(g, enemies - own, spawnPast)); if (r.stood < enemies - own) note = `stood ${r.stood} of ${enemies - own} extra: ${r.why}`; }
  const ops = g.guards.filter((x: any) => x.team === 'operative'), foes = g.guards.filter((x: any) => x.team === 'hostile');
  const upd: number[] = [], upl: number[] = [], frm: number[] = [];
  const step = (keep: boolean) => {
    g.player.visibility = 0.05;   // (Sam unseen, as the tallies pin him: the fight under test is the team's)
    const t0 = performance.now(); g.update(DT, W.input, W.cam, W.canvas); const t1 = performance.now();
    W.cam.update(DT, g.followPos(), g.spectate >= 0 ? null : g.aimPoint); W.engine.lights.update(DT, g.time); W.engine.world.dynamics = g.dynBoxes; W.engine.world.upload(); const t2 = performance.now();
    W.input.endFrame();
    if (keep) { upd.push(t1 - t0); upl.push(t2 - t1); frm.push(t2 - t0); }
  };
  const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { };
  let rounds = 0;
  try {
    for (let i = 0; i < 30; i++) step(false);
    let Eg: any = null;
    if (mode === 'fight') { for (const x of [...ops, ...foes]) x.god = true; Eg = engage(g, ops, foes, { timeout: secs + 60 }); for (let i = 0; i < 60; i++) step(false); }
    const fired = () => Eg ? Object.values(Eg.rounds as Record<string, number>).reduce((s, x) => s + (Number(x) || 0), 0) : 0;   // (the engagement's own book of rounds, both sides)
    const r0 = fired();
    for (let i = 0, n = Math.round(secs * 60); i < n; i++) step(true);
    rounds = fired() - r0;
  } finally { console.log = log; console.error = err; console.warn = warn; }
  const up = g.guards.filter((x: any) => x.state !== 'dead');
  return { scn, mode, seed, asked: enemies, enemies: up.filter((x: any) => x.team === 'hostile').length, team: up.filter((x: any) => x.team === 'operative').length, chars: 1 + g.guards.length,
    lights: g.engine.lights.lights.filter((l: any) => l.ttl < 0).length, boxes: g.dynBoxes.length, frames: frm.length, alertEnd: up.filter((x: any) => x.state === 'alert' || x.state === 'search').length, rounds,
    update: stat(upd), upload: stat(upl), frame: stat(frm), note };
}

if (import.meta.main) {
  const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const known = ['--scn', '--enemies', '--seeds', '--secs', '--modes', '--hard', '--json'];
  for (const a of argv) if (a.startsWith('--') && !known.includes(a)) { console.error(`unknown flag ${a} — ${known.join(' ')}`); process.exit(2); }
  const scn = flag('--scn') ?? 'block-four';
  const counts = (flag('--enemies') ?? '8,11,16,24,32').split(',').map(Number);
  const seeds = (s => { const m = s.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : s.split(',').map(Number); })(flag('--seeds') ?? '1-3');
  const secs = Number(flag('--secs') ?? 30), modes = (flag('--modes') ?? 'idle,fight').split(',') as ('idle' | 'fight')[];
  if (argv.includes('--hard')) setDifficulty('hard', false);
  console.log(`enemy ceiling · ${scn} · difficulty ${difficultyNow()} · ${secs} s a row at 60 Hz · seeds ${seeds.join(',')} · bun ${Bun.version} · ${navigator.hardwareConcurrency} cores`);
  await measure(scn, counts[0], seeds[0], 'fight', 5);   // (warm-up: the JIT has seen the fight before the first row is timed)
  const rows: Row[] = []; const f2 = (x: number) => x.toFixed(2);
  console.log('mode   enemies team chars lights dynboxes | update ms: mean   p50   p95   p99   max | upload mean | frame mean  p99 | rounds/s  note');
  for (const mode of modes) for (const n of counts) {
    const rs: Row[] = []; for (const seed of seeds) rs.push(await measure(scn, n, seed, mode, secs)); rows.push(...rs);
    const all = (k: 'update' | 'upload' | 'frame', f: keyof Row['update']) => f === 'max' ? Math.max(...rs.map(r => r[k][f])) : rs.reduce((s, r) => s + r[k][f], 0) / rs.length;
    const r0 = rs[0];
    console.log(`${mode.padEnd(6)} ${String(r0.enemies).padStart(7)} ${String(r0.team).padStart(4)} ${String(r0.chars).padStart(5)} ${String(r0.lights).padStart(6)} ${String(Math.round(rs.reduce((s, r) => s + r.boxes, 0) / rs.length)).padStart(8)} | ${' '.repeat(10)} ${f2(all('update', 'mean')).padStart(5)} ${f2(all('update', 'p50')).padStart(5)} ${f2(all('update', 'p95')).padStart(5)} ${f2(all('update', 'p99')).padStart(5)} ${f2(all('update', 'max')).padStart(5)} | ${f2(all('upload', 'mean')).padStart(11)} | ${f2(all('frame', 'mean')).padStart(10)} ${f2(all('frame', 'p99')).padStart(5)} | ${(rs.reduce((s, r) => s + r.rounds, 0) / rs.length / secs).toFixed(1).padStart(8)}  ${r0.note}`);
  }
  const out = flag('--json'); if (out) writeFileSync(out, JSON.stringify({ scn, secs, seeds, difficulty: difficultyNow(), bun: Bun.version, cores: navigator.hardwareConcurrency, rows }, null, 1));
  process.exit(0);
}
