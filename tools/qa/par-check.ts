// A PAR ON A ROOM CLEAR — the check behind src/game/par.ts (`PAR.on`, the level block `scenarios.par`; today levels/killhouse.json alone).
//   bun run tools/qa/par-check.ts
// What it holds (the game stood up by the harness, the kill house's room clear staged):
//   1. the arithmetic (pure): a total on a bar earns that medal, a second past it the next one down, judged on the whole seconds shown; every man lost adds lossSecs; what the next medal needed;
//      and the level's own numbers rank a run that loses two men under a clean one that is slower by less than two penalties
//   2. the file: the block is read, and the validator refuses one out of order, one with an unknown key and one on a level with no room clear
//   3. the clock: armed and NOT running while Sam stands on his mark with nothing ordered; the objective row leads with the three bars; a step past
//      PAR_START_M starts it; in other games an order, and a round fired, start it with Sam still on his mark
//   4. the end: the last defender down = 'taken' = a result at the room clear's own end time, said ONCE on the HUD's log, the row worded with the medal; a
//      teammate lost before the end is counted and priced; a restart starts over; a run that is wiped has no result
//   5. off = the same game: two games on one die, the same orders and keys, PAR.on true and false, digest for digest every half second — and with it off
//      nothing is armed and the row is the room clear's own
//   6. the checkpoint's slice: the Par's snapshot before and after the start, and restore of each (and of none) into a fresh mission — the pair savestate.ts
//      calls; the game refuses a checkpoint while a squad is on the floor, so a whole-file round trip cannot be staged today (the check prints that refusal)
//   PAR_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1) — the proof that it can
// exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const FILE = 'killhouse.json';

export async function parCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { PAR, PAR_START_M, medalOf, parResult } = await import(`${ROOT}/src/game/par.ts`);
  const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`), { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { objectiveText } = await import(`${ROOT}/src/game/mission.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const brk = process.env.PAR_BREAK === '1', knobs0 = knobsCopy();

  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; } };
  const text = readFileSync(resolve(ROOT, 'levels', FILE), 'utf8');
  const levelOf = () => loadLevel(parseLevelData(text));
  /** a Game on the kill house with its room clear staged (the authored placement, the structure's own start) */
  async function stage(on = true, dice: number | null = 5) {
    PAR.on = on && !brk; ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0;
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf(), seed: dice }));
    const g = W.game, rc = g.roomClear;
    const why = await quiet(() => rc.start(0)); if (why) throw new Error(`the room clear did not start on ${FILE}: ${why}`);
    const step = (n = 1) => quiet(() => { for (let i = 0; i < n; i++) W.step(1 / 60); });
    await step(3);
    const foes = () => g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead');
    const drop = (list: any[], by: 'player' | 'guard' = 'player') => quiet(() => { for (const h of list) killGuard(g, h, [1, 0, 0], false, 'shot', by); });
    const order = () => quiet(() => g.orders.give('fallIn', g.orders.targetAt(g.player.char.pos), 'all'));
    const nudge = (m: number) => quiet(() => { const p = g.player.char.pos; g.teleportPlayer([p[0] + m, 0, p[2]]); });
    return { W, g, rc, par: g.par, step, foes, drop, order, nudge, row: () => objectiveText(g) as string };
  }

  try {
    // 1. the arithmetic
    const D = levelOf().scenarios!.par!;
    line(!!D && D.gold < D.silver && D.silver < D.bronze && D.lossSecs > 0, `${FILE} carries a par: gold ${D.gold} · silver ${D.silver} · bronze ${D.bronze} · a man lost ${D.lossSecs} s`);
    line(medalOf(D, D.gold) === 'gold' && medalOf(D, D.gold + 1) === 'silver' && medalOf(D, D.silver) === 'silver' && medalOf(D, D.silver + 1) === 'bronze'
      && medalOf(D, D.bronze) === 'bronze' && medalOf(D, D.bronze + 1) === 'none', 'a total on a bar earns that medal, a second past it the next one down');
    { const r = parResult(D, D.gold + 0.4, 0, 4);
      line(r.medal === 'gold' && r.shown === D.gold && r.next === null && !/was/.test(r.line), `the medal is judged on the whole seconds shown: ${D.gold + 0.4} s reads '${r.line}'`); }
    { const a = parResult(D, D.gold - 1, 0, 4), b = parResult(D, D.gold - 1, 2, 4);
      line(a.medal === 'gold' && a.penalty === 0 && a.next === null && b.penalty === 2 * D.lossSecs && b.total === D.gold - 1 + 2 * D.lossSecs && b.medal !== 'gold',
        `a run a second inside gold is gold clean and ${b.medal} with two men lost (+${b.penalty} s)`);
      const c = parResult(D, D.silver + 3, 0, 4);
      line(c.medal === 'bronze' && c.next?.medal === 'silver' && c.next.short === 3 && / · BRONZE · silver was \d:\d\d$/.test(c.line), `the result says what the next medal needed: '${c.line}'`);
      const fast = parResult(D, D.gold - 10, 2, 4), clean = parResult(D, D.gold - 10 + 2 * D.lossSecs - 1, 0, 4);
      line(fast.total > clean.total, `a run that loses two men (${fast.secs} s → ${fast.total}) ranks under a clean one ${clean.secs - fast.secs} s slower (${clean.total})`); }

    // 2. the file's rules
    { const bad = (edit: (d: any) => void) => { const d = JSON.parse(text); edit(d); return validateLevelData(d).filter((e: string) => /par/.test(e)); };
      line(validateLevelData(JSON.parse(text)).length === 0, 'the level file validates with its block');
      line(bad(d => { d.scenarios.par.silver = d.scenarios.par.gold; }).length > 0, 'refused: silver not past gold');
      line(bad(d => { d.scenarios.par.platinum = 30; }).length > 0, 'refused: a key the block does not have');
      line(bad(d => { delete d.scenarios.roomClear; }).length > 0, 'refused: a par on a level with no room clear'); }

    // 3. the clock starts on a step
    { const A = await stage(); await A.step(90);
      line(!!A.par.data && !A.par.started && A.par.secs === 0 && A.par.result() === null, 'staged: armed, and a second and a half on the mark with nothing ordered has not started the clock');
      line(/^par \d:\d\d \/ \d:\d\d \/ \d:\d\d · \S/.test(A.row()), `the objective row leads with the three bars before the start: '${A.row().slice(0, 44)}…'`);
      await A.nudge(PAR_START_M * 0.6); await A.step(2);
      line(!A.par.started, `a shuffle of ${(PAR_START_M * 0.6).toFixed(1)} m is not a start`);
      await A.nudge(PAR_START_M * 0.8); await A.step(1); const t0 = A.g.time; await A.step(120);
      line(A.par.started && Math.abs(A.par.secs - (A.g.time - t0)) < 0.05, `past ${PAR_START_M} m from the mark the clock runs (${A.par.secs.toFixed(2)} s after two seconds)`);
      line(/^⏱ 0:0[12] → gold \d:\d\d · \S/.test(A.row()), `the clock leads the row, then the medal still on, then the room clear's words: '${A.row().slice(0, 40)}…'`);

      // 4. the end
      const said = () => A.g.messages.filter((m: any) => /^par ▸/.test(m.text)).length;
      await A.drop(A.foes()); await A.step(4);
      const R = A.par.result();
      line(A.rc.end === 'taken' && !!R && R.lost === 0 && Math.abs(R.secs - (A.rc.endAt - t0)) < 0.05 && R.medal === medalOf(D, R.total), `every defender down: taken, ${R?.secs.toFixed(1)} s, nobody lost, ${R?.medal}`);
      const secs = A.par.secs; await A.step(120);
      line(said() === 1 && A.par.secs === secs && A.par.result() === R, 'the result is said once on the HUD log and the clock holds at the end');
      line(/^structure taken · \d:\d\d · (GOLD|SILVER|BRONZE|no medal)/.test(A.row()), `the row at the end: '${A.row().slice(0, 44)}…'`);
      await quiet(() => A.g.restartEncounter()); await A.step(5);
      line(!!A.par.data && !A.par.started && A.par.result() === null && /^par /.test(A.row()), 'a restart: armed again, clock not started, no result');
      // the page's words about the best time go on the line already said, and on the end row (par.best: presentation, main.ts calls it)
      await A.nudge(PAR_START_M + 0.5); await A.step(30); await A.drop(A.foes()); await A.step(4);
      const R2 = A.par.result(), row0 = A.g.messages.filter((m: any) => /^par ▸/.test(m.text)).length;
      A.par.best('best 0:59');
      line(!!R2 && A.par.shown === `${R2.line} · best 0:59` && A.g.messages.filter((m: any) => m.text === A.par.shown).length === 1 && row0 === 1 && / · best 0:59 — /.test(A.row()),
        `the page's best-time words ride the line already said and the end row: '${A.par.shown}'`); }

    // Sam's first round starts it, standing on his mark
    { const F = await stage(); await F.step(30); const before = F.par.started;
      await quiet(() => fireWeapon(F.g, F.g.player.char, [0, 1.2, 13.2], true, { weapon: WEAPONS.fn2000 })); await F.step(2);
      line(!before && F.par.started, 'a round fired from the mark with nothing ordered starts the clock'); }

    // an order starts it; a man lost is priced; wiped = no time
    { const B = await stage(); await B.step(30); const why = await B.order(); await B.step(2);
      line(!why && B.par.started, `an order ('fall in') with Sam still on his mark starts the clock${why ? ` — refused: ${why}` : ''}`);
      const ops = B.g.nightBreach.ops; await B.drop([ops[0]], 'guard'); await B.step(30); await B.drop(B.foes()); await B.step(4);
      const R = B.par.result();
      line(!!R && R.lost === 1 && R.of === ops.length && R.penalty === D.lossSecs && Math.abs(R.total - R.secs - D.lossSecs) < 1e-9 && /1 lost/.test(R.line), `a teammate down at the end is priced: ${R?.line}`);
      const C = await stage(); await C.order(); await C.step(10); await C.drop(C.g.nightBreach.ops, 'guard'); await quiet(() => { C.g.player.down = true; }); await C.step(30);
      line(C.rc.end !== 'taken' && C.par.result() === null, `a run that is not taken (${C.rc.end ?? 'no end'}) has no result`); }

    // 5. off = the same game
    { const play = async (on: boolean) => { const S = await stage(on); const hs: string[] = [];
        await S.step(20); await S.order();
        S.W.input.keys.add('KeyD');
        for (let i = 0; i < 20; i++) { await S.step(30); hs.push(hashDigest(digestGame(S.g, true))); }
        S.W.input.keys.clear(); await S.drop(S.foes()); await S.step(30); hs.push(hashDigest(digestGame(S.g, true)));
        return { S, hs, started: S.par.started as boolean, res: S.par.result(), armed: S.par.data !== null, row: S.row(), said: S.g.messages.some((m: any) => /^par ▸/.test(m.text)) as boolean }; };
      const on = await play(true), off = await play(false);
      const at = on.hs.findIndex((h, i) => h !== off.hs[i]);
      line(at < 0 && on.hs.length === 21, `on and off digest the same over ten seconds and the end (${on.hs.length} digests${at < 0 ? '' : `; first differs at ${at}`})`);
      line(on.started && !!on.res, `with it on that run was timed and ranked (${on.res?.medal})`);
      line(!off.armed && off.res === null && !/par|⏱|GOLD|SILVER|BRONZE|medal/.test(off.row) && !off.said, `with it off nothing is armed and the row is the room clear's own: '${off.row.slice(0, 40)}…'`);
      PAR.on = !brk; }

    // 6. the checkpoint's slice (the Par's own snapshot / restore — savestate.ts calls exactly these; the game itself refuses a checkpoint while a squad is
    //    on the floor, so today the slice is reached only through them)
    { const E = await stage(); await E.step(10);
      const s0 = E.par.snapshot();
      await E.nudge(PAR_START_M + 0.5); await E.step(150);
      const s1 = E.par.snapshot(), t0 = E.g.time - E.par.secs;
      line(!!s0 && s0.t0 === null && !!s1 && typeof s1.t0 === 'number' && Math.abs(s1.t0 - t0) < 1e-6, `the slice: not started before (${JSON.stringify(s0)}), the start's stamp after (${JSON.stringify(s1)})`);
      const round = JSON.parse(JSON.stringify(s1));
      await quiet(() => E.g.restartEncounter()); await E.step(3); const fresh = !E.par.started;
      E.par.restore(round);
      line(fresh && E.par.started && Math.abs((E.g.time - E.par.secs) - t0) < 1e-6, 'a fresh mission handed the running slice (through JSON) has the clock on the same start');
      E.par.restore(s0);
      line(!!E.par.data && !E.par.started && E.par.secs === 0, 'handed the slice from before the start: armed, clock not started');
      E.par.restore(round); E.par.restore(undefined);
      line(!!E.par.data && !E.par.started, 'handed no slice (a file saved with the par off): armed, clock not started');
      let refused = ''; try { await quiet(() => E.W.snapshot('x', true)); } catch (e) { refused = (e as Error).message; }
      console.log(`  (a checkpoint of the game with the squad on the floor: ${refused ? `refused — '${refused}'` : 'taken'})`); }
  } catch (e) { line(false, `threw: ${(e as Error).stack ?? e}`); }
  finally { knobsBack(knobs0); }
  console.log(failed ? `par-check: FAILED (${checks} checks)` : `par-check: all ${checks} hold`);
  return !failed;
}

if (import.meta.main) { const ok = await parCheck(); process.exit(ok ? 0 : 1); }
