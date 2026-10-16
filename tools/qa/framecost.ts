// FRAME COST, MISSION BY MISSION — where a frame's CPU time goes on this build, every mission on the Missions card played headless by the scripted player
// (tools/qa/playthrough.ts; the solo night under tools/qa/soak.ts's stimuli) with tools/qa/framecost-hooks.ts preloaded: Game.update split by system, the harness's
// own step parts (camera, lights, the box list's pack + trace grid), the cross-cutting services (animation, paths, sound, line tests) in their own rows.
// NOTHING OF THE GAME IS EDITED: the split is made as the two files load (see the hooks' head); `--verify` re-plays every play-through run without the hooks and
// compares PT_DIGEST.
//
//   bun run tools/qa/framecost.ts                               every mission, the build as the page ships it, seeds 1-3 → the tables
//   bun run tools/qa/framecost.ts --json before.json            … and the numbers to a file;  later:
//   bun run tools/qa/framecost.ts --compare before.json after.json     the before / after table (per mission: frame mean, p99, every group's mean)
//     --scn block-four,solo-night     which missions (ids of scene/scenarioList.ts SCENARIOS, and `solo-night`)
//     --seeds 1-3                     which seeds (a run a seed a mission; the frames of a mission's seeds are pooled)
//     --arms shipped,everything       which builds of the switches (ARMS below); default `shipped`
//     --jobs 1                        runs at once. KEEP IT 1 FOR NUMBERS YOU QUOTE: on this 4-core box --jobs 4 read the mean ~50 % high and p99 ~2.5× (the runtime's
//                                     helper threads fight for the cores); two takes at --jobs 1 on a quiet box agreed to ~1.5 % on the mean and ~4 % on p99
//     --v8                            the same play under node (V8, the page's JavaScript engine) through tools/qa/framecost-v8.mjs: the frame's ms and the GARBAGE COLLECTOR's
//                                     pauses (count, mean, max, which slow frames held one). No split by system there; --verify then checks V8 against bun's digest
//     --hot                           with --v8: V8's sampling CPU profiler over the play → who burns the time, by function (self time)
//     --alloc                         with --v8: V8's sampling heap profiler over the play → who allocates the garbage, by function (its frames read slower: not for timings)
//     --gpu                           stand the REAL engine on a recording device (tools/qa/framecost-gpu.ts): the frame then holds the engine's own CPU half (uniforms, light /
//                                     decal / particle uploads, pass encoding, the smoke solver's update) and every mission gets a GPU INVENTORY (passes, dispatched threads,
//                                     bytes rewritten a frame, textures alive) — counts, not GPU milliseconds: there is no graphics card behind it. --view 1728x1000@2 --quality high
//     --cap 300                       a play-through's time cap, seconds;  --minutes 2  the solo night's length
//     --deep 0                        no service wraps (the cheapest clock; the services' time then stays in the system that called them)
//     --verify                        every play-through run played again WITHOUT the hooks: digests must agree (exit 1 if one does not)
//     --prof <dir>                    bun's sampling profiler on every run (`--cpu-prof-md`): one .md a run in <dir>, the hot FUNCTIONS by name and file
//     --md                            the tables as Markdown
//   exit 0 = every run left its frames · 1 = a run left none / a digest differs under --verify · 2 = unknown flag / mission / arm (nothing run)
//
// WHAT A 'FRAME' IS UNDER --gpu: Game.update → the smoke solver's update → camera → lights → Engine.render's CPU half (the box list packed, the light / decal / particle
// uploads, ~25 passes encoded) — the page's frame minus audio and the HUD's DOM. The game on the real engine takes the page's paths (GPU particles for the CPU spark boxes,
// decals, the smoke solver), so a seed plays out as ANOTHER run than on the stub: use the plain mode for before / after takes that must hold a digest, --gpu for the page's cost.
// WHAT A 'FRAME' IS WITHOUT IT: the harness's W.step — Game.update, the follow camera, the light set's ageing, and the box list packed + the trace grid rebuilt
// (BoxWorld.upload's CPU half; its GPU writes go to a fake device). The play-through uploads every 4th frame and the page EVERY frame (engine.ts render), so the
// tables give the frame AT THE PAGE'S CADENCE: each frame's own cost with one upload in it (a frame that did not upload is given the run's mean upload).
// NOT in it, because the harness has none: the renderer's own CPU side (uniforms, the light / character / decal / particle uploads, encoding ~50 passes), the
// smoke solver's CPU half, audio, the HUD. Under bun this is JavaScriptCore; the page runs V8 — the split's SHAPE carries over, the milliseconds are this box's.
// The first WARM frames of every run are left out of the percentiles (the JIT warming up and the first paths), and reported apart as `warm max`.
//
// ARMS (what is switched; each is the harness's own switches, nothing new). After the run the tool prints, per arm, WHICH STAND its runs stood on, as each run's own
// harness reported it (src/host/profile.ts harnessProfile()), and exits 1 if that is not the stand the arm asked for.
//   harness      the QA harness's FROZEN stand as it stands: the mannequin, the motion pass and the turn weight off, the glass parts off, no defenders' frags (chaos
//                0.5 as the play-through always sets) — what every frozen digest was recorded on
//   shipped      THE SHIPPED STAND (TPS_PROFILE=shipped, src/host/profile.ts): the harness stood up as the page opens with no URL flag on a machine that has kept
//                nothing — none of the frozen stand's pins runs and the page's own boot switches are written (FROZEN_HOLDS there lists every row the two stands
//                differ in: the cast, the motion pass, the turn weight, the glass, defenders' frags, destruction, cut pieces, kicked rubble, door paths, the wall
//                rules, the close-in mode, the squads' radio check …). What the page plays, as far as a headless run can
//   shipped5     ROUND ONE'S ARM, kept so its tables can be taken again: the FROZEN stand with five words raised — the cast (TPS_CAST), the motion pass
//                (TPS_MOVES), the turn weight (TPS_TURN), the glass (GLASSFX=on), destruction (PT_DESTR=1) — and defenders' frags. It was this tool's `shipped`
//                before the shipped stand existed, and the stored tables of round one (rebuild/performance/measured.md, game-step.md in the project files) were
//                taken on it. It is NOT what the page plays any more (every later rule that ships on is off in it): its numbers do not compare with `shipped`'s
//   nodestr      shipped, but destruction off (the page under ?nodestruction)
//   nocast · nomoves · noglass · nofrags     shipped with that one thing put back off (shipped minus this = what it costs), each by the pin's own word
//   downpour     shipped + ?weather=downpour          dusk   shipped + ?hour=dusk
//   cap          shipped + extra enemies up to eleven defenders (PT_EXTRA; a mission that already stages eleven is as shipped)
//   everything   shipped + downpour + dusk + the cap
//   pair         two person stealth (tools/qa/pair-sneak.ts's `pair` arm, PAIR=1) on the shipped stand — the missions it knows: records-pair, room-clear-pair.
//                KNOWN: pair-sneak's script was written on round one's words; on the shipped stand its records-pair hits the time cap on seeds 1 and 2 and loses Sam on
//                seed 3 (room-clear-pair plays through). A run that hit the cap is named after the arms' lines: its frames are a pair standing still, in the means
//   pair5        … on round one's five words over the frozen stand (what `pair` was before the shipped stand; no defenders' frags, as then)
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '../..');
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const WARM = 60, SOLO = 'solo-night', CAP_DEFENDERS = 11;

interface Arm { env: Record<string, string>; set: Record<string, Record<string, unknown>>; extraToCap?: boolean; runner?: 'pair'; words: string }
// the shipped stand's one word; the frozen stand NAMED (a TPS_PROFILE in this tool's own environment must not turn another arm into the shipped one)
const SHIPPED_ENV = { TPS_PROFILE: 'shipped' }, FROZEN_ENV = { TPS_PROFILE: 'frozen' }, SHIPPED_SET = {};
// round one's five words over the frozen stand (arm `shipped5`, the head comment): what `shipped` was when rebuild/performance/measured.md and game-step.md were taken
const SHIPPED5_ENV = { ...FROZEN_ENV, TPS_CAST: '1', TPS_MOVES: '1', TPS_TURN: '1', GLASSFX: 'on', PT_DESTR: '1' }, SHIPPED5_SET = { FRAG: { defenders: true } };
const ARMS: Record<string, Arm> = {
  harness: { env: FROZEN_ENV, set: {}, words: 'the QA harness\'s frozen stand as it stands (mannequin, motion pass off, glass parts off, no defenders\' frags)' },
  shipped: { env: SHIPPED_ENV, set: SHIPPED_SET, words: 'the shipped stand (TPS_PROFILE=shipped): the harness stood up as the page opens with no URL flag' },
  shipped5: { env: SHIPPED5_ENV, set: SHIPPED5_SET, words: 'round one\'s arm: the frozen stand + cast, motion pass, turn weight, glass, destruction, defenders\' frags (NOT what the page plays now)' },
  downpour: { env: SHIPPED_ENV, set: { ...SHIPPED_SET, WEATHER: { kind: 'downpour' } }, words: 'shipped + a downpour' },
  dusk: { env: { ...SHIPPED_ENV, PT_HOUR: 'dusk' }, set: SHIPPED_SET, words: 'shipped + dusk' },
  cap: { env: SHIPPED_ENV, set: SHIPPED_SET, extraToCap: true, words: `shipped + extra enemies up to ${CAP_DEFENDERS} defenders` },
  everything: { env: { ...SHIPPED_ENV, PT_HOUR: 'dusk' }, set: { ...SHIPPED_SET, WEATHER: { kind: 'downpour' } }, extraToCap: true, words: `shipped + a downpour + dusk + ${CAP_DEFENDERS} defenders` },
  // shipped with ONE thing put back off (shipped minus this = what it costs): the pin's own word, which holds under the shipped stand too (profile.ts pinned())
  nocast: { env: { ...SHIPPED_ENV, TPS_CAST: '' }, set: SHIPPED_SET, words: 'shipped, but the mannequin instead of the cast' },
  nomoves: { env: { ...SHIPPED_ENV, TPS_MOVES: '0', TPS_TURN: '0' }, set: SHIPPED_SET, words: 'shipped, but the motion pass and the turn weight off' },
  noglass: { env: { ...SHIPPED_ENV, GLASSFX: 'off' }, set: SHIPPED_SET, words: 'shipped, but the glass switch off (the page under ?glassfx=0)' },
  nofrags: { env: SHIPPED_ENV, set: { FRAG: { defenders: false } }, words: 'shipped, but no defenders\' frags' },
  nodestr: { env: { ...SHIPPED_ENV, PT_DESTR: '0', SOAK_DESTR: '0' }, set: SHIPPED_SET, words: 'shipped, but destruction off (the page under ?nodestruction)' },
  pair: { env: { ...SHIPPED_ENV, PAIR: '1' }, set: {}, runner: 'pair', words: 'two person stealth (pair-sneak.ts arm `pair`, PAIR=1) on the shipped stand' },
  pair5: { env: { ...SHIPPED5_ENV, PAIR: '1' }, set: {}, runner: 'pair', words: 'two person stealth on round one\'s arm: the frozen stand + cast, motion pass, turn weight, glass, destruction (NOT what the page plays now)' },
};
/** the stand an arm's runs must report (profile.ts harnessProfile(), filed by framecost-hooks.ts as each run's game is stood up) */
const standOf = (arm: string): string => ARMS[arm].env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen';

/** the columns of the split: a group = the buckets (framecost-hooks.ts names) whose name passes its test, first group that takes a bucket keeps it */
const HEADLESS_ONLY = (n: string) => n.startsWith('headless only:');   // (run headless, not on the page: kept apart, in no frame total — framecost-hooks.ts X_STANDIN)
const GROUPS: [string, (n: string) => boolean][] = [
  ['(probe stand-in)', HEADLESS_ONLY],
  ['animation', n => n.startsWith('svc: animation')],
  ['line tests', n => n.startsWith('svc: static line') || n.startsWith('svc: box world raycast')],
  ['nav paths', n => n.startsWith('svc: nav')],
  ['sound', n => n.startsWith('svc: sound')],
  ['guards AI', n => /^(guards:|needs|escalation|civilians|suppression)/.test(n)],
  ['room fight', n => n.startsWith('room fight')],
  ['squad', n => n.startsWith('squad:') || n.startsWith('scenario')],
  ['tactics', n => n.startsWith('tactics')],
  ['player', n => n.startsWith('player')],
  ['feet vs walls', n => n.startsWith('svc: circle collide')],
  ['doors, props', n => /^(doors|props)/.test(n)],
  ['destruction', n => n.startsWith('destruction')],
  ['glass', n => n.startsWith('glass')],
  ['gear', n => /^(gear|items|tracers)/.test(n)],
  ['weather', n => n.startsWith('weather')],
  ['pair', n => n.startsWith('pair')],
  ['fog of war', n => n.startsWith('fog of war')],
  ['chars to GPU', n => n.startsWith('characters')],
  ['dyn boxes', n => /^(dynamic boxes|smoke pushes)/.test(n)],
  ['box upload', n => n.startsWith('step: box list')],
  ['smoke CPU', n => n.startsWith('step: smoke')],
  ['render CPU', n => n.startsWith('render:')],
  ['other', () => true],
];

interface Stats { mean: number; p50: number; p95: number; p99: number; max: number }
const r3 = (x: number) => +x.toFixed(3);
function stats(a: Float64Array | number[]): Stats {
  const s = Float64Array.from(a).sort(), n = s.length; if (!n) return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const at = (q: number) => s[Math.min(n - 1, Math.floor(q * n))]; let sum = 0; for (const x of s) sum += x;
  return { mean: r3(sum / n), p50: r3(at(0.5)), p95: r3(at(0.95)), p99: r3(at(0.99)), max: r3(s[n - 1]) };
}

interface RunFrames { /** the harness stand the run's game stood on, as the run filed it (framecost-hooks.ts; none under --v8 or on a build from before the stands) */ stand?: string; names: string[]; nb: number; n: number; M: Float32Array; upload: number; firstStep: number; firstSvc: number; calls: number[]; callsOuter: number[]; lineBy: number[]; missing: string[]; deep: boolean; runtime: string; gpu?: any; v8?: { frame: Float32Array; update: Float32Array; standin: Float32Array; start: Float64Array; flags: number[]; newSpaceBytes: number; trace: GcLine[]; hot?: { total: number; rows: { fn: string; where: string; us: number; callers: [string, number][] }[] }; alloc?: { total: number; rows: { fn: string; where: string; bytes: number; callers: [string, number][] }[] } } }
/** one line of V8's --trace-gc: ms since the isolate began · the collection · MB in use before → after · the pause, ms */
interface GcLine { at: number; kind: string; before: number; after: number; pause: number }
const parseGcTrace = (text: string): GcLine[] => [...text.matchAll(/^\[\d+:0x[0-9a-f]+\]\s+(\d+) ms: ([A-Za-z-]+(?: \(reduce\))?) ([\d.]+) \([\d.]+\) -> ([\d.]+) \([\d.]+\) MB,(?: pooled: [\d.]+ MB,)? ([\d.]+) \/ [\d.]+ ms/gm)].map(m => ({ at: +m[1], kind: m[2], before: +m[3], after: +m[4], pause: +m[5] }));
function loadFrames(file: string): RunFrames | null {
  try { const f = JSON.parse(readFileSync(file, 'utf8'));
    if (f.v8) { const dec = (s: string) => { const b = Buffer.from(s, 'base64'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
      return { names: [], nb: 0, n: f.frames, M: new Float32Array(0), upload: 0, firstStep: 0, firstSvc: 0, calls: [], callsOuter: [], lineBy: [], missing: [], deep: false, runtime: f.runtime, v8: { frame: new Float32Array(dec(f.frame)), update: new Float32Array(dec(f.update)), standin: new Float32Array(dec(f.standin ?? '')), start: new Float64Array(dec(f.start)), flags: f.flags ?? [], newSpaceBytes: f.newSpaceBytes ?? 0, trace: [], alloc: f.alloc, hot: f.hot } }; }
    const buf = Buffer.from(f.ms, 'base64'); const M = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return { stand: f.stand, names: f.names, nb: f.names.length, n: f.frames, M, upload: f.upload, firstStep: f.firstStep, firstSvc: f.firstSvc, calls: f.calls, callsOuter: f.callsOuter, lineBy: f.lineBy ?? [], missing: f.missing ?? [], deep: f.deep, runtime: f.runtime, gpu: f.gpu }; }
  catch { return null; }
}

export interface MissionOut {
  id: string; arm: string; runs: { seed: number; end: string; t: number; frames: number; digest?: string; verified?: boolean; note?: string }[];
  frames: number; extra: number;
  /** the frame at the page's cadence (an upload in every frame) · Game.update alone · the frame as the harness stepped it */
  page: Stats; update: Stats; stepped: Stats; uploadPerCall: number; warmMax: number;
  buckets: Record<string, Stats>; groups: Record<string, Stats>;
  /** services: calls a frame (all · outermost) */
  calls: Record<string, [number, number]>;
  /** the static line tests' time by the system that asked, ms a frame */
  lineBy: Record<string, number>;
  /** the three worst frames (after the warm-up): ms at the page's cadence, the run, the game's clock, the three biggest buckets */
  worst: { ms: number; seed: number; t: number; top: [string, number][] }[];
  missing: string[];
  /** --gpu: what the frames asked of a GPU, per frame (means over the mission's runs, weighted by frames) — COUNTS, no GPU time */
  gpu?: GpuOut;
  /** --v8: the run on node (V8): the frame as the harness stepped it (no page-cadence upload fix-up), and the collector */
  v8?: { seconds: number; gc: Record<string, { n: number; perMin: number; mean: number; max: number; total: number }>; gcShare: number; framesOver: Record<string, number>; framesOverWithGc: Record<string, number>; allocMBps: number; allocKBperFrame: number; outsideFrames: number; standInMs: number; alloc?: { fn: string; where: string; kb: number; share: number; callers: string }[]; hot?: { fn: string; where: string; ms: number; share: number; callers: string }[]; worst: { ms: number; seed: number; gc: number }[] };
}
function poolV8(id: string, arm: string, extra: number, runs: { seed: number; end: string; t: number; digest?: string; verified?: boolean; note?: string; fr: RunFrames | null }[]): MissionOut {
  const ok = runs.filter(r => r.fr?.v8 && r.fr.n > WARM);
  const out: MissionOut = { id, arm, extra, runs: runs.map(({ fr, ...r }) => ({ ...r, frames: fr?.n ?? 0 })), frames: 0, page: stats([]), update: stats([]), stepped: stats([]), uploadPerCall: 0, warmMax: 0, buckets: {}, groups: {}, calls: {}, lineBy: {}, worst: [], missing: [] };
  if (!ok.length) return out;
  const fr: number[] = [], up: number[] = [], gcIn: number[] = [], seedOf: number[] = []; let secs = 0, gcMs = 0, allocMB = 0, unmatched = 0, standIn = 0; const gc: Record<string, number[]> = {};
  for (const r of ok) { const v = r.fr!.v8!, n = v.frame.length; if (n <= WARM) continue; secs += (n - WARM) / 60;
    for (let i = 0; i < WARM; i++) if (v.frame[i] > out.warmMax) out.warmMax = r3(v.frame[i]);
    const base = fr.length; for (let i = WARM; i < n; i++) { fr.push(v.frame[i]); up.push(v.update[i]); gcIn.push(0); seedOf.push(r.seed); standIn += v.standin[i] ?? 0; }
    // THE COLLECTIONS OF THE PLAY: V8's own lines (--trace-gc) from the first frame on. Its clock starts a little after the process's (performance.now's): the offset is found as the one
    // that puts the most scavenges inside the frames (and gaps) the heap readings flagged — then each line is charged to the frame it falls in
    const sc = v.trace.filter(l => l.kind === 'Scavenge'), flagged = new Set<number>(); v.flags.forEach((f, i) => { if (f & 3) flagged.add(i); });
    const frameAt = (t: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (v.start[m] <= t) lo = m; else hi = m - 1; } return lo; };
    let best = 0, bestHits = -1; for (let d = -20; d <= 200; d += 0.5) { let h = 0; for (const l of sc) { const t = l.at + d; if (t < v.start[0] || t > v.start[n - 1] + v.frame[n - 1]) continue; const k = frameAt(t); if (flagged.has(k) || flagged.has(k + 1)) h++; } if (h > bestHits) { bestHits = h; best = d; } }
    let prevAfter = -1;
    for (const l of v.trace) { const t = l.at + best; if (prevAfter >= 0 && l.before > prevAfter && t >= v.start[WARM]) allocMB += l.before - prevAfter; prevAfter = l.after;
      if (t < v.start[WARM] || t > v.start[n - 1] + v.frame[n - 1] + 1) continue;
      const kind = l.kind === 'Scavenge' ? 'minor' : 'major'; (gc[kind] ??= []).push(l.pause); gcMs += l.pause;
      // the line's time is the collection's END to the whole ms: it belongs to the frame that holds (end − pause … end) — inside it if the frame is at least as long as the pause
      const k = frameAt(t - l.pause / 2), wall = v.frame[k] + (v.standin[k] ?? 0); if (wall >= l.pause * 0.8 && t - l.pause / 2 <= v.start[k] + wall + 1) gcIn[base + k - WARM] += l.pause; else unmatched++; } }
  const al = ok.map(r => r.fr!.v8!.alloc).filter(Boolean) as NonNullable<NonNullable<RunFrames['v8']>['alloc']>[]; let allocRows: NonNullable<MissionOut['v8']>['alloc'];
  if (al.length) { const by = new Map<string, { bytes: number; callers: Map<string, number> }>(); let tot = 0, frames = 0; ok.forEach(r => { if (r.fr!.v8!.alloc) frames += r.fr!.n; });
    for (const a of al) { tot += a.total; for (const x of a.rows) { const k = `${x.fn}\t${x.where}`, e = by.get(k) ?? { bytes: 0, callers: new Map() }; e.bytes += x.bytes; for (const [c, v] of x.callers) e.callers.set(c, (e.callers.get(c) ?? 0) + v); by.set(k, e); } }
    allocRows = [...by.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 40).map(([k, e]) => { const [fn, where] = k.split('\t'); return { fn, where: where.replace(ROOT + '/', ''), kb: +(e.bytes / 1024 / Math.max(1, frames)).toFixed(1), share: +(e.bytes / Math.max(1, tot)).toFixed(4), callers: [...e.callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c} ${Math.round(100 * v / e.bytes)}%`).join(', ') }; }); }
  const hs = ok.filter(r => r.fr!.v8!.hot); let hotRows: NonNullable<MissionOut['v8']>['hot'];
  if (hs.length) { const by = new Map<string, { us: number; callers: Map<string, number> }>(); let tot = 0, frames = 0;
    for (const r of hs) { const h = r.fr!.v8!.hot!; tot += h.total; frames += r.fr!.n; for (const x of h.rows) { const k = `${x.fn}\t${x.where}`, e = by.get(k) ?? { us: 0, callers: new Map() }; e.us += x.us; for (const [c, v] of x.callers) e.callers.set(c, (e.callers.get(c) ?? 0) + v); by.set(k, e); } }
    hotRows = [...by.entries()].sort((a, b) => b[1].us - a[1].us).slice(0, 60).map(([k, e]) => { const [fn, where] = k.split('\t'); return { fn, where: where.replace(ROOT + '/', ''), ms: +(e.us / 1000 / Math.max(1, frames)).toFixed(4), share: +(e.us / Math.max(1, tot)).toFixed(4), callers: [...e.callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c} ${Math.round(100 * v / e.us)}%`).join(', ') }; }); }
  out.frames = fr.length; out.page = stats(fr); out.stepped = out.page; out.update = stats(up);
  const over = (ms: number) => fr.filter(x => x > ms).length, overGc = (ms: number) => fr.filter((x, i) => x > ms && gcIn[i] > 0.5).length;
  const tot = fr.reduce((a, b) => a + b, 0);
  out.v8 = { seconds: +secs.toFixed(1), gc: Object.fromEntries(Object.entries(gc).map(([k, a]) => [k, { n: a.length, perMin: +(a.length / secs * 60).toFixed(1), mean: r3(a.reduce((x, y) => x + y, 0) / a.length), max: r3(Math.max(...a)), total: r3(a.reduce((x, y) => x + y, 0)) }])),
    gcShare: +(gcMs / Math.max(1e-9, tot)).toFixed(4), framesOver: { '4': over(4), '8': over(8), '16.6': over(16.6) }, framesOverWithGc: { '4': overGc(4), '8': overGc(8), '16.6': overGc(16.6) }, allocMBps: +(allocMB / Math.max(1e-9, secs)).toFixed(1), allocKBperFrame: Math.round(allocMB * 1024 / Math.max(1, fr.length)), outsideFrames: unmatched, standInMs: r3(standIn / Math.max(1, fr.length)), alloc: allocRows, hot: hotRows,
    worst: Array.from(fr.keys()).sort((a, b) => fr[b] - fr[a]).slice(0, 3).map(i => ({ ms: r3(fr[i]), seed: seedOf[i], gc: r3(gcIn[i]) })) };
  return out;
}
export interface GpuOut {
  view: any; frames: number; chars: any; perFrame: Record<string, number>; perFrameMax: Record<string, number>; scene: Record<string, number>; sceneMax: Record<string, number>;
  passes: Record<string, { kind: string; perFrame: number; threads: number; threadsMax: number; texels: number; tris: number; draws: number }>;
  kernels: Record<string, { perFrame: number; threads: number }>;
  writes: Record<string, { bytes: number; calls: number; max: number }>;
  textures: { liveBytes: number; peakBytes: number; count: number; top: { label: string; bytes: number; desc: string }[] }; buffers: { liveBytes: number; peakBytes: number };
  cpu: { renderMs: number; smokeMs: number }; notes: string[];
}
function poolGpu(rs: any[]): GpuOut | undefined {
  rs = rs.filter(Boolean); if (!rs.length) return undefined;
  const F = rs.reduce((a, r) => a + r.frames, 0) || 1, wsum = (get: (r: any) => number | undefined) => rs.reduce((a, r) => a + (get(r) ?? 0) * r.frames, 0) / F;
  const keys = (get: (r: any) => Record<string, number>) => [...new Set(rs.flatMap(r => Object.keys(get(r) ?? {})))];
  const rec = (get: (r: any) => Record<string, number>) => Object.fromEntries(keys(get).map(k => [k, wsum(r => get(r)?.[k])]));
  const recMax = (get: (r: any) => Record<string, number>) => Object.fromEntries(keys(get).map(k => [k, Math.max(...rs.map(r => get(r)?.[k] ?? 0))]));
  const byLabel = <T>(list: (r: any) => any[], make: (label: string, of: (f: (x: any) => number) => number, any: any, mx: (f: (x: any) => number) => number) => T): Record<string, T> => {
    const labels = [...new Set(rs.flatMap(r => list(r).map((x: any) => x.label)))];
    return Object.fromEntries(labels.map(l => { const pick = (r: any) => list(r).find((x: any) => x.label === l); return [l, make(l, f => wsum(r => { const x = pick(r); return x ? f(x) : 0; }), rs.map(pick).find(Boolean), f => Math.max(...rs.map(r => { const x = pick(r); return x ? f(x) : 0; })))]; }));
  };
  const big = rs.reduce((a, r) => r.textures.peakBytes > a.textures.peakBytes ? r : a, rs[0]);
  return { view: rs[0].view, frames: F, chars: rs[0].chars, perFrame: rec(r => r.perFrame), perFrameMax: recMax(r => r.perFrameMax), scene: rec(r => r.scene), sceneMax: recMax(r => r.sceneMax),
    passes: byLabel(r => r.passes, (_l, of, x, mx) => ({ kind: x.kind, perFrame: of(p => p.perFrame), threads: of(p => p.threads), threadsMax: mx(p => p.threadsMax), texels: of(p => p.texels), tris: of(p => p.tris), draws: of(p => p.draws) })),
    kernels: byLabel(r => r.kernels, (_l, of) => ({ perFrame: of(k => k.perFrame), threads: of(k => k.threads) })),
    writes: byLabel(r => r.writes, (_l, of, _x, mx) => ({ bytes: of(w => w.bytes), calls: of(w => w.calls), max: mx(w => w.max) })),
    textures: big.textures, buffers: big.buffers, cpu: { renderMs: wsum(r => r.cpu.renderMs), smokeMs: wsum(r => r.cpu.smokeMs) },
    notes: [...new Set(rs.flatMap(r => [...(r.latePipes ?? []).map((k: string) => `pipeline '${k}' was first asked for during the play and never landed (the loop does not yield): its pass is missing or on its fallback here`), ...(r.unknownFormats ?? []).map((f: string) => `texture format ${f} sized as 4 B a texel`), ...(r.noWorkgroupSize ?? []).map((k: string) => `no @workgroup_size read for ${k}: its threads count workgroups`)]))] };
}

function pool(id: string, arm: string, extra: number, runs: { seed: number; end: string; t: number; digest?: string; verified?: boolean; note?: string; fr: RunFrames | null }[]): MissionOut {
  const ok = runs.filter(r => r.fr && r.fr.n > WARM);
  for (const r of ok.slice(1)) { const a = ok[0].fr!, f = r.fr!; if (f.names.join('\n') !== a.names.join('\n')) {   // (a run taken under another hooks file: its columns re-laid by name onto the first run's)
    const M = new Float32Array(f.n * (a.nb + 1)), at = a.names.map(n => f.names.indexOf(n)); for (let i = 0; i < f.n; i++) { for (let b = 0; b < a.nb; b++) if (at[b] >= 0) M[i * (a.nb + 1) + b] = f.M[i * (f.nb + 1) + at[b]]; M[i * (a.nb + 1) + a.nb] = f.M[i * (f.nb + 1) + f.nb]; }
    const re = (v: number[]) => at.map(k => k >= 0 ? v[k] ?? 0 : 0);
    r.fr = { ...f, names: a.names, nb: a.nb, M, calls: re(f.calls), callsOuter: re(f.callsOuter), lineBy: re(f.lineBy), upload: a.upload, firstStep: a.firstStep, firstSvc: a.firstSvc }; } }
  const names = ok[0]?.fr!.names ?? [], nb = names.length;
  const out: MissionOut = { id, arm, extra, runs: runs.map(({ fr, ...r }) => ({ ...r, frames: fr?.n ?? 0 })), frames: 0, page: stats([]), update: stats([]), stepped: stats([]), uploadPerCall: 0, warmMax: 0, buckets: {}, groups: {}, calls: {}, lineBy: {}, worst: [], missing: [...new Set(runs.flatMap(r => r.fr?.missing ?? []))] };
  if (!ok.length) return out;
  const N = ok.reduce((a, r) => a + r.fr!.n - WARM, 0); out.frames = N;
  const U = ok[0].fr!.upload, firstStep = ok[0].fr!.firstStep, firstSvc = ok[0].fr!.firstSvc;
  let upSum = 0, upN = 0; for (const r of ok) { const f = r.fr!; for (let i = 0; i < f.n; i++) { const u = f.M[i * (nb + 1) + U]; if (u > 0) { upSum += u; upN++; } } }
  const upMean = upN ? upSum / upN : 0; out.uploadPerCall = r3(upMean);
  const cols = Array.from({ length: nb }, () => new Float64Array(N)), page = new Float64Array(N), update = new Float64Array(N), stepped = new Float64Array(N);
  const excl = names.map(HEADLESS_ONLY);
  const gi = names.map(n => GROUPS.findIndex(([, t]) => t(n))), gcols = GROUPS.map(() => new Float64Array(N));
  const where: [number, number][] = []; let k = 0;
  for (const r of ok) { const f = r.fr!;
    for (let i = 0; i < f.n; i++) { const o = i * (nb + 1); let tot = 0, upd = 0; for (let b = 0; b < nb; b++) { if (excl[b]) continue; const v = f.M[o + b]; tot += v; if (b < firstStep || b >= firstSvc) upd += v; }
      const u = f.M[o + U], pg = tot - u + (u > 0 ? u : upMean);
      if (i < WARM) { if (pg > out.warmMax) out.warmMax = r3(pg); continue; }
      for (let b = 0; b < nb; b++) { const v = b === U ? (u > 0 ? u : upMean) : f.M[o + b]; cols[b][k] = v; gcols[gi[b]][k] += v; }
      page[k] = pg; update[k] = upd; stepped[k] = tot; where.push([r.seed, f.M[o + nb]]); k++; }
    for (let b = 0; b < nb; b++) { if (f.calls[b]) { const c = out.calls[names[b]] ??= [0, 0]; c[0] += f.calls[b]; c[1] += f.callsOuter[b]; } if (f.lineBy[b]) out.lineBy[names[b]] = (out.lineBy[names[b]] ?? 0) + f.lineBy[b]; } }
  const allFrames = ok.reduce((a, r) => a + r.fr!.n, 0);
  for (const c of Object.values(out.calls)) { c[0] = +(c[0] / allFrames).toFixed(1); c[1] = +(c[1] / allFrames).toFixed(1); }
  for (const n of Object.keys(out.lineBy)) out.lineBy[n] = r3(out.lineBy[n] / allFrames);
  out.page = stats(page); out.update = stats(update); out.stepped = stats(stepped);
  names.forEach((n, b) => { out.buckets[n] = stats(cols[b]); }); GROUPS.forEach(([n], g) => { out.groups[n] = stats(gcols[g]); });
  const idx = Array.from(page.keys()).sort((a, b) => page[b] - page[a]).slice(0, 3);
  out.gpu = poolGpu(ok.map(r => r.fr!.gpu));
  out.worst = idx.map(i => ({ ms: r3(page[i]), seed: where[i][0], t: +where[i][1].toFixed(2), top: names.map((n, b) => [n, excl[b] ? 0 : r3(cols[b][i])] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 3) }));
  return out;
}

// ───────────────────────────────────────────────────────────── the tables ──────────────────────────────────────────
function table(head: string[], rows: (string | number)[][], md: boolean): string {
  if (md) return [`| ${head.join(' | ')} |`, `|${head.map((_, i) => i ? '--:' : '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  return [head, ...rows].map(r => r.map((c, i) => i ? String(c).padStart(w[i]) : String(c).padEnd(w[i])).join('  ')).join('\n');
}
const f2 = (x: number) => x.toFixed(2);
export function report(ms: MissionOut[], md = false): string {
  const L: string[] = [], H = (s: string) => { L.push(''); L.push(md ? `### ${s}` : `── ${s}`); L.push(''); };
  const name = (m: MissionOut) => `${m.id}${m.arm === 'shipped' ? '' : ` [${m.arm}]`}`;
  if (ms.length && ms.every(m => m.v8)) {
    H('the frame under V8, ms (as the harness steps it: Game.update + camera + lights, the box list every 4th frame in a play-through; the light probe\'s CPU stand-in taken out) — the page\'s JavaScript engine, this box');
    L.push(table(['mission', 'runs', 'frames', 'mean', 'p50', 'p95', 'p99', 'max', 'warm max', 'update mean', 'update p99', 'frames > 4 ms', '> 8 ms', '> 16.6 ms', '(probe stand-in, left out)'], ms.map(m => [name(m), m.runs.length, m.frames, f2(m.page.mean), f2(m.page.p50), f2(m.page.p95), f2(m.page.p99), f2(m.page.max), f2(m.warmMax), f2(m.update.mean), f2(m.update.p99), m.v8!.framesOver['4'], m.v8!.framesOver['8'], m.v8!.framesOver['16.6'], f2(m.v8!.standInMs)]), md));
    H('V8\'s garbage collector over the play (its own --trace-gc lines): N a minute of game time × mean / max pause ms · what the heap grew by between collections = allocated');
    const g = (m: MissionOut, k: string) => { const x = m.v8!.gc[k]; return x ? `${x.perMin} × ${f2(x.mean)} / ${f2(x.max)}` : '0'; };
    L.push(table(['mission', 'scavenges', 'mark-compacts', 'GC share of frame time', 'frames > 4 ms with a GC', '> 8 ms with a GC', 'KB allocated a frame', 'MB a game second', 'worst frame (its GC ms)', 'pauses outside frames'], ms.map(m => [name(m), g(m, 'minor'), g(m, 'major'), `${(100 * m.v8!.gcShare).toFixed(1)}%`, `${m.v8!.framesOverWithGc['4']} of ${m.v8!.framesOver['4']}`, `${m.v8!.framesOverWithGc['8']} of ${m.v8!.framesOver['8']}`, m.v8!.allocKBperFrame, m.v8!.allocMBps, m.v8!.worst.slice(0, 1).map(w => `${f2(w.ms)} (${f2(w.gc)})`).join(''), m.v8!.outsideFrames]), md));
    for (const m of ms) if (m.v8!.hot) { H(`who burns the time · ${name(m)} (V8's sampling CPU profiler, 200 µs, SELF time from the first frame on — the scripted player's own code is in it; lines are of the transpiled file: near, not exact)`);
      L.push(table(['function', 'file', 'ms a frame', 'share', 'called from'], m.v8!.hot.slice(0, 30).map(a => [a.fn, a.where, a.ms.toFixed(3), `${(100 * a.share).toFixed(1)}%`, a.callers]), md)); }
    for (const m of ms) if (m.v8!.alloc) { H(`who allocates · ${name(m)} (V8's sampling heap profiler, collected objects counted; a line is where the FUNCTION starts in the transpiled file — near, not exact)`);
      L.push(table(['function', 'file', 'KB a frame', 'share', 'called from'], m.v8!.alloc.slice(0, 25).map(a => [a.fn, a.where, a.kb, `${(100 * a.share).toFixed(1)}%`, a.callers]), md)); }
    const bad = ms.flatMap(m => m.runs.filter(r => !r.frames).map(r => `${name(m)}:${r.seed} left no frames${r.note ? ` — ${r.note}` : ''}`)); if (bad.length) { H('RUNS THAT LEFT NOTHING'); for (const x of bad) L.push(`  ${x}`); }
    return L.join('\n');
  }
  H(ms.some(m => m.gpu) ? 'the frame, ms (Game.update + smoke update + camera + lights + Engine.render\'s CPU half; no audio, no HUD) · bun, this box' : 'the frame, ms (page cadence: Game.update + camera + lights + one box upload) · bun, this box');
  L.push(table(['mission', 'runs', 'frames', 'mean', 'p50', 'p95', 'p99', 'max', 'warm max', 'update mean', 'update p99', 'upload'], ms.map(m => [name(m), m.runs.length, m.frames, f2(m.page.mean), f2(m.page.p50), f2(m.page.p95), f2(m.page.p99), f2(m.page.max), f2(m.warmMax), f2(m.update.mean), f2(m.update.p99), f2(m.uploadPerCall)]), md));
  H('the split, mean ms a frame (a service\'s time is out of the system that called it; \'(probe stand-in)\' runs headless only and is in NO frame total: on the page the GPU answers)');
  const gs = GROUPS.map(g => g[0]).filter(g => ms.some(m => (m.groups[g]?.mean ?? 0) >= 0.005));
  L.push(table(['mission', ...gs], ms.map(m => [name(m), ...gs.map(g => f2(m.groups[g]?.mean ?? 0))]), md));
  H('the split at its worst, p99 ms of each group (not additive: each group\'s own bad frames)');
  L.push(table(['mission', ...gs], ms.map(m => [name(m), ...gs.map(g => f2(m.groups[g]?.p99 ?? 0))]), md));
  { H('the heaviest buckets, all missions pooled by frames (mean ms a frame · share of the frame · worst mission\'s mean and p99)');
    const tot = ms.reduce((a, m) => a + m.frames, 0), names = [...new Set(ms.flatMap(m => Object.keys(m.buckets)))].filter(n => !HEADLESS_ONLY(n));
    const rows = names.map(n => { const mean = ms.reduce((a, m) => a + (m.buckets[n]?.mean ?? 0) * m.frames, 0) / Math.max(1, tot); const w = ms.reduce((a, m) => (m.buckets[n]?.mean ?? 0) > (a.buckets[n]?.mean ?? 0) ? m : a, ms[0]); return { n, mean, w }; }).sort((a, b) => b.mean - a.mean);
    const all = rows.reduce((a, r) => a + r.mean, 0);
    L.push(table(['bucket', 'mean', 'share', 'worst in', 'its mean', 'its p99'], rows.slice(0, 16).map(r => [r.n, r.mean.toFixed(3), `${(100 * r.mean / all).toFixed(1)}%`, name(r.w), f2(r.w.buckets[r.n]?.mean ?? 0), f2(r.w.buckets[r.n]?.p99 ?? 0)]), md)); }
  { H('services: calls a frame (all / outermost)');
    const names = [...new Set(ms.flatMap(m => Object.keys(m.calls)))];
    L.push(table(['mission', ...names.map(n => n.replace(/^svc: /, '').replace(/ \(.*$/, ''))], ms.map(m => [name(m), ...names.map(n => m.calls[n] ? `${m.calls[n][0]} / ${m.calls[n][1]}` : '0')]), md)); }
  { const names = [...new Set(ms.flatMap(m => Object.keys(m.lineBy)))].sort((a, b) => ms.reduce((s, m) => s + (m.lineBy[b] ?? 0), 0) - ms.reduce((s, m) => s + (m.lineBy[a] ?? 0), 0)).slice(0, 8);
    if (names.length) { H('static line tests by the system that asked, mean ms a frame'); L.push(table(['mission', ...names.map(n => n.replace(/ \(.*$/, ''))], ms.map(m => [name(m), ...names.map(n => f2(m.lineBy[n] ?? 0))]), md)); } }
  H('the worst frame of each mission (after the first second)');
  for (const m of ms) for (const w of m.worst.slice(0, 1)) L.push(`${md ? '- ' : '  '}${name(m)}: ${f2(w.ms)} ms, seed ${w.seed} at ${w.t} s — ${w.top.map(([n, v]) => `${n.replace(/ \(.*$/, '')} ${f2(v)}`).join(' · ')}`);
  const gm = ms.filter(m => m.gpu);
  if (gm.length) {
    const M = (x: number) => (x / 1e6).toFixed(2), K = (x: number) => (x / 1e3).toFixed(1), n1 = (x: number | undefined) => x === undefined || !isFinite(x) ? '–' : x.toFixed(x < 10 ? 1 : 0), mm = (g: GpuOut, k: string) => `${n1(g.scene[k])} / ${n1(g.sceneMax[k])}`;
    const v = gm[0].gpu!.view; H(`WHAT A FRAME ASKS OF A GPU — counted on a recording device, NO GPU HERE: none of this is GPU time · window ${v.cssW}×${v.cssH} CSS px at ×${v.dpr} (an assumption), preset ${v.quality}`);
    L.push(table(['mission', 'internal', 'output', 'compute passes', 'render passes', 'dispatches', 'threads M', 'raster texels M', 'triangles k', 'rewritten KB (calls)', 'objects made', 'textures MB'], gm.map(m => { const g = m.gpu!, p = g.perFrame;
      return [name(m), `${Math.round(g.scene.internalW)}×${Math.round(g.scene.internalH)}`, `${Math.round(g.scene.outW)}×${Math.round(g.scene.outH)}`, n1(p.computePasses), n1(p.renderPasses), n1(p.dispatches), M(p.threads ?? 0), M(p.rasterTexels ?? 0), K(p.tris ?? 0), `${K(p.writeBytes ?? 0)} (${n1(p.writeCalls)})`, n1((p.bindGroupsCreated ?? 0) + (p.buffersCreated ?? 0) + (p.texturesCreated ?? 0)), (g.textures.peakBytes / 1048576).toFixed(0)]; }), md));
    H('the scene a frame draws, mean / max over the mission');
    L.push(table(['mission', 'lights live', 'characters', 'static boxes', 'dynamic boxes', 'particles', 'decals', 'smoke bricks', 'glass panes listed', 'panes hit', 'debris', 'character model'], gm.map(m => { const g = m.gpu!; return [name(m), mm(g, 'lights'), mm(g, 'characters'), n1(g.scene.boxesStatic), mm(g, 'boxesDynamic'), mm(g, 'particlesLive'), mm(g, 'decals'), mm(g, 'smokeBricks'), mm(g, 'glassPanes'), mm(g, 'glassPanesBroken'), mm(g, 'debris'), g.chars ? `${g.chars.model}: ${g.chars.triangles} tris, ${g.chars.vertices} verts, ${g.chars.joints} joints` : '–']; }), md));
    const F = gm.reduce((a, m) => a + m.gpu!.frames, 0);
    { H('passes, all missions pooled: runs a frame · compute threads a frame (M) and share · worst mission');
      const labels = [...new Set(gm.flatMap(m => Object.keys(m.gpu!.passes)))], tot = gm.reduce((a, m) => a + (m.gpu!.perFrame.threads ?? 0) * m.gpu!.frames, 0) / F;
      const rows = labels.map(l => { const of = (f: (p: any) => number) => gm.reduce((a, m) => a + (m.gpu!.passes[l] ? f(m.gpu!.passes[l]) : 0) * m.gpu!.frames, 0) / F; const w = gm.reduce((a, m) => (m.gpu!.passes[l]?.threads ?? 0) > (a.gpu!.passes[l]?.threads ?? 0) ? m : a, gm[0]);
        return { l, kind: gm.map(m => m.gpu!.passes[l]).find(Boolean)!.kind, per: of(p => p.perFrame), thr: of(p => p.threads), tex: of(p => p.texels), tris: of(p => p.tris), w }; }).sort((a, b) => (b.thr + b.tex) - (a.thr + a.tex));
      L.push(table(['pass', 'kind', 'a frame', 'threads M', 'share', 'raster texels M', 'triangles k', 'worst in', 'its threads M'], rows.slice(0, 40).map(r => [r.l, r.kind, r.per.toFixed(2), M(r.thr), r.kind === 'compute' ? `${(100 * r.thr / Math.max(1, tot)).toFixed(1)}%` : '', r.tex ? M(r.tex) : '', r.tris ? K(r.tris) : '', name(r.w), M(r.w.gpu!.passes[r.l]?.threads ?? 0)]), md)); }
    { H('buffers the CPU rewrites, all missions pooled: bytes a frame · calls a frame · the most in one frame');
      const labels = [...new Set(gm.flatMap(m => Object.keys(m.gpu!.writes)))];
      const rows = labels.map(l => ({ l, bytes: gm.reduce((a, m) => a + (m.gpu!.writes[l]?.bytes ?? 0) * m.gpu!.frames, 0) / F, calls: gm.reduce((a, m) => a + (m.gpu!.writes[l]?.calls ?? 0) * m.gpu!.frames, 0) / F, max: Math.max(...gm.map(m => m.gpu!.writes[l]?.max ?? 0)) })).sort((a, b) => b.bytes - a.bytes);
      L.push(table(['buffer', 'KB a frame', 'calls a frame', 'max KB in a frame'], rows.slice(0, 24).map(r => [r.l, K(r.bytes), r.calls.toFixed(2), K(r.max)]), md)); }
    const notes = [...new Set(gm.flatMap(m => m.gpu!.notes))]; if (notes.length) { H('inventory notes'); for (const x of notes.slice(0, 20)) L.push(`  ${x}`); }
  }
  const miss = [...new Set(ms.flatMap(m => m.missing))]; if (miss.length) { H('MARKS NOT FOUND (the split is coarser there: Game.update or the harness changed)'); for (const x of miss) L.push(`  ${x}`); }
  const bad = ms.flatMap(m => m.runs.filter(r => !r.frames).map(r => `${name(m)}:${r.seed} left no frames${r.note ? ` — ${r.note}` : ''}`)); if (bad.length) { H('RUNS THAT LEFT NOTHING'); for (const x of bad) L.push(`  ${x}`); }
  return L.join('\n');
}
export function compare(A: { missions: MissionOut[] }, B: { missions: MissionOut[] }, md = false): string {
  const key = (m: MissionOut) => `${m.id} [${m.arm}]`, bm = new Map(B.missions.map(m => [key(m), m])), rows: (string | number)[][] = [], d = (a: number, b: number) => `${f2(a)} → ${f2(b)} (${b - a >= 0 ? '+' : ''}${a > 1e-9 ? (100 * (b - a) / a).toFixed(0) : '∞'}%)`;
  const gs = GROUPS.map(g => g[0]);
  for (const a of A.missions) { const b = bm.get(key(a)); if (!b) continue; rows.push([key(a), d(a.page.mean, b.page.mean), d(a.page.p99, b.page.p99), d(a.update.mean, b.update.mean), ...gs.map(g => { const x = a.groups[g]?.mean ?? 0, y = b.groups[g]?.mean ?? 0; return Math.abs(y - x) < 0.01 ? '·' : `${y - x >= 0 ? '+' : ''}${f2(y - x)}`; })]); }
  return table(['mission', 'frame mean', 'frame p99', 'update mean', ...gs.map(g => `Δ ${g}`)], rows, md);
}

// ───────────────────────────────────────────────────────────── main ────────────────────────────────────────────────
if (import.meta.main) {
  const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const KNOWN = ['--scn', '--seeds', '--arms', '--jobs', '--cap', '--minutes', '--deep', '--verify', '--prof', '--json', '--md', '--compare', '--gpu', '--view', '--quality', '--v8', '--alloc', '--hot'];
  for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
  const md = argv.includes('--md');
  if (flag('--compare')) { const i = argv.indexOf('--compare'); const A = JSON.parse(readFileSync(argv[i + 1], 'utf8')), B = JSON.parse(readFileSync(argv[i + 2], 'utf8')); console.log(`${A.commit} → ${B.commit}\n`); console.log(compare(A, B, md)); process.exit(0); }
  const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
  const ALL = [SOLO, ...SCENARIOS.map((e: any) => e.id)];
  const ids = (flag('--scn') ?? ALL.join(',')).split(','), arms = (flag('--arms') ?? 'shipped').split(','), seeds = seedsOf(flag('--seeds') ?? '1-3');
  for (const id of ids) if (!ALL.includes(id)) { console.error(`no mission '${id}' — ${ALL.join(', ')}`); process.exit(2); }
  for (const a of arms) if (!ARMS[a]) { console.error(`no arm '${a}' — ${Object.keys(ARMS).join(', ')}`); process.exit(2); }
  const jobs = Math.max(1, Number(flag('--jobs') ?? 1)), cap = Number(flag('--cap') ?? 300), minutes = Number(flag('--minutes') ?? 2), deep = flag('--deep') !== '0', verify = argv.includes('--verify'), gpu = argv.includes('--gpu'), v8 = argv.includes('--v8');
  if (v8 && gpu) { console.error('--v8 and --gpu do not combine (the recording device is stood by the bun preload)'); process.exit(2); }
  const v8hooks = resolve(import.meta.dir, 'framecost-v8.mjs');
  const gpuEnv: Record<string, string> = gpu ? { FC_GPU: '1', ...(flag('--view') ? { FC_VIEW: flag('--view')! } : {}), ...(flag('--quality') ? { FC_QUALITY: flag('--quality')! } : {}) } : {};
  const prof = flag('--prof'); if (prof) mkdirSync(prof, { recursive: true });
  const hooks = resolve(import.meta.dir, 'framecost-hooks.ts'), tmp = resolve(tmpdir(), `framecost-${process.pid}`); mkdirSync(tmp, { recursive: true });
  const PAIR_SCN = ['records-pair', 'room-clear-pair'];
  interface Job { id: string; arm: string; seed: number; extra: number }
  const todo: Job[] = arms.flatMap(arm => ids.filter(id => (!ARMS[arm].runner || PAIR_SCN.includes(id)) && (id !== SOLO || arm === 'harness' || arm === 'shipped' || arm === 'shipped5' || arm === 'nodestr'))   /* (the soak takes no weather, hour or enemy count: the solo night is measured as shipped, with destruction off, and as the harness stands) */.flatMap(id => seeds.map(seed => {
    const E = SCENARIOS.find((e: any) => e.id === id); return { id, arm, seed, extra: ARMS[arm].extraToCap && E?.kind === 'roomclear' ? Math.max(0, CAP_DEFENDERS - (E.defenders ?? CAP_DEFENDERS)) : 0 }; })));
  const done = new Map<string, { seed: number; end: string; t: number; digest?: string; verified?: boolean; note?: string; fr: RunFrames | null }[]>(); let next = 0; const t0 = Date.now(); let failed = false;
  const run = async (j: Job, hooked: boolean, tag: string) => {
    const A = ARMS[j.arm], res = resolve(tmp, `${j.id}-${j.arm}-${j.seed}${tag}.json`), fc = resolve(tmp, `${j.id}-${j.arm}-${j.seed}${tag}.fc.json`);
    const pre = hooked ? ['--preload', hooks] : [], pf = hooked && prof ? ['--cpu-prof-md', '--cpu-prof-dir', resolve(prof), '--cpu-prof-name', `${j.id}-${j.arm}-${j.seed}.md`] : [];
    const tool = resolve(import.meta.dir, j.id === SOLO ? 'soak.ts' : A.runner === 'pair' ? 'pair-sneak.ts' : 'playthrough.ts');
    const args = j.id === SOLO ? ['--seeds', String(j.seed), '--minutes', String(minutes), '--quiet', '--chaos', '0.5'] : A.runner === 'pair' ? ['--one', `${j.id}:${j.seed}`, '--arm', 'pair', '--cap', String(cap), '--outfile', res] : ['--one', `${j.id}:${j.seed}`, '--out', res, '--cap', String(cap), '--set', JSON.stringify(A.set)];
    const cmd = v8 && hooked ? ['node', '--no-warnings', '--trace-gc', '--import', v8hooks, tool, ...args] : j.id === SOLO ? ['bun', ...pf, 'run', ...pre, resolve(import.meta.dir, 'soak.ts'), '--seeds', String(j.seed), '--minutes', String(minutes), '--quiet', '--chaos', '0.5']
      : A.runner === 'pair' ? ['bun', ...pf, 'run', ...pre, resolve(import.meta.dir, 'pair-sneak.ts'), '--one', `${j.id}:${j.seed}`, '--arm', 'pair', '--cap', String(cap), '--outfile', res]
      : ['bun', ...pf, 'run', ...pre, resolve(import.meta.dir, 'playthrough.ts'), '--one', `${j.id}:${j.seed}`, '--out', res, '--cap', String(cap), '--set', JSON.stringify(A.set)];
    const pr = Bun.spawn(cmd, { cwd: ROOT, stdout: v8 && hooked ? 'pipe' : 'ignore', stderr: 'pipe', env: { ...process.env, ...A.env, PT_DIGEST: '1', ...(j.extra ? { PT_EXTRA: String(j.extra) } : {}), ...(hooked ? { FC_OUT: fc, FC_DEEP: deep ? '1' : '0', ...gpuEnv, ...(gpu && (A.set as any).WEATHER ? { FC_WEATHER: '1' } : {}), ...(v8 ? { V8_ENTRY: tool, ...(argv.includes('--alloc') ? { FC_ALLOC: '1' } : {}), ...(argv.includes('--hot') ? { FC_HOT: '1' } : {}) } : {}) } : {}) } });
    const [errText, outText] = await Promise.all([new Response(pr.stderr).text(), v8 && hooked ? new Response(pr.stdout as ReadableStream).text() : Promise.resolve('')]); await pr.exited;
    let r: any = {}; try { r = JSON.parse(readFileSync(res, 'utf8')); rmSync(res); } catch { /* the soak leaves none */ }
    const fr = hooked ? loadFrames(fc) : null; if (hooked && existsSync(fc)) rmSync(fc);
    if (fr?.v8) fr.v8.trace = parseGcTrace(outText);
    return { r, fr, err: errText.trim().split('\n').slice(-2).join(' / ').slice(0, 300) };
  };
  const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
    const { r, fr, err } = await run(j, true, '');
    const row: { seed: number; end: string; t: number; digest?: string; verified?: boolean; note?: string; fr: RunFrames | null } = { seed: j.seed, end: r.end ?? (j.id === SOLO ? 'soak' : 'none'), t: r.t ?? (fr ? +(fr.n / 60).toFixed(1) : 0), digest: r.digest, fr, ...(r.note ? { note: r.note } : !fr ? { note: err } : r.end === 'error' ? { note: String(r.why).split('\n')[0] } : {}) };
    if (verify && !gpu && j.id !== SOLO && !ARMS[j.arm].runner) { const v = await run(j, false, '-v'); row.verified = !!r.digest && v.r.digest === r.digest; if (!row.verified) { if (!v8) failed = true; console.error(v8 ? `  ${j.id}:${j.seed} [${j.arm}] V8 played ANOTHER run than bun for this seed: ${r.digest} vs ${v.r.digest} (the same without this tool's rewrites — the two engines' Math differ in a last bit somewhere; not an error)` : `  ${j.id}:${j.seed} [${j.arm}] DIGEST DIFFERS under the hooks: ${r.digest} vs ${v.r.digest}`); } }
    if (!fr || fr.n <= WARM) failed = true;
    const k = `${j.arm}\n${j.id}`; if (!done.has(k)) done.set(k, []); done.get(k)!.push(row);
    console.error(`  ${j.id}:${j.seed} [${j.arm}] ${row.end} ${row.t} s · ${fr?.n ?? 0} frames${row.verified === undefined ? '' : row.verified ? (v8 ? ' · the same run as under bun (digest equal)' : ' · digest equal without the hooks') : v8 ? ' · another run than under bun' : ' · DIGEST DIFFERS'}${row.note ? ` — ${row.note}` : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  const missions: MissionOut[] = arms.flatMap(arm => ids.filter(id => done.has(`${arm}\n${id}`)).map(id => (v8 ? poolV8 : pool)(id, arm, todo.find(j => j.id === id && j.arm === arm)!.extra, done.get(`${arm}\n${id}`)!.sort((a, b) => a.seed - b.seed))));
  const git = (a: string[]) => { try { return new TextDecoder().decode(Bun.spawnSync(['git', ...a], { cwd: ROOT }).stdout).trim(); } catch { return ''; } };
  const commit = git(['rev-parse', '--short', 'HEAD']), dirty = git(['status', '--porcelain', '--', 'src', 'levels', 'public']).length > 0;
  const runtime = [...done.values()].flat().find(r => r.fr)?.fr?.runtime ?? `bun ${Bun.version}`;
  console.log(`frame cost · ${commit}${dirty ? ' (+ uncommitted changes under src/)' : ''} · ${runtime} · ${cpus().length} × ${cpus()[0]?.model ?? 'cpu'} · jobs ${jobs} · seeds ${seeds.join(',')} · service wraps ${deep ? 'on' : 'off'}${gpu ? ' · THE REAL ENGINE ON A RECORDING DEVICE (--gpu)' : ''} · first ${WARM} frames of a run left out`);
  // which stand every arm's runs stood on, as the runs themselves filed it — and red if that is not the stand the arm asked for (an arm must not be counted as another one)
  for (const a of arms) { const got = [...new Set([...done.entries()].filter(([k]) => k.startsWith(`${a}\n`)).flatMap(([, rows]) => rows.map(r => r.fr?.stand)).filter(Boolean))] as string[], want = standOf(a);
    if (got.some(s => s !== want)) failed = true;
    console.log(`  [${a}] ${ARMS[a].words}\n      stood on: ${got.length ? `the ${got.join(' AND the ')} stand, as its runs reported${got.some(s => s !== want) ? ` — NOT THE ${want.toUpperCase()} STAND THIS ARM ASKS FOR` : ''}` : `TPS_PROFILE=${want} in the runs' environment (no run reported its stand${v8 ? ': --v8 files none' : ''})`}`); }
  // a run that never ended (the time cap) or threw is still in the pools above the tables are made from: say which, so a mean of a team standing still is not read as the mission's
  { const odd = [...done.entries()].flatMap(([k, rows]) => rows.filter(r => r.end === 'stalled' || r.end === 'error' || r.end === 'none').map(r => `${k.split('\n')[1]}:${r.seed} [${k.split('\n')[0]}] ${r.end}`));
    if (odd.length) console.log(`  NOT PLAYED TO AN END (their frames are in the tables all the same): ${odd.join(' · ')}`); }
  console.log(report(missions, md));
  if (verify && gpu) console.log('\nverify: not made under --gpu — on the real engine the game finds GPU particles, decals and the smoke solver on its host and takes those paths (as the page does), so a run is ANOTHER run than the stub harness\'s and its digest another digest');
  else if (verify) { const v = [...done.values()].flat().filter(r => r.verified !== undefined); console.log(v8 ? `\nverify: ${v.filter(r => r.verified).length} of ${v.length} play-through runs were the same run under V8 as under bun (digest equal); the others are another play of the same mission, as valid a sample` : `\nverify: ${v.filter(r => r.verified).length} of ${v.length} play-through runs gave the same digest with the hooks and without`); }
  console.log(`\n${todo.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ tool: 'framecost', v: 1, commit, dirty, when: new Date().toISOString(), runtime, cpu: `${cpus().length} × ${cpus()[0]?.model ?? ''}`, jobs, seeds, cap, minutes, deep, gpu, warm: WARM, arms: Object.fromEntries(arms.map(a => [a, ARMS[a].words])), stands: Object.fromEntries(arms.map(a => [a, standOf(a)])), missions }, null, 1));
  try { rmSync(tmp, { recursive: true }); } catch { /* */ }
  process.exit(failed ? 1 : 0);
}
