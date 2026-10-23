// tools/qa/wordcuts-check.ts — the word that spends no can waits for the cuts (doortools.ts DOORTOOLS.wordCuts: cutsOwe, wordStepIn, wordOwed).
//
// Seen in a lesson's sixteen runs on the page's stand: the kitchen of the orders lesson held from outside, its one defender awake, aimed at the door and
// stood in the band neither jamb's diagonal shows. The word (F) a second and a half into the hold, while both jamb men were still slicing the doorway,
// walked them off their cuts to the door's middle at once, and they were shot in its width before either had seen him, on ten of sixteen. Left to finish
// the cuts the same pair finds him and drops him from the frame. With the rule the word given early is owed to the end of the cuts.
//
// The scene is that lesson played by its own script (lesson-run) up to the hold, then THIS file's word step in place of the script's: the word WAIT_S into
// the hold, the door watched for twelve seconds. On the frozen stand the page's own hold is raised for the runs (the one-order outside clear, the word
// that spends no can, the doorway slice and its lean, by their stand words): the rule acts with them.
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
// What it cannot say: one door, one room, two seeds, the script's player; who wins at the frame is the fight's dice and is counted, not promised. Not
// staged: a captor's last warning, two doors on one word, a hold whose men do not slice. Never seen on a GPU, nobody has played it.
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const GM: any = await import(`${ROOT}/src/game/game.ts`);
const { DOORTOOLS } = (await import(`${ROOT}/src/game/doortools.ts`)) as any;
const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL: any = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = (await import(`${ROOT}/src/game/knobs.ts`)) as any;
const SCRIPT: any = await import('./lessons/train-orders.ts');

const WAIT_S = 1.5, WATCH_S = 12, SEEDS = [3, 4];
/** the page's own hold, raised on the frozen stand for a run (the shipped stand has them) */
const RAISE = ['TPS_OUTSIDEPLAIN', 'TPS_WORDNOCAN', 'TPS_THRPIE', 'TPS_THRLEAN', 'TPS_RAILS'];
class Enough extends Error { }
const KITCHEN = { x0: 13.5, x1: 18.5, z0: 16.4, z1: 20.8 };

interface Run { stood: boolean | null; why: string; sliced0: boolean; beats: { t: number; what: string }[]; lost: number; foeDown: number; cans: number; at: number[][]; g: any }
const at = (R: Run, re: RegExp, nth = 0) => R.beats.filter(b => re.test(b.what))[nth]?.t ?? NaN;

/** the lesson to its held kitchen door, then the word `WAIT_S` in (and again `again` seconds after, if given), the door watched */
async function play(seed: number, on: boolean, o: { again?: number; cap?: number } = {}): Promise<Run> {
  const { runLesson } = await import('./lesson-run.ts');
  const R: Run = { stood: null, why: '', sliced0: false, beats: [], lost: 0, foeDown: NaN, cans: 0, at: [], g: null };
  const upd = GM.Game.prototype.update;
  GM.Game.prototype.update = function (this: any, ...a: any[]) { if (R.stood === null) R.stood = !!DOORTOOLS.wordCuts; DOORTOOLS.wordCuts = on; if (o.cap !== undefined) DOORTOOLS.wordCutsCap = o.cap; return upd.apply(this, a); };
  const word0 = SCRIPT.steps.word, env0 = RAISE.map(k => process.env[k]); if (process.env.TPS_PROFILE !== 'shipped') for (const k of RAISE) process.env[k] = '1';
  SCRIPT.steps.word = (B: any) => {
    const g = B.g, op = () => g.doorTools.ops.find((x: any) => x.door.def.name === 'hut_d' && x.kind === 'threshold'); R.g = g;
    if (!B.until(() => op()?.phase === 'thr', 40)) { R.why = 'the pair never held the kitchen\'s door'; throw new Enough(); }
    B.wait(WAIT_S); const O = op(), men: any[] = [...O.men], cans = g.doorTools.bangs, nb = O.beats.length, t0 = g.time;
    const foe: any[] = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead' && x.char.pos[0] > KITCHEN.x0 && x.char.pos[0] < KITCHEN.x1 && x.char.pos[2] > KITCHEN.z0 && x.char.pos[2] < KITCHEN.z1);
    R.sliced0 = !!O.thr.sliced; if (!foe.length) R.why = 'nobody alive in the kitchen at the word';
    B.press('KeyF', 2); let againT = o.again !== undefined ? t0 + o.again : Infinity;
    B.until(() => { const t = g.time - t0;
      if (g.time >= againT) { againT = Infinity; B.press('KeyF', 2); }
      if (!R.at.length && t >= 0.4) R.at = men.map((m: any) => [...m.char.pos]);
      if (Number.isNaN(R.foeDown) && foe.length && foe.every((e: any) => e.state === 'dead')) R.foeDown = t;
      return t > WATCH_S || men.every((m: any) => m.state === 'dead'); }, WATCH_S + 2);
    R.beats = O.beats.slice(nb).map((b: any) => ({ t: b.t - t0, what: b.what })); R.lost = men.filter((m: any) => m.state === 'dead').length; R.cans = cans - g.doorTools.bangs;
    throw new Enough();
  };
  const log = console.log; console.log = () => { };
  try { const out = await runLesson('train-orders', { seed, floor: 0.25 }); if (!R.g && !R.why) R.why = `the lesson did not reach its kitchen: ${String(out.why).slice(0, 160)}`; }
  finally { console.log = log; SCRIPT.steps.word = word0; GM.Game.prototype.update = upd; RAISE.forEach((k, i) => { if (env0[i] === undefined) delete process.env[k]; else process.env[k] = env0[i]; }); }
  return R;
}

export const wordCutsCheck = guarded(async () => {
  const F = family('word-cuts: the word that spends no can waits for the cuts');
  const knobs0 = knobsCopy(), rnd0 = Math.random;
  try {
    const f = (n: number) => Number.isNaN(n) ? '—' : n.toFixed(2);
    const say = (s: number, R: Run) => `seed ${s}: ${R.why || `the word +${f(at(R, /^the word$/))} · waits +${f(at(R, /^the word waits for the cuts$/))} · cuts over +${f(at(R, /^the cuts (are done|not done)/))} · held counted +${f(at(R, /^held /))} · his man down +${f(R.foeDown)} · ${R.lost} of the pair lost · ${R.cans} can(s)`}`;
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
