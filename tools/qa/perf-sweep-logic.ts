// The sweep's own stepping held to a fake page (src/ui/perfsweep.ts): the warm-up before the first segment, one row flipped at a time, a row flipped the other way where the
// page already stands at it, everything back at the end and when stopped. No browser, no GPU.   bun run tools/qa/perf-sweep-logic.ts   (exit 0 = all pass)
import { PerfSweep, sweepOrder } from '../../src/ui/perfsweep';
import { Quality } from '../../src/ui/quality';
let now = 0; (performance as any).now = () => now;
const S: any = { heldAdaptive: false, heldRays: 4, gatherThird: false, renderScale: 0.8, sharpDirect: true, taau: true };
const ev: any[] = []; const rec: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(k: string, t: string) { ev.push(JSON.parse(t)); } };
const sw = new PerfSweep({ settings: S, width: 100, height: 50, timer: { enabled: true } } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec, () => {});
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };
console.log(sw.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['heldAdaptive', 'held2', 'gatherHalf'] }));
check(S.heldAdaptive === true && ev.some(e => e.op === 'warm') && !ev.some(e => e.op === 'seg'), 'warming: the warm row is on, no segment yet');
for (let i = 0; i < 30; i++) { now += 16; sw.tick(); }
check(S.heldAdaptive === true && !ev.some(e => e.op === 'seg'), 'still warming at 480 ms');
for (let i = 0; i < 130; i++) { now += 16; sw.tick(); if (ev.some(e => e.op === 'seg')) break; }
check(S.heldAdaptive === false && ev.filter(e => e.op === 'seg').length === 1 && ev.find(e => e.op === 'seg').state === 'base' && now >= 2500, `first segment is a base, the warm row off again (at ${now} ms)`);
const seen: string[] = []; for (let i = 0; i < 200 && sw.active; i++) { now += 16; sw.tick(); seen.push(`${S.heldAdaptive ? 'A' : '-'}${S.heldRays}${S.gatherThird ? 'T' : 'H'}`); }
check(!sw.active && sw.last === 'done' && ev.filter(e => e.op === 'seg').length === 7, `ran to its end: ${ev.filter(e => e.op === 'seg').map(e => e.id).join(' ')}`);
check(seen.includes('A4H') && seen.includes('-2H') && seen.includes('-4T'), 'each row was flipped alone (the gather row the other way: it stood at half size)');
check(S.heldAdaptive === false && S.heldRays === 4 && S.gatherThird === false && S.renderScale === 0.8, 'all back');
const b = ev.find(e => e.op === 'begin'); console.log(b.rows.map((r: any) => r.label).join(' | '));
// stopped while warming
sw.start({ rounds: 1, only: ['heldAdaptive'] }); check(S.heldAdaptive === true, 'warming again'); sw.stop(); check(S.heldAdaptive === false && !sw.active, 'stopped while warming: back');
// the fog pass's two programs (the row reads the frame's `pass` loosely: a build with one program has no such field)
{
  const mk = (fogFrame: any, fogPass: any) => { const r: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(k: string, t: string) { e2.push(JSON.parse(t)); } };
    return new PerfSweep({ settings: { renderScale: 0.8 }, width: 100, height: 50, timer: { enabled: true }, fogFrame, passes: { fogPass } } as any, { fogOfWar: { on: true } } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, r, () => {}); };
  let e2: any[] = [];
  const one = mk({ on: true, count: 2 }, null); one.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['fogOld'] });
  check(!one.active && !e2.length, 'a build with one fog pass: the row is skipped, nothing starts');
  e2 = []; const F: any = { on: true, count: 2, pass: 'hint' }, P: any = { ran: 'hint' }, two = mk(F, P), t0 = now, COMPILED = 4000;   // the old program takes 4 s to compile: until then the other one draws
  two.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['fogOld'] });
  const frame = () => { now += 16; P.ran = F.pass === 'old' && now - t0 >= COMPILED ? 'old' : 'hint'; two.tick(); };
  while (now - t0 < 3500) frame();
  check(F.pass === 'old' && !e2.some(e => e.op === 'seg'), 'two programs: still warming at 3.5 s, the old one not drawing yet');
  for (let i = 0; i < 100 && !e2.some(e => e.op === 'seg'); i++) frame();
  check(now - t0 >= COMPILED && now - t0 < COMPILED + 100 && F.pass === 'hint', `the first segment waits for the old program to draw (${now - t0} ms)`);
  const ran: string[] = []; for (let i = 0; i < 50 && two.active; i++) { frame(); ran.push(P.ran); }
  check(!two.active && two.last === 'done' && ran.includes('old') && F.pass === 'hint' && e2.find(e => e.op === 'begin').rows[0].to.fogPass === 'old', 'the row flips to the old program and back');
  e2 = []; const F3: any = { on: true, count: 2, pass: 'hint' }, never = mk(F3, { ran: 'hint' }), t3 = now; never.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['fogOld'] });
  for (let i = 0; i < 1200 && !e2.some(e => e.op === 'seg'); i++) { now += 16; never.tick(); }
  check(now - t3 >= 15000 && now - t3 < 15100, `a program that never draws holds the warm-up to its limit, no longer (${now - t3} ms)`); never.stop();
}
// a row whose setting this build does not have is skipped by name; on a build that has it, it is flipped alone and put back
{
  const run = (settings: any) => { const e3: any[] = [], r: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(k: string, t: string) { e3.push(JSON.parse(t)); } };
    const p = new PerfSweep({ settings, width: 100, height: 50, timer: { enabled: true } } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, r, () => {});
    p.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['shadowOccl', 'held2'] }); const seen: string[] = [];
    for (let i = 0; i < 100 && p.active; i++) { now += 16; p.tick(); seen.push(String(settings.dnShadowOccl)); } return { e3, seen, p }; };
  const without: any = { heldRays: 4, renderScale: 0.8 }, a = run(without), ba = a.e3.find(e => e.op === 'begin');
  check(!a.p.active && ba.rows.length === 1 && ba.rows[0].id === 'held2' && ba.skipped.length === 1 && ba.skipped[0].id === 'shadowOccl' && /dnShadowOccl/.test(ba.skipped[0].why) && !('dnShadowOccl' in without), `no hidden torch fix in the build: its row is skipped (${ba.skipped[0]?.why}), nothing written`);
  const withIt: any = { heldRays: 4, renderScale: 0.8, dnShadowOccl: true }, c = run(withIt), bc = c.e3.find(e => e.op === 'begin');
  check(!c.p.active && c.p.last === 'done' && bc.rows.some((r: any) => r.id === 'shadowOccl' && r.to.dnShadowOccl === false) && !bc.skipped.length && c.seen.includes('false') && withIt.dnShadowOccl === true && withIt.heldRays === 4, 'with the fix in the build: its row switches it off for its window and puts it back');
  const off: any = { heldRays: 4, renderScale: 0.8, dnShadowOccl: false }, d = run(off), bd = d.e3.find(e => e.op === 'begin');
  check(bd.skipped.some((k: any) => k.id === 'shadowOccl' && k.why === 'already so') && off.dnShadowOccl === false, 'booted with the fix off (?noleakfix): skipped as already so, left off');
}
// the quality changed BY HAND in the middle of a take, against the real Quality: his preset's rows stand as it wrote them, and what the sweep had flipped that no preset writes is back
{
  const page = (game: any = { fogOfWar: null }, fogFrame: any = undefined) => { const settings: any = {}, e: any[] = [], engine: any = { fogFrame, settings, width: 100, height: 50, timer: { enabled: true }, rebuilds: 0, rc: { cfg: { nx: 0, ny: 0, nz: 0, cascades: 0, interval0: 1 } }, rebuildRc(c: any) { this.rc.cfg = c; this.rebuilds++; } };
    const smoke: any = { stats: { live: 0 }, params: { enabled: true } }, Q = new Quality(engine, smoke); Q.pin('high'); settings.dnShadowOccl = true; settings.heldAdaptive = false;
    const r: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(k: string, t: string) { e.push(JSON.parse(t)); } }; let said = '';
    return { settings, e, engine, smoke, Q, sw: new PerfSweep(engine, game as any, Q, smoke, r, t => { said = t; }), said: () => said }; };
  const plain = (o: any) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const toFlip = (p: ReturnType<typeof page>, id: string) => { p.sw.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: [id] }); for (let i = 0; i < 400 && !p.e.some(x => x.op === 'seg' && x.state === 'flip'); i++) { now += 16; p.sw.tick(); } return p.e.some(x => x.op === 'seg' && x.state === 'flip'); };
  const want = page(); want.Q.pin('medium'); const medium = plain(want.settings);   // (the page a hand change to Medium gives with no sweep anywhere near it)
  const watched = (p: ReturnType<typeof page>) => Object.prototype.hasOwnProperty.call(p.Q, 'apply');
  const a = page(), inA = toFlip(a, 'shadowOccl') && a.settings.dnShadowOccl === false && watched(a);
  a.Q.pin('medium'); a.settings.volSteps = 999; (a.Q as any).climbed = ['a rung of his'];   // (a row moved after the preset, and a rung the ladder holds: asking what a preset writes must not apply one to the page)
  const rb = a.engine.rebuilds, sm = JSON.stringify(a.smoke.params); now += 16; a.sw.tick();
  check(inA && !a.sw.active && a.sw.last === 'stopped: quality was changed by hand' && a.settings.dnShadowOccl === true && !watched(a), 'a hand preset change while the hidden torch fix is switched off: the sweep stops and the fix is on again');
  { const fg = { fogOfWar: { on: true, knobs: { edge: 0.5 } } }, ff = { on: true, count: 2, full: true, sight: true, edge: 0.5 }, h = page(fg, ff);
    const inH = toFlip(h, 'fogEdge') && fg.fogOfWar.knobs.edge === 0 && ff.edge === 0; h.Q.pin('medium'); now += 16; h.sw.tick();
    check(inH && !h.sw.active && h.sw.last === 'stopped: quality was changed by hand' && fg.fogOfWar.knobs.edge === 0.5 && ff.edge === 0.5 && plain(h.settings) === medium, 'a hand preset change while the fog\'s edge is flipped hard: the sweep stops, the band is back, his preset stands'); }
  for (const id of ['irLight', 'irLightOne']) { const L = { ir: [{}, {}, {}], tube: true, irCount: 3, irCap: Infinity }, h = page(); h.engine.lights = L;
    const inH = toFlip(h, id) && L.irCap === (id === 'irLight' ? 0 : 1); h.Q.pin('medium'); now += 16; h.sw.tick();
    check(inH && !h.sw.active && h.sw.last === 'stopped: quality was changed by hand' && L.irCap === Infinity && L.ir.length === 3 && plain(h.settings) === medium, `a hand preset change while '${id}' is flipped: the sweep stops, the picture takes every infrared light again, his preset stands`); }
  { const P = { paint: true }, h = page(); h.sw.extra = [{ id: 'lookpaint', label: 'look: paint off', flip: () => ({ from: { paint: true }, to: { paint: false }, apply: () => { P.paint = false; return () => { P.paint = true; }; } }) }];
    const inH = toFlip(h, 'lookpaint') && P.paint === false; h.Q.pin('medium'); now += 16; h.sw.tick();
    check(inH && !h.sw.active && h.sw.last === 'stopped: quality was changed by hand' && P.paint === true && plain(h.settings) === medium, "a hand preset change while a page's own row is flipped: the sweep stops, the row is back by its own undo, his preset stands"); }
  const untouched = a.settings.volSteps === 999 && (a.Q as any).climbed.length === 1 && a.engine.rebuilds === rb && JSON.stringify(a.smoke.params) === sm; a.settings.volSteps = want.settings.volSteps;
  check(untouched && plain(a.settings) === medium && a.Q.current === 'medium' && /your quality stands/.test(a.said()), 'his new preset stands row for row, and finding out what a preset writes applied nothing to the page');
  const b = page(), inB = toFlip(b, 'meshNear') && b.settings.meshShadows === false; b.Q.pin('medium'); now += 16; b.sw.tick();
  check(inB && !b.sw.active && b.settings.meshShadows === false && b.settings.meshShadowsNear === false && plain(b.settings) === medium, 'a row the new preset writes to the very value the sweep had flipped it to: left as the preset wrote it');
  const c = page(), inC = toFlip(c, 'held2') && c.settings.heldRays === 2; c.Q.pin('ultra'); const ultra = page(); ultra.Q.pin('ultra'); now += 16; c.sw.tick();
  check(inC && !c.sw.active && plain(c.settings) === plain(ultra.settings), 'a row the new preset writes to another value: the preset\'s');
  const d = page(); d.sw.start({ rounds: 1, only: ['heldAdaptive'] }); const inD = d.settings.heldAdaptive === true && !d.e.some(x => x.op === 'seg'); d.Q.pin('medium'); now += 16; d.sw.tick();
  check(inD && !d.sw.active && d.settings.heldAdaptive === false && plain(d.settings) === medium, 'changed by hand during the warm-up: the trade row it had switched on is off again');
  const f = page(), inF = toFlip(f, 'shadowOccl'); f.Q.setAuto(); now += 16; f.sw.tick();
  check(inF && !f.sw.active && f.Q.calibrating && f.settings.dnShadowOccl === true, 'auto picked by hand in the middle (it starts measuring): the sweep stops, the fix is on again');
  const g = page(), inG = toFlip(g, 'shadowOccl'); g.settings.dnShadowOccl = 'mine'; g.Q.pin('medium'); now += 16; g.sw.tick();
  check(inG && g.settings.dnShadowOccl === 'mine', 'a flipped setting he has moved himself since is left alone');
  const j = page(), inJ = toFlip(j, 'held2') && j.settings.heldRays === 2; j.Q.pin('high'); j.settings.renderScale = 0.6; now += 16; j.sw.tick();   // (the pause card's scale slider: the same preset pinned again, then the scale)
  check(inJ && !j.sw.active && j.sw.last === 'stopped: quality was changed by hand' && j.settings.heldRays === 4 && j.settings.renderScale === 0.6, 'the SAME preset set again by hand, then the scale: seen, the sweep stops and his scale stands');
  const k = page(), inK = toFlip(k, 'preset') && k.Q.current === 'medium'; k.Q.pin('medium'); now += 16; k.sw.tick();
  check(inK && !k.sw.active && k.sw.last === 'stopped: quality was changed by hand' && k.Q.current === 'medium' && plain(k.settings) === medium, 'the preset row up and he picks that very preset: it is his now, not flipped back');
  const m = page(), inM = toFlip(m, 'shadowOccl'); m.Q.pin('medium'); m.sw.stop('F8');
  check(inM && !m.sw.active && plain(m.settings) === medium && m.settings.dnShadowOccl === true && !watched(m), 'a hand change and F8 inside one frame: his preset stands, the flip is back');
  const n = page(), inN = toFlip(n, 'preset'); for (let i = 0; i < 50 && n.sw.active; i++) { now += 16; n.sw.tick(); } const hi2 = page();
  check(inN && n.sw.last === 'done' && plain(n.settings) === plain(hi2.settings) && n.Q.current === 'high', 'the preset row run to its end with hands off: not taken for a hand change, all back');
  const h = page(), inH = toFlip(h, 'shadowOccl'); h.sw.stop('F8'); const hi = page();
  check(inH && plain(h.settings) === plain(hi.settings), 'stopped with F8 in the middle of the same flip: everything as it was (unchanged)');
}
{ // the order of a round: the first as listed, each later one a shuffle of its own, the same shuffle every time (a take can be run again and compared row for row)
  const list = Array.from({ length: 23 }, (_, k) => 'r' + k), same = (a: string[], b: string[]) => a.join() === b.join();
  const rounds = [0, 1, 2, 3, 4].map(r => sweepOrder(list, r));
  check(same(rounds[0], list) && rounds.every(o => o.length === list.length && same([...o].sort(), [...list].sort())), 'round 0 runs in the list\'s order; every round holds every row once');
  check(rounds.slice(1).every((o, k) => !same(o, list) && same(o, sweepOrder(list, k + 1))) && new Set(rounds.map(o => o.join())).size === rounds.length, 'each later round is a shuffle of its own, and the same one when asked again');
  const next = (o: string[]) => new Set(o.slice(0, -1).map((id, k) => [id, o[k + 1]].sort().join('+')));   // (neighbours either way round: they share a slow stretch)
  const shared = [1, 2].map(r => [...next(rounds[r])].filter(x => next(rounds[0]).has(x) || (r === 2 && next(rounds[1]).has(x))).length);
  check(shared[0] + shared[1] <= 11, `three rounds of 23 rows: two rows are neighbours again in a later round ${shared[0]} + ${shared[1]} times of 44 (in order, reversed, in order: all 44)`);
  check(same(sweepOrder(['only'], 5), ['only']) && sweepOrder([], 3).length === 0 && same(list, Array.from({ length: 23 }, (_, k) => 'r' + k)), 'one row, no rows; the list handed in is left as it was');
  // and through a real sweep: the segments it logs
  const S2: any = { heldAdaptive: false, heldRays: 4, gatherThird: false, renderScale: 0.8, sharpDirect: true, taau: true, volLightCap: 4, froxelVol: false };
  const run = () => { const e2: any[] = []; const r2: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { e2.push(JSON.parse(t)); } };
    const p = new PerfSweep({ settings: S2, width: 100, height: 50, timer: { enabled: true } } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, r2, () => {});
    p.start({ rounds: 3, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['heldAdaptive', 'held2', 'held0', 'gatherHalf', 'volK', 'froxel'] });
    for (let i = 0; i < 4000 && p.active; i++) { now += 16; p.tick(); } return { p, segs: e2.filter(e => e.op === 'seg'), begin: e2.find(e => e.op === 'begin') }; };
  const A = run(), B = run(), ids: string[] = A.begin.rows.map((r: any) => r.id), n = ids.length;
  const flips = (r: number) => A.segs.filter((s: any) => s.round === r && s.state === 'flip').map((s: any) => s.id as string);
  check(A.p.last === 'done' && n >= 4 && A.segs.length === 3 * n * 2 + 1 && A.segs.every((s: any, k: number) => s.i === k && (k % 2 ? s.state === 'flip' && s.id !== 'base' : s.state === 'base' && s.id === 'base')), `a sweep of ${n} rows, three rounds: ${A.segs.length} segments, a plain one either side of every flip`);
  check(same(flips(0), ids) && [1, 2].every(r => same([...flips(r)].sort(), [...ids].sort())) && !same(flips(1), flips(2)), `round 1 as listed (${flips(0).join(' ')}), then ${flips(1).join(' ')}, then ${flips(2).join(' ')}`);
  check(same(A.segs.map((s: any) => s.id), B.segs.map((s: any) => s.id)), 'the same sweep run again takes the same order');
  check(A.segs.every((s: any) => same(Object.keys(s), ['op', 'i', 'of', 'round', 'id', 'state'])), 'a segment\'s line in the take is shaped as before (op, i, of, round, id, state)');
  check(S2.heldAdaptive === false && S2.heldRays === 4 && S2.gatherThird === false && S2.volLightCap === 4 && S2.froxelVol === false, 'all back after the shuffled rounds');
}
{ // the slow, live-only rows: 'wind sim off' and 'one snow in one air off'
  const mk = (hook: (() => any) | null) => {
    const S3: any = { airSim: true, heldRays: 4, renderScale: 0.8, sharpDirect: true, taau: true }, e3: any[] = [];
    const rec3: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { e3.push(JSON.parse(t)); } };
    const p = new PerfSweep({ settings: S3, width: 100, height: 50, timer: { enabled: true } } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec3, () => {});
    p.oneAir = hook; return { p, S3, e3 };
  };
  const G = { oneAir: true };   // (the page's snow switch, stood in for)
  const hook = () => ({ from: { oneAir: true }, to: { oneAir: false }, apply: () => { G.oneAir = false; return () => { G.oneAir = true; }; } });
  const why = (e: any[], id: string) => e.find(x => x.op === 'begin')?.skipped.find((k: any) => k.id === id)?.why as string | undefined;
  const opts = { rounds: 2, settleMs: 500, measureMs: 1000, settleFrames: 1, measureFrames: 2, only: ['air', 'oneAir', 'held2'] };
  { const { p, e3 } = mk(hook); p.start(opts);
    check(/live takes only/.test(why(e3, 'air') ?? '') && /live takes only/.test(why(e3, 'oneAir') ?? '') && e3.find(x => x.op === 'begin').rows.map((r: any) => r.id).join() === 'held2', `a frozen take skips both with the reason (air: ${why(e3, 'air')} · snow: ${why(e3, 'oneAir')}) and still flips the rest`);
    p.stop(); }
  { const { p, e3 } = mk(null); p.start({ ...opts, live: true }); check(/no snow to flip/.test(why(e3, 'oneAir') ?? '') && !why(e3, 'air'), `a page that hands no snow flip skips the row (${why(e3, 'oneAir')}); the wind sim row runs on a live take`); p.stop(); }
  { const { p, e3 } = mk(() => 'no snow falls here'); p.start({ ...opts, live: true }); check(why(e3, 'oneAir') === 'no snow falls here', 'the page\'s own reason for no flip is the take\'s skip line, word for word'); p.stop(); }
  { const { p, e3, S3 } = mk(hook); const t0 = now; p.start({ ...opts, live: true, only: ['oneAir', 'held2'] });
    const segAt: { id: string; state: string; t: number; settleMs?: number; g: boolean; h: number }[] = []; let n = 0;
    const drain = () => { const segs = e3.filter(x => x.op === 'seg'); while (n < segs.length) { const x = segs[n++]; segAt.push({ id: x.id, state: x.state, t: now, settleMs: x.settleMs, g: G.oneAir, h: S3.heldRays }); } };
    drain(); for (let i = 0; i < 20000 && p.active; i++) { now += 50; p.tick(); drain(); }
    const len = segAt.map((x, i) => (i + 1 < segAt.length ? segAt[i + 1].t : now) - x.t), flips = segAt.map((x, i) => ({ x, i })).filter(o => o.x.id === 'oneAir');
    check(!p.active && p.last === 'done' && flips.length === 2, `the live take ran to its end with the snow row flipped once a round (${segAt.length} segments, ${Math.round((now - t0) / 1000)} s of the fake clock)`);
    check(flips.every(o => o.x.g === false && o.x.settleMs === 12000 && len[o.i] >= 13000 && len[o.i] < 13200), `its flipped segment stands at the snow of before and waits out twelve seconds before the measured one (${flips.map(o => len[o.i]).join(', ')} ms)`);
    check(flips.every(o => { const b = segAt[o.i + 1]; return !b || (b.state === 'base' && b.g === true && b.settleMs === 12000 && (o.i + 2 >= segAt.length || len[o.i + 1] >= 13000)); }), 'the baseline right after it is back at one air and drops the same twelve seconds (the grains go as slowly as they come)');
    check(segAt.every((x, i) => x.id === 'oneAir' || (i > 0 && segAt[i - 1].id === 'oneAir') || (x.settleMs === undefined && len[i] >= 1500 && len[i] < 1700)), `every other segment is as long as before and its line carries no settle of its own (${segAt.map((x, i) => `${x.id}:${len[i]}${x.settleMs ? '*' : ''}`).join(' ')})`);
    check(G.oneAir === true && S3.heldRays === 4, 'all back at the end: the snow switch and the settings'); }
  { const { p, e3, S3 } = mk(null); p.start({ ...opts, rounds: 1, live: true, only: ['air', 'held2'] }); const at: { id: string; state: string; t: number; settleMs?: number; air: boolean }[] = []; let n = 0;
    const drain = () => { const segs = e3.filter(x => x.op === 'seg'); while (n < segs.length) { const x = segs[n++]; at.push({ id: x.id, state: x.state, t: now, settleMs: x.settleMs, air: S3.airSim }); } };
    drain(); for (let i = 0; i < 20000 && p.active; i++) { now += 50; p.tick(); drain(); }
    const k = at.findIndex(x => x.id === 'air'), len = (i: number) => (i + 1 < at.length ? at[i + 1].t : now) - at[i].t;
    check(k > 0 && at[k].air === false && at[k].settleMs === undefined && len(k) === 1500 && at[k + 1].state === 'base' && at[k + 1].air === true && at[k + 1].settleMs === 12000 && len(k + 1) === 13000, `'wind sim off' flips for the usual second and a half; only the baseline after it waits the snow out (${len(k)} then ${len(k + 1)} ms)`); }
  { const { p } = mk(hook); p.start({ ...opts, live: true, only: ['oneAir'] }); for (let i = 0; i < 400 && G.oneAir; i++) { now += 50; p.tick(); }
    const flipped = !G.oneAir; p.stop(); check(flipped && G.oneAir === true, 'stopped while the snow row is flipped: the switch is back'); }
}
{ // the wisps' row: the same page hook shape, its own shorter wait
  const S4: any = { heldRays: 4, renderScale: 0.8, sharpDirect: true, taau: true }, e4: any[] = [];
  const rec4: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { e4.push(JSON.parse(t)); } };
  const world: any = { fogOfWar: null };   // (no clock of its own until the last block gives it one)
  const mk = () => { e4.length = 0; return new PerfSweep({ settings: S4, width: 100, height: 50, timer: { enabled: true } } as any, world, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec4, () => {}); };
  const W = { motes: 0.55, stretch: 0.12 };
  const hook = () => ({ from: { ...W }, to: { motes: 0, stretch: 0.3 }, settleMs: 7000, apply: () => { const was = { ...W }; W.motes = 0; W.stretch = 0.3; return () => { Object.assign(W, was); }; } });
  const why = (id: string) => e4.find(x => x.op === 'begin')?.skipped.find((k: any) => k.id === id)?.why as string | undefined;
  const opts = { rounds: 2, settleMs: 500, measureMs: 1000, settleFrames: 1, measureFrames: 2, only: ['wispMotes', 'held2'] };
  { const p = mk(); p.wispMotes = hook; p.start(opts); check(/live takes only/.test(why('wispMotes') ?? ''), `a frozen take skips the wisps' row with the reason (${why('wispMotes')})`); p.stop(); }
  { const p = mk(); p.oneAir = () => 'never asked'; p.start({ ...opts, live: true }); check(/no snow to flip/.test(why('wispMotes') ?? ''), 'a page that hands no wisp flip skips the row, whatever it hands for the other snow row'); p.stop(); }
  { const p = mk(); p.wispMotes = hook; p.start({ ...opts, live: true });
    const at: { id: string; state: string; t: number; settleMs?: number; m: number }[] = []; let n = 0;
    const drain = () => { const segs = e4.filter(x => x.op === 'seg'); while (n < segs.length) { const x = segs[n++]; at.push({ id: x.id, state: x.state, t: now, settleMs: x.settleMs, m: W.motes }); } };
    drain(); for (let i = 0; i < 20000 && p.active; i++) { now += 50; p.tick(); drain(); }
    const len = (i: number) => (i + 1 < at.length ? at[i + 1].t : now) - at[i].t, flips = at.map((x, i) => ({ x, i })).filter(o => o.x.id === 'wispMotes');
    check(!p.active && p.last === 'done' && flips.length === 2 && flips.every(o => o.x.m === 0 && o.x.settleMs === 7000 && len(o.i) >= 8000 && len(o.i) < 8200), `the wisps' row flips once a round and waits out seven seconds before the measured one (${flips.map(o => len(o.i)).join(', ')} ms)`);
    check(flips.every(o => { const b = at[o.i + 1]; return !b || (b.state === 'base' && b.m === 0.55 && b.settleMs === 7000); }) && W.motes === 0.55 && W.stretch === 0.12 && S4.heldRays === 4, 'the baseline after it is back at the motes and waits the same; all back at the end'); }
  { const p = mk(); p.wispMotes = hook; p.start({ ...opts, live: true, only: ['wispMotes'] }); for (let i = 0; i < 400 && W.motes; i++) { now += 50; p.tick(); }
    const flipped = W.motes === 0; p.stop(); check(flipped && W.motes === 0.55 && W.stretch === 0.12, 'stopped while the wisps\' row is flipped: the motes and the stretch are back'); }
  // a world that runs behind the clock: the slow row's wait is in the world's seconds, stretched by how far behind it ran, three times at most
  const run = (rate: number) => { world.time = 0; const p = mk(); p.wispMotes = hook; p.start({ ...opts, rounds: 1, live: true, only: ['wispMotes'] });
    const at: { id: string; settleMs?: number }[] = []; let n = 0; const drain = () => { const segs = e4.filter(x => x.op === 'seg'); while (n < segs.length) { const x = segs[n++]; at.push({ id: x.id, settleMs: x.settleMs }); } };
    drain(); for (let i = 0; i < 20000 && p.active; i++) { now += 50; world.time += 0.05 * rate; p.tick(); drain(); } delete world.time;
    return { done: p.last === 'done', flip: at.find(x => x.id === 'wispMotes')?.settleMs, after: at[at.findIndex(x => x.id === 'wispMotes') + 1]?.settleMs }; };
  { const full = run(1), half = run(0.5), still = run(0);
    check(full.done && full.flip === 7000 && full.after === 7000, `a world at full speed: the wait as named (${full.flip}, ${full.after} ms)`);
    check(half.done && half.flip === 14000 && half.after === 14000, `a world at half speed (a page at ten frames a second): twice the wait, on the flip and on the baseline after it (${half.flip}, ${half.after} ms)`);
    check(still.done && still.flip === 21000 && still.after === 21000 && W.motes === 0.55, `a world that stands still: three times and no more, and the take still ends (${still.flip}, ${still.after} ms)`); }
  { world.time = 0; const p = mk(); p.wispMotes = hook; p.start({ ...opts, rounds: 1, only: ['held2'] }); const segs: any[] = []; for (let i = 0; i < 2000 && p.active; i++) { now += 50; p.tick(); } segs.push(...e4.filter(x => x.op === 'seg')); delete world.time;
    check(p.last === 'done' && segs.every(x => x.settleMs === undefined), 'a frozen take, where the world\'s clock stands still by design, stretches nothing'); }
}
{ // the fog's soft edge row: the band to nothing in the game's table and on the frame, on frozen and live takes alike, no wait of its own
  const S5: any = { heldRays: 4, renderScale: 0.8, sharpDirect: true, taau: true }, e5: any[] = [];
  const rec5: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { e5.push(JSON.parse(t)); } };
  let F: any, G: any;
  const mk = (frame: any = { on: true, count: 2, full: true, sight: true, edge: 0.5 }, game: any = { fogOfWar: { on: true, knobs: { edge: 0.5, dim: 0.4 } } }) => { e5.length = 0; F = frame; G = game;
    return new PerfSweep({ settings: S5, width: 100, height: 50, timer: { enabled: true }, fogFrame: frame } as any, game, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec5, () => {}); };
  const why = (id: string) => e5.find(x => x.op === 'begin')?.skipped.find((k: any) => k.id === id)?.why as string | undefined;
  const opts = { rounds: 2, settleMs: 500, measureMs: 1000, settleFrames: 1, measureFrames: 2, only: ['fogEdge', 'held2'] };
  const skips = (what: string, re: RegExp, frame?: any, game?: any) => { const p = mk(frame, game); p.start(opts); check(re.test(why('fogEdge') ?? ''), `${what}: skipped (${why('fogEdge')})`); p.stop(); };
  skips('fog of war off in the game', /fog of war is off/, undefined, { fogOfWar: { on: false, knobs: { edge: 0.5 } } });
  skips('no fog frame on the page', /fog of war is off/, null);
  skips('no eye on the floor', /fog of war is off/, { on: true, count: 0, full: true, sight: true, edge: 0.5 });
  skips('a game from before the soft edge', /no soft edge/, undefined, { fogOfWar: { on: true, knobs: { dim: 0.4 } } });
  skips('a renderer from before the soft edge', /no soft edge/, { on: true, count: 2, full: true, sight: true });
  skips('the full picture off', /full fog picture/, { on: true, count: 2, full: false, sight: true, edge: 0.5 });
  skips('the sight table not written', /sight table is not written/, { on: true, count: 2, full: true, sight: false, edge: 0.5 });
  skips('the page opened with the hard line', /already has its hard edge/, { on: true, count: 2, full: true, sight: true, edge: 0 }, { fogOfWar: { on: true, knobs: { edge: 0 } } });
  for (const live of [false, true]) { const p = mk(); p.start({ ...opts, live }); const K = G.fogOfWar.knobs;
    const step = () => { if (live) F.edge = Math.max(0, K.edge); };   // (a running game writes the frame from its table every step; a frozen one writes nothing)
    const at: { id: string; state: string; settleMs?: number; k: number; f: number; t: number }[] = []; let n = 0, held = true;
    const drain = () => { const segs = e5.filter(x => x.op === 'seg'); while (n < segs.length) { const x = segs[n++]; at.push({ id: x.id, state: x.state, settleMs: x.settleMs, k: K.edge, f: F.edge, t: now }); } };
    drain(); for (let i = 0; i < 20000 && p.active; i++) { now += 50; step(); const cur = at[at.length - 1]; if (cur && cur.id === 'fogEdge' && F.edge !== 0) held = false; p.tick(); drain(); }
    const flips = at.filter(x => x.id === 'fogEdge'), len = at.map((x, i) => (i + 1 < at.length ? at[i + 1].t : now) - x.t);
    check(p.last === 'done' && !why('fogEdge') && flips.length === 2 && flips.every(x => x.k === 0 && x.f === 0) && held && at.filter(x => x.state === 'base').every(x => x.k === 0.5 && x.f === 0.5) && at.every((x, i) => x.settleMs === undefined && len[i] >= 1500 && len[i] < 1700) && K.edge === 0.5 && F.edge === 0.5 && K.dim === 0.4,
      `a ${live ? 'live' : 'frozen'} take: the band is nothing in the table and on the frame for the whole of each flip${live ? ' (the game writing the frame every step)' : ''}, the usual second and a half, and both are back`);
    check(JSON.stringify(e5.find(x => x.op === 'begin').rows.find((r: any) => r.id === 'fogEdge')) === '{"id":"fogEdge","label":"fog of war: the hard edge of before","from":{"fogEdge":0.5},"to":{"fogEdge":0}}', 'the take names the row and what it wrote'); }
  { const p = mk(); p.start({ ...opts, only: ['fogEdge'] }); for (let i = 0; i < 400 && F.edge; i++) { now += 50; p.tick(); }
    const flipped = F.edge === 0 && G.fogOfWar.knobs.edge === 0; G.fogOfWar.knobs.edge = 0; p.stop(); check(flipped && F.edge === 0.5 && G.fogOfWar.knobs.edge === 0.5, 'stopped while the fog edge row is flipped: the band is back in both'); }
}
{ // the goggles' infrared lights: capped out of the picture (none, then the first alone) and back, on frozen and live takes alike; the list the game reads is never written
  const S6: any = { heldRays: 4, renderScale: 0.8, sharpDirect: true, taau: true }, e6: any[] = [];
  const rec6: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(_k: string, t: string) { e6.push(JSON.parse(t)); } };
  const lamp = (i: number, on = true) => ({ name: i ? `ir_${i}` : 'ir_sam', enabled: on, intensity: on ? 4 : 0, slot: -1 });
  let L: any;
  /** the renderer's upload as lights.ts runs it every frame (tools/qa/sweep-ir-check.ts holds the real one to the same): the lamps that burn take the slots after the level's own nine lights, up to the cap, while the picture is the tube's */
  const upload = () => { let n = 0; for (const l of L.ir) l.slot = L.tube && l.enabled && l.intensity > 0 && n < L.irCap ? 9 + n++ : -1; L.irCount = n; };
  const mk = (lights: any) => { e6.length = 0; L = lights; if (L?.ir) upload();
    return new PerfSweep({ settings: S6, width: 100, height: 50, timer: { enabled: true }, lights } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, rec6, () => {}); };
  const why = (id: string) => e6.find(x => x.op === 'begin')?.skipped.find((k: any) => k.id === id)?.why as string | undefined;
  const opts = { rounds: 2, settleMs: 500, measureMs: 1000, settleFrames: 1, measureFrames: 2, only: ['irLight', 'irLightOne', 'held2'] };
  const set = (n: number, more: any = {}) => ({ ir: Array.from({ length: n }, (_x, i) => lamp(i)), tube: true, irCount: 0, irCap: Infinity, ...more });
  const skips = (what: string, re: RegExp, lights: any, id = 'irLight') => { const p = mk(lights); p.start(opts); check(re.test(why(id) ?? ''), `${what}: skipped (${why(id)})`); p.stop(); };
  skips('a build from before the infrared light', /carry no infrared light/, { lights: [] });
  skips('a build with the lights and no cap on them', /carry no infrared light/, { ir: [lamp(0)], tube: true, irCount: 1 });
  skips('a page with no light set at all', /carry no infrared light/, undefined);
  skips('the goggles up', /goggles are up/, set(5, { tube: false }));
  skips('the switch off (?noirlight)', /no infrared light is in the picture/, set(0));
  skips('every lamp dark', /no infrared light is in the picture/, { ...set(0), ir: [lamp(0, false), lamp(1, false)] });
  skips('one lamp: the second row', /one infrared light burns here/, set(1), 'irLightOne');
  { const p = mk(set(1)); p.start(opts); check(p.active && !why('irLight') && e6.find(x => x.op === 'begin').rows.some((r: any) => r.id === 'irLight' && r.from.irLights === 1 && r.to.irLights === 0), 'one lamp: the first row still runs'); p.stop(); check(L.irCap === Infinity, 'and stopped, the cap is off'); }
  for (const live of [false, true]) { const p = mk(set(5)), all = [...L.ir]; p.start({ ...opts, live });
    const step = () => { if (live) { L.ir.length = 0; L.ir.push(...all); } };   // (a running game makes its list again every step, irlight.ts irLightTick; a frozen one writes nothing)
    const at: { id: string; state: string; said: string; t: number }[] = []; let n = 0, held = true, whole = true;
    const drain = () => { const segs = e6.filter(x => x.op === 'seg'); while (n < segs.length) { const x = segs[n++]; at.push({ id: x.id, state: x.state, said: p.flipped, t: now }); } };
    drain();
    for (let i = 0; i < 20000 && p.active; i++) { now += 50; step(); upload(); const cur = at[at.length - 1], want = !cur ? 5 : cur.id === 'irLight' ? 0 : cur.id === 'irLightOne' ? 1 : 5;
      if (L.irCount !== want || (want === 1 && all[0].slot !== 9)) held = false; if (L.ir.length !== 5 || L.ir.some((l: any, k: number) => l !== all[k])) whole = false; p.tick(); drain(); }
    upload();
    const flips = (id: string) => at.filter(x => x.id === id && x.state === 'flip').length, len = at.map((x, i) => (i + 1 < at.length ? at[i + 1].t : now) - x.t);
    check(p.last === 'done' && !why('irLight') && !why('irLightOne') && flips('irLight') === 2 && flips('irLightOne') === 2 && held, `a ${live ? 'live' : 'frozen'} take, five lamps: the picture takes none for the whole of the first row's flips, the first lamp alone (in its old slot) for the second's, all five on every other frame${live ? ' (the game making its list again every step)' : ''}`);
    const ir = (x?: { id: string }) => !!x && x.id.startsWith('irLight'), slow = (i: number) => ir(at[i]) || ir(at[i - 1]);   // (a goggles row's flip and the baseline after it wait a second, not half of one)
    check(whole && at.every((_x, i) => len[i] >= (slow(i) ? 2000 : 1500) && len[i] < (slow(i) ? 2200 : 1700)) && at.every(x => x.said === x.id), 'the list the game reads holds all five in their order throughout, a goggles row\'s window and the baseline after it are two seconds (a second to settle) where the others are one and a half, and the sweep says which row is flipped');
    check(L.irCap === Infinity && L.irCount === 5 && all.every((l, i) => l.slot === 9 + i) && p.flipped === '', 'at the end the cap is off and the renderer takes the five again');
    const rows = e6.find(x => x.op === 'begin').rows;
    check(JSON.stringify(rows.find((r: any) => r.id === 'irLight')) === '{"id":"irLight","label":"goggles: infrared lights off (5 of them here)","from":{"irLights":5},"to":{"irLights":0}}' && JSON.stringify(rows.find((r: any) => r.id === 'irLightOne')) === '{"id":"irLightOne","label":"goggles: one infrared light alone (5 of them here)","from":{"irLights":5},"to":{"irLights":1}}', 'the take names both rows, how many burned and what each left'); }
  { const p = mk(set(5)); p.start({ ...opts, only: ['irLightOne'] }); for (let i = 0; i < 400 && L.irCap !== 1; i++) { now += 50; upload(); p.tick(); }
    const capped = L.irCap === 1; p.stop(); check(capped && L.irCap === Infinity, 'stopped while the second row is flipped: the cap is off again'); }
}
// a sweep inside somebody else's take (the benchmark's: src/ui/bench.ts): the recording goes on when it ends, and the page is told nothing
{
  const S2: any = { heldRays: 4, renderScale: 0.8 }, e3: any[] = [], said: string[] = []; let stops = 0;
  const r: any = { recording: true, start() { this.recording = true; }, stop() { this.recording = false; stops++; }, event(k: string, t: string) { e3.push(JSON.parse(t)); } };
  const mk3 = () => new PerfSweep({ settings: S2, width: 100, height: 50, timer: { enabled: true } } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, r, s => said.push(s));
  const inside = mk3(); inside.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['held2'], inside: true });
  for (let i = 0; i < 60 && inside.active; i++) { now += 16; inside.tick(); }
  check(!inside.active && inside.last === 'done' && r.recording && stops === 0 && e3.some(e => e.op === 'end' && e.done) && !said.length && S2.heldRays === 4, 'inside another take: the sweep ends, the recording goes on, nothing is said on the page, the row is back');
  const own = mk3(); own.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['held2'] });
  for (let i = 0; i < 60 && own.active; i++) { now += 16; own.tick(); }
  check(!own.active && !r.recording && stops === 1 && said.length === 2, 'on its own, as ever: the sweep stops the recording and says so');
}
// ROWS THE PAGE ADDS (PerfSweep.extra): flipped alone in the same rounds as the build's own and put back by their own undo, named in the begin line as the report reads
// it, skipped with the reason they give (or for a taken id, a flip that throws or is not one, a frozen take on a live-only row), left out of the benchmark's sweep, and
// a take that names none of them writes the lines it wrote before
{
  const mk4 = () => { const e: any[] = [], S4: any = { heldRays: 4, renderScale: 0.8 }, said: string[] = [], r: any = { recording: false, start() { this.recording = true; }, stop() { this.recording = false; }, event(k: string, t: string) { e.push(JSON.parse(t)); } };
    const p = new PerfSweep({ settings: S4, width: 100, height: 50, timer: { enabled: true } } as any, { fogOfWar: null } as any, { current: 'high', calibrating: false, label: 'high', auto: true } as any, { stats: { live: 0 }, params: { enabled: true } } as any, r, t => { said.push(t); });
    return { p, e, S4, r, said }; };
  const go = (p: PerfSweep, o: any, each: () => void = () => {}) => { const said = p.start({ rounds: 2, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, ...o }); for (let i = 0; i < 600 && p.active; i++) { now += 16; p.tick(); each(); } return said; };
  const lines = (e: any[]) => JSON.stringify(e);
  const plain = mk4(); go(plain.p, { only: ['held2'] });
  const none = mk4(); none.p.extra = [{ id: 'lookUnasked', label: 'never named', flip: () => { throw new Error('asked'); } }]; go(none.p, { only: ['held2'] });
  check(lines(plain.e) === lines(none.e) && plain.e.filter(e => e.op === 'seg').length === 5, 'an added row the take does not name is not asked and leaves no line: the take is the one a page without it writes');
  const L: any = { paint: true, relief: true, asked: 0, undone: 0, kinds: [] as boolean[] }, W = mk4(), seen = new Set<string>();
  const row = (k: string) => ({ id: `look${k}`, label: `look: ${k} off`, flip: (take: { live: boolean }) => { L.asked++; L.kinds.push(take.live); return { from: { [k]: true }, to: { [k]: false }, apply: () => { L[k] = false; return () => { L[k] = true; L.undone++; }; } }; } });
  const cyc: any = {}; cyc.me = cyc;
  const bad: [string, any][] = [['lookSnow', () => 'no snow on this level'], ['lookThrows', () => { throw new Error('boom'); }], ['lookVoid', () => undefined], ['lookNoApply', () => ({ from: {}, to: {} })], ['lookCyclic', () => ({ from: { v: cyc }, to: { v: 1 }, apply: () => () => {} })]];
  W.p.extra = [row('paint'), row('relief'), ...bad.map(([id, flip]) => ({ id, label: id, flip })), { id: 'lookLive', label: 'look: live', liveOnly: 'a frozen world shows none', flip: () => { L.asked += 100; return 'never asked'; } },
    { id: 'base', label: 'the name of a segment between flips', flip: () => { L.asked += 100; return 'never asked'; } }, { label: 'no id' } as any];
  go(W.p, { only: ['held2', 'lookpaint', 'lookrelief', 'lookLive', 'base', '', ...bad.map(b => b[0])] }, () => seen.add(`${W.S4.heldRays}${L.paint ? 'P' : '-'}${L.relief ? 'R' : '-'}`));
  const b4 = W.e.find(e => e.op === 'begin'), segs = W.e.filter(e => e.op === 'seg'), why = (id: string) => b4.skipped.filter((k: any) => k.id === `added row '${id}'`).map((k: any) => k.why).join(' / ');
  check(!W.p.active && W.p.last === 'done' && b4.rows.map((r: any) => r.id).join(' ') === 'held2 lookpaint lookrelief' && b4.rows[1].label === 'look: paint off' && b4.rows[1].from.paint === true && b4.rows[1].to.paint === false,
    `added rows stand in the begin line after the build's own, with their labels and what they write (${b4.rows.map((r: any) => r.id).join(' ')})`);
  check(segs.length === 13 && ['lookpaint', 'lookrelief', 'held2'].every(id => segs.filter(e => e.id === id && e.state === 'flip').length === 2), `each is flipped once a round, a base between (${segs.length} segments)`);
  check(seen.has('4-R') && seen.has('4P-') && seen.has('2PR') && !seen.has('4--') && !seen.has('2-R') && !seen.has('2P-'), `each was flipped alone (${[...seen].join(' ')})`);
  check(L.paint === true && L.relief === true && L.undone === 4 && L.asked === 2 && L.kinds.join() === 'false,false' && W.S4.heldRays === 4, `all back by their own undo; each flip was asked for once and told the take is a frozen one (${L.undone} undone, ${L.asked} asked)`);
  check(why('lookSnow') === 'no snow on this level' && /boom/.test(why('lookThrows')) && /live takes only/.test(why('lookLive')), `a row that cannot be flipped here is skipped with its reason (${why('lookSnow')} · ${why('lookThrows')} · ${why('lookLive')})`);
  check(/not one/.test(why('lookVoid')) && /not one/.test(why('lookNoApply')) && /cannot be written/.test(why('lookCyclic')) && /another row is called 'base'/.test(why('base')) && /not a row/.test(why('')) && b4.skipped.length === 8,
    `a flip that is not one, values a line cannot carry, a segment's own name and a row with no id are skipped, and the take runs (${b4.skipped.length} skipped)`);
  const X = mk4(); X.p.extra = [{ id: 'held2', label: 'a taken name', flip: () => { L.asked += 100; return 'never asked'; } }, row('paint'), { ...row('paint'), label: 'the same id twice' }]; go(X.p, { rounds: 1, only: ['held2', 'lookpaint'] });
  const bx = X.e.find(e => e.op === 'begin'), took = bx.skipped.filter((k: any) => /another row is called/.test(k.why)).map((k: any) => k.id).join(' · ');
  check(X.p.last === 'done' && took === "added row 'held2' · added row 'lookpaint'" && bx.rows.map((r: any) => r.id).join(' ') === 'held2 lookpaint' && bx.rows[1].label === 'look: paint off' && L.asked === 3, `an id already taken is skipped under a name of its own and its flip never asked (${took})`);
  const I = mk4(); I.r.recording = true; I.p.extra = [row('paint')]; go(I.p, { rounds: 1, inside: true, only: ['held2', 'lookpaint'] }); const bi = I.e.find(e => e.op === 'begin');
  check(I.p.last === 'done' && bi.rows.map((r: any) => r.id).join(' ') === 'held2' && !bi.skipped.length && L.asked === 3, "the benchmark's sweep takes the build's rows alone: an added row is neither flipped nor asked");
  const K = mk4(); K.p.extra = [row('relief')]; K.p.start({ rounds: 1, settleMs: 0, measureMs: 0, settleFrames: 1, measureFrames: 2, only: ['lookrelief'] });
  for (let i = 0; i < 400 && K.p.active && L.relief; i++) { now += 16; K.p.tick(); } const mid = L.relief; K.p.stop('by hand');
  check(mid === false && L.relief === true && !K.p.active && /stopped/.test(K.p.last), 'stopped with an added row flipped: its own undo puts it back');
  // a slow row and a wait that is no number; a warm row waits for its own picture; a method's `this`; a live take is told so
  const slow = mk4(), nan = mk4(), t0 = now; slow.p.extra = [{ id: 'lookSlow', label: 'slow', flip: () => ({ from: {}, to: {}, apply: () => () => {}, settleMs: 3000 }) }]; go(slow.p, { rounds: 1, only: ['lookSlow'] }); const tSlow = now - t0, t1 = now;
  nan.p.extra = [{ id: 'lookNaN', label: 'nan', flip: () => ({ from: {}, to: {}, apply: () => () => {}, settleMs: NaN }) }]; go(nan.p, { rounds: 1, only: ['lookNaN'] });
  check(slow.p.last === 'done' && tSlow >= 6000 && tSlow < 6400 && nan.p.last === 'done' && now - t1 < 400 && !slow.e.concat(nan.e).some(e => JSON.stringify(e).includes('null')), `a row's own wait is kept for its flip and the base after it (${tSlow} ms); a wait that is no number is no wait and the take ends (${now - t1} ms)`);
  const Wm = mk4(), tw = now; let drawn = false, when = -1; class Panel { on = true; apply() { this.on = false; return () => { this.on = true; }; } } const panel = new Panel();
  Wm.p.extra = [{ id: 'lookWarm', label: 'warm', warm: true, flip: () => ({ from: {}, to: {}, apply: () => () => {}, ready: () => drawn }) }, { id: 'lookThis', label: 'a method', flip: (take: { live: boolean }) => { L.kinds.push(take.live); return Object.assign(panel, { from: { on: true }, to: { on: false } }) as any; } }];
  const offs = new Set<boolean>(); go(Wm.p, { rounds: 1, live: true, only: ['lookWarm', 'lookThis'] }, () => { offs.add(panel.on); if (now - tw >= 5000) drawn = true; if (when < 0 && Wm.e.some(e => e.op === 'seg')) when = now - tw; });
  check(Wm.p.last === 'done' && when >= 5000 && when < 5100, `a warm added row holds the first segment until its own picture draws (${when} ms)`);
  check(offs.has(false) && panel.on === true && L.kinds[L.kinds.length - 1] === true, 'a flip whose apply is a method keeps its own `this`, and a live take is told so');
  // one way back throws: the rest still go back, and the page is not told everything is back
  const T = mk4(), B: any = { a: true, b: true }; T.p.extra = [{ id: 'lookA', label: 'a', warm: true, flip: () => ({ from: {}, to: {}, apply: () => { B.a = false; return () => { B.a = true; }; } }) }, { id: 'lookB', label: 'b', warm: true, flip: () => ({ from: {}, to: {}, apply: () => { B.b = false; return () => { throw new Error('stuck'); }; } }) }];
  go(T.p, { rounds: 1, only: ['lookA', 'lookB'] });
  check(!T.p.active && /stopped/.test(T.p.last) && B.a === true && B.b === false && /way back failed/.test(T.said[T.said.length - 1] ?? '') && !/everything is back/.test(T.said[T.said.length - 1] ?? ''), `one row's way back throws: the other row is back and the closing line says one failed (${T.said[T.said.length - 1]})`);
  const U = mk4(); U.p.extra = [{ id: 'lookNoUndo', label: 'no way back', flip: () => ({ from: {}, to: {}, apply: () => undefined as any }) }]; go(U.p, { rounds: 1, only: ['lookNoUndo'] });
  check(!U.p.active && /stopped: a flip failed \(lookNoUndo/.test(U.p.last), `an apply that hands back no undo stops the take by name (${U.p.last})`);
}
process.exit(red ? 1 : 0);
