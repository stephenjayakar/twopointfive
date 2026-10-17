// THE ROLLBACK SNAPSHOT (src/game/rollback.ts, src/math/side.ts): can any moment of a fight be taken, put back, and played on exactly as the unbroken run?
//   bun run tools/qa/rollback-check.ts                       the rule's static pass, then every run of the default set; exit 0 = all pass, 1 = something failed (named)
//   TPS_PROFILE=shipped bun run tools/qa/rollback-check.ts   the same on the shipped stand (the page as it opens); the plain call is the frozen stand
//   ROLLBACK_BREAK=1 bun run tools/qa/rollback-check.ts      the red path: after every restore the lowest bit of one moving man's position is flipped — 'plays on exactly' must then FAIL
//   --scn id,id   --seeds 1,2   --cap 90   --every 4   --ticks 120   --jobs 3   --static (the static pass alone)   --times (one run's take / restore times and bytes, nothing else running)
// WHAT A RUN HOLDS (a scripted play-through of a scenario — tools/qa/playthrough.ts's commander, on the floor with his team — with the game on its own die, as the page):
//   moments        every `--every` seconds of the run, and besides the first few frames that find a round in the air, a leaf swinging, a can or a charge on its fuse or
//                  in flight, a man falling: the game is taken (takeSnapshot) as that tick is about to begin
//   unbroken       from there the game is stepped `--ticks` ticks off the player's last record held (Game.step, the light set and the box world's CPU side as the host
//                  does them), the whole state folded to a word after every tick (stateHash: every number by its raw bits)
//   same game      the snapshot is put back into the SAME game: the state is the word it was at the moment (statics and all), and the same ticks give the same word
//                  after every one
//   fresh game     the snapshot is put into ANOTHER game stood up on the same scenario and seed and never stepped (the first moment; the same one again afterwards,
//                  wherever the last moment left it): the same word at the moment, the same word after every tick
//   the run itself the snapshot is put back once more and the play-through goes on; at its end the run's own digest (game/digest.ts every half second, folded) and its
//                  last state word are those of the SAME run played with no moment taken at all — a run rolled back dozens of times is the run never touched
// A FAIL names the moment, the first tick that differs and (re-run with --why scn:seed:frame) the paths of the values that differ there.
// NOT HELD HERE: the page (no GPU in the cloud: the smoke solver's fields and the GPU light meter's readings in flight are the host's and are not in a snapshot), a snapshot
// sent to another process (it holds references, not bytes), and the commander's own orders inside the ticks compared (they are stepped off one held record).
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { play, entryOf } from './playthrough.ts';
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const { takeSnapshot, restoreSnapshot, stateHash, stateFlat, flatDiff, stateRawWeak, snapshotBytes, stateFunctions } = await import(`${ROOT}/src/game/rollback.ts`) as typeof import('../../src/game/rollback.ts');
const { cmdText, cmdFromText } = await import(`${ROOT}/src/game/cmd.ts`);

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const KNOWN = ['--scn', '--seeds', '--cap', '--every', '--ticks', '--jobs', '--static', '--times', '--one', '--out', '--why', '--arm'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const BREAK = process.env.ROLLBACK_BREAK === '1';
const DT = 1 / 60, CAP = Number(flag('--cap') ?? 75), EVERY = Number(flag('--every') ?? 5), TICKS = Number(flag('--ticks') ?? 120);
/** the default set: a solo night, a pair, the four in two pairs, a rescue, a room fight with walls to blow, a quiet two */
const DEFAULT = ['night-breach', 'room-clear-pair', 'room-clear-four', 'hostage-rescue', 'compound-four', 'defuse-four', 'quiet-yard-alone', 'quiet-crossing-two'];

interface Moment { frame: number; t: number; why: string; same: number; fresh: number; back: boolean; backFull: boolean; freshAt: boolean; takeMs: number; restoreMs: number; freshMs: number; bytes: number; objects: number }
interface Out { scn: string; seed: number; arm: string; end: string; t: number; digest: string; last: string; frames: number; moments: Moment[]; rawWeak: string[]; why: string[]; fns: Record<string, number>; error?: string }

/** what is in the air at this tick: the kinds of moment worth taking besides the clock's (each kind a few times a run) */
function airborne(g: any): string[] {
  const out: string[] = [];
  if (g.tracers?.pool?.some?.((t: any) => t.alive)) out.push('round in the air');
  if (g.doors?.list?.some?.((d: any) => Math.abs(d.vel ?? d.angVel ?? 0) > 0.05)) out.push('leaf swinging');
  if (g.items?.items?.some?.((i: any) => i.flying || (i.fuse ?? 0) > 0)) out.push('can in flight or on its fuse');
  if (g.guards?.some?.((m: any) => m.rag && !m.rag.asleep && m.state === 'dead')) out.push('man falling');
  if (g.wallCharge?.live?.length || g.doorTools?.charges?.length) out.push('charge set');
  return out;
}

class Stop extends Error {}
/** one play-through of `scn:seed` under an arm: 'plain' = nothing taken; 'moments' = taken, compared and put back as the head says */
async function run(scn: string, seed: number, arm: 'plain' | 'moments', why: number | null): Promise<Out> {
  const out: Out = { scn, seed, arm, end: 'error', t: 0, digest: '', last: '', frames: 0, moments: [], rawWeak: [], why: [], fns: {} };
  process.env.TPS_SEED = String(seed); process.env.PT_DIGEST = '1';
  const update = Game.prototype.update;
  let other: any = null, mode: 'grab' | 'run' = 'grab', main: any = null, frame = 0, nextAt = 2, seenKinds = new Map<string, number>();
  const silent = { play() {}, footstep() {} };
  const tick = (g: any, cmd: unknown): void => { g.step(DT, cmd); g.engine.lights.update(DT, g.time); g.engine.world.dynamics = g.dynBoxes; g.engine.world.upload(); };
  const moment = (g: any, reason: string): void => {
    const cmd = cmdFromText(cmdText(g.cmdBuf));
    let t0 = performance.now(); const S = takeSnapshot(g); const takeMs = performance.now() - t0;
    const size = snapshotBytes(S), h0 = stateHash(g), f0 = stateHash(g, true);
    const tap = g.replayTap; g.replayTap = null; g.audio = silent;
    const ref: string[] = []; let flatRef: any = null;
    for (let j = 0; j < TICKS; j++) { tick(g, cmd); ref.push(stateHash(g)); if (why === frame && j === WHY_TICK) { flatRef = stateFlat(g); if (process.env.WHY_EVENTS) out.why.push('unbroken events: ' + JSON.stringify(g.events.map((e: any) => ({ ...e, source: e.source?.name ?? e.source?.id, by: undefined })), (_k, v) => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype ? '[obj]' : v).slice(0, 1500)); } }
    t0 = performance.now(); restoreSnapshot(S); const restoreMs = performance.now() - t0;
    const back = stateHash(g) === h0, backFull = stateHash(g, true) === f0;
    if (BREAK) { const m = g.guards.find((x: any) => x.state !== 'dead') ?? g.player; const p = m.char.pos; const f = new Float64Array([p[0]]), u = new Uint32Array(f.buffer); u[0] ^= 1; p[0] = f[0]; }
    g.replayTap = null; g.audio = silent;
    let same = -1; for (let j = 0; j < TICKS; j++) { tick(g, cmd); if (stateHash(g) !== ref[j]) { same = j; break; } if (why === frame && j === WHY_TICK && flatRef) out.why.push(...flatDiff(flatRef, stateFlat(g), 30).map(x => 'same game · ' + x)); }
    if (why === frame && same >= 0 && same <= WHY_TICK && flatRef === null) out.why.push('(ask for a tick at or before the first that differs)');
    if (why === frame && same === WHY_TICK && flatRef) out.why.push(...flatDiff(flatRef, stateFlat(g), 30).map(x => 'same game · ' + x));
    // the other game: stood up on the same scenario and seed, never stepped by the play-through
    let fresh = -1, freshAt = true, freshMs = 0;
    if (other) {
      restoreSnapshot(S);   // (this game back at the moment first: the module variables and the named tables the two games share are then the moment's)
      t0 = performance.now(); restoreSnapshot(S, other); freshMs = performance.now() - t0;
      other.dice.sys = g.dice.sys;   // (the die's 'Math.random as it was when I was made' is the play-through's of THIS run: the other game was stood up under an earlier one)
      freshAt = stateHash(other) === h0;
      if (!freshAt && why === frame) { restoreSnapshot(S); out.why.push(...flatDiff(stateFlat(g), stateFlat(other), 30).map(x => 'fresh game at the moment · ' + x)); }
      other.replayTap = null; other.audio = silent;
      if (BREAK) { const m = other.guards.find((x: any) => x.state !== 'dead') ?? other.player; const p = m.char.pos; const f = new Float64Array([p[0]]), u = new Uint32Array(f.buffer); u[0] ^= 1; p[0] = f[0]; }
      for (let j = 0; j < TICKS; j++) { tick(other, cmd); if (stateHash(other) !== ref[j]) { fresh = j; break; }
        if (why === frame && j === WHY_TICK && flatRef) { out.why.push(...flatDiff(flatRef, stateFlat(other), 30).map(x => 'fresh game · ' + x)); if (process.env.WHY_EVENTS) out.why.push('fresh events: ' + JSON.stringify(other.events.map((e: any) => ({ ...e, source: e.source?.name ?? e.source?.id, by: undefined })), (_k, v) => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype ? '[obj]' : v).slice(0, 1500)); } }
      if (why === frame && fresh === WHY_TICK && flatRef) out.why.push(...flatDiff(flatRef, stateFlat(other), 30).map(x => 'fresh game · ' + x));
    }
    restoreSnapshot(S); g.replayTap = tap;
    for (const [k, n] of stateFunctions(g)) out.fns[k] = Math.max(out.fns[k] ?? 0, n);
    out.moments.push({ frame, t: +g.time.toFixed(2), why: reason, same, fresh, back, backFull, freshAt, takeMs: +takeMs.toFixed(2), restoreMs: +restoreMs.toFixed(2), freshMs: +freshMs.toFixed(2), bytes: size.bytes, objects: size.objects });
  };
  Game.prototype.update = function (this: any, ...a: unknown[]) {
    if (mode === 'grab') { other = this; throw new Stop(); }
    if (main === null) { main = this; frame = 0; }
    if (this === main) {
      if (arm === 'moments' && this.cmdBuf && frame > 30) {
        const kinds = airborne(this).filter(k => (seenKinds.get(k) ?? 0) < 3 && frame - (lastOf.get(k) ?? -1e9) > 90);
        const due = this.time >= nextAt;
        if (why !== null && !WHY_ALL ? frame === why : due || kinds.length) {
          if (due) nextAt = this.time + EVERY;
          for (const k of kinds) { seenKinds.set(k, (seenKinds.get(k) ?? 0) + 1); lastOf.set(k, frame); }
          moment(this, [due ? 'clock' : '', ...kinds].filter(Boolean).join(' + '));
        }
      }
      frame++; out.last = '';
    }
    return (update as (...x: unknown[]) => unknown).apply(this, a);
  } as typeof update;
  const lastOf = new Map<string, number>();
  try {
    if (arm === 'moments') { try { await play(scn, seed, CAP, false, {}); } catch (e) { if (!(e instanceof Stop)) throw e; } if (!other) throw new Error('the other game was never stood up'); }
    mode = 'run';
    const r = await play(scn, seed, CAP, false, {});
    out.end = r.end; out.t = r.t; out.digest = String((r as any).digest ?? ''); out.frames = frame;
    if (r.end === 'error') out.error = r.why;
    if (main) { out.last = stateHash(main); out.rawWeak = stateRawWeak(main).slice(0, 20); }
  } catch (e) { out.error = String((e as Error)?.stack ?? e); }
  finally { Game.prototype.update = update; }
  return out;
}
const WHY_ALL = process.env.WHY_ALL === '1';   // (--why with every earlier moment taken too: the other game is then as used as it was in the run that failed)
const WHY_TICK = Number((flag('--why') ?? '').split(':')[3] ?? 0);

if (flag('--one')) {
  const [scn, seed] = flag('--one')!.split(':');
  const q = console.log; console.log = console.warn = () => {};
  const r = await run(scn, Number(seed), (flag('--arm') ?? 'moments') as 'plain' | 'moments', null);
  console.log = q; writeFileSync(flag('--out')!, JSON.stringify(r)); process.exit(0);
}
if (flag('--why')) {
  const [scn, seed, frame] = flag('--why')!.split(':');
  const q = console.log; console.log = console.warn = () => {};
  const r = await run(scn, Number(seed), 'moments', Number(frame));
  console.log = q; for (const m of r.moments) console.log(JSON.stringify(m)); console.log(r.why.join('\n') || '(nothing differs there)'); if (r.error) console.log(r.error); process.exit(0);
}

const ids = (flag('--scn') ?? DEFAULT.join(',')).split(','), seeds = (flag('--seeds') ?? '1').split(',').map(Number), jobs = Math.max(1, Number(flag('--jobs') ?? 3));
for (const id of ids) if (!entryOf(id)) { console.error(`no scenario '${id}'`); process.exit(2); }
let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
console.log(`\n=== rollback-check: ${process.env.TPS_PROFILE === 'shipped' ? 'the shipped stand' : 'the frozen stand'}${BREAK ? ' · ROLLBACK_BREAK=1 (every line below should FAIL but the static pass and the plain facts)' : ''} · ${ids.length} scenarios × seeds ${seeds.join(',')} · a moment every ${EVERY} s · ${TICKS} ticks compared · runs capped at ${CAP} s ===`);

if (!argv.includes('--static')) {
  const todo = ids.flatMap(scn => seeds.flatMap(seed => (['moments', 'plain'] as const).map(arm => ({ scn, seed, arm })))); const res = new Map<string, Out>(); let next = 0;
  const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
    const file = resolve(tmpdir(), `rollback-${process.pid}-${j.scn}-${j.seed}-${j.arm}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.scn}:${j.seed}`, '--arm', j.arm, '--out', file, '--cap', String(CAP), '--every', String(EVERY), '--ticks', String(TICKS)], { stdout: 'ignore', stderr: 'pipe' });
    const errText = await new Response(pr.stderr).text(); await pr.exited;
    let r: Out; try { r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); } catch { r = { scn: j.scn, seed: j.seed, arm: j.arm, end: 'error', t: 0, digest: '', last: '', frames: 0, moments: [], rawWeak: [], why: [], fns: {}, error: `the run left no result — ${errText.trim().split('\n').slice(-3).join(' / ').slice(0, 400)}` }; }
    res.set(`${j.scn}:${j.seed}:${j.arm}`, r); console.error(`  ${j.scn}:${j.seed} ${j.arm} ${r.end} ${r.t} s · ${r.moments.length} moments${r.error ? ' — ' + r.error.split('\n')[0] : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  const takes: number[] = [], restores: number[] = [], bytes: number[] = [], objs: number[] = [];
  for (const scn of ids) for (const seed of seeds) {
    const m = res.get(`${scn}:${seed}:moments`)!, p = res.get(`${scn}:${seed}:plain`)!, id = `${scn}:${seed}`;
    if (m.error || p.error) { verdict(false, `${id} plays`, (m.error ?? p.error)!.split('\n').slice(0, 3).join(' / ')); continue; }
    const n = m.moments.length, kinds = new Map<string, number>(); for (const x of m.moments) for (const k of x.why.split(' + ')) kinds.set(k, (kinds.get(k) ?? 0) + 1);
    const first = (f: (x: Moment) => boolean, say: (x: Moment) => string): string => { const bad = m.moments.filter(f); return bad.length ? `${bad.length} of ${n} — the first at frame ${bad[0].frame} (${bad[0].t} s, ${bad[0].why}): ${say(bad[0])} · --why ${id}:${bad[0].frame}` : `all ${n}`; };
    verdict(n > 0 && m.moments.every(x => x.back && x.backFull), `${id} put back: the state is the word it was at the moment`, `${first(x => !x.back || !x.backFull, x => x.back ? 'the statics differ' : 'the state differs')} (${[...kinds].map(([k, c]) => `${k} ${c}`).join(', ')})`);
    verdict(n > 0 && m.moments.every(x => x.same < 0), `${id} same game: ${TICKS} ticks on from the snapshot are the unbroken run's, every tick to the bit`, first(x => x.same >= 0, x => `tick ${x.same} differs`));
    verdict(n > 0 && m.moments.every(x => x.fresh < 0 && x.freshAt), `${id} fresh game: the snapshot in another game plays the same ${TICKS} ticks, every tick to the bit`, first(x => x.fresh >= 0 || !x.freshAt, x => x.freshAt ? `tick ${x.fresh} differs` : 'the state differs at the moment'));
    verdict(m.digest !== '' && m.digest === p.digest && m.last === p.last && m.end === p.end && m.t === p.t, `${id} the run rolled back ${3 * n} times is the run never touched`, `digest ${m.digest} | ${p.digest} · last state ${m.last} | ${p.last} · ${m.end} at ${m.t} s | ${p.end} at ${p.t} s`);
    verdict(m.rawWeak.length === 0, `${id} no plain WeakMap or WeakSet in the state`, m.rawWeak.join(' · ') || 'none met');
    for (const x of m.moments) { takes.push(x.takeMs); restores.push(x.restoreMs); bytes.push(x.bytes); objs.push(x.objects); }
  }
  const q = (a: number[], f: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(f * a.length))] : 0;
  console.log(`  (times with ${jobs} runs at once on this box — --times measures alone: take ${q(takes, 0.5).toFixed(1)} ms median / ${q(takes, 0.95).toFixed(1)} p95 · restore ${q(restores, 0.5).toFixed(1)} / ${q(restores, 0.95).toFixed(1)} · ${(q(bytes, 0.5) / 1e6).toFixed(2)} MB median / ${(q(bytes, 1) / 1e6).toFixed(2)} max · ${q(objs, 0.5)} objects median)`);
}
console.log(`=== rollback-check: ${fails ? `${fails} FAILED` : 'ALL PASS'} ===`);
process.exit(fails ? 1 : 0);
