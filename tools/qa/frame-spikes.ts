// THE WORST FRAMES — where the game step hitches. tools/qa/playthrough.ts's play() run under timing wrappers put on from OUTSIDE (no game code edited): for every
// run, the N worst frames of W.step (Game.update + camera + lights + the box upload, as PT_TIMES times it) with the game time, the ms, how many of each side were
// up, whether a collection ended inside the frame, and WHAT ran long in it — next to what that same thing costs on an ordinary frame.
//   bun run tools/qa/frame-spikes.ts [--scn id,id] [--seeds 1-2] [--ship | --ship5] [--hard] [--top 8] [--jobs 2] [--warm 0] [--passes 3] [--nocallers] [--json out.json] [--base base.json]
//   bun run tools/qa/frame-spikes.ts --one <scn>:<seed> [--ship | --ship5] [--hard] [--top 12]        one run in this process, its tables printed in full
//   --warm N   (default 0) the run is played N times first and thrown away, in the same process (with --passes 1: the frames listed are then the WORK's, not the
//              JIT's first sight of a function; `--warm 0 --passes 1` lists the cold run — the first frag, the first door order as a fresh page pays them)
//   --passes N (default 3) the run is then MEASURED N times and a frame's cost is its minimum over them (the run is deterministic frame for frame; this box is shared, and
//              a pass's frame can be a lost time slice, a collection, a function compiling — the minimum is the work). What a collection costs is reported apart
//   --base F   a playthrough --json of the base (PT_DIGEST=1): every run here is compared with it by digest (the wrappers must change nothing: same args, same
//              return, same this — this is the proof), 'N runs equal the base by digest, M differ' on the last line
//   --ship     THE SHIPPED STAND: TPS_PROFILE=shipped in the environment (src/host/profile.ts) — the harness stood up as the page opens with no URL flag: every rule
//              that ships on is on (FROZEN_HOLDS there is the list). With neither flag: the stand the environment names (the frozen one unless it says otherwise).
//              Every run prints the stand it stood on, as the harness itself says
//   --ship5    ROUND ONE'S ARM, kept so its tables can be taken again: the frozen stand + TPS_CAST=1 TPS_MOVES=1 TPS_TURN=1 GLASSFX=on and FRAG.defenders on. It was
//              this tool's --ship before the shipped stand existed (rebuild/performance/measured.md and game-step.md in the project files were taken on it, and on
//              framecost.ts's `shipped5`); it is NOT what the page plays any more, and its numbers do not compare with --ship's
//   --set '{…}' as playthrough.ts (--hard = '{"DIFFICULTY":{"level":"hard"}}')
//   exit 0 = every run ended and (with --base) every digest agreed · 1 = a run threw / stalled / differed · 2 = unknown flag or scenario
//
// HOW A FRAME IS ATTRIBUTED. Class instances can be wrapped at run time, ES module function exports (updateGuard, tacticsTick, fragTick …) cannot. So:
//   · every method on the prototype of every class instance hanging off the Game (g.fight, g.cover, g.doorTools, g.orders, g.fogOfWar, g.col, g.col.nav,
//     g.col.sound, g.destr, g.glassBreak, g.doors, g.props, g.items … and Character / Guard / Animator, the engine's BoxWorld / LightSet, the camera, the input)
//     is replaced by a wrapper that adds its time into a per-frame table: SELF ms (its own, less the wrapped calls under it) and INCLUSIVE ms, and calls;
//   · what is left is the frame's own self time = the module functions Game.update calls directly. That is cut into PHASES by the wrapped calls update makes
//     exactly once, in order ('after fight.tick' = nvgTick tacticsTick needsTick fragThrowTick fragTick, then the guards …), and the guards' stretch is cut per
//     MAN by Character.turnBegin, updateGuard's first statement: 'updateGuard Red Two (operative, alert)' is that man's updateGuard less the wrapped calls in it;
//   · WHO CALLED a wrapped leaf (segmentBlocked, findPath, raycast, propagate …): one more pass after the measured ones, nothing timed on it, in which every
//     call of those leaves in the worst frames reads its own stack: 'col.segmentBlocked ← losOpen@tactics < lastCoverPoint@tactics < planApproach@tactics ×291'
//     — the module functions the wrappers cannot reach, named (--nocallers skips the pass);
//   · a collection: bun:jsc heapSize() read at every frame's end — a frame it DROPPED in had a collection end inside it ('gc −1.2 MB');
//   · for the module functions inside a phase, take a sampling profile of the same run: `bun --cpu-prof … run tools/qa/frame-spikes.ts --one scn:seed` and
//     tools/spikes.ts over it (the wrappers show as `w` frames between the real ones).
// The wrappers cost ~10 ns a call (two performance.now()): the ms here run a little over PT_TIMES's — judge a cut by PT_TIMES / the profile, find it here.
import { writeFileSync, readFileSync, rmSync, openSync, readSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { heapSize } from 'bun:jsc';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const KNOWN = ['--scn', '--seeds', '--hard', '--top', '--jobs', '--warm', '--json', '--base', '--one', '--out', '--set', '--cap', '--passes', '--nocallers', '--ship', '--ship5'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const TOP = Number(flag('--top') ?? 8), WARM = Number(flag('--warm') ?? 0), PASSES = Math.max(1, Number(flag('--passes') ?? 3)), CALLERS = !argv.includes('--nocallers'), CAP = Number(flag('--cap') ?? 300), HARD = argv.includes('--hard');
// --ship = THE SHIPPED STAND (TPS_PROFILE=shipped: what the page plays), --ship5 = round one's five-word arm over the frozen stand (the head comment); neither =
// the environment as this tool was started in (the frozen stand unless it says otherwise). The environment is set here, before the harness is imported and for
// every child run — with either flag the stand is NAMED, so a TPS_PROFILE the tool was itself started under cannot turn one arm into the other
const SHIP = argv.includes('--ship'), SHIP5 = argv.includes('--ship5'); if (SHIP && SHIP5) { console.error('--ship and --ship5 are two arms: one of them'); process.exit(2); }
Object.assign(process.env, SHIP ? { TPS_PROFILE: 'shipped' } : SHIP5 ? { TPS_PROFILE: 'frozen', TPS_CAST: '1', TPS_MOVES: '1', TPS_TURN: '1', GLASSFX: 'on' } : {});
const SET: Record<string, Record<string, unknown>> = { ...JSON.parse(flag('--set') ?? '{}'), ...(SHIP5 ? { FRAG: { defenders: true } } : {}), ...(HARD ? { DIFFICULTY: { level: 'hard' } } : {}) };

// ───────────────────────────────────────────────────────────── the wrappers ────────────────────────────────────────
/** THE TIME THIS THREAD SPENT WAITING FOR A CORE, ms (Linux: /proc/thread-self/schedstat's second word, exact as of the last time it was switched in; 2 µs a
 *  read; 0 where there is no such file): a frame's cost is its wall time LESS what of it was spent switched out — on a box shared with other jobs a frame's
 *  wall time is as often a lost time slice (a whole 4 ms, or two) as it is work */
const waited: () => number = (() => { try { const fd = openSync('/proc/thread-self/schedstat', 'r'), buf = Buffer.alloc(96);
  return () => { const n = readSync(fd, buf, 0, 96, 0), s = buf.latin1Slice(0, n), i = s.indexOf(' '); return Number(s.slice(i + 1, s.indexOf(' ', i + 1))) / 1e6; }; } catch { return () => 0; } })();
/** what update calls ONCE a frame, directly, in this order: the frame's own self time between two of them is a phase, named by what runs there unwrapped */
const PHASES: Record<string, string> = {
  'start': 'journal · director.injectInput',
  'sound.tick': 'updateAim (the interaction rows)',
  'orders.input': 'updateInteract · trackPlayer · threat proximity · updateSuppression · updatePlayer · rings / shells · the weapon deal',
  'director.tick': '(between the drills\' ticks)', 'nightBreach.tick': '(between the drills\' ticks)', 'roomClear.tick': '(between the drills\' ticks)', 'rescue.tick': '(between the drills\' ticks)',
  'entry.tick': '(between the squad\'s ticks)', 'cleared.tick': '(between the squad\'s ticks)', 'doorTools.tick': '(between the squad\'s ticks)',
  'cover.tick': 'silentTick', 'pair.tick': 'spottedTick', 'orders.tick': '(before the fight)',
  'fight.tick': 'nvgTick · tacticsTick · needsTick · fragThrowTick · fragTick',
  'game.updateDoors': 'updateMission', 'game.updateProps': '(before destruction)', 'destr.update': 'events filter · updateTargets · updateDevices',
  'weather.update': 'updateWetness', 'wind.update': '(before the moths)', 'moths.update': 'updateRainFx · updateItems · updateGlass',
  'glassBreak.update': '(before the shards)', 'shards.update': '(before the fog of war)',
  'fogOfWar.update': 'the dynamic boxes · handProps · fx', 'tracers.update': '(before the sparks)', 'sparks.update': 'updateParticleFx · smoke pushes',
  'world.resetCapsules': 'the draw list: looks · skin instances · proxies', 'chars.finish': 'the sensors\' asks · smoke lines', 'fogOfWar.flushAsks': 'the meter\'s read',
  'cues.tick': '(before the saves)', 'saves.tick': '(the journal\'s end)',
  'update-end': '(W.step after update)', 'cam.update': '(W.step after the camera)', 'lights.update': '(W.step: before the upload)', 'world.upload': '(W.step: before endFrame)',
};
const names: string[] = [], idOf = new Map<string, number>();
const id = (name: string): number => { let i = idOf.get(name); if (i === undefined) { i = names.length; names.push(name); idOf.set(name, i); grow(i); } return i; };
let fSelf = new Float64Array(256), fIncl = new Float64Array(256), fN = new Int32Array(256), rSelf = new Float64Array(256), rIncl = new Float64Array(256), rN = new Float64Array(256), rMax = new Float64Array(256), rMaxAt = new Float64Array(256), rFrames = new Int32Array(256);
const grow = (i: number) => { if (i < fSelf.length) return; const g = <T extends Float64Array | Int32Array>(a: T): T => { const b = new (a.constructor as any)(a.length * 2); b.set(a); return b; };
  fSelf = g(fSelf); fIncl = g(fIncl); fN = g(fN); rSelf = g(rSelf); rIncl = g(rIncl); rN = g(rN); rMax = g(rMax); rMaxAt = g(rMaxAt); rFrames = g(rFrames); };
const touched: number[] = [];
// the call stack of wrapped calls inside the open frame (depth 0 = the frame itself: update's own code, then W.step's)
const sStart = new Float64Array(512), sChild = new Float64Array(512), sId = new Int32Array(512); let depth = -1, open = false, on = false;
let phase = 0, phaseT = 0, phaseChild = 0;   // (the frame's self time since phaseT, less the wrapped calls made directly from it, belongs to `phase`)
const add = (i: number, self: number, incl: number) => { if (fN[i] === 0 && fSelf[i] === 0) touched.push(i); fSelf[i] += self; fIncl[i] += incl; };
const switchPhase = (to: number, now: number) => { add(phase, (now - phaseT) - (sChild[0] - phaseChild), 0); phase = to; phaseT = now; phaseChild = sChild[0]; };
const guardOf = new WeakMap<object, any>();
// WHO CALLED IT — the module functions between update and a wrapped leaf cannot be wrapped, but a leaf can ask who is above it: on ONE more pass after the
// measured ones (nothing is timed on it), in the worst frames only, every call of these leaves reads its own stack and counts the three callers above it
const LEAVES = new Set(['col.segmentBlocked', 'col.raycast', 'col.collideCircle', 'nav.findPath', 'nav.walkable', 'sound.propagate', 'world.raycast']);
let stacksOn = false, callerFrames: Set<number> | null = null, callerF = 0, callersNow: Map<string, Map<string, number>> | null = null; const callersOf = new Map<number, Map<string, Map<string, number>>>();
function noteCaller(leaf: string) { const L = (new Error().stack ?? '').split('\n'), up: string[] = [];
  for (let k = 1; k < L.length && up.length < 3; k++) { const m = L[k].match(/^\s*(?:at )?([^@(\s]*)[@(\s].*?([\w-]+)\.ts/); const fn = m?.[1] || '', file = m?.[2] || ''; if (!m || fn === 'w' || fn === 'noteCaller' || (file === 'collision' && up.length === 0 && /Blocked$/.test(fn)) || (file === 'game' && (fn === 'step' || UPDATE_PARTS.has(fn)))) continue; up.push(`${fn || '(anon)'}@${file}`); }
  const key = up.join(' < '); let M = callersNow!.get(leaf); if (!M) callersNow!.set(leaf, M = new Map()); M.set(key, (M.get(key) ?? 0) + 1); }
function wrap(fn: Function, i: number, kind: 0 | 1 | 2): Function {   // kind 1: a phase mark of update's · 2: Character.turnBegin (updateGuard's first statement)
  return function w(this: any) {
    if (!open) return fn.apply(this, arguments);
    if (stacksOn && LEAVES.has(names[i])) noteCaller(names[i]);
    const t0 = performance.now();
    if (depth === 0) { if (kind === 1) switchPhase(id(`· after ${names[i]}: ${PHASES[names[i]] ?? ''}`), t0); else if (kind === 2) { const gd = guardOf.get(this); if (gd) switchPhase(id(`· updateGuard ${gd.callsign ?? '?'} (${gd.team}${gd.unit ? '' : ' staff'})`), t0); } }
    depth++; sStart[depth] = t0; sChild[depth] = 0; sId[depth] = i;
    try { return fn.apply(this, arguments); }
    finally { if (depth >= 0) {   // (below 0 the frame closed inside this call — Input.endFrame, reached through the seat: no start to time it from, and a NaN here went into the run's shares)
      const t1 = performance.now(), incl = t1 - sStart[depth], self = incl - sChild[depth]; if (fN[i] === 0 && fSelf[i] === 0) touched.push(i); fN[i]++; fSelf[i] += self; fIncl[i] += incl; depth--; sChild[depth] += incl; } }
  };
}
/** Game.update's own lines standing in private methods beside it (game.ts 'update()'s parts'): wrapped, the phase marks inside them would sit one call deep and never switch a phase;
 *  and they — and step(), the body update() hands the tick's record to — are passed over in a leaf's caller chain (noteCaller), which so reads as it did when the lines stood in update() */
const UPDATE_PARTS = new Set(['threatTick', 'dealWeapons', 'stepFxAndDynBoxes', 'smokeWake', 'drawCharacters', 'lightMeter']);
/** called tens of thousands of times a frame and a few nanoseconds each: a wrapper would be most of what it measured (their time is their callers' self time) */
const TINY = new Set(['nav.idx', 'nav.isBlocked']);
const done = new WeakSet<object>(), SKIP_KEY = new Set(['engine', 'level', 'ch', 'audio', 'smoke', 'probe', 'viewProj', 'journal']);
const plain = (p: any) => p === null || p === Object.prototype || p === Array.prototype || p === Map.prototype || p === Set.prototype || p === WeakMap.prototype || p === WeakSet.prototype || p === Function.prototype || ArrayBuffer.isView({ __proto__: p }) || Object.getPrototypeOf(p) === Object.getPrototypeOf(Int8Array.prototype) || p === Object.getPrototypeOf(Int8Array.prototype);
/** every method on obj's class (and its bases) gets a wrapper, once per prototype, named `<name>.<method>` */
function scan(obj: any, name: string, deep: number) {
  if (!obj || typeof obj !== 'object') return;
  for (let p = Object.getPrototypeOf(obj); !plain(p); p = Object.getPrototypeOf(p)) {
    if (done.has(p)) continue; done.add(p);
    for (const k of Object.getOwnPropertyNames(p)) { if (k === 'constructor') continue; const d = Object.getOwnPropertyDescriptor(p, k)!; if (typeof d.value !== 'function' || !d.writable) continue;
      if (/^class\s/.test(Function.prototype.toString.call(d.value))) continue;
      if (name === 'game' && (k === 'update' || k === 'step' || UPDATE_PARTS.has(k))) continue;   // (the frame itself: wrapped below — and its parts, left bare so the calls inside them still cut the frame into PHASES)
      if (TINY.has(`${name}.${k}`)) continue;
      const label = `${name}.${k}`, i = id(label); p[k] = wrap(d.value, i, name === 'char' && k === 'turnBegin' ? 2 : label in PHASES ? 1 : 0); }
  }
  if (deep > 0) for (const k of Object.keys(obj)) { if (SKIP_KEY.has(k)) continue; let v: any; try { v = obj[k]; } catch { continue; } if (v && typeof v === 'object' && !plain(Object.getPrototypeOf(v))) scan(v, name === 'game' ? k : `${name}.${k}`, deep - 1); }
}
interface Row { /** per leaf: who called it in this frame, [the three callers above it, calls] */ callers?: Record<string, [string, number][]>; f: number; t: number; ms: number; /** passes its table is the minimum of */ n?: number; /** ms of the frame's wall time this thread was switched out, in the pass its table is from (they are IN that table, on whatever was running) */ lost: number; /** what it cost in the pass its table is from */ pass?: number; update: number; ops: number; hostiles: number; staff: number; civ: number; gc: number; what: [string, number, number, number][] }   // what: [label, self ms, inclusive ms, calls]
interface RunStats { frames: number; ms: Float64Array | number[]; worst: Row[]; gcFrames: number; gcMs: number; gcMax: number; noise: number; same: boolean; labels: { name: string; self: number; incl: number; n: number; max: number; maxAt: number; frames: number }[] }
let G: any = null, seenGuards = 0, frameT0 = 0, wait0 = 0, updateMs = 0, frames = 0, lastHeap = 0; let msAll: number[] = [], worst: Row[] = [], gcs: [number, number][] = [];
// ACROSS THE MEASURED PASSES (the same run again and again — it is deterministic, frame for frame): a frame's cost is its MINIMUM over the passes (this box is shared:
// a pass's frame can be a time slice lost to another process, a collection, a function compiling — the minimum is the work), each worst frame's table is the
// one from the pass that frame was cheapest in, and what a collection costs is what its frame ran over that minimum
let minMs: Float64Array | null = null, cand: Set<number> | null = null; const snaps = new Map<number, Row>();
const P_START = id('· start: ' + PHASES.start), P_END = id('· after update-end: ' + PHASES['update-end']);
function sight(g: any, input: any, cam: any) {
  hookEnd(input);
  if (g !== G) { G = g; seenGuards = -1; scan(g.player?.char, 'char', 1); scan(g.col, 'col', 0); scan(g.col?.nav, 'nav', 0); scan(g.col?.sound, 'sound', 0); scan(g.engine?.world, 'world', 0); scan(g.engine?.lights, 'lights', 0); scan(cam, 'cam', 0); scan(g.player, 'player', 1); scan(g, 'game', 2); }
  if (g.guards.length !== seenGuards) { seenGuards = g.guards.length; for (const gd of [...g.guards, ...(g.civilians ?? [])]) { guardOf.set(gd.char, gd); scan(gd.char, 'char', 1); scan(gd, 'guard', 1); } }
}
function closeFrame() {
  if (!open) return; const now = performance.now(); switchPhase(P_END, now); open = false; depth = -1;
  const lost = waited() - wait0, ms = now - frameT0 - lost, h = heapSize(), gc = h < lastHeap ? lastHeap - h : 0; lastHeap = h;
  if (!on) { for (const i of touched) { fSelf[i] = 0; fIncl[i] = 0; fN[i] = 0; } touched.length = 0; return; }
  const f = frames++; msAll.push(ms); if (gc) gcs.push([f, gc]);
  const had = snaps.get(f), keep = !!had || !!cand?.has(f) || worst.length < TOP * 3 || ms > worst[worst.length - 1].ms; let what: Row['what'] = [];   // (a table for: a frame that has one · one of the worst so far by its minimum · one of this pass's own worst)
  for (const i of touched) { const s = fSelf[i]; rSelf[i] += s; rIncl[i] += fIncl[i]; rN[i] += fN[i]; rFrames[i]++; if (s > rMax[i] && lost < 0.02) { rMax[i] = s; rMaxAt[i] = G.time; }   /* (a label's worst frame: only frames this thread kept the core through) */
    if (keep && (s > 0.02 || fIncl[i] > 0.05)) what.push([names[i], s, fIncl[i], fN[i]]); fSelf[i] = 0; fIncl[i] = 0; fN[i] = 0; }
  touched.length = 0;
  if (keep) { let ops = 0, hostiles = 0, staff = 0; for (const x of G.guards) { if (x.state === 'dead') continue; if (x.team === 'operative') ops++; else if (x.team === 'hostile') hostiles++; else staff++; }
    const row: Row = { f, t: G.time, ms, lost, update: updateMs, ops, hostiles, staff, civ: (G.civilians ?? []).filter((x: any) => x.state !== 'dead').length, gc, what: what.sort((a, b) => b[1] - a[1]) };
    // (a frame's table over the passes: the frame does the same work in each, so each line's cost is its MINIMUM over them — what a pass adds is a lost time
    // slice, a collection, a function compiling, and it adds it to whichever line was running)
    if (had) { const m = new Map(had.what.map(x => [x[0], x])); row.what = row.what.filter(x => { const o = m.get(x[0]); if (!o) return false; x[1] = Math.min(x[1], o[1]); x[2] = Math.min(x[2], o[2]); return true; }).sort((a, b) => b[1] - a[1]); row.lost = Math.min(lost, had.lost); row.ms = Math.min(ms, had.ms); row.gc = Math.min(gc, had.gc); row.n = (had.n ?? 1) + 1; }
    snaps.set(f, row); if (worst.length < TOP * 3 || ms > worst[worst.length - 1].ms) { worst.push(row); worst.sort((a, b) => b.ms - a.ms); if (worst.length > TOP * 3) worst.length = TOP * 3; } }
}
const ROOT = resolve(import.meta.dir, '../..');
const { Game } = await import(`${ROOT}/src/game/game.ts`);
{ const update = Game.prototype.update;
  Game.prototype.update = function (this: any, dt: number, input: any, cam: any, canvas: any) {
    closeFrame(); sight(this, input, cam);
    if (callerFrames) { stacksOn = callerFrames.has(callerF); if (stacksOn) callersOf.set(callerF, callersNow = new Map()); callerF++; }
    open = true; depth = 0; sChild[0] = 0; wait0 = waited(); frameT0 = performance.now(); phase = P_START; phaseT = frameT0; phaseChild = 0;
    try { return update.call(this, dt, input, cam, canvas); }
    finally { const now = performance.now(); updateMs = now - frameT0; depth = 0; switchPhase(P_END, now); }   // (the frame stays open: W.step's camera / lights / upload / endFrame are its tail)
  }; }
// (the frame ends at Input.endFrame, W.step's last statement — or at the next update; the input's class is first seen when an update hands it over)
function hookEnd(input: any) { const p = Object.getPrototypeOf(input); if ((p as any).__spikesEnd) return; (p as any).__spikesEnd = true; const f = p.endFrame; p.endFrame = function (this: any) { const r = f.apply(this, arguments); closeFrame(); return r; }; }
const passMs: Float64Array[] = [], passGc: [number, number][][] = []; let aLabels = new Map<string, RunStats['labels'][number]>();
function begin() { on = true; frames = 0; msAll = []; worst = []; gcs = []; rSelf.fill(0); rIncl.fill(0); rN.fill(0); rMax.fill(0); rMaxAt.fill(0); rFrames.fill(0); lastHeap = heapSize(); }
/** one measured pass over: its frames folded into the minimum, the next pass's candidates picked (three times the list: a frame this pass was lucky on may yet be one of the worst) */
function endPass() { closeFrame(); on = false; const ms = Float64Array.from(msAll); passMs.push(ms); passGc.push(gcs);
  if (!minMs) minMs = ms.slice(); else { const n = Math.min(minMs.length, ms.length); for (let i = 0; i < n; i++) if (ms[i] < minMs[i]) minMs[i] = ms[i]; }
  const order = Array.from(minMs.keys()).sort((a, b) => minMs![b] - minMs![a]).slice(0, TOP * 3); cand = new Set(order);
  names.forEach((name, i) => { if (!rFrames[i]) return; const l = { name, self: rSelf[i], incl: rIncl[i], n: rN[i], max: rMax[i], maxAt: rMaxAt[i], frames: rFrames[i] }, o = aLabels.get(name);
    if (!o) aLabels.set(name, l); else { if (l.max < o.max) { o.max = l.max; o.maxAt = l.maxAt; } if (l.self < o.self) { o.self = l.self; o.incl = l.incl; } } }); }
function end(): RunStats { const m = minMs!, order = Array.from(m.keys()).sort((a, b) => m[b] - m[a]).slice(0, TOP);
  const rows = order.map(f => { const s = snaps.get(f); return s ? { ...s, pass: s.ms, ms: m[f] } : { f, t: f / 60, ms: m[f], pass: NaN, lost: 0, update: NaN, ops: 0, hostiles: 0, staff: 0, civ: 0, gc: 0, what: [] } as Row; });
  // (a collection's cost: what the frames it ended in ran over their own minimum)
  let gcN = 0, gcOver = 0, gcMax = 0, noise = 0, nAll = 0; passGc.forEach((L, p) => { for (const [f] of L) { if (f >= m.length) continue; const over = passMs[p][f] - m[f]; gcN++; gcOver += over; if (over > gcMax) gcMax = over; } });
  for (const p of passMs) for (let i = 0; i < Math.min(p.length, m.length); i++) { noise += p[i] - m[i]; nAll++; }
  return { frames: m.length, ms: m, worst: rows, gcFrames: gcN / passMs.length, gcMs: gcN ? gcOver / gcN : 0, gcMax, noise: nAll ? noise / nAll : 0, same: passMs.every(p => p.length === m.length), labels: [...aLabels.values()] }; }

// ───────────────────────────────────────────────────────────── one run ─────────────────────────────────────────────
interface Out { scn: string; seed: number; /** the harness stand the run stood on, as the harness says (src/host/profile.ts harnessProfile) */ stand?: string; hard: boolean; end: string; why: string; secs: number; digest?: string; digests: string[]; frames: number; mean: number; p50: number; p95: number; p99: number; max: number; over4: number; over8: number; over16: number;
  gcFrames: number; gcMeanMs: number; gcMaxMs: number; noise: number; same: boolean; passes: number; worst: Row[]; labels: RunStats['labels'] }
async function one(scn: string, seed: number): Promise<Out> {
  process.env.PT_DIGEST = '1';
  const { play } = await import('./playthrough.ts');
  const digests: string[] = []; let r: any = null, st: RunStats | null = null, bad: any = null;
  for (let pass = 0; pass < WARM + PASSES; pass++) { const m = pass >= WARM; if (m) begin();
    r = await play(scn, seed, CAP, false, SET); digests.push(r.digest ?? ''); if (m) endPass(); else closeFrame(); if (r.end === 'error') { bad = r; break; } }
  st = end();
  if (CALLERS && !bad) { callerFrames = new Set(st.worst.map(w => w.f)); callerF = 0; r = await play(scn, seed, CAP, false, SET); digests.push(r.digest ?? ''); closeFrame(); stacksOn = false; callerFrames = null;
    for (const w of st.worst) { const C = callersOf.get(w.f); if (C) w.callers = Object.fromEntries([...C].map(([leaf, M]) => [leaf, [...M].sort((a, b) => b[1] - a[1]).slice(0, 6)])); } }
  if (bad) r = bad;
  const a = Float64Array.from(st!.ms).sort(), at = (q: number) => a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0, over = (x: number) => { let n = 0; for (const m of a) if (m > x) n++; return n; };
  const stand: string = (await import(`${ROOT}/src/host/profile.ts`)).harnessProfile();   // (what the harness this run was played on says it is — not what this tool asked for)
  return { scn, seed, stand, hard: SET.DIFFICULTY?.level === 'hard', end: r.end, why: String(r.why).split('\n')[0], secs: r.t, digest: r.digest, digests, frames: st!.frames, mean: a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p50: at(0.5), p95: at(0.95), p99: at(0.99), max: a[a.length - 1] ?? 0,
    over4: over(4), over8: over(8), over16: over(16), gcFrames: st!.gcFrames, gcMeanMs: st!.gcMs, gcMaxMs: st!.gcMax, noise: st!.noise, same: st!.same, passes: PASSES, worst: st!.worst, labels: st!.labels.sort((x, y) => y.max - x.max) };
}
const f2 = (x: number) => x.toFixed(2), f1 = (x: number) => x.toFixed(1);
/** the first caller of a worst frame's leading line, when that line is a leaf that asked */
const lead = (w: Row): string => { const c = w.callers?.[w.what[0]?.[0] ?? '']?.[0]; return c ? ` ← ${c[0].split(' < ').slice(0, 2).join(' < ')} ×${c[1]}` : ''; };
/** one worst frame in words: the biggest self times, each beside its run mean per frame it ran in — and the wrapped calls under them worth naming */
function whyOf(w: Row, o: Out, k = 5): string {
  const L = new Map(o.labels.map(l => [l.name, l]));
  const top = w.what.filter(x => x[1] >= Math.max(0.08, w.ms * 0.04)).slice(0, k).map(([name, self, incl, n]) => { const l = L.get(name), mean = l && l.frames ? l.self / l.frames : 0;
    return `${name.replace(/^· /, '').replace(/: .*/, '')} ${f2(self)}${incl > self * 1.3 + 0.05 ? ` (incl ${f2(incl)})` : ''}${n > 1 ? ` ×${n}` : ''} [mean ${mean < 0.01 ? mean.toFixed(3) : f2(mean)}]`; });
  return top.join(' · ');
}
function printRun(o: Out, full: boolean) {
  console.log(`\n${o.scn}:${o.seed}${o.hard ? ' HARD' : ''} (${SHIP5 ? "round one's five words on " : ''}the ${o.stand ?? '?'} stand) — ${o.end}${o.end === 'error' ? ` (${o.why})` : ''} at ${o.secs} s · ${o.frames} frames · step ms mean ${f2(o.mean)} p50 ${f2(o.p50)} p95 ${f2(o.p95)} p99 ${f2(o.p99)} max ${f2(o.max)} · >4 ms ${o.over4} · >8 ms ${o.over8} · >16 ms ${o.over16} · a collection ended in ${f1(o.gcFrames)} frames a pass, costing its frame ${f2(o.gcMeanMs)} ms on average, ${f2(o.gcMaxMs)} at worst · a frame ran ${f2(o.noise)} ms over its own minimum on average (${o.passes} passes${o.same ? '' : ', OF DIFFERENT LENGTHS'})${o.digests.every(d => d === o.digest) ? '' : ` · DIGESTS DIFFER BETWEEN PASSES ${o.digests.join(' ')}`}`);
  console.log('   game t  min ms (Σ lines, passes)  ops/hostile/staff  gc      what ran long: self ms (incl) ×calls [its mean self per frame it ran in]');
  for (const w of o.worst) { console.log(`  ${f1(w.t).padStart(7)} ${f2(w.ms).padStart(7)} ${`(${f2(w.what.reduce((a, x) => a + x[1], 0))} in ${w.n ?? 1})`.padStart(11)}  ${`${w.ops}/${w.hostiles}/${w.staff}`.padStart(9)}  ${(w.gc ? `−${(w.gc / 1048576).toFixed(1)}MB` : '').padStart(8)}  ${whyOf(w, o, full ? 8 : 5)}`);
    if (full && w.callers) for (const [leaf, L] of Object.entries(w.callers)) { const n = L.reduce((a, x) => a + x[1], 0); if (n >= 20 || leaf === 'nav.findPath' || leaf === 'sound.propagate') console.log(`${' '.repeat(46)}${leaf} ← ${L.slice(0, 4).map(x => `${x[0]} ×${x[1]}`).join(' | ')}`); }
    if (full) { const inc = w.what.filter(x => x[2] >= Math.max(0.15, w.ms * 0.08) && !x[0].startsWith('· ')).sort((a, b) => b[2] - a[2]).slice(0, 8); if (inc.length) console.log(`${' '.repeat(46)}inclusive: ${inc.map(x => `${x[0]} ${f2(x[2])}×${x[3]}`).join(' · ')}`); } }
  if (full) { console.log('\n  the burstiest (max self ms in ONE frame, against the mean per frame it ran in):');
    for (const l of o.labels.slice(0, 28)) console.log(`  ${f2(l.max).padStart(7)} at ${f1(l.maxAt).padStart(6)} s · mean ${(l.self / l.frames).toFixed(3).padStart(7)} · total ${f1(l.self).padStart(8)} ms · ${String(Math.round(l.n / l.frames)).padStart(5)} calls/frame · ${l.name}`);
    const tot = o.labels.reduce((a, l) => a + l.self, 0) || 1; console.log('\n  the heaviest over the run (self):');
    for (const l of [...o.labels].sort((a, b) => b.self - a.self).slice(0, 22)) console.log(`  ${(100 * l.self / tot).toFixed(1).padStart(5)} % · ${f1(l.self).padStart(8)} ms · ${l.name}`); }
}

// ───────────────────────────────────────────────────────────── main ────────────────────────────────────────────────
if (flag('--one')) {
  const [scn, seed] = flag('--one')!.split(':'); const o = await one(scn, Number(seed ?? 1));
  if (flag('--out')) writeFileSync(flag('--out')!, JSON.stringify(o)); else printRun(o, true);
  process.exit(o.end === 'error' || o.end === 'stalled' ? 1 : 0);
}
{
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
  const ids: string[] = (flag('--scn') ?? SCENARIOS.map((e: any) => e.id).join(',')).split(','), seeds = seedsOf(flag('--seeds') ?? '1-2'), jobs = Math.max(1, Number(flag('--jobs') ?? 2));
  for (const s of ids) if (!SCENARIOS.some((e: any) => e.id === s)) { console.error(`no scenario '${s}' — ${SCENARIOS.map((e: any) => e.id).join(', ')}`); process.exit(2); }
  const todo = ids.flatMap(scn => seeds.map(seed => ({ scn, seed }))), outs: Out[] = []; let next = 0; const t0 = Date.now();
  const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return; const file = resolve(tmpdir(), `spikes-${process.pid}-${j.scn}-${j.seed}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.scn}:${j.seed}`, '--out', file, '--top', String(TOP), '--warm', String(WARM), '--passes', String(PASSES), ...(CALLERS ? [] : ['--nocallers']), ...(SHIP ? ['--ship'] : SHIP5 ? ['--ship5'] : []), '--cap', String(CAP), '--set', JSON.stringify(SET)], { stdout: 'ignore', stderr: 'pipe' });
    const err = await new Response(pr.stderr).text(); await pr.exited;
    try { const o: Out = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); outs.push(o); console.error(`  ${j.scn}:${j.seed} ${o.end} ${o.secs} s · max ${f2(o.max)} ms`); }
    catch { console.error(`  ${j.scn}:${j.seed} left no result — ${err.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`); outs.push({ scn: j.scn, seed: j.seed, hard: HARD, end: 'error', why: err.slice(-200), secs: 0, digests: [], frames: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0, over4: 0, over8: 0, over16: 0, gcFrames: 0, gcMeanMs: 0, gcMaxMs: 0, noise: 0, same: true, passes: 0, worst: [], labels: [] }); } } };
  await Promise.all(Array.from({ length: jobs }, worker));
  outs.sort((a, b) => ids.indexOf(a.scn) - ids.indexOf(b.scn) || a.seed - b.seed);
  for (const o of outs) printRun(o, false);
  // the one table: per run, the step's percentiles and its three worst frames' first cause
  console.log(`\n${'run'.padEnd(22)}  frames   mean    p99    max  >4ms >8ms  gc-frames  worst three: ms @ game s — the biggest self time`);
  for (const o of outs) console.log(`${`${o.scn}:${o.seed}${o.hard ? ' H' : ''}`.padEnd(22)} ${String(o.frames).padStart(6)} ${f2(o.mean).padStart(6)} ${f2(o.p99).padStart(6)} ${f2(o.max).padStart(6)} ${String(o.over4).padStart(5)} ${String(o.over8).padStart(4)} ${f1(o.gcFrames).padStart(6)}     ${o.worst.slice(0, 3).map(w => `${f1(w.ms)} @${f1(w.t)}${w.gc ? ' gc' : ''} ${(w.what[0]?.[0] ?? '').replace(/^· /, '').replace(/: .*/, '')} ${f1(w.what[0]?.[1] ?? 0)}${lead(w)}`).join(' | ')}`);
  // …and across every run: what leads the worst frames
  { const lead = new Map<string, [number, number]>(); for (const o of outs) for (const w of o.worst) { const k = (w.what[0]?.[0] ?? '?').replace(/^· /, '').replace(/: .*/, '').replace(/updateGuard .*/, 'updateGuard <a man>'); const e = lead.get(k) ?? [0, 0]; e[0]++; e[1] = Math.max(e[1], w.ms); lead.set(k, e); }
    console.log(`\nwhat leads the ${TOP} worst frames of each run (${outs.length} runs): ${[...lead].sort((a, b) => b[1][0] - a[1][0]).slice(0, 14).map(([k, [n, m]]) => `${k} ×${n} (worst ${f1(m)} ms)`).join(' · ')}`);
    const gcw = outs.reduce((a, o) => a + o.worst.filter(w => w.gc).length, 0), all = outs.reduce((a, o) => a + o.worst.length, 0); console.log(`a collection ended inside ${gcw} of those ${all} frames`); }
  let bad = outs.filter(o => o.end === 'error' || o.end === 'stalled').length;
  for (const o of outs) if (!o.digests.every(d => d === o.digest)) { bad++; console.log(`${o.scn}:${o.seed} — its passes do not agree by digest: ${o.digests.join(' ')}`); }
  if (flag('--base')) { const B = JSON.parse(readFileSync(flag('--base')!, 'utf8')).runs as any[]; let eq = 0, ne = 0, miss = 0;
    for (const o of outs) { const b = B.find(x => x.scn === o.scn && x.seed === o.seed); if (!b?.digest) { miss++; continue; } if (b.digest === o.digest) eq++; else { ne++; console.log(`  DIFFERS ${o.scn}:${o.seed} ${o.digest} ≠ base ${b.digest}`); } }
    console.log(`${eq} runs equal the base by digest, ${ne} differ${miss ? `, ${miss} not in the base file` : ''}`); bad += ne; }
  { const want = SHIP ? 'shipped' : SHIP5 ? 'frozen' : null, got = [...new Set(outs.map(o => o.stand).filter(Boolean))], off = want ? outs.filter(o => o.stand && o.stand !== want).length : 0; bad += off;
    console.log(`stand: ${got.length ? `the ${got.join(' AND the ')} stand, as the runs reported` : 'no run reported one'}${SHIP5 ? " · round one's five words raised over it (--ship5: not what the page plays now)" : SHIP ? ' (--ship: what the page plays)' : ' (no --ship: the stand this tool\'s own environment names)'}${off ? ` — ${off} RUNS NOT ON THE ${want!.toUpperCase()} STAND THIS ARM ASKS FOR` : ''}`); }
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ top: TOP, warm: WARM, arm: SHIP ? 'ship' : SHIP5 ? 'ship5' : 'harness', set: SET, runs: outs }, null, 1));
  console.log(`\n${outs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  process.exit(bad ? 1 : 0);
}
