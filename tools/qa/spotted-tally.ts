// spotted-tally.ts — pair-sneak.ts's rows read for what spotted.ts is about: who tips a suspicious man over, who makes the first loud noise, and what
// becomes of the pair once it is caught. Two (or more) folders of rows side by side, the same seeds in each.
//
//   bun run tools/qa/spotted-tally.ts <dir>[:tag] <dir>[:tag] … [--arm pair] [--scn a,b] [--seeds] [--paired] [--md]
//
// A row is counted only when its seed is in EVERY folder for that mission (a tally under way still compares like with like).
// `--seeds` names, per mission, the seeds whose class differs between the first folder and the last. `--paired` adds, per row, how many seeds gained
// and lost it against the first folder (the discordant pairs: what a sign test reads).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; }, has = (n: string) => args.includes(n);
const dirs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--arm', '--scn'].includes(args[i - 1]))).map(a => { const [d, tag] = a.split(':'); return { d: resolve(d), tag: tag ?? '', name: a.split('/').pop()! }; });
if (dirs.length < 1) { console.error('spotted-tally.ts <dir>[:tag] <dir>[:tag] …'); process.exit(2); }
const arm = flag('--arm') ?? 'pair', md = has('--md');
const scns = flag('--scn')?.split(',') ?? [...new Set(dirs.flatMap(D => existsSync(D.d) ? readdirSync(D.d).filter(f => f.endsWith('.jsonl')).map(f => f.split('.')[0]) : []))].sort();
const load = (D: typeof dirs[number], scn: string): Map<number, any> => { const f = resolve(D.d, `${scn}.${arm}${D.tag ? '.' + D.tag : ''}.jsonl`), m = new Map<number, any>(); if (!existsSync(f)) return m;
  for (const l of readFileSync(f, 'utf8').split('\n')) { if (!l.trim()) continue; try { const r = JSON.parse(l); m.set(r.seed, r); } catch { /* a cut line */ } } return m; };

/** the partner is what tipped him: a man's first ALERT came with his eyes freshly on the partner, before anything loud */
const tipped = (r: any) => (r.m.alerts ?? []).some((a: any) => a.foe === 'mate' && a.sawAgo !== null && a.sawAgo < 0.5 && !a.loudBefore);
/** … or his first half-noticing (awareness over a half) did */
const noticedMate = (r: any) => (r.m.rousings ?? []).some((a: any) => a.foe === 'mate' && a.sawAgo !== null && a.sawAgo < 0.5 && !a.loudBefore);
/** today.md's classes, by the defenders' own state: the tool's 'ghost' is split by whether any man ever turned to a noise (went SUSPICIOUS under the bar),
 *  its 'spotted' by whether any man went on ALERT or to SEARCH (or his awareness passed three quarters) */
const need = (r: any) => { if (typeof r.m.hotN !== 'number' || typeof r.m.suspN !== 'number') throw new Error(`${r.scn}:${r.seed}: a row from a runner that did not count the men who left their calm — run it again with this build's pair-sneak.ts`); };
const alerted = (r: any) => { need(r); return r.m.hotN > 0 || Math.max(0, ...Object.values(r.m.aw ?? {}) as number[]) > 0.75; };
const turned = (r: any) => { need(r); return r.m.suspN > 0; };
const METRICS: [string, (r: any) => boolean, ((r: any) => boolean)?][] = [
  ['ghost (no defender left his calm)', r => r.cls === 'ghost' && !turned(r)], ['turned to a noise (suspicious, under the bar)', r => r.cls === 'ghost' && turned(r)],
  ['noticed (awareness at a half or over, nobody on alert)', r => r.cls === 'spotted' && !alerted(r)], ['spotted (a man on alert or searching, quiet to the end)', r => r.cls === 'spotted' && alerted(r)],
  ['loud', r => r.cls === 'loud'], ['Sam dead', r => r.cls === 'dead'], ['stalled', r => r.cls === 'stalled'],
  ['job done (their men down, Sam up)', r => !!r.finished],
  ['partner down', r => r.mateUp === false],
  ['the partner tips a man over to ALERT', tipped],
  ['a man notices with his eyes on the partner (a glimpse counts)', noticedMate],
  ['the partner takes a man by hand', r => (r.spotted?.taken ?? 0) > 0],
  ['the first loud noise is the partner\'s gun', r => r.m.firstLoud?.src === 'mate'],
  ['the partner fires before anyone is alert on them', r => !!r.m.mateFirstShot && (!r.m.caught || r.m.mateFirstShot.t < r.m.caught.t - 1e-6)],
  ['the partner\'s first round is at a man with no eyes on the pair', r => !!r.m.mateFirstShot && 'tgtSawAgo' in r.m.mateFirstShot && (r.m.mateFirstShot.tgtSawAgo === null || r.m.mateFirstShot.tgtSawAgo > 2.5)],
  ['caught (an alert man with eyes on one of them)', r => !!r.m.caught],
  ['· of the caught: both alive at the end', r => r.mateUp !== false && !r.samDown, r => !!r.m.caught],
  ['· of the caught: Sam alive', r => !r.samDown, r => !!r.m.caught],
  ['· of the caught: job done', r => !!r.finished, r => !!r.m.caught],
  ['· of the caught: the partner fired', r => (r.m.mateShots ?? 0) > 0, r => !!r.m.caught],
];
const pct = (k: number, n: number) => n ? `${k}/${n} ${(100 * k / n).toFixed(0)}%` : '—';
const all: Map<number, any>[][] = [];
for (const scn of [...scns, 'ALL']) {
  let rows: any[][];
  if (scn === 'ALL') rows = dirs.map((_, i) => all.flatMap(per => { const common = [...per[0].keys()].filter(s => per.every(m => m.has(s))); return common.map(s => per[i].get(s)); }));
  else { const per = dirs.map(D => load(D, scn)); all.push(per); const common = [...per[0].keys()].filter(s => per.every(m => m.has(s))).sort((a, b) => a - b); rows = per.map(m => common.map(s => m.get(s)));
    if (has('--seeds') && dirs.length > 1) { const a = per[0], b = per[per.length - 1]; const diff = common.filter(s => a.get(s).cls !== b.get(s).cls).map(s => `${s}:${a.get(s).cls}→${b.get(s).cls}`); console.log(`${scn} class changes: ${diff.join(' ') || 'none'}`); } }
  const n = rows[0].length; if (!n) continue;
  const errs = rows.map(R => R.filter(r => r.cls === 'error').length);
  console.log(md ? `\n**${scn}** (${n} seeds${errs.some(Boolean) ? `, errors ${errs.join('/')}` : ''})\n\n| | ${dirs.map(D => D.name).join(' | ')} |\n|---|${dirs.map(() => '---').join('|')}|` : `\n== ${scn} · ${n} seeds${errs.some(Boolean) ? ` · errors ${errs.join('/')}` : ''} ==   ${dirs.map(D => D.name).join('   |   ')}`);
  for (const [name, f, of] of METRICS) { const cells = rows.map((R, i) => { const S = of ? R.filter(of) : R; let c = pct(S.filter(f).length, S.length);
      // the same seeds, first folder against this one: how many gained it, how many lost it (rows are in the same seed order in every folder)
      if (i > 0 && !of && has('--paired')) { let up = 0, down = 0; R.forEach((r, k) => { const a = f(rows[0][k]), b = f(r); if (b && !a) up++; else if (a && !b) down++; }); c += ` (+${up} −${down})`; } return c; });
    console.log(md ? `| ${name} | ${cells.join(' | ')} |` : `  ${name.padEnd(54)} ${cells.map(c => c.padEnd(has('--paired') ? 26 : 16)).join(' ')}`); }
  const sp = rows.map(R => { const S = R.filter(r => r.spotted?.on); if (!S.length) return null; const sum = (k: string) => S.reduce((a, r) => a + (r.spotted[k] ?? 0), 0); return `wary ${sum('wary')} · caught ${sum('caught')} · freezes ${sum('freezes')} · slips ${sum('slips')} · steps ${sum('steps')} · braced for ${sum('braces')} drops · by hand ${sum('taken')} of ${sum('takes')} · cues ${sum('cues')}`; });
  if (sp.some(Boolean)) console.log(md ? `| what the partner did (all runs) | ${sp.map(s => s ?? '—').join(' | ')} |` : `  ${'what the partner did'.padEnd(54)} ${sp.map(s => s ?? '—').join('   |   ')}`);
}
