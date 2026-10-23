// TWO STATES SIDE BY SIDE (src/game/rollback.ts stateFlat / flatDiff / stateDiff): what the other checks ask when a state's word differs and they want to
// know WHERE. It held a token and a joined path string for every value of both states (2 GB for two squad games on the page's stand) and stopped at the
// first shape that differed; now a state is kept as rows of thirteen bytes over a tree of its paths, and the compare goes on past a shape.
//
//   bun run tools/qa/statediff-check.ts            exit 0 = all pass, 1 = a FAIL line
//   STATEDIFF_BREAK=1 …   = the changes below are never made and the same lines asked: must fail
//   bun run tools/qa/probes.ts statediff           (family checkpoints)
//   Either stand (TPS_PROFILE=shipped in front for the page's): one game stood, a second and a half stepped, then changed by hand and put back by a snapshot.
//
//   itself    a state against itself: no line
//   rows      the old two arrays (`toks`, `paths`) are still there for a tool that reads them, a row a value, a typed array's every element one
//   weight    what a flat state keeps by its own count (rows, the path tree, the typed arrays' bytes, its strings), in MB — printed; the line holds it under
//             a tenth of the 150 bytes a value the strings took. The process's memory is not read here (measured by hand: docs/agents/replays.md)
//   value     a number, a flag, a text, a number gone to null, a typed array's element: each is one line at its own path, the walk stays in step (no
//             line in brackets) and a number changed FAR LATER in the walk is still found
//   shape     with no object first met in what is left of it — an array one number longer, an object with one more key, two such one after the other: one
//             line each that ends '(the rest of it is not compared)', and the later number still found
//   over      where the walks cannot stay in step the compare ENDS and says so, never goes on quietly: an array one OBJECT longer; a side table's row only
//             one state has (the line in brackets names where the second stands); and a last row only one state has is named by its place
//   own       `own` leaves the modules' registered variables and containers out: fewer values than the whole
import { standUp, ROOT } from './headless.ts';

export async function statediffCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const RB = await import(`${ROOT}/src/game/rollback.ts`) as typeof import('../../src/game/rollback');
  const BREAK = process.env.STATEDIFF_BREAK === '1';
  const log = console.log, W: any = await (async () => { console.log = () => {}; try { return await standUp({ uploadEvery: 4 }); } finally { console.log = log; } })();
  for (let i = 0; i < 90; i++) W.step(1);
  const g: any = W.game; let ok = true;
  const line = (pass: boolean, what: string, more = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${more ? `\n    ${more}` : ''}`); if (!pass) ok = false; };
  const base = RB.stateFlat(g), S = RB.takeSnapshot(g), pl = g.player;
  line(RB.flatDiff(base, RB.stateFlat(g), 50).length === 0, 'itself: a state against itself has no line');
  { const F = RB.stateFlat(g), t = F.toks, p = F.paths, at = F.kind.indexOf(4), el = at < 0 ? '' : `${F.pathOf(F.node[at])}[0]`;   // (4: a typed array's row)
    line(t.length === F.values && p.length === F.values && F.n < F.values && F.typed.length > 0 && p.includes(el), 'rows: the old two arrays are there, a row a value, a typed array\'s element one', `${F.values} values in ${F.n} rows kept, ${F.typed.length} typed arrays whole`);
    const mb = (F.n * 13 + F.nodes * 8 + F.refs.size * 16 + F.typed.reduce((s, x) => s + x.byteLength + 64, 0) + F.strs.reduce((s, x) => s + 2 * x.length + 16, 0) + F.segs.reduce((s, x) => s + 2 * x.length + 16, 0)) / 1048576;
    line(mb * 1048576 < base.values * 15, 'weight: by its own count a flat state keeps under a tenth of the 150 bytes a value it kept as strings', `${mb.toFixed(1)} MB for ${base.values} values (${(mb * 1048576 / base.values).toFixed(1)} bytes a value)`); }
  // a number far on in the walk, changed with every trial: is the walk still in step when it gets there?
  const lateKey = Object.keys(g.mission).find(k => typeof g.mission[k] === 'number')!, late = `game.mission.${lateKey}: `;
  const typedKey = Object.keys(g.col).find(k => { const v: any = g.col[k]; return ArrayBuffer.isView(v) && (v as any).length > 20; })!;
  const trial = (kind: string, what: string, change: () => void, want: (d: string[]) => boolean, goesOn = true): void => {
    if (!BREAK) { change(); g.mission[lateKey] += 1; }
    const d = RB.flatDiff(base, RB.stateFlat(g), 40), pass = want(d) && (!goesOn || d.some(x => x.startsWith(late))); RB.restoreSnapshot(S);
    line(pass, `${kind}: ${what}${goesOn ? ', and the later number is found' : ''}`, o.verbose || !pass ? d.slice(0, 6).map(x => x.slice(0, 200)).join('\n    ') : `${d.length} lines`);
  };
  const plain = (d: string[]) => !d.some(x => x.startsWith('(')), REST = ' (the rest of it is not compared)', OVER = '(the shapes part here: nothing after it is compared; the second stands at ';
  trial('value', 'a number', () => { g.time += 1; }, d => plain(d) && d.length === 2 && d[0].startsWith('game.time: '));
  trial('value', 'a flag', () => { pl.nv = !pl.nv; }, d => plain(d) && d.length === 2 && /^game\.player\.nv: (true \| false|false \| true)$/.test(d[0]));
  trial('value', 'a text', () => { g.mission.stage = 'elsewhere'; }, d => plain(d) && d.length === 2 && d.some(x => x.startsWith('game.mission.stage: "') && x.endsWith('| "elsewhere"')));
  trial('value', 'a number gone to null', () => { pl.pace = null; }, d => plain(d) && d.length === 2 && d.some(x => x.startsWith('game.player.pace: ') && x.endsWith('| null')));
  trial('value', `a typed array's element (col.${typedKey})`, () => { g.col[typedKey][7] += 1; }, d => plain(d) && d.length === 2 && d[0].startsWith(`game.col.${typedKey}[7]: `));
  trial('shape', 'an array one number longer', () => { pl.char.pos.push(7); }, d => plain(d) && d.length === 2 && d.some(x => x.endsWith('an array of 3 | an array of 4' + REST)));
  trial('shape', 'an object with one more key', () => { pl.oneMore = 5; }, d => plain(d) && d.length === 2 && d.some(x => x === 'game.player: no more keys | "oneMore"' + REST));
  trial('shape', 'two of them, one after the other', () => { pl.char.pos.push(7); pl.oneMore = 5; }, d => plain(d) && d.length === 3 && d.filter(x => x.endsWith(REST)).length === 2);
  trial('over', 'an array one OBJECT longer ends the compare, and says so', () => { g.guards.push({ a: [1, 2], b: { c: 1 } }); },
    d => d.length === 2 && d[0].startsWith('game.guards: an array of ') && d[1] === OVER + 'game.guards)', false);
  { const { sideRegistry, SideMap } = await import(`${ROOT}/src/math/side.ts`) as typeof import('../../src/math/side');
    const t = sideRegistry().tables.find(x => x instanceof SideMap && x.sideName !== undefined && !x.has(pl.char) && x.liveKeys().length > 0) as InstanceType<typeof SideMap<object, unknown>> | undefined;
    if (!t) line(false, 'over: no side table without a row for the player\'s body to try an extra row on');
    else trial('over', `a side table's row only one state has (${t.sideName}) ends the compare, and the line says where the second stands`, () => { t.set(pl.char, 1); },
      d => { const k = d.findIndex(x => x.startsWith(OVER)); return k === d.length - 1 && k >= 1 && d[k] === `${OVER}${t.sideName}{game.player.char})` && !d[k - 1].startsWith('('); }, false); }
  { // a last row only one state has: two states made by hand, the second one row of a table longer
    const mk = (rows: number) => { const F = new RB.FlatState(); for (let r = 0; r < rows; r++) { F.segs.push(`table{${r}}`); const n = F.down(0, F.segs.length - 1); F.strs.push('table'); F.row(3, r, 0, n); F.row(0, r, 0, n); } return F; };
    const d = RB.flatDiff(mk(2), mk(BREAK ? 2 : 3), 10);
    line(d.length === 1 && d[0].startsWith('table{2}: nothing | here (one state is longer: '), 'over: a last row only one state has is named by its place', d.join(' ¦ ')); }
  { const all = RB.stateFlat(g).values, own = RB.stateFlat(g, false, true).values; line(own < all, 'own: the modules\' registered variables and containers are left out', `${all} values, ${own} without them`); }
  console.log(ok ? '=== statediff-check: ALL PASS ===' : '=== statediff-check: FAILED ===');
  return ok;
}

if (import.meta.main) process.exit(await statediffCheck({ verbose: process.argv.includes('--verbose') }) ? 0 : 1);
