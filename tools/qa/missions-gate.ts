#!/usr/bin/env bun
// THE MISSIONS GATE — every mission on the Missions list (src/scene/scenarioList.ts SCENARIOS and QUIET_MISSIONS) played to its end: the squad missions by the scripted commander AS SHIPPED,
// the quiet ones (kind 'quiet') by the scripted lone player of tools/qa/solo-night.ts --quiet
// (tools/qa/ships.ts: the shipped profile, src/host/profile.ts), two seeds each — the quiet rows EIGHT (a quiet run is a deal of start × spot × patrol set off its
// seed, and a level can be shut on one deal in a dozen: two seeds never met the crossing's south start with its lane man in the kerb gap; each row's line says how
// many of the level's deals its seeds dealt). `probes.ts missions-shipped` (family missions), or by itself:
//   bun run tools/qa/missions-gate.ts [--seeds 1-2] [--quiet-seeds 1-8] [--jobs N] [--cap 300] [--json f.json]
// RED: a run that throws, a run that stalls (the commander stuck, the mission not ended inside --cap seconds), a mission of the list that was not played.
// NOT judged: who won, how many came out, the smells — those are the tallies' business (playthrough.ts's own report is printed under the verdict lines).
// About five minutes at --jobs 4 on four cores. Exit 0 = every mission ended on every seed, 1 = a red line.
import { resolve } from 'node:path';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
const ROOT = resolve(import.meta.dir, '../..');

export async function missionsGate(opts: { seeds?: string; quietSeeds?: string; jobs?: number; cap?: number; json?: string } = {}): Promise<boolean> {
  type Row = { id: string; title: string; kind: string; squad: number; level?: string };
  const { SCENARIOS, QUIET_MISSIONS: QUIET } = await import(`${ROOT}/src/scene/scenarioList.ts`) as { SCENARIOS: Row[]; QUIET_MISSIONS: Row[] };
  const seeds = opts.seeds ?? '1-2', quietSeeds = opts.quietSeeds ?? '1-8', jobs = opts.jobs ?? Math.max(1, Math.min(4, cpus().length)), cap = opts.cap ?? 300;
  const dir = opts.json ? null : mkdtempSync(resolve(tmpdir(), 'missions-gate-')), file = opts.json ?? resolve(dir!, 'runs.json');
  let ok = true;
  try {
    const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'ships.ts'), '--seeds', seeds, '--jobs', String(jobs), '--cap', String(cap), '--json', file], { stdout: 'pipe', stderr: 'pipe' });
    const [out, err] = await Promise.all([new Response(pr.stdout).text(), new Response(pr.stderr).text()]); const code = await pr.exited;
    let runs: { scn: string; seed: number; end: string; why: string; t: number; team: number; of: number }[] = [];
    try { runs = JSON.parse(readFileSync(file, 'utf8')).runs; } catch { /* no file: the play-through died before its report */ }
    if (!runs.length) { console.log(`- FAIL — the play-through left no runs (exit ${code}) — ${err.trim().split('\n').slice(-3).join(' / ').slice(0, 400)}`); return false; }
    for (const e of SCENARIOS) {
      const mine = runs.filter(r => r.scn === e.id), bad = mine.filter(r => r.end === 'error' || r.end === 'stalled');
      const pass = mine.length > 0 && bad.length === 0; if (!pass) ok = false;
      console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${e.id} (${e.title}): ${mine.length ? mine.map(r => `seed ${r.seed} ${r.end} at ${r.t} s, team ${r.team}/${r.of}`).join(' · ') : 'not played'}`
        + bad.map(r => `\n      seed ${r.seed}: ${String(r.why).split('\n')[0].slice(0, 300)}`).join(''));
    }
    const strangers = runs.filter(r => !SCENARIOS.some(e => e.id === r.scn)); if (strangers.length) { ok = false; console.log(`- FAIL — runs of missions the list does not have: ${strangers.map(r => r.scn).join(' ')}`); }
    if (code !== 0 && ok) { ok = false; console.log(`- FAIL — the play-through exited ${code} with every run ended — ${err.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`); }
    console.log(`  (${runs.length} runs as shipped, seeds ${seeds}; the play-through's own report:)`);
    for (const ln of out.trim().split('\n')) console.log(`    ${ln}`);
    // THE QUIET MISSIONS: no squad to command — the scripted lone player (solo-night.ts --quiet, the partner with --squad 1) takes the thing and walks out,
    // a ghost (no eye finds him, nothing hurts him: solo-night.ts --ghost) so the run is the mission's own machinery start to debrief, not his luck. Red the same way: a throw, a stall, a row not played.
    for (const e of QUIET) {
      const f = resolve(dir ?? tmpdir(), `quiet-${e.id}.json`);
      const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'solo-night.ts'), ...(e.level ? ['--level', e.level] : []), '--quiet', ...(e.squad ? ['--squad', '1'] : []), '--plan', 'sneak', '--ghost',
        '--seeds', quietSeeds, '--jobs', String(jobs), '--cap', String(cap), '--json', f], { stdout: 'pipe', stderr: 'pipe' });
      const [, err] = await Promise.all([new Response(pr.stdout).text(), new Response(pr.stderr).text()]); await pr.exited;
      let runs: { seed: number; end: string; why: string; t: number; rating: string | null; quiet?: string }[] = [];
      try { runs = JSON.parse(readFileSync(f, 'utf8')).runs; } catch { /* no file: it died before its report */ }
      // (which deals those seeds were: read off each run's own summary line — game/quiet.ts summary() — 'start a/A … (b/B) · patrol c/C')
      const deals = new Set<string>(); let of = 0;
      for (const r of runs) { const m = /start (\d+)\/(\d+).*?\((\d+)\/(\d+)\) · patrol (\d+)\/(\d+)/.exec(r.quiet ?? ''); if (m) { deals.add(`${m[1]}.${m[3]}.${m[5]}`); of = Number(m[2]) * Number(m[4]) * Number(m[6]); } }
      const bad = runs.filter(r => r.end !== 'done'), pass = runs.length > 0 && bad.length === 0; if (!pass) ok = false;
      console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${e.id} (${e.title}): ${runs.length ? runs.map(r => `seed ${r.seed} ${r.end} at ${Math.round(r.t)} s${r.rating ? `, ${r.rating}` : ''}`).join(' · ') + (of ? ` · ${deals.size} of the level's ${of} deals` : '') : `not played — ${err.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`}`
        + bad.map(r => `\n      seed ${r.seed}: ${String(r.why).split('\n')[0].slice(0, 300)}`).join(''));
      if (!dir) rmSync(f, { force: true });
    }
  } finally { if (dir) rmSync(dir, { recursive: true, force: true }); }
  return ok;
}

if (import.meta.main) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  process.exit(await missionsGate({ seeds: flag('--seeds'), quietSeeds: flag('--quiet-seeds'), jobs: flag('--jobs') ? Number(flag('--jobs')) : undefined, cap: flag('--cap') ? Number(flag('--cap')) : undefined, json: flag('--json') }) ? 0 : 1);
}
