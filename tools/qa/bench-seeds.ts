// THE BENCHMARK'S SEEDS — each of the benchmark's scenes (src/host/benchScenes.ts) played headless by the hands-off player (src/host/handsoff.ts, the hands the page
// uses) over a set of seeds, counted, and the seed named whose fight is the most ordinary one of the set.
//   bun run tools/qa/bench-seeds.ts                                      every scene over seeds 1‥12: a row a run, then the pick per scene
//   bun run tools/qa/bench-seeds.ts --scn snow,dark --seeds 1-24 --jobs 3 [--cap 240] [--json out.json]
//   bun run tools/qa/bench-seeds.ts --trace snow:7                       one run in this process with the hands' timeline
//   bun run tools/qa/bench-seeds.ts --twice snow:7                       the same run twice, digest against digest (exit 1 if they part): what a seed names headless
//   --hz 120 | --jitter 0.08   the game stepped at another rate / at a rate that wobbles (the page's step when the fixed step is off): how far a seed's fight moves with it
//   --check                    each scene's kept seed (benchScenes.ts) played once: red if it no longer ends 'taken' inside the scene's seconds (the pick has gone stale)
// THE STAND: the page as it opens (TPS_PROFILE=shipped unless the caller said otherwise), the game on its own die (`seed`, the page's ?seed=N) and the deal pinned by the
// same number (`roomclear=N`), the scene's difficulty and its god mode (a scene with it off ends where Sam goes down, here as on the page).
// THE PICK. Of the runs that end 'taken' inside the scene's seconds: each run's distance from the set's medians in three numbers — seconds to
// take the floor, rounds fired by everybody, teammates lost — each over that number's spread (the median distance from the median, floored), summed. The smallest
// sum is the pick; ties go to the lower seed.
// WHAT IT CANNOT SAY. No GPU: Sam is seen through the CPU estimate of the light on him, and there is no smoke in a sight line. The page's fight on the same seed is
// the same deal and the same dice, read through the picture's own light meter at the display's own frame time: it is not this fight tick for tick.
process.env.TPS_PROFILE ??= 'shipped';
const { standUp, ROOT } = await import('./headless.ts');
const { readFileSync, existsSync, writeFileSync } = await import('node:fs');
const { resolve } = await import('node:path');
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lookLevelFile } = await import(`${ROOT}/src/scene/look.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { HandsOff } = await import(`${ROOT}/src/host/handsoff.ts`);
const { BENCH_SCENES } = await import(`${ROOT}/src/host/benchScenes.ts`);

interface Out { scn: string; seed: number; end: string; t: number; men: number; of: number; left: number; defenders: number; rounds: number; samHits: number; b: number; dark: boolean; digest: string; trace: string[]; why?: string }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const fnv = (h: number, s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const levelOfFile = (file: string): any => loadLevel(parseLevelData(readFileSync((f => existsSync(f) ? f : resolve(ROOT, 'levels', file))(resolve(ROOT, 'levels', lookLevelFile(file))), 'utf8')));

async function playOne(id: string, seed: number, o: { cap?: number; hz?: number; jitter?: number; verbose?: boolean } = {}): Promise<Out> {
  const S = BENCH_SCENES.find((s: any) => s.id === id); if (!S) throw new Error(`no scene '${id}' (scenes: ${BENCH_SCENES.map((s: any) => s.id).join(', ')})`);
  const E = SCENARIOS.find((e: any) => e.id === S.scn);
  const out: Out = { scn: id, seed, end: 'error', t: 0, men: 0, of: 0, left: 0, defenders: 0, rounds: 0, samHits: 0, b: 0, dark: false, digest: '', trace: [] };
  const log = console.log, err = console.error, warn = console.warn; let H: any = null;
  try {
    if (!o.verbose) console.log = console.error = console.warn = () => { };
    if (S.hard) setDifficulty('hard', false);
    const W: any = await standUp({ uploadEvery: 4, seed, level: levelOfFile(E.level) }), g = W.game;
    const q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`);
    const { why } = await startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`start refused — ${why}`);
    g.godMode = S.god;
    H = new HandsOff(g, W.input, W.cam, W.canvas, { ...S.plan, seed, cap: o.cap ?? S.secs });
    const hz = o.hz ?? 60, seenEv = new Set<any>(); let vis = 0.05, h = 2166136261, next = 0.5, k = 0;
    const a = g.player.char.anim, hf = a.hitFrom.bind(a); a.hitFrom = (d: unknown) => { out.samHits++; return hf(d); };
    W.step(1 / hz); out.of = g.orders.squad().length; out.defenders = g.guards.filter((x: any) => x.team === 'hostile').length;
    while (!H.end) {
      const dt = (1 / hz) * (o.jitter ? 1 + o.jitter * Math.sin(++k * 1.7) : 1);
      H.tick(dt); if (H.end) break;
      { const pl = g.player, c = pl.char, Ev = Math.max(lightEstimateAt(g, c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]]), lightEstimateAt(g, c.bones.head ?? [c.pos[0], 1.6, c.pos[2]]));   // (the light on Sam: the CPU estimate where the page has the picture's meter)
        vis += (g.visibilityOf(Ev) - vis) * (1 - Math.exp(-6 * dt)); pl.irradiance = Ev; pl.visibility = vis; }
      W.step(dt);
      for (const e of g.events) { if (seenEv.has(e)) continue; seenEv.add(e); if ((e.kind === 'shot' && e.loud !== false) || e.kind === 'guardShot') out.rounds++; }
      if (seenEv.size > 4000) { seenEv.clear(); for (const e of g.events) seenEv.add(e); }
      if (H.t >= next - 1e-9) { h = fnv(h, JSON.stringify(digestGame(g, true))); next += 0.5; }
      if (g.blackout.active) out.dark = true;
    }
    out.end = H.end; out.digest = h.toString(16).padStart(8, '0');
    if (o.verbose) { console.log = log; for (const l of H.trace) console.log(l); }
  } catch (e: any) { out.end = 'error'; out.why = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
  finally { console.log = log; console.error = err; console.warn = warn; }
  if (H) { const g = H.g; out.t = +H.t.toFixed(1); out.men = g.orders.squad().filter((x: any) => x.state !== 'dead').length; out.left = H.left.length; out.b = H.b; out.trace = H.trace; }
  return out;
}
const line = (r: Out) => `${r.scn.padEnd(8)} seed ${String(r.seed).padStart(3)} · ${r.end.padEnd(6)} ${f1(r.t).padStart(6)} s · men ${r.men}/${r.of} · left ${r.left}/${r.defenders} · rounds ${String(r.rounds).padStart(4)} · Sam hit ${r.samHits} · B ${r.b}${r.dark ? ' · dark' : ''} · ${r.digest}${r.end === 'error' ? ` · ${r.why}` : ''}`;

/** the pick: the run nearest the set's medians (the header's rule); null when no run of the set ends 'taken' */
export function pick(runs: Out[]): { seed: number; why: string; table: { seed: number; d: number }[] } | null {
  const ok = runs.filter(r => r.end === 'taken'); if (!ok.length) return null;
  const cols: ((r: Out) => number)[] = [r => r.t, r => r.rounds, r => r.of - r.men], floor = [5, 20, 0.5];
  const med = cols.map(c => median(ok.map(c))), mad = cols.map((c, i) => Math.max(floor[i], median(ok.map(r => Math.abs(c(r) - med[i])))));
  const table = ok.map(r => ({ seed: r.seed, d: +cols.reduce((s, c, i) => s + Math.abs(c(r) - med[i]) / mad[i], 0).toFixed(2) })).sort((a, b) => a.d - b.d || a.seed - b.seed);
  return { seed: table[0].seed, table, why: `${ok.length} of ${runs.length} runs taken · medians: ${f1(med[0])} s, ${f1(med[1])} rounds, ${f1(med[2])} teammates lost · spreads: ${f1(mad[0])} s, ${f1(mad[1])}, ${f1(mad[2])}` };
}

if (import.meta.main) {
  const A = process.argv.slice(2), opt = (k: string, d = '') => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] ?? '' : d; }, flag = (k: string) => A.includes(k);
  const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = /^(\d+)-(\d+)$/.exec(p); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [Number(p)]; });
  const num = (k: string) => (opt(k) ? Number(opt(k)) : undefined), o = { cap: num('--cap'), hz: num('--hz'), jitter: num('--jitter') };
  const pass = [...(o.cap ? ['--cap', String(o.cap)] : []), ...(o.hz ? ['--hz', String(o.hz)] : []), ...(o.jitter ? ['--jitter', String(o.jitter)] : [])];
  if (flag('--trace')) { const [s, n] = opt('--trace').split(':'); const r = await playOne(s, +n, { ...o, verbose: true }); console.log(line(r)); process.exit(r.end === 'error' ? 1 : 0); }
  if (flag('--twice')) { const [s, n] = opt('--twice').split(':'); const a = await playOne(s, +n, o), b = await playOne(s, +n, o); console.log(line(a)); console.log(line(b)); const same = a.digest === b.digest && a.end !== 'error'; console.log(same ? 'PASS — the same seed played the same run, digest for digest' : 'FAIL — the two runs part'); process.exit(same ? 0 : 1); }
  if (flag('--one')) { const [s, n] = opt('--one').split(':'); const r = await playOne(s, +n, o); const { trace, ...rest } = r; process.stdout.write(`@@${JSON.stringify(rest)}\n`); process.exit(0); }
  const check = flag('--check'), scns: string[] = (opt('--scn') || BENCH_SCENES.map((s: any) => s.id).join(',')).split(','), jobs = Math.max(1, Number(opt('--jobs', '3')));
  if (scns.some(s => !BENCH_SCENES.some((x: any) => x.id === s))) { console.error(`scenes: ${BENCH_SCENES.map((s: any) => s.id).join(', ')}`); process.exit(2); }
  const todo = scns.flatMap(s => (check ? [BENCH_SCENES.find((x: any) => x.id === s).seed] : seedsOf(opt('--seeds', '1-12'))).map(n => ({ s, n }))), runs: Out[] = []; let next = 0;
  const worker = async () => { while (next < todo.length) { const j = todo[next++];
      const p = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.s}:${j.n}`, ...pass], { stdout: 'pipe', stderr: 'ignore', env: process.env });
      const txt = await new Response(p.stdout).text(); await p.exited; const m = /^@@(.*)$/m.exec(txt);
      const r: Out = m ? JSON.parse(m[1]) : { scn: j.s, seed: j.n, end: 'error', why: 'no result line', t: 0, men: 0, of: 0, left: 0, defenders: 0, rounds: 0, samHits: 0, b: 0, dark: false, digest: '', trace: [] };
      runs.push(r); console.error(line(r)); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => scns.indexOf(a.scn) - scns.indexOf(b.scn) || a.seed - b.seed);
  let bad = runs.some(r => r.end === 'error');
  for (const s of scns) { const rs = runs.filter(r => r.scn === s), S = BENCH_SCENES.find((x: any) => x.id === s);
    if (check) { const r = rs[0], ok = r?.end === 'taken'; if (!ok) bad = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}: its kept seed ${S.seed} ${ok ? `still takes the floor (${f1(r.t)} s of ${S.secs}, men ${r.men}/${r.of}, ${r.rounds} rounds)` : `ended '${r?.end}' at ${f1(r?.t ?? 0)} s: pick again (bun run tools/qa/bench-seeds.ts --scn ${s})`}`); continue; }
    const p = pick(rs); console.log(`\n${s} (${S.scn}${S.hard ? ', hard' : ''}): ${rs.length} seeds · ${p ? `PICK seed ${p.seed} — ${p.why}` : 'no run taken'}${p ? `\n  nearest first: ${p.table.slice(0, 6).map(x => `${x.seed} (${x.d})`).join(' · ')} · kept in benchScenes.ts: ${S.seed}` : ''}`); }
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(runs, null, 1));
  process.exit(bad ? 1 : 0);
}
