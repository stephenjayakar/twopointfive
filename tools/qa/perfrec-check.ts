// THE RECORDER'S WATCH ON THE PAGE'S OWN THREAD (src/ui/perfrec.ts) and the report's reading of stalls (tools/qa/perf-stalls.ts), on a fake page: a frame's beat is
// the longest silence of the 4 ms timer in the gap between the frame before and it (neither frame's own step in it); a headless take carries none and is the take
// it was; a long frame or task the browser reports becomes one line at the moment it began; the tab going out of sight is said; the real timer answers, stops
// with the take, and can be left off; and the report tells a stall in the frame, one with the thread held, one with the thread free.
//   bun run tools/qa/perfrec-check.ts   (exit 0 = all pass; PERFREC_BREAK=1 = the timer never answers and the takes have no beat: must fail)
import { PerfRecorder, longText } from '../../src/ui/perfrec';
import { readStalls, stallLines } from './perf-stalls';
const BREAK = process.env.PERFREC_BREAK === '1';
const realNow = performance.now.bind(performance); let now = 1000, fake = true; (performance as any).now = () => fake ? now : realNow();
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };
const GAME: any = { guards: [], saves: { stats: { autosaves: 3, manual: 0, loads: 0 } } };
const mk = () => { const timer: any = { lastFrame: new Map([['direct', 3], ['gather', 2]]), results: new Map(), lastRaw: [] };
  const engine: any = { timer, width: 100, height: 50, effectiveScale: 1, lights: { activeCount: 1 }, world: { dynamics: [] }, settings: { renderScale: 1, keepHistories: true }, passes: { reallocs: 0, lastRealloc: '' }, gpu: { adapterInfo: 'fake' } };
  return new PerfRecorder(engine, GAME as any, { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 1 } as any, { label: 'high', adaptive: false, lastChange: '' } as any, () => {}); };
/** one frame as the page runs it: the step begins (the gap ends), the step takes `cpu` ms with the thread busy, the frame is recorded */
const step = (r: PerfRecorder, dt: number, cpu = 1) => { r.cpuFrameStart = now; now += cpu; r.cpuUpdate = cpu; r.frame(dt / 1000, 1000 / dt); };
const page = (vis: any = {}) => { (globalThis as any).document = vis; };
// 1 · headless: no timer, no key
{ const r = mk(); r.start('headless'); for (let i = 0; i < 5; i++) { now += 15; step(r, 16); } const d = r.stop(false)!;
  check(d.frames.length === 5 && d.frames.every(f => !('beat' in f)) && !d.events.some(e => e.kind === 'long' || e.kind === 'tab') && Object.keys(d.frames[0]).join() === 't,dt,fps,cpu,gpu,gpuSum,res,eff,preset,adaptive,cam,n', 'a headless take keeps no beat: its frames carry the keys they always did'); }
// 2 · the page: the beat is the longest silence in the gap before the frame, the wait up to the frame's start counted, no frame's own step in it
{ page(); const r = mk(); r.start('page'); const tick = (ms: number) => { now += ms; if (!BREAK) r.beatTick(); };   // (BREAK: the timer never answers)
  for (let k = 0; k < 4; k++) tick(4); step(r, 16);                          // calm: answered every 4 ms
  tick(4); tick(41); tick(4); step(r, 50);                                    // held 41 ms between two answers
  for (let k = 0; k < 12; k++) tick(4); now += 1; step(r, 50);                // 49 ms of gap with the thread answering all the way: free
  now += 37; step(r, 38);                                                    // held right up to the frame: no answer since the frame before
  tick(4); step(r, 5, 40);                                                   // this frame's own step is 40 ms: not in its beat …
  tick(4); step(r, 45);                                                      // … and not in the next one's
  const d = r.stop(false)!, b = d.frames.map(f => f.beat);
  check(b.join(' ') === '4 41 4 37 4 4', `the beat of six frames: calm, held between answers, free, held up to the frame, and a 40 ms step that is in no beat (${b.join(' ')})`);
  // 3 · what the browser reports, at the moment it began, in the order things happened, and no more than the cap of each kind
  const r2 = mk(); r2.start('long'); const t0 = now; for (let i = 0; i < 40; i++) { now += 15; step(r2, 16); }   // frames end at t = 16, 32, 48 …
  r2.long('longtask', { startTime: t0 + 120, duration: 63, name: 'cross-origin-ancestor', attribution: [{ containerType: 'iframe', containerSrc: 'https://host.test/frames/outer.html?x=1' }] });
  r2.long('long-animation-frame', { startTime: t0 + 300, duration: 91.4, blockingDuration: 41, scripts: [{ duration: 12, invokerType: 'classic-script', invoker: 'https://x.test/a/very/long/path/to/the/bundle/small.js?v=2', sourceURL: 'https://x.test/a/very/long/path/to/the/bundle/small.js?v=2' },
    { duration: 70, invokerType: 'user-callback', invoker: 'TimerHandler:setInterval', sourceFunctionName: 'autosave', sourceURL: 'https://x.test/a/b/game.js?v=1#h' }] });
  r2.long('longtask', { startTime: t0 - 5, duration: 60, name: 'self' });
  r2.event('mark', 'now');
  for (let i = 0; i < 400; i++) r2.long('longtask', { startTime: t0 + 400 + i, duration: 55, name: 'unknown' });
  const d2 = r2.stop(false)!, L = d2.events.filter(e => e.kind === 'long'), ts = d2.events.map(e => e.t);
  check(L[0].t === 120 && L[0].text === 'task 63 ms · cross-origin-ancestor (iframe outer.html)' && L[1].t === 300 && L[1].text === 'frame 91 ms, blocking 41 ms · 70 ms user-callback TimerHandler:setInterval autosave @game.js · 12 ms classic-script small.js @small.js',
    `a long task and a long frame are one line each, stamped when they began, with file names and no address (${L[0].text} | ${L[1].text})`);
  check(L[0].frame === 7 && L[1].frame === 18 && d2.frames[L[0].frame].t >= 120 && d2.frames[L[0].frame - 1].t < 120 && ts.every((t, i) => !i || t >= ts[i - 1]) && ts[0] >= 0, `each carries the first frame recorded after it began, and the take's events stay in time order (#${L[0].frame}, #${L[1].frame})`);
  check(L.length === 301 && d2.events.filter(e => e.kind === 'longcap').length === 1 && !L.some(e => /not listed/.test(e.text)), `a page that is slow all the time fills 300 lines of a kind and one line of another kind that says the rest are left out`);
  check(longText('long-animation-frame', { startTime: 0, duration: 60 }) === 'frame 60 ms · no script named' && longText('longtask', { startTime: 0, duration: 50.6 }) === 'task 51 ms · unknown', 'an entry with nothing to blame still reads');
  const r3 = mk(); r3.long('longtask', { startTime: now, duration: 60 }); r3.start('after'); now += 15; step(r3, 16); const d3 = r3.stop(false)!;
  check(!d3.events.some(e => e.kind === 'long') && d3.frames[0].beat! >= 0, 'a report that arrives while nothing is recording is dropped');
  // the tab out of sight and back, and a take that begins hidden; the listener leaves with the take
  const lis: Record<string, () => void> = {}, doc: any = { hidden: true, addEventListener: (k: string, f: () => void) => { lis[k] = f; }, removeEventListener: (k: string) => { delete lis[k]; } };
  page(doc); const r4 = mk(); r4.start('tab'); now += 15; step(r4, 16); doc.hidden = false; now += 900; lis.visibilitychange(); now += 15; step(r4, 930); const had = !!lis.visibilitychange; const d4 = r4.stop(false)!;
  check(d4.events.filter(e => e.kind === 'tab').map(e => e.text).join() === 'hidden,shown' && had && !lis.visibilitychange, 'a take that begins out of sight says so, says when the tab is back, and takes its listener with it');
  // `watch` off: the page's take as a headless one
  page(); const r5 = mk(); r5.watch = false; r5.start('unwatched'); now += 15; step(r5, 16); const d5 = r5.stop(false)!;
  check(!('beat' in d5.frames[0]), 'with the watch off a take on the page keeps no beat'); }
// 3b · the wiring to the browser's own reports, on a stand-in observer: the page's own long task is said once (by its long frame), what the browser still held when
//      the take stops is read the same way, and a browser that will not watch long frames keeps the long tasks
{ class FakePO { static supportedEntryTypes = ['long-animation-frame', 'longtask']; static all: FakePO[] = []; static refuse = ''; type = ''; q: any[] = []; off = false;
    constructor(public cb: (l: { getEntries: () => any[] }) => void) { FakePO.all.push(this); }
    observe(o: { type: string }) { if (o.type === FakePO.refuse) throw new Error('no'); this.type = o.type; } takeRecords() { const q = this.q; this.q = []; return q; } disconnect() { this.off = true; } }
  const realPO = (globalThis as any).PerformanceObserver; (globalThis as any).PerformanceObserver = FakePO; page();
  const take = (refuse: string) => { FakePO.all = []; FakePO.refuse = refuse; const r = mk(); r.start('wired'); const t0 = now; for (let i = 0; i < 5; i++) { now += 15; step(r, 16); }
    const po = (t: string) => FakePO.all.find(o => o.type === t)!;
    po('longtask').cb({ getEntries: () => [{ startTime: t0 + 10, duration: 60, name: 'self' }, { startTime: t0 + 20, duration: 70, name: 'cross-origin-descendant' }] });
    po('long-animation-frame')?.cb({ getEntries: () => [{ startTime: t0 + 10, duration: 60, scripts: [{ duration: 50, invokerType: 'event-listener', invoker: 'IMG[src=https://host.test/private/path/pic.png].onload', sourceURL: 'blob:https://host.test/3f2a-11' }] }] });
    po('longtask').q.push({ startTime: t0 + 40, duration: 61, name: 'self' }); po('long-animation-frame')?.q.push({ startTime: t0 + 40, duration: 61 });
    const d = r.stop(false)!; return { texts: d.events.filter(e => e.kind === 'long').map(e => e.text), off: FakePO.all.every(o => o.off) }; };
  const A = take(''), B = take('long-animation-frame');
  check(A.texts.length === 3 && A.texts.filter(t => /self/.test(t)).length === 0 && A.off && A.texts[0] === 'frame 60 ms · 50 ms event-listener IMG[src=pic.png].onload @blob' && !A.texts.join().includes('host.test'),
    `with long frames watched the page's own long task is said once, by its frame, in the callback and in what was still held at the stop; no address of any shape is kept (${A.texts[0]})`);
  check(B.texts.length === 3 && B.texts.filter(t => /self/.test(t)).length === 2, 'a browser that lists long frames and will not watch them keeps the page\'s own long tasks');
  (globalThis as any).PerformanceObserver = realPO;
  // a take begun inside a step (the F9 key) has no word on the gap before its first frame; a page whose usual frame is long keeps only the holds well over it
  const r = mk(); r.cpuFrameStart = now; r.start('mid step'); now += 1; r.frame(0.016, 60); now += 12; if (!BREAK) r.beatTick(); step(r, 16); const d = r.stop(false)!;
  const r2 = mk(); r2.start('slow page'); const t0 = now; for (let i = 0; i < 20; i++) { now += 59; step(r2, 60); } r2.long('long-animation-frame', { startTime: t0 + 300, duration: 62 }); r2.long('long-animation-frame', { startTime: t0 + 600, duration: 140 }); const d2 = r2.stop(false)!;
  check(!('beat' in d.frames[0]) && d.frames[1].beat === 12 && d2.events.filter(e => e.kind === 'long').map(e => e.t).join() === '600', 'a take begun inside a step has no beat on its first frame; on a page at 60 ms a frame only a hold well over that is kept'); }
// 3c · a checkpoint written during the take is an event of the step it was written in, and the report sets it beside the stall that step made
{ page(); const r = mk(); r.start('saves'); for (let i = 0; i < 60; i++) { now += 15; step(r, 16); } GAME.saves.stats.autosaves++; now += 15; step(r, 16, 60); now += 2; step(r, 78); for (let i = 0; i < 60; i++) { now += 15; step(r, 16); }
  GAME.saves.stats.loads++; now += 15; step(r, 16); const d = r.stop(false)!, ev = d.events.filter(e => e.kind === 'save' || e.kind === 'load'), R = readStalls(d as any);
  check(ev.length === 2 && ev[0].kind === 'save' && /4 by the game/.test(ev[0].text) && ev[1].kind === 'load' && R.stalls.length === 1 && R.stalls[0].verdict === 'in the frame' && /^save: a checkpoint was written/.test(R.stalls[0].beside[0] ?? '') && /beside it: save/.test(stallLines(d as any).join('\n')),
    `a save the game made before the take is no event; one made during it is, and stands beside the stall its step made (${R.stalls[0]?.beside[0]})`); }
// 3d · a hold of the thread outside the frame is an event with the input handler that took it; goggles easing on and a hit's flash are no settings changed
{ page(); const L: Record<string, ((e: any) => void)[]> = {}, hadWin = 'window' in globalThis, win0 = (globalThis as any).window;
  (globalThis as any).window = { addEventListener: (t: string, f: any, o: any) => { (L[t] ??= [])[o?.capture ? 0 : 1] = f; }, removeEventListener: (t: string, f: any) => { L[t] = (L[t] ?? []).map(x => x === f ? undefined as any : x); } };
  const r = mk(); Object.assign((r as any).engine.settings, { nvAmount: 0, hitFlash: 0 }); r.start('holds'); const tick = (ms: number) => { now += ms; if (!BREAK) r.beatTick(); };
  for (let i = 0; i < 50; i++) { tick(4); tick(4); tick(4); now += 2; step(r, 15); }
  tick(4); L.wheel[0]({ type: 'wheel' }); now += 34; L.wheel[1]({ type: 'wheel' }); tick(1); now += 2; step(r, 42);          // a wheel handler holds 34 ms
  for (let i = 0; i < 10; i++) { tick(4); tick(4); tick(4); now += 2; step(r, 15); }
  tick(4); tick(27); now += 2; step(r, 34);                                                                             // 27 ms held with no input
  tick(4); L.keydown[0]({ type: 'keydown' }); tick(31); now += 2; step(r, 38);                                           // a keydown whose handlers stopped it going on
  tick(4); L.pointermove[0]({ type: 'pointermove' }); now += 1; L.pointermove[1]({ type: 'pointermove' }); tick(3); tick(4); now += 2; step(r, 15);   // a quick handler, no hold
  const E = (r as any).engine; for (let i = 0; i < 70; i++) { E.settings.nvAmount = i / 70; E.settings.hitFlash = (i % 9) / 9; tick(4); now += 9; step(r, 14); } E.settings.renderScale = 0.9; for (let i = 0; i < 40; i++) { tick(4); now += 9; step(r, 14); }
  const wired = !!L.wheel?.[0] && !!L.wheel?.[1]; const d = r.stop(false)!, H = d.events.filter(e => e.kind === 'held').map(e => e.text), ST = d.events.filter(e => e.kind === 'settings').map(e => e.text);
  check(H.length === 3 && /^35 ms with the thread held outside the frame · the page's wheel handlers took 34 ms of it$/.test(H[0]) && /^27 ms .* no input handler in it$/.test(H[1]) && /^31 ms .* a keydown came in it and its handlers hid their end$/.test(H[2]),
    `three holds, each with whose it was: a wheel handler, nothing of the page's input, an input whose end the page hid (${H.join(' | ')})`);
  check(wired && !L.wheel[0] && !L.wheel[1] && ST.length === 2 && /^nvAmount 0 → 1$/.test(ST[0]) && !/hitFlash/.test(ST.join()) && /renderScale 1 → 0.9/.test(ST[1]), `the listeners leave with the take; goggles easing on for seventy frames are one line, a hit's flash none, a setting changed is said (${ST.join(' | ')})`);
  const lines = stallLines(d as any).join('\n');
  check(/holds of the thread outside the frame, 20 ms or more: 3 · /.test(lines) && /wheel handlers 1 \(longest 35 ms\)/.test(lines) && /beside it: held: 35 ms · the page's wheel handlers took 34 ms of it/.test(lines), 'the report counts the holds by whose they were and sets each beside its stall');
  if (hadWin) (globalThis as any).window = win0; else delete (globalThis as any).window; }
// 4 · the report's reading
{ const f = (t: number, dt: number, o: any = {}) => ({ t, dt, cpu: { update: 0, render: 0.5, other: 0.5 }, gpuSum: 15, gpuUnion: 15, ...o }) as any;
  const run = (n: number, t0: number, o: any = {}, dt = 16.7) => Array.from({ length: n }, (_, i) => f(t0 + i * dt, dt, o));
  const F = [...run(200, 0, { beat: 4 }), f(3400, 49, { beat: 44 }), f(3408, 8, { beat: 4 }), ...run(300, 3425, { beat: 4 }), f(8500, 50, { beat: 5 }), ...run(300, 8517, { beat: 4 }),
    f(13583, 16.7, { beat: 4, cpu: { update: 40, render: 3, other: 1 } }), f(13645, 62, { beat: 5 }), ...run(60, 13662, { beat: 4 }), f(14700, 48, { beat: 4, gpuUnion: 44 }), ...run(60, 14717, { beat: 4 })];
  const ev: any[] = [{ t: 3360, frame: 200, kind: 'long', text: 'frame 52 ms · 44 ms user-callback TimerHandler:setInterval autosave @game.js' }, { t: 100, frame: 6, kind: 'long', text: 'far away' }];
  if (BREAK) for (const x of F) delete x.beat;   // (BREAK: a take with no beat cannot say whose the gap was)
  const R = readStalls({ frames: F, events: ev }), V = R.stalls.map(s => s.verdict).join(' | ');
  check(R.stalls.length === 4 && V === 'thread held | thread free | in the frame | in the frame' && R.bursts === 4, `four stalls, each read for what it is: a slow step is the frame BEFORE the long dt (${V})`);
  check(R.stalls[0].long.length === 1 && /autosave/.test(R.stalls[0].long[0]) && !R.stalls[1].long.length, 'a long line the browser gave is set beside the stall it falls in, and only that one');
  const two = [...run(100, 0, { beat: 4 }), f(1700, 50, { beat: 45 }), f(1750, 50, { beat: 45 }), ...run(100, 1767, { beat: 4 })], R2 = readStalls({ frames: two, events: [{ t: 1660, frame: 100, kind: 'long', text: 'once' }] as any });
  check(R2.stalls.length === 2 && R2.stalls[0].long.length === 1 && R2.stalls[1].long.length === 0 && R2.bursts === 1, 'two stalls back to back: one burst, and the browser\'s one line stands beside the first only');
  const old = F.map(({ beat, ...x }: any) => x), RO = readStalls({ frames: old, events: [] });
  check(RO.unknown === 2 && RO.inFrame === 2 && !RO.hasBeat && stallLines({ frames: old, events: [] }).some(l => /no beat/.test(l)), 'a take with no beat: its stalls between frames are counted and said to be unreadable');
  const beat: any[] = []; for (let k = 0; k < 80; k++) beat.push(...run(74, k * 1300, { beat: 4 }), f(k * 1300 + 1286, 50, { beat: 46 }));
  const RP = readStalls({ frames: beat, events: [] });
  check(RP.stalls.length === 80 && RP.bursts === 80 && Math.abs(RP.every - 1.3) < 0.05 && /a burst about every 1\.3 s/.test(stallLines({ frames: beat, events: [] })[0]), `a stall every 1.3 s reads as that, not as one group the length of the take (${RP.bursts} bursts, every ${RP.every.toFixed(2)} s)`);
  const heavy = [...run(600, 0), ...run(300, 10020, {}, 45), ...run(600, 23520)], RH = readStalls({ frames: heavy, events: [] });
  check(RH.stalls.length === 0 && readStalls({ frames: run(600, 0, {}, 33.3).map((x, i) => i === 100 ? { ...x, dt: 41 } : x), events: [] }).stalls.length === 0, 'a slower stretch is that stretch\'s usual frame, and a page its browser holds at 30 has no stall at 41 ms');
  const away = [...run(200, 0, { beat: 4 }), f(4600, 1200, { beat: 1000 }), ...run(200, 4617, { beat: 4 })], RA = readStalls({ frames: away, events: [{ t: 3420, frame: 200, kind: 'tab', text: 'hidden' }, { t: 4590, frame: 200, kind: 'tab', text: 'shown' }] as any });
  check(RA.stalls.length === 0 && RA.hidden === 1 && readStalls({ frames: away, events: [] }).held === 1, 'a long frame with the tab out of sight is not a stall, and is counted apart');
  const slow22 = [...run(200, 0, { beat: 4 }, 22.2), f(4500, 50, { beat: 44 }), ...run(200, 4522, { beat: 4 }, 22.2)], R22 = readStalls({ frames: slow22, events: [] });
  const hold6 = [...run(200, 0, { beat: 4 }), f(9400, 6000, { beat: 5990 }), ...run(200, 9417, { beat: 4 })], R6 = readStalls({ frames: hold6, events: [] });
  check(R22.held === 1 && R6.held === 1 && R6.hidden === 0 && readStalls({ frames: hold6.map(({ beat, ...x }: any) => x), events: [] }).hidden === 1, 'a 50 ms frame on a page at 45 a second is a stall; six seconds with the thread held and the tab in sight is the take\'s worst stall, not a hidden tab (an older take, with no word on the tab, still sets it apart)');
  const twoHolds = [...run(100, 0, { beat: 4 }), f(1720, 50, { beat: 22 }), ...run(100, 1737, { beat: 4 })], lateGpu = [...run(100, 0, { beat: 4 }), f(1718, 48, { beat: 4 }), f(1735, 16.7, { beat: 4 }), f(1752, 16.7, { beat: 4, gpuUnion: 44 }), ...run(100, 1769, { beat: 4 })];
  const RL = readStalls({ frames: lateGpu, events: [{ t: 400, frame: 24, kind: 'long', text: 'elsewhere' }] as any });
  check(readStalls({ frames: twoHolds, events: [] }).held === 1 && RL.inFrame === 1 && RL.loose === 1 && /1 more long frames or tasks .* fall in no stall/.test(stallLines({ frames: lateGpu, events: [{ t: 400, frame: 24, kind: 'long', text: 'elsewhere' }] as any }).join('\n')),
    'a gap eaten by two holds reads held; a frame whose GPU time is read back two rows later reads in the frame; a long line in no stall is counted, not lost');
  const oneAway = [...run(700, 0, { beat: 4 }), f(11720, 30000, { beat: 4 }), ...run(700, 11737, { beat: 4 })];
  check(readStalls({ frames: oneAway, events: [{ t: 11700, frame: 700, kind: 'tab', text: 'hidden' }] as any }).slow!.fps > 59, 'a frame out of sight is no part of the slowest ten seconds');
  const at = (dts: number[]) => { let t = 0; return dts.map(d => f(t += d, d)); }, dip = at([...Array(1200).fill(16.7), ...Array(600).fill(22.4), ...Array(1200).fill(16.7)]), RD = readStalls({ frames: dip, events: [] });
  check(RD.stalls.length === 0 && Math.abs(RD.slow!.fps - 44.6) < 0.3 && Math.abs(RD.slow!.at - 20) < 1.5 && /slowest ten seconds \(from 2\d s\) ran at 44\.\d/.test(stallLines({ frames: dip, events: [] }).join('\n'))
    && !/slowest/.test(stallLines({ frames: run(3000, 0), events: [] }).join('\n')) && readStalls({ frames: run(600, 0), events: [] }).slow === null,
    `a stretch of 22 ms frames with no stall in it is said as the slowest ten seconds (${RD.slow!.fps.toFixed(1)} fps from ${RD.slow!.at.toFixed(0)} s); an even take and a short one say nothing`); }
// 5 · the real timer, on the real clock: it answers, a held thread shows in the next frame's beat, and it stops with the take
(async () => {
  fake = false; page(); const r = mk(), spin = (ms: number) => { const t = realNow(); while (realNow() - t < ms) { /* the thread held */ } }, wait = (ms: number) => new Promise(res => setTimeout(res, ms));
  let answers = 0; const tick = r.beatTick.bind(r); r.beatTick = (n?: number) => { answers++; if (!BREAK) tick(n); };
  r.start('real'); await wait(60); r.cpuFrameStart = realNow(); r.frame(0.06, 16); const calm = answers;
  spin(80); r.cpuFrameStart = realNow(); r.frame(0.08, 12); const d = r.stop(false)!, after = answers; await wait(40);
  check(calm >= 4 && d.frames[0].beat! < 40 && d.frames[1].beat! >= 78 && d.frames[1].beat! < 140, `the real timer answers (${calm} times in 60 ms) and a thread held 80 ms is the next frame's beat (${d.frames.map(f => f.beat).join(', ')} ms)`);
  check(answers === after, 'the timer stops with the take');
  delete (globalThis as any).document;
  process.exit(red ? 1 : 0);
})();
