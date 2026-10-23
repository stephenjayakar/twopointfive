// TWO DOORS ON ONE WORD (src/game/planmode.ts word, CMDRING.planOne) and NO CAN INTO A ROOM OUR OWN MEN HOLD (src/game/doortools.ts mateBehind,
// DOORTOOLS.tossMate). The maintainer, 10-22, of a plan with a pair on each of the guardroom's two doors: "simultaneous breach on mission 2 didn't
// really work. and the second team threw a flashbang when our guys were already on the inside".
//   bun run tools/qa/onesignal-check.ts [--seeds 1,2]      (also `probes.ts onesignal`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/onesignal-check.ts — the same lines on the page's stand
// The plan mode mission's own level (levels/tut-plan.json) with its frame off, the room clear with the squad of four, everybody under god mode (the
// lines are about what is ORDERED and when, not who wins). The check raises the ring, the mode and each rule itself on either stand.
//   1. a pair laid on each door of the guardroom in plan mode, both stacked and waiting, ONE press of the word — played twice: with cans for both doors
//      (two bangs) and with one can to spend (a bang and a plain entry): the two entries are on one word of the door tools, nobody of either door is
//      through before the last can has burst, the first men through the two doors are within a second, no teammate is dazzled by a teammate's can;
//      and with two cans the doors open within a second (each lead steps to his own handle on the page's stand);
//   2. a bang and clear given to one pair, a man of the other pair inside the room by the time the can is to leave the hand: it stays in the kit, the
//      beat says who ('no bang · … is in there'), they go in, he is not dazzled;
//   3. CONTROL: the same order with nobody of ours inside throws its can as it did;
//   4. CONTROL (plumbing): a recording from before each key replays with it off, one made with it on replays on;
//   5. CONTROL (the stands): the frozen stand holds both off, the page's has both on, and FROZEN_HOLDS carries each row with its word.
// PLANONE_BREAK=1 = planOne left off: line 1 must fail.   TOSSMATE_BREAK=1 = tossMate left off: line 2 must fail.   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { ROOT, standUp } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { RAILS } = await import(`${ROOT}/src/game/rails.ts`);
const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const PM: any = await import(`${ROOT}/src/game/planmode.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { DOORTOOLS, offOf, doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const VERBOSE = process.argv.includes('--verbose'), BREAK_ONE = process.env.PLANONE_BREAK === '1', BREAK_MATE = process.env.TOSSMATE_BREAK === '1', LEVEL = 'tut-plan', DT = 1 / 60;
const SEEDS = (() => { const i = process.argv.indexOf('--seeds'); return i > 0 ? process.argv[i + 1].split(',').map(Number) : [1, 2]; })();
type V = number[];
let stood: { one: boolean; mate: boolean } | null = null;   // (each rule as the stand first stood it up, before the check raises it: the page's stand raises its switches once, at load)
const f2 = (n: number) => n.toFixed(2);

async function rig(seed: number, one: boolean, mate: boolean) {
  const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
  let W: any, started: any;
  try {
    const level = loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8')));
    W = await standUp({ uploadEvery: 4, level, seed }); stood ??= { one: CMDRING.planOne, mate: DOORTOOLS.tossMate };
    // (the mission's frame off: the lines are the two rules', not the lesson's · the ring, the mode and its later switches as the page has them)
    RAILS.on = false; Object.assign(CMDRING, { on: true, tapNow: true, stay: true, plan: true, planRts: true, planRun: true, planLook: true, planWaits: true, planKnee: true, planOne: one }); AUTOPILOT.on = true; DOORTOOLS.tossMate = mate;
    started = startFromQuery(W.game, `?levelFile=${LEVEL}.json&roomclear=1&squad4`);
  } finally { console.log = log; console.warn = warn; console.error = err; }
  const g = W.game, O = g.orders, D = g.doorTools;
  const quiet = <T,>(f: () => T): T => { if (VERBOSE) return f(); const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return f(); } finally { console.log = l; console.warn = w; } };
  const R: any = { W, g, O, D, I: W.input, why: started?.why as string | undefined, post: null as null | (() => void),
    step(n = 1) { quiet(() => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); R.post?.(); } }); },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); } };
  g.godMode = true; R.step(30); for (const m of O.squad()) m.god = true;
  const room = g.roomClear?.rooms.find((r: any) => r.def.id === 'guardroom'), B = room?.def.bounds, mid: V = B ? [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2] : [0, 0, 0];
  /** an order's target on that door, from the yard: the room is its far side */
  R.target = (id: string) => { const d = g.doors.list.find((x: any) => x.def.name === id); if (!d || !B) return null; const side = offOf(d, mid, 1) < 0 ? 1 : -1; return { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side }; };
  return R;
}

interface OneRun { seed: number; cans: number; why: string | null; kinds: string[]; worded: boolean; open: number[]; cross: number[]; lastBurst: number; dazzled: string[] }
/** line 1: a pair on each door, both waiting, one word — `cans`: what the squad has to spend (the autopilot keeps its last: 3 = a bang a door, 2 = one bang, one plain entry) */
async function playOne(seed: number, cans: number): Promise<OneRun> {
  const R = await rig(seed, !BREAK_ONE, true), g = R.g, O = R.O, D = R.D, out: OneRun = { seed, cans, why: null, kinds: [], worded: false, open: [], cross: [], lastBurst: NaN, dazzled: [] };
  if (R.why) { out.why = R.why; return out; }
  const pairs: any[][] = [O.men('red'), O.men('blue')], ts = [R.target('guard'), R.target('guard_side')];
  if (pairs.some(p => p.length !== 2) || ts.some(t => !t)) { out.why = `no two pairs or no two doors (${pairs.map(p => p.length).join(' + ')} men)`; return out; }
  for (let i = 0; i < 2; i++) { O.plan.pick = pairs[i].map((m: any) => m.callsign); PM.planOrder(O, ts[i], false); R.step(2); }
  O.plan.pick = null;
  if (O.plan.chains.length !== 2) { out.why = `${O.plan.chains.length} chain(s) laid, not two`; return out; }
  if (!R.until(() => O.plan.chains.length === 2 && O.plan.chains.every((c: any) => c.phase === 'wait'), 60)) { out.why = `never both waiting (${O.plan.chains.map((c: any) => c.phase).join(', ') || 'no chain'})`; return out; }
  R.step(30); D.bangs = cans;
  const had = new Set<any>(D.ops), t0 = g.time, squad: any[] = O.squad(), fresh = () => D.ops.filter((o: any) => !had.has(o)), kept: any[] = [], crossT = new Map<any, number>(), dz = new Set<string>();
  R.I.pressed.add(DOORTOOLS.blowKey); R.step();
  { const e = fresh().filter((o: any) => o.kind === 'openClear' || o.kind === 'bangClear'); out.worded = e.length === 2 && !!e[0].word && e[0].word === e[1].word; }   // (asked the tick the word is given: the word is taken off them again as they step in)
  R.post = () => { for (const o of fresh()) { if (!kept.includes(o)) kept.push(o);
      if (!crossT.has(o) && o.men.some((m: any) => m.state !== 'dead' && offOf(o.door, m.char.pos, o.side) < -0.15)) crossT.set(o, g.time - t0); }
    for (const m of squad) if (g.time < m.dazzledUntil) dz.add(m.callsign); };
  R.post(); R.until(() => kept.length >= 2 && kept.every(o => crossT.has(o)) && g.time - Math.max(...kept.map(o => crossT.get(o)! + t0)) > 3, 30); R.post = null;
  const ent = kept.filter(o => o.kind === 'openClear' || o.kind === 'bangClear');
  out.kinds = kept.map(o => `${o.kind} ${o.door.def.name}`);
  out.open = ent.map(o => o.openT - t0); out.cross = ent.map(o => crossT.has(o) ? crossT.get(o)! : NaN); out.dazzled = [...dz];
  out.lastBurst = Math.max(...ent.flatMap(o => o.beats.filter((b: any) => /^bang /.test(b.what)).map((b: any) => b.t - t0)), -1);
  return out;
}

interface MateRun { seed: number; why: string | null; who: string; beats: string[]; kit0: number; kit1: number; bursts: number; crossed: boolean; dazzled: boolean }
/** lines 2 and 3: a bang and clear for one pair on the front door; `inside`: a man of the other pair stood in the room once the door is open */
async function playMate(seed: number, inside: boolean): Promise<MateRun> {
  const R = await rig(seed, true, !BREAK_MATE), g = R.g, O = R.O, D = R.D, out: MateRun = { seed, why: null, who: '', beats: [], kit0: D.bangs, kit1: D.bangs, bursts: 0, crossed: false, dazzled: false };
  if (R.why) { out.why = R.why; return out; }
  const red: any[] = O.men('red'), mate: any = O.men('blue')[0], t = R.target('guard'); if (red.length !== 2 || !mate || !t) { out.why = 'no pair, no other man or no door'; return out; }
  const d = t.door, side = t.side, inn = doorPt(d, d.def.width / 2, 0.45, -side, 1.1), nav = g.col.nav; let at: V | null = null;
  for (const [deep, lat] of [[2.0, 0], [2.6, 0], [1.6, 0], [2.0, 0.8], [2.0, -0.8], [2.6, 1.0], [2.6, -1.0]]) { const p = doorPt(d, d.def.width / 2 + lat, deep, -side, 0);
    if (!nav.isBlocked(p[0], p[2]) && offOf(d, p, side) < -0.5 && !g.col.solidBlocked(inn, [p[0], 1.1, p[2]])) { at = [p[0], 0, p[2]]; break; } }
  if (!at) { out.why = 'no floor for him inside the room'; return out; }
  const op = D.start('bangClear', red, t, false); if (typeof op === 'string') { out.why = op; return out; }
  out.who = mate.callsign; out.kit0 = D.bangs + (op.bangHeld ? 1 : 0);
  const seen = new Set<any>(g.events); let crossT = NaN;
  R.post = () => { for (const e of g.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'bang') out.bursts++; }
    if (inside && !isNaN(op.openT)) { mate.char.pos[0] = at![0]; mate.char.pos[2] = at![2]; }   // (he went in by the room's other door since the row was given: there from the tick this door opens)
    if (g.time < mate.dazzledUntil) out.dazzled = true;
    if (isNaN(crossT) && op.men.some((m: any) => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.15)) crossT = g.time; };
  R.until(() => g.time - crossT >= 3, 60); R.post = null;
  out.beats = op.beats.map((b: any) => b.what); out.kit1 = D.bangs; out.crossed = crossT > 0;
  return out;
}

export async function onesignalCheck(): Promise<boolean> {
  let all = true; const keep = { on: RAILS.on, knobs: knobsCopy(), ap: AUTOPILOT.on };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`two doors on one word, and no can into a room our own men hold (levels/${LEVEL}.json, the guardroom; seeds ${SEEDS.join(', ')})${BREAK_ONE ? ' — PLANONE_BREAK=1: line 1 must fail' : ''}${BREAK_MATE ? ' — TOSSMATE_BREAK=1: line 2 must fail' : ''}`);
  try {
    // ---- 1
    { const runs: OneRun[] = []; for (const s of SEEDS) for (const cans of [3, 2]) runs.push(await playOne(s, cans));
      const gap = (a: number[]) => Math.abs(a[0] - a[1]);
      const ok = (r: OneRun) => !r.why && r.worded && r.open.length === 2 && r.cross.every(c => c >= 0) && gap(r.cross) <= 1.0 && r.lastBurst >= 0 && Math.min(...r.cross) >= r.lastBurst && !r.dazzled.length && (r.kinds.filter(k => k.startsWith('bangClear')).length < 2 || gap(r.open) <= 1.0);
      verdict(runs.every(ok) && runs.some(r => r.kinds.some(k => k.startsWith('openClear'))) && runs.some(r => r.kinds.every(k => k.startsWith('bangClear'))), `ONE WORD, TWO DOORS (CMDRING.planOne${BREAK_ONE ? ' — PLANONE_BREAK: left off' : ''}): a pair laid on each door of the guardroom, both waiting, the word pressed once, with a can for each door and with one can to spend — the two entries are on one word, nobody is through a door before the last can has burst, the first men through the two doors are within a second of each other, nobody of ours is dazzled by our own can (and two cans: the doors open within a second: a lead's step to his handle is the door tools' own)`,
        runs.map(r => r.why ? `seed ${r.seed}, ${r.cans} cans: NOT RUN — ${r.why}` : `seed ${r.seed}, ${r.cans} cans: ${r.kinds.join(' + ') || 'no entry'} · ${r.worded ? 'one word' : 'NO shared word'} · doors open ${r.open.map(f2).join(' and ')} s after the press · last burst ${r.lastBurst >= 0 ? f2(r.lastBurst) : 'none'} · first man through at ${r.cross.map(f2).join(' and ')} s (${f2(gap(r.cross))} s apart) · dazzled of ours: ${r.dazzled.join(', ') || 'nobody'}`).join('\n    ')); }
    // ---- 2 and 3
    { const ins: MateRun[] = [], outs: MateRun[] = []; for (const s of SEEDS) { ins.push(await playMate(s, true)); outs.push(await playMate(s, false)); }
      const say = (r: MateRun, inside: boolean) => r.why ? `seed ${r.seed}: NOT RUN — ${r.why}` : `seed ${r.seed}: ${inside ? `${r.who} on the room's floor as the door opens` : 'nobody of ours inside'} · ${r.beats.filter(b => /^(shove|kick|open|toss:|bang|no bang|go)/.test(b)).join(' → ') || 'no beat'} · kit ${r.kit0} → ${r.kit1}, ${r.bursts} burst · ${r.crossed ? 'they went in' : 'NOBODY went in'}${inside ? ` · ${r.who} ${r.dazzled ? 'DAZZLED' : 'not dazzled'}` : ''}`;
      verdict(ins.every(r => !r.why && r.beats.includes(`no bang · ${r.who} is in there`) && !r.beats.some(b => /^toss:/.test(b)) && r.kit1 === r.kit0 && r.bursts === 0 && r.crossed && !r.dazzled),
        `A TEAMMATE INSIDE BY THE TIME THE CAN IS TO LEAVE THE HAND (DOORTOOLS.tossMate${BREAK_MATE ? ' — TOSSMATE_BREAK: left off' : ''}): the can stays in the kit, the beat says who ('no bang · … is in there'), nothing bursts, they go in, he is not dazzled`, ins.map(r => say(r, true)).join('\n    '));
      verdict(outs.every(r => !r.why && r.beats.some(b => /^toss:/.test(b)) && r.kit1 === r.kit0 - 1 && r.bursts === 1 && r.crossed),
        `CONTROL (the rule changes nothing here: holds${BREAK_MATE ? ', as now,' : ''} under TOSSMATE_BREAK too) — nobody of ours inside: the same order throws its can, one burst, then they go in`, outs.map(r => say(r, false)).join('\n    ')); }
    // ---- 4
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), g = (await rig(SEEDS[0], true, true)).g, snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      CMDRING.planOne = true; DOORTOOLS.tossMate = true; const old = snap(); delete old.flags.tossMate; if (old.tables.DOORTOOLS) delete old.tables.DOORTOOLS.tossMate; if (old.tables.CMDRING) delete old.tables.CMDRING.planOne; J.applyKnobs(g, old); const before = [CMDRING.planOne, DOORTOOLS.tossMate];
      CMDRING.planOne = true; DOORTOOLS.tossMate = true; const on = snap(); CMDRING.planOne = false; DOORTOOLS.tossMate = false; J.applyKnobs(g, on); const kept = [CMDRING.planOne, DOORTOOLS.tossMate];
      CMDRING.planOne = false; DOORTOOLS.tossMate = false; const off = snap(); CMDRING.planOne = true; DOORTOOLS.tossMate = true; J.applyKnobs(g, off); const keptOff = [CMDRING.planOne, DOORTOOLS.tossMate];
      verdict(before.every(v => v === false) && kept.every(v => v === true) && keptOff.every(v => v === false), 'CONTROL (plumbing, not the rules: no break word touches it) — a recording from before either key replays with CMDRING.planOne and DOORTOOLS.tossMate off; one made with them on replays on, off off',
        `from before the keys: planOne ${before[0]}, tossMate ${before[1]} · recorded on: ${kept.join(', ')} · recorded off: ${keptOff.join(', ')}`); }
    // ---- 5
    { const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`), shipped = process.env.TPS_PROFILE === 'shipped', want = (w: string | undefined) => w !== undefined ? w === '1' : shipped;
      const rows = [FROZEN_HOLDS['CMDRING.planOne'], FROZEN_HOLDS['DOORTOOLS.tossMate']];
      const wantOne = process.env.TPS_PLANONE === '1' && !shipped ? !!stood?.one : want(process.env.TPS_PLANONE);   // (raised by its word on the frozen stand it still needs the mode's own word: either is right there)
      verdict(!!stood && stood.one === wantOne && stood.mate === want(process.env.TPS_TOSSMATE) && !!rows[0]?.includes('TPS_PLANONE=1') && !!rows[1]?.includes('TPS_TOSSMATE=1'), `CONTROL (the stands) — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the rules up ${shipped ? 'on' : 'off'} unless a word says otherwise, and FROZEN_HOLDS carries a row for each`,
        `planOne ${stood?.one}, tossMate ${stood?.mate} · rows: '${rows[0]}' and '${rows[1]}'`); }
  } finally { RAILS.on = keep.on; knobsBack(keep.knobs); AUTOPILOT.on = keep.ap; }
  console.log(all ? 'onesignal: all hold' : 'onesignal: FAIL');
  return all;
}
if (import.meta.main) process.exit((await onesignalCheck()) ? 0 : 1);
