// tools/qa/wordcuts-check.ts — the word that spends no can waits for the cuts (doortools.ts DOORTOOLS.wordCuts: cutsOwe, wordStepIn, wordOwed).
//
// Seen in a lesson's sixteen runs on the page's stand: the kitchen of the orders lesson held from outside, its one defender awake, aimed at the door and
// stood in the band neither jamb's diagonal shows. The word (F) a second and a half into the hold, while both jamb men were still slicing the doorway,
// walked them off their cuts to the door's middle at once, and they were shot in its width before either had seen him, on ten of sixteen. Left to finish
// the cuts the same pair finds him and drops him from the frame. With the rule the word given early is owed to the end of the cuts.
//
// The scene is that lesson's yard with no lesson (levels/train-orders.json stood up as a room-clear floor, LESSON off; nothing of a scripted player):
// every defender but the kitchen's taken off the floor as the order is given, the kitchen's own man put on alert and pinned on his mark, with the door as what
// he knows, as the pair sets on the jambs (the fight for the other houses had him so in the lesson), the pair told to hold the kitchen's door from outside by code
// (doorTools.thresholdOn(door, 'all', side, true)), then the word (doorTools.go) WAIT_S after they are on the jambs, and the door watched for twelve
// seconds. On the frozen stand the page's own hold is raised for the runs (the one-order outside clear, the word that spends no can, the doorway slice
// and its lean, by their stand words): the rule acts with them.
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) rule off: the word steps them in there and then (the hold counted and the jambs let go within a tenth of a second of the word), on every seed;
//   (3) rule on, the same seeds: the word is taken and waits ('the word waits for the cuts'), the men finish, 'the cuts are done · in', and only then the
//       step in; no can thrown; nobody of the pair lost; and no more men lost than with the rule off;
//   (4) rule on, the word AGAIN a second later: in at once, the cuts not waited for (the player's say stands);
//   (5) rule on, the cap at half a second: in when the cap is spent, said as that;
//   (6) off, nothing reads its number: the same run with the cap moved, the men where they were to the millimetre 0.4 s after the word;
//   (7) a recording from before the key replays with it off; one that carries it keeps it; ?wordcuts=0 puts it off.
//
//   bun run tools/qa/wordcuts-check.ts            (both stands; also `probes.ts word-cuts`, family doortools)
//   WORDCUTS_BREAK=1 …                            (the rule's own body left out, the same lines asked: must fail)
// What it cannot say: one door, one room, three seeds, the order given by code, the defender woken and pinned by hand; who wins at the frame is the fight's dice and is counted, not promised. Not
// staged: a captor's last warning, two doors on one word, a hold whose men do not slice. Never seen on a GPU, nobody has played it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { DOORTOOLS } = (await import(`${ROOT}/src/game/doortools.ts`)) as any;
const { LESSON } = (await import(`${ROOT}/src/game/lesson.ts`)) as any;
const { killGuard } = (await import(`${ROOT}/src/game/combat.ts`)) as any;
const { startFromQuery } = (await import(`${ROOT}/src/game/scenarioRun.ts`)) as any;
const { parseLevelData } = (await import(`${ROOT}/src/scene/levelData.ts`)) as any;
const { loadLevel } = (await import(`${ROOT}/src/scene/levelLoad.ts`)) as any;
const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL: any = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = (await import(`${ROOT}/src/game/knobs.ts`)) as any;

const DT = 1 / 60, WAIT_S = 1.5, WATCH_S = 12, SEEDS = (process.env.WORDCUTS_SEEDS ?? '2,3,5').split(',').map(Number), YARD = 'train-orders.json', DOOR = 'hut_d';
/** the page's own hold, raised on the frozen stand for a run (the shipped stand has them) */
const RAISE = ['TPS_OUTSIDEPLAIN', 'TPS_WORDNOCAN', 'TPS_THRPIE', 'TPS_THRLEAN'];
const KITCHEN = { x0: 13.5, x1: 18.5, z0: 16.4, z1: 20.8 };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }

interface Run { stood: boolean | null; why: string; sliced0: boolean; foeWas: string; beats: { t: number; what: string }[]; lost: number; foeDown: number; cans: number; at: number[][]; g: any }
const at = (R: Run, re: RegExp, nth = 0) => R.beats.filter(b => re.test(b.what))[nth]?.t ?? NaN;

/** the yard stood up, the hold given, then the word `WAIT_S` after the men are on the jambs (and again `again` seconds after, if given), the door watched */
async function play(seed: number, on: boolean, o: { again?: number; cap?: number } = {}): Promise<Run> {
  const R: Run = { stood: null, why: '', sliced0: false, foeWas: '', beats: [], lost: 0, foeDown: NaN, cans: 0, at: [], g: null };
  const env0 = RAISE.map(k => process.env[k]), lesson0 = LESSON.on; if (process.env.TPS_PROFILE !== 'shipped') for (const k of RAISE) process.env[k] = '1';
  try {
    Math.random = seeded(0x9137 + seed * 7919); LESSON.on = false;
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', YARD), 'utf8'))) })), g = W.game; R.g = g;
    R.stood = !!DOORTOOLS.wordCuts; DOORTOOLS.wordCuts = on; if (o.cap !== undefined) DOORTOOLS.wordCutsCap = o.cap; LESSON.on = false;
    g.godMode = true; g.tune.chaos = 0.5;
    const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(`roomclear=${seed}`))); if (why) { R.why = `start refused: ${why}`; return R; }
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } }, D = g.doorTools;
    await quiet(() => step(20));
    const inK = (x: any) => x.char.pos[0] > KITCHEN.x0 && x.char.pos[0] < KITCHEN.x1 && x.char.pos[2] > KITCHEN.z0 && x.char.pos[2] < KITCHEN.z1;
    const op0 = g.doors.list.find((d: any) => d.def.name === DOOR); if (!op0) { R.why = `no door '${DOOR}'`; return R; }
    const foe: any[] = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead' && inK(x)); if (!foe.length) { R.why = 'nobody alive in the kitchen'; return R; }
    for (const h of g.guards) if (h.team === 'hostile' && h.state !== 'dead' && !foe.includes(h)) killGuard(g, h, [0, 0, 1], true, 'struck');   // (the other houses' men off the floor in the frame the order is given: nobody has moved)
    const op: any = D.thresholdOn(DOOR, 'all', undefined, true); if (typeof op === 'string') { R.why = `the hold refused: ${op}`; return R; }
    await quiet(() => { for (let k = 0; k < 60 * 60 && op.phase !== 'thr' && D.ops.includes(op); k++) step(); }); if (op.phase !== 'thr') { R.why = `the pair never held the kitchen's door (the order: ${D.ops.includes(op) ? op.phase : 'gone'})`; return R; }
    for (const e of foe) { e.state = 'alert'; e.awareness = 1; e.pinned = true; e.lastKnown = [op0.frameCentre[0], 0, op0.frameCentre[2]]; }   // (awake, on his mark and on his door from the moment they are set on the jambs, as the fight for the other houses had him in the lesson: pinned, so an alert man does not walk out to the door he knows of)
    await quiet(() => step(Math.round(WAIT_S * 60)));
    const men: any[] = [...op.men], cans = D.bangs, nb = op.beats.length, t0 = g.time; R.sliced0 = !!op.thr.sliced; R.foeWas = foe.map((e: any) => e.state).join('/');
    let againT = o.again !== undefined ? t0 + o.again : Infinity;
    await quiet(() => { D.go('all');
      for (let k = 0; k < (WATCH_S + 1) * 60; k++) { step(); const t = g.time - t0;
        if (g.time >= againT) { againT = Infinity; D.go('all'); }
        if (!R.at.length && t >= 0.4) R.at = men.map((m: any) => [...m.char.pos]);
        if (Number.isNaN(R.foeDown) && foe.every((e: any) => e.state === 'dead')) R.foeDown = t;
        if (t > WATCH_S || men.every((m: any) => m.state === 'dead')) break; } });
    R.beats = op.beats.slice(nb).map((b: any) => ({ t: b.t - t0, what: b.what })); R.lost = men.filter((m: any) => m.state === 'dead').length; R.cans = cans - D.bangs;
  } finally { LESSON.on = lesson0; RAISE.forEach((k, i) => { if (env0[i] === undefined) delete process.env[k]; else process.env[k] = env0[i]; }); }
  return R;
}

export const wordCutsCheck = guarded(async () => {
  const F = family('word-cuts: the word that spends no can waits for the cuts');
  const knobs0 = knobsCopy(), rnd0 = Math.random;
  try {
    const f = (n: number) => Number.isNaN(n) ? '—' : n.toFixed(2);
    const say = (s: number, R: Run) => `seed ${s}: ${R.why || `his man '${R.foeWas}' at the word · the word +${f(at(R, /^the word$/))} · waits +${f(at(R, /^the word waits for the cuts$/))} · cuts over +${f(at(R, /^the cuts (are done|not done)/))} · held counted +${f(at(R, /^held /))} · his man down +${f(R.foeDown)} · ${R.lost} of the pair lost · ${R.cans} can(s)`}`;
    const off: Run[] = [], on: Run[] = []; for (const s of SEEDS) off.push(await play(s, false));
    { const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_WORDCUTS, want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS['DOORTOOLS.wordCuts'];
      F.verdict(off[0].stood === want && row === 'TPS_WORDCUTS=1', `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${off[0].stood} · TPS_WORDCUTS ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); }
    F.verdict(off.every(R => !R.why && !R.sliced0 && at(R, /^held /) - at(R, /^the word$/) < 0.1 && Number.isNaN(at(R, /^the word waits/)) && R.cans === 0),
      `rule off, the word ${WAIT_S} s into the hold (the men still slicing): they step in there and then`, off.map((R, i) => say(SEEDS[i], R)).join('\n    '));
    for (const s of SEEDS) on.push(await play(s, true));
    F.verdict(on.every(R => !R.why && !R.sliced0 && at(R, /^the word waits for the cuts$/) - at(R, /^the word$/) < 0.1 && at(R, /^the cuts are done · in$/) > at(R, /^the word waits/) + 0.3 && at(R, /^held /) >= at(R, /^the cuts are done · in$/) && R.cans === 0 && R.lost === 0)
      && on.reduce((n, R) => n + R.lost, 0) <= off.reduce((n, R) => n + R.lost, 0),
      'rule on, the same: the word is taken and waits, the men finish their cuts, then the step in; no can; nobody of the pair lost, and no more lost than with the rule off',
      `${on.map((R, i) => say(SEEDS[i], R)).join('\n    ')}\n    lost with the rule off ${off.reduce((n, R) => n + R.lost, 0)} of ${off.length * 2} · on ${on.reduce((n, R) => n + R.lost, 0)}`);
    { const R = await play(SEEDS[0], true, { again: 1 });
      F.verdict(!R.why && at(R, /^the word waits/) < 0.1 && Math.abs(at(R, /^the word$/, 1) - 1) < 0.15 && at(R, /^held /) - at(R, /^the word$/, 1) < 0.1 && Number.isNaN(at(R, /^the cuts (are done|not done)/)),
        'rule on, the word again a second later: in at once, the cuts not waited for', `${say(SEEDS[0], R)} · the second word +${f(at(R, /^the word$/, 1))}`); }
    { const R = await play(SEEDS[0], true, { cap: 0.5 });
      F.verdict(!R.why && at(R, /^the word waits/) < 0.1 && Math.abs(at(R, /^the cuts not done in 0\.5 s · in$/) - 0.5) < 0.15 && at(R, /^held /) >= at(R, /^the cuts not done/),
        'rule on, the cap at half a second: in when the cap is spent, said as that', say(SEEDS[0], R)); }
    { const R = await play(SEEDS[0], false, { cap: 0.5 }), a = off[0].at, b = R.at, d = a.length && a.length === b.length ? Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[2] - b[i][2]))) : NaN;
      F.verdict(!R.why && d < 1e-6 && R.lost === off[0].lost, 'off, nothing reads its number: the same run with the cap moved', `${say(SEEDS[0], R)} · the men 0.4 s after the word ${Number.isNaN(d) ? '—' : d.toFixed(6)} m from the first run's`); }
    { const g = on[0].g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      DOORTOOLS.wordCuts = true; const old = snap(); delete old.tables.DOORTOOLS.wordCuts; JOURNAL.applyKnobs(g, old); const without = DOORTOOLS.wordCuts;
      DOORTOOLS.wordCuts = true; const own = snap(); DOORTOOLS.wordCuts = false; JOURNAL.applyKnobs(g, own); const withIt = DOORTOOLS.wordCuts;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = DOORTOOLS.wordCuts; PROFILE.pageSwitches(new URLSearchParams('wordcuts=0')); const b = DOORTOOLS.wordCuts;
      F.verdict(without === false && withIt === true && a === true && b === false, 'a recording from before the key replays with the rule off (journal.ts applyKnobs), one that carries it keeps it; the page opens with it on and ?wordcuts=0 puts it off', `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'wordcuts=0' → ${b}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }
  return F.done();
});

if (import.meta.main) process.exit((await wordCutsCheck()) ? 0 : 1);
