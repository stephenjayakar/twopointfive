// THE ROLLBACK SNAPSHOT (src/game/rollback.ts, src/math/side.ts): can any moment of a fight be taken, put back, and played on exactly as the unbroken run?
//   bun run tools/qa/rollback-check.ts                       the rule's static pass, then every run of the default set; exit 0 = all pass, 1 = something failed (named)
//   TPS_PROFILE=shipped bun run tools/qa/rollback-check.ts   the same on the shipped stand (the page as it opens); the plain call is the frozen stand
//   ROLLBACK_BREAK=1 bun run tools/qa/rollback-check.ts      the red path: after every restore the lowest bit of one moving man's position is flipped — 'plays on exactly' must then FAIL
//                                                            (and the light meter's GPU side is made a plain object the snapshot walks: 'the host's own' must FAIL)
//   --scn id,id   --seeds 1,2   --cap 90   --every 4   --ticks 120   --jobs 3   --static (the static pass alone)   --times scn:seed:frame (the times and bytes at one frame of one run, alone on the box)
// WHAT A RUN HOLDS (a scripted play-through of a scenario — tools/qa/playthrough.ts's commander, on the floor with his team — with the game on its own die, as the page):
//   moments        every `--every` seconds of the run, and besides the first few frames that find a round in the air, a leaf swinging, a can or a charge on its fuse or
//                  in flight, a man falling: the game is taken (takeSnapshot) as that tick is about to begin
//   unbroken       from there the game is stepped `--ticks` ticks off the player's last record held (Game.step, the light set and the box world's CPU side as the host
//                  does them), the whole state folded to a word after every tick (stateHash: every number by its raw bits)
//   same game      the snapshot is put back into the SAME game: the state is the word it was at the moment (statics and all), and the same ticks give the same word
//                  after every one
//   the host's own what the host keeps on a GPU object the game holds is NOT put back: a mark left among the light meter's free buffers after the snapshot is still
//                  there after the restore (render/probe.ts: put back, a page's meter would hand the GPU a buffer that is still out on a readback)
//   the ring       a snapshot is taken after every one of those ticks, each SINCE the one before (what did not change is shared, not copied); the one eight ticks
//                  from the end is put back: the word of that tick, and the eight ticks after it again, to the bit
//   fresh game     the snapshot is put into ANOTHER game stood up on the same scenario and seed and stepped once (the first moment; the same one again afterwards,
//                  wherever the last moment left it): the same word at the moment, the same word after every tick
//                  — or, where the word parts, the two games side by side value for value (stateAlike: every number to the bit, but not WHICH object stands
//                  somewhere — this game points at a module's constant row the other had not reached, which then holds its own equal copy); the line says how many
//   two games      while the other game plays those ticks this game's OWN state (stateHash's `own`: without the modules' registered variables and containers, which
//                  every game in the process shares) stays the word it was: the two share nothing live
//   the run itself the snapshot is put back once more and the play-through goes on; at its end the run's own digest (game/digest.ts every half second, folded) and its
//                  last state word are those of the SAME run played with no moment taken at all — a run rolled back dozens of times is the run never touched
// A FAIL names the moment, the first tick that differs and (re-run with --why scn:seed:frame) the paths of the values that differ there.
// RB_LAST_DUMP=<file> (with RB_LAST_DEPTH, RB_LAST_PRE) on a --one run writes the last state's word per part: two arms' files side by side say where their
// last states part.
// NOT HELD HERE: the page (no GPU in the cloud: the smoke solver's fields and the GPU light meter's buffers and readings in flight are the host's and are not in a snapshot; one load of a save in memory was driven on a page under the software adapter, docs/agents/replays.md), a snapshot
// sent to another process (it holds references, not bytes), and the commander's own orders inside the ticks compared (they are stepped off one held record).
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { play, entryOf } from './playthrough.ts';
import { ROLLBACK_EXEMPT, RAW_WEAK_OK, GENERATOR_OK } from './rollback-exempt.ts';
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const { takeSnapshot: take0, restoreSnapshot: restore0, stateHash, stateFlat, flatDiff, stateAlike, stateRawWeak, snapshotBytes, stateFunctions } = await import(`${ROOT}/src/game/rollback.ts`) as typeof import('../../src/game/rollback.ts');
const { cmdText, cmdFromText } = await import(`${ROOT}/src/game/cmd.ts`);
// THE SAVES' SHELF IS THE HOST'S (savestate.ts MemShelf, a HostOwned: the saves kept in memory are in no snapshot, so that a load does not take the later saves
// away). Whoever rolls a game back has to put the shelf back with it: played again, an autosave inside the window lands in the NEXT slot, and the slot's name is in
// the state — 'same game' parted there on the shipped stand, one autosave inside one moment's ticks. So the check, as the host: every snapshot it takes remembers
// the shelf beside it, and a put back (into either game) puts that shelf back too. (The field renamed or gone: nothing is remembered and that line is red again.)
const SHELF = new WeakMap<object, { all: unknown[]; last: unknown }>();
const shelfOf = (g: any): { all(): any[]; clear(): void; set(k: string, e: unknown): void; last: unknown } | null => { const sh = g?.saves?.shelf; return sh && typeof sh.all === 'function' ? sh : null; };
const takeSnapshot = (g: any, since?: any): any => { const S = take0(g, since); const sh = shelfOf(g); if (sh) SHELF.set(S, { all: sh.all(), last: sh.last }); return S; };   // (…and the snapshot the next save in memory would be taken since — SAVETIMELINE.since)
const restoreSnapshot = (S: any, other?: any): void => { if (other) restore0(S, other); else restore0(S); const sh = shelfOf(other ?? S.game), kept = SHELF.get(S); if (sh && kept) { sh.clear(); for (const e of kept.all as any[]) sh.set(e.info.key, e); sh.last = kept.last; } };

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const KNOWN = ['--scn', '--seeds', '--cap', '--every', '--ticks', '--jobs', '--static', '--times', '--one', '--out', '--why', '--arm'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const BREAK = process.env.ROLLBACK_BREAK === '1';
/** the break word, for 'the host's own': the meter's GPU side is made a plain object before the first snapshot, so the snapshot walks it and puts it back as it did
 *  before it was the host's — the mark must then be gone */
const unhost = (g: any): void => { const pl = g.probe?.plumbing; if (pl) Object.setPrototypeOf(pl, Object.prototype); };
const DT = 1 / 60, CAP = Number(flag('--cap') ?? 45), EVERY = Number(flag('--every') ?? 6), TICKS = Number(flag('--ticks') ?? 60);
/** the default set: a solo night, a pair, the four in two pairs, a rescue, a compound, charges on a clock, two squads, walls to blow */
const DEFAULT = ['night-breach', 'room-clear-pair', 'room-clear-four', 'hostage-rescue', 'compound-four', 'defuse-four', 'block-squads', 'mousehole-four'];

interface Moment { frame: number; t: number; why: string; same: number; fresh: number; /** the tick the other game's strict word parted at though it stayed alike value for value (−1 = it never parted) */ alias: number; /** the other game's ticks changed this game's own state: the two share something live */ leak: boolean; ring: number; back: boolean; backFull: boolean; /** what the host keeps on a GPU object of the game's (the light meter's buffers) is as it was left, not as the snapshot saw it */ host: boolean; freshAt: boolean; takeMs: number; tickTakeMs: number; restoreMs: number; freshMs: number; stepMs: number; bytes: number; own: number; objects: number }
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
/** the red path's hand: the lowest bit of one moving man's position, flipped */
function flip(g: any): void { const m = g.guards.find((x: any) => x.state !== 'dead') ?? g.player; const p = m.char.pos; const f = new Float64Array([p[0]]), u = new Uint32Array(f.buffer); u[0] ^= 1; p[0] = f[0]; }
/** one play-through of `scn:seed` under an arm: 'plain' = nothing taken; 'moments' = taken, compared and put back as the head says */
async function run(scn: string, seed: number, arm: 'plain' | 'moments', why: number | null): Promise<Out> {
  const out: Out = { scn, seed, arm, end: 'error', t: 0, digest: '', last: '', frames: 0, moments: [], rawWeak: [], why: [], fns: {} };
  process.env.TPS_SEED = String(seed); process.env.PT_DIGEST = '1';
  const update = Game.prototype.update;
  let other: any = null, mode: 'grab' | 'run' = 'grab', main: any = null, frame = 0, nextAt = 2, seenKinds = new Map<string, number>(), lastS: any = undefined;
  const silent = { play() {}, footstep() {} };
  const tick = (g: any, cmd: unknown): void => { g.step(DT, cmd); g.engine.lights.update(DT, g.time); g.engine.world.dynamics = g.dynBoxes; g.engine.world.upload(); };
  const moment = (g: any, reason: string): void => {
    const cmd = cmdFromText(cmdText(g.cmdBuf));
    let t0 = performance.now(); const S = takeSnapshot(g, lastS); const takeMs = performance.now() - t0; lastS = S;   // (since the last moment's, seconds ago: what did not change in between is shared)
    const size = snapshotBytes(S), h0 = stateHash(g), f0 = stateHash(g, true);
    const tap = g.replayTap; g.replayTap = null; g.audio = silent;
    const ref: string[] = []; let flatRef: any = null;
    const ring: any[] = [], tickTake: number[] = [], own: number[] = [], steps: number[] = [];   // a snapshot after every tick, each taken since the one before: what a rollback ring holds
    for (let j = 0; j < TICKS; j++) { let t1 = performance.now(); tick(g, cmd); steps.push(performance.now() - t1); ref.push(stateHash(g));
      t1 = performance.now(); const R = takeSnapshot(g, ring[j - 1] ?? S); tickTake.push(performance.now() - t1); own.push(snapshotBytes(R, ring[j - 1] ?? S).own); ring.push(R); if (why === frame && j === WHY_TICK) { flatRef = stateFlat(g); if (process.env.WHY_EVENTS) out.why.push('unbroken events: ' + JSON.stringify(g.events.map((e: any) => ({ ...e, source: e.source?.name ?? e.source?.id, by: undefined })), (_k, v) => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype ? '[obj]' : v).slice(0, 1500)); } }
    // the ring: eight ticks back from the end is put back (a snapshot that shares most of itself with its neighbours) and the eight play out again
    let ringBad = -1, restoreMs = 0;
    if (TICKS >= 10) { const k = TICKS - 9; t0 = performance.now(); restoreSnapshot(ring[k]); restoreMs = performance.now() - t0;
      if (stateHash(g) !== ref[k]) ringBad = 0; else { if (BREAK) flip(g); for (let j = k + 1; j < TICKS; j++) { tick(g, cmd); if (stateHash(g) !== ref[j]) { ringBad = j - k; break; } } } }
    // the host's own: the light meter is a GPU object the Game holds, and its GPU side (render/probe.ts Plumbing: the buffers out on a readback, the ones free, what
    // it last sent) is a HostOwned — a mark left among its free buffers after the snapshot must still be there once the snapshot is back (a page's meter put back
    // handed the GPU a buffer still mapped). No meter, or none with that side: the line FAILS — it would be holding nothing.
    const pool: unknown[] | null = Array.isArray(g.probe?.plumbing?.readbacks) ? g.probe.plumbing.readbacks : null, mark = {}; pool?.push(mark);
    restoreSnapshot(S);
    const host = !!pool && g.probe.plumbing.readbacks === pool && pool.includes(mark); if (pool && pool.includes(mark)) pool.splice(pool.indexOf(mark), 1);
    const back = stateHash(g) === h0, backFull = stateHash(g, true) === f0;
    if (BREAK) flip(g);
    g.replayTap = null; g.audio = silent;
    let same = -1; for (let j = 0; j < TICKS; j++) { tick(g, cmd); if (stateHash(g) !== ref[j]) { same = j; break; } if (why === frame && j === WHY_TICK && flatRef) out.why.push(...flatDiff(flatRef, stateFlat(g), 30).map(x => 'same game · ' + x)); }
    if (why === frame && same >= 0 && same <= WHY_TICK && flatRef === null) out.why.push('(ask for a tick at or before the first that differs)');
    if (why === frame && same === WHY_TICK && flatRef) out.why.push(...flatDiff(flatRef, stateFlat(g), 30).map(x => 'same game · ' + x));
    // the other game: stood up on the same scenario and seed, never stepped by the play-through
    let fresh = -1, freshAt = true, freshMs = 0, alias = -1, leak = false;
    if (other) {
      restoreSnapshot(S);   // (this game back at the moment first: the module variables and the named tables the two games share are then the moment's)
      t0 = performance.now(); restoreSnapshot(S, other); freshMs = performance.now() - t0;
      const mine = stateHash(g, false, true);   // (this game's own state: the other game's ticks below must leave it as it is, or the two share something live)
      other.dice.sys = g.dice.sys;   // (the die's 'Math.random as it was when I was made' is the play-through's of THIS run: the other game was stood up under an earlier one)
      freshAt = stateHash(other) === h0;
      if (!freshAt && why === frame) { restoreSnapshot(S); out.why.push(...flatDiff(stateFlat(g), stateFlat(other), 30).map(x => 'fresh game at the moment · ' + x)); }
      other.replayTap = null; other.audio = silent;
      if (BREAK) flip(other);
      for (let j = 0; j < TICKS; j++) { tick(other, cmd); if (stateHash(other) !== ref[j]) { fresh = j; break; }
        if (why === frame && j === WHY_TICK && flatRef) { out.why.push(...flatDiff(flatRef, stateFlat(other), 30).map(x => 'fresh game · ' + x)); if (process.env.WHY_EVENTS) out.why.push('fresh events: ' + JSON.stringify(other.events.map((e: any) => ({ ...e, source: e.source?.name ?? e.source?.id, by: undefined })), (_k, v) => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype ? '[obj]' : v).slice(0, 1500)); } }
      if (why === frame && fresh === WHY_TICK && flatRef) out.why.push(...flatDiff(flatRef, stateFlat(other), 30).map(x => 'fresh game · ' + x));
      if (stateHash(g, false, true) !== mine) { leak = true; if (why === frame) { const now = stateFlat(g, false, true); restoreSnapshot(S); out.why.push(...flatDiff(stateFlat(g, false, true), now, 12).map(x => 'the other game\'s ticks moved THIS game · ' + x)); } }
      // the strict word parted. The state, or only WHICH object stands somewhere? (This game points at a module's constant row the other had not reached when it was
      // handed the state: its own equal copy stands there, and its own ticks then point at the row itself.) The other game from the moment again, and at every tick
      // from the one that parted this game is put at that tick out of the ring and the two are gone through side by side, value for value (stateAlike)
      if (fresh >= 0) {
        const k = fresh; restoreSnapshot(S); restoreSnapshot(S, other); other.dice.sys = g.dice.sys; other.replayTap = null; other.audio = silent;
        if (BREAK) flip(other);
        let bad = -1;
        for (let j = 0; j < TICKS && bad < 0; j++) { tick(other, cmd); if (j < k) continue;
          restoreSnapshot(ring[j]); const d = stateAlike(g, other, 8);
          if (d.length) { bad = j; if (why === frame) out.why.push(...d.map((x: string) => `fresh game, tick ${j}, value for value · ${x}`)); } }
        if (bad < 0) { alias = k; fresh = -1; if (why === frame) out.why.push(`fresh game · alike value for value through all ${TICKS} ticks: only which object stands there differs, from tick ${k}`); } else fresh = bad;
      }
    }
    restoreSnapshot(S); g.replayTap = tap;
    for (const [k, n] of stateFunctions(g)) out.fns[k] = Math.max(out.fns[k] ?? 0, n);
    const mid = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;
    out.moments.push({ frame, t: +g.time.toFixed(2), why: reason, same, fresh, alias, leak, ring: ringBad, back, backFull, host, freshAt, takeMs: +takeMs.toFixed(2), tickTakeMs: +mid(tickTake).toFixed(2), restoreMs: +restoreMs.toFixed(2), freshMs: +freshMs.toFixed(2), stepMs: +mid(steps).toFixed(2), bytes: size.bytes, own: mid(own), objects: size.objects });
  };
  Game.prototype.update = function (this: any, ...a: unknown[]) {
    if (mode === 'grab') { if (other === this) throw new Stop(); other = this; return (update as (...x: unknown[]) => unknown).apply(this, a); }   // (the other game takes ONE step and is stopped at its second: what a game hangs on its host at its first step — its own closures, which no snapshot carries — is then its own)
    if (main === null) { main = this; frame = 0; if (BREAK) unhost(this); }
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
    // (the other game is stood up under BOTH arms: a few counters are the process's, not the Game's — guards.unitSerial names every unit made — and the run never
    //  touched is the same run in the same process, less only the moments)
    { try { await play(scn, seed, CAP, false, {}); } catch (e) { if (!(e instanceof Stop)) throw e; } if (!other) throw new Error('the other game was never stood up'); }
    mode = 'run';
    const r = await play(scn, seed, CAP, false, {});
    out.end = r.end; out.t = r.t; out.digest = String((r as any).digest ?? ''); out.frames = frame;
    if (r.end === 'error') out.error = r.why;
    if (main && process.env.RB_LAST_DUMP) { const F = stateFlat(main), sec: Record<string, number> = {}, D = Number(process.env.RB_LAST_DEPTH ?? 2), pre = process.env.RB_LAST_PRE ?? '';
      for (let i = 0; i < F.toks.length; i++) { const pth = F.paths[i]; if (!pth.startsWith(pre)) continue; const k = pth.split(/(?=[.\[{<])/).slice(0, D).join(''); let h = sec[k] ?? 0; const t = String(F.toks[i]); for (let c = 0; c < t.length; c++) h = Math.imul(h ^ t.charCodeAt(c), 0x01000193); sec[k] = h; }
      writeFileSync(process.env.RB_LAST_DUMP, JSON.stringify(sec)); }
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
if (flag('--times')) {   // one run to a frame, then the numbers alone (nothing else should be running on the box): bun run tools/qa/rollback-check.ts --times room-clear-four:1:600
  const [scn, seed, at] = flag('--times')!.split(':'); const AT = Number(at ?? 600);
  process.env.TPS_SEED = seed ?? '1';
  const update = Game.prototype.update; let frame = 0; const say = (x: string) => process.stdout.write(x + '\n');
  const st = (a: number[]) => { a = [...a].sort((x, y) => x - y); return `${a[a.length >> 1].toFixed(2)} ms median · ${a[0].toFixed(2)} least · ${a[Math.floor(a.length * 0.95)].toFixed(2)} p95`; };
  Game.prototype.update = function (this: any, ...a: unknown[]) {
    if (++frame !== AT) return (update as (...x: unknown[]) => unknown).apply(this, a);
    const g = this; g.replayTap = null; g.audio = { play() {}, footstep() {} };
    const cmd = cmdFromText(cmdText(g.cmdBuf)), now = () => performance.now();
    const tick = (): void => { g.step(DT, cmd); g.engine.lights.update(DT, g.time); g.engine.world.dynamics = g.dynBoxes; g.engine.world.upload(); };
    const whole: number[] = []; let S: any; for (let i = 0; i < 9; i++) { const t = now(); S = takeSnapshot(g); whole.push(now() - t); }
    const b0 = snapshotBytes(S);
    say(`${scn}:${seed} at frame ${AT} (${g.time.toFixed(1)} s) — ${b0.objects} objects, ${(b0.bytes / 1e6).toFixed(2)} MB (${(b0.typed / 1e6).toFixed(2)} of typed arrays), ${b0.tables} side tables`);
    say(`  a whole snapshot (the first, and one every few seconds)   ${st(whole)}`);
    const steps: number[] = [], takes: number[] = [], own: number[] = [], changed: number[] = [], ring: any[] = [S]; let walks = 0;
    for (let i = 0; i < 300; i++) { let t = now(); tick(); steps.push(now() - t); t = now(); const N = takeSnapshot(g, S); takes.push(now() - t); if (N.chain !== S.chain) walks++; const b = snapshotBytes(N, S); own.push(b.own); changed.push(b.changed); S = N; ring.push(S); if (ring.length > 12) ring.shift(); }
    const mid = (x: number[]) => [...x].sort((p, r) => p - r)[x.length >> 1];
    say(`  a tick of the game                                        ${st(steps)}`);
    say(`  a snapshot after every tick, since the one before         ${st(takes)}   (${walks} of 300 by a whole walk · ${mid(changed)} objects and ${(mid(own) / 1e6).toFixed(2)} MB of its own a tick · holds ${S.at.length})`);
    const rest: number[] = [], roll: number[] = [], rollTaken: number[] = [];
    for (let k = 0; k < 20; k++) { const back = ring[ring.length - 9];
      let t = now(); restoreSnapshot(back); rest.push(now() - t);
      t = now(); restoreSnapshot(back); for (let j = 0; j < 8; j++) tick(); roll.push(now() - t);
      t = now(); restoreSnapshot(back); let P = back; for (let j = 0; j < 8; j++) { tick(); P = takeSnapshot(g, P); } rollTaken.push(now() - t); }
    say(`  eight ticks back put back                                 ${st(rest)}`);
    say(`  a rollback of eight ticks: put back + the eight ticks     ${st(roll)}`);
    say(`  … with a snapshot taken after each of the eight           ${st(rollTaken)}`);
    throw new Stop();
  } as typeof update;
  const q = console.log; console.log = console.warn = () => {};
  try { await play(scn, Number(seed ?? 1), 180, false, {}); } catch (e) { if (!(e instanceof Stop)) throw e; }
  console.log = q; if (frame < AT) console.log(`the run ended at frame ${frame}, before frame ${AT}`); process.exit(0);
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

// ---- THE STATIC PASS: the rule of src/math/side.ts, read off the source. What it does not look at: a class instance kept at the top of a module (`const X = new Thing()`:
// none in the simulation's folders today), a container handed to a callee that writes it (an out-parameter: scratch), state on a class's `static` field, and
// anything a closure has captured — one of those that carried state from tick to tick is what the runs below are for.
{
  const SIM = ['src/game', 'src/scene', 'src/anim', 'src/math'];
  /** … and the one file of the renderer's folder the game keeps state in: the wall raster's and the reach masks' side tables */
  const SIM_FILES = ['src/render/reach.ts'];
  const files = [...SIM.flatMap(d => readdirSync(resolve(ROOT, d)).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort().map(f => `${d}/${f}`)), ...SIM_FILES];
  const text = new Map(files.map(f => [f, readFileSync(resolve(ROOT, f), 'utf8')]));
  const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`); const KNOBS = new Set(Object.keys(knobRegistry()));
  interface Decl { file: string; line: number; kind: 'let' | 'const'; name: string; init: string; exported: boolean }
  const decls: Decl[] = [];
  /** is the `<` at `c` a type's bracket (`Map<string, T>`) and not a comparison (`i<n`)? Its `>` stands, outside any bracket opened after it, before the statement or a `&&` / `||` ends */
  const closes = (t: string, c: number): boolean => { let d = 0; for (let e = c + 1; e < t.length; e++) { const x = t[e];
    if (x === '(' || x === '[' || x === '{') d++; else if (x === ')' || x === ']' || x === '}') { if (--d < 0) return false; }
    else if (d > 0) continue; else if (x === '>') { if (t[e - 1] !== '=') return true; } else if (x === ';' || ((x === '&' || x === '|') && t[e + 1] === x)) return false; } return true; };
  /** the declarators of the top-level `let` / `const` statements of a file: the name, and what stands after its `=` */
  for (const [file, src] of text) {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let m = /^(export )?(let|const) /.exec(lines[i]); if (!m) continue;
      let rest = lines[i].slice(m[0].length);
      for (;;) {   // (a line may hold more than one statement: `let a: T; let b = 0;`)
      let stmt = rest, depth = 0, angle = 0, start = 0, k = i; const parts: string[] = []; rest = '';
      for (let c = 0; ; c++) {
        if (c >= stmt.length) { if (depth === 0 && angle === 0) break; if (++k >= lines.length || k - i > 400) break; stmt += '\n' + lines[k]; }
        const ch = stmt[c];
        if (ch === '/' && stmt[c + 1] === '/') { const e = stmt.indexOf('\n', c); if (e < 0) { stmt = stmt.slice(0, c); break; } stmt = stmt.slice(0, c) + stmt.slice(e); c--; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { let e = c + 1; while (e < stmt.length && stmt[e] !== ch) e += stmt[e] === '\\' ? 2 : 1; c = e; continue; }
        if (ch === '(' || ch === '[' || ch === '{') depth++; else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === '<' && depth === 0 && /[\w$]/.test(stmt[c - 1] ?? '') && closes(stmt, c)) angle++; else if (ch === '>' && angle > 0 && stmt[c - 1] !== '=') angle--;
        else if (depth === 0 && angle === 0 && ch === ',') { parts.push(stmt.slice(start, c)); start = c + 1; }
        else if (depth === 0 && angle === 0 && ch === ';') { parts.push(stmt.slice(start, c)); start = -1; if (k === i) rest = stmt.slice(c + 1); break; }
      }
      if (start >= 0) parts.push(stmt.slice(start));
      for (const part of parts) {
        const n = /^\s*([A-Za-z_$][\w$]*)/.exec(part); if (!n) continue;
        let eq = -1, d = 0, a = 0;
        for (let c = n[0].length; c < part.length; c++) { const ch = part[c];
          if (ch === '(' || ch === '[' || ch === '{') d++; else if (ch === ')' || ch === ']' || ch === '}') d--;
          else if (ch === '<' && d === 0 && /[\w$]/.test(part[c - 1] ?? '') && closes(part, c)) a++; else if (ch === '>' && a > 0 && part[c - 1] !== '=') a--;
          else if (ch === '=' && d === 0 && a === 0 && part[c + 1] !== '>' && part[c + 1] !== '=') { eq = c; break; } }
        decls.push({ file, line: i + 1, kind: m[2] as 'let' | 'const', name: n[1], init: eq < 0 ? '' : part.slice(eq + 1).trim(), exported: !!m[1] });
      }
      const more = /^\s*(export )?(let|const) /.exec(rest); if (!more) break;
      m = more; rest = rest.slice(more[0].length);
      }
    }
  }
  /** how often `name` is written to in `src`: through a member or an index, by a method that changes a Map / Set / array in place — and, of a `let`, the name itself */
  const esc = (x: string) => x.replace(/[$]/g, '\\$');
  const writes = (name: string, src: string): number => {
    const n = esc(name), at = `(?<![\\w.$])${n}`, mem = '(?:\\.[\\w$]+|\\[[^\\]]+\\])+';
    const pats = [`${at}\\.(?:push|pop|shift|unshift|splice|sort|reverse|fill|set|add|delete|clear|copyWithin)\\(`, `${at}${mem}\\s*(?:[-+*/|&^%]|\\*\\*|<<|>>>?|\\?\\?|\\|\\||&&)?=(?!=)`, `${at}${mem}(?:\\+\\+|--)`, `(?:\\+\\+|--)${n}${mem}`, `Object\\.assign\\(\\s*${n}\\b`, `${at}\\.length\\s*=`, `delete ${n}[.\\[]`];
    let c = 0; for (const p of pats) c += (src.match(new RegExp(p, 'g')) ?? []).length; return c;
  };
  const base = (f: string) => f.slice(f.lastIndexOf('/') + 1, -3);
  const registered = new Map<string, Set<string>>();   // file → the names it registers
  const badReg: string[] = [];
  for (const [file, src] of text) { const set = new Set<string>(); registered.set(file, set);
    for (const m of src.matchAll(/rollback(?:Var|Root)(?:<[^>(]*>)?\(\s*'([^']+)'/g)) { if (file === 'src/math/side.ts') continue; const [b, v] = m[1].split('.'); if (b !== base(file) || !decls.some(d => d.file === file && d.name === v)) badReg.push(`${file}: '${m[1]}'`); else set.add(v); } }
  const used = new Set<string>(), needLet: string[] = [], needRoot: string[] = [], rawWeak: string[] = [], badTable: string[] = [], heldGen: string[] = [];
  let lets = 0, letReg = 0, conts = 0, contReg = 0, contKnob = 0, named = 0;
  const wordIn = new Map<string, Set<string>>(); const wordsOf = (f: string): Set<string> => { let w = wordIn.get(f); if (!w) wordIn.set(f, w = new Set(text.get(f)!.match(/[A-Za-z_$][\w$]*/g) ?? [])); return w; };
  for (const d of decls) {
    const key = `${d.file} ${d.name}`, isReg = registered.get(d.file)!.has(d.name) || /^rollbackRoot\b/.test(d.init);
    const table = /^new Side(Map|Set)\b/.exec(d.init), raw = /^new Weak(Map|Set)\b/.test(d.init);
    if (raw) { if (key in RAW_WEAK_OK) used.add(key); else rawWeak.push(`${d.file}:${d.line} ${d.name}`); continue; }
    if (table && d.kind === 'const') { named++; const want = `'${base(d.file)}.${d.name}'`, got = /\(\s*('[^']*')?\s*\)\s*$/.exec(d.init.replace(/;?\s*(\/\/.*)?$/, ''))?.[1]; if (got !== want) badTable.push(`${d.file}:${d.line} ${d.name} is named ${got ?? '(nothing)'}, not ${want}`); continue; }
    if (d.kind === 'let') { lets++;
      if (table && /\(\s*'/.test(d.init)) badTable.push(`${d.file}:${d.line} ${d.name}: a table in a \`let\` takes no name (the variable is registered; the table hangs off it)`);
      if (isReg) letReg++; else if (key in ROLLBACK_EXEMPT) used.add(key); else needLet.push(`${d.file}:${d.line} ${d.name}`); continue; }
    if (!/^(new (Map|Set|Array|(Big)?(Float|Int|Uint)\d+(Clamped)?Array)\b|Array\.from\(|Array\(|\[|\{|rollbackRoot\b)/.test(d.init)) continue;
    let w = writes(d.name, text.get(d.file)!);
    if (d.exported) for (const f of files) if (f !== d.file && wordsOf(f).has(d.name)) w += writes(d.name, text.get(f)!);
    if (!w && !isReg) continue;
    conts++;
    if (isReg) contReg++; else if (KNOBS.has(d.name)) contKnob++; else if (key in ROLLBACK_EXEMPT) used.add(key); else needRoot.push(`${d.file}:${d.line} ${d.name}`);
  }
  // a plain weak table, or a named one, anywhere but in a top-level declaration
  for (const [file, src] of text) { const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) { const ln = lines[i];
      // a generator or an iterator KEPT (a field, a variable or a parameter typed as one — `it: Generator<…>`, `walk?: null | Iterator<…>` — not a function that returns
      // one): where it stopped in its own code is in no snapshot. Every such name on the line, a doc comment in front of it or not. NOT SEEN: one typed through an
      // alias (`type Script = Generator<…>`), by `ReturnType<…>`, or not typed at all (`{ walk: dripWalk(g) }`)
      if (!/^\s*(\/\/|\*)/.test(ln)) for (const m of ln.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '').matchAll(/\b([A-Za-z_]\w*)\??:\s*(?:(?:null|undefined)\s*\|\s*)?(?:Async)?(?:Generator|Iterator|IterableIterator)\b/g)) { const key = `${file} ${m[1]}`; if (key in GENERATOR_OK) used.add(key); else heldGen.push(`${file}:${i + 1} ${m[1]}`); }
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) continue; const code = ln.replace(/\/\/.*$/, '');
      const top = /^(export )?(let|const) /.test(ln);
      if (/new Weak(Map|Set)\b/.test(code) && file !== 'src/math/side.ts' && !top) rawWeak.push(`${file}:${i + 1} (inside a function or a class)`);
      if (!top && /new Side(Map|Set)(<[^(]*>)?\(\s*'/.test(code)) badTable.push(`${file}:${i + 1}: a table made inside a function or a class takes no name`);
      } }
  const stale = [...Object.keys(ROLLBACK_EXEMPT), ...Object.keys(RAW_WEAK_OK), ...Object.keys(GENERATOR_OK)].filter(k => !used.has(k));
  const ALL = process.env.ROLLBACK_ALL === '1', some = (a: string[]) => a.length ? `${a.length}: ${a.slice(0, ALL ? 999 : 8).join(' · ')}${a.length > 8 && !ALL ? ' … (ROLLBACK_ALL=1 lists them all)' : ''}` : 'none';
  console.log(`  the static pass · ${files.length} files of ${SIM.join(', ')} and ${SIM_FILES.join(', ')}`);
  verdict(rawWeak.length === 0, 'no plain WeakMap / WeakSet in the simulation\'s folders (a snapshot cannot list one)', `${some(rawWeak)} · ${Object.keys(RAW_WEAK_OK).length} allowed, each with its reason`);
  verdict(heldGen.length === 0, 'no generator is kept in the simulation\'s folders (where one stopped in its own code is in no snapshot: a job half done is plain data)', `${some(heldGen)} · ${Object.keys(GENERATOR_OK).length} allowed, each with its reason`);
  verdict(badTable.length === 0 && named > 100, 'every side table at the top of a module carries its module\'s and its variable\'s name; none made inside a function does', `${named} named · ${some(badTable)}`);
  verdict(needLet.length === 0, 'every module `let` is registered (rollbackVar) or listed with the reason it need not be (tools/qa/rollback-exempt.ts)', `${lets} lets: ${letReg} registered · unlisted ${some(needLet)}`);
  verdict(needRoot.length === 0, 'every module-level Map / Set / array / object the code writes to is registered (rollbackRoot), a knob table, or listed with its reason', `${conts} written: ${contReg} registered, ${contKnob} knob tables · unlisted ${some(needRoot)}`);
  verdict(badReg.length === 0 && stale.length === 0, 'the registrations and the list name what is there', `registered under another module's name, or no such variable: ${some(badReg)} · listed but gone, registered, or no longer written: ${some(stale)}`);
}

if (!argv.includes('--static')) {
  const todo = ids.flatMap(scn => seeds.flatMap(seed => (['moments', 'plain'] as const).map(arm => ({ scn, seed, arm })))); const res = new Map<string, Out>(); let next = 0;
  const worker = async () => { for (;;) { const j = todo[next++]; if (!j) return;
    const file = resolve(tmpdir(), `rollback-${process.pid}-${j.scn}-${j.seed}-${j.arm}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.scn}:${j.seed}`, '--arm', j.arm, '--out', file, '--cap', String(CAP), '--every', String(EVERY), '--ticks', String(TICKS)], { stdout: 'ignore', stderr: 'pipe' });
    const errText = await new Response(pr.stderr).text(); await pr.exited;
    let r: Out; try { r = JSON.parse(readFileSync(file, 'utf8')); rmSync(file); } catch { r = { scn: j.scn, seed: j.seed, arm: j.arm, end: 'error', t: 0, digest: '', last: '', frames: 0, moments: [], rawWeak: [], why: [], fns: {}, error: `the run left no result — ${errText.trim().split('\n').slice(-3).join(' / ').slice(0, 400)}` }; }
    res.set(`${j.scn}:${j.seed}:${j.arm}`, r); console.error(`  ${j.scn}:${j.seed} ${j.arm} ${r.end} ${r.t} s · ${r.moments.length} moments${r.error ? ' — ' + r.error.split('\n')[0] : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  const takes: number[] = [], restores: number[] = [], bytes: number[] = [], objs: number[] = [], owns: number[] = [], stepsMs: number[] = [];
  for (const scn of ids) for (const seed of seeds) {
    const m = res.get(`${scn}:${seed}:moments`)!, p = res.get(`${scn}:${seed}:plain`)!, id = `${scn}:${seed}`;
    if (m.error || p.error) { verdict(false, `${id} plays`, (m.error ?? p.error)!.split('\n').slice(0, 3).join(' / ')); continue; }
    const n = m.moments.length, kinds = new Map<string, number>(); for (const x of m.moments) for (const k of x.why.split(' + ')) kinds.set(k, (kinds.get(k) ?? 0) + 1);
    const al = m.moments.filter(x => x.alias >= 0);
    const first = (f: (x: Moment) => boolean, say: (x: Moment) => string): string => { const bad = m.moments.filter(f); return bad.length ? `${bad.length} of ${n} — the first at frame ${bad[0].frame} (${bad[0].t} s, ${bad[0].why}): ${say(bad[0])} · --why ${id}:${bad[0].frame}` : `all ${n}`; };
    verdict(n > 0 && m.moments.every(x => x.back && x.backFull), `${id} put back: the state is the word it was at the moment`, `${first(x => !x.back || !x.backFull, x => x.back ? 'the statics differ' : 'the state differs')} (${[...kinds].map(([k, c]) => `${k} ${c}`).join(', ')})`);
    verdict(n > 0 && m.moments.every(x => x.host), `${id} the host's own: the light meter's buffers are as the host left them, not as the snapshot saw them`, first(x => !x.host, () => 'the meter\'s free buffers went back with the game, or the game holds no meter with a GPU side to mark'));
    verdict(n > 0 && m.moments.every(x => x.same < 0), `${id} same game: ${TICKS} ticks on from the snapshot are the unbroken run's, every tick to the bit`, first(x => x.same >= 0, x => `tick ${x.same} differs`));
    verdict(n > 0 && m.moments.every(x => x.ring < 0), `${id} the ring: a snapshot after every tick, each taken since the one before; the one eight ticks back put back plays the eight again, to the bit`, first(x => x.ring >= 0, x => x.ring === 0 ? 'the state put back is not that tick\'s' : `tick ${x.ring} of the eight differs`));
    verdict(n > 0 && m.moments.every(x => x.fresh < 0 && x.freshAt), `${id} fresh game: the snapshot in another game plays the same ${TICKS} ticks, every tick to the bit`, first(x => x.fresh >= 0 || !x.freshAt, x => x.freshAt ? `tick ${x.fresh} differs` : 'the state differs at the moment')
      + (al.length ? ` · of them ${al.length} every value to the bit but not WHICH object stands somewhere (a module's constant the other game had not reached: its own equal copy) — the first at frame ${al[0].frame}, tick ${al[0].alias}` : ''));
    verdict(n > 0 && m.moments.every(x => !x.leak), `${id} two games: the other game's ${TICKS} ticks leave this game's own state as it was (they share nothing live)`, first(x => x.leak, () => 'this game\'s own state moved'));
    verdict(m.digest !== '' && m.digest === p.digest && m.last === p.last && m.end === p.end && m.t === p.t, `${id} the run rolled back ${4 * n} times is the run never touched`, `digest ${m.digest} | ${p.digest} · last state ${m.last} | ${p.last} · ${m.end} at ${m.t} s | ${p.end} at ${p.t} s`);
    verdict(m.rawWeak.length === 0, `${id} no plain WeakMap or WeakSet in the state`, m.rawWeak.join(' · ') || 'none met');
    for (const x of m.moments) { takes.push(x.tickTakeMs); restores.push(x.restoreMs); bytes.push(x.bytes); objs.push(x.objects); owns.push(x.own); stepsMs.push(x.stepMs); }
  }
  const q = (a: number[], f: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(f * a.length))] : 0;
  console.log(`  (times with ${jobs} runs at once on this box, medians over ${takes.length} moments — --times measures alone: a tick ${q(stepsMs, 0.5).toFixed(1)} ms · a snapshot a tick ${q(takes, 0.5).toFixed(1)} ms / ${q(takes, 0.95).toFixed(1)} p95, ${(q(owns, 0.5) / 1e6).toFixed(2)} MB of its own · eight ticks back put back ${q(restores, 0.5).toFixed(1)} ms / ${q(restores, 0.95).toFixed(1)} p95 · a whole snapshot ${(q(bytes, 0.5) / 1e6).toFixed(2)} MB, ${q(objs, 0.5)} objects)`);
}
console.log(`=== rollback-check: ${fails ? `${fails} FAILED` : 'ALL PASS'} ===`);
process.exit(fails ? 1 : 0);
