// The benchmark's own stepping held to a fake page (src/ui/bench.ts): nothing while unasked; the opening picture, the scene live, its heavy moment held still under
// each preset, the sweep inside the same take, the scene's tail; everything put back at the end and when stopped; a slow machine cut short; the text of the report.
// No browser, no GPU.   bun run tools/qa/bench-check.ts   (exit 0 = all pass; BENCH_BREAK=1 leaves a preset on at the end and must fail)
import { Bench, benchReport, BENCH_FRAMES, type BenchResult, type BenchScene, type BenchSweep } from '../../src/ui/bench';
import { AUTO_LADDER } from '../../src/ui/quality';
import { readFileSync } from 'node:fs';
const BREAK = (globalThis as any).process?.env?.BENCH_BREAK === '1';
let now = 0; (performance as any).now = () => now;
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };

/** a frame's cost on the fake machine, ms: the preset's own, less what the sweep's flipped row gives back, times how slow the machine is */
const COST: Record<string, number> = { verylow: 6, low: 9, medium: 14, high: 22, ultra: 40 };
function page(o: { slow?: number; scene?: 'none' | 'short' | 'full' | 'calm'; timers?: boolean; awayDep?: boolean; settled?: boolean; hz?: number } = {}) {
  const slow = o.slow ?? 1;
  const S: any = { renderScale: 0.8, sharpDirect: true, rtReflect: true, rcPeriods: [1, 1, 2, 4], exposure: 1.5 };
  const applied: string[] = [];
  const Q: any = { current: 'medium', auto: true, calibrating: false, climbed: ['a rung'], failed: new Map([['x', 1]]), failCount: new Map([['x', 2]]),
    get label() { return this.auto ? `auto (${this.current})` : this.current; },
    apply(n: string) { applied.push(n); this.current = n; S.renderScale = n === 'verylow' ? 0.5 : n === 'low' ? 0.6 : n === 'medium' ? 0.75 : 1; S.sharpDirect = n === 'high'; S.rcPeriods = n === 'high' ? [1, 1, 1, 2] : [1, 1, 2, 4]; this.climbed = []; this.failed.clear(); this.failCount.clear(); } };
  const frames: any[] = [], events: { kind: string; text: string }[] = []; let dumps = 0, asked = 0, covered: string | null = null; const saved: boolean[] = [];
  const rec: any = { recording: false, cap: 36000, commit: 'abcdef0123456789', get frameCount() { return frames.length; }, get framesLeft() { return this.cap - frames.length; }, frameAt: (f: number) => frames[f],
    start(_note: string, n: number) { this.recording = true; frames.length = 0; asked = n; }, stop(deliver = true) { this.recording = false; if (deliver) dumps++; return { commit: this.commit, frames: [...frames], events }; }, event(kind: string, text: string) { events.push({ kind, text }); } };
  const smoke = { params: { rbIters: 8 } };
  let sceneT = -1, sceneStops = 0; const LEN = o.scene === 'short' ? 3000 : 20000;
  const scene: BenchScene | null = o.scene === 'none' ? { start: () => 'units are on the floor', active: () => false, stop() {}, heavy: () => false }
    : { start: () => { sceneT = 0; return null; }, active: () => sceneT >= 0 && sceneT < LEN, stop() { sceneStops++; sceneT = -1; }, heavy: () => o.scene !== 'calm' && sceneT >= 5000 };
  const SEQ = ['base', 'reflect', 'base', 'sharp', 'base']; let sw = -1, swFrames = 0, swStops = 0, swOpts: any = null;
  const sweep: BenchSweep = { start(op) { swOpts = op; sw = 0; swFrames = 0; return 'sweeping'; }, active: () => sw >= 0, flipped: () => sw >= 0 ? SEQ[sw] : '', ...(o.settled ? { settled: () => sw >= 0 && swFrames >= 6 } : {}), progress: () => sw >= 0 ? `${sw + 1}/${SEQ.length}` : 'done', stop() { swStops++; sw = -1; } };
  const shown: string[] = []; let veil: string | null = null;
  const E: any = { settings: S, width: 1280, height: 720, timer: { enabled: o.timers !== false }, gpu: { adapterInfo: 'fake metal-3' } };
  let hidden = false, live = 0;
  const bench = new Bench(E, Q, rec, { smoke, scene, sweep, ...(o.awayDep ? { away: () => { const a = hidden; hidden = false; return a; } } : {}), view: { progress: t => { veil = t; }, show: (r, _close, sv) => { shown.push(r); saved.push(sv !== false); } }, covered: () => covered, ...(o.hz ? { hz: () => o.hz! } : {}),
    boot: () => ({ marks: { interactive: 12400 }, spans: { beforeScript: 300, pipelines: 9100, firstFrameCpu: 400, firstFrameGpu: 1700 }, pipelines: { total: 212, done: 212, failed: 0 }, longTasks: [], maxLongTask: 5100, maxRafGap: 6200, rafGapAt: 0, userAgent: 'x' }),
    machine: () => ({ now: { webgpu: 'fake metal-3', webgl: 'ANGLE (Fake, ANGLE Metal Renderer: Fake M9 Pro, Unspecified Version)', browser: 'Chrome 154', os: 'macOS 15.1.0 arm', userAgent: 'x', dpr: 2, threads: 10, memoryGb: 8, screen: [1728, 1117], view: [1512, 860], ...(o.hz ? {} : { hz: 120 }), power: 'on battery (67 %)' }, more: Promise.resolve() }) });
  const states: string[] = [], frozenIn = new Set<string>(), liveIn = new Set<string>();
  /** one presented frame: the world steps unless held, the recorder takes the frame, the sweep and the benchmark tick */
  const frame = (ms?: number) => {
    const giveBack = sw >= 0 ? (SEQ[sw] === 'reflect' ? 2 : SEQ[sw] === 'sharp' ? -1 : 0) : 0;
    const cost = ms ?? (COST[Q.current] - giveBack) * slow;
    now += cost;
    if (bench.active) (bench.freezing ? frozenIn : liveIn).add(bench.state);
    if (bench.active && !bench.freezing && rec.recording) live++;
    if (!bench.freezing && sceneT >= 0) sceneT += cost;
    if (rec.recording) frames.push({ t: now, dt: cost, fps: 1000 / cost, cpu: { update: 1, render: 1, other: 0.5 }, gpu: { direct: cost * 0.5, gather: cost * 0.3 }, gpuSum: cost * 0.8, ...(E.timer.enabled ? { gpuUnion: +(cost * 0.9).toFixed(3) } : {}), res: [E.width, E.height], eff: S.renderScale, preset: Q.label, adaptive: true, cam: [0, 0, 0, 0, 0], n: {} });
    if (sw >= 0 && ++swFrames >= 12) { swFrames = 0; if (++sw >= SEQ.length) sw = -1; }
    bench.tick(cost / 1000);
    if (states[states.length - 1] !== bench.state) states.push(bench.state);
  };
  const run = (cap = 200000) => { for (let i = 0; i < cap && bench.active; i++) frame(); };
  return { cover(why: string | null) { covered = why; }, saved, get asked() { return asked; }, hide() { hidden = true; }, get live() { return live; }, frames, S, Q, rec, bench, frame, run, applied, events, shown, states, frozenIn, liveIn, smoke, get veil() { return veil; }, get dumps() { return dumps; }, get sceneStops() { return sceneStops; }, get swStops() { return swStops; }, get swOpts() { return swOpts; } };
}
const before = (p: ReturnType<typeof page>) => JSON.stringify([p.S, p.Q.current, p.Q.auto, p.Q.climbed, [...p.Q.failed], [...p.Q.failCount], p.smoke.params.rbIters]);

{ // unasked: nothing
  const p = page(), was = before(p);
  for (let i = 0; i < 200; i++) p.frame();
  check(!p.rec.recording && !p.applied.length && before(p) === was && p.veil === null && !p.bench.active && !p.bench.freezing, 'unasked: no recording, no preset applied, no setting written, nothing on the screen');
}
{ // a whole run
  const p = page(), was = before(p);
  console.log(p.bench.start());
  check(p.bench.active && p.bench.freezing && !p.rec.recording, 'started: the world is held, and nothing is recorded while the page settles');
  if (BREAK) { const real = p.Q.apply.bind(p.Q); let n = 0; p.Q.apply = (name: string) => { if (++n <= AUTO_LADDER.length) real(name); }; }   // (the apply that puts the page's own preset back is lost)
  p.run();
  check(!p.bench.active && p.bench.last === 'done', `ran to its end by itself (${p.bench.last})`);
  check(p.states.join(' ') === 'waiting opened scene held sweep tail idle' && p.bench.acts.join(' ') === p.states.join(' '), `the acts in order, and the run's own list of them agrees: ${p.states.join(' ')}`);
  check(['waiting', 'opened', 'held', 'sweep'].every(s => p.frozenIn.has(s)) && p.liveIn.has('scene') && p.liveIn.has('tail') && p.liveIn.size === 2, 'the world is held for the windows and the sweep, and runs for the scene');
  const R = p.bench.result as BenchResult, ids = R.steps.map(s => s.id).join(' ');
  check(ids === 'opened scene held verylow low medium high', `a line per window: ${ids}`);
  { const sc = R.steps[1]; check(sc.frames === p.live && sc.quality === 'auto (medium)' && sc.scale === 0.8 && R.steps[3].scale === 0.5 && R.steps[3].quality === 'verylow', `the scene's line is every live frame (${sc.frames}), and each line says what its own frames were drawn at`); }
  const ms = (id: string) => R.steps.find(s => s.id === id)!.ms;
  check(ms('opened') === 14 && ms('held') === 14 && ms('verylow') === 6 && ms('low') === 9 && ms('medium') === 14 && ms('high') === 22, 'each window carries its own preset\'s frame time');
  check(p.applied.join(' ') === 'verylow low medium high medium', `the presets from the bottom up, then the page's own again: ${p.applied.join(' ')}`);
  check(before(p) === was, 'everything is back as it stood: the settings, auto, the ladder\'s rungs, the smoke row');
  const F = Object.fromEntries((R.features ?? []).map(f => [f.id, f]));
  check(!!F.reflect && Math.abs(F.reflect.ms - 2) < 0.01 && Math.abs((F.reflect.gpu ?? 0) - 1.8) < 0.01 && Math.abs(F.sharp.ms + 1) < 0.01 && F.reflect.label === 'reflections off', `each feature against the baselines beside it: reflections give back ${F.reflect?.ms}, sharp ${F.sharp?.ms}`);
  check(p.swOpts?.inside === true && p.swOpts.rounds === 1 && p.asked === BENCH_FRAMES && BENCH_FRAMES >= 6 * 60 * 240, 'the sweep runs inside the take: one round, the recording left running, and the take has room for six minutes on a fast display');
  check(p.dumps === 1 && p.events.filter(e => e.kind === 'bench').length === 1 && JSON.parse(p.events.find(e => e.kind === 'bench')!.text).steps.length === 7, 'the take is stopped once, with the report in it as an event');
  const T = p.shown[0] ?? '', lines = T.split('\n');
  console.log(T.split('\n').map(l => '    | ' + l).join('\n'));
  check(p.shown.length === 1 && p.veil === null && T === p.bench.report && p.saved[0] === true, 'the card shows the report and says the file was saved, the veil is gone');
  check(/Fake M9 Pro/.test(T) && /WebGPU says: fake metal-3/.test(T) && /Chrome 154 · macOS 15\.1\.0 arm/.test(T) && /on battery/.test(T) && /build abcdef01/.test(T), 'the report names the GPU, the browser, the system, the power and the build');
  check(/load\s+12\.4 s to the start card · shaders 9\.1 s \(212 of 212\) · longest freeze 6\.2 s · first frame 2\.1 s/.test(T), 'the report carries the boot: the start card, the shaders, the longest freeze, the first frame');
  check(lines.length <= 40 && lines.every(l => l.length <= 150) && /reflections off/.test(T), `the report is short enough to paste (${lines.length} lines, longest ${Math.max(...lines.map(l => l.length))})`);
}
{ // a slow machine: the ladder is cut short and the features are not flipped
  const p = page({ slow: 20 }), was = before(p);
  p.bench.start(); p.run();
  const R = p.bench.result!, by = Object.fromEntries(R.steps.map(s => [s.id, s]));
  check(p.bench.last === 'done' && !by.verylow.skipped && !by.low.skipped && /low ran at/.test(by.medium.skipped ?? '') && /low ran at/.test(by.high.skipped ?? '') && p.applied.join(' ') === 'verylow low medium', `under eight frames a second ends the ladder: ${by.high.skipped}`);
  check(p.swOpts === null && !R.features && R.notes.some(n => /not timed one by one/.test(n)), 'a held picture under four frames a second: the features are left out, and the report says so');
  check(before(p) === was && p.applied[p.applied.length - 1] === 'medium', 'everything back');
}
{ // stopped while a preset stands
  const p = page(), was = before(p);
  p.bench.start(); for (let i = 0; i < 100000 && p.Q.current !== 'low'; i++) p.frame();
  check(p.bench.state === 'held' && p.Q.current === 'low' && p.Q.auto === false, 'mid-run: a preset of the benchmark\'s stands, auto off');
  p.bench.stop('Esc');
  check(!p.bench.active && before(p) === was && p.sceneStops === 1 && p.bench.last === 'stopped: Esc', 'stopped: everything back, the scene ended');
  check(p.shown.length === 1 && /stopped early \(Esc\)/.test(p.shown[0]) && p.dumps === 1, 'what was timed is still shown and kept');
}
{ // stopped during the sweep
  const p = page(), was = before(p);
  p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'sweep'; i++) p.frame(); for (let i = 0; i < 15; i++) p.frame();
  p.bench.stop('Esc');
  check(p.swStops === 1 && !p.bench.sweeping && before(p) === was && !p.bench.result!.features, 'stopped in the sweep: the sweep is told, everything back; no row was through yet, none is priced');
}
{ // stopped later in the sweep: the rows it got through are priced
  const p = page();
  p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'sweep'; i++) p.frame(); for (let i = 0; i < 30; i++) p.frame();
  p.bench.stop('Esc');
  const F = p.bench.result!.features ?? [];
  check(F.length === 1 && F[0].id === 'reflect' && Math.abs(F[0].ms - 2) < 0.01, `stopped two rows into the sweep: the row that was through is priced (${F.map(f => f.id).join(' ') || 'none'})`);
}
{ // a sweep that says when a segment has settled: its frames from there are the ones priced
  const p = page({ settled: true });
  p.bench.start(); p.run();
  const F = Object.fromEntries((p.bench.result!.features ?? []).map(f => [f.id, f]));
  check(!!F.reflect && Math.abs(F.reflect.ms - 2) < 0.01 && Math.abs(F.sharp.ms + 1) < 0.01, 'the sweep\'s own word for settled is taken: the same prices');
}
{ // the display's rate is not known when a run starts with the page: it is asked again at the end
  const p = page({ hz: 60 });
  p.bench.start(); p.run();
  check(p.bench.result!.machine.hz === 60 && / 60 Hz/.test(p.bench.report), 'the display\'s rate is in the report though the page did not know it at the start');
}
{ // a screen of the page's own comes up over the title while it is being timed
  const p = page(), was = before(p);
  p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'opened'; i++) p.frame(); for (let i = 0; i < 5; i++) p.frame();
  p.cover('a screen came up over it'); p.frame();
  check(!p.bench.active && p.bench.last === 'stopped: a screen came up over it' && !p.shown.length && !p.dumps && before(p) === was, 'a screen up over the title\'s window: the run stops, nothing shown, nothing kept');
}
{ // stopped before anything was timed
  const p = page(); p.bench.start(); p.frame(); p.bench.stop('Esc');
  check(!p.bench.active && !p.shown.length && !p.dumps && p.veil === null, 'stopped while waiting: nothing shown, nothing kept');
}
{ // stopped inside the first window: there is no number yet
  const p = page(); p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'opened'; i++) p.frame(); for (let i = 0; i < 5; i++) p.frame();
  p.bench.stop('Esc');
  check(!p.bench.active && !p.rec.recording && !p.shown.length && !p.dumps && p.veil === null, 'stopped inside the first window: the recording is dropped, no card, no file');
}
{ // the recording fills up under the sweep
  const p = page(), was = before(p);
  p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'sweep'; i++) p.frame();
  p.rec.cap = p.frames.length + 70; p.run();
  check(p.bench.last === 'stopped: the recording was full' && p.swStops === 1 && p.dumps === 1 && p.events.filter(e => e.kind === 'bench').length === 1 && p.frames.length < p.rec.cap && before(p) === was, 'the recording nearly full under the sweep: the run ends first, with its report in the file, everything back');
}
{ // a scene whose heavy moment never comes
  const p = page({ scene: 'calm' });
  p.bench.start({ heavyCapMs: 3000 }); p.run();
  check(p.bench.last === 'done' && p.bench.acts.join(' ') === 'waiting opened scene held sweep tail idle' && p.bench.result!.notes.some(n => /heavy moment had not come 3 s in/.test(n)), 'no heavy moment in the scene: it is held at the cap, and the report says so');
}
{ // no scene on this floor
  const p = page({ scene: 'none' }), was = before(p);
  p.bench.start(); p.run();
  check(p.bench.last === 'done' && p.states.join(' ') === 'waiting opened held sweep idle' && !p.liveIn.size, `no scene: the opening picture is the one held (${p.states.join(' ')})`);
  check(p.bench.result!.notes.some(n => /no scene was played \(units are on the floor\)/.test(n)) && !p.bench.result!.steps.some(s => s.id === 'scene') && before(p) === was, 'the report says why, and has no scene line');
}
{ // a scene that ends before its heavy moment
  const p = page({ scene: 'short' });
  p.bench.start(); p.run();
  check(p.bench.last === 'done' && p.states.join(' ') === 'waiting opened scene held sweep idle' && p.bench.result!.steps[1].id === 'scene', 'a scene over before its smoke: what it left is held, and the run still ends');
}
{ // no GPU timings
  const p = page({ timers: false });
  p.bench.start(); p.run();
  const R = p.bench.result!;
  check(R.steps.every(s => s.gpu === null) && R.features!.every(f => f.gpu === null) && /frame ms given back/.test(p.bench.report) && R.notes.some(n => /no GPU timings/.test(n)), 'no GPU timings: the frame time stands in, and the report says so');
}
{ // the tab away in the middle of a window
  const p = page();
  p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'opened'; i++) p.frame(); for (let i = 0; i < 160; i++) p.frame();
  p.frame(9000); p.run();
  const o = p.bench.result!.steps[0];
  check(o.id === 'opened' && o.p95 === 14 && p.bench.result!.notes.some(n => /the tab was away 1 time/.test(n)), 'a nine-second frame is the tab away: that window starts over, and no such frame is in its numbers');
}
{ // a page that says when it was hidden: the gap alone is not the tab away, and a hidden frame of the scene is left out
  const slow = page({ slow: 300, awayDep: true });
  slow.bench.start(); slow.run();
  check(slow.bench.last === 'done' && !slow.bench.result!.notes.some(n => /tab was away/.test(n)), 'a machine whose every frame takes four seconds is not a tab left away');
  const p = page({ awayDep: true });
  p.bench.start(); for (let i = 0; i < 100000 && p.bench.state !== 'scene'; i++) p.frame(); for (let i = 0; i < 20; i++) p.frame();
  p.hide(); p.frame(9000); p.run();
  const sc = p.bench.result!.steps[1];
  check(sc.id === 'scene' && sc.frames === p.live - 1 && p.bench.result!.notes.some(n => /the tab was away 1 time/.test(n)), `the tab hidden during the scene: that frame is not in the scene's numbers (${sc.frames} of ${p.live})`);
  const w = page({ awayDep: true });
  w.bench.start(); for (let i = 0; i < 25; i++) w.frame(); w.hide(); w.frame(60000); for (let i = 0; i < 25; i++) w.frame();
  const still = w.bench.state; for (let i = 0; i < 10; i++) w.frame();
  check(still === 'waiting' && w.bench.state === 'opened', 'opened in a tab nobody looked at for a minute: the wait starts over when it is looked at');
}
{ // the page's wiring, read as text: the scene's heavy moment is a chapter of the day show whose title the page looks for
  const script = readFileSync(new URL('../../levels/office.script.ts', import.meta.url), 'utf8'), main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
  const loud = /const LOUD_CHAPTERS = \[(.*?)\];/.exec(script)?.[1] ?? '', titles = [...loud.matchAll(/title: '([^']*)'/g)].map(m => m[1]);
  check(titles.filter(t => /smoke/.test(t)).length === 1 && /heavy: \(\) => \{ const c = breach\.chapters\(\); return \/smoke\/\.test\(/.test(main), `the day show has one chapter the page takes for its heavy moment: ${titles.filter(t => /smoke/.test(t)).join(', ') || 'none'}`);
}
{ // the recorder stopped by hand, and a run refused
  const p = page(), was = before(p);
  p.bench.start(); for (let i = 0; i < 100000 && p.Q.current !== 'verylow'; i++) p.frame();
  p.rec.recording = false; p.frame();
  check(!p.bench.active && /the recorder stopped/.test(p.bench.last) && before(p) === was, 'the recorder stopped under it: the run ends, everything back');
  p.rec.recording = true; check(/^not now/.test(p.bench.start()) && !p.bench.active, 'a recording under way: a run is refused'); p.rec.recording = false;
}
{ // the text on its own
  const r: BenchResult = { version: 1, at: '2026-01-02T03:04:05.000Z', query: '', machine: { webgpu: 'x y', browser: '', os: '', userAgent: 'UA/1', dpr: 1, fallback: true }, boot: null, timers: true, steps: [], notes: ['a note'] };
  const T = benchReport(r);
  check(/SOFTWARE RENDERING/.test(T) && /\(no flags\)/.test(T) && /browser\s+UA\/1/.test(T) && /a note$/.test(T) && !/undefined|NaN/.test(T), 'a bare result still reads: the software adapter is said, nothing undefined');
}
console.log(red ? `\n${red} FAILED` : '\nall pass');
(globalThis as any).process?.exit(red ? 1 : 0);
