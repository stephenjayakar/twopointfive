// The sweep report's arithmetic held to a made-up take (tools/qa/perf-sweep.ts): frames with a known base, a slow drift, per-frame noise and a known saving per row are
// cut into the segments a real sweep logs; the report must hand each saving back, call the do-nothing row noise, and drop the settling frames (which carry a spike here).
// A second take has a slow stretch across it (the whole machine 15 % slower for some segments): the rounds at its edges must be marked, the median round and the noise hold.
//   bun run tools/qa/perf-sweep-selftest.ts        exit 0 = all pass, 1 = a check failed
import { readSweeps, sweepText, sweepMarkdown, smokeText, smokeUnit, type Dump, type Frame, type Ev } from './perf-sweep';
import { sweepOrder } from '../../src/ui/perfsweep';

const ROWS = [{ id: 'a', label: 'saves 1.5 ms', save: 1.5, pass: 'direct' }, { id: 'b', label: 'saves 0.4 ms', save: 0.4, pass: 'rc c1' }, { id: 'c', label: 'does nothing', save: 0, pass: '' }, { id: 'd', label: 'costs 0.8 ms', save: -0.8, pass: 'reflect' }, { id: 'e', label: 'saves 0.15 ms', save: 0.15, pass: 'gather' }];
type Row = typeof ROWS[number];
const SETTLE_F = 12, MEASURE_F = 60, SETTLE_MS = 100;
/** a made-up take: `order(round)` = the rows of a round in the order they are flipped; `slow(seg)` = the whole machine that much slower during that segment (a stretch outside the game) */
function take(rounds: number, order: (round: number) => Row[], slow: (seg: number) => number = () => 1, seed = 7): { D: Dump; segOf: (round: number, id: string) => number } {
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };   // (its own die: the take is the same every run)
  const frames: Frame[] = [], events: Ev[] = [], at = new Map<string, number>(); let t = 0;
  const ev = (o: unknown) => events.push({ t, frame: frames.length, kind: 'sweep', text: JSON.stringify(o) });
  const frame = (save: number, pass: string, settling: boolean, k = 1) => {
    const drift = 0.5 * t / 60000, n = (rnd() - 0.5) * 0.6;   // the scene warms by half a millisecond a minute; ±0.3 ms of frame noise
    const union = (12 + drift - save) * k + n + (settling ? 5 : 0);   // (settling frames are slow: they must not be counted)
    const gpu: Record<string, number> = { direct: 4, 'rc c1': 2, reflect: 0.5, gather: 1.2 }; if (pass) gpu[pass] -= save * 1.6;   // a pass's own number moves by more than the union does (overlap)
    const dt = union + 2.8; t += dt;
    frames.push({ t, dt, fps: 1000 / dt, cpu: { update: 1, render: 1, other: 0.2 }, gpu, gpuSum: Object.values(gpu).reduce((a, b) => a + b, 0), gpuUnion: union, res: [1284, 770], eff: 0.44, preset: 'high', adaptive: true, cam: [0, 0, 0, 0, 40], n: { smoke: 0 } } as Frame);
  };
  for (let i = 0; i < 100; i++) frame(0, '', false);   // some play before the key
  ev({ op: 'begin', mode: 'frozen', rounds, settleMs: SETTLE_MS, measureMs: 1000, settleFrames: SETTLE_F, measureFrames: MEASURE_F, preset: 'high', res: [1284, 770], scale: 0.77, smoke: 0, timers: true, rows: ROWS.map(r => ({ id: r.id, label: r.label, from: {}, to: {} })), skipped: [] });
  let i = 0; const seg = (round: number, r: Row | null) => { if (r) at.set(round + ':' + r.id, i); const k = slow(i); ev({ op: 'seg', i: i++, of: 0, round, id: r ? r.id : 'base', state: r ? 'flip' : 'base' }); for (let f = 0; f < SETTLE_F + MEASURE_F; f++) frame(r ? r.save : 0, r ? r.pass : '', f < SETTLE_F, k); };
  for (let round = 0; round < rounds; round++) for (const r of order(round)) { seg(round, null); seg(round, r); }
  seg(rounds - 1, null); ev({ op: 'end', done: true, why: 'done' });
  for (let k = 0; k < 50; k++) frame(0, '', false);
  return { D: { frames, events }, segOf: (round, id) => at.get(round + ':' + id)! };
}
const ROUNDS = 6, shuffled = (round: number) => sweepOrder(ROWS, round);   // (the order the sweep itself takes)
const T = take(ROUNDS, shuffled), D = T.D, { frames, events } = D; const R = readSweeps(D);
const edge = (seg: number) => { for (const r of ROWS) for (let k = 0; k < ROUNDS; k++) if (T.segOf(k, r.id) === seg) return { id: r.id, k }; return null; };
/** the slow stretch of the checks below: from the start of the do-nothing row's third flip to the start of the first later flip of ANOTHER row at least six segments on */
const STRETCH = (() => { const from = T.segOf(2, 'c'); let to = from + 6; while (edge(to)!.id === 'c') to += 2; return [from, to] as const; })(), slowed = (s: number) => s >= STRETCH[0] && s < STRETCH[1] ? 1.15 : 1;
let red = 0; const check = (ok: boolean, what: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
check(R.length === 1 && R[0].done && R[0].segments === ROUNDS * ROWS.length * 2 + 1, `one finished sweep, ${R[0]?.segments} segments`);
const S = R[0];
check(Math.abs(S.base.union! - 12.2) < 0.25, `the base is the plain frames': GPU union ${S.base.union!.toFixed(2)} ms (the settling spike of +5 ms is not in it)`);
for (const r of ROWS) {
  const p = S.rows.find(x => x.id === r.id)!;
  check(!!p && p.rounds === ROUNDS && Math.abs(p.union!.mean - r.save) < 0.08, `${r.label}: gives back ${p?.union?.mean.toFixed(2)} ms over ${p?.rounds} rounds (lowest ${p?.union?.lo.toFixed(2)}, highest ${p?.union?.hi.toFixed(2)})`);
  if (r.save) check(!p.inNoise, `${r.label}: marked a real difference`);
  if (r.pass) check(p.movers[0]?.pass === r.pass && Math.abs(p.movers[0].back - r.save * 1.6) < 0.01 && Math.abs(p.sum!.mean - r.save * 1.6) < 0.01, `${r.label}: its pass ${r.pass} moved ${p.movers[0]?.back.toFixed(2)} ms, more than the union did`);
}
const pa = S.rows.find(x => x.id === 'a')!; check(pa.fps.mean > 0 && Math.abs(pa.frame.mean - 1.5) < 0.08, `fps and frame time follow: +${pa.fps.mean.toFixed(1)} fps, ${pa.frame.mean.toFixed(2)} ms a frame`);
check(S.noise.union !== null && S.noise.union < 0.15, `the noise line: ±${S.noise.union!.toFixed(3)} ms a round with nothing flipped`);
for (const r of ROWS) { const p = S.rows.find(x => x.id === r.id)!; check(Math.abs(p.median - r.save) < 0.08 && p.per.length === ROUNDS && !p.disturbed.some(Boolean), `${r.label}: its median round ${p.median.toFixed(2)} ms, every round listed, none marked`); }
check(S.noise.n >= 12 && S.disturbed === 0 && S.noise.union === S.noise.rmsUnion && S.noise.dt === S.noise.rmsDt && !/ran slow/.test(sweepText(D).join('\n')), `a calm take: the noise is the plain rms over ${S.noise.n} plain segments, no round marked`);
{ // A SLOW STRETCH: the whole machine 15 % slower from the start of one flip (the do-nothing row's, third round) for six segments, as the Mac's takes show for seconds at a time.
  // The rounds at its two edges have a calm plain segment on one side and a slow one on the other: they are marked, the median round still reads true, the noise does not move.
  const [from, to] = STRETCH, Tw = take(ROUNDS, shuffled, slowed), W = readSweeps(Tw.D)[0];
  const e0 = edge(from)!, e1 = edge(to)!, marks = W.rows.flatMap(p => p.disturbed.map((d, k) => d ? p.id + ':' + k : '').filter(Boolean));
  const pc = W.rows.find(x => x.id === 'c')!, calm = S.noise.union!;
  check(W.disturbed === 2 && marks.length === 2 && marks.includes(e0.id + ':' + e0.k) && marks.includes(e1.id + ':' + e1.k), `a slow stretch over ${to - from} segments: the two rounds at its edges are marked (${marks.join(', ')}), no other`);
  check(Math.abs(pc.union!.mean) > 0.1 && Math.abs(pc.median) < 0.06, `does nothing: the slow round drags its mean to ${pc.union!.mean.toFixed(2)} ms, its median round stays ${pc.median.toFixed(2)}`);
  const pe = W.rows.find(x => x.id === 'e')!; check(!pe.inNoise && pe.median < 2 * W.noise.rmsUnion! / Math.sqrt(ROUNDS), `saves 0.15 ms: still a real difference (median round ${pe.median.toFixed(2)} ms); against the plain rms it would be lost under ±${(2 * W.noise.rmsUnion! / Math.sqrt(ROUNDS)).toFixed(2)}`);
  for (const r of ROWS) if (r.save) { const p = W.rows.find(x => x.id === r.id)!; check(Math.abs(p.median - r.save) < 0.12 && !p.inNoise, `${r.label}: median round ${p.median.toFixed(2)} ms through the slow stretch (mean ${p.union!.mean.toFixed(2)}), a real difference`); }
  check(W.noise.union! < calm * 2.5 && W.noise.rmsUnion! > W.noise.union! * 3 && W.noise.gap < 1 && /ran slow/.test(sweepText(Tw.D).join('\n')), `the noise is read off the median there: ±${W.noise.union!.toFixed(3)} ms (calm take ±${calm.toFixed(3)}) where the plain rms goes to ±${W.noise.rmsUnion!.toFixed(3)}, and the report says so`);
  const txt = sweepText(Tw.D).join('\n'), md = sweepMarkdown(Tw.D).join('\n');
  check(txt.includes('★') && /slow stretch/.test(txt) && md.includes('★') && /Median round/.test(md) && !sweepText(D).join('\n').includes('★'), 'both tables mark those rounds with ★ and say what the mark means; the calm take has none');
}
{ // THE VERDICT IS A TWO-SIGMA CALL, so it is held over twenty takes, not one: a row that does nothing must come out '≈ 0' in nearly all of them (one in twenty is the
  // rule's own error rate; a threshold a fifth too tight would lose five or more), a row that saves 0.15 ms must come out real in all — calm, and with a slow stretch in.
  const tally = (slow: boolean) => { let zero = 0, small = 0, marked = 0, robust = 0; for (let sd = 1; sd <= 20; sd++) {
    const X = readSweeps(take(ROUNDS, shuffled, slow ? slowed : undefined, sd).D)[0];
    if (X.rows.find(r => r.id === 'c')!.inNoise) zero++; if (!X.rows.find(r => r.id === 'e')!.inNoise) small++; if (X.disturbed >= 2) marked++; if (X.noise.union !== X.noise.rmsUnion) robust++; } return { zero, small, marked, robust }; };
  const calm = tally(false), slowT = tally(true);
  check(calm.zero >= 17 && calm.small === 20 && calm.robust === 0, `twenty calm takes: does nothing read ≈ 0 in ${calm.zero}, saves 0.15 ms read real in ${calm.small}, the noise the plain rms in all`);
  check(slowT.zero >= 16 && slowT.small === 20 && slowT.marked === 20 && slowT.robust === 20, `the same twenty with the slow stretch in: ≈ 0 in ${slowT.zero}, the small saving real in ${slowT.small}, both edge rounds marked in ${slowT.marked}, the noise off the median in ${slowT.robust}`);
}
{ // a short take in the order sweeps took before the shuffle (in order, reversed, in order): read as ever
  const O = readSweeps(take(3, round => round % 2 ? [...ROWS].reverse() : ROWS).D)[0];
  check(O.rows.length === ROWS.length && ROWS.every(r => Math.abs(O.rows.find(x => x.id === r.id)!.union!.mean - r.save) < 0.08) && O.rows.every(p => p.rounds === 3), 'a three-round take in the old order (reversed every other round) reads as before');
  check(O.noise.union === O.noise.rmsUnion && O.disturbed === 0, `its noise is the plain rms (±${O.noise.union!.toFixed(3)} over ${O.noise.n} plain segments), as that report had it`);
}
// a take cut short (F8 pressed again, or the tab closed): what was measured is still read
const cut: Dump = { frames: frames.slice(0, events[events.length - 8].frame + 20), events: events.slice(0, -8) }; const RC = readSweeps(cut);
check(RC.length === 1 && !RC[0].done && RC[0].rows.length === ROWS.length && RC[0].rows.every(r => r.rounds >= 2), `a sweep cut short still prices its finished rounds (${RC[0]?.rows.map(r => r.rounds).join(', ')} rounds a row)`);
check(sweepText(D).length > 6 && sweepMarkdown(D).some(l => l.startsWith('| saves 1.5 ms |')), 'the text and the markdown tables print');
check(readSweeps({ frames: frames.slice(0, 50), events: [] }).length === 0 && sweepText({ frames: frames.slice(0, 50), events: [] }).length === 0, 'a plain take has no sweep section');
{ // WHAT THE SMOKE COUNT COUNTS: clouds on a take from the box solver, the brick pool in 512s after it. The report reads which off the file, and says so only where it speaks
  const begun = (edit: (b: { smoke: number; rows: { id: string; label: string }[] }) => void): Dump => ({ frames, events: events.map(e => { if (!/"op":"begin"/.test(e.text)) return e; const b = JSON.parse(e.text); edit(b); return { ...e, text: JSON.stringify(b) }; }) });
  const bare = begun(b => { b.smoke = 3; }), line = (d: Dump) => sweepText(d)[2], mdLine = (d: Dump) => sweepMarkdown(d)[0], kind = (d: Dump) => smokeUnit(d).kind;
  const BOX = { smokeRenderSkip: true, restir: true }, POOL = { restir: true };   // (the settings a take starts with: the box solver's own row is in them only while it was in the build)
  const boxed: Dump = { ...bare, settingsAtStart: BOX }, pooled: Dump = { ...bare, settingsAtStart: POOL }, stamped: Dump = { ...bare, settingsAtStart: POOL, smokeUnit: 512 };
  const flagged: Dump = { ...bare, settingsAtStart: BOX, query: '?roomclear&sparsesmoke=2048' }, other: Dump = { ...bare, smokeUnit: 256 };
  const worded = begun(b => { b.smoke = 3; b.rows.push({ id: 'smoke', label: 'dust and smoke not drawn (1536 bricks of it here)' }); }), oldRow = begun(b => { b.smoke = 3; b.rows.push({ id: 'smoke', label: 'dust and smoke not drawn (3 clouds here)' }); });
  const POOLED = /· dust \/ smoke live: 3 \(the brick pool in 512s, rounded, 1 at the least\) ·/;
  check(kind(boxed) === 'clouds' && /· 3 dust \/ smoke clouds live ·/.test(line(boxed)) && /3 dust \/ smoke clouds live/.test(mdLine(boxed)) && !/bricks|brick pool/.test(line(boxed)), 'a take that started with the box solver\'s settings reads in clouds, as it always did (both tables)');
  check(kind(pooled) === 'bricks' && POOLED.test(line(pooled)) && !/cloud/.test(line(pooled)), 'a take whose settings have no box solver row reads as the brick pool, with no stamp');
  check(kind(stamped) === 'bricks' && POOLED.test(line(stamped)) && /brick pool in 512s/.test(mdLine(stamped)), 'a take the recorder stamped reads as the brick pool (both tables)');
  check(kind(flagged) === 'bricks' && POOLED.test(line(flagged)), 'a take from a build with both solvers, the pool asked for on the URL: the brick pool, whatever its settings say');
  check(kind(other) === 'bricks' && /the brick pool in 256s/.test(line(other)), 'the stamp is printed as stamped (256 bricks to a count reads as 256s)');
  check(kind(worded) === 'bricks' && POOLED.test(line(worded)) && kind(oldRow) === 'clouds' && /· 3 dust \/ smoke clouds live ·/.test(line(oldRow)), 'a file with no settings: its sweep\'s dust row says which (bricks, clouds)');
  check(kind(bare) === 'either' && /dust \/ smoke live: 3 \(clouds on a take from the box solver, the brick pool in 512s on a take after it\)/.test(line(bare)), 'a file that says nothing: a count, with both readings named');
  check(/no dust \/ smoke live/.test(line(D)) && !/cloud|bricks/.test(line(D)), 'nothing live: said plainly, no unit');
  const smoky = (more: Partial<Dump>): Dump => ({ frames: frames.slice(0, 80).map((f, i) => ({ ...f, n: { smoke: i < 40 ? 0 : 2 } })), events: [], ...more });
  const a = smokeText(smoky({ settingsAtStart: BOX })), b = smokeText(smoky({ settingsAtStart: POOL, smokeUnit: 512 })), c = smokeText(smoky({}));
  check(a.length === 4 && /^GPU TIME BY LIVE DUST \/ SMOKE CLOUDS \(/.test(a[1]) && /: clouds \| frames/.test(a[1]) && !/brick/.test(a[1]), 'the smoke table of a box solver take: by clouds, worded as before');
  check(b.length === 4 && /^GPU TIME BY LIVE DUST \/ SMOKE \(/.test(b[1]) && /count = the brick pool in 512s, rounded, 1 at the least\): pool ÷ 512 \| frames/.test(b[1]) && !/cloud/i.test(b.join('\n')) && b.slice(2).join() === a.slice(2).join(), 'the same table on a pool take: by pool ÷ 512, the numbers the same');
  check(c.length === 4 && /count = clouds on a take from the box solver/.test(c[1]) && /: count \| frames/.test(c[1]), 'and on a file that says nothing: a count column, both readings named');
}
{ // a SLOW row: its flip takes two seconds to show and two to go (a population of particles filling and thinning). Its segments say so (settleMs) and the report cuts by it
  const mk = (own: boolean): Dump => {
    const frames: Frame[] = [], events: Ev[] = []; let t = 0;
    const ev = (o: unknown) => events.push({ t, frame: frames.length, kind: 'sweep', text: JSON.stringify(o) });
    const run = (ms: number, union: (since: number) => number) => { const t0 = t; while (t - t0 < ms) { const u = union(t - t0), dt = u + 2.8; t += dt; frames.push({ t, dt, fps: 1000 / dt, cpu: { update: 1, render: 1, other: 0.2 }, gpu: { particles: u - 11.6 }, gpuSum: u, gpuUnion: u, res: [1284, 770], eff: 0.44, preset: 'high', adaptive: true, cam: [0, 0, 0, 0, 40], n: { smoke: 0 } } as Frame); } };
    run(500, () => 12);
    ev({ op: 'begin', mode: 'live', rounds: 3, settleMs: 100, measureMs: 1000, settleFrames: 2, measureFrames: 10, preset: 'high', res: [1284, 770], scale: 0.77, smoke: 0, timers: true, rows: [{ id: 'slow', label: 'the slow row', from: {}, to: {} }], skipped: [] });
    let i = 0; const seg = (round: number, flip: boolean, slow: boolean) => {
      ev({ op: 'seg', i: i++, of: 7, round, id: flip ? 'slow' : 'base', state: flip ? 'flip' : 'base', ...(own && slow ? { settleMs: 2000 } : {}) });
      run(slow ? 3000 : 1100, since => flip ? 12 + 2 * Math.min(1, since / 2000) : slow ? 14 - 2 * Math.min(1, since / 2000) : 12); };   // (the cost ramps in over two seconds, and out again)
    seg(0, false, false); for (let r = 0; r < 3; r++) { seg(r, true, true); seg(r, false, true); }
    ev({ op: 'end', done: true, why: 'done' }); run(300, () => 12);
    return { frames, events };
  };
  const cut = readSweeps(mk(true))[0].rows[0], plain = readSweeps(mk(false))[0].rows[0];
  check(!!cut.union && Math.abs(Math.abs(cut.union.mean) - 2) < 0.05, `a slow row read by its own settle: the whole 2 ms (${cut.union?.mean.toFixed(2)})`);
  check(!!plain.union && Math.abs(plain.union.mean) < 1.2, `the same frames cut by the take's 100 ms would have read a part of it (${plain.union?.mean.toFixed(2)}): the segment's own settle is what the report goes by`);
}
if (process.argv.includes('--print')) console.log(sweepText(D).join('\n'), '\n\n' + sweepMarkdown(D).join('\n'));
console.log(red ? `=== perf-sweep-selftest: ${red} FAILED ===` : '=== perf-sweep-selftest: ALL PASS ===');
process.exit(red ? 1 : 0);
