// WHO IS TOLD WHEN THE MISSION'S THING IS TAKEN (src/game/takecheck.ts; the maintainer, 10-12: "predictably getting a guard to come by when you pull the objective
// is a bit contrived. makes sense for the server rack in the office but not the officer files").
//   bun run tools/qa/takecheck-check.ts            (also `probes.ts takecheck`, in families `quiet` and `missions`; passes on both stands)
//   TAKECHECK_BREAK=1 bun run tools/qa/takecheck-check.ts     the rule left off and the same lines asked: must fail
// PASS / FAIL each, headless. What it holds:
//   - with the rule on, on every level that carries a quiet block and at every spot of it, the thing taken and twelve seconds played: a man is sent to look at
//     the holder (task 'rack', seven seconds after the take) exactly where the level says the holder is WIRED, and nowhere else; `mission.sweepAt` says the same
//   - the police post's case file (the play note's own mission): nobody is sent; the relay station's middle rack: a man is
//   - with the rule off a man is sent after every take, as the build was
//   - the office's plain night (no quiet mission): a man is sent either way
//   - a man questioned afterwards says 'somebody's been sent to look' where somebody was, and only there
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { drivePulled } = await import(`${ROOT}/src/game/mission.ts`);
const { TAKE, takeTold } = await import(`${ROOT}/src/game/takecheck.ts`);
const D = await import(`${ROOT}/src/game/dialogue.ts`);

const DT = 1 / 60, BREAK = process.env.TAKECHECK_BREAK === '1';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

/** the levels that carry a quiet block, by file */
function quietLevels(): string[] {
  return readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('-gwot.json')).filter(f => { try { return !!JSON.parse(readFileSync(resolve(ROOT, 'levels', f), 'utf8')).scenarios?.quiet; } catch { return false; } }).sort();
}
async function stand(seed: number, file: string | null) {
  Math.random = seeded(0x7a4e + seed * 7919);
  return await hushed(() => standUp({ uploadEvery: 4, ...(file ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) } : {}) })) as any;
}
/** the thing taken now (the pull's own function, as the last frame of the hands' work calls it), then `secs` played with Sam where nobody sees or hears him
 *  again: was a man sent to the holder, and when */
function takeAndWait(W: any, secs = 12): { sent: number; who: string; sweep: number; drive: boolean } {
  const g = W.game; g.godMode = true; g.playerInvisible = true;
  g.mission.stage = 'drive'; const t0 = g.time; drivePulled(g); const sweep = g.mission.sweepAt > 0 ? g.mission.sweepAt - t0 : -1;
  let sent = -1, who = '';
  for (let i = 0; i < Math.round(secs / DT); i++) { W.step(DT); if (sent < 0) { const m = g.guards.find((x: any) => x.task?.kind === 'rack'); if (m) { sent = g.time - t0; who = m.callsign; } } }
  const staff = g.guards.find((x: any) => !x.unit && x.state !== 'dead' && x.team === 'guard');
  const drive = !!staff && !!D.gather(g, staff).intel.find((it: any) => it.kind === 'drive')?.live;
  return { sent, who, sweep, drive };
}

export async function takeCheck(): Promise<boolean> {
  console.log('\n=== takecheck: a man is sent to look at an emptied holder only where something would tell them it is empty ===');
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = TAKE.wired;
  try {
    // (1) every quiet level, every spot, the rule on (BREAK: left off) and off
    const rows: string[] = []; let okOn = true, okOff = true, okWords = true, spots = 0, wiredN = 0; let post = '', relay = '';
    for (const file of quietLevels()) {
      const W = await stand(3, file), g = W.game, Q = g.level.scenarios.quiet; const squad = /lights-out|train-silent/.test(file) ? '&squad=1' : '';
      for (let k = 0; k < Q.spots.length; k++) {
        const P = Q.spots[k]; const res: Record<string, ReturnType<typeof takeAndWait> | null> = { on: null, off: null };
        for (const arm of ['on', 'off'] as const) {
          TAKE.wired = arm === 'on' && !BREAK;
          let found = false; for (let pin = 0; pin < 400 && !found; pin++) { await hushed(() => startFromQuery(g, `?quiet=${pin}${squad}`)); if (g.quiet.active && g.quiet.deal.spot === k) found = true; else await hushed(() => quitScenario(g)); }
          if (!found) { rows.push(`${file} '${P.holder}': no deal reaches this spot`); okOn = false; continue; }
          for (let i = 0; i < 12; i++) W.step(DT);
          res[arm] = takeAndWait(W); await hushed(() => quitScenario(g));
        }
        const on = res.on, off = res.off; if (!on || !off) continue; spots++; if (P.wired) wiredN++;
        const wantOn = !!P.wired;
        const onOk = wantOn ? on.sent >= 6.5 && on.sent <= 8 && on.sweep > 0 : on.sent < 0 && on.sweep < 0;
        const offOk = off.sent >= 6.5 && off.sent <= 8;
        const wordsOk = wantOn ? on.drive : !on.drive;
        okOn &&= onOk; okOff &&= offOk; okWords &&= wordsOk;
        const row = `${file} · ${P.holder}${P.wired ? ' (wired)' : ''}: rule on ${on.sent < 0 ? 'nobody sent' : `${on.who} sent at ${on.sent.toFixed(1)} s`} · rule off ${off.sent < 0 ? 'nobody sent' : `${off.who} sent at ${off.sent.toFixed(1)} s`}${on.drive ? ' · questioned: \'somebody\'s been sent\'' : ''}${onOk && offOk && wordsOk ? '' : '   ← WRONG'}`;
        rows.push(row); if (file === 'police-post.json') post += (post ? ' · ' : '') + `${P.holder}: ${on.sent < 0 ? 'nobody' : on.who}`; if (file === 'quiet-relay.json') relay += (relay ? ' · ' : '') + `${P.holder}: ${on.sent < 0 ? 'nobody' : on.who}`;
      }
    }
    verdict(okOn && spots > 0, 'with the rule on a man is sent to the emptied holder exactly where the level says it is wired, seven seconds after the take, and nowhere else', `${spots} spots over ${quietLevels().length} levels, ${wiredN} wired\n    ${rows.join('\n    ')}`);
    verdict(okOff, 'with the rule off a man is sent after every take, as the build was', `${spots} spots`);
    verdict(okWords, 'a man questioned afterwards says \'somebody\'s been sent to look\' where somebody was, and only there', `${spots} spots`);
    verdict(!!post && !/: (?!nobody)/.test(post) && wiredN >= 1 && /the middle rack: (?!nobody)/.test(relay), 'the police post\'s holders send nobody; the relay station\'s middle rack, on the station\'s network, does', `police post — ${post || 'not played'}\n    relay station — ${relay || 'not played'}`);

    // (2) the office's plain night: no quiet mission, the rack drops off the network either way
    const plain: string[] = []; let okPlain = true;
    for (const arm of [true, false]) {
      const W = await stand(5, null), g = W.game; TAKE.wired = arm;   // (after the stand-up: the frozen stand pins the switch off as it stands the game)
      for (let i = 0; i < 30; i++) W.step(DT);
      const told = takeTold(g), r = takeAndWait(W); okPlain &&= told && r.sent >= 6.5 && r.sent <= 8;
      plain.push(`rule ${arm ? 'on' : 'off'}: ${r.sent < 0 ? 'nobody sent' : `${r.who} sent at ${r.sent.toFixed(1)} s`}`);
    }
    verdict(okPlain, 'the office\'s server rack on the plain night sends its man whatever the switch says', plain.join(' · '));
  } catch (e) { verdict(false, 'the check threw', e instanceof Error ? e.stack ?? e.message : String(e)); }
  finally { TAKE.wired = was; }
  console.log(`=== takecheck: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit(await takeCheck() ? 0 : 1);
