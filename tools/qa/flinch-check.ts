// A MAN FLINCHES WHEN FIRE COMES CLOSE (src/game/flinch.ts FLINCH; the maintainer: 'we should have some flinching when there's fire near a character' —
// 'maybe also proportional to training too' — 'so very inexperienced characters get freaked out by gunfire and may even run away').
//   bun run tools/qa/flinch-check.ts        (or: bun run tools/qa/probes.ts flinch)        exit 0 = every line PASS, 1 = a FAIL line
// Headless; nothing here looks at a picture (the duck is asked of the animator as a number, where the motion pass is on). Rounds are handed to the one seam a
// round goes through (suppression.ts noteRound) so each line knows how near its round passed. The rule is set by the check itself on either stand.
//   off        the rule off: a round 1.4 m past a calm man — under the suppression model's own line, so nothing ducks him, as it was
//   on         the rule on, the same round: he ducks; his suppression scalar, his reaction clock and his next round's clock are what they were with it off
//   near       a round 0.3 m past him ducks him further than one 1.4 m past; one landing on the other while he is down deepens the duck without a jump
//   inside     a hostile round from two metres off (nearer than the suppression model weighs anything) still ducks him and weighs nothing; from half a metre: nothing
//   hands      the duck leaves a hand's errand (a weapon change) running, where the animator's own flinch drops it; with the motion pass off no clip starts
//   training   the same near round on a green man, a steady man and an operator: each less than the one before
//   sam        a guard's round past the player's man ducks him; his suppression scalar is what it was with the rule off
//   mate       a teammate ducks at a defender's round
//   own side   a round of his own side going past a man: nothing
//   scripted   a choreographed man: nothing — unless his script asks (GuardScript.flinch: the tutorial's men)
//   runs       a green man alone kept under close fire for FLINCH.breakSecs: he drops it and runs (runner.ts has him); one burst and then quiet: he stays;
//              the same fire on a steady man, on a green man with a mate beside him, and with FLINCH.run off: each stays; a colleague's rounds between the
//              enemy's do not hide them, and a colleague's alone count for nothing; a mate who has already run is no company; the run's gate down: no count kept
//   checkpoint a green man's seconds under fire ride a save into a fresh game
//   journal    a recording from before the table replays with the rule off; one that carries it keeps its own word
// FLINCH_BREAK=1: the rule is left off where the lines want it on — red.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
type Vec3 = [number, number, number];
const BREAK = process.env.FLINCH_BREAK === '1';

export async function flinchCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { FLINCH, FLINCH_STATS, flinchUnder } = await import(`${ROOT}/src/game/flinch.ts`);
  const { noteRound, SUPPRESSION } = await import(`${ROOT}/src/game/suppression.ts`);
  const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
  const { MORALE, hasMate, trainingOf } = await import(`${ROOT}/src/game/morale.ts`);
  const { RUNNER, RUNNER_STATS, runnerOwns, runnerBreak } = await import(`${ROOT}/src/game/runner.ts`);
  const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const DT = 1 / 60, T = FLINCH; const f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—', f3 = (x: number) => Number.isFinite(x) ? x.toFixed(3) : '—';
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <R>(fn: () => Promise<R> | R): Promise<R> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = { ...T }, train0 = MORALE.training, nerve0 = MORALE.on, runner0 = RUNNER.on, moves = MOVES.on > 0.5;
  const zero = () => { FLINCH_STATS.ducks = FLINCH_STATS.broke = 0; FLINCH_STATS.last = []; };
  /** ducks given to this character since the last zero */
  const got = (c: any): number => (FLINCH_STATS.last ?? []).filter((id: number) => id === c.id).length;
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const FAR: Vec3 = [1, 0, 1];
  /** a round that passes `off` metres beside `c`'s chest, from eight metres in front of him to six behind (the strike is out of reach: only the pass weighs) */
  const pass = (g: any, shooter: any, c: any, off: number, from = 8) => {
    const C: Vec3 = c.bones.chest ?? [c.pos[0], c.pos[1] + 1.1, c.pos[2]], f = c.forward(), sx = -f[2], sz = f[0];
    noteRound(g, shooter, [C[0] + f[0] * from + sx * off, C[1], C[2] + f[2] * from + sz * off], [C[0] - f[0] * 6 + sx * off, C[1], C[2] - f[2] * 6 + sz * off], null);
  };
  /** a fresh office night, the rule as asked, every man but the first parked blind and deaf; the first holds where he stands, calm; Sam far off in the dark */
  const world = async (on: boolean, training = 'green') => {
    MORALE.training = training as any; MORALE.on = true; RUNNER.on = true;
    const W: any = await quiet(() => standUp({ seed: 7 })); const g = W.game; Object.assign(T, was); T.on = on && !BREAK; T.run = true; MORALE.training = training as any; MORALE.on = true; RUNNER.on = true;   // AFTER standUp: the stand-up line would otherwise write them back
    g.godMode = true; g.guards.forEach((o: any, i: number) => { o.heardUpTo = 1e12; if (i) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; } });
    const A = g.guards[0]; A.hold = true; zero();
    const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.02; W.step(DT); each?.(); } };
    g.teleportPlayer(FAR); step(30);
    /** the most of the duck `c` shows over the next `n` frames */
    const peak = (c: any, n = 24) => { let m = 0; step(n, () => { m = Math.max(m, c.anim.flinchShown); }); return m; };
    return { W, g, A, step, peak, P: g.player.char };
  };
  /** did the duck happen: by the animator where the motion pass is on, by the count either way */
  const ducked = (shown: number, n: number) => n === 1 && (!moves || shown > 0.02);

  try {
    // ------------------------------------------------------------ off, on, and what it leaves alone
    let offV = NaN, offCd = NaN, offReact = NaN, offState = '';
    { const s = await world(false), { g, A, P } = s; pass(g, P, A.char, 1.4); const v = A.sup.v, shown = s.peak(A.char);
      offV = v; offCd = A.fireCd; offReact = A.reactT; offState = A.state;
      line(FLINCH_STATS.ducks === 0 && shown === 0 && v > 0 && v < SUPPRESSION.flinch, `the rule off: a round 1.4 m past a calm man weighs ${f3(v)} on him (under the suppression model's flinch line, ${SUPPRESSION.flinch}) and nothing ducks him — ducks ${FLINCH_STATS.ducks}, shown ${f3(shown)}`); }
    let farShown = NaN;
    { const s = await world(true), { g, A, P } = s; pass(g, P, A.char, 1.4); const v = A.sup.v, shown = s.peak(A.char); farShown = shown;
      line(ducked(shown, got(A.char)), `the rule on, the same round: he ducks — ducks ${got(A.char)}, ${moves ? `${f3(shown)} of the whole duck shown` : 'the motion pass is off on this stand: counted, nothing shown'}`);
      line(v === offV && A.fireCd === offCd && A.reactT === offReact && A.state === offState, `… and it is the picture: his suppression scalar ${f3(v)} (off: ${f3(offV)}), his next round's clock ${f3(A.fireCd)} (${f3(offCd)}), his reaction clock ${f3(A.reactT)} (${f3(offReact)}) and his state '${A.state}' ('${offState}') are what they were with it off`); }
    // ------------------------------------------------------------ nearer is more; green, steady, operator
    let green = NaN;
    { const s = await world(true), { g, A, P } = s; const tr = trainingOf(g, A); pass(g, P, A.char, 0.3); green = s.peak(A.char);
      line(tr === 'green' && got(A.char) === 1 && (!moves || green > farShown * 1.4), `a round 0.3 m past the same (${tr}) man: ${moves ? `${f3(green)} of the duck against ${f3(farShown)} at 1.4 m` : `ducks ${got(A.char)} (the motion pass is off on this stand: no size to read)`}`); }
    { /** the most the duck grows in one frame over the next `n` */
      const rise = (s: any, c: any, n: number) => { let m = 0, was = c.anim.flinchShown; s.step(n, () => { const v = c.anim.flinchShown; m = Math.max(m, v - was); was = v; }); return m; };
      const a = await world(true); pass(a.g, a.P, a.A.char, 0.3); const alone = rise(a, a.A.char, 12);
      const b = await world(true); pass(b.g, b.P, b.A.char, 1.4); b.step(5); const low = b.A.char.anim.flinchShown; pass(b.g, b.P, b.A.char, 0.3); const jump = rise(b, b.A.char, 12), deep = b.peak(b.A.char, 1) ;
      line(!moves || (jump <= alone * 1.05 && deep > low * 1.4), moves ? `a near round on a man already down for a far one deepens the duck (${f3(low)} to ${f3(deep)}) with no jump: ${f3(jump)} a frame at most, a fresh duck's own rise is ${f3(alone)}` : 'the motion pass is off on this stand: no duck to deepen'); }
    { const s = await world(true), { g, A, P } = s; pass(g, P, A.char, 0.3, 2); const n2 = got(A.char), v2 = A.sup.v; zero(); pass(g, P, A.char, 0.3, 0.5); const n05 = got(A.char);
      const o = await world(false); pass(o.g, o.P, o.A.char, 0.3, 2); const off = FLINCH_STATS.ducks;
      line(n2 === 1 && v2 === 0 && n05 === 0 && off === 0, `a hostile round from two metres off, 0.3 m past him (inside suppression's least travel, ${SUPPRESSION.minTravel} m): he ducks (${n2}) and it weighs nothing on him (${f3(v2)}); from half a metre: nothing (${n05}); the rule off: nothing (${off})`); }
    { /** a weapon change started on the player's man, then `how`; is the change still running six frames on */
      const errand = async (how: (s: any) => void) => { const s = await world(true); s.P.anim.kitSwap('pistol', 'rifle'); const began = s.P.anim.kitBusy; how(s); s.step(6); return { began, runs: s.P.anim.kitBusy as boolean, n: got(s.P) }; };
      const plain = await errand(() => {}), soft = await errand(s => pass(s.g, s.A.char, s.P, 0.3)), hard = await errand(s => s.P.anim.flinchFrom(null));
      line(plain.began && soft.n === 1 && soft.runs === plain.runs && (!plain.runs || !moves || !hard.runs),
        `the player's man half way through a weapon change: a round 0.3 m past him ducks him (${soft.n}) and the change goes on (${soft.runs}; untouched: ${plain.runs})${plain.runs && moves ? ` — the animator's own flinch would have dropped it (${!hard.runs})` : ' — nothing on this stand to tell it from'}`);
      const s = await world(true), keep = MOVES.on; MOVES.on = 0; try { pass(s.g, s.A.char, s.P, 0.3); line(got(s.P) === 1 && (s.P.anim as any).hitT < 0 && s.P.anim.flinchShown === 0, `the motion pass off: the round is counted (${got(s.P)}) and no clip starts on him (the old hit clip's clock ${(s.P.anim as any).hitT})`); } finally { MOVES.on = keep; } }
    { const s = await world(true, 'trained'), { g, A, P } = s; const tr = trainingOf(g, A); pass(g, P, A.char, 0.3); const steady = s.peak(A.char);
      pass(g, A.char, P, 0.3); const sam = s.peak(P);
      line(tr === 'steady' && got(A.char) === 1 && got(P) === 1 && (!moves || (steady < green * 0.8 && steady > 0.02 && sam < steady && sam > 0.02)),
        `by training, the same near round: a green man ${f3(green)}, a steady one ${f3(steady)} (× ${T.steadyK}), the player's own man ${f3(sam)}${moves ? '' : ' — the motion pass is off on this stand: counted only'} (ducks ${got(A.char)} and ${got(P)})`); }
    // ------------------------------------------------------------ the player's man
    { const a = await world(false), b = await world(true); pass(a.g, a.A.char, a.P, 0.5); pass(b.g, b.A.char, b.P, 0.5); const va = a.g.player.sup.v, vb = b.g.player.sup.v;
      zero(); pass(b.g, b.A.char, b.P, 0.5); const shown = b.peak(b.P);
      line(va === vb && ducked(shown, got(b.P)), `a guard's round half a metre past the player's man ducks him (${moves ? f3(shown) : `ducks ${got(b.P)}`}); what it weighs on him is what it weighed with the rule off (${f3(vb)} · ${f3(va)})`); }
    // ------------------------------------------------------------ his own side's round; a choreographed man
    { const s = await world(true), { g, A } = s; pass(g, g.guards[1].char, A.char, 0.3); const own = got(A.char), ownShown = s.peak(A.char);
      line(own === 0 && ownShown === 0, `a round of his own side going 0.3 m past him: nothing — ducks ${own}, shown ${f3(ownShown)}`); }
    { const s = await world(true), { g, A, P } = s; A.script = { goal: null }; pass(g, P, A.char, 0.3); const plain = got(A.char);
      const s2 = await world(true); s2.A.script = { goal: null, flinch: true }; pass(s2.g, s2.P, s2.A.char, 0.3); const asked = got(s2.A.char), shown = s2.peak(s2.A.char);
      line(plain === 0 && ducked(shown, asked), `a choreographed man: nothing (ducks ${plain}) — one whose script asks for it (GuardScript.flinch, the tutorial's men) ducks (${asked}${moves ? `, ${f3(shown)}` : ''})`); }
    // ------------------------------------------------------------ a teammate (a squad map)
    { MORALE.training = 'green'; MORALE.on = true;
      const W: any = await quiet(async () => { const X: any = await standUp({ seed: 3, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) }); startFromQuery(X.game, 'levelFile=compound.json&roomclear'); return X; });
      const g = W.game; Object.assign(T, was); T.on = !BREAK; g.godMode = true; zero();
      for (const o of g.guards) { o.dazzledUntil = 1e9; o.heardUpTo = 1e12; }
      const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.02; W.step(DT); each?.(); } }; step(10);
      const op = g.guards.find((x: any) => x.team === 'operative' && x.state !== 'dead'), def = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
      pass(g, def.char, op.char, 0.3); const n1 = got(op.char); let shown = 0; step(24, () => { shown = Math.max(shown, op.char.anim.flinchShown); });
      pass(g, g.player.char, op.char, 0.3); const n2 = got(op.char);
      line(!!op && !!def && ducked(shown, n1) && n2 === n1, `the compound: a teammate ducks at a defender's round 0.3 m past him (${moves ? f3(shown) : `ducks ${n1}`}), and not at the player's own (${n2 - n1})`); }
    // ------------------------------------------------------------ the green man alone runs
    { /** `secs` of a round every quarter second 0.4 m past the first man (`burst`: three rounds and then quiet): when the runner took him, the most seconds under fire on his record */
      const fire = async (training: string, o: { mate?: boolean; run?: boolean; burst?: boolean; own?: 'too' | 'only'; fled?: boolean } = {}, secs = 5) => {
        const s = await world(true, training), { g, A, P } = s; T.run = o.run !== false; const c = A.char;
        if (o.mate) { const m = g.guards[1], f = c.forward(), q = [0, 1, 2, 3, 4, 5, 6, 7].map((i): Vec3 => { const a = i * Math.PI / 4, x = f[0] * Math.cos(a) - f[2] * Math.sin(a), z = f[0] * Math.sin(a) + f[2] * Math.cos(a); return [c.pos[0] + x * 1.5, 0, c.pos[2] + z * 1.5]; }).find(p => !g.col.segmentBlocked([c.pos[0], 1.6, c.pos[2]], [p[0], 1.2, p[2]]) && !g.col.segmentBlocked([c.pos[0], 0.4, c.pos[2]], [p[0], 0.4, p[2]])); if (q) { m.char.pos = q; m.char.vel = [0, 0, 0]; m.path = []; m.pathGoal = null; m.char.update(0); s.step(5); } }
        const fledOk = o.fled ? runnerBreak(g, g.guards[1]) && runnerOwns(g.guards[1]) : false;
        const lone = !hasMate(g, A), p0: Vec3 = [c.pos[0], 0, c.pos[2]]; let tookAt = NaN, most = 0, far = 0; const said0 = RUNNER_STATS.said, t0 = g.time;
        for (let i = 0; i < secs * 60; i++) {
          if (i % 15 === 0 && (!o.burst || i < 45) && !runnerOwns(A) && o.own !== 'only') pass(g, P, c, 0.4);
          if (o.own && i % 15 === (o.own === 'too' ? 1 : 0) && !runnerOwns(A)) pass(g, g.guards[2].char, c, 0.2);   // (a colleague's round, the frame after the enemy's: the last on his suppression record)
          s.step(); most = Math.max(most, flinchUnder(A)); far = Math.max(far, flat(c.pos, p0));
          if (isNaN(tookAt) && runnerOwns(A)) tookAt = g.time - t0;
        }
        return { lone, fledOk, tookAt, most, far, broke: FLINCH_STATS.broke, said: RUNNER_STATS.said - said0, rounds: A.weapon.shotsFired, under: flinchUnder(A), sup: A.sup.v as number };
      };
      const G = await fire('green');
      line(G.lone && G.broke === 1 && G.said === 1 && G.tookAt >= T.breakSecs - 0.05 && G.tookAt < T.breakSecs + 1 && G.far > 1,
        `a green man alone (${G.lone}), a round every quarter second 0.4 m past him: after ${f2(G.tookAt)} s under it (FLINCH.breakSecs ${T.breakSecs}) he shouts and the runner has him (broke ${G.broke}, said ${G.said}) — ${f2(G.far)} m off his spot inside five seconds`);
      const B = await fire('green', { burst: true }, 8);
      line(B.lone && B.broke === 0 && B.said === 0 && B.most > 0.5 && B.most < T.breakSecs && B.under === 0, `one burst of three and then quiet: he stays — ${f2(B.most)} s under it at most, eased back to ${f2(B.under)} eight seconds on, broke ${B.broke}`);
      const S = await fire('trained'), M = await fire('green', { mate: true }), R = await fire('green', { run: false });
      line(S.broke === 0 && S.said === 0 && S.most === 0, `the same fire on a steady man: he stays (broke ${S.broke}, no count kept: ${f2(S.most)})`);
      line(!M.lone && M.broke === 0 && M.said === 0 && M.most >= T.breakSecs - 0.05, `… on a green man with a mate beside him (alone: ${M.lone}): he stays, over the count (${f2(M.most)} s) and asked again while it lasts (broke ${M.broke})`);
      line(R.lone && R.broke === 0 && R.said === 0 && R.most === 0, `… and with FLINCH.run off (?flinchrun=0): he stays (broke ${R.broke}, no count kept: ${f2(R.most)})`);
      const X = await fire('green', { own: 'too' }), O = await fire('green', { own: 'only' });
      line(X.lone && X.broke === 1 && X.tookAt < T.breakSecs + 1 && O.broke === 0 && O.most === 0 && O.sup >= SUPPRESSION.flinch, `a colleague's round after each of the enemy's does not hide them: he runs after ${f2(X.tookAt)} s (broke ${X.broke}); a colleague's rounds alone, though they weigh ${f3(O.sup)} on him: no count (${f2(O.most)}), he stays (broke ${O.broke})`);
      const F = await fire('green', { mate: true, fled: true });
      line(F.fledOk && !F.lone && F.broke === 1, `a mate beside him who has already dropped his gun and run (the runner has him: ${F.fledOk}; the nerve rule's own count still calls him company: ${!F.lone}) is no company: he runs (broke ${F.broke})`);
      { const s = await world(true), { g, A, P } = s; for (let i = 0; i < 90; i++) { if (i % 15 === 0) pass(g, P, A.char, 0.4); s.step(); } const had = flinchUnder(A); RUNNER.on = false; s.step(); const left = flinchUnder(A); RUNNER.on = true;
        line(had > 1 && left === 0, `the runner switched off under a man ${f2(had)} s into his count: the count is dropped that frame (${f2(left)}), not kept for later`); } }
    // ------------------------------------------------------------ the checkpoint
    { const s = await world(true), { g, A, P } = s; for (let i = 0; i < 90; i++) { if (i % 15 === 0) pass(g, P, A.char, 0.4); s.step(); }
      const had = flinchUnder(A), snap = JSON.parse(JSON.stringify(saveState(g)));
      const s2 = await world(true), g2 = s2.g; await quiet(() => loadState(g2, snap)); const got = flinchUnder(g2.guards[0]);
      line(had > 1 && Math.abs(got - had) < 1e-9, `a green man ${f2(had)} s under fire, saved and loaded into a fresh game: ${f2(got)} s on his record there`); }
    // ------------------------------------------------------------ the journal
    { const s = await world(true), g = s.g, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      T.on = true; const old = snap(); delete old.tables.FLINCH; applyKnobs(g, old); const before = T.on;
      T.on = false; const own = snap(); own.tables.FLINCH.on = true; applyKnobs(g, own); const carried = T.on;
      line(before === false && carried === true, `a recording from before the table replays with the rule off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { Object.assign(T, was); MORALE.training = train0; MORALE.on = nerve0; RUNNER.on = runner0; FLINCH_STATS.last = null; FLINCH_STATS.ducks = FLINCH_STATS.broke = 0; }
  console.log(failed ? '=== flinch-check: FAIL ===' : '=== flinch-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await flinchCheck()) ? 0 : 1);
