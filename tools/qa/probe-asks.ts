// WHO GETS A PLACE IN THE LIGHT PROBE'S TABLE — counted, headless. The probe (render/probe.ts) answers MAX_QUERIES asks a frame; a frame of the four-man squad
// against a full house asks for more. This stands The block up (Sam + the four + its eight defenders, then game/stress.ts for more), puts everybody in the fight
// with nobody able to die, and for every frame takes the asks in the order the game made them and sets two rules side by side:
//   before   first come, first kept (the table as it was: the first MAX_QUERIES asks of the frame)
//   after    the probe's own table — for real: the harness's probe IS the page's class on a fake device, and encode() is called on it here every frame
// by what each ask is for. COUNTED HERE, NOT SEEN: no GPU answers anything headless, so this says which asks reach the kernel and nothing about the picture, and
// no headless tally (playthrough.ts, the probes) can see any of it — their senses are the CPU stand-ins either way.
//   bun run tools/qa/probe-asks.ts [--enemies 8,11] [--seeds 1-3] [--secs 20]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { engage } = await import(`${ROOT}/src/game/guards.ts`);
const { standExtra } = await import(`${ROOT}/src/game/stress.ts`);
const { MAX_QUERIES } = await import(`${ROOT}/src/render/probe.ts`);

const argv = process.argv.slice(2); const known = ['--enemies', '--seeds', '--secs'];
for (const a of argv) if (a.startsWith('--') && !known.includes(a)) { console.error(`unknown flag ${a} — ${known.join(' ')}`); process.exit(2); }
const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const counts = (flag('--enemies') ?? '8,11').split(',').map(Number), secs = Number(flag('--secs') ?? 20);
const seeds = (s => { const m = s.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : s.split(',').map(Number); })(flag('--seeds') ?? '1-3');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KINDS = ["Sam's meter", "a defender's line to Sam", "the room fight's lines", "a unit's own meter", 'other meters', "fog of war's lines"] as const;
const kindOf = (k: string) => k.startsWith('player') ? 0 : /^smoke\d/.test(k) ? 1 : k.startsWith('fow') ? 5 : k.startsWith('unit') ? 3 : /^(held|bodyL|srch|civ[CH])/.test(k) ? 4 : 2;
const E = SCENARIOS.find((e: any) => e.id === 'block-four'), data = readFileSync(resolve(ROOT, 'levels', E.level), 'utf8');
const log = console.log, warn = console.warn, err = console.error; let bad = false;

console.log(`probe asks · The block, everybody in the fight and nobody able to die · table ${MAX_QUERIES} · ${secs} s a seed at 60 Hz · seeds ${seeds.join(',')}`);
for (const n of counts) {
  const asked = KINDS.map(() => 0), before = KINDS.map(() => 0), after = KINDS.map(() => 0); let frames = 0, most = 0, over = 0, samOutBefore = 0, samOutAfter = 0, gapBefore = 0, gapAfter = 0, never = 0, neverAfter = 0, units = 0, up = n; const notes: string[] = [];
  for (const seed of seeds) {
    Math.random = seeded(0x9137 + seed * 7919); console.log = console.warn = console.error = () => { };
    const W: any = await standUp({ uploadEvery: 1, level: loadLevel(parseLevelData(data)) }); const g = W.game; g.godMode = true;
    const { why } = startFromQuery(g, new URLSearchParams((scenarioQuery(E) as string).replace(/roomclear(=\d+)?/, `roomclear=${seed}`)));
    if (why) { console.log = log; console.warn = warn; console.error = err; console.error(`start refused — ${why}`); process.exit(1); }
    const own = g.guards.filter((x: any) => x.team === 'hostile').length;
    if (n > own) { const r = standExtra(g, n - own); if (r.stood < n - own) notes.push(`seed ${seed}: stood ${r.stood} of ${n - own} extra — ${r.why}`); }
    up = Math.min(up, g.guards.filter((x: any) => x.team === 'hostile').length);
    const ops = g.guards.filter((x: any) => x.team === 'operative'), foes = g.guards.filter((x: any) => x.team === 'hostile');
    for (const x of [...ops, ...foes]) x.god = true; engage(g, ops, foes, { timeout: secs + 30 });
    const P = g.probe, order: string[] = []; const q0 = P.query.bind(P), s0 = P.querySegment.bind(P);
    P.query = (k: string, ...x: any[]) => { order.push(k); return q0(k, ...x); }; P.querySegment = (k: string, ...x: any[]) => { order.push(k); return s0(k, ...x); };
    const anything: any = new Proxy(function () { }, { get: (_t, p) => p === Symbol.toPrimitive ? () => 0 : anything, apply: () => anything });
    const flush = () => { P.pending.length = 0; P.inflight.length = 0; order.length = 0; };
    const lastB = new Map<string, number>(), lastA = new Map<string, number>(), worstB = new Map<string, number>(), worstA = new Map<string, number>();
    for (let i = 0; i < 60; i++) { W.step(1 / 60); flush(); }
    for (let f = 0, N = Math.round(secs * 60); f < N; f++) {
      W.step(1 / 60);
      const kept0 = order.slice(0, MAX_QUERIES);
      P.encode(anything, anything, anything); const kept1: string[] = P.inflight.length ? P.inflight[P.inflight.length - 1].keys : [];
      frames++; most = Math.max(most, order.length); if (order.length > MAX_QUERIES) over++;
      for (const k of order) asked[kindOf(k)]++; for (const k of kept0) before[kindOf(k)]++; for (const k of kept1) after[kindOf(k)]++;
      if (!kept0.includes('playerHead') || !kept0.includes('playerChest')) samOutBefore++; if (!kept1.includes('playerHead') || !kept1.includes('playerChest')) samOutAfter++;
      for (const k of new Set(order)) if (k.startsWith('unit')) {   // (the longest a unit's meter went unanswered, in frames)
        for (const [kept, last, worst] of [[kept0, lastB, worstB], [kept1, lastA, worstA]] as const) { if (kept.includes(k)) last.set(k, f); worst.set(k, Math.max(worst.get(k) ?? 0, f - (last.get(k) ?? -1))); } }
      flush();
    }
    for (const [k, w] of worstB) { units++; if (lastB.has(k)) gapBefore = Math.max(gapBefore, w); else never++; }
    for (const [k, w] of worstA) { if (lastA.has(k)) gapAfter = Math.max(gapAfter, w); else neverAfter++; }
    console.log = log; console.warn = warn; console.error = err;
  }
  for (const t of notes) console.log(t);
  console.log(`\n4 + ${up} (Sam, four teammates, ${up} defenders) — asks a frame: most ${most}, over the table on ${(100 * over / frames).toFixed(0)} % of ${frames} frames`);
  console.log('  what the ask is for            asked   kept before   kept after   (a frame, mean)');
  KINDS.forEach((name, i) => { if (asked[i]) console.log(`  ${name.padEnd(28)} ${(asked[i] / frames).toFixed(1).padStart(7)} ${(before[i] / frames).toFixed(1).padStart(13)} ${(after[i] / frames).toFixed(1).padStart(12)}`); });
  console.log(`  all                          ${(asked.reduce((a, b) => a + b, 0) / frames).toFixed(1).padStart(7)} ${(before.reduce((a, b) => a + b, 0) / frames).toFixed(1).padStart(13)} ${(after.reduce((a, b) => a + b, 0) / frames).toFixed(1).padStart(12)}`);
  console.log(`  frames Sam's meter missed the table: before ${samOutBefore}, after ${samOutAfter} · unit meter keys never answered: before ${never} of ${units}, after ${neverAfter} · longest wait of a unit's meter that is answered: before ${gapBefore} frame(s), after ${gapAfter}`);
  if (samOutAfter || neverAfter) bad = true;
}
process.exit(bad ? 1 : 0);
