// THE WALL-CHARGE FRAME — what the game step costs on the frame a wall charge goes off, and on the frames right after it. tools/qa/playthrough.ts's play()
// with the scripted commander taking held rooms by wall charge (PT_WALL=1 PT_DESTR=1, the arm the page plays), Game.update timed from OUTSIDE (no game code
// edited) and every WallCharge.blow marked with the frame it ran in. A run is deterministic frame for frame, so it is measured `--passes` times and a frame's
// cost is its MINIMUM over them (what a pass adds is a lost time slice, a collection, a function compiling).
//   bun run tools/qa/blast-frame.ts [--scn depot-four,block-four] [--seeds 1] [--passes 3] [--warm 1] [--after 8] [--split] [--json out.json] [--set '{…}']
//   --warm N    the run is played N times first and thrown away (default 1: the numbers are then the WORK's, not the JIT's first sight of the blast's code;
//               --warm 0 lists the cold run, as a fresh page pays its first charge)
//   --split     every method of the classes a blast runs through (WallCharge, Destruction, WallBreak, Furniture, Debris, GlassBreak, WallReact, NavGrid,
//               SoundPaths, StaticCollision, FogOfWar, Game.reachChanged …) wrapped: the blast frame's time by method, self and inclusive (the wrappers
//               cost a little: quote the frame from a run WITHOUT --split)
//   --gc        a full collection forced before each wall charge's trigger, outside the timing: without it a collection the blast's own garbage sets off can
//               land in the frame (`each pass` lists every pass's blast frame: a pass well over the others is one)
//   --only a,b  with --split: wrap only these methods (names as --split prints them) — their times are then near enough the unwrapped run's
//   --every     also list the frames of every Destruction.blast that was not a wall charge (frags, door charges)
//   exit 0 = every run ended · 1 = a run threw / a digest moved between passes · 2 = unknown flag or scenario
// The digest of every pass is printed: `PT_DIGEST` equal to the base's on the same arm is the proof the game is the same.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const KNOWN = ['--scn', '--seeds', '--passes', '--warm', '--after', '--split', '--json', '--set', '--cap', '--every', '--quiet', '--arm', '--callers', '--mark', '--gc', '--only'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const ROOT = resolve(import.meta.dir, '../..');
// THE ARM (set before the harness is imported; a value already in the environment wins):
//   --arm shipped (default)  TPS_PROFILE=shipped: the game as the PAGE opens it (src/host/profile.ts — destruction, cut pieces, kicked rubble, the cast …) + PT_WALL=1
//   --arm round1             the frozen stand with round one's words (rebuild/performance/build.md): GLASSFX=on TPS_MOVES=1 TPS_TURN=1 TPS_CAST=1 PT_DESTR=1 PT_WALL=1
const ARM = flag('--arm') ?? 'shipped'; if (ARM !== 'shipped' && ARM !== 'round1') { console.error(`--arm ${ARM}: shipped or round1`); process.exit(2); }
for (const [k, v] of Object.entries(ARM === 'shipped' ? { TPS_PROFILE: 'shipped', PT_WALL: '1', PT_DIGEST: '1' } : { TPS_CAST: '1', TPS_MOVES: '1', TPS_TURN: '1', GLASSFX: 'on', PT_DESTR: '1', PT_WALL: '1', PT_DIGEST: '1' })) process.env[k] ??= v;
// (playthrough.ts raises THE ONE SWITCH only when it is the program: a tool that imports play() raises it itself — no game import in that file)
if (ARM === 'round1') (await import(`${resolve(import.meta.dir, '../..')}/src/game/destructionSwitch.ts`)).DESTRUCTION.on = process.env.PT_DESTR === '1';
const WALL_SCNS = ['compound-four', 'room-clear-four', 'depot-four', 'warehouse-four', 'block-four', 'barracks-four'];
const SCNS = (flag('--scn') ?? WALL_SCNS.join(',')).split(','), PASSES = Math.max(1, Number(flag('--passes') ?? 3)), WARM = Number(flag('--warm') ?? 1), AFTER = Number(flag('--after') ?? 8), CAP = Number(flag('--cap') ?? 300);
const SEEDS = (s => { const m = /^(\d+)-(\d+)$/.exec(s); return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i) : s.split(',').map(Number); })(flag('--seeds') ?? '1');
const CALLERS = argv.includes('--callers'), SPLIT = argv.includes('--split') || CALLERS, EVERY = argv.includes('--every'), QUIET = argv.includes('--quiet');
{ const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`); const ids: string[] = SCENARIOS.map((e: any) => e.id); const no = SCNS.filter(s => !ids.includes(s) && !/^[\w-]+\.json$/.test(s)); if (no.length) { console.error(`no scenario ${no.join(', ')} — ${ids.join(', ')}`); process.exit(2); } }
const SET: Record<string, Record<string, unknown>> = { ...(ARM === 'round1' ? { FRAG: { defenders: true } } : {}), ...JSON.parse(flag('--set') ?? '{}') };

// ───────────────────────────────────────────────────────────── the wrappers ────────────────────────────────────────
let measuring = false, blowSplit = false, carry = 0, blowMs = new Map<number, number>();
let frame = -1, inUpdate = false, ms: number[] = [], marks: { f: number; kind: 'wall' | 'blast'; dyn0: number }[] = [], dyn: number[] = [];
const names: string[] = [], self: number[] = [], incl: number[] = [], calls: number[] = []; const stackT: number[] = [], stackChild: number[] = [], stackId: number[] = []; let splitOn = false;
let perFrame: Map<number, [string, number, number, number][]> = new Map(), wantFrames: Set<number> | null = null;
// --mark: for a sampling profile (`bun --cpu-prof --cpu-prof-interval=100 run tools/qa/blast-frame.ts --mark …`, then tools/qa/blast-frame-prof.ts over the file): a
// named function burns 0.4 ms before the trigger's call and after each of the frames that follow it, so the profile's samples can be cut into those frames
const MARK = argv.includes('--mark'); let markLeft = 0;
const ONLY = flag('--only') ? new Set(flag('--only')!.split(',')) : null;   // --split over these methods alone (col.nav.findPath,fight.roomAt …): a few wrappers cost nothing to speak of, so their milliseconds can be quoted
const GC = argv.includes('--gc');   // a full collection forced just before each trigger (untimed): the frame's WORK with as little of the collector's own time in it as can be arranged
let burnt = 0;   // (each marker holds its own loop: a tail call or an inlined helper would lose its name in the samples)
function __BLAST_MARK_BEGIN__() { const t = performance.now(); let x = 0; while (performance.now() - t < 0.4) x += Math.sqrt(x + 1); burnt += x; }
function __BLAST_MARK_FRAME__() { const t = performance.now(); let x = 1; while (performance.now() - t < 0.4) x += Math.sqrt(x + 2); burnt += x; }
const LEAVES = new Set(['findPath', 'raycast', 'isBlocked', 'segmentBlocked', 'walkable', 'roomAt', 'solidBlocked', 'shotBlocked', 'propagate', 'rebake']); const callers = new Map<string, number>();
function wrapProto(label: string, proto: any, skip: string[] = []) {
  if (!proto || proto.__blastFrame) return; Object.defineProperty(proto, '__blastFrame', { value: true });
  for (const k of Object.getOwnPropertyNames(proto)) { if (k === 'constructor' || skip.includes(k) || (ONLY && !ONLY.has(`${label}.${k}`))) continue; const d = Object.getOwnPropertyDescriptor(proto, k); if (!d || typeof d.value !== 'function') continue;
    const fn = d.value, id = names.push(`${label}.${k}`) - 1; self.push(0); incl.push(0); calls.push(0);
    const leaf = LEAVES.has(k);
    proto[k] = function (this: any) { if (!splitOn) return fn.apply(this, arguments);
      if (leaf && CALLERS) { const st = (new Error().stack ?? '').split('\n').slice(2).map(l => /at (\S+) \(.*?([\w.-]+)\.ts/.exec(l)).filter(Boolean).map(m => `${m![1]}@${m![2]}`).filter(x => !x.startsWith('<anonymous>@blast-frame') && !x.includes('@blast-frame')).slice(0, 4).join(' < '); const key = `${label}.${k} ← ${st}`; callers.set(key, (callers.get(key) ?? 0) + 1); }
      const t0 = performance.now(); stackT.push(t0); stackChild.push(0); stackId.push(id);
      try { return fn.apply(this, arguments); } finally { const dt = performance.now() - stackT.pop()!, ch = stackChild.pop()!; stackId.pop(); self[id] += dt - ch; incl[id] += dt; calls[id]++; if (stackChild.length) stackChild[stackChild.length - 1] += dt; } }; }
}
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const dynOf = (g: any): number => g.engine?.world?.dynamics?.length ?? g.dynBoxes?.length ?? 0;
{ const update = Game.prototype.update; let G: any = null;
  Game.prototype.update = function (this: any, ...a: any[]) {
    if (SPLIT && G !== this) { G = this; hook(this); }
    frame++; inUpdate = true; splitOn = SPLIT && !!wantFrames && (wantFrames.has(frame)); if (splitOn && !blowSplit) { self.fill(0); incl.fill(0); calls.fill(0); } blowSplit = false;
    const t0 = performance.now();
    try { return (update as any).apply(this, a); }
    finally { const dt = performance.now() - t0 + carry; carry = 0; ms.push(dt); if (markLeft > 0) { markLeft--; __BLAST_MARK_FRAME__(); } dyn.push(dynOf(this)); inUpdate = false;
      if (splitOn) { const rows: [string, number, number, number][] = []; names.forEach((n, i) => { if (calls[i]) rows.push([n, self[i], incl[i], calls[i]]); }); const sum = rows.reduce((s, r) => s + r[1], 0); rows.push(['(update itself: module functions)', dt - sum, dt, 1]);
        const had = perFrame.get(frame); if (had) { const m = new Map(had.map(r => [r[0], r])); for (const r of rows) { const o = m.get(r[0]); if (o) { r[1] = Math.min(r[1], o[1]); r[2] = Math.min(r[2], o[2]); } } } perFrame.set(frame, rows); splitOn = false; } }
  }; }
const { WallCharge } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { Destruction } = await import(`${ROOT}/src/game/destruction.ts`);
// BLAST_PACE's furniture index (furnblast.ts warm(): made when the charge is set): held against one made fresh AFTER the blast, as the base made it — every group, its
// members, their neighbours and supports, bounds, heaviest part and surface
let indexChecks = 0, indexBad = 0;
const indexSig = (G: any[]): string => JSON.stringify(G.map(x => [x.id, x.members.map((m: any) => [m.i, m.root, m.ghost, m.nb.map((n: any) => n.i), m.sup.map((n: any) => n.i)]), x.a, x.heavy, x.surf]));
{ const blow = WallCharge.prototype.blow; let inBlow = false;
  // (the scripted commander calls blow() BETWEEN two updates, the page's player from inside one: the call is timed here and counted into the frame it lands in —
  // the next update — so the blast frame is the page's: the trigger and the step that follows it)
  WallCharge.prototype.blow = function (this: any, ...a: any[]) { if (!this.set?.length) return (blow as any).apply(this, a);   // (the word with no charge set: nothing goes off)
    if (GC) Bun.gc(true); if (MARK && measuring) { __BLAST_MARK_BEGIN__(); markLeft = 1 + AFTER; } inBlow = true; if (!inUpdate && SPLIT && wantFrames?.has(frame + 1)) { splitOn = true; self.fill(0); incl.fill(0); calls.fill(0); blowSplit = true; } const F = this.g?.destr?.furn, ahead = !measuring && F?.groups ? indexSig(F.groups) : null;   // (checked on the passes that are thrown away: the check is work, and a charge blown on the word runs inside the timed step)
    const t0 = performance.now(); let r: any; try { r = (blow as any).apply(this, a); } finally { inBlow = false; }
    const dt = performance.now() - t0;
    if (r && ahead !== null) { const G = F.groups, M = F.memberAt; F.groups = null; F.memberAt = new Map(); const fresh = indexSig(F.index()); F.groups = G; F.memberAt = M;   // (the game keeps the index it had)
      indexChecks++; if (fresh !== ahead) { indexBad++; console.error(`frame ${frame + 1}: the furniture index made AHEAD of this blast is not the one made after it`); } } if (r) { const f = inUpdate ? frame : frame + 1; if (!inUpdate) carry += dt; blowMs.set(f, (blowMs.get(f) ?? 0) + dt); marks.push({ f, kind: 'wall', dyn0: dyn[dyn.length - 1] ?? 0 }); } return r; };
  const blast = Destruction.prototype.blast;
  Destruction.prototype.blast = function (this: any, ...a: any[]) { if (!inBlow && EVERY) marks.push({ f: inUpdate ? frame : frame + 1, kind: 'blast', dyn0: dyn[dyn.length - 1] ?? 0 }); return (blast as any).apply(this, a); }; }
function hook(g: any) {
  wrapProto('game', Object.getPrototypeOf(g), ['update']);
  const seen = new Set<any>(); const add = (label: string, o: any) => { if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o); const p = Object.getPrototypeOf(o); if (p && p !== Object.prototype && p !== Array.prototype && p !== Map.prototype && p !== Set.prototype) wrapProto(label, p); };
  for (const k of Object.keys(g)) add(k, g[k]);
  add('col.nav', g.col?.nav); add('col.sound', g.col?.sound); add('destr.walls', g.destr?.walls); add('destr.furn', g.destr?.furn); add('destr.breaks', g.destr?.breaks); add('destr.debris', g.destr?.debris); add('destr.walls.wear', g.destr?.walls?.wear);
  add('engine.world', g.engine?.world); add('engine.lights', g.engine?.lights);
  for (const k of Object.keys(g.destr ?? {})) add(`destr.${k}`, g.destr[k]);
}

// ───────────────────────────────────────────────────────────── the runs ────────────────────────────────────────────
const { play } = await import('./playthrough.ts');
interface BlastRow { f: number; t: number; kind: string; ms: number; cold: number; coldAfter: number[]; each: number[]; blow: number; after: number[]; dyn0: number; dyn1: number; split?: [string, number, number, number][] }
interface Out { scn: string; seed: number; end: string; digest: string; digests: string[]; frames: number; mean: number; p99: number; max: number; maxAt: number; blasts: BlastRow[] }
const outs: Out[] = []; let bad = false;
for (const scn of SCNS) for (const seed of SEEDS) {
  let min: number[] | null = null, M: typeof marks = [], D: number[] = [], r: any = null; const digests: string[] = []; perFrame = new Map(); wantFrames = null; callers.clear(); const each: number[][] = []; let cold: number[] | null = null;
  const total = WARM + PASSES + (SPLIT ? 2 : 0);
  for (let pass = 0; pass < total; pass++) {
    frame = -1; ms = []; marks = []; dyn = []; carry = 0; const blowPrev = blowMs; blowMs = new Map();
    const splitPass = pass >= WARM + PASSES; if (splitPass) { wantFrames = new Set(); for (const m of M) for (let k = 0; k <= 2; k++) wantFrames.add(m.f + k); } else wantFrames = null;
    measuring = pass >= WARM;
    try { r = await play(scn, seed, CAP, false, SET); } catch (e) { console.error(`${scn}:${seed} threw`, e); bad = true; break; }
    digests.push(r.digest ?? '');
    if (pass === 0) cold = ms.slice();   // (the process's first sight of this run — with one scenario a tool call, of the blast's code at all: what a fresh page pays its first charge)
    if (splitPass) blowMs = blowPrev;   // (a split pass's trigger time is its wrappers': the clean passes' minimum stands)
    if (pass < WARM || splitPass) continue;
    each.push(ms.slice());
    if (min) for (const [f, v] of blowPrev) blowMs.set(f, Math.min(v, blowMs.get(f) ?? v));
    if (!min) { min = ms.slice(); M = marks.slice(); D = dyn.slice(); } else { if (ms.length !== min.length) { console.error(`${scn}:${seed}: pass ${pass} ran ${ms.length} frames, the first ${min.length}`); bad = true; } const n = Math.min(min.length, ms.length); for (let i = 0; i < n; i++) if (ms[i] < min[i]) min[i] = ms[i]; }
  }
  if (!min || !r) continue;
  if (new Set(digests).size > 1) { console.error(`${scn}:${seed}: the digest moved between passes: ${[...new Set(digests)].join(' ')}`); bad = true; }
  const sorted = Float64Array.from(min).sort(), mean = min.reduce((a, b) => a + b, 0) / min.length; let maxAt = 0; for (let i = 60; i < min.length; i++) if (min[i] > min[maxAt] || maxAt < 60) maxAt = min[i] > (min[maxAt] ?? 0) || maxAt < 60 ? i : maxAt;
  const blasts: BlastRow[] = M.filter(m => m.f < min!.length).map(m => ({ f: m.f, t: m.f / 60, kind: m.kind, ms: min![m.f], cold: cold?.[m.f] ?? NaN, coldAfter: cold?.slice(m.f + 1, m.f + 5) ?? [], each: each.map(e => e[m.f] ?? NaN), blow: blowMs.get(m.f) ?? 0, after: min!.slice(m.f + 1, m.f + 1 + AFTER), dyn0: m.dyn0, dyn1: Math.max(...D.slice(m.f, m.f + 6)), split: perFrame.get(m.f) }));
  const o: Out = { scn, seed, end: r.end, digest: digests[0], digests, frames: min.length, mean, p99: sorted[Math.floor(sorted.length * 0.99)], max: min[maxAt], maxAt, blasts }; outs.push(o);
  console.log(`\n${scn}:${seed}  ${r.end}  ${min.length} frames · step mean ${mean.toFixed(2)} p99 ${o.p99.toFixed(2)} · worst after warm-up ${o.max.toFixed(2)} ms at frame ${maxAt} (${(maxAt / 60).toFixed(1)} s)${M.some(m => m.f === maxAt) ? ' = a blast frame' : ''} · digest ${o.digest}`);
  if (!blasts.length) console.log('  no wall charge went off in this run');
  for (const b of blasts) { console.log(`  ${b.kind === 'wall' ? 'WALL CHARGE' : 'blast      '} frame ${b.f} (${b.t.toFixed(2)} s): ${b.ms.toFixed(2)} ms (the trigger's own call ${b.blow.toFixed(2)}${b.each.length > 1 ? ` · each pass ${b.each.map(x => x.toFixed(1)).join(' ')}` : ''}) · then ${b.after.map(x => x.toFixed(1)).join(' ')} · moving boxes ${b.dyn0} → ${b.dyn1}${WARM > 0 ? ` · COLD (the first pass) ${b.cold.toFixed(1)} then ${b.coldAfter.map(x => x.toFixed(1)).join(' ')}` : ''}`);
    if (SPLIT && !QUIET) for (let k = 0; k <= 2; k++) { const rows = perFrame.get(b.f + k); if (!rows) continue; const top = rows.slice().sort((x, y) => y[1] - x[1]).filter(x => x[1] >= 0.05).slice(0, 14);
      if (CALLERS && k === 0) { console.log('    who asked (blast frame and the two after, calls):'); for (const [key, n] of [...callers].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`      ×${String(n).padEnd(6)} ${key}`); }
      console.log(`    frame +${k} by method (self ms · inclusive · calls):`); for (const [n, s, i, c] of top) console.log(`      ${s.toFixed(2).padStart(6)}  ${i.toFixed(2).padStart(6)}  ×${String(c).padEnd(5)} ${n}`); } }
}
const all = outs.flatMap(o => o.blasts.filter(b => b.kind === 'wall').map(b => ({ scn: o.scn, seed: o.seed, ...b })));
if (all.length) { const worst = all.reduce((a, b) => b.ms > a.ms ? b : a), w1 = Math.max(...all.map(b => Math.max(0, ...b.after.slice(0, 4)))); const med = all.map(b => b.ms).sort((a, b) => a - b)[all.length >> 1];
  console.log(`\n${all.length} wall charges over ${outs.length} runs: the blast frame's step median ${med.toFixed(2)} ms, worst ${worst.ms.toFixed(2)} ms (${worst.scn}:${worst.seed} frame ${worst.f}) · worst of the four frames after a blast ${w1.toFixed(2)} ms${WARM > 0 ? ` · cold: median ${all.map(b => b.cold).sort((a, b) => a - b)[all.length >> 1].toFixed(1)}, worst ${Math.max(...all.map(b => b.cold)).toFixed(1)}` : ''}`); }
if (indexChecks) console.log(`the furniture index made ahead of a wall charge = the index made after it: ${indexChecks - indexBad} of ${indexChecks} blasts (the --warm passes')`); if (indexBad) bad = true;
if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ at: new Date().toISOString(), arm: ARM, passes: PASSES, warm: WARM, env: Object.fromEntries(['TPS_CAST', 'TPS_MOVES', 'TPS_TURN', 'GLASSFX', 'PT_DESTR', 'PT_WALL', 'TPS_BLASTPACE'].map(k => [k, process.env[k] ?? null])), set: SET, runs: outs }, null, 1));
process.exit(bad ? 1 : 0);
