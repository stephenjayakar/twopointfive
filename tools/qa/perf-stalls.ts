// STALLS IN A TAKE (src/ui/perfrec.ts): the frames that took several times the frames around them, and for each what the file can say about where the time went.
// A frame's `dt` runs from the start of the frame before to its own start: it holds THAT frame's step (the row before's cpu) and then the gap between the two. From
// 10-25 a take made on the page carries, for the gap, each frame's `beat` (the longest the page's own thread went without answering a 4 ms timer in it), 'long'
// events (the long frames and tasks the browser itself reported, with the script it blames) and 'tab' events (out of sight, back). So a stall reads as one of:
//   in the frame  — the step before it, or the GPU's work, is most of it
//   thread held   — the gap is most of it and the thread did not answer through it (a timer, a collection, another script)
//   thread free   — the gap is most of it and the thread answered all the way: the browser handed the page no frame (its compositor, the GPU's queue, the page
//                   around an embedded one)
//   tab hidden    — the tab was out of sight in it: not a stall, and not counted as one
//   unknown       — a take with no beat (headless, or older)
// Used by tools/qa/perf-report.ts; checked by tools/qa/perfrec-check.ts
import type { PerfFrame, PerfEvent } from '../../src/ui/perfrec';
export type StallTake = { frames: PerfFrame[]; events: PerfEvent[] };
export interface Stall { i: number; t: number; dt: number; gpu: number; cpu: number; beat: number | null; verdict: 'in the frame' | 'thread held' | 'thread free' | 'unknown'; long: string[]; /** what else the take says happened in the stall's own stretch: a checkpoint written, the ladder's step, a resize */ beside: string[] }
export interface StallRead { usual: number; stalls: Stall[]; bursts: number; every: number; /** long lines of the browser's that fall in no stall */ loose: number; held: number; free: number; inFrame: number; unknown: number; hidden: number; hasBeat: boolean; /** the slowest ten seconds of the take and the take's usual frame, both in frames a second (null on a take under twenty seconds) */ slow: { fps: number; at: number; all: number } | null }
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(0.5 * (s.length - 1))]; };
const QUIET = new Set(['long', 'longcap', 'tab', 'start', 'stop', 'sweep', 'bench', 'settings']), SHORT: Record<string, RegExp> = { held: / with the thread held outside the frame/ };
const WINDOW = 40, TIMES = 2, FLOOR_MS = 35, BURST_MS = 400, HELD = 0.3;
/** a stall = a frame over 2 × the usual frame on BOTH sides of it (the median of the forty before and of the forty after) and over 35 ms: a slower stretch (a
 *  heavier preset, a row of a sweep, a page its browser holds at 30) is that stretch's usual frame, not a run of stalls */
export function readStalls(D: StallTake): StallRead {
  const F = D.frames, dts = F.map(f => f.dt), usual = median(dts);
  const long = D.events.filter(e => e.kind === 'long').map(e => ({ e, used: false })), tab = D.events.filter(e => e.kind === 'tab'), hasBeat = F.some(f => typeof f.beat === 'number');
  const stalls: Stall[] = [], out = new Set<number>(); let hidden = 0; const cpuOf = (f?: PerfFrame) => f ? f.cpu.update + f.cpu.render + f.cpu.other : 0;
  F.forEach((f, i) => {
    if (f.dt <= FLOOR_MS) return;
    const around = Math.max(median(dts.slice(Math.max(0, i - WINDOW), i)), median(dts.slice(i + 1, i + 1 + WINDOW)));
    if (!(f.dt > TIMES * (around || usual))) return;
    const to = f.t - cpuOf(f), from = to - f.dt;   // (t is stamped as the frame's step ENDS: the frame began its own cpu earlier, and its dt runs up to that beginning)
    // out of sight: the take's own word for it (a take with a beat watched the tab too); an older take has no such word, and there five seconds are a menu or a sleeping machine
    if (tab.some(e => e.t >= from - 50 && e.t <= to + 50) || (!hasBeat && f.dt > 5000)) { hidden++; out.add(i); return; }
    out.add(i);
    // the GPU's time for a frame is read back a few frames after it was drawn, so the frame's own GPU time stands on one of the rows after it: the most of the rows near
    const cpu = cpuOf(F[i - 1]), gpu = Math.max(...F.slice(Math.max(0, i - 1), i + 5).map(x => x.gpuUnion ?? x.gpuSum ?? 0)), beat = typeof f.beat === 'number' ? f.beat : null;
    const verdict = cpu > 0.5 * f.dt || gpu > 0.8 * f.dt ? 'in the frame' : beat === null ? 'unknown' : beat > HELD * (f.dt - cpu) ? 'thread held' : 'thread free';   // (the beat is the longest ONE silence: a gap eaten by two holds shows under half of it, and a free thread answers every 4 ms or so)
    const mine = long.filter(l => !l.used && l.e.t >= from - 20 && l.e.t <= to); for (const l of mine) l.used = true;   // (each line of the browser's beside one stall only: the first it falls in)
    const beside = D.events.filter(e => !QUIET.has(e.kind) && e.t >= from - 20 && e.t <= to + 5).slice(0, 3).map(e => `${e.kind}: ${e.text.replace(SHORT[e.kind] ?? /$^/, '').slice(0, 90)}`);
    stalls.push({ i, t: f.t, dt: f.dt, gpu, cpu, beat, verdict, long: mine.map(l => l.e.text), beside });
  });
  // bursts: stalls under 400 ms apart are one burst (the page catching up between them); how often = the median wait from one burst's start to the next
  const starts: number[] = []; let last = -1e9; for (const s of stalls) { if (s.t - last > BURST_MS) starts.push(s.t); last = s.t; }
  const every = starts.length > 1 ? median(starts.slice(1).map((t, k) => t - starts[k])) / 1000 : 0, n = (v: Stall['verdict']) => stalls.filter(s => s.verdict === v).length;
  // a page can run with no stall at all and still read as stutter: a stretch where the frame is just too long for the display's beat, so some frames are shown
  // longer than their neighbours. The take does not record what the display showed; it does show the stretch: the slowest ten seconds against the whole take.
  let slow: StallRead['slow'] = null;
  if (F.length > 60 && F[F.length - 1].t - F[0].t >= 20000) { let j = 0, sum = 0, worst = 0, at = 0;
    const d = (k: number) => out.has(k) ? 0 : F[k].dt; let cnt = 0;   // (a stall or a frame out of sight is no part of a stretch's usual pace)
    for (let i = 0; i < F.length; i++) { sum += d(i); if (!out.has(i)) cnt++; while (F[i].t - F[j].t > 10000) { sum -= d(j); if (!out.has(j)) cnt--; j++; } if (F[i].t - F[0].t >= 10000 && cnt >= 30 && sum / cnt > worst) { worst = sum / cnt; at = F[j].t / 1000; } }
    if (worst) slow = { fps: 1000 / worst, at, all: 1000 / usual }; }
  return { usual, stalls, bursts: starts.length, every, loose: long.filter(l => !l.used).length, held: n('thread held'), free: n('thread free'), inFrame: n('in the frame'), unknown: n('unknown'), hidden, hasBeat, slow };
}
export function stallLines(D: StallTake, list = 12): string[] {
  if (!D.frames.length) return [];
  const R = readStalls(D), L: string[] = [], N = R.stalls.length;
  L.push(`\nSTALLS (frames over ${TIMES} × the frames around them and over ${FLOOR_MS} ms; the usual frame of the take is ${R.usual.toFixed(1)} ms): ${N}${N ? ` in ${R.bursts} burst${R.bursts === 1 ? '' : 's'}${R.every ? `, a burst about every ${R.every.toFixed(R.every < 10 ? 1 : 0)} s` : ''}` : ''}${R.hidden ? ` (and ${R.hidden} long frame${R.hidden === 1 ? '' : 's'} with the tab out of sight, not counted)` : ''}`);
  if (R.slow && R.slow.fps < 0.85 * R.slow.all) L.push(`  the slowest ten seconds (from ${R.slow.at.toFixed(0)} s) ran at ${R.slow.fps.toFixed(1)} frames a second where the take's usual frame is ${R.slow.all.toFixed(1)}: a slow stretch, which can read as stutter with no stall in it`);
  const holds = D.events.filter(e => e.kind === 'held');
  if (holds.length) { const by = new Map<string, { n: number; ms: number }>();
    for (const e of holds) { const who = /page's (\w+) handlers/.exec(e.text)?.[1] ?? (/hid their end/.test(e.text) ? 'an input whose handlers hid their end' : 'no input handler'), ms = parseFloat(e.text) || 0, o = by.get(who) ?? { n: 0, ms: 0 }; o.n++; o.ms = Math.max(o.ms, ms); by.set(who, o); }
    L.push(`  holds of the thread outside the frame, 20 ms or more: ${holds.length} · ${[...by].sort((a, b) => b[1].n - a[1].n).map(([who, o]) => `${/^(no|an) /.test(who) ? who : `${who} handlers`} ${o.n} (longest ${o.ms.toFixed(0)} ms)`).join(' · ')}`); }
  const tail = () => { if (R.loose) L.push(`  (${R.loose}${N ? ' more' : ''} long frames or tasks the browser reported fall in no stall: the take's file has them, kind 'long')`); return L; };
  if (!N) return tail();
  L.push(`  where the time went: ${R.inFrame} in the frame (the step before it, or the GPU) · ${R.held} with the page's thread held between frames · ${R.free} with the thread free (the browser handed over no frame) · ${R.unknown} unreadable`);
  if (!R.hasBeat) L.push('  (this take has no beat: it was recorded headless or before the recorder kept one, so a stall between frames cannot be told apart here)');
  for (const s of R.stalls.slice(0, list)) L.push(`  ${(s.t / 1000).toFixed(1).padStart(6)} s #${String(s.i).padEnd(5)} ${s.dt.toFixed(0).padStart(4)} ms | step before ${s.cpu.toFixed(1)} GPU ${s.gpu.toFixed(1)} beat ${s.beat === null ? '—' : s.beat.toFixed(0)} | ${s.verdict}${s.beside.length ? ` | beside it: ${s.beside.join(' · ')}` : ''}${s.long.length ? ` | ${s.long.join(' · ').slice(0, 220)}` : ''}`);
  if (N > list) L.push(`  … ${N - list} more`);
  return tail();
}
