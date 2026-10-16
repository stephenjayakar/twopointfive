// Roofed or under open sky: where the man a defender first NOTICED BY SIGHT was standing, per level and arm, over a pair-sneak pool (tools/qa/pair-sneak.ts --out <dir>).
// Why it matters: the headless light estimate (guards.ts lightEstimateAt) skips directional lights, so the moon lights nobody in these runs — a yard is darker
// here than on a GPU, and a sighting indoors is the more trustworthy one.
//   bun run tools/qa/pair-sneak-sky.ts <dir> [--arms solo,pair] [--tag X]
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const argv = process.argv.slice(2); const dir = resolve(argv[0] ?? 'pair-sneak-runs'); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const wantArms = (flag('--arms') ?? 'solo,pair').split(',').filter(Boolean), TAG = flag('--tag') ?? '';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const row = (...c: (string | number)[]) => `| ${c.join(' | ')} |`, pct = (n: number, d: number) => d ? `${Math.round(100 * n / d)}%` : '—';
const log = console.log, err = console.error, hush = () => { console.log = () => {}; console.error = () => {}; }, unhush = () => { console.log = log; console.error = err; };

const files = readdirSync(dir).map(f => ({ f, m: f.match(/^(.+?)\.(solo|pairloud|pairhold|pairquiet|pairmark|pair)(?:\.(.+))?\.jsonl$/) })).filter(x => x.m && (x.m[3] ?? '') === TAG && wantArms.includes(x.m[2]));
const scns = [...new Set(files.map(x => x.m![1]))];
const out: string[] = [row('level', 'arm', 'first noticed by sight', 'the seen man roofed', 'under open sky', 'his light meter (roofed / open sky)', 'seeds under open sky'), row(...Array(7).fill('---'))];
for (const scn of scns) {
  const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) continue;
  hush(); const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) } : {}) }); unhush();
  const g = W.game;
  const open = (x: number, z: number) => { let clear = 0; for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (!g.col.solidBlocked([x + dx, 1.8, z + dz], [x + dx, 14, z + dz])) clear++; return clear >= 3; };
  for (const { f, m } of files.filter(x => x.m![1] === scn)) { let n = 0, roofed = 0, under = 0; const vr: number[] = [], vo: number[] = [], seeds: number[] = [], bySeed = new Map<number, any>();
    for (const l of readFileSync(resolve(dir, f), 'utf8').split('\n')) { if (!l.trim()) continue; try { const r = JSON.parse(l); bySeed.set(r.seed, r); } catch { /* a cut line */ } }   // (a seed's last row, as the tally)
    for (const r of bySeed.values()) { if (r.end === 'error') continue;
      const F = r.m?.firstRoused; if (!F || F.sawAgo === null || F.sawAgo === undefined || F.sawAgo > 0.6) continue; const who = F.foe === 'mate' ? F.mate : F.sam; if (!who?.at) continue;
      n++; if (open(who.at[0], who.at[1])) { under++; vo.push(who.vis); seeds.push(r.seed); } else { roofed++; vr.push(who.vis); } }
    const mean = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '—';
    out.push(row(scn, m![2], n, `${roofed} (${pct(roofed, n)})`, `${under} (${pct(under, n)})`, `${mean(vr)} / ${mean(vo)}`, seeds.slice(0, 5).join('/'))); }
}
log(out.join('\n'));
process.exit(0);
