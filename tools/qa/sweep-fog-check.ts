// The F8 sweep's 'fog of war: the hard edge of before' row (src/ui/perfsweep.ts) against the game's own fog object and the renderer's own frame: the names the row
// reads loosely (FogOfWar.knobs.edge; FogFrame.on / count / full / sight / edge) are the real ones, so a rename is red here and not a row skipped for ever.
// No level, no GPU. On a build from before the soft edge (FOG has no `edge`) the check is that the row is skipped by name; perf-sweep-logic.ts holds the stepping.
//   bun run tools/qa/sweep-fog-check.ts   (exit 0 = all pass)
import { PerfSweep } from '../../src/ui/perfsweep';
import { FOG, FogOfWar } from '../../src/game/fogofwar';
import { makeFogFrame } from '../../src/render/fogofwar';
let now = 0; (performance as any).now = () => now;
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };
const K = FOG as unknown as Record<string, unknown>, has = typeof K.edge === 'number', was = K.edge;
const fow = new FogOfWar({} as any) as any, F = makeFogFrame() as any;
check(fow.knobs === FOG && typeof F.on === 'boolean' && typeof F.count === 'number', 'the fog object hands its table as `knobs`, and a frame carries `on` and `count`');
fow.on = true; F.on = true; F.count = 2;
const ev: any[] = [], rec: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { ev.push(JSON.parse(t)); } };
const sw = new PerfSweep({ settings: { renderScale: 0.8 }, width: 100, height: 50, timer: { enabled: true }, fogFrame: F } as any, { fogOfWar: fow } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec, () => {});
const opts = { rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['fogEdge'] };
if (!has) { const r = sw.start(opts), why = ev.find(x => x.op === 'begin')?.skipped ?? r; check(r === 'nothing to flip' && !sw.active && !('edge' in F), `a build from before the soft edge: nothing to flip, the frame has no band either (${JSON.stringify(why)})`); }
else {
  check(typeof F.edge === 'number' && typeof F.full === 'boolean' && typeof F.sight === 'boolean', 'a frame carries `edge`, `full` and `sight`');
  F.full = true; F.sight = true; F.edge = Math.max(0, K.edge as number) || 0.5; if (!((K.edge as number) > 0)) K.edge = 0.5;
  const band = K.edge, before = JSON.stringify(K); sw.start(opts);
  const row = ev.find(x => x.op === 'begin')?.rows.find((r: any) => r.id === 'fogEdge');
  check(sw.active && !!row && row.from.fogEdge === band && row.to.fogEdge === 0, `on the real table and a real frame the row arms (${JSON.stringify(row)})`);
  for (let i = 0; i < 400 && !ev.some(x => x.op === 'seg' && x.state === 'flip'); i++) { now += 16; sw.tick(); }
  check(K.edge === 0 && F.edge === 0, 'flipped: the band is nothing in FOG and on the frame');
  sw.stop(); check(JSON.stringify(K) === before && F.edge > 0, 'stopped: FOG is exactly as it was and the frame has its band again');
}
if (has) K.edge = was;
process.exit(red ? 1 : 0);
